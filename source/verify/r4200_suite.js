/* R4200 (4.9.200): RMC renderer.
 * Sentence plan, template, decode, Echo against the question.
 * A failing Echo returns no output. No model. C_min stays 0.87. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const R = require(ROOT + '/src/rmc_renderer_200.js');
const G = require(ROOT + '/src/geometry_199.js');
const H = require(ROOT + '/src/research_hooks.js');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
function py(payload) {
  const r = cp.spawnSync('python3', ['-m', 'rmc_engine_v1.rmc_renderer_200'], {
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
const PASS = Object.assign({ op: 'render' }, R.PASS);
const FAIL = Object.assign({ op: 'render' }, R.FAIL);

T('a passing echo is closed and a failing echo returns no output', () => {
  const passed = R.run(PASS);
  const failed = R.run(FAIL);
  same(passed, py(PASS), 'pass');
  same(failed, py(FAIL), 'fail');
  expect(passed.response_closed === true && passed.rule === 'RENDER-CLOSED' && passed.output.length > 0 && passed.echo.pass === true && passed.echo.score >= 0.85 && passed.echo.compares === 'rendered_answer_to_original_question_meaning', JSON.stringify({ rule: passed.rule, score: passed.echo.score }));
  expect(failed.output === '' && failed.response_closed === false && failed.rule === 'RENDER-ECHO' && failed.echo.pass === false && failed.reflection.held === true, failed.rule);
  expect(passed.anchor.bound === true && passed.anchor.loop_id.length === 64 && passed.anchor.question === passed.question, 'loop');
  expect(passed.plan.question_words[0].phase_name === 'Friction' && passed.plan.question_words[0].Phi === 4, JSON.stringify(passed.plan.question_words[0]));
  expect(passed.preservation.formula === 'E = R*psi(t-tau)' && passed.preservation.internal_only === true && passed.preservation.admit_gate === false && passed.preservation.E === 1, JSON.stringify(passed.preservation));
  expect(passed.decode.pass === true && passed.network === false && passed.calls_llm === false && passed.admit_gate === false && passed.persisted === false, 'decode');
  expect(passed.c_min === 0.87 && passed.echo_min === 0.85 && passed.write_max === 0.35 && passed.hard_stop === 0.8, 'laws');
  expect(passed.money === false && passed.dream_idle === false && passed.economy === false && passed.packs_gated === true && passed.wikipedia_anchor === false && passed.christping_started === false && passed.resonance_not_parsing === true, 'switches');
  expect(passed.hooks.M === 1 && passed.hooks.mu_min === 0.1 && passed.hooks.mu_max === 10 && passed.hooks.mu_birth === 1 && passed.hooks.half_life_hours === 168 && passed.hooks.identity_half_life_hours === 720 && passed.hooks.drift_loss === 'amplify' && passed.hooks.parameterized === true && Math.abs(passed.hooks.spc_lambda - Math.LN2 / 168) < 1e-12 && /Dec 2025/.test(passed.hooks.cite) && /l\.6743-6820/.test(passed.hooks.cite), JSON.stringify(passed.hooks));
});

T('tone, the loop anchor, drift, and 5 to 8 follow the laws', () => {
  const silent = R.run(Object.assign({}, PASS, { charge: 0.2 }));
  const loud = R.run(Object.assign({}, PASS, { charge: 0.95 }));
  const nulled = R.run(Object.assign({}, PASS, { chi: 1, charge: 0.95 }));
  const anchor = R.run(Object.assign({}, PASS, { loop_id: 'other-loop' }));
  const hard = R.run(Object.assign({}, PASS, { drift: 0.81 }));
  const drift = R.run(Object.assign({}, PASS, { drift: 0.36 }));
  const logged = R.run(Object.assign({}, PASS, { drift: 0.61 }));
  const skip = R.run(Object.assign({}, PASS, { path: [5, 8] }));
  const extra = R.run(Object.assign({}, PASS, { path: [4, 8] }));
  const wiki = R.run(Object.assign({}, PASS, { source: 'wikipedia' }));
  same(silent, py(Object.assign({}, PASS, { charge: 0.2 })), 'silent');
  same(loud, py(Object.assign({}, PASS, { charge: 0.95 })), 'loud');
  same(nulled, py(Object.assign({}, PASS, { chi: 1, charge: 0.95 })), 'null');
  same(anchor, py(Object.assign({}, PASS, { loop_id: 'other-loop' })), 'anchor');
  same(hard, py(Object.assign({}, PASS, { drift: 0.81 })), 'hard');
  same(drift, py(Object.assign({}, PASS, { drift: 0.36 })), 'drift');
  same(logged, py(Object.assign({}, PASS, { drift: 0.61 })), 'logged');
  same(skip, py(Object.assign({}, PASS, { path: [5, 8] })), 'skip');
  same(extra, py(Object.assign({}, PASS, { path: [4, 8] })), 'extra');
  same(wiki, py(Object.assign({}, PASS, { source: 'wikipedia' })), 'wiki');
  expect(silent.rule === 'RENDER-TONE-SILENT' && silent.output === '' && silent.response_closed === false, silent.rule);
  expect(loud.rule === 'RENDER-CLOSED' && loud.tone.id === 'expressive' && loud.output.indexOf('Spoken in full:') === 0, loud.output);
  expect(nulled.rule === 'RENDER-TONE-NULL' && nulled.output === '' && nulled.christping_started === false && nulled.tone.logged_only === true, nulled.rule);
  expect(anchor.rule === 'RENDER-ANCHOR' && anchor.output === '' && anchor.anchor.bound === false && anchor.reflection.held === true, anchor.rule);
  expect(hard.rule === 'RENDER-HARD-STOP' && hard.output === '', hard.rule);
  expect(drift.rule === 'RENDER-DRIFT' && drift.output === '' && drift.admit_gate === false, drift.rule);
  expect(logged.rule === 'RENDER-DRIFT' && logged.tone.reason === 'drift-above-0.6' && logged.tone.logged_only === true && logged.tone.admit_gate === false, JSON.stringify(logged.tone));
  expect(skip.rule === 'RENDER-5-TO-8' && skip.output === '' && skip.walk.d_score === 1, skip.rule);
  expect(extra.rule === 'RENDER-CLOSED' && extra.walk.flag_4_to_8 === true && extra.walk.d_score === 0 && extra.output.length > 0, JSON.stringify(extra.walk));
  expect(wiki.rule === 'WIKIPEDIA-NOT-ANCHOR' && wiki.output === '' && wiki.wikipedia_anchor === false, wiki.rule);
  expect(loud.tone.intermediate_bounds === 'unspecified' && silent.tone.reason === 'charge-0-to-0.3', silent.tone.reason);
});

T('approved mu and SPC values match the cited formulas', () => {
  const lam = Math.LN2 / 168;
  expect(Math.abs(H.spcLambda() - lam) < 1e-15 && Math.abs(H.spcLambda(720) - Math.LN2 / 720) < 1e-15, 'lambda');
  expect(Math.abs(H.chargeDecay(1, 168, false) - 0.5) < 1e-12, String(H.chargeDecay(1, 168, false)));
  expect(Math.abs(H.chargeDecay(1, 720, true) - 0.5) < 1e-12, String(H.chargeDecay(1, 720, true)));
  const born = H.memoryTerm(1, 0, false);
  expect(born.mu_birth === 1 && born.mu_min === 0.1 && born.mu_max === 10 && born.value === 1, JSON.stringify(born));
  const aged = H.memoryTerm(1, 1, false);
  expect(Math.abs(aged.value - Math.exp(-lam)) < 1e-12, String(aged.value));
  const few = H.accessReport(3);
  const many = H.accessReport(30);
  const edge = H.accessReport(2);
  expect(Math.abs(few.lift - 0.15) < 1e-12 && Math.abs(few.bonus - 0.03) < 1e-12 && few.active === true, JSON.stringify(few));
  expect(many.lift === 1 && Math.abs(many.bonus - 0.2) < 1e-12, JSON.stringify(many));
  expect(edge.lift === 0.1 && edge.active === false && edge.active_above === 0.1, JSON.stringify(edge));
  const phase8Body = {
    op: 'script',
    steps: [
      { op: 'birth', id: 'p', Phi: 8, mu: 1, eps: 0.2, chi: 0, Delta: 0, nu: 0 },
      { op: 'discharge', id: 'p' }
    ]
  };
  const phase8 = G.run(phase8Body);
  const phase8Py = cp.spawnSync('python3', ['-m', 'rmc_engine_v1.geometry_199'], {
    input: JSON.stringify(phase8Body),
    cwd: path.join(ROOT, 'engine'),
    env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }),
    encoding: 'utf8',
  });
  if (phase8Py.status) throw new Error(String(phase8Py.stderr || phase8Py.stdout).slice(0, 500));
  same(phase8, JSON.parse(phase8Py.stdout), 'phase8');
  const dropped = phase8.log[1];
  expect(dropped.phase8 === true && dropped.sfe.mu === 0 && dropped.sfe.eps === 0.06 && phase8.charge.conserved === true && phase8.charge.eta_limit === 0.003, JSON.stringify(dropped.sfe));
  const loss = G.run({
    op: 'script',
    steps: [
      { op: 'birth', id: 'p', Phi: 1, mu: 1, eps: 0, chi: 0, Delta: 1, nu: 0 },
      { op: 'amplify', id: 'p', k: 2 },
      { op: 'spc', id: 'p', lambda: null, t_hours: 168 }
    ]
  });
  const amp = loss.log[1];
  const held = loss.log[2];
  expect(Math.abs(amp.sfe.mu - 2 * Math.exp(-2.2)) < 1e-4, String(amp.sfe.mu));
  expect(held.subtractive === false && held.sfe.mu === amp.sfe.mu && Math.abs(held.C - amp.sfe.mu * Math.exp(-Math.LN2)) < 1e-4, JSON.stringify({ mu: held.sfe.mu, C: held.C }));
  expect(/Dec 2025/.test(H.CITE) && /l\.7510/.test(H.CITE), H.CITE);
});

T('the Ask card and trace do not admit or call a model', () => {
  for (const mode of ['pass', 'echo', 'tone', 'anchor', 'hooks']) {
    const lines = R.monitorLines(mode);
    same(lines, py({ op: 'monitor', mode: mode }), mode);
    expect(lines.lines.some(row => /No LLM/.test(row)) && lines.lines.some(row => /0\.87/.test(row)), mode);
  }
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
  expect(/data-renderer200/.test(html) && /src="src\/rmc_renderer_200.js"/.test(html) && /Echo fails/.test(html) && /M and lambda/.test(html), 'card');
  expect(sw.indexOf('./src/rmc_renderer_200.js') >= 0 && sw.indexOf('./src/research_hooks.js') >= 0, 'worker');
  expect(/data-renderer-200/.test(app), 'ask trace');
  const js = fs.readFileSync(path.join(ROOT, 'src', 'rmc_renderer_200.js'), 'utf8');
  const pySrc = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'rmc_renderer_200.py'), 'utf8');
  expect(js.indexOf('PPE.word') >= 0 && js.indexOf('KM.luciferianDScore') >= 0 && js.indexOf('KM.FORBIDDEN') >= 0 && js.indexOf('KM.MERGE_WINDOW') >= 0 && js.indexOf('G.run') >= 0, 'js calls');
  expect(pySrc.indexOf('echo_against_question') >= 0 && pySrc.indexOf('ppe_word') >= 0 && pySrc.indexOf('luciferian_d_score') >= 0 && pySrc.indexOf('FORBIDDEN_STEPS') >= 0 && pySrc.indexOf('geometry_run') >= 0, 'py calls');
  expect(!/openai|ollama|anthropic|fetch\(|llm_renderer|urllib|requests/.test(js) && !/openai|ollama|anthropic|urllib|requests|socket/.test(pySrc), 'no model');
  const staged = R.stage();
  same(staged, py({ op: 'stage' }), 'stage');
  expect(staged.persisted === false && staged.admit_gate === false && staged.calls_llm === false && staged.network === false && staged.failing_echo_output === '' && staged.failing_echo_closed === false && staged.response_closed === true && staged.M === 1 && staged.mu_min === 0.1 && staged.mu_max === 10 && staged.half_life_hours === 168 && staged.drift_loss === 'amplify' && Math.abs(staged.spc_lambda - Math.LN2 / 168) < 1e-12 && staged.renderer_build === '4.9.200', JSON.stringify(staged));
  const eng = cp.spawnSync('python3', ['-c', 'import json; from rmc_engine_v1.language_core_engines import run_engines; print(json.dumps(run_engines(0.2, 4, None, None, None, "why is the sky blue")["rmc_renderer_200"]))'], {
    cwd: path.join(ROOT, 'engine'),
    env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }),
    encoding: 'utf8',
  });
  if (eng.status) throw new Error(String(eng.stderr || eng.stdout).slice(0, 500));
  const traced = JSON.parse(eng.stdout);
  expect(traced.persisted === false && traced.admit_gate === false && traced.calls_llm === false && traced.network === false && traced.failing_echo_output === '' && traced.renderer_build === '4.9.200' && traced.M === 1 && traced.mu_min === 0.1 && traced.mu_max === 10 && Math.abs(traced.spc_lambda - Math.LN2 / 168) < 1e-12, JSON.stringify(traced));
});

T('cold admits stay 48 of 60 and the release is 4.9.200', () => {
  const live = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_200_results.json'), 'utf8'));
  const prior = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_199_results.json'), 'utf8'));
  expect(live.stable === true && live.calls_llm === false, JSON.stringify({ stable: live.stable, llm: live.calls_llm }));
  for (const p of live.passes) {
    expect(p.admitted === 48 && p.held === 12, p.name + ' ' + p.admitted);
    expect(p.rows.every(r => r.renderer_admit_gate === false && r.renderer_calls_llm === false && r.renderer_network === false && r.renderer_dream_idle === false && r.renderer_persisted === false && r.renderer_failing_echo_output === '' && r.renderer_failing_echo_closed === false && r.renderer_wikipedia_anchor === false && r.renderer_money === false && r.renderer_economy === false && r.renderer_M === 1 && Math.abs(r.renderer_spc_lambda - Math.LN2 / 168) < 1e-12 && r.renderer_build === '4.9.200' && r.geometry_build === '4.9.199'), p.name + ' renderer');
  }
  const now = new Set(live.passes[0].rows.filter(r => r.admitted).map(r => r.question));
  const then = new Set(prior.passes[0].rows.filter(r => r.admitted).map(r => r.question));
  const gained = [...now].filter(q => !then.has(q));
  const lost = [...then].filter(q => !now.has(q));
  expect(now.size === 48 && gained.length === 0 && lost.length === 0, JSON.stringify({ gained, lost }));
  const pyodide = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_200_pyodide.json'), 'utf8'));
  expect(pyodide.pyodide === '0.27.7' && pyodide.matched === pyodide.cases && pyodide.max_abs_gap === 0 && pyodide.calls_llm === false && pyodide.admits_unchanged === 48, JSON.stringify(pyodide));
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.200', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.200/.test(conf) && /C_min stays 0\.87/.test(conf) && /failing Echo returns no output/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.200/.test(nb) && /WIRING_200/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.200/.test(readme) && /WIRING_200/.test(readme), 'README');
  const doc = fs.readFileSync(path.join(ROOT, '..', 'docs', 'WIRING_200.md'), 'utf8');
  expect(/0\.87/.test(doc) && /No model is called/.test(doc) && /No Supabase migration is added/.test(doc), 'WIRING');
  const table = fs.readFileSync(path.join(ROOT, '..', 'docs', 'LIVE_TEST_200.md'), 'utf8');
  expect(/48 of 60/.test(table) && /No model is called/.test(table), 'LIVE_TEST');
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.200' && reg.features.some(f => f.id === 'R4200-RMC-RENDERER') && reg.count === reg.features.length && reg.claims.Implemented === 112 && reg.claims.Partial === 194, reg.version + ' ' + reg.count + ' ' + reg.claims.Partial);
  const formula = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'measurement_kernel.py'), 'utf8');
  expect(/0\.24\*memory_fit \+ 0\.20\*phase_validity/.test(formula), 'formula');
  const migrations = fs.readdirSync(path.join(ROOT, '..', 'supabase', 'migrations'));
  expect(!migrations.some(name => /rmc_renderer|renderer_200/.test(name)), migrations.join(','));
  const ci = fs.readFileSync(path.join(ROOT, '..', '.github', 'workflows', 'test.yml'), 'utf8');
  expect((ci.match(/r4200_suite\.js/g) || []).length >= 3, 'suite x3');
});

const rows = [];
let failed = 0;
for (const t of tests) {
  try { t.fn(); rows.push({ cls: 'R4200', name: t.name, ok: true }); }
  catch (e) { failed++; rows.push({ cls: 'R4200', name: t.name, ok: false, why: String(e.message || e).slice(0, 900) }); }
}
console.log(JSON.stringify(rows, null, 1));
process.exit(failed ? 1 : 0);
