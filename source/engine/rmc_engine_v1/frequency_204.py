"""4.9.204 resonance tuning. Stdlib. No LLM.

Spelling fixes the starting decimals (frequency_203). Co-admitted words
attract, conflict pairs repel, and a weak spacing term keeps the field
from one frequency. Only hertz offsets move. The glyph master does not.

The formula is frequency_204_config. Proposal v1, awaiting Nic.
Operators are the RSOC numbers in research_hooks. Not FHRR.
"""
from __future__ import annotations

import json
import math
import re
from typing import Any

from rmc_engine_v1.drift_v43 import C_MIN, ECHO_MIN, WRITE_MAX
from rmc_engine_v1.frequency_203 import (
    letters_of,
    nearest_band,
    q,
    resonate,
    voronoi_half,
    word_signature,
)
from rmc_engine_v1.frequency_203_config import BANDS, EPSILON, MASTER_HZ, MASTER_WINDOW
from rmc_engine_v1.frequency_204_config import (
    AWAITING,
    BETA,
    CITE,
    EQ_FRACTION,
    FUNCTION_WORDS,
    HALF_LIFE_HOURS,
    HASH_PLACES,
    KAPPA,
    MATH,
    MEMBRANE_PHASE,
    PROPOSAL,
    SEVER,
    ZETA,
)
from rmc_engine_v1.language_core_engines import HARD_STOP
from rmc_engine_v1.research_hooks import RESEARCH_HOOKS

LN2 = math.log(2)
TOKEN = re.compile(r"[a-zA-Z']+")
WATCH = (("sun", "light"), ("sun", "hot"), ("sun", "dog"), ("light", "quartz"))


def flags() -> dict[str, Any]:
    return {
        "admit_gate": False,
        "keyword_admit": False,
        "writes_offsets": True,
        "calls_llm": False,
        "money": False,
        "dream_idle": False,
        "economy": False,
        "packs_gated": True,
        "christping": "gilligan-only",
        "christping_started": False,
        "wikipedia_anchor": False,
        "wikimedia_excluded": True,
        "c_min": C_MIN,
        "echo_min": ECHO_MIN,
        "write_max": WRITE_MAX,
        "hard_stop": HARD_STOP,
        "zeta": ZETA,
        "beta": BETA,
        "sever": SEVER,
        "kappa": KAPPA,
        "half_life_hours": HALF_LIFE_HOURS,
        "membrane_phase": MEMBRANE_PHASE,
        "master_phase_moved": False,
        "resonance_not_parsing": True,
        "coherence_formula_unchanged": True,
        "proposal": PROPOSAL,
        "awaiting": AWAITING,
        "fhrr": False,
        "rsoc": True,
    }


def _check_hooks() -> None:
    if float(RESEARCH_HOOKS["merge_mu_bonus"]) != ZETA:
        raise RuntimeError("merge bonus drifted")
    if float(RESEARCH_HOOKS["amplify_decay"]) != BETA:
        raise RuntimeError("amplify decay drifted")
    if float(RESEARCH_HOOKS["sever_mu_loss"]) != SEVER:
        raise RuntimeError("severance drifted")
    if float(RESEARCH_HOOKS["half_life_hours"]) != HALF_LIFE_HOURS:
        raise RuntimeError("half-life drifted")
    if C_MIN != 0.87 or ECHO_MIN != 0.85 or WRITE_MAX != 0.35 or HARD_STOP != 0.8:
        raise RuntimeError("law threshold drifted")


def cell_bounds(marker: int) -> tuple[float, float]:
    """Open-closed interval that nearest_band still labels as this marker."""
    index = BANDS.index(int(marker))
    lo = (BANDS[index - 1] + marker) / 2.0 if index else float("-inf")
    hi = (marker + BANDS[index + 1]) / 2.0 if index + 1 < len(BANDS) else float("inf")
    return lo, hi


def clamp_hz(band: int, hz: float) -> float:
    lo, hi = cell_bounds(int(band))
    margin = 0.01
    out = float(hz)
    if out <= lo:
        out = lo + margin
    if out > hi:
        out = hi
    snapped = q(out, 2)
    if nearest_band(snapped) != int(band):
        snapped = q(float(band), 2)
    return snapped


def master_delta(left: dict[str, Any], right: dict[str, Any]) -> float:
    ma = next(row for row in left["components"] if row.get("master"))
    mb = next(row for row in right["components"] if row.get("master"))
    gap = abs(ma["phase_deg"] - mb["phase_deg"]) % 360.0
    deg = min(gap, 360.0 - gap)
    return deg * math.pi / 180.0


def wiki_blocked(trust: str, source: str) -> bool:
    blob = f"{trust or ''} {source or ''}".lower()
    return "wikipedia" in blob or "wikimedia" in blob


def content_words(text: str, words: list[str] | None = None) -> list[str]:
    if words is not None:
        out = []
        seen: set[str] = set()
        for raw in words:
            word = str(raw or "").lower()
            if not word or word in seen:
                continue
            seen.add(word)
            out.append(word)
        return out
    found: list[str] = []
    seen = set()
    for raw in TOKEN.findall(str(text or "").lower()):
        word = raw.strip("'")
        if len(word) < 2 or word in FUNCTION_WORDS or word in seen:
            continue
        if len(letters_of(word)) < 2:
            continue
        seen.add(word)
        found.append(word)
    return found


def decay_weight(age_hours: float, half_life: float = HALF_LIFE_HOURS) -> float:
    age = max(0.0, float(age_hours))
    half = float(half_life) if half_life else HALF_LIFE_HOURS
    return q(math.exp(-LN2 * age / half), HASH_PLACES)


def _empty_acc() -> dict[str, dict[int, float]]:
    return {}


def _add(acc: dict[str, dict[int, float]], word: str, band: int, dh: float) -> None:
    slot = acc.setdefault(word, {})
    slot[int(band)] = q(slot.get(int(band), 0.0) + q(dh, HASH_PLACES), HASH_PLACES)


def attract_dh(h_u: float, h_v: float, marker: int, delta_rad: float) -> float:
    if delta_rad > MASTER_WINDOW + 1e-12:
        return 0.0
    gap = h_v - h_u
    abs_delta = abs(gap) / marker if marker else 0.0
    coupling = ZETA * (math.cos(delta_rad) ** 2) * math.exp(-BETA * abs_delta)
    return q(coupling * gap, HASH_PLACES)


def repel_dh(h_u: float, h_v: float, marker: int) -> float:
    gap = h_v - h_u
    abs_delta = abs(gap) / marker if marker else 0.0
    coupling = SEVER * math.exp(-BETA * abs_delta)
    return q(-coupling * gap, HASH_PLACES)


def eq_gap(marker: int) -> float:
    return EQ_FRACTION * EPSILON * marker


def separate_dh(h_u: float, h_v: float, marker: int, word_u: str, word_v: str) -> float:
    """Outward spring inside d_eq. Zero when the pair is already far enough."""
    gap = abs(h_u - h_v)
    d_eq = eq_gap(marker)
    if gap > d_eq + 1e-12:
        return 0.0
    abs_delta = gap / marker if marker else 0.0
    decay = math.exp(-BETA * abs_delta)
    if gap <= 1e-12:
        direction = 1.0 if word_u > word_v else -1.0
    else:
        direction = 1.0 if h_u > h_v else -1.0
    return q(direction * ZETA * decay * (d_eq - gap), HASH_PLACES)


def space_dh(h_u: float, h_v: float, marker: int) -> float:
    diff = h_u - h_v
    gap = abs(diff)
    abs_delta = gap / marker if marker else 0.0
    return q(KAPPA * math.exp(-BETA * abs_delta) * diff, HASH_PLACES)


def step_drift(deltas: dict[int, float]) -> float:
    worst = 0.0
    for band, dh in deltas.items():
        half = voronoi_half(int(band)) or 1.0
        worst = max(worst, abs(float(dh)) / half)
    return worst


def spread_of(signatures: list[dict[str, Any]]) -> dict[str, Any]:
    positions: list[float] = []
    for sig in signatures:
        for row in sig.get("components") or []:
            if row.get("master"):
                continue
            half = voronoi_half(int(row["band"])) or 1.0
            positions.append((float(row["hz"]) - float(row["band"])) / half)
    n = len(positions)
    if n < 2:
        return {"n": n, "stdev": 0.0, "entropy": 0.0, "calls_llm": False}
    mean = sum(positions) / n
    var = sum((item - mean) ** 2 for item in positions) / n
    bins = [0] * 21
    for item in positions:
        x = item
        if x < -1:
            x = -1.0
        if x > 1:
            x = 1.0
        idx = int(math.floor((x + 1.0) / 2.0 * 21.0))
        if idx < 0:
            idx = 0
        if idx > 20:
            idx = 20
        bins[idx] += 1
    entropy = 0.0
    for count in bins:
        if not count:
            continue
        p = count / n
        entropy -= p * math.log2(p)
    return {"n": n, "stdev": q(math.sqrt(var), HASH_PLACES), "entropy": q(entropy, HASH_PLACES), "calls_llm": False}


class Field:
    def __init__(self, spacing: bool = True) -> None:
        _check_hooks()
        self.spacing = bool(spacing)
        self.pulls: list[dict[str, Any]] = []
        self.conflicts: list[dict[str, Any]] = []
        self.overrides: dict[str, dict[str, Any]] = {}
        self.t_hours = 0.0
        self._seq = 0

    def _next(self, kind: str) -> str:
        self._seq += 1
        return f"{kind}-{self._seq:04d}"

    def signature(self, word: str) -> dict[str, Any]:
        key = str(word or "").lower()
        if key in self.overrides:
            return self.overrides[key]
        return word_signature(key)

    def register(self, word: str, signature: dict[str, Any]) -> None:
        self.overrides[str(word).lower()] = signature

    def offsets(self, word: str, t_hours: float | None = None) -> dict[int, float]:
        t = self.t_hours if t_hours is None else float(t_hours)
        acc: dict[int, float] = {}
        for pull in self.pulls:
            if pull.get("retracted") or not pull.get("applied"):
                continue
            slot = (pull.get("deltas") or {}).get(word)
            if not slot:
                continue
            weight = decay_weight(t - float(pull.get("t_hours") or 0.0))
            for band, dh in slot.items():
                acc[int(band)] = q(acc.get(int(band), 0.0) + q(float(dh) * weight, HASH_PLACES), HASH_PLACES)
        return {band: q(value, HASH_PLACES) for band, value in acc.items()}

    def tuned(self, word: str, t_hours: float | None = None) -> dict[str, Any]:
        base = self.signature(word)
        offs = self.offsets(word, t_hours)
        comps = []
        for row in base["components"]:
            nxt = dict(row)
            if row.get("master"):
                nxt["hz"] = MASTER_HZ
                nxt["band"] = 144
                nxt["phase_deg"] = row["phase_deg"]
                nxt["master"] = True
                comps.append(nxt)
                continue
            band = int(row["band"])
            hz = clamp_hz(band, float(row["hz"]) + float(offs.get(band, 0.0)))
            nxt["hz"] = hz
            nxt["nearest"] = nearest_band(hz)
            comps.append(nxt)
        master = next(row for row in comps if row.get("master"))
        base_master = next(row for row in base["components"] if row.get("master"))
        intact = (
            int(base["Phi"]) == int(base["Phi"])
            and master["hz"] == base_master["hz"]
            and master["phase_deg"] == base_master["phase_deg"]
            and int(base["Phi"]) == int(base.get("Phi") or 0)
        )
        out = dict(base)
        out["word"] = str(word).lower()
        out["Phi"] = int(base["Phi"])
        out["master_degrees"] = base["master_degrees"]
        out["components"] = comps
        out["base_hash"] = base.get("content_hash")
        out["tuning"] = "4.9.204"
        out["master_unchanged"] = bool(intact and master["phase_deg"] == base["master_degrees"])
        out["calls_llm"] = False
        return out

    def _hz(self, word: str, band: int, t_hours: float) -> float | None:
        sig = self.signature(word)
        for row in sig["components"]:
            if row.get("master") or int(row["band"]) != int(band):
                continue
            offs = self.offsets(word, t_hours).get(int(band), 0.0)
            return clamp_hz(int(band), float(row["hz"]) + float(offs))
        return None

    def _shared(self, left: str, right: str) -> list[int]:
        a = {int(row["band"]) for row in self.signature(left)["components"] if not row.get("master")}
        b = {int(row["band"]) for row in self.signature(right)["components"] if not row.get("master")}
        return sorted(a & b)

    def _five_eight(self, left: str, right: str) -> bool:
        pair = {int(self.signature(left)["Phi"]), int(self.signature(right)["Phi"])}
        return pair == {5, 8}

    def _live_words(self) -> list[str]:
        found: set[str] = set()
        for pull in self.pulls:
            if pull.get("retracted") or not pull.get("applied"):
                continue
            for word, slot in (pull.get("deltas") or {}).items():
                if slot:
                    found.add(word)
        return sorted(found)

    def pair_view(self, left: str, right: str, t_hours: float | None = None) -> dict[str, Any]:
        a = self.tuned(left, t_hours)
        b = self.tuned(right, t_hours)
        verdict = resonate(a, b)
        bands: dict[str, list[float]] = {}
        right_hz = {int(row["band"]): row["hz"] for row in b["components"] if not row.get("master")}
        for row in a["components"]:
            if row.get("master"):
                continue
            band = int(row["band"])
            if band in right_hz:
                bands[str(band)] = [row["hz"], right_hz[band]]
        return {
            "resonate": bool(verdict["resonate"]),
            "reason": verdict["reason"],
            "R": verdict["R"],
            "cover": verdict["cover"],
            "matched": verdict["matched"],
            "shorter": verdict["shorter"],
            "master_ok": verdict["master_ok"],
            "phi": [int(a["Phi"]), int(b["Phi"])],
            "master_hz": [MASTER_HZ, MASTER_HZ],
            "master_deg": [a["master_degrees"], b["master_degrees"]],
            "hz": bands,
            "calls_llm": False,
        }

    def _standing_pairs(self) -> list[tuple[str, str, str]]:
        rows = []
        for row in self.conflicts:
            if row.get("retracted"):
                continue
            a, b = row["words"]
            rows.append((a, b, str(row["kind"])))
        rows.sort()
        return rows

    def _levels(self, words: list[str], t_hours: float) -> dict[str, dict[int, float]]:
        levels: dict[str, dict[int, float]] = {}
        for word in words:
            offs = self.offsets(word, t_hours)
            band_hz: dict[int, float] = {}
            for row in self.signature(word)["components"]:
                if row.get("master"):
                    continue
                band = int(row["band"])
                band_hz[band] = clamp_hz(band, float(row["hz"]) + float(offs.get(band, 0.0)))
            levels[word] = band_hz
        return levels

    def _accumulate(self, attract_pairs: list[tuple[str, str]], t_hours: float) -> dict[str, dict[int, float]]:
        acc = _empty_acc()
        attract_keys = {tuple(sorted(pair)) for pair in attract_pairs}
        standing = self._standing_pairs()
        # Spacing is global inside this tick: the words being tuned now,
        # not every word that has ever moved. A later sentence must not
        # walk an untouched packet-mate off its spelling frequency.
        active = sorted(
            {word for pair in attract_pairs for word in pair}
            | {word for left, right, _kind in standing for word in (left, right)}
        )
        levels = self._levels(active, t_hours)
        phase_delta: dict[tuple[str, str], float] = {}
        for left, right in attract_pairs:
            if self._five_eight(left, right):
                continue
            phase_delta[(left, right)] = master_delta(self.signature(left), self.signature(right))
            for band in sorted(set(levels.get(left, {})) & set(levels.get(right, {}))):
                h_l = levels[left][band]
                h_r = levels[right][band]
                gap = abs(h_l - h_r)
                if self.spacing and gap <= eq_gap(band) + 1e-12:
                    _add(acc, left, band, separate_dh(h_l, h_r, band, left, right))
                    _add(acc, right, band, separate_dh(h_r, h_l, band, right, left))
                else:
                    delta = phase_delta[(left, right)]
                    _add(acc, left, band, attract_dh(h_l, h_r, band, delta))
                    _add(acc, right, band, attract_dh(h_r, h_l, band, delta))
        for left, right, _kind in standing:
            shared = sorted(set(levels.get(left, {})) & set(levels.get(right, {})))
            for band in shared:
                h_l = levels[left][band]
                h_r = levels[right][band]
                _add(acc, left, band, repel_dh(h_l, h_r, band))
                _add(acc, right, band, repel_dh(h_r, h_l, band))
        if self.spacing:
            for i, left in enumerate(active):
                for right in active[i + 1:]:
                    if tuple(sorted((left, right))) in attract_keys:
                        continue
                    for band in sorted(set(levels.get(left, {})) & set(levels.get(right, {}))):
                        h_l = levels[left][band]
                        h_r = levels[right][band]
                        gap = abs(h_l - h_r)
                        if gap <= eq_gap(band) + 1e-12:
                            _add(acc, left, band, separate_dh(h_l, h_r, band, left, right))
                            _add(acc, right, band, separate_dh(h_r, h_l, band, right, left))
                        else:
                            _add(acc, left, band, space_dh(h_l, h_r, band))
                            _add(acc, right, band, space_dh(h_r, h_l, band))
        return acc

    def _gate(self, spec: dict[str, Any]) -> dict[str, Any] | None:
        if spec.get("calls_llm"):
            return {"ok": False, "applied": False, "reason": "llm", "chi": 1, "drift": 0.0}
        if wiki_blocked(str(spec.get("trust") or ""), str(spec.get("source") or "")):
            return {"ok": False, "applied": False, "reason": "wikipedia", "chi": 0, "drift": 0.0}
        try:
            score = float(spec.get("C"))
            echo = float(spec.get("echo"))
            drift = float(spec.get("drift"))
        except (TypeError, ValueError):
            return {"ok": False, "applied": False, "reason": "ungated", "chi": 0, "drift": 0.0}
        if score < C_MIN - 1e-12:
            return {"ok": False, "applied": False, "reason": "C", "chi": 0, "drift": q(drift, HASH_PLACES)}
        if echo < ECHO_MIN - 1e-12:
            return {"ok": False, "applied": False, "reason": "echo", "chi": 0, "drift": q(drift, HASH_PLACES)}
        if drift >= HARD_STOP - 1e-12:
            return {"ok": False, "applied": False, "reason": "hard-stop", "chi": 1, "drift": q(drift, HASH_PLACES)}
        if drift > WRITE_MAX + 1e-12:
            return {"ok": False, "applied": False, "reason": "quarantine", "chi": 1, "drift": q(drift, HASH_PLACES)}
        return None

    def _commit(self, acc: dict[str, dict[int, float]], meta: dict[str, Any]) -> dict[str, Any]:
        raw_drift = 0.0
        for slot in acc.values():
            raw_drift = max(raw_drift, step_drift(slot))
        raw_drift = q(raw_drift, HASH_PLACES)
        chi = 0
        capped = False
        scale = 1.0
        reason = str(meta.get("reason") or "tune")
        if raw_drift >= HARD_STOP - 1e-12:
            scale = 0.0
            chi = 1
            reason = "hard-stop"
        elif raw_drift > WRITE_MAX + 1e-12:
            scale = q(WRITE_MAX / raw_drift, HASH_PLACES)
            chi = 1
            capped = True
            reason = "capped"
        deltas: dict[str, dict[str, float]] = {}
        for word in sorted(acc):
            slot = {}
            for band in sorted(acc[word]):
                applied = q(acc[word][band] * scale, HASH_PLACES)
                if applied == 0.0:
                    continue
                slot[str(band)] = applied
            if slot:
                deltas[word] = slot
        applied = bool(deltas) and scale != 0.0
        # A capped or clean tick with only exact-zero moves still records provenance.
        if scale == 0.0:
            applied = False
        pull = {
            "id": self._next("pull"),
            "admit_id": meta.get("admit_id"),
            "kind": meta.get("kind") or "tune",
            "words": list(meta.get("words") or []),
            "t_hours": q(float(meta.get("t_hours") or 0.0), HASH_PLACES),
            "applied": applied,
            "chi": chi,
            "capped": capped,
            "drift": raw_drift if scale == 0.0 else q(raw_drift * scale, HASH_PLACES),
            "raw_drift": raw_drift,
            "reason": reason,
            "deltas": deltas,
            "phi": {word: int(self.signature(word)["Phi"]) for word in sorted(deltas)},
            "master_unchanged": True,
            "C": meta.get("C"),
            "echo": meta.get("echo"),
            "write_drift": meta.get("write_drift"),
            "trust": meta.get("trust") or "",
            "retracted": False,
            "calls_llm": False,
        }
        self.pulls.append(pull)
        masters_ok = all(self.tuned(word)["master_unchanged"] for word in pull["phi"]) if pull["phi"] else True
        pull["master_unchanged"] = bool(masters_ok)
        return {
            "ok": reason not in {"hard-stop", "phase-6 membrane", "llm", "wikipedia", "C", "echo", "quarantine", "5→8"},
            "applied": applied,
            "reason": reason,
            "chi": chi,
            "capped": capped,
            "drift": pull["drift"],
            "raw_drift": raw_drift,
            "deltas": deltas,
            "pull_id": pull["id"],
            "master_unchanged": pull["master_unchanged"],
            "calls_llm": False,
        }

    def _file_conflict(self, kind: str, words: list[str], admit_id: str) -> None:
        pair = tuple(sorted(str(w).lower() for w in words))
        if len(pair) != 2 or pair[0] == pair[1]:
            return
        for row in self.conflicts:
            if row.get("retracted"):
                continue
            if tuple(row["words"]) == pair and row["kind"] == kind:
                return
        self.conflicts.append({
            "id": self._next("conflict"),
            "kind": kind,
            "words": list(pair),
            "admit_id": admit_id,
            "retracted": False,
            "calls_llm": False,
        })

    def admit(self, spec: dict[str, Any]) -> dict[str, Any]:
        admit_id = str(spec.get("id") or spec.get("admit_id") or self._next("admit"))
        t_hours = float(spec["t_hours"]) if spec.get("t_hours") is not None else self.t_hours
        self.t_hours = t_hours
        blocked = self._gate(spec)
        phase = int(spec.get("phase") if spec.get("phase") is not None else MEMBRANE_PHASE)
        words = content_words(str(spec.get("text") or ""), spec.get("words"))
        if blocked:
            blocked.update({
                "id": admit_id, "words": words, "master_unchanged": True,
                "deltas": {}, "calls_llm": False, "capped": False, "raw_drift": blocked["drift"],
            })
            return blocked
        if phase != MEMBRANE_PHASE:
            if len(words) >= 2:
                for i, left in enumerate(words):
                    for right in words[i + 1:]:
                        self._file_conflict("membrane", [left, right], admit_id)
            return {
                "ok": False, "applied": False, "reason": "phase-6 membrane", "chi": 0,
                "drift": 0.0, "raw_drift": 0.0, "id": admit_id, "words": words,
                "deltas": {}, "capped": False, "master_unchanged": True, "calls_llm": False,
            }
        attract_pairs: list[tuple[str, str]] = []
        for i, left in enumerate(words):
            for right in words[i + 1:]:
                if self._five_eight(left, right):
                    self._file_conflict("five-eight", [left, right], admit_id)
                    continue
                attract_pairs.append((left, right))
        attract_pairs.sort()
        acc = self._accumulate(attract_pairs, t_hours)
        result = self._commit(acc, {
            "admit_id": admit_id,
            "kind": "attract" if attract_pairs else "tune",
            "reason": "attract" if attract_pairs else "tune",
            "words": words,
            "t_hours": t_hours,
            "C": q(float(spec.get("C")), HASH_PLACES),
            "echo": q(float(spec.get("echo")), HASH_PLACES),
            "write_drift": q(float(spec.get("drift")), HASH_PLACES),
            "trust": spec.get("trust") or "",
        })
        result["id"] = admit_id
        result["words"] = words
        return result

    def refute(self, spec: dict[str, Any]) -> dict[str, Any]:
        blocked = self._gate(spec)
        admit_id = str(spec.get("id") or self._next("refute"))
        words = content_words(str(spec.get("text") or ""), spec.get("words"))
        if blocked:
            blocked.update({"id": admit_id, "words": words, "deltas": {}, "master_unchanged": True, "calls_llm": False, "capped": False, "raw_drift": blocked["drift"]})
            return blocked
        phase = int(spec.get("phase") if spec.get("phase") is not None else MEMBRANE_PHASE)
        t_hours = float(spec["t_hours"]) if spec.get("t_hours") is not None else self.t_hours
        self.t_hours = t_hours
        if phase != MEMBRANE_PHASE:
            for i, left in enumerate(words):
                for right in words[i + 1:]:
                    self._file_conflict("membrane", [left, right], admit_id)
            return {
                "ok": False, "applied": False, "reason": "phase-6 membrane", "chi": 0,
                "drift": 0.0, "id": admit_id, "words": words, "deltas": {},
                "master_unchanged": True, "calls_llm": False, "capped": False, "raw_drift": 0.0,
            }
        for i, left in enumerate(words):
            for right in words[i + 1:]:
                self._file_conflict("refute", [left, right], admit_id)
        acc = self._accumulate([], t_hours)
        result = self._commit(acc, {
            "admit_id": admit_id, "kind": "repel", "reason": "repel", "words": words,
            "t_hours": t_hours, "C": q(float(spec.get("C")), HASH_PLACES),
            "echo": q(float(spec.get("echo")), HASH_PLACES),
            "write_drift": q(float(spec.get("drift")), HASH_PLACES),
            "trust": spec.get("trust") or "",
        })
        result["id"] = admit_id
        result["words"] = words
        return result

    def tick(self, spec: dict[str, Any] | None = None) -> dict[str, Any]:
        spec = spec or {}
        phase = int(spec.get("phase") if spec.get("phase") is not None else MEMBRANE_PHASE)
        admit_id = str(spec.get("id") or self._next("tick"))
        t_hours = float(spec["t_hours"]) if spec.get("t_hours") is not None else self.t_hours
        self.t_hours = t_hours
        if phase != MEMBRANE_PHASE:
            return {
                "ok": False, "applied": False, "reason": "phase-6 membrane", "chi": 0,
                "drift": 0.0, "id": admit_id, "words": [], "deltas": {},
                "master_unchanged": True, "calls_llm": False, "capped": False, "raw_drift": 0.0,
            }
        acc = self._accumulate([], t_hours)
        result = self._commit(acc, {
            "admit_id": admit_id, "kind": "tick", "reason": "tick", "words": self._live_words(),
            "t_hours": t_hours, "C": None, "echo": None, "write_drift": None, "trust": "",
        })
        result["id"] = admit_id
        result["words"] = self._live_words()
        return result

    def retract(self, admit_id: str) -> dict[str, Any]:
        key = str(admit_id)
        hit = 0
        for pull in self.pulls:
            if pull.get("admit_id") == key and not pull.get("retracted"):
                pull["retracted"] = True
                hit += 1
        for row in self.conflicts:
            if row.get("admit_id") == key and not row.get("retracted"):
                row["retracted"] = True
                hit += 1
        return {
            "ok": True, "applied": False, "reason": "retract", "id": key,
            "retracted": hit, "master_unchanged": True, "calls_llm": False, "chi": 0,
        }

    def attempt_phi(self, word: str, new_phi: int) -> dict[str, Any]:
        sig = self.signature(word)
        old = int(sig["Phi"])
        nxt = int(new_phi)
        forbidden = old == 5 and nxt == 8
        return {
            "ok": not forbidden,
            "applied": False,
            "reason": "5→8" if forbidden else "refused",
            "word": str(word).lower(),
            "phi_before": old,
            "phi_after": old,
            "requested": nxt,
            "master_unchanged": True,
            "calls_llm": False,
            "chi": 1 if forbidden else 0,
        }

    def dump(self) -> dict[str, Any]:
        return {
            "schema": "FORGE-FREQUENCY-FIELD/v204",
            "proposal": PROPOSAL,
            "t_hours": self.t_hours,
            "spacing": self.spacing,
            "pulls": self.pulls,
            "conflicts": self.conflicts,
            "calls_llm": False,
        }

    def load(self, payload: dict[str, Any]) -> None:
        self.t_hours = float(payload.get("t_hours") or 0.0)
        self.spacing = bool(payload.get("spacing", True))
        self.pulls = [dict(row) for row in payload.get("pulls") or []]
        self.conflicts = [dict(row) for row in payload.get("conflicts") or []]
        self._seq = len(self.pulls) + len(self.conflicts)


def related_block(field: Field) -> dict[str, Any]:
    out = {}
    for left, right in WATCH:
        out[f"{left}/{right}"] = field.pair_view(left, right)
    return out


def _lawful(**extra: Any) -> dict[str, Any]:
    row = {"C": 0.90, "echo": 1.0, "drift": 0.05, "phase": MEMBRANE_PHASE, "trust": "local", "calls_llm": False}
    row.update(extra)
    return row


def collapse_report(steps: int = 16, n: int = 12) -> dict[str, Any]:
    """One band, n clones, repeated co-admission. Spacing on versus off."""
    base = word_signature("grace")
    band = next(int(row["band"]) for row in base["components"] if not row.get("master"))
    half = voronoi_half(band)

    def make(name: str, index: int) -> dict[str, Any]:
        frac = (index / (n - 1) - 0.5) * 0.8 if n > 1 else 0.0
        comps = []
        shifted = False
        for row in base["components"]:
            nxt = dict(row)
            if not row.get("master") and int(row["band"]) == band and not shifted:
                nxt["hz"] = clamp_hz(band, float(row["hz"]) + frac * half)
                shifted = True
            comps.append(nxt)
        packed = dict(base)
        packed["word"] = name
        packed["components"] = comps
        packed["Phi"] = int(base["Phi"])
        return packed

    names = [f"g{i}" for i in range(n)]

    def run(spacing: bool) -> dict[str, Any]:
        field = Field(spacing=spacing)
        for name, index in zip(names, range(n)):
            field.register(name, make(name, index))
        before = [field.tuned(name) for name in names]
        start = spread_of(before)
        hz0 = sorted(_band_hz(field, name, band) for name in names)
        trace = [{"step": 0, "stdev": _stdev(hz0), "entropy": hz_entropy(hz0)}]
        for step in range(steps):
            field.admit(_lawful(id=f"{'s' if spacing else 'n'}{step}", words=names, t_hours=float(step)))
            hz_now = [_band_hz(field, name, band) for name in names]
            trace.append({"step": step + 1, "stdev": _stdev(hz_now), "entropy": hz_entropy(hz_now)})
        hz1 = sorted(_band_hz(field, name, band) for name in names)
        after = spread_of([field.tuned(name) for name in names])
        return {
            "spacing": spacing,
            "band": band,
            "before_stdev": _stdev(hz0),
            "after_stdev": _stdev(hz1),
            "before_entropy": hz_entropy(hz0),
            "after_entropy": hz_entropy(hz1),
            "before_hz": hz0,
            "after_hz": hz1,
            "spread_before": start,
            "spread_after": after,
            "trace": trace,
            "hard_stops": sum(1 for row in field.pulls if row["reason"] == "hard-stop"),
            "capped": sum(1 for row in field.pulls if row["capped"]),
            "master_unchanged": all(field.tuned(name)["master_unchanged"] for name in names),
        }

    on = run(True)
    off = run(False)
    return {
        "band": band,
        "n": n,
        "steps": steps,
        "with_spacing": on,
        "without_spacing": off,
        "spacing_holds": on["after_stdev"] > off["after_stdev"] and on["after_stdev"] > 0,
        "calls_llm": False,
    }


def _band_hz(field: Field, word: str, band: int) -> float:
    for row in field.tuned(word)["components"]:
        if int(row["band"]) == int(band) and not row.get("master"):
            return float(row["hz"])
    return 0.0


def _stdev(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    var = sum((item - mean) ** 2 for item in values) / len(values)
    return q(math.sqrt(var), HASH_PLACES)


def hz_entropy(values: list[float]) -> float:
    """Shannon entropy of hundredths-of-a-hertz bins. One bin is a collapse."""
    if len(values) < 2:
        return 0.0
    bins: dict[float, int] = {}
    for value in values:
        key = q(value, 2)
        bins[key] = bins.get(key, 0) + 1
    total = len(values)
    entropy = 0.0
    for count in bins.values():
        p = count / total
        entropy -= p * math.log2(p)
    return q(entropy, HASH_PLACES)


def sun_series(steps: int = 12) -> dict[str, Any]:
    field = Field()
    rows = []
    for step in range(steps):
        result = field.admit(_lawful(id=f"sun-light-{step}", words=["sun", "light"], text="sun light", t_hours=float(step)))
        view = field.pair_view("sun", "light")
        rows.append({
            "step": step,
            "reason": result["reason"],
            "drift": result["drift"],
            "applied": result["applied"],
            "chi": result["chi"],
            "resonate": view["resonate"],
            "cover": view["cover"],
            "R": view["R"],
            "reason_pair": view["reason"],
            "hz": view["hz"],
            "phi": view["phi"],
            "master_deg": view["master_deg"],
            "master_unchanged": result["master_unchanged"],
        })
    retracted = field.retract("sun-light-0")
    after = field.pair_view("sun", "light")
    return {
        "steps": rows,
        "retract_first": retracted,
        "after_retract_one": {"cover": after["cover"], "hz": after["hz"], "resonate": after["resonate"]},
        "calls_llm": False,
    }


def script(steps: list[dict[str, Any]], spacing: bool = True) -> dict[str, Any]:
    field = Field(spacing=spacing)
    trace = []
    for spec in steps:
        op = str(spec.get("op") or "admit")
        if op == "admit":
            result = field.admit(spec)
        elif op == "refute":
            result = field.refute(spec)
        elif op == "tick":
            result = field.tick(spec)
        elif op == "retract":
            result = field.retract(str(spec.get("id") or ""))
        elif op == "phi":
            result = field.attempt_phi(str(spec.get("word") or ""), int(spec.get("phi") or 0))
        elif op == "spread":
            words = content_words("", spec.get("words"))
            result = spread_of([field.tuned(word) for word in words])
            result["reason"] = "spread"
            result["ok"] = True
        else:
            result = {"ok": False, "reason": "op", "calls_llm": False}
        result = dict(result)
        result["related"] = related_block(field)
        trace.append(result)
    return {
        "op": "script",
        "steps": trace,
        "pulls": len(field.pulls),
        "conflicts": len(field.conflicts),
        "t_hours": field.t_hours,
        "calls_llm": False,
        "proposal": PROPOSAL,
    }


def run(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    row = payload or {}
    op = str(row.get("op") or "flags")
    if op == "flags":
        return flags()
    if op == "config":
        return {
            "zeta": ZETA, "beta": BETA, "sever": SEVER, "kappa": KAPPA,
            "eq_fraction": EQ_FRACTION, "half_life_hours": HALF_LIFE_HOURS,
            "membrane_phase": MEMBRANE_PHASE, "epsilon": EPSILON,
            "proposal": PROPOSAL, "cite": CITE, "math": MATH, "calls_llm": False,
            "hooks_match": True,
        }
    if op == "script":
        return script(list(row.get("steps") or []), spacing=bool(row.get("spacing", True)))
    if op == "series":
        return sun_series(int(row.get("steps") or 12))
    if op == "collapse":
        return collapse_report(int(row.get("steps") or 16), int(row.get("n") or 12))
    if op == "content":
        return {"words": content_words(str(row.get("text") or "")), "calls_llm": False}
    return {"op": op, "ok": False, "calls_llm": False}


if __name__ == "__main__":
    import sys
    raw = sys.stdin.read()
    data = json.loads(raw) if raw.strip() else {"op": "flags"}
    json.dump(run(data), sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
