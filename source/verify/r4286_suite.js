/* 4.9.280: idle search reads a law from simulation evidence. The quantities are the scene's own. */
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const S = require(ROOT + '/src/sim_receipts.js');
const M = require(ROOT + '/src/mechanisms.js');
const D = require(ROOT + '/src/dream_idle.js');
function register(C, expect) {
  C('R4286', 'a threshold law is read from the scene quantities, probed, and kept', () => {
    S.clear();
    M.clear();
    let i = 0;
    for (const height of [0.2, 0.4]) for (const radius of [0.03, 0.06]) for (const mu of [0.2, 0.5]) for (const fraction of [0.2, 0.9]) {
      const mass = i % 2 ? 0.4 : 1.2;
      const value = fraction * height * mu / radius;
      const outcome = value > 1 ? 'topple' : 'slide';
      const put = S.record({
        ok: true, may_store_as_fact: false, receipt_id: 'sim-mech-' + i, sha256: 'sha-mech-' + i,
        outcome: outcome, primary_solver: 'mujoco_wasm',
        problem: { solver: 'mujoco_wasm', scene: { action: 'push', body: { noun: 'sample', shape: 'cylinder', height: height, radius: radius, mass: mass }, surface: { name: 'table', mu: mu }, point: { fraction: fraction }, gravity: 9.80665, karaka: { kriya: 'push', karma: 'sample', adhikarana: 'table' } } },
        spoken_atoms: []
      });
      expect(put.ok === true && put.fact === false, JSON.stringify(put));
      i++;
    }
    const found = M.induce(S.list());
    const proposal = found.proposals[0];
    expect(proposal && proposal.expression === '(fraction*height*mu)/radius' && proposal.status === 'proposal' && proposal.fact === false && proposal.publisher === false, JSON.stringify(proposal && { expression: proposal.expression, status: proposal.status }));
    expect(proposal.range.fraction && proposal.range.radius && proposal.range.mu.unit === '1' && proposal.atom.predicate === 'exceed', JSON.stringify(proposal.range));
    const sample = S.list().find(r => r.id === proposal.train[0]);
    const checked = M.validate(proposal, sample, vals => (vals.fraction * vals.height * vals.mu / vals.radius) > 1 ? 'topple' : 'slide');
    expect(checked.ok === true && checked.status === 'admitted' && checked.fact === false && checked.publisher === false, JSON.stringify(checked));
    M.reload();
    const kept = M.admitted().find(r => r.id === proposal.id);
    expect(kept && kept.expression === proposal.expression && kept.fact === false && kept.threshold > 0.9 && kept.threshold < 1.1, JSON.stringify(kept && { expression: kept.expression, threshold: kept.threshold }));
    const idle = D.createIdleDream({}).tick({});
    expect(idle.rule === 'DREAM-IDLE-EMPTY' && idle.calls_llm === false && idle.mechanisms && idle.mechanisms.proposals.some(p => p.expression === proposal.expression && p.fact === false), JSON.stringify(idle.mechanisms));
    S.clear();
    M.clear();
  });
  C('R4286', 'the phone ships the mechanism search and does not store it as a fact', () => {
    expect(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').includes('src/mechanisms.js') && fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').includes('./src/mechanisms.js'), 'shipped');
    const src = fs.readFileSync(path.join(ROOT, 'src/mechanisms.js'), 'utf8');
    expect(/may_store_as_fact: false/.test(src) && /publisher: false/.test(src) && !/keepWorldFact/.test(src), 'evidence only');
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 800); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
