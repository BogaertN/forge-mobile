# Live test 4.9.191

The same 60 questions ran through `rmc_engine_v1.rmc_core.run` with `live: true` three times: cold, then two fill passes. Cold memory is `source/data/ask_183_memory.json`. Wikipedia stays low trust and is not a premise. C_min stays 0.87. Echo stays 0.85. The coherence formula is unchanged. No model is called.

Cold admits 48. 4.9.190 admitted 58. The drop is the hosted sentences that had no source. Sky, leaves, and the ocean still admit. Their phases come from the lexicon: sky Φ4 ◊, leaves Φ5, ocean Φ1. The hand-set Φ4 on those three rows is gone. The three passes agree.

## Growth

| pass | admitted | held | Echo pass | route `active_stack_candidate` | route `correction_queue` | C min | C max |
|---|---:|---:|---:|---:|---:|---:|---:|
| cold | 48 | 12 | 48 | 50 | 10 | 0.484438 | 0.903662 |
| pass 2 | 48 | 12 | 48 | 50 | 10 | 0.484438 | 0.903662 |
| pass 3 | 48 | 12 | 48 | 50 | 10 | 0.484438 | 0.903662 |

Admitted replies are the same on all three passes. Derived text and Echo are the same on all three passes. No row called a model. Stable: True.

## Held

| question | C | Echo | why it stays held |
|---|---:|---|---|
| Who was Ada Lovelace? | 0.487502 | 0.000 fail | Hosted sentence has no source, license, or revision. The Wikipedia intro is low trust and is not a premise. |
| When did the French Revolution begin? | 0.484438 | 0.000 fail | Hosted sentence has no source. Not spoken. |
| Who painted the Mona Lisa? | 0.487019 | 0.000 fail | Hosted sentence has no source. Not spoken. |
| What happens if you mix bleach and ammonia? | 0.485863 | 0.000 fail | Hosted chloramine sentence has no source. Not spoken. |
| What happened in the news today? | 0.887150 | 0.000 fail | Echo fails. There is no sourced sentence for today's news. |
| Who was Marie Curie? | 0.487160 | 0.000 fail | Hosted sentence has no source. Not spoken. |
| Who wrote Hamlet? | 0.888320 | 0.500 fail | The hosted paraphrase has no source. The Gutenberg title page is a different sentence and Echo is 0.5, under 0.85. |
| When was the telephone invented? | 0.485869 | 0.000 fail | Hosted sentence has no source. Not spoken. |
| What happens if you mix bleach and vinegar? | 0.486107 | 0.000 fail | Hosted chlorine-gas sentence has no source. Not spoken. |
| Who was Cleopatra? | 0.487469 | 0.000 fail | Hosted sentence has no source. Not spoken. |
| When did World War II end? | 0.487198 | 0.000 fail | Hosted sentence has no source. Not spoken. |
| Blargh floople zig? | 0.487014 | 0.000 fail | Uninterpreted. The speech act is refusal. No sentence is invented. |

## Cold

| # | topic | question | route | drift | C | memory_fit | echo | admitted |
|---|---|---|---|---:|---:|---:|---|---|
| 1 | fact | What is quartz? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 2 | fact | What is photosynthesis? | `active_stack_candidate` | 0.109918 | 0.891011 | 0.930900 | 1.000 pass | admitted |
| 3 | why | Why is the sky blue? | `active_stack_candidate` | 0.128564 | 0.887654 | 0.930900 | 1.000 pass | admitted |
| 4 | fact | What is DNA? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 5 | fact | What is gravity? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 6 | how | How hot is the sun? | `active_stack_candidate` | 0.109607 | 0.891067 | 0.930900 | 1.000 pass | admitted |
| 7 | how | How do lightbulbs work? | `active_stack_candidate` | 0.124904 | 0.888313 | 0.930900 | 1.000 pass | admitted |
| 8 | how | How does a compass work? | `active_stack_candidate` | 0.109789 | 0.891034 | 0.930900 | 1.000 pass | admitted |
| 9 | how | How is glass made? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 10 | who | Who was Ada Lovelace? | `correction_queue` | 0.178324 | 0.487502 | 0.000000 | 0.000 fail | held |
| 11 | when | When did the French Revolution begin? | `correction_queue` | 0.195342 | 0.484438 | 0.000000 | 0.000 fail | held |
| 12 | who | Who painted the Mona Lisa? | `correction_queue` | 0.181006 | 0.487019 | 0.000000 | 0.000 fail | held |
| 13 | fact | What is the capital of Japan? | `active_stack_candidate` | 0.114154 | 0.871528 | 0.885567 | 1.000 pass | admitted |
| 14 | fact | What is the largest planet? | `active_stack_candidate` | 0.126078 | 0.888102 | 0.930900 | 1.000 pass | admitted |
| 15 | math | What is 17 times 23? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 16 | math | What is the square root of 144? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 17 | fact | What is the boiling point of water? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 18 | fact | What is the speed of light? | `active_stack_candidate` | 0.127412 | 0.887862 | 0.930900 | 1.000 pass | admitted |
| 19 | safety | What happens if you mix bleach and ammonia? | `correction_queue` | 0.187427 | 0.485863 | 0.000000 | 0.000 fail | held |
| 20 | fact | What happened in the news today? | `active_stack_candidate` | 0.131369 | 0.887150 | 0.930900 | 0.000 fail | held |
| 21 | self | How are you? | `active_stack_candidate` | 0.109789 | 0.903662 | 0.938600 | 1.000 pass | admitted |
| 22 | nonsense | Help | `active_stack_candidate` | 0.110014 | 0.903621 | 0.938600 | 1.000 pass | admitted |
| 23 | nonsense | Tell me about it | `active_stack_candidate` | 0.109789 | 0.903662 | 0.938600 | 1.000 pass | admitted |
| 24 | fact | What gas does photosynthesis release? | `active_stack_candidate` | 0.140992 | 0.885417 | 0.930900 | 1.000 pass | admitted |
| 25 | name | What is protoforge? | `active_stack_candidate` | 0.109706 | 0.891049 | 0.930900 | 1.000 pass | admitted |
| 26 | fact | And what about Mars? | `active_stack_candidate` | 0.127843 | 0.887784 | 0.930900 | 1.000 pass | admitted |
| 27 | fact | What is helium? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 28 | fact | What is a magnet? | `active_stack_candidate` | 0.109336 | 0.891116 | 0.930900 | 1.000 pass | admitted |
| 29 | fact | What is an atom? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 30 | fact | What is lightning? | `active_stack_candidate` | 0.109343 | 0.891114 | 0.930900 | 1.000 pass | admitted |
| 31 | fact | What is the Moon? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 32 | how | How does a battery work? | `active_stack_candidate` | 0.108109 | 0.891336 | 0.930900 | 1.000 pass | admitted |
| 33 | why | Why do leaves change color? | `active_stack_candidate` | 0.128954 | 0.887584 | 0.930900 | 1.000 pass | admitted |
| 34 | who | Who was Marie Curie? | `correction_queue` | 0.180224 | 0.487160 | 0.000000 | 0.000 fail | held |
| 35 | who | Who wrote Hamlet? | `active_stack_candidate` | 0.124869 | 0.888320 | 0.930900 | 0.500 fail | held |
| 36 | when | When was the telephone invented? | `correction_queue` | 0.187397 | 0.485869 | 0.000000 | 0.000 fail | held |
| 37 | fact | What is the capital of Canada? | `active_stack_candidate` | 0.114154 | 0.871528 | 0.885567 | 1.000 pass | admitted |
| 38 | fact | What is the longest river? | `active_stack_candidate` | 0.109607 | 0.891067 | 0.930900 | 1.000 pass | admitted |
| 39 | fact | What is Mount Everest? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 40 | math | What is 19 times 21? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 41 | math | What is 144 divided by 12? | `active_stack_candidate` | 0.108557 | 0.891256 | 0.930900 | 1.000 pass | admitted |
| 42 | fact | How many meters are in a kilometer? | `active_stack_candidate` | 0.108364 | 0.891290 | 0.930900 | 1.000 pass | admitted |
| 43 | fact | What is the freezing point of water? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 44 | safety | What happens if you mix bleach and vinegar? | `correction_queue` | 0.186075 | 0.486107 | 0.000000 | 0.000 fail | held |
| 45 | how | How does a refrigerator work? | `active_stack_candidate` | 0.126766 | 0.887978 | 0.930900 | 1.000 pass | admitted |
| 46 | how | How is paper made? | `active_stack_candidate` | 0.109607 | 0.891067 | 0.930900 | 1.000 pass | admitted |
| 47 | name | What is Forge Mobile? | `active_stack_candidate` | 0.109706 | 0.891049 | 0.930900 | 1.000 pass | admitted |
| 48 | self | What can you do? | `active_stack_candidate` | 0.109789 | 0.903662 | 0.938600 | 1.000 pass | admitted |
| 49 | nonsense | Hello | `active_stack_candidate` | 0.123931 | 0.889756 | 0.824600 | 1.000 pass | admitted |
| 50 | fact | What is Saturn? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 51 | fact | What is rust? | `active_stack_candidate` | 0.109706 | 0.891049 | 0.930900 | 1.000 pass | admitted |
| 52 | fact | What is oxygen? | `active_stack_candidate` | 0.125405 | 0.888223 | 0.930900 | 1.000 pass | admitted |
| 53 | fact | What is a volcano? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 54 | why | Why is the ocean salty? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 55 | who | Who was Cleopatra? | `correction_queue` | 0.178504 | 0.487469 | 0.000000 | 0.000 fail | held |
| 56 | when | When did World War II end? | `correction_queue` | 0.180012 | 0.487198 | 0.000000 | 0.000 fail | held |
| 57 | fact | What is the capital of Australia? | `active_stack_candidate` | 0.114154 | 0.871528 | 0.885567 | 1.000 pass | admitted |
| 58 | fact | What is the Nile? | `active_stack_candidate` | 0.125990 | 0.888118 | 0.930900 | 1.000 pass | admitted |
| 59 | nonsense | Blargh floople zig? | `correction_queue` | 0.181036 | 0.487014 | 0.000000 | 0.000 fail | held |
| 60 | math | What is 100 divided by 4? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |

