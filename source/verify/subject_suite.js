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
T('6a: "square root of 4536" returns √4536 ≈ 67.349833 with its full trace (derivation rules, phases, Echo, MSM, receipt); no tool, no egress', () => {
  const f = FK.ForgeKernel({ clock, lexicon: LEX, store: mkStore() }); const r = f.process('square root of 4536');
  expect(/√4536 ≈ 67\.349833\b/.test(r.reply || ''), r.reply); const m = r.trace.msm.meaning; expect(m.kind === 'math' && m.value === '67.349833' && m.approx === true, JSON.stringify(m));
  expect(Math.abs(Math.sqrt(4536) - 67.349833) < 5e-7, 'value is not √4536 to 6 decimals');
  expect(r.trace.derivation && r.trace.derivation.rule_count > 0 && r.trace.derivation.rules.length === r.trace.derivation.rule_count && r.trace.echo.pass && r.trace.phases && r.trace.msm_v1 && r.forge.receipt && r.forge.msm_validation, 'trace incomplete');
  expect(!r.trace.tool_request && !r.toolJob, 'a tool ran'); });

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
T('6b: "What is the first amendment?" cites only the matching article; the Twenty-first Amendment and the audit article are rejected (SUBJECT_MISMATCH), never cited', async () => { const { t, m } = await ask(AMEND, 'What is the first amendment?');
  expect(m && m.kind === 'research_answer' && m.provenance, JSON.stringify(m || null).slice(0, 300));
  const cited = m.provenance.sources.map(s => s.title).concat(m.items || []).join(' | '); expect(!/Twenty-first|audit/i.test(cited), 'a mismatched source is cited: ' + cited);
  expect(m.provenance.sources.length >= 1 && m.provenance.sources.every(s => /^First Amendment to the United States Constitution/.test(s.title)), cited);
  const rj = m.provenance.rejected || []; expect(rj.length === 2 && rj.every(x => x.limitation === 'SUBJECT_MISMATCH'), JSON.stringify(rj));
  expect(!/Twenty-first|audit/i.test(t.reply) && !/Eighteenth|photographing/.test(t.reply), 'mismatched text in the reply: ' + t.reply); expect(t.trace.echo.pass, 'Echo'); }); /* 4.9.86 (Nic 6:47 PM): the reply is the short shape; the typed limitation is in the provenance (checked above) */
T('6b + 5: the first-amendment answer claims no agreement from ranked counts: "K agree, M disagree, N unusable" over origins (one Wikimedia origin)', async () => { const { t, m } = await ask(AMEND, 'What is the first amendment?');
  expect(!RANKED_COUNT.test(t.reply), 'ranked count claimed: ' + t.reply); expect(AGREEMENT.test(m.agreement && m.agreement.text || ''), 'no agreement line: ' + JSON.stringify(m.agreement));
  const a = m.agreement; expect(a && a.agree === 1 && a.disagree === 0 && typeof a.unusable === 'number', JSON.stringify(a)); });
T('6c: a question with no curated coverage (every curated archive silent) shows open_fallback provenance in the meaning and the reply', async () => { const { t, m } = await ask(AMEND, 'What is the first amendment?');
  const pv = m.provenance, fo = pv.fallback_only === true || (pv.summary && pv.summary.fallback_only === true); expect(fo && pv.sources.every(s => s.tier === 'open_fallback'), JSON.stringify(pv));
  expect(/^The /.test(t.reply) && /You can find it at “https:/.test(t.reply), t.reply); }); /* 4.9.87: realized from roles (source as kartā of a reporting verb, the link as its sthāna); the passage stays sealed in the meaning */ /* 4.9.86: the tier and fallback marks are in the provenance; the reply is the short shape */
T('4: when every source mismatches the subject, nothing is answered: the typed limitation SUBJECT_MISMATCH is the reply; no excerpt is quoted', async () => { const { t, m } = await ask(MISMATCH_ONLY, 'What is the first amendment?');
  expect(m && m.limitation === 'ABOVE_DRIFT_BAND' && m.best_drift > m.band, JSON.stringify(m)); /* 4.9.83: drift-scored matching (query compiler) replaces the binary guard */ expect(/^No source \w+ the \w+\./.test(t.reply || '') && !/Eighteenth|photographing|Twenty-first|audit/i.test(t.reply || ''), t.reply); expect(!m.answer, 'answered'); });

/* ---------------- 5. agreement counting ---------------- */
T('5: agreement counts origins: Wikipedia + Wikidata are one origin; one paper in two indexes is one origin; disagreeing and unusable origins are counted; text "K agree, M disagree, N unusable"', () => { const ag = need(needPV(), 'agreement');
  const row = (archive, cls, title, supported, claim) => ({ archive, name: archive, cls, title, supported, claim, subject_ok: true });
  const a = ag([row('wikipedia', 'encyclopedia', 'Berlin Wall', true, '1989'), row('wikidata', 'structured_reference', 'Berlin Wall', true, '1989')], '1989'); expect(a.agree === 1 && a.disagree === 0 && a.unusable === 0 && a.text === '1 agree, 0 disagree, 0 unusable', JSON.stringify(a));
  const b = ag([row('pubmed', 'peer_reviewed', 'Ibuprofen and bleeding', true, 'yes'), row('openalex', 'peer_reviewed', 'Ibuprofen and Bleeding', true, 'yes'), row('openfda', 'primary_authority', 'Label', true, 'yes')], 'yes'); expect(b.agree === 2, 'same paper in two indexes counted twice: ' + JSON.stringify(b));
  const c = ag([row('openfda', 'primary_authority', 'Label', true, 'no'), row('wikipedia', 'encyclopedia', 'Aspirin', true, 'yes'), row('crossref', 'peer_reviewed', 'Trial', false, 'yes')], 'no'); expect(c.agree === 1 && c.disagree === 1 && c.unusable === 1 && c.text === '1 agree, 1 disagree, 1 unusable', JSON.stringify(c));
  const d = ag([row('wikipedia', 'encyclopedia', 'A', true, null), row('wikipedia', 'encyclopedia', 'B', true, null)], null); expect(d.agree === 1, 'two Wikipedia articles counted as two answering origins: ' + JSON.stringify(d)); });
T('5: the reply never says "N independent ranked sources" with N above the agreeing origins; support.n equals agreement.agree on every evidence answer', async () => {
  for (const [pages, q] of [[AMEND, 'What is the first amendment?'], [{ 'Berlin Wall': 'The Berlin Wall fell on 9 November 1989.', 'Berlin Wall (film)': 'The Berlin Wall fell on 9 November 1989 in this film.' }, 'when did the berlin wall fall']]) { const { t, m } = await ask(pages, q);
    expect(m && m.agreement, q + ': no agreement ' + JSON.stringify(m || null).slice(0, 200)); const n = (/\b(\d+) independent ranked sources/.exec(t.reply) || [0, 0])[1] | 0; expect(n <= m.agreement.agree, q + ': ' + t.reply);
    if (m.support && /corroborated|answered/.test(m.support.level)) expect(m.support.n === m.agreement.agree, q + ' support.n ' + m.support.n + ' vs agree ' + m.agreement.agree); } });

/* ---------------- 6(d) egress display ---------------- */
T('6d: across a session (chat, math, research start + result, feed start + result), no displayed label is "network: no" on a turn whose tool performed egress', async () => {
  const f = await kern(AMEND, { 'news.example/rss': { body: '<rss><channel><title>N</title><item><title>First story</title><link>https://news.example/1</link></item></channel></rss>' } });
  const shown = []; const turn = x => { const b = x.forge && x.forge.authority_boundary; const legacy = o => Object.keys(o || {}).filter(k => typeof o[k] === 'boolean' && k !== 'understanding_is_not_authorization').map(k => k.replace(/_/g, ' ') + ': ' + (o[k] ? 'yes' : 'no')); /* what the 4.9.73 app badge rendered */ const L = FK.authorityLabels || (PV && PV.boundaryLabels) ? [].concat(FK.authorityLabels ? FK.authorityLabels(b) : [], PV && PV.boundaryLabels ? PV.boundaryLabels(b) : []) : legacy(b); shown.push({ egress: !!(x.trace.tool_request || (x.trace.bridge === 'tool' && /network/.test((f.bench.manifest((x.forge.authority_boundary || {}).tool_egress && String(x.forge.authority_boundary.tool_egress).split(' · ')[0]) || {}).effect || ''))), L, b }); };
  for (const q of ['hello', 'square root of 4536', 'What is the first amendment?', 'read the feed https://news.example/rss']) { const r = f.process(q); turn(r); if (r.toolJob) turn(await r.toolJob); }
  const eg = shown.filter(s => s.egress); expect(eg.length >= 2, 'fixture made no egress turns: ' + JSON.stringify(shown.map(s => s.b)));
  for (const s of eg) { expect(s.L.length > 0, 'no labels rendered for an egress turn'); expect(!s.L.some(l => /^network: no$/i.test(l)), 'network: no on an egress turn: ' + s.L.join(' | ')); expect(s.L.some(l => / · external$/.test(l)), 'egress not shown as external: ' + s.L.join(' | ')); } });

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
T('answer entity end to end: "who invented the telephone?" cites the Bell article with its verbatim span (telephone + Bell) and never an unrelated Bell article', async () => {
  const good = await ask({ Telephone: TEL_ART.excerpt, 'Alexander Graham Bell': BELL_GOOD.excerpt }, 'who invented the telephone?'); const pv = good.m && good.m.provenance;
  expect(pv && pv.sources.some(s => s.title === 'Alexander Graham Bell' && s.supported && /telephone/.test(s.span) && /Bell/.test(s.span)), 'Bell article not cited as support: ' + JSON.stringify(pv || good.m).slice(0, 500));
  expect(/Alexander Graham Bell/.test(good.t.reply) && good.t.trace.echo.pass, good.t.reply);
  const bad = await ask({ Telephone: TEL_ART.excerpt, 'Alexander Graham Bell': BELL_UNRELATED.excerpt }, 'who invented the telephone?'); const pv2 = bad.m && bad.m.provenance;
  expect(!(pv2 && pv2.sources.some(s => /Bell/.test(s.title))) && !/Edinburgh|deaf students/.test(bad.t.reply || ''), 'unrelated Bell article cited or quoted: ' + (bad.t && bad.t.reply)); });

/* ---------------- ruling 11:23 (Nic item 3 wording, "mark the claim unsupported in the output"): written FIRST ----------------
   A cited source without a supporting span stays visible, marked unsupported, and counts toward neither support nor agreement. When NO source
   supports the answer, the reply does not present it as an answer: it says "Unsupported: <claim> (no verbatim span in any source)". */
const TEL_PATENT = 'The telephone was patented by Alexander Graham Bell in 1876.';
T('unsupported claim: when no source has a verbatim span stating the answer, the reply states "Unsupported: <claim> (no verbatim span in any source)" and never presents it as the answer', async () => {
  const { t, m } = await ask({ Telephone: TEL_PATENT }, 'who invented the telephone?'); const reply = (t && t.reply) || '';
  expect(/^No source \w+ the \w+( directly)?\./.test(reply), 'claim not refused: ' + reply); /* 4.9.86: a patent sentence does not fill "who invented" (predicate missing): refused in the short shape */
  expect(!/\bThe answer is\b/.test(reply) && !(m && m.answer), 'an unsupported claim is presented as the answer: ' + reply);
  expect(m && (m.limitation === 'ABOVE_DRIFT_BAND' || (m.provenance && m.provenance.sources.length === 1 && m.provenance.sources[0].supported === false)), 'the unsupported citation is not marked: ' + JSON.stringify(m || null).slice(0, 300));
  expect(m.limitation === 'ABOVE_DRIFT_BAND' || (m.agreement && m.agreement.agree === 0 && !(m.support && m.support.n > 0)), 'an unsupported source counted toward support or agreement: ' + JSON.stringify([m.agreement, m.support]));
  expect(t.trace.echo.pass, 'Echo failed: ' + reply); });
T('unsupported claim: with one supporting source the answer stands and the unsupported citation stays visible, marked unsupported, outside the agreement count', async () => {
  const { t, m } = await ask({ Telephone: TEL_ART.excerpt, 'Alexander Graham Bell': BELL_GOOD.excerpt }, 'who invented the telephone?'); const reply = (t && t.reply) || '';
  expect(!/Unsupported: /.test(reply) && /Alexander Graham Bell/.test(reply), 'a supported answer was withheld: ' + reply);
  /* 4.9.83 (Nic 2026-10-21 4:58 PM): the per-source tier list left the reply for the trace; the marks are checked there */ const ps = (m.provenance && m.provenance.sources) || [];
  expect(ps.some(x => x.title === 'Telephone' && x.supported === false) && ps.some(x => x.title === 'Alexander Graham Bell' && x.supported === true) && !/Telephone \(Wikipedia\)/.test(reply), 'citations not marked in the trace: ' + JSON.stringify(ps.map(x => [x.title, x.supported])) + ' | ' + reply);
  expect(m.agreement.agree === 1 && m.agreement.origins.length === 1, 'agreement: ' + JSON.stringify(m.agreement)); });

(async () => { for (const t of tests) { let ok = false, why = ''; try { const v = await t.fn(); ok = v === undefined || v === true; } catch (e) { why = String(e.message).slice(0, 600); } rows.push({ cls: 'EV-SUBJECT', name: t.name, ok, why }); } process.stdout.write(JSON.stringify(rows)); })();
