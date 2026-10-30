# Held cold questions — audit at 4.9.201

Report only. Thresholds are not lowered. Cold admits stay 48 of 60, the same 12 as 4.9.200. The measurements are the cold pass in `source/tools/live_201_results.json`.

Lexicon growth attaches a packet to an unknown word and promotes it only when C is at least 0.87, Echo is at least 0.85 against the question, and drift is under 0.3. Geometry seals a loop that already closes. The renderer speaks a candidate only when Echo passes, and withholds the sentence when it does not. GILIN/CRP logs 0.78, 0.40, and 0.82 and does not admit on them. None of those engines invent a missing premise, treat Wikipedia as an anchor, or accept Echo below 0.85.

| question | C | drift | Echo | why it stays held |
|---|---:|---:|---:|---|
| Who was Ada Lovelace? | 0.487502 | 0.178324 | 0 | Gap. Low trust points at an anchor and supplies no premise. C is under 0.87 and under C* 0.82. Echo is 0. A lexicon packet for the name would still need a lawful answer. |
| When did the French Revolution begin? | 0.484438 | 0.195342 | 0 | `LOW-TRUST-NO-PREMISE`. Wikipedia is not an anchor. No engine may mint the date. |
| Who painted the Mona Lisa? | 0.487019 | 0.181006 | 0 | Gap. Low trust points at an anchor and does not become a premise. C and Echo both fail the law. |
| What happens if you mix bleach and ammonia? | 0.485863 | 0.187427 | 0 | Gap. The chloramine sentence is not a stored premise on this path. Lowering C would be unlawful, and CRP 0.78 does not admit. |
| What happened in the news today? | 0.88715 | 0.131369 | 0 | C is already above 0.87 and above C* 0.82. Echo is 0, so the law withholds it. The renderer returns no output on a failing Echo. Inventing today's news is refused. |
| Who was Marie Curie? | 0.48716 | 0.180224 | 0 | No anchor. Gap. C is about 0.49. A new word packet is not a biography. |
| Who wrote Hamlet? | 0.88832 | 0.124869 | 0.5 | C is above 0.87. Echo is 0.5, under 0.85. The paraphrase was held in 4.9.191 for provenance. Geometry does not repair Echo. C* would not be a lawful substitute. |
| When was the telephone invented? | 0.485869 | 0.187397 | 0 | `LOW-TRUST-NO-PREMISE`. No dated premise. The internal warn at 0.40 is not this row's drift, and it would not admit if it were. |
| What happens if you mix bleach and vinegar? | 0.486107 | 0.186075 | 0 | No anchor. Gap. Same bind as the ammonia question: no lawful sentence to render. |
| Who was Cleopatra? | 0.487469 | 0.178504 | 0 | No anchor. Gap. C under every admit line, including the internal C*. |
| When did World War II end? | 0.487198 | 0.180012 | 0 | No anchor. Gap. A heartbeat cannot coordinate a fact that was never admitted. |
| Blargh floople zig? | 0.487014 | 0.181036 | 0 | Nonsense. Resonance is not parsing. A novel token stays provisional until the law passes across uses. This string has no answer and no Echo. |

Two rows already clear C_min and still fail Echo: the news question and Hamlet. The other ten sit near C 0.48 with Echo 0 and no premise. Using CRP 0.78 or C* 0.82 as an admit line would break the law and still would not supply those premises. They stay held.
