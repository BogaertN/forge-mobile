"""
forge/rmc_engine_v1/mea/manifest_advance_preview.py

Patch 293 — MEA Live Manifest Advance Preview.

This module proves the proposed transition shape M_t -> M_(t+1) using the
response-only sealed-candidate preview produced by Patch 292.  It intentionally
constructs only a deterministic, non-persistent future-manifest preview.  It
cannot commit a candidate, advance live state, execute a real seal, render user
output, or write memory.

Important integrity note:
The transition trace contains an explicit deferred output-hash binding because
there is no persistent manifest yet.  Patch 293 hashes the deterministic future
manifest *preview*; a later controlled state-write patch must bind the committed
output hash during an atomic write/receipt operation.
"""

from __future__ import annotations

import copy
import hashlib
import json
from typing import Any, Dict, Mapping, Sequence

from .manifest_schema import (
    OutputPermission,
    build_144hz_test_manifest,
    canonical_dict,
    canonical_hash,
    from_dict,
    to_dict,
    validate_manifest,
)
from .seal_candidate_gate import build_seal_candidate_gate_preview

MANIFEST_ADVANCE_PREVIEW_PATCH_ID = "Patch 293 — MEA Live Manifest Advance Preview"
MANIFEST_ADVANCE_PREVIEW_SCHEMA_VERSION = "mea_manifest_advance_preview_v1_patch293"
MANIFEST_ADVANCE_PREVIEW_MODE = "controlled_mea_manifest_advance_preview_patch293"
MANIFEST_ADVANCE_PREVIEW_ROUTE = "/api/mea/manifest-advance-preview"
MANIFEST_ADVANCE_PREVIEW_FORMULA = (
    "M_(t+1)^preview=Advance(M_t,SealedCandidatePreview); "
    "old_hash+selected_sealed_candidate_hash+new_hash; persistence=false"
)
_PREVIEW_TIMESTAMP = "PATCH293_PREVIEW_NO_PERSISTENCE"
_DEFERRED_OUTPUT_BINDING = "PATCH293_OUTPUT_HASH_BINDING_DEFERRED_UNTIL_CONTROLLED_PERSISTENCE"
_DEFAULT_CANDIDATE_ID = "cg_hypothesis_001"


def _stable_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def _sha256(value: Any) -> str:
    return hashlib.sha256(_stable_json(value).encode("utf-8")).hexdigest()


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _sequence(value: Any) -> Sequence[Any]:
    return value if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)) else []


def _is_sha256(value: Any) -> bool:
    return isinstance(value, str) and len(value) == 64 and all(ch in "0123456789abcdef" for ch in value.lower())


def manifest_advance_preview_boundary() -> Dict[str, Any]:
    return {
        "patch": MANIFEST_ADVANCE_PREVIEW_PATCH_ID,
        "schema_version": MANIFEST_ADVANCE_PREVIEW_SCHEMA_VERSION,
        "layer": "MEA proposed manifest transition / live advance preview only",
        "read_only": True,
        "non_mutating": True,
        "creates_get_routes": True,
        "creates_post_routes": False,
        "get_routes": [MANIFEST_ADVANCE_PREVIEW_ROUTE],
        "post_routes": [],
        "consumes_sealed_candidate_response_preview": True,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "performs_network_io": False,
        "seeds_live_manifests": False,
        "commits_live_candidates": False,
        "advances_live_manifest": False,
        "seals_candidates": False,
        "executes_seal": False,
        "promotes_to_memory": False,
        "renders_user_output": False,
        "mutates_existing_rmc_behavior": False,
        "mutates_launcher_behavior": False,
        "mutates_operator_console_ui": False,
        "seal_route_available": False,
        "live_problem_manifest_route_available": False,
        "memory_promotion_route_available": False,
        "output_hash_binding_deferred_until_persistence": True,
    }


def _selected_sealed_candidate_preview(candidate_id: str) -> Mapping[str, Any]:
    gate_payload = build_seal_candidate_gate_preview(candidate_id)
    if gate_payload.get("status") != "OK" or gate_payload.get("gate_status") != "ACCEPTED_PREVIEW_ONLY":
        raise ValueError("selected candidate did not pass Patch 292 controlled seal-candidate preview gate")
    if gate_payload.get("sealed_candidate_live") is not False or gate_payload.get("seal_execution_permitted") is not False:
        raise ValueError("Patch 293 requires a response-only non-executed sealed-candidate preview")
    sealed_object = _mapping(gate_payload.get("sealed_candidate_object"))
    if not sealed_object:
        raise ValueError("controlled sealed-candidate preview object unavailable")
    if sealed_object.get("candidate_id") != candidate_id:
        raise ValueError("selected sealed-candidate preview identity mismatch")
    return sealed_object


def _compile_transition(candidate_id: str) -> Dict[str, Any]:
    old_manifest = build_144hz_test_manifest()
    old_manifest_hash = canonical_hash(old_manifest)
    old_snapshot = to_dict(old_manifest)
    old_canonical = canonical_dict(old_manifest)
    selected = _selected_sealed_candidate_preview(candidate_id)

    selected_candidate_hash = str(selected.get("candidate_hash"))
    selected_sealed_candidate_hash = str(selected.get("sealed_candidate_preview_hash"))
    if not _is_sha256(selected_candidate_hash) or not _is_sha256(selected_sealed_candidate_hash):
        raise ValueError("selected sealed-candidate preview hashes are not valid sha256 digests")
    if str(selected.get("parent_manifest_hash")) != old_manifest_hash:
        raise ValueError("selected sealed-candidate preview is not descended from canonical M_t")

    remaining_unknowns = [dict(_mapping(item)) for item in _sequence(selected.get("remaining_unknowns"))]
    proposed_unknown_descriptions = [str(item.get("description")) for item in remaining_unknowns if item.get("description")]
    before_unknowns = list(old_snapshot.get("unknowns", []))
    retained_unknowns = [item for item in before_unknowns if item in proposed_unknown_descriptions]
    added_unknowns = [item for item in proposed_unknown_descriptions if item not in before_unknowns]
    resolved_unknowns = [item for item in before_unknowns if item not in proposed_unknown_descriptions]

    operator_event = {
        "operator_id": "select_sealed_candidate_preview",
        "operator_family": "system",
        "parameters": {
            "candidate_id": candidate_id,
            "candidate_hash": selected_candidate_hash,
            "selected_sealed_candidate_hash": selected_sealed_candidate_hash,
            "seal_packet_hash": str(selected.get("seal_packet_hash")),
            "gate_report_hash": str(selected.get("gate_report_hash")),
            "candidate_audit_chain_hash": str(selected.get("candidate_audit_chain_hash")),
            "response_only": True,
            "seal_execution_permitted": False,
            "persisted": False,
        },
        "input_manifest_hash": old_manifest_hash,
        "output_manifest_hash": _DEFERRED_OUTPUT_BINDING,
        "timestamp": _PREVIEW_TIMESTAMP,
    }

    proposed_snapshot = copy.deepcopy(old_snapshot)
    proposed_snapshot["unknowns"] = proposed_unknown_descriptions
    proposed_snapshot["operator_history"] = list(old_snapshot.get("operator_history", [])) + [operator_event]
    proposed_snapshot["claim_status"] = str(selected.get("claim_status"))
    proposed_snapshot["proof_debt"] = float(selected.get("proof_debt", old_manifest.proof_debt))
    proposed_snapshot["phase_path"] = list(old_snapshot.get("phase_path", [])) + [str(old_snapshot.get("phase_state"))]
    proposed_snapshot["output_permissions"] = OutputPermission.SEALED.value
    proposed_snapshot["created_at"] = _PREVIEW_TIMESTAMP
    proposed_snapshot["updated_at"] = _PREVIEW_TIMESTAMP

    proposed_manifest = from_dict(proposed_snapshot)
    validation = validate_manifest(proposed_manifest)
    new_manifest_hash = canonical_hash(proposed_manifest)
    proposed_canonical = canonical_dict(proposed_manifest)

    operator_history_update = {
        "before_count": len(old_snapshot.get("operator_history", [])),
        "after_count": len(proposed_snapshot.get("operator_history", [])),
        "appended_operator_id": operator_event["operator_id"],
        "appended_operator_family": operator_event["operator_family"],
        "input_manifest_hash": old_manifest_hash,
        "selected_sealed_candidate_hash": selected_sealed_candidate_hash,
        "output_manifest_hash_binding": _DEFERRED_OUTPUT_BINDING,
        "output_hash_binding_deferred_until_persistence": True,
    }
    claim_status_history_update = {
        "before": str(old_snapshot.get("claim_status")),
        "proposed_after": str(proposed_snapshot.get("claim_status")),
        "selected_candidate_claim_status": str(selected.get("claim_status")),
        "claim_promotion_to_verified_fact": False,
    }
    unknown_vector_update = {
        "before_count": len(before_unknowns),
        "proposed_after_count": len(proposed_unknown_descriptions),
        "retained_unknowns": retained_unknowns,
        "added_unknowns": added_unknowns,
        "resolved_unknowns": resolved_unknowns,
        "resolved_unknown_count": len(resolved_unknowns),
        "evidence_resolution_claimed": False,
        "proposed_unknowns": proposed_unknown_descriptions,
    }
    proof_debt_update = {
        "before": float(old_snapshot.get("proof_debt", 1.0)),
        "proposed_after": float(proposed_snapshot.get("proof_debt", 1.0)),
        "delta": round(float(proposed_snapshot.get("proof_debt", 1.0)) - float(old_snapshot.get("proof_debt", 1.0)), 6),
        "evidence_added": False,
        "verified_claim_permitted": False,
    }
    phase_path_update = {
        "before": list(old_snapshot.get("phase_path", [])),
        "proposed_after": list(proposed_snapshot.get("phase_path", [])),
        "phase_state_before": str(old_snapshot.get("phase_state")),
        "phase_state_after": str(proposed_snapshot.get("phase_state")),
        "phase_transition_executed": False,
        "note": "Patch 293 records the current phase in the preview path; no phase promotion is executed.",
    }

    transition_hash_basis = {
        "old_manifest_hash": old_manifest_hash,
        "selected_candidate_hash": selected_candidate_hash,
        "selected_sealed_candidate_hash": selected_sealed_candidate_hash,
        "new_manifest_hash": new_manifest_hash,
        "operator_history_update": operator_history_update,
        "claim_status_history_update": claim_status_history_update,
        "unknown_vector_update": unknown_vector_update,
        "proof_debt_update": proof_debt_update,
        "phase_path_update": phase_path_update,
        "persistence_permitted": False,
    }
    transition_preview_hash = _sha256(transition_hash_basis)

    return {
        "status": "OK",
        "endpoint": MANIFEST_ADVANCE_PREVIEW_ROUTE,
        "mode": MANIFEST_ADVANCE_PREVIEW_MODE,
        "current_patch": MANIFEST_ADVANCE_PREVIEW_PATCH_ID,
        "schema_version": MANIFEST_ADVANCE_PREVIEW_SCHEMA_VERSION,
        "formula": MANIFEST_ADVANCE_PREVIEW_FORMULA,
        "preview_type": "mea_live_manifest_advance_preview_no_persistence",
        "problem_id": old_manifest.problem_id,
        "manifest_advance_preview_visible": True,
        "source_gate_route": "/api/mea/seal-candidate-gate",
        "source_gate_status": "ACCEPTED_PREVIEW_ONLY",
        "source_gate_response_only": True,
        "old_manifest_hash": old_manifest_hash,
        "selected_candidate_id": candidate_id,
        "selected_candidate_hash": selected_candidate_hash,
        "selected_sealed_candidate_hash": selected_sealed_candidate_hash,
        "selected_sealed_candidate_preview_hash": selected_sealed_candidate_hash,
        "new_manifest_hash": new_manifest_hash,
        "old_manifest_hash_matches_candidate_parent": True,
        "selected_sealed_candidate_hash_valid": True,
        "operator_history_update": operator_history_update,
        "claim_status_history_update": claim_status_history_update,
        "unknown_vector_update": unknown_vector_update,
        "proof_debt_update": proof_debt_update,
        "phase_path_update": phase_path_update,
        "old_manifest_preview": old_canonical,
        "new_manifest_preview": proposed_canonical,
        "new_manifest_validation": {
            "valid": bool(validation.valid),
            "errors": list(validation.errors),
            "warnings": list(validation.warnings),
        },
        "transition_preview_hash": transition_preview_hash,
        "selected_sealed_candidate_live": False,
        "seal_execution_permitted": False,
        "seals_candidates": False,
        "commits_live_candidates": False,
        "advances_live_manifest": False,
        "persistence_permitted": False,
        "persisted": False,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "performs_network_io": False,
        "renders_user_output": False,
        "promotes_to_memory": False,
        "seal_route_available": False,
        "live_problem_manifest_route_available": False,
        "output_hash_binding_deferred_until_persistence": True,
        "boundary": manifest_advance_preview_boundary(),
    }


def build_manifest_advance_preview(candidate_id: str = _DEFAULT_CANDIDATE_ID, endpoint: str = MANIFEST_ADVANCE_PREVIEW_ROUTE) -> Dict[str, Any]:
    first = _compile_transition(candidate_id)
    second = _compile_transition(candidate_id)
    payload = dict(first)
    payload["endpoint"] = endpoint
    payload["new_manifest_hash_stability_proven"] = (
        first["new_manifest_hash"] == second["new_manifest_hash"] and _is_sha256(first["new_manifest_hash"])
    )
    payload["transition_preview_hash_stability_proven"] = (
        first["transition_preview_hash"] == second["transition_preview_hash"] and _is_sha256(first["transition_preview_hash"])
    )
    return payload
