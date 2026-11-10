/* evolve.js: GELC S3–S4, S6 — deterministic rule induction over stored atoms. No model. Every candidate is a HYPOTHESIS until a proof-checked,
   user-tapped admission (kernel.approveHypothesis). Operators (WM Spec A.3, §5.5; RMC §5.6/§8.3):
   GENERALISE  least general generalisation (anti-unification) of ≥2 instances of the same atom pattern (one- or two-atom bodies)
   SPECIALISE  add one precondition that holds for every supporting case and no counterexample; else keep the rule CONFLICTED
   TRANSFER    rename one predicate to another with the same typed roles (arity + overlapping argument classes); never by name alone
   ABDUCE      reverse a rule: every rule whose head matches an observation gives an explanation (missing preconditions); never one cause
   Fitness is lexicographic by held-out replay (leave-one-out): gates → covers ↓ → contradicts ↑ → parsimony ↑ → hash. No weighted sum. */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports;
const R = isNode ? require('./reason.js') : root.KReason, KM = isNode ? require('./kmath.js') : root.KMath, { sha256 } = isNode ? require('./sha256.js') : root.KSha;
const canon = R.canon, V = ['$a', '$b', '$c', '$d'], isVar = x => /^\$/.test(x), key = a => canon([a.polarity, a.predicate, a.args]);
const DEFAULTS = Object.freeze({ seed: 1, budget: 64, generations: 3, keep: 12, min_support: 2 });
const sig = r => 'rule:' + sha256(canon([r.body, r.head])).slice(0, 16);
const mk = (body, head, op, parents) => { const r = { body, head, op, parents: parents || [] }; r.id = sig(r); return r; };
const safe = r => { const bv = new Set(r.body.flatMap(a => a.args.filter(isVar))); return r.head.args.some(isVar) && r.head.args.every(x => !isVar(x) || bv.has(x)); };
const at = a => (a.predicate === 'isa' ? a.args[0].replace(/^\$/, '') + (a.polarity === 'neg' ? ' is not a ' : ' is a ') + a.args[1].replace(/^\$/, '') : R.atomText(a)), text = r => at(r.head) + ' if ' + r.body.map(at).join(' and ');
/* lgg of instance tuples (lists of ground atoms with one shape): a position stays constant iff equal in every instance; equal entity tuples share a variable */
function lgg(insts) { const m = new Map(); let n = 0; const first = insts[0];
  return first.map((a, i) => ({ predicate: a.predicate, polarity: a.polarity, args: a.args.map((_, j) => { const col = insts.map(t => t[i].args[j]); if (col.every(x => x === col[0])) return col[0]; const k = col.join('\u0001'); if (!m.has(k)) m.set(k, V[n++] || '$v' + n); return m.get(k); }) })); }
const shape = t => { const ents = []; return canon(t.map(a => [a.predicate, a.polarity, a.args.map(x => { let i = ents.indexOf(x); if (i < 0) { ents.push(x); i = ents.length - 1; } return i; })])); };
function generalise(facts, o) { const F = facts.map(f => f.atom).filter(a => a.polarity === 'pos'), groups = new Map(), add = t => { const k = shape(t); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); };
  for (const h of F) for (const b of F) { if (b === h || !b.args.some(x => h.args.includes(x))) continue; add([b, h]);
    for (const c of F) if (c !== b && c !== h && b.args[1] === c.args[0] && h.args[0] === b.args[0] && h.args[1] === c.args[1] && b.args[0] !== c.args[1]) add([b, c, h]); }
  /* the full lgg of a shape group, and the lgg of each sub-group that agrees on every body value not linked to the head (keeps class constants) */
  const out = [], push = insts => { if (new Set(insts.map(canon)).size < o.min_support) return; const g = lgg(insts), r = mk(g.slice(0, -1), g[g.length - 1], 'GENERALISE'); if (safe(r) && !r.body.some(b => key(b) === key(r.head)) && !out.some(x => x.id === r.id)) out.push(r); };
  for (const insts of groups.values()) { push(insts); const sub = new Map(); for (const t of insts) { const h = t[t.length - 1].args, k = canon(t.slice(0, -1).map(a => a.args.filter(x => !h.includes(x)))); if (!sub.has(k)) sub.set(k, []); sub.get(k).push(t); } if (sub.size > 1) for (const g of sub.values()) push(g); }
  return out; }
function fitness(rule, facts) { let rw; try { rw = R.ruleWorld(facts, [rule]); } catch (e) { return null; }
  const stated = new Map(facts.map(f => [key(f.atom), f])), derived = rw.atoms().filter(a => !stated.has(key(a))), covers = [], contradicts = [];
  for (const f of facts) { if (f.atom.predicate !== rule.head.predicate || f.atom.polarity !== rule.head.polarity) continue; const rest = facts.filter(x => x !== f);
    let pr = null; try { pr = R.ruleWorld(rest, [rule]).prove(f.atom); } catch (e) { pr = null; } if (pr && pr.rule_ids.includes(rule.id) && R.checkRuleProof(rest, [rule], pr).ok) covers.push({ fact: f.id, atom: f.atom, proof_id: pr.proof_id }); }
  for (const a of rw.atoms()) { const opp = Object.assign({}, a, { polarity: a.polarity === 'neg' ? 'pos' : 'neg' }); if (stated.has(key(opp))) contradicts.push(stated.get(key(opp)).id); }
  const predicted = derived.length, sigma = covers.length + contradicts.length ? contradicts.length / (covers.length + contradicts.length) : 0, D = predicted + covers.length ? predicted / (predicted + covers.length) : 1;
  const eps = (sigma + D + 0) / 3; /* ε_s = (σ_res + D_score + |ΔΦ|)/3 with |ΔΦ| = 0 (no phase transition in a replay); implementation choice, as in ede.js */
  return { covers, contradicts: [...new Set(contradicts)], predicted, parsimony: rule.body.length + rule.body.concat([rule.head]).flatMap(a => a.args).filter(x => !isVar(x)).length, drift: Object.assign(KM.driftGovernance(eps), { sigma_res: KM.r4(sigma), D_score: KM.r4(D), dPhi: 0, n: 3 }) }; }
function specialise(rule, fit, facts) { if (!fit || !fit.contradicts.length) return []; const F = facts.map(f => f.atom), v = rule.head.args.find(isVar); if (!v) return [];
  const sub = (a, s) => Object.assign({}, a, { args: a.args.map(x => (x === v ? s : x)) }), bind = c => { const at = c.atom || c; return at.args[rule.head.args.indexOf(v)]; };
  const good = fit.covers.map(bind), bad = fit.contradicts.map(id => facts.find(f => f.id === id)).filter(Boolean).map(f => bind(f)), out = [];
  for (const a of F) { if (!a.args.includes(good[0])) continue; const pat = sub(Object.assign({}, a, { args: a.args.map(x => (x === good[0] ? v : x)) }), v), has = e => F.some(b => key(b) === key(sub(pat, e)));
    if (good.every(has) && !bad.some(has) && key(pat) !== key(rule.head) && !rule.body.some(b => key(b) === key(pat))) out.push(mk(rule.body.concat([pat]), rule.head, 'SPECIALISE', [rule.id])); }
  return out; }
/* typed roles: the classes (isa objects) observed for the entities in each argument position of a predicate */
function roles(facts) { const F = facts.map(f => f.atom), cls = e => F.filter(a => a.predicate === 'isa' && a.args[0] === e).map(a => a.args[1]), r = new Map();
  for (const a of F) { if (a.predicate === 'isa') continue; const s = r.get(a.predicate) || a.args.map(() => new Set()); a.args.forEach((x, i) => cls(x).forEach(c => s[i] && s[i].add(c))); r.set(a.predicate, s); } return r; }
function transfer(rule, facts) { const ro = roles(facts), out = [], preds = [...new Set(rule.body.concat([rule.head]).map(a => a.predicate))].filter(p => p !== 'isa');
  for (const p of preds) for (const [q, sq] of ro) { const sp = ro.get(p); if (q === p || !sp || sp.length !== sq.length || !sp.every((s, i) => [...s].some(c => sq[i].has(c)))) continue; /* TRANSFER-ROLE-MISMATCH otherwise */
    const ren = a => (a.predicate === p ? Object.assign({}, a, { predicate: q }) : a), t = mk(rule.body.map(ren), ren(rule.head), 'TRANSFER', [rule.id]); if (safe(t)) out.push(t); }
  return out; }
function abduce(obs, rules, facts) { const st = new Set(facts.map(f => key(f.atom))), out = [];
  for (const r of rules) { if (r.head.predicate !== obs.predicate || r.head.polarity !== obs.polarity) continue; const s = {}; let ok = true;
    r.head.args.forEach((x, i) => { if (isVar(x)) { if (s[x] && s[x] !== obs.args[i]) ok = false; s[x] = obs.args[i]; } else if (x !== obs.args[i]) ok = false; }); if (!ok) continue;
    const body = r.body.map(a => Object.assign({}, a, { args: a.args.map(x => s[x] || x) })); out.push({ rule: r.id, explanation: body, missing: body.filter(a => !st.has(key(a))), status: 'hypothesis' }); }
  const tests = out.length > 1 ? out.flatMap((e, i) => e.missing.filter(m => out.every((x, j) => j === i || !x.missing.some(y => key(y) === key(m)))).map(m => ({ discriminates: e.rule, check: m }))) : [];
  return { observation: obs, explanations: out, discriminating_tests: tests, identifiable: out.length === 1, note: out.length > 1 ? 'several mechanisms explain it; no single cause is selected' : null }; }
const rank = (x, y) => (y.fit.drift.band === 'reject') - (x.fit.drift.band === 'reject') || y.fit.covers.length - x.fit.covers.length || x.fit.contradicts.length - y.fit.contradicts.length || x.fit.parsimony - y.fit.parsimony || (x.order < y.order ? -1 : x.order > y.order ? 1 : 0);
function evolve(facts, opts) { const o = Object.assign({}, DEFAULTS, opts || {}), seen = new Map(), root = sha256(canon(facts.map(f => [f.id, f.atom]))), gens = [];
  const admit = (rs, g) => { const fresh = []; for (const r of rs) { if (seen.size >= o.budget || seen.has(r.id)) continue; const fit = fitness(r, facts); if (!fit) continue; const c = { rule: r, gen: g, fit, order: sha256(o.seed + '|' + root + '|' + g + '|' + r.id) }; seen.set(r.id, c); fresh.push(c); } return fresh; };
  let parents = admit(generalise(facts, o).sort((a, b) => (a.id < b.id ? -1 : 1)), 0).sort(rank).slice(0, o.keep); gens.push(parents.map(c => c.rule.id));
  for (let g = 1; g <= o.generations && seen.size < o.budget; g++) { const kids = parents.flatMap(c => specialise(c.rule, c.fit, facts).concat(transfer(c.rule, facts))); const fresh = admit(kids, g); if (!fresh.length) break; parents = parents.concat(fresh).sort(rank).slice(0, o.keep); gens.push(fresh.map(c => c.rule.id)); }
  const all = [...seen.values()].sort(rank), route = c => { const f = c.fit; if (f.drift.band === 'reject') return 'rejected'; if (f.contradicts.length) return 'conflicted';
    if (f.covers.length >= o.min_support && f.drift.may_project) return 'promotable'; return f.drift.may_explore || f.drift.band === 'correct' || f.covers.length ? 'quarantine' : 'rejected'; };
  const population = all.map(c => ({ id: c.rule.id, rule: { id: 'GELC-INDUCED:' + c.rule.id.slice(5), name: 'GELC-ADMITTED-RULE', body: c.rule.body, head: c.rule.head }, text: text(c.rule), op: c.rule.op, parents: c.rule.parents, gen: c.gen, covers: c.fit.covers, contradicts: c.fit.contradicts, predicted: c.fit.predicted, parsimony: c.fit.parsimony, drift: c.fit.drift, route: route(c), status: 'HYPOTHESIS' }));
  return { schema: 'GELCPopulation/v1', world_root: root, params: o, generations: gens, population, population_hash: sha256(canon(population.map(p => [p.id, p.route, p.covers.map(x => x.proof_id)]))), explored: seen.size }; }
/* RECOMBINE over rule SETS (4.9.75, MEA build-plan step 6 — MEA_SPEC §e "RECOMBINE over rule sets"): pairs of promotable rules are judged TOGETHER
   by the same held-out replay (leave-one-out over the stored facts with both rules active). A set is promotable iff it contradicts nothing, its
   drift may project (ε_s ≤ 0.35), it covers ≥ min_support facts and it covers MORE than either member alone (a non-vacuous evidence delta: the
   rules prove something jointly that neither proves by itself). A set that contradicts a fact is CONFLICTED (each member may be fine alone).
   Deterministic: pairs in population order, at most o.recombine of them. Nothing is admitted here; members are admitted one tap at a time. */
function setFitness(rules, facts) { let rw; try { rw = R.ruleWorld(facts, rules); } catch (e) { return null; } const ids = rules.map(r => r.id), heads = new Set(rules.map(r => r.head.predicate + '|' + r.head.polarity));
  const stated = new Map(facts.map(f => [key(f.atom), f])), derived = rw.atoms().filter(a => !stated.has(key(a))), covers = [], contradicts = [];
  for (const f of facts) { if (!heads.has(f.atom.predicate + '|' + f.atom.polarity)) continue; const rest = facts.filter(x => x !== f); let pr = null; try { pr = R.ruleWorld(rest, rules).prove(f.atom); } catch (e) { pr = null; }
    if (pr && pr.rule_ids.some(x => ids.includes(x)) && R.checkRuleProof(rest, rules, pr).ok) covers.push({ fact: f.id, atom: f.atom, proof_id: pr.proof_id }); }
  for (const a of rw.atoms()) { const opp = Object.assign({}, a, { polarity: a.polarity === 'neg' ? 'pos' : 'neg' }); if (stated.has(key(opp))) contradicts.push(stated.get(key(opp)).id); }
  const sigma = covers.length + contradicts.length ? contradicts.length / (covers.length + contradicts.length) : 0, D = derived.length + covers.length ? derived.length / (derived.length + covers.length) : 1, eps = (sigma + D + 0) / 3;
  return { covers, contradicts: [...new Set(contradicts)], predicted: derived.length, drift: Object.assign(KM.driftGovernance(eps), { sigma_res: KM.r4(sigma), D_score: KM.r4(D), dPhi: 0, n: 3 }) }; }
function recombine(population, facts, opts) { const o = Object.assign({}, DEFAULTS, { recombine: 6 }, opts || {}), prom = population.filter(p => p.route === 'promotable'), out = [];
  for (let i = 0; i < prom.length && out.length < o.recombine; i++) for (let j = i + 1; j < prom.length && out.length < o.recombine; j++) { const a = prom[i], b = prom[j], rs = [a.rule, b.rule].map(r => ({ id: r.id, body: r.body, head: r.head, name: r.name }));
    const f = setFitness(rs, facts); if (!f) continue; const best = Math.max(a.covers.length, b.covers.length), delta = f.covers.length - best;
    const route = f.drift.band === 'reject' ? 'rejected' : f.contradicts.length ? 'conflicted' : f.covers.length >= o.min_support && f.drift.may_project && delta > 0 ? 'promotable' : delta <= 0 ? 'no_evidence' : 'quarantine';
    out.push({ id: 'ruleset:' + sha256(canon([a.id, b.id].sort())).slice(0, 16), op: 'RECOMBINE', members: [a.id, b.id], texts: [a.text, b.text], covers: f.covers, contradicts: f.contradicts, evidence_delta: delta, drift: f.drift, route, status: 'HYPOTHESIS' }); }
  return out; }
/* S6: offline calibration of the projection threshold from human labels; advisory only — projection stays governed by the drift ruling */
function calibrate(rows) { const L = (rows || []).filter(r => r && r.human_label && r.drift && typeof r.drift.eps_s === 'number'), pos = r => r.human_label === 'useful_bounded_novelty';
  if (L.length < 20 || L.filter(pos).length < 5 || L.filter(r => !pos(r)).length < 5) return { status: 'insufficient_labels', labelled: L.length, needed: '≥ 20 with ≥ 5 per class' };
  let best = null; for (const t of [...new Set(L.map(r => r.drift.eps_s))].sort((a, b) => a - b)) { const tp = L.filter(r => pos(r) && r.drift.eps_s <= t).length / L.filter(pos).length, tn = L.filter(r => !pos(r) && r.drift.eps_s > t).length / L.filter(r => !pos(r)).length, ba = (tp + tn) / 2; if (!best || ba > best.balanced_accuracy) best = { theta_fit: t, balanced_accuracy: KM.r4(ba) }; }
  const body = Object.assign({ labelled: L.length, method: 'max balanced accuracy over observed ε_s cut points' }, best); return Object.assign({ status: 'fitted', params_version: 'gelc-calibration/v1:' + sha256(canon(body)).slice(0, 12), authority: 'advisory: never changes the Nic drift ruling (project ≤ 0.35)' }, body); }
const api = { DEFAULTS, generalise, specialise, transfer, abduce, fitness, evolve, recombine, setFitness, calibrate, lgg, text };
if (isNode) module.exports = api; else root.KEvolve = api;
})(typeof self !== 'undefined' ? self : this);
