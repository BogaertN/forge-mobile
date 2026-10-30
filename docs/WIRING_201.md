# Wiring 4.9.201 — GILIN / CRP

Ask still calls `rmc_engine_v1.rmc_core.run` with `live: true`. C_min stays 0.87. Echo stays 0.85 against the original question. The coherence formula in `measurement_kernel.coherence_components` is unchanged. No model is called. `dream_idle` and `economy` stay off. Letter packs stay gated. Money stays disabled. ChristPing stays Gilligan-only and is not started. Wikipedia stays low trust and is not an anchor.

The GILIN stage is on the Ask trace. It does not persist and it does not change the admit gate. The map section labelled 4.9.200 is this release.

## What is reused

`source/src/gilin_crp_201.js` and `rmc_engine_v1/gilin_crp_201.py` call the modules below. They do not copy those formulas.

| piece | owner |
|---|---|
| C_min 0.87, Echo 0.85, write max 0.35, hard stop 0.8 | `drift_v43` laws, from `drift_score` |
| Φ5→Φ8 detector | `kmath.luciferianDScore` / `chi_hardening.luciferian_d_score` |
| Φ4→Φ8 extra flag | `kmath.FORBIDDEN` / `language_core_engines.FORBIDDEN_STEPS` |
| drift disposition on a 5→8 payload | `drift_v43.score` with the existing nest-7 witness |
| Echo against the question | `rmc_renderer_200.render` |
| node merge inside π/4 | `geometry_199` merge |
| phase names and glyphs | Phase Glyph Codex names, and `ppe_lexicon_197.word` when a node names a word |
| memory term M and SPC λ | `research_hooks` |

## Protocol

A heartbeat places two local nodes and asks the geometry merge whether they sit inside π/4. Initiation and Polarity coordinate. Initiation and Friction do not. A Φ5→Φ8 path hard-fires through the drift core and is not coordinated. A Φ4→Φ8 step is flagged and is not that hard fire. Drift above 0.8 is the hard stop. A Wikipedia source is not an anchor.

CRP 0.78, warn 0.40, and C* 0.82 are internal checks on the supplied measurements. A C of 0.78 or 0.82 does not witness the law. A drift of 0.40 warns and does not write. The law witness needs C at or above 0.87, drift at or under 0.35, and Echo at or above 0.85 against the original question, with no 5→8 step. `law_witness` is a report. `admit_gate` on this stage stays false. Nothing is written.

144 Hz is the Codex heartbeat figure. It is a log. It does not start ChristPing and it is not a timer. Coordination does not call the network. The home-node client is not this protocol.

M birth is 1.0. SPC λ is ln2/168. Those hooks are read from `research_hooks`. They are not given a second number here.

## Screen

The Ask tab has a GILIN / CRP card under the RMC renderer card. Heartbeat, CRP 0.78, Warn 0.40, C* 0.82, Law 0.87, and 5 to 8 run on the local module. The card does not call a model and it does not write the admit bank. The Ask trace adds `gilin_crp_201`. `admit_gate` on that line stays false. `persisted` on that line stays false. CRP, C*, and the 0.40 warn do not admit.

## Cold admits

The 60-question table is `docs/LIVE_TEST_201.md`. The 12 held questions are listed in `docs/HELD_AUDIT_201.md`. None of lexicon growth, geometry, the renderer, or this protocol can lawfully lift them.

No Supabase migration is added. Nothing is applied to a hosted database. Migration files already in the repo stay unapplied.
