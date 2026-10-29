"""General Learning-to-Answer Pipeline — governed solution gate (Build GP-001).

The exact answer does NOT automatically become a sealed result. It must pass a
governed gate that mirrors the MEA discipline:

  - information gain must be > 0 (a result that resolves no unknown is recall,
    not discovery, and cannot seal);
  - the exact verification must have passed (replay-of-arithmetic by inversion
    or substitution);
  - the domain must be authorised by a governed source procedure.

Only on PASS does the manifest advance to a resolved, render-allowed state.
This is the safeguard that stops "the math looked right" from bypassing the
engine: arithmetic correctness is necessary but the gate is what grants seal.

Numbers use the engine's fixed-point unit scale (1_000_000 micro-units) so the
gate vector is deterministic and hashable, consistent with the existing
fixed_point_math_contract discipline.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List

from rmc_engine_v1.mea.manifest_schema import (
    ProblemManifest,
    ClaimStatus,
    OutputPermission,
)

from .contracts import ExactSolution, SemanticSource, canonical_hash
from .capability_registry import capability_for_domain

UNIT = 1_000_000


@dataclass
class GateResult:
    passed: bool
    reasons: List[str] = field(default_factory=list)
    vector_micro: Dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "passed": self.passed,
            "reasons": list(self.reasons),
            "vector_micro": dict(sorted(self.vector_micro.items())),
        }

    def gate_hash(self) -> str:
        return canonical_hash(self.to_dict())


def evaluate_gate(
    manifest: ProblemManifest,
    solution: ExactSolution,
    source: SemanticSource,
) -> GateResult:
    reasons: List[str] = []

    contract = capability_for_domain(solution.domain)
    capability_registered = contract is not None
    if not capability_registered:
        reasons.append("no_installed_capability_contract")

    capability_declared = bool(
        contract is not None and contract.capability_id in manifest.allowed_tools
    )
    if not capability_declared:
        reasons.append("manifest_does_not_authorise_selected_capability")

    domain_authorised = source.supports_domain(solution.domain)
    if not domain_authorised:
        reasons.append("domain_not_authorised_by_source")

    if solution.information_gain <= 0:
        reasons.append("zero_information_gain_is_recall_not_discovery")

    if not solution.verified:
        reasons.append("exact_verification_did_not_pass")

    # Fixed-point gate vector (micro-units). These are measured from the
    # solution, not declared: I and the verification flag are real; novelty is
    # deliberately 0 for exact arithmetic (we do not reward ordinary math as
    # novel); operator cost is a small fixed acknowledgement of work done.
    vector = {
        "information_gain": int(max(0, min(UNIT, solution.information_gain))),
        "verification": UNIT if solution.verified else 0,
        "domain_authorised": UNIT if domain_authorised else 0,
        "capability_registered": UNIT if capability_registered else 0,
        "capability_declared": UNIT if capability_declared else 0,
        "novelty": 0,
        "operator_cost": UNIT // 4,
    }

    passed = not reasons
    return GateResult(passed=passed, reasons=reasons, vector_micro=vector)


def apply_seal(manifest: ProblemManifest, solution: ExactSolution) -> ProblemManifest:
    """Return a new manifest advanced to a sealed, render-allowed resolved state.

    Only call this after evaluate_gate(...).passed is True. proof_debt drops to
    0 because the answer is exact and verified by substitution/inversion; the
    claim becomes RESOLVED_MANIFEST and output becomes RENDER_ALLOWED.
    """
    facts = list(manifest.known_facts)
    facts.append(f"answer = {solution.to_dict()['answer_value']} {solution.answer_unit}".strip())
    for step in solution.steps:
        facts.append(f"step: {step}")
    facts.append(f"verification: {solution.verification_text}")

    return ProblemManifest(
        problem_id=manifest.problem_id,
        goal=manifest.goal,
        known_facts=facts,
        unknowns=[],  # resolved
        constraints=manifest.constraints,
        assumptions=manifest.assumptions,
        contradictions=manifest.contradictions,
        success_conditions=manifest.success_conditions,
        failure_conditions=manifest.failure_conditions,
        phase_state=manifest.phase_state,
        phase_path=manifest.phase_path,
        drift_state=manifest.drift_state,
        proof_debt=0.0,
        memory_ancestry=manifest.memory_ancestry,
        operator_history=manifest.operator_history,
        goal_ancestry=manifest.goal_ancestry,
        claim_status=ClaimStatus.RESOLVED_MANIFEST.value,
        output_permissions=OutputPermission.RENDER_ALLOWED.value,
        allowed_tools=manifest.allowed_tools,
    )


__all__ = ["GateResult", "evaluate_gate", "apply_seal", "UNIT"]
