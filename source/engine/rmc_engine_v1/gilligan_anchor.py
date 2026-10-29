"""Gilligan connects a quarantined excerpt to an admitted concept.

The connection is a shared Doc 5 frame role or a shared Doc 4 concept, then
the phase of the admitted packet. This file does not rank excerpts and it
does not parse with a regular expression.

Drift of that connection is measurement_kernel epsilon, unchanged. Bands are
Nic's table (kmath.js DRIFT_RULING, Gilligan Codex §6.1):

  <= 0.35   projectable. Athena may resonance-place. The admit gate is later.
  > 0.35 and < 0.40   chi. Gilligan only. Not placed. ChristPing is not started.
  >= 0.40 and <= 0.80 quarantine. Kept. Not a premise.
  > 0.80    hard stop. ChristPing is recorded here and only here. Ask does not start it.

Citations
  Gilligan Codex Vol IV §1.1.2 phase anchor lock, §3.2 ChristPing, §3.4 drift
  arbitration, §6.1 drift categorization, §6.2 cold archive.
  source/src/gilligan_codex.js driftClass. source/src/kmath.js DRIFT_RULING.
  source/src/dream_idle.js: only Gilligan initiates ChristPing.
  Athena placement: dream_idle.js resonancePacket. WIRING_185.

This function does not write and does not admit.
"""
from __future__ import annotations

from typing import Any

from rmc_engine_v1.mobile_config import THRESHOLDS
from rmc_engine_v1.resonance_recall import (
    _concept_ids,
    _frame_roles,
    _grace,
    _norm_role,
    _quarantined,
    clean_text,
    place_packet,
)
from rmc_engine_v1.world_model_v1 import _drift_for, _sentences

# kmath.js DRIFT_RULING.explore_min. The top of the chi band. Not an admit threshold.
CHI_BAND_MAX = 0.40
CITE = (
    "Gilligan Codex Vol IV §1.1.2, §3.2, §3.4, §6.1, §6.2; "
    "source/src/kmath.js DRIFT_RULING; source/src/dream_idle.js ChristPing is Gilligan-only; "
    "source/src/dream_idle.js resonancePacket"
)


def band_for(epsilon: float) -> str:
    """Nic's drift table. The admit gate is not this function."""
    eps = float(epsilon)
    if eps > float(THRESHOLDS["hard_stop"]):
        return "hard_stop"
    if eps >= CHI_BAND_MAX:
        return "quarantine"
    if eps > float(THRESHOLDS["drift_quarantine"]):
        return "chi"
    return "projectable"


def _resonate(web: str, admitted: str) -> dict[str, Any] | None:
    """A shared frame role, or a shared Doc 4 concept."""
    web_roles = _frame_roles(web)
    admitted_roles = _frame_roles(admitted)
    if web_roles and admitted_roles:
        for role in ("karta", "karma"):
            left = _norm_role(str((web_roles.get("filled") or {}).get(role) or ""))
            right = _norm_role(str((admitted_roles.get("filled") or {}).get(role) or ""))
            if left and left == right and web_roles.get("predicate") == admitted_roles.get("predicate"):
                return {"how": "frame_role", "role": role, "filler": left, "frame": web_roles.get("frame")}
    shared = sorted(_concept_ids(web) & _concept_ids(admitted))
    if shared:
        return {"how": "concept_lexicon", "concepts": shared}
    return None


def _ancestor_packet(row: dict[str, Any]) -> dict[str, Any]:
    packet = row.get("packet") if isinstance(row.get("packet"), dict) else None
    if packet and packet.get("Phi") is not None:
        return packet
    return place_packet(row, quarantined=False)


def _best(sentence: str, admitted: list[dict[str, Any]]) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]] | None:
    best = None
    for anc in admitted or []:
        if not isinstance(anc, dict) or _quarantined(anc):
            continue
        link = _resonate(sentence, clean_text(anc))
        if not link:
            continue
        packet = _ancestor_packet(anc)
        grace = _grace(packet, 9)
        if not grace.get("aligned"):
            continue
        drift = _drift_for(sentence, [{
            "id": anc.get("id") or anc.get("memory_id") or "ancestor",
            "text": clean_text(anc),
            "source": anc.get("source") or "admitted",
        }], ["Φ1"])
        eps = float(drift.get("epsilon_s") or 1.0)
        key = (round(eps, 6), str(anc.get("id") or anc.get("memory_id") or ""))
        if best is None or key < best[0]:
            best = (key, anc, link, drift)
    if not best:
        return None
    return best[1], best[2], best[3]


def _base(row: dict[str, Any], *, rule: str, ok: bool, band: str | None, drift: dict[str, Any] | None, link: dict[str, Any] | None, ancestor: dict[str, Any] | None, christping: bool, reason: str) -> dict[str, Any]:
    packet = place_packet(row if isinstance(row, dict) else {}, quarantined=True)
    anc_id = None
    if isinstance(ancestor, dict):
        anc_id = ancestor.get("id") or ancestor.get("memory_id")
    chi = (drift or {}).get("chi") if isinstance(drift, dict) else None
    return {
        "ok": ok,
        "rule": rule,
        "writes": False,
        "gate_eligible": False,
        "band": band,
        "packet": packet,
        "drift": {"epsilon_s": (drift or {}).get("epsilon_s"), "disposition": (drift or {}).get("disposition")} if drift else None,
        "chi": {"status": (chi or {}).get("status"), "owner": "gilligan"} if chi else None,
        "link": link,
        "role": link,
        "ancestor": anc_id,
        "christping_initiated": christping,
        "christping_owner": "gilligan",
        "ask_initiated": False,
        "calls_llm": False,
        "placed": None,
        "cite": CITE,
        "reason": reason,
    }


def connect_quarantine(question: str, row: dict[str, Any], admitted: list[dict[str, Any]]) -> dict[str, Any]:
    """Connect one quarantined excerpt. Does not write. Does not admit."""
    row = row if isinstance(row, dict) else {}
    text = clean_text(row)
    sentences = [s.strip() for s in _sentences(text) if str(s).strip()] or ([text] if text else [])
    found = None
    for sentence in sentences:
        hit = _best(sentence, admitted)
        if not hit:
            continue
        anc, link, drift = hit
        eps = float(drift.get("epsilon_s") or 1.0)
        if found is None or eps < found[0]:
            found = (eps, sentence, anc, link, drift)
    if found is None:
        return _base(
            row, rule="DREAM-QUARANTINE-NO-TRUTH", ok=False, band=None, drift=None, link=None, ancestor=None,
            christping=False,
            reason="no phase-aligned admitted ancestor, or the frame did not lock; quarantine stays evidence",
        )
    eps, sentence, anc, link, drift = found
    band = band_for(eps)
    if band == "hard_stop":
        out = _base(
            row, rule="GILLIGAN-HARD-STOP", ok=False, band=band, drift=drift, link=link, ancestor=anc,
            christping=True,
            reason="drift above 0.80. Gilligan records ChristPing. The excerpt is not placed and is not admitted.",
        )
        return out
    if band == "chi":
        return _base(
            row, rule="GILLIGAN-CHI", ok=False, band=band, drift=drift, link=link, ancestor=anc,
            christping=False,
            reason="drift is in the chi band. Gilligan holds the correction. Athena does not place it. Ask does not start ChristPing.",
        )
    if band == "quarantine":
        return _base(
            row, rule="DREAM-QUARANTINE-KEEP", ok=False, band=band, drift=drift, link=link, ancestor=anc,
            christping=False,
            reason="drift is in quarantine. Gilligan keeps it. It is not a premise.",
        )
    placed_sfe = {"Phi": 9, "eps": round(eps, 6), "mu": 1.0}
    packet = place_packet({"sfe": placed_sfe}, quarantined=False)
    anc_id = anc.get("id") or anc.get("memory_id")
    placed = {
        "id": "placed-" + str(row.get("id") or anc_id or "web"),
        "text": sentence,
        "sfe": packet["sfe"],
        "packet": packet,
        "quarantined": False,
        "anchor_placed": True,
        "anchor_ancestor_text": clean_text(anc),
        "source": "hosted",
        "provenance": {
            "question": question,
            "ancestor": anc_id,
            "link": link,
            "contributor": "athena",
            "gilligan": "connected",
            "band": band,
            "epsilon_s": round(eps, 6),
        },
        "contributor": "athena",
    }
    out = _base(
        row, rule="ATHENA-RESONANCE-PLACE", ok=True, band=band, drift=drift, link=link, ancestor=anc,
        christping=False,
        reason="Gilligan connected the excerpt to an admitted concept within drift. Athena placed the packet. The admit gate has not run.",
    )
    out["packet"] = packet
    out["placed"] = placed
    out["gate_eligible"] = True
    out["writes"] = False
    return out
