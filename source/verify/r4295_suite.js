/* 4.9.292: idle admits a quantitative law, and a later ask inside the range uses it. */
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const S = require(ROOT + '/src/sim_receipts.js');
const M = require(ROOT + '/src/mechanisms.js');
const D = require(ROOT + '/src/dream_idle.js');
const env = Object.assign({}, process.env, { PYTHONPATH: [path.join(ROOT, 'engine'), ROOT, path.join(ROOT, '_mathlibs')].join(path.delimiter) });
function py(code, arg) {
  const proc = cp.spawnSync('python3', ['-c', code, arg == null ? '' : JSON.stringify(arg)], { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 1 << 24, timeout: 120000 });
  if (proc.status !== 0) throw new Error((proc.stderr || proc.stdout || 'python').slice(-700));
  return JSON.parse(proc.stdout.trim().split('\n').pop());
}
function register(C, expect) {
  C('R4295', 'idle keeps a quantitative law and Derive uses it inside the tested range', () => {
    S.clear();
    M.clear();
    const grid = py(`
import json
from rmc_engine_v1.sim_device import solve, seal
jobs = []
for v, r in ((4, 100), (6, 150), (8, 200), (9, 120), (11, 180), (5, 220), (10, 330), (12, 250)):
  net = "* FORGE single\\nV1 in 0 DC %g\\nR1 in 0 %g\\n.op\\n.end\\n" % (v, r)
  jobs.append({"solver":"circuits_wasm","family":"circuits","topology":"single","V":v,"R":r,"netlist":net,"question":"ohm"})
rows = []
for p in jobs:
  run = solve(p)
  if run.get("error") or not run.get("outcome"):
    continue
  rows.append(seal(p, run))
print(json.dumps(rows))
`);
    expect(grid.length >= 6, 'receipts ' + grid.length);
    grid.forEach(rec => expect(S.record(rec).ok === true, rec.receipt_id));
    const idle = D.createIdleDream({}).tick({});
    const quant = idle.mechanisms && idle.mechanisms.quantitative;
    expect(quant && quant.admitted.some(r => r.expression === 'V/R' && r.fact === false) && quant.experiments.length > 0, JSON.stringify(quant));
    M.reload();
    const law = M.admitted().find(r => r.kind === 'quantitative' && r.expression === 'V/R');
    expect(law && law.gilligan && law.scale && law.range.V && law.range.R && law.fact === false, JSON.stringify(law && { expression: law.expression, scale: law.scale, range: law.range }));
    const inside = M.prepare({ solver: 'circuits_wasm', topology: 'single', V: 7, R: 160, scene: { action: 'circuit' } }, M.admitted());
    expect(inside.applied === true && inside.kind === 'quantitative' && Math.abs(inside.value - 7 / 160) < 1e-6, JSON.stringify(inside && { applied: inside.applied, value: inside.value, expression: inside.expression }));
    const outside = M.prepare({ solver: 'circuits_wasm', topology: 'single', V: 40, R: 160, scene: { action: 'circuit' } }, M.admitted());
    expect(outside.mode === 'simulate' && outside.reason === 'out_of_range', JSON.stringify(outside && { mode: outside.mode, reason: outside.reason }));
    const sealed = py(`
import json, sys
from rmc_engine_v1.sim_device import derive_quantitative
body = json.loads(sys.argv[1])
out = derive_quantitative(body["problem"], body["law"], body["derived"])
print(json.dumps({"ok": out.get("ok"), "method": out.get("method"), "why": out.get("causal_reason"), "effect": out.get("effect_text"), "fact": out.get("may_store_as_fact"), "scale": (out.get("mechanism") or {}).get("scale"), "expression": (out.get("mechanism") or {}).get("expression")}))
`, { problem: { solver: 'circuits_wasm', topology: 'single', V: 7, R: 160, question: 'ohm' }, law: law, derived: inside });
    expect(sealed.ok === true && sealed.method === 'learned_mechanism' && sealed.fact === false && sealed.expression === 'V/R' && /milliamp/.test(sealed.effect || '') && !/the group/.test(sealed.effect || ''), JSON.stringify(sealed));
    S.record({
      ok: true, may_store_as_fact: false, receipt_id: 'sim-ohm-miss', sha256: 'sha-ohm-miss',
      outcome: 'solve', primary_solver: 'circuits_wasm',
      problem: { solver: 'circuits_wasm', topology: 'single', V: 7, R: 160 },
      run: { measurements: { source_current_a: 5 } },
      spoken_atoms: []
    });
    const dropped = M.refit(S.list());
    M.reload();
    expect(dropped.changed === true && !M.admitted().some(r => r.expression === 'V/R'), JSON.stringify(dropped));
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
