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

  function Infer({ lex, entKey, entKeys, G }) {
    const LOC_PREP = /^(in|at|inside|within)$/;
    /* located_in edges from facts: X be in Y | X live in Y | X be located in Y */
    function locEdges(facts) { const E = [];
      for (const r of facts) { const c = r.clause; if (!c || c.coord || c.cond || !c.verb || c.verb.mod !== 'asserted' || c.verb.tense === 'future') continue;
        const neg = c.verb.pol === 'neg'; const s = entKey(c.subj); if (!s) continue;
        let tgt = null; if (c.verb.lemma === 'be' && c.pred && c.pred.type === 'pp' && LOC_PREP.test(c.pred.prep)) tgt = c.pred.np;
        else if (/^(live|reside|stay)$/.test(c.verb.lemma)) { const a = (c.adj || []).find(x => x.role === 'adhikarana' && LOC_PREP.test(x.prep || '')); if (a) tgt = a.np; }
        if (tgt) { const t = entKey(tgt); if (t) E.push({ a: s, b: t, neg, id: r.id, verb: c.verb.lemma }); } }
      return E; }
    function locPath(facts, a, b) { const E = locEdges(facts).filter(e => !e.neg); const prev = new Map([[a, null]]); const q = [a];
      while (q.length) { const x = q.shift(); for (const e of E) if (e.a === x && !prev.has(e.b)) { prev.set(e.b, e); if (e.b === b) { const path = []; let k = b; while (prev.get(k)) { path.unshift(prev.get(k)); k = prev.get(k).a; } return path; } q.push(e.b); } }
      return null; }
    /* WordNet hypernym closure */
    const W = () => lex.wn; const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
    function nounSyns(l) { const out = []; for (const t of ['core', 'ext']) { const d = W()[t]; if (d && own(d.L, l)) for (const [p, ss] of d.L[l]) if (p === 'n') for (const s of ss) out.push(s[0]); } return out; }
    const hyp = id => { for (const t of ['core', 'ext']) { const d = W()[t]; if (d && d.H && own(d.H, id)) return d.H[id]; } return null; };
    const head = id => { for (const t of ['core', 'ext']) { const d = W()[t]; if (d && d.N && own(d.N, id)) return d.N[id]; } return id; };
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
    function genericIsA(facts) { const out = []; for (const r of facts) { const c = r.clause; if (!c || c.coord || c.cond || c.verb.lemma !== 'be' || c.verb.pol !== 'pos' || c.verb.mod !== 'asserted') continue;
      if (c.pred && c.pred.type === 'np' && c.subj && c.subj.head && !c.subj.owner && !c.subj.propn && (!c.subj.quant || /^(all|every|each)$/.test(c.subj.quant)) && (c.subj.det === 'a' || c.subj.det === 'an' || c.subj.plural || !c.subj.det)) out.push({ a: npHead(c.subj), b: npHead(c.pred.np), id: r.id }); } return out; }
    /* negative universals: “no A is a B” / “an A is not a B” — disjointness (Doc6 §21) */
    function disjoint(facts) { const out = []; for (const r of facts) { const c = r.clause; if (!c || c.coord || c.cond || c.verb.lemma !== 'be' || c.verb.mod !== 'asserted' || !c.pred || c.pred.type !== 'np' || !c.subj || c.subj.owner || c.subj.propn) continue;
      const neg = (c.subj.quant === 'no' && c.verb.pol === 'pos') || (!c.subj.quant && c.verb.pol === 'neg' && (c.subj.det === 'a' || c.subj.det === 'an' || c.subj.plural)); if (neg) out.push({ a: npHead(c.subj), b: npHead(c.pred.np), id: r.id }); } return out; }
    function classReach(facts, cls, target, seen) { seen = seen || new Set(); if (seen.has(cls)) return null; seen.add(cls);
      if (cls === target) return { chain: [cls], via: [], wn: null, status: 'yes' };
      const g = genericIsA(facts); for (const e of g) if (e.a === cls) { const r = classReach(facts, e.b, target, seen); if (r && r.status === 'yes') return { chain: [cls].concat(r.chain), via: [e.id].concat(r.via), wn: r.wn, status: 'yes' }; }
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
    function famRel(facts, a, b) { const T = famTriples(facts).filter(t => !t.neg); const out = [];
      for (const t of T) { if (t.a === a && t.b === b) out.push({ rel: t.rel, rule: 'INF-FAMILY-STATED', via: [t.id] }); if (t.a === b && t.b === a) out.push({ rel: INV[t.rel], rule: 'INF-FAMILY-INVERSE', via: [t.id] }); }
      for (const t1 of T) for (const t2 of T) { if (t1 === t2) continue;
        const p1 = t1.rel === 'parent' ? [t1.a, t1.b] : t1.rel === 'child' ? [t1.b, t1.a] : null, p2 = t2.rel === 'parent' ? [t2.a, t2.b] : t2.rel === 'child' ? [t2.b, t2.a] : null;
        if (p1 && p2 && p1[1] === p2[0]) { if (p1[0] === a && p2[1] === b) out.push({ rel: 'grandparent', rule: 'INF-FAMILY-COMPOSE', via: [t1.id, t2.id] }); if (p1[0] === b && p2[1] === a) out.push({ rel: 'grandchild', rule: 'INF-FAMILY-COMPOSE', via: [t1.id, t2.id] }); }
        const s1 = t1.rel === 'sibling' ? [t1.a, t1.b] : null; // sibling(a,x) ∧ sibling(x,b) ⇒ sibling(a,b) when a≠b
        if (s1 && t2.rel === 'sibling') { const x = s1[1]; const o = t2.a === x ? t2.b : t2.b === x ? t2.a : null; if (o && s1[0] === a && o === b && a !== b) out.push({ rel: 'sibling', rule: 'INF-FAMILY-SIBLING-TRANSITIVE', via: [t1.id, t2.id] }); } }
      return out; }
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
      const E = relEdges(facts).filter(e => !e.neg && e.rel === x.rel); const prev = new Map([[a, null]]); const qu = [a];
      while (qu.length) { const n = qu.shift(); for (const e of E) if (e.a === n && !prev.has(e.b)) { prev.set(e.b, e); if (e.b === b) { const path = []; let k = b; while (prev.get(k)) { path.unshift(prev.get(k)); k = prev.get(k).a; } return { rel: x.rel, path }; } qu.push(e.b); } }
      return null; }
    return { disjoint, relOf, relEdges, relPath, locEdges, locPath, isA, classesOf, classReach, famTriples, famRel, genderStated, FAMILY, GENDERED, GENDER_OF_ROLE, npHead };
  }
  const api = { Infer, FAMILY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KInfer = api;
})(typeof self !== 'undefined' ? self : this);
