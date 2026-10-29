# Live test 4.9.187

The same 60 questions ran through `rmc_engine_v1.rmc_core.run` with `live: true` three times: cold, then two fill passes. Cold memory is `source/data/ask_183_memory.json`, the trusted anchor set `source/data/anchors_187.json`, and one quarantined Wikipedia intro per question. Wikipedia is low trust. It can point at an anchor. It is not a premise. A pass writes a reply only when the admit gate passes, and only when that sentence is not already in the bank. C_min stays 0.87. Echo stays 0.85. The coherence formula is unchanged. No model is called.

Cold admits 16. 4.9.186 admitted 14. Photosynthesis and the speed of light are the new admits. The Moon, which 4.9.186 admitted, stays held: C is 0.857, under 0.87. Glass is 0.8695. The sky is 0.804. The gate was not lowered.

## Growth

| pass | admitted | held | Echo pass | route `active_stack_candidate` | route `correction_queue` | C min | C max |
|---|---:|---:|---:|---:|---:|---:|---:|
| cold | 16 | 44 | 48 | 40 | 20 | 0.484438 | 0.874553 |
| pass 2 | 16 | 44 | 49 | 40 | 20 | 0.484438 | 0.874553 |
| pass 3 | 16 | 44 | 47 | 40 | 20 | 0.484438 | 0.874553 |

Admitted replies are the same on all three passes. Echo on three held questions moves (sky, helium, telephone) while C does not. No row called a model. No reply is the renderer draft.

## Pyodide

A 60-question Pyodide pass was not run in this environment. The worker bundle was rebuilt from the same engine sources, including `source_trust.py` and `anchor_concepts.json`, and `src/rmc_client.js` carries the new SHA-384. The browser Ask path uses that bundle and, if the worker cannot load, `POST /api/rmc/deep-dry-run`, which is the same `rmc_core.run`.

## Samples

- What is photosynthesis? (admitted, C 0.874236, memory_fit 0.8169, Echo 1.0): Photosynthesis is essential to all life on earth; both plants and animals depend on it.
- Why is the sky blue? (held, C 0.803883, memory_fit 0.531669, Echo 1.0): Held.
- What is DNA? (admitted, C 0.871462, memory_fit 0.7941, Echo 1.0): DNA is the molecule that stores genetic instructions in living cells.
- How does a compass work? (admitted, C 0.874341, memory_fit 0.8169, Echo 1.0): A compass does work by aligning a magnetized needle with Earth's magnetic field.
- How is glass made? (held, C 0.869540, memory_fit 0.7789, Echo 1.0): Held.
- What is the speed of light? (admitted, C 0.874102, memory_fit 0.8169, Echo 1.0): The speed of light in vacuum is about 299792 kilometers per second.

## Cold

| # | topic | question | route | drift | C | memory_fit | echo | admitted |
|---|---|---|---|---:|---:|---:|---|---|
| 1 | fact | What is quartz? | `active_stack_candidate` | 0.142287 | 0.871552 | 0.794100 | 1.000 pass | admitted |
| 2 | fact | What is photosynthesis? | `active_stack_candidate` | 0.140002 | 0.874236 | 0.816900 | 1.000 pass | admitted |
| 3 | why | Why is the sky blue? | `active_stack_candidate` | 0.153825 | 0.803883 | 0.531669 | 1.000 pass | held |
| 4 | fact | What is DNA? | `active_stack_candidate` | 0.142790 | 0.871462 | 0.794100 | 1.000 pass | admitted |
| 5 | fact | What is gravity? | `active_stack_candidate` | 0.150161 | 0.856796 | 0.735472 | 1.000 pass | held |
| 6 | how | How hot is the sun? | `active_stack_candidate` | 0.140999 | 0.873023 | 0.806536 | 1.000 pass | admitted |
| 7 | how | How do lightbulbs work? | `active_stack_candidate` | 0.138238 | 0.874553 | 0.816900 | 1.000 pass | admitted |
| 8 | how | How does a compass work? | `active_stack_candidate` | 0.139418 | 0.874341 | 0.816900 | 1.000 pass | admitted |
| 9 | how | How is glass made? | `active_stack_candidate` | 0.145051 | 0.869540 | 0.778900 | 1.000 pass | held |
| 10 | who | Who was Ada Lovelace? | `correction_queue` | 0.178324 | 0.487502 | 0.000000 | 1.000 pass | held |
| 11 | when | When did the French Revolution begin? | `correction_queue` | 0.195342 | 0.484438 | 0.000000 | 1.000 pass | held |
| 12 | who | Who painted the Mona Lisa? | `correction_queue` | 0.181006 | 0.487019 | 0.000000 | 1.000 pass | held |
| 13 | fact | What is the capital of Japan? | `active_stack_candidate` | 0.159017 | 0.829942 | 0.673771 | 1.000 pass | held |
| 14 | fact | What is the largest planet? | `correction_queue` | 0.179263 | 0.487333 | 0.000000 | 0.500 fail | held |
| 15 | math | What is 17 times 23? | `active_stack_candidate` | 0.148382 | 0.857116 | 0.735472 | 1.000 pass | held |
| 16 | math | What is the square root of 144? | `active_stack_candidate` | 0.165815 | 0.853978 | 0.735472 | 1.000 pass | held |
| 17 | fact | What is the boiling point of water? | `active_stack_candidate` | 0.144104 | 0.872464 | 0.806536 | 1.000 pass | admitted |
| 18 | fact | What is the speed of light? | `active_stack_candidate` | 0.140746 | 0.874102 | 0.816900 | 1.000 pass | admitted |
| 19 | safety | What happens if you mix bleach and ammonia? | `correction_queue` | 0.187427 | 0.485863 | 0.000000 | 1.000 pass | held |
| 20 | fact | What happened in the news today? | `active_stack_candidate` | 0.145914 | 0.872139 | 0.806536 | 0.000 fail | held |
| 21 | self | How are you? | `correction_queue` | 0.178240 | 0.487517 | 0.000000 | 0.000 fail | held |
| 22 | nonsense | Help | `correction_queue` | 0.174421 | 0.488204 | 0.000000 | 0.000 fail | held |
| 23 | nonsense | Tell me about it | `correction_queue` | 0.179757 | 0.487244 | 0.000000 | 0.000 fail | held |
| 24 | fact | What gas does photosynthesis release? | `active_stack_candidate` | 0.154325 | 0.871657 | 0.816900 | 1.000 pass | admitted |
| 25 | name | What is protoforge? | `active_stack_candidate` | 0.139729 | 0.873252 | 0.806536 | 1.000 pass | admitted |
| 26 | fact | And what about Mars? | `active_stack_candidate` | 0.147843 | 0.866504 | 0.759900 | 1.000 pass | held |
| 27 | fact | What is helium? | `active_stack_candidate` | 0.149603 | 0.856896 | 0.735472 | 0.000 fail | held |
| 28 | fact | What is a magnet? | `active_stack_candidate` | 0.143963 | 0.869736 | 0.778900 | 1.000 pass | held |
| 29 | fact | What is an atom? | `active_stack_candidate` | 0.146056 | 0.869359 | 0.778900 | 0.000 fail | held |
| 30 | fact | What is lightning? | `active_stack_candidate` | 0.143515 | 0.871796 | 0.798764 | 1.000 pass | admitted |
| 31 | fact | What is the Moon? | `active_stack_candidate` | 0.148394 | 0.857114 | 0.735472 | 1.000 pass | held |
| 32 | how | How does a battery work? | `active_stack_candidate` | 0.138824 | 0.874448 | 0.816900 | 1.000 pass | admitted |
| 33 | why | Why do leaves change color? | `correction_queue` | 0.180248 | 0.487155 | 0.000000 | 1.000 pass | held |
| 34 | who | Who was Marie Curie? | `correction_queue` | 0.180224 | 0.487160 | 0.000000 | 1.000 pass | held |
| 35 | who | Who wrote Hamlet? | `correction_queue` | 0.177729 | 0.487609 | 0.000000 | 1.000 pass | held |
| 36 | when | When was the telephone invented? | `correction_queue` | 0.187397 | 0.485869 | 0.000000 | 0.000 fail | held |
| 37 | fact | What is the capital of Canada? | `active_stack_candidate` | 0.161380 | 0.829517 | 0.673771 | 1.000 pass | held |
| 38 | fact | What is the longest river? | `correction_queue` | 0.179135 | 0.487356 | 0.000000 | 1.000 pass | held |
| 39 | fact | What is Mount Everest? | `active_stack_candidate` | 0.145338 | 0.871003 | 0.794100 | 1.000 pass | admitted |
| 40 | math | What is 19 times 21? | `active_stack_candidate` | 0.148382 | 0.857116 | 0.735472 | 1.000 pass | held |
| 41 | math | What is 144 divided by 12? | `active_stack_candidate` | 0.151027 | 0.848897 | 0.715115 | 1.000 pass | held |
| 42 | fact | How many meters are in a kilometer? | `active_stack_candidate` | 0.150391 | 0.867964 | 0.772725 | 1.000 pass | held |
| 43 | fact | What is the freezing point of water? | `active_stack_candidate` | 0.147675 | 0.867885 | 0.767025 | 1.000 pass | held |
| 44 | safety | What happens if you mix bleach and vinegar? | `correction_queue` | 0.186075 | 0.486107 | 0.000000 | 1.000 pass | held |
| 45 | how | How does a refrigerator work? | `active_stack_candidate` | 0.140099 | 0.874218 | 0.816900 | 1.000 pass | admitted |
| 46 | how | How is paper made? | `active_stack_candidate` | 0.144444 | 0.869649 | 0.778900 | 1.000 pass | held |
| 47 | name | What is Forge Mobile? | `active_stack_candidate` | 0.155991 | 0.870325 | 0.806536 | 1.000 pass | admitted |
| 48 | self | What can you do? | `correction_queue` | 0.176680 | 0.487798 | 0.000000 | 0.000 fail | held |
| 49 | nonsense | Hello | `correction_queue` | 0.176586 | 0.487815 | 0.000000 | 0.000 fail | held |
| 50 | fact | What is Saturn? | `active_stack_candidate` | 0.146208 | 0.866799 | 0.759900 | 0.000 fail | held |
| 51 | fact | What is rust? | `active_stack_candidate` | 0.139970 | 0.872434 | 0.798764 | 1.000 pass | admitted |
| 52 | fact | What is oxygen? | `active_stack_candidate` | 0.143183 | 0.869876 | 0.778900 | 1.000 pass | held |
| 53 | fact | What is a volcano? | `active_stack_candidate` | 0.148299 | 0.866422 | 0.759900 | 1.000 pass | held |
| 54 | why | Why is the ocean salty? | `correction_queue` | 0.179870 | 0.487223 | 0.000000 | 1.000 pass | held |
| 55 | who | Who was Cleopatra? | `correction_queue` | 0.178504 | 0.487469 | 0.000000 | 1.000 pass | held |
| 56 | when | When did World War II end? | `correction_queue` | 0.180012 | 0.487198 | 0.000000 | 1.000 pass | held |
| 57 | fact | What is the capital of Australia? | `active_stack_candidate` | 0.161985 | 0.829408 | 0.673771 | 1.000 pass | held |
| 58 | fact | What is the Nile? | `active_stack_candidate` | 0.143768 | 0.869771 | 0.778900 | 1.000 pass | held |
| 59 | nonsense | Blargh floople zig? | `correction_queue` | 0.181036 | 0.487014 | 0.000000 | 0.000 fail | held |
| 60 | math | What is 100 divided by 4? | `active_stack_candidate` | 0.153808 | 0.848396 | 0.715115 | 1.000 pass | held |

