# forge-mobile

Forge Mobile is an installable PWA with no LLM. Its Pāṇinian-style Bidirectional Language Core compiles supported language into symbolic meaning and back into language; the separate RMC reasoning, trace and memory spine compares candidates, applies warrants and selects supported conclusions. Replies are derived by governed rules and carry a full trace. No language model generates anything. Every action goes through the permission service.

Version 4.9.3 adds a bounded, general-purpose symbolic world-model path for controlled English. It compiles previously unseen content identifiers, finite facts, rules and a final query into an immutable turn world; derives positive and negative consequences; independently replays the selected proof; uses RMC to select only checked results; and has Echo verify the rendered answer. Unsupported structures return typed limitations. This is not unrestricted natural language, external world knowledge or a hidden language-model call.

Live site: https://bogaertn.github.io/forge-mobile/

## Release: one command from a fresh clone

Requirements: Node 20 and Python 3 with the `cryptography` package (used by the home-node tests). CI installs the hash-locked set with `python -m pip install --require-hashes --no-deps -r source/requirements-ci.txt`, and every workflow action is pinned to a commit SHA.

```
git clone https://github.com/BogaertN/forge-mobile.git && cd forge-mobile && sh source/tools/release.sh
```

`release.sh` runs four steps in a fixed order. **Verification is the source of release truth.**

1. `source/tools/prepare_clone.sh` decodes the binary inputs into git-ignored paths. The inputs are `data/*.gz.b64`, `icons/*.b64` and `vendor/` at the repo root.
2. `node source/verify/run.js` runs the full suite. It prints `TOTAL passed/total passed= failed= not_run=`. A check with no authoritative reference is reported NOT_RUN, never as passed; external comparisons use the committed hashes in `source/test/external_fixtures.json`. The build needs 0 failed. It writes only to the artifact directory `_release/`, which is git-ignored and outside the source tree, and never to a tracked file.
3. `python3 source/build.py` refuses to build unless the verification summary passed on this exact tree. The tree hash covers every shipped input plus the verifier. The build writes `_release/site/` (the Pages deployment) and `_release/single/` (single-file builds). The build date is the commit date, so the same commit always builds byte-identical files.
4. `node source/tools/verify_release.js` fails unless all of the following hold:
   - every deployed file matches `BUILD_MANIFEST.json`;
   - one version appears everywhere (`VERSION`, build info, release record, feature registry, `features.js`, web manifest, service-worker cache name, build manifest);
   - one test total appears everywhere;
   - the commit equals `git rev-parse HEAD`;
   - single-file CSP hashes match;
   - no secrets ship;
   - `git status --porcelain` is empty.

The Pages workflow (`.github/workflows/pages.yml`) runs this same command and uploads **only** `_release/site`. Nothing is copied from an old tree. To check that the live site is the verified artifact, run `node source/tools/verify_live.js https://bogaertn.github.io/forge-mobile/` after a local release run of the same commit. It compares every live file hash with the local manifest.

## Architecture (current)

- `source/src/`: the app.
  - Kernel and derivation: `kernel.js`, `derive.js`, `grammar.js`.
  - Permission service: `governance.js`.
  - Mobile Identity Vault: `privacy.js`. This is a local encrypted secret store, not the full Identity Vault service.
  - Shared knowledge layer: `shared.js`. Items are signed, consented and treated as evidence only.
  - Memory Economy: `economy.js`. It is count-only and append-only. The lifecycle is candidate → signed breath validation → finalized capsule. Revoking credit appends a signed nullification. CT is never money. Credit received from another device is reconstructed locally from the signed source manifest; anything missing or mismatching is quarantined and counts zero. A validator ID is derived from the validator's own key. A fork ancestor's ×½ counts zero on other devices until its signed lineage resolves.
  - First-breath co-creation: co-creators named in the author-signed body who sign that exact draft before publication get ×1. Anyone who co-signs later gets 1/3. Late co-signatures are merged deterministically, one per signer.
  - Attribution ledger: `ledger.js`. Exports carry the full chain or a formal checkpoint.
  - Backup & Recovery: `operator.js`. There is ONE backup system (portable backup, inspect, atomic restore, rollback); the old v1 backup/restore route is removed, and old v1 files go only through the labelled legacy converter, which commits through the same staged-generation path. The portable encrypted backup opens on a fresh install. Restores are staged into a new storage generation and committed by one active-generation pointer switch, so a failure before the switch leaves the old data byte-identical. Backups are size-, depth- and KDF-bounded before any key derivation or decoding.
  - Output forms: `render.js` renders 11 output forms, each with an honest scope label and the common `forge-rmc-output-envelope/v1`.
  - Build Doctor: `doctor.js`. It runs checks and gives fix instructions; it does not repair automatically.
  - Account (optional): `sb_sync.js` is the only module that talks to the Supabase backend (magic-link sign-in, device public-key registration via the `register-device` Edge Function). Storage and sync only; the reasoning core never references it, and answers are identical signed in or out (verify `SBSYNC-ISOLATION`). Backend schema and RLS live in `supabase/`.
  - Tool Builder: `toolbuilder.js`. User tools run in an isolated, compute-only ForgeScript worker with no network, page or storage access.
- `source/verify/`: the verifier (`run.js` plus the suite files).
- `source/tools/`: the release pipeline (`release.sh`, `shipset.js`, `verify_release.js`, `verify_live.js`), the home node (`forge_node.py`) and helpers.
- **Ecosystem boundaries.** Forge Mobile does not merge Harmonic Conductor Studio (HCS), Identity Vault, Genesis Node, EchoForge or ProtoForge into one application. It coordinates them only through versioned adapters, signed packets, explicit permissions, receipts and shared navigation.
  - HCS owns `.hfield` and music rendering. Forge Mobile never emits `.hfield`, and it claims no live HCS adapter.
  - Identity Vault owns private identity and custody.
  - Genesis Node is the user-owned sync layer.
  - EchoForge is advisory.
  - ProtoForge is the construction and execution layer.
- Economic processing, payments, transfer and redemption are disabled.

Lexicon data derives from Princeton WordNet 3.0 (licence in `source/data/WORDNET_LICENSE.txt`).
