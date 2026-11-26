use hfield_domain::{FieldScore, HFIELD_PHASE_ORDER};
use hfield_music::{midi_note_to_frequency_hz, midi_note_to_name};
use serde::{Deserialize, Serialize};

const CARRIER_CONTRACT_ID: &str = "aiweb.hfield.runtime_carrier_packet_model.v1";
const IDENTITY_CARRIER_MIN_HZ: f64 = 96.0;
const IDENTITY_CARRIER_RANGE_HZ: f64 = 1904.0;
const TIME_SLICE_COUNT: usize = 33;
const MAX_RIPPLES: usize = 128;
const ACTIVE_PAD_MS: u32 = 120;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HfieldRuntimeCarrierPacketReport {
    pub strategy: String,
    pub status: String,
    pub carrier_contract_id: String,
    pub title: String,
    pub source_format: String,
    pub source_version: String,
    pub packet_kind: String,
    pub packet_role: String,
    pub global_file_carrier_frequency_hz: f64,
    pub phase_root_frequency_hz: f64,
    pub identity_carrier: FileIdentityCarrier,
    pub operating_field: RuntimeOperatingField,
    pub runtime_paths: Vec<RuntimePathCarrier>,
    pub packet_events: Vec<PacketEventCarrier>,
    pub information_ripples: Vec<InformationRipple>,
    pub time_slices: Vec<CarrierTimeSlice>,
    pub readable_packet_model: String,
    pub deterministic_carrier_hash: String,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FileIdentityCarrier {
    pub artifact_id: String,
    pub title_signature: String,
    pub frequency_hz: f64,
    pub carrier_role: String,
    pub payload_layer: String,
    pub phase: u8,
    pub color_hex: String,
    pub is_global_identity_tone: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeOperatingField {
    pub tuning_mode: String,
    pub meter: String,
    pub tempo_bpm: f64,
    pub key_signature_proxy: String,
    pub phase_order: Vec<u8>,
    pub phase_grid_rows: Vec<Vec<u8>>,
    pub carrier_stack_description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimePathCarrier {
    pub path_index: usize,
    pub path_id: String,
    pub display_label: String,
    pub channel_kind: String,
    pub source_track_id: String,
    pub source_role: String,
    pub instrument_proxy: String,
    pub carrier_frequency_hz: f64,
    pub anchor_phase: u8,
    pub color_hex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PacketEventCarrier {
    pub event_index: usize,
    pub event_kind: String,
    pub payload_layer: String,
    pub runtime_path_id: String,
    pub source_track_id: String,
    pub source_role: String,
    pub note_name: Option<String>,
    pub gesture_id: Option<String>,
    pub semantic_binding: String,
    pub carrier_frequency_hz: f64,
    pub payload_frequency_hz: f64,
    pub phase: u8,
    pub anchor_phase: u8,
    pub amplitude: f32,
    pub start_ms: u32,
    pub duration_ms: u32,
    pub end_ms: u32,
    pub time_norm_start: f32,
    pub time_norm_end: f32,
    pub color_hex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InformationRipple {
    pub ripple_index: usize,
    pub source_event_index: usize,
    pub ripple_kind: String,
    pub payload_layer: String,
    pub runtime_path_id: String,
    pub semantic_binding: String,
    pub carrier_frequency_hz: f64,
    pub payload_frequency_hz: f64,
    pub phase: u8,
    pub anchor_phase: u8,
    pub start_ms: u32,
    pub duration_ms: u32,
    pub time_norm: f32,
    pub surface_x_norm: f32,
    pub surface_radius_norm: f32,
    pub amplitude: f32,
    pub color_hex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CarrierTimeSlice {
    pub slice_index: usize,
    pub time_ms: u32,
    pub time_norm: f32,
    pub scanline_z_norm: f32,
    pub active_ripple_count: usize,
    pub active_carrier_frequencies_hz: Vec<f64>,
    pub active_payload_frequencies_hz: Vec<f64>,
    pub composite_amplitude: f32,
    pub dominant_payload_layer: String,
    pub dominant_phase: u8,
    pub dominant_color_hex: String,
}

pub fn synthesize_hfield_runtime_carrier_packet_model(
    score: &FieldScore,
) -> HfieldRuntimeCarrierPacketReport {
    let duration_ms = total_duration_ms(score).max(1);
    let identity_carrier = create_identity_carrier(score);
    let runtime_paths = create_runtime_path_carriers(score);
    let packet_events = create_packet_events(score, duration_ms, &identity_carrier, &runtime_paths);
    let information_ripples = create_information_ripples(&packet_events);
    let time_slices = create_time_slices(duration_ms, &information_ripples);
    let operating_field = RuntimeOperatingField {
        tuning_mode: score.music.tuning_mode.clone(),
        meter: score.music.meter.clone(),
        tempo_bpm: round3(score.music.tempo_bpm),
        key_signature_proxy: derive_key_signature_proxy(score),
        phase_order: HFIELD_PHASE_ORDER.to_vec(),
        phase_grid_rows: vec![vec![2, 1, 3], vec![4, 5, 6], vec![7, 9, 8]],
        carrier_stack_description:
            "file identity carrier + runtime path carrier + note/gesture payload carrier"
                .to_string(),
    };

    let mut report = HfieldRuntimeCarrierPacketReport {
        strategy: "rust_owned_runtime_carrier_packet_model_v1".to_string(),
        status: "ok".to_string(),
        carrier_contract_id: CARRIER_CONTRACT_ID.to_string(),
        title: score.title.clone(),
        source_format: score.format.clone(),
        source_version: score.version.clone(),
        packet_kind: score.packet.packet_kind.clone(),
        packet_role: score.packet.packet_role.clone(),
        global_file_carrier_frequency_hz: identity_carrier.frequency_hz,
        phase_root_frequency_hz: round3(score.root_frequency_hz),
        identity_carrier,
        operating_field,
        runtime_paths,
        packet_events,
        information_ripples,
        time_slices,
        readable_packet_model:
            "multi_frequency_cymatic_reading_dragged_through_time; each ripple is packet information transfer"
                .to_string(),
        deterministic_carrier_hash: String::new(),
        warnings: Vec::new(),
    };

    if report
        .packet_events
        .iter()
        .filter(|event| event.event_kind == "note")
        .count()
        == 0
    {
        report.warnings.push(
            "no note payload events are present; carrier model is identity/gesture only"
                .to_string(),
        );
    }
    if report.runtime_paths.is_empty() {
        report.status = "warning".to_string();
        report
            .warnings
            .push("no runtime paths were available for carrier binding".to_string());
    }

    report.deterministic_carrier_hash = stable_carrier_hash(&report);
    report
}

fn identity_carrier_frequency_hz(score: &FieldScore) -> f64 {
    let seed = format!(
        "{}|{}|{}|{}|{}|{}",
        score.provenance.artifact_id,
        score.title,
        score.format,
        score.version,
        score.packet.packet_kind,
        score.packet.packet_role
    );
    let hash = blake3::hash(seed.as_bytes());
    let mut bucket = 0_u64;
    for byte in hash.as_bytes().iter().take(8) {
        bucket = (bucket << 8) | u64::from(*byte);
    }
    let unit = bucket as f64 / u64::MAX as f64;
    round9(IDENTITY_CARRIER_MIN_HZ + (unit * IDENTITY_CARRIER_RANGE_HZ))
}

fn create_identity_carrier(score: &FieldScore) -> FileIdentityCarrier {
    FileIdentityCarrier {
        artifact_id: score.provenance.artifact_id.clone(),
        title_signature: stable_text_signature(&score.title),
        frequency_hz: identity_carrier_frequency_hz(score),
        carrier_role: "global_file_identity_name_carrier".to_string(),
        payload_layer: "file_identity".to_string(),
        phase: 1,
        color_hex: phase_color(1).to_string(),
        is_global_identity_tone: true,
    }
}

fn create_runtime_path_carriers(score: &FieldScore) -> Vec<RuntimePathCarrier> {
    let mut paths = Vec::new();
    for (index, track) in score.music.tracks.iter().enumerate() {
        let anchor_phase = anchor_phase_for_track_role(&track.role);
        let carrier_frequency_hz = path_frequency(score.root_frequency_hz, &track.role, index);
        paths.push(RuntimePathCarrier {
            path_index: paths.len() + 1,
            path_id: format!("runtime_path.music.{}", track.track_id),
            display_label: format!("{} / {}", track.track_id, track.role),
            channel_kind: "music_track".to_string(),
            source_track_id: track.track_id.clone(),
            source_role: track.role.clone(),
            instrument_proxy: instrument_proxy_for_track_role(&track.role).to_string(),
            carrier_frequency_hz,
            anchor_phase,
            color_hex: phase_color(anchor_phase).to_string(),
        });
    }

    paths.push(RuntimePathCarrier {
        path_index: paths.len() + 1,
        path_id: "runtime_path.conductor.primary_hand".to_string(),
        display_label: "primary_hand / conductor_path".to_string(),
        channel_kind: "conductor_track".to_string(),
        source_track_id: score.conductor.primary_hand_track.track_id.clone(),
        source_role: "conductor_motion".to_string(),
        instrument_proxy: "motion_phase_gate".to_string(),
        carrier_frequency_hz: round3(score.root_frequency_hz * 1.25),
        anchor_phase: 9,
        color_hex: phase_color(9).to_string(),
    });

    if let Some(expressive) = &score.conductor.expressive_hand_track {
        paths.push(RuntimePathCarrier {
            path_index: paths.len() + 1,
            path_id: "runtime_path.conductor.expressive_hand".to_string(),
            display_label: "expressive_hand / conductor_path".to_string(),
            channel_kind: "conductor_track".to_string(),
            source_track_id: expressive.track_id.clone(),
            source_role: "expressive_motion".to_string(),
            instrument_proxy: "secondary_motion_phase_gate".to_string(),
            carrier_frequency_hz: round3(score.root_frequency_hz * 1.5),
            anchor_phase: 7,
            color_hex: phase_color(7).to_string(),
        });
    }

    paths
}

fn create_packet_events(
    score: &FieldScore,
    duration_ms: u32,
    identity: &FileIdentityCarrier,
    paths: &[RuntimePathCarrier],
) -> Vec<PacketEventCarrier> {
    let mut events = Vec::new();
    events.push(PacketEventCarrier {
        event_index: 1,
        event_kind: "file_identity".to_string(),
        payload_layer: "file_identity".to_string(),
        runtime_path_id: "runtime_path.file.identity".to_string(),
        source_track_id: "hfield_file".to_string(),
        source_role: "global_identity".to_string(),
        note_name: None,
        gesture_id: None,
        semantic_binding:
            "global file/name carrier; this is the stable identity tone riding under the packet"
                .to_string(),
        carrier_frequency_hz: identity.frequency_hz,
        payload_frequency_hz: identity.frequency_hz,
        phase: identity.phase,
        anchor_phase: 1,
        amplitude: 0.32,
        start_ms: 0,
        duration_ms,
        end_ms: duration_ms,
        time_norm_start: 0.0,
        time_norm_end: 1.0,
        color_hex: identity.color_hex.clone(),
    });

    for track in &score.music.tracks {
        let Some(path) = paths
            .iter()
            .find(|path| path.source_track_id == track.track_id)
        else {
            continue;
        };
        for (note_index, note) in track.notes.iter().enumerate() {
            let frequency_hz = midi_note_to_frequency_hz(note.midi_note);
            let phase = phase_for_midi_note(note.midi_note);
            let start_ms = note.start_ms.min(duration_ms);
            let end_ms = note
                .start_ms
                .saturating_add(note.duration_ms.max(1))
                .min(duration_ms.max(note.start_ms.saturating_add(1)));
            events.push(PacketEventCarrier {
                event_index: events.len() + 1,
                event_kind: "note".to_string(),
                payload_layer: "sound_note_payload".to_string(),
                runtime_path_id: path.path_id.clone(),
                source_track_id: track.track_id.clone(),
                source_role: track.role.clone(),
                note_name: Some(midi_note_to_name(note.midi_note)),
                gesture_id: None,
                semantic_binding: format!(
                    "note payload {} on {}; pitch is information carried through the runtime path",
                    note_index + 1,
                    path.instrument_proxy
                ),
                carrier_frequency_hz: path.carrier_frequency_hz,
                payload_frequency_hz: round3(frequency_hz as f64),
                phase,
                anchor_phase: path.anchor_phase,
                amplitude: note.velocity.clamp(0.05, 1.0),
                start_ms,
                duration_ms: note.duration_ms.max(1),
                end_ms,
                time_norm_start: time_norm(start_ms, duration_ms),
                time_norm_end: time_norm(end_ms, duration_ms),
                color_hex: phase_color(phase).to_string(),
            });
        }
    }

    let conductor_path = paths
        .iter()
        .find(|path| path.path_id == "runtime_path.conductor.primary_hand");
    if let Some(path) = conductor_path {
        for gesture in &score.conductor.primary_hand_track.events {
            let phase = phase_for_gesture(&gesture.gesture_id);
            let start_ms = gesture.start_ms.min(duration_ms);
            let end_ms = gesture
                .start_ms
                .saturating_add(gesture.duration_ms.max(1))
                .min(duration_ms.max(gesture.start_ms.saturating_add(1)));
            events.push(PacketEventCarrier {
                event_index: events.len() + 1,
                event_kind: "gesture".to_string(),
                payload_layer: "conductor_runtime_path".to_string(),
                runtime_path_id: path.path_id.clone(),
                source_track_id: score.conductor.primary_hand_track.track_id.clone(),
                source_role: "conductor_motion".to_string(),
                note_name: None,
                gesture_id: Some(gesture.gesture_id.clone()),
                semantic_binding: format!(
                    "gesture {} binds motion phase to packet timing; it does not replace the tone payload",
                    gesture.gesture_id
                ),
                carrier_frequency_hz: path.carrier_frequency_hz,
                payload_frequency_hz: round3(path.carrier_frequency_hz * (1.0 + phase as f64 / 90.0)),
                phase,
                anchor_phase: path.anchor_phase,
                amplitude: gesture.intensity.clamp(0.05, 1.0),
                start_ms,
                duration_ms: gesture.duration_ms.max(1),
                end_ms,
                time_norm_start: time_norm(start_ms, duration_ms),
                time_norm_end: time_norm(end_ms, duration_ms),
                color_hex: phase_color(phase).to_string(),
            });
        }
    }

    events.sort_by(|a, b| {
        a.start_ms
            .cmp(&b.start_ms)
            .then_with(|| a.event_kind.cmp(&b.event_kind))
            .then_with(|| a.event_index.cmp(&b.event_index))
    });
    for (index, event) in events.iter_mut().enumerate() {
        event.event_index = index + 1;
    }
    events
}

fn create_information_ripples(events: &[PacketEventCarrier]) -> Vec<InformationRipple> {
    events
        .iter()
        .filter(|event| {
            event.event_kind == "file_identity"
                || event.event_kind == "note"
                || event.event_kind == "gesture"
        })
        .take(MAX_RIPPLES)
        .enumerate()
        .map(|(index, event)| {
            let x_seed = ((event.payload_frequency_hz / 12.0) + f64::from(event.phase)).sin();
            let surface_x_norm = x_seed.clamp(-1.0, 1.0) as f32;
            let radius_base = if event.event_kind == "file_identity" {
                0.18
            } else {
                0.09
            };
            let radius = radius_base + event.amplitude * 0.18;
            InformationRipple {
                ripple_index: index + 1,
                source_event_index: event.event_index,
                ripple_kind: if event.event_kind == "file_identity" {
                    "global_carrier_ripple".to_string()
                } else {
                    "packet_information_ripple".to_string()
                },
                payload_layer: event.payload_layer.clone(),
                runtime_path_id: event.runtime_path_id.clone(),
                semantic_binding: event.semantic_binding.clone(),
                carrier_frequency_hz: event.carrier_frequency_hz,
                payload_frequency_hz: event.payload_frequency_hz,
                phase: event.phase,
                anchor_phase: event.anchor_phase,
                start_ms: event.start_ms,
                duration_ms: event.duration_ms,
                time_norm: event.time_norm_start,
                surface_x_norm: round4(surface_x_norm),
                surface_radius_norm: round4(radius),
                amplitude: round4(event.amplitude),
                color_hex: event.color_hex.clone(),
            }
        })
        .collect()
}

fn create_time_slices(duration_ms: u32, ripples: &[InformationRipple]) -> Vec<CarrierTimeSlice> {
    let mut slices = Vec::with_capacity(TIME_SLICE_COUNT);
    for index in 0..TIME_SLICE_COUNT {
        let time_norm_value = if TIME_SLICE_COUNT <= 1 {
            0.0
        } else {
            index as f32 / (TIME_SLICE_COUNT - 1) as f32
        };
        let time_ms = ((duration_ms as f32) * time_norm_value).round() as u32;
        let active = ripples
            .iter()
            .filter(|ripple| {
                let end_ms = ripple
                    .start_ms
                    .saturating_add(ripple.duration_ms)
                    .saturating_add(ACTIVE_PAD_MS);
                time_ms.saturating_add(ACTIVE_PAD_MS) >= ripple.start_ms && time_ms <= end_ms
            })
            .collect::<Vec<_>>();
        let mut active_carrier_frequencies_hz = Vec::new();
        let mut active_payload_frequencies_hz = Vec::new();
        let mut composite_amplitude = 0.0_f32;
        let mut dominant_phase = 1u8;
        let mut dominant_layer = "silence".to_string();
        let mut dominant_color = phase_color(1).to_string();
        let mut strongest = 0.0_f32;

        for ripple in &active {
            active_carrier_frequencies_hz.push(round3(ripple.carrier_frequency_hz));
            active_payload_frequencies_hz.push(round3(ripple.payload_frequency_hz));
            composite_amplitude += ripple.amplitude;
            if ripple.amplitude >= strongest {
                strongest = ripple.amplitude;
                dominant_phase = ripple.phase;
                dominant_layer = ripple.payload_layer.clone();
                dominant_color = ripple.color_hex.clone();
            }
        }

        slices.push(CarrierTimeSlice {
            slice_index: index + 1,
            time_ms,
            time_norm: round4(time_norm_value),
            scanline_z_norm: round4(time_norm_value * 2.0 - 1.0),
            active_ripple_count: active.len(),
            active_carrier_frequencies_hz,
            active_payload_frequencies_hz,
            composite_amplitude: round4(composite_amplitude.min(1.0)),
            dominant_payload_layer: dominant_layer,
            dominant_phase,
            dominant_color_hex: dominant_color,
        });
    }
    slices
}

fn derive_key_signature_proxy(score: &FieldScore) -> String {
    let first_note = score
        .music
        .tracks
        .iter()
        .flat_map(|track| track.notes.iter())
        .min_by_key(|note| note.start_ms);
    match first_note {
        Some(note) => format!(
            "{} operating field proxy",
            midi_note_to_name(note.midi_note)
        ),
        None => "unbound_key_field_proxy".to_string(),
    }
}

fn anchor_phase_for_track_role(role: &str) -> u8 {
    let lower = role.to_lowercase();
    if lower.contains("bass") || lower.contains("depth") || lower.contains("lower") {
        5
    } else if lower.contains("field") || lower.contains("support") || lower.contains("harmonic") {
        9
    } else {
        1
    }
}

fn instrument_proxy_for_track_role(role: &str) -> &'static str {
    let lower = role.to_lowercase();
    if lower.contains("bass") || lower.contains("depth") || lower.contains("lower") {
        "low_depth_sine_carrier"
    } else if lower.contains("field") || lower.contains("support") || lower.contains("harmonic") {
        "sustained_field_carrier"
    } else {
        "lead_tone_carrier"
    }
}

fn path_frequency(root_frequency_hz: f64, role: &str, index: usize) -> f64 {
    let lower = role.to_lowercase();
    let frequency = if lower.contains("bass") || lower.contains("depth") || lower.contains("lower")
    {
        root_frequency_hz * 0.5
    } else if lower.contains("field") || lower.contains("support") || lower.contains("harmonic") {
        root_frequency_hz * 1.5
    } else {
        root_frequency_hz * (1.0 + index as f64 * 0.125)
    };
    round3(frequency.max(1.0))
}

fn phase_for_midi_note(midi_note: u8) -> u8 {
    HFIELD_PHASE_ORDER[(midi_note as usize) % HFIELD_PHASE_ORDER.len()]
}

fn phase_for_gesture(gesture_id: &str) -> u8 {
    let digits = gesture_id
        .chars()
        .filter(char::is_ascii_digit)
        .collect::<String>();
    digits
        .parse::<u8>()
        .ok()
        .filter(|phase| (1..=9).contains(phase))
        .unwrap_or(1)
}

fn phase_color(phase: u8) -> &'static str {
    match phase {
        1 => "#f6f1c8",
        2 => "#54d6ff",
        3 => "#7df5a4",
        4 => "#63a4ff",
        5 => "#ffb23f",
        6 => "#f06aff",
        7 => "#46ffd2",
        8 => "#ff5c7c",
        9 => "#9d7cff",
        _ => "#d8e4ff",
    }
}

fn total_duration_ms(score: &FieldScore) -> u32 {
    let note_end = score
        .music
        .tracks
        .iter()
        .flat_map(|track| track.notes.iter())
        .map(|note| note.start_ms.saturating_add(note.duration_ms))
        .max()
        .unwrap_or(0);
    let primary_gesture_end = score
        .conductor
        .primary_hand_track
        .events
        .iter()
        .map(|event| event.start_ms.saturating_add(event.duration_ms))
        .max()
        .unwrap_or(0);
    let expressive_gesture_end = score
        .conductor
        .expressive_hand_track
        .as_ref()
        .and_then(|track| {
            track
                .events
                .iter()
                .map(|event| event.start_ms.saturating_add(event.duration_ms))
                .max()
        })
        .unwrap_or(0);
    note_end
        .max(primary_gesture_end)
        .max(expressive_gesture_end)
        .max(1)
}

fn time_norm(time_ms: u32, duration_ms: u32) -> f32 {
    if duration_ms == 0 {
        0.0
    } else {
        round4((time_ms as f32 / duration_ms as f32).clamp(0.0, 1.0))
    }
}

fn stable_text_signature(text: &str) -> String {
    let hash = blake3::hash(text.as_bytes()).to_hex().to_string();
    hash.chars().take(16).collect()
}

fn stable_carrier_hash(report: &HfieldRuntimeCarrierPacketReport) -> String {
    let mut clone = report.clone();
    clone.deterministic_carrier_hash.clear();
    let json = serde_json::to_vec(&clone).unwrap_or_default();
    blake3::hash(&json).to_hex().to_string()
}

fn round3(value: f64) -> f64 {
    (value * 1000.0).round() / 1000.0
}

fn round4(value: f32) -> f32 {
    (value * 10000.0).round() / 10000.0
}

fn round9(value: f64) -> f64 {
    (value * 1_000_000_000.0).round() / 1_000_000_000.0
}

#[cfg(test)]
mod tests {
    use super::*;
    use hfield_domain::{FieldScore, NoteEvent};

    fn single_note_score() -> FieldScore {
        let mut score = FieldScore::default_hcs();
        score.title = "Ode to Joy Runtime Carrier Seed".to_string();
        score.provenance.artifact_id = "hfield_ode_to_joy_seed".to_string();
        score.music.tracks[0].notes = vec![NoteEvent {
            midi_note: 64,
            start_ms: 0,
            duration_ms: 714,
            velocity: 0.88,
        }];
        score
    }

    fn chord_score() -> FieldScore {
        let mut score = single_note_score();
        score.music.tracks[1].notes = vec![NoteEvent {
            midi_note: 43,
            start_ms: 0,
            duration_ms: 714,
            velocity: 0.45,
        }];
        score.music.tracks[2].notes = vec![NoteEvent {
            midi_note: 60,
            start_ms: 0,
            duration_ms: 714,
            velocity: 0.55,
        }];
        score
    }

    #[test]
    fn default_score_creates_global_file_identity_carrier() {
        let report = synthesize_hfield_runtime_carrier_packet_model(&FieldScore::default_hcs());
        assert_eq!(report.carrier_contract_id, CARRIER_CONTRACT_ID);
        assert_eq!(
            report.global_file_carrier_frequency_hz,
            report.identity_carrier.frequency_hz
        );
        assert!(report.identity_carrier.frequency_hz >= IDENTITY_CARRIER_MIN_HZ);
        assert!(
            report.identity_carrier.frequency_hz
                <= IDENTITY_CARRIER_MIN_HZ + IDENTITY_CARRIER_RANGE_HZ
        );
        assert_eq!(report.identity_carrier.payload_layer, "file_identity");
    }

    #[test]
    fn different_file_identity_changes_identity_carrier_without_hardcoding() {
        let first = synthesize_hfield_runtime_carrier_packet_model(&single_note_score());
        let mut second_score = single_note_score();
        second_score.provenance.artifact_id = "different_hfield_runtime_identity".to_string();
        second_score.title = "Different Runtime Carrier Seed".to_string();
        let second = synthesize_hfield_runtime_carrier_packet_model(&second_score);
        assert_ne!(
            first.identity_carrier.frequency_hz,
            second.identity_carrier.frequency_hz
        );
    }

    #[test]
    fn music_tracks_create_runtime_path_carriers() {
        let report = synthesize_hfield_runtime_carrier_packet_model(&FieldScore::default_hcs());
        assert!(report
            .runtime_paths
            .iter()
            .any(|path| path.path_id == "runtime_path.music.lead_voice"));
        assert!(report
            .runtime_paths
            .iter()
            .any(|path| path.path_id == "runtime_path.conductor.primary_hand"));
        assert!(report
            .runtime_paths
            .iter()
            .all(|path| path.carrier_frequency_hz > 0.0));
    }

    #[test]
    fn note_events_become_information_ripples_not_random_objects() {
        let report = synthesize_hfield_runtime_carrier_packet_model(&single_note_score());
        let note_event = report
            .packet_events
            .iter()
            .find(|event| event.event_kind == "note")
            .expect("note event should exist");
        assert_eq!(note_event.note_name.as_deref(), Some("E4"));
        assert_ne!(
            note_event.payload_frequency_hz,
            report.identity_carrier.frequency_hz
        );
        assert!(report.information_ripples.iter().any(|ripple| {
            ripple.source_event_index == note_event.event_index
                && ripple.payload_layer == "sound_note_payload"
        }));
    }

    #[test]
    fn chord_score_reports_multiple_active_frequencies_in_time_slice() {
        let report = synthesize_hfield_runtime_carrier_packet_model(&chord_score());
        assert!(report
            .time_slices
            .iter()
            .any(|slice| slice.active_payload_frequencies_hz.len() >= 3));
    }

    #[test]
    fn gesture_events_bind_runtime_paths_without_replacing_sound_payload() {
        let report = synthesize_hfield_runtime_carrier_packet_model(&single_note_score());
        assert!(report
            .packet_events
            .iter()
            .any(|event| event.event_kind == "gesture"
                && event.payload_layer == "conductor_runtime_path"));
        assert!(
            report
                .packet_events
                .iter()
                .any(|event| event.event_kind == "note"
                    && event.payload_layer == "sound_note_payload")
        );
    }

    #[test]
    fn carrier_model_output_is_deterministic() {
        let a = synthesize_hfield_runtime_carrier_packet_model(&chord_score());
        let b = synthesize_hfield_runtime_carrier_packet_model(&chord_score());
        assert_eq!(a.deterministic_carrier_hash, b.deterministic_carrier_hash);
        assert_eq!(a.information_ripples, b.information_ripples);
        assert_eq!(a.time_slices, b.time_slices);
    }
}
