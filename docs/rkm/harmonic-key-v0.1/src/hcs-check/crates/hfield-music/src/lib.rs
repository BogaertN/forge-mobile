use hfield_domain::{FieldScore, MusicTrack, NoteEvent};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MusicTimelineReport {
    pub tempo_bpm: f64,
    pub meter: String,
    pub tuning_mode: String,
    pub track_count: usize,
    pub total_note_count: usize,
    pub total_duration_ms: u32,
    pub total_duration_seconds: f64,
    pub tracks: Vec<MusicTrackTimelineView>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MusicTrackTimelineView {
    pub track_id: String,
    pub role: String,
    pub note_count: usize,
    pub track_duration_ms: u32,
    pub track_duration_seconds: f64,
    pub notes: Vec<MusicNoteEventView>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MusicNoteEventView {
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
    pub velocity: f32,
    pub movement_from_previous: String,
    pub resonance_lane: String,
}

pub fn create_music_timeline_report(score: &FieldScore) -> MusicTimelineReport {
    let quarter_ms = quarter_note_ms(score.music.tempo_bpm);

    let tracks = score
        .music
        .tracks
        .iter()
        .map(|track| create_track_timeline(track, quarter_ms))
        .collect::<Vec<_>>();

    let total_note_count = tracks.iter().map(|track| track.note_count).sum();
    let total_duration_ms = tracks
        .iter()
        .map(|track| track.track_duration_ms)
        .max()
        .unwrap_or(0);

    MusicTimelineReport {
        tempo_bpm: score.music.tempo_bpm,
        meter: score.music.meter.clone(),
        tuning_mode: score.music.tuning_mode.clone(),
        track_count: tracks.len(),
        total_note_count,
        total_duration_ms,
        total_duration_seconds: round3(total_duration_ms as f64 / 1000.0),
        tracks,
    }
}

fn create_track_timeline(track: &MusicTrack, quarter_ms: f64) -> MusicTrackTimelineView {
    let mut sorted_notes = track.notes.clone();
    sorted_notes.sort_by_key(|note| (note.start_ms, note.midi_note));

    let mut previous: Option<u8> = None;

    let notes = sorted_notes
        .iter()
        .enumerate()
        .map(|(index, note)| {
            let movement = note_movement(previous, note.midi_note);
            previous = Some(note.midi_note);

            MusicNoteEventView {
                event_index: index + 1,
                track_id: track.track_id.clone(),
                role: track.role.clone(),
                midi_note: note.midi_note,
                note_name: midi_note_to_name(note.midi_note),
                frequency_hz: midi_note_to_frequency_hz(note.midi_note),
                start_ms: note.start_ms,
                duration_ms: note.duration_ms,
                end_ms: note.start_ms.saturating_add(note.duration_ms),
                start_beat: round3(note.start_ms as f64 / quarter_ms),
                duration_beats: round3(note.duration_ms as f64 / quarter_ms),
                velocity: note.velocity,
                movement_from_previous: movement.clone(),
                resonance_lane: note_resonance_lane(note.midi_note, &movement).to_string(),
            }
        })
        .collect::<Vec<_>>();

    let track_duration_ms = notes.iter().map(|note| note.end_ms).max().unwrap_or(0);

    MusicTrackTimelineView {
        track_id: track.track_id.clone(),
        role: track.role.clone(),
        note_count: notes.len(),
        track_duration_ms,
        track_duration_seconds: round3(track_duration_ms as f64 / 1000.0),
        notes,
    }
}

pub fn midi_note_to_name(midi_note: u8) -> String {
    let names = [
        "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
    ];

    let pitch_class = (midi_note % 12) as usize;
    let octave = (midi_note as i16 / 12) - 1;

    format!("{}{}", names[pitch_class], octave)
}

pub fn midi_note_to_frequency_hz(midi_note: u8) -> f32 {
    440.0 * 2.0_f32.powf((midi_note as f32 - 69.0) / 12.0)
}

fn note_movement(previous: Option<u8>, current: u8) -> String {
    match previous {
        None => "start".to_string(),
        Some(prev) if current > prev => "up".to_string(),
        Some(prev) if current < prev => "down".to_string(),
        Some(_) => "same".to_string(),
    }
}

fn note_resonance_lane(midi_note: u8, movement: &str) -> &'static str {
    if movement == "down" || midi_note <= 60 {
        "lower_5_depth"
    } else if movement == "up" || midi_note >= 67 {
        "upper_9_lift"
    } else {
        "center_1_home"
    }
}

fn quarter_note_ms(tempo_bpm: f64) -> f64 {
    if tempo_bpm <= 0.0 {
        714.0
    } else {
        60_000.0 / tempo_bpm
    }
}

fn round3(value: f64) -> f64 {
    (value * 1000.0).round() / 1000.0
}

pub fn append_note_to_track(
    score: &mut FieldScore,
    track_id: &str,
    midi_note: u8,
    duration_ms: u32,
    velocity: f32,
) -> Result<MusicTimelineReport, String> {
    let duration_ms = duration_ms.clamp(80, 60_000);
    let velocity = velocity.clamp(0.0, 1.0);

    let track = score
        .music
        .tracks
        .iter_mut()
        .find(|track| track.track_id == track_id)
        .ok_or_else(|| format!("music track not found: {track_id}"))?;

    let start_ms = track
        .notes
        .iter()
        .map(|note| note.start_ms.saturating_add(note.duration_ms))
        .max()
        .unwrap_or(0);

    track.notes.push(NoteEvent {
        midi_note,
        start_ms,
        duration_ms,
        velocity,
    });

    Ok(create_music_timeline_report(score))
}

pub fn clear_track_notes(
    score: &mut FieldScore,
    track_id: &str,
) -> Result<MusicTimelineReport, String> {
    let track = score
        .music
        .tracks
        .iter_mut()
        .find(|track| track.track_id == track_id)
        .ok_or_else(|| format!("music track not found: {track_id}"))?;

    track.notes.clear();

    Ok(create_music_timeline_report(score))
}

#[cfg(test)]
mod tests {
    use super::*;
    use hfield_domain::{FieldScore, NoteEvent};

    #[test]
    fn midi_note_names_and_frequencies_are_correct() {
        assert_eq!(midi_note_to_name(60), "C4");
        assert_eq!(midi_note_to_name(64), "E4");
        assert_eq!(midi_note_to_name(67), "G4");

        let a4 = midi_note_to_frequency_hz(69);
        assert!((a4 - 440.0).abs() < 0.001);
    }

    #[test]
    fn creates_music_timeline_report() {
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

        let report = create_music_timeline_report(&score);

        assert_eq!(report.track_count, 3);
        assert_eq!(report.total_note_count, 2);
        assert_eq!(report.tracks[0].notes[0].note_name, "E4");
        assert_eq!(report.tracks[0].notes[1].movement_from_previous, "up");
    }

    #[test]
    fn appends_note_to_named_track() {
        let mut score = FieldScore::default_hcs();

        let report =
            append_note_to_track(&mut score, "lead_voice", 69, 500, 0.75).expect("append note");

        assert_eq!(report.total_note_count, 1);
        assert_eq!(report.tracks[0].notes[0].note_name, "A4");
        assert_eq!(score.music.tracks[0].notes.len(), 1);
    }

    #[test]
    fn clears_named_track() {
        let mut score = FieldScore::default_hcs();

        append_note_to_track(&mut score, "lead_voice", 69, 500, 0.75).expect("append note");

        let report = clear_track_notes(&mut score, "lead_voice").expect("clear track");

        assert_eq!(report.total_note_count, 0);
        assert!(score.music.tracks[0].notes.is_empty());
    }
}
