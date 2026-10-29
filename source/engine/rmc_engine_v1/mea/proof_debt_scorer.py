"""
forge/rmc_engine_v1/mea/proof_debt_scorer.py

Patch 276 — MEA Scoring Foundations.

Computes MEA proof debt using the architecture equation:

    B(c_i) = 1 - E(c_i)

where E(c_i) is bounded evidence support and B(c_i) is proof debt.

Boundary contract:
- stdlib only
- deterministic and side-effect free
- no file writes
- no database writes
- no shell execution
- no LLM calls
- no network calls
- no seal, memory, Chroma, or Identity Vault behavior
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple, Union

from .manifest_schema import CandidateManifest, MemoryRef, ProblemManifest

PROOF_DEBT_SCORER_PATCH_ID = "Patch 276 — MEA Scoring Foundations"
PROOF_DEBT_FORMULA = "B(c_i) = 1 - E(c_i)"
PROOF_DEBT_SCHEMA_VERSION = "mea_proof_debt_score_v1_patch276"

_HIGH_DEBT_THRESHOLD = 0.70
_MEDIUM_DEBT_THRESHOLD = 0.40
_LOW_DEBT_THRESHOLD = 0.20

_DIRECT_EVIDENCE_TIERS: Dict[str, float] = {
    "peer_reviewed": 1.00,
    "published_measurement": 1.00,
    "published_derivation": 0.92,
    "published": 0.90,
    "primary_source": 0.86,
    "official": 0.82,
    "internal_verified": 0.70,
    "internal": 0.55,
    "derived": 0.50,
    "unverified": 0.20,
    "hypothesis": 0.12,
    "speculative": 0.05,
    "rejected": 0.0,
}

_SOURCE_ABSENCE_MARKERS: Tuple[str, ...] = (
    "no published",
    "no direct",
    "no empirical",
    "not yet measured",
    "not yet confirmed",
    "no measurement",
    "no study",
    "no data",
    "lacks direct",
    "lacks empirical",
    "lacks measurement",
    "not experimentally",
    "not independently",
)

_SPECULATIVE_MARKERS: Tuple[str, ...] = (
    "hypothesis",
    "hypothesized",
    "hypothesised",
    "speculative",
    "assumed",
    "theoretical only",
    "may be",
    "could be",
    "might be",
    "not proven",
    "unconfirmed",
)

_NUMBER_RE = re.compile(r"\d+(?:\.\d+)?")


class ProofDebtBand(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    MAXIMUM = "maximum"


def _clamp_unit(value: float) -> float:
    if isinstance(value, bool):
        raise TypeError("unit value must be numeric, not bool")
    return max(0.0, min(1.0, float(value)))


def _clean_text(value: str) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _contains_any(text: str, markers: Sequence[str]) -> bool:
    cleaned = _clean_text(text)
    return any(marker in cleaned for marker in markers)


def _safe_average(values: Iterable[float], default: float = 0.0) -> float:
    vals = [float(v) for v in values]
    if not vals:
        return float(default)
    return sum(vals) / len(vals)


def _evidence_tier_score(tier: str) -> float:
    cleaned = _clean_text(tier).replace(" ", "_").replace("-", "_")
    return _DIRECT_EVIDENCE_TIERS.get(cleaned, _DIRECT_EVIDENCE_TIERS["unverified"])


def _fact_reliability(fact: str) -> float:
    text = _clean_text(fact)
    if not text:
        return 0.0
    if _contains_any(text, _SOURCE_ABSENCE_MARKERS):
        # A fact that states absence of evidence is useful as a constraint, but it
        # does not support a stronger empirical claim.
        return 0.18
    if _contains_any(text, _SPECULATIVE_MARKERS):
        return 0.24
    if _NUMBER_RE.search(text) and ("measurement" in text or "published" in text or "direct" in text):
        return 0.80
    return 0.62


def _memory_ref_score(ref: MemoryRef) -> float:
    relevance = _clamp_unit(getattr(ref, "relevance", 0.0))
    tier_score = _evidence_tier_score(getattr(ref, "evidence_tier", "unverified"))
    return relevance * tier_score


def _candidate_problem(candidate_or_manifest: Union[CandidateManifest, ProblemManifest]) -> ProblemManifest:
    if isinstance(candidate_or_manifest, ProblemManifest):
        return candidate_or_manifest
    if isinstance(candidate_or_manifest, CandidateManifest):
        if candidate_or_manifest.proposed_state is not None:
            return candidate_or_manifest.proposed_state
        return ProblemManifest(
            problem_id=candidate_or_manifest.problem_id or candidate_or_manifest.candidate_id,
            goal="Score candidate with no proposed_state.",
            known_facts=[],
            unknowns=["Candidate proposed_state missing."],
            success_conditions=["Candidate must provide proposed_state before scoring can be trusted."],
            proof_debt=max(_clamp_unit(candidate_or_manifest.proof_debt), 0.95),
        )
    raise TypeError("score_proof_debt expects ProblemManifest or CandidateManifest")


@dataclass(frozen=True)
class EvidenceSupportProfile:
    """Bounded evidence support E(c_i) and its explainable components."""

    prior_support: float
    fact_support: float
    memory_support: float
    assumption_support: float
    evidence_support_raw: float
    evidence_support: float
    proof_debt_floor: float
    source_absence_count: int
    speculative_marker_count: int
    explicit_unknown_count: int
    contradiction_count: int
    memory_ref_count: int
    notes: Tuple[str, ...] = field(default_factory=tuple)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class ProofDebtScore:
    """Result for B(c_i) = 1 - E(c_i)."""

    problem_id: str
    formula: str
    evidence_support: float
    proof_debt: float
    band: ProofDebtBand
    blocks_verified_claim: bool
    blocks_derived_claim: bool
    evidence_profile: EvidenceSupportProfile
    score_notes: Tuple[str, ...] = field(default_factory=tuple)
    patch_id: str = PROOF_DEBT_SCORER_PATCH_ID
    schema_version: str = PROOF_DEBT_SCHEMA_VERSION

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["band"] = self.band.value
        return data


def scoring_boundary() -> Dict[str, Any]:
    return {
        "patch": PROOF_DEBT_SCORER_PATCH_ID,
        "layer": "MEA scoring foundation / proof debt",
        "read_only": True,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "creates_post_routes": False,
        "seals_candidates": False,
        "promotes_to_memory": False,
    }


def build_evidence_support_profile(candidate_or_manifest: Union[CandidateManifest, ProblemManifest]) -> EvidenceSupportProfile:
    """Compute bounded evidence support without side effects.

    The manifest's existing proof_debt is treated as an explicit epistemic prior.
    The scorer may raise debt above that prior if structural evidence gaps are
    detected, but it will not quietly lower declared proof debt without later
    verification patches.
    """

    manifest = _candidate_problem(candidate_or_manifest)
    prior_support = 1.0 - _clamp_unit(manifest.proof_debt)

    fact_scores = [_fact_reliability(fact) for fact in manifest.known_facts if str(fact).strip()]
    fact_support = _safe_average(fact_scores, default=0.0)

    memory_scores = [_memory_ref_score(ref) for ref in manifest.memory_ancestry]
    memory_support = _safe_average(memory_scores, default=0.0)

    assumption_scores = [_clamp_unit(getattr(a, "confidence", 0.0)) for a in manifest.assumptions]
    assumption_support = _safe_average(assumption_scores, default=0.0)

    all_text = list(manifest.known_facts) + list(manifest.constraints) + list(manifest.assumptions and [a.text for a in manifest.assumptions] or [])
    source_absence_count = sum(1 for item in all_text if _contains_any(item, _SOURCE_ABSENCE_MARKERS))
    speculative_marker_count = sum(1 for item in all_text if _contains_any(item, _SPECULATIVE_MARKERS))
    explicit_unknown_count = len([item for item in manifest.unknowns if str(item).strip()])
    contradiction_count = len([item for item in manifest.contradictions if str(item).strip()])

    present_components: List[Tuple[float, float]] = [(prior_support, 0.60)]
    if fact_scores:
        present_components.append((fact_support, 0.16))
    if memory_scores:
        present_components.append((memory_support, 0.14))
    if assumption_scores:
        present_components.append((assumption_support, 0.10))
    weight_total = sum(weight for _, weight in present_components) or 1.0
    evidence_support_raw = sum(value * weight for value, weight in present_components) / weight_total

    proof_debt_floor = 0.0
    notes: List[str] = []
    if source_absence_count:
        proof_debt_floor = max(proof_debt_floor, 0.70)
        notes.append("Source absence marker detected; verified claim must remain blocked until direct evidence improves.")
    if speculative_marker_count:
        proof_debt_floor = max(proof_debt_floor, 0.55)
        notes.append("Speculative marker detected; candidate remains hypothesis-bound unless verified later.")
    if explicit_unknown_count:
        proof_debt_floor = max(proof_debt_floor, min(0.60, 0.20 + 0.10 * explicit_unknown_count))
        notes.append("Explicit unknown vector remains open.")
    if contradiction_count:
        proof_debt_floor = max(proof_debt_floor, min(0.95, 0.75 + 0.05 * contradiction_count))
        notes.append("Unresolved contradiction raises proof debt floor.")
    if not manifest.memory_ancestry:
        notes.append("No memory ancestry evidence refs present in this scoring pass.")

    prior_debt = _clamp_unit(manifest.proof_debt)
    computed_debt = 1.0 - _clamp_unit(evidence_support_raw)
    proof_debt = max(prior_debt, computed_debt, proof_debt_floor)
    proof_debt = _clamp_unit(proof_debt)
    evidence_support = _clamp_unit(1.0 - proof_debt)

    return EvidenceSupportProfile(
        prior_support=round(prior_support, 6),
        fact_support=round(fact_support, 6),
        memory_support=round(memory_support, 6),
        assumption_support=round(assumption_support, 6),
        evidence_support_raw=round(_clamp_unit(evidence_support_raw), 6),
        evidence_support=round(evidence_support, 6),
        proof_debt_floor=round(proof_debt_floor, 6),
        source_absence_count=source_absence_count,
        speculative_marker_count=speculative_marker_count,
        explicit_unknown_count=explicit_unknown_count,
        contradiction_count=contradiction_count,
        memory_ref_count=len(manifest.memory_ancestry),
        notes=tuple(notes),
    )


def score_proof_debt(candidate_or_manifest: Union[CandidateManifest, ProblemManifest]) -> ProofDebtScore:
    """Return the Patch 276 proof debt score for a manifest or candidate."""

    manifest = _candidate_problem(candidate_or_manifest)
    profile = build_evidence_support_profile(candidate_or_manifest)
    proof_debt = _clamp_unit(1.0 - profile.evidence_support)

    if proof_debt >= 0.90:
        band = ProofDebtBand.MAXIMUM
    elif proof_debt >= _HIGH_DEBT_THRESHOLD:
        band = ProofDebtBand.HIGH
    elif proof_debt >= _MEDIUM_DEBT_THRESHOLD:
        band = ProofDebtBand.MEDIUM
    else:
        band = ProofDebtBand.LOW

    notes: List[str] = []
    if proof_debt >= _HIGH_DEBT_THRESHOLD:
        notes.append("High proof debt: verified_claim and derived_claim are structurally blocked in later claim classification.")
    elif proof_debt >= _LOW_DEBT_THRESHOLD:
        notes.append("Non-trivial proof debt: verified_claim should remain blocked until debt is reduced below threshold.")
    else:
        notes.append("Proof debt is low enough for later classifiers to consider stronger tiers if other gates pass.")

    return ProofDebtScore(
        problem_id=manifest.problem_id,
        formula=PROOF_DEBT_FORMULA,
        evidence_support=round(profile.evidence_support, 6),
        proof_debt=round(proof_debt, 6),
        band=band,
        blocks_verified_claim=proof_debt >= _LOW_DEBT_THRESHOLD,
        blocks_derived_claim=proof_debt >= _HIGH_DEBT_THRESHOLD,
        evidence_profile=profile,
        score_notes=tuple(notes),
    )
