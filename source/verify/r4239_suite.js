/* R4239 (4.9.239, Nic 2026-11-05 12:15 CST): "Phase is a retrieval discriminator, not a substitute for semantic evidence."
 * Semantic support, structural coherence and phase compatibility are separate measurements. ΔΦ (to the retrieval operation,
 * Φ7) is recorded on every candidate and every answer as its own signal, breaks ties among equally supported rows, never
 * vetoes, never lowers support, and is not folded into C. The proof is the A/B Ask run in headless Chrome
 * (/workspace/step239/experiment.md, CONFLICTS.md v4.9.239). */
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
const PY = process.env.PYTHON || 'python3';
const env = Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') + path.delimiter + ROOT });
const f = FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-05T12:00:00Z' });
const py = (code, input) => {
  const r = cp.spawnSync(PY, ['-c', code], { cwd: ROOT, input: JSON.stringify(input || {}), env, encoding: 'utf8', maxBuffer: 1 << 28 });
  expect(r.status === 0, r.stderr.slice(-800));
  return JSON.parse(r.stdout.trim().split('\n').pop());
};
/* one Ask through the phone frame + clauses and the engine, with a phone memory row whose stored phase we choose */
const RUN = `
import json, sys
from tools.live_188 import SEED
from rmc_engine_v1.rmc_core import run
p = json.load(sys.stdin)
print(json.dumps(run(p), default=str))`;
const ask = (q, phone) => {
  const mem = py(`
import json
from tools.live_188 import SEED
print(json.dumps(SEED))`);
  mem.phone = phone;
  let p = { question: q, live: true, memory: mem };
  p = CORE.withClauses(Object.assign({}, p, { frame: Q.compile(q, f) }), Q, f);
  return py(RUN, p);
};
const row = (phi) => [{ id: 'rem-dog', text: 'My dog is Rex.', scope: 'phone', sfe: { Phi: phi, eps: 0.0, mu: 1.0 }, provenance: { requested_by: 'user', request: 'remember_command', kind: 'statement' } }];

T('the same memory stored at two phases gets the same support, C and answer; only its phase signal differs', () => {
  const a = ask("What is my dog's name?", row(9)), b = ask("What is my dog's name?", row(3));
  const sa = a.signals, sb = b.signals;
  expect(sa && sb && sa.schema === 'forge.answer_signals/v1', JSON.stringify(sa).slice(0, 300));
  expect(/Rex/.test(a.reply || '') && a.coherence >= 0.87, 'answered: ' + JSON.stringify([a.reply, a.coherence]));
  expect(a.reply === b.reply && a.coherence === b.coherence && sa.semantic_support.min === sb.semantic_support.min, JSON.stringify({ a: [a.reply, a.coherence, sa.semantic_support.min], b: [b.reply, b.coherence, sb.semantic_support.min] }));
  expect(sa.phase_compatibility.veto === false && sa.phase_compatibility.in_C === false && sa.phase_compatibility.role === 'tie_breaker', 'role');
  expect(JSON.stringify(sa.phase_compatibility.rows) !== JSON.stringify(sb.phase_compatibility.rows), 'the phase signal is measured, so it differs: ' + JSON.stringify([sa.phase_compatibility.min_A, sb.phase_compatibility.min_A]));
});

T('every recall candidate carries its semantic basis and its own phase signal; equally supported rows are ordered by A', () => {
  const r = py(`
import json
from rmc_engine_v1.resonance_recall import rank_memory
base = {"tier": "anchor", "source_kind": "anchor", "trust": "trusted", "provenance": {"source": "fixture"}}
t = "Burkina Faso is a landlocked country in West Africa."
rows = [dict(base, id="p3", memory_id="p3", text=t, sfe={"Phi": 3, "eps": 0.0, "mu": 1.0}), dict(base, id="p7", memory_id="p7", text=t, sfe={"Phi": 7, "eps": 0.0, "mu": 1.0})]
out = rank_memory("What is Burkina Faso?", rows, {"phase_state": {"phase_primary": 9}})
print(json.dumps({"cands": out["candidate_signals"], "active": [(a["memory_id"], a["retrieval_weight"], a["signals"]) for a in out["active"]], "rule": out["phase_rule"]}))`);
  expect(r.cands.length === 2 && r.cands.every(c => c.semantic_basis && c.phase_compatibility && c.phase_compatibility.veto === false && c.phase_compatibility.in_C === false), JSON.stringify(r.cands).slice(0, 400));
  const c7 = r.cands.find(c => c.memory_id === 'p7'), c3 = r.cands.find(c => c.memory_id === 'p3');
  expect(c7.chosen && !c3.chosen && c7.phase_compatibility.A === 1 && c3.phase_compatibility.A < 0.05, 'A breaks the tie');
  expect(r.active[0][0] === 'p7' && r.active[0][1] === 1 && r.active[0][2].semantic_support === 1, JSON.stringify(r.active).slice(0, 300));
  expect(/tie/.test(r.rule) && /never vetoes/.test(r.rule) && /not folded into C/.test(r.rule), r.rule);
});

T('no support weight reads the phase gap: hop and premise weights are context (rpm) and frame gate (S·C)', () => {
  const rr = read('engine/rmc_engine_v1/resonance_recall.py'), wc = read('engine/rmc_engine_v1/world_claim_measure.py');
  const hop = rr.slice(rr.indexOf('def _hop_weight_op'), rr.indexOf('def _phase_signal'));
  expect(hop && !/_grace\(packet, anchor_phi\)/.test(hop) && /rpm/.test(hop), 'hop weight');
  const pn = wc.slice(wc.indexOf('def _premise_node'), wc.indexOf('    return {', wc.indexOf('def _premise_node')));
  expect(/derive\.gate\.S·C/.test(pn) && !/gate\.get\("G"\)/.test(pn) && !/cos/.test(pn.replace(/#.*$/gm, '')), 'premise weight');
  const r = py(`
import json
from rmc_engine_v1.resonance_recall import _hop_weight_op
a = {"memory_id": "a", "packet": {"Phi": 9, "eps": 0.0, "mu": 1.0}}
near = {"memory_id": "n", "packet": {"Phi": 9, "eps": 0.0, "mu": 1.0}}
far = {"memory_id": "f", "packet": {"Phi": 4, "eps": 0.0, "mu": 1.0}}
spent = {"memory_id": "s", "packet": {"Phi": 9, "eps": 0.5, "mu": 1.0}}
print(json.dumps([_hop_weight_op(n, [a], 7) for n in (near, far, spent)]))`);
  expect(r[0] === 1 && r[1] === 1 && r[2] === 0, JSON.stringify(r));
});

T('thresholds unchanged and no model', () => {
  const t = py(`
import json
from rmc_engine_v1 import mobile_config as M
T = M.THRESHOLDS
print(json.dumps({k: T.get(k) for k in ("C_min", "echo_min", "drift_quarantine", "hard_stop")}))`);
  expect(t.C_min === 0.87 && t.echo_min === 0.85 && t.drift_quarantine === 0.35 && t.hard_stop === 0.8, JSON.stringify(t));
  for (const p of ['engine/rmc_engine_v1/resonance_recall.py', 'engine/rmc_engine_v1/world_claim_measure.py', 'engine/rmc_engine_v1/rmc_core.py'])
    expect(!/openai|anthropic|transformers|gpt-|claude/i.test(read(p)), p);
});

T('version registry names 4.9.239', () => {
  expect(read('VERSION').trim() === '4.9.247', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.247' && reg.features.some(x => x.id === 'R4239-SEPARATE-SIGNALS') && reg.count === reg.features.length, 'registry');
  expect(read('CONFLICTS.md').includes('## v4.9.239') >= 0 && (read('CONFLICTS.md').slice(0, read('CONFLICTS.md').includes('## v4.9.239')).match(/^## v/gm) || []).length <= 5, 'CONFLICTS entry near the top (4.9.240–4.9.247 sit above)');
});

(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4239', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4239', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
