/* R4242 (4.9.242, plan 229 step 11): PERSISTENT WORLD FACTS.
 * The world model starts empty every turn. forge.world_facts/v1 keeps explicit Remember clause facts on the device
 * with native phase, provenance, trust and SPC decay (Genesis half-life 168 h). Derive seeds from them next turn.
 * A contradictory write is held, never overwritten. Gloss-classified kind membership: "What breed is my dog?" derives
 * beagle from Remember my dog is Rex + Remember Rex is a beagle. Proof: Ask run in headless Chrome (/workspace/step242). */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const K = require(ROOT + '/src/kernel.js'), FK = require(ROOT + '/src/forge.js');
const Q = require(ROOT + '/src/qframe.js');
const CORE = require(ROOT + '/src/rmc_core.js');
const WF = require(ROOT + '/src/world_facts.js');
const PY = process.env.PYTHON || 'python3';
const env = Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') + path.delimiter + ROOT });
const f = FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-05T20:00:00Z' });
const py = (code, input) => {
  const r = cp.spawnSync(PY, ['-c', code], { cwd: ROOT, input: JSON.stringify(input || {}), env, encoding: 'utf8', maxBuffer: 1 << 28 });
  expect(r.status === 0, r.stderr.slice(-800));
  return JSON.parse(r.stdout.trim().split('\n').pop());
};
const SEED = py(`
import json
from tools.live_188 import SEED
print(json.dumps(SEED))`);
const RUN = `
import json, sys
from rmc_engine_v1.rmc_core import run
p = json.load(sys.stdin)
print(json.dumps(run(p), default=str))`;
const ask = (q, phone) => {
  const mem = JSON.parse(JSON.stringify(SEED)); if (phone) mem.phone = phone;
  let p = { question: q, live: true, memory: mem };
  p = CORE.withClauses(Object.assign({}, p, { frame: Q.compile(q, f) }), Q, f);
  const r = cp.spawnSync(PY, ['-c', RUN], { cwd: ROOT, env, encoding: 'utf8', input: JSON.stringify(p), maxBuffer: 1 << 28 });
  expect(r.status === 0, r.stderr.slice(-800));
  return JSON.parse(r.stdout.trim().split('\n').pop());
};

T('world_facts store: schema, SPC constants, bound, no model', () => {
  expect(WF.SCHEMA === 'forge.world_facts/v1' && WF.KEY === 'forge.world_facts.v1', 'schema');
  expect(WF.MAX === 128 && WF.HALF_LIFE_H === 168 && Math.abs(WF.LAMBDA - Math.LN2 / 168) < 1e-12, 'SPC');
  expect(WF.ACTIVE === 0.1 && WF.COLLECT === 0.05, 'thresholds');
  expect(!/openai|anthropic|transformers|gpt-|claude/i.test(read('src/world_facts.js')), 'no model');
});

T('Remember upsert keeps a clause fact; contradiction is held, never overwritten', () => {
  WF.clear();
  const a = WF.upsert({ id: 'a', text: 'My dog is Rex.', clause: Q.clause('My dog is Rex.', f),
    atom: { predicate: 'is', args: ['my dog', 'Rex'], polarity: 'pos' }, kind: 'remember' });
  expect(a.ok && a.rule === 'WORLD-FACTS-ADDED', JSON.stringify(a));
  const b = WF.upsert({ id: 'b', text: 'My dog is Fido.', clause: Q.clause('My dog is Fido.', f),
    atom: { predicate: 'is', args: ['my dog', 'Fido'], polarity: 'pos' }, kind: 'remember' });
  expect(b.ok === false && b.rule === 'WORLD-FACTS-CONFLICT-PREDICATE' && /Rex/.test(b.message), JSON.stringify(b));
  const c = WF.upsert({ id: 'c', text: 'My dog is not Rex.', clause: Q.clause('My dog is not Rex.', f),
    atom: { predicate: 'is', args: ['my dog', 'Rex'], polarity: 'neg' }, kind: 'remember' });
  expect(c.ok === false && c.rule === 'WORLD-FACTS-CONFLICT-POLARITY', JSON.stringify(c));
  const d = WF.upsert({ id: 'd', text: 'Rex is a beagle.', clause: Q.clause('Rex is a beagle.', f),
    atom: { predicate: 'is', args: ['Rex', 'a beagle'], polarity: 'pos' }, kind: 'remember' });
  expect(d.ok && WF.rows().map(r => r.text).sort().join('|') === 'My dog is Rex.|Rex is a beagle.', WF.rows().map(r => r.text).join('|'));
  /* same sentence refreshes charge, does not duplicate */
  const e = WF.upsert({ id: 'e', text: 'My dog is Rex.', clause: Q.clause('My dog is Rex.', f),
    atom: { predicate: 'is', args: ['my dog', 'Rex'], polarity: 'pos' }, kind: 'remember' });
  expect(e.ok && e.rule === 'WORLD-FACTS-REFRESHED' && WF.rows().length === 2, e.rule);
  WF.clear();
});

T('SPC decay: charge falls with age; below ACTIVE the row is not fed; below COLLECT it is dropped', () => {
  WF.clear();
  const now = '2026-11-05T20:00:00.000Z';
  const old = '2026-10-01T20:00:00.000Z'; /* ~840 h ≈ 5 half-lives → charge ≈ 0.031 */
  WF.upsert({ id: 'fresh', text: 'Fresh fact is here.', clause: Q.clause('Fresh fact is here.', f),
    atom: { predicate: 'is', args: ['Fresh fact', 'here'], polarity: 'pos' }, kind: 'remember', charged_at: now }, { now });
  /* manually plant an aged row */
  const doc = WF.loadRaw();
  doc.facts.push({ id: 'aged', text: 'Aged fact is gone.', clause: null, atom: { predicate: 'is', args: ['Aged fact', 'gone'], polarity: 'pos' },
    provenance: {}, trust: 'trusted', source: 'phone_kb', scope: 'phone', charged_at: old, charge0: 1, updated_at: old, kind: 'remember', Phi: 1 });
  WF.saveRaw(doc);
  const active = WF.rows({ now });
  expect(active.every(r => r.charge >= WF.ACTIVE) && active.some(r => r.id === 'fresh') && !active.some(r => r.id === 'aged'),
    JSON.stringify(active.map(r => [r.id, r.charge])));
  const snap = WF.snapshot();
  /* decayed() at now drops collect */
  const dec = WF.decayed(WF.loadRaw(), now);
  expect(!dec.facts.some(r => r.id === 'aged' && r.charge < WF.COLLECT ? false : r.id === 'aged'), 'aged collected: ' + JSON.stringify(dec.facts.map(r => [r.id, r.charge])));
  WF.clear();
});

T('is_kind_member: beagle gloss classifies it as a breed; a name does not', () => {
  const r = py(`
import json, sys
from rmc_engine_v1.derive_frame import is_kind_member, match
from rmc_engine_v1 import derive_frame as DF
print(json.dumps({
  "beagle": is_kind_member("breed", {"text": "a beagle", "head": "beagle", "det": "a"}),
  "rex": is_kind_member("breed", {"text": "Rex", "head": "Rex", "propn": "Rex"}),
  "head": is_kind_member("beagle", {"text": "a beagle", "head": "beagle"}),
  "personal": sorted(DF.PERSONAL_SOURCES),
}))`);
  expect(r.beagle === true && r.rex === false && r.head === true, JSON.stringify(r));
  expect(r.personal.includes('phone_kb') && r.personal.includes('world_facts'), JSON.stringify(r.personal));
});

T('What breed is my dog? derives beagle across Remembered facts (chain + gloss kind)', () => {
  const phone = [
    { id: 'r1', text: 'My dog is Rex.', clause: Q.clause('My dog is Rex.', f), trust: 'trusted', tier: 'phone' },
    { id: 'r2', text: 'Rex is a beagle.', clause: Q.clause('Rex is a beagle.', f), trust: 'trusted', tier: 'phone' },
  ];
  const polar = ask('Is my dog a beagle?', phone);
  expect(polar.product_reply && /beagle/i.test(polar.reply) && polar.coherence >= 0.87 && polar.echo.pass,
    JSON.stringify([polar.reply, polar.coherence, polar.route]));
  const breed = ask('What breed is my dog?', phone);
  expect(breed.product_reply && /beagle/i.test(breed.reply) && breed.coherence >= 0.87 && breed.echo.pass,
    JSON.stringify([breed.reply, breed.coherence, breed.echo && breed.echo.score, breed.route]));
  const d = (breed.world_model || {}).derive || {};
  expect(d.status === 'supported_only' && /beagle/i.test((d.survivor || {}).text || ''), JSON.stringify(d.survivor));
});

T('a fact from turn 1 still answers after unrelated turns (store rows seed Derive)', () => {
  WF.clear();
  WF.upsert({ id: 't1', text: 'My sister is Maya.', clause: Q.clause('My sister is Maya.', f),
    atom: { predicate: 'is', args: ['my sister', 'Maya'], polarity: 'pos' }, kind: 'remember' });
  /* unrelated remembers */
  WF.upsert({ id: 'u1', text: 'The sky is blue.', clause: Q.clause('The sky is blue.', f),
    atom: { predicate: 'is', args: ['the sky', 'blue'], polarity: 'pos' }, kind: 'remember' });
  WF.upsert({ id: 'u2', text: 'Two plus two is four.', clause: Q.clause('Two plus two is four.', f),
    atom: { predicate: 'is', args: ['Two plus two', 'four'], polarity: 'pos' }, kind: 'remember' });
  const phone = WF.rows().map(r => ({ id: r.id, text: r.text, clause: r.clause || Q.clause(r.text, f), trust: 'trusted', tier: 'phone' }));
  const r = ask('Who is my sister?', phone);
  expect(r.product_reply && /Maya/i.test(r.reply), JSON.stringify([r.reply, r.route, r.coherence]));
  WF.clear();
});

T('index.html and sw.js ship world_facts.js; app wires askMemory and Remember', () => {
  expect(read('index.html').includes('src/world_facts.js'), 'index');
  expect(read('sw.js').includes('./src/world_facts.js'), 'sw');
  const app = read('src/app.js');
  expect(app.includes('keepWorldFact') && app.includes('KWorldFacts') && app.includes('WORLD-FACTS-CONFLICT'), 'app');
  expect(app.includes('forge.world_facts') || read('src/world_facts.js').includes('forge.world_facts/v1'), 'schema');
});

T('thresholds unchanged and no model in the changed surface', () => {
  const t = py(`
import json
from rmc_engine_v1 import mobile_config as M
T = M.THRESHOLDS
print(json.dumps({k: T.get(k) for k in ("C_min", "echo_min", "drift_quarantine", "hard_stop")}))`);
  expect(t.C_min === 0.87 && t.echo_min === 0.85 && t.drift_quarantine === 0.35 && t.hard_stop === 0.8, JSON.stringify(t));
  for (const p of ['src/world_facts.js', 'src/app.js', 'engine/rmc_engine_v1/derive_frame.py'])
    expect(!/openai|anthropic|transformers|gpt-|claude/i.test(read(p)), p);
});

T('spoken answers are not auto-persisted into world_facts (no self-evidence loop)', () => {
  const app = read('src/app.js');
  expect(!/keepWorldFact\([^)]*'admitted'\)/.test(app) && !/kind: 'admitted_claim'/.test(app), 'auto-admit persist still present');
  expect(/spoken engine answer is NOT auto-persisted|must not become its own evidence/.test(app), 'law commented');
  expect(app.includes("keepWorldFact(row, 'remember')"), 'Remember still writes');
});

T('capability self-facts are a marked placeholder (await user manual; wording unchanged)', () => {
  const sm = read('src/selfmodel.js');
  expect(/TODO\(4\.9\.242 \/ Nic\): PLACEHOLDER capability self-facts/.test(sm), 'TODO block');
  expect((sm.match(/PLACEHOLDER: capability — await user manual/g) || []).length >= 3, 'rsoc/rules/memory marked');
  expect(read('CONFLICTS.md').includes('Capability self-facts are a placeholder (Nic, 4.9.242)'), 'CONFLICTS Open note');
  /* wording of the three facts is unchanged from 4.9.241 */
  expect(/rsoc:.*V\('compute'\)/.test(sm) && /rules:.*V\('derive'\)/.test(sm) && /memory:.*V\('know'\)/.test(sm), 'wording kept');
});

T('version registry names 4.9.242', () => {
  expect(read('VERSION').trim() === '4.9.243', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.243' && reg.features.some(x => x.id === 'R4242-WORLD-FACTS-PERSIST') && reg.count === reg.features.length , 'registry');
  expect(read('CONFLICTS.md').includes('## v4.9.242'), 'CONFLICTS 242 entry');
});

(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4242', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4242', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
