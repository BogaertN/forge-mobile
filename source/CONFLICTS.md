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
