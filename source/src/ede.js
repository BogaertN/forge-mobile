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
/* N_min 0.15 / N_max 0.75 / θ 0.35 are the RMC §8.3 WORKED EXAMPLES, not laws (user decision 2026-10-12). */
const DEFAULTS = { N_min: 0.15, N_max: 0.75, theta: 0.35, budget: 24, seed: 1, task_mode: 'creative_brainstorming' };
const THRESHOLD_STATUS = 'RMC §8.3 worked examples, not laws';
/* PROVISIONAL task novelty budgets — evaluated in SHADOW only and never enforced: they are defined for the full N(c), whose weights are
 * deliberately open (Sept 21 implementation addendum: calibration/ablation/FP-FN testing unfinished), so no score here is on their scale. */
const TASK_BUDGETS = { formal_definition: 0.35, coding_patch: 0.30, architecture: 0.55, creative_brainstorming: 0.75, public_scientific_claim: 0.25 };
const LEGAL_OPS = new Set(['adjacent_synthesis', 'analogy', 'contradiction_probe']);
const FORMULA_VERSION = 'retention=simple-structural-jaccard/v1; N_base=c2r-measurement-kernel/provisional-v0; N_vector=rmc-6.4-components/unweighted-v1';
/* NOT part of N(c), kept separate on purpose: D_score weights (0.25 entropy, 0.20 structure, 0.20 semantic, 0.20 phase, 0.15 taxonomy) belong to
 * drift severity; the C2R overall-coherence weights belong to candidate selection (Coherence Scorer). Neither is used here. */
const LABELS = ['redundant', 'useful_bounded_novelty', 'overextended', 'contradictory', 'unsupported'];
const PHI = k => 2 * Math.PI * (k || 9) / 9; const angDev = (a, b) => { let d = Math.abs(a - b) % (2 * Math.PI); if (d > Math.PI) d = 2 * Math.PI - d; return d; };
const TRANSITIVE = r => /^(cmp:|before$|partof$|isa$)/.test(r);
const jac = (a, b) => { const A = new Set(a), B = new Set(b); let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i || 1); };
/* RMC §6.4 expanded form N = w_sem·d_sem + w_phase·d_phase + w_op·d_op + w_struct·d_struct. The papers name the components but give
 * NO weights; §6.2 gives d_phase = |index(Φb) − index(Φa)| (normalised /8 here); Gold Reference build plan gives d_struct = 1 − Jaccard and
 * d_sem = 1 − overlap of terms. Reported for audit only; gating stays on the base form N = dist(c, M_relevant) (§6.4 "not required for the base theory"). */
function comps(b, tok, memTok, anchors) { const ents = new Set(anchors.flatMap(e => [e.a, e.b])); const terms = [b.a, b.b]; const d_sem = +(1 - terms.filter(t => ents.has(t)).length / terms.length).toFixed(4);
  const ph = b.anchors.map(x => +x.phi || 9); const d_phase = +((Math.max(...ph) - Math.min(...ph)) / 8).toFixed(4); const ops = new Set(anchors.map(e => e.rel)); const d_op = ops.has(b.rel) ? 0 : 1;
  const d_struct = +(1 - Math.max(...memTok.map(m => jac(tok, m)))).toFixed(4); return { d_sem, d_phase, d_op, d_struct, weights: 'unspecified in RMC §6.4 — not combined', cite: 'RMC §6.4, §6.2; Build Plan RMC Gold Reference §3–4' }; }
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
      novelty: { N, N_min: o.N_min, N_max: o.N_max, components: comps(b, tok, memTok, anchors), status: N < o.N_min ? 'redundant' : N > o.N_max ? 'overextended' : 'bounded_positive' }, drift: { sigma_res: sigma, D_score: D, dPhi, n: 3, eps_s: eps, theta: o.theta, status: eps <= o.theta ? 'below_threshold' : 'above_threshold' } };
    { const v = rec.novelty.components; const N_base = +(1 - Math.max(...memTok.map(m => jac(tok, m)))).toFixed(4); const op = b.op.replace(/_same|_mixed/, ''); const budget = TASK_BUDGETS[o.task_mode];
      rec.novelty.simple_score = N; rec.novelty.role = 'authoritative retention scalar: simple deterministic structural score — NOT the full RMC §6.4 novelty functional'; rec.novelty.thresholds_status = THRESHOLD_STATUS;
      rec.N_base = { value: N_base, definition: 'N_base(c) = 1 − max memory_similarity(c, m) over active relevant memory nodes; similarity = token Jaccard', source: 'C2R Measurement Kernel build plan (May 2026)', status: 'provisional' };
      rec.N_vector = { semantic_distance: v.d_sem, phase_path_distance: v.d_phase, operator_path_distance: v.d_op, structural_distance: v.d_struct, weights: null, weights_status: 'open (RMC §6.4; Sept 21 addendum)' };
      rec.memory_anchors = b.anchors.map(x => ({ id: x.id, subject: x.a, relation: (x.neg ? '¬' : '') + x.rel, object: x.b, phi: x.phi || null })); rec.task_mode = o.task_mode; rec.novelty_formula_version = FORMULA_VERSION;
      const cb = eps > 2 * o.theta; rec.hard_gates = { novelty_delta_positive: N > 0, novelty_within_budget: N <= o.N_max, budget_used: { value: o.N_max, status: THRESHOLD_STATUS }, epsilon_below_threshold: eps <= o.theta, phase_path_legal: !phaseBlocked, operator_path_legal: LEGAL_OPS.has(op) && op !== 'contradiction_probe',
        memory_trace_present: b.anchors.length > 0 && b.anchors.every(x => x.id != null), speculative: false, circuit_breaker: cb, projection_violation: false, rule: 'every gate must hold; no average can offset a failed gate' };
      rec.hard_gates.all_pass = rec.hard_gates.novelty_delta_positive && rec.hard_gates.novelty_within_budget && rec.hard_gates.epsilon_below_threshold && rec.hard_gates.phase_path_legal && rec.hard_gates.operator_path_legal && (rec.hard_gates.memory_trace_present || rec.hard_gates.speculative) && !cb && !rec.hard_gates.projection_violation;
      rec.shadow = { task_mode: o.task_mode, task_budget: budget == null ? null : budget, budget_status: 'provisional, shadow only, not enforced', compared_value: N_base, compared_value_note: 'N_base is not N(c); comparison recorded for calibration only', within_budget_shadow: budget == null ? null : N_base <= budget }; }
    if (phaseBlocked && b.op !== 'contradiction_probe') archived.push(Object.assign(rec, { archive_status: 'phase_gated', projection_status: 'blocked', failure_reason: 'an anchor has not passed Φ6 correction / Φ7 naming (held-open sense) — RMC §8.3 phase gating', future_action: 'resolve the sense, then re-explore' }));
    else if (b.op === 'contradiction_probe') archived.push(Object.assign(rec, { archive_status: 'unresolved_contradiction', projection_status: 'blocked', failure_reason: 'P and ¬P both anchored; needs correction (§5.6 "identify unresolved contradictions")', future_action: 'resolve with the user or new evidence' }));
    else if (rec.hard_gates.all_pass && N >= o.N_min) retained.push(Object.assign(rec, { status: 'bounded_candidate_pending_score', route: 'coherence_scorer' }));
    else if (N > 0 && eps <= 2 * o.theta) archived.push(Object.assign(rec, { archive_status: 'speculative_unstable', projection_status: 'blocked', failure_reason: rec.novelty.status !== 'bounded_positive' ? 'novelty ' + rec.novelty.status : 'drift above θ', future_action: 'revisit with new memory anchors or evidence' }));
    else rejected.push(Object.assign(rec, { status: 'rejected' })); }
  return { ok: true, route: 'algorithm_3', anchors: anchors.length, explored: frontier.length, candidates_available: uniq.length, retained, archived, rejected, params: o, cite: 'RMC §5.6, §6.3, §6.4, §7.3, §8.3' }; }
/* shadow-calibration record (no fitting here; export feeds future held-out / ablation weight fitting). */
function calibrationRecord(c, outcome) { return { branch_id: c.branch_id, claim: c.claim, outcome, simple_score: c.novelty.simple_score, N_base: c.N_base.value, N_vector: c.N_vector, task_mode: c.task_mode, budget_shadow: c.shadow, drift: { eps_s: c.drift.eps_s, theta: c.drift.theta, status: c.drift.status }, hard_gates: c.hard_gates, memory_anchors: c.memory_anchors, novelty_formula_version: c.novelty_formula_version, human_label: null }; }
const api = { explore, DEFAULTS, PHI, TASK_BUDGETS, LABELS, FORMULA_VERSION, THRESHOLD_STATUS, calibrationRecord, fitted_weights: null };
if (isNode) module.exports = api; else root.KEDE = api;
})(typeof self !== 'undefined' ? self : this);
