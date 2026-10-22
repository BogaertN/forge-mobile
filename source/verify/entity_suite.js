/* EV-ENTITY (4.9.75, Nic rulings 12:32; written FIRST, before the implementation).
 * (1) PRIMARY ENTITY from the title OR the lead subject (the first sentence's grammatical subject; for a court opinion, the case name's
 *     parties), deterministically, so peer-reviewed papers and opinions are not wrongly set aside. Ordinal and "about the entity"
 *     mismatches still reject (SUBJECT_MISMATCH).
 * (2) "What is X?": a definitional sentence whose grammatical subject is X and whose predicate states what X is or does fits
 *     ("The First Amendment … prevents Congress from …"), not only "X is a …"; still verbatim and still subject-guarded.
 * Async; child process of verify/run.js; JSON rows; fixture web only. */
const ROOT = require('path').join(__dirname, '..'); const fs = require('fs');
const KMOD = require(ROOT + '/src/kernel.js'), FK = require(ROOT + '/src/forge.js'), LEX = require(ROOT + '/data/lexicon.json');
let PV = null; try { PV = require(ROOT + '/src/provenance.js'); } catch (e) { PV = null; }
const needPV = () => { if (!PV) throw new Error('src/provenance.js is missing'); return PV; };
const need = (o, k) => { if (!o || typeof o[k] !== 'function') throw new Error(k + ' is missing'); return o[k]; };
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn }); const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
let tick = 0; const clock = () => new Date(Date.UTC(2026, 9, 19, 16, 0, 0) + (tick++) * 1000).toISOString();
const mkStore = () => { const st = {}; return KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }); };
/* a MediaWiki stand-in: search lists every page; extracts serve the asked titles; everything else (every curated archive) answers 404 */
function wiki(pages, extra) { const f = async u => { u = String(u); const ok = (ct, b) => ({ ok: true, status: 200, url: u, headers: { get: h => (String(h).toLowerCase() === 'content-type' ? ct : null) }, text: async () => b, json: async () => JSON.parse(b) });
    if (/robots\.txt$/.test(u)) return ok('text/plain', 'User-agent: *\nDisallow: /w/index.php?title=Special'); const d = decodeURIComponent(u);
    if (/wikipedia\.org/.test(u) && d.includes('list=search')) return ok('application/json', JSON.stringify({ query: { search: Object.keys(pages).map(t => ({ title: t })) } }));
    if (/wikipedia\.org/.test(u) && d.includes('titles=')) { const ts = d.split('titles=')[1].split('&')[0].split('|'); return ok('application/json', JSON.stringify({ query: { pages: Object.fromEntries(ts.filter(t => pages[t]).map((t, i) => [i + 1, { title: t, extract: d.includes('exintro=1') ? pages[t].split('\n')[0] : pages[t] }])) } })); }
    for (const [k, v] of Object.entries(extra || {})) if (u.includes(k)) return ok(v.ct || 'application/rss+xml', v.body);
    return { ok: false, status: 404, url: u, headers: { get: () => '' }, text: async () => '', json: async () => ({}) }; }; return f; }
const FA = 'First Amendment to the United States Constitution', TWENTY_FIRST = 'Twenty-first Amendment to the United States Constitution', AUDIT = 'First Amendment audit';
const AMEND = { [TWENTY_FIRST]: 'The Twenty-first Amendment to the United States Constitution repealed the Eighteenth Amendment. It is the only amendment to repeal another.',
  [AUDIT]: 'A First Amendment audit is a social movement that involves photographing or filming public spaces. Auditors test the First Amendment in public places.',
  [FA]: 'The First Amendment to the United States Constitution prevents Congress from making laws that regulate an establishment of religion. It protects freedom of speech and of the press.' };
const MISMATCH_ONLY = { [TWENTY_FIRST]: AMEND[TWENTY_FIRST], [AUDIT]: AMEND[AUDIT] };
async function kern(pages, extra) { const f = FK.ForgeKernel({ clock, lexicon: LEX, store: mkStore(), vaultIterations: 1000, fetch: wiki(pages, extra) }); await f.vault.setup('correct horse'); await f.vault.unlock('correct horse'); return f; }
const memo = {}; const ask = async (pages, q) => { const k = q + '|' + JSON.stringify(pages); if (memo[k]) return memo[k]; const f = await kern(pages); const r = f.process(q); const t = r.toolJob ? await r.toolJob : null; return (memo[k] = { f, r, t, m: t && t.trace.msm.meaning }); };
let AR = null; try { AR = require(ROOT + '/src/archives.js'); } catch (e) { AR = null; }
const PAPER = { archive: 'openalex', name: 'OpenAlex', cls: 'peer_reviewed', title: 'Effects of long-term use on the gastric mucosa: a randomized trial', excerpt: 'Ibuprofen increases the risk of gastric bleeding in adults. The trial followed 400 patients.' };
const OPINION = { archive: 'courtlistener', name: 'CourtListener', cls: 'primary_authority', title: 'Miranda v. Arizona', excerpt: 'The prosecution may not use statements stemming from custodial interrogation unless procedural safeguards are used.' };
T('entity (1): a peer-reviewed paper whose title head is not the entity qualifies by its lead subject (first sentence subject); the match says so', () => { const P = needPV();
  const m = P.subjectMatch('ibuprofen', PAPER); expect(m.ok === true && m.via === 'question' && m.basis === 'lead', JSON.stringify(m)); });
T('entity (1): a court opinion qualifies by a party of its case name ("Miranda v. Arizona" → Miranda, Arizona)', () => { const P = needPV();
  const a = P.subjectMatch('miranda', OPINION), b = P.subjectMatch('arizona', OPINION); expect(a.ok && a.basis === 'party' && b.ok && b.basis === 'party', JSON.stringify([a, b])); });
T('entity (1): ordinal and "about the entity" mismatches still reject through the lead subject and the parties', () => { const P = needPV();
  const cases = [{ cls: 'peer_reviewed', archive: 'openalex', title: 'Repeal and the states', excerpt: 'The Twenty-first Amendment repealed national Prohibition in 1933.' },
    { cls: 'peer_reviewed', archive: 'openalex', title: 'Policing public spaces', excerpt: 'A First Amendment audit is a social movement that involves filming public spaces.' },
    { cls: 'primary_authority', archive: 'courtlistener', title: 'First Amendment Coalition v. Becerra', excerpt: 'The coalition challenged a records statute.' }];
  for (const s of cases) { const m = P.subjectMatch('first amendment', s); expect(m.ok === false && m.limitation === 'SUBJECT_MISMATCH', s.title + ' accepted: ' + JSON.stringify(m)); } });
T('entity (1): in the report a lead-subject paper is cited with its tier (not set aside) and its verbatim span supports the claim', () => { const P = needPV();
  const plan = { question: 'does ibuprofen increase gastric bleeding', atype: 'verdict', pred: 'increase', predForms: ['increases', 'increase'], args: ['ibuprofen', 'gastric', 'bleeding'] };
  const pv = P.report([PAPER], plan, { kind: 'verdict', answer: 'yes' }, { questionEntity: 'ibuprofen' });
  expect((pv.rejected || []).length === 0 && pv.sources.length === 1 && pv.sources[0].tier === 'peer_reviewed_index' && pv.sources[0].supported === true && PAPER.excerpt.includes(pv.sources[0].span), JSON.stringify(pv)); });
T('entity (2): a definitional sentence whose subject is X and whose predicate says what X does fits "What is X?"; a sentence with another subject does not', () => {
  if (!AR || !AR.fit) throw new Error('archives.js fit is missing'); const plan = { atype: 'description', object: 'first amendment', args: ['first', 'amendment'], question: 'what is the first amendment' };
  expect(AR.fit({ excerpt: AMEND[FA].split('. ')[0] + '.', title: FA }, plan) === true, 'the definitional "prevents" sentence does not fit');
  expect(AR.fit({ excerpt: 'Auditors test the First Amendment in public places.', title: 'x' }, plan) === false, 'a sentence whose subject is not X fits');
  expect(AR.fit({ excerpt: 'Scholars often cite the First Amendment when they write.', title: 'x' }, plan) === false, 'a sentence whose subject is not X fits (2)'); });
T('entity (2) end to end: "What is the first amendment?" answers with the verbatim definitional sentence of the First Amendment article (not "related passages"); the mismatched articles stay set aside', async () => {
  const { t, m } = await ask(AMEND, 'What is the first amendment?'); const reply = (t && t.reply) || '';
  expect(/the First Amendment to the United States Constitution prevents Congress from making laws that regulate an establishment of religion/i.test(reply + ' || ' + ((m && !m.generated && m.excerpt) || '')) && /First Amendment/.test(reply) && !/^No source/.test(reply), reply); /* 4.9.87: realized from roles (source as kartā of a reporting verb, the link as its sthāna); the passage stays sealed in the meaning */ /* 4.9.86: short shape (generated, or the source says "…") */
  expect(m.provenance.sources.length === 1 && m.provenance.sources[0].supported === true && (m.provenance.rejected || []).length === 2 && !/Twenty-first|repeal/.test(reply), JSON.stringify(m.provenance).slice(0, 400));
  expect(t.trace.echo.pass, 'Echo failed'); });

(async () => { for (const t of tests) { let ok = false, why = ''; try { const v = await t.fn(); ok = v === undefined || v === true; } catch (e) { why = String(e.message).slice(0, 600); } rows.push({ cls: 'EV-ENTITY', name: t.name, ok, why }); } process.stdout.write(JSON.stringify(rows)); })();
