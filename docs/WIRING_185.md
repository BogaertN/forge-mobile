# Wiring 4.9.185 — resonance recall and the memory writer

Ask still calls `rmc_engine_v1.rmc_core.run` with `live: true`. Observe, Derive, and the EchoForge debate are unchanged. C_min stays 0.87. Echo stays 0.85. The coherence formula in `measurement_kernel.coherence_components` is unchanged. No model is called. `dream_idle` and `economy` stay off. Letter packs stay gated. Money stays disabled. ChristPing is not started from Ask.

```
question
  -> research.web excerpt, marked quarantined
  -> Athena places FORGE-RESONANCE-PACKET/v1 sfe {Phi, eps, mu}
       projectable Φ9 / ε 0 / μ 1
       quarantine  Φ5 / ε 0.5 / μ 0
       dream_idle.js resonancePacket
  -> resonance recall (not token overlap)
       frame: language_core_debate.frame_for_atom on the atom
              world_model_v1.parse_sentence already returns (contract §7)
              FR.BE.COP: a wh-karta asks the karma
              one copula hop is WM-COPULA-CHAIN
       else concept: concept_lexicon.json from source/src/lexicon.js Doc 4
       rank: kmath.js phaseAngle, δ ≤ π/4 (RSOC §3.1.1)
             RPMC §3.4 grace, rpm weight μ·exp(−ε)
       RSOC: one lock, or several held open; the scorer sees the longest lock
       quarantine is recorded and is not a premise
  -> rmc_core.run
       the scorer's memory set is that resonant lock
       Observe still sees every non-scoring admitted row, and quarantined rows
       Derive, debate, renderer: unchanged from 4.9.184
  -> admit gate
       drift <= 0.35, hard stop > 0.80, C >= C_min 0.87
       C is the existing formula on the scorer's candidate
       Echo >= 0.85 of the derived sentence against the question
  -> only then the memory writer commits
       phone KB, hosted session KB, RMC receipt
       packet, provenance, contributor athena
       Supabase kb.contributions insert stays revoked
       (supabase/migrations/20261021000100_revoke_contrib_insert.sql)
  -> a later Ask recalls the written row by the same resonance
```

## Bootstrap

`resonance_recall.curate_quarantine` will not promote a quarantined excerpt that has no phase-aligned admitted ancestor. The rule is `DREAM-QUARANTINE-NO-TRUTH`, the same refusal as `dream_idle.js` `athenaGate`. An empty bank therefore cannot write the first fact by skipping the gate. The cold pass admits only where a sentence that was already admitted phase-aligns, and the unchanged formula then reaches 0.87. That is the fill. Questions with no frame lock and no shared content concept stay held.

## Where each piece comes from

| Piece | Source |
|---|---|
| Resonance packet | `source/src/dream_idle.js` `resonancePacket`. Schema `FORGE-RESONANCE-PACKET/v1`. |
| Phase angle and δ ≤ π/4 | `source/src/kmath.js` `phaseAngle`, `phaseAlignedToOrigin`. RSOC §3.1.1. |
| Grace / rpm | RPMC §3.4 and Axiom 4. `kmath.js` `rpmWeight` is μ·exp(−ε). |
| Frame | `language_core_debate.py` `frame_for_atom`, `FR.BE.COP`. `source/src/lexicon.js` Doc 5 roles karta, karma. |
| Concept lexicon | `concept_lexicon.json`, the Doc 4 surfaces in `source/src/lexicon.js` that are not function words. |
| Copula hop | `world_model_v1.py` `COPULA_RULE` `WM-COPULA-CHAIN`. |
| RSOC select | `kmath.js` `rsocSelect`. One lock, or held open. |
| Admit C | `measurement_kernel.coherence_components`. Weights unchanged. |
| Quarantine-to-admit | `dream_idle.js` `athenaGate`: no ancestor, no projectable packet, no write. |
| ChristPing | `dream_idle.js`: only Gilligan initiates. Ask does not. |
| Supabase | `supabase/migrations/20261021000100_revoke_contrib_insert.sql`. Insert revoked. |

## Thresholds

| Gate | Value | Role |
|---|---:|---|
| C_min | 0.87 | Admit. Not lowered. |
| Echo | 0.85 | Coverage of the question by the derived sentence. |
| Drift quarantine / chi | 0.35 | At or under 0.35 can leave cold storage. |
| Hard stop | 0.80 | Above this is a hard stop. Gilligan would recenter. Ask does not. |

The two 60-question tables are `docs/LIVE_TEST_185.md`.
