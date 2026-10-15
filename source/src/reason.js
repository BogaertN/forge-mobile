(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports;
const sha256 = isNode ? require('./sha256.js').sha256 : root.KSha.sha256;
const G = isNode ? require('./grammar.js') : root.KGrammar;

const SCHEMA = 'forge-turn-world-reasoning/v1';
const CANDIDATE_SCHEMA = 'SemanticCandidate/v1';
const WORLD_SCHEMA = 'TurnWorld/v1';
const PROOF_SCHEMA = 'Proof/v1';
const ENVELOPE_SCHEMA = 'ForgeWorldResponse/v1';
const PARSER_VERSION = 'forge-controlled-paninian/v1';
const ENGINE_VERSION = 'forge-paraconsistent-fixed-point/v1';
const CHECKER_VERSION = 'forge-proof-replay/v1';
const RMC_VERSION = 'forge-rmc-world-selection/v1';
const DOC = 'World Model v1 Contract';

const LIMITS = Object.freeze({
  MAX_INPUT_CHARS: 4000,
  MAX_SENTENCES: 24,
  MAX_CANDIDATES: 1,
  MAX_SYMBOL_CHARS: 64,
  MAX_ENTITIES: 256,
  MAX_FACTS: 96,
  MAX_RULES: 48,
  MAX_RULE_BODY: 8,
  MAX_DERIVATIONS: 192,
  MAX_ROUNDS: 16,
  MAX_WORK: 12000,
  MAX_PROOF_DEPTH: 64,
  MAX_PROOF_STEPS: 160
});

const copy = x => x === undefined ? undefined : JSON.parse(JSON.stringify(x));
const canon = x => {
  if (x === undefined) return 'undefined';
  if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']';
  if (x && typeof x === 'object') return '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canon(x[k])).join(',') + '}';
  return JSON.stringify(x);
};
const digest = (ns, value) => ns + ':sha256:' + sha256(canon(value));
const same = (a, b) => canon(a) === canon(b);
const deepFreeze = x => {
  if (!x || typeof x !== 'object' || Object.isFrozen(x)) return x;
  Object.freeze(x); for (const v of Object.values(x)) deepFreeze(v); return x;
};
const exactKeys = (o, allowed) => !!o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).every(k => allowed.includes(k)) && allowed.every(k => Object.prototype.hasOwnProperty.call(o, k));
const clean = s => String(s || '').normalize('NFC').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

function sourceSegments(raw) {
  const out = [], text = String(raw || ''); const re = /[^.!?]+[.!?]?/g; let m;
  while ((m = re.exec(text)) && out.length < LIMITS.MAX_SENTENCES + 1) {
    const lead = (m[0].match(/^\s*/) || [''])[0].length;
    const tail = (m[0].match(/\s*$/) || [''])[0].length;
    const source = m[0].slice(lead, m[0].length - tail);
    if (!source) continue;
    const body = source.replace(/[.!?]+$/, '').trim();
    out.push({
      id: 'source:' + (out.length + 1),
      kind: /\?$/.test(source) && !supposed(source) ? 'question' : 'assertion',
      text: body,
      source,
      span: { start: m.index + lead, end: m.index + m[0].length - tail }
    });
  }
  return out;
}

function unquote(s) { return clean(s).replace(/^['"]|['"]$/g, '').trim(); }
const EXTRA_CLOSED = /^(?:above|aboard|absent|afore|ago|against|along|alongside|amid|amidst|among|amongst|apart|as|astride|atop|barring|below|beneath|besides|betwixt|beyond|circa|concerning|considering|despite|ere|except|excepting|excluding|failing|following|including|inside|like|mid|minus|notwithstanding|opposite|outside|pace|past|pending|per|plus|pro|qua|re|regarding|round|sans|save|throughout|till|toward|towards|underneath|unlike|unto|upon|versus|via|vice|vis-à-vis|within|worth|either|neither|nor|so|yet|lest|once|though|whether|whenever|wherever|whilst|provided|providing|supposing|whence|whither|(?:here|there|where)(?:after|at|before|by|from|in|into|of|on|over|through|to|under|upon|with)|however|therefore|thus|hence|moreover|furthermore|nevertheless|nonetheless|otherwise|consequently|accordingly|instead|meanwhile|likewise|namely|additionally|admittedly|alternatively|anyhow|anyway|conversely|else|finally|firstly|further|indeed|lastly|secondly|similarly|only|even|just|merely|fewer|fewest|less|least|little|much|more|enough|another|other|others|one|ones|same|such|own|none|whatever|whichever|whoever|whomever|oneself|yourselves|himself|herself|itself|ourselves|themselves|mine|yours|ours|hers|theirs|ought|cannot|ain'?t|can'?t|won'?t|shan'?t|(?:are|is|was|were|have|has|had|do|does|did|would|should|could|will|shall|may|might|must|ought)n'?t|(?:i|you|we|they|he|she|it|that|there|who|what|where|when|why|how)'(?:m|re|ve|d|ll)|given|assume|suppose|fact|rule|world|query|true|false)$/;
const closedWord = s => !!(G && G.CL && G.CL[s]) || EXTRA_CLOSED.test(s);
const isQuotedSymbol = s => /^"[^"]+"$/u.test(clean(s));
/* verbs: lemmas the input itself uses as verbs ("Mira likes Sam"); only then may a bare form that is also a closed word ("like") fill a do-support verb slot */
function symbol(raw, role, verbs) {
  const source = clean(raw), quoted = isQuotedSymbol(source);
  let s = quoted ? source.slice(1, -1).trim() : source.replace(/^(?:a|an|the)\s+/i, '').replace(/(?:'s)$/, '').trim();
  if (!s || s.length > LIMITS.MAX_SYMBOL_CHARS || (!quoted && (/\s/.test(s) || (closedWord(s.toLowerCase()) && !(role === 'verb' && /^(?:have|has)$/i.test(s)) && !(role === 'verb' && verbs && verbs.has(s.toLowerCase()) && !(G && G.CL && G.CL[s.toLowerCase()]))))) || !/^[\p{L}][\p{L}\p{N}_' -]*$/u.test(s)) return null;
  s = s.toLowerCase().replace(/['’]/g, '').replace(/[ -]+/g, '_');
  if (!/^[\p{L}][\p{L}\p{N}_-]*$/u.test(s)) return null;
  return s;
}

const VAR_WORDS = new Set(['something', 'someone', 'anything', 'anyone', 'it', 'they', 'that_thing', 'that_person']);
function term(raw, allowVariable) {
  const source = clean(raw), variable = unquote(source).replace(/^(?:a|an|the)\s+/i, '').toLowerCase().replace(/['’]/g, '').replace(/[ -]+/g, '_');
  if (allowVariable && !isQuotedSymbol(source) && VAR_WORDS.has(variable)) return '$x';
  const s = symbol(raw, 'entity');
  if (!s) return null;
  return s;
}

const IRREGULAR = Object.freeze({ has: 'have', does: 'do', is: 'be', are: 'be', was: 'be', were: 'be' });
function verbLemma(raw, verbs) {
  let s = symbol(raw, 'verb', verbs); if (!s) return null;
  if (isQuotedSymbol(raw)) return s;
  if (IRREGULAR[s]) return IRREGULAR[s];
  if (/[^aeiou]ies$/.test(s) && s.length > 4) return s.slice(0, -3) + 'y';
  if (/(ches|shes|xes|zes|oes|sses)$/.test(s) && s.length > 4) return s.slice(0, -2);
  if (/s$/.test(s) && !/(ss|us|is)$/.test(s) && s.length > 3) return s.slice(0, -1);
  return s;
}

const SP = "(?:\"[^\"]+\"|[\\p{L}][\\p{L}\\p{N}_'-]*)";
const NP = '(?:(?:a|an|the)\\s+)?((?:that\\s+(?:thing|person)|' + SP + '))';
const rx = s => new RegExp(s, 'iu');
const COP = rx('^' + NP + '\\s+(?:is|are)\\s+(not\\s+)?(?:(?:a|an|the)\\s+)?(' + SP + ')$');
const REL_NEG = rx('^' + NP + '\\s+(?:does|do)\\s+not\\s+(' + SP + ')\\s+' + NP + '$');
const REL_POS = rx('^' + NP + '\\s+(' + SP + ')\\s+' + NP + '$');
const QUERY_COP = rx('^is\\s+' + NP + '\\s+(not\\s+)?(?:(?:a|an|the)\\s+)?(' + SP + ')$');
const QUERY_REL = rx('^(?:does|do)\\s+' + NP + '\\s+(not\\s+)?(' + SP + ')\\s+' + NP + '$');
/* a copular prepositional predicate ("X is in Y") is a binary atom named by the preposition; the class comes from the grammar's closed PREP list,
   so it can never collide with a verb predicate (verbs that are grammar function words are rejected) */
const isPrep = w => !!(G && G.CL && (G.CL[String(w).toLowerCase()] || []).includes('PREP'));
const COP_PP = rx('^' + NP + '\\s+(?:is|are)\\s+(not\\s+)?(' + SP + ')\\s+' + NP + '$');
const BARE_PP = rx('^(not\\s+)?(' + SP + ')\\s+' + NP + '$');
const QUERY_PP = rx('^is\\s+' + NP + '\\s+(not\\s+)?(' + SP + ')\\s+' + NP + '$');
const UNIVERSAL_NO = rx('^no\\s+(' + SP + ')\\s+(?:is|are)\\s+(?:(?:a|an|the)\\s+)?(' + SP + ')$');
const UNIVERSAL_AND = rx('^(?:every|each|all)\\s+(' + SP + ')\\s+that\\s+(?:is|are)\\s+(.+?)\\s+(?:is|are)\\s+(not\\s+)?(?:(?:a|an|the)\\s+)?(' + SP + ')$');
const UNIVERSAL_ONE = rx('^(?:every|each|all)\\s+(' + SP + ')\\s+(?:is|are)\\s+(not\\s+)?(?:(?:a|an|the)\\s+)?(' + SP + ')$');
const INTR = rx('^' + NP + '\\s+(?:(?:does|do)\\s+(not)\\s+)?(' + SP + ')$');
const QUERY_INTR = rx('^(?:does|do)\\s+' + NP + '\\s+(not\\s+)?(' + SP + ')$');
const UNIVERSAL_INTR = rx('^(?:every|each|all)\\s+(' + SP + ')\\s+(?:(?:does|do)\\s+(not)\\s+)?(' + SP + ')$');
const UNIVERSAL_REL = rx('^(?:every|each|all)\\s+(' + SP + ')\\s+(' + SP + ')\\s+' + NP + '$');

function splitOutside(text, word) {
  const s = clean(text), out = []; let start = 0, quoted = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '"') { quoted = !quoted; continue; }
    if (quoted || s.slice(i, i + word.length).toLowerCase() !== word || (i && !/[\s,]/.test(s[i - 1])) || !/\s/.test(s[i + word.length] || '')) continue;
    out.push(s.slice(start, s[i - 1] === ',' ? i - 1 : i).trim());
    i += word.length; while (/\s/.test(s[i] || '')) i++; start = i; i--;
  }
  if (quoted) return [];
  out.push(s.slice(start).trim()); return out.filter(Boolean);
}

function atom(predicate, args, polarity) {
  return { predicate, args: args.slice(), polarity: polarity === 'neg' ? 'neg' : 'pos' };
}
const atomKey = a => canon([a.polarity, a.predicate, a.args]);
const opposite = a => atom(a.predicate, a.args, a.polarity === 'neg' ? 'pos' : 'neg');
const displaySymbol = s => String(s).replace(/^\$/, '').replace(/_/g, ' ');
/* third person only when it re-parses to the same lemma */
const third = p => { const f = p === 'have' ? 'has' : /[^aeiou]y$/.test(p) ? p.slice(0, -1) + 'ies' : /(?:s|x|z|ch|sh|o)$/.test(p) ? p + 'es' : p + 's'; return /_/.test(p) || verbLemma(f) !== p ? p : f; };
function atomText(a) {
  if (!a) return 'unresolved proposition';
  const neg = a.polarity === 'neg';
  if (a.args.length === 1 && /_v$/.test(a.predicate)) { const p = a.predicate.slice(0, -2); return displaySymbol(a.args[0]) + (neg ? ' does not ' + displaySymbol(p) : ' ' + displaySymbol(third(p))); }
  if (a.args.length === 1 || isPrep(a.predicate)) return displaySymbol(a.args[0]) + ' is ' + (neg ? 'not ' : '') + displaySymbol(a.predicate) + (a.args[1] ? ' ' + displaySymbol(a.args[1]) : '');
  const p = a.predicate, v = neg ? p : third(p); /* third person only when it re-parses to the same lemma */
  return displaySymbol(a.args[0]) + (neg ? ' does not ' : ' ') + displaySymbol(v) + ' ' + displaySymbol(a.args[1]);
}

/* a supposition marker is grammar (a modality of the clause), not a route: the clause is parsed exactly like any other
   assertion, but it lands in a copy-on-write what-if branch over the committed world, never in the committed world */
const SUPPOSE = /^(?:suppose|assume|imagine|what\s+if|let(?:'s|\s+us)\s+say|hypothetically,?)(?:\s+that)?\s+/i;
const supposed = text => SUPPOSE.test(clean(text));
function stripLead(text) {
  return clean(text).replace(SUPPOSE, '').replace(/^(?:given(?: that)?|fact\s*:|rule\s*:|world\s*:)\s*/i, '').trim();
}

function parseCopula(text, allowVariable) {
  const m = clean(text).match(COP);
  if (!m) { const p = clean(text).match(COP_PP); if (!p || !isPrep(p[3])) return null; const s = term(p[1], allowVariable), o = term(p[4], allowVariable); return s && o ? atom(p[3].toLowerCase(), [s, o], p[2] ? 'neg' : 'pos') : null; }
  const subject = term(m[1], allowVariable), predicate = symbol(m[3], 'predicate');
  if (!subject || !predicate) return null;
  return atom(predicate, [subject], m[2] ? 'neg' : 'pos');
}

/* after do-support ("does not X", "does Y X") the slot is a verb by position: an EXTRA_CLOSED word there ("like") is that verb (grammar CL words never are) */
const dsv = (verbs, w) => new Set([...(verbs || []), clean(w).toLowerCase()]);
function parseRelation(text, allowVariable, verbs) {
  let m = clean(text).match(REL_NEG);
  let polarity = 'neg';
  if (!m) { m = clean(text).match(REL_POS); polarity = 'pos'; }
  if (!m) { const i = clean(text).match(INTR); if (!i) return null; const s = term(i[1], allowVariable), v = verbLemma(i[3], i[2] ? dsv(verbs, i[3]) : verbs); return s && v && v !== 'be' && v !== 'do' && v !== 'have' ? atom(v + '_v', [s], i[2] ? 'neg' : 'pos') : null; }
  const subject = term(m[1], allowVariable), predicate = verbLemma(m[2], polarity === 'neg' ? dsv(verbs, m[2]) : verbs), object = term(m[3], allowVariable);
  if (!subject || !predicate || !object || predicate === 'be' || predicate === 'do') return null;
  return atom(predicate, [subject, object], polarity);
}

function parseAtomic(text, allowVariable, verbs) { return parseCopula(text, allowVariable) || parseRelation(text, allowVariable, verbs); }
function splitConjunction(text) { return splitOutside(text, 'and'); }

function parseRuleAtom(text, allowBarePredicate) {
  let t = clean(text);
  let a = parseAtomic(t, true);
  if (a) return a;
  if (allowBarePredicate) {
    t = t.replace(/^(?:is|are)\s+/i, ''); const pp = t.match(BARE_PP); if (pp && isPrep(pp[2])) { const o = term(pp[3], true); return o ? atom(pp[2].toLowerCase(), ['$x', o], pp[1] ? 'neg' : 'pos') : null; } t = t.replace(/^(?:a|an|the)\s+/i, '');
    const neg = /^not\s+/i.test(t); if (neg) t = t.replace(/^not\s+/i, '');
    const p = symbol(t, 'predicate'); if (p) return atom(p, ['$x'], neg ? 'neg' : 'pos');
  }
  return null;
}

function parseConditional(text) {
  const source = clean(text); if (!/^if\s+/i.test(source)) return null;
  const halves = splitOutside(source.replace(/^if\s+/i, ''), 'then'); if (halves.length !== 2) return null;
  const parts = splitConjunction(halves[0].replace(/,\s*$/, '')), body = [];
  for (let i = 0; i < parts.length; i++) {
    let p = parts[i];
    if (i > 0 && !/^(?:something|someone|anything|anyone|it|they|[\p{L}].*?\s+(?:is|are|does|do))\b/iu.test(p)) p = 'it is ' + p;
    const a = parseRuleAtom(p, i > 0); if (!a) return null; body.push(a);
  }
  const head = parseRuleAtom(halves[1], true); if (!head || !body.length) return null;
  return { body, head, form: 'conditional' };
}

/* plural class nouns in a universal ("all blorfs are zindles") name the same class as the singular; only regular English plural endings, quoted symbols untouched */
const pluralForms = w => /^"/.test(w) || !/^[\p{L}]{3,}$/u.test(w) || !/s$/i.test(w) || /(?:ss|us|is)$/i.test(w) ? [w] : /ies$/i.test(w) ? [w.slice(0, -3) + 'y', w.slice(0, -1)] : /(?:sses|xes|ches|shes)$/i.test(w) ? [w.slice(0, -2), w.slice(0, -1)] : /(?:ses|zes)$/i.test(w) ? [w.slice(0, -1), w.slice(0, -2)] : [w.slice(0, -1)];
/* an ambiguous plural ending ("-ses", "-ies") resolves to the singular the same input already uses for that class; else the regular default */
/* the do-support query verb is bare; a stated inflected form is the same verb when inflecting the bare form re-lemmatises to it
   ("pozozises" ↔ "pozozis", "bias/biases"): the input itself resolves the -s/-es ambiguity, as with plurals */
function alignVerbs(q, atoms) { const u = q.args.length === 1; if (u ? !/_v$/.test(q.predicate) : q.args.length !== 2 || isPrep(q.predicate)) return; const k = u ? '_v' : '', bin = atoms.filter(a => a.args.length === q.args.length && (!u || /_v$/.test(a.predicate))), used = new Set(bin.map(a => a.predicate)), p = q.predicate.slice(0, u ? -2 : undefined);
  const alt = used.has(q.predicate) ? [] : [p, p + 's', p + 'es', /[^aeiou]y$/.test(p) ? p.slice(0, -1) + 'ies' : ''].map(x => x && verbLemma(x)).filter(x => x && x !== p).map(x => x + k);
  for (const a of bin) if (alt.includes(a.predicate)) a.predicate = q.predicate; }
function resolvePlurals(pluralAlts, atoms) {
  const used = new Set(atoms.map(a => a.predicate).concat(pluralAlts.flatMap(([r]) => r.body.concat([r.head]).map(a => a.predicate))));
  for (const [r, alts] of pluralAlts) for (const [first, ...rest] of alts) { const alt = rest.find(x => used.has(x)); if (alt && !atoms.some(a => a.predicate === first)) for (const a of r.body.concat([r.head])) if (a.predicate === first) a.predicate = alt; }
}
/* a generic subject is a quantifier: "a/an/any X …" ≡ "every X …", and a bare single-word plural "Xs are …" ≡ "all Xs are …" */
function generic(text) { const t = clean(text), m = t.match(rx('^(' + SP + ')\\s+are\\s')); if (/^(?:an?|any)\s+[\p{L}]/iu.test(t)) return t.replace(/^(?:an?|any)\s+/i, 'every ');
  return m && !/^"/.test(m[1]) && !VAR_WORDS.has(m[1].toLowerCase()) && !closedWord(m[1].toLowerCase()) ? 'all ' + t : t; }
function parseUniversal(text) {
  text = generic(text); const pl = /\s(?:are)\s/i.test(clean(text)) || /^all\s/i.test(clean(text)), alts = [];
  const sg = w => { if (!pl) return w; const f = pluralForms(w); if (f.length > 1) alts.push(f.map(x => symbol(x, 'predicate'))); return f[0]; };
  const r = parseUniversalForm(text, sg); if (r && alts.length) r.plural_alternatives = alts; return r;
}
function parseUniversalForm(text, sg) {
  let m = clean(text).match(UNIVERSAL_NO);
  if (m) {
    const cls = symbol(sg(m[1]), 'predicate'), dst = symbol(sg(m[2]), 'predicate');
    return cls && dst ? { body: [atom(cls, ['$x'])], head: atom(dst, ['$x'], 'neg'), form: 'universal_negative' } : null;
  }
  m = clean(text).match(UNIVERSAL_AND);
  if (m) {
    const cls = symbol(sg(m[1]), 'predicate'), dst = symbol(sg(m[4]), 'predicate'); if (!cls || !dst) return null;
    const body = [atom(cls, ['$x'])];
    for (const p of splitConjunction(m[2])) { const a = parseRuleAtom(p, true); if (!a || a.args.some(x => x !== '$x')) return null; body.push(a); }
    return { body, head: atom(dst, ['$x'], m[3] ? 'neg' : 'pos'), form: 'universal_conjunctive' };
  }
  m = clean(text).match(UNIVERSAL_ONE);
  if (m) {
    const cls = symbol(sg(m[1]), 'predicate'), dst = symbol(sg(m[3]), 'predicate');
    return cls && dst ? { body: [atom(cls, ['$x'])], head: atom(dst, ['$x'], m[2] ? 'neg' : 'pos'), form: 'universal_unary' } : null;
  }
  m = clean(text).match(UNIVERSAL_INTR);
  if (m) { const cls = symbol(sg(m[1]), 'predicate'), v = verbLemma(m[3]); if (cls && v && !/^(?:be|do|have)$/.test(v) && !closedWord(m[3].toLowerCase())) return { body: [atom(cls, ['$x'])], head: atom(v + '_v', ['$x'], m[2] ? 'neg' : 'pos'), form: 'universal_intransitive' }; }
  m = clean(text).match(UNIVERSAL_REL);
  if (m) {
    const cls = symbol(sg(m[1]), 'predicate'), pred = verbLemma(m[2]), obj = term(m[3], false);
    return cls && pred && obj ? { body: [atom(cls, ['$x'])], head: atom(pred, ['$x', obj]), form: 'universal_relation' } : null;
  }
  return null;
}

function parseRule(text) { return parseConditional(text) || parseUniversal(text); }

/* an indefinite query subject ("is a blorf a quab?") asks about an ARBITRARY member: the subject becomes the fresh constant any_<class>,
   and interpret() adds the witness <class>(any_<class>) to a branch (universal generalisation over Horn rules; the committed world is untouched) */
function parseQuery(text, verbs) {
  let t = clean(text).replace(/[?]+$/, '').replace(/^query\s*:\s*/i, '').trim().replace(/^(is|does|do)\s+any\s+/i, '$1 a ');
  const gen = /^(?:is|does|do)\s+an?\s+/i.test(t), sub = x => { const v = term(x, false); return v && gen ? 'any_' + v : v; };
  let m = t.match(QUERY_COP);
  if (m) {
    const subject = sub(m[1]), predicate = symbol(m[3], 'predicate');
    return subject && predicate ? atom(predicate, [subject], m[2] ? 'neg' : 'pos') : null;
  }
  m = t.match(QUERY_REL);
  if (m) {
    const subject = sub(m[1]), predicate = symbol(m[3], 'verb', dsv(verbs, m[3])), object = term(m[4], false); /* do-support: the verb is already bare */
    return subject && predicate && predicate !== 'be' && predicate !== 'do' && object ? atom(predicate, [subject, object], m[2] ? 'neg' : 'pos') : null;
  }
  m = t.match(QUERY_INTR);
  if (m) { const subject = sub(m[1]), v = symbol(m[3], 'verb', dsv(verbs, m[3])); if (subject && v && !/^(?:be|do|have)$/.test(v)) return atom(v + '_v', [subject], m[2] ? 'neg' : 'pos'); }
  m = t.match(QUERY_PP);
  if (m && isPrep(m[3])) { const subject = sub(m[1]), object = term(m[4], false); return subject && object ? atom(m[3].toLowerCase(), [subject, object], m[2] ? 'neg' : 'pos') : null; }
  m = t.match(/^is\s+it\s+true\s+that\s+(.+)$/i);
  return m ? parseAtomic(m[1], false) : null;
}

function variables(a) { return a.args.filter(x => /^\$/.test(x)); }
const nameOk = (x, variable) => typeof x === 'string' && x.length <= LIMITS.MAX_SYMBOL_CHARS + (variable ? 1 : 0) && (variable ? /^\$[\p{L}][\p{L}\p{N}_-]*$/u : /^[\p{L}][\p{L}\p{N}_-]*$/u).test(x);
const spanOk = s => exactKeys(s, ['start', 'end']) && Number.isInteger(s.start) && Number.isInteger(s.end) && s.start >= 0 && s.end >= s.start;
const refsOk = a => Array.isArray(a) && a.every(x => typeof x === 'string' && x.length > 0 && x.length <= 200);
function validAtom(a) {
  return exactKeys(a, ['predicate', 'args', 'polarity']) && /^(pos|neg)$/.test(a.polarity) && nameOk(a.predicate, false) &&
    Array.isArray(a.args) && (a.args.length === 1 || a.args.length === 2) && a.args.every(x => nameOk(x, /^\$/.test(x)));
}

function validateRule(r) {
  if (!r || !Array.isArray(r.body) || !r.body.length || r.body.length > LIMITS.MAX_RULE_BODY || !validAtom(r.head) || !r.body.every(validAtom)) return 'RULE_SHAPE';
  const bodyVars = new Set([].concat(...r.body.map(variables)));
  if (variables(r.head).some(v => !bodyVars.has(v))) return 'RULE_UNSAFE_VARIABLE';
  return null;
}

function shouldHandle(raw, segments, opts) {
  const s = clean(raw), q = segments.filter(x => x.kind === 'question').slice(-1)[0];
  if (!q) return false;
  if (segments.some(x => x.kind === 'assertion') || SUPPOSE.test(s) || /^(?:given|fact\s*:|rule\s*:|world\s*:)/i.test(s)) return true;
  if ((!opts || opts.allowBareQuery !== false) && parseQuery(q.text) && !/\b(?:i|me|my|mine|we|us|our|ours|you|your|yours)\b/i.test(q.text)) return true;
  if ((!opts || opts.allowBareQuery !== false) && /^(?:is|are|does|do)\b/i.test(q.text) && !/\b(?:i|me|my|mine|we|us|our|ours|you|your|yours)\b/i.test(q.text)) return true;
  if (/^what is the meaning of\b/i.test(q.text)) return true;
  if (/^why\b/i.test(q.text) && !/\b(?:i|me|my|mine|we|us|our|ours|you|your|yours)\b/i.test(q.text)) return true;
  return false;
}

function interpretationFailure(raw, seg, code, detail) {
  const source = seg ? seg.source : String(raw || '').slice(0, 200);
  return { handled: true, failure: { schema: CANDIDATE_SCHEMA, code, detail, source, span: seg && copy(seg.span) || { start: 0, end: String(raw || '').length }, parser_version: PARSER_VERSION, unknown_word: false } };
}

/* a stated sentence always wins over a supposed duplicate of it: duplicates are removed stated-first, so the committed world keeps the fact
   and the branch overlay holds only what is genuinely supposed (stable order: inputs without suppositions are unchanged) */
const stated = xs => xs.filter(x => !x.sup).concat(xs.filter(x => x.sup));
function witnessFor(q, facts, rules) { const c = q.args[0]; if (!/^any_/.test(c)) return null;
  return facts.some(f => f.atom.args.includes(c)) || rules.some(r => r.body.concat([r.head]).some(a => a.args.includes(c))) ? null : atom(c.slice(4), [c]); }
const verbsOf = texts => new Set(texts.map(t => parseRelation(stripLead(t), true)).filter(Boolean).map(a => a.predicate.replace(/_v$/, '')));
function interpret(raw, opts) {
  raw = String(raw || '').normalize('NFC');
  const observedLength = opts && Number.isInteger(opts.inputLength) ? opts.inputLength : raw.length;
  if (observedLength > LIMITS.MAX_INPUT_CHARS) { const out = interpretationFailure(raw, null, 'INPUT_LIMIT', 'input too long'); out.failure.span.end = observedLength; return out; }
  const segments = sourceSegments(raw);
  if (segments.length > LIMITS.MAX_SENTENCES) return interpretationFailure(raw, null, 'SENTENCE_LIMIT', 'too many sentences');
  if (!segments.length || !shouldHandle(raw, segments, opts)) return { handled: false };
  const qseg = segments.filter(x => x.kind === 'question').slice(-1)[0];
  if (!qseg) return { handled: false };
  if (segments.some(x => x.kind === 'question' && x.id !== qseg.id)) return interpretationFailure(raw, qseg, 'MULTIPLE_QUERIES', 'one final query required');
  const trailing = segments.find(x => x.kind === 'assertion' && x.span.start > qseg.span.start);
  if (trailing) return interpretationFailure(raw, trailing, 'QUERY_NOT_FINAL', 'query must be final');
  const query = parseQuery(qseg.text) || parseQuery(qseg.text, verbsOf(segments.filter(x => x.kind === 'assertion').map(x => x.text)));
  if (!query) return interpretationFailure(raw, qseg, 'UNSUPPORTED_QUERY_STRUCTURE', 'yes/no unary or binary query required');

  const pluralAlts = [], facts = [], rules = [], assertions = segments.filter(x => x.kind === 'assertion' && x.span.start < qseg.span.start);
  for (const seg of assertions) {
    const text = stripLead(seg.text), r = parseRule(text);
    if (r) { pluralAlts.push([r, r.plural_alternatives || []]); delete r.plural_alternatives;
      const problem = validateRule(r); if (problem) return interpretationFailure(raw, seg, problem, 'unsafe rule');
      rules.push(Object.assign(r, { source_ref: seg.id, source_span: copy(seg.span), sup: supposed(seg.text) })); continue;
    }
    const f = parseAtomic(text, false) || parseAtomic(text, false, verbsOf(assertions.map(x => x.text)));
    if (!f) return interpretationFailure(raw, seg, 'UNSUPPORTED_ASSERTION_STRUCTURE', 'outside v1 grammar; words remain symbols');
    facts.push({ atom: f, source_ref: seg.id, source_span: copy(seg.span), sup: supposed(seg.text) });
  }
  { const w = witnessFor(query, facts, rules); if (w) facts.push({ atom: w, source_ref: qseg.id, source_span: copy(qseg.span), sup: true }); }
  if (facts.length > LIMITS.MAX_FACTS || rules.length > LIMITS.MAX_RULES) return interpretationFailure(raw, qseg, 'WORLD_SIZE_LIMIT', 'too many facts or rules');
  resolvePlurals(pluralAlts, facts.map(f => f.atom).concat([query])); alignVerbs(query, facts.map(f => f.atom).concat(rules.flatMap(r => r.body.concat([r.head]))));

  const factSeen = new Set(), factRows = [];
  for (const f of stated(facts)) {
    const k = atomKey(f.atom); if (factSeen.has(k)) continue; factSeen.add(k);
    const body = { atom: f.atom, source_ref: f.source_ref, source_span: f.source_span };
    factRows.push(Object.assign({ id: 'fact:' + (factRows.length + 1) + ':' + sha256(canon(body)).slice(0, 12) }, body));
  }
  const ruleSeen = new Set(), ruleRows = [];
  for (const r of stated(rules)) {
    const k = canon({ body: r.body, head: r.head }); if (ruleSeen.has(k)) continue; ruleSeen.add(k);
    const body = { body: r.body, head: r.head, form: r.form, source_ref: r.source_ref, source_span: r.source_span };
    ruleRows.push(Object.assign({ id: 'rule:' + (ruleRows.length + 1) + ':' + sha256(canon(body)).slice(0, 12) }, body));
  }
  const sources = segments.map(s => ({ id: s.id, kind: s.kind, span: copy(s.span), source: s.source, normalized: clean(s.source) }));
  const indexed = [], add = (locus, sourceRef, a) => indexed.push({ locus, source_ref: sourceRef, atom: copy(a) });
  factRows.forEach(f => add('fact:' + f.id, f.source_ref, f.atom));
  ruleRows.forEach(r => { r.body.forEach((a, i) => add('rule:' + r.id + ':body:' + i, r.source_ref, a)); add('rule:' + r.id + ':head', r.source_ref, r.head); });
  add('query', qseg.id, query);
  const entities = [...new Set(indexed.flatMap(x => x.atom.args).filter(x => !/^\$/.test(x)))].sort();
  if (entities.length > LIMITS.MAX_ENTITIES) return interpretationFailure(raw, qseg, 'ENTITY_LIMIT', 'too many entities');
  const vars = [...new Set(indexed.flatMap(x => x.atom.args).filter(x => /^\$/.test(x)))].sort();
  const relations = indexed.map((x, i) => ({
    id: 'relation:' + (i + 1), locus: x.locus, source_ref: x.source_ref, predicate: x.atom.predicate, polarity: x.atom.polarity,
    dependencies: x.atom.args.map((v, n) => ({ role: n === 0 ? 'karta' : 'karma', term: v }))
  }));
  const markers = indexed.map(x => ({ locus: x.locus, source_ref: x.source_ref, tense: 'present', aspect: 'simple', modality: x.locus === 'query' ? 'interrogative' : /^rule:/.test(x.locus) ? 'universal' : 'asserted', negation: x.atom.polarity === 'neg' }));
  const candidateCore = {
    schema: CANDIDATE_SCHEMA,
    parser_version: PARSER_VERSION,
    sources,
    facts: factRows,
    rules: ruleRows,
    query: { atom: query, source_ref: qseg.id, source_span: copy(qseg.span) },
    atoms: indexed,
    relations,
    entities,
    variables: vars,
    markers,
    ambiguities: [],
    ambiguity_reasons: [],
    unresolved_symbols: [],
    unresolved_senses: []
  };
  const candidateBody = Object.assign({}, candidateCore, { content_hash: sha256(canon(candidateCore)) });
  const candidate = Object.assign({ candidate_id: digest('semantic-candidate', candidateBody) }, candidateBody);
  return { handled: true, candidate: deepFreeze(candidate) };
}

const CANDIDATE_FIELDS = ['candidate_id', 'schema', 'parser_version', 'sources', 'facts', 'rules', 'query', 'atoms', 'relations', 'entities', 'variables', 'markers', 'ambiguities', 'ambiguity_reasons', 'unresolved_symbols', 'unresolved_senses', 'content_hash'];
function candidateIntegrity(candidate) {
  const listFields = ['sources', 'facts', 'rules', 'atoms', 'relations', 'entities', 'variables', 'markers', 'ambiguities', 'ambiguity_reasons', 'unresolved_symbols', 'unresolved_senses'];
  if (!exactKeys(candidate, CANDIDATE_FIELDS) || candidate.schema !== CANDIDATE_SCHEMA || candidate.parser_version !== PARSER_VERSION || typeof candidate.candidate_id !== 'string' || typeof candidate.content_hash !== 'string' || listFields.some(k => !Array.isArray(candidate[k]))) return false;
  for (let i = 0; i < candidate.sources.length; i++) {
    const s = candidate.sources[i];
    if (!exactKeys(s, ['id', 'kind', 'span', 'source', 'normalized']) || s.id !== 'source:' + (i + 1) || !/^(?:assertion|question)$/.test(s.kind) || (s.kind === 'question') !== (/\?$/.test(s.source) && !supposed(s.source)) || !spanOk(s.span) || s.span.end > LIMITS.MAX_INPUT_CHARS || (i && s.span.start < candidate.sources[i - 1].span.end) || typeof s.source !== 'string' || !s.source || s.source.length > LIMITS.MAX_INPUT_CHARS || s.span.end - s.span.start !== s.source.length || typeof s.normalized !== 'string' || s.normalized !== clean(s.source)) return false;
  }
  const questions = candidate.sources.filter(s => s.kind === 'question');
  const atomLimit = LIMITS.MAX_FACTS + LIMITS.MAX_RULES * (LIMITS.MAX_RULE_BODY + 1) + 1;
  if (!candidate.sources.length || candidate.sources.length > LIMITS.MAX_SENTENCES || candidate.facts.length > LIMITS.MAX_FACTS || candidate.rules.length > LIMITS.MAX_RULES || candidate.entities.length > LIMITS.MAX_ENTITIES || candidate.atoms.length > atomLimit || candidate.relations.length > atomLimit || candidate.markers.length > atomLimit || questions.length !== 1 || candidate.sources[candidate.sources.length - 1] !== questions[0] || ['ambiguities', 'ambiguity_reasons', 'unresolved_symbols', 'unresolved_senses'].some(k => candidate[k].length)) return false;
  const expectedFacts = [], expectedRules = [], factSeen = new Set(), ruleSeen = new Set(), parsed = [], pluralAlts = [];
  const vs = () => verbsOf(candidate.sources.slice(0, -1).map(x => x.source.replace(/[.!?]+$/, '').trim()));
  for (const s of candidate.sources.slice(0, -1)) {
    const text = stripLead(s.source.replace(/[.!?]+$/, '').trim()), r = parseRule(text);
    if (r) { pluralAlts.push([r, r.plural_alternatives || []]); delete r.plural_alternatives; parsed.push([s, r, null]); }
    else { const a = parseAtomic(text, false) || parseAtomic(text, false, vs()); if (!a) return false; parsed.push([s, null, a]); }
  }
  const qText = questions[0].source, qAtom = parseQuery(qText) || parseQuery(qText, vs()); if (!qAtom) return false;
  { const w = witnessFor(qAtom, parsed.filter(x => x[2]).map(x => ({ atom: x[2] })), parsed.filter(x => x[1]).map(x => x[1])); if (w) parsed.push([questions[0], null, w]); }
  resolvePlurals(pluralAlts, parsed.filter(x => x[2]).map(x => x[2]).concat([qAtom])); alignVerbs(qAtom, parsed.flatMap(x => x[2] ? [x[2]] : x[1].body.concat([x[1].head])));
  for (const [s, r, a] of stated(parsed.map(x => Object.assign(x, { sup: x[0].kind === 'question' || supposed(x[0].source) })))) {
    if (r) {
      if (validateRule(r)) return false;
      const k = canon({ body: r.body, head: r.head }); if (ruleSeen.has(k)) continue; ruleSeen.add(k);
      const b = { body: r.body, head: r.head, form: r.form, source_ref: s.id, source_span: copy(s.span) };
      expectedRules.push(Object.assign({ id: 'rule:' + (expectedRules.length + 1) + ':' + sha256(canon(b)).slice(0, 12) }, b));
    } else {
      const k = atomKey(a); if (factSeen.has(k)) continue; factSeen.add(k);
      const b = { atom: a, source_ref: s.id, source_span: copy(s.span) };
      expectedFacts.push(Object.assign({ id: 'fact:' + (expectedFacts.length + 1) + ':' + sha256(canon(b)).slice(0, 12) }, b));
    }
  }
  const expectedQuery = { atom: qAtom, source_ref: questions[0].id, source_span: copy(questions[0].span) };
  if (!expectedQuery.atom || !same(candidate.facts, expectedFacts) || !same(candidate.rules, expectedRules) || !same(candidate.query, expectedQuery)) return false;
  const expectedAtoms = [], add = (locus, sourceRef, a) => expectedAtoms.push({ locus, source_ref: sourceRef, atom: copy(a) });
  expectedFacts.forEach(f => add('fact:' + f.id, f.source_ref, f.atom));
  expectedRules.forEach(r => { r.body.forEach((a, i) => add('rule:' + r.id + ':body:' + i, r.source_ref, a)); add('rule:' + r.id + ':head', r.source_ref, r.head); });
  add('query', expectedQuery.source_ref, expectedQuery.atom);
  const expectedRelations = expectedAtoms.map((x, i) => ({ id: 'relation:' + (i + 1), locus: x.locus, source_ref: x.source_ref, predicate: x.atom.predicate, polarity: x.atom.polarity, dependencies: x.atom.args.map((v, n) => ({ role: n ? 'karma' : 'karta', term: v })) }));
  const expectedMarkers = expectedAtoms.map(x => ({ locus: x.locus, source_ref: x.source_ref, tense: 'present', aspect: 'simple', modality: x.locus === 'query' ? 'interrogative' : /^rule:/.test(x.locus) ? 'universal' : 'asserted', negation: x.atom.polarity === 'neg' }));
  const expectedEntities = [...new Set(expectedAtoms.flatMap(x => x.atom.args).filter(x => !/^\$/.test(x)))].sort(), expectedVariables = [...new Set(expectedAtoms.flatMap(x => x.atom.args).filter(x => /^\$/.test(x)))].sort();
  if (!same(candidate.atoms, expectedAtoms) || !same(candidate.relations, expectedRelations) || !same(candidate.markers, expectedMarkers) || !same(candidate.entities, expectedEntities) || !same(candidate.variables, expectedVariables)) return false;
  const body = copy(candidate); delete body.candidate_id; const core = copy(body); delete core.content_hash;
  return candidate.content_hash === sha256(canon(core)) && candidate.candidate_id === digest('semantic-candidate', body);
}

function mergedLimits(overrides) {
  const o = Object.assign({}, LIMITS);
  for (const k of Object.keys(overrides || {})) if (Object.prototype.hasOwnProperty.call(o, k) && Number.isInteger(overrides[k]) && overrides[k] >= 0) o[k] = Math.min(o[k], overrides[k]);
  return o;
}

function candidateLimitFailure(candidate, limits) {
  const q = candidate.sources.find(s => s.id === candidate.query.source_ref), fail = (code, detail) => interpretationFailure('', q, code, detail).failure;
  if (limits.MAX_CANDIDATES < 1) return fail('CANDIDATE_LIMIT', 'no semantic candidate budget');
  if (candidate.sources.length > limits.MAX_SENTENCES) return fail('SENTENCE_LIMIT', 'too many sentences');
  if (candidate.sources.some(s => s.span.end > limits.MAX_INPUT_CHARS)) return fail('INPUT_LIMIT', 'input too long');
  if (candidate.entities.length > limits.MAX_ENTITIES) return fail('ENTITY_LIMIT', 'too many entities');
  if (candidate.facts.length > limits.MAX_FACTS || candidate.rules.length > limits.MAX_RULES) return fail('WORLD_SIZE_LIMIT', 'too many facts or rules');
  if (candidate.rules.some(r => r.body.length > limits.MAX_RULE_BODY)) return fail('RULE_BODY_LIMIT', 'rule body too large');
  if (candidate.atoms.some(x => x.atom.predicate.length > limits.MAX_SYMBOL_CHARS || x.atom.args.some(v => v.replace(/^\$/, '').length > limits.MAX_SYMBOL_CHARS))) return fail('SYMBOL_LIMIT', 'symbol too long');
  return null;
}

function buildTurnWorld(candidate, overrides) { return buildWorlds(candidate, overrides).world; }
/* committed world (stated sentences) and, when the input supposes something, one what-if branch: the committed facts and rules
   with the SAME ids, plus the supposed ones appended (copy-on-write; parent_root = committed root; proofs are scoped to the branch) */
function buildWorlds(candidate, overrides) {
  if (!candidateIntegrity(candidate)) throw new Error('WORLD_CANDIDATE_INVALID');
  const sup = new Set(candidate.sources.filter(x => x.kind === 'question' ? candidate.facts.some(f => f.source_ref === x.id) : supposed(x.source)).map(x => x.id));
  if (!sup.size) return { world: makeWorld(candidate, candidate.facts, candidate.rules, null, 'turn:root', 0, overrides), base: null };
  const isSup = x => sup.has(x.source_ref), base = makeWorld(candidate, candidate.facts.filter(x => !isSup(x)), candidate.rules.filter(x => !isSup(x)), null, 'turn:root', 0, overrides);
  const overlay = { facts: candidate.facts.filter(isSup).map(f => f.atom), rules: candidate.rules.filter(isSup).map(r => ({ body: r.body, head: r.head })) };
  const branch = makeWorld(candidate, candidate.facts.filter(x => !isSup(x)).concat(candidate.facts.filter(isSup)), candidate.rules.filter(x => !isSup(x)).concat(candidate.rules.filter(isSup)), base.world_root, 'branch:' + sha256(canon({ parent: base.world_root, overlay })).slice(0, 20), 1, overrides);
  return { world: branch, base };
}
function branchIntegrity(base, branch) {
  if (!worldIntegrity(base) || !worldIntegrity(branch) || base.parent_root !== null || branch.parent_root !== base.world_root || branch.creation_sequence !== 1) return false;
  if (!same(branch.facts.slice(0, base.facts.length), base.facts) || !same(branch.rules.slice(0, base.rules.length), base.rules) || !same(branch.query.atom, base.query.atom)) return false;
  const overlay = { facts: branch.facts.slice(base.facts.length).map(f => f.atom), rules: branch.rules.slice(base.rules.length).map(r => ({ body: r.body, head: r.head })) };
  return branch.branch_id === 'branch:' + sha256(canon({ parent: base.world_root, overlay })).slice(0, 20);
}
function makeWorld(candidate, facts, rules, parentRoot, branchId, seq, overrides) {
  const limits = mergedLimits(overrides);
  const query = Object.assign(copy(candidate.query), { world_root: null, requested_operation: 'derive_signed_atom' });
  const fid = (f, i) => 'fact:' + (i + 1) + ':' + sha256(canon({ atom: f.atom, source_ref: f.source_ref, source_span: f.source_span })).slice(0, 12);
  const rid = (r, i) => 'rule:' + (i + 1) + ':' + sha256(canon({ body: r.body, head: r.head, form: r.form, source_ref: r.source_ref, source_span: r.source_span })).slice(0, 12);
  const atomsAll = facts.map(f => f.atom).concat(rules.flatMap(r => r.body.concat([r.head])), [candidate.query.atom]);
  const body = {
    schema: WORLD_SCHEMA,
    candidate_id: candidate.candidate_id,
    language_candidate_refs: [candidate.candidate_id],
    parent_root: parentRoot,
    branch_id: branchId,
    creation_sequence: seq,
    entities: [...new Set(atomsAll.flatMap(a => a.args).filter(x => !/^\$/.test(x)))].sort(),
    facts: facts.map((f, i) => Object.assign(copy(f), { id: fid(f, i), time: null, evidence_refs: [f.source_ref], provenance_refs: [candidate.candidate_id] })),
    rules: rules.map((r, i) => Object.assign(copy(r), { id: rid(r, i), variables: [...new Set(r.body.concat([r.head]).flatMap(variables))].sort(), rule_class: r.form, evidence_refs: [r.source_ref], provenance_refs: [candidate.candidate_id] })),
    query,
    source_refs: candidate.sources.map(s => ({ id: s.id, span: copy(s.span) })),
    evidence_refs: candidate.sources.map(s => s.id),
    provenance_refs: [candidate.candidate_id],
    limits,
    authority: { network: false, tools: false, governed_memory_read: false, knowledge_write: false, world_write: false, file_write: false }
  };
  const worldRoot = digest('turn-world', body); body.query.world_root = worldRoot;
  return deepFreeze(Object.assign({ world_root: worldRoot }, body));
}

const WORLD_FIELDS = ['world_root', 'schema', 'candidate_id', 'language_candidate_refs', 'parent_root', 'branch_id', 'creation_sequence', 'entities', 'facts', 'rules', 'query', 'source_refs', 'evidence_refs', 'provenance_refs', 'limits', 'authority'];
function worldBody(world) { const o = copy(world); delete o.world_root; if (o.query) o.query.world_root = null; return o; }
function worldIntegrity(world) {
  if (!exactKeys(world, WORLD_FIELDS) || world.schema !== WORLD_SCHEMA || typeof world.world_root !== 'string' || !/^semantic-candidate:sha256:[0-9a-f]{64}$/.test(world.candidate_id) || !((world.parent_root === null && world.branch_id === 'turn:root' && world.creation_sequence === 0) || (/^turn-world:sha256:[0-9a-f]{64}$/.test(world.parent_root) && /^branch:[0-9a-f]{20}$/.test(world.branch_id) && world.creation_sequence === 1)) || !refsOk(world.language_candidate_refs) || world.language_candidate_refs.length !== 1 || world.language_candidate_refs[0] !== world.candidate_id || !Array.isArray(world.entities) || !Array.isArray(world.facts) || !Array.isArray(world.rules) || !Array.isArray(world.source_refs) || !refsOk(world.evidence_refs) || !refsOk(world.provenance_refs)) return false;
  if (!world.limits || !exactKeys(world.limits, Object.keys(LIMITS)) || Object.keys(LIMITS).some(k => !Number.isInteger(world.limits[k]) || world.limits[k] < 0 || world.limits[k] > LIMITS[k])) return false;
  if (world.language_candidate_refs.length > world.limits.MAX_CANDIDATES || world.facts.length > world.limits.MAX_FACTS || world.rules.length > world.limits.MAX_RULES || world.entities.length > world.limits.MAX_ENTITIES || world.source_refs.length > world.limits.MAX_SENTENCES) return false;
  const sourceMap = new Map(); for (let i = 0; i < world.source_refs.length; i++) { const s = world.source_refs[i]; if (!exactKeys(s, ['id', 'span']) || s.id !== 'source:' + (i + 1) || !spanOk(s.span) || s.span.end > world.limits.MAX_INPUT_CHARS || (i && s.span.start < world.source_refs[i - 1].span.end)) return false; sourceMap.set(s.id, s); }
  if (!same(world.evidence_refs, world.source_refs.map(s => s.id)) || !same(world.provenance_refs, [world.candidate_id])) return false;
  if (!world.query || !exactKeys(world.query, ['atom', 'source_ref', 'source_span', 'world_root', 'requested_operation']) || !validAtom(world.query.atom) || world.query.atom.args.some(x => /^\$/.test(x)) || !sourceMap.has(world.query.source_ref) || !world.source_refs.length || world.query.source_ref !== world.source_refs[world.source_refs.length - 1].id || !same(world.query.source_span, sourceMap.get(world.query.source_ref).span) || world.query.world_root !== world.world_root || world.query.requested_operation !== 'derive_signed_atom') return false;
  const auth = ['network', 'tools', 'governed_memory_read', 'knowledge_write', 'world_write', 'file_write']; if (!exactKeys(world.authority, auth) || auth.some(k => world.authority[k] !== false)) return false;
  const factAtoms = new Set(), ruleAtoms = new Set();
  for (let i = 0; i < world.facts.length; i++) {
    const f = world.facts[i]; if (!exactKeys(f, ['id', 'atom', 'source_ref', 'source_span', 'time', 'evidence_refs', 'provenance_refs']) || !validAtom(f.atom)) return false;
    const b = { atom: f.atom, source_ref: f.source_ref, source_span: f.source_span }, k = atomKey(f.atom);
    if (f.id !== 'fact:' + (i + 1) + ':' + sha256(canon(b)).slice(0, 12) || factAtoms.has(k) || f.atom.args.some(x => /^\$/.test(x)) || !sourceMap.has(f.source_ref) || (f.source_ref === world.query.source_ref && !(world.creation_sequence === 1 && /^any_/.test(world.query.atom.args[0]) && same(f.atom, atom(world.query.atom.args[0].slice(4), [world.query.atom.args[0]])))) || !same(f.source_span, sourceMap.get(f.source_ref).span) || f.time !== null || !same(f.evidence_refs, [f.source_ref]) || !same(f.provenance_refs, [world.candidate_id])) return false; factAtoms.add(k);
  }
  for (let i = 0; i < world.rules.length; i++) {
    const r = world.rules[i]; if (!exactKeys(r, ['id', 'body', 'head', 'form', 'source_ref', 'source_span', 'variables', 'rule_class', 'evidence_refs', 'provenance_refs']) || validateRule(r)) return false;
    const vars = [...new Set(r.body.concat([r.head]).flatMap(variables))].sort(), b = { body: r.body, head: r.head, form: r.form, source_ref: r.source_ref, source_span: r.source_span }, k = canon({ body: r.body, head: r.head });
    if (r.id !== 'rule:' + (i + 1) + ':' + sha256(canon(b)).slice(0, 12) || ruleAtoms.has(k) || !/^(?:conditional|universal_negative|universal_conjunctive|universal_unary|universal_relation|universal_intransitive)$/.test(r.form) || r.body.length > world.limits.MAX_RULE_BODY || !same(r.variables, vars) || !r.variables.every(x => nameOk(x, true)) || r.rule_class !== r.form || !sourceMap.has(r.source_ref) || r.source_ref === world.query.source_ref || !same(r.source_span, sourceMap.get(r.source_ref).span) || !same(r.evidence_refs, [r.source_ref]) || !same(r.provenance_refs, [world.candidate_id])) return false; ruleAtoms.add(k);
  }
  const worldAtoms = world.facts.map(f => f.atom).concat(world.rules.flatMap(r => r.body.concat([r.head])), [world.query.atom]);
  const worldEntities = [...new Set(worldAtoms.flatMap(a => a.args).filter(x => !/^\$/.test(x)))].sort();
  if (!same(world.entities, worldEntities) || worldAtoms.some(a => a.predicate.length > world.limits.MAX_SYMBOL_CHARS || a.args.some(x => x.replace(/^\$/, '').length > world.limits.MAX_SYMBOL_CHARS))) return false;
  return world.world_root === digest('turn-world', worldBody(world));
}

function unify(pattern, value, input) {
  if (!pattern || !value || pattern.predicate !== value.predicate || pattern.polarity !== value.polarity || pattern.args.length !== value.args.length) return null;
  const subst = Object.assign({}, input || {});
  for (let i = 0; i < pattern.args.length; i++) {
    const p = pattern.args[i], v = value.args[i];
    if (/^\$/.test(p)) { if (subst[p] !== undefined && subst[p] !== v) return null; subst[p] = v; }
    else if (p !== v) return null;
  }
  return subst;
}

function instantiate(pattern, subst) {
  const args = pattern.args.map(x => /^\$/.test(x) ? subst[x] : x);
  return args.some(x => x === undefined) ? null : atom(pattern.predicate, args, pattern.polarity);
}

const guardOk = (rule, s) => (rule.guard || []).every(g => g[0] === 'distinct' && s[g[1]] !== undefined && s[g[1]] !== s[g[2]]);
function substitutions(rule, entries, budget, index) {
  let rows = [{ substitution: {}, premises: [] }];
  for (const pattern of rule.body) {
    const next = [];
    for (const row of rows) for (const e of index ? index.get(pattern.polarity + ' ' + pattern.predicate) || [] : entries) {
      budget.work++;
      if (budget.work > budget.max) { budget.exhausted = true; return []; }
      const s = unify(pattern, e.atom, row.substitution);
      if (s) next.push({ substitution: s, premises: row.premises.concat(e.step.step_id) });
    }
    rows = next; if (!rows.length) break;
  }
  return rows.filter(r => guardOk(rule, r.substitution)).sort((a, b) => canon(a).localeCompare(canon(b)));
}

function orderSteps(entry, steps) {
  const ordered = [], seen = new Set();
  (function visit(id) {
    if (seen.has(id)) return;
    const s = steps.get(id); if (!s) throw new Error('PROOF_STEP_MISSING');
    for (const p of s.kind === 'rule' ? s.premises : []) visit(p);
    seen.add(id); ordered.push(copy(s));
  })(entry.step.step_id);
  return ordered;
}
function proofFor(world, entry, steps) {
  if (!entry) return null;
  const ordered = orderSteps(entry, steps);
  if (ordered.length > world.limits.MAX_PROOF_STEPS) return null;
  const depths = new Map(); for (const s of ordered) { const depth = s.kind === 'fact' ? 1 : 1 + Math.max(0, ...s.premises.map(p => depths.get(p) || 0)); if (depth > world.limits.MAX_PROOF_DEPTH) return null; depths.set(s.step_id, depth); }
  const core = { schema: PROOF_SCHEMA, world_root: world.world_root, query: copy(world.query), conclusion: copy(entry.atom), steps: ordered, engine_version: ENGINE_VERSION, checker_version: CHECKER_VERSION };
  const checkResult = replayProofCore(world, core); if (!checkResult.ok) return null;
  const body = Object.assign(core, { check_result: checkResult });
  return Object.assign({ proof_id: digest('proof', body) }, body);
}

/* the one fixed-point closure: TurnWorld derivation and data rule worlds (rules as data) share it */
function closure(facts, rules, L, indexed) {
  const entries = new Map(), steps = new Map();
  for (const f of facts) {
    const step = { kind: 'fact', step_id: 'step:' + f.id, fact_id: f.id, premises: [], substitution: {}, polarity: f.atom.polarity, conclusion: copy(f.atom) };
    const e = { atom: copy(f.atom), step }; entries.set(atomKey(e.atom), e); steps.set(step.step_id, step);
  }
  const budget = { work: 0, max: L.MAX_WORK, exhausted: false };
  let derivations = 0, rounds = 0, stable = false;
  for (rounds = 1; rounds <= L.MAX_ROUNDS; rounds++) {
    let changed = false; const snapshot = [...entries.values()].sort((a, b) => atomKey(a.atom).localeCompare(atomKey(b.atom)));
    let index = null; if (indexed) { index = new Map(); for (const e of snapshot) { const k = e.atom.polarity + ' ' + e.atom.predicate; if (!index.has(k)) index.set(k, []); index.get(k).push(e); } }
    for (const rule of rules) {
      const rows = substitutions(rule, snapshot, budget, index); if (budget.exhausted) break;
      for (const row of rows) {
        const conclusion = instantiate(rule.head, row.substitution); if (!conclusion) continue;
        const k = atomKey(conclusion); if (entries.has(k)) continue;
        if (derivations >= L.MAX_DERIVATIONS || entries.size >= L.MAX_FACTS + L.MAX_DERIVATIONS) { budget.exhausted = true; break; }
        const material = { rule_id: rule.id, premises: row.premises, substitution: row.substitution, polarity: conclusion.polarity, conclusion };
        const step = Object.assign({ kind: 'rule', step_id: 'step:derived:' + sha256(canon(material)).slice(0, 20) }, material);
        entries.set(k, { atom: conclusion, step }); steps.set(step.step_id, step); derivations++; changed = true;
      }
      if (budget.exhausted) break;
    }
    if (budget.exhausted) break;
    if (!changed) { stable = true; break; }
  }
  return { entries, steps, budget, rounds, derivations, stable };
}
function deriveWorld(world) {
  if (!worldIntegrity(world)) return { complete: false, failure: 'WORLD_ROOT_INVALID', work: 0, rounds: 0, derivations: 0, support: null, refutation: null };
  const { entries, steps, budget, rounds, derivations, stable } = closure(world.facts, world.rules.slice().sort((a, b) => a.id.localeCompare(b.id)), world.limits, false);
  const closureComplete = stable && !budget.exhausted;
  const supportEntry = entries.get(atomKey(world.query.atom)), refuteEntry = entries.get(atomKey(opposite(world.query.atom)));
  const support = proofFor(world, supportEntry, steps), refutation = proofFor(world, refuteEntry, steps);
  const proofLimited = closureComplete && ((supportEntry && !support) || (refuteEntry && !refutation));
  const complete = closureComplete && !proofLimited;
  return { complete, failure: complete ? null : budget.exhausted ? 'WORK_LIMIT' : !stable ? 'ROUND_LIMIT' : 'PROOF_LIMIT', work: budget.work, rounds: Math.min(rounds, world.limits.MAX_ROUNDS), derivations, closure_size: entries.size, support, refutation };
}

function replayProofCore(world, proof) {
  const fail = code => ({ ok: false, code, checker_version: CHECKER_VERSION });
  if (!worldIntegrity(world)) return fail('WORLD_ROOT_INVALID');
  if (!proof || !exactKeys(proof, ['schema', 'world_root', 'query', 'conclusion', 'steps', 'engine_version', 'checker_version'])) return fail('PROOF_SHAPE');
  if (proof.schema !== PROOF_SCHEMA || proof.world_root !== world.world_root || proof.engine_version !== ENGINE_VERSION || proof.checker_version !== CHECKER_VERSION) return fail('PROOF_CONTEXT');
  if (!same(proof.query, world.query) || !validAtom(proof.conclusion) || (!same(proof.conclusion, world.query.atom) && !same(proof.conclusion, opposite(world.query.atom))) || !Array.isArray(proof.steps) || !proof.steps.length || proof.steps.length > world.limits.MAX_PROOF_STEPS) return fail('PROOF_CONTENT');
  const rp = replaySteps(new Map(world.facts.map(f => [f.id, f])), new Map(world.rules.map(r => [r.id, r])), proof.steps, world.limits.MAX_PROOF_DEPTH, proof.conclusion);
  return rp.ok ? { ok: true, code: 'PROOF_REPLAY_ACCEPTED', checker_version: CHECKER_VERSION, steps: proof.steps.length } : fail(rp.code);
}
/* independent step replay: every fact step is a stated fact, every rule step re-instantiates its rule (guards re-checked); no step unused */
function replaySteps(facts, rules, proofSteps, maxDepth, finalAtom) {
  const fail = code => ({ ok: false, code });
  const derived = new Map(), stepById = new Map(), depths = new Map();
  for (const step of proofSteps) {
    if (!step || typeof step.step_id !== 'string' || derived.has(step.step_id)) return fail('STEP_REPLAY');
    if (step.kind === 'fact') {
      if (!exactKeys(step, ['kind', 'step_id', 'fact_id', 'premises', 'substitution', 'polarity', 'conclusion']) || !Array.isArray(step.premises) || step.premises.length || !step.substitution || typeof step.substitution !== 'object' || Array.isArray(step.substitution) || Object.keys(step.substitution).length) return fail('FACT_STEP_SHAPE');
      const f = facts.get(step.fact_id);
      if (!f || step.step_id !== 'step:' + f.id || step.polarity !== step.conclusion.polarity || !same(step.conclusion, f.atom)) return fail('FACT_STEP_REPLAY');
      derived.set(step.step_id, copy(step.conclusion)); stepById.set(step.step_id, step); depths.set(step.step_id, 1); continue;
    }
    if (step.kind !== 'rule' || !exactKeys(step, ['kind', 'step_id', 'rule_id', 'premises', 'substitution', 'polarity', 'conclusion'])) return fail('RULE_STEP_SHAPE');
    const r = rules.get(step.rule_id);
    if (!r || !Array.isArray(step.premises) || step.premises.length !== r.body.length || !step.substitution || typeof step.substitution !== 'object' || Array.isArray(step.substitution)) return fail('RULE_STEP_CONTEXT');
    const expectedVars = [...new Set(r.body.concat([r.head]).flatMap(variables))].sort();
    if (!same(Object.keys(step.substitution).sort(), expectedVars)) return fail('SUBSTITUTION_SHAPE');
    if (!guardOk(r, step.substitution)) return fail('GUARD_REPLAY');
    for (let i = 0; i < r.body.length; i++) {
      const premise = derived.get(step.premises[i]); if (!premise) return fail('PREMISE_REFERENCE');
      const expected = instantiate(r.body[i], step.substitution); if (!expected || !same(expected, premise)) return fail('PREMISE_REPLAY');
    }
    const conclusion = instantiate(r.head, step.substitution); if (!conclusion || !same(conclusion, step.conclusion)) return fail('CONCLUSION_REPLAY');
    if (step.polarity !== conclusion.polarity) return fail('POLARITY_REPLAY');
    const depth = 1 + Math.max(0, ...step.premises.map(p => depths.get(p) || 0)); if (depth > maxDepth) return fail('PROOF_DEPTH_LIMIT');
    const material = { rule_id: r.id, premises: step.premises, substitution: step.substitution, polarity: conclusion.polarity, conclusion };
    if (step.step_id !== 'step:derived:' + sha256(canon(material)).slice(0, 20)) return fail('STEP_ID_MISMATCH');
    derived.set(step.step_id, copy(conclusion)); stepById.set(step.step_id, step); depths.set(step.step_id, depth);
  }
  const last = proofSteps[proofSteps.length - 1];
  if (!same(derived.get(last.step_id), finalAtom)) return fail('FINAL_CONCLUSION');
  const used = new Set(); (function visit(id) { if (used.has(id)) return; const s = stepById.get(id); if (!s) return; used.add(id); for (const p of s.premises) visit(p); })(last.step_id);
  if (used.size !== proofSteps.length) return fail('UNUSED_STEP');
  return { ok: true };
}

/* GELC S1 rule worlds: typed Rule objects (rules as data, same atom/rule language and closure as TurnWorld) over stated facts.
   Every answer carries a RuleProof/v1 replayed by replaySteps; absence of a proof is "not proven", never false. */
const RULE_PROOF_SCHEMA = 'RuleProof/v1';
const RW_LIMITS = Object.freeze({ MAX_WORK: 4000000, MAX_ROUNDS: 128, MAX_DERIVATIONS: 40000, MAX_FACTS: 4000, MAX_PROOF_STEPS: 512, MAX_PROOF_DEPTH: 256 });
function validDataRule(r) { if (!r || typeof r.id !== 'string' || !Array.isArray(r.body) || !r.body.length || !r.head) return false; const at = a => a && typeof a.predicate === 'string' && Array.isArray(a.args) && a.args.length && (a.polarity === 'pos' || a.polarity === 'neg'); if (!r.body.every(at) || !at(r.head)) return false; const bv = new Set(r.body.flatMap(variables)); return variables(r.head).every(v => bv.has(v)) && (r.guard || []).every(g => Array.isArray(g) && g[0] === 'distinct' && bv.has(g[1]) && bv.has(g[2])); }
function ruleWorld(facts, rules) {
  if (!rules.every(validDataRule)) throw new Error('RULE_INVALID');
  const fs = []; const ids = new Set(); for (const f of facts) if (!ids.has(f.id)) { ids.add(f.id); fs.push({ id: f.id, atom: atom(f.atom.predicate, f.atom.args, f.atom.polarity) }); }
  const rs = rules.slice().sort((a, b) => a.id.localeCompare(b.id)); const C = closure(fs, rs, RW_LIMITS, true);
  const complete = C.stable && !C.budget.exhausted;
  function prove(a) { const e = C.entries.get(atomKey(atom(a.predicate, a.args, a.polarity))); if (!e) return null;
    const steps = orderSteps(e, C.steps); const proof = { schema: RULE_PROOF_SCHEMA, conclusion: copy(e.atom), steps, rule_ids: [...new Set(steps.filter(s => s.kind === 'rule').map(s => s.rule_id))].sort(), fact_ids: steps.filter(s => s.kind === 'fact').map(s => s.fact_id) };
    const check = checkRuleProof(fs, rs, proof); if (!check.ok) return null; return Object.assign(proof, { proof_id: digest('rule-proof', proof), check }); }
  return { complete, prove, holds: a => !!C.entries.get(atomKey(atom(a.predicate, a.args, a.polarity))), atoms: () => [...C.entries.values()].map(e => copy(e.atom)), work: C.budget.work };
}
function checkRuleProof(facts, rules, proof) {
  if (!proof || proof.schema !== RULE_PROOF_SCHEMA || !Array.isArray(proof.steps) || !proof.steps.length || proof.steps.length > RW_LIMITS.MAX_PROOF_STEPS || !rules.every(validDataRule)) return { ok: false, code: 'PROOF_SHAPE', checker_version: CHECKER_VERSION };
  const rp = replaySteps(new Map(facts.map(f => [f.id, f])), new Map(rules.map(r => [r.id, r])), proof.steps, RW_LIMITS.MAX_PROOF_DEPTH, proof.conclusion);
  return rp.ok ? { ok: true, code: 'PROOF_REPLAY_ACCEPTED', checker_version: CHECKER_VERSION, steps: proof.steps.length } : { ok: false, code: rp.code, checker_version: CHECKER_VERSION };
}

function checkProof(world, proof) {
  const fail = code => ({ ok: false, code, checker_version: CHECKER_VERSION });
  if (!worldIntegrity(world)) return fail('WORLD_ROOT_INVALID');
  if (!proof || !exactKeys(proof, ['proof_id', 'schema', 'world_root', 'query', 'conclusion', 'steps', 'engine_version', 'checker_version', 'check_result'])) return fail('PROOF_SHAPE');
  const body = copy(proof); delete body.proof_id;
  if (proof.proof_id !== digest('proof', body)) return fail('PROOF_ID_MISMATCH');
  const core = copy(body); delete core.check_result; const replay = replayProofCore(world, core);
  if (!replay.ok) return replay;
  if (!same(proof.check_result, replay)) return fail('CHECK_RESULT_MISMATCH');
  return replay;
}

function resultStatus(derivation, supportCheck, refutationCheck) {
  if (!derivation.complete) return 'incomplete';
  if ((derivation.support && !supportCheck.ok) || (derivation.refutation && !refutationCheck.ok)) return 'proof_rejected';
  if (derivation.support && derivation.refutation) return 'conflicted';
  if (derivation.support) return 'supported_only';
  if (derivation.refutation) return 'refuted_only';
  return 'undetermined';
}

function rmcSelect(world, derivation, status, checks) {
  const hasSupport = !!derivation.support, hasRefutation = !!derivation.refutation;
  const expected = {
    supported_only: hasSupport && !hasRefutation && derivation.complete,
    refuted_only: !hasSupport && hasRefutation && derivation.complete,
    conflicted: hasSupport && hasRefutation && derivation.complete,
    undetermined: !hasSupport && !hasRefutation && derivation.complete,
    incomplete: !derivation.complete,
    proof_rejected: (hasSupport && !checks.support.ok) || (hasRefutation && !checks.refutation.ok)
  };
  const candidates = Object.keys(expected).map(name => {
    const needsSupport = name === 'supported_only' || name === 'conflicted', needsRefutation = name === 'refuted_only' || name === 'conflicted';
    const gates = {
      world_root_valid: worldIntegrity(world),
      status_matches: name === status && !!expected[name],
      support_proof_checked: !needsSupport || !!(checks.support && checks.support.ok),
      refutation_proof_checked: !needsRefutation || !!(checks.refutation && checks.refutation.ok),
      no_unchecked_truth_claim: name === 'undetermined' || name === 'incomplete' || name === 'proof_rejected' || ((!hasSupport || checks.support.ok) && (!hasRefutation || checks.refutation.ok))
    };
    return { id: 'result:' + name, status: name, gates, eligible: Object.values(gates).every(Boolean) };
  });
  const selected = candidates.find(c => c.status === status && c.eligible); if (!selected) throw new Error('RMC_NO_ELIGIBLE_RESULT');
  const body = { schema: 'RMCWorldManifest/v1', version: RMC_VERSION, request: copy(world.query), world_root: world.world_root, language_candidate_refs: copy(world.language_candidate_refs), plan: ['derive_query', 'derive_opposite', 'replay_each_proof', 'select_checked_result'], candidate_ids: candidates.map(c => c.id), candidates, selected: selected.id, status, proof_ids: [derivation.support && derivation.support.proof_id, derivation.refutation && derivation.refutation.proof_id].filter(Boolean), exploration: { complete: derivation.complete, failure: derivation.failure, work: derivation.work, rounds: derivation.rounds, derivations: derivation.derivations, closure_size: derivation.closure_size }, limits: copy(world.limits), authority: copy(world.authority), reproducibility: { canonicalizer: 'forge-canonical-json/v1', deterministic: true, parser_version: PARSER_VERSION, engine_version: ENGINE_VERSION, checker_version: CHECKER_VERSION } };
  return Object.assign({ manifest_id: digest('rmc-world-manifest', body) }, body);
}

function buildAnswer(raw, candidate, world, derivation) {
  const supportCheck = derivation.support ? checkProof(world, derivation.support) : { ok: true, code: 'NO_SUPPORT_PROOF' };
  const refutationCheck = derivation.refutation ? checkProof(world, derivation.refutation) : { ok: true, code: 'NO_REFUTATION_PROOF' };
  const status = resultStatus(derivation, supportCheck, refutationCheck), checks = { support: supportCheck, refutation: refutationCheck };
  const rmc = rmcSelect(world, derivation, status, checks), queryText = atomText(world.query.atom), oppositeText = atomText(opposite(world.query.atom));
  const envelopeBody = {
    schema: ENVELOPE_SCHEMA,
    request_id: digest('world-request', { input_sha256: sha256(String(raw).normalize('NFC')), candidate_id: candidate.candidate_id }),
    input_sha256: sha256(String(raw).normalize('NFC')),
    language_candidate_id: candidate.candidate_id,
    world_root: world.world_root,
    rmc_manifest_id: rmc.manifest_id,
    result_status: status,
    answer_proposition: status === 'supported_only' ? copy(world.query.atom) : status === 'refuted_only' ? opposite(world.query.atom) : null,
    proof_ids: rmc.proof_ids,
    checker_verdicts: copy(checks),
    completeness: derivation.complete ? 'complete_finite_closure' : derivation.failure,
    limits: copy(world.limits),
    effects: { network_calls: 0, tool_executions: 0, governed_memory_reads: 0, knowledge_writes: 0, world_writes: 0, file_writes: 0, host_audit_trace: 'bounded' },
    versions: { language: PARSER_VERSION, world: WORLD_SCHEMA, inference: ENGINE_VERSION, checker: CHECKER_VERSION, rmc: RMC_VERSION },
    echo: { status: 'pending_kernel_echo' }
  };
  return {
    kind: 'world_answer', schema: SCHEMA, status, query: copy(world.query.atom), query_text: queryText, opposite_text: oppositeText,
    interpretation: { candidate_id: candidate.candidate_id, parser_version: candidate.parser_version, sources: copy(candidate.sources), unresolved_symbols: [] },
    world: copy(world),
    derivation: { complete: derivation.complete, failure: derivation.failure, work: derivation.work, rounds: derivation.rounds, derivations: derivation.derivations, closure_size: derivation.closure_size },
    proofs: { support: derivation.support, refutation: derivation.refutation }, checker: checks, rmc, envelope: envelopeBody
  };
}

function limitationMaterial(raw, failure, limitOverrides) {
  return {
    kind: 'world_limitation', schema: SCHEMA, status: 'unsupported_structure', code: failure.code, detail: failure.detail, source: failure.source, span: copy(failure.span), parser_version: failure.parser_version, unknown_word: false,
    envelope: {
      schema: ENVELOPE_SCHEMA,
      request_id: digest('world-request-failure', { input_sha256: sha256(String(raw).normalize('NFC')), code: failure.code, span: failure.span }),
      input_sha256: sha256(String(raw).normalize('NFC')),
      language_candidate_id: null,
      world_root: null,
      rmc_manifest_id: null,
      result_status: 'unsupported_structure',
      answer_proposition: null,
      proof_ids: [],
      checker_verdicts: {
        support: { ok: false, code: 'NOT_RUN_NO_WORLD' },
        refutation: { ok: false, code: 'NOT_RUN_NO_WORLD' }
      },
      completeness: 'unsupported_structure',
      limits: mergedLimits(limitOverrides),
      effects: { network_calls: 0, tool_executions: 0, governed_memory_reads: 0, knowledge_writes: 0, world_writes: 0, file_writes: 0, host_audit_trace: 'bounded' },
      versions: { language: PARSER_VERSION, world: WORLD_SCHEMA, inference: ENGINE_VERSION, checker: CHECKER_VERSION, rmc: RMC_VERSION }, echo: { status: 'pending_kernel_echo' }
    }
  };
}

/* branch drift (implementation choice, ε_s = (σ_res + D_score + |ΔΦ|)/3 as in ede.js): σ_res = share of overlay atoms whose opposite the committed
   closure derives; D_score = 1 − Jaccard(overlay symbols, committed symbols); |ΔΦ| = 1 when the supposition changes the query status. Governed by the
   drift ruling: a branch in 0.4–0.8 is exploration inside quarantine; nothing in a branch projects (only a proof-checked promotion can, at ε_s ≤ 0.35) */
function branchDrift(base, world, bs, ws) { const KM = isNode ? require('./kmath.js') : root.KMath, n = base.facts.length, m = base.rules.length;
  const ov = world.facts.slice(n).map(f => f.atom).concat(world.rules.slice(m).map(r => r.head)), have = closure(base.facts, base.rules.slice().sort((a, b) => a.id.localeCompare(b.id)), base.limits, false).entries;
  const sig = ov.length ? ov.filter(a => have.has(atomKey(opposite(a)))).length / ov.length : 0, sym = as => new Set(as.flatMap(a => [a.predicate].concat(a.args.filter(x => !/^\$/.test(x)))));
  const B = sym(base.facts.map(f => f.atom).concat(base.rules.flatMap(r => r.body.concat([r.head])))), O = sym(world.facts.slice(n).map(f => f.atom).concat(world.rules.slice(m).flatMap(r => r.body.concat([r.head]))));
  let i = 0; for (const x of O) if (B.has(x)) i++; const D = 1 - i / (B.size + O.size - i || 1), dPhi = bs === ws ? 0 : 1, eps = (sig + D + dPhi) / 3;
  return Object.assign(KM.driftGovernance(eps), { sigma_res: KM.r4(sig), D_score: KM.r4(D), dPhi, n: 3, projected: false }); }
function evaluate1(raw, opts) {
  opts = opts || {}; const interpreted = interpret(raw, opts);
  if (!interpreted.handled) return { handled: false };
  const limits = mergedLimits(opts.limits), failure = interpreted.failure || candidateLimitFailure(interpreted.candidate, limits);
  if (failure) {
    const material = limitationMaterial(raw, failure, limits);
    return { handled: true, outcome: 'UNSUPPORTED_PRESERVED', material, frame: 'FR.WORLD.MODEL', act: 'question', rules: [
      { id: 'WM-LANGUAGE-STRUCTURE-LIMIT', doc: DOC, note: failure.code + '; unknown_word=false' },
      { id: 'WM-AUTHORITY-ZERO', doc: DOC, note: 'network=0 tools=0 governed-memory-read=0 knowledge-write=0 world-write=0' }
    ], uncertainty: 'unsupported_structure', reasoningCandidates: [] };
  }
  const W = buildWorlds(interpreted.candidate, limits), world = W.world, derivation = deriveWorld(world), material = buildAnswer(raw, interpreted.candidate, world, derivation);
  if (W.base) { const baseRoot = digest('turn-world', worldBody(W.base)), bd = deriveWorld(W.base), bs = buildAnswer(raw, interpreted.candidate, W.base, bd).status;
    if (!branchIntegrity(W.base, world) || baseRoot !== W.base.world_root) throw new Error('WORLD_BRANCH_INVALID');
    material.branch = { schema: 'WhatIfBranch/v1', branch_id: world.branch_id, parent_root: W.base.world_root, overlay_fact_ids: world.facts.slice(W.base.facts.length).map(f => f.id), overlay_rule_ids: world.rules.slice(W.base.rules.length).map(r => r.id), committed_status: bs, committed_unchanged: true, scope: 'proofs are valid only in this branch', drift: branchDrift(W.base, world, bs, material.status) }; }
  return {
    handled: true,
    outcome: material.status === 'proof_rejected' ? 'REFUSAL_RELEVANT' : 'SELECTED_MEANING',
    material,
    frame: 'FR.WORLD.MODEL',
    act: 'question',
    rules: [
      { id: 'WM-SEMANTIC-CANDIDATE', doc: DOC, note: interpreted.candidate.candidate_id },
      { id: 'WM-IMMUTABLE-TURN-WORLD', doc: DOC, note: world.world_root },
      ...(material.branch ? [{ id: 'WM-WHAT-IF-BRANCH', doc: DOC + ' §6.3', note: world.branch_id + ' over ' + material.branch.parent_root + '; committed: ' + material.branch.committed_status }, { id: 'GELC-DRIFT-BAND', doc: material.branch.drift.ruling, note: 'ε_s=' + material.branch.drift.eps_s + ' ' + material.branch.drift.band + '; branch never projects' }] : []),
      { id: 'WM-PARACONSISTENT-CLOSURE', doc: DOC, note: material.status + '; work=' + derivation.work + '; closure=' + derivation.closure_size },
      { id: 'WM-INDEPENDENT-PROOF-REPLAY', doc: DOC, note: material.checker.support.code + '/' + material.checker.refutation.code },
      { id: 'WM-RMC-SELECT-CHECKED', doc: DOC, note: material.rmc.selected },
      { id: 'WM-AUTHORITY-ZERO', doc: DOC, note: 'network=0 tools=0 governed-memory-read=0 knowledge-write=0 world-write=0' }
    ],
    uncertainty: material.status === 'undetermined' || material.status === 'incomplete' ? material.status : 'none',
    reasoningCandidates: material.rmc.candidates
  };
}

/* wh-questions (who/what/which/where/whom) are yes/no queries with ONE open slot: the question is rewritten (wh-movement undone) into a yes/no
   template, the slot ranges over the symbols the turn itself declares (entities, or unary/prepositional predicates), and every instance runs the
   full pipeline (fresh TurnWorld, both polarities, independent replay). Only instances whose proof was checked are answers; the rest stay open
   (open world: an unlisted binding is not refuted). No vocabulary decides anything: the slot domain is the input's own symbols. */
const SLOT = 'whslotq';
const WH_SUBJ = rx('^(?:who|what)\\s+(?:is|are)\\s+(not\\s+)?(?:(a|an)\\s+|the\\s+)?(' + SP + ')$');
const WH_PP = rx('^(?:who|what)\\s+(?:is|are)\\s+(not\\s+)?(' + SP + ')\\s+' + NP + '$');
const WH_WHERE = rx('^where\\s+(?:is|are)\\s+' + NP + '$');
const WH_OBJ = rx('^(?:who|whom|what)\\s+(?:does|do)\\s+' + NP + '\\s+(not\\s+)?(' + SP + ')$');
const WH_VERB = rx('^(?:who|what)\\s+(?:(?:does|do)\\s+(not)\\s+)?(' + SP + ')(?:\\s+' + NP + ')?$');
const WH_WHICH = rx('^(?:which|what)\\s+(' + SP + ')\\s+(.+)$');
function whPlans(t, ctx) {
  const n = x => x ? 'not ' : '', plans = []; let m;
  if ((m = t.match(WH_WHERE))) return [{ slot: 'prep', q: p => 'is ' + m[1] + ' ' + p + ' ' + SLOT }];
  if ((m = t.match(WH_PP)) && isPrep(m[2])) return [{ slot: 'entity', q: () => 'is ' + SLOT + ' ' + n(m[1]) + m[2] + ' ' + m[3] }];
  if ((m = t.match(WH_SUBJ))) { const w = m[3], e = term(w, false), p = symbol(w, 'predicate'), ind = !!m[2] && /^what/i.test(t);
    if (ind) return [{ slot: 'pred', q: c => c === p ? null : 'is a ' + w + ' ' + n(m[1]) + 'a ' + c, generic: true }];
    if (p && (m[2] || ctx.preds.has(p))) plans.push({ slot: 'entity', q: () => 'is ' + SLOT + ' ' + n(m[1]) + 'a ' + w });
    if (e && !m[2] && (ctx.ents.has(e) || !plans.length)) plans.push({ slot: 'pred', q: c => 'is ' + w + ' ' + n(m[1]) + 'a ' + c });
    return plans; }
  if ((m = t.match(WH_OBJ))) return [{ slot: 'entity', q: () => 'does ' + m[1] + ' ' + n(m[2]) + m[3] + ' ' + SLOT }];
  if ((m = t.match(WH_VERB)) && !/^(?:is|are|does|do|was|were|did|has|have)$/i.test(m[2])) { const v = verbLemma(m[2], ctx.verbs) || symbol(m[2], 'verb', ctx.verbs); if (v) return [{ slot: 'entity', q: () => 'does ' + SLOT + ' ' + n(m[1]) + v + (m[3] ? ' ' + m[3] : '') }]; }
  if ((m = t.match(WH_WHICH)) && !/^(?:is|are|does|do)$/i.test(m[1])) { const sg = pluralForms(m[1]), cls = sg.find(x => ctx.preds.has(symbol(x, 'predicate'))) || sg[0], rest = whPlans('who ' + m[2], ctx);
    return rest.filter(r => r.slot === 'entity').map(r => Object.assign({}, r, { cls })); }
  return plans;
}
const WH_START = /^(?:who|whom|what|which|where)\b/i;
function evaluateWh(raw, segs, qseg, opts) {
  const t = clean(qseg.text).replace(/[?]+$/, ''), head = raw.slice(0, qseg.span.start), ctxIn = interpret(head + 'is ' + SLOT + ' a ' + SLOT + '?', {});
  if (!ctxIn.candidate) return ctxIn.failure ? evaluate1(head + 'is ' + SLOT + ' a ' + SLOT + '?', opts) : null;
  const c = ctxIn.candidate, ents = new Set(c.entities.filter(x => x !== SLOT && !/^any_/.test(x))), atoms = c.atoms.filter(x => x.locus !== 'query').map(x => x.atom);
  const preds = new Set(atoms.filter(a => a.args.length === 1 && !/_v$/.test(a.predicate)).map(a => a.predicate)), preps = [...new Set(atoms.filter(a => a.args.length === 2 && isPrep(a.predicate)).map(a => a.predicate))].sort();
  const plans = whPlans(t, { ents, preds, verbs: verbsOf(segs.filter(x => x.kind === 'assertion').map(x => x.text)) }); if (!plans.length) return null;
  const answers = [], runs = [], undet = []; let incomplete = false, probe = null;
  for (const pl of plans) {
    const dom = pl.slot === 'entity' ? [...ents].sort().map(e => [pl.q(), e]) : pl.slot === 'pred' ? [...preds].sort().map(p => [pl.q(p), null]) : preps.flatMap(p => [...ents].sort().map(e => [pl.q(p), e]));
    for (const [qt, e] of dom.filter(d => d[0]).slice(0, LIMITS.MAX_ENTITIES * 4)) {
      const yn = head + (e ? qt.split(SLOT).join('"' + e + '"') : qt) + '?', r = evaluate1(yn, opts); if (!r.handled || !r.material || r.material.kind !== 'world_answer') continue;
      if (pl.cls && e) { const k = evaluate1(head + 'is "' + e + '" a ' + pl.cls + '?', opts); if (!k.material || k.material.status !== 'supported_only') continue; }
      runs.push(r.material.envelope.request_id); if (!probe) probe = r;
      if (r.material.status === 'supported_only') answers.push(r.material); else if (r.material.status === 'conflicted') answers.push(r.material); else if (r.material.status === 'incomplete') incomplete = true; else undet.push(r.material.query_text);
    }
  }
  const material = { kind: 'world_answer', wh: { question: qseg.source, slots: plans.map(p => p.slot), instances: runs.length, answers: answers.map(a => ({ status: a.status, text: a.status === 'supported_only' ? a.query_text : a.query_text + ' / ' + a.opposite_text, query: copy(a.query), proof: a.proofs.support, world: a.world })) },
    status: answers.length ? 'supported_only' : incomplete ? 'incomplete' : 'undetermined', query: answers.length ? copy(answers[0].query) : null, query_text: '', opposite_text: '', envelope: { schema: ENVELOPE_SCHEMA, result_status: answers.length ? 'supported_only' : incomplete ? 'incomplete' : 'undetermined', instance_request_ids: runs, limits: mergedLimits(opts.limits), completeness: incomplete ? 'incomplete' : 'complete_finite_closure', effects: { network_calls: 0, tool_executions: 0, governed_memory_reads: 0, knowledge_writes: 0, world_writes: 0, file_writes: 0, host_audit_trace: 'bounded' }, versions: { language: PARSER_VERSION, world: WORLD_SCHEMA, inference: ENGINE_VERSION, checker: CHECKER_VERSION, rmc: RMC_VERSION }, echo: { status: 'pending_kernel_echo' } } };
  material.envelope.request_id = digest('world-wh-request', { input_sha256: sha256(String(raw).normalize('NFC')), runs });
  return { handled: true, outcome: 'SELECTED_MEANING', material, frame: 'FR.WORLD.MODEL', act: 'question', rules: [
    { id: 'WM-WH-OPEN-SLOT', doc: DOC + ' §5 (one open variable; each binding a full yes/no turn)', note: plans.map(p => p.slot).join('+') + '; instances=' + runs.length + '; checked answers=' + answers.length },
    { id: 'WM-INDEPENDENT-PROOF-REPLAY', doc: DOC, note: answers.length + ' proof(s) replayed' }, { id: 'WM-AUTHORITY-ZERO', doc: DOC, note: 'network=0 tools=0 governed-memory-read=0 knowledge-write=0 world-write=0' }],
    uncertainty: answers.length ? 'none' : material.status, reasoningCandidates: [] };
}
function evaluate(raw, opts) {
  opts = opts || {}; raw = String(raw || '').normalize('NFC'); const segs = sourceSegments(raw), q = segs.filter(x => x.kind === 'question').slice(-1)[0];
  if (q && WH_START.test(clean(q.text)) && !/\b(?:i|me|my|mine|we|us|our|ours|you|your|yours)\b/i.test(q.text) && segs.indexOf(q) === segs.length - 1 && (segs.length > 1 || opts.bareWh) && raw.length <= LIMITS.MAX_INPUT_CHARS) { const r = evaluateWh(raw, segs, q, opts); if (r) return r; }
  return evaluate1(raw, opts);
}

const api = { SCHEMA, CANDIDATE_SCHEMA, WORLD_SCHEMA, PROOF_SCHEMA, ENVELOPE_SCHEMA, PARSER_VERSION, ENGINE_VERSION, CHECKER_VERSION, LIMITS, canon, sourceSegments, symbol, atom, atomKey, opposite, atomText, parseAtomic, alignVerbs, parseRule, parseQuery, interpret, buildTurnWorld, worldIntegrity, branchIntegrity, buildWorlds, deriveWorld, checkProof, evaluate, ruleWorld, checkRuleProof, RULE_PROOF_SCHEMA };
if (isNode) module.exports = api; else root.KReason = api;
})(typeof self !== 'undefined' ? self : this);
