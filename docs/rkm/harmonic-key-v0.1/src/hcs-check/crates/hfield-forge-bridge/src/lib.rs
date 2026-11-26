use hfield_domain::FieldScore;
use hfield_packet::validate_hfield_packet_contract;
use hfield_storage::score_hash_hex;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const HFIELD_FORGE_BRIDGE_STUB_CONTRACT_ID: &str = "aiweb.hfield.forge_packet_bridge_stub.v1";
pub const HFIELD_FORGE_BRIDGE_EXECUTION_MODE: &str = "reference_only_no_live_forge_execution";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ForgePacketBridgeStubReport {
    pub status: String,
    pub bridge_contract_id: String,
    pub execution_mode: String,
    pub source_system: String,
    pub target_system: String,
    pub bridge_profile: String,
    pub packet_contract_id: String,
    pub packet_status: String,
    pub packet_hash: String,
    pub score_hash: String,
    pub artifact_id: String,
    pub provenance_hash: String,
    pub identity_vault_ref: Option<String>,
    pub forge_runtime_ref: Option<String>,
    pub symbolic_trace_ref: Option<String>,
    pub validation_ref: Option<String>,
    pub memory_capsule_ref: Option<String>,
    pub payload: ForgePacketPayloadStub,
    pub export_policy: ForgePacketExportPolicy,
    pub warnings: Vec<String>,
    pub fatal_errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ForgePacketPayloadStub {
    pub packet_kind: String,
    pub packet_role: String,
    pub root_frequency_hz: f64,
    pub phase_count: u8,
    pub phase_order: Vec<u8>,
    pub anchor_layout: String,
    pub payload_layers: Vec<String>,
    pub render_targets: Vec<String>,
    pub note_count: usize,
    pub conductor_event_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ForgePacketExportPolicy {
    pub forge_bridge_reserved: bool,
    pub forge_runtime_bound: bool,
    pub live_execution_authorized: bool,
    pub private_identity_exported: bool,
    pub public_disclosure_authorized: bool,
    pub economic_processing_authorized: bool,
    pub portable_rights_authorized: bool,
    pub safe_for_reference_export: bool,
}

pub fn create_forge_packet_bridge_stub_report(score: &FieldScore) -> ForgePacketBridgeStubReport {
    let packet_report = validate_hfield_packet_contract(score);
    let score_value = serde_json::to_value(score).unwrap_or(Value::Null);

    let mut fatal_errors = packet_report.fatal_errors.clone();
    let mut warnings = packet_report.warnings.clone();

    if !score
        .packet
        .target_systems
        .iter()
        .any(|target| target.eq_ignore_ascii_case("Forge"))
    {
        fatal_errors.push("Forge bridge stub requires Forge in packet target_systems".to_string());
    }

    if !score
        .packet
        .payload_layers
        .iter()
        .any(|layer| layer == "forge_bridge")
    {
        fatal_errors.push("Forge bridge stub requires forge_bridge payload layer".to_string());
    }

    let private_identity_exported = find_bool_key(&score_value, "raw_private_identity_exported")
        .or_else(|| find_bool_key(&score_value, "private_identity_exported"))
        .unwrap_or(false);

    let public_disclosure_authorized =
        find_bool_key(&score_value, "public_disclosure_authorized").unwrap_or(false);
    let economic_processing_authorized =
        find_bool_key(&score_value, "economic_processing_authorized").unwrap_or(false);
    let portable_rights_authorized =
        find_bool_key(&score_value, "portable_rights_authorized").unwrap_or(false);

    if private_identity_exported {
        fatal_errors.push(
            "Forge bridge stub forbids raw private identity export inside .hfield".to_string(),
        );
    }

    if public_disclosure_authorized || economic_processing_authorized || portable_rights_authorized
    {
        warnings.push(
            "public/economic/portable rights flags are detected but live bridge execution remains disabled"
                .to_string(),
        );
    }

    if score.packet.forge_bridge.forge_runtime_ref.is_none() {
        warnings
            .push("Forge runtime reference is not bound yet; bridge remains a stub".to_string());
    }

    if score.packet.forge_bridge.symbolic_trace_ref.is_none() {
        warnings.push("Forge symbolic trace reference is not bound yet".to_string());
    }

    let forge_runtime_bound = score.packet.forge_bridge.forge_runtime_ref.is_some()
        || score.packet.forge_bridge.symbolic_trace_ref.is_some()
        || score.packet.forge_bridge.validation_ref.is_some();

    let safe_for_reference_export = fatal_errors.is_empty() && !private_identity_exported;

    let artifact_id = find_string_key(&score_value, "artifact_id")
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "unbound_artifact_id".to_string());

    let provenance_hash = find_string_key(&score_value, "provenance_hash")
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "unsealed_provenance_hash".to_string());

    let identity_vault_ref = find_string_key(&score_value, "identity_vault_ref")
        .or_else(|| find_string_key(&score_value, "creator_principal_ref"));

    let memory_capsule_ref = find_string_key(&score_value, "memory_capsule_ref");

    let status = if !fatal_errors.is_empty() {
        "error"
    } else if !warnings.is_empty() {
        "warning"
    } else {
        "ok"
    }
    .to_string();

    ForgePacketBridgeStubReport {
        status,
        bridge_contract_id: HFIELD_FORGE_BRIDGE_STUB_CONTRACT_ID.to_string(),
        execution_mode: HFIELD_FORGE_BRIDGE_EXECUTION_MODE.to_string(),
        source_system: score.packet.source_system.clone(),
        target_system: "Forge".to_string(),
        bridge_profile: score.packet.forge_bridge.bridge_profile.clone(),
        packet_contract_id: packet_report.contract_id,
        packet_status: packet_report.status,
        packet_hash: packet_report.packet_hash,
        score_hash: score_hash_hex(score).unwrap_or_else(|_| "hash_unavailable".to_string()),
        artifact_id,
        provenance_hash,
        identity_vault_ref,
        forge_runtime_ref: score.packet.forge_bridge.forge_runtime_ref.clone(),
        symbolic_trace_ref: score.packet.forge_bridge.symbolic_trace_ref.clone(),
        validation_ref: score.packet.forge_bridge.validation_ref.clone(),
        memory_capsule_ref,
        payload: ForgePacketPayloadStub {
            packet_kind: score.packet.packet_kind.clone(),
            packet_role: score.packet.packet_role.clone(),
            root_frequency_hz: score.root_frequency_hz,
            phase_count: score.packet.phase_profile.phase_count,
            phase_order: score.packet.phase_profile.phase_order.clone(),
            anchor_layout: score.packet.phase_profile.anchor_layout.clone(),
            payload_layers: score.packet.payload_layers.clone(),
            render_targets: score.packet.render_targets.clone(),
            note_count: note_count(score),
            conductor_event_count: conductor_event_count(score),
        },
        export_policy: ForgePacketExportPolicy {
            forge_bridge_reserved: score.packet.forge_bridge.status == "reserved"
                || forge_runtime_bound,
            forge_runtime_bound,
            live_execution_authorized: false,
            private_identity_exported,
            public_disclosure_authorized,
            economic_processing_authorized,
            portable_rights_authorized,
            safe_for_reference_export,
        },
        warnings,
        fatal_errors,
    }
}

fn note_count(score: &FieldScore) -> usize {
    score
        .music
        .tracks
        .iter()
        .map(|track| track.notes.len())
        .sum()
}

fn conductor_event_count(score: &FieldScore) -> usize {
    score.conductor.primary_hand_track.events.len()
}

fn find_string_key(value: &Value, key: &str) -> Option<String> {
    match value {
        Value::Object(map) => {
            if let Some(Value::String(found)) = map.get(key) {
                return Some(found.clone());
            }

            for nested in map.values() {
                if let Some(found) = find_string_key(nested, key) {
                    return Some(found);
                }
            }

            None
        }
        Value::Array(values) => values
            .iter()
            .find_map(|nested| find_string_key(nested, key)),
        _ => None,
    }
}

fn find_bool_key(value: &Value, key: &str) -> Option<bool> {
    match value {
        Value::Object(map) => {
            if let Some(Value::Bool(found)) = map.get(key) {
                return Some(*found);
            }

            for nested in map.values() {
                if let Some(found) = find_bool_key(nested, key) {
                    return Some(found);
                }
            }

            None
        }
        Value::Array(values) => values.iter().find_map(|nested| find_bool_key(nested, key)),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use hfield_domain::FieldScore;

    #[test]
    fn creates_reference_only_bridge_stub_for_default_score() {
        let score = FieldScore::default_hcs();
        let report = create_forge_packet_bridge_stub_report(&score);

        assert_eq!(
            report.bridge_contract_id,
            HFIELD_FORGE_BRIDGE_STUB_CONTRACT_ID
        );
        assert_eq!(report.execution_mode, HFIELD_FORGE_BRIDGE_EXECUTION_MODE);
        assert_eq!(report.target_system, "Forge");
        assert!(!report.export_policy.live_execution_authorized);
        assert!(report.export_policy.safe_for_reference_export);
    }

    #[test]
    fn bridge_stub_rejects_packets_without_forge_target() {
        let mut score = FieldScore::default_hcs();
        score.packet.target_systems = vec!["HCS".to_string()];

        let report = create_forge_packet_bridge_stub_report(&score);

        assert_eq!(report.status, "error");
        assert!(report
            .fatal_errors
            .iter()
            .any(|error| error.contains("Forge")));
    }

    #[test]
    fn bridge_stub_reports_runtime_refs_but_does_not_execute() {
        let mut score = FieldScore::default_hcs();
        score.packet.forge_bridge.forge_runtime_ref =
            Some("forge://runtime/local/proto-forge".to_string());
        score.packet.forge_bridge.symbolic_trace_ref = Some("forge://trace/demo".to_string());
        score.packet.forge_bridge.validation_ref = Some("forge://validation/demo".to_string());

        let report = create_forge_packet_bridge_stub_report(&score);

        assert!(report.export_policy.forge_runtime_bound);
        assert_eq!(
            report.forge_runtime_ref.as_deref(),
            Some("forge://runtime/local/proto-forge")
        );
        assert!(!report.export_policy.live_execution_authorized);
    }
}
