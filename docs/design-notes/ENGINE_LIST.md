# ENGINE_LIST — every engine, module and mechanism
Written 2026-10-29 CT. Sources: ENGINE_AUDIT.md (all addenda), DOC_READ_LOG.md, /workspace/txt, gh/forge (rmc_engine_v1 + language core), gh/aiweb (130 entries = 125 engine folders + 5 loose files, merged into one row per base engine with frozen copies listed), gh/forge2, forge-mobile-4172 (4.9.173).
Total rows: 259. APPROXIMATED: 89, KEEP-AS-FUNCTION: 13, MISSING: 156, RUNNING-REAL: 1
Status key: RUNNING-REAL = the real code runs in Forge Mobile. APPROXIMATED = a JS port or stand-in. MISSING = not in Forge Mobile. KEEP-AS-FUNCTION = LLM-based item, kept for its function, with the language core replacing the LLM (Nic, 2026-10-29). Doc links: https://docs.google.com/document/d/<id>.


## input/parse
| Name | AKA | Does | Source | Code | Mobile |
|---|---|---|---|---|---|
| EchoForge StoicClarifier | LLM-based | clarification request/response, common ground, computation request; language core replaces the LLM | doc 17mlQZDe | yes (in doc) | KEEP-AS-FUNCTION |
| aiweb.phase_engine | phase_engine_frozen_v1 | STUB: phase state machine, next phase | aiweb/engines/phase_engine/ | stub | MISSING |
| candidate_meaning_construction | Language Core (doc 15U_k…) | builds candidate meanings | forge/aiweb_language_core_bootstrap/candidate_meaning_construction/ | yes | MISSING |
| forge2.canonical | Forge 2.0 contract | immutable canonical contract | forge2/src/forge2/contracts/canonical.py | yes (contracts) | APPROXIMATED |
| forge2.capability_requirement | Forge 2.0 contract | immutable capability requirement contract | forge2/src/forge2/contracts/capability_requirement.py | yes (contracts) | APPROXIMATED |
| forge2.classification_candidate | Forge 2.0 contract | immutable classification candidate contract | forge2/src/forge2/contracts/classification_candidate.py | yes (contracts) | APPROXIMATED |
| forge2.codec | Forge 2.0 contract | immutable codec contract | forge2/src/forge2/contracts/codec.py | yes (contracts) | MISSING |
| forge2.context_manifest | Forge 2.0 contract | immutable context manifest contract | forge2/src/forge2/contracts/context_manifest.py | yes (contracts) | APPROXIMATED |
| forge2.frozen_value | Forge 2.0 contract | immutable frozen value contract | forge2/src/forge2/contracts/frozen_value.py | yes (contracts) | MISSING |
| forge2.identity | Forge 2.0 contract | immutable identity contract | forge2/src/forge2/contracts/identity.py | yes (contracts) | APPROXIMATED |
| forge2.input_event | Forge 2.0 contract | immutable input event contract | forge2/src/forge2/contracts/input_event.py | yes (contracts) | APPROXIMATED |
| forge2.request_contract | Forge 2.0 contract | immutable request contract contract | forge2/src/forge2/contracts/request_contract.py | yes (contracts) | APPROXIMATED |
| forge2.request_state | Forge 2.0 contract | immutable request state contract | forge2/src/forge2/contracts/request_state.py | yes (contracts) | APPROXIMATED |
| forge2.successor | Forge 2.0 contract | immutable successor contract | forge2/src/forge2/contracts/successor.py | yes (contracts) | APPROXIMATED |
| forge_language_bridge v1–v5 | language bridge | interprets text into MSM | forge/forge_language_bridge_v1…v5/ | yes | APPROXIMATED |
| gp.quantity_ast | General Pipeline | GP-011B — Pint-bound typed quantity AST for governed capacity reasoning. | forge/rmc_engine_v1/general_pipeline/quantity_ast.py | yes | MISSING |
| gp.source_compiler | General Pipeline | General Learning-to-Answer Pipeline — source compiler (Build GP-004). | forge/rmc_engine_v1/general_pipeline/source_compiler.py | yes | MISSING |
| gp.symbolic_math_ast | General Pipeline | MATH-001R1 / GP-012R1 — Typed symbolic mathematics manifest and safe AST boundar | forge/rmc_engine_v1/general_pipeline/symbolic_math_ast.py | yes | MISSING |
| gp.symbolic_math_language_compiler | General Pipeline | NL-MATH-001 / GP-013 — bounded natural-language symbolic mathematics compiler. | forge/rmc_engine_v1/general_pipeline/symbolic_math_language_compiler.py | yes | MISSING |
| gp.typed_ast | General Pipeline | GP-010B-R1 — Lark-backed strict typed AST for governed linear equations. | forge/rmc_engine_v1/general_pipeline/typed_ast.py | yes | MISSING |
| lexicon_audit |  | lexicon coverage report | forge/rmc_engine_v1/lexicon_audit.py | yes | MISSING |
| mea.fbsc_operator_crosswalk | MEA kernel | FBSC → operator crosswalk | forge/rmc_engine_v1/mea/fbsc_operator_crosswalk.py | yes | MISSING |
| meaning_structure_manifest | Language Core (doc 15U_k…) | MSM-v1 meaning manifest; mobile: forge_spine.js port | forge/aiweb_language_core_bootstrap/meaning_structure_manifest/ | yes | APPROXIMATED |
| outward_expression_runtime | Language Core (doc 15U_k…) | outward expression boundary | forge/aiweb_language_core_bootstrap/outward_expression_runtime/ | yes | MISSING |
| phase_codex | FBSC Phase Glyph Codex v2.5 | read-only phase/glyph table; mobile: lexicon.js | forge/rmc_engine_v1/phase_codex.py | yes | APPROXIMATED |
| phase_parser | Phase Parser, Input Event (§05.1–05.2) | maps an input event to ranked Φ1–Φ9 phases; mobile: reason.js is an English grammar, not a Φ parser | forge/rmc_engine_v1/phase_parser.py | yes | MISSING |
| predicate_role_frame_registry | Language Core (doc 15U_k…) | predicate/role frames | forge/aiweb_language_core_bootstrap/predicate_role_frame_registry/ | yes | MISSING |
| resonance_lexicon | Resonance Lexicon | English words → phase/operator resonance events; mobile: lexicon.js | forge/rmc_engine_v1/resonance_lexicon.py | yes | APPROXIMATED |
| symbolic_grammar_operator_registry | Language Core (doc 15U_k…) | grammar operator registry | forge/aiweb_language_core_bootstrap/symbolic_grammar_operator_registry/ | yes | MISSING |

## research
| Name | AKA | Does | Source | Code | Mobile |
|---|---|---|---|---|---|
| AI-search hybrid indexing | Lucene idea | hybrid search index (idea only) | doc 1BdUdayF; 1-q6E0ZT; 1SX5vb8Q | no | MISSING |
| EchoForge ToolManager/ResonanceMap | LLM-based | register/call tools, build graph, rephrase, log audit; language core replaces the LLM | doc 1V0HwuP9 | yes (in doc) | KEEP-AS-FUNCTION |
| EchoForge fact_check + metrics | LLM-based | fact_check, shortest path, streaks, weekly report; language core replaces the LLM | doc 1ALgymiU | yes (in doc) | KEEP-AS-FUNCTION |
| IRD recall/research query | Ω-node query | query sealed Ω (Σ>C_min) → Φ-vectors → fold → Φ7 → χ seal → Σ′ | doc 1A-yGMF_ §6.8.3; 12-8Pfdn | no | MISSING |
| aiweb.external_feed_listener | external_feed_listener_frozen_v1-0.01 | STUB: receives external feeds | aiweb/engines/external_feed_listener/ | stub | MISSING |
| aiweb.field_resonance_mapper | field_resonance_mapper_frozen_v1-0.01 | STUB: external field feed adapter | aiweb/engines/field_resonance_mapper/ | stub | MISSING |
| mea.discovery_kernel | MEA kernel | discovery kernel boundary; mobile: mea*.js port | forge/rmc_engine_v1/mea/discovery_kernel.py | yes | APPROXIMATED |
| research_acquisition | Research Assistant (§10.2) | fetch + separate fact from speculation; no engine exists; mobile: crawler.js + research.web | doc crawler.js header; 18bi4UNv §10.2 | no (py missing) | APPROXIMATED |

## recall/memory
| Name | AKA | Does | Source | Code | Mobile |
|---|---|---|---|---|---|
| Assistant Roadmap recall | LLM-based | vector DB recall (Pinecone/Chroma/FAISS), fine-tune; memory update on new research; language core replaces the LLM | doc 1sSdpk8b | yes (in doc) | KEEP-AS-FUNCTION |
| EchoForge Journal | LLM-based | JournalingAssistant, EncryptedDB, session start, voice transcription; language core replaces the LLM | doc 10zvT1_F | yes (in doc) | KEEP-AS-FUNCTION |
| Proto system | LLM-based | check_resonance_threshold(10), resurrect_if_ready, log_dream, archive_session, drift_score, calculate_coherence; language core replaces the LLM | doc 1Yhi-Yvf | yes (in doc) | KEEP-AS-FUNCTION |
| active_loop_state | Active Loop State | holds the current loop state | forge/rmc_engine_v1/active_loop_state.py | yes | MISSING |
| aiweb.fluid_memory_engine | fluid_memory_engine_frozen_v1 | STUB: captures memory trace (random) | aiweb/engines/fluid_memory_engine/ | stub | MISSING |
| aiweb.memory_stack_engine | memory_stack_engine_frozen_v1 | STUB: JSON memory stack, Fibonacci alignment | aiweb/engines/memory_stack_engine/ | stub | MISSING |
| aiweb.memory_stack_engine_breathing_v1 | memory_stack_engine_breathing_v1_frozen_v1-0.01, memory_stack_engine_breathing_v1_frozen_v1-0.02 | STUB: breathing memory stack | aiweb/engines/memory_stack_engine_breathing_v1/ | stub | MISSING |
| aiweb.recursive_field_engine | recursive_field_engine_frozen_v1, recursive_field_engine_frozen_v1-0.01 | STUB: injects values into a field state | aiweb/engines/recursive_field_engine/ | stub | MISSING |
| chroma_connector | (frozen) | vector DB recall, frozen fail-closed. Function: similarity recall; mobile: knowledge.js recall takes the role | forge/rmc_engine_v1/chroma_connector.py | yes | KEEP-AS-FUNCTION |
| mea.controlled_manifest_memory_writer | MEA kernel | writes a sealed hypothesis to JSONL; mobile: mea*.js port | forge/rmc_engine_v1/mea/controlled_manifest_memory_writer.py | yes | APPROXIMATED |
| mea.live_candidates | MEA kernel | scored previews from persisted M_t | forge/rmc_engine_v1/mea/live_candidates.py | yes | MISSING |
| mea.live_term_binding | MEA kernel | verifies hash-chained JSONL ancestry | forge/rmc_engine_v1/mea/live_term_binding.py | yes | MISSING |
| mea.manifest_memory_writer | MEA kernel | writer status surface | forge/rmc_engine_v1/mea/manifest_memory_writer.py | yes | MISSING |
| mea.problem_manifest_store | MEA kernel | Forge-owned manifest store | forge/rmc_engine_v1/mea/problem_manifest_store.py | yes | MISSING |
| mea.seal_transaction_commit | MEA kernel | writes immutable artifact | forge/rmc_engine_v1/mea/seal_transaction_commit.py | yes | MISSING |
| memory_recaller | Memory Recaller + Trace Spine (§05.3) | pulls memory relevant to the active loop; mobile: knowledge.js / kernel recall; nothing feeds it | forge/rmc_engine_v1/memory_recaller.py | yes | APPROXIMATED |
| memory_writer | Memory Writer / W_t (§05.13) | stores a finished event as gated memory; mobile: kernel memory.write | forge/rmc_engine_v1/memory_writer.py | yes | APPROXIMATED |

## admit/coherence
| Name | AKA | Does | Source | Code | Mobile |
|---|---|---|---|---|---|
| Athena admit gate (spec) | Athena §5.1–5.8, §8.10 | knowledge nodes + drift defense; mobile: dream_idle athenaGate | doc 1cAGNfVa | stub only | APPROXIMATED |
| Coherence Integrity Test |  | criteria for real operators | doc 1DuEHogN | no | MISSING |
| Lattice Admission | Cₜ gate | admit only if Cₜ≥C_min (0.66 vs 0.87 CONFLICT) | doc 1A-yGMF_ §6.13.2/§6.13.7 | no | MISSING |
| Phase-skip enforcement |  | a 4→7/8 jump means halt or cold storage | doc 1r9w4jJ5 | no | MISSING |
| Phase-transition admit | §2.3.1 | admit if Φ+1 or restart, /Δr/≤ε, no drift; skips flagged | doc 1A-yGMF_ §2.3.1–2.3.2 | no | MISSING |
| Verbal Cognition Gate (spec) | VCG v1 | evaluates MSM meaning → ambiguity/clarify/block/refuse; mobile: forge_spine.js | doc 15U_k-8w §1.4–3 | yes (language core) | APPROXIMATED |
| aiweb.agent.athena | athena_frozen_v1.0.01 | STUB: AthenaAgent.log_event (confirmed:True); mobile: dream_idle athenaGate | aiweb/agents/athena/ | stub | APPROXIMATED |
| aiweb.athena_engine | athena_engine_frozen_v1 | STUB: self-introspection log (random); mobile: dream_idle athenaGate | aiweb/engines/athena_engine/ | stub | APPROXIMATED |
| aiweb.goal_injection_engine | goal_injection_engine_frozen_v1 | STUB: injects symbolic goal (random) | aiweb/engines/goal_injection_engine/ | stub | MISSING |
| aiweb.symbolic_policy_engine | symbolic_policy_engine_frozen_v1 | STUB: enforces symbolic policies | aiweb/engines/symbolic_policy_engine/ | stub | MISSING |
| aiweb.tier_enforcer | tier_enforcer_frozen_v1 | STUB: classifies output tier, logs violations | aiweb/engines/tier_enforcer/ | stub | MISSING |
| candidate_generator | Candidate Conclusion Generator (§05.5) | proposes possible next conclusions; mobile: Ask uses scraper sentences instead | forge/rmc_engine_v1/candidate_generator.py | yes | MISSING |
| christping_adjudicator | arbitration_core | truth conflict → forgive/quarantine/delete | doc Codex docs | no | MISSING |
| coherence_math | Coherence Scorer, Coherence Engine (§05.7) | scores which candidate is most fit; mobile: Pyodide cross-check on tap only | forge/rmc_engine_v1/coherence_math.py | yes | RUNNING-REAL |
| evolutionary_drift_explorer | EDE + Coherence Scorer v2 (§05.6) | controlled, drift-bounded creativity; mobile: ede.js | forge/rmc_engine_v1/evolutionary_drift_explorer.py | yes | APPROXIMATED |
| gp.governed_gate | General Pipeline | General Learning-to-Answer Pipeline — governed solution gate (Build GP-001). | forge/rmc_engine_v1/general_pipeline/governed_gate.py | yes | MISSING |
| mea.candidate_generator | MEA kernel | MEA candidate generator; mobile: mea*.js port | forge/rmc_engine_v1/mea/candidate_generator.py | yes | APPROXIMATED |
| mea.candidate_set_gate | MEA kernel | non-mutating candidate set gate; mobile: mea*.js port | forge/rmc_engine_v1/mea/candidate_set_gate.py | yes | APPROXIMATED |
| mea.claim_status_classifier | MEA kernel | assigns structural ClaimStatus; mobile: mea*.js port | forge/rmc_engine_v1/mea/claim_status_classifier.py | yes | APPROXIMATED |
| mea.coherence_extension | MEA kernel | scores a generated candidate; mobile: mea*.js port | forge/rmc_engine_v1/mea/coherence_extension.py | yes | APPROXIMATED |
| mea.convergence_scorer | MEA kernel | Ω(c_i) vs. success conditions; mobile: mea*.js port | forge/rmc_engine_v1/mea/convergence_scorer.py | yes | APPROXIMATED |
| mea.evidence_tier_contract | MEA kernel | 144 Hz hypothesis evidence tiers; mobile: mea*.js port | forge/rmc_engine_v1/mea/evidence_tier_contract.py | yes | APPROXIMATED |
| mea.gate_engine | MEA kernel | MEA hard gates; mobile: mea*.js port | forge/rmc_engine_v1/mea/gate_engine.py | yes | APPROXIMATED |
| mea.goal_ancestry_scorer | MEA kernel | A(c_i) root-goal retention; mobile: mea*.js port | forge/rmc_engine_v1/mea/goal_ancestry_scorer.py | yes | APPROXIMATED |
| mea.hard_gate_report | MEA kernel | hard-gate report; mobile: mea*.js port | forge/rmc_engine_v1/mea/hard_gate_report.py | yes | APPROXIMATED |
| mea.information_gain_scorer | MEA kernel | I(c_i)=ΔK+ΔQ+ΔX; mobile: mea*.js port | forge/rmc_engine_v1/mea/information_gain_scorer.py | yes | APPROXIMATED |
| mea.manifest_advance_preview | MEA kernel | previews manifest advance | forge/rmc_engine_v1/mea/manifest_advance_preview.py | yes | MISSING |
| mea.manifest_schema | MEA kernel | epistemic status schema; mobile: mea*.js port | forge/rmc_engine_v1/mea/manifest_schema.py | yes | APPROXIMATED |
| mea.measured_seal_gate | MEA kernel | measured seal gate; mobile: mea*.js port | forge/rmc_engine_v1/mea/measured_seal_gate.py | yes | APPROXIMATED |
| mea.operator_cost_scorer | MEA kernel | K(c_i) operator cost; mobile: mea*.js port | forge/rmc_engine_v1/mea/operator_cost_scorer.py | yes | APPROXIMATED |
| mea.operator_engine | MEA kernel | runs O_gen → draft d_i; mobile: mea*.js port | forge/rmc_engine_v1/mea/operator_engine.py | yes | APPROXIMATED |
| mea.proof_debt_scorer | MEA kernel | E(c_i) evidence support; mobile: mea*.js port | forge/rmc_engine_v1/mea/proof_debt_scorer.py | yes | APPROXIMATED |
| mea.seal_candidate_gate | MEA kernel | candidate audit chain; mobile: mea*.js port | forge/rmc_engine_v1/mea/seal_candidate_gate.py | yes | APPROXIMATED |
| mea.seal_engine | MEA kernel | dry-run seal; keeps unknowns visible; mobile: mea*.js port | forge/rmc_engine_v1/mea/seal_engine.py | yes | APPROXIMATED |
| mea.seal_packet_audit_chain | MEA kernel | seal packet audit chain | forge/rmc_engine_v1/mea/seal_packet_audit_chain.py | yes | MISSING |
| mea.seal_packet_preview | MEA kernel | seal packet preview | forge/rmc_engine_v1/mea/seal_packet_preview.py | yes | MISSING |
| mea.seal_readiness | MEA kernel | seal readiness check | forge/rmc_engine_v1/mea/seal_readiness.py | yes | MISSING |
| mea.seal_transaction_preflight | MEA kernel | recompiles preflight | forge/rmc_engine_v1/mea/seal_transaction_preflight.py | yes | MISSING |
| mea.seed_manifest_gate | MEA kernel | seed manifest gate | forge/rmc_engine_v1/mea/seed_manifest_gate.py | yes | MISSING |
| mea.unknown_detector | MEA kernel | finds unresolved unknowns; mobile: mea*.js port | forge/rmc_engine_v1/mea/unknown_detector.py | yes | APPROXIMATED |
| selected_meaning_runtime | Language Core (doc 15U_k…) | selected-meaning eligibility; mobile: forge_spine.js port | forge/aiweb_language_core_bootstrap/selected_meaning_runtime/ | yes | APPROXIMATED |
| verbal_cognition_gate_runtime | Language Core (doc 15U_k…) | Verbal Cognition Gate: congruity, connectedness, expectancy, recoverable-purpose gates + composition; mobile: forge_spine.js port | forge/aiweb_language_core_bootstrap/verbal_cognition_gate_runtime/ | yes | APPROXIMATED |
| ψ′ re-entry rule | Breath and Recursion | only collapsed, echo-aligned ψ′ re-enters | doc 10c3P4pQ | no | MISSING |

## drift/χ/ChristPing
| Name | AKA | Does | Source | Code | Mobile |
|---|---|---|---|---|---|
| Absolute-divergence drift | Russell | beyond tolerance → Φ5 collapse → cold storage | doc 1Uo0WplU | no | MISSING |
| ChristPing logger | christ_ping.py | logs locked-name references during drift | doc 1CyYABK0 §6.5, §9.2.2 | yes (in doc) | MISSING |
| ChristPing pressure trigger | SPC pressure | pressure>0.80 → χ ping; override at drift>0.6 | doc 1ZZ3My… Vol V | no | MISSING |
| ChristPingFirewall | christping_firewall.py | 3 drifts in a row → χ, reset to Φ1 | doc 1MUn41…; 1pA-dTmQ | yes (toy) | MISSING |
| Drift Signature Logger (spec) |  | to be built; logs drift signatures | doc 1VY6DhTS | no | MISSING |
| Drift containment pipeline | AI blah | ψ detect → entropy threshold → χ → SPC | doc 1kbYKWxi | no | MISSING |
| DriftTaxonomy + DriftCircuitBreaker | memory-drift v2.0 | step/trend/oscillation, breaker (3, 60 s), MinHash, EMA; mobile: protoforge.js | doc 1WTNnEXB | yes (in doc) | APPROXIMATED |
| Gilligan drift correction (doc) | Doc10 EchoForge | pulse 5.5±3; χ nudges pulse toward 5–6; mobile: operator.js | doc 1Nj5gA… | yes (in doc) | APPROXIMATED |
| Harmonic App / PhaseValidator | LLM-based | ChristPingEngine, ColdStorageManager, GhostLoop, FBSCPhaseEngine, SPC_process (imports transformers); language core replaces the LLM | doc 193mBUXN | yes (in doc) | KEEP-AS-FUNCTION |
| PhaseValidator | FRICTION .3/ENTROPY .5/GRACE .2 | validates phase (placeholder) | doc 193mBUXN | yes (in doc) | MISSING |
| Recursive Agent Orchestration | LLM-based | DriftDetector, SPCManager, ManifestLogger, PhaseKeyManager, Web/Math/EEG adapters, merge/hibernate; language core replaces the LLM | doc 1O5Txx2r | yes (in doc) | KEEP-AS-FUNCTION |
| SEPU | import machine | phase lock ±0.1, arbitration C≥0.75 | doc 12dfwjgv | yes (MicroPython) | MISSING |
| ThermodynamicDriftAnalyzer | EnhancedDriftMonitor | DTW signatures, FFT, steps-to-0.8, quarantine; mobile: mobile has thermodynamic_drift.py ref | doc 1W7cecvi | yes (in doc) | APPROXIMATED |
| aiweb.agent.gilligan | gilligan_frozen_v1.0.01 | STUB: GilliganAgent.record_loop; mobile: operator.js gilligan | aiweb/agents/gilligan/ | stub | APPROXIMATED |
| aiweb.christping_listener | christping_listener_frozen_v1 | STUB: listens for simulated entropy (random); mobile: dream_idle christPing | aiweb/engines/christping_listener/ | stub | APPROXIMATED |
| aiweb.christping_validator_engine | christping_validator_engine_frozen_v1-0.01 | STUB: ping ≥0.9 passes; harmonics calibrator; mobile: dream_idle christPing | aiweb/engines/christping_validator_engine/ | stub | APPROXIMATED |
| aiweb.collapse_prevention_engine | collapse_prevention_engine_frozen_v1-0.01 | STUB: stability record → needs intervention | aiweb/engines/collapse_prevention_engine/ | stub | MISSING |
| aiweb.drift_analyzer_tool | drift_analyzer_tool_frozen_v1-0.01 | STUB: basic drift analyzer; mobile: kmath | aiweb/engines/drift_analyzer_tool/ | stub | APPROXIMATED |
| aiweb.drift_arbitration_engine | drift_arbitration_engine_frozen_v1, drift_arbitration_engine_frozen_v1-0.01, drift_arbitration_engine_frozen_v1-0.02 | STUB: EntropyBuffer smoothed entropy arbitration | aiweb/engines/drift_arbitration_engine/ | stub | MISSING |
| aiweb.drift_signature_logger | drift_signature_logger_frozen_v1-0.01 | STUB: logs drift signatures | aiweb/engines/drift_signature_logger/ | stub | MISSING |
| aiweb.entropy_monitor_engine | entropy_monitor_engine_frozen_v1-0.01 | STUB: gradient entropy shift detector | aiweb/engines/entropy_monitor_engine/ | stub | MISSING |
| aiweb.failsafe_manager | failsafe_manager_frozen_v1 | STUB: system integrity check | aiweb/engines/failsafe_manager/ | stub | MISSING |
| aiweb.gilligan_drift_correction_upgrade | gilligan_drift_correction_upgrade_frozen_v1-0.01 | STUB: random-walk pulse, drift if /p−5.5/>3; mobile: operator.js gilligan | aiweb/engines/gilligan_drift_correction_upgrade/ | stub | APPROXIMATED |
| aiweb.resonance_charge_meter | resonance_charge_meter_frozen_v1, resonance_charge_meter_frozen_v1.01 | STUB: measures charge (random) | aiweb/engines/resonance_charge_meter/ | stub | MISSING |
| chi_correction_gate | χ(t) gate (§05.8) | χ at 0.35, breaker at 0.72; mobile: kmath chiCorrect | forge/rmc_engine_v1/chi_correction_gate.py | yes | APPROXIMATED |
| correction_naming_engine | Correction + Naming Engine | repairs unstable candidates and names corrections; mobile: kmath chiCorrect (no naming) | forge/rmc_engine_v1/correction_naming_engine.py | yes | APPROXIMATED |
| drift_engine | Drift Analyzer (§05.4, ε_s §06.3) | decides whether the loop is stable enough to continue; mobile: kmath.js driftFunctional | forge/rmc_engine_v1/drift_engine.py | yes | APPROXIMATED |
| measurement_kernel | RPMC primitives | phase deviation and resonance variance σ_res; mobile: kmath.js | forge/rmc_engine_v1/measurement_kernel.py | yes | APPROXIMATED |
| protoforge2_drift_connector | ProtoForge memory-drift v2.0 | entropy and drift taxonomy; mobile: protoforge.js mvpEntropy | forge/rmc_engine_v1/protoforge2_drift_connector.py | yes | APPROXIMATED |
| Φ5/Φ6–Φ7 collapse monitor | χ override | post-collapse monitor with χ override | doc 1VYhjnaV; 19Mxth-U; 1r3FC52r | no | MISSING |
| χ(t) Lockdown | SAD | halt output on entropy breach; χ-compliant only after | doc 1VY6DhTS; 1h6T1m-5 | no | MISSING |

## echo
| Name | AKA | Does | Source | Code | Mobile |
|---|---|---|---|---|---|
| Echo Verification | SPC lineage | output must match prior-memory hash; else drift → silence | doc 15qyxm5V | no | MISSING |
| RPMC echo validation |  | echo validation (bio mention) | doc 1ijzcA9O | no | MISSING |
| aiweb.echo_trace_visualizer | echo_trace_visualizer_frozen_v1-0.01 | STUB: records echo events | aiweb/engines/echo_trace_visualizer/ | stub | MISSING |
| check_drift exact echo | Runtime Codex Vol I | exact compare against expected_output.json; mobile: forge.js echo | doc 1g_xRWtn | yes (in doc) | APPROXIMATED |
| echo_validator | V_t engine (§05.12) | checks rendered text against the manifest (0.80); mobile: forge.js JS echo | forge/rmc_engine_v1/echo_validator.py | yes | APPROXIMATED |
| gp.echo_approval | General Pipeline | General Learning-to-Answer Pipeline — Echo approval gate (Build GP-001). | forge/rmc_engine_v1/general_pipeline/echo_approval.py | yes | MISSING |
| mea.live_trace_replay | MEA kernel | replays a committed transition from evidence | forge/rmc_engine_v1/mea/live_trace_replay.py | yes | MISSING |
| mea.replay_engine | MEA kernel | deterministic operator replay; mobile: mea*.js port | forge/rmc_engine_v1/mea/replay_engine.py | yes | APPROXIMATED |
| renderer.echo_validator | MEA renderer | Build 009 text vs. Build 008 packet | forge/rmc_engine_v1/renderer/echo_validator.py | yes | APPROXIMATED |
| rmc_echo_runtime | Language Core (doc 15U_k…) | language-core RMC echo; mobile: forge_spine.js port | forge/aiweb_language_core_bootstrap/rmc_echo_runtime/ | yes | APPROXIMATED |

## render/output
| Name | AKA | Does | Source | Code | Mobile |
|---|---|---|---|---|---|
| Co-Pilot inference | LLM-based | Grok-1-style ModelRunner/InferenceRunner plus Athena/Gilligan/Neo/glyph/breather classes; language core replaces the LLM | doc 1S1nAu3p | yes (in doc) | KEEP-AS-FUNCTION |
| EchoForge debate agents | LLM-based | Proponent/Opponent/Decider/Auditor debate, argument structure, badges, audit; language core replaces the LLM | doc 1k5GANbi | yes (in doc) | KEEP-AS-FUNCTION |
| aiweb.agent.neo | neo_frozen_v1.0.01 | STUB: random-choice moods | aiweb/agents/neo/ | stub | MISSING |
| aiweb.ascii_interpreter_engine | - | STUB: log → ASCII summary | aiweb/engines/ascii_interpreter_engine/ | stub | MISSING |
| aiweb.contribution_dashboard_engine | contribution_dashboard_engine_frozen_v1 | STUB: contribution dashboard | aiweb/engines/contribution_dashboard_engine/ | stub | MISSING |
| aiweb.control_panel_ui_engine | control_panel_ui_engine_frozen_v1.01, control_panel_ui_engine_frozen_v1.02, control_panel_ui_engine_v1.02 | STUB: Flask control panel | aiweb/engines/control_panel_ui_engine/ | stub | MISSING |
| aiweb.document_output_formatter | document_output_formatter_frozen_v1 | STUB: formats output | aiweb/engines/document_output_formatter/ | stub | MISSING |
| aiweb.glyph_engine | glyph_engine_frozen_v1-0.01 | STUB: symbol mutator | aiweb/engines/glyph_engine/ | stub | MISSING |
| aiweb.naming_engine | naming_engine_frozen_v1 | STUB: assigns symbolic name (random) | aiweb/engines/naming_engine/ | stub | MISSING |
| aiweb.neo_engine | neo_engine_frozen_v1, neo_engine_frozen_v1.1.01, neo_engine_frozen_v1.1.02 | STUB: random-mood canned replies; violates LC law | aiweb/engines/neo_engine/ | stub | MISSING |
| aiweb.resonance_visualizer_engine | resonance_visualizer_engine_frozen_v1 | STUB: resonance snapshot (random) | aiweb/engines/resonance_visualizer_engine/ | stub | MISSING |
| aiweb.symbolic_drift_visualizer | symbolic_drift_visualizer_frozen_v1-0.01 | STUB: records drift events for display | aiweb/engines/symbolic_drift_visualizer/ | stub | MISSING |
| aiweb.symbolic_glyph_engine | symbolic_glyph_engine_frozen_v1-0.01 | STUB: generates glyph | aiweb/engines/symbolic_glyph_engine/ | stub | MISSING |
| aiweb.tone_engine | tone_engine_frozen_v1, tone_engine_frozen_v1-0.01, tone_engine_frozen_v1.1.01, tone_engine_frozen_v1.1.02 | STUB: chooses tone (random) | aiweb/engines/tone_engine/ | stub | MISSING |
| glyph_renderer | G_t engine | manifest → glyph form; mobile: render.js multi-output | forge/rmc_engine_v1/glyph_renderer.py | yes | APPROXIMATED |
| gp.gp014_operator_guided_language_realizer | General Pipeline | LANG-EXPR-001 / GP-014 — production activation boundary for operator-guided math; mobile: algebra.js/calculus.js | forge/rmc_engine_v1/general_pipeline/gp014_operator_guided_language_realizer.py | yes | APPROXIMATED |
| gp.meaning_and_renderer | General Pipeline | General Learning-to-Answer Pipeline — meaning compiler + generative renderer | forge/rmc_engine_v1/general_pipeline/meaning_and_renderer.py | yes | MISSING |
| gp.symbolic_math_operator_language_realizer | General Pipeline | LANG-EXPR-001 / GP-014 — measured operator-guided realization for sealed math me; mobile: algebra.js/calculus.js | forge/rmc_engine_v1/general_pipeline/symbolic_math_operator_language_realizer.py | yes | APPROXIMATED |
| llm_renderer | (frozen) | LLM renderer, frozen fail-closed. Function: realize the manifest as text; mobile: grammar.js realizer takes the role | forge/rmc_engine_v1/llm_renderer.py | yes | KEEP-AS-FUNCTION |
| manifest_compiler | Recursive Manifest Compiler μ_t (§05.10) | builds the central meaning manifest; mobile: msm.js / forge.js MSM-v1 | forge/rmc_engine_v1/manifest_compiler.py | yes | APPROXIMATED |
| output_renderer | Output Renderer R_t (§05.11) | manifest → language; mobile: grammar.js | forge/rmc_engine_v1/output_renderer.py | yes | APPROXIMATED |
| renderer.__init__ | MEA renderer | renderer corridor adapters | forge/rmc_engine_v1/renderer/__init__.py | yes | MISSING |
| renderer.grammar_templates | MEA renderer | ordered sentence plan | forge/rmc_engine_v1/renderer/grammar_templates.py | yes | APPROXIMATED |
| renderer.mea_render_gate | MEA renderer | renders only after ledger verify | forge/rmc_engine_v1/renderer/mea_render_gate.py | yes | MISSING |
| renderer.renderer | MEA renderer | preview from an admitted packet | forge/rmc_engine_v1/renderer/renderer.py | yes | MISSING |
| renderer.semantic_lexicon | MEA renderer | validates packet before semantic map | forge/rmc_engine_v1/renderer/semantic_lexicon.py | yes | MISSING |
| renderer.surface_realizer | MEA renderer | deterministic preview text | forge/rmc_engine_v1/renderer/surface_realizer.py | yes | APPROXIMATED |

## curation/cold storage
| Name | AKA | Does | Source | Code | Mobile |
|---|---|---|---|---|---|
| Cold-storage reactivation | Cold Storage Theory | ChristPing resonance match reactivates ψ; mobile: containment resurrection | doc 1wr2rhkW; 15DHtgJE | no | APPROXIMATED |
| Curation lifecycle | Recursive Virtual Arch. | memory → engines → programs; resonance index | doc 1ZOMOUhy | no | MISSING |
| Gilligan re-curation | Gilligan Core/Codex | echo-or-deny shell, re-curation; mobile: operator.js | doc 1HSjAk6U; 1hbLsNhr | stub | APPROXIMATED |
| Resurrection pipeline / SAD files | collapse_code_index, drift_log, resonance_charge | resurrection from logs | doc 1VY6DhTS | no | MISSING |
| aiweb.cold_archive_engine | cold_archive_engine_frozen_v1, cold_archive_engine_frozen_v1.01, cold_archive_engine_frozen_v1.1.01 | STUB: stores dead loops; mobile: containment SPC | aiweb/engines/cold_archive_engine/ | stub | APPROXIMATED |
| aiweb.loop_resurrection_engine | loop_resurrection_engine_frozen_v1, loop_resurrection_engine_frozen_v1.01 | STUB: resurrects a loop; mobile: containment.js | aiweb/engines/loop_resurrection_engine/ | stub | APPROXIMATED |
| aiweb.resurrection_planner | resurrection_planner_frozen_v1-0.01 | STUB: schedules recovery; mobile: containment.js | aiweb/engines/resurrection_planner/ | stub | APPROXIMATED |
| aiweb.spc_memory_migrator | spc_memory_migrator_frozen_v1-0.01 | STUB: migrates SPC memory | aiweb/engines/spc_memory_migrator/ | stub | MISSING |
| aiweb.symbolic_capacitor_engine | symbolic_capacitor_engine_frozen_v1, symbolic_capacitor_engine_frozen_v1-0.01 | STUB: resonance decay tracker | aiweb/engines/symbolic_capacitor_engine/ | stub | MISSING |
| containment_router | Containment Router (Patch 265) | routes to active, SPC, quarantine, ghost or archive; mobile: containment.js port | forge/rmc_engine_v1/containment_router.py | yes | APPROXIMATED |
| dataset_growth |  | observation capture → review → promotion gate | forge/rmc_engine_v1/dataset_growth.py | yes | MISSING |
| dream_state_quarantine | Dream quarantine | quarantines dream-state loops; mobile: containment.js / dream_idle.js | forge/rmc_engine_v1/dream_state_quarantine.py | yes | APPROXIMATED |
| drift_archive |  | archive of drifted loops; mobile: containment.js | forge/rmc_engine_v1/drift_archive.py | yes | APPROXIMATED |
| ghost_loop_containment | Ghost loop | holds ghost loops, never deletes them; mobile: containment.js | forge/rmc_engine_v1/ghost_loop_containment.py | yes | APPROXIMATED |
| promotion_path | P_t engine | promotes memory to a higher tier | forge/rmc_engine_v1/promotion_path.py | yes | MISSING |
| resurrection_engine | ChristPing 7-Gate Resurrection | re-admits sealed memory (gate_7 residue 0.85); mobile: containment.js | forge/rmc_engine_v1/resurrection_engine.py | yes | APPROXIMATED |
| spc_cold_storage | Symbolic Phase Capacitor, SPC | cold storage, meaning silence rather than deletion; mobile: containment.js | forge/rmc_engine_v1/spc_cold_storage.py | yes | APPROXIMATED |

## daemons
| Name | AKA | Does | Source | Code | Mobile |
|---|---|---|---|---|---|
| Co-Pilot Action Chain Logger | status table | JSONL action log; code patch engine (git) | doc 1wp9jszf | claimed | MISSING |
| Cold Storage / Ghost Loop daemons |  | drift-triggered daemons | doc 1ZOMOUhy | no | MISSING |
| Dream state / idle curation | dream_core | idle-time curation; mobile: dream_idle.js | doc aiweb dream_core | stub | APPROXIMATED |
| aiweb.agent_reflection_engine | agent_reflection_engine_frozen_v1 | STUB: self-reflection cycle (random) | aiweb/engines/agent_reflection_engine/ | stub | MISSING |
| aiweb.core_stack_breather | core_stack_breather_frozen_v1-0.01 | STUB: core breath cycle | aiweb/engines/core_stack_breather/ | stub | MISSING |
| aiweb.dream_state_engine | dream_state_engine_frozen_v1, dream_state_engine_frozen_v1.1.01 | STUB: simulated dream (random); mobile: dream_idle.js | aiweb/engines/dream_state_engine/ | stub | APPROXIMATED |
| aiweb.recursive_agent_kernel | recursive_agent_kernel_frozen_v1 | STUB: heartbeat pulse | aiweb/engines/recursive_agent_kernel/ | stub | MISSING |
| aiweb.recursive_field_breather | recursive_field_breather_frozen_v1-0.01 | STUB: field breath cycle | aiweb/engines/recursive_field_breather/ | stub | MISSING |
| aiweb.stack_linker_breather | - | STUB: unified breath cycle | aiweb/engines/stack_linker_breather/ | stub | MISSING |
| aiweb.symbolic_feedback_loop_engine | symbolic_feedback_loop_engine_frozen_v1, symbolic_feedback_loop_engine_frozen_v1.01 | STUB: feedback cycle (random) | aiweb/engines/symbolic_feedback_loop_engine/ | stub | MISSING |

## hardware
| Name | AKA | Does | Source | Code | Mobile |
|---|---|---|---|---|---|
| Brian2 neuron sim |  | spiking simulation, threshold v>1 | doc 1xxqf8Hg | yes (in doc) | MISSING |
| Ghost Loop Tuner | 144 Hz | acoustic retrieval (pseudoscience, not implementable) | doc 12R0SK-D | no | MISSING |
| Neuromorphic AI (AI.Web) | Tesla-inspired | frequency-based neurons (whitepaper) | doc 1r5mD0sv | no | MISSING |
| VHDL 9-state gate |  | hardware phase gate | doc 12VxYlz_ | yes (in doc) | MISSING |
| aiweb.compute_contribution_engine | compute_contribution_engine_frozen_v1 | STUB: simulated compute contribution | aiweb/engines/compute_contribution_engine/ | stub | MISSING |

## other
| Name | AKA | Does | Source | Code | Mobile |
|---|---|---|---|---|---|
| Codex integrity validator | codex_integrity_validator.py | SHA256 mismatch rejects the build | doc 1VYhjnaV | yes (in doc) | MISSING |
| EchoForge (6th doc) | LLM-based | ollama/llama debate wrapper (no defs extracted); language core replaces the LLM | doc 1B_jsWfB | yes (in doc) | KEEP-AS-FUNCTION |
| Engine Verification / Modular Runtime Stack |  | acceptance harness | doc 1WjFA8m7; 1mbJ5SIR | see preflight | MISSING |
| Neo personal assistant (doc) |  | assistant spec | doc 1xJdtmqw | stub | MISSING |
| __init__ | rmc package | package exports | forge/rmc_engine_v1/__init__.py | yes | MISSING |
| aiweb.admin_override_console | admin_override_console_frozen_v1-0.01 | STUB: admin override | aiweb/engines/admin_override_console/ | stub | MISSING |
| aiweb.agents_stack | agents_stack_frozen_v1-0.01 | STUB: agent stack bundle | aiweb/engines/agents_stack_frozen_v1-0.01/ | stub | MISSING |
| aiweb.aiweb_os_engine | aiweb_os_engine_frozen_v1 | STUB: OS command/status shell | aiweb/engines/aiweb_os_engine/ | stub | MISSING |
| aiweb.awh_token_runtime | awh_token_runtime_frozen_v1 | STUB: token earning (random) | aiweb/engines/awh_token_runtime/ | stub | MISSING |
| aiweb.install_onboarding_engine | - | STUB: env setup | aiweb/engines/install_onboarding_engine/ | stub | MISSING |
| aiweb.peer_communication_engine | peer_communication_engine_frozen_v1 | STUB: simulated peer messages | aiweb/engines/peer_communication_engine/ | stub | MISSING |
| aiweb.plugin_engine | plugin_engine_frozen_v1 | STUB: loads plugins | aiweb/engines/plugin_engine/ | stub | MISSING |
| aiweb.protoforge | protoforge_frozen_v1.03_os_ui_rfe_dae | STUB: empty frozen ProtoForge OS/UI folder | aiweb/engines/protoforge_frozen_v1.03_os_ui_rfe_dae/ | stub | MISSING |
| aiweb.seed_manager | seed_manager_frozen_v1 | STUB: generates seeds | aiweb/engines/seed_manager/ | stub | MISSING |
| aiweb.system_log_engine | system_log_engine_frozen_v1 | STUB: logs events | aiweb/engines/system_log_engine/ | stub | MISSING |
| deep_dry_run_orchestrator | Patch 271 | runs all 16 stages in order; mobile: not wired; this is the key wiring gap | forge/rmc_engine_v1/deep_dry_run_orchestrator.py | yes | MISSING |
| deep_pipeline_preflight | Engine Verification Protocol | acceptance/preflight harness | forge/rmc_engine_v1/deep_pipeline_preflight.py | yes | MISSING |
| frozen_legacy_boundary |  | fences off withdrawn legacy features | forge/rmc_engine_v1/frozen_legacy_boundary.py | yes | MISSING |
| gp.__init__ | General Pipeline | General Learning-to-Answer Pipeline (Build GP-001). | forge/rmc_engine_v1/general_pipeline/__init__.py | yes | MISSING |
| gp.capability_registry | General Pipeline | General Pipeline — centralized bounded capability registry (Build GP-004). | forge/rmc_engine_v1/general_pipeline/capability_registry.py | yes | MISSING |
| gp.capability_services | General Pipeline | General Pipeline — Forge-owned capability service contracts (Build GP-005). | forge/rmc_engine_v1/general_pipeline/capability_services.py | yes | MISSING |
| gp.contracts | General Pipeline | General Learning-to-Answer Pipeline — typed contracts (Build GP-001). | forge/rmc_engine_v1/general_pipeline/contracts.py | yes | MISSING |
| gp.dependency_registry | General Pipeline | General Pipeline dependency and runtime-tool authority registry. | forge/rmc_engine_v1/general_pipeline/dependency_registry.py | yes | MISSING |
| gp.domains | General Pipeline | General Learning-to-Answer Pipeline — domain library (Build GP-001). | forge/rmc_engine_v1/general_pipeline/domains.py | yes | MISSING |
| gp.domains_equations | General Pipeline | General Learning-to-Answer Pipeline — linear equation domain. | forge/rmc_engine_v1/general_pipeline/domains_equations.py | yes | MISSING |
| gp.domains_wordproblems | General Pipeline | General Learning-to-Answer Pipeline — multi-step word problems (Build GP-003). | forge/rmc_engine_v1/general_pipeline/domains_wordproblems.py | yes | MISSING |
| gp.gp002_linear_equations | General Pipeline | General Learning-to-Answer Pipeline — GP-002 compatibility activation under GP-0 | forge/rmc_engine_v1/general_pipeline/gp002_linear_equations.py | yes | MISSING |
| gp.gp003_word_problems | General Pipeline | General Learning-to-Answer Pipeline — GP-003 compatibility activation under GP-0 | forge/rmc_engine_v1/general_pipeline/gp003_word_problems.py | yes | MISSING |
| gp.gp004_production_reground | General Pipeline | GP-004 — General Pipeline Production Reground activation and boundary report. | forge/rmc_engine_v1/general_pipeline/gp004_production_reground.py | yes | MISSING |
| gp.gp005_capability_services | General Pipeline | GP-005 — Capability Service Contracts activation and status surface. | forge/rmc_engine_v1/general_pipeline/gp005_capability_services.py | yes | MISSING |
| gp.gp006_dependency_license_registry | General Pipeline | GP-006 — Dependency and License Registry activation/status surface. | forge/rmc_engine_v1/general_pipeline/gp006_dependency_license_registry.py | yes | MISSING |
| gp.gp007_strict_typed_ast | General Pipeline | GP-007 — Strict Typed AST and Safe Solver Adapter Boundary status surface. | forge/rmc_engine_v1/general_pipeline/gp007_strict_typed_ast.py | yes | MISSING |
| gp.gp008_manifest_contract_v2 | General Pipeline | GP-008 — Manifest Contract v2 activation and boundary status surface. | forge/rmc_engine_v1/general_pipeline/gp008_manifest_contract_v2.py | yes | MISSING |
| gp.gp009_outcome_closure | General Pipeline | GP-009 — Existing Domain Outcome Closure and Refusal Containment. | forge/rmc_engine_v1/general_pipeline/gp009_outcome_closure.py | yes | MISSING |
| gp.gp010b_audited_tool_activation | General Pipeline | GP-010B-R1 audited tool activation status surface. | forge/rmc_engine_v1/general_pipeline/gp010b_audited_tool_activation.py | yes | MISSING |
| gp.gp010c_runtime_truth_reconciliation | General Pipeline | GP-010C runtime truth reconciliation activation/status surface. | forge/rmc_engine_v1/general_pipeline/gp010c_runtime_truth_reconciliation.py | yes | MISSING |
| gp.gp011b_pint_quantity_integration | General Pipeline | GP-011B activation/status surface for Pint-backed quantity/capacity reasoning. | forge/rmc_engine_v1/general_pipeline/gp011b_pint_quantity_integration.py | yes | MISSING |
| gp.gp012r1_symbolic_math_computation_capability | General Pipeline | MATH-001R1 / GP-012R1 computation-only capability activation and status surface. | forge/rmc_engine_v1/general_pipeline/gp012r1_symbolic_math_computation_capability.py | yes | MISSING |
| gp.gp013_natural_language_symbolic_math_vertical_slice | General Pipeline | NL-MATH-001 / GP-013 — activation boundary for the first complete math-language  | forge/rmc_engine_v1/general_pipeline/gp013_natural_language_symbolic_math_vertical_slice.py | yes | MISSING |
| gp.gp015_ask_forge_trace_surface | General Pipeline | GP-015 — Ask Forge / Forge Output live verified-mathematics trace surface.; mobile: algebra.js/calculus.js | forge/rmc_engine_v1/general_pipeline/gp015_ask_forge_trace_surface.py | yes | APPROXIMATED |
| gp.manifest_builder | General Pipeline | General Learning-to-Answer Pipeline — MEA manifest builder (Build GP-001). | forge/rmc_engine_v1/general_pipeline/manifest_builder.py | yes | MISSING |
| gp.manifest_contract_v2 | General Pipeline | GP-008 — Manifest Contract v2: governed trace envelope before rendering. | forge/rmc_engine_v1/general_pipeline/manifest_contract_v2.py | yes | MISSING |
| gp.outcome_contract_v2 | General Pipeline | GP-009 — Outcome Closure and Refusal Containment Contracts. | forge/rmc_engine_v1/general_pipeline/outcome_contract_v2.py | yes | MISSING |
| gp.pipeline | General Pipeline | General Learning-to-Answer Pipeline — orchestrator (Build GP-001). | forge/rmc_engine_v1/general_pipeline/pipeline.py | yes | MISSING |
| gp.quantity_adapters | General Pipeline | GP-011B — Pint quantity/capacity adapter behind Forge capability authority. | forge/rmc_engine_v1/general_pipeline/quantity_adapters.py | yes | MISSING |
| gp.quantity_runtime_attestation_gp011b | General Pipeline | GP-011B — Side-effect-free Pint capacity delivery attestation. | forge/rmc_engine_v1/general_pipeline/quantity_runtime_attestation_gp011b.py | yes | MISSING |
| gp.runtime_truth_attestation_gp010c | General Pipeline | GP-010C — Runtime truth reconciliation and independent active-tool attestation. | forge/rmc_engine_v1/general_pipeline/runtime_truth_attestation_gp010c.py | yes | MISSING |
| gp.safe_solver_adapters | General Pipeline | GP-010B-R1 — SymPy-backed safe solver adapter.; mobile: algebra.js/calculus.js | forge/rmc_engine_v1/general_pipeline/safe_solver_adapters.py | yes | APPROXIMATED |
| gp.symbolic_math_kernel | General Pipeline | MATH-001R1 / GP-012R1 — Governed symbolic mathematics computation kernel.; mobile: algebra.js/calculus.js | forge/rmc_engine_v1/general_pipeline/symbolic_math_kernel.py | yes | APPROXIMATED |
| gp.symbolic_math_language_vertical_slice | General Pipeline | NL-MATH-001 / GP-013 — first complete natural-language symbolic-math to Echo sli | forge/rmc_engine_v1/general_pipeline/symbolic_math_language_vertical_slice.py | yes | MISSING |
| gp.symbolic_math_mea_evidence_bridge | General Pipeline | NL-MATH-001 / GP-013 — verified symbolic-tool evidence bridge into MEA. | forge/rmc_engine_v1/general_pipeline/symbolic_math_mea_evidence_bridge.py | yes | MISSING |
| gp.symbolic_math_rmc_delivery | General Pipeline | NL-MATH-001 / GP-013 — RMC meaning, deterministic math renderer and actual Echo  | forge/rmc_engine_v1/general_pipeline/symbolic_math_rmc_delivery.py | yes | MISSING |
| gp.symbolic_math_runtime_attestation_math001r1 | General Pipeline | MATH-001R1 / GP-012R1 — Complete in-memory attestation across twenty-six symboli | forge/rmc_engine_v1/general_pipeline/symbolic_math_runtime_attestation_math001r1.py | yes | MISSING |
| gp.symbolic_math_worker | General Pipeline | MATH-001R1 isolated SymPy worker.; mobile: algebra.js/calculus.js | forge/rmc_engine_v1/general_pipeline/symbolic_math_worker.py | yes | APPROXIMATED |
| llm_authority | agents/forge | records the no-LLM authority | forge/agents/forge/llm_authority.py | yes | APPROXIMATED |
| mea.__init__ | MEA kernel | MEA package; mobile: mea*.js port | forge/rmc_engine_v1/mea/__init__.py | yes | APPROXIMATED |
| mea.api_preview | MEA kernel | read-only API boundary | forge/rmc_engine_v1/mea/api_preview.py | yes | MISSING |
| mea.fixed_point_math_contract | MEA kernel | canonical JSON conformance hashes; mobile: mea*.js port | forge/rmc_engine_v1/mea/fixed_point_math_contract.py | yes | APPROXIMATED |
| mea.math_conformance | MEA kernel | integer cost schedule | forge/rmc_engine_v1/mea/math_conformance.py | yes | MISSING |
| mea.operator_registry | MEA kernel | θ_k operator digests; mobile: mea*.js port | forge/rmc_engine_v1/mea/operator_registry.py | yes | APPROXIMATED |
| rmc_pipeline |  | pipeline summary and compact trace | forge/rmc_engine_v1/rmc_pipeline.py | yes | MISSING |
| rpmc_kernel | RPMC (doc 1G-Yj323) | Resonant Phase Memory Calculus schema | forge/rpmc_kernel/ | schema only | MISSING |
