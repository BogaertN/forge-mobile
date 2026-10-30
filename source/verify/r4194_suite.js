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

const rows = [];
let failed = 0;
for (const t of tests) {
  try { t.fn(); rows.push({ cls: 'R4194', name: t.name, ok: true }); }
  catch (e) { failed++; rows.push({ cls: 'R4194', name: t.name, ok: false, why: String(e.message || e).slice(0, 900) }); }
}
console.log(JSON.stringify(rows, null, 1));
process.exit(failed ? 1 : 0);
