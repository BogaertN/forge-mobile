"""4.9.203 phase + frequency packets. Stdlib. No LLM.

The formula lives in frequency_203_config and is proposal v1, awaiting Nic.
The existing Φ, ε, and μ stay the master packet. Frequency is added beside them.
Operators are the approved RSOC values, applied per component. Not FHRR.
"""
from __future__ import annotations

import hashlib
import json
import math
import random
from pathlib import Path
from typing import Any

from rmc_engine_v1.drift_v43 import C_MIN, ECHO_MIN, PHASE_NAMES, WRITE_MAX
from rmc_engine_v1.frequency_203_config import (
    AWAITING,
    BANDS,
    CITE,
    C_AGREE,
    EPSILON,
    HASH_PLACES_AMP,
    HASH_PLACES_DEG,
    HASH_PLACES_HZ,
    HOME,
    JUMP_DEG,
    JUMP_TOL_DEG,
    K,
    K_LETTERS,
    MASTER_HZ,
    MASTER_STEP_DEG,
    MASTER_WINDOW,
    MEMBRANE_PHASE,
    MIN_LETTERS,
    NUDGE_SPAN,
    OFFSET_CAP,
    OMEGA0,
    PROPOSAL,
)
from rmc_engine_v1.language_core_engines import HARD_STOP
from rmc_engine_v1.research_hooks import RESEARCH_HOOKS

ENGINE = Path(__file__).resolve().parent
REFERENCE = ENGINE / "reference"
TAU = math.tau


def q(value: float, places: int) -> float:
    scale = 10 ** places
    sign = -1.0 if value < 0 else 1.0
    out = sign * math.floor(abs(float(value)) * scale + 0.5) / scale
    if out == 0:
        return 0.0
    return out


def flags() -> dict[str, Any]:
    return {
        "admit_gate": False,
        "keyword_admit": False,
        "writes": False,
        "calls_llm": False,
        "money": False,
        "dream_idle": False,
        "economy": False,
        "packs_gated": True,
        "christping": "gilligan-only",
        "christping_started": False,
        "wikipedia_anchor": False,
        "c_min": C_MIN,
        "echo_min": ECHO_MIN,
        "write_max": WRITE_MAX,
        "hard_stop": HARD_STOP,
        "phase_agree_min": C_AGREE,
        "frequency_epsilon": EPSILON,
        "resonance_not_parsing": True,
        "coherence_formula_unchanged": True,
        "proposal": PROPOSAL,
        "awaiting": AWAITING,
        "fhrr": False,
        "rsoc": True,
    }


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _seeds() -> dict[str, dict[str, Any]]:
    rows: dict[str, dict[str, Any]] = {}
    for line in (REFERENCE / "word_loop_seed_lexicon_v1.jsonl").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        row = json.loads(line)
        word = str(row.get("word") or "").lower()
        if word:
            rows[word] = row
    return rows


def _letters() -> dict[str, dict[str, Any]]:
    return _read_json(REFERENCE / "letter_phase_map_v1.json").get("letters") or {}


def _concepts() -> tuple[dict[str, str], dict[str, list[str]]]:
    lex = _read_json(ENGINE / "concept_lexicon.json")
    surfaces = {str(k).lower(): str(v) for k, v in (lex.get("surfaces") or {}).items()}
    by: dict[str, list[str]] = {}
    for word, cid in surfaces.items():
        by.setdefault(cid, []).append(word)
    return surfaces, by


_CACHE: dict[str, Any] | None = None


def _load() -> dict[str, Any]:
    global _CACHE
    if _CACHE is None:
        surfaces, by = _concepts()
        _CACHE = {"seeds": _seeds(), "letters": _letters(), "surfaces": surfaces, "by": by}
    return _CACHE


def letters_of(word: str) -> list[dict[str, Any]]:
    table = _load()["letters"]
    out = []
    for ch in str(word or "").upper():
        spec = table.get(ch)
        if not isinstance(spec, dict):
            continue
        phase = str(spec.get("phase") or "")
        if len(phase) != 2 or phase[1] not in "123456789":
            continue
        try:
            charge = int(spec.get("charge"))
        except (TypeError, ValueError):
            charge = 0
        out.append({"letter": ch, "phi": int(phase[1]), "charge": charge})
    return out


def resultant(indexes: list[int]) -> int | None:
    if not indexes:
        return None
    counts: dict[int, int] = {}
    for n in indexes:
        counts[n] = counts.get(n, 0) + 1
    ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    if len(ranked) == 1 or ranked[0][1] > ranked[1][1]:
        return ranked[0][0]
    ang = [((n - 1) / 9.0) * TAU for n in indexes]
    mean = math.atan2(sum(math.sin(a) for a in ang), sum(math.cos(a) for a in ang)) % TAU
    best, gap = None, 1e9
    for n in range(1, 10):
        raw = abs(((n - 1) / 9.0) * TAU - mean)
        dist = min(raw, TAU - raw)
        if dist < gap - 1e-12 or (abs(dist - gap) < 1e-12 and (best is None or n < best)):
            gap, best = dist, n
    return best


def nearest_band(hz: float) -> int:
    best = BANDS[0]
    gap = abs(hz - best)
    for band in BANDS[1:]:
        dist = abs(hz - band)
        if dist < gap - 1e-9 or (abs(dist - gap) <= 1e-9 and band < best):
            gap, best = dist, band
    return best


def voronoi_half(marker: int) -> float:
    index = BANDS.index(marker)
    left = (marker - BANDS[index - 1]) / 2 if index else float(marker)
    right = (BANDS[index + 1] - marker) / 2 if index + 1 < len(BANDS) else float(marker)
    return min(left, right)


def deg_norm(value: float) -> float:
    out = q(value % 360.0, HASH_PLACES_DEG)
    if out < 0:
        out = q(out + 360.0, HASH_PLACES_DEG)
    if out >= 360:
        return 0.0
    return out


def master_deg(phi: int) -> float:
    return float((int(phi) - 1) * MASTER_STEP_DEG)


def cdist_deg(a: float, b: float) -> float:
    d = abs(a - b) % 360.0
    return min(d, 360.0 - d)


def signed_deg(old: float, new: float) -> float:
    d = (new - old) % 360.0
    if d > 180:
        d -= 360.0
    return d


def plus_120(old: float, new: float) -> bool:
    return abs(signed_deg(old, new) - JUMP_DEG) <= JUMP_TOL_DEG


def phase_name(phi: int | None) -> str:
    if not isinstance(phi, int):
        return ""
    return PHASE_NAMES.get(phi, "")


def _component(band: int, hz: float, phase: float, amp: float, master: bool) -> dict[str, Any]:
    snapped = q(hz, HASH_PLACES_HZ)
    if nearest_band(snapped) != band:
        snapped = q(float(band), HASH_PLACES_HZ)
    return {
        "band": int(band),
        "hz": snapped,
        "phase_deg": deg_norm(phase),
        "amp": q(max(0.0, amp), HASH_PLACES_AMP),
        "master": bool(master),
        "nearest": int(band) if master or nearest_band(snapped) == band else nearest_band(snapped),
    }


def _phasors(word: str) -> list[dict[str, Any]]:
    lets = letters_of(word)
    n = max(1, len(lets))
    net = sum(row["charge"] for row in lets) if lets else 0
    nudge = math.tanh(net / 8.0) / 4.0 if lets else 0.0
    acc: dict[int, list[float]] = {}
    for pos, row in enumerate(lets, start=1):
        theta = (row["phi"] - 1) * MASTER_STEP_DEG
        if row["charge"] < 0:
            theta += 180.0
        weight = 1.0 + abs(row["charge"])
        base = HOME[row["phi"]]
        half = voronoi_half(base)
        frac = (pos - 0.5) / n - 0.5
        charge_frac = max(-1.0, min(1.0, row["charge"] / 3.0))
        unit = 0.50 * frac + 0.25 * charge_frac + nudge
        if unit > OFFSET_CAP:
            unit = OFFSET_CAP
        if unit < -OFFSET_CAP:
            unit = -OFFSET_CAP
        hz = base + unit * half
        slot = acc.setdefault(base, [0.0, 0.0, 0.0, 0.0])
        rad = theta * math.pi / 180.0
        slot[0] += weight * math.cos(rad)
        slot[1] += weight * math.sin(rad)
        slot[2] += weight * hz
        slot[3] += weight
    comps = []
    for base, (x_sum, y_sum, f_sum, weight) in acc.items():
        phase = math.degrees(math.atan2(y_sum, x_sum))
        comps.append(_component(base, f_sum / weight, phase, math.hypot(x_sum, y_sum), False))
    comps.sort(key=lambda row: (-row["amp"], row["band"]))
    return comps[:K_LETTERS]


def _master_component(phi: int, others: list[dict[str, Any]]) -> dict[str, Any]:
    amp = sum(row["amp"] for row in others) or 1.0
    return _component(144, MASTER_HZ, master_deg(phi), amp, True)


def _pack(word: str, phi: int, components: list[dict[str, Any]], source: str, concept: str, placing: str) -> dict[str, Any]:
    ordered = [_master_component(phi, components)] + sorted(components, key=lambda row: row["band"])
    # Master amp was computed before the sort. Rebuild it from the letter rows.
    letters = [row for row in ordered if not row["master"]]
    ordered[0] = _master_component(phi, letters)
    canonical = "|".join(
        f"{row['band']}:{row['hz']:.2f}:{row['phase_deg']:.4f}:{row['amp']:.4f}" for row in ordered
    )
    return {
        "word": word,
        "Phi": int(phi),
        "phase_name": phase_name(int(phi)),
        "master_degrees": master_deg(phi),
        "source": source,
        "concept": concept,
        "placing_surface": placing,
        "proposal": PROPOSAL,
        "awaiting": AWAITING,
        "epsilon": EPSILON,
        "omega0": q(OMEGA0, 4),
        "components": ordered,
        "k": len(ordered),
        "content_hash": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        "canonical": canonical,
        "calls_llm": False,
        "cite": CITE,
    }


def own_gain(word: str) -> float:
    lets = letters_of(word)
    if not lets:
        return 0.0
    net = sum(row["charge"] for row in lets)
    return q(math.tanh(net / 8.0), 6)


def _nudge(components: list[dict[str, Any]], gain: float) -> list[dict[str, Any]]:
    out = []
    for row in components:
        if row["master"]:
            continue
        shift = gain * EPSILON * row["band"] * NUDGE_SPAN
        hz = q(row["hz"] + shift, HASH_PLACES_HZ)
        if nearest_band(hz) != row["band"]:
            hz = row["hz"]
        nxt = dict(row)
        nxt["hz"] = hz
        nxt["nearest"] = row["band"]
        out.append(nxt)
    return out


def seed_phase(word: str) -> int | None:
    row = _load()["seeds"].get(str(word or "").lower())
    if not isinstance(row, dict):
        return None
    phase = row.get("phase")
    if isinstance(phase, str) and len(phase) == 2 and phase[1] in "123456789":
        return int(phase[1])
    return None


def concept_phi(cid: str) -> int | None:
    data = _load()
    surfaces = data["by"].get(cid) or []
    hits = []
    for surface in surfaces:
        phase = seed_phase(surface)
        if phase:
            hits.append(phase)
    if hits:
        return resultant(hits)
    if not surfaces:
        return None
    placing = sorted(surfaces, key=lambda item: (len(item), item))[0]
    return resultant([row["phi"] for row in letters_of(placing)])


def placing_surface(cid: str) -> str:
    data = _load()
    surfaces = list(data["by"].get(cid) or [])
    seeded = [surface for surface in surfaces if seed_phase(surface)]
    pool = seeded or surfaces
    if not pool:
        return ""
    return sorted(pool, key=lambda item: (len(item), item))[0]


def letter_signature(word: str, master: int | None = None) -> dict[str, Any]:
    key = str(word or "").lower()
    phi = master if isinstance(master, int) and 1 <= master <= 9 else resultant([row["phi"] for row in letters_of(key)])
    if not isinstance(phi, int):
        phi = 1
    return _pack(key, phi, _phasors(key), "letters", "", "")


def word_signature(word: str, master: int | None = None) -> dict[str, Any]:
    """One word. A seed keeps its seed phase. A concept surface keeps the concept phase."""
    key = str(word or "").lower()
    if isinstance(master, int) and 1 <= master <= 9:
        return letter_signature(key, master)
    phase = seed_phase(key)
    if phase:
        return letter_signature(key, phase)
    cid = _load()["surfaces"].get(key)
    if cid:
        phi = concept_phi(cid)
        if not isinstance(phi, int):
            phi = 1
        placing = placing_surface(cid)
        backbone = _phasors(placing or key)
        nudged = _nudge(backbone, own_gain(key))
        packed = _pack(key, phi, nudged, "concept", cid, placing)
        return packed
    return letter_signature(key, None)


def _match_components(a: list[dict[str, Any]], b: list[dict[str, Any]]) -> tuple[list[tuple[dict[str, Any], dict[str, Any]]], int]:
    used: set[int] = set()
    pairs: list[tuple[dict[str, Any], dict[str, Any]]] = []
    letters_b = [row for row in b if not row.get("master")]
    for ca in a:
        if ca.get("master"):
            continue
        best = None
        best_gap = 1e9
        for index, cb in enumerate(letters_b):
            if index in used or ca["band"] != cb["band"]:
                continue
            gap = abs(ca["hz"] - cb["hz"]) / ca["band"]
            if gap <= EPSILON + 1e-12 and gap < best_gap:
                best, best_gap = index, gap
        if best is not None:
            used.add(best)
            pairs.append((ca, letters_b[best]))
    return pairs, len(letters_b)


def resonate(left: dict[str, Any], right: dict[str, Any]) -> dict[str, Any]:
    a = left.get("components") or []
    b = right.get("components") or []
    masters = [row for row in a if row.get("master")]
    masters_b = [row for row in b if row.get("master")]
    if not masters or not masters_b:
        return {"resonate": False, "reason": "no-master", "R": 0.0, "cover": 0.0, "matched": 0, "calls_llm": False}
    ma, mb = masters[0], masters_b[0]
    master_gap = cdist_deg(ma["phase_deg"], mb["phase_deg"])
    master_ok = master_gap <= (MASTER_WINDOW * 180.0 / math.pi) + 1e-9
    forward, n_b = _match_components(a, b)
    backward, n_a = _match_components(b, a)
    shorter = min(n_a, n_b)
    matched = len(forward) if n_a <= n_b else len(backward)
    cover = (matched / shorter) if shorter else 0.0
    pairs = forward if n_a <= n_b else [(rb, ra) for ra, rb in backward]
    sx = math.cos(math.radians(mb["phase_deg"] - ma["phase_deg"]))
    sy = math.sin(math.radians(mb["phase_deg"] - ma["phase_deg"]))
    count = 1
    for ca, cb in pairs:
        delta = math.radians(cb["phase_deg"] - ca["phase_deg"])
        sx += math.cos(delta)
        sy += math.sin(delta)
        count += 1
    score = math.hypot(sx, sy) / count
    ok = bool(master_ok and shorter >= MIN_LETTERS and matched == shorter and score + 1e-12 >= C_AGREE)
    reason = "resonate" if ok else "master" if not master_ok else "frequency" if matched != shorter or shorter < MIN_LETTERS else "phase"
    return {
        "resonate": ok,
        "reason": reason,
        "R": q(score, 6),
        "cover": q(cover, 6),
        "matched": matched,
        "shorter": shorter,
        "master_ok": master_ok,
        "master_deg": q(master_gap, 4),
        "epsilon": EPSILON,
        "phase_agree_min": C_AGREE,
        "calls_llm": False,
    }


def _state(spec: dict[str, Any]) -> dict[str, Any]:
    phi = int(spec.get("Phi") or 1)
    comps = spec.get("components")
    if not comps and spec.get("word"):
        comps = word_signature(str(spec["word"]), phi)["components"]
    return {
        "word": str(spec.get("word") or ""),
        "Phi": phi,
        "eps": float(spec.get("eps") if spec.get("eps") is not None else 0.0),
        "mu": float(spec.get("mu") if spec.get("mu") is not None else 1.0),
        "chi": int(spec.get("chi") or 0),
        "components": [dict(row) for row in (comps or [])],
    }


def _public_state(row: dict[str, Any], extra: dict[str, Any] | None = None) -> dict[str, Any]:
    out = {
        "word": row["word"],
        "Phi": int(row["Phi"]),
        "phase_name": phase_name(int(row["Phi"])),
        "eps": q(max(0.0, row["eps"]), 6),
        "mu": q(row["mu"], 6),
        "chi": int(row["chi"]),
        "components": [dict(item) for item in row["components"]],
        "calls_llm": False,
    }
    if extra:
        out.update(extra)
    return out


def _jump_report(before: list[dict[str, Any]], after: list[dict[str, Any]]) -> dict[str, Any]:
    banned = []
    by_band = {row["band"]: row for row in before}
    for row in after:
        prev = by_band.get(row["band"])
        if prev and plus_120(prev["phase_deg"], row["phase_deg"]):
            banned.append({"band": row["band"], "from": prev["phase_deg"], "to": row["phase_deg"]})
    return {"banned": banned, "forbidden": bool(banned)}


def _five_eight(a: int, b: int) -> bool:
    return int(a) == 5 and int(b) == 8


def membrane_open(phi: int) -> bool:
    return int(phi) == MEMBRANE_PHASE


def merge_op(left: dict[str, Any], right: dict[str, Any]) -> dict[str, Any]:
    a, b = _state(left), _state(right)
    ma = next(row for row in a["components"] if row.get("master"))
    mb = next(row for row in b["components"] if row.get("master"))
    delta = math.radians(cdist_deg(ma["phase_deg"], mb["phase_deg"]))
    if delta > MASTER_WINDOW + 1e-12 or int(a["chi"]) != int(b["chi"]):
        a["eps"] = max(0.0, a["eps"] + 0.07)
        b["eps"] = max(0.0, b["eps"] + 0.07)
        return {
            "op": "merge", "ok": False, "reason": "rejected", "eps_tax": 0.07,
            "a": _public_state(a), "b": _public_state(b), "calls_llm": False, "admit_gate": False,
        }
    if not (membrane_open(a["Phi"]) and membrane_open(b["Phi"])):
        return {
            "op": "merge", "ok": False, "reason": "phase-6 membrane",
            "a": _public_state(a), "b": _public_state(b), "calls_llm": False, "admit_gate": False,
        }
    shared = []
    used: set[int] = set()
    letters_b = [row for row in b["components"] if not row.get("master")]
    merged_letters = []
    for ca in a["components"]:
        if ca.get("master"):
            continue
        hit = None
        for index, cb in enumerate(letters_b):
            if index in used or ca["band"] != cb["band"]:
                continue
            if abs(ca["hz"] - cb["hz"]) / ca["band"] <= EPSILON + 1e-12:
                hit = index
                break
        if hit is None:
            merged_letters.append(dict(ca))
            continue
        used.add(hit)
        cb = letters_b[hit]
        shared.append(cdist_deg(ca["phase_deg"], cb["phase_deg"]))
        rad_a = math.radians(ca["phase_deg"])
        rad_b = math.radians(cb["phase_deg"])
        phase = math.degrees(math.atan2(math.sin(rad_a) + math.sin(rad_b), math.cos(rad_a) + math.cos(rad_b)))
        weight = ca["amp"] + cb["amp"] or 1.0
        hz = (ca["amp"] * ca["hz"] + cb["amp"] * cb["hz"]) / weight
        merged_letters.append(_component(ca["band"], hz, phase, weight, False))
    for index, cb in enumerate(letters_b):
        if index not in used:
            merged_letters.append(dict(cb))
    merged_letters.sort(key=lambda row: (-row["amp"], row["band"]))
    merged_letters = merged_letters[:K_LETTERS]
    phi = a["Phi"] if a["Phi"] == b["Phi"] else a["Phi"]
    master = _master_component(phi, merged_letters)
    merged = [master] + sorted(merged_letters, key=lambda row: row["band"])
    jump = _jump_report(a["components"] + b["components"], merged)
    if jump["forbidden"] or _five_eight(a["Phi"], phi) or _five_eight(b["Phi"], phi):
        return {
            "op": "merge", "ok": False, "reason": "5→8", "jump": jump,
            "a": _public_state(a), "b": _public_state(b), "calls_llm": False, "admit_gate": False,
        }
    mean_delta = (sum(shared) / len(shared)) if shared else cdist_deg(ma["phase_deg"], mb["phase_deg"])
    delta_rad = math.radians(mean_delta)
    mu = a["mu"] + b["mu"] + float(RESEARCH_HOOKS["merge_mu_bonus"]) * (math.cos(delta_rad) ** 2)
    eps = max(0.0, (a["eps"] + b["eps"]) / 2 - 0.05 * math.cos(delta_rad))
    state = {"word": a["word"] or b["word"], "Phi": phi, "eps": eps, "mu": mu, "chi": a["chi"], "components": merged}
    return {
        "op": "merge", "ok": True, "reason": "merged",
        "delta": q(delta_rad, 6),
        "mu_bonus": q(float(RESEARCH_HOOKS["merge_mu_bonus"]) * (math.cos(delta_rad) ** 2), 6),
        "state": _public_state(state),
        "calls_llm": False, "admit_gate": False, "fhrr": False,
    }


def lock_op(left: dict[str, Any], right: dict[str, Any]) -> dict[str, Any]:
    a, b = _state(left), _state(right)
    if not (membrane_open(a["Phi"]) and membrane_open(b["Phi"])):
        return {"op": "lock", "ok": False, "reason": "phase-6 membrane", "state": _public_state(a), "calls_llm": False, "admit_gate": False}
    verdict = resonate(
        {"components": a["components"]},
        {"components": b["components"]},
    )
    if not verdict["resonate"] or a["Phi"] != b["Phi"]:
        return {"op": "lock", "ok": False, "reason": "not aligned", "verdict": verdict, "calls_llm": False, "admit_gate": False}
    for ca, cb in _match_components(a["components"], b["components"])[0]:
        if cdist_deg(ca["phase_deg"], cb["phase_deg"]) > MASTER_STEP_DEG + 1e-9:
            return {"op": "lock", "ok": False, "reason": "phase step", "calls_llm": False, "admit_gate": False}
    locked = []
    for row in a["components"]:
        nxt = dict(row)
        nxt["phase_deg"] = master_deg(a["Phi"])
        locked.append(nxt)
    jump = _jump_report(a["components"], locked)
    if jump["forbidden"]:
        return {"op": "lock", "ok": False, "reason": "5→8", "jump": jump, "calls_llm": False, "admit_gate": False}
    state = dict(a)
    state["mu"] = a["mu"] + b["mu"]
    state["components"] = locked
    return {"op": "lock", "ok": True, "reason": "locked", "state": _public_state(state), "calls_llm": False, "admit_gate": False}


def fracture_op(spec: dict[str, Any]) -> dict[str, Any]:
    row = _state(spec)
    if not membrane_open(row["Phi"]):
        return {"op": "fracture", "ok": False, "reason": "phase-6 membrane", "state": _public_state(row), "calls_llm": False, "admit_gate": False}
    low = [dict(item) for item in row["components"] if item.get("master") or item["band"] < MASTER_HZ]
    high = [dict(item) for item in row["components"] if item.get("master") or item["band"] > MASTER_HZ]
    mu_sum = row["mu"] - float(RESEARCH_HOOKS["sever_mu_loss"])
    each = mu_sum / 2
    left = dict(row)
    right = dict(row)
    left["components"] = low
    right["components"] = high
    left["mu"] = each
    right["mu"] = each
    left["word"] = row["word"] + ":low"
    right["word"] = row["word"] + ":high"
    return {
        "op": "fracture", "ok": True, "reason": "split",
        "mu_tax": float(RESEARCH_HOOKS["sever_mu_loss"]),
        "mu_sum": q(left["mu"] + right["mu"], 6),
        "low": _public_state(left), "high": _public_state(right),
        "calls_llm": False, "admit_gate": False,
    }


def _carrier_drift(components: list[dict[str, Any]]) -> float:
    master = next((row for row in components if row.get("master")), None)
    if not master:
        return 0.0
    deltas = [math.radians(cdist_deg(row["phase_deg"], master["phase_deg"])) for row in components if not row.get("master")]
    if not deltas:
        return 0.0
    mean = sum(deltas) / len(deltas)
    var = sum((item - mean) ** 2 for item in deltas) / len(deltas)
    return min(1.0, math.sqrt(var) / math.pi)


def amplify_op(spec: dict[str, Any], k: float, drift: float | None = None) -> dict[str, Any]:
    row = _state(spec)
    gain = float(k)
    if gain < float(RESEARCH_HOOKS["amplify_k_min"]) or gain > float(RESEARCH_HOOKS["amplify_k_max"]):
        return {"op": "amplify", "ok": False, "reason": "k", "calls_llm": False, "admit_gate": False}
    delta = row and (float(drift) if drift is not None else _carrier_drift(row["components"]))
    comps = []
    for item in row["components"]:
        nxt = dict(item)
        nxt["amp"] = q(item["amp"] * gain, HASH_PLACES_AMP)
        comps.append(nxt)
    jump = _jump_report(row["components"], comps)
    if jump["forbidden"]:
        return {"op": "amplify", "ok": False, "reason": "5→8", "jump": jump, "calls_llm": False, "admit_gate": False}
    row["components"] = comps
    row["mu"] = gain * row["mu"] * math.exp(-float(RESEARCH_HOOKS["amplify_decay"]) * abs(delta))
    return {
        "op": "amplify", "ok": True, "reason": "amplified", "k": gain, "delta": q(delta, 6),
        "state": _public_state(row), "calls_llm": False, "admit_gate": False,
    }


def discharge_op(spec: dict[str, Any]) -> dict[str, Any]:
    row = _state(spec)
    echo = row["mu"] * math.exp(-float(RESEARCH_HOOKS["discharge_echo_decay"]) * row["eps"]) * math.cos(math.radians(master_deg(row["Phi"])))
    comps = []
    for item in row["components"]:
        nxt = dict(item)
        if not item.get("master"):
            nxt["amp"] = 0.0
        comps.append(nxt)
    row["components"] = comps
    row["mu"] = 0.0
    row["eps"] = row["eps"] * float(RESEARCH_HOOKS["discharge_eps_factor"])
    return {
        "op": "discharge", "ok": True, "reason": "discharged",
        "echo": q(echo, 6), "eps_factor": float(RESEARCH_HOOKS["discharge_eps_factor"]),
        "state": _public_state(row), "calls_llm": False, "admit_gate": False,
    }


def ban_op(spec: dict[str, Any], carrier_band: int, next_deg: float) -> dict[str, Any]:
    """One tick that tries to move one carrier. +120° and Φ5→Φ8 are refused."""
    row = _state(spec)
    comps = []
    hit = False
    for item in row["components"]:
        nxt = dict(item)
        if item["band"] == int(carrier_band):
            hit = True
            nxt["phase_deg"] = deg_norm(next_deg)
        comps.append(nxt)
    jump = _jump_report(row["components"], comps)
    master_before = next(item["phase_deg"] for item in row["components"] if item.get("master"))
    master_after = next(item["phase_deg"] for item in comps if item.get("master"))
    phi_after = int(round(master_after / MASTER_STEP_DEG)) + 1
    if phi_after < 1:
        phi_after = 1
    if phi_after > 9:
        phi_after = 9
    five = _five_eight(row["Phi"], phi_after) or (carrier_band == 144 and plus_120(master_before, master_after) and row["Phi"] == 5)
    if jump["forbidden"] or five or not hit:
        return {
            "op": "ban", "ok": False, "reason": "5→8" if (jump["forbidden"] or five) else "no carrier",
            "jump": jump, "applied": False, "calls_llm": False, "admit_gate": False,
        }
    row["components"] = comps
    return {"op": "ban", "ok": True, "reason": "step", "state": _public_state(row), "calls_llm": False, "admit_gate": False}


def migrate_seeds() -> dict[str, Any]:
    rows = []
    for word, spec in sorted(_load()["seeds"].items()):
        phase = seed_phase(word)
        if not phase:
            continue
        sig = letter_signature(word, phase)
        rows.append({
            "word": word,
            "Phi": phase,
            "eps": spec.get("eps"),
            "mu": spec.get("mu"),
            "master_kept": True,
            "frequency": {
                "k": sig["k"],
                "content_hash": sig["content_hash"],
                "master_hz": MASTER_HZ,
                "master_degrees": sig["master_degrees"],
                "components": sig["components"],
            },
        })
    return {
        "schema": "FORGE-FREQUENCY-MIGRATION/v203",
        "proposal": PROPOSAL,
        "seeds": len(rows),
        "rows": rows,
        "applied": False,
        "calls_llm": False,
    }


def migrate_packet(packet: dict[str, Any]) -> dict[str, Any]:
    """Keep Φ, ε, μ. Attach the letter signature. Used by the growth tier."""
    nxt = dict(packet)
    phi = nxt.get("Phi")
    master = int(phi) if isinstance(phi, int) and 1 <= phi <= 9 else None
    sig = letter_signature(str(nxt.get("word") or ""), master)
    nxt["frequency"] = {
        "proposal": PROPOSAL,
        "Phi": sig["Phi"],
        "master_degrees": sig["master_degrees"],
        "epsilon": EPSILON,
        "components": sig["components"],
        "content_hash": sig["content_hash"],
        "k": sig["k"],
        "source": "letters",
    }
    nxt["master_kept"] = nxt.get("Phi") == sig["Phi"]
    return nxt


def _synth_word(index: int) -> str:
    """A unique letter string. The base-26 prefix is the index, so no word repeats."""
    alphabet = "abcdefghijklmnopqrstuvwxyz"
    chars: list[str] = []
    n = index + 1
    while n:
        n, rem = divmod(n, 26)
        chars.append(alphabet[rem])
    while len(chars) < 3:
        chars.append("a")
    x = (index * 1103515245 + 12345) & 0x7FFFFFFF
    for _ in range((index * 7) % 6):
        x = (1103515245 * x + 12345) & 0x7FFFFFFF
        chars.append(alphabet[x % 26])
    return "".join(chars)


def _before_pair(a: dict[str, Any], b: dict[str, Any]) -> bool:
    ma = next(row for row in a["components"] if row.get("master"))
    mb = next(row for row in b["components"] if row.get("master"))
    return cdist_deg(ma["phase_deg"], mb["phase_deg"]) <= (MASTER_WINDOW * 180.0 / math.pi) + 1e-9


def measure_lexicon() -> dict[str, Any]:
    mig = migrate_seeds()
    sigs = []
    for row in mig["rows"]:
        sigs.append({"Phi": row["Phi"], "components": row["frequency"]["components"]})
    n = len(sigs)
    before = after = same = cross = same_after = cross_after = 0
    pairs = n * (n - 1) // 2
    for i in range(n):
        for j in range(i + 1, n):
            pre = _before_pair(sigs[i], sigs[j])
            post = resonate(sigs[i], sigs[j])["resonate"]
            if pre:
                before += 1
            if post:
                after += 1
            if sigs[i]["Phi"] == sigs[j]["Phi"]:
                same += 1
                if post:
                    same_after += 1
            elif pre:
                cross += 1
                if post:
                    cross_after += 1
    return {
        "n": n,
        "pairs": pairs,
        "before": before,
        "after": after,
        "before_rate": q(before / pairs, 6) if pairs else 0,
        "after_rate": q(after / pairs, 6) if pairs else 0,
        "same_phase_pairs": same,
        "same_phase_after": same_after,
        "neighbor_pairs": cross,
        "neighbor_after": cross_after,
    }


def measure_synthetic(n: int, samples: int, rng: random.Random) -> dict[str, Any]:
    sigs = [letter_signature(_synth_word(i)) for i in range(n)]
    keys: dict[str, int] = {}
    for sig in sigs:
        keys[sig["canonical"]] = keys.get(sig["canonical"], 0) + 1
    exact = sum(count * (count - 1) // 2 for count in keys.values())
    before = after = drawn = 0
    guard = 0
    while drawn < samples and guard < samples * 5:
        guard += 1
        i = rng.randrange(n)
        j = rng.randrange(n)
        if i == j:
            continue
        drawn += 1
        if _before_pair(sigs[i], sigs[j]):
            before += 1
        if resonate(sigs[i], sigs[j])["resonate"]:
            after += 1
    pair_space = n * (n - 1) / 2
    return {
        "n": n,
        "samples": drawn,
        "before": before,
        "after": after,
        "before_rate": q(before / drawn, 6) if drawn else 0,
        "after_rate": q(after / drawn, 6) if drawn else 0,
        "expected_before_pairs": q((before / drawn) * pair_space, 2) if drawn else 0,
        "expected_after_pairs": q((after / drawn) * pair_space, 2) if drawn else 0,
        "exact_signature_pairs": exact,
    }


def related_report() -> dict[str, Any]:
    names = ["sun", "hot", "light", "warm", "sunny", "weather", "cold", "dog", "quartz", "moon"]
    sigs = {name: word_signature(name) for name in names}
    pairs = []
    for i, left in enumerate(names):
        for right in names[i + 1:]:
            verdict = resonate(sigs[left], sigs[right])
            pairs.append({
                "a": left,
                "b": right,
                "resonate": verdict["resonate"],
                "R": verdict["R"],
                "reason": verdict["reason"],
                "concept_a": sigs[left]["concept"],
                "concept_b": sigs[right]["concept"],
            })
    return {"words": {name: {"Phi": sigs[name]["Phi"], "concept": sigs[name]["concept"], "source": sigs[name]["source"], "k": sigs[name]["k"], "components": sigs[name]["components"], "content_hash": sigs[name]["content_hash"]} for name in names}, "pairs": pairs}


def proof(samples: int = 20000) -> dict[str, Any]:
    rng = random.Random(144)
    lexicon = measure_lexicon()
    synthetic = [measure_synthetic(n, samples if n < 100000 else max(samples, 40000), rng) for n in (1000, 10000, 100000)]
    return {
        "schema": "FORGE-FREQUENCY-PROOF/v203",
        "proposal": PROPOSAL,
        "awaiting": AWAITING,
        "epsilon": EPSILON,
        "epsilon_why": (
            "FBSC Vol II states |r_i-r_j|<=ε and gives no number. "
            "r = hz/nearest marker. ε=0.02 stays inside the tightest letter-home half-width "
            "so a match cannot cross a marker, and it sits above the 0.01 Hz quantum."
        ),
        "omega0": q(OMEGA0, 4),
        "bands": BANDS,
        "lexicon": lexicon,
        "synthetic": synthetic,
        "related": related_report(),
        "calls_llm": False,
        "c_min": C_MIN,
        "coherence_formula_unchanged": True,
    }


def run(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    row = payload or {}
    op = str(row.get("op") or "signature")
    if op == "flags":
        return flags()
    if op == "config":
        return {
            "bands": BANDS, "home": HOME, "epsilon": EPSILON, "k": K,
            "omega0": q(OMEGA0, 4), "proposal": PROPOSAL, "cite": CITE, "calls_llm": False,
        }
    if op == "signature":
        return word_signature(str(row.get("word") or ""), row.get("master") if isinstance(row.get("master"), int) else None)
    if op == "resonate":
        left = word_signature(str(row.get("a") or ""))
        right = word_signature(str(row.get("b") or ""))
        return {"a": left, "b": right, "verdict": resonate(left, right), "calls_llm": False}
    if op == "merge":
        return merge_op(row.get("a") or {}, row.get("b") or {})
    if op == "lock":
        return lock_op(row.get("a") or {}, row.get("b") or {})
    if op == "fracture":
        return fracture_op(row.get("state") or {})
    if op == "amplify":
        return amplify_op(row.get("state") or {}, float(row.get("k") or 1), row.get("drift"))
    if op == "discharge":
        return discharge_op(row.get("state") or {})
    if op == "ban":
        return ban_op(row.get("state") or {}, int(row.get("band") or 144), float(row.get("phase_deg") or 0))
    if op == "migrate":
        mig = migrate_seeds()
        return {"seeds": mig["seeds"], "applied": False, "sample": mig["rows"][:3], "calls_llm": False}
    if op == "migrate-packet":
        return migrate_packet(row.get("packet") or {})
    if op == "related":
        return related_report()
    if op == "lexicon":
        return measure_lexicon()
    return {"op": op, "ok": False, "calls_llm": False}


if __name__ == "__main__":
    import sys
    raw = sys.stdin.read()
    data = json.loads(raw) if raw.strip() else {"op": "flags"}
    json.dump(run(data), sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
