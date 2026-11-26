/* The user manual is a knowledge source. Each sentence is parsed by the same grammar as any other
 * sentence. Provenance names the manual. Nothing here is a reply string. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const SOURCE = 'Forge user manual';
  const DOC = 'docs/USER_MANUAL.md';
  const SENTENCES = [
    'You answer a question from a remembered fact.',
    'You remember a sentence by an explicit request.',
    'I remember a sentence by an explicit request.',
    'You derive a sentence by a fixed rule.',
    'You do not call a language model.',
    'You retract a sentence when the user forgets it.',
    'You hold a claim that a ledger has refuted.',
    'You run a simulation on this phone.',
    'You send a heavy simulation to a home computer.',
    'A remembered fact keeps an address.',
    'The gates stay fixed.'
  ];
  function sentences() { return SENTENCES.slice(); }
  function rows(QF, F) {
    if (!QF || typeof QF.clause !== 'function') return [];
    const out = [];
    sentences().forEach((text, i) => {
      let clause = null;
      try { clause = QF.clause(text, F); } catch (e) { clause = null; }
      if (!clause || !clause.parsed) return;
      out.push({
        id: 'manual:' + i, memory_id: 'manual:' + i, text: text, tier: 'self', trust: 'trusted', clause: clause,
        provenance: { source: SOURCE, doc: DOC, kind: 'manual', perspective: 'asker_to_kernel' }
      });
    });
    return out;
  }
  const api = { SOURCE, DOC, sentences, rows };
  if (isNode) module.exports = api; else root.KUserManual = api;
})(typeof self !== 'undefined' ? self : this);
