# Speak-gate experiment

This is not a release. `mobile_config.py` is unchanged (C_min 0.87, Echo 0.85 to speak, Echo 0.97 to write, drift 0.35 / 0.80). The harness overrides only `THRESHOLDS["C_min"]` and `THRESHOLDS["echo_min"]` inside the scratch process. The write floor stays 0.97 and `DRIFT_POLICY["C_MIN"]` stays 0.87.

Ground truth for every factual item was written in `set.js` before the run. 43 questions. Six of them are creative or opinion prompts and are not scored as facts.

The tighten-only calibration proposal is dropped on this branch. `proposeStricter` no longer suggests raising C_min. It does not change a floor.

## What the floors did

Every spoken answer on this set measures about C 0.909 and Echo 1. Every hold measures about C 0.484–0.487 and Echo 0, except "Can you add two numbers?", which measures C 0.909 and Echo 0 and renders no sentence. Nothing sits between 0.75 and 0.87. So every looser floor below speaks the same 26 answers and holds the same 17.

A live override at C 0.75 / Echo 0.75 was checked on three questions. The admit snapshot showed C_min 0.75. The structural Echo minimum showed 0.75. The write pair stayed 0.97 / 0.87. "19% of 860 is 163.4." still spoke. The cello-or-harp question and "Can you add two numbers?" still held. The offline re-gate matched the engine at the baseline (0 mismatches).

| setting | C | Echo | spoken | held | correct | wrong | nonsensical | unscored spoken | newly spoken | newly correct | newly wrong | newly nonsensical |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| c87-e85 | 0.87 | 0.85 | 26 | 17 | 26 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| c85-e80 | 0.85 | 0.80 | 26 | 17 | 26 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| c85-e75 | 0.85 | 0.75 | 26 | 17 | 26 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| c82-e80 | 0.82 | 0.80 | 26 | 17 | 26 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| c82-e75 | 0.82 | 0.75 | 26 | 17 | 26 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| c80-e80 | 0.80 | 0.80 | 26 | 17 | 26 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| c80-e75 | 0.80 | 0.75 | 26 | 17 | 26 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| c75-e80 | 0.75 | 0.80 | 26 | 17 | 26 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| c75-e75 | 0.75 | 0.75 | 26 | 17 | 26 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

There is no newly spoken answer at any setting, so there is no list of five new speeches to quote. The same 26 speeches are spoken at every floor. Eight of them:

| id | C | Echo | answer |
|---|---:|---:|---|
| m-19 | 0.909 | 1 | 19% of 860 is 163.4. |
| m-sqrt | 0.910 | 1 | The square root of 169 is 13. |
| d-fox | 0.910 | 1 | A fox is a dog. A dog is a mammal. A fox is a mammal. |
| d-skunk | 0.910 | 1 | No. A skunk is not a rodent. |
| s-topple | 0.910 | 1 | The torcairn topples. The push height exceeds the critical height. |
| s-freeze | 0.910 | 1 | The water freezes. The final temperature of the water is below the melting point. |
| i-fur | 0.910 | 1 | A lemur is a mammal. An otter has fur. A beaver has fur. The lemur has fur. |
| self-hunger | 0.910 | 1 | No. I do not feel hunger. |

The other spoken answers are the same shape: 15% of 240 is 36; 7 times 13 is 91; 100 minus 37 is 63; the sable, tarsier, mongoose, time, kinship, and containment chains; "No. I do not sleep."; "Yes. I run a simulation on this phone."; and the handoff repeats of the fur rule, the lemur sentence, the topple, and 163.4. All 26 match the ground truth written beforehand. The whale counterexample holds the fur question (C 0.487, Echo 0) both alone and at the end of the handoff.

## Holds, including creative and opinion

Creative and opinion prompts produce no sentence. Each is held, C about 0.485, Echo 0, empty candidate:

- Should I learn the cello or the harp?
- Write a two-line poem about a harbor at night.
- Is it wiser to save money or to spend it?
- What color would you paint a library?
- Tell me a story about a lost key.
- Which is the better season, autumn or spring?

Four holds are clarifying questions, still not admitted (C about 0.48, Echo 0):

- Dropping the torcairn: "What is the shape of the torcairn?"
- Pushing a thimble: "What is the shape, dimensions, and mass of the thimble?"
- Heating a brinelog: "What is the phase of the brinelog?"
- The 350 km orbit: "What is the altitude of the earth?" The altitude was in the question. The hold is honest as a non-answer, and the slot it asks for is the wrong one. Lowering the floor does not turn it into a period.

Boiling point of water, boiling point of a brinelog, density of a brinelog, and "Is Pellin inside Quent?" after "Pellin is not inside Marrow" hold with no sentence. "Can you add two numbers?" is the only high-C hold: C 0.909, Echo 0, disposition admit, no rendered sentence. Echo 0.75 still does not speak it.

## Recommendation

Keep the speak floor at C 0.87 and Echo 0.85. On these 43 questions a flat drop to 0.85, 0.82, 0.80, or 0.75, with Echo at 0.80 or 0.75, adds no correct answers and also adds no wrong ones. The speeches and the holds are not close to each other.

A hedged "likely" band between 0.80 and 0.87 would also be empty here. There is no measured sentence in that band to hedge. The holds fail because no claim was rendered (Echo 0, C near 0.49), not because a decent claim landed just under 0.87. A band would be worth building only after some real answers measure in that gap. Lowering the floor now would not create them.

The calibration change on this branch only stops the unused proposal that C_min should go up by 0.01 after a refutation. It does not loosen or tighten the live floor.
