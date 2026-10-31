/* R4203 (4.9.203): phase + frequency signatures.
 * The letter formula is proposal v1. Laws stay put. No LLM. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const F = require(ROOT + '/src/frequency_203.js');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
function py(payload) {
  const r = cp.spawnSync('python3', ['-m', 'rmc_engine_v1.frequency_203'], {
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
function state(word, eps, mu) {
  const sig = F.wordSignature(word);
  return { word: word, Phi: sig.Phi, eps: eps, mu: mu, chi: 0, components: sig.components };
}

T('signatures match Python and the 144 Hz slot keeps the master phase', () => {
  for (const word of ['sun', 'hot', 'light', 'warm', 'sunny', 'dog', 'quartz', 'grace', 'hnv', 'begin']) {
    same(F.run({ op: 'signature', word: word }), py({ op: 'signature', word: word }), word);
  }
  const sun = F.wordSignature('sun');
  const master = sun.components.find(row => row.master);
  expect(master && master.hz === 144 && master.band === 144 && master.phase_deg === sun.master_degrees, JSON.stringify(master));
  expect(sun.master_degrees === (sun.Phi - 1) * 40, String(sun.master_degrees));
  expect(sun.components.every(row => row.nearest === row.band), 'nearest marker');
  expect(sun.components.some(row => Math.abs(row.hz - Math.round(row.hz)) > 0), 'a decimal frequency');
  expect(sun.k <= 9 && sun.k >= 2 && sun.proposal === 'proposal v1' && sun.awaiting === 'Nic', sun.proposal);
  expect(sun.source === 'concept' && sun.concept === 'N.WEATHER' && sun.calls_llm === false, sun.source);
  const flags = F.flags();
  expect(flags.c_min === 0.87 && flags.echo_min === 0.85 && flags.write_max === 0.35 && flags.hard_stop === 0.8, 'laws');
  expect(flags.frequency_epsilon === 0.02 && flags.phase_agree_min === 0.87 && flags.fhrr === false && flags.rsoc === true, 'epsilon');
  expect(flags.resonance_not_parsing === true && flags.coherence_formula_unchanged === true && flags.money === false && flags.dream_idle === false && flags.economy === false && flags.packs_gated === true && flags.wikipedia_anchor === false && flags.christping === 'gilligan-only', 'switches');
});

T('related weather words resonate and unrelated words do not', () => {
  const pairs = [['sun', 'hot'], ['sun', 'warm'], ['hot', 'sunny'], ['sun', 'light'], ['hot', 'light'], ['sun', 'dog'], ['light', 'quartz']];
  for (const [a, b] of pairs) {
    const js = F.run({ op: 'resonate', a: a, b: b });
    const host = py({ op: 'resonate', a: a, b: b });
    same(js.verdict, host.verdict, a + '/' + b);
  }
  expect(F.resonate(F.wordSignature('sun'), F.wordSignature('hot')).resonate === true, 'sun hot');
  expect(F.resonate(F.wordSignature('sun'), F.wordSignature('warm')).resonate === true, 'sun warm');
  expect(F.resonate(F.wordSignature('hot'), F.wordSignature('sunny')).resonate === true, 'hot sunny');
  expect(F.resonate(F.wordSignature('sun'), F.wordSignature('light')).resonate === false, 'sun light');
  expect(F.resonate(F.wordSignature('sun'), F.wordSignature('dog')).resonate === false, 'sun dog');
  expect(F.resonate(F.wordSignature('light'), F.wordSignature('quartz')).resonate === false, 'light quartz');
});

T('RSOC operators match Python, phase 6 gates rewrites, and +120 is refused', () => {
  const grace = state('grace', 0.1, 1);
  const correct = state('correct', 0.2, 1);
  const sun = state('sun', 0.2, 1);
  const carrier = grace.components.find(row => !row.master);
  const payloads = [
    { op: 'merge', a: grace, b: correct },
    { op: 'merge', a: state('sun', 0, 1), b: state('hot', 0, 1) },
    { op: 'fracture', state: grace },
    { op: 'amplify', state: sun, k: 1.5, drift: 0.1 },
    { op: 'discharge', state: sun },
    { op: 'ban', state: grace, band: carrier.band, phase_deg: carrier.phase_deg + 120 },
    { op: 'lock', a: grace, b: Object.assign({}, grace, { mu: 0.5 }) },
    { op: 'migrate-packet', packet: { word: 'hnv', Phi: 7, eps: 0, mu: 1 } },
    { op: 'config' }
  ];
  for (const payload of payloads) same(F.run(payload), py(payload), payload.op);
  const merged = F.mergeOp(grace, correct);
  expect(merged.ok === true && merged.fhrr === false && merged.state.mu > 2, JSON.stringify({ ok: merged.ok, mu: merged.state && merged.state.mu }));
  const blocked = F.mergeOp(state('sun', 0, 1), state('hot', 0, 1));
  expect(blocked.ok === false && blocked.reason === 'phase-6 membrane', blocked.reason);
  const split = F.fractureOp(grace);
  expect(split.ok === true && Math.abs(split.mu_sum - (1 - 0.08)) < 1e-6, String(split.mu_sum));
  const amp = F.amplifyOp(sun, 1.5, 0.1);
  const expectMu = 1.5 * 1 * Math.exp(-2.2 * 0.1);
  expect(amp.ok === true && Math.abs(amp.state.mu - Math.round(expectMu * 1e6) / 1e6) < 1e-6, String(amp.state.mu));
  const discharged = F.dischargeOp(sun);
  expect(discharged.ok === true && discharged.state.mu === 0 && discharged.state.eps === 0.06, JSON.stringify(discharged.state));
  const banned = F.banOp(grace, carrier.band, carrier.phase_deg + 120);
  expect(banned.ok === false && banned.reason === '5→8' && banned.applied === false, banned.reason);
  const cfg = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'frequency_203_config.py'), 'utf8');
  expect(/awaiting Nic/.test(cfg) && /EPSILON = 0.02/.test(cfg) && /proposal v1/.test(cfg) && /Not FHRR/.test(cfg), 'config');
});

T('the migration is flagged, the proof is honest, and the capability sentence is not the feeling sentence', () => {
  const sql = fs.readFileSync(path.join(ROOT, '..', 'supabase', 'migrations', '20261030235900_frequency_signatures_203.sql'), 'utf8');
  expect(/FLAG: not applied/.test(sql) && /applied: false/.test(sql) && !/insert into/i.test(sql), 'migration');
  const proof = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'frequency_203_proof.json'), 'utf8'));
  expect(proof.epsilon === 0.02 && proof.calls_llm === false && proof.lexicon.after < proof.lexicon.before, JSON.stringify(proof.lexicon));
  expect(proof.lexicon.neighbor_after < proof.lexicon.neighbor_pairs, 'neighbors');
  proof.synthetic.forEach(row => expect(row.after_rate < row.before_rate && row.n >= 1000, JSON.stringify(row)));
  const by = {};
  proof.related.pairs.forEach(row => { by[row.a + '/' + row.b] = row; });
  expect(by['sun/hot'].resonate === true && by['sun/warm'].resonate === true && by['sun/light'].resonate === false && by['sun/dog'].resonate === false, 'related');
  const chat = pyChat();
  expect(chat.how === 'Forge does not store a feeling. World Model owns world state and inference.', chat.how);
  expect(chat.can === 'Forge answers from admitted facts and does not call a model.', chat.can);
  expect(chat.how !== chat.can, 'distinct sentences');
  const ci = fs.readFileSync(path.join(ROOT, '..', '.github', 'workflows', 'test.yml'), 'utf8');
  expect((ci.match(/r4203_suite\.js/g) || []).length >= 3, 'suite x3');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  expect(/data-freq203/.test(html) && /src="src\/frequency_203.js"/.test(html) && /144 Hz/.test(html), 'card');
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.204', ver);
  const pyodide = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_203_pyodide.json'), 'utf8'));
  expect(pyodide.matched === pyodide.cases && pyodide.max_abs_gap === 0 && pyodide.calls_llm === false && pyodide.lexicon_scan_ms > 0, JSON.stringify(pyodide));
});

function pyChat() {
  const r = cp.spawnSync('python3', ['-c', [
    'from rmc_engine_v1.world_model_v1 import _chat_derived',
    'import json',
    'print(json.dumps({"how": _chat_derived("How are you?"), "can": _chat_derived("What can you do?")}))'
  ].join('\n')], {
    cwd: path.join(ROOT, 'engine'),
    env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }),
    encoding: 'utf8'
  });
  if (r.status) throw new Error(String(r.stderr || r.stdout).slice(0, 500));
  return JSON.parse(r.stdout);
}

const rows = [];
let failed = 0;
for (const t of tests) {
  try { t.fn(); rows.push({ cls: 'R4203', name: t.name, ok: true }); }
  catch (e) { failed++; rows.push({ cls: 'R4203', name: t.name, ok: false, why: String(e.message || e).slice(0, 900) }); }
}
console.log(JSON.stringify(rows, null, 1));
process.exit(failed ? 1 : 0);
