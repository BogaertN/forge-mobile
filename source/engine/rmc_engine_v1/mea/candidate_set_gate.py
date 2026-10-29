"""
forge/rmc_engine_v1/mea/candidate_set_gate.py

Patch 282 — MEA Candidate Set Preview/Gate.

This module builds a deterministic, non-mutating preview set of candidate
problem-manifest evolutions. It does not select a sealed winner. It does not
persist live MEA state. It does not write files, call an LLM, use the network,
execute shell commands, seed live manifests, seal candidates, promote memory, or
render user output.

Purpose:
- expand a validated seed manifest into replayable candidate previews;
- score each candidate with the existing MEA scoring modules;
- classify each candidate structurally;
- return gate status, rejection reasons, and render limits before any future
  seal engine exists.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

from .claim_status_classifier import ClaimStatusClassification, classify_claim_status
from .convergence_scorer import score_convergence
from .goal_ancestry_scorer import score_goal_ancestry
from .information_gain_scorer import score_information_gain
from .manifest_schema import ClaimStatus, ProblemManifest, canonical_hash, from_dict, to_dict
from .operator_cost_scorer import score_operator_cost
from .proof_debt_scorer import score_proof_debt
from .replay_engine import ReplayResult, replay_candidate, replay_operator_path
from .seed_manifest_gate import (
    SEED_GATE_APPROVAL_TOKEN,
    evaluate_seed_manifest_request,
    seed_manifest_gate_boundary,
)

CANDIDATE_SET_GATE_PATCH_ID = "Patch 282 — MEA Candidate Set Preview/Gate"
CANDIDATE_SET_GATE_SCHEMA_VERSION = "mea_candidate_set_preview_gate_v1_patch282"
CANDIDATE_SET_GATE_MODE = "controlled_mea_candidate_set_preview_gate_patch282"
CANDIDATE_SET_GATE_APPROVAL_TOKEN = "APPROVE_MEA_CANDIDATE_SET_GATE"
CANDIDATE_SET_GATE_STATUS_ROUTE = "/api/mea/candidate-set-gate/status"
CANDIDATE_SET_GATE_POST_ROUTE = "/api/mea/candidate-set-gate"
CANDIDATE_SET_GATE_ALIAS_ROUTE = "/api/mea/candidate-preview-gate"
CANDIDATE_SET_PREVIEW_ROUTE = "/api/mea/candidate-set-preview"

CANDIDATE_PREVIEW_SCORE_FORMULA = (
    "PreviewScore(c_i)=clamp(0.30*I_norm + 0.25*Omega + 0.20*A + "
    "0.15*Replay + 0.10*Render - 0.20*B - 0.10*K - 0.15*D)"
)


@dataclass(frozen=True)
class CandidateOperatorCall:
    operator_id: str
    theta_k: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {"operator_id": self.operator_id, "theta_k": dict(self.theta_k)}


@dataclass(frozen=True)
class CandidatePreview:
    candidate_id: str
    parent_hash: str
    candidate_hash: Optional[str]
    operator_path: Tuple[Dict[str, Any], ...]
    candidate_manifest: Optional[Dict[str, Any]]
    replay_report: Dict[str, Any]
    score_bundle: Dict[str, Any]
    claim_status_report: Dict[str, Any]
    preview_score: float
    gate_status: str
    gate_errors: Tuple[str, ...]
    gate_warnings: Tuple[str, ...]
    rejection_reason: Optional[str]
    render_permission: str
    candidate_sealing_permitted: bool = False
    memory_promotion_permitted: bool = False
    patch_id: str = CANDIDATE_SET_GATE_PATCH_ID
    schema_version: str = CANDIDATE_SET_GATE_SCHEMA_VERSION

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _round(value: float) -> float:
    return round(float(value), 6)


def _clamp_unit(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _as_dicts(path: Sequence[CandidateOperatorCall]) -> Tuple[Dict[str, Any], ...]:
    return tuple(call.to_dict() for call in path)


def candidate_set_gate_boundary() -> Dict[str, Any]:
    return {
        "patch": CANDIDATE_SET_GATE_PATCH_ID,
        "schema_version": CANDIDATE_SET_GATE_SCHEMA_VERSION,
        "layer": "MEA candidate set preview/gate",
        "read_only": False,
        "non_mutating": True,
        "creates_get_routes": True,
        "creates_post_routes": True,
        "get_routes": [CANDIDATE_SET_GATE_STATUS_ROUTE, CANDIDATE_SET_PREVIEW_ROUTE],
        "post_routes": [CANDIDATE_SET_GATE_POST_ROUTE, CANDIDATE_SET_GATE_ALIAS_ROUTE],
        "requires_approval_token": True,
        "approval_token": CANDIDATE_SET_GATE_APPROVAL_TOKEN,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "performs_network_io": False,
        "seeds_live_manifests": False,
        "seals_candidates": False,
        "promotes_to_memory": False,
        "renders_user_output": False,
        "mutates_existing_rmc_behavior": False,
        "mutates_launcher_behavior": False,
        "mutates_operator_console_ui": False,
        "real_seal_route": "/api/mea/seal remains intentionally unavailable in Patch 282",
        "real_memory_promotion_route": "not available in Patch 282",
    }


def candidate_set_gate_status() -> Dict[str, Any]:
    return {
        "status": "OK",
        "endpoint": CANDIDATE_SET_GATE_STATUS_ROUTE,
        "mode": CANDIDATE_SET_GATE_MODE,
        "current_patch": CANDIDATE_SET_GATE_PATCH_ID,
        "schema_version": CANDIDATE_SET_GATE_SCHEMA_VERSION,
        "gate_visible": True,
        "preview_route": CANDIDATE_SET_PREVIEW_ROUTE,
        "post_route": CANDIDATE_SET_GATE_POST_ROUTE,
        "alias_route": CANDIDATE_SET_GATE_ALIAS_ROUTE,
        "approval_required": True,
        "approval_token": CANDIDATE_SET_GATE_APPROVAL_TOKEN,
        "seed_gate_token_required_for_seed_validation": SEED_GATE_APPROVAL_TOKEN,
        "live_candidate_commit_active": False,
        "candidate_sealing_active": False,
        "memory_promotion_active": False,
        "preview_score_formula": CANDIDATE_PREVIEW_SCORE_FORMULA,
        "candidate_fields": [
            "candidate_id",
            "parent_hash",
            "candidate_hash",
            "operator_path",
            "score_bundle",
            "replay_report",
            "claim_status_report",
            "gate_status",
            "rejection_reason",
            "render_permission",
        ],
        "boundary": candidate_set_gate_boundary(),
    }


def _extract_seed_manifest_from_gate(seed_gate_result: Mapping[str, Any]) -> Optional[ProblemManifest]:
    manifest_dict = seed_gate_result.get("seed_manifest_preview")
    if not isinstance(manifest_dict, Mapping):
        return None
    return from_dict(dict(manifest_dict))


def _seed_gate_for_request(request: Mapping[str, Any]) -> Mapping[str, Any]:
    seed_payload = request.get("seed_request")
    if not isinstance(seed_payload, Mapping):
        seed_payload = {
            "approval_token": SEED_GATE_APPROVAL_TOKEN,
            "use_fixture": bool(request.get("use_fixture", True)),
            "source": request.get("source") or "canonical_144hz_test_fixture",
        }
        if isinstance(request.get("manifest"), Mapping):
            seed_payload = {
                "approval_token": SEED_GATE_APPROVAL_TOKEN,
                "manifest": dict(request["manifest"]),
                "source": request.get("source") or "request_manifest",
            }
        if isinstance(request.get("problem_manifest"), Mapping):
            seed_payload = {
                "approval_token": SEED_GATE_APPROVAL_TOKEN,
                "problem_manifest": dict(request["problem_manifest"]),
                "source": request.get("source") or "request_manifest",
            }
    else:
        seed_payload = dict(seed_payload)
        seed_payload.setdefault("approval_token", SEED_GATE_APPROVAL_TOKEN)
    return evaluate_seed_manifest_request(seed_payload)


def _default_operator_paths(seed: ProblemManifest) -> Tuple[Tuple[str, Tuple[CandidateOperatorCall, ...], str], ...]:
    first_unknown = seed.unknowns[0] if seed.unknowns else ""
    return (
        (
            "c_recall_001",
            (CandidateOperatorCall("noop_recall", {}),),
            "baseline recall/reference; included to prove I(c_i)=0 cannot be discovery",
        ),
        (
            "c_hypothesis_001",
            (
                CandidateOperatorCall(
                    "hypothesize",
                    {
                        "hypothesis_id": "harmonic_from_90hz",
                        "hypothesis_text": "144 Hz is a harmonic hypothesis derived from 90 Hz via the golden ratio relation.",
                        "confidence": 0.35,
                    },
                ),
                CandidateOperatorCall(
                    "derive",
                    {
                        "derived_fact": "144 Hz is a harmonic hypothesis derived from 90 Hz via golden ratio relation, not direct myelin measurement.",
                        "resolves_unknown": "Whether 144 Hz is a substrate frequency or derived harmonic.",
                        "proof_debt_delta": 0.15,
                    },
                ),
            ),
            "adds a bounded hypothesis plus a derivation note; still hypothesis, not verified claim",
        ),
        (
            "c_branch_derive_001",
            (
                CandidateOperatorCall(
                    "branch",
                    {
                        "branch_label": "substrate-vs-harmonic",
                        "branch_goal": seed.goal,
                        "branch_unknown": "Which published substrate, if any, lawfully supports a 144 Hz derivation?",
                    },
                ),
                CandidateOperatorCall(
                    "hypothesize",
                    {
                        "hypothesis_id": "harmonic_from_90hz",
                        "hypothesis_text": "144 Hz is a harmonic hypothesis derived from 90 Hz via the golden ratio relation.",
                        "confidence": 0.35,
                    },
                ),
                CandidateOperatorCall(
                    "derive",
                    {
                        "derived_fact": "144 Hz remains hypothesis-bound until direct measurement or a sealed derivation chain exists.",
                        "resolves_unknown": first_unknown,
                        "proof_debt_delta": 0.05,
                    },
                ),
            ),
            "multi-step replay path; useful progress but still not a verified empirical claim",
        ),
        (
            "c_rejected_tamper_001",
            (
                CandidateOperatorCall(
                    "hypothesize",
                    {
                        "hypothesis_id": "harmonic_from_90hz",
                        "hypothesis_text": "144 Hz is already empirically verified in myelin.",
                        "confidence": 0.35,
                    },
                ),
            ),
            "intentional tamper/replay-mismatch proof; must be rejected and not user-visible",
        ),
    )


def _path_result(seed: ProblemManifest, path: Tuple[CandidateOperatorCall, ...]) -> Tuple[Mapping[str, Any], Optional[ProblemManifest]]:
    calls = _as_dicts(path)
    preview = replay_operator_path(seed, calls)
    expected_hash = preview.produced_final_hash
    confirmed = replay_operator_path(seed, calls, expected_final_hash=expected_hash) if expected_hash else preview
    final_dict = confirmed.final_manifest if confirmed.final_manifest else preview.final_manifest
    final_manifest = from_dict(final_dict) if isinstance(final_dict, Mapping) else None
    return confirmed.to_dict(), final_manifest


def _single_replay_result(seed: ProblemManifest, call: CandidateOperatorCall, *, force_expected_hash: Optional[str] = None) -> Tuple[Mapping[str, Any], Optional[ProblemManifest]]:
    preview = replay_candidate(seed, call.operator_id, call.theta_k)
    expected = force_expected_hash if force_expected_hash is not None else preview.produced_candidate_hash
    confirmed = replay_candidate(seed, call.operator_id, call.theta_k, expected_candidate_hash=expected) if expected else preview
    final_manifest = from_dict(confirmed.candidate_manifest) if isinstance(confirmed.candidate_manifest, Mapping) else None
    return confirmed.to_dict(), final_manifest


def _score_bundle(parent: ProblemManifest, candidate: ProblemManifest, operator_path: Tuple[Dict[str, Any], ...]) -> Dict[str, Any]:
    proof = score_proof_debt(candidate)
    info = score_information_gain(parent, candidate)
    conv = score_convergence(parent, candidate)
    ancestry = score_goal_ancestry(parent, candidate)
    cost = score_operator_cost(tuple({"operator_id": item["operator_id"]} for item in operator_path))
    drift_score = _round(candidate.drift_state.total)
    return {
        "proof_debt": proof.to_dict(),
        "information_gain": info.to_dict(),
        "convergence": conv.to_dict(),
        "goal_ancestry": ancestry.to_dict(),
        "operator_cost": cost.to_dict(),
        "drift_score": drift_score,
        "score_formula": CANDIDATE_PREVIEW_SCORE_FORMULA,
    }


def _preview_score(score_bundle: Mapping[str, Any], classification: Mapping[str, Any], replay_report: Mapping[str, Any]) -> float:
    info = float(score_bundle["information_gain"].get("information_gain", 0.0))
    info_norm = _clamp_unit(info / 2.0)
    omega = _clamp_unit(float(score_bundle["convergence"].get("omega", score_bundle["convergence"].get("convergence", 0.0))))
    ancestry = _clamp_unit(float(score_bundle["goal_ancestry"].get("goal_ancestry", 0.0)))
    proof = _clamp_unit(float(score_bundle["proof_debt"].get("proof_debt", 1.0)))
    cost = _clamp_unit(float(score_bundle["operator_cost"].get("operator_cost", 1.0)))
    drift = _clamp_unit(float(score_bundle.get("drift_score", 0.0)))
    replay = 1.0 if replay_report.get("replay_confirmed") else 0.0
    render = 1.0 if classification.get("user_visible") else 0.0
    raw = (0.30 * info_norm) + (0.25 * omega) + (0.20 * ancestry) + (0.15 * replay) + (0.10 * render) - (0.20 * proof) - (0.10 * cost) - (0.15 * drift)
    return _round(_clamp_unit(raw))


def _candidate_gate_status(classification: Mapping[str, Any], replay_report: Mapping[str, Any], info_gain: float) -> Tuple[str, Tuple[str, ...], Tuple[str, ...], Optional[str]]:
    status = str(classification.get("claim_status") or ClaimStatus.UNCLASSIFIED.value)
    errors: List[str] = []
    warnings: List[str] = []

    if not replay_report.get("replay_confirmed"):
        errors.append("replay not confirmed; candidate cannot pass preview gate")
    if replay_report.get("tamper_detected"):
        errors.append("tamper detected by replay hash mismatch")
    if status == ClaimStatus.REJECTED.value:
        errors.append("claim status classifier rejected the candidate")
    if status == ClaimStatus.VERIFIED_CLAIM.value:
        errors.append("Patch 282 candidate preview cannot promote verified_claim")
    if status == ClaimStatus.RECALL.value:
        warnings.append("candidate is recall/reference only; not a discovery candidate")
    if info_gain <= 0.0 and status != ClaimStatus.RECALL.value:
        errors.append("non-recall candidate has no information gain")
    if status == ClaimStatus.HYPOTHESIS.value:
        warnings.append("hypothesis may render only as hypothesis/testable prediction, not verified fact")

    if errors:
        return "REJECTED", tuple(errors), tuple(warnings), errors[0]
    if status == ClaimStatus.RECALL.value:
        return "REFERENCE_ONLY", tuple(errors), tuple(warnings), "recall cannot be selected as discovery"
    return "ACCEPTED_PREVIEW_ONLY", tuple(errors), tuple(warnings), None


def _build_candidate(parent: ProblemManifest, candidate_id: str, path: Tuple[CandidateOperatorCall, ...], rationale: str, *, tamper_expected_hash: Optional[str] = None) -> CandidatePreview:
    operator_path = _as_dicts(path)
    if len(path) == 1:
        replay_report, candidate = _single_replay_result(parent, path[0], force_expected_hash=tamper_expected_hash)
    else:
        replay_report, candidate = _path_result(parent, path)
    if candidate is None:
        classification = classify_claim_status(parent, parent, replay_result=replay_report)
        score_bundle = _score_bundle(parent, parent, operator_path)
        score_bundle["candidate_rationale"] = rationale
        gate_status, gate_errors, gate_warnings, rejection_reason = _candidate_gate_status(classification.to_dict(), replay_report, 0.0)
        return CandidatePreview(
            candidate_id=candidate_id,
            parent_hash=canonical_hash(parent),
            candidate_hash=None,
            operator_path=operator_path,
            candidate_manifest=None,
            replay_report=dict(replay_report),
            score_bundle=score_bundle,
            claim_status_report=classification.to_dict(),
            preview_score=0.0,
            gate_status=gate_status,
            gate_errors=gate_errors,
            gate_warnings=gate_warnings,
            rejection_reason=rejection_reason,
            render_permission=classification.output_permissions,
        )

    score_bundle = _score_bundle(parent, candidate, operator_path)
    score_bundle["candidate_rationale"] = rationale
    classification = classify_claim_status(
        parent,
        candidate,
        replay_result=replay_report,
        proof_debt_score=score_proof_debt(candidate),
        information_gain_score=score_information_gain(parent, candidate),
        convergence_score=score_convergence(parent, candidate),
    )
    info_gain = float(score_bundle["information_gain"].get("information_gain", 0.0))
    gate_status, gate_errors, gate_warnings, rejection_reason = _candidate_gate_status(classification.to_dict(), replay_report, info_gain)
    return CandidatePreview(
        candidate_id=candidate_id,
        parent_hash=canonical_hash(parent),
        candidate_hash=canonical_hash(candidate),
        operator_path=operator_path,
        candidate_manifest=to_dict(candidate),
        replay_report=dict(replay_report),
        score_bundle=score_bundle,
        claim_status_report=classification.to_dict(),
        preview_score=_preview_score(score_bundle, classification.to_dict(), replay_report),
        gate_status=gate_status,
        gate_errors=gate_errors,
        gate_warnings=gate_warnings,
        rejection_reason=rejection_reason,
        render_permission=classification.output_permissions,
    )


def build_candidate_set_preview(seed_manifest: Optional[ProblemManifest] = None) -> Dict[str, Any]:
    """Build the canonical non-mutating candidate set preview."""

    parent = seed_manifest or from_dict(evaluate_seed_manifest_request({"approval_token": SEED_GATE_APPROVAL_TOKEN, "use_fixture": True})["seed_manifest_preview"])
    paths = _default_operator_paths(parent)

    good_hypothesis_call = CandidateOperatorCall(
        "hypothesize",
        {
            "hypothesis_id": "harmonic_from_90hz",
            "hypothesis_text": "144 Hz is a harmonic hypothesis derived from 90 Hz via the golden ratio relation.",
            "confidence": 0.35,
        },
    )
    good_preview = replay_candidate(parent, good_hypothesis_call.operator_id, good_hypothesis_call.theta_k)
    tamper_expected_hash = good_preview.produced_candidate_hash

    candidates: List[CandidatePreview] = []
    for candidate_id, path, rationale in paths:
        if candidate_id == "c_rejected_tamper_001":
            candidates.append(_build_candidate(parent, candidate_id, path, rationale, tamper_expected_hash=tamper_expected_hash))
        else:
            candidates.append(_build_candidate(parent, candidate_id, path, rationale))

    candidate_dicts = [c.to_dict() for c in candidates]
    accepted = [c for c in candidates if c.gate_status == "ACCEPTED_PREVIEW_ONLY"]
    rejected = [c for c in candidates if c.gate_status == "REJECTED"]
    reference = [c for c in candidates if c.gate_status == "REFERENCE_ONLY"]
    best = max(accepted, key=lambda c: c.preview_score, default=None)

    return {
        "status": "OK",
        "endpoint": CANDIDATE_SET_PREVIEW_ROUTE,
        "mode": CANDIDATE_SET_GATE_MODE,
        "current_patch": CANDIDATE_SET_GATE_PATCH_ID,
        "schema_version": CANDIDATE_SET_GATE_SCHEMA_VERSION,
        "preview_type": "candidate_set",
        "parent_hash": canonical_hash(parent),
        "problem_id": parent.problem_id,
        "candidate_count": len(candidates),
        "accepted_preview_count": len(accepted),
        "rejected_count": len(rejected),
        "reference_only_count": len(reference),
        "best_candidate_id": best.candidate_id if best else None,
        "best_candidate_hash": best.candidate_hash if best else None,
        "best_candidate_claim_status": best.claim_status_report.get("claim_status") if best else None,
        "candidate_sealing_active": False,
        "memory_promotion_active": False,
        "live_candidate_commit_active": False,
        "score_formula": CANDIDATE_PREVIEW_SCORE_FORMULA,
        "candidates": candidate_dicts,
        "hard_laws": {
            "candidate_generator_does_not_approve_itself": True,
            "replay_confirmed_is_required_but_not_verification": True,
            "hypothesis_not_verified_claim": True,
            "recall_not_discovery": True,
            "rejected_not_user_visible": True,
            "no_seal_in_patch_282": True,
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
        "seals_candidates": False,
        "promotes_to_memory": False,
        "renders_user_output": False,
        "boundary": candidate_set_gate_boundary(),
    }


def evaluate_candidate_set_request(request: Optional[Mapping[str, Any]]) -> Dict[str, Any]:
    """Validate approval and return a candidate-set preview without mutation."""

    req = request if isinstance(request, Mapping) else {}
    supplied_token = str(req.get("approval_token") or req.get("approval") or "")
    if supplied_token != CANDIDATE_SET_GATE_APPROVAL_TOKEN:
        return {
            "status": "REJECTED",
            "endpoint": CANDIDATE_SET_GATE_POST_ROUTE,
            "mode": CANDIDATE_SET_GATE_MODE,
            "current_patch": CANDIDATE_SET_GATE_PATCH_ID,
            "schema_version": CANDIDATE_SET_GATE_SCHEMA_VERSION,
            "gate_status": "REJECTED",
            "accepted": False,
            "reason_code": "approval_token_required",
            "approval_required": True,
            "approval_token_name": "approval_token",
            "expected_approval_token": CANDIDATE_SET_GATE_APPROVAL_TOKEN,
            "gate_errors": ["missing or invalid approval_token for controlled MEA candidate set gate"],
            "candidate_count": 0,
            "non_mutating": True,
            "writes_files": False,
            "writes_memory": False,
            "writes_chroma": False,
            "writes_identity_vault": False,
            "calls_llm": False,
            "executes_shell": False,
            "seeds_live_manifests": False,
            "seals_candidates": False,
            "promotes_to_memory": False,
            "boundary": candidate_set_gate_boundary(),
        }

    seed_gate = _seed_gate_for_request(req)
    if not seed_gate.get("accepted"):
        return {
            "status": "REJECTED",
            "endpoint": CANDIDATE_SET_GATE_POST_ROUTE,
            "mode": CANDIDATE_SET_GATE_MODE,
            "current_patch": CANDIDATE_SET_GATE_PATCH_ID,
            "schema_version": CANDIDATE_SET_GATE_SCHEMA_VERSION,
            "gate_status": "REJECTED",
            "accepted": False,
            "reason_code": "seed_manifest_gate_failed",
            "seed_gate_result": dict(seed_gate),
            "candidate_count": 0,
            "non_mutating": True,
            "writes_files": False,
            "writes_memory": False,
            "writes_chroma": False,
            "writes_identity_vault": False,
            "calls_llm": False,
            "executes_shell": False,
            "seeds_live_manifests": False,
            "seals_candidates": False,
            "promotes_to_memory": False,
            "boundary": candidate_set_gate_boundary(),
        }

    seed_manifest = _extract_seed_manifest_from_gate(seed_gate)
    if seed_manifest is None:
        return {
            "status": "REJECTED",
            "endpoint": CANDIDATE_SET_GATE_POST_ROUTE,
            "mode": CANDIDATE_SET_GATE_MODE,
            "current_patch": CANDIDATE_SET_GATE_PATCH_ID,
            "schema_version": CANDIDATE_SET_GATE_SCHEMA_VERSION,
            "gate_status": "REJECTED",
            "accepted": False,
            "reason_code": "seed_manifest_unavailable_after_gate",
            "candidate_count": 0,
            "boundary": candidate_set_gate_boundary(),
        }

    preview = build_candidate_set_preview(seed_manifest)
    preview.update(
        {
            "endpoint": CANDIDATE_SET_GATE_POST_ROUTE,
            "gate_status": "ACCEPTED_PREVIEW_ONLY",
            "accepted": True,
            "approval_required": True,
            "approval_token_name": "approval_token",
            "expected_approval_token": CANDIDATE_SET_GATE_APPROVAL_TOKEN,
            "seed_gate_result": dict(seed_gate),
        }
    )
    return preview


def build_candidate_set_gate_preview() -> Dict[str, Any]:
    return evaluate_candidate_set_request({"approval_token": CANDIDATE_SET_GATE_APPROVAL_TOKEN, "use_fixture": True})


def build_candidate_set_gate_rejection_preview() -> Dict[str, Any]:
    return evaluate_candidate_set_request({"use_fixture": True})
