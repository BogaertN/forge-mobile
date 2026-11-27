/* 4.9.286: a push ramps with weight. The first limit it crosses, friction or restoring torque, is the outcome. */
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const S = require(ROOT + '/src/sim_receipts.js');
function register(C, expect) {
  C('R4287', 'a compound measurement keeps both units', () => {
    expect(S.unitFor('speed_km_s').unit === 'km/s' && S.unitFor('orbit_radius_km').unit === 'km' && S.unitFor('period_min').unit === 'min', JSON.stringify(S.unitFor('speed_km_s')));
  });
  C('R4287', 'the push ramps with weight and the first measured limit is the reason', () => {
    const code = `
import json
from rmc_engine_v1.sim_device import plan, solve, seal, tip_check, mujoco_job
qs = [
  "What happens if you push a bottle near the top?",
  "What happens if you push a bottle near the bottom?",
  "What happens if you push a bottle near the top on ice?",
  "What happens if you push a wide flat block near the top?"
]
rows = []
for q in qs:
    p = plan(q)
    job = mujoco_job(p["scene"])
    run = solve(p)
    rec = seal(p, run)
    chk = (tip_check(p["scene"]) or {}).get("outcome")
    rows.append({"q": q, "outcome": run.get("outcome"), "tip": chk, "why": rec.get("causal_reason"),
                 "event": (run.get("measurements") or {}).get("first_event"),
                 "ramp": job.get("ramp"), "force": job.get("force")})
print(json.dumps(rows))
`;
    const env = Object.assign({}, process.env, { PYTHONPATH: [path.join(ROOT, 'engine'), ROOT, path.join(ROOT, '_mathlibs')].join(path.delimiter) });
    const proc = cp.spawnSync('python3', ['-c', code], { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 1 << 26 });
    expect(proc.status === 0, (proc.stderr || '').slice(-500));
    const rows = JSON.parse(proc.stdout.trim().split('\n').pop());
    rows.forEach(row => {
      expect(row.ramp === true && row.force === 0, JSON.stringify(row));
      expect(row.outcome === row.tip, row.q + ' ' + JSON.stringify(row));
    });
    const top = rows[0];
    const bottom = rows[1];
    expect(top.outcome === 'topple' && /torque about the edge exceeds the restoring torque/.test(top.why), JSON.stringify(top));
    expect(bottom.outcome === 'slide' && /contact force exceeds the friction limit/.test(bottom.why), JSON.stringify(bottom));
    const src = require('fs').readFileSync(path.join(ROOT, 'engine/rmc_engine_v1/sim_device.py'), 'utf8');
    const job = src.slice(src.indexOf('def mujoco_job'), src.indexOf('def classify_rigid'));
    expect(/ramp=True/.test(job) && !/f_slip/.test(job) && !/f_tip/.test(job), 'the live job does not choose the force from the slip and tip formulas');
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 800); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
