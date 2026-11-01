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




(async () => {
  for (const t of tests) { try { await t.fn(); rows.push({ cls: 'R4107', name: t.name, ok: true }); } catch (e) { rows.push({ cls: 'R4107', name: t.name, ok: false, detail: String(e.message || e).slice(0, 500) }); } }
  console.log(JSON.stringify(rows, null, 0));
  process.exit(rows.some(r => !r.ok) ? 1 : 0);
})();
