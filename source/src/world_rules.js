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
  const api = { transitiveRule, TRANSITIVE, FAMILY, transitive, NAME_PRIORITY: ['INF-FAMILY-COMPOSE', 'INF-FAMILY-SIBLING-TRANSITIVE', 'INF-FAMILY-INVERSE'] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KWorldRules = api;
})(typeof self !== 'undefined' ? self : this);
