/* R498 (4.9.98): discourse leftovers — bare demonstratives and a finite verb after a determiner —
 * and a temporal stub: year order and year intervals as world facts.
 * Written FIRST (failing). General pathway rules, not answer patches. */
const ROOT = require('path').join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js'), G = require(ROOT + '/src/grammar.js'), QC = require(ROOT + '/src/qcompile.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const mk = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-25T23:00:00Z' });
const hooksOf = (k, extra) => Object.assign({
  derive: t => (k.deriveSource || k.derive)(t),
  clauseText: c => G.clauseText(c, 'kernel'),
  reparse: t => (k.reparseSource || k.reparseClause)(t),
  leadName: null,
  inLead: true
}, extra || {});
const gen = (k, sentence, hooks) => QC.generate(QC.compile({}, sentence, k.lexicon, 'x'), sentence, hooks);
const echoed = gens => (gens || []).filter(g => g.echo);
const ids = r => ((r.trace && r.trace.rules) || []).map(x => x.id);

T('demonstrative: These is the subject of a finite verb and Echoes', () => {
  const k = mk(); const sent = 'These are the largest worlds.';
  const gens = gen(k, sent, hooksOf(k));
  const g = echoed(gens).find(x => /world/i.test(x.text));
  expect(!!g, 'no echoed claim: ' + JSON.stringify((gens || []).map(x => ({ t: x.text, e: x.echo }))));
  expect(/\bthese\b/i.test(g.text), g.text);
});
T('demonstrative: lead That takes the article subject', () => {
  const k = mk(); const sent = 'That forms hard crystals in rock.';
  const gens = gen(k, sent, hooksOf(k, { leadName: 'quartz', inLead: true }));
  const g = echoed(gens).find(x => /crystal/i.test(x.text));
  expect(!!g, 'no echoed claim: ' + JSON.stringify((gens || []).map(x => ({ t: x.text, e: x.echo }))));
  expect(/\bthe quartz\b/i.test(g.text) && /form/i.test(g.text), g.text);
  expect(!/^\s*that\b/i.test(g.text), 'That stayed unbound: ' + g.text);
});
T('demonstrative: This plus a noun is a determiner, not the article name', () => {
  const k = mk(); const sent = 'This mineral forms hard crystals.';
  const gens = gen(k, sent, hooksOf(k, { leadName: 'quartz', inLead: true }));
  const g = echoed(gens).find(x => /mineral/i.test(x.text));
  expect(!!g, 'no echoed claim: ' + JSON.stringify((gens || []).map(x => ({ t: x.text, e: x.echo }))));
  expect(/\bthis mineral\b/i.test(g.text), g.text);
  expect(!/quartz/i.test(g.text), 'determiner was rewritten: ' + g.text);
});
T('demonstrative: These past the lead takes the local plural, not the article', () => {
  const k = mk(); const sent = 'Giant planets orbit the sun. These are the largest worlds.';
  const gens = gen(k, sent, hooksOf(k, { leadName: 'tornado', inLead: true }));
  const g = echoed(gens).find(x => /largest/i.test(x.text) || /world/i.test(x.text));
  expect(!!g, 'no echoed claim: ' + JSON.stringify((gens || []).map(x => ({ t: x.text, e: x.echo }))));
  expect(/planet/i.test(g.text), g.text);
  expect(!/tornado/i.test(g.text), 'article name leaked past the lead: ' + g.text);
});
T('reference: bare that resolves to the one singular antecedent', () => {
  const k = mk();
  k.process('The comet is bright.');
  const r = k.process('Is that bright?');
  expect(/^Yes\b/.test(r.reply || ''), r.reply);
  expect(/comet/i.test(r.reply || ''), r.reply);
  expect(ids(r).includes('REF-RESOLVED-UNIQUE') || ids(r).includes('REF-RESOLVED-ANSWERABLE'), ids(r).join(','));
});
T('reference: where-question keeps the one answerable this', () => {
  const k = mk();
  k.process('The parcel is on the porch.');
  const r = k.process('Where is this?');
  expect(/porch/i.test(r.reply || ''), (r.reply || 'no reply') + ' ' + ids(r).join(','));
  expect(ids(r).some(id => id === 'REF-RESOLVED-UNIQUE' || id === 'REF-RESOLVED-ANSWERABLE'), ids(r).join(','));
  expect(!/possible referents/i.test(r.reply || ''), r.reply);
});
T('reference: two answerable demonstratives still ask', () => {
  const k = mk();
  k.process('The parcel is on the porch.');
  k.process('The lamp is on the desk.');
  const r = k.process('Where is this?');
  expect(/referent|name it/i.test(r.reply || ''), (r.reply || 'no reply') + ' ' + ids(r).join(','));
  expect(ids(r).includes('REF-AMBIGUITY-HELD-OPEN'), ids(r).join(','));
});
T('reference: that-complement and that-relative stay clauses', () => {
  const k = mk();
  const noted = k.process('Remember that the treaty was signed in 1648.');
  expect(/noted that the treaty was signed in 1648/i.test(noted.reply || ''), noted.reply);
  const d = k.derive('A device that sends voice over a wire is a telephone.');
  expect(d.parses.some(p => (p.rules || []).includes('G-REL-SUBJ-GAP')), 'relative that was lost');
});
T('order: an earlier year is before a later year, and nothing is stored for it', () => {
  const k = mk();
  k.process('Remember that the treaty was signed in 1648.');
  k.process('Remember that the war ended in 1783.');
  const r = k.process('Did the treaty happen before the war?');
  expect(/infer that the treaty happened before the war/i.test(r.reply || ''), r.reply);
  expect(ids(r).includes('TEMPORAL-YEAR-ORDER'), ids(r).join(','));
  expect(/1648/.test(r.reply || '') && /1783/.test(r.reply || ''), r.reply);
  expect(k.memory().length === 2, 'order wrote a fact: ' + k.memory().length);
  expect((k.store.load('shared_knowledge') || []).length === 0, 'shared KB written');
  const ws = k.worldState();
  const rel = (ws.relations || []).find(x => x.pred === 'before' && (x.rules || []).includes('TEMPORAL-YEAR-ORDER'));
  expect(!!rel, 'world_state has no year order: ' + JSON.stringify((ws.relations || []).map(x => x.pred + ':' + (x.rules || []).join(','))).slice(0, 400));
  expect(/treaty/.test(rel.a) && /war/.test(rel.b), JSON.stringify(rel));
  expect((rel.premises || []).length >= 2, JSON.stringify(rel.premises));
});
T('order: a later year is not before an earlier year', () => {
  const k = mk();
  k.process('Remember that the treaty was signed in 1648.');
  k.process('Remember that the war ended in 1783.');
  const r = k.process('Did the war happen before the treaty?');
  expect(/^No\b/.test(r.reply || ''), r.reply);
  expect(ids(r).includes('TEMPORAL-YEAR-ORDER'), ids(r).join(','));
  expect(k.memory().length === 2, 'a no wrote a fact');
});
T('order: the same year does not invent an order', () => {
  const k = mk();
  k.process('Remember that the treaty was signed in 1648.');
  k.process('Remember that the war ended in 1648.');
  const r = k.process('Did the treaty happen before the war?');
  expect(!/infer that the treaty happened before the war/i.test(r.reply || ''), r.reply);
  expect(!ids(r).includes('TEMPORAL-YEAR-ORDER'), ids(r).join(','));
});
T('interval: from-year to-year answers how long and is a world span', () => {
  const k = mk();
  k.process('Remember that the war lasted from 1775 to 1783.');
  const r = k.process('How long did the war last?');
  expect(/1775/.test(r.reply || '') && /1783/.test(r.reply || ''), r.reply);
  expect(!/no stored fact/i.test(r.reply || ''), r.reply);
  const ws = k.worldState();
  const span = (ws.attributes || []).find(a => a.attr === 'interval' && a.start === 1775 && a.end === 1783);
  expect(!!span && span.years === 8 && span.unit === 'year', JSON.stringify(ws.attributes).slice(0, 500));
  expect(k.memory().length === 1, 'the interval was stored as a second fact');
  expect((k.store.load('shared_knowledge') || []).length === 0, 'shared KB written');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R498', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R498', name: t.name, ok: false, why: String(e.message || e).slice(0, 400) }); }
  }
  console.log(JSON.stringify(rows));
  process.exit(failed ? 1 : 0);
})();
