"""
forge/rmc_engine_v1/mea/convergence_scorer.py

Patch 277 — MEA Convergence / Ancestry / Cost Scoring.

Computes MEA convergence:

    Omega(c_i) = success-condition satisfaction against M_t.success_conditions

Omega answers a narrow question: did the candidate move the problem state toward
its stated success criteria? It is intentionally separate from information gain.
A candidate can add facts and still fail to converge if those facts do not satisfy
the problem's success conditions.

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

CONVERGENCE_SCORER_PATCH_ID = "Patch 277 — MEA Convergence / Ancestry / Cost Scoring"
CONVERGENCE_FORMULA = "Omega(c_i) = satisfied_success_conditions / total_success_conditions"
CONVERGENCE_SCHEMA_VERSION = "mea_convergence_score_v1_patch277"

_TEXT_RE = re.compile(r"[^a-z0-9]+")
_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "if", "in", "into",
    "is", "it", "its", "of", "on", "or", "that", "the", "their", "then", "this", "to", "with", "without",
    "found", "exists", "condition", "conditions", "must", "should", "can", "could", "would", "after", "full",
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
            raise ValueError("CandidateManifest requires proposed_state for convergence scoring")
        return candidate_or_manifest.proposed_state
    raise TypeError("score_convergence expects CandidateManifest or ProblemManifest")


def _state_text_pool(parent: ProblemManifest, state: ProblemManifest) -> Tuple[str, ...]:
    parent_known = {_normalise_text(v) for v in parent.known_facts}
    parent_assumptions = {_normalise_text(v.text) for v in parent.assumptions}
    parent_goals = {_normalise_text(parent.goal), *(_normalise_text(v) for v in parent.goal_ancestry)}

    parts: List[str] = []

    # Convergence must be earned by the candidate, not inherited from M_t.
    # Therefore unchanged parent facts do not count as success evidence.
    if _normalise_text(state.goal) not in parent_goals:
        parts.append(state.goal)
    for fact in state.known_facts:
        if _normalise_text(fact) not in parent_known:
            parts.append(fact)
    for assumption in state.assumptions:
        if _normalise_text(assumption.text) not in parent_assumptions:
            parts.append(assumption.text)
    for goal in state.goal_ancestry:
        if _normalise_text(goal) not in parent_goals:
            parts.append(goal)

    # Constraints and failure conditions define boundaries; they are not evidence
    # that success has been reached. Including them as evidence creates false
    # convergence on statements like "No measurement exists".
    return tuple(p for p in parts if str(p).strip())


def _overlap_ratio(condition_tokens: Set[str], evidence_tokens: Set[str]) -> float:
    if not condition_tokens:
        return 0.0
    return len(condition_tokens & evidence_tokens) / len(condition_tokens)


def _negates_condition(evidence_text: str, condition: str) -> bool:
    evidence = _tokens(evidence_text)
    cond = _tokens(condition)
    negative = {"no", "not", "without", "lacks", "lack", "absent", "absence", "missing", "unfound"}
    positive_condition = {"found", "exists", "measurement", "published", "derived", "derivation", "chain"}
    return bool(evidence & negative) and bool(cond & positive_condition)


def _condition_score(condition: str, parent: ProblemManifest, candidate: ProblemManifest) -> Tuple[float, Tuple[str, ...]]:
    cond_norm = _normalise_text(condition)
    cond_tokens = _tokens(condition)
    candidate_texts = _state_text_pool(parent, candidate)
    parent_unknowns = {_normalise_text(u) for u in parent.unknowns}
    candidate_unknowns = {_normalise_text(u) for u in candidate.unknowns}
    resolved_unknowns = tuple(sorted(parent_unknowns - candidate_unknowns))

    exact_matches: List[str] = []
    partial_matches: List[Tuple[float, str]] = []
    for text in candidate_texts:
        norm = _normalise_text(text)
        if not norm:
            continue
        negated = _negates_condition(text, condition)
        if cond_norm and (cond_norm in norm or norm in cond_norm) and not negated:
            exact_matches.append(text)
            continue
        ratio = _overlap_ratio(cond_tokens, _tokens(text))
        if negated:
            ratio = min(ratio, 0.20)
        if ratio > 0.0:
            partial_matches.append((ratio, text))

    if exact_matches:
        return 1.0, tuple(exact_matches[:3])

    best_ratio = max((ratio for ratio, _ in partial_matches), default=0.0)
    matched_texts = tuple(text for ratio, text in sorted(partial_matches, reverse=True)[:3])

    # If a success condition directly names a resolved unknown, award partial convergence.
    resolved_bonus = 0.0
    for unknown in resolved_unknowns:
        if unknown and (_overlap_ratio(cond_tokens, _tokens(unknown)) >= 0.45 or unknown in cond_norm):
            resolved_bonus = max(resolved_bonus, 0.45)

    score = max(best_ratio, resolved_bonus)
    # Preserve strictness: weak keyword overlap is a hint, not convergence.
    if 0.0 < score < 0.35:
        score *= 0.5
    return _clamp_unit(score), matched_texts


@dataclass(frozen=True)
class SuccessConditionScore:
    condition: str
    score: float
    satisfied: bool
    matched_evidence: Tuple[str, ...] = field(default_factory=tuple)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class ConvergenceScore:
    problem_id: str
    parent_hash: str
    candidate_hash: str
    formula: str
    omega: float
    fully_satisfied_count: int
    partial_satisfied_count: int
    total_success_conditions: int
    condition_scores: Tuple[SuccessConditionScore, ...]
    score_notes: Tuple[str, ...] = field(default_factory=tuple)
    patch_id: str = CONVERGENCE_SCORER_PATCH_ID
    schema_version: str = CONVERGENCE_SCHEMA_VERSION

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def scoring_boundary() -> Dict[str, Any]:
    return {
        "patch": CONVERGENCE_SCORER_PATCH_ID,
        "layer": "MEA scoring foundation / convergence",
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


def score_convergence(
    parent_manifest: ProblemManifest,
    candidate_or_manifest: Union[CandidateManifest, ProblemManifest],
) -> ConvergenceScore:
    """Compute Omega(c_i) for one candidate against parent success conditions."""

    if not isinstance(parent_manifest, ProblemManifest):
        raise TypeError("parent_manifest must be ProblemManifest")
    candidate = _candidate_state(candidate_or_manifest)

    condition_texts = tuple(str(c).strip() for c in parent_manifest.success_conditions if str(c).strip())
    if not condition_texts:
        return ConvergenceScore(
            problem_id=candidate.problem_id or parent_manifest.problem_id,
            parent_hash=canonical_hash(parent_manifest),
            candidate_hash=canonical_hash(candidate),
            formula=CONVERGENCE_FORMULA,
            omega=0.0,
            fully_satisfied_count=0,
            partial_satisfied_count=0,
            total_success_conditions=0,
            condition_scores=tuple(),
            score_notes=("No success_conditions available; Omega cannot be earned.",),
        )

    condition_scores: List[SuccessConditionScore] = []
    for condition in condition_texts:
        score, matched = _condition_score(condition, parent_manifest, candidate)
        condition_scores.append(
            SuccessConditionScore(
                condition=condition,
                score=_round(score),
                satisfied=score >= 0.80,
                matched_evidence=matched,
            )
        )

    raw_omega = sum(item.score for item in condition_scores) / len(condition_scores)
    omega = _round(_clamp_unit(raw_omega))
    fully = sum(1 for item in condition_scores if item.satisfied)
    partial = sum(1 for item in condition_scores if 0.0 < item.score < 0.80)

    notes: List[str] = []
    if omega == 0.0:
        notes.append("Omega(c_i)=0: candidate does not converge on the stored success conditions.")
    elif fully == len(condition_scores):
        notes.append("Omega(c_i)=1: all stored success conditions appear satisfied by deterministic evidence text.")
    else:
        notes.append("Omega(c_i)>0: candidate partially converges; later gates must still check proof debt, replay, and claim status.")

    return ConvergenceScore(
        problem_id=candidate.problem_id or parent_manifest.problem_id,
        parent_hash=canonical_hash(parent_manifest),
        candidate_hash=canonical_hash(candidate),
        formula=CONVERGENCE_FORMULA,
        omega=omega,
        fully_satisfied_count=fully,
        partial_satisfied_count=partial,
        total_success_conditions=len(condition_scores),
        condition_scores=tuple(condition_scores),
        score_notes=tuple(notes),
    )
