/* R4201 (4.9.201): GILIN / CRP.
 * CRP 0.78, warn 0.40, and C* 0.82 are internal. They do not admit.
 * Admission stays 0.87 and drift at or under 0.35. No model. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const G = require(ROOT + '/src/gilin_crp_201.js');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
function py(payload) {
  const r = cp.spawnSync('python3', ['-m', 'rmc_engine_v1.gilin_crp_201'], {
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
function body(extra) {
  return Object.assign({
    op: 'evaluate',
    question: 'Why is the sky blue?',
    candidate: 'The sky is blue because sunlight scatters.',
    C: 0.9,
    drift: 0.2,
    nodes: [
      { id: 'a', Phi: 1, chi: 0, mu: 1, eps: 0, Delta: 0, nu: 0 },
      { id: 'b', Phi: 2, chi: 0, mu: 1, eps: 0, Delta: 0, nu: 0 }
    ]
  }, extra || {});
}

T('internal checks do not admit and the law witness stays at 0.87 and 0.35', () => {
  const beat = G.run(body());
  const crp = G.run(body({ C: 0.78 }));
  const below = G.run(body({ C: 0.779 }));
  const star = G.run(body({ C: 0.82 }));
  const under = G.run(body({ C: 0.869 }));
  const law = G.run(body({ C: 0.87, drift: 0.35 }));
  const warn = G.run(body({ drift: 0.4 }));
  const quiet = G.run(body({ drift: 0.39 }));
  const edge = G.run(body({ drift: 0.36, C: 0.9 }));
  same(beat, py(body()), 'beat');
  same(crp, py(body({ C: 0.78 })), 'crp');
  same(below, py(body({ C: 0.779 })), 'below');
  same(star, py(body({ C: 0.82 })), 'star');
  same(under, py(body({ C: 0.869 })), 'under');
  same(law, py(body({ C: 0.87, drift: 0.35 })), 'law');
  same(warn, py(body({ drift: 0.4 })), 'warn');
  same(quiet, py(body({ drift: 0.39 })), 'quiet');
  same(edge, py(body({ drift: 0.36, C: 0.9 })), 'edge');
  expect(beat.rule === 'GILIN-LAW-WITNESS' && beat.coordinated === true && beat.law_witness === true && beat.admit_gate === false && beat.persisted === false, beat.rule);
  expect(beat.nodes[0].phase_name === 'Initiation' && beat.nodes[1].phase_name === 'Polarity' && beat.nodes[0].glyph === '⊙' && beat.coordination.window === 'pi/4' && beat.coordination.ok === true, JSON.stringify(beat.nodes));
  expect(crp.rule === 'GILIN-CRP' && crp.internal.crp === true && crp.internal.c_star === false && crp.law_witness === false && crp.admit_gate === false && crp.internal.logged_only === true, crp.rule);
  expect(below.internal.crp === false && below.law_witness === false, 'below crp');
  expect(star.rule === 'GILIN-C-STAR' && star.internal.c_star === true && star.internal.crp === true && star.law_witness === false && star.c_ok === false, star.rule);
  expect(under.law_witness === false && under.c_ok === false && under.internal.c_star === true, 'under law');
  expect(law.rule === 'GILIN-LAW-WITNESS' && law.law_witness === true && law.admit_gate === false && law.write_ok === true && law.echo.pass === true && law.echo.score >= 0.85 && law.echo.compares === 'rendered_answer_to_original_question_meaning', JSON.stringify({ rule: law.rule, echo: law.echo }));
  expect(warn.rule === 'GILIN-WARN' && warn.internal.warn === true && warn.write_ok === false && warn.law_witness === false && warn.admit_gate === false, warn.rule);
  expect(quiet.internal.warn === false && quiet.write_ok === false && quiet.law_witness === false, '0.39 is above the write law and under the 0.40 warn');
  expect(edge.internal.warn === false && edge.law_witness === false && edge.rule === 'GILIN-C-STAR', edge.rule);
  expect(beat.c_min === 0.87 && beat.echo_min === 0.85 && beat.write_max === 0.35 && beat.hard_stop === 0.8, 'laws');
  expect(beat.internal.crp_threshold === 0.78 && beat.internal.warn_threshold === 0.4 && beat.internal.c_star_threshold === 0.82, 'thresholds');
  expect(beat.money === false && beat.dream_idle === false && beat.economy === false && beat.packs_gated === true && beat.wikipedia_anchor === false && beat.christping_started === false && beat.heartbeat_hz === 144 && beat.heartbeat_is_timer === false && beat.network === false && beat.resonance_not_parsing === true, 'switches');
  expect(beat.hooks.M === 1 && beat.hooks.mu_min === 0.1 && beat.hooks.mu_max === 10 && beat.hooks.mu_birth === 1 && beat.hooks.half_life_hours === 168 && beat.hooks.drift_loss === 'amplify' && Math.abs(beat.hooks.spc_lambda - Math.LN2 / 168) < 1e-12, JSON.stringify(beat.hooks));
});

T('the merge window, 5 to 8, and a failing echo follow the reused modules', () => {
  const wide = G.run(body({ nodes: [{ id: 'a', Phi: 1, chi: 0 }, { id: 'b', Phi: 4, chi: 0 }] }));
  const chi = G.run(body({ nodes: [{ id: 'a', Phi: 1, chi: 0 }, { id: 'b', Phi: 2, chi: 1 }] }));
  const skip = G.run(body({ path: [5, 8] }));
  const extra = G.run(body({ path: [4, 8] }));
  const hard = G.run(body({ drift: 0.81 }));
  const wiki = G.run(body({ source: 'wikipedia' }));
  const echo = G.run(body({ candidate: 'Chlorine gas is toxic.' }));
  const named = G.run(body({ nodes: [{ id: 'a', word: 'sky' }, { id: 'b', Phi: 2 }] }));
  for (const row of [
    [wide, body({ nodes: [{ id: 'a', Phi: 1, chi: 0 }, { id: 'b', Phi: 4, chi: 0 }] })],
    [chi, body({ nodes: [{ id: 'a', Phi: 1, chi: 0 }, { id: 'b', Phi: 2, chi: 1 }] })],
    [skip, body({ path: [5, 8] })],
    [extra, body({ path: [4, 8] })],
    [hard, body({ drift: 0.81 })],
    [wiki, body({ source: 'wikipedia' })],
    [echo, body({ candidate: 'Chlorine gas is toxic.' })],
    [named, body({ nodes: [{ id: 'a', word: 'sky' }, { id: 'b', Phi: 2 }] })]
  ]) same(row[0], py(row[1]), row[0].rule);
  expect(wide.rule === 'GILIN-WINDOW' && wide.coordination.ok === false && wide.coordinated === false && wide.law_witness === true && wide.admit_gate === false, wide.rule);
  expect(chi.coordination.ok === false && chi.christping_started === false && chi.christping === 'gilligan-only', chi.rule);
  expect(skip.rule === 'GILIN-5-TO-8' && skip.walk.d_score === 1 && skip.drift_core.d_score === 1 && skip.drift_core.categorical_hard_fire === true && skip.drift_core.phi_act_name === 'Power' && skip.drift_core.disposition === 'HARD_FIRE' && skip.law_witness === false && skip.coordinated === false && skip.renderer.rule === 'RENDER-5-TO-8', JSON.stringify(skip.drift_core));
  expect(extra.walk.flag_4_to_8 === true && extra.walk.d_score === 0 && extra.drift_core.d_score === 0 && extra.law_witness === true && extra.rule === 'GILIN-LAW-WITNESS', JSON.stringify(extra.walk));
  expect(hard.rule === 'GILIN-HARD-STOP' && hard.law_witness === false && hard.coordinated === false && hard.renderer.rule === 'RENDER-HARD-STOP', hard.rule);
  expect(wiki.rule === 'GILIN-WIKIPEDIA' && wiki.wikipedia_anchor === false && wiki.law_witness === false && wiki.renderer.rule === 'WIKIPEDIA-NOT-ANCHOR', wiki.rule);
  expect(echo.echo.pass === false && echo.law_witness === false && echo.echo.score < 0.85 && echo.renderer.rule === 'RENDER-ECHO', JSON.stringify(echo.echo));
  expect(named.nodes[0].word === 'sky' && named.nodes[0].Phi === 4 && named.nodes[0].phase_name === 'Friction' && named.coordination.ok === false, JSON.stringify(named.nodes[0]));
});

T('the Ask card and trace do not admit or call a model', () => {
  for (const mode of ['heartbeat', 'crp', 'warn', 'cstar', 'law', 'skip']) {
    const lines = G.monitorLines(mode);
    same(lines, py({ op: 'monitor', mode: mode }), mode);
    expect(lines.lines.some(row => /No LLM/.test(row)) && lines.lines.some(row => /0\.87/.test(row)), mode);
  }
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
  expect(/data-gilin201/.test(html) && /src="src\/gilin_crp_201.js"/.test(html) && /CRP 0\.78/.test(html) && /C\* 0\.82/.test(html) && /5 to 8/.test(html), 'card');
  expect(sw.indexOf('./src/gilin_crp_201.js') >= 0, 'worker');
  expect(/data-gilin-201/.test(app) && /CRP admits/.test(app), 'ask trace');
  const js = fs.readFileSync(path.join(ROOT, 'src', 'gilin_crp_201.js'), 'utf8');
  const pySrc = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'gilin_crp_201.py'), 'utf8');
  expect(js.indexOf('V43.score') >= 0 && js.indexOf('KM.luciferianDScore') >= 0 && js.indexOf('KM.FORBIDDEN') >= 0 && js.indexOf('G.run') >= 0 && js.indexOf('R.render') >= 0 && js.indexOf('PPE.word') >= 0 && js.indexOf('Hooks.spcLambda') >= 0, 'js calls');
  expect(pySrc.indexOf('drift_score') >= 0 && pySrc.indexOf('luciferian_d_score') >= 0 && pySrc.indexOf('geometry_run') >= 0 && pySrc.indexOf('ppe_word') >= 0 && pySrc.indexOf('render(') >= 0 && pySrc.indexOf('spc_lambda') >= 0, 'py calls');
  expect(!/openai|ollama|anthropic|fetch\(|llm_renderer|urllib|requests/.test(js) && !/openai|ollama|anthropic|urllib|requests|socket/.test(pySrc), 'no model');
  const staged = G.stage();
  same(staged, py({ op: 'stage' }), 'stage');
  expect(staged.persisted === false && staged.admit_gate === false && staged.calls_llm === false && staged.network === false && staged.crp_admits === false && staged.c_star_admits === false && staged.warn_admits === false && staged.crp_law_witness === false && staged.c_star_law_witness === false && staged.warn_law_witness === false && staged.law_witness === true && staged.law_admit_gate === false && staged.skip_rule === 'GILIN-5-TO-8' && staged.skip_law_witness === false && staged.coordinated === true && staged.M === 1 && staged.mu_min === 0.1 && staged.mu_max === 10 && staged.half_life_hours === 168 && Math.abs(staged.spc_lambda - Math.LN2 / 168) < 1e-12 && staged.gilin_build === '4.9.201' && staged.phase_names[0] === 'Initiation' && staged.phase_names[1] === 'Polarity', JSON.stringify(staged));
  const eng = cp.spawnSync('python3', ['-c', 'import json; from rmc_engine_v1.language_core_engines import run_engines; print(json.dumps(run_engines(0.2, 4, None, None, None, "why is the sky blue")["gilin_crp_201"]))'], {
    cwd: path.join(ROOT, 'engine'),
    env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }),
    encoding: 'utf8',
  });
  if (eng.status) throw new Error(String(eng.stderr || eng.stdout).slice(0, 500));
  const traced = JSON.parse(eng.stdout);
  expect(traced.persisted === false && traced.admit_gate === false && traced.calls_llm === false && traced.crp_admits === false && traced.c_star_admits === false && traced.law_admit_gate === false && traced.gilin_build === '4.9.201' && traced.M === 1 && Math.abs(traced.spc_lambda - Math.LN2 / 168) < 1e-12, JSON.stringify(traced));
});

T('cold admits stay 48 of 60 and the release is 4.9.201', () => {
  const live = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_201_results.json'), 'utf8'));
  const prior = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_200_results.json'), 'utf8'));
  expect(live.stable === true && live.calls_llm === false, JSON.stringify({ stable: live.stable, llm: live.calls_llm }));
  for (const p of live.passes) {
    expect(p.admitted === 48 && p.held === 12, p.name + ' ' + p.admitted);
    expect(p.rows.every(r => r.gilin_admit_gate === false && r.gilin_calls_llm === false && r.gilin_network === false && r.gilin_dream_idle === false && r.gilin_persisted === false && r.gilin_wikipedia_anchor === false && r.gilin_money === false && r.gilin_economy === false && r.gilin_crp_admits === false && r.gilin_c_star_admits === false && r.gilin_warn_admits === false && r.gilin_law_admit_gate === false && r.gilin_christping_started === false && r.gilin_M === 1 && Math.abs(r.gilin_spc_lambda - Math.LN2 / 168) < 1e-12 && r.gilin_build === '4.9.201' && r.renderer_build === '4.9.200'), p.name + ' gilin');
  }
  const now = new Set(live.passes[0].rows.filter(r => r.admitted).map(r => r.question));
  const then = new Set(prior.passes[0].rows.filter(r => r.admitted).map(r => r.question));
  const gained = [...now].filter(q => !then.has(q));
  const lost = [...then].filter(q => !now.has(q));
  expect(now.size === 48 && gained.length === 0 && lost.length === 0, JSON.stringify({ gained, lost }));
  const held = live.passes[0].rows.filter(r => !r.admitted).map(r => r.question);
  expect(held.length === 12, String(held.length));
  const audit = fs.readFileSync(path.join(ROOT, '..', 'docs', 'HELD_AUDIT_201.md'), 'utf8');
  for (const q of held) expect(audit.indexOf(q) >= 0, q);
  expect(/does not admit/.test(audit) && /Echo is 0/.test(audit) && /Blargh floople zig/.test(audit), 'audit');
  const pyodide = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_201_pyodide.json'), 'utf8'));
  expect(pyodide.pyodide === '0.27.7' && pyodide.matched === pyodide.cases && pyodide.max_abs_gap === 0 && pyodide.calls_llm === false && pyodide.admits_unchanged === 48, JSON.stringify(pyodide));
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.202', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.201/.test(conf) && /C_min stays 0\.87/.test(conf) && /do not admit/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.201/.test(nb) && /WIRING_201/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.201/.test(readme) && /WIRING_201/.test(readme), 'README');
  const doc = fs.readFileSync(path.join(ROOT, '..', 'docs', 'WIRING_201.md'), 'utf8');
  expect(/0\.87/.test(doc) && /No model is called/.test(doc) && /No Supabase migration is added/.test(doc), 'WIRING');
  const table = fs.readFileSync(path.join(ROOT, '..', 'docs', 'LIVE_TEST_201.md'), 'utf8');
  expect(/48 of 60/.test(table) && /No model is called/.test(table), 'LIVE_TEST');
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.202' && reg.features.some(f => f.id === 'R4201-GILIN-CRP') && reg.count === reg.features.length && reg.claims.Implemented === 112 && reg.claims.Partial === 196, reg.version + ' ' + reg.count + ' ' + reg.claims.Partial);
  const formula = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'measurement_kernel.py'), 'utf8');
  expect(/0\.24\*memory_fit \+ 0\.20\*phase_validity/.test(formula), 'formula');
  const migrations = fs.readdirSync(path.join(ROOT, '..', 'supabase', 'migrations'));
  expect(!migrations.some(name => /gilin|crp_201/.test(name)), migrations.join(','));
  const ci = fs.readFileSync(path.join(ROOT, '..', '.github', 'workflows', 'test.yml'), 'utf8');
  expect((ci.match(/r4201_suite\.js/g) || []).length >= 3, 'suite x3');
});

const rows = [];
let failed = 0;
for (const t of tests) {
  try { t.fn(); rows.push({ cls: 'R4201', name: t.name, ok: true }); }
  catch (e) { failed++; rows.push({ cls: 'R4201', name: t.name, ok: false, why: String(e.message || e).slice(0, 900) }); }
}
console.log(JSON.stringify(rows, null, 1));
process.exit(failed ? 1 : 0);
