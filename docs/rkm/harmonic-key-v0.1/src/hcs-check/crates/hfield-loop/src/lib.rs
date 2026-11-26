use hfield_domain::{FieldScore, GestureEvent, NoteEvent};
use hfield_music::{midi_note_to_frequency_hz, midi_note_to_name};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LoopPhraseReport {
    pub strategy: String,
    pub status: String,
    pub title: String,
    pub phrase_id: String,
    pub requested_start_measure: u32,
    pub requested_end_measure: u32,
    pub start_measure: u32,
    pub end_measure: u32,
    pub total_measure_count: u32,
    pub beats_per_measure: u32,
    pub beat_unit: u32,
    pub tempo_bpm: f64,
    pub quarter_note_ms: f64,
    pub start_ms: u32,
    pub end_ms: u32,
    pub duration_ms: u32,
    pub start_beat: f64,
    pub end_beat: f64,
    pub start_cursor_x_percent: f32,
    pub end_cursor_x_percent: f32,
    pub included_note_count: usize,
    pub included_conductor_cue_count: usize,
    pub notes: Vec<LoopPhraseNote>,
    pub conductor_cues: Vec<LoopPhraseCue>,
    pub playhead_geometry_policy: String,
    pub loop_ready: bool,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LoopPhraseNote {
    pub event_index: usize,
    pub track_id: String,
    pub role: String,
    pub midi_note: u8,
    pub note_name: String,
    pub frequency_hz: f32,
    pub original_start_ms: u32,
    pub original_end_ms: u32,
    pub clipped_start_ms: u32,
    pub clipped_end_ms: u32,
    pub phrase_start_ms: u32,
    pub phrase_duration_ms: u32,
    pub measure_index: u32,
    pub beat_in_measure: f64,
    pub velocity: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LoopPhraseCue {
    pub event_index: usize,
    pub gesture_id: String,
    pub operator: Option<String>,
    pub original_start_ms: u32,
    pub original_end_ms: u32,
    pub clipped_start_ms: u32,
    pub clipped_end_ms: u32,
    pub phrase_start_ms: u32,
    pub phrase_duration_ms: u32,
    pub measure_index: u32,
    pub beat_in_measure: f64,
    pub intensity: f32,
}

pub fn create_loop_phrase_report(
    score: &FieldScore,
    requested_start_measure: u32,
    requested_end_measure: u32,
) -> LoopPhraseReport {
    let (beats_per_measure, beat_unit) = parse_meter(&score.music.meter);
    let quarter_note_ms = quarter_note_ms(score.music.tempo_bpm);
    let measure_ms = measure_ms(quarter_note_ms, beats_per_measure);
    let total_duration_ms = total_duration_ms(score).max(measure_ms);
    let total_measure_count = div_ceil(total_duration_ms, measure_ms).max(1);
    let start_measure = requested_start_measure.clamp(1, total_measure_count);
    let requested_end_measure = requested_end_measure.max(requested_start_measure.max(1));
    let end_measure = requested_end_measure.clamp(start_measure, total_measure_count);
    let start_ms = start_measure
        .saturating_sub(1)
        .saturating_mul(measure_ms)
        .min(total_duration_ms.saturating_sub(1));
    let end_ms = end_measure
        .saturating_mul(measure_ms)
        .min(total_duration_ms)
        .max(start_ms.saturating_add(1));
    let duration_ms = end_ms.saturating_sub(start_ms);

    let notes = collect_phrase_notes(score, start_ms, end_ms, quarter_note_ms, beats_per_measure);
    let conductor_cues =
        collect_phrase_cues(score, start_ms, end_ms, quarter_note_ms, beats_per_measure);
    let mut warnings = Vec::new();

    if requested_start_measure != start_measure || requested_end_measure != end_measure {
        warnings.push(format!(
            "requested loop M{requested_start_measure}-M{requested_end_measure} normalized to M{start_measure}-M{end_measure}"
        ));
    }
    if notes.is_empty() {
        warnings.push("loop phrase contains no music notes".to_string());
    }
    if conductor_cues.is_empty() {
        warnings.push("loop phrase contains no conductor cues".to_string());
    }

    LoopPhraseReport {
        strategy: "rust_owned_loop_phrase_core_v1".to_string(),
        status: "ok".to_string(),
        title: score.title.clone(),
        phrase_id: format!("M{start_measure}_M{end_measure}"),
        requested_start_measure,
        requested_end_measure,
        start_measure,
        end_measure,
        total_measure_count,
        beats_per_measure,
        beat_unit,
        tempo_bpm: score.music.tempo_bpm,
        quarter_note_ms,
        start_ms,
        end_ms,
        duration_ms,
        start_beat: round3(start_ms as f64 / quarter_note_ms),
        end_beat: round3(end_ms as f64 / quarter_note_ms),
        start_cursor_x_percent: percent(start_ms, total_duration_ms),
        end_cursor_x_percent: percent(end_ms, total_duration_ms),
        included_note_count: notes.len(),
        included_conductor_cue_count: conductor_cues.len(),
        notes,
        conductor_cues,
        playhead_geometry_policy:
            "cursor_prefers_notation_note_geometry_then_phrase_measure_window_then_time_percent"
                .to_string(),
        loop_ready: duration_ms > 0,
        warnings,
    }
}

pub fn extract_loop_phrase_score(
    score: &FieldScore,
    requested_start_measure: u32,
    requested_end_measure: u32,
) -> Result<(FieldScore, LoopPhraseReport), String> {
    let report = create_loop_phrase_report(score, requested_start_measure, requested_end_measure);
    if !report.loop_ready {
        return Err("loop phrase is not playable".to_string());
    }

    let mut phrase_score = score.clone();
    phrase_score.title = format!("{} — Phrase {}", score.title, report.phrase_id);

    for track in &mut phrase_score.music.tracks {
        let mut phrase_notes = Vec::new();
        for note in &track.notes {
            let note_end = note.start_ms.saturating_add(note.duration_ms);
            if let Some((clipped_start, clipped_end)) =
                clipped_overlap(note.start_ms, note_end, report.start_ms, report.end_ms)
            {
                phrase_notes.push(NoteEvent {
                    midi_note: note.midi_note,
                    start_ms: clipped_start.saturating_sub(report.start_ms),
                    duration_ms: clipped_end.saturating_sub(clipped_start).max(1),
                    velocity: note.velocity,
                });
            }
        }
        phrase_notes.sort_by_key(|note| (note.start_ms, note.midi_note));
        track.notes = phrase_notes;
    }

    let mut phrase_events = Vec::new();
    for event in &phrase_score.conductor.primary_hand_track.events {
        let event_end = event.start_ms.saturating_add(event.duration_ms);
        if let Some((clipped_start, clipped_end)) =
            clipped_overlap(event.start_ms, event_end, report.start_ms, report.end_ms)
        {
            phrase_events.push(GestureEvent {
                gesture_id: event.gesture_id.clone(),
                start_ms: clipped_start.saturating_sub(report.start_ms),
                duration_ms: clipped_end.saturating_sub(clipped_start).max(1),
                intensity: event.intensity,
                operator: event.operator.clone(),
            });
        }
    }
    phrase_events.sort_by_key(|event| (event.start_ms, event.gesture_id.clone()));
    phrase_score.conductor.primary_hand_track.events = phrase_events;

    Ok((phrase_score, report))
}

fn collect_phrase_notes(
    score: &FieldScore,
    phrase_start_ms: u32,
    phrase_end_ms: u32,
    quarter_note_ms: f64,
    beats_per_measure: u32,
) -> Vec<LoopPhraseNote> {
    let mut notes = Vec::new();

    for track in &score.music.tracks {
        let mut sorted_notes = track.notes.iter().collect::<Vec<_>>();
        sorted_notes.sort_by_key(|note| (note.start_ms, note.midi_note));

        for (index, note) in sorted_notes.into_iter().enumerate() {
            let note_end = note.start_ms.saturating_add(note.duration_ms);
            let Some((clipped_start_ms, clipped_end_ms)) =
                clipped_overlap(note.start_ms, note_end, phrase_start_ms, phrase_end_ms)
            else {
                continue;
            };
            let (measure_index, beat_in_measure) =
                measure_beat_for_ms(note.start_ms, quarter_note_ms, beats_per_measure);

            notes.push(LoopPhraseNote {
                event_index: index + 1,
                track_id: track.track_id.clone(),
                role: track.role.clone(),
                midi_note: note.midi_note,
                note_name: midi_note_to_name(note.midi_note),
                frequency_hz: midi_note_to_frequency_hz(note.midi_note),
                original_start_ms: note.start_ms,
                original_end_ms: note_end,
                clipped_start_ms,
                clipped_end_ms,
                phrase_start_ms: clipped_start_ms.saturating_sub(phrase_start_ms),
                phrase_duration_ms: clipped_end_ms.saturating_sub(clipped_start_ms).max(1),
                measure_index,
                beat_in_measure,
                velocity: note.velocity,
            });
        }
    }

    notes.sort_by_key(|note| {
        (
            note.original_start_ms,
            note.track_id.clone(),
            note.midi_note,
        )
    });
    notes
}

fn collect_phrase_cues(
    score: &FieldScore,
    phrase_start_ms: u32,
    phrase_end_ms: u32,
    quarter_note_ms: f64,
    beats_per_measure: u32,
) -> Vec<LoopPhraseCue> {
    let mut cues = Vec::new();

    for (index, event) in score.conductor.primary_hand_track.events.iter().enumerate() {
        let event_end = event.start_ms.saturating_add(event.duration_ms);
        let Some((clipped_start_ms, clipped_end_ms)) =
            clipped_overlap(event.start_ms, event_end, phrase_start_ms, phrase_end_ms)
        else {
            continue;
        };
        let (measure_index, beat_in_measure) =
            measure_beat_for_ms(event.start_ms, quarter_note_ms, beats_per_measure);

        cues.push(LoopPhraseCue {
            event_index: index + 1,
            gesture_id: event.gesture_id.clone(),
            operator: event.operator.clone(),
            original_start_ms: event.start_ms,
            original_end_ms: event_end,
            clipped_start_ms,
            clipped_end_ms,
            phrase_start_ms: clipped_start_ms.saturating_sub(phrase_start_ms),
            phrase_duration_ms: clipped_end_ms.saturating_sub(clipped_start_ms).max(1),
            measure_index,
            beat_in_measure,
            intensity: event.intensity,
        });
    }

    cues.sort_by_key(|cue| (cue.original_start_ms, cue.gesture_id.clone()));
    cues
}

fn clipped_overlap(
    source_start_ms: u32,
    source_end_ms: u32,
    phrase_start_ms: u32,
    phrase_end_ms: u32,
) -> Option<(u32, u32)> {
    if source_start_ms >= phrase_end_ms || source_end_ms <= phrase_start_ms {
        return None;
    }
    let clipped_start = source_start_ms.max(phrase_start_ms);
    let clipped_end = source_end_ms.min(phrase_end_ms);
    (clipped_end > clipped_start).then_some((clipped_start, clipped_end))
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

fn measure_ms(quarter_note_ms: f64, beats_per_measure: u32) -> u32 {
    (quarter_note_ms * beats_per_measure as f64)
        .round()
        .max(1.0) as u32
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

fn div_ceil(value: u32, divisor: u32) -> u32 {
    value.saturating_add(divisor.saturating_sub(1)) / divisor.max(1)
}

fn round3(value: f64) -> f64 {
    (value * 1000.0).round() / 1000.0
}

#[cfg(test)]
mod tests {
    use super::*;
    use hfield_domain::{FieldScore, GestureEvent, NoteEvent};

    fn phrase_test_score() -> FieldScore {
        let mut score = FieldScore::default_hcs();
        score.title = "Loop Test".to_string();
        score.music.tempo_bpm = 60.0;
        score.music.meter = "4/4".to_string();
        score.music.tracks[0].notes = vec![
            NoteEvent {
                midi_note: 60,
                start_ms: 0,
                duration_ms: 1000,
                velocity: 0.8,
            },
            NoteEvent {
                midi_note: 62,
                start_ms: 4000,
                duration_ms: 1000,
                velocity: 0.8,
            },
            NoteEvent {
                midi_note: 64,
                start_ms: 7000,
                duration_ms: 1200,
                velocity: 0.8,
            },
        ];
        score.conductor.primary_hand_track.events = vec![
            GestureEvent {
                gesture_id: "g1".to_string(),
                start_ms: 0,
                duration_ms: 900,
                intensity: 0.5,
                operator: Some("ictus".to_string()),
            },
            GestureEvent {
                gesture_id: "g5".to_string(),
                start_ms: 4000,
                duration_ms: 900,
                intensity: 0.7,
                operator: Some("hold".to_string()),
            },
        ];
        score
    }

    #[test]
    fn reports_measure_bounded_phrase_contents() {
        let score = phrase_test_score();
        let report = create_loop_phrase_report(&score, 2, 2);

        assert_eq!(report.start_measure, 2);
        assert_eq!(report.end_measure, 2);
        assert_eq!(report.start_ms, 4000);
        assert_eq!(report.end_ms, 8000);
        assert_eq!(report.included_note_count, 2);
        assert_eq!(report.included_conductor_cue_count, 1);
        assert!(report.loop_ready);
    }

    #[test]
    fn normalizes_out_of_range_phrase_requests() {
        let score = phrase_test_score();
        let report = create_loop_phrase_report(&score, 99, 100);

        assert_eq!(report.start_measure, report.total_measure_count);
        assert_eq!(report.end_measure, report.total_measure_count);
        assert!(report
            .warnings
            .iter()
            .any(|warning| warning.contains("normalized")));
    }

    #[test]
    fn extracts_phrase_score_shifted_to_zero() {
        let score = phrase_test_score();
        let (phrase_score, report) = extract_loop_phrase_score(&score, 2, 2).expect("phrase");

        assert_eq!(report.start_ms, 4000);
        assert_eq!(phrase_score.music.tracks[0].notes[0].start_ms, 0);
        assert_eq!(
            phrase_score.conductor.primary_hand_track.events[0].start_ms,
            0
        );
        assert!(phrase_score.title.contains("Phrase M2_M2"));
    }
}
