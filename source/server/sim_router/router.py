"""FORGE Simulation Router — the Home PC Simulator (4.9.245; first cut 4.9.244). No model: solvers only.

The phone runs seven simulator families itself (engine sim_device + src/sim_device.js). This router is the optional
Home PC slot: the same plan/seal code (engine sim_device) in CPython, plus the solvers too heavy for a phone
(OpenFOAM CFD, PySCF Hartree-Fock/DFT). route(question) → plan → run the solver here when it is installed → a sha256-sealed
FORGE-SIM-RECEIPT/v1, or a structured hold that names what is missing and how to install it.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "engine"))
from rmc_engine_v1 import sim_device as S  # noqa: E402

SCHEMA = S.SCHEMA
VERSION = "forge-sim-router/4.9.245"
_ERR: dict[str, str] = {}
SOLVERS: dict[str, Any] = {}
for _name in ("mujoco_rigid", "sympy_math", "openfoam_cfd", "pyscf_abinitio"):
    try:
        SOLVERS[_name] = __import__(f"server.sim_router.solvers.{_name}", fromlist=["solve"]) if __package__ else __import__(f"solvers.{_name}", fromlist=["solve"])
    except Exception as e:  # pragma: no cover - a missing optional package
        _ERR[_name] = repr(e)[:200]
PY_INSTALL = {"sympy_pyodide": "sympy mpmath", "chemistry_ondevice": "sympy mpmath", "chemistry_kinetics": "numpy scipy",
              "biology_ondevice": "biopython", "biology_kinetics": "numpy scipy", "astronomy_ondevice": "numpy astropy",
              "quantum_ondevice": "numpy scipy"}


def _installed(name: str) -> bool:
    m = SOLVERS.get(name)
    return bool(m) and (getattr(m, "installed", lambda: True)())


def health() -> dict[str, Any]:
    rows = [{"name": n, "installed": _installed(n)} for n in ("mujoco_rigid", "sympy_math", "openfoam_cfd", "pyscf_abinitio")]
    return {"schema": SCHEMA, "ok": True, "router": VERSION, "solvers": rows, "errors": _ERR, "calls_llm": False,
            "families_on_phone": sorted(k for k, v in S.SOLVERS.items() if v["runtime"] != "home_pc")}


def _hold(problem: dict[str, Any], reason: str, **extra: Any) -> dict[str, Any]:
    r = S.hold_receipt(problem, reason, where="home_pc")
    r.update(router=VERSION, **extra)
    return r


def _athena_facts(p: dict[str, Any]) -> list[dict[str, Any]]:
    """Home PC / CPython only. The phone fetches the same publishers in the browser (CORS) and passes facts in."""
    from rmc_engine_v1 import athena_props as A
    name = p.get("substance") or p.get("body")
    scene = p.get("scene") if isinstance(p.get("scene"), dict) else {}
    if not name:
        name = scene.get("body") if isinstance(scene.get("body"), str) else (scene.get("body") or {}).get("noun")
    if not name:
        return []
    kind = "chemical" if p.get("reason") == "unknown_substance" or p.get("substance") else (
        "body" if p.get("missing") == "radius" else "object")
    try:
        got = A.facts_for(kind, str(name))
    except Exception:
        return []
    return list(got.get("ok") or [])


def route(question: str, frame: dict[str, Any] | None = None, facts: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    t0 = time.time()
    p = S.plan(question, frame, facts)
    if not p.get("ok") and not facts and p.get("reason") in ("unknown_substance", "unknown_body", "property_missing"):
        filled = _athena_facts(p)
        if filled:
            p = S.plan(question, frame, filled)
    if not p.get("ok"):
        return {"schema": SCHEMA, "ok": False, "status": "hold", "question": question, "router": VERSION, "problem": p,
                "reason": p.get("reason"), "missing": p.get("missing"), "calls_llm": False}
    s = p["solver"]
    try:
        if s in S.HOME_PC:
            mod = SOLVERS.get(s)
            if mod is None:
                return _hold(p, "solver_module_failed", error=_ERR.get(s))
            run = mod.solve(p)
            if run.get("hold"):
                return _hold(p, run["reason"], install=run.get("install"), detail={k: v for k, v in run.items() if k not in ("hold", "reason", "install")})
        elif s == "mujoco_wasm":
            if not _installed("mujoco_rigid"):
                return _hold(p, "mujoco_not_installed", install={"pip": "python3 -m pip install mujoco==3.17.0 numpy"})
            run = SOLVERS["mujoco_rigid"].solve(p)
        elif p["runtime"] == "pyodide":
            try:
                run = S.solve(p)
            except ImportError as e:
                return _hold(p, "python_package_missing", install={"pip": "python3 -m pip install " + PY_INSTALL.get(s, "")}, error=str(e))
        else:
            return _hold(p, "runs_on_the_phone", note=f"{s} is a WASM engine the phone runs itself")
    except Exception as e:
        return _hold(p, "solver_failed", error=repr(e)[:300])
    rec = S.seal(p, run, where="home_pc")
    rec["router"] = VERSION
    rec["elapsed_s"] = round(time.time() - t0, 3)
    return rec
