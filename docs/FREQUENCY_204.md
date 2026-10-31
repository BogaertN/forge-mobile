# Frequency tuning — 4.9.204

Proposal v1, awaiting Nic. This note is the math the code runs. It does not change ε, C_min, Echo, or the coherence formula.

Spelling, from 4.9.203, fixes each word's starting decimals on the band markers 3, 4, 6, 8, 9, 12, 16, 18, 24, 36, 48, 72, 144, 432, 1296. The 144 Hz slot is the glyph master: θ = (Φ−1)·40°. Tuning never writes that slot and never writes Φ.

## Force

For two words on one shared marker m, with current effective hertz h_u and h_v:

Δ = (h_u − h_v) / m

δ is the circular distance between the two glyph master phases, in radians. Those phases are inputs.

Attraction, only when δ ≤ π/4 and the tuning tick is phase 6:

Δh_u = 0.12 · cos²(δ) · e^(−2.2|Δ|) · (h_v − h_u)

0.12 is the RSOC merge bonus. 2.2 is the RSOC amplify decay. This is not an FHRR bind.

Repulsion, for a refuted pair, a Φ5↔Φ8 pair, or a pair that tried to tune outside phase 6:

Δh_u = −0.08 · e^(−2.2|Δ|) · (h_v − h_u)

0.08 is the RSOC fracture severance.

Long-range spacing, between words in this tick that are not attracting. Words tuned by an earlier admit are not pushed again just because a new sentence arrived:

Δh_u += 0.004 · e^(−2.2|Δ|) · (h_u − h_v)

Short-range spring, when |h_u − h_v| ≤ d_eq and d_eq = 0.5 · ε · m, with ε = 0.02:

the attract step is replaced by an outward push of size 0.12 · e^(−2.2|Δ|) · (d_eq − |h_u − h_v|).

A tie breaks toward the later word in alphabetical order. d_eq sits inside the ε match, so a lawful pair can resonate without every word landing on one hertz.

## Step law

D is the largest |Δh| divided by that band's Voronoi half-width.

- D ≥ 0.8 writes nothing. χ is set. That is the hard stop.
- D > 0.35 scales the tick by 0.35/D and sets χ. The written drift is 0.35.
- D ≤ 0.35 writes the tick.

The answer's own drift is a separate gate. Above 0.35 the tuning write is quarantined. At or above 0.8 it is a hard stop. C below 0.87 or Echo below 0.85 does not tune. Wikipedia and Wikimedia do not tune.

## Memory

A stored pull of size Δh at age t hours weighs e^(−ln2 · t / 168). The effective offset is the sum of applied pulls times that weight. Each pull records the admit id. Retracting that id drops the pull, and the offset returns to what the other pulls still support.

Phase 6 gates every write. A tick at any other phase files a membrane violation and writes no offset. The next phase-6 tick repels that pair. Φ5→Φ8 is refused. The requested phase is not stored.

The constants are `source/engine/rmc_engine_v1/frequency_204_config.py`. The field is `frequency_204.py`. JavaScript is `source/src/frequency_204.js`.
