"""4.9.204 frequency-tuning constants. Proposal, not canon.

Spelling (4.9.203) fixes each word's starting decimals. This module only
moves frequency offsets. The glyph master phase is not a tuning variable.

DOC, used as the force, not re-derived:
  Merge bonus ζ = 0.12 and δ is the master-phase difference (RSOC merge).
  Distance decay is the amplify law μ' = k μ e^(−β|Δ|) with β = 2.2.
  Fracture severance σ = 0.08 is the repulsion scale.
  SPC decay is C(t) = C0 e^(−λt), λ = ln2 / 168 h.

PROPOSAL v1, awaiting Nic:
  Attraction and repulsion are those operators applied to hertz offsets.
  A weak spacing term keeps the field from stacking every word on one Hz.
  ε, C_min, Echo, and the coherence formula are not retuned here.
"""
from __future__ import annotations

PROPOSAL = "proposal v1"
AWAITING = "Nic"
STATUS = "proposal"

# RSOC. Read back from research_hooks at runtime; these are the same numbers.
ZETA = 0.12
BETA = 2.2
SEVER = 0.08
# Weak next to ζ. Long-range spacing is only between active words that are
# not attracting on this tick.
KAPPA = 0.004
# Preferred separation, as a fraction of ε·marker. Inside this gap the
# spacing spring uses ζ and pushes outward, so a pair can still sit inside
# the ε match and a clique cannot stack on one hertz.
EQ_FRACTION = 0.5
HALF_LIFE_HOURS = 168.0
MEMBRANE_PHASE = 6
HASH_PLACES = 6

# Closed class for "which tokens sat in the admitted sentence".
# This list does not admit, rank, or reject an answer.
FUNCTION_WORDS = frozenset(
    """
    a an the and or of to in on for with from by as at into over
    is are was were be been being it its this that these those
    than then so if but not no nor you your we our they them their
    he she his her what which who how when where why does did do
    """.split()
)

CITE = (
    "RSOC merge μ' = μ1+μ2+0.12·cos²δ, δ = master-phase difference. "
    "Amplify decay e^(−2.2|Δ|). Fracture severance 0.08. "
    "SPC half-life 168 h, λ = ln2/168. "
    "Glyph master θ=(Φ−1)·40° is not moved. "
    "Frequency offsets are proposal v1, awaiting Nic. Not FHRR. No LLM."
)

MATH = """
Let h_u and h_v be the current effective hertz on one shared band marker m.
Δ = (h_u − h_v) / m
δ = circular distance between the two glyph master phases, in radians.
The glyph phases are inputs. Tuning does not write them.

Attraction, only when δ ≤ π/4 and the tuning tick is phase 6:
  Δh_u = ζ · cos²(δ) · e^(−β|Δ|) · (h_v − h_u)
  ζ = 0.12, β = 2.2

Repulsion, for a refuted pair, a Φ5↔Φ8 pair, or a phase-6 membrane violation:
  Δh_u = −σ · e^(−β|Δ|) · (h_v − h_u)
  σ = 0.08

Long-range spacing, for every other word in this tick on that band that is not attracting.
A word tuned earlier is not pushed again merely because a new sentence arrived:
  Δh_u += κ · e^(−β|Δ|) · (h_u − h_v)
  κ = 0.004
Short-range spring, whenever |h_u − h_v| ≤ d_eq and d_eq = 0.5·ε·m:
  the attract step is replaced by an outward push
  Δh_u = ± ζ · e^(−β|Δ|) · (d_eq − |h_u − h_v|)
  A tie (equal hertz) breaks toward the later word in alphabetical order.
  d_eq is inside the ε match, so a lawful pair can resonate without sharing one hertz.

A stored pull of size Δh at age t hours weighs
  w(t) = e^(−ln2 · t / 168)
The effective offset is the sum of applied pulls times w(t).
Retracting an admit drops every pull that cites that admit.

Step drift D is the largest |Δh| / Voronoi half-width on that tick.
D ≥ 0.8 writes nothing (χ, hard stop).
D > 0.35 scales the tick by 0.35/D and sets χ. The written drift is 0.35.
D ≤ 0.35 writes the tick.
The 144 Hz component is copied through unchanged.
"""
