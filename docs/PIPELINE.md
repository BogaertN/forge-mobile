# Ask pipeline

One path from the question to a spoken reply. A stage that does not apply is recorded as skipped. An answer is not spoken by skipping derive.

## Stages

1. Parse. `src/qframe.js` `compile` reads the utterance as a kāraka frame (or a speech-act frame from `src/speech_acts.js`, which is the same data as `engine/rmc_engine_v1/speech_acts.json`). An imperative is the same clause with the addressee as kartṛ (`QF-IMP`).
2. Recall. `engine/rmc_engine_v1/memory_recaller.py` and `resonance_recall.py` rank memory. The phone's clauses ride on the rows (`src/rmc_core.js` `withClauses`, including `src/user_manual.js` read from `docs/USER_MANUAL.md`).
3. Reason. `engine/rmc_engine_v1/world_model_v1.py` `derive` unifies frames, chains, polarity, and recall. Symbolic math is `computed_math.py` when the frame is an operation. A simulator receipt is evidence on `memory.simulation` (`src/sim_device.js` plans, `sim_device.py` solves). It is not a publisher.
4. Gate. `rmc_core.py` `admit_gate` uses the fixed floors in `mobile_config.py` (C 0.87, Echo 0.85 to speak, drift 0.35, hard stop 0.80). This file does not change them.
5. Compile. `src/rmc_core.js` `outwardCompile` realizes each atom. The UI card (`src/app.js` `renderRmc`) shows the path label.

A held question has parse, recall, derive, and gate, and no compile. The card says Athena gap. It does not repeat a stored sentence.

## Wired

| Stage | Module | Wired |
|---|---|---|
| Parse | `src/qframe.js` `compile` | Ask sends `frame` |
| Recall | `memory_recaller.py`, `withClauses` | `memory` on the payload |
| Derive | `world_model_v1.py` `_derive_by_frame` | Every live ask |
| Math | `computed_math.py` | When the frame is an operation |
| Sim | `sim_device.js` then `sim_device.py` | Browser Ask, evidence only |
| Gate | `rmc_core.py` `admit_gate` | After derive |
| Compile | `src/rmc_core.js` `outwardCompile` | After a spoken derive or speech act |
| Gap | route `correction_queue`, card `Athena gap` | When nothing is spoken |

## Bypasses removed in 4.9.254

- Token overlap no longer replaces a missing derivation with a stored sentence (`rmc_core.py`).
- A language-core claim is not spoken unless derive already supported the reply.
- The capability-only composer and the 4/12/8 match caps are gone. Every gate-passing survivor is spoken, direct proofs before derived ones, up to `MAX_SENTENCES`. The rest are counted as omitted.
- A where-question with kriyā live fills the adhikarana from the fact.
- A past participle after a determiner is a modifier (`a remembered fact`).
- An object noun can carry a relative clause.
- An imperative's initial capital is sentence orthography, so `Tell me about …` is the same frame as `you tell me about …`.

## Still not one process

- MuJoCo, RDKit, and ngspice run in the browser worker. The node Ask path records the plan and does not run those workers.
- Heavy CFD and Hartree-Fock stay on the home PC and hold when it is unset.
- Speech-act replies (`Hello.`) are realized from `speech_acts.json`, not from a world-model fact. A yes or no particle is quoted the same way. Both are fixed system forms.
- `sim_device.py` still builds the rigid-body clause and the causal reason from outcome tables (`VERB_3SG`, `GERUND`, and the per-outcome sentences). The receipt hash includes that text. Those sentences are not yet realized by the grammar. This is the remaining template.
- Fixed system messages (Held…, approval prompts, vault copy) are not answers. They are listed in the 4.9.254 report.
