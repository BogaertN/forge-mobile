/* Home-node client (HOME_NODE_PROTOCOL v1). Pairing URI → secret sealed in the Identity Vault; AES-256-GCM envelopes with
 * HKDF-SHA256 keys, strictly increasing counters, ±300 s clock window. Offline job queue: when the node is unreachable a job is
 * kept in "node_jobs" as queued and flushed on the next successful contact. No model, no shell, declared ops only. */
(function (root) {
'use strict';
const GL = typeof globalThis !== 'undefined' ? globalThis : root;
const OPS = ['ping', 'fetch', 'job.submit', 'job.status', 'job.list'];
const te = new TextEncoder(), td = new TextDecoder();
const b64 = u => { let s = ''; for (const b of new Uint8Array(u)) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
function parsePairing(uri) { const m = String(uri || '').trim().match(/^forge-node:v1\?(.+)$/); if (!m) return null; const p = new URLSearchParams(m[1]); const u = p.get('u'), id = p.get('id'), k = p.get('k');
  if (!u || !/^[0-9a-f]{16}$/.test(id || '') || !k) return null; let url; try { url = new URL(u); } catch (e) { return null; } if (!/^https?:$/.test(url.protocol)) return null; try { if (unb64(k).length !== 32) return null; } catch (e) { return null; }
  return { url: url.origin, id, k }; }
async function keyFrom(kB64, id, subtle) { const base = await subtle.importKey('raw', unb64(kB64), 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: te.encode(id), info: te.encode('forge-node v1 enc') }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }
function Client(store, opts) { opts = opts || {}; const subtle = opts.subtle || (GL.crypto && GL.crypto.subtle); const doFetch = opts.fetch || ((...a) => GL.fetch(...a)); const now = () => (opts.clock ? opts.clock() : new Date().toISOString());
  const nowSec = () => (opts.nowSec ? opts.nowSec() : Date.now() / 1000);
  const pairing = () => { const p = store.load('node_pairing'); return p && !Array.isArray(p) && p.id ? p : null; };
  async function pair(uri, sealSecret) { const p = parsePairing(uri); if (!p) return { ok: false, rule: 'NODE-PAIRING-URI-INVALID' }; const ref = await sealSecret(p.k, p.id); if (!ref) return { ok: false, rule: 'NODE-PAIRING-VAULT-LOCKED' };
    store.save('node_pairing', { id: p.id, url: p.url, key_ref: ref, ctr: 0, paired_at: now() }); return { ok: true, id: p.id, url: p.url }; }
  function unpair() { store.save('node_pairing', {}); return { ok: true }; }
  async function rpc(op, args, revealSecret) { if (!OPS.includes(op)) throw new Error('NODE-OP-NOT-DECLARED'); const p = pairing(); if (!p) throw new Error('NODE-NOT-PAIRED'); const k = await revealSecret(p.key_ref); if (!k) throw new Error('NODE-VAULT-LOCKED');
    const key = await keyFrom(k, p.id, subtle); const ctr = Math.max(p.ctr + 1, Math.floor(nowSec() * 1000)); p.ctr = ctr; store.save('node_pairing', p);
    const iv = (opts.random || (n => GL.crypto.getRandomValues(new Uint8Array(n))))(12); const pt = te.encode(JSON.stringify({ op, args: args || {}, ts: Math.floor(nowSec()) }));
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: te.encode('forge-node-v1|' + p.id + '|' + ctr) }, key, pt);
    const res = await doFetch(p.url + '/v1/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ v: 1, id: p.id, ctr, iv: b64(iv), ct: b64(ct) }), credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
    if (!res.ok) throw new Error('NODE-HTTP-' + res.status); const env = JSON.parse(await res.text()); if (env.ctr !== ctr) throw new Error('NODE-RESPONSE-COUNTER');
    const out = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv), additionalData: te.encode('forge-node-v1-resp|' + p.id + '|' + ctr) }, key, unb64(env.ct)); return JSON.parse(td.decode(out)); }
  /* offline-tolerant queue */
  function enqueue(kind, args) { const q = store.load('node_jobs'); const j = { id: 'nj:' + (q.length + 1), kind, args, state: 'queued', queued_at: now() }; q.push(j); store.save('node_jobs', q.slice(-200)); return j; }
  async function flush(revealSecret) { const q = store.load('node_jobs'); let sent = 0, failed = 0; for (const j of q.filter(x => x.state === 'queued')) { try { const r = await rpc('job.submit', Object.assign({ kind: j.kind }, j.args), revealSecret); if (r && r.ok) { j.state = 'submitted'; j.remote = r.job; sent++; } else { j.state = 'rejected'; j.error = r && r.error; } } catch (e) { failed++; j.last_error = String(e.message).slice(0, 60); break; } }
    store.save('node_jobs', q); return { sent, failed, queued: q.filter(x => x.state === 'queued').length }; }
  async function poll(revealSecret) { const q = store.load('node_jobs'); for (const j of q.filter(x => x.state === 'submitted')) { try { const r = await rpc('job.status', { job: j.remote }, revealSecret); if (r && r.job && /done|failed/.test(r.job.state)) { j.state = r.job.state; j.result_sha256 = r.job.result && r.job.result.sha256 || null; j.result = r.job.result; } } catch (e) { break; } } store.save('node_jobs', q); return q; }
  return { pairing, pair, unpair, rpc, enqueue, flush, poll, jobs: () => store.load('node_jobs') }; }
const api = { Client, parsePairing, OPS, keyFrom, b64, unb64 };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KNode = api;
})(typeof self !== 'undefined' ? self : this);
