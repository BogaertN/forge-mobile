/* R4244 (4.9.244, plan 229 step 12b): LITERAL BACKEND SIMULATION ROUTER.
 * A what-happens-if question compiles (engine sim_scene, kāraka: kriyā / karma / adhikaraṇa / point) into a physical
 * scene; the backend Simulation Router (server/sim_router: MuJoCo rigid body, SymPy symbolic) steps it and returns a
 * FORGE-SIM-RECEIPT/v1; Simulate consumes the receipt as a measured causal premise (WM-SOLVER-RECEIPT), checker
 * replays it (sha256 + effect), Echo/C/drift gate unchanged. No bottle / top / bottom special case; no model;
 * receipts are never stored. MuJoCo solver tests run only where the wheel is installed (the CI lock has no MuJoCo). */
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
const f = FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-05T23:00:00Z' });
const py = code => { const r = cp.spawnSync(PY, ['-c', code], { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 1 << 26 }); expect(r.status === 0, (r.stderr || '').slice(-800)); return JSON.parse(r.stdout.trim().split('\n').pop()); };
const RUN = `
import json, sys
from rmc_engine_v1.rmc_core import run
p = json.load(sys.stdin)
print(json.dumps(run(p), default=str))`;
const ask = (q, simulation) => {
  let p = { question: q, live: true, memory: { phone: [], simulation: simulation || [] } };
  p = CORE.withClauses(Object.assign({}, p, { frame: Q.compile(q, f) }), Q, f);
  const r = cp.spawnSync(PY, ['-c', RUN], { cwd: ROOT, env, encoding: 'utf8', input: JSON.stringify(p), maxBuffer: 1 << 28 });
  expect(r.status === 0, (r.stderr || '').slice(-800));
  return JSON.parse(r.stdout.trim().split('\n').pop());
};
const FIX = JSON.parse(read('server/sim_router/receipts_244.json')).receipts;
const TOP = 'What happens if you push a bottle near the top?', BOTTOM = 'What happens if you push a bottle near the bottom?';
const THROW = 'What happens if you throw a ball at 30 degrees at 20 meters per second?';
const HAS_MUJOCO = cp.spawnSync(PY, ['-c', 'import mujoco, sympy'], { encoding: 'utf8' }).status === 0;

T('scene compiler: kāraka slots, sourced defaults, holds name the missing slot; no outcome in the compiler', () => {
  const out = py(`
import json
from rmc_engine_v1.sim_scene import compile_scene as c
qs = ["${TOP}", "${BOTTOM}", "What happens if you push a wide flat block near the top on ice?", "What happens if you push a bottle?", "What happens if I push it?", "What happens if you push a piano near the top?", "What happens if you throw a ball?"]
print(json.dumps([c(q) for q in qs]))`);
  expect(out[0].ok && out[0].action === 'push' && out[0].body.noun === 'bottle' && out[0].point.name === 'top' && out[0].karaka.kriya === 'push', JSON.stringify(out[0]).slice(0, 300));
  expect(out[1].ok && out[1].point.fraction < out[0].point.fraction && out[0].intervention_key !== out[1].intervention_key, 'bottom');
  expect(out[2].ok && out[2].surface.name === 'ice' && out[2].body.width > 0.2 && out[2].body.height < 0.2, 'adjectives + surface');
  expect(!out[3].ok && out[3].missing === 'point' && !out[4].ok && out[4].missing === 'karma' && !out[5].ok && out[5].reason === 'unknown_body' && !out[6].ok, 'holds');
  const src = read('engine/rmc_engine_v1/sim_scene.py');
  expect(!/topple|slide/.test(src.replace(/^"""[\s\S]*?"""/, '')), 'the compiler names no outcome');
  const D = JSON.parse(read('engine/rmc_engine_v1/physical_defaults.json'));
  expect(/engineeringtoolbox\.com/.test(D.sources.friction) && D.gravity === 9.80665, 'sourced defaults');
});

T('router contract: pluggable solvers (NAME/HANDLES/solve), receipt sha256, no model, no secret', () => {
  const r = read('server/sim_router/router.py'), s = read('server/sim_router/serve.py');
  expect(/SOLVERS: (list|dict)/.test(r) && /FORGE-SIM-RECEIPT\/v1/.test(r) && /sha256/.test(r), 'contract');
  for (const p of ['server/sim_router/solvers/mujoco_rigid.py', 'server/sim_router/solvers/sympy_math.py']) {
    const t = read(p); expect(/^NAME = /m.test(t) && /^HANDLES = /m.test(t) && /def solve\((scene|problem)/.test(t), p);
  }
  const all = r + s + read('server/sim_router/solvers/mujoco_rigid.py') + read('server/sim_router/solvers/sympy_math.py');
  expect(!/openai|anthropic|transformers|llama|sb_secret_|service_role/i.test(all), 'no model, no secret');
  for (const q of [TOP, BOTTOM, THROW]) expect(FIX[q] && FIX[q].ok && /^[0-9a-f]{64}$/.test(FIX[q].sha256) && FIX[q].rows[0].source === 'sim_receipt', q);
  expect(FIX[TOP].outcome === 'topple' && FIX[BOTTOM].outcome === 'slide' && FIX[TOP].primary_solver === 'mujoco_rigid' && FIX[THROW].primary_solver === 'sympy_math', 'recorded outcomes');
});

T('MuJoCo + SymPy really step the scene (where the wheels are installed)', () => {
  if (!HAS_MUJOCO) return; // CI lock has no MuJoCo wheel; the recorded receipts above carry the run
  const out = py(`
import json
from server.sim_router import router
qs = ["${TOP}", "${BOTTOM}", "What happens if you push a bottle near the top on ice?", "What happens if you push a wide flat block near the top?", "What happens if you drop a ball from 20 meters?", "${THROW}"]
print(json.dumps([{"o": r.get("outcome"), "m": (r.get("run") or {}).get("measurements")} for r in (router.route(q) for q in qs)], default=str))`);
  expect(out[0].o === 'topple' && out[1].o === 'slide' && out[2].o === 'slide' && out[3].o === 'slide' && out[4].o === 'fall' && out[5].o === 'land', JSON.stringify(out.map(x => x.o)));
  /* 4.9.245: the router reuses engine sim_device; MuJoCo free fall is checked against sqrt(2h/g) directly */
  expect(Math.abs(Math.sqrt(2 * 20 / 9.80665) - out[4].m.first_contact_s) < 0.02, 'MuJoCo free fall agrees with sqrt(2h/g)');
});

T('Ask: a receipt for this intervention is spoken (C ≥ 0.87, Echo ≥ 0.85); top and bottom differ only by the solver', () => {
  const top = ask(TOP, FIX[TOP].rows), bot = ask(BOTTOM, FIX[BOTTOM].rows), thr = ask(THROW, FIX[THROW].rows);
  for (const [row, eff] of [[top, 'The bottle topples.'], [bot, 'The bottle slides.']]) {
    expect(row.product_reply === true && row.reply.includes(eff) && row.coherence >= 0.87 && row.echo.score >= 0.85 && row.drift <= 0.35, JSON.stringify({ r: row.reply, c: row.coherence, e: row.echo && row.echo.score, d: row.drift }));
    expect((row.world_model.simulate || {}).rules_fired.includes('WM-SOLVER-RECEIPT'), 'rule');
  }
  expect(thr.product_reply === true && /lands .* meters away/.test(thr.reply), thr.reply);
});

T('honest holds: no receipt, a receipt for another intervention, or a receipt without its sha256', () => {
  expect(ask(TOP, []).product_reply === false, 'no receipt');
  expect(ask(TOP, FIX[BOTTOM].rows).product_reply === false, 'wrong scene');
  const forged = JSON.parse(JSON.stringify(FIX[TOP].rows)); forged[0].sim.sha256 = 'x';
  expect(ask(TOP, forged).product_reply === false, 'forged receipt');
});

T('phone: router only for what-happens-if; https or localhost only; receipts never stored; laws unchanged', () => {
  const app = read('src/app.js');
  expect(/async function simulateViaRouter/.test(app) && /memory\.simulation = simReceipt\.rows/.test(app) && /\^https:/.test(app), 'client');
  expect(!/keepWorldFact\([^)]*sim/i.test(app) && !/simulation[^\n]*world_facts/.test(app), 'never stored');
  const T_ = py(`
import json
from rmc_engine_v1.mobile_config import THRESHOLDS as T
print(json.dumps({k: T.get(k) for k in ("C_min", "echo_min", "drift_quarantine", "hard_stop")}))`);
  expect(T_.C_min === 0.87 && T_.echo_min === 0.85 && T_.drift_quarantine === 0.35 && T_.hard_stop === 0.8, JSON.stringify(T_));
});

T('version, registry, CONFLICTS name 4.9.244', () => {
  expect(read('VERSION').trim() === '4.9.249', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.249' && reg.features.some(x => x.id === 'R4244-SIM-ROUTER') && reg.count === reg.features.length, 'registry');
  expect(read('CONFLICTS.md').includes('## v4.9.244'), 'CONFLICTS');
});

const results = [];
for (const t of tests) {
  let ok = false, detail = '';
  try { t.fn(); ok = true; } catch (e) { detail = String(e && e.message || e).slice(0, 600); }
  results.push({ cls: 'R4244', name: t.name, ok, why: detail });
}
if (require.main === module) {
  console.log(JSON.stringify(results, null, 1));
  process.exit(results.every(r => r.ok) ? 0 : 1);
}
module.exports = results;
