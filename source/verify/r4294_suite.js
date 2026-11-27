/* 4.9.282: continuous outputs get a quantitative fit. A missing SciPy still seals the closed form. */
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const S = require(ROOT + '/src/sim_receipts.js');
const M = require(ROOT + '/src/mechanisms.js');
const env = Object.assign({}, process.env, { PYTHONPATH: [path.join(ROOT, 'engine'), ROOT, path.join(ROOT, '_mathlibs')].join(path.delimiter) });
function py(code) {
  const proc = cp.spawnSync('python3', ['-c', code], { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 1 << 24, timeout: 120000 });
  if (proc.status !== 0) throw new Error((proc.stderr || proc.stdout || 'python').slice(-700));
  return JSON.parse(proc.stdout.trim().split('\n').pop());
}
function register(C, expect) {
  C('R4294', 'kinetics seals without scipy, and a continuous fit reports what each solver supports', () => {
    const blocked = py(`
import builtins, json
real = builtins.__import__
def block(name, *a, **k):
    if name == 'scipy' or name.startswith('scipy.') or name == 'numpy' or name.startswith('numpy.'):
        raise ImportError('blocked')
    return real(name, *a, **k)
builtins.__import__ = block
from rmc_engine_v1.sim_device import _solve_kinetics
run = _solve_kinetics({"k": 0.2, "c0": 1.0, "t": 8, "order": 1})
print(json.dumps({"engine": run["engine"], "left": run["measurements"]["concentration_left"], "closed": run["measurements"]["closed_form"]}))
`);
    expect(blocked.engine === 'closed form' && Math.abs(blocked.left - blocked.closed) < 1e-6, JSON.stringify(blocked));
    S.clear();
    const grid = py(`
import json
from rmc_engine_v1.sim_device import solve, seal
jobs = []
for body in ("earth", "jupiter"):
  for alt in (200000, 400000, 800000, 1200000):
    jobs.append({"solver":"astronomy_ondevice","family":"astronomy","body":body,"altitude_m":alt,"question":"orbit"})
for k, c0, t in ((0.05, 1.0, 4), (0.1, 1.0, 10), (0.2, 2.0, 5), (0.4, 1.5, 3), (0.15, 0.8, 12), (0.3, 1.2, 6), (0.08, 2.5, 8), (0.25, 0.5, 9)):
  jobs.append({"solver":"chemistry_kinetics","family":"chemistry","k":k,"c0":c0,"t":t,"order":1,"question":"kin"})
for target, boil in ((10, 100), (40, 100), (90, 100), (150, 100), (30, 80), (110, 120)):
  jobs.append({"solver":"thermal_ondevice","family":"physics","substance":"sample","target_c":target,"boil_c":boil,"melt_c":0,"room_c":20,"c":4180,"question":"heat"})
for v, r in ((5, 100), (5, 200), (10, 100), (10, 400), (12, 150), (9, 300), (3, 100), (15, 500)):
  net = "* FORGE single\\nV1 in 0 DC %g\\nR1 in 0 %g\\n.op\\n.end\\n" % (v, r)
  jobs.append({"solver":"circuits_wasm","family":"circuits","topology":"single","V":v,"R":r,"netlist":net,"question":"ohm"})
rows = []
for p in jobs:
  run = solve(p)
  rec = seal(p, run)
  rows.append(rec)
print(json.dumps(rows))
`);
    grid.forEach(rec => { const put = S.record(rec); expect(put.ok === true, JSON.stringify(put)); });
    const fit = M.fitContinuous(S.list());
    function best(solver, output) {
      return (fit.proposals || []).filter(p => p.solver === solver && p.output === output).sort((a, b) => a.heldRel - b.heldRel)[0] || null;
    }
    const orbit = (fit.proposals || []).find(p => p.solver === 'astronomy_ondevice' && p.output === 'speed_m_s' && /gm_m3_s2/.test(p.expression) && /orbit_radius_m/.test(p.expression));
    const kin = best('chemistry_kinetics', 'concentration_left');
    expect(orbit && orbit.fact === false && orbit.heldRel <= 0.02 && /gm_m3_s2/.test(orbit.expression) && /orbit_radius_m/.test(orbit.expression) && Math.abs(orbit.scale - 1) < 0.01, JSON.stringify(orbit));
    expect(kin && kin.form === 'exponential' && kin.fact === false && kin.heldRel <= 0.02 && /c0/.test(kin.expression) && Math.abs(kin.scale + 1) < 0.02, JSON.stringify(kin));
    const circuit = (fit.proposals || []).find(p => p.solver === 'circuits_wasm' && p.output === 'source_current_a' && /V/.test(p.expression) && /R/.test(p.expression));
    const circuitN = S.list().filter(r => r.solver === 'circuits_wasm').length;
    if (circuitN >= 6) expect(circuit && circuit.fact === false && circuit.heldRel <= 0.02 && Math.abs(circuit.scale - 1) < 0.02, JSON.stringify(circuit || { receipts: circuitN, proposals: (fit.proposals || []).filter(p => p.solver === 'circuits_wasm') }));
    const gap = M.boundaryInputs(S.list().filter(r => r.solver === 'thermal_ondevice'));
    expect(gap.present.length === 0 && gap.absent.indexOf('pressure') >= 0 && gap.absent.indexOf('solute') >= 0, JSON.stringify(gap));
    S.clear();
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 900); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
