# ENGINE AUDIT: Nic's engines vs what Forge Mobile runs
Written 2026-10-29 (America/Chicago, CDT). Research only. No code was changed.

**Forge Mobile checkout:** /workspace/forge-mobile-4172 @ f13fba9 (4.9.173).
**Real engine source:** BogaertN/forge @ fcbf917, `rmc_engine_v1/`. That is 126 files and about 45k LOC of Python. It uses only the standard library, except that `general_pipeline` needs `lark` and, optionally, `sympy` and `pint`.

**Laws applied:**
- No LLM.
- Echo = exact LC.
- Drift must stay at or below 0.35, with χ/quarantine.
- Hard stop above 0.80.
- Docs are the authority.

**Note on the brief's sources:** the `docs/WIRING_*.md` files and `source/data/forge_tool_inventory.json` named in the brief **do not exist** in this checkout or anywhere else on the box (I ran `find /`). The status column below comes from reading `source/src/*.js` directly.

## Read-log totals (see /workspace/DOC_READ_LOG.md)
- Docs listed in Drive (fully paginated, 13 pages): **648**
- Read complete: **79**
- Read in part (first 250k characters; these docs are larger): **16**
- Not read: **553**
- Failed with a 403 export error (too large): Runtime Codex Vol I. I used the local extract in PROTOFORGE_DEF.md instead.
- Read order: indexes 0–25 first, then every doc whose title matches an engine or framework function. That covers the RMC §05 module chapters, §10.2, the Build Bible, Verbal Cognition Gate, Language Core, ProtoForge Vol II / File Structure, RPMC + Blueprint, the Dev Team engine naming, the Final Master List, the Gilligan Core and Codex, the Athena Guide, the Phase 1.5 Codex, the Harmonic Runtime Codex vols, Engine Verification, the Modular Runtime Stack, and the resurrection / recursive_sum_sync engines.
- The 553 unread docs are mostly 2025 chat-export dumps (many are 1–32 MB). **The "read every doc in full" instruction is NOT satisfied.** Each one is marked `[ ]` in the log.

## Status counts
- **RUNNING-REAL: 1**
- **APPROXIMATED: 21**
- **MISSING: 7**
- Total: 29 entries

## Key experiment (run on the box, 2026-10-29 ~09:06 CDT)
I ran `rmc_engine_v1.deep_dry_run_orchestrator.run_deep_dry_run("What is photosynthesis?")` with plain python3.
- It completed in about 0.2 s and needed no dependencies.
- 13 of 16 stages returned OK.
- The containment router then sent the input to `spc_cold_storage_required` (circuit_breaker, coherence 0.0), so the renderer, echo and memory_write stages were SKIPPED.

**Meaning:** Nic's real pipeline runs today, but it stops at containment because nothing supplies it with memory or evidence. The missing piece is wiring: research evidence and KB records have to go in as the memory/trace spine. The engines themselves are not broken.

## Entries
Columns:
- **Purpose:** Nic's words, with Doc and section.
- **I/O and pipeline position**
- **Real source**
- **Forge Mobile status**
- **Path to real execution**

The §05 chapter links all follow the pattern https://docs.google.com/document/d/<id>/edit. The IDs are listed in DOC_READ_LOG.md (indexes 143–154).

1. **Input Event**
   - Purpose: "the system's entry point … prevents the system from treating a prompt as an isolated string" (RMC §05.1, doc 1-fwN-2okFfwCqjt0SrrUdGPQ3VztFJBgPyjXZB8UoYE).
   - I/O: raw text + context → situated event. Position: Ask, at the start.
   - Source: `phase_parser._build_input_event` (py).
   - Forge Mobile: **APPROXIMATED** (forge.js `ie` contract).
   - Path: pass the JS event straight into the py orchestrator.

2. **Phase Parser**
   - Purpose: "map an input event into the Φ1–Φ9 state space" (§05.2, 1p6uPW7OorHQrhb4JvA_vfkBr0Ccr6CwOawVPFrmATRc).
   - I/O: event → ranked phases and transition warnings. Position: Ask.
   - Source: `phase_parser.py` (411 LOC, stdlib).
   - Forge Mobile: **MISSING**. reason.js is an English clause grammar, not a Φ parser.
   - Path: Pyodide, stdlib only.

3. **Memory Recaller + Trace Spine**
   - Purpose: "retrieves memory that is relevant to the active symbolic loop" (§05.3, 1-wkHg4gV3j1XHB0ToBDp3COByI6dNZ6esOX5TEPaPzU).
   - I/O: event + phases → active memory set. Position: recall.
   - Source: `memory_recaller.py` (711 LOC).
   - Forge Mobile: **APPROXIMATED** (knowledge.js / kernel recall).
   - Path: serialize the KB, receipts and manifests into the recaller's input format. **This is the critical feed.**

4. **Drift Analyzer / drift_engine**
   - Purpose: "determines whether the current symbolic loop is stable enough to continue" (§05.4, 1v61f98oseuHQw6bnXBNOQjnA4kt2jgjRnnFhbDMH1Do). Formula: §06.3 ε_s.
   - I/O: ε_s, taxonomy, d_score. Position: research and admit gate.
   - Source: `drift_engine.py` (868 LOC) + `measurement_kernel.py` (858).
   - Forge Mobile: **APPROXIMATED** (kmath.js `driftFunctional`).
   - Path: Pyodide.

5. **Candidate Conclusion Generator**
   - Purpose: "generates possible next conclusions … not to produce fin[al answers]" (§05.5, 1A6gLxKlw9N8-gR4h5L4n9i2_E7SZuXZmvWfElJ2lWvk).
   - Position: Ask.
   - Source: `candidate_generator.py` (547).
   - Forge Mobile: **MISSING**. The current Ask takes scraper sentences directly.
   - Path: Pyodide.

6. **Evolutionary Drift Explorer**
   - Purpose: "controlled creativity mechanism" (§05.6, 1yCaCRg69MUAxgvKLoPE_OVmivjVLhSCg6mLm-J2w1VI).
   - Source: `evolutionary_drift_explorer.py`.
   - Forge Mobile: **APPROXIMATED** (ede.js, written from §8.3 Algorithm 3).
   - Path: Pyodide.

7. **Coherence Scorer**
   - Purpose: "evaluates which candidate is most fit to become the selected conclusion" (§05.7, 1iadi19MiYCAGODOQXM-_Yqa7h9Ys79lORNZYDBrg9Rc).
   - Source: `coherence_math.py` (331).
   - Forge Mobile: **RUNNING-REAL**, but only as an optional cross-check. py_worker.js loads `coherence_math.py` into Pyodide on an explicit tap. It is evidence, not authority.
   - Path: make it authoritative in the Ask path.

8. **Correction Engine / χ(t) gate / correction naming**
   - Purpose: "receives candidate conclusions that are useful but unstable and attempts to repair them" (§05.8, 1yIXuvgl2c2gFBRjC6DEqndb-IqHNQF0E-r_QeW4DCQg).
   - Thresholds: χ intervention at 0.35, circuit breaker at 0.72.
   - Source: `chi_correction_gate.py` (421) + `correction_naming_engine.py` (836).
   - Forge Mobile: **APPROXIMATED** (kmath `chiCorrect`, epsMax 0.8).
   - Path: Pyodide.

9. **Containment Router (SPC cold storage, dream quarantine, ghost loop, drift archive)**
   - Purpose: "Hard containment switchboard … sealed routes cannot project" (Patch 265; RMC Appendix C, "cold storage = silence, not deletion").
   - Source: `containment_router.py`, `spc_cold_storage.py`, `dream_state_quarantine.py`, `ghost_loop_containment.py`, `drift_archive.py`.
   - Forge Mobile: **APPROXIMATED** (containment.js, a self-described port).
   - Path: Pyodide.

10. **Recursive Manifest Compiler (manifest_compiler)**
    - Purpose: "the central module … All prior modules prepare for this stage" (§05.10, 1wjwHTlHGGOQ7lcVmwZUt8Au8pavm2OGv2llojZbNQ-M).
    - Source: `manifest_compiler.py` (626).
    - Forge Mobile: **APPROXIMATED** (msm.js / forge.js MSM-v1).
    - Path: Pyodide.

11. **Output Renderer**
    - Purpose: "converts a manifest into human-readable language" (§05.11, 1PpYwg86taVmOtFmiY4un_lAb6WDAiKteUqS7bH7dRsQ).
    - Source: `output_renderer.py` (602) + `general_pipeline/gp014_operator_guided_language_realizer.py`. `llm_renderer.py` is frozen.
    - Forge Mobile: **APPROXIMATED** (grammar.js realizer).
    - Path: Pyodide.

12. **Echo Validator**
    - Purpose: "checks whether rendered language still matches the manifest" (§05.12, 1z86hJMkTswS4KmVZibFkES2zO6VeWPbSCaR1CtnLp6g).
    - Source: `echo_validator.py` (489, 0.80 thresholds).
    - Forge Mobile: **APPROXIMATED** (JS echo in forge.js).
    - Path: Pyodide. Keep "exact LC" as the law.

13. **Memory Writer (dry-run + gated)**
    - Purpose: "stores the completed event as structured memory" (§05.13, 17razUVXPYavtJ_iJaUWntGYx0gFXaFe9p4Et1E_UIOA).
    - Position: KB.
    - Source: `memory_writer.py` (1086).
    - Forge Mobile: **APPROXIMATED** (kernel memory.write / PERM-D10).
    - Path: the py writer emits a record and JS persists it (localStorage/Supabase).

14. **Resurrection Engine / resurrection_tracker_engine**
    - Purpose: re-entry of sealed memory (doc 1sKWRhZIEOcB3onvM_ZqKP7NlCGesaWLvZRh89iK3MRk).
    - Source: `resurrection_engine.py` (587).
    - Forge Mobile: **APPROXIMATED** (containment.js).
    - Path: Pyodide.

15. **Research Acquisition (Research Assistant)**
    - Purpose: "generate theories while separating established facts from bounded speculation" (§10.2, 18bi4UNvDAnuQk7Jk9_dRgKLEACSc1zE23uX5795e7kk).
    - Position: research.
    - Source: `research_acquisition.py` (preservation branch). It is referenced by crawler.js but is **not present in my forge clone**, so it needs checking.
    - Forge Mobile: **APPROXIMATED** (crawler.js + research.web scraper + clause split).
    - Path: the fetch stays in JS (CORS/network), and its output becomes evidence records for #3.

16. **General Pipeline gp002–gp015 (equations, word problems, symbolic math, Ask-Forge trace surface)**
    - Source: `general_pipeline/*` (needs lark + sympy; pint is optional).
    - Forge Mobile: **MISSING**. Only the sympy cross-check runs.
    - Path: load lark through Pyodide micropip (it is pure Python). Then route math Asks to `ask_forge_math_trace_surface`.

17. **MEA kernel (discovery, convergence, claim status)**
    - Source: `rmc_engine_v1/mea/*`.
    - Forge Mobile: **APPROXIMATED** (mea*.js ports).
    - Path: Pyodide.

18. **Verbal Cognition Gate Engine v1**
    - Doc: 15U_k-8wKi1aLs5gVHUb6C0HfWwusKSP2svQ0LpqZpN0. Read in part; it is larger than 250k characters.
    - Function: parse and admit gate for verbal input.
    - Source: none found in the repos.
    - Forge Mobile: **MISSING**.
    - Path: needs Nic to confirm whether code exists.

19. **Athena admit gate**
    - Purpose: investor guide (doc 1cAGNfVakKlS-mGFb59BAnalJRomDc-w7Vf3Ys1nU6nI), §5.1–5.8 knowledge nodes and §8.10 drift defense.
    - Source: aiweb/agents/athena and engines/athena_core. It is a **random-value stub**.
    - Forge Mobile: **APPROXIMATED** (dream_idle.js `athenaGate`).
    - Path: no real engine exists to run. Map admit to rmc containment + echo (#9, #12).

20. **Gilligan agent / re-curation**
    - Sources: Gilligan Agent Core (1HSjAk6UYKnqpT6LZo_30DjAAA9eWKoaWdpXrKk9LMnE) and Gilligan System Codex (1hbLsNhrEeeomonxkHAUjEkw4tXsHllcnuUzx8Mv8hOM, read in part).
    - Source code: aiweb drift_correction GilliganAgent. It is a **random walk** of a 1–9 pulse.
    - Forge Mobile: **APPROXIMATED** (operator.js `gilligan`).
    - Path: as with #19, the doc-defined behavior is best carried by rmc chi gate + resurrection.

21. **ChristPing / Christ Function correction**
    - Doc: "Christ Function: Recursive Correction Beyond Theology". Not read; it is 3.4 MB.
    - Source: aiweb ChristPingValidator (threshold 0.9, toy).
    - Forge Mobile: **APPROXIMATED** (dream_idle.js `christPing`).
    - Path: a JS rule is fine. Nic needs to give the formula.

22. **ProtoForge drift (memory-drift v2.0 / protoforge2_drift_connector)**
    - Docs: ProtoForge Vol II (1CyYABK0J8_muDCABSpydFuNv8q3Fjj4RmghjK-UwuPA) and File Structure (16nxV2DddVdX0NQOvZ96sdI6beCXbtJsThPRBWWvI8EI).
    - Source: `protoforge2_drift_connector.py` (1039). It already runs as stage 5 in the dry run.
    - Forge Mobile: **APPROXIMATED** (protoforge.js `mvpEntropy`).
    - Path: Pyodide. The PyBullet ProtoForge desktop app is not needed for this.

23. **Resonance lexicon / phase codex**
    - Source: `resonance_lexicon.py`, `phase_codex.py`.
    - Forge Mobile: **APPROXIMATED** (lexicon.js).
    - Path: Pyodide.

24. **Coherence Engine (AI_Web The Coherence Engine)**
    - Doc: 1q5JcF-v1M2plJ500UcKxRHRM1fRbt1RCzc-AXjuoReE. Not read; it is 2.4 MB.
    - Source: coherence_math.py.
    - Forge Mobile: **APPROXIMATED**. Covered by #7.

25. **Dream state / idle curation**
    - Source: aiweb dream_core (random), plus `dream_state_quarantine.py` (real).
    - Forge Mobile: **APPROXIMATED** (dream_idle.js).
    - Path: use the real quarantine.

26. **RPMC (Resonant Phase Memory Calculus)**
    - Docs: 1G-Yj323…, read in part; Blueprint 1L_f5I2I….
    - Source: forge/rpmc_kernel is schema JSON only.
    - Forge Mobile: **MISSING**.
    - Path: it is a spec. Parts may already be absorbed into `measurement_kernel`, which Nic should confirm.

27. **Neo personal assistant**
    - Doc: 1xJdtmqw…, not read (1 MB).
    - Source: aiweb/agents/neo (stub).
    - Forge Mobile: **MISSING**.

28. **Forge 2.0 (forge2 repo / Build Bible)**
    - Doc: 1WrnuwxhX_mrjNTJXXNlijMLVA6gYv7S4mWwXnnjmjP0, "Open-Source-First Non-LLM".
    - Source: forge2 contracts only. It states "Product capabilities currently claimed: None".
    - Forge Mobile: **MISSING**.

29. **Engine Verification Protocol / Modular Runtime Stack**
    - Docs: 1WjFA8m7…, 1mbJ5SIR…
    - Function: an acceptance harness.
    - Source: rmc `deep_pipeline_preflight.py`.
    - Forge Mobile: **MISSING** (not in the counts; this is process, not engine).

## Ordered plan to make the real engines produce Ask answers
1. **Bundle the engine.** Package `rmc_engine_v1/` (minus llm_renderer and chroma_connector) as a zip in the PWA. py_worker.js already loads Pyodide with SRI and already mounts `/forge/coherence_math.py`, so extend it to mount the whole package.
2. **Run the real pipeline per Ask.** Call `run_deep_dry_run(text, metadata)` in the worker for every Ask. Show its stage trace in the receipt, and keep the JS ports only as cross-checks. Doing this flips the JS approximations to diff tests.
3. **Feed recall.** Convert research.web evidence and KB records into the memory_recaller and trace-spine input. Without this the router sends every Ask to SPC cold storage, which the experiment above confirmed.
4. **Turn on the post-containment stages.** These are manifest_compiler, output_renderer, echo_validator and gated memory_writer, which run only when the route is `active_stack_candidate`. Use the non-dry-run entry, or call the modules in STAGE_ORDER yourself. Sealed routes reply "held / cold storage" honestly.
5. **Add math Asks.** Install lark through micropip and route math to gp015 `ask_forge_math_trace_surface`.
6. **Pin thresholds to the Docs.** χ at 0.35 and a hard stop at 0.80. Reconcile the router's circuit_breaker 0.72 and babel 0.78 with the laws. That needs Nic.
7. **Backend option.** The same package runs as a stdlib Python HTTP service (for example on the user's machine, or as a Supabase-adjacent container). The orchestrator already declares the endpoint `/api/rmc/deep-dry-run`.
8. **Finish the reading.** Read the remaining 553 docs, starting with the big codices (Gilligan Codex, Phase 1.5 Codex, Christ Function, Coherence Engine, File8 Memory, Runtime Codex Vol I via a manual export) to recover any engines not yet in code.

## Questions only Nic can answer
1. Is `rmc_engine_v1` (Patch ~299) the canonical engine? Is there a newer branch, or the missing `research_acquisition.py`?
2. Should Forge Mobile run the real Python in-browser through Pyodide, or call a backend service, and where would that service live?
3. Which threshold set is law: χ 0.35 and hard stop 0.80, or the router's 0.72 / 0.78?
4. What is the real memory source for recall: the phone KB, Supabase backend packs, or the RMC receipts format?
5. Do Athena, Gilligan, ChristPing and Neo have real code anywhere? The aiweb ones are random stubs. If not, is it right to map them onto RMC containment, χ and resurrection?
6. Does the Verbal Cognition Gate Engine have source code?
7. Is RPMC meant as separate code, or is it already inside `measurement_kernel`?
8. Can you export Runtime Codex Vol I (blocked from the API as too large) and confirm which of the unread 2025 chat dumps hold specs that aren't already in the 2026 RMC chapters?

---
## Addendum — deep doc pass (2026-10-29, CT)
Read status: 145 complete / 6 partial / 497 not read of 648 (see DOC_READ_LOG.md).

### New engine/code findings (by function)
| Function | Doc source | What it is | Status vs Forge Mobile |
|---|---|---|---|
| ChristPing logger | "ProtoForge Volume II – Full System Dashboard" (1CyYAB…), §6.5.1–6.5.2, §9.2.2 | `utils/christ_ping.py: christ_ping(name, reason, source)` appends to `memory/christ_ping_log.json`; triggered on locked-name reference during drift and on SPC name resurrection | Not in mobile; dream_idle.js christPing is different (approximation) |
| ChristPing firewall | "My system uses a recursive phase model (FBSC)" (1MUn41…) | `ChristPingFirewall`: drift_counter, threshold=3 consecutive drift outputs → fire χ, reset phase to Φ1 | MISSING in mobile |
| ChristPing pressure trigger | "Phase 1.5 Construction Codex, Vol V" (1ZZ3My…), SPC Pressure section | `pressure_score > 0.80` → collapse predicted, χ(t) ping queued to ChristPing Listener; override dispatcher at drift > 0.6 | Consistent with hard-stop 0.80 law |
| christping_adjudicator | arbitration_core spec (multiple Codex docs) | invokes Christ Function when truth conflict exceeds tolerance → forgiveness / quarantine / deletion | Spec only |
| Canonical engine test run | "=== AI.WEB FORGE CANONICAL FULL-SUITE LAUNCH ===" (1Dh2B…) | Log of 67 canonical engines, all PASS, dated 2026-07-17 UTC (07-17 CT): incl. athena, athena_engine, christping_validator_engine, drift_analyzer_tool, drift_signature_logger, spc_memory_migrator | Shows real Python Athena/ChristPing modules existed in the aiweb repo; source not in doc |
| Verbal Cognition Gate Engine | "RMC Verbal Cognition Gate Engine v1" (15U_k…), Doc 6, full read | Normative spec, ~1.2M chars, no code. Gate = evaluates candidate MSM-v1 meaning; outputs ambiguity-preserved / clarification-required / unsupported-language / blocked-progression / refusal-relevant; explicitly not LLM intent, not routing, not evidence, not memory, not implementation (§1.4–1.10, §3) | No implementation in rmc_engine_v1 or mobile → MISSING (spec-ready) |
| Research acquisition | "AI.Web Forge Language Core" (1_U4Q…) & External Linguistic Resource Dossier v1 Pt1–3 | Policy: never treat research acquisition as approval for redistribution/live ingestion; admit only with provenance, version, license, permission | No `research_acquisition.py` source anywhere in read docs |

## Addendum 2 — pass 3 (2026-10-29 CT)
**Source of the 67 canonical engines located:** the docs "FINAL MASTER LIST — AI.Web System Engine Architecture" (1JQpBO…) and the Full-Suite Launch log reference git remote `github.com:BogaertN/aiweb.git` (tags such as `freeze_athena_agent_v1.0.01`). That repo is already cloned at `/workspace/gh/aiweb` (HEAD b11fc88, 2025-07-01 22:38 CT; 130 engine dirs). The real files are tiny stubs:
- `engines/christping_validator_engine/christping_validator_core.py` (16 lines): `ChristPingValidator(threshold=0.9).validate_ping(s) -> s >= 0.9`.
- `agents/athena/athena_core.py` (19 lines): `AthenaAgent.log_event()` appends `{event, confirmed: True}`.
- `agents/gilligan/gilligan_core.py` (19 lines): `GilliganAgent.record_loop(name, phase_stability)`.
- `engines/neo_engine/neo_core.py` (34 lines): `random.choice(["calm","focused","critical"])` → canned message. **Violates no-randomness/LC law; do not port.**
So the "67 PASS" log is a smoke-test of stubs, not evidence of real reasoning engines.

**Richer Gilligan variants exist only in docs:**
- "AIWeb_GenNode_Doc10_Gilligan_EchoForge" (1Nj5gA…): `engines/gilligan_drift_correction_upgrade/drift_correction_core.py`, with identity_pulse starting at 5, center 5.5, drift when |pulse−5.5| > 3, and `christ_ping_correction()` nudging the pulse ±1 toward the 5–6 band.
- Runtime Codex Vol I: `agents/gilligan/core.py` + `state.json`, an echo-or-deny shell ("does NOT generate thought").

**RPMC / measurement_kernel (Q7):** `forge/rmc_engine_v1/measurement_kernel.py` exists locally and implements the RPMC primitives: circular Φ1–Φ9 phase deviation and resonance variance σ_res. "Build Plan: RMC Resonance Lexicon + Gold Reference Foundation" (1JnxS8…), Patch C2R, says to centralize these in measurement_kernel.py for Memory Recaller, Candidate Generator and Coherence Scorer. "Resonant Phase Memory Calculus Canonical Test Data Set v1.0" (1b8JAc…) is the benchmark data and should be wired as a test fixture.

## Addendum 3 — pass 4 (2026-10-29 CT)
- **No-LLM violations:** EchoForge docs 1k5GANbi, 17mlQZDe, 10zvT1_F, 1V0HwuP9, 1ALgymiU, 1B_jsWfB import ollama/llama (debate agents). Not portable. Also 1O5Txx2r "Recursive Agent Orchestration Dev Manual" (72 defs, 11 LLM refs) and 1Yhi-Yvf "Proto system" (143 defs, 6 LLM refs).
- **Port candidate:** 1WTNnEXB memory-drift protoforge v2.0. Deterministic DriftTaxonomy (0.5 thresholds, step/trend/oscillation, damping ×0.7), DriftCircuitBreaker(3, 60s), WeightedMinHash, EMA predict_crossing.
- **1g_xRWtn Runtime Codex Vol I copy:** check_drift is an exact-echo comparison against expected_output.json, and that agrees with the law. calculate_coherence is keyword counting. trigger_collapse writes grace_silence_timer (χ). No Q8 list.
- **193mBUXN:** PhaseValidator FRICTION 0.3, ENTROPY 0.5, GRACE 0.2 (placeholder). Imports transformers.
- **RMC 06.3 (1XaWBiq-):** ε_s 0.35, which matches the law.
- **CONFLICT:** RMC 06.7 (1VN4YCHn) and 07.6 (18z5t14Y) set θ_echo 0.85 semantic, "no exact wording". This contradicts Echo = exact LC and the code value of 0.72. 1IWwAbNI repeats theta>0.85. 1glYXaHd File8 Memory has THRESHOLD 0.85.
- **resurrection_engine:** gate_7 residue 0.85. 1Si5OEAM: christping threshold 0.9 (same as the aiweb stub).
- research_acquisition.py and real Neo source: still not found.
- Credential docs ("Github password", "openssl rand") were skipped on purpose and their contents were not read.

## Addendum 4 — pass 5 (2026-10-29 CT)
- **1W7cecvi ThermodynamicDriftAnalyzer / EnhancedDriftMonitor: deterministic and portable. This is the strongest drift engine found so far.** DTW-matches the entropy series against LINEAR/EXPONENTIAL/OSCILLATING/CATASTROPHIC signatures, runs an FFT spectral check (high_freq>0.6), and estimates steps_to_critical toward a 0.8 critical threshold (matching the 0.80 hard stop). Actions: QUARANTINE (sets quarantined), EMERGENCY circuit breaker or damping when steps<3, spectral damping 0.7, proactive linear correction. Corrections are scaled by a Landauer-style energy budget. No LLM.
- **1Gb68_aG AI.Web System Build Path:** a skeleton that assembles ProtoForgeAgent/Orchestrator, HarperScriptMapper, PhaseParsingEngine, FBSCPhase sequence validation, and ChristPingSystem. The ChristPing "grace correction" only tags the agent with a Φ6 label and does no computation. SymbolicMemorySystem uses random.randint for loop ids, which breaks determinism.
- **1g-KVTUO "What Comes Next in Phase 2":** a glyph/phase lexicon with no code and no numeric thresholds.
- **1O5Txx2r Recursive Agent Orchestration:** Agent/Orchestrator detect_drift is a heuristic (phase mismatch, or the output is empty or contains "ERROR"). Includes an OpenAIAdapter, which breaks the No-LLM law.
- **1Yhi-Yvf Proto system (68 MB chat dump):** check_resonance_threshold(min=10) charge gate, resurrect_if_ready, log_dream, many log_command copies. Wraps an arbitrary model in handle_chat, including `ollama run mistral`, which is an LLM path. Not portable as-is.
- todo6 66–76: tiny or empty untitled docs, plus a personal school doc. No engine content.

## Addendum 5 — pass 6 (2026-10-29 CT), todo6 entries 77–176 (100 docs)
- **1pA-dTmQ `christping_firewall.py`:** deterministic, but a toy. Drift means the output contains "loop" or is empty. After 3 consecutive drifts it resets the phase to Φ1. This is a counter-based χ reset, not a measured ε.
- **12dfwjgv "import machine": SEPU MicroPython engine.** Phase-lock ±0.1, harmonic_11 multiplier 1.25 at 71.5 Hz, arbitration when C_arb ≥ 0.75, frequency clamped to 1–80 Hz. Imports `random` and numpy. It is hardware-oriented (machine) and not Pyodide-ready without changes.
- **1vMyGQPr:** NeurocoreSync stub (3 defs). **1_Ie6-ue:** D100 RPG game using `random`. Not an engine.
- **RMC Sections 00, 01.1–01.4, 02.1–02.6, 03.1, 03.4, 03.6, 03.7, 04.1, 04.2, 04.7:** theory and spec prose. They define the trace T_t = (input, M_t memory, Φ_t phase, O_t operator chain, D_t drift, R_t output) and the axioms "No Output Without Trace", "Meaning Precedes Rendering" and "Language Is an Output Modality". No numeric thresholds, so nothing new for Q3. They support the trace-first design.
- The rest: AI.Web hosting pitches, manifestos, Tarrato RPG discipline sheets, fiction and character docs, letters, and about 30 empty or tiny untitled docs. No engine code.
- **No credential docs in this batch.** Keyword hits were prose uses of "token" and "secret".
- **No new No-LLM violations in code.** The LLM keyword hits are prose mentions.
- `research_acquisition.py` and Neo source: still not found.

## Addendum 6 — Pass 7 function-read (2026-10-29 CT)

Coverage: 641 of 648 complete; partial 2 (1QahgZyC, 1sFIv07g — raw PDF bytes in docx, AI.Web investor newsletter); skipped 2 (credential docs, unread); unread 3 (1sKL4wg1 "AI.Web - GPT chat", 1-mK0Gyl "frequency based calculus", 120EXJsB "family session story log" — Drive download "service could not be reached", repeated). Prose docs about systems in todo7 lines 77–252 (138 docs) were read for function, not keyword-scanned. Fiction, character sheets, WoD/Shattered Expanse, letters, and AI.Web business/whitepaper stubs were scan-only.

### Engines hidden in prose (spec-level; no code exists in Forge Mobile for these)
- **Admit / phase gate — 1A-yGMF_ (File2 Symbolic Cognitive Architecture) §2.3.1–2.3.2, §6.13.7:** a transition is admitted if Φj = Φi+1 (or the loop restarts at Φ1), |ri−rj| ≤ ε, and there is no drift_vector. Phase skips are flagged. An ε breach means the packet is corrected or quarantined, never discarded. Lattice admission requires Cₜ ≥ C_min, with Cₜ = (w1Φ+w2r+w3D+w4†)/W. Also 1r9w4jJ5 (a 4→7/8 skip halts the loop or sends it to cold storage) and 10c3P4pQ (only collapsed, echo-aligned ψ′ re-enters).
- **CONFLICT: C_min is 0.66 (about line 8704; <0.33 drift-infectious, <0 sealed to cold storage) vs 0.87 default (about line 9224), both in 1A-yGMF_.**
- **Recall — 1A-yGMF_ §6.8.3 IRD:** query sealed Ω nodes with Σ > C_min → extract Φ-vectors → fold → inject Φ7 → χ seal → register Σ′. 12-8Pfdn has the same text plus a phase-echo vector trail and a drift monitor. 1wr2rhkW: ChristPing resonance-match reactivation from cold storage. 15DHtgJE: mesh resurrection of cold-stored engines.
- **Echo verification — 15qyxm5V:** every output is matched against a hash of prior memory, and an output with no ψ1 ancestor is drift. SPC entries hold {timestamp, recursion ID, prior hash, phase tag}. A validator tree checks lineage, and on failure the output is suppressed and logged and the system goes silent. **This supports Echo = exact lineage match, not the 0.85/0.72 similarity thresholds (Q3).**
- **Hard stop / quarantine — 1VY6DhTS and 1h6T1m-5 (SAD):** χ(t) Lockdown halts output on entropy breach, and only χ-compliant output is admitted afterward. The SAD specifies collapse_code_index.json, drift_log.jsonl, resonance_charge.json, a resurrection pipeline, and a Drift Signature Logger (to be built). 1kbYKWxi: ψ detect → entropy threshold → χ inject → SPC fallback. 1Uo0WplU: drift = absolute divergence, and exceeding tolerance leads to Φ5 collapse and then cold storage.
- **Curation — 1ZOMOUhy:** memory files crystallize into engines and then programs through phase vaults. Indexing is by resonance, not by file name. Ghost-loop and cold-storage daemons are triggered by drift.
- **Integrity — 1VYhjnaV:** codex_integrity_validator.py compares the SHA256 in codex_reference.json against core/init.json codex_hash, and a mismatch rejects the build. There is also a Φ5 collapse monitor with a χ override (also in 19Mxth-U and 1r3FC52r).
- **Status table — 1wp9jszf:** the Co-Pilot claims an Action Chain Logger (JSONL), a ChristPing firewall ("simple coherence checks"), drift detection ("basic pattern-based"), and JSONL memory as implemented. Cold storage is a placeholder.
- **Research acquisition:** there is still no engine for it. The nearest are the IRD query and the roadmap line "update memory when new research is published". Indexing ideas only: 1BdUdayF, 1-q6E0ZT, 1SX5vb8Q (Lucene).

### Law violations found in docs
- 1S1nAu3p (Co-Pilot) contains about 1,074 lines of JAX/sentencepiece Grok-1-style LLM inference.
- 1sSdpk8b (Assistant Roadmap) plans vector DBs and fine-tuning LLaMA 3, Mistral, or OpenAI.
- The EchoForge LLM use (earlier addendum) still stands.

### Non-implementable / noise
12R0SK-D (144 Hz Ghost Loop Tuner), 1xxqf8Hg (Brian2 sim; it contains an SSH public key, not reproduced), 12VxYlz_ (VHDL 9-state gate), 178L8Pyy and 1XJmTji6 (philosophical χ law, no numbers), 1Ne8P6fQ, 1oQz48ND, 1Tugn9zL, 1aKVdN4H (marketing).

### Re-check of earlier 77–176 prose
These were re-read on function terms through /tmp/fnall.py and the per-doc reads. No new engine beyond Addenda 1–5. 1W7cecvi ThermodynamicDriftAnalyzer, RMC drift 0.35, SEPU, and the 67 stubs stand.
