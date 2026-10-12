/* economy.js — creator credit and the Memory Economy, COUNT-ONLY (M5 default; user 2026-10-11: "no money/payments live; leave hooks").
 * Sources: "Memory Economy — Breathing Life" (Drive, May 30 2026): contribution types CRT (creative) / CPT (compute) / BLD (builder);
 * difficulty Light / Standard / Heavy / Monument; base-CT chart (§4.1, Step 3); influence multipliers Direct 1.0, Indirect 0.5,
 * Collaborative ⅓ (§1.1–1.3, §4.3); contributors and proof hashes recorded in the capsule (§5.1); fraudulent or rejected capsules earn
 * nothing (§8). forge Patch 300 contribution_economy_v1: consent scope (attribution, storage, public_display, portability,
 * economic_processing), with economic_processing NOT_AUTHORIZED. GenNode Doc 12: every count is an attribution-ledger entry.
 * CT here is a COUNT of recognised contribution: not money, not transferable, not redeemable. payout_hook is always null. */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports; const { sha256 } = isNode ? require('./sha256.js') : root.KSha;
const BASE_CT = { CRT: { Light: 1, Standard: 5, Heavy: 20, Monument: 60 }, CPT: { Light: 0.5, Standard: 2, Heavy: 8, Monument: 40 }, BLD: { Light: 2, Standard: 10, Heavy: 30, Monument: 80 } };
const BREATH = { direct: 1, indirect: 0.5, collaborative: 1 / 3 };
const CONSENT_SCOPE = { attribution: 'granted_per_item', storage: 'granted_per_item', public_display: 'granted_per_item', portability: 'granted_per_item', economic_processing: 'NOT_AUTHORIZED' };
const r3 = x => Math.round(x * 1000) / 1000;
function Economy(store, deps) { const { ledger } = deps; const now = () => (deps.clock ? deps.clock() : new Date().toISOString());
  /* a contribution record ("capsule"): direct creator + lineage ancestors (indirect) */
  function count(item, o) { o = o || {}; const type = o.type || (item.kind === 'tool_package' ? 'BLD' : 'CRT'); const cls = o.difficulty || 'Light'; if (!BASE_CT[type] || BASE_CT[type][cls] == null) return { ok: false, rule: 'ECON-CLASS' };
    const caps = store.load('economy_capsules'); if (caps.some(c => c.item === item.id)) return { ok: true, dup: true };
    const contributors = [{ signer: item.source && item.source.signer, role: 'direct', breath_weight: BREATH.direct }].concat((item.lineage || []).map(l => ({ signer: l.creator, role: 'indirect', breath_weight: BREATH.indirect, via: l.parent })));
    const base = BASE_CT[type][cls]; const cap = { item: item.id, kind: item.kind, type, difficulty: cls, difficulty_source: o.difficulty ? 'reviewer' : 'default Light (doc: set by validation — decision open)', base_ct: base,
      contributors: contributors.map(c => Object.assign({}, c, { ct: r3(base * c.breath_weight) })), status: 'counted', counted_at: now(), consent_scope: CONSENT_SCOPE, economic_processing: 'NOT_AUTHORIZED', payout_hook: null };
    cap.proof_hash = sha256(JSON.stringify(cap)); caps.push(cap); store.save('economy_capsules', caps.slice(-5000)); ledger.append('economy_count', cap.proof_hash); return { ok: true, capsule: cap }; }
  function void_(itemId, reason) { const caps = store.load('economy_capsules'); const c = caps.find(x => x.item === itemId); if (!c) return { ok: false, rule: 'ECON-NONE' }; c.status = 'voided'; c.void_reason = reason || 'rejected or fraudulent (doc §8: earns nothing)'; c.contributors.forEach(x => { x.ct = 0; }); store.save('economy_capsules', caps); return { ok: true }; }
  /* usage / citation counts per item, attributed to the creator (counts only) */
  function use(itemId, creator, kind) { const k = kind === 'cite' ? 'knowledge_cite' : 'tool_use'; const u = store.load('usage_counts'); let e = u.find(x => x.item === itemId); if (!e) { e = { item: itemId, creator, uses: 0, citations: 0 }; u.push(e); }
    if (k === 'tool_use') e.uses++; else e.citations++; e.last = now(); store.save('usage_counts', u.slice(-5000)); ledger.append(k, sha256(itemId + '|' + creator)); return e; }
  function credits() { const by = {}; for (const c of store.load('economy_capsules')) for (const x of c.contributors) { if (!x.signer) continue; const b = by[x.signer] || (by[x.signer] = { signer: x.signer, ct_count: 0, direct: 0, indirect: 0, uses: 0, citations: 0 }); b.ct_count = r3(b.ct_count + x.ct); b[x.role === 'direct' ? 'direct' : 'indirect']++; }
    for (const u of store.load('usage_counts')) { const b = by[u.creator] || (by[u.creator] = { signer: u.creator, ct_count: 0, direct: 0, indirect: 0, uses: 0, citations: 0 }); b.uses += u.uses; b.citations += u.citations; }
    return { creators: Object.values(by).sort((a, b) => b.ct_count - a.ct_count), unit: 'CT count (recognition only; not money; economic_processing NOT_AUTHORIZED)', payout_hook: null }; }
  return { count, void: void_, use, credits, capsules: () => store.load('economy_capsules'), usage: () => store.load('usage_counts') }; }
const api = { Economy, BASE_CT, BREATH, CONSENT_SCOPE };
if (isNode) module.exports = api; else root.KEconomy = api;
})(typeof self !== 'undefined' ? self : this);
