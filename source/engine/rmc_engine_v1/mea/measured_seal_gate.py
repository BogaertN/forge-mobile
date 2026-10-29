"""
forge/rmc_engine_v1/mea/measured_seal_gate.py

MEA-DISCOVERY-KERNEL-LIVE-TERM-BINDING-BUILD-007
Read-only forward seal-eligibility gate over Build 007 measured term bindings.

The gate does not execute a seal, alter a manifest, write memory, render output,
or create a route. It prevents future candidate sealing unless the fixed-point
term vector, replay binding, ancestry binding, operator trace and epistemic
claim constraints all pass.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, Tuple

from .fixed_point_math_contract import canonical_hash
from .live_term_binding import BUILD_ID, LiveTermBindingResult, THRESHOLDS_MICRO

SCHEMA_VERSION = "mea_measured_seal_gate_v1_build007"


@dataclass(frozen=True)
class MeasuredGateCheck:
    gate_name: str
    passed: bool
    observed: Any
    threshold: Any
    detail: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class MeasuredSealReadiness:
    candidate_id: str
    claim_status: str
    required_next_action: str
    gate_checks: Tuple[Dict[str, Any], ...]
    all_required_gates_passed: bool
    eligible_for_future_seal_transaction: bool
    verified_empirical_claim_permitted: bool
    seal_execution_performed: bool
    migration_status: str
    result_hash: str
    schema_version: str = SCHEMA_VERSION
    build_id: str = BUILD_ID

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _check(name: str, passed: bool, observed: Any, threshold: Any, detail: str) -> MeasuredGateCheck:
    return MeasuredGateCheck(name, bool(passed), observed, threshold, detail)


def evaluate_measured_seal_readiness(binding: LiveTermBindingResult) -> MeasuredSealReadiness:
    terms = binding.terms_micro
    claim = binding.epistemic_claim_status
    debt_threshold = THRESHOLDS_MICRO["B_hypothesis_max"] if claim == "hypothesis" else THRESHOLDS_MICRO["B_derived_claim_max"] if claim == "derived_claim" else THRESHOLDS_MICRO["B_verified_claim_max"]
    checks = (
        _check("fixed_point_complete_term_vector", set(terms) == {"R", "P", "U", "N", "I", "Omega", "A", "D", "B", "K"}, sorted(terms), "complete term vector", "All ten measured MEA terms are required."),
        _check("explicit_memory_ancestry_binding", binding.explicit_memory_ancestry_bound, terms.get("R"), ">0", "R must arise from explicit hash-verified memory ancestry."),
        _check("explicit_operator_trace_binding", binding.explicit_operator_trace_bound, terms.get("K"), ">0 and <1_000_000", "K must arise from a known executed operator path."),
        _check("replay_confirmation", binding.replay_confirmed, binding.replay_confirmed, True, "Replay is required for reproducibility, not truth."),
        _check("phase_validity", terms["P"] >= THRESHOLDS_MICRO["P_min"], terms["P"], THRESHOLDS_MICRO["P_min"], "P must satisfy the FBSC phase gate."),
        _check("drift_bound", terms["D"] <= THRESHOLDS_MICRO["D_max"], terms["D"], THRESHOLDS_MICRO["D_max"], "D must remain within bounded drift."),
        _check("proof_debt_tier", terms["B"] <= debt_threshold, terms["B"], debt_threshold, "B must be legal for the requested epistemic tier."),
        _check("discovery_information_gain", terms["I"] > THRESHOLDS_MICRO["I_discovery_min_exclusive"], terms["I"], ">0", "Discovery requires measured information gain."),
        _check("convergence_progress", terms["Omega"] > 0, terms["Omega"], ">0", "A hypothesis advanced for sealing must move toward an explicit success path."),
        _check("renderer_still_closed", binding.output_permissions == "sealed", binding.output_permissions, "sealed", "Build 007 never authorizes rendering."),
    )
    all_pass = all(check.passed for check in checks)
    evidence = binding.evidence_assessment
    empirical_allowed = bool(evidence.get("verified_empirical_claim_permitted", False))
    if claim == "verified_claim" and not empirical_allowed:
        all_pass = False
    body = {
        "candidate_id": binding.candidate_id,
        "claim_status": claim,
        "required_next_action": binding.required_next_action,
        "gate_checks": tuple(check.to_dict() for check in checks),
        "all_required_gates_passed": all_pass,
        "eligible_for_future_seal_transaction": all_pass,
        "verified_empirical_claim_permitted": empirical_allowed,
        "seal_execution_performed": False,
        "migration_status": "FORWARD_MEASURED_GATE_AVAILABLE_SEAL_NOT_EXECUTED" if all_pass else "BLOCKED_UNTIL_MEASURED_GATES_PASS",
        "schema_version": SCHEMA_VERSION,
        "build_id": BUILD_ID,
    }
    return MeasuredSealReadiness(result_hash=canonical_hash(body), **body)


def measured_seal_gate_boundary() -> Dict[str, Any]:
    return {
        "build_id": BUILD_ID,
        "schema_version": SCHEMA_VERSION,
        "forward_seal_gate_available": True,
        "seal_execution_performed": False,
        "score_can_override_failed_gate": False,
        "legacy_seal_route_rewritten": False,
        "writes_files": False,
        "writes_memory": False,
        "writes_runtime_state": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "writes_chroma": False,
        "calls_llm": False,
        "renders_output": False,
        "creates_http_routes": False,
    }


__all__ = ["SCHEMA_VERSION", "MeasuredGateCheck", "MeasuredSealReadiness", "evaluate_measured_seal_readiness", "measured_seal_gate_boundary"]
