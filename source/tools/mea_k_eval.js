/* tools/mea_k_eval.js — 4.9.75 MEA build-plan step 6: propose MEA-K manifests (src/mea_k.js: lexicon classes, frames, parser categories; seeded)
   and judge each on the verifier's own suites with the candidate installed under every kernel call (tools/mea_preload.js, MEAK_MANIFEST):
   held-out set + metamorphic mutation set (per-case outcomes) + world-state + relation-property guard + MEA-K meaning guard (with growth cases)
   + structure-dependence guard (hard gate) — Echo passes counted. Build-time evaluation (v1). Writes ranked candidates with fitness, drift and
   route to src/mea_k_data.js (shipped; the app lists them; adoption only by user tap). Every candidate that is not approvable is ARCHIVED there
   with its drift, novelty, anchors and reason (step 7). Counts only: no case text and no case id is written.
   Usage: node tools/mea_k_eval.js [seed=1] [n=12] [generations=2] */
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const ROOT = path.join(__dirname, '..'), MK = require(ROOT + '/src/mea_k.js'), MEA = require(ROOT + '/src/mea.js');
const seed = +(process.argv[2] || 1), n = +(process.argv[3] || 12), generations = +(process.argv[4] || 2);
const STRUCT = 'structure_guard_suite.js';
const CACHE = new Map();
function judge(deltas) { const key = MK.idOf(deltas); if (CACHE.has(key)) return CACHE.get(key); const r = judge0(deltas); CACHE.set(key, r); return r; }
function judge0(deltas) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meak-')), mf = path.join(dir, 'manifest.json'); fs.writeFileSync(mf, JSON.stringify(deltas));
  const env = Object.assign({}, process.env, { MEAK_MANIFEST: mf, MEA_OUT: dir }), pre = ['-r', path.join(__dirname, 'mea_preload.js')], o = { env, encoding: 'utf8', maxBuffer: 1 << 26, timeout: 600000 };
  const run = f => cp.execFileSync('node', pre.concat([path.join(ROOT, 'verify', f)]), o), ws = (f, g) => JSON.parse(cp.execFileSync('node', pre.concat([path.join(__dirname, 'mea_ws.js')].concat(f ? [f] : [], g ? [g] : [])), o));
  const out = {}; run('heldout_suite.js'); run('mutation_suite.js');
  const W = ws(), R = ws('relprop_guard_suite.js'), Q = ws('meak_guard_suite.js', 'growth'), S = ws(STRUCT);
  const H = JSON.parse(fs.readFileSync(path.join(dir, 'heldout_scores.json'), 'utf8')), M = JSON.parse(fs.readFileSync(path.join(dir, 'mutation_scores.json'), 'utf8'));
  for (const r of H.results) out['h:' + r.id] = !!r.pass; for (const r of M.results) out['m:' + r.id] = !!r.pass; for (const r of (M.base_results || [])) out['mb:' + r.id] = !!r.pass;
  W.forEach((r, i) => { out['w:' + i + ':' + r.name] = !!r.ok; }); R.forEach((r, i) => { out['g:' + i + ':' + r.name] = !!r.ok; }); Q.forEach((r, i) => { out['k:' + i + ':' + r.name] = !!r.ok; }); S.forEach((r, i) => { out['s:' + i + ':' + r.name] = !!r.ok; });
  const echo = fs.readFileSync(path.join(dir, 'echo.txt'), 'utf8').trim().split('\n').reduce((a, x) => a + (+x || 0), 0); fs.rmSync(dir, { recursive: true, force: true });
  const cnt = xs => [xs.filter(r => r.ok).length, xs.length];
  return { out, echo, suites: { heldout: [H.passed, H.cases], mutation: [M.passed, M.variants], world_state: cnt(W), relprop_guard: cnt(R), meak_guard: cnt(Q), structure_guard: cnt(S) } }; }
const base = judge([]), guardKeys = Object.keys(base.out).filter(k => /^s:/.test(k));
const t0 = Date.now(), pop = MK.propose({ seed, n, generations });
const cands = pop.map(c => { const j = judge(c.deltas), f = MK.fitness(c, base.out, j.out, j.echo, guardKeys); process.stderr.write(c.id + ' ' + f.route + ' ' + MK.describe(c) + '\n');
  return Object.assign({}, c, { text: MK.describe(c), suites: j.suites, fitness: f }); });
const ranked = MK.rank(cands);
/* step 7: the archive — every candidate that is not approvable, with drift, novelty (cells new to the population), anchors and the reason */
const reasonOf = f => f.legality.length ? 'illegal: ' + f.legality.join(', ') : f.structure_guard_regressions ? 'structure-dependence guard broken (' + f.structure_guard_regressions + ' case(s))' : f.route === 'no_evidence' ? 'no evidence delta (vacuous: no case changed)' : f.regressions ? f.regressions + ' regression(s)' : 'drift band ' + f.drift.band + ' (ε_s ' + f.drift.eps_s_micro / MEA.MICRO + ' > 0.35)';
const archive = ranked.filter(c => c.fitness.route !== 'approvable').map(c => ({ id: c.id, route: c.fitness.route, reason: reasonOf(c.fitness), drift: c.fitness.drift, novelty: MK.norm(c.deltas).length, anchors: { families: c.families, cells: MK.norm(c.deltas).map(d => d.fam + '|' + d.row + '|' + d.key) }, parents: c.parents, op: c.op, blocked_on: c.fitness.route === 'no_evidence' ? 'capability:evidence' : c.fitness.route === 'rejected' ? 'capability:guard' : 'capability:drift' }));
/* step 7: META manifests (MEA's own data). MEA-P cases come from running every canonical problem with the settings; MEA-K cases are "this approvable
   candidate is found" over the union of what the base and the meta settings find (each population judged exactly as above; judgements cached). */
const PD = require(ROOT + '/src/mea_problems_data.js'), routeOf = deltas => MK.fitness({ deltas }, base.out, judge(deltas).out, judge(deltas).echo, guardKeys).route;
const popWith = st => { MK.setPoolCap(st.pool_cap === 8 ? null : st.pool_cap); try { return MK.propose({ seed, n: st.n, generations: st.generations }); } finally { MK.setPoolCap(null); } };
const found = st => new Set(popWith(st).filter(c => routeOf(c.deltas) === 'approvable').map(c => c.id));
const baseSt = MK.metaSettings([]).MEAK, baseFound = new Set(ranked.filter(c => c.fitness.route === 'approvable').map(c => c.id)), metaBaseP = MK.metaCasesMEAP(PD.problems, []);
const metaPop = MK.metaPropose(), metaFound = new Map();
for (const c of metaPop) { const st = MK.metaSettings(c.deltas).MEAK; if (JSON.stringify(st) === JSON.stringify(baseSt)) continue; metaFound.set(c.id, found(st)); process.stderr.write('meta ' + MK.metaDescribe(c) + ': ' + metaFound.get(c.id).size + ' approvable\n'); }
const allK = [...new Set([...baseFound].concat(...[...metaFound.values()].map(x => [...x])))].sort();
const metaBase = Object.assign({}, metaBaseP, Object.fromEntries(allK.map(id => ['mk:' + id, baseFound.has(id)])));
const meta = MEA.rank(metaPop.map(c => { const fk = metaFound.get(c.id) || baseFound, out = Object.assign({}, MK.metaCasesMEAP(PD.problems, c.deltas), Object.fromEntries(allK.map(id => ['mk:' + id, fk.has(id)])));
  return Object.assign({}, c, { text: MK.metaDescribe(c), fitness: MK.metaFitness(c, metaBase, out) }); }));
for (const c of meta) if (c.fitness.route !== 'approvable') archive.push({ id: c.id, route: c.fitness.route, reason: c.fitness.legality.length ? 'illegal: ' + c.fitness.legality.join(', ') : c.fitness.route === 'no_evidence' ? 'no evidence delta (vacuous: no MEA-P outcome or found candidate changed)' : c.fitness.regressions ? c.fitness.regressions + ' regression(s) (loses an approvable candidate or a problem outcome)' : 'drift band ' + c.fitness.drift.band,
  drift: c.fitness.drift, novelty: MK.metaNorm(c.deltas).length, anchors: { families: ['meta'], cells: MK.metaNorm(c.deltas).map(d => 'meta|' + d.row + '|' + d.key) }, parents: [], op: c.op, blocked_on: c.fitness.route === 'no_evidence' ? 'capability:evidence' : 'capability:drift' });
const data = { schema: 'FORGE-MEA-K-PROPOSALS/v1', seed, n, generations, operators: Object.keys(MK.OPS), families: MK.FAMS, mutable_cells: MK.cells().length, immutable_categories: MK.IMMUTABLE_CATS, cells: MK.CELLS,
  base: { suites: base.suites, echo: base.echo, cases: Object.keys(base.out).length }, candidates: ranked, meta: { immutable: MK.META_IMMUTABLE, cells: MK.META, base_cases: Object.keys(metaBase).length, candidates: meta }, archive };
fs.writeFileSync(path.join(ROOT, 'src', 'mea_k_data.js'), '/* generated by tools/mea_k_eval.js — MEA-K proposals with fitness from the verifier suites (counts only) and the archive of non-approvable candidates. Do not edit. */\n(function (root) { const D = ' + JSON.stringify(data) + ';\nif (typeof module !== \'undefined\' && module.exports) module.exports = D; else root.KMEAKData = D; })(typeof self !== \'undefined\' ? self : this);\n');
console.log(JSON.stringify({ secs: Math.round((Date.now() - t0) / 1000), base: base.suites, candidates: ranked.map(c => [c.id, c.text, c.fitness.passed, c.fitness.regressions, c.fitness.drift.eps_s_micro, c.fitness.evidence, c.fitness.route]), meta: meta.map(c => [c.text, c.fitness.gained, c.fitness.regressions, c.fitness.route]) }, null, 0));
