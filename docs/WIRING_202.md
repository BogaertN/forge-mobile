# Wiring 4.9.202 — self-seeding anchors

A question Ask holds because there is no premise and no connected anchor becomes a research target. The asking question is the provenance. The module is `rmc_engine_v1.self_seed_202`. It calls the lexicon for placement, `echo_question` for Echo, and `luciferian_d_score` for Φ5→Φ8. It does not copy the coherence formula.

The allowlist is `reference/trusted_sources_202.json`. A catalog URL (`/item/`, `lccn.loc.gov`, jukebox) and a poster, film, or caption sentence are not anchor text. Reference pages are the ones that can be kept. Wikipedia, Wikimedia, Wikidata, and Wikisource are pointers: their pages may reveal an allowlisted URL and their sentences are never anchors.

The question's wh-word sets the slot. Who and what need an identity copula whose subject is the question's entity. When needs one year, and that year has to be about the entity, including its numeral: World War II is not "the war to end all wars" and not World War I. A what-happens question needs an effect statement that names the entities. Two hosts must state the same claim value. One source, even a tier-1 catalog record, does not corroborate. Echo, drift, C_min, and Φ5→Φ8 are unchanged.

A sentence is placed by the lexicon packet of its concept, or by the letter resultant when the concept is unknown. It is kept only when that phase sits inside π/4 of the question loop. A recipe sentence on a mix question is dropped. The surviving sentences must agree with each other inside π/4. Disagreement goes to `correction_queue`. The candidate still has to clear Echo ≥ 0.85 against the original question. The re-ask is `rmc_core.run` with the candidate in memory. If that re-ask does not admit, the candidate is quarantined. A failure is not fetched again until the backoff clock moves (60s, then 120s, and so on).

No model is called. C_min stays 0.87. Write drift stays at or under 0.35. The hard stop stays 0.8. Packs stay gated. Money stays disabled. `dream_idle` and `economy` stay off. ChristPing stays Gilligan-only.

The migration `supabase/migrations/20261030223000_self_seed_anchors_202.sql` is flagged and not applied. It adds fetch time, content SHA-256, and the asking question, and it allows a `self-seed:` contributor. It inserts no rows.
