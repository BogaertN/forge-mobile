"""
forge/rmc_engine_v1/mea/problem_manifest_store.py

Patch 294 — MEA Controlled Problem Manifest Store.

This is the first deliberately persistent MEA surface. It creates the live
problem-manifest API required by the MEA Phase 5 plan, but it is constrained to
initial seeding of one validated problem manifest. It does not consume the
Patch 293 advance preview, does not commit a candidate, does not execute a
seal, and does not write RMC memory, Chroma, or Identity Vault state.

Persistence law for Patch 294:
- POST /api/mea/problem-manifest requires explicit operator approval.
- Only a seed manifest accepted by the existing Patch 281 seed gate may be
  persisted.
- The first valid seed is written atomically to a Forge-owned runtime-state
  directory with an immutable receipt and a rollback plan.
- Repeating the identical seed is idempotent and does not write again.
- A conflicting seed is refused; Patch 294 never overwrites live state.
- GET /api/mea/problem-manifest reads and verifies the stored state only.

Important terminology clarification:
The MEA schema field ``output_permissions == 'sealed'`` is retained for schema
compatibility. In this store it means the renderer gate is closed. It does not
mean a candidate was sealed, a seal was executed, or a manifest advance was
performed.
"""

from __future__ import annotations

import contextlib
import copy
import fcntl
import hashlib
import json
import os
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterator, Mapping, Optional, Tuple

from .manifest_schema import (
    ProblemManifest,
    canonical_dict,
    canonical_hash,
    from_dict,
    to_dict,
    validate_manifest,
)
from .seed_manifest_gate import (
    SEED_GATE_APPROVAL_TOKEN,
    evaluate_seed_manifest_request,
)

PROBLEM_MANIFEST_STORE_PATCH_ID = "Patch 294 — MEA Controlled Problem Manifest Store"
PROBLEM_MANIFEST_STORE_SCHEMA_VERSION = "mea_problem_manifest_store_v1_patch294"
PROBLEM_MANIFEST_STORE_MODE = "controlled_mea_problem_manifest_store_patch294"
PROBLEM_MANIFEST_GET_ROUTE = "/api/mea/problem-manifest"
PROBLEM_MANIFEST_POST_ROUTE = "/api/mea/problem-manifest"
PROBLEM_MANIFEST_STORE_APPROVAL_TOKEN = "APPROVE_MEA_PROBLEM_MANIFEST_STORE"
PROBLEM_MANIFEST_STORE_FORMULA = (
    "Store(M_0)=ApprovalToken∧SeedGate∧Validate∧NoOverwrite∧AtomicWrite∧Receipt∧RollbackPlan; "
    "advances_live_manifest=false; writes_memory=false"
)
STORE_DIRECTORY_NAME = "mea_problem_manifest_store_v1"
CURRENT_STATE_FILENAME = "current_problem_manifest.json"
PROBLEM_MANIFEST_RESPONSE_CONTRACT_PATCH_ID = "Patch 297R — MEA Idempotent Response Action/State Semantic Separation Hotfix"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _canonical_json_bytes(value: Mapping[str, Any]) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _hash_mapping(value: Mapping[str, Any]) -> str:
    return hashlib.sha256(_canonical_json_bytes(value)).hexdigest()


def _is_sha256(value: object) -> bool:
    return isinstance(value, str) and len(value) == 64 and all(ch in "0123456789abcdef" for ch in value)


def default_store_root() -> Path:
    """Return fixed Forge-owned state root; no user-supplied filesystem path is accepted by HTTP routes."""
    forge_root = Path(__file__).resolve().parents[2]
    return forge_root / "runtime_state" / STORE_DIRECTORY_NAME


def _store_paths(store_root: Optional[Path] = None) -> Dict[str, Path]:
    root = Path(store_root) if store_root is not None else default_store_root()
    root = root.resolve()
    return {
        "root": root,
        "current": root / CURRENT_STATE_FILENAME,
        "receipts": root / "receipts",
        "rollback": root / "rollback_plans",
        "lock": root / ".store.lock",
    }


def _ensure_store_dirs(paths: Mapping[str, Path]) -> None:
    for key in ("root", "receipts", "rollback"):
        path = paths[key]
        if path.exists() and path.is_symlink():
            raise RuntimeError(f"refusing symlinked MEA store directory: {key}")
        path.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(path, 0o700)


@contextlib.contextmanager
def _exclusive_store_lock(paths: Mapping[str, Path]) -> Iterator[None]:
    _ensure_store_dirs(paths)
    lock_path = paths["lock"]
    if lock_path.exists() and lock_path.is_symlink():
        raise RuntimeError("refusing symlinked MEA store lock")
    with lock_path.open("a+", encoding="utf-8") as lock_file:
        os.chmod(lock_path, 0o600)
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


def _atomic_write_json(path: Path, payload: Mapping[str, Any]) -> None:
    """Write canonical JSON using fsync + same-directory atomic replacement."""
    parent = path.parent
    parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(parent, 0o700)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=str(parent))
    tmp_path = Path(tmp_name)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(_canonical_json_bytes(payload))
            handle.write(b"\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(tmp_path, 0o600)
        os.replace(tmp_path, path)
        os.chmod(path, 0o600)
        dir_fd = os.open(str(parent), os.O_DIRECTORY)
        try:
            os.fsync(dir_fd)
        finally:
            os.close(dir_fd)
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


def output_permission_interpretation(manifest_value: str) -> Dict[str, Any]:
    """Disambiguate schema-level renderer gating from candidate/seal execution state."""
    return {
        "manifest_field": "output_permissions",
        "manifest_value": manifest_value,
        "interpretation": "renderer_gate_closed_until_a_later_valid_seal_and_echo_validation_path",
        "means_candidate_sealed": False,
        "means_seal_executed": False,
        "means_live_manifest_advanced": False,
        "means_memory_promoted": False,
    }


def _readback_response_contract_fields() -> Dict[str, Any]:
    """Name route ownership separately from the stored record writer patch."""
    return {
        "route_implementation_patch": PROBLEM_MANIFEST_STORE_PATCH_ID,
        "response_contract_patch": PROBLEM_MANIFEST_RESPONSE_CONTRACT_PATCH_ID,
        "response_semantics": "invocation_action_fields_describe_this_read_request_only; stored_state_fields_describe_persisted_record",
    }


def problem_manifest_store_boundary() -> Dict[str, Any]:
    return {
        "patch": PROBLEM_MANIFEST_STORE_PATCH_ID,
        "schema_version": PROBLEM_MANIFEST_STORE_SCHEMA_VERSION,
        "layer": "MEA controlled initial live problem-manifest state store",
        "read_only": False,
        "non_mutating": False,
        "creates_get_routes": True,
        "creates_post_routes": True,
        "get_routes": [PROBLEM_MANIFEST_GET_ROUTE],
        "post_routes": [PROBLEM_MANIFEST_POST_ROUTE],
        "requires_approval_token": True,
        "approval_token": PROBLEM_MANIFEST_STORE_APPROVAL_TOKEN,
        "writes_files": True,
        "writes_mea_runtime_state": True,
        "writes_atomic_state_record": True,
        "writes_audit_receipt": True,
        "writes_rollback_plan": True,
        "uses_file_lock": True,
        "allows_initial_seed_only": True,
        "rejects_overwrite": True,
        "idempotent_same_manifest_no_write": True,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "performs_network_io": False,
        "seeds_live_manifests": True,
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
        "live_candidate_advance_route_available": False,
        "memory_promotion_route_available": False,
        "downstream_candidate_generation_reads_persisted_state": False,
        "next_wiring_patch": "Patch 295 — Controlled /api/mea/candidates",
    }


def _empty_store_payload(endpoint: str = PROBLEM_MANIFEST_GET_ROUTE) -> Dict[str, Any]:
    paths = _store_paths()
    return {
        "status": "UNINITIALIZED",
        "endpoint": endpoint,
        "mode": PROBLEM_MANIFEST_STORE_MODE,
        "current_patch": PROBLEM_MANIFEST_STORE_PATCH_ID,
        "schema_version": PROBLEM_MANIFEST_STORE_SCHEMA_VERSION,
        **_readback_response_contract_fields(),
        "store_visible": True,
        "initialized": False,
        "state_file_present": False,
        "state_root": str(paths["root"]),
        "current_state_file": str(paths["current"]),
        "write_route": PROBLEM_MANIFEST_POST_ROUTE,
        "approval_required_for_write": True,
        "approval_token": PROBLEM_MANIFEST_STORE_APPROVAL_TOKEN,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "advances_live_manifest": False,
        "seals_candidates": False,
        "promotes_to_memory": False,
        "seal_route_available": False,
        "boundary": problem_manifest_store_boundary(),
    }


def _seed_gate_payload(request: Mapping[str, Any]) -> Dict[str, Any]:
    seed_request: Dict[str, Any] = {
        "approval_token": SEED_GATE_APPROVAL_TOKEN,
        "source": str(request.get("source") or "problem_manifest_store_patch294"),
    }
    if bool(request.get("use_fixture") or request.get("canonical_144hz_fixture")):
        seed_request["use_fixture"] = True
    else:
        if "manifest" in request:
            seed_request["manifest"] = request.get("manifest")
        elif "problem_manifest" in request:
            seed_request["problem_manifest"] = request.get("problem_manifest")
    return evaluate_seed_manifest_request(seed_request)


def _build_state_core(manifest: ProblemManifest, manifest_hash: str, source: str, seed_gate_hash: str) -> Dict[str, Any]:
    return {
        "state_kind": "mea_problem_manifest_initial_seed_state",
        "store_schema_version": PROBLEM_MANIFEST_STORE_SCHEMA_VERSION,
        "problem_id": manifest.problem_id,
        "manifest_hash": manifest_hash,
        "canonical_manifest": canonical_dict(manifest),
        "source": source,
        "seed_gate_hash": seed_gate_hash,
        "output_permission_interpretation": output_permission_interpretation(manifest.output_permissions),
        "persistence_scope": {
            "initial_seed_only": True,
            "candidate_committed": False,
            "seal_executed": False,
            "live_manifest_advanced": False,
            "memory_written": False,
            "memory_promoted": False,
        },
    }


def _build_state_record(
    manifest: ProblemManifest,
    manifest_hash: str,
    source: str,
    seed_gate_hash: str,
    stored_at_utc: str,
) -> Dict[str, Any]:
    state_core = _build_state_core(manifest, manifest_hash, source, seed_gate_hash)
    state_content_hash = _hash_mapping(state_core)
    transaction_id = f"initial_seed_{state_content_hash[:24]}"
    return {
        "store_schema_version": PROBLEM_MANIFEST_STORE_SCHEMA_VERSION,
        "current_patch": PROBLEM_MANIFEST_STORE_PATCH_ID,
        "transaction_id": transaction_id,
        "state_content_hash": state_content_hash,
        "stored_at_utc": stored_at_utc,
        "manifest_hash": manifest_hash,
        "problem_id": manifest.problem_id,
        "manifest": to_dict(manifest),
        "state_core": state_core,
        "output_permission_interpretation": output_permission_interpretation(manifest.output_permissions),
        "committed_initial_seed": True,
        "candidate_committed": False,
        "seal_executed": False,
        "live_manifest_advanced": False,
        "memory_written": False,
        "memory_promoted": False,
    }


def _build_write_receipt(record: Mapping[str, Any], stored_at_utc: str) -> Dict[str, Any]:
    payload = {
        "receipt_kind": "mea_problem_manifest_initial_seed_write_receipt",
        "schema_version": PROBLEM_MANIFEST_STORE_SCHEMA_VERSION,
        "patch_id": PROBLEM_MANIFEST_STORE_PATCH_ID,
        "transaction_id": record["transaction_id"],
        "stored_at_utc": stored_at_utc,
        "manifest_hash": record["manifest_hash"],
        "state_content_hash": record["state_content_hash"],
        "write_scope": "forge_owned_runtime_state_only",
        "atomic_write": True,
        "previous_state_existed": False,
        "overwrote_existing_state": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "advances_live_manifest": False,
        "seals_candidates": False,
    }
    return {**payload, "receipt_hash": _hash_mapping(payload)}


def _build_rollback_plan(record: Mapping[str, Any], receipt: Mapping[str, Any], stored_at_utc: str) -> Dict[str, Any]:
    payload = {
        "rollback_plan_kind": "mea_problem_manifest_initial_seed_rollback_plan",
        "schema_version": PROBLEM_MANIFEST_STORE_SCHEMA_VERSION,
        "patch_id": PROBLEM_MANIFEST_STORE_PATCH_ID,
        "transaction_id": record["transaction_id"],
        "created_at_utc": stored_at_utc,
        "manifest_hash": record["manifest_hash"],
        "state_content_hash": record["state_content_hash"],
        "write_receipt_hash": receipt["receipt_hash"],
        "previous_state_existed": False,
        "backup_manifest_path": None,
        "rollback_action": "remove_current_state_only_if_manifest_hash_and_state_content_hash_still_match_this_receipt",
        "rollback_execution_exposed_by_api": False,
        "manual_review_required_before_rollback": True,
        "reason": "Patch 294 permits initial seed only and never overwrites an existing state; no previous state requires restoration.",
    }
    return {**payload, "rollback_plan_hash": _hash_mapping(payload)}


def _verify_state_record(record: Mapping[str, Any]) -> Tuple[bool, Tuple[str, ...], Dict[str, Any]]:
    errors = []
    manifest_payload = record.get("manifest")
    if not isinstance(manifest_payload, Mapping):
        return False, ("stored record manifest is missing or invalid",), {}
    try:
        manifest = from_dict(dict(manifest_payload))
    except Exception as exc:
        return False, (f"stored record manifest parse failed: {str(exc)[:160]}",), {}
    validation = validate_manifest(manifest)
    if not validation.valid:
        errors.extend(validation.errors)
    manifest_hash = canonical_hash(manifest)
    if record.get("manifest_hash") != manifest_hash:
        errors.append("stored manifest_hash does not match canonical manifest")
    state_core = record.get("state_core")
    if not isinstance(state_core, Mapping):
        errors.append("stored state_core is missing")
        expected_state_hash = None
    else:
        expected_state_hash = _hash_mapping(dict(state_core))
        if record.get("state_content_hash") != expected_state_hash:
            errors.append("stored state_content_hash does not match canonical state_core")
    semantics = record.get("output_permission_interpretation") or {}
    if semantics.get("means_candidate_sealed") is not False or semantics.get("means_seal_executed") is not False:
        errors.append("output permission semantics do not explicitly block seal interpretation")
    if isinstance(state_core, Mapping):
        if state_core.get("manifest_hash") != manifest_hash:
            errors.append("state_core manifest_hash does not bind stored manifest")
        if state_core.get("canonical_manifest") != canonical_dict(manifest):
            errors.append("state_core canonical_manifest does not bind stored manifest")
        if state_core.get("output_permission_interpretation") != semantics:
            errors.append("state_core output permission interpretation mismatch")
        if state_core.get("state_kind") == "mea_problem_manifest_committed_advance_state":
            binding = state_core.get("transaction_binding") if isinstance(state_core.get("transaction_binding"), Mapping) else {}
            selected = state_core.get("selected_candidate") if isinstance(state_core.get("selected_candidate"), Mapping) else {}
            persistence_scope = state_core.get("persistence_scope") if isinstance(state_core.get("persistence_scope"), Mapping) else {}
            for field in (
                "transaction_intent_hash",
                "transaction_seal_packet_hash",
                "transaction_audit_chain_hash",
                "source_manifest_hash",
                "source_state_content_hash",
                "proposed_new_manifest_hash",
            ):
                if not _is_sha256(binding.get(field)):
                    errors.append(f"advanced state transaction binding missing valid {field}")
            if binding.get("proposed_new_manifest_hash") != manifest_hash:
                errors.append("advanced state transaction binding does not match committed manifest_hash")
            if binding.get("trace_source_binding_verified") is not True:
                errors.append("advanced state does not assert repaired trace source binding")
            if selected.get("claim_status") != "hypothesis":
                errors.append("Patch 297 committed advance must remain hypothesis-bound")
            if record.get("candidate_committed") is not True or record.get("seal_executed") is not True or record.get("live_manifest_advanced") is not True:
                errors.append("advanced state record does not assert committed transition flags")
            if persistence_scope.get("candidate_committed") is not True or persistence_scope.get("seal_executed") is not True or persistence_scope.get("live_manifest_advanced") is not True:
                errors.append("advanced state_core persistence scope does not assert committed transition flags")
            if persistence_scope.get("memory_written") is not False or persistence_scope.get("memory_promoted") is not False:
                errors.append("advanced state must not claim memory write or promotion")
    return not errors, tuple(errors), {
        "manifest_hash": manifest_hash,
        "state_content_hash": expected_state_hash,
        "manifest_validation": {"valid": validation.valid, "errors": list(validation.errors), "warnings": list(validation.warnings)},
    }


def _safe_child_path(root: Path, relpath: object) -> Optional[Path]:
    if not isinstance(relpath, str) or not relpath.strip():
        return None
    candidate = (root / relpath).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError:
        return None
    return candidate


def _verify_linked_artifacts(record: Mapping[str, Any], paths: Mapping[str, Path]) -> Tuple[bool, Tuple[str, ...], Dict[str, Any]]:
    errors = []
    verified: Dict[str, Any] = {}
    for label, rel_key, record_hash_key, artifact_hash_key in (
        ("write_receipt", "write_receipt_relpath", "write_receipt_hash", "receipt_hash"),
        ("rollback_plan", "rollback_plan_relpath", "rollback_plan_hash", "rollback_plan_hash"),
    ):
        artifact_path = _safe_child_path(paths["root"], record.get(rel_key))
        if artifact_path is None:
            errors.append(f"{label} path is missing or escapes the store root")
            continue
        if not artifact_path.exists() or artifact_path.is_symlink():
            errors.append(f"{label} artifact is missing or symlinked")
            continue
        try:
            artifact = json.loads(artifact_path.read_text(encoding="utf-8"))
        except Exception as exc:
            errors.append(f"{label} parse failed: {str(exc)[:120]}")
            continue
        expected_hash = artifact.get(artifact_hash_key)
        body = dict(artifact)
        body.pop(artifact_hash_key, None)
        calculated_hash = _hash_mapping(body)
        if not _is_sha256(expected_hash) or calculated_hash != expected_hash or record.get(record_hash_key) != expected_hash:
            errors.append(f"{label} hash binding failed")
        if artifact.get("manifest_hash") != record.get("manifest_hash") or artifact.get("state_content_hash") != record.get("state_content_hash"):
            errors.append(f"{label} state binding failed")
        verified[f"{label}_path"] = str(artifact_path)
        verified[f"{label}_hash"] = expected_hash
    return not errors, tuple(errors), verified


def problem_manifest_store_status(*, store_root: Optional[Path] = None, endpoint: str = PROBLEM_MANIFEST_GET_ROUTE) -> Dict[str, Any]:
    paths = _store_paths(store_root)
    if not paths["current"].exists():
        payload = _empty_store_payload(endpoint=endpoint)
        if store_root is not None:
            payload["state_root"] = str(paths["root"])
            payload["current_state_file"] = str(paths["current"])
        return payload
    if paths["current"].is_symlink():
        return {
            "status": "STATE_INTEGRITY_FAILED",
            "endpoint": endpoint,
            "mode": PROBLEM_MANIFEST_STORE_MODE,
            "current_patch": PROBLEM_MANIFEST_STORE_PATCH_ID,
            "schema_version": PROBLEM_MANIFEST_STORE_SCHEMA_VERSION,
            **_readback_response_contract_fields(),
            "initialized": True,
            "state_file_present": True,
            "integrity_verified": False,
            "integrity_errors": ["current state file is symlinked; refusing to read"],
            "writes_files": False,
            "writes_memory": False,
            "advances_live_manifest": False,
            "seal_route_available": False,
            "boundary": problem_manifest_store_boundary(),
        }
    try:
        record = json.loads(paths["current"].read_text(encoding="utf-8"))
    except Exception as exc:
        return {
            "status": "STATE_CORRUPT",
            "endpoint": endpoint,
            "mode": PROBLEM_MANIFEST_STORE_MODE,
            "current_patch": PROBLEM_MANIFEST_STORE_PATCH_ID,
            "schema_version": PROBLEM_MANIFEST_STORE_SCHEMA_VERSION,
            **_readback_response_contract_fields(),
            "initialized": True,
            "state_file_present": True,
            "integrity_verified": False,
            "error": str(exc)[:180],
            "writes_files": False,
            "writes_memory": False,
            "advances_live_manifest": False,
            "boundary": problem_manifest_store_boundary(),
        }
    integrity_verified, errors, verified = _verify_state_record(record)
    artifacts_verified, artifact_errors, artifact_verified = _verify_linked_artifacts(record, paths)
    integrity_verified = integrity_verified and artifacts_verified
    errors = tuple(errors) + tuple(artifact_errors)
    verified.update(artifact_verified)
    verified["linked_artifacts_verified"] = artifacts_verified
    return {
        "status": "OK" if integrity_verified else "STATE_INTEGRITY_FAILED",
        "endpoint": endpoint,
        "mode": PROBLEM_MANIFEST_STORE_MODE,
        "current_patch": PROBLEM_MANIFEST_STORE_PATCH_ID,
        "schema_version": PROBLEM_MANIFEST_STORE_SCHEMA_VERSION,
        **_readback_response_contract_fields(),
        "store_visible": True,
        "initialized": True,
        "state_file_present": True,
        "state_root": str(paths["root"]),
        "current_state_file": str(paths["current"]),
        "integrity_verified": integrity_verified,
        "integrity_errors": list(errors),
        "manifest_hash": record.get("manifest_hash"),
        "state_content_hash": record.get("state_content_hash"),
        "transaction_id": record.get("transaction_id"),
        "problem_id": record.get("problem_id"),
        "claim_status": (record.get("manifest") or {}).get("claim_status"),
        "proof_debt": (record.get("manifest") or {}).get("proof_debt"),
        "output_permissions": (record.get("manifest") or {}).get("output_permissions"),
        "output_permission_interpretation": record.get("output_permission_interpretation"),
        "stored_record_patch": record.get("current_patch"),
        "stored_state_kind": (record.get("state_core") or {}).get("state_kind"),
        "stored_candidate_committed": record.get("candidate_committed") is True,
        "stored_seal_executed": record.get("seal_executed") is True,
        "stored_live_manifest_advanced": record.get("live_manifest_advanced") is True,
        "stored_memory_written": record.get("memory_written") is True,
        "stored_memory_promoted": record.get("memory_promoted") is True,
        "stored_transaction_intent_hash": record.get("transaction_intent_hash"),
        "stored_state": record,
        "verified": verified,
        "write_route": PROBLEM_MANIFEST_POST_ROUTE,
        "writes_files": False,
        "invocation_write_performed": False,
        "invocation_candidate_commit_executed": False,
        "invocation_manifest_advance_executed": False,
        "invocation_seal_executed": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "commits_live_candidates": False,
        "advances_live_manifest": False,
        "seals_candidates": False,
        "promotes_to_memory": False,
        "seal_route_available": False,
        "downstream_candidate_generation_reads_persisted_state": False,
        "boundary": problem_manifest_store_boundary(),
    }


def _rejection(reason_code: str, errors: Tuple[str, ...], *, endpoint: str = PROBLEM_MANIFEST_POST_ROUTE) -> Dict[str, Any]:
    return {
        "status": "REJECTED",
        "endpoint": endpoint,
        "mode": PROBLEM_MANIFEST_STORE_MODE,
        "current_patch": PROBLEM_MANIFEST_STORE_PATCH_ID,
        "schema_version": PROBLEM_MANIFEST_STORE_SCHEMA_VERSION,
        "gate_status": "REJECTED",
        "accepted": False,
        "reason_code": reason_code,
        "gate_errors": list(errors),
        "approval_required": True,
        "expected_approval_token": PROBLEM_MANIFEST_STORE_APPROVAL_TOKEN,
        "write_performed": False,
        "initialized": False,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "commits_live_candidates": False,
        "advances_live_manifest": False,
        "seals_candidates": False,
        "promotes_to_memory": False,
        "seal_route_available": False,
        "boundary": problem_manifest_store_boundary(),
    }


def evaluate_problem_manifest_store_request(
    request: Optional[Mapping[str, Any]],
    *,
    store_root: Optional[Path] = None,
    now_utc: Optional[str] = None,
    endpoint: str = PROBLEM_MANIFEST_POST_ROUTE,
) -> Dict[str, Any]:
    """Validate and atomically persist one initial manifest seed, never an advanced state."""
    req = dict(request) if isinstance(request, Mapping) else {}
    token = str(req.get("approval_token") or "")
    if token != PROBLEM_MANIFEST_STORE_APPROVAL_TOKEN:
        return _rejection("approval_token_required", ("missing or invalid approval_token for controlled MEA problem-manifest store",), endpoint=endpoint)
    if str(req.get("operation") or "") != "seed":
        return _rejection("seed_operation_required", ("operation must be exactly 'seed' in Patch 294",), endpoint=endpoint)
    if req.get("advance_manifest") or req.get("persist_advance_preview") or req.get("selected_candidate_id"):
        return _rejection("manifest_advance_not_allowed", ("Patch 294 stores initial problem manifests only; candidate-driven advance remains blocked",), endpoint=endpoint)

    seed_gate = _seed_gate_payload(req)
    if seed_gate.get("status") != "OK" or seed_gate.get("accepted") is not True:
        return _rejection("seed_gate_rejected", tuple(seed_gate.get("gate_errors") or seed_gate.get("validation_errors") or ["seed gate rejected request"]), endpoint=endpoint)
    manifest_payload = seed_gate.get("seed_manifest_preview")
    if not isinstance(manifest_payload, Mapping):
        return _rejection("seed_manifest_missing", ("accepted seed gate did not return a manifest payload",), endpoint=endpoint)
    manifest = from_dict(dict(manifest_payload))
    manifest_hash = canonical_hash(manifest)
    source = str(seed_gate.get("source") or "problem_manifest_store_patch294")
    seed_gate_bindable = {
        "manifest_hash": seed_gate.get("manifest_hash"),
        "problem_id": seed_gate.get("problem_id"),
        "claim_status": seed_gate.get("claim_status"),
        "proof_debt": seed_gate.get("proof_debt"),
        "output_permissions": seed_gate.get("output_permissions"),
        "accepted": seed_gate.get("accepted"),
        "gate_status": seed_gate.get("gate_status"),
    }
    seed_gate_hash = _hash_mapping(seed_gate_bindable)
    stored_at_utc = now_utc or _utc_now()
    record = _build_state_record(manifest, manifest_hash, source, seed_gate_hash, stored_at_utc)
    receipt = _build_write_receipt(record, stored_at_utc)
    rollback = _build_rollback_plan(record, receipt, stored_at_utc)
    paths = _store_paths(store_root)

    with _exclusive_store_lock(paths):
        if paths["current"].exists():
            existing_status = problem_manifest_store_status(store_root=paths["root"], endpoint=PROBLEM_MANIFEST_GET_ROUTE)
            if existing_status.get("integrity_verified") is not True:
                return _rejection("existing_state_integrity_failed", ("existing state failed integrity verification; refusing write",), endpoint=endpoint)
            if existing_status.get("manifest_hash") == manifest_hash:
                return {
                    "status": "OK",
                    "endpoint": endpoint,
                    "mode": PROBLEM_MANIFEST_STORE_MODE,
                    "current_patch": PROBLEM_MANIFEST_STORE_PATCH_ID,
                    "schema_version": PROBLEM_MANIFEST_STORE_SCHEMA_VERSION,
                    "gate_status": "ALREADY_PRESENT_IDEMPOTENT_NO_WRITE",
                    "accepted": True,
                    "reason_code": "idempotent_existing_seed",
                    "initialized": True,
                    "manifest_hash": manifest_hash,
                    "state_content_hash": existing_status.get("state_content_hash"),
                    "problem_id": manifest.problem_id,
                    "claim_status": manifest.claim_status,
                    "proof_debt": manifest.proof_debt,
                    "output_permissions": manifest.output_permissions,
                    "output_permission_interpretation": output_permission_interpretation(manifest.output_permissions),
                    "write_performed": False,
                    "idempotent_no_write": True,
                    "writes_files": False,
                    "writes_memory": False,
                    "writes_chroma": False,
                    "writes_identity_vault": False,
                    "commits_live_candidates": False,
                    "advances_live_manifest": False,
                    "seals_candidates": False,
                    "promotes_to_memory": False,
                    "seal_route_available": False,
                    "boundary": problem_manifest_store_boundary(),
                }
            return _rejection("existing_manifest_conflict_no_overwrite", ("Patch 294 refuses to overwrite an existing live problem manifest",), endpoint=endpoint)

        receipt_path = paths["receipts"] / f"{record['transaction_id']}_write_receipt.json"
        rollback_path = paths["rollback"] / f"{record['transaction_id']}_rollback_plan.json"
        record_to_write = copy.deepcopy(record)
        record_to_write["write_receipt_relpath"] = str(receipt_path.relative_to(paths["root"]))
        record_to_write["rollback_plan_relpath"] = str(rollback_path.relative_to(paths["root"]))
        record_to_write["write_receipt_hash"] = receipt["receipt_hash"]
        record_to_write["rollback_plan_hash"] = rollback["rollback_plan_hash"]
        _atomic_write_json(rollback_path, rollback)
        _atomic_write_json(receipt_path, receipt)
        _atomic_write_json(paths["current"], record_to_write)

    return {
        "status": "OK",
        "endpoint": endpoint,
        "mode": PROBLEM_MANIFEST_STORE_MODE,
        "current_patch": PROBLEM_MANIFEST_STORE_PATCH_ID,
        "schema_version": PROBLEM_MANIFEST_STORE_SCHEMA_VERSION,
        "formula": PROBLEM_MANIFEST_STORE_FORMULA,
        "gate_status": "PERSISTED_INITIAL_SEED",
        "accepted": True,
        "reason_code": "controlled_initial_seed_persisted",
        "initialized": True,
        "manifest_hash": manifest_hash,
        "state_content_hash": record["state_content_hash"],
        "transaction_id": record["transaction_id"],
        "problem_id": manifest.problem_id,
        "claim_status": manifest.claim_status,
        "proof_debt": manifest.proof_debt,
        "output_permissions": manifest.output_permissions,
        "output_permission_interpretation": output_permission_interpretation(manifest.output_permissions),
        "write_performed": True,
        "atomic_write_completed": True,
        "write_receipt_hash": receipt["receipt_hash"],
        "rollback_plan_hash": rollback["rollback_plan_hash"],
        "rollback_plan_created": True,
        "overwrote_existing_state": False,
        "writes_files": True,
        "writes_mea_runtime_state": True,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "performs_network_io": False,
        "commits_live_candidates": False,
        "advances_live_manifest": False,
        "seals_candidates": False,
        "promotes_to_memory": False,
        "seal_route_available": False,
        "downstream_candidate_generation_reads_persisted_state": False,
        "boundary": problem_manifest_store_boundary(),
    }
