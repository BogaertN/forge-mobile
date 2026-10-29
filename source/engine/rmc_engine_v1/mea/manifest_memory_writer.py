"""
forge/rmc_engine_v1/mea/manifest_memory_writer.py

Patch 299 — MEA Manifest Memory Writer Dry-Run.

This module is the MEA-side preview adapter for the existing RMC Memory Writer.
It consumes one already committed and replay-verifiable MEA manifest transition
and produces the exact bounded manifest-memory record that a later controlled
writer may store. It intentionally does not invoke the downstream RMC writer,
because that existing writer is scoped to rendered/echo-validated output and
no MEA renderer or Echo Validator approval exists at this point in the build.

Hard boundary:
- GET /api/mea/memory-writer/status reports readiness only.
- POST /api/mea/memory-writer-dry-run requires explicit approval and target binding.
- It internally reruns Patch 298 live trace replay verification.
- It writes no file, memory, Chroma, Identity Vault, receipt, capsule, or ledger.
- It does not render output, promote a claim, or create rejected-draft history.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Dict, Mapping, Optional, Sequence, Tuple

from .live_trace_replay import (
    LIVE_TRACE_REPLAY_APPROVAL_TOKEN,
    LIVE_TRACE_REPLAY_POST_ROUTE,
    evaluate_live_trace_replay_request,
)
from .problem_manifest_store import problem_manifest_store_status

MANIFEST_MEMORY_WRITER_PATCH_ID = "Patch 299 — MEA Manifest Memory Writer Dry-Run"
MANIFEST_MEMORY_WRITER_SCHEMA_VERSION = "mea_manifest_memory_writer_dry_run_v1_patch299"
MANIFEST_MEMORY_WRITER_MODE = "mea_manifest_memory_writer_dry_run_no_persistence_patch299"
MANIFEST_MEMORY_WRITER_STATUS_ROUTE = "/api/mea/memory-writer/status"
MANIFEST_MEMORY_WRITER_DRY_RUN_ROUTE = "/api/mea/memory-writer-dry-run"
MANIFEST_MEMORY_WRITER_APPROVAL_TOKEN = "APPROVE_MEA_MEMORY_WRITER_DRY_RUN"
MANIFEST_MEMORY_WRITER_FORMULA = (
    "W_mea(M_t+1)=PreviewRecord(M_t+1,ReplayVerified(Tx,c*),Receipt,Rollback,ClaimStatus); "
    "write=false; chroma=false; promotion=false; render=false"
)
_REQUIRED_TARGET_FIELDS: Tuple[str, ...] = (
    "transaction_id",
    "transaction_intent_hash",
    "candidate_id",
    "candidate_hash",
    "committed_manifest_hash",
    "committed_state_content_hash",
)


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _is_sha256(value: Any) -> bool:
    return isinstance(value, str) and len(value) == 64 and all(ch in "0123456789abcdef" for ch in value)


def _canonical_hash(payload: Mapping[str, Any]) -> str:
    raw = json.dumps(dict(payload), sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def manifest_memory_writer_boundary() -> Dict[str, Any]:
    return {
        "patch": MANIFEST_MEMORY_WRITER_PATCH_ID,
        "schema_version": MANIFEST_MEMORY_WRITER_SCHEMA_VERSION,
        "layer": "MEA committed manifest memory-record preview / RMC Memory Writer compatibility boundary",
        "read_only": True,
        "non_mutating": True,
        "creates_get_routes": True,
        "creates_post_routes": True,
        "get_routes": [MANIFEST_MEMORY_WRITER_STATUS_ROUTE],
        "post_routes": [MANIFEST_MEMORY_WRITER_DRY_RUN_ROUTE],
        "requires_approval_token": True,
        "approval_token": MANIFEST_MEMORY_WRITER_APPROVAL_TOKEN,
        "requires_committed_manifest": True,
        "requires_live_trace_replay_verification": True,
        "requires_explicit_committed_transaction_target": True,
        "extends_existing_rmc_memory_writer_contract": True,
        "existing_rmc_memory_writer_invoked": False,
        "existing_rmc_memory_writer_invocation_deferred_until_render_and_echo_validation": True,
        "previews_manifest_record_only": True,
        "previews_rejected_drafts_only_when_traceable_source_exists": True,
        "reads_files": True,
        "reads_mea_runtime_state": True,
        "reads_commit_receipt": True,
        "reads_rollback_record": True,
        "writes_files": False,
        "writes_mea_runtime_state": False,
        "writes_memory": False,
        "writes_rmc_memory": False,
        "writes_jsonl_ledger": False,
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
        "creates_memory_capsule": False,
        "mints_contribution_tokens": False,
        "canonical_seal_route_available": False,
        "seal_route_available": False,
        "memory_promotion_route_available": False,
    }


def _base_payload(endpoint: str) -> Dict[str, Any]:
    return {
        "endpoint": endpoint,
        "mode": MANIFEST_MEMORY_WRITER_MODE,
        "current_patch": MANIFEST_MEMORY_WRITER_PATCH_ID,
        "schema_version": MANIFEST_MEMORY_WRITER_SCHEMA_VERSION,
        "formula": MANIFEST_MEMORY_WRITER_FORMULA,
        "approval_required": endpoint.split("?", 1)[0] == MANIFEST_MEMORY_WRITER_DRY_RUN_ROUTE,
        "expected_approval_token": MANIFEST_MEMORY_WRITER_APPROVAL_TOKEN,
        "dry_run_only": True,
        "record_preview_only": True,
        "memory_write_executed": False,
        "write_performed": False,
        "actual_files_written": [],
        "writes_files": False,
        "writes_mea_runtime_state": False,
        "writes_memory": False,
        "writes_rmc_memory": False,
        "writes_jsonl_ledger": False,
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
        "renderer_output_permitted": False,
        "creates_memory_capsule": False,
        "mints_contribution_tokens": False,
        "canonical_seal_route_available": False,
        "seal_route_available": False,
        "boundary": manifest_memory_writer_boundary(),
    }


def manifest_memory_writer_status(
    *,
    store_root: Optional[Path] = None,
    endpoint: str = MANIFEST_MEMORY_WRITER_STATUS_ROUTE,
) -> Dict[str, Any]:
    """Read-only status surface; it does not construct or persist a record."""
    source_status = problem_manifest_store_status(store_root=store_root, endpoint="/api/mea/problem-manifest")
    stored = _mapping(source_status.get("stored_state"))
    committed = (
        source_status.get("status") == "OK"
        and source_status.get("integrity_verified") is True
        and source_status.get("stored_state_kind") == "mea_problem_manifest_committed_advance_state"
        and source_status.get("stored_candidate_committed") is True
        and source_status.get("stored_live_manifest_advanced") is True
        and source_status.get("stored_seal_executed") is True
    )
    payload = _base_payload(endpoint)
    payload.update({
        "status": "OK",
        "gate_status": "DRY_RUN_AVAILABLE" if committed else "DRY_RUN_BLOCKED_SOURCE_NOT_COMMITTED",
        "available": committed,
        "source_state_integrity_verified": source_status.get("integrity_verified") is True,
        "source_state_kind": source_status.get("stored_state_kind"),
        "problem_id": source_status.get("problem_id"),
        "candidate_id": stored.get("candidate_id"),
        "claim_status": source_status.get("claim_status"),
        "proof_debt": source_status.get("proof_debt"),
        "committed_manifest_hash": source_status.get("manifest_hash"),
        "committed_state_content_hash": source_status.get("state_content_hash"),
        "transaction_id": stored.get("transaction_id"),
        "transaction_intent_hash": stored.get("transaction_intent_hash"),
        "requires_replay_before_record_preview": True,
        "existing_rmc_memory_writer_module": "forge/rmc_engine_v1/memory_writer.py",
        "existing_rmc_memory_writer_invoked": False,
        "existing_rmc_writer_reason_not_invoked": (
            "existing RMC Memory Writer consumes rendered and echo-validated output; "
            "Patch 299 previews the upstream sealed MEA manifest record only"
        ),
        "memory_namespace_preview": "forge/memory/mea_manifest_memory_v1/hypothesis_test_required_records.jsonl",
        "rejected_draft_records_previewed": False,
        "rejected_draft_exclusion_reason": "no traceable rejected draft is part of the committed Patch 297 lineage",
    })
    return payload


def _reject(reason_code: str, errors: Sequence[str], endpoint: str) -> Dict[str, Any]:
    payload = _base_payload(endpoint)
    payload.update({
        "status": "REJECTED",
        "gate_status": "MEMORY_RECORD_DRY_RUN_REJECTED_NO_WRITE",
        "accepted": False,
        "reason_code": reason_code,
        "dry_run_errors": list(errors),
        "memory_record_preview": None,
        "memory_record_hash": None,
    })
    return payload


def _record_preview(source_status: Mapping[str, Any], replay: Mapping[str, Any]) -> Dict[str, Any]:
    stored = _mapping(source_status.get("stored_state"))
    manifest = _mapping(stored.get("manifest"))
    permission = _mapping(source_status.get("output_permission_interpretation"))
    verified = _mapping(source_status.get("verified"))
    record_core: Dict[str, Any] = {
        "record_type": "mea_manifest_memory_record_preview",
        "record_schema_version": MANIFEST_MEMORY_WRITER_SCHEMA_VERSION,
        "record_status": "DRY_RUN_PREVIEW_NOT_WRITTEN",
        "memory_tier": "hypothesis_test_required_record",
        "problem_id": stored.get("problem_id") or source_status.get("problem_id"),
        "candidate_id": replay.get("candidate_id"),
        "candidate_hash": replay.get("candidate_hash"),
        "claim_status": replay.get("claim_status"),
        "proof_debt": replay.get("proof_debt"),
        "claim_semantics": {
            "verified_fact": False,
            "hypothesis_only": replay.get("claim_status") == "hypothesis",
            "requires_future_evidence": True,
            "may_render_as_verified_claim": False,
            "proof_debt_preserved": replay.get("proof_debt") == 0.85,
        },
        "source_manifest_hash": replay.get("source_manifest_hash"),
        "source_state_content_hash": replay.get("source_state_content_hash"),
        "committed_manifest_hash": replay.get("committed_manifest_hash"),
        "committed_state_content_hash": replay.get("committed_state_content_hash"),
        "transaction_id": stored.get("transaction_id"),
        "transaction_intent_hash": replay.get("transaction_intent_hash"),
        "transaction_seal_packet_hash": replay.get("transaction_seal_packet_hash"),
        "transaction_audit_chain_hash": replay.get("transaction_audit_chain_hash"),
        "advance_receipt_hash": replay.get("write_receipt_hash") or verified.get("write_receipt_hash"),
        "rollback_record_hash": replay.get("rollback_plan_hash") or verified.get("rollback_plan_hash"),
        "replay_verification": {
            "gate_status": replay.get("gate_status"),
            "replay_verified": replay.get("replay_verified") is True,
            "all_replay_checks_passed": replay.get("all_replay_checks_passed") is True,
            "replayed_candidate_hash": replay.get("replayed_candidate_hash"),
            "replayed_manifest_hash": replay.get("replayed_manifest_hash"),
            "replayed_transaction_intent_hash": replay.get("replayed_transaction_intent_hash"),
            "receipt_and_rollback_artifacts_verified": replay.get("receipt_and_rollback_artifacts_verified") is True,
            "trace_deferred_output_binding_acknowledged": replay.get("trace_deferred_output_binding_acknowledged") is True,
        },
        "manifest_scope_preview": {
            "known_fact_count": len(manifest.get("known_facts", [])) if isinstance(manifest.get("known_facts"), list) else 0,
            "unknown_count": len(manifest.get("unknowns", [])) if isinstance(manifest.get("unknowns"), list) else 0,
            "assumption_count": len(manifest.get("assumptions", [])) if isinstance(manifest.get("assumptions"), list) else 0,
            "phase_state": manifest.get("phase_state"),
            "phase_path": list(manifest.get("phase_path", [])) if isinstance(manifest.get("phase_path"), list) else [],
        },
        "renderer_permission_boundary": {
            "output_permissions": source_status.get("output_permissions"),
            "interpretation": permission.get("interpretation"),
            "renderer_output_permitted": False,
            "may_present_as_verified_fact": False,
        },
        "future_storage_preview": {
            "namespace": "forge/memory/mea_manifest_memory_v1",
            "ledger_file": "hypothesis_test_required_records.jsonl",
            "writes_permitted_in_this_patch": False,
            "requires_future_explicit_approval_gate": True,
            "chroma_write_permitted": False,
            "identity_vault_write_permitted": False,
            "memory_promotion_permitted": False,
        },
        "rejected_draft_record_previews": [],
        "rejected_draft_exclusion_reason": "no traceable rejected draft is present in the committed transition being previewed",
        "existing_rmc_writer_compatibility": {
            "module": "forge/rmc_engine_v1/memory_writer.py",
            "status": "adapter_boundary_defined_not_invoked",
            "reason": "downstream RMC writer requires renderer and echo-validation packets not yet authorized for MEA",
            "future_handoff_requires_renderer_and_echo_validation": True,
        },
    }
    record_hash = _canonical_hash(record_core)
    return {
        **record_core,
        "record_id": f"mea_mem_preview_{record_hash[:24]}",
        "memory_record_hash": record_hash,
    }


def evaluate_manifest_memory_writer_dry_run_request(
    request: Optional[Mapping[str, Any]],
    *,
    store_root: Optional[Path] = None,
    endpoint: str = MANIFEST_MEMORY_WRITER_DRY_RUN_ROUTE,
) -> Dict[str, Any]:
    """Build a deterministic memory-record preview from one verified committed MEA transition."""
    req = dict(request or {}) if isinstance(request, Mapping) else {}
    if endpoint.split("?", 1)[0] != MANIFEST_MEMORY_WRITER_DRY_RUN_ROUTE:
        return _reject("route_mismatch", ["memory writer dry-run is authorized only on POST /api/mea/memory-writer-dry-run"], endpoint)
    if req.get("approval_token") != MANIFEST_MEMORY_WRITER_APPROVAL_TOKEN:
        return _reject("approval_token_required", ["missing or invalid approval token for MEA memory writer dry-run"], endpoint)
    missing = [field for field in _REQUIRED_TARGET_FIELDS if not req.get(field)]
    invalid_hashes = [
        field for field in _REQUIRED_TARGET_FIELDS
        if field not in {"transaction_id", "candidate_id"} and req.get(field) and not _is_sha256(req.get(field))
    ]
    if missing or invalid_hashes:
        errors = []
        if missing:
            errors.append("missing required target fields: " + ", ".join(missing))
        if invalid_hashes:
            errors.append("invalid SHA-256 target fields: " + ", ".join(invalid_hashes))
        return _reject("required_target_fields_invalid", errors, endpoint)

    replay_request = {field: req[field] for field in _REQUIRED_TARGET_FIELDS}
    replay_request["approval_token"] = LIVE_TRACE_REPLAY_APPROVAL_TOKEN
    replay = evaluate_live_trace_replay_request(
        replay_request,
        store_root=store_root,
        endpoint=LIVE_TRACE_REPLAY_POST_ROUTE,
    )
    if replay.get("gate_status") != "REPLAY_VERIFIED_NO_MUTATION" or replay.get("all_replay_checks_passed") is not True:
        return _reject("live_trace_replay_required", list(replay.get("replay_errors") or ["Patch 298 replay verification did not pass"]), endpoint)

    source_status = problem_manifest_store_status(store_root=store_root, endpoint="/api/mea/problem-manifest")
    if source_status.get("integrity_verified") is not True:
        return _reject("committed_state_integrity_failed", ["committed MEA manifest state is not integrity verified"], endpoint)
    if source_status.get("stored_memory_written") is True or source_status.get("stored_memory_promoted") is True:
        return _reject("memory_boundary_already_exceeded", ["committed MEA record reports memory write or promotion already active"], endpoint)

    preview = _record_preview(source_status, replay)
    # Determinism check compiles the record twice from the same verified source object.
    stability_preview = _record_preview(source_status, replay)
    payload = _base_payload(endpoint)
    payload.update({
        "status": "OK",
        "gate_status": "MEMORY_RECORD_DRY_RUN_READY_NO_WRITE",
        "accepted": True,
        "dry_run_verified": True,
        "source_replay_gate_status": replay.get("gate_status"),
        "replay_verified": replay.get("replay_verified") is True,
        "all_replay_checks_passed": replay.get("all_replay_checks_passed") is True,
        "source_state_integrity_verified": source_status.get("integrity_verified") is True,
        "problem_id": preview.get("problem_id"),
        "candidate_id": preview.get("candidate_id"),
        "candidate_hash": preview.get("candidate_hash"),
        "claim_status": preview.get("claim_status"),
        "proof_debt": preview.get("proof_debt"),
        "memory_tier": preview.get("memory_tier"),
        "verified_fact": False,
        "source_manifest_hash": preview.get("source_manifest_hash"),
        "source_state_content_hash": preview.get("source_state_content_hash"),
        "committed_manifest_hash": preview.get("committed_manifest_hash"),
        "committed_state_content_hash": preview.get("committed_state_content_hash"),
        "transaction_intent_hash": preview.get("transaction_intent_hash"),
        "transaction_seal_packet_hash": preview.get("transaction_seal_packet_hash"),
        "transaction_audit_chain_hash": preview.get("transaction_audit_chain_hash"),
        "advance_receipt_hash": preview.get("advance_receipt_hash"),
        "rollback_record_hash": preview.get("rollback_record_hash"),
        "memory_record_id": preview.get("record_id"),
        "memory_record_hash": preview.get("memory_record_hash"),
        "memory_record_hash_stability_proven": preview.get("memory_record_hash") == stability_preview.get("memory_record_hash"),
        "memory_record_preview": preview,
        "rejected_draft_records_previewed": False,
        "existing_rmc_memory_writer_invoked": False,
        "future_local_jsonl_writer_required": True,
    })
    return payload
