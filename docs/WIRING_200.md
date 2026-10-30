# Wiring 4.9.200 — RMC renderer

Ask still calls `rmc_engine_v1.rmc_core.run` with `live: true`. C_min stays 0.87. Echo stays 0.85 against the original question. The coherence formula in `measurement_kernel.coherence_components` is unchanged. No model is called. `dream_idle` and `economy` stay off. Letter packs stay gated. Money stays disabled. ChristPing stays Gilligan-only. Wikipedia stays low trust and is not an anchor.

The renderer stage is on the Ask trace. It does not persist and it does not change the admit gate. The map section labelled 4.9.199 is this release.

## What is reused

`source/src/rmc_renderer_200.js` and `rmc_engine_v1/rmc_renderer_200.py` call the modules below. They do not copy those formulas.

| piece | owner |
|---|---|
| Echo coverage of the original question | `echo_question.echo_against_question` |
| sentence packets, phase names, glyphs | `ppe_lexicon_197.word` |
| Φ5→Φ8 detector | `kmath.luciferianDScore` / `chi_hardening.luciferian_d_score` |
| Φ4→Φ8 extra flag | `kmath.FORBIDDEN` / `language_core_engines.FORBIDDEN_STEPS` |
| C_min 0.87, Echo 0.85, write max 0.35, hard stop 0.8 | `drift_v43` laws |
| merge window π/4 | `kmath.MERGE_WINDOW` |
| memory term M and SPC λ | `research_hooks` |
| geometry memory and SPC steps on the card | `geometry_199` |
| loop id | `sha256` / `dpa_195.sha256` |

## Pipeline

Algorithm 5 is sentence plan, template render, decode, then Echo. The plan's words come from the 4.9.197 lexicon. The template is chosen by charge. Decode keeps the answer only when the spoken sentence still carries the planned words. Echo calls the existing coverage function. The score has to be at least 0.85 against the original question. A failing Echo returns no output and the plan sits in the reflection buffer. `response_closed` is the only path that speaks.

The intention anchor binds every answer to the question's loop id. A different loop id returns no output.

Echo Preservation is E = R·ψ(t−τ), from Waking the Web line 275. It is an internal sub-check. It does not admit.

Tone bands choose the template. Charge 0–0.3 is silent. Charge 0.91–1 is expressive. Φ1–3 is cautious, Φ4–6 structured, Φ7–9 fluid. A set χ flag, or drift above 0.6, selects the null template and is log-only. The inner charge cuts between 0.3 and 0.91 were not numbered, so they stay unspecified. Phase names stay Initiation through Recursion.

A Φ5→Φ8 step returns no output. A Φ4→Φ8 step is flagged and does not hard-fire. Drift above 0.8 is the hard stop. Drift above 0.35 returns no output. A Wikipedia source is not an anchor.

## Hooks

M and SPC λ live in `research_hooks`. Nic approved the values on 2026-10-30. The citations are the Resonant Symbolic Operator Calculus Google Doc, December 2025, and the Genesis Node spec at gnspec lines 6743–6820 and 7510.

μ birth is 1.0. The living range is 0.1 to 10. Phase 8 discharge sets μ to 0 after Echo is computed from the pre-zero μ: E = μ·e^(−1.8ε)·cos(Φ), with ε′ = 0.3ε. Other phases keep μ on discharge.

Drift loss is the amplify step μ′ = k·μ·e^(−2.2|Δ|), with k in [1, 2]. That replaces the subtractive λΔ² leak. Merge is μ′ = μ1+μ2+0.12·cos²δ and calls `kmath.merge` with that 0.12. Lock is μ′ = μ1+μ2. Fracture splits μ−0.08. The charge ledger keeps μ′+μ_folded equal to the original within η = 0.003.

SPC decay is C(t) = C0·e^(−λt), with λ = ln2 / half-life. The default half-life is 168 hours. An identity SPC uses 720 hours. Each access adds 0.05, capped at 1.0. The access bonus is min(0.01·count, 0.2), from the existing Genesis access step. Active stays above 0.1. `genesis_collapse.spcCharge` calls this decay.

## Screen

The Ask tab has an RMC renderer card under the Geometry gates card. Echo passes, Echo fails, Tone, Loop anchor, and M and lambda run on the local module. The card does not call a model and it does not write the admit bank. The Ask trace adds `rmc_renderer_200`. `admit_gate` on that line stays false. `persisted` on that line stays false. A failing Echo on that line is an empty output.

## Cold admits

The 60-question table is `docs/LIVE_TEST_200.md`.

No Supabase migration is added. Nothing is applied to a hosted database. Migration files already in the repo stay unapplied.
