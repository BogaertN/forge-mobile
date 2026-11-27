/* 4.9.292: problem quantities join the receipt, and the same search reads each solver. */
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const S = require(ROOT + '/src/sim_receipts.js');
const M = require(ROOT + '/src/mechanisms.js');
const env = Object.assign({}, process.env, { PYTHONPATH: [path.join(ROOT, 'engine'), ROOT, path.join(ROOT, '_mathlibs')].join(path.delimiter) });
function py(code, arg) {
  const proc = cp.spawnSync('python3', ['-c', code, arg == null ? '' : JSON.stringify(arg)], { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 1 << 24, timeout: 180000 });
  if (proc.status !== 0) throw new Error((proc.stderr || proc.stdout || 'python').slice(-500));
  return JSON.parse(proc.stdout.trim().split('\n').pop());
}
function outcomeOf(problem) {
  return py('import json,sys\nfrom rmc_engine_v1.sim_device import solve\nprint(json.dumps(solve(json.loads(sys.argv[1])).get("outcome")))', problem);
}
function register(C, expect) {
  C('R4293', 'each solver keeps its quantities, and the search reports a law or an honest miss', () => {
    S.clear();
    M.clear();
    const grid = py(`
import json
from rmc_engine_v1.sim_device import solve, seal
jobs = []
for rho_b in (200, 600, 1400, 2400):
  for rho_f in (800, 1000, 1300):
    jobs.append({"solver":"buoyancy_ondevice","family":"physics","patient":"sample","fluid":"water","rho_body":rho_b,"rho_fluid":rho_f,"question":"buoy"})
for target in (10, 40, 90, 150):
  for boil in (70, 100, 130):
    jobs.append({"solver":"thermal_ondevice","family":"physics","substance":"sample","target_c":target,"boil_c":boil,"melt_c":-20,"room_c":20,"c":4000,"question":"heat"})
for alt in (150000, 300000, 600000, 900000):
  jobs.append({"solver":"astronomy_ondevice","family":"astronomy","body":"earth","altitude_m":alt,"question":"orbit"})
for k, t in ((0.05, 4), (0.2, 8), (0.8, 3), (1.2, 12)):
  jobs.append({"solver":"chemistry_kinetics","family":"chemistry","k":k,"c0":1.0,"t":t,"order":1,"question":"kin"})
for reactants, products in ((["H2","O2"],["H2O"]), (["C","O2"],["CO2"]), (["N2","H2"],["NH3"])):
  jobs.append({"solver":"chemistry_ondevice","family":"chemistry","reactants":reactants,"products":products,"reaction_class":"combination","question":"react"})
for v, r, cap in ((5, 1000, 1e-6), (12, 2200, 1e-6), (9, 470, 2e-6)):
  tt = 5 * r * cap
  net = "* FORGE RC\\nV1 in 0 PWL(0 0 1n %g)\\nR1 in out %g\\nC1 out 0 %g IC=0\\n.tran %g %g 0 %g uic\\n.end\\n" % (v, r, cap, tt/500, tt, tt/500)
  jobs.append({"solver":"circuits_wasm","family":"circuits","topology":"rc","V":v,"R":r,"C":cap,"t":tt,"netlist":net,"question":"rc"})
rows, errors = [], []
for i, p in enumerate(jobs):
  try:
    run = solve(p)
    if run.get("error") or not run.get("outcome"):
      errors.append({"solver": p["solver"], "error": run.get("error") or "no_outcome"})
      continue
    rec = seal(p, run)
    rec["receipt_id"] = rec.get("receipt_id") or ("sim-solver-%d" % i)
    rows.append(rec)
  except Exception as e:
    errors.append({"solver": p["solver"], "error": str(e)[:180]})
print(json.dumps({"rows": rows, "errors": errors}))
`, null);
    const packed = grid.rows ? grid : { rows: grid, errors: [] };
    packed.rows.forEach(rec => {
      const put = S.record(rec);
      expect(put.ok === true && put.fact === false, JSON.stringify(put));
    });
    const found = M.induce(S.list());
    function summarize(solver) {
      const receipts = S.list().filter(r => r.solver === solver);
      const props = (found.proposals || []).filter(p => p.solver === solver);
      const best = props.slice().sort((a, b) => (b.fullAcc || 0) - (a.fullAcc || 0) || (b.heldAcc || 0) - (a.heldAcc || 0))[0] || null;
      const quantities = receipts[0] && receipts[0].scene && receipts[0].scene.quantities;
      return {
        solver: solver, receipts: receipts.length, outcomes: receipts.map(r => r.outcome).filter((y, i, a) => a.indexOf(y) === i),
        quantities: quantities, best: best && { expression: best.expression, heldAcc: best.heldAcc, fullAcc: best.fullAcc, status: best.status, pi: best.pi === true },
        admitted: false
      };
    }
    const buoyancy = summarize('buoyancy_ondevice');
    const thermal = summarize('thermal_ondevice');
    const orbit = summarize('astronomy_ondevice');
    const kinetics = summarize('chemistry_kinetics');
    expect(buoyancy.receipts === 12 && buoyancy.quantities.rho_body.unit === 'kg/m^3' && buoyancy.quantities.rho_fluid.unit === 'kg/m^3', JSON.stringify(buoyancy));
    expect(thermal.receipts === 12 && thermal.quantities.target_c.unit === 'celsius' && thermal.quantities.boil_c.unit === 'celsius', JSON.stringify(thermal.quantities));
    expect(orbit.receipts === 4 && orbit.quantities.altitude_m.unit === 'm' && orbit.outcomes.length === 1 && !orbit.best, JSON.stringify(orbit));
    const kineticErrors = (packed.errors || []).filter(e => e.solver === 'chemistry_kinetics');
    expect(kinetics.receipts === 4 || kineticErrors.length === 4, JSON.stringify({ kinetics: kinetics, errors: kineticErrors }));
    if (kinetics.receipts) expect(kinetics.outcomes.length === 1 && !kinetics.best, JSON.stringify(kinetics));
    const reaction = summarize('chemistry_ondevice');
    const circuit = summarize('circuits_wasm');
    const reactionErrors = (packed.errors || []).filter(e => e.solver === 'chemistry_ondevice');
    expect(reaction.receipts === 3 || reactionErrors.length === 3, JSON.stringify({ reaction: reaction, errors: reactionErrors }));
    if (reaction.receipts) expect(reaction.outcomes.join() === 'react' && !reaction.best, JSON.stringify(reaction));
    const circuitErrors = (packed.errors || []).filter(e => e.solver === 'circuits_wasm');
    expect(circuit.receipts === 3 || circuitErrors.length === 3, JSON.stringify({ circuit: circuit, errors: circuitErrors }));
    if (circuit.receipts) expect(circuit.outcomes.join() === 'solve' && !circuit.best && circuit.quantities.V.unit === 'V' && circuit.quantities.R.unit === 'ohm', JSON.stringify(circuit));
    function admit(summary, probe) {
      const proposal = (found.proposals || []).find(p => p.solver === summary.solver && p.status === 'proposal' && p.expression === (summary.best && summary.best.expression));
      if (!proposal) return summary;
      const sample = S.list().find(r => r.id === proposal.train[0]);
      const checked = M.validate(proposal, sample, probe);
      summary.admitted = checked.ok === true && checked.fact === false;
      summary.status = checked.status;
      return summary;
    }
    admit(buoyancy, vals => outcomeOf({ solver: 'buoyancy_ondevice', patient: 'sample', fluid: 'water', rho_body: vals.rho_body, rho_fluid: vals.rho_fluid, question: 'probe' }));
    admit(thermal, vals => outcomeOf({ solver: 'thermal_ondevice', substance: 'sample', target_c: vals.target_c, boil_c: vals.boil_c, melt_c: -20, room_c: 20, c: 4000, question: 'probe' }));
    expect(buoyancy.admitted === true && /rho_body/.test(buoyancy.best.expression) && /rho_fluid/.test(buoyancy.best.expression) && buoyancy.best.heldAcc >= 0.75, JSON.stringify(buoyancy));
    expect(thermal.best && thermal.best.expression === 'target_c/boil_c' && thermal.best.heldAcc === 1 && thermal.admitted === false && thermal.status === 'refuted', JSON.stringify(thermal));
    const kept = M.admitted();
    expect(kept.some(r => r.solver === 'buoyancy_ondevice' && r.fact === false) && !kept.some(r => r.solver === 'astronomy_ondevice') && !kept.some(r => r.solver === 'chemistry_kinetics'), JSON.stringify(kept.map(r => r.solver + ':' + r.expression)));
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
