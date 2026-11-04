/* senses.js — 4.9.221 shadow sense trace (KSenses). Advisory only (Nic 2026-11-04, t136u): it is never read by recall,
 * Echo, drift or any gate and changes no answer; the trace is kept in memory for this session only (nothing is stored).
 * Order: an existing concept is PINNED to its curated meaning (data/concept_senses.json, Open English WordNet 2025 plus
 * sense ids, CC BY 4.0); a word with one WordNet category is plain; a homograph (the forge-ref sense pack) is resolved
 * only by capitalisation; anything else is logged as would_ask (Forge would ask). Lesk overlap is logged as a hint only.
 * The pack is lazy-loaded from the forge-ref Storage bucket (public read, no credentials), checked against the SHA-256
 * pinned below before it is used, and kept in the Cache API. Python mirror: tools/sense_trace.py (parity: tools/parity_221_senses.js).
 * No model, no embeddings, no randomness. */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports;
const FORGE_REF = {"schema":"FORGE-REF/v1","cache":"forge-ref-v1","pack":{"name":"senses_oewn2025plus_homographs","file":"senses_oewn2025plus_homographs.b455e78860f7.json.gz","url":"https://hqcvywujrygbnaowgwln.supabase.co/storage/v1/object/public/forge-ref/senses_oewn2025plus_homographs.b455e78860f7.json.gz","bytes":1085683,"sha256":"b455e78860f76bd6e0bb23172cf3d47fd90710bdac91b505d31e85d5985cf476","integrity":"sha256-tFXniGD3a9bguyMXLPPUf9kHEL2skbUF0x6F1Zhc9HY=","licence":"CC BY 4.0","source":"Open English WordNet 2025 (plus edition)"}};
const TABLE_URL = 'data/concept_senses.json';
const STOP = new Set(('a an the of and or in on at to for by with from as is are was were be been being it its this that these those ' +
  'which who whom whose what when where why how not no any some all one two used use usually especially often very more most ' +
  'such than other into out up down over under about after before between also can may do does did has have had he she they ' +
  'them his her their our we you your i me my there here so if then because while much many each every only same').split(/\s+/));
const SUFFIXES = ['ing', 'ies', 'es', 's', 'ed', 'al', 'ly'];
function stem(w) { w = w.toLowerCase(); for (const suf of SUFFIXES) { if (w.length > suf.length + 3 && w.endsWith(suf)) { w = w.slice(0, -suf.length); break; } } return w.slice(0, 6); }
function forms(w) { const out = [w]; if (w.endsWith('ies') && w.length > 4) out.push(w.slice(0, -3) + 'y'); if (w.endsWith('es') && w.length > 3) out.push(w.slice(0, -2)); if (w.endsWith('s') && w.length > 3) out.push(w.slice(0, -1)); return out; }
function stripEnds(w) { return w.replace(/^[-']+/, '').replace(/[-']+$/, ''); }
function tokens(text) {
  text = String(text == null ? '' : text); const anyUpper = /[A-Z]/.test(text); const out = []; const re = /[A-Za-z][A-Za-z'-]*/g; let m;
  while ((m = re.exec(text))) {
    const raw = m[0]; const word = stripEnds(raw.toLowerCase().replace(/('s|')$/, ''));
    const before = text.slice(0, m.index).trimEnd(); const initial = !before || '.!?:;"\n'.indexOf(before[before.length - 1]) >= 0;
    out.push({ w: word, cap: (initial || !anyUpper) ? null : /^[A-Z]/.test(raw) });
  }
  return out;
}
function lesk(senses, context) {
  const scored = senses.map(s => { const sig = new Set(); for (const t of (String(s[5]).match(/[A-Za-z][A-Za-z'-]+/g) || [])) if (!STOP.has(t.toLowerCase()) && t.length > 2) sig.add(stem(t)); let n = 0; for (const x of sig) if (context.has(x)) n++; return [n, s[0]]; });
  scored.sort((a, b) => (b[0] - a[0]) || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  if (!scored.length || scored[0][0] < 1) return null;
  if (scored.length > 1 && scored[0][0] - scored[1][0] < 1) return null;
  return scored[0][1];
}
function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
function trace(text, table, pack) {
  const surf = (table && table.surfaces) || {}; const lemmas = (pack && pack.lemmas) || {}; const lexfiles = (pack && pack.lexfiles) || [];
  const toks = tokens(text).filter(t => t.w && !STOP.has(t.w) && t.w.length > 2); const used = toks.map(() => false); const entries = [];
  for (const size of [3, 2]) for (let i = 0; i + size <= toks.length; i++) {
    if (used.slice(i, i + size).some(Boolean)) continue;
    const key = toks.slice(i, i + size).map(t => t.w).join(' ');
    if (has(surf, key)) { for (let j = i; j < i + size; j++) used[j] = true; entries.push({ at: i, w: key, state: 'pinned', by: 'curated', concepts: surf[key].map(x => x[0]), senses: surf[key].map(x => x[1]) }); }
  }
  const context = new Set(toks.map(t => stem(t.w))); let plain = 0;
  toks.forEach((t, i) => {
    if (used[i]) return; const w = t.w;
    const hit = forms(w).find(f => has(surf, f));
    if (hit) { entries.push({ at: i, w, state: 'pinned', by: 'curated', concepts: surf[hit].map(x => x[0]), senses: surf[hit].map(x => x[1]) }); return; }
    const lem = forms(w).find(f => has(lemmas, f));
    if (!lem) { plain++; return; }
    const ss = lemmas[lem]; const proper = ss.filter(s => s[2] === 1); const common = ss.filter(s => s[2] === 0);
    const e = { at: i, w, n: ss.length };
    if (t.cap === true && proper.length === 1) Object.assign(e, { state: 'resolved', by: 'capitalisation', sense: proper[0][0], lexfile: lexfiles.length ? lexfiles[proper[0][1]] : proper[0][1] });
    else if (t.cap === false && common.length && new Set(common.map(s => s[1])).size === 1) Object.assign(e, { state: 'resolved', by: 'lowercase', sense: common[0][0], lexfile: lexfiles.length ? lexfiles[common[0][1]] : common[0][1] });
    else Object.assign(e, { state: 'would_ask', by: 'ambiguous' });
    const ctx = new Set(context); ctx.delete(stem(w));
    e.lesk = lesk(t.cap === true && proper.length ? proper : (t.cap === false && common.length ? common : ss), ctx);
    entries.push(e);
  });
  entries.sort((a, b) => a.at - b.at);
  const pinned = entries.filter(e => e.state === 'pinned');
  return { schema: 'FORGE-SENSE-TRACE/v1', mode: 'advisory', pack: Object.keys(lemmas).length > 0, entries,
    counts: { pinned: pinned.length, pinned_with_sense: pinned.filter(e => e.senses.some(Boolean)).length, resolved: entries.filter(e => e.state === 'resolved').length, would_ask: entries.filter(e => e.state === 'would_ask').length, plain } };
}
/* browser side: lazy table + pack, in-memory session log (nothing persisted, no Supabase, no network write) */
let table = null, pack = null, packState = 'not_loaded', loading = null; const LOG = []; const LOG_MAX = 50;
const totals = { asks: 0, pinned: 0, pinned_with_sense: 0, resolved: 0, would_ask: 0, plain: 0 };
async function sha256hex(buf) { const d = new Uint8Array(await crypto.subtle.digest('SHA-256', buf)); let s = ''; for (const b of d) s += b.toString(16).padStart(2, '0'); return s; }
async function gunzip(buf) { const ds = new DecompressionStream('gzip'); const out = new Response(new Blob([buf]).stream().pipeThrough(ds)); return out.text(); }
async function loadPack() {
  const p = FORGE_REF.pack; let cache = null; try { cache = await caches.open(FORGE_REF.cache); } catch (e) { cache = null; }
  let res = cache ? await cache.match(p.url) : null; let from = 'cache';
  if (!res) { from = 'network'; res = await fetch(p.url, { credentials: 'omit', referrerPolicy: 'no-referrer', integrity: p.integrity, cache: 'no-store' }); if (!res.ok) throw new Error('forge_ref_http_' + res.status); }
  const buf = await res.arrayBuffer();
  if (await sha256hex(buf) !== p.sha256) { if (cache) { try { await cache.delete(p.url); } catch (e) {} } throw new Error('forge_ref_sha256_mismatch'); }
  if (from === 'network' && cache) { try { await cache.put(p.url, new Response(buf.slice(0), { headers: { 'content-type': 'application/gzip' } })); } catch (e) {} }
  const j = JSON.parse(await gunzip(buf)); if (!j || j.schema !== 'FORGE-SENSE-PACK/v1') throw new Error('forge_ref_schema'); return j;
}
function ensure() {
  if (loading) return loading;
  loading = (async () => {
    if (!table) { try { const r = await fetch(TABLE_URL); table = r.ok ? await r.json() : null; } catch (e) { table = null; } }
    if (!pack && packState !== 'failed') { try { pack = await loadPack(); packState = 'loaded'; } catch (e) { packState = 'failed'; root.KSensesError = String(e && e.message || e); } }
    return { table: !!table, pack: packState };
  })();
  return loading;
}
/* called after Ask has rendered its card; never awaited by Ask */
function note(question) {
  return ensure().then(() => {
    if (!table) return null; const t = trace(question, table, pack); totals.asks++; for (const k of ['pinned', 'pinned_with_sense', 'resolved', 'would_ask', 'plain']) totals[k] += t.counts[k];
    LOG.push({ entries: t.entries, counts: t.counts, pack: packState }); while (LOG.length > LOG_MAX) LOG.shift(); return t;
  }).catch(() => null);
}
const api = { FORGE_REF, TABLE_URL, STOP, stem, forms, tokens, trace, ensure, note, log: () => LOG.slice(), totals: () => Object.assign({ pack: packState }, totals) };
if (isNode) module.exports = api; else root.KSenses = api;
})(typeof self !== 'undefined' ? self : this);
