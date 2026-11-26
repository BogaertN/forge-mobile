# Forge Mobile 4.9.229: the layer chain, traced in code (read-only)

Traced on Thu Nov 5, 2026 (CST). Everything here was read only: no pushes, no Supabase writes, no Athena commits, no test runs.
Paths are relative to `forge-mobile/source/`; `E/` means `engine/rmc_engine_v1/`.

**Status legend for the link to the next layer**
- **WIRED:** the next layer consumes this output and it changes the result.
- **PARTIAL:** it is consumed, but in a weakened form (tokens instead of structure, or only some of the time).
- **STUB:** the code exists but returns a placeholder.
- **MISSING:** there is no link.

## 0. The short answer

The chain that runs today is: raw question string → lexicon concept IDs and keyword Φ phase → recall of stored **sentences** → candidates built from those sentences → a per-turn world model (Observe and Derive over sentences, with one copula rule) → **the selected stored sentence is spoken verbatim** → token-coverage Echo → admit gate → an optional user "Remember".

- **What is missing:** the R0 both-direction compile.
  - Its JS implementation exists in `src/grammar.js`, `src/kernel.js` and `src/panini_wording.js` (Pāṇini kāraka clauses, `reparseClause`, `derive`).
  - It sits **beside** the Ask path, not on it: no layer receives a compiled meaning structure, and no answer is composed from one.
- **What is wired:** the world model does pick the answer. Recall feeds the world model. The curators write back, but only by copying anchor sentences.

| # | Layer | Source paper | Input → output | File / function | Link to next layer |
|---|---|---|---|---|---|
| 1 | UI / Ask | Forge PWA | text → `qtext`, `askCtx` | `src/app.js say()` L188 | WIRED |
| 2 | Senses (WordNet meaning) | Doc 4 lexicon | qtext + row → `pa` (meaning ask) | `src/senses.js planAsk` (runs **after** the engine), `KSenses.note` shadow | PARTIAL (post-hoc; only the re-ask feeds `sense`) |
| 3 | **Language kernel, inward compile** (corrected §5) | R0 (Pāṇini / Śābdabodha / Chomsky), Doc 5 | string → kāraka clause | JS: `grammar.js analyse`, `kernel.js`. Python: `lexicon_resonance.apply_lexicon_phase`, `resonance_recall._concept_ids`, `language_core_proto_chat._speech_act` | **MISSING** (JS clause never reaches the engine); **PARTIAL** (Python sees concept IDs plus speech act only) |
| 4 | Computed tier | MEA / kmath | question → `computed` {value, receipt} | `E/computed_math`, `rmc_core._run_once` | WIRED (pre-empts recall) |
| 5 | Recall / pools | RMC Doc, resonance | memory{anchors, contributions, confirmed_shared, phone≤64, research} → ranked nodes | `app.js askMemory`, `rmc_core.preselect_pools` L743, `resonance_recall.rank_memory`, `memory_recaller.build_trace_spine` | WIRED |
| 6 | Phase / band / drift | PCMA Φ1–Φ9, PCI 144/n, DRIFT-SPEC/v1 | text → Φ path, ε_s | `E/phase_parser` (keyword phrase evidence), `drift_engine.analyze_drift`, `settle_subject_phase` | PARTIAL (keyword Φ; band backfill not applied) |
| 7 | RMC deep_dry_run (16 stages) | RMC, Codex | trace_spine → candidate_set, coherence, route | `E/deep_dry_run_orchestrator.run_deep_dry_run` L824; `candidate_generator`, `evolutionary_drift_explorer`, `containment_router`, `chi_correction_gate` | WIRED (route gates the renderer) |
| 7b | Language core "orchestration" | Recursive Agent Orchestration manual, Grok infer | question + recalled nodes → hops / claim | `_offer_language_core` L678 → `language_core_orchestration.orchestrate`, `grok_infer.infer_chain` (karta→karma hop on **stored** role tags) | WIRED as an **override** (it injects a candidate, and `rmc_core` L468/L476 can replace the answer) |
| 8 | World model v1 | Spec 1vBx_Q9K §1.4, contract 1g2034-K | nodes{text} → facts{atom}, derived_text | `E/reasoning_seam.run_reasoning_seam` → `world_model_v1.run_world_model` L983 (`observe`, `derive` L721, `simulate` L949, `_cause_effect_hook` ~L965) | WIRED (default answer); Simulate **STUB**; cause_effect **STUB** |
| 9 | Render, outward compile | R0 outward; RMC μ_t→R_t | claim → R_t | `_run_late_stages` → `output_renderer.render_output` L601 (dry run only); live: `rmc_core` L459 `rendered = derived` | **MISSING** live (R_t is not used; the stored sentence is spoken verbatim; `panini_wording.derive` is not called) |
| 10 | Echo | Echo ≥ 0.85 | question + reply → score | `rmc_core.echo_against_question`, `echo_question`, `relation_echo` (kāraka asked-relation, cap 0.5), `computed_math.echo` | WIRED, but mostly token coverage; speech-act bypass |
| 11 | Drift / admit gate | DRIFT-SPEC/v1, C_min 0.87 | ε, C, Echo → disposition | `drift_policy.admit_decision`, `rmc_core admit_gate`, `_trust_trace` L385 | WIRED |
| 12 | Memory write proposal / Remember | Codex write gate ≥ 0.97 | admitted row → localStorage row | `rmc_core` (ASK-NO-AUTO-WRITE, `write_gate`, `bank_admitted`); `app.js rememberAnswer` L140, `rememberStatement` L165 | PARTIAL (user tap only; stored as a **raw sentence**, not a clause) |
| 13 | Gilligan | Gilligan Codex | research rows, ε → quarantine / ChristPing | `rmc_core connect_quarantine`, `curators_208.js` guard, `gilligan_anchor` | WIRED (quarantine); ChristPing only at ε ≥ 0.80 |
| 14 | Athena (curator / writer) | Athena doc | held gaps → admitted rows → `kb.contributions` | `src/curators_208.js` (15 s tick) → `sb_sync.insertAdmitted` L69; `tools/athena_write_224.py`; `athena_runner_229` (manual, dry-run) | WIRED phone → Supabase → contributions pool → recall (signed-in writer only); runner **MISSING** bridge/cron |
| 15 | Neo | Ask surface | — | label `kernel_process` only | **MISSING** (stale label, no process) |
| 16 | Writeback → layer 5 | self-improvement | contributions / remembered → pools | `askMemory` L94–105 | PARTIAL (it adds sentences, never rules, frames or world state) |

## 1. Layer details and evidence

### 1. UI: `src/app.js say()` (L188)
- **What it handles:** `REMEMBER_LAST` and `REMEMBER_STATEMENT` are regex front doors. Everything else goes through `askMemory(qtext)`, then `KPipeline.researchExcerpt` (a Wikipedia excerpt pushed as `trust:'low', quarantined:true`), then `KRMCCore.run({question, live:true, memory})`.
- **Shape:** a raw string is passed through. No parse is done here.

### 2. Senses: `src/senses.js`
- `planAsk(qtext, row)` runs only **after** an admitted row. It may turn the answer into a meaning question.
- `KSenses.note` is a shadow trace that "never [is] read by any gate".
- Only a picked meaning (`askCtx.sense`) feeds back into the next engine run, through `preselect_pools`.

### 3. Language kernel, inward compile (R0)
- **JS (real, but off-path):**
  - `kernel.js` L8 and L191 load `grammar.js` and `panini_wording.js` (`reparseClause`, `derive`, `swapToks`).
  - `selfmodel.js` L2 holds facts "as kāraka structures… never as reply strings".
  - **Corrected (live run, §5):** before the engine, `forge.sharedKnowledgeView` calls `G.clauseText` once for each confirmed_shared row (461 calls per ask). That renders stored clauses into sentences; it never parses the question. After the answer, `app.js` L259 calls `forge.parseRenderedClause`, but that function only exists on `KKernel`, not on `forge`. So the Pāṇini re-parse tag never runs, either locally or on the live site.
- **Python (what the engine actually sees):**
  - Concept IDs come from lexicon surfaces: `resonance_recall._concept_ids` and `lexicon_resonance.apply_lexicon_phase` ("Replace a keyword phase path with the concept packet").
  - The speech act comes from `language_core_proto_chat._speech_act` L55. It is driven by concept IDs (I.HELLO, A.HELP, F.CAN) plus "no content word", and by `filled.karta` when present.
  - **No kāraka frame of the question is built before recall or Derive.** `world_model_v1.derive` L726 starts from `q_tokens = content_tokens(question)`.
  - A kāraka reading of the question appears only at Echo (`relation_echo`).
- **Link status:** inward compile → RMC is **MISSING** for structure and **PARTIAL** for concepts.

### 4. Computed tier
- `computed_math` parses math and computes it with a receipt.
- When it applies, it pre-empts recall, and Echo recomputes the answer (`rmc_core` ~L492).
- **Link status:** WIRED, and the cleanest "machinery" layer.

### 5. Recall
- **Pools:** anchors, `kb.contributions`, confirmed_shared and phone memory (newest 64), all **sentence strings capped at 400 characters** (`app.js` L101–105).
- `rmc_core.preselect_pools` (L743) and `resonance_recall.rank_memory` select nodes by concept packet.
- **Output:** `trace_spine.memory_recall.memory_state.{active_memory_nodes, admitted_for_observe}`.
- **Link status:** WIRED into layers 7, 7b and 8.

### 6. Phase / band / drift
- `phase_parser._phrase_evidence` and `_rank_phases` work by keyword phrase evidence. They are then replaced by the concept packet where one is placed.
- ε_s comes from `drift_engine`.
- The 144/n band backfill is not applied (overview §2.4).
- **Link status:** PARTIAL.

### 7. RMC deep_dry_run (`deep_dry_run_orchestrator.py`, `PIPELINE_ORDER` L37: 16 stages)
- **Stage order:** input → recall spine → phase_parser → drift → protoforge2 → **candidate_generator** (from the trace spine) → [`_offer_language_core`, not counted as a stage] → evolutionary_drift → **coherence_scorer** → **containment_router** → χ preview → storage / resurrection *previews* → eligibility → **reasoning_seam** (L1025) → late stages.
- **The 16 stages do not reason; they gate.** The router decides `render_allowed` (L596). Storage, resurrection and χ are previews only.
- **Hard-coded values (shortcuts):**
  - `_live_manifest` L536 writes constant `confidence 0.90`, `novelty 0.20`, `semantic_distance 0.20`, `memory_fit 0.80` and `source_confidence 0.80` into μ_t.
  - The χ input uses `"prior_epsilon_series": [0.18, ε]` and `psi1_trace_ref "patch271_dry_run_psi1_ref_not_authoritative"` (L1000).
  - On error, the candidate fallback is a synthetic sentence with C 0.42 (L925).
- **Link status:** RMC → world model is WIRED. The orchestrator passes recalled nodes (with quarantine flags) and the routing Φ path into `run_reasoning_seam` (L1027–1055).
- **What does *not* pass:** RMC candidates, coherence scores and route. The world model re-derives from raw nodes. RMC and the world model run in **parallel** on the same recall, not in series.

### 7b. Language core orchestration (`_offer_language_core` L678)
- `orchestrate()` takes `handle_chat` (speech act), then `infer_chain` (walks stored facts whose `karta` equals the previous `karma`, MAX_STEPS 4), then hops.
- Each hop is debated (`language_core_debate.run_debate`), Echo-checked, then measured (`measurement_kernel`). If C ≥ 0.87 and ε ≤ quarantine, it is appended to `candidate_set` (L800).
- **Override:** `rmc_core` L468 and L476 replace the answer with `language_core.claim`, both for speech acts and when the language-core candidate is the selected id.
- **Shortcut:** for a self-fact hop, the measured nodes are replaced by a single synthetic node with `confidence high, retrieval_weight 1.0` (L770). The self-fact therefore measures against itself.

### 8. World model v1 (`world_model_v1.py`)
- **`run_world_model` (L983):**
  - It starts from `empty_world()` **every turn** and seeds SELF_FACTS.
  - `observe` turns events (recalled sentences) into facts. `parse_sentence` (L184) is a regex over `CLOSED_VERBS`: "X is Y" becomes an atom; anything else becomes `stated`.
- **`derive` (L721):**
  - It ranks facts by `_role_lock` and `_coverage` (**content-token overlap**) and emits up to 4 "direct" claims, which are the stored sentence itself.
  - It applies **one rule**, `WM-COPULA-CHAIN` (X is Y ∧ Y is Z ⇒ X is Z).
  - It detects polarity conflicts.
  - With no content tokens, it returns `undetermined`.
  - If no derived text results, it calls `_chat_derived`, which returns a **CHAT_FACTS string** (L849; for example "Hello.", "Forge does not store a feeling…").
- `simulate` (L949) is deferred (STUB). `_cause_effect_hook` returns admit False, and `cause_effect.RULES=()` (STUB).
- **There is no persistent world state:** nothing is written back (`writes_memory False`).
- **Link status:** world model → output is WIRED. `rmc_core` L459 makes `rendered = derived` the default, and `_claim_for_renderer` L566 does the same on the late-stage path. A conflicted Derive blocks speech (L571 and L463).

### 9. Render, outward compile
- **Live (`rmc_core` L459):** the reply is the `derived_text` string, or else the `scored` candidate string (L466) or `language_core.claim` (L468/L476).
- **Late stages only:** `output_renderer.render_output` (sentence plan, fidelity check via `_jaccard` token overlap, L393) runs inside `_run_late_stages`. Its `R_t` (`rendered_full`) is used only when `live` is false.
- **R0's outward direction is not implemented** on the answer path. That would be clause → wording through `panini_wording.derive`.
- **Link status:** MISSING.

### 10–11. Echo and gate
- `echo_against_question` measures token coverage. `relation_echo` adds the kāraka asked-relation, capped at 0.5.
- **Speech-act bypass** (`rmc_core` ~L478): `echo.score = 1.0, method speech_act_meaning`.
- Then `admit_gate`, then `_trust_trace`. `_trust_trace` L385 treats a reply equal to any `CHAT_FACTS` text as a trusted self-fact.

### 12. Memory write
- Ask never writes (ASK-NO-AUTO-WRITE). `bank_admitted` is a decision only.
- The user's "Remember" stores `{id, text: sentence, provenance}` in localStorage (`rememberStatement` L165). That is regex-checked, privacy-redacted, and **not parsed into a clause**.

### 13–16. Daemons
- **Gilligan:**
  - `connect_quarantine` quarantines research rows (WIRED).
  - In `curators_208` it guards premise trust and ε bands (one re-measure for 0.35–0.40, quarantine for 0.40–0.80, cold storage above 0.80).
  - ChristPing starts only at ε ≥ 0.80. `language_core_engines.run_engines` runs after the admit decision and is **trace-only**.
- **Athena:**
  - **Phone (`curators_208.js`):** held Ask questions become gaps. Every 15 s the same `rmc_core` re-runs over **trusted anchors only**, followed by an Echo re-parse. The result goes to `KSb.insertAdmitted` (L69, signed-in writer plus device signature), otherwise it stays PENDING (not fed to Ask). Admitted contributions return through the `kb.contributions` pool. **This is the one real self-improvement loop**, but what it writes is an anchor sentence that already existed, re-keyed to a question.
  - **Server:** `tools/athena_write_224.py` has the double commit lock. `athena_runner_229` is manual and dry-run, has no bridge from the phone queue and no cron, and does not use `resurrection_engine`, `spc_cold_storage` or `ghost_loop_containment` (overview §2.7).
- **Neo:** only a stale `kernel_process` label. There is no process or loop (MISSING). `dream_idle.js` is legacy, and there is no background service worker.

## 2. The four questions

1. **Does the language kernel (R0 both-direction compile) feed the RMC?** **No.**
   - The JS Pāṇini kernel never parses the question. Before the run, the only call is `G.clauseText`, which renders the 461 shared rows into sentences. The intended post-answer tag (`app.js` L259 `forge.parseRenderedClause`) is dead code, because the method is on `KKernel` (corrected, §5).
   - The Python engine gets a raw string. Its "language core" (`_offer_language_core`) is a fact-hop walker plus speech-act classifier over **stored** sentences, which is not a compile of the question.
   - Outward compile is not used: the live reply is a stored sentence (`rmc_core` L459–476).
2. **Does the RMC feed world_model_v1?** **Partly.**
   - The orchestrator hands the world model the recalled nodes, quarantine flags and Φ path (L1025–1055).
   - It does not hand over RMC candidates, C, ε or route. The two run side by side on the same recall, and the route only gates rendering afterwards.
3. **Does the world model shape the output?** **Yes, as the default.** `derived_text` is the live reply (`rmc_core` L459, `_claim_for_renderer` L566). But:
   - (a) Derive mostly returns a stored sentence chosen by token coverage, with one copula rule;
   - (b) it can be overridden by the scored candidate or the language-core claim (L466/L468/L476);
   - (c) with no match it falls back to CHAT_FACTS strings;
   - (d) it is rebuilt empty each turn, and Simulate and cause–effect are stubs.
4. **Do the Athena, Gilligan and Neo daemons write back and improve the system?** **Only Athena on the phone, and narrowly.**
   - `curators_208` → `insertAdmitted` → `kb.contributions` → recall pool. It needs a signed-in writer, and it adds copies of anchor sentences, never rules, frames or world facts.
   - Gilligan filters but does not write knowledge.
   - The server Athena runner has no bridge from the phone queue and no cron (manual, dry-run). Neo has no loop.

## 3. Shortcuts that bypass the kernel, RMC or world model

1. **Speech-act canned replies.** CHAT_FACTS ("Hello.", "Forge does not store a feeling…", help and capability lines) are reached via `_chat_derived` L849 and `language_core.claim`, and the forced Echo 1.0 (`speech_act_meaning`) carries them through. `_trust_trace` L385 trusts any reply equal to a CHAT_FACTS line.
2. **Word overlap as meaning:**
   - `world_model_v1._coverage` / `content_tokens` (Derive ranking);
   - `deep_dry_run_orchestrator._meaning_coverage` / `_admitted_claim` L501–533;
   - `echo_against_question` token coverage;
   - `output_renderer._jaccard` fidelity.
3. **Hard-coded μ_t metrics** in `_live_manifest` L536 (0.90, 0.20, 0.80), plus the χ placeholder series `[0.18, ε]`.
4. **Self-fact measured against itself:** the synthetic high-confidence node at `_offer_language_core` L770.
5. **Regex front doors** in `app.js` (`REMEMBER_*`, QWORD statement test) and regex `parse_sentence` (`CLOSED_VERBS`).
6. **The scored-candidate override** (`rmc_core` L466) can replace the world-model answer.
7. **The fallback synthetic candidate** (C 0.42) on a `candidate_generator` error (L921).
8. **Stored sentences spoken verbatim.** There is no outward render, so "answers from true sources" means *quoting* the source sentence.

## 4. Build plan, in chain order (small, testable, no LLM)

Each step needs a fixture test in the existing Node or pytest style. Write the test first, and do not run the whole suite each time.

1. **Question compile on the path (L3).** Before `KRMCCore.run`, call `forge` / `grammar.js analyse(qtext)` and pass a `frame` object {speech_act, kriyā, kartṛ, karma, wh_role, concepts} in the run payload.
   - *Test:* 20 fixed questions give exact frame JSON. `rmc_core` echoes the frame in its trace unchanged.
2. **Python accepts the frame.** `rmc_core.run` reads `frame`, and `_speech_act` uses `frame.speech_act` when present (concept IDs stay as fallback).
   - *Test:* "How are you?" gives a frame with speech_act self, with no reliance on the "no content word" check.
3. **Memory as clauses (L5 / L12).** `rememberStatement` and the curator writes store `clause` (from `reparseClause`) beside `text`. `askMemory` forwards `clause`.
   - *Test:* "remember that Paris is the capital of France" stores karta Paris, karma "capital of France", kriyā be.
4. **Observe from clauses (L8).** `world_model_v1.observe` builds atoms from `node.clause` when present, and `parse_sentence` regex stays as fallback.
   - *Test:* the 3-fact copula chain derives from clauses, with regex disabled.
5. **Derive by frame, not tokens.** `derive` matches `frame.wh_role` and the asked kartṛ/karma against fact atoms (unification). `_coverage` is kept only as a tie-break with its weight logged.
   - *Test:* "what is oxygen" no longer selects the photosynthesis sentence. A no-match gives `undetermined`, not a CHAT_FACTS line.
6. **RMC → world model in series.** Pass `candidate_set` C/ε and the route into `run_reasoning_seam`. The world model refuses premises the router sealed, and records C per claim.
   - *Test:* a sealed route means derive sees 0 premises.
7. **Real μ_t.** `_live_manifest` takes confidence, novelty, memory_fit and drift from the measured claim; remove the constants.
   - *Test:* the manifest numbers equal the `measurement_kernel` output for a fixture.
8. **Outward compile (L9).** Render the derived atom or clause with `panini_wording.derive` into R_t, and make live speak R_t instead of the stored string.
   - *Test:* a round trip, where `reparseClause(R_t)` equals the derived atom (this is Echo by structure). Keep the source sentence as a cited quote.
9. **Echo by structure (L10).** Echo passes when the reparsed R_t clause fills the asked role of the question frame. Retire the speech-act forced 1.0: a greeting frame is answered by a greeting clause and checked the same way.
   - *Test:* the 20-question fixture, Echo ≥ 0.85, with no token coverage involved.
10. **Replace CHAT_FACTS strings with selfmodel clauses.** Self and capability answers are composed from `selfmodel.js` kāraka facts through step 8. Remove the `_trust_trace` string-equality trust.
    - *Test:* no reply string literal is in the engine (grep guard).
11. **Persistent world state.** Commit derived and admitted atoms (with provenance) to a phone `world_facts` store at the ≥ 0.97 write gate, on user tap only. Derive seeds from it next turn.
    - *Test:* a derived "X is Z" is reused without its premises being recalled.
12. **cause_effect rule slot.** Add 1–3 hand-written range-restricted rules to `RULES`, using the same unifier as COPULA_RULE. `_cause_effect_hook` returns derivations, still admit-gated.
    - *Test:* a fixed rule fires on fixture facts.
13. **Athena bridge.** Export the phone curator queue (PENDING rows) to a JSON file. `athena_runner_229` reads it in dry-run and prints the write plan; there is no cron yet.
    - *Test:* the file round-trips and the plan lists the same rows.
14. **Athena writes clauses and rules, not just sentences.** The curator's admitted row includes clause and atom. Gilligan rejects any row whose reparse ≠ clause.
    - *Test:* a tampered clause is rejected.
15. **Neo, one loop.** Either retire the label or make Neo the scheduler that runs steps 13–14 on an idle tick, logged and dry-run first.
    - *Test:* the tick count and receipt chain are intact.
16. **End-to-end chain test.** One fixture conversation: Remember fact A, Remember fact B, ask the chained question, get the derived R_t, Remember it, and recall it next turn. Assert every layer's trace key is present in order.

The ordering rule: do not start step N+1 until step N's fixture passes, so the chain stays connected instead of improving a single layer.

## 5. Live-run evidence (Thu Nov 5, 2026, CST)

**How it was run**
- Commit 139ef8a7 / 4.9.229, served locally at 127.0.0.1:8765. The bundle matches source for 192/192 files, and the SRI is OK.
- Driver: headless Chrome (playwright-core) typing into `#q`, through the real `app.js say()` → `KRMCCore.run` → Pyodide `rmc_core`. Every row came back with `path: pyodide` and `entry: deep_dry_run_orchestrator.run_deep_dry_run`.
- Cross-check: "What is gravity?" on https://bogaertn.github.io/forge-mobile/ gave the identical reply, and the same missing `forge.parseRenderedClause`.
- Instrumentation was in-page wrappers only, never committed. The raw dump is `/workspace/liverun/results.json`.
- Network: Supabase reads only (the `kb_anchors` GET and the `*_digest` RPCs), plus Wikipedia. Not signed in, and nothing was written.

| Ask | Kernel before engine | Reached RMC | C / ε / Echo | world_model_v1 | Reply source | Shortcuts |
|---|---|---|---|---|---|---|
| What is Mercury? | No parse (clauseText ×461 renders pools) | raw string; concept A.MERCURY; anchors 3113, shared 461, research excerpt (off-topic: Einstein) | 0.888 / 0.127 / 1.0 | 1 node; derive direct; text = premise | stored verbatim (anchor), then replaced by app `planAsk` with "Which Mercury?" | post-hoc sense ask |
| the planet | `KSenses.follow` (JS regex/sense) | re-ask "What is Mercury?" + sense gloss | 0.888 / 0.127 / 1.0 | same claim | stored verbatim | none new |
| What is Saturn? | No | A.SATURN; research = Sega Saturn text | 0.888 / 0.125 / 1.0 | direct; research text appears as a TurnWorld *entity* | verbatim answer, then "Which Saturn?" ask | post-hoc sense ask |
| Why is the sky blue? | No | A.SKY, N.RED (wrong concept); shared row | 0.888 / 0.128 / 1.0 | direct | verbatim (partial explanation) | token Echo |
| What is gravity? | No | A.GRAVITY anchor | 0.891 / 0.111 / 1.0 | direct | verbatim | — |
| 2+2*3 | No | no concepts | 0.889 / 0.120 / 1.0 (recomputed) | derive undetermined, "no content tokens" | computed (sympy) template, "is 8" | computed tier pre-empts WM |
| convert 5 km to miles | No | no concepts | 0.888 / 0.127 / 1.0 | derive direct from a "computation" premise | computed (pint) template | — |
| hello | No | I.HELLO; 0 recalled | 0.890 / 0.124 / 1.0 | undetermined → `_chat_derived` "Hello." | canned CHAT_FACTS self:greeting | CHAT_FACTS |
| who are you | No | no concepts | 0.904 / 0.110 / 1.0 `speech_act_meaning` | undetermined, derived_text "" | canned CHAT_FACTS self:state "Forge does not store a feeling…" via language_core override (wrong answer to the question) | Echo bypass, override |
| capital of France | No | A.FRANCE; 7 CIA anchors | 0.891 / 0.111 / 1.0 | direct | verbatim | — |
| push a bottle… | No | no concepts; 0 recalled | 0.484 / 0.198 / 0 | undetermined; Simulate deferred | **held** (correction_queue) | — |
| Remember my dog is Rex | JS regex REMEMBER_STATEMENT | not sent | — | — | localStorage only; meanwhile Athena re-ran the held bottle question over anchors only (still held) | regex front door |
| what is my dog's name? | No | N.NAME; phone pool 1 | 0.437 / 0.195 / 0.5 | derive direct "My dog is Rex." (phone_kb) | **held**; relation "@owner dog name" not realised | — |

**Claim check**
- §0 "answers are the stored sentence verbatim": **confirmed** for 6 of 6 fact answers (premise text = reply).
- §2.1 "kernel never called before the engine; tags the reply after": **corrected**. It is called beforehand to render pool rows, and the post-answer tag is dead (`forge.parseRenderedClause` is undefined).
- §1.3 "the Python side sees concept IDs plus speech act": **confirmed** (preselect method `resonance_packet_concepts`; speech_act what/why/greeting/self/stated).
- §2.2 "the world model gets nodes, not C/ε/route": **confirmed**. Its output has no C/ε/route. With nothing recalled it receives all 41–45 fed rows.
- §2.3 "WM default; CHAT_FACTS fallback; language-core override": **confirmed** (hello via `_chat_derived`; "who are you" via override).
- §1.10 "speech-act Echo bypass": **confirmed** for "who are you" only. "hello" scored 1.0 by ordinary coverage (corrected: the bypass is not universal).
- §1.8 "Simulate stub": **confirmed** (the bottle question was held).
- §1.2 "senses are post-hoc": **confirmed**. The engine had already chosen the planet before Forge asked "which Mercury".
- §3.7 "fallback C 0.42": **not observed** (the rule was `ENGINE-CANDIDATE-NO-NEXT`).
- §1.14 Athena phone loop: **confirmed firing** (a re-run of the held gap over anchors only, with nothing written while signed out).
- **New shortcut:** the memory-write drift history is a checklist (`rmc_core` L238–245: hist 5/6/7/8 from booleans), so ε = 0.119133 on every clean ask. The C components are also near-constant: memory_fit 0.9309, source_conf 0.879, utility 0.84, novelty 0.704 across all fact asks.
- **New finding:** quarantined Wikipedia excerpts were off-topic on most asks, and they enter TurnWorld as entities.
