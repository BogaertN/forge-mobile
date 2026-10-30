# Wiring 4.9.195 — write-once dead path archive and sealed records

Ask still calls `rmc_engine_v1.rmc_core.run` with `live: true`. C_min stays 0.87. Echo stays 0.85. The coherence formula in `measurement_kernel.coherence_components` is unchanged. No model is called. `dream_idle` and `economy` stay off. Letter packs stay gated. Money stays disabled. ChristPing stays Gilligan-only. Wikipedia stays low trust and is not an anchor.

## What is reused

`source/src/dpa_195.js` and `rmc_engine_v1/dpa_195.py` call the 4.9.191 breaker and the v4.3 law constants. They call `ledger.js` `verifyChain` and `entryHash` for the fork. They do not copy those formulas.

| piece | owner |
|---|---|
| a failure is ε_s above 0.35, a hard stop above 0.8, or Φ5→Φ8 / Φ4→Φ8 | `driftCircuitBreaker` / `drift_circuit_breaker` |
| C_min 0.87 and Echo 0.85 | `drift_v43` law constants |
| phase names Initiation through Recursion | `kmath.CANONICAL_PHASE_NAMES` / `drift_v43.PHASE_NAMES` |
| ledger hash and fork keep-existing | `ledger.js` `entryHash`, `verifyChain`, `merge` |

## Dead path archive

GN Doc 1. The archive is append-only. A second write of the same id returns `DPA-REWRITE-REJECTED` and leaves the first ψ in place. Erase returns `DPA-ERASE-REJECTED`. RSOC says grace before archival and never erase.

A row is a dead path when the 4.9.191 breaker counts that sample as a failure. Drift 0.35 is not a failure and is not archived. Drift 0.36 is archived and does not admit. Drift 0.8 is a failure and is not a hard stop. Drift above 0.8 is a hard stop. Φ5→Φ8 is a dead path on one sample.

The Codex 3.3 SPC cut above 0.5 is logged. It does not decide admission and it does not replace the 0.35 write law.

## Sealed loop

Gilligan Codex 3.3. The signature is SHA-256 of ψ, phase, timestamp, the Codex hash of `AIWEB-GIL-CODEX-IV-001`, and entropy. Codex 3.17 is the chain: each record names the previous hash. A changed ψ that does not carry a new signature fails `DPA-SIGNATURE-MISMATCH`.

A seal needs Echo at or above 0.85 against the original question. The module does not recompute Echo and it does not call a model. A supplied score below 0.85 is `SEAL-ECHO-BELOW-MIN` and is not written. The question text is on the seal. Φ5→Φ8 is `SEAL-REFUSED-DEAD-PATH`. A second seal of the same id is rejected. The phase name on a lawful seal is Recursion when the phase is 9.

## Fork

GenNode Doc 12. `ledger.merge` still keeps the existing chain and returns `LEDGER-FORK-KEPT-EXISTING`. This build seals that decision as `LEDGER-FORK-RESOLVED`. The foreign chain is not replaced. A second presentation of the same fork does not add a second resolution. A longer chain that shares the verified prefix fast-forwards. A chain whose hash does not recompute is `LEDGER-HASH-MISMATCH` and is not sealed as a fork.

Doc 11 still carries sealed loops and dead paths only. This build does not turn sync on.

## Screen

The Ask tab has a Dead path archive card. It shows the rewrite refusal, the hash check, and the fork resolution. It does not call a model and it does not write memory. The Ask trace adds `dpa_195` beside the breaker line. `admit_gate` on that line stays false.

## Cold admits

The 60-question table was run three times. Cold admits stay 48 of 60, the same 48 as 4.9.194. The three passes agree. The table is `docs/LIVE_TEST_195.md`.

No Supabase migration is added. Nothing is applied to a hosted database.
