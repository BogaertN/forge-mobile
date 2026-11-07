/* qframe.js — 4.9.230 QUESTION FRAME (Nic plan 229, step 1). The Ask text is compiled into a kāraka frame by the kernel's own
 * declarative parser before the engine runs. A question is not parsed by a separate question grammar: its gap is filled with the
 * indefinite pronoun the wh-word stands for (what → something, who → someone), the auxiliary is put back into declarative order
 * (do-support re-inflects the verb), and the result is parsed by KGrammar.Parser through forge.derive. The filled slot names the asked
 * kāraka (kartṛ, karma, pred; hetu for why; prakāra for how; polarity for a yes/no question). A conditional compiles its if-clause and its
 * main question separately. Imperatives are parsed with the addressee as kartṛ. Arithmetic is marked for the compute path.
 * The frame is passed to the Python engine in the Ask payload (payload.frame); the Python side uses frame.speech_act when parsed.
 * Deterministic; no model; no question lists; nothing here answers anything. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const G = isNode ? require('./grammar.js') : root.KGrammar;
  const SCHEMA = 'forge.qframe/v1';
  const has = (w, t) => !!(G && G.CL && G.CL[w] && G.CL[w].includes(t));
  /* what an English wh-word stands for when its gap is filled (grammar of indefinite pro-forms, not a topic list) */
  const FILLER = { what: 'something', which: 'something', who: 'someone', whom: 'someone' };
  const ADJUNCT = { why: 'hetu', how: 'prakara', where: 'adhikarana', when: 'kala' };
  const AUX_TENSE = { does: 'pres3', do: 'pres', did: 'past' };
  const words = s => String(s || '').trim().replace(/[?!.]+$/, '').trim().split(/\s+/).filter(Boolean);
  const join = ws => ws.join(' ');
  function fromDerive(d, s) {
    const ps = (d && d.parses) || []; const p = ps.find(x => x && x.node && x.node.clause) || ps[0];
    if (!p || !p.node) return null;
    return { node: p.node, clause: p.node.clause || null, parses: ps.length, persp: d.persp || null, text: s };
  }
  function parse(forge, s) {
    if (!forge || typeof forge.derive !== 'function' || !s) return null;
    let d = null; try { d = forge.derive(s.replace(/[.]?$/, '.')); } catch (e) { return null; }
    return fromDerive(d, s);
  }
  /* 4.9.246: the open lexicon (deriveSource) is the same grammar with provisional nouns enabled, used only when the
   * strict parse of an intervention clause fails. It is still the kernel's parser, not a question template. */
  function parseOpen(forge, s) {
    const strict = parse(forge, s); if (strict && strict.clause) return strict;
    if (!forge || typeof forge.deriveSource !== 'function' || !s) return strict;
    let d = null; try { d = forge.deriveSource(s.replace(/[.]?$/, '.')); } catch (e) { return strict; }
    return fromDerive(d, s) || strict;
  }
  /* Orthography of measure abbreviations, applied only to an intervention that did not parse: "1k" in an electrical
   * clause is the SI prefix kiloohm, and "a X and Y voltage divider" is two resistors. Recorded as a canonical rule. */
  function tokenLine(forge, s) {
    if (!forge) return [];
    let d = null;
    try { d = (forge.deriveSource || forge.derive)(String(s || '').replace(/[.]?$/, '.')); } catch (e) { return []; }
    return ((d && d.T) || []).map(t => ({ w: t.w, lemmas: (t.an || []).map(a => a.lemma).filter(Boolean) }));
  }
  /* A failed intervention may still carry measures the grammar did not attach ("a 35 kilogram crate 1.6 meters
   * tall and 0.4 meters wide"). Lift every number+unit off the clause, parse what remains, and keep the measures
   * on the frame. Any noun, any of these units. Nothing is filled in. */
  function liftMeasures(s) {
    const stated = [];
    let t = String(s || '');
    const lenU = '(meters?|metres?|centimeters?|millimeters?|cm|mm|feet|foot|inches?|inch|m)';
    const massU = '(kilograms?|kg|pounds?|lbs?|grams?|g)';
    const dimW = '(tall|high|wide|deep|long|thick)';
    t = t.replace(new RegExp('\\b(\\d+(?:\\.\\d+)?)\\s+' + lenU + '\\s+' + dimW + '\\b', 'gi'), (m, n, u, d) => { stated.push({ num: String(n), unit: String(u).toLowerCase(), dim: String(d).toLowerCase() }); return ' '; });
    t = t.replace(new RegExp('\\b(\\d+(?:\\.\\d+)?)\\s+' + massU + '\\b', 'gi'), (m, n, u) => { stated.push({ num: String(n), unit: String(u).toLowerCase(), dim: 'mass' }); return ' '; });
    /* "on a 30 degree ramp": the number is the slope. Lift it so the noun phrase can parse. */
    t = t.replace(/\b(\d+(?:\.\d+)?)\s+degrees?\s+(?=(?:ramp|slope|incline|plane|hill)\b)/gi, (m, n) => { stated.push({ num: String(n), unit: 'degree', dim: 'slope' }); return ' '; });
    t = t.replace(/\s+/g, ' ').trim();
    t = t.replace(/ and (?=near |on |at |across |along |onto |in )/gi, ' ');
    t = t.replace(/ and (?=near |on |at |across |along |onto |in )/gi, ' ');
    t = t.replace(' and in ', ' in ');
    t = t.replace(/\s+/g, ' ').trim();
    return { text: t, stated };
  }
  function expandMeasures(s) {
    const raw = String(s || '');
    if (!/\b(volt|divider|resistor|ohm|circuit)\b/i.test(raw)) return raw;
    let t = raw.replace(/\b(\d+(?:\.\d+)?)k and (\d+(?:\.\d+)?)k resistors\b/i, 'a $1 kiloohm resistor and a $2 kiloohm resistor');
    t = t.replace(/\b(\d+(?:\.\d+)?)k\b/gi, '$1 kiloohm');
    t = t.replace(/\ba (\d+(?:\.\d+)? kiloohm) and (\d+(?:\.\d+)? kiloohm) voltage divider\b/i, 'a resistor of $1 and a resistor of $2');
    return t;
  }
  const str = v => Array.isArray(v) ? v.join(' ') : (v == null ? null : String(v));
  const head = n => n ? str(n.pron || n.indef || n.pron3 || n.head || n.propn || n.name || null) : null;
  /* The grammar already reads a proper name as a place when the lexicon's own name test files it under noun.location
   * (kernel featsOf). That flag is the geographic role. A name with no such filing is not guessed to be a place. */
  function locName(forge, propn) {
    if (!propn || !forge || !forge.lexicon) return false;
    const w = String(propn).toLowerCase();
    const lex = forge.lexicon;
    return !!(lex.isName && lex.isName(w) && lex.lexnameOf && lex.lexnameOf(w) === 'noun.location');
  }
  function np(n, forge) {
    if (!n) return null;
    let text = null; try { text = G.npText(n, 'user'); } catch (e) {}
    const out = { text, head: head(n), owner: n.owner && typeof n.owner === 'object' ? np(n.owner, forge) : (n.owner || null), kernel: n.pron === 'kernel', user: n.pron === 'user', indef: !!n.indef };
    /* 4.9.231: the parts a fact atom is built from (step 4): modifiers, determiner, number, a proper name, the of-complement */
    if (Array.isArray(n.adjs) && n.adjs.length) out.adjs = n.adjs.slice();
    if (n.det) out.det = n.det;
    if (n.quant) out.quant = str(n.quant); /* 4.9.241: "no body" carries the negative quantifier (it negates its clause) */
    if (n.plural) out.plural = true;
    if (n.propn) out.propn = str(n.propn);
    if (locName(forge, out.propn)) out.loc = true;
    if (n.num != null && n.num !== '') out.num = str(n.num);
    if (Array.isArray(n.conj)) out.conj = n.conj.map(x => np(x, forge));
    if (n.of && typeof n.of === 'object') out.of = np(n.of, forge);
    return out;
  }
  const WR = isNode ? require('./world_rules.js') : root.KWorldRules;
  function measurePred(pr) {
    /* P-MEASURE-ADJ keeps the adjective as the property. P-MEASURE-BARE is mass only. */
    if (pr.type === 'measure' && pr.num != null && pr.unit) return { type: 'measure', num: String(pr.num), unit: String(pr.unit).toLowerCase(), property: String(pr.property || 'heavy').toLowerCase(), text: String(pr.num) + ' ' + String(pr.unit) };
    if (pr.measure && Array.isArray(pr.words) && pr.words.length >= 3) return { type: 'measure', num: String(pr.words[0]), unit: String(pr.words[1]).toLowerCase(), property: String(pr.words[2]).toLowerCase(), text: pr.words.join(' ') };
    return null;
  }
  function cmpPred(pr, forge) {
    /* The comparative the grammar already built: its surface word, its than-complement, and the
     * declared row that word names. A word with no row stays a comparative with no predicate. */
    const surface = Array.isArray(pr.surface) && pr.surface.length ? pr.surface.slice() : (pr.adj ? [pr.adj] : []);
    const word = String(surface.length ? surface[surface.length - 1] : (pr.adj || '')).toLowerCase();
    const declared = WR && WR.COMPARATIVES && WR.COMPARATIVES.get ? WR.COMPARATIVES.get(word) : null;
    return { type: 'cmp', adj: pr.adj || null, degree: pr.degree || null, surface, text: surface.join(' ') || null, than: pr.than ? np(pr.than, forge) : null, predicate: declared || null };
  }
  function roles(cl, forge) {
    if (!cl) return {};
    const v = cl.verb || {}; let material = null; try { material = G.material(cl); } catch (e) {}
    const karakas = {}; for (const [k, x] of Object.entries(cl.roles || {})) karakas[k] = x && typeof x === 'object' && !Array.isArray(x) ? np(x, forge) : x;
    const pr = cl.pred || null;
    return {
      kriya: v.lemma || null, tense: v.tense || null, polarity: v.pol || null, modality: v.mod || null,
      voice: v.voice || 'active',
      kartr: np(cl.subj, forge), karma: karakas.karma || null, karakas,
      pred: pr ? (measurePred(pr) || (pr.type === 'np' ? Object.assign({ type: 'np' }, np(pr.np, forge)) : pr.type === 'pp' ? (n => ({ type: 'pp', prep: pr.prep || null, text: (n && n.text) || str((pr.np && (pr.np.head || pr.np.text)) || pr.words || null), np: n }))(pr.np ? np(pr.np, forge) : null) : pr.type === 'cmp' ? cmpPred(pr, forge) : { type: pr.type || null, text: str(pr.words || pr.text || null) })) : null,
      adj: (cl.adj || []).map(a => ({ prep: a.prep || null, role: a.role || null, np: a.np && typeof a.np === 'object' ? np(a.np, forge) : null })),
      adjuncts: (cl.adj || []).length, material,
    };
  }
  /* 4.9.231 (Nic plan 229, step 3): a remembered or recalled sentence as a kāraka clause. The same parser and the same role reading
   * as the question frame; a sentence that does not parse is kept with parsed:false and its text (nothing is guessed). One record
   * per sentence of the text, so a two-sentence memory gives two clauses. Deterministic; no model. */
  const CLAUSE = 'forge.clause/v1';
  const sentencesOf = t => String(t || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/).map(x => x.trim()).filter(Boolean);
  function clauseOne(s, forge) {
    const text = s.replace(/[.!?]+$/, '').trim();
    const rec = { schema: CLAUSE, text, parsed: false, calls_llm: false };
    if (!text) return rec;
    /* 4.9.241: a bare-plural generic ("Whales are mammals.") states a kind: it is read as "a whale is a mammal", by the same
     * QF-CANON-GENERIC-PLURAL rule as the question "Are whales mammals?", so the remembered fact and the question meet */
    const ws = words(text), ci = ws.findIndex(w => /^(are|were)$/i.test(w));
    if (ci >= 1 && ci < ws.length - 1) {
      const gp = genericPlural(forge, ws.slice(0, ci).concat(ws.slice(ci + 1)), ci);
      if (gp) { const r = roles(gp.p.clause, forge); delete r.material;
        return Object.assign(rec, r, { parsed: true, parses: gp.p.parses, adjuncts: [], canonical: [{ rule: 'QF-CANON-GENERIC-PLURAL', surface: text, reading: gp.s }] }); }
    }
    const p = parse(forge, text);
    if (!p || !p.clause) return rec;
    const r = roles(p.clause, forge);
    const adj = (p.clause.adj || []).map(a => ({ prep: a.prep || null, role: a.role || null, np: a.np && typeof a.np === 'object' ? np(a.np) : null }));
    delete r.material; return Object.assign(rec, r, { parsed: true, parses: p.parses, adjuncts: adj });
  }
  /* 4.9.238 (Nic): a concessive or causal sentence is two or three clauses, not one. "Even though X, Y because Z" is the
   * concessive clause X, the main clause Y and its hetu (cause) Z; each is read by the same parser and kept with its link.
   * Only the subordinators themselves split ("even though", "although", initial "though", "because" — never "because of",
   * which is a prepositional cause, not a clause). A part shorter than two words is not split off. Mirrored exactly in
   * engine/rmc_engine_v1/clause_split.py. Deterministic; no model. */
  const SPLIT = [
    { re: /^(?:even though|although|though)\s+(.+?),\s+(.+)$/i, links: ['concessive', null] },
    { re: /^because\s+(?!of\b)(.+?),\s+(.+)$/i, links: ['hetu', null] },
    { re: /^(.+?),?\s+(?:even though|although)\s+(.+)$/i, links: [null, 'concessive'] },
    { re: /^(.+?),?\s+because\s+(?!of\b)(.+)$/i, links: [null, 'hetu'] },
  ];
  function splitClauses(s, link) {
    const t = String(s || '').replace(/[.!?]+$/, '').trim(); const own = link || 'main';
    for (const r of SPLIT) {
      const m = t.match(r.re); if (!m) continue;
      const a = m[1].trim(), b = m[2].trim(); if (a.split(/\s+/).length < 2 || b.split(/\s+/).length < 2) continue;
      return splitClauses(a, r.links[0] || own).concat(splitClauses(b, r.links[1] || own));
    }
    return [{ text: t, link: own }];
  }
  function clauseSplit(s, forge) {
    const parts = splitClauses(s);
    if (parts.length < 2) return clauseOne(s, forge);
    const clauses = parts.map(p => Object.assign(clauseOne(p.text, forge), { link: p.link }));
    return { schema: CLAUSE, text: s.replace(/[.!?]+$/, '').trim(), parsed: false, split: 'subordinate', clauses, calls_llm: false };
  }
  function clause(text, forge) {
    try {
      const ss = sentencesOf(text); if (!ss.length) return null;
      const all = ss.slice(0, 8).map(s => clauseSplit(s, forge));
      return all.length === 1 ? all[0] : Object.assign({ schema: CLAUSE, text: String(text).trim(), parsed: all.every(c => c.parsed), calls_llm: false, sentences: all });
    } catch (e) { return { schema: CLAUSE, text: String(text || ''), parsed: false, error: String(e && e.message || e).slice(0, 200), calls_llm: false }; }
  }
  /* a per-session cache: the same text always gives the same clause, so a pool is parsed once.
   * A failure is not cached. The extended lexicon attaches after the core, and a sentence that
   * failed before that attachment can parse once it is there. A success stays cached. */
  const CACHE = new Map();
  function clauseCached(text, forge) {
    const k = String(text || ''); if (CACHE.has(k)) return CACHE.get(k);
    const c = clause(k, forge);
    const ok = c && (c.parsed || (c.clauses || []).some(x => x && x.parsed) || (c.sentences || []).some(x => x && (x.parsed || (x.clauses || []).some(y => y && y.parsed))));
    if (ok) { if (CACHE.size > 20000) CACHE.clear(); CACHE.set(k, c); }
    return c;
  }
  /* the subject NP alone, for a question whose full declarative will not parse: the longest prefix that parses as "NP is something" */
  function subjectOnly(forge, body) {
    for (let k = body.length; k >= 1; k--) { const p = parse(forge, join(body.slice(0, k)) + ' is something'); if (p && p.clause && p.clause.subj) return { p, k }; }
    return null;
  }
  /* reorder an aux-fronted question body into declarative order, trying every split point, filler at the asked slot */
  function declaratives(aux, body, filler) {
    const out = [];
    const tense = AUX_TENSE[aux];
    for (let k = body.length; k >= 1; k--) {
      const subj = body.slice(0, k), rest = body.slice(k);
      if (tense) { /* do-support: the verb after the subject takes the aux's tense */
        if (!rest.length) continue; const v = rest[0]; let forms = [v];
        try { forms = [G.inflect(v, tense), v].filter((x, i, a) => x && a.indexOf(x) === i); } catch (e) {}
        for (const f of forms) out.push({ s: join(subj.concat([f], rest.slice(1), filler ? [filler] : [])), filler_at: filler ? 'end' : null });
      } else {
        out.push({ s: join(subj.concat([aux], rest, filler && !rest.length ? [filler] : (filler ? [filler] : []))), filler_at: filler ? 'end' : null });
      }
    }
    return out;
  }
  /* 4.9.240 (plan 229): CANONICAL FRAMES. A paraphrase compiles to the same kāraka frame as the plain question, by general rules of
   * English grammar read off the lexicon (no question lists, no topic words):
   *   QF-CANON-AGENT-OF  "the N of X", N an agent noun of the verb V, is "the one who Vs X": "Who is the author of Hamlet?" =
   *                      "Who wrote/writes Hamlet?". The agent verb comes from the lexicon: a noun.person sense whose gloss is the
   *                      verb ("writes (books…)", "a person who owns something"), or the -er/-or agent suffix on a verb.
   *   QF-CANON-GENITIVE  "the N of X", X a referring phrase, is the possessive "X's N" (one possessor slot).
   *   QF-CANON-WHOSE     "whose N is X?" asks X's possessor: "someone owns X", X of kind N (whose is the genitive of who).
   *   QF-CANON-GENERIC-PLURAL  "are Xs Ys?" with bare plurals is the generic "is an X a Y?" (the plural names the kind).
   * The surface is kept: f.canonical lists the rules applied and f.surface_declarative the reading before them. Mirrored by the
   * engine's np_unify (genitive = possessive) so facts written either way meet. Deterministic; no model. */
  const DEFINITE = new Set(['the', 'this', 'that', 'these', 'those']);
  const sensesOf = (forge, w, pos) => { try { const L = forge && forge.lexicon; const ss = L && typeof L.senses === 'function' ? (L.senses(w) || []) : []; return pos ? ss.filter(x => x && x.pos === pos) : ss; } catch (e) { return []; } };
  const isVerb = (forge, v) => !!v && sensesOf(forge, v, 'v').length > 0;
  const lastHead = n => { const h = n && n.head; return h ? String(h).split(/\s+/).pop().toLowerCase() : null; };
  const referringNP = n => !!(n && typeof n === 'object' && !n.indef && (n.propn || n.user || n.kernel || n.owner || DEFINITE.has(String(n.det || '').toLowerCase())));
  function base3(forge, w) { /* the base form of a third-person -s verb, if the lexicon has it */
    w = String(w || '').toLowerCase(); if (!/s$/.test(w) || /^(is|was|has|does)$/.test(w)) return null;
    for (const c of [w.replace(/ies$/, 'y'), w.replace(/es$/, ''), w.replace(/s$/, '')]) if (c && c !== w && isVerb(forge, c)) return c;
    return null;
  }
  function agentVerb(forge, noun) {
    const ps = sensesOf(forge, noun, 'n').filter(x => x.lexname === 'noun.person'); if (!ps.length) return null;
    for (const x of ps) { const g = String(x.gloss || '').replace(/^\([^)]*\)\s*/, '').toLowerCase();
      let m = g.match(/^(?:someone|somebody|one|a person|a \w+|an \w+)\s+who\s+(\w+)/); if (m) { const v = base3(forge, m[1]); if (v) return v; continue; }
      m = g.match(/^(\w+)\b/); if (m) { const v = base3(forge, m[1]); if (v) return v; } }
    const m = noun.match(/^(\w+?)(e?r|or)$/); /* agent suffix: writer → write, actor → act, runner → run */
    if (m) for (const c of [noun.slice(0, -1), noun.slice(0, -2), noun.slice(0, -3)]) if (c.length > 1 && isVerb(forge, c)) return c;
    return null;
  }
  const agentNP = (forge, n) => n && typeof n === 'object' && !n.indef && n.of && typeof n.of === 'object' && String(n.det || '').toLowerCase() === 'the' && !n.owner ? agentVerb(forge, lastHead(n)) : null;
  function genitiveNP(n) { /* "the N of X" → "X's N" */
    if (!n || typeof n !== 'object' || !n.of || typeof n.of !== 'object' || String(n.det || '').toLowerCase() !== 'the' || n.owner || n.propn || !referringNP(n.of)) return n;
    const own = n.of; const out = { text: (own.text || '') + "'s " + [].concat(n.adjs || [], [n.head]).filter(Boolean).join(' '), head: n.head, owner: own, kernel: false, user: false, indef: false };
    if (n.adjs) out.adjs = n.adjs.slice(); if (n.plural) out.plural = true; if (n.type) out.type = n.type;
    return out;
  }
  const tenseOf = aux => /^(was|were|did)$/.test(String(aux || '')) ? 'past' : 'pres3';
  function reparse(forge, f, s, rule) {
    const p = parse(forge, s); if (!p || !p.clause) return false;
    const was = { rule: f.rule, declarative: f.declarative };
    for (const k of ['kriya', 'tense', 'polarity', 'modality', 'voice', 'kartr', 'karma', 'karakas', 'pred', 'adj', 'adjuncts', 'material']) delete f[k];
    Object.assign(f, roles(p.clause, forge)); f.parsed = true; f.partial = false; f.declarative = s; f.parses = p.parses;
    f.canonical = (f.canonical || []).concat([{ rule, surface_rule: was.rule, surface_declarative: was.declarative || null }]);
    return true;
  }
  function canonicalize(f, forge) {
    if (!f || f.kriya !== 'be') return f;
    /* agent-of: one side of the copula is "the N of X" with N an agent noun; the other side (a gap or a phrase) is its agent */
    for (const [side, other] of [['kartr', 'pred'], ['pred', 'kartr']]) {
      const A = f[side]; const V = agentNP(forge, A); if (!V) continue;
      const B = f[other]; const gap = !B || B.indef; const agent = gap ? 'someone' : (B && B.text); if (!agent) continue;
      let vf = V; try { vf = G.inflect(V, tenseOf(f.aux)) || V; } catch (e) {}
      if (reparse(forge, f, agent + ' ' + vf + ' ' + A.of.text, 'QF-CANON-AGENT-OF')) {
        if (f.wh_role === 'pred' || f.wh_role === 'kartr') f.wh_role = gap ? 'kartr' : f.wh_role;
        if (f.wh && f.wh_role === 'kartr' && f.wh === 'who') f.speech_act = f.speech_act || 'who';
        return f;
      }
    }
    /* genitive: "the N of X" → "X's N" on every role */
    let did = false;
    for (const k of ['kartr', 'pred']) { const g = genitiveNP(f[k]); if (g !== f[k]) { f[k] = k === 'pred' ? Object.assign({ type: 'np' }, g) : g; did = true; } }
    if (did) f.canonical = (f.canonical || []).concat([{ rule: 'QF-CANON-GENITIVE', surface_rule: f.rule, surface_declarative: f.declarative || null }]);
    return f;
  }
  /* singular of a plural noun the lexicon knows ("whales" → whale, "things" → thing); null when it is not a plural noun */
  function singular(forge, w) {
    w = String(w || '').toLowerCase(); if (!/s$/.test(w) || /ss$/.test(w)) return null;
    for (const c of [w.replace(/ies$/, 'y'), w.replace(/(ch|sh|x|s|z)es$/, '$1'), w.replace(/s$/, '')]) if (c && c !== w && sensesOf(forge, c, 'n').length) return c;
    return null;
  }
  const article = w => /^[aeiou]/i.test(w) ? 'an' : 'a';
  function genericPlural(forge, body, at) { /* "whales living things" → "a whale is a living thing", every split tried, longest subject first (or the copula's own split, at) */
    const lb = body.map(w => w.toLowerCase());
    if (lb.some(w => has(w, 'DET') || has(w, 'POSS') || has(w, 'PRON') || /'s$/.test(w))) return null;
    for (let k = body.length - 1; k >= 1; k--) {
      if (at && k !== at) continue;
      const L = lb.slice(0, k), R = lb.slice(k); const ls = singular(forge, L[L.length - 1]), rs = singular(forge, R[R.length - 1]);
      if (!ls || !rs) continue;
      const left = L.slice(0, -1).concat([ls]), right = R.slice(0, -1).concat([rs]);
      const s = article(left[0]) + ' ' + join(left) + ' is ' + article(right[0]) + ' ' + join(right);
      const p = parse(forge, s); if (p && p.clause && p.clause.pred && p.clause.pred.type === 'np') return { s, p };
    }
    return null;
  }
  function selfAct(r, wh, aux) {
    const k = r.kartr; if (!k || !k.kernel) return null;
    if (aux && has(aux, 'MOD')) return 'capability';
    return 'self';
  }
  function compileQ(text, forge) {
    const ws = words(text); const lw = ws.map(w => w.toLowerCase());
    const f = { schema: SCHEMA, text: String(text || ''), speech_act: 'stated', mood: 'declarative', wh: null, wh_role: null, aux: null, parsed: false, declarative: null, parses: 0, rule: null, calls_llm: false };
    if (!ws.length) return Object.assign(f, { rule: 'QF-EMPTY' });
    /* arithmetic: an expression of numerals and operators goes to the compute path */
    if (/\d/.test(text) && /^[\d\s+\-*/^().=x×÷%,]+[?]?$/i.test(String(text).trim())) return Object.assign(f, { speech_act: 'compute', mood: 'expression', rule: 'QF-ARITH-EXPR' });
    /* "factor <polynomial>" is an operation frame. The math grammar parses the expression; the word is not an answer. */
    if (lw[0] === 'factor' && ws.length > 1) return Object.assign(f, { speech_act: 'compute', mood: 'operation', op: 'factor', expr: ws.slice(1).join(' ').replace(/[?!.]+$/, ''), rule: 'QF-MATH-FACTOR' });
    /* interjection-only turn (closed class INTJ): the act is left to the engine's concept reading */
    if (lw.every(w => has(w.replace(/[,!.]/g, ''), 'INTJ') || has(w.replace(/[,!.]/g, ''), 'PLEASE'))) return Object.assign(f, { speech_act: 'interjection', mood: 'interjection', rule: 'QF-INTJ' });
    /* 4.9.243 QF-WHAT-HAPPENS-IF: "What happens if C?" asks for the effect of intervention C.
     * kriyā happen, the gap is the effect (pred), the if-clause is cond. Simulate fills the gap from causal frames. */
    {
      /* only the what-first form; "If C, what happens?" keeps QF-IF- so cond parses as a clause (R4230) */
      const mHappen = String(text || '').trim().match(/^what\s+(?:will\s+)?happen(?:s)?\s+(?:if|when)\s+(.+?)\??$/i)
        || String(text || '').trim().match(/^what\s+if\s+(.+?)\??$/i);
      if (mHappen) {
        const condTxt = mHappen[1].trim().replace(/[.?]+$/, '');
        let cond = parseOpen(forge, condTxt);
        let condCanon = null;
        if (!cond || !cond.clause) {
          const exp = expandMeasures(condTxt);
          if (exp !== condTxt) { const c2 = parseOpen(forge, exp); if (c2 && c2.clause) { cond = c2; condCanon = { rule: 'QF-CANON-SI-PREFIX', surface: condTxt, reading: exp }; } }
        }
        if (!cond || !cond.clause) {
          const lifted = liftMeasures(condTxt);
          if (lifted.stated.length) {
            const c4 = parseOpen(forge, lifted.text);
            if (c4 && c4.clause) { cond = c4; condCanon = { rule: 'QF-CANON-MEASURE', surface: condTxt, reading: lifted.text, stated: lifted.stated }; }
          }
        }
        let stateNum = null;
        if (!cond || !cond.clause) {
          const st = condTxt.match(/^(.*)\s+in\s+(?:the\s+)?state\s+(\d+)\s*$/i);
          if (st) { const c3 = parseOpen(forge, st[1]); if (c3 && c3.clause) { cond = c3; stateNum = st[2]; } }
        }
        const condRoles = cond && cond.clause ? roles(cond.clause, forge) : null;
        if (condRoles && stateNum != null) condRoles.adj = (condRoles.adj || []).concat([{ prep: 'in', role: 'adhikarana', np: { text: 'state ' + stateNum, head: 'state', num: stateNum } }]);
        if (condRoles && condCanon && Array.isArray(condCanon.stated)) condRoles.stated = condCanon.stated;
        Object.assign(f, {
          speech_act: 'what', mood: 'interrogative', wh: 'what', wh_role: 'pred',
          kriya: 'happen', polarity: 'pos', tense: 'present',
          kartr: { text: 'it', head: 'it', kernel: false, user: false },
          pred: { type: 'np', text: 'something', head: 'something', indef: true, kind: 'effect' },
          karma: null, parsed: true, partial: true, declarative: 'something happens ' + (/^\s*what\s+(?:will\s+)?happens?\s+when\b/i.test(text) ? 'when ' : 'if ') + condTxt,
          conditional: true,
          cond: condRoles ? Object.assign({ text: condTxt, parses: cond.parses, open: !!cond.open }, condCanon ? { canonical: [condCanon] } : {}, condRoles) : { text: condTxt, parsed: false, tokens: tokenLine(forge, condTxt) },
          rule: 'QF-WHAT-HAPPENS-IF',
        });
        return f;
      }
    }
    /* conditional: "if C, Q" → cond + main */
    if (has(lw[0], 'IF')) {
      let cut = lw.findIndex((w, i) => i > 1 && (/,$/.test(ws[i - 1]) || has(w, 'WH') || has(w, 'THEN')));
      if (cut > 1) {
        const condTxt = join(ws.slice(1, cut)).replace(/,$/, ''); const mainWs = has(lw[cut], 'THEN') ? ws.slice(cut + 1) : ws.slice(cut);
        const cond = parse(forge, condTxt); const main = compileQ(join(mainWs) + (/\?\s*$/.test(text) ? '?' : ''), forge);
        return Object.assign(main, { text: f.text, cond: cond ? Object.assign({ text: condTxt, parses: cond.parses }, roles(cond.clause, forge)) : { text: condTxt, parsed: false }, conditional: true, speech_act: main.speech_act === 'stated' ? 'stated' : main.speech_act, rule: 'QF-IF-' + (main.rule || '') });
      }
    }
    const isQ = /\?\s*$/.test(text) || has(lw[0], 'WH') || ((has(lw[0], 'COP') || has(lw[0], 'AUX') || has(lw[0], 'MOD')) && ws.length > 1);
    /* QF-CANON-WHOSE: "whose N COP X?" → "someone owns X", X of kind N; the asked role is the possessor (kartṛ) */
    if (lw[0] === 'whose' && isQ) {
      const ci = lw.findIndex((w, i) => i >= 2 && has(w, 'COP'));
      if (ci >= 2 && ci < lw.length - 1) {
        const kind = lw[ci - 1]; const body = ws.slice(ci + 1); let vf = 'owns'; try { vf = G.inflect('own', tenseOf(lw[ci])) || vf; } catch (e) {}
        const s = 'someone ' + vf + ' ' + join(body); const p = parse(forge, s);
        if (p && p.clause && p.clause.roles && p.clause.roles.karma) {
          Object.assign(f, roles(p.clause, forge), { wh: 'whose', mood: 'interrogative', aux: lw[ci], wh_role: 'kartr', parsed: true, declarative: s, parses: p.parses, rule: 'QF-WH-SUBJ-DECL', speech_act: 'who' });
          f.karma = Object.assign({}, f.karma, { kind: singular(forge, kind) || kind }); f.wh_det = kind;
          f.canonical = [{ rule: 'QF-CANON-WHOSE', surface_rule: 'QF-WH-ADJ-NOPARSE', surface_declarative: null }];
          return f;
        }
      }
    }
    if (has(lw[0], 'WH') && isQ) {
      const wh = lw[0]; f.wh = wh; f.mood = 'interrogative'; let rest = ws.slice(1); const lrest = lw.slice(1);
      if (wh === 'how' && /^(many|much)$/.test(lrest[0] || '')) { f.quantity = lrest[0]; rest = rest.slice(1); lrest.shift(); }
      const filler = FILLER[wh] || null; const adjunct = ADJUNCT[wh] || null;
      const a0 = lrest[0] || '';
      if (has(a0, 'COP') || has(a0, 'AUX') || has(a0, 'MOD')) {
        f.aux = a0; const body = rest.slice(1);
        const cands = filler ? declaratives(a0, body, filler) : (has(a0, 'COP') && body.length === 1 ? declaratives(a0, body, 'something') : declaratives(a0, body, null));
        for (const c of cands) { const p = parseOpen(forge, c.s); if (p && p.clause) { Object.assign(f, roles(p.clause, forge)); f.parsed = true; f.declarative = c.s; f.parses = p.parses; break; } }
        /* 4.9.241 QF-CANON-PRO-VERB: "do" is the pro-verb. "What can you do?" / "What do you do?" asks for an action of the
         * subject: kriyā do, the karma is the gap (the verb phrase the answer supplies), the modal kept. */
        if (!f.parsed && filler && body.length >= 2 && String(body[body.length - 1]).toLowerCase() === 'do') {
          const so = subjectOnly(forge, body.slice(0, -1));
          if (so && so.k === body.length - 1) {
            const MODS = { can: 'able', could: 'possible', will: 'asserted', would: 'conditional', may: 'possible', might: 'possible', must: 'necessary', should: 'obligation' };
            Object.assign(f, { kriya: 'do', tense: a0 === 'did' ? 'past' : 'present', polarity: 'pos', modality: MODS[a0] || 'asserted', kartr: np(so.p.clause.subj), pred: null,
              karma: { text: filler, head: filler, owner: null, kernel: false, user: false, indef: true }, parsed: true, declarative: join(body.slice(0, -1)) + (MODS[a0] ? ' ' + a0 : '') + ' do ' + filler });
            f.canonical = [{ rule: 'QF-CANON-PRO-VERB', surface_rule: 'QF-WH-AUX-SUBJ', surface_declarative: null }];
          }
        }
        if (!f.parsed) {
          const so = subjectOnly(forge, body);
          if (so) {
            f.kartr = np(so.p.clause.subj); f.partial = true; f.declarative = null;
            /* words after the longest subject noun phrase stay on the frame (a height, a place). They are not dropped. */
            if (so.k < body.length) {
              const rest = join(body.slice(so.k));
              f.locus = { text: rest, parsed: false, tokens: tokenLine(forge, rest) };
            }
          }
        }
        f.wh_role = adjunct || (has(a0, 'COP') ? (body.length ? 'pred' : 'kartr') : 'karma');
        if (!filler && has(a0, 'COP') && body.length === 1) f.wh_role = adjunct || 'pred';
        f.rule = 'QF-WH-AUX-' + (f.parsed ? 'DECL' : f.partial ? 'SUBJ' : 'NOPARSE');
      } else if (filler && (wh === 'what' || wh === 'which') && lrest.length >= 3 && has(lrest[1], 'COP') && !(G && G.CL && G.CL[lrest[0]])) {
        /* 4.9.236: a wh-determiner copula question ("what N is X") asks X's N: X is kartṛ and the gap is a pred of kind N.
         * The kind travels on the gap (pred.kind) so Derive only fills it with something shown to be an N. */
        const kind = lrest[0]; f.aux = lrest[1]; const body = rest.slice(2);
        const so = subjectOnly(forge, body);
        if (so && so.k === body.length) {
          f.kriya = 'be'; f.polarity = 'pos'; f.kartr = np(so.p.clause.subj); f.karma = null;
          f.pred = { type: 'np', text: 'some ' + kind, head: kind, kind, owner: null, kernel: false, user: false, indef: true };
          f.partial = true; f.declarative = join(body) + ' is some ' + kind;
        }
        f.wh_role = 'pred'; f.wh_det = kind; f.rule = 'QF-WH-DET-COP-' + (f.partial ? 'SUBJ' : 'NOPARSE');
      } else if (filler) { /* subject question: the wh-word is kartṛ ("who wrote Hamlet" → "someone wrote Hamlet") */
        const s = join([filler].concat(rest)); const p = parse(forge, s);
        if (p && p.clause) { Object.assign(f, roles(p.clause, forge)); f.parsed = true; f.declarative = s; f.parses = p.parses; }
        f.wh_role = 'kartr'; f.rule = 'QF-WH-SUBJ-' + (f.parsed ? 'DECL' : 'NOPARSE');
      } else { f.wh_role = adjunct; f.rule = 'QF-WH-ADJ-NOPARSE'; }
      f.speech_act = selfAct(f, wh, f.aux) || wh;
      return f;
    }
    if (isQ && (has(lw[0], 'COP') || has(lw[0], 'AUX') || has(lw[0], 'MOD'))) { /* yes/no: polarity of the declarative */
      f.mood = 'interrogative'; f.aux = lw[0]; f.wh_role = 'polarity';
      const gp = /^(are|were)$/.test(lw[0]) ? genericPlural(forge, ws.slice(1)) : null;
      if (gp) { Object.assign(f, roles(gp.p.clause, forge)); f.parsed = true; f.declarative = gp.s; f.parses = gp.p.parses;
        f.canonical = [{ rule: 'QF-CANON-GENERIC-PLURAL', surface_rule: 'QF-YN-DECL', surface_declarative: null }]; }
      /* Among the declaratives that parse, a prepositional predicate whose preposition is in the question
       * ("is the red car inside the garage?" → "the red car is inside the garage") wins over a shorter subject
       * that swallowed that preposition ("the red is car inside the garage"). Otherwise the copula stays as early
       * as a real parse allows ("is Aster inside Cobalt?" → "Aster is inside Cobalt", not "Aster inside is Cobalt"). */
      if (!gp) {
        const aux = String(lw[0]).toLowerCase();
        const at = s => s.toLowerCase().split(/\s+/).indexOf(aux);
        const cands = declaratives(lw[0], ws.slice(1), null).slice().sort((a, b) => at(a.s) - at(b.s) || a.s.localeCompare(b.s));
        const parsed = [];
        for (const c of cands) { const p = parse(forge, c.s); if (p && p.clause) parsed.push({ c, p, r: roles(p.clause, forge) }); }
        const surface = ws.slice(1).map(w => w.toLowerCase());
        /* "of" on a noun ("part of the car") is the noun's complement, not a predicate preposition. Preferring
         * the of-PP would move "part" into the subject ("the wheel part is of the car"). inside/in/on stay. */
        const adjective = w => sensesOf(forge, w, 'a').length > 0 || sensesOf(forge, w, 's').length > 0;
        /* An adjective that takes the following preposition ("next to", "married to") keeps it. The earliest
         * copula can split a noun phrase ("the red is car next to the garage"); that noun is not the adjective. */
        const adjComp = parsed.filter(x => {
          const word = String((x.r.pred && x.r.pred.text) || '').toLowerCase();
          return x.r.pred && x.r.pred.type === 'adj' && adjective(word) && (x.r.adj || []).some(a => a && a.np && surface.includes(String(a.prep || '').toLowerCase()));
        });
        const withPrep = parsed.filter(x => {
          if (!x.r.pred || x.r.pred.type !== 'pp') return false;
          const prep = String(x.r.pred.prep || '').toLowerCase();
          if (!prep || prep === 'of' || !surface.includes(prep)) return false;
          const complement = parsed.some(y => {
            const word = String((y.r.pred && y.r.pred.text) || '').toLowerCase();
            return y.r.pred && y.r.pred.type === 'adj' && adjective(word) && (y.r.adj || []).some(a => a && String(a.prep || '').toLowerCase() === prep && a.np);
          });
          return !complement;
        });
        const pick = adjComp[0] || withPrep[0] || parsed[0];
        if (pick) { Object.assign(f, pick.r); f.parsed = true; f.declarative = pick.c.s; f.parses = pick.p.parses; }
      }
      f.speech_act = selfAct(f, null, f.aux) || 'stated'; f.polar = true; f.rule = 'QF-YN-' + (f.parsed ? 'DECL' : 'NOPARSE');
      return f;
    }
    /* 4.9.246 QF-WH-INSITU: "Aspirin has what molecular weight?" is the same copula as "What is the molecular weight of aspirin?"
     * The wh-word is the gap inside the clause; a have-property is the genitive copula (the property of X is something). */
    {
      const wi = lw.indexOf('what');
      if (wi > 0) {
        const gapWords = ws.slice(wi + 1);
        const s = join(ws.slice(0, wi).concat(['something']));
        const pIn = gapWords.length ? parseOpen(forge, s) : null;
        if (pIn && pIn.clause) {
          Object.assign(f, roles(pIn.clause, forge), { wh: 'what', mood: 'interrogative', wh_role: 'karma', parsed: true, declarative: s, parses: pIn.parses, rule: 'QF-WH-INSITU', speech_act: 'what' });
          const propHead = gapWords[gapWords.length - 1].toLowerCase();
          const propAdjs = gapWords.slice(0, -1).map(w => w.toLowerCase());
          if (f.kriya === 'have' && f.kartr && f.kartr.text && /^(weight|mass|formula|structure|charge)$/.test(propHead)) {
            const reading = 'the ' + propAdjs.concat([propHead]).join(' ') + ' of ' + f.kartr.text + ' is something';
            if (reparse(forge, f, reading, 'QF-CANON-HAS-PROPERTY')) { f.wh_role = 'pred'; f.speech_act = 'what'; return f; }
          }
          return f;
        }
      }
    }
    /* declarative */
    const p = parse(forge, join(ws));
    if (p && p.clause) { Object.assign(f, roles(p.clause, forge)); f.parsed = true; f.declarative = join(ws); f.parses = p.parses; f.rule = 'QF-DECL'; return f; }
    /* imperative: the addressee is kartṛ */
    const imps = ['you ' + join(ws)]; if (ws.length > 2) imps.push('you ' + join([ws[0], 'that'].concat(ws.slice(1)))); /* a clausal complement may drop "that" */
    for (const s of imps) { const pi = parse(forge, s);
      if (pi && pi.clause) { Object.assign(f, roles(pi.clause, forge)); f.parsed = true; f.mood = 'imperative'; f.speech_act = 'command'; f.declarative = s; f.parses = pi.parses; f.rule = 'QF-IMP'; return f; } }
    /* a bare noun phrase (a fragment, e.g. a reply that picks a meaning) */
    const pf = parse(forge, join(ws) + ' is something');
    if (pf && pf.clause && pf.clause.subj) { f.kartr = np(pf.clause.subj); f.mood = 'fragment'; f.rule = 'QF-FRAGMENT-NP'; return f; }
    f.rule = 'QF-NOPARSE'; return f;
  }
  /* 4.9.241 (Nic: natural conversation) the utterance's conversational acts, read with the speech-act lexicon
   * (src/speech_acts.js, the copy of engine/rmc_engine_v1/speech_acts.json). Leading acts the lexicon answers (greet, thank,
   * apologize, farewell) are recorded on the frame (f.acts): alone they are the turn (QF-SPEECH-ACT); before a question the
   * rest is compiled as the question (QF-ACT-PREFIX, the frame keeps the whole text). An act answered by its frame
   * (ask_wellbeing, ask_help) is compiled to the question its lexicon frame realizes (QF-ACT-FRAME): the kāraka frame
   * {kriyā, kartṛ listener, gap} is put in words by rule (the wh-word of the gap, the modal of the modality, the listener as
   * "you") and compiled like any question, so every form of the act has the same frame. No reply is chosen here. */
  const SA = isNode ? require('./speech_acts.js') : root.KSpeechActs;
  const MODAL = { able: 'can', possible: 'may', necessary: 'must' };
  function frameQuestion(fr) {
    if (!fr || !fr.wh || fr.kartr !== 'listener') return null;
    if (fr.kriya === 'be' && fr.prakara === 'gap') return fr.wh + ' are you?';
    if (fr.karma === 'gap') return fr.wh + ' ' + (MODAL[fr.modality] || 'do') + ' you ' + fr.kriya + '?';
    return null;
  }
  function actFrame(text, forge) {
    if (!SA || typeof SA.classify !== 'function') return null;
    const c = SA.classify(text); if (!c.acts.length) return null;
    const entry = a => SA.DATA.acts[a.act] || {};
    const rec = a => ({ act: a.act, form: a.form, response: entry(a).response || null, answered_by: entry(a).answered_by, frame: entry(a).frame });
    const prefix = []; for (const a of c.acts) { const e = entry(a); if (e.answered_by === 'act' && e.response) prefix.push(a); else break; }
    if (prefix.length) {
      const rest = String(text || '').slice(prefix[prefix.length - 1].end).replace(/^[\s,.!?;:]+/, '');
      if (!rest.trim()) return { schema: SCHEMA, text: String(text || ''), speech_act: 'greeting', mood: 'speech_act', wh: null, wh_role: null, aux: null, parsed: false, declarative: null, parses: 0, rule: 'QF-SPEECH-ACT', acts: prefix.map(rec), act_match: c.match, calls_llm: false };
      const g = compile(rest, forge);
      return Object.assign({}, g, { text: String(text || ''), acts: prefix.map(rec), act_rest: rest, canonical: (g.canonical || []).concat([{ rule: 'QF-ACT-PREFIX', acts: prefix.map(a => a.act), rest }]) });
    }
    const a = c.acts[0], e = entry(a);
    if (e.answered_by === 'frame' && c.acts.length === 1 && c.pure) {
      const q = frameQuestion(e.frame); if (!q) return null;
      const g = canonicalize(compileQ(q, forge), forge); if (!g.parsed) return null;
      return Object.assign({}, g, { text: String(text || ''), acts: [rec(a)], canonical: (g.canonical || []).concat([{ rule: 'QF-ACT-FRAME', act: a.act, reading: q }]) });
    }
    return null;
  }
  function compile(text, forge) { try { return actFrame(text, forge) || canonicalize(compileQ(text, forge), forge); } catch (e) { return { schema: SCHEMA, text: String(text || ''), speech_act: null, parsed: false, rule: 'QF-ERROR', error: String(e && e.message || e).slice(0, 200), calls_llm: false }; } }
  /* A sim-ask reply is either measures, a kind, or both. The measures are the same lift the question frame
   * already uses. The leftover noun phrase is read as the predicate of a copula, so the kind is a kāraka
   * and not a splice into the pending question. */
  function supplement(text, forge) {
    const lifted = liftMeasures(text);
    let rest = String(lifted.text || '').replace(/[?.!]+$/g, '').replace(/\s+,/g, ' ').replace(/\band\b/gi, ' ').replace(/[,]+/g, ' ').replace(/\s+/g, ' ').trim();
    rest = rest.replace(/^(?:it is|it's|this is|that is)\s+/i, '').trim();
    let phrase = null;
    if (rest && !/^\d/.test(rest)) {
      const low = rest[0].toLowerCase() + rest.slice(1);
      const parsed = parseOpen(forge, 'it is ' + low);
      const pred = parsed && parsed.clause ? roles(parsed.clause, forge).pred : null;
      if (pred && pred.type === 'np' && pred.text) phrase = String(pred.text);
    }
    return { stated: lifted.stated, phrase: phrase, calls_llm: false };
  }
  const api = { SCHEMA, CLAUSE, compile, clause, clauseCached, splitClauses, supplement, FILLER, ADJUNCT };
  if (isNode) module.exports = api; else root.KQFrame = api;
})(typeof self !== 'undefined' ? self : this);
