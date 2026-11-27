/* 4.9.273: an admitted mechanism answers inside its tested range. A sim runs only outside it, and that receipt refits the law. */
const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const S = require(ROOT + '/src/sim_receipts.js');
const M = require(ROOT + '/src/mechanisms.js');
function register(C, expect) {
  C('R4290', 'an admitted mechanism is used inside its range and refused outside it', () => {
    S.clear();
    M.clear();
    let i = 0;
    for (const height of [0.2, 0.4]) for (const radius of [0.03, 0.06]) for (const mu of [0.2, 0.5]) for (const fraction of [0.2, 0.9]) {
      const value = fraction * height * mu / radius;
      S.record({
        ok: true, may_store_as_fact: false, receipt_id: 'sim-range-' + i, sha256: 'sha-range-' + i,
        outcome: value > 1 ? 'topple' : 'slide', primary_solver: 'mujoco_wasm',
        problem: { solver: 'mujoco_wasm', scene: { action: 'push', body: { noun: 'sample', shape: 'cylinder', height: height, radius: radius, mass: 0.5 }, surface: { name: 'table', mu: mu }, point: { fraction: fraction }, gravity: 9.80665 } },
        spoken_atoms: []
      });
      i++;
    }
    const found = M.induce(S.list());
    const proposal = found.proposals.find(p => p.expression === '(fraction*height*mu)/radius');
    expect(!!proposal, JSON.stringify(found.proposals.map(p => p.expression)));
    const sample = S.list().find(r => r.id === proposal.train[0]);
    const checked = M.validate(proposal, sample, vals => (vals.fraction * vals.height * vals.mu / vals.radius) > 1 ? 'topple' : 'slide');
    expect(checked.ok === true && checked.fact === false, JSON.stringify(checked));
    M.reload();
    const law = M.admitted().find(r => r.expression === '(fraction*height*mu)/radius');
    expect(law && typeof law._eval !== 'function' && law.fact === false, 'reloaded without a stored function');
    const inside = { fraction: 0.5, height: 0.3, mu: 0.35, radius: 0.045 };
    const got = M.apply(law, inside);
    const expectOutcome = (0.5 * 0.3 * 0.35 / 0.045) > law.threshold ? law.above : law.below;
    expect(got.applied === true && got.outcome === expectOutcome && got.fact === false && got.method === 'learned_mechanism', JSON.stringify(got));
    expect(got.trace.every(row => row.unit) && (got.assumptions || []).length === 4, JSON.stringify({ trace: got.trace, assumptions: got.assumptions }));
    expect(got.atom && got.atom.predicate === 'exceed', JSON.stringify(got.atom));
    const outside = M.apply(law, { fraction: 0.05, height: 0.3, mu: 0.35, radius: 0.045 });
    expect(outside.applied === false && outside.reason === 'out_of_range' && outside.variable.name === 'fraction', JSON.stringify(outside));
    const scene = { action: 'push', body: { noun: 'canister', shape: 'cylinder', height: 0.3, radius: 0.045, mass: 0.5 }, surface: { name: 'table', mu: 0.35 }, point: { fraction: 0.5 } };
    const decision = M.prepare({ solver: 'mujoco_wasm', scene: scene }, M.admitted());
    expect(decision.applied === true && decision.mode === 'derive', JSON.stringify(decision && { applied: decision.applied, mode: decision.mode, outcome: decision.outcome }));
    const far = M.prepare({ solver: 'mujoco_wasm', scene: { body: { height: 0.3, radius: 0.045 }, surface: { mu: 0.35 }, point: { fraction: 0.05 } } }, M.admitted());
    expect(far.mode === 'simulate' && far.reason === 'out_of_range', JSON.stringify(far && { mode: far.mode, reason: far.reason }));
    const code = `
import json, sys
from rmc_engine_v1.sim_device import plan, derive_mechanism
law = json.loads(sys.argv[1])
derived = json.loads(sys.argv[2])
p = plan("What happens if you push a bottle near the top?")
p["scene"]["body"]["height"] = 0.3
p["scene"]["body"]["radius"] = 0.045
p["scene"]["surface"]["mu"] = 0.35
p["scene"]["point"]["fraction"] = 0.5
out = derive_mechanism(p, law, derived)
mech = out.get("mechanism") or {}
print(json.dumps({"ok": out.get("ok"), "method": out.get("method"), "fact": out.get("may_store_as_fact"), "why": out.get("causal_reason"), "effect": out.get("effect_text"), "outcome": out.get("outcome"), "trace": mech.get("trace"), "assumptions": mech.get("assumptions"), "derived": (out.get("run") or {}).get("derived")}))
`;
    const env = Object.assign({}, process.env, { PYTHONPATH: [path.join(ROOT, 'engine'), ROOT, path.join(ROOT, '_mathlibs')].join(path.delimiter) });
    const proc = cp.spawnSync('python3', ['-c', code, JSON.stringify(law), JSON.stringify(got)], { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 1 << 24 });
    expect(proc.status === 0, (proc.stderr || '').slice(-600));
    const sealed = JSON.parse(proc.stdout.trim().split('\n').pop());
    expect(sealed.ok === true && sealed.method === 'learned_mechanism' && sealed.fact === false && sealed.derived === true, JSON.stringify(sealed));
    expect(sealed.outcome === got.outcome && /exceed/i.test(sealed.why) && !/torque about the edge/.test(sealed.why), JSON.stringify(sealed));
    expect(sealed.trace && sealed.trace.some(row => row.unit === 'm') && sealed.trace.some(row => row.unit === '1'), JSON.stringify(sealed.trace));
    expect((sealed.assumptions || []).length >= 4, JSON.stringify(sealed.assumptions));
    const before = law.range.fraction.max;
    S.record({
      ok: true, may_store_as_fact: false, receipt_id: 'sim-range-far', sha256: 'sha-range-far',
      outcome: (0.95 * 0.3 * 0.35 / 0.045) > 1 ? 'topple' : 'slide', primary_solver: 'mujoco_wasm',
      problem: { solver: 'mujoco_wasm', scene: { action: 'push', body: { noun: 'sample', shape: 'cylinder', height: 0.3, radius: 0.045, mass: 0.5 }, surface: { name: 'table', mu: 0.35 }, point: { fraction: 0.95 }, gravity: 9.80665 } },
      spoken_atoms: []
    });
    const grown = M.refit(S.list());
    M.reload();
    const wider = M.admitted().find(r => r.expression === '(fraction*height*mu)/radius');
    expect(grown.changed === true && wider && wider.range.fraction.max >= 0.95 && wider.range.fraction.max > before && wider.fact === false, JSON.stringify({ grown: grown, max: wider && wider.range.fraction.max, before: before }));
    S.record({
      ok: true, may_store_as_fact: false, receipt_id: 'sim-range-miss', sha256: 'sha-range-miss',
      outcome: 'stay', primary_solver: 'mujoco_wasm',
      problem: { solver: 'mujoco_wasm', scene: { action: 'push', body: { noun: 'sample', shape: 'cylinder', height: 0.3, radius: 0.045, mass: 0.5 }, surface: { name: 'table', mu: 0.35 }, point: { fraction: 0.5 }, gravity: 9.80665 } },
      spoken_atoms: []
    });
    const dropped = M.refit(S.list());
    M.reload();
    expect(dropped.changed === true && !M.admitted().some(r => r.expression === '(fraction*height*mu)/radius'), JSON.stringify(dropped));
    const src = fs.readFileSync(path.join(ROOT, 'src/sim_device.js'), 'utf8');
    const body = src.slice(src.indexOf('async function simulate'), src.indexOf('function propertyHold'));
    expect(body.indexOf('KMechanisms.prepare') >= 0 && body.indexOf('KMechanisms.prepare') < body.indexOf("wasmCall('mujoco'"), 'mechanism before the sim');
    expect(body.indexOf("out.method !== 'learned_mechanism'") >= 0 && body.indexOf('KMechanisms.refit') >= 0, 'a derivation is not stored; an out-of-range sim refits');
    expect(fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8').includes('data-learned-mechanism'), 'label');
    expect(fs.readFileSync(path.join(ROOT, 'engine/rmc_engine_v1/sim_device.py'), 'utf8').includes('def derive_mechanism'), 'seal');
    S.clear();
    M.clear();
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 900); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
