# Wiring 4.9.190 — anchor growth, placement, speech acts

Ask calls `rmc_engine_v1.rmc_core.run` with `live: true`. That is the only spoken answer. C_min stays 0.87. Echo stays 0.85. The coherence formula in `measurement_kernel.coherence_components` is unchanged. No model is called. `dream_idle` and `economy` stay off. Letter packs stay gated. Money stays disabled. ChristPing stays Gilligan-only. Wikipedia stays low trust and is not an anchor or an admit basis.

## What was a bug

Group B was not a threshold problem.

The scorer joined `candidate_kind` into the text it compared. On a short fact such as "Tokyo is the capital of Japan" the label `memory` was enough to hold C near 0.826, and the language-core premeasure near 0.859, both under 0.87. The capitals, oxygen, the Nile, and Mars already had the answering sentence. Comparing the sentence alone, with the same weights, puts those C values over 0.87.

A why-question is phase Φ4. The answering sentences were stored at the default projectable phase Φ9, so they did not phase-align, and the Φ4 anchor that did align did not say why (the sky sentence is about the celestial pole; the ocean sentence is about salinity varying and does not contain the word ocean). Those three hosted facts now carry Φ4, which is the same placement rule the 4.9.187 anchors used. The receipt's phase tags follow `sfe.Phi`, so the scorer and the resonance lock agree.

"What happened in the news today?" locked a Moon sentence because `today` and `time` share `N.TIMEW`. A time word is not a subject. Echo already failed, and it still fails. There is no static anchor for today's news. The question stays held.

"capital" was mapped to `A.JAPAN`, so every capital question shared Japan's concept. That alias is removed. Frame role still locks Tokyo, Ottawa, and Canberra.

Derive broke coverage ties by provenance length, so "What is oxygen?" spoke a photosynthesis sentence. A frame-role lock now outranks that tie. The spoken sentence is the one the scorer measured.

## Speech acts

`handle_chat` names the act from the Doc 5 frame and the Doc 4 concept (`I.HELLO`, `A.HELP`, `A.TELL`). It does not call a model and it does not match with a regular expression.

A greeting, a help request, and a self question are not knowledge lookups. The reply is a world-model self-fact. "How are you?" and "What can you do?" are only function words, so content-token coverage was 0 for any reply. Echo scores the speech act in that case. The 0.85 line is unchanged.

"Blargh floople zig?" is uninterpreted. The act is refusal. It stays held. No sentence is invented.

## Anchors added

Eight sourced sentences are in the starter, in shard `g190`, and in `supabase/migrations/20261030190000_seed_kb_anchors_190.sql`. The migration is `on conflict (anchor_id) do nothing`. It is not applied. The table already has 3093 rows.

NASA (public domain): why the sky is blue; Jupiter is the largest planet. NOAA (public domain): the ocean is salty, and salt comes from land and the seafloor. National Park Service (public domain): leaves stop making chlorophyll. Project Gutenberg public domain: the Hamlet title page, author William Shakespeare. Historical claims that were already in the hosted bank (Ada Lovelace, the French Revolution, the Mona Lisa, Marie Curie, the telephone, Cleopatra, the end of World War II, bleach with ammonia, bleach with vinegar) connect by concept and are spoken from that bank. New proper-name concepts are `lovelace`, `revolution`, `mona`, `curie`, `hamlet`, `telephone`, `cleopatra`, `ammonia`, `vinegar`, `largest`, `longest`, `leaves`, `war`.

## What rose

4.9.189 admitted 32. This pass admits 58. Held: "What happened in the news today?" (Echo fails) and "Blargh floople zig?" (refused). The three passes agree. C_min stays 0.87.
