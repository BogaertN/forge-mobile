"""
forge/rmc_engine_v1/mea/seal_readiness.py

Patch 284R — MEA Seal Readiness Route Dispatch Hotfix.

This module converts the Patch 283R hard-gate report into a deterministic,
non-mutating seal-readiness report. It is not a seal engine. It does not
create /api/mea/seal, persist live MEA state, write files, write memory,
write Chroma, touch Identity Vault, call an LLM, execute shell commands,
perform network I/O, promote memory, or render user output.

Purpose:
- identify which candidates would be eligible for a future seal engine;
- prove why reference-only and rejected candidates are not sealable;
- preserve claim-status render laws before sealing exists;
- expose explicit future seal payload previews without committing them.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import json
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple

from .manifest_schema import ClaimStatus, canonical_dict
from .hard_gate_report import (
    HARD_GATE_REPORT_APPROVAL_TOKEN,
    build_hard_gate_report_preview,
    evaluate_hard_gate_report_request,
)

SEAL_READINESS_PATCH_ID = "Patch 284R — MEA Seal Readiness Route Dispatch Hotfix"
SEAL_READINESS_SCHEMA_VERSION = "mea_seal_readiness_preview_v1_patch284"
SEAL_READINESS_MODE = "controlled_mea_seal_readiness_preview_patch284"
SEAL_READINESS_APPROVAL_TOKEN = "APPROVE_MEA_SEAL_READINESS_REPORT"
SEAL_READINESS_STATUS_ROUTE = "/api/mea/seal-readiness/status"
SEAL_READINESS_PREVIEW_ROUTE = "/api/mea/seal-readiness-preview"
SEAL_READINESS_POST_ROUTE = "/api/mea/seal-readiness-gate"
SEAL_READINESS_ALIAS_ROUTE = "/api/mea/seal-preview-gate"

SEAL_READINESS_FORMULA = (
    "SealReady(c_i)=HardGatePass∧SelectablePreview∧ReplayConfirmed∧¬Tamper∧"
    "ClaimStatusSealAllowed∧SealRouteUnavailable∧MemoryPromotionBlocked"
)
SEAL_ALLOWED_CLAIM_STATUSES = {
    ClaimStatus.HYPOTHESIS.value,
    ClaimStatus.SPECULATIVE_BRANCH.value,
    ClaimStatus.TEST_REQUIRED.value,
    ClaimStatus.PARTIAL_RESOLUTION.value,
    ClaimStatus.DERIVED_CLAIM.value,
    ClaimStatus.CONTRADICTION_EXPOSED.value,
    ClaimStatus.COLD_STORED.value,
    ClaimStatus.NAMED_CONCEPT.value,
    ClaimStatus.RESOLVED_MANIFEST.value,
}


def _stable_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def _sha256(value: Any) -> str:
    return hashlib.sha256(_stable_json(value).encode("utf-8")).hexdigest()


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _bool(value: Any) -> bool:
    return bool(value)


@dataclass(frozen=True)
class SealReadinessCandidate:
    candidate_id: str
    candidate_hash: Optional[str]
    parent_hash: Optional[str]
    claim_status: str
    readiness_decision: str
    would_be_seal_ready: bool
    seal_execution_permitted: bool
    future_seal_payload_hash: Optional[str]
    seal_blocked_reason: str
    readiness_checks: Tuple[Dict[str, Any], ...]
    future_seal_payload_preview: Optional[Dict[str, Any]]
    hard_gate_decision: str
    reference_only: bool
    rejected: bool
    candidate_sealing_active: bool = False
    memory_promotion_active: bool = False
    seal_route_available: bool = False
    memory_promotion_route_available: bool = False
    patch_id: str = SEAL_READINESS_PATCH_ID
    schema_version: str = SEAL_READINESS_SCHEMA_VERSION

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _check(name: str, passed: bool, observed: Any, threshold: Any, detail: str) -> Dict[str, Any]:
    return {
        "check_name": name,
        "passed": bool(passed),
        "severity": "hard",
        "observed": observed,
        "threshold": threshold,
        "detail": detail,
    }


def seal_readiness_boundary() -> Dict[str, Any]:
    return {
        "patch": SEAL_READINESS_PATCH_ID,
        "schema_version": SEAL_READINESS_SCHEMA_VERSION,
        "layer": "MEA seal readiness preview / seal readiness report",
        "read_only": False,
        "non_mutating": True,
        "creates_get_routes": True,
        "creates_post_routes": True,
        "get_routes": [SEAL_READINESS_STATUS_ROUTE, SEAL_READINESS_PREVIEW_ROUTE],
        "post_routes": [SEAL_READINESS_POST_ROUTE, SEAL_READINESS_ALIAS_ROUTE],
        "requires_approval_token": True,
        "approval_token": SEAL_READINESS_APPROVAL_TOKEN,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "performs_network_io": False,
        "seeds_live_manifests": False,
        "commits_live_candidates": False,
        "seals_candidates": False,
        "promotes_to_memory": False,
        "renders_user_output": False,
        "mutates_existing_rmc_behavior": False,
        "mutates_launcher_behavior": False,
        "mutates_operator_console_ui": False,
        "seal_route_available": False,
        "memory_promotion_route_available": False,
        "real_seal_route": "/api/mea/seal remains intentionally unavailable in Patch 284",
        "real_memory_promotion_route": "not available in Patch 284",
    }


def seal_readiness_status() -> Dict[str, Any]:
    return {
        "status": "OK",
        "endpoint": SEAL_READINESS_STATUS_ROUTE,
        "mode": SEAL_READINESS_MODE,
        "current_patch": SEAL_READINESS_PATCH_ID,
        "schema_version": SEAL_READINESS_SCHEMA_VERSION,
        "gate_visible": True,
        "preview_route": SEAL_READINESS_PREVIEW_ROUTE,
        "post_route": SEAL_READINESS_POST_ROUTE,
        "alias_route": SEAL_READINESS_ALIAS_ROUTE,
        "approval_required": True,
        "approval_token": SEAL_READINESS_APPROVAL_TOKEN,
        "hard_gate_token_required": HARD_GATE_REPORT_APPROVAL_TOKEN,
        "live_candidate_commit_active": False,
        "candidate_sealing_active": False,
        "memory_promotion_active": False,
        "seal_route_available": False,
        "memory_promotion_route_available": False,
        "seal_readiness_formula": SEAL_READINESS_FORMULA,
        "future_seal_fields": [
            "candidate_id",
            "parent_hash",
            "candidate_hash",
            "claim_status",
            "hard_gate_report_hash",
            "remaining_unknowns",
            "output_permissions",
            "allowed_next_transitions",
            "seal_readiness_checks",
        ],
        "boundary": seal_readiness_boundary(),
    }


def _candidate_manifest(candidate_id: str, hard_gate: Mapping[str, Any]) -> Mapping[str, Any]:
    source = _mapping(hard_gate.get("source_hard_gate_report"))
    candidates = source.get("source_candidate_set", {}).get("candidates") if isinstance(source.get("source_candidate_set"), Mapping) else None
    if isinstance(candidates, Sequence):
        for item in candidates:
            if isinstance(item, Mapping) and item.get("candidate_id") == candidate_id:
                return _mapping(item.get("candidate_manifest"))
    return {}


def _future_seal_payload(report: Mapping[str, Any], hard_gate_report_hash: str, manifest: Mapping[str, Any]) -> Dict[str, Any]:
    candidate_id = str(report.get("candidate_id") or "unknown_candidate")
    unknowns = manifest.get("unknowns", []) if isinstance(manifest.get("unknowns"), Sequence) else []
    return {
        "candidate_id": candidate_id,
        "parent_hash": report.get("parent_hash"),
        "candidate_hash": report.get("candidate_hash"),
        "manifest_hash": report.get("candidate_hash"),
        "claim_status": report.get("claim_status"),
        "hard_gate_decision": report.get("hard_gate_decision"),
        "hard_gate_report_hash": hard_gate_report_hash,
        "proof_debt": None,
        "remaining_unknowns": list(unknowns),
        "remaining_unknown_count": len(list(unknowns)),
        "output_permissions": "sealed_manifest_preview_only",
        "allowed_next_transitions": [
            "future_seal_engine_can_lock_manifest_hash",
            "future_memory_writer_must_still_require_sealed_manifest",
            "future_renderer_must_still_wait_for_RMC_render_gate",
        ],
        "seal_mode": "preview_only_no_commit",
        "patch_id": SEAL_READINESS_PATCH_ID,
        "schema_version": SEAL_READINESS_SCHEMA_VERSION,
    }


def evaluate_candidate_seal_readiness(report: Mapping[str, Any], hard_gate_report_hash: str, manifest: Optional[Mapping[str, Any]] = None) -> SealReadinessCandidate:
    claim_status = str(report.get("claim_status") or ClaimStatus.UNCLASSIFIED.value)
    hard_decision = str(report.get("hard_gate_decision") or "UNKNOWN")
    reference_only = _bool(report.get("reference_only"))
    rejected = _bool(report.get("rejected"))
    selectable = _bool(report.get("selectable_preview"))
    hard_gate_passed = _bool(report.get("hard_gate_passed"))
    seal_blocked = _bool(report.get("seal_blocked", True))
    memory_blocked = _bool(report.get("memory_promotion_blocked", True))
    checks_failed = int(report.get("gates_failed") or 0)

    claim_allowed = claim_status in SEAL_ALLOWED_CLAIM_STATUSES
    future_engine_ready = selectable and hard_gate_passed and not reference_only and not rejected and checks_failed == 0 and claim_allowed

    readiness_checks = (
        _check("hard_gate_passed", hard_gate_passed, hard_gate_passed, True, "Candidate must pass Patch 283 hard gates."),
        _check("selectable_preview", selectable, selectable, True, "Candidate must be selectable as a preview, not reference-only."),
        _check("not_reference_only", not reference_only, reference_only, False, "Recall/reference cannot be sealed as discovery."),
        _check("not_rejected", not rejected, rejected, False, "Rejected candidates cannot be seal-ready."),
        _check("claim_status_seal_allowed", claim_allowed, claim_status, sorted(SEAL_ALLOWED_CLAIM_STATUSES), "Claim status must be allowed for a future sealed manifest."),
        _check("no_failed_hard_gates", checks_failed == 0, checks_failed, 0, "No hard gate failures are allowed for seal readiness."),
        _check("future_seal_still_blocked", seal_blocked, seal_blocked, True, "Patch 284 may report readiness but must not execute sealing."),
        _check("memory_promotion_still_blocked", memory_blocked, memory_blocked, True, "Patch 284 may not promote memory."),
    )

    if rejected:
        decision = "NOT_SEALABLE_REJECTED"
        reason = report.get("rejection_reason") or "candidate rejected by hard gate report"
    elif reference_only:
        decision = "NOT_SEALABLE_REFERENCE_ONLY"
        reason = "reference/recall can be cited but cannot be sealed as discovery"
    elif not claim_allowed:
        decision = "NOT_SEALABLE_CLAIM_STATUS_BLOCKED"
        reason = f"claim_status {claim_status!r} is not allowed for Patch 284 future seal preview"
    elif future_engine_ready and claim_status == ClaimStatus.SPECULATIVE_BRANCH.value:
        decision = "BOUNDED_SEAL_READY_PREVIEW_ONLY"
        reason = "bounded/speculative candidate would require explicit future seal approval"
    elif future_engine_ready:
        decision = "SEAL_READY_PREVIEW_ONLY"
        reason = "candidate is seal-ready only as a future manifest lock; no seal route exists in Patch 284"
    else:
        decision = "NOT_SEALABLE_FAILED_READINESS"
        reason = "candidate did not satisfy one or more seal-readiness checks"

    manifest_map = manifest if isinstance(manifest, Mapping) else {}
    payload = _future_seal_payload(report, hard_gate_report_hash, manifest_map) if future_engine_ready else None
    payload_hash = _sha256(payload) if payload else None

    return SealReadinessCandidate(
        candidate_id=str(report.get("candidate_id") or "unknown_candidate"),
        candidate_hash=report.get("candidate_hash"),
        parent_hash=report.get("parent_hash"),
        claim_status=claim_status,
        readiness_decision=decision,
        would_be_seal_ready=future_engine_ready,
        seal_execution_permitted=False,
        future_seal_payload_hash=payload_hash,
        seal_blocked_reason=reason,
        readiness_checks=tuple(readiness_checks),
        future_seal_payload_preview=payload,
        hard_gate_decision=hard_decision,
        reference_only=reference_only,
        rejected=rejected,
    )


def build_seal_readiness_report(hard_gate_report: Optional[Mapping[str, Any]] = None) -> Dict[str, Any]:
    source = hard_gate_report if isinstance(hard_gate_report, Mapping) else build_hard_gate_report_preview()
    hard_gate_reports = source.get("candidate_gate_reports", []) if isinstance(source.get("candidate_gate_reports"), Sequence) else []
    hard_gate_report_hash = _sha256({
        "problem_id": source.get("problem_id"),
        "parent_hash": source.get("parent_hash"),
        "candidate_gate_reports": hard_gate_reports,
        "schema_version": source.get("schema_version"),
    })

    readiness_reports: List[Dict[str, Any]] = []
    for report in hard_gate_reports:
        if not isinstance(report, Mapping):
            continue
        manifest = _candidate_manifest(str(report.get("candidate_id") or ""), source)
        readiness_reports.append(evaluate_candidate_seal_readiness(report, hard_gate_report_hash, manifest).to_dict())

    seal_ready = [r for r in readiness_reports if r.get("would_be_seal_ready")]
    blocked = [r for r in readiness_reports if not r.get("would_be_seal_ready")]
    reference = [r for r in readiness_reports if r.get("readiness_decision") == "NOT_SEALABLE_REFERENCE_ONLY"]
    rejected = [r for r in readiness_reports if r.get("readiness_decision") == "NOT_SEALABLE_REJECTED"]
    best = None
    if seal_ready:
        prior_best = source.get("best_candidate_id")
        if prior_best and any(r.get("candidate_id") == prior_best for r in seal_ready):
            best = next(r for r in seal_ready if r.get("candidate_id") == prior_best)
        else:
            best = seal_ready[0]

    return {
        "status": "OK",
        "endpoint": SEAL_READINESS_PREVIEW_ROUTE,
        "mode": SEAL_READINESS_MODE,
        "current_patch": SEAL_READINESS_PATCH_ID,
        "schema_version": SEAL_READINESS_SCHEMA_VERSION,
        "preview_type": "seal_readiness_report",
        "problem_id": source.get("problem_id"),
        "parent_hash": source.get("parent_hash"),
        "hard_gate_report_hash": hard_gate_report_hash,
        "candidate_count": len(readiness_reports),
        "seal_ready_preview_count": len(seal_ready),
        "blocked_count": len(blocked),
        "reference_only_count": len(reference),
        "rejected_count": len(rejected),
        "best_seal_ready_candidate_id": best.get("candidate_id") if best else None,
        "best_seal_ready_candidate_hash": best.get("candidate_hash") if best else None,
        "best_seal_ready_claim_status": best.get("claim_status") if best else None,
        "seal_readiness_formula": SEAL_READINESS_FORMULA,
        "seal_route_available": False,
        "candidate_sealing_active": False,
        "memory_promotion_active": False,
        "live_candidate_commit_active": False,
        "seal_execution_permitted": False,
        "seal_readiness_reports": readiness_reports,
        "source_hard_gate_summary": {
            "current_patch": source.get("current_patch"),
            "candidate_count": source.get("candidate_count"),
            "selectable_preview_count": source.get("selectable_preview_count"),
            "rejected_count": source.get("rejected_count"),
            "reference_only_count": source.get("reference_only_count"),
            "best_candidate_id": source.get("best_candidate_id"),
        },
        "hard_laws": {
            "seal_preview_is_not_seal": True,
            "no_api_mea_seal_route": True,
            "no_memory_promotion": True,
            "reference_not_sealable_as_discovery": True,
            "rejected_not_sealable": True,
            "hypothesis_remains_hypothesis": True,
            "sealed_manifest_would_still_require_future_RMC_renderer_gate": True,
        },
        "non_mutating": True,
        "read_only": False,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "performs_network_io": False,
        "seeds_live_manifests": False,
        "commits_live_candidates": False,
        "seals_candidates": False,
        "promotes_to_memory": False,
        "renders_user_output": False,
        "boundary": seal_readiness_boundary(),
    }


def evaluate_seal_readiness_request(request: Optional[Mapping[str, Any]]) -> Dict[str, Any]:
    req = request if isinstance(request, Mapping) else {}
    supplied_token = str(req.get("approval_token") or req.get("approval") or "")
    if supplied_token != SEAL_READINESS_APPROVAL_TOKEN:
        return {
            "status": "REJECTED",
            "endpoint": SEAL_READINESS_POST_ROUTE,
            "mode": SEAL_READINESS_MODE,
            "current_patch": SEAL_READINESS_PATCH_ID,
            "schema_version": SEAL_READINESS_SCHEMA_VERSION,
            "gate_status": "REJECTED",
            "accepted": False,
            "reason_code": "approval_token_required",
            "approval_required": True,
            "approval_token_name": "approval_token",
            "expected_approval_token": SEAL_READINESS_APPROVAL_TOKEN,
            "gate_errors": ["missing or invalid approval_token for controlled MEA seal readiness report"],
            "candidate_count": 0,
            "non_mutating": True,
            "writes_files": False,
            "writes_memory": False,
            "writes_chroma": False,
            "writes_identity_vault": False,
            "calls_llm": False,
            "executes_shell": False,
            "commits_live_candidates": False,
            "seals_candidates": False,
            "promotes_to_memory": False,
            "boundary": seal_readiness_boundary(),
        }

    hard_gate_request = req.get("hard_gate_request")
    if isinstance(hard_gate_request, Mapping):
        hard_payload = dict(hard_gate_request)
    else:
        hard_payload = {"use_fixture": bool(req.get("use_fixture", True))}
        if isinstance(req.get("candidate_set_request"), Mapping):
            hard_payload["candidate_set_request"] = dict(req["candidate_set_request"])
        if isinstance(req.get("manifest"), Mapping):
            hard_payload["manifest"] = dict(req["manifest"])
            hard_payload["source"] = req.get("source") or "request_manifest"
        if isinstance(req.get("problem_manifest"), Mapping):
            hard_payload["problem_manifest"] = dict(req["problem_manifest"])
            hard_payload["source"] = req.get("source") or "request_manifest"
    hard_payload.setdefault("approval_token", HARD_GATE_REPORT_APPROVAL_TOKEN)

    hard_gate = evaluate_hard_gate_report_request(hard_payload)
    if hard_gate.get("status") != "OK" or hard_gate.get("gate_status") == "REJECTED":
        return {
            "status": "REJECTED",
            "endpoint": SEAL_READINESS_POST_ROUTE,
            "mode": SEAL_READINESS_MODE,
            "current_patch": SEAL_READINESS_PATCH_ID,
            "schema_version": SEAL_READINESS_SCHEMA_VERSION,
            "gate_status": "REJECTED",
            "accepted": False,
            "reason_code": "hard_gate_report_failed",
            "hard_gate_result": dict(hard_gate),
            "candidate_count": 0,
            "non_mutating": True,
            "writes_files": False,
            "writes_memory": False,
            "writes_chroma": False,
            "writes_identity_vault": False,
            "calls_llm": False,
            "executes_shell": False,
            "commits_live_candidates": False,
            "seals_candidates": False,
            "promotes_to_memory": False,
            "boundary": seal_readiness_boundary(),
        }

    report = build_seal_readiness_report(hard_gate)
    report.update({
        "endpoint": SEAL_READINESS_POST_ROUTE,
        "gate_status": "ACCEPTED_PREVIEW_ONLY",
        "accepted": True,
        "approval_required": True,
        "approval_token_name": "approval_token",
        "expected_approval_token": SEAL_READINESS_APPROVAL_TOKEN,
        "hard_gate_result": dict(hard_gate),
    })
    return report


def build_seal_readiness_preview() -> Dict[str, Any]:
    return build_seal_readiness_report(build_hard_gate_report_preview())


def build_seal_readiness_gate_preview() -> Dict[str, Any]:
    return evaluate_seal_readiness_request({"approval_token": SEAL_READINESS_APPROVAL_TOKEN, "use_fixture": True})


def build_seal_readiness_rejection_preview() -> Dict[str, Any]:
    return evaluate_seal_readiness_request({"use_fixture": True})
