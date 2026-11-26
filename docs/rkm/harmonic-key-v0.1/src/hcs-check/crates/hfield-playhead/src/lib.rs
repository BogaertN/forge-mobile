use hfield_domain::{FieldScore, GestureEvent, MusicTrack, NoteEvent};
use hfield_music::{midi_note_to_frequency_hz, midi_note_to_name};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PlayheadCursorReport {
    pub strategy: String,
    pub title: String,
    pub status: String,
    pub current_time_ms: u32,
    pub current_time_seconds: f64,
    pub total_duration_ms: u32,
    pub total_duration_seconds: f64,
    pub progress_percent: f32,
    pub score_cursor_x_percent: f32,
    pub tempo_bpm: f64,
    pub meter: String,
    pub beats_per_measure: u32,
    pub beat_unit: u32,
    pub quarter_note_ms: f64,
    pub current_absolute_beat: f64,
    pub current_measure: u32,
    pub current_beat_in_measure: f64,
    pub active_note_count: usize,
    pub active_notes: Vec<PlayheadActiveNote>,
    pub next_note: Option<PlayheadQueuedNote>,
    pub active_conductor_cue: Option<PlayheadActiveCue>,
    pub next_conductor_cue: Option<PlayheadQueuedCue>,
    pub active_gesture_id: Option<String>,
    pub active_operator: Option<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PlayheadActiveNote {
    pub event_index: usize,
    pub track_id: String,
    pub role: String,
    pub midi_note: u8,
    pub note_name: String,
    pub frequency_hz: f32,
    pub start_ms: u32,
    pub duration_ms: u32,
    pub end_ms: u32,
    pub measure_index: u32,
    pub beat_in_measure: f64,
    pub velocity: f32,
    pub resonance_lane: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PlayheadQueuedNote {
    pub event_index: usize,
    pub track_id: String,
    pub note_name: String,
    pub start_ms: u32,
    pub measure_index: u32,
    pub beat_in_measure: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PlayheadActiveCue {
    pub event_index: usize,
    pub gesture_id: String,
    pub operator: Option<String>,
    pub start_ms: u32,
    pub duration_ms: u32,
    pub end_ms: u32,
    pub measure_index: u32,
    pub beat_in_measure: f64,
    pub intensity: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PlayheadQueuedCue {
    pub event_index: usize,
    pub gesture_id: String,
    pub operator: Option<String>,
    pub start_ms: u32,
    pub measure_index: u32,
    pub beat_in_measure: f64,
}

pub fn create_playhead_cursor_report(
    score: &FieldScore,
    requested_time_ms: u32,
) -> PlayheadCursorReport {
    let (beats_per_measure, beat_unit) = parse_meter(&score.music.meter);
    let quarter_note_ms = quarter_note_ms(score.music.tempo_bpm);
    let total_duration_ms = total_duration_ms(score).max(1);
    let current_time_ms = requested_time_ms.min(total_duration_ms);
    let current_time_seconds = round3(current_time_ms as f64 / 1000.0);
    let total_duration_seconds = round3(total_duration_ms as f64 / 1000.0);
    let progress_percent = percent(current_time_ms, total_duration_ms);
    let current_absolute_beat = current_time_ms as f64 / quarter_note_ms;
    let current_measure = (current_absolute_beat / beats_per_measure as f64).floor() as u32 + 1;
    let current_beat_in_measure = round3((current_absolute_beat % beats_per_measure as f64) + 1.0);

    let active_notes =
        active_notes_at_time(score, current_time_ms, quarter_note_ms, beats_per_measure);
    let next_note =
        next_note_after_time(score, current_time_ms, quarter_note_ms, beats_per_measure);
    let active_conductor_cue =
        active_cue_at_time(score, current_time_ms, quarter_note_ms, beats_per_measure);
    let next_conductor_cue =
        next_cue_after_time(score, current_time_ms, quarter_note_ms, beats_per_measure);
    let active_gesture_id = active_conductor_cue
        .as_ref()
        .map(|cue| cue.gesture_id.clone());
    let active_operator = active_conductor_cue
        .as_ref()
        .and_then(|cue| cue.operator.clone());

    let mut warnings = Vec::new();
    if score
        .music
        .tracks
        .iter()
        .all(|track| track.notes.is_empty())
    {
        warnings.push("playhead cursor has no music notes to track".to_string());
    }
    if score.conductor.primary_hand_track.events.is_empty() {
        warnings.push("playhead cursor has no conductor cues to track".to_string());
    }
    if requested_time_ms > total_duration_ms {
        warnings.push(format!(
            "requested time {requested_time_ms} ms exceeded score duration {total_duration_ms} ms and was clamped"
        ));
    }

    PlayheadCursorReport {
        strategy: "rust_owned_playhead_cursor_sync_v1".to_string(),
        title: score.title.clone(),
        status: "ok".to_string(),
        current_time_ms,
        current_time_seconds,
        total_duration_ms,
        total_duration_seconds,
        progress_percent,
        score_cursor_x_percent: progress_percent,
        tempo_bpm: score.music.tempo_bpm,
        meter: score.music.meter.clone(),
        beats_per_measure,
        beat_unit,
        quarter_note_ms,
        current_absolute_beat: round3(current_absolute_beat),
        current_measure,
        current_beat_in_measure,
        active_note_count: active_notes.len(),
        active_notes,
        next_note,
        active_conductor_cue,
        next_conductor_cue,
        active_gesture_id,
        active_operator,
        warnings,
    }
}

fn active_notes_at_time(
    score: &FieldScore,
    time_ms: u32,
    quarter_note_ms: f64,
    beats_per_measure: u32,
) -> Vec<PlayheadActiveNote> {
    let mut active = Vec::new();

    for track in &score.music.tracks {
        for (event_index, note) in sorted_notes(track).into_iter().enumerate() {
            let end_ms = note.start_ms.saturating_add(note.duration_ms);
            if time_ms >= note.start_ms && time_ms < end_ms {
                active.push(active_note_from_note(
                    event_index + 1,
                    track,
                    note,
                    quarter_note_ms,
                    beats_per_measure,
                ));
            }
        }
    }

    active.sort_by_key(|note| (note.start_ms, note.track_id.clone(), note.midi_note));
    active
}

fn next_note_after_time(
    score: &FieldScore,
    time_ms: u32,
    quarter_note_ms: f64,
    beats_per_measure: u32,
) -> Option<PlayheadQueuedNote> {
    let mut queued = Vec::new();

    for track in &score.music.tracks {
        for (event_index, note) in sorted_notes(track).into_iter().enumerate() {
            if note.start_ms > time_ms {
                let (measure_index, beat_in_measure) =
                    measure_beat_for_ms(note.start_ms, quarter_note_ms, beats_per_measure);

                queued.push(PlayheadQueuedNote {
                    event_index: event_index + 1,
                    track_id: track.track_id.clone(),
                    note_name: midi_note_to_name(note.midi_note),
                    start_ms: note.start_ms,
                    measure_index,
                    beat_in_measure,
                });
            }
        }
    }

    queued.sort_by_key(|note| (note.start_ms, note.track_id.clone(), note.event_index));
    queued.into_iter().next()
}

fn active_note_from_note(
    event_index: usize,
    track: &MusicTrack,
    note: &NoteEvent,
    quarter_note_ms: f64,
    beats_per_measure: u32,
) -> PlayheadActiveNote {
    let (measure_index, beat_in_measure) =
        measure_beat_for_ms(note.start_ms, quarter_note_ms, beats_per_measure);

    PlayheadActiveNote {
        event_index,
        track_id: track.track_id.clone(),
        role: track.role.clone(),
        midi_note: note.midi_note,
        note_name: midi_note_to_name(note.midi_note),
        frequency_hz: midi_note_to_frequency_hz(note.midi_note),
        start_ms: note.start_ms,
        duration_ms: note.duration_ms,
        end_ms: note.start_ms.saturating_add(note.duration_ms),
        measure_index,
        beat_in_measure,
        velocity: note.velocity,
        resonance_lane: note_resonance_lane(note.midi_note).to_string(),
    }
}

fn active_cue_at_time(
    score: &FieldScore,
    time_ms: u32,
    quarter_note_ms: f64,
    beats_per_measure: u32,
) -> Option<PlayheadActiveCue> {
    score
        .conductor
        .primary_hand_track
        .events
        .iter()
        .enumerate()
        .find(|(_, event)| {
            time_ms >= event.start_ms && time_ms < event.start_ms.saturating_add(event.duration_ms)
        })
        .map(|(index, event)| {
            active_cue_from_event(index + 1, event, quarter_note_ms, beats_per_measure)
        })
}

fn next_cue_after_time(
    score: &FieldScore,
    time_ms: u32,
    quarter_note_ms: f64,
    beats_per_measure: u32,
) -> Option<PlayheadQueuedCue> {
    score
        .conductor
        .primary_hand_track
        .events
        .iter()
        .enumerate()
        .filter(|(_, event)| event.start_ms > time_ms)
        .min_by_key(|(_, event)| event.start_ms)
        .map(|(index, event)| {
            let (measure_index, beat_in_measure) =
                measure_beat_for_ms(event.start_ms, quarter_note_ms, beats_per_measure);

            PlayheadQueuedCue {
                event_index: index + 1,
                gesture_id: event.gesture_id.clone(),
                operator: event.operator.clone(),
                start_ms: event.start_ms,
                measure_index,
                beat_in_measure,
            }
        })
}

fn active_cue_from_event(
    event_index: usize,
    event: &GestureEvent,
    quarter_note_ms: f64,
    beats_per_measure: u32,
) -> PlayheadActiveCue {
    let (measure_index, beat_in_measure) =
        measure_beat_for_ms(event.start_ms, quarter_note_ms, beats_per_measure);

    PlayheadActiveCue {
        event_index,
        gesture_id: event.gesture_id.clone(),
        operator: event.operator.clone(),
        start_ms: event.start_ms,
        duration_ms: event.duration_ms,
        end_ms: event.start_ms.saturating_add(event.duration_ms),
        measure_index,
        beat_in_measure,
        intensity: event.intensity,
    }
}

fn sorted_notes(track: &MusicTrack) -> Vec<&NoteEvent> {
    let mut notes = track.notes.iter().collect::<Vec<_>>();
    notes.sort_by_key(|note| (note.start_ms, note.midi_note));
    notes
}

fn parse_meter(meter: &str) -> (u32, u32) {
    let Some((beats, unit)) = meter.split_once('/') else {
        return (4, 4);
    };

    let beats = beats.trim().parse::<u32>().unwrap_or(4).max(1);
    let unit = unit.trim().parse::<u32>().unwrap_or(4).max(1);
    (beats, unit)
}

fn quarter_note_ms(tempo_bpm: f64) -> f64 {
    if tempo_bpm <= 0.0 {
        714.0
    } else {
        (60_000.0 / tempo_bpm).round().max(1.0)
    }
}

fn total_duration_ms(score: &FieldScore) -> u32 {
    let music_end = score
        .music
        .tracks
        .iter()
        .flat_map(|track| track.notes.iter())
        .map(|note| note.start_ms.saturating_add(note.duration_ms))
        .max()
        .unwrap_or(0);
    let conductor_end = score
        .conductor
        .primary_hand_track
        .events
        .iter()
        .map(|event| event.start_ms.saturating_add(event.duration_ms))
        .max()
        .unwrap_or(0);

    music_end.max(conductor_end)
}

fn measure_beat_for_ms(time_ms: u32, quarter_note_ms: f64, beats_per_measure: u32) -> (u32, f64) {
    let absolute_beat = time_ms as f64 / quarter_note_ms;
    let measure_index = (absolute_beat / beats_per_measure as f64).floor() as u32 + 1;
    let beat_in_measure = round3((absolute_beat % beats_per_measure as f64) + 1.0);
    (measure_index, beat_in_measure)
}

fn percent(value_ms: u32, total_duration_ms: u32) -> f32 {
    if total_duration_ms == 0 {
        return 0.0;
    }
    ((value_ms as f64 / total_duration_ms as f64) * 100.0).clamp(0.0, 100.0) as f32
}

fn note_resonance_lane(midi_note: u8) -> &'static str {
    match midi_note % 9 {
        0..=2 => "lower_field",
        3..=5 => "center_field",
        _ => "upper_field",
    }
}

fn round3(value: f64) -> f64 {
    (value * 1000.0).round() / 1000.0
}

#[cfg(test)]
mod tests {
    use super::*;
    use hfield_domain::{FieldScore, GestureEvent, NoteEvent};

    #[test]
    fn reports_current_measure_beat_and_active_notes() {
        let mut score = FieldScore::default_hcs();
        score.music.tempo_bpm = 84.0;
        score.music.tracks[0].notes = vec![
            NoteEvent {
                midi_note: 64,
                start_ms: 0,
                duration_ms: 714,
                velocity: 0.8,
            },
            NoteEvent {
                midi_note: 65,
                start_ms: 714,
                duration_ms: 714,
                velocity: 0.8,
            },
        ];

        let report = create_playhead_cursor_report(&score, 714);

        assert_eq!(report.current_measure, 1);
        assert_eq!(report.current_beat_in_measure, 2.0);
        assert_eq!(report.active_note_count, 1);
        assert_eq!(report.active_notes[0].note_name, "F4");
    }

    #[test]
    fn clamps_time_beyond_score_duration() {
        let mut score = FieldScore::default_hcs();
        score.music.tracks[0].notes = vec![NoteEvent {
            midi_note: 60,
            start_ms: 0,
            duration_ms: 500,
            velocity: 0.7,
        }];

        let report = create_playhead_cursor_report(&score, 99_000);

        assert_eq!(report.current_time_ms, report.total_duration_ms);
        assert!(report
            .warnings
            .iter()
            .any(|warning| warning.contains("clamped")));
    }

    #[test]
    fn reports_active_and_next_conductor_cues() {
        let mut score = FieldScore::default_hcs();
        score.conductor.primary_hand_track.events = vec![
            GestureEvent {
                gesture_id: "g1".to_string(),
                start_ms: 0,
                duration_ms: 500,
                intensity: 0.5,
                operator: Some("ictus".to_string()),
            },
            GestureEvent {
                gesture_id: "g5".to_string(),
                start_ms: 714,
                duration_ms: 500,
                intensity: 0.7,
                operator: Some("hold".to_string()),
            },
        ];

        let report = create_playhead_cursor_report(&score, 250);

        assert_eq!(report.active_gesture_id.as_deref(), Some("g1"));
        assert_eq!(report.active_operator.as_deref(), Some("ictus"));
        assert_eq!(
            report.next_conductor_cue.expect("next cue").gesture_id,
            "g5"
        );
    }
}
