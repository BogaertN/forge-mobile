/* R497 (4.9.97): residual generative Echo — naming asides, list commas, pronoun locality —
 * and assimilation intake (projectable vs contested) from research standing.
 * Written FIRST (failing). General pathway rules, not answer patches. */
const ROOT = require('path').join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js'), G = require(ROOT + '/src/grammar.js'), QC = require(ROOT + '/src/qcompile.js');
const KM = require(ROOT + '/src/kmath.js');
const FK = require(ROOT + '/src/forge.js');
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
const SUP = { C: 1, K: 1, S: 1, R: 0 };

T('naming: comma aka aside is not the claim', () => {
  const k = mk(); const sent = 'Quartz, aka silica, is a hard mineral crystal.';
  const gens = gen(k, sent, hooksOf(k));
  const g = echoed(gens).find(x => /mineral/i.test(x.text));
  expect(!!g, 'no echoed claim: ' + JSON.stringify((gens || []).map(x => ({ t: x.text, e: x.echo }))));
  expect(/quartz/i.test(g.text) && /mineral/i.test(g.text), g.text);
  expect(!/\baka\b|silica/i.test(g.text), 'alias stayed in the claim: ' + g.text);
});
T('naming: dash aside leaves the finite verb', () => {
  const k = mk(); const sent = 'The mineral quartz — also known as silica — forms hard crystals.';
  const gens = gen(k, sent, hooksOf(k));
  const g = echoed(gens).find(x => /crystal/i.test(x.text));
  expect(!!g, 'no echoed claim: ' + JSON.stringify((gens || []).map(x => ({ t: x.text, e: x.echo }))));
  expect(/form/i.test(g.text) && /quartz/i.test(g.text), g.text);
  expect(!/known as silica|silica/i.test(g.text), 'naming dash stayed: ' + g.text);
});
T('naming: comma-bounded or-alias is not the claim', () => {
  const k = mk(); const sent = 'A lion, or a big cat, hunts at night in the grass.';
  const gens = gen(k, sent, hooksOf(k));
  const g = echoed(gens).find(x => /lion/i.test(x.text));
  expect(!!g, 'no echoed claim: ' + JSON.stringify((gens || []).map(x => ({ t: x.text, e: x.echo }))));
  expect(/hunt/i.test(g.text), g.text);
  expect(!/big cat/i.test(g.text), 'or-alias stayed: ' + g.text);
});
T('naming: reduced relative does not steal the finite verb', () => {
  const k = mk(); const sent = 'A device called the telephone sends voice over a wire.';
  const gens = gen(k, sent, hooksOf(k));
  const g = echoed(gens).find(x => /voice/i.test(x.text));
  expect(!!g, 'no echoed claim: ' + JSON.stringify((gens || []).map(x => ({ t: x.text, e: x.echo, lemma: x.roles && x.roles.lemma }))));
  expect(/send/i.test(g.text), g.text);
  expect(g.roles && g.roles.lemma !== 'call', 'called stayed the main verb: ' + JSON.stringify(g.roles));
  expect(!/called/i.test(g.text), 'alias stayed in the claim: ' + g.text);
});
T('list: long Oxford coordination keeps every conjunct', () => {
  const k = mk(); const sent = 'Granite contains quartz, alkali feldspar, plagioclase, biotite, and muscovite.';
  const gens = gen(k, sent, hooksOf(k));
  const g = echoed(gens).find(x => /muscovite/i.test(x.text) && /quartz/i.test(x.text));
  expect(!!g, 'list dropped: ' + JSON.stringify((gens || []).map(x => ({ t: x.text, e: x.echo }))));
  for (const w of ['quartz', 'feldspar', 'plagioclase', 'biotite', 'muscovite']) expect(new RegExp(w, 'i').test(g.text), 'missing ' + w + ' in ' + g.text);
});
T('list: long coordination without the Oxford comma keeps every conjunct', () => {
  const k = mk(); const sent = 'Granite contains quartz, alkali feldspar, plagioclase, biotite and muscovite.';
  const gens = gen(k, sent, hooksOf(k));
  const g = echoed(gens).find(x => /muscovite/i.test(x.text) && /feldspar/i.test(x.text));
  expect(!!g, 'truncated or dropped: ' + JSON.stringify((gens || []).map(x => ({ t: x.text, e: x.echo }))));
  expect(!/^Granite contains quartz\.$/i.test(g.text), 'only the first conjunct: ' + g.text);
  for (const w of ['quartz', 'feldspar', 'plagioclase', 'biotite', 'muscovite']) expect(new RegExp(w, 'i').test(g.text), 'missing ' + w + ' in ' + g.text);
});
T('pronoun: lead It takes the article subject', () => {
  const k = mk(); const sent = 'It is a violently rotating column of air.';
  const gens = gen(k, sent, hooksOf(k, { leadName: 'tornado', inLead: true }));
  const g = echoed(gens).find(x => /tornado/i.test(x.text) && /column/i.test(x.text));
  expect(!!g, 'lead It did not bind: ' + JSON.stringify((gens || []).map(x => ({ t: x.text, e: x.echo }))));
  expect(/\bthe tornado\b/i.test(g.text), g.text);
});
T('pronoun: lead He takes the proper name', () => {
  const k = mk(); const sent = 'He was born in England in 1643.';
  const gens = gen(k, sent, hooksOf(k, { leadName: 'isaac newton', inLead: true }));
  const g = echoed(gens).find(x => /newton/i.test(x.text));
  expect(!!g, 'lead He did not bind: ' + JSON.stringify((gens || []).map(x => ({ t: x.text, e: x.echo }))));
  expect(/Isaac Newton/i.test(g.text) && /born|bear/i.test(g.text), g.text);
});
T('pronoun: past the lead, It is the local antecedent', () => {
  const k = mk(); const sent = 'Warm air rises quickly. It forms a funnel over the plains.';
  const gens = gen(k, sent, hooksOf(k, { leadName: 'tornado', inLead: true }));
  const funnel = (gens || []).filter(x => /funnel/i.test(x.text));
  const ok = funnel.filter(x => x.echo && /warm air/i.test(x.text) && !/tornado/i.test(x.text));
  expect(ok.length > 0, 'local It failed: ' + JSON.stringify(funnel.map(x => ({ t: x.text, e: x.echo }))));
  expect(!funnel.some(x => x.echo && /tornado/i.test(x.text)), 'article name bound past the lead');
});
T('pronoun: a body sentence does not take the article name', () => {
  const k = mk(); const sent = 'It forms a funnel over the plains.';
  const gens = gen(k, sent, hooksOf(k, { leadName: 'tornado', inLead: false }));
  expect((gens || []).every(x => !/tornado/i.test(x.text)), 'body It became the article: ' + JSON.stringify((gens || []).map(x => x.text)));
});
T('pronoun: lead They takes the plural article subject', () => {
  const k = mk(); const sent = 'They are the largest planets in the system.';
  const gens = gen(k, sent, hooksOf(k, { leadName: 'giant planet', inLead: true }));
  const g = echoed(gens).find(x => /planet/i.test(x.text));
  expect(!!g, 'lead They did not bind: ' + JSON.stringify((gens || []).map(x => ({ t: x.text, e: x.echo }))));
  expect(/planets/i.test(g.text) && !/planet are/i.test(g.text), g.text);
});

T('intake: projectable at or under 0.35 when the standing is supported', () => {
  expect(typeof QC.intakeStanding === 'function', 'QC.intakeStanding missing');
  const a = QC.intakeStanding({ drift: 0.2, dims: SUP, superseded: 0 });
  expect(a && a.schema === 'FORGE-ASSIMILATION-INTAKE/v1', JSON.stringify(a));
  expect(a.intake === 'projectable' && a.offer === 'remember' && a.hold === false && a.stored === false && a.shared_kb === false, JSON.stringify(a));
  expect(a.eps_w === 0, 'eps_w ' + a.eps_w);
});
T('intake: correction band is χ once, then re-measured', () => {
  const a = QC.intakeStanding({ drift: 0.37, dims: SUP, superseded: 0 });
  expect(a.intake === 'correction', JSON.stringify(a));
  const ch = QC.correct(0.37, [{ drift: 0.05 }]);
  expect(ch.applied === true, JSON.stringify(ch));
  const b = QC.intakeStanding({ drift: ch.eps_after, dims: SUP, superseded: 0, chiApplied: true });
  expect(b.intake === 'projectable' && b.stored === false, JSON.stringify(b));
  const none = QC.correct(0.37, []);
  expect(none.applied === false, JSON.stringify(none));
  const stuck = QC.intakeStanding({ drift: 0.37, dims: SUP, superseded: 0, chiApplied: true });
  expect(stuck.intake === 'contested' && stuck.hold === true && stuck.offer == null, JSON.stringify(stuck));
});
T('intake: quarantine, conflict, ε_w and hard stop', () => {
  const q = QC.intakeStanding({ drift: 0.5, dims: SUP, superseded: 0 });
  expect(q.intake === 'contested' && q.hold === true && q.stored === false && q.shared_kb === false, JSON.stringify(q));
  const cf = QC.intakeStanding({ drift: 0.1, dims: { C: 1, K: 1, S: 1, R: 1 }, superseded: 0 });
  expect(cf.intake === 'contested' && cf.hold === true && (cf.standing === 'conflicted' || cf.route === 'quarantine'), JSON.stringify(cf));
  const w = QC.intakeStanding({ drift: 0.2, dims: SUP, superseded: 1 });
  expect(Math.abs(w.eps_w - 0.5) < 1e-9 && w.intake === 'contested', JSON.stringify(w));
  const h = QC.intakeStanding({ drift: 0.9, dims: SUP, superseded: 0 });
  expect(h.intake === 'hard_stop' && h.hold === false && h.offer == null && h.stored === false, JSON.stringify(h));
  expect(KM.DRIFT_RULING.project_max === 0.35, 'drift table moved');
});
T('intake: research writes reuse the permission service', () => {
  const k = mk();
  const held = k.perm.decide('memory.write', { researchIntake: true, contested: true, explicit: false });
  expect(held.decision === 'needs_approval' && held.rule === 'PERM-D10-CONTESTED-OR-SENSITIVE', JSON.stringify(held));
  const deny = k.perm.decide('memory.write', { researchIntake: true, contested: false, explicit: true });
  expect(deny.decision === 'deny' && deny.rule === 'PERM-RESEARCH-NO-SILENT-WRITE', JSON.stringify(deny));
});

let tick = 0; const clock = () => new Date(Date.UTC(2026, 9, 25, 23, 0, 0) + (tick++) * 1000).toISOString();
const mkStore = () => { const st = {}; return KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }); };
function wiki(pages) { const f = u => { u = String(u); const ok = (ct, b) => Promise.resolve({ ok: true, status: 200, url: u, headers: { get: h => String(h).toLowerCase() === 'content-type' ? ct : null }, text: () => Promise.resolve(b) });
  if (/robots\.txt$/.test(u)) return ok('text/plain', 'User-agent: *\nDisallow: /w/index.php?title=Special'); const d = decodeURIComponent(u);
  if (/wikipedia\.org/.test(u) && d.includes('list=search')) return ok('application/json', JSON.stringify({ query: { search: Object.keys(pages).map(t => ({ title: t })) } }));
  if (/wikipedia\.org/.test(u) && d.includes('titles=')) { const ts = d.split('titles=')[1].split('&')[0].split('|'); return ok('application/json', JSON.stringify({ query: { pages: Object.fromEntries(ts.filter(t => pages[t]).map((t, i) => [i + 1, { title: t, extract: d.includes('exintro=1') ? pages[t].split('\n')[0] : pages[t] }])) } })); }
  return Promise.resolve({ ok: false, status: 404, url: u, headers: { get: () => '' }, text: () => Promise.resolve('') }); }; return f; }
const QUARTZ = { Quartz: 'Quartz is a mineral found in rock.' };
async function kern(pages) { const f = FK.ForgeKernel({ clock, lexicon: LEX, store: mkStore(), vaultIterations: 1000, fetch: wiki(pages) }); await f.vault.setup('correct horse'); await f.vault.unlock('correct horse'); return f; }

T('intake: a projectable research reply is offered, never stored', async () => {
  const f = await kern(QUARTZ); const r = f.process('what is quartz?'); const t = r.toolJob ? await r.toolJob : null;
  const m = t && t.trace && t.trace.msm && t.trace.msm.meaning;
  const a = (m && m.assimilation) || (t && t.trace && t.trace.research && t.trace.research.assimilation);
  expect(!!a, 'no assimilation on the research trace: ' + (t && t.reply));
  expect(a.intake === 'projectable' && a.stored === false && a.shared_kb === false && a.offer === 'remember', JSON.stringify(a));
  expect(t.trace.echo && t.trace.echo.pass, 'echo blocked the reply: ' + (t && t.reply) + ' ' + JSON.stringify(t && t.trace && t.trace.echo));
  expect(/have not stored/i.test(t.reply || '') && /remember that/i.test(t.reply || ''), t && t.reply);
  expect(f.store.load('memory').length === 0, 'live lookup stored a fact');
  expect((f.store.load('shared_knowledge') || []).length === 0, 'shared KB written');
  expect((f.store.load('held_writes') || []).length === 0, 'projectable claim was held');
});
T('intake: a contested research claim is held for a tap and still not stored', async () => {
  const f = await kern(QUARTZ); const r = f.process('what is quartz?'); const t = r.toolJob ? await r.toolJob : null;
  const m = t && t.trace.msm.meaning; expect(m && m.generated && m.generated.clause, 'no generated clause to hold');
  expect(typeof f.researchIntake === 'function', 'researchIntake missing');
  const fake = { kind: 'research_answer', generated: { clause: m.generated.clause, text: m.generated.text, drift: 0.55 }, excerpt: m.excerpt, conflict: true, excerpt2: 'A different claim.', undetermined: true };
  f.researchIntake(fake, { chosen: { drift: 0.55 } }, 'what is quartz?');
  expect(fake.assimilation && fake.assimilation.intake === 'contested' && fake.assimilation.hold === true && fake.assimilation.stored === false, JSON.stringify(fake.assimilation));
  expect(fake.assimilation.held_id, 'contested claim was not held');
  expect(f.store.load('memory').length === 0, 'held claim was stored');
  expect((f.store.load('shared_knowledge') || []).length === 0, 'shared KB written');
  const refused = f.commitHeld(fake.assimilation.held_id, false);
  expect(refused && refused.ok === false, JSON.stringify(refused));
  expect(f.store.load('memory').length === 0, 'tap-less commit stored it');
  const ok = f.commitHeld(fake.assimilation.held_id, true);
  expect(ok && ok.ok === true, JSON.stringify(ok));
  expect(f.store.load('memory').length === 1, 'user tap did not store');
  expect((f.store.load('shared_knowledge') || []).length === 0, 'shared KB written on tap');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R497', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R497', name: t.name, ok: false, why: String(e.message || e).slice(0, 400) }); }
  }
  console.log(JSON.stringify(rows));
  process.exit(failed ? 1 : 0);
})();
