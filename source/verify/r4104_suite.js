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

T('propose problem physics speaks the bounded hypothesis and parks the rest', () => {
  const k = mk();
  const mem = JSON.stringify(k.memory()), world = durable(k);
  const r = k.process('propose problem physics');
  expect(r.reply === SHOWN, r.reply);
  expect(r.trace.intent_kind === 'PROPOSE_EVIDENCE', (r.trace.intent_kind || 'missing') + ' · ' + r.reply);
  expect(r.trace.selection.winner === 'directive.frame', r.trace.selection && r.trace.selection.winner);
  expect(ids(r).includes('MEAP-PROPOSE') && ids(r).includes('LC-CAP-FRAME'), ids(r).join(','));
  expect(r.trace.echo && r.trace.echo.pass, (r.trace.echo && r.trace.echo.reason) || r.reply);
  expect(/substrate \(fundamental\) frequency/.test(r.reply || ''), r.reply);
  expect(/I have not stored the problem/.test(r.reply || ''), r.reply);
  expect(/I archived 4 candidates/.test(r.reply || ''), r.reply);
  expect(!/verified/.test(r.reply || '') && !/1\.6/.test(r.reply || ''), r.reply);
  expect(JSON.stringify(k.memory()) === mem && durable(k) === world, 'the propose wrote memory or the world');
  expect((k.store.load('mea_problems') || []).length === 0, 'the propose committed a manifest');
  const arc = k.meaArchive();
  expect(arc.length === 4 && arc.every(a => a.problem_id === PID && a.parent_hash), JSON.stringify(arc.map(a => a.id)));
  expect(arc.some(a => /144\/90/.test(a.claim) && (a.blocked_on || []).includes('novelty:overextended')), 'the ratio was not parked');
  expect(arc.some(a => /16th harmonic/.test(a.claim) && (a.blocked_on || []).includes('novelty:overextended')), 'the harmonic was not parked');
  expect(arc.some(a => a.op === 'split' && (a.blocked_on || []).includes('operator:split')), 'the split was not parked');
  const mp = r.trace.mea_p;
  expect(mp && mp.schema === 'MEAProblemManifest/v1' && mp.problem_id === PID && mp.parent_hash, JSON.stringify(mp && mp.schema));
  expect(mp.operators.includes('derive') && mp.operators.includes('hypothesize') && mp.spoken_operators.join() === 'hypothesize', JSON.stringify(mp.operators) + ' / ' + JSON.stringify(mp.spoken_operators));
  expect(mp.speak.length === 1 && mp.speak[0].claim === SPOKEN && mp.speak[0].claim_status === 'hypothesis' && mp.speak[0].route === 'project' && mp.speak[0].novelty === 'bounded' && mp.speak[0].standing === 'undetermined' && mp.speak[0].eps <= 0.35, JSON.stringify(mp.speak));
  const meaning = r.trace.msm.meaning;
  expect(meaning.kind === 'mea_p_proposals' && meaning.problem_id === PID && !meaning.schema && !meaning.known_facts && !meaning.unknowns, JSON.stringify(Object.keys(meaning)));
  expect(meaning.schema !== 'MEAProblemManifest/v1', 'the manifest schema was merged into the meaning');
  quiet(k);
  const again = k.process('propose the problem physics');
  expect(again.trace.intent_kind === 'PROPOSE_EVIDENCE' && ids(again).includes('MEAP-PROPOSE'), (again.trace.intent_kind || '') + ' ' + again.reply);
  expect(/substrate \(fundamental\) frequency/.test(again.reply || '') && /I have not stored the problem/.test(again.reply || '') && !/I archived /.test(again.reply || ''), again.reply);
  expect(k.meaArchive().length === 4, 'the archive was duplicated: ' + k.meaArchive().length);
  expect((k.store.load('mea_problems') || []).length === 0, 'the second propose committed');
  quiet(k);
});
T('an unknown problem proposes nothing and archives nothing', () => {
  const k = mk();
  const r = k.process('propose problem zebra');
  expect(/no problem/.test(r.reply || ''), r.reply);
  expect(!ids(r).includes('MEAP-PROPOSE'), ids(r).join(','));
  expect(!k.meaArchive().length, 'an unknown problem was archived');
  expect(r.trace.intent_kind, 'intent missing');
  quiet(k);
});
T('show problem and show the proposals stay on their own paths', () => {
  const k = mk();
  const shown = k.process('show problem physics');
  expect(/no result/.test(shown.reply || ''), shown.reply);
  expect(shown.trace.intent_kind === 'READ', shown.trace.intent_kind);
  expect(!ids(shown).includes('MEAP-PROPOSE'), ids(shown).join(','));
  const list = k.process('show the problems');
  expect(/^I have 6 problems:/.test(list.reply || ''), list.reply);
  expect(list.trace.intent_kind === 'READ', list.trace.intent_kind);
  const phone = k.process('show the proposals');
  expect(phone.reply === 'I derived no hypothesis from your facts. I have not stored the rule.', phone.reply);
  expect(phone.trace.intent_kind === 'PROPOSE_EVIDENCE' && ids(phone).includes('MEA-PHONE-PROPOSE') && !ids(phone).includes('MEAP-PROPOSE'), ids(phone).join(','));
  expect(!k.meaArchive().length, 'the other frames archived a candidate');
  quiet(k);
});
T('a tap is still required; the propose does not commit', () => {
  const k = mk();
  const r = k.process('propose problem physics');
  expect(r.trace.echo && r.trace.echo.pass, r.reply);
  const cyc = k.meaCycle(PID);
  const no = k.meaCommit(PID, cyc.cycle.resolution.candidate_id, false);
  expect(!no.ok && no.rule === 'PERM-NEEDS-USER-TAP', JSON.stringify(no));
  expect((k.store.load('mea_problems') || []).length === 0, 'a false tap committed');
  expect(/no result/.test(k.process('show problem physics').reply || ''), 'the problem rendered a result');
  quiet(k);
  const yesK = mk();
  expect(yesK.process('propose problem physics').trace.echo.pass, 'echo');
  const cy = yesK.meaCycle(PID);
  const yes = yesK.meaCommit(PID, cy.cycle.resolution.candidate_id, true);
  expect(yes.ok && yes.manifest.claim_status === 'hypothesis', JSON.stringify(yes).slice(0, 240));
  expect((yesK.store.load('mea_problems') || []).some(m => m.problem_id === PID), 'the tap did not store the manifest');
  expect(!yesK.memory().some(x => x.status === 'active'), 'the tap wrote a fact');
  expect(sharedN(yesK) === 0, 'the tap seeded the shared KB');
  const after = yesK.process('show problem physics');
  expect(/hypothesis/.test(after.reply || '') && !/no result/.test(after.reply || ''), after.reply);
});
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
T('guard: a remember is still REQUEST_COMMIT and the reply is unchanged', () => {
  const k = mk();
  const r = k.process('remember that my car is red');
  expect(r.trace.intent_kind === 'REQUEST_COMMIT' && r.reply === 'I noted that your car is red.', (r.trace.intent_kind || '') + ' ' + r.reply);
  expect(r.trace.language !== 'LANGUAGE_UNEXPRESSIBLE', 'a stored remember was unexpressible');
  expect(sharedN(k) === 0, 'shared KB written');
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
