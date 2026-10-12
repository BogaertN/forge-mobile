/* ledger.js — GenNode Doc 12 attribution ledger. Each device owns one hash-chained chain (no distributed consensus).
 * Cross-device merge: a foreign chain is verified link by link; a longer chain that extends ours fast-forwards; a divergent chain
 * is a fork — the existing chain is kept and the fork is recorded as a conflict for the user. Own chain is never overwritten. */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports; const { sha256 } = isNode ? require('./sha256.js') : root.KSha;
const canon = o => (Array.isArray(o) ? '[' + o.map(canon).join(',') + ']' : o && typeof o === 'object' ? '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}' : JSON.stringify(o));
const KINDS = ['memory_write', 'memory_forget', 'loop_sealed', 'drift_archived', 'capture', 'consent', 'sync_bundle', 'export', 'shared_contribution', 'shared_accept', 'tool_publish', 'tool_use', 'knowledge_cite', 'economy_count'];
const entryHash = e => sha256(canon({ device: e.device, seq: e.seq, prev: e.prev, kind: e.kind, payload_sha256: e.payload_sha256, at: e.at }));
function verifyChain(chain) { if (!Array.isArray(chain) || !chain.length) return { ok: true, n: 0 }; const dev = chain[0].device;
  for (let i = 0; i < chain.length; i++) { const e = chain[i]; if (e.device !== dev) return { ok: false, at: i, why: 'LEDGER-MIXED-DEVICE' }; if (e.seq !== i + 1) return { ok: false, at: i, why: 'LEDGER-SEQ-GAP' };
    if (e.prev !== (i ? chain[i - 1].hash : 'genesis')) return { ok: false, at: i, why: 'LEDGER-PREV-MISMATCH' }; if (!KINDS.includes(e.kind)) return { ok: false, at: i, why: 'LEDGER-KIND-UNDECLARED' }; if (entryHash(e) !== e.hash) return { ok: false, at: i, why: 'LEDGER-HASH-MISMATCH' }; }
  return { ok: true, n: chain.length, device: dev, head: chain[chain.length - 1].hash }; }
function Ledger(store, opts) { opts = opts || {}; const now = () => (opts.clock ? opts.clock() : new Date().toISOString());
  function device() { let d = store.load('device'); if (!d || Array.isArray(d) || !d.id) { const r = (opts.random || (n => { const a = new Uint8Array(n); (root.crypto || globalThis.crypto).getRandomValues(a); return a; }))(8); d = { id: 'dev-' + Array.from(r, b => b.toString(16).padStart(2, '0')).join(''), created: now() }; store.save('device', d); } return d.id; }
  const own = () => store.load('attribution_ledger');
  function append(kind, payload) { if (!KINDS.includes(kind)) throw new Error('LEDGER-KIND-UNDECLARED'); const c = own(); const e = { device: device(), seq: c.length + 1, prev: c.length ? c[c.length - 1].hash : 'genesis', kind, payload_sha256: typeof payload === 'string' && /^[0-9a-f]{64}$/.test(payload) ? payload : sha256(canon(payload)), at: now() }; e.hash = entryHash(e); c.push(e); store.save('attribution_ledger', c); return e; }
  const foreign = () => { const f = store.load('attribution_foreign'); return f && !Array.isArray(f) ? f : {}; };
  function merge(chain) { const v = verifyChain(chain); if (!v.ok) return { ok: false, rule: v.why, at: v.at }; if (!v.n) return { ok: true, added: 0 }; if (v.device === device()) return { ok: false, rule: 'LEDGER-OWN-CHAIN-NOT-IMPORTED' };
    const f = foreign(); const cur = f[v.device] || []; const common = Math.min(cur.length, chain.length); let fork = -1; for (let i = 0; i < common; i++) if (cur[i].hash !== chain[i].hash) { fork = i; break; }
    if (fork >= 0) { const cs = store.load('ledger_conflicts'); cs.push({ device: v.device, seq: fork + 1, ours: cur[fork].hash, theirs: chain[fork].hash, at: now() }); store.save('ledger_conflicts', cs); return { ok: true, added: 0, fork: fork + 1, rule: 'LEDGER-FORK-KEPT-EXISTING' }; }
    if (chain.length <= cur.length) return { ok: true, added: 0, rule: 'LEDGER-ALREADY-HAVE' }; f[v.device] = chain.map(e => Object.assign({}, e)); store.save('attribution_foreign', f); return { ok: true, added: chain.length - cur.length, rule: 'LEDGER-FAST-FORWARD' }; }
  function view() { const f = foreign(); const all = own().concat(...Object.values(f)); return all.slice().sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.device < b.device ? -1 : a.device > b.device ? 1 : a.seq - b.seq)); }
  return { device, append, own, foreign, merge, view, verify: () => verifyChain(own()), conflicts: () => store.load('ledger_conflicts') }; }
const api = { Ledger, verifyChain, entryHash, KINDS };
if (isNode) module.exports = api; else root.KLedger = api;
})(typeof self !== 'undefined' ? self : this);
