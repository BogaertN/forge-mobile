/* R4198 (4.9.198): Lexicon Growth Engine.
 * Novel words take a 4.9.197 packet. Birth ε=0, μ=1.0, proposal v1.
 * Promotion, quarantine, denial, recall, and local restart are checked here.
 * C_min stays 0.87. No LLM. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const G = require(ROOT + '/src/lexicon_growth_198.js');
const SHA = require(ROOT + '/src/sha256.js');
const Next = require(ROOT + '/src/next_layer.js');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
function py(payload) {
  const r = cp.spawnSync('python3', ['-m', 'rmc_engine_v1.lexicon_growth_198'], {
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
function obs(text, question, timestamp, C, echo, drift, collapsed) {
  return { op: 'observe', text: text, question: question, contributor: 'nic', timestamp: timestamp, C: C, echo: echo, drift: drift, collapsed: collapsed || [] };
}
const STEPS = JSON.parse(JSON.stringify([
  obs('create hnv', 'what is hnv', '2026-10-30T18:00:00Z', 0.9, 0.9, 0.19),
  obs('hnv.', 'what is hnv', '2026-10-30T18:00:01Z', 0.9, 0.9, 0.19),
  obs('create hnv', 'what is hnv', '2026-10-30T18:00:00Z', 0.1, 0.1, 0.9),
  obs('kk', 'what is kk', '2026-10-30T18:00:02Z', 0.91, 0.91, 0.1),
  obs('kk.', 'what is kk', '2026-10-30T18:00:03Z', 0.91, 0.91, 0.1),
  obs('nh', 'what is nh', '2026-10-30T18:00:04Z', 0.92, 0.92, 0.2),
  obs('nh.', 'what is nh', '2026-10-30T18:00:05Z', 0.92, 0.92, 0.2),
  obs('ep', 'what is ep', '2026-10-30T18:00:06Z', 0.95, 0.95, 0.1),
  obs('ep.', 'what is ep', '2026-10-30T18:00:07Z', 0.95, 0.95, 0.1),
  obs('zz', 'what is zz', '2026-10-30T18:00:08Z', 0.95, 0.95, 0.36),
  obs('qq', 'what is qq', '2026-10-30T18:00:09Z', 0.95, 0.95, 0.1, ['qq']),
  obs('qq.', 'what is qq', '2026-10-30T18:00:10Z', 0.95, 0.95, 0.1, ['qq']),
  obs('vvh', 'what is vvh', '2026-10-30T18:00:11Z', 0.86, 0.95, 0.1),
  obs('vvh.', 'what is vvh', '2026-10-30T18:00:12Z', 0.86, 0.95, 0.1),
  obs('vhn', 'what is vhn', '2026-10-30T18:00:13Z', 0.95, 0.84, 0.1),
  obs('vhn.', 'what is vhn', '2026-10-30T18:00:14Z', 0.95, 0.84, 0.1),
  obs('hn', 'what is hn', '2026-10-30T18:00:15Z', 0.95, 0.95, 0.1),
  obs('hn.', 'where is hn', '2026-10-30T18:00:16Z', 0.95, 0.95, 0.1),
  obs('nvh', 'what is nvh', '2026-10-30T18:00:17Z', 0.95, 0.95, 0.3),
  obs('nvh.', 'what is nvh', '2026-10-30T18:00:18Z', 0.95, 0.95, 0.3),
  obs('vh', 'what is vh', '2026-10-30T18:00:19Z', 0.95, 0.95, 0.1),
  obs('hh', 'what is hh', '2026-10-30T18:00:20Z', 0.95, 0.95, 0.1, ['abcdefghijklmnopqrstuvwxyz']),
  obs('hh.', 'what is hh', '2026-10-30T18:00:21Z', 0.95, 0.95, 0.1, ['abcdefghijklmnopqrstuvwxyz']),
  obs('zj', 'what is zj', '2026-10-30T18:00:22Z', 0.95, 0.95, 0.81),
  { op: 'recall', text: 'h' },
  { op: 'recall', phi: 9 },
  { op: 'recall', phi: 4 },
  { op: 'place', word: 'hnv' },
  { op: 'place', word: 'create' },
  { op: 'place', word: 'ep' },
  { op: 'place', word: 'zz' },
  { op: 'restart' },
  obs('create hnv', 'what is hnv', '2026-10-30T18:00:00Z', 0.1, 0.1, 0.9)
]));

T('a novel word gets a birth packet and a known seed stays in the lexicon', () => {
  const ran = G.run({ op: 'script', steps: STEPS.slice(0, 1) });
  const host = py({ op: 'script', steps: STEPS.slice(0, 1) });
  same(ran, host, 'birth');
  const word = ran.words.find(row => row.word === 'hnv');
  const known = ran.log[0].known.find(row => row.word === 'create');
  expect(word && known, 'rows');
  expect(word.tier === 'provisional' && word.promoted === false && word.uses === 1, word.tier);
  expect(word.Phi === 7 && word.phase_name === 'Naming' && word.glyph && word.angle_degrees === 240, JSON.stringify({ phi: word.Phi, name: word.phase_name, angle: word.angle_degrees }));
  expect(word.eps === 0 && word.mu === 1 && word.provenance === 'proposal v1' && word.packet.eps0 === 0 && word.packet.mu_init === 1, JSON.stringify(word.packet));
  expect(word.packet.angle === 'θ=(Φ−1)·40°' && word.forbidden_5_to_8 === false, word.packet.angle);
  expect(word.contributor === 'nic' && word.timestamp === '2026-10-30T18:00:00Z' && word.input_id === SHA.sha256('create hnv') && word.content_id === SHA.sha256('growth\nhnv'), 'provenance');
  expect(known.source === 'seed' && known.usable === true && known.tier === 'lexicon', JSON.stringify(known));
  expect(ran.words.every(row => row.word !== 'create'), 'seed was not copied into the growth tier');
  expect(ran.admit_gate === false && ran.keyword_admit === false && ran.calls_llm === false && ran.christping_started === false, 'laws');
  expect(ran.c_min === 0.87 && ran.echo_min === 0.85 && ran.write_max === 0.35 && ran.hard_stop === 0.8, JSON.stringify({ c: ran.c_min, echo: ran.echo_min, write: ran.write_max, hard: ran.hard_stop }));
  expect(ran.memory_drift_max === 0.3 && ran.naming_drift_max === 0.2 && ran.naming_phi_min === 7 && ran.uses_min === 2 && ran.mask_threshold === 0.7, 'gates');
  expect(ran.operators_applied === false && ran.geometry_build === '4.9.199' && ran.resonance_not_parsing === true && ran.money === false && ran.dream_idle === false && ran.economy === false && ran.packs_gated === true && ran.wikipedia_anchor === false, 'switches');
});

T('promotion, quarantine, denial, and the naming seal follow the gates', () => {
  const ran = G.run({ op: 'script', steps: STEPS });
  same(ran, py({ op: 'script', steps: STEPS }), 'paths');
  const by = {};
  ran.words.forEach(row => { by[row.word] = row; });
  expect(by.hnv.tier === 'promoted' && by.hnv.sealed === true && by.hnv.uses === 2 && by.hnv.naming_phi === true && by.hnv.naming_echo === true && by.hnv.naming_drift === true, JSON.stringify({ tier: by.hnv.tier, sealed: by.hnv.sealed, uses: by.hnv.uses }));
  expect(by.hnv.seal_rule === 'DPA-APPENDED' && /^[0-9a-f]{64}$/.test(by.hnv.seal_sha256) && by.hnv.chain_ok === true && by.hnv.archive_kind === 'sealed_loop', by.hnv.seal_rule);
  expect(by.kk.tier === 'promoted' && by.kk.sealed === false && by.kk.Phi === 4 && by.kk.usable === true, 'Φ4 promotes and does not seal');
  expect(by.nh.tier === 'promoted' && by.nh.sealed === false && by.nh.drift_max === 0.2 && by.nh.naming_drift === false, 'drift 0.2 does not seal');
  expect(by.ep.forbidden_5_to_8 === true && by.ep.tier === 'provisional' && by.ep.promoted === false && by.ep.uses === 2, '5→8 never promotes');
  expect(by.zz.tier === 'quarantine' && by.zz.chi === true && by.zz.promoted === false && by.zz.archive_kind === 'dead_path' && by.zz.archive_rule === 'DPA-APPENDED' && by.zz.chain_ok === true, JSON.stringify({ tier: by.zz.tier, chi: by.zz.chi, rule: by.zz.archive_rule }));
  expect(by.qq.tier === 'denied' && by.qq.mask_hit === true && by.qq.promoted === false, 'mask deny');
  expect(by.vvh.tier === 'provisional' && by.vvh.c_min === 0.86, 'C below 0.87');
  expect(by.vhn.tier === 'provisional' && by.vhn.echo_min === 0.84, 'Echo below 0.85');
  expect(by.hn.tier === 'provisional' && by.hn.questions_match === false, 'echo must be against the original question');
  expect(by.nvh.tier === 'provisional' && by.nvh.quarantined === false && by.nvh.drift_max === 0.3, 'drift 0.3 stays provisional');
  expect(by.vh.tier === 'provisional' && by.vh.uses === 1, 'one use is not across uses');
  expect(by.hh.tier === 'promoted' && by.hh.sealed === true && by.hh.mask_hit === false, 'a distant signature does not deny');
  expect(by.zj.tier === 'quarantine' && by.zj.hard_stop === true && by.zj.chi === true && by.zj.promoted === false, 'hard stop');
  const recalls = ran.log.filter(row => row.op === 'recall');
  expect(recalls[0].probe_word === 'h' && recalls[0].phi === 7 && recalls[0].method === 'phase_align' && recalls[0].keyword_rank === false && recalls[0].window === 'π/4', JSON.stringify(recalls[0].hits));
  expect(recalls[0].hits.some(hit => hit.word === 'hnv' && hit.usable === true && hit.eps === 0 && hit.mu === 1) && recalls[0].hits.every(hit => hit.word !== 'ep' && hit.word !== 'zz' && hit.word !== 'qq' && hit.word !== 'vh'), recalls[0].hits.map(hit => hit.word).join(','));
  expect(recalls[1].phi === 9 && recalls[1].hits.some(hit => hit.word === 'zj') === false && recalls[1].hits.every(hit => hit.word !== 'hnv'), 'Φ9 does not recall the sealed Φ7 word or the quarantine');
  expect(recalls[2].hits.map(hit => hit.word).join(',') === 'kk', recalls[2].hits.map(hit => hit.word).join(','));
  const places = ran.log.filter(row => row.op === 'place');
  expect(places[0].source === 'growth' && places[0].usable === true && places[0].sealed === true && places[0].eps === 0 && places[0].mu === 1, 'placement uses the promoted packet');
  expect(places[1].source === 'seed' && places[1].usable === true, 'seed placement');
  expect(places[2].usable === false && places[2].forbidden_5_to_8 === true, 'flagged word is not usable');
  expect(places[3].usable === false && places[3].tier === 'quarantine', 'quarantine is not usable');
  const replay = ran.log[ran.log.length - 1];
  expect(replay.idempotent === true && replay.words[0].word === 'hnv' && replay.words[0].uses === 2 && replay.words[0].sealed === true, 'restart replay');
  expect(ran.log.some(row => row.op === 'restart' && row.chain_ok === true && row.words.indexOf('hnv') >= 0), 'restart kept the chain');
  const laterSteps = [
    obs('hnv', 'what is hnv', '2026-10-30T18:05:00Z', 0.9, 0.9, 0.19),
    obs('hnv.', 'what is hnv', '2026-10-30T18:05:01Z', 0.9, 0.9, 0.19),
    obs('hnv!', 'what is hnv', '2026-10-30T18:05:02Z', 0.9, 0.9, 0.9)
  ];
  const later = G.run({ op: 'script', steps: laterSteps });
  same(later, py({ op: 'script', steps: laterSteps }), 'later-drift');
  const dropped = later.words[0];
  expect(dropped.tier === 'quarantine' && dropped.sealed === true && dropped.usable === false && dropped.chi === true && /^[0-9a-f]{64}$/.test(dropped.seal_sha256), JSON.stringify({ tier: dropped.tier, sealed: dropped.sealed, usable: dropped.usable }));
});

T('the same input is idempotent and the tier reloads from local storage', () => {
  const store = G.empty();
  const first = G.observe(store, STEPS[0]);
  const again = G.observe(store, STEPS[0]);
  expect(first.idempotent === false && again.idempotent === true && again.words[0].uses === 1 && again.content_id === first.content_id, 'idempotent');
  const mem = {};
  const backend = { get: key => (key in mem ? mem[key] : ''), set: (key, value) => { mem[key] = String(value); } };
  G.observe(store, STEPS[1]);
  const raw = G.save(store, backend);
  expect(mem[G.STORAGE_KEY] === raw && raw.indexOf('hnv') >= 0, 'saved');
  const loaded = G.load('', backend);
  const placed = G.place(loaded, 'hnv');
  expect(placed.usable === true && placed.sealed === true && placed.source === 'growth', JSON.stringify(placed));
  const replay = G.observe(loaded, STEPS[1]);
  expect(replay.idempotent === true && replay.words[0].uses === 2, 'loaded replay');
  const recalled = G.recall(loaded, { text: 'h' });
  expect(recalled.hits.some(hit => hit.word === 'hnv') && recalled.keyword_rank === false, 'reloaded recall');
});

T('the card shows packets, promotion, quarantine, recall, and restart', () => {
  ['packets', 'promote', 'quarantine', 'recall', 'restart'].forEach(mode => {
    const shown = G.monitorLines(mode);
    same(shown, py({ op: 'monitor', mode: mode }), mode);
    expect(shown.lines.length >= 4 && /No LLM/.test(shown.lines[shown.lines.length - 1]) && /0\.87/.test(shown.lines[shown.lines.length - 1]), mode + ' ' + shown.lines.join(' | '));
  });
  const packets = G.monitorLines('packets');
  expect(packets.attrs.mode === 'packets' && packets.attrs.status === 'provisional' && /Known create/.test(packets.lines[0]) && /Novel hnv/.test(packets.lines[1]) && /ε 0/.test(packets.lines[1]) && /μ 1/.test(packets.lines[1]), packets.lines.join(' | '));
  const promoted = G.monitorLines('promote');
  expect(/tier promoted sealed true/.test(promoted.lines[0]) && /Seal [0-9a-f]{64}/.test(promoted.lines[3]), promoted.lines.join(' | '));
  const held = G.monitorLines('quarantine');
  expect(/tier quarantine/.test(held.lines[0]) && /ChristPing started false/.test(held.lines[0]) && /ep forbidden true/.test(held.lines[2]) && /qq mask true tier denied/.test(held.lines[3]), held.lines.join(' | '));
  const recalled = G.monitorLines('recall');
  expect(/Hits hnv/.test(recalled.lines[0]) && /Keyword rank false/.test(recalled.lines[0]) && /Hits none/.test(recalled.lines[1]) && /usable true/.test(recalled.lines[2]), recalled.lines.join(' | '));
  const restarted = G.monitorLines('restart');
  expect(/tier promoted sealed true uses 2/.test(restarted.lines[0]) && /Replay idempotent true/.test(restarted.lines[1]) && /kernel\.lexicon_growth_198/.test(restarted.lines[2]), restarted.lines.join(' | '));
});

T('the Ask card and trace do not admit or call a model', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
  expect(/data-growth198/.test(html) && /src="src\/lexicon_growth_198.js"/.test(html) && /Novel packets/.test(html) && /Quarantine/.test(html), 'card');
  expect(sw.indexOf('./src/lexicon_growth_198.js') >= 0, 'worker');
  expect(/data-growth-198/.test(app), 'ask trace');
  const js = fs.readFileSync(path.join(ROOT, 'src', 'lexicon_growth_198.js'), 'utf8');
  const pySrc = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'lexicon_growth_198.py'), 'utf8');
  expect(js.indexOf('Ppe.word') >= 0 && js.indexOf('Lex.tokens') >= 0 && js.indexOf('V43.driftMask') >= 0 && js.indexOf('Dpa.sealLoop') >= 0 && js.indexOf('Dpa.appendDeadPath') >= 0, 'js calls');
  expect(pySrc.indexOf('ppe_word') >= 0 && pySrc.indexOf('tokens(') >= 0 && pySrc.indexOf('drift_mask') >= 0 && pySrc.indexOf('seal_loop') >= 0 && pySrc.indexOf('append_dead_path') >= 0, 'py calls');
  expect(js.indexOf('RegExp') < 0 && js.indexOf('new RegExp') < 0 && !/import re\b/.test(pySrc), 'no parsing');
  expect(!/openai|ollama|anthropic|fetch\(/.test(js) && !/openai|ollama|anthropic/.test(pySrc), 'no model');
  Next.set('dream_idle', true);
  Next.set('economy', true);
  const staged = G.stage('why is the sky blue');
  expect(staged.dream_idle === false && staged.economy === false && staged.persisted === false && staged.admit_gate === false && staged.keyword_admit === false && staged.provenance === 'proposal v1', JSON.stringify(staged));
  expect(staged.novel.some(row => row.word === 'sky' && row.Phi === 4 && row.eps === 0 && row.mu === 1 && row.phase_name === 'Friction'), JSON.stringify(staged.novel));
  Next.set('dream_idle', false);
  Next.set('economy', false);
  same(staged, py({ op: 'stage', question: 'why is the sky blue' }), 'stage');
  const eng = cp.spawnSync('python3', ['-c', 'import json; from rmc_engine_v1.language_core_engines import run_engines; print(json.dumps(run_engines(0.2, 4, None, None, None, "why is the sky blue")["growth_198"]))'], {
    cwd: path.join(ROOT, 'engine'),
    env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }),
    encoding: 'utf8',
  });
  if (eng.status) throw new Error(String(eng.stderr || eng.stdout).slice(0, 500));
  const traced = JSON.parse(eng.stdout);
  expect(traced.persisted === false && traced.admit_gate === false && traced.calls_llm === false && traced.provenance === 'proposal v1' && traced.operators_applied === false, JSON.stringify(traced));
  expect(traced.novel.some(row => row.word === 'sky' && row.eps === 0 && row.mu === 1), JSON.stringify(traced.novel));
});

T('cold admits stay 48 of 60 and the release is 4.9.198', () => {
  const live = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_198_results.json'), 'utf8'));
  const prior = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_197_results.json'), 'utf8'));
  expect(live.stable === true && live.calls_llm === false, JSON.stringify({ stable: live.stable, llm: live.calls_llm }));
  for (const p of live.passes) {
    expect(p.admitted === 48 && p.held === 12, p.name + ' ' + p.admitted);
    expect(p.rows.every(r => r.growth_admit_gate === false && r.growth_calls_llm === false && r.growth_dream_idle === false && r.growth_keyword_admit === false && r.growth_persisted === false && r.growth_operators_applied === false && r.growth_provenance === 'proposal v1' && r.ppe_admit_gate === false), p.name + ' growth');
  }
  const now = new Set(live.passes[0].rows.filter(r => r.admitted).map(r => r.question));
  const then = new Set(prior.passes[0].rows.filter(r => r.admitted).map(r => r.question));
  const gained = [...now].filter(q => !then.has(q));
  const lost = [...then].filter(q => !now.has(q));
  expect(now.size === 48 && gained.length === 0 && lost.length === 0, JSON.stringify({ gained, lost }));
  const pyodide = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_198_pyodide.json'), 'utf8'));
  expect(pyodide.pyodide === '0.27.7' && pyodide.matched === pyodide.cases && pyodide.max_abs_gap === 0 && pyodide.calls_llm === false, JSON.stringify(pyodide));
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.203', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.198/.test(conf) && /C_min stays 0\.87/.test(conf) && /4\.9\.199/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.198/.test(nb) && /WIRING_198/.test(nb) && /4\.9\.199/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.198/.test(readme) && /WIRING_198/.test(readme), 'README');
  const doc = fs.readFileSync(path.join(ROOT, '..', 'docs', 'WIRING_198.md'), 'utf8');
  expect(/0\.87/.test(doc) && /No model is called/.test(doc) && /proposal v1/.test(doc) && /No Supabase migration is added/.test(doc), 'WIRING');
  const table = fs.readFileSync(path.join(ROOT, '..', 'docs', 'LIVE_TEST_198.md'), 'utf8');
  expect(/48 of 60/.test(table) && /No model is called/.test(table), 'LIVE_TEST');
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.203' && reg.features.some(f => f.id === 'R4198-LEXICON-GROWTH') && reg.count === reg.features.length && reg.claims.Implemented === 112 && reg.claims.Partial === 197, reg.version + ' ' + reg.count + ' ' + reg.claims.Partial);
  const formula = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'measurement_kernel.py'), 'utf8');
  expect(/0\.24\*memory_fit \+ 0\.20\*phase_validity/.test(formula), 'formula');
  const migrations = fs.readdirSync(path.join(ROOT, '..', 'supabase', 'migrations'));
  expect(!migrations.some(name => /198|lexicon_growth/.test(name)), migrations.join(','));
});

const rows = [];
let failed = 0;
for (const t of tests) {
  try { t.fn(); rows.push({ cls: 'R4198', name: t.name, ok: true }); }
  catch (e) { failed++; rows.push({ cls: 'R4198', name: t.name, ok: false, why: String(e.message || e).slice(0, 900) }); }
}
console.log(JSON.stringify(rows, null, 1));
process.exit(failed ? 1 : 0);
