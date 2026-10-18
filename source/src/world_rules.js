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
    { pred: 'inside', transitive: true, inverse: 'contain', containment: 'inner' }, { pred: 'contain', transitive: true, inverse: 'inside', containment: 'outer' },
    { pred: 'in', transitive: true, containment: 'inner' }, { pred: 'within', transitive: true, containment: 'inner' },
    { pred: 'part_of', phrase: 'part of', transitive: true, containment: 'inner' }, { pred: 'ancestor_of', phrase: 'ancestor of', transitive: true, inverse: 'descendant_of' },
    { pred: 'descendant_of', phrase: 'descendant of', transitive: true, inverse: 'ancestor_of' },
    { pred: 'parent_of', phrase: 'parent of', inverse: 'child_of' }, { pred: 'child_of', phrase: 'child of', inverse: 'parent_of' },
    { pred: 'mother_of', phrase: 'mother of', functional: 'object', one: { who: 'person', has: 'mother' } }, { pred: 'father_of', phrase: 'father of', functional: 'object', one: { who: 'person', has: 'father' } },
    { pred: 'greater_than', inverse: 'less_than', comparative: ['greater', 'more', 'larger'] }, { pred: 'less_than', inverse: 'greater_than', comparative: ['less', 'smaller', 'fewer'] },
    /* 4.9.63 ruling 5: the dimensional comparatives as data (inverse pairs; the order rules give asymmetry and transitivity). "longer" has no
       declared inverse here: "shorter" is the inverse of "taller" only, so a longer/shorter question stays open-world (never a wrong No) */
    { pred: 'taller_than', inverse: 'shorter_than', comparative: ['taller'] }, { pred: 'shorter_than', inverse: 'taller_than', comparative: ['shorter'] },
    { pred: 'older_than', inverse: 'younger_than', comparative: ['older'] }, { pred: 'younger_than', inverse: 'older_than', comparative: ['younger'] },
    { pred: 'heavier_than', inverse: 'lighter_than', comparative: ['heavier'] }, { pred: 'lighter_than', inverse: 'heavier_than', comparative: ['lighter'] },
    { pred: 'wider_than', inverse: 'narrower_than', comparative: ['wider'] }, { pred: 'narrower_than', inverse: 'wider_than', comparative: ['narrower'] },
    { pred: 'higher_than', inverse: 'lower_than', comparative: ['higher'] }, { pred: 'lower_than', inverse: 'higher_than', comparative: ['lower'] },
    { pred: 'deeper_than', inverse: 'shallower_than', comparative: ['deeper'] }, { pred: 'shallower_than', inverse: 'deeper_than', comparative: ['shallower'] },
    { pred: 'married_to', phrase: 'married to', symmetric: true }, { pred: 'next_to', phrase: 'next to', symmetric: true },
    { pred: 'adjacent_to', phrase: 'adjacent to', symmetric: true }, { pred: 'sibling_of', phrase: 'sibling of', symmetric: true },
    { pred: 'before', transitive: true, inverse: 'after' }, { pred: 'after', transitive: true, inverse: 'before' },
    { pred: 'above', transitive: true, inverse: 'below' }, { pred: 'below', transitive: true, inverse: 'above' },
    { pred: 'born_in', phrase: 'born in', functional: 'subject', one: { who: 'person', has: 'birthplace' } }, { pred: 'capital_of', phrase: 'capital of', functional: 'subject', one: { who: 'capital', has: 'country' } },
    { pred: 'alias_of', phrase: ['also called', 'also known as'], symmetric: true, transitive: true, alias: true }]);
  const REL_BY = new Map(RELATIONS.map(r => [r.pred, r]));
  /* M5 (4.9.64) MEA MANIFEST OVERLAY: an adopted manifest (mea.js) is a list of property deltas { pred, prop, value } over these rows; only the
     yes/no properties in MEA_MUTABLE change, the grammar's phrases and comparative words never do. null = the shipped rows. */
  const MEA_MUTABLE = Object.freeze(['transitive', 'symmetric']); let OVER = null;
  const setManifest = deltas => { if (!deltas || !deltas.length) { OVER = null; return null; } const m = new Map(); for (const d of deltas) { const b = REL_BY.get(d.pred); if (!b || !MEA_MUTABLE.includes(d.prop)) continue; const r = m.get(d.pred) || Object.assign({}, b); r[d.prop] = !!d.value; m.set(d.pred, r); } OVER = m.size ? m : null; return OVER ? [...OVER.keys()] : null; };
  const rowOf = b => (OVER && OVER.get(b)) || REL_BY.get(b);
  const relInfo = p => { const ps = /^past_/.test(String(p)), b = ps ? String(p).slice(5) : String(p); const r = rowOf(b); return r ? { row: r, past: ps, base: b } : null; };
  /* 4.9.61 ruling 3: comparative words declared on a row ('X is less / smaller / fewer than Y') name that row's predicate */
  const COMPARATIVES = new Map(RELATIONS.flatMap(r => (r.comparative || []).map(w => [w, r.pred])));
  const PHRASES = RELATIONS.filter(r => r.phrase).flatMap(r => [].concat(r.phrase).map(phrase => ({ phrase, pred: r.pred })));
  /* 4.9.61 ruling 1: two values of a functional relation are APART (a real contradiction) only if they are different names, neither is known to
     contain / be inside the other through the declared containment rows (transitively, either direction), and they are not declared aliases.
     Computed from the stated atoms alone (stratified: functional rules never conclude containment or alias atoms), so a checker re-derives it. */
  function apartness(atoms) { const par = new Map(), find = x => { while (par.has(x) && par.get(x) !== x) x = par.get(x); return x; }, up = new Map();
    for (const a of atoms) { const r = a && a.polarity === 'pos' && a.args.length === 2 && rowOf(String(a.predicate).replace(/^past_/, '')); if (r && r.alias) { const x = find(a.args[0]), y = find(a.args[1]); if (x !== y) par.set(x < y ? y : x, x < y ? x : y); } }
    for (const a of atoms) { const r = a && a.polarity === 'pos' && a.args.length === 2 && rowOf(String(a.predicate).replace(/^past_/, '')); if (!r || !r.containment) continue;
      const [i, o] = r.containment === 'inner' ? a.args : [a.args[1], a.args[0]], k = find(i); if (!up.has(k)) up.set(k, new Set()); up.get(k).add(find(o)); }
    const reach = (x, y) => { const seen = new Set([x]), st = [x]; while (st.length) { const n = st.pop(); for (const m of up.get(n) || []) { if (m === y) return true; if (!seen.has(m)) { seen.add(m); st.push(m); } } } return false; };
    return (y, z) => { if (y === z) return false; const a = find(y), b = find(z); return a !== b && !reach(a, b) && !reach(b, a); }; }
  /* the property rules of a predicate and of its inverse partner, in the TurnWorld atom language (prop = which declared property) */
  function propertyRules(p) { const i = relInfo(p); if (!i) return []; const pre = i.past ? 'past_' : '', seen = new Set(), out = [];
    const preds = [i.base].concat(i.row.inverse ? [i.row.inverse] : []);
    for (const b of preds) { const r = rowOf(b); if (!r) continue; const q = pre + b, add = (prop, body, head, guard) => { const k = JSON.stringify([body, head]); if (seen.has(k)) return; seen.add(k); out.push(Object.assign({ prop, pred: b, body, head }, guard ? { guard } : {})); };
      if (r.transitive && !/_than$/.test(b)) add('transitive', [A(q, '$x', '$y'), A(q, '$y', '$z')], A(q, '$x', '$z'));
      if (r.symmetric) add('symmetric', [A(q, '$x', '$y')], A(q, '$y', '$x'));
      if (r.inverse) add('inverse', [A(q, '$x', '$y')], A(pre + r.inverse, '$y', '$x'));
      if (r.functional === 'subject') add('functional', [A(q, '$x', '$y'), A(q, '$x', '$z')], A(q, '$x', '$z', 'neg'), [['apart', '$y', '$z']]);
      if (r.functional === 'object') add('functional', [A(q, '$y', '$x'), A(q, '$z', '$x')], A(q, '$z', '$x', 'neg'), [['apart', '$y', '$z']]); }
    return out; }
  /* the same rules as data rules for the rule engine (durable world): stable ids RELPROP-<PROPERTY>:<pred> */
  /* 4.9.63 ruling 4: a comparative row (declared comparative words, *_than) is an ORDER in the durable world too — transitive and asymmetric — the
     same two rules the turn world gives every comparative (reason.js orderRules), so stored comparatives derive and refute like the turn world */
  function orderRules(p) { const i = relInfo(p); if (!i || !/_than$/.test(i.base)) return []; const out = [];
    for (const b of [i.base].concat(i.row.inverse ? [i.row.inverse] : [])) { const r = rowOf(b); if (!r || !r.comparative) continue;
      out.push({ prop: 'transitive', pred: b, body: [A(b, '$x', '$y'), A(b, '$y', '$z')], head: A(b, '$x', '$z') }, { prop: 'asymmetric', pred: b, body: [A(b, '$x', '$y')], head: A(b, '$y', '$x', 'neg') }); }
    return out; }
  const propertyDataRules = p => propertyRules(p).concat(orderRules(p)).map(r => Object.assign({ id: 'RELPROP-' + r.prop.toUpperCase() + ':' + r.head.predicate.replace(/^past_/, '') + (r.prop === 'inverse' ? '<' + r.pred : ''), name: 'RELPROP-' + r.prop.toUpperCase(), body: r.body, head: r.head }, r.guard ? { guard: r.guard } : {}));
  const api = { setManifest, MEA_MUTABLE, activeManifest: () => (OVER ? [...OVER.keys()] : null), transitiveRule, TRANSITIVE, FAMILY, transitive, RELATIONS, PHRASES, COMPARATIVES, relInfo, apartness, propertyRules, propertyDataRules, orderRules, NAME_PRIORITY: ['INF-FAMILY-COMPOSE', 'INF-FAMILY-SIBLING-TRANSITIVE', 'INF-FAMILY-INVERSE'] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KWorldRules = api;
})(typeof self !== 'undefined' ? self : this);
