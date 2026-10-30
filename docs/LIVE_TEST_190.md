# Live test 4.9.190

The same 60 questions ran through `rmc_engine_v1.rmc_core.run` with `live: true` three times: cold, then two fill passes. Cold memory is `source/data/ask_183_memory.json`, the trusted starter `source/data/anchors_187.json`, the concept shard selected for that question from `source/data/anchors_188/`, and one quarantined Wikipedia intro per question. Wikipedia is low trust. It can point at an anchor. It is not a premise. C_min stays 0.87. Echo stays 0.85. The coherence formula is unchanged. No model is called.

Cold admits 58. 4.9.189 admitted 32. The new admits are sentences the bank already held at the wrong phase or under a diluted memory_fit, plus speech-act replies from world-model self-facts. News stays held because Echo fails. Nonsense is refused. The three passes agree.

## Growth

| pass | admitted | held | Echo pass | route `active_stack_candidate` | route `correction_queue` | C min | C max |
|---|---:|---:|---:|---:|---:|---:|---:|
| cold | 58 | 2 | 58 | 59 | 1 | 0.487014 | 0.903662 |
| pass 2 | 58 | 2 | 58 | 59 | 1 | 0.487014 | 0.903662 |
| pass 3 | 58 | 2 | 58 | 59 | 1 | 0.487014 | 0.903662 |

Admitted replies are the same on all three passes. Derived text and Echo are the same on all three passes. No row called a model.

## Pyodide

The same cold payloads ran in Pyodide 0.27.7 and in python3. Route, admit, and Echo matched on all 60. Drift and C differed by at most the recorded gap. The summary is `source/tools/live_190_pyodide.json`.

## Held

| question | speech act | C | Echo | why it stays held |
|---|---|---:|---|---|
| What happened in the news today? | stated | 0.887150 | 0.000 fail | Echo fails. A time word is not a subject, and there is no sourced sentence for today's news. |
| Blargh floople zig? | refusal | 0.487014 | 0.000 fail | Uninterpreted. The speech act is refusal. No sentence is invented. |

## Samples

- Who was Ada Lovelace? (admitted, C 0.890888, Echo 1.0): Ada Lovelace wrote notes on Charles Babbage's analytical engine.
- Why is the sky blue? (admitted, C 0.887654, Echo 1.0): The sky looks blue because air scatters blue light more than other colors.
- What is the capital of Japan? (admitted, C 0.871528, Echo 1.0): Tokyo is the capital of Japan.
- Hello (admitted, C 0.889756, Echo 1.0): Hello.
- What happens if you mix bleach and ammonia? (admitted, C 0.891002, Echo 1.0): If you mix bleach and ammonia, what happens is toxic chloramine gas. Do not mix them.
- Why is the ocean salty? (admitted, C 0.887667, Echo 1.0): The ocean is salty because rivers carry dissolved salts into it.

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
| 10 | who | Who was Ada Lovelace? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 11 | when | When did the French Revolution begin? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 12 | who | Who painted the Mona Lisa? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 13 | fact | What is the capital of Japan? | `active_stack_candidate` | 0.114154 | 0.871528 | 0.885567 | 1.000 pass | admitted |
| 14 | fact | What is the largest planet? | `active_stack_candidate` | 0.126078 | 0.888102 | 0.930900 | 1.000 pass | admitted |
| 15 | math | What is 17 times 23? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 16 | math | What is the square root of 144? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 17 | fact | What is the boiling point of water? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 18 | fact | What is the speed of light? | `active_stack_candidate` | 0.127412 | 0.887862 | 0.930900 | 1.000 pass | admitted |
| 19 | safety | What happens if you mix bleach and ammonia? | `active_stack_candidate` | 0.109969 | 0.891002 | 0.930900 | 1.000 pass | admitted |
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
| 34 | who | Who was Marie Curie? | `active_stack_candidate` | 0.109336 | 0.891116 | 0.930900 | 1.000 pass | admitted |
| 35 | who | Who wrote Hamlet? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 36 | when | When was the telephone invented? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 37 | fact | What is the capital of Canada? | `active_stack_candidate` | 0.114154 | 0.871528 | 0.885567 | 1.000 pass | admitted |
| 38 | fact | What is the longest river? | `active_stack_candidate` | 0.109607 | 0.891067 | 0.930900 | 1.000 pass | admitted |
| 39 | fact | What is Mount Everest? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 40 | math | What is 19 times 21? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 41 | math | What is 144 divided by 12? | `active_stack_candidate` | 0.108557 | 0.891256 | 0.930900 | 1.000 pass | admitted |
| 42 | fact | How many meters are in a kilometer? | `active_stack_candidate` | 0.108364 | 0.891290 | 0.930900 | 1.000 pass | admitted |
| 43 | fact | What is the freezing point of water? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 44 | safety | What happens if you mix bleach and vinegar? | `active_stack_candidate` | 0.109918 | 0.891011 | 0.930900 | 1.000 pass | admitted |
| 45 | how | How does a refrigerator work? | `active_stack_candidate` | 0.126766 | 0.887978 | 0.930900 | 1.000 pass | admitted |
| 46 | how | How is paper made? | `active_stack_candidate` | 0.109607 | 0.891067 | 0.930900 | 1.000 pass | admitted |
| 47 | name | What is Forge Mobile? | `active_stack_candidate` | 0.109706 | 0.891049 | 0.930900 | 1.000 pass | admitted |
| 48 | self | What can you do? | `active_stack_candidate` | 0.109789 | 0.903662 | 0.938600 | 1.000 pass | admitted |
| 49 | nonsense | Hello | `active_stack_candidate` | 0.123931 | 0.889756 | 0.824600 | 1.000 pass | admitted |
| 50 | fact | What is Saturn? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 51 | fact | What is rust? | `active_stack_candidate` | 0.109706 | 0.891049 | 0.930900 | 1.000 pass | admitted |
| 52 | fact | What is oxygen? | `active_stack_candidate` | 0.125405 | 0.888223 | 0.930900 | 1.000 pass | admitted |
| 53 | fact | What is a volcano? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 54 | why | Why is the ocean salty? | `active_stack_candidate` | 0.128497 | 0.887667 | 0.930900 | 1.000 pass | admitted |
| 55 | who | Who was Cleopatra? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 56 | when | When did World War II end? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
| 57 | fact | What is the capital of Australia? | `active_stack_candidate` | 0.114154 | 0.871528 | 0.885567 | 1.000 pass | admitted |
| 58 | fact | What is the Nile? | `active_stack_candidate` | 0.125990 | 0.888118 | 0.930900 | 1.000 pass | admitted |
| 59 | nonsense | Blargh floople zig? | `correction_queue` | 0.181036 | 0.487014 | 0.000000 | 0.000 fail | held |
| 60 | math | What is 100 divided by 4? | `active_stack_candidate` | 0.110598 | 0.890888 | 0.930900 | 1.000 pass | admitted |
