/* R4203 (4.9.203): reference-prose self-seeding.
 * The 4.9.202 checks stay. Wikipedia is not an anchor. No model. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const S = require(ROOT + '/src/self_seed_203.js');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
function py(payload) {
  const r = cp.spawnSync('python3', ['-m', 'rmc_engine_v1.self_seed_203'], {
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
const AGREE = body({
  question: 'Who was Cleopatra?',
  documents: [
    { url: 'https://www.gutenberg.org/ebooks/1', title: 'Cleopatra', text: 'Cleopatra was a queen of Egypt in the ancient world.', fetched_at: '2026-10-30T00:00:00+00:00' },
    { url: 'https://openstax.org/books/x', title: 'Cleopatra', text: 'Cleopatra was a queen of Egypt in the ancient world.', fetched_at: '2026-10-30T00:00:00+00:00' }
  ]
});
const COREF = body({
  question: 'Who was Cleopatra?',
  documents: [
    { url: 'https://www.gutenberg.org/ebooks/1', title: 'Cleopatra', own_entry: true, text: 'She was a queen of Egypt in the ancient world and Cleopatra ruled the Nile.' },
    { url: 'https://openstax.org/books/x', title: 'Cleopatra', own_entry: true, text: 'She was a queen of Egypt in the ancient world and Cleopatra ruled the Nile.' }
  ]
});
const OUTSIDE = body({
  question: 'Who was Cleopatra?',
  documents: [
    { url: 'https://www.gutenberg.org/ebooks/1', title: 'Rome', own_entry: false, text: 'She was a queen of Egypt in the ancient world and Cleopatra ruled the Nile.' },
    { url: 'https://openstax.org/books/x', title: 'Rome', own_entry: false, text: 'She was a queen of Egypt in the ancient world and Cleopatra ruled the Nile.' }
  ]
});
const STALE = body({
  question: 'When did World War II end?',
  documents: [
    { url: 'https://www.gutenberg.org/ebooks/9', title: 'Encyclopaedia Britannica 11th Edition', period_year: 1911, text: 'World War II ended in 1945 after the recorded surrender.' },
    { url: 'https://history.state.gov/ww2', period_year: 1911, text: 'World War II ended in 1945 after the recorded surrender.' }
  ]
});
const CATALOG = body({
  question: 'Who was Cleopatra?',
  documents: [{ url: 'http://www.loc.gov/item/2004675107/', text: 'DeMille\'s Cleopatra" showing headshots of stars Claudette Colbert, Warren William, and Henry Wilcoxon.' }]
});
const WIKI = body({
  question: 'Who was Cleopatra?',
  documents: [{ url: 'https://en.wikipedia.org/wiki/Cleopatra', role: 'pointer', text: 'Cleopatra was a queen of Egypt. See https://www.loc.gov/item/x' }]
});
const ONE = body({
  question: 'Who was Cleopatra?',
  documents: [{ url: 'https://www.gutenberg.org/ebooks/1', text: 'Cleopatra was a queen of Egypt in the ancient world.' }]
});
const SAFETY = body({
  question: 'What happens if you mix bleach and ammonia?',
  documents: [
    { url: 'https://www.nlm.nih.gov/x', text: 'Add 1 cup of ammonia and stir the mixture until the reaction finishes in the bowl today.' },
    { url: 'https://www.cdc.gov/x', text: 'What happens if you mix bleach and ammonia produces toxic chloramine gas in a closed room.' },
    { url: 'https://medlineplus.gov/y', text: 'What happens if you mix bleach and ammonia produces toxic chloramine gas in a closed room.' }
  ]
});
const HOST = body({
  question: 'What happens if you mix bleach and ammonia?',
  documents: [
    { url: 'https://www.gutenberg.org/ebooks/3', text: 'What happens if you mix bleach and ammonia produces toxic chloramine gas in a closed room.' },
    { url: 'https://openstax.org/books/y', text: 'What happens if you mix bleach and ammonia produces toxic chloramine gas in a closed room.' }
  ]
});
const DIS = body({
  question: 'Who was Cleopatra?',
  documents: [
    { url: 'https://www.gutenberg.org/ebooks/1', text: 'Cleopatra was a queen of Egypt in the ancient world.' },
    { url: 'https://openstax.org/books/x', text: 'Cleopatra was a poet of Rome in the recorded histories.' }
  ]
});

T('the decision matches Python and the 202 checks are not loosened', () => {
  for (const payload of [AGREE, COREF, OUTSIDE, STALE, CATALOG, WIKI, ONE, SAFETY, HOST, DIS, body({ question: 'Who wrote Hamlet?', gap: false, anchors_connected: 1, documents: [] })]) {
    same(S.evaluate(payload), py(payload), payload.question + ' ' + (payload.documents[0] && payload.documents[0].title));
  }
  const agree = S.evaluate(AGREE);
  const coref = S.evaluate(COREF);
  const outside = S.evaluate(OUTSIDE);
  const stale = S.evaluate(STALE);
  const catalog = S.evaluate(CATALOG);
  const wiki = S.evaluate(WIKI);
  const one = S.evaluate(ONE);
  const safety = S.evaluate(SAFETY);
  const host = S.evaluate(HOST);
  const dis = S.evaluate(DIS);
  expect(agree.rule === 'SEED-CANDIDATE' && agree.corroborated === true && agree.hosts.length === 2 && agree.wikipedia_anchor === false && agree.c_min === 0.87 && agree.echo_min === 0.85 && agree.write_max === 0.35 && agree.hard_stop === 0.8, agree.rule);
  expect(agree.anchor.provenance.license && agree.anchor.provenance.fetched_at && agree.anchor.provenance.content_sha256 && agree.anchor.provenance.source_url, 'provenance');
  expect(coref.rule === 'SEED-CANDIDATE' && coref.anchor.provenance.coreference === true && coref.anchor.provenance.own_entry === true, 'coref');
  expect(outside.rule === 'SEED-SHAPE' && outside.anchor === null, outside.rule);
  expect(stale.rule === 'SEED-STALE' && stale.anchor === null, stale.rule);
  expect(catalog.rule === 'SEED-CATALOG' && catalog.anchor === null, catalog.rule);
  expect(wiki.rule === 'SEED-NO-SOURCE' && wiki.anchor === null && wiki.trace.pointers[0] === 'https://www.loc.gov/item/x', wiki.rule);
  expect(one.rule === 'SEED-CORROBORATION' && one.hosts.length === 1, one.rule);
  expect(safety.rule === 'SEED-CANDIDATE' && safety.trace.skipped.some(row => row.rule === 'SAFETY-RECIPE') && safety.anchor.text.indexOf('chloramine') >= 0, safety.rule);
  expect(host.rule === 'SEED-SAFETY-HOST' && host.anchor === null, host.rule);
  expect(dis.rule === 'SEED-DISAGREEMENT' && dis.anchor === null, dis.rule);
  expect(agree.money === false && agree.dream_idle === false && agree.economy === false && agree.packs_gated === true && agree.calls_llm === false && agree.resonance_not_parsing === true, 'laws');
  const src = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'self_seed_203.py'), 'utf8');
  expect(!/Ada Lovelace was|began in 1789|chloramine gas/.test(src), 'no canned answer');
  expect(!/wikipedia.org\/wiki\/Ada|gutenberg.org\/ebooks\/11[^0-9]/.test(src), 'no canned url');
  const formula = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'measurement_kernel.py'), 'utf8');
  expect(/0\.24\*memory_fit \+ 0\.20\*phase_validity/.test(formula), 'formula');
});

T('a failed fetch is not retried until the backoff clock moves', () => {
  const seq = [
    { question: 'Blargh floople zig?', gap: true, now: 1000, loop_phi: 1, documents: [], reset: true },
    { question: 'Blargh floople zig?', gap: true, now: 1000, loop_phi: 1, documents: [] },
    { question: 'Blargh floople zig?', gap: true, now: 1060, loop_phi: 1, documents: [] }
  ];
  const r = cp.spawnSync('python3', ['-c', 'import json,sys\nfrom rmc_engine_v1.self_seed_203 import evaluate\nprint(json.dumps([evaluate(x) for x in json.load(sys.stdin)]))'], {
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
});

T('What can you do? is not the feeling sentence', () => {
  const out = cp.execFileSync('python3', ['-c', `
import json
from rmc_engine_v1.rmc_core import run
from tools.live_188 import SEED, research_rows, shard_rows, starter_rows
research=research_rows(); starter=starter_rows()
def ask(q):
    memory=json.loads(json.dumps(SEED))
    memory["anchors"]=starter+shard_rows(q)
    row=run({"question": q, "live": True, "memory": memory})
    return {"reply": row.get("reply"), "admitted": bool(row.get("product_reply")), "act": (row.get("language_core") or {}).get("speech_act"), "C": row.get("coherence"), "echo": (row.get("echo") or {}).get("score"), "llm": row.get("calls_llm")}
print(json.dumps({"how": ask("How are you?"), "what": ask("What can you do?")}))
`], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }),
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  const row = JSON.parse(out.trim().split('\n').pop());
  expect(row.how.admitted === true && row.how.act === 'self' && /feeling/.test(row.how.reply), JSON.stringify(row.how));
  expect(row.what.admitted === true && row.what.act === 'capability' && row.what.reply !== row.how.reply && /admitted facts/.test(row.what.reply) && row.what.C >= 0.87 && row.what.echo >= 0.85 && row.what.llm === false, JSON.stringify(row.what));
});

T('recorded fixtures re-ask the twelve held rows and admit nothing false', () => {
  const live = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_203_results.json'), 'utf8'));
  expect(live.stable === true && live.calls_llm === false && live.before_admitted === 0, JSON.stringify({ stable: live.stable, before: live.before_admitted }));
  for (const pass of live.passes) expect(pass.admitted === live.after_admitted && pass.rows.length === 12, pass.pass + ' ' + pass.admitted);
  const rows = live.passes[0].rows;
  const by = Object.fromEntries(rows.map(row => [row.question, row]));
  expect(by['Who wrote Hamlet?'].rule === 'SEED-NOT-A-GAP' && by['Who wrote Hamlet?'].after_admitted === false, 'hamlet');
  expect(by['Blargh floople zig?'].after_admitted === false, by['Blargh floople zig?'].rule);
  expect(by['What happened in the news today?'].after_admitted === false, 'news');
  expect(rows.every(row => row.wikipedia_anchor === false && row.calls_llm === false), 'switches');
  const gained = rows.filter(row => row.after_admitted);
  expect(gained.length === live.after_admitted, String(gained.length));
  for (const row of gained) {
    expect(row.anchor_text && row.source_url && row.license && row.fetched_at && row.content_sha256 && (row.sources || []).length >= 2, row.question);
    expect(row.anchor_text.indexOf('cup of') < 0 && row.anchor_text.indexOf('tablespoon') < 0, row.anchor_text);
  }
  const pyodide = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_203_pyodide.json'), 'utf8'));
  expect(pyodide.pyodide && pyodide.matched === pyodide.cases && pyodide.max_abs_gap === 0 && pyodide.calls_llm === false, JSON.stringify(pyodide));
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.203', ver);
  const sql = fs.readFileSync(path.join(ROOT, '..', 'supabase', 'migrations', '20261030233000_self_seed_anchors_203.sql'), 'utf8');
  expect(/FLAG: not applied/.test(sql) && /applied: false/.test(sql) && !/insert into kb\.anchors/i.test(sql), 'migration');
  const ci = fs.readFileSync(path.join(ROOT, '..', '.github', 'workflows', 'test.yml'), 'utf8');
  expect((ci.match(/r4203_suite\.js/g) || []).length >= 3, 'suite x3');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  expect(/data-selfseed203/.test(html) && /src="src\/self_seed_203.js"/.test(html) && /Wikipedia is a pointer/.test(html), 'card');
  const audit = fs.readFileSync(path.join(ROOT, '..', 'docs', 'ADMIT_AUDIT_203.md'), 'utf8');
  expect(/What can you do\?/.test(audit) && /How are you\?/.test(audit) && /Forge answers from admitted facts/.test(audit) && /does not store a feeling/.test(audit), 'audit');
  const feeling = audit.split('\n').find(line => line.indexOf('What can you do?') >= 0);
  const state = audit.split('\n').find(line => line.indexOf('How are you?') >= 0);
  expect(feeling && state && feeling !== state && feeling.indexOf('does not store a feeling') < 0, feeling);
});

const rows = [];
let failed = 0;
for (const t of tests) {
  try { t.fn(); rows.push({ cls: 'R4203', name: t.name, ok: true }); }
  catch (e) { failed++; rows.push({ cls: 'R4203', name: t.name, ok: false, why: String(e.message || e).slice(0, 900) }); }
}
console.log(JSON.stringify(rows, null, 1));
process.exit(failed ? 1 : 0);
