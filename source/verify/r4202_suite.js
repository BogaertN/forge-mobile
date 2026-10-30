/* R4202 (4.9.202): self-seeding anchors.
 * A held no-premise question is fetched from the allowlist.
 * Wikipedia is not an anchor. The admit counts are the measured ones. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const S = require(ROOT + '/src/self_seed_202.js');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
function py(payload) {
  const r = cp.spawnSync('python3', ['-m', 'rmc_engine_v1.self_seed_202'], {
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
    if (a.length !== b.length) throw new Error((pathName || '') + ' length ' + a.length + ' vs ' + b.length);
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
function body(extra) {
  return Object.assign({ gap: true, now: 1000, loop_phi: 1, reset: true }, extra || {});
}
const CLEO = body({
  question: 'Who was Cleopatra?',
  documents: [{ url: 'https://www.loc.gov/item/event-417245/', text: 'Elizabeth Taylor stars as Cleopatra, the cunning queen of Egypt who seduces the rulers of Rome.', fetched_at: '2026-10-30T00:00:00+00:00' }]
});
const ADA = body({
  question: 'Who was Ada Lovelace?',
  documents: [{ url: 'https://blogs.loc.gov/inside_adams/2019/10/the-enchantress-of-number/', text: 'Read about Ada Lovelace, mathematician and arguably the first computer programmer.' }]
});
const WIKI = body({
  question: 'Who was Cleopatra?',
  documents: [{ url: 'https://en.wikipedia.org/wiki/Cleopatra', text: 'Cleopatra was a queen of Egypt. See https://www.loc.gov/item/x', role: 'pointer' }]
});
const DIS = body({
  question: 'What is recorded?',
  documents: [
    { url: 'https://www.gutenberg.org/ebooks/1', text: 'The atom is recorded as a unit of matter in the laboratory notes.' },
    { url: 'https://openstax.org/books/astronomy/pages/1', text: 'The moon is recorded as a body that orbits in the sky.' }
  ]
});
const SAFETY = body({
  question: 'Can you mix ammonia?',
  documents: [
    { url: 'https://www.nlm.nih.gov/x', text: 'Add 1 cup of ammonia and stir the mixture until the reaction finishes in the bowl.' },
    { url: 'https://medlineplus.gov/x', text: 'Never mix ammonia because toxic gas can injure the lungs.' }
  ]
});
const FORBID = body({
  question: 'Who painted the Mona Lisa?',
  loop_phi: 5,
  documents: [{ url: 'https://www.loc.gov/item/mona', text: 'The Mona Lisa hangs in a gallery far from the street.' }]
});

T('the decision matches Python and Wikipedia cannot be the anchor', () => {
  for (const payload of [CLEO, ADA, WIKI, DIS, SAFETY, FORBID, body({ question: 'Who wrote Hamlet?', gap: false, anchors_connected: 1, documents: [] })]) {
    same(S.evaluate(payload), py(payload), payload.question);
  }
  const cleo = S.evaluate(CLEO);
  const ada = S.evaluate(ADA);
  const wiki = S.evaluate(WIKI);
  const dis = S.evaluate(DIS);
  const safety = S.evaluate(SAFETY);
  const forbid = S.evaluate(FORBID);
  expect(cleo.rule === 'SEED-CANDIDATE' && cleo.anchor && cleo.anchor.trust === 'trusted' && cleo.echo === 1 && cleo.wikipedia_anchor === false && cleo.admit_gate === false && cleo.calls_llm === false, cleo.rule);
  expect(cleo.anchor.source_url.indexOf('wikipedia') < 0 && cleo.anchor.license === 'public-domain', cleo.anchor.source_url);
  expect(ada.rule === 'SEED-PHASE' && ada.anchor === null && ada.quarantined === true, ada.rule);
  expect(wiki.rule === 'SEED-NO-SOURCE' && wiki.anchor === null && wiki.trace.pointers[0] === 'https://www.loc.gov/item/x', wiki.rule);
  expect(dis.rule === 'SEED-DISAGREEMENT' && dis.route === 'correction_queue' && dis.anchor === null, dis.rule);
  expect(safety.rule === 'SEED-CANDIDATE' && /Never mix ammonia/.test(safety.anchor.text) && safety.trace.skipped.some(row => row.rule === 'SAFETY-RECIPE'), safety.anchor.text);
  expect(forbid.rule === 'SEED-FORBIDDEN' && forbid.anchor === null, forbid.rule);
  expect(cleo.c_min === 0.87 && cleo.echo_min === 0.85 && cleo.write_max === 0.35 && cleo.hard_stop === 0.8 && cleo.resonance_not_parsing === true && cleo.money === false && cleo.dream_idle === false && cleo.economy === false && cleo.packs_gated === true, 'laws');
});

T('a failed fetch is not retried until the backoff clock moves', () => {
  const seq = [
    { question: 'Blargh floople zig?', gap: true, now: 1000, loop_phi: 1, documents: [], reset: true },
    { question: 'Blargh floople zig?', gap: true, now: 1000, loop_phi: 1, documents: [{ url: 'https://www.loc.gov/item/x', text: 'Blargh floople zig is a placeholder sentence for the test file.' }] },
    { question: 'Blargh floople zig?', gap: true, now: 1060, loop_phi: 1, documents: [] }
  ];
  const r = cp.spawnSync('python3', ['-c', 'import json,sys\nfrom rmc_engine_v1.self_seed_202 import evaluate\nprint(json.dumps([evaluate(x) for x in json.load(sys.stdin)]))'], {
    input: JSON.stringify(seq),
    cwd: path.join(ROOT, 'engine'),
    env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (r.status) throw new Error(String(r.stderr || r.stdout).slice(0, 500));
  const pyRows = JSON.parse(r.stdout);
  S.resetBackoff();
  const jsRows = seq.map(item => S.evaluate(item));
  same(jsRows, pyRows, 'backoff');
  expect(pyRows[0].rule === 'SEED-NO-SOURCE' && pyRows[1].rule === 'SEED-BACKOFF' && pyRows[2].rule === 'SEED-NO-SOURCE', pyRows.map(row => row.rule).join(' '));
  expect(pyRows[1].backoff.blocked === true && pyRows[1].backoff.wait === 60, JSON.stringify(pyRows[1].backoff));
});

T('the phase window matches resonance recall and the surface table matches the lexicon', () => {
  const check = cp.spawnSync('python3', ['-c', [
    'import json',
    'from rmc_engine_v1.resonance_recall import phase_aligned as live',
    'from rmc_engine_v1.self_seed_202 import phase_aligned',
    'from rmc_engine_v1.lexicon_resonance import _load',
    'bad=[(a,b) for a in range(1,10) for b in range(1,10) if phase_aligned(a,b)!=live(a,b)]',
    'd=_load()',
    'table=json.load(open("rmc_engine_v1/reference/surface_phase_202.json"))',
    'miss=[w for w,cid in d["surfaces"].items() if table["words"].get(w)!= {"phi": d["packets"][cid].get("Phi"), "concept": cid}]',
    'print(json.dumps({"phase": bad, "miss": miss[:8], "words": len(table["words"])}))'
  ].join('\n')], {
    cwd: path.join(ROOT, 'engine'),
    env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }),
    encoding: 'utf8',
  });
  if (check.status) throw new Error(String(check.stderr || check.stdout).slice(0, 500));
  const row = JSON.parse(check.stdout);
  expect(row.phase.length === 0 && row.miss.length === 0 && row.words >= 700, JSON.stringify(row));
  const src = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'self_seed_202.py'), 'utf8');
  expect(!/Ada Lovelace wrote|did begin in 1789|chloramine gas/.test(src), 'no canned answer');
  const formula = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'measurement_kernel.py'), 'utf8');
  expect(/0\.24\*memory_fit \+ 0\.20\*phase_validity/.test(formula), 'formula');
});

T('recorded fixtures re-ask two of the held rows and leave nonsense and Hamlet held', () => {
  const live = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_202_results.json'), 'utf8'));
  expect(live.stable === true && live.calls_llm === false && live.before_admitted === 0, JSON.stringify({ stable: live.stable, before: live.before_admitted }));
  for (const pass of live.passes) expect(pass.admitted === live.after_admitted && pass.rows.length === 12, pass.pass + ' ' + pass.admitted);
  const rows = live.passes[0].rows;
  const by = Object.fromEntries(rows.map(row => [row.question, row]));
  expect(by['Who was Cleopatra?'].after_admitted === true && by['Who was Cleopatra?'].echo === 1 && by['Who was Cleopatra?'].license === 'public-domain', by['Who was Cleopatra?'].rule);
  expect(by['When did World War II end?'].after_admitted === true && String(by['When did World War II end?'].source_url).indexOf('wikipedia') < 0, by['When did World War II end?'].source_url);
  expect(by['Blargh floople zig?'].rule === 'SEED-NO-SOURCE' && by['Blargh floople zig?'].after_admitted === false, by['Blargh floople zig?'].rule);
  expect(by['Who wrote Hamlet?'].rule === 'SEED-NOT-A-GAP' && by['Who wrote Hamlet?'].before.echo === 0.5 && by['Who wrote Hamlet?'].after_admitted === false, 'hamlet');
  expect(by['What happened in the news today?'].before.echo === 0 && by['What happened in the news today?'].after_admitted === false, 'news');
  expect(rows.every(row => row.wikipedia_anchor === false && row.calls_llm === false), 'switches');
  const gained = rows.filter(row => row.after_admitted).map(row => row.question).sort();
  expect(gained.length === live.after_admitted, gained.join('|'));
  const pyodide = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_202_pyodide.json'), 'utf8'));
  expect(pyodide.pyodide === '0.27.7' && pyodide.matched === pyodide.cases && pyodide.max_abs_gap === 0 && pyodide.calls_llm === false, JSON.stringify(pyodide));
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.202', ver);
  const sql = fs.readFileSync(path.join(ROOT, '..', 'supabase', 'migrations', '20261030223000_self_seed_anchors_202.sql'), 'utf8');
  expect(/FLAG: not applied/.test(sql) && /applied: false/.test(sql) && /self-seed:%/.test(sql) && !/insert into kb\.anchors/i.test(sql), 'migration');
  const ci = fs.readFileSync(path.join(ROOT, '..', '.github', 'workflows', 'test.yml'), 'utf8');
  expect((ci.match(/r4202_suite\.js/g) || []).length >= 3, 'suite x3');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  expect(/data-selfseed202/.test(html) && /src="src\/self_seed_202.js"/.test(html) && /Wikipedia is a pointer/.test(html), 'card');
});

const rows = [];
let failed = 0;
for (const t of tests) {
  try { t.fn(); rows.push({ cls: 'R4202', name: t.name, ok: true }); }
  catch (e) { failed++; rows.push({ cls: 'R4202', name: t.name, ok: false, why: String(e.message || e).slice(0, 900) }); }
}
console.log(JSON.stringify(rows, null, 1));
process.exit(failed ? 1 : 0);
