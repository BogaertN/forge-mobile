/* Realize a kāraka atom with grammar.js clauseText. No sentence table. */
(function (root) {
  'use strict';
  const G = root.KGrammar || (typeof require === 'function' ? require('./grammar.js') : null);
  function npFrom(text) {
    const parts = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1 && parts[0].toLowerCase() === 'you') return { pron: 'user' };
    if (parts.length === 1 && parts[0].toLowerCase() === 'i') return { pron: 'kernel' };
    if (!parts.length) return { head: ['it'], surface: ['it'] };
    let det = null, i = 0;
    if (['the', 'a', 'an'].indexOf(parts[0].toLowerCase()) >= 0) { det = parts[0].toLowerCase(); i = 1; }
    const head = parts.slice(i);
    if (!head.length) return { det: det, head: [det], surface: [det] };
    return { det: det, head: head, surface: head };
  }
  function adjFrom(mods) {
    return (mods || []).map(m => {
      if (m && m.time) return { role: m.role || 'kala', time: m.time };
      return { role: m && m.role, prep: m && m.prep, np: npFrom(m && m.text) };
    });
  }
  function clauseFrom(atom) {
    if (!atom || typeof atom !== 'object') return null;
    if (atom.predicate === 'coord' || (atom.parts && atom.parts.length)) {
      const parts = (atom.parts || []).map(clauseFrom);
      const key = n => JSON.stringify(n && (n.pron ? { pron: n.pron } : { det: n && n.det, head: n && n.head }));
      for (let i = 1; i < parts.length; i++) {
        if (parts[0] && parts[i] && key(parts[i].subj) === key(parts[0].subj)) parts[i].sharedSubj = true;
      }
      return { coord: parts, op: atom.op || 'and', comma: false };
    }
    const tense = atom.tense || 'present';
    const pol = atom.polarity === 'neg' ? 'neg' : 'pos';
    const args = atom.args || [];
    if (atom.predicate === 'is' || atom.predicate === 'be') {
      return {
        subj: npFrom(args[0]),
        verb: { lemma: 'be', tense: tense, pol: pol, mod: 'asserted' },
        pred: { type: 'np', np: npFrom(args[1] || '') },
        adj: adjFrom(atom.modifiers),
      };
    }
    const verb = { lemma: atom.predicate, tense: tense, pol: pol, mod: 'asserted' };
    if (atom.particle) { verb.particle = atom.particle; verb.particlePos = 'post'; }
    const clause = { subj: npFrom(args[0]), verb: verb, roles: {}, adj: adjFrom(atom.modifiers) };
    if (args.length > 1 && args[1] !== '') clause.roles.karma = npFrom(args[1]);
    return clause;
  }
  function realizeAtom(atom) {
    if (!G) throw new Error('grammar_realizer_missing');
    const clause = clauseFrom(atom);
    if (!clause) return '';
    const raw = String(G.clauseText(clause, 'kernel') || '').replace(/\s+/g, ' ').trim();
    if (!raw) return '';
    const cap = raw.charAt(0).toUpperCase() + raw.slice(1);
    return /[.!?]$/.test(cap) ? cap : cap + '.';
  }
  function serve() {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, terminal: false });
    rl.on('line', line => {
      const text = String(line || '').trim();
      if (!text) { process.stdout.write('\n'); return; }
      let out = '';
      try { out = realizeAtom(JSON.parse(text)); } catch (e) { out = ''; }
      process.stdout.write(out.replace(/\n/g, ' ') + '\n');
    });
  }
  root.forgeRealizeAtom = function (raw) {
    const atom = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return realizeAtom(atom);
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { realizeAtom, clauseFrom };
  if (typeof process !== 'undefined' && process.argv && process.argv.indexOf('--serve') >= 0) serve();
})(typeof self !== 'undefined' ? self : globalThis);
