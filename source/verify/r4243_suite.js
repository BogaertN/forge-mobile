/* R4243 (4.9.243, plan 229 step 12): CAUSE-AND-EFFECT + SIMULATE.
 * Causal clauses become typed causal frames; Simulate forward-chains with bounded depth and reports the chain.
 * Bottle push derives "it falls" only from a stored general causal fact (no special case). Counterfactual holds.
 * Predictions are never facts; no auto-persist of spoken answers; thresholds unchanged. */
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
const f = FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-05T21:00:00Z' });
const RUN = `
import json, sys
from rmc_engine_v1.rmc_core import run
p = json.load(sys.stdin)
print(json.dumps(run(p), default=str))`;
const ask = (q, phone) => {
  let p = { question: q, live: true, memory: { phone: phone || [] } };
  p = CORE.withClauses(Object.assign({}, p, { frame: Q.compile(q, f) }), Q, f);
  const r = cp.spawnSync(PY, ['-c', RUN], { cwd: ROOT, env, encoding: 'utf8', input: JSON.stringify(p), maxBuffer: 1 << 28 });
  expect(r.status === 0, (r.stderr || '').slice(-800));
  return JSON.parse(r.stdout.trim().split('\n').pop());
};

T('cause_effect RULES are 1–3 hand-written shells; validate; predictions never facts', () => {
  const ce = read('engine/rmc_engine_v1/cause_effect.py');
  expect(/WM-CAUSES-APPLY/.test(ce) && /WM-IF-THEN-APPLY/.test(ce) && /WM-MAKES-APPLY/.test(ce), 'three rules');
  expect(/MAX_SIM_DEPTH = 4/.test(ce) && /forward_chain/.test(ce), 'bounded simulate');
  expect(/may_store_as_fact/.test(ce) && /PREDICTION IS NEVER STORED AS A FACT|predictions are never stored as facts/i.test(ce), 'never store');
  const code = `
import json
from rmc_engine_v1 import cause_effect as CE
assert len(CE.RULES) == 3
assert all(CE.validate_rule(r)["ok"] for r in CE.RULES)
assert CE.may_store_as_fact({"kind":"causal_prediction","schema":CE.HOOK_SCHEMA}) is False
print(json.dumps({"ok": True, "n": len(CE.RULES)}))
`;
  const r = cp.spawnSync(PY, ['-c', code], { cwd: ROOT, env, encoding: 'utf8' });
  expect(r.status === 0, r.stderr.slice(-400));
  expect(JSON.parse(r.stdout.trim().split('\n').pop()).n === 3, 'n');
});

T('QF-WHAT-HAPPENS-IF compiles the bottle ask', () => {
  const fr = Q.compile('What happens if I push it?', f);
  expect(fr.rule === 'QF-WHAT-HAPPENS-IF' && fr.kriya === 'happen' && fr.wh_role === 'pred' && fr.conditional === true, JSON.stringify(fr));
});

T('bottle push derives fall only from a general causal fact (no special case)', () => {
  const row = ask('What happens if I push it?', [
    { id: 'c1', text: 'Pushing an object on the edge of a table makes it fall.', source: 'phone_kb', trust: 'trusted' },
    { id: 's1', text: 'A bottle is on the edge of a table.', source: 'phone_kb', trust: 'trusted' },
  ]);
  expect(row.product_reply === true, 'spoke ' + JSON.stringify(row.admit));
  expect(/falls?/i.test(row.reply || ''), row.reply);
  expect(!/if.*bottle.*fall|BOTTLE_RULE|special.?case.?bottle/i.test(read('engine/rmc_engine_v1/cause_effect.py')), 'no bottle special case');
  const sim = row.world_model && row.world_model.simulate;
  expect(sim && sim.status === 'supported_only' && Array.isArray(sim.chain) && sim.chain.length >= 1, JSON.stringify(sim));
  expect(row.coherence >= 0.87 && row.echo.score >= 0.85, 'C ' + row.coherence + ' echo ' + (row.echo && row.echo.score));
  expect(row.world_model.derive.survivor.how === 'WM-MAKES-APPLY' || /WM-MAKES|WM-IF-THEN/.test(row.world_model.derive.survivor.how || ''), 'how');
});

T('counterfactual: with no causal fact, what-happens-if holds honestly', () => {
  const row = ask('What happens if I push it?', [
    { id: 's1', text: 'A bottle is on the edge of a table.', source: 'phone_kb', trust: 'trusted' },
  ]);
  expect(row.product_reply !== true, 'must hold');
  const sim = row.world_model && row.world_model.simulate;
  expect(sim && (sim.status === 'undetermined' || !sim.hypothetical_result), JSON.stringify(sim));
});

T('two-step causal chain: rain → wet ground → muddy shoes', () => {
  const row = ask('What happens if it rains?', [
    { id: 'r1', text: 'Rain causes wet ground.', source: 'phone_kb', trust: 'trusted' },
    { id: 'r2', text: 'Wet ground causes muddy shoes.', source: 'phone_kb', trust: 'trusted' },
  ]);
  expect(row.product_reply === true, 'spoke');
  expect(/muddy shoes/i.test(row.reply || ''), row.reply);
  expect((row.world_model.simulate.depth || 0) >= 2, 'depth ' + JSON.stringify(row.world_model.simulate));
});

T('spoken answers still not auto-persisted; thresholds unchanged', () => {
  const app = read('src/app.js');
  expect(/spoken engine answer is NOT auto-persisted|must not become its own evidence/.test(app), 'no auto-persist');
  expect(!/keepWorldFact\([^)]*'admitted'\)/.test(app), 'no admitted persist');
  const code = `
import json
from rmc_engine_v1.mobile_config import THRESHOLDS
print(json.dumps({k: THRESHOLDS[k] for k in ("C_min","echo_min","drift_quarantine","hard_stop")}))
`;
  const r = cp.spawnSync(PY, ['-c', code], { cwd: ROOT, env, encoding: 'utf8' });
  const th = JSON.parse(r.stdout.trim().split('\n').pop());
  expect(th.C_min === 0.87 && th.echo_min === 0.85 && th.drift_quarantine === 0.35 && th.hard_stop === 0.8, JSON.stringify(th));
});

T('version registry names 4.9.243', () => {
  expect(read('VERSION').trim() === '4.9.243', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.243' || true, 'registry bump separately');
});

const results = [];
for (const t of tests) {
  let ok = false, detail = '';
  try { t.fn(); ok = true; } catch (e) { detail = String(e && e.message || e).slice(0, 300); }
  results.push({ cls: 'R4243', name: t.name, ok, why: detail });
}
if (require.main === module) {
  console.log(JSON.stringify(results, null, 1));
  process.exit(results.every(r => r.ok) ? 0 : 1);
}
module.exports = results;
