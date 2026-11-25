(function (root) {
const isNode = typeof module !== 'undefined' && module.exports;
const FORBIDDEN = Object.freeze(['vault', 'signing_key', 'node_pairing', 'pairing', 'permissions', 'policy', 'trace']);
const STORE_OK = /^[a-z_]{1,40}$/, enc = new TextEncoder(), dec = new TextDecoder();
const canon = o => Array.isArray(o) ? '[' + o.map(canon).join(',') + ']' : o && typeof o === 'object' ? '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}' : JSON.stringify(o);
const NB = typeof Buffer !== 'undefined', b64 = u => NB ? Buffer.from(u).toString('base64') : btoa(String.fromCharCode.apply(null, u));
const unb64 = s => new Uint8Array(NB ? Buffer.from(s, 'base64') : Uint8Array.from(atob(s), c => c.charCodeAt(0)));
const hex = u => Array.from(u, x => x.toString(16).padStart(2, '0')).join('');
const subtle = () => (typeof crypto !== 'undefined' && crypto.subtle) || require('crypto').webcrypto.subtle;
const AG='AES-GCM', hmacKey = raw => subtle().importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
const aesKey = raw => subtle().importKey('raw', raw, AG, false, ['encrypt', 'decrypt']);
async function hmac(key, text) { return hex(new Uint8Array(await subtle().sign('HMAC', await hmacKey(key), enc.encode(text)))); }
async function seal(key, obj) { const iv = crypto.getRandomValues(new Uint8Array(12)); return { iv: b64(iv), ct: b64(new Uint8Array(await subtle().encrypt({ name: AG, iv }, await aesKey(key), enc.encode(JSON.stringify(obj))))) }; }
async function open(key, box) { return JSON.parse(dec.decode(await subtle().decrypt({ name: AG, iv: unb64(box.iv) }, await aesKey(key), unb64(box.ct)))); }
async function ensureKey(vault, rnd) { const hit = (typeof vault.entries === 'function' ? vault.entries() : []).find(x => x && (x.kind === 'sync_key' || x.id === 'sync_key')); if (hit) return unb64(await vault.reveal(hit.id, true)); try { return unb64(await vault.reveal('sync_key', true)); } catch (e0) { const k = rnd(32); await vault.seal('sync_key', 'sync', b64(k), { kind: 'sync_key' }); return k; } }
function Worker(opts) {
  opts = opts || {}; const store = opts.store, vault = opts.vault, client = opts.client, device = opts.device || 'dev-local';
  const Q = () => { const q = store.load('e2ee_queue'); return Array.isArray(q) ? q : []; }, SQ = q => store.save('e2ee_queue', q.slice(-500));
  const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {}, e2eeCat = s => 'e2ee_' + s, L = s => obj(store.load(e2eeCat(s))), SL = (s, m) => store.save(e2eeCat(s), m);
  const forbid = s => !STORE_OK.test(s) || FORBIDDEN.indexOf(s) >= 0;
  const key = () => ensureKey(vault, n => { const u = new Uint8Array(n); (opts.crypto || crypto).getRandomValues(u); return u; });
  async function put(s, id, obj) {
    if (forbid(s)) return { ok: false, rule: 'E2EE-FORBIDDEN-STORE', store: s };
    const k = await key(), hm = await hmac(k, canon(obj)), box = await seal(k, obj), loc = L(s), prev = loc[id];
    const row = { store: s, record_id: id, version: (prev && prev.version || 0) + 1, device_id: device, base_hmac: prev ? prev.content_hmac : null, content_hmac: hm, ciphertext: box, deleted: false };
    loc[id] = { version: row.version, content_hmac: hm, box, obj }; SL(s, loc); const q = Q(); q.push(row); SQ(q); return { ok: true, row };
  }
  async function flush(io) {
    if (!(client && await client.token())) return { ok: false, rule: 'E2EE-OFFLINE', queued: Q().length };
    const q = Q(), kept = [], conflicts = [], sent = [];
    for (const row of q) {
      const tip = await io('tip', row);
      if (tip && tip.content_hmac && tip.content_hmac !== row.base_hmac && tip.content_hmac !== row.content_hmac) { conflicts.push({ store: row.store, record_id: row.record_id, local: row, remote: tip }); kept.push(row); continue; }
      if (await io('insert', row)) sent.push(row); else kept.push(row);
    }
    SQ(kept); return { ok: true, sent: sent.length, queued: kept.length, conflicts };
  }
  async function pull(io) {
    if (!(client && await client.token())) return { ok: false, rule: 'E2EE-OFFLINE' };
    const k = await key(), rows = await io('since', +store.load('e2ee_cursor') || 0); let n = 0;
    for (const row of rows || []) {
      if (forbid(row.store)) continue;
      const box = typeof row.ciphertext === 'string' ? JSON.parse(row.ciphertext) : row.ciphertext, obj = await open(k, box), hm = await hmac(k, canon(obj));
      if (hm !== row.content_hmac) continue;
      const loc = L(row.store); if (loc[row.record_id] && loc[row.record_id].version >= row.version) continue;
      loc[row.record_id] = { version: row.version, content_hmac: hm, box, obj }; SL(row.store, loc); n++; store.save('e2ee_cursor', row.server_seq);
    }
    return { ok: true, pulled: n };
  }
  return { FORBIDDEN, forbid, put, flush, pull, queue: Q, local: L };
}
async function syncPrivate(forge, client, stores) {
  stores = stores || ['memory', 'evidence', 'reminders', 'lexicon_user', 'held_writes', 'cold_storage', 'meta'];
  if (forge.vault.status() !== 'unlocked') return { ok: false, rule: 'VAULT-LOCKED' };
  if (!forge.vault.entries().some(x => x.kind === 'sync_key')) {
    const u = new Uint8Array(32); (forge._crypto || crypto).getRandomValues(u);
    const b64 = typeof Buffer !== 'undefined' ? Buffer.from(u).toString('base64') : btoa(String.fromCharCode.apply(null, u));
    const r = await forge.vault.seal('sync_key', 'sync', b64); if (!r.ok) return r;
  }
  const st = client.status(), w = Worker({ store: forge.store, vault: forge.vault, client, device: st.device || 'dev' }), io = client.blobIo(); if (!io) return { ok: false, rule: 'E2EE-NO-BLOB-IO' };
  let n = 0; for (const s of stores) { const rows = forge.store.load(s); if (!Array.isArray(rows)) { if (rows && typeof rows === 'object') { await w.put(s, 'root', rows); n++; } continue; }
    for (const r of rows) { const id = r && (r.id || r.record_id); if (id) { await w.put(s, String(id), r); n++; } } }
  const fl = await w.flush(io); if (!fl.ok) return fl; const pl = await w.pull(io); return { ok: true, queued: n, sent: fl.sent, conflicts: fl.conflicts || [], pulled: pl.pulled || 0 };
}
const api = { Worker, FORBIDDEN, canon, syncPrivate };
if (isNode) module.exports = api; else root.KE2EE = api;
})(typeof self !== 'undefined' ? self : this);
