"""χ collapse numbers from the Genesis Node spec, pages 116 and 143–145.

Phase names in that spec are not canonical. The canonical names stay the
Phase Glyph Codex v2.5 set. This file only applies the collapse arithmetic.
"""
from __future__ import annotations

import math
from typing import Any

CITE = "Genesis Node spec pp.116, 143-145. Those phase names are not canonical."
HALF_LIFE_HOURS = 168.0
LAMBDA = math.log(2) / HALF_LIFE_HOURS
RESIDUE_FRACTION = 0.22
CLEARED_FRACTION = 0.78
RESIDUE_CHARGE = 0.8
ENTROPY_FACTOR = 0.3
ACCESS_STEP = 0.01
ACCESS_CAP = 0.2
ACTIVE_ABOVE = 0.1
GC_BELOW = 0.05


def chi_collapse(state: dict[str, Any] | None) -> dict[str, Any]:
    """Reset to Φ1. Keep 22% of the drift as SPC override residue. Clear 78%.

    Entropy is multiplied by 0.3. The consecutive-drift count goes to 0.
    The residue charge is 0.8.
    """
    row = state if isinstance(state, dict) else {}
    try:
        drift = float(row.get("drift") if row.get("drift") is not None else row.get("eps") or 0.0)
    except (TypeError, ValueError):
        drift = 0.0
    try:
        entropy = float(row.get("entropy") or 0.0)
    except (TypeError, ValueError):
        entropy = 0.0
    residue = drift * RESIDUE_FRACTION
    return {
        "Phi": 1,
        "phase_name": "Initiation",
        "drift_before": drift,
        "drift_residue": residue,
        "drift_cleared": drift * CLEARED_FRACTION,
        "spc_override_residue": {"fraction": RESIDUE_FRACTION, "charge": RESIDUE_CHARGE},
        "entropy": entropy * ENTROPY_FACTOR,
        "consecutive_drift": 0,
        "writes": False,
        "cite": CITE,
    }


def spc_charge(c0: float, t_hours: float) -> float:
    """C = C0 · e^(−λt). Half-life is 168 hours."""
    return float(c0) * math.exp(-LAMBDA * float(t_hours))


def spc_access(access_total: float) -> dict[str, Any]:
    """Each access adds 0.01. The added charge caps at 0.2."""
    try:
        total = float(access_total)
    except (TypeError, ValueError):
        total = 0.0
    added = min(ACCESS_CAP, total + ACCESS_STEP)
    return {"added": round(added, 6), "step": ACCESS_STEP, "cap": ACCESS_CAP}


def spc_active(charge: float) -> bool:
    return float(charge) > ACTIVE_ABOVE


def spc_gc(charge: float) -> bool:
    return float(charge) < GC_BELOW
