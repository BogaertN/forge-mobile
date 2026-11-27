/* 4.9.286: a sandbox atom is tainted, and the write barrier keeps it out of memory, admitted facts, and mechanisms. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SB = require(ROOT + '/src/sandbox.js');
const M = require(ROOT + '/src/mechanisms.js');
const WF = require(ROOT + '/src/world_facts.js');
const KS = require(ROOT + '/src/kstore.js');

function register(C, expect) {
  C('R4297', 'a sandbox atom cannot reach memory, an admitted fact, or a mechanism', () => {
    const box = SB.open();
    const atom = box.atom({ predicate: 'isa', args: ['sandbox-quartz', 'mineral'], text: 'sandbox-quartz is a mineral' });
    expect(atom.taint === 'sandbox' && atom.fact === false && atom.may_store_as_fact === false, 'tag');
    const round = JSON.parse(JSON.stringify(atom));
    const denial = SB.blocked(round);
    expect(denial && denial.ok === false && denial.wrote === false && denial.rule === 'SANDBOX-WRITE-BARRIER', JSON.stringify(denial));

    M.clear();
    const clean = { id: 'law-clean', status: 'admitted', fact: false, solver: 'circuits_wasm', expression: 'V/R', kind: 'quantitative' };
    M.save({ mechanisms: [clean] });
    expect(M.admitted().some(r => r.id === 'law-clean'), 'clean law stays');
    M.save({ mechanisms: M.list().concat([round]) });
    expect(M.admitted().some(r => r.id === 'law-clean') && !JSON.stringify(M.list()).includes('sandbox-quartz'), JSON.stringify(M.list()));
    M.clear();

    WF.clear();
    const fact = WF.upsert({ text: 'Sandbox quartz is a mineral.', atom: round });
    expect(fact.ok === false && fact.rule === 'SANDBOX-WRITE-BARRIER' && !WF.rows().some(r => /sandbox-quartz/.test(r.text || '')), JSON.stringify(fact));
    const kept = WF.upsert({ text: 'Quartz is a mineral.' });
    expect(kept.ok === true && WF.rows().some(r => r.text === 'Quartz is a mineral.'), JSON.stringify(kept));
    WF.clear();

    const store = KS.MemoryStore();
    const mem = store.save('memory', [{ text: 'sandbox-quartz is kept', atom: round }]);
    expect(mem.ok === false && mem.wrote === false && store.load('memory').length === 0, JSON.stringify(mem));
    const rules = store.save('admitted_rules', [round]);
    expect(rules.ok === false && store.load('admitted_rules').length === 0, JSON.stringify(rules));
    const scoped = store.save('case:lab:memory', [round]);
    expect(scoped.ok === false && !JSON.stringify(store.load('case:lab:memory')).includes('sandbox-quartz'), JSON.stringify(scoped));
    const staged = store.stageGeneration({ memory: [round] });
    store.commitGeneration(staged);
    expect(!JSON.stringify(store.load('memory')).includes('sandbox-quartz'), 'stage');
    const ordinary = store.save('memory', [{ text: 'Quartz is a mineral.' }]);
    expect(ordinary.ok === true && store.load('memory')[0].text === 'Quartz is a mineral.', JSON.stringify(ordinary));

    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    const app = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
    expect(app.includes('data-quant-range') && app.includes('data-quant-unit'), 'the card trace keeps the range and the unit');
    expect(html.indexOf('src/sandbox.js') >= 0 && html.indexOf('src/sandbox.js') < html.indexOf('src/kstore.js'), 'page order');
    expect(sw.indexOf("'./src/sandbox.js'") >= 0 && sw.indexOf("'./src/sandbox.js'") < sw.indexOf("'./src/kstore.js'"), 'worker order');
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 900); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
