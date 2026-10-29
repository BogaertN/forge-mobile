"""
forge/rmc_engine_v1/mea/seal_transaction_commit.py

Patch 297R — MEA Idempotent Response Action/State Semantic Separation Hotfix.

This module is the first candidate-driven MEA persistent transition.  It does
not expose the canonical /api/mea/seal route.  It exposes one deliberately
narrow, approval-token POST surface that may commit one explicitly selected
hypothesis candidate only after the Patch 296R transaction preflight is rerun
against the current verified persisted state and every submitted hash binding
matches the freshly recomputed transaction.

Commit law for Patch 297:
- a caller must explicitly choose the candidate and submit all transaction
  hashes; score ranking is never selection;
- the current persisted M_t must still be exactly the source bound in the
  request and must pass its existing receipt/rollback integrity verification;
- the repaired Patch 296R preflight is recomputed while the store lock is held;
- only the controlled hypothesis candidate may be committed in this first
  transition patch; speculative branches remain non-persistent previews;
- immutable rollback and commit-receipt artifacts are durably prepared before
  the single current-state file is atomically replaced;
- the atomic state replacement is the only moment the new state becomes live;
- an identical repeat request is idempotent and writes nothing;
- response fields distinguish actions performed by this invocation from facts already stored in live state;
- conflicting or stale replays are rejected;
- the advanced state remains hypothesis-bound, proof debt remains high, and
  output rendering remains gated.

Hard boundary retained:
- no /api/mea/seal canonical route;
- no RMC memory, Chroma, or Identity Vault write;
- no LLM, shell, network, rendering, launcher, or UI action.
"""

from __future__ import annotations

import copy
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Mapping, Optional, Sequence, Tuple

from .manifest_schema import ClaimStatus, canonical_hash, from_dict, validate_manifest
from .problem_manifest_store import (
    _atomic_write_json,
    _exclusive_store_lock,
    _hash_mapping,
    _store_paths,
    _verify_state_record,
    output_permission_interpretation,
    problem_manifest_store_status,
)
from .seal_transaction_preflight import (
    TRANSACTION_PREFLIGHT_APPROVAL_TOKEN,
    TRANSACTION_PREFLIGHT_POST_ROUTE,
    evaluate_seal_transaction_preflight_request,
)

TRANSACTION_COMMIT_PATCH_ID = "Patch 297R — MEA Idempotent Response Action/State Semantic Separation Hotfix"
TRANSACTION_COMMIT_SCHEMA_VERSION = "mea_seal_transaction_commit_v1_patch297r"
TRANSACTION_COMMIT_MODE = "controlled_mea_atomic_seal_manifest_advance_commit_patch297r"
TRANSACTION_COMMIT_POST_ROUTE = "/api/mea/seal-transaction-commit"
TRANSACTION_COMMIT_APPROVAL_TOKEN = "APPROVE_MEA_SEAL_TRANSACTION_COMMIT"
TRANSACTION_COMMIT_FORMULA = (
    "TxCommit(M_t,c*)=Approval∧CurrentIntegrity(M_t)∧RecomputePreflight296R(M_t,c*)∧"
    "HashBindAll∧HypothesisOnly∧AtomicReplace(M_t,M_t+1)∧Receipt∧Rollback; "
    "memory=false; canonical_seal_route=false; invocation_state_semantics=explicit"
)

_REQUIRED_HASH_FIELDS = (
    "source_manifest_hash",
    "source_state_content_hash",
    "candidate_hash",
    "candidate_set_hash",
    "gate_report_hash",
    "transaction_seal_packet_hash",
    "transaction_audit_chain_hash",
    "proposed_new_manifest_hash",
    "transaction_intent_hash",
    "receipt_preview_hash",
    "rollback_preview_hash",
)
_REQUIRED_CANDIDATE_ID = "cg_hypothesis_001"
_REQUIRED_CLAIM_STATUS = ClaimStatus.HYPOTHESIS.value


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _stable_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _stable_hash(value: Any) -> str:
    return hashlib.sha256(_stable_json(value).encode("utf-8")).hexdigest()


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _is_sha256(value: Any) -> bool:
    return isinstance(value, str) and len(value) == 64 and all(char in "0123456789abcdef" for char in value)


def transaction_commit_boundary() -> Dict[str, Any]:
    return {
        "patch": TRANSACTION_COMMIT_PATCH_ID,
        "schema_version": TRANSACTION_COMMIT_SCHEMA_VERSION,
        "layer": "MEA controlled atomic seal/manifest advance commit / first hypothesis transition only",
        "read_only": False,
        "non_mutating": False,
        "creates_get_routes": False,
        "creates_post_routes": True,
        "get_routes": [],
        "post_routes": [TRANSACTION_COMMIT_POST_ROUTE],
        "requires_approval_token": True,
        "approval_token": TRANSACTION_COMMIT_APPROVAL_TOKEN,
        "requires_explicit_candidate_selection": True,
        "requires_full_repaired_preflight_binding": True,
        "requires_source_manifest_hash_match": True,
        "requires_source_state_content_hash_match": True,
        "requires_transaction_intent_hash_match": True,
        "reads_files": True,
        "reads_mea_runtime_state": True,
        "requires_persisted_state_integrity": True,
        "reruns_transaction_preflight_under_lock": True,
        "score_can_rank": True,
        "score_can_select": False,
        "score_can_override_gates": False,
        "hypothesis_commit_only": True,
        "writes_files": True,
        "writes_mea_runtime_state": True,
        "writes_atomic_state_record": True,
        "writes_immutable_advance_receipt": True,
        "writes_immutable_rollback_record": True,
        "uses_file_lock": True,
        "idempotent_same_transaction_no_write": True,
        "rejects_conflicting_replay": True,
        "separates_invocation_actions_from_stored_state": True,
        "idempotent_response_reports_no_new_transition_execution": True,
        "commits_live_candidates": True,
        "advances_live_manifest": True,
        "seals_candidates": True,
        "executes_seal": True,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "performs_network_io": False,
        "promotes_to_memory": False,
        "renders_user_output": False,
        "mutates_existing_rmc_behavior": False,
        "mutates_launcher_behavior": False,
        "mutates_operator_console_ui": False,
        "canonical_seal_route_available": False,
        "seal_route_available": False,
        "memory_promotion_route_available": False,
        "single_advance_limit_for_patch297": True,
    }


def _base_payload(endpoint: str = TRANSACTION_COMMIT_POST_ROUTE) -> Dict[str, Any]:
    return {
        "endpoint": endpoint,
        "mode": TRANSACTION_COMMIT_MODE,
        "current_patch": TRANSACTION_COMMIT_PATCH_ID,
        "schema_version": TRANSACTION_COMMIT_SCHEMA_VERSION,
        "formula": TRANSACTION_COMMIT_FORMULA,
        "approval_required": True,
        "expected_approval_token": TRANSACTION_COMMIT_APPROVAL_TOKEN,
        "selection_requires_explicit_candidate_submission": True,
        "ranked_candidate_auto_selected": False,
        "canonical_seal_route_available": False,
        "seal_route_available": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "performs_network_io": False,
        "promotes_to_memory": False,
        "renders_user_output": False,
        "response_contract_patch": TRANSACTION_COMMIT_PATCH_ID,
        "response_semantics": "invocation_action_fields_describe_this_request_only; stored_state_fields_describe_already_persisted_state",
        "boundary": transaction_commit_boundary(),
    }


def _rejection(reason_code: str, errors: Sequence[str], request: Optional[Mapping[str, Any]] = None, *, endpoint: str = TRANSACTION_COMMIT_POST_ROUTE) -> Dict[str, Any]:
    req = _mapping(request)
    payload = _base_payload(endpoint)
    payload.update({
        "status": "REJECTED",
        "gate_status": "REJECTED",
        "accepted": False,
        "reason_code": reason_code,
        "gate_errors": list(errors),
        "candidate_id": req.get("candidate_id"),
        "write_performed": False,
        "atomic_write_completed": False,
        "receipt_written": False,
        "rollback_record_written": False,
        "selected_candidate_committed": False,
        "commits_live_candidates": False,
        "advances_live_manifest": False,
        "seals_candidates": False,
        "executes_seal": False,
        "writes_files": False,
        "writes_mea_runtime_state": False,
        "invocation_write_performed": False,
        "invocation_candidate_commit_executed": False,
        "invocation_manifest_advance_executed": False,
        "invocation_seal_executed": False,
        "stored_state_reported": False,
    })
    return payload


def _preflight_request_from_commit(req: Mapping[str, Any]) -> Dict[str, Any]:
    return {
        "approval_token": TRANSACTION_PREFLIGHT_APPROVAL_TOKEN,
        "source_manifest_hash": req.get("source_manifest_hash"),
        "source_state_content_hash": req.get("source_state_content_hash"),
        "candidate_id": req.get("candidate_id"),
        "candidate_hash": req.get("candidate_hash"),
        "candidate_set_hash": req.get("candidate_set_hash"),
        "gate_report_hash": req.get("gate_report_hash"),
    }


def _verify_request_hashes_against_preflight(req: Mapping[str, Any], preflight: Mapping[str, Any]) -> Tuple[bool, Tuple[str, ...]]:
    mismatches = []
    expected = {
        "source_manifest_hash": preflight.get("source_manifest_hash"),
        "source_state_content_hash": preflight.get("source_state_content_hash"),
        "candidate_hash": preflight.get("candidate_hash"),
        "candidate_set_hash": preflight.get("candidate_set_hash"),
        "gate_report_hash": _mapping(preflight.get("transaction_seal_packet_preview")).get("gate_report_hash"),
        "transaction_seal_packet_hash": preflight.get("transaction_seal_packet_hash"),
        "transaction_audit_chain_hash": preflight.get("transaction_audit_chain_hash"),
        "proposed_new_manifest_hash": preflight.get("proposed_new_manifest_hash"),
        "transaction_intent_hash": preflight.get("transaction_intent_hash"),
        "receipt_preview_hash": preflight.get("receipt_preview_hash"),
        "rollback_preview_hash": preflight.get("rollback_preview_hash"),
    }
    for field, value in expected.items():
        if str(req.get(field) or "") != str(value or ""):
            mismatches.append(field)
    return not mismatches, tuple(mismatches)


def _state_is_committed_advance_for_intent(status: Mapping[str, Any], req: Mapping[str, Any]) -> bool:
    record = _mapping(status.get("stored_state"))
    state_core = _mapping(record.get("state_core"))
    binding = _mapping(state_core.get("transaction_binding"))
    candidate = _mapping(state_core.get("selected_candidate"))
    return (
        status.get("integrity_verified") is True
        and state_core.get("state_kind") == "mea_problem_manifest_committed_advance_state"
        and binding.get("transaction_intent_hash") == req.get("transaction_intent_hash")
        and binding.get("source_manifest_hash") == req.get("source_manifest_hash")
        and binding.get("source_state_content_hash") == req.get("source_state_content_hash")
        and candidate.get("candidate_id") == req.get("candidate_id")
        and candidate.get("candidate_hash") == req.get("candidate_hash")
        and record.get("candidate_committed") is True
        and record.get("seal_executed") is True
        and record.get("live_manifest_advanced") is True
    )


def _build_advanced_state_core(preflight: Mapping[str, Any]) -> Dict[str, Any]:
    manifest = copy.deepcopy(_mapping(preflight.get("proposed_new_manifest")))
    return {
        "state_kind": "mea_problem_manifest_committed_advance_state",
        "store_schema_version": TRANSACTION_COMMIT_SCHEMA_VERSION,
        "problem_id": manifest.get("problem_id"),
        "manifest_hash": preflight.get("proposed_new_manifest_hash"),
        "canonical_manifest": manifest,
        "source": "controlled_atomic_manifest_advance_patch297",
        "source_transaction_id": preflight.get("source_transaction_id"),
        "source_manifest_hash": preflight.get("source_manifest_hash"),
        "source_state_content_hash": preflight.get("source_state_content_hash"),
        "selected_candidate": {
            "candidate_id": preflight.get("candidate_id"),
            "candidate_hash": preflight.get("candidate_hash"),
            "claim_status": preflight.get("claim_status"),
            "proof_debt": preflight.get("proof_debt"),
            "explicit_selection": True,
            "ranked_candidate_auto_selected": False,
        },
        "transaction_binding": {
            "transaction_intent_hash": preflight.get("transaction_intent_hash"),
            "transaction_seal_packet_hash": preflight.get("transaction_seal_packet_hash"),
            "transaction_audit_chain_hash": preflight.get("transaction_audit_chain_hash"),
            "preflight_receipt_preview_hash": preflight.get("receipt_preview_hash"),
            "preflight_rollback_preview_hash": preflight.get("rollback_preview_hash"),
            "trace_source_binding_verified": preflight.get("transaction_trace_source_binding_verified") is True,
            "source_manifest_hash": preflight.get("source_manifest_hash"),
            "source_state_content_hash": preflight.get("source_state_content_hash"),
            "proposed_new_manifest_hash": preflight.get("proposed_new_manifest_hash"),
        },
        "output_permission_interpretation": output_permission_interpretation(str(manifest.get("output_permissions", "sealed"))),
        "persistence_scope": {
            "initial_seed_only": False,
            "candidate_committed": True,
            "seal_executed": True,
            "live_manifest_advanced": True,
            "memory_written": False,
            "memory_promoted": False,
            "renderer_output_permitted": False,
        },
        "output_hash_binding_mode": "state_record_and_receipt_bind_committed_manifest_hash_without_self_referential_manifest_mutation",
    }


def _build_advanced_state_record(preflight: Mapping[str, Any], committed_at_utc: str) -> Dict[str, Any]:
    proposed_manifest = copy.deepcopy(_mapping(preflight.get("proposed_new_manifest")))
    state_core = _build_advanced_state_core(preflight)
    state_content_hash = _hash_mapping(state_core)
    transaction_id = f"advance_{str(preflight.get('transaction_intent_hash'))[:24]}"
    return {
        "store_schema_version": TRANSACTION_COMMIT_SCHEMA_VERSION,
        "current_patch": TRANSACTION_COMMIT_PATCH_ID,
        "transaction_id": transaction_id,
        "state_content_hash": state_content_hash,
        "stored_at_utc": committed_at_utc,
        "manifest_hash": preflight.get("proposed_new_manifest_hash"),
        "problem_id": proposed_manifest.get("problem_id"),
        "manifest": proposed_manifest,
        "state_core": state_core,
        "output_permission_interpretation": output_permission_interpretation(str(proposed_manifest.get("output_permissions", "sealed"))),
        "committed_initial_seed": False,
        "candidate_committed": True,
        "seal_executed": True,
        "live_manifest_advanced": True,
        "memory_written": False,
        "memory_promoted": False,
        "source_transaction_id": preflight.get("source_transaction_id"),
        "source_manifest_hash": preflight.get("source_manifest_hash"),
        "source_state_content_hash": preflight.get("source_state_content_hash"),
        "candidate_id": preflight.get("candidate_id"),
        "candidate_hash": preflight.get("candidate_hash"),
        "claim_status": preflight.get("claim_status"),
        "proof_debt": preflight.get("proof_debt"),
        "transaction_intent_hash": preflight.get("transaction_intent_hash"),
        "transaction_seal_packet_hash": preflight.get("transaction_seal_packet_hash"),
        "transaction_audit_chain_hash": preflight.get("transaction_audit_chain_hash"),
        "preflight_receipt_preview_hash": preflight.get("receipt_preview_hash"),
        "preflight_rollback_preview_hash": preflight.get("rollback_preview_hash"),
        "canonical_seal_route_available": False,
        "memory_promotion_active": False,
    }


def _build_commit_receipt(record: Mapping[str, Any], preflight: Mapping[str, Any], committed_at_utc: str) -> Dict[str, Any]:
    payload = {
        "receipt_kind": "mea_atomic_seal_manifest_advance_commit_receipt",
        "schema_version": TRANSACTION_COMMIT_SCHEMA_VERSION,
        "patch_id": TRANSACTION_COMMIT_PATCH_ID,
        "receipt_status": "AUTHORIZED_COMMIT_RECEIPT_FOR_ATOMIC_STATE_REPLACEMENT",
        "transaction_id": record.get("transaction_id"),
        "committed_at_utc": committed_at_utc,
        "source_transaction_id": preflight.get("source_transaction_id"),
        "source_manifest_hash": preflight.get("source_manifest_hash"),
        "source_state_content_hash": preflight.get("source_state_content_hash"),
        "candidate_id": preflight.get("candidate_id"),
        "candidate_hash": preflight.get("candidate_hash"),
        "claim_status": preflight.get("claim_status"),
        "proof_debt": preflight.get("proof_debt"),
        "transaction_intent_hash": preflight.get("transaction_intent_hash"),
        "transaction_seal_packet_hash": preflight.get("transaction_seal_packet_hash"),
        "transaction_audit_chain_hash": preflight.get("transaction_audit_chain_hash"),
        "preflight_receipt_preview_hash": preflight.get("receipt_preview_hash"),
        "preflight_rollback_preview_hash": preflight.get("rollback_preview_hash"),
        "manifest_hash": record.get("manifest_hash"),
        "state_content_hash": record.get("state_content_hash"),
        "write_scope": "forge_owned_mea_runtime_state_only",
        "atomic_current_state_replacement": True,
        "receipt_written_before_atomic_state_visibility": True,
        "receipt_effective_only_if_current_state_record_links_to_this_receipt_hash": True,
        "candidate_committed": True,
        "seal_executed": True,
        "live_manifest_advanced": True,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "promotes_to_memory": False,
        "renders_user_output": False,
        "canonical_seal_route_available": False,
    }
    return {**payload, "receipt_hash": _hash_mapping(payload)}


def _build_rollback_record(record: Mapping[str, Any], preflight: Mapping[str, Any], receipt: Mapping[str, Any], source_status: Mapping[str, Any], committed_at_utc: str) -> Dict[str, Any]:
    source_record = copy.deepcopy(_mapping(source_status.get("stored_state")))
    payload = {
        "rollback_plan_kind": "mea_atomic_seal_manifest_advance_rollback_record",
        "schema_version": TRANSACTION_COMMIT_SCHEMA_VERSION,
        "patch_id": TRANSACTION_COMMIT_PATCH_ID,
        "rollback_status": "ROLLBACK_RECORD_CREATED_NOT_EXECUTED",
        "transaction_id": record.get("transaction_id"),
        "created_at_utc": committed_at_utc,
        "transaction_intent_hash": preflight.get("transaction_intent_hash"),
        "manifest_hash": record.get("manifest_hash"),
        "state_content_hash": record.get("state_content_hash"),
        "write_receipt_hash": receipt.get("receipt_hash"),
        "restore_source_manifest_hash": preflight.get("source_manifest_hash"),
        "restore_source_state_content_hash": preflight.get("source_state_content_hash"),
        "restore_source_transaction_id": preflight.get("source_transaction_id"),
        "restore_state_record_hash": _stable_hash(source_record),
        "restore_state_record": source_record,
        "rollback_action": "restore_previous_current_problem_manifest_only_after_separate_explicit_rollback_approval_and_hash_verification",
        "rollback_execution_exposed_by_api": False,
        "manual_review_required_before_rollback": True,
        "rollback_performed": False,
    }
    return {**payload, "rollback_plan_hash": _hash_mapping(payload)}


def _write_immutable_artifact(path: Path, payload: Mapping[str, Any]) -> Tuple[bool, bool]:
    """Write one immutable artifact; return (created, identical_existing)."""
    if path.exists():
        if path.is_symlink():
            raise RuntimeError(f"refusing symlinked immutable MEA artifact: {path.name}")
        existing = json.loads(path.read_text(encoding="utf-8"))
        if _stable_json(existing) != _stable_json(payload):
            raise RuntimeError(f"immutable MEA artifact conflict: {path.name}")
        return False, True
    _atomic_write_json(path, payload)
    return True, False


def _idempotent_response(status: Mapping[str, Any], req: Mapping[str, Any], endpoint: str) -> Dict[str, Any]:
    """Return a no-op response that separates invocation effects from stored state facts."""
    record = _mapping(status.get("stored_state"))
    payload = _base_payload(endpoint)
    payload.update({
        "status": "OK",
        "gate_status": "ALREADY_COMMITTED_IDEMPOTENT_NO_WRITE",
        "accepted": True,
        "reason_code": "idempotent_existing_committed_transaction",
        "candidate_id": req.get("candidate_id"),
        "claim_status": record.get("claim_status"),
        "source_manifest_hash": record.get("source_manifest_hash"),
        "source_state_content_hash": record.get("source_state_content_hash"),
        "manifest_hash": record.get("manifest_hash"),
        "state_content_hash": record.get("state_content_hash"),
        "transaction_id": record.get("transaction_id"),
        "transaction_intent_hash": record.get("transaction_intent_hash"),
        "write_performed": False,
        "idempotent_no_write": True,
        "atomic_write_completed": False,
        "receipt_written": False,
        "rollback_record_written": False,
        "selected_candidate_committed": False,
        "commits_live_candidates": False,
        "advances_live_manifest": False,
        "seals_candidates": False,
        "executes_seal": False,
        "writes_files": False,
        "writes_mea_runtime_state": False,
        "writes_memory": False,
        "promotes_to_memory": False,
        "invocation_write_performed": False,
        "invocation_candidate_commit_executed": False,
        "invocation_manifest_advance_executed": False,
        "invocation_seal_executed": False,
        "stored_state_reported": True,
        "stored_candidate_committed": record.get("candidate_committed") is True,
        "stored_live_manifest_advanced": record.get("live_manifest_advanced") is True,
        "stored_seal_executed": record.get("seal_executed") is True,
        "stored_memory_written": record.get("memory_written") is True,
        "stored_memory_promoted": record.get("memory_promoted") is True,
        "stored_transaction_intent_hash": record.get("transaction_intent_hash"),
        "output_permission_interpretation": record.get("output_permission_interpretation"),
        "stored_state_integrity_verified": True,
    })
    return payload


def evaluate_seal_transaction_commit_request(
    request: Optional[Mapping[str, Any]],
    *,
    store_root: Optional[Path] = None,
    now_utc: Optional[str] = None,
    endpoint: str = TRANSACTION_COMMIT_POST_ROUTE,
) -> Dict[str, Any]:
    """Execute one explicit, source-bound, atomic MEA advance; never write memory."""
    req = dict(request) if isinstance(request, Mapping) else {}
    if endpoint.split("?", 1)[0] != TRANSACTION_COMMIT_POST_ROUTE:
        return _rejection("route_mismatch", ["transaction commit is authorized only on its canonical controlled route"], req, endpoint=endpoint)
    if req.get("approval_token") != TRANSACTION_COMMIT_APPROVAL_TOKEN:
        return _rejection("approval_token_required", ["missing or invalid approval_token for controlled atomic transaction commit"], req, endpoint=endpoint)
    if str(req.get("candidate_id") or "") != _REQUIRED_CANDIDATE_ID:
        return _rejection("hypothesis_candidate_required", ["Patch 297 may commit only the explicitly selected cg_hypothesis_001 candidate"], req, endpoint=endpoint)
    invalid_hashes = [field for field in _REQUIRED_HASH_FIELDS if not _is_sha256(req.get(field))]
    if invalid_hashes:
        return _rejection("required_hash_fields_invalid", ["invalid or missing SHA-256 fields: " + ", ".join(invalid_hashes)], req, endpoint=endpoint)

    paths = _store_paths(store_root)
    pre_status = problem_manifest_store_status(store_root=paths["root"], endpoint="/api/mea/problem-manifest")
    if _state_is_committed_advance_for_intent(pre_status, req):
        return _idempotent_response(pre_status, req, endpoint)
    if pre_status.get("integrity_verified") is not True:
        return _rejection("persisted_source_state_blocked", ["current persisted MEA state failed integrity verification"], req, endpoint=endpoint)
    pre_state_core = _mapping(_mapping(pre_status.get("stored_state")).get("state_core"))
    if pre_state_core.get("state_kind") == "mea_problem_manifest_committed_advance_state":
        return _rejection("conflicting_advanced_state_exists", ["Patch 297 allows one initial candidate-driven advance only; current live state is already advanced by a different transaction"], req, endpoint=endpoint)

    # Early non-mutating preflight prevents creation of state paths on invalid requests.
    early_preflight = evaluate_seal_transaction_preflight_request(
        _preflight_request_from_commit(req), store_root=paths["root"], endpoint=TRANSACTION_PREFLIGHT_POST_ROUTE
    )
    if early_preflight.get("status") != "OK":
        return _rejection("transaction_preflight_rejected", [str(early_preflight.get("reason_code") or "preflight rejected")], req, endpoint=endpoint)
    matched, mismatch_fields = _verify_request_hashes_against_preflight(req, early_preflight)
    if not matched:
        return _rejection("submitted_transaction_hash_mismatch", ["mismatched transaction fields: " + ", ".join(mismatch_fields)], req, endpoint=endpoint)
    if early_preflight.get("claim_status") != _REQUIRED_CLAIM_STATUS:
        return _rejection("hypothesis_status_required", ["Patch 297 cannot persist speculative branches or verified claims"], req, endpoint=endpoint)

    committed_at_utc = now_utc or _utc_now()
    with _exclusive_store_lock(paths):
        current = problem_manifest_store_status(store_root=paths["root"], endpoint="/api/mea/problem-manifest")
        if _state_is_committed_advance_for_intent(current, req):
            return _idempotent_response(current, req, endpoint)
        if current.get("integrity_verified") is not True:
            return _rejection("persisted_source_state_blocked_under_lock", ["current persisted MEA state failed integrity verification under commit lock"], req, endpoint=endpoint)
        current_core = _mapping(_mapping(current.get("stored_state")).get("state_core"))
        if current_core.get("state_kind") == "mea_problem_manifest_committed_advance_state":
            return _rejection("conflicting_advanced_state_exists", ["current live state was already advanced by another transaction"], req, endpoint=endpoint)
        if current.get("manifest_hash") != req.get("source_manifest_hash") or current.get("state_content_hash") != req.get("source_state_content_hash"):
            return _rejection("stale_source_state_rejected", ["current persisted source state changed before commit lock was acquired"], req, endpoint=endpoint)

        preflight = evaluate_seal_transaction_preflight_request(
            _preflight_request_from_commit(req), store_root=paths["root"], endpoint=TRANSACTION_PREFLIGHT_POST_ROUTE
        )
        if preflight.get("status") != "OK" or preflight.get("transaction_trace_source_binding_verified") is not True:
            return _rejection("locked_transaction_preflight_rejected", [str(preflight.get("reason_code") or "preflight rejected under lock")], req, endpoint=endpoint)
        matched, mismatch_fields = _verify_request_hashes_against_preflight(req, preflight)
        if not matched:
            return _rejection("locked_transaction_hash_mismatch", ["mismatched transaction fields under lock: " + ", ".join(mismatch_fields)], req, endpoint=endpoint)
        if preflight.get("claim_status") != _REQUIRED_CLAIM_STATUS or float(preflight.get("proof_debt", 1.0)) != float(current.get("proof_debt", 1.0)):
            return _rejection("epistemic_boundary_violation", ["commit must remain hypothesis-bound and cannot lower proof debt without new evidence"], req, endpoint=endpoint)
        proposed_manifest = _mapping(preflight.get("proposed_new_manifest"))
        proposed_model = from_dict(dict(proposed_manifest))
        validation = validate_manifest(proposed_model)
        if not validation.valid or canonical_hash(proposed_model) != preflight.get("proposed_new_manifest_hash"):
            return _rejection("proposed_manifest_integrity_failed", ["repaired preflight proposed manifest failed canonical integrity verification"], req, endpoint=endpoint)
        if proposed_manifest.get("claim_status") != _REQUIRED_CLAIM_STATUS or float(proposed_manifest.get("proof_debt", 1.0)) != float(current.get("proof_debt", 1.0)):
            return _rejection("proposed_manifest_epistemic_boundary_failed", ["advanced manifest must remain hypothesis with unchanged proof debt"], req, endpoint=endpoint)

        record = _build_advanced_state_record(preflight, committed_at_utc)
        receipt = _build_commit_receipt(record, preflight, committed_at_utc)
        rollback = _build_rollback_record(record, preflight, receipt, current, committed_at_utc)
        receipt_relpath = f"receipts/{record['transaction_id']}_advance_receipt.json"
        rollback_relpath = f"rollback_plans/{record['transaction_id']}_rollback_plan.json"
        record.update({
            "write_receipt_relpath": receipt_relpath,
            "write_receipt_hash": receipt["receipt_hash"],
            "rollback_plan_relpath": rollback_relpath,
            "rollback_plan_hash": rollback["rollback_plan_hash"],
        })
        valid_record, record_errors, _ = _verify_state_record(record)
        if not valid_record:
            return _rejection("advanced_record_integrity_failed_before_write", list(record_errors), req, endpoint=endpoint)

        receipt_path = paths["root"] / receipt_relpath
        rollback_path = paths["root"] / rollback_relpath
        rollback_written = False
        rollback_reused = False
        receipt_written = False
        receipt_reused = False
        state_replace_completed = False
        try:
            rollback_written, rollback_reused = _write_immutable_artifact(rollback_path, rollback)
            receipt_written, receipt_reused = _write_immutable_artifact(receipt_path, receipt)
            _atomic_write_json(paths["current"], record)
            state_replace_completed = True
        except Exception as exc:
            failure = _rejection("atomic_commit_write_failed_requires_review", [str(exc)[:240]], req, endpoint=endpoint)
            failure.update({
                "writes_files": rollback_written or receipt_written or state_replace_completed,
                "writes_mea_runtime_state": rollback_written or receipt_written or state_replace_completed,
                "rollback_record_written": rollback_written,
                "receipt_written": receipt_written,
                "atomic_write_completed": state_replace_completed,
                "operator_review_required": True,
                "possible_prepared_artifacts_without_live_state_advance": (rollback_written or receipt_written) and not state_replace_completed,
            })
            return failure

        readback = problem_manifest_store_status(store_root=paths["root"], endpoint="/api/mea/problem-manifest")
        if readback.get("integrity_verified") is not True or readback.get("manifest_hash") != record.get("manifest_hash") or readback.get("state_content_hash") != record.get("state_content_hash"):
            failure = _rejection("post_commit_integrity_failed_requires_review", ["committed state failed immediate integrity readback"], req, endpoint=endpoint)
            failure.update({
                "writes_files": True,
                "writes_mea_runtime_state": True,
                "write_performed": True,
                "atomic_write_completed": True,
                "rollback_record_written": rollback_written,
                "receipt_written": receipt_written,
                "selected_candidate_committed": True,
                "commits_live_candidates": True,
                "advances_live_manifest": True,
                "seals_candidates": True,
                "executes_seal": True,
                "invocation_write_performed": True,
                "invocation_candidate_commit_executed": True,
                "invocation_manifest_advance_executed": True,
                "invocation_seal_executed": True,
                "stored_state_reported": False,
                "operator_review_required": True,
            })
            return failure

        payload = _base_payload(endpoint)
        payload.update({
            "status": "OK",
            "gate_status": "COMMITTED_ATOMIC_MANIFEST_ADVANCE",
            "accepted": True,
            "candidate_id": preflight.get("candidate_id"),
            "candidate_hash": preflight.get("candidate_hash"),
            "claim_status": preflight.get("claim_status"),
            "proof_debt": preflight.get("proof_debt"),
            "source_transaction_id": preflight.get("source_transaction_id"),
            "source_manifest_hash": preflight.get("source_manifest_hash"),
            "source_state_content_hash": preflight.get("source_state_content_hash"),
            "transaction_id": record.get("transaction_id"),
            "transaction_intent_hash": preflight.get("transaction_intent_hash"),
            "transaction_seal_packet_hash": preflight.get("transaction_seal_packet_hash"),
            "transaction_audit_chain_hash": preflight.get("transaction_audit_chain_hash"),
            "proposed_new_manifest_hash": preflight.get("proposed_new_manifest_hash"),
            "committed_manifest_hash": record.get("manifest_hash"),
            "committed_state_content_hash": record.get("state_content_hash"),
            "write_receipt_hash": receipt.get("receipt_hash"),
            "rollback_plan_hash": rollback.get("rollback_plan_hash"),
            "receipt_relpath": receipt_relpath,
            "rollback_plan_relpath": rollback_relpath,
            "preflight_rerun_under_lock": True,
            "transaction_trace_source_binding_verified": preflight.get("transaction_trace_source_binding_verified") is True,
            "explicit_selection_received": True,
            "selection_basis": "submitted_candidate_id_and_hash_not_rank",
            "highest_ranked_candidate_id": preflight.get("highest_ranked_candidate_id"),
            "write_performed": True,
            "atomic_write_completed": True,
            "receipt_written": receipt_written,
            "receipt_reused_identical": receipt_reused,
            "rollback_record_written": rollback_written,
            "rollback_record_reused_identical": rollback_reused,
            "selected_candidate_committed": True,
            "commits_live_candidates": True,
            "advances_live_manifest": True,
            "seals_candidates": True,
            "executes_seal": True,
            "writes_files": True,
            "writes_mea_runtime_state": True,
            "invocation_write_performed": True,
            "invocation_candidate_commit_executed": True,
            "invocation_manifest_advance_executed": True,
            "invocation_seal_executed": True,
            "stored_state_reported": True,
            "stored_candidate_committed": True,
            "stored_live_manifest_advanced": True,
            "stored_seal_executed": True,
            "stored_memory_written": False,
            "stored_memory_promoted": False,
            "stored_transaction_intent_hash": preflight.get("transaction_intent_hash"),
            "writes_memory": False,
            "promotes_to_memory": False,
            "stored_state_integrity_verified": True,
            "output_permissions": proposed_manifest.get("output_permissions"),
            "output_permission_interpretation": output_permission_interpretation(str(proposed_manifest.get("output_permissions", "sealed"))),
            "renderer_output_permitted": False,
            "canonical_seal_route_available": False,
            "seal_route_available": False,
        })
        return payload
