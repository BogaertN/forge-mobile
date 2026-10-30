# Live test 4.9.202

The twelve questions that 4.9.201 held were fetched once, then replayed three times. Before this step, none of the twelve were admitted. After the slot, subject, numeral, and claim checks, **none of the twelve are admitted**. The two earlier false admits are held. No model is called. Wikipedia is not an anchor.

| question | before Echo | rule | after |
|---|---:|---|---|
| Who was Ada Lovelace? | 0 | SEED-CATALOG | held. Catalog records are not anchors, and the name packet is outside π/4 of the question loop. |
| When did the French Revolution begin? | 0 | SEED-SHAPE | held. No sentence is a time claim with one year about the French Revolution. |
| Who painted the Mona Lisa? | 0 | SEED-SHAPE | held. No identity sentence has the painter as the predicate and the work as the subject of that slot. |
| What happens if you mix bleach and ammonia? | 0 | SEED-CATALOG | held. No effect claim from two hosts. Recipes are not anchors. |
| What happened in the news today? | 0 | SEED-CATALOG | held. Echo on the cold path is already 0. Today's news is not in the allowlist. |
| Who was Marie Curie? | 0 | SEED-SHAPE | held. No identity sentence with Curie as the subject. |
| Who wrote Hamlet? | 0.5 | SEED-NOT-A-GAP | held. An anchor is already connected. Echo 0.5. Seeding does not replace it. |
| When was the telephone invented? | 0 | SEED-SHAPE | held. No year is bound to the telephone as the subject of the date. |
| What happens if you mix bleach and vinegar? | 0 | SEED-SHAPE | held. No corroborated effect claim. |
| Who was Cleopatra? | 0 | SEED-SHAPE | held. The DeMille poster caption is a catalog record and not an identity sentence whose subject is Cleopatra. |
| When did World War II end? | 0 | SEED-SHAPE | held. "The war to end all wars" does not bind World War II and has no date. |
| Blargh floople zig? | 0 | SEED-NO-SOURCE | held. |

A reference sentence can still become a candidate when two hosts state the same slot value, the subject is the question's entity, numerals match, and Echo is at least 0.85. That did not happen for these twelve. Zero admits is the result. C_min stays 0.87.

The cold 60, without this seeder, still admits 48. Every spoken sentence is in `docs/ADMIT_AUDIT_202.md`. One visible mismatch there is unchanged by this fix: "What can you do?" speaks the same sentence as "How are you?"
