/* 4.9.287: a simulator receipt is kept as evidence and is still there after reload. */
const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const S = require(ROOT + '/src/sim_receipts.js');
function register(C, expect) {
  C('R4285', 'a sealed receipt is kept with its scene, units, outcome and mechanism, and it is not a fact', () => {
    S.clear();
    const code = `
import json
from rmc_engine_v1.sim_device import plan, solve, seal
q = "What happens if a satellite orbits Earth at 520 km?"
p = plan(q)
assert p.get("ok"), p
rec = seal(p, solve(p))
print(json.dumps(rec, default=str))
`;
    const env = Object.assign({}, process.env, { PYTHONPATH: [path.join(ROOT, 'engine'), ROOT, path.join(ROOT, '_mathlibs')].join(path.delimiter) });
    const r = cp.spawnSync('python3', ['-c', code], { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 1 << 26 });
    expect(r.status === 0, (r.stderr || '').slice(-500));
    const rec = JSON.parse(r.stdout.trim().split('\n').pop());
    const put = S.record(rec);
    expect(put.ok === true && put.fact === false && put.publisher === false && put.may_store_as_fact === false, JSON.stringify(put));
    const row = S.list()[0];
    expect(row && row.evidence_class === 'simulation' && row.fact === false && row.publisher === false && row.hosted_eligible === false, JSON.stringify(row && row.evidence_class));
    expect(row.outcome && row.solver === 'astronomy_ondevice', JSON.stringify({ outcome: row.outcome, solver: row.solver }));
    const radius = row.variables.find(v => v.name === 'orbit_radius_km');
    const period = row.variables.find(v => v.name === 'period_min');
    const alt = row.variables.find(v => v.name === 'altitude_m');
    expect(radius && radius.unit === 'km' && radius.source === 'measurement', JSON.stringify(radius));
    expect(period && period.unit === 'min', JSON.stringify(period));
    expect(alt && alt.unit === 'm' && alt.value === 520000, JSON.stringify(alt));
    expect(row.mechanism_atoms.length >= 1 && row.mechanism_atoms[0].atom && row.mechanism_atoms[0].role === 'mechanism', JSON.stringify(row.mechanism_atoms));
    S.reload();
    const kept = S.list().find(x => x.id === row.id);
    expect(kept && kept.sha256 === row.sha256 && kept.fact === false && kept.outcome === row.outcome, 'reload');
    expect(S.record(rec).ok === true && S.list().filter(x => x.id === row.id).length === 1, 'one row per receipt');
    expect(S.record({ ok: true, may_store_as_fact: true, receipt_id: 'sim-fact', sha256: 'aa', outcome: 'land' }).ok === false, 'a fact is refused');
    S.clear();
    S.reload();
    expect(S.list().length === 0, 'cleared');
  });
  C('R4285', 'the phone keeps the copy and does not write it as a world fact', () => {
    const app = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
    const sim = fs.readFileSync(path.join(ROOT, 'src/sim_device.js'), 'utf8');
    expect(/KSimReceipts\.record\(simReceipt\)/.test(app) && /memory\.simulation = simReceipt\.rows/.test(app), 'ask keeps evidence and the turn premise');
    expect(!/keepWorldFact\([^)]*sim/i.test(app) && !/simulation[^\n]*world_facts/.test(app), 'not a world fact');
    expect(/KSimReceipts\.record\(out\)/.test(sim), 'simulate records');
    expect(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').includes('src/sim_receipts.js') && fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').includes('./src/sim_receipts.js'), 'shipped');
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 700); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
