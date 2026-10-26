# forge-mobile

Forge Mobile is an installable PWA. A turn goes Language Core, then RMC, then the world, then render, then Echo. The Language Core (`source/src/grammar.js`, `source/src/derive.js`) is a deterministic Pāṇinian-style compiler: supported language becomes symbolic meaning, and a selected meaning is realized back into language. RMC compares candidates, applies warrants, and selects a supported conclusion. Render (`source/src/render.js`) produces one of 11 output forms. Echo re-parses that surface with the same Language Core. There is no language model, embedding, RAG, or learned classifier on this path. Every governed action goes through the permission service (`source/src/governance.js`).

The version is the contents of [`source/VERSION`](source/VERSION). This tree reads 4.9.110. Live site: https://bogaertn.github.io/forge-mobile/

The published record is `build-info.json` on that site (`version`, `commit`, `registry_count`, `tests`, `sw_cache`). The 4.9.110 artifact at commit `9c1b758e43d1e84e371fa2fb139006b2f6f76ff7` records `registry_count` 268, tests 210 passed of 210 (`fail` 0, `not_run` 0), and `sw_cache` `forge-mobile-v4.9.110`. That test total is the targeted Pages gate below. It is not the full `verify/run.js` total.

Forge Mobile acceptance is `source/CONFLICTS.md`, `source/VERSION`, and `NEXT_BUILD.md` (CONFLICTS v4.9.110). Those files hold the release notes from 4.9.97 through 4.9.110. Do not start 4.9.111 from `NEXT_BUILD.md`.

## What is live through 4.9.110

### Typed intents

Every finished turn carries one `intent_kind` (`source/src/kernel.js` `intentOf`): `READ`, `DERIVE`, `EXPLAIN`, `SIMULATE`, `PROPOSE_EVIDENCE`, `REQUEST_COMMIT`, `CLARIFY`, or `UNSUPPORTED`. A research answer is stamped `PROPOSE_EVIDENCE` in `source/src/forge.js`. When derivation throws, the derivation trail is forbidden, or Echo rejects the surface, the reply stays empty, nothing is stored, and `trace.language` is `LANGUAGE_UNEXPRESSIBLE` (4.9.103, `verify/r4103_suite.js`).

### Turn world and persistent W_v

`source/src/reason.js` still compiles controlled-English facts, rules, and a final query, including previously unseen content identifiers, into `SemanticCandidate/v1` and an immutable `TurnWorld/v1`. It derives positive and negative consequences, replays the selected proof, and RMC selects only checked results. Unsupported structure stays a typed limitation. The turn world does not write the persistent head.

A remember publishes a separate snapshot, schema `forge-world-state/v1` (`source/src/kernel.js` `publishWorldHead`, 4.9.105, `verify/r4105_suite.js`). `version_id` (`wv:`) is not the MemoryStore generation. The snapshot carries `world_id` `world:local`, `parent_versions`, a content hash, and a `wrc:` commit receipt. The projection underneath stays `FORGE-WORLD-STATE/v1`. The next head is staged and becomes current only after it reads back. A Suppose branch, a conservation step, and “propose problem physics” leave the committed head in place. An Echo failure stores nothing and does not commit a head.

### Evidence admission and quarantine

Research standing and ε_w go through the one drift table (`source/src/qcompile.js` `intakeStanding`). The reply and the trace name the admission: `projectable`, `contested`, `held`, or `refused` (4.9.107, `verify/r4107_suite.js`). A supported claim at ε ≤ 0.35 is projectable and offers remember; the lookup does not store it. The correction band is χ once, then re-measured. Quarantine, conflict, or a correction that stays above 0.35 is contested. Above 0.80 is refused. `stored` and `shared_kb` on the intake object stay false. `PERM-RESEARCH-NO-SILENT-WRITE` denies a silent research write.

“show quarantine” and “show containment” list a held contested claim. They do not list a projectable claim. “remember that …” of a projectable claim is `REQUEST_COMMIT` and is what stores it. A held claim is stored only by `commitHeld` with a user tap.

A contained turn carries exactly one live route (`source/src/containment.js`): `active_stack_candidate`, `correction_queue`, `spc_cold_storage_required`, `dream_state_quarantine_candidate`, `drift_archive_only`, or `ghost_loop_containment_required` (4.9.106, `verify/r4106_suite.js`). Forget moves a fact to cold storage; the sealed row remains. The Memory-screen Resurrect button still writes after the existing 7 gates and a tap. `must_archive` is not a route input. There is no hardware SPC.

### Drift bands and versioned math

Nic’s drift table in `source/src/kmath.js` (`DRIFT_TABLE`, version `nic-2026-10-14/v1`) is the write law:

- ε_s ≤ 0.35: projectable; the only band in which memory may be written
- 0.35 < ε_s < 0.40: χ correction; never written this turn
- 0.40 ≤ ε_s ≤ 0.80: quarantine
- ε_s > 0.80: hard stop

χ is the correction function only. Paper bands 0.40/0.80 and the Addendum figures 0.50/0.78/0.80 are not the write law.

`MATH_CONTRACTS` (`FORGE-MATH-CONTRACT/v1`, 4.9.109, `verify/r4109_suite.js`) lists stable id and version: `drift-measure` `addendum-3/v1`, `drift-table` `nic-2026-10-14/v1`, `chi-correction` `R-CHI-1/v1`, `chi-invoke` `R-CHI-1/invoke/v1`, `rsoc-select` `RSOC/v1`, `phase-scheme` `rmc-rpmc/v1`. `chiCorrect` is the correction. `applyChi` / `chiConditions` are the hard-stop invoke. A turn trace cites the versions that ran. The phase scheme id is `phase-scheme/rmc-rpmc/v1` and its status is `reconstruction`. A claim that equates ROC, CFBC, and RSOC is refused: `SOURCE_NOT_VERIFIED`, `equivalent: false`, rule `I.1`. This tree does not contain ROC or CFBC originals.

### MEA-P and MEA-K

MEA-P (`source/src/mea_p.js`, schema `MEAProblemManifest/v1`) is the problem lane. “propose problem physics” reads `canon:physics-144hz` and runs the registered operators (4.9.104, `verify/r4104_suite.js`). `llm_generate` stays registered and non-executable. A candidate is spoken only when it is projectable (ε_s ≤ 0.35), standing is stamped, and novelty is inside the existing bounds. A tap (`meaCommit`) is the only seal. A propose does not write memory, the world head, or the shared KB.

4.9.108 (`verify/r4108_suite.js`) is a later cycle of that same problem after the tap: same problem id, same goal, parked archive rows and manifest claims carried and not spoken again. One declared frame cell and one declared parser cell ride as `MEAMutableCell/v1` proposal data with `applied: false`. `mea_k.apply` is not called. The live grammar tables stay as shipped.

MEA-K (`source/src/mea_k.js`, schema `FORGE-MEA-K-MANIFEST/v1`) is the other lane: typed deltas over declared lexclass, frame, and parser cells. Adoption is `adoptManifestK` and a user tap. 4.9.108 does not adopt one.

### Registry hygiene (4.9.110)

`source/data/feature_registry.json` has `count` 268 and `version` 4.9.110. `R483-QC` through `R496-WHOSE` are Partial: the 4.9.83–4.9.96 compiler slices were already in the compiler and were registered in 4.9.110 (`verify/r4110_suite.js`). `FB-11` (request compiler) stays Implemented. The `claims` object is one off the feature-array tally on purpose (object Implemented 112 and Partial 106; array Implemented 113 and Partial 105). CONFLICTS v4.9.110 says to leave that delta.

### Echo and the shared KB

Echo (`source/src/derive.js` `echo`) re-parses the rendered sentence with the same analyser. It passes when the reparse exists, the analysis is unique, and it is structurally identical to the planned vākya, and when independent reverification passes if the caller supplied one. The mode is a structural round trip with no word-overlap measure. The standing law in `NEXT_BUILD.md` names that match as predicate, arguments, polarity, modality, time, units, evidence status, and prakāra.

The same standing law locks the shared KB empty until Nic enables it. A live lookup is never stored as a fact. The only `shared_knowledge` writer in the tree is an explicit review accept in `source/src/shared.js`, and that record is `evidence_only`.

### Also shipped, recorded in NEXT_BUILD.md

From 4.9.97 through 4.9.102, and still on this tree: naming asides, list commas, and pronoun locality; demonstratives and year order; how-questions and cause inversion; conservation of a stated stock with no guessed unit conversion; counterfactual branches over an observed base that do not write memory or the world head; and MEA-on-phone rule proposals that admit only on a tap while drift stays at or under 0.35 (`verify/r497_suite.js` through `verify/r4102_suite.js`).

## Release

Requirements: Node 20 and Python 3. The Pages workflow uses Python 3.12, installs the hash-locked set with `python -m pip install --require-hashes --no-deps -r source/requirements-ci.txt` (the `cryptography` package, used by the home-node tests), and pins each action to a commit SHA.

Full suite, from a fresh clone:

```
git clone https://github.com/BogaertN/forge-mobile.git && cd forge-mobile && sh source/tools/release.sh
```

`source/tools/release.sh` runs four steps, in this order, after it `cd`s into `source/`. Verification is the source of release truth. From the clone root the same four commands are:

1. `sh source/tools/prepare_clone.sh` decodes the binary inputs into git-ignored paths under `source/`. The inputs are `data/*.gz.b64`, `icons/*.b64`, and `vendor/` at the repo root.
2. `node source/verify/run.js` runs the full suite. It prints `TOTAL passed/total passed= failed= not_run=`. A check with no authoritative reference throws `NOT_RUN` and is never counted as passed. External comparisons use the committed hashes in `source/test/external_fixtures.json`. The run writes only under the artifact directory `_release/` (git-ignored, default `<repo>/_release`, or `$FORGE_ARTIFACT`). It does not write a tracked file.
3. `python3 source/build.py` refuses to build unless `_release/verify/summary.json` exists, `failed` is 0, `passed + not_run` equals `total`, the summary version equals `source/VERSION`, and the summary tree hash equals this tree. It writes `_release/site/` (the Pages deployment, including `BUILD_MANIFEST.json` and `build-info.json`) and `_release/single/` (single-file builds). The build date is the commit date, so the same commit builds byte-identical files. `sw_cache` is `forge-mobile-` plus the version. `registry_count` is `feature_registry.json` `count`.
4. `node source/tools/verify_release.js` fails unless all of the following hold:
   - every deployed file matches `BUILD_MANIFEST.json`, and no shipped file is unlisted;
   - one version appears in `VERSION`, the verification summary, build info, `build-info.json`, the release record, the feature registry, `features.js`, the web manifest, the service-worker cache name, and the build manifest;
   - one test total appears in the summary, build info, the release record, the build manifest, and the per-suite totals;
   - `failed` is 0 and `not_run` is 0 (`passed` equals `total`); a summary that still has `NOT_RUN` can pass step 3 and still fail this step;
   - the commit equals `git rev-parse HEAD`;
   - the verified tree hash equals the built tree hash;
   - single-file CSP hashes match;
   - no secrets ship;
   - `git status --porcelain` is empty.

Pages (`.github/workflows/pages.yml`) does not run `release.sh`. Since 4.9.83 it runs `sh source/tools/publish.sh` and uploads only `_release/site`. `source/tools/publish.sh` uses the same prepare, build, and `verify_release.js` steps, and substitutes `node verify/targeted.js` for the full suite. The suite list is `source/verify/targeted.json` (for 4.9.110 that list is what produced 210/210 on the live artifact). The live probe at the end of `publish.sh` (`node tools/live_probe.js --limit 25`) does not block the publish. `release.sh` remains the full-suite command.

After a local build of the same commit, `node source/tools/verify_live.js https://bogaertn.github.io/forge-mobile/` compares every live file hash with the local manifest.

## Architecture

- `source/src/`: the app.
  - Kernel and derivation: `kernel.js`, `derive.js`, `grammar.js`, `reason.js`, `kmath.js`.
  - Permission service: `governance.js`.
  - Mobile Identity Vault: `privacy.js`. This is a local encrypted secret store, not the Identity Vault product.
  - Shared knowledge layer: `shared.js`. A reviewed accept is signed, evidence only, and not a memory fact. The standing law keeps the store empty until Nic enables it.
  - Memory Economy: `economy.js`. It is count-only and append-only. The lifecycle is candidate, then signed breath validation, then a finalized capsule. Revoking credit appends a signed nullification. `economic_processing` is `NOT_AUTHORIZED` and `payout_hook` is null. CT is never money. Credit received from another device is reconstructed locally from the signed source manifest; anything missing or mismatching is quarantined and counts zero. A validator id is derived from the validator's own key. A fork ancestor's ×½ counts zero on other devices until its signed lineage resolves.
  - First-breath co-creation: co-creators named in the author-signed body who sign that exact draft before publication get ×1. Anyone who co-signs later gets 1/3. Late co-signatures are merged deterministically, one per signer.
  - Attribution ledger: `ledger.js`. Exports carry the full chain or a `forge-ledger-checkpoint/v1` checkpoint.
  - Backup and recovery: `operator.js`. There is one backup system (portable backup, inspect, atomic restore, rollback). Old v1 files go only through the labelled legacy converter, which commits through the same staged-generation path. The portable encrypted backup opens on a fresh install. Restores are staged into a new storage generation and committed by one active-generation pointer switch, so a failure before the switch leaves the old data byte-identical. Backups are size-, depth-, and KDF-bounded before any key derivation or decoding.
  - Output forms: `render.js` renders 11 forms, each with an honest scope label and `forge-rmc-output-envelope/v1`. The tone is a trace sonification preview. It is not music and it does not emit `.hfield`. `HCS_BOUNDARY.adapter` is `none (not live)`.
  - Build Doctor: `doctor.js`. It runs checks and gives fix instructions. It does not repair automatically.
  - Account (optional): `sb_sync.js` is the only module that talks to the Supabase backend (magic-link sign-in, device public-key registration via the `register-device` Edge Function). Storage and sync only. The reasoning core does not reference it. Answers are identical signed in or out (verify `SBSYNC-ISOLATION`). Backend schema and RLS live in `supabase/`.
  - Tool Bench: `toolbench.js`. Manifest tools, `uses_model: false`, invoked only from a kernel-selected frame, permission-checked, evidence only. LLM parts of EchoForge stay excluded.
  - Tool Builder: `toolbuilder.js`. User tools run in an isolated, compute-only ForgeScript worker with no network, page, or storage access.
- `source/verify/`: the verifier (`run.js`, `targeted.js`, and the suite files).
- `source/tools/`: the release pipeline (`release.sh`, `publish.sh`, `shipset.js`, `verify_release.js`, `verify_live.js`), the home node (`forge_node.py`), and helpers.

## Boundaries

Forge Mobile does not merge Harmonic Conductor Studio (HCS), Identity Vault, Genesis Node, EchoForge, or ProtoForge into this PWA. Adapters stay parked. Genesis Node, HCS, Identity Vault as a product, the tool marketplace, CT-as-money, and agent products stay parked (`NEXT_BUILD.md`). HCS owns `.hfield` and music rendering. Forge Mobile never emits `.hfield` and claims no live HCS adapter. ProtoForge execution is refused on the phone (CONFLICTS #17); a plan is a proposal only. Sale, transfer, and payment stay denied.

Ledger v2 “General Language Runtime NOT LIVE” and Capability Register L-08 “Parked post-1.0” are stale for this PWA. The feature row L-08 stays Partial, because a paired home node and distributed operator clients are not a finished product. This repository does not rewrite those Drive documents.

Lexicon data derives from Princeton WordNet 3.0 (licence in `source/data/WORDNET_LICENSE.txt`).
