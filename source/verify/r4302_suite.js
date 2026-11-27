/* 4.9.292: gloss compounds stay intact, dream scenes queue distinct gaps, and a story narrates the branch. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
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
    expect(one.length >= 3 && new Set(texts).size >= 3 && texts.some(q => /225 ohm/.test(q) && /8 volts/.test(q) && /you put /.test(q) && !/do put/.test(q)), JSON.stringify(texts));
    expect(one.every(q => q.fact === false && q.taint !== 'sandbox' && q.may_store_as_fact === false && /ohm/.test(q.question) && !/density/.test(q.question) && !/\b(untested|mechanism|scene|branch|chained|object|do put)\b/i.test(q.question)), JSON.stringify(one));
    const other = law({ id: 'quant:buoyancy_ondevice:height:m*g', solver: 'buoyancy_ondevice', output: 'height', expression: 'm*g', variables: ['m', 'g'], terms: [{ name: 'm', exp: 1 }, { name: 'g', exp: 1 }], range: { m: { min: 1, max: 4, unit: 'kg' }, g: { min: 9, max: 10, unit: 'm/s^2' } } });
    const two = B.questions(B.search([law(), other], { nouns: ['crate'] }));
    expect(two.some(q => /ohm/.test(q.question)) && two.some(q => /kilogram/.test(q.question)) && two.every(q => !/density/.test(q.question)), JSON.stringify(two.map(q => q.question)));
    const worker = fs.readFileSync(path.join(ROOT, 'src/py_worker.js'), 'utf8');
    expect(worker.includes("op == 'explore_drift'") && worker.includes('report: arg.report') && worker.includes('explore_evolutionary_drift'), 'the phone worker runs the explorer');
    const idle = fs.readFileSync(path.join(ROOT, 'src/app_curators.js'), 'utf8');
    expect(idle.includes('exploreDrift') && idle.includes('FORGE_EXPLORER') && idle.includes('noteHeld'), 'idle calls the worker');
  });
  C('R4302', 'an imagined story narrates the scene branch and is not stored', () => {
    WF.clear();
    const story = B.imagine('kestrel', [law()], [{ text: 'A kestrel is a falcon.' }, { text: 'A kestrel hovers.' }]);
    expect(story.imagined === true && story.label === 'imagined' && story.fact === false && story.taint === 'sandbox' && story.stored === false && /kestrel is a falcon/.test(story.story || '') && /hovers/.test(story.story || '') && !/\b(imagined|mechanism|scene|branch|chained)\b/i.test(story.story || ''), JSON.stringify(story));
    const facts = [{ text: 'A badger is a mammal.' }, { text: 'A badger is sturdy.' }, { text: 'A badger is carnivorous.' }, { text: 'A badger burrows.' }, { text: 'The badger was a mammal, carnivorous and sturdy.' }];
    const described = B.prose('badger', facts, [], 'describe');
    expect(/mammal/.test(described) && /sturdy/.test(described) && /burrows/.test(described) && !/was a mammal, carnivorous and sturdy/.test(described), described);
    const told = B.eventPlan('badger', facts.concat([{ text: 'sturdy carnivorous burrowing mammal with strong claws' }]), forge());
    const narrated = B.prose('badger', facts, [], 'narrate', told.sentences);
    expect(/had strong claws/.test(narrated) && narrated.indexOf('had strong claws') < narrated.indexOf('burrowed') && /earth/.test(narrated) && !/was a mammal/.test(narrated) && !/\b(mechanism|scene|branch|chained|imagined)\b/i.test(narrated), JSON.stringify(told) + ' ' + narrated);
    const raft = B.eventPlan('raft', [{ text: 'a flat float usually made of logs or planks' }], forge());
    expect(/floated/.test(raft.sentences.join(' ')) && /water/.test(raft.question || ''), JSON.stringify(raft));
    const floated = B.prose('raft', [], [{ outcome: 'float', measurements: { fluid: 'water', patient: 'raft', rho_body: 720, rho_fluid: 997, submerged_fraction: 0.72 } }], 'narrate', raft.sentences);
    expect(/out of the water/.test(floated) && /720/.test(floated) && /below the density of the water/.test(floated) && /0\.72 of the raft was in the water/.test(floated), floated);
    const loon = B.eventPlan('loon', [{ text: 'fish-eating diving bird having webbed feet' }, { text: 'Common loons live on lakes.' }, { text: 'Common loons eat a variety of animal prey including fish.' }], forge());
    const loonText = loon.sentences.join(' ');
    expect(/was on the lake/.test(loonText) && /dived on the lake/.test(loonText) && /ate a fish/.test(loonText) && /water/.test(loon.question || '') && !/included/.test(loonText) && !/solid/.test(loonText), loonText);
    const waded = B.prose('post', [], [{ outcome: 'float', measurements: { fluid: 'water', patient: 'post', rho_body: 500, rho_fluid: 997, submerged_fraction: 0.5, depth_vs_leg: 'above' } }], 'narrate', ['The post waded in the water.']);
    expect(/depth was above the length of the leg/.test(waded), waded);
    const sim = require(ROOT + '/src/sim_device.js');
    sim.forge = forge();
    const words = sim.KSimDevice.materialWords('What happens if I put the raft in the water?', 'raft');
    expect(words.indexOf('timber') >= 0, words.join(' '));
    const fact = WF.upsert({ text: story.story, taint: 'sandbox', atom: story });
    expect(fact.ok === false && WF.rows().length === 0, JSON.stringify(fact));
    const app = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
    expect(app.includes('KDreamBranch.prose') && app.includes('row.creative.stored = false') && !app.includes("'Imagined. '"), 'the spoken story is the gathered prose and is not proposed for storage');
    WF.clear();
  });
  C('R4302', 'a kinship inverse answers the licensed relation', () => {
    const Core = require(ROOT + '/src/rmc_core.js');
    const R = require(ROOT + '/src/rmc_client.js');
    function ask(setup, q) {
      WF.clear();
      const f = forge();
      const phone = setup.map((text, i) => {
        const sentence = /[.!?]$/.test(text) ? text : text + '.';
        const clause = Q.clause(sentence, f);
        WF.upsert({ text: sentence, clause: clause, kind: 'remember', source: 'phone_kb', trust: 'trusted' });
        return { id: 'n' + i, text: sentence, clause: clause, tier: 'phone', trust: 'trusted', scope: 'phone' };
      });
      const frame = Q.compile(q, f);
      const payload = Core.withClauses({ question: q, frame: frame, live: true, memory: { phone: phone, pools: [] } }, Q, f);
      return R.askSync(payload);
    }
    const aunt = ask(["Mara's aunt is Soren."], "Who is Soren's niece?");
    expect(aunt && /Mara/.test(aunt.reply || ''), JSON.stringify(aunt && aunt.reply));
    const nephew = ask(["Nia's uncle is Calder."], "Who is Calder's nephew?");
    expect(nephew && /Nia/.test(nephew.reply || ''), JSON.stringify(nephew && nephew.reply));
    const niece = ask(["Nia's uncle is Calder."], "Who is Calder's niece?");
    expect(niece && niece.reply == null, JSON.stringify(niece && niece.reply));
    WF.clear();
  });
  C('R4302', 'a density needs two publishers, and depth is compared with the leg', () => {
    const env = Object.assign({}, process.env, { PYTHONPATH: [path.join(ROOT, 'engine'), ROOT, path.join(ROOT, '_mathlibs')].join(path.delimiter) });
    const proc = cp.spawnSync('python3', ['-c', `
import json
from rmc_engine_v1.athena_props import agree_density
from rmc_engine_v1.sim_device import plan, solve, seal
one = agree_density([{"lineage":"wikimedia","low_trust":True,"value":900}])
two = agree_density([{"lineage":"wikimedia","low_trust":True,"value":900},{"lineage":"eol","low_trust":False,"value":940}], "water")
q = "What happens if I put the post in the water?"
facts = [{"head":"post","property":"density","value":500},{"head":"post","property":"material","value":"oak"},{"head":"post","property":"height_m","value":0.4},{"head":"post","property":"leg_m","value":0.15}]
p = plan(q, facts=facts)
s = solve(p) if p.get("ok") else {}
r = seal(p, s) if p.get("ok") else {}
print(json.dumps({"one": one.get("use"), "rho": two.get("rho"), "fact": two.get("may_store_as_fact"), "depth": (s.get("measurements") or {}).get("depth_vs_leg"), "rows": [row.get("text") for row in r.get("rows") or []]}))
`], { cwd: ROOT, env: env, encoding: 'utf8', maxBuffer: 1 << 22 });
    if (proc.status !== 0) throw new Error(String(proc.stderr || proc.stdout).slice(-500));
    const row = JSON.parse(String(proc.stdout).trim().split('\n').pop());
    expect(row.one === false && row.rho > 900 && row.rho < 940 && row.fact === false && row.depth === 'above' && row.rows.some(t => /depth is above the length of the leg/.test(t)), JSON.stringify(row));
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 900); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
