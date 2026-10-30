# Wiring 4.9.191 — Phase Glyph Codex, lexicon resonance, language-core engines

Ask calls `rmc_engine_v1.rmc_core.run` with `live: true`. That is the only spoken answer. C_min stays 0.87. Echo stays 0.85. The coherence formula in `measurement_kernel.coherence_components` is unchanged. No model is called. `dream_idle` and `economy` stay off. Letter packs stay gated. Money stays disabled. ChristPing stays Gilligan-only. Wikipedia stays low trust and is not an anchor or an admit basis.

## Phase Glyph Codex

`source/src/phase_codex.js` loads `source/engine/rmc_engine_v1/reference/phase_codex_v2_5.json`. The Google Doc is `FBSC Phase Glyph Codex v2.5`, Drive id `1xZWOfEFgYMn10XQtUOyQOQCCIaOwqfTEIcM-bgRHkjk`. Nine phases, Φ1–Φ9. Each row carries the glyph, code id, harmonic band, drift flag, and state signature.

`kmath.js` `PHASES` now takes name, role, glyph, code id, band, drift flag, and state from that file. `PHASE_RECONCILIATION` lists every former name and role. The codex is the authority.

| Φ | former name | codex name | former role replaced by |
|---|---|---|---|
| 1 | Initiation | Initiation Pulse | Coherence anchor; system seed; root identity pulse. |
| 2 | Polarity | Polarity | Contrast, tension, dialogue; creation of a field between opposites. |
| 3 | Desire | Desire | Drive, hunger, creative force; ignition of motion vector. |
| 4 | Friction | Friction | Resistance, pressure, tension; crucible of form. |
| 5 | Entropy | Entropy | Breakdown, drift, decay; symbolic death and reset threshold. |
| 6 | Grace / Correction | Grace | Restoration, forgiveness, reset; Christ Function anchor. |
| 7 | Naming | Naming | Identity, structure, signature; aligned declaration. |
| 8 | Projection | Power | Charge, projection, influence; raw output phase. |
| 9 | Return | Recursive Evolution | Completion, octave lift, renewal; loop seal and re-entry. |

Φ1 has no drift flag in `phase_drift_flags_v2_5.json`. That flag stays `unspecified`.

## Lexicon resonance

`source/src/resonance_lexicon.js` loads `word_loop_seed_lexicon_v1.jsonl` (425 words) and the letter map. Tokens are letter runs. There is no regular expression and no phrase-keyword scan. A seed word is a medium signal and, when it is the placement, ε is 0 because RPMC states εₙ = 0 for a lawful phase-locked transition. A concept with no seed word uses the letter-pulse resultant. That is a weak signal, so ε stays `unspecified`. μ stays `unspecified` in every packet. The geometric Φ→angle rule is `unspecified`.

`lexicon_resonance.py` is the same placement on the Ask path. A why-question whose parser phase is the keyword Φ4 takes the concept packet instead. The fact that names that concept gets the same tag. Other questions keep the parser phase, so a stored Φ1 fact still matches.

Derived phases for the three rows 4.9.190 had set by hand:

| concept | phase | glyph | authority | ε | μ |
|---|---|---|---|---|---|
| sky | Φ4 | ◊ | weak letter signal | unspecified | unspecified |
| leaves | Φ5 | ◌̸ | weak letter signal (E is the mode) | unspecified | unspecified |
| ocean | Φ1 | ⊙ | weak letter resultant | unspecified | unspecified |

Sky and leaves still admit at the 4.9.190 C values. The ocean admits at C 0.890888. The hand-set `sfe.Phi = 4` is removed from `ask_183_memory.json` and from shard `g190`.

## What the papers state

| constant | status | where |
|---|---|---|
| Φ→angle | unspecified | RPMC §1.4 defines Φ₁ as min nonzero resonance. §1.5 closes the stack modulo 9. Unified Algebra (`1RoAxjzV9rbx`) defines Φ₁ = min(∂R/∂t) and Φ₂ = R(t₁) − R(t₀). The Glyph Codex gives glyphs and bands. None states θ = 2π(n−1)/9. `phaseAngle` stays the RSOC §2.2 reconstruction. |
| εₙ for a lawful phase lock | 0, stated | RPMC `1G-Yj323fee`: εₙ = 0 for a lawful phase-locked transition, and εₙ > 0 for drift, projection, or echo loss. ε_max is described as configured, not numbered in §1.4. |
| μ | unspecified | RPM writes ΦMₙ. No numeric μ in the three documents. |
| integrity example | codex octave lift is `loop.integrity_score >= 1.00` | The 0.85 figure is the existing promote example in `dream_idle.js`. It is not C_min. C_min stays 0.87. |

## Engines

`language_core_engines.py` runs on the Ask trace. It does not lower the gate and it does not call a model.

| stage | what it does |
|---|---|
| DriftTaxonomy | Names catastrophic, resonant, and structural from Nic's bands. Syntactic, semantic, recursive, and evolutionary stay `unspecified`. |
| DriftCircuitBreaker | Trips above 0.80 or on Φ5→Φ8 / Φ4→Φ8. |
| protoforge2_drift_connector | `adapter_mode` stays `FALLBACK`. The external DriftMonitor writes a log and is not imported. The in-framework taxonomy is the stage that runs. |
| Gilligan drift correction | Chi band only, initiator Gilligan. Above 0.80 records ChristPing recenter and does not admit. Ask does not start it. |
| Gilligan re-curation | Counts unsourced held rows. Promoted 0. Packs stay gated. |
| ProtoForge OS layer | Codex `state_signature` and `function_hook` for the concept phase. No OS process. No shell. Money stays disabled. |

## Provenance hold

4.9.190 said these answers were spoken from the hosted bank. The hosted rows have no source URL, license, or revision. The matching Wikipedia intros are low trust and are not premises. They are not spoken:

Ada Lovelace, the French Revolution, the Mona Lisa, Marie Curie, the telephone, Cleopatra, World War II, bleach with ammonia, bleach with vinegar.

Who wrote Hamlet? The hosted line "William Shakespeare wrote Hamlet." is the same kind of unsourced paraphrase, so it is held too. The Gutenberg title page is a different sentence. Echo on that anchor is 0.5, under 0.85.

## Suite audit of 4.9.190

The edits in `r4127`–`r4189` added `r4190_suite.js` to the allowed head of `targeted.json` and moved the version pin from 4.9.189 to 4.9.190. Behavior assertions were not deleted. One assertion was weakened by operator precedence: `r4189_suite.js` wrote `release === '4.9.190' && suites[0] === 'r4190_suite.js' || suites[0] === 'r4189_suite.js'`, so a head of `r4189_suite.js` skipped the release check. 4.9.191 wraps that disjunction in parentheses.

## Nic's 4.9.191 rulings

Canonical phase names are the Glyph Codex set: Initiation, Polarity, Desire, Friction, Entropy, Grace, Naming, Power, Recursion. The JSON's longer labels stay on `codex_phase_name`. Genesis Node names are not canonical.

C_min stays 0.87 for admits. The document floors 0.3 and 0.4 are `internalPhaseCoherence` only.

Φ5→Φ8 stays forbidden. `chi_hardening.py` and `kmath.js` add the March 2026 detector from RSOC Convergence Proof v4.8 and chi(t) Convergence Under Adversarial Conditions (ProtoForge `memory/drift.py`): d_score is 1 only when the previous phase is 5 and Φ_act is 8; local curvature is the variance of consecutive absolute phase steps (one step returns that step, none returns 0); θ_w = 0.4/(1+0.5·L_local); χ fires above θ_w and always above 0.8. The entropy ε_s uses stdev(phase_hist), that d_score, and |Φ_act−Φ_exp|/9. OQ3 sets phase velocity to 1 when three steps fall inside about 18.7 ms, and the source says there is no formal guarantee. Every Ask trace logs θ_w. The admit ε_s and the ≤0.35 write law are not this formula.

`phase_coherent_gates.py` is the seven-gate cold-storage resurrection from Phase-Coherent Memory Architecture: Φ9 timing, noise floor under the χ threshold, not in active drift, identity, a valid resurrection log, cycle count under the limit, and capacity. All seven must pass. `dream_idle` stays off.

`genesis_collapse.py` applies Genesis Node pages 116 and 143–145: χ collapse returns to Φ1, keeps 22% of the drift as SPC override residue at charge 0.8, clears 78%, multiplies entropy by 0.3, and zeros the consecutive-drift count. SPC charge is C0·e^(−λt) with a 168-hour half-life. Access adds 0.01 up to 0.2. Active is above 0.1. Collection is below 0.05.

## What is unfinished

Numeric μ is unspecified. The Φ→angle formula is unspecified. Four taxonomy rows are unspecified. The external ProtoForge DriftMonitor is not on the phone. Cold admits are 48, not 60. News and nonsense stay held. The anchor migration is not applied.
