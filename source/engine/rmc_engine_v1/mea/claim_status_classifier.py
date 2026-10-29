"""
forge/rmc_engine_v1/mea/claim_status_classifier.py

Patch 279 — MEA Claim Status Classifier.

Assigns MEA ClaimStatus values structurally from replay, proof debt,
information gain, convergence, drift, and gate evidence. This module does not
seal candidates, render output, write memory, call an LLM, query Chroma, touch
Identity Vault, execute shell commands, or create routes.

Core law from MEA:
- recall must not render as discovery
- hypothesis must not render as verified_claim
- rejected candidates must not be user-visible
- replay confirmation alone is not verification
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Dict, Mapping, Optional, Tuple, Union

from .manifest_schema import ClaimStatus, CandidateManifest, OutputPermission, ProblemManifest, canonical_hash
from .proof_debt_scorer import ProofDebtScore, score_proof_debt
from .information_gain_scorer import InformationGainScore, score_information_gain
from .convergence_scorer import ConvergenceScore, score_convergence

CLAIM_STATUS_CLASSIFIER_PATCH_ID = "Patch 279 — MEA Claim Status Classifier"
CLAIM_STATUS_CLASSIFIER_SCHEMA_VERSION = "mea_claim_status_classification_v1_patch279"
CLAIM_STATUS_CLASSIFIER_FORMULA = "ClaimStatus(c*) = f(B, I, Replay, Omega, D, gates)"

DEFAULT_DRIFT_THRESHOLD = 0.35
DRIFT_NEAR_THRESHOLD_RATIO = 0.85
VERIFIED_PROOF_DEBT_THRESHOLD = 0.20
DERIVED_PROOF_DEBT_THRESHOLD = 0.40
HYPOTHESIS_PROOF_DEBT_MIN = 0.40
HYPOTHESIS_PROOF_DEBT_MAX = 0.70
COLD_STORAGE_PROOF_DEBT_THRESHOLD = 0.70
COLD_STORAGE_CONVERGENCE_THRESHOLD = 0.10
PARTIAL_RESOLUTION_MIN = 0.30
PARTIAL_RESOLUTION_MAX = 0.90
RESOLVED_CONVERGENCE_THRESHOLD = 0.90


_STATUS_RULES: Dict[str, Dict[str, Any]] = {
    ClaimStatus.RECALL.value: {
        "can_render_as": ("memory retrieval", "reference", "citation"),
        "cannot_render_as": ("discovery", "new claim", "hypothesis"),
        "user_visible": True,
    },
    ClaimStatus.VERIFIED_CLAIM.value: {
        "can_render_as": ("accepted claim", "fact", "implementation target"),
        "cannot_render_as": ("tentative", "qualified"),
        "user_visible": True,
    },
    ClaimStatus.DERIVED_CLAIM.value: {
        "can_render_as": ("claim with derivation note",),
        "cannot_render_as": ("empirical fact without derivation basis",),
        "user_visible": True,
    },
    ClaimStatus.HYPOTHESIS.value: {
        "can_render_as": ("hypothesis", "proposed model", "testable prediction"),
        "cannot_render_as": ("verified fact", "confirmed finding"),
        "user_visible": True,
    },
    ClaimStatus.SPECULATIVE_BRANCH.value: {
        "can_render_as": ("speculation note", "requires further investigation"),
        "cannot_render_as": ("claim", "hypothesis", "finding"),
        "user_visible": True,
    },
    ClaimStatus.CONTRADICTION_EXPOSED.value: {
        "can_render_as": ("contradiction report", "conflict notice"),
        "cannot_render_as": ("resolution",),
        "user_visible": True,
    },
    ClaimStatus.TEST_REQUIRED.value: {
        "can_render_as": ("test specification", "experiment proposal"),
        "cannot_render_as": ("claim", "finding"),
        "user_visible": True,
    },
    ClaimStatus.REJECTED.value: {
        "can_render_as": ("internal log only",),
        "cannot_render_as": ("any user output",),
        "user_visible": False,
    },
    ClaimStatus.COLD_STORED.value: {
        "can_render_as": ("archived for future resurrection",),
        "cannot_render_as": ("active claim", "working hypothesis"),
        "user_visible": True,
    },
    ClaimStatus.NAMED_CONCEPT.value: {
        "can_render_as": ("named term", "defined concept in lexicon"),
        "cannot_render_as": ("proven theorem without verification",),
        "user_visible": True,
    },
    ClaimStatus.PARTIAL_RESOLUTION.value: {
        "can_render_as": ("progress note", "partial finding"),
        "cannot_render_as": ("full resolution", "verified claim"),
        "user_visible": True,
    },
    ClaimStatus.RESOLVED_MANIFEST.value: {
        "can_render_as": ("resolved manifest", "closed problem state"),
        "cannot_render_as": ("open hypothesis", "speculative branch"),
        "user_visible": True,
    },
    ClaimStatus.UNCLASSIFIED.value: {
        "can_render_as": ("internal inspection only",),
        "cannot_render_as": ("user-facing claim",),
        "user_visible": False,
    },
}


def _candidate_state(candidate_or_manifest: Union[CandidateManifest, ProblemManifest]) -> ProblemManifest:
    if isinstance(candidate_or_manifest, ProblemManifest):
        return candidate_or_manifest
    if isinstance(candidate_or_manifest, CandidateManifest):
        if candidate_or_manifest.proposed_state is None:
            raise ValueError("CandidateManifest requires proposed_state for claim status classification")
        return candidate_or_manifest.proposed_state
    raise TypeError("classify_claim_status expects CandidateManifest or ProblemManifest as candidate")


def _clamp_unit(value: float) -> float:
    if isinstance(value, bool):
        raise TypeError("unit value must be numeric, not bool")
    return max(0.0, min(1.0, float(value)))


def _round(value: float) -> float:
    return round(float(value), 6)


def _safe_get(obj: Any, name: str, default: Any = None) -> Any:
    if obj is None:
        return default
    if isinstance(obj, Mapping):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _replay_confirmed(replay_result: Optional[Any]) -> bool:
    if replay_result is None:
        return False
    return bool(_safe_get(replay_result, "replay_confirmed", False))


def _replay_failed(replay_result: Optional[Any]) -> bool:
    if replay_result is None:
        return True
    confirmed = _replay_confirmed(replay_result)
    errors = _safe_get(replay_result, "errors", ()) or ()
    tamper = bool(_safe_get(replay_result, "tamper_detected", False))
    return bool((not confirmed) or errors or tamper)


def _gate_failed(gate_results: Optional[Mapping[str, Any]]) -> bool:
    if not gate_results:
        return False
    for key, value in gate_results.items():
        key_text = str(key).lower()
        if key_text.endswith("_pass") or key_text.endswith("_passed") or key_text in {"replay", "phase", "drift", "proof_debt", "information_gain", "convergence"}:
            if value is False:
                return True
        if key_text.endswith("_failed") and value is True:
            return True
    return False


def _normalised_operator_ids(candidate: ProblemManifest, replay_result: Optional[Any]) -> Tuple[str, ...]:
    ids = []
    for trace in candidate.operator_history:
        op_id = str(getattr(trace, "operator_id", "") or "").strip()
        if op_id:
            ids.append(op_id)
    op_id = str(_safe_get(replay_result, "operator_id", "") or "").strip()
    if op_id:
        ids.append(op_id)
    return tuple(ids)


def _has_derivation_basis(candidate: ProblemManifest, replay_result: Optional[Any], logically_derived: bool) -> bool:
    if logically_derived:
        return True
    if candidate.claim_status == ClaimStatus.DERIVED_CLAIM.value:
        return True
    return "derive" in _normalised_operator_ids(candidate, replay_result)


def _has_named_basis(candidate: ProblemManifest, named: bool) -> bool:
    if named:
        return True
    if candidate.claim_status == ClaimStatus.NAMED_CONCEPT.value:
        return True
    joined = " ".join(candidate.goal_ancestry + candidate.known_facts).lower()
    return "naming:" in joined or "named concept" in joined


def _requires_test(candidate: ProblemManifest, requires_test: bool) -> bool:
    if requires_test:
        return True
    if candidate.claim_status == ClaimStatus.TEST_REQUIRED.value:
        return True
    text = " ".join(candidate.unknowns + candidate.constraints + candidate.success_conditions).lower()
    if "experiment proposal" in text or "test specification" in text:
        return True
    return False


def _contradiction_exposed(info_score: InformationGainScore, candidate: ProblemManifest, contradiction_exposed: bool) -> bool:
    if contradiction_exposed:
        return True
    if candidate.claim_status == ClaimStatus.CONTRADICTION_EXPOSED.value:
        return True
    return float(getattr(info_score, "delta_x", 0.0)) > 0.0


def _status_rule(status: str) -> Dict[str, Any]:
    return _STATUS_RULES.get(status, _STATUS_RULES[ClaimStatus.UNCLASSIFIED.value])


@dataclass(frozen=True)
class ClaimStatusClassification:
    problem_id: str
    parent_hash: str
    candidate_hash: str
    formula: str
    claim_status: str
    previous_claim_status: str
    output_permissions: str
    user_visible: bool
    render_as: Tuple[str, ...]
    cannot_render_as: Tuple[str, ...]
    replay_confirmed: bool
    replay_required: bool
    proof_debt: float
    information_gain: float
    convergence: float
    drift_score: float
    drift_threshold: float
    gate_failed: bool
    phase_validity: bool
    reason_code: str
    score_notes: Tuple[str, ...] = field(default_factory=tuple)
    patch_id: str = CLAIM_STATUS_CLASSIFIER_PATCH_ID
    schema_version: str = CLAIM_STATUS_CLASSIFIER_SCHEMA_VERSION

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class ClaimStatusThresholds:
    verified_proof_debt_threshold: float = VERIFIED_PROOF_DEBT_THRESHOLD
    derived_proof_debt_threshold: float = DERIVED_PROOF_DEBT_THRESHOLD
    hypothesis_proof_debt_min: float = HYPOTHESIS_PROOF_DEBT_MIN
    hypothesis_proof_debt_max: float = HYPOTHESIS_PROOF_DEBT_MAX
    cold_storage_proof_debt_threshold: float = COLD_STORAGE_PROOF_DEBT_THRESHOLD
    cold_storage_convergence_threshold: float = COLD_STORAGE_CONVERGENCE_THRESHOLD
    partial_resolution_min: float = PARTIAL_RESOLUTION_MIN
    partial_resolution_max: float = PARTIAL_RESOLUTION_MAX
    resolved_convergence_threshold: float = RESOLVED_CONVERGENCE_THRESHOLD
    drift_threshold: float = DEFAULT_DRIFT_THRESHOLD

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def classifier_boundary() -> Dict[str, Any]:
    return {
        "patch": CLAIM_STATUS_CLASSIFIER_PATCH_ID,
        "layer": "MEA candidate evolution / claim status classifier",
        "read_only": True,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "creates_post_routes": False,
        "seeds_live_manifests": False,
        "seals_candidates": False,
        "promotes_to_memory": False,
        "renders_user_output": False,
        "mutates_existing_rmc_behavior": False,
    }


def classify_claim_status(
    parent_manifest: ProblemManifest,
    candidate_or_manifest: Union[CandidateManifest, ProblemManifest],
    *,
    replay_result: Optional[Any] = None,
    proof_debt_score: Optional[ProofDebtScore] = None,
    information_gain_score: Optional[InformationGainScore] = None,
    convergence_score: Optional[ConvergenceScore] = None,
    gate_results: Optional[Mapping[str, Any]] = None,
    drift_threshold: float = DEFAULT_DRIFT_THRESHOLD,
    phase_validity: bool = True,
    logically_derived: bool = False,
    named: bool = False,
    requires_test: bool = False,
    empirical_test_available: bool = False,
    contradiction_exposed: bool = False,
) -> ClaimStatusClassification:
    """Assign a structural MEA ClaimStatus without side effects.

    The classifier assumes the caller is passing a replay result from Patch 278.
    If replay is absent or failed, the candidate is rejected. This is intentional:
    replay confirmation is necessary for any user-visible status other than an
    internal rejection record.
    """

    if not isinstance(parent_manifest, ProblemManifest):
        raise TypeError("parent_manifest must be ProblemManifest")
    candidate = _candidate_state(candidate_or_manifest)

    proof_score = proof_debt_score or score_proof_debt(candidate)
    info_score = information_gain_score or score_information_gain(parent_manifest, candidate)
    conv_score = convergence_score or score_convergence(parent_manifest, candidate)

    proof_debt = _round(_clamp_unit(float(proof_score.proof_debt)))
    information_gain = _round(max(0.0, float(info_score.information_gain)))
    convergence = _round(_clamp_unit(float(_safe_get(conv_score, "convergence", _safe_get(conv_score, "omega", 0.0)))))
    drift_score = _round(_clamp_unit(float(candidate.drift_state.total)))
    replay_ok = _replay_confirmed(replay_result)
    replay_bad = _replay_failed(replay_result)
    gates_bad = _gate_failed(gate_results)
    drift_bad = drift_score > _clamp_unit(drift_threshold)
    drift_near = drift_score >= _clamp_unit(drift_threshold) * DRIFT_NEAR_THRESHOLD_RATIO

    notes = []
    reason_code = "unclassified"
    status = ClaimStatus.UNCLASSIFIED.value

    if replay_bad or gates_bad or drift_bad or not phase_validity:
        status = ClaimStatus.REJECTED.value
        reason_code = "failed_gate_or_replay"
        if replay_bad:
            notes.append("Rejected: replay missing, failed, or tamper-detected.")
        if gates_bad:
            notes.append("Rejected: one or more supplied gate results failed.")
        if drift_bad:
            notes.append("Rejected: drift score exceeds theta_D threshold.")
        if not phase_validity:
            notes.append("Rejected: phase validity is false.")
    elif information_gain == 0.0:
        status = ClaimStatus.RECALL.value
        reason_code = "zero_information_gain_recall"
        notes.append("I(c_i)=0: classify as recall/reference, not discovery.")
    elif _contradiction_exposed(info_score, candidate, contradiction_exposed):
        status = ClaimStatus.CONTRADICTION_EXPOSED.value
        reason_code = "delta_x_positive"
        notes.append("delta-X > 0 or contradiction flag present: contradiction exposed, not resolved.")
    elif proof_debt > COLD_STORAGE_PROOF_DEBT_THRESHOLD and convergence <= COLD_STORAGE_CONVERGENCE_THRESHOLD:
        status = ClaimStatus.COLD_STORED.value
        reason_code = "high_debt_low_convergence"
        notes.append("High proof debt with near-zero convergence: route as cold-stored, not active claim.")
    elif convergence >= RESOLVED_CONVERGENCE_THRESHOLD and proof_debt < VERIFIED_PROOF_DEBT_THRESHOLD and not candidate.unknowns:
        status = ClaimStatus.RESOLVED_MANIFEST.value
        reason_code = "resolved_manifest_thresholds_met"
        notes.append("Convergence and proof debt thresholds support resolved manifest status.")
    elif proof_debt < VERIFIED_PROOF_DEBT_THRESHOLD and convergence > 0.0 and not drift_near:
        status = ClaimStatus.VERIFIED_CLAIM.value
        reason_code = "verified_thresholds_met"
        notes.append("B(c_i)<0.2, I>0, replay pass, Omega>0, and drift within bounds.")
    elif proof_debt < DERIVED_PROOF_DEBT_THRESHOLD and _has_derivation_basis(candidate, replay_result, logically_derived):
        status = ClaimStatus.DERIVED_CLAIM.value
        reason_code = "derived_thresholds_met"
        notes.append("B(c_i)<0.4 with derivation basis: render only with derivation note.")
    elif _has_named_basis(candidate, named) and proof_debt < 0.5:
        status = ClaimStatus.NAMED_CONCEPT.value
        reason_code = "named_concept_stabilized"
        notes.append("Naming basis present with B(c_i)<0.5: named concept, not theorem.")
    elif _requires_test(candidate, requires_test) and (not empirical_test_available) and proof_debt > 0.5 and convergence > 0.0:
        status = ClaimStatus.TEST_REQUIRED.value
        reason_code = "test_required"
        notes.append("Test flag present with B(c_i)>0.5 and Omega>0: experiment/test required before claim.")
    elif HYPOTHESIS_PROOF_DEBT_MIN <= proof_debt <= HYPOTHESIS_PROOF_DEBT_MAX:
        status = ClaimStatus.HYPOTHESIS.value
        reason_code = "hypothesis_thresholds_met"
        notes.append("B(c_i) in hypothesis band with I>0 and replay pass: hypothesis, not verified claim.")
    elif proof_debt > COLD_STORAGE_PROOF_DEBT_THRESHOLD or drift_near:
        status = ClaimStatus.SPECULATIVE_BRANCH.value
        reason_code = "speculative_or_near_drift_threshold"
        notes.append("High proof debt or near-threshold drift: speculation only, not claim or hypothesis.")
    elif PARTIAL_RESOLUTION_MIN < convergence < PARTIAL_RESOLUTION_MAX:
        status = ClaimStatus.PARTIAL_RESOLUTION.value
        reason_code = "partial_resolution_thresholds_met"
        notes.append("Some success-condition convergence exists, but not enough for full resolution.")
    else:
        status = ClaimStatus.TEST_REQUIRED.value
        reason_code = "default_test_required"
        notes.append("Candidate advanced the manifest but lacks enough structure for a stronger status.")

    rule = _status_rule(status)
    if status == ClaimStatus.REJECTED.value:
        output_permission = OutputPermission.SEALED.value
    elif status in {ClaimStatus.RECALL.value, ClaimStatus.VERIFIED_CLAIM.value, ClaimStatus.DERIVED_CLAIM.value, ClaimStatus.HYPOTHESIS.value, ClaimStatus.CONTRADICTION_EXPOSED.value, ClaimStatus.TEST_REQUIRED.value, ClaimStatus.NAMED_CONCEPT.value, ClaimStatus.PARTIAL_RESOLUTION.value, ClaimStatus.RESOLVED_MANIFEST.value}:
        output_permission = OutputPermission.RENDER_ALLOWED.value
    else:
        output_permission = OutputPermission.PROJECTION_ONLY.value

    if status == ClaimStatus.HYPOTHESIS.value:
        notes.append("Hard render law: hypothesis cannot render as verified_claim.")
    if status == ClaimStatus.RECALL.value:
        notes.append("Hard render law: recall cannot render as discovery.")
    if status == ClaimStatus.REJECTED.value:
        notes.append("Hard render law: rejected candidate is not user-visible.")

    return ClaimStatusClassification(
        problem_id=candidate.problem_id or parent_manifest.problem_id,
        parent_hash=canonical_hash(parent_manifest),
        candidate_hash=canonical_hash(candidate),
        formula=CLAIM_STATUS_CLASSIFIER_FORMULA,
        claim_status=status,
        previous_claim_status=candidate.claim_status,
        output_permissions=output_permission,
        user_visible=bool(rule.get("user_visible", False)),
        render_as=tuple(rule.get("can_render_as", ())),
        cannot_render_as=tuple(rule.get("cannot_render_as", ())),
        replay_confirmed=replay_ok,
        replay_required=True,
        proof_debt=proof_debt,
        information_gain=information_gain,
        convergence=convergence,
        drift_score=drift_score,
        drift_threshold=_round(_clamp_unit(drift_threshold)),
        gate_failed=bool(gates_bad or replay_bad or drift_bad or not phase_validity),
        phase_validity=bool(phase_validity),
        reason_code=reason_code,
        score_notes=tuple(notes),
    )


def classify_replay_result(
    parent_manifest: ProblemManifest,
    replay_result: Any,
    *,
    gate_results: Optional[Mapping[str, Any]] = None,
    **kwargs: Any,
) -> ClaimStatusClassification:
    """Classify the candidate_manifest embedded in a Patch 278 ReplayResult."""

    candidate_dict = _safe_get(replay_result, "candidate_manifest", None)
    if candidate_dict is None:
        # Construct a minimal rejected mirror from parent when replay did not produce a candidate.
        return classify_claim_status(
            parent_manifest,
            parent_manifest,
            replay_result=replay_result,
            gate_results=gate_results,
            **kwargs,
        )
    from .manifest_schema import from_dict

    candidate = from_dict(candidate_dict)
    return classify_claim_status(
        parent_manifest,
        candidate,
        replay_result=replay_result,
        gate_results=gate_results,
        **kwargs,
    )


def claim_status_taxonomy() -> Dict[str, Any]:
    return {
        "patch_id": CLAIM_STATUS_CLASSIFIER_PATCH_ID,
        "schema_version": CLAIM_STATUS_CLASSIFIER_SCHEMA_VERSION,
        "formula": CLAIM_STATUS_CLASSIFIER_FORMULA,
        "thresholds": ClaimStatusThresholds().to_dict(),
        "statuses": {key: {"can_render_as": list(value["can_render_as"]), "cannot_render_as": list(value["cannot_render_as"]), "user_visible": value["user_visible"]} for key, value in _STATUS_RULES.items()},
        "hard_laws": {
            "replay_confirmed_is_not_verified_claim": True,
            "hypothesis_must_not_render_as_verified_claim": True,
            "recall_must_not_render_as_discovery": True,
            "rejected_candidate_not_user_visible": True,
        },
        "boundary": classifier_boundary(),
    }
