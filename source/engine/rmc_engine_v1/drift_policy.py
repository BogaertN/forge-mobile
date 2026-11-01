"""4.9.211 DRIFT-SPEC/v1 (resolved). The Python mirror of kmath.js DRIFT_POLICY functions.

Stdlib only. No LLM. No embeddings. Constants live in mobile_config.DRIFT_POLICY.
Ordered checks: forbidden (any eps, any depth) -> hard_stop eps >= 0.80 -> acceleration
-> explore 0.40 <= eps < 0.80 -> correct theta_admit < eps < 0.40 (one chi-correct pass,
then re-measure; the drift must fall) -> clean eps <= theta_admit, with
theta_admit = min(0.35, 0.4 / (1 + gamma * L)). A rising eps over TREND_K transitions
routes to correct. eps is not clipped. C(eps) = 1 - eps is the -lambda*D drift term.

Two normalisers, two metrics (DRIFT-SPEC/v1 D3, resolved 4.9.217, Nic 2026-11-01):
  * this module is the WRITE-TRACE eps = (sigma + d + dphi) / rho, rho = max(1, recursion depth)
    (RSOC v4.8 Eq. 5; Addendum 2026-09-21; DENOMINATOR "max1_depth");
  * the Ask CANDIDATE eps (drift_engine.py, coherence_math.py, eps_s/rmc-candidate/v1) is
    (sigma_res + D_score + |dPhi|) / 3 and stays /3. The 3 is canonical: the nine-phase cycle on
    the 144 base runs by threes (144 = 9*16 = 3*48, three octaves of three phases, one triad step
    = 3/9) and the functional averages three components (RMC 6.3, n = 3). It is never switched
    to depth. Rationale and citations: CONFLICTS.md 4.9.217.

Question tuning (DRIFT-SPEC/v1 D14, 4.9.218, Nic-approved 2026-11-01, pt125u "Build that"):
  the frequency constants from the 4.9.203 / 4.9.204 proposal are approved unchanged and tune the
  question continuously inside its band on the 9 / 144 dial (question_tuning.py):
  epsilon = 0.02 on hz / marker, offset cap = 0.40 of the marker's Voronoi half-width, nudge span = 0.45
  (a surface nudge is at most 0.45 * epsilon of the marker). The dial offset is mean r * 1/2 band, so at
  most +/-0.20 phase (+/-8 degrees); the band never changes. They do not enter either eps above.
"""
from __future__ import annotations

import math
import re
from typing import Any

from rmc_engine_v1.mobile_config import DRIFT_POLICY
from rmc_engine_v1.frequency_203_config import EPSILON as _TUNE_EPSILON, NUDGE_SPAN as _TUNE_NUDGE, OFFSET_CAP as _TUNE_CAP

# DRIFT-SPEC/v1 D14 (4.9.218): Nic-approved question-tuning constants, read from the one config, not restated.
QUESTION_TUNING = {
    "epsilon": _TUNE_EPSILON,
    "offset_cap": _TUNE_CAP,
    "nudge_span": _TUNE_NUDGE,
    "status": "approved",
    "approved": "Nic, pt125u, 2026-11-01",
    "release": "4.9.218",
    "used_by": "question_tuning.tune -> resonance_recall.rank_memory",
}

P = DRIFT_POLICY
WINDOW = 8


def _r6(x: float) -> float:
    # mirrors JS Math.round (half up), not Python's half-even round()
    return math.floor(x * 1e6 + 0.5) / 1e6 if math.isfinite(x) else x


def circ_std(phases: list[int]) -> float:
    if len(phases) < 2:
        return 0.0
    c = s = 0.0
    for p in phases:
        th = ((p - 1) / 9) * 2 * math.pi
        c += math.cos(th)
        s += math.sin(th)
    r = min(1.0, math.sqrt(c * c + s * s) / len(phases))
    return math.sqrt(max(0.0, 2 * (1 - r))) / (2 * math.pi)


def phase_next(n: int) -> int:
    return (n % 9) + 1


def is_backward(a: int, b: int) -> bool:
    return b != a and b != phase_next(a) and ((a - b + 9) % 9) < ((b - a + 9) % 9)


def is_forbidden_pair(a: int, b: int) -> bool:
    return any(a == x and b == y for x, y in P["FORBIDDEN"]["rmc"])


def local_curvature(hist: list[Any] | None, window: int = WINDOW) -> float:
    """Variance of the consecutive phase steps over the last 8 phases, each step on the circle
    (Φ9 is adjacent to Φ1), so the lawful 9→1 closure is a step of 1. Mirrors kmath.policyCurvature."""
    h = _ints(hist)[-window:]
    diffs = []
    for i in range(1, len(h)):
        a = abs(h[i] - h[i - 1]) % 9
        diffs.append(float(min(a, 9 - a)))
    if not diffs:
        return 0.0
    if len(diffs) == 1:
        return diffs[0]
    mean = sum(diffs) / len(diffs)
    return sum((d - mean) ** 2 for d in diffs) / len(diffs)


def _ints(xs: Any) -> list[int]:
    out = []
    for x in xs or []:
        try:
            v = int(str(x).replace("Φ", ""))
        except (TypeError, ValueError):
            continue
        out.append(v)
    return out


def drift_measure(phase_history: list[Any] | None, transition: dict[str, Any] | None, depth: Any) -> dict[str, Any]:
    hist = _ints(phase_history)
    prev = act = None
    if transition and transition.get("from") is not None and transition.get("to") is not None:
        prev, act = int(transition["from"]), int(transition["to"])
    has = prev is not None and act is not None
    sigma = circ_std(hist)
    d = 1 if has and is_forbidden_pair(prev, act) else 0
    dphi = abs(act - ((prev % 9) + 1)) / 9 if has else 0.0
    try:
        rho = max(1, int(float(depth or 0)))
    except (TypeError, ValueError):
        rho = 1
    raw = (sigma + d + dphi) / rho
    back = bool(has and is_backward(prev, act))
    return {
        "eps": _r6(raw), "eps_raw": raw, "sigma_res": _r6(sigma), "d_score": d, "dphi": _r6(dphi), "rho": rho,
        "forbidden": d == 1 or back, "backward": back,
        "metric_id": P["METRIC_ID"], "phase_scheme_id": P["PHASE_SCHEME_ID"], "clipped": False,
    }


def theta_admit(L: Any) -> float:
    try:
        l = float(L)
    except (TypeError, ValueError):
        l = 0.0
    if not math.isfinite(l) or l < 0:
        l = 0.0
    return min(P["ADMIT_MAX"], P["THETA_W_BASE"] / (1 + P["GAMMA"] * l))


def coherence(eps: Any) -> float:
    return min(1.0, max(0.0, 1.0 - float(eps)))


def trend_rising(history: list[Any] | None) -> bool:
    h = []
    for x in history or []:
        try:
            v = float(x)
        except (TypeError, ValueError):
            continue
        if math.isfinite(v):
            h.append(v)
    k = P["TREND_K"]
    if len(h) < k + 1:
        return False
    t = h[-(k + 1):]
    return all(t[i] > t[i - 1] for i in range(1, len(t)))


def acceleration_flag(stamps_ms: list[Any] | None) -> dict[str, Any]:
    s = []
    for x in stamps_ms or []:
        try:
            s.append(float(x))
        except (TypeError, ValueError):
            continue
    n = P["ACCEL_NV"]
    if len(s) < n:
        return {"v": 0, "measured": bool(s)}
    for i in range(0, len(s) - n + 1):
        if s[i + n - 1] - s[i] < P["ACCEL_TAU_MS"]:
            return {"v": 1, "measured": True}
    return {"v": 0, "measured": True}


def classify_drift(m: dict[str, Any]) -> dict[str, Any]:
    m = m or {}
    try:
        eps = float(m.get("eps"))
    except (TypeError, ValueError):
        eps = float("nan")
    path = _ints(m.get("path"))
    L = m.get("L")
    if L is None:
        L = local_curvature(path) if path else 0.0
    theta = theta_admit(L)
    steps = []
    tr = m.get("transition")
    if tr and tr.get("from") is not None and tr.get("to") is not None:
        steps.append((int(tr["from"]), int(tr["to"])))
    for i in range(1, len(path)):
        if path[i] != path[i - 1]:
            steps.append((path[i - 1], path[i]))
    hit = next((s for s in steps if is_forbidden_pair(*s) or is_backward(*s)), None)
    forb = bool(m.get("forbidden") is True or hit)
    accel = acceleration_flag(m.get("stamps_ms"))
    trend = trend_rising(m.get("history"))

    def out(region: str, reason: str) -> dict[str, Any]:
        return {
            "region": region, "reason": reason, "check_order": list(P["CHECK_ORDER"]),
            "theta_admit": _r6(theta), "L": _r6(float(L)), "metric_id": m.get("metric_id") or P["METRIC_ID"],
            "profile": P["profile"], "trend": trend, "acceleration": accel["v"] == 1,
            "acceleration_measured": accel["measured"], "eps": eps if math.isfinite(eps) else None,
        }

    if forb:
        why = ("forbidden transition Φ%d→Φ%d (blocks at any ε and any depth)" % hit) if hit else "forbidden transition (blocks at any ε)"
        return out("forbidden", why)
    if not math.isfinite(eps) or eps < 0:
        return out("unmeasured", "ε not measured: nothing projects")
    if eps >= P["HARD_MIN"]:
        return out("hard_stop", "ε ≥ 0.80 (inclusive hard ceiling, checked first)")
    if accel["v"] == 1:
        return out("acceleration", "v(t) = 1: %d steps inside %s ms → correct" % (P["ACCEL_NV"], P["ACCEL_TAU_MS"]))
    if eps >= P["EXPLORE_MIN"]:
        return out("explore", "0.40 ≤ ε < 0.80: quarantine and explore only")
    if eps > theta:
        return out("correct", "θ_admit < ε < 0.40: one χ-correct pass, then re-measure (the drift must fall)")
    if trend:
        return out("correct", "ε rose over %d consecutive transitions → correct (trend rule)" % P["TREND_K"])
    return out("clean", "ε ≤ θ_admit")


def evaluate_chi_eligibility(sfe: dict[str, Any] | None, obs: dict[str, Any] | None, echo_trace: Any, loop: dict[str, Any] | None) -> dict[str, Any]:
    sfe, obs, loop = sfe or {}, obs or {}, loop or {}
    failed = []
    try:
        hard = float(sfe.get("eps")) >= P["HARD_MIN"]
    except (TypeError, ValueError):
        hard = False
    if not hard:
        failed.append("not_hard_stop")
    if echo_trace is not True:
        failed.append("echo_trace")
    if int(loop.get("chi_grace_used") or 0) >= P["CHI_GRACE_PER_LOOP"]:
        failed.append("chi_grace_used_this_loop")
    try:
        dphi_ok = float(obs.get("dphi_avg")) <= math.pi / 3
    except (TypeError, ValueError):
        dphi_ok = False
    if not dphi_ok:
        failed.append("dphi_avg")
    if loop.get("owner") != "gilligan":
        failed.append("gilligan_only")
    return {"eligible": not failed, "failed_guards": failed, "authorises_write": False, "settle_ms": P["CHRISTPING_SETTLE_MS"]}


ECHO_CLASS_RX = {
    "negation": re.compile(r"\b(?:not|no|never|none|nobody|nothing|neither|nor|cannot|without)\b|n't\b", re.I),
    "certainty": re.compile(r"\b(?:may|might|could|possibly|perhaps|probably|likely|unlikely|uncertain|approximately|roughly|reportedly|allegedly)\b", re.I),
    "condition": re.compile(r"\b(?:if|unless|provided|whenever|otherwise)\b", re.I),
}


def echo_classes(answer: Any, source: Any) -> dict[str, Any]:
    a, s = str(answer or ""), str(source or "")
    out: dict[str, Any] = {}
    ok = True
    for k in P["ECHO_CLASSES"]:
        x, y = bool(ECHO_CLASS_RX[k].search(a)), bool(ECHO_CLASS_RX[k].search(s))
        out[k] = {"answer": x, "source": y, "ok": x == y}
        ok = ok and x == y
    return {"ok": ok, "classes": out}


def admit_decision(w: dict[str, Any]) -> dict[str, Any]:
    w = w or {}
    hist = _ints(w.get("hist"))
    failed = []
    m = drift_measure(hist, {"from": w.get("prev"), "to": w.get("act")}, w.get("depth"))
    cls = classify_drift({"eps": m["eps"], "path": hist, "forbidden": m["forbidden"]})
    if cls["region"] != "clean":
        failed.append("drift:" + cls["region"])
    i6 = hist.index(6) if 6 in hist else -1
    i7 = hist.index(7) if 7 in hist else -1
    if not (i6 >= 0 and i7 > i6):
        failed.append("unnamed")
    try:
        echo_ok = float(w.get("echo")) >= P["ECHO_MEMORY_MIN"]
    except (TypeError, ValueError):
        echo_ok = False
    if not echo_ok:
        failed.append("echo")
    if not ((w.get("echo_classes") or {}).get("ok") is True):
        failed.append("echo_classes")
    try:
        c_ok = float(w.get("coherence")) >= P["C_MIN"]
    except (TypeError, ValueError):
        c_ok = False
    if not c_ok:
        failed.append("coherence")
    return {"ok": not failed, "failed": failed, "drift": m, "region": cls["region"], "theta_admit": cls["theta_admit"], "coherence_drift": _r6(coherence(m["eps"]))}
