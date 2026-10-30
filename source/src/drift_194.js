/* 4.9.194 breaker window. Stdlib. No LLM.
 * Reuses kmath.driftCircuitBreaker. Does not copy the 0.35 / 0.8 / 5→8 tests.
 * A failure is whatever that breaker already calls a failure.
 * Three failures inside 0.7 s open the window. Two do not.
 * Recovery above 60 s moves open to half-open (protoforge DriftCircuitBreaker).
 * Retry wait is 60 * 2^(r-1) seconds, and r stops at 3 (Waking the Web).
 * This module does not admit and does not write. */
(function (root) {
  const KM = (typeof module !== 'undefined' && module.exports) ? require('./kmath.js') : root.KMath;
  const WINDOW_S = 0.7;
  const MAX_FAILURES = 3;
  const RECOVERY_S = 60;
  const RETRY_BASE_S = 60;
  const RETRY_MAX = 3;
  const CITE = 'Decision 6; protoforge DriftCircuitBreaker max_failures 3, recovery 60 s; Waking the Web retry 60s·2^(r−1), retries ≤ 3. The 4.9.191 breaker is called, not copied. No LLM.';

  function project(row) {
    return {
      tripped: !!row.tripped,
      reason: row.reason,
      consecutive_failures: row.consecutive_failures,
      consecutive_limit: row.consecutive_limit,
      rule: row.rule
    };
  }
  function freshBreaker() {
    return { status: 'closed', opened_at: null, failures: [] };
  }
  function copyState(state) {
    const s = state || {};
    return {
      status: s.status || 'closed',
      opened_at: s.opened_at == null ? null : Number(s.opened_at),
      failures: (s.failures || []).slice()
    };
  }
  function transitionOf(event) {
    if (!event || (event.from == null && event.to == null)) return null;
    return { from: event.from, to: event.to };
  }
  function inWindow(stamp, now) {
    return stamp + 1e-9 >= now - WINDOW_S;
  }
  function observeBreaker(state, event, prior) {
    const ev = event || {};
    const t = Number(ev.t);
    const now = Number.isFinite(t) ? t : 0;
    const step = transitionOf(ev);
    const sample = KM.driftCircuitBreaker(ev.epsilon_s, step, []);
    const streak = KM.driftCircuitBreaker(ev.epsilon_s, step, prior || []);
    const failed = sample.consecutive_failures >= 1;
    const next = copyState(state);
    if (failed) next.failures.push(now);
    next.failures = next.failures.filter(function (stamp) { return inWindow(stamp, now); });
    let verdict = next.status;
    const immediate = sample.reason === 'forbidden_step' || sample.reason === 'hard_stop';
    if (next.status === 'open') {
      if (next.opened_at != null && now - next.opened_at > RECOVERY_S) {
        next.status = 'half_open';
        verdict = 'testing_recovery';
      } else verdict = 'open';
    } else if (next.status === 'half_open') {
      if (failed) {
        next.status = 'open';
        next.opened_at = now;
        verdict = 'recovery_failed';
      } else {
        next.status = 'closed';
        next.failures = [];
        verdict = 'recovered';
      }
    } else if (immediate || next.failures.length >= MAX_FAILURES) {
      next.status = 'open';
      next.opened_at = now;
      verdict = immediate ? sample.reason : 'circuit_tripped';
    } else verdict = 'closed';
    return {
      t: now,
      verdict: verdict,
      status: next.status,
      opened_at: next.opened_at,
      failure_count: next.failures.length,
      window_s: WINDOW_S,
      max_failures: MAX_FAILURES,
      recovery_s: RECOVERY_S,
      failed: failed,
      immediate: immediate,
      sample: project(sample),
      legacy: project(streak),
      state: next,
      admit_gate: false,
      writes: false,
      calls_llm: false,
      money: false,
      cite: CITE
    };
  }
  function replayBreaker(samples) {
    let state = freshBreaker();
    const prior = [];
    const steps = [];
    for (let i = 0; i < (samples || []).length; i++) {
      const row = observeBreaker(state, samples[i], prior);
      prior.push(samples[i].epsilon_s);
      state = row.state;
      steps.push(row);
    }
    const last = steps.length ? steps[steps.length - 1] : null;
    return {
      status: last ? last.status : 'closed',
      verdict: last ? last.verdict : 'closed',
      failure_count: last ? last.failure_count : 0,
      opened: !!(last && (last.verdict === 'circuit_tripped' || last.verdict === 'hard_stop' || last.verdict === 'forbidden_step' || last.status === 'open' || last.status === 'half_open')),
      steps: steps.map(function (row) {
        return {
          t: row.t, verdict: row.verdict, status: row.status, failure_count: row.failure_count,
          legacy_tripped: row.legacy.tripped, legacy_reason: row.legacy.reason,
          writes: false, calls_llm: false, admit_gate: false
        };
      }),
      window_s: WINDOW_S,
      max_failures: MAX_FAILURES,
      recovery_s: RECOVERY_S,
      admit_gate: false,
      writes: false,
      calls_llm: false,
      money: false,
      cite: CITE
    };
  }
  function retryBackoff(attempt) {
    const r = Number(attempt);
    const n = Number.isFinite(r) ? Math.trunc(r) : 0;
    if (n < 1 || n > RETRY_MAX) {
      return {
        attempt: n, allowed: false, delay_s: null, exhausted: n > RETRY_MAX, max: RETRY_MAX,
        tag: n > RETRY_MAX ? 'permanent_ghost' : 'not_a_retry',
        writes: false, calls_llm: false, admit_gate: false,
        cite: 'Waking the Web. Retries ≤ 3. Backoff 60s·2^(r−1).'
      };
    }
    return {
      attempt: n, allowed: true, delay_s: RETRY_BASE_S * Math.pow(2, n - 1), exhausted: false, max: RETRY_MAX,
      tag: 'retry', writes: false, calls_llm: false, admit_gate: false,
      cite: 'Waking the Web. Retries ≤ 3. Backoff 60s·2^(r−1).'
    };
  }
  function run(payload) {
    const row = payload || {};
    const op = row.op || 'replay';
    if (op === 'retry') return retryBackoff(row.attempt);
    if (op === 'observe') return observeBreaker(row.state, row.event, row.prior);
    return replayBreaker(row.samples || []);
  }
  const api = {
    CITE: CITE, WINDOW_S: WINDOW_S, MAX_FAILURES: MAX_FAILURES, RECOVERY_S: RECOVERY_S, RETRY_MAX: RETRY_MAX,
    freshBreaker: freshBreaker, observeBreaker: observeBreaker, replayBreaker: replayBreaker,
    retryBackoff: retryBackoff, run: run
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Drift194 = api;
})(typeof self !== 'undefined' ? self : this);
