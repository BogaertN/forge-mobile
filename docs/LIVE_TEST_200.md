# Live test 4.9.200

The same 60 questions ran through `rmc_engine_v1.rmc_core.run` with `live: true` three times: cold, then two fill passes. Cold memory is `source/data/ask_183_memory.json`. The renderer stage is on the engine trace. It does not persist and it does not change the admit gate. Wikipedia stays low trust and is not a premise. C_min stays 0.87. Echo stays 0.85. The coherence formula is unchanged. No model is called.

Cold admits 48 of 60. That is the same 48 as 4.9.199, and the same 12 stay held. The three passes agree. On every row the renderer reports build 4.9.200, a failing Echo as empty output, `response_closed` false for that witness, `persisted` false, `admit_gate` false, `calls_llm` false, `network` false, `dream_idle` false, money disabled, Wikipedia not an anchor, and M and `spc_lambda` still null.

## Renderer

| pass | admitted | held | Echo pass | C min | C max |
|---|---:|---:|---:|---:|---:|
| cold | 48 | 12 | 48 | 0.484438 | 0.903662 |
| pass 2 | 48 | 12 | 48 | 0.484438 | 0.903662 |
| pass 3 | 48 | 12 | 48 | 0.484438 | 0.903662 |

Admitted questions match 4.9.199. No row called a model. The summary is `source/tools/live_200_results.json`.

Pyodide 0.27.7 and CPython agree on the renderer fixtures. The gap is 0. The summary is `source/tools/live_200_pyodide.json`.
