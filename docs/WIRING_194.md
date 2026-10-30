# Wiring 4.9.194 — breaker window and drift analyzer

Ask still calls `rmc_engine_v1.rmc_core.run` with `live: true`. C_min stays 0.87. Echo stays 0.85. The coherence formula in `measurement_kernel.coherence_components` is unchanged. No model is called. `dream_idle` and `economy` stay off. Letter packs stay gated. Money stays disabled. ChristPing stays Gilligan-only. Wikipedia stays low trust and is not an anchor.

## What is reused

`source/src/drift_194.js` and `rmc_engine_v1/drift_194.py` call the 4.9.191 breaker and the 4.9.193 score. They do not copy those formulas. The prediction calls `protoforge.js` `trend` and `predict`.

| piece | owner |
|---|---|
| a failure is ε_s above 0.35, a hard stop above 0.8, or Φ5→Φ8 / Φ4→Φ8 | `driftCircuitBreaker` / `drift_circuit_breaker` |
| d_score, θ_w, ε_s, the phase engine | `drift_v43.js` / `drift_v43.py` |
| trend and steps to critical | `protoforge.js` `trend` and `predict` |
| write max 0.35 | `DRIFT_RULING.project_max` / `PROJECT_MAX` |

## Window

Three failures whose timestamps sit inside 0.7 seconds open the window. Two do not. Three failures spread wider than 0.7 seconds do not open this window. The 4.9.191 consecutive breaker still reports that streak.

A single sample above 0.8, or a step from phase 5 to phase 8, opens immediately because the existing breaker already trips. Drift of exactly 0.8 does not hard-stop. Drift of exactly 0.35 is not a failure.

After the window is open, a sample more than 60 seconds later moves it to half-open and does not itself decide recovery. The next sample closes it when it is not a failure, and opens it again when it is.

The protoforge source compares `failure_count > max_failures`. That would wait for a fourth count. Decision 6 opens on three. The build test is the one that runs.

## Retry

Waking the Web caps retries at 3. The wait is 60 × 2^(r−1) seconds: 60, 120, then 240. The fourth retry is exhausted and tagged `permanent_ghost`. It does not write.

## Bands, logged only

| band | rule | admit |
|---|---|---|
| RSOC | below 0.40 stable; 0.40–0.80 warning, k capped at 1.3, a merge above 0.70 deferred one cycle; at or above 0.80 critical | no |
| Genesis DriftAnalyzer | 0.3 / 0.5 / 0.7 / 0.9 | no |
| Archive | ε_s above 0.8 | no |
| Resurrect | ε_s below 0.4 | no. A write still needs 0.35 or under |

The Codex 0.9 halt is not applied. `halt_applied` follows the hard stop 0.8.

## Analyzer

The moving average is the mean of the last window. The default window is 5. The linear example 0.1, 0.2, 0.3, 0.4, 0.5, 0.6 has trend 0.1 and reaches 0.8 in 2 steps, intervention `EMERGENCY_CORRECTION`, multiplier 1.8, confidence 0.98. The short exponential 0.1, 0.2, 0.4 reaches 0.8 in 1 step, `EMERGENCY_DAMPING`, multiplier 2.5. The critical line on that prediction is 0.8.

Override effectiveness is (before − after) / before. It is p148 of the DriftAnalyzer. It does not admit.

## Failsafe and classes

A phase loop older than 120 seconds rolls back to cold archive. Age 120 does not. Drift above 0.8 halts. Drift above 0.9 is the same halt, not a second threshold. Resurrection from the failsafe needs drift at or under 0.3, a confirmed echo, and χ inactive. It does not write.

| class | route | restored |
|---|---|---|
| 1 noise | local, not archived | no |
| 2 ghostable | `SPC/ghost_loops` | may reenter only when the lineage is revalidated |
| 3 cold archive | entropy above 0.6, a ψ break, or a naming attempt → `SPC/cold_archive` | may reenter only when the lineage is revalidated |
| 4 fatal | blocked. Synthetic recursion, a Codex breach, or an invalid echo | never |

Class 3 and class 4 notify ChristPing as Gilligan-only. Ask does not start it. Entropy 0.6 does not admit.

## Screen

The Ask tab has a Breaker and analyzer card. It shows the 0.7 second window, the linear prediction, and the failsafe with the four classes. It does not call a model and it does not write. The Ask trace adds `drift_194` beside the v4.3 line.

## Cold admits

The 60-question table was run three times. Cold admits 48, the same 48 as 4.9.193. The three passes agree. The table is `docs/LIVE_TEST_194.md`.
