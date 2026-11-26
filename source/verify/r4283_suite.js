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
    expect(integrate.product === true && /integrate a function/.test(integrate.reply || ''), JSON.stringify(integrate));
    const bake = ask('Can you bake a cake?');
    expect(!(bake.product === true && /bake a cake/.test(bake.reply || '')), JSON.stringify(bake));
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
  C('R4283', 'a structure sense does not take a tabletop height', () => {
    const py = 'from rmc_engine_v1.athena_props import kind_accepts\nimport json\nprint(json.dumps({"library": kind_accepts("library", [{"property":"height","value":0.758}]), "chair": kind_accepts("chair", [{"property":"height","value":0.9}]), "hall": kind_accepts("hall", [{"property":"height","value":0.5}]), "table": kind_accepts("table", [{"property":"height","value":0.75}]), "bank": kind_accepts("bank", [{"property":"height","value":0.5}]), "bottle": kind_accepts("bottle", [{"property":"height","value":0.22}]), "bottle5": kind_accepts("bottle", [{"property":"height","value":5.0}])}))';
    const env = Object.assign({}, process.env, { PYTHONPATH: [path.join(ROOT, 'engine'), ROOT, path.join(ROOT, '_mathlibs')].join(path.delimiter) });
    const proc = cp.spawnSync('python3', ['-c', py], { cwd: ROOT, env, encoding: 'utf8' });
    const row = JSON.parse(proc.stdout.trim());
    expect(proc.status === 0 && row.library === false && row.chair === true && row.hall === false && row.table === true && row.bank === false && row.bottle === true && row.bottle5 === false, proc.stdout + proc.stderr);
  });
  C('R4283', 'a story keeps the asked noun and cites its class', () => {
    const story = ask('Tell a story about a mink.', ['A mink is a mammal.']);
    expect(Q.compile('Tell a story about a mink.', forge()).speech_act === 'narrate', 'narrate');
    expect(story.route === 'creative' && /^The mink\b/.test(story.reply || '') && /mammal/.test(story.reply || '') && !/weasel/.test(story.reply || '') && story.write === false, JSON.stringify(story));
    const fur = ask('Tell a story about a mink.', ['A mink is a mammal.', 'A mink has fur.']);
    expect(fur.route === 'creative' && /The mink that is a mammal had fur/.test(fur.reply || '') && !/weasel/.test(fur.reply || '') && fur.write === false, JSON.stringify(fur));
  });
  C('R4283', 'a poem stays with the topic and folds its measures', () => {
    const cask = ask('Write a poem about a cask.', ['A cask weighs 4.8 kilograms.', 'A cask is 0.62 meters tall.', 'A cask is 0.28 meters wide.', 'A cask is 0.28 meters deep.', 'A qubit is a bit.']);
    expect(cask.route === 'creative' && /0\.62 meters tall/.test(cask.reply || '') && /weighs 4\.8 kilograms/.test(cask.reply || '') && !/qubit/.test(cask.reply || '') && cask.write === false, JSON.stringify(cask));
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 700); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
