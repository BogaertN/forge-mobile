// EVIDENCE + AUTHORITY HONESTY (4.9.74, Nic): (1) the single "network: no" flag is split into "kernel network: none" and
// "tool egress: <tool> · <on-device | external>"; no flag may read as "nothing left the device" on a turn with a tool fetch.
// (2) every evidence answer carries per-source provenance tiers (curated_archive / peer_reviewed_index / open_fallback) beside each
// source and a summary line ("sources: 3 curated, 2 open fallback"); a fallback is always visible. (3) entailment: each cited source
// needs a VERBATIM span of its stored excerpt containing the answer's key content (value / entities / relation words); otherwise the
// claim is marked unsupported; a fabricated span is rejected. Deterministic (no model, no embeddings). Async: child process, JSON rows.
const ROOT = require('path').join(__dirname, '..'); const fs = require('fs');
const FK = require(ROOT + '/src/forge.js'), KM = require(ROOT + '/src/kernel.js'), EV = require(ROOT + '/src/evidence.js'), LEX = require(ROOT + '/data/lexicon.json');
const rows = [], tests = []; const T = (cls, name, fn) => tests.push({ cls, name, fn }); const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
let tick = 0; const clock = () => new Date(Date.UTC(2026, 9, 19, 15, 0, 0) + (tick++) * 1000).toISOString();
const mkStore = () => { const st = {}; return KM.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }); };
/* fixture web: a MediaWiki stand-in (no network); every other archive answers 404 */
function wiki(pages) { const calls = []; const f = u => { u = String(u); calls.push(u); const ok = (ct, b) => Promise.resolve({ ok: true, status: 200, url: u, headers: { get: h => String(h).toLowerCase() === 'content-type' ? ct : null }, text: () => Promise.resolve(b) });
    if (/robots\.txt$/.test(u)) return ok('text/plain', 'User-agent: *\nDisallow: /w/index.php?title=Special'); const d = decodeURIComponent(u);
    if (/wikipedia\.org/.test(u) && d.includes('list=search')) return ok('application/json', JSON.stringify({ query: { search: Object.keys(pages).map(t => ({ title: t })) } }));
    if (/wikipedia\.org/.test(u) && d.includes('titles=')) { const ts = d.split('titles=')[1].split('&')[0].split('|'); return ok('application/json', JSON.stringify({ query: { pages: Object.fromEntries(ts.filter(t => pages[t]).map((t, i) => [i + 1, { title: t, extract: d.includes('exintro=1') ? pages[t].split('\n')[0] : pages[t] }])) } })); }
    if (/example\.org\/robots/.test(u)) return ok('text/plain', 'User-agent: *\nAllow: /');
    if (/news\.example\/rss/.test(u)) return ok('application/rss+xml', '<rss><channel><title>N</title><item><title>First story</title><link>https://news.example/1</link></item></channel></rss>');
    if (/example\.org\/page/.test(u)) return ok('text/html', '<html><head><title>Tide pools</title></head><body><p>Tide pools are rocky pools on the seashore that are filled with seawater.</p></body></html>');
    return Promise.resolve({ ok: false, status: 404, url: u, headers: { get: () => '' }, text: () => Promise.resolve('') }); }; f.calls = calls; return f; }
const WALL = { 'Berlin Wall': 'The Berlin Wall was a guarded concrete barrier that divided Berlin.\nThe Berlin Wall fell on 9 November 1989, after weeks of unrest.' };
const WALL_NOFIT = { 'Berlin Wall': 'The Berlin Wall was a guarded concrete barrier that divided Berlin.\nIt was built by the German Democratic Republic.' };
async function kern(pages) { const f = FK.ForgeKernel({ clock, lexicon: LEX, store: mkStore(), vaultIterations: 1000, fetch: wiki(pages || WALL) }); await f.vault.setup('correct horse'); await f.vault.unlock('correct horse'); return f; }
const NOTHING_LEFT = /^network: no$|nothing left|no network|egress: none|network: none$(?<!kernel network: none)/i;
const labels = b => (FK.authorityLabels ? FK.authorityLabels(b) : []);
const research = async (f, q) => { const r = f.process(q); const t = r.toolJob ? await r.toolJob : null; return { r, t, m: t && t.trace.msm.meaning }; };

/* ---- 1. authority badge split ---- */
T('HONEST-BADGE', 'a research.web turn (started turn and result turn) reads "kernel network: none" + "tool egress: research.web · external"; no label reads as "nothing left the device"', async () => {
  const f = await kern(); const { r, t } = await research(f, 'when did the berlin wall fall');
  for (const [nm, x] of [['started', r], ['result', t]]) { const b = x.forge.authority_boundary, L = labels(b);
    expect(b.kernel_network === 'none' && b.tool_egress === 'research.web · external', nm + ' boundary ' + JSON.stringify(b));
    expect(L.includes('kernel network: none') && L.includes('tool egress: research.web · external'), nm + ' labels ' + JSON.stringify(L));
    expect(!L.some(l => NOTHING_LEFT.test(l) && l !== 'kernel network: none'), nm + ' a label reads as nothing left the device: ' + JSON.stringify(L)); } });
T('HONEST-BADGE', 'every network tool (feed.read, capture.page) is "external" on both its turns; an on-device tool says "on-device"; a plain turn says "tool egress: none"', async () => {
  const f = await kern();
  for (const [q, tool] of [['read the feed https://news.example/rss', 'feed.read'], ['capture https://example.org/page', 'capture.page']]) { const { r, t } = await research(f, q);
    for (const x of [r, t]) { const L = labels(x.forge.authority_boundary); expect(L.includes('tool egress: ' + tool + ' · external') && !L.some(l => /^network: no$/.test(l)), q + ' ' + JSON.stringify(L)); } }
  f.process('note: locker 4411 left side'); const s = f.process('seal note 1'); expect(s.toolJob, 'no seal tool job'); const st = await s.toolJob; const tool = s.trace.tool_request.tool;
  expect(labels(st.forge.authority_boundary).includes('tool egress: ' + tool + ' · on-device'), tool + ' ' + JSON.stringify(labels(st.forge.authority_boundary)));
  const p = f.process('hello'); const L = labels(p.forge.authority_boundary); expect(L.includes('kernel network: none') && L.includes('tool egress: none'), JSON.stringify(L)); });
T('HONEST-BADGE', 'the app renders the badge from the split labels: no "network: no" flag survives in app.js', () => {
  const app = fs.readFileSync(ROOT + '/src/app.js', 'utf8'); const ab = (/const AB = [^\n]*/.exec(app) || [''])[0];
  expect(/authorityLabels/.test(ab) && !/'network'/.test(ab), 'AB still renders the network flag: ' + ab.slice(0, 200)); });

/* ---- 2. per-source provenance tiers ---- */
T('HONEST-TIER', 'tier mapping is declared data over the evidence rank classes: primary authority → curated_archive; peer reviewed → peer_reviewed_index; structured reference, encyclopedia and general web → open_fallback', () => {
  expect(EV.tierOf && JSON.stringify(EV.TIERS) === '["curated_archive","peer_reviewed_index","open_fallback"]', 'no TIERS');
  expect(EV.tierOf('primary_authority') === 'curated_archive' && EV.tierOf('peer_reviewed') === 'peer_reviewed_index' && EV.tierOf('structured_reference') === 'open_fallback' && EV.tierOf('encyclopedia') === 'open_fallback' && EV.tierOf('blog') === 'open_fallback' && EV.tierOf(undefined) === 'open_fallback', 'mapping');
  expect(/curated_archive/.test(fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8')), 'tier mapping not documented in CONFLICTS.md'); });
T('HONEST-TIER', 'every source gets a tier and the summary counts are right ("sources: 2 curated, 1 peer-reviewed, 2 open fallback")', () => {
  const K = { value: '1989', entities: [['berlin', 'wall']], relation: ['fell', 'fall'] }; const ex = 'The Berlin Wall fell in 1989.';
  const S = [['openfda', 'openFDA', 'primary_authority'], ['ecfr', 'eCFR', 'primary_authority'], ['pubmed', 'PubMed', 'peer_reviewed'], ['wikidata', 'Wikidata', 'structured_reference'], ['wikipedia', 'Wikipedia', 'encyclopedia']].map(([archive, name, cls], i) => ({ archive, name, cls, title: 'T' + i, excerpt: ex }));
  const p = EV.provenance(S, K); expect(p.sources.length === 5 && p.sources.every(s => EV.TIERS.includes(s.tier)), JSON.stringify(p.sources));
  expect(p.counts.curated_archive === 2 && p.counts.peer_reviewed_index === 1 && p.counts.open_fallback === 2 && p.summary === 'sources: 2 curated, 1 peer-reviewed, 2 open fallback', p.summary);
  expect(EV.provenance(S.slice(0, 1), K).summary === 'sources: 1 curated' && !EV.provenance(S.slice(0, 1), K).fallback_only, 'zero counts are omitted'); });
T('HONEST-TIER', 'the reply shows each source with its tier and the summary line; Echo-verified', () => {
  const f = FK.ForgeKernel({ clock, lexicon: LEX, store: mkStore() }); const K = { value: null, entities: [['aspirin']], relation: ['safe'] };
  const S = [{ archive: 'openfda', name: 'openFDA', cls: 'primary_authority', title: 'Aspirin label', excerpt: 'Aspirin is safe for most adults at low doses.' }, { archive: 'wikipedia', name: 'Wikipedia', cls: 'encyclopedia', title: 'Aspirin', excerpt: 'Aspirin is generally safe.' }];
  const prov = EV.provenance(S, K); const m = { kind: 'research_answer', excerpt: S[0].excerpt, source: 'Aspirin label', archive: 'openFDA', cls: 'primary_authority', items: prov.items, provenance: prov, sealed: true, answer: 'Yes', support: { level: 'corroborated', n: 2 } };
  const r = f.realize(m), e = f.echo(r.text, m);
  expect(/^Yes\. The record “Aspirin label \(openFDA\)” supports it\./.test(r.text) && prov.sources.every(x => EV.TIERS.includes(x.tier)) && e.pass, r.text + ' / ' + e.reason); }); /* 4.9.86 (Nic 6:47 PM): the reply has the short shape; tiers and support marks are in the provenance */
T('HONEST-TIER', 'end to end: a Wikipedia-only answer shows the fallback visibly (tier beside the source, summary line, "fallback only"); every source in the meaning has a tier', async () => {
  const f = await kern(); const { t, m } = await research(f, 'when did the berlin wall fall');
  expect(m && m.kind === 'research_answer' && m.provenance && m.provenance.sources.length >= 1 && m.provenance.sources.every(s => EV.TIERS.includes(s.tier)), JSON.stringify(m));
  expect(m.provenance.fallback_only === true && /the Wikipedia article “Berlin Wall”/i.test(t.reply) && t.trace.echo.pass, t.reply); }); /* 4.9.86 (Nic 6:47 PM): the reply has the short shape; tiers and support marks are in the provenance */

/* ---- 3. entailment: a verbatim supporting span, or "unsupported" ---- */
T('HONEST-ENTAIL', 'entail() returns a verbatim span of the excerpt holding the value, the entities and a relation word; deterministic', () => {
  const ex = 'The Berlin Wall was a guarded concrete barrier. The Berlin Wall fell on 9 November 1989, after weeks of unrest.'; const K = { value: '1989', entities: [['berlin', 'wall']], relation: ['fell', 'fall'] };
  const s = EV.entail(ex, K); expect(s && ex.includes(s) && /1989/.test(s) && /fell/.test(s) && !/barrier/.test(s), JSON.stringify(s)); expect(EV.entail(ex, K) === s, 'not deterministic');
  expect(EV.entail('The Berlin Wall was built in 1961.', K) === null, 'a span without the value or the relation was accepted');
  expect(EV.entail('In 1989 many things fell.', K) === null, 'a span without the entity was accepted'); });
T('HONEST-ENTAIL', 'a citation without a supporting span is marked unsupported in the provenance and in the reply (Echo-verified); citation presence is not support', () => {
  const f = FK.ForgeKernel({ clock, lexicon: LEX, store: mkStore() }); const K = { value: '1989', entities: [['berlin', 'wall']], relation: ['fell', 'fall'] };
  const S = [{ archive: 'wikipedia', name: 'Wikipedia', cls: 'encyclopedia', title: 'Berlin Wall', excerpt: 'The Berlin Wall was a guarded concrete barrier.' }];
  const p = EV.provenance(S, K); expect(p.sources[0].supported === false && p.sources[0].span === null && p.unsupported === 1, JSON.stringify(p));
  const m = { kind: 'research_answer', excerpt: S[0].excerpt, source: 'Berlin Wall', archive: 'Wikipedia', cls: 'encyclopedia, a secondary source', items: p.items, provenance: p, sealed: true, support: { level: 'none', n: 0 } };
  const r = f.realize(m), e = f.echo(r.text, m); expect(/^No source \w+ the \w+ directly\./.test(r.text) && e.pass, r.text + ' / ' + e.reason); }); /* 4.9.86 (Nic 6:47 PM): the reply has the short shape; tiers and support marks are in the provenance */
T('HONEST-ENTAIL', 'end to end: a cited passage that does not state the answer is marked unsupported; a supported answer carries its verbatim span', async () => {
  const f = await kern(WALL_NOFIT); const a = await research(f, 'when did the berlin wall fall');
  expect(a.m && (a.m.limitation === 'ABOVE_DRIFT_BAND' || (a.m.provenance && a.m.provenance.sources.every(s => s.supported === false))) && /^No source \w+ the \w+/.test(a.t.reply) && a.t.trace.echo.pass, a.t && a.t.reply); /* 4.9.86: a passage without the predicate ("fall") is above the band: refused */
  const g = await kern(WALL); const b = await research(g, 'when did the berlin wall fall'); const s0 = b.m.provenance.sources[0];
  expect(s0.supported === true && WALL['Berlin Wall'].includes(s0.span) && /1989/.test(s0.span) && !/^No source/.test(b.t.reply), JSON.stringify(b.m.provenance)); });
T('HONEST-ENTAIL', 'a fabricated span (not a substring of the stored excerpt) is rejected, even when it states the answer; so is a real substring without the key content', () => {
  const ex = 'The Berlin Wall was a guarded concrete barrier. The Berlin Wall fell on 9 November 1989, after weeks of unrest.'; const K = { value: '1989', entities: [['berlin', 'wall']], relation: ['fell', 'fall'] };
  expect(EV.verifySpan(ex, 'The Berlin Wall fell in 1989.', K) === false, 'fabricated span accepted'); expect(EV.verifySpan(ex, 'The Berlin Wall was a guarded concrete barrier.', K) === false, 'substring without the key content accepted');
  expect(EV.verifySpan(ex, 'The Berlin Wall fell on 9 November 1989, after weeks of unrest.', K) === true, 'true span rejected');
  const p = EV.provenance([{ archive: 'wikipedia', name: 'Wikipedia', cls: 'encyclopedia', title: 'Berlin Wall', excerpt: 'The Berlin Wall was a guarded concrete barrier.', span: 'The Berlin Wall fell in 1989.' }], K);
  expect(p.sources[0].supported === false && p.sources[0].span === null && p.rejected_spans === 1, JSON.stringify(p)); });
T('HONEST-ENTAIL', 'unsupported evidence never counts toward support; the lookup answer is still never stored as a fact (evidence sealed in the vault only)', async () => {
  const f = await kern(WALL_NOFIT); const a = await research(f, 'when did the berlin wall fall'); expect((a.m.limitation === 'ABOVE_DRIFT_BAND' || (a.m.support && a.m.support.level === 'none')) && !a.m.answer, JSON.stringify(a.m.support));
  const g = await kern(WALL); await research(g, 'when did the berlin wall fall'); const again = g.process('when did the berlin wall fall'); expect(again.toolJob && !/1989/.test(again.reply || ''), 'answered from memory: ' + again.reply); await again.toolJob;
  expect(g.vault.entries('evidence').length >= 1, 'evidence not sealed');
  const src = fs.readFileSync(ROOT + '/src/evidence.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''); expect(!/require\((?!'\.\/(sha256|provenance)\.js')/.test(src) && !/embed|llm|model\(/i.test(src), 'entailment is not pure/deterministic'); });
(async () => { for (const t of tests) { try { await t.fn(); rows.push({ cls: t.cls, name: t.name, ok: true }); } catch (e) { rows.push({ cls: t.cls, name: t.name, ok: false, why: String(e.message).slice(0, 600) }); } } process.stdout.write(JSON.stringify(rows)); })();
