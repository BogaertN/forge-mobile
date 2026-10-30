# Live test 4.9.198

The same 60 questions ran through `rmc_engine_v1.rmc_core.run` with `live: true` three times: cold, then two fill passes. Cold memory is `source/data/ask_183_memory.json`. The growth stage is on the engine trace. It does not persist and it does not change the admit ε_s. Wikipedia stays low trust and is not a premise. C_min stays 0.87. Echo stays 0.85. The coherence formula is unchanged. No model is called.

Cold admits 48 of 60. That is the same 48 as 4.9.197, and the same 12 stay held. The three passes agree. On every row the growth stage reports proposal v1, `persisted` false, `admit_gate` false, `keyword_admit` false, `calls_llm` false, `dream_idle` false, and `operators_applied` false.

## Growth

| pass | admitted | held | Echo pass | C min | C max |
|---|---:|---:|---:|---:|---:|
| cold | 48 | 12 | 48 | 0.484438 | 0.903662 |
| pass 2 | 48 | 12 | 48 | 0.484438 | 0.903662 |
| pass 3 | 48 | 12 | 48 | 0.484438 | 0.903662 |

Admitted questions match 4.9.197. No row called a model. The summary is `source/tools/live_198_results.json`.

Pyodide 0.27.7 and CPython agree on the growth fixtures. The gap is 0. The summary is `source/tools/live_198_pyodide.json`.
