"""4.9.218 continuous question tuning on the 9 / 144 dial. Nic approved ("Build that", pt125u, 2026-11-01).

The integer phase picks the band, the decimal tunes inside it, like a radio dial.

  Band. The question's band is the integer phase the engine already reads (the lexicon placement of the asked
  concept, else the phase parser's top phase). One band is 40° of the dial (2π/9; 144/9 = 16 Hz per phase,
  FBSC Handoff v2 §5.1). Nothing here changes which band a question is in.

  Decimal. Every content word of the question carries its 4.9.203 frequency signature: K=9 components on the
  Appendix A markers (144/n, 432, 1296), each a continuous decimal Hz inside its marker's Voronoi cell. A
  component's place in its cell is r = (hz − marker) / half-width. Its letter offset is clamped to OFFSET_CAP = 0.40
  of the half-width, and a concept surface's own letters nudge it by at most NUDGE_SPAN·ε = 0.45 · 0.02 of the
  marker. The question's tuning is the amplitude-weighted mean r over all of its words' letter components,
  clamped again to ±OFFSET_CAP, and placed on the dial as offset = r · ½ band. So the decimal is at most
  ±0.20 of a phase (±8°) and never leaves the band (RSOC Calculus Axiom 2: Φ is real; lawful progression stays on
  the 1–9 cycle).

  Constants (unchanged from the 4.9.203 / 4.9.204 proposal, now Nic-approved): ε = 0.02 on hz/marker,
  offset cap 0.40, nudge span 0.45. They are imported from frequency_203_config, not restated.

General only: a pure function of the question's letters and its band. No list of questions, no word list beyond
the 4.9.204 function words. No LLM, no network, no randomness. Pyodide and CPython compute the same numbers.
The tuned phase is used by the resonance lookup (rank_memory): the π/4 window and grace = rpm · cos²δ read the
continuous gap. Ask's ε (/3), the definition-first rank and the relation Echo are not touched.
"""
from __future__ import annotations

import math
from typing import Any

from rmc_engine_v1.frequency_203 import voronoi_half, word_signature
from rmc_engine_v1.frequency_203_config import EPSILON, NUDGE_SPAN, OFFSET_CAP
from rmc_engine_v1.frequency_204 import content_words

SCHEMA = "FORGE-QUESTION-TUNING/v1"
BAND_HALF = 0.5  # half of one phase band, in phase units (20° of the 40° band)
PLACES = 4
APPROVED = "Nic, pt125u, 2026-11-01"
CITE = (
    "Band = integer phase (40°, 144/9 = 16 Hz). Decimal = amplitude-weighted mean place r of the question words' "
    "4.9.203 components in their Appendix A marker cells, |r| ≤ 0.40 (offset cap), nudge ≤ 0.45·ε, ε = 0.02; "
    "dial offset = r·½ band (≤ ±0.20 phase, ±8°). RSOC Calculus Axiom 2. Nic-approved 4.9.218."
)


def _clamp(value: float) -> float:
    return max(-OFFSET_CAP, min(OFFSET_CAP, value))


def word_place(word: str) -> dict[str, Any] | None:
    """The word's place inside its bands: amplitude-weighted mean r over its letter components."""
    sig = word_signature(word)
    num = 0.0
    den = 0.0
    for comp in sig.get("components") or []:
        if comp.get("master"):
            continue
        band = int(comp["band"])
        half = voronoi_half(band)
        if half <= 0:
            continue
        amp = float(comp.get("amp") or 0.0)
        if amp <= 0:
            continue
        num += amp * _clamp((float(comp["hz"]) - band) / half)
        den += amp
    if den <= 0:
        return None
    return {"word": word, "r": round(num / den, 6), "amp": round(den, 6), "source": sig.get("source")}


def tune(question: str, band: int) -> dict[str, Any]:
    """The question's continuous phase: its band plus the decimal its own words tune to."""
    band = int(band) if isinstance(band, int) and 1 <= band <= 9 else 1
    places = [p for p in (word_place(w) for w in content_words(question or "")) if p]
    den = sum(p["amp"] for p in places)
    r = _clamp(sum(p["amp"] * p["r"] for p in places) / den) if den > 0 else 0.0
    offset = round(BAND_HALF * r, PLACES)
    phi = band + offset
    # The dial is a circle: Φ1 − 0.2 is the same point as Φ9.8 ((Φ−1)·40° = −8° = 352°).
    if phi < 1.0:
        phi += 9.0
    phi = round(phi, PLACES)
    if float(phi).is_integer():
        phi = int(phi)
    return {
        "schema": SCHEMA,
        "band": band,
        "offset": offset,
        "Phi": phi,
        "degrees": round(((band - 1) * 40.0 + offset * 40.0) % 360.0, PLACES),
        "r": round(r, 6),
        "words": [p["word"] for p in places],
        "epsilon": EPSILON,
        "offset_cap": OFFSET_CAP,
        "nudge_span": NUDGE_SPAN,
        "approved": APPROVED,
        "calls_llm": False,
        "cite": CITE,
    }
