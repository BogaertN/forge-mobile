/* world_rules.js: the inference rules of infer.js as DATA (GELC S1): typed Rule objects in the TurnWorld atom/rule language,
   run by the one closure in reason.js and replayed by its checker. "%" in a predicate is the relation placeholder of a
   transitive-closure template, instantiated once per typed relation present in the facts. */
(function (root) {
  const A = (predicate, a, b, polarity) => ({ predicate, args: [a, b], polarity: polarity || 'pos' });
  const TRANSITIVE = Object.freeze([
    { id: 'base', name: 'STATED', body: [A('%', '$a', '$b')], head: A('%+', '$a', '$b') },
    { id: 'step', name: 'TRANSITIVE', body: [A('%+', '$a', '$b'), A('%', '$b', '$c')], head: A('%+', '$a', '$c') }]);
  const FAMILY = Object.freeze([
    { id: 'INF-FAMILY-INVERSE:parent', name: 'INF-FAMILY-INVERSE', body: [A('parent', '$a', '$b')], head: A('child', '$b', '$a') },
    { id: 'INF-FAMILY-INVERSE:child', name: 'INF-FAMILY-INVERSE', body: [A('child', '$a', '$b')], head: A('parent', '$b', '$a') },
    { id: 'INF-FAMILY-INVERSE:sibling', name: 'INF-FAMILY-INVERSE', body: [A('sibling', '$a', '$b')], head: A('sibling', '$b', '$a') },
    { id: 'INF-FAMILY-INVERSE:spouse', name: 'INF-FAMILY-INVERSE', body: [A('spouse', '$a', '$b')], head: A('spouse', '$b', '$a') },
    { id: 'INF-FAMILY-INVERSE:grandparent', name: 'INF-FAMILY-INVERSE', body: [A('grandparent', '$a', '$b')], head: A('grandchild', '$b', '$a') },
    { id: 'INF-FAMILY-INVERSE:grandchild', name: 'INF-FAMILY-INVERSE', body: [A('grandchild', '$a', '$b')], head: A('grandparent', '$b', '$a') },
    { id: 'INF-FAMILY-COMPOSE:grandparent', name: 'INF-FAMILY-COMPOSE', body: [A('parent', '$a', '$b'), A('parent', '$b', '$c')], head: A('grandparent', '$a', '$c') },
    { id: 'INF-FAMILY-SIBLING-TRANSITIVE', name: 'INF-FAMILY-SIBLING-TRANSITIVE', body: [A('sibling', '$a', '$x'), A('sibling', '$x', '$b')], head: A('sibling', '$a', '$b'), guard: [['distinct', '$a', '$b']] }]);
  const sub = (x, p) => Object.assign({}, x, { predicate: x.predicate.replace('%', p) });
  const transitive = (id, p) => TRANSITIVE.map(r => Object.assign({}, r, { id: id + ':' + p + ':' + r.id, body: r.body.map(x => sub(x, p)), head: sub(r.head, p) }));
  /* a promotable rule hypothesis: transitivity of ONE relation, anti-unified from two chained stored edges (never active until admitted) */
  const transitiveRule = p => ({ id: 'GELC-TRANSITIVE:' + p, name: 'GELC-ADMITTED-RULE', body: [A(p, '$a', '$b'), A(p, '$b', '$c')], head: A(p, '$a', '$c'), guard: [['distinct', '$a', '$c']] });
  /* M3 (4.9.60) RELATION PROPERTIES as DATA. One row per binary relation, named by the predicate the world grammar gives it (a preposition, a
     verb lemma, or a declared copular phrase joined by "_"). Properties: transitive, symmetric, inverse (the partner predicate, read in the other
     direction), functional ('subject': one value per subject; 'object': one subject per value), where a second distinct value is a real
     contradiction (distinct names denote distinct things inside one world). `phrase` is the copular surface form the grammar reads ("X is married
     to Y", "X is an ancestor of Y"). Comparatives ("greater than") get their order rules from the comparative construction itself (reason.js), so
     rows ending in _than declare only their inverse. A past form ("was born in") keeps the row's properties. No weights; properties are yes/no. */
  const RELATIONS = Object.freeze([
    { pred: 'inside', transitive: true, inverse: 'contain' }, { pred: 'contain', transitive: true, inverse: 'inside' },
    { pred: 'in', transitive: true }, { pred: 'within', transitive: true },
    { pred: 'part_of', phrase: 'part of', transitive: true }, { pred: 'ancestor_of', phrase: 'ancestor of', transitive: true, inverse: 'descendant_of' },
    { pred: 'descendant_of', phrase: 'descendant of', transitive: true, inverse: 'ancestor_of' },
    { pred: 'parent_of', phrase: 'parent of', inverse: 'child_of' }, { pred: 'child_of', phrase: 'child of', inverse: 'parent_of' },
    { pred: 'mother_of', phrase: 'mother of', functional: 'object' }, { pred: 'father_of', phrase: 'father of', functional: 'object' },
    { pred: 'greater_than', inverse: 'less_than' }, { pred: 'less_than', inverse: 'greater_than' },
    { pred: 'married_to', phrase: 'married to', symmetric: true }, { pred: 'next_to', phrase: 'next to', symmetric: true },
    { pred: 'adjacent_to', phrase: 'adjacent to', symmetric: true }, { pred: 'sibling_of', phrase: 'sibling of', symmetric: true },
    { pred: 'before', transitive: true, inverse: 'after' }, { pred: 'after', transitive: true, inverse: 'before' },
    { pred: 'above', transitive: true, inverse: 'below' }, { pred: 'below', transitive: true, inverse: 'above' },
    { pred: 'born_in', phrase: 'born in', functional: 'subject' }, { pred: 'capital_of', phrase: 'capital of', functional: 'subject' }]);
  const REL_BY = new Map(RELATIONS.map(r => [r.pred, r]));
  const relInfo = p => { const ps = /^past_/.test(String(p)), b = ps ? String(p).slice(5) : String(p); const r = REL_BY.get(b); return r ? { row: r, past: ps, base: b } : null; };
  const PHRASES = RELATIONS.filter(r => r.phrase).map(r => ({ phrase: r.phrase, pred: r.pred }));
  /* the property rules of a predicate and of its inverse partner, in the TurnWorld atom language (prop = which declared property) */
  function propertyRules(p) { const i = relInfo(p); if (!i) return []; const pre = i.past ? 'past_' : '', seen = new Set(), out = [];
    const preds = [i.base].concat(i.row.inverse ? [i.row.inverse] : []);
    for (const b of preds) { const r = REL_BY.get(b); if (!r) continue; const q = pre + b, add = (prop, body, head, guard) => { const k = JSON.stringify([body, head]); if (seen.has(k)) return; seen.add(k); out.push(Object.assign({ prop, pred: b, body, head }, guard ? { guard } : {})); };
      if (r.transitive && !/_than$/.test(b)) add('transitive', [A(q, '$x', '$y'), A(q, '$y', '$z')], A(q, '$x', '$z'));
      if (r.symmetric) add('symmetric', [A(q, '$x', '$y')], A(q, '$y', '$x'));
      if (r.inverse) add('inverse', [A(q, '$x', '$y')], A(pre + r.inverse, '$y', '$x'));
      if (r.functional === 'subject') add('functional', [A(q, '$x', '$y'), A(q, '$x', '$z')], A(q, '$x', '$z', 'neg'), [['distinct', '$y', '$z']]);
      if (r.functional === 'object') add('functional', [A(q, '$y', '$x'), A(q, '$z', '$x')], A(q, '$z', '$x', 'neg'), [['distinct', '$y', '$z']]); }
    return out; }
  /* the same rules as data rules for the rule engine (durable world): stable ids RELPROP-<PROPERTY>:<pred> */
  const propertyDataRules = p => propertyRules(p).map(r => Object.assign({ id: 'RELPROP-' + r.prop.toUpperCase() + ':' + r.head.predicate.replace(/^past_/, '') + (r.prop === 'inverse' ? '<' + r.pred : ''), name: 'RELPROP-' + r.prop.toUpperCase(), body: r.body, head: r.head }, r.guard ? { guard: r.guard } : {}));
  const api = { transitiveRule, TRANSITIVE, FAMILY, transitive, RELATIONS, PHRASES, relInfo, propertyRules, propertyDataRules, NAME_PRIORITY: ['INF-FAMILY-COMPOSE', 'INF-FAMILY-SIBLING-TRANSITIVE', 'INF-FAMILY-INVERSE'] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KWorldRules = api;
})(typeof self !== 'undefined' ? self : this);
