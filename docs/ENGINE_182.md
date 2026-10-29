# Engine 4.9.182 — foundations

This release does not replace Ask. The phone UI, Pages deploy, the existing tests, the hosted KB, the custody monitor, and the Pyodide loader stay. A new core runs Nic's engine beside that shell.

```
question
  -> rmc_core.run
       write RMC receipts, phone KB, and hosted KB
         into memory/context_library_v1/receipts
       run_deep_dry_run
       memory recall
       world_model seam   (status: seam, applied: false, memory unchanged)
       admit gate         (recorded, not applied to Ask)
       trace: input, memory, phase, operator chain, drift, output
```

`src/forge.js` still produces the Ask reply. `src/rmc_core.js` does not call it.

## What runs

| Piece | Role |
|---|---|
| `source/engine/rmc_engine_v1` | Nic's package, including `deep_dry_run_orchestrator.py`. `llm_renderer.py` and `chroma_connector.py` are the upstream files. They are not re-pointed in this release. |
| `rmc_engine_v1/rmc_core.py` | The new core. It calls `run_deep_dry_run` and returns the trace. |
| `rmc_engine_v1/mobile_config.py` | C_min 0.87, echo 0.85, drift quarantine 0.35, hard stop 0.80. Router 0.72 and 0.78 are `reference_only`. |
| `src/py_worker.js` | Loads Pyodide after the existing SHA-384 check, then checks `data/py/rmc_engine_bundle.json` the same way and imports `rmc_core.run`. |
| `src/rmc_client.js` | Browser worker first. If the bundle or Pyodide fails, `POST /api/rmc/deep-dry-run`. |
| `source/tools/rmc_http.py` | The same `rmc_core.run` behind that endpoint. |
| Node tests | `python3 -m rmc_engine_v1.rmc_core`. This environment ran that path. Pyodide itself was not started here. |

The trace `output` is a foundation record (`product_reply: false`). It is not a user-facing answer. The admit disposition is stored on the trace and `applied_to_ask` is false.

## World-model seam

`world_model_seam` sits after memory recall and before `admit_gate`. It copies the recalled count through and sets `applied` false. It does not write KB rows and it does not call a model. A later world model replaces that function.

## Not in this release

The clause splitter, the ask-key index, the chloramine headline, and the ProtoForge canned line are still in the Ask path. Language-model-shaped functions were not ported. ChristPing triggers and the two extra drift engines were not folded into the drift stage. Those wait for the build plan.

## Sample trace

One Python run of `What is photosynthesis?` with one hosted KB row:

- engine: `rmc_engine_v1`
- entry: `deep_dry_run_orchestrator.run_deep_dry_run`
- product reply: false
- calls_llm: false
- memory fed: 1, and the recaller returned an active node
- world model: `seam`, applied false, input count equal to output count
- admit: recorded, not applied to Ask
- operator chain includes `memory_recall_trace_spine` and `containment_router`
