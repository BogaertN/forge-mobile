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
  function finite(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  function rsocBand(epsilon) {
    const n = finite(epsilon);
    let name = 'unmeasured';
    let kCap = null;
    let deferMerge = false;
    if (n !== null) {
      if (n < 0.40) name = 'stable';
      else if (n < 0.80) {
        name = 'warning';
        kCap = 1.3;
        deferMerge = n > 0.70;
      } else name = 'critical';
    }
    return {
      band: name, epsilon_s: n, k_cap: kCap, defer_merge: deferMerge, thresholds: [0.40, 0.70, 0.80],
      logged_only: true, admit_gate: false, writes: false, calls_llm: false,
      cite: 'RSOC §4.1.1 l.2003. Below 0.40 is stable. 0.40 to 0.80 warns, caps k at 1.3, and defers a merge above 0.70 for one cycle. At or above 0.80 is critical. Internal. A write still needs 0.35 or under.'
    };
  }
  function capK(k, epsilon) {
    const band = rsocBand(epsilon);
    const requested = finite(k);
    const applied = requested === null ? null : (band.k_cap == null ? requested : Math.min(requested, band.k_cap));
    return {
      requested: requested, applied: applied, capped: requested !== null && applied !== requested,
      band: band.band, defer_merge: band.defer_merge, k_cap: band.k_cap,
      logged_only: true, admit_gate: false, writes: false, calls_llm: false
    };
  }
  function gnBand(epsilon) {
    const n = finite(epsilon);
    let name = 'unmeasured';
    if (n !== null) {
      if (n < 0.3) name = 'below_0.3';
      else if (n < 0.5) name = '0.3_to_0.5';
      else if (n < 0.7) name = '0.5_to_0.7';
      else if (n < 0.9) name = '0.7_to_0.9';
      else name = 'at_or_above_0.9';
    }
    return {
      band: name, epsilon_s: n, thresholds: [0.3, 0.5, 0.7, 0.9],
      doc_halt: 0.9, halt_threshold: 0.8, halt_applied: n !== null && n > 0.8,
      logged_only: true, admit_gate: false, writes: false, calls_llm: false,
      cite: 'gnspec DriftAnalyzer l.6104–6107. Bands 0.3, 0.5, 0.7, and 0.9 are internal. The 0.9 halt is replaced by 0.8.'
    };
  }
  function storageBand(epsilon) {
    const n = finite(epsilon);
    return {
      epsilon_s: n,
      archive: n !== null && n > 0.8,
      resurrect_band: n !== null && n < 0.4,
      write_allowed: n !== null && n <= KM.DRIFT_RULING.project_max,
      logged_only: true, admit_gate: false, writes: false, calls_llm: false,
      cite: 'Decision 5. Archive above 0.8 and resurrect below 0.4 are internal. A write still needs 0.35 or under.'
    };
  }
  function protoforge() {
    return (typeof module !== 'undefined' && module.exports) ? require('./protoforge.js') : root.KProtoForge;
  }
  function seriesOf(values) {
    return (values || []).map(Number).filter(function (n) { return Number.isFinite(n); });
  }
  function movingAverage(values, window) {
    const xs = seriesOf(values);
    const w = window == null ? 5 : Math.max(1, Math.trunc(Number(window)) || 1);
    const tail = xs.slice(-w);
    return {
      window: w, count: tail.length,
      value: tail.length ? tail.reduce(function (a, b) { return a + b; }, 0) / tail.length : null,
      logged_only: true, admit_gate: false, writes: false, calls_llm: false
    };
  }
  function cleanSteps(steps) {
    return Number.isFinite(steps) ? steps : null;
  }
  function analyze(values, opts) {
    const PF = protoforge();
    const row = opts || {};
    const xs = seriesOf(values);
    const ma = movingAverage(xs, row.window == null ? 5 : row.window);
    const tr = PF.trend(xs);
    const classified = PF.classify(xs);
    const pattern = row.pattern || classified.pattern;
    const critical = row.critical == null ? 0.8 : Number(row.critical);
    const pred = PF.predict(xs, pattern, critical);
    const last = xs.length ? xs[xs.length - 1] : null;
    return {
      n: xs.length,
      moving_average: ma.value,
      moving_average_window: ma.window,
      trend: tr.trend,
      trend_confidence: tr.confidence,
      direction: tr.direction,
      pattern: pattern,
      classified: classified.pattern,
      prediction: {
        steps_to_critical: cleanSteps(pred.steps_to_critical),
        required_compute_multiplier: pred.required_compute_multiplier,
        intervention_type: pred.intervention_type,
        confidence: pred.confidence
      },
      gn_band: gnBand(last),
      rsoc: rsocBand(last),
      logged_only: true, admit_gate: false, writes: false, calls_llm: false,
      cite: 'ProtoForge thermodynamic_drift.py prediction, called from protoforge.js. GN DriftAnalyzer l.6104. The prediction critical line is the hard stop 0.8.'
    };
  }
  function overrideEffectiveness(pairs) {
    const rows = [];
    for (const pair of pairs || []) {
      const before = finite(pair.before);
      const after = finite(pair.after);
      let reduction = null;
      if (before !== null && after !== null) reduction = before === 0 ? (after === 0 ? 1 : 0) : (before - after) / before;
      rows.push({ before: before, after: after, reduction: reduction, effective: reduction !== null && reduction > 0 });
    }
    const scored = rows.filter(function (r) { return r.reduction !== null; });
    const mean = scored.length ? scored.reduce(function (a, r) { return a + r.reduction; }, 0) / scored.length : null;
    const rate = rows.length ? rows.filter(function (r) { return r.effective; }).length / rows.length : null;
    return {
      rows: rows, mean: mean, rate: rate, count: rows.length,
      logged_only: true, admit_gate: false, writes: false, calls_llm: false,
      cite: 'GN DriftAnalyzer override effectiveness, p148. Reduction is (before − after) / before. It does not admit.'
    };
  }
  function failsafe(row) {
    row = row || {};
    const age = finite(row.loop_age_s);
    const drift = finite(row.drift != null ? row.drift : row.epsilon_s);
    const threads = finite(row.threads);
    const rollback = age !== null && age > 120;
    const threadOverload = threads !== null && threads > 50;
    const outputLoop = row.output_loop === true;
    const docHalt = drift !== null && drift > 0.9;
    const halt = drift !== null && drift > 0.8;
    const echo = row.echo_confirmed === true;
    const chi = row.chi_active === true;
    const resurrect = drift !== null && drift <= 0.3 && echo && !chi && !halt && !rollback;
    let action = 'continue';
    if (rollback) action = 'rollback';
    else if (halt || threadOverload || outputLoop) action = 'halt';
    return {
      action: action, rollback: rollback, halt: halt, thread_overload: threadOverload, output_loop: outputLoop,
      loop_age_s: age, drift: drift, age_limit_s: 120, halt_threshold: 0.8, doc_halt_threshold: 0.9,
      doc_would_halt: docHalt, codex_failsafe_0_9: 'replaced',
      route: rollback ? 'cold_archive' : (action === 'halt' ? 'halt' : 'open'),
      memory_writes_prevented: halt || rollback, resurrect_allowed: resurrect,
      echo_confirmed: echo, chi_active: chi,
      logged_only: true, admit_gate: false, writes: false, calls_llm: false, money: false,
      christping: 'gilligan-only',
      cite: 'Gilligan Codex 3.18. A phase loop older than 120 s rolls back to cold archive. A drift halt above 0.9 is replaced by the hard stop 0.8. Resurrection needs drift at or under 0.3, a confirmed echo, and χ inactive.'
    };
  }
  function codexClass(row) {
    row = row || {};
    const entropy = finite(row.entropy);
    const fatal = row.synthetic === true || row.codex_breach === true || row.echo_valid === false;
    const psiBreak = row.psi_trace_valid === false;
    const naming = row.naming_attempt === true;
    const spike = entropy !== null && entropy > 0.6;
    const ghost = row.feedback_complete === false && !psiBreak;
    const noise = row.skipped_return === true || row.temporary_mismatch === true;
    const lineage = row.lineage_revalidated === true;
    let klass = 0;
    let name = 'none';
    let route = 'none';
    let chiLock = false;
    let archived = false;
    if (fatal) { klass = 4; name = 'fatal'; route = 'blocked'; chiLock = true; }
    else if (spike || psiBreak || naming) { klass = 3; name = 'cold_archive'; route = 'SPC/cold_archive'; chiLock = true; archived = true; }
    else if (ghost) { klass = 2; name = 'ghostable'; route = 'SPC/ghost_loops'; archived = true; }
    else if (noise) { klass = 1; name = 'noise'; route = 'local'; }
    return {
      class: klass, name: name, route: route, restored: false,
      may_reenter: (klass === 2 || klass === 3) && lineage, chi_lock: chiLock, archived: archived,
      notify_christping: klass === 3 || klass === 4, christping: 'gilligan-only', ask_initiated: false,
      entropy: entropy, entropy_gate: 0.6,
      logged_only: true, admit_gate: false, writes: false, calls_llm: false, money: false,
      write_max: KM.DRIFT_RULING.project_max, above_write_law: entropy !== null && entropy > KM.DRIFT_RULING.project_max,
      cite: 'Gilligan Codex Ch.6.1. Class 1 stays local. Class 2 goes to ghost loops. Class 3 is entropy above 0.6, a ψ break, or a naming attempt, and goes to cold archive. Class 4 is fatal and is not restored. The 0.6 cut does not admit.'
    };
  }
  function run(payload) {
    const row = payload || {};
    const op = row.op || 'replay';
    if (op === 'retry') return retryBackoff(row.attempt);
    if (op === 'observe') return observeBreaker(row.state, row.event, row.prior);
    if (op === 'rsoc') return rsocBand(row.epsilon_s);
    if (op === 'cap_k') return capK(row.k, row.epsilon_s);
    if (op === 'gn_band') return gnBand(row.epsilon_s);
    if (op === 'storage') return storageBand(row.epsilon_s);
    if (op === 'analyze') return analyze(row.series, row);
    if (op === 'override') return overrideEffectiveness(row.pairs);
    if (op === 'failsafe') return failsafe(row);
    if (op === 'class') return codexClass(row);
    return replayBreaker(row.samples || []);
  }
  function showNum(n) {
    if (typeof n !== 'number' || !Number.isFinite(n)) return String(n);
    const rounded = Math.round(n * 1e6) / 1e6;
    return String(rounded);
  }
  function monitorLines(mode) {
    if (mode === 'predict') {
      const row = analyze([0.1, 0.2, 0.3, 0.4, 0.5, 0.6], { pattern: 'linear_degradation', window: 3, critical: 0.8 });
      const effect = overrideEffectiveness([{ before: 0.8, after: 0.2 }, { before: 0.5, after: 0.5 }, { before: 0.4, after: 0.6 }]);
      return {
        attrs: { mode: 'predict', status: row.prediction.intervention_type, detail: String(row.prediction.steps_to_critical) },
        lines: [
          'Linear example 0.1 to 0.6. Moving average of the last 3 is ' + showNum(row.moving_average) + '.',
          'Trend ' + showNum(row.trend) + ' ' + row.direction + '. Confidence ' + showNum(row.trend_confidence) + '.',
          'Steps to 0.8: ' + showNum(row.prediction.steps_to_critical) + '. ' + row.prediction.intervention_type + '. Multiplier ' + showNum(row.prediction.required_compute_multiplier) + '. Confidence ' + showNum(row.prediction.confidence) + '.',
          'Override reduction on 0.8 to 0.2 is ' + showNum(effect.rows[0].reduction) + '. Mean ' + showNum(effect.mean) + '. This does not admit.',
          'RSOC ' + row.rsoc.band + '. Genesis band ' + row.gn_band.band + '. Writes off. No LLM.'
        ]
      };
    }
    if (mode === 'failsafe') {
      const young = failsafe({ loop_age_s: 120, drift: 0.2, echo_confirmed: true });
      const old = failsafe({ loop_age_s: 121, drift: 0.2, echo_confirmed: true });
      const held = failsafe({ loop_age_s: 10, drift: 0.8 });
      const halt = failsafe({ loop_age_s: 10, drift: 0.85 });
      const noise = codexClass({ skipped_return: true, entropy: 0.2, feedback_complete: true, psi_trace_valid: true });
      const ghost = codexClass({ feedback_complete: false, psi_trace_valid: true, entropy: 0.4 });
      const cold = codexClass({ entropy: 0.68, psi_trace_valid: false });
      const fatal = codexClass({ synthetic: true, entropy: 0.1, lineage_revalidated: true });
      return {
        attrs: { mode: 'failsafe', status: old.action, detail: 'class-' + fatal.class },
        lines: [
          'Loop age 120 s stays ' + young.action + '. Loop age 121 s ' + old.action + ' to ' + old.route + '.',
          'Drift 0.8 stays ' + held.action + '. Drift 0.85 ' + halt.action + '. Codex 0.9 halt is replaced by ' + halt.halt_threshold + '.',
          'Class 1 ' + noise.name + ' ' + noise.route + ', not archived. Class 2 ' + ghost.route + '.',
          'Class 3 ' + cold.route + ', restored ' + cold.restored + '. Class 4 ' + fatal.route + ', restored ' + fatal.restored + ', reentry ' + fatal.may_reenter + '.',
          'ChristPing stays Gilligan-only. These routes do not admit. Write max ' + fatal.write_max + '. No LLM.'
        ]
      };
    }
    const two = replayBreaker([{ t: 0, epsilon_s: 0.36 }, { t: 0.2, epsilon_s: 0.36 }]);
    const three = replayBreaker([{ t: 0, epsilon_s: 0.36 }, { t: 0.2, epsilon_s: 0.36 }, { t: 0.4, epsilon_s: 0.36 }]);
    const waits = [retryBackoff(1), retryBackoff(2), retryBackoff(3), retryBackoff(4)];
    return {
      attrs: { mode: 'window', status: three.status, detail: three.verdict },
      lines: [
        'Two failures inside 0.7 s stay ' + two.status + '. Count ' + two.failure_count + '.',
        'Three failures inside 0.7 s: ' + three.verdict + '. Status ' + three.status + '. Count ' + three.failure_count + '.',
        'Retry waits ' + waits.map(function (r) { return r.delay_s == null ? 'exhausted' : r.delay_s + ' s'; }).join(', ') + '.',
        'A hard stop above 0.8 and Φ5 to Φ8 still open through the 4.9.191 breaker.',
        'This card does not write. C_min 0.87. No LLM.'
      ]
    };
  }
  function paintMonitor(mode) {
    if (typeof document === 'undefined') return;
    const card = document.getElementById('drift194');
    const body = document.getElementById('drift194Body');
    if (!card || !body) return;
    const view = monitorLines(mode || 'window');
    card.setAttribute('data-drift194-mode', view.attrs.mode);
    card.setAttribute('data-drift194-status', view.attrs.status);
    card.setAttribute('data-drift194-detail', view.attrs.detail);
    body.textContent = view.lines.join('\n');
  }
  function bootMonitor() {
    if (typeof document === 'undefined' || !document.getElementById('drift194')) return;
    paintMonitor('window');
    const buttons = document.querySelectorAll('[data-drift194-run]');
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (ev) {
        paintMonitor(ev.currentTarget.getAttribute('data-drift194-run'));
      });
    }
  }
  const api = {
    CITE: CITE, WINDOW_S: WINDOW_S, MAX_FAILURES: MAX_FAILURES, RECOVERY_S: RECOVERY_S, RETRY_MAX: RETRY_MAX,
    freshBreaker: freshBreaker, observeBreaker: observeBreaker, replayBreaker: replayBreaker,
    retryBackoff: retryBackoff, rsocBand: rsocBand, capK: capK, gnBand: gnBand, storageBand: storageBand,
    movingAverage: movingAverage, analyze: analyze, overrideEffectiveness: overrideEffectiveness,
    failsafe: failsafe, codexClass: codexClass, monitorLines: monitorLines, paintMonitor: paintMonitor, run: run
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Drift194 = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootMonitor);
    else bootMonitor();
  }
})(typeof self !== 'undefined' ? self : this);
