/* R4237 (4.9.237, Nic plan 229 step 8): the output is written by panini_wording's outward compile. The engine decides the
 * atoms and measures the reply; each spoken sentence travels with the atom it states (world_model_v1 spoken_atoms →
 * rmc_core result.outward); the phone compiles every atom-bearing sentence through the kāraka clause and grammar.js into R_t,
 * re-reads R_t and requires the same clause (and the same atom), and speaks R_t. A sentence without an atom is a cited quote.
 * A failure holds. These checks guard the wiring; the proof is the live Ask run (CONFLICTS.md v4.9.237). */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const CLOCK = () => '2026-11-05T12:00:00Z';
const K = require(ROOT + '/src/kernel.js'), FK = require(ROOT + '/src/forge.js');
const kernel = () => FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: CLOCK });
const Q = require(ROOT + '/src/qframe.js');
const CORE = require(ROOT + '/src/rmc_core.js');
const R2 = require(ROOT + '/src/rmc_renderer_200.js');
const py = (code, input) => {
  const r = cp.spawnSync('python3', ['-c', code], { cwd: ROOT, input: JSON.stringify(input || {}), env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }), encoding: 'utf8', maxBuffer: 1 << 26 });
  expect(r.status === 0, r.stderr.slice(-800));
  return JSON.parse(r.stdout.trim().split('\n').pop());
};
const DERIVE = `
import json, sys
from rmc_engine_v1 import world_model_v1 as W
from rmc_engine_v1 import rmc_core as RC
c = json.load(sys.stdin)
src = c.get("sources") or {}
ev = [dict({"id": "r%d" % i, "text": t, "clause": cl, "place": W.place_row({}, t, False)}, **({"source": src[t]} if t in src else {})) for i, (t, cl) in enumerate(zip(c["texts"], c["clauses"]))]
base, _ = W.seed_self_facts(W.empty_world())
world, tr = W.observe(base, ev)
out = []
for q, f in zip(c["qs"], c["frames"]):
    d = W.derive(world, q, c.get("path") or ["Φ1"], f)
    s = d.get("survivor") or {}
    plan = RC._outward_plan(d.get("derived_text"), {"derived_atoms": d.get("derived_atoms"), "derive": {"survivor": s}})
    other = RC._outward_plan("Something else entirely.", {"derived_atoms": d.get("derived_atoms"), "derive": {"survivor": s}})
    out.append({"q": q, "status": d["status"], "spoken": d.get("derived_text"), "atoms": d.get("derived_atoms"), "plan": plan, "other": other})
print(json.dumps(out))`;
const DOG = { sources: { 'My dog is Rex.': 'phone_kb' } };
const TEXTS = ['My dog is Rex.', 'A whale is a mammal.', 'A mammal is an animal.', 'An animal is a living thing.'];
const QS = ["What is my dog's name?", 'Who owns Rex?', 'Is a whale a living thing?'];
let cache = null;
const derived = () => { if (cache) return cache; const f = kernel(); cache = py(DERIVE, Object.assign({ texts: TEXTS, clauses: TEXTS.map(t => Q.clause(t, f)), qs: QS, frames: QS.map(q => Q.compile(q, f)) }, DOG)); return cache; };
const admittedRow = (d, q) => ({ ok: true, product_reply: true, reply: d.spoken, outward: d.plan, admit: { disposition: 'admit' }, question: q, calls_llm: false });

T('the engine sends each spoken sentence with the atom it states; the plan exists only when the reply is the derived text', () => {
  for (const d of derived()) {
    expect(d.spoken && Array.isArray(d.atoms) && d.atoms.length, 'atoms for ' + d.q + ': ' + JSON.stringify(d));
    expect(d.plan && d.plan.schema === 'forge.outward/v1' && d.plan.sentences.map(s => s.text).join(' ') === d.spoken, 'plan joins to the reply: ' + JSON.stringify(d.plan));
    expect(d.plan.sentences[d.plan.sentences.length - 1].role === 'conclusion' && d.plan.sentences.every(s => s.atom && s.atom.args.length === 2), JSON.stringify(d.plan.sentences));
    expect(d.other === null, 'another reply gets no atoms');
  }
  const [name, owner] = derived();
  expect(JSON.stringify(owner.atoms[1].atom) === JSON.stringify({ predicate: 'owns', args: ['you', 'Rex'], polarity: 'pos' }), 'owner conclusion atom, listener deixis: ' + JSON.stringify(owner.atoms[1]));
  expect(name.atoms[0].atom.args[0] === 'your dog' && name.atoms[0].source_id, 'premise atom carries its source: ' + JSON.stringify(name.atoms[0]));
  expect(name.plan.quotes.some(q => q.text === 'My dog is Rex.' && q.source === 'phone_kb'), 'the stored sentence is kept as the cited quote: ' + JSON.stringify(name.plan.quotes));
});

T('round trip: every sentence compiles, reparseClause(R_t) states the engine atom, and R_t is spoken', () => {
  const f = kernel();
  for (const d of derived()) {
    const row = CORE.outwardCompile(admittedRow(d, d.q), { question: d.q }, f, R2);
    const oc = row.outward_compile;
    expect(row.product_reply && oc && oc.applied && oc.mode === 'compiled' && oc.calls_llm === false, d.q + ': ' + JSON.stringify(oc));
    expect(row.reply === oc.R_t && oc.R_t === d.spoken && oc.surface_changed === false, 'R_t spoken: ' + row.reply);
    for (const s of d.plan.sentences) {
      const r = f.outward(s.text, s.atom);
      expect(r.ok && r.roundtrip, s.text + ' ' + JSON.stringify(r));
      const again = f.outward(r.R_t, s.atom);
      expect(again.ok && again.R_t === r.R_t && again.material === r.material, 'R_t re-reads to the same clause and atom: ' + r.R_t);
    }
  }
});

T('a wrong atom, an unparsable sentence or a missing compiler never speaks a made-up sentence', () => {
  const f = kernel();
  const [name] = derived();
  const forged = JSON.parse(JSON.stringify(name.plan)); forged.sentences[1].atom.args[1] = 'Max';
  const held = CORE.outwardCompile(Object.assign(admittedRow(name, name.q), { outward: forged }), { question: name.q }, f, R2);
  expect(!held.product_reply && held.reply === null && held.outward_compile.rule === 'OUTWARD-COMPILE-FAIL' && held.admit.disposition === 'held', JSON.stringify(held.outward_compile));
  expect(f.outward('You own Rex.', { predicate: 'owns', args: ['you', 'Max'] }).step === 'atom', 'atom mismatch is the failed step');
  const quoted = { schema: 'forge.outward/v1', measured_text: 'Oxygen is an element with atomic weight [15.99903; 15.99977].', sentences: [{ text: 'Oxygen is an element with atomic weight [15.99903; 15.99977].', atom: null, source_id: 'a1' }], quotes: [] };
  const q = CORE.outwardCompile({ product_reply: true, reply: quoted.measured_text, outward: quoted }, { question: 'What is oxygen?' }, f, R2);
  expect(q.product_reply && q.reply === quoted.measured_text && q.outward_compile.mode === 'quoted' && q.outward_compile.sentences[0].mode === 'quoted', 'a sentence without an atom is a quote: ' + JSON.stringify(q.outward_compile));
  const oxy = 'Oxygen is an element with atomic symbol O, atomic number 8, and atomic weight [15.99903; 15.99977].';
  const direct = { schema: 'forge.outward/v1', measured_text: oxy, quotes: [], sentences: [{ text: oxy, atom: { predicate: 'is', args: ['Oxygen', oxy.slice(10, -1)], polarity: 'pos' }, source_id: 'mem:oxy', verbatim: true, role: 'conclusion' }] };
  const dq = CORE.outwardCompile({ product_reply: true, reply: oxy, outward: direct }, { question: 'What is oxygen?' }, f, R2);
  expect(dq.product_reply && dq.reply === oxy && dq.outward_compile.mode === 'quoted' && dq.outward_compile.sentences[0].step === 'parse', 'a stored sentence the grammar cannot read is its own cited quote: ' + JSON.stringify(dq.outward_compile));
  const made = JSON.parse(JSON.stringify(direct)); made.sentences[0].verbatim = false;
  const mh = CORE.outwardCompile({ product_reply: true, reply: oxy, outward: made }, { question: 'What is oxygen?' }, f, R2);
  expect(!mh.product_reply && mh.outward_compile.rule === 'OUTWARD-COMPILE-FAIL', 'a rule-made sentence that does not read holds');
  const none = CORE.outwardCompile({ product_reply: true, reply: 'Hello.' }, { question: 'Hi' }, f, R2);
  expect(none.reply === 'Hello.' && none.outward_compile.reason === 'no_atoms', 'no plan, reply as measured');
  const heldIn = { product_reply: false, reply: null };
  expect(CORE.outwardCompile(heldIn, {}, f, R2) === heldIn, 'a held row is untouched');
  expect(typeof R2.echoOf === 'function' && R2.echoOf('Who owns Rex?', 'You own Rex.').pass, 'renderer echoOf is exported for a changed surface');
});

T('wiring: the Ask path compiles after the engine, the card shows R_t with the source quotes, thresholds and the no-model guard hold', () => {
  const core = read('src/rmc_core.js'), app = read('src/app.js'), pw = read('src/panini_wording.js'), kj = read('src/kernel.js');
  expect(/RMC\.ask\(payload, opts\)\.then\(compileOut\(payload\)\)/.test(core) && /OUTWARD-COMPILE-FAIL/.test(core) && /OUTWARD-ECHO-FAIL/.test(core), 'rmc_core run');
  expect(/function outward\(text, atom\)/.test(pw) && /G\.clauseText\(c, 'kernel'\)/.test(pw) && /outward: \(t, a\) => outward\(t, a\)/.test(kj), 'compiler + kernel api');
  expect(/data-source-quote=/.test(app) && /data-outward=/.test(app) && /panini_wording\.outward/.test(app), 'card');
  const py = read('engine/rmc_engine_v1/rmc_core.py');
  expect(/"outward": _outward_plan\(reply, world\)/.test(py) && /"derived_atoms"/.test(read('engine/rmc_engine_v1/world_model_v1.py')), 'engine plan');
  const law = read('engine/rmc_engine_v1/mobile_config.py');
  expect(/"ADMIT_MAX": 0\.35,/.test(law) && /"HARD_MIN": 0\.80,/.test(law) && /"ECHO_MIN": 0\.85,/.test(law) && /"ECHO_MEMORY_MIN": 0\.97,/.test(law) && /"C_MIN": 0\.87,/.test(law), 'thresholds unchanged');
  for (const f of ['src/panini_wording.js', 'src/rmc_core.js', 'engine/rmc_engine_v1/world_model_v1.py', 'engine/rmc_engine_v1/rmc_core.py']) {
    const src = read(f);
    expect(!/\b(openai|anthropic|transformers)\b/i.test(src) && !/import\s+(torch|openai)/.test(src), 'no model: ' + f);
  }
});

T('version registry names 4.9.237', () => {
  expect(read('VERSION').trim() === '4.9.239', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.239' && reg.features.some(f => f.id === 'R4237-OUTWARD-COMPILE') && reg.count === reg.features.length, 'registry');
  const conf = read('CONFLICTS.md');
  expect(conf.indexOf('## v4.9.237') >= 0 && (conf.slice(0, conf.indexOf('## v4.9.237')).match(/^## v/gm) || []).length <= 2, 'CONFLICTS entry near the top (4.9.238 and 4.9.239 sit above)');
});

(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4237', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4237', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
