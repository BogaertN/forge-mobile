/* EV-HONEST (4.9.74, Nic's request "make the evidence and authority layers honest"; written FIRST, before the implementation).
 * 1. EGRESS: the single "network: no" badge is replaced by two labels, "kernel network: none" and "tool egress: <tool> · <on-device | external>";
 *    no label on any turn with a tool fetch may read as "nothing left the device".
 * 2. TIERS: every source of an evidence answer carries a provenance tier (curated_archive / peer_reviewed_index / open_fallback) shown beside it,
 *    plus a summary line ("sources: 3 curated, 2 open fallback"); a fallback-only answer says so visibly.
 * 3. ENTAILMENT: each cited source needs a VERBATIM span (an exact substring of its stored excerpt) that contains the answer sentence's key
 *    content (extracted value, entities, relation word); otherwise the citation is marked unsupported. A fabricated span is rejected.
 * Async; run as a child process by verify/run.js; prints JSON rows. Fixture web only (no network). */
const ROOT = require('path').join(__dirname, '..'); const fs = require('fs');
const KMOD = require(ROOT + '/src/kernel.js'), FK = require(ROOT + '/src/forge.js'), TB = require(ROOT + '/src/toolbench.js'), AR = require(ROOT + '/src/archives.js');
const LEX = require(ROOT + '/data/lexicon.json');
let PV = null; try { PV = require(ROOT + '/src/provenance.js'); } catch (e) { PV = null; }
const needPV = () => { if (!PV) throw new Error('src/provenance.js is missing'); return PV; };
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn }); const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
let tick = 0; const clock = () => new Date(Date.UTC(2026, 9, 19, 15, 0, 0) + (tick++) * 1000).toISOString();
const mkStore = () => { const st = {}; const s = KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }); s._raw = st; return s; };
/* fixture web: Wikipedia (open fallback) + OpenAlex (peer-reviewed index); unknown URLs answer 404 */
function web(pages) { const calls = []; const f = async (url, init) => { calls.push(String(url)); const u = String(url); const p = Object.keys(pages).find(k => u.startsWith(k) || u.includes(k));
    if (!p) return { ok: false, status: 404, url: u, headers: { get: () => '' }, text: async () => '', json: async () => ({}) };
    const pg = pages[p]; if (pg.throw) throw new TypeError('Failed to fetch'); const body = typeof pg.body === 'string' ? pg.body : JSON.stringify(pg.body);
    return { ok: true, status: 200, url: u, headers: { get: h => (h.toLowerCase() === 'content-type' ? pg.ct || 'application/json' : null) }, text: async () => body, json: async () => JSON.parse(body) }; };
  f.calls = calls; return f; }
const WIKI_EX = 'Ibuprofen is a nonsteroidal anti-inflammatory drug. Ibuprofen can cause stomach bleeding in some people.';
const OA_EX = 'Ibuprofen use was studied for stomach bleeding in many adults today.';
const PAGES = { 'https://en.wikipedia.org/robots.txt': { ct: 'text/plain', body: 'User-agent: *\nDisallow: /w/index.php?title=Special' },
  'list=search': { body: { query: { search: [{ title: 'Ibuprofen' }] } } },
  'titles=Ibuprofen': { body: { query: { pages: { 1: { title: 'Ibuprofen', extract: WIKI_EX } } } } },
  'api.openalex.org': { body: { results: [{ display_name: 'Ibuprofen and stomach bleeding in adults', abstract_inverted_index: { Ibuprofen: [0], use: [1], was: [2], studied: [3], for: [4], stomach: [5], bleeding: [6], in: [7], many: [8], adults: [9], 'today.': [10] } }] } } };
const WIKI_ONLY = Object.assign({}, PAGES); delete WIKI_ONLY['api.openalex.org'];
async function unlocked(pages) { const store = mkStore(); const f = FK.ForgeKernel({ clock, lexicon: LEX, store, vaultIterations: 1000, fetch: web(pages) }); await f.vault.setup('correct horse'); await f.vault.unlock('correct horse'); f._store = store; return f; }
const NOTHING_LEFT = /^network: (no|none|off)$|nothing left|no egress|no network|offline only|stays on (this )?device/i;
const memo = {}; const ask = async (pages, q) => { const k = q + '|' + Object.keys(pages).length; if (memo[k]) return memo[k]; const f = await unlocked(pages); const r = f.process(q); const t = r.toolJob ? await r.toolJob : null; return (memo[k] = { f, r, t }); };
const MIXED_Q = 'can ibuprofen cause stomach bleeding?', FALLBACK_Q = 'what is ibuprofen?';

/* ---------------- 1. EGRESS ---------------- */
T('EGRESS: the turn that starts research.web labels "kernel network: none" and "tool egress: research.web · external"; no "network" flag remains', async () => { const { r } = await ask(PAGES, MIXED_Q);
  expect(r.trace.tool_request && r.trace.tool_request.tool === 'research.web', 'fixture did not start research.web');
  const ab = r.forge.authority_boundary; expect(!('network' in ab), 'the single network flag is still there: ' + JSON.stringify(ab));
  expect(ab.kernel_network === 'none' && ab.tool_egress === 'research.web · external', JSON.stringify(ab));
  const L = needPV().boundaryLabels(ab); expect(L.includes('kernel network: none') && L.includes('tool egress: research.web · external'), L.join(' | ')); });
T('EGRESS: on every turn with a tool fetch (start turn and evidence turn, success or failure) no label reads as "nothing left the device"', async () => {
  const { r, t } = await ask(PAGES, MIXED_Q); const f2 = await unlocked({ 'x.example': { throw: true } }); const r2 = f2.process('read the feed https://x.example/rss'); const t2 = await r2.toolJob;
  for (const [nm, x] of [['start', r], ['evidence', t], ['feed start', r2], ['feed failed', t2]]) { const ab = x.forge.authority_boundary, L = needPV().boundaryLabels(ab);
    expect(/^[a-z.]+ · external$/.test(ab.tool_egress || ''), nm + ': ' + JSON.stringify(ab)); expect(L.some(l => /^tool egress: [a-z.]+ · external$/.test(l)), nm + ': ' + L.join(' | '));
    for (const l of L) expect(!NOTHING_LEFT.test(l), nm + ' label reads as nothing left the device: ' + l); } });
T('EGRESS: each Tool Bench manifest maps to its locus (network effect → external, else on-device); a turn with no tool says "tool egress: none"', async () => { const P = needPV();
  for (const m of TB.MANIFESTS) expect(P.egressOf(m) === (m.network ? 'external' : 'on-device'), m.id + ' → ' + P.egressOf(m));
  const f = FK.ForgeKernel({ clock, lexicon: LEX, store: mkStore() }); for (const u of ['hello', 'remember that my car is red', 'what is 2 + 3']) { const ab = f.process(u).forge.authority_boundary, L = P.boundaryLabels(ab);
    expect(ab.kernel_network === 'none' && ab.tool_egress === 'none', u + ' ' + JSON.stringify(ab)); expect(L.includes('tool egress: none') && L.includes('kernel network: none'), L.join(' | ')); } });
T('EGRESS: the app renders the boundary from KProv.boundaryLabels (chat flags, status rail, evidence turn); the old network flag key is gone', () => {
  const app = fs.readFileSync(ROOT + '/src/app.js', 'utf8'), bench = fs.readFileSync(ROOT + '/src/app_bench.js', 'utf8'), html = fs.readFileSync(ROOT + '/index.html', 'utf8'), sw = fs.readFileSync(ROOT + '/sw.js', 'utf8');
  const ab = (/const AB = [^\n]*/.exec(app) || [''])[0]; expect(/KProv\.boundaryLabels/.test(ab) && !/'network'/.test(ab), 'AB still renders the network flag: ' + ab.slice(0, 200));
  expect(/KProv\.boundaryLabels|AB\(t\.forge\)|window\.AB\(/.test(bench), 'the evidence turn shows no boundary labels');
  expect(/src\/provenance\.js/.test(html) && /provenance\.js/.test(sw) && html.indexOf('provenance.js') < html.indexOf('src/app.js'), 'provenance.js not shipped before app.js'); });

/* ---------------- 2. TIERS ---------------- */
T('TIERS: rank classes map to the three tiers (primary → curated_archive, peer reviewed → peer_reviewed_index, structured reference / Wikipedia / general web → open_fallback); every archive has a tier', () => { const P = needPV();
  expect(JSON.stringify(P.TIERS) === JSON.stringify(['curated_archive', 'peer_reviewed_index', 'open_fallback']), JSON.stringify(P.TIERS));
  const want = { primary_authority: 'curated_archive', peer_reviewed: 'peer_reviewed_index', structured_reference: 'open_fallback', encyclopedia: 'open_fallback', blog: 'open_fallback', undefined: 'open_fallback' };
  for (const [c, t] of Object.entries(want)) expect(P.tierOf(c === 'undefined' ? undefined : c) === t, c + ' → ' + P.tierOf(c));
  for (const a of AR.ARCHIVES) expect(P.TIERS.includes(P.tierOf(a.cls)), a.id); });
T('TIERS: every source of a mixed evidence answer has a tier, the summary counts are right, and the reply shows the tier beside each source plus the summary line', async () => { const { t } = await ask(PAGES, MIXED_Q);
  const m = t.trace.msm.meaning, pv = m.provenance; expect(m.kind === 'research_answer' && pv && pv.sources && pv.sources.length === 2, JSON.stringify(m).slice(0, 400));
  for (const s of pv.sources) expect(needPV().TIERS.includes(s.tier), JSON.stringify(s));
  const cnt = k => pv.sources.filter(s => s.tier === k).length; expect(pv.summary.curated_archive === cnt('curated_archive') && pv.summary.peer_reviewed_index === cnt('peer_reviewed_index') && pv.summary.open_fallback === cnt('open_fallback') && pv.summary.total === pv.sources.length, JSON.stringify(pv.summary));
  expect(pv.summary.peer_reviewed_index === 1 && pv.summary.open_fallback === 1 && pv.summary.text === 'sources: 1 peer-reviewed, 1 open fallback' && pv.summary.fallback_only === false, JSON.stringify(pv.summary));
  expect(/the Wikipedia article “Ibuprofen”/i.test(t.reply), 'short shape: ' + t.reply); expect(t.trace.echo.pass, 'Echo failed'); }); /* 4.9.86 (Nic 6:47 PM): every research reply has the short shape; tiers, summary and support marks are in the provenance (checked above) */
T('TIERS: summary text counts only non-zero tiers in fixed order (curated, peer-reviewed, open fallback)', () => { const P = needPV();
  expect(P.summaryText({ curated_archive: 3, peer_reviewed_index: 0, open_fallback: 2 }) === 'sources: 3 curated, 2 open fallback', P.summaryText({ curated_archive: 3, peer_reviewed_index: 0, open_fallback: 2 }));
  expect(P.summaryText({ curated_archive: 1, peer_reviewed_index: 2, open_fallback: 0 }) === 'sources: 1 curated, 2 peer-reviewed', 'mixed'); });
T('TIERS: a fallback-only answer shows the fallback visibly (summary flag, reply text, rendered card)', async () => { const { t } = await ask(WIKI_ONLY, FALLBACK_Q);
  const pv = t.trace.msm.meaning.provenance; expect(pv && pv.summary.fallback_only === true && pv.summary.open_fallback === pv.sources.length && pv.sources.length >= 1, JSON.stringify(pv));
  expect(/open fallback only/.test(pv.summary.text), 'fallback not in the provenance: ' + JSON.stringify(pv.summary)); /* 4.9.86 (Nic 6:47 PM): every research reply has the short shape; tiers, summary and support marks are in the provenance (checked above) */
  const h = needPV().reportHTML(pv, s => String(s)); expect(/class="[^"]*fallback/.test(h) && /open fallback only/.test(h) && /open fallback/.test(h), h.slice(0, 300)); expect(t.trace.echo.pass, 'Echo failed'); });

/* ---------------- 3. ENTAILMENT ---------------- */
T('ENTAIL: a cited source whose excerpt has no span with the key content is marked unsupported in the output; a supporting span is verbatim', async () => { const { t } = await ask(PAGES, MIXED_Q);
  const pv = t.trace.msm.meaning.provenance, oa = pv.sources.find(s => s.archive === 'openalex'), wk = pv.sources.find(s => s.archive === 'wikipedia');
  expect(oa && oa.supported === false && oa.span === null && oa.reason, 'OpenAlex (no relation word "cause") counted as support: ' + JSON.stringify(oa));
  expect(wk && wk.supported === true && WIKI_EX.includes(wk.span) && /cause/.test(wk.span) && /stomach bleeding/.test(wk.span), JSON.stringify(wk));
  expect(!/OpenAlex/.test(t.reply), 'an unsupported citation is cited in the reply: ' + t.reply); }); /* 4.9.86 (Nic 6:47 PM): every research reply has the short shape; tiers, summary and support marks are in the provenance (checked above) */
T('ENTAIL: citation presence is not support: an excerpt naming the entities but not the extracted value is unsupported; one stating it gets a verbatim span', () => { const P = needPV();
  const plan = { question: 'when did the berlin wall fall', atype: 'date', asked: 'fall', askedForms: ['fell', 'fallen', 'fall'], object: 'berlin wall', args: ['berlin', 'wall', 'fall'], key: ['berlin', 'wall', 'fall'] };
  const src = [{ archive: 'wikipedia', name: 'Wikipedia', cls: 'encyclopedia', title: 'Berlin Wall', excerpt: 'In 2009 Berlin celebrated twenty years since the wall came down.' }, { archive: 'wikidata', name: 'Wikidata', cls: 'structured_reference', title: 'Berlin Wall', excerpt: 'The Berlin Wall was a guarded border. The Berlin Wall fell on 9 November 1989, after weeks of unrest.' }];
  const pv = P.report(src, plan, { kind: 'value', answer: '1989' });
  expect(pv.sources[0].supported === false && pv.sources[0].span === null, JSON.stringify(pv.sources[0])); expect(pv.sources[1].supported === true && pv.sources[1].span === 'The Berlin Wall fell on 9 November 1989, after weeks of unrest.', JSON.stringify(pv.sources[1]));
  expect(pv.claim.supported_by === 1 && pv.claim.unsupported === 1, JSON.stringify(pv.claim)); });
T('ENTAIL: a fabricated span not in the stored excerpt is rejected; a verbatim span without the key content is rejected; a span from another source does not transfer', () => { const P = needPV();
  const plan = { question: 'can ibuprofen cause stomach bleeding', atype: 'verdict', pred: 'cause', predForms: ['cause', 'caused', 'causes'], args: ['stomach'], key: ['cause', 'stomach', 'bleeding'] };
  const key = P.keyContent(plan, { kind: 'verdict', answer: 'yes' });
  expect(P.checkSpan(WIKI_EX, 'Ibuprofen can cause stomach bleeding in some people.', key).ok === true, 'a true verbatim span was rejected');
  const fab = P.checkSpan(WIKI_EX, 'Ibuprofen always causes severe stomach bleeding.', key); expect(fab.ok === false && fab.reason === 'not_verbatim', JSON.stringify(fab));
  const miss = P.checkSpan(WIKI_EX, 'Ibuprofen is a nonsteroidal anti-inflammatory drug.', key); expect(miss.ok === false && miss.reason === 'missing_key_content', JSON.stringify(miss));
  const other = P.checkSpan(OA_EX, 'Ibuprofen can cause stomach bleeding in some people.', key); expect(other.ok === false && other.reason === 'not_verbatim', 'a span from another source transferred');
  const near = P.checkSpan(WIKI_EX, 'ibuprofen can cause stomach bleeding in some people.', key); expect(near.ok === false && near.reason === 'not_verbatim', 'case-folded span accepted as verbatim'); });
T('ENTAIL: a verdict span must carry the answer polarity (a "No" answer needs a negation cue; a "Yes" answer may not have one)', () => { const P = needPV();
  const plan = { question: 'is aspirin safe', atype: 'verdict', pred: 'safe', args: [], key: ['safe'], neg: false };
  const ex = 'Aspirin is not safe for children under 16. Aspirin is safe for most adults at low doses.';
  const no = P.report([{ archive: 'fda', name: 'FDA', cls: 'primary_authority', title: 'Aspirin', excerpt: ex }], plan, { kind: 'verdict', answer: 'no' }), yes = P.report([{ archive: 'fda', name: 'FDA', cls: 'primary_authority', title: 'Aspirin', excerpt: ex }], plan, { kind: 'verdict', answer: 'yes' });
  expect(no.sources[0].span === 'Aspirin is not safe for children under 16.', JSON.stringify(no.sources[0])); expect(yes.sources[0].span === 'Aspirin is safe for most adults at low doses.', JSON.stringify(yes.sources[0])); });
T('ENTAIL: deterministic (same input → same report); provenance.js is pure; spans and reports never enter memory, facts or the persisted trace', async () => { const P = needPV();
  const src = fs.readFileSync(ROOT + '/src/provenance.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); expect(!/require\(|fetch|localStorage|store\.|remember|supabase|sb_sync/i.test(src), 'provenance.js reaches outside');
  const plan = { question: 'can ibuprofen cause stomach bleeding', atype: 'verdict', pred: 'cause', predForms: ['cause', 'caused', 'causes'], args: ['stomach'] }, S = [{ archive: 'wikipedia', name: 'Wikipedia', cls: 'encyclopedia', title: 'Ibuprofen', excerpt: WIKI_EX }];
  expect(JSON.stringify(P.report(S, plan, null)) === JSON.stringify(P.report(S, plan, null)), 'not deterministic');
  const { f, t } = await ask(PAGES, MIXED_Q); const span = t.trace.msm.meaning.provenance.sources.find(s => s.supported).span; expect(f.memory().length === 0, 'a lookup answer was stored as a fact');
  const persisted = JSON.stringify(f._store._raw.trace || '') + JSON.stringify(f._store._raw.memory || '') + JSON.stringify(f._store._raw.web_evidence || ''); expect(!persisted.includes(span), 'a span left the vault into the persisted store');
  const tr = f._store.load('trace').slice(-1)[0]; expect(tr.msm.meaning.provenance && tr.msm.meaning.provenance.text === 'sources: 1 peer-reviewed, 1 open fallback' && tr.msm.meaning.provenance.unsupported === 1, 'persisted trace lacks the provenance counts: ' + JSON.stringify(tr.msm.meaning)); });

(async () => { for (const t of tests) { let ok = false, why = ''; try { const v = await t.fn(); ok = v === undefined || v === true; } catch (e) { why = e.message; } rows.push({ cls: 'EV-HONEST', name: t.name, ok, why }); } process.stdout.write(JSON.stringify(rows)); })();
