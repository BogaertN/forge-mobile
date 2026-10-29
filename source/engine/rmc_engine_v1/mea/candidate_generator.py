"""
forge/rmc_engine_v1/mea/candidate_generator.py

Patch 288 — MEA Candidate Generator Runtime Preview.

Implements the MEA runtime relation:
    c_i = O_verify ∘ O_gen(M_t)

Patch 287 introduced unverified drafts d_i from operator_engine.py. This module
runs those drafts through deterministic verification operators and returns an
uncommitted candidate preview set C(M_t). It does not replace the older Patch 282
fixture route yet; it provides the real generated-candidate preview surface used
by later patches.

Boundary: stdlib only, deterministic, no file writes, no memory writes, no
Chroma writes, no Identity Vault writes, no LLM calls, no shell execution, no
network I/O, no live candidate commit, no live manifest advance, no seal, and no
memory promotion.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, Mapping, Optional, Tuple, List

from .manifest_schema import (
    ClaimStatus,
    OutputPermission,
    ProblemManifest,
    build_144hz_test_manifest,
    canonical_hash,
    from_dict,
    to_dict,
)
from .operator_engine import OperatorDraftResult, run_operator_preview
from .replay_engine import replay_candidate
from .proof_debt_scorer import score_proof_debt
from .information_gain_scorer import score_information_gain
from .convergence_scorer import score_convergence
from .goal_ancestry_scorer import score_goal_ancestry
from .operator_cost_scorer import score_operator_cost
from .claim_status_classifier import classify_claim_status

CANDIDATE_GENERATOR_PATCH_ID = "Patch 288 — MEA Candidate Generator Runtime Preview"
CANDIDATE_GENERATOR_SCHEMA_VERSION = "mea_candidate_generator_v1_patch288"
CANDIDATE_GENERATOR_MODE = "controlled_mea_candidate_generator_preview_patch288"
CANDIDATE_GENERATOR_APPROVAL_TOKEN = "APPROVE_MEA_CANDIDATE_GENERATOR_PREVIEW"
CANDIDATE_GENERATOR_STATUS_ROUTE = "/api/mea/candidate-generator/status"
CANDIDATE_GENERATOR_PREVIEW_ROUTE = "/api/mea/candidate-generator-preview"
CANDIDATE_GENERATOR_POST_ROUTE = "/api/mea/candidate-generator-gate"
CANDIDATE_GENERATOR_FORMULA = "c_i = O_verify ∘ O_gen(M_t)"

_DRIFT_THRESHOLD = 0.35
_MAX_PREVIEW_PROOF_DEBT = 0.95

_PREVIEW_OPERATOR_CALLS: Tuple[Dict[str, Any], ...] = (
    {
        "candidate_id": "cg_recall_001",
        "operator_id": "noop_recall",
        "theta_k": {},
        "label": "noop_recall — reference-only generated candidate preview; no discovery",
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
        "label": "hypothesize — 144 Hz harmonic path; hypothesis only, not verified claim",
    },
    {
        "candidate_id": "cg_branch_001",
        "operator_id": "branch",
        "theta_k": {
            "branch_label": "empirical_measurement_path",
            "branch_goal": "Find published myelin-specific measurement of 144 Hz.",
            "branch_unknown": "Direct empirical measurement of 144 Hz in myelin.",
        },
        "label": "branch — empirical measurement investigation; speculative branch only",
    },
    {
        "candidate_id": "cg_tamper_001",
        "operator_id": "noop_recall",
        "theta_k": {},
        "label": "tamper probe — replay hash mismatch must reject",
        "inject_bad_expected_hash": True,
    },
)


def _stable_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _stable_hash(value: Any) -> str:
    return hashlib.sha256(_stable_json(value).encode("utf-8")).hexdigest()


def _candidate_hash(candidate_id: str, parent_hash: str, draft: OperatorDraftResult, gates: Tuple["VerificationGateResult", ...]) -> str:
    return _stable_hash({
        "candidate_id": candidate_id,
        "parent_hash": parent_hash,
        "draft_hash": draft.draft_hash,
        "operator_id": draft.operator_id,
        "theta_hash": draft.theta_hash,
        "gate_vector": [g.to_dict() for g in gates],
        "schema_version": CANDIDATE_GENERATOR_SCHEMA_VERSION,
    })


@dataclass(frozen=True)
class VerificationGateResult:
    check_name: str
    passed: bool
    detail: str
    observed: Any = None
    threshold: Any = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class GeneratedCandidatePreview:
    candidate_id: str
    parent_hash: str
    candidate_hash: str
    draft_hash: Optional[str]
    operator_id: str
    theta_hash: str
    theta_k: Dict[str, Any]
    draft_result: Dict[str, Any]
    verification_gates: Tuple[VerificationGateResult, ...]
    replay_report: Dict[str, Any]
    score_bundle: Dict[str, Any]
    claim_status_report: Dict[str, Any]
    claim_status: str
    raw_classifier_claim_status: str
    output_permissions: str
    verification_passed: bool
    verification_operator_count: int
    failed_verification_count: int
    containment_preview: bool
    user_visible: bool
    selectable_preview: bool
    reference_only: bool
    rejection_reason: Optional[str]
    render_permission: str
    uncommitted: bool = True
    is_candidate_preview: bool = True
    is_sealed: bool = False
    live_candidate_commit_permitted: bool = False
    candidate_sealing_permitted: bool = False
    memory_promotion_permitted: bool = False
    live_manifest_advance_permitted: bool = False
    patch_id: str = CANDIDATE_GENERATOR_PATCH_ID
    schema_version: str = CANDIDATE_GENERATOR_SCHEMA_VERSION

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["verification_gates"] = [gate.to_dict() for gate in self.verification_gates]
        return data


def _gate(check_name: str, passed: bool, detail: str, observed: Any = None, threshold: Any = None) -> VerificationGateResult:
    return VerificationGateResult(check_name=check_name, passed=bool(passed), detail=detail, observed=observed, threshold=threshold)


def _drift_total(manifest: ProblemManifest) -> float:
    drift = manifest.drift_state
    return float(getattr(drift, "total", 0.0))


def _apply_verification_gates(parent: ProblemManifest, draft: OperatorDraftResult, *, inject_bad_expected_hash: bool = False) -> Tuple[Tuple[VerificationGateResult, ...], Dict[str, Any], bool]:
    gates: List[VerificationGateResult] = []
    replay_report: Dict[str, Any] = {}

    if not draft.draft_executed or not draft.draft_manifest or not draft.draft_hash:
        gates.append(_gate("check_replay", False, "Draft did not execute; replay cannot verify c_i.", observed=draft.draft_hash))
        gates.append(_gate("check_constraint", False, "No draft manifest available for constraint verification."))
        gates.append(_gate("check_proof_debt", False, "No draft manifest available for proof-debt verification."))
        gates.append(_gate("check_drift", False, "No draft manifest available for drift verification."))
        gates.append(_gate("check_contradiction", False, "No draft manifest available for contradiction verification."))
        return tuple(gates), replay_report, False

    expected_hash = "deadbeef" * 8 if inject_bad_expected_hash else str(draft.draft_hash)
    theta = dict(draft.theta_normalized or {})
    replay = replay_candidate(parent, draft.operator_id, theta, expected_candidate_hash=expected_hash)
    replay_report = replay.to_dict()
    replay_ok = bool(replay.replay_confirmed and not replay.tamper_detected)
    gates.append(_gate(
        "check_replay",
        replay_ok,
        "Replay confirmed: Replay(H(M_t), O_k, theta_k) = H(c_i)." if replay_ok else "Replay failed or tamper detected; candidate must route to containment preview.",
        observed=replay.produced_candidate_hash,
        threshold=expected_hash,
    ))

    try:
        candidate = from_dict(draft.draft_manifest)
    except Exception as exc:
        gates.append(_gate("check_constraint", False, f"Draft manifest parse failed: {exc}"))
        gates.append(_gate("check_proof_debt", False, "No parsed draft manifest for proof-debt verification."))
        gates.append(_gate("check_drift", False, "No parsed draft manifest for drift verification."))
        gates.append(_gate("check_contradiction", False, "No parsed draft manifest for contradiction verification."))
        return tuple(gates), replay_report, False

    parent_constraints = tuple(str(item) for item in parent.constraints)
    candidate_constraints = tuple(str(item) for item in candidate.constraints)
    constraint_removed = [item for item in parent_constraints if item not in candidate_constraints]
    constraint_ok = len(constraint_removed) == 0 and candidate.claim_status != ClaimStatus.REJECTED.value
    gates.append(_gate(
        "check_constraint",
        constraint_ok,
        "All parent constraints retained; no rejected draft status." if constraint_ok else f"Constraint failure: removed={constraint_removed!r}, status={candidate.claim_status!r}",
        observed={"removed_constraints": constraint_removed, "candidate_claim_status": candidate.claim_status},
        threshold="no parent constraint removed",
    ))

    debt = score_proof_debt(candidate)
    proof_ok = float(debt.proof_debt) < _MAX_PREVIEW_PROOF_DEBT
    gates.append(_gate(
        "check_proof_debt",
        proof_ok,
        f"proof_debt={debt.proof_debt:.3f}; preview permits hypothesis/branch only, never verified claim." if proof_ok else f"proof_debt={debt.proof_debt:.3f}; exceeds maximum preview threshold.",
        observed=round(float(debt.proof_debt), 6),
        threshold=_MAX_PREVIEW_PROOF_DEBT,
    ))

    drift_value = _drift_total(candidate)
    drift_ok = drift_value <= _DRIFT_THRESHOLD
    gates.append(_gate(
        "check_drift",
        drift_ok,
        f"drift_total={drift_value:.3f}; within preview threshold." if drift_ok else f"drift_total={drift_value:.3f}; exceeds threshold.",
        observed=round(drift_value, 6),
        threshold=_DRIFT_THRESHOLD,
    ))

    parent_contradictions = {str(item).strip().lower() for item in parent.contradictions if str(item).strip()}
    candidate_contradictions = {str(item).strip().lower() for item in candidate.contradictions if str(item).strip()}
    introduced = tuple(sorted(candidate_contradictions - parent_contradictions))
    contradiction_ok = len(introduced) == 0
    gates.append(_gate(
        "check_contradiction",
        contradiction_ok,
        "No new contradictions introduced." if contradiction_ok else f"New contradictions introduced: {introduced!r}.",
        observed=len(introduced),
        threshold=0,
    ))

    all_passed = all(g.passed for g in gates)
    return tuple(gates), replay_report, all_passed


def _score_and_classify(parent: ProblemManifest, candidate: ProblemManifest, replay_report: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any], str, str, str, bool, bool]:
    replay_obj = None
    # classify_claim_status accepts ReplayResult objects in prior layers. If the
    # dictionary cannot be reconstructed, classification still falls back to the
    # draft manifest status below. This preserves deterministic behavior without
    # inventing a fake ReplayResult.
    try:
        from .replay_engine import ReplayResult
        replay_obj = ReplayResult(**{k: replay_report[k] for k in ReplayResult.__dataclass_fields__.keys() if k in replay_report})
    except Exception:
        replay_obj = None

    debt = score_proof_debt(candidate)
    info = score_information_gain(parent, candidate)
    conv = score_convergence(parent, candidate)
    ancestry = score_goal_ancestry(parent, candidate)
    cost = score_operator_cost(candidate)
    score_bundle = {
        "proof_debt": debt.to_dict(),
        "information_gain": info.to_dict(),
        "convergence": conv.to_dict(),
        "goal_ancestry": ancestry.to_dict(),
        "operator_cost": cost.to_dict(),
    }

    raw_status = candidate.claim_status or ClaimStatus.UNCLASSIFIED.value
    report: Dict[str, Any] = {"classifier_used": False, "reason": "fallback_to_candidate_manifest_status"}
    try:
        classification = classify_claim_status(
            parent,
            candidate,
            replay_result=replay_obj,
            proof_debt_score=debt,
            information_gain_score=info,
            convergence_score=conv,
        )
        report = classification.to_dict()
        raw_status = classification.claim_status
    except Exception as exc:
        report = {"classifier_used": False, "error": str(exc)[:240], "fallback_claim_status": raw_status}

    # Patch 276 information gain does not count new assumptions. A hypothesis
    # draft may therefore have I=0 while still being a changed, replay-confirmed
    # hypothesis. Treat it as hypothesis but explicitly forbid discovery/verified
    # rendering. This does not override gates and does not upgrade proof status.
    final_status = raw_status
    if final_status == ClaimStatus.RECALL.value and canonical_hash(parent) != canonical_hash(candidate):
        if candidate.claim_status == ClaimStatus.HYPOTHESIS.value:
            final_status = ClaimStatus.HYPOTHESIS.value
            report["candidate_generator_status_adjustment"] = "classifier recall due I(c_i)=0, but manifest changed by hypothesize; kept as hypothesis, not discovery."
        elif candidate.claim_status == ClaimStatus.SPECULATIVE_BRANCH.value:
            final_status = ClaimStatus.SPECULATIVE_BRANCH.value
            report["candidate_generator_status_adjustment"] = "classifier recall due I(c_i)=0, but manifest changed by branch; kept as speculative_branch, not discovery."

    if final_status == ClaimStatus.VERIFIED_CLAIM.value and float(debt.proof_debt) >= 0.20:
        final_status = ClaimStatus.HYPOTHESIS.value
        report["anti_confabulation_downgrade"] = "proof_debt >= 0.20 blocks verified_claim."

    reference_only = canonical_hash(parent) == canonical_hash(candidate) or final_status == ClaimStatus.RECALL.value
    user_visible = final_status not in (ClaimStatus.REJECTED.value, ClaimStatus.COLD_STORED.value)
    output_permissions = candidate.output_permissions or OutputPermission.SEALED.value
    return score_bundle, report, final_status, raw_status, output_permissions, user_visible, reference_only


def generate_candidate_from_draft(parent: ProblemManifest, candidate_id: str, operator_id: str, theta_k: Optional[Mapping[str, Any]] = None, *, inject_bad_expected_hash: bool = False) -> GeneratedCandidatePreview:
    draft = run_operator_preview(parent, operator_id, theta_k)
    gates, replay_report, verification_passed = _apply_verification_gates(parent, draft, inject_bad_expected_hash=inject_bad_expected_hash)
    parent_hash = canonical_hash(parent)
    generated_hash = _candidate_hash(candidate_id, parent_hash, draft, gates)
    failed_count = sum(1 for gate in gates if not gate.passed)

    score_bundle: Dict[str, Any] = {}
    claim_status_report: Dict[str, Any] = {}
    claim_status = ClaimStatus.REJECTED.value
    raw_status = ClaimStatus.REJECTED.value
    output_permissions = OutputPermission.SEALED.value
    user_visible = False
    reference_only = False
    selectable = False
    rejection_reason: Optional[str] = None

    if verification_passed and draft.draft_manifest:
        candidate = from_dict(draft.draft_manifest)
        score_bundle, claim_status_report, claim_status, raw_status, output_permissions, user_visible, reference_only = _score_and_classify(parent, candidate, replay_report)
        selectable = user_visible and not reference_only and claim_status not in (
            ClaimStatus.REJECTED.value,
            ClaimStatus.COLD_STORED.value,
            ClaimStatus.VERIFIED_CLAIM.value,
        )
    else:
        failed_names = [gate.check_name for gate in gates if not gate.passed]
        rejection_reason = "Verification failed: " + ", ".join(failed_names)
        if inject_bad_expected_hash:
            rejection_reason = "Tamper detected: replay hash mismatch in check_replay."

    containment = claim_status == ClaimStatus.REJECTED.value and not user_visible
    render_permission = "blocked_until_sealed_and_echo_validated"
    if reference_only:
        render_permission = "reference_only_no_discovery_language"
    elif selectable:
        render_permission = "preview_only_no_verified_language"

    return GeneratedCandidatePreview(
        candidate_id=candidate_id,
        parent_hash=parent_hash,
        candidate_hash=generated_hash,
        draft_hash=draft.draft_hash,
        operator_id=draft.operator_id,
        theta_hash=draft.theta_hash,
        theta_k=dict(theta_k or {}),
        draft_result=draft.to_dict(),
        verification_gates=gates,
        replay_report=replay_report,
        score_bundle=score_bundle,
        claim_status_report=claim_status_report,
        claim_status=claim_status,
        raw_classifier_claim_status=raw_status,
        output_permissions=output_permissions,
        verification_passed=verification_passed,
        verification_operator_count=len(gates),
        failed_verification_count=failed_count,
        containment_preview=containment,
        user_visible=user_visible,
        selectable_preview=selectable,
        reference_only=reference_only,
        rejection_reason=rejection_reason,
        render_permission=render_permission,
    )


def build_candidate_generator_preview() -> Dict[str, Any]:
    parent = build_144hz_test_manifest()
    candidates: List[Dict[str, Any]] = []
    failed = 0
    containment = 0
    reference_only = 0
    selectable = 0

    for call in _PREVIEW_OPERATOR_CALLS:
        cand = generate_candidate_from_draft(
            parent,
            str(call["candidate_id"]),
            str(call["operator_id"]),
            call.get("theta_k", {}),
            inject_bad_expected_hash=bool(call.get("inject_bad_expected_hash", False)),
        )
        item = cand.to_dict()
        item["preview_label"] = str(call.get("label", call["operator_id"]))
        item["seals_candidates"] = False
        item["promotes_to_memory"] = False
        candidates.append(item)
        failed += 0 if cand.verification_passed else 1
        containment += 1 if cand.containment_preview else 0
        reference_only += 1 if cand.reference_only else 0
        selectable += 1 if cand.selectable_preview else 0

    best = next((c for c in candidates if c.get("candidate_id") == "cg_hypothesis_001"), None)
    return {
        "status": "OK",
        "endpoint": CANDIDATE_GENERATOR_PREVIEW_ROUTE,
        "mode": CANDIDATE_GENERATOR_MODE,
        "current_patch": CANDIDATE_GENERATOR_PATCH_ID,
        "schema_version": CANDIDATE_GENERATOR_SCHEMA_VERSION,
        "formula": CANDIDATE_GENERATOR_FORMULA,
        "preview_type": "operator_generated_candidate_set_preview",
        "parent_problem_id": parent.problem_id,
        "parent_hash": canonical_hash(parent),
        "candidate_generator_visible": True,
        "generated_candidate_count": len(candidates),
        "candidate_count": len(candidates),
        "verification_operator_count": 5,
        "failed_verification_count": failed,
        "containment_preview_count": containment,
        "reference_only_count": reference_only,
        "selectable_preview_count": selectable,
        "best_candidate_id": best.get("candidate_id") if best else None,
        "best_candidate_claim_status": best.get("claim_status") if best else None,
        "best_candidate_verified_claim": False,
        "drafts_generated_by_operator_engine": True,
        "verification_operators_applied": True,
        "candidate_hashes_stable": _prove_candidate_hash_stability(),
        "hard_gate_report_still_fixture_backed": True,
        "hard_gate_report_generated_candidate_adapter_pending": "Patch 290 gate_engine will unify generated candidates with hard_gate_report.py.",
        "live_candidate_commit_active": False,
        "candidate_sealing_active": False,
        "memory_promotion_active": False,
        "seal_route_available": False,
        "seals_candidates": False,
        "promotes_to_memory": False,
        "candidates": candidates,
        "boundary": candidate_generator_boundary(),
    }


def _prove_candidate_hash_stability() -> bool:
    parent = build_144hz_test_manifest()
    first = []
    second = []
    for call in _PREVIEW_OPERATOR_CALLS:
        first.append(generate_candidate_from_draft(parent, str(call["candidate_id"]), str(call["operator_id"]), call.get("theta_k", {}), inject_bad_expected_hash=bool(call.get("inject_bad_expected_hash", False))).candidate_hash)
        second.append(generate_candidate_from_draft(parent, str(call["candidate_id"]), str(call["operator_id"]), call.get("theta_k", {}), inject_bad_expected_hash=bool(call.get("inject_bad_expected_hash", False))).candidate_hash)
    return first == second


def build_candidate_generator_rejection_preview() -> Dict[str, Any]:
    return {
        "status": "REJECTED",
        "endpoint": CANDIDATE_GENERATOR_POST_ROUTE,
        "mode": CANDIDATE_GENERATOR_MODE,
        "current_patch": CANDIDATE_GENERATOR_PATCH_ID,
        "schema_version": CANDIDATE_GENERATOR_SCHEMA_VERSION,
        "gate_status": "REJECTED",
        "accepted": False,
        "reason_code": "approval_token_required",
        "approval_required": True,
        "expected_approval_token": CANDIDATE_GENERATOR_APPROVAL_TOKEN,
        "candidate_count": 0,
        "non_mutating": True,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "commits_live_candidates": False,
        "advances_live_manifest": False,
        "seals_candidates": False,
        "promotes_to_memory": False,
        "boundary": candidate_generator_boundary(),
    }


def build_candidate_generator_gate_preview() -> Dict[str, Any]:
    payload = build_candidate_generator_preview()
    payload.update({
        "endpoint": CANDIDATE_GENERATOR_POST_ROUTE,
        "accepted": True,
        "gate_status": "ACCEPTED_PREVIEW_ONLY",
        "commits_live_candidates": False,
        "advances_live_manifest": False,
        "seals_candidates": False,
        "promotes_to_memory": False,
    })
    return payload


def evaluate_candidate_generator_request(request: Optional[Mapping[str, Any]] = None, endpoint: str = CANDIDATE_GENERATOR_POST_ROUTE) -> Dict[str, Any]:
    req = dict(request or {})
    token = str(req.get("approval_token", "") or "")
    if token != CANDIDATE_GENERATOR_APPROVAL_TOKEN:
        rejected = build_candidate_generator_rejection_preview()
        rejected["endpoint"] = endpoint
        return rejected
    payload = build_candidate_generator_gate_preview()
    payload["endpoint"] = endpoint
    return payload


def candidate_generator_status() -> Dict[str, Any]:
    return {
        "status": "OK",
        "endpoint": CANDIDATE_GENERATOR_STATUS_ROUTE,
        "mode": CANDIDATE_GENERATOR_MODE,
        "current_patch": CANDIDATE_GENERATOR_PATCH_ID,
        "schema_version": CANDIDATE_GENERATOR_SCHEMA_VERSION,
        "formula": CANDIDATE_GENERATOR_FORMULA,
        "candidate_generator_visible": True,
        "preview_route": CANDIDATE_GENERATOR_PREVIEW_ROUTE,
        "post_route": CANDIDATE_GENERATOR_POST_ROUTE,
        "approval_required": True,
        "approval_token": CANDIDATE_GENERATOR_APPROVAL_TOKEN,
        "draft_source": "rmc_engine_v1/mea/operator_engine.py",
        "verification_operators": ["check_replay", "check_constraint", "check_proof_debt", "check_drift", "check_contradiction"],
        "generated_candidate_count": len(_PREVIEW_OPERATOR_CALLS),
        "live_candidate_commit_active": False,
        "candidate_sealing_active": False,
        "memory_promotion_active": False,
        "seal_route_available": False,
        "boundary": candidate_generator_boundary(),
    }


def candidate_generator_boundary() -> Dict[str, Any]:
    return {
        "patch": CANDIDATE_GENERATOR_PATCH_ID,
        "schema_version": CANDIDATE_GENERATOR_SCHEMA_VERSION,
        "layer": "MEA candidate generator / runtime candidate preview",
        "read_only": False,
        "non_mutating": True,
        "creates_get_routes": True,
        "creates_post_routes": True,
        "get_routes": [CANDIDATE_GENERATOR_STATUS_ROUTE, CANDIDATE_GENERATOR_PREVIEW_ROUTE],
        "post_routes": [CANDIDATE_GENERATOR_POST_ROUTE],
        "requires_approval_token": True,
        "approval_token": CANDIDATE_GENERATOR_APPROVAL_TOKEN,
        "writes_files": False,
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
        "promotes_to_memory": False,
        "renders_user_output": False,
        "mutates_existing_rmc_behavior": False,
        "mutates_launcher_behavior": False,
        "mutates_operator_console_ui": False,
        "seal_route_available": False,
        "memory_promotion_route_available": False,
        "candidate_requires_future_gate_engine": True,
    }
