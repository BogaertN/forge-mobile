/* sync.js — GenNode Doc 11 network sync, opt-in (N2 default: off). Only sealed loops and dead paths (drift archive, collapse events)
 * travel, plus this device's attribution chain. Records are already redacted at ingestion; secrets never leave the vault.
 * Transport = the paired home node (encrypted RPC, HTTPS only). Imports never overwrite local records: they land in "synced_items". */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports; const { sha256 } = isNode ? require('./sha256.js') : root.KSha;
const canon = o => (Array.isArray(o) ? '[' + o.map(canon).join(',') + ']' : o && typeof o === 'object' ? '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}' : JSON.stringify(o));
const SEALED = new Set(['closed', 'collapsed']); const MAX_ITEMS = 500;
const SECRETISH = /\b(?:\d{4}[ -]?){3}\d{4}\b|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_|-----BEGIN|password\s*(?:is|=)\s*\S/i;
/* v4.9.1: the secret-shape scan looks at CONTENT strings only. Machine encodings (signatures, public keys, ids, hashes) are random
 * base64url/hex and occasionally contain a 16-digit run bounded by '-', which made ~3% of honest publications fail as "secret-shaped". */
const MACHINE_KEY = /^(sig|pub|signer|id|x|y|hash|prev|nonce|kid)$|sha256$|_hash$|digest$|_ref$/;
const MACHINE_VAL = /^(?:sig-[0-9a-f]{16}|[a-z]{2,8}:[0-9a-f]{16,64}|[0-9a-f]{64})$/; /* key-derived signer ids, typed hash ids, bare sha256 */
const secretIn = (v, k, d) => { if ((d || 0) > 64) return false; if (typeof v === 'string') return !(k && MACHINE_KEY.test(k)) && !MACHINE_VAL.test(v) && SECRETISH.test(v); if (Array.isArray(v)) return v.some(x => secretIn(x, k, (d || 0) + 1)); if (v && typeof v === 'object') return Object.keys(v).some(kk => (!MACHINE_KEY.test(kk) && SECRETISH.test(kk)) || secretIn(v[kk], kk, (d || 0) + 1)); return false; };
function Sync(store, opts) { const { perm, ledger, rpc } = opts; const now = () => (opts.clock ? opts.clock() : new Date().toISOString());
  function items() { const out = []; const add = (type, r) => { const rec = JSON.parse(JSON.stringify(r)); out.push({ type, id: String(r.id || r.loop || r.at), sha256: sha256(canon(rec)), record: rec }); };
    for (const l of store.load('loops')) if (SEALED.has(l.state)) add('sealed_loop', l); for (const d of store.load('drift_archive')) add('dead_path', d); for (const c of store.load('collapse_events')) add('collapse_event', c);
    return out.slice(-MAX_ITEMS); }
  function bundle() { const it = items(); const body = { v: 1, device: ledger.device(), at: now(), items: it, ledger: ledger.own() }; if (secretIn(body)) return { ok: false, rule: 'SYNC-SECRET-SHAPE-REFUSED' }; body.bundle_sha256 = sha256(canon(body)); return { ok: true, bundle: body }; }
  function verifyBundle(b) { if (!b || b.v !== 1 || !Array.isArray(b.items) || !b.device) return 'SYNC-BAD-SHAPE'; const { bundle_sha256, ...rest } = b; if (sha256(canon(rest)) !== bundle_sha256) return 'SYNC-BUNDLE-HASH'; for (const i of b.items) if (sha256(canon(i.record)) !== i.sha256) return 'SYNC-ITEM-HASH'; if (secretIn(b)) return 'SYNC-SECRET-SHAPE-REFUSED'; return null; }
  function apply(b) { const bad = verifyBundle(b); if (bad) return { ok: false, rule: bad }; if (b.device === ledger.device()) return { ok: true, added: 0, rule: 'SYNC-OWN-BUNDLE' };
    const have = store.load('synced_items'); const keys = new Set(have.map(x => x.device + '|' + x.type + '|' + x.sha256)); let added = 0;
    for (const i of b.items) { const k = b.device + '|' + i.type + '|' + i.sha256; if (keys.has(k)) continue; keys.add(k); have.push({ device: b.device, type: i.type, id: i.id, sha256: i.sha256, record: i.record, received: now(), authority: 'evidence_only' }); added++; }
    store.save('synced_items', have.slice(-5000)); const lm = ledger.merge(b.ledger || []); return { ok: true, added, ledger: lm }; }
  async function run(userTap) { const d = perm.authorize('sync.run', { userTap, subject: 'node' }); if (d.decision !== 'allow') return { ok: false, rule: d.rule };
    const pre = bundle(); if (!pre.ok) return pre; ledger.append('sync_bundle', sha256(canon(pre.bundle.items))); const b = bundle(); if (!b.ok) return b; const put = await rpc('sync.put', { bundle: b.bundle }); if (!put || !put.ok) return { ok: false, rule: 'SYNC-PUT-FAILED', error: put && put.error };
    const got = await rpc('sync.get', { device: ledger.device() }); const res = []; for (const x of (got && got.bundles) || []) res.push(apply(x));
    const log = store.load('sync_log'); const rec = { at: now(), sent_items: b.bundle.items.length, bundle_sha256: b.bundle.bundle_sha256, received: res.length, added: res.reduce((a, r) => a + (r.added || 0), 0), refused: res.filter(r => !r.ok).map(r => r.rule) }; log.push(rec); store.save('sync_log', log.slice(-100)); return Object.assign({ ok: true }, rec); }
  return { items, bundle, verifyBundle, apply, run, log: () => store.load('sync_log'), received: () => store.load('synced_items') }; }
const api = { Sync, SECRETISH, secretIn };
if (isNode) module.exports = api; else root.KSync = api;
})(typeof self !== 'undefined' ? self : this);
