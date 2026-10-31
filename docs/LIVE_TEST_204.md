# Live test 4.9.204

Tuning does not admit. The cold 60 still admits 48 and holds 12. False admits: 0. Every spoken sentence is in `docs/ADMIT_AUDIT_204.md`. The twelve held questions are the same twelve 4.9.203 held.

## Collisions

Before is the 4.9.203 spelling signature. After is the same test once lawful co-admits have written offsets. ε stays 0.02. The 419-seed count is every pair. The synthetic counts are samples, seed 144. The 1,000-word spelling rate matches the 4.9.203 published sample, 0.0166.

| set | spelling rate | after tuning | unrelated after |
|---|---:|---:|---:|
| 419 seeds, 87,571 pairs | 0.006749 (591) | 0.006680 (585) | 0.006681 (585 / 87,563) |
| 1,000 synthetic, 20,000 samples, 200 admits | 0.0166 | 0.0169 | 0.016306 |
| 10,000 synthetic, 20,000 samples, 200 admits | 0.0073 | 0.00785 | 0.00815 |
| 100,000 synthetic, 40,000 samples, 200 admits | 0.007475 | 0.006825 | 0.007375 |

Phase-only on the 419 seeds is still 0.331856, the 4.9.203 figure. Tuning did not put unrelated words onto one frequency. The 10,000-word sample rose by about 0.0008. A 20,000-draw sample of a 0.007 rate has a standard error near 0.0006, so that rise is sampling noise, not a new collision regime. The census of all 87,571 seed pairs fell by 6.

Expected false pairs from the sample rate, n(n−1)/2, after tuning: about 8,442 at 1k, 392,461 at 10k, and 34,124,659 at 100k. The spelling expectation at 100k on this sample is about 37.4 million. The field does not make 100k words safe. That limit was already in 4.9.203.

## Related words

| pair | before | after the cold 60 | after explicit co-admits |
|---|---|---|---|
| sun / hot | resonates, cover 1 | resonates, cover 1 | resonates, cover 1 |
| sun / warm | resonates, cover 1 | resonates, cover 1 | not run as its own series |
| sun / light | no, cover 0.333, frequency | no, cover 0.333 | no, cover 0.667, frequency |
| sun / dog | no, master, 160° | no, master | no, master |
| light / quartz | no, master, 120° | no, master | no, master |

sun and light share the 18 Hz and 72 Hz carriers. Twelve lawful phase-6 admits move 72 Hz from 72.53 / 75.93 to 73.89 / 74.57. The gap falls from 3.40 Hz to 0.68 Hz, inside ε · 72 = 1.44 Hz, and the cover goes from one band to two. sun also carries 1296 Hz. light has no 1296 Hz component. Tuning only moves offsets, so that carrier never gains a partner. The three-part resonance test stays false. That is the limit of offset-only tuning, and it is not a lowered threshold.

sun / dog and light / quartz stay apart because their glyph masters are outside π/4. Tuning does not move Φ.

## Spread

Twelve clones of one Φ6 signature, one shared carrier, 24 co-admits:

| | stdev (Hz) | entropy of the hundredths |
|---|---:|---:|
| start | 0.124833 | 3.584963 |
| spacing on | 0.032404 | 3.084963 |
| spacing off | 0.004082 | 0.816689 |

With the spring, the carrier stays spread. Without it, the clique falls onto a few hundredths and the entropy collapses. Glyph Φ was unchanged in both runs.

## Pyodide

Pyodide 0.27.7 matched CPython on the flags, the constants, and a six-admit sun/light script plus retract, the Φ5→Φ8 refusal, and a phase-7 membrane tick. Gap 0. Twelve sun/light admits took 23 ms inside Pyodide. A full scan of the 419-word lexicon, all 87,571 pairs, took 1486 ms. C_min stays 0.87. Echo stays 0.85. Drift stays at or under 0.35. The hard stop stays 0.8. No LLM. Wikipedia is not an anchor.

## Charts

- `source/data/frequency_204_collision.png`
- `source/data/frequency_204_sun_light.png`
- `source/data/frequency_204_spread.png`
