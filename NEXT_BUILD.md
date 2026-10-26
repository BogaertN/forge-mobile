# Next build order — after 4.9.103
**Date:** 2026-10-26 (America/Chicago)
**Baseline:** live 4.9.103 (shipped from 4.9.102 / `261c082c59bac9a0528596be2592629f6cb81b89`)
**Rule:** language leading + **one** reasoning step per release; pathway fixes not answer patches; live probe primary; no LLM; shared KB stays empty; size never blocks; do not push from audit.

**Sources:** `CATCHUP_AUDIT.md`, `SCREENSHOT_NOTES.md`, oct18 `BUILD_ORDER_OCT18.md` / `DECISIONS_OCT18.md`, and Nic's architecture report `AIWEB_ARCHITECTURE_VISION_REPORT.md` (prepared 2026-10-14; §3 "finished Forge Mobile" is the backlog). Status snapshots in that report are stale — live is 4.9.103+.

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

## Following releases (vision report §3 "finished Forge Mobile" — language lead + one reasoning step each)

Reorder only if Nic says so. **Do NOT build** Genesis Node, HCS, marketplace, CT-as-money, or agent products in these releases.

| Release | Language lead | One reasoning step (maps to vision §3) |
|---------|---------------|----------------------------------------|
| **later** (next) | Stay on the typed intents from 4.9.103 | Versioned RSOC operators without claiming numerical manuscript equivalence (§3.9); safe tool continuations; **adapters** (Genesis, HCS, Identity Vault, marketplace, CT-as-money) only after core is solid (§3.10–11) — parked |

### Standing laws from the report (do not reopen without Nic)
- No LLM / embedding / learned-classifier **authority** in the core. EchoForge advisory only.
- Echo = same Language Core reparse + **exact LC signature match** (predicate, args, polarity, modality, time, units, evidence status, prakāra). **Not** θ_echo similarity.
- Drift gates for Forge Mobile (Nic ruling): ≤0.35 project/write; χ correction 0.35–0.40; quarantine 0.40–0.80; hard stop >0.80. Paper 0.4/0.8 alone does not replace the 0.35 write gate. **χ in code = correction function only** (never "Christ function").
- Shared KB locked empty until Nic enables it. Live lookup never stored as facts.
- Parked until after 1.0 / core solid: Genesis Node, Harmonic Conductor Studio, tool marketplace, CT as money, Gilligan/Neo/Athena as products, Forge 2.0 rewrite.

---

## Hygiene each release
- CONFLICTS.md section first (ruling + non-goals).
- Bump feature_registry for that release’s ids only (catch up FB-11 / R483+ when touching compiler).
- Live probe before publish; targeted gate OK.
- No Drive/paper upload into the bundle; no unsolicited messages; shared KB remains locked empty.
