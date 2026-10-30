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

from rmc_engine_v1.language_core_engines import drift_circuit_breaker

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


def run(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    row = payload or {}
    op = row.get("op") or "replay"
    if op == "retry":
        return retry_backoff(row.get("attempt"))
    if op == "observe":
        return observe_breaker(row.get("state"), row.get("event"), row.get("prior"))
    return replay_breaker(row.get("samples") or [])


if __name__ == "__main__":
    import sys

    print(json.dumps(run(json.load(sys.stdin))))
