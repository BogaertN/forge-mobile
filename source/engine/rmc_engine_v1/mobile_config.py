"""Tunable Forge Mobile thresholds for the live Ask gate.

The router's 0.72 circuit breaker and 0.78 babel cutoff stay in
containment_router.py. They are recorded here as reference_only. They do not
admit an answer. Nic, 2026-10-29: C_min 0.87, echo similarity 0.85, drift
quarantine 0.35, hard stop 0.80.

4.9.211 (DRIFT-SPEC/v1 resolved, Nic plan Release B): DRIFT_POLICY below mirrors
kmath.js DRIFT_POLICY and the SQL app.drift_policy() (r4211 checks the parity).
The hard stop is INCLUSIVE (epsilon >= 0.80). "resonance_epsilon" (the
sigma_res <= 0.35 admit gate, no paper basis) and Athena's Membrane-A 0.78 are
reference_only: they no longer gate anything.
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
    "hard_stop_inclusive": True,
    "resonance_epsilon_role": "reference_only",
}

# DENOMINATOR "max1_depth" is the write-trace normaliser only (drift_policy.drift_measure). The Ask candidate
# eps keeps (sigma_res + D_score + |dPhi|) / 3: canonical per Nic 2026-11-01 (the nine-phase / 144 triad scale;
# RMC 6.3 n = 3). DRIFT-SPEC/v1 D3, resolved in 4.9.217.
DRIFT_POLICY: dict[str, Any] = {
    "schema": "FORGE-DRIFT-POLICY/v1",
    "profile": "nic-2026-10-14/v2",
    "METRIC_ID": "eps_s/rsoc-v4.8+circ/v1",
    "DENOMINATOR": "max1_depth",
    "PHASE_SCHEME_ID": "phase-scheme/rmc/v1",
    "ADMIT_MAX": 0.35,
    "EXPLORE_MIN": 0.40,
    "HARD_MIN": 0.80,
    "HARD_INCLUSIVE": True,
    "THETA_W_BASE": 0.40,
    "GAMMA": 0.5,
    "ECHO_MIN": 0.85,
    "ECHO_MEMORY_MIN": 0.97,
    "C_MIN": 0.87,
    "LAMBDA_DRIFT": 0.18,
    "CHI_CORRECT_PASSES": 1,
    "CHI_GRACE_PER_LOOP": 1,
    "CHRISTPING_SETTLE_MS": 3330,
    "BREAKER_FAILS": 3,
    "BREAKER_RECOVER_S": 60,
    "RESURRECTION_LIMIT": 5,
    "TREND_K": 3,
    "ACCEL_NV": 3,
    "ACCEL_TAU_MS": 18.7,
    "FORBIDDEN": {"rmc": [[5, 8], [4, 8]], "backward": True},
    "CHECK_ORDER": ["forbidden", "hard_stop", "acceleration", "explore", "correct", "clean"],
    "ECHO_CLASSES": ["negation", "certainty", "condition"],
    "reference_only": {"athena_membrane_a": 0.78, "router_circuit": 0.72, "router_babel": 0.78, "gilin_crp": 0.78, "sigma_res_gate": 0.35},
}


def snapshot(measured: dict[str, Any] | None = None) -> dict[str, Any]:
    out = dict(THRESHOLDS)
    out["measured"] = dict(measured or {})
    return out
