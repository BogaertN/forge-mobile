/* 4.9.260: orbit measure stays on the satellite, a capability verb is realized, creative output is not a fact. */
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const K = require(ROOT + '/src/kernel.js');
const FK = require(ROOT + '/src/forge.js');
const Q = require(ROOT + '/src/qframe.js');
const CORE = require(ROOT + '/src/rmc_core.js');
function forge() { return FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-26T00:00:00Z' }); }
function ask(q, phone) {
  const f = forge();
  const frame = Q.compile(q, f);
  const rows = (phone || []).map((t, i) => ({ id: 'p' + i, text: /[.!?]$/.test(t) ? t : t + '.', clause: Q.clause(t, f), source: 'phone_kb', trust: 'trusted' }));
  const payload = CORE.withClauses({ question: q, frame: frame, live: true, memory: { phone: rows, pools: [] } }, Q, f);
  const py = 'import json,sys\nfrom rmc_engine_v1.rmc_core import run\nr=run(json.load(sys.stdin))\nc=r.get("creative") or {}\nprint(json.dumps({"reply":r.get("reply"),"product":r.get("product_reply"),"route":r.get("route"),"C":r.get("coherence"),"E":(r.get("echo") or {}).get("score"),"write":(r.get("memory_write") or {}).get("proposed"),"sims":[s.get("source") for s in (c.get("facts") and c.get("sims") or [])],"facts":[x.get("text") for x in (c.get("facts") or [])],"math":[m.get("text") for m in (c.get("math") or [])]},default=str))';
  const env = Object.assign({}, process.env, { PYTHONPATH: [path.join(ROOT, 'engine'), ROOT, path.join(ROOT, '_mathlibs')].join(path.delimiter) });
  const proc = cp.spawnSync('python3', ['-c', py], { cwd: ROOT, input: JSON.stringify(payload), env, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (proc.status !== 0) throw new Error((proc.stderr || 'python').slice(-500));
  return JSON.parse(proc.stdout.trim().split('\n').pop());
}
function register(C, expect) {
  C('R4282', 'a period above Earth uses the stated altitude', () => {
    const row = ask('What is the period of a satellite 350 kilometers above Earth?');
    expect(row.product === true && /91\.39/.test(row.reply || '') && !/altitude of the earth/i.test(row.reply || ''), JSON.stringify(row));
    expect(row.C >= 0.87 && row.E >= 0.85, JSON.stringify(row));
  });
  C('R4282', 'an arithmetic capability is realized from the installed operation', () => {
    const row = ask('Can you add two numbers?');
    expect(row.product === true && /add two numbers/.test(row.reply || '') && row.C >= 0.87 && row.E >= 0.85, JSON.stringify(row));
  });
  C('R4282', 'a poem is composed from cited facts and is not a memory proposal', () => {
    const frame = Q.compile('Write a poem about a harbor.', forge());
    expect(frame.speech_act === 'compose' && frame.expressive === 'lines', JSON.stringify(frame.speech_act));
    const row = ask('Write a poem about a harbor.', ['A harbor holds water.', 'A boat floats in the water.']);
    expect(row.route === 'creative' && row.product === true && /harbor holds water/.test(row.reply || '') && row.write === false, JSON.stringify(row));
  });
  C('R4282', 'an opinion cites the derived chain and a poem can carry a simulation and a product', () => {
    const opinion = ask('Which do you prefer, a harp or a drum?', ['A harp is a lute.', 'A lute is a stringed instrument.']);
    expect(opinion.route === 'creative' && /harp/.test(opinion.reply || '') && /stringed instrument/.test(opinion.reply || ''), JSON.stringify(opinion));
    const poem = ask('Write a poem about a boat. What is 6 times 7?', ['The boat weighs 5.4 kilograms and is 0.70 meters tall and 0.20 meters wide and 0.20 meters deep.']);
    expect(poem.route === 'creative' && /slides/.test(poem.reply || '') && /42/.test(poem.reply || '') && poem.write === false, JSON.stringify(poem));
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 700); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
