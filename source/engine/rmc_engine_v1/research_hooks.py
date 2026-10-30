"""Named research hooks. One config.

Nic approved these values on 2026-10-30.
Resonant Symbolic Operator Calculus Google Doc, Dec 2025.
Genesis Node spec gnspec l.6743-6820, l.7510.
Geometry, the SPC charge, and the RMC renderer read this object.
"""
from __future__ import annotations

import math
from typing import Any

CITE = (
    "Resonant Symbolic Operator Calculus Google Doc, Dec 2025. "
    "Genesis Node spec gnspec l.6743-6820, l.7510."
)

RESEARCH_HOOKS: dict[str, Any] = {
    "mu_min": 0.1,
    "mu_max": 10,
    "mu_birth": 1.0,
    "half_life_hours": 168,
    "identity_half_life_hours": 720,
    "access_step": 0.05,
    "access_cap": 1.0,
    "access_bonus_per": 0.01,
    "access_bonus_cap": 0.2,
    "active_above": 0.1,
    "merge_mu_bonus": 0.12,
    "sever_mu_loss": 0.08,
    "amplify_decay": 2.2,
    "amplify_k_min": 1,
    "amplify_k_max": 2,
    "discharge_eps_factor": 0.3,
    "discharge_echo_decay": 1.8,
    "phase8_mu": 0,
    "eta": 0.003,
    "drift_loss": "amplify",
    "cite": CITE,
}


def half_life_hours() -> float:
    return float(RESEARCH_HOOKS["half_life_hours"])


def identity_half_life_hours() -> float:
    return float(RESEARCH_HOOKS["identity_half_life_hours"])


def spc_lambda(half_hours: float | None = None) -> float:
    half = half_life_hours() if half_hours is None else float(half_hours)
    return math.log(2) / half


def memory_term(integral: float | None = None, t_hours: float | None = None, identity: bool = False) -> dict[str, Any]:
    half = identity_half_life_hours() if identity else half_life_hours()
    lam = math.log(2) / half
    has = integral is not None and t_hours is not None
    return {
        "formula": "M = exp(-lambda t) * integral A.C dt",
        "lambda": lam,
        "half_life_hours": half,
        "integral": None if not has else float(integral),
        "t_hours": None if not has else float(t_hours),
        "value": None if not has else math.exp(-lam * float(t_hours)) * float(integral),
        "mu_min": RESEARCH_HOOKS["mu_min"],
        "mu_max": RESEARCH_HOOKS["mu_max"],
        "mu_birth": RESEARCH_HOOKS["mu_birth"],
        "cite": CITE,
    }


def memory_term_m() -> float:
    return float(RESEARCH_HOOKS["mu_birth"])


def charge_decay(c0: float, t_hours: float, identity: bool = False) -> float:
    half = identity_half_life_hours() if identity else half_life_hours()
    return float(c0) * math.exp(-spc_lambda(half) * float(t_hours))


def access_report(count: float) -> dict[str, Any]:
    from rmc_engine_v1.genesis_collapse import spc_access, spc_active

    try:
        n = max(0.0, float(count))
    except (TypeError, ValueError):
        n = 0.0
    step = spc_access(0)
    bonus = min(float(step["cap"]), float(step["step"]) * n)
    lift = min(float(RESEARCH_HOOKS["access_cap"]), float(RESEARCH_HOOKS["access_step"]) * n)
    return {
        "count": n,
        "lift": lift,
        "bonus": bonus,
        "active_above": RESEARCH_HOOKS["active_above"],
        "active": spc_active(lift),
        "cite": CITE,
    }
