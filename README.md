# Forge Mobile

Forge Mobile is an installable progressive web app: a deterministic language kernel with no language model. A question is compiled into symbolic meaning, checked against memory and a symbolic world, rendered as one sentence, and checked again by parsing that sentence with the same grammar. A lookup returns cited evidence. A lasting memory write requires an explicit request.

**Version 4.9.143**, the contents of [`source/VERSION`](source/VERSION). The live app is [https://bogaertn.github.io/forge-mobile/](https://bogaertn.github.io/forge-mobile/). The published build record is [`build-info.json`](https://bogaertn.github.io/forge-mobile/build-info.json). Registry 316. Publish-gate tests for this line of releases stay at zero failed. Service-worker cache `forge-mobile-v4.9.143`.

## What this build does

**Ask shell.** 4.9.126 polishes the conversation chrome: calm tabs and typography, Doc 7 status pills, empty states with one next step, invent and compose discoverability, gentler unsupported redirects, and a starter-pack onboarding one-liner. Clear starter knowledge and Import confirmed facts stay reachable.

**Creative writing (4.9.120–4.9.123).** Invent and explore speak a novelty-banded idea as a hypothesis or a speculative branch. 4.9.121 Compose turns a staged idea into a short paragraph; 4.9.123 expands that into a developed multi-sentence paragraph under the Language Core and exact Echo. 4.9.122 Suppose runs a counterfactual simulation; parking the branch stays in dream quarantine. Creative output stays hypothesis or speculative branch. A tap may commit an idea record when drift is at or under 0.35. Creative turns never auto-write lasting memory, the world head, or confirmed knowledge.

**Confirmed facts on the device (4.9.124–4.9.125).** A small product starter pack lands on first open so invent and compose have anchors. Audit provenance is `starter_pack`. Clear starter knowledge removes that pack without wiping Remember facts. Import loads a versioned confirmed pack from a file or a paste (`import_pack`). Projectable entries admit with a receipt. Contested entries stay held until a tap. A bad pack is a typed refusal. Import does not clear starter knowledge or remembered facts.

**Shared knowledge base (4.9.143).** Hosted A–Z under `packs/confirmed_shared/` is the product shared knowledge source of truth for everyone (index 4.9.143; 4313 admitted / 4551 curated; floors from 4.9.128 ≥1890 / ≥2622). Clients **pull/read** into session RAM for invent/compose anchors. The A–Z corpus does **not** belong in the on-phone database. Write requires Nic’s write key (`SHARED-KB-WRITE-KEY-REQUIRED` without it). Phone Remember / starter / import stay user-owned. Scrapbook `shared_knowledge` stays empty. CREATE/COMPOSE/SIMULATE never auto-write. UI/Audit say Shared knowledge base.

**Earlier honesty and packets.** 4.9.111–4.9.119 (including 4.9.117 requirement packets and 4.9.118 math honesty research notes) keep exportable turn packets, gate honesty, Doc 7 category labels, MSM custody, naming hygiene, offline receipt replay, lexicon and frames pathways, requirement packets, math honesty notes, and dream or SPC proposal-only resurrection. Cold storage is a software tier. Hardware SPC is not claimed. ChristPing is not built. χ is the correction function only. The write law stays at or under 0.35. Drift divisors already in the code are not one manuscript number, and Φ1–Φ9 is not proven cognition.

## The app

The site installs on a phone and runs from its cache (`source/manifest.json`, `source/sw.js`). Eight tabs (`source/index.html`): Forge Output, Identity Vault, Tool Bench, RMC Memory, Deep Dry-Run, Context Library, Audit / Receipts, and System Status.

Ask Forge is the conversation. The prompt says it will not execute commands. Voice input uses the device speech recognizer and is marked unverified. Each reply carries a trace: the rules that ran, the gate, drift, the containment route, Echo, and the meaning manifest. Pattern Reflection is not Gilligan. Tool Bench is not EchoForge. RMC Echo is the exact reparse, not EchoForge. Audit / Receipts is the Foundation layer. One control, Export turn packet, saves that turn as a packet whether the turn spoke an answer or failed. Audit / Receipts opens the same packet. Verify packet checks a pasted packet offline and does not read the turn store. Audit / Receipts also shows the requirement packet. R4116-LEXICON and R4116-FRAMES name the tests that check the 4.9.116 pathways. R4117-TRACE, R4117-GATES, and R4117-NONLLM name the checks for this release. The schema is `FORGE-REQ-PACKET/v1`. A passing behavior run does not override a failed gate. A failure receipt is one of echo fail, language unexpressible, gate refusal, quarantine, or χ re-route. The 4.9.111 packet schema stays `FORGE-TURN-PACKET/v1`. When the turn is ambiguous, needs clarification, is unsupported, or understood an action it must not perform, the conversation and Audit show that state in 4.9.112 Doc 6 words: ambiguity / clarification-required, clarification-required, unsupported, or meaning-understood-but-action-blocked. The receipt also lists every route that was not selected, with the rejection reason already recorded for it. The same receipt names the Doc 7 category the belief rests on. 4.9.113 keeps Language corpus, Evidence, Memory, Trace/receipt, and Authority records apart, and each label says presence ≠ truth. A lookup stays evidence. It is not a knowledge store. The shared-knowledge scrapbook stays empty. Confirmed facts use starter_pack, import_pack, and (as packs ship) confirmed_shared provenance instead. The meaning manifest is reconstructed Doc 2 / MSM-v1. The Drive file was not recovered. An action, a simulation, or an observation keeps the preservation class `action_proposal_simulation_and_observation`. The trace cites MSM record ids. μ_t, evidence, memory, and Echo stay outside that manifest. MSM does not select, execute, write memory, or approve Echo.

A turn has five steps.

1. **Language Core** compiles supported English into symbolic meaning and, once a meaning is selected, realizes it as a sentence (`source/src/grammar.js`, `source/src/derive.js`).
2. **RMC** runs candidate routes and selects one meaning (`source/src/kernel.js`).
3. **World** answers from the sentences in front of it, and from the persistent world a remember has committed (`source/src/reason.js`).
4. **Render** produces one of eleven output forms. Chat uses text (`source/src/render.js`).
5. **Echo** parses that text again. A mismatch blocks the reply.

The permission service (`source/src/governance.js`) decides every governed action. Understanding a sentence is separate from permission to store it, send it, or run it. The app is marked a prototype. Hashes are SHA-256.

## A turn

`Kernel.process` is the conversation entry.

Text is Unicode-normalized. Passwords, keys, card numbers, and the other sensitive shapes in `source/src/privacy.js` are replaced with the word “sealed” before reasoning. The kernel, the trace, and memory see that word. When a remember of such a value is allowed and the vault is unlocked, the value is encrypted on the device (AES-GCM, key from the passphrase). A locked vault drops the value. The turn id is the SHA-256 of the turn number, the loop, and the redacted text.

Before routes run, a message may be split or lightly rewritten: a fronted topic, a contrastive “not”, a tag question, an embedded “tell me what…”, a greeting ahead of the real sentence, or a semicolon that keeps a prohibition inside its own clause. Several declarative sentences are read one at a time when the turn world does not take the whole message. A rate problem, a measurement report, or a dynamics what-if stays whole.

Applicable routes run in a sandbox, so a route that loses keeps no writes. In report order they are `world.preflight`, `turn.reentry`, `capability.frame`, `gks.quantity`, `world.proof`, `math.gp014`, `directive.frame`, `justify.followup`, `world.dynamics`, and `language.core`. World preflight is measured when the input is longer than 2,000 characters. Past 100,000 characters the only proposal is the input-limit refusal.

Echo rejects a surface that does not round-trip. An ambiguous Echo becomes a clarification. A reply that finishes a clarification from the previous turn is preferred. After that, the order is proof completeness, specificity (a specific route ahead of the general language core), lower drift, then the score M+P+U+N−D. A true tie lists the readings and waits for “1” or “2”.

The drift write law then decides whether the turn may be spoken or stored. The sentence is realized and parsed again. Math answers are re-verified on their own. Echo compares structure, with no word-overlap score. If derivation fails, the derivation trail is forbidden, or Echo fails, the reply is empty, nothing is stored, and the trace records `LANGUAGE_UNEXPRESSIBLE`.

A plain statement is acknowledged and may be kept as a working fact for the conversation. Lasting memory requires “remember …”, the projectable band, a passed Echo, and permission for `memory.write`. Research results and Suppose branches leave memory, the world head, and shared knowledge unchanged. Every finished turn carries one intent:

| Intent | The turn |
|---|---|
| `READ` | Recall, a yes/no over memory, a list, an inspect |
| `DERIVE` | A checked proof, an admitted rule, math, a rate, or conservation |
| `EXPLAIN` | Why, how, a definition, or a cause walked backward |
| `SIMULATE` | A Suppose branch, a story simulation, or a dynamics what-if |
| `PROPOSE_EVIDENCE` | A proposal or a research answer |
| `REQUEST_COMMIT` | Remember, a note, or a refusal to store |
| `CLARIFY` | An ambiguity or an unresolved reference |
| `UNSUPPORTED` | An action or a structure the grammar does not take |

## Language

The Language Core is a bidirectional compiler. Inward it tokenizes, tags, derives each reading, assigns roles, and keeps scope. Outward the same roles become a sentence, with agreement, tense, aspect, negation, and lists. Every choice is a recorded rule.

Closed-class words live in `grammar.js`. Open-class words come from the lexicon: a small seed in `source/src/lexicon.js`, and Princeton WordNet 3.0 loaded lazily in tiers (core, extended, complete). The licence is `source/data/WORDNET_LICENSE.txt`. WordNet supplies tags, morphology, frames, and relations. A definition is taken from the controlled lexicon. When more than one controlled sense fits, the turn asks which one. An unknown word inside a remember-request is asked about.

Five household pathways that the loaded lexicon could not parse now use a controlled concept and a predicate-role frame: misplaced keys, a bandaged wound, a preheated oven (and an oven that preheated on its own), an unplugged kettle, and marinated tofu. A room that smells of bread uses the smell-of frame and no new smell concept. The noun bandage is still a bandage. Asking what bandage means cites the language corpus. Saying the sentence does not store it, and asking Forge to bandage the wound stays blocked. Recognizing the frame does not run the action or approve Echo.

The request compiler (`source/src/qcompile.js`) turns a question into a record of subject, predicate, and the asked relation: who, what, where, when, why, how, quantity, or verdict. Research retrieval uses that record. Expansions above the projectable band are kept on the record and left unused.

What the compiler handles:

- Questions over stored relations: what, who, where, when, whether, and “what do you know about”.
- Role questions, including whose, how, and why.
- Pronouns and demonstratives. One fitting antecedent binds. Several stay open. On a research lead, *it*, *they*, *he*, and *she* follow the article subject; after the lead, only a local antecedent binds.
- Lists of any length as one object, with or without an Oxford comma. A comma before a new finite clause starts a new clause. Naming asides (a comma, a dash, “aka”, a reduced relative) drop before roles are assigned.
- Year order. Two stored events with non-overlapping years answer before and after. A from-year / to-year span is an interval. The comparison itself stores nothing.
- Cause. “Does A cause B?” follows stored links forward. “What causes B?” walks them backward and cites each upstream cause. A what-if is an intervention on that graph.
- Conservation and rates. A stated stock plus a finite amount in or out answers how much remains, in the same unit, with exact arithmetic. A rate stays a rate. A missing conversion, a mixed dimension, or an unqualified gallon against liters yields no number.
- Suppose, assume, imagine, what if, and hypothetically. The reply names the branch and states that the branch leaves the world unchanged. A remembered fact can be the base of the branch. A later question outside the branch sees the stored world only. A story suppose is named a counterfactual simulation. Its status stays speculative. Parking it stays in dream quarantine and does not write the world.
- Rule proposals. “Show the proposals” may offer a hypothesis drawn from stored facts. Admission waits for a tap, and only while drift is at or under 0.35 and replay contradicts nothing stored.
- Math, in `source/src/algebra.js` and `source/src/calculus.js`: exact rationals, polynomials, factoring, linear systems, derivatives and integrals of polynomials, and unit conversion by exact factors. Degree above 4 is refused. Degree 3 or 4 with no rational root is a labelled numeric root. A malformed expression or a division by zero is a refusal.

This is a controlled English for those constructions.

## Confirmed facts and general knowledge

Forge separates **evidence**, **hypothesis**, and **confirmed memory**. Presence is not truth.

| Provenance | What it is | Who admits it |
|---|---|---|
| `starter_pack` | Small on-device seed so invent and compose are not empty on first open | Product-admitted; Clear starter knowledge removes it |
| `import_pack` | Versioned pack from a file or a paste (`FORGE-CONFIRMED-PACK/v1`) | Projectable admits with a receipt; contested waits for a tap |
| `confirmed_shared` (hosted shared knowledge) | Hosted A–Z product shared knowledge base for every install (read for all) | Pages packs; write needs Nic key; not phone DB |
| Remember | Person-authored lasting facts | Explicit “remember …” plus projectable band and Echo |
| Research lookup | Cited evidence | Never silent promotion into confirmed memory |
| Invent / compose / suppose | Hypothesis or speculative branch | Never auto-write confirmed memory |

Importable and shared confirmed packs use short, verified general facts suitable as invent and compose anchors. They are not a language-model scrapbook and not the empty shared-knowledge switch described under Boundaries.

## Memory and world

### The turn world

`source/src/reason.js` compiles one turn — facts, rules, and a final query, including words it has not seen before — into an immutable turn world. Closure is finite and paraconsistent: a contradiction, support, a refutation, and “the premises do not decide” remain different results. The selected proof is replayed. The turn world writes neither lasting memory nor the persistent head.

### The persistent world

Stored facts project to entities, relations, and attributes. A successful remember publishes a world snapshot (`forge-world-state/v1`, world id `world:local`). The snapshot’s version id is separate from the storage generation. It carries parent versions, a content hash, and a commit receipt. The next head is staged and becomes current only after that stage reads back. A failed stage leaves the previous head in place.

Suppose, a conservation step, and “propose problem physics” leave the committed head unchanged. So does an Echo failure. Forgetting a premise withdraws dependents that rested on it and publishes the next head with those items invalidated.

### Remember

A memory row keeps the clause, its entities, provenance, and time. A contradiction (polarity, a single-valued attribute, or exclusive classes) asks rather than overwriting. “Instead” or “actually” replaces the row, and the previous row moves to cold storage. Forget moves the row to cold storage and says so. Hard delete is unavailable (`hardDelete` is `never`).

A research claim is named on the reply:

| Status | What the app does |
|---|---|
| Projectable (ε ≤ 0.35, supported) | Offers remember. “Remember that …” is what stores it. |
| Correction (0.35 < ε < 0.40) | Runs χ once, then measures the turn again. |
| Contested or held (0.40–0.80, a conflict, or a correction still above 0.35) | A held claim with a generated clause waits in held writes. A tap stores it. “Show quarantine” and “show containment” list held claims. |
| Refused (above 0.80, or a forbidden transition) | Leaves the claim unheld and unstored. |

The intake record keeps both `stored` and `shared_kb` false.

### On the device

Confirmed factual anchors live in named provenances: `starter_pack` (shipped seed), `import_pack` (person-loaded packs), and `confirmed_shared` (distributed curated general-knowledge packs as they ship). The older shared-knowledge scrapbook store stays empty in this build, and its switch defaults to off. Research and creative turns do not fill that scrapbook. A reviewed manifest, if accepted, is evidence only: the signature names who signed it. Vault contents stay on the device. A live lookup remains evidence: it is not written into lasting memory by citation alone.

Contribution counts (`source/src/economy.js`) are recognition. They are not payment. A candidate is signed by a reviewer who is not the contributor and who supplies evidence, then finalized as a capsule. A later nullification is appended. The attribution ledger (`source/src/ledger.js`) is one hash chain per device. An export is the full chain or a checkpoint. A divergent foreign chain is recorded beside this device’s chain.

Backup (`source/src/operator.js`) is one portable file: AES-GCM, with its PBKDF2-SHA-256 parameters and salt inside the file, so a fresh install can open it. Bounds on size, depth, and the key derivation are checked before any key is derived. Restore writes a new storage generation, reads it back, then switches a single pointer. The passphrase is at least 8 characters. A lost passphrase cannot be recovered.

The Identity Vault tab is this local encrypted store.

## Drift, containment, and proposals

Drift ε_s is the write law (`source/src/kmath.js`):

| ε_s | Band | Effect |
|---|---|---|
| ≤ 0.35 | Projectable | May be spoken. The only band in which memory may be written. |
| 0.35 < ε_s < 0.40 | Correction | χ, the correction function, runs once. The turn is measured again. A write in this turn requires the new value to be ≤ 0.35. |
| 0.40 ≤ ε_s ≤ 0.80 | Quarantine | Archived. Withheld from projection and from memory. |
| > 0.80 | Hard stop | Sealed, unless the χ hard-stop check fires and re-routes the turn with a restricted meaning. |

An offline research note compares the ρ divisor in this table's measure with the n = 3 divisor already stamped on other scores. That note is not this write law. ROC, CFBC, and RSOC are not treated as one manuscript number. Φ1–Φ9 is not proven cognition.

Forbidden phase jumps, Φ5→Φ8 and Φ4→Φ8, are a separate gate. The trace names the math contracts that ran: the drift measure, this table, the χ correction, the χ hard-stop check, the RSOC speech selector, and the phase scheme from Φ1 Initiation through Φ9 Return. RSOC chooses among rival phrasings. One alignment locks. Several stay open. A sever may split a clause list when the clauses themselves are unchanged.

Each turn receives exactly one containment route (`source/src/containment.js`):

- `active_stack_candidate` — the ordinary turn
- `correction_queue` — a clarification, a confirm, a forget, a replace, or a χ re-route
- `spc_cold_storage_required` — a hard stop or a forbidden phase jump. The forgotten fact itself lives in cold storage; the forget turn is a correction
- `dream_state_quarantine_candidate` — a bare Suppose, imagine, or similar statement with no question attached. The row stays out of memory and out of the world head. A dynamics what-if answered by the dynamics route is a simulation, not this route
- `drift_archive_only` — the quarantine band, including a correction that stays above 0.35
- `ghost_loop_containment_required` — the turn could not be resolved: no frame, an unknown the grammar could not structure, a derivation failure, or an Echo failure

“Show quarantine”, “show cold storage”, and “show containment” list the route, the tier, and a short label. An empty list says so. A forgotten row is warm unless policy sets it cold. Deep storage is the seal for a breach or for too many resurrection attempts. Saying “resurrect” or “bring back” in the conversation, and the Resurrect control on the Memory screen, return a warm row to processing as a proposal. Neither writes memory, the world head, or shared knowledge. A separate Commit control is the only store. The must_archive switch defaults to off. When it is on, the turn routes to software cold storage and inspect names must_archive. Cold storage here is a software tier. Hardware SPC is not claimed. ChristPing is not built. χ is the correction function only.

**Ideas.** “Invent a hypothesis”, “come up with an idea”, and “create an idea” are CREATE. “Explore alternatives” is EXPLORE. “Explore ideas” stays the older proposal list. Each idea carries a novelty score and a drift band. With no memory anchor, novelty is unbound and Forge refuses a discovery claim. A quarantine-band idea, drift from 0.40 through 0.80, may be spoken as a hypothesis or a speculative branch. It is not a stored fact, not world truth, and not confirmed knowledge. “Seal the idea” repeats the proposal. The Memory screen control commits the idea record only when drift is at or under 0.35. That commit does not write lasting memory, the world head, or confirmed knowledge. Drift above 0.80 is refused.

**Paragraphs.** “Compose that idea”, “compose that meaning”, “write it out”, and “explain it as a short paragraph” narrate a selected idea or a selected meaning in several sentences. The paragraph names the claim and keeps its status: a hypothesis stays a hypothesis, and a speculative branch stays a speculative branch. The paragraph is checked by the same grammar that produced it. It does not write lasting memory, the world, or confirmed knowledge. “Explain the idea”, without that paragraph request, stays a question about the word.

**Problem proposals.** “Propose problem physics” runs one problem cycle on the shipped 144 Hz problem. A candidate is spoken only when it is projectable, standing is stamped, and novelty sits inside the existing bounds. The spoken line is a hypothesis. Parked candidates go to the problem archive after Echo passes. A tap is the only seal. The propose leaves memory, the world head, and shared knowledge unchanged. After that tap, a later propose keeps the same problem and goal, carries candidates already archived or already on the manifest, and may attach one frame cell and one parser cell as proposal data. Those cells stay unapplied. Grammar changes are a separate lane: typed deltas over declared pronoun classes, a few complement frames, and open parser categories. Adoption is a tap. Withdrawal restores the shipped tables.

**Dynamics.** Stated scenarios use exact rational arithmetic: levels, constant rates, conservation of an amount, causal what-if, and measurements that disagree. A disagreeing measurement stays beside the equation. An association is left as an association. The solver neither stores nor fetches.

## Research and tools

The Tool Bench (`source/src/toolbench.js`) is a set of declared tools. Each manifest sets `uses_model` false. The kernel calls a tool only from a selected predicate frame, and the permission service decides the call. The result is an evidence record on a hash-chained log.

Research is a read-only lookup. The research switch defaults to on request. A factual question that no stored, shared, or private fact answers counts as that request, once the vault is unlocked so the excerpts can be sealed. Personal questions, commands, greetings, and tool turns stay on the language path. Archives (`source/src/archives.js`) are keyless public endpoints, ranked primary authority, then peer-reviewed, then structured reference, then encyclopedia. Two things named in one statement are not treated as a cause. The reply names the archive and the evidence class, and it writes no memory.

Page capture is tracker-free: no extra headers, no credentials, no referrer. The capture is sealed the same way. A site the browser cannot read needs a user-owned node or proxy, and that URL must be https. The default fetch path is direct browser access only.

User tools (`source/src/toolbuilder.js`) are ForgeScript in a worker with no network, no page, and no storage. Tests pass before a tool is enabled. Three consecutive runtime failures disable it. Results are evidence.

Deep Dry-Run runs the pipeline on an isolated copy of the stores it snapshots, then discards that copy. The conversation store is unchanged. The tab shows the trace.

## Architecture

| Module | Role |
|---|---|
| `kernel.js` | The turn: routes, drift, containment, memory, world head, intents |
| `grammar.js`, `derive.js` | Language in, language out, Echo |
| `reason.js`, `infer.js` | Turn world and checked proofs |
| `kmath.js`, `algebra.js`, `calculus.js` | Drift, speech selection, math |
| `qcompile.js`, `archives.js`, `crawler.js` | Query compiler and cited lookup |
| `dynamics.js` | Rates, conservation, what-if |
| `mea_p.js`, `mea_k.js` | Problem proposals and grammar-cell proposals |
| `governance.js`, `containment.js`, `privacy.js` | Permission, one containment route, local vault |
| `render.js`, `app.js` | Output forms and the eight tabs |
| `toolbench.js`, `toolbuilder.js` | Declared tools and user tools |
| `economy.js`, `ledger.js`, `operator.js` | Counts, attribution, backup |
| `sb_sync.js` | Optional Supabase sign-in. Blob sync attaches in `sb_blobs.js` |

`source/verify/` holds the suite: `run.js` for a full run, `targeted.js` for the Pages list in `targeted.json`. `source/tools/` is prepare, release, publish, and live comparison. `source/data/feature_registry.json` is the feature list: 283 entries at version 4.9.117. The 4.9.116 list had 280. System Status shows a claim as proved when the suites linked to it passed in the verification run that built the page.

Sign-in is a magic link plus device public-key registration. Reasoning modules do not import the account client, and answers are the same signed in or signed out. Row Level Security is the server boundary. The account schema and the `register-device` function are under `supabase/`.

Rendered forms, each in an envelope `forge-rmc-output-envelope/v1`, are text, speech, JSON, JavaScript, Python, glyph, field, tone, dashboard, memory, and API. Text, speech, memory, and the non-executing API action are implemented. JSON, the code forms, and the dashboard are partial. Glyph, field, and tone are prototypes: a coherence picture and a trace sonification. They are not a musical score, and the app emits no `.hfield` file.

Build Doctor (`source/src/doctor.js`) reports schema, ledger, receipts, storage, tools, quarantine, reminders, and drift, and names a runbook step for each failure. It leaves the store unchanged.

## Release

Requirements are Node 20 and Python 3. From a fresh clone, the full gate is:

```
git clone https://github.com/BogaertN/forge-mobile.git && cd forge-mobile && sh source/tools/release.sh
```

`source/tools/release.sh` changes into `source/` and runs four steps. From the repository root the same steps are:

1. `sh source/tools/prepare_clone.sh` decodes lexicon data, icons, and `vendor/` into git-ignored paths under `source/`.
2. `node source/verify/run.js` runs the full suite. A check with no authoritative reference is `NOT_RUN` and is never counted as passed. Output stays under `_release/`.
3. `python3 source/build.py` builds when the summary exists, nothing failed, passed plus not-run equals the total, the version matches `source/VERSION`, and the tree hash matches. It writes `_release/site` (the Pages tree, including `BUILD_MANIFEST.json` and `build-info.json`) and `_release/single`. The build date is the commit date.
4. `node source/tools/verify_release.js` checks file hashes against the manifest, one version across the artifact, zero failed and zero not-run, the commit, the tree hash, and a clean git status. A summary that still contains not-run checks can pass step 3 and fail this step.

GitHub Pages (`.github/workflows/pages.yml`) runs `sh source/tools/publish.sh` and uploads `_release/site` only. Publish uses the same prepare, build, and release check, with the targeted list in `source/verify/targeted.json` in place of the full suite. That list is the publish gate for 4.9.117: 254 passed of 254, 0 failed, 0 not run. Held-out and mutation stay named outside that total. The 4.9.116 gate was 246 passed of 246, 0 failed, 0 not run. The 4.9.115 gate was 237 passed of 237, 0 failed, 0 not run. The 4.9.114 gate was 234. The 4.9.113 gate was 231. The live 4.9.112 artifact reported 226 tests. A live probe at the end of publish does not block the upload.

`BUILD_MANIFEST.json` is the hash list of the site just built. After a local build of the same commit, `node source/tools/verify_live.js https://bogaertn.github.io/forge-mobile/` compares the live manifest and every listed file with `_release/site`.

## Boundaries

The reasoning core makes no language-model call, uses no embeddings, and runs no learned classifier. The Tool Bench is the tool surface.

Harmonic Conductor Studio is a separate application for music and `.hfield` scores. Forge Mobile does not emit `.hfield`.

Genesis Node, a tool marketplace, payment, and agent products sit outside this app. An optional paired home node (`source/tools/forge_node.py`) is available as a helper. Sale, transfer, and redemption are unavailable. Contribution counts are not currency.

A 3-D scene preview on the phone is labelled a preview. ProtoForge execution is unavailable here; a plan remains a proposal.

The Identity Vault tab is the local store in `source/src/privacy.js`.
