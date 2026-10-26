/* R4101 (4.9.101): a counterfactual branch uses observed history as its committed base.
 * The existing Suppose / buildWorlds path is the only branch. The supposition is the
 * overlay. It does not retract an observed fact, and it does not write memory,
 * world_state, or the shared KB. No LLM.
 * Written FIRST (failing). */
const ROOT = require('path').join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const mk = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-26T00:40:00Z' });
const ids = r => ((r.trace && r.trace.rules) || []).map(x => x.id);
const snap = k => JSON.stringify({
  memory: k.memory(),
  world: k.worldState(),
  shared: k.store.load('shared_knowledge') || [],
  working: k.workingFacts()
});
const branchYes = (r, quoted) => {
  expect(r.reply === 'I answered in a branch. Yes. The checked proof supports “' + quoted + '”. The branch does not change the world.', r.reply);
  expect(r.trace.selection.winner === 'world.proof', r.trace.selection && r.trace.selection.winner);
  expect(ids(r).includes('WM-WHAT-IF-BRANCH') && ids(r).includes('WM-OBSERVED-BASE'), ids(r).join(','));
  expect(r.trace.echo && r.trace.echo.pass, (r.trace.echo && r.trace.echo.reason) || 'echo failed');
};

T('stored inside-chain is the committed base of a later Suppose', () => {
  const k = mk();
  k.process('Remember that Pim is inside Quo.');
  const before = snap(k);
  const r = k.process('Suppose Quo is inside Rub. Is Pim inside Rub?');
  branchYes(r, 'pim is in rub');
  expect(snap(k) === before, 'the branch wrote observed history');
  expect((k.store.load('shared_knowledge') || []).length === 0, 'shared KB written');
  const later = k.process('Is Pim inside Rub?');
  expect(!/^Yes\b/.test(later.reply || '') && !/branch/.test(later.reply || ''), later.reply);
  expect(!k.worldState().entities.some(e => e.id === 'ent:rub'), JSON.stringify(k.worldState().entities));
});
T('stored comparative is the committed base of a later Suppose', () => {
  const k = mk();
  k.process('Remember that Ola is taller than Nia.');
  const before = snap(k);
  const r = k.process('Suppose Nia is taller than Kip. Is Ola taller than Kip?');
  branchYes(r, 'ola is taller than kip');
  expect(snap(k) === before, 'the branch wrote observed history');
  const later = k.process('Is Ola taller than Kip?');
  expect(!/^Yes\b/.test(later.reply || ''), later.reply);
});
T('a contradicting Suppose does not retract the observed fact', () => {
  const k = mk();
  k.process('Remember that Pim is inside Quo.');
  k.process('Remember that Quo is inside Rub.');
  const before = snap(k);
  const r = k.process('Suppose Quo is not inside Rub. Is Pim inside Rub?');
  branchYes(r, 'pim is in rub');
  expect(snap(k) === before, 'the overlay retracted a stored fact');
  const still = k.process('Is Quo inside Rub?');
  expect(still.reply === 'Yes. You told me that Quo is inside Rub.', still.reply);
});
T('two stored links and one supposition answer the longer chain', () => {
  const k = mk();
  k.process('Remember that Pim is inside Quo.');
  k.process('Remember that Quo is inside Rub.');
  const before = snap(k);
  const r = k.process('Suppose Rub is inside Sap. Is Pim inside Sap?');
  branchYes(r, 'pim is in sap');
  expect(snap(k) === before, 'the branch wrote observed history');
  expect(!k.worldState().entities.some(e => e.id === 'ent:sap'), 'sap leaked into the world');
});
T('a working statement is observed history for this conversation only', () => {
  const k = mk();
  k.process('Pim is inside Quo.');
  expect(k.memory().filter(x => x.status === 'active').length === 0, 'a plain statement was stored');
  expect(k.workingFacts().length === 1, JSON.stringify(k.workingFacts()));
  const before = snap(k);
  const r = k.process('Suppose Quo is inside Rub. Is Pim inside Rub?');
  branchYes(r, 'pim is in rub');
  expect(snap(k) === before, 'the branch wrote the working fact or the world');
  expect(k.workingFacts().length === 1 && k.workingFacts()[0].text === 'Pim is inside Quo', JSON.stringify(k.workingFacts()));
});
T('an unrelated stored fact is not a premise of the branch', () => {
  const k = mk();
  k.process('Remember that Zed is a cat.');
  k.process('Remember that Pim is inside Quo.');
  const zed = k.memory().find(x => /zed/i.test(JSON.stringify(x.entities || [])));
  const r = k.process('Suppose Quo is inside Rub. Is Pim inside Rub?');
  branchYes(r, 'pim is in rub');
  const note = ((r.trace.rules || []).find(x => x.id === 'WM-OBSERVED-BASE') || {}).note || '';
  expect(zed && !note.includes(zed.id) && !/zed|cat/.test(r.reply), note + ' ' + r.reply);
});
T('guard: a same-turn Suppose with no observed fact stays a branch and writes nothing', () => {
  const k = mk();
  const r = k.process('Suppose Pim is inside Quo. Quo is inside Rub. Is Pim inside Rub?');
  expect(r.reply === 'I answered in a branch. Yes. The checked proof supports “pim is in rub”. The branch does not change the world.', r.reply);
  expect(r.trace.echo && r.trace.echo.pass, 'echo failed');
  expect(!ids(r).includes('WM-OBSERVED-BASE'), ids(r).join(','));
  expect(!k.memory().length && !k.worldState().entities.length && !(k.store.load('shared_knowledge') || []).length, 'same-turn suppose wrote');
});
T('guard: a bare Suppose stays in dream quarantine', () => {
  const k = mk();
  const r = k.process('Suppose Pim is inside Quo.');
  expect(/dream quarantine/.test(r.reply || '') && /not a stored fact/.test(r.reply || ''), r.reply);
  expect(!k.memory().filter(x => x.status === 'active').length, 'a bare suppose was stored');
  expect(!k.worldState().entities.length, 'a bare suppose wrote the world');
});
T('guard: an intervention what-if stays dynamics', () => {
  const k = mk();
  k.process('Remember that frost causes cracks.');
  const r = k.process('what if there is no frost?');
  expect(r.trace.selection.winner === 'world.dynamics' && ids(r).includes('DYN-WHATIF'), (r.trace.selection && r.trace.selection.winner) + ' ' + ids(r).join(','));
  expect(!/I answered in a branch/.test(r.reply || ''), r.reply);
  const h = k.process('What happens if there is frost?');
  expect(h.trace.selection.winner === 'world.dynamics' && ids(h).includes('DYN-WHATIF'), h.reply);
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4101', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4101', name: t.name, ok: false, why: String(e.message || e).slice(0, 400) }); }
  }
  console.log(JSON.stringify(rows));
  process.exit(failed ? 1 : 0);
})();
