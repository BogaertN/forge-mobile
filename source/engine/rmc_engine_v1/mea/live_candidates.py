"""
forge/rmc_engine_v1/mea/live_candidates.py

Patch 295 — MEA Controlled Live Candidate API.

This is the first downstream MEA surface that consumes the persisted, integrity-
verified problem manifest written by Patch 294. It exposes GET /api/mea/candidates
as a read-only candidate-set view. Candidates are produced by the actual
operator_engine -> candidate_generator -> coherence_extension -> gate_engine
chain against the stored manifest M_t.

Critical boundary:
- This route reads verified Forge-owned MEA runtime state only.
- It refuses to generate candidates when the stored state is missing or fails
  integrity verification.
- It does not commit a candidate, advance M_t, execute a seal, write memory,
  write Chroma, touch Identity Vault, call an LLM, run shell, or render output.
- Scores rank previews only. Gates remain authoritative.

Provenance rule:
Patch 294 stored the canonical manifest source in state_core.source, but did not
persist the caller-supplied request/invocation source as a separate field.
Patch 295 therefore reports the stored canonical source and explicitly declines
to infer an invocation label that is not present in persisted state.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple

from .candidate_generator import generate_candidate_from_draft
from .coherence_extension import score_generated_candidate
from .gate_engine import evaluate_candidate_gate
from .manifest_schema import ClaimStatus, ProblemManifest, canonical_hash, from_dict, validate_manifest
from .problem_manifest_store import problem_manifest_store_status

LIVE_CANDIDATES_PATCH_ID = "Patch 295 — MEA Controlled Live Candidate API"
LIVE_CANDIDATES_SCHEMA_VERSION = "mea_live_candidates_v1_patch295"
LIVE_CANDIDATES_MODE = "controlled_mea_live_candidates_read_only_patch295"
LIVE_CANDIDATES_GET_ROUTE = "/api/mea/candidates"
LIVE_CANDIDATES_FORMULA = (
    "C_live(M_t)=Gate(Score(O_verify∘O_gen(M_t))); "
    "Integrity(M_t)=true; commit=false; advance=false; seal=false; memory=false"
)

# Patch 295 owns the controlled read-only enquiry programme. Each requested
# generative operation is still executed by operator_engine.py and verified by
# candidate_generator.py; this list defines which candidate previews the live
# GET endpoint is allowed to request from a verified persisted M_t.
_LIVE_CANDIDATE_PROGRAM: Tuple[Dict[str, Any], ...] = (
    {
        "candidate_id": "cg_recall_001",
        "operator_id": "noop_recall",
        "theta_k": {},
        "authorization": "system_reference_baseline",
        "label": "noop_recall — persisted-state reference baseline; not discovery",
    },
    {
        "candidate_id": "cg_hypothesis_001",
        "operator_id": "hypothesize",
        "theta_k": {
            "hypothesis_id": "harmonic_from_90hz",
            "hypothesis_text": (
                "144 Hz is a derived harmonic of the 90 Hz binding frequency "
                "via approximate golden-ratio scaling (90 * 1.6 ≈ 144)."
            ),
            "confidence": 0.35,
        },
        "authorization": "requires_manifest_allowed_tool",
        "label": "hypothesize — persisted-state harmonic path; hypothesis only",
    },
    {
        "candidate_id": "cg_branch_001",
        "operator_id": "branch",
        "theta_k": {
            "branch_label": "empirical_measurement_path",
            "branch_goal": "Find published myelin-specific measurement of 144 Hz.",
            "branch_unknown": "Direct empirical measurement of 144 Hz in myelin.",
        },
        "authorization": "requires_manifest_allowed_tool",
        "label": "branch — persisted-state empirical measurement investigation",
    },
    {
        "candidate_id": "cg_tamper_001",
        "operator_id": "noop_recall",
        "theta_k": {},
        "authorization": "system_internal_negative_control",
        "label": "tamper probe — persisted-state replay mismatch must reject",
        "inject_bad_expected_hash": True,
    },
)


def _stable_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _stable_hash(value: Any) -> str:
    return hashlib.sha256(_stable_json(value).encode("utf-8")).hexdigest()


def _is_sha256(value: object) -> bool:
    return isinstance(value, str) and len(value) == 64 and all(ch in "0123456789abcdef" for ch in value)


def live_candidates_boundary() -> Dict[str, Any]:
    return {
        "patch": LIVE_CANDIDATES_PATCH_ID,
        "schema_version": LIVE_CANDIDATES_SCHEMA_VERSION,
        "layer": "MEA controlled live candidates / verified persisted-state read-only view",
        "read_only": True,
        "non_mutating": True,
        "creates_get_routes": True,
        "creates_post_routes": False,
        "get_routes": [LIVE_CANDIDATES_GET_ROUTE],
        "post_routes": [],
        "reads_files": True,
        "reads_mea_runtime_state": True,
        "requires_persisted_state_integrity": True,
        "generates_candidates_from_persisted_manifest": True,
        "scores_candidates": True,
        "gates_candidates": True,
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
        "score_can_rank": True,
        "score_can_override_gates": False,
        "seal_route_available": False,
        "memory_promotion_route_available": False,
        "next_wiring_patch": "Patch 297 — Controlled Atomic Seal / Manifest Advance Commit after Patch 296R source-binding proof",
    }


def _base_response(endpoint: str) -> Dict[str, Any]:
    return {
        "endpoint": endpoint,
        "mode": LIVE_CANDIDATES_MODE,
        "current_patch": LIVE_CANDIDATES_PATCH_ID,
        "schema_version": LIVE_CANDIDATES_SCHEMA_VERSION,
        "formula": LIVE_CANDIDATES_FORMULA,
        "preview_type": "live_persisted_manifest_candidate_set_read_only",
        "live_candidates_visible": True,
        "reads_persisted_mea_state": True,
        "writes_files": False,
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
        "score_can_rank": True,
        "score_can_override_gates": False,
        "boundary": live_candidates_boundary(),
    }


def _blocked_source_payload(reason_code: str, source_status: Mapping[str, Any], endpoint: str) -> Dict[str, Any]:
    payload = _base_response(endpoint)
    payload.update({
        "status": "SOURCE_STATE_BLOCKED",
        "accepted": False,
        "reason_code": reason_code,
        "candidate_count": 0,
        "generated_candidate_count": 0,
        "candidates": [],
        "source_state_status": source_status.get("status"),
        "source_state_initialized": bool(source_status.get("initialized", False)),
        "source_state_integrity_verified": bool(source_status.get("integrity_verified", False)),
        "source_state_integrity_errors": list(source_status.get("integrity_errors") or []),
        "source_manifest_hash": source_status.get("manifest_hash"),
        "source_state_content_hash": source_status.get("state_content_hash"),
        "candidate_generation_executed": False,
        "selection_executed": False,
    })
    return payload


def _read_verified_parent(store_root: Optional[Path], endpoint: str) -> Tuple[Optional[ProblemManifest], Dict[str, Any], Optional[Dict[str, Any]]]:
    status = problem_manifest_store_status(store_root=store_root, endpoint=endpoint)
    if status.get("status") == "UNINITIALIZED" or status.get("initialized") is not True:
        return None, status, _blocked_source_payload("persisted_manifest_uninitialized", status, endpoint)
    if status.get("status") != "OK" or status.get("integrity_verified") is not True:
        return None, status, _blocked_source_payload("persisted_manifest_integrity_failed", status, endpoint)
    state = status.get("stored_state") if isinstance(status.get("stored_state"), Mapping) else {}
    state_core = state.get("state_core") if isinstance(state.get("state_core"), Mapping) else {}
    manifest_payload = state_core.get("canonical_manifest")
    if not isinstance(manifest_payload, Mapping):
        return None, status, _blocked_source_payload("persisted_manifest_payload_missing", status, endpoint)
    try:
        parent = from_dict(dict(manifest_payload))
        validation = validate_manifest(parent)
    except Exception as exc:
        failed = dict(status)
        failed["integrity_errors"] = [f"manifest parse failed: {str(exc)[:180]}"]
        return None, failed, _blocked_source_payload("persisted_manifest_parse_failed", failed, endpoint)
    if not validation.valid:
        failed = dict(status)
        failed["integrity_errors"] = list(validation.errors)
        return None, failed, _blocked_source_payload("persisted_manifest_validation_failed", failed, endpoint)
    if canonical_hash(parent) != status.get("manifest_hash"):
        failed = dict(status)
        failed["integrity_errors"] = ["canonical persisted manifest hash does not match verified stored manifest_hash"]
        return None, failed, _blocked_source_payload("persisted_manifest_hash_mismatch", failed, endpoint)
    return parent, status, None


def _authorized_program(parent: ProblemManifest) -> Tuple[Tuple[Dict[str, Any], ...], Tuple[Dict[str, Any], ...]]:
    allowed = {str(value) for value in parent.allowed_tools}
    executable: List[Dict[str, Any]] = []
    excluded: List[Dict[str, Any]] = []
    for spec in _LIVE_CANDIDATE_PROGRAM:
        operator_id = str(spec["operator_id"])
        authorization = str(spec["authorization"])
        if authorization == "requires_manifest_allowed_tool" and operator_id not in allowed:
            excluded.append({
                "candidate_id": spec["candidate_id"],
                "operator_id": operator_id,
                "reason_code": "operator_not_allowed_by_persisted_manifest",
            })
            continue
        executable.append(dict(spec))
    return tuple(executable), tuple(excluded)


def _build_candidate_rows(parent: ProblemManifest, source_status: Mapping[str, Any]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    parent_hash = canonical_hash(parent)
    state_content_hash = str(source_status.get("state_content_hash") or "")
    programme, excluded = _authorized_program(parent)
    rows: List[Dict[str, Any]] = []
    for spec in programme:
        generated = generate_candidate_from_draft(
            parent,
            str(spec["candidate_id"]),
            str(spec["operator_id"]),
            spec.get("theta_k", {}),
            inject_bad_expected_hash=bool(spec.get("inject_bad_expected_hash", False)),
        ).to_dict()
        coherence = score_generated_candidate(generated, parent_hash).to_dict()
        gate_report = evaluate_candidate_gate(
            generated,
            context={"source_manifest_hash": parent_hash, "source_state_content_hash": state_content_hash},
        ).to_dict()
        if generated.get("claim_status") != coherence.get("claim_status") or generated.get("claim_status") != gate_report.get("claim_status"):
            raise RuntimeError(f"claim-status disagreement in persisted candidate pipeline: {generated.get('candidate_id')}")
        generated.update({
            "preview_label": str(spec.get("label", spec["operator_id"])),
            "operator_authorization": str(spec["authorization"]),
            "persisted_state_consumed": True,
            "source_manifest_hash": parent_hash,
            "source_state_content_hash": state_content_hash,
            "coherence_extension_score": coherence,
            "gate_report": gate_report,
            "gate_decision": gate_report.get("decision"),
            "gate_report_hash": gate_report.get("gate_report_hash"),
            "score_hash": coherence.get("score_hash"),
            "effective_rank_score": coherence.get("effective_rank_score"),
            "rank_eligible": coherence.get("rank_eligible"),
            "candidate_commit_permitted": False,
            "manifest_advance_permitted": False,
            "seal_execution_permitted": False,
            "memory_write_permitted": False,
        })
        rows.append(generated)
    return rows, list(excluded)


def _candidate_set_binding(source_status: Mapping[str, Any], rows: Sequence[Mapping[str, Any]]) -> Dict[str, Any]:
    return {
        "source_manifest_hash": source_status.get("manifest_hash"),
        "source_state_content_hash": source_status.get("state_content_hash"),
        "candidate_bindings": [
            {
                "candidate_id": row.get("candidate_id"),
                "candidate_hash": row.get("candidate_hash"),
                "claim_status": row.get("claim_status"),
                "score_hash": row.get("score_hash"),
                "gate_report_hash": row.get("gate_report_hash"),
                "gate_decision": row.get("gate_decision"),
            }
            for row in rows
        ],
        "schema_version": LIVE_CANDIDATES_SCHEMA_VERSION,
    }


def build_live_candidates_payload(*, store_root: Optional[Path] = None, endpoint: str = LIVE_CANDIDATES_GET_ROUTE) -> Dict[str, Any]:
    """Read the verified persisted M_t and return generated, scored, gated previews only."""
    parent, source_status, blocked = _read_verified_parent(store_root, endpoint)
    if blocked is not None or parent is None:
        return blocked or _blocked_source_payload("persisted_manifest_unavailable", source_status, endpoint)
    try:
        rows, excluded = _build_candidate_rows(parent, source_status)
        repeated_rows, _ = _build_candidate_rows(parent, source_status)
    except Exception as exc:
        payload = _blocked_source_payload("candidate_pipeline_integrity_failed", source_status, endpoint)
        payload["pipeline_error"] = str(exc)[:240]
        return payload
    binding = _candidate_set_binding(source_status, rows)
    repeat_binding = _candidate_set_binding(source_status, repeated_rows)
    candidate_set_hash = _stable_hash(binding)
    ranked = sorted(
        [row for row in rows if row.get("rank_eligible") is True and row.get("gate_report", {}).get("selectable_preview") is True],
        key=lambda row: (float(row.get("effective_rank_score") or 0.0), str(row.get("candidate_id"))),
        reverse=True,
    )
    state = source_status.get("stored_state") if isinstance(source_status.get("stored_state"), Mapping) else {}
    state_core = state.get("state_core") if isinstance(state.get("state_core"), Mapping) else {}
    source = state_core.get("source")
    payload = _base_response(endpoint)
    payload.update({
        "status": "OK",
        "accepted": True,
        "problem_id": parent.problem_id,
        "source_state_status": source_status.get("status"),
        "source_state_initialized": True,
        "source_state_integrity_verified": True,
        "source_state_integrity_errors": [],
        "source_transaction_id": source_status.get("transaction_id"),
        "source_manifest_hash": source_status.get("manifest_hash"),
        "source_state_content_hash": source_status.get("state_content_hash"),
        "source_manifest_hash_matches_generated_parent": all(row.get("parent_hash") == source_status.get("manifest_hash") for row in rows),
        "candidate_generation_source": "verified_persisted_problem_manifest_patch294",
        "candidate_generation_executed": True,
        "drafts_generated_by_operator_engine": True,
        "verification_operators_applied": True,
        "coherence_extension_applied": True,
        "gate_engine_applied": True,
        "candidate_count": len(rows),
        "generated_candidate_count": len(rows),
        "excluded_operator_request_count": len(excluded),
        "excluded_operator_requests": excluded,
        "failed_verification_count": sum(1 for row in rows if row.get("verification_passed") is not True),
        "containment_preview_count": sum(1 for row in rows if row.get("containment_preview") is True),
        "reference_only_count": sum(1 for row in rows if row.get("reference_only") is True),
        "selectable_preview_count": sum(1 for row in rows if row.get("gate_report", {}).get("selectable_preview") is True),
        "rejected_count": sum(1 for row in rows if row.get("claim_status") == ClaimStatus.REJECTED.value),
        "candidate_set_hash": candidate_set_hash,
        "candidate_set_hash_stability_proven": candidate_set_hash == _stable_hash(repeat_binding),
        "candidate_hashes_stable": [row.get("candidate_hash") for row in rows] == [row.get("candidate_hash") for row in repeated_rows],
        "ranking_executed_for_preview_only": True,
        "highest_ranked_candidate_id": ranked[0].get("candidate_id") if ranked else None,
        "highest_ranked_claim_status": ranked[0].get("claim_status") if ranked else None,
        "highest_ranked_effective_score": ranked[0].get("effective_rank_score") if ranked else None,
        "selection_executed": False,
        "selected_candidate_id": None,
        "candidate_commit_permitted": False,
        "manifest_advance_permitted": False,
        "seal_execution_permitted": False,
        "memory_write_permitted": False,
        "persisted_state_provenance": {
            "stored_transaction_id": source_status.get("transaction_id"),
            "canonical_manifest_source": source,
            "requested_invocation_source_persisted": False,
            "requested_invocation_source": None,
            "provenance_limitation": (
                "Patch 294 did not persist the caller-supplied request source label as a separate field; "
                "Patch 295 reports the stored canonical source only and does not infer missing provenance."
            ),
        },
        "output_permission_interpretation": source_status.get("output_permission_interpretation"),
        "candidates": rows,
    })
    return payload


# Patch 298 — public replay helper. This rebuilds the Patch 295 candidate programme
# from a detached, previously verified source-state record embedded in a commit
# rollback artifact. It performs computation only and never reads or writes files.
def rebuild_live_candidates_from_state_record(
    source_record: Mapping[str, Any],
    *,
    endpoint: str = LIVE_CANDIDATES_GET_ROUTE,
) -> Dict[str, Any]:
    """Rebuild deterministic candidate rows from a source MEA state record.

    This helper exists for Patch 298 live trace replay: after M_t has advanced,
    replay must reconstruct candidates from the stored rollback source record,
    not accidentally generate a new branch from the already advanced M_(t+1).
    """
    record = dict(source_record or {}) if isinstance(source_record, Mapping) else {}
    state_core = record.get("state_core") if isinstance(record.get("state_core"), Mapping) else {}
    manifest_payload = state_core.get("canonical_manifest")
    if not isinstance(manifest_payload, Mapping):
        return _blocked_source_payload("detached_source_manifest_missing", record, endpoint)
    try:
        parent = from_dict(dict(manifest_payload))
        validation = validate_manifest(parent)
    except Exception as exc:
        failed = dict(record)
        failed["integrity_errors"] = [f"detached source parse failed: {str(exc)[:180]}"]
        return _blocked_source_payload("detached_source_manifest_parse_failed", failed, endpoint)
    if not validation.valid:
        failed = dict(record)
        failed["integrity_errors"] = list(validation.errors)
        return _blocked_source_payload("detached_source_manifest_validation_failed", failed, endpoint)
    if canonical_hash(parent) != record.get("manifest_hash"):
        failed = dict(record)
        failed["integrity_errors"] = ["detached source canonical manifest does not match source manifest_hash"]
        return _blocked_source_payload("detached_source_manifest_hash_mismatch", failed, endpoint)
    try:
        rows, excluded = _build_candidate_rows(parent, record)
        repeated_rows, _ = _build_candidate_rows(parent, record)
    except Exception as exc:
        payload = _blocked_source_payload("detached_source_candidate_pipeline_integrity_failed", record, endpoint)
        payload["pipeline_error"] = str(exc)[:240]
        return payload
    binding = _candidate_set_binding(record, rows)
    repeat_binding = _candidate_set_binding(record, repeated_rows)
    ranked = sorted(
        [row for row in rows if row.get("rank_eligible") is True and row.get("gate_report", {}).get("selectable_preview") is True],
        key=lambda row: (float(row.get("effective_rank_score") or 0.0), str(row.get("candidate_id"))),
        reverse=True,
    )
    payload = _base_response(endpoint)
    payload.update({
        "status": "OK",
        "accepted": True,
        "replay_rebuilt_from_detached_source_state": True,
        "problem_id": parent.problem_id,
        "source_state_status": "DETACHED_VERIFIED_SOURCE_RECORD",
        "source_state_initialized": True,
        "source_state_integrity_verified": True,
        "source_state_integrity_errors": [],
        "source_transaction_id": record.get("transaction_id"),
        "source_manifest_hash": record.get("manifest_hash"),
        "source_state_content_hash": record.get("state_content_hash"),
        "source_manifest_hash_matches_generated_parent": all(row.get("parent_hash") == record.get("manifest_hash") for row in rows),
        "candidate_generation_source": "replay_detached_restore_state_record_patch298",
        "candidate_generation_executed": True,
        "drafts_generated_by_operator_engine": True,
        "verification_operators_applied": True,
        "coherence_extension_applied": True,
        "gate_engine_applied": True,
        "candidate_count": len(rows),
        "generated_candidate_count": len(rows),
        "excluded_operator_request_count": len(excluded),
        "excluded_operator_requests": excluded,
        "candidate_set_hash": _stable_hash(binding),
        "candidate_set_hash_stability_proven": _stable_hash(binding) == _stable_hash(repeat_binding),
        "candidate_hashes_stable": [row.get("candidate_hash") for row in rows] == [row.get("candidate_hash") for row in repeated_rows],
        "ranking_executed_for_replay_verification_only": True,
        "highest_ranked_candidate_id": ranked[0].get("candidate_id") if ranked else None,
        "highest_ranked_claim_status": ranked[0].get("claim_status") if ranked else None,
        "selection_executed": False,
        "selected_candidate_id": None,
        "candidate_commit_permitted": False,
        "manifest_advance_permitted": False,
        "seal_execution_permitted": False,
        "memory_write_permitted": False,
        "output_permission_interpretation": record.get("output_permission_interpretation"),
        "candidates": rows,
    })
    return payload
