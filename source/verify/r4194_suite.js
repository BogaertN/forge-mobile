/* R4194 (4.9.194): breaker window and retry backoff.
 * The 4.9.191 breaker is called. It is not copied.
 * C_min stays 0.87. No LLM. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const B = require(ROOT + '/src/drift_194.js');
const KM = require(ROOT + '/src/kmath.js');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
function py(payload) {
  const r = cp.spawnSync('python3', ['-m', 'rmc_engine_v1.drift_194'], {
    input: JSON.stringify(payload),
    cwd: path.join(ROOT, 'engine'),
    env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }),
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status) throw new Error(String(r.stderr || r.stdout || 'python failed').slice(0, 500));
  return JSON.parse(r.stdout);
}
function same(a, b, pathName) {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Math.abs(a - b) > 1e-9) throw new Error((pathName || '') + ' ' + a + ' vs ' + b);
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) throw new Error((pathName || '') + ' length');
    a.forEach((x, i) => same(x, b[i], (pathName || '') + '[' + i + ']'));
    return;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = Array.from(new Set(Object.keys(a).concat(Object.keys(b))));
    for (const k of keys) {
      if (!(k in a) || !(k in b)) throw new Error((pathName || '') + '.' + k + ' missing');
      same(a[k], b[k], (pathName || '') + '.' + k);
    }
    return;
  }
  if (a !== b) throw new Error((pathName || '') + ' ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b));
}
const fail = (t) => ({ t: t, epsilon_s: 0.36 });

T('three failures inside 0.7 s open the window and two do not', () => {
  const two = B.replayBreaker([fail(0), fail(0.2)]);
  const three = B.replayBreaker([fail(0), fail(0.2), fail(0.4)]);
  const late = B.replayBreaker([fail(0), fail(0.4), fail(0.71)]);
  expect(two.opened === false && two.status === 'closed' && two.failure_count === 2 && two.verdict === 'closed', JSON.stringify(two));
  expect(three.opened === true && three.status === 'open' && three.verdict === 'circuit_tripped' && three.failure_count === 3, JSON.stringify(three));
  expect(late.opened === false && late.failure_count === 2 && late.steps[2].legacy_tripped === true && late.steps[2].legacy_reason === 'consecutive_failures', JSON.stringify(late));
  expect(three.steps[2].legacy_tripped === true, 'legacy still reports the streak');
  expect(three.admit_gate === false && three.writes === false && three.calls_llm === false && three.money === false, 'laws');
  same(three, py({ samples: [fail(0), fail(0.2), fail(0.4)] }), 'three');
  same(two, py({ samples: [fail(0), fail(0.2)] }), 'two');
  same(late, py({ samples: [fail(0), fail(0.4), fail(0.71)] }), 'late');
});

T('a hard stop and a forbidden step open on one sample by calling the 4.9.191 breaker', () => {
  const hard = B.replayBreaker([{ t: 1, epsilon_s: 0.81 }]);
  const skip = B.replayBreaker([{ t: 1, epsilon_s: 0.1, from: 5, to: 8 }]);
  const mild = B.replayBreaker([{ t: 1, epsilon_s: 0.36 }]);
  const atHard = B.replayBreaker([{ t: 1, epsilon_s: 0.8 }]);
  const atWrite = B.replayBreaker([{ t: 1, epsilon_s: 0.35 }, { t: 1.1, epsilon_s: 0.2 }]);
  expect(hard.verdict === 'hard_stop' && hard.status === 'open' && hard.steps[0].legacy_reason === 'hard_stop', JSON.stringify(hard));
  expect(skip.verdict === 'forbidden_step' && skip.status === 'open', JSON.stringify(skip));
  expect(mild.opened === false && mild.failure_count === 1, JSON.stringify(mild));
  expect(atHard.opened === false && atHard.verdict === 'closed' && atHard.failure_count === 1, JSON.stringify(atHard));
  expect(atWrite.opened === false && atWrite.failure_count === 0, JSON.stringify(atWrite));
  expect(KM.driftCircuitBreaker(0.36, null, [0.36]).tripped === false && KM.driftCircuitBreaker(0.36, null, [0.36, 0.36]).tripped === true, '191 breaker unchanged');
  const src = fs.readFileSync(path.join(ROOT, 'src', 'drift_194.js'), 'utf8');
  const pySrc = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'drift_194.py'), 'utf8');
  expect(src.indexOf('KM.driftCircuitBreaker') >= 0 && pySrc.indexOf('drift_circuit_breaker') >= 0 && src.indexOf('> 0.35') < 0 && pySrc.indexOf('> 0.35') < 0, 'does not copy the write threshold');
  same(hard, py({ samples: [{ t: 1, epsilon_s: 0.81 }] }), 'hard');
  same(skip, py({ samples: [{ t: 1, epsilon_s: 0.1, from: 5, to: 8 }] }), 'skip');
});

T('recovery above 60 s is half-open, and a later success closes it', () => {
  const held = B.replayBreaker([fail(0), fail(0.2), fail(0.4), { t: 60.4, epsilon_s: 0.1 }]);
  const probeAt = B.replayBreaker([fail(0), fail(0.2), fail(0.4), { t: 60.4000001, epsilon_s: 0.9 }]);
  const closed = B.replayBreaker([fail(0), fail(0.2), fail(0.4), { t: 60.4000001, epsilon_s: 0.1 }, { t: 61, epsilon_s: 0.1 }]);
  const failed = B.replayBreaker([fail(0), fail(0.2), fail(0.4), { t: 60.4000001, epsilon_s: 0.1 }, fail(61)]);
  expect(held.status === 'open' && held.verdict === 'open', JSON.stringify({ s: held.status, v: held.verdict }));
  expect(probeAt.verdict === 'testing_recovery' && probeAt.status === 'half_open', JSON.stringify(probeAt));
  expect(closed.verdict === 'recovered' && closed.status === 'closed' && closed.failure_count === 0, JSON.stringify(closed));
  expect(failed.verdict === 'recovery_failed' && failed.status === 'open', JSON.stringify(failed));
  same(closed, py({ samples: [fail(0), fail(0.2), fail(0.4), { t: 60.4000001, epsilon_s: 0.1 }, { t: 61, epsilon_s: 0.1 }] }), 'recovered');
  same(failed, py({ samples: [fail(0), fail(0.2), fail(0.4), { t: 60.4000001, epsilon_s: 0.1 }, fail(61)] }), 'failed');
});

T('retry backoff is 60, 120, 240 and the fourth retry is exhausted', () => {
  const one = B.retryBackoff(1);
  const two = B.retryBackoff(2);
  const three = B.retryBackoff(3);
  const four = B.retryBackoff(4);
  expect(one.allowed === true && one.delay_s === 60, JSON.stringify(one));
  expect(two.delay_s === 120 && three.delay_s === 240 && three.exhausted === false, JSON.stringify(three));
  expect(four.allowed === false && four.exhausted === true && four.delay_s === null && four.tag === 'permanent_ghost', JSON.stringify(four));
  expect(one.writes === false && one.calls_llm === false && one.admit_gate === false, 'retry laws');
  same(one, py({ op: 'retry', attempt: 1 }), 'r1');
  same(two, py({ op: 'retry', attempt: 2 }), 'r2');
  same(three, py({ op: 'retry', attempt: 3 }), 'r3');
  same(four, py({ op: 'retry', attempt: 4 }), 'r4');
});

T('RSOC, Genesis, archive, and resurrect bands stay internal', () => {
  const stable = B.rsocBand(0.2);
  const warn = B.rsocBand(0.5);
  const defer = B.rsocBand(0.75);
  const edge = B.rsocBand(0.70);
  const critical = B.rsocBand(0.8);
  const capped = B.capK(2, 0.5);
  const under = B.capK(1.2, 0.5);
  const calm = B.capK(2, 0.2);
  expect(stable.band === 'stable' && stable.k_cap === null && stable.defer_merge === false && stable.admit_gate === false, JSON.stringify(stable));
  expect(warn.band === 'warning' && warn.k_cap === 1.3 && warn.defer_merge === false, JSON.stringify(warn));
  expect(defer.defer_merge === true && edge.defer_merge === false && edge.band === 'warning', JSON.stringify(edge));
  expect(critical.band === 'critical' && critical.defer_merge === false, JSON.stringify(critical));
  expect(capped.applied === 1.3 && capped.capped === true && under.applied === 1.2 && under.capped === false && calm.applied === 2 && calm.capped === false, JSON.stringify(capped));
  const low = B.gnBand(0.2);
  const mid = B.gnBand(0.5);
  const high = B.gnBand(0.85);
  const top = B.gnBand(0.91);
  const at = B.gnBand(0.8);
  expect(low.band === 'below_0.3' && mid.band === '0.5_to_0.7' && high.band === '0.7_to_0.9' && top.band === 'at_or_above_0.9', JSON.stringify({ low: low.band, mid: mid.band, high: high.band, top: top.band }));
  expect(high.halt_applied === true && high.doc_halt === 0.9 && at.halt_applied === false && top.halt_threshold === 0.8 && high.admit_gate === false, JSON.stringify(high));
  const held = B.storageBand(0.36);
  const write = B.storageBand(0.35);
  const archived = B.storageBand(0.81);
  const resurrect = B.storageBand(0.39);
  expect(held.write_allowed === false && held.resurrect_band === true && held.archive === false && held.writes === false && held.admit_gate === false, JSON.stringify(held));
  expect(write.write_allowed === true && write.writes === false, JSON.stringify(write));
  expect(archived.archive === true && archived.write_allowed === false && resurrect.resurrect_band === true && resurrect.write_allowed === false, JSON.stringify(archived));
  same(defer, py({ op: 'rsoc', epsilon_s: 0.75 }), 'rsoc');
  same(capped, py({ op: 'cap_k', k: 2, epsilon_s: 0.5 }), 'cap');
  same(high, py({ op: 'gn_band', epsilon_s: 0.85 }), 'gn');
  same(held, py({ op: 'storage', epsilon_s: 0.36 }), 'storage');
  same(at, py({ op: 'gn_band', epsilon_s: 0.8 }), 'at8');
});

T('prediction matches the thermodynamic examples, with the moving average and the trend', () => {
  const linear = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
  const row = B.analyze(linear, { pattern: 'linear_degradation', window: 3, critical: 0.8 });
  expect(row.moving_average === 0.5 && row.direction === 'increasing' && Math.abs(row.trend - 0.1) < 1e-12, JSON.stringify(row));
  expect(row.trend_confidence === 1 && row.prediction.intervention_type === 'EMERGENCY_CORRECTION' && row.prediction.required_compute_multiplier === 1.8, JSON.stringify(row.prediction));
  expect(Math.abs(row.prediction.steps_to_critical - 2) < 1e-9 && row.prediction.confidence === 0.98, JSON.stringify(row.prediction));
  expect(row.gn_band.admit_gate === false && row.rsoc.band === 'warning' && row.calls_llm === false, 'bands on the trace');
  const PF = require(ROOT + '/src/protoforge.js');
  const direct = PF.predict(linear, 'linear_degradation', 0.8);
  expect(row.prediction.steps_to_critical === direct.steps_to_critical && row.trend === PF.trend(linear).trend, 'calls protoforge');
  const examples = [
    { series: [0.1, 0.2, 0.4], pattern: 'exponential_explosion', steps: 1, mult: 2.5, kind: 'EMERGENCY_DAMPING', confidence: 0.99 },
    { series: [0.1, 0.2, 0.4, 0.8, 1.6, 3.2], pattern: 'exponential_explosion', steps: 0, mult: 2.5, kind: 'EMERGENCY_DAMPING', confidence: 1 },
    { series: [0.3, 0.7, 0.2, 0.8, 0.1, 0.9, 0.15, 0.85], pattern: 'high_frequency_oscillation', steps: 0, mult: 1.5, kind: 'SPECTRAL_DAMPING', confidence: 1 },
    { series: [0.2, 0.2, 0.2, 1, 1, 1], pattern: 'step_change_catastrophic', steps: 0, mult: 1.8, kind: 'EMERGENCY_CORRECTION', confidence: 1 },
  ];
  for (const ex of examples) {
    const got = B.analyze(ex.series, { pattern: ex.pattern, critical: 0.8 });
    expect(got.prediction.intervention_type === ex.kind && got.prediction.required_compute_multiplier === ex.mult && got.prediction.confidence === ex.confidence, JSON.stringify(got.prediction));
    expect(Math.abs(got.prediction.steps_to_critical - ex.steps) < 1e-9, JSON.stringify(got.prediction));
    same(got, py({ op: 'analyze', series: ex.series, pattern: ex.pattern, critical: 0.8, window: 5 }), ex.kind);
  }
  same(row, py({ op: 'analyze', series: linear, pattern: 'linear_degradation', window: 3, critical: 0.8 }), 'linear');
  const effect = B.overrideEffectiveness([{ before: 0.8, after: 0.2 }, { before: 0.5, after: 0.5 }, { before: 0.4, after: 0.6 }]);
  expect(Math.abs(effect.rows[0].reduction - 0.75) < 1e-12 && effect.rows[1].reduction === 0 && Math.abs(effect.rows[2].reduction + 0.5) < 1e-12, JSON.stringify(effect.rows));
  expect(effect.rate === 1 / 3 && Math.abs(effect.mean - (0.75 - 0.5) / 3) < 1e-12 && effect.admit_gate === false && effect.writes === false, JSON.stringify(effect));
  same(effect, py({ op: 'override', pairs: [{ before: 0.8, after: 0.2 }, { before: 0.5, after: 0.5 }, { before: 0.4, after: 0.6 }] }), 'override');
});

T('a loop older than 120 s rolls back, and the 0.9 halt is the 0.8 hard stop', () => {
  const young = B.failsafe({ loop_age_s: 120, drift: 0.2, echo_confirmed: true });
  const old = B.failsafe({ loop_age_s: 120.1, drift: 0.2, echo_confirmed: true, chi_active: false });
  const under = B.failsafe({ loop_age_s: 10, drift: 0.8 });
  const halt = B.failsafe({ loop_age_s: 10, drift: 0.85 });
  const doc = B.failsafe({ loop_age_s: 10, drift: 0.91 });
  const back = B.failsafe({ loop_age_s: 10, drift: 0.3, echo_confirmed: true, chi_active: false });
  const edge = B.failsafe({ loop_age_s: 10, drift: 0.31, echo_confirmed: true, chi_active: false });
  const chi = B.failsafe({ loop_age_s: 10, drift: 0.2, echo_confirmed: true, chi_active: true });
  const threads = B.failsafe({ loop_age_s: 1, drift: 0.1, threads: 51 });
  const atThreads = B.failsafe({ loop_age_s: 1, drift: 0.1, threads: 50 });
  expect(young.rollback === false && young.action === 'continue' && young.halt === false, JSON.stringify(young));
  expect(old.rollback === true && old.action === 'rollback' && old.route === 'cold_archive' && old.resurrect_allowed === false && old.writes === false, JSON.stringify(old));
  expect(under.halt === false && under.doc_would_halt === false && halt.halt === true && halt.doc_would_halt === false && halt.halt_threshold === 0.8, JSON.stringify(halt));
  expect(doc.halt === true && doc.doc_would_halt === true && doc.codex_failsafe_0_9 === 'replaced' && doc.admit_gate === false, JSON.stringify(doc));
  expect(back.resurrect_allowed === true && edge.resurrect_allowed === false && chi.resurrect_allowed === false, JSON.stringify({ back: back.resurrect_allowed, edge: edge.resurrect_allowed, chi: chi.resurrect_allowed }));
  expect(threads.action === 'halt' && atThreads.action === 'continue' && threads.christping === 'gilligan-only', JSON.stringify(threads));
  same(old, py({ op: 'failsafe', loop_age_s: 120.1, drift: 0.2, echo_confirmed: true, chi_active: false }), 'age');
  same(halt, py({ op: 'failsafe', loop_age_s: 10, drift: 0.85 }), 'halt');
  same(back, py({ op: 'failsafe', loop_age_s: 10, drift: 0.3, echo_confirmed: true, chi_active: false }), 'resurrect');
});

T('Codex drift classes route internally and class 4 is not restored', () => {
  const noise = B.codexClass({ skipped_return: true, entropy: 0.2, feedback_complete: true, psi_trace_valid: true });
  const ghost = B.codexClass({ feedback_complete: false, psi_trace_valid: true, entropy: 0.4 });
  const cold = B.codexClass({ entropy: 0.68, psi_trace_valid: false });
  const named = B.codexClass({ naming_attempt: true, entropy: 0.2, psi_trace_valid: true });
  const fatal = B.codexClass({ synthetic: true, entropy: 0.1, lineage_revalidated: true });
  const echo = B.codexClass({ echo_valid: false, entropy: 0.1 });
  const breach = B.codexClass({ codex_breach: true });
  const back = B.codexClass({ entropy: 0.68, psi_trace_valid: false, lineage_revalidated: true });
  expect(noise.class === 1 && noise.route === 'local' && noise.archived === false && noise.admit_gate === false, JSON.stringify(noise));
  expect(ghost.class === 2 && ghost.route === 'SPC/ghost_loops' && ghost.above_write_law === true && ghost.writes === false, JSON.stringify(ghost));
  expect(cold.class === 3 && cold.route === 'SPC/cold_archive' && cold.restored === false && cold.notify_christping === true && cold.ask_initiated === false, JSON.stringify(cold));
  expect(named.class === 3 && fatal.class === 4 && fatal.restored === false && fatal.may_reenter === false && fatal.route === 'blocked', JSON.stringify(fatal));
  expect(echo.class === 4 && breach.class === 4 && back.may_reenter === true && back.writes === false && back.admit_gate === false, JSON.stringify(back));
  expect(cold.christping === 'gilligan-only' && cold.entropy_gate === 0.6, 'listener');
  same(cold, py({ op: 'class', entropy: 0.68, psi_trace_valid: false }), 'class3');
  same(fatal, py({ op: 'class', synthetic: true, entropy: 0.1, lineage_revalidated: true }), 'class4');
  same(noise, py({ op: 'class', skipped_return: true, entropy: 0.2, feedback_complete: true, psi_trace_valid: true }), 'class1');
  same(ghost, py({ op: 'class', feedback_complete: false, psi_trace_valid: true, entropy: 0.4 }), 'class2');
});

T('the Ask card shows the window, the prediction, and the failsafe', () => {
  const windowed = B.monitorLines('window');
  const predict = B.monitorLines('predict');
  const safe = B.monitorLines('failsafe');
  expect(windowed.attrs.status === 'open' && windowed.attrs.detail === 'circuit_tripped' && /Two failures inside 0\.7 s stay closed/.test(windowed.lines[0]), windowed.lines[0]);
  expect(predict.attrs.status === 'EMERGENCY_CORRECTION' && /Steps to 0\.8: 2/.test(predict.lines[2]), predict.lines[2]);
  expect(safe.attrs.status === 'rollback' && /Class 4 blocked, restored false/.test(safe.lines[3]), safe.lines.join(' | '));
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  expect(/data-drift194/.test(html) && /src="src\/drift_194.js"/.test(html) && sw.indexOf('./src/drift_194.js') >= 0, 'card');
  const stage = py({ op: 'stage', epsilon_s: 0.2 });
  expect(stage.rsoc === 'stable' && stage.failsafe === 'continue' && stage.halt === false && stage.class === 0 && stage.admit_gate === false && stage.writes === false && stage.calls_llm === false, JSON.stringify(stage));
  const hot = py({ op: 'stage', epsilon_s: 0.85 });
  expect(hot.halt === true && hot.archive === true && hot.write_allowed === false && hot.class === 3 && hot.admit_gate === false, JSON.stringify(hot));
});

const rows = [];
let failed = 0;
for (const t of tests) {
  try { t.fn(); rows.push({ cls: 'R4194', name: t.name, ok: true }); }
  catch (e) { failed++; rows.push({ cls: 'R4194', name: t.name, ok: false, why: String(e.message || e).slice(0, 900) }); }
}
console.log(JSON.stringify(rows, null, 1));
process.exit(failed ? 1 : 0);
