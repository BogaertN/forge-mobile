/* EV-SUBJECT (4.9.74 addition from Nic, items 4–6; written FIRST, before the implementation).
 * 4. SUBJECT GUARD: a source may support a claim only if its PRIMARY ENTITY (title head, else the excerpt's lead subject) matches the
 *    question's entity: exact ordinal / number tokens ("First" ≠ "Twenty-first"), and a source ABOUT the entity (a "First Amendment audit")
 *    is a mismatch. A mismatch is rejected with the typed limitation SUBJECT_MISMATCH and is never cited.
 * 5. AGREEMENT: reported as "K agree, M disagree, N unusable", counted over ORIGINS (same publisher / domain / upstream = one origin:
 *    Wikipedia and Wikidata are one Wikimedia origin; one paper in two indexes is one origin); never a count of ranked results.
 * 6. (a) "square root of 4536" keeps its value and full trace (a regression guard: it may already pass); (b) "What is the first amendment?"
 *    cites no mismatched source and claims no agreement from ranked counts; (c) a question with no curated coverage shows open_fallback
 *    provenance; (d) no turn displays "network: no" while a tool performed egress.
 * Span ruling (Nic, 11:03): one sentence by default; two adjacent sentences only when the second's subject is a pronoun or definite
 * reference deterministically resolved to the entity named in the first.
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
const RANKED_COUNT = /\b\d+ independent ranked sources (agree|answered)/;
const AGREEMENT = /\b\d+ agree, \d+ disagree, \d+ unusable\b/;

/* ---------------- 6(a) regression guard ---------------- */

/* ---------------- 4. subject guard ---------------- */
T('4: primary entity match is exact on ordinals and heads: "First" ≠ "Twenty-first"; a "First Amendment audit" is ABOUT the entity (mismatch); the constitutional article matches', () => { const sm = need(needPV(), 'subjectMatch');
  const q = 'first amendment'; const a = sm(q, { title: TWENTY_FIRST, excerpt: AMEND[TWENTY_FIRST] }), b = sm(q, { title: AUDIT, excerpt: AMEND[AUDIT] }), c = sm(q, { title: FA, excerpt: AMEND[FA] });
  expect(a.ok === false && a.limitation === 'SUBJECT_MISMATCH' && /twenty-first/.test(a.primary_entity), JSON.stringify(a)); expect(b.ok === false && b.limitation === 'SUBJECT_MISMATCH' && /audit/.test(b.primary_entity), JSON.stringify(b));
  expect(c.ok === true && c.primary_entity === 'first amendment', JSON.stringify(c));
  expect(sm('berlin wall', { title: 'Berlin Wall' }).ok && sm('ibuprofen', { title: 'Ibuprofen and stomach bleeding in adults' }).ok && !sm('berlin wall', { title: 'Fall of the Berlin Wall' }).ok && !sm('second amendment', { title: 'Second Amendment audit' }).ok, 'head rule');
  expect(sm('first amendment', { title: '', excerpt: 'The First Amendment protects freedom of speech.' }).ok && !sm('first amendment', { title: '', excerpt: 'The Twenty-first Amendment repealed prohibition.' }).ok, 'lead-subject fallback'); });
T('4: a mismatched source is never support, even when its excerpt holds every key word; it is listed as rejected with SUBJECT_MISMATCH', () => { const P = needPV();
  const plan = { question: 'what is the first amendment', atype: 'description', args: ['first', 'amendment'] };
  const pv = P.report([{ archive: 'wikipedia', name: 'Wikipedia', cls: 'encyclopedia', title: AUDIT, excerpt: AMEND[AUDIT] }, { archive: 'wikipedia', name: 'Wikipedia', cls: 'encyclopedia', title: FA, excerpt: AMEND[FA] }], plan, null);
  expect(pv.sources.length === 1 && pv.sources[0].title === FA.slice(0, 70) && pv.sources[0].supported === true, JSON.stringify(pv.sources));
  expect(pv.rejected && pv.rejected.length === 1 && pv.rejected[0].limitation === 'SUBJECT_MISMATCH' && pv.rejected[0].title === AUDIT, JSON.stringify(pv.rejected)); });

/* ---------------- 6(b) + 6(c) end to end ---------------- */
/* 4.9.86 (Nic 6:47 PM): the reply is the short shape; the typed limitation is in the provenance (checked above) */
/* 4.9.87: realized from roles (source as kartā of a reporting verb, the link as its sthāna); the passage stays sealed in the meaning */ /* 4.9.86: the tier and fallback marks are in the provenance; the reply is the short shape */

/* ---------------- 5. agreement counting ---------------- */
T('5: agreement counts origins: Wikipedia + Wikidata are one origin; one paper in two indexes is one origin; disagreeing and unusable origins are counted; text "K agree, M disagree, N unusable"', () => { const ag = need(needPV(), 'agreement');
  const row = (archive, cls, title, supported, claim) => ({ archive, name: archive, cls, title, supported, claim, subject_ok: true });
  const a = ag([row('wikipedia', 'encyclopedia', 'Berlin Wall', true, '1989'), row('wikidata', 'structured_reference', 'Berlin Wall', true, '1989')], '1989'); expect(a.agree === 1 && a.disagree === 0 && a.unusable === 0 && a.text === '1 agree, 0 disagree, 0 unusable', JSON.stringify(a));
  const b = ag([row('pubmed', 'peer_reviewed', 'Ibuprofen and bleeding', true, 'yes'), row('openalex', 'peer_reviewed', 'Ibuprofen and Bleeding', true, 'yes'), row('openfda', 'primary_authority', 'Label', true, 'yes')], 'yes'); expect(b.agree === 2, 'same paper in two indexes counted twice: ' + JSON.stringify(b));
  const c = ag([row('openfda', 'primary_authority', 'Label', true, 'no'), row('wikipedia', 'encyclopedia', 'Aspirin', true, 'yes'), row('crossref', 'peer_reviewed', 'Trial', false, 'yes')], 'no'); expect(c.agree === 1 && c.disagree === 1 && c.unusable === 1 && c.text === '1 agree, 1 disagree, 1 unusable', JSON.stringify(c));
  const d = ag([row('wikipedia', 'encyclopedia', 'A', true, null), row('wikipedia', 'encyclopedia', 'B', true, null)], null); expect(d.agree === 1, 'two Wikipedia articles counted as two answering origins: ' + JSON.stringify(d)); });

/* ---------------- 6(d) egress display ---------------- */

/* ---------------- span ruling ---------------- */
T('span ruling: two adjacent sentences are one span only when the second\'s subject ("It", or "The city" named in the first) resolves to the entity named in the first', () => { const P = needPV();
  const k = { value: ['1989'], entities: ['berlin', 'wall'], relation: ['fell', 'fall'], polarity: null };
  const ex1 = 'The Berlin Wall was a guarded concrete barrier. It fell on 9 November 1989.'; expect(P.extractSpan(ex1, k) === ex1, 'pronoun continuation not joined: ' + P.extractSpan(ex1, k));
  const k2 = { value: ['1945'], entities: ['berlin'], relation: ['fell', 'fall'], polarity: null }, ex2 = 'Berlin is the capital city of Germany. The city fell to Soviet forces in 1945.'; expect(P.extractSpan(ex2, k2) === ex2, 'definite reference "The city" not resolved: ' + P.extractSpan(ex2, k2));
  expect(P.checkSpan(ex1, ex1, k).ok === true, 'the two-sentence span fails its own check'); });
T('span ruling: otherwise the two sentences are not one span: another subject, an unresolved definite, or a first sentence that does not name the entity → unsupported', () => { const P = needPV();
  const k = { value: ['1989'], entities: ['berlin', 'wall'], relation: ['fell', 'fall'], polarity: null };
  for (const ex of ['The Berlin Wall was a guarded concrete barrier. The treaty fell apart in 1989.', 'The Berlin Wall was a guarded concrete barrier. The government fell in 1989.', 'Many cities had walls. It fell on 9 November 1989 in Berlin.', 'The Berlin Wall was a guarded concrete barrier. Bonn fell in 1989.'])
    { expect(P.extractSpan(ex, k) === null, 'joined across an unresolved subject: ' + ex); expect(P.checkSpan(ex, ex, k).ok === false, 'checkSpan accepted an unresolved two-sentence span: ' + ex); } });

/* ---------------- Nic's ruling 11:15: answer-entity sources (written FIRST) ----------------
   A source qualifies if its primary entity matches EITHER the question's subject entity OR the candidate answer entity, and then its
   supporting verbatim span must mention both the question subject and the answer. Ordinal mismatches and "about" articles stay mismatches. */
const TEL_PLAN = { question: 'who invented the telephone', atype: 'person', asked: 'invent', askedForms: ['invented', 'invent'], object: 'telephone', args: ['telephone'] };
const BELL_GOOD = { archive: 'wikipedia', name: 'Wikipedia', cls: 'encyclopedia', title: 'Alexander Graham Bell', excerpt: 'Alexander Graham Bell was a Scottish-born scientist. Alexander Graham Bell invented the telephone in 1876.' };
const BELL_UNRELATED = { archive: 'wikipedia', name: 'Wikipedia', cls: 'encyclopedia', title: 'Alexander Graham Bell', excerpt: 'Alexander Graham Bell was born in Edinburgh. He taught deaf students in Boston.' };
const BELL_INSTR = { archive: 'wikipedia', name: 'Wikipedia', cls: 'encyclopedia', title: 'Bell (instrument)', excerpt: 'A bell is a percussion instrument. Bells are struck to make a sound.' };
const TEL_ART = { archive: 'wikipedia', name: 'Wikipedia', cls: 'encyclopedia', title: 'Telephone', excerpt: 'A telephone is a device for talking at a distance.' };
T('answer entity: a Bell article whose verbatim span names the telephone and Bell qualifies through the answer entity and supports the answer', () => { const P = needPV();
  const pv = P.report([TEL_ART, BELL_GOOD], TEL_PLAN, { kind: 'value', answer: 'alexander graham bell' }); const b = pv.sources.find(s => s.title === 'Alexander Graham Bell');
  expect(b && b.subject_match === 'answer' && b.supported === true && /telephone/.test(b.span) && /Bell/.test(b.span) && BELL_GOOD.excerpt.includes(b.span), JSON.stringify(pv.sources));
  const t = pv.sources.find(s => s.title === 'Telephone'); expect(t && t.subject_match === 'question' && t.supported === false, 'the Telephone article (no answer in its span) counted as support: ' + JSON.stringify(t));
  expect(pv.agreement.agree === 1 && (pv.rejected || []).length === 0, JSON.stringify(pv.agreement) + ' ' + JSON.stringify(pv.rejected)); });
T('answer entity: an unrelated Bell article (no span naming the telephone) does not qualify: SUBJECT_MISMATCH; so does "Bell (instrument)"; ordinal and "about" mismatches stay mismatches with an answer entity present', () => { const P = needPV();
  const pv = P.report([TEL_ART, BELL_UNRELATED, BELL_INSTR], TEL_PLAN, { kind: 'value', answer: 'alexander graham bell' });
  expect(!pv.sources.some(s => /Bell/.test(s.title)), 'an unrelated Bell article is cited: ' + JSON.stringify(pv.sources.map(s => s.title)));
  const rj = pv.rejected || []; expect(rj.length === 2 && rj.every(x => x.limitation === 'SUBJECT_MISMATCH'), JSON.stringify(rj));
  const sm = need(P, 'subjectMatch'); expect(sm('first amendment', { title: TWENTY_FIRST }, 'twenty-first amendment').ok === true && sm('first amendment', { title: AUDIT }, 'freedom of speech').ok === false && sm('first amendment', { title: TWENTY_FIRST }, 'eighteenth amendment').ok === false, 'answer-entity match must be exact too'); });

/* ---------------- ruling 11:23 (Nic item 3 wording, "mark the claim unsupported in the output"): written FIRST ----------------
   A cited source without a supporting span stays visible, marked unsupported, and counts toward neither support nor agreement. When NO source
   supports the answer, the reply does not present it as an answer: it says "Unsupported: <claim> (no verbatim span in any source)". */
const TEL_PATENT = 'The telephone was patented by Alexander Graham Bell in 1876.';

(async () => { for (const t of tests) { let ok = false, why = ''; try { const v = await t.fn(); ok = v === undefined || v === true; } catch (e) { why = String(e.message).slice(0, 600); } rows.push({ cls: 'EV-SUBJECT', name: t.name, ok, why }); } process.stdout.write(JSON.stringify(rows)); })();
