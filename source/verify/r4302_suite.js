/* 4.9.288: gloss compounds stay intact, dream scenes queue distinct gaps, and a story narrates the branch. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const PRO = require(ROOT + '/data/lexicon-pro.json');
const K = require(ROOT + '/src/kernel.js');
const FK = require(ROOT + '/src/forge.js');
const Q = require(ROOT + '/src/qframe.js');
const Fit = require(ROOT + '/src/clause_fit.js');
const S = require(ROOT + '/src/senses.js');
const B = require(ROOT + '/src/dream_branch.js');
const WF = require(ROOT + '/src/world_facts.js');
function forge() {
  const f = FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-27T08:00:00Z' });
  f.lexicon.attach(PRO, 'pro');
  return f;
}
function law(extra) {
  return Object.assign({
    id: 'quant:circuits_wasm:source_current_a:V/R', status: 'admitted', fact: false, kind: 'quantitative',
    solver: 'circuits_wasm', output: 'source_current_a', expression: 'V/R', scale: 1, factors: 2, unit: 'A',
    variables: ['V', 'R'], terms: [{ name: 'V', exp: 1 }, { name: 'R', exp: -1 }],
    range: { V: { min: 4, max: 12, unit: 'V' }, R: { min: 100, max: 200, unit: 'ohm' } }
  }, extra || {});
}
function register(C, expect) {
  C('R4302', 'a gloss keeps a multiword lexeme, and a kind question uses the object noun', () => {
    const f = forge();
    const lines = Q.glossClauses('snipe', 'Old or New World straight-billed game bird of the sandpiper family', f);
    expect(lines.indexOf('A snipe is a game bird.') >= 0 && lines.indexOf('A snipe is straight-billed.') >= 0, JSON.stringify(lines));
    expect(!lines.some(t => /\b(old|new|world|game)\b/.test(t) && !/game bird/.test(t)), JSON.stringify(lines));
    const fitted = Fit.fitList('snipe', lines.map(text => ({ text, single_source: true, fact: false, admitted: false })), f, null).map(c => c.text).join(' ');
    expect(/game bird/.test(fitted) && !/\bwas old\b/.test(fitted) && !/\bwas game\b/.test(fitted) && !/\bwas world\b/.test(fitted), fitted);
    const kind = S.askText({ kind: 'sim', ask_kind: true, missing: 'kind', noun: 'crate', word: 'bulk', material_class: 'bulk', patient: 'crate' }, false);
    expect(kind === 'What kind of crate is it?', kind);
    const badger = Q.glossClauses('badger', 'sturdy carnivorous burrowing mammal with strong claws', f);
    ['A badger is a mammal.', 'A badger burrows.', 'A badger has strong claws.', 'A badger is carnivorous.'].forEach(s => expect(badger.indexOf(s) >= 0, JSON.stringify(badger)));
  });
  C('R4302', 'dream scenes queue an untested range, a missing density, and a chain', () => {
    const one = B.questions(B.search([law()]));
    const texts = one.map(q => q.question);
    expect(one.length >= 3 && new Set(texts).size >= 3 && texts.some(q => /untested/.test(q)) && texts.some(q => /density of the object/.test(q)), JSON.stringify(texts));
    expect(one.every(q => q.fact === false && q.taint !== 'sandbox' && q.may_store_as_fact === false), JSON.stringify(one[0]));
    const other = law({ id: 'quant:buoyancy_ondevice:height:m*g', solver: 'buoyancy_ondevice', output: 'height', expression: 'm*g', variables: ['m', 'g'], terms: [{ name: 'm', exp: 1 }, { name: 'g', exp: 1 }], range: { m: { min: 1, max: 4, unit: 'kg' }, g: { min: 9, max: 10, unit: 'm/s^2' } } });
    const two = B.questions(B.search([law(), other]));
    expect(two.some(q => q.axis === 'chain' && /chained/.test(q.question)) && two.some(q => q.axis === 'material'), JSON.stringify(two.map(q => q.axis + ' ' + q.question)));
    const worker = fs.readFileSync(path.join(ROOT, 'src/py_worker.js'), 'utf8');
    expect(worker.includes("op == 'explore_drift'") && worker.includes('report: arg.report') && worker.includes('explore_evolutionary_drift'), 'the phone worker runs the explorer');
    const idle = fs.readFileSync(path.join(ROOT, 'src/app_curators.js'), 'utf8');
    expect(idle.includes('exploreDrift') && idle.includes('FORGE_EXPLORER') && idle.includes('noteHeld'), 'idle calls the worker');
  });
  C('R4302', 'an imagined story narrates the scene branch and is not stored', () => {
    WF.clear();
    const story = B.imagine('kestrel', [law()]);
    expect(story.imagined === true && story.label === 'imagined' && story.fact === false && story.taint === 'sandbox' && story.stored === false && /^Imagined\. The kestrel was in the scene\./.test(story.story || ''), JSON.stringify(story));
    const fact = WF.upsert({ text: story.story, taint: 'sandbox', atom: story });
    expect(fact.ok === false && WF.rows().length === 0, JSON.stringify(fact));
    const app = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
    expect(app.includes('memory.creative_imagined.story') && app.includes('row.creative.stored = false'), 'the spoken story replaces the reply and is not proposed for storage');
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
