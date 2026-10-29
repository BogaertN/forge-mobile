"""
forge/rmc_engine_v1/renderer/mea_render_gate.py

MEA-TO-RMC-RENDER-GATE-ADAPTER-BUILD-008
Read-only MEA-to-RMC render-admission adapter.

Purpose
-------
Build 008 is the architectural boundary between a sealed MEA problem
manifest and the later RMC language corridor.  It does not render prose,
compile an RMC meaning manifest, invoke Echo Validator, write memory, or
create routes.  It answers exactly one question:

    May this already sealed, replay-verified, proof-debt-bounded MEA
    historical record be admitted to a later renderer under the same
    epistemic limitations?

The current admitted object is the historic 144 Hz record written by Build
005.  It may enter only a future *qualified hypothesis explanation* path.  It
may never be presented here as verified fact, empirical evidence, or a
discovery.

Schema law
----------
MEA problem-manifest schema and RMC meaning-manifest schema are distinct.
This adapter passes a typed render-admission packet between them; it does not
merge either schema into the other.

Hard boundary
-------------
- Reads committed MEA state, linked seal/rollback receipt verification and
  the Build 005 JSONL memory ledger.
- Re-runs Patch 298 replay verification from the committed historical state.
- Performs no render, no output approval, no echo validation and no memory
  mutation.
- Does not read or write Identity Vault, Contribution Economy, CT ledgers,
  Chroma, UI or network services.
"""
from __future__ import annotations

from decimal import Decimal, InvalidOperation
import json
from pathlib import Path
from typing import Any, Dict, Mapping, Optional, Sequence, Tuple

from rmc_engine_v1.mea.controlled_manifest_memory_writer import controlled_memory_writer_status
from rmc_engine_v1.mea.fixed_point_math_contract import canonical_hash, decimal_text_to_micro
from rmc_engine_v1.mea.live_trace_replay import (
    LIVE_TRACE_REPLAY_APPROVAL_TOKEN,
    evaluate_live_trace_replay_request,
)
from rmc_engine_v1.mea.problem_manifest_store import problem_manifest_store_status

BUILD_ID = "MEA-TO-RMC-RENDER-GATE-ADAPTER-BUILD-008"
SCHEMA_VERSION = "mea_to_rmc_render_gate_adapter_v1_build008"
ADAPTER_PACKET_SCHEMA_VERSION = "mea_render_admission_packet_v1_build008"

SOURCE_KIND = "persisted_sealed_mea_manifest_memory_record"
PERMITTED_FUTURE_OUTPUT_MODE = "qualified_hypothesis_explanation"
EXPECTED_PROBLEM_ID = "144hz_substrate_status"
EXPECTED_CANDIDATE_ID = "cg_hypothesis_001"
EXPECTED_CLAIM_STATUS = "hypothesis"
EXPECTED_REQUIRED_NEXT_ACTION = "test_required"
EXPECTED_PROOF_DEBT_TEXT = "0.85"
EXPECTED_PROOF_DEBT_MICRO = 850_000
EXPECTED_MEMORY_TIER = "hypothesis_test_required_record"
EXPECTED_RECORD_HASH = "c7961e88d1ae7c718662b4d8541c18948c63c3d2b374c9e95b7ee9338338fc99"

BLOCKED_SOURCE_KINDS = {
    "draft": "draft_source_not_render_admissible",
    "unverified_candidate": "unverified_candidate_not_render_admissible",
    "rejected_candidate": "rejected_candidate_not_render_admissible",
}
_REQUIRED_REQUEST_FIELDS: Tuple[str, ...] = (
    "source_kind",
    "sealed_manifest_hash",
    "seal_receipt_hash",
    "memory_record_hash",
    "candidate_id",
    "requested_output_mode",
    "requested_claim_status",
    "requested_required_next_action",
    "requested_proof_debt_text",
)


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _sequence(value: Any) -> Sequence[Any]:
    return value if isinstance(value, (list, tuple)) else ()


def _is_sha256(value: Any) -> bool:
    return isinstance(value, str) and len(value) == 64 and all(ch in "0123456789abcdef" for ch in value)


def _proof_debt_text(value: Any) -> str:
    try:
        decimal_value = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return "invalid"
    return format(decimal_value.normalize(), "f")


def default_store_root(forge_root: Path) -> Path:
    return forge_root / "runtime_state" / "mea_problem_manifest_store_v1"


def default_memory_root(forge_root: Path) -> Path:
    return forge_root / "memory" / "mea_manifest_memory_v1"


def mea_render_gate_boundary() -> Dict[str, Any]:
    return {
        "build_id": BUILD_ID,
        "schema_version": SCHEMA_VERSION,
        "layer": "MEA sealed problem manifest to future RMC meaning/rendering admission",
        "schema_separation_rule": "MEA_problem_manifest_and_RMC_meaning_manifest_must_not_be_merged",
        "input_contract": "Build005_persisted_sealed_MEA_hypothesis_record_plus_seal_and_replay_bindings",
        "output_contract": "typed_render_admission_packet_or_rejection_no_render",
        "read_only": True,
        "historic_record_only_in_this_build": True,
        "historical_render_admission_is_not_new_seal_execution": True,
        "forward_seal_eligibility_required_for_historical_record": False,
        "requires_sealed_manifest_hash": True,
        "requires_seal_receipt_hash": True,
        "requires_persisted_memory_record_hash": True,
        "requires_replay_verification": True,
        "requires_claim_status_preservation": True,
        "requires_proof_debt_preservation": True,
        "requires_uncertainty_preservation": True,
        "requires_next_action_preservation": True,
        "permits_only_qualified_hypothesis_explanation": True,
        "rejects_drafts": True,
        "rejects_unverified_candidates": True,
        "rejects_rejected_candidates": True,
        "rejects_hypothesis_as_verified_claim": True,
        "rejects_hypothesis_as_empirical_fact": True,
        "rejects_recall_as_discovery": True,
        "rejects_invented_evidence": True,
        "creates_http_routes": False,
        "modifies_ui": False,
        "compiles_rmc_meaning_manifest": False,
        "invokes_rmc_renderer": False,
        "invokes_echo_validator": False,
        "renders_user_output": False,
        "approves_user_output": False,
        "writes_files": False,
        "writes_mea_memory": False,
        "writes_mea_runtime_state": False,
        "writes_rmc_output_memory": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "mints_ct": False,
        "writes_ledgers": False,
        "writes_chroma": False,
        "calls_llm": False,
        "executes_shell": False,
        "performs_network_io": False,
    }


def _base_response() -> Dict[str, Any]:
    return {
        "build_id": BUILD_ID,
        "schema_version": SCHEMA_VERSION,
        "boundary": mea_render_gate_boundary(),
        "render_performed": False,
        "rmc_meaning_manifest_compiled": False,
        "echo_validation_performed": False,
        "output_approved": False,
        "write_performed": False,
        "writes_mea_memory": False,
        "writes_rmc_output_memory": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "mints_ct": False,
        "writes_chroma": False,
    }


def _reject(reason_code: str, errors: Sequence[str]) -> Dict[str, Any]:
    payload = _base_response()
    payload.update({
        "status": "REJECTED",
        "accepted": False,
        "gate_status": "MEA_TO_RMC_RENDER_ADMISSION_REJECTED_NO_RENDER",
        "reason_code": reason_code,
        "errors": list(errors),
        "render_admission_packet": None,
    })
    return payload


def _load_json_object(path: Path) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    if not path.is_file() or path.is_symlink():
        return None, f"file_missing_or_symlinked:{path.name}"
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return None, f"json_parse_failed:{path.name}:{str(exc)[:120]}"
    if not isinstance(payload, dict):
        return None, f"json_object_required:{path.name}"
    return payload, None


def _load_verified_memory_record(memory_root: Path) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]], list[str]]:
    """Read the Build 005 memory record only after its existing ledger verifier passes."""
    errors: list[str] = []
    status = controlled_memory_writer_status(memory_root=memory_root)
    if status.get("status") != "OK" or _mapping(status.get("ledger_verification")).get("valid") is not True:
        errors.append("build005_memory_ledger_integrity_failed")
        return None, None, errors
    if status.get("record_count") != 1:
        errors.append("exactly_one_historical_memory_record_required")
        return None, None, errors

    ledger = memory_root / "hypothesis_test_required_records.jsonl"
    if not ledger.is_file() or ledger.is_symlink():
        errors.append("historical_memory_ledger_missing_or_symlinked")
        return None, None, errors
    try:
        rows = [json.loads(line) for line in ledger.read_text(encoding="utf-8").splitlines() if line.strip()]
    except Exception as exc:
        errors.append(f"historical_memory_ledger_parse_failed:{str(exc)[:120]}")
        return None, None, errors
    if len(rows) != 1 or not isinstance(rows[0], dict):
        errors.append("historical_memory_ledger_entry_count_invalid")
        return None, None, errors
    entry = rows[0]
    record = dict(_mapping(entry.get("memory_record")))
    if record.get("memory_record_hash") != status.get("latest_record_hash"):
        errors.append("historical_memory_record_status_hash_mismatch")
        return None, None, errors

    receipts_dir = memory_root / "receipts"
    receipts = sorted(receipts_dir.glob("*_memory_write_receipt.json")) if receipts_dir.is_dir() else []
    matching_receipt: Optional[Dict[str, Any]] = None
    for receipt_path in receipts:
        receipt, error = _load_json_object(receipt_path)
        if error or receipt is None:
            errors.append(error or "memory_receipt_unreadable")
            continue
        body = {key: value for key, value in receipt.items() if key != "receipt_hash"}
        if not _is_sha256(receipt.get("receipt_hash")) or canonical_hash(body) != receipt.get("receipt_hash"):
            errors.append("memory_write_receipt_hash_invalid")
            continue
        if receipt.get("memory_record_hash") == record.get("memory_record_hash"):
            matching_receipt = receipt
    if matching_receipt is None:
        errors.append("verified_memory_write_receipt_not_found")
        return None, None, errors
    if matching_receipt.get("write_readback_verified") is not True:
        errors.append("memory_write_receipt_readback_not_verified")
        return None, None, errors
    return record, matching_receipt, errors


def _verify_historical_source(
    *,
    store_root: Path,
    memory_root: Path,
) -> Tuple[Optional[Dict[str, Any]], list[str]]:
    """Verify committed seal state, persisted memory, and Patch 298 replay without writing."""
    errors: list[str] = []
    state_status = problem_manifest_store_status(store_root=store_root)
    if state_status.get("status") != "OK" or state_status.get("integrity_verified") is not True:
        return None, ["sealed_mea_state_integrity_failed"]
    state = dict(_mapping(state_status.get("stored_state")))
    if not (
        state.get("seal_executed") is True
        and state.get("candidate_committed") is True
        and state.get("live_manifest_advanced") is True
    ):
        return None, ["committed_sealed_historical_state_required"]

    record, memory_receipt, memory_errors = _load_verified_memory_record(memory_root)
    errors.extend(memory_errors)
    if record is None or memory_receipt is None:
        return None, errors or ["verified_historical_memory_record_required"]

    source = _mapping(record.get("source_binding"))
    claim_semantics = _mapping(record.get("claim_semantics"))
    memory_boundary = _mapping(record.get("renderer_permission_boundary"))
    checks = {
        "problem_id_bound": state.get("problem_id") == record.get("problem_id") == EXPECTED_PROBLEM_ID,
        "candidate_id_bound": state.get("candidate_id") == record.get("candidate_id") == EXPECTED_CANDIDATE_ID,
        "candidate_hash_bound": state.get("candidate_hash") == record.get("candidate_hash"),
        "sealed_manifest_hash_bound": state.get("manifest_hash") == source.get("sealed_manifest_hash"),
        "sealed_state_content_hash_bound": state.get("state_content_hash") == source.get("committed_state_content_hash"),
        "seal_receipt_hash_bound": state.get("write_receipt_hash") == source.get("seal_receipt_hash"),
        "record_hash_locked": record.get("memory_record_hash") == EXPECTED_RECORD_HASH,
        "memory_receipt_bound": memory_receipt.get("memory_record_hash") == record.get("memory_record_hash"),
        "claim_status_hypothesis": state.get("claim_status") == record.get("claim_status") == EXPECTED_CLAIM_STATUS,
        "proof_debt_preserved": _proof_debt_text(state.get("proof_debt")) == EXPECTED_PROOF_DEBT_TEXT and _proof_debt_text(record.get("proof_debt")) == EXPECTED_PROOF_DEBT_TEXT,
        "memory_tier_test_required": record.get("memory_tier") == EXPECTED_MEMORY_TIER,
        "hypothesis_only_semantics": claim_semantics.get("hypothesis_only") is True and claim_semantics.get("verified_fact") is False,
        "verified_claim_prohibited": claim_semantics.get("may_render_as_verified_claim") is False,
        "render_was_deferred_to_gate": memory_boundary.get("renderer_output_permitted") is False and memory_boundary.get("rendering_deferred_to_later_rmc_gate") is True,
    }
    failed = [name for name, passed in checks.items() if not passed]
    if failed:
        return None, ["historical_source_binding_failed:" + ",".join(failed)]

    replay_request = {
        "approval_token": LIVE_TRACE_REPLAY_APPROVAL_TOKEN,
        "transaction_id": state.get("transaction_id"),
        "transaction_intent_hash": state.get("transaction_intent_hash"),
        "candidate_id": state.get("candidate_id"),
        "candidate_hash": state.get("candidate_hash"),
        "committed_manifest_hash": state.get("manifest_hash"),
        "committed_state_content_hash": state.get("state_content_hash"),
    }
    replay = evaluate_live_trace_replay_request(replay_request, store_root=store_root)
    if replay.get("gate_status") != "REPLAY_VERIFIED_NO_MUTATION" or replay.get("replay_verified") is not True:
        return None, ["historical_source_replay_verification_failed"]

    return {
        "state": state,
        "record": record,
        "memory_receipt": memory_receipt,
        "replay": replay,
        "verification_checks": checks,
    }, []


def mea_render_gate_status(*, forge_root: Path) -> Dict[str, Any]:
    store_root = default_store_root(forge_root)
    memory_root = default_memory_root(forge_root)
    source, errors = _verify_historical_source(store_root=store_root, memory_root=memory_root)
    payload = _base_response()
    payload.update({
        "status": "OK" if source is not None else "BLOCKED",
        "gate_status": "HISTORICAL_SEALED_SOURCE_AVAILABLE_FOR_RENDER_ADMISSION_CHECK" if source is not None else "HISTORICAL_SEALED_SOURCE_NOT_AVAILABLE",
        "available": source is not None,
        "errors": errors,
        "permitted_future_output_mode": PERMITTED_FUTURE_OUTPUT_MODE if source is not None else None,
    })
    if source is not None:
        record = source["record"]
        payload.update({
            "problem_id": record.get("problem_id"),
            "candidate_id": record.get("candidate_id"),
            "claim_status": record.get("claim_status"),
            "proof_debt_text": _proof_debt_text(record.get("proof_debt")),
            "proof_debt_micro": decimal_text_to_micro(_proof_debt_text(record.get("proof_debt"))),
            "memory_record_hash": record.get("memory_record_hash"),
            "sealed_manifest_hash": _mapping(record.get("source_binding")).get("sealed_manifest_hash"),
            "seal_receipt_hash": _mapping(record.get("source_binding")).get("seal_receipt_hash"),
        })
    return payload


def build_historical_hypothesis_admission_request(*, forge_root: Path) -> Dict[str, Any]:
    status = mea_render_gate_status(forge_root=forge_root)
    if status.get("available") is not True:
        raise ValueError("A verified historical sealed MEA source is required before building an admission request")
    return {
        "source_kind": SOURCE_KIND,
        "sealed_manifest_hash": status["sealed_manifest_hash"],
        "seal_receipt_hash": status["seal_receipt_hash"],
        "memory_record_hash": status["memory_record_hash"],
        "candidate_id": status["candidate_id"],
        "requested_output_mode": PERMITTED_FUTURE_OUTPUT_MODE,
        "requested_claim_status": EXPECTED_CLAIM_STATUS,
        "requested_required_next_action": EXPECTED_REQUIRED_NEXT_ACTION,
        "requested_proof_debt_text": EXPECTED_PROOF_DEBT_TEXT,
        "preserve_uncertainty": True,
        "preserve_proof_debt": True,
        "include_required_next_action": True,
        "present_as_verified_claim": False,
        "present_as_empirical_fact": False,
        "present_as_discovery": False,
        "additional_evidence_claims": [],
        "compile_rmc_meaning_manifest": False,
        "render_user_output": False,
    }


def evaluate_mea_render_admission_request(
    request: Optional[Mapping[str, Any]],
    *,
    forge_root: Path,
) -> Dict[str, Any]:
    """Gate a sealed historical MEA record for a later RMC renderer; never render here."""
    req = dict(request or {}) if isinstance(request, Mapping) else {}
    source_kind = req.get("source_kind")
    if source_kind in BLOCKED_SOURCE_KINDS:
        return _reject(BLOCKED_SOURCE_KINDS[str(source_kind)], [f"{source_kind} may not enter the renderer corridor"])
    if source_kind != SOURCE_KIND:
        return _reject("sealed_persisted_source_required", ["only a persisted sealed MEA memory record may enter this render gate"])

    missing = [field for field in _REQUIRED_REQUEST_FIELDS if req.get(field) in (None, "")]
    invalid_hashes = [field for field in ("sealed_manifest_hash", "seal_receipt_hash", "memory_record_hash") if req.get(field) and not _is_sha256(req.get(field))]
    if missing or invalid_hashes:
        errors = []
        if missing:
            errors.append("missing required fields: " + ", ".join(missing))
        if invalid_hashes:
            errors.append("invalid SHA-256 fields: " + ", ".join(invalid_hashes))
        return _reject("required_render_admission_bindings_invalid", errors)

    # Deny semantic upgrades before constructing any downstream-admissible packet.
    if req.get("requested_claim_status") == "recall" and req.get("present_as_discovery") is True:
        return _reject("recall_as_discovery_blocked", ["recall may not be represented as discovery"])
    if req.get("present_as_verified_claim") is True or req.get("requested_claim_status") == "verified_claim":
        return _reject("hypothesis_as_verified_claim_blocked", ["hypothesis may not be represented as a verified claim"])
    if req.get("present_as_empirical_fact") is True:
        return _reject("hypothesis_as_empirical_fact_blocked", ["hypothesis may not be represented as empirical fact"])
    if req.get("present_as_discovery") is True:
        return _reject("hypothesis_as_discovery_blocked", ["historical hypothesis admission cannot be presented as a discovery"])
    if _sequence(req.get("additional_evidence_claims")):
        return _reject("invented_evidence_claims_blocked", ["render admission cannot introduce additional evidence claims"])

    source, source_errors = _verify_historical_source(
        store_root=default_store_root(forge_root),
        memory_root=default_memory_root(forge_root),
    )
    if source is None:
        return _reject("historical_sealed_source_verification_failed", source_errors)
    record = source["record"]
    binding = _mapping(record.get("source_binding"))

    binding_checks = {
        "sealed_manifest_hash": req.get("sealed_manifest_hash") == binding.get("sealed_manifest_hash"),
        "seal_receipt_hash": req.get("seal_receipt_hash") == binding.get("seal_receipt_hash"),
        "memory_record_hash": req.get("memory_record_hash") == record.get("memory_record_hash"),
        "candidate_id": req.get("candidate_id") == record.get("candidate_id"),
    }
    failed_bindings = [name for name, passed in binding_checks.items() if not passed]
    if failed_bindings:
        return _reject("render_source_hash_binding_mismatch", failed_bindings)

    semantic_checks = {
        "qualified_output_mode_only": req.get("requested_output_mode") == PERMITTED_FUTURE_OUTPUT_MODE,
        "claim_status_preserved": req.get("requested_claim_status") == EXPECTED_CLAIM_STATUS,
        "required_next_action_preserved": req.get("requested_required_next_action") == EXPECTED_REQUIRED_NEXT_ACTION,
        "proof_debt_preserved": req.get("preserve_proof_debt") is True and _proof_debt_text(req.get("requested_proof_debt_text")) == EXPECTED_PROOF_DEBT_TEXT,
        "uncertainty_preserved": req.get("preserve_uncertainty") is True,
        "next_action_included": req.get("include_required_next_action") is True,
        "does_not_compile_rmc_manifest_here": req.get("compile_rmc_meaning_manifest") is False,
        "does_not_render_here": req.get("render_user_output") is False,
    }
    failed_semantics = [name for name, passed in semantic_checks.items() if not passed]
    if failed_semantics:
        return _reject("render_admission_semantics_violation", failed_semantics)

    packet_body = {
        "schema_version": ADAPTER_PACKET_SCHEMA_VERSION,
        "build_id": BUILD_ID,
        "packet_type": "mea_to_rmc_render_admission_packet",
        "source_schema": "mea_manifest_memory_record_v1_build005",
        "downstream_target_schema": "RMC_meaning_manifest_input_not_yet_compiled",
        "schemas_merged": False,
        "source_binding": {
            "problem_id": record.get("problem_id"),
            "candidate_id": record.get("candidate_id"),
            "memory_record_hash": record.get("memory_record_hash"),
            "sealed_manifest_hash": binding.get("sealed_manifest_hash"),
            "seal_receipt_hash": binding.get("seal_receipt_hash"),
            "committed_state_content_hash": binding.get("committed_state_content_hash"),
            "transaction_id": binding.get("transaction_id"),
        },
        "historical_seal_and_replay_proof": {
            "already_sealed_historical_record": True,
            "new_seal_requested": False,
            "replay_verified": source["replay"].get("replay_verified") is True,
            "stored_seal_executed": source["replay"].get("stored_seal_executed") is True,
            "stored_candidate_committed": source["replay"].get("stored_candidate_committed") is True,
            "stored_live_manifest_advanced": source["replay"].get("stored_live_manifest_advanced") is True,
        },
        "epistemic_boundary": {
            "claim_status": EXPECTED_CLAIM_STATUS,
            "required_next_action": EXPECTED_REQUIRED_NEXT_ACTION,
            "proof_debt_text": EXPECTED_PROOF_DEBT_TEXT,
            "proof_debt_micro": EXPECTED_PROOF_DEBT_MICRO,
            "hypothesis_only": True,
            "verified_fact": False,
            "may_render_as_verified_claim": False,
            "may_render_as_empirical_fact": False,
            "may_render_as_discovery": False,
            "uncertainty_must_be_preserved": True,
            "proof_debt_must_be_preserved": True,
        },
        "permitted_future_render_scope": {
            "permitted_future_output_mode": PERMITTED_FUTURE_OUTPUT_MODE,
            "permitted_meaning": "bounded test-required hypothesis explanation only",
            "semantic_lexicon_not_yet_invoked": True,
            "surface_realizer_not_yet_invoked": True,
            "rendered_text_not_generated": True,
            "echo_validation_required_after_future_rendering": True,
        },
        "forbidden_future_render_claims": (
            "verified_claim",
            "empirical_fact",
            "discovery",
            "proof_debt_reduction",
            "uncertainty_omission",
            "invented_evidence",
        ),
    }
    packet = {**packet_body, "admission_packet_hash": canonical_hash(packet_body)}
    payload = _base_response()
    payload.update({
        "status": "OK",
        "accepted": True,
        "gate_status": "MEA_TO_RMC_RENDER_ADMITTED_QUALIFIED_HYPOTHESIS_ONLY_NO_RENDER",
        "source_verified": True,
        "seal_and_replay_verified": True,
        "claim_status": EXPECTED_CLAIM_STATUS,
        "required_next_action": EXPECTED_REQUIRED_NEXT_ACTION,
        "proof_debt_text": EXPECTED_PROOF_DEBT_TEXT,
        "permitted_future_output_mode": PERMITTED_FUTURE_OUTPUT_MODE,
        "render_admission_packet": packet,
    })
    return payload


__all__ = [
    "BUILD_ID",
    "SCHEMA_VERSION",
    "ADAPTER_PACKET_SCHEMA_VERSION",
    "SOURCE_KIND",
    "PERMITTED_FUTURE_OUTPUT_MODE",
    "mea_render_gate_boundary",
    "mea_render_gate_status",
    "build_historical_hypothesis_admission_request",
    "evaluate_mea_render_admission_request",
]
