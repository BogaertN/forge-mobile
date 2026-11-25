/* gks.js: S4 GKS pin/verify with ECDSA P-256 (lazy; not inlined). */
(function (root) {
const isNode = typeof module !== 'undefined' && module.exports, { sha256 } = isNode ? require('./sha256.js') : root.KSha;
const SCHEMA = 'GKS/v1';
/* compiled-in publisher pubkeys (build-manifest covered). Private key is Actions secret GKS_PUBLISHER_PRIVATE_JWK only. */
const KB_PUBLISHER_PUBKEYS = Object.freeze([
  { kid: 'gks-d472ecd45b72859b', kty: 'EC', crv: 'P-256', x: 'vbkyTJwd2NUhBvdhI9_hkmFWVH4ociQjUW2YZ7m6iuE', y: 'GQCBnP6AH9-Z9e8y8djMkc9NC4PggrQklkj_chcYBS0' }
]);
const canon = o => Array.isArray(o) ? '[' + o.map(canon).join(',') + ']' : o && typeof o === 'object' ? '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}' : JSON.stringify(o);
const bodyHash = body => sha256(canon(body));
const subtle = () => (typeof crypto !== 'undefined' && crypto.subtle) || (isNode && require('crypto').webcrypto.subtle);
const b64u = u => { const s = typeof Buffer !== 'undefined' ? Buffer.from(u).toString('base64') : btoa(String.fromCharCode.apply(null, u)); return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = s => { const t = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4); return new Uint8Array(typeof Buffer !== 'undefined' ? Buffer.from(t, 'base64') : Uint8Array.from(atob(t), c => c.charCodeAt(0))); };
const enc = new TextEncoder();
async function importPub(jwk) { return subtle().importKey('jwk', { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, ext: true, key_ops: ['verify'] }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']); }
async function importPriv(jwk) { return subtle().importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']); }
async function signBody(privJwk, body) { const key = await importPriv(privJwk), sig = await subtle().sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(canon(body))); return b64u(new Uint8Array(sig)); }
async function verifySig(pubJwk, snap, body) { try { const key = await importPub(pubJwk); return subtle().verify({ name: 'ECDSA', hash: 'SHA-256' }, key, unb64u(snap.signature), enc.encode(canon(body))); } catch (e) { return false; } }
async function verify(snap, body, opts) {
  opts = opts || {};
  if (!snap || snap.schema !== SCHEMA || typeof snap.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(snap.sha256) || typeof snap.signature !== 'string') return { ok: false, rule: 'GKS-BAD-SHAPE' };
  if (bodyHash(body) !== snap.sha256) return { ok: false, rule: 'GKS-HASH-MISMATCH' };
  const keys = opts.pubkeys || KB_PUBLISHER_PUBKEYS;
  if (!keys.length && !opts.allowEmptyKeys) return { ok: false, rule: 'GKS-NO-PUBLISHER-KEYS' };
  const pub = keys.find(k => k.kid === snap.publisher_kid); if (keys.length && !pub) return { ok: false, rule: 'GKS-UNKNOWN-PUBLISHER' };
  if (opts.revoked && opts.revoked[snap.sha256]) return { ok: false, rule: 'GKS-REVOKED', parent: snap.parent_sha256 || null };
  if (typeof opts.checkSig === 'function') { if (!opts.checkSig(snap, body)) return { ok: false, rule: 'GKS-BAD-SIGNATURE' }; }
  else if (pub && !(await verifySig(pub, snap, body))) return { ok: false, rule: 'GKS-BAD-SIGNATURE' };
  return { ok: true };
}
async function pin(store, snap, body, opts) {
  const v = await verify(snap, body, opts);
  if (!v.ok) {
    if (v.rule === 'GKS-REVOKED' && v.parent) { const cur = store.load('gks_pinned'); if (cur && cur.sha256 === v.parent) return { ok: true, rolled_back: true, sha256: v.parent }; }
    return v;
  }
  store.save('gks_pinned', { schema: SCHEMA, sha256: snap.sha256, parent_sha256: snap.parent_sha256 || null, seq: snap.seq, publisher_kid: snap.publisher_kid, body, pinned_at: (opts && opts.now) || new Date().toISOString() });
  return { ok: true, sha256: snap.sha256 };
}
const load = store => store.load('gks_pinned') || null;
const traceTag = (input, gks) => sha256(canon({ input: String(input), gks_sha256: gks && gks.sha256 || null }));
async function autoPin(store, snap, body, opts) { return pin(store, snap, body, opts); }
const api = { SCHEMA, KB_PUBLISHER_PUBKEYS, canon, bodyHash, verify, verifySig, signBody, pin, autoPin, load, traceTag };
if (isNode) module.exports = api; else root.KGKS = api;
})(typeof self !== 'undefined' ? self : this);
