"""Entropy and χ thresholds. Not the admit gate.

RSOC Convergence Proof v4.8.
chi(t) Convergence Under Adversarial Conditions.
ProtoForge memory/drift.py, March 2026.

Φ5→Φ8 stays the forbidden Luciferian skip (Lemma 5: d_score is 1 only then).
C_min stays 0.87. The ≤0.35 write law is not this file.
Doc coherence floors 0.3 and 0.4 are internal phase checks only.
"""
from __future__ import annotations

import math
from typing import Any

GAMMA = 0.5
THETA_BASE = 0.4
THETA_HARD = 0.8
WINDOW = 8
TAU_MIN_MS = 18.7
CITE = (
    "RSOC Convergence Proof v4.8; "
    "chi(t) Convergence Under Adversarial Conditions; "
    "ProtoForge memory/drift.py Mar 2026"
)


def luciferian_d_score(prev_phase: Any, phi_act: Any) -> float:
    """Lemma 5. Zero-lag categorical detector. 1 iff previous phase is 5 and Φ_act is 8."""
    try:
        return 1.0 if int(prev_phase) == 5 and int(phi_act) == 8 else 0.0
    except (TypeError, ValueError):
        return 0.0


def _std(xs: list[float]) -> float:
    if len(xs) < 2:
        return 0.0
    mean = sum(xs) / len(xs)
    return math.sqrt(sum((x - mean) ** 2 for x in xs) / len(xs))


def local_curvature(phase_hist: list[Any] | None, window: int = WINDOW) -> float:
    """Variance of consecutive |Δphase| over the last `window` phases.

    One difference returns that difference. Fewer than two phases returns 0.
    """
    hist = [float(p) for p in (phase_hist or [])][-window:]
    diffs = [abs(hist[i] - hist[i - 1]) for i in range(1, len(hist))]
    if not diffs:
        return 0.0
    if len(diffs) == 1:
        return diffs[0]
    mean = sum(diffs) / len(diffs)
    return sum((d - mean) ** 2 for d in diffs) / len(diffs)


def adaptive_threshold(l_local: float, gamma: float = GAMMA) -> float:
    """θ_w = 0.4 / (1 + γ · L_local). γ defaults to 0.5."""
    return THETA_BASE / (1 + gamma * float(l_local))


def entropy_epsilon(phase_hist, phi_act, phi_exp, recursion_n, prev_phase) -> dict[str, Any]:
    """ε_s = (σ_res + d_score + δΦ) / max(1, recursion_n).

    σ_res is the standard deviation of phase_hist. δΦ = |Φ_act − Φ_exp| / 9.
    This ε_s is the entropy/χ measure. The admit path keeps its own formula.
    """
    hist = [float(p) for p in (phase_hist or [])]
    d_score = luciferian_d_score(prev_phase, phi_act)
    sigma = _std(hist)
    try:
        delta = abs(float(phi_act) - float(phi_exp)) / 9.0
    except (TypeError, ValueError):
        delta = 0.0
    n = max(1, int(recursion_n or 0))
    eps = (sigma + d_score + delta) / n
    return {
        "eps_s": round(eps, 6),
        "d_score": d_score,
        "sigma_res": round(sigma, 6),
        "delta_phi": round(delta, 6),
        "recursion_n": n,
        "cite": CITE,
    }


def chi_adaptive(eps_s: float, phase_hist, prev_phase=None, phi_act=None, gamma: float = GAMMA) -> dict[str, Any]:
    """χ(t) fires when ε_s > θ_w. θ_hard 0.8 always fires. θ_w is logged."""
    local = local_curvature(phase_hist, WINDOW)
    theta_w = adaptive_threshold(local, gamma)
    try:
        eps = float(eps_s)
    except (TypeError, ValueError):
        eps = 0.0
    hard = eps > THETA_HARD
    over = eps > theta_w
    return {
        "theta_w": round(theta_w, 6),
        "theta_hard": THETA_HARD,
        "L_local": round(local, 6),
        "gamma": gamma,
        "fires": hard or over,
        "hard_ceiling": hard,
        "above_theta_w": over,
        "d_score": luciferian_d_score(prev_phase, phi_act),
        "logged": True,
        "cite": CITE,
    }


def phase_velocity(stamps_ms: list[Any] | None) -> dict[str, Any]:
    """OQ3. v(t) = 1 when three sequential steps fall inside τ_min ≈ 18.7 ms.

    The source labels this 'no formal guarantee'.
    """
    stamps = [float(t) for t in (stamps_ms or [])]
    v = 0
    for i in range(0, max(0, len(stamps) - 2)):
        if stamps[i + 2] - stamps[i] <= TAU_MIN_MS:
            v = 1
            break
    return {"v": v, "tau_min_ms": TAU_MIN_MS, "guarantee": "no formal guarantee", "cite": CITE + " OQ3."}


def internal_phase_coherence(score: Any) -> dict[str, Any]:
    """0.3 and 0.4 are internal phase checks. They do not admit."""
    try:
        value = float(score)
    except (TypeError, ValueError):
        value = None
    return {
        "score": None if value is None else round(value, 6),
        "floor": 0.3,
        "preferred": 0.4,
        "above_floor": value is not None and value >= 0.3,
        "above_preferred": value is not None and value >= 0.4,
        "admit_gate": False,
        "C_min": 0.87,
        "cite": "Doc coherence minimums 0.3 and 0.4 are internal phase checks. C_min 0.87 stays the admit gate.",
    }
