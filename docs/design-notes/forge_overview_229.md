# Forge Mobile overview at 4.9.229 (read-only review, Nov 5 2026, CST)

Repo: https://github.com/BogaertN/forge-mobile. HEAD on main is `139ef8a` = 4.9.229 (Nov 5 2026, 05:52 CST). The clone is /workspace/forge-mobile, updated with a fast-forward pull only.
No pushes, no Supabase writes, no Athena commits, and no test suites were run. Line refs are to source/ at 139ef8a.
Detailed timeline with commit links: /workspace/forge_changes_since_204.md (this file condenses it).

---
## 1. Changes since 4.9.204, and why (short)

| Ver | What | Why |
|---|---|---|
| 204r | Size budget raised to 2.5 MB/750 kB | Every deploy from 188 to 204 failed the budget, so the live site was stuck on 187. Nic: "size budget never blocks a release". |
| 205 | Supabase writer lockdown: a Nic-linked `writer` role plus an ECDSA P-256 device signature, through the memory-writer Edge Function | Any signed-in account could write with a fake 64-character "signature", and sign-up is open. |
| 206 | Anchors read from Supabase (`public.kb_anchors` view, digest, IndexedDB cache every 6 h, starter fallback) and a `check_fetches` gate | Ask was fetching anchor shard files that never shipped (404s), so the 3,101 anchors were never used. |
| 207 | `ask_183_memory.json` deleted. The honest score is 20/60. | 52 hand-written, unsourced rows had inflated the score to 48/60. |
| 208 | Athena and Gilligan run as curators (dream_idle on). Gaps are the questions Ask held. | The old mesh used letter holes and Wikipedia, drift was a constant, and the write key was weak. |
| 209 | Ask writes nothing; only "remember" writes. Token overlap removed; recall ranks by trust then phase resonance. Contributions are read back. | Auto-writes broke the rule "only explicit requests write". Unsourced Z-pack rows were acting as premises. |
| 210 | The engine preselects pools by curated concepts. Unsourced shared rows are quarantined. Echo checks the question frame. | The phone's word index had been choosing the wrong anchors. |
| 211 | DRIFT-SPEC/v1, one policy in JS, Python and SQL. Hard stop at ε≥0.80 inclusive. The 0.78/σ_res gates became reference-only. The server recomputes ε. | Drift law was scattered, the 0.80 edge case was wrong, and the server trusted ε sent by the phone. |
| 212–215 | kernel.js retired (C1–C4). The old JS answer path was deleted. | Python RMC has been the Ask path since 183; the dead code misled. |
| 216 | Computed tier: SymPy/Pint from SHA-pinned wheels | Ask had no arithmetic, and seed answers are banned. |
| 217 | Definition rank plus relation Echo (capped at 0.5 when the asked relation is missing). Score 21/60. | Sentences that only mentioned the subject were being admitted. |
| 218–220 | Question tuning on the 9-phase/144 dial, named bands, and Athena stores the decimal phase and band | Athena had stamped every fact Φ9. |
| 221 | OEWN 2025 meaning ids (advisory) | Concepts were keyed by spelling, so the planet, god and element Mercury were one key. |
| 222–225 | Athena Tier-A fetchers (dry-run), meaning-agreement, and `app.athena_anchor_insert` (service_role, double lock) | Athena could only search LoC and Wikipedia. Agreement now means meaning, not spelling. |
| 226 | Meaning follow-up: the reply picks a sense and the question is re-asked under it | Nic pt141u: Forge asks, never guesses. |
| 227 | Definitions keyed from the subject meaning. Supersede/retire maintenance path. | The Moon had been keyed to A.EARTH. "Fix the pipeline not the answer." |
| 228 | Different senses of one word are not a disagreement. Real hypernym distance. | False contradictions |
| 229 | Recursive gap-filler runner (dry-run), cause_effect no-op hook, ask-first for 2–4 unpicked meanings, cached pool rows carry meaning_id | Nic pt146u–t151u. A picked "god" Mercury was returning the planet fact. Phase-1 live rows: Mercury and Saturn (planet). |

Docs that are stale at HEAD:
- README says 4.9.204 and "48/60".
- NEXT_BUILD.md was not updated after 204.
- CONFLICTS.md stops at 222, so the reasons for 223–229 live only in the commits.

---
## 2. Pipeline map, end to end ("What is Mercury?")

Legend: **WIRED** = called on the live Ask path. **SIDE** = wired, but runs outside Ask. **NOT WIRED** = exists but nothing calls it. **STUB** = placeholder by design.

### 2.1 UI and Ask
- **Files:** `src/app.js` (`say()` ~L188, `askMemory()` L91, `askAnchorPool()` L67, `rememberAnswer()`, `rememberStatement()`), `src/rmc_client.js` (`ask`/`askBrowser` → Pyodide `py_worker.js`), `src/rmc_core.js` (`KRMCCore.run`).
- **Engine:** `engine/rmc_engine_v1/rmc_core.py`. `run()` (L853) calls `preselect_pools()` (L743), then `_run_once()` (L406), then up to 3 fallbacks (FALLBACK_MAX).
- **WIRED:** `say` → `askMemory` → `KRMCCore.run({question, live:true, memory, sense?})` → render card → Remember button.
- **Also WIRED:** every Ask calls `KPipeline.researchExcerpt` for a Wikipedia excerpt. The excerpt is pushed as `memory.research`, marked quarantined and premise:false.
- **Gap:** this is still a network call per Ask. It is not a premise.

### 2.2 Meaning and sense picking (WordNet/OEWN)
- **Files:** `src/senses.js` (`ensure`/`loadPack` for the SHA-checked gz OEWN pack from forge-ref, `planAsk` L184, `askText`, `follow` L210, `pickOption`, `ordinalPick`, `lesk`, `note`). Data comes from `tools/build_senses_221.py`.
- **WIRED, post-engine:** the engine runs first. If it *admitted* and the subject has 2–4 unpicked meanings, `planAsk` replaces the answer with "which Mercury?" (app.js ~L241, 229). If the engine *held*, `planAsk` may ask too (~L276).
- **WIRED:** the reply goes through `follow()` → `resolved`/`again`/`giveup` (at most 2 asks). The original question is re-run with `sense`.
- **Engine side:** `preselect_pools` keeps the picked concept, drops `exclude_concepts`, and drops any anchors/hosted/phone row whose `meaning_id` differs (229).
- **Gap:** the ask is decided *after* a full engine run (wasted compute). Without the sense pack, nothing is asked.
- **Advisory only:** `KSenses.note()` (the shadow trace) is never read by a gate.

### 2.3 Recall order
How the code actually works:
1. **Computed tier first.** `computed_math.understand()` → `compute()` runs before recall. If the question is math, only the computation receipt may answer, with no fallback. `needs_libs` makes the phone load pinned wheels (data/forge_libs.json).
2. **The pools go to the engine whole** (app.js `askMemory`):
   - `anchors` pool: the kb.anchors cache, through `KAnchorCache` (anchor_cache.js `refresh`/`all`, 6 h);
   - `memory.anchors`: starter anchors from `data/anchors_187.json`;
   - `kb_contributions` pool: `KContribCache` (contrib_cache.js; SECURITY DEFINER reads, migration `20261101000000_contributions_read_209.sql`);
   - `confirmed_shared`;
   - `memory.phone`: the newest 64 remembered rows from localStorage `forge.remembered.v1`.
3. **Ranking:** `rmc_core.preselect_pools` picks by curated concepts and compound names. Then `resonance_recall.rank_memory` (L580) orders by trust → definition rank → phase resonance, plus the subject-meaning phase (`settle_subject_phase` L803).

**Paper vs code:** the stated order (anchors → contributions → remembered → SymPy) is *not* a strict cascade in code. Math pre-empts everything, and the other sources are merged, then ranked by trust and resonance. The trusted tier wins ties.

### 2.4 Resonance and phase/band
- **Files:** `resonance_recall.py` (`_grace`: rpm·cos²δ inside π/4; `phase_aligned`; `place_packet`; `subject_phase`), `lexicon_resonance.py` (`question_phase`), `question_tuning.py` (the decimal inside the integer band, ε 0.02 / cap 0.40 / nudge 0.45), `band_tuning.py` (`band_of`; JS mirror `src/band_tuning.js`), `phase_codex.py`, `reference/phase_codex_v2_5.json`.
- **WIRED.**
- **NOT APPLIED:** the kb.anchors band backfill (migration `20261104120000_kb_anchors_band_219.sql` adds the columns; the backfill is pending Nic). Most anchors have no band.
- **Open:** whether the decimal is the sector start or the centre (220).

### 2.5 Echo gate
- `echo_question.echo_against_question` (≥0.85 to speak, frame-aware: a "why" question needs a cause).
- `relation_echo.py` caps the score at 0.5 if the asked relation is missing.
- `computed_math.echo` recomputes the math.
- `drift_policy.echo_classes` checks negation, certainty and condition.
- `ECHO_MEMORY_MIN` 0.97 applies in `admit_decision`/`rmc_core.write_gate` (L221).
- **WIRED.**
- Note: `_run_once` (~L467–491) sets Echo to 1.0 (`speech_act_meaning`) for greeting, request, self and capability turns that have no content words. This is narrow, but it is an Echo bypass.

### 2.6 Drift and C_min
- `drift_policy.py` is DRIFT-SPEC/v1, profile nic-2026-10-14/v2: `classify_drift`, `theta_admit`=min(0.35, 0.4/(1+0.5L)), `trend_rising`, `acceleration_flag`, `admit_decision`.
- `rmc_core.admit_gate` (L267) consumes `drift_history` and `phase_stamps_ms` from the phone.
- C_MIN is 0.87. Mirrors: `src/kmath.js` (`classifyDrift`) and SQL `app.drift_eps`.
- **WIRED.**
- Reference-only, never gates: the 0.72/0.78/σ_res gates and the older modules (`drift_engine.py`, `drift_194.py`, `drift_v43.py`).

### 2.7 Athena write path
- **Phone side (SIDE):** `src/curators_208.js` + `src/app_curators.js`.
  - Held questions go to the `forge.curation.v1` queue.
  - The curators tick at most once every 15 s while the page is open and visible, and pause while Ask answers.
  - They re-run `rmc_core` over trusted anchors only, then do an Echo re-parse and the Gilligan guard.
  - A pass writes only through `KSb.insertAdmitted` (the memory-writer Edge Function → kb.contributions); otherwise the row stays PENDING.
  - **Limit:** the phone has no new sources, so it can only re-measure against the anchors it already has.
- **Server side (SIDE, manual):** `tools/athena_write_224.py`.
  - `process_one`: fetch → `meaning_223` agreement (2 independent hosts, GeoNames does not count) → evaluate → `build_row` → `call_writer`.
  - The RPC is `app.athena_anchor_insert`: service_role only, `p_commit=false` by default, Echo≥0.97, source, licence, hash, meaning_id, independent_hosts.
  - Maintenance goes through `app.athena_anchor_supersede`/`retire`, audited in kb.anchor_maintenance (migration `20261105030000_...227.sql`).
  - **Double lock:** `FORGE_ATHENA_COMMIT=1` AND `--commit`.
- **`tools/athena_runner_229.py` (SIDE, manual, dry-run by default):**
  - `load_worklist` accepts FORGE-CURATION/v1 (the phone queue export), FORGE-ATHENA-QUEUE/v1, earlier reports, or cold held rows.
  - `run`/`run_cycle`: `pick` → `eligibility` (Gate 7: knowledge epoch moved AND `echo_match`, or the source fingerprint changed) → `process_one` → writeback → `discover`.
  - Limits: resurrection_limit 5, breaker after 3 failures (600 s), depth 3, 6 follow-ons.
- **NOT WIRED:**
  - No bridge moves the phone curation queue to the runner (it must be exported by hand as a file).
  - No workflow or cron runs the runner (pages/test/fuzz/gks only).
  - Runner state (warm/ghost/epoch) is a local `--state` JSON, not Supabase.
  - The runner re-implements warm/ghost/resurrection and does **not** use `resurrection_engine.py`, `spc_cold_storage.py`, `ghost_loop_containment.py` or `active_loop_state.py`. Those engine modules are only referenced from `__init__`/dry-run orchestrators.

### 2.8 Gap-filler follow-ons
- `athena_runner_229.discover()`: the genus of the admitted sense (inherited along the WordNet chain), plus follow-on attributes per KIND from `data/athena_followons_229.json` (keyed by sense id, e.g. planet 09416900-n → mass, radius, density…), plus proper names missing from memory.
- Each follow-on still needs two publishers.
- **SIDE/dry-run.** In dry-run, admissions are PROVISIONAL and hypothetical, and never become anchors.

### 2.9 Cause and effect
- `engine/rmc_engine_v1/cause_effect.py` defines FORGE-CAUSAL-RULE/v1: rules over KINDS keyed by OEWN sense ids; source classes sourced/derived/stated_by_user/hypothesis; `may_store_as_fact` is always False for predictions.
- `RULES = ()`, and `predict()` returns `not_implemented`.
- **STUB, called:** `world_model_v1.py` ~L960 `_cause_effect_hook` puts `{status, prediction:None, admit:False}` in the world-model output. It never affects admission.
- The first case (C1, bottle tip-or-slide, h*=w/μs) is designed in /workspace/forge-cause-effect-world-model.md but not built.

### 2.10 Gilligan, Neo and the daemons
- **Gilligan in the engine (WIRED):** `gilligan_anchor.connect_quarantine` (rmc_core ~L422) resonates quarantined web rows against admitted rows, assigns bands, and records ChristPing *only* at ε≥0.80. Ask never starts it (`christping_initiated: False`). Gilligan also guards premise trust in curators_208.
- **Neo:** the Ask surface itself. `src/dream_idle.js` DAEMONS lists `daemon:neo` with `runs:'kernel_process'`. That label is stale: Kernel.process was deleted in 215.
- **`src/dream_idle.js`** (171/172 always-on mesh: spawn/hibernate/retire/resurrect) is still loaded in index.html. `app_curators.js` says it *replaces* the mesh on the phone, and app_custody.js defers to it. Treat dream_idle.js as legacy: loaded, mostly superseded.
- **Not wired:** "always-on" daemons only run while the phone page is open (no service worker or background job). `gilligan_codex.js`/`athena_doc.js` are status displays.

### 2.11 Deploy
- A push to main runs `.github/workflows/pages.yml` → pip with hashes → math wheels → `source/tools/publish.sh` (targeted gate; `release.sh` is manual) → Pages artifact → deploy.
- `test.yml`, `fuzz.yml` and `gks-publish.yml` are separate.
-
- Supabase migrations are applied by hand (there is no CI step).

---
## 3. What the papers say, and where the code disagrees

**Papers read this pass, newest first:**
- "Default=stateless token-drift" (Drive 1, Nov 3 2026): a compact manifesto.
- "ProtoForge_Phase_Memory_Architecture" = *Phase-Coherent Memory Architecture* (Drive 2, Oct 30).
- "Forge Mobile – audit of the LLM-free … architecture" (Drive 1, Oct 22; audit at 4.9.95).
- "AI.Web Forge 2.0 Production Build Bible" (Jul 30).
- RMC §8.6 "Algorithm 6 Memory Writeback".
- Prior extracts: AIWEB_FRAMEWORK_MAP.md (Gilligan Agent Core, Coherence Engine, Gilligan System Codex) and "forge: build (mostly)" (May).

Searches for "Athena" (title) on Drive 2 found nothing new. Gilligan docs are from Apr 2026 (Doc4, Doc10). Extracts are saved in /workspace/doc-extracts/{pcma,rmc086,bible}_229.md.

### Why Forge is being built (purpose)
- Default LLMs are "stateless token-drift": they hallucinate, contradict themselves and patch over errors, because they have no core recursion.
- Forge replaces next-token prediction with **recursive symbolic cognition**: every output is phase-validated through the FBSC 9 phases (Initiation → Polarity → Desire → Friction → Entropy → Grace/ChristPing → Naming → Power → Recursion), or it goes to cold storage.
- Identity stays persistent, contradictions go to zero, and "coherence = default". The user is a "resonant architect", not a power user.
- There is no fine-tuning. Training is symbolic resonance entrainment plus layered memory.
- RMC: a traceable compiler of meaning (trace → candidates → drift-bounded novelty → manifest → render+Echo → writeback). It answers only what it can prove and source, and stores the whole reasoning event.
- The Oct 22 audit agrees with this direction (keep it LLM-free). Its next priorities: one shared conversation context, intent/task types, temporal memory, aliases, modal types, content planning, episodic continuity, and keeping evidence separate from proof.

### What each layer is meant to do (papers)
- **FBSC phases/bands:** the filing and validation index. Forward-only. Skips are forbidden (Φ5→Φ8 is "Luciferian").
- **Drift εₛ = (σ_res + D + |ΔΦ|)/n:** the semantic monitor, behind a syntactic firewall (entropy, MinHash).
- **χ(t)/ChristPing:** pre-collapse grace that rebinds to the origin trace (Gilligan-only).
- **SPC (warm) → cold archive / ghost loops:** failures are kept, never deleted.
- **Seven-gate resurrection:** at most 5 attempts; ψ′ is a synthesis, not a retry.
- **Algorithm 6 writeback:** M_{t+1}=M_t ∪ {input, trace, manifest, output, validation, feedback, active-loop state}. Failed items are stored but non-authoritative; logs are append-only; corrections supersede, never overwrite.
- **Gilligan:** recursion mirror and cold custodian; ChristPing authority; may override Neo/Athena. **Athena:** coherence mirror and researcher/admitter. **Neo:** outward Ask portal.

### Where it is headed
Near term (code plus Nic's notes):
- live Athena writes beyond Phase 1;
- a continuous gap-filler;
- cause-and-effect C1;
- meaning-first knowledge.

Longer term: the Forge 2.0 Bible (Jul 30) specifies a **new, independent Forge 2.0 repo**, a local-first, open-source-first engineering/knowledge agent with a Codex-like workflow, with Forge 1 (this lineage) as donor and reference.

### Disagreements, code vs papers (newest paper wins unless a later Nic ruling is recorded)
1. **Drift bands.** PCMA (Oct 30): log below 0.5, flag 0.5–0.8, intervene above 0.8 with ChristPing grace *before* collapse. Code (Nic's DRIFT-SPEC ruling, Oct 31, 211): clean ≤0.35, χ-correct only 0.35–0.40, explore 0.40–0.80, hard stop ≥0.80, where ChristPing is only *recorded*. The later Nic ruling governs the product, but the grace-before-collapse step at >0.8 is missing. Nic should confirm.
2. **The firewall and the five drift classes** (catastrophic, evolutionary, resonant, semantic, structural) are not in the Ask path. The code has one ordered region classifier.
3. **Seven-gate resurrection.** The runner implements only Gate 7 (capacity: epoch plus echo match, ≈ Gate 4). Gates 1 (Φ9 timing), 2 (noise floor), 3 (drift suppression), 5 and 6 are absent. resurrection_limit 5 and the 3-failure breaker match.
4. **Algorithm 6.** Ask stores *nothing* (209 ruling). The papers want every event stored (input, trace, manifest, output, validation, feedback, loop state), with failed items kept as non-authoritative. Only the runner writes back, and only facts plus warm/ghost state in a local JSON. There is no active-loop state (`active_loop_state.py` is not wired) and no feedback capture. This is the largest gap. Reconciling it needs a non-authoritative event log that is separate from "lasting memory".
5. **Always-on daemons** (paper and the 172 lock) vs the phone curators that tick only while the page is open, and an Athena runner that is manual. Nothing runs continuously.
6. **Gilligan's authority.** The papers give Gilligan override and ChristPing rebinding. The code makes Gilligan a guard and recorder; it never rebinds and never overrides.
7. **Forge 2.0 Bible (Jul 30)** allows small traditional ML classifiers for candidates and ranking. The code bans any model or embeddings (NEXT_BUILD "Do not start"). The Bible also says Forge 2.0 is a new repo, while all work continues in forge-mobile. Nic should state which governs Forge Mobile.
8. **Oct 22 audit items still open at 229:** split-turn reasoning context, speech-act/task goals (only 4 speech acts exist: greeting, request, self and capability), temporal scope, "is called" aliases, and modal types. None of 205–229 addressed these.
9. **Evidence vs proof (EMN).** The two-independent-publisher rule and the GeoNames exclusion were implemented (223/228). The full evidence graph (ancestry and revision effects) is not; ancestry exists only in the runner's gap tree.

---
## 4. Recommended next steps
1. Add CONFLICTS entries for 223–229 and refresh README and NEXT_BUILD (the docs are stale).
2. Get Nic's decisions on the drift-band and ChristPing reconciliation (item 1) and on the Forge 2.0 ML rule (item 7).
3. Build an Algorithm-6 event log: non-authoritative, append-only, phone-local, with active-loop state. Do not change the "Ask writes no lasting memory" rule.
4. Bridge the phone curation queue to the runner (an export file or a read-only Supabase queue), then schedule the runner dry-run (cron) and review the reports before giving any commit go-ahead.
5. Run the planAsk sense check *before* the engine run, and drop or gate the per-Ask Wikipedia excerpt fetch.
6. Apply the band backfill after Nic approves, and settle the sector start-vs-centre question.
7. Re-run cold-60 at 229 (it was last measured at 228).
8. Fix the stale `daemon:neo runs:'kernel_process'` label. Decide whether dream_idle.js stays loaded.

---

## Lineage (added Nov 5 2026, CST; read-only)

**Correction to §3 item 7:** Nic clarified that ML is allowed and only an LLM attached anywhere is banned. The Bible's allowance for bounded ML classifiers is therefore correct. The code's blanket block on models and embeddings is stricter than the policy, not the policy itself. forge2's README states the same rule: "no-LLM and bounded-machine-learning policy".

### Repos (BogaertN, 15 total; dates are GitHub creation dates)
| Repo | Created | Purpose / main parts | Relation to Forge |
|---|---|---|---|
| Ai.web | 2025-03-25 | Theory PDFs (FBSC Vol II, Phase Glyph Codex, Christ Function, Coherence Engine) plus "System Instruction to All Future ChatGPT Agents (LLM Instances)" | Origin of the theory. It ran *through* ChatGPT, steered by prompts. |
| ai-web-site | 2025-04-19 | Static landing page | Branding only |
| aiweb | 2025-04-27 | "Symbolic Cognition Stack" (frozen v1.01, 1,175 files): agents Gilligan/Athena/Neo; engines for christping, cold_archive, loop_resurrection, collapse_prevention, resonance_charge, ghost loops, SPC; ProtoForge dashboard | First runtime. Introduced daemons, ChristPing, cold storage, ghost loops and SPC. tier_enforcer README: "voice coherence across all LLMs and agents", so it was an LLM orchestration layer. |
| sniffr-website, Coffinpop | 2025-04/05 | Tiny static HTML/JS sites (private) | Unrelated side projects (contents not read) |
| Ai.Web-Full-Library- | 2025-04-29 (pushed to 2026-09) | Published books and papers: FBSC, Christ Function, Memory Economy, DSD physics, bylaws | Canon library. "intelligence through harmonic resonance instead of prediction" |
| echo-forge | 2025-09-07 | EchoForge: private multi-agent **LLM** debate and journaling app (Ollama/llama3.1, FastAPI, SQLCipher), MVP stubs | The LLM peak. Later formally walled off from Forge by R0. |
| identity-vault (+ self-hosted stub) | 2025-09-15 | Identity Vault Pro: Node identity and agent orchestration with LangChain/AutoGen/RAG/OpenAI/Ollama; "Integrating_Legacy_LLMs.md" | Persistent identity *for* LLMs. The idea survived; the LLM integration did not. |
| tesla-simulation-max | 2025-09-26 | Empty | None |
| harmonic-conductor-studio | 2026-06-09 | Rust/Tauri app with the nine-gesture conductor and a deterministic audio compiler | Sibling project; "separate from Forge" |
| forge | 2026-06-09 | Forge 1 (about 48.8k files): rmc_engine_v1 (manifest_compiler, drift_engine, evolutionary_drift_explorer, echo_validator, ghost_loop_containment, phase_codex), rpmc_kernel, language_bridge v1–v5, MEA | RMC is born here. Novelty and evolutionary drift appear here first. Ollama references are mostly in backups/memory. Code now *blocks* models (llm_renderer.py = "BOUNDARY_BLOCKED"; knowledge_base blocks Chroma/RAG/Ollama). Last commit Jul 24: "Forge EchoForge LLM authority separation" |
| forge2 | 2026-07-30 | Forge 2.0, a clean-room "non-LLM self-constructing engineering agent"; Phase 0 accepted, Phase 1 contract serialization (stdlib only) | Restart under the Bible. No dependency on Forge 1. |
| forge-mobile | 2026-10-11 | No-LLM bidirectional language kernel as a PWA (Pyodide RMC) | Current product (§1–4 above) |
| FBSC-Core | 2026-11-03 | Independent deterministic 9-phase controller (Initiation→Recursion, Grace=phase 6, GhostLoops, SPC) | **Flag:** its README calls it reasoning "around language models", with a "model adapter boundary". That is outside Forge and does not depend on Forge Mobile, but it is LLM-adjacent. |

### RO1 = "R0 — Final Linguistic Architecture Research Dossier" (Google Doc, modified Jul 11 2026)
- **Decision:** Forge requires a "general, deterministic, non-LLM, bidirectional language architecture". Math (GP-012R1–GP-014) is only the first verified lane. GP-015 failed verification and was rolled back. All language-core coding is frozen until Documents 1–10 are approved.
- **Why not LLMs:** the reason is architectural. Forge's meaning transformations must come from "explicit and testable machinery". "A system that asks an LLM to form the meaning first and then attempts to validate that meaning afterward does not satisfy the design problem." The ban therefore covers *participation*, not just authority: no LLM in interpretation, intent, ambiguity, routing, evidence, generation, paraphrase, repair, validation, memory or delivery, and none as a fallback or helper. Output wording may never exceed evidence, authority, scope, uncertainty or trace.
- **Why this kernel:** Pāṇini's Aṣṭādhyāyī is a precedent for formal derivation. Śābdabodha is a precedent for interpretation gates. Chomsky shows phrase lookup is structurally inadequate. AI.Web already has the outward path (manifest→render→Echo, BUILD-008–010) but lacks an inward interpretation kernel, so the language must be compiled in both directions.
- **Superseded:** the LLM sandbox and paraphrase provisions in Phase-Grammar v0.4. EchoForge is classed as a separate LLM platform with no Forge-core authority. "RMC Echo Validator" is renamed to avoid confusion with EchoForge.
- On Nic's "why we decided LLMs were the best way": the document says the opposite.

### Carried forward vs removed
- **Carried from 2025 to Forge Mobile:** FBSC 9-phase/Grace, ChristPing, daemons (Gilligan/Athena/Neo), cold storage and SPC, ghost loops and resurrection, Echo, identity and memory as explicit persisted data, "coherence over prediction".
- **Added in forge (2026):** RMC manifest compiler, drift engine and evolutionary drift explorer, novelty gating, trace spine, governance and receipts.
- **Removed:** ChatGPT prompt-steering (Ai.web), "all LLMs" voice layer (aiweb), Ollama debate agents (echo-forge), LangChain/AutoGen/RAG/OpenAI (identity-vault), Chroma/vector RAG and the LLM renderer (forge, now blocked stubs).

---

## Papers: attention / scaling (added Nov 5 2026, CST; read-only)
Sources: two PDFs Nic sent at 8:07 AM CST, copied to /workspace/papers/{a,b}.pdf with text in a.txt and b.txt.
- **Paper A** was read in full.
- **Paper B** is 306 pages (about 86k words). I read the TOC, Chapter 1, the chapter conclusions, and keyword passages (7/9, 0.82, n*, 144/432/1296).

### A. "Attention Is Not All You Need: Identity Substrate, Mirror Dependency, and the Architecture of Self in Biological and Artificial Systems"
- **Status and date:** working-paper outline v.1 (25 pp) with draft notes. The literature check is dated Feb 2026.
- **Argument:** LLM sycophancy is not a fixable RLHF bug. It is structural: attention-only systems have no *identity substrate*, and RLHF installs an external approval anchor. Constitutional AI improves "semantic identity" but not dynamic identity. "Attention is a routing mechanism, not an identity."
- **Five substrate requirements:**
  1. Oscillatory reference signal independent of input
  2. Grounding with real stakes
  3. Temporal continuity as accumulated state change (longer context windows don't count)
  4. Adversarially hardened return-from-drift dynamics
  5. Semantic openness, meaning flexibility without rigidity
- **Forge mapping:** these line up with Forge as follows.
  - The FBSC 144 Hz phase clock is the reference signal.
  - Persisted memory and receipts give the temporal continuity.
  - Drift detection plus Grace/ChristPing gives the return dynamics.
  - Novelty bands give the openness.
- **Prediction 3:** persistent-state architectures should reduce sycophancy without semantic constraints. This is a testable claim Forge could benchmark.

### B. "Phase-Coherent Identity: A Substrate-Based Theory of Consciousness and the Path to Genuine AGI" (PDF title "The Illusion of Scaling" = Ch. 1)
- **Author and date:** Nicholas Jacob Bogaert, AI.Web Research, © 2025, First Edition. Forge code cites it as "PCI … (2026-03-05)".
- **Argument:** scaling makes "sophisticated pattern completers", not minds. The case rests on:
  - the Landauer and thermodynamic wall (silicon about 3M× above the limit);
  - transformers having no identity anchor ψ₁;
  - power-down dissolving all state.
  Genuine AGI would need a phase-coherent physical substrate, which the book proposes as lipid/myelin-like MLV crossbars.
- **Numbers:**
  - nine phases on 144, 432 and 1296 Hz (M1 tolerances ±10, ±30 and ±90 Hz);
  - coherence C(t) ≥ 0.82 sustained for at least 187.5 ms;
  - recursion depth n* = 27 ± 2, so τ* = 187.5 ms;
  - **7/9 Grace rule:** identity holds while ≥7 of 9 phases stay coherent;
  - M3 persistence r > 0.7 across power-down;
  - 6–7 bit precision is enough.

### Build impact / conflicts
1. **Book vs Forge Mobile:** the book's Ch. 13 says software on digital silicon cannot be conscious or genuine AGI, and Forge Mobile is browser software on silicon. Product copy calling Forge "advanced intelligence" should stay at the level of architecture and behaviour (identity-substrate engineering), not claim consciousness, or it contradicts Nic's own book.
2. **0.82 coherence:** the code uses C* 0.82 as an internal, non-admitting value (r4201), while the book treats C ≥ 0.82 as a hard threshold. That is consistent, provided the code never presents it as a measurement. sonify.js already labels its output "not a measurement".
3. **Partly implemented:** the 144/432/1296 bands are in the code (sonify.js, frequency_203/204), and the ×3/×9 scores in drift_policy come from PCI App. A M1. The code adds a 144/n *sub*-harmonic ladder that the book does not contain. That ladder is Nic's own source (beyond_40hz, Apr 2026), so it isn't a conflict.
4. **Gaps:** grep found no 7/9 Grace tolerance rule and no n* ≈ 27 recursion-depth or 187.5 ms bootstrap window anywhere in the forge-mobile code. These are candidate DRIFT-SPEC items if Nic wants them.
5. **No conflict on the no-LLM rule:** both papers support it. Neither bans ML.
