"""4.9.196 storage tiers. PMA §6. Stdlib. No LLM.

Hot → Warm (SPC) → Cold → Deep ghost loop.
The charge is genesis_collapse.spc_charge. This file does not copy the
168-hour formula. Resurrection is phase_coherent_gates. All seven must pass.
A dead path that reaches deep is appended once through dpa_195.
It does not admit. dream_idle stays off.
"""
from __future__ import annotations

import json
from typing import Any

from rmc_engine_v1.dpa_195 import (
    append_dead_path,
    classify,
    empty_archive,
    erase,
    verify_archive,
)
from rmc_engine_v1.drift_v43 import C_MIN, ECHO_MIN
from rmc_engine_v1.genesis_collapse import HALF_LIFE_HOURS, spc_active, spc_charge, spc_gc
from rmc_engine_v1.phase_coherent_gates import phase_coherent_resurrection

CITE = (
    "PMA §6 Hot, Warm (SPC), Cold, Deep ghost loop. "
    "Charge is genesis_collapse.spc_charge, half-life 168 h (Genesis Node pp.116, 143–145). "
    "Active is charge above 0.1. Collection is charge below 0.05. "
    "Hot is the active runtime at elapsed 0 while the charge is still active. "
    "Warm is the SPC while the charge stays active after time has moved. "
    "Cold is not active and not collected. Deep ghost is collection and does not re-enter. "
    "Resurrection is phase_coherent_gates. All seven must pass. "
    "A dead path that reaches deep is appended once through dpa_195. A rewrite is rejected. An erase is rejected. "
    "Codex 0.5, 0.6, and 0.3 cuts are log-only. C_min stays 0.87. Echo stays 0.85. No LLM."
)
TS = "2026-10-30T17:00:00Z"
ORDER = ("hot", "warm", "cold", "deep_ghost")
LABELS = {
    "hot": "Hot",
    "warm": "Warm (SPC)",
    "cold": "Cold",
    "deep_ghost": "Deep ghost loop",
}
CLOCK_HOURS = (0, 168, 600, 800)
INTERNAL = {
    "codex_spc_write": 0.5,
    "codex_cold_entropy": 0.6,
    "codex_resurrect_entropy": 0.3,
    "codex_long_term_drift": 0.3,
    "logged_only": True,
    "admit": False,
    "cite": "Gilligan Codex 3.3, 3.6, 3.7, 3.15. These cuts do not move a tier and do not admit.",
}


def flags() -> dict[str, Any]:
    return {
        "admit_gate": False,
        "writes": False,
        "calls_llm": False,
        "money": False,
        "dream_idle": False,
        "economy": False,
        "packs_gated": True,
        "christping": "gilligan-only",
        "wikipedia_anchor": False,
        "c_min": C_MIN,
        "echo_min": ECHO_MIN,
        "internal": INTERNAL,
    }


def _reject(rule: str) -> dict[str, Any]:
    row = {"ok": False, "rule": rule}
    row.update(flags())
    return row


def _num(value: Any):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def tier_at(c0: Any, hours: Any) -> dict[str, Any]:
    """Read the tier at a simulated hour. Negative time is a rewind."""
    h = _num(hours)
    base = _num(c0)
    if h is None or base is None:
        return _reject("TIER-CLOCK")
    if h < 0 or base < 0:
        return _reject("TIER-CLOCK-REWIND")
    charge = spc_charge(base, h)
    active = bool(spc_active(charge))
    collected = bool(spc_gc(charge))
    if collected:
        name = "deep_ghost"
    elif not active:
        name = "cold"
    elif h <= 0:
        name = "hot"
    else:
        name = "warm"
    row = {
        "ok": True,
        "rule": "TIER-READ",
        "tier": name,
        "label": LABELS[name],
        "charge": charge,
        "hours": h,
        "c0": base,
        "active": active,
        "gc": collected,
        "half_life_hours": HALF_LIFE_HOURS,
        "cite": CITE,
    }
    row.update(flags())
    return row


def empty_store() -> dict[str, Any]:
    return {"schema": "FORGE-TIERS/v1", "items": [], "moves": [], "archive": empty_archive()}


def _find(store: dict[str, Any], ident: str):
    for item in store["items"]:
        if item["id"] == ident:
            return item
    return None


def _step(body: dict[str, Any]):
    if body.get("from") is None and body.get("to") is None:
        return None
    return {"from": body.get("from"), "to": body.get("to")}


def place(store: dict[str, Any], spec: dict[str, Any] | None) -> dict[str, Any]:
    body = spec or {}
    ident = body.get("id")
    if not ident:
        return _reject("TIER-FIELDS")
    if _find(store, str(ident)):
        return _reject("TIER-REWRITE-REJECTED")
    base = _num(body.get("c0") if body.get("c0") is not None else 1)
    if base is None or base < 0:
        return _reject("TIER-CHARGE")
    gate = classify(body.get("epsilon_s"), _step(body))
    read = tier_at(base, 0)
    item = {
        "id": str(ident),
        "c0": base,
        "hours": 0,
        "charge": read["charge"],
        "tier": read["tier"],
        "epsilon_s": body.get("epsilon_s"),
        "phase": body.get("phase"),
        "psi": body.get("psi"),
        "ts": body.get("ts"),
        "entropy": body.get("entropy"),
        "from": body.get("from"),
        "to": body.get("to"),
        "dead": gate["dead"],
        "sealed": False,
        "seal_rule": None,
    }
    store["items"].append(item)
    store["moves"].append({"id": item["id"], "hours": 0, "tier": item["tier"], "charge": item["charge"]})
    row = {
        "ok": True,
        "rule": "TIER-PLACED",
        "tier": item["tier"],
        "label": LABELS[item["tier"]],
        "charge": item["charge"],
        "hours": 0,
        "dead": item["dead"],
        "write_allowed": not item["dead"],
        "spc_above_0_5": gate["spc_above_0_5"],
        "spc_logged_only": True,
        "cite": CITE,
    }
    row.update(flags())
    return row


def _seal(store: dict[str, Any], item: dict[str, Any]) -> str:
    if item.get("psi") is None or item.get("ts") is None or item.get("entropy") is None or item.get("phase") is None:
        item["seal_rule"] = "TIER-UNSEALED"
        return "TIER-UNSEALED"
    spec = {
        "id": item["id"],
        "psi": item["psi"],
        "phase": item["phase"],
        "ts": item["ts"],
        "entropy": item["entropy"],
        "epsilon_s": item["epsilon_s"],
        "reason": "deep-ghost",
    }
    if item.get("from") is not None:
        spec["from"] = item["from"]
    if item.get("to") is not None:
        spec["to"] = item["to"]
    result = append_dead_path(store["archive"], spec)
    if result["ok"]:
        item["sealed"] = True
    item["seal_rule"] = result["rule"]
    return result["rule"]


def advance(store: dict[str, Any], ident: str, hours: Any) -> dict[str, Any]:
    item = _find(store, str(ident))
    if item is None:
        return _reject("TIER-UNKNOWN")
    h = _num(hours)
    if h is None:
        return _reject("TIER-CLOCK")
    if h < item["hours"]:
        row = _reject("TIER-CLOCK-REWIND")
        row["tier"] = item["tier"]
        row["hours"] = item["hours"]
        return row
    read = tier_at(item["c0"], h)
    moved = read["tier"] != item["tier"]
    item["hours"] = h
    item["charge"] = read["charge"]
    if moved:
        item["tier"] = read["tier"]
        store["moves"].append({"id": item["id"], "hours": h, "tier": item["tier"], "charge": item["charge"]})
    seal_rule = None
    if item["tier"] == "deep_ghost":
        seal_rule = _seal(store, item)
    row = {
        "ok": True,
        "rule": "TIER-MOVED" if moved else "TIER-HELD",
        "tier": item["tier"],
        "label": LABELS[item["tier"]],
        "charge": item["charge"],
        "hours": h,
        "moved": moved,
        "active": read["active"],
        "gc": read["gc"],
        "dead": item["dead"],
        "write_allowed": not item["dead"],
        "seal_rule": seal_rule,
        "archive_n": len(store["archive"]["dead_paths"]),
        "cite": CITE,
    }
    row.update(flags())
    return row


def erase_item(store: dict[str, Any], ident: str | None = None) -> dict[str, Any]:
    gone = erase()
    row = _reject("TIER-ERASE-REJECTED")
    row["archive_rule"] = gone["rule"]
    row["kept"] = len(store["items"])
    row["id"] = ident
    return row


def passing_record() -> dict[str, Any]:
    return {
        "phase": 9,
        "noise_floor": 0.1,
        "chi_threshold": 0.4,
        "identity": "psi-sky",
        "resurrection_log_valid": True,
        "cycle_count": 1,
        "resurrection_limit": 3,
        "capacity_ok": True,
        "active_drift": False,
    }


def resurrect(record: dict[str, Any] | None, tier: str) -> dict[str, Any]:
    """Call the 4.9.191 seven gates. Deep ghost does not re-enter."""
    gates = phase_coherent_resurrection(record if isinstance(record, dict) else {})
    failed = [g["id"] for g in gates["gates"] if not g["pass"]]
    row = {
        "gate_ok": bool(gates["ok"]),
        "gate_count": len(gates["gates"]),
        "passed": sum(1 for g in gates["gates"] if g["pass"]),
        "failed": failed,
        "gates": gates["gates"],
        "tier": tier,
        "cite": gates.get("cite"),
        "module_cite": CITE,
    }
    row.update(flags())
    if tier == "deep_ghost":
        row["ok"] = False
        row["rule"] = "TIER-DEEP-NO-REENTRY"
        return row
    if tier == "hot":
        row["ok"] = False
        row["rule"] = "TIER-HOT-ACTIVE"
        return row
    if tier not in ("warm", "cold"):
        row["ok"] = False
        row["rule"] = "TIER-UNKNOWN"
        return row
    row["ok"] = bool(gates["ok"])
    row["rule"] = "TIER-RESURRECTED" if gates["ok"] else "TIER-GATES-FAILED"
    return row


def _body(ident: str, epsilon_s: float, phase: int, psi: str, **extra: Any) -> dict[str, Any]:
    row = {
        "id": ident,
        "c0": 1,
        "epsilon_s": epsilon_s,
        "phase": phase,
        "psi": psi,
        "ts": TS,
        "entropy": 0.2,
    }
    row.update(extra)
    return row


def clock_demo() -> dict[str, Any]:
    store = empty_store()
    place(store, _body("sky", 0.2, 9, "psi-sky"))
    rows = [advance(store, "sky", h) for h in CLOCK_HOURS]
    rewind = advance(store, "sky", 100)
    gone = erase_item(store, "sky")
    again = place(store, _body("sky", 0.2, 9, "psi-sky"))
    loud = empty_store()
    hot = place(loud, _body("loud", 0.55, 1, "psi-loud"))
    row = {
        "tiers": [r["tier"] for r in rows],
        "hours": list(CLOCK_HOURS),
        "labels": [r["label"] for r in rows],
        "moves": [m["tier"] for m in store["moves"]],
        "half_charge": rows[1]["charge"],
        "active": [r["active"] for r in rows],
        "gc": [r["gc"] for r in rows],
        "clock_seal": rows[3]["seal_rule"],
        "rewind_rule": rewind["rule"],
        "rewind_tier": rewind["tier"],
        "erase_rule": gone["rule"],
        "archive_rule": gone["archive_rule"],
        "kept": gone["kept"],
        "rewrite_rule": again["rule"],
        "length": len(store["items"]),
        "loud_tier": hot["tier"],
        "loud_dead": hot["dead"],
        "loud_spc": hot["spc_above_0_5"],
        "loud_write": hot["write_allowed"],
        "half_life_hours": HALF_LIFE_HOURS,
        "order": list(ORDER),
        "cite": CITE,
    }
    row.update(flags())
    return row


def resurrect_demo() -> dict[str, Any]:
    good = passing_record()
    bad = dict(good)
    bad["phase"] = 8
    cap = dict(good)
    cap["capacity_ok"] = False
    warm = resurrect(good, "warm")
    cold = resurrect(good, "cold")
    deep = resurrect(good, "deep_ghost")
    hot = resurrect(good, "hot")
    fail = resurrect(bad, "warm")
    capacity = resurrect(cap, "warm")
    row = {
        "warm_ok": warm["ok"],
        "warm_rule": warm["rule"],
        "warm_passed": warm["passed"],
        "warm_count": warm["gate_count"],
        "warm_failed": warm["failed"],
        "cold_ok": cold["ok"],
        "cold_rule": cold["rule"],
        "cold_passed": cold["passed"],
        "deep_ok": deep["ok"],
        "deep_rule": deep["rule"],
        "deep_gate_ok": deep["gate_ok"],
        "deep_passed": deep["passed"],
        "hot_ok": hot["ok"],
        "hot_rule": hot["rule"],
        "fail_ok": fail["ok"],
        "fail_rule": fail["rule"],
        "fail_failed": fail["failed"],
        "capacity_ok": capacity["ok"],
        "capacity_failed": capacity["failed"],
        "cite": CITE,
    }
    row.update(flags())
    return row


def deep_demo() -> dict[str, Any]:
    store = empty_store()
    early = place(store, _body("row-36", 0.36, 1, "psi-36"))
    late = advance(store, "row-36", 800)
    again = advance(store, "row-36", 900)
    checked = verify_archive(store["archive"])
    calm = empty_store()
    place(calm, _body("row-35", 0.35, 1, "psi-35"))
    calm_late = advance(calm, "row-35", 800)
    skip_store = empty_store()
    place(skip_store, _body("row-58", 0.1, 8, "psi-58", **{"from": 5, "to": 8}))
    skip_early = advance(skip_store, "row-58", 0)
    skip_late = advance(skip_store, "row-58", 800)
    gone = erase_item(store, "row-36")
    row = {
        "early_tier": early["tier"],
        "early_dead": early["dead"],
        "early_write": early["write_allowed"],
        "late_tier": late["tier"],
        "seal_rule": late["seal_rule"],
        "again_rule": again["seal_rule"],
        "archive_n": again["archive_n"],
        "chain_ok": checked["ok"],
        "phase_name": store["archive"]["dead_paths"][0]["phase_name"],
        "calm_tier": calm_late["tier"],
        "calm_rule": calm_late["seal_rule"],
        "calm_n": calm_late["archive_n"],
        "calm_dead": calm_late["dead"],
        "skip_early_tier": skip_early["tier"],
        "skip_dead": skip_early["dead"],
        "skip_tier": skip_late["tier"],
        "skip_rule": skip_late["seal_rule"],
        "skip_phase": skip_store["archive"]["dead_paths"][0]["phase_name"],
        "skip_n": len(skip_store["archive"]["dead_paths"]),
        "erase_rule": gone["archive_rule"],
        "tier_erase": gone["rule"],
        "kept": gone["kept"],
        "hard_stop_81": classify(0.81)["hard_stop"],
        "hard_stop_80": classify(0.8)["hard_stop"],
        "dead_80": classify(0.8)["dead"],
        "dead_35": classify(0.35)["dead"],
        "dead_36": classify(0.36)["dead"],
        "spc_51": classify(0.51)["spc_above_0_5"],
        "cite": CITE,
    }
    row.update(flags())
    return row


def stage(epsilon_s: Any) -> dict[str, Any]:
    """Ask-trace summary. It does not change the admit ε_s."""
    gate = classify(epsilon_s, None)
    now = tier_at(1, 0)
    half = tier_at(1, HALF_LIFE_HOURS)
    row = {
        "tier": now["tier"],
        "half_tier": half["tier"],
        "half_life_hours": HALF_LIFE_HOURS,
        "dead": gate["dead"],
        "spc_above_0_5": gate["spc_above_0_5"],
        "spc_logged_only": True,
        "resurrect_rule": "TIER-RESURRECTED",
        "deep_rule": "TIER-DEEP-NO-REENTRY",
        "order": list(ORDER),
        "cite": CITE,
    }
    row.update(flags())
    return row


def monitor_lines(mode: str | None = None) -> dict[str, Any]:
    if mode == "gates":
        row = resurrect_demo()
        return {
            "attrs": {"mode": "gates", "status": row["warm_rule"], "detail": str(row["warm_passed"]) + "/7"},
            "lines": [
                "Warm resurrection " + row["warm_rule"] + ". Gates passed " + str(row["warm_passed"]) + " of 7.",
                "Cold storage resurrection " + row["cold_rule"] + ". Gates passed " + str(row["cold_passed"]) + " of 7.",
                "A phase of 8 fails " + row["fail_failed"][0] + ". Rule " + row["fail_rule"] + ".",
                "Deep ghost loop is " + row["deep_rule"] + ". The seven gates still ran.",
                "Hot is " + row["hot_rule"] + ". It is not stored.",
                "This card does not write memory. dream_idle stays off. No LLM.",
            ],
        }
    if mode == "deep":
        row = deep_demo()
        return {
            "attrs": {"mode": "deep", "status": row["again_rule"], "detail": "n-" + str(row["archive_n"])},
            "lines": [
                "Drift 0.36 reaches Deep ghost loop and seals " + row["seal_rule"] + ".",
                "A second seal is " + row["again_rule"] + ". Archive length " + str(row["archive_n"]) + ". Chain verifies: " + str(row["chain_ok"]).lower() + ".",
                "Drift 0.35 reaches Deep ghost loop and is " + row["calm_rule"] + ".",
                "Phase 5 to phase 8 is a dead path. The sealed phase is " + row["skip_phase"] + ".",
                "An erase is " + row["erase_rule"] + ". The tier erase is " + row["tier_erase"] + ".",
                "This card does not admit. C_min " + str(C_MIN) + ". No LLM.",
            ],
        }
    row = clock_demo()
    return {
        "attrs": {"mode": "clock", "status": row["tiers"][-1], "detail": row["labels"][-1]},
        "lines": [
            row["labels"][0] + " at 0 hours. The charge is still active.",
            row["labels"][1] + " at 168 hours. Half-life charge is 0.5.",
            row["labels"][2] + " at 600 hours. The charge is not active and is not collected.",
            row["labels"][3] + " at 800 hours. The charge is collected.",
            "A rewind is " + row["rewind_rule"] + ". An erase is " + row["erase_rule"] + ".",
            "Drift 0.55 stays " + row["loud_tier"] + " and does not admit. Codex 0.5 is log only. No LLM.",
        ],
    }


def run(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    row = payload or {}
    op = row.get("op") or "clock"
    if op == "tier":
        return tier_at(row.get("c0", 1), row.get("hours", 0))
    if op == "gates":
        return resurrect_demo()
    if op == "deep":
        return deep_demo()
    if op == "stage":
        return stage(row.get("epsilon_s"))
    if op == "monitor":
        return monitor_lines(row.get("mode") or "clock")
    if op == "resurrect":
        return resurrect(row.get("record") or passing_record(), str(row.get("tier") or "warm"))
    return clock_demo()


if __name__ == "__main__":
    import sys

    print(json.dumps(run(json.load(sys.stdin))))
