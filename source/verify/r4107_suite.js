/* R4107 (4.9.107): evidence admission is a named intake status.
 * Research stays PROPOSE_EVIDENCE and does not write memory, the world head, or the shared KB.
 * Contested holds are inspectable on show quarantine / show containment.
 * A projectable claim is stored only by an explicit remember (REQUEST_COMMIT).
 * Written FIRST (failing). */
const ROOT = require('path').join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const QC = require(ROOT + '/src/qcompile.js');
const KM = require(ROOT + '/src/kmath.js');
const FK = require(ROOT + '/src/forge.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-26T05:10:00Z';
const SUP = { C: 1, K: 1, S: 1, R: 0 };
const mk = (o) => KMOD.Kernel(Object.assign({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK }, o || {}));
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
const head = k => (typeof k.worldHead === 'function' ? k.worldHead() : null);
const noChrist = text => expect(!/Christ function/i.test(String(text || '')), text);
const PHYSICS = 'I derived 1 hypothesis from the problem: (1) “144 Hz is a substrate (fundamental) frequency”. I have not stored the problem. I can only seal it after your confirmation. I archived 4 candidates.';
const HELD_LINE = 'held quartz is a mineral found in rock';
const QUARANTINE_HELD = 'I have no items in the dream quarantine. I have 1 claim in the quarantine: (1) “' + HELD_LINE + '”.';

let tick = 0; const clock = () => new Date(Date.UTC(2026, 9, 26, 5, 10, 0) + (tick++) * 1000).toISOString();
const mkStore = () => { const st = {}; return KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }); };
function wiki(pages) { const f = u => { u = String(u); const ok = (ct, b) => Promise.resolve({ ok: true, status: 200, url: u, headers: { get: h => String(h).toLowerCase() === 'content-type' ? ct : null }, text: () => Promise.resolve(b) });
  if (/robots\.txt$/.test(u)) return ok('text/plain', 'User-agent: *\nDisallow: /w/index.php?title=Special'); const d = decodeURIComponent(u);
  if (/wikipedia\.org/.test(u) && d.includes('list=search')) return ok('application/json', JSON.stringify({ query: { search: Object.keys(pages).map(t => ({ title: t })) } }));
  if (/wikipedia\.org/.test(u) && d.includes('titles=')) { const ts = d.split('titles=')[1].split('&')[0].split('|'); return ok('application/json', JSON.stringify({ query: { pages: Object.fromEntries(ts.filter(t => pages[t]).map((t, i) => [i + 1, { title: t, extract: d.includes('exintro=1') ? pages[t].split('\n')[0] : pages[t] }])) } })); }
  return Promise.resolve({ ok: false, status: 404, url: u, headers: { get: () => '' }, text: () => Promise.resolve('') }); }; return f; }
const QUARTZ = { Quartz: 'Quartz is a mineral found in rock.' };
async function kern(pages) { const f = FK.ForgeKernel({ clock, lexicon: LEX, store: mkStore(), vaultIterations: 1000, fetch: wiki(pages || QUARTZ) }); await f.vault.setup('correct horse'); await f.vault.unlock('correct horse'); return f; }
function speak(k, m) { const real = k.realize(m); const echo = k.echo(real.text, m); return { text: real.text, pass: !!(echo && echo.pass), why: echo && (echo.reason || echo.disposition) }; }

T('the drift table names projectable, contested, and refused', () => {
  expect(KM.DRIFT_RULING.project_max === 0.35, 'drift table moved');
  const p = QC.intakeStanding({ drift: 0.2, dims: SUP, superseded: 0 });
  expect(p.intake === 'projectable' && p.admission === 'projectable' && p.offer === 'remember' && p.hold === false && p.stored === false && p.shared_kb === false, JSON.stringify(p));
  const mid = QC.intakeStanding({ drift: 0.37, dims: SUP, superseded: 0 });
  expect(mid.intake === 'correction' && mid.admission == null, JSON.stringify(mid));
  const ch = QC.correct(0.37, [{ drift: 0.05 }]);
  expect(ch.applied === true, JSON.stringify(ch));
  const back = QC.intakeStanding({ drift: ch.eps_after, dims: SUP, superseded: 0, chiApplied: true });
  expect(back.intake === 'projectable' && back.admission === 'projectable' && back.stored === false, JSON.stringify(back));
  const stuck = QC.intakeStanding({ drift: 0.37, dims: SUP, superseded: 0, chiApplied: true });
  expect(stuck.intake === 'contested' && stuck.admission === 'contested' && stuck.hold === true, JSON.stringify(stuck));
  const q = QC.intakeStanding({ drift: 0.5, dims: SUP, superseded: 0 });
  expect(q.intake === 'contested' && q.admission === 'contested' && q.route === 'quarantine' && q.stored === false && q.shared_kb === false, JSON.stringify(q));
  const h = QC.intakeStanding({ drift: 0.9, dims: SUP, superseded: 0 });
  expect(h.intake === 'hard_stop' && h.admission === 'refused' && h.hold === false && h.offer == null && h.stored === false, JSON.stringify(h));
});

T('a reply names projectable, contested, and refused and does not store', () => {
  const k = mk();
  const base = { kind: 'research_answer', source: 'Quartz', archive: 'Wikipedia', cls: 'encyclopedia', unsupported: true, asked: 'description' };
  const proj = speak(k, Object.assign({}, base, { assimilation: QC.intakeStanding({ drift: 0.2, dims: SUP, superseded: 0 }) }));
  expect(proj.pass, proj.why + ' ' + proj.text);
  expect(/have not stored/i.test(proj.text) && /remember that/i.test(proj.text) && /It is the status “projectable”\./.test(proj.text), proj.text);
  const cont = speak(k, Object.assign({}, base, { assimilation: QC.intakeStanding({ drift: 0.5, dims: SUP, superseded: 0 }) }));
  expect(cont.pass, cont.why + ' ' + cont.text);
  expect(/have not stored/i.test(cont.text) && /It is the status “contested”\./.test(cont.text) && !/projectable/.test(cont.text), cont.text);
  const stop = speak(k, Object.assign({}, base, { assimilation: QC.intakeStanding({ drift: 0.9, dims: SUP, superseded: 0 }) }));
  expect(stop.pass, stop.why + ' ' + stop.text);
  expect(/have not stored/i.test(stop.text) && /It is the status “refused”\./.test(stop.text) && !/remember that/.test(stop.text), stop.text);
  expect(!k.memory().length && sharedN(k) === 0 && head(k).committed === false, 'a status sentence stored a fact');
  noChrist(proj.text); noChrist(cont.text); noChrist(stop.text);
});

T('a projectable research answer is a candidate until remember', async () => {
  const f = await kern();
  const h0 = head(f);
  const r = f.process('what is quartz?');
  const t = r.toolJob ? await r.toolJob : null;
  const m = t && t.trace && t.trace.msm && t.trace.msm.meaning;
  const a = (m && m.assimilation) || (t && t.trace && t.trace.admission);
  expect(!!t && t.trace && t.trace.echo && t.trace.echo.pass, t && t.reply);
  expect(t.trace.intent_kind === 'PROPOSE_EVIDENCE', String(t.trace.intent_kind) + ' ' + t.reply);
  expect(a && a.intake === 'projectable' && a.admission === 'projectable' && a.stored === false && a.shared_kb === false && a.offer === 'remember', JSON.stringify(a));
  expect(t.trace.admission === 'projectable', JSON.stringify(t.trace.admission));
  expect(/have not stored/i.test(t.reply) && /remember that/i.test(t.reply) && /It is the status “projectable”\./.test(t.reply), t.reply);
  expect(f.store.load('memory').length === 0, 'the lookup stored a fact');
  expect(sharedN(f) === 0, 'shared KB written');
  expect((f.store.load('held_writes') || []).length === 0, 'a projectable claim was held');
  expect(head(f).version_id === h0.version_id && head(f).content_hash === h0.content_hash, 'the lookup moved the world head');
  const q = f.process('show quarantine');
  expect(q.reply === 'I have no items in the dream quarantine.', q.reply);
  expect(q.trace.intent_kind === 'READ' && head(f).version_id === h0.version_id, q.reply);
  const rem = f.process('remember that Quartz is a mineral found in rock');
  expect(rem.trace.intent_kind === 'REQUEST_COMMIT', rem.trace.intent_kind + ' ' + rem.reply);
  expect(rem.trace.echo && rem.trace.echo.pass, rem.reply);
  expect(/noted/i.test(rem.reply) && /mineral/.test(rem.reply), rem.reply);
  expect(f.store.load('memory').length === 1, 'the explicit remember did not store');
  expect(sharedN(f) === 0, 'remember seeded the shared KB');
  expect(head(f).version_id !== h0.version_id && head(f).committed === true, 'the remember did not commit a head');
  noChrist(t.reply); noChrist(rem.reply);
});

T('a contested research claim is held, inspectable, and stored only by a tap', async () => {
  const f = await kern();
  const h0 = head(f);
  const r = f.process('what is quartz?');
  const t = r.toolJob ? await r.toolJob : null;
  const m = t && t.trace.msm.meaning;
  expect(m && m.generated && m.generated.clause, 'no generated clause to hold');
  const fake = { kind: 'research_answer', source: 'Quartz', archive: 'Wikipedia', cls: 'encyclopedia', source2: 'Other', archive2: 'Wikipedia', cls2: 'encyclopedia', generated: { clause: m.generated.clause, text: m.generated.text, drift: 0.55, source: 'Quartz', archive: 'Wikipedia' }, excerpt: m.excerpt, conflict: true, excerpt2: 'A different claim.', undetermined: true };
  f.researchIntake(fake, { chosen: { drift: 0.55 } }, 'what is quartz?');
  expect(fake.assimilation && fake.assimilation.intake === 'contested' && fake.assimilation.admission === 'held' && fake.assimilation.hold === true && fake.assimilation.stored === false && fake.assimilation.held_id, JSON.stringify(fake.assimilation));
  const said = speak(f, fake);
  expect(said.pass, said.why + ' ' + said.text);
  expect(/contested/.test(said.text) && /It is the status “held”\./.test(said.text) && /have not stored|approval/.test(said.text), said.text);
  expect(f.store.load('memory').length === 0 && sharedN(f) === 0, 'holding the claim stored it');
  expect(head(f).version_id === h0.version_id, 'the hold moved the world head');
  const q = f.process('show quarantine');
  expect(q.reply === QUARANTINE_HELD, q.reply);
  expect(q.trace.intent_kind === 'READ' && q.trace.echo && q.trace.echo.pass, q.reply);
  expect(f.store.load('memory').length === 0 && head(f).version_id === h0.version_id, 'the inspect stored the claim');
  const both = f.process('show containment');
  expect(both.reply === QUARANTINE_HELD + ' I have no records in cold storage.', both.reply);
  expect(both.trace.echo && both.trace.echo.pass, both.reply);
  const refused = f.commitHeld(fake.assimilation.held_id, false);
  expect(refused && refused.ok === false && f.store.load('memory').length === 0, JSON.stringify(refused));
  const still = f.process('show quarantine');
  expect(still.reply === QUARANTINE_HELD, still.reply);
  const ok = f.commitHeld(fake.assimilation.held_id, true);
  expect(ok && ok.ok === true && f.store.load('memory').length === 1, JSON.stringify(ok));
  expect(sharedN(f) === 0, 'the tap seeded the shared KB');
  const gone = f.process('show quarantine');
  expect(gone.reply === 'I have no items in the dream quarantine.', gone.reply);
  expect(!/held quartz/.test(gone.reply), gone.reply);
  noChrist(said.text); noChrist(q.reply);
});

T('guards: physics, dream quarantine, remember, and no Christ function', () => {
  const k = mk();
  const p = k.process('propose problem physics');
  expect(p.reply === PHYSICS, p.reply);
  expect(p.trace.intent_kind === 'PROPOSE_EVIDENCE', p.trace.intent_kind);
  expect(head(k).committed === false, 'the proposal committed a world head');
  const q0 = k.process('show quarantine');
  expect(q0.reply === 'I have no items in the dream quarantine.', q0.reply);
  const d = k.process('suppose my car is red');
  expect(d.trace.intent_kind === 'SIMULATE' && d.trace.containment.route === 'dream_state_quarantine_candidate', d.reply);
  const q = k.process('show quarantine');
  expect(q.reply === 'I have 1 item in the dream quarantine: (1) “dream_state_quarantine_candidate quarantined your car is red”.', q.reply);
  const mem = k.process('remember that my car is red');
  expect(mem.trace.intent_kind === 'REQUEST_COMMIT' && /noted/i.test(mem.reply), mem.reply);
  expect(sharedN(k) === 0, 'shared KB written');
  noChrist(p.reply); noChrist(d.reply); noChrist(q.reply); noChrist(mem.reply);
});

(async () => {
  for (const t of tests) { try { await t.fn(); rows.push({ cls: 'R4107', name: t.name, ok: true }); } catch (e) { rows.push({ cls: 'R4107', name: t.name, ok: false, detail: String(e.message || e).slice(0, 500) }); } }
  console.log(JSON.stringify(rows, null, 0));
  process.exit(rows.some(r => !r.ok) ? 1 : 0);
})();
