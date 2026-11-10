/* contrib_cache.js (4.9.209): the phone's offline copy of the curated shared facts (Nic plan, Release A item 3).
 * Rows are the ADMITTED kb.contributions facts (Athena curation or an explicit user "remember", written only through the
 * locked memory-writer Edge Function), read through the read-only public.kb_contributions_admitted function via window.KSb.
 * They are kept in IndexedDB (forge-contributions) and refetched only when public.kb_contributions_digest changes (checked at
 * most every 6 hours). Ask reads them as hosted memory with the same trust and the same gate as every other row: a cached
 * fact is a candidate, never an answer by itself. A row is kept only if it is admitted, carries a numeric packet in the
 * admission band, names a contributor and a provenance whose trust trace rests on a trusted anchor, and cites no
 * low-trust source. Read only: this module never writes to the backend. No LLM. */
(function (root) {
'use strict';
const DB = 'forge-contributions', STORE = 'kv', SCHEMA = 'FORGE-CONTRIB-CACHE/v1';
const LOW = /wikipedia|wikimedia|wikidata|dbpedia|wikisource|conceptnet/i;
const KMath = () => root.KMath || (typeof module !== 'undefined' && module.exports ? require('./kmath.js') : null);
function idbBackend(idb) {
  let dbp = null;
  const open = () => (dbp = dbp || new Promise((res, rej) => { const q = idb.open(DB, 1); q.onupgradeneeded = () => q.result.createObjectStore(STORE); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }));
  const tx = (mode, fn) => open().then(db => new Promise((res, rej) => { const t = db.transaction(STORE, mode); const st = t.objectStore(STORE); const out = fn(st); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }));
  return { get: k => tx('readonly', st => st.get(k)), put: (k, v) => tx('readwrite', st => { st.put(v, k); return null; }) };
}
function memoryBackend() { const m = {}; return { get: async k => m[k], put: async (k, v) => { m[k] = JSON.parse(JSON.stringify(v)); }, _m: m }; }
function admitBand(eps) { const K = KMath(); if (K && K.DRIFT_POLICY && K.classifyDrift) return K.classifyDrift({ eps }).region === 'clean'; return typeof eps === 'number' && eps >= 0 && eps <= 0.35; }
function keep(row) {
  if (!row || typeof row.id !== 'string' || typeof row.text !== 'string' || row.text.trim().length < 8) return false;
  const s = row.sfe || {}; const phi = Number(s.Phi), eps = Number(s.eps), mu = Number(s.mu);
  if (!(phi >= 1 && phi <= 9) || !isFinite(eps) || !admitBand(eps) || !(mu > 0 && mu <= 1)) return false;
  if (typeof row.contributor !== 'string' || !row.contributor.trim()) return false;
  const p = row.provenance; if (!p || typeof p !== 'object') return false;
  const t = p.trust || {}; if (typeof t.rests_on !== 'string' || !t.rests_on || t.blocks_admit === true) return false;
  return !LOW.test(JSON.stringify(p) + ' ' + row.contributor);
}
function ContribCache(o) {
  o = o || {};
  const backend = o.backend || (root.indexedDB ? idbBackend(root.indexedDB) : memoryBackend());
  const sb = () => (o.sb ? o.sb() : root.KSb);
  const now = () => (o.now ? o.now() : Date.now());
  const maxAge = o.maxAgeMs || 6 * 3600 * 1000;
  let meta = null, rows = null, inflight = null, loaded = false;
  async function load() { if (loaded) return; loaded = true; try { meta = (await backend.get('meta')) || null; rows = (await backend.get('rows')) || null; } catch (e) { meta = null; rows = null; } if (!Array.isArray(rows)) rows = null; }
  const report = (source, rule) => ({ ok: true, source, rule, count: rows ? rows.length : 0, digest: meta && meta.digest || null, checked_at: meta && meta.checked_at || null, schema: SCHEMA, writes: false, calls_llm: false });
  async function refresh(force) {
    await load();
    if (!force && meta && now() - (meta.checked_at || 0) < maxAge) return report('cache', 'CONTRIB-CACHE-FRESH');
    const api = sb(); if (!api || !api.contributionsDigest || !api.contributionRows) return report('cache', 'CONTRIB-BACKEND-UNAVAILABLE');
    const d = await api.contributionsDigest(); if (!d || !d.ok) return report('cache', 'CONTRIB-OFFLINE');
    if (meta && meta.digest === d.digest) { meta = Object.assign({}, meta, { checked_at: now() }); try { await backend.put('meta', meta); } catch (e) { /* keep memory */ } return report('cache', 'CONTRIB-CACHE-CURRENT'); }
    const got = d.count ? await api.contributionRows() : { ok: true, rows: [] };
    if (!got || !got.ok || got.rows.length !== d.count) return report('cache', 'CONTRIB-FETCH-INCOMPLETE');
    const fresh = got.rows.filter(keep);
    const m = { schema: SCHEMA, digest: d.digest, count: fresh.length, server_count: d.count, dropped: d.count - fresh.length, fetched_at: now(), checked_at: now(), source: 'supabase:kb.contributions (admitted, read-only)' };
    try { await backend.put('rows', fresh); await backend.put('meta', m); } catch (e) { /* storage full: still use this session's copy */ }
    rows = fresh; meta = m; return report('supabase', 'CONTRIB-FETCHED');
  }
  function ensure(opts) { if (!inflight) inflight = refresh(!!(opts && opts.force)).finally(() => { inflight = null; }); return inflight; }
  async function all() { await load(); return (rows || []).slice(); }
  async function status() { await load(); return report(rows ? 'cache' : 'none', meta ? 'CONTRIB-CACHED' : 'CONTRIB-NOT-CACHED'); }
  return { ensure, all, status, keep };
}
const api = { ContribCache, memoryBackend, idbBackend, keep, SCHEMA };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else { root.KContribCacheLib = api; root.KContribCache = ContribCache(); }
})(typeof self !== 'undefined' ? self : this);
