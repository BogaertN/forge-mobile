# Wiring 4.9.197 — Phase Parsing Engine lexicon

Ask still calls `rmc_engine_v1.rmc_core.run` with `live: true`. C_min stays 0.87. Echo stays 0.85. The coherence formula in `measurement_kernel.coherence_components` is unchanged. No model is called. `dream_idle` and `economy` stay off. Letter packs stay gated. Money stays disabled. ChristPing stays Gilligan-only. Wikipedia stays low trust and is not an anchor.

The letter map assigns a packet and a phase. It does not match keywords for recall or admission. `admit_gate` on the lexicon line stays false.

## What is reused

`source/src/ppe_lexicon_197.js` and `rmc_engine_v1/ppe_lexicon_197.py` call the 4.9.191 lexicon and the 4.9.193 charge meter. They do not copy those tables or that formula.

| piece | owner |
|---|---|
| 425 seed words and the KPI A–Z letter map | `resonance_lexicon.js` / `lexicon_resonance.py` |
| θ = (Φ−1)·40° | `kmath.phaseAngleDegrees` / `lexicon_resonance.angle_degrees` |
| population σ for the proposal μ | `kmath.std` |
| glyph for a phase | Phase Glyph Codex `profile` / `phase_profile` |
| +0.1 lawful step, −0.3 skip, clamp 0–1 | `drift_v43.chargeStep` / `charge_step` |
| phase names Initiation through Recursion | `kmath.CANONICAL_PHASE_NAMES` / `drift_v43.PHASE_NAMES` |

The 4.9.191 seed file is not retagged. `proposalV1Count()` stays 0. The proposal lives on the 4.9.197 packet.

## Letter map

The Phase Parsing Engine KPI table is the map. HarperScript's visual manifest is loaded read-only from `harper_visual_manifest_v1.json`. It does not place a letter.

M is charge −2 on the table. The JSON example says −1. The flag is `KPI-M-CHARGE`. The table value is the one used. The worked example "transform" prints charge +3, which is the sum when M is −1. With the table, the sum is +2. That example is flagged and not used.

Eleven letters differ in phase from the visual manifest: K, M, O, P, Q, R, S, T, U, V, X. M in the manifest is Φ5→Φ8. The KPI phase stays Φ5.

## Proposal v1

On every seed, and on a letter-placed word:

- ε is the share of letters whose KPI `drift_flag` is set, weighted by the absolute KPI charge, clamped 0–1. A morpheme drift list is not stated, so the letter flags are the list. READ192 §3. READ_NEW_PDFS §B says Unified Algebra gives no word ε or μ.
- μ = 1 − σ(letter phase indexes) / 9, clamped 0–1. σ is the population standard deviation.
- The tag is `proposal v1`.
- Birth state stays beside it: ε₀ = 0, μ_init = 1.0. RSOC Phase 1, READ192 lines 2719 and 2960.

θ is labeled derived from Breadboard. The angle in degrees is (Φ−1)·40.

## Word roles and drift signatures

WLM roles follow the HarperScript table, READ192 §4. Excess Φ5, counted as three or more, with no Φ6, is a Drift Carrier. `remember` is that role. The example label "Drift Marker / Memory Capsule" is not used. The stability rating 3.2 has no formula and is not used. Precedence is not stated in the document. The table order is used, with Drift Carrier before Growth Under Pressure.

DDS signatures are logged. The documented reactions name ChristPing and cold storage. This module does not start ChristPing and does not write cold storage. Identity Suppression is the "over time" signature, so one word does not fire it.

A letter walk from Φ5 to Φ8 is flagged. It does not admit. The categorical hard fire stays in `drift_v43`.

The drift-word examples are try, maybe, and deserve. The coherent-word examples are create, reflect, and name. Membership tags the word. It does not admit it.

The PCM worked sum of +8 is not used. The phase-energy schedule in that example is incomplete. The word meter calls `charge_step`.

## Screen

The Ask tab has a Phase Parsing Engine card above the trace. Word packets shows sky, leaves, and ocean with phase, glyph, angle, ε, and μ. Harper diff shows the M flag and the eleven conflicts. Drift signatures shows remember and the Φ5→Φ8 flag. The card does not call a model and it does not write memory. The Ask trace adds `ppe_197`. `admit_gate` on that line stays false.

## Cold admits

The 60-question table is `docs/LIVE_TEST_197.md`.

No Supabase migration is added. Nothing is applied to a hosted database.
