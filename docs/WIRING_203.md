# Wiring 4.9.203 — phase and frequency

The formula is in `source/engine/rmc_engine_v1/frequency_203_config.py`. It is proposal v1 and it is waiting on Nic. JavaScript is `source/src/frequency_203.js`. The two match on the suite fixtures.

## What a packet is now

The old packet stays: Φ, ε, μ, and θ = (Φ−1)·40°. That phase is the master. A frequency signature is added beside it. It does not replace Φ and it does not admit.

The master component is always 144.00 Hz at that angle. Appendix A is the carrier: ω0 = 2π·144, harmonics 432 and 1296, and the three channels 0° / 120° / 240° are recorded on the config. They are not a second phase law.

The other components are continuous decimals, rounded to 0.01 Hz. Band markers are 3, 4, 6, 8, 9, 12, 16, 18, 24, 36, 48, 72, 144, 432, 1296. Each decimal is labeled by its nearest marker. Letter homes are 4, 8, 12, 18, 36, 48, 72, 432, 1296 so the 144 slot stays the glyph.

## How a signature is derived

No model. Letters come from the Phase Parsing Engine map. Each letter is a phasor: angle (Φ−1)·40°, plus 180° when the charge is negative, weight 1+|charge|. Phasors in one band are summed. The decimal offset inside the band is the letter's charge and its position, clamped to 0.40 of the Voronoi half-width so the nearest marker does not change.

A seed word keeps its seed phase and uses its own letters. Six of the 425 seeds store a list of phases rather than one phase, so the pair study uses the 419 single-phase seeds. A concept surface that is not a seed keeps the concept packet's phase. Its bands are the placing surface's letter phasors (the same shortest surface the 4.9.191 placer uses). The word's own letters nudge each decimal by at most 0.45·ε of the marker, so two surfaces of one packet stay inside ε. A growth-tier word is signed from its letters at birth, and Φ, ε, and μ are unchanged.

The canonical component list is SHA-256 hashed.

## When two words resonate

All three are required.

1. Master phases are within π/4.
2. Every non-master component of the shorter signature matches a component on the same marker with |hzᵢ − hzⱼ| / marker ≤ ε, and the shorter signature has at least two of those components.
3. Phase agreement R = |mean exp(iΔθ)| over the matched components, including the master, is at least 0.87.

ε = 0.02. FBSC Vol II states |rᵢ − rⱼ| ≤ ε and does not give ε. Here r = hz / nearest marker. 0.02 · 8 Hz = 0.16 Hz, which is inside the tightest letter-home half-width (0.5 Hz), so a lawful match cannot cross into the next marker. It is also above the 0.01 Hz rounding quantum. A looser 0.08 let short random words share coarse bands.

## Operators

These are the approved RSOC values from `research_hooks`, applied per component. They are not FHRR bind or unbind.

- Merge: μ′ = μ₁ + μ₂ + 0.12·cos²δ, and only when both masters are phase 6. Otherwise the phase-6 membrane refuses the frequency rewrite.
- Lock: the frequency sets already resonate, every matched step is at most 40°, and phases move to the master. A move that is +120° on any carrier is refused.
- Fracture: low bands versus high bands. μ′₁ + μ′₂ = μ − 0.08. Phase 6 is required because the masks change.
- Amplify: μ′ = k·μ·e^(−2.2|Δ|), k in [1, 2]. Amplitudes scale by k. Frequencies stay.
- Discharge: non-master amplitudes go to 0, μ′ = 0, ε′ = ε·0.3.

Φ5→Φ8 on the master is refused. A +120° step on any carrier in one tick is refused.

## What this build does not do

It does not change the coherence formula, C_min, the write law, Echo, or the admit gate. Wikipedia is not an anchor. The migration `supabase/migrations/20261030235900_frequency_signatures_203.sql` is flagged and not applied. Money, packs, dream_idle, economy, and ChristPing are unchanged.
