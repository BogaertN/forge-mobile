"""
forge/rmc_engine_v1/mea/math_conformance.py

MEA-DISCOVERY-KERNEL-MATH-CONFORMANCE-BUILD-006
Deterministic mathematical conformance layer for the Forge Discovery Kernel.

This layer does not rewrite the historic Patch 275-299 corridor or the Build
005 JSONL memory record. It installs the forward mathematical contract and
runs it against the canonical 144 Hz anti-confabulation case.

Key corrections implemented:
1. Seal-critical scoring uses integer micro-units, never new binary floats.
2. Information gain notation is I(c_i) = ΔF + ΔQ + ΔX.
   ΔF means verified fact gain; K remains operator cost only.
3. epistemic_claim_status is distinct from required_next_action.
   The 144 Hz path is `hypothesis` with `test_required`, not an upgraded fact.
4. Evidence tiers enforce that internal ancestry is not empirical proof.
5. Replay proves deterministic reproducibility, not scientific truth.
6. FBSC Manifest Algebra bindings are explicit through the crosswalk module.
7. The legacy preview path is audited, not silently overwritten.

No writes, no memory mutation, no API route, no UI action, no rendering,
no LLM, no Chroma, no Identity Vault, no Contribution Economy operation.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path
import json
from typing import Any, Dict, Mapping, Tuple

from .fixed_point_math_contract import (
    ALL_TERMS,
    BUILD_ID,
    SCHEMA_VERSION as FIXED_POINT_SCHEMA_VERSION,
    UNIT_SCALE,
    ScoringMode,
    canonical_hash,
    legacy_float_to_micro,
    require_unit_micro,
    score_terms_fixed_point,
)
from .evidence_tier_contract import (
    EvidenceAssessment,
    canonical_144hz_hypothesis_evidence,
)
from .fbsc_operator_crosswalk import crosswalk_report
from .manifest_schema import build_144hz_test_manifest, canonical_hash as legacy_manifest_hash
from .candidate_generator import build_candidate_generator_preview
from .coherence_extension import build_coherence_extension_preview
from rmc_engine_v1.measurement_kernel import measure_candidate, coherence_components

SCHEMA_VERSION = "mea_math_conformance_report_v1_build006"
FORMULA = "Score(c_i)=αR+βP+γU+δN+ηI+κOmega+ρA-λD-μB-νK"
INFORMATION_GAIN_FORMULA = "I(c_i)=ΔF+ΔQ+ΔX; ΔF=verified_fact_gain; K=operator_cost_only"

THETA_D_MICRO = 350_000
THETA_P_MICRO = 700_000
THETA_B_HYPOTHESIS_MICRO = 700_000
THETA_B_DERIVED_MICRO = 400_000
THETA_B_VERIFIED_MICRO = 200_000

CANONICAL_PROBLEM_ID = "144hz_substrate_status"
CANONICAL_CANDIDATE_ID = "cg_hypothesis_001"
CANONICAL_LEGACY_MEMORY_RECORD_HASH = "c7961e88d1ae7c718662b4d8541c18948c63c3d2b374c9e95b7ee9338338fc99"


@dataclass(frozen=True)
class InformationGainFixedPoint:
    delta_f_verified_fact_gain_micro: int
    delta_q_unknown_reduction_micro: int
    delta_x_contradiction_resolution_micro: int
    information_gain_micro: int
    interpretation: str

    def __post_init__(self) -> None:
        for name in (
            "delta_f_verified_fact_gain_micro",
            "delta_q_unknown_reduction_micro",
            "delta_x_contradiction_resolution_micro",
        ):
            require_unit_micro(name, getattr(self, name))
        expected = min(
            UNIT_SCALE,
            self.delta_f_verified_fact_gain_micro
            + self.delta_q_unknown_reduction_micro
            + self.delta_x_contradiction_resolution_micro,
        )
        if self.information_gain_micro != expected:
            raise ValueError("information_gain_micro must equal bounded ΔF + ΔQ + ΔX")
        require_unit_micro("information_gain_micro", self.information_gain_micro)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class CandidateObservations:
    candidate_id: str
    term_values_micro: Dict[str, int]
    term_provenance: Dict[str, str]
    information_gain: InformationGainFixedPoint
    replay_confirmed: bool
    replay_hash_mutated: bool
    empirical_test_available: bool
    requested_claim_tier: str
    required_next_action_basis: str

    def __post_init__(self) -> None:
        if set(self.term_values_micro) != set(ALL_TERMS):
            raise ValueError("term_values_micro must contain the complete MEA term vector")
        for term, value in self.term_values_micro.items():
            require_unit_micro(term, value)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["information_gain"] = self.information_gain.to_dict()
        return data


@dataclass(frozen=True)
class GateDecision:
    gate_name: str
    passed: bool
    observed_micro: int | None
    threshold_micro: int | None
    detail: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class ConformanceResult:
    candidate_id: str
    epistemic_claim_status: str
    required_next_action: str
    verified_empirical_claim_permitted: bool
    replay_proves_reproducibility_only: bool
    score_result: Dict[str, Any]
    evidence_assessment: Dict[str, Any]
    gate_vector: Tuple[Dict[str, Any], ...]
    all_required_hypothesis_gates_passed: bool
    prohibited_upgrades: Tuple[str, ...]
    report_hash: str
    schema_version: str = SCHEMA_VERSION
    build_id: str = BUILD_ID

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _gate(name: str, passed: bool, observed: int | None, threshold: int | None, detail: str) -> GateDecision:
    return GateDecision(name, bool(passed), observed, threshold, detail)


def information_gain_fixed_point(
    *,
    delta_f_verified_fact_gain_micro: int,
    delta_q_unknown_reduction_micro: int,
    delta_x_contradiction_resolution_micro: int,
    interpretation: str,
) -> InformationGainFixedPoint:
    gain = min(
        UNIT_SCALE,
        require_unit_micro("delta_f_verified_fact_gain_micro", delta_f_verified_fact_gain_micro)
        + require_unit_micro("delta_q_unknown_reduction_micro", delta_q_unknown_reduction_micro)
        + require_unit_micro("delta_x_contradiction_resolution_micro", delta_x_contradiction_resolution_micro),
    )
    return InformationGainFixedPoint(
        delta_f_verified_fact_gain_micro=delta_f_verified_fact_gain_micro,
        delta_q_unknown_reduction_micro=delta_q_unknown_reduction_micro,
        delta_x_contradiction_resolution_micro=delta_x_contradiction_resolution_micro,
        information_gain_micro=gain,
        interpretation=interpretation,
    )


def _operator_cost_micro(operator_path: Tuple[str, ...]) -> int:
    """Governed integer cost schedule for the canonical conformance path."""
    schedule = {
        "branch": 80_000,
        "hypothesize": 120_000,
        "check_evidence": 20_000,
        "check_proof_debt": 20_000,
        "check_phase": 10_000,
        "check_drift": 10_000,
        "check_replay": 20_000,
    }
    return min(UNIT_SCALE, sum(schedule.get(operator, 100_000) for operator in operator_path))


def canonical_144hz_observations() -> Tuple[CandidateObservations, EvidenceAssessment]:
    """Create the deterministic conformance input for the paper's first test.

    The observations do not rewrite the historical sealed manifest. They
    formalize the next forward-compatible evaluation of the same bounded
    hypothesis under the corrected contract.
    """
    evidence = canonical_144hz_hypothesis_evidence()
    info = information_gain_fixed_point(
        delta_f_verified_fact_gain_micro=0,
        delta_q_unknown_reduction_micro=UNIT_SCALE,
        delta_x_contradiction_resolution_micro=0,
        interpretation=(
            "One binary uncertainty is lawfully narrowed from substrate-vs-harmonic "
            "into a test-required harmonic derivation path; no verified fact is added."
        ),
    )
    operator_path = (
        "branch",
        "hypothesize",
        "check_evidence",
        "check_proof_debt",
        "check_phase",
        "check_drift",
        "check_replay",
    )
    terms = {
        "R": evidence.aggregate_support_micro,
        "P": 880_000,
        "U": 400_000,
        "N": 500_000,
        "I": info.information_gain_micro,
        "Omega": 400_000,
        "A": UNIT_SCALE,
        "D": 120_000,
        "B": evidence.proof_debt_micro,
        "K": _operator_cost_micro(operator_path),
    }
    provenance = {
        "R": "Evidence-tier resonance: internal trace and theory ancestry support only.",
        "P": "Canonical 144 Hz test observation: phase validity P=0.88 passes θP=0.70.",
        "U": "Bounded utility: the hypothesis creates a testable next inquiry without asserting truth.",
        "N": "Bounded novelty: a new hypothesis branch exists while constraints remain preserved.",
        "I": "Corrected information gain: ΔF=0, ΔQ=1, ΔX=0.",
        "Omega": "Canonical 144 Hz test observation: partial convergence Ω=0.4.",
        "A": "Goal ancestry retained: the candidate remains on the original epistemic-status goal.",
        "D": "Canonical 144 Hz test observation: drift risk D=0.12.",
        "B": "Evidence assessment: support=0.45, therefore proof debt B=0.55.",
        "K": "Integer operator-cost schedule applied to the declared verified operator path.",
    }
    return CandidateObservations(
        candidate_id=CANONICAL_CANDIDATE_ID,
        term_values_micro=terms,
        term_provenance=provenance,
        information_gain=info,
        replay_confirmed=True,
        replay_hash_mutated=False,
        empirical_test_available=False,
        requested_claim_tier="hypothesis",
        required_next_action_basis="No independent empirical myelin-specific 144 Hz measurement is present.",
    ), evidence


def evaluate_conformance_candidate(
    observations: CandidateObservations,
    evidence: EvidenceAssessment,
) -> ConformanceResult:
    """Run deterministic score, gates, and non-upgrade classification."""
    if observations.term_values_micro["B"] != evidence.proof_debt_micro:
        raise ValueError("Candidate B term must equal evidence-assessment proof debt")
    score = score_terms_fixed_point(observations.term_values_micro, mode=ScoringMode.RESEARCH_SYNTHESIS.value)
    terms = observations.term_values_micro
    replay_ok = observations.replay_confirmed and not observations.replay_hash_mutated
    gates = (
        _gate("replay_gate", replay_ok, None, None, "Replay confirms deterministic reproduction only; it does not prove scientific truth."),
        _gate("drift_gate", terms["D"] <= THETA_D_MICRO, terms["D"], THETA_D_MICRO, "Drift must remain within the hard threshold."),
        _gate("phase_gate", terms["P"] >= THETA_P_MICRO, terms["P"], THETA_P_MICRO, "Phase validity must meet the hard threshold."),
        _gate("information_gain_discovery_gate", terms["I"] > 0, terms["I"], 1, "A discovery-path review requires positive information gain."),
        _gate("convergence_gate", terms["Omega"] > 0, terms["Omega"], 1, "A forward hypothesis path must converge toward a success condition."),
        _gate("hypothesis_proof_debt_gate", terms["B"] <= THETA_B_HYPOTHESIS_MICRO, terms["B"], THETA_B_HYPOTHESIS_MICRO, "Proof debt is permitted for hypothesis tier only."),
        _gate("verified_claim_proof_debt_gate", terms["B"] < THETA_B_VERIFIED_MICRO and evidence.verified_empirical_claim_permitted, terms["B"], THETA_B_VERIFIED_MICRO, "Verified empirical claim additionally requires qualifying external empirical authority."),
    )
    required_hypothesis = tuple(gates[:6])
    hypothesis_ok = all(item.passed for item in required_hypothesis)
    if not replay_ok:
        status = "rejected"
        next_action = "contain_or_reject"
    elif terms["I"] == 0:
        status = "recall"
        next_action = "reference_only"
    elif hypothesis_ok:
        status = "hypothesis"
        next_action = "test_required" if not observations.empirical_test_available else "evidence_review"
    else:
        status = "speculative_branch"
        next_action = "additional_evidence_required"

    body = {
        "candidate_id": observations.candidate_id,
        "epistemic_claim_status": status,
        "required_next_action": next_action,
        "verified_empirical_claim_permitted": bool(evidence.verified_empirical_claim_permitted and gates[-1].passed),
        "replay_proves_reproducibility_only": True,
        "score_result": score.to_dict(),
        "evidence_assessment": evidence.to_dict(),
        "gate_vector": tuple(gate.to_dict() for gate in gates),
        "all_required_hypothesis_gates_passed": hypothesis_ok,
        "prohibited_upgrades": (
            "hypothesis_to_verified_claim_without_qualifying_external_empirical_evidence",
            "replay_pass_to_scientific_truth",
            "internal_ancestry_to_empirical_measurement",
            "test_required_to_resolved_manifest_without_test",
        ),
        "schema_version": SCHEMA_VERSION,
        "build_id": BUILD_ID,
    }
    return ConformanceResult(report_hash=canonical_hash(body), **body)


def canonical_144hz_conformance_report() -> Dict[str, Any]:
    observations, evidence = canonical_144hz_observations()
    result = evaluate_conformance_candidate(observations, evidence)
    parent = build_144hz_test_manifest()
    report = {
        "build_id": BUILD_ID,
        "schema_version": SCHEMA_VERSION,
        "report_role": "canonical_target_contract_from_mea_document_not_claimed_as_current_live_measurement",
        "formula": FORMULA,
        "information_gain_formula": INFORMATION_GAIN_FORMULA,
        "problem_id": CANONICAL_PROBLEM_ID,
        "parent_manifest_hash": legacy_manifest_hash(parent),
        "candidate_observations": observations.to_dict(),
        "conformance_result": result.to_dict(),
        "operator_crosswalk": crosswalk_report(),
        "historical_state_policy": {
            "does_not_rewrite_patch275_299_records": True,
            "does_not_rewrite_build005_jsonl_record": True,
            "historical_memory_record_hash_expected": CANONICAL_LEGACY_MEMORY_RECORD_HASH,
            "forward_score_contract_schema": FIXED_POINT_SCHEMA_VERSION,
        },
    }
    report["report_hash"] = canonical_hash(report)
    return report


def recall_control_case() -> Dict[str, Any]:
    evidence = canonical_144hz_hypothesis_evidence()
    info = information_gain_fixed_point(
        delta_f_verified_fact_gain_micro=0,
        delta_q_unknown_reduction_micro=0,
        delta_x_contradiction_resolution_micro=0,
        interpretation="No manifest transformation occurred; this is recall only.",
    )
    obs, _ = canonical_144hz_observations()
    recall_terms = dict(obs.term_values_micro)
    recall_terms.update({"I": 0, "N": 0, "Omega": 0, "K": 0})
    result = evaluate_conformance_candidate(
        CandidateObservations(
            candidate_id="cg_recall_control",
            term_values_micro=recall_terms,
            term_provenance=dict(obs.term_provenance),
            information_gain=info,
            replay_confirmed=True,
            replay_hash_mutated=False,
            empirical_test_available=False,
            requested_claim_tier="recall",
            required_next_action_basis="No state change.",
        ),
        evidence,
    )
    return result.to_dict()


def replay_mutation_control_case() -> Dict[str, Any]:
    evidence = canonical_144hz_hypothesis_evidence()
    obs, _ = canonical_144hz_observations()
    mutated = CandidateObservations(
        candidate_id="cg_hypothesis_mutated_theta_control",
        term_values_micro=dict(obs.term_values_micro),
        term_provenance=dict(obs.term_provenance),
        information_gain=obs.information_gain,
        replay_confirmed=False,
        replay_hash_mutated=True,
        empirical_test_available=False,
        requested_claim_tier="hypothesis",
        required_next_action_basis="Theta mutation caused replay hash mismatch.",
    )
    return evaluate_conformance_candidate(mutated, evidence).to_dict()


def legacy_gap_audit() -> Dict[str, Any]:
    """Inspect the already-installed preview layer without changing its outputs."""
    candidate_preview = build_candidate_generator_preview()
    coherence_preview = build_coherence_extension_preview()
    hypothesis = next(
        item for item in candidate_preview.get("candidates", ())
        if item.get("candidate_id") == CANONICAL_CANDIDATE_ID
    )
    scored = next(
        item for item in coherence_preview.get("scored_candidates", ())
        if item.get("candidate_id") == CANONICAL_CANDIDATE_ID
    )
    body = {
        "historical_preview_preserved": True,
        "legacy_candidate_id": CANONICAL_CANDIDATE_ID,
        "legacy_claim_status": hypothesis.get("claim_status"),
        "legacy_information_gain": scored.get("information_gain"),
        "legacy_rmc_terms_status": scored.get("rmc_terms_status"),
        "legacy_fallback_terms": scored.get("fallback_terms"),
        "gaps_detected": (
            "legacy_information_gain_uses_delta_K_not_delta_F",
            "legacy_hypothesis_path_has_information_gain_zero_and_status_adjustment",
            "legacy_coherence_preview_uses_fallback_R_P_U_N",
            "legacy_claim_status_and_test_required_are_single_axis",
            "legacy_seal_critical_values_are_float_preview_values",
        ),
        "migration_law": "do_not_rewrite_historical_seal_or_memory_record; apply fixed-point contract to future conformed scoring paths",
    }
    return {**body, "audit_hash": canonical_hash(body)}



def live_runtime_measurement_audit() -> Dict[str, Any]:
    """Measure the currently installed legacy hypothesis candidate without mutation.

    This function is intentionally strict. It compares the existing Patch
    288/289 preview path with the new fixed-point contract. A mismatch is not
    hidden or normalized away. It blocks migration until a later build wires
    real conformed scorer inputs into candidate/seal execution.
    """
    candidate_preview = build_candidate_generator_preview()
    coherence_preview = build_coherence_extension_preview()
    candidate = next(
        item for item in candidate_preview.get("candidates", ())
        if item.get("candidate_id") == CANONICAL_CANDIDATE_ID
    )
    legacy_score = next(
        item for item in coherence_preview.get("scored_candidates", ())
        if item.get("candidate_id") == CANONICAL_CANDIDATE_ID
    )
    draft_manifest = candidate["draft_result"]["draft_manifest"]
    theta = candidate.get("theta_k", {})
    measured_candidate = {
        "candidate_id": candidate["candidate_id"],
        "title": draft_manifest["problem_id"],
        "candidate": theta.get("hypothesis_text", ""),
        "rationale": theta.get("hypothesis_text", ""),
        "candidate_kind": "hypothesis",
        "phase_target": "Φ5",
        "phase_path": ["Φ5"],
        "memory_links": [],
    }
    measurement = measure_candidate(measured_candidate, {}, memory_nodes=[])
    components = coherence_components(measured_candidate, measurement)
    actual_terms = {
        "R": legacy_float_to_micro(float(components["memory_fit"])),
        "P": legacy_float_to_micro(float(components["phase_validity"])),
        "U": legacy_float_to_micro(float(components["utility_fit"])),
        "N": legacy_float_to_micro(float(components["bounded_novelty_score"])),
        "I": legacy_float_to_micro(float(legacy_score["information_gain"])),
        "Omega": legacy_float_to_micro(float(legacy_score["convergence"])),
        "A": legacy_float_to_micro(float(legacy_score["goal_ancestry"])),
        "D": legacy_float_to_micro(float(measurement["D_score"])),
        "B": legacy_float_to_micro(float(legacy_score["proof_debt_penalty"])),
        "K": legacy_float_to_micro(float(legacy_score["operator_cost_penalty"])),
    }
    fixed_score = score_terms_fixed_point(actual_terms, mode=ScoringMode.RESEARCH_SYNTHESIS.value)
    target = canonical_144hz_conformance_report()["candidate_observations"]["term_values_micro"]
    failures = []
    if actual_terms["I"] <= 0:
        failures.append("information_gain_zero_blocks_discovery")
    if actual_terms["D"] > THETA_D_MICRO:
        failures.append("measured_drift_exceeds_theta_D")
    if actual_terms["B"] > THETA_B_HYPOTHESIS_MICRO:
        failures.append("legacy_proof_debt_exceeds_hypothesis_limit")
    if actual_terms["R"] == 0:
        failures.append("no_measured_memory_ancestry_resonance_bound")
    if actual_terms["K"] == 0 and candidate.get("operator_id") == "hypothesize":
        failures.append("operator_cost_not_bound_to_executed_hypothesize_operator")
    if set(legacy_score.get("fallback_terms", ())) == {"R", "P", "U", "N"}:
        failures.append("legacy_coherence_uses_fallback_R_P_U_N")

    body = {
        "report_role": "read_only_actual_live_legacy_measurement_audit",
        "candidate_id": CANONICAL_CANDIDATE_ID,
        "legacy_operator_id": candidate.get("operator_id"),
        "actual_terms_micro_from_current_runtime": actual_terms,
        "canonical_target_terms_micro": target,
        "term_deltas_actual_minus_target": {
            term: actual_terms[term] - target[term] for term in ALL_TERMS
        },
        "measurement_kernel_evidence": {
            "measurement_kernel_version": measurement.get("measurement_kernel_version"),
            "reads_actual_candidate": measurement.get("reads_actual_candidate"),
            "reads_actual_memory_nodes": measurement.get("reads_actual_memory_nodes"),
            "reads_actual_phase_path": measurement.get("reads_actual_phase_path"),
            "reads_actual_resonance_vector": measurement.get("reads_actual_resonance_vector"),
            "D_score_micro": actual_terms["D"],
            "epsilon_s_micro": legacy_float_to_micro(float(measurement["epsilon_s"])),
            "phase_validity_micro": actual_terms["P"],
        },
        "actual_fixed_point_score": fixed_score.to_dict(),
        "conformance_failures": tuple(failures),
        "live_activation_permitted": False if failures else True,
        "migration_decision": (
            "BLOCK_ACTIVE_SCORER_MIGRATION_UNTIL_LIVE_TERMS_CONFORM"
            if failures else "READY_FOR_CONTROLLED_SCORER_MIGRATION"
        ),
        "historical_record_policy": "existing sealed and Build005 memory records remain valid historical bounded hypothesis records and are not rewritten",
    }
    return {**body, "audit_hash": canonical_hash(body)}


def build006_full_conformance_audit() -> Dict[str, Any]:
    """Return the target contract and actual live-measurement audit together."""
    target = canonical_144hz_conformance_report()
    actual = live_runtime_measurement_audit()
    body = {
        "build_id": BUILD_ID,
        "schema_version": SCHEMA_VERSION,
        "canonical_target_contract": target,
        "current_live_measurement_audit": actual,
        "production_contract_installed": True,
        "active_legacy_pipeline_declared_conformant": actual["live_activation_permitted"],
        "next_required_migration": (
            "wire conformed fixed-point scorer/evidence/unknown-reduction inputs into future candidate and seal path without rewriting historic records"
        ),
    }
    return {**body, "full_audit_hash": canonical_hash(body)}

def verify_historical_build005_record(memory_record_path: Path) -> Dict[str, Any]:
    """Read-only proof that Build 006 leaves the historic JSONL record intact."""
    path = Path(memory_record_path)
    if not path.is_file():
        return {"present": False, "valid": False, "reason": "missing_memory_record"}
    entries = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    if len(entries) != 1:
        return {"present": True, "valid": False, "reason": "expected_exactly_one_entry", "entry_count": len(entries)}
    record = entries[0].get("memory_record", {})
    checks = {
        "claim_status_hypothesis": record.get("claim_status") == "hypothesis",
        "proof_debt_preserved": record.get("proof_debt") == 0.85,
        "memory_record_hash_preserved": record.get("memory_record_hash") == CANONICAL_LEGACY_MEMORY_RECORD_HASH,
        "renderer_still_blocked": record.get("renderer_permission_boundary", {}).get("renderer_output_permitted") is False,
    }
    return {
        "present": True,
        "valid": all(checks.values()),
        "entry_count": len(entries),
        "checks": checks,
        "memory_record_hash": record.get("memory_record_hash"),
    }


def build006_boundary() -> Dict[str, Any]:
    return {
        "build_id": BUILD_ID,
        "schema_version": SCHEMA_VERSION,
        "layer": "MEA / Forge Discovery Kernel deterministic mathematical conformance",
        "installs_forward_math_contract": True,
        "reads_legacy_preview_for_gap_audit": True,
        "rewrites_historical_records": False,
        "writes_files": False,
        "writes_mea_memory": False,
        "writes_mea_runtime_state": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "mints_ct": False,
        "writes_ledgers": False,
        "writes_chroma": False,
        "calls_llm": False,
        "renders_user_output": False,
        "creates_http_routes": False,
        "modifies_ui": False,
    }


__all__ = [
    "CandidateObservations", "ConformanceResult", "InformationGainFixedPoint",
    "canonical_144hz_observations", "evaluate_conformance_candidate",
    "canonical_144hz_conformance_report", "recall_control_case",
    "replay_mutation_control_case", "legacy_gap_audit",
    "live_runtime_measurement_audit", "build006_full_conformance_audit",
    "verify_historical_build005_record", "build006_boundary",
]
