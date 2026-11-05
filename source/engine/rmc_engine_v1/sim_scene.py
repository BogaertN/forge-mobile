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


def compile_scene(question: str) -> dict[str, Any]:
    from rmc_engine_v1.cause_effect import intervention_of

    q = re.sub(r"\s+", " ", str(question or "").strip())
    inter = intervention_of(q)
    if not inter:
        return _hold("not_what_happens_if", "intervention", q)
    raw = str(inter.get("raw") or "").strip().rstrip("?. ")
    low = raw.lower()
    words = re.findall(r"[a-z]+", low)
    if words and words[0] in ("you", "i", "we", "they", "someone", "one"):
        words = words[1:]
    if not words:
        return _hold("no_action", "kriya", q)
    verb = _stem(words[0])
    if verb == "let" and "go" in words[:3]:
        verb = "release"
    kind = "push" if verb in _PUSH else "drop" if verb in _DROP else "throw" if verb in _THROW else None
    if verb == "kick" and re.search(r"\bat\s+\d", low):
        kind = "throw"
    if kind is None:
        return _hold("action_not_simulated", "kriya", q, action=verb)
    D = defaults()
    # karma: the body noun (first known body noun) and the adjectives before it
    body_noun, adjs = None, []
    for i, w in enumerate(words):
        n = w[:-1] if w.endswith("s") and w[:-1] in D["bodies"] else w
        if n in D["bodies"]:
            body_noun = n
            j = i - 1
            while j >= 0 and words[j] in D["adjectives"]:
                adjs.insert(0, words[j])
                j -= 1
            break
    if body_noun is None:
        if re.search(r"\b(it|them|that|this)\b", low):
            return _hold("unresolved_pronoun", "karma", q)
        return _hold("unknown_body", "karma", q)
    base = dict(D["bodies"][body_noun])
    defaulted = ["shape", "dimensions", "mass"]
    for a in adjs:
        for k, f in D["adjectives"][a].items():
            if k == "width" and base["shape"] == "cylinder":
                base["radius"] = base["radius"] * f
            elif k == "width" and base["shape"] == "sphere":
                base["radius"] = base["radius"] * f
            elif k in base:
                base[k] = base[k] * f
    # stated dimensions override defaults
    m = re.search(_NUM + r"\s*" + _UNIT + r"\s+(?:tall|high)\b", low)
    if m and base["shape"] != "sphere":
        base["height"] = _length(m.group(1), m.group(2)); defaulted.remove("dimensions") if "dimensions" in defaulted else None
    m = re.search(_NUM + r"\s*" + _UNIT + r"\s+(?:wide|across)\b", low)
    if m:
        w_ = _length(m.group(1), m.group(2))
        if base["shape"] == "box":
            base["width"] = w_
        else:
            base["radius"] = w_ / 2.0
    m = re.search(_NUM + r"\s*(kg|kilograms?|g|grams?)\b", low)
    if m:
        base["mass"] = float(m.group(1)) * (0.001 if m.group(2).startswith("g") else 1.0)
        defaulted.remove("mass")
    # adhikarana: the surface
    surface, mu, mu_src = None, None, "default"
    m = re.search(r"\b(?:on|across|along)\s+((?:an?|the)\s+)?([a-z ]+?)(?=\s+(?:near|at|from|with|in)\b|$)", low)
    if m:
        cand = m.group(2).strip()
        for key in sorted(D["surfaces"], key=len, reverse=True):
            if cand == key or cand.endswith(" " + key) or cand.startswith(key):
                surface, mu, mu_src = key, D["surfaces"][key], "physical_defaults.surfaces"
                break
        if surface is None and cand not in ("it", "the top", "the bottom"):
            return _hold("unknown_surface", "adhikarana", q, surface=cand)
    m = re.search(r"(?:friction|μ|mu)\s*(?:of|=|is)?\s*(\d+(?:\.\d+)?)", low)
    if m:
        mu, mu_src = float(m.group(1)), "stated"
    if surface is None:
        surface = D["default_surface"]
        mu = mu if mu is not None else D["surfaces"][surface]
    body = {"noun": body_noun, "adjectives": adjs, **base}
    scene: dict[str, Any] = {
        "schema": SCHEMA, "ok": True, "status": "compiled", "question": q, "intervention_raw": raw,
        "intervention_key": intervention_key(raw), "action": kind, "verb": verb, "body": body,
        "surface": {"name": surface, "mu": mu, "mu_source": mu_src}, "gravity": D["gravity"],
        "defaulted": defaulted, "sources": D["sources"], "calls_llm": False,
        "karaka": {"kriya": verb, "karma": body_noun, "adhikarana": surface},
    }
    if kind == "push":
        if base["shape"] == "sphere":
            scene["point"] = {"name": "center", "fraction": 0.5, "source": "sphere"}
        else:
            point = None
            m = re.search(_NUM + r"\s*" + _UNIT + r"\s+(?:from|above)\s+the\s+(?:bottom|base|ground)", low)
            if m:
                h = _length(m.group(1), m.group(2))
                point = {"name": "stated_height", "fraction": max(0.0, min(1.0, h / base["height"])), "source": "stated"}
            else:
                m = re.search(r"\b(?:near|at|on|by|towards?|in)\s+(?:the\s+)?(top|upper|middle|center|centre|bottom|base|lower)\b", low)
                if m:
                    point = {"name": m.group(1), "fraction": D["points"][m.group(1)], "source": "physical_defaults.points"}
            if point is None:
                return _hold("application_point_missing", "point", q, body=body)
            scene["point"] = point
        scene["push"] = dict(D["push"])
        scene["push_reference_mu"] = D["surfaces"][D["default_surface"]]
    elif kind == "drop":
        m = re.search(r"\bfrom\s+(?:a\s+height\s+of\s+)?" + _NUM + r"\s*" + _UNIT, low)
        scene["drop_height"] = _length(m.group(1), m.group(2)) if m else 1.0
        scene["drop_height_source"] = "stated" if m else "default_1m"
    elif kind == "throw":
        ma = re.search(_NUM + r"\s*(?:degrees?|deg|°)", low)
        mv = re.search(_NUM + r"\s*(?:m/s|meters? per second|metres? per second)", low)
        if not ma or not mv:
            return _hold("launch_angle_or_speed_missing", "angle" if not ma else "speed", q, body=body)
        scene["launch"] = {"angle_deg": float(ma.group(1)), "speed": float(mv.group(1))}
    return scene


def intervention_key(raw: str) -> str:
    """Order-free content key of an intervention phrase ("you push a bottle near the top" == "pushing the bottle near the top")."""
    stop = {"you", "i", "we", "they", "the", "a", "an", "it", "one", "someone"}
    return " ".join(sorted(_stem(w) for w in re.findall(r"[a-z0-9.]+", str(raw or "").lower()) if w not in stop))
