/* mea_k.js — 4.9.75 MEA build-plan step 6 (MEA_SPEC §e): MEA-K widened beyond relation properties. Frames, lexicon classes and parser-rule DATA
   are evolvable as typed delta families, each with a DECLARED mutable-cell set (data/mea_k_cells.json, generated mechanically by
   tools/mea_k_cells.js from the shipped tables and the WordNet taxonomy — no hand-picked words, no test vocabulary):
     lexclass  { fam:'lexclass', row: FEMALE|MALE, key: noun, value: bool }          pronoun-gender lexicon classes
     frame     { fam:'frame', row:'ADJ_INF', key: adjective, value: subj|karma|both }  the kāraka the subject of "ADJ to V" fills
               { fam:'frame', row: bareinf|objinf, key: verb, value: bool }          complement frames WordNet omits (FRAME_SUPP)
     parser    { fam:'parser', row: PREP|SUB|ADV|PART, key: word, value: bool }       membership of the OPEN function categories
   Hard gates (legality; never weights):
     · only declared cells, typed values; FEMALE ∧ MALE never both true for one noun (gender consistency)
     · STRUCTURE DEPENDENCE (Nic's Chomsky ruling): a parser delta may only touch an open category; a word that heads a closed functional category
       (COP AUX MOD WH NEG DET …) can never gain or lose a category; no category may be emptied. Rules stay category-based, so every grammar
       change is a vocabulary change — no rule keyed to word order or a sentence can be produced. The structure-dependence guard suite
       (verify/structure_guard_suite.js) must pass in full for any candidate (tools/mea_k_eval.js).
   Operators (deterministic, seeded, content-addressed; budget = n): GROW (add one pool word: vocabulary growth, preferred), FLIP (toggle / re-type
   one declared cell), RECOMBINE (cells only from the two parents). Fitness, routes and ranking are those of mea.js (counts only; Pareto then
   lexicographic, then fewer removals — the declared vocabulary-growth preference —, then id). Approvable iff legal, a non-vacuous evidence delta,
   0 regressions, ε_s ≤ 0.35 and the structure guard intact; adoption only by user tap (kernel.adoptManifestK). */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports;
const G = isNode ? require('./grammar.js') : root.KGrammar, MEA = isNode ? require('./mea.js') : root.KMEA, { sha256 } = isNode ? require('./sha256.js') : root.KSha;
const CELLS = isNode ? JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'data', 'mea_k_cells.json'), 'utf8')) : ((root.KMEAKData || {}).cells || null);
const SCHEMA = 'FORGE-MEA-K-MANIFEST/v1', FAMS = ['lexclass', 'frame', 'parser'], canon = MEA.canon;
/* base snapshot of every mutable table, taken once at load (apply() always restores it first) */
const BASE = { FEMALE: new Set(G.FEMALE), MALE: new Set(G.MALE), ADJ_INF: Object.assign({}, G.ADJ_INF), SUPP: { bareinf: new Set(G.FRAME_SUPP.bareinf), objinf: new Set(G.FRAME_SUPP.objinf) },
  CL: Object.fromEntries(Object.keys(G.CL).map(w => [w, G.CL[w].slice()])), CLOSED: Object.assign({}, G.CLOSED) };
const IMMUTABLE_CATS = CELLS ? CELLS.immutable_categories : [];
let POOL_CAP = null; /* MEA-K meta pool_cap (mutable-cell set size): growth pools use their first POOL_CAP words; null = the declared cap */
const setPoolCap = k => { POOL_CAP = Number.isInteger(k) && k >= 1 ? k : null; };
function cells() { if (!CELLS) return []; const out = []; const cap = xs => (POOL_CAP ? xs.slice(0, POOL_CAP) : xs);
  for (const [row, c] of Object.entries(CELLS.lexclass)) for (const key of c.members.concat(cap(c.pool))) out.push({ fam: 'lexclass', row, key, type: 'bool', growth: c.pool.includes(key) });
  for (const key of CELLS.frame.ADJ_INF.entries) out.push({ fam: 'frame', row: 'ADJ_INF', key, type: 'role', values: CELLS.frame.ADJ_INF.values, growth: false });
  for (const [row, c] of Object.entries(CELLS.frame.FRAME_SUPP)) for (const key of c.members.concat(cap(c.pool))) out.push({ fam: 'frame', row, key, type: 'bool', growth: c.pool.includes(key) });
  for (const [row, c] of Object.entries(CELLS.parser)) for (const key of c.members.concat(cap(c.pool))) out.push({ fam: 'parser', row, key, type: 'bool', growth: c.pool.includes(key) });
  return out; }
const cellOf = d => cells().find(c => c.fam === d.fam && c.row === d.row && c.key === d.key);
function baseVal(d) { if (d.fam === 'lexclass') return BASE[d.row].has(d.key); if (d.fam === 'frame') return d.row === 'ADJ_INF' ? (BASE.ADJ_INF[d.key] || null) : BASE.SUPP[d.row].has(d.key);
  if (d.fam === 'parser') return (BASE.CL[d.key] || []).includes(d.row); return undefined; }
const kOf = d => d.fam + '|' + d.row + '|' + d.key;
const norm = ds => { const m = new Map(); for (const d of ds) m.set(kOf(d), { fam: d.fam, row: d.row, key: d.key, value: d.value }); return [...m.values()].filter(d => d.value !== baseVal(d)).sort((a, b) => kOf(a).localeCompare(kOf(b))); };
const idOf = ds => 'meak:' + sha256(canon([SCHEMA, norm(ds)])).slice(0, 16);
const valIn = (ds, d) => { const x = ds.find(y => kOf(y) === kOf(d)); return x ? x.value : baseVal(d); };
function legality(ds) { const v = [];
  for (const d of ds) { const c = cellOf(d); if (!FAMS.includes(d.fam) || !c) { v.push('MEAK-ILLEGAL-CELL:' + kOf(d)); continue; }
    if (c.type === 'bool' && typeof d.value !== 'boolean') v.push('MEAK-TYPE:' + kOf(d)); if (c.type === 'role' && !c.values.includes(d.value)) v.push('MEAK-TYPE:' + kOf(d));
    if (d.fam === 'lexclass' && d.value === true && valIn(ds, { fam: 'lexclass', row: d.row === 'FEMALE' ? 'MALE' : 'FEMALE', key: d.key })) v.push('MEAK-GENDER-INCONSISTENT:' + d.key);
    if (d.fam === 'parser') { if (IMMUTABLE_CATS.includes(d.row)) v.push('MEAK-STRUCTURE-CLOSED-CATEGORY:' + d.row); if ((BASE.CL[d.key] || []).some(t => IMMUTABLE_CATS.includes(t))) v.push('MEAK-STRUCTURE-FUNCTIONAL-HEAD:' + d.key); } }
  for (const row of CELLS ? Object.keys(CELLS.parser) : []) { const left = CELLS.parser[row].members.concat(CELLS.parser[row].pool).filter(w => valIn(ds, { fam: 'parser', row, key: w })); if (!left.length) v.push('MEAK-EMPTY-CATEGORY:' + row); }
  return [...new Set(v)].sort(); }
/* install a manifest into the live grammar tables (always from the base snapshot; apply(null) restores the shipped tables) */
function apply(ds) { const D = norm(ds || []);
  for (const cls of ['FEMALE', 'MALE']) { G[cls].clear(); for (const w of BASE[cls]) G[cls].add(w); }
  for (const k of Object.keys(G.ADJ_INF)) delete G.ADJ_INF[k]; Object.assign(G.ADJ_INF, BASE.ADJ_INF);
  for (const kind of ['bareinf', 'objinf']) { G.FRAME_SUPP[kind].clear(); for (const w of BASE.SUPP[kind]) G.FRAME_SUPP[kind].add(w); }
  for (const w of Object.keys(G.CL)) if (!BASE.CL[w]) delete G.CL[w]; for (const [w, ts] of Object.entries(BASE.CL)) G.CL[w] = ts.slice(); Object.assign(G.CLOSED, BASE.CLOSED);
  for (const d of D) { if (d.fam === 'lexclass') { if (d.value) G[d.row].add(d.key); else G[d.row].delete(d.key); }
    else if (d.fam === 'frame') { if (d.row === 'ADJ_INF') G.ADJ_INF[d.key] = d.value; else if (d.value) G.FRAME_SUPP[d.row].add(d.key); else G.FRAME_SUPP[d.row].delete(d.key); }
    else if (d.fam === 'parser') { const ts = (G.CL[d.key] || []).filter(t => t !== d.row); if (d.value) ts.push(d.row); if (ts.length) G.CL[d.key] = ts; else delete G.CL[d.key];
      const ws = G.CLOSED[d.row].split(' ').filter(w => w !== d.key); if (d.value) ws.push(d.key); G.CLOSED[d.row] = ws.join(' '); } }
  return D.length; }
const flipVal = (c, cur, r) => c.type === 'bool' ? !cur : (() => { const alt = c.values.filter(x => x !== cur); return alt[Math.floor(r() * alt.length)]; })();
const OPS = {
  GROW: (a, r) => { const pool = cells().filter(c => c.growth && !valIn(a, c)); if (!pool.length) return norm(a); const c = pool[Math.floor(r() * pool.length)]; return norm(a.concat([{ fam: c.fam, row: c.row, key: c.key, value: true }])); },
  FLIP: (a, r) => { const cs = cells(), c = cs[Math.floor(r() * cs.length)]; return norm(a.concat([{ fam: c.fam, row: c.row, key: c.key, value: flipVal(c, valIn(a, c), r) }])); },
  RECOMBINE: (a, b, r) => { const keys = [...new Set(a.concat(b).map(kOf))].sort(); return norm(keys.map(k => { const src = r() < 0.5 ? a : b, [fam, row, key] = k.split('|'); return { fam, row, key, value: valIn(src, { fam, row, key }) }; })); } };
/* deterministic proposals over all three families: generation 1 alternates GROW (vocabulary growth, preferred) and FLIP; later generations
   GROW/FLIP an earlier candidate or RECOMBINE two; duplicates, the base and illegal drafts stay in the population (judged and routed rejected) */
function propose(o) { o = Object.assign({ seed: 1, n: 12, generations: 2 }, o || {}); const r = MEA.rng(o.seed), pop = [], seen = new Set([idOf([])]);
  const add = (deltas, op, parents, g, st) => { const id = idOf(deltas); if (seen.has(id) || !deltas.length) return; seen.add(id); pop.push({ schema: SCHEMA, id, deltas, op, parents, families: [...new Set(deltas.map(d => d.fam))].sort(), lineage: { generation: g + 1, op, parents, seed: o.seed >>> 0, rng_state: st } }); };
  for (let g = 0; g < o.generations && pop.length < o.n; g++) { const prev = pop.slice(), cap = Math.ceil(o.n * (g + 1) / o.generations);
    for (let i = 0; i < o.n * 6 && pop.length < cap; i++) { /* the rng state is recorded AFTER the parents are drawn, so replay(op, parents, state) re-derives the child exactly */
      if (g > 0 && prev.length >= 2 && i % 3 === 2) { const a = prev[Math.floor(r() * prev.length)], b = prev[Math.floor(r() * prev.length)], st = r.state(); if (a !== b) add(OPS.RECOMBINE(a.deltas, b.deltas, r), 'RECOMBINE', [a.id, b.id], g, st); }
      else { const a = g > 0 && prev.length ? prev[Math.floor(r() * prev.length)] : { id: null, deltas: [] }, op = i % 2 === 0 ? 'GROW' : 'FLIP', st = r.state(); add(OPS[op](a.deltas, r), op, a.id ? [a.id] : [], g, st); } } }
  return pop.slice(0, o.n); }
const replay = (c, parentDeltas) => OPS[c.lineage.op](...(c.lineage.op === 'RECOMBINE' ? [parentDeltas[0], parentDeltas[1]] : [parentDeltas[0] || []]), MEA.rng(c.lineage.rng_state));
/* fitness: mea.js counts + routes, with this family's legality and the structure guard as a hard gate (any structure-guard regression → rejected) */
function fitness(cand, base, out, echo, guardKeys) { const legal = legality(cand.deltas), shim = Object.assign({}, cand, { deltas: [] }), f = MEA.fitness(shim, base, out, echo);
  const nc = cells().length, dc = norm(cand.deltas).length, n = f.cases, changed = f.changed, eps = n ? Math.floor((changed * nc + dc * n) * MEA.MICRO / (3 * n * nc)) : 0, band = (isNode ? require('./kmath.js') : root.KMath).driftGovernance(eps / MEA.MICRO).band;
  const structureBroken = (guardKeys || []).filter(k => base[k] && !out[k]).length, removals = norm(cand.deltas).filter(d => d.value === false).length;
  const route = legal.length || structureBroken ? 'rejected' : f.evidence === 'none' ? 'no_evidence' : f.regressions === 0 && band === 'projectable' ? 'approvable' : band === 'explore' ? 'shadow' : band === 'correct' ? 'held' : 'rejected';
  return Object.assign(f, { legality: legal, structure_guard_regressions: structureBroken, removals, drift: Object.assign({}, f.drift, { eps_s_micro: eps, D_score_micro: Math.floor(dc * MEA.MICRO / nc), band }), route }); }
function rank(cands) { const ranked = MEA.rank(cands); return ranked.map((c, i) => c).sort((a, b) => (b.pareto - a.pareto) || (a.fitness.regressions - b.fitness.regressions) || (b.fitness.passed - a.fitness.passed) || (b.fitness.echo - a.fitness.echo) || (a.fitness.drift.eps_s_micro - b.fitness.drift.eps_s_micro) || (a.fitness.removals - b.fitness.removals) || a.id.localeCompare(b.id)); }
const describe = c => norm(c.deltas).map(d => d.fam === 'frame' && d.row === 'ADJ_INF' ? '"' + d.key + ' to V": subject fills ' + d.value : (d.value ? 'add "' : 'remove "') + d.key + '" ' + (d.value ? 'to ' : 'from ') + (d.fam === 'lexclass' ? d.row.toLowerCase() + ' nouns' : d.fam === 'frame' ? d.row + ' frame verbs' : d.row + ' (parser category)')).join('; ');
/* META family (4.9.74, MEA build-plan step 7): MEA-K may evolve MEA's OWN data — the MEA-P budget, operator schedule and operator cost schedule, the
   MEA-K proposal budget (n, generations) and the size of the growth pools (mutable-cell sets). Typed, declared values only. IMMUTABLE (no cell
   exists, any attempt is illegal): the gates, the lexicographic order, the drift ruling 0.35 / 0.40 / 0.80, the routes, legality and the guards.
   Judged on counts like every manifest: cases are per-problem MEA-P outcomes and the approvable MEA-K candidates the settings find. */
const META = [{ row: 'MEAP', key: 'budget', values: [16, 32, 64, 128], base: 64 }, { row: 'MEAP', key: 'order', values: ['derive_first', 'choice_first'], base: 'derive_first' },
  ...['derive', 'hypothesize', 'split', 'merge'].map(op => ({ row: 'MEAP', key: 'cost:' + op, values: [1, 2, 3], base: 1 })),
  { row: 'MEAK', key: 'n', values: [8, 12, 16], base: 12 }, { row: 'MEAK', key: 'generations', values: [1, 2, 3], base: 2 }, { row: 'MEAK', key: 'pool_cap', values: [4, 8], base: 8 }];
const META_IMMUTABLE = ['gates (REPLAY TAMPER LEGALITY EVIDENCE PHASE DRIFT CLAIM I_ZERO NOVELTY BUDGET)', 'lexicographic order B↓ L↑ Ω↑ I↑ A↑ ε↓ K↓', 'drift ruling 0.35 / 0.40 / 0.80', 'routes', 'legality', 'meaning and structure guards'];
const metaCell = d => META.find(c => c.row === d.row && c.key === d.key);
const metaNorm = ds => { const m = new Map(); for (const d of ds || []) m.set(d.row + '|' + d.key, { fam: 'meta', row: d.row, key: d.key, value: d.value }); return [...m.values()].filter(d => { const c = metaCell(d); return !c || d.value !== c.base; }).sort((a, b) => (a.row + '|' + a.key).localeCompare(b.row + '|' + b.key)); };
const metaId = ds => 'meta:' + sha256(canon(['FORGE-MEA-META/v1', metaNorm(ds)])).slice(0, 16);
function metaLegality(ds) { const v = []; for (const d of ds || []) { const c = metaCell(d); if (d.fam !== 'meta' || !c) v.push('MEAK-META-IMMUTABLE:' + d.row + '|' + d.key); else if (!c.values.includes(d.value)) v.push('MEAK-META-TYPE:' + d.row + '|' + d.key); } return [...new Set(v)].sort(); }
/* the settings a meta manifest yields (base values where it is silent) */
function metaSettings(ds) { const o = { MEAP: { budget: 64, order: 'derive_first', costs: null }, MEAK: { n: 12, generations: 2, pool_cap: 8 } };
  for (const d of metaNorm(ds)) { if (metaLegality([d]).length) continue; if (d.row === 'MEAP' && /^cost:/.test(d.key)) { o.MEAP.costs = o.MEAP.costs || {}; o.MEAP.costs[d.key.slice(5)] = d.value; } else o[d.row][d.key] = d.value; } return o; }
/* deterministic meta population: every single-cell alternative (the neighbourhood of the shipped settings) — small and exhaustive, no sampling */
const metaPropose = () => META.flatMap(c => c.values.filter(v => v !== c.base).map(v => { const deltas = [{ fam: 'meta', row: c.row, key: c.key, value: v }]; return { schema: 'FORGE-MEA-META/v1', id: metaId(deltas), deltas, op: 'FLIP', families: ['meta'] }; }));
/* MEA-P meta cases: per canonical problem, "a proposal exists", "no budget stop", "the favoured option is unchanged", run with the settings */
function metaCasesMEAP(problems, ds) { const P = isNode ? require('./mea_p.js') : root.KMEAP, st = metaSettings(ds).MEAP, out = {};
  for (const p of problems || []) { const M = P.normalize(p), cy = P.cycle(M, { budget: st.budget, costs: st.costs, order: st.order }), b = P.cycle(M);
    const fav = x => JSON.stringify(Object.values(x.slates || {}).map(s => s.favoured)); out['mp:' + p.id + ':proposal'] = !!(cy.resolution && cy.resolution.route === 'eligible'); out['mp:' + p.id + ':no_budget_stop'] = !(cy.stop && cy.stop.rule === 'MEA-BUDGET'); out['mp:' + p.id + ':favoured_stable'] = fav(cy) === fav(b); }
  return out; }
function metaFitness(cand, base, out) { const ids = Object.keys(base).sort(), n = ids.length, passed = ids.filter(k => out[k]).length, regressions = ids.filter(k => base[k] && !out[k]).length, changed = ids.filter(k => !!base[k] !== !!out[k]).length, gained = ids.filter(k => !base[k] && out[k]).length;
  const nc = META.length, dc = metaNorm(cand.deltas).length, eps = n ? Math.floor((changed * nc + dc * n) * MEA.MICRO / (3 * n * nc)) : 0, band = (isNode ? require('./kmath.js') : root.KMath).driftGovernance(eps / MEA.MICRO).band, legal = metaLegality(cand.deltas);
  const evidence = changed > 0 ? 'changed_outcomes' : 'none', route = legal.length ? 'rejected' : evidence === 'none' ? 'no_evidence' : regressions === 0 && band === 'projectable' ? 'approvable' : band === 'explore' ? 'shadow' : band === 'correct' ? 'held' : 'rejected';
  return { cases: n, passed, regressions, gained, changed, echo: 0, evidence, legality: legal, structure_guard_regressions: 0, removals: 0, drift: { unit: 'micro (1e-6)', eps_s_micro: eps, D_score_micro: Math.floor(dc * MEA.MICRO / nc), band }, route }; }
const metaDescribe = c => metaNorm(c.deltas).map(d => (d.row === 'MEAP' ? 'MEA-P ' : 'MEA-K ') + d.key.replace(/^cost:/, 'cost of ') + ' → ' + d.value).join('; ');
const api = { setPoolCap, META, META_IMMUTABLE, metaNorm, metaId, metaLegality, metaSettings, metaPropose, metaCasesMEAP, metaFitness, metaDescribe, SCHEMA, FAMS, IMMUTABLE_CATS, cells, legality, norm, idOf, apply, OPS, propose, replay, fitness, rank, describe, baseVal, CELLS };
if (isNode) module.exports = api; else root.KMEAK = api;
})(typeof self !== 'undefined' ? self : this);
