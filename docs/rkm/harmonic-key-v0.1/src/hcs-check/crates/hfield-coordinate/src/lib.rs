use hfield_domain::FieldScore;
use serde::{Deserialize, Serialize};

const FIELD_X_MIN: f64 = -4.2;
const FIELD_X_MAX: f64 = 4.2;
const FIELD_Z_MIN: f64 = -3.65;
const FIELD_Z_MAX: f64 = 3.65;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum CoordinateLayer {
    FileIdentityCarrier,
    RuntimePathCarrier,
    PayloadTone,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum VerticalLane {
    Identity,
    PayloadLead,
    RuntimeDepth,
    RuntimeField,
    RuntimeOther,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HarmonicCoordinateEntry {
    pub entry_id: String,
    pub layer: CoordinateLayer,
    pub lane: VerticalLane,
    pub track_id: String,
    pub label: String,
    pub midi_note: Option<u8>,
    pub note_name: Option<String>,
    pub frequency_hz: f64,
    pub start_ms: u32,
    pub duration_ms: u32,
    pub end_ms: u32,
    pub x_pitch_position: f64,
    pub y_lane_position: f64,
    pub z_start_position: f64,
    pub z_end_position: f64,
    pub z_center_position: f64,
    pub z_body_length: f64,
    pub pitch_class: Option<u8>,
    pub layer_color: String,
    pub pitch_color: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HarmonicCoordinateRegistry {
    pub contract_id: String,
    pub coordinate_profile: String,
    pub axis_contract: AxisContract,
    pub total_duration_ms: u32,
    pub entries: Vec<HarmonicCoordinateEntry>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AxisContract {
    pub x: String,
    pub y: String,
    pub z: String,
    pub t: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct InterferenceEligibility {
    pub left_entry_id: String,
    pub right_entry_id: String,
    pub overlap_ms: u32,
    pub pitch_distance: f64,
    pub lane_distance: f64,
    pub eligible: bool,
}

pub fn build_harmonic_coordinate_registry(score: &FieldScore) -> HarmonicCoordinateRegistry {
    let total_duration_ms = score_total_duration_ms(score);
    let mut entries = Vec::new();

    entries.push(file_identity_entry(score, total_duration_ms));

    for track in &score.music.tracks {
        let lane = lane_for_track(&track.track_id);
        let layer = layer_for_lane(&lane);

        for note in &track.notes {
            let midi_note = note.midi_note;
            let frequency_hz = midi_to_hz(midi_note);
            let start_ms = note.start_ms;
            let duration_ms = note.duration_ms.max(1);
            let end_ms = start_ms.saturating_add(duration_ms);
            let pitch_class = midi_note % 12;
            let note_name = midi_note_name(midi_note);

            let z_start = time_to_z(start_ms, total_duration_ms);
            let z_end = time_to_z(end_ms, total_duration_ms);
            let z_body_length = (z_end - z_start).abs();

            entries.push(HarmonicCoordinateEntry {
                entry_id: format!(
                    "{}:{}:{}:{}",
                    track.track_id, note_name, start_ms, duration_ms
                ),
                layer: layer.clone(),
                lane: lane.clone(),
                track_id: track.track_id.clone(),
                label: format!("{} {}", track.track_id, note_name),
                midi_note: Some(midi_note),
                note_name: Some(note_name),
                frequency_hz: round3(frequency_hz),
                start_ms,
                duration_ms,
                end_ms,
                x_pitch_position: round4(pitch_class_to_x(pitch_class)),
                y_lane_position: round4(lane_to_y(&lane)),
                z_start_position: round4(z_start),
                z_end_position: round4(z_end),
                z_center_position: round4((z_start + z_end) / 2.0),
                z_body_length: round4(z_body_length),
                pitch_class: Some(pitch_class),
                layer_color: layer_color(&layer).to_string(),
                pitch_color: pitch_class_color(pitch_class).to_string(),
            });
        }
    }

    HarmonicCoordinateRegistry {
        contract_id: "aiweb.hfield.harmonic_coordinate_registry.v1".to_string(),
        coordinate_profile: "hcs_canonical_harmonic_coordinate_profile_v1".to_string(),
        axis_contract: AxisContract {
            x: "reader surface pitch/spatial reference".to_string(),
            y: "cymatic displacement lane and harmonic amplitude region".to_string(),
            z: "field depth / spatial reference".to_string(),
            t: "glass reader scan time; not a static rendered axis".to_string(),
        },
        total_duration_ms,
        entries,
    }
}

pub fn calculate_interference_eligibility(
    registry: &HarmonicCoordinateRegistry,
) -> Vec<InterferenceEligibility> {
    let mut results = Vec::new();

    for left_index in 0..registry.entries.len() {
        for right_index in (left_index + 1)..registry.entries.len() {
            let left = &registry.entries[left_index];
            let right = &registry.entries[right_index];

            if left.layer == CoordinateLayer::FileIdentityCarrier
                && right.layer == CoordinateLayer::FileIdentityCarrier
            {
                continue;
            }

            let overlap_ms = temporal_overlap_ms(left, right);
            let pitch_distance = (left.x_pitch_position - right.x_pitch_position).abs();
            let lane_distance = (left.y_lane_position - right.y_lane_position).abs();
            let eligible = overlap_ms > 0 && pitch_distance <= 1.35 && lane_distance <= 1.25;

            results.push(InterferenceEligibility {
                left_entry_id: left.entry_id.clone(),
                right_entry_id: right.entry_id.clone(),
                overlap_ms,
                pitch_distance: round4(pitch_distance),
                lane_distance: round4(lane_distance),
                eligible,
            });
        }
    }

    results
}

pub fn midi_to_hz(midi_note: u8) -> f64 {
    440.0 * 2f64.powf((f64::from(midi_note) - 69.0) / 12.0)
}

pub fn midi_note_name(midi_note: u8) -> String {
    let names = [
        "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
    ];
    let pitch_class = midi_note % 12;
    let octave = i16::from(midi_note) / 12 - 1;

    format!("{}{}", names[usize::from(pitch_class)], octave)
}

pub fn pitch_class_to_x(pitch_class: u8) -> f64 {
    let clamped = f64::from(pitch_class % 12);
    FIELD_X_MIN + ((clamped + 0.5) / 12.0) * (FIELD_X_MAX - FIELD_X_MIN)
}

pub fn time_to_z(time_ms: u32, total_duration_ms: u32) -> f64 {
    let safe_total = total_duration_ms.max(1);
    let ratio = (f64::from(time_ms) / f64::from(safe_total)).clamp(0.0, 1.0);

    FIELD_Z_MIN + ratio * (FIELD_Z_MAX - FIELD_Z_MIN)
}

pub fn lane_for_track(track_id: &str) -> VerticalLane {
    let lower = track_id.to_lowercase();

    if lower.contains("lead") || lower.contains("payload") || lower.contains("primary") {
        VerticalLane::PayloadLead
    } else if lower.contains("depth") || lower.contains("lower") || lower.contains("anchor_5") {
        VerticalLane::RuntimeDepth
    } else if lower.contains("field") || lower.contains("upper") || lower.contains("anchor_9") {
        VerticalLane::RuntimeField
    } else {
        VerticalLane::RuntimeOther
    }
}

pub fn lane_to_y(lane: &VerticalLane) -> f64 {
    match lane {
        VerticalLane::Identity => 3.05,
        VerticalLane::RuntimeDepth => 0.85,
        VerticalLane::PayloadLead => 1.42,
        VerticalLane::RuntimeField => 2.12,
        VerticalLane::RuntimeOther => 1.68,
    }
}

pub fn pitch_class_color(pitch_class: u8) -> &'static str {
    match pitch_class % 12 {
        0 => "#ff3b30",
        1 => "#ff6b2b",
        2 => "#ffb000",
        3 => "#f6d84a",
        4 => "#e8f66a",
        5 => "#7ee36d",
        6 => "#35d07f",
        7 => "#36d6ff",
        8 => "#2f8dff",
        9 => "#6657ff",
        10 => "#a56bff",
        _ => "#ff73d1",
    }
}

fn file_identity_entry(score: &FieldScore, total_duration_ms: u32) -> HarmonicCoordinateEntry {
    let artifact_id = score.provenance.artifact_id.clone();
    let frequency_hz = deterministic_identity_frequency_hz(&artifact_id);
    let z_start = time_to_z(0, total_duration_ms);
    let z_end = time_to_z(total_duration_ms, total_duration_ms);

    HarmonicCoordinateEntry {
        entry_id: "file_identity_carrier".to_string(),
        layer: CoordinateLayer::FileIdentityCarrier,
        lane: VerticalLane::Identity,
        track_id: "file_identity".to_string(),
        label: artifact_id,
        midi_note: None,
        note_name: None,
        frequency_hz: round3(frequency_hz),
        start_ms: 0,
        duration_ms: total_duration_ms,
        end_ms: total_duration_ms,
        x_pitch_position: 0.0,
        y_lane_position: lane_to_y(&VerticalLane::Identity),
        z_start_position: round4(z_start),
        z_end_position: round4(z_end),
        z_center_position: round4((z_start + z_end) / 2.0),
        z_body_length: round4((z_end - z_start).abs()),
        pitch_class: None,
        layer_color: layer_color(&CoordinateLayer::FileIdentityCarrier).to_string(),
        pitch_color: layer_color(&CoordinateLayer::FileIdentityCarrier).to_string(),
    }
}

fn deterministic_identity_frequency_hz(artifact_id: &str) -> f64 {
    let mut hash: u64 = 14_695_981_039_346_656_037;

    for byte in artifact_id.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(1_099_511_628_211);
    }

    let fractional = (hash % 1_000_000) as f64 / 1_000_000.0;
    96.0 + fractional * 1344.0
}

fn layer_for_lane(lane: &VerticalLane) -> CoordinateLayer {
    match lane {
        VerticalLane::Identity => CoordinateLayer::FileIdentityCarrier,
        VerticalLane::PayloadLead => CoordinateLayer::PayloadTone,
        VerticalLane::RuntimeDepth | VerticalLane::RuntimeField | VerticalLane::RuntimeOther => {
            CoordinateLayer::RuntimePathCarrier
        }
    }
}

fn layer_color(layer: &CoordinateLayer) -> &'static str {
    match layer {
        CoordinateLayer::FileIdentityCarrier => "#f6d36b",
        CoordinateLayer::RuntimePathCarrier => "#56d6ff",
        CoordinateLayer::PayloadTone => "#fff2ad",
    }
}

fn score_total_duration_ms(score: &FieldScore) -> u32 {
    score
        .music
        .tracks
        .iter()
        .flat_map(|track| &track.notes)
        .map(|note| note.start_ms.saturating_add(note.duration_ms))
        .max()
        .unwrap_or(1)
        .max(1)
}

fn temporal_overlap_ms(left: &HarmonicCoordinateEntry, right: &HarmonicCoordinateEntry) -> u32 {
    let start = left.start_ms.max(right.start_ms);
    let end = left.end_ms.min(right.end_ms);

    end.saturating_sub(start)
}

fn round3(value: f64) -> f64 {
    (value * 1000.0).round() / 1000.0
}

fn round4(value: f64) -> f64 {
    (value * 10000.0).round() / 10000.0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn canonical_score() -> FieldScore {
        serde_json::from_str(include_str!(
            "../../../projects/hcs_canonical_reader_packet_v1.hfield"
        ))
        .expect("canonical reader must parse")
    }

    #[test]
    fn maps_known_pitches_to_stable_coordinates() {
        let score = canonical_score();
        let registry = build_harmonic_coordinate_registry(&score);

        let c4_entries: Vec<_> = registry
            .entries
            .iter()
            .filter(|entry| entry.note_name.as_deref() == Some("C4"))
            .collect();

        assert!(c4_entries.len() >= 3);

        let c4_x = c4_entries[0].x_pitch_position;
        assert!(c4_entries
            .iter()
            .all(|entry| entry.x_pitch_position == c4_x));

        let g4 = registry
            .entries
            .iter()
            .find(|entry| entry.note_name.as_deref() == Some("G4"))
            .expect("G4 must exist");

        assert_ne!(g4.x_pitch_position, c4_x);
        assert_eq!(g4.pitch_class, Some(7));
        assert_eq!(g4.pitch_color, pitch_class_color(7));
    }

    #[test]
    fn maps_track_roles_to_vertical_lanes() {
        let score = canonical_score();
        let registry = build_harmonic_coordinate_registry(&score);

        let lead = registry
            .entries
            .iter()
            .find(|entry| {
                entry.track_id == "lead_voice" && entry.note_name.as_deref() == Some("C4")
            })
            .expect("lead C4 must exist");

        let depth = registry
            .entries
            .iter()
            .find(|entry| {
                entry.track_id == "depth_voice" && entry.note_name.as_deref() == Some("G3")
            })
            .expect("depth G3 must exist");

        let field = registry
            .entries
            .iter()
            .find(|entry| {
                entry.track_id == "field_voice" && entry.note_name.as_deref() == Some("G4")
            })
            .expect("field G4 must exist");

        assert_eq!(lead.lane, VerticalLane::PayloadLead);
        assert_eq!(depth.lane, VerticalLane::RuntimeDepth);
        assert_eq!(field.lane, VerticalLane::RuntimeField);

        assert!(depth.y_lane_position < lead.y_lane_position);
        assert!(field.y_lane_position > lead.y_lane_position);
    }

    #[test]
    fn maps_start_and_duration_to_z_positions() {
        let score = canonical_score();
        let registry = build_harmonic_coordinate_registry(&score);

        assert_eq!(registry.total_duration_ms, 8000);

        let first_c4 = registry
            .entries
            .iter()
            .find(|entry| {
                entry.track_id == "lead_voice"
                    && entry.note_name.as_deref() == Some("C4")
                    && entry.start_ms == 0
            })
            .expect("first C4 must exist");

        let packet_g4 = registry
            .entries
            .iter()
            .find(|entry| {
                entry.track_id == "lead_voice"
                    && entry.note_name.as_deref() == Some("G4")
                    && entry.start_ms == 6000
            })
            .expect("packet G4 must exist");

        assert_eq!(first_c4.z_start_position, round4(FIELD_Z_MIN));
        assert!(first_c4.z_body_length > 1.7);
        assert!(packet_g4.z_start_position > 1.7);
        assert_eq!(packet_g4.z_end_position, round4(FIELD_Z_MAX));
    }

    #[test]
    fn identity_carrier_is_deterministic_and_not_example_locked() {
        let score = canonical_score();
        let registry = build_harmonic_coordinate_registry(&score);

        let identity = registry
            .entries
            .iter()
            .find(|entry| entry.layer == CoordinateLayer::FileIdentityCarrier)
            .expect("identity carrier must exist");

        assert_ne!(identity.frequency_hz, 174.0);
        assert!(identity.frequency_hz >= 96.0);
        assert!(identity.frequency_hz <= 1440.0);
        assert_eq!(identity.start_ms, 0);
        assert_eq!(identity.duration_ms, 8000);
    }

    #[test]
    fn overlapping_events_report_interference_eligibility_without_guessing() {
        let score = canonical_score();
        let registry = build_harmonic_coordinate_registry(&score);
        let reports = calculate_interference_eligibility(&registry);

        assert!(reports.iter().any(|report| report.overlap_ms > 0));
        assert!(reports.iter().any(|report| report.eligible));
    }
}

// HFIELD Rust Render Manifest v1
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HfieldRustRenderManifest {
    pub contract_id: String,
    pub source_coordinate_contract_id: String,
    pub coordinate_profile: String,
    pub axis_contract: AxisContract,
    pub total_duration_ms: u32,
    pub scan_min_z: f64,
    pub scan_max_z: f64,
    pub field_width: f64,
    pub field_height: f64,
    pub field_bodies: Vec<HfieldRustRenderBody>,
    pub bridge_bodies: Vec<HfieldRustRenderBridge>,
    pub reference_lines: Vec<HfieldRustRenderReferenceLine>,
    pub reference_points: Vec<HfieldRustRenderReferencePoint>,
    pub proof_windows: Vec<HfieldRustRenderProofWindow>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HfieldRustRenderBody {
    pub body_id: String,
    pub source_entry_id: String,
    pub layer_key: String,
    pub lane_key: String,
    pub track_id: String,
    pub label: String,
    pub note_name: Option<String>,
    pub midi_note: Option<u8>,
    pub frequency_hz: f64,
    pub start_ms: u32,
    pub duration_ms: u32,
    pub end_ms: u32,
    pub x: f64,
    pub y: f64,
    pub z_start: f64,
    pub z_end: f64,
    pub z_center: f64,
    pub z_body_length: f64,
    pub radius_x: f64,
    pub radius_y: f64,
    pub amplitude: f64,
    pub color_hex: String,
    pub layer_color_hex: String,
    pub pitch_color_hex: String,
    pub render_role: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HfieldRustRenderBridge {
    pub bridge_id: String,
    pub left_body_id: String,
    pub right_body_id: String,
    pub overlap_ms: u32,
    pub x: f64,
    pub y: f64,
    pub z_start: f64,
    pub z_end: f64,
    pub z_center: f64,
    pub z_body_length: f64,
    pub radius_x: f64,
    pub radius_y: f64,
    pub color_a_hex: String,
    pub color_b_hex: String,
    pub blend_strength: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HfieldRustRenderVec3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HfieldRustRenderReferenceLine {
    pub line_id: String,
    pub line_role: String,
    pub label: String,
    pub points: Vec<HfieldRustRenderVec3>,
    pub color_hex: String,
    pub opacity: f64,
    pub width: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HfieldRustRenderReferencePoint {
    pub point_id: String,
    pub point_role: String,
    pub label: String,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub radius: f64,
    pub color_hex: String,
    pub phase: Option<u8>,
    pub time_ms: Option<u32>,
    pub frequency_hz: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HfieldRustRenderProofWindow {
    pub label: String,
    pub time_ms: u32,
    pub active_payload_count: usize,
    pub active_runtime_count: usize,
    pub active_body_ids: Vec<String>,
}

pub fn create_hfield_rust_render_manifest(score: &FieldScore) -> HfieldRustRenderManifest {
    let registry = build_harmonic_coordinate_registry(score);
    let field_bodies = registry
        .entries
        .iter()
        .map(|entry| render_body_from_coordinate_entry(score, entry))
        .collect::<Vec<_>>();

    let bridge_bodies = render_bridges_from_manifest(&registry, &field_bodies);
    let reference_lines = render_reference_lines_from_manifest(&registry, &field_bodies);
    let reference_points = render_reference_points_from_manifest(&field_bodies);

    let proof_windows = vec![
        render_proof_window("single tone proof", 1000, &field_bodies),
        render_proof_window("two tone interference proof", 3000, &field_bodies),
        render_proof_window("three tone chord proof", 5000, &field_bodies),
        render_proof_window("packet emission proof", 7000, &field_bodies),
    ];

    HfieldRustRenderManifest {
        contract_id: "aiweb.hfield.rust_render_manifest.v1".to_string(),
        source_coordinate_contract_id: registry.contract_id.clone(),
        coordinate_profile: registry.coordinate_profile.clone(),
        axis_contract: registry.axis_contract.clone(),
        total_duration_ms: registry.total_duration_ms,
        scan_min_z: FIELD_Z_MIN,
        scan_max_z: FIELD_Z_MAX,
        field_width: FIELD_X_MAX - FIELD_X_MIN,
        field_height: 3.8,
        field_bodies,
        bridge_bodies,
        reference_lines,
        reference_points,
        proof_windows,
        warnings: Vec::new(),
    }
}

fn render_body_from_coordinate_entry(
    score: &FieldScore,
    entry: &HarmonicCoordinateEntry,
) -> HfieldRustRenderBody {
    let amplitude = render_amplitude(score, entry);
    let radius_x = render_radius_x(&entry.layer, amplitude);
    let radius_y = render_radius_y(&entry.layer, amplitude);
    let layer_key = coordinate_layer_key(&entry.layer).to_string();
    let lane_key = vertical_lane_key(&entry.lane).to_string();
    let color_hex = match entry.layer {
        CoordinateLayer::FileIdentityCarrier => entry.layer_color.clone(),
        CoordinateLayer::RuntimePathCarrier => entry.layer_color.clone(),
        CoordinateLayer::PayloadTone => entry.pitch_color.clone(),
    };

    HfieldRustRenderBody {
        body_id: format!("render_body:{}", entry.entry_id),
        source_entry_id: entry.entry_id.clone(),
        layer_key,
        lane_key,
        track_id: entry.track_id.clone(),
        label: entry.label.clone(),
        note_name: entry.note_name.clone(),
        midi_note: entry.midi_note,
        frequency_hz: entry.frequency_hz,
        start_ms: entry.start_ms,
        duration_ms: entry.duration_ms,
        end_ms: entry.end_ms,
        x: entry.x_pitch_position,
        y: entry.y_lane_position,
        z_start: entry.z_start_position,
        z_end: entry.z_end_position,
        z_center: entry.z_center_position,
        z_body_length: entry.z_body_length.max(0.08),
        radius_x,
        radius_y,
        amplitude,
        color_hex,
        layer_color_hex: entry.layer_color.clone(),
        pitch_color_hex: entry.pitch_color.clone(),
        render_role: render_role(&entry.layer, &entry.lane).to_string(),
    }
}

fn render_bridges_from_manifest(
    registry: &HarmonicCoordinateRegistry,
    bodies: &[HfieldRustRenderBody],
) -> Vec<HfieldRustRenderBridge> {
    let eligibility = calculate_interference_eligibility(registry);
    let mut bridges = Vec::new();

    for report in eligibility.iter().filter(|report| report.eligible) {
        let Some(left) = bodies
            .iter()
            .find(|body| body.source_entry_id == report.left_entry_id)
        else {
            continue;
        };

        let Some(right) = bodies
            .iter()
            .find(|body| body.source_entry_id == report.right_entry_id)
        else {
            continue;
        };

        let z_start = left.z_start.max(right.z_start);
        let z_end = left.z_end.min(right.z_end);

        if z_end <= z_start {
            continue;
        }

        let pitch_pressure = 1.0 - (report.pitch_distance / 1.35).clamp(0.0, 1.0);
        let lane_pressure = 1.0 - (report.lane_distance / 1.25).clamp(0.0, 1.0);
        let blend_strength = round4((pitch_pressure * 0.62 + lane_pressure * 0.38).clamp(0.0, 1.0));

        bridges.push(HfieldRustRenderBridge {
            bridge_id: format!("render_bridge:{}::{}", left.body_id, right.body_id),
            left_body_id: left.body_id.clone(),
            right_body_id: right.body_id.clone(),
            overlap_ms: report.overlap_ms,
            x: round4((left.x + right.x) / 2.0),
            y: round4((left.y + right.y) / 2.0),
            z_start,
            z_end,
            z_center: round4((z_start + z_end) / 2.0),
            z_body_length: round4((z_end - z_start).abs().max(0.08)),
            radius_x: round4(left.radius_x.min(right.radius_x) * (0.24 + blend_strength * 0.42)),
            radius_y: round4(left.radius_y.min(right.radius_y) * (0.18 + blend_strength * 0.36)),
            color_a_hex: left.color_hex.clone(),
            color_b_hex: right.color_hex.clone(),
            blend_strength,
        });
    }

    bridges
}

fn render_reference_lines_from_manifest(
    registry: &HarmonicCoordinateRegistry,
    bodies: &[HfieldRustRenderBody],
) -> Vec<HfieldRustRenderReferenceLine> {
    let mut lines = vec![
        HfieldRustRenderReferenceLine {
            line_id: "axis:glass_reader_center".to_string(),
            line_role: "reader_axis".to_string(),
            label: "glass reader center scan axis".to_string(),
            points: vec![
                point3(0.0, 0.04, FIELD_Z_MIN),
                point3(0.0, 0.04, FIELD_Z_MAX),
            ],
            color_hex: "#eaffff".to_string(),
            opacity: 0.52,
            width: 1.5,
        },
        HfieldRustRenderReferenceLine {
            line_id: "axis:payload_pitch_reference".to_string(),
            line_role: "payload_reference_axis".to_string(),
            label: "payload pitch reference line".to_string(),
            points: vec![
                point3(FIELD_X_MIN, lane_to_y(&VerticalLane::PayloadLead), 0.0),
                point3(FIELD_X_MAX, lane_to_y(&VerticalLane::PayloadLead), 0.0),
            ],
            color_hex: "#fff2ad".to_string(),
            opacity: 0.34,
            width: 1.2,
        },
        HfieldRustRenderReferenceLine {
            line_id: "axis:runtime_depth_reference".to_string(),
            line_role: "runtime_reference_axis".to_string(),
            label: "lower runtime path reference line".to_string(),
            points: vec![
                point3(FIELD_X_MIN, lane_to_y(&VerticalLane::RuntimeDepth), 0.0),
                point3(FIELD_X_MAX, lane_to_y(&VerticalLane::RuntimeDepth), 0.0),
            ],
            color_hex: "#56d6ff".to_string(),
            opacity: 0.28,
            width: 1.1,
        },
        HfieldRustRenderReferenceLine {
            line_id: "axis:runtime_field_reference".to_string(),
            line_role: "runtime_reference_axis".to_string(),
            label: "upper runtime field reference line".to_string(),
            points: vec![
                point3(FIELD_X_MIN, lane_to_y(&VerticalLane::RuntimeField), 0.0),
                point3(FIELD_X_MAX, lane_to_y(&VerticalLane::RuntimeField), 0.0),
            ],
            color_hex: "#56d6ff".to_string(),
            opacity: 0.28,
            width: 1.1,
        },
    ];

    let mut seen_tracks: Vec<String> = Vec::new();

    for body in bodies
        .iter()
        .filter(|body| body.layer_key != "file_identity_carrier")
    {
        if seen_tracks
            .iter()
            .any(|track_id| track_id == &body.track_id)
        {
            continue;
        }

        seen_tracks.push(body.track_id.clone());

        let track_bodies = bodies
            .iter()
            .filter(|candidate| candidate.track_id == body.track_id)
            .collect::<Vec<_>>();

        let average_x = if track_bodies.is_empty() {
            body.x
        } else {
            track_bodies
                .iter()
                .map(|candidate| candidate.x)
                .sum::<f64>()
                / track_bodies.len() as f64
        };

        let lane = registry
            .entries
            .iter()
            .find(|entry| entry.track_id == body.track_id)
            .map(|entry| entry.lane.clone())
            .unwrap_or(VerticalLane::RuntimeOther);

        lines.push(HfieldRustRenderReferenceLine {
            line_id: format!("track_guide:{}", body.track_id),
            line_role: "track_conductor_guide".to_string(),
            label: format!("{} conductor guide", body.track_id),
            points: vec![
                point3(round4(average_x), lane_to_y(&lane), FIELD_Z_MIN),
                point3(round4(average_x), lane_to_y(&lane), FIELD_Z_MAX),
            ],
            color_hex: body.layer_color_hex.clone(),
            opacity: 0.42,
            width: 1.4,
        });
    }

    lines
}

fn render_reference_points_from_manifest(
    bodies: &[HfieldRustRenderBody],
) -> Vec<HfieldRustRenderReferencePoint> {
    let mut points = vec![
        phase_anchor_point(
            1,
            "center/home/root presence",
            0.0,
            lane_to_y(&VerticalLane::PayloadLead),
            0.0,
            "#f6f1c8",
        ),
        phase_anchor_point(
            5,
            "lower/depth/constraint anchor",
            FIELD_X_MIN,
            lane_to_y(&VerticalLane::RuntimeDepth),
            0.0,
            "#ffb23f",
        ),
        phase_anchor_point(
            9,
            "upper/field/formed return anchor",
            FIELD_X_MAX,
            lane_to_y(&VerticalLane::RuntimeField),
            0.0,
            "#9d7cff",
        ),
    ];

    for body in bodies {
        if body.layer_key == "file_identity_carrier" {
            points.push(HfieldRustRenderReferencePoint {
                point_id: "reference:file_identity_origin".to_string(),
                point_role: "file_identity_reference".to_string(),
                label: "file identity carrier reference".to_string(),
                x: body.x,
                y: body.y,
                z: body.z_center,
                radius: 0.09,
                color_hex: body.color_hex.clone(),
                phase: None,
                time_ms: Some(body.start_ms),
                frequency_hz: Some(body.frequency_hz),
            });
            continue;
        }

        points.push(HfieldRustRenderReferencePoint {
            point_id: format!("note_start:{}", body.body_id),
            point_role: "body_start_reference".to_string(),
            label: format!("{} start", body.label),
            x: body.x,
            y: body.y,
            z: body.z_start,
            radius: if body.layer_key == "payload_tone" {
                0.07
            } else {
                0.055
            },
            color_hex: body.color_hex.clone(),
            phase: body.midi_note.map(|midi| midi % 12),
            time_ms: Some(body.start_ms),
            frequency_hz: Some(body.frequency_hz),
        });

        points.push(HfieldRustRenderReferencePoint {
            point_id: format!("note_end:{}", body.body_id),
            point_role: "body_end_reference".to_string(),
            label: format!("{} end", body.label),
            x: body.x,
            y: body.y,
            z: body.z_end,
            radius: if body.layer_key == "payload_tone" {
                0.052
            } else {
                0.045
            },
            color_hex: body.layer_color_hex.clone(),
            phase: body.midi_note.map(|midi| midi % 12),
            time_ms: Some(body.end_ms),
            frequency_hz: Some(body.frequency_hz),
        });
    }

    points
}

fn point3(x: f64, y: f64, z: f64) -> HfieldRustRenderVec3 {
    HfieldRustRenderVec3 {
        x: round4(x),
        y: round4(y),
        z: round4(z),
    }
}

fn phase_anchor_point(
    phase: u8,
    label: &str,
    x: f64,
    y: f64,
    z: f64,
    color_hex: &str,
) -> HfieldRustRenderReferencePoint {
    HfieldRustRenderReferencePoint {
        point_id: format!("phase_anchor:{phase}"),
        point_role: "phase_anchor_reference".to_string(),
        label: label.to_string(),
        x: round4(x),
        y: round4(y),
        z: round4(z),
        radius: if phase == 1 { 0.13 } else { 0.11 },
        color_hex: color_hex.to_string(),
        phase: Some(phase),
        time_ms: None,
        frequency_hz: None,
    }
}

fn render_proof_window(
    label: &str,
    time_ms: u32,
    bodies: &[HfieldRustRenderBody],
) -> HfieldRustRenderProofWindow {
    let active = bodies
        .iter()
        .filter(|body| time_ms >= body.start_ms && time_ms < body.end_ms)
        .collect::<Vec<_>>();

    HfieldRustRenderProofWindow {
        label: label.to_string(),
        time_ms,
        active_payload_count: active
            .iter()
            .filter(|body| body.layer_key == "payload_tone")
            .count(),
        active_runtime_count: active
            .iter()
            .filter(|body| body.layer_key == "runtime_path_carrier")
            .count(),
        active_body_ids: active.iter().map(|body| body.body_id.clone()).collect(),
    }
}

fn render_amplitude(score: &FieldScore, entry: &HarmonicCoordinateEntry) -> f64 {
    if entry.layer == CoordinateLayer::FileIdentityCarrier {
        return 0.5;
    }

    let Some(midi_note) = entry.midi_note else {
        return 0.5;
    };

    for track in &score.music.tracks {
        if track.track_id != entry.track_id {
            continue;
        }

        for note in &track.notes {
            if note.midi_note == midi_note
                && note.start_ms == entry.start_ms
                && note.duration_ms == entry.duration_ms
            {
                return round4(f64::from(note.velocity).clamp(0.0, 1.0));
            }
        }
    }

    0.5
}

fn render_radius_x(layer: &CoordinateLayer, amplitude: f64) -> f64 {
    let value = match layer {
        CoordinateLayer::FileIdentityCarrier => 0.46,
        CoordinateLayer::RuntimePathCarrier => 0.31 + amplitude * 0.2,
        CoordinateLayer::PayloadTone => 0.34 + amplitude * 0.26,
    };

    round4(value)
}

fn render_radius_y(layer: &CoordinateLayer, amplitude: f64) -> f64 {
    let value = match layer {
        CoordinateLayer::FileIdentityCarrier => 0.32,
        CoordinateLayer::RuntimePathCarrier => 0.24 + amplitude * 0.18,
        CoordinateLayer::PayloadTone => 0.25 + amplitude * 0.28,
    };

    round4(value)
}

fn coordinate_layer_key(layer: &CoordinateLayer) -> &'static str {
    match layer {
        CoordinateLayer::FileIdentityCarrier => "file_identity_carrier",
        CoordinateLayer::RuntimePathCarrier => "runtime_path_carrier",
        CoordinateLayer::PayloadTone => "payload_tone",
    }
}

fn vertical_lane_key(lane: &VerticalLane) -> &'static str {
    match lane {
        VerticalLane::Identity => "identity",
        VerticalLane::PayloadLead => "payload_lead",
        VerticalLane::RuntimeDepth => "runtime_depth",
        VerticalLane::RuntimeField => "runtime_field",
        VerticalLane::RuntimeOther => "runtime_other",
    }
}

fn render_role(layer: &CoordinateLayer, lane: &VerticalLane) -> &'static str {
    match (layer, lane) {
        (CoordinateLayer::FileIdentityCarrier, _) => "global file identity body",
        (CoordinateLayer::PayloadTone, VerticalLane::PayloadLead) => "played payload tone body",
        (CoordinateLayer::RuntimePathCarrier, VerticalLane::RuntimeDepth) => {
            "lower runtime path carrier body"
        }
        (CoordinateLayer::RuntimePathCarrier, VerticalLane::RuntimeField) => {
            "upper runtime field carrier body"
        }
        (CoordinateLayer::RuntimePathCarrier, _) => "runtime path carrier body",
        _ => "harmonic field body",
    }
}

#[cfg(test)]
mod render_manifest_tests {
    use super::*;

    fn canonical_score() -> FieldScore {
        serde_json::from_str(include_str!(
            "../../../projects/hcs_canonical_reader_packet_v1.hfield"
        ))
        .expect("canonical reader must parse")
    }

    #[test]
    fn render_manifest_uses_coordinate_registry_without_frontend_guessing() {
        let score = canonical_score();
        let registry = build_harmonic_coordinate_registry(&score);
        let manifest = create_hfield_rust_render_manifest(&score);

        assert_eq!(manifest.contract_id, "aiweb.hfield.rust_render_manifest.v1");
        assert_eq!(manifest.source_coordinate_contract_id, registry.contract_id);
        assert_eq!(manifest.total_duration_ms, 8000);

        let coordinate_c4 = registry
            .entries
            .iter()
            .find(|entry| {
                entry.track_id == "lead_voice"
                    && entry.note_name.as_deref() == Some("C4")
                    && entry.start_ms == 0
            })
            .expect("coordinate C4 must exist");

        let render_c4 = manifest
            .field_bodies
            .iter()
            .find(|body| {
                body.track_id == "lead_voice"
                    && body.note_name.as_deref() == Some("C4")
                    && body.start_ms == 0
            })
            .expect("render C4 must exist");

        assert_eq!(render_c4.x, coordinate_c4.x_pitch_position);
        assert_eq!(render_c4.y, coordinate_c4.y_lane_position);
        assert_eq!(render_c4.z_start, coordinate_c4.z_start_position);
        assert_eq!(render_c4.z_end, coordinate_c4.z_end_position);
        assert_eq!(render_c4.color_hex, coordinate_c4.pitch_color);
    }

    #[test]
    fn render_manifest_preserves_reader_proof_windows() {
        let score = canonical_score();
        let manifest = create_hfield_rust_render_manifest(&score);

        let single = manifest
            .proof_windows
            .iter()
            .find(|window| window.time_ms == 1000)
            .expect("single tone window must exist");
        let two = manifest
            .proof_windows
            .iter()
            .find(|window| window.time_ms == 3000)
            .expect("two tone window must exist");
        let three = manifest
            .proof_windows
            .iter()
            .find(|window| window.time_ms == 5000)
            .expect("three tone window must exist");

        assert_eq!(single.active_payload_count, 1);
        assert_eq!(two.active_payload_count, 1);
        assert_eq!(three.active_payload_count, 1);
        assert!(two.active_runtime_count >= 1);
        assert!(three.active_runtime_count >= 2);
    }

    #[test]
    fn render_manifest_creates_mold_bridge_bodies_from_coordinate_overlap() {
        let score = canonical_score();
        let manifest = create_hfield_rust_render_manifest(&score);

        assert!(!manifest.bridge_bodies.is_empty());
        assert!(manifest
            .bridge_bodies
            .iter()
            .all(|bridge| bridge.overlap_ms > 0 && bridge.z_body_length > 0.0));
    }
}

#[cfg(test)]
mod render_reference_overlay_tests {
    use super::*;

    fn canonical_score() -> FieldScore {
        serde_json::from_str(include_str!(
            "../../../projects/hcs_canonical_reader_packet_v1.hfield"
        ))
        .expect("canonical reader must parse")
    }

    #[test]
    fn render_manifest_exports_conductor_reference_lines() {
        let score = canonical_score();
        let manifest = create_hfield_rust_render_manifest(&score);

        assert!(manifest
            .reference_lines
            .iter()
            .any(|line| line.line_role == "track_conductor_guide"));
        assert!(manifest
            .reference_lines
            .iter()
            .any(|line| line.line_id == "axis:glass_reader_center"));
        assert!(manifest
            .reference_lines
            .iter()
            .all(|line| line.points.len() >= 2));
    }

    #[test]
    fn render_manifest_exports_phase_and_body_reference_points() {
        let score = canonical_score();
        let manifest = create_hfield_rust_render_manifest(&score);

        assert!(manifest
            .reference_points
            .iter()
            .any(|point| point.point_id == "phase_anchor:1"));
        assert!(manifest
            .reference_points
            .iter()
            .any(|point| point.point_id == "phase_anchor:5"));
        assert!(manifest
            .reference_points
            .iter()
            .any(|point| point.point_id == "phase_anchor:9"));
        assert!(manifest
            .reference_points
            .iter()
            .any(|point| point.point_role == "body_start_reference"));
        assert!(manifest
            .reference_points
            .iter()
            .any(|point| point.point_role == "body_end_reference"));
    }
}
