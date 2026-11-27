/* 4.9.290: a dream branch leaves only as a question. The tainted branch does not. */
const path = require('path');
const ROOT = path.join(__dirname, '..');
const B = require(ROOT + '/src/dream_branch.js');
const SB = require(ROOT + '/src/sandbox.js');
const M = require(ROOT + '/src/mechanisms.js');
const WF = require(ROOT + '/src/world_facts.js');
const KS = require(ROOT + '/src/kstore.js');
const D = require(ROOT + '/src/dream_idle.js');
function law() {
  return {
    id: 'quant:circuits_wasm:source_current_a:V/R', status: 'admitted', fact: false, kind: 'quantitative',
    solver: 'circuits_wasm', output: 'source_current_a', expression: 'V/R', scale: 1, factors: 2, unit: 'A',
    variables: ['V', 'R'], terms: [{ name: 'V', exp: 1 }, { name: 'R', exp: -1 }],
    range: { V: { min: 4, max: 12, unit: 'V' }, R: { min: 100, max: 200, unit: 'ohm' } }
  };
}
function register(C, expect) {
  C('R4300', 'a dream hypothesis is a question, and the branch cannot be stored', () => {
    M.clear();
    WF.clear();
    const found = B.search([law()]);
    const door = B.questions(found);
    const texts = door.map(q => q.question);
    expect(door.length >= 3 && new Set(texts).size === texts.length && door.every(q => q.hypothesis === true && q.fact === false && q.taint !== 'sandbox' && /\?$/.test(q.question)), JSON.stringify(door[0]));
    expect(texts.some(q => /\d/.test(q) && /ohm/.test(q) && /volt/.test(q)) && texts.every(q => /ohm/.test(q) && /volt/.test(q) && !/density/.test(q)) && texts.every(q => !/\b(untested|mechanism|scene|branch|chained|do put)\b/i.test(q)), JSON.stringify(texts));
    expect(SB.blocked(found.best) && SB.blocked(found.best).rule === 'SANDBOX-WRITE-BARRIER', 'branch is tainted');
    const store = KS.MemoryStore();
    const mem = store.save('memory', [found.best]);
    expect(mem.ok === false && mem.wrote === false && store.load('memory').length === 0, JSON.stringify(mem));
    const fact = WF.upsert({ text: 'V/R still holds.', atom: found.best });
    expect(fact.ok === false && fact.rule === 'SANDBOX-WRITE-BARRIER' && WF.rows().length === 0, JSON.stringify(fact));
    M.save({ mechanisms: [found.best] });
    expect(!JSON.stringify(M.list()).includes('sandbox') && M.admitted().every(r => r.taint !== 'sandbox'), JSON.stringify(M.list()));
    M.clear();
    const idle = D.createIdleDream({});
    M.save({ mechanisms: [law()] });
    const first = idle.tick({});
    expect(first.rule === 'DREAM-IDLE-EMPTY' && first.door && first.door.length >= 3 && first.door.every(q => q.fact === false) && new Set(first.door.map(q => q.question)).size >= 3, JSON.stringify(first.door && first.door.map(q => q.question)));
    const second = idle.tick({});
    expect(second.wrote_confirmed_shared !== true && second.fact !== true && second.resolved && second.resolved.fact === false && second.resolved.ok === true && /milliamp/.test(second.resolved.reply || '') && second.resolved.method === 'simulate', JSON.stringify(second.resolved));
    expect(WF.rows().length === 0 && M.admitted().every(r => r.taint !== 'sandbox'), 'the question was not stored as a fact');
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
