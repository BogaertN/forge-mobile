use serde::{Deserialize, Serialize};

pub const HFIELD_FORMAT_ID: &str = "aiweb.hfield";
pub const HFIELD_VERSION: &str = "0.1.0";
pub const HFIELD_PACKET_CONTRACT_ID: &str = "aiweb.hfield.packet_contract.v1";
pub const HFIELD_IDENTITY_PROVENANCE_CONTRACT_ID: &str =
    "aiweb.hfield.identity_provenance_contract.v1";
pub const DEFAULT_ROOT_FREQUENCY_HZ: f64 = 144.0;
pub const HFIELD_PHASE_COUNT: u8 = 9;
pub const HFIELD_PHASE_ORDER: [u8; 9] = [2, 1, 3, 4, 5, 6, 7, 9, 8];
pub const HFIELD_ANCHOR_LAYOUT_ID: &str = "center_1_lower_5_upper_9";
pub const HARMONIC_FIELD_SCORE_V1_CONTRACT_ID: &str = "aiweb.hfield.harmonic_field_score.v1";
pub const HFIELD_NOTATION_PROBLEM_STATEMENT_ID: &str = "aiweb.hfield.notation_problem_statement.v1";
pub const HFIELD_RENDER_VIEW_REGISTRY_ID: &str = "aiweb.hfield.render_view_registry.v1";
pub const HFIELD_COUPLING_PROFILE_ENGINE_V1_CONTRACT_ID: &str =
    "aiweb.hfield.coupling_profile_engine.v1";
pub const HFIELD_COUPLING_PROFILE_REGISTRY_ID: &str = "aiweb.hfield.coupling_profile_registry.v1";
pub const HFIELD_MOTIF_LIBRARY_ANNOTATION_LAYER_V1_CONTRACT_ID: &str =
    "aiweb.hfield.motif_library_annotation_layer.v1";
pub const HFIELD_MOTIF_LIBRARY_REGISTRY_ID: &str = "aiweb.hfield.motif_library_registry.v1";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FieldScore {
    pub format: String,
    pub version: String,
    #[serde(default)]
    pub packet: HfieldPacketContract,
    #[serde(default)]
    pub provenance: HfieldIdentityProvenanceContract,
    pub title: String,
    pub root_frequency_hz: f64,
    pub anchors: AnchorModel,
    pub gesture_vocabulary: String,
    pub coupling_profile: String,
    pub music: MusicScore,
    pub conductor: ConductedPerformance,
}

impl FieldScore {
    pub fn default_hcs() -> Self {
        Self {
            format: HFIELD_FORMAT_ID.to_string(),
            version: HFIELD_VERSION.to_string(),
            packet: HfieldPacketContract::default(),
            provenance: HfieldIdentityProvenanceContract::default(),
            title: "Untitled Harmonic Conductor Score".to_string(),
            root_frequency_hz: DEFAULT_ROOT_FREQUENCY_HZ,
            anchors: AnchorModel::default(),
            gesture_vocabulary: "nine_gesture_conductor_v0".to_string(),
            coupling_profile: "pitch_preview_v0".to_string(),
            music: MusicScore::default(),
            conductor: ConductedPerformance::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HarmonicFieldScoreV1UpgradeReport {
    pub status: &'static str,
    pub contract_id: &'static str,
    pub problem_statement_id: &'static str,
    pub render_view_registry_id: &'static str,
    pub source_object_role: &'static str,
    pub problem_statement: HarmonicFieldNotationProblemStatement,
    pub authority_boundaries: HarmonicFieldScoreAuthorityBoundaries,
    pub source_layer_count: usize,
    pub source_layers: Vec<HarmonicFieldSourceLayer>,
    pub render_view_count: usize,
    pub render_views: Vec<HarmonicFieldRenderView>,
    pub accessibility_policy: HarmonicFieldAccessibilityPolicy,
    pub current_score_inventory: HarmonicFieldCurrentScoreInventory,
    pub readiness_gates: HarmonicFieldScoreReadinessGates,
    pub next_schema_work: Vec<&'static str>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HarmonicFieldNotationProblemStatement {
    pub summary: &'static str,
    pub chess_notation_lesson: &'static str,
    pub music_notation_lesson: &'static str,
    pub hcs_design_rule: &'static str,
    pub non_goal: &'static str,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HarmonicFieldScoreAuthorityBoundaries {
    pub harmonic_field_score_is_source: bool,
    pub hfield_container_is_persistence_shell: bool,
    pub standard_notation_is_view: bool,
    pub piano_roll_is_view: bool,
    pub tablature_is_view: bool,
    pub audio_is_rendering: bool,
    pub waveform_is_measurement_display: bool,
    pub three_d_field_is_rendering: bool,
    pub cymatic_surface_is_rendering: bool,
    pub forge_bridge_is_adapter: bool,
    pub mutates_forge: bool,
    pub performs_identity_vault_write: bool,
    pub exports_private_identity: bool,
    pub authorizes_health_or_sensor_claims: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HarmonicFieldSourceLayer {
    pub layer_id: &'static str,
    pub owns_source_data: bool,
    pub description: &'static str,
    pub current_binding: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HarmonicFieldRenderView {
    pub view_id: &'static str,
    pub rendering_role: &'static str,
    pub reads_from_layers: Vec<&'static str>,
    pub can_mutate_source_without_save_gate: bool,
    pub problem_addressed: &'static str,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HarmonicFieldAccessibilityPolicy {
    pub principle: &'static str,
    pub supported_or_reserved_views: Vec<&'static str>,
    pub color_is_primary_meaning_channel: bool,
    pub source_data_preserved_across_views: bool,
    pub user_view_choice_must_not_change_score_hash: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HarmonicFieldCurrentScoreInventory {
    pub title: String,
    pub format: String,
    pub version: String,
    pub root_frequency_hz: f64,
    pub anchor_layout_id: String,
    pub phase_order: Vec<u8>,
    pub gesture_vocabulary: String,
    pub coupling_profile: String,
    pub music_track_count: usize,
    pub note_count: usize,
    pub primary_gesture_event_count: usize,
    pub expressive_gesture_event_count: usize,
    pub payload_layer_count: usize,
    pub render_target_count: usize,
    pub packet_contract_id: String,
    pub provenance_contract_id: String,
    pub forge_bridge_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HarmonicFieldScoreReadinessGates {
    pub has_format_id: bool,
    pub has_schema_version: bool,
    pub has_root_frequency: bool,
    pub has_three_anchor_model: bool,
    pub has_nine_phase_order: bool,
    pub has_music_track_layer: bool,
    pub has_conductor_gesture_layer: bool,
    pub has_packet_contract: bool,
    pub has_identity_provenance_contract: bool,
    pub has_render_targets: bool,
    pub has_reference_only_forge_bridge: bool,
    pub current_score_is_harmonic_field_score_v1_candidate: bool,
}

pub fn create_harmonic_field_score_v1_upgrade_report(
    score: &FieldScore,
) -> HarmonicFieldScoreV1UpgradeReport {
    let source_layers = harmonic_field_score_source_layers(score);
    let render_views = harmonic_field_score_render_views();

    HarmonicFieldScoreV1UpgradeReport {
        status: "ok",
        contract_id: HARMONIC_FIELD_SCORE_V1_CONTRACT_ID,
        problem_statement_id: HFIELD_NOTATION_PROBLEM_STATEMENT_ID,
        render_view_registry_id: HFIELD_RENDER_VIEW_REGISTRY_ID,
        source_object_role: "time_based_layered_three_dimensional_harmonic_trajectory_source",
        problem_statement: HarmonicFieldNotationProblemStatement {
            summary: "Traditional notation, piano roll, tab, colour notation, and analytic grids each optimize one reading surface while sacrificing others; HCS must preserve the underlying field once and render many lawful views from it.",
            chess_notation_lesson: "A durable notation standard wins by compactly preserving replayable state, not by describing every perception in prose.",
            music_notation_lesson: "Music notation is a layered compromise between pitch, rhythm, harmony, page economy, ensemble reading, accessibility, and performance context.",
            hcs_design_rule: "Do not trap the living harmonic structure inside one frozen representation; the Harmonic Field Score is source, every display is downstream.",
            non_goal: "This patch does not replace standard notation and does not claim any one visual surface is the final truth.",
        },
        authority_boundaries: HarmonicFieldScoreAuthorityBoundaries {
            harmonic_field_score_is_source: true,
            hfield_container_is_persistence_shell: true,
            standard_notation_is_view: true,
            piano_roll_is_view: true,
            tablature_is_view: true,
            audio_is_rendering: true,
            waveform_is_measurement_display: true,
            three_d_field_is_rendering: true,
            cymatic_surface_is_rendering: true,
            forge_bridge_is_adapter: true,
            mutates_forge: false,
            performs_identity_vault_write: false,
            exports_private_identity: false,
            authorizes_health_or_sensor_claims: false,
        },
        source_layer_count: source_layers.len(),
        source_layers,
        render_view_count: render_views.len(),
        render_views,
        accessibility_policy: HarmonicFieldAccessibilityPolicy {
            principle: "Accessibility views may aid perception, but no accessibility view may become the only source record.",
            supported_or_reserved_views: vec![
                "standard_notation",
                "large_staff_notation_reserved",
                "note_name_overlay_reserved",
                "solfege_noteheads_reserved",
                "color_reinforcement_reserved",
                "braille_export_reserved",
                "jianpu_export_reserved",
                "piano_roll_preview_reserved",
            ],
            color_is_primary_meaning_channel: false,
            source_data_preserved_across_views: true,
            user_view_choice_must_not_change_score_hash: true,
        },
        current_score_inventory: harmonic_field_current_score_inventory(score),
        readiness_gates: harmonic_field_score_readiness_gates(score),
        next_schema_work: vec![
            "promote this report into serialized score metadata after migration fixtures exist",
            "bind render-view registry hash into canonical bundle manifest v2",
            "add source-layer explicit objects without breaking archived .hfield files",
            "add accessibility view descriptors as preferences outside the source hash",
            "later bind Forge trace events as source-adapter references, not renderer guesses",
        ],
    }
}

fn harmonic_field_score_source_layers(score: &FieldScore) -> Vec<HarmonicFieldSourceLayer> {
    vec![
        HarmonicFieldSourceLayer {
            layer_id: "score_identity",
            owns_source_data: true,
            description: "format, version, title, and root identity of the field score",
            current_binding: format!(
                "format={} version={} title={}",
                score.format, score.version, score.title
            ),
        },
        HarmonicFieldSourceLayer {
            layer_id: "frequency_anchor_model",
            owns_source_data: true,
            description: "stable frequency anchors that make movement around the field legible",
            current_binding: format!(
                "a1={} a5={} a9={} root={}Hz",
                score.anchors.anchor_1.ratio,
                score.anchors.anchor_5.ratio,
                score.anchors.anchor_9.ratio,
                score.root_frequency_hz
            ),
        },
        HarmonicFieldSourceLayer {
            layer_id: "nine_phase_geometry",
            owns_source_data: true,
            description: "phase order and anchor layout used by field renderers and conductor scans",
            current_binding: format!(
                "layout={} phase_order={:?}",
                score.conductor.field_layout, HFIELD_PHASE_ORDER
            ),
        },
        HarmonicFieldSourceLayer {
            layer_id: "musical_event_layer",
            owns_source_data: true,
            description: "timed pitch events, durations, velocity, meter, tempo, tuning, and tracks",
            current_binding: format!(
                "tracks={} notes={} tempo={} meter={}",
                score.music.tracks.len(),
                harmonic_field_note_count(score),
                score.music.tempo_bpm,
                score.music.meter
            ),
        },
        HarmonicFieldSourceLayer {
            layer_id: "gesture_motion_layer",
            owns_source_data: true,
            description: "timed conductor gesture events through the G1-G9 physical gesture engine",
            current_binding: format!(
                "vocabulary={} primary_events={} expressive_events={}",
                score.gesture_vocabulary,
                score.conductor.primary_hand_track.events.len(),
                score
                    .conductor
                    .expressive_hand_track
                    .as_ref()
                    .map(|track| track.events.len())
                    .unwrap_or(0)
            ),
        },
        HarmonicFieldSourceLayer {
            layer_id: "coupling_profile_layer",
            owns_source_data: true,
            description: "rules that bind music, gesture, field, and preview renderers without making any renderer source",
            current_binding: score.coupling_profile.clone(),
        },
        HarmonicFieldSourceLayer {
            layer_id: "packet_and_render_contract_layer",
            owns_source_data: true,
            description: "packet payload layers, render targets, and bridge reservations carried by the .hfield packet",
            current_binding: format!(
                "payload_layers={} render_targets={}",
                score.packet.payload_layers.len(),
                score.packet.render_targets.len()
            ),
        },
        HarmonicFieldSourceLayer {
            layer_id: "identity_provenance_layer",
            owns_source_data: true,
            description: "reference-only custody, artifact identity, derivative chain, consent refs, and provenance hash",
            current_binding: format!(
                "custody={} disclosure={} raw_private_identity_exported={}",
                score.provenance.custody_model,
                score.provenance.disclosure_class,
                score.provenance.raw_private_identity_exported
            ),
        },
        HarmonicFieldSourceLayer {
            layer_id: "forge_adapter_reference_layer",
            owns_source_data: true,
            description: "future Forge trace references stay as adapter/custody references until live execution is authorized elsewhere",
            current_binding: format!(
                "status={} bridge_profile={}",
                score.packet.forge_bridge.status, score.packet.forge_bridge.bridge_profile
            ),
        },
    ]
}

fn harmonic_field_score_render_views() -> Vec<HarmonicFieldRenderView> {
    vec![
        HarmonicFieldRenderView {
            view_id: "standard_staff_notation",
            rendering_role: "human_readable_music_view",
            reads_from_layers: vec!["musical_event_layer", "coupling_profile_layer"],
            can_mutate_source_without_save_gate: false,
            problem_addressed: "preserves traditional music literacy without making staff notation the source object",
        },
        HarmonicFieldRenderView {
            view_id: "conductor_path_view",
            rendering_role: "gesture_time_motion_view",
            reads_from_layers: vec!["gesture_motion_layer", "nine_phase_geometry"],
            can_mutate_source_without_save_gate: false,
            problem_addressed: "shows physical G1-G9 movement and ictus/cutoff behavior from score events",
        },
        HarmonicFieldRenderView {
            view_id: "three_dimensional_field_view",
            rendering_role: "spatial_phase_trajectory_view",
            reads_from_layers: vec![
                "frequency_anchor_model",
                "nine_phase_geometry",
                "gesture_motion_layer",
                "musical_event_layer",
            ],
            can_mutate_source_without_save_gate: false,
            problem_addressed: "renders the field trajectory without flattening it into a page-only representation",
        },
        HarmonicFieldRenderView {
            view_id: "audio_preview",
            rendering_role: "audible_rendering",
            reads_from_layers: vec!["musical_event_layer", "gesture_motion_layer", "coupling_profile_layer"],
            can_mutate_source_without_save_gate: false,
            problem_addressed: "lets the score be heard while keeping WAV output downstream of the score",
        },
        HarmonicFieldRenderView {
            view_id: "waveform_and_spectrum_display",
            rendering_role: "measurement_display",
            reads_from_layers: vec!["audio_preview", "musical_event_layer"],
            can_mutate_source_without_save_gate: false,
            problem_addressed: "shows emitted or previewed sound as measurement/display, not source authority",
        },
        HarmonicFieldRenderView {
            view_id: "cymatic_reader_surface",
            rendering_role: "modeled_cymatic_field_view",
            reads_from_layers: vec![
                "frequency_anchor_model",
                "musical_event_layer",
                "gesture_motion_layer",
            ],
            can_mutate_source_without_save_gate: false,
            problem_addressed: "models surface behavior while preserving the distinction between model and measured physics",
        },
        HarmonicFieldRenderView {
            view_id: "piano_roll_preview_reserved",
            rendering_role: "timeline_editor_view_reserved",
            reads_from_layers: vec!["musical_event_layer"],
            can_mutate_source_without_save_gate: false,
            problem_addressed: "allows a DAW-like view later without confusing piano roll with source truth",
        },
        HarmonicFieldRenderView {
            view_id: "forge_packet_adapter_reserved",
            rendering_role: "future_authorized_forge_adapter",
            reads_from_layers: vec![
                "score_identity",
                "packet_and_render_contract_layer",
                "forge_adapter_reference_layer",
            ],
            can_mutate_source_without_save_gate: false,
            problem_addressed: "keeps Forge trace binding as a governed adapter after HCS replay trust exists",
        },
    ]
}

fn harmonic_field_current_score_inventory(
    score: &FieldScore,
) -> HarmonicFieldCurrentScoreInventory {
    HarmonicFieldCurrentScoreInventory {
        title: score.title.clone(),
        format: score.format.clone(),
        version: score.version.clone(),
        root_frequency_hz: score.root_frequency_hz,
        anchor_layout_id: score.conductor.field_layout.clone(),
        phase_order: HFIELD_PHASE_ORDER.to_vec(),
        gesture_vocabulary: score.gesture_vocabulary.clone(),
        coupling_profile: score.coupling_profile.clone(),
        music_track_count: score.music.tracks.len(),
        note_count: harmonic_field_note_count(score),
        primary_gesture_event_count: score.conductor.primary_hand_track.events.len(),
        expressive_gesture_event_count: score
            .conductor
            .expressive_hand_track
            .as_ref()
            .map(|track| track.events.len())
            .unwrap_or(0),
        payload_layer_count: score.packet.payload_layers.len(),
        render_target_count: score.packet.render_targets.len(),
        packet_contract_id: score.packet.contract_id.clone(),
        provenance_contract_id: score.provenance.contract_id.clone(),
        forge_bridge_status: score.packet.forge_bridge.status.clone(),
    }
}

fn harmonic_field_score_readiness_gates(score: &FieldScore) -> HarmonicFieldScoreReadinessGates {
    let has_three_anchor_model = score.anchors.anchor_1.ratio > 0.0
        && score.anchors.anchor_5.ratio > 0.0
        && score.anchors.anchor_9.ratio > 0.0;
    let has_nine_phase_order = HFIELD_PHASE_ORDER.len() == HFIELD_PHASE_COUNT as usize;
    let has_music_track_layer = !score.music.tracks.is_empty();
    let has_conductor_gesture_layer = !score
        .conductor
        .primary_hand_track
        .track_id
        .trim()
        .is_empty();
    let has_packet_contract = score.packet.contract_id == HFIELD_PACKET_CONTRACT_ID;
    let has_identity_provenance_contract =
        score.provenance.contract_id == HFIELD_IDENTITY_PROVENANCE_CONTRACT_ID;
    let has_render_targets = !score.packet.render_targets.is_empty();
    let has_reference_only_forge_bridge = score.packet.forge_bridge.status == "reserved"
        && score.packet.forge_bridge.forge_runtime_ref.is_none()
        && score.packet.forge_bridge.symbolic_trace_ref.is_none()
        && score.packet.forge_bridge.validation_ref.is_none();

    HarmonicFieldScoreReadinessGates {
        has_format_id: score.format == HFIELD_FORMAT_ID,
        has_schema_version: !score.version.trim().is_empty(),
        has_root_frequency: score.root_frequency_hz > 0.0,
        has_three_anchor_model,
        has_nine_phase_order,
        has_music_track_layer,
        has_conductor_gesture_layer,
        has_packet_contract,
        has_identity_provenance_contract,
        has_render_targets,
        has_reference_only_forge_bridge,
        current_score_is_harmonic_field_score_v1_candidate: score.format == HFIELD_FORMAT_ID
            && score.root_frequency_hz > 0.0
            && has_three_anchor_model
            && has_nine_phase_order
            && has_music_track_layer
            && has_conductor_gesture_layer
            && has_packet_contract
            && has_identity_provenance_contract
            && has_render_targets,
    }
}

fn harmonic_field_note_count(score: &FieldScore) -> usize {
    score
        .music
        .tracks
        .iter()
        .map(|track| track.notes.len())
        .sum()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CouplingProfileEngineV1Report {
    pub status: &'static str,
    pub contract_id: &'static str,
    pub registry_id: &'static str,
    pub engine_role: &'static str,
    pub active_profile_id: String,
    pub normalized_profile_id: String,
    pub profile_status: &'static str,
    pub authority_boundaries: CouplingProfileAuthorityBoundaries,
    pub source_inputs: Vec<CouplingSourceInput>,
    pub profile_registry: Vec<CouplingProfileDefinition>,
    pub coupling_laws: Vec<CouplingLaw>,
    pub renderer_bindings: Vec<CouplingRendererBinding>,
    pub open_source_dependency_policy: CouplingOpenSourceDependencyPolicy,
    pub current_score_scan: CouplingProfileScoreScan,
    pub readiness_gates: CouplingProfileReadinessGates,
    pub next_work: Vec<&'static str>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CouplingProfileAuthorityBoundaries {
    pub harmonic_field_score_remains_source: bool,
    pub coupling_profile_is_binding_logic: bool,
    pub renderers_are_downstream: bool,
    pub open_source_libraries_may_render_parse_or_export: bool,
    pub open_source_libraries_are_source_authority: bool,
    pub mutates_forge: bool,
    pub performs_identity_vault_write: bool,
    pub exports_private_identity: bool,
    pub authorizes_health_or_sensor_claims: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CouplingSourceInput {
    pub input_id: &'static str,
    pub source_layer: &'static str,
    pub current_binding: String,
    pub owned_by_harmonic_field_score: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CouplingProfileDefinition {
    pub profile_id: &'static str,
    pub status: &'static str,
    pub legacy_aliases: Vec<&'static str>,
    pub role: &'static str,
    pub source_layers: Vec<&'static str>,
    pub downstream_renderer_targets: Vec<&'static str>,
    pub deterministic_replay_required: bool,
    pub renderer_specific_state_allowed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CouplingLaw {
    pub law_id: &'static str,
    pub description: &'static str,
    pub source_authority: &'static str,
    pub downstream_effect: &'static str,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CouplingRendererBinding {
    pub binding_id: &'static str,
    pub renderer_target: &'static str,
    pub reads_from_layers: Vec<&'static str>,
    pub output_kind: &'static str,
    pub can_mutate_source_without_save_gate: bool,
    pub open_source_help_allowed: Vec<&'static str>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CouplingOpenSourceDependencyPolicy {
    pub principle: &'static str,
    pub allowed_roles: Vec<&'static str>,
    pub forbidden_roles: Vec<&'static str>,
    pub dependency_gates: Vec<&'static str>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CouplingProfileScoreScan {
    pub music_track_count: usize,
    pub note_count: usize,
    pub primary_gesture_event_count: usize,
    pub expressive_gesture_event_count: usize,
    pub render_target_count: usize,
    pub payload_layer_count: usize,
    pub root_frequency_hz: f64,
    pub phase_order: Vec<u8>,
    pub active_profile_id: String,
    pub normalized_profile_id: String,
    pub profile_supported: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CouplingProfileReadinessGates {
    pub has_supported_or_legacy_profile: bool,
    pub has_music_track_layer: bool,
    pub has_conductor_gesture_layer: bool,
    pub has_frequency_anchor_model: bool,
    pub has_nine_phase_geometry: bool,
    pub has_render_targets: bool,
    pub renderers_downstream_only: bool,
    pub source_hash_policy_preserved: bool,
    pub no_live_forge_or_identity_side_effects: bool,
    pub current_score_can_drive_coupling_profile: bool,
}

pub fn create_coupling_profile_engine_v1_report(
    score: &FieldScore,
) -> CouplingProfileEngineV1Report {
    let (normalized_profile_id, profile_status) =
        normalize_coupling_profile_id(&score.coupling_profile);
    let profile_supported = coupling_profile_supported(&score.coupling_profile);
    let source_inputs = coupling_profile_source_inputs(score);
    let profile_registry = coupling_profile_engine_profiles();
    let coupling_laws = coupling_profile_engine_laws();
    let renderer_bindings = coupling_profile_renderer_bindings();
    let readiness_gates = coupling_profile_readiness_gates(score, profile_supported);

    CouplingProfileEngineV1Report {
        status: "ok",
        contract_id: HFIELD_COUPLING_PROFILE_ENGINE_V1_CONTRACT_ID,
        registry_id: HFIELD_COUPLING_PROFILE_REGISTRY_ID,
        engine_role: "deterministic source-to-renderer coupling layer for Harmonic Field Score views",
        active_profile_id: score.coupling_profile.clone(),
        normalized_profile_id: normalized_profile_id.clone(),
        profile_status,
        authority_boundaries: CouplingProfileAuthorityBoundaries {
            harmonic_field_score_remains_source: true,
            coupling_profile_is_binding_logic: true,
            renderers_are_downstream: true,
            open_source_libraries_may_render_parse_or_export: true,
            open_source_libraries_are_source_authority: false,
            mutates_forge: false,
            performs_identity_vault_write: false,
            exports_private_identity: false,
            authorizes_health_or_sensor_claims: false,
        },
        source_inputs,
        profile_registry,
        coupling_laws,
        renderer_bindings,
        open_source_dependency_policy: CouplingOpenSourceDependencyPolicy {
            principle: "Use mature open-source libraries for solved rendering, parsing, analysis, and export surfaces, but never delegate Harmonic Field Score source authority to them.",
            allowed_roles: vec![
                "MusicXML import_export_adapter",
                "MIDI import_export_adapter",
                "notation_layout_renderer",
                "audio_file_encoding",
                "FFT_spectrum_analysis",
                "3D_rendering_helper",
                "accessibility_display_helper",
                "font_and_glyph_layout",
            ],
            forbidden_roles: vec![
                ".hfield_source_authority",
                "Harmonic_Field_Score_schema_authority",
                "Forge_authorization",
                "Identity_Vault_live_write",
                "private_identity_export",
                "health_or_sensor_claim_authority",
            ],
            dependency_gates: vec![
                "license_compatibility",
                "maintenance_activity",
                "rust_tauri_react_fit",
                "local_first_no_cloud_required",
                "no_hidden_data_collection",
                "no_unintended_copyleft_contamination",
                "no_authority_over_hfield_source_object",
            ],
        },
        current_score_scan: CouplingProfileScoreScan {
            music_track_count: score.music.tracks.len(),
            note_count: harmonic_field_note_count(score),
            primary_gesture_event_count: score.conductor.primary_hand_track.events.len(),
            expressive_gesture_event_count: score
                .conductor
                .expressive_hand_track
                .as_ref()
                .map(|track| track.events.len())
                .unwrap_or(0),
            render_target_count: score.packet.render_targets.len(),
            payload_layer_count: score.packet.payload_layers.len(),
            root_frequency_hz: score.root_frequency_hz,
            phase_order: HFIELD_PHASE_ORDER.to_vec(),
            active_profile_id: score.coupling_profile.clone(),
            normalized_profile_id,
            profile_supported,
        },
        readiness_gates,
        next_work: vec![
            "move profile definitions into serialized profile manifests after fixture coverage exists",
            "bind coupling profile registry hash into canonical bundle manifest v2",
            "add MusicXML and MIDI adapter evaluation packet before dependency adoption",
            "add deterministic renderer replay tests that compare source hash to rendered artifact hashes",
            "add user-view preferences outside the source hash so accessibility views do not mutate .hfield truth",
        ],
    }
}

pub fn coupling_profile_engine_profiles() -> Vec<CouplingProfileDefinition> {
    vec![CouplingProfileDefinition {
        profile_id: "pitch_preview_v1",
        status: "current",
        legacy_aliases: vec!["pitch_preview_v0"],
        role: "bind timed musical events, G1-G9 gesture motion, frequency anchors, and render targets into deterministic preview behavior",
        source_layers: vec![
            "musical_event_layer",
            "gesture_motion_layer",
            "frequency_anchor_model",
            "nine_phase_geometry",
            "packet_and_render_contract_layer",
        ],
        downstream_renderer_targets: vec![
            "standard_staff_notation",
            "conductor_path_view",
            "three_dimensional_field_view",
            "audio_preview",
            "waveform_and_spectrum_display",
            "cymatic_reader_surface",
            "piano_roll_preview_reserved",
            "forge_packet_adapter_reserved",
        ],
        deterministic_replay_required: true,
        renderer_specific_state_allowed: false,
    }]
}

fn normalize_coupling_profile_id(profile_id: &str) -> (String, &'static str) {
    if coupling_profile_engine_profiles()
        .iter()
        .any(|profile| profile.profile_id == profile_id)
    {
        return (profile_id.to_string(), "current");
    }

    for profile in coupling_profile_engine_profiles() {
        if profile
            .legacy_aliases
            .iter()
            .any(|alias| alias == &profile_id)
        {
            return (profile.profile_id.to_string(), "legacy_alias_supported");
        }
    }

    (profile_id.to_string(), "unsupported")
}

fn coupling_profile_supported(profile_id: &str) -> bool {
    let (_, status) = normalize_coupling_profile_id(profile_id);
    status == "current" || status == "legacy_alias_supported"
}

fn coupling_profile_source_inputs(score: &FieldScore) -> Vec<CouplingSourceInput> {
    vec![
        CouplingSourceInput {
            input_id: "tempo_meter_timebase",
            source_layer: "musical_event_layer",
            current_binding: format!(
                "tempo={} meter={}",
                score.music.tempo_bpm, score.music.meter
            ),
            owned_by_harmonic_field_score: true,
        },
        CouplingSourceInput {
            input_id: "pitch_and_tuning_events",
            source_layer: "musical_event_layer",
            current_binding: format!(
                "tracks={} notes={} tuning={}",
                score.music.tracks.len(),
                harmonic_field_note_count(score),
                score.music.tuning_mode
            ),
            owned_by_harmonic_field_score: true,
        },
        CouplingSourceInput {
            input_id: "g1_g9_gesture_timeline",
            source_layer: "gesture_motion_layer",
            current_binding: format!(
                "primary_events={} expressive_events={}",
                score.conductor.primary_hand_track.events.len(),
                score
                    .conductor
                    .expressive_hand_track
                    .as_ref()
                    .map(|track| track.events.len())
                    .unwrap_or(0)
            ),
            owned_by_harmonic_field_score: true,
        },
        CouplingSourceInput {
            input_id: "anchor_frequency_model",
            source_layer: "frequency_anchor_model",
            current_binding: format!(
                "root={}Hz a1={} a5={} a9={}",
                score.root_frequency_hz,
                score.anchors.anchor_1.ratio,
                score.anchors.anchor_5.ratio,
                score.anchors.anchor_9.ratio
            ),
            owned_by_harmonic_field_score: true,
        },
        CouplingSourceInput {
            input_id: "render_target_contract",
            source_layer: "packet_and_render_contract_layer",
            current_binding: format!("render_targets={}", score.packet.render_targets.len()),
            owned_by_harmonic_field_score: true,
        },
    ]
}

fn coupling_profile_engine_laws() -> Vec<CouplingLaw> {
    vec![
        CouplingLaw {
            law_id: "source_before_render",
            description: "Renderers must read from Harmonic Field Score source layers through a named coupling profile.",
            source_authority: "Harmonic Field Score v1",
            downstream_effect: "views may render, preview, export, or measure but may not become source truth",
        },
        CouplingLaw {
            law_id: "timebase_alignment",
            description: "Tempo, meter, milliseconds, note durations, and gesture windows must resolve to one replayable timebase.",
            source_authority: "musical_event_layer plus gesture_motion_layer",
            downstream_effect: "notation, audio, conductor path, field view, and cymatic model align to the same score time",
        },
        CouplingLaw {
            law_id: "frequency_anchor_binding",
            description: "Pitch and root-frequency data bind to the 1-5-9 anchor model without replacing the musical event layer.",
            source_authority: "frequency_anchor_model plus musical_event_layer",
            downstream_effect: "audio, 3D field, waveform, spectrum, and cymatic previews share frequency provenance",
        },
        CouplingLaw {
            law_id: "gesture_modulation_binding",
            description: "G1-G9 physical gesture events may modulate preview intensity, field path, and expressive emphasis without locking Forge meaning.",
            source_authority: "Nine-Gesture Conductor Engine v1",
            downstream_effect: "renderers show physical motion and candidate expression while Forge semantics remain unmutated",
        },
        CouplingLaw {
            law_id: "open_source_adapter_boundary",
            description: "Open-source libraries may solve mature parser, renderer, export, and analysis problems behind adapters.",
            source_authority: "HCS dependency gate and .hfield schema",
            downstream_effect: "dependencies can help draw or export views but cannot own .hfield truth",
        },
    ]
}

fn coupling_profile_renderer_bindings() -> Vec<CouplingRendererBinding> {
    vec![
        CouplingRendererBinding {
            binding_id: "notation_binding",
            renderer_target: "standard_staff_notation",
            reads_from_layers: vec!["musical_event_layer", "coupling_profile_layer"],
            output_kind: "human_readable_score_view",
            can_mutate_source_without_save_gate: false,
            open_source_help_allowed: vec!["notation_layout_renderer", "MusicXML_export_adapter"],
        },
        CouplingRendererBinding {
            binding_id: "audio_binding",
            renderer_target: "audio_preview",
            reads_from_layers: vec![
                "musical_event_layer",
                "gesture_motion_layer",
                "frequency_anchor_model",
                "coupling_profile_layer",
            ],
            output_kind: "audible_preview_or_wav_export",
            can_mutate_source_without_save_gate: false,
            open_source_help_allowed: vec!["WAV_encoder", "DSP_helper", "MIDI_export_adapter"],
        },
        CouplingRendererBinding {
            binding_id: "field_binding",
            renderer_target: "three_dimensional_field_view",
            reads_from_layers: vec![
                "frequency_anchor_model",
                "nine_phase_geometry",
                "gesture_motion_layer",
                "musical_event_layer",
            ],
            output_kind: "spatial_field_rendering",
            can_mutate_source_without_save_gate: false,
            open_source_help_allowed: vec!["3D_rendering_helper", "geometry_math_helper"],
        },
        CouplingRendererBinding {
            binding_id: "cymatic_surface_binding",
            renderer_target: "cymatic_reader_surface",
            reads_from_layers: vec![
                "frequency_anchor_model",
                "musical_event_layer",
                "gesture_motion_layer",
            ],
            output_kind: "modeled_cymatic_surface_preview",
            can_mutate_source_without_save_gate: false,
            open_source_help_allowed: vec!["mesh_generation_helper", "FFT_spectrum_analysis"],
        },
        CouplingRendererBinding {
            binding_id: "accessibility_view_binding",
            renderer_target: "accessibility_views_reserved",
            reads_from_layers: vec!["musical_event_layer", "render_view_registry"],
            output_kind: "large_staff_note_name_color_solfege_braille_jianpu_views",
            can_mutate_source_without_save_gate: false,
            open_source_help_allowed: vec![
                "Braille_export_adapter",
                "Jianpu_display_adapter",
                "font_and_glyph_layout",
            ],
        },
        CouplingRendererBinding {
            binding_id: "forge_adapter_binding_reserved",
            renderer_target: "forge_packet_adapter_reserved",
            reads_from_layers: vec![
                "score_identity",
                "packet_and_render_contract_layer",
                "forge_adapter_reference_layer",
            ],
            output_kind: "future_authorized_adapter_packet",
            can_mutate_source_without_save_gate: false,
            open_source_help_allowed: Vec::new(),
        },
    ]
}

fn coupling_profile_readiness_gates(
    score: &FieldScore,
    profile_supported: bool,
) -> CouplingProfileReadinessGates {
    let has_music_track_layer = !score.music.tracks.is_empty();
    let has_conductor_gesture_layer = !score
        .conductor
        .primary_hand_track
        .track_id
        .trim()
        .is_empty();
    let has_frequency_anchor_model = score.root_frequency_hz > 0.0
        && score.anchors.anchor_1.ratio > 0.0
        && score.anchors.anchor_5.ratio > 0.0
        && score.anchors.anchor_9.ratio > 0.0;
    let has_nine_phase_geometry = HFIELD_PHASE_ORDER.len() == HFIELD_PHASE_COUNT as usize
        && score.conductor.field_layout == HFIELD_ANCHOR_LAYOUT_ID;
    let has_render_targets = !score.packet.render_targets.is_empty();
    let no_live_forge_or_identity_side_effects = score.packet.forge_bridge.status == "reserved"
        && score.packet.forge_bridge.forge_runtime_ref.is_none()
        && score.provenance.identity_vault.vault_record_ref.is_none()
        && !score.provenance.raw_private_identity_exported;

    CouplingProfileReadinessGates {
        has_supported_or_legacy_profile: profile_supported,
        has_music_track_layer,
        has_conductor_gesture_layer,
        has_frequency_anchor_model,
        has_nine_phase_geometry,
        has_render_targets,
        renderers_downstream_only: true,
        source_hash_policy_preserved: true,
        no_live_forge_or_identity_side_effects,
        current_score_can_drive_coupling_profile: profile_supported
            && has_music_track_layer
            && has_conductor_gesture_layer
            && has_frequency_anchor_model
            && has_nine_phase_geometry
            && has_render_targets
            && no_live_forge_or_identity_side_effects,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MotifLibraryAnnotationLayerV1Report {
    pub status: &'static str,
    pub contract_id: &'static str,
    pub registry_id: &'static str,
    pub layer_role: &'static str,
    pub authority_boundaries: MotifLayerAuthorityBoundaries,
    pub motif_definition_policy: MotifDefinitionPolicy,
    pub annotation_lifecycle: MotifAnnotationLifecycle,
    pub annotation_classes: Vec<MotifAnnotationClass>,
    pub source_bindings: Vec<MotifSourceBinding>,
    pub motif_candidates: Vec<MotifCandidateReport>,
    pub current_score_scan: MotifCurrentScoreScan,
    pub readiness_gates: MotifLayerReadinessGates,
    pub open_source_dependency_policy: MotifOpenSourceDependencyPolicy,
    pub next_work: Vec<&'static str>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MotifLayerAuthorityBoundaries {
    pub motifs_are_reusable_source_fragments: bool,
    pub annotations_are_attached_metadata: bool,
    pub annotations_are_forge_operational_meaning: bool,
    pub renderers_may_display_motifs: bool,
    pub motif_layer_can_authorize_forge_action: bool,
    pub open_source_pattern_tools_are_source_authority: bool,
    pub mutates_forge: bool,
    pub performs_identity_vault_write: bool,
    pub exports_private_identity: bool,
    pub authorizes_health_or_sensor_claims: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MotifDefinitionPolicy {
    pub motif_id_rule: &'static str,
    pub source_span_rule: &'static str,
    pub reuse_rule: &'static str,
    pub hash_rule: &'static str,
    pub annotation_rule: &'static str,
    pub promotion_rule: &'static str,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MotifAnnotationLifecycle {
    pub default_state: &'static str,
    pub allowed_states: Vec<&'static str>,
    pub discovery_rule: &'static str,
    pub approval_rule: &'static str,
    pub rejection_rule: &'static str,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MotifAnnotationClass {
    pub class_id: &'static str,
    pub purpose: &'static str,
    pub source_authority: &'static str,
    pub can_change_source_hash_without_save_gate: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MotifSourceBinding {
    pub binding_id: &'static str,
    pub source_layer: &'static str,
    pub current_binding: String,
    pub owned_by_harmonic_field_score: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MotifCandidateReport {
    pub candidate_id: String,
    pub motif_kind: &'static str,
    pub annotation_state: &'static str,
    pub source_fragment_scope: &'static str,
    pub track_count: usize,
    pub note_count: usize,
    pub gesture_event_count: usize,
    pub start_ms: u32,
    pub end_ms: u32,
    pub candidate_annotations: Vec<&'static str>,
    pub source_owned_by_hfield: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MotifCurrentScoreScan {
    pub title: String,
    pub format: String,
    pub version: String,
    pub music_track_count: usize,
    pub note_count: usize,
    pub primary_gesture_event_count: usize,
    pub expressive_gesture_event_count: usize,
    pub total_gesture_event_count: usize,
    pub total_duration_ms: u32,
    pub coupling_profile: String,
    pub candidate_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MotifLayerReadinessGates {
    pub has_harmonic_field_score_format: bool,
    pub has_music_or_gesture_source_material: bool,
    pub has_supported_coupling_profile_reference: bool,
    pub has_annotation_lifecycle: bool,
    pub renderers_downstream_only: bool,
    pub no_live_forge_or_identity_side_effects: bool,
    pub current_score_can_drive_motif_layer: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MotifOpenSourceDependencyPolicy {
    pub principle: &'static str,
    pub allowed_roles: Vec<&'static str>,
    pub forbidden_roles: Vec<&'static str>,
    pub dependency_gates: Vec<&'static str>,
}

pub fn create_motif_library_annotation_layer_v1_report(
    score: &FieldScore,
) -> MotifLibraryAnnotationLayerV1Report {
    let motif_candidates = motif_candidate_reports(score);
    let current_score_scan = motif_current_score_scan(score, motif_candidates.len());
    let readiness_gates = motif_layer_readiness_gates(score);

    MotifLibraryAnnotationLayerV1Report {
        status: "ok",
        contract_id: HFIELD_MOTIF_LIBRARY_ANNOTATION_LAYER_V1_CONTRACT_ID,
        registry_id: HFIELD_MOTIF_LIBRARY_REGISTRY_ID,
        layer_role: "governed reusable motif fragments and editable annotation metadata for Harmonic Field Score source material",
        authority_boundaries: MotifLayerAuthorityBoundaries {
            motifs_are_reusable_source_fragments: true,
            annotations_are_attached_metadata: true,
            annotations_are_forge_operational_meaning: false,
            renderers_may_display_motifs: true,
            motif_layer_can_authorize_forge_action: false,
            open_source_pattern_tools_are_source_authority: false,
            mutates_forge: false,
            performs_identity_vault_write: false,
            exports_private_identity: false,
            authorizes_health_or_sensor_claims: false,
        },
        motif_definition_policy: MotifDefinitionPolicy {
            motif_id_rule: "Motif ids must be stable local identifiers that can later be hashed against source spans without depending on a renderer view.",
            source_span_rule: "A motif references a bounded source span from music events, G1-G9 gesture events, coupling profile state, or a coupled combination of those layers.",
            reuse_rule: "Reusable motifs may be copied or referenced across projects only through explicit save/import/export gates.",
            hash_rule: "Motif hashes are reserved until serialized motif fixtures exist; this report is a governance/readiness layer only.",
            annotation_rule: "Annotations describe discovery, interpretation, rehearsal notes, accessibility hints, or candidate semantics without becoming Forge law.",
            promotion_rule: "Discovery candidates may become approved motifs only through a future explicit operator approval gate.",
        },
        annotation_lifecycle: MotifAnnotationLifecycle {
            default_state: "discovery_candidate",
            allowed_states: vec![
                "discovery_candidate",
                "approved_local_motif",
                "rejected_candidate",
                "archived_motif",
                "future_forge_link_reserved",
            ],
            discovery_rule: "Automatic scans may suggest motifs, but suggested motifs are not approved until a later explicit approval gate exists.",
            approval_rule: "Approved local motifs remain HCS-local score knowledge unless later exported through a verified bundle.",
            rejection_rule: "Rejected candidates must remain auditable as rejected metadata if preserved; rejection never deletes source score material.",
        },
        annotation_classes: motif_annotation_classes(),
        source_bindings: motif_source_bindings(score),
        motif_candidates,
        current_score_scan,
        readiness_gates,
        open_source_dependency_policy: MotifOpenSourceDependencyPolicy {
            principle: "Use mature open-source tools for pattern discovery, similarity search, MusicXML/MIDI import, and notation display when useful, but never let those tools own motif truth or .hfield source authority.",
            allowed_roles: vec![
                "pattern_similarity_helper",
                "MIDI_phrase_import_adapter",
                "MusicXML_motif_import_adapter",
                "notation_selection_helper",
                "timeline_region_helper",
                "search_index_helper",
            ],
            forbidden_roles: vec![
                ".hfield_source_authority",
                "motif_truth_authority",
                "Forge_authorization",
                "Identity_Vault_live_write",
                "private_identity_export",
                "health_or_sensor_claim_authority",
            ],
            dependency_gates: vec![
                "license_compatibility",
                "maintenance_activity",
                "local_first_no_cloud_required",
                "deterministic_output_or_recorded_nondeterminism",
                "no_hidden_data_collection",
                "no_authority_over_hfield_source_object",
            ],
        },
        next_work: vec![
            "add serialized motif objects after fixture coverage exists",
            "add operator approval gate for approved_local_motif state",
            "bind motif registry hash into canonical bundle manifest v2",
            "add motif import/export receipts with replay verifier coverage",
            "later allow Forge trace references only as future_forge_link_reserved metadata",
        ],
    }
}

fn motif_annotation_classes() -> Vec<MotifAnnotationClass> {
    vec![
        MotifAnnotationClass {
            class_id: "structural",
            purpose: "labels phrase shape, repetition, sequence, cadence, gesture arc, or field path pattern",
            source_authority: "operator_or_hcs_scan",
            can_change_source_hash_without_save_gate: false,
        },
        MotifAnnotationClass {
            class_id: "expressive",
            purpose: "labels mood, intensity, articulation, dynamic intention, or rehearsal interpretation",
            source_authority: "operator_annotation",
            can_change_source_hash_without_save_gate: false,
        },
        MotifAnnotationClass {
            class_id: "accessibility",
            purpose: "labels helper views such as note-name overlay, large view, color reinforcement, Braille, or Jianpu hints",
            source_authority: "user_view_preference_or_operator_annotation",
            can_change_source_hash_without_save_gate: false,
        },
        MotifAnnotationClass {
            class_id: "candidate_semantic",
            purpose: "stores provisional meaning notes without becoming Forge operational meaning",
            source_authority: "operator_annotation_only_until_future_forge_gate",
            can_change_source_hash_without_save_gate: false,
        },
    ]
}

fn motif_source_bindings(score: &FieldScore) -> Vec<MotifSourceBinding> {
    vec![
        MotifSourceBinding {
            binding_id: "music_phrase_source",
            source_layer: "musical_event_layer",
            current_binding: format!(
                "tracks={} notes={} tempo={} meter={}",
                score.music.tracks.len(),
                harmonic_field_note_count(score),
                score.music.tempo_bpm,
                score.music.meter
            ),
            owned_by_harmonic_field_score: true,
        },
        MotifSourceBinding {
            binding_id: "gesture_phrase_source",
            source_layer: "gesture_motion_layer",
            current_binding: format!(
                "primary_events={} expressive_events={}",
                score.conductor.primary_hand_track.events.len(),
                motif_expressive_gesture_event_count(score)
            ),
            owned_by_harmonic_field_score: true,
        },
        MotifSourceBinding {
            binding_id: "coupled_profile_source",
            source_layer: "coupling_profile_layer",
            current_binding: score.coupling_profile.clone(),
            owned_by_harmonic_field_score: true,
        },
        MotifSourceBinding {
            binding_id: "field_anchor_source",
            source_layer: "frequency_anchor_model",
            current_binding: format!(
                "root={}Hz layout={} phase_order={:?}",
                score.root_frequency_hz, score.conductor.field_layout, HFIELD_PHASE_ORDER
            ),
            owned_by_harmonic_field_score: true,
        },
    ]
}

fn motif_candidate_reports(score: &FieldScore) -> Vec<MotifCandidateReport> {
    let note_count = harmonic_field_note_count(score);
    let primary_gesture_event_count = score.conductor.primary_hand_track.events.len();
    let expressive_gesture_event_count = motif_expressive_gesture_event_count(score);
    let gesture_event_count = primary_gesture_event_count + expressive_gesture_event_count;
    let total_duration_ms = motif_total_duration_ms(score);
    let mut candidates = vec![MotifCandidateReport {
        candidate_id: "score_motif_candidate_1".to_string(),
        motif_kind: "whole_score_summary",
        annotation_state: "discovery_candidate",
        source_fragment_scope: "full_harmonic_field_score",
        track_count: score.music.tracks.len(),
        note_count,
        gesture_event_count,
        start_ms: 0,
        end_ms: total_duration_ms,
        candidate_annotations: vec![
            "project-scale motif",
            "source summary",
            "not renderer authority",
        ],
        source_owned_by_hfield: true,
    }];

    if gesture_event_count > 0 {
        candidates.push(MotifCandidateReport {
            candidate_id: "gesture_phrase_candidate_1".to_string(),
            motif_kind: "gesture_phrase",
            annotation_state: "discovery_candidate",
            source_fragment_scope: "primary_and_expressive_gesture_tracks",
            track_count: 0,
            note_count: 0,
            gesture_event_count,
            start_ms: 0,
            end_ms: total_duration_ms,
            candidate_annotations: vec![
                "G1-G9 gesture arc",
                "conductor motion",
                "operator approval required",
            ],
            source_owned_by_hfield: true,
        });
    }

    if note_count > 0 {
        candidates.push(MotifCandidateReport {
            candidate_id: "music_phrase_candidate_1".to_string(),
            motif_kind: "music_phrase",
            annotation_state: "discovery_candidate",
            source_fragment_scope: "music_tracks",
            track_count: score.music.tracks.len(),
            note_count,
            gesture_event_count: 0,
            start_ms: 0,
            end_ms: total_duration_ms,
            candidate_annotations: vec![
                "timed pitch motif",
                "notation-visible phrase",
                "view-independent source",
            ],
            source_owned_by_hfield: true,
        });
    }

    if note_count > 0 && gesture_event_count > 0 {
        candidates.push(MotifCandidateReport {
            candidate_id: "coupled_music_gesture_candidate_1".to_string(),
            motif_kind: "coupled_music_gesture_phrase",
            annotation_state: "discovery_candidate",
            source_fragment_scope: "music_tracks_plus_conductor_tracks",
            track_count: score.music.tracks.len(),
            note_count,
            gesture_event_count,
            start_ms: 0,
            end_ms: total_duration_ms,
            candidate_annotations: vec![
                "coupled phrase",
                "field-score motif",
                "future approval gate",
            ],
            source_owned_by_hfield: true,
        });
    }

    candidates
}

fn motif_current_score_scan(score: &FieldScore, candidate_count: usize) -> MotifCurrentScoreScan {
    let primary_gesture_event_count = score.conductor.primary_hand_track.events.len();
    let expressive_gesture_event_count = motif_expressive_gesture_event_count(score);
    MotifCurrentScoreScan {
        title: score.title.clone(),
        format: score.format.clone(),
        version: score.version.clone(),
        music_track_count: score.music.tracks.len(),
        note_count: harmonic_field_note_count(score),
        primary_gesture_event_count,
        expressive_gesture_event_count,
        total_gesture_event_count: primary_gesture_event_count + expressive_gesture_event_count,
        total_duration_ms: motif_total_duration_ms(score),
        coupling_profile: score.coupling_profile.clone(),
        candidate_count,
    }
}

fn motif_layer_readiness_gates(score: &FieldScore) -> MotifLayerReadinessGates {
    let has_music_or_gesture_source_material = !score.music.tracks.is_empty()
        || !score
            .conductor
            .primary_hand_track
            .track_id
            .trim()
            .is_empty();
    let has_supported_coupling_profile_reference =
        coupling_profile_supported(&score.coupling_profile);
    let no_live_forge_or_identity_side_effects = score.packet.forge_bridge.status == "reserved"
        && score.packet.forge_bridge.forge_runtime_ref.is_none()
        && score.provenance.identity_vault.vault_record_ref.is_none()
        && !score.provenance.raw_private_identity_exported;

    MotifLayerReadinessGates {
        has_harmonic_field_score_format: score.format == HFIELD_FORMAT_ID,
        has_music_or_gesture_source_material,
        has_supported_coupling_profile_reference,
        has_annotation_lifecycle: true,
        renderers_downstream_only: true,
        no_live_forge_or_identity_side_effects,
        current_score_can_drive_motif_layer: score.format == HFIELD_FORMAT_ID
            && has_music_or_gesture_source_material
            && has_supported_coupling_profile_reference
            && no_live_forge_or_identity_side_effects,
    }
}

fn motif_expressive_gesture_event_count(score: &FieldScore) -> usize {
    score
        .conductor
        .expressive_hand_track
        .as_ref()
        .map(|track| track.events.len())
        .unwrap_or(0)
}

fn motif_total_duration_ms(score: &FieldScore) -> u32 {
    let primary_max = score
        .conductor
        .primary_hand_track
        .events
        .iter()
        .map(|event| event.start_ms.saturating_add(event.duration_ms))
        .max()
        .unwrap_or(0);
    let expressive_max = score
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

    primary_max.max(expressive_max)
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HfieldPacketContract {
    pub contract_id: String,
    pub packet_kind: String,
    pub packet_role: String,
    pub source_system: String,
    pub target_systems: Vec<String>,
    pub analog_bridge_intent: String,
    pub phase_profile: NinePhaseProfile,
    pub payload_layers: Vec<String>,
    pub render_targets: Vec<String>,
    pub forge_bridge: ForgeBridgeDescriptor,
    pub migration_profile: String,
}

impl Default for HfieldPacketContract {
    fn default() -> Self {
        Self {
            contract_id: HFIELD_PACKET_CONTRACT_ID.to_string(),
            packet_kind: "harmonic_symbolic_field_packet".to_string(),
            packet_role: "human_readable_and_forge_bridgeable_source_object".to_string(),
            source_system: "HCS".to_string(),
            target_systems: vec!["HCS".to_string(), "Forge".to_string()],
            analog_bridge_intent: "render_digital_symbolic_state_as_score_sound_gesture_and_field"
                .to_string(),
            phase_profile: NinePhaseProfile::default(),
            payload_layers: vec![
                "score".to_string(),
                "frequency_phase".to_string(),
                "gesture".to_string(),
                "field".to_string(),
                "render".to_string(),
                "forge_bridge".to_string(),
            ],
            render_targets: vec![
                "notation".to_string(),
                "audio".to_string(),
                "conductor_motion".to_string(),
                "three_dimensional_field_reserved".to_string(),
                "cymatic_field_reserved".to_string(),
            ],
            forge_bridge: ForgeBridgeDescriptor::default(),
            migration_profile: "no_migration_required_v1".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NinePhaseProfile {
    pub phase_count: u8,
    pub phase_order: Vec<u8>,
    pub anchor_layout: String,
    pub root_frequency_hz: f64,
    pub communication_mode: String,
}

impl Default for NinePhaseProfile {
    fn default() -> Self {
        Self {
            phase_count: HFIELD_PHASE_COUNT,
            phase_order: HFIELD_PHASE_ORDER.to_vec(),
            anchor_layout: HFIELD_ANCHOR_LAYOUT_ID.to_string(),
            root_frequency_hz: DEFAULT_ROOT_FREQUENCY_HZ,
            communication_mode: "nine_phase_frequency_packet".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ForgeBridgeDescriptor {
    pub status: String,
    pub bridge_profile: String,
    pub forge_runtime_ref: Option<String>,
    pub symbolic_trace_ref: Option<String>,
    pub validation_ref: Option<String>,
}

impl Default for ForgeBridgeDescriptor {
    fn default() -> Self {
        Self {
            status: "reserved".to_string(),
            bridge_profile: "forge_packet_bridge_v0_reserved".to_string(),
            forge_runtime_ref: None,
            symbolic_trace_ref: None,
            validation_ref: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HfieldIdentityProvenanceContract {
    pub contract_id: String,
    pub artifact_id: String,
    pub artifact_kind: String,
    pub custody_model: String,
    pub disclosure_class: String,
    pub identity_vault: IdentityVaultReference,
    pub creator: PrincipalReference,
    pub contributors: Vec<ContributionReference>,
    pub parent_artifacts: Vec<ArtifactReference>,
    pub derivative_chain: Vec<ArtifactReference>,
    pub forge_trace_ref: Option<String>,
    pub memory_capsule_ref: Option<String>,
    pub authority_receipt_ref: Option<String>,
    pub consent_event_ref: Option<String>,
    pub license_ref: Option<String>,
    pub rights_policy_ref: Option<String>,
    pub signature_ref: Option<String>,
    pub provenance_hash: Option<String>,
    pub raw_private_identity_exported: bool,
    pub public_identity_authorized: bool,
    pub economic_processing_authorized: bool,
    pub portable_rights_authorized: bool,
}

impl Default for HfieldIdentityProvenanceContract {
    fn default() -> Self {
        Self {
            contract_id: HFIELD_IDENTITY_PROVENANCE_CONTRACT_ID.to_string(),
            artifact_id: "hfield_artifact_unbound".to_string(),
            artifact_kind: "harmonic_field_packet".to_string(),
            custody_model: "identity_vault_reference_only".to_string(),
            disclosure_class: "private_reference_only".to_string(),
            identity_vault: IdentityVaultReference::default(),
            creator: PrincipalReference::default(),
            contributors: Vec::new(),
            parent_artifacts: Vec::new(),
            derivative_chain: Vec::new(),
            forge_trace_ref: None,
            memory_capsule_ref: None,
            authority_receipt_ref: None,
            consent_event_ref: None,
            license_ref: None,
            rights_policy_ref: None,
            signature_ref: None,
            provenance_hash: None,
            raw_private_identity_exported: false,
            public_identity_authorized: false,
            economic_processing_authorized: false,
            portable_rights_authorized: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct IdentityVaultReference {
    pub status: String,
    pub vault_profile: String,
    pub vault_record_ref: Option<String>,
    pub public_identity_ref: Option<String>,
}

impl Default for IdentityVaultReference {
    fn default() -> Self {
        Self {
            status: "unbound".to_string(),
            vault_profile: "aiweb.identity_vault.reference.v1".to_string(),
            vault_record_ref: None,
            public_identity_ref: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PrincipalReference {
    pub principal_id: Option<String>,
    pub principal_kind: String,
    pub display_label: Option<String>,
    pub identity_vault_ref: Option<String>,
    pub authority_scope: String,
}

impl Default for PrincipalReference {
    fn default() -> Self {
        Self {
            principal_id: None,
            principal_kind: "human_creator".to_string(),
            display_label: None,
            identity_vault_ref: None,
            authority_scope: "creator_unbound_private".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContributionReference {
    pub contributor: PrincipalReference,
    pub contribution_kind: String,
    pub contribution_ref: Option<String>,
    pub contribution_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ArtifactReference {
    pub artifact_id: String,
    pub artifact_kind: String,
    pub relation: String,
    pub proof_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnchorModel {
    pub anchor_1: Anchor,
    pub anchor_5: Anchor,
    pub anchor_9: Anchor,
}

impl Default for AnchorModel {
    fn default() -> Self {
        Self {
            anchor_1: Anchor {
                ratio: 1.0,
                role: "center_home_root_presence".to_string(),
            },
            anchor_5: Anchor {
                ratio: 0.5,
                role: "lower_depth_weight_transformation".to_string(),
            },
            anchor_9: Anchor {
                ratio: 3.0,
                role: "upper_lift_expression_release".to_string(),
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Anchor {
    pub ratio: f64,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MusicScore {
    pub tempo_bpm: f64,
    pub meter: String,
    pub tuning_mode: String,
    pub tracks: Vec<MusicTrack>,
}

impl Default for MusicScore {
    fn default() -> Self {
        Self {
            tempo_bpm: 84.0,
            meter: "4/4".to_string(),
            tuning_mode: "twelve_tone_equal_temperament".to_string(),
            tracks: vec![
                MusicTrack {
                    track_id: "lead_voice".to_string(),
                    role: "melody".to_string(),
                    notes: vec![],
                },
                MusicTrack {
                    track_id: "depth_voice".to_string(),
                    role: "bass_depth".to_string(),
                    notes: vec![],
                },
                MusicTrack {
                    track_id: "field_voice".to_string(),
                    role: "harmonic_field_support".to_string(),
                    notes: vec![],
                },
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MusicTrack {
    pub track_id: String,
    pub role: String,
    pub notes: Vec<NoteEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NoteEvent {
    pub midi_note: u8,
    pub start_ms: u32,
    pub duration_ms: u32,
    pub velocity: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConductedPerformance {
    pub field_layout: String,
    pub primary_hand_track: GestureTrack,
    pub expressive_hand_track: Option<GestureTrack>,
}

impl Default for ConductedPerformance {
    fn default() -> Self {
        Self {
            field_layout: HFIELD_ANCHOR_LAYOUT_ID.to_string(),
            primary_hand_track: GestureTrack {
                track_id: "primary_hand".to_string(),
                events: vec![
                    GestureEvent {
                        gesture_id: "g2".to_string(),
                        start_ms: 0,
                        duration_ms: 180,
                        intensity: 0.35,
                        operator: Some("prepare".to_string()),
                    },
                    GestureEvent {
                        gesture_id: "g1".to_string(),
                        start_ms: 180,
                        duration_ms: 220,
                        intensity: 0.45,
                        operator: Some("ictus".to_string()),
                    },
                    GestureEvent {
                        gesture_id: "g3".to_string(),
                        start_ms: 400,
                        duration_ms: 220,
                        intensity: 0.50,
                        operator: Some("emerge".to_string()),
                    },
                ],
            },
            expressive_hand_track: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GestureTrack {
    pub track_id: String,
    pub events: Vec<GestureEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GestureEvent {
    pub gesture_id: String,
    pub start_ms: u32,
    pub duration_ms: u32,
    pub intensity: f32,
    pub operator: Option<String>,
}

pub const SYLLABLE_SHAPED_EXPRESSION_V1_CONTRACT_ID: &str =
    "aiweb.hfield.syllable_shaped_expression.v1";
pub const SYLLABLE_SHAPED_EXPRESSION_V1_PROFILE_ID: &str = "score_gesture_phrase_syllable_shape_v1";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyllableShapedExpressionV1Report {
    pub status: &'static str,
    pub contract_id: &'static str,
    pub profile_id: &'static str,
    pub expression_role: &'static str,
    pub authority_boundaries: SyllableExpressionAuthorityBoundaries,
    pub expression_policy: SyllableExpressionPolicy,
    pub source_inventory: SyllableExpressionSourceInventory,
    pub expression_unit_count: usize,
    pub expression_units: Vec<SyllableExpressionUnit>,
    pub renderer_bindings: Vec<SyllableExpressionRendererBinding>,
    pub open_source_dependency_policy: SyllableExpressionOpenSourcePolicy,
    pub readiness_gates: SyllableExpressionReadinessGates,
    pub next_work: Vec<&'static str>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyllableExpressionAuthorityBoundaries {
    pub expression_is_downstream_rendering_model: bool,
    pub harmonic_field_score_remains_source: bool,
    pub syllable_shapes_are_language_semantics: bool,
    pub syllable_shapes_are_phoneme_claims: bool,
    pub generates_words_or_lyrics: bool,
    pub renderer_outputs_are_source_authority: bool,
    pub renderer_outputs_are_forge_operational_meaning: bool,
    pub mutates_forge: bool,
    pub performs_identity_vault_write: bool,
    pub exports_private_identity: bool,
    pub authorizes_health_or_sensor_claims: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyllableExpressionPolicy {
    pub unit_model: &'static str,
    pub shape_source: &'static str,
    pub timing_rule: &'static str,
    pub intensity_rule: &'static str,
    pub language_boundary: &'static str,
    pub accessibility_rule: &'static str,
    pub future_voice_rule: &'static str,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyllableExpressionSourceInventory {
    pub title: String,
    pub format: String,
    pub version: String,
    pub root_frequency_hz: f64,
    pub coupling_profile: String,
    pub music_track_count: usize,
    pub note_event_count: usize,
    pub primary_gesture_event_count: usize,
    pub expressive_gesture_event_count: usize,
    pub total_duration_ms: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyllableExpressionUnit {
    pub unit_id: String,
    pub source_kind: &'static str,
    pub source_track_id: String,
    pub source_index: usize,
    pub source_ref: String,
    pub start_ms: u32,
    pub duration_ms: u32,
    pub end_ms: u32,
    pub onset_ms: u32,
    pub nucleus_ms: u32,
    pub release_ms: u32,
    pub intensity: f32,
    pub shape_class: &'static str,
    pub articulation_role: &'static str,
    pub syllable_hint: &'static str,
    pub renderer_rule: &'static str,
    pub semantic_meaning_locked: bool,
    pub forge_authority: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyllableExpressionRendererBinding {
    pub binding_id: &'static str,
    pub source_layer: &'static str,
    pub renderer_rule: &'static str,
    pub downstream_only: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyllableExpressionOpenSourcePolicy {
    pub principle: &'static str,
    pub allowed_roles: Vec<&'static str>,
    pub forbidden_roles: Vec<&'static str>,
    pub dependency_gates: Vec<&'static str>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyllableExpressionReadinessGates {
    pub has_harmonic_field_score: bool,
    pub has_expression_units: bool,
    pub every_unit_has_time_bounds: bool,
    pub every_unit_has_shape_boundary: bool,
    pub no_unit_locks_semantic_meaning: bool,
    pub no_unit_claims_forge_authority: bool,
    pub no_live_forge_or_identity_side_effects: bool,
    pub current_score_can_drive_syllable_shaped_expression_v1: bool,
}

pub fn create_syllable_shaped_expression_v1_report(
    score: &FieldScore,
) -> SyllableShapedExpressionV1Report {
    let mut expression_units = Vec::new();

    for track in &score.music.tracks {
        for (index, note) in track.notes.iter().enumerate() {
            expression_units.push(syllable_expression_unit_from_note(track, note, index + 1));
        }
    }

    for (index, event) in score.conductor.primary_hand_track.events.iter().enumerate() {
        expression_units.push(syllable_expression_unit_from_gesture(
            &score.conductor.primary_hand_track.track_id,
            event,
            index + 1,
            "primary_gesture",
        ));
    }

    if let Some(track) = &score.conductor.expressive_hand_track {
        for (index, event) in track.events.iter().enumerate() {
            expression_units.push(syllable_expression_unit_from_gesture(
                &track.track_id,
                event,
                index + 1,
                "expressive_gesture",
            ));
        }
    }

    expression_units.sort_by(|left, right| {
        left.start_ms
            .cmp(&right.start_ms)
            .then_with(|| left.source_track_id.cmp(&right.source_track_id))
            .then_with(|| left.source_index.cmp(&right.source_index))
    });

    let source_inventory = syllable_expression_source_inventory(score);
    let readiness_gates = syllable_expression_readiness_gates(score, &expression_units);

    SyllableShapedExpressionV1Report {
        status: if readiness_gates.current_score_can_drive_syllable_shaped_expression_v1 {
            "ok"
        } else {
            "warning"
        },
        contract_id: SYLLABLE_SHAPED_EXPRESSION_V1_CONTRACT_ID,
        profile_id: SYLLABLE_SHAPED_EXPRESSION_V1_PROFILE_ID,
        expression_role: "downstream score/gesture expression envelope that shapes phrases into onset, nucleus, and release units without generating lyrics or Forge meaning",
        authority_boundaries: SyllableExpressionAuthorityBoundaries {
            expression_is_downstream_rendering_model: true,
            harmonic_field_score_remains_source: true,
            syllable_shapes_are_language_semantics: false,
            syllable_shapes_are_phoneme_claims: false,
            generates_words_or_lyrics: false,
            renderer_outputs_are_source_authority: false,
            renderer_outputs_are_forge_operational_meaning: false,
            mutates_forge: false,
            performs_identity_vault_write: false,
            exports_private_identity: false,
            authorizes_health_or_sensor_claims: false,
        },
        expression_policy: SyllableExpressionPolicy {
            unit_model: "onset_nucleus_release_envelope",
            shape_source: "music note timing, velocity, and G1-G9 conductor gesture timing",
            timing_rule: "each source event becomes a bounded unit with start, duration, end, onset, nucleus, and release windows",
            intensity_rule: "note velocity or gesture intensity controls expression emphasis but never semantic truth",
            language_boundary: "syllable hints are neutral render labels only; HCS v1 does not generate lyrics, words, translations, or phoneme authority",
            accessibility_rule: "future visual, haptic, caption, and notation helpers may read these units as downstream views",
            future_voice_rule: "future voice/TTS adapters may audition these envelopes only after dependency review and replay receipt gates",
        },
        source_inventory,
        expression_unit_count: expression_units.len(),
        expression_units,
        renderer_bindings: syllable_expression_renderer_bindings(),
        open_source_dependency_policy: syllable_expression_open_source_policy(),
        readiness_gates,
        next_work: vec![
            "bind syllable-shaped expression v1 hash into canonical bundle manifest v2",
            "add renderer replay verifier coverage for syllable expression exports",
            "wire notation/field views to show phrase breath, onset, nucleus, and release overlays",
            "evaluate open-source TTS/phoneme tools only as optional downstream audition helpers",
            "later connect Forge authorized result meaning to expression only through a sealed adapter",
        ],
    }
}

fn syllable_expression_unit_from_note(
    track: &MusicTrack,
    note: &NoteEvent,
    source_index: usize,
) -> SyllableExpressionUnit {
    let envelope = syllable_envelope(note.duration_ms);
    let shape_class = note_shape_class(note.duration_ms, note.velocity);
    let articulation_role = note_articulation_role(track.role.as_str(), note.velocity);

    SyllableExpressionUnit {
        unit_id: format!("{}_note_{}_syllable_shape", track.track_id, source_index),
        source_kind: "music_note",
        source_track_id: track.track_id.clone(),
        source_index,
        source_ref: format!("midi_{}_start_{}", note.midi_note, note.start_ms),
        start_ms: note.start_ms,
        duration_ms: note.duration_ms,
        end_ms: note.start_ms.saturating_add(note.duration_ms),
        onset_ms: envelope.onset_ms,
        nucleus_ms: envelope.nucleus_ms,
        release_ms: envelope.release_ms,
        intensity: note.velocity.clamp(0.0, 1.0),
        shape_class,
        articulation_role,
        syllable_hint: "neutral_tone_syllable",
        renderer_rule:
            "shape the note as a neutral syllabic envelope without creating words or phoneme claims",
        semantic_meaning_locked: false,
        forge_authority: false,
    }
}

fn syllable_expression_unit_from_gesture(
    track_id: &str,
    event: &GestureEvent,
    source_index: usize,
    source_kind: &'static str,
) -> SyllableExpressionUnit {
    let envelope = syllable_envelope(event.duration_ms);
    let metadata = gesture_syllable_metadata(event.gesture_id.as_str());

    SyllableExpressionUnit {
        unit_id: format!(
            "{}_{}_{}_syllable_shape",
            track_id, event.gesture_id, source_index
        ),
        source_kind,
        source_track_id: track_id.to_string(),
        source_index,
        source_ref: format!("{}_start_{}", event.gesture_id, event.start_ms),
        start_ms: event.start_ms,
        duration_ms: event.duration_ms,
        end_ms: event.start_ms.saturating_add(event.duration_ms),
        onset_ms: envelope.onset_ms,
        nucleus_ms: envelope.nucleus_ms,
        release_ms: envelope.release_ms,
        intensity: event.intensity.clamp(0.0, 1.0),
        shape_class: metadata.shape_class,
        articulation_role: metadata.articulation_role,
        syllable_hint: metadata.syllable_hint,
        renderer_rule: metadata.renderer_rule,
        semantic_meaning_locked: false,
        forge_authority: false,
    }
}

#[derive(Debug, Clone, Copy)]
struct SyllableEnvelope {
    onset_ms: u32,
    nucleus_ms: u32,
    release_ms: u32,
}

fn syllable_envelope(duration_ms: u32) -> SyllableEnvelope {
    if duration_ms == 0 {
        return SyllableEnvelope {
            onset_ms: 0,
            nucleus_ms: 0,
            release_ms: 0,
        };
    }

    let onset_ms = ((duration_ms as f32 * 0.18).round() as u32).clamp(1, duration_ms);
    let release_budget = duration_ms.saturating_sub(onset_ms);
    let release_ms = ((duration_ms as f32 * 0.22).round() as u32).min(release_budget);
    let nucleus_ms = duration_ms
        .saturating_sub(onset_ms)
        .saturating_sub(release_ms);

    SyllableEnvelope {
        onset_ms,
        nucleus_ms,
        release_ms,
    }
}

struct GestureSyllableMetadata {
    shape_class: &'static str,
    articulation_role: &'static str,
    syllable_hint: &'static str,
    renderer_rule: &'static str,
}

fn gesture_syllable_metadata(gesture_id: &str) -> GestureSyllableMetadata {
    match gesture_id {
        "g2" | "g4" | "g7" => GestureSyllableMetadata {
            shape_class: "preparatory_breath_shape",
            articulation_role: "breath_before_entry",
            syllable_hint: "breath_marker",
            renderer_rule:
                "render as preparatory breath/approach envelope before the anchor or phrase event",
        },
        "g1" => GestureSyllableMetadata {
            shape_class: "ictus_onset_shape",
            articulation_role: "clear_entry_onset",
            syllable_hint: "onset_marker",
            renderer_rule:
                "render as clean onset/ictus envelope without assigning language meaning",
        },
        "g5" | "g9" => GestureSyllableMetadata {
            shape_class: "held_nucleus_shape",
            articulation_role: "sustain_or_formed_hold",
            syllable_hint: "held_vowel_marker",
            renderer_rule: "render as a sustained nucleus/hold envelope until release is supplied",
        },
        "g3" | "g6" | "g8" => GestureSyllableMetadata {
            shape_class: "release_coda_shape",
            articulation_role: "phrase_release_or_cutoff",
            syllable_hint: "release_marker",
            renderer_rule: "render as coda/release envelope tied to outward or cutoff motion",
        },
        _ => GestureSyllableMetadata {
            shape_class: "unknown_safe_shape",
            articulation_role: "unclassified_event",
            syllable_hint: "neutral_marker",
            renderer_rule: "render as neutral bounded envelope; do not infer language meaning",
        },
    }
}

fn note_shape_class(duration_ms: u32, velocity: f32) -> &'static str {
    if duration_ms <= 160 {
        "short_plosive_pulse"
    } else if duration_ms >= 900 {
        "long_sustained_nucleus"
    } else if velocity >= 0.72 {
        "accented_open_syllable"
    } else {
        "balanced_open_syllable"
    }
}

fn note_articulation_role(role: &str, velocity: f32) -> &'static str {
    match role {
        "bass_depth" => "grounded_depth_vowel",
        "harmonic_field_support" => "supporting_field_vowel",
        "melody" if velocity >= 0.72 => "accented_melodic_syllable",
        "melody" => "melodic_syllable",
        _ => "neutral_score_syllable",
    }
}

fn syllable_expression_source_inventory(score: &FieldScore) -> SyllableExpressionSourceInventory {
    SyllableExpressionSourceInventory {
        title: score.title.clone(),
        format: score.format.clone(),
        version: score.version.clone(),
        root_frequency_hz: score.root_frequency_hz,
        coupling_profile: score.coupling_profile.clone(),
        music_track_count: score.music.tracks.len(),
        note_event_count: syllable_note_count(score),
        primary_gesture_event_count: score.conductor.primary_hand_track.events.len(),
        expressive_gesture_event_count: score
            .conductor
            .expressive_hand_track
            .as_ref()
            .map(|track| track.events.len())
            .unwrap_or(0),
        total_duration_ms: syllable_total_duration_ms(score),
    }
}

fn syllable_note_count(score: &FieldScore) -> usize {
    score
        .music
        .tracks
        .iter()
        .map(|track| track.notes.len())
        .sum()
}

fn syllable_total_duration_ms(score: &FieldScore) -> u32 {
    let note_max = score
        .music
        .tracks
        .iter()
        .flat_map(|track| track.notes.iter())
        .map(|note| note.start_ms.saturating_add(note.duration_ms))
        .max()
        .unwrap_or(0);
    let primary_max = score
        .conductor
        .primary_hand_track
        .events
        .iter()
        .map(|event| event.start_ms.saturating_add(event.duration_ms))
        .max()
        .unwrap_or(0);
    let expressive_max = score
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

    note_max.max(primary_max).max(expressive_max)
}

fn syllable_expression_renderer_bindings() -> Vec<SyllableExpressionRendererBinding> {
    vec![
        SyllableExpressionRendererBinding {
            binding_id: "audio_envelope_binding",
            source_layer: "deterministic_audio_engine_v2",
            renderer_rule: "shape downstream audio attack, sustain, and release by syllable unit boundaries",
            downstream_only: true,
        },
        SyllableExpressionRendererBinding {
            binding_id: "notation_phrase_overlay_binding",
            source_layer: "notation_and_score_views",
            renderer_rule: "show breath, onset, nucleus, and release markers as overlays, not source edits",
            downstream_only: true,
        },
        SyllableExpressionRendererBinding {
            binding_id: "gesture_expression_binding",
            source_layer: "true_conductor_gesture_reference_manifest_v1",
            renderer_rule: "connect G1-G9 gesture timing to expression envelopes without assigning words",
            downstream_only: true,
        },
        SyllableExpressionRendererBinding {
            binding_id: "cymatic_expression_hint_binding",
            source_layer: "cymatic_field_model_v2",
            renderer_rule: "allow phrase pulses to be visualized as model overlays only",
            downstream_only: true,
        },
        SyllableExpressionRendererBinding {
            binding_id: "future_forge_expression_adapter_reserved",
            source_layer: "future_authorized_forge_result_meaning",
            renderer_rule: "reserved adapter only; Forge meaning must arrive sealed and authorized before expression rendering",
            downstream_only: true,
        },
    ]
}

fn syllable_expression_open_source_policy() -> SyllableExpressionOpenSourcePolicy {
    SyllableExpressionOpenSourcePolicy {
        principle: "Use mature open-source speech, phoneme, TTS, accessibility, and notation tools only as downstream helpers; never let them own .hfield source truth or Forge meaning.",
        allowed_roles: vec![
            "speech_audition_helper",
            "phoneme_dictionary_reference_after_boundary_gate",
            "TTS_preview_adapter",
            "caption_display_helper",
            "accessibility_overlay_helper",
            "notation_text_layout_helper",
        ],
        forbidden_roles: vec![
            ".hfield_source_authority",
            "Harmonic_Field_Score_schema_authority",
            "Forge_semantic_authority",
            "Identity_Vault_live_write",
            "private_identity_export",
            "health_or_sensor_claim_authority",
            "lyric_generation_authority_without_user_input",
        ],
        dependency_gates: vec![
            "license_compatibility",
            "maintenance_activity",
            "local_first_no_cloud_required",
            "no_hidden_data_collection",
            "deterministic_or_receipted_output",
            "no_authority_over_hfield_source_object",
        ],
    }
}

fn syllable_expression_readiness_gates(
    score: &FieldScore,
    units: &[SyllableExpressionUnit],
) -> SyllableExpressionReadinessGates {
    let has_harmonic_field_score = score.format == HFIELD_FORMAT_ID;
    let has_expression_units = !units.is_empty();
    let every_unit_has_time_bounds = units.iter().all(|unit| {
        unit.end_ms >= unit.start_ms && unit.duration_ms == unit.end_ms - unit.start_ms
    });
    let every_unit_has_shape_boundary = units.iter().all(|unit| {
        unit.onset_ms
            .saturating_add(unit.nucleus_ms)
            .saturating_add(unit.release_ms)
            == unit.duration_ms
            && !unit.shape_class.trim().is_empty()
            && !unit.articulation_role.trim().is_empty()
    });
    let no_unit_locks_semantic_meaning = units.iter().all(|unit| !unit.semantic_meaning_locked);
    let no_unit_claims_forge_authority = units.iter().all(|unit| !unit.forge_authority);
    let no_live_forge_or_identity_side_effects = score.packet.forge_bridge.status == "reserved"
        && score.packet.forge_bridge.forge_runtime_ref.is_none()
        && score.provenance.identity_vault.vault_record_ref.is_none()
        && !score.provenance.raw_private_identity_exported;

    SyllableExpressionReadinessGates {
        has_harmonic_field_score,
        has_expression_units,
        every_unit_has_time_bounds,
        every_unit_has_shape_boundary,
        no_unit_locks_semantic_meaning,
        no_unit_claims_forge_authority,
        no_live_forge_or_identity_side_effects,
        current_score_can_drive_syllable_shaped_expression_v1: has_harmonic_field_score
            && has_expression_units
            && every_unit_has_time_bounds
            && every_unit_has_shape_boundary
            && no_unit_locks_semantic_meaning
            && no_unit_claims_forge_authority
            && no_live_forge_or_identity_side_effects,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_score_uses_hfield_format() {
        let score = FieldScore::default_hcs();
        assert_eq!(score.format, HFIELD_FORMAT_ID);
        assert_eq!(score.root_frequency_hz, 144.0);
        assert_eq!(score.conductor.field_layout, "center_1_lower_5_upper_9");
    }

    #[test]
    fn default_score_has_packet_contract() {
        let score = FieldScore::default_hcs();
        assert_eq!(score.packet.contract_id, HFIELD_PACKET_CONTRACT_ID);
        assert_eq!(score.packet.phase_profile.phase_count, 9);
        assert_eq!(
            score.packet.phase_profile.phase_order,
            vec![2, 1, 3, 4, 5, 6, 7, 9, 8]
        );
        assert!(score
            .packet
            .target_systems
            .iter()
            .any(|target| target == "Forge"));
    }

    #[test]
    fn default_score_has_identity_provenance_contract() {
        let score = FieldScore::default_hcs();
        assert_eq!(
            score.provenance.contract_id,
            HFIELD_IDENTITY_PROVENANCE_CONTRACT_ID
        );
        assert_eq!(score.provenance.artifact_kind, "harmonic_field_packet");
        assert_eq!(
            score.provenance.custody_model,
            "identity_vault_reference_only"
        );
        assert_eq!(score.provenance.disclosure_class, "private_reference_only");
        assert!(!score.provenance.raw_private_identity_exported);
        assert!(!score.provenance.public_identity_authorized);
        assert!(!score.provenance.economic_processing_authorized);
        assert!(!score.provenance.portable_rights_authorized);
    }

    #[test]
    fn old_hfield_json_without_packet_defaults_contract() {
        let old_json = r#"{
            "format":"aiweb.hfield",
            "version":"0.1.0",
            "title":"Old Packet",
            "root_frequency_hz":144.0,
            "anchors":{
                "anchor_1":{"ratio":1.0,"role":"center_home_root_presence"},
                "anchor_5":{"ratio":0.5,"role":"lower_depth_weight_transformation"},
                "anchor_9":{"ratio":3.0,"role":"upper_lift_expression_release"}
            },
            "gesture_vocabulary":"nine_gesture_conductor_v0",
            "coupling_profile":"pitch_preview_v0",
            "music":{"tempo_bpm":84.0,"meter":"4/4","tuning_mode":"twelve_tone_equal_temperament","tracks":[]},
            "conductor":{"field_layout":"center_1_lower_5_upper_9","primary_hand_track":{"track_id":"primary_hand","events":[]},"expressive_hand_track":null}
        }"#;

        let score: FieldScore = serde_json::from_str(old_json).expect("old .hfield parses");
        assert_eq!(score.packet.contract_id, HFIELD_PACKET_CONTRACT_ID);
        assert_eq!(score.packet.phase_profile.phase_count, 9);
        assert_eq!(
            score.provenance.contract_id,
            HFIELD_IDENTITY_PROVENANCE_CONTRACT_ID
        );
        assert_eq!(score.provenance.disclosure_class, "private_reference_only");
    }

    #[test]
    fn harmonic_field_score_v1_report_keeps_source_and_renderings_separate() {
        let report = create_harmonic_field_score_v1_upgrade_report(&FieldScore::default_hcs());

        assert_eq!(report.contract_id, HARMONIC_FIELD_SCORE_V1_CONTRACT_ID);
        assert!(report.authority_boundaries.harmonic_field_score_is_source);
        assert!(report.authority_boundaries.standard_notation_is_view);
        assert!(report.authority_boundaries.piano_roll_is_view);
        assert!(report.authority_boundaries.audio_is_rendering);
        assert!(report.authority_boundaries.three_d_field_is_rendering);
        assert!(report.authority_boundaries.forge_bridge_is_adapter);
        assert!(!report.authority_boundaries.mutates_forge);
        assert!(!report.authority_boundaries.performs_identity_vault_write);
        assert!(!report.authority_boundaries.exports_private_identity);

        assert!(report
            .source_layers
            .iter()
            .any(|layer| layer.layer_id == "gesture_motion_layer" && layer.owns_source_data));
        assert!(report
            .render_views
            .iter()
            .any(|view| view.view_id == "standard_staff_notation"
                && !view.can_mutate_source_without_save_gate));
    }

    #[test]
    fn harmonic_field_score_v1_report_uses_current_score_inventory() {
        let score = FieldScore::default_hcs();
        let report = create_harmonic_field_score_v1_upgrade_report(&score);

        assert!((report.current_score_inventory.root_frequency_hz - 144.0).abs() < f64::EPSILON);
        assert_eq!(report.current_score_inventory.music_track_count, 3);
        assert_eq!(
            report.current_score_inventory.primary_gesture_event_count,
            3
        );
        assert!(
            report
                .readiness_gates
                .current_score_is_harmonic_field_score_v1_candidate
        );
        assert_eq!(report.source_layer_count, report.source_layers.len());
        assert_eq!(report.render_view_count, report.render_views.len());
        assert!(
            report
                .accessibility_policy
                .source_data_preserved_across_views
        );
    }

    #[test]
    fn coupling_profile_engine_v1_accepts_legacy_pitch_preview_alias() {
        let report = create_coupling_profile_engine_v1_report(&FieldScore::default_hcs());

        assert_eq!(
            report.contract_id,
            HFIELD_COUPLING_PROFILE_ENGINE_V1_CONTRACT_ID
        );
        assert_eq!(report.active_profile_id, "pitch_preview_v0");
        assert_eq!(report.normalized_profile_id, "pitch_preview_v1");
        assert_eq!(report.profile_status, "legacy_alias_supported");
        assert!(report.current_score_scan.profile_supported);
        assert!(report.readiness_gates.has_supported_or_legacy_profile);
        assert!(
            report
                .readiness_gates
                .current_score_can_drive_coupling_profile
        );
    }

    #[test]
    fn coupling_profile_engine_v1_keeps_renderers_and_open_source_downstream() {
        let report = create_coupling_profile_engine_v1_report(&FieldScore::default_hcs());

        assert!(
            report
                .authority_boundaries
                .harmonic_field_score_remains_source
        );
        assert!(
            report
                .authority_boundaries
                .coupling_profile_is_binding_logic
        );
        assert!(report.authority_boundaries.renderers_are_downstream);
        assert!(
            report
                .authority_boundaries
                .open_source_libraries_may_render_parse_or_export
        );
        assert!(
            !report
                .authority_boundaries
                .open_source_libraries_are_source_authority
        );
        assert!(!report.authority_boundaries.mutates_forge);
        assert!(!report.authority_boundaries.performs_identity_vault_write);
        assert!(!report.authority_boundaries.exports_private_identity);

        assert!(report
            .renderer_bindings
            .iter()
            .all(|binding| !binding.can_mutate_source_without_save_gate));
        assert!(report
            .open_source_dependency_policy
            .forbidden_roles
            .contains(&".hfield_source_authority"));
        assert!(report
            .coupling_laws
            .iter()
            .any(|law| law.law_id == "open_source_adapter_boundary"));
    }

    #[test]
    fn motif_layer_v1_keeps_annotations_out_of_forge_authority() {
        let report = create_motif_library_annotation_layer_v1_report(&FieldScore::default_hcs());

        assert_eq!(
            report.contract_id,
            HFIELD_MOTIF_LIBRARY_ANNOTATION_LAYER_V1_CONTRACT_ID
        );
        assert!(
            report
                .authority_boundaries
                .motifs_are_reusable_source_fragments
        );
        assert!(
            report
                .authority_boundaries
                .annotations_are_attached_metadata
        );
        assert!(
            !report
                .authority_boundaries
                .annotations_are_forge_operational_meaning
        );
        assert!(
            !report
                .authority_boundaries
                .motif_layer_can_authorize_forge_action
        );
        assert!(!report.authority_boundaries.mutates_forge);
        assert!(!report.authority_boundaries.performs_identity_vault_write);
        assert!(!report.authority_boundaries.exports_private_identity);
        assert!(
            !report
                .authority_boundaries
                .open_source_pattern_tools_are_source_authority
        );
    }

    #[test]
    fn motif_layer_v1_scans_current_score_for_reusable_candidates() {
        let report = create_motif_library_annotation_layer_v1_report(&FieldScore::default_hcs());

        assert!(report.current_score_scan.candidate_count >= 1);
        assert_eq!(
            report.current_score_scan.candidate_count,
            report.motif_candidates.len()
        );
        assert!(report
            .motif_candidates
            .iter()
            .all(|candidate| candidate.source_owned_by_hfield));
        assert!(report.readiness_gates.current_score_can_drive_motif_layer);
        assert!(report
            .annotation_lifecycle
            .allowed_states
            .contains(&"approved_local_motif"));
        assert!(report
            .open_source_dependency_policy
            .forbidden_roles
            .contains(&"motif_truth_authority"));
    }

    #[test]
    fn syllable_shaped_expression_v1_creates_units_from_current_score() {
        let report = create_syllable_shaped_expression_v1_report(&FieldScore::default_hcs());

        assert_eq!(
            report.contract_id,
            SYLLABLE_SHAPED_EXPRESSION_V1_CONTRACT_ID
        );
        assert!(report.expression_unit_count >= 1);
        assert_eq!(report.expression_unit_count, report.expression_units.len());
        assert!(report
            .expression_units
            .iter()
            .any(|unit| unit.source_kind == "primary_gesture"));
        assert!(report
            .expression_units
            .iter()
            .all(|unit| unit.onset_ms + unit.nucleus_ms + unit.release_ms == unit.duration_ms));
        assert!(
            report
                .readiness_gates
                .current_score_can_drive_syllable_shaped_expression_v1
        );
    }

    #[test]
    fn syllable_shaped_expression_v1_stays_downstream_and_out_of_language_authority() {
        let report = create_syllable_shaped_expression_v1_report(&FieldScore::default_hcs());

        assert!(
            report
                .authority_boundaries
                .expression_is_downstream_rendering_model
        );
        assert!(
            report
                .authority_boundaries
                .harmonic_field_score_remains_source
        );
        assert!(
            !report
                .authority_boundaries
                .syllable_shapes_are_language_semantics
        );
        assert!(
            !report
                .authority_boundaries
                .syllable_shapes_are_phoneme_claims
        );
        assert!(!report.authority_boundaries.generates_words_or_lyrics);
        assert!(
            !report
                .authority_boundaries
                .renderer_outputs_are_forge_operational_meaning
        );
        assert!(!report.authority_boundaries.mutates_forge);
        assert!(!report.authority_boundaries.performs_identity_vault_write);
        assert!(!report.authority_boundaries.exports_private_identity);
        assert!(report
            .expression_units
            .iter()
            .all(|unit| !unit.semantic_meaning_locked && !unit.forge_authority));
    }
}
