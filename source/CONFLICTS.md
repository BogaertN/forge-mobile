# CONFLICTS.md — how each conflict was settled

Precedence (user's rule): **forge2 code > newest dated doc (RMC Implementation Addendum, Sep 2026) > older docs**. Where forge2 says nothing, **forge code** comes before docs. Every row lists the sources and where the decision lives in the code.

| # | Conflict | Sources | Resolution | Where |
|---|---|---|---|---|
| 1 | "forge2 is the kernel implementation" vs. what the code contains | user premise; BogaertN/forge2@262a95eb `src/forge2/contracts/*` (Phase 0+1 contract spine only, no parser/gates/MSM) | Contract identities, canonical serialization, request states, InputEvent, CandidateSet, RequestContract, ContextManifest and CapabilityRequirement come from forge2. The kernel itself (gates, MSM-v1, bridges, MEA, GP-014) is ported from **forge**. | `src/forge_spine.js`, `src/forge.js` |
| 2 | Hash: BLAKE3 (RSOC/Doc 2 ψ_id) vs. SHA-256 | forge2 `canonical.py` / `identity.py` (sha256) | **SHA-256** everywhere, including ψ_id. Verified byte-for-byte against Python forge2 golden vectors. | `forge_spine.js canonicalSha256`; `test/forge2_vectors.json` |
| 3 | Float confidences (forge, docs) vs. forge2 integer basis points | forge2 `classification_candidate.py` (`confidence_bps` 0–10000, floats rejected) | Serialized contracts use **integers only**. Floats exist only inside drift/math computation and are never serialized into contracts. MEA uses forge's integer fixed-point contract. | `forge_spine.js candidate`, `meaScore` |
| 4 | Request-state transition table | forge2 `request_state.py` defines 25 states with **no** edge table (`TRANSITION_POLICY_DEFINED = False`) | States are recorded as a trace only. The app makes no claim about which transitions are allowed (`transition_policy_defined:false`). | `forge.js buildSpine` |
| 5 | Natural-language classification and UI are not authorized in forge2's current phase | forge2 README / phase gates | The app is marked a **prototype outside the forge2 phase gates**. Every classification candidate has `origin:"rule"` and the identified producer `forge-mobile-kernel/rule`; there is never a `model` origin. | `forge.js` |
| 6 | Drift bands: RSOC 0.40/0.80 with n=max(1,ρ+1) vs. RMC Addendum 0.50/0.78/0.80 with ρ=max(1,depth) | RSOC (older) vs. RMC Implementation Addendum §3 (Sep 2026, newest) | **Addendum** bands and ρ are used. | `kmath.js`, CALIBRATION.md |
| 7 | Phase names: RSOC (5=Grace, 6=Naming…) vs. RPMC/RMC (5=Entropy, 6=Grace, 7=Naming, 8=Projection) | RSOC vs. RMC + Addendum | **RMC/Addendum** catalogue. Φ5→Φ8 is forbidden (Addendum §4). RSOC 4→8 is also kept as a forbidden edge. | `kmath.js` |
| 8 | χ(t) correction "authorizes" output (RSOC) vs. "correction re-routes, does not authorize" | RSOC §3.2 vs. Addendum §4 | **Addendum**: χ re-routes to Ĉ / clarification and never grants authority. | `kernel.js` |
| 9 | Echo as text similarity (older Echo docs: θ_echo_text = 0.85 over overlap) vs. user rule "no word-overlap similarity" | RMC §6.7; user instruction | Echo is a **structural MSM round-trip**. The rendered text is re-parsed by the same grammar, and its material meaning (subject, predicate, roles, lemma, polarity, modality, tense, condition) must be identical. θ = 0.85 applies only to the mean of binary component checks, and every material component is a hard gate. There is no token overlap anywhere. | `kernel.js echo` |
| 10 | MSM schema: Doc 2 (missing, inferred) vs. forge `meaning_structure_manifest` | forge `aiweb_language_core_bootstrap/meaning_structure_manifest` | The **forge MSM-v1** ids, preservation and non-selection vocabularies are used. The earlier inferred Doc-2 record is kept only as `trace.msm` (internal). | `forge_spine.js MSM_IDS`, `forge.js` |
| 11 | Gate outcome vocabulary: Doc 6 categories vs. forge evaluator states/eligibility | forge `verbal_cognition_gate_runtime/*` | **forge** evaluators, composition and eligibility (`eligible_for_selected_meaning_construction`, `clarification_dependent`, `materially_unresolved`, `held_pending_authority`, …) are used. Doc 6 categories stay as the kernel outcome class. | `forge_spine.js evaluate*`, `composeGates`, `determineEligibility` |
| 12 | Candidate scoring Score = αM+βP+γU+δN−λD (RMC §5.7, floats) vs. forge MEA fixed-point | RMC §5.7 vs. forge `rmc_engine_v1/mea/fixed_point_math_contract.py` | MEA fixed-point is used for the **evidence display**. RMC Score still ranks frames internally, and hard gates override both. Neither decides meaning on its own. | `forge.js` |
| 13 | Math phrasing: free templates vs. GP-014 operator-guided realizer | forge `symbolic_math_expression_lexicon_v1_gp014.json` | GP-014 families (differentiation, expansion, factoring, integration, simplification): meaning is locked first, then phrases are selected, and candidates that lose atoms or over-claim are severed. Arithmetic and solving are not GP-014 families, so they keep kernel templates. | `forge_spine.js gp014Realize` |
| 14 | Forge's LLM commands (`agents/forge/llm_authority.py`) and EchoForge | forge: EchoForge = the one model-enabled advisory command (`echoforge-advisory`); echo-forge repo: LLM debate agents **plus** a ToolManager (web search, fact-check, computation); user (2026-10-11): EchoForge is the kernel's **tool bench** | Commands with a deterministic replacement are answered by the kernel; other LLM commands are refused with `FORGE_LLM_AUTHORITY_REMOVED_USE_EXPLICIT_ECHOFORGE`. `echoforge-advisory` (the LLM lane) is refused with a derived reply. **EchoForge is enabled as a no-LLM tool bench**. It has 11 declared manifests (math, solve, units, define, memory query, inference, research, page capture, GitHub read, sim preview [not built], Gilligan patterns). Tools are invoked only by kernel-selected predicate frames, every call goes through the permission service, results return as evidence and never as authority, and every call is hash-chained. Switch D6 (`echoForge`: tool_bench / disabled). See FORGE_STUBS.md §3. | `toolbench.js`, `kernel.js` (tool authorization), `forge.js runTool`, `forge_spine.js LEGACY_LLM` |
| 15 | Delete semantics: "explicit delete on Memory screen" (earlier app) vs. Doc 7 cold storage + forge2 append-only successor laws | Doc 7; forge2 `APPEND_ONLY_SUCCESSOR_LAWS_V1` | Forgetting never erases. The record moves to Ĉ cold storage with a lifecycle successor (accepted→archived). This applies to both the chat "forget…" (after confirmation) and the RMC Memory tab. | `kernel.js write`, `deleteRecord` |
| 16 | Timestamps: local ISO vs. forge2 UTC microseconds | forge2 `canonical.py` | Contracts use **UTC microsecond** `…000Z`. The UI shows local time with a zone label. | `forge_spine.js utc` |
| 17 | Bridge 5 / ProtoForge execution | forge Bridges; ProtoForge needs PyBullet | Only Bridge 1 exact phrases are routed. The ProtoForge run gate (`RUN-PROTOFORGE`) is shown, but a run is **refused** because there is no physics backend on the phone. A plan is recorded as a proposal only. | `forge.js`, `app.js` |
| 18 | Past-tense homographs break Echo (saw/see vs. saw/saw; read/read) | Echo hard gates | The generator uses do-support ("did see", "did read") when the surface form would derive two tenses or lemmas (rules GEN-TENSE-DISAMBIG-DO, GEN-PAST-HOMOGRAPH-DO). | `grammar.js vpText` |

## v4.0.0 notes
- GP-014 (forge2) shipped phrase templates ("The derivative of {expression} is {answer}."). The user's directive forbids fill-in templates, so the templates were removed; the GP-014 operator roles (⧙ lock, ⧧ sever on lost atoms / overclaim) are now applied to the derived reply instead. The GP-014 tests check that check.
- Secrets matched by the redaction patterns are replaced with "sealed" even in places where they were not secrets, e.g. a 16-digit number that passes the Luhn check in an arithmetic question. This errs toward privacy over convenience.

## v4.2.0 conflicts (resolved by user decisions of 2026-10-11)

| # | Conflict | Sources | Resolution | Where |
|---|---|---|---|---|
| 19 | Page capture → Identity Vault | forge patch 256: captured pages go to `forge_browser_memory_v1`, **no Identity Vault write**; user (2026-10-11): crawled and user data are saved into the Identity Vault | User decision wins. Captures and research results are sealed in the vault (AES-GCM); outside it, the evidence index holds only hashes. Results are never memory and never truth. | `crawler.js`, `forge.js runTool` |
| 20 | Data marketplace | Register L-04 parks an *agent/service* marketplace post-1.0; the Memory Economy (Patch 300) is contribution accounting with every economic action disabled; no doc describes selling user data | Plumbing only: the Patch 300 ConsentScope fields plus buyers, offers, revocation and local packages. Sale, transfer and payment are hard-denied. Captures (third-party content) are not offerable. Legal flags are in LEGAL_DATA_MARKETPLACE.md. | `consent.js`, `legal_flags.js` |
| 21 | Crawler identity | forge research_acquisition.py sends an identifying `User-Agent` and `Accept-Language`; user: tracker-free, no fingerprintable headers | The mobile port sends no headers object at all and omits credentials, referrer and cache. A browser always adds its own UA; only a user-owned node or proxy path can strip that (documented). | `crawler.js` |

## v4.3.0 findings (open, documented — not resolved by guessing)
- **RMC gate thresholds differ between sources.** forge `rmc_engine_v1/coherence_math.py::gate_thresholds()` returns ε-warning 0.35, ε-collapse 0.72, echo-min 0.72 (verified by running the file in-browser under Pyodide, v4.3 Python cross-check). The app uses the RMC Addendum bands 0.50 / 0.78 / 0.80. Both are shown side by side in EchoForge → Python cross-check; the app keeps the Addendum values until the user picks one (decision N1).
- **Harmonic Conductor root 144 Hz vs. RMC "432 Hz" references.** Sonification follows the Harmonic Conductor Studio doc (root 144 Hz; 432 and 1296 Hz are channels 3 and 9), so both references are satisfied; flagged only for awareness.
- **Home-node transport.** The app's CSP allows `https:` connections only, so a home node must serve TLS (forge_node.py does, with a self-signed cert the phone must trust once) — plain-http LAN nodes are refused by design.

## v4.4.0
- **Register L-02 (“cross-node memory exchange”) is parked post-1.0**, but the user asked for opt-in sync infrastructure (N2). Built, OFF by default; the registry marks L-02 Partial with that note.
- **Shared pairing secret across devices**: all devices paired to one home node share its key and replay counter (millisecond clock-based). Devices with badly skewed clocks can get 409 replies until the next tick; per-device keys would fix it (see decision N5).

## v4.5 (2026-10-11)
- **ProtoForge MVP drift monitor vs RMC ε_s**: the MVP `novelty` term flags every unseen payload (entropy ≥ 1 > 0.4). Ported faithfully. It is not used for routing (RMC ε_s still governs). See ADD_REMOVE_REVIEW R2 / decision N8.
- **ProtoForge DTW classifier normalises the series before matching**, so the documented exponential signature classifies as linear. This is source behaviour, kept and documented.
- **Collapse codes**: the Codex names the families AX/DR/PH/CH/SPC/ψ but numbers only C:PH-301. The app emits family-only codes for the others.
- **N5 vs Doc 11 sync**: node sync namespaces are per vault user. Two devices of the same vault user share one namespace; different vault users never see each other's bundles.

## v4.6.0
- **Request transitions.** Bible §7.4 lists 25 states but no edge table, and forge2 records `transition_policy_defined = false`. The app permits only what is stated: next state, a recorded skip, or cancel. Every other move is refused as REQ-TRANSITION-UNSPECIFIED and logged in `request_policy_gaps`.
- **EDE numbers.** The RMC gives the thresholds only as worked examples (0.15/0.75/0.35) and allows "rules, symbolic operators, graph search". The distance metric and D_score values are implementation choices, listed in the ede.js header.
- **PyBullet vs cannon-es.** Same gravity and step size, but a different solver, so results are labelled "3-D PREVIEW (cannon-es) — not a PyBullet result". URDF joints and meshes are not mapped.

## Memory Economy (v4.7.0)
- Doc mints CT "after validation" by Stewards/phase validation. v4.8.3 (user decision 2026-10-12): review-accept records a ContributionEventCandidate only. A separate BreathValidation event, by a local reviewer who is not a contributor and must give evidence, is required before a capsule is finalized. The local reviewer is NOT a Memory Steward; the doc's Steward role is not implemented. Difficulty defaults to Light and the reviewer may raise it. Fork half-credit (×½ to the original) is a provisional Forge Mobile policy interpretation.
- Unresolved: the doc does not define how a later collaborator differs from multiple first-breath co-creators. The app treats co-creators named in the signed body as direct (×1) and later co-signers as collaborative (×⅓).
- Doc ties CT to Memory Capsules and payment_reference/investment ledgers; payments and investment are excluded (M5 count-only). Patch 300 keeps economic_processing NOT_AUTHORIZED; mirrored.
- Doc has no per-use reward; usage/citation are recorded as counts only (decision E2).
- Fork credit: doc defines Indirect (½) as shaping without originating; used for an original creator of a forked tool. Interpretation, flagged.

- v4.8.4 (user decision 2026-10-12): the doc's co-creator ×1 is limited to first-breath co-creators named in the original author-signed body who co-sign that exact body before first publication; later co-signers get exactly 1/3. Foreign CT is never taken from a publisher's totals: the receiving device reconstructs it and counts zero for anything it cannot verify. The fork ancestor's ×½ stays a provisional Forge Mobile interpretation and counts zero on foreign devices until its signed lineage is resolved. The local reviewer is still not a Memory Steward.

## Core language/reasoning correction (candidate, 2026-10-12)

- **Unknown-token gate vs. compositional meaning.** The earlier mobile path treated any
  unrecognized token as a reason to stop the whole request. That is incompatible with
  the Language Core/RMC boundary: local unresolved material must be carried and judged
  for materiality after the surrounding propositions are derived. Ordinary indefinite
  pronouns are now shared closed-class forms, and non-material opaque objects no longer
  abort an otherwise interpretable argument. Material unknowns in governed commands
  still require clarification. See `src/grammar.js`, `src/reason.js`, and
  `verify/w19_suite.js`.
- **Language Core vs. RMC responsibility.** The Language Core derives and realizes
  symbolic meaning. RMC constructs competing conclusions, records proof edges and
  warrants, and selects the conclusion. The new reasoning slice follows that split;
  it is deliberately bounded to documented predicate families and is not represented
  as a general LLM or complete open-domain cognition system.

## v4.9.48 — AQ-1: a question is a read-only lookup request (user decision, 2026-10-16)
- **Decision (Nic):** asking a factual information question counts as the explicit request for a read-only public lookup. Forge must answer factual, weird or unexpected questions usefully instead of stopping at "I have no stored fact".
- **Rule:** when the parse shows a world information question (first token tagged WH, or an AUX/COP-initial yes/no question ending in "?") and no stored, shared GKS or private fact answers it (`recall_none`, empty `about`, `world_answer` undetermined, or an unknown-word / unparsed WH question), the kernel issues `research.web` with the question itself (rule `AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST`).
- **Authority bounds (understanding is not authorization):** read-only GET to the public MediaWiki API only; research switch (M4) must be `on_request`; vault must be unlocked (results are sealed there; locked ⇒ the facts-gap reply plus the one-line unlock step, nothing fetched); results are evidence only, never memory (`may_write_memory=false`).
- **Never triggers:** an undetermined turn-world question whose words are user-coined (unknown to the lexicon — the turn-world reasoner owns it), commands, memory writes, tool requests, greetings/no-frame non-questions, and personal questions (1st/2nd-person pronouns or possessives in the parse, a user/kernel subject, or a subject entity present in personal memory). "how do I …" is a method question and does qualify.
- The answer is rendered answer-first (`research_answer`): the excerpt, then the Wikipedia article it comes from, an optional second article, the sources checked, and the vault seal.

## v4.9.51 — trusted archives beyond Wikipedia (user decision, 2026-10-16)
- **No UNSUPPORTED_QUERY_STRUCTURE for questions.** A question that the world reasoner cannot decide is passed to the language core and then to AQ-1 (cited lookup). It is never a world-limitation reply. The cases covered are gerund subjects, "X of Y" predicates, comparatives ("more N than"; `M-THAN-ORTHO` corrects "then" to "than" after a comparative), passive "found guilty" with names or lowercase initials, and how + adjective. Unknown words count as coined only when the user's facts or the turn itself use them (`coined()`).
- **Archives** (`src/archives.js`). Each archive is free, needs no key, and was checked from a browser origin: `curl -H "Origin: https://example.org"` returned `Access-Control-Allow-Origin` on 2026-10-16. Authority rank follows EMN (evidence over consensus): primary authority 4 > peer-reviewed 3 > structured reference 2 > encyclopedia 1.

| Archive | Endpoint | Class (rank) | Domains | CORS |
|---|---|---|---|---|
| MedlinePlus (NLM) | clinicaltables.nlm.nih.gov ICD-10 → connect.medlineplus.gov JSON | primary (4) | medical | `*` |
| openFDA drug labels | api.fda.gov/drug/label.json | primary (4) | medical (drug) | `*` |
| eCFR | www.ecfr.gov/api/search/v1 | primary (4) | law, engineering | `*` |
| CourtListener | www.courtlistener.com/api/rest/v4/search | primary (4) | law | reflects origin |
| PubMed (NCBI E-utilities) | eutils.ncbi.nlm.nih.gov esearch/esummary | peer-reviewed (3) | medical, science | `*` |
| OpenAlex | api.openalex.org/works | peer-reviewed (3) | all | `*` |
| Crossref | api.crossref.org/works | peer-reviewed (3) | science, engineering, law | `*` |
| Wikidata | www.wikidata.org/w/api.php (origin=*) | structured (2) | all; P31/P279 class checks, property relations | `*` |
| Wikipedia | existing crawler.js | encyclopedia (1) | all | `*` |

Rejected: wsearch.nlm.nih.gov (no CORS) and govinfo (needs an API key).
- **Routing** uses parse and lexicon semantics, not keywords. The question's nominal terms are classified by WordNet hypernym closure (`INF.isA`) against the single-word anchors in `DOMAIN_ANCHORS` (kernel). Adjective and verb terms are classified through their derived nominal (guilty → guilt).
- **Relevance:** cited text is whole sentences of at most 320 characters, contains no elided fragments or name lists, and has the key terms within a 20-word window. If the full terms find nothing, only the nominal terms are searched (`A-NOMINAL-RETRY`).
- **Yes/No:** an answer is given only when a structural check decides it, or when a primary authority states it.
  - The structural checks are Wikidata P31/P279 class membership, or a property of B whose value is A, e.g. influenza P780 → cough.
  - A primary-authority statement must have all key terms within 12 words, and negation is detected.
  - Co-occurrence alone never produces a Yes.
  - Every answer names its source, archive and class. All evidence is sealed in the vault (`archive:<id>:<hash>`).
- **Plain statements** are acknowledged with a reporting verb derived from the clause (`ACK-SPEECH-ACT`): past tense gives "report", a modal gives "note", a first-person subject gives "mention", and a generic gives "state". This replaces the fixed "I understand that …". Not storing a statement without "remember" is unchanged.

## v4.9.52: answer-type fit, polarity verdicts, ranked contradictions (user decision, 2026-10-16)
- **Answer type (`ANS-TYPE`, kernel.lookupPlan)** comes from the parse:
  - who → person, when → date, where → place, why → cause
  - how + adjective / how many / how much → quantity
  - bare how → method
  - auxiliary-first → verdict
  - otherwise → definition

  The plan also carries the asked relation (the verb, or the degree adjective) and its object.
- **Fit (`ANS-FIT`, archives.assess):**
  - An excerpt leads only if it binds the answer type: a personal name, a year, a number with a unit, a causal connective, an instrumental phrase, or a polarity-bearing statement of the asked clause.
  - Source class breaks ties only among excerpts that fit.
  - If nothing fits, the reply says so ("No source stated a quantity." / "No source decided the question.") and gives the closest excerpt as an excerpt, not as an answer.
- **Wikidata values (`WD-VALUE`):** who/when/where/how-ADJ questions read a property value of the object's record.
  - The property comes from Wikidata's own property search on the asked verb (write → P50 author).
  - For a degree adjective it is the quantity claim whose label shares the adjective's root onset (deep ~ depth).
- **Polarity (`V-POLARITY`):**
  - Subject and asked predicate must be within one clause and 8 words.
  - Negation counts only in scope ("found not guilty" → No).
  - Lexical negators come from WordNet glosses ("pronounce not guilty" → acquit, exonerate, exculpate) and from un-/in-/non- adjectives.
  - Hedged or consensus clauses (should, may, believe, consensus, generally) give no verdict (EMN: consensus is not evidence).
- **Contradictions:** when the sources give Yes and No, both are reported with their class. The higher rank decides ("evidence over consensus: the primary authority source (rank 4) outranks the peer reviewed source (rank 3)"). Equal ranks leave the answer undetermined.
- **Legal routing (`A-PRIMARY-ALL`):** a primary-authority excerpt must carry every key term, so an unrelated CFR rule is no longer cited for "statute of limitations for fraud". CourtListener uses highlighted snippets.
  - Not connected: the US Code and state codes have no free, CORS-readable, keyless API (govinfo needs a key; uscode.house.gov and LII have no JSON API). These questions go to CourtListener, OpenAlex and Wikipedia.
- **Rate limits (`A-RATE`):** a 429 or 503 is retried after Retry-After, or after 0.5 s and then 1 s (3 attempts). Answers are cached per URL for 1 hour.
- **GELC-QTY:** the generator now uses number agreement ("1 zasuk", "2 zasuks"). Before, it wrote "1 zasuks" and expected that ungrammatical form back.

## v4.9.53: event dates, definitional negators, modal possibility, multi-event outcomes (user decision, 2026-10-16)
- **EVENT-DATE:** a year answers "when did O V" only if the asked event (V, its inflections, or its nominal "the fall of …") is the nearest event word to the year. The search looks first inside the year's own comma segment. A year attached to another verb ("On 9 November 2009, Berlin celebrated …") does not count.
- **NEG-ADVISE:** a safety predicate (its gloss names danger, risk or harm) is also negated by anything that makes a use inadvisable. The chain comes from definitions: contraindicate = "make a treatment inadvisable"; inadvisable = "not advisable"; advisable = "worthy of being recommended". So "Warfarin is contraindicated in pregnancy" → No to "is warfarin safe during pregnancy".
- **MODAL-POSSIBILITY:** for a verb predicate (cause …), a primary authority's "X may/can/could/might P Y" supports Yes to "can/does X P Y". Possibility modals block only definite (copular) claims. Opinion and consensus hedges (should, believe, feel, consensus, generally) block every verdict.
- **TITLE-NOT-EVIDENCE:** a title never decides a verdict; only the document text does.
- **PRON-TOPIC:** he/she/they/which/"this product" bind to the topic named by the title. The comparison ignores spaces, so a garbled title ("S tewart, M artha") still binds.
- **MULTI-EVENT:** a Yes and a No dated to different years are reported as separate events, with no single verdict. For example: 1995, no (acquitted); 2008, yes (convicted).
- **WD-RANK:** for "does A have more N than B", the rank chain is read from Wikidata: P3730 (next higher rank) and P3729 (next lower rank). If no chain is recorded, there is no verdict. No other free, keyless, CORS-readable source of offices or authority hierarchies was found.
- **Rate limits:**
  - Requests to one host are serialized with a 250 ms gap, and a 429 is retried up to 3 times (0.5 s, 1 s, 2 s).
  - If the entity API is rate-limited, the Wikidata class check falls back to one SPARQL ASK query (query.wikidata.org; CORS `*`, verified 2026-10-16).
  - crawler.js (Wikipedia) now follows the same 429/503 retry.

## v4.9.54: retrieval from canonical articles (user decision, 2026-10-16)
- **WP-ARTICLE:** the question's topic is resolved to its canonical Wikipedia article through the API (`list=search`, then `prop=extracts&explaintext=1&redirects=1`, `origin=*`).
  - A title counts only if its letters are contained in the question, so "oj simpson" matches "O. J. Simpson". Unqualified titles come before "(…)" variants.
  - The full article text is scanned sentence by sentence; for a why-question, the verb's own article is read too (rust → "Rust").
  - Each sentence carries the article's discourse year (the last year mentioned before it). This lets a biography give dated outcomes, e.g. 1995 acquittal and 2008 conviction.
  - Encyclopedia answers say "encyclopedia, a secondary source".
- **DIM-NOUN / DIM-PROP:** the degree adjective's attribute noun is the noun.attribute entry whose gloss shares the most content words with the adjective's gloss (tall → height). Wikidata property search on that noun, restricted to the record's own quantity claims, gives the value (Eiffel Tower → P2048 height, 324 metre).
- **AFFIRM:** verbs whose gloss is "<verb> P" (convict = "find or declare guilty") state P. Report verbs (pleaded, claimed, denied, argued, alleged, said) state a party's position, not a verdict.
- **Cause:** a causal connective answers "why" only after its effect ("rust forms when …"; not "because of … rust").
- **Definition:** a definition must mention every nominal argument of the question ("statute of limitations for fraud" → fraud).
- **CMP-TEXT:** an office comparison is read only from a sentence that names both offices and states a hierarchy relation between them (higher/above/over/supervises/oversees/appoints/reviews vs lower/below/under/subordinate/answerable). The order of the offices in the sentence decides the direction. Opinion or possibility wording gives no verdict, and neither does a missing sentence.
- **Wikimedia etiquette:** requests send `Api-User-Agent`, which Wikimedia's CORS policy allows. Without it, the entity API rate-limited the box.

## v4.9.55: answer quality over retrieved text (user decision, 2026-10-16)
- JURIS: legal questions default to the United States; an excerpt naming another polity (WordNet noun.location gloss of a sovereign kind, or an adj.pert over one) is set aside unless the question names that polity.
- ISA-COPULA: a class verdict needs "S is (a/an/the …) P" with no list connective (or/and/other/such as/including) or comma between; Wikidata P31/P279 is consulted first; list co-mention gives no verdict.
- CAUSE-CHAIN: a why-question reads the effect's article (rust → Rust) and the article named by its class statement ("Rusting is the common term for corrosion" → Corrosion); the effect-as-subject and the article's opening sentence rank first; the effect window before the connective is 14 words.
- CANON: among fitting excerpts, the generic article whose title is contained in the question leads a subtype article.
- EVENT-YEAR: a verdict is dated by the year nearest its verdict word; attributive years ("the 1994 murders") do not date it; an outcome dated only by the passage is dropped when the same outcome has a dated clause.
- Statute questions: a description must carry every argument in the excerpt itself (not the title); periods and "depends on / varies" sentences rank first.
- FDA-SINGLE: openFDA uses the single-ingredient label and boxed warning / warnings and precautions / medication guide sections; a verdict-bearing sentence is preferred.

## v4.9.56: symmetric relations, disjoint classes, event properties, stress fixes (user decision, 2026-10-16)
- Bundle budget raised to 1.345 MB raw / 406 kB gzip (soft-budget rule; user allowed a small raise, 2026-10-16).
- RECIP: a reciprocal verb (WordNet gloss "together / with others / each other / joined") holds in either argument order.
- META: a sentence about a document ("the article describes …") or a link is neither a verdict nor an answer.
- ISA-UNKNOWN: "is X a W" with W outside the lexicon keeps the copular frame. ISA-DISJOINT: with no class path, a subject class that is a sibling of the target (common P279 parent) or recorded different (P1889/P2738) gives No; P2868 (subject has role) is a first hop.
- COMING / EVENT-PROP: a coming-into-being verb (verb.creation sense, or finish / start to operate / set up / begin / signature gloss) dates by P1619 official opening, P571 inception, P580 start time.
- JURIS-TITLE: "<Entity> of <Country>" is read first when the question names a country; the country's own article is not an answer about an office in it; the foreign filter covers all non-scientific questions.
- METHOD-DEF: "A X is a … that uses/transfers/converts …" is the method answer.
- Verdict guards: recommendation/proposal verbs are report verbs; a possessor ("Henry VIII's sister") is not the subject; a hyphen compound ("rust-inhibiting") is not the predicate; hyphenated terms (half-life) match whole.
- AGENT: a who-question is answered by the passive of the asked verb on the asked object ("justices … are appointed by …").
- DEF: an article's own definition sentence ("X is a …") leads what-is and how-does answers; it may open with a name and dates (prose filter waived). Search hits whose redirect title is in the question count ("MRI").
- ISA-MOD: a modified class ("a ferromagnetic material") is the whole phrase. ISA-COCLASS: a direct class of the subject and the target that are instances of one metaclass, with no class path between them, give No.
- EVENT-KIND: a finish verb (gloss "to a finish", "start to operate") dates by P1619 opening, P729 service entry, then P571; a begin verb by P571 first. An exact Wikidata label beats a longer title; a typed value leads fitting evidence.
- ABSTRACT-WEAK: a verdict read only from paper abstracts (PubMed, OpenAlex, Crossref) is reported as "probably" and marked weak.
- EFFECT-LIST: "<X> (side) effects include … Y" answers "can X cause Y"; the effect nouns are the lexicon nouns glossed "a phenomenon that … is caused by". RECIP-NOM: the nominal of a reciprocal verb with both arguments ("the interaction of A and B") states the relation.
- POLITY-ADJUNCT: a polity after in/of/for is the jurisdiction, not the asked object. COP-NP: "who was the <NP>" is answered by a sentence stating "… was … the <NP>".
- CAUSE-WHAT: "what <V> X" with a causal verb (one with effect nouns) asks for the cause; the effect phrase names its article; the effect's own causal passive ("X is caused by / is due to / occurs as a result of") leads.
- NAMES2 / NOM-OF: a second proper name is an argument; a performed nominal of the predicate with an of-object ("launched an invasion of Russia") states it; planned or abandoned ones do not.

## v4.9.57: M0 guard rails — held-out set and mutation suite (build order Oct 18)
- HELDOUT: `verify/heldout/HELDOUT_DO_NOT_TUNE.json` (54 cases: made-up-word syllogisms, withholding, distractors, contradictions, negation, Suppose isolation, ambiguity, relation chains, verb frames, follow-ups). It is **never used for tuning**. Release test HELDOUT-EVAL proves no held-out sentence (4+ word window) and no held-out made-up word (≥30 checked) appears in shipped kernel code or comments; it reuses the w48 digest `norm` and word windows.
- MUTATION: `verify/mutation_suite.js` generates variants of 20 passing base cases with these operators: rename made-up words (3 seeds), synonym (first WordNet synset, closed class skipped), shuffled premises (Suppose kept in place), paraphrase (Every↔All, If-something→Every), word order (tag question, "As for X"), inserted negation (on the question, or on the fact → unknown), and contradiction (→ conflict).
- Scores are **reported, not required**. A suite fails the release only on a crash or on a regression against `verify/eval_baseline.json` (a case that passed at baseline now fails). Baseline at the 4.9.56 kernel: held-out 43/54, mutation 145/173 (word order 0/28 is the weakest). `node verify/record_eval_baseline.js "<note>"` re-records the baseline upward; history is kept.
- M1 (RMC chooses among route candidates) was **not shipped** in this version. A complete draft ran every route and selected by Echo → completeness → drift → simple score, with ties going to clarification. It produced 52 regressions because the specific routes (math, capability, directive, quantity) and the general language core propose *different* decisions on the same input, and the old chain encoded "the specific route wins". It also made the verifier 3× slower. Deciding between them needs a ruling (see BUILD_ORDER progress note); no weight was invented to force it.

## v4.9.58: M1 — RMC chooses among route candidates; specificity = apavāda over utsarga (decision made with Nic's delegated authority, 2026-10-18)
- FIRST-MATCH REMOVED. `evaluate()` is `rmcChoose(routeTable(...))`. Every route in the table (world.preflight, turn.reentry, capability.frame, gks.quantity, world.proof, math.gp014, directive.frame, language.core) runs in a sandbox (its own rules, gates, store writes and held state). Each route whose pattern applies proposes a candidate: answer, derivation, Echo result, drift ε_s, simple score, and the four RMC distances (recorded unweighted, `weights: null`). Only the winner's state is committed. The candidate list, each candidate's status and why, and the reason the winner won are kept in `trace.selection` (RMC-ROUTE-SELECTION/v2) and in the proof export.
- SELECTION ORDER (fixed, non-numeric, no weights): (gate) Echo failures are dropped; (gate) held selection, where a reply that completes Forge's own held question is the continuation (RSOC ⧧ hold ancestry, existing semantics); (1) proof completeness; (2) SPECIFICITY; (3) lower drift ε_s; (4) RMC §5.7 simple score at unit weights; (5) remaining ties between different decisions among routes of equal standing → clarification (`RMC-TIE-CLARIFY`, held for a "1"/"2" reply).
- SPECIFICITY is a static partial order declared in `ROUTE_SPEC`. It follows the Pāṇinian paribhāṣā "apavāda blocks utsarga": a special rule sets aside the general rule within its own domain. For rules of equal standing, A 1.4.2 *vipratiṣedhe paraṃ kāryam* would pick the later one; here such ties are not picked but go to clarification. Every route except language.core is specific, and each declares a precondition that is a strict subset of the inputs the general core reads. Specific routes do not outrank each other. A specific candidate outranks the core only when it passes Echo and its proof is complete for its claim (completeness ≥ 1). If it fails Echo or is incomplete (0), the core's candidate wins.
- PROOF COMPLETENESS (ordinal read from the candidate):
  - 2 checked: a complete world closure with replayed proofs; a world form Echo re-verifies independently (quantity check, or wh / why / conjunctive bindings each with a replayed proof); a verified computation; or cited evidence / premises.
  - 1 complete for its claim: a decision, refusal or the route's own clarification, with recorded rules. The typed INPUT_LIMIT refusal is also 1, because the measured length proves it.
  - 0 incomplete: no lawful candidate, an incomplete preservation, an incomplete world derivation, another world limitation, failed verification, or no recorded derivation.
- AGREEMENT: candidates with the same decision agree rather than tie. A decision is the meaning without its explanatory fields (reason, rule, detail, code, …). A decided value has a declared typed normal form: a world quantity computation and a unit conversion both decide "value v in unit u". Among agreeing candidates, the specific route supplies the derivation over the core. Between agreeing specific routes, the longer recorded derivation is used. This only chooses which wording reports the same decision.
- ADMISSIBILITY: an input over `R.LIMITS.MAX_INPUT_CHARS` is read by no route. This is a hard gate like Echo: only the typed INPUT_LIMIT refusal is proposed, and the other routes are recorded as not evaluated with that reason.
- SPEED (lazy, outcome-equivalent):
  - Specific routes run first. The general core is evaluated unless a specific candidate that passes Echo already outranks anything the core could propose (completeness 2, the maximum, or the held continuation). Then it is recorded as "not evaluated: outranked by specific route X".
  - Echo is checked in rank order, which is equivalent to filtering first, because no candidate below the first Echo-passing key class can be selected.
  - The winner's realization and Echo are reused by `process()` for the same meaning.
  - Verifier runtime is about 4m55s, against about 4m30s before.
- RELEASE TEST RMC-SELECT:
  - Static: evaluate is the selector one-liner; routeTable has no other caller; the route list equals ROUTE_IDS; language.core is the only general route.
  - Runtime: on every turn every route is evaluated or recorded with its reason, never silently skipped.
  - The winner is maximal under the keys among Echo-passing candidates, and specificity is never used for a core winner or an incomplete specific candidate.
  - Selection is in the trace and the proof export, and the proof re-verifies.
- No existing test was changed. The 52 regressions of the first draft, which had no specificity key, are fixed by this ruling. Those tests encoded "the specific route handles its own frame" (math refusals, capability and directive frames, unresolved-referent clarification, legacy-LLM refusals, case/notes/reminder state commands, GELC quantity and wh).
- Bundle budget raised to 1.360 MB raw / 415 kB gzip (soft-budget rule; the selector, its specificity table and the selection record add about 12 kB raw / 3.5 kB gzip; measured 1,357,860 raw; gzip 409,511 on the box but 411,207 on the CI runner, whose zlib compresses differently, so the gzip limit keeps a margin).

## v4.9.59: M2 — justifications + retraction (truth maintenance); rulings on 4.9.58 recorded (2026-10-18)
- RULING (a), 4.9.58 selector: when several SPECIFIC routes agree on the same answer, the one with the longer recorded derivation supplies the WORDING. This tie-break is accepted. It only picks wording among candidates with the same decision (same meaning without explanatory fields, or the same typed value). It never chooses between different answers; those still go to clarification.
- RULING (b), 4.9.58 selector: the held-question check is a GATE, not a ranking key. Order: Echo gate → held-selection gate (a reply that completes Forge's own held question is the continuation, RSOC ⧧ hold ancestry) → completeness → specificity → drift → score → tie = clarification. The code already ran in this order (`gates: ['echo', 'held_selection']` in the selection record); this entry documents it.
- RULING (c): the size budget stays soft, correctness first, with no trimming pass. 4.9.59 raises it to 1.390 MB raw / 425 kB gzip. The ledger module (justify.js ≈ 6.5 kB) and the kernel TMS wiring (≈ 18 kB raw, mostly the recording, sync and read-back code and its comments) are the growth. Measured 1,379,190 raw / 415,781 gzip on the box; the gzip limit keeps margin for the CI runner's zlib (about 1.7 kB worse than the box).
- LEDGER (src/justify.js, new; imports only sha256.js). A justification-based TMS (Doyle 1979 JTMS) that keeps every justification of an item (the ATMS habit of de Kleer 1986).
  - Items: answer conclusions (`concl:` + sha of the normalised conclusion text, so the same proposition reached in different turns accumulates justifications), staged and approved hypotheses (`hyp:` ids), and admitted rules (`adm:` ids).
  - A justification is data: exact premise ids with the premise text as recorded, rule ids, the kernel rules of the derivation, a summary of the RMC selection record (winner, reason, routes run, candidate statuses), and a replay recipe. Its id is `jus:` + sha256 of the canonical (item, sorted premise ids, sorted rule ids, recipe). It never depends on the clock.
  - Status is the least fixpoint, so circular support never keeps an item IN. An item is IN while at least one justification has every premise and rule IN. Governed items (hypotheses, admitted rules) are also gated by their own store status and are never reinstated automatically: they need a new approval. Conclusions are reinstated (with a "reinstated" receipt) when a premise comes back, for example by resurrection.
  - Withdrawal marks the item `withdrawn` and appends a FORGE-WITHDRAWAL-RECEIPT/v1. The receipt records the item, the cause (turn, input hash, memory ops, or the governed API), each justification with the premises that went out (id, new status, cold-storage reason, recorded text) and how many alternatives were checked. Its id is the sha of its content. Nothing is deleted and receipts are append-only.
- WHAT IS RECORDED (kernel `tmsRecord`, in finish(), only for an unblocked turn whose reply passed Echo and that carried no secret):
  - World answers (yes/no supported or refuted, and every wh binding). Premises are the stated sentences the checked proof used, with ids `src:<input-sha12>:source:N`, plus GKS shared premises by their `gks:` id. Rules are the world rule ids. The replay recipe is the premise sentences plus the question.
  - Stored-fact inferences (`inferred` yes). Premises are the cited `mem:` / `gks:` ids. Rules are the inference rule (INF-… / GELC-ADMITTED-RULE) plus the `adm:` id of every admitted rule the RuleProof used.
  - Recall and direct yes answers. Each cited fact is recorded as stated, so "how do you know?" can say "You stated …".
  - Hypotheses are recorded with their parent fact ids. Admitted rules are recorded with their hypothesis and the support facts of the admission proof.
  - Live lookups, refusals, held writes, sensitive facts and math are never recorded. The ledger stores no fact and nothing is ingested anywhere. It is case-scoped bookkeeping like the trace: `justifications` and `withdrawal_receipts` are in CASE_CATS and in the exported categories.
- WITHDRAWAL TRIGGERS. The fixpoint is recomputed at the end of every turn and after every governed API (withdrawRule, approveHypothesis, resurrect, commitHeld, releaseDream, Memory-screen delete).
  - Confirmed "forget X" / supersede / a Memory-screen delete takes a fact out.
  - "actually X is not Y" (or "… instead") that contradicts a stored fact now asks to replace it (MEM-CORRECTION-ACTUALLY → confirm_replace). Nothing is written until "yes"; before 4.9.59 it was acknowledged and not stored.
  - A bare "forget that / it / this" names the fact(s) the previous turn wrote or answered from (FR-FORGET-PREVIOUS-REFERENT) and still asks for confirmation. With nothing to name it stays FORGET_SCOPE.
  - A hypothesis that loses a parent fact is set `withdrawn` in its store and cannot be approved (HYP-WITHDRAWN). An admitted rule that loses its hypothesis or a support fact is set `withdrawn` (withdrawn_by: truth maintenance) with its invalidated proofs listed as in withdrawRule. Each governed withdrawal also writes a `tms.withdraw` containment receipt.
  - Fact turns still never read the hypothesis store (GELC-S0). Hypothesis status is read from the store only by the governed APIs, or when a withdrawal reaches a hypothesis.
- FOLLOW-UPS: new specific route `justify.followup`, precondition "a why / how-do-you-know / based-on follow-up about the previous answer or a named recorded conclusion".
  - The closed forms are why?, why is that / so, how do you know (that)?, how come, what is that based on, on what basis, and what makes you say that.
  - The named forms are "how do you know that <clause>", "why do you think that <clause>" and "what makes you think that <clause>"; the clause is matched to a recorded conclusion by normalised text.
  - The referent is the previous turn's recorded conclusion (follow-up turns keep it) or the named item.
  - The read-back uses the justification that is still IN, else the latest, and states only what is recorded: "I derived “C” from “p1” and “p2”. It uses N rules.", "You stated “C”.", "… I do not keep it." (withdrawn), or "I recorded no premise for my last answer."
  - Echo re-verifies independently: the quotes must be exactly the recorded conclusion and premises, the justification id must re-derive from its content, and the item status must match.
- REPLAY: `replayJustification(id)` re-derives every justification id from its content. A world justification is re-derived by the world reasoner from the recorded premise sentences alone, and the same conclusion must come back with the same status. Stored-fact justifications re-check that each premise (active or in cold storage) still reads as recorded.
- TESTS: new verify/tms_suite.js has 9 release tests: TMS-WITHDRAW ×3, TMS-MULTI, TMS-RECEIPT, TMS-WHY ×2, TMS-REPLAY, TMS-ISOLATION. No existing test was changed apart from the budget numbers. The command catalog was regenerated for FR.WHY.JUSTIFY.
- Guard-rail scores (reported, not tuned; the held-out file was not read): held-out 44/54 (was 43/54; the case that flipped is fol-05, the 'why' follow-up), mutation 145/173 (unchanged, same failing set).

## v4.9.60: M3 part 1 — durable world state + relation properties as data; M2 rulings recorded (2026-10-18)
- M2 RULINGS (Nic, accepted): a hypothesis rests on all its parent facts jointly; truth maintenance withdraws a learned rule automatically, with a receipt, and re-approval is required; "actually X is not Y" asks before replacing; the 1.390 MB / 425 kB soft budget raise is accepted. KNOWN ITEM (deferred): the ledger has no size cap or compaction yet.
- SPLIT: M3 ships in two green steps. 4.9.60 = durable world state + relation properties. 4.9.61 = evidence engine (lookup excerpts as evidence objects with source rank and support level).
- RELATION PROPERTIES ARE DATA (world_rules.js `RELATIONS`, frozen). Each row is { pred, phrase?, transitive?, symmetric?, inverse?, functional: 'subject' | 'object' }, with no numbers.
  - Transitive: inside, contain, in, within, part of, ancestor of, descendant of, before/after, above/below.
  - Symmetric: married to, next to, adjacent to, sibling of.
  - Inverse pairs: contains/inside, parent of/child of, ancestor of/descendant of, greater than/less than, before/after, above/below.
  - Functional: born in, capital of (one object per subject); mother of, father of (one subject per object).
  - Greater-than/less-than keep their existing comparative order rules, and the table adds only the inverse pair.
  - The grammar reads the declared phrases ("X is (a/an/the) <phrase> Y", "Is X <phrase> Y?") from the table. reason.js hard-codes no relation phrase, and a release test checks this.
- TURN WORLD. A sentence that uses a declared relation brings that relation's property rules into the world as explicit rules (form `relation_property`), sourced to that sentence, the same way comparatives bring their order rules.
  - A functional rule carries a guard `distinct(y, z)` under the unique-name assumption (different names are different things). Two different values therefore give conflicting proofs ("The proofs conflict"), and one value alone gives no conflict.
  - The rule is added once per committed / supposed scope. A "Suppose" duplicate of a stated sentence therefore never takes the rule out of the committed world.
  - "Suppose …" branches answer in the branch and never write durable state.
- DURABLE WORLD STATE (store `world_state`, schema FORGE-WORLD-STATE/v1, case-scoped). It is rebuilt from the user's active stored facts whenever memory changes, and only from them: the turn world, "Suppose", lookups and GKS never write here.
  - Entities carry the first provenance and all premise ids. Stated relations (binary atoms) and attributes (unary atoms) carry provenance {premise: mem id, turn, source: 'stored fact', text}.
  - Relations derived through the declared properties (closure capped at 400) are M2 ledger items (`rel:` + sha of the atom). They are justified by the memory premises plus the RELPROP-<PROPERTY>:<pred> rule ids, with a replay recipe that re-derives the atom from the recorded premises (tampering is detected).
  - When a premise goes out (forget, supersede, delete), truth maintenance withdraws every derived relation resting on it, with a receipt. `worldState()` lists withdrawn relations with their receipt rather than dropping them silently.
- STORED-FACT INFERENCE: a new stage INF-RELPROP runs after the existing inference stages (not as a new route, which would create route ties). It answers a stored-fact question about a declared relation with a checked RuleProof over the durable atoms, using property rules only.
  - The reply cites the stored facts and the number of rules ("Yes, I infer that Bob is married to Ann. You told me that Ann is married to Bob. I used 1 rule."). "why?" reads the chain back from the ledger.
  - A side fix: "I used N admitted rules" is now said only for real admitted rules (GELC-ADMITTED-RULE).
- FUNCTIONAL CONFLICT IN MEMORY: "remember that Ann was born in Rome" after "… born in Paris" raises MEM-CONFLICT-FUNCTIONAL-RELATION → confirm_replace. Nothing is written until "yes".
- FIXES FOUND BY THE VERIFIER:
  - world_rules.js now loads before reason.js in index.html (BROWSER-LOAD-ORDER).
  - worldIntegrity refuses a null rule instead of throwing.
  - Echo's world re-verification skips declared phrase predicates.
- NOT DONE / DECISIONS FOR NIC:
  - Unique-name assumption for functional relations.
  - No closed-world refutation: "Was Ann born in Rome?" with only "born in Paris" stays undetermined.
  - "less than" is not parsed as a comparative.
  - A coordinated "Suppose A and B." still ties between two readings (this behaviour predates 4.9.60).
- BUDGET (soft, correctness first, per ruling (c)): 4.9.60 measured 1,391,501 raw / 419,228 gzip on the box, about 1.5 kB over 1.390 MB raw. The budget is raised to 1.420 MB raw / 430 kB gzip, with headroom for the 4.9.61 evidence engine and the CI runner's zlib (about 1.7 kB worse). There was no trimming pass.
- TESTS: the new verify/world_state_suite.js has 9 release tests: WS-PERSIST, WS-RETRACT, WS-SUPPOSE, WS-TRANSITIVE, WS-SYMMETRIC, WS-INVERSE, WS-FUNCTIONAL, WS-WHY and WS-DATA. No existing test was changed apart from the budget numbers.

## v4.9.61: rulings on the 4.9.60 decisions (Nic, 2026-10-18); the evidence engine follows as 4.9.62
- RULING 1, functional conflict. Two values of a functional relation conflict ONLY when they are APART:
  - they are different names;
  - neither is known to contain or be inside the other through the declared containment rows (inside / contain / in / within / part of: a `containment: inner | outer` flag on the row), transitively and in either direction;
  - they are not declared aliases (new row `alias_of`, phrases "also called" / "also known as", symmetric + transitive, `alias: true`).
  - `world_rules.js apartness(atoms)` computes this from the STATED atoms only. That keeps it stratified: functional rules never conclude containment or alias atoms, so the engine and the proof checker decide alike. Functional rules now carry the guard `apart(y, z)` instead of `distinct(y, z)`.
  - Born in Paris + Paris is in France + born in France is consistent. Siblings under one container (Paris, Lyon in France) are apart.
  - In memory, MEM-CONFLICT-FUNCTIONAL-RELATION asks only for an apart value. When containment is NOT known (born in Paris, then born in France, with no "Paris is in France" stored), it still asks. Nothing is assumed about places.
- RULING 2, functional "No". New stage INF-FUNCTIONAL-NO. A yes/no question about a functional relation answers "No" when a stored value for the same subject (object, for mother of / father of) is apart from the asked one.
  - The reply states the premise and the row's one-value reason (data: `one: { who, has }`): "No. You told me that Ann was born in Paris. A person has one birthplace."
  - The conclusion ("Ann was not born in Rome") is recorded in the ledger with the memory premise and the rule ids INF-FUNCTIONAL-NO + RELPROP-FUNCTIONAL:<pred>. "why?" reads it back, and forgetting the premise withdraws it with a receipt.
  - Everything else stays open-world: no stored value, a containing value, or a non-functional relation stays undetermined.
  - The realizer learned the nouns person, birthplace, mother, father, capital and country, and the determiner "one".
- RULING 3, comparatives from the data table. greater_than declares the comparative words greater / more / larger; less_than declares less / smaller / fewer; the two are an inverse pair.
  - In the turn world a declared inverse comparative also gets its order rules, so the inverse is answered, asymmetry refutes, and transitivity runs through the inverse.
  - The kernel grammar reads bare "more / less / fewer than NP" as a comparative (P-COMPARATIVE-BARE; "fewer" keeps its synthetic reading), so stored facts and questions using them work in memory.
  - Turn-world answer texts name the row predicate ("larger than" is rendered "greater than").
- RULING 4, a coordinated supposition. "Suppose A and B." with two full clauses is one assertion holding both clauses (one supposition set). It is tried only when the sentence as a whole is outside the grammar, every clause must parse on its own, and the integrity re-derivation uses the same function. The world candidate is now complete and selected, so there is no tie clarification. The same holds for a stated "A and B." Order-rule dedup is scoped per committed / supposed scope, like the relation-property rules.
- RULING 5: the ledger cap stays deferred. RULING 6: the 1.420 MB / 430 kB budget is accepted.
- TESTS: verify/world_state_suite.js gains WS-APART, WS-FUNC-NO, WS-COMPARATIVE and WS-SUPPOSE-AND, and WS-DATA checks the new row keys. No other test was changed.

## v4.9.62: M3 evidence engine (spec of the 11:54 M3 message, Nic, 2026-10-18)
- EVIDENCE OBJECTS (new `src/evidence.js`, pure: no store, network, memory or sync). Every excerpt that research assessed (the archives' ranked pool, or the archive + Wikipedia evidence when nothing was assessed) becomes `{ id 'evd:'+hash, schema FORGE-EVIDENCE/v1, question_sha256, claim { kind verdict|value, answer } | null, source { archive, name, title, url }, rank_class, excerpt_sha256, retrieved_at, evidence_only: true }`. The id is content-addressed. The object carries the excerpt HASH, not its text.
- VAULT ONLY. Each object is sealed with `vault.seal('evidence', …)`. Outside the vault the trace keeps only the support level name and the hashes that were already there. Nothing becomes a fact, memory, a ledger premise or shared knowledge. The kernel never imports evidence.js (or sb_sync.js). The research reply's refs are unchanged (one ref per job, as before).
- RANK ORDER (declared data): primary authority > peer reviewed > structured reference > Wikipedia (`RANK_ORDER`). Unranked sources count as encyclopedia.
- INDEPENDENCE: an encyclopedia or structured archive is ONE witness per archive (two Wikipedia articles are one source). A primary authority or peer-reviewed document is one witness per document (archive + title).
- SUPPORT LEVELS, read from the objects alone (deterministic, order-independent):
  - none: no object states a verdict or a typed value. The reply says "No source decided the question." (Prose excerpts are quoted but decide nothing.)
  - single: one independent source decides. The answer is hedged "Probably yes." and the reply adds "1 source decided it."
  - corroborated: N ≥ 2 independent sources agree: "N independent ranked sources agree."
  - conflicting: the reply says "The sources disagree." and gives each side with its sources and rank ("“FDA” (primary authority) states “no”."). The side with the unique highest rank decides, and the answer is that side's. If the top rank is shared, the yes/no answer is withdrawn and the reply says "No source decided the question."
- EVIDENCE COUNTS OVER MAJORITY: only the rank order is compared, never the number of sources per side. One primary-authority "No" beats three lower-ranked "Yes"; three peer-reviewed against one peer-reviewed stays undetermined.
- LANGUAGE: the realizer gained the verbs agree / disagree, the adjective ranked, and a hedged particle sentence ("Probably yes.", `hedge` on the sentence plan). The inward parse reads the hedge back, so Echo binds it: "Yes." does not verify against a hedged meaning. This also makes the existing abstracts-only weak verdict ("probably yes") lawful. It had the same latent Echo failure.
- REPLY CHANGE: every research answer now ends with its support sentence, placed before "I checked N sources", so existing prefix tests are unchanged. No existing test was edited.
- TESTS: new `verify/evidence_suite.js` (9: object shape/hash, rank order, the four levels, evidence over majority, independence, determinism, reply + Echo for every level including a negative hedge check, firewall). `verify/w34_suite.js` gains 3 EVIDENCE integration tests on the mocked web: sealed objects revealed from the vault; memory / fact / shared stores unchanged and no evidence text outside the vault; the kernel never imports evidence.js or sb_sync.js.

## v4.9.63: rulings on the 4.9.62 decisions (Nic, 2026-10-18)
- RULING 1, the support sentence describes the support for the EXTRACTED answer (the answer-type-fitted value or verdict):
  - `archives.extract(e, plan)` gives each excerpt's claim:
    - a yes/no question: the verdict;
    - otherwise only a FITTED excerpt answers: a typed value, the event year (dates agree at the year), a number with its unit, or a personal name;
    - a fitted description / method / cause is a "passage". Passages are never compared, so they neither corroborate nor conflict. The new level `answered` reads "N independent ranked sources answered it." / "1 source answered it.";
    - an unfitted excerpt is related text and answers nothing.
  - A single source of a value reads "1 source gave it." ("1 source decided it." stays for a verdict).
  - When no excerpt fits a wh/value question, the reply says "I found related passages. But no passage answered the question directly." and quotes the best passage as "The best related passage is …", not "The answer is". The realizer has no clause coordination, so Nic's one sentence is said as two; the meaning is the same.
  - A yes/no question without a verdict keeps "No source decided the question."
  - A support level is stated only when the answer type was assessed (archives.assess ran); otherwise none is stamped.
- RULING 2: unknown containment still asks before replacing (unchanged).
- RULING 3: turn-world comparative answers use the user's own word. `reason.js surfaceOf` takes the question's word first, else the first used: "ola is not larger than quo". The row predicate stays the atom, and Echo re-reads the word to the same row.
- RULING 4: stored comparatives get the turn world's order rules as data. `world_rules.js orderRules` adds transitive + asymmetric rules for every comparative row (and its inverse) to the durable-world data rules.
  - New stage INF-ORDER-NO: a checked RuleProof of the negated goal from stored facts. The reply is "No. You told me that Quo is taller than Ola. I used 1 rule."
  - The conclusion is a ledger item: "why?" reads it, and forgetting a premise withdraws it. The durable world also lists the asymmetric consequences as derived relations.
  - Open-world elsewhere.
- RULING 5, root cause of "Quo is taller than Ola. Is Ola taller than Quo?" → "no quantity for ola":
  - The measured-quantity evaluator (`evaluateQty`) took every dimensional comparison (taller / longer / heavier / older …). Its fact reader only knows measurements, so the stated comparative was silently dropped, no world was built, and "integrity false" was the missing world root.
  - Fix (general): the quantity evaluator defers a comparison to the relational world when a measurement is missing and non-measurement premises are stated. Measurement-only premises still ask for the missing quantity.
  - The dimensional comparatives are now data rows with inverse pairs: taller/shorter, older/younger, heavier/lighter, wider/narrower, higher/lower, deeper/shallower.
  - "longer" has no declared inverse ("shorter" is taller's), so longer/shorter stays open-world and is never guessed.
  - Checked for every comparative (test WS-ASYM-REGRESSION).
- RULING 6: ledger cap deferred.
- TESTS:
  - world_state_suite: WS-ASYM-REGRESSION, WS-SURFACE, WS-ORDER-MEM.
  - evidence_suite: 3 ruling-1 tests (extract by answer type, answered level, reply wording).
  - w34_suite: 2 new ruling-1 integration tests. The 2 EVIDENCE tests of 4.9.62 that expected "none" for a fitted method passage now expect "answered" (the ruling changes that behaviour).
- Guard rails: held-out 48/54 (rel-01, rel-02, rel-04 newly pass; none lost), mutation 145/173 (same set).

## v4.9.64: M5, MEA manifest evolution (2026-10-18)

- **What a manifest is:** a small set of deltas over the shipped relation table in `src/world_rules.js`. Each delta is `{pred, prop, value}`, and only `transitive` and `symmetric` can change (`MEA_MUTABLE`). Comparative (`_than`), functional and alias rows are never mutable. That gives 34 mutable cells. The kernel re-applies its active manifest on every `process()` call. With no adoption, the overlay is null and the shipped rows hold.
- **How candidates are made:** they are proposals only, built from seeded, deterministic operators on top of the evolve.js tie-in (`src/mea.js`). FLIP toggles one cell. RECOMBINE takes cells only from its two parents. The rng is xorshift, the ids are content-addressed (`mea:` + sha256(canonical deltas)), and deltas equal to the shipped rows are dropped.
- **How fitness is judged:** at build time, `tools/mea_eval.js` runs the verifier's own suites with the manifest active: held-out, mutation (results + base results) and world-state. It also counts Echo passes. `src/mea_data.js` ships counts only, with no case text or ids. A verify test re-judges the top proposal and checks that the counts match.
- **Ranking and drift (no weights):** proposals are ranked Pareto over (passed ↑, regressions ↓, Echo ↑, ε_s ↓), then lexicographically in that order, then by id. Drift is ε_s = (σ_res + D_score + 0)/3, where σ_res = the share of judged cases whose outcome changed and D_score = changed cells / 34. Bands follow the 0.35/0.72 ruling through `kmath.driftGovernance`. A proposal is **approvable** only with 0 regressions and ε_s ≤ 0.35. The explore band (0.4–0.8) is shadow-only, the correct band is held, and anything else is rejected.
- **Adoption and withdrawal:** adoption needs the user's tap (`hypothesis.write` perm + tap; refusals: PERM-NEEDS-USER-TAP, MEA-NOT-APPROVABLE). Each adoption becomes an M2 ledger item (`kind: rule`, premise `mea-adopt:<id>`, rule MEA-ADOPT, replay = deltas + fitness) with receipt `manifest.adopt` (sha256 of the canonical record). A new adoption supersedes the previous one. Inferences that use an adopted property cite `RELPROP-TRANSITIVE|SYMMETRIC:<pred>`, which is IN only while the active rows declare it. Withdrawing therefore restores the shipped rows and withdraws both the item and every conclusion that used it, with a receipt for each (`manifest.withdraw`).
- **UI:** a "Manifest evolution — proposals" card in Memory shows, for each proposal: text, op, passed/cases, regressions, Echo, ε_s and band, route, Pareto flag and status. It has an Adopt button (approvable only, after a confirm) and a Withdraw button (adopted only).
- **Decisions for Nic:**
  1. "make next to transitive" (and "unmake contain transitive") are approvable only because no suite case covers them. Passing every test is not semantic evidence, which is why adoption needs a tap. Should the suites gain coverage of relation-property semantics?
  2. Small manifests have a tiny ε_s, so the shadow/explore band is effectively unreachable with seed 1 / n 8. It is exercised only in a synthetic test.
  3. Only `transitive` and `symmetric` can change. Frames and parser rules are not yet manifest data.
  4. Proposals are precomputed at build time (about 2.5 min of suite runs). The app does not re-judge on the device.
- **Budget:** under Nic's standing ruling ("size is never a blocker; functionality first"), the M5 UI + `mea.js` + `mea_data.js` take the single-file app to 1,424,597 raw / 427,774 gzip. The budget is raised from 1.420 MB / 430 kB to **1.460 MB raw / 445 kB gzip** (`tools/verify_release.js`, `verify/w5_suite.js`).

## v4.9.65: MEA build-plan step 0, the M5 defect fix (2026-10-18)

- **4.9.64's MEA fitness scores were invalid.** `tools/mea_preload.js` installed each candidate manifest once. The kernel re-applies its own adopted manifest (none) at the start of every `process()` call, so the first call put the shipped rows back. Every proposal was therefore scored on the shipped rows: the "approvable" routes and the counts in 4.9.64's `mea_data.js` measured nothing about the candidates. Nothing was adopted (adoption needs a tap). The v4.9.64 section's decision 1 ("approvable because no suite covers it") is superseded: the real cause was this defect plus missing guard coverage.
- **Evaluator fix:** the preload installs the candidate *under* the kernel's per-call reset. With no adoption, the candidate stays active. A test runs a destructive manifest (next to made transitive) through the guard suite and asserts the guard sees it.
- **Guard suite:** `verify/relprop_guard_suite.js` has one case per mutable cell, written from what the words mean, not from the shipped table or the held-out file, plus a coverage check. Transitive relations must chain and the others must not; symmetric relations must reverse and the others must not. The evaluator judges every proposal on it as well (`g:` outcomes; only counts are shipped).
- **Ruling, inverse pairs:** inside/contain, before/after, above/below, ancestor/descendant and parent/child are each **one evolvable unit**. FLIP and RECOMBINE change both sides together. That gives 33 cells in 23 units.
- **Legality gate (hard, not a weight):**
  - inverse partners must agree on transitivity and on symmetry;
  - a relation with a distinct inverse cannot be symmetric, since symmetry makes a relation its own inverse;
  - an immutable cell cannot change.
  An illegal proposal is rejected, and `adoptManifest` refuses it (MEA-ILLEGAL). This closes the contain/inside gap: in 4.9.64 a one-sided "unmake contain transitive" was invisible because "inside" still chained.
- **Ruling, sibling_of:** sibling_of stays non-transitive (half-siblings), and its transitivity is **not a mutable cell** (`MEA.IMMUTABLE`, with the reason recorded).
- **No-evidence route:** a legal proposal under which no evaluated case changes outcome is routed `no_evidence` and is never approvable. Passing tests is not evidence.
- **Integer drift:** drift is stored as integer micro-units (`eps_s_micro`, `sigma_res_micro`, `D_score_micro`, `dPhi_micro`), computed exactly from the counts with floor. The band comes from `kmath.driftGovernance`.
- **Lineage:** each proposal records generation, operator, parents, seed and the xorshift state right before its operator ran. `MEA.replay` reproduces its deltas from that record (tested).
- **Regenerated proposals:** `mea_data.js` (seed 1, n 8) is regenerated with all of the above. None is approvable; the outcome of each is in the release report.
- **M4 stays parked:** the dynamics work (causal rows, what-if, rates, reports, adverb scope) remains on local branch m4-wip and was **not** shipped. It will be renumbered later.
- **Still open for Nic:** frames, lexicon classes and parser rules are not yet evolvable. Until they are (MEA_SPEC §e step 6), every relation-property proposal against a semantically correct table should be rejected, and that is the expected result.

## v4.9.66: K1 drift unification and the memory-write rule (2026-10-18)

- **One drift threshold table (Nic's drift ruling), used by every path.** `kmath.DRIFT_TABLE` holds the table. `driftFunctional` (turn band), `driftGovernance` (learned objects, MEA, EDE, evolve), `turnGovernance` (the kernel turn gate), containment and the drift export all read it. The edges are applied to raw ε_s with no rounding.

  | ε_s | turn band | governance | effect |
  |---|---|---|---|
  | ≤ 0.35 | clean | projectable | may project; may be approved; the **only** band that may write memory or admit a working fact |
  | 0.35 < ε_s < 0.40 | correct | correct | χ correction step on the turn SFE (ε ← ε(1 − Θ/μ), RSOC §3.2.1), recorded as `trace.correction`; **nothing is written**; a turn that would have written is withheld (DRIFT-CORRECT-NO-WRITE) rather than claim a write; a non-writing turn projects only if the corrected ε_s ≤ 0.35, otherwise it is quarantined |
  | 0.40 ≤ ε_s ≤ 0.80 | elevated | explore | quarantine-only exploration: drift archive, never written, never projected (DRIFT-EXPLORE-QUARANTINE) |
  | > 0.80 | hard_stop | reject | hard stop (χ grace or Ĉ archival, as before) |

  A **forbidden phase transition** is a separate yes/no gate (`kmath.isForbidden`). It blocks at any ε_s, including 0.1, and the block reason names the transition.
- **Superseded:** the RMC Implementation Addendum coherence bands 0.50 / 0.78 (warning / intervention). The dead `intervention` and `bounded` bands are removed. Addendum `echo_min` 0.80 still gates Echo. forge `coherence_math` 0.72 is exported in `thresholds.json` as `reference_only` and gates nothing.
- **Probe result:** no kernel turn in the suites has ε_s in 0.35–0.80. Normal turns are ≤ 0.35 and forbidden-bypass turns are 1.22–1.37. So the new middle bands are exercised by the verify-only `opts.testDrift` pin, which the app never sets. The derivation realizer's own display drift (8→9, about 0.37–0.39) is now labelled `correct`. It is display-only and gates nothing.
- **Memory-write rule (general pipeline change, inside the drift gate):**
  1. A plain statement ("my bike is green") becomes a **working fact** for this conversation (`wf:` id; not stored). It is checked against stored and working facts, and it answers questions with `wf:` evidence.
  2. **Lasting memory only** on an explicit "remember …" (promotes the working twin) or a confirm tap (`promoteWorking(id, true)`, which refuses a working fact that contradicts a stored one).
  3. **On a contradiction**, with a stored fact or a working fact, the kernel asks before changing either (MEM-WORKING-CONTRADICTION-ASK). "No" keeps everything. "Yes" replaces the stored fact (an explicit confirmation) or only the working fact.
  4. **M2:** a conclusion that used a working fact records the `wf:` premise. Forgetting the working fact withdraws the conclusion (receipt). Promoting it keeps the conclusion IN.
  5. A working fact is admitted only when the turn may write memory (MEM-WORKING-DRIFT-GATED otherwise).
- **Changed expectations (old policy only):** `test/kernel.test.js` "drift bands follow the RMC Implementation Addendum thresholds" encoded the superseded 0.50/0.78 bands. It now asserts the ruling table. No other suite expectation changed.
- **Naming:** the lexicon entry for χ no longer uses the old alias name. χ is the "correction function" everywhere in code.
- **Paper contradictions recorded, not resolved (MEA_SPEC §f.3):**
  - P1 ⟁ averages μ, but RSOC/kmath sums it.
  - P1 §6.1 allows Φ ± 1, but RPMC is forward-only with a 9→1 wrap.
  - σ_res is a linear standard deviation over a cyclic phase.
  - The papers contain no numeric weights; RSOC constants stay "in use, unablated".
- **Known limits:**
  - Location "in" is not functional, so "Rex is in Paris" then "Rex is in London" is not a contradiction (containment by design).
  - The forget-confirm question for a working fact still says "move it to cold storage".

## v4.9.67: Nic's rulings on the 4.9.66 open questions (2026-10-18, 4:18 PM)

1. **Phase direction (ruling 1).**
   - Committed meanings move forward only (RPMC). 9→1 is the lawful closure step, not a step back.
   - A Φ−1 step back is lawful only inside quarantine exploration (MEA / drift archive; it never touches memory).
   - `kmath.phaseStep` / `phaseLaw` enforce this. A backward committed step is a forbidden transition, so it blocks at any ε_s.
   - Every turn records `trace.phase_law`.
   - P1 §6.1's "±1" is superseded for committed paths.
   - Forward skips other than Φ4/Φ5→Φ8 are not ruled on and remain allowed as before.
2. **σ_res is circular (ruling 2).**
   - It is Mardia's angular deviation √(2(1−R̄)) over θ = 2π(Φ−1)/9, divided by 2π. For a tight cluster this equals the old linear std of Φ/9, so the thresholds keep their scale.
   - Φ9 and Φ1 are now adjacent: the spread of (9,1) equals the spread of (1,2).
   - Turn drift is unchanged in practice, because turn terminal phases are all Φ9.
3. **Location "in" is functional at one containment level (ruling 3).**
   - Row `in`: functional 'subject'.
   - "Rex is in Paris" then "Rex is in London" is asked as a contradiction, for working facts and for "remember".
   - "Paris is in France" makes Paris and France not apart, so "Rex is in France" is not a contradiction.
   - Because the level of an unstated place is unknown (Europe may contain Paris), a containment row never derives a "no" by itself. `funcRefute` skips it, and the reasoner adds no refutation rule for it. "Is Rex in London?" therefore stays "I cannot confirm that".
   - This also keeps "If something is in B then it is in C" lawful (GELC-GRAMMAR).
4. **Correction band (ruling 4).**
   - 0.35 < ε_s < 0.40 runs the canonical χ step, then ε_s is re-measured against the one table.
   - The turn projects and writes only if the re-measured ε_s ≤ 0.35; otherwise it is held (quarantine, drift archive).
   - This replaces 4.9.66's DRIFT-CORRECT-NO-WRITE.
5. **Canonical χ (ruling 5): `kmath.chiCorrect`.**
   - Built from RPMC's contract (once per ψ, over phase-aligned ancestors, restore toward ψ₁) and RSOC's grace kernel.
   - The aligned ancestors are the conversation's earlier turns whose phase is within π/4 of Φ₁ (Φ9/Φ1/Φ2). π/4 is RSOC's own ⟁ alignment tolerance, so no new constant is introduced.
   - Θ̂ = Σ(1−ε/ε_max)·cos²(Φ−Φ₁)·μ / Σμ ∈ [0,1).
   - ε′ = max(ε(1−Θ̂), ε̄_A).
   - Not applied when there is no aligned ancestor, when χ was already applied for this ψ, or when the correction is not lower (App B.12: the corrected drift must fall, otherwise archive).
   - **Root cause of the 4.9.66 collapse:** the old ε(1−Θ/μ) divided a sum over the whole trace by one μ. That gave Θ/μ ≈ 2.35, and ε 0.36 became 0.
   - The RSOC hard-stop route (`applyChi`) now uses the same normalisation, Θ̂ = Θ/(μ·|τ|).
   - Tests cover: bounded (never 0 from a positive drift, never below the ancestors' mean), once per ψ, misaligned ancestors give no grace, a non-lowering correction is not applied, and the result is invariant to μ scale and to repeated ancestry.
   - A fresh conversation has no ancestors, so a 0.36 turn is held. After clean turns, the same turn corrects to 0.1487 and projects.
6. **⟁ average vs sum (ruling 5).**
   - Kept the RSOC **sum** for μ and the **average** for ε.
   - Why: μ is extensive (memory charge, conserved: P1 §6.2, RSOC §2) and ε is intensive (a coefficient).
   - The sum is associative, so the order in which a fact is reinforced cannot change its μ. It is also homogeneous: scaling every μ scales the result.
   - The P1 average is not associative, so μ would depend on merge order, and it destroys conserved charge.
   - Every consumer of μ now uses ratios: the canonical χ normalises by Σμ, and rpmWeight is display-only. So behaviour is scale-invariant.
   - The kernel test "repeat merges μ > 2" stays as it is.
7. **RSOC↔RMC phase map (ruling 6): `kmath.PHASE_MAP_RSOC_TO_RMC`, marked RECONSTRUCTION.**
   - The map is 1→1, 2→2, 3→3, 4→4, 5 Grace→{5,6}, 6 Naming→7, 7 Harmony→{7,8}, 8 Completion→8, 9 Seeding→9.
   - Anchors:
     - ψ_id is fixed at Φ1 in both;
     - RSOC's fracture–grace–naming (4–5–6) corresponds to RMC Friction → Entropy+Grace → Naming;
     - the ⧙ lock happens at Naming;
     - RSOC's forbidden ascent 3/4→8 corresponds to RMC's forbidden Φ4/Φ5→Φ8;
     - Seeding corresponds to the 9→1 closure.
8. **Canonical problems (ruling 7).** 144 Hz, the limiting-reagent problem and the inheritance problem are adopted (`data/canonical_problems.json`).
   - Their exact sub-results come from the kernel's exact lane and are tested: 144/90 = 1.6; 16·9 = 144; the O₂ threshold 2000/63 g; H₂O 4505/126 g; 18.02 g; (1/2)^6.
   - The epistemic outcomes are the MEA-P acceptance target. They are pending until MEA-P exists, and none is ever verified_claim without data.
9. **Working-fact forget wording (ruling 8).** "Should I forget it?" replaces "Should I move it to cold storage?" for working facts. Stored facts keep the cold-storage wording, which is correct for them.
- **MEA proposals regenerated** (`tools/mea_eval.js 1 8`) because the relation rows changed. All 8 are rejected.
- **Changed expectations:** the K1 0.36 test now asserts re-measurement: held with no grace; projects and writes after clean turns. No other expectation changed.

## v4.9.68: hotfix for the red 4.9.67 deploy (2026-10-18)

- The 4.9.67 merge built and tested locally, but the CI deploy failed on GELC-LANG2 with random seed 1358217271.
  "Zezasan is a raves" produced two parse readings with identical descriptions (lemma `raf` via -ves→-f, and lemma `rave`).
  This was pre-existing: it reproduces on 843da7d (4.9.66). The random-seed lexicon only happened to hit it now.
- General fix 1 (M-VES-APAVADA, src/grammar.js `lemmatize0`): the -ves→-f/-fe plural reading is dropped when the word
  minus its final "s" is itself a noun (raves→rave, not raf). Genuine -ves plurals with no such noun (calves, wolves) are unchanged.
- General fix 2 (`readingsOf`, src/kernel.js): when two readings of an ambiguous sentence still describe identically, each is
  suffixed with its head lemma, so an ambiguity question never offers two indistinguishable choices.
  Example: "the leaves are green" no longer lists duplicate readings.
- Test: verify/rulings467_suite.js case 9 (raves, calves, leaves). Checked locally across 10 GELC seeds, including 1358217271: 31/31 on each.
- No answer patches. Held-out set not read.

## v4.9.69: build-plan step 2, K3 (MSM-v1 manifests) + K4 (App D projection manifest) (2026-10-18)

- **K3 (src/msm.js, new; KERNEL_COMPONENTS_SPEC §4, Appendix R).** Doc 2 was never located, so this is a reconstruction from forge Slices 35A–35E.
  - The lifecycle law: exactly 31 lawful (from → to) rules, each with its transition kinds and an authority flag. Only lineage_origin → candidate_meaning is authority-free.
  - Records are append-only and frozen. Each lawful step appends one SemanticTransitionTrace. Correction and supersession must be same-kind, same-state, substantive successors.
  - Issue codes: illegal_transition, illegal_transition_kind, authority_required, duplicate_record_id, unresolved_reference, record_kind_mismatch.
  - Canonical serialization uses one versioned envelope (aiweb-forge-msm-envelope v1) and strict canonical JSON: sorted keys, no whitespace, NFC, integers only.
    Bytes are validated before encoding and after decoding. Non-canonical bytes, unknown fields and unknown versions are rejected. The byte-for-byte round trip is tested.
  - The 13th preservation class, `action_proposal_simulation_and_observation`, is added (forge_spine.PRESERVATION is shared).
  - Every finished turn builds its manifest through the law: LineageRoot → CandidateMeaning(s) → SelectedGovernedMeaning or NonSelectionOutcome → GovernedOutwardMeaning →
    ExpressionLink → ValidationLink (Echo PASSED) → delivery, or containment (Echo REJECTED/CONTAINED, sealed, quarantine). The manifest is validated by the 35B validator port.
    trace.msm_v1 keeps the id, sha256, path and preservation classes. The full manifest is returned on the turn result but not persisted per turn, to keep storage bounded.
  - Bug found by the new tests and fixed: the non-substantive-successor check compared lineage_id, so an identical correction was accepted.
- **K4 (μ_t, RMC App D; §5 R-MAN-1..4).** Every turn's trace.output_manifest carries all App D minimum fields: schema_version 1.0.0 (semver), source_trace_id,
  msm_ref, input_summary (hash only, never the raw text), selected_conclusion, claim.{required_limitations, forbidden_claims = GP-014 forbidden fragments}, phase_path, operator_path,
  memory_links (source μ/ε unchanged, D.4 rule 9), confidence_bps, drift_score/status, novelty_score (null until K5), projection_status, render_targets,
  validation_requirements (echo_threshold = "structural_identity" per CONFLICTS #9), visibility, created_at.
  - projection_status is set by drift first, then by the turn's own block: sealed, forbidden or hard_stop → catastrophic_block; quarantine/elevated → archive_required;
    correction held → correction_required; blocked → projection_blocked; otherwise approved.
  - render_targets: all render forms when approved, only 'text' when the turn is sensitive/private, none when blocked.
  - confidence_bps = 10000 only for exact-lane derivations (GP014-*, ALG-*, CALC-* except CALC-NUMERIC/REFUSED). Otherwise null, with a basis saying no number is invented (no float confidence).
  - D.7 gate: every "render that as X" now passes MSM.validateProjection in the order schema → source trace → target ∈ render_targets → projection_status → visibility → drift status.
    A failure yields the new `render_blocked` meaning ("I did not render the turn … The check “target” failed."), with no artifact.
  - D.8 compatibility: a stored pre-4.9.69 trace has no μ_t and is never reconstructed into one (D.4 rule 1), so it cannot be re-rendered.
  - Decision taken: the reply of a refused or contained turn is the lawful outward explanation of a non-selection (MSM NSO → GOM rules). μ_t governs projection
    of the turn's meaning to render targets, so such a turn has render_targets = [] while its explanation text is still shown.
- Tests: verify/k34_msm_suite.js, 7 cases (K3-MSM, K4-MANIFEST). General pipeline changes only. No answer patches. Held-out set not read.
- Release fixes for 4.9.69:
  - forge_spine.js now loads before msm.js and kernel.js in index.html. It depends only on sha256.js, so the BROWSER-LOAD-ORDER law holds.
  - The single-file bundle budget is raised from 1.460 MB / 445 kB gzip to 1.560 MB / 475 kB gzip, per the user's ruling "size is never a blocker; functionality first". The K3/K4 code made the bundle 8 KB over the old limit.

## v4.9.70: build-plan step 2, K5 (distances vs relevant memory) + K6 (typed Echo) (2026-10-18)

- **K5 (§11 R-NOV-1..3).** Each checked candidate's four RMC distances are now measured against M_relevant, as RMC §6.4 defines (N(c) = dist(c, M_relevant)).
  They are no longer measured input-vs-output; the old fields measured how much of the question the answer repeated, which is not novelty.
  - M_relevant = active stored memory + active working facts that share a content term with the turn input or the candidate's surface.
  - d_struct = 1 − max Jaccard against M_relevant (the authoritative simple N). d_sem = 1 − the share of candidate terms found in M_relevant.
    d_op = 0 iff the candidate's operator (polarity + verb lemma, else meaning kind) occurs in M_relevant.
    d_phase = circular phase-index distance / 4, consistent with ruling 2 (Φ9 next to Φ1).
  - With no relevant memory all four are null and novelty is "no_relevant_memory" (N undefined, never 0).
  - Unweighted, never combined, never a selection key (D.4 rule 5: novelty ≠ approval).
  - Novelty classes use the RMC §8.3 worked values (N_min 0.15, N_max 0.75, θ 0.35); worked examples, not laws.
  - The selected candidate's novelty fills μ_t.novelty_score / novelty_class.
- **K6 (§6 R-ECHO-2..5; src/echo_types.js, new).** Echo results are now typed:
  - 13 MeaningPreservationDimension findings, the 17 DriftKinds with materiality, one of 5 classification states, and a disposition PASSED / REJECTED / CONTAINED with its custody record.
  - Typing reads structures only: the planned vākya vs the nearest inward analysis, and the Echo components. Raw text is never an input.
  - Structural identity (CONFLICTS #9) is still the only pass condition; typing never changes a verdict (tested).
  - The crosswalk from vākya keys / lemma families to dimensions and drift kinds is a RECONSTRUCTION. Forge 43D/43E name the kinds but not this mapping.
  - Every Echo, passing or failing, now creates an MSM ValidationLink with its disposition (R-ECHO-5). A failed Echo's surface is linked and contained, never delivered.
- Tests: verify/k56_suite.js, 7 cases (K5-DISTANCES, K6-ECHO), with one fixture per drift kind. k34 case 5 is updated for the ValidationLink-on-failure law.

## v4.9.71: Nic's rulings of 2026-10-18 (5:44 PM), recorded and applied

1. **χ window / floor:** kept as built (strict). A fresh chat at ε_s 0.36 being held is acceptable. Record only.
2. **inside / within = in.** One alias class, declared in the relation-property table (world_rules.js RELATIONS `{ pred, same_as: 'in' }`).
   - `canonicalPred` maps an alias to its class predicate and keeps any past_ prefix. reason.js `atom()` canonicalizes premises and queries, so every rule, inverse (in↔contain) and functional check reads the one 'in' row. There are no special cases.
   - Removed a duplicate `within` row and the separate `inside` row. mea.js skips alias rows: they have no mutable cells, so MEA-K evolves the class row.
   - Visible effect: an inferred WH answer quotes the class predicate ("the ball is in the room") even when the facts said "inside" / "within". Yes/no answers echo the user's own words.
3. **Forward phase skips.** A committed meaning may not skip over the Φ5 collapse, Φ6 χ or Φ7 naming gate when that gate applies to it. Other forward skips stay allowed.
   - kmath `phaseStep` takes `t.gates` (the applying gate phases; `GATE_PHASES = {5:'collapse',6:'χ',7:'naming'}`). phaseLaw passes them through.
   - The kernel sets the gates for a committed turn: Φ5 and Φ7 always, plus Φ6 when the drift band is 'correct' (χ ran). Blocked or quarantined turns have no gates.
   - Quarantine exploration is not a committed path, so the gates do not apply there.
   - Note: a "skip" of more than 4 phases is already read as backward by the circular direction rule (ruling 2 of 4.9.67), so it was unlawful before this ruling too.
4. **The 17-kind / 13-dimension Echo mapping:** kept, marked RECONSTRUCTION (see v4.9.70). Record only.
5. **Relevant memory.** M_relevant = facts sharing a content word with the question/answer PLUS facts linked to those facts' entities through ONE world-state relation hop.
   - Hop = a stored relation atom (R.parseAtomic) sharing an argument entity with a direct fact. Two hops are not included.
   - distances now report direct_count and hop_count. The phase distance stays circular /4.
6. **Explanation or refusal text for a blocked turn** may show, with no render targets. Kept. Record only.
7. **Bundle size raise:** approved (the 4.9.69 raise to 1.560 MB / 475 kB stands). Record only.
8. **Fixed seeds in the release gate.** The release/CI gate is deterministic: verify/gelc_suite.js defaults to seed 1358217271, the seed that exposed the 4.9.67 GELC deploy failure; it is now fixed and green.
   - Random-seed fuzzing moved to `tools/fuzz.js`. It is non-blocking and always exits 0. It appends failures (seed, case, reason) to `_fuzz/failures.jsonl`, which is git-ignored, and sends nothing anywhere.
   - A logged seed is reproduced with `GELC_SEED=<seed>` and fixed in the pipeline.
   - Fuzz run before release: seed 942775888 had flagged GELC-WH after ruling 2 (the WH answer quotes the class predicate). The suite now expects `canonicalPred`; this was a general test change, not an answer patch.
9. **"EchoForge" tool bench renamed "Tool Bench"** in the UI (tab label, card head and text), help, doctor runbook, rule docs, tool/registry text and the advisory-refusal reply ("The Tool Bench uses deterministic tools").
   - Internal keys are kept for storage compatibility: tab id `echoforge`, policy key `echoForge`, rule ids `EF-*`.
   - "EchoForge" now names only the separate debate / journaling / reflection app. This agrees with the AI.Web Apprentice Packet v2.0 (Nic's naming authority, 5:49 PM) and with V1 §6.
- Naming authority note: the Apprentice Packet (Drive, read-only) is adopted as the naming/role authority. Mismatches and follow-up renames are listed in kernel-papers/oct18/APPRENTICE_PACKET_NOTES.md: Gilligan = the whole agent layer (here only pattern reflection), Genesis Node vs "Home node", and the ProtoForge foundation role. These follow-ups were not renamed mid-release.
- Tests: verify/rulings471_suite.js, 8 cases (RULINGS-471).
- Tests updated to the new law (data change, not answer patches). world_state_suite: the derived chain is now stored as "aster is in cobalt" with rule RELPROP-TRANSITIVE:in; the declared-key check accepts `same_as` and requires an alias row to be a pure alias of an existing row; contain's inverse is 'in'. mea_suite: the inverse-pair legality message names contain/in.
- MEA consequence (general, src/mea.js). contain's inverse partner is now the functional 'in' row, which is not evolvable. So contain could only change one-sidedly, and the 4.9.65 inverse-pair rule forbids that.
  - New `pairOf` checks pair agreement against the partner's shipped value even when the partner is not evolvable. A one-sided contain change is INVERSE-PAIR-INCONSISTENT:contain/in.
  - Cells of a pair whose partner is not evolvable are no longer mutable. Mutable cells went from 31 to 25 and units from 21 to 17.
  - **Decision for Nic:** should the functional 'in' row's transitivity become an evolvable cell, which would re-open contain/in as one unit?
- src/mea_data.js regenerated (tools/mea_eval.js 1 8). All 8 seeded proposals were re-judged on the held-out, mutation, world-state and guard suites: all are rejected (regressions or legality), and nothing is adopted.

## v4.9.72: Nic's rulings of 2026-10-18 (6:20 PM) + MEA problem lane core (2026-10-18)
- Ruling 1 (recorded): an inferred 'where' answer that says "in" for a fact stated with inside/within is acceptable (one alias class since 4.9.71). No code change.
- Ruling 2 (applied): `.github/workflows/fuzz.yml`, "Fuzz (non-blocking)". It is a separate workflow that runs on push to main and on manual dispatch, with read-only permissions. The job and every step are `continue-on-error`. It runs `node source/tools/fuzz.js 8` (which always exits 0), prints `_fuzz/failures.jsonl` to the job log and uploads `source/_fuzz/` as the "fuzz-failures" artifact. It has no notification step, sends no messages, and is not a dependency of "Deploy Pages", so it never gates deploy.
- Ruling 3 (documented, frozen): 'in' / 'contain' transitivity stays frozen. It is correct by meaning: the alias class plus the inverse pair make "a in b, b in c ⇒ a in c" hold exactly when "c contains b contains a" does. The 4.9.71 relation-property guard and the inverse-pair legality check (`pairOf`: a one-sided change is INVERSE-PAIR-INCONSISTENT:contain/in) prove it on every release. The 4.9.71 open question (should 'in' become evolvable?) is therefore closed as "no".
- Ruling 4 (applied, display/docs only; storage keys unchanged). The packet names are used in UI text, comments and docs:
  - The 'Gilligan' pattern feature is now shown as "Pattern Reflection" (operator function name `gilligan`, the trace id EF-FRAME-PATTERNS and the "run gilligan" phrase are kept).
  - "Home node" is now shown as "Genesis Node (prototype)" (vault label key 'home node key' kept).
  - Audit / receipts / M2 ledger / containment / drift tracking are described as the ProtoForge layer in the docs (this file and APPRENTICE_PACKET_NOTES.md). The status panel shows the same rows as "Foundation layer" plus an "AI.Web layers" row, without the word.
  - Conflict found: the 4.9.5 cleanup guard CLEANUP-495 ("no user-facing ProtoForge UI in index.html or app*.js") bans the word anywhere in the app UI. The first release run failed on the status-panel label (1 of 2733). The guard was kept, not weakened, and the label moved to docs.
  - **Decision for Nic:** may the status panel say "ProtoForge layer"? That would mean narrowing CLEANUP-495 to ProtoForge controls only.
  - It was folded into the first MEA release, as allowed.
- MEA problem lane core (src/mea_p.js, pure, no store). Packet naming throughout: MEA (Manifest Evolution), problem manifest, archive (cold storage), RMC handoff.
  - **Problem statements are data.** data/canonical_problems.json now carries a `manifest` per problem: goal, Φ state, known facts with evidence tiers, unknowns (measurement / quantity with symbol / choice with options), options (assumptions, exact likelihood, exact condition, falsifier), derivations (exact expressions) and success conditions.
  - The code never names a domain or an option, and never reads `expected_outcome`. A verify case enforces this.
  - tools/gen_mea_problems.js ships the manifests (not the expected outcomes) as src/mea_problems_data.js.
  - **Selection, with no invented weights.** Hard gates come first, in this order: REPLAY, TAMPER, LEGALITY (identity invariance), EVIDENCE, PHASE, DRIFT (0.35/0.40/0.80 bands), CLAIM, I_ZERO, NOVELTY, BUDGET. Then Pareto, then lexicographic: B↓ L↑ Ω↑ I↑ A↑ ε↓ K↓, then id.
  - The weighted score uses unit coefficients and is DISPLAY ONLY. A verify case shows that permuting it changes no rank.
  - **Proof debt B is a count ratio:** undischarged premises / premises. Discharged tiers are empirical_measurement, published, given and derived_exact. 'internal', hypothesis, speculative and unknown are not discharged. The forge tier numbers were not reused, because using them would invent weights.
  - **An option is "favoured" only if it beats the next option on a real key** (not the id tie-break). Otherwise it is a tie, and ⧧ splits the slate into sealed sub-manifests that keep their lineage.
  - **Speculation is quarantined.** An option with no likelihood, condition or falsifier is a speculative branch: it takes the Φ−1 quarantine path (the kmath phaseStep quarantine law) and the shadow route, is archived as blocked on capability:projection, and is never committed as a claim.
  - **Commit is tap-only and bound to the cycle** (fresh cycle hash, the ⟁ resolution candidate, eligible route, projectable drift). Its phase path walks the successors to Φ7, honouring the 4.9.71 gate rule [5, 7].
    - It adds derived facts (tier derived_exact), resolves options and eliminates options.
    - It archives non-eligible candidates with typed blocked_on: gate:*, capability:exact_lane, capability:projection or value:<unknown>.
    - It withdraws earlier claims that are no longer supported, with wd: receipts, and writes a mear: receipt.
  - **requeue(archive, capability) returns proposals only** ("rerun_cycle"); it never commits.
  - **handoff(M)** gives typed params (derived, established, conditional, favoured, hypotheses, eliminated, open), and only for a committed (Φ7, render_allowed) manifest.
- Tests: verify/meap_suite.js, 12 cases (MEAP). They cover:
  - schema/hash, replay and determinism;
  - forged / phase-skip / unsupported-evidence gates, and the claim law;
  - display score not ranking, tap-only and stale-cycle commits, and domain-generality;
  - the three canonical problems end-to-end, plus a synthetic fourth problem (a logistics "route window" with a quarantined speculative option);
  - archive and requeue.
- Kernel/app wiring (conversation frame, Memory-tab card, RMC rendering with Echo) is the next release.

## v4.9.73: MEA problem lane wired into the kernel, the conversation and the Memory tab (2026-10-18)
- **Kernel.** It loads src/mea_p.js and the shipped problem manifests. New store categories: mea_problems, mea_candidates, mea_archive and mea_receipts.
- **APIs:**
  - meaProblems;
  - meaCycle (session cache; pure);
  - meaSupply (a session draft; nothing stored until commit);
  - meaCommit(pid, candidateId, userTap) (permission-decided 'hypothesis.write' plus mea_p's own tap and fresh-cycle checks; stores the manifest, sub-manifests, archive, receipts and withdrawals; writes a containment receipt);
  - meaArchive, meaReceipts, meaRequeue and meaHandoff.
  - adoptManifest now also returns `mea_requeue`: proposals only, never a commit.
- **Conversation.** A capability frame reads "show the problems" and "show problem <id or id part>". The RMC handoff gives typed params to new derive plans: mea_problems, mea_result, mea_not_committed and mea_none. Every reply goes through Echo. An uncommitted manifest is never rendered beyond "has no result".
  - Realizer lexicon additions: verbs derive / prefer / reject / need, nouns problem / hypothesis / option / test, and the adjective conditional. These are closed-class additions, not answer text.
- **Memory tab.** New card "MEA (Manifest Evolution) — problem manifests". It has Run cycle, Supply <value> (a prompt for an exact number), and Commit (tap + confirm). It shows the candidates with their route, status, rank, B/L/Ω/I/ε, and the display score labelled as never ranking.
- Tests: meap_suite has 2 new kernel cases (MEAP, 14 total): supply/draft/commit/render plus an unknown problem, and RMC handoff + Echo + tap-required.
- data/command_catalog.json regenerated (tools/build_catalog.js) for the new mea_problem frame. The first release run failed the catalog freshness check (B-11) and its two claim-guard dependants.

## v4.9.74: evidence and authority honesty (Nic, 2026-10-19)
Nic's three rulings ("make the evidence and authority layers honest; failing tests first"). The tests in `verify/honesty_suite.js` (classes HONEST-BADGE / HONEST-TIER / HONEST-ENTAIL) were committed first, in a8b6663. Run before the implementation, 11 of the 12 failed. The one that passed is the regression guard "unsupported evidence never counts; the lookup answer is never stored as a fact".
- **1. Badge split.** The single `network: no` flag is gone from the UI. The badge shows two labels:
  - **kernel network: none**: the kernel never touches the network;
  - **tool egress: <tool> · <on-device | external>**: the tool that ran on this turn, or `none`.
  The egress comes from the tool's Tool Bench manifest (`network` = the effect class reads the network). An unknown tool counts as external, never as on-device. The research/feed/capture turn that starts the tool already reads `tool egress: research.web · external`, and so does the turn with its result. `authority_boundary` now carries `kernel_network` and `tool_egress`. The old boolean `network` field is removed, so no flag can be read as "nothing left the device". `verify/run.js` AUTHORITY now checks `kernel_network === 'none'`, `tool_egress === 'none'` and that no `network` field exists. Code: `provenance.js egressLabel / boundaryLabels`, `forge.js toolEgress / authorityLabels`, `app.js AB`.
- **2. Provenance tiers.** The evidence.js rank classes map onto three tiers (declared data: `EV.TIER_OF`):

  | rank class (evidence.js) | archives | tier |
  |---|---|---|
  | primary_authority | MedlinePlus, openFDA, CourtListener, eCFR | **curated_archive** |
  | peer_reviewed | PubMed, OpenAlex, Crossref | **peer_reviewed_index** |
  | structured_reference | Wikidata (openly edited) | **open_fallback** |
  | encyclopedia | Wikipedia | **open_fallback** |
  | anything else (general web) | — | **open_fallback** |

  Every cited source in a research answer is listed with its tier ("openFDA: Aspirin label · curated archive"). A summary line follows, e.g. `The provenance is “sources: 2 curated, 1 peer-reviewed, 2 open fallback”.`, with zero counts left out. When every source is an open fallback, the line ends with "(open fallback only: no curated or peer-reviewed source)" and the evidence card is styled as a fallback.
  - Wikidata is placed in open_fallback because it is openly edited and is not a curated archive (**Nic's ruling, 2026-10-19**).
  - The rank ORDER used by support and conflicts is unchanged.
- **3. Entailment (deterministic: no model, no embeddings).** Each cited source is checked against the answer sentence it is attached to, using the answer's key content, which comes from the language core's lookup plan and the extracted claim:
  - the extracted value, when the question asks for a date, person, place or quantity;
  - every content word of the entity;
  - at least one relation word, meaning one of the asked predicate's forms.

  The source supports the sentence only if one sentence of its stored excerpt (span ruling below) contains that key content as an exact substring (`EV.entail`). If no such span exists:
  - the source is marked `· unsupported`;
  - its evidence object gets `entailed: false` and never counts toward support. Citation presence is not support;
  - **ruling 11:23** ("mark the claim unsupported in the output"): an unsupported citation stays visible, marked `· unsupported`, and counts toward neither support nor agreement. When NO source supports the answer, the reply does not present it as an answer; it says `The claim is “Unsupported: <claim> (no verbatim span in any source)”.` A related-passage reply (no excerpt fits the answer type) is not an answer and keeps its wording. Tests: `subject_suite` "unsupported claim" ×2, committed first in 02f4770 (fail on d2eeef3).

  A span offered from outside (`x.span`) is accepted only if `EV.verifySpan` passes: it must be an exact substring of the stored excerpt and hold the key content. Anything else, such as a fabricated span, is rejected and counted (`rejected_spans`).
- Unchanged:
  - excerpts stay sealed in the Identity Vault as evidence only;
  - a live lookup answer is never stored as a fact;
  - evidence.js stays pure: it may require only `./sha256.js` and the new pure `./provenance.js` (no imports, no I/O). The purity regexes in `honesty_suite` and `evidence_suite` were widened to allow `./provenance.js`, and only that file;
  - the kernel imports neither evidence.js nor sb_sync.js.
- This is a general pipeline change; no individual answer was patched. The realizer lexicon gained two closed-class nouns, "provenance" and "agreement".
- **Span ruling (Nic, 2026-10-19).** A span is one sentence by default. Two adjacent sentences form one span only when the second sentence's subject is `It / He / She / They` or `The / This <X>` where X is the entity's head noun or the noun after the first sentence's copula, and the first sentence names the entity in its opening words (`provenance.js joinable`). Otherwise the pair is not a span (`multi_sentence_span`) and the claim is unsupported. Tests: `subject_suite` "span ruling" ×2.

### 4.9.74 part 2: Nic items 4–7 (steering 2026-10-19)
- **4. Subject guard: `SUBJECT_MISMATCH`.** A source's primary entity is its title head: parentheticals are dropped, the title is cut at the first preposition/conjunction or punctuation, a leading article is removed, and the archive's declared document noun is stripped ("ASPIRIN drug label" → "aspirin"). Without a title, the excerpt's lead subject is used. The source matches if every word of the question's entity is in the head and the head nouns agree. Ordinals and numbers must match exactly ("first" ≠ "twenty-first", which is one token), so "First Amendment audit" (head noun "audit") is a mismatch.
  - Checks run at acquisition (`crawler.acquirePlanned opts.subject`) and again before assessment. A mismatched source is set aside with the typed limitation, never cited, quoted or counted, and still sealed as evidence only. The reply says "The limitation is “SUBJECT_MISMATCH: N sources were about another subject and set aside”". If every source is rejected, the turn is `tool_failed` with the code SUBJECT_MISMATCH.
  - **Ruling 11:15 (answer entity).** A source also qualifies when its primary entity matches the candidate answer entity (extracted by `AR.extract`). Matching means every answer word is in the head with the head nouns agreeing, or the answer is the head's leading run of ≥2 words. Such a source counts only with a verbatim one-sentence span naming both the question subject and the answer; otherwise it is SUBJECT_MISMATCH. This path is used only when the question asks for an entity (answer type person/place). Rows carry `subject_match: question | answer`.
  - Ranking: the article whose primary entity is exactly the question entity gets +3 at acquisition. So does a provisional answer-entity article whose intro names the question subject and the asked relation. A noun phrase that the research plan split into head + complement ("the first amendment" → "first" + "amendment") is re-read as one entity (head "amendment", modifier "first"). These are general changes.
  - Before/after: on 4.9.73, "What is the first amendment?" answered from the Twenty-first Amendment article ("It is the only amendment to repeal another."). On 4.9.74 it cites only "First Amendment to the United States Constitution" and sets the Twenty-first Amendment and "First Amendment audit" aside as SUBJECT_MISMATCH.
  - **For Nic:** strict title-head matching will set aside more peer-reviewed papers and court opinions, whose titles rarely name the question entity as their head.
- **5. Agreement over origins.** Each answer reports "K agree, M disagree, N unusable", with the count taken over ORIGINS, never over ranked results.
  - Origins: Wikipedia and Wikidata are one origin (wikimedia). MedlinePlus is nlm, openFDA is fda, CourtListener is free-law-project, and eCFR is federal-register. A peer-reviewed paper is one origin across PubMed/OpenAlex/Crossref (normalized title). The web is counted by domain.
  - An origin's status is the best of its rows (agree > disagree > unusable). Unsupported and subject-rejected rows are unusable.
  - `support.n` is capped by the agreeing origins: corroborated needs ≥2, one origin makes the answer "probably", and none gives no support. The phrase "N independent ranked sources" can no longer appear (6b).
- **6. Tests.** `verify/subject_suite.js` (EV-SUBJECT, 17 cases) was committed first in daa1f4a, d2eeef3 (Bell) and 02f4770 (ruling 11:23). Case 6a ("square root of 4536" ≈ 67.349833 with full trace) passed before the change; it is a regression guard, not a fix.
- **Test edits after failing-first (documented, not weakened).**
  - `evhonest_suite` fixtures were retitled "Berlin" → "Berlin Wall" and "Label" → "Aspirin". Under the new subject guard, an article titled "Berlin" is about another subject, and those tests are about entailment, not the subject.
  - The egress expectation became the string form (`research.web · external`).
  - The `subject_suite` memo key now includes the page text, because the Bell "unrelated" case was being served the cached "good" result.
- **Budget.** The single-file bundle grew to 1.562 MB raw for provenance.js and the guard. The raw budget was raised from 1.560 MB to 1.600 MB (`tools/verify_release.js`, `w5_suite` PRO); the gzip budget of 475 kB is unchanged.

- **Push transport.** The file-push tool decodes named HTML entities (ampersand + amp/lt/gt/quot + semicolon) in file content. The four literals of this kind (`app.js esc`, the `app_bench.js` "Backup & Recovery" heading, the `crawler.js` entity decoder) are now written as the JS escape `\x26` + name + `;`, which is the identical string at runtime. A release check compares the GitHub tree hash with the local tree hash.
