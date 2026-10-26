# Next build order — after 4.9.100
**Date:** 2026-10-26 (America/Chicago)
**Baseline:** live 4.9.100 (shipped from 4.9.99 / `cc91932e225c2c0c98b8add670d78e78447a0669`)
**Rule:** language leading + **one** reasoning step per release; pathway fixes not answer patches; live probe primary; no LLM; shared KB stays empty; size never blocks; do not push from audit.

**Sources:** `CATCHUP_AUDIT.md`, `SCREENSHOT_NOTES.md`, oct18 `BUILD_ORDER_OCT18.md` / `DECISIONS_OCT18.md`, and Nic's architecture report `AIWEB_ARCHITECTURE_VISION_REPORT.md` (prepared 2026-10-14; §3 "finished Forge Mobile" is the backlog). Status snapshots in that report are stale — live is 4.9.100+.

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
| **4.9.101** (next) | Bidirectional intent surface for one new intent | **Counterfactual / hypothetical branches** isolated from observed history (§3.6) |
| **4.9.102** | Bidirectional intents continue (EXPLAIN / SIMULATE / CLARIFY as needed) | **MEA-on-phone learning** — revisable rule induction from evidence; proposals never auto-act (§3.7) |
| **later** | **Full bidirectional intents**: READ, DERIVE, EXPLAIN, SIMULATE, PROPOSE_EVIDENCE, REQUEST_COMMIT, CLARIFY, UNSUPPORTED; `LANGUAGE_UNEXPRESSIBLE` instead of canned fallback (§3.8) | Versioned RSOC operators without claiming numerical manuscript equivalence (§3.9); safe tool continuations; **adapters** (Genesis, HCS, Identity Vault, marketplace, CT-as-money) only after core is solid (§3.10–11) — parked |

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
