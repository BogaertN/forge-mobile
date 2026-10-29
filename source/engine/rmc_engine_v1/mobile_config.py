"""Tunable Forge Mobile thresholds for the live Ask gate.

The router's 0.72 circuit breaker and 0.78 babel cutoff stay in
containment_router.py. They are recorded here as reference_only. They do not
admit an answer. Nic, 2026-10-29: C_min 0.87, echo similarity 0.85, drift
quarantine 0.35, hard stop 0.80.
"""
from __future__ import annotations

from typing import Any

THRESHOLDS: dict[str, Any] = {
    "C_min": 0.87,
    "echo_min": 0.85,
    "drift_quarantine": 0.35,
    "hard_stop": 0.80,
    "resonance_epsilon": 0.35,
    "christping_consecutive_drifts": 3,
    "christping_pressure": 0.80,
    "router_circuit_breaker_reference": 0.72,
    "router_babel_cutoff_reference": 0.78,
    "router_reference_role": "reference_only",
    "label": "nic-2026-10-29-strict-start",
}


def snapshot(measured: dict[str, Any] | None = None) -> dict[str, Any]:
    out = dict(THRESHOLDS)
    out["measured"] = dict(measured or {})
    return out
