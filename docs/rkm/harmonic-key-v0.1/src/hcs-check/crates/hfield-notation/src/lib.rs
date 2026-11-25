use hfield_conductor::gesture_definition;
use hfield_domain::{FieldScore, GestureEvent, MusicTrack, NoteEvent};
use hfield_music::{midi_note_to_frequency_hz, midi_note_to_name};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NotationLayoutReport {
    pub strategy: String,
    pub title: String,
    pub tempo_bpm: f64,
    pub meter: String,
    pub tuning_mode: String,
    pub beats_per_measure: u32,
    pub beat_unit: u32,
    pub quarter_note_ms: f64,
    pub total_duration_ms: u32,
    pub total_duration_seconds: f64,
    pub total_beats: f64,
    pub measure_count: u32,
    pub voice_count: usize,
    pub note_count: usize,
    pub conductor_cue_count: usize,
    pub voices: Vec<NotationVoiceLane>,
    pub cue_strip: Vec<NotationCueBlock>,
    pub selected_note: Option<SelectedNotationNote>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NotationVoiceLane {
    pub track_id: String,
    pub role: String,
    pub display_name: String,
    pub staff_y_percent: f32,
    pub note_count: usize,
    pub notes: Vec<NotationNoteBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NotationNoteBlock {
    pub event_index: usize,
    pub track_id: String,
    pub role: String,
    pub midi_note: u8,
    pub note_name: String,
    pub frequency_hz: f32,
    pub start_ms: u32,
    pub duration_ms: u32,
    pub end_ms: u32,
    pub start_beat: f64,
    pub duration_beats: f64,
    pub measure_index: u32,
    pub beat_in_measure: f64,
    pub x_percent: f32,
    pub width_percent: f32,
    pub y_percent: f32,
    pub velocity: f32,
    pub resonance_lane: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NotationCueBlock {
    pub event_index: usize,
    pub gesture_id: String,
    pub gesture_name: String,
    pub operator: Option<String>,
    pub field_region: String,
    pub anchor: String,
    pub start_ms: u32,
    pub duration_ms: u32,
    pub end_ms: u32,
    pub start_beat: f64,
    pub duration_beats: f64,
    pub measure_index: u32,
    pub beat_in_measure: f64,
    pub x_percent: f32,
    pub width_percent: f32,
    pub cue_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SelectedNotationNote {
    pub event_index: usize,
    pub track_id: String,
    pub role: String,
    pub midi_note: u8,
    pub note_name: String,
    pub frequency_hz: f32,
    pub start_ms: u32,
    pub duration_ms: u32,
    pub start_beat: f64,
    pub duration_beats: f64,
    pub measure_index: u32,
    pub beat_in_measure: f64,
    pub velocity: f32,
    pub resonance_lane: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NotationEditReport {
    pub status: String,
    pub action: String,
    pub selected_note: Option<SelectedNotationNote>,
    pub layout: NotationLayoutReport,
}

pub fn create_notation_layout_report(score: &FieldScore) -> NotationLayoutReport {
    let (beats_per_measure, beat_unit) = parse_meter(&score.music.meter);
    let quarter_note_ms = quarter_note_ms(score.music.tempo_bpm);
    let total_duration_ms = total_duration_ms(score).max(1);
    let total_duration_seconds = round3(total_duration_ms as f64 / 1000.0);
    let total_beats = round3(total_duration_ms as f64 / quarter_note_ms);
    let measure_count = ((total_beats / beats_per_measure as f64).ceil() as u32).max(1);
    let voices = build_voice_lanes(score, quarter_note_ms, total_duration_ms, beats_per_measure);
    let cue_strip = build_cue_strip(score, quarter_note_ms, total_duration_ms, beats_per_measure);
    let note_count = voices.iter().map(|voice| voice.note_count).sum();
    let selected_note = voices
        .iter()
        .find(|voice| voice.track_id == "lead_voice")
        .and_then(|voice| voice.notes.first())
        .or_else(|| voices.iter().find_map(|voice| voice.notes.first()))
        .map(selected_note_from_block);

    let mut warnings = Vec::new();
    if note_count == 0 {
        warnings.push("notation layout contains no music notes".to_string());
    }
    if cue_strip.is_empty() {
        warnings.push("notation layout contains no conductor cues".to_string());
    }
    if beats_per_measure == 4 && beat_unit == 4 && score.music.meter != "4/4" {
        warnings.push(format!(
            "meter '{}' could not be parsed; using 4/4 fallback",
            score.music.meter
        ));
    }

    NotationLayoutReport {
        strategy: "rust_owned_staff_timeline_v1".to_string(),
        title: score.title.clone(),
        tempo_bpm: score.music.tempo_bpm,
        meter: score.music.meter.clone(),
        tuning_mode: score.music.tuning_mode.clone(),
        beats_per_measure,
        beat_unit,
        quarter_note_ms,
        total_duration_ms,
        total_duration_seconds,
        total_beats,
        measure_count,
        voice_count: voices.len(),
        note_count,
        conductor_cue_count: cue_strip.len(),
        voices,
        cue_strip,
        selected_note,
        warnings,
    }
}

fn build_voice_lanes(
    score: &FieldScore,
    quarter_note_ms: f64,
    total_duration_ms: u32,
    beats_per_measure: u32,
) -> Vec<NotationVoiceLane> {
    score
        .music
        .tracks
        .iter()
        .enumerate()
        .map(|(track_index, track)| {
            let mut sorted_notes = track.notes.clone();
            sorted_notes.sort_by_key(|note| (note.start_ms, note.midi_note));

            let notes = sorted_notes
                .iter()
                .enumerate()
                .map(|(note_index, note)| {
                    build_note_block(
                        note_index,
                        track,
                        note,
                        quarter_note_ms,
                        total_duration_ms,
                        beats_per_measure,
                    )
                })
                .collect::<Vec<_>>();

            NotationVoiceLane {
                track_id: track.track_id.clone(),
                role: track.role.clone(),
                display_name: display_name_for_track(&track.track_id, &track.role).to_string(),
                staff_y_percent: staff_y_for_track(track_index),
                note_count: notes.len(),
                notes,
            }
        })
        .collect()
}

fn build_note_block(
    note_index: usize,
    track: &MusicTrack,
    note: &NoteEvent,
    quarter_note_ms: f64,
    total_duration_ms: u32,
    beats_per_measure: u32,
) -> NotationNoteBlock {
    let end_ms = note.start_ms.saturating_add(note.duration_ms);
    let start_beat = note.start_ms as f64 / quarter_note_ms;
    let duration_beats = note.duration_ms as f64 / quarter_note_ms;
    let measure_index = (start_beat / beats_per_measure as f64).floor() as u32 + 1;
    let beat_in_measure = (start_beat % beats_per_measure as f64) + 1.0;
    let x_percent = percent(note.start_ms, total_duration_ms);
    let width_percent = percent(note.duration_ms.max(1), total_duration_ms).clamp(1.2, 24.0);
    let y_percent = note_y_percent(note.midi_note, &track.track_id);
    let note_name = midi_note_to_name(note.midi_note);

    NotationNoteBlock {
        event_index: note_index + 1,
        track_id: track.track_id.clone(),
        role: track.role.clone(),
        midi_note: note.midi_note,
        note_name,
        frequency_hz: midi_note_to_frequency_hz(note.midi_note),
        start_ms: note.start_ms,
        duration_ms: note.duration_ms,
        end_ms,
        start_beat: round3(start_beat),
        duration_beats: round3(duration_beats),
        measure_index,
        beat_in_measure: round3(beat_in_measure),
        x_percent,
        width_percent,
        y_percent,
        velocity: note.velocity,
        resonance_lane: note_resonance_lane(note.midi_note).to_string(),
    }
}

fn build_cue_strip(
    score: &FieldScore,
    quarter_note_ms: f64,
    total_duration_ms: u32,
    beats_per_measure: u32,
) -> Vec<NotationCueBlock> {
    score
        .conductor
        .primary_hand_track
        .events
        .iter()
        .enumerate()
        .map(|(event_index, event)| {
            build_cue_block(
                event_index,
                event,
                quarter_note_ms,
                total_duration_ms,
                beats_per_measure,
            )
        })
        .collect()
}

fn build_cue_block(
    event_index: usize,
    event: &GestureEvent,
    quarter_note_ms: f64,
    total_duration_ms: u32,
    beats_per_measure: u32,
) -> NotationCueBlock {
    let definition = gesture_definition(&event.gesture_id);
    let gesture_name = definition
        .as_ref()
        .map(|definition| definition.name.to_string())
        .unwrap_or_else(|| "Unknown Gesture".to_string());
    let field_region = definition
        .as_ref()
        .map(|definition| definition.field_region.to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let anchor = definition
        .as_ref()
        .map(|definition| definition.anchor.to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let end_ms = event.start_ms.saturating_add(event.duration_ms);
    let start_beat = event.start_ms as f64 / quarter_note_ms;
    let duration_beats = event.duration_ms as f64 / quarter_note_ms;
    let measure_index = (start_beat / beats_per_measure as f64).floor() as u32 + 1;
    let beat_in_measure = (start_beat % beats_per_measure as f64) + 1.0;
    let operator = event.operator.clone();

    NotationCueBlock {
        event_index: event_index + 1,
        gesture_id: event.gesture_id.clone(),
        gesture_name: gesture_name.clone(),
        operator: operator.clone(),
        field_region: field_region.clone(),
        anchor,
        start_ms: event.start_ms,
        duration_ms: event.duration_ms,
        end_ms,
        start_beat: round3(start_beat),
        duration_beats: round3(duration_beats),
        measure_index,
        beat_in_measure: round3(beat_in_measure),
        x_percent: percent(event.start_ms, total_duration_ms),
        width_percent: percent(event.duration_ms.max(1), total_duration_ms).clamp(1.2, 24.0),
        cue_text: cue_text(
            &event.gesture_id,
            &gesture_name,
            operator.as_deref(),
            &field_region,
        ),
    }
}

fn selected_note_from_block(note: &NotationNoteBlock) -> SelectedNotationNote {
    SelectedNotationNote {
        event_index: note.event_index,
        track_id: note.track_id.clone(),
        role: note.role.clone(),
        midi_note: note.midi_note,
        note_name: note.note_name.clone(),
        frequency_hz: note.frequency_hz,
        start_ms: note.start_ms,
        duration_ms: note.duration_ms,
        start_beat: note.start_beat,
        duration_beats: note.duration_beats,
        measure_index: note.measure_index,
        beat_in_measure: note.beat_in_measure,
        velocity: note.velocity,
        resonance_lane: note.resonance_lane.clone(),
    }
}

pub fn select_notation_note(
    score: &FieldScore,
    track_id: &str,
    event_index: usize,
) -> Result<SelectedNotationNote, String> {
    let layout = create_notation_layout_report(score);
    find_selected_note_in_layout(&layout, track_id, event_index).ok_or_else(|| {
        format!("notation note not found: track={track_id}, event_index={event_index}")
    })
}

pub fn edit_notation_note(
    score: &mut FieldScore,
    track_id: &str,
    event_index: usize,
    midi_note: u8,
    duration_ms: u32,
    velocity: f32,
    target_track_id: Option<&str>,
) -> Result<NotationEditReport, String> {
    let destination_track_id = target_track_id
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(track_id);

    let source_track_position = score
        .music
        .tracks
        .iter()
        .position(|track| track.track_id == track_id)
        .ok_or_else(|| format!("source music track not found: {track_id}"))?;

    let source_note_position =
        sorted_note_source_index(&score.music.tracks[source_track_position], event_index)?;

    let mut edited_note = score.music.tracks[source_track_position]
        .notes
        .remove(source_note_position);

    edited_note.midi_note = midi_note.min(127);
    edited_note.duration_ms = duration_ms.clamp(80, 60_000);
    edited_note.velocity = velocity.clamp(0.0, 1.0);

    let destination_track_position = score
        .music
        .tracks
        .iter()
        .position(|track| track.track_id == destination_track_id)
        .ok_or_else(|| format!("destination music track not found: {destination_track_id}"))?;

    score.music.tracks[destination_track_position]
        .notes
        .push(edited_note.clone());

    let layout = create_notation_layout_report(score);
    let selected_note = find_selected_note_by_identity(
        &layout,
        destination_track_id,
        edited_note.start_ms,
        edited_note.midi_note,
        edited_note.duration_ms,
    )
    .or_else(|| layout.selected_note.clone());

    Ok(NotationEditReport {
        status: "ok".to_string(),
        action: "edit_note".to_string(),
        selected_note,
        layout,
    })
}

pub fn position_notation_note_start_ms(
    score: &mut FieldScore,
    track_id: &str,
    event_index: usize,
    start_ms: u32,
) -> Result<NotationEditReport, String> {
    let track_position = score
        .music
        .tracks
        .iter()
        .position(|track| track.track_id == track_id)
        .ok_or_else(|| format!("music track not found: {track_id}"))?;

    let note_position = sorted_note_source_index(&score.music.tracks[track_position], event_index)?;
    let (midi_note, duration_ms) = {
        let note = &mut score.music.tracks[track_position].notes[note_position];
        note.start_ms = start_ms;
        (note.midi_note, note.duration_ms)
    };

    let layout = create_notation_layout_report(score);
    let selected_note =
        find_selected_note_by_identity(&layout, track_id, start_ms, midi_note, duration_ms)
            .or_else(|| layout.selected_note.clone());

    Ok(NotationEditReport {
        status: "ok".to_string(),
        action: "position_note_start_ms".to_string(),
        selected_note,
        layout,
    })
}

pub fn position_notation_note_measure_beat(
    score: &mut FieldScore,
    track_id: &str,
    event_index: usize,
    measure_index: u32,
    beat_in_measure: f64,
) -> Result<NotationEditReport, String> {
    let (beats_per_measure, _) = parse_meter(&score.music.meter);
    let quarter_ms = quarter_note_ms(score.music.tempo_bpm);
    let measure_index = measure_index.max(1);
    let beat_in_measure = beat_in_measure.clamp(1.0, beats_per_measure as f64);
    let absolute_beat =
        (measure_index - 1) as f64 * beats_per_measure as f64 + (beat_in_measure - 1.0);
    let start_ms = (absolute_beat * quarter_ms).round().max(0.0) as u32;

    position_notation_note_start_ms(score, track_id, event_index, start_ms).map(|mut report| {
        report.action = "position_note_measure_beat".to_string();
        report
    })
}

pub fn nudge_notation_note_by_beats(
    score: &mut FieldScore,
    track_id: &str,
    event_index: usize,
    beat_delta: i32,
) -> Result<NotationEditReport, String> {
    let track_position = score
        .music
        .tracks
        .iter()
        .position(|track| track.track_id == track_id)
        .ok_or_else(|| format!("music track not found: {track_id}"))?;

    let note_position = sorted_note_source_index(&score.music.tracks[track_position], event_index)?;
    let current_start = score.music.tracks[track_position].notes[note_position].start_ms;
    let quarter_ms = quarter_note_ms(score.music.tempo_bpm).round().max(1.0) as i64;
    let delta_ms = beat_delta as i64 * quarter_ms;
    let start_ms = (current_start as i64 + delta_ms).max(0) as u32;

    position_notation_note_start_ms(score, track_id, event_index, start_ms).map(|mut report| {
        report.action = "nudge_note_by_beats".to_string();
        report
    })
}

pub fn delete_notation_note(
    score: &mut FieldScore,
    track_id: &str,
    event_index: usize,
) -> Result<NotationEditReport, String> {
    let track_position = score
        .music
        .tracks
        .iter()
        .position(|track| track.track_id == track_id)
        .ok_or_else(|| format!("music track not found: {track_id}"))?;

    let note_position = sorted_note_source_index(&score.music.tracks[track_position], event_index)?;
    score.music.tracks[track_position]
        .notes
        .remove(note_position);

    let layout = create_notation_layout_report(score);

    Ok(NotationEditReport {
        status: "ok".to_string(),
        action: "delete_note".to_string(),
        selected_note: layout.selected_note.clone(),
        layout,
    })
}

fn sorted_note_source_index(track: &MusicTrack, event_index: usize) -> Result<usize, String> {
    if event_index == 0 {
        return Err("notation event index is 1-based and must be greater than zero".to_string());
    }

    let mut indexed_notes = track
        .notes
        .iter()
        .enumerate()
        .collect::<Vec<(usize, &NoteEvent)>>();

    indexed_notes.sort_by_key(|(_, note)| (note.start_ms, note.midi_note));

    indexed_notes
        .get(event_index - 1)
        .map(|(source_index, _)| *source_index)
        .ok_or_else(|| {
            format!(
                "notation note index {event_index} is out of range for track {}",
                track.track_id
            )
        })
}

fn find_selected_note_in_layout(
    layout: &NotationLayoutReport,
    track_id: &str,
    event_index: usize,
) -> Option<SelectedNotationNote> {
    layout
        .voices
        .iter()
        .find(|voice| voice.track_id == track_id)
        .and_then(|voice| {
            voice
                .notes
                .iter()
                .find(|note| note.event_index == event_index)
        })
        .map(selected_note_from_block)
}

fn find_selected_note_by_identity(
    layout: &NotationLayoutReport,
    track_id: &str,
    start_ms: u32,
    midi_note: u8,
    duration_ms: u32,
) -> Option<SelectedNotationNote> {
    layout
        .voices
        .iter()
        .find(|voice| voice.track_id == track_id)
        .and_then(|voice| {
            voice.notes.iter().find(|note| {
                note.start_ms == start_ms
                    && note.midi_note == midi_note
                    && note.duration_ms == duration_ms
            })
        })
        .map(selected_note_from_block)
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
        // HCS .hfield note timing is stored in whole milliseconds.
        // The seed generator also rounds quarter-note duration to whole ms.
        // Use the same quantized timing base here so measure placement does
        // not drift at boundaries such as 4/4 beat 4 -> measure 2.
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

fn percent(value_ms: u32, total_duration_ms: u32) -> f32 {
    if total_duration_ms == 0 {
        0.0
    } else {
        ((value_ms as f64 / total_duration_ms as f64) * 100.0) as f32
    }
}

fn note_y_percent(midi_note: u8, track_id: &str) -> f32 {
    let center = match track_id {
        "lead_voice" => 50.0,
        "depth_voice" => 58.0,
        "field_voice" => 50.0,
        _ => 50.0,
    };
    (center - (midi_note as f32 - 60.0) * 4.0).clamp(12.0, 86.0)
}

fn staff_y_for_track(index: usize) -> f32 {
    match index {
        0 => 24.0,
        1 => 54.0,
        2 => 78.0,
        _ => 88.0,
    }
}

fn display_name_for_track(track_id: &str, role: &str) -> &'static str {
    match track_id {
        "lead_voice" => "Lead",
        "depth_voice" => "Depth",
        "field_voice" => "Field",
        _ => match role {
            "melody" => "Melody",
            "bass_depth" => "Depth",
            "harmonic_field_support" => "Field",
            _ => "Voice",
        },
    }
}

fn note_resonance_lane(midi_note: u8) -> &'static str {
    if midi_note <= 60 {
        "lower_5_depth"
    } else if midi_note >= 67 {
        "upper_9_lift"
    } else {
        "center_1_home"
    }
}

fn cue_text(
    gesture_id: &str,
    gesture_name: &str,
    operator: Option<&str>,
    field_region: &str,
) -> String {
    let operator = operator.unwrap_or("gesture");
    format!("{gesture_id} {gesture_name}: {operator} through {field_region}")
}

fn round3(value: f64) -> f64 {
    (value * 1000.0).round() / 1000.0
}

#[cfg(test)]
mod tests {
    use super::*;
    use hfield_domain::{FieldScore, NoteEvent};

    #[test]
    fn parses_meter_values() {
        assert_eq!(parse_meter("4/4"), (4, 4));
        assert_eq!(parse_meter("6/8"), (6, 8));
        assert_eq!(parse_meter("bad"), (4, 4));
    }

    #[test]
    fn empty_default_score_reports_warnings() {
        let score = FieldScore::default_hcs();
        let report = create_notation_layout_report(&score);

        assert_eq!(report.strategy, "rust_owned_staff_timeline_v1");
        assert_eq!(report.voice_count, 3);
        assert_eq!(report.note_count, 0);
        assert!(!report.warnings.is_empty());
    }

    #[test]
    fn places_notes_into_measures_and_beats() {
        let mut score = FieldScore::default_hcs();
        score.music.tracks[0].notes = vec![
            NoteEvent {
                midi_note: 64,
                start_ms: 0,
                duration_ms: 714,
                velocity: 0.8,
            },
            NoteEvent {
                midi_note: 67,
                start_ms: 2856,
                duration_ms: 714,
                velocity: 0.8,
            },
        ];

        let report = create_notation_layout_report(&score);
        let lead = report
            .voices
            .iter()
            .find(|voice| voice.track_id == "lead_voice")
            .expect("lead voice");

        assert_eq!(lead.notes.len(), 2);
        assert_eq!(lead.notes[0].note_name, "E4");
        assert_eq!(lead.notes[0].measure_index, 1);
        assert_eq!(lead.notes[1].measure_index, 2);
        assert!(report.selected_note.is_some());
    }

    #[test]
    fn cue_strip_follows_conductor_events() {
        let score = FieldScore::default_hcs();
        let report = create_notation_layout_report(&score);

        assert_eq!(report.conductor_cue_count, 3);
        assert_eq!(report.cue_strip[0].gesture_id, "g2");
        assert!(report.cue_strip[0].width_percent > 0.0);
    }

    #[test]
    fn selects_edits_and_deletes_notation_notes() {
        let mut score = FieldScore::default_hcs();
        score.music.tracks[0].notes = vec![
            NoteEvent {
                midi_note: 64,
                start_ms: 0,
                duration_ms: 714,
                velocity: 0.8,
            },
            NoteEvent {
                midi_note: 67,
                start_ms: 714,
                duration_ms: 714,
                velocity: 0.7,
            },
        ];

        let selected = select_notation_note(&score, "lead_voice", 2).expect("select note");
        assert_eq!(selected.event_index, 2);
        assert_eq!(selected.note_name, "G4");

        let edited = edit_notation_note(
            &mut score,
            "lead_voice",
            2,
            69,
            1428,
            0.55,
            Some("lead_voice"),
        )
        .expect("edit note");

        let edited_note = edited.selected_note.expect("edited selected note");
        assert_eq!(edited_note.note_name, "A4");
        assert_eq!(edited_note.duration_ms, 1428);
        assert!((edited_note.velocity - 0.55).abs() < 0.001);

        let deleted = delete_notation_note(&mut score, "lead_voice", 2).expect("delete note");
        assert_eq!(deleted.layout.note_count, 1);
    }

    #[test]
    fn can_move_notation_note_to_another_track() {
        let mut score = FieldScore::default_hcs();
        score.music.tracks[0].notes = vec![NoteEvent {
            midi_note: 64,
            start_ms: 0,
            duration_ms: 714,
            velocity: 0.8,
        }];

        let edited = edit_notation_note(
            &mut score,
            "lead_voice",
            1,
            48,
            1428,
            0.5,
            Some("depth_voice"),
        )
        .expect("move note");

        let selected = edited.selected_note.expect("selected moved note");
        assert_eq!(selected.track_id, "depth_voice");
        assert_eq!(selected.note_name, "C3");
        assert!(score.music.tracks[0].notes.is_empty());
        assert_eq!(score.music.tracks[1].notes.len(), 1);
    }

    #[test]
    fn positions_notation_note_by_start_time_and_measure_beat() {
        let mut score = seed_position_test_score();

        let report = position_notation_note_start_ms(&mut score, "lead_voice", 1, 1428)
            .expect("position by start ms");

        let selected = report.selected_note.expect("selected note");
        assert_eq!(selected.start_ms, 1428);
        assert_eq!(selected.measure_index, 1);
        assert_eq!(selected.beat_in_measure, 3.0);

        let report = position_notation_note_measure_beat(&mut score, "lead_voice", 1, 2, 1.0)
            .expect("position by measure beat");

        let selected = report.selected_note.expect("selected note");
        assert_eq!(selected.start_ms, 2856);
        assert_eq!(selected.measure_index, 2);
        assert_eq!(selected.beat_in_measure, 1.0);
    }

    #[test]
    fn nudges_notation_note_by_beat_without_negative_time() {
        let mut score = seed_position_test_score();

        let report =
            nudge_notation_note_by_beats(&mut score, "lead_voice", 1, 1).expect("nudge right");
        let selected = report.selected_note.expect("selected after nudge right");
        assert_eq!(selected.start_ms, 714);

        let report = nudge_notation_note_by_beats(&mut score, "lead_voice", 1, -3)
            .expect("nudge left below zero clamps");
        let selected = report.selected_note.expect("selected after nudge left");
        assert_eq!(selected.start_ms, 0);
    }

    fn seed_position_test_score() -> FieldScore {
        let mut score = FieldScore::default_hcs();
        score.music.tracks[0].notes = vec![NoteEvent {
            midi_note: 64,
            start_ms: 0,
            duration_ms: 714,
            velocity: 0.8,
        }];
        score
    }
}
