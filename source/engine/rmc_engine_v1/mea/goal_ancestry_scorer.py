"""
forge/rmc_engine_v1/mea/goal_ancestry_scorer.py

Patch 277 — MEA Convergence / Ancestry / Cost Scoring.

Computes MEA goal ancestry coherence:

    A(c_i) = lineage coherence back to the original problem root

A(c_i) catches slow multi-step drift. Each local transition may look legal, but
a chain can still walk away from the original problem. This scorer uses
transparent lexical anchor retention, not language-model judgment.

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

GOAL_ANCESTRY_SCORER_PATCH_ID = "Patch 277 — MEA Convergence / Ancestry / Cost Scoring"
GOAL_ANCESTRY_FORMULA = "A(c_i) = retained_root_goal_anchors across goal_ancestry"
GOAL_ANCESTRY_SCHEMA_VERSION = "mea_goal_ancestry_score_v1_patch277"

_TEXT_RE = re.compile(r"[^a-z0-9]+")
_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "can", "claim", "determine", "for", "from", "goal",
    "has", "have", "in", "into", "is", "it", "its", "of", "on", "or", "status", "the", "this", "to", "with",
    "without", "whether", "what", "which", "why", "how", "provable", "epistemic", "general", "method", "methods",
}


def _normalise_text(value: str) -> str:
    lowered = str(value or "").lower().strip()
    cleaned = _TEXT_RE.sub(" ", lowered)
    return " ".join(cleaned.split())


def _tokens(value: str) -> Set[str]:
    return {tok for tok in _normalise_text(value).split() if tok and tok not in _STOPWORDS}


def _round(value: float) -> float:
    return round(float(value), 6)


def _clamp_unit(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _candidate_state(candidate_or_manifest: Union[CandidateManifest, ProblemManifest]) -> ProblemManifest:
    if isinstance(candidate_or_manifest, ProblemManifest):
        return candidate_or_manifest
    if isinstance(candidate_or_manifest, CandidateManifest):
        if candidate_or_manifest.proposed_state is None:
            raise ValueError("CandidateManifest requires proposed_state for goal-ancestry scoring")
        return candidate_or_manifest.proposed_state
    raise TypeError("score_goal_ancestry expects CandidateManifest or ProblemManifest")


def _jaccard(a: Set[str], b: Set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _root_goal(parent: ProblemManifest) -> str:
    if parent.goal_ancestry:
        return parent.goal_ancestry[0]
    return parent.goal


def _lineage(candidate: ProblemManifest) -> Tuple[str, ...]:
    chain: List[str] = []
    chain.extend(candidate.goal_ancestry)
    if candidate.goal and (not chain or _normalise_text(candidate.goal) != _normalise_text(chain[-1])):
        chain.append(candidate.goal)
    return tuple(item for item in chain if str(item).strip())


@dataclass(frozen=True)
class GoalAncestryStepScore:
    index: int
    goal_text: str
    root_overlap: float
    previous_overlap: float
    retained_root_terms: Tuple[str, ...] = field(default_factory=tuple)
    lost_root_terms: Tuple[str, ...] = field(default_factory=tuple)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class GoalAncestryScore:
    problem_id: str
    parent_hash: str
    candidate_hash: str
    formula: str
    ancestry_score: float
    root_anchor_retention: float
    chain_coherence: float
    drift_penalty: float
    lineage_length: int
    root_terms: Tuple[str, ...]
    step_scores: Tuple[GoalAncestryStepScore, ...]
    score_notes: Tuple[str, ...] = field(default_factory=tuple)
    patch_id: str = GOAL_ANCESTRY_SCORER_PATCH_ID
    schema_version: str = GOAL_ANCESTRY_SCHEMA_VERSION

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def scoring_boundary() -> Dict[str, Any]:
    return {
        "patch": GOAL_ANCESTRY_SCORER_PATCH_ID,
        "layer": "MEA scoring foundation / goal ancestry",
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


def score_goal_ancestry(
    parent_manifest: ProblemManifest,
    candidate_or_manifest: Union[CandidateManifest, ProblemManifest],
) -> GoalAncestryScore:
    """Compute A(c_i) as deterministic retention of root-goal anchors."""

    if not isinstance(parent_manifest, ProblemManifest):
        raise TypeError("parent_manifest must be ProblemManifest")
    candidate = _candidate_state(candidate_or_manifest)

    root = _root_goal(parent_manifest)
    root_terms = _tokens(root)
    lineage = _lineage(candidate)
    if not lineage:
        lineage = (candidate.goal or parent_manifest.goal,)

    step_scores: List[GoalAncestryStepScore] = []
    previous_terms = root_terms
    root_overlaps: List[float] = []
    previous_overlaps: List[float] = []
    for index, goal_text in enumerate(lineage):
        terms = _tokens(goal_text)
        root_overlap = (len(root_terms & terms) / len(root_terms)) if root_terms else 0.0
        previous_overlap = _jaccard(previous_terms, terms) if previous_terms else 0.0
        retained = tuple(sorted(root_terms & terms))
        lost = tuple(sorted(root_terms - terms))
        step_scores.append(
            GoalAncestryStepScore(
                index=index,
                goal_text=goal_text,
                root_overlap=_round(root_overlap),
                previous_overlap=_round(previous_overlap),
                retained_root_terms=retained,
                lost_root_terms=lost,
            )
        )
        root_overlaps.append(root_overlap)
        previous_overlaps.append(previous_overlap)
        previous_terms = terms

    root_anchor_retention = _round(sum(root_overlaps) / len(root_overlaps)) if root_overlaps else 0.0
    chain_coherence = _round(sum(previous_overlaps[1:]) / max(1, len(previous_overlaps) - 1)) if len(previous_overlaps) > 1 else root_anchor_retention
    final_root_overlap = root_overlaps[-1] if root_overlaps else 0.0
    drift_penalty = _round(_clamp_unit(max(0.0, root_anchor_retention - final_root_overlap)))

    # Weight final root retention most heavily; chain coherence catches gradual walkaway.
    raw_score = (0.55 * final_root_overlap) + (0.30 * root_anchor_retention) + (0.15 * chain_coherence) - (0.25 * drift_penalty)
    ancestry_score = _round(_clamp_unit(raw_score))

    notes: List[str] = []
    if ancestry_score < 0.35:
        notes.append("A(c_i) low: candidate lineage has drifted away from the root problem anchors.")
    elif ancestry_score < 0.70:
        notes.append("A(c_i) partial: candidate retains some root goal anchors but should remain under ancestry review.")
    else:
        notes.append("A(c_i) high: candidate lineage remains coherent with the original problem root.")

    return GoalAncestryScore(
        problem_id=candidate.problem_id or parent_manifest.problem_id,
        parent_hash=canonical_hash(parent_manifest),
        candidate_hash=canonical_hash(candidate),
        formula=GOAL_ANCESTRY_FORMULA,
        ancestry_score=ancestry_score,
        root_anchor_retention=root_anchor_retention,
        chain_coherence=chain_coherence,
        drift_penalty=drift_penalty,
        lineage_length=len(lineage),
        root_terms=tuple(sorted(root_terms)),
        step_scores=tuple(step_scores),
        score_notes=tuple(notes),
    )
