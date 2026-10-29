"""
forge/rmc_engine_v1/mea/seal_transaction_preflight.py

Patch 296R — MEA Transaction Trace Source-Binding Hotfix.

This module closes the safety seam between the first persisted MEA problem
manifest (Patch 294), the first live candidate surface generated from that
persisted state (Patch 295), and a future atomic seal-and-advance mutation.

Patch 296R also repairs a source-binding defect found in the accepted Patch 296 live receipt: the proposed operator trace previously serialized null source hashes. It now hard-binds the trace to the verified persisted manifest hash and state-content hash, and rejects any unbound proposal.

It intentionally does not execute that mutation.  The single POST route
requires an explicit operator choice and binds all of the following into one
stable transaction-intent preview:

    persisted M_t integrity and content hash
      -> explicitly submitted candidate from /api/mea/candidates
      -> live candidate hash and reusable gate report hash
      -> transaction-scoped seal packet preview hash
      -> transaction audit-chain preview hash
      -> proposed M_(t+1) hash
      -> future write-receipt preview hash
      -> future rollback-plan preview hash

Hard boundary:
- no /api/mea/seal route;
- no seal execution;
- no candidate commit;
- no live manifest advance;
- no filesystem write or MEA state mutation;
- no memory, Chroma, Identity Vault, LLM, shell, network, or rendering action.

The current ranking is never interpreted as selection.  A candidate is only
considered after its id and hash are expressly supplied in the POST body.
"""

from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path
from typing import Any, Dict, Mapping, Optional, Sequence, Tuple

from .live_candidates import build_live_candidates_payload
from .manifest_schema import ClaimStatus, OperatorTrace, canonical_dict, canonical_hash, from_dict, validate_manifest
from .problem_manifest_store import output_permission_interpretation, problem_manifest_store_status

TRANSACTION_PREFLIGHT_PATCH_ID = "Patch 296R — MEA Transaction Trace Source-Binding Hotfix"
TRANSACTION_PREFLIGHT_SCHEMA_VERSION = "mea_seal_transaction_preflight_v1_patch296r"
TRANSACTION_PREFLIGHT_MODE = "controlled_mea_persisted_state_seal_advance_preflight_patch296r"
TRANSACTION_PREFLIGHT_POST_ROUTE = "/api/mea/seal-transaction-preflight"
TRANSACTION_PREFLIGHT_APPROVAL_TOKEN = "APPROVE_MEA_SEAL_TRANSACTION_PREFLIGHT"
TRANSACTION_PREFLIGHT_FORMULA = (
    "TxPreflight(M_t,c*)=Integrity(M_t)∧ExplicitSelect(c*)∧HashBind(M_t,c*)∧"
    "GatePass(c*)∧ClaimBound(c*)∧Replay(c*)∧PacketHash∧AuditHash∧AdvancePreview; "
    "execute=false; persist=false; memory=false"
)

_REQUIRED_REQUEST_FIELDS = (
    "approval_token",
    "source_manifest_hash",
    "source_state_content_hash",
    "candidate_id",
    "candidate_hash",
)
_ALLOWED_CLAIM_STATUSES = (ClaimStatus.HYPOTHESIS.value, ClaimStatus.SPECULATIVE_BRANCH.value)
_HYPOTHESIS_TEST_GAP = "Harmonic derivation path is opened but not sealed as empirical measurement."
_TRACE_OUTPUT_BINDING = "PATCH296R_OUTPUT_HASH_BINDING_DEFERRED_UNTIL_FUTURE_ATOMIC_ADVANCE"
_TRACE_TIMESTAMP = "PATCH296R_PREFLIGHT_NO_PERSISTENCE"


def _stable_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _stable_hash(value: Any) -> str:
    return hashlib.sha256(_stable_json(value).encode("utf-8")).hexdigest()


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _sequence(value: Any) -> Sequence[Any]:
    return value if isinstance(value, (list, tuple)) else ()


def _is_sha256(value: Any) -> bool:
    return isinstance(value, str) and len(value) == 64 and all(char in "0123456789abcdef" for char in value)


def transaction_preflight_boundary() -> Dict[str, Any]:
    return {
        "patch": TRANSACTION_PREFLIGHT_PATCH_ID,
        "schema_version": TRANSACTION_PREFLIGHT_SCHEMA_VERSION,
        "layer": "MEA persisted-state seal/advance transaction preflight / explicit selection no mutation",
        "read_only": False,
        "non_mutating": True,
        "creates_get_routes": False,
        "creates_post_routes": True,
        "get_routes": [],
        "post_routes": [TRANSACTION_PREFLIGHT_POST_ROUTE],
        "requires_approval_token": True,
        "approval_token": TRANSACTION_PREFLIGHT_APPROVAL_TOKEN,
        "requires_explicit_candidate_selection": True,
        "requires_source_manifest_hash_match": True,
        "requires_source_state_content_hash_match": True,
        "reads_files": True,
        "reads_mea_runtime_state": True,
        "requires_persisted_state_integrity": True,
        "generates_candidates_from_persisted_manifest": True,
        "uses_live_candidate_api_chain": True,
        "score_can_rank": True,
        "score_can_select": False,
        "score_can_override_gates": False,
        "compiles_transaction_seal_packet_preview": True,
        "compiles_transaction_audit_chain_preview": True,
        "compiles_manifest_advance_preview": True,
        "compiles_receipt_preview": True,
        "compiles_rollback_preview": True,
        "writes_files": False,
        "writes_mea_runtime_state": False,
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
        "memory_promotion_route_available": False,
        "future_mutation_patch_required": True,
    }


def _base_payload(endpoint: str = TRANSACTION_PREFLIGHT_POST_ROUTE) -> Dict[str, Any]:
    return {
        "endpoint": endpoint,
        "mode": TRANSACTION_PREFLIGHT_MODE,
        "current_patch": TRANSACTION_PREFLIGHT_PATCH_ID,
        "schema_version": TRANSACTION_PREFLIGHT_SCHEMA_VERSION,
        "formula": TRANSACTION_PREFLIGHT_FORMULA,
        "preview_type": "persisted_state_seal_advance_transaction_preflight_no_mutation",
        "approval_required": True,
        "expected_approval_token": TRANSACTION_PREFLIGHT_APPROVAL_TOKEN,
        "selection_requires_explicit_candidate_submission": True,
        "selection_executed": False,
        "ranked_candidate_auto_selected": False,
        "transaction_preflight_only": True,
        "writes_files": False,
        "writes_mea_runtime_state": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "performs_network_io": False,
        "commits_live_candidates": False,
        "advances_live_manifest": False,
        "seals_candidates": False,
        "executes_seal": False,
        "promotes_to_memory": False,
        "renders_user_output": False,
        "seal_route_available": False,
        "memory_promotion_route_available": False,
        "boundary": transaction_preflight_boundary(),
    }


def _rejection(reason_code: str, errors: Sequence[str], request: Optional[Mapping[str, Any]] = None, *, endpoint: str = TRANSACTION_PREFLIGHT_POST_ROUTE) -> Dict[str, Any]:
    req = _mapping(request)
    payload = _base_payload(endpoint)
    payload.update({
        "status": "REJECTED",
        "gate_status": "REJECTED",
        "accepted": False,
        "reason_code": reason_code,
        "gate_errors": list(errors),
        "candidate_id": req.get("candidate_id"),
        "source_state_integrity_verified": False,
        "source_manifest_hash_matches_persisted_state": False,
        "source_state_content_hash_matches_persisted_state": False,
        "candidate_generated_from_persisted_state": False,
        "candidate_hash_matches_live_report": False,
        "gate_engine_passed": False,
        "claim_status_allowed": False,
        "proof_debt_compatible_with_claim_status": False,
        "replay_confirmed": False,
        "tamper_detected": False,
        "transaction_intent_created": False,
        "receipt_preview_created": False,
        "rollback_preview_created": False,
    })
    return payload


def _proof_debt_compatible(claim_status: str, proof_debt: float) -> bool:
    if claim_status == ClaimStatus.HYPOTHESIS.value:
        return proof_debt < 0.95
    if claim_status == ClaimStatus.SPECULATIVE_BRANCH.value:
        return proof_debt <= 1.0
    return False


def _selected_candidate(live_payload: Mapping[str, Any], candidate_id: str) -> Optional[Mapping[str, Any]]:
    for row in _sequence(live_payload.get("candidates")):
        if isinstance(row, Mapping) and row.get("candidate_id") == candidate_id:
            return row
    return None


def _build_proposed_next_manifest(source_status: Mapping[str, Any], selected: Mapping[str, Any]) -> Dict[str, Any]:
    state = _mapping(source_status.get("stored_state"))
    state_core = _mapping(state.get("state_core"))
    parent_payload = copy.deepcopy(_mapping(state_core.get("canonical_manifest")))
    draft_payload = copy.deepcopy(_mapping(_mapping(selected.get("draft_result")).get("draft_manifest")))
    if not parent_payload or not draft_payload:
        raise ValueError("verified persisted source manifest or selected draft manifest missing")

    # Build only from the selected live candidate's proposed state, but restore
    # authoritative persisted identity and history fields from M_t.
    next_payload = dict(canonical_dict(draft_payload))
    next_payload["problem_id"] = parent_payload["problem_id"]
    next_payload["proof_debt"] = float(parent_payload.get("proof_debt", 1.0))
    next_payload["claim_status"] = str(selected.get("claim_status"))
    next_payload["output_permissions"] = str(parent_payload.get("output_permissions", "sealed"))
    next_payload["memory_ancestry"] = copy.deepcopy(parent_payload.get("memory_ancestry", []))

    # The Patch 293 transition law remains explicit: opening a hypothesis path
    # adds a test-required unknown; it never claims empirical resolution.
    proposed_unknowns = list(next_payload.get("unknowns", []))
    if selected.get("claim_status") == ClaimStatus.HYPOTHESIS.value and _HYPOTHESIS_TEST_GAP not in proposed_unknowns:
        proposed_unknowns.append(_HYPOTHESIS_TEST_GAP)
    next_payload["unknowns"] = proposed_unknowns

    phase_path = list(parent_payload.get("phase_path", []))
    phase_state = str(parent_payload.get("phase_state", "unknown"))
    if phase_state not in phase_path:
        phase_path.append(phase_state)
    next_payload["phase_path"] = phase_path
    next_payload["phase_state"] = phase_state

    trace = OperatorTrace(
        operator_id="preflight_select_explicit_live_candidate_source_bound",
        parameters={
            "candidate_id": selected.get("candidate_id"),
            "candidate_hash": selected.get("candidate_hash"),
            "gate_report_hash": selected.get("gate_report_hash"),
            "score_hash": selected.get("score_hash"),
            "source_state_content_hash": source_status.get("state_content_hash"),
            "explicit_selection": True,
            "ranked_candidate_auto_selected": False,
            "persisted": False,
            "seal_execution_permitted": False,
        },
        input_manifest_hash=str(source_status.get("manifest_hash")),
        output_manifest_hash=_TRACE_OUTPUT_BINDING,
        timestamp=_TRACE_TIMESTAMP,
        operator_family="system",
    )
    next_payload["operator_history"] = list(parent_payload.get("operator_history", [])) + [canonical_dict(trace)]
    next_manifest = from_dict(next_payload)
    validation = validate_manifest(next_manifest)
    if not validation.valid:
        raise ValueError("proposed next manifest failed validation: " + "; ".join(validation.errors))
    if list(next_manifest.known_facts) != list(parent_payload.get("known_facts", [])):
        raise ValueError("proposed transition attempted to invent or remove known facts")
    if list(next_manifest.constraints) != list(parent_payload.get("constraints", [])):
        raise ValueError("proposed transition attempted to alter source constraints")
    return {
        "manifest": canonical_dict(next_manifest),
        "manifest_hash": canonical_hash(next_manifest),
        "validation": {"valid": validation.valid, "errors": list(validation.errors), "warnings": list(validation.warnings)},
        "output_hash_binding_deferred_until_future_atomic_advance": True,
    }


def _compile_transaction_objects(source_status: Mapping[str, Any], live_payload: Mapping[str, Any], selected: Mapping[str, Any]) -> Dict[str, Any]:
    source_manifest_hash = str(live_payload.get("source_manifest_hash"))
    state_content_hash = str(live_payload.get("source_state_content_hash"))
    gate_report = _mapping(selected.get("gate_report"))
    replay_report = _mapping(selected.get("replay_report"))
    score_bundle = _mapping(selected.get("score_bundle"))
    proof_score = _mapping(score_bundle.get("proof_debt"))
    proof_debt = float(proof_score.get("proof_debt", 1.0))
    proposed = _build_proposed_next_manifest(source_status, selected)

    seal_packet = {
        "schema_version": "mea_transaction_seal_packet_preflight_v1_patch296r",
        "packet_status": "PREFLIGHT_ONLY_NOT_EXECUTED",
        "source_transaction_id": live_payload.get("source_transaction_id"),
        "source_manifest_hash": source_manifest_hash,
        "source_state_content_hash": state_content_hash,
        "candidate_set_hash": live_payload.get("candidate_set_hash"),
        "candidate_id": selected.get("candidate_id"),
        "candidate_hash": selected.get("candidate_hash"),
        "claim_status": selected.get("claim_status"),
        "proof_debt": proof_debt,
        "score_hash": selected.get("score_hash"),
        "gate_report_hash": selected.get("gate_report_hash"),
        "gate_decision": selected.get("gate_decision"),
        "replay_confirmed": replay_report.get("replay_confirmed") is True,
        "tamper_detected": replay_report.get("tamper_detected") is True,
        "proposed_new_manifest_hash": proposed["manifest_hash"],
        "explicit_selection": True,
        "ranked_candidate_auto_selected": False,
        "seal_execution_permitted": False,
        "advances_live_manifest": False,
        "writes_memory": False,
    }
    seal_packet_hash = _stable_hash(seal_packet)
    audit_chain = {
        "schema_version": "mea_transaction_audit_chain_preflight_v1_patch296r",
        "source_manifest_hash": source_manifest_hash,
        "source_state_content_hash": state_content_hash,
        "candidate_set_hash": live_payload.get("candidate_set_hash"),
        "candidate_hash": selected.get("candidate_hash"),
        "gate_report_hash": selected.get("gate_report_hash"),
        "transaction_seal_packet_hash": seal_packet_hash,
        "proposed_new_manifest_hash": proposed["manifest_hash"],
        "execution": False,
    }
    audit_chain_hash = _stable_hash(audit_chain)
    transaction_intent = {
        "schema_version": TRANSACTION_PREFLIGHT_SCHEMA_VERSION,
        "intent_status": "PREFLIGHT_ONLY_NOT_EXECUTED",
        "source_transaction_id": live_payload.get("source_transaction_id"),
        "source_manifest_hash": source_manifest_hash,
        "source_state_content_hash": state_content_hash,
        "candidate_id": selected.get("candidate_id"),
        "candidate_hash": selected.get("candidate_hash"),
        "claim_status": selected.get("claim_status"),
        "proof_debt": proof_debt,
        "gate_report_hash": selected.get("gate_report_hash"),
        "transaction_seal_packet_hash": seal_packet_hash,
        "transaction_audit_chain_hash": audit_chain_hash,
        "proposed_new_manifest_hash": proposed["manifest_hash"],
        "output_hash_binding_deferred_until_future_atomic_advance": True,
        "explicit_selection": True,
        "selection_basis": "submitted_candidate_id_and_hash_not_rank",
        "seal_execution_permitted": False,
        "commits_live_candidates": False,
        "advances_live_manifest": False,
        "persistence_permitted": False,
        "writes_memory": False,
    }
    transaction_intent_hash = _stable_hash(transaction_intent)
    receipt_preview = {
        "schema_version": "mea_future_transaction_receipt_preview_v1_patch296r",
        "receipt_status": "PREVIEW_ONLY_NOT_WRITTEN",
        "transaction_intent_hash": transaction_intent_hash,
        "source_manifest_hash": source_manifest_hash,
        "source_state_content_hash": state_content_hash,
        "candidate_hash": selected.get("candidate_hash"),
        "proposed_new_manifest_hash": proposed["manifest_hash"],
        "transaction_audit_chain_hash": audit_chain_hash,
        "future_atomic_write_required": True,
        "write_performed": False,
    }
    receipt_preview_hash = _stable_hash(receipt_preview)
    rollback_preview = {
        "schema_version": "mea_future_transaction_rollback_preview_v1_patch296r",
        "rollback_status": "PREVIEW_ONLY_NOT_NEEDED_NOT_EXECUTED",
        "transaction_intent_hash": transaction_intent_hash,
        "receipt_preview_hash": receipt_preview_hash,
        "restore_source_manifest_hash": source_manifest_hash,
        "restore_source_state_content_hash": state_content_hash,
        "candidate_hash_never_committed": selected.get("candidate_hash"),
        "rollback_performed": False,
    }
    rollback_preview_hash = _stable_hash(rollback_preview)
    return {
        "proof_debt": proof_debt,
        "proposed": proposed,
        "transaction_seal_packet": seal_packet,
        "transaction_seal_packet_hash": seal_packet_hash,
        "transaction_audit_chain": audit_chain,
        "transaction_audit_chain_hash": audit_chain_hash,
        "transaction_intent": transaction_intent,
        "transaction_intent_hash": transaction_intent_hash,
        "receipt_preview": receipt_preview,
        "receipt_preview_hash": receipt_preview_hash,
        "rollback_preview": rollback_preview,
        "rollback_preview_hash": rollback_preview_hash,
        "gate_report": gate_report,
        "replay_report": replay_report,
    }


def evaluate_seal_transaction_preflight_request(
    request: Optional[Mapping[str, Any]],
    *,
    store_root: Optional[Path] = None,
    endpoint: str = TRANSACTION_PREFLIGHT_POST_ROUTE,
) -> Dict[str, Any]:
    req = _mapping(request)
    if endpoint.split("?", 1)[0] != TRANSACTION_PREFLIGHT_POST_ROUTE:
        rejected = _rejection("route_mismatch", ["transaction preflight is authorized only on its canonical POST route"], req, endpoint=endpoint)
        rejected["route_mismatch_detected"] = True
        return rejected
    if req.get("approval_token") != TRANSACTION_PREFLIGHT_APPROVAL_TOKEN:
        return _rejection("approval_token_required", ["missing or invalid approval_token for persisted-state transaction preflight"], req, endpoint=endpoint)

    source_manifest_hash = str(req.get("source_manifest_hash") or "")
    source_state_content_hash = str(req.get("source_state_content_hash") or "")
    candidate_id = str(req.get("candidate_id") or "")
    candidate_hash = str(req.get("candidate_hash") or "")
    if not (_is_sha256(source_manifest_hash) and _is_sha256(source_state_content_hash) and candidate_id and _is_sha256(candidate_hash)):
        return _rejection("required_hash_fields_invalid", ["source_manifest_hash, source_state_content_hash, candidate_id, and candidate_hash are required; hashes must be SHA-256 hex"], req, endpoint=endpoint)

    live_payload = build_live_candidates_payload(store_root=store_root, endpoint="/api/mea/candidates")
    source_status = problem_manifest_store_status(store_root=store_root, endpoint="/api/mea/problem-manifest")
    if live_payload.get("status") != "OK" or live_payload.get("source_state_integrity_verified") is not True or source_status.get("integrity_verified") is not True:
        return _rejection("persisted_source_state_blocked", ["verified persisted source state is required before transaction preflight"], req, endpoint=endpoint)
    if source_status.get("manifest_hash") != live_payload.get("source_manifest_hash") or source_status.get("state_content_hash") != live_payload.get("source_state_content_hash"):
        return _rejection("persisted_source_chain_disagreement", ["live candidate report does not bind to current verified persisted-state readback"], req, endpoint=endpoint)
    if source_manifest_hash != live_payload.get("source_manifest_hash"):
        return _rejection("source_manifest_hash_mismatch", ["submitted source_manifest_hash does not match the verified persisted manifest"], req, endpoint=endpoint)
    if source_state_content_hash != live_payload.get("source_state_content_hash"):
        return _rejection("source_state_content_hash_mismatch", ["submitted source_state_content_hash does not match verified persisted state content"], req, endpoint=endpoint)

    selected = _selected_candidate(live_payload, candidate_id)
    if selected is None:
        return _rejection("candidate_not_in_live_report", ["candidate_id was not generated from the verified persisted manifest"], req, endpoint=endpoint)
    if candidate_hash != selected.get("candidate_hash"):
        return _rejection("candidate_hash_mismatch", ["submitted candidate_hash does not match the live candidate generated from persisted state"], req, endpoint=endpoint)
    if req.get("candidate_set_hash") is not None and str(req.get("candidate_set_hash")) != str(live_payload.get("candidate_set_hash")):
        return _rejection("candidate_set_hash_mismatch", ["submitted candidate_set_hash does not match current live candidate report"], req, endpoint=endpoint)
    if req.get("gate_report_hash") is not None and str(req.get("gate_report_hash")) != str(selected.get("gate_report_hash")):
        return _rejection("gate_report_hash_mismatch", ["submitted gate_report_hash does not match selected live candidate"], req, endpoint=endpoint)

    gate = _mapping(selected.get("gate_report"))
    replay = _mapping(selected.get("replay_report"))
    proof = _mapping(_mapping(selected.get("score_bundle")).get("proof_debt"))
    proof_debt = float(proof.get("proof_debt", 1.0))
    claim_status = str(selected.get("claim_status"))
    if claim_status not in _ALLOWED_CLAIM_STATUSES:
        return _rejection(
            "candidate_not_transaction_eligible",
            ["only an explicitly selected hypothesis or speculative_branch may enter seal/advance preflight"],
            req,
            endpoint=endpoint,
        )
    checks = {
        "source_state_integrity_verified": live_payload.get("source_state_integrity_verified") is True,
        "source_manifest_hash_matches_persisted_state": selected.get("source_manifest_hash") == source_manifest_hash and selected.get("parent_hash") == source_manifest_hash,
        "source_state_content_hash_matches_persisted_state": selected.get("source_state_content_hash") == source_state_content_hash,
        "candidate_generated_from_persisted_state": selected.get("persisted_state_consumed") is True,
        "candidate_hash_matches_live_report": candidate_hash == selected.get("candidate_hash"),
        "candidate_explicitly_selected": True,
        "gate_engine_passed": gate.get("hard_gate_passed") is True and gate.get("selectable_preview") is True and gate.get("decision") in {"PASS_PREVIEW_ONLY", "PASS_BOUNDED_PREVIEW_ONLY"},
        "claim_status_allowed": claim_status in _ALLOWED_CLAIM_STATUSES,
        "proof_debt_compatible_with_claim_status": _proof_debt_compatible(claim_status, proof_debt),
        "replay_confirmed": replay.get("replay_confirmed") is True,
        "tamper_detected": replay.get("tamper_detected") is True or selected.get("containment_preview") is True,
        "route_mismatch_detected": False,
        "score_did_not_select_candidate": live_payload.get("selection_executed") is False and live_payload.get("selected_candidate_id") is None,
    }
    if checks["tamper_detected"]:
        return _rejection("tamper_or_containment_candidate_rejected", ["selected candidate is tampered or routed to containment"], req, endpoint=endpoint)
    failed_checks = [name for name, passed in checks.items() if name != "tamper_detected" and name != "route_mismatch_detected" and passed is not True]
    if failed_checks:
        return _rejection("transaction_preflight_checks_failed", failed_checks, req, endpoint=endpoint)

    compiled = _compile_transaction_objects(source_status, live_payload, selected)
    repeat = _compile_transaction_objects(source_status, live_payload, selected)
    proposed_manifest = compiled["proposed"]["manifest"]
    proposed_history = list(_sequence(proposed_manifest.get("operator_history")))
    proposed_trace = _mapping(proposed_history[-1]) if proposed_history else {}
    proposed_trace_parameters = _mapping(proposed_trace.get("parameters"))
    transaction_trace_source_binding_verified = (
        proposed_trace.get("input_manifest_hash") == source_manifest_hash
        and proposed_trace_parameters.get("source_state_content_hash") == source_state_content_hash
    )
    if not transaction_trace_source_binding_verified:
        return _rejection(
            "proposed_trace_source_binding_failed",
            ["proposed operator trace is not bound to the current persisted source manifest and state-content hashes"],
            req,
            endpoint=endpoint,
        )
    payload = _base_payload(endpoint)
    payload.update({
        "status": "OK",
        "gate_status": "ACCEPTED_PREFLIGHT_ONLY",
        "accepted": True,
        "source_transaction_id": live_payload.get("source_transaction_id"),
        "source_manifest_hash": source_manifest_hash,
        "source_state_content_hash": source_state_content_hash,
        "candidate_id": candidate_id,
        "candidate_hash": candidate_hash,
        "claim_status": claim_status,
        "proof_debt": compiled["proof_debt"],
        "candidate_set_hash": live_payload.get("candidate_set_hash"),
        "highest_ranked_candidate_id": live_payload.get("highest_ranked_candidate_id"),
        "highest_ranked_claim_status": live_payload.get("highest_ranked_claim_status"),
        "selection_basis": "submitted_candidate_id_and_hash_not_rank",
        "explicit_selection_received": True,
        "source_state_integrity_verified": checks["source_state_integrity_verified"],
        "source_manifest_hash_matches_persisted_state": checks["source_manifest_hash_matches_persisted_state"],
        "source_state_content_hash_matches_persisted_state": checks["source_state_content_hash_matches_persisted_state"],
        "candidate_generated_from_persisted_state": checks["candidate_generated_from_persisted_state"],
        "candidate_hash_matches_live_report": checks["candidate_hash_matches_live_report"],
        "gate_engine_passed": checks["gate_engine_passed"],
        "claim_status_allowed": checks["claim_status_allowed"],
        "proof_debt_compatible_with_claim_status": checks["proof_debt_compatible_with_claim_status"],
        "replay_confirmed": checks["replay_confirmed"],
        "tamper_detected": False,
        "route_mismatch_detected": False,
        "score_did_not_select_candidate": checks["score_did_not_select_candidate"],
        "transaction_trace_source_binding_repaired": True,
        "transaction_trace_source_binding_verified": transaction_trace_source_binding_verified,
        "proposed_trace_input_manifest_hash": proposed_trace.get("input_manifest_hash"),
        "proposed_trace_source_state_content_hash": proposed_trace_parameters.get("source_state_content_hash"),
        "transaction_seal_packet_preview": compiled["transaction_seal_packet"],
        "transaction_seal_packet_hash": compiled["transaction_seal_packet_hash"],
        "transaction_audit_chain_preview": compiled["transaction_audit_chain"],
        "transaction_audit_chain_hash": compiled["transaction_audit_chain_hash"],
        "transaction_seal_packet_bound_to_persisted_state": (
            compiled["transaction_seal_packet"].get("source_manifest_hash") == source_manifest_hash
            and compiled["transaction_seal_packet"].get("source_state_content_hash") == source_state_content_hash
            and compiled["transaction_seal_packet"].get("candidate_hash") == candidate_hash
        ),
        "transaction_seal_packet_hash_matches_audit_chain": compiled["transaction_audit_chain"].get("transaction_seal_packet_hash") == compiled["transaction_seal_packet_hash"],
        "proposed_manifest_bound_to_selected_candidate": (
            compiled["transaction_seal_packet"].get("candidate_hash") == candidate_hash
            and compiled["transaction_seal_packet"].get("proposed_new_manifest_hash") == compiled["proposed"]["manifest_hash"]
        ),
        "proposed_new_manifest": proposed_manifest,
        "proposed_new_manifest_hash": compiled["proposed"]["manifest_hash"],
        "proposed_manifest_validation": compiled["proposed"]["validation"],
        "output_hash_binding_deferred_until_future_atomic_advance": True,
        "operator_history_update": {
            "before_count": len(_sequence(_mapping(_mapping(source_status.get("stored_state")).get("state_core")).get("canonical_manifest", {}).get("operator_history"))),
            "after_count": len(_sequence(proposed_manifest.get("operator_history"))),
            "after_append_operation": "preflight_select_explicit_live_candidate_source_bound",
            "output_hash_binding_deferred_until_future_atomic_advance": True,
        },
        "claim_status_history_update": {
            "source": _mapping(_mapping(source_status.get("stored_state")).get("state_core")).get("canonical_manifest", {}).get("claim_status"),
            "proposed_after": claim_status,
            "claim_promotion_to_verified_fact": False,
        },
        "unknown_vector_update": {
            "source_unknown_count": len(_sequence(_mapping(_mapping(source_status.get("stored_state")).get("state_core")).get("canonical_manifest", {}).get("unknowns"))),
            "proposed_unknown_count": len(_sequence(proposed_manifest.get("unknowns"))),
            "evidence_resolution_claimed": False,
        },
        "proof_debt_update": {
            "proposed_after": compiled["proof_debt"],
            "evidence_added": False,
            "verified_claim_permitted": False,
        },
        "phase_path_update": {
            "proposed_after": proposed_manifest.get("phase_path", []),
            "phase_transition_executed": False,
        },
        "receipt_preview": compiled["receipt_preview"],
        "receipt_preview_hash": compiled["receipt_preview_hash"],
        "receipt_preview_bound_to_transaction_intent": compiled["receipt_preview"].get("transaction_intent_hash") == compiled["transaction_intent_hash"],
        "rollback_preview": compiled["rollback_preview"],
        "rollback_preview_hash": compiled["rollback_preview_hash"],
        "rollback_preview_bound_to_source_state": (
            compiled["rollback_preview"].get("restore_source_manifest_hash") == source_manifest_hash
            and compiled["rollback_preview"].get("restore_source_state_content_hash") == source_state_content_hash
        ),
        "transaction_intent": compiled["transaction_intent"],
        "transaction_intent_hash": compiled["transaction_intent_hash"],
        "transaction_hash_stability_proven": (
            compiled["transaction_intent_hash"] == repeat["transaction_intent_hash"]
            and compiled["transaction_seal_packet_hash"] == repeat["transaction_seal_packet_hash"]
            and compiled["transaction_audit_chain_hash"] == repeat["transaction_audit_chain_hash"]
            and compiled["proposed"]["manifest_hash"] == repeat["proposed"]["manifest_hash"]
            and compiled["receipt_preview_hash"] == repeat["receipt_preview_hash"]
            and compiled["rollback_preview_hash"] == repeat["rollback_preview_hash"]
        ),
        "transaction_intent_created": True,
        "receipt_preview_created": True,
        "rollback_preview_created": True,
        "output_permission_interpretation": output_permission_interpretation(str(proposed_manifest.get("output_permissions", "sealed"))),
    })
    return payload


def build_seal_transaction_preflight_preview(*, store_root: Optional[Path] = None, candidate_id: str = "cg_hypothesis_001", endpoint: str = TRANSACTION_PREFLIGHT_POST_ROUTE) -> Dict[str, Any]:
    live = build_live_candidates_payload(store_root=store_root, endpoint="/api/mea/candidates")
    if live.get("status") != "OK":
        return _rejection("persisted_source_state_blocked", ["verified persisted source state is required before transaction preflight"], endpoint=endpoint)
    selected = _selected_candidate(live, candidate_id)
    if selected is None:
        return _rejection("candidate_not_in_live_report", ["candidate_id was not generated from persisted state"], {"candidate_id": candidate_id}, endpoint=endpoint)
    return evaluate_seal_transaction_preflight_request({
        "approval_token": TRANSACTION_PREFLIGHT_APPROVAL_TOKEN,
        "source_manifest_hash": live.get("source_manifest_hash"),
        "source_state_content_hash": live.get("source_state_content_hash"),
        "candidate_id": candidate_id,
        "candidate_hash": selected.get("candidate_hash"),
        "candidate_set_hash": live.get("candidate_set_hash"),
        "gate_report_hash": selected.get("gate_report_hash"),
    }, store_root=store_root, endpoint=endpoint)


# Patch 298 — read-only transaction-replay helper. It reuses the exact
# transaction compiler law against a verified detached source-state record;
# no route calls, locks, or state writes occur here.
def rebuild_transaction_objects_from_source_record(
    source_record: Mapping[str, Any],
    candidate_id: str,
) -> Dict[str, Any]:
    """Recompile the preflight transaction objects from a committed source record.

    Used only for non-mutating live trace replay after an advance has already
    happened. The source record is the rollback-embedded prior M_t verified by
    Patch 298 before this function is called.
    """
    from .live_candidates import rebuild_live_candidates_from_state_record

    live_payload = rebuild_live_candidates_from_state_record(source_record, endpoint="/api/mea/replay")
    if live_payload.get("status") != "OK":
        raise ValueError("unable to rebuild candidates from detached source state")
    selected = _selected_candidate(live_payload, str(candidate_id))
    if selected is None:
        raise ValueError("committed candidate_id is not reproducible from detached source state")
    source_status = {
        "status": "OK",
        "integrity_verified": True,
        "initialized": True,
        "transaction_id": source_record.get("transaction_id"),
        "manifest_hash": source_record.get("manifest_hash"),
        "state_content_hash": source_record.get("state_content_hash"),
        "stored_state": dict(source_record),
    }
    compiled = _compile_transaction_objects(source_status, live_payload, selected)
    return {
        "source_status": source_status,
        "live_payload": live_payload,
        "selected_candidate": dict(selected),
        **compiled,
    }
