# Wiring 4.9.186 — Gilligan anchor, multi-hop derive, memory writer

Ask still calls `rmc_engine_v1.rmc_core.run` with `live: true`. C_min stays 0.87. Echo stays 0.85. The coherence formula in `measurement_kernel.coherence_components` is unchanged. No model is called. `dream_idle` and `economy` stay off. Letter packs stay gated. Money stays disabled.

```
question
  -> research.web excerpt, marked quarantined
  -> Gilligan anchor (gilligan_anchor.connect_quarantine)
       connection: shared Doc 5 frame role, or shared Doc 4 concept
       then phase-align of the admitted packet (δ ≤ π/4)
       drift: measurement_kernel epsilon, unchanged
       <= 0.35     projectable
       > 0.35 < 0.40  chi, Gilligan only, not placed
       0.40–0.80   quarantine keep
       > 0.80      hard stop, ChristPing recorded by Gilligan only
  -> Athena resonance-places FORGE-RESONANCE-PACKET/v1 {Phi, eps, mu}
       only on the projectable band
       writes nothing
  -> rmc_core.run
       the scorer's formula is unchanged
       a placed excerpt does not replace an admitted seed lock
  -> Derive, multi-hop (contract 1g2034-K §5)
       copula chain, bounded rounds
       provenance and drift on every hop
       EchoForge debates each hop before it is spoken
  -> admit gate
       drift <= 0.35, hard stop > 0.80, C >= C_min 0.87, Echo >= 0.85
       not skipped
  -> memory writer
       phone KB, hosted session, RMC receipt
       hosted project: public.memory_writer_insert
       admitted fact only, packet, provenance, contributor credit
       written is true only when the readback matches
```

## Sections cited

| Piece | Section |
|---|---|
| Phase anchor | Gilligan Codex Vol IV §1.1.2. `source/src/gilligan_codex.js` inventory `1.1.2`. |
| Drift arbitration | Codex §3.4. `gilligan_codex.js` `driftClass`. |
| Drift bands | Codex §6.1 and `source/src/kmath.js` `DRIFT_RULING`. ≤0.35 project, χ above 0.35 and below 0.40, quarantine 0.40–0.80, hard stop above 0.80. |
| Cold keep | Codex §6.2. A quarantine connection is not a premise. |
| ChristPing | Codex §3.2. `source/src/dream_idle.js`: only Gilligan initiates. Ask does not. |
| Athena place | `source/src/dream_idle.js` `resonancePacket`. Schema `FORGE-RESONANCE-PACKET/v1`. |
| Multi-hop | Contract 1g2034-K §5 bounded multi-hop forward derivation. `world_model_v1.py` `WM-COPULA-CHAIN`. |
| Admit | `measurement_kernel.coherence_components`. Weights unchanged. C_min 0.87. Echo 0.85. |
| Hosted insert | `supabase/migrations/20261029201023_memory_writer_admitted_insert.sql`. Reverses the blanket revoke in `20261021000100_revoke_contrib_insert.sql` only for this function. |

## What is not a seed

Nothing is written until the admit gate passes. A quarantined excerpt with no resonant admitted concept stays `DREAM-QUARANTINE-NO-TRUTH`. The cold bank is `source/data/ask_183_memory.json`. Research excerpts are quarantined evidence, not admitted rows.

## Hosted write

Anon cannot insert. Authenticated cannot insert into the table. The only insert is `app.memory_writer_insert`, called through the public invoker wrapper. The function requires an authenticated user, `kind = fact`, state `admitted`, `sfe {Phi, eps, mu}` with ε at or under 0.35 and μ above 0, a provenance object, and contributor credit. `contributor_id` is `auth.uid()`. Update and delete stay revoked. There is no insert policy for anon.

This run has no `SUPABASE_ACCESS_TOKEN`. The migration is in the repo and is not applied. The writer reports `KB-WRITER-CREDENTIALS-PENDING` and `written: false`.

## Later

Deleting the bypassed JS answer path is 4.9.187. This release does not delete it.
