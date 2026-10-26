/* R4103 (4.9.103): every turn carries one intent_kind from the closed set.
 * LANGUAGE_UNEXPRESSIBLE names a surface Echo or derivation refused.
 * Written FIRST (failing). Replies of 4.9.101–102 stay as they are. */
const ROOT = require('path').join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const mk = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-26T02:40:00Z' });
const ids = r => ((r.trace && r.trace.rules) || []).map(x => x.id);
const SET = ['READ', 'DERIVE', 'EXPLAIN', 'SIMULATE', 'PROPOSE_EVIDENCE', 'REQUEST_COMMIT', 'CLARIFY', 'UNSUPPORTED'];
const job = r => r.trace && r.trace.intent_kind;
const expectJob = (r, kind) => {
  expect(SET.includes(job(r)) && job(r) === kind, (job(r) || 'missing') + ' · ' + String(r.reply || '').slice(0, 180));
  expect(r.trace.language !== 'LANGUAGE_UNEXPRESSIBLE', 'an expressed turn was marked unexpressible');
};
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
const BASE = ['Remember that Rex is a dog.', 'Remember that Fido is a dog.', 'Remember that Rex chases cats.', 'Remember that Fido chases cats.', 'Remember that Bo is a dog.'];
const SHOWN = 'I derived 2 hypotheses from your facts: (1) “a is a dog if a chases cat”; (2) “a chases cat if a is a dog”. I have not stored the rule. I can only seal it after your confirmation.';

T('a stored question is READ', () => {
  const k = mk();
  k.process('remember that my car is red');
  const r = k.process('what is my car?');
  expectJob(r, 'READ');
  expect(r.reply === 'You told me that your car is red.', r.reply);
  expect(sharedN(k) === 0, 'shared KB written');
});
T('remember is REQUEST_COMMIT', () => {
  const k = mk();
  const r = k.process('remember that my car is red');
  expectJob(r, 'REQUEST_COMMIT');
  expect(r.reply === 'I noted that your car is red.', r.reply);
  expect(k.memory().some(x => x.status === 'active'), 'the fact was not stored');
  expect(sharedN(k) === 0, 'shared KB written');
});
T('a checked proof and a cause chain are DERIVE', () => {
  const k = mk();
  const w = k.process('Rex is a dog. Every dog is an animal. Is Rex an animal?');
  expectJob(w, 'DERIVE');
  expect(/^Yes\./.test(w.reply || ''), w.reply);
  k.process('Remember that frost causes cracks.');
  k.process('Remember that cracks cause leaks.');
  const c = k.process('Does frost cause leaks?');
  expectJob(c, 'DERIVE');
  expect(/^Yes, I infer/.test(c.reply || ''), c.reply);
  expect(ids(c).includes('INF-RELPROP') || ids(c).includes('INF-CAUSE-CHAIN'), ids(c).join(','));
  expect(sharedN(k) === 0, 'shared KB written');
});
T('why, how, a definition, and a backward cause are EXPLAIN', () => {
  const k = mk();
  k.process('remember that I stayed home because it rained');
  const w = k.process('why did I stay home?');
  expectJob(w, 'EXPLAIN');
  expect(/because it rained/.test(w.reply || ''), w.reply);
  const h = k.process('How are bricks made?');
  expectJob(h, 'EXPLAIN');
  expect(ids(h).includes('Q-WH-HOW-PASSIVE'), ids(h).join(','));
  const d = k.process('define drift');
  expectJob(d, 'EXPLAIN');
  expect(/means/.test(d.reply || ''), d.reply);
  k.process('Remember that frost causes cracks.');
  k.process('Remember that cracks cause leaks.');
  const inv = k.process('What causes leaks?');
  expectJob(inv, 'EXPLAIN');
  expect(ids(inv).includes('CAUSAL-INVERSION-CHAIN'), ids(inv).join(','));
  expect(sharedN(k) === 0, 'shared KB written');
});
T('a branch, a bare Suppose, and a dynamics what-if are SIMULATE', () => {
  const k = mk();
  k.process('Remember that Pim is inside Quo.');
  const b = k.process('Suppose Quo is inside Rub. Is Pim inside Rub?');
  expectJob(b, 'SIMULATE');
  expect(/I answered in a branch/.test(b.reply || '') && /does not change the world/.test(b.reply || ''), b.reply);
  expect(!/^Yes/.test(k.process('Is Pim inside Rub?').reply || ''), 'the branch leaked');
  const dream = mk().process('Suppose the sky is green.');
  expectJob(dream, 'SIMULATE');
  expect(/dream quarantine/.test(dream.reply || '') && /not a stored fact/.test(dream.reply || ''), dream.reply);
  const f = mk();
  f.process('Remember that frost causes cracks.');
  const w = f.process('what if there is no frost?');
  expectJob(w, 'SIMULATE');
  expect(w.trace.selection.winner === 'world.dynamics' && ids(w).includes('DYN-WHATIF'), w.reply);
  expect(!/I answered in a branch/.test(w.reply || ''), w.reply);
  expect(sharedN(f) === 0, 'shared KB written');
});
T('proposals and explore ideas are PROPOSE_EVIDENCE and do not act', () => {
  const k = mk();
  for (const u of BASE) k.process(u);
  const s = k.process('show the proposals');
  expectJob(s, 'PROPOSE_EVIDENCE');
  expect(s.reply === SHOWN, s.reply);
  expect(ids(s).includes('MEA-PHONE-PROPOSE'), ids(s).join(','));
  const e = mk();
  for (const u of BASE) e.process(u);
  const x = e.process('explain the proposals');
  expectJob(x, 'PROPOSE_EVIDENCE');
  expect(x.reply === SHOWN, x.reply);
  const later = k.process('Does Bo chase cats?');
  expectJob(later, 'READ');
  expect(!/^Yes\b/.test(later.reply || ''), later.reply);
  const ex = mk();
  for (const u of BASE) ex.process(u);
  const g = ex.process('explore ideas');
  expectJob(g, 'PROPOSE_EVIDENCE');
  expect(ids(g).includes('GELC-EVOLVE') && !ids(g).includes('MEA-PHONE-PROPOSE'), ids(g).join(','));
  expect(!/^I derived /.test(g.reply || ''), g.reply);
  expect((k.store.load('shared_knowledge') || []).length === 0, 'shared KB written');
});
T('an ambiguity and an unresolved word are CLARIFY', () => {
  const k = mk();
  const a = k.process('I saw her duck');
  expectJob(a, 'CLARIFY');
  expect(/readings/.test(a.reply || ''), a.reply);
  const u = mk().process('what is it?');
  expectJob(u, 'CLARIFY');
  expect(/cannot resolve/.test(u.reply || ''), u.reply);
  expect(!k.memory().length, 'a clarification stored a fact');
});
T('an unregistered action is UNSUPPORTED', () => {
  const k = mk();
  const r = k.process('buy milk');
  expectJob(r, 'UNSUPPORTED');
  expect(/not authorized/.test(r.reply || ''), r.reply);
  expect(!k.memory().length, 'the action was stored');
  expect(sharedN(k) === 0, 'shared KB written');
});
T('an Echo failure is LANGUAGE_UNEXPRESSIBLE and stores nothing', () => {
  const k = KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-26T02:40:00Z', renderFault: t => t.replace('noted', 'denied') });
  const r = k.process('remember that my car is red');
  expect(r.blocked && r.reply == null, r.reply);
  expect(!/noted|denied/.test(r.reply || ''), r.reply);
  expect(r.trace.language === 'LANGUAGE_UNEXPRESSIBLE', r.trace.language || 'missing');
  expect(job(r) === 'REQUEST_COMMIT', job(r) || 'missing');
  expect(SET.includes(job(r)), job(r));
  expect(!k.memory().length, 'a failed surface was stored');
  expect(sharedN(k) === 0, 'shared KB written');
});
T('guard: show the problems still lists the shipped problems', () => {
  const k = mk();
  const r = k.process('show the problems');
  expect(/^I have 6 problems:/.test(r.reply || ''), r.reply);
  expect(r.trace.echo && r.trace.echo.pass, r.reply);
  expect(r.trace.selection.winner === 'directive.frame', r.trace.selection && r.trace.selection.winner);
});
T('guard: a proposal is still not a stored rule before any tap', () => {
  const k = mk();
  for (const u of BASE) k.process(u);
  const r = k.process('show the proposals');
  expect(r.reply === SHOWN, r.reply);
  expect((k.admittedRules() || []).filter(x => x.status === 'admitted').length === 0, 'admitted');
  expect(sharedN(k) === 0 && (k.store.load('drift_archive') || []).length === 0, 'a side store was written');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4103', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4103', name: t.name, ok: false, why: String(e.message || e).slice(0, 400) }); }
  }
  console.log(JSON.stringify(rows));
  process.exit(failed ? 1 : 0);
})();
