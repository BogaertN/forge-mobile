"""4.9.219 band tuning on the 144/n ladder. Nic's choice 2026-11-04 ("Combine them: Codex named bands with
edges on the 144 Hz divisions"; DRIFT-SPEC/v1 D15). Replaces the 4.9.218 +/- phase-offset tuning.

  Band. The phase alone picks the band: drift_policy.BAND_TABLE (Codex v2.5 names, edges on the 144/n ladder,
  Phi6 Grace keeps its 6-9 Hz blend, Phi9 is the 144 Hz carrier). Nothing else moves an item's band.

  Hz. The item tunes to a real Hz inside its band. Its words' 4.9.203 letter components (frequency_203, with the
  approved nudge span 0.45 * eps already applied to concept surfaces) give each component a place
  r = (hz - marker) / half-width, clamped to the approved OFFSET_CAP 0.40. Components whose marker lies inside the
  band are used ("in_band"); if none do, every component is used ("all_components"). The amplitude-weighted mean r,
  clamped again to 0.40, sets hz = centre + r * half-band toward the nearer edge, so hz never leaves the band.
  Two items in one band are "tuned together" when |hz_a - hz_b| / centre <= EPSILON (0.02).

  Cross band. Same band = 1.0. Different bands are harmonic when some 144/n marker m in one band has 3m (x3, 0.3)
  or 9m (x9, 0.1) in the other (PCI Appendix A M1: P432/P144 > 0.3, P1296/P144 > 0.1). Otherwise 0. The weight is a
  ranking key only: it never admits, never changes the pi/4 alignment, and never enters Echo.

All Hz are symbolic (FBSC), not measured (RMC 09.5). Pure functions of text and phase. No LLM, no network, no
randomness. Pyodide and CPython compute the same numbers.
"""
from __future__ import annotations

from typing import Any

from rmc_engine_v1.drift_policy import BAND_TABLE, BAND_TABLE_META
from rmc_engine_v1.frequency_203 import voronoi_half, word_signature
from rmc_engine_v1.frequency_203_config import EPSILON, NUDGE_SPAN, OFFSET_CAP
from rmc_engine_v1.frequency_204 import content_words

SCHEMA = "FORGE-BAND-TUNING/v1"
PLACES = 4
LABEL = "symbolic Hz (FBSC), not measured"
# The 144/n ladder: integer divisors of 144.
MARKERS = [144 // n for n in range(1, 145) if 144 % n == 0]
WEIGHTS = BAND_TABLE_META["harmonic_weights"]


def _clamp(value: float) -> float:
    return max(-OFFSET_CAP, min(OFFSET_CAP, value))


def band_of(phi: Any) -> int | None:
    """The phase alone picks the band. A decimal phase (4.9.217 packets) belongs to its integer phase."""
    if isinstance(phi, bool) or phi is None:
        return None
    if isinstance(phi, str):
        phi = phi.strip().lstrip("Φ")
    try:
        n = int(float(phi))
    except (TypeError, ValueError):
        return None
    return n if n in BAND_TABLE else None


def in_band(phase: int, hz: float) -> bool:
    row = BAND_TABLE[phase]
    if row["closed"]:
        return row["low"] <= hz <= row["high"]
    return row["low"] <= hz < row["high"]


def band_markers(phase: int) -> list[int]:
    return sorted(m for m in MARKERS if in_band(phase, float(m)))


def _components(text: str) -> list[dict[str, Any]]:
    out = []
    for word in content_words(text or ""):
        for comp in (word_signature(word).get("components") or []):
            if comp.get("master"):
                continue
            amp = float(comp.get("amp") or 0.0)
            band = int(comp["band"])
            half = voronoi_half(band)
            if amp <= 0 or half <= 0:
                continue
            out.append({"marker": band, "amp": amp, "r": _clamp((float(comp["hz"]) - band) / half)})
    return out


def tune(text: str, phi: Any) -> dict[str, Any]:
    """The item's band (from its phase) and its symbolic Hz inside that band."""
    phase = band_of(phi) or 1
    row = BAND_TABLE[phase]
    comps = _components(text)
    inside = [c for c in comps if in_band(phase, float(c["marker"]))]
    used, source = (inside, "in_band") if inside else (comps, "all_components" if comps else "none")
    den = sum(c["amp"] for c in used)
    r = _clamp(sum(c["amp"] * c["r"] for c in used) / den) if den > 0 else 0.0
    centre = row["centre"]
    reach = (row["high"] - centre) if r >= 0 else (centre - row["low"])
    hz = round(centre + r * reach, PLACES)
    return {
        "schema": SCHEMA,
        "phase": phase,
        "band": row["name"],
        "low": row["low"],
        "high": row["high"],
        "centre": centre,
        "hz": hz,
        "r": round(r, 6),
        "source": source,
        "components": len(used),
        "label": LABEL,
        "epsilon": EPSILON,
        "offset_cap": OFFSET_CAP,
        "nudge_span": NUDGE_SPAN,
        "calls_llm": False,
    }


PLACE_SCHEMA = "FORGE-FACT-PLACEMENT/v1"


def place(text: str, phi: Any, basis: dict[str, Any] | None = None) -> dict[str, Any]:
    """4.9.220: a fact's decimal phase. The integer is its content placement (lexicon concept, else letter resultant);
    the decimal is where its tuned Hz sits inside that band: Phi = band + (hz - low) / (high - low). The decimal stays
    inside its own band's sector, so band_of(Phi) gives the band back. Symbolic, not measured."""
    t = tune(text, phi)
    row = BAND_TABLE[t["phase"]]
    value = round(t["phase"] + (t["hz"] - row["low"]) / (row["high"] - row["low"]), PLACES)
    if value >= t["phase"] + 1:
        value = round(t["phase"] + 0.9999, PLACES)
    if value < t["phase"]:
        value = float(t["phase"])
    return {"schema": PLACE_SCHEMA, "Phi": value, "phase": t["phase"], "band": t, "basis": basis, "label": LABEL, "calls_llm": False}


def relation(a: Any, b: Any) -> dict[str, Any]:
    """Cross-band relation between two phases: same / x3 / x9 / none, with its ranking weight."""
    pa, pb = band_of(a), band_of(b)
    if pa is None or pb is None:
        return {"relation": "none", "weight": 0.0}
    if pa == pb:
        return {"relation": "same", "weight": WEIGHTS["same"]}
    ma, mb = band_markers(pa), band_markers(pb)
    for kind, factor in (("x3", 3), ("x9", 9)):
        if any(m * factor in mb for m in ma) or any(m * factor in ma for m in mb):
            return {"relation": kind, "weight": WEIGHTS[kind]}
    return {"relation": "none", "weight": WEIGHTS["none"]}


def together(a: dict[str, Any], b: dict[str, Any]) -> bool:
    """Same band and tuned within EPSILON of the band centre."""
    return a.get("phase") == b.get("phase") and abs(float(a["hz"]) - float(b["hz"])) / float(a["centre"]) <= EPSILON + 1e-12


def band_key(weight: float) -> int:
    """Integer ranking key so both runtimes sort alike."""
    return int(round(float(weight) * 10))
