/* infer.js — deterministic inference over stored facts (no guessing; every step cited).
 * Rules:
 *   INF-LOC-TRANSITIVE   located_in(a,b) ∧ located_in(b,c) ⇒ located_in(a,c)          (Doc5 adhikaraṇa; Doc6 §21 connectedness)
 *   INF-ISA-WORDNET      a is-a N1 ∧ N1 ⊑ N2 (WordNet 3.0 hypernym closure, all senses agree) ⇒ a is-a N2
 *   INF-ISA-STORED       class facts "a N1 is a N2" chained with is-a
 *   INF-FAMILY-INVERSE   parent(a,b) ⇔ child(b,a); sibling(a,b) ⇔ sibling(b,a); spouse symmetric
 *   INF-FAMILY-COMPOSE   parent(a,b) ∧ parent(b,c) ⇒ grandparent(a,c); sibling ∘ child ⇒ aunt/uncle only when gender stated (else "parent's sibling")
 *   INF-NEG-CONSISTENCY  an inferred conclusion that contradicts a stored negated fact is reported as a contradiction, never answered
 * Sense rule: if a noun has several WordNet senses and they disagree on the hypernym question, the answer is
 * "depends on sense" (clarification), never a guess. A sense stored with the fact (sense-locked) is used alone. */
(function (root) {
  const FAMILY = { mother: 'parent', father: 'parent', parent: 'parent', son: 'child', daughter: 'child', child: 'child', sister: 'sibling', brother: 'sibling', sibling: 'sibling',
    wife: 'spouse', husband: 'spouse', spouse: 'spouse', grandmother: 'grandparent', grandfather: 'grandparent', grandparent: 'grandparent', grandson: 'grandchild', granddaughter: 'grandchild', grandchild: 'grandchild' };
  const GENDER_OF_ROLE = { mother: 'f', sister: 'f', daughter: 'f', wife: 'f', grandmother: 'f', granddaughter: 'f', father: 'm', brother: 'm', son: 'm', husband: 'm', grandfather: 'm', grandson: 'm' };
  const GENDERED = { parent: { f: 'mother', m: 'father' }, child: { f: 'daughter', m: 'son' }, sibling: { f: 'sister', m: 'brother' }, spouse: { f: 'wife', m: 'husband' }, grandparent: { f: 'grandmother', m: 'grandfather' }, grandchild: { f: 'granddaughter', m: 'grandson' } };
  const INV = { parent: 'child', child: 'parent', sibling: 'sibling', spouse: 'spouse', grandparent: 'grandchild', grandchild: 'grandparent' };

  const isNode = typeof module !== 'undefined' && module.exports;
  function Infer({ lex, entKey, entKeys, G }) {
    const R = isNode ? require('./reason.js') : root.KReason, WR = isNode ? require('./world_rules.js') : root.KWorldRules;
    /* GELC S1: chains are proved by the reason.js closure over data rules; proofs are replayed; leaf fact ids (in proof order) are the cited path */
    let last = null; const lastProof = () => last;
    function prove(edges, rules, goal) { const facts = edges.map(e => ({ id: e.id, atom: { predicate: e.p, args: [e.a, e.b], polarity: 'pos' } })); const pr = R.ruleWorld(facts, rules).prove(goal); last = pr; return pr; }
    function chain(edges, p, a, b) { const E = edges.filter(e => !e.neg).map(e => Object.assign({ p }, e)); if (!E.length || a === b) return null;
      const pr = prove(E, WR.transitive('INF-TRANSITIVE', p), { predicate: p + '+', args: [a, b], polarity: 'pos' }); if (!pr) return null;
      const byId = new Map(E.map(e => [e.id, e])); return pr.fact_ids.map(id => byId.get(id)); }
    function reachable(edges, p, a) { const E = edges.map(e => Object.assign({ p }, e)); if (!E.length) return []; const rw = R.ruleWorld(E.map(e => ({ id: e.id, atom: { predicate: p, args: [e.a, e.b], polarity: 'pos' } })), WR.transitive('INF-TRANSITIVE', p));
      return rw.atoms().filter(x => x.predicate === p + '+' && x.args[0] === a && x.args[1] !== a).map(x => ({ node: x.args[1], proof: rw.prove(x) })).sort((x, y) => y.proof.fact_ids.length - x.proof.fact_ids.length || (x.node < y.node ? -1 : x.node > y.node ? 1 : 0)); }
    const LOC_PREP = /^(in|at|inside|within)$/;
    /* located_in edges from facts: X be in Y | X live in Y | X be located in Y */
    function locEdges(facts) { const E = [];
      for (const r of facts) { const c = r.clause; if (!c || c.coord || c.cond || !c.verb || c.verb.mod !== 'asserted' || c.verb.tense === 'future') continue;
        const neg = c.verb.pol === 'neg'; const s = entKey(c.subj); if (!s) continue;
        let tgt = null; if (c.verb.lemma === 'be' && c.pred && c.pred.type === 'pp' && LOC_PREP.test(c.pred.prep)) tgt = c.pred.np;
        else if (/^(live|reside|stay)$/.test(c.verb.lemma)) { const a = (c.adj || []).find(x => x.role === 'adhikarana' && LOC_PREP.test(x.prep || '')); if (a) tgt = a.np; }
        if (tgt) { const t = entKey(tgt); if (t) E.push({ a: s, b: t, neg, id: r.id, verb: c.verb.lemma }); } }
      return E; }
    const locPath = (facts, a, b) => chain(locEdges(facts), 'located_in', a, b);
    /* WordNet hypernym closure */
    const W = () => lex.wn; const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
    function nounSyns(l) { const out = []; for (const t of ['core', 'ext', 'pro']) { const d = W()[t]; if (d && own(d.L, l)) for (const [p, ss] of d.L[l]) if (p === 'n') for (const s of ss) out.push(s[0]); } return out; }
    const hyp = id => { for (const t of ['core', 'ext', 'pro']) { const d = W()[t]; if (d && d.H && own(d.H, id)) return d.H[id]; } return null; };
    const head = id => { for (const t of ['core', 'ext', 'pro']) { const d = W()[t]; if (d && d.N && own(d.N, id)) return d.N[id]; } return id; };
    function synPath(from, targets) { const prev = new Map([[from, null]]); const q = [from];
      while (q.length) { const x = q.shift(); if (targets.has(x)) { const p = []; let k = x; while (k) { p.unshift(head(k)); k = prev.get(k); } return p; } const h = hyp(x); if (!h) continue; for (const y of h) if (!prev.has(y)) { prev.set(y, x); q.push(y); } }
      return null; }
    /* isA(word, target): {status: yes|no|mixed|unknown, paths} */
    function isA(word, target) { if (word === target) return { status: 'yes', paths: [[word]] }; const S = nounSyns(word), T = new Set(nounSyns(target));
      if (!S.length || !T.size) return { status: 'unknown', paths: [], reason: !S.length ? word : target };
      if (!S.some(s => hyp(s))) return { status: 'unknown', paths: [], reason: word + ' (no hypernym data)' };
      const per = S.map(s => ({ s, p: synPath(s, T) })); const yes = per.filter(x => x.p);
      return { status: yes.length === per.length ? 'yes' : yes.length ? 'mixed' : 'no', paths: yes.map(x => x.p), senses: per.map(x => ({ sid: 'wn30:' + x.s, reaches: !!x.p })) }; }
    const npHead = n => (n && n.head ? n.head[n.head.length - 1] : null);
    /* class facts for an entity: X is a N (indefinite/bare nominal predicate) */
    function classesOf(facts, key) { const out = []; for (const r of facts) { const c = r.clause; if (!c || c.coord || c.cond || c.verb.lemma !== 'be' || c.verb.mod !== 'asserted') continue;
      if (c.pred && c.pred.type === 'np' && c.pred.np && c.pred.np.head && !c.pred.np.owner && entKey(c.subj) === key) out.push({ cls: npHead(c.pred.np), neg: c.verb.pol === 'neg', id: r.id }); } return out; }
    /* generic class facts: "a poodle is a dog" / "poodles are dogs" → subj has no owner/propn, det a/an or plural */
    /* 4.9.80 INF-RESTRICTED-CLASS: a subject restricted by a relative clause or an adjective ("every gannet that is grey", "every grey gannet") names a
       subclass, not the head noun's class — it licenses nothing about a plain member of the head class */
    const restricted = n => !!(n && (n.rel || n.relc || (n.adjs || []).length || n.of || n.pp));
    function genericIsA(facts) { const out = []; for (const r of facts) { const c = r.clause; if (!c || c.coord || c.cond || c.verb.lemma !== 'be' || c.verb.pol !== 'pos' || c.verb.mod !== 'asserted' || restricted(c.subj)) continue;
      if (c.pred && c.pred.type === 'np' && c.subj && c.subj.head && !c.subj.owner && !c.subj.propn && (!c.subj.quant || /^(all|every|each)$/.test(c.subj.quant)) && (c.subj.det === 'a' || c.subj.det === 'an' || c.subj.plural || !c.subj.det)) out.push({ a: npHead(c.subj), b: npHead(c.pred.np), id: r.id }); } return out; }
    /* negative universals: “no A is a B” / “an A is not a B” — disjointness (Doc6 §21) */
    function disjoint(facts) { const out = []; for (const r of facts) { const c = r.clause; if (!c || c.coord || c.cond || c.verb.lemma !== 'be' || c.verb.mod !== 'asserted' || !c.pred || c.pred.type !== 'np' || !c.subj || c.subj.owner || c.subj.propn || restricted(c.subj)) continue;
      const neg = (c.subj.quant === 'no' && c.verb.pol === 'pos') || (!c.subj.quant && c.verb.pol === 'neg' && (c.subj.det === 'a' || c.subj.det === 'an' || c.subj.plural)); if (neg) out.push({ a: npHead(c.subj), b: npHead(c.pred.np), id: r.id }); } return out; }
    /* stored is-a chains are proved (subclass transitivity as data); WordNet is only the lexical tail after the last stored class */
    function classReach(facts, cls, target) { if (cls === target) return { chain: [cls], via: [], wn: null, status: 'yes' };
      const g = genericIsA(facts); const p = chain(g, 'is_a', cls, target); if (p) return { chain: [cls].concat(p.map(e => e.b)), via: p.map(e => e.id), wn: null, status: 'yes', proof: last };
      for (const r of reachable(g, 'is_a', cls)) { const w = isA(r.node, target); if (w.status === 'yes') { const ids = r.proof.fact_ids; const byId = new Map(g.map(e => [e.id, e])); return { chain: [cls].concat(ids.slice(0, -1).map(id => byId.get(id).b), w.paths[0]), via: ids, wn: w, status: 'yes', proof: r.proof }; } }
      const w = isA(cls, target); if (w.status === 'yes') return { chain: w.paths[0], via: [], wn: w, status: 'yes' }; if (w.status === 'mixed') return { chain: [], via: [], wn: w, status: 'mixed' };
      return null; }
    /* family triples from facts:  X is Y's ROLE  |  Y's ROLE is X  |  my ROLE (owner user) */
    function famTriples(facts) { const T = [];
      for (const r of facts) { const c = r.clause; if (!c || c.coord || c.cond || c.verb.lemma !== 'be' || c.verb.mod !== 'asserted') continue; const neg = c.verb.pol === 'neg';
        if (c.pred && c.pred.type === 'np' && c.pred.np && c.pred.np.owner && FAMILY[npHead(c.pred.np)]) { const role = npHead(c.pred.np); const owner = typeof c.pred.np.owner === 'object' ? entKey(c.pred.np.owner) : c.pred.np.owner; T.push({ a: entKey(c.subj), rel: FAMILY[role], role, b: owner, neg, id: r.id }); } }
      return T; }
    const genderStated = (facts, key) => { // gender only from explicit user statements: a gendered role word was asserted of this entity, or the entity key itself is a gendered role ("my sister")
      for (const t of famTriples(facts)) if (t.a === key && !t.neg && GENDER_OF_ROLE[t.role]) return GENDER_OF_ROLE[t.role];
      const m = String(key).match(/(?:^|:)(mother|father|sister|brother|son|daughter|wife|husband|grandmother|grandfather|grandson|granddaughter)$/); return m ? GENDER_OF_ROLE[m[1]] : null; };
    /* family relations proved from the data rules (inverse, grandparent composition, sibling transitivity with a ≠ b guard) */
    function famRel(facts, a, b) { const T = famTriples(facts).filter(t => !t.neg && t.a && t.b); if (!T.length) return []; const fs = T.map(t => ({ id: t.id, atom: { predicate: t.rel, args: [t.a, t.b], polarity: 'pos' } }));
      const rw = R.ruleWorld(fs, WR.FAMILY); const names = new Map(WR.FAMILY.map(r => [r.id, r.name])); const out = [];
      for (const rel of Object.keys(INV)) { const pr = rw.prove({ predicate: rel, args: [a, b], polarity: 'pos' }); if (!pr) continue; const used = new Set(pr.rule_ids.map(id => names.get(id)));
        out.push({ rel, rule: WR.NAME_PRIORITY.find(n => used.has(n)) || 'INF-FAMILY-STATED', via: pr.fact_ids, proof: pr }); }
      return out.sort((x, y) => x.via.length - y.via.length); }
    /* W3 typed transitive relations (Doc5 frames; Doc6 §21 lawful inference): comparatives (antonym-normalised), temporal order, part-of */
    const ANT = { young: 'old', short: 'tall', small: 'big', little: 'big', low: 'high', slow: 'fast', light: 'heavy', cheap: 'expensive', near: 'far', weak: 'strong', early: 'late', cold: 'hot', thin: 'thick', narrow: 'wide' };
    function relOf(c) { if (!c || c.coord || c.cond || !c.verb || c.verb.lemma !== 'be' || !c.pred) return null; const p = c.pred;
      if (p.type === 'cmp' && p.than && p.degree === 'more') { const inv = ANT[p.adj]; return { rel: 'cmp:' + (inv || p.adj), a: c.subj, b: p.than, swap: !!inv }; }
      if (p.type === 'pp' && /^(before|after)$/.test(p.prep)) return { rel: 'before', a: c.subj, b: p.np, swap: p.prep === 'after' };
      if (p.type === 'np' && p.np && p.np.head && p.np.head[p.np.head.length - 1] === 'part' && p.np.of) return { rel: 'partof', a: c.subj, b: p.np.of, swap: false };
      return null; }
    function relEdges(facts) { const E = []; for (const r of facts) { const c = r.clause; if (!c || !c.verb || c.verb.mod !== 'asserted' || c.verb.tense === 'future') continue; const x = relOf(c); if (!x) continue;
        const a = entKey(x.a), b = entKey(x.b); if (!a || !b) continue; E.push(Object.assign({ rel: x.rel, neg: c.verb.pol === 'neg', id: r.id }, x.swap ? { a: b, b: a } : { a, b })); } return E; }
    function relPath(facts, q) { const x = relOf(q); if (!x) return null; let a = entKey(x.a), b = entKey(x.b); if (!a || !b) return null; if (x.swap) [a, b] = [b, a];
      const path = chain(relEdges(facts).filter(e => e.rel === x.rel), x.rel.replace(/[^\p{L}\p{N}]+/gu, '_'), a, b); return path ? { rel: x.rel, path } : null; }
    return { disjoint, relOf, relEdges, relPath, locEdges, locPath, isA, classesOf, classReach, famTriples, famRel, genderStated, lastProof, FAMILY, GENDERED, GENDER_OF_ROLE, npHead };
  }
  const api = { Infer, FAMILY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KInfer = api;
})(typeof self !== 'undefined' ? self : this);
