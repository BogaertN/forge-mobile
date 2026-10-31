/* anchor_cache.js (4.9.206): the phone's offline copy of the trusted anchors (Nic decision (b): anchors live in Supabase).
 * Rows come from the read-only kb.anchors view through window.KSb (sb_sync.js is the only module that talks to the backend).
 * They are kept in IndexedDB, so Ask keeps its anchors offline after the first fetch. A digest check decides whether a
 * refetch is needed. If the backend cannot be reached and nothing is cached, Ask still has the shipped starter anchors
 * (data/anchors_187.json). Only trusted anchor rows are kept: low-trust sources never enter this cache. No LLM. */
(function (root) {
'use strict';
const DB = 'forge-anchors', STORE = 'kv', SCHEMA = 'FORGE-ANCHOR-CACHE/v1';
const LOW = /wikipedia|wikimedia|wikidata|dbpedia|wikisource|conceptnet/i;
function idbBackend(idb) {
  let dbp = null;
  const open = () => (dbp = dbp || new Promise((res, rej) => { const q = idb.open(DB, 1); q.onupgradeneeded = () => q.result.createObjectStore(STORE); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }));
  const tx = (mode, fn) => open().then(db => new Promise((res, rej) => { const t = db.transaction(STORE, mode); const st = t.objectStore(STORE); const out = fn(st); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }));
  return { get: k => tx('readonly', st => st.get(k)), put: (k, v) => tx('readwrite', st => { st.put(v, k); return null; }) };
}
function memoryBackend() { const m = {}; return { get: async k => m[k], put: async (k, v) => { m[k] = JSON.parse(JSON.stringify(v)); }, _m: m }; }
function keep(row) {
  if (!row || typeof row.id !== 'string' || typeof row.text !== 'string' || row.text.length < 8) return false;
  if (row.trust !== 'trusted' || row.state !== 'anchor') return false;
  const p = row.packet || {}; if (p.Phi == null || p.eps == null || p.mu == null) return false;
  const blob = String(row.contributor || '') + ' ' + String(row.source_url || '') + ' ' + String(row.license || '');
  return !LOW.test(blob) && !/by-nc/i.test(String(row.license || ''));
}
function AnchorCache(o) {
  o = o || {};
  const backend = o.backend || (root.indexedDB ? idbBackend(root.indexedDB) : memoryBackend());
  const sb = () => (o.sb ? o.sb() : root.KSb);
  const now = () => (o.now ? o.now() : Date.now());
  const maxAge = o.maxAgeMs || 6 * 3600 * 1000;
  let meta = null, rows = null, byConcept = null, inflight = null, loaded = false;
  function index() { byConcept = new Map(); for (const r of rows || []) for (const c of (Array.isArray(r.concepts) ? r.concepts : [])) { if (!byConcept.has(c)) byConcept.set(c, []); byConcept.get(c).push(r); } }
  async function load() { if (loaded) return; loaded = true; try { meta = (await backend.get('meta')) || null; rows = (await backend.get('rows')) || null; } catch (e) { meta = null; rows = null; } if (!Array.isArray(rows)) rows = null; index(); }
  const report = (source, rule) => ({ ok: !!(rows && rows.length), source: rows && rows.length ? source : 'none', rule, count: rows ? rows.length : 0, digest: meta && meta.digest || null, fetched_at: meta && meta.fetched_at || null, checked_at: meta && meta.checked_at || null, schema: SCHEMA, calls_llm: false });
  async function refresh(force) {
    await load();
    if (!force && meta && rows && now() - (meta.checked_at || 0) < maxAge) return report('cache', 'ANCHORS-CACHE-FRESH');
    const api = sb(); if (!api || !api.anchorsDigest || !api.anchorRows) return report('cache', 'ANCHORS-BACKEND-UNAVAILABLE');
    const d = await api.anchorsDigest(); if (!d || !d.ok) return report('cache', 'ANCHORS-OFFLINE');
    if (meta && rows && meta.digest === d.digest && rows.length > 0) { meta = Object.assign({}, meta, { checked_at: now() }); try { await backend.put('meta', meta); } catch (e) { /* keep memory */ } return report('cache', 'ANCHORS-CACHE-CURRENT'); }
    const got = await api.anchorRows(); if (!got || !got.ok || got.rows.length !== d.count) return report('cache', 'ANCHORS-FETCH-INCOMPLETE');
    const fresh = got.rows.filter(keep); if (!fresh.length) return report('cache', 'ANCHORS-FETCH-EMPTY');
    const m = { schema: SCHEMA, digest: d.digest, count: fresh.length, server_count: d.count, fetched_at: now(), checked_at: now(), source: 'supabase:kb.anchors' };
    try { await backend.put('rows', fresh); await backend.put('meta', m); } catch (e) { /* storage full: still use this session's copy */ }
    rows = fresh; meta = m; index(); return report('supabase', 'ANCHORS-FETCHED');
  }
  function ensure(opts) { if (!inflight) inflight = refresh(!!(opts && opts.force)).finally(() => { inflight = null; }); return inflight; }
  async function byConcepts(list) { await load(); const out = [], seen = new Set(); for (const c of list || []) for (const r of (byConcept && byConcept.get(c)) || []) if (!seen.has(r.id)) { seen.add(r.id); out.push(r); } return out; }
  async function all() { await load(); return (rows || []).slice(); }
  async function status() { await load(); return report(rows && rows.length ? 'cache' : 'none', meta ? 'ANCHORS-CACHED' : 'ANCHORS-NOT-CACHED'); }
  return { ensure, byConcepts, all, status, keep };
}
const api = { AnchorCache, memoryBackend, idbBackend, keep, SCHEMA };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else { root.KAnchorCacheLib = api; root.KAnchorCache = AnchorCache(); }
})(typeof self !== 'undefined' ? self : this);
