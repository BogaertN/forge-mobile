/* R4245 (4.9.245, plan 229 step 12c): SEVEN ON-DEVICE SIMULATOR FAMILIES + HOME PC SLOT.
 * engine sim_device compiles a question into FORGE-SIM-PROBLEM/v1 (family, solver, runtime, packages, quantities; no
 * answer), the phone measures it (Pyodide SymPy / SciPy / Biopython / astropy; WASM MuJoCo / RDKit / ngspice in
 * src/sim_wasm_worker.js, pinned SHA-384, lazy, cached, local override), and sim_device.seal returns a sha256
 * FORGE-SIM-RECEIPT/v1 whose rows are this turn's premises. Heavy CFD / ab initio go to the optional Home PC Simulator
 * (forge.sim_router) or hold. Recorded receipts (server/sim_router/receipts_245.json, headless Chrome on the static
 * site) re-seal to the same sha256 from the recorded measurements. No model; nothing stored; laws unchanged. */
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
const pyIn = (code, input) => { const r = cp.spawnSync(PY, ['-c', code], { cwd: ROOT, env, encoding: 'utf8', input: input || '', maxBuffer: 1 << 28 }); expect(r.status === 0, (r.stderr || '').slice(-800)); return JSON.parse(r.stdout.trim().split('\n').pop()); };
const has = mods => cp.spawnSync(PY, ['-c', 'import ' + mods], { encoding: 'utf8' }).status === 0;
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
const FIX = JSON.parse(read('server/sim_router/receipts_245.json')).receipts;
const QS = Object.keys(FIX);
const byS = s => QS.filter(q => FIX[q].ok && FIX[q].primary_solver === s);

T('plan: each family compiles to its solver and runtime; heavy asks are home_pc; holds name the missing slot', () => {
  const out = pyIn(`
import json, sys
from rmc_engine_v1.sim_device import plan
print(json.dumps([plan(q) for q in json.load(sys.stdin)]))`, JSON.stringify(QS.concat(['What happens if you push a bottle?', 'What happens if you translate the DNA?', 'What happens if a satellite orbits Earth?', 'What is the molecular weight of unobtainium?'])));
  const want = { mujoco_wasm: 'wasm', sympy_pyodide: 'pyodide', chemistry_ondevice: 'pyodide', chemistry_kinetics: 'pyodide', rdkit_wasm: 'wasm', biology_ondevice: 'pyodide', biology_kinetics: 'pyodide', astronomy_ondevice: 'pyodide', quantum_ondevice: 'pyodide', circuits_wasm: 'wasm', openfoam_cfd: 'home_pc', pyscf_abinitio: 'home_pc' };
  const seen = new Set();
  QS.forEach((q, i) => { const p = out[i]; const fx = FIX[q]; expect(p.ok && p.solver === (fx.problem || {}).solver && want[p.solver] === p.runtime, q + ' ' + JSON.stringify(p).slice(0, 200)); seen.add(p.solver); expect(!('outcome' in p) && !('effect_text' in p), 'a plan holds no answer'); });
  expect(Object.keys(want).every(s => seen.has(s)), 'all twelve solvers exercised: ' + [...seen].join(','));
  const [a, b, c, d] = out.slice(QS.length);
  expect(!a.ok && a.missing === 'point' && !b.ok && b.missing === 'sequence' && !c.ok && c.missing === 'altitude' && !d.ok && d.reason === 'unknown_substance', JSON.stringify([a, b, c, d].map(x => x.reason)));
});

T('recorded receipts re-seal to the same sha256 from the recorded measurements (WASM: from the raw engine output)', () => {
  const out = pyIn(`
import json, sys
from rmc_engine_v1 import sim_device as S
fx = json.load(sys.stdin)
res = {}
for q, r in fx.items():
    if not r.get("ok"):
        continue
    a = S.seal(r["problem"], r["run"])["sha256"] == r["sha256"]
    b = S.seal(r["problem"], S.finish(r["problem"], r["raw"]))["sha256"] == r["sha256"] if r.get("raw") else None
    res[q] = [a, b, r["rows"][0]["source"], len(r["sha256"])]
print(json.dumps(res))`, JSON.stringify(FIX));
  for (const [q, [a, b, src, n]] of Object.entries(out)) expect(a === true && b !== false && src === 'sim_receipt' && n === 64, q + ' ' + JSON.stringify([a, b]));
  expect(Object.keys(out).length >= 19, 'receipts: ' + Object.keys(out).length);
});

T('the measured values are physics/chemistry, not strings: topple/slide/stay split by solver, balanced equations, orbit, Born, divider', () => {
  const R = q => FIX[q];
  expect(R('What happens if you push a bottle near the top?').outcome === 'topple' && R('What happens if you push a bottle near the bottom?').outcome === 'slide' && R('What happens if you push a bottle near the top on ice?').outcome === 'slide' && R('What happens if you push a bottle near the bottom on rubber?').outcome === 'stay' && R('What happens if you push a wide flat block near the top?').outcome === 'slide', 'rigid outcomes');
  expect(R('What happens if you push a bottle near the top?').run.measurements.final_tilt_deg > 60 && R('What happens if you push a bottle near the bottom?').run.measurements.horizontal_displacement_m > 0.02, 'measured');
  expect(R('What happens when hydrogen reacts with oxygen?').run.measurements.equation === '2 H2 + O2 -> 2 H2O' && R('What happens if you burn methane?').run.measurements.equation === 'CH4 + 2 O2 -> CO2 + 2 H2O', 'balanced');
  const cf = R('What is the molecular weight of caffeine?').run.measurements; expect(cf.formula === 'C8H10N4O2' && Math.abs(cf.average_mw - 194.19) < 0.01 && cf.heavy_atoms === 14 && cf.table_formula_agrees, JSON.stringify(cf));
  const orb = R('What happens if a satellite orbits Earth at 400 km?').run.measurements; expect(Math.abs(orb.period_min - 92.56) < 0.05 && Math.abs(orb.speed_km_s - 7.67) < 0.01, JSON.stringify(orb));
  expect(R('What happens if you apply a Pauli-X gate to a qubit in state 0?').run.measurements.p1 === 1 && R('What happens if you apply a Hadamard gate to a qubit in state 0?').run.measurements.p0 === 0.5, 'Born');
  expect(R('What happens if you put 10 volts across a 1k and 1k voltage divider?').run.measurements.v_out === 5 && /ngspice/.test(R('What happens if you put 10 volts across a 1k and 1k voltage divider?').run.engine), 'divider');
  expect(R('What happens if a ribosome translates the DNA ATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG?').run.measurements.protein === 'MAIVMGR', 'translation');
  const src = read('engine/rmc_engine_v1/sim_device.py');
  expect(!/MAIVMGR|C8H10N4O2|92\.5|2 H2 \+ O2/.test(src), 'no answer is written in the engine');
});

T('Python families compute live in CPython (where the packages are installed) and agree with the phone', () => {
  const avail = { sympy_pyodide: has('sympy'), chemistry_ondevice: has('sympy'), chemistry_kinetics: has('scipy'), biology_kinetics: has('scipy'), quantum_ondevice: has('scipy'), biology_ondevice: has('Bio'), astronomy_ondevice: has('astropy') };
  const qs = QS.filter(q => FIX[q].ok && avail[FIX[q].primary_solver]);
  if (!qs.length) return;
  const out = pyIn(`
import json, sys
from rmc_engine_v1 import sim_device as S
print(json.dumps({q: S.solve(S.plan(q)) for q in json.load(sys.stdin)}, default=str))`, JSON.stringify(qs));
  for (const q of qs) { const a = out[q].measurements, b = FIX[q].run.measurements; for (const k of Object.keys(b)) if (typeof b[k] === 'number') expect(Math.abs(a[k] - b[k]) <= 1e-3 * Math.max(1, Math.abs(b[k])), q + ' ' + k + ' ' + a[k] + ' vs ' + b[k]); }
});

T('Ask: recorded receipts are spoken through the full chain (C ≥ 0.87, Echo ≥ 0.85, drift ≤ 0.35), one per family', () => {
  const pick = ['What happens if you push a bottle near the top?', 'What happens if you throw a ball at 30 degrees at 20 m/s?', 'What happens when hydrogen reacts with oxygen?', 'What is the molecular formula of aspirin?', 'What happens if a ribosome translates the DNA ATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG?', 'What happens if a satellite orbits Earth at 400 km?', 'What happens if you apply a Hadamard gate to a qubit in state 0?', 'What happens if you put 10 volts across a 1k and 1k voltage divider?'];
  for (const q of pick) {
    const row = ask(q, FIX[q].rows);
    expect(row.product_reply === true && row.coherence >= 0.87 && row.echo.score >= 0.85 && row.drift <= 0.35 && row.reply.includes(FIX[q].effect_text.replace(/\.$/, '')), q + ' ' + JSON.stringify({ r: row.reply, c: row.coherence, e: row.echo && row.echo.score, d: row.drift }));
  }
});

T('honest holds: no receipt, a receipt for another intervention, a forged sha256', () => {
  const q = 'What happens if a satellite orbits Earth at 400 km?';
  expect(ask(q, []).product_reply === false, 'no receipt');
  expect(ask(q, FIX['What happens if you apply a Hadamard gate to a qubit in state 0?'].rows).product_reply === false, 'wrong receipt');
  const forged = JSON.parse(JSON.stringify(FIX[q].rows)); forged[0].sim.sha256 = 'x';
  expect(ask(q, forged).product_reply === false, 'forged');
  for (const h of ['What happens if you run a CFD simulation of airflow over a car at 30 m/s?', 'What happens if you run Hartree-Fock on water?']) expect(FIX[h].ok === false && FIX[h].home_pc_required === true && FIX[h].reason === 'home_pc_required', h);
});

T('phone: pinned lazy WASM (exact versions, SHA-384, Cache API, local override), same-origin module worker, Home PC setting', () => {
  const w = read('src/sim_wasm_worker.js'), d = read('src/sim_device.js'), pw = read('src/py_worker.js');
  for (const [p, n] of [['@mujoco/mujoco@3.17.0/mujoco.js', 1], ['@mujoco/mujoco@3.17.0/mujoco.wasm', 1], ['@rdkit/rdkit@2026.9.2/dist/RDKit_minimal.js', 1], ['@rdkit/rdkit@2026.9.2/dist/RDKit_minimal.wasm', 1], ['eecircuit-engine@1.9.0/dist/eecircuit-engine.mjs', 1]]) expect(w.split(p).length - 1 === n, p);
  expect((w.match(/sri: 'sha384-[A-Za-z0-9+/]{64}'/g) || []).length === 5 && /integrity_mismatch/.test(w) && /forge-sim-v1/.test(w) && /integrity: a\.sri/.test(w), 'pins + check + cache');
  expect(/forge\.sim_assets/.test(d) && /forge\.sim_router/.test(d) && /type: 'module'/.test(d) && /\/v1\/health/.test(d) && /Test Connection/.test(d) && /Clear/.test(d) && /Home PC Simulator \(Optional\)/.test(d), 'client + settings');
  expect(/loadPackage\(todo, \{ checkIntegrity: true \}\)/.test(pw) && /cmd === 'sim'/.test(pw), 'pyodide lock packages');
  const idx = read('index.html'), sw = read('sw.js'), b = read('build.py');
  expect(/<script src="src\/sim_device\.js"><\/script>/.test(idx) && /id="homePcSim"/.test(idx) && /sim_wasm_worker\.js/.test(sw) && /sim_device\.js/.test(sw) && /KSIM_NO_WASM_WORKER/.test(b), 'wired');
  const csp = (idx.match(/Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
  expect(!/unsafe-eval'/.test(csp.replace("'wasm-unsafe-eval'", '')) && !/script-src[^;]*\*/.test(csp) && /connect-src[^;]*http:\/\/localhost:\*/.test(csp) && !/connect-src[^;]* http:(?:\s|;)/.test(csp), csp);
  const tracked = cp.spawnSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).stdout || '';
  expect(!/\.wasm$/m.test(tracked), 'no .wasm in git');
});

T('Home PC Simulator: openfoam / pyscf slots run when installed, else a structured hold with an install command', () => {
  const r = read('server/sim_router/router.py'), of = read('server/sim_router/solvers/openfoam_cfd.py'), ps = read('server/sim_router/solvers/pyscf_abinitio.py'), rd = read('server/sim_router/README.md');
  expect(/sim_device/.test(r) && /def health/.test(r) && /install/.test(r), 'router uses the same plan/seal');
  expect(/def installed/.test(of) && /simpleFoam/.test(of) && /def installed/.test(ps) && /scf\.RHF/.test(ps) && /b3lyp/.test(ps), 'slots');
  expect(/pip install pyscf/.test(rd) && /openfoam/i.test(rd) && /Home PC Simulator/.test(rd) && !/cloud run|gcloud/i.test(rd), 'README');
  const all = r + of + ps + read('engine/rmc_engine_v1/sim_device.py') + read('src/sim_device.js') + read('src/sim_wasm_worker.js');
  expect(!/openai|anthropic|transformers|llama|sb_secret_|service_role/i.test(all), 'no model, no secret');
  const out = pyIn(`
import json
from server.sim_router import router as R
print(json.dumps({"h": R.health(), "cfd": R.route("What happens if you run a CFD simulation of airflow over a car at 30 m/s?")}, default=str))`);
  expect(out.h.ok && out.h.solvers.some(s => s.name === 'openfoam_cfd') && out.h.solvers.some(s => s.name === 'pyscf_abinitio'), 'health');
  expect(out.cfd.ok ? /iterations/.test(out.cfd.effect_text) : (out.cfd.home_pc_required && out.cfd.install), JSON.stringify(out.cfd).slice(0, 300));
});

T('laws unchanged; receipts never stored; version, registry, CONFLICTS name 4.9.245', () => {
  const app = read('src/app.js');
  expect(/KSimDevice\.simulate\(qtext\)/.test(app) && /memory\.simulation = simReceipt\.rows/.test(app) && !/keepWorldFact\([^)]*sim/i.test(app), 'turn-only');
  const T_ = pyIn(`
import json
from rmc_engine_v1.mobile_config import THRESHOLDS as T
print(json.dumps({k: T.get(k) for k in ("C_min", "echo_min", "drift_quarantine", "hard_stop")}))`);
  expect(T_.C_min === 0.87 && T_.echo_min === 0.85 && T_.drift_quarantine === 0.35 && T_.hard_stop === 0.8, JSON.stringify(T_));
  expect(read('VERSION').trim() === '4.9.246', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.246' && reg.features.some(x => x.id === 'R4245-SIM-ONDEVICE') && reg.count === reg.features.length, 'registry');
  expect(read('CONFLICTS.md').startsWith('## v4.9.246'), 'CONFLICTS');
});

const results = [];
for (const t of tests) {
  let ok = false, detail = '';
  try { t.fn(); ok = true; } catch (e) { detail = String(e && e.message || e).slice(0, 600); }
  results.push({ cls: 'R4245', name: t.name, ok, why: detail });
}
if (require.main === module) {
  console.log(JSON.stringify(results, null, 1));
  process.exit(results.every(r => r.ok) ? 0 : 1);
}
module.exports = results;
