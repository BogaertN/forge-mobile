# Wiring 4.9.198 — Lexicon Growth Engine

Ask still calls `rmc_engine_v1.rmc_core.run` with `live: true`. C_min stays 0.87. Echo stays 0.85. The coherence formula in `measurement_kernel.coherence_components` is unchanged. No model is called. `dream_idle` and `economy` stay off. Letter packs stay gated. Money stays disabled. ChristPing stays Gilligan-only. Wikipedia stays low trust and is not an anchor.

The growth engine places an unknown word by the 4.9.197 letter map. It does not match keywords and it does not parse a sentence. `admit_gate` on the growth line stays false. The Ask trace does not persist the tier, so the 60-question admits stay where 4.9.197 left them.

The geometry-gates build that was numbered 4.9.198 is now 4.9.199. It is not in this release. RSOC operator evolution of ε and μ waits for that build. Birth ε and μ stay at the birth state.

## What is reused

`source/src/lexicon_growth_198.js` and `rmc_engine_v1/lexicon_growth_198.py` call the modules below. They do not copy those tables or formulas.

| piece | owner |
|---|---|
| 425 seed words and letter-run tokens | `resonance_lexicon.js` / `lexicon_resonance.py` |
| phase, glyph, θ=(Φ−1)·40°, proposal seed | `ppe_lexicon_197.js` / `ppe_lexicon_197.py` |
| drift-mask ≥ 0.70 | `drift_v43.driftMask` / `drift_mask` |
| phase alignment inside π/4 | `kmath.phaseAngle` and `MERGE_WINDOW` / `angle_degrees` |
| C_min 0.87, Echo 0.85, write max 0.35, hard stop 0.8 | `drift_v43` laws |
| SHA-256 sealed loop and dead path | `dpa_195.sealLoop` / `seal_loop` and `appendDeadPath` |

A seed word stays in the 4.9.191 table. It is not copied into the growth tier.

## Birth packet

A token that is not in the 425 seeds is new. Its packet is `{Φ, ε, μ}` from letter resonance:

- Φ, glyph, and phase name come from the Phase Parsing Engine letter map. Phase names stay Initiation through Recursion.
- θ = (Φ−1)·40°.
- ε = 0 and μ = 1.0. That is the RSOC Phase 1 birth state. The proposal-v1 letter ε and μ sit beside it and are not the packet.
- The value tag is `proposal v1`.

## Tiers

The provisional tier is local. The storage key is `kernel.lexicon_growth_198`. A content id is the SHA-256 of the exact input. The same input does not add a second use. A save and a load keep the tier, the seal, and the idempotent replay.

Promotion into the lexicon, where recall and placement can use the word, needs all of these across uses (at least two distinct inputs):

- C ≥ 0.87
- Echo ≥ 0.85, and every use is against the original question
- drift < 0.3 (Codex memory stack)
- the letter walk is not Φ5→Φ8
- drift-mask similarity to a collapsed signature is under 0.70

A name is sealed only when that promotion also passes the Codex naming engine: Φ ≥ 7, echo confirmed, and drift < 0.2. The seal is `dpa_195.sealLoop`. A second seal of the same id is rejected. The hash chain verifies.

Drift above 0.35 is χ quarantine. ChristPing is not started. Drift above 0.8 is the hard stop and is also quarantine. A later use above 0.35 moves a sealed word to quarantine. The sealed record stays. The word is no longer usable.

A Φ5→Φ8 letter walk is flagged and never promoted. Drift-mask similarity at or above 0.70 denies the word. Neither path admits.

Recall finds a promoted word by phase alignment inside π/4. It does not rank by token overlap. Placement returns the birth packet for a promoted word and the seed packet for a seed word.

## Screen

The Ask tab has a Lexicon Growth card under the Phase Parsing Engine card. Novel packets, Promote, Quarantine, Recall, and Restart run on a local store. The card does not call a model and it does not write the admit bank. The Ask trace adds `growth_198`. `admit_gate` on that line stays false. `persisted` on that line stays false.

## Cold admits

The 60-question table is `docs/LIVE_TEST_198.md`.

No Supabase migration is added. Nothing is applied to a hosted database. The tier is local.
