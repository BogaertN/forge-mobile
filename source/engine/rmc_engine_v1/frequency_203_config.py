"""4.9.203 frequency signature config. One module. Proposal, not canon.

Nic's Appendix A is the carrier. The per-word decimals are a proposal.
This module does not admit, does not parse a sentence, and does not call a model.

DOC (Appendix A, FBSC handoff, PCI):
  ω0 = 2π · 144 Hz. Harmonics ω1 = 3ω0 = 432 Hz and ω2 = 9ω0 = 1296 Hz.
  Each of those bands has three phase channels at 0°, 120°, and 240°.
  The glyph master phase is the existing packet phase, θ = (Φ−1)·40°.
  FBSC Vol II states the continuity rule |rᵢ − rⱼ| ≤ ε and does not give ε.
  FBSC gives no per-word Hz formula. Symbolic Fluid Memory names a harmonic
  signature and does not give a formula either.

PROPOSAL v1, awaiting Nic:
  Band markers are the 144/n subharmonics that land on integers, plus 432 and 1296.
  A word carries K=9 components {hz, phase, amplitude}. Hz is a continuous
  decimal (hundredths, like a radio station), not an integer harmonic.
  The 144 Hz slot always holds θ = (Φ−1)·40° and is never overwritten by a letter.
  Every other decimal belongs to the band of its nearest marker.
  Letters come from the Phase Parsing Engine map. Each letter is a phasor.
  Phasors in one band are summed. The decimal offset inside that band comes
  from the letter's charge and its position. The result is a pure function of
  the letters and the existing master phase, and the canonical component list
  is SHA-256 hashed.

  A lexicon surface that is not itself a seed word keeps the concept packet's
  master phase. Its bands are the placing surface's letter phasors (the same
  shortest surface the 4.9.191 placer uses when the concept has no seed phase).
  The surface's own letters nudge each decimal by at most 0.45·ε of the marker,
  so two surfaces of one packet stay inside ε and a foreign word does not
  inherit the bands.

  Resonance requires all three:
    1. master phases within π/4
    2. every non-master component of the shorter signature matches a component
       on the same marker with |hzᵢ − hzⱼ| / marker ≤ ε, and the shorter
       signature has at least two non-master components
    3. phase agreement R = |mean exp(iΔθ)| over the matched components ≥ 0.87

  ε = 0.02 on r = hz / nearest marker.
  Why this number: FBSC states the rule and no value. The letter offset is
  clamped to 0.40 of the Voronoi half-width, so a component cannot change
  marker. The tightest half-width on a letter home is 0.5 Hz (the 8 Hz and
  9 Hz cells). 0.02 · 8 Hz = 0.16 Hz, which is inside that half-width, so a
  lawful match cannot cross into the next marker. The hundredth-Hz quantum
  is 0.01/144 ≈ 7e-5, and ε sits well above that quantum and well below 1.
  A wider gate (0.08) let random short words share coarse bands. 0.02 is the
  gate this build measures.

RSOC operators, per component, use the approved research_hooks values.
They are not FHRR bind or unbind. Merge rewrites frequencies only while the
master phase is 6. A +120° step on any carrier in one tick is refused, and
so is master Φ5→Φ8.
"""
from __future__ import annotations

import math

PROPOSAL = "proposal v1"
AWAITING = "Nic"
STATUS = "proposal"

# Appendix A master and the integer 144/n ladder plus the two overtones.
MASTER_HZ = 144.0
OMEGA0 = 2.0 * math.pi * MASTER_HZ
HARMONIC_432 = 432.0
HARMONIC_1296 = 1296.0
BANDS = [3, 4, 6, 8, 9, 12, 16, 18, 24, 36, 48, 72, 144, 432, 1296]
# Letter homes. 144 is reserved for the glyph master, so it is not a letter home.
# Each home is a band marker: 144/n or an Appendix A overtone.
HOME = {1: 4, 2: 8, 3: 12, 4: 18, 5: 36, 6: 48, 7: 72, 8: 432, 9: 1296}
PHASE_CHANNELS_DEG = [0, 120, 240]
K = 9
K_LETTERS = 8
MASTER_STEP_DEG = 40
C_AGREE = 0.87
MASTER_WINDOW = math.pi / 4
# FBSC Vol II |r_i - r_j| <= ε. ε is not in the doc. See the module docstring.
EPSILON = 0.02
OFFSET_CAP = 0.40
NUDGE_SPAN = 0.45
MIN_LETTERS = 2
JUMP_DEG = 120.0
JUMP_TOL_DEG = 0.5
MEMBRANE_PHASE = 6
HASH_PLACES_HZ = 2
HASH_PLACES_DEG = 4
HASH_PLACES_AMP = 4

CITE = (
    "Appendix A ω0=2π·144, harmonics 432 and 1296, channels 0/120/240. "
    "Glyph master θ=(Φ−1)·40° is the existing packet phase. "
    "FBSC Vol II |r_i−r_j|≤ε with ε unspecified; this module sets ε=0.02 on hz/marker. "
    "Letter phasors are the Phase Parsing Engine map. The decimal offset is proposal v1, awaiting Nic. "
    "RSOC coefficients are research_hooks (merge 0.12, fracture 0.08, amplify 2.2, discharge 0.3). "
    "Not FHRR. No LLM."
)
