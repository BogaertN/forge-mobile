# Live test 4.9.203

Frequency signatures do not admit. The cold 60 still admits 48 and holds 12. False admits: 0. Every spoken sentence is in `docs/ADMIT_AUDIT_203.md`.

"How are you?" still says "Forge does not store a feeling. World Model owns world state and inference." "What can you do?" now says "Forge answers from admitted facts and does not call a model." That sentence is the capability fix salvaged from draft PR #132. The reference-prose seeder in that draft was not kept.

The twelve questions that 4.9.202 held are still held. None of them admitted.

| question | result |
|---|---|
| Who was Ada Lovelace? | held |
| When did the French Revolution begin? | held |
| Who painted the Mona Lisa? | held |
| What happens if you mix bleach and ammonia? | held |
| What happened in the news today? | held |
| Who was Marie Curie? | held |
| Who wrote Hamlet? | held |
| When was the telephone invented? | held |
| What happens if you mix bleach and vinegar? | held |
| Who was Cleopatra? | held |
| When did World War II end? | held |
| Blargh floople zig? | held |

## Collisions

Before means the master phases are within π/4 and nothing else is checked. After means the three-part frequency test. ε = 0.02. See `docs/WIRING_203.md` for why that number.

The real lexicon is the 419 seeds that have one phase. Six of the 425 seeds store a list of phases and are not in this pair count.

| set | pairs considered | before | after | before rate | after rate |
|---|---:|---:|---:|---:|---:|
| 419 seeds, every pair | 87,571 | 29,061 | 591 | 0.331856 | 0.006749 |
| 1,000 synthetic words | sample 20,000 | | | 0.3917 | 0.0166 |
| 10,000 synthetic words | sample 20,000 | | | 0.3528 | 0.00825 |
| 100,000 synthetic words | sample 40,000 | | | 0.391575 | 0.007575 |

Expected false pairs from the sample rate, n(n−1)/2: about 8,292 at 1k, 412,459 at 10k, and 37,874,621 at 100k. The phase-only expectation at 100k is about 1.96 billion pairs. The drop is about 50×. It is not the near-zero rate in the integer-carrier sketch. Random letter strings still share coarse homes often enough that a 9-component decimal signature at ε = 0.02 does not make 100k words safe. That limit is in the proof file.

Neighbor-phase bleed on the seeds, which is the π/4 window outside the same phase: 19,511 pairs before, 367 after. Same-phase seed pairs: 9,550, of which 224 still resonate. Most words that only share a phase do not resonate once frequency is required. That is the coarse bucket breaking up.

## Related and unrelated

sun, hot, warm, sunny, and weather are surfaces of N.WEATHER. They keep that packet's phase and they resonate with each other (R = 1). light is not on that packet. Its own letters do not cover the weather bands, so sun/light and hot/light do not resonate (R ≈ 0.94 on the overlap that does exist, which is not full cover). sun/dog does not resonate. light/quartz does not resonate. dog/quartz does not resonate.

## Pyodide

Pyodide 0.27.7 matched CPython on the signature, the sun/hot pair, the sun/dog pair, and the law flags. Gap 0. A full scan of the 419-word lexicon, all 87,571 pairs, took 1503 ms inside Pyodide.

C_min stays 0.87. Echo stays 0.85. Drift stays at or under 0.35. The hard stop stays 0.8. No LLM. Wikipedia is not an anchor.
