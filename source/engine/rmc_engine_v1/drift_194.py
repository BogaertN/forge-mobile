"""4.9.194 breaker window. Stdlib. No LLM.

Reuses language_core_engines.drift_circuit_breaker. Does not copy the
0.35 / 0.8 / 5→8 tests. A failure is whatever that breaker already calls
a failure. Three failures inside 0.7 s open the window. Two do not.
Recovery above 60 s moves open to half-open. Retry wait is 60 * 2**(r-1)
seconds, and r stops at 3.
"""
from __future__ import annotations

import json
from typing import Any

from rmc_engine_v1.language_core_engines import PROJECT_MAX, drift_circuit_breaker

WINDOW_S = 0.7
MAX_FAILURES = 3
RECOVERY_S = 60.0
RETRY_BASE_S = 60.0
RETRY_MAX = 3
CITE = (
    "Decision 6; protoforge DriftCircuitBreaker max_failures 3, recovery 60 s; "
    "Waking the Web retry 60s·2^(r−1), retries ≤ 3. The 4.9.191 breaker is called, not copied. No LLM."
)


def _project(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "tripped": bool(row["tripped"]),
        "reason": row["reason"],
        "consecutive_failures": row["consecutive_failures"],
        "consecutive_limit": row["consecutive_limit"],
        "rule": row["rule"],
    }


def fresh_breaker() -> dict[str, Any]:
    return {"status": "closed", "opened_at": None, "failures": []}


def _copy_state(state: dict[str, Any] | None) -> dict[str, Any]:
    src = state or {}
    opened = src.get("opened_at")
    return {
        "status": src.get("status") or "closed",
        "opened_at": None if opened is None else float(opened),
        "failures": [float(item) for item in (src.get("failures") or [])],
    }


def _transition(event: dict[str, Any]) -> dict[str, Any] | None:
    if "from" not in event and "to" not in event:
        return None
    return {"from": event.get("from"), "to": event.get("to")}


def _in_window(stamp: float, now: float) -> bool:
    return stamp + 1e-9 >= now - WINDOW_S


def observe_breaker(state: dict[str, Any] | None, event: dict[str, Any] | None, prior: list[Any] | None = None) -> dict[str, Any]:
    ev = event or {}
    try:
        now = float(ev.get("t"))
    except (TypeError, ValueError):
        now = 0.0
    step = _transition(ev)
    sample = drift_circuit_breaker(ev.get("epsilon_s"), step, [])
    streak = drift_circuit_breaker(ev.get("epsilon_s"), step, list(prior or []))
    failed = int(sample["consecutive_failures"]) >= 1
    nxt = _copy_state(state)
    if failed:
        nxt["failures"].append(now)
    nxt["failures"] = [stamp for stamp in nxt["failures"] if _in_window(stamp, now)]
    immediate = sample["reason"] in ("forbidden_step", "hard_stop")
    if nxt["status"] == "open":
        opened = nxt["opened_at"]
        if opened is not None and now - opened > RECOVERY_S:
            nxt["status"] = "half_open"
            verdict = "testing_recovery"
        else:
            verdict = "open"
    elif nxt["status"] == "half_open":
        if failed:
            nxt["status"] = "open"
            nxt["opened_at"] = now
            verdict = "recovery_failed"
        else:
            nxt["status"] = "closed"
            nxt["failures"] = []
            verdict = "recovered"
    elif immediate or len(nxt["failures"]) >= MAX_FAILURES:
        nxt["status"] = "open"
        nxt["opened_at"] = now
        verdict = sample["reason"] if immediate else "circuit_tripped"
    else:
        verdict = "closed"
    return {
        "t": now,
        "verdict": verdict,
        "status": nxt["status"],
        "opened_at": nxt["opened_at"],
        "failure_count": len(nxt["failures"]),
        "window_s": WINDOW_S,
        "max_failures": MAX_FAILURES,
        "recovery_s": RECOVERY_S,
        "failed": failed,
        "immediate": immediate,
        "sample": _project(sample),
        "legacy": _project(streak),
        "state": nxt,
        "admit_gate": False,
        "writes": False,
        "calls_llm": False,
        "money": False,
        "cite": CITE,
    }


def replay_breaker(samples: list[dict[str, Any]] | None) -> dict[str, Any]:
    state = fresh_breaker()
    prior: list[Any] = []
    steps = []
    for sample in samples or []:
        row = observe_breaker(state, sample, prior)
        prior.append(sample.get("epsilon_s"))
        state = row["state"]
        steps.append(row)
    last = steps[-1] if steps else None
    opened = bool(last and (
        last["verdict"] in ("circuit_tripped", "hard_stop", "forbidden_step")
        or last["status"] in ("open", "half_open")
    ))
    return {
        "status": last["status"] if last else "closed",
        "verdict": last["verdict"] if last else "closed",
        "failure_count": last["failure_count"] if last else 0,
        "opened": opened,
        "steps": [
            {
                "t": row["t"],
                "verdict": row["verdict"],
                "status": row["status"],
                "failure_count": row["failure_count"],
                "legacy_tripped": row["legacy"]["tripped"],
                "legacy_reason": row["legacy"]["reason"],
                "writes": False,
                "calls_llm": False,
                "admit_gate": False,
            }
            for row in steps
        ],
        "window_s": WINDOW_S,
        "max_failures": MAX_FAILURES,
        "recovery_s": RECOVERY_S,
        "admit_gate": False,
        "writes": False,
        "calls_llm": False,
        "money": False,
        "cite": CITE,
    }


def retry_backoff(attempt: Any) -> dict[str, Any]:
    try:
        n = int(attempt)
    except (TypeError, ValueError):
        n = 0
    cite = "Waking the Web. Retries ≤ 3. Backoff 60s·2^(r−1)."
    if n < 1 or n > RETRY_MAX:
        return {
            "attempt": n,
            "allowed": False,
            "delay_s": None,
            "exhausted": n > RETRY_MAX,
            "max": RETRY_MAX,
            "tag": "permanent_ghost" if n > RETRY_MAX else "not_a_retry",
            "writes": False,
            "calls_llm": False,
            "admit_gate": False,
            "cite": cite,
        }
    return {
        "attempt": n,
        "allowed": True,
        "delay_s": RETRY_BASE_S * (2 ** (n - 1)),
        "exhausted": False,
        "max": RETRY_MAX,
        "tag": "retry",
        "writes": False,
        "calls_llm": False,
        "admit_gate": False,
        "cite": cite,
    }


def _finite(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number:
        return None
    return number


def rsoc_band(epsilon: Any) -> dict[str, Any]:
    n = _finite(epsilon)
    name = "unmeasured"
    k_cap = None
    defer_merge = False
    if n is not None:
        if n < 0.40:
            name = "stable"
        elif n < 0.80:
            name = "warning"
            k_cap = 1.3
            defer_merge = n > 0.70
        else:
            name = "critical"
    return {
        "band": name,
        "epsilon_s": n,
        "k_cap": k_cap,
        "defer_merge": defer_merge,
        "thresholds": [0.40, 0.70, 0.80],
        "logged_only": True,
        "admit_gate": False,
        "writes": False,
        "calls_llm": False,
        "cite": "RSOC §4.1.1 l.2003. Below 0.40 is stable. 0.40 to 0.80 warns, caps k at 1.3, and defers a merge above 0.70 for one cycle. At or above 0.80 is critical. Internal. A write still needs 0.35 or under.",
    }


def cap_k(k: Any, epsilon: Any) -> dict[str, Any]:
    band = rsoc_band(epsilon)
    requested = _finite(k)
    applied = None if requested is None else (requested if band["k_cap"] is None else min(requested, band["k_cap"]))
    return {
        "requested": requested,
        "applied": applied,
        "capped": requested is not None and applied != requested,
        "band": band["band"],
        "defer_merge": band["defer_merge"],
        "k_cap": band["k_cap"],
        "logged_only": True,
        "admit_gate": False,
        "writes": False,
        "calls_llm": False,
    }


def gn_band(epsilon: Any) -> dict[str, Any]:
    n = _finite(epsilon)
    name = "unmeasured"
    if n is not None:
        if n < 0.3:
            name = "below_0.3"
        elif n < 0.5:
            name = "0.3_to_0.5"
        elif n < 0.7:
            name = "0.5_to_0.7"
        elif n < 0.9:
            name = "0.7_to_0.9"
        else:
            name = "at_or_above_0.9"
    return {
        "band": name,
        "epsilon_s": n,
        "thresholds": [0.3, 0.5, 0.7, 0.9],
        "doc_halt": 0.9,
        "halt_threshold": 0.8,
        "halt_applied": n is not None and n > 0.8,
        "logged_only": True,
        "admit_gate": False,
        "writes": False,
        "calls_llm": False,
        "cite": "gnspec DriftAnalyzer l.6104–6107. Bands 0.3, 0.5, 0.7, and 0.9 are internal. The 0.9 halt is replaced by 0.8.",
    }


def storage_band(epsilon: Any) -> dict[str, Any]:
    n = _finite(epsilon)
    return {
        "epsilon_s": n,
        "archive": n is not None and n > 0.8,
        "resurrect_band": n is not None and n < 0.4,
        "write_allowed": n is not None and n <= PROJECT_MAX,
        "logged_only": True,
        "admit_gate": False,
        "writes": False,
        "calls_llm": False,
        "cite": "Decision 5. Archive above 0.8 and resurrect below 0.4 are internal. A write still needs 0.35 or under.",
    }


PATTERNS = (
    ("linear_degradation", (0.1, 0.2, 0.3, 0.4, 0.5, 0.6)),
    ("exponential_explosion", (0.1, 0.2, 0.4, 0.8, 1.6, 3.2)),
    ("high_frequency_oscillation", (0.3, 0.7, 0.2, 0.8, 0.1, 0.9)),
    ("step_change_catastrophic", (0.2, 0.2, 0.2, 1.0, 1.0, 1.0)),
)


def _series(values: list[Any] | None) -> list[float]:
    out = []
    for item in values or []:
        number = _finite(item)
        if number is not None:
            out.append(number)
    return out


def moving_average(values: list[Any] | None, window: Any = 5) -> dict[str, Any]:
    xs = _series(values)
    try:
        w = int(window)
    except (TypeError, ValueError):
        w = 5
    w = max(1, w)
    tail = xs[-w:]
    return {
        "window": w,
        "count": len(tail),
        "value": None if not tail else sum(tail) / len(tail),
        "logged_only": True,
        "admit_gate": False,
        "writes": False,
        "calls_llm": False,
    }


def _dtw(left: list[float], right: list[float]) -> float:
    n, m = len(left), len(right)
    if not n or not m:
        return float("inf")
    grid = [[float("inf")] * m for _ in range(n)]
    grid[0][0] = abs(left[0] - right[0])
    for i in range(1, n):
        grid[i][0] = grid[i - 1][0] + abs(left[i] - right[0])
    for j in range(1, m):
        grid[0][j] = grid[0][j - 1] + abs(left[0] - right[j])
    for i in range(1, n):
        for j in range(1, m):
            grid[i][j] = abs(left[i] - right[j]) + min(grid[i - 1][j], grid[i][j - 1], grid[i - 1][j - 1])
    return grid[n - 1][m - 1] / max(n, m)


def _classify(series: list[float]) -> dict[str, Any]:
    if len(series) < 3:
        return {"pattern": "benign", "distance": None}
    high, low = max(series), min(series)
    norm = series if high <= low else [(item - low) / (high - low) for item in series]
    best, distance = "benign", float("inf")
    for name, signature in PATTERNS:
        rec = norm[-len(signature):] if len(norm) >= len(signature) else norm
        gap = _dtw(rec, list(signature))
        if gap < distance:
            distance = gap
            best = name
    if distance > 0.5:
        return {"pattern": "benign", "distance": distance}
    return {"pattern": best, "distance": distance}


def _trend(series: list[float]) -> dict[str, Any]:
    n = len(series)
    if n < 5:
        return {"trend": 0.0, "confidence": 0.0, "direction": "stable"}
    xm = (n - 1) / 2
    ym = sum(series) / n
    nu = 0.0
    de = 0.0
    for x, y in enumerate(series):
        nu += (x - xm) * (y - ym)
        de += (x - xm) ** 2
    slope = nu / de if de else 0.0
    sr = 0.0
    st = 0.0
    for x, y in enumerate(series):
        predicted = slope * x + (ym - slope * xm)
        sr += (y - predicted) ** 2
        st += (y - ym) ** 2
    r2 = 1 - sr / st if st > 0 else 0.0
    direction = "stable" if abs(slope) < 1e-6 else ("increasing" if slope > 0 else "decreasing")
    return {"trend": slope, "confidence": max(0.0, r2), "direction": direction}


def _predict(series: list[float], pattern: str, critical: float) -> dict[str, Any]:
    if len(series) < 3:
        return {"steps_to_critical": None, "required_compute_multiplier": 1, "intervention_type": "MONITORING", "confidence": 0}
    current = series[-1]
    if current >= critical:
        steps = 0.0
    elif pattern == "linear_degradation":
        slope = series[-1] - series[-2]
        steps = float("inf") if slope <= 0 else (critical - current) / slope
    elif pattern == "exponential_explosion":
        prev = series[-2]
        growth = current / prev if prev > 0 else 0.0
        steps = float("inf") if growth <= 1 or current <= 0 else __import__("math").log(critical / current) / __import__("math").log(growth)
    else:
        if len(series) >= 6:
            recent = sum(series[-3:]) / 3 - sum(series[-6:-3]) / 3
        else:
            recent = 0.0
        steps = float("inf") if recent <= 0 else (critical - current) / recent
    if steps < 5:
        if pattern == "exponential_explosion":
            mult, kind = 2.5, "EMERGENCY_DAMPING"
        elif pattern == "high_frequency_oscillation":
            mult, kind = 1.5, "SPECTRAL_DAMPING"
        else:
            mult, kind = 1.8, "EMERGENCY_CORRECTION"
    elif steps < 20:
        mult, kind = 1.2, "PROACTIVE_CORRECTION"
    else:
        mult, kind = 1.0, "MONITORING"
    finite_steps = None if steps == float("inf") else max(0.0, steps)
    bounded = steps if steps != float("inf") else 100.0
    confidence = min(1.0, max(0.1, 1 - min(bounded, 100.0) / 100)) if len(series) >= 3 else 0.1
    if len(series) < 3:
        confidence = 0
    return {
        "steps_to_critical": finite_steps,
        "required_compute_multiplier": mult,
        "intervention_type": kind,
        "confidence": confidence,
    }


def analyze(values: list[Any] | None, opts: dict[str, Any] | None = None) -> dict[str, Any]:
    row = opts or {}
    xs = _series(values)
    window = 5 if row.get("window") is None else row.get("window")
    ma = moving_average(xs, window)
    tr = _trend(xs)
    classified = _classify(xs)
    pattern = row.get("pattern") or classified["pattern"]
    critical = 0.8 if row.get("critical") is None else float(row.get("critical"))
    last = xs[-1] if xs else None
    return {
        "n": len(xs),
        "moving_average": ma["value"],
        "moving_average_window": ma["window"],
        "trend": tr["trend"],
        "trend_confidence": tr["confidence"],
        "direction": tr["direction"],
        "pattern": pattern,
        "classified": classified["pattern"],
        "prediction": _predict(xs, pattern, critical),
        "gn_band": gn_band(last),
        "rsoc": rsoc_band(last),
        "logged_only": True,
        "admit_gate": False,
        "writes": False,
        "calls_llm": False,
        "cite": "ProtoForge thermodynamic_drift.py prediction, called from protoforge.js. GN DriftAnalyzer l.6104. The prediction critical line is the hard stop 0.8.",
    }


def override_effectiveness(pairs: list[dict[str, Any]] | None) -> dict[str, Any]:
    rows = []
    for pair in pairs or []:
        before = _finite(pair.get("before"))
        after = _finite(pair.get("after"))
        reduction = None
        if before is not None and after is not None:
            reduction = (1.0 if after == 0 else 0.0) if before == 0 else (before - after) / before
        rows.append({"before": before, "after": after, "reduction": reduction, "effective": reduction is not None and reduction > 0})
    scored = [item["reduction"] for item in rows if item["reduction"] is not None]
    mean = None if not scored else sum(scored) / len(scored)
    rate = None if not rows else len([item for item in rows if item["effective"]]) / len(rows)
    return {
        "rows": rows,
        "mean": mean,
        "rate": rate,
        "count": len(rows),
        "logged_only": True,
        "admit_gate": False,
        "writes": False,
        "calls_llm": False,
        "cite": "GN DriftAnalyzer override effectiveness, p148. Reduction is (before − after) / before. It does not admit.",
    }


def failsafe(row: dict[str, Any] | None = None) -> dict[str, Any]:
    src = row or {}
    age = _finite(src.get("loop_age_s"))
    drift = _finite(src.get("drift") if src.get("drift") is not None else src.get("epsilon_s"))
    threads = _finite(src.get("threads"))
    rollback = age is not None and age > 120
    thread_overload = threads is not None and threads > 50
    output_loop = src.get("output_loop") is True
    doc_halt = drift is not None and drift > 0.9
    halt = drift is not None and drift > 0.8
    echo = src.get("echo_confirmed") is True
    chi = src.get("chi_active") is True
    resurrect = drift is not None and drift <= 0.3 and echo and not chi and not halt and not rollback
    action = "rollback" if rollback else ("halt" if halt or thread_overload or output_loop else "continue")
    return {
        "action": action,
        "rollback": rollback,
        "halt": halt,
        "thread_overload": thread_overload,
        "output_loop": output_loop,
        "loop_age_s": age,
        "drift": drift,
        "age_limit_s": 120,
        "halt_threshold": 0.8,
        "doc_halt_threshold": 0.9,
        "doc_would_halt": doc_halt,
        "codex_failsafe_0_9": "replaced",
        "route": "cold_archive" if rollback else ("halt" if action == "halt" else "open"),
        "memory_writes_prevented": halt or rollback,
        "resurrect_allowed": resurrect,
        "echo_confirmed": echo,
        "chi_active": chi,
        "logged_only": True,
        "admit_gate": False,
        "writes": False,
        "calls_llm": False,
        "money": False,
        "christping": "gilligan-only",
        "cite": "Gilligan Codex 3.18. A phase loop older than 120 s rolls back to cold archive. A drift halt above 0.9 is replaced by the hard stop 0.8. Resurrection needs drift at or under 0.3, a confirmed echo, and χ inactive.",
    }


def codex_class(row: dict[str, Any] | None = None) -> dict[str, Any]:
    src = row or {}
    entropy = _finite(src.get("entropy"))
    fatal = src.get("synthetic") is True or src.get("codex_breach") is True or src.get("echo_valid") is False
    psi_break = src.get("psi_trace_valid") is False
    naming = src.get("naming_attempt") is True
    spike = entropy is not None and entropy > 0.6
    ghost = src.get("feedback_complete") is False and not psi_break
    noise = src.get("skipped_return") is True or src.get("temporary_mismatch") is True
    lineage = src.get("lineage_revalidated") is True
    klass, name, route, chi_lock, archived = 0, "none", "none", False, False
    if fatal:
        klass, name, route, chi_lock = 4, "fatal", "blocked", True
    elif spike or psi_break or naming:
        klass, name, route, chi_lock, archived = 3, "cold_archive", "SPC/cold_archive", True, True
    elif ghost:
        klass, name, route, archived = 2, "ghostable", "SPC/ghost_loops", True
    elif noise:
        klass, name, route = 1, "noise", "local"
    return {
        "class": klass,
        "name": name,
        "route": route,
        "restored": False,
        "may_reenter": klass in (2, 3) and lineage,
        "chi_lock": chi_lock,
        "archived": archived,
        "notify_christping": klass in (3, 4),
        "christping": "gilligan-only",
        "ask_initiated": False,
        "entropy": entropy,
        "entropy_gate": 0.6,
        "logged_only": True,
        "admit_gate": False,
        "writes": False,
        "calls_llm": False,
        "money": False,
        "write_max": PROJECT_MAX,
        "above_write_law": entropy is not None and entropy > PROJECT_MAX,
        "cite": "Gilligan Codex Ch.6.1. Class 1 stays local. Class 2 goes to ghost loops. Class 3 is entropy above 0.6, a ψ break, or a naming attempt, and goes to cold archive. Class 4 is fatal and is not restored. The 0.6 cut does not admit.",
    }


def stage(epsilon_s: Any) -> dict[str, Any]:
    """Ask-trace summary. It does not change the admit gate."""
    band = rsoc_band(epsilon_s)
    gn = gn_band(epsilon_s)
    store = storage_band(epsilon_s)
    safe = failsafe({"drift": epsilon_s, "loop_age_s": 0})
    klass = codex_class({"entropy": epsilon_s})
    return {
        "rsoc": band["band"],
        "gn": gn["band"],
        "archive": store["archive"],
        "write_allowed": store["write_allowed"],
        "failsafe": safe["action"],
        "halt": safe["halt"],
        "class": klass["class"],
        "admit_gate": False,
        "writes": False,
        "calls_llm": False,
    }


def run(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    row = payload or {}
    op = row.get("op") or "replay"
    if op == "retry":
        return retry_backoff(row.get("attempt"))
    if op == "observe":
        return observe_breaker(row.get("state"), row.get("event"), row.get("prior"))
    if op == "rsoc":
        return rsoc_band(row.get("epsilon_s"))
    if op == "cap_k":
        return cap_k(row.get("k"), row.get("epsilon_s"))
    if op == "gn_band":
        return gn_band(row.get("epsilon_s"))
    if op == "storage":
        return storage_band(row.get("epsilon_s"))
    if op == "analyze":
        return analyze(row.get("series"), row)
    if op == "override":
        return override_effectiveness(row.get("pairs"))
    if op == "failsafe":
        return failsafe(row)
    if op == "class":
        return codex_class(row)
    if op == "stage":
        return stage(row.get("epsilon_s"))
    return replay_breaker(row.get("samples") or [])


if __name__ == "__main__":
    import sys

    print(json.dumps(run(json.load(sys.stdin))))
