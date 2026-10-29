"""
forge/rmc_engine_v1/mea/live_trace_replay.py

Patch 298 — MEA Live Trace Replay Verification.

This module verifies a committed MEA advance after Patch 297/297R without
executing a new transition. It replays the selected candidate and transaction
objects from the rollback-embedded source state M_t, then compares the
reconstructed evidence chain with the persisted committed M_(t+1), receipt,
and rollback record.

Hard boundary:
- POST /api/mea/replay is an approval-gated verification action only.
- It reads the Forge-owned MEA state store and linked artifacts.
- It does not write files, advance state, execute a seal, commit a candidate,
  write memory, promote memory, call an LLM, execute shell, or render output.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Mapping, Optional, Sequence, Tuple

from .problem_manifest_store import (
    _store_paths,
    _verify_linked_artifacts,
    _verify_state_record,
    output_permission_interpretation,
    problem_manifest_store_status,
)
from .seal_transaction_preflight import rebuild_transaction_objects_from_source_record

LIVE_TRACE_REPLAY_PATCH_ID = "Patch 298 — MEA Live Trace Replay Verification"
LIVE_TRACE_REPLAY_SCHEMA_VERSION = "mea_live_trace_replay_v1_patch298"
LIVE_TRACE_REPLAY_MODE = "mea_live_trace_replay_verification_non_mutating_patch298"
LIVE_TRACE_REPLAY_POST_ROUTE = "/api/mea/replay"
LIVE_TRACE_REPLAY_APPROVAL_TOKEN = "APPROVE_MEA_LIVE_TRACE_REPLAY"
LIVE_TRACE_REPLAY_FORMULA = (
    "ReplayCommitted(M_t,Tx,c*,M_t+1)=Integrity(M_t+1)∧Receipt∧Rollback(M_t)∧"
    "RebuildCandidate(M_t,c*)∧RecompileTx(M_t,c*)∧HashMatchAll; "
    "advance=false; seal=false; memory=false"
)
_REQUIRED_REQUEST_FIELDS: Tuple[str, ...] = (
    "transaction_id",
    "transaction_intent_hash",
    "candidate_id",
    "candidate_hash",
    "committed_manifest_hash",
    "committed_state_content_hash",
)
_EXPECTED_OUTPUT_HASH_BINDING_MODE = (
    "state_record_and_receipt_bind_committed_manifest_hash_without_self_referential_manifest_mutation"
)
_EXPECTED_DEFERRED_TRACE_OUTPUT_BINDING = "PATCH296R_OUTPUT_HASH_BINDING_DEFERRED_UNTIL_FUTURE_ATOMIC_ADVANCE"


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _sequence(value: Any) -> Sequence[Any]:
    return value if isinstance(value, (list, tuple)) else ()


def _is_sha256(value: Any) -> bool:
    return isinstance(value, str) and len(value) == 64 and all(ch in "0123456789abcdef" for ch in value)


def live_trace_replay_boundary() -> Dict[str, Any]:
    return {
        "patch": LIVE_TRACE_REPLAY_PATCH_ID,
        "schema_version": LIVE_TRACE_REPLAY_SCHEMA_VERSION,
        "layer": "MEA committed transaction live trace replay verification / non-mutating",
        "read_only": True,
        "non_mutating": True,
        "creates_get_routes": False,
        "creates_post_routes": True,
        "get_routes": [],
        "post_routes": [LIVE_TRACE_REPLAY_POST_ROUTE],
        "requires_approval_token": True,
        "approval_token": LIVE_TRACE_REPLAY_APPROVAL_TOKEN,
        "requires_explicit_committed_transaction_target": True,
        "reads_files": True,
        "reads_mea_runtime_state": True,
        "reads_commit_receipt": True,
        "reads_rollback_record": True,
        "replays_from_rollback_embedded_source_state": True,
        "rebuilds_candidate_from_source_state": True,
        "recompiles_transaction_from_source_state": True,
        "verifies_receipt_and_rollback_bindings": True,
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
        "mutates_existing_rmc_behavior": False,
        "mutates_launcher_behavior": False,
        "mutates_operator_console_ui": False,
        "canonical_seal_route_available": False,
        "seal_route_available": False,
        "memory_promotion_route_available": False,
    }


def _base_payload(endpoint: str) -> Dict[str, Any]:
    return {
        "endpoint": endpoint,
        "mode": LIVE_TRACE_REPLAY_MODE,
        "current_patch": LIVE_TRACE_REPLAY_PATCH_ID,
        "schema_version": LIVE_TRACE_REPLAY_SCHEMA_VERSION,
        "formula": LIVE_TRACE_REPLAY_FORMULA,
        "approval_required": True,
        "expected_approval_token": LIVE_TRACE_REPLAY_APPROVAL_TOKEN,
        "verification_only": True,
        "replay_execution_means_verification_not_new_transition": True,
        "write_performed": False,
        "invocation_candidate_commit_executed": False,
        "invocation_manifest_advance_executed": False,
        "invocation_seal_executed": False,
        "commits_live_candidates": False,
        "advances_live_manifest": False,
        "seals_candidates": False,
        "executes_seal": False,
        "writes_files": False,
        "writes_mea_runtime_state": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "performs_network_io": False,
        "promotes_to_memory": False,
        "renders_user_output": False,
        "canonical_seal_route_available": False,
        "seal_route_available": False,
        "boundary": live_trace_replay_boundary(),
    }


def _reject(reason_code: str, errors: Sequence[str], endpoint: str) -> Dict[str, Any]:
    payload = _base_payload(endpoint)
    payload.update({
        "status": "REJECTED",
        "gate_status": "REPLAY_REJECTED_NO_MUTATION",
        "accepted": False,
        "reason_code": reason_code,
        "replay_verified": False,
        "replay_errors": list(errors),
    })
    return payload


def _safe_load_artifact(root: Path, relpath: Any) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    if not isinstance(relpath, str) or not relpath.strip():
        return None, "artifact relative path missing"
    path = (root / relpath).resolve()
    try:
        path.relative_to(root.resolve())
    except ValueError:
        return None, "artifact path escapes MEA state root"
    if not path.exists() or path.is_symlink():
        return None, "artifact missing or symlinked"
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return None, f"artifact parse failed: {str(exc)[:160]}"
    if not isinstance(payload, dict):
        return None, "artifact payload is not an object"
    return payload, None


def evaluate_live_trace_replay_request(
    request: Optional[Mapping[str, Any]],
    *,
    store_root: Optional[Path] = None,
    endpoint: str = LIVE_TRACE_REPLAY_POST_ROUTE,
) -> Dict[str, Any]:
    """Verify the already committed transition from its stored source evidence chain."""
    req = dict(request or {}) if isinstance(request, Mapping) else {}
    if endpoint.split("?", 1)[0] != LIVE_TRACE_REPLAY_POST_ROUTE:
        return _reject("route_mismatch", ["live trace replay is authorized only on POST /api/mea/replay"], endpoint)
    if req.get("approval_token") != LIVE_TRACE_REPLAY_APPROVAL_TOKEN:
        return _reject("approval_token_required", ["missing or invalid approval token for live trace replay verification"], endpoint)
    missing = [field for field in _REQUIRED_REQUEST_FIELDS if not req.get(field)]
    invalid_hashes = [field for field in _REQUIRED_REQUEST_FIELDS if field not in {"transaction_id", "candidate_id"} and req.get(field) and not _is_sha256(req.get(field))]
    if missing or invalid_hashes:
        return _reject(
            "required_target_fields_invalid",
            (["missing required target fields: " + ", ".join(missing)] if missing else [])
            + (["invalid SHA-256 target fields: " + ", ".join(invalid_hashes)] if invalid_hashes else []),
            endpoint,
        )

    paths = _store_paths(store_root)
    status = problem_manifest_store_status(store_root=paths["root"], endpoint="/api/mea/problem-manifest")
    if status.get("status") != "OK" or status.get("integrity_verified") is not True:
        return _reject("committed_state_integrity_failed", ["current committed MEA state is not integrity verified"], endpoint)
    record = _mapping(status.get("stored_state"))
    state_core = _mapping(record.get("state_core"))
    if state_core.get("state_kind") != "mea_problem_manifest_committed_advance_state":
        return _reject("committed_advance_state_required", ["current MEA state is not a committed advance record"], endpoint)

    target_checks = {
        "transaction_id_matches_current_state": req.get("transaction_id") == record.get("transaction_id"),
        "transaction_intent_hash_matches_current_state": req.get("transaction_intent_hash") == record.get("transaction_intent_hash"),
        "candidate_id_matches_current_state": req.get("candidate_id") == record.get("candidate_id"),
        "candidate_hash_matches_current_state": req.get("candidate_hash") == record.get("candidate_hash"),
        "committed_manifest_hash_matches_current_state": req.get("committed_manifest_hash") == record.get("manifest_hash"),
        "committed_state_content_hash_matches_current_state": req.get("committed_state_content_hash") == record.get("state_content_hash"),
    }
    failed_targets = [name for name, passed in target_checks.items() if not passed]
    if failed_targets:
        return _reject("submitted_replay_target_mismatch", failed_targets, endpoint)

    linked_ok, linked_errors, linked_verified = _verify_linked_artifacts(record, paths)
    if not linked_ok:
        return _reject("committed_artifact_binding_failed", list(linked_errors), endpoint)
    receipt, receipt_error = _safe_load_artifact(paths["root"], record.get("write_receipt_relpath"))
    rollback, rollback_error = _safe_load_artifact(paths["root"], record.get("rollback_plan_relpath"))
    if receipt_error or rollback_error or receipt is None or rollback is None:
        return _reject("linked_artifact_load_failed", [err for err in (receipt_error, rollback_error) if err], endpoint)
    source_record = rollback.get("restore_state_record")
    if not isinstance(source_record, Mapping):
        return _reject("rollback_source_record_missing", ["rollback record does not embed prior source state"], endpoint)
    source_ok, source_errors, source_verified = _verify_state_record(source_record)
    source_linked_ok, source_linked_errors, source_linked_verified = _verify_linked_artifacts(source_record, paths)
    if not source_ok or not source_linked_ok:
        return _reject("rollback_source_state_integrity_failed", list(source_errors) + list(source_linked_errors), endpoint)

    source_binding_checks = {
        "source_manifest_hash_restored": source_record.get("manifest_hash") == record.get("source_manifest_hash"),
        "source_state_content_hash_restored": source_record.get("state_content_hash") == record.get("source_state_content_hash"),
        "source_transaction_id_restored": source_record.get("transaction_id") == record.get("source_transaction_id"),
        "rollback_restore_manifest_hash_bound": rollback.get("restore_source_manifest_hash") == record.get("source_manifest_hash"),
        "rollback_restore_state_content_hash_bound": rollback.get("restore_source_state_content_hash") == record.get("source_state_content_hash"),
    }
    failed_source = [name for name, passed in source_binding_checks.items() if not passed]
    if failed_source:
        return _reject("rollback_source_binding_mismatch", failed_source, endpoint)

    try:
        replay = rebuild_transaction_objects_from_source_record(source_record, str(record.get("candidate_id")))
    except Exception as exc:
        return _reject("transaction_reconstruction_failed", [str(exc)[:240]], endpoint)
    selected = _mapping(replay.get("selected_candidate"))
    compiled = replay
    current_manifest = _mapping(record.get("manifest"))
    trace_history = _sequence(current_manifest.get("operator_history"))
    trace = _mapping(trace_history[-1]) if trace_history else {}
    trace_parameters = _mapping(trace.get("parameters"))
    transaction_binding = _mapping(state_core.get("transaction_binding"))
    persistence_scope = _mapping(state_core.get("persistence_scope"))
    renderer_semantics = _mapping(record.get("output_permission_interpretation"))

    replay_checks = {
        "source_state_reconstructed_integrity_verified": source_ok and source_linked_ok,
        "candidate_rebuilt_from_source_state": selected.get("candidate_hash") == record.get("candidate_hash"),
        "candidate_id_rebuilt_from_source_state": selected.get("candidate_id") == record.get("candidate_id"),
        "candidate_claim_status_remains_hypothesis": selected.get("claim_status") == "hypothesis" and record.get("claim_status") == "hypothesis",
        "candidate_replay_confirmed": _mapping(selected.get("replay_report")).get("replay_confirmed") is True,
        "candidate_gate_passed_preview_path": _mapping(selected.get("gate_report")).get("hard_gate_passed") is True,
        "operator_trace_manifest_source_bound": trace.get("input_manifest_hash") == record.get("source_manifest_hash"),
        "operator_trace_state_source_bound": trace_parameters.get("source_state_content_hash") == record.get("source_state_content_hash"),
        "operator_trace_candidate_hash_bound": trace_parameters.get("candidate_hash") == record.get("candidate_hash"),
        "operator_trace_gate_report_hash_replayed": trace_parameters.get("gate_report_hash") == selected.get("gate_report_hash"),
        "transaction_seal_packet_hash_replayed": compiled.get("transaction_seal_packet_hash") == record.get("transaction_seal_packet_hash"),
        "transaction_audit_chain_hash_replayed": compiled.get("transaction_audit_chain_hash") == record.get("transaction_audit_chain_hash"),
        "transaction_intent_hash_replayed": compiled.get("transaction_intent_hash") == record.get("transaction_intent_hash"),
        "receipt_preview_hash_replayed": compiled.get("receipt_preview_hash") == record.get("preflight_receipt_preview_hash"),
        "rollback_preview_hash_replayed": compiled.get("rollback_preview_hash") == record.get("preflight_rollback_preview_hash"),
        "committed_manifest_hash_replayed": _mapping(compiled.get("proposed")).get("manifest_hash") == record.get("manifest_hash"),
        "receipt_binds_committed_manifest": receipt.get("manifest_hash") == record.get("manifest_hash") and receipt.get("state_content_hash") == record.get("state_content_hash"),
        "receipt_binds_transaction_intent": receipt.get("transaction_intent_hash") == record.get("transaction_intent_hash"),
        "rollback_binds_committed_manifest": rollback.get("manifest_hash") == record.get("manifest_hash") and rollback.get("state_content_hash") == record.get("state_content_hash"),
        "rollback_binds_commit_receipt": rollback.get("write_receipt_hash") == record.get("write_receipt_hash"),
        "state_transaction_binding_manifest_hash": transaction_binding.get("proposed_new_manifest_hash") == record.get("manifest_hash"),
        "state_transaction_binding_trace_verified": transaction_binding.get("trace_source_binding_verified") is True,
        "non_self_referential_output_binding_declared": state_core.get("output_hash_binding_mode") == _EXPECTED_OUTPUT_HASH_BINDING_MODE and trace.get("output_manifest_hash") == _EXPECTED_DEFERRED_TRACE_OUTPUT_BINDING,
        "claim_remains_hypothesis": record.get("claim_status") == "hypothesis",
        "proof_debt_unchanged_high": float(record.get("proof_debt", -1)) == 0.85,
        "renderer_remains_gated": renderer_semantics == output_permission_interpretation(str(record.get("manifest", {}).get("output_permissions", "sealed"))),
        "stored_memory_not_written": record.get("memory_written") is False and persistence_scope.get("memory_written") is False,
        "stored_memory_not_promoted": record.get("memory_promoted") is False and persistence_scope.get("memory_promoted") is False,
    }
    failed_replay = [name for name, passed in replay_checks.items() if not passed]
    if failed_replay:
        return _reject("committed_trace_replay_failed", failed_replay, endpoint)

    payload = _base_payload(endpoint)
    payload.update({
        "status": "OK",
        "gate_status": "REPLAY_VERIFIED_NO_MUTATION",
        "accepted": True,
        "replay_verified": True,
        "transaction_id": record.get("transaction_id"),
        "transaction_intent_hash": record.get("transaction_intent_hash"),
        "source_transaction_id": record.get("source_transaction_id"),
        "source_manifest_hash": record.get("source_manifest_hash"),
        "source_state_content_hash": record.get("source_state_content_hash"),
        "candidate_id": record.get("candidate_id"),
        "candidate_hash": record.get("candidate_hash"),
        "claim_status": record.get("claim_status"),
        "proof_debt": record.get("proof_debt"),
        "committed_manifest_hash": record.get("manifest_hash"),
        "committed_state_content_hash": record.get("state_content_hash"),
        "transaction_seal_packet_hash": record.get("transaction_seal_packet_hash"),
        "transaction_audit_chain_hash": record.get("transaction_audit_chain_hash"),
        "write_receipt_hash": record.get("write_receipt_hash"),
        "rollback_plan_hash": record.get("rollback_plan_hash"),
        "replayed_candidate_hash": selected.get("candidate_hash"),
        "replayed_manifest_hash": _mapping(compiled.get("proposed")).get("manifest_hash"),
        "replayed_transaction_seal_packet_hash": compiled.get("transaction_seal_packet_hash"),
        "replayed_transaction_audit_chain_hash": compiled.get("transaction_audit_chain_hash"),
        "replayed_transaction_intent_hash": compiled.get("transaction_intent_hash"),
        "replayed_receipt_preview_hash": compiled.get("receipt_preview_hash"),
        "replayed_rollback_preview_hash": compiled.get("rollback_preview_hash"),
        "source_state_integrity_verified": source_ok and source_linked_ok,
        "committed_state_integrity_verified": status.get("integrity_verified") is True and linked_ok,
        "receipt_and_rollback_artifacts_verified": linked_ok,
        "replay_checks": replay_checks,
        "all_replay_checks_passed": True,
        "operator_trace_output_hash_binding_mode": state_core.get("output_hash_binding_mode"),
        "trace_deferred_output_binding_acknowledged": replay_checks["non_self_referential_output_binding_declared"],
        "stored_candidate_committed": record.get("candidate_committed") is True,
        "stored_live_manifest_advanced": record.get("live_manifest_advanced") is True,
        "stored_seal_executed": record.get("seal_executed") is True,
        "stored_memory_written": record.get("memory_written") is True,
        "stored_memory_promoted": record.get("memory_promoted") is True,
        "output_permissions": _mapping(record.get("manifest")).get("output_permissions"),
        "output_permission_interpretation": renderer_semantics,
        "renderer_output_permitted": False,
        "linked_artifacts_verified": linked_verified,
        "source_linked_artifacts_verified": source_linked_verified,
        "source_state_verified": source_verified,
    })
    return payload
