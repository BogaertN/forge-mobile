/* mea.js — M5 (4.9.64) MEA manifest evolution. A MANIFEST is data: a list of property deltas { pred, prop, value } over the relation rows of
   world_rules.js (rules as data; only the yes/no properties in WR.MEA_MUTABLE). Manifests vary by deterministic, seeded operators on top of the
   evolve.js idea (rules are hypotheses until a user tap):
     FLIP       toggle one mutable property of one row (seeded choice)
     RECOMBINE  uniform crossover of two parent manifests, cell by cell (seeded)
   Fitness is never a weighted sum. A candidate is judged by the verifier's own suites (held-out set, metamorphic mutation set, world-state
   suite) run with the manifest active (tools/mea_eval.js, node only): pass counts, regressions against the shipped rows, Echo passes.
   Ranking is Pareto (non-dominated on passed ↑, regressions ↓, echo ↑, ε_s ↓) then lexicographic in that order, then id.
   Drift ε_s = (σ_res + D_score + |ΔΦ|)/3 (the evolve.js / ede.js formula): σ_res = share of evaluated cases whose outcome changed against the
   shipped rows, D_score = share of mutable cells changed, |ΔΦ| = 0. Route by the drift ruling (kmath.driftGovernance): ε_s ≤ 0.35 and no
   regression → approvable (still only by a user tap); 0.4–0.8 → shadow only (explored, never adoptable); else held / rejected.
   Candidates are proposals: nothing here changes behaviour; kernel.adoptManifest (user tap, M2 justification, receipt) does. */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports;
const WR = isNode ? require('./world_rules.js') : root.KWorldRules, KM = isNode ? require('./kmath.js') : root.KMath, { sha256 } = isNode ? require('./sha256.js') : root.KSha;
const SCHEMA = 'FORGE-MEA-MANIFEST/v1';
const canon = x => { if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']'; if (x && typeof x === 'object') return '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canon(x[k])).join(',') + '}'; return JSON.stringify(x === undefined ? null : x); };
/* the evolvable rows: declared relations that are not comparatives (their order rules come from the construction) and not functional */
const rows = () => WR.RELATIONS.filter(r => !/_than$/.test(r.pred) && !r.functional && !r.alias).map(r => r.pred);
const baseVal = (pred, prop) => !!(WR.RELATIONS.find(r => r.pred === pred) || {})[prop];
const cells = () => rows().flatMap(p => WR.MEA_MUTABLE.map(prop => [p, prop]));
const norm = ds => { const m = new Map(); for (const d of ds) m.set(d.pred + '|' + d.prop, d); return [...m.values()].filter(d => !!d.value !== baseVal(d.pred, d.prop)).map(d => ({ pred: d.pred, prop: d.prop, value: !!d.value })).sort((a, b) => (a.pred + a.prop).localeCompare(b.pred + b.prop)); };
const idOf = ds => 'mea:' + sha256(canon([SCHEMA, norm(ds)])).slice(0, 16);
const valIn = (ds, pred, prop) => { const d = ds.find(x => x.pred === pred && x.prop === prop); return d ? d.value : baseVal(pred, prop); };
function rng(seed) { let x = (seed >>> 0) || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
const OPS = {
  FLIP: (a, r) => { const cs = cells(), [pred, prop] = cs[Math.floor(r() * cs.length)]; return norm(a.concat([{ pred, prop, value: !valIn(a, pred, prop) }])); },
  RECOMBINE: (a, b, r) => { const keys = [...new Set(a.concat(b).map(d => d.pred + '|' + d.prop))].sort(); return norm(keys.map(k => { const [pred, prop] = k.split('|'); return { pred, prop, value: r() < 0.5 ? valIn(a, pred, prop) : valIn(b, pred, prop) }; })); } };
/* deterministic proposals: generation 1 flips the base; later generations flip or recombine earlier candidates; duplicates and the base are dropped */
function propose(o) { o = Object.assign({ seed: 1, n: 8, generations: 2 }, o || {}); const r = rng(o.seed), pop = [], seen = new Set([idOf([])]);
  const add = (deltas, op, parents) => { const id = idOf(deltas); if (seen.has(id) || !deltas.length) return; seen.add(id); pop.push({ schema: SCHEMA, id, deltas, op, parents }); };
  for (let g = 0; g < o.generations && pop.length < o.n; g++) { const prev = pop.slice(); const cap = Math.ceil(o.n * (g + 1) / o.generations); for (let i = 0; i < o.n * 4 && pop.length < cap; i++) {
    if (g > 0 && prev.length >= 2 && i % 2 === 1) { const a = prev[Math.floor(r() * prev.length)], b = prev[Math.floor(r() * prev.length)]; if (a !== b) add(OPS.RECOMBINE(a.deltas, b.deltas, r), 'RECOMBINE', [a.id, b.id]); }
    else { const a = g > 0 && prev.length ? prev[Math.floor(r() * prev.length)] : { id: null, deltas: [] }; add(OPS.FLIP(a.deltas, r), 'FLIP', a.id ? [a.id] : []); } } }
  return pop.slice(0, o.n); }
/* fitness from two outcome maps (case id → pass) for the shipped rows (base) and the candidate, plus Echo pass counts */
function fitness(cand, base, out, echo) { const ids = Object.keys(base).sort(), passed = ids.filter(k => out[k]).length, regressions = ids.filter(k => base[k] && !out[k]).length, changed = ids.filter(k => !!base[k] !== !!out[k]).length;
  const sigma = ids.length ? changed / ids.length : 0, D = cand.deltas.length / Math.max(1, cells().length), eps = (sigma + D + 0) / 3, g = KM.driftGovernance(eps);
  const route = regressions === 0 && g.band === 'projectable' ? 'approvable' : g.band === 'explore' ? 'shadow' : g.band === 'correct' ? 'held' : 'rejected';
  return { cases: ids.length, passed, regressions, gained: ids.filter(k => !base[k] && out[k]).length, echo: echo || 0, drift: { eps_s: g.eps_s, band: g.band, sigma_res: KM.r4(sigma), D_score: KM.r4(D), dPhi: 0 }, route }; }
const dominates = (a, b) => { const x = a.fitness, y = b.fitness, ge = x.passed >= y.passed && x.regressions <= y.regressions && x.echo >= y.echo && x.drift.eps_s <= y.drift.eps_s;
  return ge && (x.passed > y.passed || x.regressions < y.regressions || x.echo > y.echo || x.drift.eps_s < y.drift.eps_s); };
function rank(cands) { const cs = cands.map(c => Object.assign({}, c, { pareto: !cands.some(o => o !== c && dominates(o, c)) }));
  return cs.sort((a, b) => (b.pareto - a.pareto) || (a.fitness.regressions - b.fitness.regressions) || (b.fitness.passed - a.fitness.passed) || (b.fitness.echo - a.fitness.echo) || (a.fitness.drift.eps_s - b.fitness.drift.eps_s) || a.id.localeCompare(b.id)); }
const describe = c => c.deltas.map(d => (d.value ? 'make ' : 'unmake ') + d.pred.replace(/_/g, ' ') + ' ' + d.prop).join('; ');
const api = { SCHEMA, rows, cells, norm, idOf, rng, OPS, propose, fitness, rank, dominates, describe, canon };
if (isNode) module.exports = api; else root.KMEA = api;
})(typeof self !== 'undefined' ? self : this);
