"""±50% on the Proposal v1 nominals. Threshold floors are not inputs.

The numbers stay the approved nominals. This report only says how many of a
fixed pair list collide, and how often a nominal match is still recalled,
when those nominals are scaled. C_min, Echo, and the drift floors are read
back unchanged.
"""
from __future__ import annotations

from typing import Any

from rmc_engine_v1.frequency_203_config import EPSILON
from rmc_engine_v1.frequency_204_config import BETA, KAPPA, SEVER, ZETA
from rmc_engine_v1.mobile_config import THRESHOLDS

LABEL = "approved nominal, not validated"
MARKER = 144.0
# Fixed pairs. The first of each pair is the nominal position. The second is
# either inside the nominal ε band (a recall) or far outside it (not a recall).
PAIRS = (
    {"id": "close", "a": 144.0, "b": 144.0 + EPSILON * MARKER * 0.4, "recall": True},
    {"id": "edge", "a": 72.0, "b": 72.0 + EPSILON * 72.0 * 0.8, "recall": True},
    {"id": "apart", "a": 36.0, "b": 36.0 + EPSILON * 36.0 * 3.0, "recall": False},
    {"id": "stack", "a": 48.0, "b": 48.0, "recall": True},
)


def nominals() -> dict[str, float]:
    return {"zeta": ZETA, "beta": BETA, "sever": SEVER, "kappa": KAPPA, "epsilon": EPSILON}


def _scaled(scale: float) -> dict[str, float]:
    base = nominals()
    return {k: v * scale for k, v in base.items()}


def _hit(pair: dict[str, Any], epsilon: float) -> bool:
    return abs(float(pair["b"]) - float(pair["a"])) <= epsilon * max(abs(float(pair["a"])), 1.0)


def report(scale: float = 1.0) -> dict[str, Any]:
    consts = _scaled(scale)
    predicted = [p for p in PAIRS if _hit(p, consts["epsilon"])]
    true_pos = [p for p in predicted if p["recall"]]
    collisions = sum(1 for p in PAIRS if abs(float(p["b"]) - float(p["a"])) <= consts["epsilon"] * max(abs(float(p["a"])), 1.0) * 0.02)
    precision = (len(true_pos) / len(predicted)) if predicted else None
    floors = {k: THRESHOLDS.get(k) for k in ("C_min", "echo_min", "drift_quarantine", "hard_stop")}
    return {
        "label": LABEL,
        "scale": scale,
        "nominals": nominals(),
        "scaled": consts,
        "collisions": collisions,
        "recall_precision": precision,
        "predicted": len(predicted),
        "true_pos": len(true_pos),
        "floors": floors,
        "floors_unchanged": floors == {"C_min": 0.87, "echo_min": 0.85, "drift_quarantine": 0.35, "hard_stop": 0.8},
        "calls_llm": False,
    }


def sweep() -> list[dict[str, Any]]:
    return [report(s) for s in (0.5, 1.0, 1.5)]
