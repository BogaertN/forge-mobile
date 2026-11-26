/* 4.9.255: a computable quantity, a kāla interval, and an on-device thermal receipt
 * go through the same Ask path. These sentences are not the held-out set. */
const fs = require('fs');
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
  const py = 'import json,sys\nfrom rmc_engine_v1.rmc_core import run\np=json.load(sys.stdin)\nr=run(p)\nprint(json.dumps({"reply":r.get("reply"),"path":r.get("answer_path"),"route":r.get("route"),"product":r.get("product_reply")}))';
  const env = Object.assign({}, process.env, { PYTHONPATH: [path.join(ROOT, 'engine'), ROOT, path.join(ROOT, '_mathlibs')].join(path.delimiter) });
  const rows = (phone || []).map((t, i) => ({ id: 'p' + i, text: t, source: 'phone_kb', trust: 'trusted' }));
  const payload = CORE.withClauses({ question: q, frame: Q.compile(q, f), live: true, memory: { phone: rows, pools: [] } }, Q, f);
  const r = cp.spawnSync('python3', ['-c', py], { cwd: ROOT, input: JSON.stringify(payload), env, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error((r.stderr || 'python').slice(-400));
  return JSON.parse(r.stdout.trim().split('\n').pop());
}
function register(C, expect) {
  C('R4278', 'a derivative, an equation, and a remaining fraction are computed', () => {
    const d = ask('What is the derivative of 9 y cubed?');
    expect(d.product === true && d.path === 'computed' && /27/.test(d.reply) && /y/.test(d.reply), JSON.stringify(d));
    const s = ask('What is x when 8 x plus 1 equals 25?');
    expect(s.product === true && s.path === 'computed' && /x = 3/.test(s.reply), JSON.stringify(s));
    const f = ask('A barrel holds 12 liters. 3 liters are drawn. What fraction remains?');
    expect(f.product === true && f.path === 'computed' && /3\/4/.test(f.reply), JSON.stringify(f));
  });
  C('R4278', 'a year inside a kala span follows and a year outside it does not', () => {
    const fact = ['The truce held from 1801 to 1805.'];
    const inn = ask('Did the truce hold in 1803?', fact);
    const out = ask('Did the truce hold in 1810?', fact);
    expect(inn.product === true && !/^No\./.test(inn.reply) && /1801/.test(inn.reply), JSON.stringify(inn));
    expect(out.product === true && /^No\./.test(out.reply), JSON.stringify(out));
  });
  C('R4278', 'an on-device thermal receipt is spoken as a simulation', () => {
    const row = ask('What happens if I cool 1 kilogram of water to minus 10 degrees?');
    expect(row.product === true && row.path === 'simulated' && /water/.test(row.reply) && /freez/.test(row.reply), JSON.stringify(row));
    expect(fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim() === '4.9.260', 'VERSION');
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 700); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
