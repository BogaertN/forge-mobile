# Creative and expressive code, read before 4.9.260

This is a read of the tree at `53840a4`. Nothing below generated a poem, a story, or an opinion.

## What exists

Speech acts are adjacency pairs, not composition. `source/src/speech_acts.js` lines 1–9 and the same data in `source/engine/rmc_engine_v1/speech_acts.json` store greet, thank, and the other conversational acts as meanings: forms, the act that answers, and a kāraka frame. `compile` (about line 280) realizes a response act and re-reads it. There is no poem, story, or preference act.

Parse already names some acts from the frame. `source/src/qframe.js` `selfAct` (line 429) returns `capability` when the kartṛ is the kernel and the auxiliary is a modal, otherwise `self`. An imperative is `speech_act: command` (`QF-IMP`, around line 794). Arithmetic is `speech_act: compute` (lines 484–542). A partial what-question keeps the leftover words on `locus` (lines 674–682). None of these is a creative or opinion act.

The Ideas card is a hypothesis record, not a generator. `source/src/kernel.js` `commitIdea` (lines 559–569) commits a row in `creative_proposals` only when drift is projectable, and it returns `wrote_memory: false`. `source/src/app.js` `ideaCard` (lines 837–841) says a spoken idea is a hypothesis and does not write memory, the world, or shared knowledge. Nothing in the ask path fills that list with a composed sentence.

Evolutionary drift search is not language. `source/src/ede.js` line 25 sets `task_mode: 'creative_brainstorming'` and line 29 gives that mode a novelty budget of 0.75. The comment on lines 27–29 says the budgets are shadow-only and never enforced. The operators (line 30) are `adjacent_synthesis`, `analogy`, and `contradiction_probe`. They measure novelty and drift. They do not write sentences.

Mirror and idle do not compose. `source/src/mirror.js` `suggest` (line 82) proposes a route priority and marks it `needs_approval`. `source/src/dream_idle.js` `prefer` (line 1350) moves a queued gap. The dream quarantine card in `source/src/app.js` (line 852) keeps a counterfactual out of memory. Neither produces a narrative.

The grammar can say a clause. `source/src/grammar.js` `clauseText` realizes a kāraka clause as one sentence (the postnum note is at line 545). It has no stanza, no line break, and no planner that chooses imagery. Simulators already realize outcomes. `source/engine/rmc_engine_v1/sim_device.py` `_effect_struct` (line 1373) builds a kāraka atom from a measurement, including an orbit (`circle` with a period, line 1432) and a push. Those sentences are answers to simulation questions, not pieces of a requested composition.

Older release notes say creative writing was not started (`source/CONFLICTS.md` around the 4.9.119 entries). That was still true at `53840a4`.

## What does not exist

No generator of poems or stories. No opinion or preference reasoner. No speech act for compose, narrate, describe-as-a-scene, or prefer. No path that feeds a simulator result and a computed number into one labelled creative reply. No UI label `creative` on an ask card. A creative or opinion prompt at `53840a4` fell through Derive and was held with Echo 0.

## What 4.9.263 changes

A height is accepted from the kind's own family. `kind_accepts` walks the hypernym chain and uses admitted heights of sibling or parent kinds. The allowed band is that sample's own spread. A structure with no measured kin is held. A furnishing with no measured kin keeps the height, so a chair at 0.9 m still passes. A library, a hall, and a bank hold. A table keeps 0.75 m. A bottle at 5 m falls outside the vessel sample; a bottle at 0.22 m fits it.

A poem or a story stays on the parsed topic. A fact is included when it names that topic, or when it names a noun a topic fact already names, so a harbor that holds water can bring a boat and a cask poem does not bring a qubit. Dimensions fold into one noun ("the cask, 0.62 meters tall, 0.28 meters wide and 0.28 meters deep, weighs 4.8 kilograms"). A cited class is a relative clause ("the mink that is a mammal"). A second event is a fronted "after" clause. "Because" is only the solver mechanism. The lexicon has no syllable counts, so a stanza break follows clause length. The asked noun stays the subject. The class is cited, not substituted.

## What 4.9.261 changes

The 4.9.260 scene list (water, sea, tide, harbor, boat, and a measured height pushed near the top) is gone. `questions_for_rows` in `sim_karaka.py` builds a question from the clause's verb, an in-adjunct, a geometric measure, or an above-measure, and `plan()` selects the solver. Capability verbs come from `computed_math.operation_lemmas`. Preference is a comparative, superlative, or evaluative lexicon class on the frame. Composition is an arc of kāraka atoms realized by `grammar.js`. A topic with no fact is an Athena gap and is not stored.

## What 4.9.260 adds

Parse sets `compose`, `narrate`, `describe`, or `prefer` from the verb's lexicon class and the object's lexicon class (`source/src/qframe.js` `markExpressive`). `source/engine/rmc_engine_v1/creative.py` reads phone, hosted, and self facts whose clauses name the topic, calls `sim_device.plan` and `solve` when a fact gives a body the existing solvers can measure, and calls `computed_math.compute` on a sentence of the same question that is an operation. Lines are those facts, solver sentences, and computed sentences. An opinion names the option that a fact supports and, when Derive chains it, the chain. The reply is labelled creative, `memory_write.proposed` is false, and it is not a Gilligan fact. Factual floors in `mobile_config.py` are unchanged.
