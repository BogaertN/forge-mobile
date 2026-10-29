"""
forge/rmc_engine_v1/mea/controlled_manifest_memory_writer.py

MEA-RMC-MEMORY-WRITER-BUILD-005 — Controlled Forge-Owned MEA Manifest
Memory Writer Gate.

This is the first live persistence layer for a sealed, replay-verified MEA
problem-manifest transition. It extends the Patch 299 preview contract without
altering or invoking downstream RMC rendered-output memory.

Authorization law:
- One explicit approval token is required for each invocation.
- The caller must bind the approved write to the sealed manifest hash, seal
  receipt hash, and Patch 299 memory-writer preview hash.
- The writer reconstructs the Patch 299 preview from the live Patch 297/298
  trace and accepts only exact matching hashes.
- A write can never upgrade the manifest's claim_status or lower proof_debt.

Persistence law:
- The approved record is appended to Forge-owned JSONL memory only:
  forge/memory/mea_manifest_memory_v1/hypothesis_test_required_records.jsonl
- The JSONL ledger is append-only and hash chained.
- Duplicate writes of the same deterministic record are idempotent no-writes.
- Conflicting writes for an already-recorded sealed manifest are rejected.
- A per-entry receipt is written after the authoritative JSONL append and is
  verified against the JSONL record on readback.

Excluded pathways:
- No mutation of the MEA runtime-state manifest store.
- No RMC renderer, output memory, Echo Validator, or user-facing output.
- No Chroma, Identity Vault, Contribution Economy, CT, or ledger interaction.
- No LLM, network, or shell execution.
"""
from __future__ import annotations

import fcntl
import hashlib
import json
import os
import tempfile
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterator, Mapping, Optional, Sequence, Tuple

from .manifest_memory_writer import (
    MANIFEST_MEMORY_WRITER_APPROVAL_TOKEN,
    evaluate_manifest_memory_writer_dry_run_request,
    manifest_memory_writer_status,
)
from .problem_manifest_store import problem_manifest_store_status

CONTROLLED_MEMORY_WRITER_BUILD_ID = "MEA-RMC-MEMORY-WRITER-BUILD-005"
CONTROLLED_MEMORY_WRITER_SCHEMA_VERSION = "mea_controlled_manifest_memory_writer_v1_build005"
CONTROLLED_MEMORY_RECORD_SCHEMA_VERSION = "mea_manifest_memory_record_v1_build005"
CONTROLLED_MEMORY_LEDGER_SCHEMA_VERSION = "mea_manifest_memory_jsonl_ledger_entry_v1_build005"
CONTROLLED_MEMORY_RECEIPT_SCHEMA_VERSION = "mea_manifest_memory_write_receipt_v1_build005"
CONTROLLED_MEMORY_WRITER_APPROVAL_TOKEN = "APPROVE_MEA_RMC_MEMORY_WRITER_BUILD005_JSONL_COMMIT"
CONTROLLED_MEMORY_TIER = "hypothesis_test_required_record"
CONTROLLED_LEDGER_FILENAME = "hypothesis_test_required_records.jsonl"
CONTROLLED_RECEIPT_DIRECTORY = "receipts"
CONTROLLED_LOCK_FILENAME = ".store.lock"
CONTROLLED_MEMORY_WRITER_FORMULA = (
    "W_mea(M_t+1)=Approval∧SealedManifestHash∧SealReceiptHash∧PreviewHash∧"
    "ReplayVerified∧AppendOnlyJSONL∧HashChain∧Readback; "
    "render=false; chroma=false; identity_vault=false; ct=false"
)
_REQUIRED_REQUEST_FIELDS: Tuple[str, ...] = (
    "sealed_manifest_hash",
    "seal_receipt_hash",
    "memory_writer_preview_hash",
)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _is_sha256(value: Any) -> bool:
    return isinstance(value, str) and len(value) == 64 and all(ch in "0123456789abcdef" for ch in value)


def _canonical_json_bytes(value: Mapping[str, Any]) -> bytes:
    return json.dumps(dict(value), sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _canonical_hash(value: Mapping[str, Any]) -> str:
    return hashlib.sha256(_canonical_json_bytes(value)).hexdigest()


def default_memory_root() -> Path:
    forge_root = Path(__file__).resolve().parents[2]
    return forge_root / "memory" / "mea_manifest_memory_v1"


def _paths(memory_root: Optional[Path] = None) -> Dict[str, Path]:
    root = Path(memory_root) if memory_root is not None else default_memory_root()
    root = root.resolve()
    return {
        "root": root,
        "ledger": root / CONTROLLED_LEDGER_FILENAME,
        "receipts": root / CONTROLLED_RECEIPT_DIRECTORY,
        "lock": root / CONTROLLED_LOCK_FILENAME,
    }


def controlled_memory_writer_boundary() -> Dict[str, Any]:
    return {
        "build_id": CONTROLLED_MEMORY_WRITER_BUILD_ID,
        "schema_version": CONTROLLED_MEMORY_WRITER_SCHEMA_VERSION,
        "layer": "MEA sealed manifest to Forge-owned append-only JSONL memory",
        "controlled_write": True,
        "requires_approval_token": True,
        "required_bindings": list(_REQUIRED_REQUEST_FIELDS),
        "requires_patch299_preview_reconstruction": True,
        "requires_patch298_replay_verification": True,
        "requires_committed_seal_state": True,
        "writes_files": True,
        "writes_jsonl_ledger": True,
        "writes_receipt": True,
        "uses_file_lock": True,
        "hash_chained": True,
        "duplicate_same_record_idempotent_no_write": True,
        "conflicting_duplicate_rejected": True,
        "writes_mea_runtime_state": False,
        "writes_rmc_output_memory": False,
        "invokes_rmc_renderer": False,
        "invokes_echo_validator": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "creates_memory_capsule": False,
        "mints_contribution_tokens": False,
        "writes_influence_ledger": False,
        "writes_investment_ledger": False,
        "calls_llm": False,
        "executes_shell": False,
        "performs_network_io": False,
        "renders_user_output": False,
    }


@dataclass(frozen=True)
class LedgerVerification:
    valid: bool
    errors: Tuple[str, ...]
    entries: Tuple[Dict[str, Any], ...]
    last_entry_hash: Optional[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "valid": self.valid,
            "errors": list(self.errors),
            "entry_count": len(self.entries),
            "last_entry_hash": self.last_entry_hash,
        }


def _verify_ledger(ledger_path: Path) -> LedgerVerification:
    if not ledger_path.exists():
        return LedgerVerification(valid=True, errors=(), entries=(), last_entry_hash=None)
    errors = []
    entries = []
    previous_hash: Optional[str] = None
    try:
        lines = ledger_path.read_text(encoding="utf-8").splitlines()
    except Exception as exc:
        return LedgerVerification(False, (f"ledger_read_failed:{str(exc)[:160]}",), (), None)
    for index, line in enumerate(lines, start=1):
        if not line.strip():
            errors.append(f"blank_jsonl_line:{index}")
            continue
        try:
            entry = json.loads(line)
        except Exception as exc:
            errors.append(f"invalid_json_line:{index}:{str(exc)[:120]}")
            continue
        if not isinstance(entry, dict):
            errors.append(f"entry_not_object:{index}")
            continue
        entry_hash = entry.get("entry_hash")
        body = {key: value for key, value in entry.items() if key != "entry_hash"}
        record = _mapping(entry.get("memory_record"))
        record_hash = record.get("memory_record_hash")
        record_body = {key: value for key, value in record.items() if key != "memory_record_hash"}
        if entry.get("schema_version") != CONTROLLED_MEMORY_LEDGER_SCHEMA_VERSION:
            errors.append(f"schema_mismatch:{index}")
        if entry.get("entry_index") != index:
            errors.append(f"entry_index_mismatch:{index}")
        if entry.get("previous_entry_hash") != previous_hash:
            errors.append(f"prior_hash_mismatch:{index}")
        if not _is_sha256(record_hash) or _canonical_hash(record_body) != record_hash:
            errors.append(f"record_hash_mismatch:{index}")
        if not _is_sha256(entry_hash) or _canonical_hash(body) != entry_hash:
            errors.append(f"entry_hash_mismatch:{index}")
        entries.append(entry)
        previous_hash = entry_hash if _is_sha256(entry_hash) else None
    return LedgerVerification(not errors, tuple(errors), tuple(entries), previous_hash)


@contextmanager
def _exclusive_store_lock(lock_path: Path) -> Iterator[None]:
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a+", encoding="utf-8") as handle:
        os.chmod(lock_path, 0o600)
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def _atomic_write_json(path: Path, payload: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent))
    temp_path = Path(temp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(dict(payload), handle, indent=2, sort_keys=True, ensure_ascii=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temp_path, 0o600)
        os.replace(temp_path, path)
        os.chmod(path, 0o600)
        directory_fd = os.open(str(path.parent), os.O_DIRECTORY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    finally:
        if temp_path.exists():
            temp_path.unlink()


def _append_jsonl_entry(ledger_path: Path, entry: Mapping[str, Any]) -> None:
    ledger_path.parent.mkdir(parents=True, exist_ok=True)
    line = _canonical_json_bytes(entry) + b"\n"
    with ledger_path.open("ab") as handle:
        os.chmod(ledger_path, 0o600)
        handle.write(line)
        handle.flush()
        os.fsync(handle.fileno())
    directory_fd = os.open(str(ledger_path.parent), os.O_DIRECTORY)
    try:
        os.fsync(directory_fd)
    finally:
        os.close(directory_fd)


def _base_response(memory_root: Optional[Path]) -> Dict[str, Any]:
    paths = _paths(memory_root)
    return {
        "build_id": CONTROLLED_MEMORY_WRITER_BUILD_ID,
        "schema_version": CONTROLLED_MEMORY_WRITER_SCHEMA_VERSION,
        "formula": CONTROLLED_MEMORY_WRITER_FORMULA,
        "memory_root": str(paths["root"]),
        "ledger_file": str(paths["ledger"]),
        "memory_tier": CONTROLLED_MEMORY_TIER,
        "boundary": controlled_memory_writer_boundary(),
        "writes_mea_runtime_state": False,
        "writes_rmc_output_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "mints_contribution_tokens": False,
        "renders_user_output": False,
    }


def controlled_memory_writer_status(*, memory_root: Optional[Path] = None) -> Dict[str, Any]:
    paths = _paths(memory_root)
    verification = _verify_ledger(paths["ledger"])
    payload = _base_response(memory_root)
    payload.update({
        "status": "OK" if verification.valid else "CORRUPT",
        "initialized": paths["root"].exists(),
        "ledger_present": paths["ledger"].exists(),
        "ledger_verification": verification.to_dict(),
        "record_count": len(verification.entries),
        "latest_record_hash": (
            _mapping(verification.entries[-1].get("memory_record")).get("memory_record_hash")
            if verification.entries else None
        ),
        "write_enabled_only_by_explicit_apply_script": True,
        "http_write_route_exposed": False,
    })
    return payload


def _reject(reason_code: str, errors: Sequence[str], *, memory_root: Optional[Path]) -> Dict[str, Any]:
    payload = _base_response(memory_root)
    payload.update({
        "status": "REJECTED",
        "gate_status": "CONTROLLED_MEA_MEMORY_WRITE_REJECTED_NO_WRITE",
        "accepted": False,
        "persisted": False,
        "idempotent_no_write": False,
        "reason_code": reason_code,
        "errors": list(errors),
        "actual_files_written": [],
        "memory_record": None,
        "write_receipt": None,
    })
    return payload


def _build_persisted_record(preview_response: Mapping[str, Any]) -> Dict[str, Any]:
    preview = _mapping(preview_response.get("memory_record_preview"))
    claim_semantics = _mapping(preview.get("claim_semantics"))
    record_body: Dict[str, Any] = {
        "schema_version": CONTROLLED_MEMORY_RECORD_SCHEMA_VERSION,
        "record_type": "mea_manifest_memory_record",
        "record_status": "PERSISTED_SEALED_HYPOTHESIS_PENDING_FUTURE_EVIDENCE_AND_RENDERING",
        "memory_tier": CONTROLLED_MEMORY_TIER,
        "problem_id": preview.get("problem_id"),
        "candidate_id": preview.get("candidate_id"),
        "candidate_hash": preview.get("candidate_hash"),
        "claim_status": preview.get("claim_status"),
        "proof_debt": preview.get("proof_debt"),
        "claim_semantics": {
            "verified_fact": False,
            "hypothesis_only": claim_semantics.get("hypothesis_only") is True,
            "requires_future_evidence": True,
            "may_render_as_verified_claim": False,
            "proof_debt_preserved": claim_semantics.get("proof_debt_preserved") is True,
        },
        "source_binding": {
            "source_manifest_hash": preview.get("source_manifest_hash"),
            "source_state_content_hash": preview.get("source_state_content_hash"),
            "sealed_manifest_hash": preview.get("committed_manifest_hash"),
            "committed_state_content_hash": preview.get("committed_state_content_hash"),
            "transaction_id": preview.get("transaction_id"),
            "transaction_intent_hash": preview.get("transaction_intent_hash"),
            "transaction_seal_packet_hash": preview.get("transaction_seal_packet_hash"),
            "transaction_audit_chain_hash": preview.get("transaction_audit_chain_hash"),
            "seal_receipt_hash": preview.get("advance_receipt_hash"),
            "rollback_record_hash": preview.get("rollback_record_hash"),
        },
        "patch299_preview_binding": {
            "preview_schema_version": preview.get("record_schema_version"),
            "preview_record_id": preview.get("record_id"),
            "memory_writer_preview_hash": preview.get("memory_record_hash"),
            "preview_reconstructed_and_verified": True,
        },
        "replay_verification": dict(_mapping(preview.get("replay_verification"))),
        "manifest_scope": dict(_mapping(preview.get("manifest_scope_preview"))),
        "renderer_permission_boundary": {
            **dict(_mapping(preview.get("renderer_permission_boundary"))),
            "renderer_output_permitted": False,
            "rendering_deferred_to_later_rmc_gate": True,
        },
        "storage_boundary": {
            "storage_system": "Forge-owned local MEA manifest memory JSONL",
            "ledger_file": CONTROLLED_LEDGER_FILENAME,
            "writes_mea_runtime_state": False,
            "writes_rmc_output_memory": False,
            "writes_chroma": False,
            "writes_identity_vault": False,
            "writes_contribution_economy": False,
            "mints_contribution_tokens": False,
        },
    }
    record_hash = _canonical_hash(record_body)
    return {**record_body, "memory_record_hash": record_hash}


def _build_entry(record: Mapping[str, Any], verification: LedgerVerification, written_at_utc: str) -> Dict[str, Any]:
    entry_body: Dict[str, Any] = {
        "schema_version": CONTROLLED_MEMORY_LEDGER_SCHEMA_VERSION,
        "build_id": CONTROLLED_MEMORY_WRITER_BUILD_ID,
        "entry_index": len(verification.entries) + 1,
        "previous_entry_hash": verification.last_entry_hash,
        "ledger_file": CONTROLLED_LEDGER_FILENAME,
        "written_at_utc": written_at_utc,
        "write_scope": "forge_owned_mea_manifest_memory_only",
        "approval_token_verified": True,
        "memory_record_hash": record.get("memory_record_hash"),
        "memory_record": dict(record),
        "blocked_effects": {
            "identity_vault": True,
            "contribution_economy": True,
            "ct_mint": True,
            "influence_ledger": True,
            "investment_ledger": True,
            "chroma": True,
            "rmc_output_memory": True,
            "renderer": True,
            "public_output": True,
        },
    }
    return {**entry_body, "entry_hash": _canonical_hash(entry_body)}


def _build_receipt(entry: Mapping[str, Any], written_at_utc: str) -> Dict[str, Any]:
    record = _mapping(entry.get("memory_record"))
    body: Dict[str, Any] = {
        "schema_version": CONTROLLED_MEMORY_RECEIPT_SCHEMA_VERSION,
        "build_id": CONTROLLED_MEMORY_WRITER_BUILD_ID,
        "receipt_status": "COMMITTED_APPEND_ONLY_JSONL_MEA_MEMORY_RECORD",
        "written_at_utc": written_at_utc,
        "entry_index": entry.get("entry_index"),
        "entry_hash": entry.get("entry_hash"),
        "previous_entry_hash": entry.get("previous_entry_hash"),
        "ledger_file": CONTROLLED_LEDGER_FILENAME,
        "memory_record_hash": record.get("memory_record_hash"),
        "sealed_manifest_hash": _mapping(record.get("source_binding")).get("sealed_manifest_hash"),
        "seal_receipt_hash": _mapping(record.get("source_binding")).get("seal_receipt_hash"),
        "memory_writer_preview_hash": _mapping(record.get("patch299_preview_binding")).get("memory_writer_preview_hash"),
        "claim_status": record.get("claim_status"),
        "proof_debt": record.get("proof_debt"),
        "memory_tier": record.get("memory_tier"),
        "write_readback_verified": True,
        "blocked_effects": dict(_mapping(entry.get("blocked_effects"))),
    }
    return {**body, "receipt_hash": _canonical_hash(body)}


def _find_existing_by_record_hash(verification: LedgerVerification, record_hash: str) -> Optional[Dict[str, Any]]:
    return next(
        (entry for entry in verification.entries if _mapping(entry.get("memory_record")).get("memory_record_hash") == record_hash),
        None,
    )


def _find_existing_by_sealed_manifest(verification: LedgerVerification, sealed_manifest_hash: str) -> Optional[Dict[str, Any]]:
    return next(
        (
            entry for entry in verification.entries
            if _mapping(_mapping(entry.get("memory_record")).get("source_binding")).get("sealed_manifest_hash") == sealed_manifest_hash
        ),
        None,
    )


def evaluate_controlled_manifest_memory_write_request(
    request: Optional[Mapping[str, Any]],
    *,
    store_root: Optional[Path] = None,
    memory_root: Optional[Path] = None,
    now_utc: Optional[str] = None,
) -> Dict[str, Any]:
    """Persist one proof-bound sealed hypothesis record into Forge-owned JSONL memory."""
    req = dict(request or {}) if isinstance(request, Mapping) else {}
    if req.get("approval_token") != CONTROLLED_MEMORY_WRITER_APPROVAL_TOKEN:
        return _reject("approval_token_required", ["missing or invalid controlled MEA memory-writer approval token"], memory_root=memory_root)
    missing = [field for field in _REQUIRED_REQUEST_FIELDS if not req.get(field)]
    invalid = [field for field in _REQUIRED_REQUEST_FIELDS if req.get(field) and not _is_sha256(req.get(field))]
    if missing or invalid:
        errors = []
        if missing:
            errors.append("missing required fields: " + ", ".join(missing))
        if invalid:
            errors.append("invalid SHA-256 fields: " + ", ".join(invalid))
        return _reject("required_write_bindings_invalid", errors, memory_root=memory_root)

    source_status = manifest_memory_writer_status(store_root=store_root)
    source_record = _mapping(problem_manifest_store_status(store_root=store_root).get("stored_state"))
    if source_status.get("available") is not True or source_status.get("gate_status") != "DRY_RUN_AVAILABLE":
        return _reject("sealed_committed_source_required", ["live MEA state is not an integrity-verified sealed/committed advance"], memory_root=memory_root)
    if source_status.get("committed_manifest_hash") != req["sealed_manifest_hash"]:
        return _reject("sealed_manifest_hash_mismatch", ["submitted sealed_manifest_hash does not match the committed MEA manifest"], memory_root=memory_root)

    preview_request = {
        "approval_token": MANIFEST_MEMORY_WRITER_APPROVAL_TOKEN,
        "transaction_id": source_status.get("transaction_id"),
        "transaction_intent_hash": source_status.get("transaction_intent_hash"),
        "candidate_id": source_status.get("candidate_id"),
        "candidate_hash": source_record.get("candidate_hash"),
        "committed_manifest_hash": source_status.get("committed_manifest_hash"),
        "committed_state_content_hash": source_status.get("committed_state_content_hash"),
    }
    preview_response = evaluate_manifest_memory_writer_dry_run_request(preview_request, store_root=store_root)
    if preview_response.get("gate_status") != "MEMORY_RECORD_DRY_RUN_READY_NO_WRITE" or preview_response.get("replay_verified") is not True:
        return _reject("patch299_preview_reconstruction_failed", ["Patch 299 dry-run preview could not be reconstructed from replay-verified committed state"], memory_root=memory_root)
    if preview_response.get("advance_receipt_hash") != req["seal_receipt_hash"]:
        return _reject("seal_receipt_hash_mismatch", ["submitted seal_receipt_hash does not match the verified seal/advance receipt"], memory_root=memory_root)
    if preview_response.get("memory_record_hash") != req["memory_writer_preview_hash"]:
        return _reject("memory_writer_preview_hash_mismatch", ["submitted memory_writer_preview_hash does not match reconstructed Patch 299 preview"], memory_root=memory_root)
    if preview_response.get("claim_status") != "hypothesis" or preview_response.get("proof_debt") != 0.85:
        return _reject("claim_boundary_violation", ["Build 005 permits only the preserved 144 Hz bounded hypothesis with proof_debt 0.85"], memory_root=memory_root)
    if preview_response.get("verified_fact") is not False:
        return _reject("verified_fact_upgrade_blocked", ["hypothesis memory cannot be written as verified fact"], memory_root=memory_root)

    record = _build_persisted_record(preview_response)
    paths = _paths(memory_root)
    written_at_utc = str(now_utc or _utc_now())
    if not written_at_utc.endswith("Z") and "+00:00" not in written_at_utc:
        return _reject("utc_timestamp_required", ["write timestamp must be UTC ISO-8601"], memory_root=memory_root)

    with _exclusive_store_lock(paths["lock"]):
        verification = _verify_ledger(paths["ledger"])
        if not verification.valid:
            return _reject("existing_ledger_integrity_failed", list(verification.errors), memory_root=memory_root)
        existing = _find_existing_by_record_hash(verification, str(record["memory_record_hash"]))
        if existing is not None:
            payload = _base_response(memory_root)
            payload.update({
                "status": "OK",
                "gate_status": "CONTROLLED_MEA_MEMORY_RECORD_ALREADY_PERSISTED_IDEMPOTENT_NO_WRITE",
                "accepted": True,
                "persisted": True,
                "idempotent_no_write": True,
                "actual_files_written": [],
                "memory_record": dict(_mapping(existing.get("memory_record"))),
                "ledger_entry": dict(existing),
                "write_receipt": None,
                "ledger_verification": verification.to_dict(),
            })
            return payload
        conflict = _find_existing_by_sealed_manifest(verification, str(req["sealed_manifest_hash"]))
        if conflict is not None:
            return _reject("conflicting_record_for_sealed_manifest", ["a different memory record already exists for the sealed manifest hash"], memory_root=memory_root)
        entry = _build_entry(record, verification, written_at_utc)
        _append_jsonl_entry(paths["ledger"], entry)
        readback = _verify_ledger(paths["ledger"])
        if not readback.valid or _find_existing_by_record_hash(readback, str(record["memory_record_hash"])) is None:
            return _reject("post_append_readback_failed", list(readback.errors) or ["written record missing after append"], memory_root=memory_root)
        receipt = _build_receipt(entry, written_at_utc)
        receipt_path = paths["receipts"] / f"{receipt['receipt_hash']}_memory_write_receipt.json"
        _atomic_write_json(receipt_path, receipt)
        receipt_readback = json.loads(receipt_path.read_text(encoding="utf-8"))
        if receipt_readback.get("receipt_hash") != receipt.get("receipt_hash"):
            return _reject("receipt_readback_failed", ["receipt hash did not survive atomic write readback"], memory_root=memory_root)

    payload = _base_response(memory_root)
    payload.update({
        "status": "OK",
        "gate_status": "COMMITTED_APPEND_ONLY_JSONL_MEA_MEMORY_RECORD",
        "accepted": True,
        "persisted": True,
        "idempotent_no_write": False,
        "record_claim_status": record.get("claim_status"),
        "record_proof_debt": record.get("proof_debt"),
        "memory_record_hash": record.get("memory_record_hash"),
        "ledger_entry_hash": entry.get("entry_hash"),
        "memory_record": record,
        "ledger_entry": entry,
        "write_receipt": receipt,
        "receipt_file": str(receipt_path),
        "actual_files_written": [str(paths["lock"]), str(paths["ledger"]), str(receipt_path)],
        "post_write_ledger_verification": readback.to_dict(),
    })
    return payload
