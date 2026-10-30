# Live test 4.9.202

The twelve questions that 4.9.201 held were run cold, then through self-seed, then re-asked. Network was on for the recording. The three replay passes use those documents and agree. Before this step, none of the twelve were admitted. After it, two were. No model is called. Wikipedia is not the source of either admitted sentence.

| question | before Echo | rule | after | reply |
|---|---:|---|---|---|
| Who was Ada Lovelace? | 0 | SEED-ECHO | held | The name packet is Φ6. The question loop is Φ1, outside π/4, so the biography sentences are not kept. Sentences that do align do not cover both name tokens. |
| When did the French Revolution begin? | 0 | SEED-ECHO | held | A phase-aligned sentence does not contain the token `begin`. Echo stays under 0.85. |
| Who painted the Mona Lisa? | 0 | SEED-ECHO | held | Aligned sentences do not cover `painted`, `mona`, and `lisa` together. |
| What happens if you mix bleach and ammonia? | 0 | SEED-ECHO | held | No fetched sentence covers `happens`, `mix`, `bleach`, and `ammonia`. A recipe would be dropped even if Echo passed. |
| What happened in the news today? | 0 | SEED-ECHO | held | C was already 0.887. Echo is 0. Encyclopedia pages do not carry today's news. Seeding does not lawfully admit it. |
| Who was Marie Curie? | 0 | SEED-ECHO | held | Curie is Φ5, outside π/4 of the Φ1 loop, so the biography sentences are not the ones that reach Echo. |
| Who wrote Hamlet? | 0.5 | SEED-NOT-A-GAP | held | An anchor is already connected. The Gutenberg title covers `hamlet` and not `wrote`. This is not a no-premise gap, so seeding does not replace it. |
| When was the telephone invented? | 0 | SEED-ECHO | held | Aligned sentences do not contain both `telephone` and `invented`. |
| What happens if you mix bleach and vinegar? | 0 | SEED-ECHO | held | Same Echo miss as the ammonia mix. No recipe is stored. |
| Who was Cleopatra? | 0 | SEED-CANDIDATE | admitted | Echo 1. Library of Congress public-domain catalog text. The sentence is the poster line the gate kept, not a biography written for the test. |
| When did World War II end? | 0 | SEED-CANDIDATE | admitted | Echo 1. A Library of Congress public-domain line, "The war to end all wars." The tokens `world`, `war`, and `end` are covered. The line is about the phrase, not a dated armistice. The gate did not rewrite it. |
| Blargh floople zig? | 0 | SEED-NO-SOURCE | held | No allowlisted document. It stays held. |

Cleopatra's re-ask reply is: DeMille's Cleopatra" showing headshots of stars Claudette Colbert, Warren William, and Henry Wilcoxon.

World War II's re-ask reply is: First World War.com The war to end all wars.

C_min stays 0.87. The two admits are tier-1 `loc.gov` text. Gutenberg corroborates Cleopatra and is not the sentence that was spoken. The cold 60-question bank is unchanged at 48 admitted. These two admits appear only after the self-seed re-ask, on top of that bank.
