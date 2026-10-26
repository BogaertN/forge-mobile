# forge-mobile

Forge Mobile is an installable phone app: a deterministic language kernel with no language model. You ask it something. It compiles the sentence, compares candidate meanings, checks them against memory and a symbolic world, renders one sentence, and checks that sentence by parsing it again. Anything it stores is a governed write. Anything it looks up is evidence, not a fact.

The version is the contents of [`source/VERSION`](source/VERSION). This tree reads 4.9.110. The live app is https://bogaertn.github.io/forge-mobile/

The published record is `build-info.json` on that site. The 4.9.110 artifact at commit `9c1b758e43d1e84e371fa2fb139006b2f6f76ff7` records `registry_count` 268, tests 210 passed of 210 (`fail` 0, `not_run` 0), and service-worker cache `forge-mobile-v4.9.110`. That 210 is the targeted Pages gate in [Release and verify](#release-and-verify). It is not the full `verify/run.js` total.

The law for this app is `source/CONFLICTS.md`, `source/VERSION`, and `NEXT_BUILD.md`. The feature list is `source/data/feature_registry.json`.

## What it is

Forge Mobile is a progressive web app (`source/manifest.json`, `source/sw.js`). It installs on a phone, works from the cached site, and shows eight tabs: Forge Output, Identity Vault, Tool Bench, RMC Memory, Deep Dry-Run, Context Library, Audit / Receipts, and System Status (`source/index.html`).

Ask Forge is the conversation. The placeholder says it will not execute commands. The microphone uses the device’s speech recognition, and that text is marked unverified. A reply is derived by rules and carries a trace: rule ids, gate outcome, drift, the containment route, Echo, and the meaning manifest. There is no language model, embedding, RAG, or learned classifier on this path. The permission switches `classifier` and `localModel` default to off and have no built model (`source/src/governance.js`).

A turn is one pipeline:

1. **Language Core** compiles supported language into symbolic meaning and, later, realizes a selected meaning back into language (`source/src/grammar.js`, `source/src/derive.js`).
2. **RMC** (the reasoning, trace, and memory spine) runs candidate routes, applies warrants, and selects one meaning (`source/src/kernel.js`).
3. **World** is two stores. The turn world answers the sentences in front of it. The persistent world head is what a remember commits (`source/src/reason.js`, `source/src/kernel.js`).
4. **Render** turns the selected meaning into one of 11 output forms (`source/src/render.js`). The chat uses the text form.
5. **Echo** parses that text again with the same Language Core. A mismatch blocks the reply.

Every governed action goes through the permission service (`source/src/governance.js`). Understanding a sentence is not permission to store it, send it, or run it.

The app is labelled a prototype outside the Forge 1.0 phase gates (`mobileStatus` defaults to `prototype`). Hashes are SHA-256. BLAKE3 is not built.

## How a turn works

`Kernel.process` (`source/src/kernel.js`) is the only conversation entry.

**Ingestion.** The text is Unicode-normalized. Sensitive values (passwords, keys, card numbers, and the other shapes in `source/src/privacy.js`) are replaced with the word “sealed” before any reasoning. The kernel, the trace, and memory see that word. If a remember of such a value is allowed and the vault is unlocked, `source/src/forge.js` queues the value and the vault encrypts it on the device (AES-GCM, key from the passphrase). A locked vault does not keep it. The turn id `ψ_id` is the SHA-256 of the turn number, the loop, and the redacted text.

**Discourse before the single sentence.** A message may be rewritten or split before the route race: a fronted topic (“About Paris, where is she?”), a contrastive “not”, a tag question, an embedded “tell me what…”, a phatic lead (“hi, …”), or a semicolon that keeps a prohibition inside its own clause. Several declarative sentences are read one at a time when the turn world does not own the whole message. A dynamics scenario (a rate problem, a measurement report, a what-if) is kept whole.

**Candidate routes.** RMC runs each applicable route in a sandbox so a losing route does not keep its writes. The routes, in report order, are `world.preflight`, `turn.reentry`, `capability.frame`, `gks.quantity`, `world.proof`, `math.gp014`, `directive.frame`, `justify.followup`, `world.dynamics`, and `language.core`. World preflight is measured only when the input is longer than 2000 characters. An input past `MAX_INPUT_CHARS` (100000, `source/src/reason.js`) is read by no other route: only the typed `INPUT_LIMIT` result that preflight measured is proposed.

**Selection.** Echo is a hard gate: a surface that does not round-trip is rejected. An ambiguous Echo is kept and the turn re-routes it to a clarification. A candidate that completes a clarification Forge held on the previous turn is the continuation. Among the rest, the order is proof completeness, then specificity (a specific route over the general language core; specific routes do not outrank each other), then lower drift ε_s, then the score M+P+U+N−D. Candidates equal on every key with different decisions are a true tie: Forge lists them and waits for “1” or “2”. The winner, the losers, and the key that decided are on `trace.selection`.

**Drift, then permission to speak.** After a meaning is chosen, `DRIFT_TABLE` says whether this turn may be projected or written. A hard stop or a forbidden phase jump (Φ5→Φ8, or Φ4→Φ8) goes through the χ hard-stop check. The correction band runs χ once and is measured again. Quarantine is not spoken as a stored fact. Containment then assigns exactly one route (see [Reasoning](#reasoning)).

**Realize and Echo.** `derive.js` realizes the meaning as a sentence. Echo tokenizes that sentence with the same analyser and requires one analysis that is the planned vākya. Independent re-verification runs when the caller supplies it (math does). There is no word-overlap score. If derivation throws, the derivation trail is forbidden, or Echo fails, the reply is empty, nothing is stored, and `trace.language` is `LANGUAGE_UNEXPRESSIBLE`.

**What may be stored.** A plain statement is acknowledged. It can become a working fact for this conversation. It is not lasting memory. “Remember …” is a request to commit, and it writes only inside the projectable band, with Echo passed, and with the permission service allowing `memory.write`. A research lookup does not write memory, the world head, or the shared knowledge store. A Suppose branch does not write them either. A failed Echo writes nothing. The world head moves only when that commit’s projection publishes, described below.

Every finished turn is stamped with one `intent_kind`.

## Language

The Language Core is a bidirectional compiler. Inward: tokenize, tag, derive every reading, assign kāraka roles, keep scope. Outward: the same roles become a sentence, with agreement, tense, aspect, negation and do-support, and lists. Every applied rule id is on the trace. There is no statistical guess and no similarity pick.

Closed-class words (determiners, pronouns, auxiliaries, modals, prepositions, conjunctions) live in `grammar.js`. Open-class words come from the lexicon. The seed concepts are in `source/src/lexicon.js`. The large lexicon is Princeton WordNet 3.0, in tiers (core, extended, complete), loaded lazily. The licence is `source/data/WORDNET_LICENSE.txt`. WordNet is for tagging, morphology, frames, and relation structure. “Define …” of a WordNet-only word is not answered by pasting a gloss. When controlled senses compete, the turn stays open and asks. An unknown word in a remember-request asks what the word is. It does not invent a meaning.

The request compiler (`source/src/qcompile.js`, registry id `FB-11`, claim Implemented) compiles a question into `FORGE-QUERY-COMPILED/v1`: subject, predicate, and the asked relation (who, what, where, when, why, how, quantity, verdict). Research retrieval uses that record. Expansions above the 0.35 band are recorded and not used.

`intentOf` names the job the route already did. The set is exact:

| `intent_kind` | The turn was |
|---|---|
| `READ` | a recall, a yes/no over memory, a list, an inspect |
| `DERIVE` | a checked world proof, an admitted rule, math, a rate, or conservation |
| `EXPLAIN` | a why, a how, a definition, or a cause walked backward |
| `SIMULATE` | a Suppose branch, a bare Suppose, or a dynamics what-if |
| `PROPOSE_EVIDENCE` | proposals, exploration, or a research answer |
| `REQUEST_COMMIT` | remember, a note, or a refusal to store |
| `CLARIFY` | an ambiguity, an unresolved “it”, an unattached phrase |
| `UNSUPPORTED` | an action the register does not contain, or a structure the grammar refuses |

A research answer is stamped `PROPOSE_EVIDENCE` in `source/src/forge.js`.

What the live compiler actually handles, as behavior rather than as a registry row:

- Memory questions over stored relations: what, who, where, when, whether, and “what do you know about”.
- Role questions, including whose-relatives, how-means, how-state, and why.
- Pronouns and demonstratives. One fitting antecedent binds. Several stay open. On a research lead, it/they/he/she follow the article subject; past the lead, only a local antecedent.
- Lists of any length as one object, with or without an Oxford comma. A comma before a new finite clause is still a new clause. Naming asides (comma, dash, aka, a reduced relative) drop before the roles are assigned.
- Year order. Two stored events with non-overlapping years answer before/after. A from-year/to-year span is an interval. Nothing new is stored for the comparison itself.
- Cause. “Does A cause B?” follows stored links forward. “What causes B?” walks them backward and cites every upstream cause. A what-if is an intervention, not that walk.
- Conservation and rates. A stated stock plus a finite amount in or out answers how much remains, same unit, exact arithmetic. A rate stays a rate. A missing conversion, a mixed dimension, or an unqualified gallon against liters produces no number.
- Suppose, assume, imagine, what if, and hypothetically. The reply says it answered in a branch and that the branch does not change the world. A remembered fact can be the base of that branch. A later question outside the branch does not see the overlay.
- Rule proposals. “Show the proposals” / “explain the proposals” may offer a hypothesis from stored facts. Nothing is admitted until a tap, and only while drift stays at or under 0.35 and the replay does not contradict.
- Math, in `source/src/algebra.js` and `source/src/calculus.js`: exact rationals, polynomials, factoring, linear systems, derivative and integral of polynomials, and unit conversion with exact factors. An equation of degree above 4 is refused. Degree 3 or 4 with no rational root is a labelled numeric root (fixed Durand–Kerner), and the solver records whether the released number re-verified. A malformed expression or a divide by zero is a refusal, not a guess.

This is controlled, compiled English. It is not unrestricted conversation and it is not a store of world knowledge.

## World and memory

### The turn world

`source/src/reason.js` compiles the sentences of one turn — facts, rules, and a final query, including content words it has not seen before — into `SemanticCandidate/v1` and an immutable `TurnWorld/v1`. Closure is finite and paraconsistent: a contradiction, support, a refutation, and “the premises do not decide” stay different results. The selected proof is replayed independently. RMC may select only a checked result. The turn world does not write memory and does not move the persistent head.

### The persistent world

Stored facts also project into `FORGE-WORLD-STATE/v1` (entities, relations, attributes). On a successful remember, `publishWorldHead` commits a separate snapshot, schema `forge-world-state/v1`, world id `world:local`. Its `version_id` (`wv:`) is not the MemoryStore generation number. The snapshot carries `parent_versions`, a content hash, and a `wrc:` commit receipt. The next head is written to a stage and becomes current only after that stage reads back. A failed stage leaves the previous head in place.

A Suppose branch, a conservation step, and “propose problem physics” do not move the head. An Echo failure does not move it. The memory row is written and read back before the head is published, and a failed stage does not roll that memory row back. Forgetting a premise withdraws dependents that rested on it (forgetting “Beryl is inside Cobalt” withdraws “aster is in cobalt”) and commits the next head with those items invalidated. This is not a full bitemporal journal.

### What “remember” means

Memory rows keep the clause, entities, provenance, and time. Contradictions (polarity, a single-valued attribute, exclusive classes) ask rather than overwrite. “Instead” or “actually” replaces, and the old row moves to cold storage. Forgetting never erases: the row moves to cold storage, and the reply says so. Hard delete is not built (`hardDelete` is `never`).

A research or other admitted claim is named on the reply:

- **projectable** (ε ≤ 0.35, supported): Forge offers remember and does not store it. “Remember that …” is the commit.
- **correction** (0.35 < ε < 0.40): χ runs once, then the turn is measured again. That intermediate step is not itself an admission.
- **contested / held** (quarantine 0.40–0.80, a conflict, a refutation, or a correction that stays above 0.35): a held research claim with a generated clause sits in `held_writes` as `research_intake`. `commitHeld` stores that row only with a user tap. “Show quarantine” and “show containment” list those held claims. A projectable claim is not on that list. A contested claim that was not held is named on the reply and is not stored.
- **refused** (above 0.80, or a forbidden transition): not held, not stored.

The intake object (`source/src/qcompile.js`) keeps `stored` and `shared_kb` false. `PERM-RESEARCH-NO-SILENT-WRITE` denies a silent write of a research claim.

### Shared knowledge

The shared knowledge store is empty on purpose. `NEXT_BUILD.md` locks it until Nic enables it. The permission switch `sharedLayer` defaults to `off`, so exchange with another device is denied (`PERM-SHARED-LAYER-OFF`). A live lookup is never stored as a fact. `source/src/shared.js` can accept a reviewed manifest, and that record is `evidence_only`: a signature says who signed it, not that it is true. Vault contents cannot enter. `source/src/gks.js` can pin a signed snapshot; the language path does not seed one.

### Economy, ledger, backup

The Memory Economy (`source/src/economy.js`) counts contributions. It does not pay anyone. The lifecycle is a candidate, then a signed BreathValidation by a reviewer who is not a contributor and must give evidence, then a finalized capsule. A later nullification appends an event. It does not edit the capsule. Weights are exact rationals: first-breath co-creators named in the author-signed body who sign that draft before publication get ×1; a later co-signer gets 1/3; a fork ancestor’s ×1/2 is a local interpretation and counts zero on another device until the signed lineage resolves. Foreign credit is rebuilt on the receiving device from the signed manifest. Anything missing or mismatched is quarantined and counts zero. `economic_processing` is `NOT_AUTHORIZED`. `payout_hook` is null. The local reviewer is not a Memory Steward.

The attribution ledger (`source/src/ledger.js`) is one hash chain per device. An export is the full chain or a `forge-ledger-checkpoint/v1` anchor. A divergent foreign chain is recorded as a conflict. It does not replace this device’s chain.

Backup (`source/src/operator.js`) is one system: portable encrypted backup, inspect, atomic restore, rollback. The file carries its own KDF parameters (PBKDF2-SHA-256) and salt, so a fresh install can open it. Size, depth, and KDF bounds are checked before any key derivation or decode. Restore writes a new storage generation, reads it back, then flips one active-generation pointer. A failure before that flip leaves the old generation byte-identical. Old v1 files go through the labelled legacy converter and then the same path. The passphrase rule is at least 8 characters. A lost passphrase cannot be recovered.

The Mobile Identity Vault (`source/src/privacy.js`) is this local encrypted store. It is not the Identity Vault product.

## Reasoning

### Drift and versioned operators

`source/src/kmath.js` holds the one drift table (`DRIFT_TABLE`, contract `drift-table` `nic-2026-10-14/v1`):

| ε_s | Band | What the turn may do |
|---|---|---|
| ≤ 0.35 | projectable | may be projected; the only band in which memory may be written |
| 0.35 < ε_s < 0.40 | χ correction | χ once (`chiCorrect`), then measure again; a write this turn is allowed only if the remeasured ε_s is ≤ 0.35 |
| 0.40 ≤ ε_s ≤ 0.80 | quarantine | drift archive only; not projected, not written |
| > 0.80 | hard stop | Ĉ archival unless the χ hard-stop law fires |

χ is the correction function. It does not authorize a write by itself. The two χ contracts stay distinct: `chi-correction` `R-CHI-1/v1` is the canonical correction (`chiCorrect`); `chi-invoke` `R-CHI-1/invoke/v1` is the hard-stop check (`applyChi`, `chiConditions`). When the hard-stop check fires, the turn is re-routed with a restricted meaning. When it does not, the turn is sealed (Ĉ).

`MATH_CONTRACTS` (`FORGE-MATH-CONTRACT/v1`) also lists `drift-measure` `addendum-3/v1`, `rsoc-select` `RSOC/v1`, and `phase-scheme` `rmc-rpmc/v1`. A turn’s trace cites the entries that ran (`trace.math_contracts`, `trace.phase_scheme_id`). The phase catalogue in use is Φ1 Initiation through Φ9 Return (RPMC/RMC names). The phase scheme’s status is `reconstruction`. It is not a numerical identity of RSOC phases with RMC phases. `equivalenceClaim` refuses a text that names two or more of ROC, CFBC, and RSOC and uses equivalence language: `SOURCE_NOT_VERIFIED`, `equivalent: false`, rule `I.1`. Those originals are not in this tree, and that function is not a conversation route. Paper bands 0.40/0.80 and the older Addendum figures 0.50/0.78/0.80 are not the write law.

RSOC also chooses among rival speech candidates. `rsocSelect` fuses a candidate with the evidence only inside the alignment bound, then locks exactly one; none or several fail closed. `rsocAdmit` drops an unlawful reading, fuses duplicates, locks a single survivor, and holds several open. A sever in `derive.js` splits a clause-list object of a that-verb into separate clauses when the set of clauses is unchanged.

### Containment

`source/src/containment.js` assigns exactly one route:

- `active_stack_candidate` — the ordinary live turn
- `correction_queue` — a clarification, a confirm, a forget or a replace, or a χ grace re-route (`restricted`)
- `spc_cold_storage_required` — a hard stop or a forbidden phase transition. A forgotten fact is moved into cold storage by the forget; that turn’s route is `correction_queue`
- `dream_state_quarantine_candidate` — the selected meaning is a statement opened by Suppose, imagine, hypothetically, what if, let us say, or “I dreamed / imagined”, with no question attached. A dynamics what-if that the dynamics route answers is not this route. The dream row is not merged into memory or the world head
- `drift_archive_only` — the quarantine band, including a χ correction that stays above 0.35
- `ghost_loop_containment_required` — the turn could not be resolved: no frame, an unknown the grammar could not structure, an Echo clarification, a derivation failure, or an Echo failure

“Show quarantine”, “show cold storage”, and “show containment” list the route, the tier, and a short label. An empty list says so. A forgotten row is WARM unless policy `forgottenTier` is COLD. DEEP is the breach and attempt-limit seal. “Resurrect …” or “bring back …” in the conversation, on a WARM row, is a proposal. It does not write memory. The Memory-screen Resurrect button still writes after the existing seven gates and a tap. `must_archive` is a comment on the routing law, not an input. There is no hardware SPC.

### MEA-P and MEA-K

MEA-P (`source/src/mea_p.js`, schema `MEAProblemManifest/v1`) evolves an unresolved problem manifest. It does not select meaning, render, or write memory. Operators are data: `derive`, `hypothesize`, `split`, `merge`, `seal`, `record`, `archive`, `detect_unknowns`. `llm_generate`, `external_search`, and `run_simulation` are registered and do not execute. Ranking is gates, then Pareto, then a declared lexicographic order. The display score does not rank.

“Propose problem physics” runs that cycle on the shipped problem `canon:physics-144hz`. A candidate is spoken only when it is projectable (ε_s ≤ 0.35), standing is stamped, and novelty is inside the existing bounds. The spoken 144 Hz line is a hypothesis, not a verified claim. Parked candidates (correction, quarantine, hard stop, novelty past the bound) go to the problem archive after Echo passes. A tap (`meaCommit`) is the only seal. A propose does not write memory, the world head, or the shared store.

After that tap, a later “propose problem physics” keeps the same problem id and the same goal. Candidates already archived or already on the manifest are carried. They are not spoken again and they are not archived again. The reply names the open measurement and the open choice. One declared frame cell and one declared parser cell ride along as `MEAMutableCell/v1` data with `applied: false` and `authority: "proposal"`. Those cells are not installed. Each turn calls `mea_k.apply` on the adopted grammar manifest; with none adopted, that call restores the shipped tables. A continuation does not store another manifest until a tap, and a cycle with nothing new to resolve does not store one either.

MEA-K (`source/src/mea_k.js`, schema `FORGE-MEA-K-MANIFEST/v1`) is the other lane. It proposes typed deltas over declared cells only: pronoun-gender lexicon classes, a few complement frames, and membership of the open parser categories (`source/data/mea_k_cells.json`). A parser delta cannot touch a closed category, empty a category, or key a rule to one sentence. Adoption is `adoptManifestK` plus a user tap. Withdrawing it restores the shipped tables. The physics continuation above does not adopt an MEA-K manifest.

“Show the problems” lists the problem manifests. “Show problem physics” has no result until a tap has sealed one. “Show the proposals” is the rule-induction surface, not the physics cycle.

### Dynamics

`source/src/dynamics.js` is exact rational arithmetic over stated scenarios: levels, constant rates, conservation of an amount, causal what-if, and conflicting measurements. It does not store, fetch, or average. A measurement that disagrees is kept beside the equation. It does not replace the equation. An association is not treated as a cause.

### Evidence and tools

The Tool Bench (`source/src/toolbench.js`) is a set of declared manifests. Each has `uses_model: false`. The kernel invokes one only from a selected predicate frame. The permission service decides the call. The result is an evidence record on a hash-chained log. It is not authority and not memory. The old EchoForge advisory model lane stays excluded. The switch `echoForge` defaults to `tool_bench`.

Research (`research.web`) is a read-only lookup. The default research switch is `on_request`. A factual question that no stored fact, shared (GKS) fact, or private fact answers counts as that request (AQ-1 in `source/CONFLICTS.md`). The vault must be unlocked, because the excerpts are sealed there. Personal questions, commands, greetings, and tool turns do not take this path. Archives are keyless public endpoints in `source/src/archives.js`, ranked by evidence class (primary authority, then peer-reviewed, then structured reference, then encyclopedia). Co-occurrence of two things in one statement is not a cause. The query compiler scores a source by subject drift and whether the sentence fills the asked relation. The reply names the archive and the class. It does not write memory.

Page capture is tracker-free (no headers object, no credentials, no referrer) and sealed the same way. Sites that are not readable from the browser need a user-owned node or proxy, and that URL must be https. There is no third-party relay (`fetchPath` defaults to `direct_cors_only`).

User tools (`source/src/toolbuilder.js`) are ForgeScript in a worker with no network, no page, and no storage. Tests must pass before a tool is enabled. Three runtime failures disable it. Results are evidence only.

Deep Dry-Run runs the pipeline on an isolated copy of the stores it snapshots. That copy is discarded. The conversation store is unchanged. The tab shows the trace.

## Where the code lives

`source/src/` is the app. The modules a reader usually needs:

| Path | Role |
|---|---|
| `kernel.js` | The turn: routes, drift, containment, memory writes, world head, intents |
| `grammar.js`, `derive.js`, `echo_types.js` | Language Core in, language out, Echo |
| `reason.js`, `infer.js`, `world_rules.js` | Turn world, checked proofs, relation rules |
| `kmath.js`, `algebra.js`, `calculus.js` | Drift, RSOC, versioned math contracts, the math lane |
| `qcompile.js`, `archives.js`, `crawler.js`, `provenance.js` | Query compiler and cited lookup |
| `dynamics.js` | Rates, conservation, causal what-if |
| `mea_p.js`, `mea_k.js`, `mea.js`, `evolve.js`, `ede.js` | Problem lane, grammar-cell lane, operator algebra |
| `governance.js`, `containment.js`, `privacy.js` | Permission, one containment route, local vault |
| `render.js`, `app.js` | Eleven output forms, the eight tabs |
| `toolbench.js`, `toolbuilder.js`, `fscript.js` | Manifest tools and user tools |
| `economy.js`, `ledger.js`, `shared.js`, `operator.js` | Counts, attribution, shared layer, backup |
| `justify.js` | Justifications and withdrawal of derived rows |
| `forge.js`, `forge_spine.js`, `msm.js` | Contract spine, tool results, MSM-v1 |
| `sb_sync.js` | Supabase sign-in client. Private blob sync attaches to it (`sb_blobs.js`) |
| `doctor.js` | Checks and fix instructions. It does not repair |

`source/verify/` is the verifier: `run.js` (full suite), `targeted.js` (the Pages list in `targeted.json`), and one suite file per area. `source/tools/` is the release pipeline (`release.sh`, `publish.sh`, `prepare_clone.sh`, `shipset.js`, `verify_release.js`, `verify_live.js`), the optional home node (`forge_node.py`), and lexicon builders. `source/data/feature_registry.json` is the claim list. `supabase/` is the optional account schema and the `register-device` Edge Function. `source/CONFLICTS.md` is how conflicting sources were settled. `NEXT_BUILD.md` is the release order and the standing laws.

The registry has `count` 268 and `version` 4.9.110. System Status shows a claim as proved only when its linked suites passed in the verification run that built the page. `R483-QC` through `R496-WHOSE` are Partial on purpose: those compiler slices were already running and were registered in 4.9.110. `FB-11` stays Implemented. The `claims` object is one off the feature-array tally (object Implemented 112 and Partial 106; array Implemented 113 and Partial 105). That delta stays.

`sb_sync.js` does magic-link sign-in and device public-key registration. `sb_blobs.js` attaches private blob sync onto that same client. Storage and sync only. The reasoning modules do not import either file, and answers are the same signed in or out (`SBSYNC-ISOLATION` in `source/verify/s2_suite.js` and `source/verify/run.js`). Row Level Security is the server-side boundary.

Output forms (`source/src/render.js`), each with a scope label and envelope `forge-rmc-output-envelope/v1`: text, speech, json, `code.js`, `code.py`, glyph, field, tone, dashboard, memory, api. Text, speech, memory, and the non-executing API action are implemented. JSON, the code forms, and the dashboard are partial. Glyph, field, and tone are prototypes. The tone is a trace sonification. The field is a coherence picture. Neither is music and neither emits `.hfield`. `HCS_BOUNDARY.adapter` is `none (not live)`.

Build Doctor (`source/src/doctor.js`) reports schema, ledger, receipts, storage, tools, quarantine, reminders, and drift, and the service worker when that check is supplied. Each failure names a runbook step. It does not change anything.

## Release and verify

Requirements: Node 20 and Python 3. The Pages workflow uses Python 3.12, installs `cryptography` from the hash-locked file `source/requirements-ci.txt` (`python -m pip install --require-hashes --no-deps -r source/requirements-ci.txt`), and pins each action to a commit SHA. That package is for the home-node tests.

Full suite, from a fresh clone:

```
git clone https://github.com/BogaertN/forge-mobile.git && cd forge-mobile && sh source/tools/release.sh
```

`source/tools/release.sh` changes into `source/` and runs four steps. Verification is the source of release truth. From the clone root the same steps are:

1. `sh source/tools/prepare_clone.sh` decodes `data/*.gz.b64`, `icons/*.b64`, and `vendor/` from the repo root into git-ignored paths under `source/`.
2. `node source/verify/run.js` runs the full suite. It prints `TOTAL passed/total passed= failed= not_run=`. A check with no authoritative reference throws `NOT_RUN` and is never counted as passed. External comparisons use the hashes in `source/test/external_fixtures.json`. Output goes only under `_release/` (git-ignored; override with `$FORGE_ARTIFACT`). It does not write a tracked file.
3. `python3 source/build.py` refuses unless `_release/verify/summary.json` exists, `failed` is 0, `passed + not_run` equals `total`, the summary version equals `source/VERSION`, and the summary tree hash equals this tree. It writes `_release/site/` (the Pages tree, including `BUILD_MANIFEST.json` and `build-info.json`) and `_release/single/` (single-file builds). The build date is the commit date, so the same commit builds the same bytes. `sw_cache` is `forge-mobile-` plus the version. `registry_count` is the registry `count`.
4. `node source/tools/verify_release.js` fails unless every deployed file matches `BUILD_MANIFEST.json` and no shipped file is unlisted; one version appears in `VERSION`, the summary, build info, `build-info.json`, the release record, the registry, `features.js`, the web manifest, the service-worker cache name, and the build manifest; one test total appears in the summary, build info, the release record, the build manifest, and the per-suite totals; `failed` is 0 and `not_run` is 0; the commit equals `git rev-parse HEAD`; the verified tree hash equals the built tree hash; single-file CSP hashes match; no secrets ship; and `git status --porcelain` is empty. A summary that still has `NOT_RUN` can pass step 3 and still fail this step.

Pages (`.github/workflows/pages.yml`) does not run `release.sh`. It runs `sh source/tools/publish.sh` and uploads only `_release/site`. `publish.sh` uses the same prepare, build, and `verify_release.js` steps, and runs `node verify/targeted.js` instead of the full suite. The list is `source/verify/targeted.json`. For 4.9.110 that list is what produced 210/210 on the live artifact. The live probe at the end (`node tools/live_probe.js --limit 25`) does not block the publish. `release.sh` remains the full-suite command.

`BUILD_MANIFEST.json` is the hash list of the site that was just verified. After a local build of the same commit, `node source/tools/verify_live.js https://bogaertn.github.io/forge-mobile/` fetches the live manifest and every listed file and compares hashes. It exits 0 only on a full match.

Held-out and mutation scores are reported. They are not a pass gate. The held-out sentences are not in the shipped kernel (`source/verify/heldout/`).

## Boundaries

These stay outside this PWA. Adapters for them are not live.

- **No model in the core.** No LLM call, no embedding, no RAG, no learned classifier. EchoForge’s model lane is refused. The Tool Bench is the no-LLM bench.
- **Harmonic Conductor Studio** owns `.hfield` and music rendering. Forge Mobile never emits `.hfield`.
- **Identity Vault** as a product is not this app. The tab of that name is the local vault in `privacy.js`.
- **Genesis Node** is not built here. `nodeSync` defaults to off. A paired home node (`source/tools/forge_node.py`) is a partial, optional path (registry `L-08` stays Partial).
- **Marketplace, payment, and CT-as-money** are not authorized. `marketplaceTransfer` is `disabled`. Sale, transfer, and redemption are denied. Offers, if drafted, have no price and do not transfer.
- **Agent products** (Gilligan, Neo, Athena) are not built here. Pattern counts in `operator.js` are counts, not an agent.
- **ProtoForge** execution is refused on the phone (`source/CONFLICTS.md` #17). A plan is a proposal. The labelled 3-D preview is not a PyBullet result.

Ledger v2 “General Language Runtime NOT LIVE” and Capability Register L-08 “Parked post-1.0” are stale for this PWA. The language path here is the live Language Core, and this installable app is Forge Mobile. Those lines may still describe desktop Forge 1. This repository does not rewrite the Drive documents. `L-08` stays Partial because a paired home node and distributed operator clients are not a finished product.

## What not to do

- Do not start 4.9.111 from `NEXT_BUILD.md`. That file says the six core items through 4.9.110 are done for Forge Mobile. It also says not to build Genesis Node, HCS, the marketplace, CT-as-money, or an agent product from that file.
- Do not treat Drive docs, Ledger v2, or the Capability Register as the acceptance source for this app. `source/CONFLICTS.md`, `source/VERSION`, and `NEXT_BUILD.md` are.
- Do not “fix” the registry `claims` tally so it matches the feature array. CONFLICTS v4.9.110 says the delta stays.
- Do not seed the shared knowledge store, and do not store a live lookup as a fact.
- Do not add an LLM, an embedding, or a learned classifier to the core. Do not build Genesis Node, HCS, the marketplace, CT-as-money, or an agent product in this tree.
- Do not describe χ as anything other than the correction function.
