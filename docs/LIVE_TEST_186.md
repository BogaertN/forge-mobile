# Live test 4.9.186

The same 60 questions ran through `rmc_engine_v1.rmc_core.run` with `live: true` three times: cold, then two fill passes. Cold memory is `source/data/ask_183_memory.json` plus one quarantined Wikipedia intro per question (`source/data/ask_186_research.json`). Those intros are evidence, not seeds. A pass writes a reply only when the admit gate passes, and the next pass recalls that sentence. C_min stays 0.87. Echo stays 0.85. The coherence formula is unchanged. No model is called.

Gilligan connects a quarantined sentence to an admitted concept by a shared frame role or a shared Doc 4 concept, then phase-align. Drift at or under 0.35 lets Athena place a packet. The gate still decides. On the cold pass, 19 excerpts were placed (`ATHENA-RESONANCE-PLACE`), 14 had no resonant ancestor (`DREAM-QUARANTINE-NO-TRUTH`), and 27 had no excerpt that connected. One question that 4.9.185 held, "What is the Moon?", now admits. The next two passes keep 14 admitted. Their scored columns do not move. Two spoken replies change because the newly stored sentence is a hop, not because C moved.

## Growth

| pass | admitted | held | Echo pass | route `active_stack_candidate` | route `correction_queue` | C min | C max |
|---|---:|---:|---:|---:|---:|---:|---:|
| cold | 14 | 46 | 30 | 30 | 30 | 0.484438 | 0.880616 |
| pass 2 | 14 | 46 | 30 | 30 | 30 | 0.484438 | 0.880616 |
| pass 3 | 14 | 46 | 30 | 30 | 30 | 0.484438 | 0.880616 |

4.9.185 cold, with no web excerpt, admitted 13. This cold pass admits 14. Pass 2 and pass 3 stay at 14.

## Richer answers

Cold "How hot is the sun?": "The sun is hot. Its surface is about 5500 degrees Celsius."

Cold "What is the Moon?" (held in 4.9.185): "The Moon is the only natural satellite of Earth. The Moon is Earth's natural satellite." C 0.871982, memory_fit 0.791291, Echo 1 pass, route `active_stack_candidate`.

Cold "What is lightning?": "Lightning is a natural phenomenon consisting of electrostatic discharges occurring through the atmosphere between two electrically charged regions. Lightning is a discharge of electricity between a cloud and the ground or another cloud." C 0.880616.

Pass 2 "What is DNA?" speaks the anchored excerpt as well as the stored sentence: "Deoxyribonucleic acid (; DNA) is a polymer composed of two polynucleotide chains that coil around each other to form a double helix." The parenthesis is in the Wikipedia intro. It was not rewritten. C stays 0.871462.

## Cold

| # | topic | question | route | drift | C | memory_fit | echo | admitted |
|---|---|---|---|---:|---:|---:|---|---|
| 1 | fact | What is quartz? | `active_stack_candidate` | 0.136110 | 0.876001 | 0.827587 | 1.000 pass | admitted |
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
| 30 | fact | What is lightning? | `active_stack_candidate` | 0.134793 | 0.880616 | 0.871516 | 1.000 pass | admitted |
| 31 | fact | What is the Moon? | `active_stack_candidate` | 0.138347 | 0.871982 | 0.791291 | 1.000 pass | admitted |
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

## Pass 2 and pass 3

Route, drift, C, memory_fit, Echo, and admitted match the cold row on all 60 questions in both passes. The spoken text changes on two admitted questions.

| question | cold reply | pass 2 reply |
|---|---|---|
| What is quartz? | Quartz is a hard mineral composed of silica (silicon dioxide). Quartz is a hard crystalline mineral made of silicon dioxide. | Quartz is a hard crystalline mineral made of silicon dioxide. Quartz is a hard mineral composed of silica (silicon dioxide). |
| What is DNA? | DNA is the molecule that stores genetic instructions in living cells. | Deoxyribonucleic acid (; DNA) is a polymer composed of two polynucleotide chains that coil around each other to form a double helix. |

Pass 3 matches pass 2 on every reply. No row called a model.

## Pyodide

The same cold 60, with the same quarantined excerpts, ran in Pyodide 0.27.7 from the engine bundle and in CPython. Route, admit, and Echo matched on all 60. The largest drift gap was 0. The largest C gap was 0. Both are inside 0.001. Admitted was 14 in both. No row called a model. The summary is `source/tools/live_186_pyodide.json`.

