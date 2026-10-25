/* R496 (4.9.96): whose possessive relatives; mid-sentence ADV (prakāra) through generate→Echo;
 * MEA-P slice 1 — option ranking against archive evidence via RSOC_STANDING + DRIFT_TABLE.
 * Written FIRST (failing). General structural rules, not keyword patches. */
const ROOT = require('path').join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js'), G = require(ROOT + '/src/grammar.js'), QC = require(ROOT + '/src/qcompile.js');
const KM = require(ROOT + '/src/kmath.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn }); const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const mk = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-25T18:00:00Z' });
const hooksOf = k => ({ derive: t => k.derive(t), clauseText: c => G.clauseText(c, 'kernel'), reparse: t => { const ps = k.derive(t).parses; return ps[0] && ps[0].node.clause; }, leadName: null });

/* ---------- 1. whose possessive relatives ---------- */
T('whose: mid-NP relative parses (G-REL-WHOSE)', () => {
  const k = mk(); const d = k.derive('A planet whose moons are large is known.');
  expect(d.parses.length > 0, 'no parse for mid-NP whose');
  const rules = d.parses.flatMap(p => p.rules || []);
  expect(rules.some(r => r === 'G-REL-WHOSE' || (r && r.id === 'G-REL-WHOSE')), 'missing G-REL-WHOSE; got ' + JSON.stringify(rules.filter(r => /REL|WHOSE/i.test(String(r))).slice(0, 8)));
});
T('whose: mid-NP possessed head is the relative subject', () => {
  const k = mk(); const d = k.derive('A planet whose moons are large is known.'); /* full clause: bare NP fragments are not utterances */
  const p = d.parses.find(x => (x.rules || []).includes('G-REL-WHOSE')) || d.parses[0];
  expect(!!p, 'no parse');
  const n = p.node; const np = n.clause ? n.clause.subj : n;
  const rw = np && np.relWhose;
  expect(!!rw, 'no relWhose on NP; node=' + JSON.stringify(n).slice(0, 280));
  const head = rw.possessed && rw.possessed.head && rw.possessed.head.join(' ');
  expect(/moon/.test(head || ''), 'possessed head should be moons; got ' + head);
});
T('whose: opening WH-DET sets whHead to the possessed noun', () => {
  const k = mk(); const lp = k.lookupPlan('Whose capital is Paris?');
  expect(!!lp, 'no lookupPlan');
  expect(lp.whHead === 'capital', 'whHead should be capital (possessed); got ' + JSON.stringify({ whHead: lp.whHead, subject: lp.subject, entity: lp.entity, atype: lp.atype }));
  expect(lp.atype === 'person', 'whose asks for a person/owner; atype=' + lp.atype);
});
T('whose: askedNP returns the possessed head', () => {
  const k = mk(); const n = k.askedNP('Whose capital is Paris?');
  expect(!!n, 'askedNP null');
  const t = G.npText(n, 'kernel');
  expect(/capital/i.test(t), 'askedNP should name capital; got ' + t);
});
T('whose: relative realizes with whose + possessed', () => {
  const k = mk(); const d = k.derive('A planet whose moons are large is known.');
  const p = d.parses.find(x => (x.rules || []).includes('G-REL-WHOSE')) || d.parses[0];
  expect(!!p, 'no parse');
  const text = G.clauseText(p.node.clause || p.node, 'kernel');
  expect(/whose\s+moons/i.test(text), 'realized without whose moons: ' + text);
});

/* ---------- 2. mid-sentence ADV (prakāra) through generate → Echo ---------- */
T('ADV: rolesOf captures mid-copula often as prakara (not dropped into obj)', () => {
  const k = mk(); const R = QC.rolesOf(k.derive('The sky is often blue.').T);
  expect(!!R, 'rolesOf null');
  expect(R.obj === 'blue' || !/often/.test(R.obj || ''), 'often must not stay inside obj; obj=' + R.obj);
  expect(Array.isArray(R.advs) && R.advs.some(a => a.w === 'often'), 'rolesOf.advs should include often; got ' + JSON.stringify(R.advs));
});
T('ADV: generate→Echo keeps often from proved span', () => {
  const k = mk(); const hooks = hooksOf(k);
  const core = 'The sky is often blue.';
  const gens = QC.generate(QC.compile({}, 'why is the sky blue', k.lexicon, 'sky'), core, hooks);
  expect(gens.length > 0, 'no generation');
  const g = gens.find(x => /often/i.test(x.text)) || gens[0];
  expect(/often/i.test(g.text), 'generated text dropped often: ' + g.text);
  expect(g.echo === true, 'Echo failed for often; text=' + g.text + ' echo=' + g.echo);
});
T('ADV: preverbal often is prakara, not part of the subject', () => {
  const k = mk(); const R = QC.rolesOf(k.derive('Rain often falls in April.').T);
  expect(!!R, 'rolesOf null');
  expect(!/often/i.test(R.subj || ''), 'often must not be in subject; subj=' + R.subj);
  expect(Array.isArray(R.advs) && R.advs.some(a => a.w === 'often'), 'missing often in advs');
});
T('ADV: open-class manner ADV survives generate→Echo', () => {
  const k = mk(); const hooks = hooksOf(k);
  const core = 'Winds frequently damage roofs.';
  /* finite form so rolesOf finds the verb */
  const core2 = 'Winds frequently damage the roofs.';
  const d = k.derive('Winds frequently damage roofs in storms.');
  const R = QC.rolesOf(d.T);
  /* if rolesOf can read it, generate must keep frequently */
  if (!R) {
    const gens = QC.generate(QC.compile({}, 'what do winds do', k.lexicon, 'winds'), 'Tornadoes often form in spring when air rises.', hooks);
    const hit = gens.find(x => /often/i.test(x.core || '') || /often/i.test(x.text || ''));
    expect(!!hit && /often/i.test(hit.text) && hit.echo, 'open-class/frequency ADV must survive; gens=' + JSON.stringify(gens.map(g => ({ t: g.text, e: g.echo }))));
  } else {
    expect(R.advs && R.advs.some(a => /frequent/i.test(a.w)), 'frequently not captured; ' + JSON.stringify(R));
    const gens = QC.generate(QC.compile({}, 'what do winds do', k.lexicon, 'winds'), 'Winds frequently damage roofs in storms.', hooks);
    const g = gens.find(x => /frequent/i.test(x.text)) || gens[0];
    expect(g && /frequent/i.test(g.text) && g.echo, 'Echo drop of frequently: ' + JSON.stringify(gens.map(x => ({ t: x.text, e: x.echo }))));
  }
  void core; void core2;
});

/* ---------- 3. MEA-P slice 1: option ranking vs archive evidence ---------- */
T('MEA-P: rankOptions scores options with DRIFT_TABLE + RSOC_STANDING', () => {
  expect(typeof QC.rankOptions === 'function', 'QC.rankOptions missing');
  const options = [{ id: 'o1', text: 'Rayleigh scattering' }, { id: 'o2', text: 'nitrogen absorption' }, { id: 'o3', text: 'lunar dust' }];
  const evidence = [
    { title: 'Diffuse sky radiation', excerpt: 'The sky is blue due to Rayleigh scattering of sunlight.', drift: 0.1, supported: true },
    { title: 'Nitrogen', excerpt: 'Nitrogen is the main gas in air.', drift: 0.45, supported: false },
    { title: 'Moon dust', excerpt: 'Lunar dust is grey.', drift: 0.9, supported: false }
  ];
  const Q = QC.compile({}, 'why is the sky blue', LEX, 'sky');
  const ranked = QC.rankOptions(options, evidence, Q);
  expect(ranked && Array.isArray(ranked.options) && ranked.options.length === 3, 'expected 3 ranked options');
  expect(ranked.options[0].id === 'o1', 'best option should be Rayleigh; got ' + JSON.stringify(ranked.options.map(o => o.id + ':' + o.drift)));
  expect(ranked.options[0].route === 'project' || ranked.options[0].drift <= KM.DRIFT_RULING.project_max, 'top option should be projectable');
  expect(ranked.options.every(o => o.standing && o.drift != null), 'each option needs standing + drift');
  expect(ranked.hold === false, 'should not hold when a projectable option exists');
});
T('MEA-P: refuse/hold when every option is above the projectable band', () => {
  const options = [{ id: 'o1', text: 'alpha' }, { id: 'o2', text: 'beta' }];
  const evidence = [
    { title: 'Unrelated A', excerpt: 'Something else entirely about widgets.', drift: 0.7, supported: false },
    { title: 'Unrelated B', excerpt: 'Another distant topic about gadgets.', drift: 0.85, supported: false }
  ];
  const ranked = QC.rankOptions(options, evidence, QC.compile({}, 'why is the sky blue', LEX, 'sky'));
  expect(ranked.hold === true, 'must hold when all options above band; got ' + JSON.stringify(ranked));
  expect(ranked.options.every(o => o.route !== 'project'), 'no projectable route when holding');
});

let failed = 0;
for (const t of tests) {
  try { t.fn(); rows.push({ cls: 'R496', name: t.name, ok: true }); }
  catch (e) { failed++; rows.push({ cls: 'R496', name: t.name, ok: false, why: String(e.message || e).slice(0, 300) }); }
}
console.log(JSON.stringify(rows));
process.exit(failed ? 1 : 0);
