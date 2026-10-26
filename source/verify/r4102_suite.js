/* R4102 (4.9.102): MEA-on-phone learning.
 * Revisable rule induction from stored evidence, shown by “show / explain the proposals”.
 * A proposal never answers a question. A user tap admits one only when Echo passed,
 * drift ε_s ≤ 0.35, and the replay contradicts nothing. No shared-KB seed. No LLM.
 * Written FIRST (failing). */
const ROOT = require('path').join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const mk = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-26T01:10:00Z' });
const ids = r => ((r.trace && r.trace.rules) || []).map(x => x.id);
const active = k => k.memory().filter(x => x.status === 'active');
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
const admittedN = k => (k.admittedRules() || []).filter(x => x.status === 'admitted').length;
const BASE = ['Remember that Rex is a dog.', 'Remember that Fido is a dog.', 'Remember that Rex chases cats.', 'Remember that Fido chases cats.', 'Remember that Bo is a dog.'];
const SHOWN = 'I derived 2 hypotheses from your facts: (1) “a is a dog if a chases cat”; (2) “a chases cat if a is a dog”. I have not stored the rule. I can only seal it after your confirmation.';
const NONE = 'I derived no hypothesis from your facts. I have not stored the rule.';
const ONE = 'I derived 1 hypothesis from your facts: (1) “a is a dog if a chases cat”. I have not stored the rule. I can only seal it after your confirmation.';
const quiet = k => { expect(sharedN(k) === 0, 'shared KB written'); expect(admittedN(k) === 0, 'a rule was admitted'); expect((k.store.load('drift_archive') || []).length === 0, 'drift archive written'); };
const teach = k => { for (const u of BASE) k.process(u); };

T('show the proposals lists induced rules and does not act', () => {
  const k = mk(); teach(k);
  const mem = active(k).length, world = JSON.stringify(k.worldState());
  const r = k.process('show the proposals');
  expect(r.reply === SHOWN, r.reply);
  expect(r.trace.selection.winner === 'directive.frame', r.trace.selection && r.trace.selection.winner);
  expect(ids(r).includes('MEA-PHONE-PROPOSE') && ids(r).includes('LC-CAP-FRAME'), ids(r).join(','));
  expect(r.trace.echo && r.trace.echo.pass, (r.trace.echo && r.trace.echo.reason) || 'echo failed');
  expect(active(k).length === mem && JSON.stringify(k.worldState()) === world, 'the show wrote memory or the world');
  quiet(k);
  const props = k.phoneProposals();
  expect(props.length >= 2 && props.every(p => p.echo && p.eps_s <= 0.35 && p.route === 'promotable'), JSON.stringify(props));
  const later = k.process('Does Bo chase cats?');
  expect(!/^Yes\b/.test(later.reply || ''), later.reply);
  expect(admittedN(k) === 0, 'the question admitted the rule');
});
T('explain the proposals is the same surface', () => {
  const k = mk(); teach(k);
  const r = k.process('explain the proposals');
  expect(r.reply === SHOWN, r.reply);
  expect(ids(r).includes('MEA-PHONE-PROPOSE'), ids(r).join(','));
  expect(r.trace.echo && r.trace.echo.pass, r.reply);
  quiet(k);
});
T('no stored evidence yields no hypothesis and stores nothing', () => {
  const k = mk();
  const r = k.process('Show the proposals.');
  expect(r.reply === NONE, r.reply);
  expect(r.trace.echo && r.trace.echo.pass, r.reply);
  expect(!k.phoneProposals().length, JSON.stringify(k.phoneProposals()));
  expect(!k.adoptPhoneProposal('rule:missing', true).ok, 'a missing proposal was admitted');
  quiet(k);
  expect(!active(k).length && !(k.worldState().entities || []).length, 'an empty show wrote');
});
T('a tap without confirmation does not admit', () => {
  const k = mk(); teach(k);
  k.process('show the proposals');
  const chase = k.phoneProposals().find(p => /chases cat if a is a dog/.test(p.text));
  expect(chase, JSON.stringify(k.phoneProposals()));
  const no = k.adoptPhoneProposal(chase.id, false);
  expect(!no.ok && no.rule === 'PERM-NEEDS-USER-TAP', JSON.stringify(no));
  expect(admittedN(k) === 0 && sharedN(k) === 0, 'a false tap wrote');
  expect(!/^Yes\b/.test(k.process('Does Bo chase cats?').reply || ''), 'the rule answered without a tap');
});
T('a confirming tap admits only a projectable rule with no regression, and withdrawal takes it back', () => {
  const k = mk(); teach(k);
  const shown = k.process('show the proposals');
  expect(shown.trace.echo && shown.trace.echo.pass, shown.reply);
  const chase = k.phoneProposals().find(p => p.route === 'promotable' && /chases cat if a is a dog/.test(p.text));
  expect(chase && chase.eps_s <= 0.35 && chase.echo, JSON.stringify(chase));
  const yes = k.adoptPhoneProposal(chase.id, true);
  expect(yes.ok && yes.admitted && yes.eps_s <= 0.35 && /^rule-proof:sha256:/.test(yes.proof), JSON.stringify(yes).slice(0, 240));
  expect(admittedN(k) === 1 && sharedN(k) === 0, 'shared KB or extra rules');
  const q = k.process('Does Bo chase cats?');
  expect(/^Yes\b/.test(q.reply || '') && ids(q).includes('GELC-ADMITTED-RULE'), q.reply);
  expect(sharedN(k) === 0, 'the answer seeded the shared KB');
  const row = k.admittedRules().find(x => x.status === 'admitted');
  const w = k.withdrawRule(row.id, true);
  expect(w.ok, JSON.stringify(w).slice(0, 200));
  expect(!/^Yes\b/.test(k.process('Does Bo chase cats?').reply || ''), 'a withdrawn rule still answered');
  expect(sharedN(k) === 0, 'withdrawal seeded the shared KB');
});
T('a conflicted proposal is shown as not adoptable', () => {
  const k = mk(); teach(k);
  k.process('Remember that Bo does not chase cats.');
  const r = k.process('show the proposals');
  expect(r.reply === ONE, r.reply);
  expect(r.trace.echo && r.trace.echo.pass, r.reply);
  const bad = k.phoneProposals().find(p => p.route === 'conflicted' && /chases cat if/.test(p.text));
  expect(bad, JSON.stringify(k.phoneProposals()));
  const no = k.adoptPhoneProposal(bad.id, true);
  expect(!no.ok && no.rule === 'MEA-NOT-APPROVABLE', JSON.stringify(no));
  expect(admittedN(k) === 0 && sharedN(k) === 0, 'a conflicted tap wrote');
  const q = k.process('Does Bo chase cats?');
  expect(!/^Yes\b/.test(q.reply || ''), q.reply);
});
T('a later contradicting fact blocks the tap', () => {
  const k = mk(); teach(k);
  k.process('show the proposals');
  const chase = k.phoneProposals().find(p => /chases cat if a is a dog/.test(p.text));
  expect(chase, 'no chase proposal');
  k.process('Remember that Bo does not chase cats.');
  const no = k.adoptPhoneProposal(chase.id, true);
  expect(!no.ok && (no.rule === 'ADM-CONTRADICTS-STATED' || no.rule === 'MEA-NOT-APPROVABLE'), JSON.stringify(no).slice(0, 240));
  expect(admittedN(k) === 0 && sharedN(k) === 0, 'a regressing tap wrote');
});
T('guard: show the problems still lists the shipped problems', () => {
  const k = mk();
  const r = k.process('show the problems');
  expect(/^I have 6 problems:/.test(r.reply || ''), r.reply);
  expect(r.trace.selection.winner === 'directive.frame', r.trace.selection && r.trace.selection.winner);
  expect(ids(r).includes('MEAP-FRAME-LIST'), ids(r).join(','));
  expect(r.trace.echo && r.trace.echo.pass, 'echo failed');
  expect(!ids(r).includes('MEA-PHONE-PROPOSE'), 'problems were read as proposals');
});
T('guard: an intervention what-if stays dynamics', () => {
  const k = mk();
  k.process('Remember that frost causes cracks.');
  const r = k.process('what if there is no frost?');
  expect(r.trace.selection.winner === 'world.dynamics' && ids(r).includes('DYN-WHATIF'), (r.trace.selection && r.trace.selection.winner) + ' ' + ids(r).join(','));
  expect(!/I derived /.test(r.reply || '') && !/I answered in a branch/.test(r.reply || ''), r.reply);
});
T('guard: explore ideas still induces through GELC and is not the proposal frame', () => {
  const k = mk(); teach(k);
  const r = k.process('explore ideas');
  expect(ids(r).includes('GELC-EVOLVE') && !ids(r).includes('MEA-PHONE-PROPOSE'), ids(r).join(','));
  expect(r.trace.echo && r.trace.echo.pass, r.reply);
  expect(!/^I derived /.test(r.reply || ''), r.reply);
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4102', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4102', name: t.name, ok: false, why: String(e.message || e).slice(0, 400) }); }
  }
  console.log(JSON.stringify(rows, null, 0));
  process.exit(failed ? 1 : 0);
})();
