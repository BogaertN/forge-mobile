/* 4.9.292: creative search is labelled imagined. A factual answer stays on the real path. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const B = require(ROOT + '/src/dream_branch.js');
const M = require(ROOT + '/src/mechanisms.js');
const WF = require(ROOT + '/src/world_facts.js');
function law() {
  return {
    id: 'quant:circuits_wasm:source_current_a:V/R', status: 'admitted', fact: false, kind: 'quantitative',
    solver: 'circuits_wasm', output: 'source_current_a', expression: 'V/R', scale: 1, factors: 2, unit: 'A',
    variables: ['V', 'R'], terms: [{ name: 'V', exp: 1 }, { name: 'R', exp: -1 }],
    range: { V: { min: 4, max: 12, unit: 'V' }, R: { min: 100, max: 200, unit: 'ohm' } }
  };
}
function register(C, expect) {
  C('R4301', 'creative search is imagined, and a factual question is not answered by the branch', () => {
    M.clear();
    WF.clear();
    const creative = B.consider([law()], 'creative');
    const factual = B.consider([law()], 'factual');
    const told = B.prose('badger', [{ text: 'A badger is a mammal.' }, { text: 'A badger burrows.' }, { text: 'A badger has strong claws.' }], []);
    expect(creative.imagined === true && creative.label === 'imagined' && creative.fact === false && creative.taint === 'sandbox' && creative.expression === 'V/R' && creative.stored === false && !/\b(imagined|mechanism|scene|branch|chained)\b/i.test(creative.story || ''), JSON.stringify(creative));
    expect(/mammal/.test(told) && /burrows/.test(told) && /claws/.test(told) && !/\bimagined\b/i.test(told), told);
    expect(factual.answer_from === 'real_world' && factual.reply == null && factual.imagined === false && factual.fact === false && /\?$/.test(factual.question || '') && !/still hold/.test(factual.question || ''), JSON.stringify(factual));
    const fact = WF.upsert({ text: 'The dream imagined V/R.', taint: 'sandbox', atom: creative });
    expect(fact.ok === false && WF.rows().length === 0, JSON.stringify(fact));
    const app = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
    expect(app.includes('data-imagined') && app.includes("consider(KMechanisms.admitted(), 'factual')") && app.includes('hypo.reply == null'), 'the card labels imagination and does not speak the branch');
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
