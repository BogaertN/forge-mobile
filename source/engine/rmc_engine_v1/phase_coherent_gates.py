"""Seven-gate cold-storage resurrection.

Phase-Coherent Memory Architecture. All seven gates must pass.
dream_idle stays off. This function does not write and does not start a dream.
"""
from __future__ import annotations

from typing import Any

CITE = "Phase-Coherent Memory Architecture, seven-gate resurrection. dream_idle stays off."


def _num(value: Any, default: float | None = None):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def phase_coherent_resurrection(record: dict[str, Any] | None) -> dict[str, Any]:
    """Return the seven gates. A missing record fails every gate."""
    row = record if isinstance(record, dict) else {}
    phase = _num(row.get("phase"), None)
    if phase is None and isinstance(row.get("phase_at"), str) and str(row.get("phase_at")).endswith("9"):
        phase = 9
    noise = _num(row.get("noise_floor"), None)
    chi_threshold = _num(row.get("chi_threshold"), 0.4)
    identity = row.get("identity")
    expected = row.get("identity_expected")
    identity_ok = identity not in (None, "") and (expected in (None, "") or identity == expected)
    log = row.get("resurrection_log")
    log_ok = row.get("resurrection_log_valid") is True or (isinstance(log, dict) and log.get("valid") is True)
    cycle = _num(row.get("cycle_count"), None)
    limit = _num(row.get("resurrection_limit"), None)
    cycle_ok = cycle is not None and limit is not None and cycle < limit
    capacity = row.get("capacity_ok")
    if capacity is None:
        have = _num(row.get("capacity"), None)
        need = _num(row.get("capacity_required"), None)
        capacity = have is not None and need is not None and have >= need
    gates = [
        {"n": 1, "id": "phase_timing_phi9", "pass": phase == 9, "detail": "phase timing at Φ9"},
        {"n": 2, "id": "noise_floor_below_chi", "pass": noise is not None and chi_threshold is not None and noise < chi_threshold, "detail": "noise floor below the χ threshold"},
        {"n": 3, "id": "not_under_active_drift", "pass": row.get("active_drift") is not True, "detail": "not under active drift"},
        {"n": 4, "id": "identity", "pass": identity_ok, "detail": "identity present"},
        {"n": 5, "id": "resurrection_log_valid", "pass": log_ok, "detail": "resurrection_log validity"},
        {"n": 6, "id": "cycle_count_below_limit", "pass": cycle_ok, "detail": "cycle_count < resurrection_limit"},
        {"n": 7, "id": "capacity", "pass": capacity is True, "detail": "capacity"},
    ]
    return {
        "ok": all(g["pass"] for g in gates),
        "gates": gates,
        "writes": False,
        "dream_idle": False,
        "calls_llm": False,
        "cite": CITE,
    }
