# Wiring report — 4.9.179

The learning loop is Ask (`Kernel.process` / `ForgeKernel.process`) → `research.web` → Athena measure and admit → Gilligan re-curate → hosted session KB → the next Ask recalls. ChristPing stays Gilligan-only. Packs stay gated (`publishPacks` false). No LLM.

## Learning loop

| Component | Caller | What fires |
|---|---|---|
| language.core | `kernel.js` `rmcChoose` route table | Evaluates the sentence. A public how-question with no stored fact becomes `research.web`. |
| research.web | `kernel.js` AQ-1 `tool_request`; `forge.js` `runTool`; `pipeline_tools.js` `researchExcerpt` | Allow-listed encyclopedia fetch. Open URLs are refused. The vault is not the answer. |
| Athena measure / admit | `dream_idle.js` `stepTick` → `routeMeasurement` → `fillBackend` → `admitRecord` | Drift ≤ 0.35 and integrity ≥ 0.85 promote. Quarantine and drift above 0.80 do not write the bank. |
| Gilligan re-curate | `dream_idle.js` `revisitCold` | One unseen cold row per tick. A projectable row writes the same hosted bank. Quarantine stays `GILLIGAN-COLD-KEEP`. |
| Hosted KB | `kernel.js` `writeSharedKnowledge` | Session bank only. The phone `confirmed_shared` store stays empty. |
| Ask recall | `kernel.js` `Q-WH-HOW-MANNER` / `CS-RECALL-MANNER` | A later how-question reads the admitted sentence before AQ-1. |
| ChristPing / χ | `dream_idle.js` `christPing`; `gilligan_codex.js` `christListen` | Only Gilligan initiates. Neo and Athena are refused. Hard drift recenters and does not admit. |
| Write key | `pipeline_tools.js` `createWriteAccess`; `app_custody.js` grant | Session grant. Not stored in source. A short key is refused. |
| Custody monitor | `app_custody.js` `schedule` → `dream_idle.js` `custody` | Reads the live mesh. Does not publish packs. |
| Gilligan Codex | `dream_idle.js` `codex.pass` and `authorizeWrite`; `bridgeAskEvidence` | Write gate before admit. Dream rehearsal does not write. |
| Forge tools | `pipeline_tools.js` `recallFromBank`; `forge_tools.js` | Phase parse and hosted recall on `hosted://bank`. Shell, patch, payment, and vector search stay refused. |
| Forge2 seal | `dream_idle.js` `loopSeal` on each Athena tick (`1123`) and each Gilligan re-curate (`1024`); Ask spine in `forge.js` `buildSpine` | Input event, rule candidates, request contract, context, read capability, successor receipt. |
| Stubs (MEA seal, capsules, council, promotion) | `forge.js` `stubs: ST.Stubs(...)` | Recommendation and tap-gated promotion. Economic scopes stay `NOT_AUTHORIZED`. |
| Request lifecycle | `forge.js` `runTool` → `transitions.js` `RequestLifecycle.walk` | Same 25 states as `forge_spine.js` `REQUEST_STATES`. |

## Forge2 (BogaertN/forge2 @ 262a95e)

| Module | Status | Caller |
|---|---|---|
| establishment | ported | `loopSeal` → `establishmentStatus` |
| frozen_value | ported | `loopSeal` → `freezeCanonical` / `thawCanonical` |
| canonical, identity, codec, input_event, classification, request contract, context subset, capability subset, request state | already in `forge_spine.js` | `forge.js` `buildSpine` and `loopSeal` |
| successor `validateSuccessor` | was exported and never called | `loopSeal` now, candidate → accepted |
| `decodeInputEvent` | was exported and never called | `loopSeal` now |
| CLI, Python tests, CI receipts, hooks | skipped | not the learning loop |
| Permitted ML families, contribution economy, terminal mutation | skipped | no LLM, no payments, no shell |

Counts: ported 2, already present 10, skipped 8. Inventory: `source/data/forge_tool_inventory.json` key `forge2`.

## Orphans found and what changed

| Item | Was | Now |
|---|---|---|
| `validateSuccessor` | Dead export in `forge_spine.js` | Called from `loopSeal` on admit and re-curate |
| `decodeInputEvent` | Dead export | Called from `loopSeal` |
| `establishment.py` | Not on the phone | `establishmentStatus`, product capability stays false |
| `frozen_value.py` | Not on the phone | Freeze before the successor hash |
| Model candidate origin | Accepted by the spine | Refused (`model_origin_refused`) |
| Network / execute / install / release / delete / payment capability | Recorded if asked | Refused (`effect_refused`) |
| Empty `META` table | Loop in `capability.frame` that could never match | Removed |

Left in place, with a caller: `stubs.js` on the Forge object; sonify on the lab hear button; e2ee on account sync; Pattern Reflection stays `operator.js` and is not Gilligan.

## Stale code / language.core blockers

| File:line | What it was | What changed |
|---|---|---|
| `source/src/kernel.js:2687` | After AQ-1 decided a public question was a lookup, `Q-WH-HOW-STATE` or the dead id `Q-WH-HOW-ADJ` forced `publicResearch` false while the vault was locked. “How is quartz?” answered “Unlock the vault” instead of research.web. `Q-WH-HOW-ADJ` is not a rule the grammar emits. | The suppression is gone. A how-is / how-are question with no stored fact starts research.web. The asked subject is kept on the meaning so an older how-state frame test still sees it. “How are you?” stays the self answer because that route is not `recall_none`. |
| `source/src/kernel.js:1629` | Any sentence containing “protoforge” or “proto-forge” was `PF_INTERNAL` on `directive.frame`, which outranks language.core. “What is protoforge?” never became a question. | The name match applies only when the turn is not a wh-question. “analyze drift”, “run protoforge”, and “protoforge status” stay blocked. |
| `source/src/kernel.js` capability frame | `META` was an empty route list and a `for` loop over it. Nothing could match. | The empty table and the loop are removed. |
| `source/src/forge_spine.js:133` | Classification allowed `origin: 'model'`. | A model origin throws. The seal uses `rule` only. |
| `source/src/forge_spine.js:164` | A capability could name `network` or `execute`. | Those side effects, plus install, release, delete, payment, and wallet, are refused. `read` and the existing memory effects stay. |
| `source/src/kernel.js` bare what-is | “What is the largest planet?” was stored as the name “largest planet”, so the description path never ran and the Planet article was over the drift band. | A noun phrase “the” + superlative stays a description. The class article can name Jupiter. |
| `source/src/forge.js` mix-cause | “What happens if you mix bleach and ammonia?” searched the pair as one title. The lead did not state the effect, and a which-clause kept the effect sentence from parsing. | Each substance is a title. The full article is read. The effect clause stops before “, which”, so language.core can say it. |

Proof: `verify/r4179_suite.js`. “How is quartz?” is `language.core` plus `research.web`. “What is protoforge?” is `language.core`. “analyze drift” stays `PF_INTERNAL`. A filament question is fetched, admitted, re-curated, and recalled.
