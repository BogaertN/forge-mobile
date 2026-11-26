/* 4.9.256: ability coordination, a body entailment, a missing-slot ask, and a scaled follow-up.
 * These sentences are not the held-out set. */
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
  const py = 'import json,sys\nfrom rmc_engine_v1.rmc_core import run\np=json.load(sys.stdin)\nr=run(p)\nd=(r.get("world_model") or {}).get("derive") or {}\nprint(json.dumps({"reply":r.get("reply"),"path":r.get("answer_path"),"product":r.get("product_reply"),"derived":d.get("derived_text"),"status":d.get("status")}))';
  const env = Object.assign({}, process.env, { PYTHONPATH: [path.join(ROOT, 'engine'), ROOT, path.join(ROOT, '_mathlibs')].join(path.delimiter) });
  const rows = (phone || []).map((t, i) => ({ id: 'p' + i, text: t, source: 'phone_kb', trust: 'trusted' }));
  const payload = CORE.withClauses({ question: q, frame: Q.compile(q, f), live: true, memory: { phone: rows, pools: [] } }, Q, f);
  const r = cp.spawnSync('python3', ['-c', py], { cwd: ROOT, input: JSON.stringify(payload), env, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error((r.stderr || 'python').slice(-400));
  return JSON.parse(r.stdout.trim().split('\n').pop());
}
function register(C, expect) {
  C('R4280', 'two ability questions joined by and are both answered', () => {
    const row = ask('Can you run a simulation and also remember a sentence?');
    expect(row.product === true && /simulation/.test(row.reply) && /remember/.test(row.reply), JSON.stringify(row));
  });
  C('R4280', 'a body noun named by a gloss is denied by having no body', () => {
    const row = ask('Do you have a pulse?');
    expect(row.product === true && /^No\./.test(row.reply) && /pulse/.test(row.reply), JSON.stringify(row));
  });
  C('R4280', 'a push with mass and no size asks for the missing slot', () => {
    const row = ask('What happens if I push the vekk near the top?', ['The vekk weighs 3 kilograms.']);
    expect(row.product === false && row.path === 'ask' && /vekk/.test(row.reply) && /shape/.test(row.reply), JSON.stringify(row));
  });
  C('R4280', 'not inside a container denies a smaller place inside it, and not the larger place', () => {
    const sound = ask('Is Lira inside Fenn?', ['Lira is not inside Quar.', 'Fenn is inside Quar.']);
    const unsound = ask('Is Lira inside Quar?', ['Lira is not inside Fenn.', 'Fenn is inside Quar.']);
    expect(sound.derived && /not inside Fenn/.test(sound.derived), JSON.stringify(sound));
    expect(!(unsound.derived && /not inside Quar/.test(unsound.derived)), JSON.stringify(unsound));
  });
  C('R4280', 'a possessive aunt is the inverse niece', () => {
    const row = ask("Who is Pema's niece?", ["Willa's aunt is Pema."]);
    expect(row.derived && /Willa/.test(row.derived), JSON.stringify(row));
  });
  C('R4280', 'half as tall scales the prior height', () => {
    const f = forge();
    const frame = Q.compile('What if the crate were half as tall?', f);
    expect(frame.cond && frame.cond.scale && frame.cond.scale.factor === 0.5 && frame.cond.scale.dim === 'height', JSON.stringify(frame.cond && frame.cond.scale));
    const py = 'import json,sys\nfrom rmc_engine_v1.sim_karaka import continue_scene\nbody=json.load(sys.stdin)\nprint(continue_scene(body["prior"], body["frame"]) or "")';
    const env = Object.assign({}, process.env, { PYTHONPATH: [path.join(ROOT, 'engine'), ROOT].join(path.delimiter) });
    const prior = { scene: { verb: 'push', action: 'push', defaulted: [], body: { noun: 'crate', phrase: 'the crate', mass: 4, height: 0.8, width: 0.4, depth: 0.4 }, point: { name: 'top' }, surface: { name: 'table' } } };
    const r = cp.spawnSync('python3', ['-c', py], { cwd: ROOT, input: JSON.stringify({ prior, frame }), env, encoding: 'utf8' });
    if (r.status !== 0) throw new Error((r.stderr || '').slice(-300));
    expect(/0\.4 meters tall/.test(r.stdout), r.stdout.trim());
  });
  C('R4280', 'the release is 4.9.256', () => {
    expect(require('fs').readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim() === '4.9.266', 'VERSION');
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 700); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
