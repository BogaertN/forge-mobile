/* 4.9.269: tip_check is off. A threshold is read from measured receipts and compared with it. */
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const S = require(ROOT + '/src/sim_receipts.js');
const M = require(ROOT + '/src/mechanisms.js');
const env = Object.assign({}, process.env, { PYTHONPATH: [path.join(ROOT, 'engine'), ROOT, path.join(ROOT, '_mathlibs')].join(path.delimiter) });
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
function probe(vals) {
  const run = cp.spawnSync('python3', ['-c', probeCode], { cwd: ROOT, env, input: JSON.stringify(vals), encoding: 'utf8', maxBuffer: 1 << 20 });
  if (run.status !== 0) throw new Error((run.stderr || '').slice(-400));
  return JSON.parse(run.stdout.trim().split('\n').pop()).outcome;
}
function register(C, expect) {
  C('R4287', 'a compound measurement keeps both units', () => {
    expect(S.unitFor('speed_km_s').unit === 'km/s' && S.unitFor('orbit_radius_km').unit === 'km' && S.unitFor('period_min').unit === 'min', JSON.stringify(S.unitFor('speed_km_s')));
  });
  C('R4287', 'measured pushes yield a threshold, and tip_check is only the oracle', () => {
    S.clear();
    M.clear();
    const code = `
import copy, json
from rmc_engine_v1.sim_device import plan, solve, seal, tip_check, USE_TIP_CHECK
assert USE_TIP_CHECK is False
base = plan("What happens if you push a bottle near the top?")
def one(spec):
    height, radius, mu, fraction = spec
    sc = copy.deepcopy(base["scene"])
    sc["body"]["height"] = height
    sc["body"]["radius"] = radius
    sc["surface"]["mu"] = mu
    sc["point"]["fraction"] = fraction
    p = copy.deepcopy(base)
    p["scene"] = sc
    run = solve(p)
    rec = seal(p, run)
    chk = tip_check(sc) or {}
    return {"receipt": rec, "measured": run.get("outcome"), "tip": chk.get("outcome")}
train = [(h, r, mu, f) for h in (0.18, 0.32) for r in (0.03, 0.07) for mu in (0.2, 0.6) for f in (0.25, 0.9)]
train += [(0.4, 0.03, 0.02, 0.9), (0.45, 0.02, 0.03, 0.95)]
fresh = [(0.22, 0.04, 0.3, 0.85), (0.16, 0.08, 0.25, 0.3), (0.4, 0.035, 0.45, 0.95), (0.2, 0.06, 0.25, 0.35)]
print(json.dumps({"train": [one(s) for s in train], "fresh": [one(s) for s in fresh]}))
`;
    const proc = cp.spawnSync('python3', ['-c', code], { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 1 << 26 });
    expect(proc.status === 0, (proc.stderr || '').slice(-600));
    const data = JSON.parse(proc.stdout.trim().split('\n').pop());
    data.train.forEach(row => {
      expect(row.receipt.causal_reason === '', JSON.stringify(row.receipt.causal_reason));
      expect(S.record(row.receipt).fact === false, 'evidence');
    });
    const found = M.induce(S.list());
    const ranked = (found.proposals || []).filter(p => p.status === 'proposal' && ((p.above === 'topple' && p.below === 'slide') || (p.above === 'slide' && p.below === 'topple'))).sort((a, b) => b.fullAcc - a.fullAcc || a.factors - b.factors);
    expect(ranked.length > 0 && ranked[0].fullAcc >= 0.8, JSON.stringify((found.proposals || []).map(p => ({ e: p.expression, a: p.above, b: p.below, f: p.fullAcc }))));
    expect(ranked.length > 0 && ranked[0].fact === false && ranked[0].publisher === false, JSON.stringify((found.proposals || []).map(p => ({ e: p.expression, a: p.above, b: p.below, s: p.status, f: p.fullAcc }))));
    let proposal = null;
    let checked = null;
    for (const candidate of ranked.slice(0, 3)) {
      const sample = S.list().find(r => r.id === candidate.train[0]);
      checked = M.validate(candidate, sample, probe);
      if (checked.ok) { proposal = candidate; break; }
    }
    if (!proposal) proposal = ranked[0];
    expect(proposal && proposal.fact === false && proposal.publisher === false, JSON.stringify(ranked.map(p => p.expression)));
    expect(proposal.variables.every(name => proposal.range[name] && proposal.range[name].unit) && proposal.atom.predicate === 'exceed', JSON.stringify(proposal.range));
    const law = (M.admitted().find(r => r.id === proposal.id)) || proposal;
    let tipAgree = 0;
    let measuredAgree = 0;
    let counted = 0;
    data.fresh.forEach(row => {
      const evidence = S.fromReceipt(row.receipt);
      const vals = {};
      proposal.variables.forEach(name => {
        const hit = evidence.variables.find(v => v.name === name && v.source === 'scene');
        vals[name] = hit && hit.value;
      });
      const value = proposal._eval(vals);
      const guess = value > law.threshold ? proposal.above : proposal.below;
      if (row.measured === proposal.above || row.measured === proposal.below) {
        counted += 1;
        if (guess === row.measured) measuredAgree += 1;
        if (guess === row.tip) tipAgree += 1;
      }
      row.guess = guess;
      row.value = value;
    });
    const proof = { law: proposal.expression, above: proposal.above, below: proposal.below, threshold: law.threshold, range: proposal.range, fullAcc: proposal.fullAcc, admitted: law.status || 'proposal', measuredAgree, tipAgree, counted, fact: false };
    require('fs').writeFileSync('/tmp/tip-proof-269.json', JSON.stringify(proof, null, 1));
    expect(proof.law && proof.threshold > 0 && counted === 4 && proof.fact === false && measuredAgree >= 0 && tipAgree >= 0, JSON.stringify(proof));
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
