# Live test 4.9.193

The same 60 questions ran through `rmc_engine_v1.rmc_core.run` with `live: true` three times: cold, then two fill passes. Cold memory is `source/data/ask_183_memory.json`. The drift v4.3 summary is on the engine trace. It does not change the admit ε_s. Wikipedia stays low trust and is not a premise. C_min stays 0.87. Echo stays 0.85. The coherence formula is unchanged. No model is called.

Cold admits 48 of 60. That is the same 48 as 4.9.191, and the same 12 stay held. Sky, leaves, and the ocean still admit. The three passes agree.

## Growth

| pass | admitted | held | Echo pass | C min | C max |
|---|---:|---:|---:|---:|---:|
| cold | 48 | 12 | 48 | 0.484438 | 0.903662 |
| pass 2 | 48 | 12 | 48 | 0.484438 | 0.903662 |
| pass 3 | 48 | 12 | 48 | 0.484438 | 0.903662 |

Admitted questions match 4.9.191. No row called a model. Stable: True. The summary is `source/tools/live_193_results.json`.

Pyodide and CPython agree on the drift v4.3 fixtures. The summary is `source/tools/live_193_pyodide.json`.
