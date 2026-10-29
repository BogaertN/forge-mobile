"""
forge/rmc_engine_v1/mea/operator_cost_scorer.py

Patch 277 — MEA Convergence / Ancestry / Cost Scoring.

Computes MEA operator cost:

    K(c_i) = normalized resource cost of the operator chain

Patch 278 will formalize operator_registry.py. Until that registry exists, this
module carries a deterministic provisional schedule with the same public shape:
operator_id -> unit cost in [0.0, 1.0]. The schedule is conservative and
side-effect free.

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

from dataclasses import asdict, dataclass, field
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple, Union

from .manifest_schema import CandidateManifest, OperatorTrace, ProblemManifest, canonical_hash

OPERATOR_COST_SCORER_PATCH_ID = "Patch 277 — MEA Convergence / Ancestry / Cost Scoring"
OPERATOR_COST_FORMULA = "K(c_i) = normalized_sum(operator_costs)"
OPERATOR_COST_SCHEMA_VERSION = "mea_operator_cost_score_v1_patch277"

# Patch 278 will externalize this into operator_registry.py. The values here are
# intentionally explicit so Patch 277 can test K(c_i) without a live registry.
DEFAULT_OPERATOR_COST_SCHEDULE: Dict[str, float] = {
    "check_phase": 0.05,
    "check_constraint": 0.06,
    "check_evidence": 0.12,
    "check_proof_debt": 0.10,
    "detect_unknowns": 0.08,
    "score_information_gain": 0.10,
    "score_convergence": 0.10,
    "score_goal_ancestry": 0.10,
    "score_operator_cost": 0.05,
    "branch": 0.18,
    "hypothesize": 0.22,
    "derive": 0.35,
    "compare": 0.18,
    "replay": 0.30,
    "external_search": 0.75,
    "run_simulation": 0.85,
    "llm_generate": 0.80,
    "unknown": 0.50,
}


def _round(value: float) -> float:
    return round(float(value), 6)


def _clamp_unit(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _operator_id_from_item(item: Union[str, Mapping[str, Any], OperatorTrace]) -> str:
    if isinstance(item, OperatorTrace):
        return str(item.operator_id).strip() or "unknown"
    if isinstance(item, str):
        return item.strip() or "unknown"
    if isinstance(item, Mapping):
        for key in ("operator_id", "id", "name", "operator"):
            value = item.get(key)
            if value:
                return str(value).strip() or "unknown"
    return "unknown"


def _trace_from_candidate(candidate_or_manifest: Union[CandidateManifest, ProblemManifest, Sequence[Union[str, Mapping[str, Any], OperatorTrace]]]) -> Tuple[Union[str, Mapping[str, Any], OperatorTrace], ...]:
    if isinstance(candidate_or_manifest, CandidateManifest):
        items: List[Union[str, Mapping[str, Any], OperatorTrace]] = []
        if candidate_or_manifest.proposed_state is not None:
            items.extend(candidate_or_manifest.proposed_state.operator_history)
        if candidate_or_manifest.operator_trace is not None:
            items.append(candidate_or_manifest.operator_trace)
        return tuple(items)
    if isinstance(candidate_or_manifest, ProblemManifest):
        return tuple(candidate_or_manifest.operator_history)
    if isinstance(candidate_or_manifest, Sequence) and not isinstance(candidate_or_manifest, (str, bytes, bytearray)):
        return tuple(candidate_or_manifest)
    raise TypeError("score_operator_cost expects CandidateManifest, ProblemManifest, or a sequence of operator traces")


def _problem_id(candidate_or_manifest: Union[CandidateManifest, ProblemManifest, Sequence[Any]]) -> str:
    if isinstance(candidate_or_manifest, CandidateManifest):
        return candidate_or_manifest.problem_id or (candidate_or_manifest.proposed_state.problem_id if candidate_or_manifest.proposed_state else "operator_chain")
    if isinstance(candidate_or_manifest, ProblemManifest):
        return candidate_or_manifest.problem_id
    return "operator_chain"


def _hash_for(candidate_or_manifest: Union[CandidateManifest, ProblemManifest, Sequence[Any]]) -> str:
    if isinstance(candidate_or_manifest, CandidateManifest) and candidate_or_manifest.proposed_state is not None:
        return canonical_hash(candidate_or_manifest.proposed_state)
    if isinstance(candidate_or_manifest, ProblemManifest):
        return canonical_hash(candidate_or_manifest)
    return "operator_chain_no_manifest"


@dataclass(frozen=True)
class OperatorCostEntry:
    operator_id: str
    unit_cost: float
    known_operator: bool

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class OperatorCostScore:
    problem_id: str
    candidate_hash: str
    formula: str
    operator_cost: float
    raw_cost_sum: float
    operator_count: int
    known_operator_count: int
    unknown_operator_count: int
    max_reasonable_chain_cost: float
    cost_entries: Tuple[OperatorCostEntry, ...]
    score_notes: Tuple[str, ...] = field(default_factory=tuple)
    patch_id: str = OPERATOR_COST_SCORER_PATCH_ID
    schema_version: str = OPERATOR_COST_SCHEMA_VERSION

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def scoring_boundary() -> Dict[str, Any]:
    return {
        "patch": OPERATOR_COST_SCORER_PATCH_ID,
        "layer": "MEA scoring foundation / operator cost",
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


def score_operator_cost(
    candidate_or_manifest: Union[CandidateManifest, ProblemManifest, Sequence[Union[str, Mapping[str, Any], OperatorTrace]]],
    *,
    cost_schedule: Optional[Mapping[str, float]] = None,
    max_reasonable_chain_cost: float = 1.25,
) -> OperatorCostScore:
    """Compute normalized K(c_i) for a candidate operator chain."""

    if max_reasonable_chain_cost <= 0:
        raise ValueError("max_reasonable_chain_cost must be positive")
    schedule = dict(DEFAULT_OPERATOR_COST_SCHEDULE)
    if cost_schedule:
        for key, value in cost_schedule.items():
            schedule[str(key)] = _clamp_unit(float(value))

    trace = _trace_from_candidate(candidate_or_manifest)
    entries: List[OperatorCostEntry] = []
    raw_sum = 0.0
    known_count = 0
    for item in trace:
        operator_id = _operator_id_from_item(item)
        known = operator_id in schedule
        unit_cost = float(schedule.get(operator_id, schedule["unknown"]))
        raw_sum += unit_cost
        known_count += 1 if known else 0
        entries.append(OperatorCostEntry(operator_id=operator_id, unit_cost=_round(unit_cost), known_operator=known))

    operator_count = len(entries)
    unknown_count = operator_count - known_count
    normalized = _clamp_unit(raw_sum / max_reasonable_chain_cost)

    notes: List[str] = []
    if operator_count == 0:
        notes.append("K(c_i)=0: no operator trace is present yet; later replay patches must require trace before sealing.")
    elif normalized >= 0.70:
        notes.append("K(c_i) high: expensive operator chain; prefer cheaper equivalent candidates when quality is equal.")
    else:
        notes.append("K(c_i) acceptable: operator chain cost remains within the conservative Patch 277 schedule.")
    if unknown_count:
        notes.append("Unknown operator IDs were charged at the conservative default cost.")

    return OperatorCostScore(
        problem_id=_problem_id(candidate_or_manifest),
        candidate_hash=_hash_for(candidate_or_manifest),
        formula=OPERATOR_COST_FORMULA,
        operator_cost=_round(normalized),
        raw_cost_sum=_round(raw_sum),
        operator_count=operator_count,
        known_operator_count=known_count,
        unknown_operator_count=unknown_count,
        max_reasonable_chain_cost=_round(max_reasonable_chain_cost),
        cost_entries=tuple(entries),
        score_notes=tuple(notes),
    )
