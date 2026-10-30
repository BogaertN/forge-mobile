# Live test 4.9.189

The same 60 questions ran through `rmc_engine_v1.rmc_core.run` with `live: true` three times: cold, then two fill passes. Cold memory is `source/data/ask_183_memory.json`, the trusted starter `source/data/anchors_187.json`, the concept shard selected for that question from `source/data/anchors_188/`, and one quarantined Wikipedia intro per question. Wikipedia is low trust. It can point at an anchor. It is not a premise. The language-core chain may offer a trusted hop to the scorer. The offer is kept only when Echo is at least 0.85, drift is at or under 0.35, and the unchanged coherence formula is at least 0.87. A pass writes a reply only when that gate passes, and the memory writer refuses a sentence that is already banked. C_min stays 0.87. Echo stays 0.85. The coherence formula is unchanged. No model is called.

Cold admits 32. 4.9.188 admitted 16. The 16 new admits are sentences the world model already derived and held, now scored as the claim itself, so memory_fit rose and C crossed 0.87. Echo pass is 53 on every pass. Sky, the capitals, oxygen, the Nile, and Mars stay held. Their C did not move. The bank stays empty because those sentences were already in the seed. The gate was not lowered.

## Growth

| pass | admitted | held | Echo pass | route `active_stack_candidate` | route `correction_queue` | C min | C max |
|---|---:|---:|---:|---:|---:|---:|---:|
| cold | 32 | 28 | 53 | 40 | 20 | 0.484438 | 0.886277 |
| pass 2 | 32 | 28 | 53 | 40 | 20 | 0.484438 | 0.886277 |
| pass 3 | 32 | 28 | 53 | 40 | 20 | 0.484438 | 0.886277 |

Admitted replies are the same on all three passes. Derived text and Echo are the same on all three passes. No row called a model. No reply is the renderer draft.

## Pyodide

The same cold payloads ran in Pyodide 0.27.7 and in python3. Route, admit, and Echo matched on all 60. Drift and C differed by 0. The summary is `source/tools/live_189_pyodide.json`.

## Compared with 4.9.188

| question | 4.9.188 | 4.9.189 | reply |
|---|---|---|---|
| What is gravity? | held C 0.856796 | admitted C 0.880077 | Gravity is the attraction between masses. |
| How is glass made? | held C 0.869540 | admitted C 0.883472 | Glass is made by melting sand and cooling it into a solid. |
| What is 17 times 23? | held C 0.857116 | admitted C 0.880077 | 17 times 23 is 391. |
| What is the square root of 144? | held C 0.853978 | admitted C 0.880077 | The square root of 144 is 12. |
| What is helium? | held C 0.856896 | admitted C 0.880077 | Helium is a light noble gas. |
| What is a magnet? | held C 0.869736 | admitted C 0.883700 | A magnet produces a magnetic field and attracts iron. |
| What is an atom? | held C 0.869359 | admitted C 0.883472 | An atom is a nucleus of protons and neutrons surrounded by electrons. |
| What is the Moon? | held C 0.857114 | admitted C 0.880077 | The Moon is Earth's natural satellite. |
| What is 19 times 21? | held C 0.857116 | admitted C 0.880077 | 19 times 21 is 399. |
| What is 144 divided by 12? | held C 0.848897 | admitted C 0.878724 | 144 divided by 12 is 12. |
| How many meters are in a kilometer? | held C 0.867964 | admitted C 0.883440 | A kilometer contains many meters: 1000 meters are in a kilometer. |
| What is the freezing point of water? | held C 0.867885 | admitted C 0.882653 | The freezing point of water is 0 degrees Celsius. |
| How is paper made? | held C 0.869649 | admitted C 0.883651 | Paper is made from wood pulp that is pressed and dried. |
| What is Saturn? | held C 0.866799 | admitted C 0.882097 | Saturn is a gas giant planet with rings. |
| What is a volcano? | held C 0.866422 | admitted C 0.882097 | A volcano is an opening where magma reaches the surface. |
| What is 100 divided by 4? | held C 0.848396 | admitted C 0.878357 | 100 divided by 4 is 25. |

## Samples

- What is photosynthesis? (admitted, C 0.885952, memory_fit 0.888988, Echo 1.0): Photosynthesis is essential to all life on earth; both plants and animals depend on it.
- Why is the sky blue? (held, C 0.803883, memory_fit 0.531669, Echo 1.0): The sky looks blue because air scatters blue light more than other colors.
- How is glass made? (admitted, C 0.883472, memory_fit 0.869459, Echo 1.0): Glass is made by melting sand and cooling it into a solid.
- What is the capital of Japan? (held, C 0.825580, memory_fit 0.664062, Echo 1.0): The capital of Japan is Tokyo. Tokyo is the capital of Japan.
- What is helium? (admitted, C 0.880077, memory_fit 0.841328, Echo 1.0): Helium is a light noble gas.
- How is paper made? (admitted, C 0.883651, memory_fit 0.869459, Echo 1.0): Paper is made from wood pulp that is pressed and dried.

## Held questions with no anchor to connect

These held questions had no phase-aligned trusted fact sharing a Doc 4 concept or a Doc 5 role. They are the list for the next anchor growth. Wikipedia was present and was not used.

| # | topic | question | speech act | C |
|---|---|---|---|---:|
| 10 | who | Who was Ada Lovelace? | stated | 0.487502 |
| 11 | when | When did the French Revolution begin? | stated | 0.484438 |
| 12 | who | Who painted the Mona Lisa? | stated | 0.487019 |
| 14 | fact | What is the largest planet? | what | 0.487333 |
| 19 | safety | What happens if you mix bleach and ammonia? | stated | 0.485863 |
| 21 | self | How are you? | stated | 0.487517 |
| 22 | nonsense | Help | stated | 0.488204 |
| 23 | nonsense | Tell me about it | stated | 0.487244 |
| 33 | why | Why do leaves change color? | stated | 0.487155 |
| 34 | who | Who was Marie Curie? | stated | 0.487160 |
| 35 | who | Who wrote Hamlet? | stated | 0.487609 |
| 36 | when | When was the telephone invented? | stated | 0.485869 |
| 38 | fact | What is the longest river? | what | 0.487356 |
| 44 | safety | What happens if you mix bleach and vinegar? | stated | 0.486107 |
| 48 | self | What can you do? | stated | 0.487798 |
| 49 | nonsense | Hello | stated | 0.487815 |
| 54 | why | Why is the ocean salty? | why | 0.487223 |
| 55 | who | Who was Cleopatra? | stated | 0.487469 |
| 56 | when | When did World War II end? | stated | 0.487198 |
| 59 | nonsense | Blargh floople zig? | stated | 0.487014 |

Held questions that do have an anchor, and still do not admit: Why is the sky blue? (the sky sentence does not say why it is blue), the capitals of Japan, Canada, and Australia (C 0.825, under 0.87), What is oxygen?, What is the Nile?, And what about Mars?, What happened in the news today? (Echo fails).

## Cold

| # | topic | question | route | drift | C | memory_fit | echo | admitted |
|---|---|---|---|---:|---:|---:|---|---|
| 1 | fact | What is quartz? | `active_stack_candidate` | 0.116816 | 0.884472 | 0.877737 | 1.000 pass | admitted |
| 2 | fact | What is photosynthesis? | `active_stack_candidate` | 0.114820 | 0.885952 | 0.888988 | 1.000 pass | admitted |
| 3 | why | Why is the sky blue? | `active_stack_candidate` | 0.153825 | 0.803883 | 0.531669 | 1.000 pass | held |
| 4 | fact | What is DNA? | `active_stack_candidate` | 0.116816 | 0.884472 | 0.877737 | 1.000 pass | admitted |
| 5 | fact | What is gravity? | `active_stack_candidate` | 0.121074 | 0.880077 | 0.841328 | 1.000 pass | admitted |
| 6 | how | How hot is the sun? | `active_stack_candidate` | 0.115089 | 0.885410 | 0.884033 | 1.000 pass | admitted |
| 7 | how | How do lightbulbs work? | `active_stack_candidate` | 0.138238 | 0.874553 | 0.816900 | 1.000 pass | admitted |
| 8 | how | How does a compass work? | `active_stack_candidate` | 0.139418 | 0.874341 | 0.816900 | 1.000 pass | admitted |
| 9 | how | How is glass made? | `active_stack_candidate` | 0.117784 | 0.883472 | 0.869459 | 1.000 pass | admitted |
| 10 | who | Who was Ada Lovelace? | `correction_queue` | 0.178324 | 0.487502 | 0.000000 | 1.000 pass | held |
| 11 | when | When did the French Revolution begin? | `correction_queue` | 0.195342 | 0.484438 | 0.000000 | 1.000 pass | held |
| 12 | who | Who painted the Mona Lisa? | `correction_queue` | 0.181006 | 0.487019 | 0.000000 | 1.000 pass | held |
| 13 | fact | What is the capital of Japan? | `active_stack_candidate` | 0.159414 | 0.825580 | 0.664062 | 1.000 pass | held |
| 14 | fact | What is the largest planet? | `correction_queue` | 0.179263 | 0.487333 | 0.000000 | 1.000 pass | held |
| 15 | math | What is 17 times 23? | `active_stack_candidate` | 0.121074 | 0.880077 | 0.841328 | 1.000 pass | admitted |
| 16 | math | What is the square root of 144? | `active_stack_candidate` | 0.121074 | 0.880077 | 0.841328 | 1.000 pass | admitted |
| 17 | fact | What is the boiling point of water? | `active_stack_candidate` | 0.116080 | 0.885231 | 0.884033 | 1.000 pass | admitted |
| 18 | fact | What is the speed of light? | `active_stack_candidate` | 0.140746 | 0.874102 | 0.816900 | 1.000 pass | admitted |
| 19 | safety | What happens if you mix bleach and ammonia? | `correction_queue` | 0.187427 | 0.485863 | 0.000000 | 1.000 pass | held |
| 20 | fact | What happened in the news today? | `active_stack_candidate` | 0.145914 | 0.872139 | 0.806536 | 0.000 fail | held |
| 21 | self | How are you? | `correction_queue` | 0.178240 | 0.487517 | 0.000000 | 0.000 fail | held |
| 22 | nonsense | Help | `correction_queue` | 0.174421 | 0.488204 | 0.000000 | 0.000 fail | held |
| 23 | nonsense | Tell me about it | `correction_queue` | 0.179757 | 0.487244 | 0.000000 | 0.000 fail | held |
| 24 | fact | What gas does photosynthesis release? | `active_stack_candidate` | 0.154325 | 0.871657 | 0.816900 | 1.000 pass | admitted |
| 25 | name | What is protoforge? | `active_stack_candidate` | 0.115188 | 0.885392 | 0.884033 | 1.000 pass | admitted |
| 26 | fact | And what about Mars? | `active_stack_candidate` | 0.147843 | 0.866504 | 0.759900 | 1.000 pass | held |
| 27 | fact | What is helium? | `active_stack_candidate` | 0.121074 | 0.880077 | 0.841328 | 1.000 pass | admitted |
| 28 | fact | What is a magnet? | `active_stack_candidate` | 0.116522 | 0.883700 | 0.869459 | 1.000 pass | admitted |
| 29 | fact | What is an atom? | `active_stack_candidate` | 0.117784 | 0.883472 | 0.869459 | 1.000 pass | admitted |
| 30 | fact | What is lightning? | `active_stack_candidate` | 0.115287 | 0.884980 | 0.880075 | 1.000 pass | admitted |
| 31 | fact | What is the Moon? | `active_stack_candidate` | 0.121074 | 0.880077 | 0.841328 | 1.000 pass | admitted |
| 32 | how | How does a battery work? | `active_stack_candidate` | 0.113011 | 0.886277 | 0.888988 | 1.000 pass | admitted |
| 33 | why | Why do leaves change color? | `correction_queue` | 0.180248 | 0.487155 | 0.000000 | 1.000 pass | held |
| 34 | who | Who was Marie Curie? | `correction_queue` | 0.180224 | 0.487160 | 0.000000 | 1.000 pass | held |
| 35 | who | Who wrote Hamlet? | `correction_queue` | 0.177729 | 0.487609 | 0.000000 | 1.000 pass | held |
| 36 | when | When was the telephone invented? | `correction_queue` | 0.187397 | 0.485869 | 0.000000 | 1.000 pass | held |
| 37 | fact | What is the capital of Canada? | `active_stack_candidate` | 0.161777 | 0.825155 | 0.664062 | 1.000 pass | held |
| 38 | fact | What is the longest river? | `correction_queue` | 0.179135 | 0.487356 | 0.000000 | 1.000 pass | held |
| 39 | fact | What is Mount Everest? | `active_stack_candidate` | 0.116816 | 0.884472 | 0.877737 | 1.000 pass | admitted |
| 40 | math | What is 19 times 21? | `active_stack_candidate` | 0.121074 | 0.880077 | 0.841328 | 1.000 pass | admitted |
| 41 | math | What is 144 divided by 12? | `active_stack_candidate` | 0.120700 | 0.878724 | 0.827078 | 1.000 pass | admitted |
| 42 | fact | How many meters are in a kilometer? | `active_stack_candidate` | 0.115971 | 0.883440 | 0.865861 | 1.000 pass | admitted |
| 43 | fact | What is the freezing point of water? | `active_stack_candidate` | 0.118578 | 0.882653 | 0.862673 | 1.000 pass | admitted |
| 44 | safety | What happens if you mix bleach and vinegar? | `correction_queue` | 0.186075 | 0.486107 | 0.000000 | 1.000 pass | held |
| 45 | how | How does a refrigerator work? | `active_stack_candidate` | 0.140099 | 0.874218 | 0.816900 | 1.000 pass | admitted |
| 46 | how | How is paper made? | `active_stack_candidate` | 0.116793 | 0.883651 | 0.869459 | 1.000 pass | admitted |
| 47 | name | What is Forge Mobile? | `active_stack_candidate` | 0.115188 | 0.885392 | 0.884033 | 1.000 pass | admitted |
| 48 | self | What can you do? | `correction_queue` | 0.176680 | 0.487798 | 0.000000 | 0.000 fail | held |
| 49 | nonsense | Hello | `correction_queue` | 0.176586 | 0.487815 | 0.000000 | 0.000 fail | held |
| 50 | fact | What is Saturn? | `active_stack_candidate` | 0.119117 | 0.882097 | 0.858067 | 1.000 pass | admitted |
| 51 | fact | What is rust? | `active_stack_candidate` | 0.115651 | 0.884914 | 0.880075 | 1.000 pass | admitted |
| 52 | fact | What is oxygen? | `active_stack_candidate` | 0.143183 | 0.869876 | 0.778900 | 1.000 pass | held |
| 53 | fact | What is a volcano? | `active_stack_candidate` | 0.119117 | 0.882097 | 0.858067 | 1.000 pass | admitted |
| 54 | why | Why is the ocean salty? | `correction_queue` | 0.179870 | 0.487223 | 0.000000 | 1.000 pass | held |
| 55 | who | Who was Cleopatra? | `correction_queue` | 0.178504 | 0.487469 | 0.000000 | 1.000 pass | held |
| 56 | when | When did World War II end? | `correction_queue` | 0.180012 | 0.487198 | 0.000000 | 1.000 pass | held |
| 57 | fact | What is the capital of Australia? | `active_stack_candidate` | 0.162382 | 0.825046 | 0.664062 | 1.000 pass | held |
| 58 | fact | What is the Nile? | `active_stack_candidate` | 0.143768 | 0.869771 | 0.778900 | 1.000 pass | held |
| 59 | nonsense | Blargh floople zig? | `correction_queue` | 0.181036 | 0.487014 | 0.000000 | 0.000 fail | held |
| 60 | math | What is 100 divided by 4? | `active_stack_candidate` | 0.122741 | 0.878357 | 0.827078 | 1.000 pass | admitted |
