(function (root) {
const isNode = typeof module !== 'undefined' && module.exports, { sha256 } = isNode ? require('./sha256.js') : root.KSha;
const SCHEMA = 'GKS/v1', KB_PUBLISHER_PUBKEYS = [];
const canon = o => Array.isArray(o) ? '[' + o.map(canon).join(',') + ']' : o && typeof o === 'object' ? '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}' : JSON.stringify(o);
const bodyHash = body => sha256(canon(body));
function verify(snap, body, opts) {
  opts = opts || {};
  if (!snap || snap.schema !== SCHEMA || typeof snap.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(snap.sha256)) return { ok: false, rule: 'GKS-BAD-SHAPE' };
  if (bodyHash(body) !== snap.sha256) return { ok: false, rule: 'GKS-HASH-MISMATCH' };
  const keys = opts.pubkeys || KB_PUBLISHER_PUBKEYS;
  if (!keys.length && !opts.allowEmptyKeys) return { ok: false, rule: 'GKS-NO-PUBLISHER-KEYS' };
  if (keys.length && !keys.some(k => k.kid === snap.publisher_kid)) return { ok: false, rule: 'GKS-UNKNOWN-PUBLISHER' };
  if ((typeof opts.checkSig === 'function' && !opts.checkSig(snap, body))) return { ok: false, rule: 'GKS-BAD-SIGNATURE' };
  if (opts.revoked && opts.revoked[snap.sha256]) return { ok: false, rule: 'GKS-REVOKED', parent: snap.parent_sha256 || null };
  return { ok: true };
}
function pin(store, snap, body, opts) {
  const v = verify(snap, body, opts);
  if (!v.ok) {
    if (v.rule === 'GKS-REVOKED' && v.parent) { const cur = store.load('gks_pinned'); if (cur && cur.sha256 === v.parent) return { ok: true, rolled_back: true, sha256: v.parent }; }
    return v;
  }
  store.save('gks_pinned', { schema: SCHEMA, sha256: snap.sha256, parent_sha256: snap.parent_sha256 || null, seq: snap.seq, body, pinned_at: (opts && opts.now) || new Date().toISOString() });
  return { ok: true, sha256: snap.sha256 };
}
const load = store => store.load('gks_pinned') || null;
const traceTag = (input, gks) => sha256(canon({ input: String(input), gks_sha256: gks && gks.sha256 || null }));
const api = { SCHEMA, KB_PUBLISHER_PUBKEYS, canon, bodyHash, verify, pin, load, traceTag };
if (isNode) module.exports = api; else root.KGKS = api;
})(typeof self !== 'undefined' ? self : this);
