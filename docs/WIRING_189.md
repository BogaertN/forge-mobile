# Wiring 4.9.189 — language-core functions, no model

Ask calls `rmc_engine_v1.rmc_core.run` with `live: true`. That is the only spoken answer. C_min stays 0.87. Echo stays 0.85. The coherence formula in `measurement_kernel.coherence_components` is unchanged. No model is called. `dream_idle` and `economy` stay off. Letter packs stay gated. Money stays disabled. ChristPing stays Gilligan-only. Wikipedia stays low trust and is not an anchor or an admit basis.

```
question
  -> handle_chat                         language_core_proto_chat.py
       PROTO – SYSTEM OVERVIEW
       1jqKxPpoEBW5cigcpHvYj0OU_ir_9cV5fdCGZ_cVgXbQ
       chat_controller.py handle_chat
       query_local_llm (ollama run mistral) is not called
       speech act from the Doc 5 frame
       packet {Phi, eps, mu}
  -> recursive_agent_orchestration       language_core_orchestration.py
       Manual 1O5Txx2rLvWehvmHY_8miMtVrFTqmQgo_xLyzA_P5dGA
       Ch 4.5 Spawn, Run, Hibernate, Retire
       Ch 5 registry, Ch 6.3 budget
       one in-process reasoner, no OS process
       a low-trust hop is not resurrected
       ChristPing is not started
  -> model_inference_server              language_core_grok_infer.py
       Co-pilot 1lVaKETZLqiKDD2TBtRXwngnbXKyYpWJ_Mcp0DPwAJck
       Grok-1 host is not called
       next fact: Doc 5 copula, or a Doc 4 concept the question asked
       contract 1g2034-K §2 and §5
  -> EchoForge debate                    language_core_debate.py
       already present; proponent then opponent; no model
  -> unchanged scorer
       offer the hop only when Echo >= 0.85,
       drift <= 0.35, and C >= 0.87
  -> admit gate
       the same thresholds
  -> memory writer
       an already-banked sentence is a no-write
```

## Where each function sits

| Function | Nic's place | Mobile slot |
|---|---|---|
| Proto `handle_chat` | `POST /chat`, the conversation entry | first step inside `rmc_core.run`, before the scorer |
| Grok-1 `model_inference_server` | core runtime, after memory, before the reply | World Model inference, called by Run |
| Recursive Agent Orchestration | RMC owns cognitive orchestration (contract §2) | after recall, before the coherence scorer |
| EchoForge debate | proponent then opponent | already on the claim, unchanged |

## What rose

4.9.188 admitted 16. This pass admits 32. The new admits are facts the world model already derived. The candidate meaning is that fact, so memory_fit rose under the same formula. Glass and paper are how-questions that now admit. Sky stays held: the sky anchor does not say why the sky is blue. Twenty held questions have no phase-aligned trusted fact to connect. That list is in `docs/LIVE_TEST_189.md`.

## Stand-ins

The 4.9.187 removal still holds. Ask does not call `forge.process`. The language core is not a second answer path.
