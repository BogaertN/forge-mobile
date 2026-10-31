/* R4206 (4.9.206): anchors from Supabase, cached on the phone, and no precached or fetched URL that 404s (Nic decision (b), step 2).
 * The trusted anchors live in kb.anchors and are read anonymously through the read-only public.kb_anchors view. The phone keeps an
 * IndexedDB copy (src/anchor_cache.js) refreshed by digest, keeps the old copy when offline or on a partial fetch, and keeps the
 * shipped starter anchors as the last fallback. Every URL the built site precaches or fetches must exist (tools/check_fetches.js,
 * a release gate). The reference seed lexicon, codex and concept lexicon ship, so the demos no longer crash. No LLM. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
const AC = require(ROOT + '/src/anchor_cache.js');
const SB = require(ROOT + '/src/sb_sync.js');
const SS = require(ROOT + '/tools/shipset.js');
const CF = require(ROOT + '/tools/check_fetches.js');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const INDEX = JSON.parse(read('data/anchors_188/index.json'));
const shardRows = () => { const out = []; for (const m of Object.values(INDEX.shards)) { const f = path.join(ROOT, 'data', 'anchors_188', m.file); if (fs.existsSync(f)) for (const r of JSON.parse(fs.readFileSync(f, 'utf8')).anchors) out.push(r); } return out; };
/* the view shape: id, text, state, trust, packet, concepts, provenance, contributor, license, source_url, revision */
const asView = r => ({ id: r.id, text: r.text, state: 'anchor', trust: 'trusted', packet: r.packet || Object.assign({}, r.sfe, { sfe: r.sfe }), concepts: r.concepts || [r.concept].filter(Boolean), provenance: r.provenance, contributor: r.contributor, license: r.license, source_url: r.source_url, revision: r.revision });
function fakeSb(rows, o) { o = o || {}; const calls = { digest: 0, rows: 0 };
  return { calls, api: { anchorsDigest: async () => { calls.digest++; return o.offline ? { ok: false, offline: true } : { ok: true, count: rows.length, digest: o.digest || 'd1' }; },
    anchorRows: async () => { calls.rows++; return o.partial ? { ok: true, rows: rows.slice(1) } : { ok: true, rows: rows.slice() }; } } }; }
const ROW = (id, concept, extra) => Object.assign({ id, text: 'Jupiter is the largest planet in the solar system ' + id + '.', state: 'anchor', trust: 'trusted', packet: { Phi: 7, eps: 0.12, mu: 1 }, concepts: [concept], contributor: 'encyclopedia:nasa', license: 'public-domain', source_url: 'https://science.nasa.gov/jupiter/' }, extra || {});

T('first fetch fills the cache from the backend and selects rows by concept', async () => {
  const be = AC.memoryBackend(); const sb = fakeSb([ROW('a1', 'jupiter'), ROW('a2', 'ocean'), ROW('a3', 'jupiter')]);
  const c = AC.AnchorCache({ backend: be, sb: () => sb.api, now: () => 1000 });
  const r = await c.ensure(); expect(r.ok && r.source === 'supabase' && r.rule === 'ANCHORS-FETCHED' && r.count === 3 && r.calls_llm === false, JSON.stringify(r));
  const got = await c.byConcepts(['jupiter']); expect(got.map(x => x.id).join() === 'a1,a3', got.map(x => x.id).join());
  expect(Array.isArray(be._m.rows) && be._m.rows.length === 3 && be._m.meta.digest === 'd1', 'persisted');
});
T('a later start offline uses the stored copy (no network needed for Ask)', async () => {
  const be = AC.memoryBackend(); await AC.AnchorCache({ backend: be, sb: () => fakeSb([ROW('a1', 'jupiter')]).api, now: () => 1 }).ensure();
  const off = fakeSb([], { offline: true });
  const c = AC.AnchorCache({ backend: be, sb: () => off.api, now: () => 1 + 7 * 3600 * 1000 });
  const r = await c.ensure(); expect(r.ok && r.source === 'cache' && r.rule === 'ANCHORS-OFFLINE' && r.count === 1, JSON.stringify(r));
  expect((await c.byConcepts(['jupiter'])).length === 1 && off.calls.rows === 0, 'served from cache');
});
T('same digest means no refetch; a fresh check inside the max age makes no call at all', async () => {
  const be = AC.memoryBackend(); const sb = fakeSb([ROW('a1', 'jupiter')]); let t = 0;
  const c = AC.AnchorCache({ backend: be, sb: () => sb.api, now: () => t });
  await c.ensure(); t = 1000; const r1 = await c.ensure(); expect(r1.rule === 'ANCHORS-CACHE-FRESH' && sb.calls.digest === 1, JSON.stringify(r1));
  t = 7 * 3600 * 1000; const r2 = await c.ensure(); expect(r2.rule === 'ANCHORS-CACHE-CURRENT' && sb.calls.digest === 2 && sb.calls.rows === 1, JSON.stringify(r2));
});
T('a partial fetch never replaces a good copy; no backend and no copy reports none', async () => {
  const be = AC.memoryBackend(); await AC.AnchorCache({ backend: be, sb: () => fakeSb([ROW('a1', 'jupiter')]).api, now: () => 0 }).ensure();
  const bad = fakeSb([ROW('b1', 'jupiter'), ROW('b2', 'ocean')], { partial: true, digest: 'd2' });
  const c = AC.AnchorCache({ backend: be, sb: () => bad.api, now: () => 9e9 });
  const r = await c.ensure(); expect(r.rule === 'ANCHORS-FETCH-INCOMPLETE' && r.count === 1 && (await c.byConcepts(['jupiter']))[0].id === 'a1', JSON.stringify(r));
  const none = await AC.AnchorCache({ backend: AC.memoryBackend(), sb: () => null }).ensure(); expect(!none.ok && none.source === 'none' && none.rule === 'ANCHORS-BACKEND-UNAVAILABLE', JSON.stringify(none));
});
T('low-trust or non-anchor rows never enter the cache (Wikipedia is never a premise)', async () => {
  const rows = [ROW('ok', 'jupiter'), ROW('w', 'jupiter', { contributor: 'encyclopedia:wikipedia', source_url: 'https://en.wikipedia.org/wiki/Jupiter' }), ROW('nc', 'jupiter', { license: 'CC BY-NC 4.0' }), ROW('q', 'jupiter', { trust: 'low' }), ROW('h', 'jupiter', { state: 'held' }), ROW('np', 'jupiter', { packet: {} })];
  const c = AC.AnchorCache({ backend: AC.memoryBackend(), sb: () => fakeSb(rows).api, now: () => 0 });
  await c.ensure(); expect((await c.all()).map(x => x.id).join() === 'ok', (await c.all()).map(x => x.id).join());
});
T('the Supabase rows select exactly what the old shard files selected (same anchors, same concepts)', async () => {
  const rows = shardRows(); if (!rows.length) return; /* shard files stay in the repo as the seed source for kb.anchors */
  expect(rows.length === INDEX.count, 'index count ' + INDEX.count + ' rows ' + rows.length);
  const c = AC.AnchorCache({ backend: AC.memoryBackend(), sb: () => fakeSb(rows.map(asView)).api, now: () => 0 });
  const r = await c.ensure(); expect(r.count === rows.length, 'kept ' + r.count + ' of ' + rows.length);
  for (const name of ['g190'].concat(Object.keys(INDEX.shards).slice(0, 6))) { const meta = INDEX.shards[name]; if (!meta) continue;
    const want = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'anchors_188', meta.file), 'utf8')).anchors.map(x => x.id).sort().join();
    const got = (await c.byConcepts(meta.concepts)).map(x => x.id).sort().join(); expect(got === want, name); }
});
T('sb_sync reads anchors anonymously, pages the view, and never sends a session token', async () => {
  const seen = []; const all = Array.from({ length: 2300 }, (_, i) => ({ id: 'x' + String(i).padStart(5, '0') }));
  const net = async (url, init) => { seen.push({ url, init }); const u = new URL(url);
    if (u.pathname.endsWith('/rpc/kb_anchors_digest')) return new Response(JSON.stringify({ count: 2300, digest: 'abc' }), { status: 200, headers: { 'content-type': 'application/json' } });
    const off = Number(u.searchParams.get('offset')), lim = Number(u.searchParams.get('limit')); return new Response(JSON.stringify(all.slice(off, off + lim)), { status: 200, headers: { 'content-type': 'application/json' } }); };
  const m = {}; const c = SB.Client({ storage: { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }, fetch: net, crypto: require('crypto').webcrypto });
  const d = await c.anchorsDigest(); expect(d.ok && d.count === 2300 && d.digest === 'abc', JSON.stringify(d));
  const r = await c.anchorRows(); expect(r.ok && r.rows.length === 2300, 'rows ' + r.rows.length);
  expect(seen.filter(s => /kb_anchors\?/.test(s.url)).length === 3 && seen.every(s => !(s.init.headers || {}).authorization) && seen.every(s => s.init.method !== 'DELETE' && s.init.method !== 'PATCH'), 'paged, anonymous, read-only');
  const off = SB.Client({ storage: { getItem: () => null, setItem() {}, removeItem() {} }, fetch: async () => { throw new Error('offline'); }, crypto: require('crypto').webcrypto });
  expect((await off.anchorsDigest()).offline === true && (await off.anchorRows()).ok === false, 'offline is reported, not thrown');
});
T('Ask reads anchors through the cache, never fetches shard files, and never replays recorded self-seed documents', () => {
  const app = read('src/app.js');
  expect(/KAnchorCache\.byConcepts\(concepts\)/.test(app) && /KAnchorCache\.ensure\(\)/.test(app) && !/anchors_188\/shards/.test(app) && !/'data\/anchors_188\/' \+/.test(app), 'cache path');
  expect(!/SELF_SEED_FIXTURES/.test(app) && !/SEED-REASK/.test(app), 'no fixture replay in Ask');
  const seed = read('src/self_seed_202.js'); expect(/root\.SELF_SEED_DEMO = rows\[2\]/.test(seed) && !/SELF_SEED_FIXTURES/.test(seed), 'demo global');
  expect(!/supabase\.co/.test(read('src/anchor_cache.js')) && /root\.KSb/.test(read('src/anchor_cache.js')), 'backend only through KSb');
  const page = read('index.html'); expect(page.indexOf('src/sb_sync.js') < page.indexOf('src/anchor_cache.js') && page.indexOf('src/anchor_cache.js') < page.indexOf('src/app.js'), 'script order');
});
T('every precached URL ships: sw.js FILES has no duplicates and each entry is in the ship set or generated by the build', () => {
  const sw = read('sw.js'); const files = JSON.parse(sw.match(/const FILES = (\[[^\]]*\])/)[1].replace(/'/g, '"')).filter(f => f !== './').map(f => f.replace(/^\.\//, ''));
  const ship = SS.list(ROOT).concat(SS.GENERATED, ['index.html', 'styles.css', 'manifest.json']);
  const missing = files.filter(f => !ship.includes(f)); expect(!missing.length, 'not shipped: ' + missing.join(', '));
  expect(new Set(files).size === files.length, 'duplicate FILES entry');
  for (const f of ['engine/rmc_engine_v1/reference/word_loop_seed_lexicon_v1.jsonl', 'engine/rmc_engine_v1/reference/phase_codex_v2_5.json', 'engine/rmc_engine_v1/concept_lexicon.json', 'data/anchors_188/index.json', 'docs/gks/latest.json'])
    expect(SS.list(ROOT).includes(f) && fs.existsSync(path.join(ROOT, SS.src(f))), f);
});
T('the static fetch check finds every fetched or precached path in the tree (only build-generated files are absent before the build)', () => {
  const r = CF.check(ROOT); const allowed = new Set(SS.GENERATED.concat(Object.keys(SS.OUTSIDE)));
  const real = r.missing.filter(x => !allowed.has(x.url)); expect(!real.length, JSON.stringify(real));
  expect(r.sw_files > 100 && r.literals > 20 && r.urls.includes('engine/rmc_engine_v1/reference/word_loop_seed_lexicon_v1.jsonl'), JSON.stringify({ n: r.sw_files, l: r.literals }));
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cf-')); fs.mkdirSync(path.join(tmp, 'src'));
  fs.writeFileSync(path.join(tmp, 'sw.js'), "const FILES = ['./', './src/a.js', './data/gone.json', './src/a.js'];");
  fs.writeFileSync(path.join(tmp, 'src', 'a.js'), "fetch('data/also_gone.json'); fetch('packs/none/' + k);");
  const bad = CF.check(tmp); const urls = bad.missing.map(x => x.url).sort().join();
  expect(!bad.ok && urls === 'data/also_gone.json,data/gone.json,packs/none/*,src/a.js', urls);
  expect(/check_fetches/.test(read('tools/verify_release.js')) && /runtime_missing/.test(read('tools/verify_live.js')) && /kb_anchors_digest/.test(read('tools/verify_live.js')), 'gate and live check wired');
});
T('the demos that read the seed lexicon no longer crash when it is missing', () => {
  const g = read('src/lexicon_growth_198.js'); expect(/ran\.log\[0\] && ran\.log\[0\]\.known && ran\.log\[0\]\.known\[0\]/.test(g), 'guard');
});
T('Supabase side: the read view is security-invoker and read-only, the pending migrations are marked applied, the drift bands are untouched', () => {
  const sql = fs.readFileSync(path.join(REPO, 'supabase', 'migrations', '20261031230000_anchors_read_206.sql'), 'utf8');
  expect(/security_invoker\s*=\s*(true|on)/i.test(sql) && /grant select on public\.kb_anchors to anon, authenticated/i.test(sql) && !/grant (insert|update|delete|all)/i.test(sql), 'view');
  for (const f of ['20261030223000_self_seed_anchors_202.sql', '20261030235900_frequency_signatures_203.sql', '20261031090000_frequency_tuning_204.sql'])
    expect(/applied: true/.test(fs.readFileSync(path.join(REPO, 'supabase', 'migrations', f), 'utf8')), f);
  const cfg = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'mobile_config.py'), 'utf8'); expect(/0\.35/.test(cfg) && /0\.8/.test(cfg), 'drift bands untouched');
});

(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4206', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4206', name: t.name, ok: false, why: String(e && e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
