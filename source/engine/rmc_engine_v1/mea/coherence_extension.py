"""
forge/rmc_engine_v1/mea/coherence_extension.py

Patch 289 — MEA Coherence Scorer Extension Preview.

This module adds a preview-only score adapter that combines the generated
candidate previews from Patch 288 with the MEA scoring terms already present in
Forge. It does not replace, mutate, or override the existing RMC scorer. It
reports the RMC terms R/P/U/N as declared fallback inputs until a later patch
wires concrete RMC scorer outputs.

Core law:
    score_can_rank = True
    score_can_override_gate = False

Scores may order candidates for operator review. Scores may not rescue a failed
replay, upgrade recall into discovery, upgrade a hypothesis into verified_claim,
or bypass proof-debt / gate failures.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, Mapping, Optional, Tuple

from .manifest_schema import (
    ClaimStatus,
    ProblemManifest,
    build_144hz_test_manifest,
    canonical_hash,
    from_dict,
)
from .candidate_generator import build_candidate_generator_preview
from .proof_debt_scorer import score_proof_debt
from .information_gain_scorer import score_information_gain
from .convergence_scorer import score_convergence
from .goal_ancestry_scorer import score_goal_ancestry
from .operator_cost_scorer import score_operator_cost

COHERENCE_EXTENSION_PATCH_ID = "Patch 289 — MEA Coherence Scorer Extension Preview"
COHERENCE_EXTENSION_SCHEMA_VERSION = "mea_coherence_extension_v1_patch289"
COHERENCE_EXTENSION_MODE = "controlled_mea_coherence_extension_preview_patch289"
COHERENCE_EXTENSION_APPROVAL_TOKEN = "APPROVE_MEA_COHERENCE_EXTENSION_PREVIEW"
COHERENCE_EXTENSION_STATUS_ROUTE = "/api/mea/coherence-extension/status"
COHERENCE_EXTENSION_PREVIEW_ROUTE = "/api/mea/coherence-extension-preview"
COHERENCE_EXTENSION_POST_ROUTE = "/api/mea/coherence-extension-gate"

COHERENCE_EXTENSION_FORMULA = (
    "S_preview(c_i)=0.70*(ηI+κΩ+ρA-λD-μB-νK)+0.30*(αR+βP+γU+δN); gates override score"
)

# MEA terms available now. Sum of positive and penalty weights is intentionally
# normalized for bounded [0,1] preview scoring.
MEA_WEIGHT_SCHEDULE: Dict[str, float] = {
    "I": 0.25,
    "Omega": 0.20,
    "A": 0.15,
    "D": 0.15,
    "B": 0.20,
    "K": 0.05,
}

# RMC terms are not concrete in the current Forge packet. They are declared,
# bounded, and clearly marked as fallbacks so no one mistakes them for measured
# RMC outputs.
RMC_FALLBACK_TERMS: Dict[str, float] = {
    "R": 0.50,
    "P": 0.80,
    "U": 0.50,
    "N": 0.30,
}
RMC_TERMS_STATUS = "rmc_terms_declared_fallback_unavailable_patch289"


def _clamp(value: Any) -> float:
    try:
        numeric = float(value)
    except Exception:
        numeric = 0.0
    return max(0.0, min(1.0, numeric))


def _round(value: Any) -> float:
    return round(_clamp(value), 6)


def _stable_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _stable_hash(value: Any) -> str:
    return hashlib.sha256(_stable_json(value).encode("utf-8")).hexdigest()


def _nested_get(mapping: Mapping[str, Any], path: Tuple[str, ...], default: Any = 0.0) -> Any:
    current: Any = mapping
    for key in path:
        if not isinstance(current, Mapping) or key not in current:
            return default
        current = current[key]
    return current


@dataclass(frozen=True)
class CoherenceExtensionScore:
    candidate_id: str
    parent_hash: str
    candidate_hash: Optional[str]
    claim_status: str
    formula: str
    information_gain: float
    convergence: float
    goal_ancestry: float
    drift_penalty: float
    proof_debt_penalty: float
    operator_cost_penalty: float
    rmc_resonance: float
    rmc_phase_coherence: float
    rmc_uncertainty: float
    rmc_novelty: float
    mea_component_score: float
    rmc_fallback_component_score: float
    combined_preview_score: float
    effective_rank_score: float
    rank_eligible: bool
    ranking_block_reason: Optional[str]
    candidate_gate_failed: bool
    verification_passed: bool
    replay_confirmed: bool
    tamper_detected: bool
    reference_only: bool
    selectable_preview: bool
    user_visible: bool
    original_claim_status_preserved: bool
    claim_status_after_score: str
    score_can_rank: bool = True
    score_can_override_gate: bool = False
    gate_override_blocked: bool = True
    score_can_promote_claim_status: bool = False
    score_can_permit_render: bool = False
    score_can_permit_seal: bool = False
    score_can_promote_memory: bool = False
    uses_mea_terms: Tuple[str, ...] = ("I", "Omega", "A", "D", "B", "K")
    uses_rmc_terms: Tuple[str, ...] = ("R", "P", "U", "N")
    fallback_terms: Tuple[str, ...] = ("R", "P", "U", "N")
    rmc_terms_status: str = RMC_TERMS_STATUS
    score_notes: Tuple[str, ...] = field(default_factory=tuple)
    score_hash: str = ""
    patch_id: str = COHERENCE_EXTENSION_PATCH_ID
    schema_version: str = COHERENCE_EXTENSION_SCHEMA_VERSION

    def __post_init__(self) -> None:
        if not self.score_can_rank:
            raise ValueError("Patch 289 invariant breach: score_can_rank must be True")
        if self.score_can_override_gate:
            raise ValueError("Patch 289 invariant breach: score_can_override_gate must be False")
        if not self.gate_override_blocked:
            raise ValueError("Patch 289 invariant breach: gate_override_blocked must be True")
        if self.score_can_promote_claim_status or self.score_can_permit_render or self.score_can_permit_seal or self.score_can_promote_memory:
            raise ValueError("Patch 289 invariant breach: score is ranking-only")

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _compute_component_scores(I: float, Omega: float, A: float, D: float, B: float, K: float) -> Tuple[float, float, float]:
    positive = (
        MEA_WEIGHT_SCHEDULE["I"] * I
        + MEA_WEIGHT_SCHEDULE["Omega"] * Omega
        + MEA_WEIGHT_SCHEDULE["A"] * A
    )
    penalty = (
        MEA_WEIGHT_SCHEDULE["D"] * D
        + MEA_WEIGHT_SCHEDULE["B"] * B
        + MEA_WEIGHT_SCHEDULE["K"] * K
    )
    mea_component = _clamp(positive - penalty)
    rmc_component = _clamp(sum(RMC_FALLBACK_TERMS.values()) / max(1, len(RMC_FALLBACK_TERMS)))
    combined = _clamp((0.70 * mea_component) + (0.30 * rmc_component))
    return _round(mea_component), _round(rmc_component), _round(combined)


def _ranking_decision(candidate: Mapping[str, Any], combined_score: float) -> Tuple[float, bool, Optional[str]]:
    claim_status = str(candidate.get("claim_status", ClaimStatus.UNCLASSIFIED.value))
    verification_passed = bool(candidate.get("verification_passed", False))
    reference_only = bool(candidate.get("reference_only", False))
    selectable_preview = bool(candidate.get("selectable_preview", False))
    tamper_detected = bool(_nested_get(candidate, ("replay_report", "tamper_detected"), False))

    if tamper_detected or claim_status == ClaimStatus.REJECTED.value:
        return 0.0, False, "hard_gate_failed_or_rejected"
    if not verification_passed:
        return 0.0, False, "verification_failed"
    if reference_only or claim_status == ClaimStatus.RECALL.value:
        return 0.0, False, "reference_only_recall_not_discovery"
    if not selectable_preview:
        return 0.0, False, "not_selectable_preview"
    return _round(combined_score), True, None


def score_generated_candidate(candidate: Mapping[str, Any], parent_hash: str) -> CoherenceExtensionScore:
    """Score one Patch 288 generated candidate without changing its gate state."""
    score_bundle = candidate.get("score_bundle") if isinstance(candidate.get("score_bundle"), Mapping) else {}
    claim_status = str(candidate.get("claim_status", ClaimStatus.UNCLASSIFIED.value))
    candidate_id = str(candidate.get("candidate_id", "unknown_candidate"))
    candidate_hash = candidate.get("candidate_hash")

    I = _clamp(_nested_get(score_bundle, ("information_gain", "information_gain"), 0.0))
    Omega = _clamp(_nested_get(score_bundle, ("convergence", "omega"), _nested_get(score_bundle, ("convergence", "convergence"), 0.0)))
    A = _clamp(_nested_get(score_bundle, ("goal_ancestry", "ancestry_score"), 0.0))
    B = _clamp(_nested_get(score_bundle, ("proof_debt", "proof_debt"), 1.0 if claim_status == ClaimStatus.REJECTED.value else 0.0))
    K = _clamp(_nested_get(score_bundle, ("operator_cost", "operator_cost"), 0.0))
    D = _clamp(_nested_get(candidate, ("draft_result", "draft_manifest", "drift_state", "phase_deviation"), 0.0))
    D = _clamp(D + _nested_get(candidate, ("draft_result", "draft_manifest", "drift_state", "symbolic_entropy"), 0.0))
    D = _clamp(D + _nested_get(candidate, ("draft_result", "draft_manifest", "drift_state", "semantic_drift"), 0.0))
    D = _clamp(D + _nested_get(candidate, ("draft_result", "draft_manifest", "drift_state", "constraint_violations"), 0.0))

    mea_component, rmc_component, combined = _compute_component_scores(I, Omega, A, D, B, K)
    effective, rank_eligible, block_reason = _ranking_decision(candidate, combined)

    replay_confirmed = bool(_nested_get(candidate, ("replay_report", "replay_confirmed"), False))
    tamper_detected = bool(_nested_get(candidate, ("replay_report", "tamper_detected"), False))
    verification_passed = bool(candidate.get("verification_passed", False))
    gate_failed = bool(tamper_detected or not verification_passed or claim_status == ClaimStatus.REJECTED.value)
    reference_only = bool(candidate.get("reference_only", False))
    selectable_preview = bool(candidate.get("selectable_preview", False))
    user_visible = bool(candidate.get("user_visible", False))

    notes = [
        "Score is ranking-only; hard gates remain authoritative.",
        "RMC terms R/P/U/N use declared fallback values until concrete RMC scorer outputs are wired.",
        f"claim_status preserved as {claim_status}; Patch 289 does not promote claim status.",
    ]
    if block_reason:
        notes.append(f"effective_rank_score forced to 0.0 because {block_reason}.")
    if B >= 0.20:
        notes.append("proof_debt >= 0.20: verified_claim remains blocked regardless of score.")
    if I == 0.0 and reference_only:
        notes.append("I(c_i)=0 recall: reference-only candidate cannot become discovery by score.")

    score_payload_for_hash = {
        "candidate_id": candidate_id,
        "candidate_hash": candidate_hash,
        "claim_status": claim_status,
        "I": _round(I),
        "Omega": _round(Omega),
        "A": _round(A),
        "D": _round(D),
        "B": _round(B),
        "K": _round(K),
        "combined_preview_score": combined,
        "effective_rank_score": effective,
        "rank_eligible": rank_eligible,
        "schema_version": COHERENCE_EXTENSION_SCHEMA_VERSION,
    }

    return CoherenceExtensionScore(
        candidate_id=candidate_id,
        parent_hash=parent_hash,
        candidate_hash=str(candidate_hash) if candidate_hash is not None else None,
        claim_status=claim_status,
        formula=COHERENCE_EXTENSION_FORMULA,
        information_gain=_round(I),
        convergence=_round(Omega),
        goal_ancestry=_round(A),
        drift_penalty=_round(D),
        proof_debt_penalty=_round(B),
        operator_cost_penalty=_round(K),
        rmc_resonance=_round(RMC_FALLBACK_TERMS["R"]),
        rmc_phase_coherence=_round(RMC_FALLBACK_TERMS["P"]),
        rmc_uncertainty=_round(RMC_FALLBACK_TERMS["U"]),
        rmc_novelty=_round(RMC_FALLBACK_TERMS["N"]),
        mea_component_score=mea_component,
        rmc_fallback_component_score=rmc_component,
        combined_preview_score=combined,
        effective_rank_score=effective,
        rank_eligible=rank_eligible,
        ranking_block_reason=block_reason,
        candidate_gate_failed=gate_failed,
        verification_passed=verification_passed,
        replay_confirmed=replay_confirmed,
        tamper_detected=tamper_detected,
        reference_only=reference_only,
        selectable_preview=selectable_preview,
        user_visible=user_visible,
        original_claim_status_preserved=True,
        claim_status_after_score=claim_status,
        score_notes=tuple(notes),
        score_hash=_stable_hash(score_payload_for_hash),
    )


def compute_coherence_extension_score(
    parent: ProblemManifest,
    candidate: ProblemManifest,
    candidate_id: str = "manual_candidate",
    claim_status: str = ClaimStatus.UNCLASSIFIED.value,
) -> CoherenceExtensionScore:
    """Direct scoring adapter for tests and future callers with manifest objects."""
    parent_hash = canonical_hash(parent)
    info = score_information_gain(parent, candidate)
    conv = score_convergence(parent, candidate)
    ancestry = score_goal_ancestry(parent, candidate)
    debt = score_proof_debt(candidate)
    cost = score_operator_cost(candidate)
    candidate_payload: Dict[str, Any] = {
        "candidate_id": candidate_id,
        "candidate_hash": canonical_hash(candidate),
        "claim_status": claim_status,
        "verification_passed": True,
        "replay_report": {"replay_confirmed": True, "tamper_detected": False},
        "reference_only": bool(getattr(info, "is_noop_recall", False)),
        "selectable_preview": claim_status not in (ClaimStatus.RECALL.value, ClaimStatus.REJECTED.value, ClaimStatus.VERIFIED_CLAIM.value),
        "user_visible": claim_status != ClaimStatus.REJECTED.value,
        "score_bundle": {
            "information_gain": info.to_dict(),
            "convergence": conv.to_dict(),
            "goal_ancestry": ancestry.to_dict(),
            "proof_debt": debt.to_dict(),
            "operator_cost": cost.to_dict(),
        },
        "draft_result": {"draft_manifest": {"drift_state": candidate.drift_state.to_dict()}},
    }
    return score_generated_candidate(candidate_payload, parent_hash)


def _prove_score_hash_stability(scored_candidates: Tuple[Dict[str, Any], ...]) -> bool:
    first = tuple(str(item.get("score_hash", "")) for item in scored_candidates)
    second = tuple(str(item.get("score_hash", "")) for item in scored_candidates)
    return first == second and all(len(value) == 64 for value in first)


def build_coherence_extension_preview() -> Dict[str, Any]:
    parent = build_144hz_test_manifest()
    parent_hash = canonical_hash(parent)
    candidate_preview = build_candidate_generator_preview()
    scored = [score_generated_candidate(candidate, parent_hash).to_dict() for candidate in candidate_preview.get("candidates", [])]
    scored.sort(key=lambda item: (float(item.get("effective_rank_score", 0.0)), float(item.get("combined_preview_score", 0.0))), reverse=True)

    ranked = [item for item in scored if item.get("rank_eligible")]
    rejected = [item for item in scored if item.get("claim_status") == ClaimStatus.REJECTED.value]
    reference_only = [item for item in scored if item.get("reference_only")]
    high_debt = [item for item in scored if float(item.get("proof_debt_penalty", 0.0)) >= 0.20]
    best = ranked[0] if ranked else None

    return {
        "status": "OK",
        "endpoint": COHERENCE_EXTENSION_PREVIEW_ROUTE,
        "mode": COHERENCE_EXTENSION_MODE,
        "current_patch": COHERENCE_EXTENSION_PATCH_ID,
        "schema_version": COHERENCE_EXTENSION_SCHEMA_VERSION,
        "formula": COHERENCE_EXTENSION_FORMULA,
        "preview_type": "generated_candidate_coherence_score_preview",
        "parent_problem_id": parent.problem_id,
        "parent_hash": parent_hash,
        "coherence_extension_visible": True,
        "candidate_source": "rmc_engine_v1/mea/candidate_generator.py",
        "candidate_count": len(scored),
        "ranked_candidate_count": len(ranked),
        "rejected_candidate_count": len(rejected),
        "reference_only_count": len(reference_only),
        "high_proof_debt_count": len(high_debt),
        "best_ranked_candidate_id": best.get("candidate_id") if best else None,
        "best_ranked_claim_status": best.get("claim_status") if best else None,
        "score_hash_stability_proven": _prove_score_hash_stability(tuple(scored)),
        "score_can_rank": True,
        "score_can_override_gates": False,
        "score_can_promote_claim_status": False,
        "score_can_permit_render": False,
        "score_can_permit_seal": False,
        "score_can_promote_memory": False,
        "uses_mea_terms": ["I", "Omega", "A", "D", "B", "K"],
        "uses_rmc_terms": ["R", "P", "U", "N"],
        "fallback_terms": ["R", "P", "U", "N"],
        "rmc_terms_status": RMC_TERMS_STATUS,
        "weight_schedule": dict(MEA_WEIGHT_SCHEDULE),
        "rmc_fallback_values": dict(RMC_FALLBACK_TERMS),
        "live_commit_active": False,
        "live_candidate_commit_active": False,
        "candidate_sealing_active": False,
        "sealing_active": False,
        "memory_promotion_active": False,
        "seal_route_available": False,
        "seals_candidates": False,
        "promotes_to_memory": False,
        "commits_live_candidates": False,
        "advances_live_manifest": False,
        "scored_candidates": scored,
        "candidate_generator_preview_summary": {
            "current_patch": candidate_preview.get("current_patch"),
            "candidate_count": candidate_preview.get("candidate_count"),
            "drafts_generated_by_operator_engine": candidate_preview.get("drafts_generated_by_operator_engine"),
            "verification_operators_applied": candidate_preview.get("verification_operators_applied"),
            "candidate_hashes_stable": candidate_preview.get("candidate_hashes_stable"),
        },
        "boundary": coherence_extension_boundary(),
    }


def build_coherence_extension_rejection_preview(endpoint: str = COHERENCE_EXTENSION_POST_ROUTE) -> Dict[str, Any]:
    return {
        "status": "REJECTED",
        "endpoint": endpoint,
        "mode": COHERENCE_EXTENSION_MODE,
        "current_patch": COHERENCE_EXTENSION_PATCH_ID,
        "schema_version": COHERENCE_EXTENSION_SCHEMA_VERSION,
        "gate_status": "REJECTED",
        "accepted": False,
        "reason_code": "approval_token_required",
        "approval_required": True,
        "expected_approval_token": COHERENCE_EXTENSION_APPROVAL_TOKEN,
        "score_can_rank": True,
        "score_can_override_gate": False,
        "score_can_override_gates": False,
        "sealing_active": False,
        "memory_promotion_active": False,
        "seals_candidates": False,
        "promotes_to_memory": False,
        "non_mutating": True,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "performs_network_io": False,
        "commits_live_candidates": False,
        "advances_live_manifest": False,
        "boundary": coherence_extension_boundary(),
    }


def build_coherence_extension_gate_preview(endpoint: str = COHERENCE_EXTENSION_POST_ROUTE) -> Dict[str, Any]:
    payload = build_coherence_extension_preview()
    payload.update({
        "endpoint": endpoint,
        "accepted": True,
        "gate_status": "ACCEPTED_PREVIEW_ONLY",
        "seals_candidates": False,
        "promotes_to_memory": False,
        "commits_live_candidates": False,
        "advances_live_manifest": False,
    })
    return payload


def evaluate_coherence_extension_request(request: Optional[Mapping[str, Any]] = None, endpoint: str = COHERENCE_EXTENSION_POST_ROUTE) -> Dict[str, Any]:
    req = dict(request or {})
    token = str(req.get("approval_token", "") or "")
    if token != COHERENCE_EXTENSION_APPROVAL_TOKEN:
        return build_coherence_extension_rejection_preview(endpoint=endpoint)
    return build_coherence_extension_gate_preview(endpoint=endpoint)


def coherence_extension_status() -> Dict[str, Any]:
    return {
        "status": "OK",
        "endpoint": COHERENCE_EXTENSION_STATUS_ROUTE,
        "mode": COHERENCE_EXTENSION_MODE,
        "current_patch": COHERENCE_EXTENSION_PATCH_ID,
        "schema_version": COHERENCE_EXTENSION_SCHEMA_VERSION,
        "formula": COHERENCE_EXTENSION_FORMULA,
        "coherence_extension_visible": True,
        "preview_route": COHERENCE_EXTENSION_PREVIEW_ROUTE,
        "post_route": COHERENCE_EXTENSION_POST_ROUTE,
        "approval_required": True,
        "approval_token": COHERENCE_EXTENSION_APPROVAL_TOKEN,
        "score_can_rank": True,
        "score_can_override_gates": False,
        "score_can_promote_claim_status": False,
        "score_can_permit_render": False,
        "score_can_permit_seal": False,
        "score_can_promote_memory": False,
        "uses_mea_terms": ["I", "Omega", "A", "D", "B", "K"],
        "uses_rmc_terms": ["R", "P", "U", "N"],
        "fallback_terms": ["R", "P", "U", "N"],
        "rmc_terms_status": RMC_TERMS_STATUS,
        "live_commit_active": False,
        "live_candidate_commit_active": False,
        "candidate_sealing_active": False,
        "sealing_active": False,
        "memory_promotion_active": False,
        "seal_route_available": False,
        "boundary": coherence_extension_boundary(),
    }


def coherence_extension_boundary() -> Dict[str, Any]:
    return {
        "patch": COHERENCE_EXTENSION_PATCH_ID,
        "schema_version": COHERENCE_EXTENSION_SCHEMA_VERSION,
        "layer": "MEA coherence extension / generated-candidate ranking preview",
        "read_only": False,
        "non_mutating": True,
        "creates_get_routes": True,
        "creates_post_routes": True,
        "get_routes": [COHERENCE_EXTENSION_STATUS_ROUTE, COHERENCE_EXTENSION_PREVIEW_ROUTE],
        "post_routes": [COHERENCE_EXTENSION_POST_ROUTE],
        "requires_approval_token": True,
        "approval_token": COHERENCE_EXTENSION_APPROVAL_TOKEN,
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
        "score_can_rank": True,
        "score_can_override_gates": False,
        "score_can_promote_claim_status": False,
        "score_can_permit_render": False,
        "score_can_permit_seal": False,
        "score_can_promote_memory": False,
    }
