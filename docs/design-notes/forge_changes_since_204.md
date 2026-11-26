# Forge Mobile: what changed after 4.9.204 (225080f, PR #134) and why

Repo: https://github.com/BogaertN/forge-mobile. This was a read-only review, and the repo was not modified. All times are America/Chicago: CDT through Oct 31, CST from Nov 1.
HEAD is **139ef8a = 4.9.229** (Nov 5 2026, 05:52 CST). The live site is on the same build: build-info.json shows commit 139ef8a, 649/649 tests passed, and Deploy Pages succeeded.

**Important:** there are **no merged PRs after #134** and **no GitHub releases**. The only tag is the old `v4.9.3-pre-cleanup`. All 29 commits after 225080f were pushed directly to main by Nic Bogaert. The only open PR is #132, "WIP 4.9.203: reference-prose self-seed (not ready)". Each "release" below is a VERSION bump in a commit, and links point to commits.

Sources for the reasons:
- source/CONFLICTS.md has Conflict/Resolution/Open entries for 204-repair through 222.
- For 223–229, there are no CONFLICTS entries. The reasons come from the commit messages, data/feature_registry.json (R4223–R4229), the docs/LIVE_TEST_2xx.md files, migration headers and tool docstrings.

## 1. Timeline

| # | Version | Commit | Date (CT) | What it did, and why |
|---|---|---|---|---|
| 1 | 4.9.204 repair | [b088153](https://github.com/BogaertN/forge-mobile/commit/b088153ec625089afc54925f0938522c20cb3b71) | Oct 31 15:42 | Unblocked the release gate. **Why:** every Deploy Pages run from 188 to 204 had failed on the size budget, so the live app was stuck on 4.9.187. Nic ruled that "the size budget never blocks a release", and the budget went from 1.920 MB/570 kB to 2.5 MB/750 kB. The no-LLM scan for `frequenc` was given a hertz-sense exemption in the shell files only. |
| 2 | 4.9.205 | [774f88f](https://github.com/BogaertN/forge-mobile/commit/774f88f245a0384c6efe7ea17b1a0eb7d1ac98b0) | Oct 31 17:24 | **Supabase writer lockdown.** **Why:** `app.memory_writer_insert` was granted to every signed-in account and accepted any "signature" of 64 or more characters. The client sent the content hash as that signature, and sign-up is open, so anyone could write. Under Nic's decision (d), only an account linked to Nic, holding the `writer` role and a verified ECDSA P-256 device signature, may write. This goes through the memory-writer Edge Function and register-device. The old RPC now refuses with KB-WRITER-SIGNED-PATH-REQUIRED. |
| 3 | 4.9.206 | [889271b](https://github.com/BogaertN/forge-mobile/commit/889271be35f4246c88fde51584ec76a494f05d42) | Oct 31 17:45 | **Anchors from Supabase.** **Why:** Ask fetched anchor shard files that never shipped (HTTP 404), so live Ask ran without the 3,101 trusted anchors. The service worker also never installed. Under Nic's decision (b), anchors now come from a read-only `public.kb_anchors` view plus `kb_anchors_digest`. They are cached in IndexedDB and refreshed at most every 6 hours, with a starter-anchor fallback. A new `check_fetches` gate fails the release if it precaches or fetches a URL that does not ship. |
| 4 | 4.9.207 | [f57115e](https://github.com/BogaertN/forge-mobile/commit/f57115e6cfc25dbf92383c0b54fe6d4cabc5a215) | Oct 31 18:02 | **Deleted `data/ask_183_memory.json`.** **Why:** it held 52 hand-written hosted rows (ho-planet, ho-quartz, ho-sky, the math answers) with no source, licence or revision. They were the premises behind most of the claimed **48/60**. Under Nic's decision (a), the honest cold-60 score is **20/60 with 0 false admits**, recorded without tuning. Several of the remaining admits were poor and are listed as such. |
| 5 | 4.9.208 | [5507885](https://github.com/BogaertN/forge-mobile/commit/5507885ae21897041a95d67e252ab1014ad0a188) | Oct 31 18:21 | **Athena and Gilligan turned on as curators** (dream_idle on, Nic's decision (f)). **Why:** before this, dream_idle was off; the "gaps" were letter holes; lookup used `semantic_overlap` and then Wikipedia; drift was a constant; `measuredOf` relabelled Wikipedia as curated; the write key accepted any 12-character string; and the Custody tab said "always on" while the mesh was off. Now the gaps are the questions Ask held, lookup uses only trusted anchors, answers get an Echo re-parse, the Gilligan guard runs, and writes go only through the signed writer. |
| 6 | 4.9.209 (Release A) | [f493aed](https://github.com/BogaertN/forge-mobile/commit/f493aed00b93c97687b3f537def001521be06f42) | Oct 31 19:16 | **Why:** "Why is the sky blue?" was held because the last 12 unsourced Z-pack rows were sent as "confirmed shared" memory. Every admitted answer was also auto-written, which broke the rule that "only explicit user requests write lasting memory", and kb.contributions was never read back. The fix: a fallback of at most 3 candidates, each re-measured; ranking by trust then **phase resonance**; **token overlap removed** from memory_recaller (`_score_node` and `legacy_overlap`); **Ask writes nothing**, so only "remember this/that" or the Remember tap writes; and contributions are read through SECURITY DEFINER functions. Score **22/60**. |
| 7 | 4.9.210 (A2) | [d36db05](https://github.com/BogaertN/forge-mobile/commit/d36db05879931d07085ce80c366be0400854bbb5) | Oct 31 19:37 | **Why:** the phone's word→concept shard index chose anchors ("blue" loaded the Hamlet and Jupiter rows), and unsourced shared rows became premises (the gravity→tides line). Echo checked word coverage only. The fix: the engine chooses from the pool by curated concepts and compound names, **unsourced shared rows are quarantined**, and Echo became frame-aware (a WH-attribute needs a value; "why" needs a cause). |
| 8 | 4.9.211 (Release B, DRIFT-SPEC/v1) | [aa2ba1d](https://github.com/BogaertN/forge-mobile/commit/aa2ba1d545144ac93500bece9c28d7863c3adaa7) | Oct 31 20:23 | **Why:** drift law was scattered, and the hard stop was `>0.8`, so an ε of exactly 0.80 was quarantined instead of stopped. There was an unsourced σ_res≤0.35 gate and no trend check. Echo checked coverage only, so a lost "not" still passed. The server trusted ε values sent by the phone, and Athena's 0.78 appeared in docs as if it were a gate. The fix is one policy, profile nic-2026-10-14/v2, identical in JS, Python and SQL. Checks run in order: forbidden (Φ5→Φ8, Φ4→Φ8, backward), then a hard stop at ε≥0.80, then acceleration, then explore/quarantine at 0.40–0.80, then a single χ-correct pass for 0.35–0.40 or a 3-step rising trend, then clean at ε≤θ_admit=min(0.35, 0.4/(1+0.5L)). **σ_res and the 0.78 gates (Athena Membrane-A, router 0.72/0.78, GILIN CRP) became reference-only.** Writes need Φ6 then Φ7, Echo≥0.97 including the negation, certainty and condition classes, and C≥0.87. The server recomputes ε with `app.drift_eps`. KB-WRITER-* refusal codes were added, and the breaker opens after 3 failures with 60 s recovery. |
| 9 | 4.9.212 (C1) | [246a931](https://github.com/BogaertN/forge-mobile/commit/246a9312b6d2e9f03fe8d6ecd760d69b69050012) | Oct 31 20:52 | Moved the store to kstore.js and the audit chain to kaudit.js, verbatim. **Why:** the first stage of retiring kernel.js. A byte-identical parity transcript proves nothing changed. |
| 10 | 4.9.213 (C2) | [5ba9918](https://github.com/BogaertN/forge-mobile/commit/5ba99189b2854f61963dcd76399c324dc9cab366) | Oct 31 21:04 | Moved the MEA panels to kmea_panels.js and the packs to kpacks.js, verbatim, with a parity check. |
| 11 | 4.9.214 (C3) | [7ade7fc](https://github.com/BogaertN/forge-mobile/commit/7ade7fc9f73417784009da8d6699a545dc02dd5e) | Oct 31 21:29 | Moved derive/reparse (the kāraka parse) to its own module, verbatim, with a parity check. |
| 12 | 4.9.215 (C4) | [4a101fb](https://github.com/BogaertN/forge-mobile/commit/4a101fb045a3620d6ea33e7663c5047ed51f10a1) and [eabf56a](https://github.com/BogaertN/forge-mobile/commit/eabf56a520287d2029070b4eea2e5858fb0f7f3a) | Nov 1 04:50 / 05:01 | **The old JS answer path was deleted**, after Nic approved at 4:16 AM and chose option B at 4:21 AM. This removed Kernel/ForgeKernel.process, the 179 owners reachable only from it, the forge.js wrapper, `recallHosted` and `recallFromBank` (now FORGE-TOOL-RETIRED). kernel.js went from 557,049 to about 147,700 characters. 235 tests, 94 links and 13 requirements were retired, and 34 features were parked. Dry-Run now runs the Python engine with `dry_run:true`. The follow-up commit accounts for the gate rows (681→451). **Why:** the Python RMC engine has been the Ask path since 4.9.183, and the old engine was dead weight that could mislead. **Open:** 45 suites outside CI still call `process`, and Nic has to schedule their retirement. |
| 13 | 4.9.216 | [2a5a60d](https://github.com/BogaertN/forge-mobile/commit/2a5a60ddb35091ac88ee31d03db441dfc65b8d19) and [0f6e287](https://github.com/BogaertN/forge-mobile/commit/0f6e287f392a83620d5ede1417136dce3d4bd3cf) | Nov 1 06:14 / 06:39 | **Computed trust tier.** **Why:** Ask had no arithmetic, and seed answers are not allowed. SymPy and Pint now load from SHA-pinned wheels in the forge-libs bucket, with computation receipts and an Echo that recomputes the result. The second commit is a YAML quoting fix. Score **27/60**. |
| 14 | 4.9.217 | [e448585](https://github.com/BogaertN/forge-mobile/commit/e448585eab8c38c5541f584ab5c56927f3573985) | Nov 1 07:33 | **Definition rank plus relation Echo.** **Why:** the Moon was admitted on a sentence that only mentioned it, and DNA got "Most DNA is located…". Now a definition ranks right after trust, and Echo re-parses the answer for the asked relation, capping the score at 0.5 if it is missing. The /3 candidate-ε normaliser became canonical (D3). Six weak admits were dropped (helium, magnet, atom, lightning, Moon, Nile), giving **21/60**. |
| 15 | 4.9.218 | [c9ce7e8](https://github.com/BogaertN/forge-mobile/commit/c9ce7e8bf99c4d0a769b7da09336ff3ca21f9cf3) | Nov 1 08:15 | **Continuous question tuning** on the 9-phase/144 dial: the integer phase is the band, and the question's words tune the decimal inside it. Nic approved the constants ε 0.02, cap 0.40 and nudge 0.45. |
| 16 | 4.9.219 | [40ccbe8](https://github.com/BogaertN/forge-mobile/commit/40ccbe8f4674b08a8ec02a9da019dbbef35ecc29) | Nov 4 12:29 | **Named bands** on the 144/n ladder (D15, Nic's option 4c): Φ1 Theta 4–8 Hz through Φ9 144 Hz carrier 80–220. The Hz values are symbolic. The 218 ± offset was retired. Band columns were added to kb.anchors, and **the band backfill was drafted but not applied, pending Nic**. |
| 17 | 4.9.220 | [1856cb6](https://github.com/BogaertN/forge-mobile/commit/1856cb67dc11434de2ae8c420367e494699e1cce) | Nov 4 13:47 | **Why:** Athena stamped every promoted fact as Φ9 and stored no decimal or band. It now stores the decimal phase and band, and band_tuning was ported to JS. **Open (Nic):** whether the decimal is the sector start or the sector centre, and whether sfe.Phi should be the content phase. |
| 18 | 4.9.221 | [22dd279](https://github.com/BogaertN/forge-mobile/commit/22dd279bdb7eae4c6e1379b789b2b62b7a61262c) | Nov 4 14:15 | **Meaning ids (OEWN 2025), advisory only.** **Why:** concepts were keyed by spelling alone (Mercury the planet, the god and the element were one key). The OpenStax licence was mislabelled and is corrected, and Britannica was removed. **Open:** 29 sense-review rows for Nic. |
| 19 | 4.9.222 | [d60b6e1](https://github.com/BogaertN/forge-mobile/commit/d60b6e1f745f880760032b3eb98ea7fcd81307dd) | Nov 4 15:11 | **Athena Tier-A fetchers, dry-run** (Nic t137u). **Why:** Athena could only search the Library of Congress and Wikipedia links. Fetchers were added for NASA, MeSH, World Bank, GeoNames, CODATA, BIPM, PubChem, ChEBI and OEWN. The CIA Factbook is disabled because it ended on 2026-02-04, and the IUPAC Gold Book returns 403. **Open:** whether Athena may write. |
| 20 | 4.9.223 | [4d0f285](https://github.com/BogaertN/forge-mobile/commit/4d0f285c83ebcf5bd7e49a03ce14d4bf6c5fd855) | Nov 4 17:43 | **Athena agrees on meaning, not spelling.** It checks the sense plus a WordNet-compatible category and the subject-meaning phase. GeoNames does not count as an independent publisher. Also added: a numeric slot, NCIt CC BY attribution and a frozen Factbook mirror. Dry-run only. |
| 21 | 4.9.224 | [190d8bd](https://github.com/BogaertN/forge-mobile/commit/190d8bdea427f2200b4454ef6282c0b2d3260c94) | Nov 4 18:14 | **Athena write path** (Nic t139u/t140u). `app.athena_anchor_insert` is service_role only and defaults to `p_commit=false`. It requires Echo≥0.97, two independent hosts, a source, a licence and a hash. New columns hold meaning_id, meaning_trace, independent_hosts and attribution. The hypernym depth cap is 4. There is a double lock: FORGE_ATHENA_COMMIT=1 **and** `--commit`. "Live writes OFF until Nic sets go-ahead." |
| 22 | 4.9.225 | [f1a1478](https://github.com/BogaertN/forge-mobile/commit/f1a147846e1a5e56e6c2d29e34c010280c392d64) | Nov 4 18:46 | Polish. A missing category was being written into the claim as the literal 'None', and now is not. The CC BY credit line names the publisher. Still dry-run. |
| 23 | 4.9.226 | [38af513](https://github.com/BogaertN/forge-mobile/commit/38af513f6472d4588be5e4cf52cee5de3fe03773) | Nov 4 19:16 | **Meaning follow-up** (Nic pt141u). After "which meaning?", the user's reply picks a sense and the original question is re-asked under it. This allows at most 2 asks and is deterministic. The concepts of the senses the user did not pick are dropped. |
| 24 | 4.9.227 | [33242b2](https://github.com/BogaertN/forge-mobile/commit/33242b2d40e52a40dc2b69de219989b3ffe1fea5) | Nov 4 20:12 | **Definitions are keyed from the subject meaning** (Nic t142u: "Fix the pipeline not the answer"). **Why:** under 226, Athena keyed a definition from concepts that appeared in the source sentence, so the Moon got A.EARTH. A definitional Ask now also resonates in the subject's meaning phase. A **maintenance path** was added: `app.athena_anchor_supersede` and `app.athena_anchor_retire`, service_role only, audited in kb.anchor_maintenance, touching Athena rows only, and with any replacement re-passing the same gates. `tools/athena_rewrite_227.py` is commit-locked. |
| 25 | 4.9.228 | [550f341](https://github.com/BogaertN/forge-mobile/commit/550f341420c01021a2c0a65453c27d585c8b3532) | Nov 5 04:45 | **Different meanings of the same word are not a disagreement** (Nic pt144u/t145u). Hypernym distance is now the real shortest path to the genus. Cold-60 is identical to 227. |
| 26 | 4.9.229 | [404c87b](https://github.com/BogaertN/forge-mobile/commit/404c87b7a26da448fda09eeac8eb2007cdf92e4d) and [139ef8a](https://github.com/BogaertN/forge-mobile/commit/139ef8a7bd83240c136a05dd51ca41957fb1e7a9) | Nov 5 05:35 / 05:52 | **Recursive Athena gap-filler** (Nic pt146u/t148u/t149u, from his papers). One cycle runs writeback → discover → Gate 7 resurrection → ghost (after resurrection_limit 5) → breaker (after 3 failures). It is deterministic, uses no LLM, and runs dry unless both locks are set. The `cause_effect.py` predict() hook is a no-op, and predictions are never stored as facts. **Ask now asks first** when the subject has several unpicked meanings. **Fix:** cached kb_anchors pool rows now carry meaning_id, so picking "the god" no longer returns the planet fact; this was found by a live probe. **Phase 1 live writes are documented in LIVE_TEST_229:** two kb.anchors rows through Athena's path, Mercury the planet (athena-d3b223fe8c4c1b8ab0, OEWN 09374305-n) and Saturn the planet (athena-6b668c6344ec232d4d, 09447520-n). Cold-60 was not re-run for 229. |

## 2. Corrections: what was wrong, why, and what replaced it

1. **Test answers inflated the score (48/60 → 20/60 → 22/60 → today 21/60).**
   - Wrong: 52 unsourced, hand-written rows in ask_183_memory.json supplied the premises for most of the 48 admits. README sections for 4.9.193–204 still print "Cold admits stay 48".
   - Fix (207): the rows were deleted, giving an honest 20/60 with 0 false admits.
   - Later scores: 22/60 at 209 after the phase-resonance recall; 27/60 at 216 with the computed math tier; **21/60 from 217**, when relation Echo dropped six weak admits. It stayed 21/60 through 228.
   - Treat 22/60 as outdated.
2. **LLM/Grok-1 removal happened before this range.** It was 4.9.189 (PR #119): "language-core functions replace the model calls; Grok-1 host is not called" (docs/WIRING_189.md). Every release after 204 restates "No LLM". 215 deleted the last old JS engine path.
3. **Word overlap was replaced by phase resonance** (209/210). `semantic_overlap`, `_score_node` and the `legacy_overlap` token scoring were removed. Recall is now trust → phase resonance (grace = rpm·cos²δ inside π/4), and anchors are picked by the engine from curated concepts, not by the phone's word index. Later refinements: definition rank (217), question tuning (218), named bands (219), and meaning ids and subject-meaning phase (221–228).
4. **Automatic memory writes stopped** (209). Ask writes nothing. Only an explicit "remember this/that" or the Remember tap writes, through the signed writer, and only with Echo≥0.97 and C≥0.87.
5. **Unsourced shared rows are blocked** (209/210). Z-pack and shared rows without a source are no longer sent as "confirmed shared" premises; they are quarantined.
6. **Athena's 0.78 gate was dropped** (211). Athena Membrane-A 0.78, router 0.72/0.78, GILIN CRP 0.78 and σ_res≤0.35 are now `reference_only`. Admission is decided only by the DRIFT-SPEC/v1 order, Echo and C_min.
7. **Supabase writes were locked down** (205). This replaced the fake-signature RPC with a linked `writer` role and a verified device ECDSA signature. The server recomputes ε (211). Athena writes go only through a service_role RPC with a double commit lock (224), and maintenance is audited (227). **Still open:** sign-up stays open, so the writer lock is what protects the data.
8. **Anchors moved to Supabase** (206). The shard files that never shipped (404s) were replaced by the read-only kb_anchors view, a digest, an IndexedDB cache and a starter fallback, with a release gate on fetched URLs.
9. **kernel.js's old engine was retired in stages**: C1 (store and audit), C2 (MEA panels and packs), C3 (derive/reparse), all verbatim with parity proofs, then C4 (215) deleted process(), 179 owners, recallHosted and recallFromBank.
10. **Other fixes:**
    - The deploy had silently failed since 188 (204 repair).
    - The inclusive 0.80 hard stop (211).
    - A lost "not" passed Echo; the negation, certainty and condition classes now catch it (211).
    - Definitions were admitted on sentences that only mentioned the subject (217).
    - Meanings were keyed by spelling (221 and later).
    - Moon→A.EARTH keying (227).
    - Different senses of one word counted as contradictions (228).
    - The god/planet leak through cached rows (229 fix).
    - The licence mislabel and the 'None' category (221/225).
    - The Factbook (ended) and Britannica were removed.

## 3. Architecture snapshot at HEAD (4.9.229, 139ef8a)

**Answer path.** The phone sends Ask to the Python RMC engine (`rmc_core` in Pyodide). The old JS Kernel.process no longer exists.

1. Parse and placement: kāraka/Pāṇini parse, 9-phase/144 dial, question tuning inside the integer band, named band.
2. Sense check: if the subject has several unpicked OEWN meanings, Forge **asks first** (at most 2 asks).
3. Pool preselect by curated concepts and compound names. Sources:
   - the kb_anchors cache from Supabase, with the starter fallback;
   - contributions;
   - explicitly remembered rows;
   - the computed tier (SymPy/Pint) for maths.
   Wikipedia is a pointer only, and unsourced shared rows are quarantined.
4. Ranking: trust → definition rank → phase resonance, plus the subject-meaning phase for "What is X?".
5. Candidate fallback: up to 3 candidates, each re-measured.
6. Renderer.
7. Echo re-parse: frame-aware, relation Echo capped at 0.5 when the relation is missing, negation/certainty/condition classes, recomputation for maths.
8. Speak or hold.

**Gates and thresholds.**
- C_min 0.87.
- Echo ≥0.85 to speak and ≥0.97 to write.
- Drift (DRIFT-SPEC/v1, profile nic-2026-10-14/v2), checked in this order:
  - forbidden: Φ5→Φ8, Φ4→Φ8, backward;
  - hard stop at ε≥0.80 (inclusive);
  - acceleration;
  - explore 0.40–0.80;
  - one χ-correct pass for 0.35–0.40 or a 3-step rising trend;
  - admit at ε≤θ_admit=min(0.35, 0.4/(1+0.5L)).
- Candidate ε = (σ_res + D + |ΔΦ|)/3.
- Breaker: 3 failures, 60 s recovery. Resurrection limit 5.
- Reference only: 0.72, 0.78 and σ_res.

**Where things live.**
- Anchors: Supabase `kb.anchors`, read through the read-only `public.kb_anchors` view, with an IndexedDB cache (6 h refresh) and starter anchors.
- Phone memory: localStorage/IndexedDB on the phone. The curation queue is `forge.curation.v1`.
- Shared writes: the memory-writer Edge Function (linked writer plus device signature).
- Athena writes: `app.athena_anchor_insert` (service_role).
- Audit: kb.anchor_maintenance.
- Wheels: the forge-libs bucket. The sense pack: forge-ref.

**Engines on and off.**
- On: the Python RMC engine; Athena and Gilligan as curators (dream_idle on since 208); the computed tier; meaning ids (advisory, and also used for ask-first).
- Athena runner: dry-run by default. Only the Phase-1 Mercury and Saturn rows were written live.
- Off: economy, money, any LLM, letter packs (gated), the old JS engine (deleted), and cause_effect predict (no-op).

**Pending Nic's approval or decision.**
- Live Athena writes beyond Phase 1 (the go-ahead for FORGE_ATHENA_COMMIT).
- Whether Athena writes in general (222 open item).
- The kb_anchors band backfill (219).
- The decimal convention, and sfe.Phi as the content phase (220).
- The 29 sense-review rows (221).
- Scheduling the retirement of the 45 out-of-CI suites that still call process (215).
- The 203 letter-frequency formula, still "proposal v1".
- Open sign-up.
- IUPAC (403) and the Factbook mirror.
- PR #132 is WIP.
- The 227 docs imply rows were written under 226 keying, which the supersede/retire path is meant to clean up. The repo does not record which rows, or whether the rewrite was ever committed live. (I did not query the live database.)

**Current honest score: 21/60, 0 false admits**, recorded and not tuned. It was last measured at 228. The offline pool has no Athena rows, so the two Phase-1 rows are not counted.

**Stale docs.**
- README still says "Version 4.9.204" and "Cold admits stay 48". Only a licence/sources paragraph was added later.
- NEXT_BUILD.md was not updated after 204 and still describes the pre-205 state.
- CONFLICTS.md stops at 222.

## 4. docs/ text that reads like standing rules from Nic

**Rulings recorded in CONFLICTS.md and the commits:**
- "The size budget never blocks a release."
- (a) Delete test answers and accept the honest score.
- (b) Anchors live in Supabase.
- (d) Only a Nic-linked writer with a device signature writes.
- (f) The curators are on.
- "Only explicit user requests write lasting memory."
- "Fix the pipeline not the answer" (t142u): no subject→answer tables and no patched rows. r4227 tests that the new rules name no subject.
- Live Athena writes need Nic's go-ahead (t140u), and the double lock must be set.
- "Forge asks, never guesses" when a meaning is ambiguous.
- "Newest paper wins" (229 docstring).

**NEXT_BUILD.md's recurring "Do not start" list:**
- no model or LLM call;
- do not lower C_min (0.87) or Echo (0.85/0.97);
- Wikipedia is never an anchor (pointer only);
- no hand-written seed rows or canned answers;
- no keyword or overlap admission;
- no hosted migration applied without approval;
- proposals are not canon until Nic confirms;
- money stays disabled;
- letter packs stay gated.

**Other standing rules:**
- Constants are mirrored in JS, Python and SQL and checked by suites (drift_policy docstring).
- Hz values are symbolic.
- Predictions are never stored as facts.
- Quarantined, warm, ghost or dream material never feeds Ask or stable memory.
- Repetition is not independence: two independent publishers are required, and GeoNames does not count.
