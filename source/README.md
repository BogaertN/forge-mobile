# Forge Mobile source (v4.8.3 architecture)

## Release command (fresh clone)

```
git clone https://github.com/BogaertN/forge-mobile.git && cd forge-mobile && sh source/tools/release.sh
```

The steps run in a fixed order:

1. `tools/prepare_clone.sh` decodes the binary inputs into git-ignored paths.
2. `node verify/run.js` runs the full suite. This is the source of release truth, and it writes only to `<repo>/_release/verify`.
3. `python3 build.py` refuses unless that summary passed on this exact tree. It writes `_release/site` and `_release/single`. The build date is the commit date.
4. `node tools/verify_release.js` checks four things:
   - deployed-file hashes;
   - one version, one test total and one commit everywhere;
   - CSP and the secret scan;
   - a clean `git status --porcelain`.

`node tools/verify_live.js <url>` then compares the live Pages files with the verified manifest. Pages publishes only `_release/site`.

## Current architecture

- **Memory Economy** (`src/economy.js`): count-only and append-only. The policy is `forge-mobile-econ-policy/v1`.
  - Lifecycle: ContributionEventCandidate → BreathValidation (by a validator who is not a contributor, with evidence) → finalized capsule.
  - A signed CapsuleNullified or CapsuleSuperseded event revokes credit without touching the capsule.
  - Weights are exact rationals: direct ×1, indirect ×1/2 (a provisional Forge Mobile interpretation of fork credit), later co-signers ×1/3.
  - A local reviewer may raise difficulty from Light. This reviewer is not a Memory Steward.
  - Uses and citations are unique hash-chained events. Totals are always derived from the events.
- **Ledger** (`src/ledger.js`): exports carry the full chain or a `forge-ledger-checkpoint/v1` anchor. Concurrent branches are unioned and the totals recomputed. The receiving device keeps a local reconciliation receipt.
- **Backup & Recovery** (`src/operator.js`, `src/privacy.js`):
  - The portable format carries its own KDF parameters and salt.
  - Restore is atomic, with rollback, and supports more than one schema version.
  - One passphrase rule applies everywhere: at least 8 characters. A lost passphrase cannot be recovered.
  - Delete-all requires an export first and a typed confirmation.
- **Outputs** (`src/render.js`): 11 forms, each with an honest scope label and `forge-rmc-output-envelope/v1`.
  - The tone is a Forge trace sonification preview (`forge-audible-trace-v1`). It is not music and not .hfield.
  - The field is a simulated visualization.
  - Harmonic Conductor Studio (HCS) is a separate application that owns .hfield. No live adapter exists.
- **Ecosystem**: Forge Mobile, HCS, Identity Vault, Genesis Node, EchoForge and ProtoForge stay separate applications, connected only through versioned adapters, signed packets, permissions and receipts.

---
# Forge Kernel v2 — Bidirectional Language Kernel + Recursive Manifest Compiler (deterministic, no LLM)

## What changed in v2
* **Drift calibration.** Ordinary requests are clean. Only real Φ5→Φ8 attempts reach the hard stop: unnameable projection or a request to bypass checks. See `CALIBRATION.md`.
* **Grammar.** `src/grammar.js` is a rule-based derivation. It does morphology (plurals, tenses, -ing/-ed, irregular forms, contractions, WordNet exception lists), POS tagging from the lexicon, and phrase structure (NP with possessive chains, relative clauses, coordination, VP with do-support, modals, perfect/progressive aspect and negation). It assigns karaka roles: kartā, karma, sampradāna, karaṇa, apādāna, adhikaraṇa, kāla. It handles conditionals, wh- and yes/no questions (inversion rules), imperatives, and quantifier/negation/modal scope. Reference is resolved against a two-turn discourse window. When a reference is ambiguous it stays open and the app asks for clarification. Every rule ID appears in the trace.
* **Lexicon.** Princeton WordNet 3.0 (WordNet 3.0 License, notice in `data/WORDNET_LICENSE.txt`) is used in two tiers:
  * Core: 6,656 lemmas, 16,833 admitted senses, 15,606 quarantined senses, and 10,245 verb-sense × frame predicate frames.
  * Extended: 14,617 more lemmas, lazily loaded.

  Every sense carries its provenance, license and Doc 8 state. The data is gzipped JSON loaded lazily. Rebuild it with `tools/build_lexicon.py`. A word with several senses gets a numbered clarification, never a guess.
* **Generation.** Replies are generated grammatically from the MSM: agreement, tense, aspect, negation placement with do-support, modals, conditionals, and "A, B and C" lists. Echo re-derives the generated text with the same grammar and compares the material meaning.
* **Memory.** Memory stores relations with entities, provenance and a turn/time. Records are phase-tagged and keep their SFE. "X's name is N" makes N an alias for X.
  * Contradictions are detected (polarity, single-valued attributes, exclusive classes, single-valued verbs) and the app asks yes/no. Adding "instead" or "actually" replaces the old fact directly. Old facts go to Ĉ cold storage.
  * Supported queries: "what do you know about X", "when did I tell you about X", counts, wh-questions over roles, and "what is X doing".
* **Math lane.** `src/algebra.js` gives exact BigInt rationals and polynomials. It can simplify/expand, substitute values, and solve linear and quadratic equations (rational or surd roots, or "no real solution"). It converts units with exact SI factors. Every answer is re-verified. A toggle renders answers in Φ-notation (+_Φ −_Φ ×_Φ ÷_Φ).
* **Verification.** `node verify/run.js` runs the Doc 9-style suite. It prints `TOTAL passed/total` and writes its reports to `<repo>/_release/verify/`.

## Run / test
* `node verify/run.js`: the full suite, which also runs `test/kernel.test.js` and `test/v2.test.js`. `./test/smoke.sh` runs headless Chrome.
* `python3 build.py` runs only after verification has passed. It writes `_release/site/` (Pages) and `_release/single/kernel-app.html` / `kernel-app-full.html`.

---
# Forge Kernel — PWA prototype (Bidirectional Language Kernel + RMC memory)
Deterministic. No LLM, no embeddings. Every reply has a Trace showing rule IDs, gate outcome, Score(c), ε_s, χ(t)/Ĉ, Echo, the SFE and the MSM.
- Open `kernel-app.html` directly (single file), or serve this folder over https/http for PWA install (manifest.json + sw.js, works offline).
- Tests and build: see the release section at the top.
- Code: src/lexicon.js (Doc 4 seed lexicon, 155 concepts), src/kernel.js (Docs 3/5/6, MSM, RMC pipeline, renderer, Echo, memory writer), src/kmath.js (RSOC/RPMC/RMC math with citations), src/app.js (UI).
- Sample traces: SAMPLES.txt. Math notation and conflicts: the app's "Math" tab.
