"""FORGE Simulation Router (4.9.244, plan 229 step 12b). No model: physics and math solvers only.

Contract FORGE-SIM-RECEIPT/v1. route(question) → compile the scene (engine sim_scene, the same code the phone bundles),
pick solvers by the scene's action, run them, and return a receipt: the scene, each solver's measurements, the
outcome, and the causal clause the outcome supports, with a sha256 over the canonical receipt body. A solver is a
module with NAME, HANDLES and solve(scene). New solvers (chempy, cantera, tellurium, …) register in SOLVERS.
"""
from __future__ import annotations

import hashlib
import json
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "engine"))
from rmc_engine_v1 import sim_scene  # noqa: E402

SCHEMA = "FORGE-SIM-RECEIPT/v1"
SOLVERS: list[Any] = []
_ERR: dict[str, str] = {}
try:
    from .solvers import mujoco_rigid
    SOLVERS.append(mujoco_rigid)
except Exception as e:  # pragma: no cover
    _ERR["mujoco_rigid"] = repr(e)
try:
    from .solvers import sympy_math
    SOLVERS.append(sympy_math)
except Exception as e:  # pragma: no cover
    _ERR["sympy_math"] = repr(e)

PRIMARY = {"push": "mujoco_rigid", "drop": "mujoco_rigid", "throw": "sympy_math"}
VERB_3SG = {"topple": "topples", "slide": "slides", "stay": "stays", "fall": "falls", "roll": "rolls", "land": "lands"}
GERUND = {"push": "pushing", "drop": "dropping", "throw": "throwing", "release": "releasing", "shove": "shoving",
          "nudge": "nudging", "tap": "tapping", "poke": "poking", "hit": "hitting", "kick": "kicking", "bump": "bumping",
          "flick": "flicking", "toss": "tossing", "launch": "launching", "let": "releasing"}


def health() -> dict[str, Any]:
    return {"schema": SCHEMA, "ok": bool(SOLVERS), "solvers": [{"name": s.NAME, "handles": list(s.HANDLES)} for s in SOLVERS],
            "errors": _ERR, "calls_llm": False}


def _clause(scene: dict[str, Any], outcome: str, primary: dict[str, Any]) -> tuple[str, str]:
    raw = scene["intervention_raw"]
    words = raw.split()
    if words and words[0].lower() in ("you", "i", "we", "they", "someone", "one"):
        words = words[1:]
    verb = words[0].lower() if words else scene["verb"]
    rest = " ".join(words[1:])
    if scene["verb"] == "release" and rest.lower().startswith("go of "):
        rest = rest[6:]
    rest = rest.replace(" a ", " the ", 1) if (" " + rest).startswith(" a ") is False else rest
    if rest.lower().startswith(("a ", "an ")):
        rest = "the " + rest.split(" ", 1)[1]
    ger = GERUND.get(scene["verb"], scene["verb"] + "ing")
    noun = scene["body"]["noun"]
    adj = " ".join(scene["body"].get("adjectives") or [])
    subject = "The " + (adj + " " if adj else "") + noun
    if outcome == "land":
        ms = primary["measurements"]
        effect = f"{subject} lands {ms['range_m']:g} meters away after {ms['flight_time_s']:g} seconds."
        return f"{ger.capitalize()} {rest} makes it land.", effect
    return f"{ger.capitalize()} {rest} makes it {outcome}.", f"{subject} {VERB_3SG.get(outcome, outcome + 's')}."


def route(question: str) -> dict[str, Any]:
    t0 = time.time()
    scene = sim_scene.compile_scene(question)
    base = {"schema": SCHEMA, "question": question, "calls_llm": False, "router": "forge-sim-router/4.9.244"}
    if not scene.get("ok"):
        return {**base, "ok": False, "status": "hold", "scene": scene, "reason": scene.get("reason"), "missing": scene.get("missing")}
    runs = []
    for s in SOLVERS:
        if scene["action"] in s.HANDLES:
            try:
                runs.append(s.solve(scene))
            except Exception as e:
                runs.append({"solver": s.NAME, "error": repr(e)[:300]})
    want = PRIMARY.get(scene["action"])
    primary = next((r for r in runs if r.get("solver") == want and r.get("outcome")), None)
    if primary is None:
        return {**base, "ok": False, "status": "hold", "scene": scene, "runs": runs, "reason": "solver_unavailable_or_failed"}
    outcome = primary["outcome"]
    clause, effect = _clause(scene, outcome, primary)
    body = {"scene": scene, "runs": [{k: v for k, v in r.items() if k != "mjcf"} for r in runs], "outcome": outcome,
            "primary_solver": want, "clause": clause, "effect_text": effect}
    sha = hashlib.sha256(json.dumps(body, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()
    rid = "sim-" + sha[:16]
    row = {"id": rid, "text": clause, "source": "sim_receipt", "trust": "solver_receipt",
           "sim": {"receipt_id": rid, "sha256": sha, "intervention_key": scene["intervention_key"], "effect_text": effect,
                   "outcome": outcome, "solver": primary["solver"], "engine": primary["engine"],
                   "measurements": primary.get("measurements"),
                   "cross_check": [{"solver": r.get("solver"), "outcome": r.get("outcome"), "measurements": r.get("measurements")} for r in runs if r is not primary]}}
    return {**base, "ok": True, "status": "simulated", **body, "receipt_id": rid, "sha256": sha, "rows": [row],
            "elapsed_s": round(time.time() - t0, 3)}
