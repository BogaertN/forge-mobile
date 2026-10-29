"""
forge/rmc_engine_v1/mea/information_gain_scorer.py

Patch 276 — MEA Scoring Foundations.

Computes MEA information gain using the architecture equation:

    I(c_i) = delta-K + delta-Q + delta-X

where:
- delta-K tracks new known fact structure added by a candidate.
- delta-Q tracks explicit unknown reduction.
- delta-X tracks contradiction reduction / explanatory cleanup.

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
from typing import Any, Dict, Iterable, List, Sequence, Set, Tuple, Union

from .manifest_schema import CandidateManifest, ProblemManifest, canonical_hash

INFORMATION_GAIN_SCORER_PATCH_ID = "Patch 276 — MEA Scoring Foundations"
INFORMATION_GAIN_FORMULA = "I(c_i) = delta-K + delta-Q + delta-X"
INFORMATION_GAIN_SCHEMA_VERSION = "mea_information_gain_score_v1_patch276"

_TEXT_RE = re.compile(r"[^a-z0-9]+")


def _normalise_text(value: str) -> str:
    lowered = str(value or "").lower().strip()
    cleaned = _TEXT_RE.sub(" ", lowered)
    return " ".join(cleaned.split())


def _normalised_set(values: Iterable[str]) -> Set[str]:
    return {item for item in (_normalise_text(v) for v in values) if item}


def _safe_div(num: float, den: float) -> float:
    if den <= 0:
        return 0.0
    return float(num) / float(den)


def _round(value: float) -> float:
    return round(float(value), 6)


def _clamp(value: float, low: float = -1.0, high: float = 1.0) -> float:
    return max(low, min(high, float(value)))


def _candidate_state(candidate_or_manifest: Union[CandidateManifest, ProblemManifest]) -> ProblemManifest:
    if isinstance(candidate_or_manifest, ProblemManifest):
        return candidate_or_manifest
    if isinstance(candidate_or_manifest, CandidateManifest):
        if candidate_or_manifest.proposed_state is None:
            raise ValueError("CandidateManifest requires proposed_state for information-gain scoring")
        return candidate_or_manifest.proposed_state
    raise TypeError("score_information_gain expects CandidateManifest or ProblemManifest")


@dataclass(frozen=True)
class InformationGainDelta:
    name: str
    value: float
    added_items: Tuple[str, ...] = field(default_factory=tuple)
    removed_items: Tuple[str, ...] = field(default_factory=tuple)
    note: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class InformationGainScore:
    problem_id: str
    parent_hash: str
    candidate_hash: str
    formula: str
    delta_k: float
    delta_q: float
    delta_x: float
    information_gain: float
    is_noop_recall: bool
    new_known_fact_count: int
    resolved_unknown_count: int
    resolved_contradiction_count: int
    introduced_unknown_count: int
    introduced_contradiction_count: int
    deltas: Tuple[InformationGainDelta, ...]
    score_notes: Tuple[str, ...] = field(default_factory=tuple)
    patch_id: str = INFORMATION_GAIN_SCORER_PATCH_ID
    schema_version: str = INFORMATION_GAIN_SCHEMA_VERSION

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def scoring_boundary() -> Dict[str, Any]:
    return {
        "patch": INFORMATION_GAIN_SCORER_PATCH_ID,
        "layer": "MEA scoring foundation / information gain",
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


def _delta_k(parent: ProblemManifest, candidate: ProblemManifest) -> InformationGainDelta:
    parent_facts = _normalised_set(parent.known_facts)
    candidate_facts = _normalised_set(candidate.known_facts)
    added = tuple(sorted(candidate_facts - parent_facts))
    removed = tuple(sorted(parent_facts - candidate_facts))
    denom = max(1, len(parent_facts), len(candidate_facts))
    value = _safe_div(len(added), denom)
    if removed:
        value -= _safe_div(len(removed), denom) * 0.5
    return InformationGainDelta(
        name="delta-K",
        value=_round(_clamp(value)),
        added_items=added,
        removed_items=removed,
        note="New canonical known facts added minus penalty for removed known facts.",
    )


def _delta_q(parent: ProblemManifest, candidate: ProblemManifest) -> InformationGainDelta:
    parent_unknowns = _normalised_set(parent.unknowns)
    candidate_unknowns = _normalised_set(candidate.unknowns)
    resolved = tuple(sorted(parent_unknowns - candidate_unknowns))
    introduced = tuple(sorted(candidate_unknowns - parent_unknowns))
    denom = max(1, len(parent_unknowns))
    value = _safe_div(len(resolved), denom)
    if introduced:
        value -= _safe_div(len(introduced), max(1, len(candidate_unknowns)))
    return InformationGainDelta(
        name="delta-Q",
        value=_round(_clamp(value)),
        added_items=introduced,
        removed_items=resolved,
        note="Explicit unknown reduction minus penalty for new unknowns introduced by the candidate.",
    )


def _delta_x(parent: ProblemManifest, candidate: ProblemManifest) -> InformationGainDelta:
    parent_contradictions = _normalised_set(parent.contradictions)
    candidate_contradictions = _normalised_set(candidate.contradictions)
    resolved = tuple(sorted(parent_contradictions - candidate_contradictions))
    introduced = tuple(sorted(candidate_contradictions - parent_contradictions))
    denom = max(1, len(parent_contradictions))
    value = _safe_div(len(resolved), denom)
    if introduced:
        value -= _safe_div(len(introduced), max(1, len(candidate_contradictions)))
    return InformationGainDelta(
        name="delta-X",
        value=_round(_clamp(value)),
        added_items=introduced,
        removed_items=resolved,
        note="Contradiction reduction / explanatory cleanup minus penalty for introduced contradictions.",
    )


def score_information_gain(
    parent_manifest: ProblemManifest,
    candidate_or_manifest: Union[CandidateManifest, ProblemManifest],
) -> InformationGainScore:
    """Compute I(c_i) = delta-K + delta-Q + delta-X for one candidate.

    A value of exactly 0.0 means the candidate did not structurally advance the
    problem manifest. Later gate/classifier patches must treat that as recall,
    not discovery.
    """

    if not isinstance(parent_manifest, ProblemManifest):
        raise TypeError("parent_manifest must be ProblemManifest")
    candidate = _candidate_state(candidate_or_manifest)

    dk = _delta_k(parent_manifest, candidate)
    dq = _delta_q(parent_manifest, candidate)
    dx = _delta_x(parent_manifest, candidate)
    raw_gain = dk.value + dq.value + dx.value
    gain = _round(max(0.0, raw_gain))

    parent_hash = canonical_hash(parent_manifest)
    candidate_hash = canonical_hash(candidate)
    no_op = parent_hash == candidate_hash or gain == 0.0

    notes: List[str] = []
    if no_op:
        notes.append("I(c_i)=0: candidate is structurally recall/no-op, not a discovery claim.")
    else:
        notes.append("I(c_i)>0: candidate changed the manifest state; later gates must still check proof debt, replay, and claim status.")

    return InformationGainScore(
        problem_id=candidate.problem_id or parent_manifest.problem_id,
        parent_hash=parent_hash,
        candidate_hash=candidate_hash,
        formula=INFORMATION_GAIN_FORMULA,
        delta_k=dk.value,
        delta_q=dq.value,
        delta_x=dx.value,
        information_gain=gain,
        is_noop_recall=no_op,
        new_known_fact_count=len(dk.added_items),
        resolved_unknown_count=len(dq.removed_items),
        resolved_contradiction_count=len(dx.removed_items),
        introduced_unknown_count=len(dq.added_items),
        introduced_contradiction_count=len(dx.added_items),
        deltas=(dk, dq, dx),
        score_notes=tuple(notes),
    )
