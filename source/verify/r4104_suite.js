/* R4104 (4.9.104): one MEA-P cycle on the canonical 144 Hz problem.
 * M_t is a problem manifest, not the RMC meaning. A registered operator proposes.
 * DRIFT_TABLE + RSOC_STANDING + EDE novelty decide what is spoken.
 * The reply is a proposal. A tap is still the only commit.
 * Parked candidates are appended once. Nothing is written to memory, the world,
 * the drift archive, or the shared KB. No LLM.
 * Written FIRST (failing). */
const ROOT = require('path').join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const MEAP = require(ROOT + '/src/mea_p.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const mk = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-26T03:10:00Z' });
const ids = r => ((r.trace && r.trace.rules) || []).map(x => x.id);
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
const quiet = k => {
  expect(sharedN(k) === 0, 'shared KB written');
  expect((k.store.load('drift_archive') || []).length === 0, 'drift archive written');
  expect(!(k.worldState().entities || []).length, 'world written');
};
const PID = 'canon:physics-144hz';
const SPOKEN = '144 Hz is a substrate (fundamental) frequency';
const SHOWN = 'I derived 1 hypothesis from the problem: (1) “144 Hz is a substrate (fundamental) frequency”. I have not stored the problem. I can only seal it after your confirmation. I archived 4 candidates.';
const durable = k => { const w = k.worldState(); return JSON.stringify({ entities: w.entities || [], relations: w.relations || [], attributes: w.attributes || [] }); };

T('drift bands park correction, quarantine and a hard stop', () => {
  const M = MEAP.normalize(require(ROOT + '/src/mea_problems_data.js').problems.find(p => p.id === PID));
  expect(M.schema === 'MEAProblemManifest/v1', M.schema);
  const cy = MEAP.cycle(M);
  const live = MEAP.screen(M, cy);
  expect(live.speak.length === 1 && live.speak[0].claim === SPOKEN && live.park.length === 4, JSON.stringify(live.speak.map(s => s.claim)));
  const sub = i => { const c = JSON.parse(JSON.stringify(cy)); const t = c.candidates.find(x => x.claim === SPOKEN); t.terms.eps = i; return MEAP.screen(M, c); };
  const corr = sub(370000);
  expect(!corr.speak.some(s => s.claim === SPOKEN) && corr.park.some(a => a.claim === SPOKEN && a.blocked_on.includes('band:correct') && a.drift_route === 'correct'), JSON.stringify(corr.park.filter(a => a.claim === SPOKEN)));
  const quar = sub(550000);
  expect(quar.park.some(a => a.claim === SPOKEN && a.blocked_on.includes('band:quarantine')), 'quarantine was spoken');
  const stop = JSON.parse(JSON.stringify(cy)); stop.stop = { rule: 'MEA-DRIFT-EXCURSION' };
  const hard = MEAP.screen(M, stop);
  expect(!hard.speak.length && hard.park.length === cy.candidates.length && hard.park.every(a => a.blocked_on.includes('band:hard_stop')), 'a hard stop still spoke');
  expect(MEAP.OPERATORS.llm_generate && MEAP.OPERATORS.llm_generate.executable === false, 'llm_generate is executable');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4104', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4104', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 0));
  process.exit(failed ? 1 : 0);
})();
