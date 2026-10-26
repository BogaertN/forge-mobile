# Next build order — after 4.9.110
**Date:** 2026-10-26 (America/Chicago)
**Baseline:** live 4.9.110 (shipped from 4.9.109 / `85f2a4263656d9e1cae722cb775266e54271c169`)
**Rule:** language leading + **one** reasoning step per release; pathway fixes not answer patches; live probe primary; no LLM; shared KB stays empty; size never blocks; do not push from audit.

**Page “Recommended next core work”:** all six items are complete for Forge Mobile. Item 1 intents is 4.9.103. Item 2 evidence admission is 4.9.107. Item 3 persistent W_v is 4.9.105. Item 4 MEA-P deepening is 4.9.108. Item 5 versioned RSOC operators is 4.9.109. Item 6 registry/CONFLICTS hygiene is 4.9.110. Do not start 4.9.111 from this file.

**Sources:** `CATCHUP_AUDIT.md`, `SCREENSHOT_NOTES.md`, oct18 `BUILD_ORDER_OCT18.md` / `DECISIONS_OCT18.md`, and Nic's architecture report `AIWEB_ARCHITECTURE_VISION_REPORT.md` (prepared 2026-10-14; §3 "finished Forge Mobile" is the backlog). Status snapshots in that report are stale — live is 4.9.110. CONFLICTS.md, VERSION, and this file govern Forge Mobile acceptance. Ledger v2 “General Language Runtime NOT LIVE” and Capability Register L-08 “Parked post-1.0” are stale for Mobile.

---

## Shipped: **4.9.110** (2026-10-26)

1. **Shipped ids** — 4.9.83 through 4.9.96 are registered as R483-QC through R496-WHOSE. Each was already in the compiler. Each claim is Partial. FB-11 was already the request-compiler row and stays Implemented.
2. **Operative status** — CONFLICTS, VERSION, and this file govern Forge Mobile acceptance. The Ledger “NOT LIVE” line and the Register L-08 park are stale for Mobile. They may remain for desktop Forge 1. L-08 stays Partial.
3. **No new behavior** — no new answer, route, or drift threshold. The historical claims-object delta stays.
4. **No LLM** — no model call, embedding, RAG, or learned classifier. Shared KB stays empty. Adapters stay parked.

---

## Shipped: **4.9.109** (2026-10-26)

1. **Versioned operators** — MathContractRegistry lists the drift measure, Nic’s drift table, the χ correction, the χ hard-stop invoke, the RSOC selector, and the phase scheme. Each entry has a stable id and version. A turn cites the versions that ran.
2. **No manuscript identity** — ROC ≡ CFBC ≡ RSOC stays SOURCE_NOT_VERIFIED. The originals are unresolved. The phase map stays a reconstruction.
3. **Write law unchanged** — project and write stay at or under 0.35. χ correction stays 0.35–0.40. Quarantine stays 0.40–0.80. A hard stop stays above 0.80. χ is the correction function only.
4. **No LLM** — no model call, embedding, RAG, or learned classifier. Shared KB stays empty. Adapters stay parked. 4.9.103 through 4.9.108 stay as they are.

---

## Shipped: **4.9.108** (2026-10-26)

1. **Same problem, next cycle** — a tap stores the 144 Hz manifest. The next “propose problem physics” keeps that problem id and that goal. It is still a proposal. It does not store the new cycle.
2. **Parked debt is an input** — candidates already in the archive, and claims already on the manifest, are carried. They are not spoken again and they are not archived again. The open measurement and the open choice are named. The first propose, and a second propose before any tap, stay the 4.9.104 sentences.
3. **Frame and parser cells** — one declared frame cell and one declared parser cell ride along as proposal data. They are not applied. The live grammar tables stay as shipped. A tap through the existing grammar-manifest adopt is still the only install, and this release does not perform one.
4. **Drift** — a spoken candidate stays at or under 0.35. Correction, quarantine, a hard stop, and an over-extended novelty stay parked.
5. **No LLM** — no model call, embedding, RAG, or learned classifier. Shared KB stays empty. Adapters stay parked. 4.9.103 intents, 4.9.105 world head, 4.9.106 dream/SPC, and 4.9.107 admission stay as they are.

---

## Shipped: **4.9.107** (2026-10-26)

1. **Named admission** — research standing and ε_w still go through the one drift table. The reply and the trace name the status: projectable, contested, held, or refused. A supported claim at or under 0.35 is projectable and offers remember. The correction band is χ once, then re-measured. Quarantine, conflict, or a correction that stays above 0.35 is contested. Above 0.80 is refused.
2. **No silent web fact** — a research answer is PROPOSE_EVIDENCE. It does not write memory, the world head, or the shared KB. The lookup stays a candidate.
3. **Inspect** — a held contested claim is listed by “show quarantine” and “show containment” as a claim in the quarantine. It is not a dream row. A projectable claim is not put on that list. An empty dream list stays the 4.9.106 sentence.
4. **Explicit commit** — “remember that …” of a projectable claim is REQUEST_COMMIT and is what stores it. A held claim is stored only by the existing tap (`commitHeld` with a user tap). A tap-less commit stores nothing.
5. **No LLM** — no model call, embedding, RAG, or learned classifier. Shared KB stays empty. Adapters stay parked. 4.9.103 intents, 4.9.104 one MEA-P cycle, 4.9.105 world head, and 4.9.106 dream/SPC stay as they are.

---

---

## Shipped: **4.9.106** (2026-10-26)

1. **Named route** — a contained turn still carries exactly one live route: `active_stack_candidate`, `correction_queue`, `spc_cold_storage_required`, `dream_state_quarantine_candidate`, `drift_archive_only`, or `ghost_loop_containment_required`. A bare “Suppose …” stays dream quarantine. It is not merged into memory or the world head.
2. **Inspect** — “show quarantine”, “show cold storage”, and “show containment” list the route, the tier or quarantined status, and a short label. An empty list says so. Forget still says the fact moved to cold storage. The sealed row is still there afterward. The language does not say it was erased.
3. **WARM and COLD** — the list uses the existing tier. A forgotten row is WARM unless policy says COLD. DEEP stays the breach and attempt-limit seal.
4. **Proposal, not approval** — “resurrect …” and “bring back …” on a WARM row return it to processing as a proposal. They do not write memory, the world head, or the shared KB. A COLD row is not returned. The Memory-screen Resurrect button still restores after the existing gates and a tap.
5. **No LLM** — no model call, embedding, RAG, or learned classifier. Shared KB stays empty. Adapters stay parked.

---

## Shipped: **4.9.105** (2026-10-26)

1. **World head** — a remember commits a WorldSnapshot (`forge-world-state/v1`) whose `version_id` is not the MemoryStore generation. The snapshot carries `world_id`, `parent_versions`, a content hash, and a `wrc:` commit receipt. The projection underneath stays `FORGE-WORLD-STATE/v1`.
2. **Atomic commit** — the next head is staged and becomes current only after it reads back. A failed stage does not report success and does not leave that stage as the current head. The same store, opened again, returns the same version and hash.
3. **What does not move it** — a Suppose branch and a conservation step leave the committed head in place. “propose problem physics” does not commit a head. An Echo failure stores nothing and does not commit a head. Shared KB stays empty.
4. **One dependent** — forgetting “Beryl is inside Cobalt” withdraws “aster is in cobalt” and commits the next head with that item invalidated. The intents from 4.9.103 and the 144 Hz proposal from 4.9.104 stay as they were.
5. **No LLM** — no model call, embedding, RAG, or learned classifier. No bitemporal index and no dream/SPC screen in this release.

---

## Shipped: **4.9.104** (2026-10-26)

1. **144 Hz, one cycle** — “propose problem physics” reads the shipped problem manifest and runs the registered operators. The reply is: I derived 1 hypothesis from the problem: (1) “144 Hz is a substrate (fundamental) frequency”. I have not stored the problem. I can only seal it after your confirmation. I archived 4 candidates.
2. **Gates** — a candidate is spoken only when drift projects at or under 0.35, standing is stamped, and novelty is inside the existing bounds. The correction band is parked. Quarantine and a hard stop are parked. The exact ratios are parked because their novelty is past the bound, so they are not spoken as the physical answer. The status stays hypothesis.
3. **Nothing automatic** — the propose writes the parked candidates to the problem archive, once. It does not write memory, world state, the drift archive, or the shared KB. “show problem physics” still has no result until a tap. “show the proposals” is still the rule induction from 4.9.102.
4. **No LLM** — no model call, embedding, RAG, or learned classifier.

---

## Shipped: **4.9.103** (2026-10-26)

1. **One job name** — every turn carries `intent_kind`. “What is my car?” is READ. “Rex is a dog. Every dog is an animal. Is Rex an animal?” is DERIVE. “Why did I stay home?” and “define drift” are EXPLAIN. “Suppose Quo is inside Rub. Is Pim inside Rub?” and “what if there is no frost?” are SIMULATE. “Show the proposals.” and “explore ideas” are PROPOSE_EVIDENCE. “Remember that my car is red.” is REQUEST_COMMIT. “I saw her duck” and “what is it?” are CLARIFY. “Buy milk” is UNSUPPORTED.
2. **Unexpressible** — a renderer fault that Echo rejects leaves the reply empty, stores nothing, and sets `language` to LANGUAGE_UNEXPRESSIBLE. The intent stays REQUEST_COMMIT for that remember. No success sentence is substituted.
3. **No new answers** — the sentences of 4.9.101 and 4.9.102 stay. A proposal still does not admit a rule. A branch still does not change the world. The shared KB stays empty.
4. **No LLM** — no model call, embedding, RAG, or learned classifier.

---

## Shipped: **4.9.102** (2026-10-26)

1. **Show and explain the proposals** — after “Remember Rex is a dog.”, “Remember Fido is a dog.”, “Remember Rex chases cats.”, “Remember Fido chases cats.”, and “Remember Bo is a dog.”, both phrasings answer: I derived 2 hypotheses from your facts: (1) “a is a dog if a chases cat”; (2) “a chases cat if a is a dog”. I have not stored the rule. I can only seal it after your confirmation.
2. **A tap is the only admission** — confirming the chase rule makes “Does Bo chase cats?” yes, through that admitted rule, and only while drift stays at or under 0.35 and the replay contradicts nothing. Withdrawing the rule makes the question not yes again. “Remember that Bo does not chase cats.” leaves only the dog rule speakable; tapping the chase rule is refused.
3. **Nothing automatic** — a proposal writes nothing to memory, world state, the drift archive, or the shared KB. “Does Bo chase cats?” is not yes before the tap. “show the problems” still lists the six problems. “what if there is no frost?” stays the dynamics intervention. “explore ideas” stays the existing exploration.
4. **No LLM** — no model call, embedding, RAG, or learned classifier. The learner is the existing symbolic operator algebra.

---

## Shipped: **4.9.101** (2026-10-26)

1. **No new grammar** — suppose, assume, imagine, what if, let’s say, and hypothetically were already the one intent. The reply stays “I answered in a branch.” and “The branch does not change the world.”
2. **Observed base** — “Remember that Pim is inside Quo.” then “Suppose Quo is inside Rub. Is Pim inside Rub?” answers yes inside that same branch. The remembered sentence is the committed base. The supposition is the overlay. A working statement in this conversation is the same kind of base.
3. **Isolation** — the branch does not write memory, world state, or the shared KB. A later “Is Pim inside Rub?” is not yes. “Suppose Quo is not inside Rub” does not retract “Quo is inside Rub.” “What if there is no frost?” stays the dynamics intervention.
4. **No LLM** — no model call, embedding, RAG, or learned classifier.

---

## Shipped: **4.9.100** (2026-10-26)

1. **Conservation** — a stated stock plus a finite inflow or outflow, an amount and not a rate, answers how much remains. “A tank contains 100 gallons. A pump removes 30 gallons. How much remains?” is 100 − 30 = 70 gallons. The same unit only. Nothing is stored.
2. **Dimensional check** — kilograms against liters, or kilograms against grams, says there is no conversion and gives no number. An unqualified gallon against liters stays US-or-imperial and gives no number. A liter and a milliliter, or a qualified US gallon, uses the factor already in the volume table and states it.
3. **Bounds** — removing more than the stock keeps the exact difference and says the stock reached empty. It does not rewrite the difference as zero. A stated capacity is the same. A missing start asks for the start.
4. **No language edit** — the private probe was not available. No public how-copula surface was found regressed. No LLM, embedding, RAG, or learned classifier.

---

## Shipped: **4.9.99** (2026-10-25)

1. **How + copula** — the noun phrase is the subject. “How are bricks made?” asks the means. “How is steel made from iron?” does not glue the participle onto steel. “How is the desert hot?” is a how-state question about the desert.
2. **Cause inversion** — an intervention stays a what-if. “Does frost cause leaks?” stays the forward inference. “What causes leaks?” walks stored cause links backward. One upstream cause is cited as the chain. Several are all cited and none is chosen. Nothing new is stored.
3. **Mechanism downgrade** — a measurement that disagrees keeps the equation, the reported number, and the conflict, and no longer treats the level equation as the mechanism.

---

## Shipped: **4.9.98** (2026-10-25)

1. **Demonstratives** — bare that is a pronoun when no nominal follows. This/that take one singular antecedent; these/those take a plural one. Several still ask, unless exactly one candidate answers the question.
2. **Generation** — a finite verb after a determiner, and a plural subject's base verb, is the clause verb. This/That/These/Those bind like It/They: the article name on the lead, the local antecedent past it. A determiner use (`this mineral`) stays a determiner.
3. **Year order** — two events with non-overlapping years answer before/after, including “happen before”. Both facts are cited. The comparison is a derived before row on world state, and a from-year/to-year span is an interval. How long uses the existing extent recall. Nothing new is stored. Rates, months, persistence, and inertia stay out.

---

## Shipped: **4.9.97** (2026-10-25)

1. **Naming asides** — comma, dash, aka, or-alias, and a reduced naming relative drop before roles. The finite verb that follows is the claim.
2. **List commas** — a coordinated nominal of any length stays one karma, with or without the Oxford comma. A comma before a new finite clause is still a clause boundary.
3. **Pronoun locality** — on the lead, It/They/He/She stand for the article subject; past the lead, only a compatible local antecedent. Echo stays an exact LC signature.
4. **Assimilation intake** — research standing and ε_w, through the one drift table, decide projectable (explicit remember) versus contested/held versus hard stop. No silent store from the web. Shared KB stays empty.

---

## Following releases

The audit Page “Recommended next core work” is complete for Forge Mobile. Do not start 4.9.111 from this file. **Do NOT build** Genesis Node, HCS, marketplace, CT-as-money, or agent products from this file.

| Still parked | What it is |
|-----------|------------|
| Parked | Genesis Node, HCS, Identity Vault as a product, marketplace, CT-as-money, agents. |
| Dream/SPC still open vs paper | The Memory-screen Resurrect button still writes after the 7 gates. `must_archive` is not a route input. No hardware SPC. No ChristPing automation without a user act. |

### Standing laws from the report (do not reopen without Nic)
- No LLM / embedding / learned-classifier **authority** in the core. EchoForge advisory only.
- Echo = same Language Core reparse + **exact LC signature match** (predicate, args, polarity, modality, time, units, evidence status, prakāra). **Not** θ_echo similarity.
- Drift gates for Forge Mobile (Nic ruling): ≤0.35 project/write; χ correction 0.35–0.40; quarantine 0.40–0.80; hard stop >0.80. Paper 0.4/0.8 alone does not replace the 0.35 write gate. **χ in code = correction function only** (never "Christ function").
- Shared KB locked empty until Nic enables it. Live lookup never stored as facts.
- Parked until after 1.0 / core solid: Genesis Node, Harmonic Conductor Studio, tool marketplace, CT as money, Gilligan/Neo/Athena as products, Forge 2.0 rewrite.

---

## Hygiene each release
- CONFLICTS.md section first (ruling + non-goals).
- Bump feature_registry for that release’s ids only. The 4.9.83–4.9.96 compiler lag is registered. Do not rewrite the historical claims-object delta.
- Live probe before publish; targeted gate OK.
- No Drive/paper upload into the bundle; no unsolicited messages; shared KB remains locked empty.
