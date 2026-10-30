"""In-framework ProtoForge and Gilligan stages for the language core.

The phone does not import the external ProtoForge drift monitor. That copy
writes a log and is not in this tree. DriftTaxonomy and DriftCircuitBreaker
here use Nic's drift bands and the codex phase gates. They do not replace
the structural drift measurement and they do not lower C_min.

ChristPing stays Gilligan-only. Ask does not start it. No LLM. No shell.
Packs stay gated. Money stays disabled.
"""
from __future__ import annotations

from typing import Any

PROJECT_MAX = 0.35
CHI_MAX = 0.40
HARD_STOP = 0.80
C_MIN = 0.87
CONSECUTIVE_FAILURES = 3
FORBIDDEN_STEPS = {(5, 8), (4, 8)}

# Names the phase parser lists as required. A numeric rule is filled only
# when a document states it. The others stay unspecified.
TAXONOMY = (
    {
        "name": "catastrophic",
        "when": "epsilon_s > 0.80",
        "status": "stated",
        "cite": "Nic drift ruling 2026-10-14; hard stop above 0.80",
    },
    {
        "name": "resonant",
        "when": "0.35 < epsilon_s < 0.40",
        "status": "stated",
        "cite": "Nic drift ruling; the chi correction band. Gilligan holds it.",
    },
    {
        "name": "structural",
        "when": "0.40 <= epsilon_s <= 0.80 or a forbidden phase step",
        "status": "stated",
        "cite": "Nic drift ruling quarantine; RMC Addendum forbidden Φ5→Φ8 and Φ4→Φ8",
    },
    {"name": "syntactic", "when": "unspecified", "status": "unspecified", "cite": "No numeric syntactic cut in RPMC §1.4, the Glyph Codex, or Unified Algebra."},
    {"name": "semantic", "when": "unspecified", "status": "unspecified", "cite": "No numeric semantic cut in those three documents."},
    {"name": "recursive", "when": "unspecified", "status": "unspecified", "cite": "No numeric recursive cut in those three documents."},
    {"name": "evolutionary", "when": "unspecified", "status": "unspecified", "cite": "No numeric evolutionary cut in those three documents."},
)


def _eps(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number:
        return None
    return number


def drift_taxonomy(epsilon_s: Any, transition: dict[str, Any] | None = None) -> dict[str, Any]:
    eps = _eps(epsilon_s)
    forbidden = False
    if isinstance(transition, dict):
        pair = (transition.get("from"), transition.get("to"))
        forbidden = pair in {(5, 8), (4, 8)}
    active = []
    if eps is None:
        band = "unmeasured"
    elif eps > HARD_STOP or forbidden:
        band = "hard_stop" if eps is not None and eps > HARD_STOP else "forbidden"
        active.append("catastrophic" if eps is not None and eps > HARD_STOP else "structural")
    elif eps > PROJECT_MAX and eps < CHI_MAX:
        band = "correct"
        active.append("resonant")
    elif eps >= CHI_MAX:
        band = "elevated"
        active.append("structural")
    else:
        band = "clean"
    if forbidden and "structural" not in active:
        active.append("structural")
    return {
        "epsilon_s": None if eps is None else round(eps, 6),
        "band": band,
        "active": active,
        "rows": list(TAXONOMY),
        "unspecified": [row["name"] for row in TAXONOMY if row["status"] == "unspecified"],
        "calls_llm": False,
        "writes": False,
    }


def _sample(item: Any) -> tuple[float | None, dict[str, Any] | None]:
    if isinstance(item, dict):
        return _eps(item.get("epsilon_s", item.get("eps"))), item
    return _eps(item), None


def _failed(epsilon_s: Any, transition: dict[str, Any] | None) -> tuple[bool, bool, bool]:
    eps = _eps(epsilon_s)
    forbidden = False
    if isinstance(transition, dict):
        forbidden = (transition.get("from"), transition.get("to")) in FORBIDDEN_STEPS
    hard = eps is not None and eps > HARD_STOP
    failed = forbidden or (eps is not None and eps > PROJECT_MAX)
    return failed, forbidden, hard


def drift_circuit_breaker(epsilon_s: Any, transition: dict[str, Any] | None = None, history: list[Any] | None = None) -> dict[str, Any]:
    """Open on a hard stop, a forbidden step, or 3 consecutive failures.

    A failure is ε_s above 0.35 or a forbidden Φ5→Φ8 / Φ4→Φ8 step.
    Nic 4.9.191. One mild failure stays closed. C_min is not lowered.
    ChristPing is not started. Money stays disabled.
    """
    samples: list[Any] = list(history or [])
    samples.append({"epsilon_s": epsilon_s, "from": (transition or {}).get("from"), "to": (transition or {}).get("to")})
    consecutive = 0
    for item in reversed(samples):
        eps, row = _sample(item)
        step = row if isinstance(row, dict) and ("from" in row or "to" in row) else None
        failed, _forbidden, _hard = _failed(eps, step)
        if not failed:
            break
        consecutive += 1
    failed, forbidden, hard = _failed(epsilon_s, transition)
    trip = hard or forbidden or consecutive >= CONSECUTIVE_FAILURES
    if forbidden:
        reason = "forbidden_step"
    elif hard:
        reason = "hard_stop"
    elif consecutive >= CONSECUTIVE_FAILURES:
        reason = "consecutive_failures"
    else:
        reason = "closed"
    return {
        "tripped": trip,
        "rule": "DRIFT-CIRCUIT-BREAKER" if trip else "DRIFT-CIRCUIT-CLOSED",
        "reason": reason,
        "consecutive_failures": consecutive,
        "consecutive_limit": CONSECUTIVE_FAILURES,
        "hard_stop": HARD_STOP,
        "forbidden_steps": ["Φ5→Φ8", "Φ4→Φ8"],
        "cite": "Nic 4.9.191. Opens above 0.80, on Φ5→Φ8 or Φ4→Φ8, or after 3 consecutive failures. A failure is ε_s > 0.35 or a forbidden step.",
        "lowers_c_min": False,
        "calls_llm": False,
        "writes": False,
        "money": False,
    }


def gilligan_drift_correction(epsilon_s: Any, *, initiator: str = "gilligan") -> dict[str, Any]:
    eps = _eps(epsilon_s)
    who = initiator or "gilligan"
    if who != "gilligan":
        return {"applied": False, "rule": "CHRISTPING-GILLIGAN-ONLY", "initiator": who, "calls_llm": False, "writes": False}
    if eps is None:
        return {"applied": False, "rule": "DRIFT-UNMEASURED", "initiator": "gilligan", "calls_llm": False, "writes": False}
    if eps > HARD_STOP:
        return {
            "applied": False,
            "rule": "CHRISTPING-RECENTER",
            "initiator": "gilligan",
            "ask_initiated": False,
            "epsilon_s": round(eps, 6),
            "cite": "Gilligan Agent Core 1HSjAk6UY; hard stop above 0.80 recenters and does not admit",
            "calls_llm": False,
            "writes": False,
        }
    if PROJECT_MAX < eps < CHI_MAX:
        return {
            "applied": True,
            "rule": "GILLIGAN-CHI-CORRECTION",
            "initiator": "gilligan",
            "epsilon_s": round(eps, 6),
            "band": "correct",
            "cite": "Nic drift ruling chi band; χ is the correction, not an Ask admit",
            "calls_llm": False,
            "writes": False,
        }
    return {
        "applied": False,
        "rule": "GILLIGAN-CORRECTION-NOT-IN-BAND",
        "initiator": "gilligan",
        "epsilon_s": round(eps, 6),
        "calls_llm": False,
        "writes": False,
    }


def gilligan_re_curation(rows: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    cold = []
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        if row.get("unsourced") is True or row.get("premise") is False:
            cold.append({"id": row.get("id"), "disposition": "held", "reason": row.get("hold") or "not a premise"})
    return {
        "rule": "GILLIGAN-RECURATION",
        "reviewed": len(cold),
        "promoted": 0,
        "packs_written": False,
        "publish_packs": False,
        "rows": cold[:12],
        "cite": "Gilligan Codex Vol IV §6.1 drift categorization, §6.2 cold archive. Re-curation does not write confirmed_shared.",
        "calls_llm": False,
        "writes": False,
    }


def protoforge_os_layer(phi: int | None) -> dict[str, Any]:
    from rmc_engine_v1.phase_codex import get_phase_profile
    profile = get_phase_profile("Φ" + str(phi)) if isinstance(phi, int) and 1 <= phi <= 9 else {}
    return {
        "rule": "PROTOFORGE-OS-LAYER",
        "process": "in-process",
        "os_process": False,
        "shell": False,
        "money": False,
        "phi": phi,
        "state": profile.get("state_signature") or "unspecified",
        "hook": profile.get("function_hook") or "unspecified",
        "glyph": profile.get("glyph") or "",
        "code_id": profile.get("code_identifier") or "",
        "cite": "FBSC Phase Glyph Codex v2.5 state_signature and function_hook. No OS process is spawned.",
        "calls_llm": False,
        "writes": False,
    }


def protoforge2_stage(epsilon_s: Any, history: list[Any] | None = None) -> dict[str, Any]:
    tax = drift_taxonomy(epsilon_s)
    breaker = drift_circuit_breaker(epsilon_s, history=history)
    return {
        "rule": "PROTOFORGE2-DRIFT-CONNECTOR",
        "adapter_mode": "FALLBACK",
        "live": False,
        "external_monitor": "not_on_phone",
        "reason": "The full ProtoForge DriftMonitor writes a log and is not imported. The in-framework taxonomy and breaker are the stage that runs.",
        "taxonomy": tax,
        "circuit_breaker": breaker,
        "calls_llm": False,
        "writes": False,
    }


def drift_194_stage(epsilon_s: Any) -> dict[str, Any]:
    """Ask-trace summary of the 4.9.194 window. It does not change the admit ε_s."""
    from rmc_engine_v1.drift_194 import stage
    return stage(epsilon_s)


def dpa_195_stage(epsilon_s: Any) -> dict[str, Any]:
    """Ask-trace summary of the 4.9.195 archive. It does not change the admit ε_s."""
    from rmc_engine_v1.dpa_195 import stage
    return stage(epsilon_s)


def tiers_196_stage(epsilon_s: Any) -> dict[str, Any]:
    """Ask-trace summary of the 4.9.196 ladder. It does not change the admit ε_s."""
    from rmc_engine_v1.tiers_196 import stage
    return stage(epsilon_s)


def ppe_197_stage(question: str | None = None) -> dict[str, Any]:
    """Ask-trace summary of the 4.9.197 lexicon. It does not change the admit ε_s."""
    from rmc_engine_v1.ppe_lexicon_197 import stage
    return stage(question)


def growth_198_stage(question: str | None = None) -> dict[str, Any]:
    """Ask-trace summary of the 4.9.198 growth engine. It does not persist or admit."""
    from rmc_engine_v1.lexicon_growth_198 import stage
    return stage(question)


def geometry_199_stage(question: str | None = None) -> dict[str, Any]:
    """Ask-trace summary of the 4.9.199 geometry gates. It does not persist or admit."""
    from rmc_engine_v1.geometry_199 import stage
    return stage(question)


def rmc_renderer_200_stage(question: str | None = None) -> dict[str, Any]:
    """Ask-trace summary of the 4.9.200 renderer. It does not persist or admit."""
    from rmc_engine_v1.rmc_renderer_200 import stage
    return stage(question)


def drift_v43_stage(phi: int | None, prev: Any, hist: list[Any]) -> dict[str, Any]:
    """Ask-trace summary of the v4.3 score. It does not change the admit ε_s."""
    from rmc_engine_v1.drift_v43 import score
    payload = {"core_state": {"phi": int(phi) if isinstance(phi, int) else 0}, "auxiliary": {}, "metadata": {"source": "ask-trace"}}
    row = score({
        "payload": payload,
        "prev_phase": prev if prev is not None else phi,
        "recursion_n": max(1, len(hist) or 1),
        "phase_hist": [],
        "latency_ms": 0,
        "stamps_ms": [],
    })
    return {
        "ok": True,
        "disposition": row["disposition"],
        "eps_s": row["eps_s"],
        "d_score": row["d_score"],
        "theta_w": row["theta_w"],
        "phi_act": row["phi_act"],
        "phi_act_name": row["phi_act_name"],
        "categorical_hard_fire": row["categorical_hard_fire"],
        "step_flag": row["step_flag"],
        "calls_llm": False,
        "writes": False,
        "cite": row["cite"],
    }


def run_engines(epsilon_s: Any, phi: int | None, held_rows: list[dict[str, Any]] | None = None, phase_hist: list[Any] | None = None, history: list[Any] | None = None, question: str | None = None) -> dict[str, Any]:
    from rmc_engine_v1.chi_hardening import chi_adaptive, entropy_epsilon, internal_phase_coherence, phase_velocity
    hist = list(phase_hist or [])
    if phi and not hist:
        hist = [phi]
    prev = hist[-2] if len(hist) >= 2 else None
    hardening = chi_adaptive(epsilon_s if epsilon_s is not None else 0.0, hist, prev, phi)
    entropy = entropy_epsilon(hist, phi, phi, len(hist), prev)
    return {
        "drift_taxonomy": drift_taxonomy(epsilon_s),
        "drift_circuit_breaker": drift_circuit_breaker(epsilon_s, history=history),
        "protoforge2_drift_connector": protoforge2_stage(epsilon_s, history),
        "gilligan_drift_correction": gilligan_drift_correction(epsilon_s, initiator="gilligan"),
        "gilligan_re_curation": gilligan_re_curation(held_rows),
        "protoforge_os_layer": protoforge_os_layer(phi),
        "chi_hardening": hardening,
        "entropy_epsilon": entropy,
        "phase_velocity": phase_velocity([]),
        "internal_phase_coherence": internal_phase_coherence(None),
        "theta_w": hardening["theta_w"],
        "drift_v43": drift_v43_stage(phi, prev, hist),
        "drift_194": drift_194_stage(epsilon_s),
        "dpa_195": dpa_195_stage(epsilon_s),
        "tiers_196": tiers_196_stage(epsilon_s),
        "ppe_197": ppe_197_stage(question),
        "growth_198": growth_198_stage(question),
        "geometry_199": geometry_199_stage(question),
        "rmc_renderer_200": rmc_renderer_200_stage(question),
        "calls_llm": False,
        "c_min": C_MIN,
        "write_law_unchanged": True,
    }
