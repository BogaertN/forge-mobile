/* R4108 (4.9.108): a second MEA-P cycle on the same 144 Hz problem.
 * The tap stores M_t+1. The next propose reads that manifest, the archive,
 * and the unknown vector. Parked debt is not spoken again and not archived again.
 * A frame cell and a parser cell are proposal data only. Nothing is applied.
 * A propose still does not write memory, the world head, or the shared KB.
 * Written FIRST (failing). */
const ROOT = require('path').join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const MEAP = require(ROOT + '/src/mea_p.js');
const G = require(ROOT + '/src/grammar.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const mk = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-26T06:10:00Z' });
const ids = r => ((r.trace && r.trace.rules) || []).map(x => x.id);
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
const PID = 'canon:physics-144hz';
const GOAL = 'decide whether 144 Hz is a substrate frequency or a derived harmonic, and what is known about it';
const SPOKEN = '144 Hz is a substrate (fundamental) frequency';
const SHOWN = 'I derived 1 hypothesis from the problem: (1) “144 Hz is a substrate (fundamental) frequency”. I have not stored the problem. I can only seal it after your confirmation. I archived 4 candidates.';
const OPEN1 = 'a direct measurement of 144 Hz in myelin';
const OPEN2 = 'whether 144 is a substrate frequency or a derived harmonic';
const CONTINUED = 'I kept the same problem. I derived no hypothesis from the problem. I have 2 open questions: (1) “' + OPEN1 + '”; (2) “' + OPEN2 + '”. I kept 4 candidates. I have not stored the proposal. I can only seal it after your confirmation.';
const seed = () => MEAP.normalize(require(ROOT + '/src/mea_problems_data.js').problems.find(p => p.id === PID));
const quiet = k => {
  expect(sharedN(k) === 0, 'shared KB written');
  expect((k.store.load('drift_archive') || []).length === 0, 'drift archive written');
  expect(!(k.worldState().entities || []).length, 'world written');
};
const gram = () => JSON.stringify({ able: G.ADJ_INF.able, well: (G.CL.well || []).slice(), closed: G.CLOSED.ADV });

T('a later cycle carries parked debt instead of repeating the one-shot', () => {
  const M = seed();
  const cy = MEAP.cycle(M);
  const live = MEAP.screen(M, cy);
  expect(live.speak.length === 1 && live.speak[0].claim === SPOKEN && live.speak[0].eps <= 0.35 && live.park.length === 4, JSON.stringify(live.speak));
  const tap = MEAP.commit(M, cy, cy.resolution.candidate_id, true);
  expect(tap.ok && tap.manifest.problem_id === PID && tap.manifest.goal === GOAL && tap.manifest.cycle === 1 && tap.manifest.parent_hash === M.hash, JSON.stringify({ ok: tap.ok, cycle: tap.manifest && tap.manifest.cycle }));
  const prior = live.park.map(a => ({ claim: a.claim, op: a.op, blocked_on: a.blocked_on }));
  const cy2 = MEAP.cycle(tap.manifest, { prior });
  expect(cy2.problem_id === PID && cy2.parent_hash === tap.manifest.hash, cy2.parent_hash);
  expect(cy2.unknown_vector.some(u => u.id === 'u1' && u.resolved === false && u.gap === 'missing'), JSON.stringify(cy2.unknown_vector));
  expect(cy2.unknown_vector.some(u => u.id === 'u2' && u.resolved === false && u.gap === 'explicit_unknown'), JSON.stringify(cy2.unknown_vector));
  const next = MEAP.screen(tap.manifest, cy2);
  expect(Array.isArray(next.carried) && next.carried.filter(c => c.carried_from === 'archive').length === 4, JSON.stringify(next.carried || null));
  expect(next.carried.some(c => /144\/90/.test(c.claim) && (c.blocked_on || []).includes('novelty:overextended')), 'the parked ratio was not carried');
  expect(!next.speak.some(s => s.claim === SPOKEN || /1\.6/.test(s.claim) || /16th harmonic/.test(s.claim)), JSON.stringify(next.speak));
  expect(next.park.length === 0, 'parked debt was emitted again: ' + next.park.length);
  expect(next.speak.every(s => s.eps <= 0.35), JSON.stringify(next.speak));
  expect(!cy2.resolution, 'the carried cycle still offered the same resolution to seal');
  const cells = MEAP.mutableCandidates([
    { fam: 'frame', row: 'ADJ_INF', key: 'able', base: 'subj', proposed: 'karma', legal: true, eps: 0 },
    { fam: 'parser', row: 'ADV', key: 'well', base: false, proposed: true, legal: true, eps: 0 }
  ]);
  expect(cells.length === 2 && cells.some(c => c.fam === 'frame') && cells.some(c => c.fam === 'parser'), JSON.stringify(cells));
  expect(cells.every(c => c.applied === false && c.authority === 'proposal' && c.schema === 'MEAMutableCell/v1' && c.eps <= 0.35 && c.proposed !== c.base), JSON.stringify(cells));
  expect(MEAP.OPERATORS.llm_generate && MEAP.OPERATORS.llm_generate.executable === false, 'llm_generate is executable');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4108', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4108', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 0));
  process.exit(failed ? 1 : 0);
})();
