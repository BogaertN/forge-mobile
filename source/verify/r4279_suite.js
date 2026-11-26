/* 4.9.255: a remembered measure feeds the next engine. These sentences are not the held-out set. */
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
  const py = 'import json,sys\nfrom rmc_engine_v1.rmc_core import run\np=json.load(sys.stdin)\nr=run(p)\nprint(json.dumps({"reply":r.get("reply"),"path":r.get("answer_path"),"product":r.get("product_reply")}))';
  const env = Object.assign({}, process.env, { PYTHONPATH: [path.join(ROOT, 'engine'), ROOT, path.join(ROOT, '_mathlibs')].join(path.delimiter) });
  const rows = (phone || []).map((t, i) => ({ id: 'p' + i, text: t, source: 'phone_kb', trust: 'trusted' }));
  const payload = CORE.withClauses({ question: q, frame: Q.compile(q, f), live: true, memory: { phone: rows, pools: [] } }, Q, f);
  const r = cp.spawnSync('python3', ['-c', py], { cwd: ROOT, input: JSON.stringify(payload), env, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error((r.stderr || 'python').slice(-400));
  return JSON.parse(r.stdout.trim().split('\n').pop());
}
function plan(q, phone) {
  const f = forge();
  const py = 'import json,sys\nfrom rmc_engine_v1.sim_device import plan\nb=json.load(sys.stdin)\np=plan(b["q"], b["frame"], memory=b["memory"])\nprint(json.dumps({"ok":bool(p.get("ok")),"solver":p.get("solver"),"reason":p.get("reason")}))';
  const env = Object.assign({}, process.env, { PYTHONPATH: [path.join(ROOT, 'engine'), ROOT, path.join(ROOT, '_mathlibs')].join(path.delimiter) });
  const rows = (phone || []).map((t, i) => ({ id: 'p' + i, text: t, clause: Q.clause(t, f), source: 'phone_kb' }));
  const r = cp.spawnSync('python3', ['-c', py], { cwd: ROOT, input: JSON.stringify({ q, frame: Q.compile(q, f), memory: rows }), env, encoding: 'utf8', maxBuffer: 1 << 22 });
  if (r.status !== 0) throw new Error((r.stderr || 'python').slice(-400));
  return JSON.parse(r.stdout.trim().split('\n').pop());
}
function register(C, expect) {
  C('R4279', 'a scaled remembered length is the quantity a percent computes', () => {
    const row = ask('What is 25 percent of a zot?', ['A plim is 20 centimeters long.', 'A zot is twice a plim.']);
    expect(row.product === true && row.path === 'computed' && /10 centimeters/.test(row.reply), JSON.stringify(row));
    const conv = ask('What is a plim in millimeters?', ['A plim is 20 centimeters long.']);
    expect(conv.product === true && conv.path === 'computed' && /200 millimeters/.test(conv.reply), JSON.stringify(conv));
    const height = ask("What is 50 percent of the vekk's height in centimeters?", ['The vekk is 0.4 meters tall.']);
    expect(height.product === true && /20 centimeters/.test(height.reply), JSON.stringify(height));
  });
  C('R4279', 'a timed containment chain holds inside the interval and not outside it', () => {
    const facts = ['From 1600 to 1610 Arl was inside Benn.', 'Benn is inside Coth.'];
    const inn = ask('Was Arl inside Coth in 1604?', facts);
    const out = ask('Was Arl inside Coth in 1620?', facts);
    expect(inn.product === true && !/^No\./.test(inn.reply) && /Coth/.test(inn.reply), JSON.stringify(inn));
    expect(out.product === true && /^No\./.test(out.reply), JSON.stringify(out));
  });
  C('R4279', 'a timed kinship copula keeps the year on kala', () => {
    const fact = ["From 1700 to 1710 Senn was Tor's child."];
    const inn = ask("Was Senn Tor's child in 1705?", fact);
    const out = ask("Was Senn Tor's child in 1720?", fact);
    expect(inn.product === true && !/^No\./.test(inn.reply), JSON.stringify(inn));
    expect(out.product === true && /^No\./.test(out.reply), JSON.stringify(out));
  });
  C('R4279', 'a positive copula then a negative copula denies the composed kind', () => {
    const row = ask('Is a nup a qip?', ['A nup is a vel.', 'A vel is not a qip.']);
    expect(row.product === true && /nup is not a qip/.test(row.reply), JSON.stringify(row));
  });
  C('R4279', 'remembered altitudes sum into an orbit period', () => {
    const row = ask('What is the period of the spar?', ['The dock sits 400 kilometers above Earth.', 'The spar sits 50 kilometers above the dock.']);
    expect(row.product === true && row.path === 'simulated' && /93\.44 minutes/.test(row.reply), JSON.stringify(row));
  });
  C('R4279', 'a remembered size compiles an unknown body for a push', () => {
    const phone = ['The vekk weighs 3 kilograms and is 0.4 meters tall and 0.2 meters wide and 0.2 meters deep.'];
    const got = plan('What happens if I push the vekk near the top?', phone);
    expect(got.ok === true && got.solver === 'mujoco_wasm', JSON.stringify(got));
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 700); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
