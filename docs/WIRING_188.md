# Wiring 4.9.188 — stable Echo, an idempotent writer, sharded anchors

Ask calls `rmc_engine_v1.rmc_core.run` with `live: true`. That is the only spoken answer. C_min stays 0.87. Echo stays 0.85. The coherence formula in `measurement_kernel.coherence_components` is unchanged. No model is called. `dream_idle` and `economy` stay off. Letter packs stay gated. Money stays disabled. ChristPing stays Gilligan-only.

```
question
  -> concept phrase placed at ingestion
       load at most two shards, at most 16 sentences
       starter anchors_187.json stays loaded
  -> research.web excerpt
       Wikipedia stays low trust
       quarantined, premise: false
       may point at a trusted anchor
       cannot be proof by itself
  -> rmc_core.run
       receipt files are read in write order (m0000, m0001, …)
       memory ids are content ids, not temp-directory paths
       Derive tie-breaks on the sentence text
  -> admit gate
       drift <= 0.35, hard stop > 0.80, C >= 0.87, Echo >= 0.85
  -> memory writer
       an already-banked sentence is a no-write
       a shorter sentence does not replace a longer derived row
```

## Echo

On 4.9.187, Echo for the sky, helium, and the telephone moved between passes while C stayed put. Receipt files were sorted by mtime, and a fast write gives them one timestamp, so directory order decided which facts Observe kept. Memory ids also hashed the absolute temp path, so a coverage tie could pick a different sentence. Both are now content order. The check is `source/tools/check_determinism_188.py`.

## Memory writer

Storing a sentence that is already in receipts, phone, hosted, or anchors does not append it. A sentence already contained in a longer derived row is the same no-write. Observe skips a second copy of the same normalized sentence so it does not spend a fact slot. The check is `source/tools/check_bank_188.py`.

## Anchors

`source/data/anchors_188/` holds 3093 sentences in 252 shards. The index maps an ingestion phrase to a shard. Ask loads the shard for the question. The shards are not in the service-worker precache and not in the portable file. Gzip of the largest shard is under 80 kB.

Sources: the CIA World Factbook (US public domain; the factbook.json mirror is CC0), NASA, the National Weather Service, and NIH MedlinePlus. The OpenStax CC BY 4.0 starter remains `source/data/anchors_187.json`. OpenStax CC BY-NC-SA was not used. Wikipedia is not an anchor source. USGS and CDC did not return a usable page on this run (404 and 403). The NOAA salt sentence remains in the starter set.

`supabase/migrations/20261030143000_seed_kb_anchors.sql` seeds `kb.anchors`. The table already exists and is empty. This run does not apply it.

## Stand-ins

The 4.9.187 removal still holds. `matchAsk`, `hazardHeadline`, `applyMixHazard`, `CS-RECALL-ASK-KEY`, and a hardcoded chloramine headline are not in the tree. Ask does not call `forge.process`. `src/forge.js` `process`, `src/kernel.js` realization, and `src/derive.js` research realizer stay. They are the language core, not a second Ask answer.

## Pyodide

The worker bundle includes the updated engine. `src/rmc_client.js` carries the new SHA-384. The 60 cold questions matched python on route, admit, and Echo. Drift and C differed by 0.
