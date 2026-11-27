/* 4.9.275: Buckingham groups on a weight-ramp. Held-out scenes test the threshold. */
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const S = require(ROOT + '/src/sim_receipts.js');
const M = require(ROOT + '/src/mechanisms.js');
const D = require(ROOT + '/src/dream_idle.js');
const env = Object.assign({}, process.env, { PYTHONPATH: [path.join(ROOT, 'engine'), ROOT, path.join(ROOT, '_mathlibs')].join(path.delimiter) });
function register(C, expect) {
  C('R4288', 'a dimensionless group separates new pushes and idle asks for the boundary', () => {
    S.clear();
    M.clear();
    const code = `
import copy, json
from rmc_engine_v1.sim_device import plan, solve, seal, tip_check
base = plan("What happens if you push a bottle near the top?")
def one(spec, mass):
    height, radius, mu, fraction = spec
    p = copy.deepcopy(base)
    sc = p["scene"]
    sc["body"]["height"] = height
    sc["body"]["radius"] = radius
    sc["body"]["mass"] = mass
    sc["surface"]["mu"] = mu
    sc["point"]["fraction"] = fraction
    run = solve(p)
    rec = seal(p, run)
    chk = (tip_check(sc) or {}).get("outcome")
    pi = fraction * height * mu / radius
    return {"receipt": rec, "outcome": run.get("outcome"), "tip": chk, "pi": pi}
train = [(h, r, mu, f, mass) for h in (0.16, 0.36) for r in (0.03, 0.08) for mu in (0.15, 0.5) for f in (0.22, 0.88) for mass in (0.3, 1.2)]
fresh = []
for h in (0.2, 0.25, 0.3, 0.42):
    for r in (0.04, 0.055, 0.07):
        for mu in (0.2, 0.35):
            for f in (0.35, 0.6, 0.75):
                fresh.append((h, r, mu, f, 0.6))
fresh = fresh[:20]
print(json.dumps({
  "train": [one(s[:4], s[4]) for s in train],
  "fresh": [one(s[:4], s[4]) for s in fresh]
}))
`;
    const proc = cp.spawnSync('python3', ['-c', code], { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 1 << 26 });
    expect(proc.status === 0, (proc.stderr || '').slice(-500));
    const data = JSON.parse(proc.stdout.trim().split('\n').pop());
    expect(data.train.length >= 32 && data.fresh.length === 20, JSON.stringify({ train: data.train.length, fresh: data.fresh.length }));
    data.train.forEach(row => { expect(S.record(row.receipt).fact === false, 'evidence'); });
    const found = M.induce(S.list());
    const proposal = (found.proposals || []).filter(p => (p.above === 'topple' && p.below === 'slide') || (p.above === 'slide' && p.below === 'topple')).sort((a, b) => b.fullAcc - a.fullAcc || (b.pi === true) - (a.pi === true))[0];
    expect(proposal && proposal.pi === true && proposal.fullAcc >= 0.95 && proposal.fact === false, JSON.stringify(proposal && { expression: proposal.expression, pi: proposal.pi, full: proposal.fullAcc }));
    const names = proposal.variables.slice().sort().join(',');
    expect(names === 'fraction,height,mu,radius' && proposal.expression.indexOf('radius') >= 0, JSON.stringify(proposal.expression));
    let measured = 0;
    let geometric = 0;
    let tipMotion = 0;
    let tipMotionN = 0;
    data.fresh.forEach(row => {
      const evidence = S.fromReceipt(row.receipt);
      const vals = {};
      proposal.variables.forEach(name => {
        const hit = (evidence.variables || []).find(v => v.name === name && v.source === 'scene');
        vals[name] = hit && hit.value;
      });
      const value = proposal._eval(vals);
      const guess = value > proposal.threshold ? proposal.above : proposal.below;
      if (guess === row.outcome) measured += 1;
      const geo = row.pi > 1 ? 'topple' : 'slide';
      if (guess === geo) geometric += 1;
      if (row.tip === 'topple' || row.tip === 'slide') {
        tipMotionN += 1;
        if (row.outcome === row.tip) tipMotion += 1;
      }
    });
    const sample = S.list().find(r => r.id === proposal.train[0]);
    const probeCode = `
import copy, json, sys
from rmc_engine_v1.sim_device import plan, solve
vals = json.load(sys.stdin)
base = plan("What happens if you push a bottle near the top?")
sc = copy.deepcopy(base["scene"])
if "height" in vals: sc["body"]["height"] = vals["height"]
if "radius" in vals: sc["body"]["radius"] = vals["radius"]
if "mu" in vals: sc["surface"]["mu"] = vals["mu"]
if "fraction" in vals: sc["point"]["fraction"] = vals["fraction"]
p = copy.deepcopy(base)
p["scene"] = sc
print(json.dumps({"outcome": solve(p).get("outcome")}))
`;
    const checked = M.validate(proposal, sample, vals => {
      const run = cp.spawnSync('python3', ['-c', probeCode], { cwd: ROOT, env, input: JSON.stringify(vals), encoding: 'utf8', maxBuffer: 1 << 20 });
      expect(run.status === 0, (run.stderr || '').slice(-300));
      return JSON.parse(run.stdout.trim().split('\n').pop()).outcome;
    });
    expect(checked.ok === true && checked.fact === false && M.admitted().some(r => r.id === proposal.id && r.status === 'admitted'), JSON.stringify(checked));
    const kept = M.admitted().find(r => r.id === proposal.id);
    require('fs').writeFileSync('/tmp/pi-proof.json', JSON.stringify({ expression: kept.expression, threshold: kept.threshold, range: kept.range, measured, geometric, tipMotion, tipMotionN, fresh: data.fresh.length, train: data.train.length }, null, 1));
    const idle = D.createIdleDream({}).tick({});
    const boundary = M.nextScenes(found.proposals);
    expect(measured >= 18 && geometric >= 18 && tipMotion === tipMotionN && boundary.length > 0, JSON.stringify({ law: proposal.expression, threshold: proposal.threshold, range: proposal.range, measured, geometric, tipMotion, tipMotionN, boundary: boundary.length, idle: idle.mechanisms && idle.mechanisms.proposals.length }));
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
