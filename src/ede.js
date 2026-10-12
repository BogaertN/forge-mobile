/* ede.js — Evolutionary Drift Explorer (RMC §5.6) running Algorithm 3, Drift-Bounded Novelty Search (RMC §8.3).
 * Sources: RMC §4.5 Axiom 5 (0 < N ≤ N_max, D ≤ θ_drift); §6.4 Novelty Functional N(c) = dist(c, M_relevant), N_min ≤ N(c) ≤ N_max, ε_s(c) ≤ θ;
 * §6.3 Drift Functional ε_s = (σ_res + D_score + |ΔΦ|)/n; §7.3 Theorem 3; §7.7 Theorem 7; §8.3 steps:
 *   1 anchor to stable memory · 2 create adjacent concept branches · 3 measure novelty · 4 measure drift · 5 retain only bounded candidates ·
 *   6 archive unstable but promising candidates (projection blocked); branch ancestry preserved; status "bounded_candidate_pending_score", never fact.
 * Example thresholds are the paper's own worked values: N_min 0.15, N_max 0.75, θ 0.35 (§8.3 novelty/drift reports).
 * Branch operators are the §5.6 strategies that need no model: "search nearby memory graph nodes / combine two phase-compatible concepts"
 * (adjacent_synthesis), "generate analogies" (analogy), "identify unresolved contradictions" (contradiction_probe).
 * MEASURES (v4.7, re-sourced 2026-10-11 from the documents, replacing the v4.6 implementation choices):
 *  N(c) = d_struct = 1 − |keys_c ∩ keys_m| / |keys_c ∪ keys_m| against the nearest relevant memory (RMC Resonance-Lexicon Gold Reference
 *    "structure_delta … Jaccard-style comparison"; RMC §6.4 simple form N = dist(c, M_relevant)). The §6.4 expanded form
 *    w_sem·d_sem + w_phase·d_phase + w_op·d_op + w_struct·d_struct gives no weights → not used (open).
 *  σ_res = standard deviation of cos(Φ_i − Φ_j) over all anchor pairs, Φ_k = 2π·k/9 (RSOC §ε_s terms; RSOC "Φ ∈ [0, 2π) or indexed 1–9").
 *  D_score = Jaccard dissimilarity between the branch trace and its originating anchor trace (RSOC "MinHash/Jaccard dissimilarity between
 *    the current feedback trace τ and the originating echo trace τ₁").
 *  |ΔΦ| = mean absolute phase deviation of the anchors from the ideal Φ9 endpoint, normalised by π (RSOC "normalised to [0, π]").
 *  n = 3 (RMC §6.3 "in the simplest implementation n may be set to 3"; RSOC's alternative n = max(1, ρ+1) is noted, not used).
 *  Phase gate (RMC §8.3 stricter form, Theorem 4): an anchor whose sense is held open has not passed Φ6/Φ7 → branch projection blocked.
 *  "Promising" (archive vs reject) is not given numerically: archive when 0 < N and ε_s ≤ 2θ (implementation choice, flagged).
 * Deterministic: the seed only orders the branch frontier; the budget bounds how many branches are created. */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports; const { sha256 } = isNode ? require('./sha256.js') : root.KSha;
const DEFAULTS = { N_min: 0.15, N_max: 0.75, theta: 0.35, budget: 24, seed: 1 };
const PHI = k => 2 * Math.PI * (k || 9) / 9; const angDev = (a, b) => { let d = Math.abs(a - b) % (2 * Math.PI); if (d > Math.PI) d = 2 * Math.PI - d; return d; };
const TRANSITIVE = r => /^(cmp:|before$|partof$|isa$)/.test(r);
const jac = (a, b) => { const A = new Set(a), B = new Set(b); let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i || 1); };
function explore(edges, o) { o = Object.assign({}, DEFAULTS, o || {}); const anchors = edges.filter(e => e && e.a && e.b && e.rel);
  if (!anchors.length) return { ok: true, route: 'memory_recall_or_speculative_archive', anchors: 0, retained: [], archived: [], rejected: [], params: o };
  const memTok = anchors.map(e => [e.a, (e.neg ? '¬' : '') + e.rel, e.b]); const raw = [];
  /* step 2: adjacent branches */
  for (const x of anchors) for (const y of anchors) { if (x === y || x.neg || y.neg) continue;
    if (x.b === y.a && x.a !== y.b) raw.push({ op: x.rel === y.rel ? 'adjacent_synthesis_same' : 'adjacent_synthesis_mixed', a: x.a, rel: x.rel === y.rel ? x.rel : x.rel + '∘' + y.rel, b: y.b, anchors: [x, y] });
    if (x.rel === y.rel && x.b === y.b && x.a < y.a) raw.push({ op: 'analogy', a: x.a, rel: 'shares:' + x.rel, b: y.a, via: x.b, anchors: [x, y] }); }
  for (const x of anchors) for (const y of anchors) if (x.a === y.a && x.rel === y.rel && x.b === y.b && !x.neg && y.neg) raw.push({ op: 'contradiction_probe', a: x.a, rel: 'unresolved:' + x.rel, b: x.b, anchors: [x, y] });
  const seen = new Set(); const uniq = raw.filter(b => { const k = b.op + '|' + b.a + '|' + b.rel + '|' + b.b; if (seen.has(k)) return false; seen.add(k); return true; });
  const frontier = uniq.map(b => Object.assign(b, { order: sha256(o.seed + '|' + b.op + '|' + b.a + '|' + b.rel + '|' + b.b) })).sort((p, q) => (p.order < q.order ? -1 : 1)).slice(0, o.budget);
  const retained = [], archived = [], rejected = [];
  for (const b of frontier) { const tok = [b.a, b.rel, b.b]; const N = +(1 - Math.max(...memTok.map(m => jac(tok, m)))).toFixed(4);
    const cs = []; for (let i = 0; i < b.anchors.length; i++) for (let j = i + 1; j < b.anchors.length; j++) cs.push(Math.cos(PHI(b.anchors[i].phi) - PHI(b.anchors[j].phi)));
    const mu = cs.reduce((x, y) => x + y, 0) / (cs.length || 1); const sigma = +Math.min(1, Math.sqrt(cs.reduce((x, y) => x + (y - mu) * (y - mu), 0) / (cs.length || 1))).toFixed(4);
    const origin = b.anchors.flatMap(x => [x.a, (x.neg ? '¬' : '') + x.rel, x.b]); const D = +(1 - jac(tok, origin)).toFixed(4);
    const dPhi = +Math.min(1, b.anchors.reduce((x, a) => x + angDev(PHI(a.phi), PHI(9)), 0) / b.anchors.length / Math.PI).toFixed(4); const eps = +((sigma + D + dPhi) / 3).toFixed(4);
    const phaseBlocked = b.anchors.some(x => x.held);
    const id = 'b_' + sha256(b.op + '|' + b.a + '|' + b.rel + '|' + b.b).slice(0, 10); const rec = { branch_id: id, creation_operator: b.op.replace(/_same|_mixed/, ''), claim: { subject: b.a, relation: b.rel, object: b.b, via: b.via || null }, anchor_ids: b.anchors.map(x => x.id),
      novelty: { N, N_min: o.N_min, N_max: o.N_max, status: N < o.N_min ? 'redundant' : N > o.N_max ? 'overextended' : 'bounded_positive' }, drift: { sigma_res: sigma, D_score: D, dPhi, n: 3, eps_s: eps, theta: o.theta, status: eps <= o.theta ? 'below_threshold' : 'above_threshold' } };
    if (phaseBlocked && b.op !== 'contradiction_probe') archived.push(Object.assign(rec, { archive_status: 'phase_gated', projection_status: 'blocked', failure_reason: 'an anchor has not passed Φ6 correction / Φ7 naming (held-open sense) — RMC §8.3 phase gating', future_action: 'resolve the sense, then re-explore' }));
    else if (b.op === 'contradiction_probe') archived.push(Object.assign(rec, { archive_status: 'unresolved_contradiction', projection_status: 'blocked', failure_reason: 'P and ¬P both anchored; needs correction (§5.6 "identify unresolved contradictions")', future_action: 'resolve with the user or new evidence' }));
    else if (N >= o.N_min && N <= o.N_max && eps <= o.theta) retained.push(Object.assign(rec, { status: 'bounded_candidate_pending_score', route: 'coherence_scorer' }));
    else if (N > 0 && eps <= 2 * o.theta) archived.push(Object.assign(rec, { archive_status: 'speculative_unstable', projection_status: 'blocked', failure_reason: rec.novelty.status !== 'bounded_positive' ? 'novelty ' + rec.novelty.status : 'drift above θ', future_action: 'revisit with new memory anchors or evidence' }));
    else rejected.push(Object.assign(rec, { status: 'rejected' })); }
  return { ok: true, route: 'algorithm_3', anchors: anchors.length, explored: frontier.length, candidates_available: uniq.length, retained, archived, rejected, params: o, cite: 'RMC §5.6, §6.3, §6.4, §7.3, §8.3' }; }
const api = { explore, DEFAULTS, PHI };
if (isNode) module.exports = api; else root.KEDE = api;
})(typeof self !== 'undefined' ? self : this);
