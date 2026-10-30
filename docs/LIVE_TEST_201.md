# Live test 4.9.201

The same 60 questions ran through `rmc_engine_v1.rmc_core.run` with `live: true` three times: cold, then two fill passes. Cold memory is `source/data/ask_183_memory.json`. The GILIN stage is on the engine trace. It does not persist and it does not change the admit gate. Wikipedia stays low trust and is not a premise. C_min stays 0.87. Echo stays 0.85. The coherence formula is unchanged. No model is called.

Cold admits 48 of 60. That is the same 48 as 4.9.200, and the same 12 stay held. The three passes agree. On every row GILIN reports build 4.9.201, `admit_gate` false, CRP does not admit, C* does not admit, the 0.40 warn does not admit, `calls_llm` false, `network` false, `dream_idle` false, money disabled, and Wikipedia not an anchor. M birth is 1.0. SPC λ is ln2/168. Those hooks do not change the admit gate.

The held rows and why lexicon growth, geometry, the renderer, and GILIN/CRP cannot lift them are in `docs/HELD_AUDIT_201.md`.

## GILIN

| pass | admitted | held | Echo pass | C min | C max |
|---|---:|---:|---:|---:|---:|
| cold | 48 | 12 | 48 | 0.484438 | 0.903662 |
| pass 2 | 48 | 12 | 48 | 0.484438 | 0.903662 |
| pass 3 | 48 | 12 | 48 | 0.484438 | 0.903662 |

Admitted questions match 4.9.200. No row called a model. The summary is `source/tools/live_201_results.json`.

Pyodide 0.27.7 and CPython agree on the GILIN fixtures. The gap is 0. The summary is `source/tools/live_201_pyodide.json`.
