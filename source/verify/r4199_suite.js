/* R4199 (4.9.199): Geometry gates.
 * An open loop is not sealed. Charge stays on the ledger.
 * Phase 6 is before naming and export. Closure is 2 pi n.
 * RSOC numbers win. Unified Algebra forms are recorded.
 * C_min stays 0.87. No LLM. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const G = require(ROOT + '/src/geometry_199.js');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
function py(payload) {
  const r = cp.spawnSync('python3', ['-m', 'rmc_engine_v1.geometry_199'], {
    input: JSON.stringify(payload),
    cwd: path.join(ROOT, 'engine'),
    env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (r.status) throw new Error(String(r.stderr || r.stdout || 'python failed').slice(0, 800));
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
    const keys = Array.from(new Set(Object.keys(a).concat(Object.keys(b)))).filter(k => a[k] !== undefined || b[k] !== undefined);
    for (const k of keys) {
      if (a[k] === undefined || b[k] === undefined) throw new Error((pathName || '') + '.' + k + ' missing');
      same(a[k], b[k], (pathName || '') + '.' + k);
    }
    return;
  }
  if (a !== b) throw new Error((pathName || '') + ' ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b));
}
const SCRIPT = {
  op: 'script',
  steps: [
    { op: 'birth', id: 'a', Phi: 1, mu: 1, eps: 0, chi: 0, Delta: 0, nu: 0 },
    { op: 'birth', id: 'b', Phi: 1, mu: 1, eps: 0, chi: 0, Delta: 0, nu: 0 },
    { op: 'merge', a: 'a', b: 'b', into: 'm' },
    { op: 'sever', id: 'm', left: 'l', right: 'r' },
    { op: 'seal', path: [1, 2, 3, 4], echo: 0.9, drift: 0.2, question: 'what is open', id: 'geom-open', psi: 'geom', ts: '2026-10-30T19:02:00Z', entropy: 0.2 },
    { op: 'seal', path: [1, 2, 3, 4, 5, 6, 7, 8, 9, 1], echo: 0.9, drift: 0.2, question: 'what returns', id: 'geom-closed', psi: 'geom', ts: '2026-10-30T19:00:00Z', entropy: 0.2 },
    { op: 'membrane', path: [1, 2, 3, 7] },
    { op: 'membrane', path: [1, 6, 7, 8] },
    { op: 'axes', samples: [{ A: 1, C: 1, dt: 1 }], series: [0.5, 0.1], dt: 1, lambda: null },
    { op: 'precedence', ops: ['discharge', 'chi', 'merge', 'memory', 'advance'] }
  ]
};

T('an open loop is not sealed and a closed loop is', () => {
  const ran = G.run(SCRIPT);
  same(ran, py(SCRIPT), 'script');
  const open = ran.log[4];
  const closed = ran.log[5];
  expect(open.sealed === false && open.rule === 'GEOM-OPEN' && open.closure.closed === false && open.closure.n === 0.3333, JSON.stringify({ rule: open.rule, n: open.closure.n }));
  expect(closed.sealed === true && closed.rule === 'DPA-APPENDED' && closed.closure.closed === true && closed.closure.n === 1 && closed.chain_ok === true, closed.rule);
  expect(/^([0-9a-f]{64})$/.test(closed.seal_sha256), closed.seal_sha256);
  expect(ran.admit_gate === false && ran.calls_llm === false && ran.christping_started === false && ran.c_min === 0.87 && ran.echo_min === 0.85 && ran.write_max === 0.35 && ran.hard_stop === 0.8, 'laws');
  expect(ran.money === false && ran.dream_idle === false && ran.economy === false && ran.packs_gated === true && ran.wikipedia_anchor === false && ran.resonance_not_parsing === true, 'switches');
});

T('charge is conserved and RSOC numbers win', () => {
  const ran = G.run(SCRIPT);
  const merge = ran.log[2];
  const charge = ran.charge;
  expect(merge.ok === true && merge.sfe.mu === 2.12 && merge.sfe.nu === 0.3 && merge.sfe.eps === 0 && merge.sfe.Delta === 0 && merge.delta === 0, JSON.stringify(merge.sfe));
  expect(merge.ua.applied === false && merge.ua.numbers === 'RSOC' && merge.ua.constants_numeric === false, JSON.stringify(merge.ua));
  expect(charge.conserved === true && charge.created === 0.12 && charge.residue === 0.08 && charge.live === 2.04 && charge.initial === 2, JSON.stringify(charge));
  expect(charge.ua_exact === false && charge.phase9_within_0_003 === false && charge.eta_limit === 0.003, 'phase 9 band');
  const blocked = ran.log[6];
  const passed = ran.log[7];
  expect(blocked.naming_blocked === true && blocked.pass === false, 'membrane blocks naming');
  expect(passed.pass === true && passed.export_blocked === false && passed.before_naming === true && passed.before_export === true, 'membrane passes 6-7-8');
  const axes = ran.log[8];
  expect(axes.M.lambda_unspecified === false && axes.M.value === 0.9959 && axes.M.integral === 1, JSON.stringify(axes.M));
  expect(axes.V_c.value === 0.4 && axes.V_c.seeding_internal === true && axes.V_c.admit_gate === false, JSON.stringify(axes.V_c));
  expect(ran.log[9].order.join(' ') === 'chi advance merge discharge memory', ran.log[9].order.join(' '));
});

T('operators, the echo trace, and the unparameterized steps match', () => {
  const body = {
    op: 'script',
    steps: [
      { op: 'birth', id: 'p', Phi: 1, mu: 1, eps: 0, chi: 0, Delta: 0, nu: 0 },
      { op: 'amplify', id: 'p', k: 2 },
      { op: 'discharge', id: 'p' },
      { op: 'memory', id: 'p' },
      { op: 'spc', id: 'p', lambda: null },
      { op: 'birth', id: 'q', Phi: 1, mu: 1, eps: 0, chi: 0, Delta: 1, nu: 0, H: 1 },
      { op: 'rates', id: 'q' },
      { op: 'birth', id: 'a', Phi: 1, mu: 1, eps: 0, chi: 0 },
      { op: 'birth', id: 'b', Phi: 4, mu: 1, eps: 0, chi: 0 },
      { op: 'merge', a: 'a', b: 'b', into: 'no' },
      { op: 'echo', tau: Array(100).fill(1).concat(Array(44).fill(5)), Phi: 1 },
      { op: 'echo', tau: Array(99).fill(1), Phi: 1 },
      { op: 'advance', id: 'q', eps_s: 0.69 },
      { op: 'advance', id: 'q', eps_s: 0.7 },
      { op: 'seal', path: [1, 2, 3, 4, 5, 8, 9, 1], echo: 0.9, drift: 0.2, question: 'skip', id: 'geom-skip', psi: 'geom', ts: '2026-10-30T19:00:03Z', entropy: 0.2 },
      { op: 'seal', path: [1, 2, 3, 4, 5, 6, 7, 8, 9, 1], echo: 0.84, drift: 0.2, question: 'low', id: 'geom-low', psi: 'geom', ts: '2026-10-30T19:00:04Z', entropy: 0.2 },
      { op: 'seal', path: [1, 2, 3, 4, 5, 6, 7, 8, 9, 1], echo: 0.9, drift: 0.81, question: 'hard', id: 'geom-hard', psi: 'geom', ts: '2026-10-30T19:00:05Z', entropy: 0.81 }
    ]
  };
  const ran = G.run(body);
  same(ran, py(body), 'ops');
  const amp = ran.log[1];
  expect(amp.ok === true && amp.sfe.mu === 2 && amp.sfe.Delta === 0.18 && amp.sfe.eps === 0.09 && amp.ua.applied === false, JSON.stringify(amp.sfe));
  const dis = ran.log[2];
  expect(dis.sfe.Delta === 0 && dis.sfe.nu === 0 && dis.sfe.eps === 0.027 && dis.sfe.mu === 2 && dis.ua.form.indexOf('mu to 0') >= 0, JSON.stringify(dis.sfe));
  const mem = ran.log[3];
  expect(mem.M === null && mem.lambda_unspecified === false && mem.mu_birth === 1 && mem.mu_min === 0.1 && mem.mu_max === 10 && mem.code_step === 0.46 && Math.abs(mem.lambda - Math.LN2 / 168) < 1e-12, mem.code_step);
  const spc = ran.log[4];
  expect(spc.parameterized === true && spc.subtractive === false && spc.leak === 'amplify' && spc.sfe.mu === mem.sfe.mu && Math.abs(spc.lambda - Math.LN2 / 168) < 1e-12 && spc.cite.indexOf('amplify') >= 0, spc.cite);
  const rates = ran.log[6];
  expect(rates.dmu_dt === null && rates.kappa_unspecified === true && rates.de_dt === 0.149, JSON.stringify(rates));
  const reject = ran.log[9];
  expect(reject.ok === false && reject.eps_tax === 0.07 && reject.a.eps === 0.07 && reject.b.eps === 0.07 && reject.pi_over_2_warning === true && reject.warning_logged_only === true, JSON.stringify(reject));
  expect(ran.log[10].E_hat === 1 && ran.log[10].count === 100 && ran.log[11].E_hat === 0 && ran.log[11].count === 99, 'echo trace');
  expect(ran.log[12].ok === true && ran.log[12].internal_only === true && ran.log[12].admit_gate === false && ran.log[13].ok === false, 'advance gate is internal');
  expect(ran.log[14].sealed === false && ran.log[14].rule === 'GEOM-5-TO-8' && ran.log[14].walk.categorical_hard_fire === true, ran.log[14].rule);
  expect(ran.log[15].rule === 'GEOM-ECHO' && ran.log[16].rule === 'GEOM-HARD-STOP', ran.log[15].rule + ' ' + ran.log[16].rule);
  expect(ran.charge.conserved === true, 'ledger');
});

T('the Ask card and trace do not admit or call a model', () => {
  for (const mode of ['open', 'closure', 'charge', 'membrane', 'operators']) {
    const lines = G.monitorLines(mode);
    same(lines, py({ op: 'monitor', mode: mode }), mode);
    expect(lines.lines.some(row => /No LLM/.test(row)) && lines.lines.some(row => /0\.87/.test(row)), mode);
  }
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
  expect(/data-geometry199/.test(html) && /src="src\/geometry_199.js"/.test(html) && /Open loop/.test(html) && /Charge/.test(html), 'card');
  expect(sw.indexOf('./src/geometry_199.js') >= 0, 'worker');
  expect(/data-geometry-199/.test(app), 'ask trace');
  const js = fs.readFileSync(path.join(ROOT, 'src', 'geometry_199.js'), 'utf8');
  const pySrc = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'geometry_199.py'), 'utf8');
  expect(js.indexOf('KM.merge') >= 0 && js.indexOf('KM.graceIntegral') >= 0 && js.indexOf('KM.MERGE_WINDOW') >= 0 && js.indexOf('Dpa.sealLoop') >= 0 && js.indexOf('KM.luciferianDScore') >= 0, 'js calls');
  expect(pySrc.indexOf('_phase6_before_naming') >= 0 && pySrc.indexOf('_phase6_before_projection') >= 0 && pySrc.indexOf('seal_loop') >= 0 && pySrc.indexOf('luciferian_d_score') >= 0, 'py calls');
  expect(!/openai|ollama|anthropic|fetch\(/.test(js) && !/openai|ollama|anthropic/.test(pySrc), 'no model');
  const staged = G.stage();
  expect(staged.persisted === false && staged.admit_gate === false && staged.open_loop_sealed === false && staged.charge_conserved === true && staged.ua_applied === false && staged.rsoc_numbers === true && staged.dream_idle === false && staged.economy === false, JSON.stringify(staged));
  same(staged, py({ op: 'stage' }), 'stage');
  const eng = cp.spawnSync('python3', ['-c', 'import json; from rmc_engine_v1.language_core_engines import run_engines; print(json.dumps(run_engines(0.2, 4, None, None, None, "why is the sky blue")["geometry_199"]))'], {
    cwd: path.join(ROOT, 'engine'),
    env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }),
    encoding: 'utf8',
  });
  if (eng.status) throw new Error(String(eng.stderr || eng.stdout).slice(0, 500));
  const traced = JSON.parse(eng.stdout);
  expect(traced.persisted === false && traced.admit_gate === false && traced.calls_llm === false && traced.charge_conserved === true && traced.geometry_build === '4.9.199' && traced.ua_applied === false, JSON.stringify(traced));
});

T('cold admits stay 48 of 60 and the release is 4.9.199', () => {
  const live = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_199_results.json'), 'utf8'));
  const prior = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_198_results.json'), 'utf8'));
  expect(live.stable === true && live.calls_llm === false, JSON.stringify({ stable: live.stable, llm: live.calls_llm }));
  for (const p of live.passes) {
    expect(p.admitted === 48 && p.held === 12, p.name + ' ' + p.admitted);
    expect(p.rows.every(r => r.geometry_admit_gate === false && r.geometry_calls_llm === false && r.geometry_dream_idle === false && r.geometry_persisted === false && r.geometry_charge_conserved === true && r.geometry_membrane === true && r.geometry_ua_applied === false && r.geometry_rsoc_numbers === true && r.geometry_open_loop_sealed === false && r.geometry_build === '4.9.199'), p.name + ' geometry');
  }
  const now = new Set(live.passes[0].rows.filter(r => r.admitted).map(r => r.question));
  const then = new Set(prior.passes[0].rows.filter(r => r.admitted).map(r => r.question));
  const gained = [...now].filter(q => !then.has(q));
  const lost = [...then].filter(q => !now.has(q));
  expect(now.size === 48 && gained.length === 0 && lost.length === 0, JSON.stringify({ gained, lost }));
  const pyodide = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_199_pyodide.json'), 'utf8'));
  expect(pyodide.pyodide === '0.27.7' && pyodide.matched === pyodide.cases && pyodide.max_abs_gap === 0 && pyodide.calls_llm === false && pyodide.admits_unchanged === 48, JSON.stringify(pyodide));
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.204', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.199/.test(conf) && /C_min stays 0\.87/.test(conf) && /RSOC numbers win/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.199/.test(nb) && /WIRING_199/.test(nb) && /4\.9\.200/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.199/.test(readme) && /WIRING_199/.test(readme), 'README');
  const doc = fs.readFileSync(path.join(ROOT, '..', 'docs', 'WIRING_199.md'), 'utf8');
  expect(/0\.87/.test(doc) && /No model is called/.test(doc) && /No Supabase migration is added/.test(doc), 'WIRING');
  const table = fs.readFileSync(path.join(ROOT, '..', 'docs', 'LIVE_TEST_199.md'), 'utf8');
  expect(/48 of 60/.test(table) && /No model is called/.test(table), 'LIVE_TEST');
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.204' && reg.features.some(f => f.id === 'R4199-GEOMETRY-GATES') && reg.count === reg.features.length && reg.claims.Implemented === 112 && reg.claims.Partial === 198, reg.version + ' ' + reg.count + ' ' + reg.claims.Partial);
  const formula = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'measurement_kernel.py'), 'utf8');
  expect(/0\.24\*memory_fit \+ 0\.20\*phase_validity/.test(formula), 'formula');
  const migrations = fs.readdirSync(path.join(ROOT, '..', 'supabase', 'migrations'));
  expect(!migrations.some(name => /199|geometry_199/.test(name)), migrations.join(','));
  const ci = fs.readFileSync(path.join(ROOT, '..', '.github', 'workflows', 'test.yml'), 'utf8');
  expect((ci.match(/r4199_suite\.js/g) || []).length >= 3, 'suite x3');
});

const rows = [];
let failed = 0;
for (const t of tests) {
  try { t.fn(); rows.push({ cls: 'R4199', name: t.name, ok: true }); }
  catch (e) { failed++; rows.push({ cls: 'R4199', name: t.name, ok: false, why: String(e.message || e).slice(0, 900) }); }
}
console.log(JSON.stringify(rows, null, 1));
process.exit(failed ? 1 : 0);
