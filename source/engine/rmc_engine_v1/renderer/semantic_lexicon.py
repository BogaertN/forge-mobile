"""
forge/rmc_engine_v1/renderer/semantic_lexicon.py

RMC-NON-LLM-RENDERER-AND-SEMANTIC-LEXICON-BUILD-009
Controlled semantic lexicon for admitted MEA hypothesis render previews.

This module is not the earlier resonance-input lexicon.  The existing
`rmc_engine_v1.resonance_lexicon` maps English input into phase/operator
signals.  This module performs the separate downstream task of mapping a
Build 008 MEA-to-RMC admission packet into a finite set of sentence-safe
concepts.  It never adds evidence, changes claim status, lowers proof debt,
approves output, calls an LLM, or writes state.

Only a hash-valid Build 008 admission packet for the persisted sealed
`144hz_substrate_status` hypothesis is accepted in this build.  Build 009 may
render *unapproved preview language* only.  Build 010 Echo Validator
hardening remains required before any user-facing approval.
"""
from __future__ import annotations

from typing import Any, Dict, Mapping, Sequence

from rmc_engine_v1.mea.fixed_point_math_contract import canonical_hash
from rmc_engine_v1.renderer.mea_render_gate import (
    ADAPTER_PACKET_SCHEMA_VERSION,
    BUILD_ID as GATE_BUILD_ID,
    PERMITTED_FUTURE_OUTPUT_MODE,
)

BUILD_ID = "RMC-NON-LLM-RENDERER-AND-SEMANTIC-LEXICON-BUILD-009"
SCHEMA_VERSION = "rmc_semantic_lexicon_v1_build009"
SEMANTIC_PLAN_SCHEMA_VERSION = "rmc_semantic_plan_v1_build009"
ADMITTED_SOURCE_KIND = "mea_to_rmc_render_admission_packet"

SUPPORTED_DELIVERY_MODES = (
    "explanation",
    "decision",
    "warning",
    "verification_result",
    "next_step",
    "refusal",
    "uncertain_result",
)

# Language atoms are deliberately finite and claim-status aware.  No atom is
# allowed to state an empirical relationship about 144 Hz.
CONTROLLED_ATOMS: Dict[str, str] = {
    "subject_reference": "The stored candidate for `144hz_substrate_status`",
    "hypothesis_classification": "is classified as a hypothesis",
    "test_required": "Testing is required before any claim-status upgrade",
    "proof_debt_preserved": "The preserved proof-debt value is 0.85",
    "not_verified": "It is not a verified claim or an empirical fact",
    "not_discovery": "It must not be presented as a discovery",
    "admission_limited": "Rendering is limited to a qualified hypothesis explanation",
    "seal_replay_verified": "The stored seal and replay bindings were verified for render admission",
    "truth_not_proven": "That verification does not prove the underlying empirical claim",
    "echo_pending": "This preview is unapproved until Echo Validation passes",
    "cannot_upgrade": "I cannot present this hypothesis as a verified empirical claim or discovery",
    "uncertainty_preserved": "The status remains uncertain because testing is still required",
}

FORBIDDEN_ASSERTION_FRAGMENTS = (
    " is a golden-ratio harmonic",
    " is an empirical fact",
    " is verified",
    " is proven",
    " discovered that ",
    " confirms that 144",
)

_REQUIRED_PACKET_FIELDS = (
    "schema_version",
    "build_id",
    "packet_type",
    "source_binding",
    "historical_seal_and_replay_proof",
    "epistemic_boundary",
    "permitted_future_render_scope",
    "forbidden_future_render_claims",
    "admission_packet_hash",
)


def semantic_lexicon_boundary() -> Dict[str, Any]:
    return {
        "build_id": BUILD_ID,
        "schema_version": SCHEMA_VERSION,
        "layer": "RMC controlled semantic lexicon downstream of MEA render admission",
        "separate_from_resonance_input_lexicon": True,
        "consumes_build008_admission_packet_only": True,
        "supports_delivery_modes": list(SUPPORTED_DELIVERY_MODES),
        "renders_unapproved_preview_only": True,
        "requires_build010_echo_validation_before_approval": True,
        "adds_evidence": False,
        "changes_claim_status": False,
        "reduces_proof_debt": False,
        "permits_verified_claim": False,
        "permits_empirical_fact": False,
        "permits_discovery": False,
        "calls_llm": False,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "mints_ct": False,
        "creates_http_routes": False,
        "modifies_ui": False,
    }


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _sequence(value: Any) -> Sequence[Any]:
    return value if isinstance(value, (list, tuple)) else ()


def validate_render_admission_packet(packet: Any) -> Dict[str, Any]:
    """Validate the typed Build 008 packet before semantic mapping."""
    errors: list[str] = []
    if not isinstance(packet, Mapping):
        return {"valid": False, "errors": ["render_admission_packet_mapping_required"]}

    missing = [field for field in _REQUIRED_PACKET_FIELDS if field not in packet]
    if missing:
        errors.append("missing_fields:" + ",".join(missing))

    body = {key: value for key, value in packet.items() if key != "admission_packet_hash"}
    supplied_hash = packet.get("admission_packet_hash")
    if not isinstance(supplied_hash, str) or canonical_hash(body) != supplied_hash:
        errors.append("admission_packet_hash_invalid")

    source = _mapping(packet.get("source_binding"))
    proof = _mapping(packet.get("historical_seal_and_replay_proof"))
    epistemic = _mapping(packet.get("epistemic_boundary"))
    scope = _mapping(packet.get("permitted_future_render_scope"))

    checks = {
        "adapter_schema_mismatch": packet.get("schema_version") == ADAPTER_PACKET_SCHEMA_VERSION,
        "adapter_build_mismatch": packet.get("build_id") == GATE_BUILD_ID,
        "adapter_packet_type_mismatch": packet.get("packet_type") == ADMITTED_SOURCE_KIND,
        "schemas_were_merged": packet.get("schemas_merged") is False,
        "problem_id_not_supported_in_build009": source.get("problem_id") == "144hz_substrate_status",
        "candidate_id_not_supported_in_build009": source.get("candidate_id") == "cg_hypothesis_001",
        "historical_seal_not_verified": proof.get("already_sealed_historical_record") is True,
        "replay_not_verified": proof.get("replay_verified") is True,
        "new_seal_requested": proof.get("new_seal_requested") is False,
        "claim_status_not_hypothesis": epistemic.get("claim_status") == "hypothesis",
        "next_action_not_test_required": epistemic.get("required_next_action") == "test_required",
        "proof_debt_changed": epistemic.get("proof_debt_text") == "0.85" and epistemic.get("proof_debt_micro") == 850_000,
        "hypothesis_scope_missing": epistemic.get("hypothesis_only") is True,
        "verified_claim_not_blocked": epistemic.get("may_render_as_verified_claim") is False,
        "empirical_fact_not_blocked": epistemic.get("may_render_as_empirical_fact") is False,
        "discovery_not_blocked": epistemic.get("may_render_as_discovery") is False,
        "uncertainty_not_required": epistemic.get("uncertainty_must_be_preserved") is True,
        "proof_debt_preservation_not_required": epistemic.get("proof_debt_must_be_preserved") is True,
        "wrong_admitted_scope": scope.get("permitted_future_output_mode") == PERMITTED_FUTURE_OUTPUT_MODE,
    }
    errors.extend([reason for reason, passed in checks.items() if not passed])
    if _sequence(packet.get("forbidden_future_render_claims")) == ():
        errors.append("forbidden_future_render_claims_missing")

    return {"valid": not errors, "errors": errors}


def build_semantic_plan(admission_packet: Mapping[str, Any], *, delivery_mode: str) -> Dict[str, Any]:
    """Create a finite concept plan from one validated MEA render admission."""
    validation = validate_render_admission_packet(admission_packet)
    if not validation["valid"]:
        return {
            "status": "REJECTED",
            "accepted": False,
            "reason_code": "render_admission_packet_invalid",
            "errors": validation["errors"],
            "semantic_plan": None,
        }
    if delivery_mode not in SUPPORTED_DELIVERY_MODES:
        return {
            "status": "REJECTED",
            "accepted": False,
            "reason_code": "unsupported_delivery_mode",
            "errors": [delivery_mode],
            "semantic_plan": None,
        }

    source = _mapping(admission_packet["source_binding"])
    epistemic = _mapping(admission_packet["epistemic_boundary"])
    mandatory_atom_ids = (
        "subject_reference",
        "hypothesis_classification",
        "test_required",
        "proof_debt_preserved",
        "not_verified",
        "echo_pending",
    )
    plan_body: Dict[str, Any] = {
        "schema_version": SEMANTIC_PLAN_SCHEMA_VERSION,
        "build_id": BUILD_ID,
        "delivery_mode": delivery_mode,
        "semantic_class": PERMITTED_FUTURE_OUTPUT_MODE,
        "source_admission_packet_hash": admission_packet["admission_packet_hash"],
        "source_binding": {
            "problem_id": source["problem_id"],
            "candidate_id": source["candidate_id"],
            "sealed_manifest_hash": source["sealed_manifest_hash"],
            "seal_receipt_hash": source["seal_receipt_hash"],
            "memory_record_hash": source["memory_record_hash"],
        },
        "epistemic_contract": {
            "claim_status": epistemic["claim_status"],
            "required_next_action": epistemic["required_next_action"],
            "proof_debt_text": epistemic["proof_debt_text"],
            "proof_debt_micro": epistemic["proof_debt_micro"],
            "may_render_as_verified_claim": False,
            "may_render_as_empirical_fact": False,
            "may_render_as_discovery": False,
            "uncertainty_preserved": True,
        },
        "mandatory_atom_ids": list(mandatory_atom_ids),
        "controlled_atoms": {atom_id: CONTROLLED_ATOMS[atom_id] for atom_id in CONTROLLED_ATOMS},
        "forbidden_assertion_fragments": list(FORBIDDEN_ASSERTION_FRAGMENTS),
        "no_new_evidence": True,
        "no_claim_upgrade": True,
        "no_proof_debt_reduction": True,
        "preview_only": True,
        "echo_validation_required": True,
    }
    return {
        "status": "OK",
        "accepted": True,
        "semantic_plan": {**plan_body, "semantic_plan_hash": canonical_hash(plan_body)},
    }


__all__ = [
    "BUILD_ID",
    "SCHEMA_VERSION",
    "SEMANTIC_PLAN_SCHEMA_VERSION",
    "SUPPORTED_DELIVERY_MODES",
    "CONTROLLED_ATOMS",
    "FORBIDDEN_ASSERTION_FRAGMENTS",
    "semantic_lexicon_boundary",
    "validate_render_admission_packet",
    "build_semantic_plan",
]
