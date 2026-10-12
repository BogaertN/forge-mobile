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
* **Verification.** `node verify/run.js` runs a Doc 9-style suite of 753 cases and writes `verify/REPORT.md`.

## Run / test
* `node test/kernel.test.js` (v1 suite, 20) · `node test/v2.test.js` (69) · `node verify/run.js` (753) · `./test/smoke.sh` (headless Chrome)
* `python3 build.py` produces three outputs:
  * `kernel-app.html`: code inlined, lexicon loaded from the `data/` sidecars over http(s).
  * `kernel-app-full.html`: everything inlined; works from file://.
  * `/workspace/kernel-app.zip`

---
# Forge Kernel — PWA prototype (Bidirectional Language Kernel + RMC memory)
Deterministic. No LLM, no embeddings. Every reply has a Trace showing rule IDs, gate outcome, Score(c), ε_s, χ(t)/Ĉ, Echo, the SFE and the MSM.
- Open `kernel-app.html` directly (single file), or serve this folder over https/http for PWA install (manifest.json + sw.js, works offline).
- Tests: `node test/kernel.test.js` (20 tests). Rebuild single file and zip: `python3 build.py`.
- Code: src/lexicon.js (Doc 4 seed lexicon, 155 concepts), src/kernel.js (Docs 3/5/6, MSM, RMC pipeline, renderer, Echo, memory writer), src/kmath.js (RSOC/RPMC/RMC math with citations), src/app.js (UI).
- Sample traces: SAMPLES.txt. Math notation and conflicts: the app's "Math" tab.
