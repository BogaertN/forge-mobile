/* mea.js — M5 (4.9.64; step 0 fixes 4.9.65: inverse-pair units + legality gate, no-evidence route, integer drift, rng lineage) MEA manifest evolution. A MANIFEST is data: a list of property deltas { pred, prop, value } over the relation rows of
   world_rules.js (rules as data; only the yes/no properties in WR.MEA_MUTABLE). Manifests vary by deterministic, seeded operators on top of the
   evolve.js idea (rules are hypotheses until a user tap):
     FLIP       toggle one mutable property of one row (seeded choice)
     RECOMBINE  uniform crossover of two parent manifests, cell by cell (seeded)
   Fitness is never a weighted sum. A candidate is judged by the verifier's own suites (held-out set, metamorphic mutation set, world-state
   suite) run with the manifest active (tools/mea_eval.js, node only): pass counts, regressions against the shipped rows, Echo passes.
   Ranking is Pareto (non-dominated on passed ↑, regressions ↓, echo ↑, ε_s ↓) then lexicographic in that order, then id.
   Drift ε_s = (σ_res + D_score + |ΔΦ|)/3 (the evolve.js / ede.js formula): σ_res = share of evaluated cases whose outcome changed against the
   shipped rows, D_score = share of mutable cells changed, |ΔΦ| = 0. Route by the drift ruling (kmath.driftGovernance): ε_s ≤ 0.35 and no
   regression → approvable (still only by a user tap); 0.35 < ε_s < 0.40 → held for correction (not adoptable as is); 0.40–0.80 → shadow
   only (quarantine-only exploration, never adoptable); > 0.80 → rejected. One table: kmath.DRIFT_TABLE (CONFLICTS.md v4.9.66).
   Candidates are proposals: nothing here changes behaviour; kernel.adoptManifest (user tap, M2 justification, receipt) does. */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports;
const WR = isNode ? require('./world_rules.js') : root.KWorldRules, KM = isNode ? require('./kmath.js') : root.KMath, { sha256 } = isNode ? require('./sha256.js') : root.KSha;
const SCHEMA = 'FORGE-MEA-MANIFEST/v1';
const canon = x => { if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']'; if (x && typeof x === 'object') return '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canon(x[k])).join(',') + '}'; return JSON.stringify(x === undefined ? null : x); };
/* the evolvable rows: declared relations that are not comparatives (their order rules come from the construction) and not functional */
const rows = () => WR.RELATIONS.filter(r => !/_than$/.test(r.pred) && !r.functional && !r.alias && !r.same_as && !r.causal).map(r => r.pred);
const rowOf = p => WR.RELATIONS.find(r => r.pred === p) || {};
const baseVal = (pred, prop) => !!rowOf(pred)[prop];
/* 4.9.65 ruling (Nic): cells that are NOT evolvable, with the reason (data) — sibling_of stays non-transitive (half-siblings) */
const IMMUTABLE = Object.freeze([{ pred: 'sibling_of', prop: 'transitive', why: 'ruling 4.9.65: half-siblings make "sibling of" non-transitive; not a mutable cell' }]);
const immutable = (p, prop) => IMMUTABLE.some(x => x.pred === p && x.prop === prop);
/* 4.9.71: the declared inverse of a row (any row, evolvable or not). An inverse pair whose partner is NOT evolvable (e.g. contain ↔ the functional
   'in' row, after ruling 2 made inside/within aliases of 'in') cannot move without a one-sided change, so its cells are not mutable; the legality gate
   checks pair agreement against the partner's shipped value either way */
const pairOf = p => { const q = rowOf(p).inverse; return q && q !== p && WR.RELATIONS.some(r => r.pred === q) ? q : null; };
const frozenByPair = p => { const q = pairOf(p); return !!q && !rows().includes(q); };
const cells = () => rows().filter(p => !frozenByPair(p)).flatMap(p => WR.MEA_MUTABLE.filter(prop => !immutable(p, prop)).map(prop => [p, prop]));
/* 4.9.65 ruling (Nic): an inverse pair (inside/contain, before/after, …) is ONE evolvable unit — a FLIP changes the property on both sides */
const partner = p => { const q = rowOf(p).inverse; return q && q !== p && rows().includes(q) ? q : null; };
const units = () => { const seen = new Set(), out = []; for (const [p, prop] of cells()) { const q = partner(p), preds = q ? [p, q].sort() : [p], k = preds.join('+') + '|' + prop; if (!seen.has(k)) { seen.add(k); out.push({ preds, prop }); } } return out; };
const norm = ds => { const m = new Map(); for (const d of ds) m.set(d.pred + '|' + d.prop, d); return [...m.values()].filter(d => !!d.value !== baseVal(d.pred, d.prop)).map(d => ({ pred: d.pred, prop: d.prop, value: !!d.value })).sort((a, b) => (a.pred + a.prop).localeCompare(b.pred + b.prop)); };
const idOf = ds => 'mea:' + sha256(canon([SCHEMA, norm(ds)])).slice(0, 16);
const valIn = (ds, pred, prop) => { const d = ds.find(x => x.pred === pred && x.prop === prop); return d ? !!d.value : baseVal(pred, prop); };
/* LEGALITY GATE (a hard gate, not a weight): inverse partners must agree on transitivity and on symmetry; a relation with a DISTINCT inverse cannot
   be symmetric (symmetry makes a relation its own inverse); an immutable cell cannot change; only declared rows and properties */
function legality(ds) { const v = [], ks = new Set();
  for (const d of ds) { if (!rows().includes(d.pred) || !WR.MEA_MUTABLE.includes(d.prop)) v.push('MEA-ILLEGAL-CELL:' + d.pred + '.' + d.prop); else if (immutable(d.pred, d.prop) && !!d.value !== baseVal(d.pred, d.prop)) v.push('MEA-IMMUTABLE-CELL:' + d.pred + '.' + d.prop); }
  for (const d of ds) { const q = pairOf(d.pred); if (q) for (const prop of WR.MEA_MUTABLE) { const k = [d.pred, q].sort().join('+') + '|' + prop; if (!ks.has(k) && valIn(ds, d.pred, prop) !== valIn(ds, q, prop)) { ks.add(k); v.push('MEA-INVERSE-PAIR-INCONSISTENT:' + [d.pred, q].sort().join('/') + '.' + prop); } }
    if (q && valIn(ds, d.pred, 'symmetric')) v.push('MEA-SYMMETRIC-WITH-DISTINCT-INVERSE:' + d.pred); }
  return [...new Set(v)].sort(); }
/* xorshift32; the state is an integer and is recorded in each candidate's lineage, so any candidate is replayed from (state, op, parents) */
function rng(seed) { let x = (seed >>> 0) || 1; const r = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; r.state = () => x >>> 0; return r; }
const OPS = {
  FLIP: (a, r) => { const us = units(), u = us[Math.floor(r() * us.length)], value = !valIn(a, u.preds[0], u.prop); return norm(a.concat(u.preds.map(pred => ({ pred, prop: u.prop, value })))); },
  RECOMBINE: (a, b, r) => { const key = d => { const q = partner(d.pred); return (q ? [d.pred, q].sort().join('+') : d.pred) + '|' + d.prop; }, keys = [...new Set(a.concat(b).map(key))].sort();
    return norm([].concat(...keys.map(k => { const [ps, prop] = k.split('|'), preds = ps.split('+'), src = r() < 0.5 ? a : b; return preds.map(pred => ({ pred, prop, value: valIn(src, pred, prop) })); }))); } };
/* deterministic proposals: generation 1 flips the base; later generations flip or recombine earlier candidates; duplicates and the base are dropped.
   lineage = { generation, op, parents, seed, rng_state } where rng_state is the generator state immediately before the operator ran */
function propose(o) { o = Object.assign({ seed: 1, n: 8, generations: 2 }, o || {}); const r = rng(o.seed), pop = [], seen = new Set([idOf([])]);
  const add = (deltas, op, parents, g, st) => { const id = idOf(deltas); if (seen.has(id) || !deltas.length) return; seen.add(id); pop.push({ schema: SCHEMA, id, deltas, op, parents, lineage: { generation: g + 1, op, parents, seed: o.seed >>> 0, rng_state: st } }); };
  for (let g = 0; g < o.generations && pop.length < o.n; g++) { const prev = pop.slice(); const cap = Math.ceil(o.n * (g + 1) / o.generations); for (let i = 0; i < o.n * 4 && pop.length < cap; i++) {
    if (g > 0 && prev.length >= 2 && i % 2 === 1) { const a = prev[Math.floor(r() * prev.length)], b = prev[Math.floor(r() * prev.length)]; if (a !== b) { const st = r.state(); add(OPS.RECOMBINE(a.deltas, b.deltas, r), 'RECOMBINE', [a.id, b.id], g, st); } }
    else { const a = g > 0 && prev.length ? prev[Math.floor(r() * prev.length)] : { id: null, deltas: [] }, st = r.state(); add(OPS.FLIP(a.deltas, r), 'FLIP', a.id ? [a.id] : [], g, st); } } }
  return pop.slice(0, o.n); }
/* replay one candidate from its lineage (the parents' deltas + the recorded generator state) */
const replay = (c, parentDeltas) => OPS[c.lineage.op](...(c.lineage.op === 'RECOMBINE' ? [parentDeltas[0], parentDeltas[1]] : [parentDeltas[0] || []]), rng(c.lineage.rng_state));
/* fitness from two outcome maps (case id → pass) for the shipped rows (base) and the candidate, plus Echo pass counts. Drift is kept in INTEGER
   micro-units (1e-6), computed exactly from the counts (floor): ε_s = (σ_res + D_score + |ΔΦ|)/3 with |ΔΦ| = 0. Routes (gates first, no weights):
   illegal → rejected; no case changed outcome → no_evidence (passing tests is not evidence; never approvable); 0 regressions and ε_s ≤ 0.35 →
   approvable (only by a user tap); explore band → shadow; correct band → held; otherwise rejected. */
const MICRO = 1000000;
function fitness(cand, base, out, echo) { const ids = Object.keys(base).sort(), n = ids.length, passed = ids.filter(k => out[k]).length, regressions = ids.filter(k => base[k] && !out[k]).length, changed = ids.filter(k => !!base[k] !== !!out[k]).length;
  const nc = cells().length, dc = norm(cand.deltas).length, sigma = n ? Math.floor(changed * MICRO / n) : 0, D = Math.floor(dc * MICRO / nc), eps = n ? Math.floor((changed * nc + dc * n) * MICRO / (3 * n * nc)) : Math.floor(D / 3);
  const g = KM.driftGovernance(eps / MICRO), legal = legality(cand.deltas), evidence = changed > 0 ? 'changed_outcomes' : 'none';
  const route = legal.length ? 'rejected' : evidence === 'none' ? 'no_evidence' : regressions === 0 && g.band === 'projectable' ? 'approvable' : g.band === 'explore' ? 'shadow' : g.band === 'correct' ? 'held' : 'rejected';
  return { cases: n, passed, regressions, gained: ids.filter(k => !base[k] && out[k]).length, changed, echo: echo || 0, evidence, legality: legal, drift: { unit: 'micro (1e-6)', eps_s_micro: eps, sigma_res_micro: sigma, D_score_micro: D, dPhi_micro: 0, band: g.band }, route }; }
const dominates = (a, b) => { const x = a.fitness, y = b.fitness, ge = x.passed >= y.passed && x.regressions <= y.regressions && x.echo >= y.echo && x.drift.eps_s_micro <= y.drift.eps_s_micro;
  return ge && (x.passed > y.passed || x.regressions < y.regressions || x.echo > y.echo || x.drift.eps_s_micro < y.drift.eps_s_micro); };
function rank(cands) { const cs = cands.map(c => Object.assign({}, c, { pareto: !cands.some(o => o !== c && dominates(o, c)) }));
  return cs.sort((a, b) => (b.pareto - a.pareto) || (a.fitness.regressions - b.fitness.regressions) || (b.fitness.passed - a.fitness.passed) || (b.fitness.echo - a.fitness.echo) || (a.fitness.drift.eps_s_micro - b.fitness.drift.eps_s_micro) || a.id.localeCompare(b.id)); }
const describe = c => c.deltas.map(d => (d.value ? 'make ' : 'unmake ') + d.pred.replace(/_/g, ' ') + ' ' + d.prop).join('; ');
const api = { SCHEMA, MICRO, IMMUTABLE, rows, cells, units, partner, pairOf, legality, norm, idOf, rng, OPS, propose, replay, fitness, rank, dominates, describe, canon };
if (isNode) module.exports = api; else root.KMEA = api;
})(typeof self !== 'undefined' ? self : this);
