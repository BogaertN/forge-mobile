/* selfmodel.js (4.9.48): Forge's model of itself. Questions whose kartā (or copular subject) is the addressee — Forge — are answered from a small set of
 * TRUE facts about Forge, held as kāraka structures (grammar.js clause nodes), never as reply strings. The answer is composed per question:
 *   1. the question's own clause is re-voiced as Forge's statement (polarity from the self-model), so the wording follows the question;
 *   2. the reason facts are selected by the CLASS of the questioned predicate, read from the lexicon (WordNet lexicographer file of the verb's senses,
 *      the feeling class of an adjective's nominalisation, the hypernym class of a predicate noun) — no phrase routes;
 *   3. the realizer (derive.js) and the inward grammar render and Echo-check every sentence.
 * The facts are honest: Forge is a computer program that runs deterministically; it computes RSOC operators and derives sentences by rules; it has no sensation, no emotion,
 * no body and no experience. Deterministic, no model, no statistics. */
(function (root) {
const isNode = typeof module !== 'undefined' && module.exports;
const K = { pron: 'kernel' };
const V = (lemma, pol, o) => Object.assign({ lemma, tense: 'present', pol: pol || 'pos', mod: 'asserted' }, o || {});
const NP = (head, o) => Object.assign({ head: [].concat(head) }, o || {});
const PL = (head, o) => Object.assign({ head: [head], plural: true, surface: [o && o.pl || head + 's'] }, o ? (() => { const x = Object.assign({}, o); delete x.pl; return x; })() : {});
/* the self-model: each fact is a clause with kartā = Forge */
const FACTS = {
  identity: { subj: K, verb: V('be'), pred: { type: 'np', np: NP(['computer', 'program'], { det: 'a' }) } },
  rsoc: { subj: K, verb: V('compute'), roles: { karma: PL('operator', { det: 'the', of: NP(['RSOC', 'calculus'], { det: 'the', surface: ['RSOC', 'calculus'] }) }) } },
  rules: { subj: K, verb: V('derive'), roles: { karma: PL('sentence') }, adj: [{ prep: 'by', np: PL('rule', { adjs: ['fixed'] }), role: 'karana' }] },
  memory: { subj: K, verb: V('know'), roles: { karma: PL('fact', { det: 'the' }) }, adj: [{ prep: 'in', np: NP('memory', { owner: 'kernel' }), role: 'adhikarana' }] },
  sensation: { subj: K, verb: V('have'), roles: { karma: NP('sensation', { quant: 'no' }) } },
  emotion: { subj: K, verb: V('have'), roles: { karma: PL('emotion', { quant: 'no' }) } },
  body: { subj: K, verb: V('have'), roles: { karma: NP('body', { quant: 'no' }) } },
  experience: { subj: K, verb: V('have'), roles: { karma: NP('experience', { quant: 'no' }) } },
  device: { subj: K, verb: V('run'), adj: [{ prep: 'on', np: NP('device', { det: 'this' }), role: 'adhikarana' }] },
  person: { subj: K, verb: V('be', 'neg'), pred: { type: 'np', np: NP('person', { det: 'a' }) } },
};
/* predicates the self-model settles directly (true facts, by lexical class membership) */
const SELF_ADJ = { conscious: 'neg', sentient: 'neg', alive: 'neg', aware: 'neg', living: 'neg', human: 'neg', mortal: 'neg', afraid: 'feeling', scared: 'feeling' };
/* verb classes: the WordNet lexicographer file of a verb's senses decides which self-fact answers it */
const EXPERIENCE = new Set(['verb.emotion', 'verb.perception', 'verb.body', 'verb.consumption']);
const BODILY = new Set(['verb.motion', 'verb.contact', 'verb.weather']);
const REASON_OF = { 'verb.emotion': ['emotion', 'experience'], 'verb.perception': ['sensation', 'experience'], 'verb.body': ['body', 'sensation'], 'verb.consumption': ['body', 'sensation'], 'verb.motion': ['body', 'device'], 'verb.contact': ['body', 'device'], 'verb.weather': ['body', 'device'] };
const clone = x => JSON.parse(JSON.stringify(x));

function SelfModel(o) { const lex = o.lex, INF = o.INF;
  const lexnames = (lemma, pos) => lex.senses(lemma).filter(s => s.pos === pos).map(s => s.lexname);
  /* verb class: first (most frequent) sense; an experiential reading among the first two senses also counts (dream: creation / perception) */
  function verbClass(lemma) { const ls = lexnames(lemma, 'v'); if (!ls.length) return null; if (EXPERIENCE.has(ls[0]) || BODILY.has(ls[0]) || ls[0] === 'verb.cognition' || ls[0] === 'verb.communication') return ls[0]; const e = ls.slice(0, 2).find(l => EXPERIENCE.has(l)); return e || ls[0]; }
  /* adjective class: the self-model's own adjectives first; otherwise an adjective whose nominalisation (WordNet noun: -ness / -ity / the same stem) is a
     feeling (noun.feeling) names an emotion */
  function adjClass(a) { if (SELF_ADJ[a]) return SELF_ADJ[a] === 'feeling' ? 'feeling' : SELF_ADJ[a] === 'pos' ? 'self_pos' : 'self_neg';
    const stems = [a + 'ness', a.replace(/y$/, 'iness'), a + 'ity', a.replace(/e$/, 'ity'), a.replace(/ed$/, 'edness'), a.replace(/ry$/, 'er'), a.replace(/d$/, ''), a.replace(/ed$/, ''), a];
    for (const n of stems) if (lex.hasPos(n, 'n') && lexnames(n, 'n').includes('noun.feeling')) return 'feeling';
    return null; }
  function nounClass(h) { if (!INF || !INF.isA) return null; const is = t => { try { return INF.isA(h, t).status === 'yes'; } catch (e) { return false; } };
    if (h === 'program' || is('program') || is('software')) return 'self_pos';
    if (is('person') || is('organism') || is('animal')) return 'living';
    if (is('machine') || is('device') || is('computer')) return 'machine';
    return null; }
  /* LL-NPI (polarity licensing): under negation an existential some-pronoun surfaces as its any-form ("I do not want anything") */
  const NPI = { something: 'anything', someone: 'anyone', somebody: 'anybody' };
  const npi = n => { if (!n || typeof n !== 'object') return; if (n.indef && NPI[n.indef]) n.indef = NPI[n.indef]; for (const k of Object.keys(n)) if (k !== 'verb') npi(n[k]); };
  const statement = (q, pol) => { const c = clone(q); if (pol === 'neg') { npi(c.roles); npi(c.adj); } if (/^(possible|conditional)$/.test(c.verb.mod)) c.verb.mod = 'able'; /* "could / might you V" asks about ability: Forge states what it can do */ c.subj = clone(K); c.verb = Object.assign({}, c.verb, { pol }); delete c.verb.dosupport; delete c.verb.f; delete c.verb.form; if (c.verb.tense !== 'past' && c.verb.tense !== 'future') c.verb.tense = 'present'; return c; };
  const facts = ks => ks.map(k => clone(FACTS[k]));
  const out = (answer, said, ks, rule, cls, wh) => ({ meaning: Object.assign({ kind: 'self_answer', clauses: (said ? [said] : []).concat(facts(ks)) }, answer && YN ? { answer } : {}, said ? { restated: true } : {}), rule, cls }); /* a yes / no / partly particle only answers a yes / no question */
  let YN = false;
  /* answer(q, gap, wh): q is the parsed question clause (or the copular frame); returns { meaning, rule, cls } or null (not a self-question this model settles) */
  function answer(q, gap, wh) { if (!q || q.coord || !q.verb || q.cond) return null; YN = !gap && !wh; const isK = n => n && n.pron === 'kernel' && !n.conj;
    /* identity: a wh-copula question whose subject is Forge and whose predicate is the gap */
    /* SELF-ATTRIBUTE (4.9.82): "what are your N" with N an attribute / state noun (WordNet noun.attribute / noun.state: limits, weaknesses,
       strengths) is answered by what Forge is, does, and lacks */
    if (gap === 'pred' && q.verb.lemma === 'be' && q.subj && q.subj.owner === 'kernel' && q.subj.head && !q.subj.of) { const h = q.subj.head[q.subj.head.length - 1], l0 = lexnames(h, 'n')[0]; if (l0 === 'noun.attribute' || l0 === 'noun.state') return out(null, null, ['identity', 'rules', 'memory', 'experience', 'body'], 'SELF-ATTRIBUTE', l0); }
    if (gap === 'pred' && isK(q.subj) && q.verb.lemma === 'be') return out(null, null, wh === 'who' ? ['identity', 'person', 'rules', 'rsoc'] : ['identity', 'rsoc', 'rules', 'memory'], 'SELF-IDENTITY', 'identity');
    if (!isK(q.subj)) return null;
    if (gap && gap !== null && !/^role:karma$/.test(gap)) return null;
    const L = q.verb.lemma;
    /* SELF-HAVE (4.9.82): "do you have N" — the karma's WordNet class decides: an affective state (noun.feeling, or a sense glossed as affective /
       emotional) → no emotions; a body part or body (noun.body) → no body; a percept (noun.perception?) → no sensation */
    if (L === 'have' && !gap && q.roles && q.roles.karma && q.roles.karma.head && !q.roles.karma.propn) { const h = q.roles.karma.head[q.roles.karma.head.length - 1], ss = lex.senses(h).filter(s => s.pos === 'n').slice(0, 2);
      if (ss.some(s => s.lexname === 'noun.feeling' || /\b(affective|emotional)\b/.test(s.gloss))) return out('no', statement(q, 'neg'), ['emotion', 'experience', 'identity'], 'SELF-HAVE', 'feeling');
      if (ss[0] && ss[0].lexname === 'noun.body') return out('no', statement(q, 'neg'), ['body', 'sensation', 'identity'], 'SELF-HAVE', 'body'); }
    /* SELF-FALLIBLE (4.9.82): "can you V N" whose karma is glossed as something wrong / not correct (mistake, error) asks whether Forge can be
       wrong: yes — it derives by fixed rules from the facts it is given, so a wrong fact or a missing rule gives a wrong answer */
    if (q.verb.mod === 'able' && !gap && q.roles && q.roles.karma && q.roles.karma.head) { const h = q.roles.karma.head[q.roles.karma.head.length - 1]; if (lex.senses(h).filter(s => s.pos === 'n').slice(0, 2).some(s => /\b(wrong|not correct|incorrect)\b/.test(s.gloss))) return out('yes', statement(q, 'pos'), ['rules', 'memory'], 'SELF-FALLIBLE', 'error'); }
    /* copular yes/no: "are you X" */
    if (L === 'be' && !gap && q.pred) { const p = q.pred;
      if (p.type === 'adj' && p.words.length === 1) { const c = adjClass(p.words[0]); if (!c) { const r = out(null, null, ['identity', 'rsoc'], 'SELF-UNDECIDED', 'adj:unknown'); r.meaning.undecided = statement(q, 'pos'); return r; } /* the self-model does not settle it: say so, then state what it does hold */
        if (c === 'self_pos') return out('yes', statement(q, 'pos'), ['identity', 'rules'], 'SELF-PREDICATE', c);
        return out('no', statement(q, 'neg'), c === 'feeling' ? ['emotion', 'identity'] : ['identity', 'experience', 'rsoc'], 'SELF-PREDICATE', c); }
      if (p.type === 'np' && p.np && p.np.head && !p.np.owner && !p.np.of && !p.np.propn) { const h = p.np.head[p.np.head.length - 1], c = nounClass(h);
        if (c === 'self_pos') return out('yes', statement(q, 'pos'), ['rsoc', 'rules'], 'SELF-CLASS', c);
        if (c === 'living') return out('no', statement(q, 'neg'), ['identity', 'experience'], 'SELF-CLASS', c);
        if (c === 'machine') return out('partly', null, ['identity', 'device', 'rsoc'], 'SELF-CLASS', c); }
      return null; }
    /* a predicative adjective of a linking verb (vidheya: "get lonely", "feel happy") classes the question by the adjective */
    const vid = q.roles && q.roles.vidheya && q.roles.vidheya.of !== 'karma' && q.roles.vidheya.adjp; if (vid && vid.length === 1) { const c = adjClass(vid[0]); if (c === 'feeling' || c === 'self_neg') return out('no', gap === 'role:karma' ? null : statement(q, 'neg'), c === 'feeling' ? ['emotion', 'experience', 'identity'] : ['experience', 'identity'], 'SELF-PREDICATE', c); }
    const vc = verbClass(L); if (!vc) return null; const asked = gap === 'role:karma' ? null : q; /* a wh-karma question has no single statement to re-voice */
    if (EXPERIENCE.has(vc) || BODILY.has(vc)) { let rs = REASON_OF[vc].slice(); const ro = q.roles || {};
      /* the karma's own lexical class sharpens the reason: a feeling (noun.feeling) → no emotions; a bodily state or percept → no sensation */
      const kh = ro.karma && ro.karma.head ? ro.karma.head[ro.karma.head.length - 1] : null, kl = kh ? lexnames(kh, 'n')[0] : null;
      if (kl === 'noun.feeling') rs = ['emotion', 'experience']; else if (kl === 'noun.state' || kl === 'noun.body' || kl === 'noun.phenomenon' || kl === 'noun.attribute') rs = ['sensation', 'experience'];
      /* an upādhi ("as a machine") of the machine / device class adds the fact about what Forge runs on */
      const up = (q.adj || []).find(a => a.role === 'upadhi' && a.np && a.np.head); if (up && nounClass(up.np.head[up.np.head.length - 1]) === 'machine') rs = rs.concat(['device']);
      return out('no', asked && statement(asked, 'neg'), rs.concat(['identity']).filter((k, i, a) => a.indexOf(k) === i), 'SELF-NO-EXPERIENCE', vc); }
    if (vc === 'verb.cognition') { const vis = (q.adj || []).find(a => a.role === 'vishaya' && a.np);
      if (gap === 'role:karma' && vis) return out(null, { subj: clone(K), verb: V('have'), roles: { karma: NP('opinion', { quant: 'no' }) }, adj: [clone(vis)] }, ['memory', 'experience'], 'SELF-COGNITION-NO-OPINION', vc);
      return out('partly', null, ['rules', 'rsoc', 'experience'], 'SELF-COGNITION-PROCEDURE', vc); }
    if (vc === 'verb.communication' && q.verb.mod === 'able') return out('yes', statement(q, 'pos'), ['rules'], 'SELF-COMMUNICATION', vc);
    return null; }
  return { answer, FACTS, verbClass, adjClass, nounClass };
}
const api = { SelfModel, FACTS, SELF_ADJ };
if (isNode) module.exports = api; else root.KSelf = api;
})(typeof self !== 'undefined' ? self : this);
