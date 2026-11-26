use hfield_domain::{FieldScore, GestureEvent, NoteEvent};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ResonanceLevelBundle {
    pub piece_title: String,
    pub source_summary: SourceSummary,
    pub beginner_view: Vec<BeginnerBlock>,
    pub note_name_view: Vec<NoteNameEvent>,
    pub conductor_view: Vec<ConductorCue>,
    pub accessibility_guidance: Vec<String>,
    pub professional_boundary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SourceSummary {
    pub tempo_bpm: f64,
    pub meter: String,
    pub tuning_mode: String,
    pub music_track_count: usize,
    pub total_note_count: usize,
    pub conductor_event_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BeginnerBlock {
    pub block_index: usize,
    pub note_label: String,
    pub start_ms: u32,
    pub duration_ms: u32,
    pub start_beat: f64,
    pub duration_beats: f64,
    pub movement: String,
    pub resonance_lane: String,
    pub beginner_instruction: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NoteNameEvent {
    pub event_index: usize,
    pub midi_note: u8,
    pub note_name: String,
    pub start_ms: u32,
    pub duration_ms: u32,
    pub start_beat: f64,
    pub duration_beats: f64,
    pub velocity: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConductorCue {
    pub cue_index: usize,
    pub gesture_id: String,
    pub operator: Option<String>,
    pub field_region: String,
    pub start_ms: u32,
    pub duration_ms: u32,
    pub intensity: f32,
    pub cue_text: String,
}

pub fn create_resonance_level_bundle(score: &FieldScore) -> ResonanceLevelBundle {
    let lead_notes = primary_melody_notes(score);
    let conductor_events = score.conductor.primary_hand_track.events.clone();
    let quarter_ms = quarter_note_ms(score.music.tempo_bpm);

    ResonanceLevelBundle {
        piece_title: score.title.clone(),
        source_summary: SourceSummary {
            tempo_bpm: score.music.tempo_bpm,
            meter: score.music.meter.clone(),
            tuning_mode: score.music.tuning_mode.clone(),
            music_track_count: score.music.tracks.len(),
            total_note_count: score.music.tracks.iter().map(|track| track.notes.len()).sum(),
            conductor_event_count: conductor_events.len(),
        },
        beginner_view: build_beginner_view(&lead_notes, quarter_ms),
        note_name_view: build_note_name_view(&lead_notes, quarter_ms),
        conductor_view: build_conductor_view(&conductor_events),
        accessibility_guidance: vec![
            "Beginner view should show large blocks, note names, beat position, and simple movement direction.".to_string(),
            "Note-name view should preserve real pitch identity so beginners do not get trapped in fake notation.".to_string(),
            "Conductor view should show preparation, hold, release, and field movement without replacing the music score.".to_string(),
            "Future accessible views must not rely only on color; labels, spacing, contrast, and screen-readable text are required.".to_string(),
        ],
        professional_boundary: "These are render views of one source score; they must never replace or corrupt the canonical .hfield music/conductor source.".to_string(),
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

fn build_beginner_view(notes: &[NoteEvent], quarter_ms: f64) -> Vec<BeginnerBlock> {
    let mut previous: Option<u8> = None;

    notes
        .iter()
        .enumerate()
        .map(|(idx, note)| {
            let movement = match previous {
                None => "start".to_string(),
                Some(prev) if note.midi_note > prev => "up".to_string(),
                Some(prev) if note.midi_note < prev => "down".to_string(),
                Some(_) => "same".to_string(),
            };

            previous = Some(note.midi_note);

            let note_label = midi_note_to_name(note.midi_note);
            let resonance_lane = beginner_resonance_lane(note.midi_note, &movement).to_string();

            BeginnerBlock {
                block_index: idx + 1,
                note_label: note_label.clone(),
                start_ms: note.start_ms,
                duration_ms: note.duration_ms,
                start_beat: round3(note.start_ms as f64 / quarter_ms),
                duration_beats: round3(note.duration_ms as f64 / quarter_ms),
                movement: movement.clone(),
                resonance_lane: resonance_lane.clone(),
                beginner_instruction: beginner_instruction(&note_label, &movement, &resonance_lane),
            }
        })
        .collect()
}

fn build_note_name_view(notes: &[NoteEvent], quarter_ms: f64) -> Vec<NoteNameEvent> {
    notes
        .iter()
        .enumerate()
        .map(|(idx, note)| NoteNameEvent {
            event_index: idx + 1,
            midi_note: note.midi_note,
            note_name: midi_note_to_name(note.midi_note),
            start_ms: note.start_ms,
            duration_ms: note.duration_ms,
            start_beat: round3(note.start_ms as f64 / quarter_ms),
            duration_beats: round3(note.duration_ms as f64 / quarter_ms),
            velocity: note.velocity,
        })
        .collect()
}

fn build_conductor_view(events: &[GestureEvent]) -> Vec<ConductorCue> {
    events
        .iter()
        .enumerate()
        .map(|(idx, event)| {
            let region = gesture_region(&event.gesture_id).to_string();
            let operator = event.operator.clone();
            let cue_text = conductor_cue_text(&event.gesture_id, operator.as_deref(), &region);

            ConductorCue {
                cue_index: idx + 1,
                gesture_id: event.gesture_id.clone(),
                operator,
                field_region: region,
                start_ms: event.start_ms,
                duration_ms: event.duration_ms,
                intensity: event.intensity,
                cue_text,
            }
        })
        .collect()
}

pub fn midi_note_to_name(midi_note: u8) -> String {
    let names = [
        "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
    ];
    let pitch_class = (midi_note % 12) as usize;
    let octave = (midi_note as i16 / 12) - 1;
    format!("{}{}", names[pitch_class], octave)
}

fn quarter_note_ms(tempo_bpm: f64) -> f64 {
    if tempo_bpm <= 0.0 {
        714.0
    } else {
        60_000.0 / tempo_bpm
    }
}

fn beginner_resonance_lane(midi_note: u8, movement: &str) -> &'static str {
    if movement == "down" || midi_note <= 60 {
        "lower_5_depth"
    } else if movement == "up" || midi_note >= 67 {
        "upper_9_lift"
    } else {
        "center_1_home"
    }
}

fn beginner_instruction(note_label: &str, movement: &str, lane: &str) -> String {
    let lane_text = match lane {
        "lower_5_depth" => "feel the lower/deeper field",
        "upper_9_lift" => "lift toward the upper field",
        _ => "stay near the center/home field",
    };

    match movement {
        "up" => format!("Play {note_label}; move upward and {lane_text}."),
        "down" => format!("Play {note_label}; settle downward and {lane_text}."),
        "same" => format!("Repeat {note_label}; keep the pulse steady and {lane_text}."),
        _ => format!("Begin on {note_label}; establish the phrase and {lane_text}."),
    }
}

fn gesture_region(gesture_id: &str) -> &'static str {
    match gesture_id {
        "g7" | "g9" | "g8" => "upper_9_lift_expression",
        "g4" | "g5" | "g6" => "lower_5_depth_weight",
        _ => "center_1_home_root",
    }
}

fn conductor_cue_text(gesture_id: &str, operator: Option<&str>, region: &str) -> String {
    let op = operator.unwrap_or("gesture");

    match gesture_id {
        "g1" => format!("{op}: return to center/root presence."),
        "g2" => format!("{op}: prepare the entry from the receptive side of center."),
        "g3" => format!("{op}: emerge outward from center into motion."),
        "g4" => format!("{op}: descend into lower-field constraint."),
        "g5" => format!("{op}: hold the lower depth/transformation field."),
        "g6" => format!("{op}: release from lower depth toward recovery."),
        "g7" => format!("{op}: gather the phrase into upper expression."),
        "g9" => format!("{op}: hold formed expression in the upper field."),
        "g8" => format!("{op}: emit outward from upper expression."),
        _ => format!("{op}: conduct through {region}."),
    }
}

fn round3(value: f64) -> f64 {
    (value * 1000.0).round() / 1000.0
}

#[cfg(test)]
mod tests {
    use super::*;
    use hfield_domain::{FieldScore, NoteEvent};

    #[test]
    fn midi_names_are_correct() {
        assert_eq!(midi_note_to_name(60), "C4");
        assert_eq!(midi_note_to_name(64), "E4");
        assert_eq!(midi_note_to_name(67), "G4");
        assert_eq!(midi_note_to_name(69), "A4");
    }

    #[test]
    fn bundle_builds_beginner_and_note_views() {
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
        ];

        let bundle = create_resonance_level_bundle(&score);

        assert_eq!(bundle.beginner_view.len(), 2);
        assert_eq!(bundle.note_name_view[0].note_name, "E4");
        assert_eq!(bundle.beginner_view[1].movement, "up");
        assert!(!bundle.conductor_view.is_empty());
    }
}
