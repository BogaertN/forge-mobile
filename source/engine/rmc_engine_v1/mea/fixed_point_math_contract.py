"""
forge/rmc_engine_v1/mea/fixed_point_math_contract.py

MEA-DISCOVERY-KERNEL-MATH-CONFORMANCE-BUILD-006
Deterministic fixed-point numerical contract for future seal-critical MEA scoring.

Purpose
-------
The historical Patch 275-299 MEA corridor used bounded floating-point preview
scores and has already produced one sealed hypothesis memory record. Those
historical records remain immutable. This module defines the *forward*
production scoring contract so newly conformed candidate evaluations can be
hashed and replayed without float ambiguity.

The master equation implemented here is the MEA equation:

    Score(c_i) =
        αR(c_i) + βP(c_i) + γU(c_i) + δN(c_i)
        + ηI(c_i) + κΩ(c_i) + ρA(c_i)
        - λD(c_i) - μB(c_i) - νK(c_i)

All governed terms use integer micro-units:
    0          = 0.000000
    1_000_000  = 1.000000

All weights use integer basis points:
    10_000 = 1.0000 coefficient

No writes, network calls, LLM calls, shell execution, Chroma access,
Identity Vault access, Contribution Economy access, rendering, or routing.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from enum import Enum
import hashlib
import json
from typing import Any, Dict, Mapping, Tuple

BUILD_ID = "MEA-DISCOVERY-KERNEL-MATH-CONFORMANCE-BUILD-006"
SCHEMA_VERSION = "mea_fixed_point_math_contract_v1_build006"
UNIT_SCALE = 1_000_000
WEIGHT_SCALE = 10_000
SIGNED_SCORE_SCALE = UNIT_SCALE * WEIGHT_SCALE

POSITIVE_TERMS = ("R", "P", "U", "N", "I", "Omega", "A")
PENALTY_TERMS = ("D", "B", "K")
ALL_TERMS = POSITIVE_TERMS + PENALTY_TERMS


class ScoringMode(str, Enum):
    RESEARCH_SYNTHESIS = "research_synthesis"
    CODING_VERIFICATION = "coding_verification"
    THEORY_EXPLORATION = "theory_exploration"
    MEMORY_RECALL = "memory_recall"
    SAFETY_CRITICAL = "safety_critical"


_WEIGHT_SCHEDULES: Dict[str, Dict[str, int]] = {
    ScoringMode.RESEARCH_SYNTHESIS.value: {
        "R": 1000, "P": 1300, "U": 700, "N": 500,
        "I": 2000, "Omega": 1600, "A": 1400,
        "D": 1600, "B": 2300, "K": 500,
    },
    ScoringMode.CODING_VERIFICATION.value: {
        "R": 900, "P": 1700, "U": 900, "N": 250,
        "I": 1600, "Omega": 1500, "A": 1100,
        "D": 2300, "B": 2700, "K": 900,
    },
    ScoringMode.THEORY_EXPLORATION.value: {
        "R": 900, "P": 1100, "U": 600, "N": 1100,
        "I": 2300, "Omega": 1200, "A": 1000,
        "D": 1300, "B": 1900, "K": 300,
    },
    ScoringMode.MEMORY_RECALL.value: {
        "R": 2500, "P": 1000, "U": 300, "N": 0,
        "I": 0, "Omega": 0, "A": 1500,
        "D": 1500, "B": 1300, "K": 300,
    },
    ScoringMode.SAFETY_CRITICAL.value: {
        "R": 1000, "P": 2000, "U": 500, "N": 100,
        "I": 1300, "Omega": 1500, "A": 900,
        "D": 3000, "B": 3500, "K": 800,
    },
}


def canonical_json(value: Any) -> str:
    """Canonical JSON used for governed conformance hashes."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def canonical_hash(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def _require_int(name: str, value: Any) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise TypeError(f"{name} must be integer fixed-point data, got {type(value).__name__}")
    return value


def require_unit_micro(name: str, value: Any) -> int:
    value = _require_int(name, value)
    if not 0 <= value <= UNIT_SCALE:
        raise ValueError(f"{name} must be in [0, {UNIT_SCALE}], got {value}")
    return value


def require_weight_bps(name: str, value: Any) -> int:
    value = _require_int(name, value)
    if not 0 <= value <= WEIGHT_SCALE:
        raise ValueError(f"{name} must be in [0, {WEIGHT_SCALE}], got {value}")
    return value


def decimal_text_to_micro(value: str) -> int:
    """Convert textual decimal input to micro-units without binary floating-point."""
    if not isinstance(value, str) or not value.strip():
        raise TypeError("decimal value must be supplied as non-empty text")
    try:
        decimal_value = Decimal(value.strip())
    except InvalidOperation as exc:
        raise ValueError(f"invalid decimal text: {value!r}") from exc
    if decimal_value < Decimal("0") or decimal_value > Decimal("1"):
        raise ValueError("decimal value must be within [0, 1]")
    scaled = (decimal_value * Decimal(UNIT_SCALE)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return int(scaled)


def legacy_float_to_micro(value: float) -> int:
    """Compatibility converter for audit-only comparison with historic preview floats.

    The conversion first stringifies the legacy float and then uses Decimal.
    It must never be used as the source of a new seal-critical observation.
    """
    if isinstance(value, bool) or not isinstance(value, (float, int)):
        raise TypeError("legacy value must be numeric")
    return decimal_text_to_micro(str(value))


def micro_to_text(value: int) -> str:
    value = require_unit_micro("value", value)
    return f"{Decimal(value) / Decimal(UNIT_SCALE):.6f}"


def _weighted(term_micro: int, weight_bps: int) -> int:
    """Return rounded signed contribution in score-micro-bps space."""
    term = require_unit_micro("term_micro", term_micro)
    weight = require_weight_bps("weight_bps", weight_bps)
    return term * weight


@dataclass(frozen=True)
class FixedPointScoreResult:
    mode: str
    terms_micro: Dict[str, int]
    weights_bps: Dict[str, int]
    positive_contributions: Dict[str, int]
    penalty_contributions: Dict[str, int]
    positive_total: int
    penalty_total: int
    signed_score_micro_bps: int
    signed_score_decimal_text: str
    score_hash: str
    schema_version: str = SCHEMA_VERSION
    build_id: str = BUILD_ID

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def weight_schedule(mode: str) -> Dict[str, int]:
    if mode not in _WEIGHT_SCHEDULES:
        raise ValueError(f"Unknown scoring mode: {mode!r}")
    return dict(_WEIGHT_SCHEDULES[mode])


def score_terms_fixed_point(
    terms_micro: Mapping[str, int],
    *,
    mode: str = ScoringMode.RESEARCH_SYNTHESIS.value,
    weights_bps: Mapping[str, int] | None = None,
) -> FixedPointScoreResult:
    """Execute the MEA master equation entirely with governed integers."""
    if set(terms_micro) != set(ALL_TERMS):
        missing = sorted(set(ALL_TERMS) - set(terms_micro))
        extra = sorted(set(terms_micro) - set(ALL_TERMS))
        raise ValueError(f"terms_micro must contain exact MEA terms; missing={missing}, extra={extra}")
    terms = {term: require_unit_micro(term, terms_micro[term]) for term in ALL_TERMS}
    weights = weight_schedule(mode) if weights_bps is None else {
        term: require_weight_bps(term, weights_bps[term]) for term in ALL_TERMS
    }
    positive = {term: _weighted(terms[term], weights[term]) for term in POSITIVE_TERMS}
    penalties = {term: _weighted(terms[term], weights[term]) for term in PENALTY_TERMS}
    positive_total = sum(positive.values())
    penalty_total = sum(penalties.values())
    signed = positive_total - penalty_total
    decimal = (Decimal(signed) / Decimal(SIGNED_SCORE_SCALE)).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
    body = {
        "mode": mode,
        "terms_micro": terms,
        "weights_bps": weights,
        "positive_contributions": positive,
        "penalty_contributions": penalties,
        "positive_total": positive_total,
        "penalty_total": penalty_total,
        "signed_score_micro_bps": signed,
        "signed_score_decimal_text": format(decimal, "f"),
        "schema_version": SCHEMA_VERSION,
        "build_id": BUILD_ID,
    }
    return FixedPointScoreResult(score_hash=canonical_hash(body), **body)


def fixed_point_boundary() -> Dict[str, Any]:
    return {
        "build_id": BUILD_ID,
        "schema_version": SCHEMA_VERSION,
        "formula": "Score(c_i)=αR+βP+γU+δN+ηI+κOmega+ρA-λD-μB-νK",
        "unit_scale": UNIT_SCALE,
        "weight_scale": WEIGHT_SCALE,
        "governed_numeric_type": "integer_fixed_point_micro_units_only",
        "legacy_float_values_allowed_as_new_governed_input": False,
        "historical_float_records_preserved_without_rewrite": True,
        "writes_files": False,
        "writes_memory": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "writes_chroma": False,
        "calls_llm": False,
        "executes_shell": False,
        "renders_output": False,
    }


__all__ = [
    "ALL_TERMS", "BUILD_ID", "SCHEMA_VERSION", "UNIT_SCALE", "WEIGHT_SCALE",
    "ScoringMode", "FixedPointScoreResult", "canonical_json", "canonical_hash",
    "decimal_text_to_micro", "legacy_float_to_micro", "micro_to_text",
    "require_unit_micro", "require_weight_bps", "weight_schedule",
    "score_terms_fixed_point", "fixed_point_boundary",
]
