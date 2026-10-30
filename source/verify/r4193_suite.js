/* R4193 (4.9.194): drift.py v4.3 core, phase engine, and Codex/UA log rows.
 * C_min stays 0.87. The coherence formula is unchanged. No LLM. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const D = require(ROOT + '/src/drift_v43.js');
const KM = require(ROOT + '/src/kmath.js');
const Next = require(ROOT + '/src/next_layer.js');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const near = (a, b, why) => expect(Math.abs(a - b) < 1e-9, why || (a + ' vs ' + b));

function py(payload) {
  const r = cp.spawnSync('python3', ['-m', 'rmc_engine_v1.drift_v43'], {
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
const steps = [
  { phi: 2, phi_exp: 3, prev: 2 },
  { phi: 3, phi_exp: 4, prev: 3 },
  { phi: 4, phi_exp: 3, prev: 4 },
];

T('prev 5 and Φ_act 8 is d_score 1 and a hard fire, and ε_s at recursion 1 is 31/18', () => {
  const row = D.score({ payload: D.nest(7), prev_phase: 5, recursion_n: 1, phase_hist: [0] });
  expect(row.phi_act === 8 && row.phi_exp === 6 && row.d_score === 1, JSON.stringify({ act: row.phi_act, exp: row.phi_exp, d: row.d_score }));
  expect(row.disposition === 'HARD_FIRE' && row.categorical_hard_fire === true && row.chi_fires === true, row.disposition);
  near(row.eps_s, 31 / 18, 'eps');
  near(row.sigma_res, 0.5);
  near(row.delta_phi, 2 / 9);
  expect(row.recursion_n === 1 && row.laws.writes === false && row.calls_llm === false, 'laws');
  expect(row.phase_names.join(',') === 'Initiation,Polarity,Desire,Friction,Entropy,Grace,Naming,Power,Recursion', row.phase_names.join(','));
  expect(row.phi_act_name === 'Power' && row.step_flag === 1 && row.step_flag_log_only === true, 'step log');
  expect(row.paths.step_flag.categorical_hard_fire === false && row.warn_predictive === true, 'predict');
  const pyRow = py({ payload: D.nest(7), prev_phase: 5, recursion_n: 1, phase_hist: [0] });
  same(row, pyRow, 'worst');
});

T('θ_w at L 0 is 0.40 and the breaker and d_score helpers are the 4.9.191 ones', () => {
  near(KM.adaptiveThreshold(0), 0.4);
  const calm = D.score({ payload: { v: 1 }, prev_phase: 1, recursion_n: 1 });
  near(calm.theta_w, 0.4);
  expect(calm.L_local === 0 && calm.disposition === 'OK', JSON.stringify({ L: calm.L_local, d: calm.disposition }));
  expect(KM.luciferianDScore(5, 8) === 1 && KM.luciferianDScore(4, 8) === 0, 'lemma');
  expect(D.score === D.score && KM.std([0, 1]) === 0.5, 'std reused');
  const src = fs.readFileSync(path.join(ROOT, 'src', 'drift_v43.js'), 'utf8');
  expect(src.indexOf('KM.luciferianDScore') >= 0 && src.indexOf('KM.localCurvature') >= 0 && src.indexOf('KM.adaptiveThreshold') >= 0 && src.indexOf('KM.phaseVelocity') >= 0 && src.indexOf('KM.driftCircuitBreaker') >= 0 && src.indexOf('KM.std') >= 0, 'reuse');
});

T('two consecutive drifts do not fire χ and three do', () => {
  const two = D.phaseEngine(steps.slice(0, 2));
  const three = D.phaseEngine(steps);
  expect(two.consecutive === 2 && two.chi === false && two.chi_triggers.length === 0, JSON.stringify(two.chi_triggers));
  expect(three.consecutive === 3 && three.chi === true && three.chi_triggers.indexOf('consecutive') >= 0, JSON.stringify(three.chi_triggers));
  expect(three.entropy < 0.8 && three.drift_acc < 2.5 && three.predicted < 2.5 && three.admit_gate === false, JSON.stringify(three));
  same(three, py({ op: 'phase_engine', steps: steps }), 'engine');
});

T('5 to 8 is flagged on every path and 4 to 8 is only the axiom flag', () => {
  const row = D.score({ payload: D.nest(7), prev_phase: 5, recursion_n: 1, phase_hist: [0] });
  for (const key of Object.keys(row.paths)) expect(row.paths[key].flag_5_to_8 === true, key);
  expect(row.paths.d_score.hard_fire === true && row.paths.breaker.reason === 'forbidden_step', JSON.stringify(row.paths.breaker));
  const axiom = D.score({ payload: D.nest(7), prev_phase: 4, recursion_n: 1, phase_hist: [0] });
  expect(axiom.d_score === 0 && axiom.categorical_hard_fire === false && axiom.rsoc_axiom2 === true && axiom.paths.rsoc_axiom2.flag_4_to_8 === true, JSON.stringify({ d: axiom.d_score, ax: axiom.rsoc_axiom2 }));
  const br = KM.driftCircuitBreaker(0.1, { from: 5, to: 8 });
  const br4 = KM.driftCircuitBreaker(0.1, { from: 4, to: 8 });
  expect(br.tripped === true && br.reason === 'forbidden_step' && br4.tripped === true && br4.reason === 'forbidden_step', 'breaker');
  expect(D.allowsSkip(5, 8) === false && D.GENESIS_SKIP_PORTED === false && Object.keys(D.SKIP_PATTERNS).length === 0, 'skip');
  expect(KM.FORBIDDEN.some(p => p[0] === 5 && p[1] === 8) && KM.isForbidden({ from: 5, to: 8 }) === true, 'forbidden');
});

T('phase-step flag, entropy cascade, singularity, charge, mask, bands, and restore stay log-only', () => {
  expect(D.stepFlag(8, 5) === 1 && D.stepFlag(2, 1) === 0 && D.stepFlag(1, 9) === 0 && D.stepFlag(4, 4) === 0, 'steps');
  const cascade = D.epsilonCascade({ epsilon: 0.2, delta: 4, mu: 2 });
  expect(cascade.alpha === 0 && cascade.beta === 0 && cascade.alpha_status === 'unspecified' && cascade.beta_status === 'unspecified' && cascade.epsilon_next === 0.2 && cascade.logged_only === true, JSON.stringify(cascade));
  const payload = { core_state: { text: 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ' }, auxiliary: { q: 'hello-world-more-text' }, metadata: { id: 7 } };
  const trace = { totally: 'different', list: [1, 2, 3, 4] };
  const sing = D.score({ payload: payload, psi1_trace: trace, prev_phase: 1, recursion_n: 1, latency_ms: 2000, size_hist: [10, 20, 30], prev_D: 0.2, nu: -0.5 });
  expect(sing.D > 0.8 && sing.singularity.warn === true && sing.singularity.categorical_hard_fire === false && sing.writes === false && sing.categorical_hard_fire === false, JSON.stringify(sing.singularity));
  const falling = D.score({ payload: payload, psi1_trace: trace, prev_phase: 1, recursion_n: 1, latency_ms: 2000, size_hist: [10, 20, 30], prev_D: 2, nu: -0.5 });
  const risingNu = D.score({ payload: payload, psi1_trace: trace, prev_phase: 1, recursion_n: 1, latency_ms: 2000, size_hist: [10, 20, 30], prev_D: 0.2, nu: 0.2 });
  expect(falling.singularity.warn === false && risingNu.singularity.warn === false, 'singularity edges');
  const lawful = D.chargeStep(0.95, true);
  const skip = D.chargeStep(0.2, false);
  const floor = D.chargeStep(0.1, false);
  near(lawful.charge_next, 1);
  near(skip.charge_next, 0);
  near(floor.charge_next, 0);
  expect(lawful.writes === false && skip.skip === true, 'charge');
  const masked = D.score({ payload: { v: 1 }, prev_phase: 1, recursion_n: 1, signatures: [{ v: 1 }] });
  expect(masked.drift_mask.hit === true && masked.drift_mask.warn === true && masked.drift_mask.chi_check === true && masked.drift_mask.similarity >= 0.7 && masked.drift_mask.categorical_hard_fire === false, JSON.stringify(masked.drift_mask));
  const clear = D.score({ payload: { v: 1 }, prev_phase: 1, recursion_n: 1, signatures: [] });
  expect(clear.drift_mask.hit === false && clear.drift_mask.chi_check === false, 'no mask');
  expect(sing.bands.epsilon.logged_only === true && sing.bands.epsilon.admit_gate === false && sing.bands.composite.admit_gate === false, 'bands');
  expect(sing.laws.codex_failsafe_0_9 === 'replaced' && sing.laws.failsafe_applied === 0.8 && sing.laws.hard_stop === 0.8 && sing.laws.write_max === 0.35 && sing.laws.above_write_law === true && sing.laws.C_min === 0.87 && sing.laws.echo_min === 0.85, JSON.stringify(sing.laws));
  expect(sing.laws.calls_llm === false && sing.laws.money === false && sing.laws.packs_gated === true && sing.laws.wikipedia_anchor === false && sing.laws.christping === 'gilligan-only', 'fixed laws');
  const restored = D.restoreFromChi({ echo_confirmed: true, drift: 0.29, phase_sequence: [9, 1, 2], chi_window_ms: 3000 });
  const late = D.restoreFromChi({ echo_confirmed: true, drift: 0.29, phase_sequence: [1, 2], chi_window_ms: 3001 });
  const high = D.restoreFromChi({ echo_confirmed: true, drift: 0.3, phase_sequence: [1, 2], chi_window_ms: 3000 });
  const silent = D.restoreFromChi({ echo_confirmed: false, drift: 0.1, phase_sequence: [1, 2], chi_window_ms: 1000 });
  const broken = D.restoreFromChi({ echo_confirmed: true, drift: 0.1, phase_sequence: [5, 8], chi_window_ms: 1000 });
  expect(restored.allowed === true && restored.writes === false, JSON.stringify(restored));
  expect(late.allowed === false && high.allowed === false && silent.allowed === false && broken.allowed === false && broken.sequence_ok === false, 'restore gates');
  const pair = { core_state: { a: 1, b: 2, c: 3 }, auxiliary: { k: 'alpha' }, metadata: { n: 1 } };
  const other = { core_state: { a: 1, b: 32, c: 3 }, auxiliary: { k: 'alpha' }, metadata: { n: 32 } };
  const conv = D.score({ payload: pair, psi1_trace: other, prev_phase: 2, recursion_n: 1 });
  expect(conv.convergent === true && conv.phase_after === 9 && conv.phase_after_name === 'Recursion' && Math.abs(conv.chi_t - 0.5 * conv.theta_t) < 1e-12, JSON.stringify({ c: conv.convergent, p: conv.phase_after_name }));
  const fast = D.score({ payload: { v: 1 }, prev_phase: 1, recursion_n: 1, stamps_ms: [0, 5, 10] });
  const slow = D.score({ payload: { v: 1 }, prev_phase: 1, recursion_n: 1, stamps_ms: [0, 20, 40] });
  expect(fast.acceleration === true && fast.velocity.guarantee === 'no formal guarantee' && slow.acceleration === false, 'velocity');
  near(D.score({ payload: { v: 1 }, prev_phase: 1, latency_ms: 1000 }).A_time, 1);
  near(D.score({ payload: { v: 1 }, prev_phase: 1, latency_ms: 750 }).A_time, 0.5);
  near(D.score({ payload: { v: 1 }, prev_phase: 1, latency_ms: 0 }).A_time, 0);
  const first = D.score({ payload: { v: 1 }, prev_phase: 1 });
  const second = D.score({ payload: { v: 1 }, prev_phase: 1, seen_hashes: first.seen_hashes });
  near(first.N, 0.2);
  near(second.N, 0);
  const weighed = 0.30 * sing.H_norm + 0.15 * sing.S_norm + 0.10 * sing.N + 0.25 * sing.chi_struct + 0.10 * sing.A_time + 0.10 * sing.eps_s;
  near(sing.D, weighed, 'composite');
  same(sing, py({ payload: payload, psi1_trace: trace, prev_phase: 1, recursion_n: 1, latency_ms: 2000, size_hist: [10, 20, 30], prev_D: 0.2, nu: -0.5 }), 'sing');
  same(restored, py({ op: 'restore', echo_confirmed: true, drift: 0.29, phase_sequence: [9, 1, 2], chi_window_ms: 3000 }), 'restore');
});

T('cold admits stay 48 of 60 and the version registry names 4.9.194', () => {
  const live = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_193_results.json'), 'utf8'));
  const prior = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_191_results.json'), 'utf8'));
  expect(live.stable === true && live.calls_llm === false, JSON.stringify({ stable: live.stable, llm: live.calls_llm }));
  for (const p of live.passes) expect(p.admitted === 48 && p.held === 12, p.name + ' ' + p.admitted);
  const now = new Set(live.passes[0].rows.filter(r => r.admitted).map(r => r.question));
  const then = new Set(prior.passes[0].rows.filter(r => r.admitted).map(r => r.question));
  expect(now.size === 48 && [...now].every(q => then.has(q)), 'admit set moved');
  const pyodide = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_193_pyodide.json'), 'utf8'));
  expect(pyodide.pyodide === '0.27.7' && pyodide.matched === pyodide.cases && pyodide.max_abs_gap === 0 && pyodide.calls_llm === false, JSON.stringify(pyodide));
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.195', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.193/.test(conf) && /C_min stays 0\.87/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.193/.test(nb) && /WIRING_193/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.193/.test(readme) && /WIRING_193/.test(readme), 'README');
  const doc = fs.readFileSync(path.join(ROOT, '..', 'docs', 'WIRING_193.md'), 'utf8');
  expect(/0\.87/.test(doc) && /No model is called/.test(doc) && /not ported/.test(doc), 'WIRING');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.195' && (tgt.suites[0] === 'r4195_suite.js' || tgt.suites[0] === 'r4194_suite.js'), JSON.stringify({ release: tgt.release, head: tgt.suites[0] }));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.195' && reg.features.some(f => f.id === 'R4193-DRIFT-V43') && reg.count === reg.features.length && reg.claims.Implemented === 112, reg.version + ' ' + reg.count);
  const monitor = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  expect(/data-drift-monitor/.test(monitor) && /src="src\/drift_v43.js"/.test(monitor), 'monitor');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  expect(sw.indexOf('./src/drift_v43.js') >= 0, 'sw');
});

T('the module does not call a model and the switches default off', () => {
  const js = fs.readFileSync(path.join(ROOT, 'src', 'drift_v43.js'), 'utf8');
  const pySrc = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'drift_v43.py'), 'utf8');
  expect(!/openai|ollama|anthropic|fetch\(/.test(js) && !/openai|ollama|import requests/.test(pySrc), 'no model');
  expect(Next.SWITCHES.dream_idle === false && Next.SWITCHES.economy === false, 'defaults');
  Next.set('dream_idle', true);
  Next.set('economy', true);
  expect(Next.enabled('dream_idle') === true && Next.enabled('economy') === true, 'test-only enable');
  Next.set('dream_idle', false);
  Next.set('economy', false);
  expect(Next.SWITCHES.dream_idle === false && Next.SWITCHES.economy === false, 'restored');
  const formula = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'measurement_kernel.py'), 'utf8');
  expect(/0\.24\*memory_fit \+ 0\.20\*phase_validity/.test(formula), 'formula');
  expect(KM.DRIFT_RULING.project_max === 0.35 && KM.CHI_HARDENING.theta_hard === 0.8 && KM.internalPhaseCoherence(0.35).admit_gate === false && KM.internalPhaseCoherence(0.35).C_min === 0.87, 'unchanged gates');
});

const rows = [];
let failed = 0;
for (const t of tests) {
  try { t.fn(); rows.push({ cls: 'R4193', name: t.name, ok: true }); }
  catch (e) { failed++; rows.push({ cls: 'R4193', name: t.name, ok: false, why: String(e.message || e).slice(0, 900) }); }
}
console.log(JSON.stringify(rows, null, 1));
process.exit(failed ? 1 : 0);
