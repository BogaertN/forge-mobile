/* R4231 (4.9.231, Nic plan 229 step 3, pt258u): memory as clauses. Every memory row the Ask sends carries the kāraka clause the
 * phone's own grammar parsed from its text (src/qframe.js KQFrame.clause, forge.clause/v1); a remembered statement keeps its
 * clause in local storage. The engine holds the clauses for the turn (memory_clauses.py), and the world model's Observe meets
 * each recalled row with its clause and its placement: meaning id, phase Φ1-9, Codex band, symbolic Hz and the 144/432/1296
 * group (Nic 9:27). These checks guard the wiring; the proof is the live Ask run (CONFLICTS.md v4.9.231). */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const CLOCK = () => '2026-11-05T10:00:00Z';
const kernel = () => { const K = require(ROOT + '/src/kernel.js'), F = require(ROOT + '/src/forge.js'); return F.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: CLOCK }); };

T('a statement parses into a clause: copula predicate with its of-NP, the owner of a possessed subject, transitive karma', () => {
  const Q = require(ROOT + '/src/qframe.js'), f = kernel();
  let c = Q.clause('Paris is the capital of France.', f);
  expect(c.schema === Q.CLAUSE && c.parsed && c.kriya === 'be' && /paris/i.test(c.kartr.text) && c.pred && /capital/i.test(c.pred.text) && c.pred.of && /france/i.test(c.pred.of.text) && !c.karma && c.calls_llm === false, JSON.stringify(c));
  c = Q.clause('My dog is Rex.', f);
  expect(c.parsed && c.kartr.owner === 'user' && /rex/i.test(c.pred.text), JSON.stringify(c));
  c = Q.clause('Shakespeare wrote Hamlet.', f);
  expect(c.parsed && c.kriya === 'write' && /hamlet/i.test(c.karma.text), JSON.stringify(c));
  c = Q.clause('Paris is the capital of France. My dog is Rex.', f);
  expect(c.sentences && c.sentences.length === 2 && c.sentences.every(s => s.parsed), JSON.stringify(c));
  expect(Q.clauseCached('Paris is the capital of France.', f) === Q.clauseCached('Paris is the capital of France.', f), 'cache');
});

T('KRMCCore.run adds a clause to each memory row it can parse, keeps a stored clause, copies rows, carries the meaning id', () => {
  const vm = require('vm');
  const sent = [];
  const Q = { CLAUSE: 'forge.clause/v1', compile: t => ({ schema: 'forge.qframe/v1', text: t }), clauseCached: t => /^x/.test(t) ? { schema: 'forge.clause/v1', text: t, parsed: false } : { schema: 'forge.clause/v1', text: t, parsed: true } };
  const box = { self: { KRMC: { ask: p => { sent.push(p); return Promise.resolve({ ok: true }); } }, KQFrame: Q, forge: {} }, fetch: () => {} };
  vm.runInNewContext(read('src/rmc_core.js'), box);
  const own = { schema: 'forge.clause/v1', text: 'kept', parsed: true, mine: 1 };
  const p = { question: 'q', memory: { phone: [{ id: 'a', text: 'kept', clause: own }, { id: 'b', text: 'Paris is big' }], anchors: [{ id: 'c', text: 'Rome is old', meaning_id: 'N.ROME.city' }, { id: 'd', text: 'xyz' }], pools: [{ name: 'anchors', rows: [{ id: 'e', text: 'Oxygen is a gas' }] }] } };
  api = box.self.KRMCCore; api.run(p);
  const m = sent[0].memory;
  expect(m.phone[0].clause.mine === 1 && m.phone[1].clause.parsed, 'phone');
  expect(m.anchors[0].clause.meaning_id === 'N.ROME.city' && !m.anchors[1].clause, 'anchors');
  expect(m.pools[0].rows[0].clause.parsed, 'pools');
  expect(!p.memory.phone[1].clause && !p.memory.anchors[0].clause, 'caller rows mutated');
  expect(box.self.FORGE_LAST_CLAUSES && box.self.FORGE_LAST_CLAUSES.rows === 5 && box.self.FORGE_LAST_CLAUSES.kept === 1 && box.self.FORGE_LAST_CLAUSES.unparsed === 1, JSON.stringify(box.self.FORGE_LAST_CLAUSES));
  const app = read('src/app.js');
  expect(/KQFrame\.clause\(sentence, forge\)/.test(app) && /clause: row\.clause/.test(app), 'app stores and forwards clauses');
});
let api;

T('the engine holds the turn\'s clauses, rejects a clause parsed from other text, and Observe places every recalled row', () => {
  const py = `
import json
from rmc_engine_v1.rmc_core import run
def cl(t): return {"schema": "forge.clause/v1", "text": t.rstrip("."), "parsed": True, "kriya": "be"}
mem = {"phone": [
  {"id": "p1", "text": "Paris is the capital of France.", "clause": cl("Paris is the capital of France.")},
  {"id": "p2", "text": "My dog is Rex.", "clause": cl("Rome is old")},
  {"id": "p3", "text": "Oxygen is a gas.", "meaning_id": "N.OXYGEN.element"}]}
r = run({"question": "What is the capital of France?", "live": True, "dry_run": False, "memory": mem})
print(json.dumps(r["memory_clauses"]))`;
  const r = cp.spawnSync('python3', ['-c', py], { cwd: ROOT, env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }), encoding: 'utf8', maxBuffer: 1 << 26 });
  expect(r.status === 0, r.stderr.slice(-800));
  const mc = JSON.parse(r.stdout.trim().split('\n').pop());
  expect(mc.active && mc.rows === 3 && mc.with_clause === 2 && mc.valid === 1 && mc.rejected === 1 && mc.calls_llm === false, JSON.stringify(mc));
  const use = (mc.uses || []).find(u => u.consumer === 'world_model.observe_events');
  expect(use && use.events >= 1 && use.placed === use.events, JSON.stringify(mc.uses));
  for (const s of use.sample) {
    expect(s.Phi >= 1 && s.Phi <= 9 && s.phase_name && s.band && s.hz > 0 && [144, 432, 1296].includes(s.group) && s.phi_basis, JSON.stringify(s));
  }
  const paris = use.sample.find(s => /paris/i.test(s.text)); expect(paris && paris.clause === true, 'paris clause');
  const ox = use.sample.find(s => /oxygen/i.test(s.text)); if (ox) expect(ox.meaning_id === 'N.OXYGEN.element' && ox.clause === false, JSON.stringify(ox));
  expect(!/\b(llm|openai|anthropic|transformers)\b/i.test(read('engine/rmc_engine_v1/memory_clauses.py')), 'no model');
});

T('version registry names 4.9.231', () => {
  expect(read('VERSION').trim() === '4.9.244', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.244' && reg.features.some(f => f.id === 'R4231-MEMORY-CLAUSES') && reg.count === reg.features.length, 'registry');
});

(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4231', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4231', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
