# Wiring 4.9.183 — RMC is the Ask path

The phone Ask box calls `rmc_engine_v1.rmc_core.run` with `live: true`. That is the answer path. A dry-run flag still skips stages 14–16 for tests.

```
question
  -> research.web excerpt, marked quarantined
  -> memory fed to the recaller
       RMC receipts, phone KB, hosted KB (admitted)
       quarantined research is evidence, not a claim
  -> rmc_core.run  (Pyodide worker, else POST /api/rmc/deep-dry-run)
       1–13 the existing dry-run stages, including memory recall
       reasoning seam          run_reasoning_seam
                               applied false today
                               4.9.184 replaces this function:
                               world-model Derive, then EchoForge debate
                               on the language core
       14 output renderer     (live; uses derived_text only if the seam applied)
       15 Echo                (rendered answer vs the question's meaning, >= 0.85)
       16 memory writer plan  (only after Echo; no commit on a hold)
  -> admit gate
       drift <= 0.35, hard stop > 0.80, C >= C_min 0.87
  -> if admit and Echo pass: show the rendered answer
     else: show Held and the trace
  -> recalled rows are the next question's memory
```

The seam is `rmc_engine_v1.reasoning_seam.run_reasoning_seam`. It sits after recall and before the renderer. It returns the recalled count on both sides, `applied` false, and an empty `derived_text`. It does not write and it does not call a model. The renderer keeps using admitted memory. When 4.9.184 sets `applied` and `derived_text`, the renderer speaks that text and the rest of the path stays put.

No language model is called. ChristPing stays Gilligan-only, and `dream_idle` is off, so Ask does not start it. `economy` is off. Money stays disabled. Letter packs stay gated.

## Thresholds

| Gate | Value | Role |
|---|---:|---|
| C_min | 0.87 | Admit. Not lowered. |
| Echo | 0.85 | Coverage of the question's meaning tokens by the rendered answer. |
| Drift quarantine / chi | 0.35 | At or under 0.35 can leave cold storage. Above 0.35 is chi or correction. |
| Hard stop | 0.80 | Above this is a hard stop. |
| Router 0.72 and 0.78 | reference only | Not the admit decision. |

## Switches

`src/next_layer.js` defaults both off.

- `dream_idle` — cold-storage exploration. The Custody tab reads the mesh only while this is on.
- `economy` — contributor credit counts. It does not move money.

## Old JS answer path, bypassed

Ask no longer calls these. They remain in the tree. Deletion is a later phase.

| Still in the tree | What it used to do |
|---|---|
| `src/forge.js` `process` | Built the spoken reply, the spine, and the old Echo. |
| `src/kernel.js` realization | Language-core sentence for that reply. |
| `src/derive.js` research realizer | Spoke a research.web excerpt as the answer. |
| `src/claim_parse.js` `matchAsk` | Picked an admitted row as the JS reply. |

## Echo

Live Echo is `question_meaning_coverage`: the share of the question's content tokens that appear in the rendered answer. The threshold is `echo_min` 0.85. The dry run still uses Jaccard against the selected candidate, because stages 14–16 do not render.

## Recall and C

Receipts, the phone KB, and the hosted KB are written into the recaller before the run. `data/ask_183_memory.json` is admitted seed text. A web excerpt is a separate quarantined row (`verification_ok` false, prior drift 0.45) and is not the rendered claim.

On the 60-question set, feeding that seed moved C up from the 4.9.182 band (0.630–0.728, every route `spc_cold_storage_required`) into 0.648–0.836. Fifty-seven questions route `active_stack_candidate`. Three why-questions route `correction_queue`. None reach C_min, so all sixty stay held. The table is `docs/LIVE_TEST_183.md`.
