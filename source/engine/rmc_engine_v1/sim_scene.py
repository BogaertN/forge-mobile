"""4.9.244 (plan 229 step 12b): compile a what-happens-if question into a physical scene specification.

The question's intervention (cause_effect.intervention_of) is read as a kāraka frame: kriyā = the action (push, drop,
throw), karma = the body (its noun + shape adjectives), adhikaraṇa = the surface it stands on, and the point the
force is applied at (top / bottom / middle / a stated height). Dimensions, mass and friction come from the question
when stated, else from physical_defaults.json (sourced, labelled default in the scene). Nothing here predicts an
outcome: the scene goes to the Simulation Router, whose solver measures it. A scene that misses what a solver needs
(no body, no application point for a push, an unknown noun) is returned as a hold with the missing slot named.
No model. Pure Python (runs in Pyodide and on the backend runner).
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

SCHEMA = "FORGE-SIM-SCENE/v1"
_DEFAULTS: dict[str, Any] | None = None

_UNITS = {"m": 1.0, "meter": 1.0, "meters": 1.0, "metre": 1.0, "metres": 1.0, "cm": 0.01, "centimeter": 0.01,
          "centimeters": 0.01, "centimetre": 0.01, "centimetres": 0.01, "mm": 0.001, "millimeters": 0.001,
          "ft": 0.3048, "foot": 0.3048, "feet": 0.3048, "in": 0.0254, "inch": 0.0254, "inches": 0.0254}
_NUM = r"(\d+(?:\.\d+)?)"
_UNIT = r"(m|meters?|metres?|cm|centimet(?:er|re)s?|mm|millimeters?|ft|foot|feet|inch(?:es)?)"
_PUSH = {"push", "shove", "nudge", "tap", "poke", "flick", "hit", "kick", "bump"}
_DROP = {"drop", "release", "let"}
_THROW = {"throw", "launch", "toss", "fire", "kick"}


def defaults() -> dict[str, Any]:
    global _DEFAULTS
    if _DEFAULTS is None:
        _DEFAULTS = json.loads((Path(__file__).with_name("physical_defaults.json")).read_text(encoding="utf-8"))
    return _DEFAULTS


def _stem(w: str) -> str:
    w = w.lower()
    for suf in ("ing", "es", "ed", "s"):
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            base = w[: -len(suf)]
            if suf == "ing" and len(base) >= 2 and base[-1] == base[-2]:
                base = base[:-1]
            return base
    return w


def _length(num: str, unit: str) -> float:
    u = unit.lower()
    return float(num) * _UNITS.get(u, _UNITS.get(u.rstrip("s"), 1.0))


def _hold(reason: str, missing: str, question: str, **extra: Any) -> dict[str, Any]:
    return {"schema": SCHEMA, "ok": False, "status": "hold", "reason": reason, "missing": missing,
            "question": question, "calls_llm": False, **extra}


def _props_body(noun: str, props: dict[str, Any], D: dict[str, Any]) -> tuple[dict[str, Any] | None, str | None]:
    """Reference row or Athena/remembered properties. Neither invents a number."""
    if noun in D["bodies"]:
        return dict(D["bodies"][noun]), "physical_defaults"
    shape = props.get("shape")
    if shape not in ("box", "cylinder", "sphere"):
        if props.get("radius") and not props.get("height"):
            shape = "sphere"
        elif props.get("height") and props.get("width"):
            shape = "box"
        else:
            return None, "shape"
    body: dict[str, Any] = {"shape": shape}
    if shape == "sphere":
        if props.get("radius") is None:
            return None, "radius"
        body["radius"] = float(props["radius"])
    else:
        if props.get("height") is None:
            return None, "height"
        body["height"] = float(props["height"])
        if shape == "box":
            if props.get("width") is None:
                return None, "width"
            body["width"] = float(props["width"])
        else:
            body["radius"] = float(props.get("radius") or (float(props["width"]) / 2.0 if props.get("width") else 0))
            if not body["radius"]:
                return None, "radius"
    if props.get("mass") is None:
        return None, "mass"
    body["mass"] = float(props["mass"])
    return body, None


def scene_from_reading(reading: dict[str, Any]) -> dict[str, Any]:
    """Build a physical scene from a kāraka reading (sim_karaka.read), not from a question regex."""
    q = reading.get("question") or ""
    kind = reading.get("kind")
    if reading.get("hold"):
        return _hold(reading.get("reason") or "scene_hold", reading.get("missing") or "scene", q)
    if kind not in ("push", "drop", "throw"):
        return _hold("not_what_happens_if", "intervention", q)
    verb = str(reading.get("verb") or kind)
    body_noun = str(reading.get("patient") or "")
    adjs = [a for a in (reading.get("adjectives") or []) if a in defaults()["adjectives"]]
    D = defaults()
    props = reading.get("props") if isinstance(reading.get("props"), dict) else {}
    base, missing = _props_body(body_noun, props, D)
    if base is None:
        if body_noun in ("it", "them", "that", "this"):
            return _hold("unresolved_pronoun", "karma", q)
        return _hold("unknown_body" if missing in (None, "shape") and body_noun not in D["bodies"] and not props else "property_missing",
                     missing or "karma", q, body=body_noun, looked_up=sorted(props))
    defaulted = [] if props else ["shape", "dimensions", "mass"]
    if props:
        defaulted = [k for k in ("shape", "dimensions", "mass") if k == "mass" and "mass" not in props or k == "shape" and "shape" not in props]
    for a in adjs:
        for k, f in D["adjectives"][a].items():
            if k == "width" and base["shape"] == "cylinder":
                base["radius"] = base["radius"] * f
            elif k == "width" and base["shape"] == "sphere":
                base["radius"] = base["radius"] * f
            elif k in base:
                base[k] = base[k] * f
    part = reading.get("part") if isinstance(reading.get("part"), dict) else {}
    # stated measures on the frame override a default, never a silent guess
    from rmc_engine_v1.sim_karaka import measures as frame_measures
    for m in frame_measures(part):
        unit, num = m.get("unit") or "", m.get("num")
        if num is None:
            continue
        if unit in _UNITS and m.get("head") in ("tall", "high") or (isinstance(m.get("np"), dict) and any(x in (m["np"].get("adjs") or []) for x in ("tall", "high"))):
            if base["shape"] != "sphere":
                base["height"] = _length(str(num), unit if unit in _UNITS else "m")
                if "dimensions" in defaulted:
                    defaulted.remove("dimensions")
    surface = reading.get("surface")
    mu, mu_src = None, "default"
    if surface:
        hit = None
        for key in sorted(D["surfaces"], key=len, reverse=True):
            if surface == key or surface.endswith(" " + key):
                hit = key
                break
        if hit is None:
            return _hold("unknown_surface", "adhikarana", q, surface=surface)
        surface, mu, mu_src = hit, D["surfaces"][hit], "physical_defaults.surfaces"
    else:
        surface = D["default_surface"]
        mu = D["surfaces"][surface]
    if props.get("mu") is not None:
        mu, mu_src = float(props["mu"]), "athena_or_memory"
    body = {"noun": body_noun, "adjectives": adjs, **base}
    from rmc_engine_v1.sim_karaka import karaka_key
    raw = str((part.get("text") or q))
    scene: dict[str, Any] = {
        "schema": SCHEMA, "ok": True, "status": "compiled", "question": q, "intervention_raw": raw,
        "intervention_key": karaka_key(reading), "action": kind, "verb": verb, "body": body,
        "surface": {"name": surface, "mu": mu, "mu_source": mu_src}, "gravity": D["gravity"],
        "defaulted": defaulted, "sources": D["sources"], "calls_llm": False,
        "karaka": {"kriya": verb, "karma": body_noun, "adhikarana": surface, "voice": part.get("voice") or "active"},
        "via": "karaka_frame",
    }
    if kind == "push":
        if base["shape"] == "sphere":
            scene["point"] = {"name": "center", "fraction": 0.5, "source": "sphere"}
        else:
            point_name = reading.get("point")
            if point_name not in D["points"]:
                return _hold("application_point_missing", "point", q, body=body)
            scene["point"] = {"name": point_name, "fraction": D["points"][point_name], "source": "physical_defaults.points"}
        scene["push"] = dict(D["push"])
        scene["push_reference_mu"] = D["surfaces"][D["default_surface"]]
    elif kind == "drop":
        from rmc_engine_v1.sim_karaka import _qty, _UNIT_M
        h = _qty(part, _UNIT_M)
        scene["drop_height"] = h if h is not None else 1.0
        scene["drop_height_source"] = "stated" if h is not None else "default_1m"
    elif kind == "throw":
        ang = spd = None
        for m in frame_measures(part):
            if m.get("unit") in ("degree",):
                ang = m["num"]
            if m.get("unit") in ("m s",) or (isinstance(m.get("unit"), str) and m["unit"].startswith("m") and "s" in m["unit"]):
                spd = m["num"]
        if ang is None or spd is None:
            return _hold("launch_angle_or_speed_missing", "angle" if ang is None else "speed", q, body=body)
        scene["launch"] = {"angle_deg": float(ang), "speed": float(spd)}
    return scene


def compile_scene(question: str, frame: dict[str, Any] | None = None, facts: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    from rmc_engine_v1.sim_karaka import read
    q = re.sub(r"\s+", " ", str(question or "").strip())
    reading = read(q, frame, facts)
    if reading.get("hold") and reading.get("kind") not in ("push", "drop", "throw"):
        if reading.get("reason") == "not_a_simulation_question":
            return _hold("not_what_happens_if", "intervention", q)
        return _hold(reading.get("reason") or "scene_hold", reading.get("missing") or "scene", q)
    return scene_from_reading(reading)


def intervention_key(raw: str) -> str:
    """Order-free content key of an intervention phrase ("you push a bottle near the top" == "pushing the bottle near the top")."""
    stop = {"you", "i", "we", "they", "the", "a", "an", "it", "one", "someone"}
    return " ".join(sorted(_stem(w) for w in re.findall(r"[a-z0-9.]+", str(raw or "").lower()) if w not in stop))
