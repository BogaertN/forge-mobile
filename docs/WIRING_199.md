# Wiring 4.9.199 — Geometry gates

Ask still calls `rmc_engine_v1.rmc_core.run` with `live: true`. C_min stays 0.87. Echo stays 0.85. The coherence formula in `measurement_kernel.coherence_components` is unchanged. No model is called. `dream_idle` and `economy` stay off. Letter packs stay gated. Money stays disabled. ChristPing stays Gilligan-only. Wikipedia stays low trust and is not an anchor.

The geometry stage is on the Ask trace. It does not persist and it does not change the admit gate. The RMC renderer that the map numbered 4.9.199 is now 4.9.200. It is not in this release.

## What is reused

`source/src/geometry_199.js` and `rmc_engine_v1/geometry_199.py` call the modules below. They do not copy those formulas.

| piece | owner |
|---|---|
| merge coefficients and the π/4 window | `kmath.merge` and `kmath.MERGE_WINDOW` |
| grace integral Θ | `kmath.graceIntegral` |
| Φ5→Φ8 detector | `kmath.luciferianDScore` / `chi_hardening.luciferian_d_score` |
| phase-6 order before naming and export | `manifest_compiler` phase-6 checks |
| C_min 0.87, Echo 0.85, write max 0.35, hard stop 0.8 | `drift_v43` laws |
| SHA-256 sealed loop | `dpa_195.sealLoop` / `seal_loop` |
| phase names Initiation through Recursion | `kmath.CANONICAL_PHASE_NAMES` |

RSOC names BLAKE3 for a merged id. The phone uses the existing SHA-256 substitute. A sever splits the remaining charge in half. The document's FFT power split is not a module in this tree.

## Gates

A seal needs all of these:

- the phase path returns to its start and the signed angle total is 2πn (Waking the Web l278)
- phase 6 is already on the path before naming (Φ7) or export (Φ8)
- the walk is not Φ5→Φ8, and not the extra Φ4→Φ8 flag
- drift is at or under 0.35, and not above the hard stop 0.8
- Echo is at or above 0.85, checked by the 4.9.195 seal

An open path is not sealed. A failing Echo is not sealed. ChristPing is not started.

## Operators

RSOC numbers are the ones that run. Unified Algebra forms are stored on each result with `applied: false`. UA constants were never given numbers.

- Merge is lawful only when δ ≤ π/4 and the χ flags match. A rejected merge adds 0.07 ε to each side. The cos(ΔΦ/2) abort above π/2 is a log-only warning.
- Sever adds 0.15 to Δ, sets ν to −|ν|, removes 0.08 from μ, and adds 0.12 to ε.
- Amplify uses k in [1, 2]. μ becomes kμe^(−2.2|Δ|). ε rises by 0.09(k−1)². The UA sign that lowers ε is not used.
- Discharge sets Δ and ν to 0 and multiplies ε by 0.3. μ stays. The UA step that sends μ to 0 is not used. Echo E = μe^(−1.8ε)cos Φ.
- Lock needs both χ flags clear and predicted ε_s under 0.6. That 0.6 cut does not admit.
- χ fires at ε_s ≥ 0.8 with the echo trace, χ clear, and |ΔΦ| ≤ π/3. Θ reuses the grace integral. ε becomes ε(1−Θ/μ), μ gains Θ, and ν becomes 1.4.
- Advance needs H ≥ 0.65 and ε_s < 0.7. Those cuts are internal.
- Memory's code step is 0.5H² − 0.02μ. UA memory M = e^(−λt)∫A·C dt has no λ, so M stays unparameterized.
- SPC μ(t+1) = μ − λΔ² uses λ = 0 unless a caller supplies λ. The default is log-only.

The charge ledger keeps live μ plus residue equal to the initial μ plus created charge. Phase 9's |Δμ| ≤ 0.003 band is reported. It does not replace the ledger. UA's exact ΣO(μ) = 0 is recorded and does not run.

M and V_c are axes. V_c ≥ 0.3 is an internal seeding check. It does not admit.

## Screen

The Ask tab has a Geometry gates card under the Lexicon Growth card. Open loop, Closure, Charge, Membrane, and Operators run on the local module. The card does not call a model and it does not write the admit bank. The Ask trace adds `geometry_199`. `admit_gate` on that line stays false. `persisted` on that line stays false.

## Cold admits

The 60-question table is `docs/LIVE_TEST_199.md`.

No Supabase migration is added. Nothing is applied to a hosted database. The seal in the card is local to the demo script.
