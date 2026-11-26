use hfield_conductor::is_valid_gesture_id;
use hfield_domain::{FieldScore, GestureEvent, GestureTrack, NoteEvent};
use hfield_music::midi_note_to_name;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConductorMappingReport {
    pub strategy: String,
    pub piece_title: String,
    pub source_track_id: String,
    pub source_note_count: usize,
    pub generated_event_count: usize,
    pub music_duration_ms: u32,
    pub conductor_duration_ms: u32,
    pub alignment_delta_ms: i64,
    pub alignment_status: String,
    pub generated_events: Vec<MappedGestureEvent>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MappedGestureEvent {
    pub event_index: usize,
    pub source_note_name: String,
    pub source_midi_note: u8,
    pub source_start_ms: u32,
    pub source_duration_ms: u32,
    pub source_movement: String,
    pub gesture_id: String,
    pub operator: String,
    pub field_region: String,
    pub start_ms: u32,
    pub duration_ms: u32,
    pub end_ms: u32,
    pub intensity: f32,
    pub rationale: String,
}

pub fn create_conductor_mapping_report(score: &FieldScore) -> ConductorMappingReport {
    let notes = primary_melody_notes(score);
    let generated_track = generate_conductor_track_from_music(score);
    let generated_events = build_mapped_event_views(&notes, &generated_track.events);
    let music_duration_ms = music_duration_ms(score);
    let conductor_duration_ms = generated_track
        .events
        .iter()
        .map(|event| event.start_ms.saturating_add(event.duration_ms))
        .max()
        .unwrap_or(0);
    let alignment_delta_ms = conductor_duration_ms as i64 - music_duration_ms as i64;

    let mut warnings = Vec::new();
    if notes.is_empty() {
        warnings
            .push("No melody notes were found; generated conductor mapping is empty.".to_string());
    }

    if alignment_delta_ms != 0 {
        warnings.push(format!(
            "Conductor duration differs from music duration by {alignment_delta_ms} ms."
        ));
    }

    ConductorMappingReport {
        strategy: "note_motion_to_full_length_conductor_path_v1".to_string(),
        piece_title: score.title.clone(),
        source_track_id: primary_track_id(score),
        source_note_count: notes.len(),
        generated_event_count: generated_track.events.len(),
        music_duration_ms,
        conductor_duration_ms,
        alignment_delta_ms,
        alignment_status: if alignment_delta_ms == 0 {
            "aligned".to_string()
        } else {
            "duration_mismatch".to_string()
        },
        generated_events,
        warnings,
    }
}

pub fn apply_generated_mapping(score: &mut FieldScore) -> ConductorMappingReport {
    let generated_track = generate_conductor_track_from_music(score);
    score.conductor.primary_hand_track = generated_track;
    create_conductor_mapping_report(score)
}

pub fn generate_conductor_track_from_music(score: &FieldScore) -> GestureTrack {
    let notes = primary_melody_notes(score);

    let events = notes
        .iter()
        .enumerate()
        .map(|(index, note)| {
            let previous = if index == 0 {
                None
            } else {
                notes
                    .get(index - 1)
                    .map(|previous_note| previous_note.midi_note)
            };

            let movement = note_movement(previous, note.midi_note);
            let is_last = index + 1 == notes.len();
            let mapping = map_note_motion_to_gesture(note, &movement, index, is_last);

            GestureEvent {
                gesture_id: mapping.gesture_id,
                start_ms: note.start_ms,
                duration_ms: note.duration_ms,
                intensity: mapping.intensity,
                operator: Some(mapping.operator),
            }
        })
        .collect::<Vec<_>>();

    GestureTrack {
        track_id: "primary_hand".to_string(),
        events,
    }
}

#[derive(Debug, Clone)]
struct GestureMapping {
    gesture_id: String,
    operator: String,
    intensity: f32,
}

fn map_note_motion_to_gesture(
    note: &NoteEvent,
    movement: &str,
    index: usize,
    is_last: bool,
) -> GestureMapping {
    let mut gesture_id = if index == 0 {
        "g2"
    } else if is_last {
        "g8"
    } else {
        match movement {
            "up" => {
                if note.midi_note >= 67 {
                    "g9"
                } else {
                    "g7"
                }
            }
            "down" => {
                if note.midi_note <= 60 {
                    "g5"
                } else {
                    "g4"
                }
            }
            "same" => {
                if note.midi_note >= 67 {
                    "g9"
                } else if note.midi_note <= 60 {
                    "g5"
                } else {
                    "g1"
                }
            }
            _ => "g1",
        }
    }
    .to_string();

    if !is_valid_gesture_id(&gesture_id) {
        gesture_id = "g1".to_string();
    }

    let operator = match gesture_id.as_str() {
        "g2" => "prepare",
        "g1" => "settle",
        "g3" => "emerge",
        "g4" => "descend",
        "g5" => "depth_hold",
        "g6" => "release_depth",
        "g7" => "gather_lift",
        "g9" => "upper_hold",
        "g8" => "emit_release",
        _ => "gesture",
    }
    .to_string();

    let region_boost = match gesture_id.as_str() {
        "g4" | "g5" | "g6" => 0.12,
        "g7" | "g9" | "g8" => 0.10,
        _ => 0.06,
    };

    let intensity = (0.36 + note.velocity * 0.32 + region_boost).clamp(0.20, 0.88);

    GestureMapping {
        gesture_id,
        operator,
        intensity,
    }
}

fn build_mapped_event_views(
    notes: &[NoteEvent],
    events: &[GestureEvent],
) -> Vec<MappedGestureEvent> {
    notes
        .iter()
        .zip(events.iter())
        .enumerate()
        .map(|(index, (note, event))| {
            let previous = if index == 0 {
                None
            } else {
                notes
                    .get(index - 1)
                    .map(|previous_note| previous_note.midi_note)
            };

            let movement = note_movement(previous, note.midi_note);
            let operator = event
                .operator
                .clone()
                .unwrap_or_else(|| "gesture".to_string());
            let field_region = gesture_region(&event.gesture_id).to_string();
            let note_name = midi_note_to_name(note.midi_note);
            let end_ms = event.start_ms.saturating_add(event.duration_ms);

            MappedGestureEvent {
                event_index: index + 1,
                source_note_name: note_name.clone(),
                source_midi_note: note.midi_note,
                source_start_ms: note.start_ms,
                source_duration_ms: note.duration_ms,
                source_movement: movement.clone(),
                gesture_id: event.gesture_id.clone(),
                operator: operator.clone(),
                field_region: field_region.clone(),
                start_ms: event.start_ms,
                duration_ms: event.duration_ms,
                end_ms,
                intensity: event.intensity,
                rationale: mapping_rationale(
                    &note_name,
                    &movement,
                    &event.gesture_id,
                    &operator,
                    &field_region,
                ),
            }
        })
        .collect()
}

fn mapping_rationale(
    note_name: &str,
    movement: &str,
    gesture_id: &str,
    operator: &str,
    field_region: &str,
) -> String {
    match movement {
        "up" => {
            format!("{note_name} moves upward; map to {gesture_id}/{operator} in {field_region}.")
        }
        "down" => {
            format!("{note_name} moves downward; map to {gesture_id}/{operator} in {field_region}.")
        }
        "same" => format!(
            "{note_name} repeats or sustains; map to {gesture_id}/{operator} in {field_region}."
        ),
        _ => format!(
            "{note_name} begins the phrase; map to {gesture_id}/{operator} in {field_region}."
        ),
    }
}

fn primary_melody_notes(score: &FieldScore) -> Vec<NoteEvent> {
    let mut notes = score
        .music
        .tracks
        .iter()
        .find(|track| track.role == "melody")
        .or_else(|| score.music.tracks.first())
        .map(|track| track.notes.clone())
        .unwrap_or_default();

    notes.sort_by_key(|note| (note.start_ms, note.midi_note));
    notes
}

fn primary_track_id(score: &FieldScore) -> String {
    score
        .music
        .tracks
        .iter()
        .find(|track| track.role == "melody")
        .or_else(|| score.music.tracks.first())
        .map(|track| track.track_id.clone())
        .unwrap_or_else(|| "none".to_string())
}

fn music_duration_ms(score: &FieldScore) -> u32 {
    score
        .music
        .tracks
        .iter()
        .flat_map(|track| track.notes.iter())
        .map(|note| note.start_ms.saturating_add(note.duration_ms))
        .max()
        .unwrap_or(0)
}

fn note_movement(previous: Option<u8>, current: u8) -> String {
    match previous {
        None => "start".to_string(),
        Some(prev) if current > prev => "up".to_string(),
        Some(prev) if current < prev => "down".to_string(),
        Some(_) => "same".to_string(),
    }
}

fn gesture_region(gesture_id: &str) -> &'static str {
    match gesture_id {
        "g7" | "g9" | "g8" => "upper_9_lift_expression",
        "g4" | "g5" | "g6" => "lower_5_depth_weight",
        _ => "center_1_home_root",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use hfield_domain::{FieldScore, NoteEvent};

    #[test]
    fn empty_score_generates_empty_mapping_report() {
        let score = FieldScore::default_hcs();
        let report = create_conductor_mapping_report(&score);

        assert_eq!(report.source_note_count, 0);
        assert_eq!(report.generated_event_count, 0);
        assert_eq!(report.alignment_status, "aligned");
        assert!(!report.warnings.is_empty());
    }

    #[test]
    fn generated_mapping_aligns_to_music_duration() {
        let mut score = FieldScore::default_hcs();

        score.music.tracks[0].notes = vec![
            NoteEvent {
                midi_note: 64,
                start_ms: 0,
                duration_ms: 500,
                velocity: 0.8,
            },
            NoteEvent {
                midi_note: 67,
                start_ms: 500,
                duration_ms: 500,
                velocity: 0.85,
            },
            NoteEvent {
                midi_note: 60,
                start_ms: 1000,
                duration_ms: 1000,
                velocity: 0.75,
            },
        ];

        let report = apply_generated_mapping(&mut score);

        assert_eq!(report.source_note_count, 3);
        assert_eq!(report.generated_event_count, 3);
        assert_eq!(report.music_duration_ms, 2000);
        assert_eq!(report.conductor_duration_ms, 2000);
        assert_eq!(report.alignment_status, "aligned");
        assert_eq!(score.conductor.primary_hand_track.events.len(), 3);
    }

    #[test]
    fn mapping_uses_lift_and_depth_regions() {
        let mut score = FieldScore::default_hcs();

        score.music.tracks[0].notes = vec![
            NoteEvent {
                midi_note: 64,
                start_ms: 0,
                duration_ms: 500,
                velocity: 0.8,
            },
            NoteEvent {
                midi_note: 67,
                start_ms: 500,
                duration_ms: 500,
                velocity: 0.8,
            },
            NoteEvent {
                midi_note: 60,
                start_ms: 1000,
                duration_ms: 500,
                velocity: 0.8,
            },
        ];

        let report = create_conductor_mapping_report(&score);
        let regions = report
            .generated_events
            .iter()
            .map(|event| event.field_region.as_str())
            .collect::<Vec<_>>();

        assert!(regions.contains(&"upper_9_lift_expression"));
        assert!(
            regions.contains(&"center_1_home_root") || regions.contains(&"lower_5_depth_weight")
        );
    }
}
