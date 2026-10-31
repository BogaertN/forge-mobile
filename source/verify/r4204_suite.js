/* R4204 (4.9.204): resonance tuning of frequency offsets.
 * Spelling stays the start. Laws stay put. No LLM. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const F = require(ROOT + '/src/frequency_204.js');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };

function py(payload) {
  const r = cp.spawnSync('python3', ['-m', 'rmc_engine_v1.frequency_204'], {
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
    const keys = Array.from(new Set(Object.keys(a).concat(Object.keys(b))));
    for (const k of keys) {
      if (a[k] === undefined || b[k] === undefined) throw new Error((pathName || '') + '.' + k + ' missing');
      same(a[k], b[k], (pathName || '') + '.' + k);
    }
    return;
  }
  if (a !== b) throw new Error((pathName || '') + ' ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b));
}

const LAWFUL = { C: 0.9, echo: 1, drift: 0.05, phase: 6, trust: 'local', calls_llm: false };

T('flags match Python and the laws are the 4.9.203 laws', () => {
  same(F.flags(), py({ op: 'flags' }), 'flags');
  const flags = F.flags();
  expect(flags.c_min === 0.87 && flags.echo_min === 0.85 && flags.write_max === 0.35 && flags.hard_stop === 0.8, 'laws');
  expect(flags.calls_llm === false && flags.money === false && flags.dream_idle === false && flags.economy === false, 'switches');
  expect(flags.packs_gated === true && flags.christping === 'gilligan-only' && flags.wikipedia_anchor === false && flags.fhrr === false && flags.rsoc === true, 'gates');
  expect(flags.master_phase_moved === false && flags.resonance_not_parsing === true && flags.coherence_formula_unchanged === true, 'master');
  expect(flags.zeta === 0.12 && flags.beta === 2.2 && flags.sever === 0.08 && flags.half_life_hours === 168, 'rsoc');
  const formula = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'measurement_kernel.py'), 'utf8');
  expect(/0\.24\*memory_fit \+ 0\.20\*phase_validity/.test(formula), 'formula');
});

T('a scripted field matches Python, including retract, decay, phase 6, and 5 to 8', () => {
  const law = (extra) => Object.assign({}, LAWFUL, extra);
  const steps = [
    law({ op: 'admit', id: 's0', words: ['sun', 'light'], t_hours: 0 }),
    law({ op: 'admit', id: 's1', words: ['sun', 'light'], t_hours: 1 }),
    law({ op: 'admit', id: 'hot', words: ['sun', 'hot'], t_hours: 2 }),
    law({ op: 'admit', id: 'bad', words: ['sun', 'light'], t_hours: 3, phase: 7 }),
    { op: 'tick', id: 't', phase: 6, t_hours: 4 },
    { op: 'phi', word: 'heat', phi: 8 },
    law({ op: 'refute', id: 'r', words: ['heat', 'photon'], t_hours: 5 }),
    { op: 'retract', id: 's0' },
    law({ op: 'admit', id: 'wiki', words: ['sun', 'dog'], trust: 'low', source: 'wikipedia' }),
    law({ op: 'admit', id: 'lowc', words: ['sun', 'light'], C: 0.5 }),
    law({ op: 'admit', id: 'qd', words: ['sun', 'light'], drift: 0.5 }),
    law({ op: 'admit', id: 'hard', words: ['sun', 'light'], drift: 0.9 }),
    law({ op: 'admit', id: 'text', text: 'The sun is hot.', t_hours: 6 })
  ];
  const js = F.run({ op: 'script', steps: steps });
  const host = py({ op: 'script', steps: steps });
  same(js, host, 'script');
  expect(js.calls_llm === false && js.steps[3].reason === 'phase-6 membrane' && js.steps[3].applied === false, 'membrane');
  expect(js.steps[5].reason === '5→8' && js.steps[5].phi_after === 5 && js.steps[5].phi_before === 5, 'ban');
  expect(js.steps[8].reason === 'wikipedia' && js.steps[9].reason === 'C' && js.steps[10].reason === 'quarantine' && js.steps[11].reason === 'hard-stop', 'gates');
  const sunLight = js.steps[1].related['sun/light'];
  expect(sunLight.phi[0] === 7 && sunLight.phi[1] === 6 && sunLight.master_hz[0] === 144 && sunLight.master_deg[0] === 240, JSON.stringify(sunLight.phi));
  expect(js.steps[1].master_unchanged === true, 'master moved');
});

T('sun and light move together on shared carriers and sun/dog stays apart', () => {
  const before = py({ op: 'script', steps: [] });
  expect(before.steps.length === 0, 'empty');
  const field = new F.Field(true);
  const base = field.pairView('sun', 'light');
  expect(base.resonate === false && base.cover < 0.5, JSON.stringify(base));
  for (let i = 0; i < 12; i++) field.admit(Object.assign({}, LAWFUL, { id: 'sun-light-' + i, words: ['sun', 'light'], t_hours: i }));
  const after = field.pairView('sun', 'light');
  expect(after.resonate === false, 'sun/light must not be reported as a full resonance');
  expect(after.cover > base.cover, 'cover ' + base.cover + ' -> ' + after.cover);
  const gap0 = Math.abs(base.hz['72'][0] - base.hz['72'][1]);
  const gap1 = Math.abs(after.hz['72'][0] - after.hz['72'][1]);
  expect(gap1 < gap0, '72 Hz gap ' + gap0 + ' -> ' + gap1);
  expect(after.phi[0] === base.phi[0] && after.phi[1] === base.phi[1] && after.master_deg[0] === base.master_deg[0], 'phase moved');
  const hot = new F.Field(true);
  const hot0 = hot.pairView('sun', 'hot');
  for (let i = 0; i < 8; i++) hot.admit(Object.assign({}, LAWFUL, { id: 'h' + i, words: ['sun', 'hot'], t_hours: i }));
  const hot1 = hot.pairView('sun', 'hot');
  expect(hot0.resonate === true && hot1.resonate === true, 'sun/hot');
  const far = new F.Field(true);
  far.admit(Object.assign({}, LAWFUL, { id: 'u', words: ['sun', 'dog', 'light', 'quartz'] }));
  expect(far.pairView('sun', 'dog').resonate === false && far.pairView('light', 'quartz').resonate === false, 'unrelated');
  const undo = new F.Field(true);
  undo.admit(Object.assign({}, LAWFUL, { id: 'only', words: ['sun', 'light'] }));
  undo.retract('only');
  same(undo.pairView('sun', 'light').hz, new F.Field(true).pairView('sun', 'light').hz, 'retract');
  const aged = new F.Field(true);
  aged.admit(Object.assign({}, LAWFUL, { id: 'd', words: ['sun', 'light'], t_hours: 0 }));
  const fresh = Math.abs(aged.pairView('sun', 'light', 0).hz['72'][0] - aged.pairView('sun', 'light', 0).hz['72'][1]);
  const half = Math.abs(aged.pairView('sun', 'light', 168).hz['72'][0] - aged.pairView('sun', 'light', 168).hz['72'][1]);
  expect(half > fresh && half < fresh + (gap0 - fresh) * 0.6, 'decay gap ' + fresh + ' -> ' + half);
});

T('spacing keeps a clique off one frequency and the proof is honest', () => {
  const collapse = py({ op: 'collapse', steps: 24, n: 12 });
  expect(collapse.spacing_holds === true && collapse.calls_llm === false, JSON.stringify({
    holds: collapse.spacing_holds,
    on: collapse.with_spacing.after_stdev,
    off: collapse.without_spacing.after_stdev
  }));
  expect(collapse.with_spacing.after_stdev > collapse.without_spacing.after_stdev, 'stdev');
  expect(collapse.with_spacing.master_unchanged === true && collapse.without_spacing.master_unchanged === true, 'master');
  const proof = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'frequency_204_proof.json'), 'utf8'));
  expect(proof.calls_llm === false && proof.cold.false_admits === 0 && proof.cold.admitted === 48 && proof.cold.held === 12, JSON.stringify(proof.cold));
  expect(proof.lexicon.unrelated_after.rate <= proof.lexicon.unrelated_before.rate + 0.01, JSON.stringify(proof.lexicon));
  expect(proof.watched['sun/hot'].before === true && proof.watched['sun/hot'].after_explicit === true, 'hot');
  expect(proof.watched['sun/light'].before === false && proof.watched['sun/light'].after_explicit === false, 'light strict');
  expect(proof.watched['sun/light'].after_explicit_cover > proof.watched['sun/light'].before_cover, 'light cover');
  expect(proof.watched['sun/dog'].before === false && proof.watched['sun/dog'].after_cold === false, 'dog');
  expect(proof.watched['light/quartz'].before === false && proof.watched['light/quartz'].after_cold === false, 'quartz');
  proof.synthetic.forEach(row => {
    expect(row.n >= 1000 && row.before_rate >= 0 && row.after_rate >= 0 && row.unrelated_rate <= row.before_rate + 0.02, JSON.stringify(row));
  });
  const live = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_204_results.json'), 'utf8'));
  expect(live.admitted === 48 && live.false_admits === 0 && live.calls_llm === false && live.rows.length === 60, 'cold');
  const spoken = live.rows.filter(row => row.admitted).map(row => row.reply);
  expect(spoken.length === 48 && spoken.every(line => typeof line === 'string' && line.length > 0), 'spoken');
  expect(spoken.some(line => line.indexOf('feeling') >= 0) && spoken.some(line => line.indexOf('does not call a model') >= 0), 'capability');
  const pyodide = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_204_pyodide.json'), 'utf8'));
  expect(pyodide.matched === pyodide.cases && pyodide.max_abs_gap === 0 && pyodide.calls_llm === false && pyodide.lexicon_scan_ms > 0, JSON.stringify(pyodide));
});

T('the card, the migration, and the suite run are in place', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  expect(/data-freq204/.test(html) && /src="src\/frequency_204.js"/.test(html) && /144 Hz glyph master/.test(html), 'card');
  expect(/data-freq203/.test(html), '203 card stays');
  const sql = fs.readFileSync(path.join(ROOT, '..', 'supabase', 'migrations', '20261031090000_frequency_tuning_204.sql'), 'utf8');
  expect(/FLAG: not applied/.test(sql) && /applied: false/.test(sql) && !/insert into/i.test(sql), 'migration');
  const ci = fs.readFileSync(path.join(ROOT, '..', '.github', 'workflows', 'test.yml'), 'utf8');
  expect((ci.match(/r4204_suite\.js/g) || []).length >= 3, 'suite x3');
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.204', ver);
  const cfg = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'frequency_204_config.py'), 'utf8');
  expect(/awaiting Nic/.test(cfg) && /ZETA = 0.12/.test(cfg) && /BETA = 2.2/.test(cfg) && /Not FHRR/.test(cfg), 'config');
});

const rows = [];
let failed = 0;
for (const t of tests) {
  try { t.fn(); rows.push({ cls: 'R4204', name: t.name, ok: true }); }
  catch (e) { failed++; rows.push({ cls: 'R4204', name: t.name, ok: false, why: String(e.message || e).slice(0, 900) }); }
}
console.log(JSON.stringify(rows, null, 1));
process.exit(failed ? 1 : 0);
