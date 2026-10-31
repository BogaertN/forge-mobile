/* R4197 (4.9.197): Phase Parsing Engine lexicon.
 * The 4.9.191 seed file and letter map are called. They are not copied.
 * The Codex charge meter is drift_v43.charge_step. C_min stays 0.87. No LLM. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const P = require(ROOT + '/src/ppe_lexicon_197.js');
const Lex = require(ROOT + '/src/resonance_lexicon.js');
const V43 = require(ROOT + '/src/drift_v43.js');
const Codex = require(ROOT + '/src/phase_codex.js');
const Next = require(ROOT + '/src/next_layer.js');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
function py(payload) {
  const r = cp.spawnSync('python3', ['-m', 'rmc_engine_v1.ppe_lexicon_197'], {
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
const NAMES = ['Initiation', 'Polarity', 'Desire', 'Friction', 'Entropy', 'Grace', 'Naming', 'Power', 'Recursion'];

T('every seed has an angle, ε, μ, and a proposal v1 tag', () => {
  const row = P.seeds();
  expect(row.count === 425 && row.tagged === 425 && row.missing === 0, JSON.stringify({ count: row.count, tagged: row.tagged, missing: row.missing }));
  expect(row.provenance === 'proposal v1' && row.eps0 === 0 && row.mu_init === 1 && row.angle === 'θ=(Φ−1)·40°', row.provenance);
  expect(row.seed_file_proposal_v1 === 0 && Lex.proposalV1Count() === 0, 'seed file stays untagged');
  const file = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'reference', 'word_loop_seed_lexicon_v1.jsonl'), 'utf8');
  expect(file.indexOf('proposal v1') < 0, 'jsonl tag');
  row.rows.forEach(seed => {
    expect(NAMES.indexOf(seed.phase_name) >= 0, seed.word + ' ' + seed.phase_name);
    expect(seed.glyph && seed.provenance === 'proposal v1' && seed.eps0 === 0 && seed.mu_init === 1, seed.word);
    expect(seed.angle_degrees === (seed.Phi - 1) * 40 && seed.angle === 'θ=(Φ−1)·40°', seed.word + ' angle');
    expect(typeof seed.eps === 'number' && seed.eps >= 0 && seed.eps <= 1, seed.word + ' eps');
    expect(typeof seed.mu === 'number' && seed.mu >= 0 && seed.mu <= 1, seed.word + ' mu');
    expect(seed.admit_gate === false, seed.word + ' admit');
  });
  expect(row.admit_gate === false && row.calls_llm === false && row.keyword_admit === false && row.christping_started === false, 'laws');
  expect(row.c_min === 0.87 && row.echo_min === 0.85 && row.money === false && row.dream_idle === false && row.economy === false && row.packs_gated === true && row.wikipedia_anchor === false, 'switches');
  const summary = py({ op: 'summary' });
  expect(summary.count === 425 && summary.missing === 0 && summary.checked === 425 && summary.seed_file_proposal_v1 === 0, JSON.stringify(summary));
  same(P.run({ op: 'summary' }), summary, 'summary');
});

T('the KPI table wins the M charge and HarperScript stays historical', () => {
  const diff = P.harperDiff();
  expect(diff.map_authority === 'Phase Parsing Engine' && diff.not_map_authority === 'HarperScript', JSON.stringify(diff.map_authority));
  expect(diff.historical_loaded === true && diff.historical_places === false, 'historical');
  expect(diff.m.used === -2 && diff.m.example_charge === -1 && diff.m.flag === 'KPI-M-CHARGE' && diff.m_table_used === true, JSON.stringify(diff.m));
  expect(diff.phase_conflict_count === 11 && diff.phase_conflicts.join('') === 'KMOPQRSTUVX', diff.phase_conflicts.join(','));
  const em = diff.rows.find(r => r.letter === 'M');
  expect(em.ppe_phase === 'Φ5' && em.ppe_charge === -2 && em.harper_phase === 'Φ5→Φ8' && em.phase_match === false && em.used === 'Phase Parsing Engine', JSON.stringify(em));
  const ay = diff.rows.find(r => r.letter === 'A');
  expect(ay.phase_match === true && ay.ppe_phase === 'Φ1', JSON.stringify(ay));
  same(diff, py({ op: 'harper' }), 'harper');
  const shown = P.monitorLines('harper');
  expect(shown.attrs.status === 'KPI-M-CHARGE' && /M charge used is -2/.test(shown.lines[1]) && /KMOPQRSTUVX/.test(shown.lines[2].replace(/, /g, '')), shown.lines.join(' | '));
  same(shown, py({ op: 'monitor', mode: 'harper' }), 'monitor-harper');
});

T('remember is a Drift Carrier and the worked charge example stays flagged', () => {
  const sample = P.examples();
  expect(sample.remember_role === 'Drift Carrier' && sample.remember_example_role_used === false, sample.remember_role);
  expect(sample.remember_eps === 0.875 && sample.remember_charge_sum === -6 && sample.remember_phi === 5, JSON.stringify(sample));
  expect(sample.remember_phase_name === 'Entropy' && sample.remember_angle_degrees === 160 && sample.remember_provenance === 'proposal v1', sample.remember_phase_name);
  expect(sample.remember_eps0 === 0 && sample.remember_mu_init === 1 && sample.remember_overload === true && sample.remember_christping_started === false && sample.remember_forbidden === false, 'birth');
  expect(sample.transform_role === 'unassigned' && sample.transform_example_role_used === false && sample.transform_charge_sum === 2 && sample.transform_documented_charge === 3 && sample.transform_charge_flag === 'KPI-M-CHARGE', JSON.stringify(sample.transform_charge_sum));
  expect(sample.stability.used === false && sample.stability.documented === 3.2 && sample.stability.formula === 'unspecified', 'stability');
  expect(sample.pcm.used === false && sample.pcm.documented_sum === 8, 'pcm');
  expect(sample.sky_phi === 4 && sample.leaves_phi === 5 && sample.ocean_phi === 1 && sample.create_phi === 1, 'placement');
  expect(sample.try_drift_list === true && sample.try_admit_gate === false && sample.ep_forbidden === true && sample.admit_gate === false && sample.calls_llm === false, 'flags');
  const ep = P.word('ep');
  expect(ep.forbidden_5_to_8 === true && ep.admit_gate === false && ep.christping_started === false && ep.keyword_admit === false, JSON.stringify({ flag: ep.forbidden_5_to_8, admit: ep.admit_gate }));
  const sentence = P.word('remember', 'sentence');
  expect(sentence.signatures[2].name === 'Identity Suppression' && sentence.signatures[2].hit === true && sentence.signatures[2].christping_started === false, JSON.stringify(sentence.signatures[2]));
  expect(P.word('remember').signatures[2].hit === false, 'a single word is not over time');
  same(sample, py({ op: 'examples' }), 'examples');
  same(P.word('remember'), py({ op: 'word', word: 'remember' }), 'remember');
  same(P.word('sky'), py({ op: 'word', word: 'sky' }), 'sky');
  same(P.monitorLines('seeds'), py({ op: 'monitor', mode: 'seeds' }), 'monitor-seeds');
  same(P.monitorLines('drift'), py({ op: 'monitor', mode: 'drift' }), 'monitor-drift');
  const hard = V43.run({ payload: V43.nest(7), prev_phase: 5, recursion_n: 1, phase_hist: [0] });
  expect(hard.d_score === 1 || hard.categorical_hard_fire === true, JSON.stringify({ d: hard.d_score, fire: hard.categorical_hard_fire }));
});

T('the glyph lookup and the charge meter call the existing modules', () => {
  const glyph = P.glyphFor(4);
  const profile = Codex.profile('Φ4');
  expect(glyph.glyph === profile.glyph && glyph.phase_name === 'Friction' && glyph.copied_dictionary === false && glyph.source === 'phase_codex_v2_5', JSON.stringify(glyph));
  expect(glyph.admit_gate === false && glyph.calls_llm === false, 'glyph laws');
  same(glyph, py({ op: 'glyph', phi: 4 }), 'glyph');
  const js = fs.readFileSync(path.join(ROOT, 'src', 'ppe_lexicon_197.js'), 'utf8');
  const pySrc = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'ppe_lexicon_197.py'), 'utf8');
  expect(js.indexOf('Lex.placeWord') >= 0 && js.indexOf('Lex.letterRows') >= 0 && js.indexOf('V43.chargeStep') >= 0 && js.indexOf('KM.phaseAngleDegrees') >= 0 && js.indexOf('KM.std') >= 0, 'js reuse');
  expect(pySrc.indexOf('place_word') >= 0 && pySrc.indexOf('letter_rows') >= 0 && pySrc.indexOf('charge_step') >= 0 && pySrc.indexOf('angle_degrees') >= 0, 'py reuse');
  expect(js.indexOf('delta = 0.1') < 0 && pySrc.indexOf('delta = 0.1') < 0, 'meter is not copied');
  expect(!/import re\b/.test(pySrc) && js.indexOf('RegExp') < 0 && js.indexOf('new RegExp') < 0, 'no parsing');
  expect(!/openai|ollama|anthropic|fetch\(/.test(js) && !/openai|ollama|anthropic/.test(pySrc), 'no model');
  expect(!fs.existsSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'reference', 'glyph_dictionary.json')), 'no copied glyph dictionary');
  Next.set('dream_idle', true);
  Next.set('economy', true);
  const staged = P.stage('why is the sky blue');
  expect(staged.dream_idle === false && staged.economy === false && staged.admit_gate === false && staged.keyword_admit === false && staged.provenance === 'proposal v1', JSON.stringify(staged));
  expect(staged.words.some(w => w.word === 'sky' && w.Phi === 4 && w.phase_name === 'Friction'), JSON.stringify(staged.words));
  Next.set('dream_idle', false);
  Next.set('economy', false);
  same(staged, py({ op: 'stage', question: 'why is the sky blue' }), 'stage');
});

T('the Ask card shows word packets and the trace does not admit', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
  expect(/data-ppe197/.test(html) && /src="src\/ppe_lexicon_197.js"/.test(html) && /Word packets/.test(html), 'card');
  expect(sw.indexOf('./src/ppe_lexicon_197.js') >= 0 && sw.indexOf('harper_visual_manifest_v1.json') >= 0, 'worker');
  expect(/data-ppe-197/.test(app), 'ask trace');
  const eng = cp.spawnSync('python3', ['-c', 'import json; from rmc_engine_v1.language_core_engines import run_engines; print(json.dumps(run_engines(0.2, 4, None, None, None, "why is the sky blue")["ppe_197"]))'], {
    cwd: path.join(ROOT, 'engine'),
    env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }),
    encoding: 'utf8',
  });
  if (eng.status) throw new Error(String(eng.stderr || eng.stdout).slice(0, 500));
  const traced = JSON.parse(eng.stdout);
  expect(traced.provenance === 'proposal v1' && traced.m_charge === -2 && traced.m_flag === 'KPI-M-CHARGE' && traced.admit_gate === false && traced.calls_llm === false && traced.seeds === 425, JSON.stringify(traced));
  expect(traced.words.some(w => w.word === 'sky' && w.Phi === 4), JSON.stringify(traced.words));
});

T('cold admits stay 48 of 60 and the release is 4.9.197', () => {
  const live = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_197_results.json'), 'utf8'));
  const prior = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_196_results.json'), 'utf8'));
  expect(live.stable === true && live.calls_llm === false, JSON.stringify({ stable: live.stable, llm: live.calls_llm }));
  for (const p of live.passes) {
    expect(p.admitted === 48 && p.held === 12, p.name + ' ' + p.admitted);
    expect(p.rows.every(r => r.ppe_admit_gate === false && r.ppe_calls_llm === false && r.ppe_dream_idle === false && r.ppe_keyword_admit === false && r.ppe_provenance === 'proposal v1' && r.ppe_m_charge === -2 && r.ppe_seeds === 425 && r.ppe_words > 0), p.name + ' lexicon');
  }
  const now = new Set(live.passes[0].rows.filter(r => r.admitted).map(r => r.question));
  const then = new Set(prior.passes[0].rows.filter(r => r.admitted).map(r => r.question));
  const gained = [...now].filter(q => !then.has(q));
  const lost = [...then].filter(q => !now.has(q));
  expect(now.size === 48 && gained.length === 0 && lost.length === 0, JSON.stringify({ gained, lost }));
  const pyodide = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_197_pyodide.json'), 'utf8'));
  expect(pyodide.pyodide === '0.27.7' && pyodide.matched === pyodide.cases && pyodide.max_abs_gap === 0 && pyodide.calls_llm === false, JSON.stringify(pyodide));
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.204', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.197/.test(conf) && /C_min stays 0\.87/.test(conf) && /KPI-M-CHARGE/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.197/.test(nb) && /WIRING_197/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.197/.test(readme) && /WIRING_197/.test(readme), 'README');
  const doc = fs.readFileSync(path.join(ROOT, '..', 'docs', 'WIRING_197.md'), 'utf8');
  expect(/0\.87/.test(doc) && /No model is called/.test(doc) && /proposal v1/.test(doc) && /KPI-M-CHARGE/.test(doc), 'WIRING');
  const table = fs.readFileSync(path.join(ROOT, '..', 'docs', 'LIVE_TEST_197.md'), 'utf8');
  expect(/48 of 60/.test(table) && /No model is called/.test(table), 'LIVE_TEST');
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.204' && reg.features.some(f => f.id === 'R4197-PPE-LEXICON') && reg.count === reg.features.length && reg.claims.Implemented === 112 && reg.claims.Partial === 198, reg.version + ' ' + reg.count + ' ' + reg.claims.Partial);
  const formula = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'measurement_kernel.py'), 'utf8');
  expect(/0\.24\*memory_fit \+ 0\.20\*phase_validity/.test(formula), 'formula');
});

const rows = [];
let failed = 0;
for (const t of tests) {
  try { t.fn(); rows.push({ cls: 'R4197', name: t.name, ok: true }); }
  catch (e) { failed++; rows.push({ cls: 'R4197', name: t.name, ok: false, why: String(e.message || e).slice(0, 900) }); }
}
console.log(JSON.stringify(rows, null, 1));
process.exit(failed ? 1 : 0);
