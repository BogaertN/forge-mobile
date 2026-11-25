/* sb_blobs.js — S3 private.blobs REST (lazy; not inlined). Attaches blobIo onto an existing KSb client. */
(function (root) {
'use strict';
function attach(client) {
  if (!client || client.blobIo) return client;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const bx = b => '\\x' + Array.from(enc.encode(JSON.stringify(b)), x => x.toString(16).padStart(2, '0')).join('');
  const ub = v => { if (v == null || typeof v === 'object') return v; const h = String(v).replace(/^\\x/i, ''); return JSON.parse(dec.decode(Uint8Array.from(h.match(/.{2}/g).map(x => parseInt(x, 16))))); };
  const COL = 'store,record_id,version,content_hmac,base_hmac,ciphertext,deleted,server_seq,device_id';
  const call = client._call || null;
  client.blobIo = function () {
    const cfg = client.config, tokFn = () => client.token();
    const H2 = async () => { const tok = await tokFn(); return tok && { apikey: cfg.key, authorization: 'Bearer ' + tok, 'content-type': 'application/json', 'Accept-Profile': 'private', 'Content-Profile': 'private', Prefer: 'return=representation' }; };
    const get = async (path, init) => { const h = await H2(); if (!h) return { ok: false }; const r = await fetch(cfg.url + path, Object.assign({ credentials: 'omit', cache: 'no-store' }, init, { headers: Object.assign(h, (init && init.headers) || {}) })); let body = null; try { body = await r.json(); } catch (e) { body = null; } return { ok: r.ok, body }; };
    return async (op, arg) => {
      if (op === 'tip') { const r = await get('/rest/v1/blobs?select=' + COL + '&store=eq.' + encodeURIComponent(arg.store) + '&record_id=eq.' + encodeURIComponent(arg.record_id) + '&order=version.desc&limit=1'); const row = r.ok && r.body && r.body[0]; return row ? Object.assign({}, row, { ciphertext: ub(row.ciphertext) }) : null; }
      if (op === 'insert') { const b = { store: arg.store, record_id: arg.record_id, version: arg.version, device_id: arg.device_id, base_hmac: arg.base_hmac, content_hmac: arg.content_hmac, ciphertext: arg.deleted ? null : bx(arg.ciphertext), deleted: !!arg.deleted }; return !!(await get('/rest/v1/blobs', { method: 'POST', body: JSON.stringify(b) })).ok; }
      if (op === 'since') { const r = await get('/rest/v1/blobs?select=' + COL + '&server_seq=gt.' + (+arg || 0) + '&order=server_seq.asc&limit=500'); return r.ok ? (r.body || []).map(x => Object.assign({}, x, { ciphertext: ub(x.ciphertext) })) : []; }
    };
  };
  return client;
}
const api = { attach };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KSbBlobs = api;
})(typeof self !== 'undefined' ? self : this);
