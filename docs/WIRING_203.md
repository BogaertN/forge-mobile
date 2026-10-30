# Wiring 4.9.203 — reference prose

A question Ask holds because there is no premise and no connected anchor is still the research target. The module is `rmc_engine_v1.self_seed_203`. It calls `self_seed_202` for the slot, the subject, the claim value, the lexicon placement, Echo, and Φ5→Φ8. It does not copy those checks and it does not copy the coherence formula.

The allowlist is `reference/trusted_sources_203.json`, merged over the 4.9.202 list and ranked by trust. New prose hosts are EPA, HRSA poison-control pages, history.state.gov, and army.mil, all government public domain. Gutenberg and OpenStax stay. Modern Britannica is not an anchor. The 1911 Encyclopaedia Britannica and Chambers's are reached through the Gutenberg catalog when a book title matches the entity or a collection headword, not through a stored article URL. Each kept sentence records the URL, the license, the fetch time, and the SHA-256.

Discovery builds one query from the question's entity tokens. It calls the endpoints in the config: Gutenberg OPDS, the Library of Congress JSON search, MedlinePlus, history.state.gov, the National Archives, army.mil, the Smithsonian, EPA, OpenStax, and the Wikipedia search API. Wikipedia pages are pointers. Their sentences are never anchors. A catalog URL stays a catalog URL. A Today in History page, a research guide, an exhibit, or a Library of Congress blog is narrative and can be kept.

Passage selection splits the prose into sentences. The 4.9.202 claim check then runs. A leading pronoun is rewritten to the entity for that check only when the page or the headword is the entity's own entry. The stored sentence stays the source sentence. Outside that entry the pronoun does not bind.

Corroboration is the same claim value from two independent hosts. One host, including a tier-1 host, quarantines. Disagreement quarantines. A period year on the source flags a claim where time matters: news, a present-tense question, or a year after the edition. An identity and a historical date at or before the edition are not stale. A hazard question keeps a sentence only from a government safety host, and the 4.9.202 recipe check still drops a procedure.

"What can you do?" is the capability act from the Doc 3 modal `can`. It speaks "Forge answers from admitted facts and does not call a model." "How are you?" still speaks the feeling sentence. Echo for a function-word act stays the speech-act meaning at the 0.85 line.

No model is called. C_min stays 0.87. Write drift stays at or under 0.35. The hard stop stays 0.8. Packs stay gated. Money stays disabled. `dream_idle` and `economy` stay off. ChristPing stays Gilligan-only. Resonance does not parse. The coherence formula is unchanged.

The migration `supabase/migrations/20261030233000_self_seed_anchors_203.sql` is flagged and not applied. It adds period year, the stale flag, and page class. It inserts no rows.
