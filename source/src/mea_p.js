/* mea_p.js — MEA-P, the PROBLEM lane of MEA (Manifest Evolution Algebra; MEA_SPEC §(a), §(e) steps 1–5). Pure and deterministic: no store, no
 * network, no model. The kernel persists what a user TAP commits (kernel.js meaSeed / meaCommit); nothing here writes anything.
 * Naming follows the AI.Web Apprentice Packet: MEA evolves an unresolved PROBLEM MANIFEST over cycles and hands the committed result to the RMC
 * (Recursive Manifest Compiler) for expression; the RMC Echo checks the words. MEA never selects meaning, renders, or writes memory itself.
 * Sources: MEA_SPEC R1–R11 (forge rmc_engine_v1/mea schema, ClaimStatus, unknown detector, operator registry, composition law, gate engine);
 * FBSC glyph crosswalk (⧒ ⧧ ⟁ ⧙ ⧜ ⧀); RMC §6.3 drift functional (kmath.driftFunctional, |ΔΦ| measured); RMC §6.4/§8.3 novelty (ede.js worked values);
 * GP-014 exact lane (kmath.computeExpr) for every derivation. NO WEIGHTS: gates → Pareto non-domination → declared lexicographic order; the scalar
 * "display_score" uses unit coefficients and is display only (never ranks). Proof debt is a COUNT ratio (undischarged premises / premises), not
 * forge's tier numbers. Every number in a contract is an integer micro-unit (1e-6). Domain-general: a problem is DATA (data/canonical_problems.json
 * 'manifest'); no code below names a domain, a problem or an option. */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports;
const KM = isNode ? require('./kmath.js') : root.KMath, EDE = isNode ? require('./ede.js') : root.KEDE, { sha256 } = isNode ? require('./sha256.js') : root.KSha;
const SCHEMA = 'MEAProblemManifest/v1', CSCHEMA = 'MEACandidate/v1', VERSION = '1.0.0', MICRO = 1000000;
const CLAIM_STATUS = Object.freeze(['recall', 'verified_claim', 'derived_claim', 'hypothesis', 'speculative_branch', 'contradiction_exposed', 'test_required', 'rejected', 'cold_stored', 'named_concept', 'partial_resolution', 'resolved_manifest', 'unclassified']);
const NEXT_ACTIONS = Object.freeze(['none', 'test_required', 'supply_value', 'await_capability']);
const GAP_TYPES = Object.freeze(['missing', 'explicit_unknown', 'weak', 'contradicted', 'unverified', 'dependency_failed']);
/* evidence tiers, ORDINAL (strongest first) — no numeric support values. A premise is DISCHARGED iff its tier is one of DISCHARGED.
   'internal' (house theory) is never discharged: internal ancestry is not empirical proof (R4.7). */
const TIERS = Object.freeze(['empirical_measurement', 'published', 'given', 'derived_exact', 'internal', 'hypothesis', 'speculative', 'unknown']);
const DISCHARGED = Object.freeze(['empirical_measurement', 'published', 'given', 'derived_exact']);
const UNKNOWN_KINDS = Object.freeze(['measurement', 'choice', 'quantity']);
/* operator registry (R3.2; FBSC crosswalk R3.3). cost = 1 for every executable operator (a uniform count, not a weight); system operators are
   registered for cost only and never execute (llm_generate must stay non-executable) */
const OPERATORS = Object.freeze({
  derive: { glyph: null, family: 'O_gen', theta: { derivation: 'string' }, cost: 1, executable: true, doc: 'evaluate one exact derivation in the GP-014 lane' },
  hypothesize: { glyph: '⧒', family: 'O_gen', theta: { unknown: 'string', option: 'string' }, cost: 1, executable: true, doc: 'one option of a choice unknown as a draft hypothesis' },
  split: { glyph: '⧧', family: 'O_gen', theta: { unknown: 'string' }, cost: 1, executable: true, doc: 'one sub-manifest per option (lineage kept)' },
  merge: { glyph: '⟁', family: 'O_gen', theta: { members: 'array' }, cost: 1, executable: true, doc: 'combine verified candidates that share the goal into one resolution candidate' },
  seal: { glyph: '⧙', family: 'commit', theta: { candidate: 'string' }, cost: 1, executable: true, doc: 'user-tapped commit M_t → M_{t+1}' },
  record: { glyph: '⧜', family: 'commit', theta: { candidate: 'string' }, cost: 1, executable: true, doc: 'MEA-owned store record of the committed manifest (kernel; tap only)' },
  archive: { glyph: '⧀', family: 'commit', theta: { candidate: 'string' }, cost: 1, executable: true, doc: 'cold storage of a rejected / eliminated / shadow candidate with its reason' },
  detect_unknowns: { glyph: null, family: 'O_verify', theta: {}, cost: 1, executable: true, doc: 'unknown vector with gap types' },
  external_search: { glyph: null, family: 'system', theta: {}, cost: 1, executable: false, doc: 'registered for cost only' },
  run_simulation: { glyph: null, family: 'system', theta: {}, cost: 1, executable: false, doc: 'registered for cost only' },
  llm_generate: { glyph: null, family: 'system', theta: {}, cost: 1, executable: false, doc: 'never executable' } });
/* the declared lexicographic order (after gates and Pareto): proof debt ↓, likelihood ↑, convergence ↑, information gain ↑, goal ancestry ↑,
   drift ↓, operator cost ↓, id */
const LEX_ORDER = Object.freeze([['B', -1], ['L', 1], ['Omega', 1], ['I', 1], ['A', 1], ['eps', -1], ['K', -1]]);
const PARETO_AXES = LEX_ORDER;
const DEFAULT_BUDGET = 64;

const canon = x => { if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']'; if (x && typeof x === 'object') return '{' + Object.keys(x).sort().filter(k => x[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(x[k])).join(',') + '}'; return JSON.stringify(x === undefined ? null : x); };
const H = x => sha256(canon(x));
const clone = x => JSON.parse(JSON.stringify(x));
const micro = (n, d) => (d ? Math.floor((MICRO * n) / d) : 0);
const STOP = new Set('the and for with from that this are was were has have had its not but any all only into than then them they there their what which who whom whose how why when where one two per out off very more most less least each other such some own same can will would should could may might must does did done being been also about over under between within without onto upon whether exactly'.split(' '));
const termsOf = t => new Set(String(t || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !STOP.has(w)));
const jacc = (a, b) => { if (!a.size && !b.size) return 1; let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i); };

/* ---------- step 1: the manifest contract ---------- */
function manifestHash(M) { const o = Object.assign({}, M); delete o.hash; delete o.created_at; return H(o); }
function normalize(rec) { const r = rec && rec.manifest ? Object.assign({ problem_id: rec.id, domain: rec.domain }, rec.manifest) : Object.assign({}, rec);
  const M = { schema: SCHEMA, schema_version: VERSION, problem_id: String(r.problem_id || ''), goal: String(r.goal || ''), domain: r.domain ? String(r.domain) : null,
    known_facts: (r.known_facts || []).map((f, i) => typeof f === 'string' ? { id: 'f' + (i + 1), text: f, tier: 'given' } : { id: String(f.id), text: String(f.text), tier: TIERS.includes(f.tier) ? f.tier : 'given', value: f.value != null ? String(f.value) : undefined }),
    unknowns: (r.unknowns || []).map(u => ({ id: String(u.id), text: String(u.text), kind: UNKNOWN_KINDS.includes(u.kind) ? u.kind : 'measurement', symbol: u.symbol || undefined, value: u.value != null ? String(u.value) : undefined, resolved_option: u.resolved_option || undefined, assumed: u.assumed || undefined,
      options: u.options ? u.options.map(o => ({ id: String(o.id), text: String(o.text), assumptions: (o.assumptions || []).map(String), likelihood: o.likelihood != null ? String(o.likelihood) : undefined, condition: o.condition || undefined, falsifier: o.falsifier || undefined, uses: o.uses || undefined, eliminated: o.eliminated || undefined })) : undefined })),
    derivations: (r.derivations || []).map(d => ({ id: String(d.id), expr: String(d.expr), claim: String(d.claim || '{v}'), uses: (d.uses || []).map(String), needs: d.needs ? d.needs.map(String) : undefined, option: d.option || undefined })),
    success_conditions: (r.success_conditions || []).map(s => ({ id: String(s.id), text: String(s.text), unknown: s.unknown || undefined, derivations: s.derivations || undefined })),
    constraints: (r.constraints || []).map(String), contradictions: (r.contradictions || []).map(String),
    phase_state: Number.isInteger(r.phase_state) && r.phase_state >= 1 && r.phase_state <= 9 ? r.phase_state : 1,
    claim_status: CLAIM_STATUS.includes(r.claim_status) ? r.claim_status : 'unclassified', required_next_action: NEXT_ACTIONS.includes(r.required_next_action) ? r.required_next_action : 'none',
    output_permissions: r.output_permissions || 'sealed', claims: r.claims || [], proof_debt_micro: Number.isInteger(r.proof_debt_micro) ? r.proof_debt_micro : MICRO,
    phase_path: r.phase_path || [Number.isInteger(r.phase_state) ? r.phase_state : 1], operator_history: r.operator_history || [], goal_ancestry: r.goal_ancestry || [String(r.problem_id || '')],
    memory_ancestry: r.memory_ancestry || [], parent_hash: r.parent_hash || null, cycle: Number.isInteger(r.cycle) ? r.cycle : 0, breaker: r.breaker || { failed_cycles: 0 } };
  M.hash = manifestHash(M); return M; }
function validate(M) { const v = []; if (!M || M.schema !== SCHEMA) v.push('schema'); if (!M.problem_id) v.push('problem_id'); if (!M.goal) v.push('goal');
  const ids = new Set(); for (const x of [].concat(M.known_facts, M.unknowns, M.derivations, M.success_conditions)) { if (ids.has(x.id)) v.push('duplicate_id:' + x.id); ids.add(x.id); }
  for (const u of M.unknowns) if (u.kind === 'choice' && !(u.options && u.options.length >= 2)) v.push('choice_without_options:' + u.id);
  for (const d of M.derivations) { for (const f of d.uses) if (!M.known_facts.some(k => k.id === f)) v.push('unknown_fact:' + d.id + ':' + f); for (const n of d.needs || []) if (!M.unknowns.some(u => u.id === n)) v.push('unknown_unknown:' + d.id + ':' + n); }
  if (M.hash !== manifestHash(M)) v.push('hash'); return v; }
/* the unknown vector (R2.5) */
function unknownVector(M) { return M.unknowns.map(u => { const opts = (u.options || []).filter(o => !o.eliminated);
  const resolved = u.kind === 'choice' ? !!u.resolved_option : u.value != null;
  const gap = resolved ? null : u.kind === 'choice' ? (opts.length === 0 ? 'contradicted' : 'explicit_unknown') : 'missing';
  return { id: u.id, kind: u.kind, text: u.text, resolved, gap }; }); }
const openUnknown = (M, id) => { const u = M.unknowns.find(x => x.id === id); return !u || (u.kind === 'choice' ? !u.resolved_option : u.value == null); };

/* ---------- exact lane ---------- */
function substitute(expr, M) { let e = String(expr), needs = []; for (const u of M.unknowns) if (u.symbol && new RegExp('\\b' + u.symbol + '\\b').test(e)) { if (u.value == null) needs.push(u.id); else e = e.replace(new RegExp('\\b' + u.symbol + '\\b', 'g'), '(' + u.value + ')'); } return { expr: e, needs }; }
function exact(expr, M) { const s = substitute(expr, M); if (s.needs.length) return { ok: false, needs: s.needs, value: null }; const r = KM.computeExpr(s.expr); return r.ok && r.exact ? { ok: true, value: r.value, needs: [] } : { ok: false, needs: [], value: null, error: r.error || 'NOT_EXACT' }; }
function sign(expr, M) { const r = exact(expr, M); if (!r.ok) return r.needs.length ? { open: r.needs } : null; return { s: r.value === '0' ? 0 : /^-/.test(r.value) ? -1 : 1 }; }
function condHolds(cond, M) { if (!cond) return null; const r = sign('(' + cond.lhs + ')-(' + cond.rhs + ')', M); if (!r || r.open) return null;
  const s = r.s; return ({ '<': s < 0, '<=': s <= 0, '>': s > 0, '>=': s >= 0, '=': s === 0, '!=': s !== 0 })[cond.op]; }

/* ---------- step 3: operators (pure; same inputs → same candidate) ---------- */
const factTier = (M, id) => { const f = M.known_facts.find(k => k.id === id); return f ? f.tier : 'unknown'; };
const expectedPhase = (op, p) => (op === 'derive' || op === 'merge' ? KM.phaseNext(p) : p);
function candBody(c) { const o = {}; for (const k of ['schema', 'problem_id', 'goal', 'parent_hash', 'op', 'theta', 'kind', 'claim', 'value', 'premises', 'phase_path', 'quarantine', 'unknown', 'option', 'likelihood', 'needs', 'depends', 'children', 'members', 'resolves', 'satisfies', 'new_facts', 'ops']) if (c[k] !== undefined) o[k] = c[k]; return o; }
const candHash = c => 'meac:' + H(candBody(c)).slice(0, 16);
function fill(t, v) { return String(t).replace('{v}', v == null ? '?' : v); }
function generate(op, theta, M, pool) { const p = M.phase_state, base = { schema: CSCHEMA, problem_id: M.problem_id, goal: M.goal, parent_hash: M.hash, op, theta: clone(theta || {}), ops: 1 };
  let c = null;
  if (op === 'derive') { const d = M.derivations.find(x => x.id === theta.derivation); if (!d) return null; const r = exact(d.expr, M), optOpen = d.option ? (() => { const [u, o] = d.option.split(':'), U = M.unknowns.find(x => x.id === u); if (!U) return null; const O = (U.options || []).find(x => x.id === o) || {}, held = U.resolved_option ? U.resolved_option === o : condHolds(O.condition, M); /* the option's own exact condition decides it in this cycle */ return { u, o, open: held == null && !U.resolved_option, elim: !!O.eliminated || held === false }; })() : null;
    const needs = r.needs.slice(); const prem = d.uses.map(f => ({ ref: 'f:' + f, tier: factTier(M, f) })).concat(needs.map(n => ({ ref: 'u:' + n, tier: 'unknown' })));
    for (const u of M.unknowns) if (u.symbol && u.value != null && new RegExp('\\b' + u.symbol + '\\b').test(d.expr)) prem.push({ ref: 'u:' + u.id, tier: 'given' });
    if (optOpen && optOpen.open) prem.push({ ref: 'o:' + optOpen.u + ':' + optOpen.o, tier: 'hypothesis' });
    const kind = optOpen && optOpen.elim ? 'withdrawn' : r.ok ? (optOpen && optOpen.open ? 'conditional' : 'derived') : needs.length ? 'conditional' : 'failed';
    const dep = optOpen ? (() => { const U = M.unknowns.find(x => x.id === optOpen.u), O = U && (U.options || []).find(x => x.id === optOpen.o); return O && O.condition ? M.unknowns.filter(u => u.symbol && new RegExp('\\b' + u.symbol + '\\b').test(O.condition.lhs + ' ' + O.condition.rhs)).map(u => u.id) : []; })() : [];
    c = Object.assign(base, { kind, claim: fill(d.claim, r.ok ? r.value : substitute(d.expr, M).expr), value: r.value, premises: prem, phase_path: [p, KM.phaseNext(p)], needs: needs.length ? needs : undefined, depends: dep.length ? dep : undefined, option: d.option, new_facts: kind === 'derived' ? 1 : 0, satisfies: M.success_conditions.filter(s => (s.derivations || []).includes(d.id)).map(s => s.id) }); }
  else if (op === 'hypothesize') { const U = M.unknowns.find(x => x.id === theta.unknown), o = U && (U.options || []).find(x => x.id === theta.option); if (!o) return null;
    const uses = o.uses || M.known_facts.filter(f => DISCHARGED.includes(f.tier)).map(f => f.id);
    const prem = [{ ref: 'o:' + U.id + ':' + o.id, tier: 'hypothesis' }].concat(uses.map(f => ({ ref: 'f:' + f, tier: factTier(M, f) })), o.assumptions.map((a, i) => ({ ref: 'a:' + U.id + ':' + o.id + ':' + i, tier: 'hypothesis' })));
    const held = condHolds(o.condition, M), L = o.likelihood != null ? exact(o.likelihood, M) : null;
    const condOpen = o.condition && held == null ? substitute('(' + o.condition.lhs + ')-(' + o.condition.rhs + ')', M).needs : [];
    if (held === true) prem[0].tier = 'derived_exact'; /* the condition is decided exactly: the option is established, not assumed */
    const speculative = o.likelihood == null && !o.condition && !o.falsifier;
    const depends = o.condition ? M.unknowns.filter(u => u.symbol && new RegExp('\\b' + u.symbol + '\\b').test(o.condition.lhs + ' ' + o.condition.rhs)).map(u => u.id) : [];
    const kind = o.eliminated || held === false || (L && L.ok && L.value === '0') ? 'eliminated' : held === true ? 'established' : 'hypothesis';
    c = Object.assign(base, { kind, claim: o.text, unknown: U.id, option: o.id, premises: prem, likelihood: L && L.ok ? L.value : undefined, needs: condOpen.length ? condOpen : undefined,
      phase_path: speculative ? [p, KM.phasePrev(p)] : [p], quarantine: speculative ? true : undefined, resolves: kind === 'established' ? [U.id] : undefined,
      satisfies: kind === 'established' ? M.success_conditions.filter(s => s.unknown === U.id).map(s => s.id) : [], new_facts: 0, depends: depends.length ? depends : undefined }); }
  else if (op === 'split') { const U = M.unknowns.find(x => x.id === theta.unknown); if (!U || U.kind !== 'choice' || U.resolved_option) return null; const live = U.options.filter(o => !o.eliminated); if (live.length < 2) return null;
    c = Object.assign(base, { kind: 'split', claim: U.text, unknown: U.id, children: live.map(o => ({ problem_id: M.problem_id + '/' + U.id + '=' + o.id, assumption: o.text, goal_ancestry: M.goal_ancestry.concat([M.problem_id]) })), premises: [{ ref: 'u:' + U.id, tier: 'unknown' }], phase_path: [p], new_facts: 0, satisfies: [] }); }
  else if (op === 'merge') { const ms = (theta.members || []).map(id => (pool || []).find(x => x.candidate_id === id)).filter(Boolean); if (!ms.length || ms.length !== (theta.members || []).length) return null;
    const seen = new Map(); for (const m of ms) for (const q of m.premises) if (!seen.has(q.ref) || TIERS.indexOf(q.tier) < TIERS.indexOf(seen.get(q.ref))) seen.set(q.ref, q.tier);
    /* a hypothesis premise is discharged when the same option is established in the merge */
    for (const m of ms) if (m.kind === 'established') seen.set('o:' + m.unknown + ':' + m.option, 'derived_exact');
    const premises = [...seen].map(([ref, tier]) => ({ ref, tier })).sort((a, b) => (a.ref < b.ref ? -1 : 1));
    const resolves = [...new Set(ms.flatMap(m => m.resolves || []))].sort(), satisfies = [...new Set(ms.flatMap(m => m.satisfies || []))].sort();
    c = Object.assign(base, { kind: 'resolution', claim: M.goal, members: ms.map(m => m.candidate_id).sort(), premises, resolves, satisfies, new_facts: ms.reduce((a, m) => a + (m.new_facts || 0), 0), ops: 1 + ms.reduce((a, m) => a + (m.ops || 1), 0), phase_path: [p, KM.phaseNext(p)] }); }
  if (!c) return null; c.candidate_id = candHash(c); return c; }
function replay(c, M, pool) { const r = generate(c.op, c.theta, M, pool); return r ? r.candidate_id : null; }

/* ---------- step 2: term scorers (no weights) ---------- */
/* operator cost schedule (4.9.74, MEA step 7: MEA's own data is MEA-K-evolvable): costs = { op: integer ≥ 1 } overrides the uniform registry cost for
   the K term only (a resolution costs ⟁ plus its members); with no schedule every executable operator costs 1 and K is exactly as before. Costs
   enter K, the LAST lexicographic term before id — they never gate, never weigh, and the gates / thresholds / drift ruling are not data. */
function opCost(c, costs, pool) { const k = op => (costs && Number.isInteger(costs[op]) && costs[op] >= 1 ? costs[op] : (OPERATORS[op] || { cost: 1 }).cost);
  if (!costs) return c.ops || 1; if (c.op === 'merge') return k('merge') + (c.members || []).reduce((a, id) => { const m = (pool || []).find(x => x.candidate_id === id); return a + (m ? opCost(m, costs, pool) : 1); }, 0); return k(c.op); }
function terms(c, M, budget, costs, pool) { const P = c.premises || [], und = P.filter(q => !DISCHARGED.includes(q.tier)).length;
  const nU = M.unknowns.length || 1, nS = M.success_conditions.length;
  const dF = c.new_facts ? c.new_facts / (M.known_facts.length + c.new_facts) : 0, dQ = (c.resolves || []).length / nU, dX = 0;
  const I = Math.min(1, dF + dQ + dX), Omega = nS ? (c.satisfies || []).length / nS : 0;
  const gT = termsOf(M.goal), A = gT.size ? [...termsOf(c.goal)].filter(w => gT.has(w)).length / gT.size : 1;
  const from = c.phase_path[0], to = c.phase_path[c.phase_path.length - 1];
  const dr = KM.driftFunctional({ phaseHistory: c.phase_path, transition: { from, to, quarantine: !!c.quarantine, expected: c.quarantine ? KM.phasePrev(from) : expectedPhase(c.op, from) /* the declared quarantine move Φ−1 (kmath phaseStep quarantine law) */ }, depth: 1 });
  const known = M.known_facts.reduce((s, f) => { for (const w of termsOf(f.text)) s.add(w); return s; }, new Set()), ct = termsOf(c.claim);
  const N = ct.size ? 1 - jacc(ct, known) : 0;
  const L = c.likelihood != null ? KM.computeExpr(c.likelihood).verify.float : null;
  return { B: micro(und, P.length || 1), I: Math.round(I * MICRO), Omega: Math.round(Omega * MICRO), A: Math.round(A * MICRO), K: micro(opCost(c, costs, pool), budget || DEFAULT_BUDGET),
    eps: Math.round(dr.eps_s * MICRO), N: Math.round(N * MICRO), L: L == null ? null : Math.round(L * MICRO), L_exact: c.likelihood, drift: { band: KM.driftGovernance(dr.eps_s).band, formula: dr.formula },
    formula: { B: 'B = undischarged premises / premises (' + und + '/' + P.length + ')', I: 'I = ΔF + ΔQ + ΔX = ' + [dF, dQ, dX].map(x => Math.round(x * 1e4) / 1e4).join(' + '), Omega: 'Ω = satisfied / total success conditions', A: 'A = retained root-goal terms / root-goal terms', K: 'K = operators / budget (uniform cost 1)' } }; }
const noveltyClass = n => { const P = EDE.DEFAULTS, x = n / MICRO; return x < P.N_min ? 'recall_band' : x <= P.N_max ? 'bounded' : 'overextended'; };
const displayScore = t => t.I + t.Omega + t.A + (t.L || 0) - t.B - t.K - t.eps; /* unit coefficients (RMC §5.7 worked convention); DISPLAY ONLY */

/* claim status (R2.4, R4.7); required_next_action is separate (Build 006) */
function classify(c, t, M) { const P = c.premises || [], open = P.some(q => q.tier === 'unknown');
  const fals = c.unknown && c.option ? !!(((M.unknowns.find(u => u.id === c.unknown) || {}).options || []).find(o => o.id === c.option) || {}).falsifier : false;
  const measOpen = M.unknowns.some(u => u.kind !== 'choice' && u.value == null);
  if (c.kind === 'eliminated') return { claim_status: 'contradiction_exposed', required_next_action: 'none' };
  if (c.kind === 'withdrawn') return { claim_status: 'rejected', required_next_action: 'none' };
  if (c.kind === 'failed') return { claim_status: 'unclassified', required_next_action: 'await_capability' };
  if (c.kind === 'derived') { if (t.B === 0 && P.some(q => q.tier === 'empirical_measurement') && P.every(q => q.tier === 'empirical_measurement')) return { claim_status: 'verified_claim', required_next_action: 'none' };
    return t.B === 0 ? { claim_status: noveltyClass(t.N) === 'recall_band' ? 'recall' : 'derived_claim', required_next_action: 'none' } : { claim_status: 'hypothesis', required_next_action: 'test_required' }; }
  if (c.kind === 'conditional') return { claim_status: 'partial_resolution', required_next_action: 'test_required' };
  if (c.kind === 'established') return { claim_status: t.B === 0 ? 'derived_claim' : 'hypothesis', required_next_action: t.B === 0 ? 'none' : 'test_required' };
  if (c.kind === 'hypothesis') return c.quarantine ? { claim_status: 'speculative_branch', required_next_action: 'test_required' } : { claim_status: 'hypothesis', required_next_action: fals || measOpen || (c.needs || []).length ? 'test_required' : 'none' };
  if (c.kind === 'split') return { claim_status: 'hypothesis', required_next_action: 'test_required' };
  if (c.kind === 'resolution') { const allU = M.unknowns.every(u => (c.resolves || []).includes(u.id) || !openUnknown(M, u.id)), allS = M.success_conditions.length && (c.satisfies || []).length === M.success_conditions.length;
    const cond = (c.members_kinds || []).includes('conditional');
    if (allU && allS && t.B === 0 && t.I > 0) return { claim_status: 'resolved_manifest', required_next_action: 'none' };
    if ((c.satisfies || []).length || cond) return { claim_status: 'partial_resolution', required_next_action: 'test_required' };
    return { claim_status: 'hypothesis', required_next_action: open || measOpen || (c.members_kinds || []).includes('hypothesis') ? 'test_required' : 'none' }; }
  return { claim_status: 'unclassified', required_next_action: 'none' }; }

/* ---------- step 2: the gate engine (hard gates, in order; a score never overrides a gate) ---------- */
function gates(c, M, ctx) { const out = [], add = (gate, ok, note) => out.push({ gate, ok: !!ok, note: note || '' }); ctx = ctx || {};
  add('REPLAY', replay(c, M, ctx.pool) === c.candidate_id, 'Replay(H(M_t), O_k, θ_k) = H(c_i)');
  add('TAMPER', candHash(c) === c.candidate_id, 'stored id = hash of the candidate body');
  const op = OPERATORS[c.op], thetaOk = op && Object.keys(op.theta).every(k => (op.theta[k] === 'array' ? Array.isArray(c.theta[k]) : typeof c.theta[k] === op.theta[k])) && Object.keys(c.theta).every(k => k in op.theta);
  add('LEGALITY', op && op.executable && op.family === 'O_gen' && thetaOk && c.problem_id === M.problem_id && c.goal === M.goal && c.parent_hash === M.hash, 'registered executable operator, typed θ, identity invariant (problem_id, goal, parent)');
  const bad = (c.premises || []).filter(q => { const [k, id] = q.ref.split(':'); if (k === 'f') return q.tier !== factTier(M, id); if (k === 'u') return q.tier === 'given' ? openUnknown(M, id) : q.tier !== 'unknown'; return DISCHARGED.includes(q.tier) && !(k === 'o' && (c.kind === 'established' || c.kind === 'resolution')); });
  add('EVIDENCE', !bad.length, bad.length ? 'unsupported evidence cannot reduce proof debt: ' + bad.map(q => q.ref).join(', ') : 'every discharged premise is traceable to the manifest');
  const pl = KM.phaseLaw(c.phase_path, { quarantine: !!c.quarantine, gates: ctx.commitGates || [] }); add('PHASE', pl.ok, pl.violations.join('; ') || pl.trail);
  const t = ctx.terms || terms(c, M, ctx.budget), band = t.drift.band;
  add('DRIFT', band === 'projectable' || band === 'explore', 'ε_s ' + t.eps / MICRO + ' (' + band + ')');
  const cl = ctx.cls || classify(c, t, M);
  add('CLAIM', !(cl.claim_status === 'verified_claim' && !(c.premises || []).some(q => q.tier === 'empirical_measurement')) && !(['derived_claim', 'resolved_manifest'].includes(cl.claim_status) && t.B !== 0), 'verified needs empirical evidence; derived/resolved need zero proof debt');
  add('I_ZERO', !(t.I === 0 && ['resolved_manifest', 'named_concept'].includes(cl.claim_status)), 'I = 0 is never a discovery');
  add('NOVELTY', !(noveltyClass(t.N) === 'recall_band' && ['resolved_manifest', 'named_concept'].includes(cl.claim_status)), 'recall is never expressed as discovery');
  add('BUDGET', (ctx.index || 0) < (ctx.budget || DEFAULT_BUDGET), 'per-cycle budget');
  return out; }

/* ---------- step 2: selection — gates → Pareto → lexicographic ---------- */
const better = (a, b, k, dir) => { const x = a.terms[k], y = b.terms[k]; if (x == null || y == null) return 0; return x === y ? 0 : (x > y) === (dir > 0) ? 1 : -1; };
function dominates(a, b) { let strict = false; for (const [k, d] of PARETO_AXES) { const r = better(a, b, k, d); if (r < 0) return false; if (r > 0) strict = true; } return strict; }
function lexCmp(a, b) { for (const [k, d] of LEX_ORDER) { const x = a.terms[k], y = b.terms[k]; if (x == null && y == null) continue; if (x == null) return 1; if (y == null) return -1; if (x !== y) return (x > y) === (d > 0) ? -1 : 1; } return a.candidate_id < b.candidate_id ? -1 : a.candidate_id > b.candidate_id ? 1 : 0; }
function lexKey(a, b) { for (const [k, d] of LEX_ORDER) { const x = a.terms[k], y = b.terms[k]; if (x == null && y == null) continue; if (x !== y) return k; } return 'id'; }
function rank(cs) { const front = cs.filter(a => !cs.some(b => b !== a && dominates(b, a))); const sorted = cs.slice().sort((a, b) => { const fa = front.includes(a), fb = front.includes(b); return fa !== fb ? (fa ? -1 : 1) : lexCmp(a, b); });
  return sorted.map((c, i) => ({ id: c.candidate_id, rank: i + 1, pareto: front.includes(c), decided_by: i ? lexKey(sorted[i - 1], c) : null })); }

/* ---------- the cycle (R7.1 steps 2–9; commit is separate and tapped) ---------- */
function cycle(M0, opts) { const M = M0, o = Object.assign({ budget: DEFAULT_BUDGET }, opts || {}), log = [];
  if ((M.breaker || {}).failed_cycles >= 2) return { ok: false, rule: 'MEA-CIRCUIT-BREAKER', note: 'two consecutive cycles without an eligible candidate', candidates: [] };
  const vio = validate(M); if (vio.length) return { ok: false, rule: 'MEA-INVALID-MANIFEST', violations: vio, candidates: [] };
  const uv = unknownVector(M), drafts = [];
  const dv = M.derivations.map(d => ['derive', { derivation: d.id }]), ch = []; /* operator schedule: derive first (default) or choice first (o.order, MEA-K meta data) */
  for (const u of M.unknowns) if (u.kind === 'choice' && !u.resolved_option) { for (const op of u.options) ch.push(['hypothesize', { unknown: u.id, option: op.id }]); ch.push(['split', { unknown: u.id }]); }
  for (const x of (o.order === 'choice_first' ? ch.concat(dv) : dv.concat(ch))) drafts.push(x);
  const pool = []; let stop = null;
  for (const [op, th] of drafts) { if (pool.length >= o.budget) { stop = { rule: 'MEA-BUDGET', note: 'per-cycle budget ' + o.budget + ' reached' }; break; } const c = generate(op, th, M); if (c) pool.push(c); }
  const verify = (c, i, extra) => { const t = terms(c, M, o.budget, o.costs, pool), cl = classify(c, t, M), g = gates(c, M, Object.assign({ terms: t, cls: cl, pool, budget: o.budget, index: i }, extra || {}));
    const failed = g.filter(x => !x.ok); const route = failed.length ? 'rejected' : c.kind === 'eliminated' || c.kind === 'withdrawn' ? 'archived' : c.kind === 'failed' ? 'archived' : c.quarantine || t.drift.band === 'explore' ? 'shadow' : 'eligible';
    return Object.assign(c, { terms: t, claim_status: failed.length ? 'rejected' : cl.claim_status, required_next_action: failed.length ? 'none' : cl.required_next_action, gates: g, route, novelty_class: noveltyClass(t.N), display_score: displayScore(t) }); };
  pool.forEach((c, i) => verify(c, i));
  /* 4.9.76 ruling 4 (Nic): options that meet their exact conditions are ESTABLISHED, all of them: there is no tie to split and no single pick */
  for (const c of pool.filter(x => x.op === 'split' && x.route === 'eligible')) if (pool.some(x => x.op === 'hypothesize' && x.unknown === c.unknown && x.kind === 'established' && x.route === 'eligible')) Object.assign(c, { route: 'archived', reason: 'its options are established exactly: no split', needs: ['decided:established'] });
  if (pool.some(c => c.terms.eps > KM.DRIFT_RULING.explore_max * MICRO /* 4.9.87: the drift table's hard stop */)) stop = { rule: 'MEA-DRIFT-EXCURSION', note: 'a candidate exceeded the 0.80 hard stop' };
  /* slates: the options of each choice unknown compete; derived claims do not compete with each other */
  const slates = {}; for (const u of M.unknowns.filter(x => x.kind === 'choice')) { const cs = pool.filter(c => c.op === 'hypothesize' && c.unknown === u.id && c.route === 'eligible'); const r = rank(cs);
    const fav = r.length >= 2 && r[1].decided_by && r[1].decided_by !== 'id' && r[0].pareto ? r[0].id : r.length === 1 ? r[0].id : null; slates[u.id] = { ranking: r, favoured: fav }; for (const x of r) { const c = pool.find(y => y.candidate_id === x.id); c.rank = x.rank; c.pareto = x.pareto; c.favoured = x.id === fav; } }
  /* ⟁ the resolution candidate: every eligible derived / conditional / option candidate (sharing the goal) */
  const members = pool.filter(c => c.route === 'eligible' && ['derived', 'conditional', 'hypothesis', 'established'].includes(c.kind)).map(c => c.candidate_id);
  let resolution = null; if (members.length) { resolution = generate('merge', { members }, M, pool); if (resolution) { resolution.members_kinds = [...new Set(members.map(id => pool.find(x => x.candidate_id === id).kind))].sort(); verify(resolution, pool.length, { pool }); } }
  const eligible = pool.filter(c => c.route === 'eligible').length;
  return { ok: !stop || stop.rule === 'MEA-BUDGET', problem_id: M.problem_id, parent_hash: M.hash, unknown_vector: uv, candidates: pool, slates, resolution, stop, eligible,
    lex_order: LEX_ORDER.map(([k, d]) => k + (d > 0 ? '↑' : '↓')).concat(['id']), log, opts: { budget: o.budget, order: o.order || null, costs: o.costs || null } }; }

/* ---------- step 4: commit (pure; the kernel persists it only on a user tap) ---------- */
/* 4.9.74 ruling 2 (Nic): ⧧ splits a tie into sub-manifests only when the tied options need DIFFERENT tests or conditions (their exact condition
   or falsifier differs); options that would be settled by the same test stay together in the parent. The tie is the top of the slate ranking
   down to the last option that differs from the leader only by the id tie-break. */
const testSig = (M, uid, oid) => { const U = M.unknowns.find(x => x.id === uid), O = U && (U.options || []).find(x => x.id === oid) || {}; return canon({ condition: O.condition || null, falsifier: O.falsifier || null }); };
function tiedOptions(M, cy, uid) { const sl = cy.slates[uid]; if (!sl || !sl.ranking.length) return []; const out = [sl.ranking[0]]; for (let i = 1; i < sl.ranking.length && sl.ranking[i].decided_by === 'id'; i++) out.push(sl.ranking[i]);
  return out.map(r => (cy.candidates.find(c => c.candidate_id === r.id) || {}).option).filter(Boolean); }
function splitNeeded(M, cy, uid) { if ((cy.candidates || []).some(c => c.op === 'hypothesize' && c.unknown === uid && c.kind === 'established' && c.route === 'eligible')) return false; /* ruling 4 */ const t = tiedOptions(M, cy, uid); return t.length >= 2 && new Set(t.map(o => testSig(M, uid, o))).size >= 2; }
function commit(M, cy, candidateId, tap) { if (tap !== true) return { ok: false, rule: 'MEA-TAP-REQUIRED' };
  if (!cy || cy.parent_hash !== M.hash) return { ok: false, rule: 'MEA-STALE-CYCLE' };
  const r = cy.resolution; if (!r || r.candidate_id !== candidateId) return { ok: false, rule: 'MEA-NOT-COMMITTABLE', note: 'only the ⟁ resolution candidate of this cycle is committable' };
  /* 4.9.76: the commit re-derives the cycle from the manifest; a resolution (or pool) edited after the cycle is not the one the gates passed */
  { const fr = cycle(M, Object.assign({}, cy.opts || {}, { order: (cy.opts || {}).order || undefined, costs: (cy.opts || {}).costs || undefined })); if (!fr.resolution || canon(fr.resolution) !== canon(r) || canon(fr.candidates) !== canon(cy.candidates)) return { ok: false, rule: 'MEA-TAMPERED', note: 'the resolution does not match a fresh cycle of this manifest' }; }
  if (r.route !== 'eligible') return { ok: false, rule: 'MEA-GATES', failed: r.gates.filter(g => !g.ok).map(g => g.gate) };
  if (r.terms.drift.band !== 'projectable') return { ok: false, rule: 'MEA-DRIFT-NOT-APPROVABLE' };
  /* ⧙ seal: the committed path walks lawful successors to Φ7 (naming); ruling 3 gates Φ5, Φ7 (and Φ6 when χ corrected) must not be skipped */
  const path = [M.phase_state]; while (path[path.length - 1] !== 7 && path.length < 10) path.push(KM.phaseNext(path[path.length - 1]));
  const pl = KM.phaseLaw(path, { gates: [5, 7] }); if (!pl.ok) return { ok: false, rule: 'MEA-PHASE', violations: pl.violations };
  const byId = id => cy.candidates.find(c => c.candidate_id === id), mem = r.members.map(byId);
  const N = clone(M); delete N.hash;
  for (const c of mem.filter(x => x.kind === 'derived' && x.claim_status !== 'recall')) { const d = N.derivations.find(x => x.id === c.theta.derivation); if (d && !N.known_facts.some(f => f.from === c.theta.derivation)) N.known_facts.push({ id: 'k' + c.theta.derivation, text: c.claim, tier: 'derived_exact', value: c.value, from: c.theta.derivation }); }
  for (const c of mem.filter(x => x.kind === 'established')) { const u = N.unknowns.find(x => x.id === c.unknown); if (!u.resolved_options) { u.resolved_options = []; u.resolved_option = c.option; } if (!u.resolved_options.includes(c.option)) u.resolved_options.push(c.option); } /* ruling 4: every established option is kept */
  for (const u of N.unknowns) if (u.resolved_options) { const ord = (u.options || []).map(o => o.id); u.resolved_options.sort((a, b) => ord.indexOf(a) - ord.indexOf(b)); u.resolved_option = u.resolved_options[0]; }
  const archive = [];
  for (const c of cy.candidates.filter(x => x.route !== 'eligible' || x.kind === 'eliminated')) { if (c.kind === 'eliminated') { const u = N.unknowns.find(x => x.id === c.unknown), op = u && (u.options || []).find(x => x.id === c.option); if (op) op.eliminated = true; }
    archive.push({ id: 'arc:' + c.candidate_id.slice(5), problem_id: M.problem_id, candidate_id: c.candidate_id, op: c.op, glyph: '⧀', claim: c.claim, claim_status: c.kind === 'eliminated' ? 'contradiction_exposed' : 'cold_stored', route: c.route,
      reason: c.route === 'rejected' ? 'gates failed: ' + c.gates.filter(g => !g.ok).map(g => g.gate).join(', ') : c.kind === 'eliminated' ? 'eliminated by an exact condition or zero likelihood' : c.kind === 'withdrawn' ? 'its option was eliminated' : c.kind === 'failed' ? 'the exact lane could not evaluate it' : 'shadow (exploration band or quarantine)',
      blocked_on: c.route === 'rejected' ? c.gates.filter(g => !g.ok).map(g => 'gate:' + g.gate) : c.kind === 'failed' ? ['capability:exact_lane'] : c.route === 'shadow' ? ['capability:projection'] : (c.needs || c.depends || []).map(n => 'value:' + n),
      eps_micro: c.terms.eps, novelty_micro: c.terms.N, anchors: (c.premises || []).filter(q => DISCHARGED.includes(q.tier)).map(q => q.ref), parent_hash: M.hash }); }
  const claims = mem.map(c => ({ id: c.candidate_id, text: c.claim, status: c.claim_status, kind: c.kind, favoured: !!c.favoured, rank: c.rank || null, likelihood: c.likelihood || null, next: c.required_next_action }));
  const withdrawn = (M.claims || []).filter(x => !claims.some(y => y.text === x.text && y.status === x.status)).map(x => ({ claim: x.text, status: x.status, receipt: 'wd:' + H(['mea-withdraw', M.hash, x.id]).slice(0, 24) }));
  /* ⧧ eligible splits become sub-manifests (lineage kept: goal_ancestry + the assumed option); stored sealed, never rendered by themselves */
  const children = []; for (const c of cy.candidates.filter(x => x.kind === 'split' && x.route === 'eligible' && cy.slates[x.unknown] && !cy.slates[x.unknown].favoured && cy.slates[x.unknown].ranking.length >= 2 /* only an undecided slate branches */ && splitNeeded(M, cy, x.unknown) /* 4.9.74 ruling 2 */)) for (const ch of c.children.filter(ch => tiedOptions(M, cy, c.unknown).includes(ch.problem_id.split('=').pop()))) { const opt = ch.problem_id.split('=').pop();
    const S = clone(M); delete S.hash; S.problem_id = ch.problem_id; S.sub_of = M.problem_id; S.goal_ancestry = ch.goal_ancestry; const u = S.unknowns.find(x => x.id === c.unknown); u.resolved_option = opt; u.assumed = true;
    S.claims = [{ id: c.candidate_id + ':' + opt, text: ch.assumption, status: 'hypothesis', kind: 'assumed_branch', next: 'test_required' }]; S.claim_status = 'hypothesis'; S.required_next_action = 'test_required';
    S.parent_hash = M.hash; S.output_permissions = 'sealed'; S.cycle = 0; S.operator_history = (M.operator_history || []).concat([{ operator_id: 'split', glyph: '⧧', parameters: { unknown: c.unknown, option: opt }, input_manifest_hash: M.hash, candidate_id: c.candidate_id, operator_family: 'O_gen' }]); S.hash = manifestHash(S); children.push(S); }
  claims.sort((a, b) => (a.rank || 1e9) - (b.rank || 1e9) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)); /* ranked order (lexicographic rank from the slate), then id */
  N.claims = claims; N.claim_status = r.claim_status; N.required_next_action = r.required_next_action; N.proof_debt_micro = r.terms.B;
  N.phase_state = 7; N.phase_path = (M.phase_path || [M.phase_state]).concat(path.slice(1)); N.parent_hash = M.hash; N.cycle = (M.cycle || 0) + 1; N.output_permissions = 'render_allowed'; N.breaker = { failed_cycles: 0 };
  N.hash = manifestHash(N);
  N.operator_history = (M.operator_history || []).concat([{ operator_id: 'merge', glyph: '⟁', parameters: { members: r.members }, input_manifest_hash: M.hash, candidate_id: r.candidate_id, operator_family: 'O_gen' }, { operator_id: 'seal', glyph: '⧙', parameters: { candidate: r.candidate_id }, input_manifest_hash: M.hash, operator_family: 'commit' }]);
  N.hash = manifestHash(N); for (const h of N.operator_history.slice(-2)) h.output_manifest_hash = N.hash; N.hash = manifestHash(N);
  const gate_report_hash = H(r.gates), receipt = { id: 'mear:' + H(['mea-commit', M.hash, r.candidate_id, N.hash]).slice(0, 24), parent_manifest_hash: M.hash, candidate_hash: r.candidate_id, gate_report_hash, manifest_hash: N.hash, rollback_to: M.hash, glyphs: '⟁⧙⧜' };
  return { ok: true, manifest: N, children, archive, withdrawn, receipt, phase_path: path }; }
/* a user-supplied value (follow-up) yields a DRAFT M' (not stored); the next cycle runs on it and only a tapped commit stores it */
function supply(M, unknownId, value) { const u = M.unknowns.find(x => x.id === unknownId); if (!u || u.kind === 'choice') return { ok: false, rule: 'MEA-NOT-A-VALUE-UNKNOWN' };
  const r = KM.computeExpr(String(value)); if (!r.ok || !r.exact) return { ok: false, rule: 'MEA-VALUE-NOT-EXACT' };
  const N = clone(M); delete N.hash; const v = N.unknowns.find(x => x.id === unknownId); v.value = r.value; N.known_facts.push({ id: 'v' + unknownId, text: u.text + ' = ' + r.value, tier: 'given', value: r.value, from: 'user' });
  N.parent_hash = M.hash; N.output_permissions = 'sealed'; N.hash = manifestHash(N); return { ok: true, manifest: N, capability: 'value:' + unknownId }; }
/* step 4 recursion: archived entries whose blocking reason names a capability that has now grown are re-queued — as PROPOSALS only */
function requeue(archive, capability) { const cap = String(capability); return (archive || []).filter(a => (a.blocked_on || []).some(b => b === cap || (/^kernel:/.test(cap) && /^capability:/.test(b)))).map(a => ({ archive_id: a.id, problem_id: a.problem_id, claim: a.claim, because: cap, proposal: 'rerun_cycle', route: 'proposal', adopt: false })); } /* ruling 5: proposals only */
/* 4.9.104: one cycle's candidates, screened for speech. DRIFT_TABLE (turnGovernance) and RSOC_STANDING decide the band and the standing.
   EDE novelty (N_min..N_max) decides whether a projectable claim may be spoken. A correction-band candidate is parked (χ only). Quarantine,
   hard stop, a failed gate, an over-extended novelty and a lineage operator (split / merge) are parked. Nothing here writes. */
function screen(M, cy) { const pool = (cy && cy.candidates) || [], hard = !!(cy && cy.stop && cy.stop.rule === 'MEA-DRIFT-EXCURSION'), speak = [], park = [];
  for (const c of pool) { const epsMicro = c.terms && Number.isInteger(c.terms.eps) ? c.terms.eps : 0, eps = epsMicro / MICRO, gov = KM.turnGovernance(eps, null);
    const nov = c.novelty_class || noveltyClass((c.terms && c.terms.N) || 0), B = c.terms ? c.terms.B : MICRO;
    const dims = { C: !!(cy && cy.ok !== false && !cy.rule), K: gov.route === 'project', S: B === 0 && (c.claim_status === 'derived_claim' || c.claim_status === 'verified_claim' || c.kind === 'established'), R: c.kind === 'eliminated' || c.claim_status === 'contradiction_exposed' };
    let standing = 'undetermined'; try { const s = KM.rsocStanding(dims); if (s && s.selected) standing = s.selected; } catch (e) { standing = 'undetermined'; }
    const spokenKind = c.kind === 'hypothesis' || c.kind === 'established' || c.kind === 'derived' || c.kind === 'conditional';
    if (!hard && c.route === 'eligible' && !c.quarantine && (c.op === 'hypothesize' || c.op === 'derive') && gov.route === 'project' && nov === 'bounded' && spokenKind) { speak.push({ candidate_id: c.candidate_id, op: c.op, claim: c.claim, claim_status: c.claim_status, kind: c.kind, eps, route: gov.route, novelty: nov, standing, dims }); continue; }
    let why, blocked; if (hard || gov.route === 'hard_stop') { why = 'hard stop: ε_s above 0.80'; blocked = ['band:hard_stop']; }
    else if (gov.route === 'correct') { why = 'correction band: χ only, not a proposal'; blocked = ['band:correct']; }
    else if (gov.route === 'quarantine' || gov.route === 'blocked_forbidden_transition') { why = 'quarantine band: not projectable'; blocked = ['band:quarantine']; }
    else if (c.route === 'rejected') { const failed = (c.gates || []).filter(g => !g.ok); why = 'gates failed: ' + failed.map(g => g.gate).join(', '); blocked = failed.length ? failed.map(g => 'gate:' + g.gate) : ['gate:rejected']; }
    else if (nov === 'overextended') { why = 'novelty above N_max'; blocked = ['novelty:overextended']; }
    else if (nov === 'recall_band' && c.claim_status !== 'recall') { why = 'recall is not a discovery'; blocked = ['novelty:recall']; }
    else if (c.op === 'split' || c.op === 'merge') { why = 'lineage operator; the options are the proposals'; blocked = ['operator:' + c.op]; }
    else if (c.quarantine || c.route === 'shadow' || c.route === 'archived') { why = 'shadow or quarantine'; blocked = ['capability:projection']; }
    else { why = 'not a spoken proposal'; blocked = ['park:not_spoken']; }
    park.push({ id: 'arc:' + String(c.candidate_id || '').slice(5), schema: 'MEAArchive/v1', problem_id: M.problem_id, candidate_id: c.candidate_id, op: c.op, glyph: '⧀', claim: c.claim, claim_status: c.route === 'rejected' ? 'rejected' : 'cold_stored', route: c.route, reason: why, blocked_on: blocked, eps_micro: epsMicro, novelty_micro: c.terms ? c.terms.N : 0, novelty_class: nov, standing, drift_route: gov.route, parent_hash: M.hash }); }
  speak.sort((a, b) => a.candidate_id < b.candidate_id ? -1 : a.candidate_id > b.candidate_id ? 1 : 0);
  return { schema: 'MEAProposalScreen/v1', problem_id: M.problem_id, parent_hash: M.hash, manifest_schema: SCHEMA, speak, park, cite: 'DRIFT_TABLE + RSOC_STANDING + EDE novelty' }; }
/* step 5: the typed hand-off to the RMC (R2.3: typed parameters, never a merged schema). Only a committed (render_allowed) manifest crosses. */
function handoff(M) { if (!M || M.output_permissions !== 'render_allowed' || M.phase_state !== 7) return { ok: false, rule: 'MEA-NOT-COMMITTED' };
  const cs = M.claims || [], pick = f => cs.filter(f).map(c => c.text);
  return { ok: true, params: { problem_id: M.problem_id, goal: M.goal, claim_status: M.claim_status, required_next_action: M.required_next_action, proof_debt_micro: M.proof_debt_micro,
    derived: pick(c => c.status === 'derived_claim' && c.kind !== 'established'), established: pick(c => c.kind === 'established'), conditional: pick(c => c.status === 'partial_resolution'),
    favoured: pick(c => c.favoured && c.status === 'hypothesis'), hypotheses: pick(c => (c.status === 'hypothesis' || c.status === 'speculative_branch') && c.kind !== 'derived'),
    eliminated: M.unknowns.flatMap(u => (u.options || []).filter(o => o.eliminated).map(o => o.text)), open: unknownVector(M).filter(x => !x.resolved).map(x => x.text), manifest_hash: M.hash } }; }
const api = { opCost, SCHEMA, CSCHEMA, VERSION, MICRO, CLAIM_STATUS, NEXT_ACTIONS, GAP_TYPES, TIERS, DISCHARGED, OPERATORS, LEX_ORDER, DEFAULT_BUDGET, canon, manifestHash, normalize, validate, unknownVector, exact, condHolds,
  generate, replay, candHash, tiedOptions, splitNeeded, terms, classify, gates, dominates, rank, cycle, commit, supply, requeue, handoff, screen, displayScore };
if (isNode) module.exports = api; else root.KMEAP = api;
})(typeof self !== 'undefined' ? self : this);
