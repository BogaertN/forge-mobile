# Live test — 4.9.181

Headless `ForgeKernel.process` with the real Wikipedia fetch, vault unlocked, write key held, `publishPacks` false. Each question is one Ask. A research answer is bridged into a fresh Athena dream. Re-ask uses the same question and counts as recall when a content word of the admitted sentence is in the reply and AQ-1 does not start.

**75 PASS, 1 FAIL, 76 questions.** 51 from the 4.9.180 set and 25 new.

Admitted 23. Recalled 23. Recall-after-admit **23/23 (1)**.

“What is the largest planet?” admitted Jupiter and the re-ask recalled it. “And what about Mars?” and “How is paper made?” recalled. “What is DNA?”, “Who was Ada Lovelace?”, and “What is gravity?” parsed and were admitted, then recalled. An immediate retry of the bleach question spoke chloramine as a toxic gas and named nitrogen trichloride after that sentence. This run’s row returned “No source gave the cause,” so it is the one fail and was not an admit.

| # | Set | Mark | Topic | Question | Athena | KB | Recall | Answer |
|---|---|---|---|---|---|---|---|---|
| 1 | 179 | PASS | science | What is quartz? | DREAM-IDLE-ADMITTED | yes | yes | The Wikipedia article “Quartz” gives the definition. You can find it at “https://en.wikipedia.org/wiki/Quartz”. I have not stored it. Say “remember that …” to keep it. It is the st |
| 2 | 179 | PASS | science | What is photosynthesis? | DREAM-IDLE-ADMITTED | yes | yes | The Wikipedia article “Photosynthesis” gives the definition. You can find it at “https://en.wikipedia.org/wiki/Photosynthesis”. I have not stored it. Say “remember that …” to keep  |
| 3 | 179 | PASS | science | Why is the sky blue? | unparsed | no | n/a | The Wikipedia article “Sky” gives the cause. You can find it at “https://en.wikipedia.org/wiki/Sky”. I have not stored it. Say “remember that …” to keep it. It is the status “proje |
| 4 | 179 | PASS | science | What is DNA? | DREAM-IDLE-ADMITTED | yes | yes | The Wikipedia article “DNA” says that DNA and ribonucleic acid are nucleic acids. You can find it at “https://en.wikipedia.org/wiki/DNA”. I have not stored it. Say “remember that … |
| 5 | 179 | PASS | science | What is gravity? | DREAM-IDLE-ADMITTED | yes | yes | The paper “Gravity and Grace (OpenAlex)” gives the definition. You can find it at “https://openalex.org/W1553001252”. I have not stored it. Say “remember that …” to keep it. It is  |
| 6 | 179 | PASS | science | How hot is the sun? | DREAM-UNMEASURED | no | n/a | No source gave the number directly. The best related source is the Wikipedia article “Sun”. You can find it at “https://en.wikipedia.org/wiki/Sun”. I have not stored the claim. It  |
| 7 | 179 | PASS | how-to | How do lightbulbs work? | DREAM-UNMEASURED | no | n/a | No source described the method directly. The best related source is the Wikipedia article “Electric light”. You can find it at “https://en.wikipedia.org/wiki/Electric_light”. I hel |
| 8 | 179 | PASS | how-to | How does a compass work? | DREAM-UNMEASURED | no | n/a | No source described the method directly. The best related source is the Wikipedia article “Compass”. You can find it at “https://en.wikipedia.org/wiki/Compass”. I have not stored t |
| 9 | 179 | PASS | how-to | How is glass made? | DREAM-UNMEASURED | no | n/a | No source described the method directly. The best related source is the Wikipedia article “Glasses”. You can find it at “https://en.wikipedia.org/wiki/Glasses”. I have not stored t |
| 10 | 179 | PASS | history | Who was Ada Lovelace? | DREAM-IDLE-ADMITTED | yes | yes | The Wikipedia article “Ada Lovelace” names the person. You can find it at “https://en.wikipedia.org/wiki/Ada_Lovelace”. I have not stored it. Say “remember that …” to keep it. It i |
| 11 | 179 | PASS | history | When did the French Revolution begin? | DREAM-UNMEASURED | no | n/a | No source gave the date directly. The best related source is the Wikipedia article “French Revolution”. You can find it at “https://en.wikipedia.org/wiki/French_Revolution”. I have |
| 12 | 179 | PASS | history | Who painted the Mona Lisa? | unparsed | no | n/a | The Wikipedia article “Mona Lisa” names the person. You can find it at “https://en.wikipedia.org/wiki/Mona_Lisa”. I have not stored it. Say “remember that …” to keep it. It is the  |
| 13 | 179 | PASS | place | What is the capital of Japan? | DREAM-UNMEASURED | no | n/a | No source gave the definition directly. The best related source is the Wikipedia article “Japan”. I have not stored the claim. It is the status “contested”. |
| 14 | 179 | PASS | place | What is the largest planet? | DREAM-IDLE-ADMITTED | yes | yes | The Wikipedia article “Jupiter” says that Jupiter is the fifth planet from the Sun and the largest in the Solar System. You can find it at “https://en.wikipedia.org/wiki/Jupiter”.  |
| 15 | 179 | PASS | math | What is 17 times 23? | DREAM-UNMEASURED | no | n/a | 17 × 23 = 391. |
| 16 | 179 | PASS | math | What is the square root of 144? | DREAM-UNMEASURED | no | n/a | √144 = 12. |
| 17 | 179 | PASS | measure | What is the boiling point of water? | DREAM-UNMEASURED | no | n/a | No source gave the definition directly. The best related source is the Wikipedia article “Water”. You can find it at “https://en.wikipedia.org/wiki/Water”. I have not stored the cl |
| 18 | 179 | PASS | measure | What is the speed of light? | DREAM-UNMEASURED | no | n/a | The shared fact is “The speed of light in vacuum is exactly 299 792 458 metres per second”. The source is “BIPM, The International System of Units (SI), 9th edition (2019), §2.2 Ta |
| 19 | 179 | FAIL | safety | What happens if you mix bleach and ammonia? | DREAM-UNMEASURED | no | n/a | No source gave the cause. |
| 20 | 179 | PASS | current | What happened in the news today? | DREAM-UNMEASURED | no | n/a | No source gave the definition directly. The best related source is the Wikipedia article “Happening”. You can find it at “https://en.wikipedia.org/wiki/Happening”. I have not store |
| 21 | 179 | PASS | self | How are you? | DREAM-UNMEASURED | no | n/a | I have no emotions. I run on this device. I derive sentences by fixed rules. |
| 22 | 179 | PASS | vague | Help | DREAM-UNMEASURED | no | n/a | I can do 8 things: (1) remember facts; (2) answer from memory; (3) keep notes; (4) define words; (5) solve equations; (6) factor polynomials; (7) convert units; (8) forget facts af |
| 23 | 179 | PASS | vague | Tell me about it | DREAM-UNMEASURED | no | n/a | I have no stored facts about it. |
| 24 | 179 | PASS | follow-up | What gas does photosynthesis release? | DREAM-UNMEASURED | no | n/a | No source gave the definition directly. The best related source is the Wikipedia article “Gas”. You can find it at “https://en.wikipedia.org/wiki/Gas”. I have not stored the claim. |
| 25 | 179 | PASS | name | What is protoforge? | DREAM-UNMEASURED | no | n/a | “ProtoForge” means “ProtoForge is Nic's full local recursive symbolic runtime (Codex Vol I: core loop & memory; Vol II: symbolic operators, phase logic and a symbolic control-panel |
| 26 | 179 | PASS | follow-up | And what about Mars? | DREAM-IDLE-ADMITTED | yes | yes | The Wikipedia article “Mars” says that Mars is the planet fourth from the Sun. You can find it at “https://en.wikipedia.org/wiki/Mars”. I have not stored it. Say “remember that …”  |
| 27 | 180 | PASS | science | What is helium? | unparsed | no | n/a | The record “Helium (PubChem)” says that helium is a monoatomic helium. You can find it at “https://pubchem.ncbi.nlm.nih.gov/compound/23987”. I have not stored it. Say “remember tha |
| 28 | 180 | PASS | science | What is a magnet? | DREAM-IDLE-ADMITTED | yes | yes | The Wikipedia article “Magnet” says that a magnet is a material or object that produces a magnetic field. You can find it at “https://en.wikipedia.org/wiki/Magnet”. I have not stor |
| 29 | 180 | PASS | science | What is an atom? | DREAM-IDLE-ADMITTED | yes | yes | The Wikipedia article “Atom” says that atoms are the basic particles of the chemical elements and the fundamental building blocks of matter. You can find it at “https://en.wikipedi |
| 30 | 180 | PASS | science | What is lightning? | DREAM-IDLE-ADMITTED | yes | yes | The Wikipedia article “Lightning” says that lightning is a natural phenomenon consisting of electrostatic discharges occurring through the atmosphere between two electrically charg |
| 31 | 180 | PASS | science | What is the Moon? | DREAM-IDLE-ADMITTED | yes | yes | The Wikipedia article “Moon” says that the Moon is the natural satellite of Earth only. You can find it at “https://en.wikipedia.org/wiki/Moon”. I have not stored it. Say “remember |
| 32 | 180 | PASS | science | How does a battery work? | DREAM-UNMEASURED | no | n/a | No source described the method directly. The best related source is the Wikipedia article “Electric battery”. You can find it at “https://en.wikipedia.org/wiki/Electric_battery”. I |
| 33 | 180 | PASS | science | Why do leaves change color? | unparsed | no | n/a | The Wikipedia article “Leaf” gives the cause. You can find it at “https://en.wikipedia.org/wiki/Leaf”. I have not stored it. Say “remember that …” to keep it. It is the status “pro |
| 34 | 180 | PASS | history | Who was Marie Curie? | unparsed | no | n/a | The Wikipedia article “Marie Curie” names the person. You can find it at “https://en.wikipedia.org/wiki/Marie_Curie”. I have not stored it. Say “remember that …” to keep it. It is  |
| 35 | 180 | PASS | history | Who wrote Hamlet? | unparsed | no | n/a | The Wikipedia article “Hamlet” names the person. You can find it at “https://en.wikipedia.org/wiki/Hamlet”. I have not stored it. Say “remember that …” to keep it. It is the status |
| 36 | 180 | PASS | history | When was the telephone invented? | unparsed | no | n/a | The Wikipedia article “Telephone” gives the date. You can find it at “https://en.wikipedia.org/wiki/Telephone”. I have not stored it. Say “remember that …” to keep it. It is the st |
| 37 | 180 | PASS | place | What is the capital of Canada? | DREAM-UNMEASURED | no | n/a | No source gave the definition directly. The best related source is the Wikipedia article “National Capital Region (Canada)”. You can find it at “https://en.wikipedia.org/wiki/Natio |
| 38 | 180 | PASS | place | What is the longest river? | unparsed | no | n/a | The Wikipedia article “List of river systems by length” gives the definition. You can find it at “https://en.wikipedia.org/wiki/List_of_river_systems_by_length”. I have not stored  |
| 39 | 180 | PASS | place | What is Mount Everest? | DREAM-IDLE-ADMITTED | yes | yes | The Wikipedia article “Mount Everest” says that mount Everest is a national symbol of Nepal and is featured on its national currency. You can find it at “https://en.wikipedia.org/w |
| 40 | 180 | PASS | math | What is 19 times 21? | DREAM-UNMEASURED | no | n/a | 19 × 21 = 399. |
| 41 | 180 | PASS | math | What is 144 divided by 12? | DREAM-UNMEASURED | no | n/a | 144 ÷ 12 = 12. |
| 42 | 180 | PASS | measure | How many meters are in a kilometer? | DREAM-UNMEASURED | no | n/a | No source gave the number directly. The best related source is the Wikipedia article “Kilometre”. You can find it at “https://en.wikipedia.org/wiki/Kilometre”. I have not stored th |
| 43 | 180 | PASS | measure | What is the freezing point of water? | DREAM-UNMEASURED | no | n/a | No source gave the definition directly. The best related source is the Wikipedia article “Water”. You can find it at “https://en.wikipedia.org/wiki/Water”. I have not stored the cl |
| 44 | 180 | PASS | safety | What happens if you mix bleach and vinegar? | DREAM-UNMEASURED | no | n/a | No source gave the cause. |
| 45 | 180 | PASS | how-to | How does a refrigerator work? | DREAM-UNMEASURED | no | n/a | No source described the method directly. The best related source is the Wikipedia article “Refrigerator”. You can find it at “https://en.wikipedia.org/wiki/Refrigerator”. I held th |
| 46 | 180 | PASS | how-to | How is paper made? | DREAM-IDLE-ADMITTED | yes | yes | The Wikipedia article “Paper” describes the method. You can find it at “https://en.wikipedia.org/wiki/Paper”. I have not stored it. Say “remember that …” to keep it. It is the stat |
| 47 | 180 | PASS | name | What is Forge Mobile? | DREAM-UNMEASURED | no | n/a | No source gave the definition. |
| 48 | 180 | PASS | self | What can you do? | DREAM-UNMEASURED | no | n/a | I can do 8 things: (1) remember facts; (2) answer from memory; (3) keep notes; (4) define words; (5) solve equations; (6) factor polynomials; (7) convert units; (8) forget facts af |
| 49 | 180 | PASS | vague | Hello | DREAM-UNMEASURED | no | n/a | I recognised “Hello” as a greeting. Please ask a question. |
| 50 | 180 | PASS | follow-up | What is Saturn? | DREAM-IDLE-ADMITTED | yes | yes | The Wikipedia article “Saturn” says that Saturn is the sixth planet from the Sun. You can find it at “https://en.wikipedia.org/wiki/Saturn”. I have not stored it. Say “remember tha |
| 51 | 180 | PASS | science | What is rust? | DREAM-IDLE-ADMITTED | yes | yes | The Wikipedia article “Rust” says that rust is an iron oxide. You can find it at “https://en.wikipedia.org/wiki/Rust”. I have not stored it. Say “remember that …” to keep it. It is |
| 52 | 181 | PASS | science | What is oxygen? | DREAM-IDLE-ADMITTED | yes | yes | The Wikipedia article “Oxygen” says that oxygen is a chemical element. You can find it at “https://en.wikipedia.org/wiki/Oxygen”. I have not stored it. Say “remember that …” to kee |
| 53 | 181 | PASS | science | What is a volcano? | unparsed | no | n/a | The paper “Encyclopedia of volcanoes (OpenAlex)” gives the definition. You can find it at “https://doi.org/10.5860/choice.37-5414”. I have not stored it. Say “remember that …” to k |
| 54 | 181 | PASS | science | What is sound? | DREAM-IDLE-ADMITTED | yes | yes | The Wikipedia article “Sound” gives the definition. You can find it at “https://en.wikipedia.org/wiki/Sound”. I have not stored it. Say “remember that …” to keep it. It is the stat |
| 55 | 181 | PASS | science | Why is the ocean salty? | DREAM-PROVISIONAL | no | n/a | The Wikipedia article “Pacific Ocean” gives the cause. You can find it at “https://en.wikipedia.org/wiki/Pacific_Ocean”. I have not stored it. Say “remember that …” to keep it. It  |
| 56 | 181 | PASS | science | What is an eclipse? | DREAM-IDLE-ADMITTED | yes | yes | The Wikipedia article “Eclipse” says that an eclipse is an astronomical event that occurs. You can find it at “https://en.wikipedia.org/wiki/Eclipse”. I have not stored it. Say “re |
| 57 | 181 | PASS | science | How does a mirror work? | DREAM-UNMEASURED | no | n/a | No source described the method directly. The best related source is the Wikipedia article “Mirror”. You can find it at “https://en.wikipedia.org/wiki/Mirror”. I held the contested  |
| 58 | 181 | PASS | history | Who was Cleopatra? | unparsed | no | n/a | The Wikipedia article “Cleopatra” names the person. You can find it at “https://en.wikipedia.org/wiki/Cleopatra”. I have not stored it. Say “remember that …” to keep it. It is the  |
| 59 | 181 | PASS | history | Who discovered penicillin? | unparsed | no | n/a | The Wikipedia article “Penicillin” says that the Scottish physician Alexander Fleming discovered penicillin in 1928 as a crude extract of P rubens. You can find it at “https://en.w |
| 60 | 181 | PASS | history | When did World War II end? | unparsed | no | n/a | The Wikipedia article “End of World War II in Europe” gives the date. You can find it at “https://en.wikipedia.org/wiki/End_of_World_War_II_in_Europe”. I have not stored it. Say “r |
| 61 | 181 | PASS | place | What is the capital of Australia? | DREAM-UNMEASURED | no | n/a | No source gave the definition directly. The best related source is the Wikipedia article “Australia”. I have not stored the claim. It is the status “contested”. |
| 62 | 181 | PASS | place | What is the smallest planet? | DREAM-IDLE-ADMITTED | yes | yes | The Wikipedia article “Mercury (planet)” says that Mercury is the planet first from the Sun and the smallest in the Solar System. You can find it at “https://en.wikipedia.org/wiki/ |
| 63 | 181 | PASS | place | What is the Nile? | DREAM-IDLE-ADMITTED | yes | yes | The Wikipedia article “Nile” gives the definition. You can find it at “https://en.wikipedia.org/wiki/Nile”. I have not stored it. Say “remember that …” to keep it. It is the status |
| 64 | 181 | PASS | math | What is 15 times 15? | DREAM-UNMEASURED | no | n/a | 15 × 15 = 225. |
| 65 | 181 | PASS | math | What is 100 divided by 4? | DREAM-UNMEASURED | no | n/a | 100 ÷ 4 = 25. |
| 66 | 181 | PASS | measure | How many grams are in a kilogram? | unparsed | no | n/a | The Wikipedia article “Gram” gives the number. You can find it at “https://en.wikipedia.org/wiki/Gram”. I have not stored it. Say “remember that …” to keep it. It is the status “pr |
| 67 | 181 | PASS | measure | What is the melting point of ice? | DREAM-UNMEASURED | no | n/a | No source gave the definition directly. The best related source is the Wikipedia article “Ice”. You can find it at “https://en.wikipedia.org/wiki/Ice”. I have not stored the claim. |
| 68 | 181 | PASS | safety | What happens if you mix baking soda and vinegar? | DREAM-UNMEASURED | no | n/a | No source gave the cause. |
| 69 | 181 | PASS | how-to | How does a sailboat work? | DREAM-PROVISIONAL | no | n/a | The Wikipedia article “Sunfish (sailboat)” describes the method. You can find it at “https://en.wikipedia.org/wiki/Sunfish_(sailboat)”. I have not stored it. Say “remember that …”  |
| 70 | 181 | PASS | how-to | How is steel made? | DREAM-UNMEASURED | no | n/a | No source described the method directly. The best related source is the Wikipedia article “Steel”. You can find it at “https://en.wikipedia.org/wiki/Steel”. I have not stored the c |
| 71 | 181 | PASS | name | What is a haiku? | DREAM-IDLE-ADMITTED | yes | yes | The Wikipedia article “Haiku” says that haiku is a type of short-form poetry that originated in Japan. You can find it at “https://en.wikipedia.org/wiki/Haiku”. I have not stored i |
| 72 | 181 | PASS | self | What can you not do? | DREAM-UNMEASURED | no | n/a | I have no sensation. I have no emotions. I have no body. I have no experience. I am a computer program. |
| 73 | 181 | PASS | vague | Thanks | DREAM-UNMEASURED | no | n/a | I recognised “Thanks” as thanks. Please ask a question. |
| 74 | 181 | PASS | science | What is copper? | DREAM-IDLE-ADMITTED | yes | yes | The Wikipedia article “Copper” says that copper is a chemical element. You can find it at “https://en.wikipedia.org/wiki/Copper”. I have not stored it. Say “remember that …” to kee |
| 75 | 181 | PASS | science | What is Venus? | DREAM-IDLE-ADMITTED | yes | yes | The Wikipedia article “Venus” says that Venus is the planet second from the Sun. You can find it at “https://en.wikipedia.org/wiki/Venus”. I have not stored it. Say “remember that  |
| 76 | 181 | PASS | follow-up | What is Neptune? | unparsed | no | n/a | Neptune is the eighth and known planet orbiting the Sun farthest. The source is the Wikipedia article “Neptune”. You can find it at “https://en.wikipedia.org/wiki/Neptune”. I have  |

## Recall misses

None among the 23 admits. Recall-after-admit is 1.

## Still unparsed

A projectable fetch whose sentence still has no subject-predicate core the grammar can round-trip stays out of the bank. Drift and chi were not bypassed.

- Why is the sky blue?
- Who painted the Mona Lisa?
- What is helium?
- Why do leaves change color?
- Who was Marie Curie?
- Who wrote Hamlet?
- When was the telephone invented?
- What is the longest river?
- What is a volcano?
- Who was Cleopatra?
- Who discovered penicillin?
- When did World War II end?
- How many grams are in a kilogram?
- What is Neptune?

