/* Deterministic rule-based grammar (Doc 3 Language Law; Doc 5 karaka roles; R0 Paninian derivation).
 * analyse → tag → derive (recursive descent, all derivations kept) → karaka role assignment → scope.
 * Generation is the inverse: Clause AST → English with agreement, tense, negation placement, conjunctions.
 * No statistics, no similarity: every choice is a rule with an ID recorded in the derivation. */
(function (root) {
/* ---------- closed-class table (Doc 4 function concepts) ---------- */
const CLOSED = {
  DET: 'the a an this these those', POSS: 'my your his her its our their', QUANT: 'all every each some any many few several most both no',
  PRON: 'i me you he him she her it we us they them myself yourself anything something nothing everything anyone someone noone everyone anybody somebody nobody everybody', WH: 'what who whom where when which why how whose',
  COP: 'am is are was were be been being', AUX: 'do does did have has had', MOD: 'will would shall should can could may might must',
  NEG: 'not never', SUB: 'because while although whereas', THAN: 'than', PREP: 'in on at to from with by for of about into onto under over after before during near without through across around between behind beside since until',
  CONJ: 'and or but', IF: 'if unless', THEN: 'then', REL: 'who which that', COMP: 'that', PART: 'up down out off away back',
  ADV: 'also too very really now today tonight tomorrow yesterday here there always often sometimes usually never already still soon later again maybe perhaps probably possibly definitely certainly',
  PLEASE: 'please', INTJ: 'hello hi hey yes no ok okay thanks goodbye bye',
};
const CL = Object.create(null); for (const [t, ws] of Object.entries(CLOSED)) for (const w of ws.split(' ')) (CL[w] = CL[w] || []).push(t);
const PRON = Object.assign(Object.create(null), { i: { p: 1, n: 'sg', c: 'nom' }, me: { p: 1, n: 'sg', c: 'acc' }, myself: { p: 1, n: 'sg', c: 'acc' }, you: { p: 2, n: 'sg' }, yourself: { p: 2, n: 'sg' },
  he: { p: 3, n: 'sg', g: 'm', c: 'nom' }, him: { p: 3, n: 'sg', g: 'm', c: 'acc' }, she: { p: 3, n: 'sg', g: 'f', c: 'nom' }, her: { p: 3, n: 'sg', g: 'f', c: 'acc' }, it: { p: 3, n: 'sg', g: 'n' },
  we: { p: 1, n: 'pl', c: 'nom' }, us: { p: 1, n: 'pl', c: 'acc' }, they: { p: 3, n: 'pl', c: 'nom' }, them: { p: 3, n: 'pl', c: 'acc' },
  anything: { p: 3, n: 'sg', g: 'n', indef: true }, something: { p: 3, n: 'sg', g: 'n', indef: true }, nothing: { p: 3, n: 'sg', g: 'n', indef: true }, everything: { p: 3, n: 'sg', g: 'n', indef: true },
  anyone: { p: 3, n: 'sg', g: 'u', indef: true }, someone: { p: 3, n: 'sg', g: 'u', indef: true }, noone: { p: 3, n: 'sg', g: 'u', indef: true }, everyone: { p: 3, n: 'sg', g: 'u', indef: true },
  anybody: { p: 3, n: 'sg', g: 'u', indef: true }, somebody: { p: 3, n: 'sg', g: 'u', indef: true }, nobody: { p: 3, n: 'sg', g: 'u', indef: true }, everybody: { p: 3, n: 'sg', g: 'u', indef: true } });
const TIMEW = new Set('now today tonight tomorrow yesterday monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december morning afternoon evening night week month year weekend noon midnight'.split(' '));
/* given names that are also common nouns (Doc4 controlled list): a capitalised occurrence is ambiguous unless memory settles it */
const NAMEISH = new Set('rose lily daisy iris violet ivy jasmine hazel holly heather olive ruby pearl amber crystal jade grace joy hope faith mark bill will pat sue frank victor jack rob dawn april may june summer autumn sky river robin jay drew gene rich bob sandy dusty penny carol angel destiny melody harmony patience honor chase hunter cliff glen dale brook forest heath reed rocky skip buck chip guy art'.split(' '));
const SUBW = new Set(['because', 'when', 'while', 'after', 'before', 'until']);
const CTRL_INF = new Set('want need like love hate try decide plan hope expect agree refuse promise learn forget start begin continue prefer intend wish choose attempt manage fail offer seem afford arrange claim deserve pretend threaten tend volunteer wait'.split(' ')); // Doc5 frame registry: verbs licensing a to-infinitive (union with WordNet frames 28/32/35)
const CTRL_GER = new Set('like love hate enjoy stop start finish avoid mind keep quit prefer begin continue try miss consider suggest practice practise imagine recommend risk deny admit appreciate dislike'.split(' ')); // verbs licensing a gerund (union with WordNet frame 33)
const IRRA = Object.assign(Object.create(null), { better: ['good', 'cmp'], best: ['good', 'sup'], worse: ['bad', 'cmp'], worst: ['bad', 'sup'], farther: ['far', 'cmp'], further: ['far', 'cmp'], farthest: ['far', 'sup'], furthest: ['far', 'sup'] });
/* ADJ_INF (lexicon classes, Chomsky transcripts "the chicken is ready to eat"): an adjective that takes a to-infinitive says, by its own lexical class,
   which kāraka of the infinitive its subject fills. Growth is by adding words here (lexicon), never by a rule per sentence.
   subj = the subject is the kartā (eager to eat); karma = the subject is the gapped karma (hard to eat); both = either (ready to eat → ⧧ held, clarified) */
const ADJ_INF = Object.assign(Object.create(null), { ready: 'both', fit: 'both', hard: 'karma', easy: 'karma', tough: 'karma', difficult: 'karma', impossible: 'karma', simple: 'karma', pleasant: 'karma',
  eager: 'subj', willing: 'subj', keen: 'subj', anxious: 'subj', able: 'subj', unable: 'subj', reluctant: 'subj', glad: 'subj', happy: 'subj', afraid: 'subj', likely: 'subj', unlikely: 'subj' });
const FEMALE = new Set('sister mother mom mum wife daughter aunt grandmother grandma niece girl woman lady girlfriend queen'.split(' '));
const MALE = new Set('brother father dad husband son uncle grandfather grandpa nephew boy man boyfriend king'.split(' '));
const PERSONISH = new Set('person people friend boss partner parent child kid baby colleague neighbor neighbour teacher doctor cousin'.split(' '));
/* ---------- morphology ---------- */
const IRR = 'reset reset reset|have had had|do did done|go went gone|say said said|make made made|get got gotten|know knew known|think thought thought|take took taken|see saw seen|come came come|give gave given|find found found|tell told told|become became become|leave left left|feel felt felt|bring brought brought|begin began begun|keep kept kept|hold held held|write wrote written|stand stood stood|hear heard heard|let let let|mean meant meant|set set set|meet met met|run ran run|pay paid paid|sit sat sat|speak spoke spoken|lead led led|read read read|grow grew grown|lose lost lost|fall fell fallen|send sent sent|build built built|understand understood understood|draw drew drawn|break broke broken|spend spent spent|cut cut cut|rise rose risen|drive drove driven|buy bought bought|wear wore worn|choose chose chosen|eat ate eaten|drink drank drunk|sing sang sung|swim swam swum|fly flew flown|forget forgot forgotten|sleep slept slept|teach taught taught|catch caught caught|fight fought fought|sell sold sold|win won won|ride rode ridden|wake woke woken|throw threw thrown|put put put|hit hit hit|hurt hurt hurt|cost cost cost|shut shut shut|quit quit quit|feed fed fed|shoot shot shot|hang hung hung|dig dug dug|bite bit bitten|hide hid hidden|forgive forgave forgiven|freeze froze frozen|steal stole stolen|beat beat beaten|bend bent bent|lend lent lent|shake shook shaken|sink sank sunk|spread spread spread|stick stuck stuck|strike struck struck|swear swore sworn|tear tore torn|lie lay lain|lay laid laid|bear bore born|blow blew blown|deal dealt dealt|feel felt felt|light lit lit|sweep swept swept|weep wept wept|show showed shown|prove proved proven|ring rang rung|drink drank drunk|seek sought sought|think thought thought|fight fought fought|sing sang sung'.split('|').map(x => x.split(' '));
const IRRV = Object.create(null); const IRRF = Object.create(null); for (const [b, p, pp] of IRR) { IRRV[b] = { past: p, pp }; (IRRF[p] = IRRF[p] || []).push({ lemma: b, f: 'past' }); if (pp !== p) (IRRF[pp] = IRRF[pp] || []).push({ lemma: b, f: 'pp' }); }
const IRRN = Object.assign(Object.create(null), { men: 'man', women: 'woman', children: 'child', people: 'person', feet: 'foot', teeth: 'tooth', mice: 'mouse', geese: 'goose', lives: 'life', wives: 'wife', knives: 'knife', leaves: 'leaf', halves: 'half', wolves: 'wolf', shelves: 'shelf' });
const IRRNP = Object.create(null); for (const [p, s] of Object.entries(IRRN)) IRRNP[s] = p;
const dbl = w => /^[^aeiou]*[aeiou][bdfgklmnprtvz]$/.test(w) && !/[wxy]$/.test(w);
function inflect(lemma, f) {
  if (lemma === 'be') return { pres3: 'is', pres1: 'am', pres: 'are', past: 'was', pastpl: 'were', pp: 'been', ing: 'being', base: 'be' }[f] || lemma;
  if (lemma === 'have' && f === 'pres3') return 'has'; if (lemma === 'do' && f === 'pres3') return 'does'; if (lemma === 'go' && f === 'pres3') return 'goes';
  if (f === 'base' || f === 'pres' || f === 'pres1') return lemma;
  if ((f === 'past' || f === 'pp') && IRRV[lemma]) return IRRV[lemma][f];
  if (f === 'pres3' || f === 'plural') { if (f === 'plural' && IRRNP[lemma]) return IRRNP[lemma]; if (/[^aeiou]y$/.test(lemma)) return lemma.slice(0, -1) + 'ies'; if (/(s|x|z|ch|sh|o)$/.test(lemma)) return lemma + 'es'; return lemma + 's'; }
  if (f === 'past' || f === 'pp') { if (/e$/.test(lemma)) return lemma + 'd'; if (/[^aeiou]y$/.test(lemma)) return lemma.slice(0, -1) + 'ied'; if (dbl(lemma)) return lemma + lemma.slice(-1) + 'ed'; return lemma + 'ed'; }
  if (f === 'ing') { if (/ie$/.test(lemma)) return lemma.slice(0, -2) + 'ying'; if (/[^e]e$/.test(lemma)) return lemma.slice(0, -1) + 'ing'; if (dbl(lemma)) return lemma + lemma.slice(-1) + 'ing'; return lemma + 'ing'; }
  return lemma;
}
/* lemmatize: candidate {lemma,pos,f} accepted only when the lexicon has the lemma with that POS (Doc4: no invented words) */
function lemmatize(w, lex) {
  const out = []; const add = (lemma, pos, f, rule) => { if (lex.hasPos(lemma, pos) && !out.some(o => o.lemma === lemma && o.pos === pos && o.f === f)) out.push({ lemma, pos, f, rule }); };
  for (const pos of ['n', 'v', 'a', 'r']) add(w, pos, pos === 'n' ? 'sg' : pos === 'v' ? 'base' : 'pos', 'M-BASE');
  (IRRF[w] || []).forEach(x => add(x.lemma, 'v', x.f, 'M-IRR-VERB'));
  if (IRRN[w]) add(IRRN[w], 'n', 'pl', 'M-IRR-NOUN'); if (IRRA[w]) add(IRRA[w][0], 'a', IRRA[w][1], 'M-IRR-ADJ-DEGREE');
  const ex = lex.exc(w); if (ex) { add(ex, 'v', 'past', 'M-WN-EXC'); add(ex, 'n', 'pl', 'M-WN-EXC'); add(ex, 'a', 'cmp', 'M-WN-EXC'); }
  const tries = [[/ies$/, 'y', ['n:pl', 'v:pres3']], [/(ss|x|z|ch|sh|o)es$/, '$1', ['n:pl', 'v:pres3']], [/ves$/, 'f', ['n:pl']], [/ves$/, 'fe', ['n:pl']], [/([^s])s$/, '$1', ['n:pl', 'v:pres3']],
    [/ied$/, 'y', ['v:past']], [/([^e])ed$/, '$1', ['v:past']], [/ed$/, 'e', ['v:past']], [/(.)\1ed$/, '$1', ['v:past']], [/([^e])d$/, '$1', ['v:past']],
    [/ying$/, 'ie', ['v:ing']], [/ing$/, '', ['v:ing']], [/ing$/, 'e', ['v:ing']], [/(.)\1ing$/, '$1', ['v:ing']], [/ier$/, 'y', ['a:cmp']], [/er$/, '', ['a:cmp']], [/er$/, 'e', ['a:cmp']], [/(.)\1er$/, '$1', ['a:cmp']], [/iest$/, 'y', ['a:sup']], [/est$/, '', ['a:sup']], [/est$/, 'e', ['a:sup']], [/(.)\1est$/, '$1', ['a:sup']]];
  for (const [re, rep, pf] of tries) if (re.test(w)) { const l = w.replace(re, rep); for (const x of pf) { const [pos, f] = x.split(':'); add(l, pos, f, 'M-SUFFIX-' + f.toUpperCase()); } }
  /* M-ORTHO-VARIANT-APAVADA: a doubled-consonant stem (instal+l+ed) and the plain stem (install+ed) are one word in two spellings; the plain stem wins */
  return out.filter(o => !(o.pos === 'v' && o.f !== 'base' && out.some(p => p !== o && p.pos === 'v' && p.f === o.f && p.lemma === o.lemma + o.lemma.slice(-1))));
}
/* ---------- analysis / tagging ---------- */
function analyse(tok, idx, lex) {
  const w = tok.w, an = []; if (tok.i0 !== undefined) idx = tok.i0; if (tok.rendered && idx === 0) idx = 1; // ECHO-RENDER-CASE: the realizer never capitalises sentence-initial common words, so a capital in rendered text is authoritative
  if (/^\d+(\.\d+)?$/.test(w)) return [{ tag: 'NUM', lemma: w }];
  if (/^".*"$/.test(w)) return [{ tag: 'QUOTE', lemma: tok.orig.slice(1, -1) }];
  if (w === "'s") return [{ tag: 'GEN' }];
  if (/^[,;:]$/.test(w)) return [{ tag: 'PUNCT', lemma: w }];
  const closed = CL[w] || [];
  for (const t of closed) an.push({ tag: t, lemma: w, rule: 'TAG-CLOSED-' + t });
  const ctrl = lex.controlled(w);
  const cap = /^[A-Z]/.test(tok.orig);
  if (closed.length && !['like', 'that', 'no', 'back', 'up', 'out', 'down'].includes(w) && w !== 'her') return an; // TAG-CLOSED-FIRST
  const memName = cap && !closed.length && lex.entityName && lex.entityName(w);
  if (memName === 'name') return [{ tag: 'PROPN', lemma: tok.orig, rule: 'TAG-PROPN-MEMORY-ENTITY' }]; // memory already holds this name (user-confirmed entity)
  const ambigCap = cap && !closed.length && !TIMEW.has(w) && NAMEISH.has(w) && memName !== 'common' && lemmatize(w, lex).some(m => m.pos === 'n');
  if (ambigCap) { for (const m of lemmatize(w, lex)) { const T2 = { n: 'N', v: 'V', a: 'ADJ', r: 'ADV' }[m.pos]; if (idx > 0 && T2 !== 'N') continue; an.push({ tag: T2, lemma: m.lemma, f: m.f, rule: m.rule }); } an.push({ tag: 'PROPN', lemma: tok.orig, rule: 'TAG-CAPITAL-AMBIGUOUS' }); return an; } // name-or-common-noun: both readings kept → clarification
  if (cap && idx > 0 && !closed.length) return [{ tag: 'PROPN', lemma: tok.orig, rule: 'TAG-PROPN-CAPITAL-APAVADA' }]; // specific (capitalised, non-initial) overrides general lexical tagging
  if (cap && idx > 0 && !closed.length && lex.isName(w)) return [{ tag: 'PROPN', lemma: tok.orig, rule: 'TAG-PROPN-CAPITAL-KNOWN' }];
  for (const m of lemmatize(w, lex)) { const T = { n: 'N', v: 'V', a: 'ADJ', r: 'ADV' }[m.pos]; if (T === 'ADV' && closed.includes('ADV')) continue; an.push({ tag: T, lemma: m.lemma, f: m.f, rule: m.rule }); }
  if (cap && idx === 0 && !closed.length && an.length && lex.coreNoun && !lex.coreNoun(w)) an.push({ tag: 'PROPN', lemma: tok.orig, rule: 'TAG-PROPN-INITIAL-ALT' }); // initial capital: name reading kept open unless a core common noun
  if (!an.length && cap) an.push({ tag: 'PROPN', lemma: tok.orig, rule: 'TAG-PROPN-CAPITAL' });
  if (!an.length && ctrl.length) an.push({ tag: 'N', lemma: w, f: 'sg', rule: 'TAG-CONTROLLED-TERM' });
  if (!an.length) an.push({ tag: 'UNK', lemma: w, rule: 'LX-UNKNOWN' });
  return an;
}
function tokenize(text) {
  const raw = String(text).replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
  const parts = raw.match(/"[^"]*"|[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\-]*(?:'(?!s\b)[a-z]+)?|'s\b|\d+(?:\.\d+)?|[?,;:.!]/g) || [];
  const exp = Object.assign(Object.create(null), { "don't": 'do not', "doesn't": 'does not', "didn't": 'did not', "isn't": 'is not', "aren't": 'are not', "wasn't": 'was not', "weren't": 'were not', "won't": 'will not', "can't": 'can not', "cannot": 'can not', "couldn't": 'could not', "wouldn't": 'would not', "shouldn't": 'should not', "i'm": 'i am', "you're": 'you are', "we're": 'we are', "they're": 'they are', "i've": 'i have', "i'll": 'i will', "you'll": 'you will', "he's": 'he is', "she's": 'she is', "it's": 'it is', "what's": 'what is', "who's": 'who is', "where's": 'where is', "that's": 'that is', "let's": 'let us', "haven't": 'have not', "hasn't": 'has not' });
  const toks = [];
  for (const p of parts) { const lw = p.toLowerCase(); if (exp[lw]) { exp[lw].split(' ').forEach((x, i) => toks.push({ w: x, orig: i === 0 && /^[A-Z]/.test(p) ? x[0].toUpperCase() + x.slice(1) : x, contraction: lw })); } else toks.push({ w: lw, orig: p }); }
  toks.forEach((t, i) => { t.i0 = i; });
  for (let i = 1; i < toks.length; i++) if (toks[i].w === "'s" && /^(he|she|it|what|who|where|that|there|here|how)$/.test(toks[i - 1].w)) toks[i] = { w: 'is', orig: 'is', contraction: "'s" }; // M-CONTRACTION-S
  return toks;
}
/* ---------- derivation (recursive descent; every alternative kept) ---------- */
function Parser(toks, lex) {
  const T = toks.map((t, i) => Object.assign({}, t, { an: analyse(t, i, lex) }));
  const at = (i, tag, w) => (i < T.length ? T[i].an.filter(a => a.tag === tag && (!w || (Array.isArray(w) ? w.includes(T[i].w) : T[i].w === w))) : []);
  const word = i => (i < T.length ? T[i].w : null);
  const R = (node, i, rules) => ({ node, i, rules: rules || [] });
  const flat = a => [].concat(...a);
  // ---- NP ----
  function nominal(i) { // ADJ* N+ (compound)
    const res = [];
    (function go(j, adjs, nouns, rules) {
      if (nouns.length) res.push(R({ adjs: adjs.slice(), head: nouns.map(n => n.lemma), plural: nouns[nouns.length - 1].f === 'pl', surface: nouns.map(n => n.w) }, j, rules));
      if (!nouns.length) for (const a of at(j, "ADJ")) go(j + 1, adjs.concat([T[j].w]), nouns, rules.concat([a.rule]));
      for (const n of at(j, 'N')) go(j + 1, adjs, nouns.concat([{ lemma: n.lemma, f: n.f, w: T[j].w }]), rules.concat([n.rule || 'TAG-N']));
    })(i, [], [], []);
    return res;
  }
  function npBase(i) {
    const out = [];
    for (const a of at(i, 'PRON')) { const p = PRON[word(i)]; out.push(R(p.indef ? { indef: word(i), feats: p } : p.p === 1 && p.n === 'sg' ? { pron: 'user' } : p.p === 2 ? { pron: 'kernel' } : { pron3: word(i), feats: p }, i + 1, [p.indef ? 'NP-INDEFINITE-PRON' : 'NP-PRON'])); }
    if (at(i, 'PROPN').length) { let j = i; const ws = []; while (at(j, 'PROPN').length) { ws.push(T[j].orig); j++; } out.push(R({ propn: ws.join(' ') }, j, ['NP-PROPN'])); }
    if (at(i, 'NUM').length && at(i + 1, 'NUM').length) { let j = i; const ns = []; while (at(j, 'NUM').length) { ns.push(word(j)); j++; } out.push(R({ num: ns.join(' ') }, j, ['NP-NUM-SEQUENCE'])); }
    for (const a of at(i, 'NUM')) { out.push(R({ num: a.lemma }, i + 1, ['NP-NUM'])); for (const n of nominal(i + 1)) out.push(R(Object.assign({ num: a.lemma }, n.node), n.i, ['NP-NUM-N'].concat(n.rules))); }
    for (const q of at(i, 'QUOTE')) out.push(R({ quote: q.lemma }, i + 1, ['NP-QUOTE']));
    let quant = null, j = i; if (at(i, 'QUANT').length) { quant = word(i); j = i + 1; }
    const dets = [];
    if (at(j, 'POSS').length) { const w = word(j); dets.push({ owner: w === 'my' ? 'user' : w === 'your' ? 'kernel' : { pron3: w }, j: j + 1, rule: 'NP-POSS' }); }
    if (at(j, 'DET').length) dets.push({ det: word(j), j: j + 1, rule: 'NP-DET' });
    if (!dets.length || quant) dets.push({ j, rule: 'NP-BARE' });
    for (const d of dets) for (const n of nominal(d.j)) { const node = Object.assign({}, n.node); if (d.owner) node.owner = d.owner; if (d.det) node.det = d.det; if (quant) node.quant = quant; out.push(R(node, n.i, [d.rule].concat(quant ? ['LL-QUANT-SCOPE'] : [], n.rules))); }
    return out;
  }
  function npGen(i) { // possessive chain: NP 's nominal
    const res = []; const step = (r) => { res.push(r); if (word(r.i) === "'s") for (const n of nominal(r.i + 1)) step(R(Object.assign({}, n.node, { owner: r.node }), n.i, r.rules.concat(['NP-GENITIVE'], n.rules))); };
    for (const b of npBase(i)) step(b); return res;
  }
  function np(i, noRel) {
    const res = [];
    for (const a of npGen(i)) {
      res.push(a);
      if (word(a.i) === 'of' && !a.node.pron && !a.node.pron3) for (const b of npGen(a.i + 1)) res.push(R(Object.assign({}, a.node, { of: b.node }), b.i, a.rules.concat(['NP-OF'], b.rules)));
    }
    const withRel = [];
    if (!noRel) for (const a of res) if (['who', 'which', 'that'].includes(word(a.i)) && !a.node.pron) for (const v of vp(a.i + 1)) withRel.push(R(Object.assign({}, a.node, { rel: v.node }), v.i, a.rules.concat(['G-REL-SUBJ-GAP'], v.rules)));
    if (!noRel) for (const a of res) if (['who', 'whom', 'which', 'that'].includes(word(a.i)) && !a.node.pron && !a.node.pron3) for (const s2 of np(a.i + 1, true)) for (const v of vp(s2.i)) { const c = v.node; if (!c.verb || c.verb.lemma === 'be' || c.verb.voice || c.verb.nf || (c.roles && (c.roles.karma || c.roles.sampradana))) continue;
      const rc = JSON.parse(JSON.stringify(Object.assign({ subj: s2.node }, c))); delete rc.verb.f;
      if (at(v.i, 'PREP').length && !np(v.i + 1, true).length) withRel.push(R(Object.assign({}, a.node, { relObj: Object.assign(rc, { gap: 'adj', gapPrep: word(v.i) }) }), v.i + 1, a.rules.concat(['G-REL-OBJ-GAP-STRANDED-PREP'], s2.rules, v.rules)));
      else withRel.push(R(Object.assign({}, a.node, { relObj: Object.assign(rc, { gap: 'karma' }) }), v.i, a.rules.concat(['G-REL-OBJ-GAP'], s2.rules, v.rules))); }
    const all = res.concat(withRel);
    const co = []; for (const a of all) { const cw = word(a.i); if (['and', 'or'].includes(cw)) { for (const b of np(a.i + 1, noRel)) if (!b.node.conj) co.push(R({ conj: [a.node, b.node], op: cw, plural: cw === 'and' }, b.i, a.rules.concat(['G-COORD-NP'], b.rules))); }
      else if (cw === ',' && !a.node.conj) for (const b of np(a.i + 1, noRel)) if (b.node.conj && !b.node.listed) co.push(R({ conj: [a.node].concat(b.node.conj), op: b.node.op, plural: b.node.plural }, b.i, a.rules.concat(['G-COORD-NP-LIST'], b.rules))); }
    return all.concat(co);
  }
  // ---- adjuncts: PP / time ----
  const KARAKA = { to: 'sampradana', for: 'sampradana', with: 'karana', by: 'karana', from: 'apadana', in: 'adhikarana', on: 'adhikarana', at: 'adhikarana', near: 'adhikarana', into: 'adhikarana', under: 'adhikarana', over: 'adhikarana', about: 'vishaya', of: 'sambandha', after: 'kala', before: 'kala', during: 'kala', since: 'kala', until: 'kala', without: 'karana', through: 'adhikarana', across: 'adhikarana', around: 'adhikarana', between: 'adhikarana', behind: 'adhikarana', beside: 'adhikarana', onto: 'adhikarana' };
  /* an open-class adverb is a word whose every lexical reading is ADV (no closed-class, noun or adjective reading: "home" stays a noun/adverb ambiguity for the existing rules) */
  const openAdv = j => j < T.length && T[j].an.length > 0 && T[j].an.some(x => x.tag === 'ADV') && T[j].an.every(x => (x.tag === 'ADV' && x.rule !== 'TAG-CLOSED-ADV') || x.rule === 'TAG-PROPN-INITIAL-ALT');
  function adjuncts(i) {
    const res = [];
    (function go(j, list, rules) {
      res.push(R(list, j, rules));
      if (at(j, 'PREP').length && word(j) !== 'of') for (const n of np(j + 1, true)) { const isTime = (n.node.head && n.node.head.length === 1 && TIMEW.has(n.node.head[0])) || (n.node.propn && TIMEW.has(n.node.propn.toLowerCase())) || (n.node.num && !n.node.head); const role = isTime && ['on', 'at', 'in'].includes(word(j)) ? 'kala' : KARAKA[word(j)] || 'adhikarana'; go(n.i, list.concat([{ prep: word(j), np: n.node, role }]), rules.concat(['K-' + role.toUpperCase() + '-' + word(j).toUpperCase()], n.rules)); }
      if (j < T.length && (TIMEW.has(word(j)) && (at(j, 'ADV').length || at(j, 'N').length)) && !list.some(x => x.time === word(j))) go(j + 1, list.concat([{ time: word(j), role: 'kala' }]), rules.concat(['K-KALA-ADV']));
      /* K-PRAKARA-ADV (Doc5 kāraka: manner adjunct): an open-class adverb (lexicon POS r, not closed-class) attaches to the verb of the clause it is parsed in */
      if (j < T.length && openAdv(j) && !list.some(x => x.adv === word(j))) go(j + 1, list.concat([{ adv: word(j), role: 'prakara' }]), rules.concat(['K-PRAKARA-ADV']));
      if (['last', 'next', 'this'].includes(word(j)) && j + 1 < T.length && TIMEW.has(word(j + 1))) go(j + 2, list.concat([{ time: word(j) + ' ' + word(j + 1), role: 'kala' }]), rules.concat(['K-KALA-DEICTIC']));
    })(i, [], []);
    return res;
  }
  // ---- verb group: (MOD|do|will) (not) V | COP (not) | V-ed/V-s ----
  function vgroup(i) {
    const res = []; const w = word(i);
    const neg = j => (at(j, 'NEG').length ? { pol: 'neg', j: j + 1 } : { pol: 'pos', j });
    const pass = (j, base) => at(j, 'V').filter(v => (v.f === 'pp' || v.f === 'past') && inflect(v.lemma, 'pp') === word(j)).map(v => R(Object.assign({ lemma: v.lemma, voice: 'passive', ppAdj: at(j, 'ADJ').length > 0 }, base), j + 1, ['V-PASSIVE']));
    if (at(i, 'COP').length && !['be', 'been', 'being'].includes(w)) { const n = neg(i + 1); const tense = ['was', 'were'].includes(w) ? 'past' : 'present'; res.push(...pass(n.j, { tense, pol: n.pol, mod: 'asserted', form: w }).map(r => (n.pol === 'neg' ? Object.assign(r, { rules: r.rules.concat(['LL-NEG-PRED']) }) : r))); }
    if (at(i, 'COP').length) { const n = neg(i + 1); const tense = ['was', 'were'].includes(w) ? 'past' : 'present'; res.push(R({ cop: true, tense, pol: n.pol, mod: 'asserted', form: w }, n.j, ['V-COP-' + tense.toUpperCase()].concat(n.pol === 'neg' ? ['LL-NEG-PRED'] : [])));
      for (const v of at(n.j, 'V')) if (v.f === 'ing') res.push(R({ lemma: v.lemma, tense, aspect: 'progressive', pol: n.pol, mod: 'asserted' }, n.j + 1, ['V-PROGRESSIVE'].concat(n.pol === 'neg' ? ['LL-NEG-PRED'] : []))); }
    if (at(i, 'AUX').length && ['do', 'does', 'did'].includes(w)) { const n = neg(i + 1); for (const v of at(n.j, 'V')) if (v.f === 'base') res.push(R({ lemma: v.lemma, tense: w === 'did' ? 'past' : 'present', pol: n.pol, mod: 'asserted', dosupport: true }, n.j + 1, ['V-DO-SUPPORT'].concat(n.pol === 'neg' ? ['LL-NEG-PRED'] : []))); }
    if (at(i, 'AUX').length && ['have', 'has', 'had'].includes(w)) { const n = neg(i + 1); for (const v of at(n.j, 'V')) if (v.f === 'pp' || v.f === 'past') res.push(R({ lemma: v.lemma, tense: 'past', aspect: 'perfect', pol: n.pol, mod: 'asserted' }, n.j + 1, ['V-PERFECT'])); }
    /* possessive main verb “have” (Doc5 frame: possessor karta, possessed karma) — utsarga; the perfect auxiliary above is the apavāda when a participle follows */
    if (['have', 'has', 'had'].includes(w) && !at(i + 1, 'V').some(v => v.f === 'pp' || v.f === 'past')) res.push(R({ lemma: 'have', tense: w === 'had' ? 'past' : 'present', f: w === 'has' ? 'pres3' : w === 'had' ? 'past' : 'base', pol: 'pos', mod: 'asserted' }, i + 1, ['V-FINITE-HAVE-POSSESSIVE']));
    if (at(i, 'AUX').length && ['do', 'does', 'did'].includes(w)) { const n = neg(i + 1); if (word(n.j) === 'have') res.push(R({ lemma: 'have', tense: w === 'did' ? 'past' : 'present', pol: n.pol, mod: 'asserted', dosupport: true }, n.j + 1, ['V-DO-SUPPORT', 'V-HAVE-POSSESSIVE'].concat(n.pol === 'neg' ? ['LL-NEG-PRED'] : []))); }
    if (at(i, 'MOD').length) { const mod = { will: 'future', shall: 'future', would: 'conditional', might: 'possible', may: 'possible', could: 'possible', can: 'able', must: 'necessary', should: 'obligation' }[w]; const n = neg(i + 1);
      const fill = (tense, m) => ({ tense, mod: m, pol: n.pol });
      const f = mod === 'future' ? fill('future', 'asserted') : fill('present', mod);
      if (word(n.j) === 'be') res.push(...pass(n.j + 1, f).map(r => Object.assign(r, { rules: ['V-MODAL-' + mod.toUpperCase(), 'LL-MOD-VERB'].concat(r.rules) })));
      if (word(n.j) === 'be') { res.push(R(Object.assign({ cop: true, form: 'be' }, f), n.j + 1, ['V-MODAL-' + mod.toUpperCase(), 'LL-MOD-VERB'].concat(n.pol === 'neg' ? ['LL-NEG-PRED'] : []))); }
      for (const v of at(n.j, 'V')) if (v.f === 'base') res.push(R(Object.assign({ lemma: v.lemma }, f), n.j + 1, ['V-MODAL-' + mod.toUpperCase(), 'LL-MOD-VERB'].concat(n.pol === 'neg' ? ['LL-NEG-PRED'] : []))); }
    for (const v of at(i, 'V')) { if (['pres3', 'past', 'base'].includes(v.f)) res.push(R({ lemma: v.lemma, tense: v.f === 'past' ? 'past' : 'present', f: v.f, pol: 'pos', mod: 'asserted' }, i + 1, ['V-FINITE-' + v.f.toUpperCase(), v.rule])); }
    return res;
  }
  // ---- VP ----
  const licenses = (lemma, kind) => { const fr = lex.vframes ? lex.vframes(lemma) : []; return kind === 'inf' ? CTRL_INF.has(lemma) || fr.some(f => /to INFINITIVE$|----s INFINITIVE$/.test(f)) : CTRL_GER.has(lemma) || fr.some(f => /VERB-ing$/.test(f)); };
  function vpNF(j, form) { // non-finite VP (infinitive after "to", or gerund): no subject, no tense
    const gs = []; const nfw = form === 'base' ? 'inf' : 'ger';
    if (form === 'base' && word(j) === 'be') gs.push(R({ cop: true, tense: 'none', pol: 'pos', mod: 'asserted', nf: nfw }, j + 1, ['V-NONFINITE-INF']));
    if (form === 'ing' && word(j) === 'being') gs.push(R({ cop: true, tense: 'none', pol: 'pos', mod: 'asserted', nf: nfw }, j + 1, ['V-NONFINITE-GER']));
    for (const v of at(j, 'V')) if (v.f === form && v.lemma !== 'be') gs.push(R({ lemma: v.lemma, tense: 'none', pol: 'pos', mod: 'asserted', nf: nfw }, j + 1, ['V-NONFINITE-' + (nfw === 'inf' ? 'INF' : 'GER')]));
    return vp(j, gs); }
  function vp(i, groups) {
    const res = [];
    for (const g of groups || vgroup(i)) {
      const v = g.node; const nf = v.nf ? { nf: v.nf } : {};
      if (v.cop) {
        const preds = [];
        const adjs = []; (function go(j, ws, rules) { for (const a of at(j, 'ADJ')) { if (a.f === 'cmp' || a.f === 'sup') continue; const ws2 = ws.concat([a.lemma === T[j].w ? a.lemma : T[j].w]); preds.push(R({ type: 'adj', words: ws2 }, j + 1, rules.concat(['P-ADJ']))); if (['and', 'or'].includes(word(j + 1))) go(j + 2, ws2.concat([word(j + 1)]), rules.concat(['G-COORD-ADJ'])); } })(g.i, [], []);
        // comparatives: ADJ-er than NP | more/less ADJ than NP ; superlatives: the ADJ-est | the most ADJ
        if (/^\d+(\.\d+)?$/.test(word(g.i)) && /^(years?|months?|weeks?|days?|metres?|meters?|feet|foot|inches?|centimetres?|centimeters?|cm|km|kilometres?|kilometers?|miles?|kg|kilograms?|pounds?)$/.test(word(g.i + 1)) && /^(old|tall|long|wide|high|deep|heavy|away|far)$/.test(word(g.i + 2))) preds.push(R({ type: 'adj', words: [word(g.i), word(g.i + 1), word(g.i + 2)], measure: true }, g.i + 3, ['P-MEASURE-ADJ']));
        for (const a of at(g.i, 'ADJ')) if (a.f === 'cmp' && word(g.i + 1) === 'than') for (const n of np(g.i + 2, true)) preds.push(R({ type: 'cmp', adj: a.lemma, degree: 'more', surface: [T[g.i].w], than: n.node }, n.i, ['P-COMPARATIVE-SYNTHETIC'].concat(n.rules)));
        if (['more', 'less'].includes(word(g.i))) for (const a of at(g.i + 1, 'ADJ')) if (a.f === 'pos' && word(g.i + 2) === 'than') for (const n of np(g.i + 3, true)) preds.push(R({ type: 'cmp', adj: a.lemma, degree: word(g.i), surface: [word(g.i), T[g.i + 1].w], than: n.node }, n.i, ['P-COMPARATIVE-PERIPHRASTIC'].concat(n.rules)));
        if (word(g.i) === 'the') { for (const a of at(g.i + 1, 'ADJ')) if (a.f === 'sup') preds.push(R({ type: 'sup', adj: a.lemma, degree: 'most', surface: [T[g.i + 1].w] }, g.i + 2, ['P-SUPERLATIVE-SYNTHETIC']));
          if (['most', 'least'].includes(word(g.i + 1))) for (const a of at(g.i + 2, 'ADJ')) if (a.f === 'pos') preds.push(R({ type: 'sup', adj: a.lemma, degree: word(g.i + 1) === 'most' ? 'most' : 'least', surface: [word(g.i + 1), T[g.i + 2].w] }, g.i + 3, ['P-SUPERLATIVE-PERIPHRASTIC'])); }
        /* P-ADJ-INFINITIVE: ADJ to V… — the lexical class decides the reading(s); a karma reading needs the infinitive's own karma slot empty (the gap);
           "to be V-en" (passive infinitive) gives only the karma reading */
        for (const a of at(g.i, 'ADJ')) { const cls = ADJ_INF[a.lemma]; if (!cls || a.f !== 'pos' || word(g.i + 1) !== 'to') continue;
          if (word(g.i + 2) === 'be') for (const pv of at(g.i + 3, 'V')) { if (!((pv.f === 'pp' || pv.f === 'past') && inflect(pv.lemma, 'pp') === word(g.i + 3)) || cls === 'subj') continue; preds.push(R({ type: 'adjinf', words: [T[g.i].w], inf: { verb: { lemma: pv.lemma, tense: 'none', pol: 'pos', mod: 'asserted', nf: 'inf', voice: 'passive' }, roles: {}, adj: [] }, ctrl: 'karma' }, g.i + 4, ['P-ADJ-INFINITIVE', 'K-KARMA-PASSIVE-INFINITIVE'])); }
          for (const c of vpNF(g.i + 2, 'base')) { const cv = c.node; if (!cv.verb || cv.verb.lemma === 'be') continue; const hasK = !!(cv.roles && (cv.roles.karma || cv.roles.sampradana));
            if (cls !== 'karma') preds.push(R({ type: 'adjinf', words: [T[g.i].w], inf: cv, ctrl: 'karta' }, c.i, ['P-ADJ-INFINITIVE', 'K-KARTA-CONTROL'].concat(c.rules)));
            if (cls !== 'subj' && !hasK && (!lex.vframes || (lex.vframes(cv.verb.lemma) || []).some(f => /somebody|something/.test(f) && !/^Something ----s$|^Somebody ----s$/.test(f)) || !(lex.vframes(cv.verb.lemma) || []).length)) preds.push(R({ type: 'adjinf', words: [T[g.i].w], inf: cv, ctrl: 'karma' }, c.i, ['P-ADJ-INFINITIVE', 'K-KARMA-GAP'].concat(c.rules))); } }
        for (const n of np(g.i)) preds.push(R({ type: 'np', np: n.node }, n.i, ['P-NP'].concat(n.rules)));
        if (['here', 'there'].includes(word(g.i)) && !v.nf) preds.push(R({ type: 'adv', words: [word(g.i)] }, g.i + 1, ['P-DEIXIS-LOCUS'])); /* "was here": deictic locus predicate */
        if (at(g.i, 'PREP').length) for (const n of np(g.i + 1, true)) preds.push(R({ type: 'pp', prep: word(g.i), np: n.node }, n.i, ['P-PP'].concat(n.rules)));
        const ingHere = at(g.i, 'V').some(x => x.f === 'ing');
        const passHere = !v.nf && at(g.i, 'V').some(x => (x.f === 'pp' || x.f === 'past') && inflect(x.lemma, 'pp') === word(g.i)) && word(g.i + 1) === 'by';
        const passPartHere = !v.nf && at(g.i, 'V').some(x => (x.f === 'pp' || x.f === 'past') && inflect(x.lemma, 'pp') === word(g.i)) && at(g.i + 1, 'PART').length > 0;
        for (const p of preds) { if (ingHere && p.node.type !== 'pp') continue; /* V-PROGRESSIVE-APAVADA */
          if (passPartHere && p.node.type !== 'pp') continue; /* V-PASSIVE-PARTICLE-APAVADA: participle + particle is a phrasal passive, not an adjective phrase */
          for (const a of adjuncts(p.i)) { if (p.node.type === 'adj' && p.i === g.i + 1 && a.node.length && a.node[0].prep === 'to' && preds.some(x => x.node.type === 'adjinf')) continue; /* P-ADJ-INFINITIVE-APAVADA: "easy to cook" is an infinitive complement, not a to-PP */
            if (passHere && p.i === g.i + 1 && (p.node.type === 'adj' || p.node.type === 'np') && a.node.some(x => x.prep === 'by')) continue; /* V-PASSIVE-AGENT-APAVADA: participle + by-agent is passive */
            res.push(R({ verb: Object.assign({ lemma: 'be', tense: v.tense, pol: v.pol, mod: v.mod }, nf), pred: p.node, adj: a.node }, a.i, g.rules.concat(p.rules, a.rules))); } }
        continue;
      }
      if (v.voice === 'passive') { // kartā is the by-phrase (if any); the surface subject is the karma (Doc5)
        /* V-PASSIVE-PARTICLE (Doc5 kāraka; Pāṇini paper L2736–2751): a phrasal verb keeps its particle in the passive ("was rolled back"); a particle that is
           also a preposition is read as the particle only at clause end; an adjective takes no particle, so the stative apavāda yields to it */
        let pj = g.i, ppart = null; if (at(pj, 'PART').length && (!at(pj, 'PREP').length || pj + 1 >= T.length || word(pj + 1) === ',')) { ppart = word(pj); pj++; }
        for (const a of adjuncts(pj)) { const by = a.node.findIndex(x => x.prep === 'by'); if (by < 0 && v.ppAdj && !ppart) continue; /* P-ADJ-PARTICIPLE-APAVADA: stative adjective reading wins without an agent */
          const roles = by >= 0 ? { karta: a.node[by].np } : {}; const adj = a.node.filter((x, k) => k !== by);
          res.push(R({ verb: Object.assign({ lemma: v.lemma, tense: v.tense, pol: v.pol, mod: v.mod, voice: 'passive' }, ppart ? { particle: ppart } : {}, v.form ? { form: v.form } : {}), roles, adj }, a.i, g.rules.concat(ppart ? ['V-PASSIVE-PARTICLE'] : [], a.rules, by >= 0 ? ['K-KARTA-PASSIVE-AGENT'] : ['K-KARTA-PASSIVE-IMPLICIT']))); }
        continue; }
      const objs = [R({}, g.i, [])];
      const gerOK = licenses(v.lemma, 'ger') && at(g.i, 'V').some(x => x.f === 'ing'); const infOK = licenses(v.lemma, 'inf') && word(g.i) === 'to' && (at(g.i + 1, 'V').some(x => x.f === 'base') || word(g.i + 1) === 'be');
      for (const o of np(g.i, true)) { if (gerOK && o.node.surface && /ing$/.test(o.node.surface[0])) continue; /* K-GERUND-APAVADA */ objs.push(R({ karma: o.node }, o.i, ['K-KARMA'].concat(o.rules))); for (const o2 of np(o.i, true)) objs.push(R({ sampradana: o.node, karma: o2.node }, o2.i, ['K-SAMPRADANA-DOUBLE-OBJECT', 'K-KARMA'].concat(o.rules, o2.rules))); }
      if (['that'].includes(word(g.i)) || ['know', 'think', 'say', 'believe', 'hope', 'remember', 'tell'].includes(v.lemma)) for (const c of clause(word(g.i) === 'that' ? g.i + 1 : g.i)) objs.push(R({ karma: { clause: c.node } }, c.i, ['K-KARMA-CLAUSE'].concat(c.rules)));
      /* K-SAMPRADANA-CLAUSE: a saying verb takes an addressee and a that-clause ("I told you that …") */
      if (['tell', 'inform', 'remind', 'promise', 'show', 'teach', 'warn'].includes(v.lemma)) for (const o of np(g.i, true)) if (word(o.i) === 'that') for (const c of clause(o.i + 1)) objs.push(R({ sampradana: o.node, karma: { clause: c.node } }, c.i, ['K-SAMPRADANA-CLAUSE'].concat(o.rules, c.rules)));
      if (infOK) for (const c of vpNF(g.i + 1, 'base')) objs.push(R({ karma: { inf: c.node } }, c.i, ['K-KARMA-INFINITIVE'].concat(c.rules)));
      if (gerOK) for (const c of vpNF(g.i, 'ing')) objs.push(R({ karma: { ger: c.node } }, c.i, ['K-KARMA-GERUND'].concat(c.rules)));
      if (word(g.i) === ',' && at(g.i + 1, 'QUOTE').length) objs.push(R({ karma: { quote: at(g.i + 1, 'QUOTE')[0].lemma } }, g.i + 2, ['K-KARMA-QUOTE-DIRECT-SPEECH']));
      /* V-PARTICLE-PREPOSED (Doc5 kāraka; particle verbs): "picked up the box" — the particle stands before the karma; same verb+particle as "picked the box up" */
      if (at(g.i, 'PART').length && !at(g.i, 'PREP').length) for (const o of np(g.i + 1, true)) objs.push(Object.assign(R({ karma: o.node }, o.i, ['V-PARTICLE-PREPOSED', 'K-KARMA'].concat(o.rules)), { part: word(g.i) }));
      for (const o of objs) {
        let j = o.i, part = o.part || null; if (!part && at(j, 'PART').length) { part = word(j); j++; }
        for (const a of adjuncts(j)) { if (o.node.karma && o.node.karma.clause && a.node.length) continue; /* K-CLAUSE-LATE-CLOSURE: material after a that-complement closes inside the lowest clause (structural, not a choice) */
          if (infOK && !o.node.karma && a.node[0] && a.node[0].prep === 'to' && j === g.i) continue; /* K-INFINITIVE-APAVADA: licensed "to V" is a complement, not a PP */
          res.push(R({ verb: Object.assign({ lemma: v.lemma, tense: v.tense, pol: v.pol, mod: v.mod }, v.aspect ? { aspect: v.aspect } : {}, part ? { particle: part } : {}, v.f ? { f: v.f } : {}, nf), roles: o.node, adj: a.node }, a.i, g.rules.concat(o.rules, a.rules))); }
      }
    }
    return res;
  }
  /* G-DISPLACE (one displacement mechanism; Chomsky: copy + delete; Pāṇini paper D3 topic/scope): an XP pronounced at the left edge before a comma
     (open-class adverb or PP) is a copy of an adjunct of the clause that follows. The copy is interpreted in the ROOT clause it fronts — the hierarchically
     highest verb — never inside a relative or other embedded clause and never by linear position (structure dependence: "Instinctively, eagles that
     fly swim" → instinctively modifies swim, not fly). Meaning is identical to the unfronted clause (front is non-material). */
  function fronted(i) { const out = [];
    if (openAdv(i) && word(i + 1) === ',') out.push({ xp: [{ adv: word(i), role: 'prakara' }], j: i + 2, rules: ['K-PRAKARA-ADV'] });
    if (at(i, 'PREP').length && word(i) !== 'of') for (const a of adjuncts(i)) if (a.node.length === 1 && a.node[0].prep && word(a.i) === ',') out.push({ xp: a.node, j: a.i + 1, rules: a.rules });
    /* "As for NP," — the topic is the same displacement: its copy is the agreeing pronoun of the clause (bound below); with no agreeing pronoun there is no copy and no reading */
    if (word(i) === 'as' && word(i + 1) === 'for') for (const n of np(i + 2, true)) if (word(n.i) === ',' && !n.node.pron && !n.node.pron3) out.push({ topic: n.node, j: n.i + 1, rules: ['G-DISPLACE-TOPIC'].concat(n.rules) });
    return out; }
  const topicFeats = n => (n.conj || n.plural ? { n: 'pl' } : n.head && n.head.some(h => FEMALE.has(h)) ? { n: 'sg', g: 'f' } : n.head && n.head.some(h => MALE.has(h)) ? { n: 'sg', g: 'm' } : n.propn || (n.head && n.head.some(h => PERSONISH.has(h))) ? { n: 'sg', g: 'u' } : { n: 'sg', g: 'n' });
  const agreesPron = (p, f) => { const q = PRON[p]; if (!q || q.indef || q.p !== 3) return false; if (f.n === 'pl') return q.n === 'pl'; if (q.n !== 'sg') return false; return f.g === 'u' ? q.g === 'f' || q.g === 'm' : q.g === f.g; };
  function bindTopic(c, t) { const f = topicFeats(t); let done = false; const cp = JSON.parse(JSON.stringify(c));
    const visit = (o, k) => { if (done || !o || typeof o !== 'object') return; const v = o[k]; if (v && typeof v === 'object') { if (v.pron3 && agreesPron(v.pron3, f) && Object.keys(v).every(x => x === 'pron3' || x === 'feats')) { o[k] = JSON.parse(JSON.stringify(t)); done = true; return; } for (const kk of Object.keys(v)) visit(v, kk); } };
    for (const k of Object.keys(cp)) visit(cp, k); return done ? cp : null; }
  function clause(i, noFront) { // NP VP  (kartā = subject)
    const res = [];
    if (!noFront) for (const f of fronted(i)) if (f.topic) { for (const c of clause(f.j, true)) { const b2 = !c.node.coord && bindTopic(c.node, f.topic); if (b2) res.push(R(b2, c.i, f.rules.concat(c.rules))); } }
    else for (const c of clause(f.j, true)) if (!c.node.coord) res.push(R(Object.assign({}, c.node, { adj: (c.node.adj || []).concat(f.xp.map(x => Object.assign({}, x, { front: true }))) }), c.i, ['G-DISPLACE-FRONT'].concat(f.rules, c.rules)));
    const sg3 = n => !n.pron && !n.conj && !n.plural && !(n.pron3 && ['they', 'we', 'them', 'us'].includes(n.pron3));
    for (const s of np(i)) for (const v of vp(s.i)) {
      const f = v.node.verb && v.node.verb.f; if ((f === 'base' && sg3(s.node)) || (f === 'pres3' && !sg3(s.node))) continue; // LL-AGREEMENT (subject–verb concord)
      const times = (v.node.adj || []).filter(a => a.time).map(a => a.time).join(' '); const tn = v.node.verb && v.node.verb.tense;
      if (tn && ((/\b(yesterday|last)\b/.test(times) && tn !== 'past') || (/\b(tomorrow|next)\b/.test(times) && tn === 'past'))) continue; // LL-TENSE-KALA-CONCORD
      const c = Object.assign({ subj: s.node }, v.node); res.push(R(c, v.i, s.rules.concat(['K-KARTA'], v.rules, f ? ['LL-AGREEMENT'] : [], times ? ['LL-TENSE-KALA-CONCORD'] : [])));
    }
    return res;
  }
  function sentence() { // full derivations over whole token list (punctuation stripped)
    const out = [];
    const full = r => r.i === T.length;
    const conds = (i) => { const res = []; if (at(i, 'IF').length) for (const c of clause(i + 1)) { let j = c.i; if (word(j) === ',') j++; if (word(j) === 'then') j++; for (const m of clause(j)) res.push(R(Object.assign({}, m.node, { cond: c.node }), m.i, ['LL-COND-SCOPE'].concat(c.rules, m.rules))); } return res; };
    for (const c of conds(0)) if (full(c)) out.push(R({ type: 'decl', clause: c.node }, c.i, c.rules));
    if (SUBW.has(word(0))) for (const k of clause(1)) { let j = k.i; if (word(j) === ',') j++; else continue; for (const m of clause(j)) if (full(m)) out.push(R({ type: 'decl', clause: Object.assign({}, m.node, { sub: { conj: word(0), clause: k.node, pre: true } }) }, m.i, ['G-SUBORD-PREPOSED-' + word(0).toUpperCase()].concat(k.rules, m.rules))); }
    for (const c of clause(0)) {
      if (full(c)) out.push(R({ type: 'decl', clause: c.node }, c.i, c.rules));
      if (at(c.i, 'IF').length) for (const k of clause(c.i + 1)) if (full(k)) out.push(R({ type: 'decl', clause: Object.assign({}, c.node, { cond: k.node }) }, k.i, ['LL-COND-SCOPE-POSTPOSED'].concat(c.rules, k.rules)));
      let j = c.i; if (word(j) === ',') j++;
      if (SUBW.has(word(j)) && !c.node.cond) for (const k of clause(j + 1)) if (full(k)) out.push(R({ type: 'decl', clause: Object.assign({}, c.node, { sub: { conj: word(j), clause: k.node } }) }, k.i, ['G-SUBORD-POSTPOSED-' + word(j).toUpperCase()].concat(c.rules, k.rules)));
      if (['and', 'but'].includes(word(j))) for (const d of clause(j + 1)) if (full(d)) out.push(R({ type: 'decl', clause: { coord: [c.node, d.node], op: 'and' } }, d.i, ['G-COORD-CLAUSE'].concat(c.rules, d.rules)));
    }
    return out;
  }
  return { T, np, vp, vpNF, clause, sentence, adjuncts, at, word };
}
/* ---------- generation (inverse) ---------- */
function npText(n, persp) {
  if (!n) return '';
  if (n.conj) { const parts = n.conj.map(x => npText(x, persp)); return parts.length > 2 ? parts.slice(0, -1).join(', ') + ' ' + n.op + ' ' + parts[parts.length - 1] : parts.join(' ' + n.op + ' '); }
  if (n.pron === 'user') return persp === 'user' ? 'I' : 'you'; if (n.pron === 'kernel') return persp === 'user' ? 'you' : 'I';
  if (n.pron3) return n.pron3; if (n.indef) return n.indef; if (n.propn) return n.propn; if (n.quote !== undefined) return '"' + n.quote + '"';
  let s = '';
  if (n.quant) s += n.quant + ' ';
  if (n.owner === 'user') s += persp === 'user' ? 'my ' : 'your '; else if (n.owner === 'kernel') s += persp === 'user' ? 'your ' : 'my '; else if (n.owner && n.owner.pron3) s += n.owner.pron3 + ' '; else if (n.owner) s += npText(n.owner, persp) + "'s ";
  if (n.det) s += n.det + ' ';
  if (n.num) s += n.num + (n.head ? ' ' : '');
  if (n.adjs && n.adjs.length) s += n.adjs.join(' ') + ' ';
  if (n.head) s += (n.surface || n.head).join(' ');
  if (n.of) s += ' of ' + npText(n.of, persp);
  if (n.rel) s += (n.propn || (n.head && n.head.some(h => FEMALE.has(h) || MALE.has(h) || PERSONISH.has(h))) ? ' who ' : ' that ') + vpText(n.rel, n, persp);
  if (n.relObj) s += ' that ' + clauseText(n.relObj, persp) + (n.relObj.gapPrep ? ' ' + n.relObj.gapPrep : '');
  return s.trim();
}
function agree(subj) { if (!subj) return 'pres3'; if (subj.pron === 'user') return 'pres1'; if (subj.pron === 'kernel') return 'pres'; if (subj.conj && subj.op === 'and') return 'pres'; if (subj.pron3) return ['they', 'we'].includes(subj.pron3) ? 'pres' : 'pres3'; if (subj.plural) return 'pres'; return 'pres3'; }
function nfText(c, persp) { // non-finite VP: "to buy a car" / "reading books"
  const v = c.verb; const head = v.lemma === 'be' ? (v.nf === 'inf' ? 'to be ' : 'being ') + predText(c.pred, persp) : (v.nf === 'inf' ? 'to ' + v.lemma : inflect(v.lemma, 'ing')) + (v.particle ? ' ' + v.particle : '');
  return head + rolesText(c.roles || {}, persp) + adjText(c, persp); }
function rolesText(r, persp) { if (r.sampradana && r.karma) return ' ' + objText(r.sampradana, persp) + ' ' + objText(r.karma, persp); if (r.karma) return ' ' + objText(r.karma, persp); return ''; }
function adjText(c, persp) { let s = ''; for (const a of c.adj || []) s += a.adv ? ' ' + a.adv : a.time ? ' ' + a.time : ' ' + a.prep + ' ' + (a.np.pron ? objText(a.np, persp) : npText(a.np, persp)); return s; }
const PAST_IS_OTHER_LEMMA = new Set(['saw', 'found', 'wound', 'ground', 'felt', 'fell', 'lay', 'bound', 'rent', 'flew']);
function vpText(c, subj, persp) {
  const v = c.verb; const ag = agree(subj); const persUser = subj && subj.pron === 'user'; let vs;
  const neg = v.pol === 'neg';
  const MODW = { possible: 'might', able: 'can', necessary: 'must', obligation: 'should', conditional: 'would' };
  if (v.nf) return nfText(c, persp);
  if (v.voice === 'passive') { let be; if (v.tense === 'future') be = 'will' + (neg ? ' not' : '') + ' be'; else if (v.mod && v.mod !== 'asserted') be = MODW[v.mod] + (neg ? ' not' : '') + ' be';
    else { if (v.tense === 'past') be = (ag === 'pres' || (ag === 'pres1' && persp === 'kernel')) ? 'were' : 'was'; else be = ag === 'pres3' ? 'is' : ag === 'pres1' ? (persp === 'user' ? 'am' : 'are') : 'are'; if (persUser && persp === 'kernel') be = v.tense === 'past' ? 'were' : 'are'; if (neg) be += ' not'; }
    return be + ' ' + inflect(v.lemma, 'pp') + (v.particle ? ' ' + v.particle : '') + (c.roles && c.roles.karta ? ' by ' + objText(c.roles.karta, persp) : '') + adjText(c, persp); }
  if (v.lemma === 'be') {
    let cop; if (v.tense === 'future') cop = 'will' + (neg ? ' not' : '') + ' be'; else if (v.mod !== 'asserted') cop = MODW[v.mod] + (neg ? ' not' : '') + ' be';
    else { if (v.tense === 'past') cop = (ag === 'pres' || (ag === 'pres1' && persp === 'kernel')) ? 'were' : 'was'; else cop = ag === 'pres3' ? 'is' : ag === 'pres1' ? (persp === 'user' ? 'am' : 'are') : 'are'; if (persUser && persp === 'kernel') cop = v.tense === 'past' ? 'were' : 'are'; if (neg) cop += ' not'; }
    vs = cop + ' ' + predText(c.pred, persp);
  } else {
    const base = v.lemma; const part = v.particle ? ' ' + v.particle : '';
    if (v.tense === 'future') vs = 'will' + (neg ? ' not ' : ' ') + base;
    else if (v.mod && v.mod !== 'asserted') vs = MODW[v.mod] + (neg ? ' not ' : ' ') + base;
    else if (v.aspect === 'progressive') { const be = v.tense === 'past' ? (ag === 'pres3' || (ag === 'pres1' && persp === 'user') ? 'was' : 'were') : (ag === 'pres3' ? 'is' : ag === 'pres1' && persp === 'user' ? 'am' : 'are'); vs = be + (neg ? ' not ' : ' ') + inflect(base, 'ing'); }
    else if (v.aspect === 'perfect') vs = (ag === 'pres3' ? 'has' : 'have') + (neg ? ' not ' : ' ') + inflect(base, 'pp');
    else if (neg) vs = (v.tense === 'past' ? 'did' : ag === 'pres3' ? 'does' : 'do') + ' not ' + base;
    else if (v.tense === 'past' && ag !== 'pres3' && !c.resolved_reading && PAST_IS_OTHER_LEMMA.has(inflect(base, 'past')) && !(c.adj || []).some(a => a.role === 'kala')) vs = 'did ' + base; /* v4.9.36: a 3sg subject already rules out the homograph (she saws ≠ she saw); a reading the user chose keeps its own surface (Echo masks it) */ // GEN-PAST-HOMOGRAPH-DO: past form is itself another verb lemma in WordNet (saw, found, felt…) → do-support keeps the realization single-derivation (Echo)
    else if (!c.resolved_reading && !(c.adj || []).some(a => a.role === 'kala') && inflect(base, 'past') === (ag === 'pres3' ? inflect(base, 'pres3') : base)) vs = (v.tense === 'past' ? 'did' : ag === 'pres3' ? 'does' : 'do') + ' ' + base; // GEN-TENSE-DISAMBIG-DO: past ≡ present surface (read, put, cut…) → emphatic do-support so the realization re-derives to exactly one tense (Echo)
    else vs = v.tense === 'past' ? inflect(base, 'past') : ag === 'pres3' ? inflect(base, 'pres3') : base;
    vs += part;
    vs += rolesText(c.roles || {}, persp);
  }
  return vs + adjText(c, persp);
}
function objText(o, persp) { if (o.clause) return 'that ' + clauseText(o.clause, persp); if (o.inf || o.ger) return nfText(o.inf || o.ger, persp); if (o.quote !== undefined && o.direct) return ', "' + o.quote + '"'; const t = npText(o, persp); return o.pron === 'user' ? (persp === 'user' ? 'me' : 'you') : o.pron === 'kernel' ? (persp === 'user' ? 'you' : 'me') : t; }
function predText(p, persp) { if (p.type === 'adj' || p.type === 'adv') return p.words.join(' '); if (p.type === 'adjinf') return p.words.join(' ') + ' ' + (p.inf.verb.voice === 'passive' ? 'to be ' + inflect(p.inf.verb.lemma, 'pp') + adjText(p.inf, persp) : nfText(p.inf, persp)); if (p.type === 'cmp') return (p.surface || [p.degree === 'less' ? 'less' : 'more', p.adj]).join(' ') + ' than ' + objText(p.than, persp); if (p.type === 'sup') return 'the ' + (p.surface || [p.degree, p.adj]).join(' '); if (p.type === 'np') return npText(p.np, persp); return p.prep + ' ' + npText(p.np, persp); }
function clauseText(c, persp) {
  if (c.coord) return c.coord.map(x => clauseText(x, persp)).join(', and ');
  const s = npText(c.subj, persp); let body = s + ' ' + vpText(c, c.subj, persp);
  if (c.sub) body = c.sub.pre ? c.sub.conj + ' ' + clauseText(c.sub.clause, persp) + ', ' + body : body + ' ' + c.sub.conj + ' ' + clauseText(c.sub.clause, persp);
  return c.cond ? 'if ' + clauseText(c.cond, persp) + ', ' + body : body;
}
/* canonical material meaning (for Echo comparison) */
function material(x) { return JSON.parse(JSON.stringify(x, (k, v) => (['rules', 'surface', 'f', 'form', 'dosupport', 'sense', 'resolvedFrom', 'plural', 'resolved_reading', 'front'].includes(k) ? undefined : v))); }
const api = { ADJ_INF, IRRV, IRRF, IRRNP, IRRN, dbl, CLOSED, CL, PRON, TIMEW, FEMALE, MALE, PERSONISH, NAMEISH, SUBW, CTRL_INF, CTRL_GER, tokenize, analyse, lemmatize, inflect, Parser, npText, clauseText, vpText, material };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KGrammar = api;
})(this);
