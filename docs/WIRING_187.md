# Wiring 4.9.187 — stand-ins removed, trusted anchors, low-trust web

Ask calls `rmc_engine_v1.rmc_core.run` with `live: true`. That is the only spoken answer. C_min stays 0.87. Echo stays 0.85. The coherence formula in `measurement_kernel.coherence_components` is unchanged. No model is called. `dream_idle` and `economy` stay off. Letter packs stay gated. Money stays disabled. ChristPing stays Gilligan-only.

```
question
  -> research.web excerpt
       Wikipedia / Wikimedia / Wikidata / DBpedia / Wikisource / ConceptNet
       trust: low
       quarantined, premise: false
       may point Gilligan at a topic
       cannot be proof by itself
  -> trusted anchor tier (kb.anchors / data/anchors_187.json)
       OpenStax CC BY 4.0 editions, US government public domain
       FORGE-RESONANCE-PACKET/v1 {Phi, eps, mu}
       concept surfaces placed at ingestion (anchor_concepts.json)
       contributor encyclopedia:<source>
       license, source URL, revision on the row
       state anchor, not admitted
  -> Gilligan (gilligan_anchor.connect_quarantine)
       low-trust excerpt phase-aligns with a trusted anchor: LOW-TRUST-POINTS-ANCHOR
       the excerpt is not placed
       no trusted anchor: LOW-TRUST-NO-PREMISE
       a non-low excerpt still uses the 4.9.186 bands
  -> rmc_core.run
       the scorer's formula is unchanged
       a reply that does not rest on a trusted row is held
  -> admit gate
       drift <= 0.35, hard stop > 0.80, C >= 0.87, Echo >= 0.85
       an anchor is spoken only when this gate passes
```

## Removals

These produced or selected an Ask answer outside `rmc_core`. They are gone.

| Removed | What it did |
|---|---|
| `src/claim_parse.js` `matchAsk` | Picked an admitted row by ask-key overlap and spoke it. |
| `src/kernel.js` `CS-RECALL-ASK-KEY` | The call that used `matchAsk` before research. |
| `src/claim_parse.js` `hazardHeadline`, `applyMixHazard` | Hardcoded the chloramine headline. |
| Chloramine lines in `appositives` | Manufactured "Chloramine is a toxic gas" from a keyword. |
| `src/forge.js` call to `applyMixHazard` | Injected that headline into a research answer. |

Kept, because they are Nic's language core or ingestion, not an answer stand-in:

| Kept | Why |
|---|---|
| `src/forge.js` `process` and `src/kernel.js` realization | The language-core turn. Memory, vault, grammar, and Echo still use it. Ask does not. |
| `src/derive.js` research realizer | The grammar's realization of a proved sentence. Not a second Ask path. |
| `src/claim_parse.js` `admitText`, `splitSentences` | Ingestion into a subject-predicate core. Not recall. |
| `localDefine` | ProtoForge's local definition. |
| `topicKeys` | Stored on an idle-dream row. Nothing ranks Ask by it. |

## Anchors

`source/tools/build_anchors_187.py` fetches the starter set again. Sentence cuts happen in that script. Recall does not segment text and does not use token overlap.

OpenStax 2e is CC BY-NC-SA 4.0. Those editions were skipped. The CC BY 4.0 editions (some retired, still licensed CC BY) were used, plus NOAA, NIST, and the CIA World Factbook. The 1911 Britannica catalog did not return a usable text file in this run, so no 1911 row is in the starter set. `gutenberg_historical()` is the extension point and must flag those rows historical.

The phone file is `source/data/anchors_187.json`. Gzip of that file is about 5 kB. It is not inlined into the portable single file.

Hosted copy: `supabase/migrations/20261029223000_anchor_tier_and_writer_grant.sql` creates `kb.anchors` with RLS select for anon and authenticated, and no client insert. `supabase/seed/anchors_187.sql` is the seed. `kb.contributions.state` has no `anchor` value, so the rows are not contributions.

The same migration grants `usage` on schema `app` and `execute` on `app.memory_writer_insert(text, jsonb, jsonb, jsonb, text, text, jsonb, jsonb, text)` to `authenticated`. That grant is already applied on project `hqcvywujrygbnaowgwln`.

## Admit receipt

`docs/ADMIT_RECEIPT_187.md`. Not shipped. The database checks the shape of an admitted row. It does not recompute the gate.
