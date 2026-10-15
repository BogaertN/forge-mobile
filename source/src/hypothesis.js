/* hypothesis.js: one Hypothesis/v1 object and governed store (GELC S0). Never truth; fact queries never read it; writes need a route or approval receipt. */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports;
const { sha256 } = isNode ? require('./sha256.js') : root.KSha; const KM = isNode ? require('./kmath.js') : root.KMath;
const SCHEMA = 'Hypothesis/v1';
const STORE = 'hypotheses';
const KINDS = ['relation', 'rule', 'explanation', 'counterfactual', 'speculation', 'unresolved'];
const STATUSES = ['staged', 'quarantined', 'held', 'archived', 'withdrawn'];
const ROUTES = { dream: 'dream_state_quarantine_candidate', ghost: 'ghost_loop_containment_required', ede: 'ede_candidate' };
const AUTHORITY = ['containment_route', 'approval_receipt'];
const canon = x => { if (x === undefined) return 'null'; if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']'; if (x && typeof x === 'object') return '{' + Object.keys(x).sort().filter(k => x[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(x[k])).join(',') + '}'; return JSON.stringify(x); };
const arr = v => (Array.isArray(v) ? v.slice() : []);

function make(f) {
  f = f || {}; if (!KINDS.includes(f.kind)) throw new Error('HYP_KIND'); if (!f.route) throw new Error('HYP_ROUTE');
  const body = { schema: SCHEMA, kind: f.kind, route: f.route, body: f.body === undefined ? null : f.body, modality: 'hypothetical', truth_support_allowed: false,
    provenance: Object.assign({ source: null, turn: null, msm_id: null, loop: null }, f.provenance || {}), parents: arr(f.parents), support: arr(f.support), counterevidence: arr(f.counterevidence), falsifiers: arr(f.falsifiers),
    status: STATUSES.includes(f.status) ? f.status : 'staged', detail: f.detail || {} };
  const id = f.id || 'hyp:' + sha256(canon({ kind: body.kind, route: body.route, body: body.body, provenance: body.provenance, parents: body.parents })).slice(0, 20);
  return Object.assign({ id }, body);
}
function valid(h) { return !!h && h.schema === SCHEMA && typeof h.id === 'string' && KINDS.includes(h.kind) && STATUSES.includes(h.status) && h.modality === 'hypothetical' && h.truth_support_allowed === false && Array.isArray(h.parents) && Array.isArray(h.support) && Array.isArray(h.counterevidence) && Array.isArray(h.falsifiers); }
/* drift governance (Nic ruling): the CURRENT ε_s is the last correction's re-measurement, else the measured one; unmeasured never projects */
const epsOf = h => { const c = (h && h.corrections) || []; return c.length ? c[c.length - 1].eps_s : h && h.detail && typeof h.detail.eps_s === 'number' ? h.detail.eps_s : null; };
const governance = h => KM.driftGovernance(epsOf(h));
const flat = h => Object.assign({}, h.detail, { id: h.id, hyp_id: h.id, kind: h.kind, route: h.route, status: h.detail && h.detail.status_label ? h.detail.status_label : h.status, hyp_status: h.status, truth_support_allowed: false, modality: 'hypothetical' });

function Store(store, opts) {
  opts = opts || {}; const now = () => (opts.clock ? opts.clock() : new Date().toISOString());
  const all = () => { const l = store.load(STORE); return Array.isArray(l) ? l : []; };
  function put(h, authority) {
    if (!valid(h)) return { ok: false, rule: 'HYP-INVALID' };
    const a = authority || {}; if (!AUTHORITY.includes(a.kind)) return { ok: false, rule: 'HYP-NO-AUTHORITY' };
    if (a.kind === 'containment_route' && a.route !== h.route) return { ok: false, rule: 'HYP-ROUTE-MISMATCH' };
    if (a.kind === 'approval_receipt' && !(a.approved === true && a.decision === 'allow')) return { ok: false, rule: 'HYP-NOT-APPROVED' };
    const g = governance(h); if (g.band === 'reject') return { ok: false, rule: 'HYP-DRIFT-ABOVE-EXPLORE', governance: g };
    if (a.kind === 'approval_receipt' && typeof epsOf(h) === 'number' && !g.may_project) return { ok: false, rule: 'HYP-DRIFT-NOT-PROJECTABLE', governance: g };
    const l = all(); if (l.some(x => x.id === h.id)) return { ok: true, id: h.id, duplicate: true };
    const rec = Object.assign({}, h, { drift_governance: g, status: h.status === 'staged' ? (a.kind === 'approval_receipt' ? 'held' : 'quarantined') : h.status, stored_at: now(), authority: { kind: a.kind, rule: a.rule || null, receipt: a.receipt || null } });
    l.push(rec); store.save(STORE, l); return { ok: true, id: rec.id, record: rec };
  }
  function setStatus(id, status, why) { if (!STATUSES.includes(status) || status === 'staged') return { ok: false, rule: 'HYP-STATUS' }; const l = all(); const r = l.find(x => x.id === id); if (!r) return { ok: false, rule: 'HYP-UNKNOWN' };
    (r.history = r.history || []).push({ from: r.status, to: status, at: now(), why: why || null }); r.status = status; store.save(STORE, l); return { ok: true, record: r }; }
  /* a correction re-measures ε_s (never deletes the old value); the hypothesis stays quarantined until the CURRENT ε_s ≤ 0.35 */
  function correct(id, eps, why) { const l = all(); const r = l.find(x => x.id === id); if (!r) return { ok: false, rule: 'HYP-UNKNOWN' }; const g = KM.driftGovernance(eps); if (g.band === 'unmeasured') return { ok: false, rule: 'HYP-DRIFT-UNMEASURED' };
    (r.corrections = r.corrections || []).push({ eps_s: g.eps_s, at: now(), why: why || null }); r.drift_governance = g; store.save(STORE, l); return { ok: true, record: r, governance: g }; }
  function view(name) { const route = ROUTES[name] || name; return all().filter(h => h.route === route).map(flat); }
  return { put, setStatus, correct, view, list: all, get: id => all().find(x => x.id === id) || null };
}

function migrateLegacy(store) {
  const legacy = [['dream_quarantine', 'speculation', ROUTES.dream], ['ghost_loops', 'unresolved', ROUTES.ghost], ['ede_candidates', 'relation', ROUTES.ede]]; let n = 0;
  const l = Array.isArray(store.load(STORE)) ? store.load(STORE) : [];
  for (const [cat, kind, route] of legacy) { const rows = store.load(cat); if (!Array.isArray(rows) || !rows.length) continue;
    for (const r of rows) { const h = make({ kind, route, body: r.clause || r.claim || r.input || null, provenance: { source: 'legacy:' + cat, turn: r.turn || null, msm_id: r.msm_id || null, loop: r.loop || null }, status: route === ROUTES.ede ? 'held' : 'quarantined', detail: Object.assign({}, r, { status_label: r.status || null, legacy_id: r.id || null }) });
      if (!l.some(x => x.id === h.id)) { l.push(Object.assign(h, { stored_at: r.at || null, authority: { kind: 'containment_route', rule: 'MIG-4-LEGACY-HYPOTHESES', receipt: null } })); n++; } }
    store.save(cat, []); }
  if (n) store.save(STORE, l); return n;
}

const api = { epsOf, governance, SCHEMA, STORE, KINDS, STATUSES, ROUTES, make, valid, flat, Store, migrateLegacy, canon };
if (isNode) module.exports = api; else root.KHyp = api;
})(typeof self !== 'undefined' ? self : this);
