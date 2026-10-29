"""
forge/rmc_engine_v1/mea/hard_gate_report.py

Patch 283R — MEA Hard Gate Report POST Dispatch Hotfix.

This module converts the Patch 282 candidate-set preview into a strict,
non-mutating hard-gate report. It is not a seal engine. It does not persist
live MEA state, write files, call LLMs, perform network I/O, execute shell
commands, promote memory, or render user output.

Purpose:
- apply replay, tamper, claim-status, proof-debt, information-gain,
  convergence, drift, render-permission, seal-block, and memory-promotion
  gates to every candidate;
- distinguish reference-only recall from selectable candidate previews;
- keep hypothesis as hypothesis and rejected candidates non-visible;
- prepare the audit surface required before any later seal-preview layer.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple

from .candidate_set_gate import (
    CANDIDATE_SET_GATE_APPROVAL_TOKEN,
    build_candidate_set_preview,
    evaluate_candidate_set_request,
)
from .manifest_schema import ClaimStatus

HARD_GATE_REPORT_PATCH_ID = "Patch 283R — MEA Hard Gate Report POST Dispatch Hotfix"
HARD_GATE_REPORT_SCHEMA_VERSION = "mea_hard_gate_report_v1_patch283"
HARD_GATE_REPORT_MODE = "controlled_mea_hard_gate_report_patch283"
HARD_GATE_REPORT_APPROVAL_TOKEN = "APPROVE_MEA_HARD_GATE_REPORT"
HARD_GATE_REPORT_STATUS_ROUTE = "/api/mea/hard-gate-report/status"
HARD_GATE_REPORT_PREVIEW_ROUTE = "/api/mea/hard-gate-report-preview"
HARD_GATE_REPORT_POST_ROUTE = "/api/mea/hard-gate-report-gate"
HARD_GATE_REPORT_ALIAS_ROUTE = "/api/mea/candidate-hard-gate"

HARD_GATE_FORMULA = (
    "HardGate(c_i)=Replay∧¬Tamper∧ClaimStatusAllowed∧ProofDebtAllowed∧"
    "InfoGainAllowed∧OmegaAllowed∧DriftAllowed∧RenderScopeAllowed∧SealBlocked∧MemoryBlocked"
)

PROOF_DEBT_LIMITS = {
    ClaimStatus.VERIFIED_CLAIM.value: 0.20,
    ClaimStatus.DERIVED_CLAIM.value: 0.40,
    ClaimStatus.HYPOTHESIS.value: 0.70,
    ClaimStatus.SPECULATIVE_BRANCH.value: 0.85,
    ClaimStatus.TEST_REQUIRED.value: 0.85,
    ClaimStatus.PARTIAL_RESOLUTION.value: 0.70,
    ClaimStatus.RESOLVED_MANIFEST.value: 0.30,
    ClaimStatus.NAMED_CONCEPT.value: 0.75,
    ClaimStatus.CONTRADICTION_EXPOSED.value: 0.85,
    ClaimStatus.COLD_STORED.value: 1.00,
    ClaimStatus.RECALL.value: 1.00,
    ClaimStatus.REJECTED.value: 0.00,
}
DRIFT_THRESHOLD = 0.35
MIN_CONVERGENCE_FOR_SELECTABLE = 0.10


@dataclass(frozen=True)
class HardGateCheck:
    gate_name: str
    passed: bool
    severity: str
    observed: Any
    threshold: Any
    detail: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class CandidateHardGateReport:
    candidate_id: str
    candidate_hash: Optional[str]
    parent_hash: Optional[str]
    claim_status: str
    hard_gate_decision: str
    selectable_preview: bool
    reference_only: bool
    rejected: bool
    rejection_reason: Optional[str]
    gates_passed: int
    gates_failed: int
    gate_checks: Tuple[Dict[str, Any], ...]
    hard_gate_passed: bool
    seal_blocked: bool
    memory_promotion_blocked: bool
    render_permission: str
    preview_score: float
    candidate_sealing_permitted: bool = False
    memory_promotion_permitted: bool = False
    patch_id: str = HARD_GATE_REPORT_PATCH_ID
    schema_version: str = HARD_GATE_REPORT_SCHEMA_VERSION

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _bool(value: Any) -> bool:
    return bool(value)


def _num(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return fallback


def _check(name: str, passed: bool, observed: Any, threshold: Any, detail: str, severity: str = "hard") -> HardGateCheck:
    return HardGateCheck(
        gate_name=name,
        passed=bool(passed),
        severity=severity,
        observed=observed,
        threshold=threshold,
        detail=detail,
    )


def hard_gate_report_boundary() -> Dict[str, Any]:
    return {
        "patch": HARD_GATE_REPORT_PATCH_ID,
        "schema_version": HARD_GATE_REPORT_SCHEMA_VERSION,
        "layer": "MEA hard gate report / candidate gate engine preview",
        "read_only": False,
        "non_mutating": True,
        "creates_get_routes": True,
        "creates_post_routes": True,
        "get_routes": [HARD_GATE_REPORT_STATUS_ROUTE, HARD_GATE_REPORT_PREVIEW_ROUTE],
        "post_routes": [HARD_GATE_REPORT_POST_ROUTE, HARD_GATE_REPORT_ALIAS_ROUTE],
        "requires_approval_token": True,
        "approval_token": HARD_GATE_REPORT_APPROVAL_TOKEN,
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
    }


def hard_gate_report_status() -> Dict[str, Any]:
    return {
        "status": "OK",
        "endpoint": HARD_GATE_REPORT_STATUS_ROUTE,
        "mode": HARD_GATE_REPORT_MODE,
        "current_patch": HARD_GATE_REPORT_PATCH_ID,
        "schema_version": HARD_GATE_REPORT_SCHEMA_VERSION,
        "gate_visible": True,
        "preview_route": HARD_GATE_REPORT_PREVIEW_ROUTE,
        "post_route": HARD_GATE_REPORT_POST_ROUTE,
        "alias_route": HARD_GATE_REPORT_ALIAS_ROUTE,
        "approval_required": True,
        "approval_token": HARD_GATE_REPORT_APPROVAL_TOKEN,
        "candidate_set_gate_token_required": CANDIDATE_SET_GATE_APPROVAL_TOKEN,
        "live_candidate_commit_active": False,
        "candidate_sealing_active": False,
        "memory_promotion_active": False,
        "hard_gate_formula": HARD_GATE_FORMULA,
        "gate_names": [
            "replay_gate",
            "tamper_gate",
            "claim_status_gate",
            "proof_debt_gate",
            "information_gain_gate",
            "convergence_gate",
            "drift_gate",
            "render_scope_gate",
            "seal_block_gate",
            "memory_promotion_block_gate",
        ],
        "boundary": hard_gate_report_boundary(),
    }


def _proof_limit(status: str) -> float:
    return float(PROOF_DEBT_LIMITS.get(status, 1.0))


def _candidate_checks(candidate: Mapping[str, Any]) -> Tuple[HardGateCheck, ...]:
    replay = candidate.get("replay_report", {}) if isinstance(candidate.get("replay_report"), Mapping) else {}
    claim = candidate.get("claim_status_report", {}) if isinstance(candidate.get("claim_status_report"), Mapping) else {}
    scores = candidate.get("score_bundle", {}) if isinstance(candidate.get("score_bundle"), Mapping) else {}
    info = scores.get("information_gain", {}) if isinstance(scores.get("information_gain"), Mapping) else {}
    proof = scores.get("proof_debt", {}) if isinstance(scores.get("proof_debt"), Mapping) else {}
    convergence = scores.get("convergence", {}) if isinstance(scores.get("convergence"), Mapping) else {}

    claim_status = str(claim.get("claim_status") or ClaimStatus.UNCLASSIFIED.value)
    proof_debt = _num(claim.get("proof_debt", proof.get("proof_debt", 1.0)), 1.0)
    information_gain = _num(claim.get("information_gain", info.get("information_gain", 0.0)), 0.0)
    omega = _num(claim.get("convergence", convergence.get("omega", 0.0)), 0.0)
    drift = _num(claim.get("drift_score", 0.0), 0.0)
    gate_status = str(candidate.get("gate_status") or "")
    render_permission = str(candidate.get("render_permission") or claim.get("output_permissions") or "sealed")
    user_visible = _bool(claim.get("user_visible"))

    replay_confirmed = _bool(replay.get("replay_confirmed"))
    tamper_detected = _bool(replay.get("tamper_detected"))
    proof_limit = _proof_limit(claim_status)
    is_recall = claim_status == ClaimStatus.RECALL.value or gate_status == "REFERENCE_ONLY"
    is_rejected = claim_status == ClaimStatus.REJECTED.value or gate_status == "REJECTED"
    is_selectable_claim = claim_status in {
        ClaimStatus.HYPOTHESIS.value,
        ClaimStatus.SPECULATIVE_BRANCH.value,
        ClaimStatus.TEST_REQUIRED.value,
        ClaimStatus.PARTIAL_RESOLUTION.value,
        ClaimStatus.DERIVED_CLAIM.value,
    }

    checks: List[HardGateCheck] = []
    checks.append(_check("replay_gate", replay_confirmed, replay_confirmed, True, "Replay must reproduce the candidate hash."))
    checks.append(_check("tamper_gate", not tamper_detected, tamper_detected, False, "Tamper/hash mismatch must be absent."))
    checks.append(_check("claim_status_gate", not is_rejected and claim_status != ClaimStatus.VERIFIED_CLAIM.value, claim_status, "not rejected and not verified_claim before seal engine", "Claim status must be render-safe before seal exists."))
    checks.append(_check("proof_debt_gate", proof_debt <= proof_limit, proof_debt, proof_limit, "Proof debt must stay inside the band allowed for the claim status."))
    checks.append(_check("information_gain_gate", is_recall or information_gain > 0.0, information_gain, ">0 for non-recall", "Non-recall candidates must add information or reduce unknowns/contradictions."))
    checks.append(_check("convergence_gate", is_recall or omega >= MIN_CONVERGENCE_FOR_SELECTABLE, omega, MIN_CONVERGENCE_FOR_SELECTABLE, "Non-recall candidates must make measurable progress toward success conditions."))
    checks.append(_check("drift_gate", drift <= DRIFT_THRESHOLD, drift, DRIFT_THRESHOLD, "Drift must remain below the hard threshold."))
    checks.append(_check("render_scope_gate", (not is_rejected) and (user_visible or is_recall) and render_permission != "sealed", {"user_visible": user_visible, "render_permission": render_permission}, "visible non-sealed preview for non-rejected candidates", "Only render-safe previews may be visible; rejected candidates stay sealed."))
    checks.append(_check("seal_block_gate", candidate.get("candidate_sealing_permitted") is False, candidate.get("candidate_sealing_permitted"), False, "Patch 283 must not permit sealing."))
    checks.append(_check("memory_promotion_block_gate", candidate.get("memory_promotion_permitted") is False, candidate.get("memory_promotion_permitted"), False, "Patch 283 must not permit memory promotion."))

    # A rejected candidate should explicitly fail render scope; a reference candidate may pass
    # hard safety checks but cannot be selected as discovery.
    return tuple(checks)


def evaluate_candidate_hard_gates(candidate: Mapping[str, Any]) -> CandidateHardGateReport:
    claim = candidate.get("claim_status_report", {}) if isinstance(candidate.get("claim_status_report"), Mapping) else {}
    claim_status = str(claim.get("claim_status") or ClaimStatus.UNCLASSIFIED.value)
    gate_status = str(candidate.get("gate_status") or "")
    checks = _candidate_checks(candidate)
    failed = [c for c in checks if not c.passed]
    passed = [c for c in checks if c.passed]

    is_recall = claim_status == ClaimStatus.RECALL.value or gate_status == "REFERENCE_ONLY"
    is_rejected = claim_status == ClaimStatus.REJECTED.value or gate_status == "REJECTED"

    if is_rejected or failed:
        decision = "REJECTED"
        selectable = False
        reference_only = False
        rejected = True
        reason = candidate.get("rejection_reason") or (failed[0].detail if failed else "candidate rejected by prior gate")
    elif is_recall:
        decision = "REFERENCE_ONLY"
        selectable = False
        reference_only = True
        rejected = False
        reason = "recall/reference cannot be selected as discovery"
    elif claim_status == ClaimStatus.SPECULATIVE_BRANCH.value:
        decision = "PASS_BOUNDED_PREVIEW_ONLY"
        selectable = True
        reference_only = False
        rejected = False
        reason = None
    else:
        decision = "PASS_PREVIEW_ONLY"
        selectable = True
        reference_only = False
        rejected = False
        reason = None

    return CandidateHardGateReport(
        candidate_id=str(candidate.get("candidate_id") or "unknown_candidate"),
        candidate_hash=candidate.get("candidate_hash"),
        parent_hash=candidate.get("parent_hash"),
        claim_status=claim_status,
        hard_gate_decision=decision,
        selectable_preview=selectable,
        reference_only=reference_only,
        rejected=rejected,
        rejection_reason=reason,
        gates_passed=len(passed),
        gates_failed=len(failed),
        gate_checks=tuple(c.to_dict() for c in checks),
        hard_gate_passed=selectable,
        seal_blocked=True,
        memory_promotion_blocked=True,
        render_permission=str(candidate.get("render_permission") or claim.get("output_permissions") or "sealed"),
        preview_score=_num(candidate.get("preview_score", 0.0), 0.0),
        candidate_sealing_permitted=False,
        memory_promotion_permitted=False,
    )


def build_hard_gate_report(candidate_set: Optional[Mapping[str, Any]] = None) -> Dict[str, Any]:
    source = candidate_set if isinstance(candidate_set, Mapping) else build_candidate_set_preview()
    candidates = source.get("candidates", []) if isinstance(source.get("candidates"), Sequence) else []
    reports = [evaluate_candidate_hard_gates(c).to_dict() for c in candidates if isinstance(c, Mapping)]
    selectable = [r for r in reports if r.get("selectable_preview")]
    rejected = [r for r in reports if r.get("rejected")]
    reference = [r for r in reports if r.get("reference_only")]
    best = None
    if selectable:
        by_id = {c.get("candidate_id"): c for c in candidates if isinstance(c, Mapping)}
        best = max(selectable, key=lambda r: (_num(r.get("preview_score"), 0.0), str(r.get("candidate_id"))))
        # Keep Patch 282's deterministic best candidate if it still passes hard gates.
        prior_best = source.get("best_candidate_id")
        if prior_best and any(r.get("candidate_id") == prior_best for r in selectable):
            best = next(r for r in selectable if r.get("candidate_id") == prior_best)

    return {
        "status": "OK",
        "endpoint": HARD_GATE_REPORT_PREVIEW_ROUTE,
        "mode": HARD_GATE_REPORT_MODE,
        "current_patch": HARD_GATE_REPORT_PATCH_ID,
        "schema_version": HARD_GATE_REPORT_SCHEMA_VERSION,
        "preview_type": "hard_gate_report",
        "problem_id": source.get("problem_id"),
        "parent_hash": source.get("parent_hash"),
        "candidate_count": len(reports),
        "selectable_preview_count": len(selectable),
        "rejected_count": len(rejected),
        "reference_only_count": len(reference),
        "best_candidate_id": best.get("candidate_id") if best else None,
        "best_candidate_hash": best.get("candidate_hash") if best else None,
        "best_candidate_claim_status": best.get("claim_status") if best else None,
        "candidate_sealing_active": False,
        "memory_promotion_active": False,
        "live_candidate_commit_active": False,
        "hard_gate_formula": HARD_GATE_FORMULA,
        "candidate_gate_reports": reports,
        "source_candidate_set_summary": {
            "current_patch": source.get("current_patch"),
            "candidate_count": source.get("candidate_count"),
            "accepted_preview_count": source.get("accepted_preview_count"),
            "rejected_count": source.get("rejected_count"),
            "reference_only_count": source.get("reference_only_count"),
            "best_candidate_id": source.get("best_candidate_id"),
        },
        "hard_laws": {
            "hard_gates_override_preview_score": True,
            "replay_confirmed_required": True,
            "tamper_blocks_candidate": True,
            "verified_claim_blocked_before_seal_engine": True,
            "hypothesis_not_verified_claim": True,
            "recall_not_discovery": True,
            "rejected_not_user_visible": True,
            "seal_blocked_in_patch_283": True,
            "memory_promotion_blocked_in_patch_283": True,
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
        "boundary": hard_gate_report_boundary(),
    }


def evaluate_hard_gate_report_request(request: Optional[Mapping[str, Any]]) -> Dict[str, Any]:
    req = request if isinstance(request, Mapping) else {}
    supplied_token = str(req.get("approval_token") or req.get("approval") or "")
    if supplied_token != HARD_GATE_REPORT_APPROVAL_TOKEN:
        return {
            "status": "REJECTED",
            "endpoint": HARD_GATE_REPORT_POST_ROUTE,
            "mode": HARD_GATE_REPORT_MODE,
            "current_patch": HARD_GATE_REPORT_PATCH_ID,
            "schema_version": HARD_GATE_REPORT_SCHEMA_VERSION,
            "gate_status": "REJECTED",
            "accepted": False,
            "reason_code": "approval_token_required",
            "approval_required": True,
            "approval_token_name": "approval_token",
            "expected_approval_token": HARD_GATE_REPORT_APPROVAL_TOKEN,
            "gate_errors": ["missing or invalid approval_token for controlled MEA hard gate report"],
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
            "boundary": hard_gate_report_boundary(),
        }

    candidate_request = req.get("candidate_set_request")
    if isinstance(candidate_request, Mapping):
        candidate_payload = dict(candidate_request)
    else:
        candidate_payload = {"use_fixture": bool(req.get("use_fixture", True))}
        if isinstance(req.get("manifest"), Mapping):
            candidate_payload["manifest"] = dict(req["manifest"])
            candidate_payload["source"] = req.get("source") or "request_manifest"
        if isinstance(req.get("problem_manifest"), Mapping):
            candidate_payload["problem_manifest"] = dict(req["problem_manifest"])
            candidate_payload["source"] = req.get("source") or "request_manifest"
    candidate_payload.setdefault("approval_token", CANDIDATE_SET_GATE_APPROVAL_TOKEN)

    candidate_set = evaluate_candidate_set_request(candidate_payload)
    if candidate_set.get("status") != "OK" or not candidate_set.get("accepted", True):
        return {
            "status": "REJECTED",
            "endpoint": HARD_GATE_REPORT_POST_ROUTE,
            "mode": HARD_GATE_REPORT_MODE,
            "current_patch": HARD_GATE_REPORT_PATCH_ID,
            "schema_version": HARD_GATE_REPORT_SCHEMA_VERSION,
            "gate_status": "REJECTED",
            "accepted": False,
            "reason_code": "candidate_set_gate_failed",
            "candidate_set_result": dict(candidate_set),
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
            "boundary": hard_gate_report_boundary(),
        }

    report = build_hard_gate_report(candidate_set)
    report.update(
        {
            "endpoint": HARD_GATE_REPORT_POST_ROUTE,
            "gate_status": "ACCEPTED_PREVIEW_ONLY",
            "accepted": True,
            "approval_required": True,
            "approval_token_name": "approval_token",
            "expected_approval_token": HARD_GATE_REPORT_APPROVAL_TOKEN,
            "candidate_set_result": dict(candidate_set),
        }
    )
    return report


def build_hard_gate_report_preview() -> Dict[str, Any]:
    return build_hard_gate_report(build_candidate_set_preview())


def build_hard_gate_report_gate_preview() -> Dict[str, Any]:
    return evaluate_hard_gate_report_request({"approval_token": HARD_GATE_REPORT_APPROVAL_TOKEN, "use_fixture": True})


def build_hard_gate_report_rejection_preview() -> Dict[str, Any]:
    return evaluate_hard_gate_report_request({"use_fixture": True})
