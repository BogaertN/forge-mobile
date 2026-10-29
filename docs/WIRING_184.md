# Wiring 4.9.184 — Observe, Derive, debate

Ask still calls `rmc_engine_v1.rmc_core.run` with `live: true`. The function that used to return the memory unchanged is now the world model. Stages 14–16 are unchanged. `dry_run` still skips them. C_min stays 0.87. Echo stays 0.85. No model is called.

```
question
  -> research.web excerpt, marked quarantined
  -> memory fed to the recaller
       RMC receipts, phone KB, hosted KB (admitted)
       quarantined research is evidence, not a premise
  -> rmc_core.run
       1–13 the existing stages, including memory recall
       Observe          world_model_v1.observe
                        admitted facts enter TurnWorld/v1
                        a self-fact can be superseded; the parent root stays
                        quarantined rows are recorded and not used as premises
       Derive           world_model_v1.derive
                        direct support, or one copula hop
                        each claim has provenance, a replayed proof,
                        drift from measurement_kernel, and chi from evaluate_chi_t
       EchoForge debate language_core_debate.run_debate
                        proponent then opponent, on Doc 4/5 frames
                        no model
       Simulate         deferred, writes nothing
       14 output renderer   surviving derived_text, else admitted memory
                            a conflict renders neither side
       15 Echo              rendered answer vs the question's meaning, >= 0.85
       16 memory writer plan
  -> admit gate
       drift <= 0.35, hard stop > 0.80, C >= C_min 0.87
       C is the existing coherence formula on the scorer's candidate
  -> if admit and Echo pass: show the rendered answer
     else: show Held and the trace, including Observe, Derive, and the debate
```

ChristPing is not started. χ(t) is recorded by `evaluate_chi_t`. Only Gilligan initiates ChristPing. `dream_idle` and `economy` default off. Money stays disabled. Letter packs stay gated.

## Where each function comes from

| Function | Source |
|---|---|
| `observe` | Spec `1vBx_Q9K` §1.4 Observe(W_v, E) → (W_v+1, revision_trace). Supersession is §4.7. Quarantine is contract `1g2034-K` §8. |
| `derive` | Spec §1.4 Derive(W_v, R, Q). Four-valued result and the copula hop are contract §5. The proof shape is §4.3. Replay is §6 steps 6–8. |
| `check_proof` | Contract §4.3 and §6 step 7. A changed conclusion, root, or premise fails. |
| `simulate` | Spec §1.4 names it. Contract §13 defers counterfactual and causal simulation. Spec §6 is not this slice. |
| `run_debate` | `BogaertN/echo-forge` `orchestrator.py` `conduct_debate_round` (proponent, then opponent). `generate_agent_response` is the model call and is not ported. Roles match `BogaertN/forge` `echoforge_advisory/runtime.py` `ROLE_INSTRUCTIONS`. |
| Frames | `source/src/lexicon.js` Doc 4 concepts and Doc 5 frames (`karta`, `karma`, `vishaya`). Forge `predicate_role_frame_registry/schema.py`: an unknown predicate is not snapped to a near one, and an LLM explanation is not predicate authority. |
| Limits | `source/src/reason.js` `LIMITS`, which contract §10 requires the slice to enforce. |
| Drift bands | `mobile_config.py`. Clean at or under 0.35. Above 0.35 is chi or quarantine. Above 0.80 is a hard stop. |
| χ(t) record | `chi_correction_gate.evaluate_chi_t`. It does not start ChristPing. `dream_idle.js`: only Gilligan initiates ChristPing. |
| Admit C | `measurement_kernel.coherence_components`. Weights unchanged. |
| Self-facts | Contract §2 sentences, plus the ChristPing sentence in `dream_idle.js`. Observe can supersede one when a new admitted sentence has the same predicate and subject. |

## Thresholds

| Gate | Value | Role |
|---|---:|---|
| C_min | 0.87 | Admit. Not lowered. |
| Echo | 0.85 | Coverage of the question's meaning tokens by the rendered answer. |
| Drift quarantine / chi | 0.35 | At or under 0.35 can leave cold storage. Above 0.35 is chi or quarantine. |
| Hard stop | 0.80 | Above this is a hard stop. |
| Router 0.72 and 0.78 | reference only | Not the admit decision. |

The 60-question table is `docs/LIVE_TEST_184.md`. C still tops out at 0.835833. The note there says which term is short and what evidence would lift it.
