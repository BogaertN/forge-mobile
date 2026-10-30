# Wiring 4.9.196 — storage tiers

Ask still calls `rmc_engine_v1.rmc_core.run` with `live: true`. C_min stays 0.87. Echo stays 0.85. The coherence formula in `measurement_kernel.coherence_components` is unchanged. No model is called. `dream_idle` and `economy` stay off. Letter packs stay gated. Money stays disabled. ChristPing stays Gilligan-only. Wikipedia stays low trust and is not an anchor.

## What is reused

`source/src/tiers_196.js` and `rmc_engine_v1/tiers_196.py` call the 4.9.191 charge, the 4.9.191 seven gates, and the 4.9.195 archive. They do not copy those formulas.

| piece | owner |
|---|---|
| C = C0 · e^(−λt), half-life 168 h | `genesis_collapse.spcCharge` / `spc_charge` |
| active when charge is above 0.1, collected when charge is below 0.05 | `spcActive` / `spcGc` |
| seven-gate resurrection | `phaseCoherentResurrection` / `phase_coherent_resurrection` |
| a dead path, the rewrite refusal, and the hash chain | `dpa_195` |
| C_min 0.87 and Echo 0.85 | `drift_v43` law constants |
| phase names Initiation through Recursion | the archive phase name on a seal |

## Ladder

PMA §6. One simulated clock. The charge starts at 1.

| hours | charge | tier |
|---|---|---|
| 0 | 1, still active | Hot. Active runtime. Not storage. |
| 168 | one half-life, still active | Warm (SPC) |
| 600 | not active, not collected | Cold |
| 800 | collected | Deep ghost loop |

A later hour that is earlier than the clock is `TIER-CLOCK-REWIND`. An erase is `TIER-ERASE-REJECTED`. A second place of the same id is `TIER-REWRITE-REJECTED`. The lawful row at 800 hours is `DPA-NOT-DEAD`. Drift 0.55 stays Hot on this clock. The Codex 0.5 SPC cut is logged and does not choose the tier.

## Resurrection

Warm and Cold call the seven gates. All seven must pass. The passing record is phase 9, noise below the χ threshold, not under active drift, an identity, a valid resurrection log, a cycle count under the limit, and capacity. A phase of 8 fails `phase_timing_phi9`. A missing capacity fails `capacity`.

Deep ghost does not re-enter. The seven gates still run, and the rule is `TIER-DEEP-NO-REENTRY`. Hot is already active, so it is `TIER-HOT-ACTIVE`.

Codex cuts 0.3, 0.5, and 0.6 stay on the report as internal. They do not admit and they do not move a tier.

## Dead path

A row with drift 0.36 is a dead path at Hot and is not a write. At 800 hours the archive appends it once. A second hour is `DPA-REWRITE-REJECTED`. The chain still verifies. The phase name is Initiation. Drift 0.35 reaches Deep ghost and is `DPA-NOT-DEAD`. Φ5→Φ8 is a dead path on the same ladder and seals as Power. Drift 0.8 is a dead path and is not a hard stop. Drift above 0.8 is a hard stop. Nothing here writes memory.

## Screen

The Ask tab has a Storage tiers card. It shows the clock, the seven gates, and the deep seal. It does not call a model and it does not write memory. The Ask trace adds `tiers_196` beside the archive line. `admit_gate` on that line stays false.

## Cold admits

The 60-question table was run three times. Cold admits stay 48 of 60, the same 48 as 4.9.195. The three passes agree. The table is `docs/LIVE_TEST_196.md`.

No Supabase migration is added. Nothing is applied to a hosted database.
