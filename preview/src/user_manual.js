/* The user manual is a knowledge source. Node reads docs/USER_MANUAL.md. The browser
 * holds the same text. If the two diverge, rows() throws. Each line is parsed by the
 * grammar. A line that does not parse is not a clause. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const SOURCE = 'Forge user manual';
  const DOC = 'docs/USER_MANUAL.md';
  const TEXT = '# Forge user manual\n\nThese sentences are the shipped behavior.\n\nForge reads them as clauses.\n\nForge does not quote this page.\n\nYou answer a question from a remembered fact.\n\nYou remember a sentence by an explicit request.\n\nI remember a sentence by an explicit request.\n\nYou derive a sentence by a fixed rule.\n\nYou do not call a language model.\n\nYou retract a sentence when the user forgets it.\n\nYou hold a claim that a ledger has refuted.\n\nYou recall a fact by its address.\n\nYou trace a derivation by a proof.\n\nYou look up a gap by Athena.\n\nYou share a memory by a packet.\n\nYou run a simulation on this phone.\n\nYou send a heavy simulation to a home computer.\n\nA remembered fact keeps an address.\n\nThe gates stay fixed.\n';
  function documentText() {
    if (isNode) {
      const fs = require('fs');
      const path = require('path');
      const disk = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'USER_MANUAL.md'), 'utf8');
      if (disk.trim() !== TEXT.trim()) throw new Error('user manual drifted from docs/USER_MANUAL.md');
      return disk;
    }
    return TEXT;
  }
  function sentences() {
    return documentText().split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
  }
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
  const api = { SOURCE, DOC, TEXT, documentText, sentences, rows };
  if (isNode) module.exports = api; else root.KUserManual = api;
})(typeof self !== 'undefined' ? self : this);
