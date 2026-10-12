/* economy.js — creator credit and the Memory Economy, COUNT-ONLY (M5 default; user 2026-10-11: "no money/payments live; leave hooks").
 * Sources: "Memory Economy — Breathing Life" (Drive, May 30 2026): contribution types CRT (creative) / CPT (compute) / BLD (builder);
 * difficulty Light / Standard / Heavy / Monument; base-CT chart (§4.1, Step 3); influence multipliers Direct 1.0, Indirect 0.5,
 * Collaborative ⅓ (§1.1–1.3, §4.3); contributors and proof hashes recorded in the capsule (§5.1); fraudulent or rejected capsules earn
 * nothing (§8). forge Patch 300 contribution_economy_v1: consent scope (attribution, storage, public_display, portability,
 * economic_processing), with economic_processing NOT_AUTHORIZED. GenNode Doc 12: every count is an attribution-ledger entry.
 * CT here is a COUNT of recognised contribution: not money, not transferable, not redeemable. payout_hook is always null. */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports; const { sha256 } = isNode ? require('./sha256.js') : root.KSha; const LG = isNode ? require('./ledger.js') : root.KLedger;
const BASE_CT = { CRT: { Light: 1, Standard: 5, Heavy: 20, Monument: 60 }, CPT: { Light: 0.5, Standard: 2, Heavy: 8, Monument: 40 }, BLD: { Light: 2, Standard: 10, Heavy: 30, Monument: 80 } };
const BREATH = { direct: 1, indirect: 0.5, collaborative: 1 / 3 };
const CONSENT_SCOPE = { attribution: 'granted_per_item', storage: 'granted_per_item', public_display: 'granted_per_item', portability: 'granted_per_item', economic_processing: 'NOT_AUTHORIZED' };
const r3 = x => Math.round(x * 1000) / 1000;
function Economy(store, deps) { const { ledger } = deps; const now = () => (deps.clock ? deps.clock() : new Date().toISOString());
  /* a contribution record ("capsule"): direct creator + lineage ancestors (indirect) */
  function count(item, o) { o = o || {}; const type = o.type || (item.kind === 'tool_package' ? 'BLD' : 'CRT'); const cls = o.difficulty || 'Light'; if (!BASE_CT[type] || BASE_CT[type][cls] == null) return { ok: false, rule: 'ECON-CLASS' };
    const caps = store.load('economy_capsules'); if (caps.some(c => c.item === item.id)) return { ok: true, dup: true };
    const contributors = [{ signer: item.source && item.source.signer, role: 'direct', breath_weight: BREATH.direct }]
      .concat((item.cosigners || []).map(c => ({ signer: c.signer, role: 'collaborative', breath_weight: BREATH.collaborative })))
      .concat((item.lineage || []).map(l => ({ signer: l.creator, role: 'indirect', breath_weight: BREATH.indirect, via: l.parent })));
    const base = BASE_CT[type][cls]; const cap = { item: item.id, kind: item.kind, type, difficulty: cls, difficulty_source: o.difficulty ? 'reviewer' : 'default Light (doc: set by validation — decision open)', base_ct: base,
      contributors: contributors.map(c => Object.assign({}, c, { ct: r3(base * c.breath_weight) })), status: 'counted', counted_at: now(), consent_scope: CONSENT_SCOPE, economic_processing: 'NOT_AUTHORIZED', payout_hook: null };
    cap.proof_hash = sha256(JSON.stringify(cap)); caps.push(cap); store.save('economy_capsules', caps.slice(-5000)); ledger.append('economy_count', cap.proof_hash); return { ok: true, capsule: cap }; }
  function void_(itemId, reason) { const caps = store.load('economy_capsules'); const c = caps.find(x => x.item === itemId); if (!c) return { ok: false, rule: 'ECON-NONE' }; c.status = 'voided'; c.void_reason = reason || 'rejected or fraudulent (doc §8: earns nothing)'; c.contributors.forEach(x => { x.ct = 0; }); store.save('economy_capsules', caps); return { ok: true }; }
  /* usage / citation counts per item, attributed to the creator (counts only) */
  function use(itemId, creator, kind) { const k = kind === 'cite' ? 'knowledge_cite' : 'tool_use'; const u = store.load('usage_counts'); let e = u.find(x => x.item === itemId); if (!e) { e = { item: itemId, creator, uses: 0, citations: 0 }; u.push(e); }
    if (k === 'tool_use') e.uses++; else e.citations++; e.last = now(); store.save('usage_counts', u.slice(-5000)); ledger.append(k, sha256(itemId + '|' + creator)); return e; }
  /* E5 signed cross-device merge: a device publishes its capsules + own ledger chain, signed; receivers verify every link, recompute every
   * proof hash and require it to be an economy_count entry in that chain. Totals are de-duplicated per (item, contributor). */
  function snapshotBody() { return { schema: 'emn-credit-ledger/v1', kind: 'credit_ledger', device: ledger.device(), chain: ledger.own().slice(-2000), capsules: store.load('economy_capsules').slice(-1000), usage: store.load('usage_counts').slice(-1000), created: now(), authority: 'evidence_only', source: { kind: 'economy' } }; }
  function mergeForeign(m) { const v = LG.verifyChain(m.chain || []); if (!v.ok) return { ok: false, rule: v.why }; if (m.device === ledger.device()) return { ok: false, rule: 'ECON-OWN-DEVICE' }; if (v.n && v.device !== m.device) return { ok: false, rule: 'ECON-DEVICE-MISMATCH' };
    const counted = new Set(m.chain.filter(e => e.kind === 'economy_count').map(e => e.payload_sha256));
    for (const c of m.capsules || []) { const base = Object.assign({}, c); delete base.proof_hash; if (c.status === 'counted' && (sha256(JSON.stringify(base)) !== c.proof_hash || !counted.has(c.proof_hash))) return { ok: false, rule: 'ECON-PROOF-HASH' }; if (c.payout_hook !== null || c.economic_processing !== 'NOT_AUTHORIZED') return { ok: false, rule: 'ECON-VALUE-NOT-AUTHORIZED' }; }
    const f = store.load('economy_foreign'); const map = f && !Array.isArray(f) ? f : {}; const cur = map[m.device]; if (cur && cur.chain_len > v.n) return { ok: true, rule: 'ECON-OLDER-SNAPSHOT' };
    if (cur && cur.head && v.n >= cur.chain_len && m.chain[cur.chain_len - 1] && m.chain[cur.chain_len - 1].hash !== cur.head) return { ok: false, rule: 'ECON-FORK' };
    map[m.device] = { signer: m.source.signer, chain_len: v.n, head: v.head || null, capsules: m.capsules || [], usage: m.usage || [], at: now() }; store.save('economy_foreign', map); return { ok: true, device: m.device, capsules: (m.capsules || []).length }; }
  function credits(o) { o = o || {}; const by = {}; const seen = new Set(); const fmap = store.load('economy_foreign'); const foreign = o.merged && fmap && !Array.isArray(fmap) ? Object.values(fmap) : [];
    const capsAll = store.load('economy_capsules').concat(...foreign.map(x => x.capsules)); const useAll = store.load('usage_counts').concat(...foreign.map(x => x.usage));
    for (const c of capsAll) for (const x of c.contributors) { if (!x.signer) continue; const key = c.item + '|' + x.signer; if (seen.has(key)) continue; seen.add(key); const b = by[x.signer] || (by[x.signer] = { signer: x.signer, ct_count: 0, direct: 0, indirect: 0, collaborative: 0, uses: 0, citations: 0 }); b.ct_count = r3(b.ct_count + x.ct); b[x.role]++; }
    for (const u of useAll) { const b = by[u.creator] || (by[u.creator] = { signer: u.creator, ct_count: 0, direct: 0, indirect: 0, collaborative: 0, uses: 0, citations: 0 }); b.uses += u.uses; b.citations += u.citations; }
    return { creators: Object.values(by).sort((a, b) => b.ct_count - a.ct_count), scope: o.merged ? 'this device + ' + foreign.length + ' verified device ledger(s)' : 'this device', unit: 'CT count (recognition only; not money; economic_processing NOT_AUTHORIZED)', payout_hook: null }; }
  return { count, void: void_, use, credits, snapshotBody, mergeForeign, capsules: () => store.load('economy_capsules'), usage: () => store.load('usage_counts') }; }
const api = { Economy, BASE_CT, BREATH, CONSENT_SCOPE };
if (isNode) module.exports = api; else root.KEconomy = api;
})(typeof self !== 'undefined' ? self : this);
