# Live test 4.9.183

The same 60 questions ran through `rmc_engine_v1.rmc_core.run` with `live: true` in python3, and again in the browser through the Pyodide worker. Stages 14–16 execute. C_min stays 0.87. No model is called.

Memory for this table is `source/data/ask_183_memory.json` (admitted seed) compared with the three-row fixture from `source/tools/dryrun_182_questions.json` (`C thin`). Both columns are this release's scorer. The 4.9.182 published band was C 0.630–0.728 with every route `spc_cold_storage_required` and Echo 0.0, because Echo scored a placeholder sentence.

## Result

| | count |
|---|---:|
| questions | 60 |
| route `active_stack_candidate` | 57 |
| route `correction_queue` | 3 (the why-questions) |
| route `spc_cold_storage_required` | 0 |
| Echo pass (>= 0.85) | 50 |
| admitted | 0 |
| held | 60 |
| C seed min / max | 0.648243 / 0.835833 |
| C thin min / max | 0.645825 / 0.824660 |
| C versus 4.9.182 max 0.728041 | up 0.108 at the new max, still 0.034 under 0.87 |

Drift stays under 0.35 on every row. The three correction routes are the why-questions (sky, leaves, ocean), phase pressure, not a hard stop. Echo fails where the rendered claim does not carry the question's content tokens (news, self, nonsense, and the why-questions). A passing Echo does not admit. C_min is 0.87 and the highest C is 0.836.

Quarantined `research.web` text is recalled as evidence and is not the spoken claim. The screen shows Held plus this trace.

`reasoning_seam.run_reasoning_seam` runs after recall and before the renderer. It is unapplied, so these numbers do not include a Derive step or an EchoForge debate. 4.9.184 replaces that function.

## Per question

| # | topic | question | route | drift | C | C thin | echo | admit |
|---|---|---|---|---:|---:|---:|---|---|
| 1 | fact | What is quartz? | `active_stack_candidate` | 0.161259 | 0.827282 | 0.818562 | 1.000 pass | held |
| 2 | fact | What is photosynthesis? | `active_stack_candidate` | 0.161381 | 0.825599 | 0.824660 | 1.000 pass | held |
| 3 | why | Why is the sky blue? | `correction_queue` | 0.186593 | 0.661267 | 0.648232 | 0.000 fail | held |
| 4 | fact | What is DNA? | `active_stack_candidate` | 0.161917 | 0.826995 | 0.818488 | 1.000 pass | held |
| 5 | fact | What is gravity? | `active_stack_candidate` | 0.162882 | 0.820925 | 0.818269 | 1.000 pass | held |
| 6 | how | How hot is the sun? | `active_stack_candidate` | 0.160345 | 0.835833 | 0.817704 | 1.000 pass | held |
| 7 | how | How do lightbulbs work? | `active_stack_candidate` | 0.162445 | 0.822748 | 0.815250 | 1.000 pass | held |
| 8 | how | How does a compass work? | `active_stack_candidate` | 0.163134 | 0.823161 | 0.815038 | 1.000 pass | held |
| 9 | how | How is glass made? | `active_stack_candidate` | 0.162208 | 0.825374 | 0.818415 | 1.000 pass | held |
| 10 | who | Who was Ada Lovelace? | `active_stack_candidate` | 0.162335 | 0.819684 | 0.815335 | 1.000 pass | held |
| 11 | when | When did the French Revolution begin? | `active_stack_candidate` | 0.179072 | 0.816790 | 0.812272 | 1.000 pass | held |
| 12 | who | Who painted the Mona Lisa? | `active_stack_candidate` | 0.164843 | 0.822399 | 0.814852 | 1.000 pass | held |
| 13 | fact | What is the capital of Japan? | `active_stack_candidate` | 0.165764 | 0.823311 | 0.816532 | 1.000 pass | held |
| 14 | fact | What is the largest planet? | `active_stack_candidate` | 0.161561 | 0.828313 | 0.817665 | 1.000 pass | held |
| 15 | math | What is 17 times 23? | `active_stack_candidate` | 0.161634 | 0.819889 | 0.817918 | 1.000 pass | held |
| 16 | math | What is the square root of 144? | `active_stack_candidate` | 0.177428 | 0.821172 | 0.814150 | 1.000 pass | held |
| 17 | fact | What is the boiling point of water? | `active_stack_candidate` | 0.162647 | 0.832720 | 0.816667 | 1.000 pass | held |
| 18 | fact | What is the speed of light? | `active_stack_candidate` | 0.161955 | 0.833339 | 0.821512 | 1.000 pass | held |
| 19 | safety | What happens if you mix bleach and ammonia? | `active_stack_candidate` | 0.169072 | 0.826475 | 0.815259 | 1.000 pass | held |
| 20 | fact | What happened in the news today? | `active_stack_candidate` | 0.166332 | 0.826979 | 0.816473 | 0.000 fail | held |
| 21 | self | How are you? | `active_stack_candidate` | 0.159866 | 0.825254 | 0.815350 | 0.000 fail | held |
| 22 | nonsense | Help | `active_stack_candidate` | 0.157170 | 0.821091 | 0.816038 | 0.000 fail | held |
| 23 | nonsense | Tell me about it | `active_stack_candidate` | 0.163139 | 0.820867 | 0.815077 | 0.000 fail | held |
| 24 | fact | What gas does photosynthesis release? | `active_stack_candidate` | 0.174876 | 0.817985 | 0.817820 | 1.000 pass | held |
| 25 | name | What is protoforge? | `active_stack_candidate` | 0.158774 | 0.831043 | 0.816548 | 1.000 pass | held |
| 26 | fact | And what about Mars? | `active_stack_candidate` | 0.162803 | 0.825613 | 0.818262 | 1.000 pass | held |
| 27 | fact | What is helium? | `active_stack_candidate` | 0.162684 | 0.821002 | 0.818369 | 1.000 pass | held |
| 28 | fact | What is a magnet? | `active_stack_candidate` | 0.160996 | 0.833642 | 0.818271 | 1.000 pass | held |
| 29 | fact | What is an atom? | `active_stack_candidate` | 0.162983 | 0.825623 | 0.818235 | 1.000 pass | held |
| 30 | fact | What is lightning? | `active_stack_candidate` | 0.163222 | 0.827303 | 0.818029 | 1.000 pass | held |
| 31 | fact | What is the Moon? | `active_stack_candidate` | 0.161013 | 0.829330 | 0.818587 | 1.000 pass | held |
| 32 | how | How does a battery work? | `active_stack_candidate` | 0.161568 | 0.823265 | 0.815145 | 1.000 pass | held |
| 33 | why | Why do leaves change color? | `correction_queue` | 0.186073 | 0.648243 | 0.645825 | 0.000 fail | held |
| 34 | who | Who was Marie Curie? | `active_stack_candidate` | 0.163135 | 0.817792 | 0.814993 | 1.000 pass | held |
| 35 | who | Who wrote Hamlet? | `active_stack_candidate` | 0.162263 | 0.812021 | 0.815442 | 1.000 pass | held |
| 36 | when | When was the telephone invented? | `active_stack_candidate` | 0.171239 | 0.821221 | 0.813702 | 1.000 pass | held |
| 37 | fact | What is the capital of Canada? | `active_stack_candidate` | 0.168128 | 0.822885 | 0.816107 | 1.000 pass | held |
| 38 | fact | What is the longest river? | `active_stack_candidate` | 0.161302 | 0.830605 | 0.817688 | 1.000 pass | held |
| 39 | fact | What is Mount Everest? | `active_stack_candidate` | 0.164205 | 0.827070 | 0.817992 | 1.000 pass | held |
| 40 | math | What is 19 times 21? | `active_stack_candidate` | 0.161634 | 0.819889 | 0.817918 | 1.000 pass | held |
| 41 | math | What is 144 divided by 12? | `active_stack_candidate` | 0.162762 | 0.818804 | 0.816999 | 1.000 pass | held |
| 42 | fact | How many meters are in a kilometer? | `active_stack_candidate` | 0.168746 | 0.816488 | 0.815938 | 1.000 pass | held |
| 43 | fact | What is the freezing point of water? | `active_stack_candidate` | 0.161991 | 0.827578 | 0.816804 | 1.000 pass | held |
| 44 | safety | What happens if you mix bleach and vinegar? | `active_stack_candidate` | 0.167672 | 0.825166 | 0.815502 | 1.000 pass | held |
| 45 | how | How does a refrigerator work? | `active_stack_candidate` | 0.163796 | 0.821365 | 0.814915 | 1.000 pass | held |
| 46 | how | How is paper made? | `active_stack_candidate` | 0.161912 | 0.825427 | 0.818290 | 1.000 pass | held |
| 47 | name | What is Forge Mobile? | `active_stack_candidate` | 0.175166 | 0.828344 | 0.815669 | 1.000 pass | held |
| 48 | self | What can you do? | `active_stack_candidate` | 0.158074 | 0.826506 | 0.815631 | 0.000 fail | held |
| 49 | nonsense | Hello | `active_stack_candidate` | 0.159333 | 0.820704 | 0.815648 | 0.000 fail | held |
| 50 | fact | What is Saturn? | `active_stack_candidate` | 0.161650 | 0.823396 | 0.818532 | 1.000 pass | held |
| 51 | fact | What is rust? | `active_stack_candidate` | 0.159927 | 0.827976 | 0.818716 | 1.000 pass | held |
| 52 | fact | What is oxygen? | `active_stack_candidate` | 0.159539 | 0.826348 | 0.818737 | 1.000 pass | held |
| 53 | fact | What is a volcano? | `active_stack_candidate` | 0.162904 | 0.824443 | 0.818199 | 1.000 pass | held |
| 54 | why | Why is the ocean salty? | `correction_queue` | 0.185699 | 0.661137 | 0.648392 | 0.000 fail | held |
| 55 | who | Who was Cleopatra? | `active_stack_candidate` | 0.162313 | 0.811737 | 0.815303 | 1.000 pass | held |
| 56 | when | When did World War II end? | `active_stack_candidate` | 0.164240 | 0.816415 | 0.815031 | 1.000 pass | held |
| 57 | fact | What is the capital of Australia? | `active_stack_candidate` | 0.168539 | 0.822964 | 0.815998 | 1.000 pass | held |
| 58 | fact | What is the Nile? | `active_stack_candidate` | 0.160753 | 0.834005 | 0.818412 | 1.000 pass | held |
| 59 | nonsense | Blargh floople zig? | `active_stack_candidate` | 0.163784 | 0.819901 | 0.814847 | 0.000 fail | held |
| 60 | math | What is 100 divided by 4? | `active_stack_candidate` | 0.164139 | 0.819473 | 0.817416 | 1.000 pass | held |

## Browser

The same 60 questions ran in the Ask page's Pyodide worker (`path: pyodide`). Route, Echo pass or fail, and admit matched python3 on all 60. Drift and C stayed within 0.001 (the largest gap was 0.0006). Every browser row was held, none called a model, and stages 14–16 returned OK. The on-screen ask of "What is quartz?" showed Held, route `active_stack_candidate`, drift 0.162481, C 0.817199, echo 1 pass. Custody showed `dream_idle` switched off.
