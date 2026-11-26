# Dream State / Autonomic Growth Engine — Research Brief v2

**Date:** 2026-10-28 (America/Chicago)  
**Authority:** Nic (pt139u) — clarified intent for same-page pass **before any build**.  
**Standing:** No code ship this turn. No CloudAgent. No LLM. Continuous fill remains **PAUSED** until Nic explicitly restarts. Pathway not patches.  
**Live baseline:** Forge Mobile **4.9.168** (`forge-mobile-4162` / `BogaertN/forge-mobile`).  
**Supersedes:** `/workspace/dream-state-engine-brief.md` (v1) on the “dream ≠ KB builder” split — see §3 Softening and §5 Reconcile.  
**Drive live re-fetch:** `user-Google Drive-xai` MCP is **not callable from this executor**; inventory uses prior parent Drive search IDs + full local corpus mirrors under `/workspace/kernel-papers` (246 markdown files) and SE/Drive dumps. Parent should re-run Drive search+`read_file` if any Doc moved.

---

## 1. Unified intent restatement (Nic’s words → working contract)

Nic clarified that “dream / idle / autonomic growth” means **one product goal**, not two unrelated hobbies:

1. **Autonomic growth** — the system **learns and fills gaps with factual information on its own** (machine learning **without** an LLM).  
2. **Idle / dream-related engine** — when not in active conversation, the system **researches unknowns** and **stores results into memory lanes** chosen by **drift / χ measurements**.  
3. **Not** manual section clicking. **Not** Grok Bot stuffing packs by hand.  
4. **Different measurements → different destinations** — e.g. stable / provisional / quarantine (and hard/SPC where law already says so).  
5. Papers on **memory** and on **how dream should fill gaps factually** are in scope; the prior brief’s hard “paper Dream ≠ KB builder” framing needs to be **softened and reconciled**, not used to dismiss Nic’s ask.

**Working one-liner for checklist (§7):**  
*Idle gap research → measure drift/χ → auto-route into the lawful memory lane for that band; no LLM; no silent dream-quarantine→`confirmed_shared` unless integrity + admit law say so.*

---

## 2. Full source inventory

Legend for **Autonomic gap-fill?** column:  
- **YES-paper** = Doc explicitly describes intake/validation → knowledge / mainline memory / upload.  
- **LANES** = Doc describes multi-lane routing by coherence / drift / quarantine.  
- **QUAR-only** = Doc/law forbids stable memory / truth / projection from dream route.  
- **IDLE-monitor** = Idle = fragmentation watch / reintegrate-or-cold, not web research.  
- **FILL-tool** = Product continuous/curator fill of hosted KB (not named “dream”).  
- **STUB** = Named but NotImplemented / deferred.

### 2.1 Google Docs (Drive ids from prior live search; content verified via local mirrors)

| Title | Drive id | Link | Autonomic gap-fill? | What it says (short) |
|---|---|---|---|---|
| Untitled 🧠 (Dream Drift Protocol + Stack 6) | `14fVCPgQ0UtRBnSclMfQ-3fazrdwKc-BrknfqYFolJ8g` | [Doc](https://docs.google.com/document/d/14fVCPgQ0UtRBnSclMfQ-3fazrdwKc-BrknfqYFolJ8g/edit) | IDLE-monitor + **YES-paper (upload gate)** | Idle = unconscious/latent; Dream State monitor watches fragmentation → Ping reintegrate **or** cold archive. Same Doc family as Stack 6 engines incl. reality checker / upload. |
| 🧠🌀🌬️memory core stacks | `16qImMjbFIwEdiuYSmUarJasQAn3ODPFQPqihvH6t8fU` | [Doc](https://docs.google.com/document/d/16qImMjbFIwEdiuYSmUarJasQAn3ODPFQPqihvH6t8fU/edit) | **YES-paper + LANES** | **Stacks 1–4 Truth Integration:** new inputs → harmonic check → validated truths into KB. **Stack 6:** 9 dream engines; `symbolic_reality_checker` → memory upload vs sandbox; **`sandbox_promoter.py` “Pushes coherent dream-state entities into mainline memory if integrity is high”**; `quarantine_dispatcher.py` isolates drift. **Stack 7** Memory Resonance Core: persist / decay / cold. Harmonic gap filler = symbolic gaps, not web crawl. |
| RPMC Implementation Blueprint | `1L_f5I2InqyMiGKX7ERs0et9jY9-gzpVgvqmZ-VAl46E` | [Doc](https://docs.google.com/document/d/1L_f5I2InqyMiGKX7ERs0et9jY9-gzpVgvqmZ-VAl46E/edit) | LANES (incubator) | **§14 Ghost Loop Vault & Dream-State Orchestration:** dream engines on `/dream_drift/`; heal → **re-promote to incubator** (not straight product KB); ghost/dream logs; only `dream_engine` / `arbitration_engine` mutate. Paths `/aiweb/dream_drift/`, `/aiweb/ghost_loops/`. |
| ProtoForge Dev Book / RPMC Impl Log | `1JU1bcMFQ_STOV2ZSOPNJBbj7PKCQtcaY1mUaTEtzXLo` | [Doc](https://docs.google.com/document/d/1JU1bcMFQ_STOV2ZSOPNJBbj7PKCQtcaY1mUaTEtzXLo/edit) | same as Blueprint | Mirror of §14 + dream_drift paths. |
| RPMC Full Protocol | `1G-Yj323feeMBklm6sENdawfBBTC1VfdL4slIGtoFRxE` | [Doc](https://docs.google.com/document/d/1G-Yj323feeMBklm6sENdawfBBTC1VfdL4slIGtoFRxE/edit) | LANES (phase law) | Axiom 4: only phase-aligned combine/project; collapse → cold not delete; χ/grace correction; silence ≠ erasure. |
| RPMC Canonical Test Data v1.0 | `1b8JAc-aATjD7h1Ed4KYA2kxxPkxHaX5-lDO5V5qsXsM` | [Doc](https://docs.google.com/document/d/1b8JAc-aATjD7h1Ed4KYA2kxxPkxHaX5-lDO5V5qsXsM/edit) | — | Test vectors RPM/SPC/resurrection; not KB fill scheduler. |
| Forge Full System Overview (correct build path) | `1i3c1OhNXic7-9C2Tdyb8o9ATGhnFXBTeVhP1Ecke5GQ` | [Doc](https://docs.google.com/document/d/1i3c1OhNXic7-9C2Tdyb8o9ATGhnFXBTeVhP1Ecke5GQ/edit) | QUAR-only (Gap 7) | **Gap 7 Dream State Quarantine**; Priority 27 hypothesis holding — speculative, not projectable. |
| Master Capability Register (Zero-Cost) | `1FaALlnvNiCeH1iAkJGKQHRDeTdpqCotELP1MZ4R2xy0` | [Doc](https://docs.google.com/document/d/1FaALlnvNiCeH1iAkJGKQHRDeTdpqCotELP1MZ4R2xy0/edit) | QUAR-only + FILL-adjacent | **E-05 Dream quarantine** (no stable memory / truth / projection); E-04 SPC; E-06 Ghost; G-10 crawler admission (external resource admission — related to fill, not dream route). |
| Capability Register sibling | `1tS_VLjZHe21Vrsc86A37F65ttudfsoX8wqlfwQ3EK8M` | [Doc](https://docs.google.com/document/d/1tS_VLjZHe21Vrsc86A37F65ttudfsoX8wqlfwQ3EK8M/edit) | same E-* | Containment rows. |
| AI10 / Corrected Production Roadmap | `1LaAeUNQca8WTAgj6b6Yob1KkPqj-0bp4leTu6PoSc7A` | [Doc](https://docs.google.com/document/d/1LaAeUNQca8WTAgj6b6Yob1KkPqj-0bp4leTu6PoSc7A/edit) | folds dream under containment | `dream_state_engine` listed under containment/governed memory — not a named research-fill product. |
| FBSC recursive phase model note | `1MUn41Mp7iW7hgMpZ0X1UOdEmyEiviy_qPhWMl8oRscQ` | [Doc](https://docs.google.com/document/d/1MUn41Mp7iW7hgMpZ0X1UOdEmyEiviy_qPhWMl8oRscQ/edit) | IDLE-monitor | **DreamState = Φ7.5** unresolved recursion phase. |
| ProtoForge Volume II Dashboard | `1CyYABK0J8_muDCABSpydFuNv8q3Fjj4RmghjK-UwuPA` | [Doc](https://docs.google.com/document/d/1CyYABK0J8_muDCABSpydFuNv8q3Fjj4RmghjK-UwuPA/edit) | aspirational YES + STUB | Ch.6.2 **Learn Without Forgetting** (learn by re-alignment, not LLM ingest). X-15 “listening to the world”. **`dream_state.py` → `run_dream_cycle()` NotImplemented** — named **“autonomous Dream Protocol agent stub.”** |
| RUNTIME CODEX Volume I | `1YwpDYZT1ike_L30GjKPVXgG4dRnHVo_dy4RY9jsl3js` | [Doc](https://docs.google.com/document/d/1YwpDYZT1ike_L30GjKPVXgG4dRnHVo_dy4RY9jsl3js/edit) | STUB | Same `run_dream_cycle` stub. |
| GILLIGAN AGENT CORE | `1HSjAk6UYKnqpT6LZo_30DjAAA9eWKoaWdpXrKk9LMnE` | [Doc](https://docs.google.com/document/d/1HSjAk6UYKnqpT6LZo_30DjAAA9eWKoaWdpXrKk9LMnE/edit) | SPC/ghost motif | Not a KB dream engine. |
| PROTO – SYSTEM OVERVIEW | `1jqKxPpoEBW5cigcpHvYj0OU_ir_9cV5fdCGZ_cVgXbQ` | [Doc](https://docs.google.com/document/d/1jqKxPpoEBW5cigcpHvYj0OU_ir_9cV5fdCGZ_cVgXbQ/edit) | motif | Dream-state as architecture motif. |
| Resonance Cold Storage / Ghost Reintegration | `1Tn_j_gZSoOGpNvU0ll5x-nd5JcEhMO0DdW6x83iTEu8` / `12R0SK-DkJ2UKx4r9nokmdyv3DFEalUxxMwbRl5E6TwQ` | Docs | LANES (cold) | SPC / ghost reintegration theory. |
| File8: Memory | `1glYXaHdPi4pDPo2hE0i8R2avMsSruZmd6TRMFbe1qAo` | [Doc](https://docs.google.com/document/d/1glYXaHdPi4pDPo2hE0i8R2avMsSruZmd6TRMFbe1qAo/edit) | seal/echo law | Large memory archive framing. |
| Folder **AIWEB_RPMC_CORPUS_SEED** | `1EPuuXJhyjt_G9oyv86s7akfNDvXuJpb9` | folder | corpus | Holds Full Protocol + Blueprint + Canonical Test Data. |
| Coherence Engine (related) | local + Drive family | — | motif | Silent / dream-state stabilizer agents; not fill scheduler. |
| Unified Algebra / SE dumps | local `oct18/drive` | — | IDLE-monitor | Dream Drift Protocol text mirrored in `se/013801.txt`; discharge glyph required for Dream Drift termination. |

**Drive queries requested this pass** (dream, Dream Drift, Stack 6, Dream-State Cognition, memory core, resident phase, RPMC memory, admit, quarantine, continuous fill, gap fill, unknown, autonomous research, ML without LLM, SPC, ghost vault, Orchestrator §14, resonance packet, confirmed_shared, Knowledge Base builder, overnight, idle): **executor could not call Drive MCP**; results above = prior parent inventory + local full reads. Recommend parent re-paginate Drive with those terms + folder `AIWEB_RPMC_CORPUS_SEED` / memory / forge.

### 2.2 Local corpus / briefs / code trees

| Path | Autonomic gap-fill? | Notes |
|---|---|---|
| `/workspace/kernel-papers/` (**246** `.md`) | mixed | Full mirrors of stacks, Blueprint, Vol II, Capability Register, FBSC, etc. |
| `/workspace/kernel-papers/audit_reads/memory_core_stacks.md` | **YES-paper + LANES** | Authoritative Stack 6 + Truth Integration + Stack 7 text. |
| `/workspace/kernel-papers/math/RPMC_Implementation_Blueprint.md` | LANES | §14 full. |
| `/workspace/kernel-papers/oct25/BRIEF_4.9.106_DREAM_SPC.md` | **QUAR-only** | Dream/SPC inspectability; Shared KB / LLM **out of scope**. Band 0.40–0.80 → quarantine not silent merge. |
| `/workspace/kernel-papers/oct25/BRIEF_4.9.119_DREAM_SPC.md` | **QUAR-only** | Honesty cleanup; no silent write to memory/world/shared KB. |
| `/workspace/kernel-papers/oct25/BRIEF_4.9.128_SHARED_KB_AZ.md` | FILL-tool | Hosted A–Z KB; write-key gated; **distinct from dream quarantine**. |
| `/workspace/kernel-papers/oct25/BRIEF_4.9.128_PACK_REFRESH.md` | FILL-tool | **Continuous fill** of verified facts → `confirmed_shared`. |
| `/workspace/kernel-papers/FORGE_FEATURE_PLAN.md` | Partial X-15 | W2 containment; X-15 listening/learning — Mobile offline-limited. |
| `/workspace/dream-state-engine-brief.md` | v1 | Prior split; softened by this v2. |
| `/workspace/forge-mobile-4162/` | QUAR shipped + FILL paused | Live product tree. |
| `/workspace/cs4162/rebuild_cs_packs_4162.js` | FILL-tool | Deterministic pack rebuild; admit standing `confirmed`/`projectable`; hold contested/quarantine. |
| `/workspace/mea-research/forge/rmc_engine_v1/dream_state_quarantine.py` | **QUAR-only (implemented)** | Patch 266: `stable_memory_allowed=false`, `truth_support_allowed=false`, approval token for commit; cannot enter active memory. |
| `/workspace/mea-research/aiweb/engines/dream_state_engine_frozen_v1/` | STUB toy | Tiny random `simulate_dream_state`; review **DEFERRED** 2026-05-16; not a research fill. |
| `/workspace/mea-research/forge/memory/engine_review_*dream*` | review artifacts | Evidence binders / LLM review drafts (review used ollama; product law still no LLM for Forge Mobile). |

### 2.3 GitHub — BogaertN repos scanned

**Repos listed (14):**  
`forge-mobile`, `forge`, `forge2`, `aiweb`, `Ai.Web-Full-Library-`, `Ai.web`, `ai-web-site`, `echo-forge`, `harmonic-conductor-studio`, `self-hosted-identity-vault`, `identity-vault`, `tesla-simulation-max`, `Coffinpop`, `sniffr-website`.

| Repo | Dream / fill / quarantine findings |
|---|---|
| **BogaertN/forge-mobile** | **Primary.** Commits: `4.9.106` dream quarantine + SPC inspect; `4.9.107` evidence admission + quarantine honesty; `4.9.119` dream/SPC cleanup; `4.9.127–168` `confirmed_shared` packs + resonance packets; GELC hypothesis store / drift bands (`v4.9.7`–`15`); research matcher governed by **one drift table** (project / χ / quarantine / hard). Code search for `dream_state` symbols often empty (index lag); local clone + commit search authoritative. **No** Stack 6 py ports; **no** idle research→KB daemon. |
| BogaertN/forge | Desktop RMC; `containment.js` cites `dream_state_quarantine.py` / Patch 266. GH `search_code` returned 0 (incomplete index); local `mea-research` holds the py. |
| BogaertN/forge2 | No dream_state hits via code search (index incomplete). |
| Others | Library / vault / echo / site — not Mobile dream fill. |

**Issues/PRs:** forge-mobile dream work shipped via PRs historically (#30 4.9.106, #31 4.9.107, #53–#55 shared KB, #96 resonance packets). No open “idle dream researches unknowns” issue found in this pass’s sample.

---

## 3. Softening the prior “dream ≠ KB builder” claim

**v1 claim (too hard):** Canonical paper dream does not equal autonomous KB research; idle research→KB is continuous fill only.

**What papers actually say (softening evidence):**

1. **Stack 6 `sandbox_promoter.py` (paper-backed):** *“Pushes coherent dream-state entities into **mainline memory** if integrity is high.”* Paired with `quarantine_dispatcher.py`. This is an explicit **dream → memory** path under integrity.  
2. **`symbolic_reality_checker.py`:** Determines readiness for **memory upload** vs remain in sandbox; quarantine if misaligned.  
3. **Truth Integration Stack (Stacks 1–4):** Continuous decode → harmonic check → **validated truths into the knowledge base** — autonomic factual growth language Nic wants, even when not labeled “dream.”  
4. **§14:** Dream heal → **incubator re-promotion** (crystallization pipeline), not discard.  
5. **ProtoForge naming:** `dream_state.py` described as **“autonomous Dream Protocol agent stub”** — colloquial “autonomous” matches Nic’s language even though body is NotImplemented.  
6. **Dream Drift idle:** Unconscious/idle loops are the **scheduled moment** papers assign to dream machinery (even if that machinery’s first job is fragmentation/heal).

**What still forbids silent KB poison (must keep):**

1. Forge Mobile / Capability **E-05** / Patch 266 / BRIEF 106–119: dream **quarantine** route has `stable_memory_allowed=false`, `truth_support_allowed=false`, `projection_allowed=false`.  
2. BRIEF 106: Shared KB **out of scope** for the quarantine UX slice; resurrect = **proposal** only.  
3. §14 reintegration lands in **incubator**, not hosted `confirmed_shared`.  
4. Continuous fill is a **separate curator/write-key path** and is **PAUSED**.

**Softened statement (v2):**  
Paper “dream” is **not only** quarantine theater — Stack 6 + §14 + Truth Integration describe a **lawful pipeline from speculative/idle work toward memory**. But **“mainline memory upload” ≠ silent write to hosted `confirmed_shared`**. Nic’s autonomic gap-fill is paper-aligned if we treat dream/idle as the **scheduler + sandboxed research + integrity gate**, and admit into product lanes **only** through drift-banded standing + C3 curator/packet law.

---

## 4. Contradictions and how to reconcile

| # | Tension | Reconcile (proposed) |
|---|---|---|
| 1 | Nic: idle dream researches facts into memory ↔ E-05 / Patch 266: dream route cannot support truth or stable memory | Split **roles**: (a) **Idle research worker** produces candidates; (b) **measurement router** bands them; (c) **dream quarantine route** only for explore band / speculative; (d) **admit path** for ≤0.35 / high integrity uses curator/packet/`confirmed` standing — never labels the write as “dream quarantine admit.” |
| 2 | `sandbox_promoter` → mainline memory ↔ Mobile sealed dream route | Map “mainline memory” to **incubator / provisional / projectable standing**, then C3 for hosted KB. Paper “upload” = promote after integrity, not bypass write-key. |
| 3 | Dream Drift idle = fragmentation monitor ↔ Nic idle = research unknowns | **Both** run in idle: Drift monitor protects loops; research worker fills **documented gaps** (AQ-1 misses, RPMC-ANCESTOR-NONE, letter holes). Same clock, different jobs. |
| 4 | Capability “E-05 Implemented” ↔ Overview Gap 7 still open ↔ toy `dream_state_engine` deferred | Mobile implemented **route + inspect honesty**. Stack 6 engines + orchestrator + idle research **not** implemented. Toy engine ≠ product. |
| 5 | Continuous fill paused ↔ Nic wants autonomic fill | Fill is the **admit tool**; restart is Nic’s gate. Architecture can wire idle→draft→admit **without** unpausing until he says so. |
| 6 | ProtoForge “autonomous Dream Protocol” ↔ papers forbid LLM ingest learning | Autonomy = **deterministic recursion / research tools / harmonic admit**, not LLM training. Vol II §6.2: learn by re-alignment, not dataset expansion. |
| 7 | Harmonic “gap filler” engines vs factual web gap-fill | Paper gap filler often means **symbolic/harmonic** substitute. Nic wants **factual**. Reconcile: use existing **`research.web` / AQ-1** as factual intake; harmonic stacks remain validators — **inferred join**, mark as such until Nic confirms. |

---

## 5. Already built / half-built / absent

### Shipped (Forge Mobile 4.9.168)

- Containment router + sealed dream/ghost/SPC/drift routes (`containment.js`).  
- Hypothesis/v1 store; dream quarantine inspect; SPC tiers; resurrect → proposal.  
- Drift table on research matcher (project / χ / quarantine / hard).  
- Hosted `confirmed_shared` A–Z + **resonance packets `{Phi,eps,mu}`**.  
- On-demand `research.web` / AQ-1 (interactive, not idle daemon).  
- GELC hypothesis → admitted rule (user tap).

### Half-built / adjacent

| Artifact | State |
|---|---|
| Continuous fill / `rebuild_cs_packs_4162.js` | **Exists; PAUSED** — closest factual KB builder. |
| `dream_state_quarantine.py` (mea-research / forge RMC) | **Full Patch 266 quarantine writer** (approval-token); not a research fill. |
| `dream_state_engine_frozen_v1` | Toy drift logger; **DEFERRED** May 2026; not usable. |
| ProtoForge `run_dream_cycle` | **NotImplemented** stub only. |
| Stack 6 nine engines | Spec text only; no Mobile/JS ports. |
| §14 dream orchestrator | Pseudocode only. |
| X-15 “listening to the world” | Feature-plan Partial; Mobile BG unreliable. |

### Absent (Nic’s autonomic idle research daemon)

- Scheduled idle gap enumerator → research → measure → lane write.  
- Auto-admit to `confirmed_shared` without curator/write-key.  
- Stack 6 sandbox runtime on phone/box.  
- Dream-orchestrator healing loop on ghost hypotheses.

---

## 6. Proposed architecture (matches Nic + stays lawful)

**No code in this brief** — design only. Each piece tagged **[paper]** or **[inferred]**.

```
                    ┌─────────────────────────────────────┐
   IDLE CLOCK       │  Idle scheduler (box-preferred)     │  [inferred: Vol II idle /
   (not-in-chat)    │  + Dream Drift fragmentation watch  │   Dream Drift idle]
                    └─────────────┬───────────────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
     Gap enumerator        Dream Drift monitor   Ghost/hypothesis
     (AQ-1 misses,         (reintegrate or SPC)  heal cycle (§14)
      RPMC-ANCESTOR-NONE,   [paper]               [paper]
      letter holes) [inferred from Mobile gaps]
              │
              ▼
     Deterministic research.web / allow-listed sources
     NO LLM / NO CloudAgent   [paper: Mobile tool law; Nic]
              │
              ▼
     Measure eps / χ / integrity vs base memory
     [paper: RPMC + Nic drift table]
              │
              ▼
     ┌──────── drift / χ router ────────┐
     │ ≤0.35 project/write              │──► provisional / incubator /
     │      high integrity              │    standing confirmed|projectable
     │      [paper bands + Stack6       │    then C3 packet admit to
     │       sandbox_promoter intent]   │    confirmed_shared IF write-key
     │                                  │    + Nic fill unpaused [paper+gate]
     │ χ 0.35–0.40                      │──► correction queue (one χ pass)
     │ 0.40–0.80 explore                │──► dream_state_quarantine ONLY
     │                                  │    (no truth_support) [paper E-05]
     │ >0.80 hard                       │──► SPC / hard stop [paper]
     └──────────────────────────────────┘
```

### Lane table (Nic destinations)

| Band | Destination | Product store | May support answers? |
|---|---|---|---|
| ≤0.35 + integrity high + standing admit | **Stable / projectable** | Incubator → (optional) `confirmed_shared` via C3 + `{Phi,eps,mu}` | Yes, after admit |
| ≤0.35 but incomplete evidence | **Provisional** | Hypothesis or provisional standing; not hosted until confirmed | Limited / clarify |
| χ 0.35–0.40 | Correction | Correction queue | After re-measure |
| 0.40–0.80 | **Quarantine / dream** | Hypothesis `dream_state_quarantine_candidate` | **No** |
| >0.80 / sealed | **SPC / hard** | Cold storage | Resurrection = proposal only |

### Explicit bans (lawful)

- Dream quarantine route **must not** set `truth_support_allowed` or write `confirmed_shared`. **[paper]**  
- No LLM synthesis of “facts.” Research output must be deterministic extract + Language Core reparse. **[paper + Nic]**  
- No Grok Bot hand-stuffing packs as the design; curator scripts OK as the **admit tool** behind the router. **[Nic]**  
- Do not unpause continuous fill until Nic says. Architecture may still draft to provisional lanes. **[standing]**

### Paper-backed vs inferred (checklist for honesty)

| Piece | Tag |
|---|---|
| Drift bands 0.35 / 0.40 / 0.80 | **[paper — Nic Mobile]** |
| Dream quarantine bans | **[paper — E-05 / Patch 266 / BRIEF 106]** |
| sandbox_promoter → mainline if integrity high | **[paper — Stack 6]** |
| §14 heal → incubator | **[paper]** |
| Truth Integration → KB | **[paper — Stacks 1–4]** |
| Resonance packet on admit | **[paper — live 4.9.168]** |
| Idle research worker using `research.web` on gap list | **[inferred join]** of Mobile tools + Nic intent + Truth Integration “new input feeds” |
| Auto-unpause hosted fill overnight | **[not paper; Nic gate]** |
| Equating “mainline memory” with hosted `confirmed_shared` | **[inferred — needs Nic confirm]** |

---

## 7. Same-page checklist for Nic (confirm before code)

Reply yes/no/adjust on each:

1. **Goal name:** Autonomic growth = idle factual gap-fill by drift/χ into memory lanes (no LLM, no manual pack stuffing). Confirm?  
2. **Softening OK?** Accept that papers *do* describe dream→memory upload (`sandbox_promoter` / reality checker) **and** that Mobile dream **quarantine** still cannot be the truth-admit channel?  
3. **“Mainline memory” mapping:** Prefer (A) incubator/provisional only until curator, (B) may auto-write `confirmed_shared` when ≤0.35 + packets + standing confirmed, or (C) other?  
4. **Restart continuous fill?** Leave paused / resume as admit backend for band ≤0.35 / never auto?  
5. **Idle research sources:** Allow-listed `research.web` + existing archives only? Any ban list?  
6. **Gap enumerator:** AQ-1 misses + RPMC-ANCESTOR-NONE + letter coverage holes — sufficient, or add others?  
7. **Scheduler host:** Prefer Grok Bot box overnight (reliable) vs phone background (unreliable)?  
8. **First ship slice:** (S1) box idle research → provisional/quarantine only; (S2) S1 + auto C3 admit ≤0.35; (S3) Stack 6 sandbox ports; (S4) §14 ghost heal orchestrator — pick order.  
9. **Quarantine bans stay absolute** for band 0.40–0.80 even if research found “facts”?  
10. **No CloudAgent / no LLM** remains hard law for this work?  
11. **Naming:** Keep calling the whole system “dream state engine,” or split product names (“Idle Research Router” vs “Dream Quarantine”)?  
12. **Anything in §6 marked [inferred] you reject?** List ids.

---

## 8. Counts & method notes

| Metric | Count / note |
|---|---|
| Local kernel-papers `.md` | **246** |
| mea-research paths matching `*dream*` | **72** (incl. backups) |
| BogaertN GH repos listed | **14** |
| Primary GH repo deep-scanned | `forge-mobile` (commits + local tree); `forge` / `forge2` code search incomplete |
| Drive Docs in inventory table | **20+** (ids from prior live search; content via mirrors) |
| Drive MCP this executor | **Unavailable** — parent should re-fetch if needed |
| Code shipped this turn | **None** |

---

## 9. Top findings (executive)

1. **Softening required:** Stack 6 explicitly promotes coherent dream entities into **mainline memory** when integrity is high — v1’s hard “dream ≠ KB” overstated quarantine-only law.  
2. **Quarantine law still binding:** E-05 / Patch 266 / BRIEF 106–119 forbid truth/stable memory from the **dream quarantine route**; that ban must survive Nic’s autonomic design.  
3. **Closest existing builder is continuous fill** (paused) + resonance packets + drift-banded research matcher — not the toy `dream_state_engine`.  
4. **Half-built elsewhere:** `dream_state_quarantine.py` (real) + frozen toy dream engine (deferred) + ProtoForge `run_dream_cycle` stub — none is idle factual research.  
5. **Reconcile path:** Idle research worker + drift/χ router into lanes; dream quarantine only for explore band; stable admit via integrity + C3/packets — matches Nic **and** papers if “mainline” ≠ silent CS write without gates.

---

*End brief v2. Await Nic checklist answers before any implementation.*
