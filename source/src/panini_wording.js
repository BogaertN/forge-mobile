/* KPaniniWording (4.9.214, Release C3): derive and reparse, moved out of kernel.js next to grammar.js with the same API.
 * The Pāṇinian kāraka parse over grammar.js (G.Parser with the kernel's lexicon view glex, the open-nominal lexicon for source
 * sentences), the canonical forms (P-BARE-CANON, NP-ADJ-NOUN-CANON), kāraka validity, G-ECONOMY-COMPOUND / G-GIVEN-COMPOUND,
 * the person swap for re-reading the kernel's own sentences, held-reading ancestry, and reparseClause (8.3.1 read backwards).
 * This is the wording step's parser: engine decides → Pāṇini realizes → Echo re-parses. The per-turn derivation state (inward
 * operator counts, the held reading) lives here; the kernel's turn loop calls resetTurnState(). Moved verbatim; no behaviour change. No LLM. */
(function (root) {
const isNode = typeof module !== 'undefined' && module.exports;
function Wording(ctx) {
  const { G, glex, lex, featsOf, M, clone, canon, activeFacts, memNames } = ctx;
  const content = toks => toks.filter(t => !/^[?.!]$/.test(t.w));
  const isUnk = (t, i) => G.analyse(t, i, glex).every(a => a.tag === 'UNK');
  const unknownToks = toks => { const T = G.analyseAll(toks, glex); return [...new Set(T.filter(t => t.an.every(a => a.tag === 'UNK')).map(t => t.w))]; };

  function canonPred(c) { // P-BARE-CANON: bare nominal predicate ≡ adjectival predicate with the same words (one material meaning)
    if (!c || typeof c !== 'object') return c; if (c.coord) { c.coord.forEach(canonPred); return c; }
    const bare = x => x.head && !x.det && !x.owner && !x.quant && !x.num && !x.of && !x.rel && !x.pp && !x.partRel;
    if (c.pred && c.pred.type === 'np') { const n = c.pred.np; if (bare(n)) c.pred = { type: 'adj', words: (n.adjs || []).concat(n.surface || n.head) }; else if (n.conj && n.conj.every(bare)) c.pred = { type: 'adj', words: [].concat(...n.conj.map((x, i) => (i ? [n.op] : []).concat(x.adjs || [], x.surface || x.head))) }; }
    if (c.cond) canonPred(c.cond); if (c.roles && c.roles.karma && c.roles.karma.clause) canonPred(c.roles.karma.clause); if (c.subj && c.subj.rel) canonPred(c.subj.rel);
    return c;
  }
  function canonNPs(c) { // NP-ADJ-NOUN-CANON: leading compound members that are adjectives are modifiers (one material meaning)
    const fixNP = n => { if (!n || typeof n !== 'object') return; if (n.clause) return walk(n.clause); if (n.head && n.head.length > 1) { while (n.head.length > 1 && lex.hasPos(n.head[0], 'a')) { n.adjs = (n.adjs || []).concat([(n.surface || n.head)[0]]); n.head = n.head.slice(1); if (n.surface) n.surface = n.surface.slice(1); } }
      if (n.conj) n.conj.forEach(fixNP); if (n.owner && typeof n.owner === 'object') fixNP(n.owner); if (n.of) fixNP(n.of); if (n.rel) walk(n.rel); };
    const walk = x => { if (!x) return; if (x.coord) return x.coord.forEach(walk); fixNP(x.subj); if (x.pred && x.pred.np) fixNP(x.pred.np); Object.values(x.roles || {}).forEach(fixNP); (x.adj || []).forEach(a => fixNP(a.np)); walk(x.cond); };
    walk(c); return c; }
  const animNP = n => !!n && (n.pron === 'user' || n.pron === 'kernel' || (n.pron3 && n.pron3 !== 'it') || (n.propn && featsOf(n).anim) || (n.head && featsOf(n).anim) || (n.conj && n.conj.every(animNP)));
  const okKaraka = c => !c || (c.coord ? c.coord.every(okKaraka) : !(c.roles && c.roles.sampradana && c.roles.karma && !animNP(c.roles.sampradana)) && okKaraka(c.cond)); // K-SAMPRADANA-ANIMACY (Doc5: recipient is a sentient participant)
  /* OPEN-NOMINAL (4.9.91): a source's sentence may use words the lexicon lacks ("mitochondrion", "eukaryotes"); in a noun position the grammar reads such a word
     as a nominal stem (prātipadika). Used only for proved source text and its re-reading — the user's own words stay closed (unknown words are asked about). */
  let glexO = null; const openLex = () => glexO || (glexO = Object.assign({}, glex, { openNominal: true }));
  function derive(toks, open) { const P = G.Parser(content(toks), open ? openLex() : glex); const all = P.sentence().map(r => ({ node: { type: r.node.type, clause: canonNPs(canonPred(clone(r.node.clause))) }, rules: r.rules.filter(Boolean) })), A = M.rsocAdmit(all, r => okKaraka(r.node.clause), r => canon(G.material(r.node))); for (const k in A.ops) rsIn[k] = (rsIn[k] || 0) + A.ops[k]; const kept = economy(A.kept); if (kept.length < A.kept.length) rsIn.economy = (rsIn.economy || 0) + 1; return { parses: kept, T: P.T }; }
  /* G-ECONOMY-COMPOUND (4.9.50; Chomsky, economy of derivation; Frazier minimal attachment): when derivations of one surface differ only in how many
     words a noun compound absorbs, the derivation with the fewest compound members wins — the word is left to the verb phrase ("the dog | wants water",
     "admitted the patient | last night"). Readings that differ in any other way stay open (Doc3 §40). */
  /* G-GIVEN-COMPOUND (4.9.82): a noun-noun compound already used in the conversation (contiguous in a head of an active fact: "ice cream" in
     "ice cream sales") is given; a reading that keeps it as one noun phrase wins before the economy measures (discourse-given material is not re-analysed) */
  function givenCompound(ps) { let given; try { given = []; const walk = o => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk); if (Array.isArray(o.head) && o.head.length > 1) given.push(o.head.map(String).join(' ')); for (const v of Object.values(o)) walk(v); }; for (const r of activeFacts()) if (!r.sensitive && r.clause) walk(r.clause); } catch (e) { return ps; } if (!given.length) return ps;
    const uses = p => { let n = 0; const walk = o => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk); if (Array.isArray(o.head) && o.head.length > 1) { const s = o.head.map(String).join(' '); if (given.some(g => (' ' + g + ' ').includes(' ' + s + ' ') || (' ' + g + ' ').includes(' ' + o.head.slice(0, -1).join(' ') + ' '))) n++; } for (const v of Object.values(o)) walk(v); }; walk(p.node && p.node.clause); return n; };
    const mx = Math.max(...ps.map(uses)); return mx > 0 ? ps.filter(p => uses(p) === mx) : ps; }
  function economy(ps) { if (ps.length < 2) return ps; ps = givenCompound(ps); if (ps.length < 2) return ps; const cost = p => { let k = 0; const walk = o => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk); if (Array.isArray(o.head)) k += 2 * (o.head.length - 1) + (o.adjs || []).length + o.head.filter(h => lex.tierPos(h, 'n') === 2).length + (!o.det && !o.owner && !o.plural && !o.quant && !o.num && lex.hasPos(o.head[o.head.length - 1], 'a') ? 1 : 0); /* a bare singular head that is also an adjective ("federal") is a marked noun phrase */ /* a complete-tier noun is the lowest-assurance reading and costs one more */ if (o.pp && o.pp.np) k += 1; for (const v of Object.values(o)) walk(v); }; walk(p.node.clause); return k; }; /* a noun-noun compound member is a costlier Merge than an adjective; a noun-phrase PP costs one Merge */ const m = Math.min(...ps.map(cost)); let out = ps.filter(p => cost(p) === m);
    /* then Late Closure (an adjunct attaches to the lowest phrase it can: inside the participle / infinitive / predicate it follows), then the common-noun
       reading of a sentence-initial capital over the name reading (TAG-PROPN-INITIAL-ALT) */
    const low = p => { let k = 0; const walk = o => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk); for (const key of Object.keys(o)) { const v = o[key]; if ((key === 'partRel' || key === 'inf' || key === 'ger' || key === 'pred') && v && typeof v === 'object') k += JSON.stringify(v).split('"prep"').length - 1; walk(v); } }; walk(p.node.clause); return k; };
    if (out.length > 1) { const mx = Math.max(...out.map(low)); out = out.filter(p => low(p) === mx); }
    /* 4.9.91 LATE CLOSURE for coordination: "and" joins the lowest phrase it can — a conjunct that itself ends in a relative / participle clause is not closed early ("… that uses the suite to communicate between networks and devices") */
    { const hi = p => { let k = 0; const walk = o => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk); if (Array.isArray(o.conj)) o.conj.slice(0, -1).forEach(c => { if (c && (c.rel || c.relObj || c.partRel || c.ppRel)) k++; }); Object.values(o).forEach(walk); }; walk(p.node.clause); return k; };
      if (out.length > 1) { const mn = Math.min(...out.map(hi)); out = out.filter(p => hi(p) === mn); } }
    if (out.length > 1) { const fr = out.filter(p => p.rules.includes('K-KARMA-CONTROL-INF')); if (fr.length) out = fr; } /* the verb's own lexicon frame (somebody to INFINITIVE) over a 'to'-adjunct reading of the same words */
    if (out.length > 1) { const np = out.filter(p => !p.rules.includes('TAG-PROPN-INITIAL-ALT') && !JSON.stringify(p.node.clause).includes('"propn"')); if (np.length) out = np; }
    /* then Minimal Attachment of the subject (4.9.51): the verb is taken at the first point the subject phrase is complete ("does aspirin cause gastric
       bleeding" — not a compound subject "aspirin cause" read before a later verb) */
    if (out.length > 1) { const sz = p => { const c = p.node.clause, n = c && c.subj; return n && Array.isArray(n.head) ? n.head.length + (n.adjs || []).length : 0; }; const mn = Math.min(...out.map(sz)); out = out.filter(p => sz(p) === mn); }
    return out.length ? out : ps; }
  let rsIn = {};
  const swap = Object.assign(Object.create(null), { my: 'your', your: 'my', i: 'you', me: 'you', you: 'i', mine: 'yours', yours: 'mine', myself: 'yourself', yourself: 'myself', am: 'are' });
  const swapToks = text => G.tokenize(text).map(t => Object.assign(swap[t.w] ? { w: swap[t.w], orig: swap[t.w], i0: t.i0 } : t, { rendered: true }));
  /* held-reading ancestry (Pāṇini paper D6 L6861–6893; RSOC ⧧ hold → ⧙ after clarification): a clause whose reading the user chose keeps its natural
     surface; on re-parse, the user's own earlier choice (not a frequency guess) selects among the readings */
  const heldKeys = () => new Set(heldNow.concat(activeFacts().filter(r => r.clause && r.clause.resolved_reading).map(r => canon(G.material(r.clause))))); let heldNow = [];
  /* 8.3.1 read backwards (4.9.83): a sentence-initial capital is orthography — a first word that is a common noun of the lexicon (followed by a lower-case word) is read as that noun
     first; a name (no common-noun reading) keeps its capital */
  function reparseClause(text, open) { const m0 = /^([A-Z])([a-z]+)(?=\s+[a-z])/.exec(String(text || '')); /* not an abbreviation or the first word of a capitalised name ("Mr. Pell", "General Motors") */ if (m0 && !(lex.isProper && lex.isProper(m0[1].toLowerCase() + m0[2])) && memNames().get(m0[1].toLowerCase() + m0[2]) !== 'name') /* 4.9.92: a lexicon name keeps its capital */ { const lw = (m0[1].toLowerCase() + m0[2]); const tg = derive(swapToks(lw), open).T || []; if (tg[0] && (tg[0].an || []).some(a => a.tag === 'N') && !(tg[0].an || []).some(a => a.tag === 'PROPN' && a.rule !== 'TAG-PROPN-INITIAL-ALT')) { const r = reparseClause0(lw + String(text).slice(m0[0].length), open); if (r) return r; } } return reparseClause0(text, open); }
  function reparseClause0(text, open) { const d = derive(swapToks(text), open); if (!d.parses.length) return null; const ks = new Set(d.parses.map(p => canon(G.material(p.node.clause)))); if (ks.size === 1) return d.parses[0].node.clause;
    const H = heldKeys(), hit = d.parses.filter(p => H.has(canon(G.material(p.node.clause)))); if (hit.length) return new Set(hit.map(p => canon(G.material(p.node.clause)))).size === 1 ? hit[0].node.clause : null;
    /* 4.9.87: an embedded clause is read as the main clause is (G-ECONOMY: fewest Merges, Late Closure, Minimal Attachment), so a that-clause has the reading its sentence would have */
    let ec = d.parses.every(p => p.node && p.node.clause && p.rules) ? economy(d.parses) : d.parses;
    /* 4.9.248: "after 1.049 seconds" is a kāla adjunct. A rival that reads the unit as a verb ("seconds" = second) is not that adjunct. */
    const durationSub = p => { const s = p.node && p.node.clause && p.node.clause.sub; return !!(s && s.conj === 'after' && s.clause && s.clause.verb && /^(second|minute|hour|day)$/.test(s.clause.verb.lemma)); };
    const kalaAfter = p => ((p.node && p.node.clause && p.node.clause.adj) || []).some(a => a && a.prep === 'after' && a.role === 'kala');
    if (ec.some(durationSub) && ec.some(kalaAfter)) ec = ec.filter(p => !durationSub(p));
    return new Set(ec.map(p => canon(G.material(p.node.clause)))).size === 1 ? ec[0].node.clause : null; }
  /* 4.9.237 OUTWARD COMPILE (Nic plan 229 step 8; R0 read forwards). The engine decides an atom; the wording is compiled here, not
   * quoted. The engine's sentence is read as the kernel's own sentence (reparseClause, person swapped) into a kāraka clause; the
   * clause must state the engine's atom (same kriyā, kartṛ and karma / predicate nominal); the clause is realized by grammar.js
   * (clauseText, the kernel speaking) into R_t; R_t is re-read and must give the same material clause (the round trip is Echo by
   * structure). Any failure returns ok:false with the step that failed; nothing is guessed and no model is used. */
  const normArg = x => String(x == null ? '' : x).toLowerCase().replace(/[.!?]+$/, '').replace(/\s+/g, ' ').trim();
  function adjunctArgs(c) {
    return (c.adj || []).map(a => {
      if (a.time) return { role: a.role || 'kala', time: a.time };
      if (a.prep && a.np) return { role: a.role || null, prep: a.prep, text: G.npText(a.np, 'kernel') };
      return null;
    }).filter(Boolean);
  }
  function atomOfClause(c) {
    if (!c || c.cond) return null;
    /* 4.9.248: a coordination is the atoms of its clauses, in order. A shared kartā is still that clause's kartā. */
    if (c.coord) {
      const parts = c.coord.map(atomOfClause);
      if (parts.some(p => !p)) return null;
      return { lemma: 'coord', op: c.op || 'and', parts, args: [], polarity: 'pos', tense: null };
    }
    if (!c.verb) return null;
    const v = c.verb, subj = c.subj ? G.npText(c.subj, 'kernel') : null;
    if (!subj) return null;
    const base = { lemma: v.lemma, polarity: v.pol || 'pos', tense: v.tense || 'present', modifiers: adjunctArgs(c) };
    if (v.particle) base.particle = v.particle;
    if (v.lemma === 'be' && c.pred && c.pred.type === 'np') return Object.assign(base, { args: [subj, G.npText(c.pred.np, 'kernel')] });
    /* 4.9.241: an adjective predicate states is(kartṛ, adjective) as the engine's atom does ("Your car is red." → is(your car, red)) */
    if (v.lemma === 'be' && c.pred && c.pred.type === 'adj' && Array.isArray(c.pred.words) && c.pred.words.length) return Object.assign(base, { args: [subj, c.pred.words.join(' ')] });
    /* 4.9.248: a prepositional predicate ("is below the density of water") states is(kartṛ, prep + nominal) */
    if (v.lemma === 'be' && c.pred && c.pred.type === 'pp' && c.pred.np) return Object.assign(base, { args: [subj, c.pred.prep + ' ' + G.npText(c.pred.np, 'kernel')] });
    if (c.roles && c.roles.vidheya && Array.isArray(c.roles.vidheya.adjp) && c.roles.vidheya.adjp.length && !(c.roles.karma)) return Object.assign(base, { args: [subj, c.roles.vidheya.adjp.join(' ')] });
    const karma = c.roles && c.roles.karma && !c.roles.karma.clause ? G.npText(c.roles.karma, 'kernel') : null;
    if (karma) return Object.assign(base, { args: [subj, karma] });
    /* an intransitive clause states lemma(kartṛ) */
    return Object.assign(base, { args: [subj] });
  }
  function modifierHit(have, m) {
    return (have || []).some(h => m && m.time ? normArg(h.time) === normArg(m.time) : h && normArg(h.prep) === normArg(m.prep) && normArg(h.text) === normArg(m.text));
  }
  function sameAtom(clauseAtom, given) {
    if (!clauseAtom || !given) return false;
    if (clauseAtom.lemma === 'coord' || normArg(given.predicate) === 'coord') {
      if (clauseAtom.lemma !== 'coord' || normArg(given.predicate) !== 'coord') return false;
      if (given.op && normArg(given.op) !== normArg(clauseAtom.op)) return false;
      const want = given.parts || [];
      const got = clauseAtom.parts || [];
      return want.length === got.length && want.every((p, i) => sameAtom(got[i], p));
    }
    /* in(content, container) is the typed containment atom. The clause may say it as "content is inside container"
     * or as "container contains content". Other prepositions are not this atom. */
    /* live(resident, place) is the verb live plus adhikarana in. geo(place, region) is copular in between
     * two lexicon locations. Neither is the containment atom. */
    if (['ancestor', 'descendant', 'parent', 'child'].indexOf(normArg(given.predicate)) >= 0 && (given.args || []).length === 2) {
      const want = given.args.map(normArg), got = (clauseAtom.args || []).map(normArg);
      const polOk = (given.polarity || 'pos') === (clauseAtom.polarity || 'pos');
      const rel = normArg(given.predicate);
      const dets = rel === 'ancestor' ? ['an', 'the'] : ['a', 'the'];
      const phrases = dets.map(det => det + ' ' + rel + ' of ' + want[1]);
      if (clauseAtom.lemma === 'be' && got.length === 2 && polOk && got[0] === want[0] && phrases.indexOf(got[1]) >= 0) return true;
      return false;
    }
    if (normArg(given.predicate) === 'part' && (given.args || []).length === 2) {
      const want = given.args.map(normArg), got = (clauseAtom.args || []).map(normArg);
      const polOk = (given.polarity || 'pos') === (clauseAtom.polarity || 'pos');
      if (clauseAtom.lemma === 'be' && got.length === 2 && polOk && got[0] === want[0] && got[1] === 'part of ' + want[1]) return true;
      return false;
    }
    if (normArg(given.predicate) === 'live' && (given.args || []).length === 2) {
      const want = given.args.map(normArg), got = (clauseAtom.args || []).map(normArg);
      const polOk = (given.polarity || 'pos') === (clauseAtom.polarity || 'pos');
      const loc = (clauseAtom.modifiers || []).find(m => m && normArg(m.prep) === 'in' && normArg(m.role) === 'adhikarana');
      if (clauseAtom.lemma === 'live' && got.length === 1 && polOk && got[0] === want[0] && loc && normArg(loc.text) === want[1]) return true;
      return false;
    }
    if (normArg(given.predicate) === 'geo' && (given.args || []).length === 2) {
      const want = given.args.map(normArg), got = (clauseAtom.args || []).map(normArg);
      const polOk = (given.polarity || 'pos') === (clauseAtom.polarity || 'pos');
      if (clauseAtom.lemma === 'be' && got.length === 2 && polOk && got[0] === want[0] && got[1] === 'in ' + want[1]) return true;
      return false;
    }
    if (normArg(given.predicate) === 'in' && (given.args || []).length === 2) {
      const want = given.args.map(normArg), got = (clauseAtom.args || []).map(normArg);
      const polOk = (given.polarity || 'pos') === (clauseAtom.polarity || 'pos');
      if (clauseAtom.lemma === 'be' && got.length === 2 && polOk) {
        const m = /^(in|inside|within)\s+(.+)$/.exec(got[1]);
        if (m && got[0] === want[0] && normArg(m[2]) === want[1]) return true;
      }
      if (clauseAtom.lemma === 'contain' && got.length === 2 && polOk && got[1] === want[0] && got[0] === want[1]) return true;
      return false;
    }
    if (!predMatches(clauseAtom.lemma, given.predicate)) return false;
    if ((given.polarity || 'pos') !== clauseAtom.polarity) return false;
    if (given.tense && given.tense !== clauseAtom.tense) return false;
    if (given.particle && normArg(given.particle) !== normArg(clauseAtom.particle)) return false;
    const args = (given.args || []).map(normArg), got = (clauseAtom.args || []).map(normArg);
    if (args.length !== got.length || args.some((a, i) => a !== got[i])) return false;
    if (Array.isArray(given.modifiers) && given.modifiers.length && !given.modifiers.every(m => modifierHit(clauseAtom.modifiers, m))) return false;
    return true;
  }
  function predMatches(lemma, pred) {
    const p = normArg(pred); if (!p || !lemma) return false;
    if (p === lemma || (lemma === 'be' && (p === 'is' || p === 'are' || p === 'be'))) return true;
    try { return ['pres3', 'past'].some(f => G.inflect(lemma, f) === p); } catch (e) { return false; }
  }
  function outward(text, atom) {
    const src = String(text || '').trim().replace(/[.!?]+$/, '');
    const rec = { schema: 'forge.outward/v1', text: String(text || ''), ok: false, step: null, R_t: null, calls_llm: false };
    if (!src) return Object.assign(rec, { step: 'empty' });
    let c = null; try { c = reparseClause(src, true); } catch (e) { c = null; }
    if (!c) return Object.assign(rec, { step: 'parse' });
    const a = atomOfClause(c);
    if (atom) {
      if (!sameAtom(a, atom)) return Object.assign(rec, { step: 'atom', clause_atom: a });
    }
    let r = null; try { r = G.clauseText(c, 'kernel'); } catch (e) { r = null; }
    if (!r) return Object.assign(rec, { step: 'realize' });
    let c2 = null; try { c2 = reparseClause(r, true); } catch (e) { c2 = null; }
    const k1 = canon(G.material(c)), k2 = c2 ? canon(G.material(c2)) : null;
    if (k1 !== k2) return Object.assign(rec, { step: 'roundtrip', realized: r });
    const R_t = r.charAt(0).toUpperCase() + r.slice(1) + '.';
    return Object.assign(rec, { ok: true, step: 'compiled', R_t, clause_atom: a, material: k1, roundtrip: true });
  }
  /* 4.9.214 C3: the per-turn derivation state (rsIn: the inward operator counts; heldNow: the held reading) is owned here; the turn loop resets it */
  function setHeld(v) { heldNow = v; } function resetTurnState() { rsIn = {}; heldNow = []; } const rsInNow = () => rsIn;
  return { reparseClause, derive, content, swapToks, unknownToks, swap, setHeld, economy, animNP, reparseClause0, resetTurnState, rsInNow, outward, atomOfClause }; }
const api = { Wording };
if (isNode) module.exports = api; else root.KPaniniWording = api;
})(this);
