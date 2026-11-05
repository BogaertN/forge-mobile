"""4.9.233 (plan 229 step 5): Derive matches a fact to the question by frame AND by phase/band alignment.

Frame. The phone's question frame (forge.qframe/v1, via question_frame.current()) names the kriyā, the known roles
and the gap (the indefinite pro-form "something"/"someone"). A fact's frame is its clause frame (4.9.232), the roles of
a clause that did not cover every word (role_frame), or the two arguments of an is() atom. A fact answers only when
the kriyā is the same, every known role of the question unifies with the fact's role (same head, the question's words
inside the fact's phrase, the same owner), and the gap role is filled. Copula: "What is X?" reads X as the fact's kartṛ;
a definite X ("the capital of France") may also be the fact's predicate (a specificational copula). A polar question
needs both roles. One relational-noun rule, WM-NAME-OF: "X's name" is the proper-noun predicate of a copula fact on X.

Alignment. The fact's placement (place_row: Φ, ε, μ, band, Hz) against each phase on the question's phase path:
resonance grace rpm·cos²δ with δ ≤ π/4 (resonance_recall._grace), the band relation same/x3/x9/none
(band_tuning.relation), and the 4.9.204 frequency attraction between the fact's Hz and the question's tuned Hz
(frequency_204.attract_dh). A frame match that is not phase-aligned does not answer. Word coverage is only a logged
tie-break. Nothing here calls a model.
"""
from __future__ import annotations

import math
import re
from typing import Any

RULE_NAME_OF = "WM-NAME-OF"
_DETS = {"the", "a", "an", "some", "this", "that", "these", "those"}
_STOP = {"of", "is", "are", "was", "were", "be", "and", "or", "to", "in", "on", "at", "for", "with", "by", "my", "your",
         "his", "her", "its", "their", "our", "'s", "s"}


def _sing(word: str) -> str:
    w = str(word or "").lower().strip("'")
    if w.endswith("'s"):
        w = w[:-2]
    if len(w) > 4 and w.endswith("ies"):
        return w[:-3] + "y"
    if len(w) > 3 and w.endswith("s") and not w.endswith("ss") and not w.endswith("us"):
        return w[:-1]
    return w


def _words(text: str) -> set[str]:
    return {_sing(w) for w in re.findall(r"[A-Za-z][A-Za-z'\-]*", str(text or "")) if w.lower() not in _DETS and w.lower() not in _STOP}


def _head(np: dict[str, Any]) -> str:
    head = np.get("head") or np.get("propn")
    if not head:
        ws = [w for w in re.findall(r"[A-Za-z][A-Za-z'\-]*", str(np.get("text") or "")) if w.lower() not in _DETS]
        head = ws[-1] if ws else ""
    return _sing(str(head))


def _owner_user(np: dict[str, Any]) -> bool:
    owner = np.get("owner")
    return owner == "user" or bool(np.get("user")) or bool(re.match(r"(?i)\s*(my|i)\b", str(np.get("text") or "")))


def is_gap(np: Any) -> bool:
    return isinstance(np, dict) and bool(np.get("indef"))


def np_unify(q: Any, f: Any) -> bool:
    """A known question role and a fact role name the same thing."""
    if not isinstance(q, dict) or not isinstance(f, dict) or not str(f.get("text") or "").strip():
        return False
    if _owner_user(q) != _owner_user(f):
        return False
    qo, fo = q.get("owner"), f.get("owner")
    if isinstance(qo, dict) and not (isinstance(fo, dict) and np_unify(qo, fo)):
        return False
    if _head(q) != _head(f):
        return False
    qw, fw = _words(q.get("text")), _words(f.get("text"))
    for sub in ("of", "owner"):
        if isinstance(f.get(sub), dict):
            fw |= _words(f[sub].get("text"))
    return qw <= fw


def _specific(np: dict[str, Any]) -> bool:
    return str(np.get("det") or "").lower() == "the" or isinstance(np.get("of"), dict) or isinstance(np.get("owner"), dict)


def _atom_np(text: str) -> dict[str, Any]:
    t = str(text or "").strip()
    first = t.split()[0].lower() if t.split() else ""
    out = {"text": t, "det": first if first in _DETS else None}
    m = re.match(r"(?i)(.+?)\s+of\s+(.+)$", t)
    if m:
        ws = [w for w in m.group(1).split() if w.lower() not in _DETS]
        out["head"] = ws[-1] if ws else None
        out["of"] = {"text": m.group(2)}
    if t[:1].isupper() and first not in _DETS and len(t.split()) <= 3:
        out["propn"] = t
    return out


def fact_frame(fact: dict[str, Any]) -> tuple[dict[str, Any] | None, str]:
    """The frame a fact is matched on, and where it came from."""
    if isinstance(fact.get("frame"), dict) and fact["frame"].get("kartr"):
        return fact["frame"], "clause"
    if isinstance(fact.get("role_frame"), dict) and fact["role_frame"].get("kartr"):
        return fact["role_frame"], "clause_roles"
    atom = fact.get("atom") or {}
    args = atom.get("args") or []
    if atom.get("predicate") == "is" and len(args) >= 2:
        return {"kriya": "be", "polarity": atom.get("polarity") or "pos", "kartr": _atom_np(args[0]), "pred": _atom_np(args[1])}, "atom"
    if atom.get("predicate") and len(args) >= 2:
        return {"kriya": str(atom["predicate"]), "polarity": atom.get("polarity") or "pos", "kartr": _atom_np(args[0]), "karma": _atom_np(args[1])}, "atom"
    return None, "none"


def chain_frame(first: dict[str, Any], second: dict[str, Any], conclusion: dict[str, Any]) -> dict[str, Any]:
    """A copula-chain conclusion's frame: the first premise's kartṛ and the second premise's predicate."""
    f1, _ = fact_frame(first)
    f2, _ = fact_frame(second)
    args = conclusion.get("args") or ["", ""]
    kartr = (f1 or {}).get("kartr") or _atom_np(args[0])
    pred = (f2 or {}).get("pred") or _atom_np(args[1])
    return {"kriya": "be", "polarity": "pos", "kartr": kartr, "pred": pred, "derived": True}


def match(qframe: dict[str, Any] | None, fframe: dict[str, Any] | None) -> dict[str, Any] | None:
    """Unify the question frame with a fact frame. None when they do not unify."""
    if not isinstance(qframe, dict) or not isinstance(fframe, dict):
        return None
    qk = str(qframe.get("kriya") or "").lower()
    fk = str(fframe.get("kriya") or "").lower()
    if not qk or qk != fk:
        return None
    role = str(qframe.get("wh_role") or "")
    qs, qp, qo = qframe.get("kartr"), qframe.get("pred"), qframe.get("karma")
    fs, fp, fo = fframe.get("kartr"), fframe.get("pred"), fframe.get("karma")
    fpol = fframe.get("polarity") or "pos"
    if role == "polarity":
        if qk == "be":
            for a, b, orient in ((fs, fp, "kartr=kartr"), (fp, fs, "kartr=pred")):
                if np_unify(qs, a) and np_unify(qp, b):
                    yes = (fpol == (qframe.get("polarity") or "pos"))
                    return {"roles": 2, "gap": None, "filler": "yes" if yes else "no", "orientation": orient, "rule": "polar"}
            return None
        if np_unify(qs, fs) and np_unify(qo, fo):
            return {"roles": 2, "gap": None, "filler": "yes" if fpol == (qframe.get("polarity") or "pos") else "no", "orientation": "kartr,karma", "rule": "polar"}
        return None
    if fpol != "pos":
        return None
    if qk == "be":
        if is_gap(qp) and isinstance(qs, dict) and not is_gap(qs):
            if np_unify(qs, fs) and isinstance(fp, dict):
                return {"roles": 1, "gap": "pred", "filler": fp.get("text"), "orientation": "kartr=kartr", "rule": "copula"}
            if _specific(qs) and np_unify(qs, fp) and isinstance(fs, dict):
                return {"roles": 1, "gap": "pred", "filler": fs.get("text"), "orientation": "kartr=pred", "rule": "copula_specificational"}
            if _head(qs) == "name" and isinstance(qs.get("owner"), dict) and isinstance(fp, dict) and fp.get("propn") and np_unify(qs["owner"], fs):
                return {"roles": 1, "gap": "pred", "filler": fp.get("text"), "orientation": "owner=kartr", "rule": RULE_NAME_OF}
            return None
        if is_gap(qs) and isinstance(qp, dict) and not is_gap(qp):
            if np_unify(qp, fp) and isinstance(fs, dict):
                return {"roles": 1, "gap": "kartr", "filler": fs.get("text"), "orientation": "pred=pred", "rule": "copula"}
        return None
    if role == "kartr" or is_gap(qs):
        if np_unify(qo, fo) and isinstance(fs, dict):
            return {"roles": 1, "gap": "kartr", "filler": fs.get("text"), "orientation": "karma=karma", "rule": "transitive"}
        return None
    if role == "karma" or is_gap(qo):
        if np_unify(qs, fs) and isinstance(fo, dict):
            return {"roles": 1, "gap": "karma", "filler": fo.get("text"), "orientation": "kartr=kartr", "rule": "transitive"}
    return None


def question_phases(phase_path: list[Any] | None) -> list[int]:
    out: list[int] = []
    for p in phase_path or []:
        m = re.search(r"(\d+)", str(p))
        if m and 1 <= int(m.group(1)) <= 9 and int(m.group(1)) not in out:
            out.append(int(m.group(1)))
    return out


def alignment(place: dict[str, Any] | None, phase_path: list[Any] | None, question: str) -> dict[str, Any]:
    """Grace, band relation and 4.9.204 attraction of a fact's placement against the question's phases (best phase)."""
    from rmc_engine_v1.band_tuning import band_key, relation, tune
    from rmc_engine_v1.frequency_203_config import HOME
    from rmc_engine_v1.frequency_204 import BETA, MASTER_WINDOW, ZETA, attract_dh
    from rmc_engine_v1.resonance_recall import _grace, _resonance

    place = place if isinstance(place, dict) else {}
    phases = question_phases(phase_path)
    base = {"aligned": False, "question_phases": phases, "fact_phase": place.get("Phi"), "fact_phi_basis": place.get("phi_basis"),
            "fact_band": place.get("band"), "fact_hz": place.get("hz"), "grace": 0.0, "grace_key": 0, "band_relation": "none",
            "band_weight": 0.0, "band_key": 0, "attraction_dh": 0.0, "coupling": 0.0, "question_phi": None, "delta_deg": None}
    if place.get("Phi") is None or not phases:
        base["reason"] = "no fact phase" if place.get("Phi") is None else "no question phase"
        return base
    best = None
    for qphi in phases:
        g = _grace({"Phi": place.get("Phi"), "eps": place.get("eps", "unspecified"), "mu": place.get("mu", "unspecified")}, qphi)
        rel = relation(place.get("Phi"), qphi)
        qband = tune(question, qphi)
        delta = float(g.get("delta") if g.get("delta") is not None else math.tau)
        marker = HOME.get(int(qphi)) or 1
        dh = 0.0
        coupling = 0.0
        if place.get("hz") is not None and qband.get("hz") is not None:
            dh = attract_dh(float(place["hz"]), float(qband["hz"]), marker, delta)
            gap = abs(float(qband["hz"]) - float(place["hz"]))
            coupling = 0.0 if delta > MASTER_WINDOW + 1e-12 else ZETA * math.cos(delta) ** 2 * math.exp(-BETA * gap / marker)
        row = {"aligned": bool(g.get("aligned")), "question_phi": qphi, "delta_deg": round(math.degrees(delta), 3),
               "grace": round(float(g.get("grace") or 0.0), 6), "grace_key": _resonance(g),
               "rpm": g.get("rpm"), "band_relation": rel["relation"], "band_weight": rel["weight"], "band_key": band_key(rel["weight"]),
               "question_band": qband.get("band"), "question_hz": qband.get("hz"), "attraction_dh": dh, "coupling": round(coupling, 6)}
        key = (row["aligned"], row["grace_key"], row["band_key"], row["coupling"])
        if best is None or key > best[0]:
            best = (key, row)
    out = dict(base)
    out.update(best[1])
    out["reason"] = "aligned" if out["aligned"] else "phase not aligned (δ > π/4 or ε/μ outside the band)"
    return out
