/* R4184 (4.9.184): world-model Observe and Derive, then the EchoForge debate.
 * No LLM. C_min stays 0.87. Ask text comes from the engine renderer. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const Core = require(ROOT + '/src/rmc_core.js');
const Next = require(ROOT + '/src/next_layer.js');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };

T('copula chain carries provenance, drift, and chi, and does not lower C_min', () => {
  const row = Core.runSync({
    question: 'What is quartz?',
    live: true,
    memory: { hosted: [{ id: 'q', text: 'Quartz is a mineral.' }, { id: 'm', text: 'A mineral is a solid substance.' }] }
  });
  const seam = row.world_model;
  const survivor = seam.derive && seam.derive.survivor;
  expect(row.calls_llm === false && row.model_invoked === false && seam.calls_llm === false, 'llm');
  expect(seam.applied === true && seam.status === 'world_model_v1' && seam.writes_memory === false, JSON.stringify({ applied: seam.applied, status: seam.status }));
  expect(seam.derived_text === 'Quartz is a solid substance.', seam.derived_text);
  expect(survivor && survivor.how === 'WM-COPULA-CHAIN' && survivor.provenance.length === 2, JSON.stringify(survivor && survivor.provenance));
  expect(survivor.checker_ok === true && survivor.debate.survived === true && survivor.debate.frame === 'FR.BE.COP', JSON.stringify(survivor.debate));
  expect(survivor.drift && survivor.drift.disposition === 'clean' && survivor.drift.epsilon_s <= 0.35, JSON.stringify(survivor.drift && survivor.drift.disposition));
  expect(survivor.drift.epsilon_s > 0, 'drift was not measured');
  expect(survivor.chi && survivor.chi.christping_initiated === false && survivor.chi.status === 'CHI_T_NOT_REQUIRED', JSON.stringify(survivor.chi));
  expect(seam.christping_initiated === false && seam.simulate && seam.simulate.status === 'deferred' && seam.simulate.writes_observed === false, JSON.stringify(seam.simulate));
  expect(row.admit.thresholds.C_min === 0.87 && row.echo.min === 0.85, JSON.stringify(row.admit.thresholds));
  expect(row.coherence < 0.87 && row.admit.disposition === 'held' && row.product_reply === false && !row.reply, 'C ' + row.coherence);
  expect(row.coherence_components && row.coherence_components.formula && /0\.24\*memory_fit/.test(row.coherence_components.formula), JSON.stringify(row.coherence_components));
});

T('a conflict is not rendered as either side', () => {
  const row = Core.runSync({
    question: 'What is quartz?',
    live: true,
    memory: { hosted: [{ id: 'a', text: 'Quartz is a mineral.' }, { id: 'b', text: 'Quartz is not a mineral.' }] }
  });
  expect(row.world_model.derive.status === 'conflicted' && row.world_model.derived_text === '', JSON.stringify(row.world_model.derive.status));
  expect(row.world_model.derive.claims.every(c => c.debate.survived === false), 'conflict survived');
  expect(row.product_reply === false && !row.reply, 'spoken');
  expect(row.late_stages[0].reason === 'conflicted_derivation_not_rendered', row.late_stages[0].reason);
});

T('quarantined web text is not a premise', () => {
  const row = Core.runSync({
    question: 'What is quartz?',
    live: true,
    memory: { research: [{ id: 'web', text: 'Quartz is a hard crystalline mineral made of silicon dioxide.' }] }
  });
  expect(row.world_model.derived_text === '' && row.product_reply === false, 'quarantine spoken');
  expect(row.world_model.observe.quarantined >= 1 && row.world_model.observe.admitted === 0, JSON.stringify(row.world_model.observe));
});

T('a self-fact can be superseded and the parent root is kept', () => {
  const row = Core.runSync({
    question: 'What is quartz?',
    live: true,
    memory: { hosted: [{ id: 'e', text: 'World Model owns checked proofs and admitted facts.' }] }
  });
  const facts = (row.world_model.world && row.world_model.world.facts) || [];
  const self = facts.find(f => f.id === 'self:world-model');
  expect(self && self.status === 'superseded', JSON.stringify(self));
  expect(row.world_model.observe.superseded >= 1 && row.world_model.parent_root, JSON.stringify(row.world_model.observe));
  expect(row.world_model.writes_durable_memory === false, 'durable');
});

T('the independent checker rejects a tampered proof and no socket is opened', () => {
  const script = `
import socket
class Guard(socket.socket):
    def connect(self, *a, **k):
        raise RuntimeError("network_blocked")
    def connect_ex(self, *a, **k):
        raise RuntimeError("network_blocked")
socket.socket = Guard
def _blocked(*a, **k):
    raise RuntimeError("network_blocked")
socket.create_connection = _blocked
from rmc_engine_v1.world_model_v1 import check_proof, empty_world, seed_self_facts, observe, derive, _active, _direct_proof, run_world_model
base, _ = seed_self_facts(empty_world())
world, _ = observe(base, [{"id":"q","text":"Quartz is a mineral.","quarantined":False,"confidence":"medium_high","prior_drift_score":0}])
fact = [f for f in _active(world) if not f.get("self_fact")][0]
proof = _direct_proof(world, fact)
ok = check_proof(world, proof)["ok"] is True
bad = dict(proof)
bad["conclusion"] = {"predicate":"is","args":["Quartz","a gas"],"polarity":"pos"}
refused = check_proof(world, bad)["ok"] is False
row = run_world_model("What is quartz?", {"nodes":[{"id":"q","text":"Quartz is a mineral.","confidence":"medium_high","prior_drift_score":0}], "active":1})
print(__import__("json").dumps({"ok": ok, "refused": refused, "llm": row["calls_llm"], "ping": row["christping_initiated"]}))
`;
  const out = cp.execFileSync('python3', ['-c', script], { cwd: ROOT, env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }), encoding: 'utf8' });
  const row = JSON.parse(out.trim().split('\n').pop());
  expect(row.ok === true && row.refused === true && row.llm === false && row.ping === false, JSON.stringify(row));
});

T('new engine modules do not name a model API', () => {
  const files = ['language_core_debate.py', 'world_model_v1.py', 'reasoning_seam.py'];
  const banned = /openai|anthropic|ollama|huggingface|gemini|mistral|completions|api\.x\.ai|httpx|urllib\.request|requests\.(get|post)/i;
  for (const name of files) {
    const src = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', name), 'utf8');
    expect(!banned.test(src), name);
    expect(/calls_llm/.test(src) || name === 'reasoning_seam.py', name);
  }
});

T('Ask shows the engine reply only', () => {
  const app = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
  const say = app.slice(app.indexOf('async function say'), app.indexOf('function renderRmc'));
  expect(!/forge\.process\(/.test(say), 'forge.process');
  expect(/data-answer-source/.test(say) && /rmc_engine_v1\.output_renderer/.test(say), 'source attribute');
  expect(/admitted \? esc\(row\.reply\)/.test(say), 'reply is the engine string');
  expect(!/Quartz is a/.test(say), 'canned sentence in ask');
  expect(/data-stage-derive/.test(app) && /data-stage-debate/.test(app) && /data-stage-observe/.test(app), 'trace stages');
});

T('version registry names 4.9.184', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.184', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.184/.test(conf) && /Observe/.test(conf) && /C_min stays 0\.87/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.184/.test(nb) && /WIRING_184/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.184/.test(readme) && /WIRING_184/.test(readme), 'README');
  const doc = fs.readFileSync(path.join(ROOT, '..', 'docs', 'WIRING_184.md'), 'utf8');
  expect(/Observe/.test(doc) && /Derive/.test(doc) && /EchoForge/.test(doc) && /1g2034-K/.test(doc) && /1vBx_Q9K/.test(doc) && /0\.87/.test(doc), 'WIRING');
  const live = fs.readFileSync(path.join(ROOT, '..', 'docs', 'LIVE_TEST_184.md'), 'utf8');
  expect(/60/.test(live) && /C_min/.test(live) && /0\.87/.test(live), 'LIVE');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.184' && tgt.suites[0] === 'r4184_suite.js', JSON.stringify({ release: tgt.release, head: tgt.suites[0] }));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.184' && reg.features.some(f => f.id === 'R4184-WORLD-MODEL') && reg.count === reg.features.length, reg.version + ' ' + reg.count);
  expect(Next.SWITCHES.dream_idle === false && Next.SWITCHES.economy === false, JSON.stringify(Next.SWITCHES));
});

(async () => {
  let failed = 0;
  const rows = [];
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4184', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4184', name: t.name, ok: false, why: String(e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
