"""
forge/rmc_engine_v1/mea/evidence_tier_contract.py

MEA-DISCOVERY-KERNEL-MATH-CONFORMANCE-BUILD-006
Evidence-tier and proof-debt contract for the Forge Discovery Kernel.

This module makes one rule executable:

    Internal theory or ancestry can support a bounded structural hypothesis.
    It cannot independently validate an external empirical fact.

The contract therefore separates epistemic support from empirical authority.
A replayable internal derivation may reduce proof debt enough to permit a
hypothesis or derived-claim review, but only qualifying external empirical
evidence can authorize an empirical verified_claim.

No writes, no rendering, no routes, no network, no LLM, no Chroma,
no Identity Vault, and no Contribution Economy behavior.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any, Dict, Iterable, Tuple

from .fixed_point_math_contract import (
    BUILD_ID,
    UNIT_SCALE,
    canonical_hash,
    require_unit_micro,
)

SCHEMA_VERSION = "mea_evidence_tier_contract_v1_build006"


class EvidenceTier(str, Enum):
    EXTERNAL_EMPIRICAL_MEASUREMENT = "external_empirical_measurement"
    EXTERNAL_PEER_REVIEWED_DERIVATION = "external_peer_reviewed_derivation"
    INTERNAL_VERIFIED_TRACE = "internal_verified_trace"
    INTERNAL_THEORY_ANCESTRY = "internal_theory_ancestry"
    OPERATOR_DERIVATION_UNVALIDATED = "operator_derivation_unvalidated"
    UNSOURCED_ASSERTION = "unsourced_assertion"


@dataclass(frozen=True)
class EvidenceItem:
    evidence_id: str
    description: str
    tier: str
    support_micro: int
    supports_empirical_fact: bool = False
    independently_verified: bool = False
    source_reference: str = ""

    def __post_init__(self) -> None:
        if self.tier not in {item.value for item in EvidenceTier}:
            raise ValueError(f"Unknown evidence tier: {self.tier!r}")
        require_unit_micro("support_micro", self.support_micro)
        if self.supports_empirical_fact and self.tier != EvidenceTier.EXTERNAL_EMPIRICAL_MEASUREMENT.value:
            raise ValueError("Only external_empirical_measurement may support an empirical fact")
        if self.supports_empirical_fact and not self.independently_verified:
            raise ValueError("Empirical-fact support requires independently_verified=True")

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class EvidenceAssessment:
    requested_claim_kind: str
    evidence_items: Tuple[Dict[str, Any], ...]
    aggregate_support_micro: int
    proof_debt_micro: int
    empirical_authority_present: bool
    verified_empirical_claim_permitted: bool
    derived_claim_review_permitted: bool
    hypothesis_review_permitted: bool
    evidence_rule: str
    assessment_hash: str
    notes: Tuple[str, ...] = field(default_factory=tuple)
    schema_version: str = SCHEMA_VERSION
    build_id: str = BUILD_ID

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def assess_evidence(
    items: Iterable[EvidenceItem],
    *,
    requested_claim_kind: str = "structural_hypothesis",
) -> EvidenceAssessment:
    evidence = tuple(items)
    support = min(UNIT_SCALE, sum(item.support_micro for item in evidence))
    debt = UNIT_SCALE - support
    empirical_authority = any(
        item.tier == EvidenceTier.EXTERNAL_EMPIRICAL_MEASUREMENT.value
        and item.supports_empirical_fact
        and item.independently_verified
        for item in evidence
    )
    verified_empirical = empirical_authority and debt < 200_000
    derived_review = debt < 400_000 and bool(evidence)
    hypothesis_review = debt <= 700_000 and bool(evidence)

    notes = []
    if not empirical_authority:
        notes.append("No qualifying external empirical measurement is present; verified empirical claim is prohibited.")
    if hypothesis_review:
        notes.append("Evidence support is sufficient for bounded hypothesis review only, subject to replay and gate checks.")
    if any(item.tier == EvidenceTier.INTERNAL_THEORY_ANCESTRY.value for item in evidence):
        notes.append("Internal theory ancestry may support derivation context but is not empirical confirmation.")

    body = {
        "requested_claim_kind": requested_claim_kind,
        "evidence_items": tuple(item.to_dict() for item in evidence),
        "aggregate_support_micro": support,
        "proof_debt_micro": debt,
        "empirical_authority_present": empirical_authority,
        "verified_empirical_claim_permitted": verified_empirical,
        "derived_claim_review_permitted": derived_review,
        "hypothesis_review_permitted": hypothesis_review,
        "evidence_rule": "internal_ancestry_supports_bounded_hypothesis_not_external_empirical_truth",
        "notes": tuple(notes),
        "schema_version": SCHEMA_VERSION,
        "build_id": BUILD_ID,
    }
    return EvidenceAssessment(assessment_hash=canonical_hash(body), **body)


def canonical_144hz_hypothesis_evidence() -> EvidenceAssessment:
    """Evidence contract for the paper's bounded 144 Hz harmonic hypothesis.

    Support = 0.45, therefore B = 0.55 exactly. This support acknowledges
    internal ancestry for a testable relation while preserving the absence of
    direct external myelin-specific measurement.
    """
    return assess_evidence(
        (
            EvidenceItem(
                evidence_id="fbsc_90hz_internal_ancestry",
                description="FBSC internal ancestry identifies a 90 Hz binding-frequency reference.",
                tier=EvidenceTier.INTERNAL_THEORY_ANCESTRY.value,
                support_micro=300_000,
                source_reference="FBSC Volume II / internal ancestry",
            ),
            EvidenceItem(
                evidence_id="ratio_relation_internal_trace",
                description="The 144-to-90 approximate relation is traceable inside the hypothesis path but not independently measured.",
                tier=EvidenceTier.INTERNAL_VERIFIED_TRACE.value,
                support_micro=150_000,
                source_reference="MEA hypothesize:harmonic_from_90hz trace",
            ),
            EvidenceItem(
                evidence_id="missing_myelin_measurement",
                description="No qualifying external myelin-specific 144 Hz measurement is supplied.",
                tier=EvidenceTier.UNSOURCED_ASSERTION.value,
                support_micro=0,
                source_reference="open unknown",
            ),
        ),
        requested_claim_kind="empirical_substrate_frequency_claim",
    )


def evidence_contract_boundary() -> Dict[str, Any]:
    return {
        "build_id": BUILD_ID,
        "schema_version": SCHEMA_VERSION,
        "rule": "replay_and_internal_ancestry_do_not_equal_external_empirical_truth",
        "internal_theory_may_authorize_empirical_verified_claim": False,
        "writes_files": False,
        "writes_memory": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "writes_chroma": False,
        "calls_llm": False,
        "renders_output": False,
    }


__all__ = [
    "EvidenceTier", "EvidenceItem", "EvidenceAssessment", "assess_evidence",
    "canonical_144hz_hypothesis_evidence", "evidence_contract_boundary",
]
