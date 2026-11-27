/* 4.9.286: idle varies an admitted law inside the sandbox. The best branch is kept. It is not a fact. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const B = require(ROOT + '/src/dream_branch.js');
const M = require(ROOT + '/src/mechanisms.js');
const WF = require(ROOT + '/src/world_facts.js');
const KS = require(ROOT + '/src/kstore.js');
const D = require(ROOT + '/src/dream_idle.js');
function law() {
  return {
    id: 'quant:circuits_wasm:source_current_a:V/R', status: 'admitted', fact: false, kind: 'quantitative',
    solver: 'circuits_wasm', output: 'source_current_a', expression: 'V/R', scale: 1, form: 'product', factors: 2,
    unit: 'A', variables: ['V', 'R'],
    terms: [{ name: 'V', exp: 1 }, { name: 'R', exp: -1 }],
    range: { V: { min: 4, max: 12, unit: 'V' }, R: { min: 100, max: 200, unit: 'ohm' } }
  };
}
function register(C, expect) {
  C('R4299', 'a dream branch stays in the sandbox and the best one is kept without dice', () => {
    M.clear();
    WF.clear();
    const before = M.admitted().map(r => r.id).join('|');
    const store = KS.MemoryStore();
    store.save('memory', [{ text: 'Quartz is a mineral.' }]);
    const found = B.search([law()]);
    const again = B.search([law()]);
    expect(found.fact === false && found.may_store_as_fact === false && found.taint === 'sandbox' && found.dice === false, JSON.stringify({ fact: found.fact, taint: found.taint }));
    expect(found.branches.length >= 2 && found.branches.every(b => b.taint === 'sandbox' && b.fact === false), 'branches tainted');
    expect(found.best && found.best.kept === true && found.best.applied === true && found.best.id === again.best.id, JSON.stringify(found.best && { id: found.best.id, applied: found.best.applied }));
    expect(found.explorer && found.explorer.ok === true && found.explorer.memory_write_allowed === false, JSON.stringify(found.explorer));
    expect(found.evolved && found.evolved.population >= 0 && found.ede.length >= 1, JSON.stringify({ evolved: found.evolved, ede: found.ede }));
    expect(M.admitted().map(r => r.id).join('|') === before, 'mechanisms unchanged');
    expect(WF.rows().length === 0, 'no world fact');
    expect(store.load('memory')[0].text === 'Quartz is a mineral.', 'memory unchanged');
    const src = fs.readFileSync(path.join(ROOT, 'src/dream_branch.js'), 'utf8');
    expect(!/Math\.random/.test(src) && /evolve/.test(src) && /explore/.test(src) && /evolutionary_drift_explorer/.test(src), 'wired, no dice');
    expect(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').indexOf('src/dream_branch.js') < fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').indexOf('src/dream_idle.js'), 'page order');
    const idle = D.createIdleDream({}).tick({});
    expect(idle.rule === 'DREAM-IDLE-EMPTY' && idle.mechanisms && idle.mechanisms.dream && idle.mechanisms.dream.fact === false, JSON.stringify(idle.rule));
    M.clear();
    WF.clear();
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 900); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
