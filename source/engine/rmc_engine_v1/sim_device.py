"""4.9.245 (plan 229 step 12c): the seven on-device simulator families and the shared receipt seal.

plan(question) compiles a question into a FORGE-SIM-PROBLEM/v1: the family, the solver, where it runs (pyodide = Python
packages loaded into the phone's engine worker, wasm = a WebAssembly engine in the page, home_pc = a heavy solver that
needs the optional Home PC Simulator), the packages it needs and the parsed quantities. Nothing in a problem is an
answer. solve(problem) runs the Python families (SymPy, SciPy, Biopython, astropy); finish(problem, raw) reads what a
WASM engine measured (MuJoCo, RDKit, ngspice). seal(problem, run) turns a run into a FORGE-SIM-RECEIPT/v1 with a
sha256 over the canonical body and memory rows (source sim_receipt) that Ask uses for this turn only. The same code
runs in Pyodide on the phone and in CPython on a Home PC router. No model.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
from fractions import Fraction
from functools import reduce
from pathlib import Path
from typing import Any

PROBLEM = "FORGE-SIM-PROBLEM/v1"
SCHEMA = "FORGE-SIM-RECEIPT/v1"
VERSION = "forge-sim-device/4.9.245"
_DATA: dict[str, Any] | None = None

# solver → (family, runtime, Pyodide packages from the pinned 0.27.7 lock; WASM engines load in the page)
SOLVERS: dict[str, dict[str, Any]] = {
    "mujoco_wasm": {"family": "physics", "runtime": "wasm", "engine": "@mujoco/mujoco@3.17.0", "packages": []},
    "sympy_pyodide": {"family": "math", "runtime": "pyodide", "packages": ["mpmath", "sympy"]},
    "chemistry_ondevice": {"family": "chemistry", "runtime": "pyodide", "packages": ["mpmath", "sympy"]},
    "chemistry_kinetics": {"family": "chemistry", "runtime": "pyodide", "packages": ["numpy", "scipy"]},
    "rdkit_wasm": {"family": "chemistry", "runtime": "wasm", "engine": "@rdkit/rdkit@2026.9.2", "packages": []},
    "biology_ondevice": {"family": "biology", "runtime": "pyodide", "packages": ["biopython"]},
    "biology_kinetics": {"family": "biology", "runtime": "pyodide", "packages": ["numpy", "scipy"]},
    "astronomy_ondevice": {"family": "astronomy", "runtime": "pyodide", "packages": ["numpy", "astropy"]},
    "quantum_ondevice": {"family": "quantum", "runtime": "pyodide", "packages": ["numpy", "scipy"]},
    "circuits_wasm": {"family": "circuits", "runtime": "wasm", "engine": "eecircuit-engine@1.9.0 (ngspice)", "packages": []},
    "openfoam_cfd": {"family": "cfd", "runtime": "home_pc", "packages": [], "needs": "OpenFOAM CFD"},
    "pyscf_abinitio": {"family": "abinitio", "runtime": "home_pc", "packages": [], "needs": "PySCF Hartree-Fock / DFT"},
}
HOME_PC = {k for k, v in SOLVERS.items() if v["runtime"] == "home_pc"}


def data() -> dict[str, Any]:
    global _DATA
    if _DATA is None:
        _DATA = json.loads(Path(__file__).with_name("sim_data.json").read_text(encoding="utf-8"))
    return _DATA


def _g(x: float, sig: int = 4) -> str:
    if x == 0:
        return "0"
    s = f"{x:.{sig}g}"
    if "e" in s:
        m, e = s.split("e")
        return f"{m} times 10 to the {int(e)}"
    return s


def _hold(q: str, reason: str, missing: str, **extra: Any) -> dict[str, Any]:
    return {"schema": PROBLEM, "ok": False, "status": "hold", "question": q, "reason": reason, "missing": missing,
            "calls_llm": False, **extra}


def _problem(q: str, solver: str, key: str | None, **extra: Any) -> dict[str, Any]:
    s = SOLVERS[solver]
    return {"schema": PROBLEM, "ok": True, "status": "compiled", "question": q, "solver": solver, "family": s["family"],
            "runtime": s["runtime"], "packages": list(s["packages"]), "engine": s.get("engine"), "intervention_key": key,
            "calls_llm": False, **extra}


def _raw(q: str) -> str | None:
    from rmc_engine_v1.cause_effect import intervention_of
    inter = intervention_of(q)
    return str(inter.get("raw") or "").strip().rstrip("?. ") if inter else None


def _key(raw: str | None) -> str | None:
    from rmc_engine_v1.sim_scene import intervention_key
    return intervention_key(raw) if raw else None


# ---------------------------------------------------------------- plan
# 4.9.246: dispatch is the kāraka reading (sim_karaka.read). The regex question templates are gone.


def plan(question: str, frame: dict[str, Any] | None = None, facts: list[dict[str, Any]] | None = None,
         memory: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    from rmc_engine_v1.sim_karaka import memory_facts, read
    from rmc_engine_v1.sim_scene import scene_from_reading
    q = re.sub(r"\s+", " ", str(question or "").strip())
    remembered = memory_facts(memory)
    # A quantity the question states is already on the frame. Remembered rows fill only what it did not state.
    reading = read(q, frame, (remembered or []) + list(facts or []))
    if reading.get("hold"):
        return _hold(q, reading.get("reason") or "hold", reading.get("missing") or "frame", frame_rule=reading.get("reason"))
    from rmc_engine_v1.sim_karaka import karaka_key
    kind = reading["kind"]
    key = karaka_key(reading)
    if kind == "cfd":
        return _problem(q, "openfoam_cfd", key, case={"speed_m_s": reading.get("speed_m_s"), "text": q[:200]})
    if kind == "qc":
        mol = reading.get("molecule")
        chem = reading.get("chem") or {}
        if mol and not chem.get("formula") and mol not in data()["substances"] and mol not in (data().get("bodies") or {}):
            return _hold(q, "unknown_substance", "karma", substance=mol)
        return _problem(q, "pyscf_abinitio", key, molecule=mol, method=reading.get("method") or "HF",
                        formula=(chem.get("formula") or (data()["substances"].get(mol) or {}).get("formula")))
    if kind == "mol":
        name = reading["substance"]
        chem = reading.get("chem") or {}
        sub = data()["substances"].get(name) or {}
        smiles = chem.get("smiles") or sub.get("smiles")
        formula = chem.get("formula") or sub.get("formula")
        if not smiles and not formula:
            return _hold(q, "unknown_substance", "karma", substance=name)
        asked = ""
        kartr = (reading.get("frame") or {}).get("kartr") if isinstance(reading.get("frame"), dict) else None
        if isinstance(kartr, dict) and kartr.get("text"):
            asked = str(kartr["text"])
        return _problem(q, "rdkit_wasm", key, substance=name, smiles=smiles, formula=formula,
                        property=reading.get("property") or "weight", property_text=asked)
    if kind == "quantum":
        return _problem(q, "quantum_ondevice", key, state=reading.get("state") or 0, gate=reading["gate"],
                        theta_over_pi=reading.get("theta_over_pi") or 1.0)
    if kind == "orbit":
        body = reading.get("body") or "earth"
        facts_b = reading.get("body_facts") or {}
        known = {"earth", "sun", "jupiter"} | set(data().get("bodies") or {})
        if reading.get("altitude_m") is None:
            return _hold(q, "altitude_missing", "altitude", body=body)
        if body not in known and not (facts_b.get("gm") and facts_b.get("radius")):
            return _hold(q, "unknown_body", "radius", body=body)
        return _problem(q, "astronomy_ondevice", key, body=body, altitude_m=reading.get("altitude_m") or 0.0, body_facts=facts_b)
    if kind == "sequence":
        if not reading.get("sequence"):
            return _hold(q, "sequence_missing", "sequence")
        seq = reading["sequence"]
        return _problem(q, "biology_ondevice", key, sequence=seq, op=reading.get("op") or "translate",
                        kind="RNA" if ("U" in seq and "T" not in seq) else "DNA")
    if kind == "enzyme":
        return _enzyme_from_frame(q, reading, key)
    if kind == "kinetics":
        return _kinetics_from_frame(q, reading, key)
    if kind == "circuit":
        return _circuit_from_frame(q, reading, key)
    if kind == "reaction":
        return _reaction_from_frame(q, reading, key)
    scene = scene_from_reading(reading)
    if not scene.get("ok"):
        return _hold(q, scene.get("reason", "scene_hold"), scene.get("missing", "scene"), scene=scene)
    solver = "sympy_pyodide" if scene["action"] == "throw" else "mujoco_wasm"
    return _problem(q, solver, scene["intervention_key"], scene=scene)


def _enzyme_from_frame(q: str, reading: dict[str, Any], key: str | None) -> dict[str, Any]:
    from rmc_engine_v1.sim_karaka import measures, _token_pairs
    part = reading.get("part") or {}
    vmax = km = s0 = t = None
    words = [str(t.get("w") or "") for t in (part.get("tokens") or [])]
    for i, w in enumerate(words):
        if w.lower() == "vmax" and i + 1 < len(words):
            try: vmax = float(words[i + 1])
            except ValueError: pass
        if w.lower() == "km" and i + 1 < len(words):
            try: km = float(words[i + 1])
            except ValueError: pass
    for num, unit in _token_pairs(part):
        if unit in ("second", "seconds", "s"):
            t = num
        elif unit in ("mm", "millimolar"):
            s0 = num
    for m in measures(part):
        h = m.get("head") or ""
        if h in ("vmax",) or "vmax" in h:
            vmax = m["num"]
        elif h in ("km",):
            km = m["num"]
        elif h in ("second", "minute", "hour", "s"):
            t = m["num"] * {"minute": 60, "hour": 3600}.get(h, 1)
        elif "mol" in h or h in ("mm", "millimolar"):
            s0 = m["num"]
    if None in (vmax, km, s0, t):
        return _hold(q, "enzyme_quantity_missing", "Vmax, Km, substrate or time")
    return _problem(q, "biology_kinetics", key, vmax=vmax, km=km, s0=s0, t=t,
                    note="well-mixed Michaelis-Menten ODE; spatial reaction-diffusion (dune-copasi) is a Home PC slot")


def _kinetics_from_frame(q: str, reading: dict[str, Any], key: str | None) -> dict[str, Any]:
    from rmc_engine_v1.sim_karaka import measures, _token_pairs
    part = reading.get("part") or {}
    k = c0 = t = None
    order = 1
    words = [str(t.get("w") or "").lower() for t in (part.get("tokens") or [])]
    if "second-order" in " ".join(words) or ( "second" in words and "order" in words):
        order = 2
    for i, w in enumerate(words):
        if w == "constant" and i + 1 < len(words):
            try: k = float(words[i + 1])
            except ValueError: pass
    for num, unit in _token_pairs(part):
        if unit in ("second", "seconds", "s"):
            t = num
        elif unit in ("mol/l", "mol", "molar"):
            c0 = num
    for m in measures(part):
        h = (m.get("head") or "")
        if h in ("second", "minute", "hour", "s", "min"):
            t = m["num"] * {"minute": 60, "min": 60, "hour": 3600}.get(h, 1)
        elif "mol" in h:
            c0 = m["num"]
        elif m.get("np") and "rate" in h:
            k = m["num"]
    # the rate constant's of-complement is the number ("the rate constant of 0.2")
    kartr = part.get("kartr") if isinstance(part.get("kartr"), dict) else {}
    of = kartr.get("of") if isinstance(kartr.get("of"), dict) else {}
    if of.get("num") is not None:
        try:
            k = float(of["num"])
        except (TypeError, ValueError):
            pass
    heads = " ".join(str(x.get("head") or "") for x in [kartr])
    if "second" in json.dumps(part.get("adj") or []) and "order" in json.dumps(part):
        order = 2
    if k is None or c0 is None or t is None:
        return _hold(q, "kinetics_quantity_missing", "rate constant, concentration or time")
    return _problem(q, "chemistry_kinetics", key, k=k, c0=c0, t=t, order=order)


def _circuit_from_frame(q: str, reading: dict[str, Any], key: str | None) -> dict[str, Any]:
    from rmc_engine_v1.sim_karaka import measures
    part = reading.get("part") or {}
    v = None
    rs: list[float] = []
    cap = None
    t = None

    def walk(np: dict[str, Any] | None) -> None:
        if not isinstance(np, dict):
            return
        for child in np.get("conj") or []:
            walk(child)
        h = str(np.get("head") or "")
        of = np.get("of") if isinstance(np.get("of"), dict) else None
        num = None
        try:
            num = float(of.get("num")) if of and of.get("num") not in (None, "") else (float(np["num"]) if np.get("num") not in (None, "") else None)
        except (TypeError, ValueError):
            num = None
        unit = str((of or {}).get("head") or h)
        if num is None:
            return
        if unit in ("ohm", "kiloohm") or h in ("ohm", "kiloohm"):
            rs.append(num * (1e3 if "kilo" in unit or "kilo" in h else 1.0))
        elif unit in ("farad",) or h == "farad":
            nonlocal cap
            cap = num
    for a in part.get("adj") or []:
        if isinstance(a, dict):
            walk(a.get("np"))
    from rmc_engine_v1.sim_karaka import _token_pairs
    for num, unit in _token_pairs(part):
        if unit in ("volt", "volts", "v"):
            v = num
        elif unit in ("kiloohm", "ohm", "ohms"):
            rs.append(num * (1e3 if unit == "kiloohm" else 1.0))
        elif re.fullmatch(r"\d+(?:\.\d+)?k", unit) or unit == "k":
            rs.append(num * 1e3)
        elif unit in ("uf", "µf", "μf"):
            cap = num * 1e-6
        elif unit in ("f", "farad", "farads"):
            cap = num
        elif unit in ("ms", "millisecond", "milliseconds"):
            t = num * 0.001
        elif unit in ("second", "seconds", "s"):
            t = num
    # a fused token "1k" / "2k" is one word in the tagger
    for tok in part.get("tokens") or []:
        m = re.fullmatch(r"(\d+(?:\.\d+)?)k", str(tok.get("w") or ""), flags=re.I)
        if m:
            rs.append(float(m.group(1)) * 1e3)
        m = re.fullmatch(r"(\d+(?:\.\d+)?)uf", str(tok.get("w") or ""), flags=re.I)
        if m:
            cap = float(m.group(1)) * 1e-6
    for m in measures(part):
        h = m.get("head") or ""
        n = m["num"]
        if h == "volt":
            v = n
        elif h in ("ohm", "kiloohm"):
            rs.append(n * (1e3 if h == "kiloohm" else 1.0))
        elif h in ("farad",):
            cap = n
        elif h in ("second", "millisecond"):
            t = n * (0.001 if h == "millisecond" else 1.0)
        elif h in ("resistor",) and n:
            rs.append(n)
    if v is None:
        return _hold(q, "voltage_missing", "voltage")
    if cap is not None:
        if not rs:
            return _hold(q, "resistor_missing", "resistance")
        tt = t or 5 * rs[0] * cap
        net = (f"* FORGE RC charge\nV1 in 0 PWL(0 0 1n {v:g})\nR1 in out {rs[0]:g}\nC1 out 0 {cap:g} IC=0\n"
               f".tran {tt / 500:g} {tt:g} 0 {tt / 500:g} uic\n.end\n")
        return _problem(q, "circuits_wasm", key, topology="rc", V=v, R=rs[0], C=cap, t=tt, netlist=net)
    if len(rs) < 1:
        return _hold(q, "resistor_missing", "resistance")
    heads = " ".join(m.get("head") or "" for m in measures(part))
    divider = "divider" in heads or any("divider" in (m.get("head") or "") for m in measures(part))
    # the divider noun may be the adjunct head, not a measured NP
    from rmc_engine_v1.sim_karaka import _heads_of
    blob = " ".join(_heads_of(part)) + " " + str(part.get("text") or "") + " " + " ".join(str(c.get("reading") or "") for c in (part.get("canonical") or []))
    if "divider" in blob and len(rs) >= 2:
        lines = f"R1 in out {rs[0]:g}\nR2 out 0 {rs[1]:g}\n"
        topo = "divider"
    elif "parallel" in blob and len(rs) >= 2:
        lines = "".join(f"R{i + 1} in 0 {x:g}\n" for i, x in enumerate(rs))
        topo = "parallel"
    else:
        nodes = ["in"] + [f"n{i}" for i in range(1, len(rs))] + ["0"]
        lines = "".join(f"R{i + 1} {nodes[i]} {nodes[i + 1]} {x:g}\n" for i, x in enumerate(rs))
        topo = "series" if len(rs) > 1 else "single"
    net = f"* FORGE {topo}\nV1 in 0 DC {v:g}\n{lines}.op\n.end\n"
    return _problem(q, "circuits_wasm", key, topology=topo, V=v, resistors=rs, netlist=net)


def _reaction_from_frame(q: str, reading: dict[str, Any], key: str | None) -> dict[str, Any]:
    D = data()
    names = list(reading.get("substances") or [])
    chem = reading.get("chem") or {}
    if not names:
        return _hold(q, "unknown_substance", "karma")
    formulas = []
    resolved = []
    for n in names:
        sub = D["substances"].get(n) or {}
        formula = (chem.get(n) or {}).get("formula") or sub.get("formula")
        if not formula:
            return _hold(q, "unknown_substance", "karma", substance=n)
        formulas.append(formula)
        resolved.append(n)
    burn = bool(reading.get("burn")) or ("oxygen" in resolved and len(resolved) == 2 and any(
        "C" in _parse_formula(f) for n, f in zip(resolved, formulas) if n != "oxygen"))
    reactants = list(formulas)
    if burn and "O2" not in reactants:
        reactants.append("O2")
        resolved.append("oxygen")
    products, rule = None, None
    for s in D["synthesis"]:
        if sorted(s["reactants"]) == sorted(reactants):
            products, rule = list(s["products"]), "synthesis"
    if products is None and burn:
        fuel = [f for f in reactants if f != "O2"]
        if len(fuel) == 1 and set(_parse_formula(fuel[0])) <= {"C", "H", "O"} and "C" in _parse_formula(fuel[0]):
            products, rule = ["CO2", "H2O"], "combustion"
        elif fuel == ["H2"]:
            products, rule = ["H2O"], "synthesis"
    if products is None:
        return _hold(q, "reaction_class_unknown", "products", reactants=reactants)
    return _problem(q, "chemistry_ondevice", key, reactant_names=resolved, reactants=reactants, products=products,
                    reaction_class=rule, source=D["sources"]["reactions"])


def _cfd_case(low: str) -> dict[str, Any]:
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:m/s|meters? per second)", low)
    return {"speed_m_s": float(m.group(1)) if m else None, "text": low[:200]}


def _substance_in(low: str) -> str | None:
    for name in sorted(data()["substances"], key=len, reverse=True):
        if re.search(r"\b" + re.escape(name) + r"\b", low):
            return name
    return None


def _substances(low: str) -> list[str]:
    out, rest = [], low
    for name in sorted(data()["substances"], key=len, reverse=True):
        if re.search(r"\b" + re.escape(name) + r"\b", rest):
            out.append((rest.index(name), name))
            rest = re.sub(r"\b" + re.escape(name) + r"\b", " " * len(name), rest)
    return [n for _, n in sorted(out)]


def _plan_reaction(q: str, r: str, key: str | None) -> dict[str, Any]:
    D = data()
    names = [n for n in _substances(r)]
    if not names:
        return _hold(q, "unknown_substance", "karma")
    burn = bool(re.search(r"\b(burn\w*|combust\w*|ignite\w*)\b", r)) or "oxygen" in names and len(names) == 2 and any(
        "C" in _parse_formula(D["substances"][n]["formula"]) for n in names if n != "oxygen")
    reactants = [D["substances"][n]["formula"] for n in names]
    if burn and "O2" not in reactants:
        reactants.append("O2"); names.append("oxygen")
    products, rule = None, None
    for s in D["synthesis"]:
        if sorted(s["reactants"]) == sorted(reactants):
            products, rule = list(s["products"]), "synthesis"
    if products is None and burn:
        fuel = [f for f in reactants if f != "O2"]
        if len(fuel) == 1 and set(_parse_formula(fuel[0])) <= {"C", "H", "O"} and "C" in _parse_formula(fuel[0]):
            products, rule = ["CO2", "H2O"], "combustion"
        elif fuel == ["H2"]:
            products, rule = ["H2O"], "synthesis"
    if products is None:
        return _hold(q, "reaction_class_unknown", "products", reactants=reactants)
    return _problem(q, "chemistry_ondevice", key, reactant_names=names, reactants=reactants, products=products,
                    reaction_class=rule, source=D["sources"]["reactions"])


def _num(pat: str, s: str) -> float | None:
    m = re.search(pat, s)
    return float(m.group(1)) if m else None


def _seconds(r: str) -> float | None:
    m = re.search(r"for\s+(\d+(?:\.\d+)?)\s*(seconds?|s|minutes?|min|hours?|h|milliseconds?|ms)\b", r)
    if not m:
        return None
    u = m.group(2)
    f = 0.001 if u.startswith("ms") or u.startswith("milli") else 60 if u.startswith("min") else 3600 if u.startswith("h") else 1
    return float(m.group(1)) * f


def _plan_kinetics(q: str, r: str, key: str | None) -> dict[str, Any]:
    k = _num(r"rate constant (?:of )?(\d+(?:\.\d+)?)", r)
    c0 = _num(r"(\d+(?:\.\d+)?)\s*(?:mol/l|molar|m\b|mol per liter)", r)
    t = _seconds(r)
    if k is None or c0 is None or t is None:
        return _hold(q, "kinetics_quantity_missing", "rate constant, concentration or time")
    order = 2 if re.search(r"second[- ]order", r) else 1
    return _problem(q, "chemistry_kinetics", key, k=k, c0=c0, t=t, order=order)


def _plan_sequence(q: str, r: str, raw: str, key: str | None) -> dict[str, Any]:
    m = re.search(r"\b([acgtu]{6,})\b", r)
    if not m:
        return _hold(q, "sequence_missing", "sequence")
    seq = m.group(1).upper()
    op = "transcribe" if re.search(r"transcri", r) and not re.search(r"translat|ribosome|protein", r) else "translate"
    kind = "RNA" if ("U" in seq and "T" not in seq) else "DNA"
    return _problem(q, "biology_ondevice", key, sequence=seq, op=op, kind=kind)


def _plan_enzyme(q: str, r: str, key: str | None) -> dict[str, Any]:
    vmax = _num(r"vmax (?:of |is |=\s*)?(\d+(?:\.\d+)?)", r)
    km = _num(r"\bkm (?:of |is |=\s*)?(\d+(?:\.\d+)?)", r)
    s0 = _num(r"(\d+(?:\.\d+)?)\s*(?:mm|millimolar)\s+(?:of\s+)?substrate", r) or _num(r"substrate (?:of |at )?(\d+(?:\.\d+)?)", r)
    t = _seconds(r)
    if None in (vmax, km, s0, t):
        return _hold(q, "enzyme_quantity_missing", "Vmax, Km, substrate or time")
    return _problem(q, "biology_kinetics", key, vmax=vmax, km=km, s0=s0, t=t,
                    note="well-mixed Michaelis-Menten ODE; spatial reaction-diffusion (dune-copasi) is a Home PC slot")


def _plan_orbit(q: str, r: str, key: str | None) -> dict[str, Any]:
    body = "earth"
    for b in ("earth", "moon", "mars", "venus", "mercury", "jupiter", "saturn", "sun"):
        if re.search(r"\b" + b + r"\b", r):
            body = b
            break
    alt = None
    m = re.search(r"(\d+(?:\.\d+)?)\s*(km|kilometers?|kilometres?|m|meters?|miles?)\b", r)
    if m:
        u = m.group(2)
        alt = float(m.group(1)) * (1000 if u.startswith("k") else 1609.344 if u.startswith("mi") else 1)
    if alt is None and "surface" not in r:
        return _hold(q, "altitude_missing", "altitude")
    return _problem(q, "astronomy_ondevice", key, body=body, altitude_m=alt or 0.0)


def _plan_quantum(q: str, r: str, key: str | None) -> dict[str, Any]:
    state = 1 if re.search(r"(\|1>|\|1⟩|state 1\b|state one|one state|excited)", r) else 0
    if re.search(r"hadamard", r):
        op = {"gate": "H"}
    elif re.search(r"pauli[- ]?x|\bx gate|\bnot gate", r):
        op = {"gate": "X"}
    elif re.search(r"pauli[- ]?y|\by gate", r):
        op = {"gate": "Y"}
    elif re.search(r"pauli[- ]?z|\bz gate", r):
        op = {"gate": "Z"}
    elif re.search(r"rabi|pulse", r):
        m = re.search(r"(?:pi|π)\s*(?:/|over)\s*(\d+)", r)
        op = {"gate": "RABI", "theta_over_pi": 1.0 / float(m.group(1)) if m else 1.0}
    else:
        return _hold(q, "gate_missing", "gate")
    return _problem(q, "quantum_ondevice", key, state=state, **op)


_SI = {"": 1.0, "k": 1e3, "m": 1e-3, "meg": 1e6, "u": 1e-6, "µ": 1e-6, "μ": 1e-6, "n": 1e-9, "p": 1e-12}


def _ohms(r: str) -> list[float]:
    out = []
    for m in re.finditer(r"(\d+(?:\.\d+)?)\s*(k|kilo|m|mega|meg)?\s*(?:ohms?|Ω|\b)(?=[\s,.]|$)", r):
        pre = (m.group(2) or "")
        tail = r[m.end(): m.end() + 12]
        txt = m.group(0)
        if not (re.search(r"(ohm|Ω)", txt) or pre in ("k", "kilo")):
            continue
        mult = 1e3 if pre in ("k", "kilo") else 1e6 if pre in ("mega", "meg") or (pre == "m" and "ohm" in txt) else 1.0
        out.append(float(m.group(1)) * mult)
    return out


def _plan_circuit(q: str, r: str, key: str | None) -> dict[str, Any]:
    v = _num(r"(\d+(?:\.\d+)?)\s*(?:v|volts?)\b", r)
    if v is None:
        return _hold(q, "voltage_missing", "voltage")
    rs = _ohms(r)
    m = re.search(r"(\d+(?:\.\d+)?)\s*(µ|μ|u|micro|n|nano|p|pico|m|milli)?\s*(?:f|farads?)\b", r)
    if m:
        pre = m.group(2) or ""
        c = float(m.group(1)) * {"": 1, "µ": 1e-6, "μ": 1e-6, "u": 1e-6, "micro": 1e-6, "n": 1e-9, "nano": 1e-9,
                                 "p": 1e-12, "pico": 1e-12, "m": 1e-3, "milli": 1e-3}[pre]
        if not rs:
            return _hold(q, "resistor_missing", "resistance")
        t = _seconds(r) or 5 * rs[0] * c
        net = (f"* FORGE RC charge\nV1 in 0 PWL(0 0 1n {v:g})\nR1 in out {rs[0]:g}\nC1 out 0 {c:g} IC=0\n"
               f".tran {t / 500:g} {t:g} 0 {t / 500:g} uic\n.end\n")
        return _problem(q, "circuits_wasm", key, topology="rc", V=v, R=rs[0], C=c, t=t, netlist=net)
    if len(rs) < 1:
        return _hold(q, "resistor_missing", "resistance")
    if "parallel" in r and len(rs) >= 2:
        lines = "".join(f"R{i + 1} in 0 {x:g}\n" for i, x in enumerate(rs))
        topo = "parallel"
    elif "divider" in r and len(rs) >= 2:
        lines = f"R1 in out {rs[0]:g}\nR2 out 0 {rs[1]:g}\n"
        topo = "divider"
    else:
        nodes = ["in"] + [f"n{i}" for i in range(1, len(rs))] + ["0"]
        lines = "".join(f"R{i + 1} {nodes[i]} {nodes[i + 1]} {x:g}\n" for i, x in enumerate(rs))
        topo = "series" if len(rs) > 1 else "single"
    net = f"* FORGE {topo}\nV1 in 0 DC {v:g}\n{lines}.op\n.end\n"
    return _problem(q, "circuits_wasm", key, topology=topo, V=v, resistors=rs, netlist=net)


# ---------------------------------------------------------------- formulas

_EL = ("H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo "
       "Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe").split()


def _parse_formula(f: str) -> dict[str, int]:
    stack: list[dict[str, int]] = [{}]
    for tok in re.findall(r"[A-Z][a-z]?|\d+|\(|\)", f):
        if tok == "(":
            stack.append({})
        elif tok == ")":
            grp = stack.pop()
            stack[-1]["__grp__"] = grp  # type: ignore[assignment]
        elif tok.isdigit():
            top = stack[-1]
            if "__grp__" in top:
                grp = top.pop("__grp__")  # type: ignore[assignment]
                for k, v in grp.items():
                    top[k] = top.get(k, 0) + v * int(tok)
            else:
                last = top["__last__"]  # type: ignore[index]
                top[last] += int(tok) - 1
        else:
            top = stack[-1]
            if "__grp__" in top:
                for k, v in top.pop("__grp__").items():  # type: ignore[union-attr]
                    top[k] = top.get(k, 0) + v
            top[tok] = top.get(tok, 0) + 1
            top["__last__"] = tok  # type: ignore[assignment]
    top = stack[0]
    if "__grp__" in top:
        for k, v in top.pop("__grp__").items():  # type: ignore[union-attr]
            top[k] = top.get(k, 0) + v
    top.pop("__last__", None)
    return top


def hill(counts: dict[str, int]) -> str:
    keys = sorted(counts)
    if "C" in counts:
        keys = ["C"] + (["H"] if "H" in counts else []) + sorted(k for k in counts if k not in ("C", "H"))
    return "".join(k + (str(counts[k]) if counts[k] != 1 else "") for k in keys if counts[k])


def formula_from_rdkit_json(mol_json: str | dict[str, Any]) -> dict[str, int]:
    j = json.loads(mol_json) if isinstance(mol_json, str) else mol_json
    defaults = (j.get("defaults") or {}).get("atom") or {}
    counts: dict[str, int] = {}
    for mol in j.get("molecules") or []:
        for a in mol.get("atoms") or []:
            z = a.get("z", defaults.get("z", 6))
            sym = _EL[z - 1] if 1 <= z <= len(_EL) else f"Z{z}"
            counts[sym] = counts.get(sym, 0) + 1
            h = a.get("impHs", defaults.get("impHs", 0))
            if h:
                counts["H"] = counts.get("H", 0) + h
    return counts


# ---------------------------------------------------------------- MuJoCo job (WASM runs the loop; Python plans and classifies)

DT = 0.0005
SIM_SECONDS = 2.0


def _geom(body: dict[str, Any]) -> tuple[str, str, float]:
    s = body["shape"]
    if s == "cylinder":
        return "cylinder", f'{body["radius"]:.6f} {body["height"] / 2:.6f}', body["height"] / 2
    if s == "box":
        return "box", f'{body["width"] / 2:.6f} {body["width"] / 2:.6f} {body["height"] / 2:.6f}', body["height"] / 2
    return "sphere", f'{body["radius"]:.6f}', body["radius"]


def mjcf(scene: dict[str, Any]) -> str:
    body = scene["body"]
    gtype, gsize, half = _geom(body)
    mu = float(scene["surface"]["mu"])
    z0 = half + (scene.get("drop_height", 0.0) if scene["action"] == "drop" else 0.0)
    return f"""<mujoco model="forge_scene">
  <option timestep="{DT}" gravity="0 0 -{scene['gravity']}" integrator="implicitfast" cone="elliptic"/>
  <default><geom condim="3" solref="0.002 1" solimp="0.95 0.99 0.001"/></default>
  <worldbody>
    <geom name="surface" type="plane" size="50 50 0.1" friction="{mu} 0.005 0.0001"/>
    <body name="obj" pos="0 0 {z0:.6f}">
      <freejoint/>
      <geom name="obj" type="{gtype}" size="{gsize}" mass="{body['mass']}" friction="{mu} 0.005 0.0001"/>
    </body>
  </worldbody>
</mujoco>"""


def mujoco_job(scene: dict[str, Any]) -> dict[str, Any]:
    """Everything the MuJoCo loop needs: MJCF, step count, and the FORGE push (force, body-frame point, duration)."""
    body = scene["body"]
    g = float(scene["gravity"])
    seconds = SIM_SECONDS
    if scene["action"] == "drop":
        seconds = math.sqrt(2 * float(scene.get("drop_height", 1.0)) / g) + 0.5
    job: dict[str, Any] = {"xml": mjcf(scene), "dt": DT, "steps": int(seconds / DT), "seconds": round(seconds, 3),
                           "body": 1, "force": 0.0, "duration": 0.0, "r_local": [0.0, 0.0, 0.0], "drop": scene["action"] == "drop"}
    if scene["action"] == "push":
        _, _, half = _geom(body)
        full = 2 * half if body["shape"] != "sphere" else 2 * body["radius"]
        h = float(scene["point"]["fraction"]) * full
        face = -(body["radius"] if body["shape"] != "box" else body["width"] / 2)
        mass = float(body["mass"])
        mu = float(scene.get("push_reference_mu") or scene["surface"]["mu"])
        half_w = body["radius"] if body["shape"] != "box" else body["width"] / 2
        f_slip = mu * mass * g
        f_tip = mass * g * half_w / max(h, 1e-6) if body["shape"] != "sphere" else float("inf")
        push = scene.get("push") or {}
        job.update(force=float(push.get("margin", 1.25)) * min(f_slip, f_tip), duration=float(push.get("duration_s", 0.5)),
                   r_local=[face, 0.0, h - half], push_height_m=round(h, 4))
    return job


def classify_rigid(scene: dict[str, Any], ms: dict[str, Any]) -> str:
    if scene["action"] == "drop":
        return "fall" if ms["vertical_change_m"] < -0.5 * max(scene.get("drop_height", 0.0), 0.02) else "stay"
    if scene["body"]["shape"] == "sphere":
        return "roll" if ms["horizontal_displacement_m"] > 0.02 else "stay"
    if ms["final_tilt_deg"] > 60.0:
        return "topple"
    return "slide" if ms["horizontal_displacement_m"] > 0.02 else "stay"


CLASSIFIER = ("topple if final tilt > 60 deg; else slide if horizontal displacement > 0.02 m; else stay "
              "(sphere: roll; drop: fall if it lost > half the drop height)")


# ---------------------------------------------------------------- solve (Python families)

def solve(problem: dict[str, Any]) -> dict[str, Any]:
    fn = {"sympy_pyodide": _solve_sympy, "chemistry_ondevice": _solve_reaction, "chemistry_kinetics": _solve_kinetics,
          "biology_ondevice": _solve_sequence, "biology_kinetics": _solve_enzyme, "astronomy_ondevice": _solve_orbit,
          "quantum_ondevice": _solve_quantum}.get(problem["solver"])
    if fn is None:
        return {"solver": problem["solver"], "error": "not a Python family"}
    return fn(problem)


def tip_check(scene: dict[str, Any]) -> dict[str, Any] | None:
    """Quasi-static tip-before-slip cross-check (plain arithmetic, no package): tip first iff h > (w/2)/mu."""
    b = scene["body"]
    if scene["action"] != "push" or b["shape"] == "sphere":
        return None
    half_w = b["radius"] if b["shape"] == "cylinder" else b["width"] / 2
    h = scene["point"]["fraction"] * b["height"]
    h_crit = half_w / scene["surface"]["mu"]
    return {"solver": "statics_check", "role": "cross_check", "outcome": "topple" if h > h_crit else "slide",
            "measurements": {"critical_push_height_m": round(h_crit, 4), "push_height_m": round(h, 4)},
            "equations": ["slip: F > μ m g", "tip: F h > m g w/2", "tip before slip iff h > (w/2)/μ"]}


def _solve_sympy(p: dict[str, Any]) -> dict[str, Any]:
    import sympy as sp
    sc = p["scene"]
    g = sp.nsimplify(sc["gravity"])
    th = sp.rad(sp.nsimplify(sc["launch"]["angle_deg"]))
    v = sp.nsimplify(sc["launch"]["speed"])
    t_f = sp.simplify(2 * v * sp.sin(th) / g)
    rng = sp.simplify(v ** 2 * sp.sin(2 * th) / g)
    h_max = sp.simplify((v * sp.sin(th)) ** 2 / (2 * g))
    return {"solver": "sympy_pyodide", "engine": "sympy " + sp.__version__, "outcome": "land",
            "exact": {"range_m": str(rng), "flight_time_s": str(t_f), "max_height_m": str(h_max)},
            "measurements": {"range_m": round(float(rng), 3), "flight_time_s": round(float(t_f), 3), "max_height_m": round(float(h_max), 3)},
            "equations": ["R = v^2 sin(2θ)/g", "t = 2 v sin θ / g", "H = (v sin θ)^2 / (2g)"]}


def balance(reactants: list[str], products: list[str]) -> list[int]:
    import sympy as sp
    species = reactants + products
    parsed = [_parse_formula(s) for s in species]
    els = sorted({e for d in parsed for e in d})
    M = sp.Matrix([[d.get(e, 0) * (1 if i < len(reactants) else -1) for i, d in enumerate(parsed)] for e in els])
    ns = M.nullspace()
    if len(ns) != 1:
        raise ValueError("reaction does not balance uniquely")
    vec = ns[0]
    den = reduce(lambda a, b: a * b // math.gcd(a, b), [sp.fraction(x)[1] for x in vec], 1)
    ints = [int(x * den) for x in vec]
    if ints[0] < 0:
        ints = [-x for x in ints]
    gg = reduce(math.gcd, ints)
    return [x // gg for x in ints]


def _side(coefs: list[int], species: list[str]) -> str:
    return " + ".join((f"{c} " if c != 1 else "") + s for c, s in zip(coefs, species))


def _solve_reaction(p: dict[str, Any]) -> dict[str, Any]:
    import sympy as sp
    co = balance(p["reactants"], p["products"])
    n = len(p["reactants"])
    eq = _side(co[:n], p["reactants"]) + " -> " + _side(co[n:], p["products"])
    return {"solver": "chemistry_ondevice", "engine": "sympy " + sp.__version__ + " Matrix.nullspace", "outcome": "react",
            "measurements": {"coefficients": co, "equation": eq, "reaction_class": p["reaction_class"]},
            "method": "element-balance matrix A (elements x species, products negative); coefficients = integer-scaled basis of null(A)"}


def _solve_kinetics(p: dict[str, Any]) -> dict[str, Any]:
    import numpy as np
    import scipy
    from scipy.integrate import solve_ivp
    k, c0, t, n = p["k"], p["c0"], p["t"], p["order"]
    sol = solve_ivp(lambda _t, c: [-k * c[0] ** n], (0, t), [c0], rtol=1e-10, atol=1e-12)
    c = float(sol.y[0, -1])
    exact = c0 * math.exp(-k * t) if n == 1 else c0 / (1 + k * c0 * t)
    return {"solver": "chemistry_kinetics", "engine": "scipy " + scipy.__version__ + " solve_ivp (RK45)", "outcome": "decay",
            "measurements": {"concentration_left": round(c, 5), "fraction_left": round(c / c0, 5), "closed_form": round(exact, 5),
                             "half_life_s": round(math.log(2) / k, 4) if n == 1 else round(1 / (k * c0), 4), "steps": int(np.size(sol.t))}}


def _solve_sequence(p: dict[str, Any]) -> dict[str, Any]:
    import Bio
    from Bio.Seq import Seq
    s = Seq(p["sequence"])
    mrna = s.transcribe() if p["kind"] == "DNA" else s
    ms: dict[str, Any] = {"mrna": str(mrna)}
    if p["op"] == "translate":
        full = str(mrna.translate())
        ms.update(protein_with_stops=full, protein=full.split("*")[0], stopped=("*" in full), codons=len(mrna) // 3)
    return {"solver": "biology_ondevice", "engine": "biopython " + Bio.__version__ + " Bio.Seq (standard table 1)",
            "outcome": p["op"], "measurements": ms}


def _solve_enzyme(p: dict[str, Any]) -> dict[str, Any]:
    import scipy
    from scipy.integrate import solve_ivp
    vmax, km, s0, t = p["vmax"], p["km"], p["s0"], p["t"]
    sol = solve_ivp(lambda _t, s: [-vmax * s[0] / (km + s[0])], (0, t), [s0], rtol=1e-10, atol=1e-12)
    s = max(float(sol.y[0, -1]), 0.0)
    return {"solver": "biology_kinetics", "engine": "scipy " + scipy.__version__ + " solve_ivp (RK45)", "outcome": "consume",
            "measurements": {"substrate_left_mM": round(s, 4), "product_made_mM": round(s0 - s, 4),
                             "initial_rate_mM_s": round(vmax * s0 / (km + s0), 4)},
            "model": "dS/dt = -Vmax S / (Km + S); Vmax in mM per second", "spatial_slot": p.get("note")}


def _solve_orbit(p: dict[str, Any]) -> dict[str, Any]:
    b = p["body"]
    if b in ("earth", "sun", "jupiter"):
        import astropy
        from astropy import constants as C
        gm = {"earth": C.GM_earth, "sun": C.GM_sun, "jupiter": C.GM_jup}[b].si.value
        rad = {"earth": C.R_earth, "sun": C.R_sun, "jupiter": C.R_jup}[b].si.value
        name, src = {"earth": "Earth", "sun": "the Sun", "jupiter": "Jupiter"}[b], "astropy.constants (IAU 2015)"
        engine = "astropy " + astropy.__version__
    else:
        facts = p.get("body_facts") or {}
        rec = (data().get("bodies") or {}).get(b) or {}
        if facts.get("gm") and facts.get("radius"):
            gm, rad, name, src = float(facts["gm"]), float(facts["radius"]), b, "athena two-publisher agreement"
        elif rec:
            gm, rad, name, src = rec["GM"], rec["radius"], rec["name"], data()["sources"]["bodies"]
        else:
            raise KeyError("no two-publisher body parameters for " + str(b))
        engine = "math (GM and radius from " + src + ")"
    a = rad + p["altitude_m"]
    T = 2 * math.pi * math.sqrt(a ** 3 / gm)
    v = math.sqrt(gm / a)
    return {"solver": "astronomy_ondevice", "engine": engine, "outcome": "orbit",
            "measurements": {"body": name, "orbit_radius_km": round(a / 1000, 3), "period_min": round(T / 60, 2),
                             "speed_km_s": round(v / 1000, 3), "escape_speed_km_s": round(math.sqrt(2 * gm / a) / 1000, 3),
                             "gravity_m_s2": round(gm / a ** 2, 3)},
            "constants_source": src, "equations": ["T = 2π sqrt(a^3/GM)", "v = sqrt(GM/a)", "v_esc = sqrt(2GM/a)", "g = GM/a^2"]}


def _solve_quantum(p: dict[str, Any]) -> dict[str, Any]:
    import numpy as np
    import scipy
    from scipy.linalg import expm
    X = np.array([[0, 1], [1, 0]], dtype=complex)
    Y = np.array([[0, -1j], [1j, 0]], dtype=complex)
    Z = np.array([[1, 0], [0, -1]], dtype=complex)
    psi0 = np.array([1, 0], dtype=complex) if p["state"] == 0 else np.array([0, 1], dtype=complex)
    if p["gate"] == "RABI":
        th = math.pi * p["theta_over_pi"]
        U = expm(-1j * th / 2 * X)
        how = f"U = expm(-i θ/2 σx), θ = {p['theta_over_pi']:g} π"
    else:
        G = {"X": X, "Y": Y, "Z": Z, "H": (X + Z) / math.sqrt(2)}[p["gate"]]
        U = 1j * expm(-1j * math.pi / 2 * G)  # exp(-i π/2 G) = -i G for a Pauli-like involution, so U = G
        how = "U = i expm(-i π/2 G) = G"
    psi = U @ psi0
    probs = [round(float(abs(a) ** 2), 6) for a in psi]
    return {"solver": "quantum_ondevice", "engine": "scipy " + scipy.__version__ + " linalg.expm", "outcome": "measure",
            "measurements": {"p0": probs[0], "p1": probs[1], "amplitudes": [[round(a.real, 6), round(a.imag, 6)] for a in psi]},
            "method": how + "; Born rule P(k) = |<k|psi>|^2"}


# ---------------------------------------------------------------- finish (WASM families)

def finish(problem: dict[str, Any], raw: dict[str, Any]) -> dict[str, Any]:
    s = problem["solver"]
    if s == "mujoco_wasm":
        sc = problem["scene"]
        ms = dict(raw["measurements"])
        job = mujoco_job(sc)
        if sc["action"] == "push":
            ms.update(push_force_N=round(job["force"], 3), push_rule="1.25 x min(mu_table m g, m g w/2 / h)",
                      push_duration_s=job["duration"], push_height_m=job["push_height_m"])
        run = {"solver": s, "engine": "mujoco " + str(raw.get("version") or "3.17.0") + " (WASM, on device)",
               "outcome": classify_rigid(sc, ms), "measurements": ms, "classifier": CLASSIFIER}
        chk = tip_check(sc)
        if chk:
            run["cross_check"] = [chk]
        return run
    if s == "rdkit_wasm":
        counts = formula_from_rdkit_json(raw["mol_json"])
        d = json.loads(raw["descriptors"]) if isinstance(raw["descriptors"], str) else raw["descriptors"]
        ms = {"formula": hill(counts), "exact_mw": round(float(d["exactmw"]), 4), "average_mw": round(float(d["amw"]), 3),
              "heavy_atoms": int(d["NumHeavyAtoms"]), "bonds": int(raw.get("num_bonds", 0)),
              "aromatic_rings": int(d.get("NumAromaticRings", 0)), "rings": int(d.get("NumRings", 0)),
              "table_formula_agrees": hill(counts) == hill(_parse_formula(
                  (data()["substances"].get(problem.get("substance")) or {}).get("formula") or problem.get("formula") or ""))}
        return {"solver": s, "engine": "rdkit " + str(raw.get("version")) + " (WASM, on device)", "outcome": "describe", "measurements": ms}
    if s == "circuits_wasm":
        res = raw["result"]
        cols = {str(c["name"]).lower(): c["values"] for c in res["data"]}
        ms: dict[str, Any] = {"points": res.get("numPoints"), "variables": res.get("variableNames")}
        if problem["topology"] == "rc":
            t, vo = cols["time"], cols["v(out)"]
            tau = problem["R"] * problem["C"]
            i_tau = min(range(len(t)), key=lambda i: abs(t[i] - tau))
            ms.update(v_out_end=round(float(vo[-1]), 4), t_end_s=float(t[-1]), tau_s=tau, v_out_at_tau=round(float(vo[i_tau]), 4))
        else:
            i = abs(float(cols["i(v1)"][0]))
            ms.update(source_current_a=round(i, 6), total_resistance_ohm=round(problem["V"] / i, 3) if i else None)
            if "v(out)" in cols:
                ms["v_out"] = round(float(cols["v(out)"][0]), 4)
        return {"solver": s, "engine": "ngspice via eecircuit-engine 1.9.0 (WASM, on device)", "outcome": "solve",
                "measurements": ms, "netlist": problem["netlist"]}
    return {"solver": s, "error": "not a WASM family"}


# ---------------------------------------------------------------- seal

def _subject_clause(p: dict[str, Any], run: dict[str, Any]) -> tuple[str, str, list[str]]:
    """(premise clause, spoken effect, extra fact sentences) for a run."""
    s, ms = p["solver"], run.get("measurements") or {}
    if s in ("mujoco_wasm", "sympy_pyodide"):
        return _rigid_clause(p["scene"], run["outcome"], ms) + ([],)
    if s == "chemistry_ondevice":
        names = p["reactant_names"]
        eq = ms["equation"]
        return (f"Reacting {' with '.join(names)} balances as {eq}.",
                f"The reaction balances as {eq}.", [])
    if s == "chemistry_kinetics":
        return (f"After {_g(p['t'])} seconds the reactant concentration falls to {_g(ms['concentration_left'])} moles per liter.",
                f"The concentration falls to {_g(ms['concentration_left'])} moles per liter after {_g(p['t'])} seconds.", [])
    if s == "rdkit_wasm":
        n = p["substance"]
        mw = ms["average_mw"]
        asked = str(p.get("property_text") or "").strip()
        if asked.lower().startswith("the "):
            asked_s = asked[0].upper() + asked[1:]
        else:
            asked_s = ""
        value = f"{mw:g} daltons" if p.get("property") in ("weight", "mass") else ms["formula"]
        if p.get("property") == "structure":
            value = f"{ms['heavy_atoms']} heavy atoms and {ms['aromatic_rings']} aromatic rings"
        main = f"{asked_s} is {value}." if asked_s else {
            "weight": f"The molecular weight of {n} is {mw:g} daltons.",
            "mass": f"The molecular mass of {n} is {mw:g} daltons.",
            "formula": f"The molecular formula of {n} is {ms['formula']}.",
            "structure": f"The molecular structure of {n} has {ms['heavy_atoms']} heavy atoms and {ms['aromatic_rings']} aromatic rings.",
        }[p["property"]]
        facts = [f"The molecular formula of {n} is {ms['formula']}.", f"The molecular weight of {n} is {mw:g} daltons.",
                 f"The molecular mass of {n} is {mw:g} daltons."]
        return main, main, [f for f in facts if f != main]
    if s == "biology_ondevice":
        if p["op"] == "transcribe":
            return (f"Transcribing the DNA {p['sequence']} gives the messenger RNA {ms['mrna']}.",
                    f"The RNA polymerase makes the messenger RNA {ms['mrna']}.", [])
        stop = " and then stops" if ms.get("stopped") else ""
        return (f"Translating the {p['kind']} {p['sequence']} gives the protein {ms['protein']}.",
                f"The ribosome makes the protein {ms['protein']}{stop}.", [])
    if s == "biology_kinetics":
        return (f"After {_g(p['t'])} seconds the enzyme leaves {_g(ms['substrate_left_mM'])} millimolar of substrate.",
                f"The enzyme leaves {_g(ms['substrate_left_mM'])} millimolar of substrate after {_g(p['t'])} seconds.", [])
    if s == "astronomy_ondevice":
        alt = p["altitude_m"] / 1000
        return (f"An orbit {_g(alt)} kilometers above {ms['body']} takes {ms['period_min']:g} minutes at {ms['speed_km_s']:g} kilometers per second.",
                f"The satellite circles {ms['body']} every {ms['period_min']:g} minutes at {ms['speed_km_s']:g} kilometers per second.", [])
    if s == "quantum_ondevice":
        p0, p1 = ms["p0"], ms["p1"]
        if abs(p0 - p1) < 1e-6:
            eff = "The qubit ends in an equal superposition, with probability 0.5 for 0 and 0.5 for 1."
        else:
            eff = f"The qubit ends with probability {p0:g} for 0 and {p1:g} for 1."
        gate = {"H": "the Hadamard gate", "X": "the Pauli X gate", "Y": "the Pauli Y gate", "Z": "the Pauli Z gate"}.get(
            p["gate"], f"a {_g(p.get('theta_over_pi', 1))} pi Rabi pulse")
        return f"Applying {gate} to the state {p['state']} gives probability {p0:g} for 0 and {p1:g} for 1.", eff, []
    if s == "circuits_wasm":
        if p["topology"] == "rc":
            return (f"Charging the {_g(p['C'] * 1e6)} microfarad capacitor through {_g(p['R'])} ohms for {_g(p['t'] * 1000)} milliseconds brings it to {_g(ms['v_out_end'])} volts.",
                    f"The capacitor charges to {_g(ms['v_out_end'])} volts.", [])
        if "v_out" in ms and p["topology"] == "divider":
            return (f"Putting {_g(p['V'])} volts across the divider gives {_g(ms['v_out'])} volts at the output.",
                    f"The output is {_g(ms['v_out'])} volts and the current is {_g(ms['source_current_a'] * 1000)} milliamps.", [])
        return (f"Putting {_g(p['V'])} volts across the resistors draws {_g(ms['source_current_a'] * 1000)} milliamps.",
                f"The current is {_g(ms['source_current_a'] * 1000)} milliamps through {_g(ms['total_resistance_ohm'])} ohms in total.", [])
    if s == "pyscf_abinitio":
        e = ms["total_energy_hartree"]
        return (f"A {ms['method']} calculation on {ms['molecule']} gives a total energy of {e:g} hartree.",
                f"The total energy of {ms['molecule']} comes out at {e:g} hartree.", [])
    if s == "openfoam_cfd":
        it = ms.get("iterations")
        return (f"The OpenFOAM run at {_g(ms['inlet_speed_m_s'])} meters per second took {it} iterations.",
                f"The flow solution settles after {it} iterations.", [])
    raise ValueError("no clause for " + s)


VERB_3SG = {"topple": "topples", "slide": "slides", "stay": "stays", "fall": "falls", "roll": "rolls", "land": "lands"}
GERUND = {"push": "pushing", "drop": "dropping", "throw": "throwing", "release": "releasing", "shove": "shoving",
          "nudge": "nudging", "tap": "tapping", "poke": "poking", "hit": "hitting", "kick": "kicking", "bump": "bumping",
          "flick": "flicking", "toss": "tossing", "launch": "launching", "let": "releasing"}


def _rigid_clause(scene: dict[str, Any], outcome: str, ms: dict[str, Any]) -> tuple[str, str]:
    body = scene.get("body") or {}
    if body.get("average"):
        # The grammar round-trips "The average <kind> of <mass> kilograms <verb>." so the outward compile can speak it.
        phrase = str(body.get("phrase") or body.get("noun") or "object")
        mass = float(body.get("mass") or 0)
        verb = VERB_3SG.get(outcome, outcome + "s")
        sent = f"The average {phrase} of {mass:g} kilograms {verb}."
        return sent, sent
    # A passive or reordered intervention is spoken from the kāraka slots (patient, point, surface), not by
    # gluing the raw clause onto a gerund. The active "you …" form keeps the historical sentence so recorded
    # receipts re-seal.
    raw = str(scene.get("intervention_raw") or "")
    words = raw.split()
    verb = str(scene.get("verb") or "")
    active = bool(words) and (words[0].lower() in ("you", "i", "we", "they", "someone", "one") or words[0].lower().startswith(verb[:4] if len(verb) >= 4 else verb))
    if not active and scene.get("body"):
        noun = scene["body"]["noun"]
        subject = "The " + noun
        point = (scene.get("point") or {}).get("name")
        surface = (scene.get("surface") or {}).get("name")
        ger = GERUND.get(verb, (verb or "moving") + "ing")
        where = ""
        if point and point not in ("center", "centre"):
            where += " near the " + point
        if surface and surface != "table":
            where += " on " + surface
        if outcome == "land":
            return (f"{ger.capitalize()} the {noun} makes it land.",
                    f"{subject} lands {ms['range_m']:g} meters away after {ms['flight_time_s']:g} seconds.")
        return f"{ger.capitalize()} the {noun}{where} makes it {outcome}.", f"{subject} {VERB_3SG.get(outcome, outcome + 's')}."
    words = scene["intervention_raw"].split()
    if words and words[0].lower() in ("you", "i", "we", "they", "someone", "one"):
        words = words[1:]
    rest = " ".join(words[1:])
    if scene["verb"] == "release" and rest.lower().startswith("go of "):
        rest = rest[6:]
    if rest.lower().startswith(("a ", "an ")):
        rest = "the " + rest.split(" ", 1)[1]
    ger = GERUND.get(scene["verb"], scene["verb"] + "ing")
    adj = " ".join(scene["body"].get("adjectives") or [])
    subject = "The " + (adj + " " if adj else "") + scene["body"]["noun"]
    if outcome == "land":
        return (f"{ger.capitalize()} {rest} makes it land.",
                f"{subject} lands {ms['range_m']:g} meters away after {ms['flight_time_s']:g} seconds.")
    return f"{ger.capitalize()} {rest} makes it {outcome}.", f"{subject} {VERB_3SG.get(outcome, outcome + 's')}."


def _canon(x: Any) -> Any:
    """JSON-stable form: an integral float is written as an int (and -0.0 as 0), as JavaScript does, so the sha256
    of a receipt is the same after it crosses the worker boundary and is re-checked anywhere."""
    if isinstance(x, float):
        return int(x) if x.is_integer() else x
    if isinstance(x, dict):
        return {str(k): _canon(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [_canon(v) for v in x]
    return x


def receipt_sha256(body: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(_canon(body), sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()


def seal(problem: dict[str, Any], run: dict[str, Any], where: str = "on_device") -> dict[str, Any]:
    base = {"schema": SCHEMA, "question": problem.get("question"), "calls_llm": False, "router": VERSION, "where": where}
    if not run or run.get("error") or not run.get("outcome"):
        return {**base, "ok": False, "status": "hold", "problem": problem, "run": run, "reason": (run or {}).get("error") or "solver_failed"}
    clause, effect, extra = _subject_clause(problem, run)
    body = {"problem": {k: v for k, v in problem.items() if k != "question"}, "run": run, "outcome": run["outcome"],
            "primary_solver": problem["solver"], "clause": clause, "effect_text": effect}
    body = _canon(body)
    sha = receipt_sha256(body)
    rid = "sim-" + sha[:16]
    sim = {"receipt_id": rid, "sha256": sha, "intervention_key": problem.get("intervention_key"), "effect_text": effect,
           "outcome": run["outcome"], "solver": problem["solver"], "engine": run.get("engine"), "family": problem["family"],
           "where": where, "measurements": run.get("measurements"), "cross_check": run.get("cross_check") or []}
    rows = [{"id": rid, "text": clause, "source": "sim_receipt", "trust": "solver_receipt", "sim": sim}]
    for i, t in enumerate(extra):
        rows.append({"id": f"{rid}-{i + 1}", "text": t, "source": "sim_receipt", "trust": "solver_receipt",
                     "sim": {**sim, "intervention_key": None, "fact_of": rid}})
    return {**base, "ok": True, "status": "simulated", **body, "receipt_id": rid, "sha256": sha, "rows": rows}


def hold_receipt(problem: dict[str, Any], reason: str, where: str = "on_device") -> dict[str, Any]:
    s = SOLVERS.get(problem.get("solver") or "", {})
    return {"schema": SCHEMA, "ok": False, "status": "hold", "question": problem.get("question"), "calls_llm": False,
            "router": VERSION, "where": where, "reason": reason, "problem": problem, "needs": s.get("needs"),
            "home_pc_required": problem.get("runtime") == "home_pc"}
