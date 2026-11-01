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

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R498', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R498', name: t.name, ok: false, why: String(e.message || e).slice(0, 400) }); }
  }
  console.log(JSON.stringify(rows));
  process.exit(failed ? 1 : 0);
})();
