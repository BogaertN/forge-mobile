use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GestureDefinition {
    pub id: &'static str,
    pub display_order: u8,
    pub name: &'static str,
    pub field_region: &'static str,
    pub anchor: &'static str,
    pub physical_action: &'static str,
    pub candidate_association: &'static str,
}

pub fn nine_gesture_vocabulary() -> Vec<GestureDefinition> {
    vec![
        GestureDefinition {
            id: "g2",
            display_order: 1,
            name: "Inward Opening",
            field_region: "center",
            anchor: "anchor_1",
            physical_action: "approach the receptive side of the center root field",
            candidate_association: "prepare, listen, open, receive",
        },
        GestureDefinition {
            id: "g1",
            display_order: 2,
            name: "Root Settle",
            field_region: "center",
            anchor: "anchor_1",
            physical_action: "settle into center home/root presence",
            candidate_association: "home, identity, return, baseline",
        },
        GestureDefinition {
            id: "g3",
            display_order: 3,
            name: "Emergent Extension",
            field_region: "center",
            anchor: "anchor_1",
            physical_action: "extend outward from center into active motion",
            candidate_association: "begin, emerge, initiate, brighten",
        },
        GestureDefinition {
            id: "g4",
            display_order: 4,
            name: "Constraint Entry",
            field_region: "lower",
            anchor: "anchor_5",
            physical_action: "descend into the constrained side of the lower depth field",
            candidate_association: "friction, question, compression, unresolved weight",
        },
        GestureDefinition {
            id: "g5",
            display_order: 5,
            name: "Transformation Hold",
            field_region: "lower",
            anchor: "anchor_5",
            physical_action: "hold or orbit around lower depth/transformation",
            candidate_association: "processing, weight, emotion, transformation",
        },
        GestureDefinition {
            id: "g6",
            display_order: 6,
            name: "Resolving Release",
            field_region: "lower",
            anchor: "anchor_5",
            physical_action: "release outward from lower depth toward center or lift",
            candidate_association: "correction, recovery, release, clarification",
        },
        GestureDefinition {
            id: "g7",
            display_order: 7,
            name: "Expression Binding",
            field_region: "upper",
            anchor: "anchor_9",
            physical_action: "gather into the inward side of the upper expression field",
            candidate_association: "name, bind, prepare expression",
        },
        GestureDefinition {
            id: "g9",
            display_order: 8,
            name: "Formed Expression Hold",
            field_region: "upper",
            anchor: "anchor_9",
            physical_action: "hold completed expression in the upper field",
            candidate_association: "formed output, readiness, completion",
        },
        GestureDefinition {
            id: "g8",
            display_order: 9,
            name: "Outward Emission",
            field_region: "upper",
            anchor: "anchor_9",
            physical_action: "emit outward from the upper expression field",
            candidate_association: "deliver, project, release outward",
        },
    ]
}

pub fn is_valid_gesture_id(id: &str) -> bool {
    nine_gesture_vocabulary().iter().any(|g| g.id == id)
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NineGestureConductorEngineReport {
    pub status: &'static str,
    pub contract_id: &'static str,
    pub gesture_vocabulary_id: &'static str,
    pub engine_role: &'static str,
    pub source_score_gesture_vocabulary: String,
    pub field_layout_id: String,
    pub root_frequency_hz: f64,
    pub research_basis: NineGestureResearchBasis,
    pub authority_boundaries: NineGestureAuthorityBoundaries,
    pub field_geometry: NineGestureFieldGeometry,
    pub conducting_law: ConductingLawSummary,
    pub primitive_count: usize,
    pub primitives: Vec<NineGesturePrimitive>,
    pub current_score_scan: NineGestureScoreScan,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NineGestureResearchBasis {
    pub hcs_architecture_ruling: &'static str,
    pub public_conducting_manual_basis: Vec<&'static str>,
    pub boundary_rule: &'static str,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NineGestureAuthorityBoundaries {
    pub physical_definition_is_core_logic: bool,
    pub candidate_interpretation_is_editable: bool,
    pub forge_operational_meaning_locked: bool,
    pub mutates_forge: bool,
    pub performs_identity_vault_write: bool,
    pub exports_private_identity: bool,
    pub authorizes_health_or_sensor_claims: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NineGestureFieldGeometry {
    pub layout_id: &'static str,
    pub conductor_order: Vec<&'static str>,
    pub spatial_rows: Vec<Vec<&'static str>>,
    pub anchor_gestures: Vec<&'static str>,
    pub orbit_gestures: Vec<&'static str>,
    pub anchor_frequency_ratios: Vec<AnchorFrequencyRatio>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnchorFrequencyRatio {
    pub anchor: &'static str,
    pub gesture_id: &'static str,
    pub role: &'static str,
    pub ratio_to_root: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConductingLawSummary {
    pub downbeat_rule: &'static str,
    pub ictus_rule: &'static str,
    pub preparatory_beat_rule: &'static str,
    pub cutoff_rule: &'static str,
    pub pickup_rule: &'static str,
    pub fermata_rule: &'static str,
    pub style_rule: &'static str,
    pub dynamic_rule: &'static str,
    pub left_hand_rule: &'static str,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NineGesturePrimitive {
    pub gesture_id: &'static str,
    pub display_order: u8,
    pub name: &'static str,
    pub anchor: &'static str,
    pub anchor_role: &'static str,
    pub field_row: &'static str,
    pub physical_definition: &'static str,
    pub motion_family: &'static str,
    pub conductor_technique_basis: Vec<&'static str>,
    pub candidate_annotations: Vec<&'static str>,
    pub interpretation_status: &'static str,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NineGestureScoreScan {
    pub event_count: usize,
    pub invalid_event_count: usize,
    pub total_duration_ms: u32,
    pub uses_all_nine_gestures: bool,
    pub observed_gesture_ids: Vec<String>,
    pub event_reports: Vec<NineGestureEventReport>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NineGestureEventReport {
    pub event_index: usize,
    pub gesture_id: String,
    pub valid: bool,
    pub primitive_name: String,
    pub physical_definition: String,
    pub candidate_annotations: Vec<String>,
    pub start_ms: u32,
    pub duration_ms: u32,
    pub end_ms: u32,
    pub intensity: f32,
    pub operator: Option<String>,
}

pub fn nine_gesture_engine_primitives() -> Vec<NineGesturePrimitive> {
    vec![
        NineGesturePrimitive {
            gesture_id: "g2",
            display_order: 1,
            name: "Inward Opening",
            anchor: "anchor_1",
            anchor_role: "root_presence_receptive_side",
            field_row: "root_row",
            physical_definition: "approach the receptive side of anchor_1 without claiming final meaning",
            motion_family: "preparatory_approach",
            conductor_technique_basis: vec!["preparatory_beat", "pickup_preparation", "simple_visible_motion"],
            candidate_annotations: vec!["listening", "opening", "receiving", "distinguishing signal from silence"],
            interpretation_status: "candidate_annotation_only_not_forge_law",
        },
        NineGesturePrimitive {
            gesture_id: "g1",
            display_order: 2,
            name: "Root Settle",
            anchor: "anchor_1",
            anchor_role: "root_presence_anchor",
            field_row: "root_row",
            physical_definition: "converge into and stabilize at anchor_1 as the root settling point",
            motion_family: "settle_ictus_hold",
            conductor_technique_basis: vec!["downbeat", "ictus", "steady_fundamental_beat"],
            candidate_annotations: vec!["presence", "centering", "beginning", "returning to baseline"],
            interpretation_status: "candidate_annotation_only_not_forge_law",
        },
        NineGesturePrimitive {
            gesture_id: "g3",
            display_order: 3,
            name: "Emergent Extension",
            anchor: "anchor_1",
            anchor_role: "root_presence_outward_side",
            field_row: "root_row",
            physical_definition: "move outward from anchor_1 toward active expression or the middle field",
            motion_family: "outward_extension",
            conductor_technique_basis: vec!["upbeat", "smooth_pattern_continuation", "phrase_beginning"],
            candidate_annotations: vec!["motion beginning", "intention", "expansion", "first outward articulation"],
            interpretation_status: "candidate_annotation_only_not_forge_law",
        },
        NineGesturePrimitive {
            gesture_id: "g4",
            display_order: 4,
            name: "Constraint Entry",
            anchor: "anchor_5",
            anchor_role: "transformation_inward_side",
            field_row: "transformation_row",
            physical_definition: "move inward toward the constrained side of anchor_5",
            motion_family: "constraint_entry",
            conductor_technique_basis: vec!["controlled_dip", "smaller_pattern_under_constraint", "held_tension"],
            candidate_annotations: vec!["friction", "uncertainty", "question", "compression", "approaching difficulty"],
            interpretation_status: "candidate_annotation_only_not_forge_law",
        },
        NineGesturePrimitive {
            gesture_id: "g5",
            display_order: 5,
            name: "Transformation Hold",
            anchor: "anchor_5",
            anchor_role: "transformation_anchor",
            field_row: "transformation_row",
            physical_definition: "stabilize or orbit around anchor_5 as the transformation holding point",
            motion_family: "processing_hold",
            conductor_technique_basis: vec!["hold", "fermata_readiness", "sustained_phrase_support"],
            candidate_annotations: vec!["processing", "concentration", "comparison", "held tension", "transformation"],
            interpretation_status: "candidate_annotation_only_not_forge_law",
        },
        NineGesturePrimitive {
            gesture_id: "g6",
            display_order: 6,
            name: "Resolving Release",
            anchor: "anchor_5",
            anchor_role: "transformation_outward_side",
            field_row: "transformation_row",
            physical_definition: "move outward from anchor_5 toward stabilization or expression",
            motion_family: "release_from_constraint",
            conductor_technique_basis: vec!["cutoff_tail_as_preparation", "resolution_motion", "return_to_steady_pattern"],
            candidate_annotations: vec!["correction", "clarity", "relief", "transition out of tension"],
            interpretation_status: "candidate_annotation_only_not_forge_law",
        },
        NineGesturePrimitive {
            gesture_id: "g7",
            display_order: 7,
            name: "Expression Binding",
            anchor: "anchor_9",
            anchor_role: "expression_inward_side",
            field_row: "expression_row",
            physical_definition: "approach the inward side of anchor_9 before a formed expression is delivered",
            motion_family: "expression_gathering",
            conductor_technique_basis: vec!["left_hand_cue", "preparatory_expression", "phrase_gathering"],
            candidate_annotations: vec!["naming", "gathering", "preparing a formed phrase", "binding an expression before delivery"],
            interpretation_status: "candidate_annotation_only_not_forge_law",
        },
        NineGesturePrimitive {
            gesture_id: "g9",
            display_order: 8,
            name: "Formed Expression Hold",
            anchor: "anchor_9",
            anchor_role: "expression_anchor",
            field_row: "expression_row",
            physical_definition: "stabilize at anchor_9 as the formed-expression holding point",
            motion_family: "formed_expression_hold",
            conductor_technique_basis: vec!["sustained_hold", "phrase_completion", "readiness_before_release"],
            candidate_annotations: vec!["completed phrase", "coherent formed output", "readiness before release"],
            interpretation_status: "candidate_annotation_only_not_forge_law",
        },
        NineGesturePrimitive {
            gesture_id: "g8",
            display_order: 9,
            name: "Outward Emission",
            anchor: "anchor_9",
            anchor_role: "expression_outward_side",
            field_row: "expression_row",
            physical_definition: "release outward from anchor_9 into visible, audible, or later authorized expression",
            motion_family: "outward_emission",
            conductor_technique_basis: vec!["final_cutoff_release", "projected_phrase_end", "definite_bounce"],
            candidate_annotations: vec!["delivery", "projection", "external expression", "audible discharge"],
            interpretation_status: "candidate_annotation_only_not_forge_law",
        },
    ]
}

pub fn nine_gesture_engine_primitive(id: &str) -> Option<NineGesturePrimitive> {
    nine_gesture_engine_primitives()
        .into_iter()
        .find(|primitive| primitive.gesture_id == id)
}

pub fn create_nine_gesture_conductor_engine_report(
    score: &hfield_domain::FieldScore,
) -> NineGestureConductorEngineReport {
    let primitives = nine_gesture_engine_primitives();
    let mut observed_gesture_ids: Vec<String> = Vec::new();
    let mut invalid_event_count = 0usize;
    let event_reports = score
        .conductor
        .primary_hand_track
        .events
        .iter()
        .enumerate()
        .map(|(index, event)| {
            if !observed_gesture_ids
                .iter()
                .any(|id| id == &event.gesture_id)
            {
                observed_gesture_ids.push(event.gesture_id.clone());
            }

            let primitive = nine_gesture_engine_primitive(&event.gesture_id);
            if primitive.is_none() {
                invalid_event_count += 1;
            }
            let end_ms = event.start_ms.saturating_add(event.duration_ms);

            match primitive {
                Some(primitive) => NineGestureEventReport {
                    event_index: index + 1,
                    gesture_id: event.gesture_id.clone(),
                    valid: true,
                    primitive_name: primitive.name.to_string(),
                    physical_definition: primitive.physical_definition.to_string(),
                    candidate_annotations: primitive
                        .candidate_annotations
                        .iter()
                        .map(|annotation| (*annotation).to_string())
                        .collect(),
                    start_ms: event.start_ms,
                    duration_ms: event.duration_ms,
                    end_ms,
                    intensity: event.intensity,
                    operator: event.operator.clone(),
                },
                None => NineGestureEventReport {
                    event_index: index + 1,
                    gesture_id: event.gesture_id.clone(),
                    valid: false,
                    primitive_name: "Unknown Gesture".to_string(),
                    physical_definition: "No registered physical definition".to_string(),
                    candidate_annotations: Vec::new(),
                    start_ms: event.start_ms,
                    duration_ms: event.duration_ms,
                    end_ms,
                    intensity: event.intensity,
                    operator: event.operator.clone(),
                },
            }
        })
        .collect::<Vec<_>>();

    let uses_all_nine_gestures = primitives.iter().all(|primitive| {
        observed_gesture_ids
            .iter()
            .any(|id| id == primitive.gesture_id)
    });
    let total_duration_ms = event_reports
        .iter()
        .map(|event| event.end_ms)
        .max()
        .unwrap_or(0);

    NineGestureConductorEngineReport {
        status: "ok",
        contract_id: "aiweb.hfield.nine_gesture_conductor_engine.v1",
        gesture_vocabulary_id: "nine_gesture_conductor_v1",
        engine_role: "physical gesture primitive registry and score-event scan for HCS renderers",
        source_score_gesture_vocabulary: score.gesture_vocabulary.clone(),
        field_layout_id: score.conductor.field_layout.clone(),
        root_frequency_hz: score.root_frequency_hz,
        research_basis: NineGestureResearchBasis {
            hcs_architecture_ruling: "Harmonic Field Score feeds the Nine-Gesture Conductor Engine; audio, field, notation, cymatic, syllable, and Forge layers are downstream renderers or adapters.",
            public_conducting_manual_basis: vec![
                "Beat patterns must show steady rhythm through visible arm motion.",
                "The downbeat is a strong downward motion on the first beat.",
                "The ictus is the clear beat point, emphasized by a small bounce or dip.",
                "The preparatory beat occurs before the first sung beat and sets tempo, mood, and breath.",
                "The cutoff is a definite motion that marks where sound ends.",
                "Pickup beats and fermatas require preparatory or cutoff-linked transition gestures.",
                "Conducting style should stay simple, readable, and expressive without distracting flourishes.",
            ],
            boundary_rule: "Core logic stores physical motion definitions; candidate meanings remain editable until later Forge authorization.",
        },
        authority_boundaries: NineGestureAuthorityBoundaries {
            physical_definition_is_core_logic: true,
            candidate_interpretation_is_editable: true,
            forge_operational_meaning_locked: false,
            mutates_forge: false,
            performs_identity_vault_write: false,
            exports_private_identity: false,
            authorizes_health_or_sensor_claims: false,
        },
        field_geometry: NineGestureFieldGeometry {
            layout_id: "center_1_lower_5_upper_9",
            conductor_order: vec!["g2", "g1", "g3", "g4", "g5", "g6", "g7", "g9", "g8"],
            spatial_rows: vec![
                vec!["g2", "g1", "g3"],
                vec!["g4", "g5", "g6"],
                vec!["g7", "g9", "g8"],
            ],
            anchor_gestures: vec!["g1", "g5", "g9"],
            orbit_gestures: vec!["g2", "g3", "g4", "g6", "g7", "g8"],
            anchor_frequency_ratios: vec![
                AnchorFrequencyRatio {
                    anchor: "anchor_1",
                    gesture_id: "g1",
                    role: "root settle",
                    ratio_to_root: 1.0,
                },
                AnchorFrequencyRatio {
                    anchor: "anchor_5",
                    gesture_id: "g5",
                    role: "transformation hold",
                    ratio_to_root: 3.0,
                },
                AnchorFrequencyRatio {
                    anchor: "anchor_9",
                    gesture_id: "g9",
                    role: "formed expression hold",
                    ratio_to_root: 9.0,
                },
            ],
        },
        conducting_law: ConductingLawSummary {
            downbeat_rule: "Use a clear downward motion to establish beat one and root/settle behavior.",
            ictus_rule: "Every primitive must expose a readable beat point; ambiguous movement is a failed conducting signal.",
            preparatory_beat_rule: "A preparatory motion must precede entry, breath, pickup, or new phrase behavior.",
            cutoff_rule: "A cutoff must be definite, must show where the sound or phrase ends, and may flow into a new preparatory motion.",
            pickup_rule: "Pickup behavior is treated as a prepared partial-entry, not as a full reset of the measure.",
            fermata_rule: "Hold behavior may extend duration, then transition through cutoff/preparatory motion before continuing.",
            style_rule: "Keep gestures simple, visible, steady, smooth when legato, sharper when bright or staccato.",
            dynamic_rule: "Size and intensity may scale expression; larger for forte/crescendo, smaller for piano/diminuendo.",
            left_hand_rule: "Left-hand meaning is reserved for later cue, sustain, subgroup, and phrasing support; right-hand conductor path remains primary.",
        },
        primitive_count: primitives.len(),
        primitives,
        current_score_scan: NineGestureScoreScan {
            event_count: event_reports.len(),
            invalid_event_count,
            total_duration_ms,
            uses_all_nine_gestures,
            observed_gesture_ids,
            event_reports,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vocabulary_has_nine_gestures() {
        let vocab = nine_gesture_vocabulary();
        assert_eq!(vocab.len(), 9);
        assert!(is_valid_gesture_id("g1"));
        assert!(is_valid_gesture_id("g9"));
        assert!(!is_valid_gesture_id("g10"));
    }

    #[test]
    fn display_order_is_conductor_order() {
        let ids: Vec<&str> = nine_gesture_vocabulary().iter().map(|g| g.id).collect();
        assert_eq!(
            ids,
            vec!["g2", "g1", "g3", "g4", "g5", "g6", "g7", "g9", "g8"]
        );
    }

    #[test]
    fn nine_gesture_engine_separates_physical_definition_from_candidate_meaning() {
        let report =
            create_nine_gesture_conductor_engine_report(&hfield_domain::FieldScore::default_hcs());

        assert_eq!(
            report.contract_id,
            "aiweb.hfield.nine_gesture_conductor_engine.v1"
        );
        assert_eq!(report.primitive_count, 9);
        assert!(
            report
                .authority_boundaries
                .physical_definition_is_core_logic
        );
        assert!(
            report
                .authority_boundaries
                .candidate_interpretation_is_editable
        );
        assert!(!report.authority_boundaries.forge_operational_meaning_locked);
        assert!(!report.authority_boundaries.mutates_forge);
        assert!(!report.authority_boundaries.performs_identity_vault_write);

        let g6 = report
            .primitives
            .iter()
            .find(|primitive| primitive.gesture_id == "g6")
            .expect("g6 primitive exists");
        assert_eq!(
            g6.physical_definition,
            "move outward from anchor_5 toward stabilization or expression"
        );
        assert!(g6.candidate_annotations.contains(&"correction"));
        assert_eq!(
            g6.interpretation_status,
            "candidate_annotation_only_not_forge_law"
        );
    }

    #[test]
    fn default_score_scan_reports_registered_gesture_events() {
        let report =
            create_nine_gesture_conductor_engine_report(&hfield_domain::FieldScore::default_hcs());

        assert_eq!(report.current_score_scan.event_count, 3);
        assert_eq!(report.current_score_scan.invalid_event_count, 0);
        assert!(report.current_score_scan.total_duration_ms > 0);
        assert!(report
            .current_score_scan
            .event_reports
            .iter()
            .all(|event| event.valid));
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GestureTimelineReport {
    pub track_id: String,
    pub event_count: usize,
    pub total_duration_ms: u32,
    pub total_duration_seconds: f64,
    pub events: Vec<GestureTimelineEventView>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GestureTimelineEventView {
    pub event_index: usize,
    pub gesture_id: String,
    pub gesture_name: String,
    pub operator: Option<String>,
    pub field_region: String,
    pub anchor: String,
    pub start_ms: u32,
    pub duration_ms: u32,
    pub end_ms: u32,
    pub start_seconds: f64,
    pub duration_seconds: f64,
    pub intensity: f32,
    pub cue_text: String,
}

pub fn gesture_definition(id: &str) -> Option<GestureDefinition> {
    nine_gesture_vocabulary()
        .into_iter()
        .find(|definition| definition.id == id)
}

pub fn create_gesture_timeline_report(score: &hfield_domain::FieldScore) -> GestureTimelineReport {
    let events = score
        .conductor
        .primary_hand_track
        .events
        .iter()
        .enumerate()
        .map(|(index, event)| {
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

            GestureTimelineEventView {
                event_index: index + 1,
                gesture_id: event.gesture_id.clone(),
                gesture_name: gesture_name.clone(),
                operator: event.operator.clone(),
                field_region: field_region.clone(),
                anchor,
                start_ms: event.start_ms,
                duration_ms: event.duration_ms,
                end_ms,
                start_seconds: round3(event.start_ms as f64 / 1000.0),
                duration_seconds: round3(event.duration_ms as f64 / 1000.0),
                intensity: event.intensity,
                cue_text: timeline_cue_text(
                    &event.gesture_id,
                    &gesture_name,
                    event.operator.as_deref(),
                    &field_region,
                ),
            }
        })
        .collect::<Vec<_>>();

    let total_duration_ms = events.iter().map(|event| event.end_ms).max().unwrap_or(0);

    GestureTimelineReport {
        track_id: score.conductor.primary_hand_track.track_id.clone(),
        event_count: events.len(),
        total_duration_ms,
        total_duration_seconds: round3(total_duration_ms as f64 / 1000.0),
        events,
    }
}

fn timeline_cue_text(
    gesture_id: &str,
    gesture_name: &str,
    operator: Option<&str>,
    field_region: &str,
) -> String {
    let operator_text = operator.unwrap_or("gesture");

    match gesture_id {
        "g1" => format!("{operator_text}: {gesture_name}; settle at center/root presence."),
        "g2" => format!("{operator_text}: {gesture_name}; prepare and open from center."),
        "g3" => format!("{operator_text}: {gesture_name}; emerge outward from center."),
        "g4" => format!("{operator_text}: {gesture_name}; descend into lower constraint."),
        "g5" => format!("{operator_text}: {gesture_name}; hold lower depth and transformation."),
        "g6" => format!("{operator_text}: {gesture_name}; release from lower depth."),
        "g7" => format!("{operator_text}: {gesture_name}; gather expression upward."),
        "g9" => format!("{operator_text}: {gesture_name}; hold formed upper expression."),
        "g8" => format!("{operator_text}: {gesture_name}; emit outward from upper expression."),
        _ => format!("{operator_text}: {gesture_name}; conduct through {field_region}."),
    }
}

fn round3(value: f64) -> f64 {
    (value * 1000.0).round() / 1000.0
}

#[cfg(test)]
mod timeline_tests {
    use super::*;
    use hfield_domain::{FieldScore, GestureEvent};

    #[test]
    fn creates_timeline_report_from_default_score() {
        let score = FieldScore::default_hcs();
        let report = create_gesture_timeline_report(&score);

        assert_eq!(report.track_id, "primary_hand");
        assert_eq!(report.event_count, 3);
        assert_eq!(report.events[0].gesture_id, "g2");
        assert_eq!(report.events[1].gesture_id, "g1");
        assert!(report.total_duration_ms > 0);
    }

    #[test]
    fn timeline_report_handles_appended_gesture() {
        let mut score = FieldScore::default_hcs();

        score
            .conductor
            .primary_hand_track
            .events
            .push(GestureEvent {
                gesture_id: "g9".to_string(),
                start_ms: 620,
                duration_ms: 500,
                intensity: 0.7,
                operator: Some("formed_hold".to_string()),
            });

        let report = create_gesture_timeline_report(&score);

        assert_eq!(report.event_count, 4);
        assert_eq!(report.events[3].gesture_name, "Formed Expression Hold");
        assert_eq!(report.total_duration_ms, 1120);
    }
}

pub const TRUE_CONDUCTOR_GESTURE_REFERENCE_MANIFEST_V1_CONTRACT_ID: &str =
    "aiweb.hfield.true_conductor_gesture_reference_manifest.v1";
pub const TRUE_CONDUCTOR_GESTURE_REFERENCE_MANIFEST_PROFILE_ID: &str =
    "true_conductor_gesture_reference_manifest_v1";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrueConductorGestureReferenceManifestV1Report {
    pub status: &'static str,
    pub contract_id: &'static str,
    pub profile_id: &'static str,
    pub manifest_role: &'static str,
    pub research_basis: TrueGestureReferenceResearchBasis,
    pub authority_boundaries: TrueGestureReferenceAuthorityBoundaries,
    pub coordinate_policy: TrueGestureReferenceCoordinatePolicy,
    pub conducting_operator_manifest: Vec<TrueConductingOperatorReference>,
    pub reference_count: usize,
    pub references: Vec<TrueGestureReference>,
    pub current_score_scan: TrueGestureReferenceScoreScan,
    pub readiness_gates: TrueGestureReferenceReadinessGates,
    pub next_work: Vec<&'static str>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrueGestureReferenceResearchBasis {
    pub hcs_build_ruling: &'static str,
    pub conducting_manual_basis: Vec<&'static str>,
    pub design_correction: &'static str,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrueGestureReferenceAuthorityBoundaries {
    pub manifest_is_rust_owned: bool,
    pub references_are_renderer_inputs: bool,
    pub references_are_forge_operational_meaning: bool,
    pub replaces_generic_reference_overlay: bool,
    pub may_drive_later_gesture_aware_field_renderer: bool,
    pub mutates_forge: bool,
    pub performs_identity_vault_write: bool,
    pub exports_private_identity: bool,
    pub authorizes_health_or_sensor_claims: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrueGestureReferenceCoordinatePolicy {
    pub coordinate_space: &'static str,
    pub source_layout: &'static str,
    pub spatial_order: Vec<&'static str>,
    pub anchor_model: Vec<TrueGestureAnchorReference>,
    pub path_rule: &'static str,
    pub timing_rule: &'static str,
    pub radius_rule: &'static str,
    pub motif_rule: &'static str,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrueGestureAnchorReference {
    pub anchor_id: &'static str,
    pub anchor_gesture_id: &'static str,
    pub field_region: &'static str,
    pub position: TrueGesturePoint,
    pub role: &'static str,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrueConductingOperatorReference {
    pub operator_id: &'static str,
    pub role: &'static str,
    pub physical_rule: &'static str,
    pub renderer_effect: &'static str,
    pub forge_boundary: &'static str,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrueGestureReference {
    pub reference_id: String,
    pub track_id: String,
    pub hand_role: &'static str,
    pub event_index: usize,
    pub gesture_id: String,
    pub valid: bool,
    pub primitive_name: String,
    pub anchor_id: String,
    pub anchor_gesture_id: String,
    pub anchor_relationship: String,
    pub field_region: String,
    pub orbital_direction: String,
    pub path: TrueGesturePathReference,
    pub timing: TrueGestureTimingReference,
    pub intensity_radius: TrueGestureIntensityRadius,
    pub associated_track: String,
    pub associated_motif: Option<String>,
    pub conducting_operators: Vec<String>,
    pub timing_tags: Vec<String>,
    pub renderer_contract: TrueGestureRendererReferenceContract,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrueGesturePathReference {
    pub path_id: String,
    pub easing_profile: String,
    pub start_position: TrueGesturePoint,
    pub control_points: Vec<TrueGesturePoint>,
    pub end_position: TrueGesturePoint,
    pub sample_points: Vec<TrueGesturePoint>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct TrueGesturePoint {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrueGestureTimingReference {
    pub start_ms: u32,
    pub duration_ms: u32,
    pub end_ms: u32,
    pub normalized_start: f32,
    pub normalized_end: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrueGestureIntensityRadius {
    pub source_intensity: f32,
    pub path_radius: f32,
    pub stroke_weight: f32,
    pub visual_alpha: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrueGestureRendererReferenceContract {
    pub renderer_may_draw_path: bool,
    pub renderer_may_draw_anchor_relation: bool,
    pub renderer_may_draw_timing_window: bool,
    pub renderer_may_draw_motif_chunk: bool,
    pub renderer_may_infer_missing_gesture_geometry: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrueGestureReferenceScoreScan {
    pub primary_event_count: usize,
    pub expressive_event_count: usize,
    pub total_event_count: usize,
    pub invalid_event_count: usize,
    pub total_duration_ms: u32,
    pub observed_gesture_ids: Vec<String>,
    pub has_motif_layer_reference: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrueGestureReferenceReadinessGates {
    pub has_nine_gesture_engine: bool,
    pub has_primary_track: bool,
    pub every_reference_has_start_and_end: bool,
    pub every_reference_has_anchor_relationship: bool,
    pub every_reference_has_path_samples: bool,
    pub every_reference_has_renderer_contract: bool,
    pub no_generic_overlay_fallback_needed: bool,
    pub no_live_forge_or_identity_side_effects: bool,
    pub current_score_can_drive_true_gesture_reference_manifest: bool,
}

pub fn create_true_conductor_gesture_reference_manifest_v1_report(
    score: &hfield_domain::FieldScore,
) -> TrueConductorGestureReferenceManifestV1Report {
    let mut references = Vec::new();
    for (index, event) in score.conductor.primary_hand_track.events.iter().enumerate() {
        references.push(true_gesture_reference_from_event(
            score,
            event,
            index + 1,
            &score.conductor.primary_hand_track.track_id,
            "dominant_conductor_hand",
        ));
    }

    if let Some(track) = &score.conductor.expressive_hand_track {
        for (index, event) in track.events.iter().enumerate() {
            references.push(true_gesture_reference_from_event(
                score,
                event,
                index + 1,
                &track.track_id,
                "expressive_support_hand",
            ));
        }
    }

    let current_score_scan = true_gesture_reference_score_scan(score, &references);
    let readiness_gates =
        true_gesture_reference_readiness_gates(score, &references, &current_score_scan);

    TrueConductorGestureReferenceManifestV1Report {
        status: "ok",
        contract_id: TRUE_CONDUCTOR_GESTURE_REFERENCE_MANIFEST_V1_CONTRACT_ID,
        profile_id: TRUE_CONDUCTOR_GESTURE_REFERENCE_MANIFEST_PROFILE_ID,
        manifest_role: "Rust-owned gesture path, timing, anchor, radius, operator, and motif-reference manifest for downstream renderers",
        research_basis: TrueGestureReferenceResearchBasis {
            hcs_build_ruling: "True gesture references must exist before the gesture-aware field renderer returns; generic decorative reference lines are not allowed.",
            conducting_manual_basis: vec![
                "The beat is steady and must be visible through consistent motion.",
                "The downbeat establishes the first beat with clear downward motion.",
                "The ictus is the readable beat point, usually shown by a small bounce or dip.",
                "The preparatory beat sets tempo, mood, and breath before entry.",
                "The cutoff marks the definite end of sound or phrase.",
                "Pickup beats, fermatas, and re-entry require transition logic, not random lines.",
                "The left hand may support phrasing, dynamics, style, sustain, subgroup cueing, and expression while the dominant hand keeps the primary path.",
            ],
            design_correction: "This manifest exports actual event-derived gesture paths and anchor/orbit metadata; renderers must read this manifest instead of guessing overlay geometry.",
        },
        authority_boundaries: TrueGestureReferenceAuthorityBoundaries {
            manifest_is_rust_owned: true,
            references_are_renderer_inputs: true,
            references_are_forge_operational_meaning: false,
            replaces_generic_reference_overlay: true,
            may_drive_later_gesture_aware_field_renderer: true,
            mutates_forge: false,
            performs_identity_vault_write: false,
            exports_private_identity: false,
            authorizes_health_or_sensor_claims: false,
        },
        coordinate_policy: true_gesture_reference_coordinate_policy(),
        conducting_operator_manifest: true_conducting_operator_manifest(),
        reference_count: references.len(),
        references,
        current_score_scan,
        readiness_gates,
        next_work: vec![
            "bind true gesture reference manifest hash into canonical bundle manifest v2",
            "update Gesture-Aware Field Renderer v2 to consume these path references directly",
            "add motif span ids after serialized motif objects exist",
            "add renderer replay tests proving no generic reference overlay fallback is used",
            "later add two-hand renderer behavior using expressive_support_hand references",
        ],
    }
}

fn true_gesture_reference_from_event(
    score: &hfield_domain::FieldScore,
    event: &hfield_domain::GestureEvent,
    event_index: usize,
    track_id: &str,
    hand_role: &'static str,
) -> TrueGestureReference {
    let primitive = nine_gesture_engine_primitive(&event.gesture_id);
    let primitive_name = primitive
        .as_ref()
        .map(|primitive| primitive.name.to_string())
        .unwrap_or_else(|| "Unknown Gesture".to_string());
    let metadata = true_gesture_static_metadata(&event.gesture_id);
    let path =
        true_gesture_path_reference(&event.gesture_id, event.intensity, event_index, track_id);
    let total_duration_ms = true_gesture_total_duration_ms(score).max(1);
    let end_ms = event.start_ms.saturating_add(event.duration_ms);
    let associated_motif = true_gesture_associated_motif(score, &event.gesture_id, track_id);

    TrueGestureReference {
        reference_id: format!(
            "{}_{}_{}_{}",
            track_id, event_index, event.gesture_id, event.start_ms
        ),
        track_id: track_id.to_string(),
        hand_role,
        event_index,
        gesture_id: event.gesture_id.clone(),
        valid: primitive.is_some(),
        primitive_name,
        anchor_id: metadata.anchor_id.to_string(),
        anchor_gesture_id: metadata.anchor_gesture_id.to_string(),
        anchor_relationship: metadata.anchor_relationship.to_string(),
        field_region: metadata.field_region.to_string(),
        orbital_direction: metadata.orbital_direction.to_string(),
        path,
        timing: TrueGestureTimingReference {
            start_ms: event.start_ms,
            duration_ms: event.duration_ms,
            end_ms,
            normalized_start: event.start_ms as f32 / total_duration_ms as f32,
            normalized_end: end_ms as f32 / total_duration_ms as f32,
        },
        intensity_radius: TrueGestureIntensityRadius {
            source_intensity: event.intensity,
            path_radius: true_gesture_path_radius(event.intensity),
            stroke_weight: (1.0 + event.intensity.clamp(0.0, 1.0) * 4.0).clamp(1.0, 5.0),
            visual_alpha: (0.35 + event.intensity.clamp(0.0, 1.0) * 0.60).clamp(0.35, 0.95),
        },
        associated_track: track_id.to_string(),
        associated_motif,
        conducting_operators: true_gesture_conducting_operators(&event.gesture_id)
            .into_iter()
            .map(|operator| operator.to_string())
            .collect(),
        timing_tags: true_gesture_timing_tags(&event.gesture_id, event.start_ms, event.duration_ms)
            .into_iter()
            .map(|tag| tag.to_string())
            .collect(),
        renderer_contract: TrueGestureRendererReferenceContract {
            renderer_may_draw_path: true,
            renderer_may_draw_anchor_relation: true,
            renderer_may_draw_timing_window: true,
            renderer_may_draw_motif_chunk: true,
            renderer_may_infer_missing_gesture_geometry: false,
        },
    }
}

struct TrueGestureStaticMetadata {
    anchor_id: &'static str,
    anchor_gesture_id: &'static str,
    anchor_relationship: &'static str,
    field_region: &'static str,
    orbital_direction: &'static str,
}

fn true_gesture_static_metadata(gesture_id: &str) -> TrueGestureStaticMetadata {
    match gesture_id {
        "g2" => TrueGestureStaticMetadata {
            anchor_id: "anchor_1",
            anchor_gesture_id: "g1",
            anchor_relationship: "inward_side_approach_to_root_anchor",
            field_region: "root_row_receptive_left",
            orbital_direction: "inward_to_anchor",
        },
        "g1" => TrueGestureStaticMetadata {
            anchor_id: "anchor_1",
            anchor_gesture_id: "g1",
            anchor_relationship: "root_anchor_settle",
            field_region: "root_row_center",
            orbital_direction: "anchor_hold",
        },
        "g3" => TrueGestureStaticMetadata {
            anchor_id: "anchor_1",
            anchor_gesture_id: "g1",
            anchor_relationship: "outward_side_release_from_root_anchor",
            field_region: "root_row_projective_right",
            orbital_direction: "outward_from_anchor",
        },
        "g4" => TrueGestureStaticMetadata {
            anchor_id: "anchor_5",
            anchor_gesture_id: "g5",
            anchor_relationship: "inward_side_approach_to_transformation_anchor",
            field_region: "lower_transformation_row_receptive_left",
            orbital_direction: "inward_to_anchor",
        },
        "g5" => TrueGestureStaticMetadata {
            anchor_id: "anchor_5",
            anchor_gesture_id: "g5",
            anchor_relationship: "transformation_anchor_hold",
            field_region: "lower_transformation_row_center",
            orbital_direction: "anchor_hold",
        },
        "g6" => TrueGestureStaticMetadata {
            anchor_id: "anchor_5",
            anchor_gesture_id: "g5",
            anchor_relationship: "outward_side_release_from_transformation_anchor",
            field_region: "lower_transformation_row_projective_right",
            orbital_direction: "outward_from_anchor",
        },
        "g7" => TrueGestureStaticMetadata {
            anchor_id: "anchor_9",
            anchor_gesture_id: "g9",
            anchor_relationship: "inward_side_approach_to_expression_anchor",
            field_region: "upper_expression_row_receptive_left",
            orbital_direction: "inward_to_anchor",
        },
        "g9" => TrueGestureStaticMetadata {
            anchor_id: "anchor_9",
            anchor_gesture_id: "g9",
            anchor_relationship: "formed_expression_anchor_hold",
            field_region: "upper_expression_row_center",
            orbital_direction: "anchor_hold",
        },
        "g8" => TrueGestureStaticMetadata {
            anchor_id: "anchor_9",
            anchor_gesture_id: "g9",
            anchor_relationship: "outward_side_release_from_expression_anchor",
            field_region: "upper_expression_row_projective_right",
            orbital_direction: "outward_from_anchor",
        },
        _ => TrueGestureStaticMetadata {
            anchor_id: "unknown",
            anchor_gesture_id: "unknown",
            anchor_relationship: "unknown_gesture_no_anchor_relationship",
            field_region: "unknown",
            orbital_direction: "unknown",
        },
    }
}

fn true_gesture_static_position(gesture_id: &str) -> TrueGesturePoint {
    match gesture_id {
        "g2" => TrueGesturePoint {
            x: -1.0,
            y: 0.0,
            z: 0.0,
        },
        "g1" => TrueGesturePoint {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        },
        "g3" => TrueGesturePoint {
            x: 1.0,
            y: 0.0,
            z: 0.0,
        },
        "g4" => TrueGesturePoint {
            x: -1.0,
            y: -1.0,
            z: 0.0,
        },
        "g5" => TrueGesturePoint {
            x: 0.0,
            y: -1.0,
            z: 0.0,
        },
        "g6" => TrueGesturePoint {
            x: 1.0,
            y: -1.0,
            z: 0.0,
        },
        "g7" => TrueGesturePoint {
            x: -1.0,
            y: 1.0,
            z: 0.0,
        },
        "g9" => TrueGesturePoint {
            x: 0.0,
            y: 1.0,
            z: 0.0,
        },
        "g8" => TrueGesturePoint {
            x: 1.0,
            y: 1.0,
            z: 0.0,
        },
        _ => TrueGesturePoint {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        },
    }
}

fn true_gesture_start_end_ids(gesture_id: &str) -> (&'static str, &'static str) {
    match gesture_id {
        "g2" => ("g2", "g1"),
        "g1" => ("g1", "g1"),
        "g3" => ("g1", "g3"),
        "g4" => ("g4", "g5"),
        "g5" => ("g5", "g5"),
        "g6" => ("g5", "g6"),
        "g7" => ("g7", "g9"),
        "g9" => ("g9", "g9"),
        "g8" => ("g9", "g8"),
        _ => ("g1", "g1"),
    }
}

fn true_gesture_path_reference(
    gesture_id: &str,
    intensity: f32,
    event_index: usize,
    track_id: &str,
) -> TrueGesturePathReference {
    let (start_id, end_id) = true_gesture_start_end_ids(gesture_id);
    let start = true_gesture_static_position(start_id);
    let end = true_gesture_static_position(end_id);
    let lift = (0.12 + intensity.clamp(0.0, 1.0) * 0.38).clamp(0.12, 0.50);
    let midpoint = TrueGesturePoint {
        x: (start.x + end.x) / 2.0,
        y: (start.y + end.y) / 2.0,
        z: lift,
    };

    TrueGesturePathReference {
        path_id: format!("{}_{}_{}_path", track_id, event_index, gesture_id),
        easing_profile: true_gesture_easing_profile(gesture_id).to_string(),
        start_position: start,
        control_points: vec![midpoint],
        end_position: end,
        sample_points: vec![start, midpoint, end],
    }
}

fn true_gesture_easing_profile(gesture_id: &str) -> &'static str {
    match gesture_id {
        "g1" => "settle_ictus_micro_bounce",
        "g5" | "g9" => "sustained_hold_with_release_readiness",
        "g2" | "g4" | "g7" => "preparatory_inward_curve",
        "g3" | "g6" | "g8" => "outward_release_curve",
        _ => "unknown_linear_safe_fallback",
    }
}

fn true_gesture_path_radius(intensity: f32) -> f32 {
    (0.20 + intensity.clamp(0.0, 1.0) * 0.80).clamp(0.20, 1.0)
}

fn true_gesture_conducting_operators(gesture_id: &str) -> Vec<&'static str> {
    match gesture_id {
        "g2" => vec!["prepare", "pickup_readiness"],
        "g1" => vec!["downbeat", "ictus", "settle"],
        "g3" => vec!["upbeat", "phrase_entry", "outward_motion"],
        "g4" => vec!["prepare", "constraint_entry", "controlled_dip"],
        "g5" => vec!["hold", "fermata_ready", "sustain"],
        "g6" => vec!["cutoff", "release", "reentry_ready"],
        "g7" => vec!["left_hand_cue", "gather", "prepare_expression"],
        "g9" => vec!["hold", "fermata", "phrase_completion"],
        "g8" => vec!["final_cutoff", "outward_release", "emit"],
        _ => vec!["unknown"],
    }
}

fn true_gesture_timing_tags(
    gesture_id: &str,
    start_ms: u32,
    duration_ms: u32,
) -> Vec<&'static str> {
    let mut tags = true_gesture_conducting_operators(gesture_id);
    if start_ms == 0 {
        tags.push("score_entry_window");
    }
    if duration_ms >= 1_000 {
        tags.push("long_duration_window");
    }
    tags
}

fn true_gesture_associated_motif(
    score: &hfield_domain::FieldScore,
    gesture_id: &str,
    track_id: &str,
) -> Option<String> {
    let has_music = score
        .music
        .tracks
        .iter()
        .any(|track| !track.notes.is_empty());
    let base = match gesture_id {
        "g2" | "g3" => "opening_motif_candidate",
        "g4" | "g5" | "g6" => "constraint_resolution_motif_candidate",
        "g7" | "g9" | "g8" => "expression_release_motif_candidate",
        "g1" => "root_settle_motif_candidate",
        _ => "unknown_motif_candidate",
    };

    if has_music || track_id.contains("gesture") || track_id.contains("conductor") {
        Some(base.to_string())
    } else {
        None
    }
}

fn true_gesture_reference_coordinate_policy() -> TrueGestureReferenceCoordinatePolicy {
    TrueGestureReferenceCoordinatePolicy {
        coordinate_space: "hcs_conductor_reference_space_v1",
        source_layout: "[g2 g1 g3] [g4 g5 g6] [g7 g9 g8] with g1 center, g5 lower, g9 upper",
        spatial_order: vec!["g2", "g1", "g3", "g4", "g5", "g6", "g7", "g9", "g8"],
        anchor_model: vec![
            TrueGestureAnchorReference {
                anchor_id: "anchor_1",
                anchor_gesture_id: "g1",
                field_region: "root_center",
                position: true_gesture_static_position("g1"),
                role: "root/home/ictus settle reference",
            },
            TrueGestureAnchorReference {
                anchor_id: "anchor_5",
                anchor_gesture_id: "g5",
                field_region: "lower_transformation_hold",
                position: true_gesture_static_position("g5"),
                role: "lower embodied transformation hold reference",
            },
            TrueGestureAnchorReference {
                anchor_id: "anchor_9",
                anchor_gesture_id: "g9",
                field_region: "upper_formed_expression_hold",
                position: true_gesture_static_position("g9"),
                role: "upper formed expression hold reference",
            },
        ],
        path_rule: "Each event resolves to a start point, one control point, and end point owned by Rust, not guessed by a renderer.",
        timing_rule: "Every reference carries start_ms, duration_ms, end_ms, and normalized timing against the score gesture span.",
        radius_rule: "Path radius, stroke weight, and alpha derive from bounded event intensity.",
        motif_rule: "Motif linkage is candidate metadata until serialized motif ids and approval gates exist.",
    }
}

fn true_conducting_operator_manifest() -> Vec<TrueConductingOperatorReference> {
    vec![
        TrueConductingOperatorReference {
            operator_id: "prepare",
            role: "entry preparation",
            physical_rule: "motion before entry sets shared breath, tempo, and mood",
            renderer_effect: "draw pre-entry curve into the target anchor side",
            forge_boundary: "candidate timing support only; no Forge meaning lock",
        },
        TrueConductingOperatorReference {
            operator_id: "downbeat",
            role: "beat-one assertion",
            physical_rule: "clear downward motion establishes the first beat",
            renderer_effect: "mark anchor contact/settle point",
            forge_boundary: "renderer timing only",
        },
        TrueConductingOperatorReference {
            operator_id: "ictus",
            role: "readable beat point",
            physical_rule: "small bounce/dip makes the beat point legible",
            renderer_effect: "draw ictus point on the path",
            forge_boundary: "no semantic authority",
        },
        TrueConductingOperatorReference {
            operator_id: "hold",
            role: "sustained phrase or sound",
            physical_rule: "stable hand position sustains until release",
            renderer_effect: "draw anchor dwell window",
            forge_boundary: "not a memory or delivery authorization",
        },
        TrueConductingOperatorReference {
            operator_id: "cutoff",
            role: "definite ending",
            physical_rule: "clear ending motion marks where sound or phrase stops",
            renderer_effect: "draw terminal gesture cap",
            forge_boundary: "no Forge mutation",
        },
        TrueConductingOperatorReference {
            operator_id: "pickup_readiness",
            role: "partial entry before main beat",
            physical_rule: "prepared motion allows phrase entry before the next downbeat",
            renderer_effect: "draw pickup window before anchor contact",
            forge_boundary: "candidate timing support only",
        },
        TrueConductingOperatorReference {
            operator_id: "fermata",
            role: "extended hold with controlled continuation",
            physical_rule: "held point waits, then leaves through cutoff or preparation",
            renderer_effect: "draw extended dwell plus release vector",
            forge_boundary: "no health/sensor/identity claim",
        },
        TrueConductingOperatorReference {
            operator_id: "left_hand_cue",
            role: "supporting cue or phrase shaping",
            physical_rule: "support hand may cue style, sustain, group entry, dynamics, or mood",
            renderer_effect: "draw expressive_support_hand overlay when present",
            forge_boundary: "support metadata only",
        },
    ]
}

fn true_gesture_reference_score_scan(
    score: &hfield_domain::FieldScore,
    references: &[TrueGestureReference],
) -> TrueGestureReferenceScoreScan {
    let mut observed_gesture_ids: Vec<String> = Vec::new();
    for reference in references {
        if !observed_gesture_ids
            .iter()
            .any(|id| id == &reference.gesture_id)
        {
            observed_gesture_ids.push(reference.gesture_id.clone());
        }
    }

    TrueGestureReferenceScoreScan {
        primary_event_count: score.conductor.primary_hand_track.events.len(),
        expressive_event_count: score
            .conductor
            .expressive_hand_track
            .as_ref()
            .map(|track| track.events.len())
            .unwrap_or(0),
        total_event_count: references.len(),
        invalid_event_count: references
            .iter()
            .filter(|reference| !reference.valid)
            .count(),
        total_duration_ms: true_gesture_total_duration_ms(score),
        observed_gesture_ids,
        has_motif_layer_reference: references
            .iter()
            .any(|reference| reference.associated_motif.is_some()),
    }
}

fn true_gesture_reference_readiness_gates(
    score: &hfield_domain::FieldScore,
    references: &[TrueGestureReference],
    scan: &TrueGestureReferenceScoreScan,
) -> TrueGestureReferenceReadinessGates {
    let every_reference_has_start_and_end = references
        .iter()
        .all(|reference| reference.timing.end_ms >= reference.timing.start_ms);
    let every_reference_has_anchor_relationship = references.iter().all(|reference| {
        !reference.anchor_relationship.trim().is_empty() && reference.anchor_id != "unknown"
    });
    let every_reference_has_path_samples = references
        .iter()
        .all(|reference| reference.path.sample_points.len() >= 3);
    let every_reference_has_renderer_contract = references.iter().all(|reference| {
        reference.renderer_contract.renderer_may_draw_path
            && !reference
                .renderer_contract
                .renderer_may_infer_missing_gesture_geometry
    });
    let no_live_forge_or_identity_side_effects = score.packet.forge_bridge.status == "reserved"
        && score.packet.forge_bridge.forge_runtime_ref.is_none()
        && score.provenance.identity_vault.vault_record_ref.is_none()
        && !score.provenance.raw_private_identity_exported;
    let has_primary_track = !score
        .conductor
        .primary_hand_track
        .track_id
        .trim()
        .is_empty();

    TrueGestureReferenceReadinessGates {
        has_nine_gesture_engine: nine_gesture_engine_primitives().len() == 9,
        has_primary_track,
        every_reference_has_start_and_end,
        every_reference_has_anchor_relationship,
        every_reference_has_path_samples,
        every_reference_has_renderer_contract,
        no_generic_overlay_fallback_needed: !references.is_empty() && scan.invalid_event_count == 0,
        no_live_forge_or_identity_side_effects,
        current_score_can_drive_true_gesture_reference_manifest: nine_gesture_engine_primitives()
            .len()
            == 9
            && has_primary_track
            && !references.is_empty()
            && every_reference_has_start_and_end
            && every_reference_has_anchor_relationship
            && every_reference_has_path_samples
            && every_reference_has_renderer_contract
            && scan.invalid_event_count == 0
            && no_live_forge_or_identity_side_effects,
    }
}

fn true_gesture_total_duration_ms(score: &hfield_domain::FieldScore) -> u32 {
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

#[cfg(test)]
mod true_conductor_gesture_reference_manifest_v1_tests {
    use super::*;

    #[test]
    fn true_manifest_creates_real_path_references_for_current_score() {
        let report = create_true_conductor_gesture_reference_manifest_v1_report(
            &hfield_domain::FieldScore::default_hcs(),
        );

        assert_eq!(
            report.contract_id,
            TRUE_CONDUCTOR_GESTURE_REFERENCE_MANIFEST_V1_CONTRACT_ID
        );
        assert!(report.reference_count >= 1);
        assert_eq!(report.reference_count, report.references.len());
        assert!(report
            .references
            .iter()
            .all(|reference| reference.path.sample_points.len() >= 3));
        assert!(report.references.iter().all(|reference| !reference
            .renderer_contract
            .renderer_may_infer_missing_gesture_geometry));
        assert!(
            report
                .readiness_gates
                .current_score_can_drive_true_gesture_reference_manifest
        );
    }

    #[test]
    fn true_manifest_keeps_references_downstream_and_out_of_forge_authority() {
        let report = create_true_conductor_gesture_reference_manifest_v1_report(
            &hfield_domain::FieldScore::default_hcs(),
        );

        assert!(report.authority_boundaries.manifest_is_rust_owned);
        assert!(report.authority_boundaries.references_are_renderer_inputs);
        assert!(
            !report
                .authority_boundaries
                .references_are_forge_operational_meaning
        );
        assert!(
            report
                .authority_boundaries
                .replaces_generic_reference_overlay
        );
        assert!(!report.authority_boundaries.mutates_forge);
        assert!(!report.authority_boundaries.performs_identity_vault_write);
        assert!(!report.authority_boundaries.exports_private_identity);
        assert!(report
            .conducting_operator_manifest
            .iter()
            .any(|operator| operator.operator_id == "prepare"));
        assert!(report
            .conducting_operator_manifest
            .iter()
            .any(|operator| operator.operator_id == "cutoff"));
        assert!(report
            .conducting_operator_manifest
            .iter()
            .any(|operator| operator.operator_id == "fermata"));
    }
}
