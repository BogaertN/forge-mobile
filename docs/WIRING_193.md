# Wiring 4.9.193 — drift v4.3 core

Ask still calls `rmc_engine_v1.rmc_core.run` with `live: true`. C_min stays 0.87. Echo stays 0.85. The coherence formula in `measurement_kernel.coherence_components` is unchanged. No model is called. `dream_idle` and `economy` stay off. Letter packs stay gated. Money stays disabled. ChristPing stays Gilligan-only. Wikipedia stays low trust and is not an anchor.

## What is reused

`source/src/drift_v43.js` and `rmc_engine_v1/drift_v43.py` call the 4.9.191 detector. They do not copy it.

| piece | owner |
|---|---|
| d_score = 1 only when the previous phase is 5 and Φ_act is 8 | `luciferianDScore` / `luciferian_d_score` |
| L_local, variance of absolute consecutive steps over the last 8 | `localCurvature` / `local_curvature` |
| θ_w = 0.4 / (1 + 0.5 · L_local) | `adaptiveThreshold` / `adaptive_threshold` |
| three steps inside 18.7 ms, labeled "no formal guarantee" | `phaseVelocity` / `phase_velocity` |
| population standard deviation | `std` / `_std` |
| breaker on Φ5→Φ8, Φ4→Φ8, hard stop 0.8, or 3 failures | `driftCircuitBreaker` / `drift_circuit_breaker` |

The Ask summary is `language_core_engines.drift_v43_stage`. It does not replace the admit ε_s.

## ε_s and the composite

ε_s = (σ_res + d_score + δΦ) / max(1, recursion_n). It is not clipped.

Φ_act = (nesting depth mod 9) + 1, plus 3, capped at 9, when the canonical payload contains replicate, spawn, or infinite. Φ_exp = (previous phase mod 9) + 1. δΦ = |Φ_act − Φ_exp| / 9.

θ_t = 1 − MinHash similarity of the canonical payload and ψ1_trace, or 0 when there is no trace. The history appends (1 − θ_t). σ_res is the standard deviation of that history, or 0 when it has fewer than two points. MinHash uses 32 hashes. Weights are core_state 0.5, auxiliary 0.3, metadata 0.2.

d_score is the categorical flag. It is not the RSOC Jaccard D_score. RSOC's denominator max(1, ρ+1) is not used.

D = 0.30·H_norm + 0.15·S_norm + 0.10·N + 0.25·χ_struct + 0.10·A_time + 0.10·ε_s.

H_norm is the Shannon entropy of the canonical JSON divided by log2 of the number of distinct characters. S_norm is the size deviation from the median, divided by the median absolute deviation, clipped to 1. N is 0.2 for a new SHA-256 and 0 after that. χ_struct is 1 minus the Jaccard of key paths, or 0 with no trace. A_time = clip((latency_ms − 500) / 500, 0, 1).

## Detection order

1. d_score = 1 → HARD_FIRE. This is the only categorical hard fire.
2. Three sequential steps inside 18.7 ms set the acceleration flag. The label is "no formal guarantee".
3. ε_s > 0.8 → HARD_CEILING. θ_w is at most 0.4, so this reading is also above θ_w. The ceiling is the disposition.
4. Otherwise ε_s > θ_w → WARN, and χ fires.
5. EMA uses α = 0.2. WARN_PREDICTIVE is set when the constant-ε projection reaches 0.8 in more than 0 and fewer than 5 steps.

χ_t = 0.5·θ_t. Residue = (old + 0.3·ε_s) / 2. The state is convergent when |0.5 − θ_t| < 0.2, and the phase goes to 9 (Recursion). Otherwise it is oscillating.

## Phase engine

d = |Φ − Φ_exp|. When d > 4, d = 9 − d. Drift = d / 4.5, times 1.5 when phase 1, 5, 7, or 9 is involved, capped at 5.

Entropy = 0.4·drift_acc + 0.1·consecutive + 0.3·std(vector).

Warn 1.0, critical 2.5, entropy 0.8. χ triggers are acc > 2.5, entropy > 0.8, coherence < 0.3 (internal only, not an admit), consecutive drifts ≥ 3, or predicted drift > 2.5. Two consecutive drifts do not fire χ.

Genesis Node `SKIP_PATTERNS` that allowed phase 5 to reach phase 8 is not ported. RSOC Axiom 2 flags 4→8 and does not set d_score. Canonical names stay Initiation, Polarity, Desire, Friction, Entropy, Grace, Naming, Power, Recursion.

## Log-only rows

Gilligan System Codex Vol IV Phase 1.8 and Unified Algebra Vol I. None of these write, and none of them admit.

| row | rule |
|---|---|
| Phase step | step_flag = 1 when \|Φ_act − Φ_prev\| mod 9 is outside {0, 1, 8}. Log only. 5→8 remains the only categorical hard fire. |
| Entropy cascade | ε(t+1) = ε + αΔ² + βμ. α and β default to 0. The documents do not give values, so both are marked unspecified. |
| Singularity | warn when D > 0.8 and ΔD > 0 and ν < 0. |
| Codex charge | +0.1 on a lawful step, −0.3 on a skip, clamped to [0, 1]. |
| Drift mask | MinHash similarity to a quarantined or collapsed signature at or above 0.70 warns and checks χ. |
| Bands | 0.3 and 0.6 are logged. They are not admit gates. The Codex 0.9 failsafe is not applied. The hard stop is 0.8. Nothing writes above 0.35. |
| Restore from χ | needs a confirmed echo, drift under 0.3, a lawful phase sequence, and a χ window of 3000 ms. |

## Screen

The Ask tab has a Drift monitor card. It runs the worst-case 5→8 trace, the three-drift χ check, and the mask, singularity, and restore rows in the page. It does not call a model and it does not write.

## Cold admits

The 60-question table was run three times. Cold admits 48, the same 48 as 4.9.191. The three passes agree. The table is `docs/LIVE_TEST_193.md`.
