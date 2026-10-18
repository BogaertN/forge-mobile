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
