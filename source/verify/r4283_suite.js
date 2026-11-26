/* 4.9.261: creative composition, comparative preference, operations from the compute grammar. */
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const K = require(ROOT + '/src/kernel.js');
const FK = require(ROOT + '/src/forge.js');
const Q = require(ROOT + '/src/qframe.js');
const CORE = require(ROOT + '/src/rmc_core.js');
const OPS = require(ROOT + '/src/math_ops.js');
function forge() { return FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-26T00:00:00Z' }); }
function ask(q, phone) {
  const f = forge();
  const frame = Q.compile(q, f);
  const rows = (phone || []).map((t, i) => ({ id: 'p' + i, text: /[.!?]$/.test(t) ? t : t + '.', clause: Q.clause(t, f), source: 'phone_kb', trust: 'trusted' }));
  const payload = CORE.withClauses({ question: q, frame: frame, live: true, memory: { phone: rows, pools: [] } }, Q, f);
  const py = 'import json,sys\nfrom rmc_engine_v1.rmc_core import run\nr=run(json.load(sys.stdin))\nc=r.get("creative") or {}\nprint(json.dumps({"reply":r.get("reply"),"product":r.get("product_reply"),"route":r.get("route"),"C":r.get("coherence"),"E":(r.get("echo") or {}).get("score"),"write":(r.get("memory_write") or {}).get("proposed"),"sims":[s.get("source") for s in (c.get("sims") or [])]},default=str))';
  const env = Object.assign({}, process.env, { PYTHONPATH: [path.join(ROOT, 'engine'), ROOT, path.join(ROOT, '_mathlibs')].join(path.delimiter) });
  const proc = cp.spawnSync('python3', ['-c', py], { cwd: ROOT, input: JSON.stringify(payload), env, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (proc.status !== 0) throw new Error((proc.stderr || 'python').slice(-500));
  return JSON.parse(proc.stdout.trim().split('\n').pop());
}
function register(C, expect) {
  C('R4283', 'capability verbs are the compute grammar lemmas', () => {
    const py = 'from rmc_engine_v1.computed_math import operation_lemmas\nprint(" ".join(operation_lemmas()))';
    const env = Object.assign({}, process.env, { PYTHONPATH: [path.join(ROOT, 'engine'), ROOT, path.join(ROOT, '_mathlibs')].join(path.delimiter) });
    const proc = cp.spawnSync('python3', ['-c', py], { cwd: ROOT, env, encoding: 'utf8' });
    expect(proc.status === 0 && proc.stdout.trim() === OPS.verbs.join(' '), proc.stdout + OPS.verbs.join(' '));
    const square = ask('Can you square a number?');
    expect(square.product === true && /square a number/.test(square.reply || ''), JSON.stringify(square));
    const integrate = ask('Can you integrate a function?');
    expect(!(integrate.product === true && /integrate/.test(integrate.reply || '')), JSON.stringify(integrate));
  });
  C('R4283', 'comparative, rather, and favorite frames are opinions', () => {
    const f = forge();
    const better = Q.compile('Which is the better instrument, a harp or a drum?', f);
    const rather = Q.compile('Would you rather a harp or a drum?', f);
    const favorite = Q.compile('What is your favorite instrument?', f);
    expect(better.speech_act === 'prefer' && rather.speech_act === 'prefer' && favorite.speech_act === 'prefer', JSON.stringify({ better: better.speech_act, rather: rather.speech_act, favorite: favorite.speech_act }));
    const row = ask('Which is the better instrument, a harp or a drum?', ['A harp is a lute.']);
    expect(row.route === 'creative' && /harp/.test(row.reply || '') && row.write === false, JSON.stringify(row));
  });
  C('R4283', 'a poem plans a rigid body and a throw from the facts', () => {
    const poem = ask('Write a poem about a crate. What is 8 times 7?', ['The crate weighs 6.2 kilograms and is 0.48 meters tall and 0.36 meters wide and 0.36 meters deep.']);
    expect(poem.route === 'creative' && poem.sims.indexOf('mujoco_wasm') >= 0 && /56/.test(poem.reply || '') && poem.write === false, JSON.stringify(poem));
    const ball = ask('Write a poem about a ball.', ['What happens if you throw a ball at 30 degrees at 20 m/s?']);
    expect(ball.route === 'creative' && ball.sims.indexOf('sympy_pyodide') >= 0 && ball.write === false, JSON.stringify(ball));
  });
  C('R4283', 'a story is past where the fact is a copula and is not stored', () => {
    const story = ask('Tell a story about a mink.', ['A mink is a mammal.']);
    expect(Q.compile('Tell a story about a mink.', forge()).speech_act === 'narrate', 'narrate');
    expect(story.route === 'creative' && /mink/.test(story.reply || '') && story.write === false, JSON.stringify(story));
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 700); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
