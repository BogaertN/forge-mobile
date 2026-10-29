# Live test 4.9.184

The same 60 questions ran through `rmc_engine_v1.rmc_core.run` with `live: true` in python3, and again in the browser through the Pyodide worker. Observe, Derive, and the EchoForge debate run between recall and the renderer. C_min stays 0.87. Echo stays 0.85. No model is called. ChristPing is not started.

Memory is `source/data/ask_183_memory.json`. The admit score is still `measurement_kernel.coherence_components` on the scorer's selected candidate. Derive does not replace that formula and does not add a bonus.

## Result

| | count |
|---|---:|
| questions | 60 |
| route `active_stack_candidate` | 57 |
| route `correction_queue` | 3 (the why-questions) |
| route `spc_cold_storage_required` | 0 |
| Echo pass (>= 0.85) | 50 |
| Derive `supported_only` | 53 |
| Derive `undetermined` | 7 |
| admitted | 0 |
| held | 60 |
| C min / max | 0.648243 / 0.835833 |
| C versus 4.9.183 on the same scorer | max unchanged at 0.835833; largest row gap 0.000489 |

## Why C does not reach 0.87

The highest row is "How hot is the sun?" at C 0.835833. The gap to 0.87 is 0.034167. The formula was not edited:

`0.24*memory_fit + 0.20*phase_validity + 0.18*drift_containment + 0.14*source_confidence + 0.10*utility_fit + 0.08*bounded_novelty_score + 0.06*operator_legality - conflict_penalty - projection_gate_penalty`

On that row the terms are memory_fit 0.675568, phase_validity 0.92, drift_containment 0.839655, source_confidence 0.852525, utility_fit 0.84, bounded_novelty_score 0.940062, operator_legality 1, both penalties 0. memory_fit is the short term. It is `0.35*max_similarity + 0.22*avg_top5 + 0.18*phase_density + 0.15*avg_retrieval_weight + 0.10*source_confidence` inside `measurement_kernel.memory_relation`. Raising that memory_fit by about 0.143 (to about 0.818) would close the 0.034 gap at the 0.24 weight. That takes recalled nodes whose text is closer to the candidate the scorer already selected, with higher retrieval weight. It is not a weight change, and it is not the derived sentence substituted in as the score.

A derived claim measured on its own, with `candidate_kind` `derived_claim` so utility stays the default 0.62, scores about 0.76 on the quartz chain in the unit test. Putting that number in place of the scorer would lower C. The chain is spoken only as `derived_text` when the debate survives; the admit gate still uses the scorer.

The lowest row is "Why do leaves change color?" at C 0.648243. memory_fit there is 0.201188 and utility_fit is 0.62. The route is `correction_queue`, so the renderer does not run and Echo is 0 even though Derive found the admitted sentence. The three why-questions are that route. The seven undetermined rows are the news, self, and nonsense questions: the question has no content token that an admitted fact covers, or no content token at all. Echo fails there too. A passing Echo does not admit.

Derived-claim drift on the survivors stays at or under 0.139, under the 0.35 band, so chi is `CHI_T_NOT_REQUIRED` and ChristPing is not started. Quarantined research is observed and is not a premise.

## Per question

| # | topic | question | route | drift | C | echo | admit | derive |
|---|---|---|---|---:|---:|---|---|---|
| 1 | fact | What is quartz? | `active_stack_candidate` | 0.161291 | 0.827250 | 1.000 pass | held | supported_only direct |
| 2 | fact | What is photosynthesis? | `active_stack_candidate` | 0.161381 | 0.825599 | 1.000 pass | held | supported_only direct |
| 3 | why | Why is the sky blue? | `correction_queue` | 0.186593 | 0.661267 | 0.000 fail | held | supported_only direct |
| 4 | fact | What is DNA? | `active_stack_candidate` | 0.161917 | 0.826995 | 1.000 pass | held | supported_only direct |
| 5 | fact | What is gravity? | `active_stack_candidate` | 0.162882 | 0.820925 | 1.000 pass | held | supported_only direct |
| 6 | how | How hot is the sun? | `active_stack_candidate` | 0.160345 | 0.835833 | 1.000 pass | held | supported_only direct |
| 7 | how | How do lightbulbs work? | `active_stack_candidate` | 0.162207 | 0.822980 | 1.000 pass | held | supported_only direct |
| 8 | how | How does a compass work? | `active_stack_candidate` | 0.162982 | 0.823308 | 1.000 pass | held | supported_only direct |
| 9 | how | How is glass made? | `active_stack_candidate` | 0.162208 | 0.825374 | 1.000 pass | held | supported_only direct |
| 10 | who | Who was Ada Lovelace? | `active_stack_candidate` | 0.162351 | 0.819668 | 1.000 pass | held | supported_only direct |
| 11 | when | When did the French Revolution begin? | `active_stack_candidate` | 0.179209 | 0.816657 | 1.000 pass | held | supported_only direct |
| 12 | who | Who painted the Mona Lisa? | `active_stack_candidate` | 0.164843 | 0.822399 | 1.000 pass | held | supported_only direct |
| 13 | fact | What is the capital of Japan? | `active_stack_candidate` | 0.165764 | 0.823311 | 1.000 pass | held | supported_only direct |
| 14 | fact | What is the largest planet? | `active_stack_candidate` | 0.161424 | 0.828447 | 1.000 pass | held | supported_only direct |
| 15 | math | What is 17 times 23? | `active_stack_candidate` | 0.161495 | 0.820024 | 1.000 pass | held | supported_only direct |
| 16 | math | What is the square root of 144? | `active_stack_candidate` | 0.177428 | 0.821172 | 1.000 pass | held | supported_only direct |
| 17 | fact | What is the boiling point of water? | `active_stack_candidate` | 0.162566 | 0.832799 | 1.000 pass | held | supported_only direct |
| 18 | fact | What is the speed of light? | `active_stack_candidate` | 0.162085 | 0.833213 | 1.000 pass | held | supported_only direct |
| 19 | safety | What happens if you mix bleach and ammonia? | `active_stack_candidate` | 0.169072 | 0.826475 | 1.000 pass | held | supported_only direct |
| 20 | fact | What happened in the news today? | `active_stack_candidate` | 0.166332 | 0.826979 | 0.000 fail | held | undetermined |
| 21 | self | How are you? | `active_stack_candidate` | 0.159866 | 0.825254 | 0.000 fail | held | undetermined |
| 22 | nonsense | Help | `active_stack_candidate` | 0.157170 | 0.821091 | 0.000 fail | held | undetermined |
| 23 | nonsense | Tell me about it | `active_stack_candidate` | 0.163139 | 0.820867 | 0.000 fail | held | undetermined |
| 24 | fact | What gas does photosynthesis release? | `active_stack_candidate` | 0.174876 | 0.817985 | 1.000 pass | held | supported_only direct |
| 25 | name | What is protoforge? | `active_stack_candidate` | 0.158904 | 0.830916 | 1.000 pass | held | supported_only direct |
| 26 | fact | And what about Mars? | `active_stack_candidate` | 0.162803 | 0.825613 | 1.000 pass | held | supported_only direct |
| 27 | fact | What is helium? | `active_stack_candidate` | 0.162544 | 0.821138 | 1.000 pass | held | supported_only direct |
| 28 | fact | What is a magnet? | `active_stack_candidate` | 0.160996 | 0.833642 | 1.000 pass | held | supported_only direct |
| 29 | fact | What is an atom? | `active_stack_candidate` | 0.162983 | 0.825623 | 1.000 pass | held | supported_only direct |
| 30 | fact | What is lightning? | `active_stack_candidate` | 0.163222 | 0.827303 | 1.000 pass | held | supported_only direct |
| 31 | fact | What is the Moon? | `active_stack_candidate` | 0.161013 | 0.829330 | 1.000 pass | held | supported_only direct |
| 32 | how | How does a battery work? | `active_stack_candidate` | 0.161585 | 0.823249 | 1.000 pass | held | supported_only direct |
| 33 | why | Why do leaves change color? | `correction_queue` | 0.186073 | 0.648243 | 0.000 fail | held | supported_only direct |
| 34 | who | Who was Marie Curie? | `active_stack_candidate` | 0.163010 | 0.817914 | 1.000 pass | held | supported_only direct |
| 35 | who | Who wrote Hamlet? | `active_stack_candidate` | 0.162263 | 0.812021 | 1.000 pass | held | supported_only direct |
| 36 | when | When was the telephone invented? | `active_stack_candidate` | 0.171368 | 0.821096 | 1.000 pass | held | supported_only direct |
| 37 | fact | What is the capital of Canada? | `active_stack_candidate` | 0.168128 | 0.822885 | 1.000 pass | held | supported_only direct |
| 38 | fact | What is the longest river? | `active_stack_candidate` | 0.161302 | 0.830605 | 1.000 pass | held | supported_only direct |
| 39 | fact | What is Mount Everest? | `active_stack_candidate` | 0.164205 | 0.827070 | 1.000 pass | held | supported_only direct |
| 40 | math | What is 19 times 21? | `active_stack_candidate` | 0.161634 | 0.819889 | 1.000 pass | held | supported_only direct |
| 41 | math | What is 144 divided by 12? | `active_stack_candidate` | 0.162762 | 0.818804 | 1.000 pass | held | supported_only direct |
| 42 | fact | How many meters are in a kilometer? | `active_stack_candidate` | 0.168746 | 0.816488 | 1.000 pass | held | supported_only direct |
| 43 | fact | What is the freezing point of water? | `active_stack_candidate` | 0.162480 | 0.827103 | 1.000 pass | held | supported_only direct |
| 44 | safety | What happens if you mix bleach and vinegar? | `active_stack_candidate` | 0.167672 | 0.825166 | 1.000 pass | held | supported_only direct |
| 45 | how | How does a refrigerator work? | `active_stack_candidate` | 0.163796 | 0.821365 | 1.000 pass | held | supported_only direct |
| 46 | how | How is paper made? | `active_stack_candidate` | 0.161912 | 0.825427 | 1.000 pass | held | supported_only direct |
| 47 | name | What is Forge Mobile? | `active_stack_candidate` | 0.175166 | 0.828344 | 1.000 pass | held | supported_only direct |
| 48 | self | What can you do? | `active_stack_candidate` | 0.158306 | 0.826281 | 0.000 fail | held | undetermined |
| 49 | nonsense | Hello | `active_stack_candidate` | 0.159335 | 0.820701 | 0.000 fail | held | undetermined |
| 50 | fact | What is Saturn? | `active_stack_candidate` | 0.161650 | 0.823396 | 1.000 pass | held | supported_only direct |
| 51 | fact | What is rust? | `active_stack_candidate` | 0.159927 | 0.827976 | 1.000 pass | held | supported_only direct |
| 52 | fact | What is oxygen? | `active_stack_candidate` | 0.159573 | 0.826315 | 1.000 pass | held | supported_only direct |
| 53 | fact | What is a volcano? | `active_stack_candidate` | 0.162907 | 0.824440 | 1.000 pass | held | supported_only direct |
| 54 | why | Why is the ocean salty? | `correction_queue` | 0.185699 | 0.661137 | 0.000 fail | held | supported_only direct |
| 55 | who | Who was Cleopatra? | `active_stack_candidate` | 0.162459 | 0.811595 | 1.000 pass | held | supported_only direct |
| 56 | when | When did World War II end? | `active_stack_candidate` | 0.164240 | 0.816415 | 1.000 pass | held | supported_only direct |
| 57 | fact | What is the capital of Australia? | `active_stack_candidate` | 0.168732 | 0.822777 | 1.000 pass | held | supported_only direct |
| 58 | fact | What is the Nile? | `active_stack_candidate` | 0.160753 | 0.834005 | 1.000 pass | held | supported_only direct |
| 59 | nonsense | Blargh floople zig? | `active_stack_candidate` | 0.163782 | 0.819903 | 0.000 fail | held | undetermined |
| 60 | math | What is 100 divided by 4? | `active_stack_candidate` | 0.164290 | 0.819326 | 1.000 pass | held | supported_only direct |

## Browser

The same 60 questions ran in the Ask page's Pyodide worker (`path: pyodide`) through `KRMCCore.run` with the same seed file. Route, Echo pass or fail, and admit matched python3 on all 60. Drift and C stayed within 0.001 (the largest gap was 0.000438). Every browser row was held, none called a model. C in the browser was 0.648239–0.835833. Echo passed 50 of 60.

The on-screen ask of "What is quartz?" goes through the page's own memory (the seed plus the starter pack), so that one card is not the seed-only row. It showed Held, route `active_stack_candidate`, drift 0.162358, C 0.817319, echo 1 pass. The trace showed Observe, Derive `supported_only` / `direct`, and the EchoForge debate (`proponent then opponent`, frame `FR.BE.COP`, survived, drift 0.127252 clean, chi `CHI_T_NOT_REQUIRED`, ChristPing not started). The rendered claim in the trace was "Quartz is a hard crystalline mineral made of silicon dioxide." Custody showed `dream_idle` switched off.
