/* R4234 (4.9.234, Nic plan 229 step 6, 10:06): RMC runs into the world model in series. The RMC reading (C, ε, route) is
 * passed to the world model as its upstream; the sentence the world model speaks is measured by the same kernel
 * (measure_candidate + coherence_components, weights unchanged) against its own recalled premises and routed by the same
 * router, and the Ask gate (C, Echo, drift) scores that reading, not the orchestrator's other candidate. Thresholds unchanged.
 * These checks guard the wiring; the proof is the live Ask run (CONFLICTS.md v4.9.234). */
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
const py = (code, input) => {
  const r = cp.spawnSync(process.env.PYTHON || 'python3', ['-c', code], { cwd: ROOT, input: JSON.stringify(input), env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') + path.delimiter + ROOT }), encoding: 'utf8', maxBuffer: 1 << 26 });
  expect(r.status === 0, r.stderr.slice(-800));
  return JSON.parse(r.stdout.trim().split('\n').pop());
};
const FACTS = ['A whale is a mammal.', 'A mammal is an animal.', 'An animal is a living thing.', 'Shakespeare wrote Hamlet.'];
const RUN = `
import json, sys
from rmc_engine_v1.rmc_core import run
c = json.load(sys.stdin)
out = []
for q, f in zip(c["qs"], c["frames"]):
    mem = {"phone": [{"id": "p%d" % i, "text": t, "scope": "phone", "clause": cl} for i, (t, cl) in enumerate(zip(c["texts"], c["clauses"]))]}
    r = run({"question": q, "live": True, "frame": f, "memory": mem})
    a = r.get("admit") or {}
    out.append({"q": q, "reply": r.get("reply"), "C": r.get("coherence"), "eps": r.get("drift"), "route": r.get("route"),
                "scored": a.get("scored"), "scored_reading": a.get("scored_reading"), "orch": a.get("orchestrator_reading"),
                "disposition": a.get("disposition"), "wm": r.get("world_model_measure"), "spoken": (r.get("world_model") or {}).get("derived_text")})
print(json.dumps(out))`;
const ask = qs => {
  const Q = require(ROOT + '/src/qframe.js'), f = kernel();
  return py(RUN, { texts: FACTS, clauses: FACTS.map(t => Q.clause(t, f)), qs, frames: qs.map(q => Q.compile(q, f)) });
};
let CACHE = null;
const asked = () => (CACHE = CACHE || ask(['Is a whale a living thing?', 'Who wrote Hamlet?']));

T('the gate scores the world model\'s spoken chain: its own C, ε and route, with the RMC upstream recorded beside it', () => {
  const [whale] = asked();
  const m = whale.wm;
  expect(m && m.spoken === whale.spoken && /A whale is a living thing\.$/.test(m.spoken), 'measured what it speaks: ' + JSON.stringify(m && m.spoken));
  expect(whale.scored === 'world_model' && whale.C === m.C && whale.eps === m.epsilon_s && whale.route === m.route, 'gate reads the world-model measure ' + JSON.stringify(whale));
  expect(m.upstream && typeof m.upstream.C === 'number' && typeof m.upstream.epsilon_s === 'number' && m.upstream.route, 'RMC upstream passed in series ' + JSON.stringify(m.upstream));
  expect(whale.orch && typeof whale.orch.coherence === 'number', 'the orchestrator reading is kept beside it');
  const hops = m.sentences.filter(s => s.role === 'hop'), concl = m.sentences.filter(s => s.role === 'conclusion');
  expect(hops.length === 3 && concl.length === 1 && m.C === Math.min.apply(null, hops.map(h => h.C)), 'C = min over spoken hops');
  expect(m.epsilon_s === Math.max.apply(null, m.sentences.map(s => s.epsilon_s)), 'ε = max over every spoken sentence');
  expect(m.checker_ok === true && m.formula.indexOf('0.24*memory_fit') === 0, 'checker replay and the unchanged kernel formula');
  for (const p of m.premises) expect(typeof p.retrieval_weight === 'number' && p.retrieval_weight_basis, 'each premise weight is measured with its basis ' + JSON.stringify(p));
  // the 0.87 line decides; nothing is loosened: spoken iff C >= 0.87 under a clean drift region
  expect((whale.reply !== null) === (whale.C >= 0.87 && whale.eps <= 0.35), 'admitted exactly by the real gate ' + JSON.stringify({ C: whale.C, eps: whale.eps, reply: whale.reply }));
});

T('a single recalled fact spoken by the world model is scored on its own row and still admitted at 0.87', () => {
  const [, ham] = asked();
  expect(ham.scored === 'world_model' && ham.wm && ham.wm.sentences.length === 1 && ham.wm.sentences[0].role === 'hop', JSON.stringify(ham));
  expect((ham.reply === 'Shakespeare wrote Hamlet.') === (ham.C >= 0.87 && ham.eps <= 0.35), 'admitted exactly by the real gate ' + JSON.stringify({ C: ham.C, eps: ham.eps, reply: ham.reply }));
  const s = read('engine/rmc_engine_v1/rmc_core.py');
  expect(/would_speak = rendered if rendered else _candidate_text\(report\)/.test(s) && /gate\["scored"\] = scored_by/.test(s), 'dry run scores the sentence it would speak, the same way');
});

T('thresholds are unchanged and no model is called', () => {
  const dp = read('engine/rmc_engine_v1/drift_policy.py');
  expect(/^C_MIN = 0\.87$/m.test(read('engine/rmc_engine_v1/drift_v43.py')) && /min\(0\.35,/.test(dp) && /eps >= 0\.80/.test(dp), 'C_min 0.87, drift 0.35 / 0.80');
  const src = read('engine/rmc_engine_v1/world_claim_measure.py');
  expect(/measure_candidate/.test(src) && /coherence_components/.test(src) && /route_candidate/.test(src), 'the same kernel and router');
  expect(!/\b(llm|openai|anthropic|transformers)\b/i.test(src.replace(/calls_llm|LLM/g, '')), 'no model');
});

T('version registry names 4.9.234', () => {
  expect(read('VERSION').trim() === '4.9.247', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.247' && reg.features.some(f => f.id === 'R4234-WORLD-MODEL-IN-SERIES') && reg.count === reg.features.length, 'registry');
});

(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4234', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4234', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
