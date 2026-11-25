/* stubs.js — completes the remaining FORGE_STUBS.md preview groups to their documented function, phone-sized:
 *  MEA seal packets + replay + controlled atomic commit (forge rmc_engine_v1/mea/*, Patch 276–299);
 *  Memory Capsules candidate → validated → finalized (contribution_economy_v1/capsules; economic flags stay NOT_AUTHORIZED);
 *  deterministic Operator Council recommendations (aiweb_language_core_bootstrap/operator_council; recommendation only, never authority);
 *  language promotion user_admitted → corpus_supported (rmc_language_promotion; tap + evidence count). */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports; const { sha256 } = isNode ? require('./sha256.js') : root.KSha; const LC = isNode ? require('./lifecycle.js') : root.KLife;
const canon = o => (Array.isArray(o) ? '[' + o.map(canon).join(',') + ']' : o && typeof o === 'object' ? '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}' : JSON.stringify(o));
const PROMOTE_MIN_USES = 3;
function Stubs(store, opts) { opts = opts || {}; const now = () => (opts.clock ? opts.clock() : new Date().toISOString()); const perm = opts.perm;
  const traceBy = psi => store.load('trace').find(t => t.psi_id === psi);
  /* ---- MEA seal packet ---- */
  function packet(t) { const tiers = LC.evidenceTiers(t); const score = tiers.length ? Math.min(...tiers.map(x => x.weight === undefined ? x.tier_weight || 0 : x.weight)) : 0;
    return { schema: 'mea-seal/v1', psi_id: t.psi_id, turn: t.turn, meaning_sha256: sha256(canon(t.msm && t.msm.meaning || null)), rules_sha256: sha256(canon((t.rules || []).map(r => r.id))), echo: !!(t.echo && t.echo.pass), tiers: tiers.map(x => x.tier || x.name || null), mea_min_weight: +(+score || 0).toFixed(4) }; }
  function seal(psi) { const t = traceBy(psi); if (!t) return { ok: false, rule: 'MEA-NO-TRACE' }; const p = packet(t); return { ok: true, packet: p, seal_sha256: sha256(canon(p)) }; }
  function replay(s) { const t = traceBy(s.packet && s.packet.psi_id); if (!t) return { ok: false, rule: 'MEA-REPLAY-NO-TRACE' }; const h = sha256(canon(packet(t))); return { ok: h === s.seal_sha256, recomputed: h }; }
  function commit(s, userTap) { const d = perm.authorize('memory.seal', { userTap, subject: s && s.seal_sha256 }); if (d.decision !== 'allow') return { ok: false, rule: d.rule }; const r = replay(s); if (!r.ok) return { ok: false, rule: 'MEA-REPLAY-MISMATCH' }; if (!s.packet.echo) return { ok: false, rule: 'MEA-ECHO-NOT-PASSED' };
    const all = store.load('mea_seals'); if (all.some(x => x.seal_sha256 === s.seal_sha256)) return { ok: true, duplicate: true }; const rec = Object.assign({ id: 'seal:' + (all.length + 1), at: now() }, s); const next = all.concat([rec]); store.save('mea_seals', next);
    const back = store.load('mea_seals').find(x => x.id === rec.id); if (!back || canon(back) !== canon(rec)) { store.save('mea_seals', all); return { ok: false, rule: 'MEA-COMMIT-READBACK-ROLLBACK' }; } return { ok: true, seal: rec }; }
  /* ---- Memory Capsules ---- */
  const ECON = { attribution: 'NOT_AUTHORIZED', storage: 'NOT_AUTHORIZED', public_display: 'NOT_AUTHORIZED', portability: 'NOT_AUTHORIZED', economic_processing: 'NOT_AUTHORIZED' };
  function capsuleCandidate(sealId) { const s = store.load('mea_seals').find(x => x.id === sealId); if (!s) return { ok: false, rule: 'CAPSULE-NEEDS-COMMITTED-SEAL' }; const cs = store.load('capsules'); const c = { id: 'capsule:' + (cs.length + 1), seal: sealId, seal_sha256: s.seal_sha256, state: 'candidate', consent: Object.assign({}, ECON), created: now(), history: [{ state: 'candidate', at: now() }] }; store.save('capsules', cs.concat([c])); return { ok: true, capsule: c }; }
  function capsuleStep(id, to, userTap) { const cs = store.load('capsules'); const c = cs.find(x => x.id === id); if (!c) return { ok: false, rule: 'CAPSULE-UNKNOWN' }; const order = { candidate: 'validated', validated: 'finalized' }; if (order[c.state] !== to) return { ok: false, rule: 'CAPSULE-TRANSITION-NOT-LAWFUL' };
    if (to === 'validated') { const s = store.load('mea_seals').find(x => x.id === c.seal); if (!s || !replay(s).ok) return { ok: false, rule: 'CAPSULE-SEAL-REPLAY-FAILED' }; }
    if (to === 'finalized' && userTap !== true) return { ok: false, rule: 'CAPSULE-FINALIZE-NEEDS-TAP' }; c.state = to; c.history.push({ state: to, at: now() }); store.save('capsules', cs); return { ok: true, capsule: c, economic: 'all economic scopes remain NOT_AUTHORIZED (no sale, no transfer, no token)' }; }
  /* ---- Operator Council ---- */
  const ROLES = [['verifier', t => !!(t.echo && t.echo.pass), 'COUNCIL-ECHO'], ['custodian', t => !t.containment || t.containment.may_write_memory !== false, 'COUNCIL-CONTAINMENT'], ['drift_warden', t => !t.drift || /clean|low/.test(t.drift.band || 'clean'), 'COUNCIL-DRIFT'], ['gatekeeper', t => Object.values(t.gates || {}).every(v => v === 'pass'), 'COUNCIL-GATES']];
  function council(psi) { const t = traceBy(psi); if (!t) return { ok: false, rule: 'COUNCIL-NO-TRACE' }; const votes = ROLES.map(([role, f, rule]) => ({ role, vote: f(t) ? 'approve' : 'hold', rule })); const rec = { psi_id: psi, at: now(), votes, recommendation: votes.every(v => v.vote === 'approve') ? 'approve' : 'hold', authority: 'recommendation_only' };
    const l = store.load('council'); l.push(rec); store.save('council', l.slice(-500)); return { ok: true, record: rec }; }
  /* ---- language promotion ---- */
  function promotionCheck(word) { const w = String(word || '').toLowerCase(); const q = store.load('admission_queue').find(x => String(x.surface || x.word || '').toLowerCase() === w && x.state === 'approved'); const wq = '"' + w.replace(/[^a-z0-9-]/g, '') + '"'; const uses = store.load('memory').filter(f => !f.forgotten && JSON.stringify(f.clause || {}).toLowerCase().includes(wq)).length;
    return { word: w, admitted: !!q, uses, min_uses: PROMOTE_MIN_USES, eligible: !!q && uses >= PROMOTE_MIN_USES }; }
  function promote(word, userTap) { const c = promotionCheck(word); if (!c.admitted) return { ok: false, rule: 'PROMOTE-NOT-ADMITTED' }; if (!c.eligible) return { ok: false, rule: 'PROMOTE-INSUFFICIENT-EVIDENCE', check: c }; if (userTap !== true) return { ok: false, rule: 'PROMOTE-NEEDS-TAP' };
    const l = store.load('promotions'); const rec = { word: c.word, from: 'user_admitted', to: 'corpus_supported', uses: c.uses, at: now() }; l.push(rec); store.save('promotions', l); return { ok: true, promotion: rec }; }
  return { seal, replay, commit, seals: () => store.load('mea_seals'), capsuleCandidate, capsuleStep, capsules: () => store.load('capsules'), council, councilLog: () => store.load('council'), promotionCheck, promote, PROMOTE_MIN_USES }; }
const api = { Stubs };
if (isNode) module.exports = api; else root.KStubs = api;
})(typeof self !== 'undefined' ? self : this);
