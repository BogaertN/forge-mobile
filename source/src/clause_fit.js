/* A gathered copula stays only when the lexicon's taxonomy says the predicate fits the subject.
 * A noun on the subject's hypernym chain is class membership. A body part is a has-relation.
 * A taxon whose parent synset is the head "class" is not a count predicate. Several copulas of
 * one subject become one coordinated predicate, realized by grammar.js. */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const DEPTH = 6;
  function grammar() { return root.KGrammar || (isNode ? require('./grammar.js') : null); }
  function qframe() { return root.KQFrame || (isNode ? require('./qframe.js') : null); }
  function sid(sense) {
    return String((sense && (sense.sid || sense.id)) || '').replace(/^wn30:/, '');
  }
  function wn(lex) { return (lex && lex.wn) || {}; }
  function hyp(lex, id) {
    const banks = wn(lex);
    for (const tier of ['core', 'ext', 'pro']) {
      const table = banks[tier] && banks[tier].H;
      if (table && Object.prototype.hasOwnProperty.call(table, id)) return table[id];
    }
    return [];
  }
  function headName(lex, id) {
    const banks = wn(lex);
    for (const tier of ['core', 'ext', 'pro']) {
      const table = banks[tier] && banks[tier].N;
      if (table && Object.prototype.hasOwnProperty.call(table, id)) return table[id];
    }
    return '';
  }
  function ancestors(lex, id, limit) {
    const out = [];
    const seen = {};
    let layer = [id];
    let hop = 0;
    while (layer.length && hop <= limit) {
      const next = [];
      layer.forEach(node => {
        if (seen[node]) return;
        seen[node] = 1;
        out.push({ id: node, head: headName(lex, node), hop: hop });
        hyp(lex, node).forEach(parent => next.push(parent));
      });
      layer = next;
      hop += 1;
    }
    return out;
  }
  function nounSenses(lex, word) {
    return ((lex && lex.senses && lex.senses(word)) || []).filter(s => s && s.pos === 'n');
  }
  function subjectSense(lex, topic, chosen) {
    if (chosen && (chosen.sid || chosen.id)) return chosen;
    const senses = nounSenses(lex, topic);
    return senses.find(s => s.lexname === 'noun.animal') || senses[0] || null;
  }
  function parentHead(lex, sense) {
    const parents = hyp(lex, sid(sense));
    return parents.length ? headName(lex, parents[0]) : '';
  }
  function isPart(lex, sense) {
    if (sense.lexname === 'noun.body') return true;
    return ancestors(lex, sid(sense), 8).some(node => node.hop > 0 && node.head === 'body part');
  }
  function onChain(lex, subject, word) {
    const chain = ancestors(lex, sid(subject), DEPTH);
    const senses = nounSenses(lex, word);
    return chain.some(node => node.hop > 0 && (node.head === word || senses.some(s => sid(s) === node.id)));
  }
  function read(text, forge) {
    const Q = qframe();
    if (!Q || !Q.clause) return null;
    let clause = null;
    try { clause = Q.clause(text, forge); } catch (e) { clause = null; }
    if (!clause || clause.parsed === false) return { kind: 'unparsed' };
    const verb = (clause.verb && clause.verb.lemma) || clause.kriya;
    if (verb !== 'be') return { kind: 'other' };
    if (clause.pred && clause.pred.type === 'adj') {
      const word = (clause.pred.words && clause.pred.words[0]) || clause.pred.text;
      return word ? { kind: 'adj', word: String(word).toLowerCase() } : { kind: 'other' };
    }
    const np = clause.pred && clause.pred.type === 'np' ? clause.pred.np || clause.pred : null;
    const head = np && (np.head || clause.pred.head);
    let heads = Array.isArray(head) ? head.filter(Boolean) : (head ? [head] : []);
    const lex = forge && forge.lexicon;
    (np && np.adjs || []).forEach(w => { if (lex && lex.hasPos && lex.hasPos(w, 'n')) heads.unshift(w); });
    if (heads.length) return { kind: 'np', word: heads.join(' ').toLowerCase(), heads: heads };
    return { kind: 'other' };
  }
  function judge(topic, text, forge, chosen) {
    const lex = forge && forge.lexicon;
    const readAs = read(text, forge);
    if (!lex || !readAs) return { keep: true, relation: 'keep' };
    if (readAs.kind === 'unparsed') return { keep: false, relation: 'drop', reason: 'unparsed' };
    if (readAs.kind === 'other') return { keep: true, relation: 'keep' };
    if (readAs.kind === 'adj') {
      const ok = lex.hasPos && (lex.hasPos(readAs.word, 'a') || lex.hasPos(readAs.word, 's'));
      return ok ? { keep: true, relation: 'be', kind: 'adj', word: readAs.word } : { keep: false, relation: 'drop', reason: 'not_an_adjective' };
    }
    const heads = readAs.heads && readAs.heads.length ? readAs.heads : String(readAs.word || '').split(/\s+/).filter(Boolean);
    const word = heads.length ? heads[heads.length - 1] : '';
    const phrase = heads.join(' ');
    if (!word || word.length < 3) return { keep: false, relation: 'drop', reason: 'not_a_noun' };
    const senses = nounSenses(lex, word);
    if (!senses.length) return { keep: false, relation: 'drop', reason: 'not_a_noun' };
    const subject = subjectSense(lex, topic, chosen);
    if (senses.some(s => parentHead(lex, s) === 'class')) return { keep: false, relation: 'drop', reason: 'taxon_class' };
    if (subject && onChain(lex, subject, word)) return { keep: true, relation: 'be', kind: 'class', word: phrase };
    if (senses.some(s => isPart(lex, s))) return { keep: true, relation: 'have', kind: 'part', word: word };
    return { keep: false, relation: 'drop', reason: 'off_chain' };
  }
  function say(clause) {
    const G = grammar();
    if (!G) return '';
    let text = '';
    try { text = String(G.clauseText(clause, 'kernel') || ''); } catch (e) { text = ''; }
    if (!text) return '';
    const cap = text.charAt(0).toUpperCase() + text.slice(1);
    return /[.!?]$/.test(cap) ? cap : cap + '.';
  }
  function detFor(word) { return 'aeiou'.indexOf(String(word || '').charAt(0)) >= 0 ? 'an' : 'a'; }
  function copula(topic, items) {
    const parts = items.map(item => {
      const words = String(item.word || '').split(/\s+/).filter(Boolean);
      return item.kind === 'adj'
        ? { head: words, surface: words }
        : { det: detFor(words[0]), head: words, surface: words };
    });
    const phrase = parts.length === 1 ? parts[0] : { conj: parts, op: 'and' };
    return say({
      subj: { det: 'the', head: [topic], surface: [topic] },
      verb: { lemma: 'be', tense: 'past', pol: 'pos', mod: 'asserted' },
      pred: { type: 'np', np: phrase }
    });
  }
  function hasPart(topic, word) {
    return say({
      subj: { det: 'the', head: [topic], surface: [topic] },
      verb: { lemma: 'have', tense: 'past', pol: 'pos', mod: 'asserted' },
      roles: { karma: { det: detFor(word), head: [word], surface: [word] } }
    });
  }
  function fitList(topic, clauses, forge, chosen) {
    const rest = [];
    const copulas = [];
    const parts = [];
    (clauses || []).forEach(clause => {
      const judged = judge(topic, clause && clause.text, forge, chosen);
      if (!judged.keep) return;
      if (judged.relation === 'have' && judged.word) {
        const text = hasPart(topic, judged.word);
        if (text) parts.push(Object.assign({}, clause, { text: text, fact: false, single_source: clause.single_source !== false, admitted: false, fit: 'part' }));
        return;
      }
      if (judged.relation === 'be' && judged.word) {
        copulas.push(judged);
        return;
      }
      rest.push(clause);
    });
    const spoken = [];
    if (copulas.length) {
      const text = copula(topic, copulas);
      if (text) spoken.push({
        text: text, source_count: 1, publishers: ['oewn'], admitted: false, single_source: true, fact: false,
        fit: 'class', fit_atom: { predicate: 'be', args: ['the ' + topic], pred_parts: copulas.map(item => (item.kind === 'adj' ? item.word : detFor(item.word) + ' ' + item.word)), tense: 'past' }
      });
    }
    return spoken.concat(parts, rest);
  }
  const api = { judge: judge, fitList: fitList, copula: copula };
  if (isNode) module.exports = api; else root.KClauseFit = api;
})(typeof self !== 'undefined' ? self : this);
