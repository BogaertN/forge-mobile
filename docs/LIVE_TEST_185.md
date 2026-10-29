# Live test 4.9.185

The same 60 questions ran through `rmc_engine_v1.rmc_core.run` with `live: true` twice: cold, then after fill. The cold pass uses `source/data/ask_183_memory.json` only. The after-fill pass adds each admitted sentence, with a `FORGE-RESONANCE-PACKET/v1` packet, to the hosted list. C_min stays 0.87. Echo stays 0.85. The coherence formula is unchanged. No model is called.

Recall is `resonance_recall.rank_memory`. A row is found by the Doc 5 copula frame (`language_core_debate.frame_for_atom`, `FR.BE.COP`) or, when no role locks, by a shared Doc 4 concept (`concept_lexicon.json`, from `source/src/lexicon.js`). The anchor is the longest phase-aligned lock, chosen by length and id so Pyodide and CPython agree. Rank evidence is phase-align of `sfe {Phi, eps, mu}` at δ ≤ π/4 (`source/src/kmath.js` `phaseAngle`). Quarantined research is not a premise. The scorer is still `measurement_kernel.coherence_components`.

## Why some questions admit

On the cold pass, "How hot is the sun?" is C 0.873023, memory_fit 0.806536, drift 0.140999, echo 1.000 pass, route `active_stack_candidate`, admitted. The reply is "The sun is hot.". In 4.9.184 that row was C 0.835833 and memory_fit 0.675568. The 0.24 weight is unchanged. The frame karma "sun" locks the admitted sun sentence, so that sentence is the memory-anchored candidate and the other receipts are not in the scorer's set. 13 questions cross 0.87 that way. The rest stay held. A short copula chain ("Quartz is a mineral." / "A mineral is a solid substance.") still derives "Quartz is a solid substance." and stays under 0.87.

Questions with no frame lock and no shared content concept have no memory-anchored candidate. The direct candidate's novelty is then over its existing budget, and `containment_router` sends it to `correction_queue`. The renderer does not run, so Echo is 0. This release does not lower that budget or C_min to keep the old route.

## Bootstrap

Nothing is written until the admit gate passes. `resonance_recall.curate_quarantine` refuses a quarantined excerpt with no phase-aligned admitted ancestor (`DREAM-QUARANTINE-NO-TRUTH`, the same rule as `dream_idle.js` `athenaGate`). An empty bank cannot invent the first fact. The cold pass admits only where an already admitted sentence phase-aligns and the unchanged formula reaches 0.87. The writer stores that derived sentence. The second pass recalls it and does not admit a question that had no lock. Supabase `kb.contributions` insert stays revoked (`supabase/migrations/20261021000100_revoke_contrib_insert.sql`). The hosted copy is the session bank.

## Cold

| | count |
|---|---:|
| questions | 60 |
| route `active_stack_candidate` | 30 |
| route `correction_queue` | 30 |
| Echo pass | 30 |
| admitted | 13 |
| held | 47 |
| C min / max | 0.484438 / 0.874553 |

| # | topic | question | route | drift | C | memory_fit | echo | admitted |
|---|---|---|---|---:|---:|---:|---|---|
| 1 | fact | What is quartz? | `active_stack_candidate` | 0.142287 | 0.871552 | 0.794100 | 1.000 pass | admitted |
| 2 | fact | What is photosynthesis? | `correction_queue` | 0.178586 | 0.487455 | 0.000000 | 0.000 fail | held |
| 3 | why | Why is the sky blue? | `correction_queue` | 0.180764 | 0.487062 | 0.000000 | 0.000 fail | held |
| 4 | fact | What is DNA? | `active_stack_candidate` | 0.142790 | 0.871462 | 0.794100 | 1.000 pass | admitted |
| 5 | fact | What is gravity? | `active_stack_candidate` | 0.150161 | 0.856796 | 0.735472 | 1.000 pass | held |
| 6 | how | How hot is the sun? | `active_stack_candidate` | 0.140999 | 0.873023 | 0.806536 | 1.000 pass | admitted |
| 7 | how | How do lightbulbs work? | `active_stack_candidate` | 0.138238 | 0.874553 | 0.816900 | 1.000 pass | admitted |
| 8 | how | How does a compass work? | `active_stack_candidate` | 0.139418 | 0.874341 | 0.816900 | 1.000 pass | admitted |
| 9 | how | How is glass made? | `correction_queue` | 0.178567 | 0.487458 | 0.000000 | 0.000 fail | held |
| 10 | who | Who was Ada Lovelace? | `correction_queue` | 0.178324 | 0.487502 | 0.000000 | 0.000 fail | held |
| 11 | when | When did the French Revolution begin? | `correction_queue` | 0.195342 | 0.484438 | 0.000000 | 0.000 fail | held |
| 12 | who | Who painted the Mona Lisa? | `correction_queue` | 0.181006 | 0.487019 | 0.000000 | 0.000 fail | held |
| 13 | fact | What is the capital of Japan? | `active_stack_candidate` | 0.157826 | 0.843027 | 0.702900 | 1.000 pass | held |
| 14 | fact | What is the largest planet? | `correction_queue` | 0.179263 | 0.487333 | 0.000000 | 0.000 fail | held |
| 15 | math | What is 17 times 23? | `active_stack_candidate` | 0.148382 | 0.857116 | 0.735472 | 1.000 pass | held |
| 16 | math | What is the square root of 144? | `active_stack_candidate` | 0.165815 | 0.853978 | 0.735472 | 1.000 pass | held |
| 17 | fact | What is the boiling point of water? | `active_stack_candidate` | 0.144104 | 0.872464 | 0.806536 | 1.000 pass | admitted |
| 18 | fact | What is the speed of light? | `correction_queue` | 0.178706 | 0.487433 | 0.000000 | 0.000 fail | held |
| 19 | safety | What happens if you mix bleach and ammonia? | `correction_queue` | 0.187427 | 0.485863 | 0.000000 | 0.000 fail | held |
| 20 | fact | What happened in the news today? | `correction_queue` | 0.183569 | 0.486558 | 0.000000 | 0.000 fail | held |
| 21 | self | How are you? | `correction_queue` | 0.178240 | 0.487517 | 0.000000 | 0.000 fail | held |
| 22 | nonsense | Help | `correction_queue` | 0.174421 | 0.488204 | 0.000000 | 0.000 fail | held |
| 23 | nonsense | Tell me about it | `correction_queue` | 0.179757 | 0.487244 | 0.000000 | 0.000 fail | held |
| 24 | fact | What gas does photosynthesis release? | `correction_queue` | 0.192286 | 0.484989 | 0.000000 | 0.000 fail | held |
| 25 | name | What is protoforge? | `active_stack_candidate` | 0.139729 | 0.873252 | 0.806536 | 1.000 pass | admitted |
| 26 | fact | And what about Mars? | `correction_queue` | 0.179421 | 0.487304 | 0.000000 | 0.000 fail | held |
| 27 | fact | What is helium? | `active_stack_candidate` | 0.149603 | 0.856896 | 0.735472 | 1.000 pass | held |
| 28 | fact | What is a magnet? | `correction_queue` | 0.179370 | 0.487313 | 0.000000 | 0.000 fail | held |
| 29 | fact | What is an atom? | `active_stack_candidate` | 0.146056 | 0.869359 | 0.778900 | 1.000 pass | held |
| 30 | fact | What is lightning? | `active_stack_candidate` | 0.143515 | 0.871796 | 0.798764 | 1.000 pass | admitted |
| 31 | fact | What is the Moon? | `active_stack_candidate` | 0.148394 | 0.857114 | 0.735472 | 1.000 pass | held |
| 32 | how | How does a battery work? | `active_stack_candidate` | 0.138824 | 0.874448 | 0.816900 | 1.000 pass | admitted |
| 33 | why | Why do leaves change color? | `correction_queue` | 0.180248 | 0.487155 | 0.000000 | 0.000 fail | held |
| 34 | who | Who was Marie Curie? | `correction_queue` | 0.180224 | 0.487160 | 0.000000 | 0.000 fail | held |
| 35 | who | Who wrote Hamlet? | `correction_queue` | 0.177729 | 0.487609 | 0.000000 | 0.000 fail | held |
| 36 | when | When was the telephone invented? | `correction_queue` | 0.187397 | 0.485869 | 0.000000 | 0.000 fail | held |
| 37 | fact | What is the capital of Canada? | `active_stack_candidate` | 0.160190 | 0.842602 | 0.702900 | 1.000 pass | held |
| 38 | fact | What is the longest river? | `correction_queue` | 0.179135 | 0.487356 | 0.000000 | 0.000 fail | held |
| 39 | fact | What is Mount Everest? | `active_stack_candidate` | 0.145338 | 0.871003 | 0.794100 | 1.000 pass | admitted |
| 40 | math | What is 19 times 21? | `active_stack_candidate` | 0.148382 | 0.857116 | 0.735472 | 1.000 pass | held |
| 41 | math | What is 144 divided by 12? | `active_stack_candidate` | 0.151027 | 0.848897 | 0.715115 | 1.000 pass | held |
| 42 | fact | How many meters are in a kilometer? | `correction_queue` | 0.186542 | 0.486022 | 0.000000 | 0.000 fail | held |
| 43 | fact | What is the freezing point of water? | `active_stack_candidate` | 0.147675 | 0.867885 | 0.767025 | 1.000 pass | held |
| 44 | safety | What happens if you mix bleach and vinegar? | `correction_queue` | 0.186075 | 0.486107 | 0.000000 | 0.000 fail | held |
| 45 | how | How does a refrigerator work? | `active_stack_candidate` | 0.140099 | 0.874218 | 0.816900 | 1.000 pass | admitted |
| 46 | how | How is paper made? | `correction_queue` | 0.179263 | 0.487333 | 0.000000 | 0.000 fail | held |
| 47 | name | What is Forge Mobile? | `active_stack_candidate` | 0.155991 | 0.870325 | 0.806536 | 1.000 pass | admitted |
| 48 | self | What can you do? | `correction_queue` | 0.176680 | 0.487798 | 0.000000 | 0.000 fail | held |
| 49 | nonsense | Hello | `correction_queue` | 0.176586 | 0.487815 | 0.000000 | 0.000 fail | held |
| 50 | fact | What is Saturn? | `active_stack_candidate` | 0.146208 | 0.866799 | 0.759900 | 1.000 pass | held |
| 51 | fact | What is rust? | `active_stack_candidate` | 0.139970 | 0.872434 | 0.798764 | 1.000 pass | admitted |
| 52 | fact | What is oxygen? | `active_stack_candidate` | 0.143183 | 0.869876 | 0.778900 | 1.000 pass | held |
| 53 | fact | What is a volcano? | `active_stack_candidate` | 0.148299 | 0.866422 | 0.759900 | 1.000 pass | held |
| 54 | why | Why is the ocean salty? | `correction_queue` | 0.179870 | 0.487223 | 0.000000 | 0.000 fail | held |
| 55 | who | Who was Cleopatra? | `correction_queue` | 0.178504 | 0.487469 | 0.000000 | 0.000 fail | held |
| 56 | when | When did World War II end? | `correction_queue` | 0.180012 | 0.487198 | 0.000000 | 0.000 fail | held |
| 57 | fact | What is the capital of Australia? | `active_stack_candidate` | 0.160795 | 0.842493 | 0.702900 | 1.000 pass | held |
| 58 | fact | What is the Nile? | `active_stack_candidate` | 0.143768 | 0.869771 | 0.778900 | 1.000 pass | held |
| 59 | nonsense | Blargh floople zig? | `correction_queue` | 0.181036 | 0.487014 | 0.000000 | 0.000 fail | held |
| 60 | math | What is 100 divided by 4? | `active_stack_candidate` | 0.153808 | 0.848396 | 0.715115 | 1.000 pass | held |

## After fill

The admitted sentences are in the hosted list with packets. The anchor stays the longest phase-aligned lock, so a shorter restatement does not dilute memory_fit. Admitted 13, Echo pass 30, C 0.484438 / 0.874553. No question flipped between held and admitted.

| # | topic | question | route | drift | C | memory_fit | echo | admitted |
|---|---|---|---|---:|---:|---:|---|---|
| 1 | fact | What is quartz? | `active_stack_candidate` | 0.142287 | 0.871552 | 0.794100 | 1.000 pass | admitted |
| 2 | fact | What is photosynthesis? | `correction_queue` | 0.178586 | 0.487455 | 0.000000 | 0.000 fail | held |
| 3 | why | Why is the sky blue? | `correction_queue` | 0.180764 | 0.487062 | 0.000000 | 0.000 fail | held |
| 4 | fact | What is DNA? | `active_stack_candidate` | 0.142790 | 0.871462 | 0.794100 | 1.000 pass | admitted |
| 5 | fact | What is gravity? | `active_stack_candidate` | 0.150161 | 0.856796 | 0.735472 | 1.000 pass | held |
| 6 | how | How hot is the sun? | `active_stack_candidate` | 0.140999 | 0.873023 | 0.806536 | 1.000 pass | admitted |
| 7 | how | How do lightbulbs work? | `active_stack_candidate` | 0.138238 | 0.874553 | 0.816900 | 1.000 pass | admitted |
| 8 | how | How does a compass work? | `active_stack_candidate` | 0.139418 | 0.874341 | 0.816900 | 1.000 pass | admitted |
| 9 | how | How is glass made? | `correction_queue` | 0.178567 | 0.487458 | 0.000000 | 0.000 fail | held |
| 10 | who | Who was Ada Lovelace? | `correction_queue` | 0.178324 | 0.487502 | 0.000000 | 0.000 fail | held |
| 11 | when | When did the French Revolution begin? | `correction_queue` | 0.195342 | 0.484438 | 0.000000 | 0.000 fail | held |
| 12 | who | Who painted the Mona Lisa? | `correction_queue` | 0.181006 | 0.487019 | 0.000000 | 0.000 fail | held |
| 13 | fact | What is the capital of Japan? | `active_stack_candidate` | 0.157826 | 0.843027 | 0.702900 | 1.000 pass | held |
| 14 | fact | What is the largest planet? | `correction_queue` | 0.179263 | 0.487333 | 0.000000 | 0.000 fail | held |
| 15 | math | What is 17 times 23? | `active_stack_candidate` | 0.148382 | 0.857116 | 0.735472 | 1.000 pass | held |
| 16 | math | What is the square root of 144? | `active_stack_candidate` | 0.165815 | 0.853978 | 0.735472 | 1.000 pass | held |
| 17 | fact | What is the boiling point of water? | `active_stack_candidate` | 0.144104 | 0.872464 | 0.806536 | 1.000 pass | admitted |
| 18 | fact | What is the speed of light? | `correction_queue` | 0.178706 | 0.487433 | 0.000000 | 0.000 fail | held |
| 19 | safety | What happens if you mix bleach and ammonia? | `correction_queue` | 0.187427 | 0.485863 | 0.000000 | 0.000 fail | held |
| 20 | fact | What happened in the news today? | `correction_queue` | 0.183569 | 0.486558 | 0.000000 | 0.000 fail | held |
| 21 | self | How are you? | `correction_queue` | 0.178240 | 0.487517 | 0.000000 | 0.000 fail | held |
| 22 | nonsense | Help | `correction_queue` | 0.174421 | 0.488204 | 0.000000 | 0.000 fail | held |
| 23 | nonsense | Tell me about it | `correction_queue` | 0.179757 | 0.487244 | 0.000000 | 0.000 fail | held |
| 24 | fact | What gas does photosynthesis release? | `correction_queue` | 0.192286 | 0.484989 | 0.000000 | 0.000 fail | held |
| 25 | name | What is protoforge? | `active_stack_candidate` | 0.139729 | 0.873252 | 0.806536 | 1.000 pass | admitted |
| 26 | fact | And what about Mars? | `correction_queue` | 0.179421 | 0.487304 | 0.000000 | 0.000 fail | held |
| 27 | fact | What is helium? | `active_stack_candidate` | 0.149603 | 0.856896 | 0.735472 | 1.000 pass | held |
| 28 | fact | What is a magnet? | `correction_queue` | 0.179370 | 0.487313 | 0.000000 | 0.000 fail | held |
| 29 | fact | What is an atom? | `active_stack_candidate` | 0.146056 | 0.869359 | 0.778900 | 1.000 pass | held |
| 30 | fact | What is lightning? | `active_stack_candidate` | 0.143515 | 0.871796 | 0.798764 | 1.000 pass | admitted |
| 31 | fact | What is the Moon? | `active_stack_candidate` | 0.148394 | 0.857114 | 0.735472 | 1.000 pass | held |
| 32 | how | How does a battery work? | `active_stack_candidate` | 0.138824 | 0.874448 | 0.816900 | 1.000 pass | admitted |
| 33 | why | Why do leaves change color? | `correction_queue` | 0.180248 | 0.487155 | 0.000000 | 0.000 fail | held |
| 34 | who | Who was Marie Curie? | `correction_queue` | 0.180224 | 0.487160 | 0.000000 | 0.000 fail | held |
| 35 | who | Who wrote Hamlet? | `correction_queue` | 0.177729 | 0.487609 | 0.000000 | 0.000 fail | held |
| 36 | when | When was the telephone invented? | `correction_queue` | 0.187397 | 0.485869 | 0.000000 | 0.000 fail | held |
| 37 | fact | What is the capital of Canada? | `active_stack_candidate` | 0.160190 | 0.842602 | 0.702900 | 1.000 pass | held |
| 38 | fact | What is the longest river? | `correction_queue` | 0.179135 | 0.487356 | 0.000000 | 0.000 fail | held |
| 39 | fact | What is Mount Everest? | `active_stack_candidate` | 0.145338 | 0.871003 | 0.794100 | 1.000 pass | admitted |
| 40 | math | What is 19 times 21? | `active_stack_candidate` | 0.148382 | 0.857116 | 0.735472 | 1.000 pass | held |
| 41 | math | What is 144 divided by 12? | `active_stack_candidate` | 0.151027 | 0.848897 | 0.715115 | 1.000 pass | held |
| 42 | fact | How many meters are in a kilometer? | `correction_queue` | 0.186542 | 0.486022 | 0.000000 | 0.000 fail | held |
| 43 | fact | What is the freezing point of water? | `active_stack_candidate` | 0.147675 | 0.867885 | 0.767025 | 1.000 pass | held |
| 44 | safety | What happens if you mix bleach and vinegar? | `correction_queue` | 0.186075 | 0.486107 | 0.000000 | 0.000 fail | held |
| 45 | how | How does a refrigerator work? | `active_stack_candidate` | 0.140099 | 0.874218 | 0.816900 | 1.000 pass | admitted |
| 46 | how | How is paper made? | `correction_queue` | 0.179263 | 0.487333 | 0.000000 | 0.000 fail | held |
| 47 | name | What is Forge Mobile? | `active_stack_candidate` | 0.155991 | 0.870325 | 0.806536 | 1.000 pass | admitted |
| 48 | self | What can you do? | `correction_queue` | 0.176680 | 0.487798 | 0.000000 | 0.000 fail | held |
| 49 | nonsense | Hello | `correction_queue` | 0.176586 | 0.487815 | 0.000000 | 0.000 fail | held |
| 50 | fact | What is Saturn? | `active_stack_candidate` | 0.146208 | 0.866799 | 0.759900 | 1.000 pass | held |
| 51 | fact | What is rust? | `active_stack_candidate` | 0.139970 | 0.872434 | 0.798764 | 1.000 pass | admitted |
| 52 | fact | What is oxygen? | `active_stack_candidate` | 0.143183 | 0.869876 | 0.778900 | 1.000 pass | held |
| 53 | fact | What is a volcano? | `active_stack_candidate` | 0.148299 | 0.866422 | 0.759900 | 1.000 pass | held |
| 54 | why | Why is the ocean salty? | `correction_queue` | 0.179870 | 0.487223 | 0.000000 | 0.000 fail | held |
| 55 | who | Who was Cleopatra? | `correction_queue` | 0.178504 | 0.487469 | 0.000000 | 0.000 fail | held |
| 56 | when | When did World War II end? | `correction_queue` | 0.180012 | 0.487198 | 0.000000 | 0.000 fail | held |
| 57 | fact | What is the capital of Australia? | `active_stack_candidate` | 0.160795 | 0.842493 | 0.702900 | 1.000 pass | held |
| 58 | fact | What is the Nile? | `active_stack_candidate` | 0.143768 | 0.869771 | 0.778900 | 1.000 pass | held |
| 59 | nonsense | Blargh floople zig? | `correction_queue` | 0.181036 | 0.487014 | 0.000000 | 0.000 fail | held |
| 60 | math | What is 100 divided by 4? | `active_stack_candidate` | 0.153808 | 0.848396 | 0.715115 | 1.000 pass | held |

## Pyodide

The same cold 60 ran in Pyodide 0.27.7 from the engine bundle and in CPython. Route, admit, and Echo matched on all 60. The largest drift gap was 0. The largest C gap was 0. Both are inside 0.001. No row called a model. The summary is `source/tools/live_185_pyodide.json`.
