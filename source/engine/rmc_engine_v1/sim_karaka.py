"""4.9.246: simulation dispatch reads the phone's kāraka frame.

The question is compiled by src/qframe.js (the same grammar as every other Ask). This module does not match
question templates. It reads kriyā, kartṛ, karma, voice, and the adjuncts the parser attached (adhikaraṇa,
karaṇa, apādāna, sampradāna) plus quantities the noun phrase already carries (num + unit head). Properties
the frame does not state come from remembered clauses or from Athena's two-publisher rows. A gap stays a hold.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]  # source/

_PUSH = {"push", "shove", "nudge", "tap", "poke", "flick", "hit", "bump"}
_DROP = {"drop", "release"}
_THROW = {"throw", "launch", "toss", "fire"}
_IMMERSE = {"put", "place", "immerse", "submerge", "drop"}
_HEAT = {"heat", "warm", "cool", "chill"}
_SLOPE = {"ramp", "slope", "incline", "hill", "plane"}
_REACT = {"burn", "combust", "react", "ignite", "mix"}
_PROP = {"weight", "mass", "formula", "structure"}
_SURF_PREP = {"on", "across", "along", "onto"}
_POINT = {"top", "upper", "middle", "center", "centre", "bottom", "base", "lower"}

_UNIT_M = {"m": 1.0, "meter": 1.0, "metre": 1.0, "km": 1000.0, "kilometer": 1000.0, "kilometre": 1000.0,
           "cm": 0.01, "centimeter": 0.01, "mm": 0.001}
_TIME_S = {"s": 1.0, "second": 1.0, "ms": 0.001, "millisecond": 0.001, "min": 60.0, "minute": 60.0,
           "h": 3600.0, "hour": 3600.0}


def _head(np: Any) -> str:
    if not isinstance(np, dict):
        return ""
    return str(np.get("head") or "").strip().lower()


def _num(np: Any) -> float | None:
    if not isinstance(np, dict) or np.get("num") in (None, ""):
        return None
    try:
        return float(np["num"])
    except (TypeError, ValueError):
        return None


def _adjs(part: dict[str, Any]) -> list[dict[str, Any]]:
    return [a for a in (part.get("adj") or []) if isinstance(a, dict)]


def _heads_of(part: dict[str, Any]) -> list[str]:
    out = []
    for role in ("kartr", "karma", "pred"):
        np = part.get(role)
        if isinstance(np, dict):
            if _head(np):
                out.append(_head(np))
            of = np.get("of")
            if isinstance(of, dict) and _head(of):
                out.append(_head(of))
    for a in _adjs(part):
        h = _head(a.get("np"))
        if h:
            out.append(h)
    return out


def cond_of(frame: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(frame, dict):
        return None
    cond = frame.get("cond")
    if frame.get("conditional") and isinstance(cond, dict):
        return cond
    return None


def patient(part: dict[str, Any]) -> dict[str, Any] | None:
    """Active: karma is the patient. Passive: the surface subject (kartṛ in the phone frame) is the patient."""
    if str(part.get("voice") or "") == "passive":
        return part.get("kartr") if isinstance(part.get("kartr"), dict) else None
    if isinstance(part.get("karma"), dict) and _head(part.get("karma")) not in ("", "something"):
        return part["karma"]
    kartr = part.get("kartr") if isinstance(part.get("kartr"), dict) else None
    if kartr and not kartr.get("kernel") and _head(kartr) not in ("you", "it", ""):
        return kartr
    return part.get("karma") if isinstance(part.get("karma"), dict) else None


def measures(part: dict[str, Any]) -> list[dict[str, Any]]:
    """Every adjunct or role noun phrase that carries a number and a unit head."""
    found = []
    blobs = [part.get("kartr"), part.get("karma")] + [a.get("np") for a in _adjs(part)]
    for np in blobs:
        if not isinstance(np, dict):
            continue
        n = _num(np)
        if n is None:
            of = np.get("of")
            if isinstance(of, dict):
                n = _num(of)
                if n is not None:
                    found.append({"num": n, "unit": _head(of) or _head(np), "head": _head(np), "prep": None, "np": np})
            continue
        found.append({"num": n, "unit": _head(np), "head": _head(np), "prep": None, "np": np})
    for a in _adjs(part):
        np = a.get("np") if isinstance(a.get("np"), dict) else None
        if not np:
            continue
        for row in found:
            if row["np"] is np:
                row["prep"] = a.get("prep")
                row["role"] = a.get("role")
    return found


_MASS_SI = {"kg": 1.0, "kilogram": 1.0, "kilograms": 1.0, "g": 0.001, "gram": 0.001, "grams": 0.001,
            "pound": 0.45359237, "pounds": 0.45359237, "lb": 0.45359237, "lbs": 0.45359237}
_LEN_SI = {"m": 1.0, "meter": 1.0, "meters": 1.0, "metre": 1.0, "metres": 1.0, "cm": 0.01, "centimeter": 0.01,
           "centimeters": 0.01, "mm": 0.001, "millimeter": 0.001, "millimeters": 0.001, "foot": 0.3048, "feet": 0.3048,
           "inch": 0.0254, "inches": 0.0254}
_DIM_ROLE = {"tall": "height", "high": "height", "wide": "width", "deep": "depth", "long": "depth", "thick": "depth",
             "mass": "mass"}


def _phrase_of(np: dict[str, Any] | None) -> str:
    text = str((np or {}).get("text") or _head(np))
    return re.sub(r"^(?:a|an|the)\s+", "", text, count=1, flags=re.I).strip()


def stated_props(part: dict[str, Any]) -> dict[str, Any]:
    """Exact quantities the question itself stated. Units convert to metres and kilograms. No fill-in."""
    out: dict[str, Any] = {}
    for row in part.get("stated") or []:
        if not isinstance(row, dict):
            continue
        unit = str(row.get("unit") or "").lower()
        dim = str(row.get("dim") or "").lower()
        try:
            num = float(row.get("num"))
        except (TypeError, ValueError):
            continue
        if unit in _MASS_SI:
            out["mass"] = num * _MASS_SI[unit]
        elif dim in _DIM_ROLE and unit in _LEN_SI:
            out[_DIM_ROLE[dim]] = num * _LEN_SI[unit]
    for m in measures(part):
        unit = str(m.get("unit") or "").lower()
        if unit in _MASS_SI and "mass" not in out and m.get("num") is not None:
            out["mass"] = float(m["num"]) * _MASS_SI[unit]
    return out


def memory_facts(rows: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    """Remembered copulas ("a crate is 35 kilograms", "a crate is 1.6 meters tall") as property rows.
    The user's own statement, not a publisher. """
    found: list[dict[str, Any]] = []
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        cl = row.get("clause") if isinstance(row.get("clause"), dict) else row
        if str(cl.get("kriya") or "") != "be":
            continue
        head = _head(cl.get("kartr"))
        if not head:
            continue
        pred = cl.get("pred") if isinstance(cl.get("pred"), dict) else {}
        stated = None
        if pred.get("type") == "np" and pred.get("num") is not None:
            stated = [{"num": pred.get("num"), "unit": _head(pred), "dim": "mass"}]
        elif pred.get("text"):
            m = re.search(r"(\d+(?:\.\d+)?)\s+([a-z]+)\s+(tall|high|wide|deep|long|thick)", str(pred.get("text")), re.I)
            if m:
                stated = [{"num": m.group(1), "unit": m.group(2).lower(), "dim": m.group(3).lower()}]
        if not stated:
            continue
        props = stated_props({"stated": stated})
        for prop, val in props.items():
            found.append({"schema": "forge.sim_property/v1", "head": head, "property": prop, "value": val,
                          "unit": "kg" if prop == "mass" else "m", "source": "remembered", "calls_llm": False,
                          "supabase_write": False})
    return found


def _qty(part: dict[str, Any], units: dict[str, float]) -> float | None:
    for m in measures(part):
        unit = m["unit"].split()[0] if m["unit"] else ""
        if unit in units:
            return m["num"] * units[unit]
        if m["unit"] in units:
            return m["num"] * units[m["unit"]]
    return None


def _surface(part: dict[str, Any]) -> str | None:
    for a in _adjs(part):
        if a.get("prep") in _SURF_PREP:
            h = _head(a.get("np"))
            if h and h not in _POINT and h not in ("top", "it") and h not in _SLOPE:
                return h
    return None


def _fluid(part: dict[str, Any]) -> str | None:
    for a in _adjs(part):
        if a.get("prep") == "in":
            h = _head(a.get("np"))
            if h and h not in _POINT:
                return h
    return None


def _slope_deg(part: dict[str, Any]) -> float | None:
    for row in part.get("stated") or []:
        if str(row.get("dim") or "").lower() == "slope":
            try:
                return float(row.get("num"))
            except (TypeError, ValueError):
                continue
    return None


def _point(part: dict[str, Any]) -> str | None:
    for a in _adjs(part):
        h = _head(a.get("np"))
        if h in _POINT:
            return h
    return None


def _token_pairs(part: dict[str, Any]) -> list[tuple[float, str]]:
    toks = part.get("tokens") or []
    out = []
    for i, t in enumerate(toks):
        w = str(t.get("w") or "")
        if re.fullmatch(r"\d+(?:\.\d+)?", w):
            nxt = str((toks[i + 1].get("w") if i + 1 < len(toks) else "") or "").lower()
            out.append((float(w), nxt))
    return out


def _token_state(part: dict[str, Any]) -> int:
    toks = part.get("tokens") or []
    for i, t in enumerate(toks):
        if str(t.get("w") or "") == "state" and i + 1 < len(toks) and re.fullmatch(r"\d+", str(toks[i + 1].get("w") or "")):
            return int(toks[i + 1]["w"])
    return 0


def _token_theta(part: dict[str, Any]) -> float:
    words = [str(t.get("w") or "") for t in (part.get("tokens") or [])]
    if "/" in words:
        i = words.index("/")
        if i + 1 < len(words) and re.fullmatch(r"\d+", words[i + 1]):
            return 1.0 / float(words[i + 1])
    return 1.0


def karaka_key(reading: dict[str, Any]) -> str:
    """Order-free key of the kāraka reading, so an active and a passive paraphrase of one scene match."""
    bits = [str(reading.get("verb") or reading.get("kind") or ""), str(reading.get("patient") or ""),
            str(reading.get("point") or ""), str(reading.get("surface") or "")]
    part = reading.get("part") if isinstance(reading.get("part"), dict) else {}
    for m in measures(part):
        if m.get("num") is not None:
            bits.append(f"{m['num']:g}{m.get('unit') or ''}")
    stop = {"", "none", "you", "it"}
    return " ".join(sorted(b.lower() for b in bits if b and b.lower() not in stop))


def compile_frame(question: str) -> dict[str, Any] | None:
    """Ask the phone's own grammar (src/qframe.js). Not used inside Pyodide; the phone passes the frame it compiled."""
    if sys.platform == "emscripten" or not shutil.which("node"):
        return None
    script = r"""
const ROOT = process.cwd();
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const K = require(ROOT + '/src/kernel.js');
const FK = require(ROOT + '/src/forge.js');
const Q = require(ROOT + '/src/qframe.js');
const f = FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-06T00:00:00Z' });
let raw = ''; process.stdin.on('data', c => raw += c); process.stdin.on('end', () => {
  const qs = JSON.parse(raw);
  process.stdout.write(JSON.stringify(qs.map(q => Q.compile(q, f))));
});
"""
    try:
        r = subprocess.run(["node", "-e", script], input=json.dumps([question]), text=True, capture_output=True,
                           cwd=str(ROOT), timeout=30)
    except (OSError, subprocess.TimeoutExpired):
        return None
    if r.returncode != 0 or not r.stdout.strip():
        return None
    try:
        frames = json.loads(r.stdout)
    except json.JSONDecodeError:
        return None
    return frames[0] if frames else None


_GEOM = {"height", "width", "depth", "radius", "mass", "shape"}
_BLOCKED_HOST = ("wikipedia.org", "wikidata.org", "wikimedia.org")


def _fact_hosts(fact: dict[str, Any]) -> list[str]:
    hosts: list[str] = []
    for raw in list(fact.get("hosts") or []) + [p.get("host") for p in (fact.get("publishers") or []) if isinstance(p, dict)]:
        h = str(raw or "").lower()
        if not h or any(h == b or h.endswith("." + b) for b in _BLOCKED_HOST):
            continue
        if h not in hosts:
            hosts.append(h)
    return hosts


def _facts_for(head: str, facts: list[dict[str, Any]] | None) -> dict[str, Any]:
    out: dict[str, Any] = {}
    provenance: dict[str, str] = {}
    h = head.lower()
    phrase = ""
    for f in facts or []:
        if not isinstance(f, dict):
            continue
        if str(f.get("head") or "").lower() != h and str(f.get("phrase") or "").lower() != h:
            continue
        prop = str(f.get("property") or "")
        if not prop:
            continue
        if f.get("source") == "remembered":
            out[prop] = f.get("value")
            provenance[prop] = "stated"
            continue
        if prop in _GEOM:
            if len(_fact_hosts(f)) < 2:
                continue
            provenance[prop] = "two_publishers"
        out[prop] = f.get("value")
        if f.get("average"):
            out["average"] = True
            phrase = str(f.get("phrase") or phrase)
    if phrase:
        out["phrase"] = phrase
    if provenance:
        out["_provenance"] = provenance
    return out


def read(question: str, frame: dict[str, Any] | None = None, facts: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """A solver reading. No English template. `hold` is set when a slot the solver needs is absent."""
    q = " ".join(str(question or "").split())
    fr = frame if isinstance(frame, dict) and frame.get("schema") == "forge.qframe/v1" else compile_frame(q)
    if not isinstance(fr, dict):
        return {"hold": True, "reason": "frame_required", "missing": "frame", "question": q}
    part = cond_of(fr) or fr
    if cond_of(fr) and not part.get("parsed") and not part.get("kriya"):
        lemmas = " ".join(l for t in (part.get("tokens") or []) for l in (t.get("lemmas") or [t.get("w")]))
        words = " ".join(str(t.get("w") or "") for t in (part.get("tokens") or []))
        if "enzyme" in lemmas or "vmax" in words or "km" in words.split():
            return {"question": q, "frame": fr, "kind": "enzyme", "part": part}
        if "rabi" in words or "pulse" in lemmas:
            return {"question": q, "frame": fr, "kind": "quantum", "gate": "RABI", "state": _token_state(part), "part": part, "theta_over_pi": _token_theta(part)}
        if "capacitor" in lemmas or "farad" in lemmas or "resistor" in lemmas or "volt" in lemmas:
            return {"question": q, "frame": fr, "kind": "circuit", "part": part}
        if "rate" in lemmas and "constant" in lemmas:
            return {"question": q, "frame": fr, "kind": "kinetics", "part": part}
        return {"hold": True, "reason": "intervention_unparsed", "missing": "kriya", "question": q, "frame": fr}
    k = str(part.get("kriya") or "")
    heads = _heads_of(part)
    pat = patient(part) if part.get("kriya") else None
    ph = _head(pat)
    prop_facts = _facts_for(ph, facts) if ph else {}

    # property question: the gap is a mass/formula/structure of some substance (copula, any word order the grammar canonicalised)
    kartr = fr.get("kartr") if isinstance(fr.get("kartr"), dict) else {}
    # an unparsed wh-subject whose head is a period of a satellite: the height and the body are the leftover locus
    if fr.get("partial") and _head(kartr) == "period" and _head(kartr.get("of")) == "satellite":
        locus = fr.get("locus") if isinstance(fr.get("locus"), dict) else {}
        words = [str(t.get("w") or "") for t in (locus.get("tokens") or [])]
        alt = None
        for i, w in enumerate(words):
            if re.fullmatch(r"\d+(?:\.\d+)?", w) and i + 1 < len(words):
                unit = words[i + 1].lower().rstrip(".")
                if unit in _UNIT_M:
                    alt = float(w) * _UNIT_M[unit]
        stop = set(_UNIT_M) | {"above", "below", "around", "over", "under", "at", "a", "an", "the", "of", "from"}
        body = "earth"
        for w in reversed(words):
            low = w.lower().rstrip(".")
            if low and low not in stop and not re.fullmatch(r"\d+(?:\.\d+)?", low):
                body = low
                break
        return {"question": q, "frame": fr, "kind": "orbit", "body": body, "altitude_m": alt,
                "body_facts": _facts_for(body, facts), "part": part}
    if fr.get("kriya") == "be" and _head(kartr) in _PROP and isinstance(kartr.get("of"), dict):
        sub = _head(kartr.get("of")) or str((kartr.get("of") or {}).get("text") or "").lower()
        return {"question": q, "frame": fr, "kind": "mol", "substance": sub, "property": _head(kartr),
                "chem": _facts_for(sub, facts)}

    if k == "run" and ({"airflow", "cfd"} & set(heads) or "simulation" in heads and "airflow" in heads):
        speed = None
        for m in measures(part):
            if m["unit"] in ("m s", "m/s") or (m["unit"].startswith("m") and "s" in m["unit"]):
                speed = m["num"]
        return {"question": q, "frame": fr, "kind": "cfd", "speed_m_s": speed}

    if any(x in " ".join(heads) for x in ("hartree", "fock")) or "dft" in heads:
        mol = next((h for h in heads if h not in ("hartree-fock", "hartree", "fock", "dft", "you")), None)
        # the locus of "run Hartree-Fock on water" is the on-adjunct
        for a in _adjs(part):
            if a.get("prep") == "on" and _head(a.get("np")):
                mol = _head(a.get("np"))
        method = "HF" if "hartree" in " ".join(heads) else "DFT"
        return {"question": q, "frame": fr, "kind": "qc", "molecule": mol, "method": method, "chem": _facts_for(mol or "", facts)}

    if k == "apply" and ("gate" in " ".join(heads) or "qubit" in heads):
        state = 0
        gate = "H" if "hadamard" in " ".join(heads) else None
        blob = " ".join(heads)
        for name, g in (("pauli-x", "X"), ("pauli x", "X"), ("pauli-y", "Y"), ("pauli y", "Y"),
                        ("pauli-z", "Z"), ("pauli z", "Z"), ("x", "X"), ("hadamard", "H")):
            if name in blob and gate is None:
                gate = g
        for m in measures(part):
            if m["head"] == "state" and m["num"] is not None:
                state = int(m["num"])
        if "rabi" in blob or "pulse" in blob:
            gate = "RABI"
        if gate is None:
            return {"hold": True, "reason": "gate_missing", "missing": "gate", "question": q, "frame": fr}
        return {"question": q, "frame": fr, "kind": "quantum", "gate": gate, "state": state}

    if k == "orbit" or "satellite" in heads:
        body = "earth"
        for h in heads:
            if h not in ("satellite", "orbit", "you", "a"):
                body = h
                break
        alt = _qty(part, _UNIT_M)
        return {"question": q, "frame": fr, "kind": "orbit", "body": body, "altitude_m": alt, "body_facts": _facts_for(body, facts)}

    if k in ("translate", "transcribe") or "ribosome" in heads or "codon" in heads:
        seq = ""
        for np in (part.get("karma"), part.get("kartr")):
            if isinstance(np, dict) and np.get("propn"):
                token = str(np["propn"]).split()[-1]
                if len(token) >= 6 and set(token.lower()) <= set("acgtu"):
                    seq = token.upper()
        op = "transcribe" if k == "transcribe" else "translate"
        return {"question": q, "frame": fr, "kind": "sequence", "sequence": seq or None, "op": op}

    if "enzyme" in heads or "michaelis" in heads:
        return {"question": q, "frame": fr, "kind": "enzyme", "part": part}

    if "rate" in heads and "constant" in _head(part.get("kartr")):
        return {"question": q, "frame": fr, "kind": "kinetics", "part": part}

    if any(h in ("volt", "ohm", "resistor", "divider", "capacitor", "farad", "kiloohm") for h in heads):
        return {"question": q, "frame": fr, "kind": "circuit", "part": part}

    if k in _REACT:
        subs = []
        for np in (part.get("kartr"), part.get("karma")):
            h = _head(np)
            if h and h not in ("you", "it") and not (isinstance(np, dict) and np.get("kernel")):
                subs.append(h)
        for a in _adjs(part):
            if a.get("prep") == "with":
                h = _head(a.get("np"))
                if h:
                    subs.append(h)
        return {"question": q, "frame": fr, "kind": "reaction", "substances": subs, "burn": k in ("burn", "combust", "ignite"),
                "chem": {s: _facts_for(s, facts) for s in subs}}

    fluid = _fluid(part)
    if k in _IMMERSE and fluid and k not in _THROW:
        # "put/drop <patient> in <fluid>" is buoyancy. A drop with no fluid stays a fall.
        if not ph or ph in ("it", "them", "that", "this"):
            return {"hold": True, "reason": "unresolved_pronoun", "missing": "karma", "question": q, "frame": fr}
        stated = stated_props(part)
        props = dict(prop_facts)
        props.update(stated)
        return {"question": q, "frame": fr, "kind": "buoyancy", "verb": k, "patient": ph,
                "phrase": _phrase_of(pat), "patient_text": str((pat or {}).get("text") or ph),
                "fluid": fluid, "part": part, "props": props, "stated": bool(stated)}

    if k in _HEAT or k == "state":
        substance = ph
        mass = None
        if isinstance(pat, dict) and isinstance(pat.get("of"), dict) and _head(pat.get("of")):
            substance = _head(pat.get("of"))
        stated = stated_props(part)
        if "mass" in stated:
            mass = stated["mass"]
        power = time_s = target_c = None
        for a in _adjs(part):
            np = a.get("np") if isinstance(a.get("np"), dict) else {}
            unit = _head(np)
            num = _num(np)
            if num is None:
                continue
            if unit in ("watt", "w"):
                power = num
            elif unit in ("second", "s"):
                time_s = num
            elif unit in ("minute",):
                time_s = num * 60.0
            elif unit in ("degree",) and a.get("prep") in ("to", "at"):
                target_c = num
        for row in part.get("stated") or []:
            if str(row.get("unit") or "") == "degree" and str(row.get("dim") or "") in ("temperature", "temp"):
                try:
                    target_c = float(row.get("num"))
                except (TypeError, ValueError):
                    pass
        if not substance:
            return {"hold": True, "reason": "unknown_substance", "missing": "karma", "question": q, "frame": fr}
        return {"question": q, "frame": fr, "kind": "thermal", "verb": k or "heat", "patient": substance,
                "phrase": substance, "mass_kg": mass, "power_w": power, "time_s": time_s, "target_c": target_c,
                "part": part, "props": dict(prop_facts), "chem": _facts_for(substance, facts)}

    if k in _PUSH | _DROP | _THROW or k == "kick":
        kind = "throw" if k in _THROW or (k == "kick" and any(m["unit"] in ("degree",) for m in measures(part))) else (
            "drop" if k in _DROP else "push")
        karma_h = _head(part.get("karma"))
        if not ph or ph in ("it", "them", "that", "this", "something") or karma_h in ("it", "them", "that", "this"):
            return {"hold": True, "reason": "unresolved_pronoun", "missing": "karma", "question": q, "frame": fr}
        stated = stated_props(part)
        provenance = dict(prop_facts.get("_provenance") or {})
        props = {k: v for k, v in prop_facts.items() if k != "_provenance"}
        props.update(stated)
        for key in stated:
            provenance[key] = "stated"
        if provenance:
            props["_provenance"] = provenance
        out = {"question": q, "frame": fr, "kind": kind, "verb": k, "patient": ph,
               "phrase": _phrase_of(pat), "patient_text": str((pat or {}).get("text") or ph),
               "adjectives": list((pat or {}).get("adjs") or []), "point": _point(part), "surface": _surface(part),
               "slope_deg": _slope_deg(part), "part": part, "props": props, "stated": bool(stated),
               "stated_keys": sorted(stated)}
        if isinstance(fr, dict) and fr.get("derive_missing"):
            out["derive_missing"] = True
        return out

    return {"hold": True, "reason": "not_a_simulation_question", "missing": "intervention", "question": q, "frame": fr}


def continue_scene(prior: dict[str, Any] | None, follow_frame: dict[str, Any] | None) -> str | None:
    """A short follow-up keeps the prior patient and action and replaces the slot it names.

    "What if it is on ice?" and "What if you push it near the bottom?" are the same kāraka scene
    with one adjunct changed. The rebuilt question is parsed again by the phone grammar.
    """
    if not isinstance(prior, dict) or not isinstance(follow_frame, dict):
        return None
    scene = prior.get("scene") if isinstance(prior.get("scene"), dict) else prior
    body = scene.get("body") if isinstance(scene.get("body"), dict) else {}
    noun = str(body.get("phrase") or body.get("noun") or "").strip()
    if not noun:
        return None
    if not re.match(r"^(a|an|the)\b", noun, re.I):
        noun = ("an " if noun[:1].lower() in "aeiou" else "a ") + noun
    # Keep the body that was already compiled (stated size, or a size two publishers agreed).
    # A follow-up that only names a new point or surface must not fall back to a square default.
    defaulted = set(scene.get("defaulted") or [])
    art_m = re.match(r"^(a|an|the)\s+(.*)$", noun, re.I)
    art, name = (art_m.group(1), art_m.group(2)) if art_m else ("a", noun)
    mass_bit = ""
    if "mass" not in defaulted and isinstance(body.get("mass"), (int, float)) and float(body["mass"]) > 0:
        mass_bit = f"{float(body['mass']):g} kilogram "
    dims = []
    if "dimensions" not in defaulted:
        for key, word in (("height", "tall"), ("width", "wide"), ("depth", "deep")):
            val = body.get(key)
            if isinstance(val, (int, float)) and float(val) > 0:
                dims.append(f"{float(val):g} meters {word}")
    noun = f"{art} {mass_bit}{name}" + ((" " + " and ".join(dims)) if dims else "")
    part = cond_of(follow_frame) or follow_frame
    if not isinstance(part, dict):
        return None
    verb = str(scene.get("verb") or scene.get("action") or "push")
    point = _point(part) or ((scene.get("point") or {}).get("name") if isinstance(scene.get("point"), dict) else None)
    surface = _surface(part)
    if surface is None and str(part.get("kriya") or "") == "be":
        pred = part.get("pred") if isinstance(part.get("pred"), dict) else {}
        if pred.get("type") == "pp" and str(pred.get("prep") or "") in _SURF_PREP:
            surface = _head(pred.get("np")) or str(pred.get("text") or "").split()[-1]
        if surface in (None, "", "it", "something"):
            for a in _adjs(part):
                if a.get("prep") == "on":
                    surface = _head(a.get("np"))
    if surface is None:
        surface = (scene.get("surface") or {}).get("name") if isinstance(scene.get("surface"), dict) else None
    slope = _slope_deg(part)
    if slope is None:
        slope = scene.get("slope_deg")
    bits = [f"you {verb} {noun}"]
    if point and point not in ("center", "centre"):
        bits.append("near the " + point)
    if slope is not None and not (surface and surface not in _SLOPE):
        bits.append(f"on a {float(slope):g} degree ramp")
    elif surface and surface not in ("table",) and surface not in _SLOPE:
        bits.append("on " + surface)
        if slope is not None:
            bits.append(f"on a {float(slope):g} degree ramp")
    return "What happens if " + " ".join(bits) + "?"


def resume_pending(question: str, frame: dict[str, Any] | None, supplement: dict[str, Any] | None) -> dict[str, Any]:
    """Merge a sim-ask reply into the pending intervention.

    The reply's measures (already lifted onto the frame by the phone grammar) fill the body.
    A noun phrase with no measure replaces the patient, and the rebuilt question is planned again
    so a named kind can be looked up. The question string is the same slot assembly as a what-if.
    """
    reading = read(question, frame)
    if reading.get("hold") or reading.get("kind") not in ("push", "drop", "throw"):
        return {"ok": False, "reason": reading.get("reason") or "pending_unreadable", "calls_llm": False}
    sup = supplement if isinstance(supplement, dict) else {}
    stated = stated_props({"stated": sup.get("stated") or []})
    phrase = re.sub(r"^(?:a|an|the)\s+", "", str(sup.get("phrase") or "").strip(), count=1, flags=re.I).strip(" .")
    noun = phrase or str(reading.get("phrase") or reading.get("patient") or "").strip()
    if not noun:
        return {"ok": False, "reason": "no_patient", "calls_llm": False}
    body: dict[str, Any] = {"noun": noun, "phrase": noun}
    for key in ("mass", "height", "width", "depth"):
        if key in stated:
            body[key] = stated[key]
    scene = {
        "verb": reading.get("verb") or reading.get("kind"),
        "action": reading.get("kind"),
        "defaulted": [] if stated else ["mass", "dimensions"],
        "body": body,
        "point": {"name": reading.get("point")} if reading.get("point") else {},
        "surface": {"name": reading.get("surface")} if reading.get("surface") else {},
        "slope_deg": reading.get("slope_deg"),
    }
    rebuilt = continue_scene({"scene": scene}, frame if isinstance(frame, dict) else {})
    if not rebuilt:
        return {"ok": False, "reason": "resume_unbuilt", "calls_llm": False}
    return {"ok": True, "question": rebuilt, "specific": bool(phrase) and not stated,
            "derive_missing": bool(stated.get("height")) and "width" not in stated and "depth" not in stated,
            "calls_llm": False}
