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
  NEG: 'not never', SUB: 'because while although whereas', THAN: 'than', PREP: 'as in on at to from with by for of about regarding concerning into onto under over after before during near without through across around between behind beside since until past per within throughout despite via toward towards upon beyond against along among amid inside outside below above beneath underneath versus',
  CONJ: 'and or but', IF: 'if unless', THEN: 'then', REL: 'who which that', COMP: 'that', PART: 'up down out off away back',
  ADV: 'also too very really now today tonight tomorrow yesterday here there always often sometimes usually never already still soon later again maybe perhaps probably possibly definitely certainly',
  PLEASE: 'please', INTJ: 'hello hi hey howdy yes no ok okay thanks cheers goodbye bye',
};
const CL = Object.create(null); for (const [t, ws] of Object.entries(CLOSED)) for (const w of ws.split(' ')) (CL[w] = CL[w] || []).push(t);
const PRON = Object.assign(Object.create(null), { i: { p: 1, n: 'sg', c: 'nom' }, me: { p: 1, n: 'sg', c: 'acc' }, myself: { p: 1, n: 'sg', c: 'acc' }, you: { p: 2, n: 'sg' }, yourself: { p: 2, n: 'sg' },
  he: { p: 3, n: 'sg', g: 'm', c: 'nom' }, him: { p: 3, n: 'sg', g: 'm', c: 'acc' }, she: { p: 3, n: 'sg', g: 'f', c: 'nom' }, her: { p: 3, n: 'sg', g: 'f', c: 'acc' }, it: { p: 3, n: 'sg', g: 'n' },
  we: { p: 1, n: 'pl', c: 'nom' }, us: { p: 1, n: 'pl', c: 'acc' }, they: { p: 3, n: 'pl', c: 'nom' }, them: { p: 3, n: 'pl', c: 'acc' },
  anything: { p: 3, n: 'sg', g: 'n', indef: true }, something: { p: 3, n: 'sg', g: 'n', indef: true }, nothing: { p: 3, n: 'sg', g: 'n', indef: true }, everything: { p: 3, n: 'sg', g: 'n', indef: true },
  anyone: { p: 3, n: 'sg', g: 'u', indef: true }, someone: { p: 3, n: 'sg', g: 'u', indef: true }, noone: { p: 3, n: 'sg', g: 'u', indef: true }, everyone: { p: 3, n: 'sg', g: 'u', indef: true },
  anybody: { p: 3, n: 'sg', g: 'u', indef: true }, somebody: { p: 3, n: 'sg', g: 'u', indef: true }, nobody: { p: 3, n: 'sg', g: 'u', indef: true }, everybody: { p: 3, n: 'sg', g: 'u', indef: true } });
const MONTHS = new Set('january february march april may june july august september october november december'.split(' '));
const TIMEW = new Set('now today tonight tomorrow yesterday monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december morning afternoon evening night week month year weekend noon midnight'.split(' '));
/* given names that are also common nouns (Doc4 controlled list): a capitalised occurrence is ambiguous unless memory settles it */
const NAMEISH = new Set('rose lily daisy iris violet ivy jasmine hazel holly heather olive ruby pearl amber crystal jade grace joy hope faith mark bill will pat sue frank victor jack rob dawn april may june summer autumn sky river robin jay drew gene rich bob sandy dusty penny carol angel destiny melody harmony patience honor chase hunter cliff glen dale brook forest heath reed rocky skip buck chip guy art'.split(' '));
const SUBW = new Set(['because', 'when', 'while', 'after', 'before', 'until', 'since']);
const CTRL_INF = new Set('want need like love hate try decide plan hope expect agree refuse promise learn forget start begin continue prefer intend wish choose attempt manage fail offer seem afford arrange claim deserve pretend threaten tend volunteer wait'.split(' ')); // Doc5 frame registry: verbs licensing a to-infinitive (union with WordNet frames 28/32/35)
const CTRL_GER = new Set('like love hate enjoy stop start finish avoid mind keep quit prefer begin continue try miss consider suggest practice practise imagine recommend risk deny admit appreciate dislike'.split(' ')); // verbs licensing a gerund (union with WordNet frame 33)
/* FRAME_RE: which WordNet generic frame strings license each complement kind; FRAME_SUPP: lexicon supplements where WordNet lists no such frame for the lemma */
const FRAME_RE = { inf: /to INFINITIVE$|----s INFINITIVE$/, ger: /VERB-ing$/, clause: /that CLAUSE$/, adj: /----s Adjective(\/Noun)?$/, objadj: /----s something Adjective\/Noun$/, addressee_clause: /^$/, dbl: /----s somebody something$/, objinf: /----s somebody to INFINITIVE$|----s somebody INFINITIVE$/, bareinf: /----s somebody INFINITIVE$/, tr: /----s (something|somebody)$/ };
/* SEED_FRAMES: the seed tier's own verbs (used only when no WordNet tier is attached, e.g. the bare kernel) */
const SEED_FRAMES = { clause: new Set('know think say believe hope remember tell'.split(' ')) };
const FRAME_SUPP = { bareinf: new Set('see watch hear feel notice observe make let help have'.split(' ')), objinf: new Set('advise ask tell want expect allow order require force urge encourage instruct permit enable persuade remind warn invite direct cause compel oblige authorize authorise train teach help'.split(' ')), dbl: new Set('give tell show send bring buy offer pay lend sell teach hand pass owe cook make get find leave promise ask deny grant award allow cost wish read write serve'.split(' ')), addressee_clause: new Set('tell inform remind promise show teach warn assure notify convince persuade'.split(' ')) };
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
const IRR = 'split split split|cast cast cast|burst burst burst|bet bet bet|shed shed shed|thrust thrust thrust|broadcast broadcast broadcast|forecast forecast forecast|bid bid bid|rid rid rid|slit slit slit|spit spat spat|reset reset reset|have had had|do did done|go went gone|say said said|make made made|get got gotten|know knew known|think thought thought|take took taken|see saw seen|come came come|give gave given|find found found|tell told told|become became become|leave left left|feel felt felt|bring brought brought|begin began begun|keep kept kept|hold held held|write wrote written|stand stood stood|hear heard heard|let let let|mean meant meant|set set set|meet met met|run ran run|pay paid paid|sit sat sat|speak spoke spoken|lead led led|read read read|grow grew grown|lose lost lost|fall fell fallen|send sent sent|build built built|understand understood understood|draw drew drawn|break broke broken|spend spent spent|cut cut cut|rise rose risen|drive drove driven|buy bought bought|wear wore worn|choose chose chosen|eat ate eaten|drink drank drunk|sing sang sung|swim swam swum|fly flew flown|forget forgot forgotten|sleep slept slept|teach taught taught|catch caught caught|fight fought fought|sell sold sold|win won won|ride rode ridden|wake woke woken|throw threw thrown|put put put|hit hit hit|hurt hurt hurt|cost cost cost|shut shut shut|quit quit quit|feed fed fed|shoot shot shot|hang hung hung|dig dug dug|bite bit bitten|hide hid hidden|forgive forgave forgiven|freeze froze frozen|steal stole stolen|beat beat beaten|bend bent bent|lend lent lent|shake shook shaken|sink sank sunk|spread spread spread|stick stuck stuck|strike struck struck|swear swore sworn|tear tore torn|lie lay lain|lay laid laid|bear bore born|blow blew blown|deal dealt dealt|feel felt felt|light lit lit|sweep swept swept|weep wept wept|show showed shown|prove proved proven|ring rang rung|drink drank drunk|seek sought sought|think thought thought|fight fought fought|sing sang sung'.split('|').map(x => x.split(' '));
const IRRV = Object.create(null); const IRRF = Object.create(null); for (const [b, p, pp] of IRR) { IRRV[b] = { past: p, pp }; (IRRF[p] = IRRF[p] || []).push({ lemma: b, f: 'past' }); if (pp !== p) (IRRF[pp] = IRRF[pp] || []).push({ lemma: b, f: 'pp' }); }
const IRRN = Object.assign(Object.create(null), { men: 'man', women: 'woman', children: 'child', people: 'person', feet: 'foot', teeth: 'tooth', mice: 'mouse', geese: 'goose', lives: 'life', wives: 'wife', knives: 'knife', leaves: 'leaf', halves: 'half', wolves: 'wolf', shelves: 'shelf' });
const IRRNP = Object.create(null); for (const [p, s] of Object.entries(IRRN)) IRRNP[s] = p;
const dbl = w => /^[^aeiou]*[aeiou][bdfgklmnprtvz]$/.test(w) && !/[wxy]$/.test(w);
/* DBL_LEX (4.9.50): consonant doubling is a lexicon fact for stress-final verbs (admit → admitted, refer → referred), read from the WordNet exception list;
   British l-doubling (travelled) is not adopted, so the realizer keeps one spelling */
const DBL_LEX = new Set(); function learnExc(exc) { for (const f in exc) { const l = exc[f]; if (f === l + l.slice(-1) + 'ed' && !/l$/.test(l)) DBL_LEX.add(l); } }
function inflect(lemma, f) {
  if (lemma === 'be') return { pres3: 'is', pres1: 'am', pres: 'are', past: 'was', pastpl: 'were', pp: 'been', ing: 'being', base: 'be' }[f] || lemma;
  if (lemma === 'have' && f === 'pres3') return 'has'; if (lemma === 'do' && f === 'pres3') return 'does'; if (lemma === 'go' && f === 'pres3') return 'goes';
  if (f === 'base' || f === 'pres' || f === 'pres1') return lemma;
  if ((f === 'past' || f === 'pp') && IRRV[lemma]) return IRRV[lemma][f];
  if (f === 'past' || f === 'pp') for (const pre of ['under', 'over', 'out', 'with', 'up', 'fore', 'mis', 're', 'be', 'by', 'down', 'in', 'off']) if (lemma.startsWith(pre) && IRRV[lemma.slice(pre.length)]) return pre + IRRV[lemma.slice(pre.length)][f]; /* M-PREFIX-IRR-VERB */
  if (f === 'pres3' || f === 'plural') { if (f === 'plural' && IRRNP[lemma]) return IRRNP[lemma]; if (/[^aeiou]y$/.test(lemma)) return lemma.slice(0, -1) + 'ies'; if (/(s|x|z|ch|sh|o)$/.test(lemma)) return lemma + 'es'; return lemma + 's'; }
  if (f === 'past' || f === 'pp') { if (/e$/.test(lemma)) return lemma + 'd'; if (/[^aeiou]y$/.test(lemma)) return lemma.slice(0, -1) + 'ied'; if (dbl(lemma) || DBL_LEX.has(lemma)) return lemma + lemma.slice(-1) + 'ed'; return lemma + 'ed'; }
  if (f === 'ing') { if (/ie$/.test(lemma)) return lemma.slice(0, -2) + 'ying'; if (/[^e]e$/.test(lemma)) return lemma.slice(0, -1) + 'ing'; if (dbl(lemma) || DBL_LEX.has(lemma)) return lemma + lemma.slice(-1) + 'ing'; return lemma + 'ing'; }
  return lemma;
}
/* lemmatize: candidate {lemma,pos,f} accepted only when the lexicon has the lemma with that POS (Doc4: no invented words) */
function lemmatize(w, lex) {
  const out = lemmatize0(w, lex); if (out.length || !lex.derive || !/^[a-z][a-z\-]{2,}$/.test(w)) return out;
  /* M-DERIVE (4.9.50, Doc4 morphology; Pāṇini kṛt/taddhita): a word with no lexicon entry is derived from a lexicon word —
     spelling variant, compound head, prefix + base, or suffix + base — and admitted provisionally; then the ordinary inflection rules apply */
  return lex.derive(w, x => lemmatize0(x, lex).length > 0) ? lemmatize0(w, lex) : out;
}
/* 4.9.95 PP-L-DOUBLING: reading, the participle of an l-final verb is accepted in both spellings (expelled / traveled — American English doubles a
   stressed final l, and stress is not written); the realizer keeps its one spelling */
const ppSpelled = (lemma, w) => inflect(lemma, 'pp') === w || (/[aeiou]l$/.test(lemma) && w === lemma + 'led');
function lemmatize0(w, lex) {
  const out = []; const add = (lemma, pos, f, rule) => { if (lex.hasPos(lemma, pos) && !out.some(o => o.lemma === lemma && o.pos === pos && o.f === f)) out.push({ lemma, pos, f, rule }); };
  for (const pos of ['n', 'v', 'a', 'r']) add(w, pos, pos === 'n' ? 'sg' : pos === 'v' ? 'base' : 'pos', 'M-BASE');
  (IRRF[w] || []).forEach(x => add(x.lemma, 'v', x.f, 'M-IRR-VERB'));
  /* M-PREFIX-IRR-VERB (4.9.50): a prefixed verb inflects like its base (under+went → undergo, over+took → overtake, with+drew → withdraw) */
  for (const pre of ['under', 'over', 'out', 'with', 'up', 'fore', 'mis', 're', 'be', 'by', 'down', 'in', 'off']) if (w.startsWith(pre) && IRRF[w.slice(pre.length)]) IRRF[w.slice(pre.length)].forEach(x => add(pre + x.lemma, 'v', x.f, 'M-PREFIX-IRR-VERB'));
  if (IRRN[w]) add(IRRN[w], 'n', 'pl', 'M-IRR-NOUN'); if (IRRA[w]) add(IRRA[w][0], 'a', IRRA[w][1], 'M-IRR-ADJ-DEGREE');
  const ex = lex.exc(w); if (ex) { add(ex, 'v', /ing$/.test(w) && !/ing$/.test(ex) ? 'ing' : 'past', 'M-WN-EXC'); /* 4.9.91: an exception form in -ing (splitting → split) is the participle, not a past */ if (!lex.hasPos(ex, 'v') || /(a|i|ae|ice|eet|een|ren|ces|ses|xes|ves|ia)$/.test(w)) add(ex, 'n', 'pl', 'M-WN-EXC'); if (/(er|est)$/.test(w) || !lex.hasPos(ex, 'v')) add(ex, 'a', 'cmp', 'M-WN-EXC'); } /* 4.9.50: a verb exception (left → leave) is not also a noun plural or a comparative */
  const tries = [[/ies$/, 'y', ['n:pl', 'v:pres3']], [/(ss|x|z|ch|sh|o)es$/, '$1', ['n:pl', 'v:pres3']], [/ves$/, 'f', ['n:pl']], [/ves$/, 'fe', ['n:pl']], [/([^s])s$/, '$1', ['n:pl', 'v:pres3']],
    [/ied$/, 'y', ['v:past']], [/([^e])ed$/, '$1', ['v:past']], [/ed$/, 'e', ['v:past']], [/(.)\1ed$/, '$1', ['v:past']], [/([^e])d$/, '$1', ['v:past']],
    [/ying$/, 'ie', ['v:ing']], [/ing$/, '', ['v:ing']], [/ing$/, 'e', ['v:ing']], [/(.)\1ing$/, '$1', ['v:ing']], [/ier$/, 'y', ['a:cmp']], [/er$/, '', ['a:cmp']], [/er$/, 'e', ['a:cmp']], [/(.)\1er$/, '$1', ['a:cmp']], [/iest$/, 'y', ['a:sup']], [/est$/, '', ['a:sup']], [/est$/, 'e', ['a:sup']], [/(.)\1est$/, '$1', ['a:sup']]];
  for (const [re, rep, pf] of tries) if (re.test(w)) { const l = w.replace(re, rep); for (const x of pf) { const [pos, f] = x.split(':'); add(l, pos, f, 'M-SUFFIX-' + f.toUpperCase()); } }
  /* M-ORTHO-VARIANT-APAVADA: a doubled-consonant stem (instal+l+ed) and the plain stem (install+ed) are one word in two spellings; the plain stem wins */
  const o2 = out.filter(o => !(o.pos === 'v' && o.f !== 'base' && out.some(p => p !== o && p.pos === 'v' && p.f === o.f && p.lemma === o.lemma + o.lemma.slice(-1))));
  /* M-PLURAL-LEXEME-APAVADA (4.9.50): a noun form that is both a lexeme ("briefs", "damages") and the plural of a lexeme ("brief") is one word;
     the reading from the better-attested tier wins (core > extended > complete), the regular plural on a tie (Pāṇini: one form, one derivation) */
  const tr = l => (lex.tier ? lex.tier(l) : 0);
  /* M-VES-APAVADA (4.9.67): -ves → -f/-fe is not a WordNet detachment rule (morphy lists those plurals as exceptions, IRRN here); as a suffix
     guess it yields only when the regular -s plural of the same surface is no noun ("raves" is rave, not RAF; "calves" stays calf) */
  const o3 = o2.filter(o => !(o.pos === 'n' && o.f === 'pl' && /^M-SUFFIX/.test(o.rule || '') && /ves$/.test(w) && /fe?$/.test(o.lemma) && o2.some(p => p !== o && p.pos === 'n' && p.f === 'pl' && p.lemma === w.slice(0, -1))));
  /* M-GERUND-NOUN-PL (4.9.82): "V-ings" with no other reading is the plural of the event nominal V-ing (drownings, sightings): the -ing form of a
     lexicon verb, counted (Pāṇini kṛt: the action noun takes number) */
  if (!o3.length && /^[a-z]{3,}ings$/.test(w) && lemmatize0(w.slice(0, -1), lex).some(x => x.pos === 'v' && x.f === 'ing')) o3.push({ lemma: w.slice(0, -1), pos: 'n', f: 'pl', rule: 'M-GERUND-NOUN-PL' });
  return o3.filter(o => { if (o.pos !== 'n') return true; const reg = x => x.f === 'pl' && /^M-SUFFIX/.test(x.rule || '') && /s$/.test(w); const rival = o2.find(p => p !== o && p.pos === 'n' && ((o.f === 'sg' && reg(p) && o.lemma === w) || (reg(o) && p.f === 'sg' && p.lemma === w)));
    if (!rival) return true; const mine = tr(o.lemma), theirs = tr(rival.lemma); return o.f === 'pl' ? mine <= theirs : mine < theirs; });
}
/* ---------- analysis / tagging ---------- */
function analyse(tok, idx, lex) {
  const w = tok.w, an = []; if (tok.i0 !== undefined) idx = tok.i0; if (tok.rendered && idx === 0) idx = 1; // ECHO-RENDER-CASE: the realizer never capitalises sentence-initial common words, so a capital in rendered text is authoritative
  if (/^\d+(\.\d+)?$/.test(w)) return [{ tag: 'NUM', lemma: w }];
  if (/^\d+(?:st|nd|rd|th)$/.test(w)) return [{ tag: 'ADJ', lemma: w, f: 'pos' }]; // an ordinal modifies its noun like an adjective (the 15th amendment)
  if (/^".*"$/.test(w)) return [{ tag: 'QUOTE', lemma: tok.orig.slice(1, -1) }];
  if (w === "'s") return [{ tag: 'GEN' }];
  if (/^[,;:]$/.test(w)) return [{ tag: 'PUNCT', lemma: w }];
  const closed = CL[w] || [];
  for (const t of closed) an.push({ tag: t, lemma: w, rule: 'TAG-CLOSED-' + t });
  const ctrl = lex.controlled(w);
  const cap = /^[A-Z]/.test(tok.orig);
  if (closed.length && !['like', 'that', 'no', 'back', 'up', 'out', 'down', 'past', 'inside', 'outside', 'above', 'below', 'within'].includes(w) && w !== 'her') return an; // TAG-CLOSED-FIRST
  const memName = cap && !closed.length && lex.entityName && lex.entityName(w);
  if (memName === 'name') return [{ tag: 'PROPN', lemma: tok.orig, rule: 'TAG-PROPN-MEMORY-ENTITY' }]; // memory already holds this name (user-confirmed entity)
  const ambigCap = cap && !closed.length && !TIMEW.has(w) && NAMEISH.has(w) && memName !== 'common' && lemmatize(w, lex).some(m => m.pos === 'n');
  if (ambigCap) { for (const m of lemmatize(w, lex)) { const T2 = { n: 'N', v: 'V', a: 'ADJ', r: 'ADV' }[m.pos]; if (idx > 0 && T2 !== 'N') continue; an.push({ tag: T2, lemma: m.lemma, f: m.f, rule: m.rule }); } an.push({ tag: 'PROPN', lemma: tok.orig, rule: 'TAG-CAPITAL-AMBIGUOUS' }); return an; } // name-or-common-noun: both readings kept → clarification
  if (cap && idx > 0 && !closed.length) return [{ tag: 'PROPN', lemma: tok.orig, rule: 'TAG-PROPN-CAPITAL-APAVADA' }]; // specific (capitalised, non-initial) overrides general lexical tagging
  if (cap && idx > 0 && !closed.length && lex.isName(w)) return [{ tag: 'PROPN', lemma: tok.orig, rule: 'TAG-PROPN-CAPITAL-KNOWN' }];
  for (const m of lemmatize(w, lex)) { const T = { n: 'N', v: 'V', a: 'ADJ', r: 'ADV' }[m.pos]; if (T === 'ADV' && closed.includes('ADV')) continue; an.push({ tag: T, lemma: m.lemma, f: m.f, rule: m.rule }); }
  if (cap && idx === 0 && !closed.length && lex.isProper && lex.isProper(w)) return [{ tag: 'PROPN', lemma: tok.orig, rule: 'TAG-PROPN-LEXICON' }]; // 4.9.92: a word the lexicon knows only as a name stays a name at the start of a sentence ("Lena", "Jupiter")
  if (cap && idx === 0 && !closed.length && an.length && lex.coreNoun && !lex.coreNoun(w)) an.push({ tag: 'PROPN', lemma: tok.orig, rule: 'TAG-PROPN-INITIAL-ALT' }); // initial capital: name reading kept open unless a core common noun
  if (!an.length && cap) an.push({ tag: 'PROPN', lemma: tok.orig, rule: 'TAG-PROPN-CAPITAL' });
  if (!an.length && ctrl.length) an.push({ tag: 'N', lemma: w, f: 'sg', rule: 'TAG-CONTROLLED-TERM' });
  if (!an.length && lex.openNominal && /^[a-z][a-z-]{2,}$/.test(w)) an.push(/[^su]s$/.test(w) && w.length > 4 ? { tag: 'N', lemma: w.slice(0, -1), f: 'pl', rule: 'LX-OPEN-NOMINAL' } : { tag: 'N', lemma: w, f: 'sg', rule: 'LX-OPEN-NOMINAL' }); // OPEN-NOMINAL: an unknown word of a proved source sentence is a noun stem
  if (!an.length) an.push({ tag: 'UNK', lemma: w, rule: 'LX-UNKNOWN' });
  return an;
}
/* T-SENTENCE-BOUNDARY (4.9.79): a sentence ends at . ! ? followed by space, except after an initialism or a title abbreviation (T-ABBREVIATION) */
const ABBR_END = /(?:\b(?:[A-Za-z]\.){2,}|\b(?:Mr|Mrs|Ms|Dr|Prof|St|Mt|Jr|Sr)\.)$/;
function splitSentences(text) { const out = []; let cur = ''; for (const piece of String(text).split(/(?<=[.!?])\s+/)) { cur = cur ? cur + ' ' + piece : piece; if (ABBR_END.test(cur) && !/[!?]$/.test(cur)) continue; out.push(cur); cur = ''; } if (cur) out.push(cur); return out.map(x => x.trim()).filter(Boolean); }
function tokenize(text) {
  const raw = String(text).replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
  /* T-ABBREVIATION (4.9.79; orthography): an initialism with internal periods ("U.S.", "e.g.") and a title abbreviation ("Dr.", "Mr.") are one word, period included */
  const parts = raw.match(/"[^"]*"|(?:[A-Za-z]\.){2,}|\b(?:Mr|Mrs|Ms|Dr|Prof|St|Mt|Jr|Sr)\.(?=\s+[A-Z])|[A-Za-zÀ-ÿ]+-\d+\b|[A-Za-z]+\d[A-Za-z0-9]*\b|\d+[A-Za-z]+[A-Za-z0-9]*\b|[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\-]*(?:'(?!s\b)[a-z]+)?|'s\b|\d+(?:\.\d+)?|[?,;:.!]/g) || [];
  const exp = Object.assign(Object.create(null), { "don't": 'do not', "doesn't": 'does not', "didn't": 'did not', "isn't": 'is not', "aren't": 'are not', "wasn't": 'was not', "weren't": 'were not', "won't": 'will not', "can't": 'can not', "cannot": 'can not', "couldn't": 'could not', "wouldn't": 'would not', "shouldn't": 'should not', "i'm": 'i am', "you're": 'you are', "we're": 'we are', "they're": 'they are', "i've": 'i have', "i'll": 'i will', "you'll": 'you will', "he's": 'he is', "she's": 'she is', "it's": 'it is', "what's": 'what is', "who's": 'who is', "where's": 'where is', "that's": 'that is', "let's": 'let us', "haven't": 'have not', "hasn't": 'has not' });
  const toks = [];
  for (const p of parts) { const lw = p.toLowerCase(); if (exp[lw]) { exp[lw].split(' ').forEach((x, i) => toks.push({ w: x, orig: i === 0 && /^[A-Z]/.test(p) ? x[0].toUpperCase() + x.slice(1) : x, contraction: lw })); } else toks.push({ w: lw, orig: p }); }
  toks.forEach((t, i) => { t.i0 = i; });
  for (let i = 1; i < toks.length; i++) if (toks[i].w === "'s" && /^(he|she|it|what|who|where|that|there|here|how)$/.test(toks[i - 1].w)) toks[i] = { w: 'is', orig: 'is', contraction: "'s" }; // M-CONTRACTION-S
  return toks;
}
/* ---------- derivation (recursive descent; every alternative kept) ---------- */
/* LX-PROVISIONAL-NOUN (4.9.50, Doc4 unknown-concept state; Doc5 kāraka by position): an unknown word that heads a noun phrase
   (after a determiner, possessive, numeral or adjective, or after a preposition) is read provisionally as a noun; it stays marked provisional */
function analyseAll(toks, lex) {
  const T = toks.map((t, i) => Object.assign({}, t, { an: analyse(t, i, lex) }));
  /* TAG-CONVERSION-V-N (4.9.79; zero derivation, English conversion — Pāṇini's kṛt with a zero affix): a word the lexicon knows only as a verb, in
     its base form, right after a determiner or possessive, also reads as a singular noun ("the glaze", "a sprint"); the parse decides, never a list */
  for (let i = 1; i < T.length; i++) { const p = CL[T[i - 1].w] || []; if (!(p.includes('DET') || p.includes('POSS'))) continue; const an = T[i].an;
    if (an.length && an.every(a => a.tag === 'V') && an.some(a => a.lemma === T[i].w && !a.provisional) && !(lex.tierPos && lex.tierPos(T[i].w, 'v') > 2)) an.push(/* only a verb the lexicon itself lists converts; a provisionally derived verb stays unknown-like (RULINGS-474) */ { tag: 'N', lemma: T[i].w, f: 'sg', rule: 'TAG-CONVERSION-V-N' }); }
  /* TAG-COMPLETE-TIER-APAVADA (4.9.50): the complete (lowest-assurance) tier is a last resort per word: a reading whose lemma and part of speech come only
     from it is dropped when the same word has a reading of the same category from the core or extended tier ("leaves" is leave, not the rare verb leaf) */
  if (lex.tierPos) { const PS = { N: 'n', V: 'v', ADJ: 'a', ADV: 'r' }; const rank = a => (PS[a.tag] && a.lemma && !a.provisional ? Math.min(lex.tierPos(a.lemma, PS[a.tag]), a.tag === 'ADJ' ? lex.tierPos(a.lemma, 's') : 9) : 0);
    for (const t of T) if (t.an.length > 1) { const r = t.an.map(rank); t.an = t.an.filter((a, k) => !(r[k] === 2 && t.an.some((b, j) => r[j] < 2 && b.tag === a.tag))); } }
  /* M-THAN-ORTHO (4.9.51): "then" after a comparative ("more authority then a sheriff", "taller then") is the common misspelling of "than" */
  for (let i = 1; i < T.length; i++) if (T[i].w === 'then' && T.slice(Math.max(0, i - 4), i).some(t => ['more', 'less', 'fewer', 'rather', 'other'].includes(t.w) || t.an.some(a => a.tag === 'ADJ' && a.f === 'cmp'))) T[i] = Object.assign({}, T[i], { w: 'than', an: analyse(Object.assign({}, T[i], { w: 'than' }), i, lex), normalized: 'then→than' });
  /* TAG-MODAL-NOUN-APAVADA (4.9.50): after a determiner or possessive, "will"/"can" is the noun ("a will", "the can") */
  for (let i = 1; i < T.length; i++) if (['will', 'can'].includes(T[i].w) && T[i - 1].an.some(x => ['DET', 'POSS'].includes(x.tag)) && lex.hasPos(T[i].w, 'n')) T[i].an = [{ tag: 'N', lemma: T[i].w, f: 'sg', rule: 'TAG-MODAL-NOUN-APAVADA' }];
  if (lex.provisionalOK && !lex.provisionalOK()) return T;
  for (let i = 1; i < T.length; i++) { const a = T[i].an; if (!(a.length === 1 && a[0].tag === 'UNK' && /^[a-z][a-z\-]+$/.test(T[i].w))) continue; const pv = T[i - 1].an;
    if (pv.some(x => ['DET', 'POSS', 'NUM', 'ADJ', 'PREP', 'GEN', 'QUANT'].includes(x.tag))) { const pl = /[^s]s$/.test(T[i].w) && T[i].w.length > 3;
      const nx = i + 1 < T.length ? analyse(T[i + 1], i + 1, lex) : []; if (nx.some(x => x.tag === 'N') && !nx.some(x => x.tag === 'V' && /^pres3|past$/.test(x.f || ''))) { T[i].an = [{ tag: 'ADJ', lemma: T[i].w, f: 'pos', rule: 'LX-PROVISIONAL-MODIFIER', provisional: true }]; if (lex.provisional) lex.provisional(T[i].w, 'a'); continue; } /* DET _ N: the unknown word is a modifier */
      T[i].an = [{ tag: 'N', lemma: pl ? T[i].w.slice(0, -1) : T[i].w, f: pl ? 'pl' : 'sg', rule: 'LX-PROVISIONAL-NOUN', provisional: true }]; if (lex.provisional) lex.provisional(T[i].an[0].lemma, 'n'); } }
  return T;
}
function Parser(toks, lex) {
  const T = analyseAll(toks, lex);
  const at = (i, tag, w) => (i < T.length ? T[i].an.filter(a => a.tag === tag && (!w || (Array.isArray(w) ? w.includes(T[i].w) : T[i].w === w))) : []);
  const word = i => (i < T.length ? T[i].w : null);
  const R = (node, i, rules) => ({ node, i, rules: rules || [] });
  const flat = a => [].concat(...a);
  // ---- NP ----
  /* NP-PREMOD (4.9.88, viśeṣaṇa): a pre-nominal modifier is an adjective, an adverb + adjective ("fully aquatic", "widely distributed"), a hyphenated
     participial compound ("coarse-grained"), or two of these joined by and / or ("distributed and diverse"); each is one modifier of the head */
  function premods(j) { const one = k => { const r = []; if (k >= T.length) return r; for (const a of at(k, 'ADJ')) r.push({ w: T[k].w, j: k + 1, rules: [a.rule] });
      if (at(k, 'ADV').length && !at(k, 'ADJ').length && k + 1 < T.length && at(k + 1, 'ADJ').some(a => a.f === 'pos')) r.push({ w: T[k].w + ' ' + T[k + 1].w, j: k + 2, rules: ['NP-ADV-ADJ'] });
      const vMod = x => !at(x, 'ADJ').length && at(x, 'V').some(v => v.f === 'ing' || v.f === 'pp' || v.f === 'past') && x + 1 < T.length && (at(x + 1, 'N').length || at(x + 1, 'ADJ').length); /* 4.9.91: a participle before its noun ("a rapidly rotating column", "a rotating column") */
      if (at(k, 'ADV').length && !at(k, 'ADJ').length && vMod(k + 1)) r.push({ w: T[k].w + ' ' + T[k + 1].w, j: k + 2, rules: ['NP-ADV-PARTICIPLE'] });
      if (k > 0 && at(k - 1, 'DET').length && vMod(k) && at(k, 'V').some(v => v.f === 'ing')) r.push({ w: T[k].w, j: k + 1, rules: ['NP-PARTICIPLE-PREMOD'] });
      if (!at(k, 'ADJ').length && /^[a-z]+-[a-z]+ed$/.test(T[k].w) && at(k, 'V').some(v => v.f === 'past' || v.f === 'pp')) r.push({ w: T[k].w, j: k + 1, rules: ['NP-COMPOUND-ADJ'] });
      return r; };
    const ptc = k => k + 1 < T.length && !at(k, 'ADJ').length && at(k, 'V').some(v => v.f === 'past' || v.f === 'pp') && (at(k + 1, 'N').length || at(k + 1, 'ADJ').length) ? [{ w: T[k].w, j: k + 1, rules: ['NP-PARTICIPLE-PREMOD'] }] : []; /* a participle joined to a modifier ("roasted, ground") modifies too */
    const out = one(j); for (const b of out.slice()) if (b.j + 1 < T.length && /^(and|or|,)$/.test(word(b.j))) for (const c of one(b.j + 1).concat(ptc(b.j + 1))) out.push({ w: b.w + (word(b.j) === ',' ? ',' : ' ' + word(b.j)) + ' ' + c.w, j: c.j, rules: b.rules.concat(['NP-ADJ-COORD'], c.rules) });
    return out; }
  function nominal(i) { // ADJ* N+ (compound)
    const res = [];
    (function go(j, adjs, nouns, rules) {
      if (nouns.length) res.push(R({ adjs: adjs.slice(), head: nouns.map(n => n.lemma), plural: nouns[nouns.length - 1].f === 'pl', surface: nouns.map(n => n.w) }, j, rules));
      if (!nouns.length) for (const p of premods(j)) go(p.j, adjs.concat([p.w]), nouns, rules.concat(p.rules));
      /* NP-COMPOUND-MODIFIER-APAVADA (4.9.50): a non-final member of a noun compound is uninflected ("the dog wants water" has no compound "dog wants"),
         and a deictic time phrase (last/next/this/every + time word) is a kāla adjunct, never a compound member */
      const lastN = nouns[nouns.length - 1]; if (lastN && lastN.f === 'pl' && /^M-SUFFIX/.test(lastN.rule || '')) { /* no further member */ } else
      for (const n of at(j, 'N')) { if (j + 1 < T.length && KARAKA[word(j) + ' ' + word(j + 1)]) continue; /* 4.9.85: the first word of a two-word preposition ("due to") is not a compound member */ if (j + 1 < T.length && TIMEW.has(word(j + 1)) && ['last', 'next', 'this', 'every', 'each'].includes(word(j))) continue; if (nouns.length && TIMEW.has(word(j)) && ['last', 'next', 'this', 'every', 'each'].includes(word(j - 1))) continue;
        go(j + 1, adjs, nouns.concat([{ lemma: n.lemma, f: n.f, w: T[j].w, rule: n.rule }]), rules.concat([n.rule || 'TAG-N'])); }
      if (!nouns.length && !adjs.length && j > 0 && at(j - 1, 'DET').length && at(j, 'PROPN').length && j + 1 < T.length && at(j + 1, 'N').length) go(j + 1, adjs, [{ lemma: T[j].orig, f: 'sg', w: T[j].orig }], rules.concat(['NP-PROPN-MODIFIER'])); // 4.9.42: a name as a pre-nominal modifier after a determiner ("the Planck constant")
    })(i, [], [], []);
    return res;
  }
  function npBase(i) {
    const out = [];
    for (const a of at(i, 'PRON')) { const p = PRON[word(i)]; out.push(R(p.indef ? { indef: word(i), feats: p } : p.p === 1 && p.n === 'sg' ? { pron: 'user' } : p.p === 2 ? { pron: 'kernel' } : { pron3: word(i), feats: p }, i + 1, [p.indef ? 'NP-INDEFINITE-PRON' : 'NP-PRON']));
      /* NP-INDEFINITE-POSTMOD (Merge: the quantifier pronoun is the head, the adjective merges to its right: "something cold", "anything new") */
      if (p.indef) for (const q of at(i + 1, 'ADJ')) if (q.f === 'pos') out.push(R({ indef: word(i), feats: p, adjs: [T[i + 1].w] }, i + 2, ['NP-INDEFINITE-PRON', 'NP-INDEFINITE-POSTMOD'])); }
    if (/^(?:this|these|those)$/.test(word(i)) && at(i, 'DET').length && !(i + 1 < T.length && ['N', 'ADJ', 'NUM', 'PROPN', 'DET', 'POSS', 'QUANT'].some(t => at(i + 1, t).length))) out.push(R({ pron3: word(i), feats: { p: 3, n: word(i) === 'this' ? 'sg' : 'pl', dem: true } }, i + 1, ['NP-DEMONSTRATIVE-PRON'])); // 4.9.40: a determiner with no nominal after it is a demonstrative pronoun ("use this")
    if (word(i) === 'that' && !(i > 0 && (at(i - 1, 'N').length || at(i - 1, 'PROPN').length))) { const nominal = i + 1 < T.length && ['N', 'NUM', 'PROPN', 'DET', 'POSS', 'QUANT'].some(t => at(i + 1, t).length); const adjNom = i + 1 < T.length && at(i + 1, 'ADJ').length && i + 2 < T.length && ['N', 'PROPN'].some(t => at(i + 2, t).length); if (!nominal && !adjNom) out.push(R({ pron3: 'that', feats: { p: 3, n: 'sg', g: 'n', dem: true } }, i + 1, ['NP-DEMONSTRATIVE-PRON'])); } // 4.9.98: bare "that" is a demonstrative when it does not continue a noun ("that is bright", "is that bright"); "the device that sends" stays a relative and "that the …" / "that bright mineral" stay a complementizer or a noun phrase
    /* NP-DEFINITE-NAME (4.9.85) */
    if (word(i) === 'the' && at(i + 1, 'PROPN').length && !at(i + 1, 'N').length) { let j = i + 1; const ws = [T[i].orig || T[i].w]; while (at(j, 'PROPN').length) { ws.push(T[j].orig); j++; } const last = String(ws[ws.length - 1]).toLowerCase(), whole = ws.slice(1).join('_').toLowerCase(); const pl = /[^s]s$/.test(last) && !!(lex.hasPos && lex.hasPos(last.slice(0, -1), 'n')) && !(lex.hasPos && lex.hasPos(whole, 'n')); /* "the French Armed Forces" are; "the United States" (one lexicon name) is */ out.push(R(Object.assign({ propn: ws.join(' ') }, pl ? { plural: true } : {}), j, ['NP-DEFINITE-NAME'])); }
    /* NP-DATE (4.9.87): a calendar date "<day> <Month> [<year>]" is one name-like noun phrase (the kāla of a dated event) */
    if (/^\d{1,2}$/.test(word(i)) && MONTHS.has(word(i + 1))) { const y = /^\d{3,4}$/.test(word(i + 2) || '') ? 1 : 0; out.push(R({ propn: T.slice(i, i + 2 + y).map(t => t.orig || t.w).join(' ') }, i + 2 + y, ['NP-DATE'])); }
    if (at(i, 'PROPN').length) { let j = i; const ws = []; while (at(j, 'PROPN').length) { ws.push(T[j].orig); j++; } out.push(R({ propn: ws.join(' ') }, j, ['NP-PROPN']));
      /* NP-PROPN-COMPOUND (4.9.85) */
      if (j < T.length && at(j, 'N').length && !at(j, 'PROPN').length && at(j, 'V').every(v => v.f === 'ing') && !(j + 1 < T.length && at(j + 1, 'N').length && !at(j + 1, 'V').length)) out.push(R({ propn: ws.join(' ') + ' ' + T[j].w }, j + 1, ['NP-PROPN-COMPOUND'])); }
    if (at(i, 'NUM').length && at(i + 1, 'NUM').length) { let j = i; const ns = []; while (at(j, 'NUM').length) { ns.push(word(j)); j++; } out.push(R({ num: ns.join(' ') }, j, ['NP-NUM-SEQUENCE'])); }
    for (const a of at(i, 'NUM')) { out.push(R({ num: a.lemma }, i + 1, ['NP-NUM'])); for (const n of nominal(i + 1)) out.push(R(Object.assign({ num: a.lemma }, n.node), n.i, ['NP-NUM-N'].concat(n.rules))); }
    for (const q of at(i, 'QUOTE')) out.push(R({ quote: q.lemma }, i + 1, ['NP-QUOTE']));
    let quant = null, j = i; if (at(i, 'QUANT').length) { quant = word(i); j = i + 1; } else if (['too', 'so', 'very'].includes(word(i)) && ['much', 'many', 'few'].includes(word(i + 1))) { quant = word(i) + ' ' + word(i + 1); j = i + 2; } /* NP-DEGREE-QUANT: "too much current" */
    /* NP-PARTITIVE (4.9.83): a quantifier with 'of' and a definite phrase takes a part of it ("most of the light", "some of my notes"); the head and
       number are the phrase's own */
    if (quant && !quant.includes(' ') && word(j) === 'of') for (const n of npBase(j + 1)) if ((n.node.det || n.node.owner) && n.node.head && !n.node.quant) out.push(R(Object.assign({}, n.node, { quant, partitive: true }), n.i, ['NP-PARTITIVE'].concat(n.rules)));
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
      /* NP-OF, chained (4.9.83): "a result of saturation of the air" — each 'of' phrase may take its own 'of' phrase (right-branching) */
      if (word(a.i) === 'of' && !a.node.pron && !a.node.pron3) (function ofs(i, depth) { const out = []; const gen = k => { const r = npGen(k); for (const b of r.slice()) if (b.node.head && !b.node.propn && !b.node.of && at(b.i, 'PROPN').length) for (const c of npGen(b.i)) if (c.node.propn && !c.node.det && !c.node.owner) r.push(R(Object.assign({}, c.node, { appos: b.node }), c.i, b.rules.concat(['NP-APPOSITION-CLOSE'], c.rules))); return r; }; /* 4.9.91: an of-phrase may be a close apposition ("of the genus Panthera") */ for (const b of gen(i)) { out.push(b); if (depth < 3 && word(b.i) === 'of' && !b.node.pron && !b.node.pron3) for (const c of ofs(b.i + 1, depth + 1)) out.push(R(Object.assign({}, b.node, { of: c.node }), c.i, b.rules.concat(['NP-OF'], c.rules))); } return out; })(a.i + 1, 1).forEach(b => res.push(R(Object.assign({}, a.node, { of: b.node }), b.i, a.rules.concat(['NP-OF'], b.rules))));
    }
    /* NP-APPOSITION-CLOSE (4.9.79; close apposition — samānādhikaraṇa, two nominals with one referent): a common-noun phrase directly followed by a
       proper name names that person or thing ("my cousin Lorna", "the engineer Sato"): the name is the head, the common phrase its description */
    for (const a of res.slice()) if (a.node.head && !a.node.propn && !a.node.pron && !a.node.pron3 && !a.node.of && at(a.i, 'PROPN').length && !(!a.node.det && !(a.node.adjs || []).length && a.node.head.length === 1 && at(a.i - 1, 'PROPN').length)) for (const b of npGen(a.i)) if (b.node.propn && !b.node.det && !b.node.owner) res.push(R(Object.assign({}, b.node, { appos: a.node }), b.i, a.rules.concat(['NP-APPOSITION-CLOSE'], b.rules)));
    /* NP-PARTICIPLE-POSTMOD (4.9.50; reduced relative): "chest pain radiating to the left arm" — an -ing phrase whose understood kartā is the head */
    for (const a of res.slice()) if (!a.node.pron && !a.node.pron3 && !a.node.indef && a.node.head) for (const c of vpNF(a.i, 'ing')) if (c.node.verb && c.node.verb.lemma !== 'be') res.push(R(Object.assign({}, a.node, { partRel: c.node }), c.i, a.rules.concat(['NP-PARTICIPLE-POSTMOD'], c.rules)));
    /* NP-PASSIVE-PARTICIPLE-POSTMOD (4.9.88): a reduced passive relative — past participle, an optional adverb, and its prepositional complement —
       modifies the noun ("a rock composed mostly of quartz", "a city founded in 1200") */
    for (const a of res.slice()) if (!a.node.pron && !a.node.pron3 && !a.node.indef && a.node.head && !a.node.partRel) for (const v of at(a.i, 'V')) { if (v.f !== 'pp' && v.f !== 'past') continue;
      const adv = at(a.i + 1, 'ADV').length && !at(a.i + 1, 'PREP').length ? 1 : 0, pi = a.i + 1 + adv; if (!at(pi, 'PREP').length) continue;
      for (const b of npGen(pi + 1)) res.push(R(Object.assign({}, a.node, { ppRel: { v: word(a.i), lemma: v.lemma, adv: adv ? word(a.i + 1) : null, prep: word(pi), np: b.node } }), b.i, a.rules.concat(['NP-PASSIVE-PARTICIPLE-POSTMOD'], b.rules))); }
    /* NP-PP-POSTMOD (4.9.50): a prepositional phrase merges into the noun phrase ("counsel for the defence"); G-ECONOMY prefers verb attachment when both derive */
    for (const a of res.slice()) if (!a.node.pron && !a.node.pron3 && (a.node.head || a.node.propn) && at(a.i, 'PREP').length && !['of', 'as', 'than'].includes(word(a.i)) && !a.node.partRel) for (const b of npGen(a.i + 1)) res.push(R(Object.assign({}, a.node, { pp: { prep: word(a.i), np: b.node } }), b.i, a.rules.concat(['NP-PP-POSTMOD'], b.rules)));
    const withRel = [];
    const relAgr = (n, v) => { const f = v.verb && v.verb.f, be = v.verb && v.verb.lemma === 'be'; if (!f || be || !n.head) return true; return f === 'pres3' ? !n.plural : f === 'pres' ? !!n.plural || !!n.conj : true; }; /* 4.9.91: a subject-gap relative agrees with its antecedent ("the system of networks that uses …" attaches to system) */
    if (!noRel) for (const a of res) if (['who', 'which', 'that'].includes(word(a.i)) && !a.node.pron) for (const v of vp(a.i + 1)) if (relAgr(a.node, v.node)) withRel.push(R(Object.assign({}, a.node, { rel: v.node }), v.i, a.rules.concat(['G-REL-SUBJ-GAP'], v.rules)));
    /* G-REL-WHOSE (4.9.96): a possessive relative — "whose" + possessed NP + VP — attaches to the antecedent; the possessed head is the relative's kartā ("a planet whose moons are large") */
    if (!noRel) for (const a of res) if (word(a.i) === 'whose' && !a.node.pron && !a.node.pron3) for (const n of np(a.i + 1, true)) for (const v of vp(n.i)) if (relAgr(n.node, v.node)) withRel.push(R(Object.assign({}, a.node, { relWhose: { possessed: n.node, vp: v.node } }), v.i, a.rules.concat(['G-REL-WHOSE'], n.rules, v.rules)));
    if (!noRel) for (const a of res) if (['who', 'whom', 'which', 'that'].includes(word(a.i)) && !a.node.pron && !a.node.pron3) for (const s2 of np(a.i + 1, true)) for (const v of vp(s2.i)) { const c = v.node; if (!c.verb || c.verb.lemma === 'be' || c.verb.voice || c.verb.nf || (c.roles && (c.roles.karma || c.roles.sampradana))) continue;
      const rc = JSON.parse(JSON.stringify(Object.assign({ subj: s2.node }, c))); delete rc.verb.f;
      if (at(v.i, 'PREP').length && !np(v.i + 1, true).length) withRel.push(R(Object.assign({}, a.node, { relObj: Object.assign(rc, { gap: 'adj', gapPrep: word(v.i) }) }), v.i + 1, a.rules.concat(['G-REL-OBJ-GAP-STRANDED-PREP'], s2.rules, v.rules)));
      else withRel.push(R(Object.assign({}, a.node, { relObj: Object.assign(rc, { gap: 'karma' }) }), v.i, a.rules.concat(['G-REL-OBJ-GAP'], s2.rules, v.rules))); }
    const all = res.concat(withRel);
    const co = []; for (const a of all) { const cw = word(a.i);
      /* NP-ELIDED-HEAD after a comma: "the fifth planet from the Sun, and the largest in the Solar System" */
      if (cw === ',' && ['and', 'or'].includes(word(a.i + 1)) && a.node.head && !a.node.conj && word(a.i + 2) === 'the' && at(a.i + 3, 'ADJ').some(x => x.f === 'sup') && !at(a.i + 4, 'N').length) { const op = word(a.i + 1), el = { det: 'the', head: [T[a.i + 3].w], elidedHead: a.node.head[a.node.head.length - 1] }, j = a.i + 4;
        co.push(R({ conj: [a.node, el], op, plural: op === 'and' }, j, a.rules.concat(['G-COORD-NP', 'NP-ELIDED-HEAD'])));
        if (at(j, 'PREP').length && !['as', 'than'].includes(word(j))) for (const b of npGen(j + 1)) co.push(R({ conj: [a.node, Object.assign({}, el, { pp: { prep: word(j), np: b.node } })], op, plural: op === 'and' }, b.i, a.rules.concat(['G-COORD-NP', 'NP-ELIDED-HEAD', 'NP-PP-POSTMOD'], b.rules))); }
      if (['and', 'or'].includes(cw)) { for (const b of np(a.i + 1, noRel)) if (!b.node.conj) co.push(R({ conj: [a.node, b.node], op: cw, plural: cw === 'and' }, b.i, a.rules.concat(['G-COORD-NP'], b.rules)));
        /* NP-ELIDED-HEAD (4.9.92; anuvṛtti — a word carried over from the earlier member): in a coordination, "the <superlative>" with no noun of its
           own takes the head of the first conjunct ("the fifth planet from the Sun and the largest in the Solar System" = the largest planet) */
        if (a.node.head && !a.node.conj && word(a.i + 1) === 'the' && at(a.i + 2, 'ADJ').some(x => x.f === 'sup') && !at(a.i + 3, 'N').length) { const el = { det: 'the', head: [T[a.i + 2].w], elidedHead: a.node.head[a.node.head.length - 1] }; const j = a.i + 3;
          co.push(R({ conj: [a.node, el], op: cw, plural: cw === 'and' }, j, a.rules.concat(['G-COORD-NP', 'NP-ELIDED-HEAD'])));
          if (at(j, 'PREP').length && !['as', 'than'].includes(word(j))) for (const b of npGen(j + 1)) co.push(R({ conj: [a.node, Object.assign({}, el, { pp: { prep: word(j), np: b.node } })], op: cw, plural: cw === 'and' }, b.i, a.rules.concat(['G-COORD-NP', 'NP-ELIDED-HEAD', 'NP-PP-POSTMOD'], b.rules))); } }
      else if (cw === ',' && !a.node.conj) for (const b of np(a.i + 1, noRel)) if (b.node.conj && !b.node.listed) {
        /* NP-APPOSITIVE-COUNT (4.9.81): a counted plural common noun followed, after a comma, by a list of exactly that many names is one phrase — the list
           names its members ("two sisters, Ola and Eva"); it is not a third and fourth conjunct */
        const NUMW = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }; const hd = a.node.head || [], an = hd.length > 1 && NUMW[hd[0]] ? Object.assign({}, a.node, { head: hd.slice(1), surface: (a.node.surface || []).slice(1), adjs: [hd[0]].concat(a.node.adjs || []) }) : a.node; /* a numeral read as a compound modifier is the count */
        const cnt = an.head && an.plural && !an.propn ? (an.adjs || []).concat(an.num ? [an.num] : []).map(x => NUMW[x] || (/^\d+$/.test(x) ? +x : 0)).find(Boolean) : 0;
        if (cnt && b.node.op === 'and' && b.node.conj.length === cnt && b.node.conj.every(x => x.propn)) { if (co.some(x => x.i === b.i && x.node.members && String(x.node.head) === String(an.head))) continue; co.push(R(Object.assign({}, an, { members: b.node }), b.i, a.rules.concat(['NP-APPOSITIVE-COUNT'], b.rules))); continue; }
        co.push(R({ conj: [a.node].concat(b.node.conj), op: b.node.op, plural: b.node.plural }, b.i, a.rules.concat(['G-COORD-NP-LIST'], b.rules))); }
      if (cw === ',' && !a.node.conj) for (const b of np(a.i + 1, true)) { if (b.node.conj || !!b.node.propn !== !!a.node.propn) continue; const items = [a.node, b.node]; let jj = b.i, rr = a.rules.concat(b.rules);
        while (word(jj) === ',' && items.length < 6) { if (['and', 'or'].includes(word(jj + 1))) { const op = word(jj + 1); for (const c of np(jj + 2, noRel)) if (!c.node.conj) co.push(R({ conj: items.concat([c.node]), op, plural: op === 'and', listed: true, serial: true }, c.i, rr.concat(['G-COORD-NP-SERIAL'], c.rules))); break; }
          const nx = np(jj + 1, true).find(x => !x.node.conj && !!x.node.propn === !!a.node.propn); if (!nx) break; items.push(nx.node); rr = rr.concat(nx.rules); jj = nx.i; } } }
    return all.concat(co);
  }
  // ---- adjuncts: PP / time ----
  const KARAKA = { to: 'sampradana', for: 'sampradana', with: 'karana', by: 'karana', from: 'apadana', in: 'adhikarana', on: 'adhikarana', at: 'adhikarana', near: 'adhikarana', into: 'adhikarana', under: 'adhikarana', over: 'adhikarana', about: 'vishaya', regarding: 'vishaya', concerning: 'vishaya', of: 'sambandha', after: 'kala', before: 'kala', during: 'kala', since: 'kala', until: 'kala', without: 'karana', through: 'adhikarana', across: 'adhikarana', around: 'adhikarana', between: 'adhikarana', behind: 'adhikarana', beside: 'adhikarana', onto: 'adhikarana', as: 'upadhi', past: 'adhikarana', per: 'sambandha', within: 'kala', throughout: 'kala', despite: 'vishaya', via: 'karana', toward: 'adhikarana', towards: 'adhikarana', upon: 'adhikarana', beyond: 'adhikarana', against: 'adhikarana', along: 'adhikarana', among: 'adhikarana', amid: 'adhikarana', inside: 'adhikarana', outside: 'adhikarana', below: 'adhikarana', above: 'adhikarana', beneath: 'adhikarana', underneath: 'adhikarana', versus: 'sambandha', 'because of': 'hetu', 'due to': 'hetu', 'out of': 'apadana', 'instead of': 'vishaya', 'according to': 'vishaya', 'prior to': 'kala', 'next to': 'adhikarana', 'ahead of': 'kala', 'apart from': 'apadana' };
  /* an open-class adverb is a word whose every lexical reading is ADV (no closed-class, noun or adjective reading: "home" stays a noun/adverb ambiguity for the existing rules) */
  const openAdv = j => j < T.length && T[j].an.length > 0 && T[j].an.some(x => x.tag === 'ADV' && x.rule !== 'TAG-CLOSED-ADV') && T[j].an.every(x => (x.tag === 'ADV' && x.rule !== 'TAG-CLOSED-ADV') || (x.tag === 'ADJ' && !lyAdv(T[j].w)) || x.rule === 'TAG-PROPN-INITIAL-ALT'); /* 4.9.50: an adverb that is also an adjective (overnight, early) is an adverb after the verb phrase, unless the language has a separate -ly adverb for it (sweet → sweetly: "something sweet" stays an adjective) */
  const lyAdv = w => { const f = /y$/.test(w) ? w.slice(0, -1) + 'ily' : /le$/.test(w) ? w.slice(0, -1) + 'y' : w + 'ly'; return !!(lex.hasPos && lex.hasPos(f, 'r')); };
  function adjuncts(i) {
    const res = [];
    (function go(j, list, rules) {
      res.push(R(list, j, rules));
      /* K-COMPLEX-PREP (4.9.50): a two-word preposition ("because of", "due to", "out of", "according to") governs the NP as one kāraka marker */
      if (j + 1 < T.length && KARAKA[word(j) + ' ' + word(j + 1)]) { const cp = word(j) + ' ' + word(j + 1); for (const n of np(j + 2, true)) go(n.i, list.concat([{ prep: cp, np: n.node, role: KARAKA[cp] }]), rules.concat(['K-COMPLEX-PREP'], n.rules)); }
      /* K-PREP-GERUND (4.9.50): a preposition governs a gerund phrase ("by subletting the flat", "after reviewing the scan") */
      if (at(j, 'PREP').length && !['of', 'to', 'as'].includes(word(j))) for (const c of vpNF(j + 1, 'ing')) go(c.i, list.concat([{ prep: word(j), ger: c.node, role: KARAKA[word(j)] || 'adhikarana' }]), rules.concat(['K-PREP-GERUND'], c.rules));
      const vOf = k => k >= 0 && at(k, 'V').length > 0 && !at(k, 'N').length && !at(k, 'ADJ').length && !['be', 'is', 'are', 'was', 'were', 'been'].includes(word(k - 1)); const ofV = word(j) === 'of' && j > 0 && (vOf(j - 1) || (openAdv(j - 1) && list.some(x => x.adv === word(j - 1)) && vOf(j - 2))); /* 4.9.87: a manner adverb may stand between the verb and its of-phrase ("consisting primarily of copper") */ /* K-PREP-VERB-OF (4.9.50): "complained of dizziness", "died of pneumonia": 'of' right after the verb is its vishaya */
      if (at(j, 'PREP').length && (word(j) !== 'of' || ofV)) for (const n of np(j + 1, true)) { const isTime = (n.node.head && n.node.head.length === 1 && TIMEW.has(n.node.head[0])) || (n.node.propn && TIMEW.has(n.node.propn.toLowerCase())) || (n.node.num && !n.node.head); const yearNP = !!(n.node.num && !n.node.head && /^(?:[1-9]\d{2,3})$/.test(String(n.node.num))); const role = yearNP && ['from', 'to', 'since', 'until', 'before', 'after', 'in', 'on', 'at'].includes(word(j)) ? 'kala' : isTime && ['on', 'at', 'in'].includes(word(j)) ? 'kala' : ofV ? 'vishaya' : KARAKA[word(j)] || 'adhikarana'; go(n.i, list.concat([{ prep: word(j), np: n.node, role }]), rules.concat(['K-' + role.toUpperCase() + '-' + word(j).toUpperCase()], n.rules)); } /* 4.9.98: a bare year after from/to/since/until is kāla, so "from 1775 to 1783" is one interval */
      if (j < T.length && (TIMEW.has(word(j)) && (at(j, 'ADV').length || at(j, 'N').length)) && !list.some(x => x.time === word(j))) go(j + 1, list.concat([{ time: word(j), role: 'kala' }]), rules.concat(['K-KALA-ADV']));
      /* K-PRAKARA-ADV (Doc5 kāraka: manner adjunct): an open-class adverb (lexicon POS r, not closed-class) attaches to the verb of the clause it is parsed in */
      if (j < T.length && openAdv(j) && !list.some(x => x.adv === word(j))) go(j + 1, list.concat([{ adv: word(j), role: 'prakara' }]), rules.concat(['K-PRAKARA-ADV']));
      if (['every', 'each'].includes(word(j)) && j + 1 < T.length && TIMEW.has(word(j + 1)) && !list.some(x => x.time === word(j) + ' ' + word(j + 1))) go(j + 2, list.concat([{ time: word(j) + ' ' + word(j + 1), role: 'kala' }]), rules.concat(['K-KALA-QUANT']));
      if (['last', 'next', 'this'].includes(word(j)) && j + 1 < T.length && TIMEW.has(word(j + 1))) go(j + 2, list.concat([{ time: word(j) + ' ' + word(j + 1), role: 'kala' }]), rules.concat(['K-KALA-DEICTIC']));
    })(i, [], []);
    return res;
  }
  // ---- verb group: (MOD|do|will) (not) V | COP (not) | V-ed/V-s ----
  /* a pre-verbal adverb (closed or open class, not a time word, not negation): "you ever get", "I often walk" — Merge with the verb group, kept as prakāra */
  const preAdv = j => j < T.length && at(j, 'ADV').length > 0 && !at(j, 'NEG').length && !TIMEW.has(word(j)) && !at(j, 'V').length && !['very', 'too', 'here', 'there'].includes(word(j));
  function vgroup(i) {
    const res = []; const w = word(i);
    const neg = j => (at(j, 'NEG').length ? { pol: 'neg', j: j + 1 } : { pol: 'pos', j });
    const pass = (j, base) => at(j, 'V').filter(v => (v.f === 'pp' || v.f === 'past') && ppSpelled(v.lemma, word(j))).map(v => R(Object.assign({ lemma: v.lemma, voice: 'passive', ppAdj: at(j, 'ADJ').length > 0 }, inflect(v.lemma, 'pp') !== word(j) ? { ppw: word(j) } : {}, base), j + 1, ['V-PASSIVE']));
    if (at(i, 'COP').length && !['be', 'been', 'being'].includes(w)) { const n = neg(i + 1); const tense = ['was', 'were'].includes(w) ? 'past' : 'present'; res.push(...pass(n.j, { tense, pol: n.pol, mod: 'asserted', form: w }).map(r => (n.pol === 'neg' ? Object.assign(r, { rules: r.rules.concat(['LL-NEG-PRED']) }) : r))); }
    if (at(i, 'COP').length) { const n = neg(i + 1); const tense = ['was', 'were'].includes(w) ? 'past' : 'present'; res.push(R({ cop: true, tense, pol: n.pol, mod: 'asserted', form: w }, n.j, ['V-COP-' + tense.toUpperCase()].concat(n.pol === 'neg' ? ['LL-NEG-PRED'] : [])));
      for (const v of at(n.j, 'V')) if (v.f === 'ing') res.push(R({ lemma: v.lemma, tense, aspect: 'progressive', pol: n.pol, mod: 'asserted' }, n.j + 1, ['V-PROGRESSIVE'].concat(n.pol === 'neg' ? ['LL-NEG-PRED'] : []))); }
    if (at(i, 'AUX').length && ['do', 'does', 'did'].includes(w)) { const n = neg(i + 1); for (const v of at(n.j, 'V')) if (v.f === 'base') res.push(R({ lemma: v.lemma, tense: w === 'did' ? 'past' : 'present', pol: n.pol, mod: 'asserted', dosupport: true }, n.j + 1, ['V-DO-SUPPORT'].concat(n.pol === 'neg' ? ['LL-NEG-PRED'] : [])));
      if (preAdv(n.j)) for (const v of at(n.j + 1, 'V')) if (v.f === 'base') res.push(R({ lemma: v.lemma, tense: w === 'did' ? 'past' : 'present', pol: n.pol, mod: 'asserted', dosupport: true, preAdv: [word(n.j)] }, n.j + 2, ['V-DO-SUPPORT', 'K-PRAKARA-ADV-PREVERBAL'].concat(n.pol === 'neg' ? ['LL-NEG-PRED'] : []))); }
    /* V-PERFECT-COPULA (4.9.82): "have / has / had (not) been" + predicate is the copula in the perfect ("Pavel has been sick") */
    if (['have', 'has', 'had'].includes(w)) { const n = neg(i + 1); if (word(n.j) === 'been') res.push(R({ cop: true, tense: w === 'had' ? 'past' : 'present', aspect: 'perfect', pol: n.pol, mod: 'asserted', form: w + ' been' }, n.j + 1, ['V-PERFECT-COPULA'].concat(n.pol === 'neg' ? ['LL-NEG-PRED'] : [])));
if (/^(all|both|each)$/.test(word(n.j)) && word(n.j + 1) === 'been') res.push(R({ cop: true, tense: w === 'had' ? 'past' : 'present', aspect: 'perfect', pol: n.pol, mod: 'asserted', form: w + ' ' + word(n.j) + ' been', fq: word(n.j) }, n.j + 2, ['V-PERFECT-COPULA-FQ'])); }
    if (at(i, 'AUX').length && ['have', 'has', 'had'].includes(w)) { const n = neg(i + 1); for (const v of at(n.j, 'V')) if (v.f === 'pp' || v.f === 'past') res.push(R({ lemma: v.lemma, tense: 'past', aspect: 'perfect', pol: n.pol, mod: 'asserted' }, n.j + 1, ['V-PERFECT'])); }
    /* possessive main verb “have” (Doc5 frame: possessor karta, possessed karma) — utsarga; the perfect auxiliary above is the apavāda when a participle follows */
    if (['have', 'has', 'had'].includes(w) && !at(i + 1, 'V').some(v => v.f === 'pp' || v.f === 'past')) res.push(R({ lemma: 'have', tense: w === 'had' ? 'past' : 'present', f: w === 'has' ? 'pres3' : w === 'had' ? 'past' : 'base', pol: 'pos', mod: 'asserted' }, i + 1, ['V-FINITE-HAVE-POSSESSIVE']));
    if (at(i, 'AUX').length && ['do', 'does', 'did'].includes(w)) { const n = neg(i + 1); if (word(n.j) === 'have') res.push(R({ lemma: 'have', tense: w === 'did' ? 'past' : 'present', pol: n.pol, mod: 'asserted', dosupport: true }, n.j + 1, ['V-DO-SUPPORT', 'V-HAVE-POSSESSIVE'].concat(n.pol === 'neg' ? ['LL-NEG-PRED'] : []))); }
    if (at(i, 'MOD').length) { const mod = { will: 'future', shall: 'future', would: 'conditional', might: 'possible', may: 'possible', could: 'possible', can: 'able', must: 'necessary', should: 'obligation' }[w]; const n = neg(i + 1);
      const fill = (tense, m) => ({ tense, mod: m, pol: n.pol });
      const f = mod === 'future' ? fill('future', 'asserted') : fill('present', mod);
      if (word(n.j) === 'be') res.push(...pass(n.j + 1, f).map(r => Object.assign(r, { rules: ['V-MODAL-' + mod.toUpperCase(), 'LL-MOD-VERB'].concat(r.rules) })));
      if (word(n.j) === 'be') { res.push(R(Object.assign({ cop: true, form: 'be' }, f), n.j + 1, ['V-MODAL-' + mod.toUpperCase(), 'LL-MOD-VERB'].concat(n.pol === 'neg' ? ['LL-NEG-PRED'] : []))); }
      for (const v of at(n.j, 'V')) if (v.f === 'base') res.push(R(Object.assign({ lemma: v.lemma }, f), n.j + 1, ['V-MODAL-' + mod.toUpperCase(), 'LL-MOD-VERB'].concat(n.pol === 'neg' ? ['LL-NEG-PRED'] : [])));
      if (preAdv(n.j)) for (const v of at(n.j + 1, 'V')) if (v.f === 'base') res.push(R(Object.assign({ lemma: v.lemma, preAdv: [word(n.j)] }, f), n.j + 2, ['V-MODAL-' + mod.toUpperCase(), 'LL-MOD-VERB', 'K-PRAKARA-ADV-PREVERBAL'].concat(n.pol === 'neg' ? ['LL-NEG-PRED'] : []))); }
    for (const v of at(i, 'V')) { if (['pres3', 'past', 'base'].includes(v.f)) res.push(R({ lemma: v.lemma, tense: v.f === 'past' ? 'past' : 'present', f: v.f, pol: 'pos', mod: 'asserted' }, i + 1, ['V-FINITE-' + v.f.toUpperCase(), v.rule])); }
    return res;
  }
  // ---- VP ----
  /* VERB FRAMES FROM THE LEXICON (4.9.48): a verb's complement frames are read from its WordNet 3.0 generic frames (lex.vframes); the small
     supplements below (FRAME_SUPP) only name frames WordNet omits for a lemma, so every frame a verb takes is a lexicon-class fact, never a per-sentence rule */
  const vfr = lemma => (lex.vframes ? lex.vframes(lemma) || [] : []);
  const somebody = n => !!(n && (n.pron || n.pron3 || n.propn || (n.head && lex.lexnameOf && /^noun\.(person|animal|group)$/.test(lex.lexnameOf(n.head[n.head.length - 1]) || ''))));
  const bareSg = n => !!(n && n.head && !n.plural && !n.det && !n.owner && !n.quant && !n.num && !(n.adjs || []).length && !n.propn && !n.pron);
  const takes = (lemma, kind) => { if (FRAME_SUPP[kind] && FRAME_SUPP[kind].has(lemma)) return true; const fr = vfr(lemma); if (!fr.length) return kind === 'dbl' || !!(SEED_FRAMES[kind] && SEED_FRAMES[kind].has(lemma)); return fr.some(f => FRAME_RE[kind].test(f)); };
  const licenses = (lemma, kind) => { const fr = lex.vframes ? lex.vframes(lemma) : []; return kind === 'inf' ? CTRL_INF.has(lemma) || takes(lemma, 'inf') : CTRL_GER.has(lemma) || takes(lemma, 'ger'); };
  function vpNF(j, form) { // non-finite VP (infinitive after "to", or gerund): no subject, no tense
    const gs = []; const nfw = form === 'base' ? 'inf' : 'ger';
    if (form === 'base' && word(j) === 'be') gs.push(R({ cop: true, tense: 'none', pol: 'pos', mod: 'asserted', nf: nfw }, j + 1, ['V-NONFINITE-INF']));
    if (form === 'ing' && word(j) === 'being') gs.push(R({ cop: true, tense: 'none', pol: 'pos', mod: 'asserted', nf: nfw }, j + 1, ['V-NONFINITE-GER']));
    for (const v of at(j, 'V')) if (v.f === form && v.lemma !== 'be') gs.push(R({ lemma: v.lemma, tense: 'none', pol: 'pos', mod: 'asserted', nf: nfw }, j + 1, ['V-NONFINITE-' + (nfw === 'inf' ? 'INF' : 'GER')]));
    if (form === 'ing' && ['and', 'or'].includes(word(j + 1))) for (const v of at(j, 'V')) if (v.f === 'ing' && v.lemma !== 'be') for (const v2 of at(j + 2, 'V').concat(!at(j + 2, 'V').length && at(j + 2, 'UNK').length && /^[a-z]{3,}ing$/.test(word(j + 2)) ? [{ f: 'ing', lemma: word(j + 2).slice(0, -3) }] : [])) if (v2.f === 'ing' && v2.lemma !== 'be') gs.push(R({ lemma: v.lemma, coordLemma: v2.lemma, coordOp: word(j + 1), tense: 'none', pol: 'pos', mod: 'asserted', nf: nfw }, j + 3, ['V-GER-COORD']));
    return vp(j, gs); }
  function vp(i, groups) {
    const res = [];
    for (const g of groups || vgroup(i)) {
      const v = g.node; const nf = v.nf ? { nf: v.nf } : {};
      if (v.cop) {
        const preds = [];
        const adjs = []; (function go(j, ws, rules) { for (const a of at(j, 'ADJ')) { if (a.f === 'cmp' || a.f === 'sup') continue; const ws2 = ws.concat([a.lemma === T[j].w ? a.lemma : T[j].w]); preds.push(R({ type: 'adj', words: ws2 }, j + 1, rules.concat(['P-ADJ']))); if (['and', 'or'].includes(word(j + 1))) go(j + 2, ws2.concat([word(j + 1)]), rules.concat(['G-COORD-ADJ'])); } })(g.i, [], []); if (at(g.i, 'ADV').length && !at(g.i, 'NEG').length && !at(g.i, 'V').length && at(g.i + 1, 'ADJ').some(a => a.f !== 'cmp' && a.f !== 'sup')) preds.push(R({ type: 'adj', words: [word(g.i), word(g.i + 1)], deg: word(g.i) }, g.i + 2, ['P-ADJ-DEGREE'])); /* P-ADJ-DEGREE (4.9.50): a degree adverb before the predicate adjective (very / too / extremely shallow) */
        // comparatives: ADJ-er than NP | more/less ADJ than NP ; superlatives: the ADJ-est | the most ADJ
        if (/^\d+(\.\d+)?$/.test(word(g.i)) && /^(years?|months?|weeks?|days?|metres?|meters?|feet|foot|inches?|centimetres?|centimeters?|cm|km|kilometres?|kilometers?|miles?|kg|kilograms?|pounds?)$/.test(word(g.i + 1)) && /^(old|tall|long|wide|high|deep|heavy|away|far)$/.test(word(g.i + 2))) preds.push(R({ type: 'adj', words: [word(g.i), word(g.i + 1), word(g.i + 2)], measure: true }, g.i + 3, ['P-MEASURE-ADJ']));
        for (const a of at(g.i, 'ADJ')) if (a.f === 'cmp' && word(g.i + 1) === 'than') for (const n of np(g.i + 2, true)) preds.push(R({ type: 'cmp', adj: a.lemma, degree: 'more', surface: [T[g.i].w], than: n.node }, n.i, ['P-COMPARATIVE-SYNTHETIC'].concat(n.rules)));
        if (['more', 'less'].includes(word(g.i))) for (const a of at(g.i + 1, 'ADJ')) if (a.f === 'pos' && word(g.i + 2) === 'than') for (const n of np(g.i + 3, true)) preds.push(R({ type: 'cmp', adj: a.lemma, degree: word(g.i), surface: [word(g.i), T[g.i + 1].w], than: n.node }, n.i, ['P-COMPARATIVE-PERIPHRASTIC'].concat(n.rules)));
        /* 4.9.61 ruling 3: bare 'more / less / fewer than NP' is a comparative of its own (world_rules.js names it greater_than / less_than) */
        if (['more', 'less', 'fewer'].includes(word(g.i)) && word(g.i + 1) === 'than' && !at(g.i, 'ADJ').some(a => a.f === 'cmp')) for (const n of np(g.i + 2, true)) preds.push(R({ type: 'cmp', adj: word(g.i), degree: 'more', surface: [word(g.i)], than: n.node }, n.i, ['P-COMPARATIVE-BARE'].concat(n.rules)));
        if (word(g.i) === 'the') { for (const a of at(g.i + 1, 'ADJ')) if (a.f === 'sup') preds.push(R({ type: 'sup', adj: a.lemma, degree: 'most', surface: [T[g.i + 1].w] }, g.i + 2, ['P-SUPERLATIVE-SYNTHETIC']));
          if (['most', 'least'].includes(word(g.i + 1))) for (const a of at(g.i + 2, 'ADJ')) if (a.f === 'pos') preds.push(R({ type: 'sup', adj: a.lemma, degree: word(g.i + 1) === 'most' ? 'most' : 'least', surface: [word(g.i + 1), T[g.i + 2].w] }, g.i + 3, ['P-SUPERLATIVE-PERIPHRASTIC'])); }
        /* P-ADJ-INFINITIVE: ADJ to V… — the lexical class decides the reading(s); a karma reading needs the infinitive's own karma slot empty (the gap);
           "to be V-en" (passive infinitive) gives only the karma reading */
        for (const a of at(g.i, 'ADJ')) { const cls = ADJ_INF[a.lemma]; if (!cls || a.f !== 'pos' || word(g.i + 1) !== 'to') continue;
          if (word(g.i + 2) === 'be') for (const pv of at(g.i + 3, 'V')) { if (!((pv.f === 'pp' || pv.f === 'past') && ppSpelled(pv.lemma, word(g.i + 3))) || cls === 'subj') continue; preds.push(R({ type: 'adjinf', words: [T[g.i].w], inf: { verb: { lemma: pv.lemma, tense: 'none', pol: 'pos', mod: 'asserted', nf: 'inf', voice: 'passive' }, roles: {}, adj: [] }, ctrl: 'karma' }, g.i + 4, ['P-ADJ-INFINITIVE', 'K-KARMA-PASSIVE-INFINITIVE'])); }
          for (const c of vpNF(g.i + 2, 'base')) { const cv = c.node; if (!cv.verb || cv.verb.lemma === 'be') continue; const hasK = !!(cv.roles && (cv.roles.karma || cv.roles.sampradana));
            if (cls !== 'karma') preds.push(R({ type: 'adjinf', words: [T[g.i].w], inf: cv, ctrl: 'karta' }, c.i, ['P-ADJ-INFINITIVE', 'K-KARTA-CONTROL'].concat(c.rules)));
            if (cls !== 'subj' && !hasK && (!lex.vframes || (lex.vframes(cv.verb.lemma) || []).some(f => /somebody|something/.test(f) && !/^Something ----s$|^Somebody ----s$/.test(f)) || !(lex.vframes(cv.verb.lemma) || []).length)) preds.push(R({ type: 'adjinf', words: [T[g.i].w], inf: cv, ctrl: 'karma' }, c.i, ['P-ADJ-INFINITIVE', 'K-KARMA-GAP'].concat(c.rules))); } }
        /* P-ADJ-OF (Merge: an adjective takes an of-complement — "afraid of the dark", "proud of her work") */
        for (const p of preds.slice()) if (p.node.type === 'adj' && p.node.words.length === 1 && word(p.i) === 'of') for (const n of np(p.i + 1, true)) preds.push(R(Object.assign({}, p.node, { of: n.node }), n.i, p.rules.concat(['P-ADJ-OF'], n.rules)));
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
            res.push(R({ verb: Object.assign({ lemma: 'be', tense: v.tense, pol: v.pol, mod: v.mod }, nf, v.aspect ? { aspect: v.aspect } : {}), pred: p.node, adj: a.node }, a.i, g.rules.concat(p.rules, a.rules))); } }
        continue;
      }
      if (v.voice === 'passive') { // kartā is the by-phrase (if any); the surface subject is the karma (Doc5)
        /* V-PASSIVE-PARTICLE (Doc5 kāraka; Pāṇini paper L2736–2751): a phrasal verb keeps its particle in the passive ("was rolled back"); a particle that is
           also a preposition is read as the particle only at clause end; an adjective takes no particle, so the stative apavāda yields to it */
        let pj = g.i, ppart = null; if (at(pj, 'PART').length && (!at(pj, 'PREP').length || pj + 1 >= T.length || word(pj + 1) === ',')) { ppart = word(pj); pj++; }
        for (const a of adjuncts(pj)) { const by = a.node.findIndex(x => x.prep === 'by'); if (by < 0 && v.ppAdj && !ppart) continue; /* P-ADJ-PARTICIPLE-APAVADA: stative adjective reading wins without an agent */
          const roles = by >= 0 ? { karta: a.node[by].np } : {}; const adj = a.node.filter((x, k) => k !== by);
          res.push(R({ verb: Object.assign({ lemma: v.lemma, tense: v.tense, pol: v.pol, mod: v.mod, voice: 'passive' }, ppart ? { particle: ppart } : {}, v.form ? { form: v.form } : {}, v.ppw ? { ppw: v.ppw } : {}), roles, adj }, a.i, g.rules.concat(ppart ? ['V-PASSIVE-PARTICLE'] : [], a.rules, by >= 0 ? ['K-KARTA-PASSIVE-AGENT'] : ['K-KARTA-PASSIVE-IMPLICIT']))); }
        /* K-KARMA-RETAINED (4.9.82): the passive of a two-object verb (WordNet frame 'Somebody ----s somebody something': "they call the dog Rex")
           promotes the first object to subject and keeps the second as karma ("the dog is called Rex") */
        if (!ppart && takes(v.lemma, 'dbl')) for (const o of np(g.i, true)) for (const a of adjuncts(o.i)) { const by = a.node.findIndex(x => x.prep === 'by'); const roles = Object.assign({ karma: o.node }, by >= 0 ? { karta: a.node[by].np } : {});
          res.push(R({ verb: Object.assign({ lemma: v.lemma, tense: v.tense, pol: v.pol, mod: v.mod, voice: 'passive' }, v.form ? { form: v.form } : {}, v.ppw ? { ppw: v.ppw } : {}), roles, adj: a.node.filter((x, k) => k !== by) }, a.i, g.rules.concat(['K-KARMA-RETAINED'], o.rules, a.rules))); }
        continue; }
      const objs = [R({}, g.i, [])];
      const gerOK = licenses(v.lemma, 'ger') && at(g.i, 'V').some(x => x.f === 'ing');
      /* K-KARMA-GERUND-BARE (4.9.82): a transitive verb (WordNet frame '----s something') takes a bare gerund with no object of its own as its karma —
         the action noun ("smoke causes coughing", "ice cream causes drowning"); only when the -ing word has no noun reading and closes the phrase */
      if (!gerOK && !at(g.i, 'N').length && takes(v.lemma, 'tr') && (g.i + 1 >= T.length || at(g.i + 1, 'PREP').length || /^[,.?!;]$/.test(word(g.i + 1)))) for (const x of at(g.i, 'V')) if (x.f === 'ing') { objs.push(R({ karma: { adjs: [], head: [word(g.i)], plural: false, surface: [word(g.i)] } }, g.i + 1, ['K-KARMA-GERUND-BARE'])); break; } const infOK = licenses(v.lemma, 'inf') && word(g.i) === 'to' && (at(g.i + 1, 'V').some(x => x.f === 'base') || word(g.i + 1) === 'be');
      for (const o of np(g.i, true)) { if (gerOK && o.node.surface && /ing$/.test(o.node.surface[0])) continue; /* K-GERUND-APAVADA */ objs.push(R({ karma: o.node }, o.i, ['K-KARMA'].concat(o.rules))); /* K-SAMPRADANA-DOUBLE-OBJECT needs the lexicon frame 'Somebody ----s somebody something' (4.9.50: "reviewed her notes" is one karma) */ { const dbl = takes(v.lemma, 'dbl'), bare = !dbl && takes(v.lemma, 'bareinf') && at(o.i, 'V').some(a => a.f === 'base') && (o.node.pron || o.node.pron3 || o.node.propn || somebody(o.node)); /* 4.9.82: the frame's first object is a 'somebody' (pronoun, name or WordNet noun.person): "has an extractor fan" is one karma */ /* the bare-infinitive frame ('Somebody ----s somebody INFINITIVE': saw her duck) keeps the second reading open */ if (dbl || bare) for (const o2 of np(o.i, true)) if ((dbl || o2.i === o.i + 1) && !(dbl && !bare && bareSg(o2.node) && !somebody(o.node))) /* 4.9.82: a bare singular second object needs a 'somebody' first object ("has an extractor fan" is one NP) */ objs.push(R({ sampradana: o.node, karma: o2.node }, o2.i, ['K-SAMPRADANA-DOUBLE-OBJECT', 'K-KARMA'].concat(o.rules, o2.rules))); } }
      if (['that'].includes(word(g.i)) || (takes(v.lemma, 'clause') && (!lex.vclasses || !lex.vclasses(v.lemma).length || lex.vclasses(v.lemma).some(c => c === 'verb.cognition' || c === 'verb.communication')))) for (const c of clause(word(g.i) === 'that' ? g.i + 1 : g.i)) if (!(c.node.subj && c.node.subj.feats && c.node.subj.feats.c === 'acc') && !(word(g.i) !== 'that' && bareSg(c.node.subj) && at(g.i, 'ADJ').length)) /* 4.9.91: a that-less complement clause does not open with a bare word that is also an adjective — it modifies the object ("provides active acquired immunity") */ /* a finite clause has a nominative subject ("feel her toes" is no clause) */ objs.push(R({ karma: { clause: c.node } }, c.i, ['K-KARMA-CLAUSE'].concat(c.rules)));
      /* K-SAMPRADANA-CLAUSE: a saying verb takes an addressee and a that-clause ("I told you that …") */
      if (takes(v.lemma, 'addressee_clause')) for (const o of np(g.i, true)) if (word(o.i) === 'that') for (const c of clause(o.i + 1)) objs.push(R({ sampradana: o.node, karma: { clause: c.node } }, c.i, ['K-SAMPRADANA-CLAUSE'].concat(o.rules, c.rules)));
      if (infOK) for (const c of vpNF(g.i + 1, 'base')) objs.push(R({ karma: { inf: c.node } }, c.i, ['K-KARMA-INFINITIVE'].concat(c.rules)));
      if (gerOK) for (const c of vpNF(g.i, 'ing')) objs.push(R({ karma: { ger: c.node } }, c.i, ['K-KARMA-GERUND'].concat(c.rules)));
      /* K-KARMA-CONTROL-INF (4.9.50; WordNet frame 24 "Somebody ----s somebody to INFINITIVE"): the karma controls the infinitive ("advised the client to remain silent") */
      if (!v.nf && takes(v.lemma, 'objinf')) for (const o of np(g.i, true)) if (word(o.i) === 'to') for (const c of vpNF(o.i + 1, 'base')) objs.push(R({ karma: o.node, prayojana: { inf: c.node } }, c.i, ['K-KARMA', 'K-KARMA-CONTROL-INF'].concat(o.rules, c.rules)));
      /* K-PRAYOJANA-PURPOSE-INF (4.9.79; Aṣṭādhyāyī 3.3.10 tumun for an action done for the sake of another action): any transitive verb's
         karma may be followed by a purpose infinitive whose kartā is the clause's kartā ("find a way to cool the room", "build a ramp to reach the shelf") */
      if (!v.nf && !takes(v.lemma, 'objinf')) for (const o of np(g.i, true)) if (word(o.i) === 'to' && o.node.head && !o.node.pron && !o.node.pron3) for (const c of vpNF(o.i + 1, 'base')) if (c.node.verb && c.node.verb.lemma !== 'be') objs.push(R({ karma: o.node, prayojana: { inf: c.node, purpose: true } }, c.i, ['K-KARMA', 'K-PRAYOJANA-PURPOSE-INF'].concat(o.rules, c.rules)));
      /* K-VIDHEYA-ADJ (Doc5 kāraka; WordNet frames 6/7 "Somebody ----s Adjective"): an experiencer / linking verb merges with an adjective phrase
         that predicates of its kartā ("I feel tired", "the soup tastes cold"); the frame class decides, not the word */
      /* K-KARMA-WH-INF (4.9.81; WordNet frame 29 "Somebody ----s whether INFINITIVE"): a cognition / communication verb (or one of that frame)
         takes a wh-infinitive as its karma ("choose what to say", "decide where to go"); K-KARMA-FREE-RELATIVE: a transitive verb takes a free
         relative "what S" whose S lacks its karma ("store what I say") */
      if (/^(what|where|how|when|whether|which|who)$/.test(word(g.i)) && word(g.i + 1) === 'to' && (vfr(v.lemma).some(f => /whether INFINITIVE$|that CLAUSE$|to INFINITIVE$/.test(f)) || (lex.vclasses && lex.vclasses(v.lemma).slice(0, 2).some(c => c === 'verb.cognition' || c === 'verb.communication')))) for (const c of vpNF(g.i + 2, 'base')) objs.push(R({ karma: { whinf: { wh: word(g.i), inf: c.node } } }, c.i, ['K-KARMA-WH-INF'].concat(c.rules)));
      if (word(g.i) === 'what' && !v.nf && (!lex.vframes || vfr(v.lemma).some(f => /----s something$/.test(f)))) for (const c of clause(g.i + 1, true)) if (c.node && !c.node.coord && c.node.verb && !(c.node.roles && c.node.roles.karma) && c.node.subj && (c.node.subj.pron || c.node.subj.pron3 || c.node.subj.propn || c.node.subj.head) && vfr(c.node.verb.lemma).some(f => /----s something$/.test(f))) objs.push(R({ karma: { freerel: { wh: 'what', clause: c.node } } }, c.i, ['K-KARMA-FREE-RELATIVE'].concat(c.rules)));
      /* K-KARMA-VIDHEYA (4.9.80; WordNet frame 5 "Something ----s something Adjective/Noun"): a verb of that frame takes a karma and an adjective
         predicated of the karma — the karma's resulting or kept state ("keep the greenhouse warm", "made the paint dry"); the frame decides, not the word */
      if (takes(v.lemma, 'objadj')) for (const o of np(g.i, true)) if (o.node.head || o.node.pron || o.node.propn || o.node.pron3) for (const a of at(o.i, 'ADJ')) { if (a.f === 'sup' || (at(o.i, 'N').length && at(o.i + 1, 'N').length)) continue; objs.push(R({ karma: o.node, vidheya: { adjp: [T[o.i].w], of: 'karma' } }, o.i + 1, ['K-KARMA', 'K-KARMA-VIDHEYA'].concat(o.rules))); }
      let vidOnly = -1; if (takes(v.lemma, 'adj')) (function go(j, ws, rules) { for (const a of at(j, 'ADJ')) { if (a.f === 'cmp' || a.f === 'sup' || at(j, 'N').length && at(j + 1, 'N').length) continue; if (at(j, 'N').length && lex.vframes1 && lex.vframes1(v.lemma).length && (!lex.vframes1(v.lemma).some(f => FRAME_RE.adj.test(f)) || lex.vframes1(v.lemma).some(f => /----s something$/.test(f)))) continue; /* K-VIDHEYA-APAVADA: a word that is also a noun is the karma when the verb's first sense takes a karma (or no adjective) */
          if (at(j, 'N').length && j === g.i) vidOnly = j + 1; /* …and when the first sense takes an adjective but no karma, the adjective reading blocks the bare-noun karma of the same word */ const ws2 = ws.concat([T[j].w]); objs.push(R({ vidheya: { adjp: ws2 } }, j + 1, rules.concat(['K-VIDHEYA-ADJ']))); if (['and', 'or'].includes(word(j + 1))) go(j + 2, ws2.concat([word(j + 1)]), rules); } })(g.i, [], []);
      if (vidOnly > 0) for (let k = objs.length - 1; k >= 0; k--) { const o = objs[k]; if (o.i === vidOnly && o.node.karma && o.node.karma.head && o.node.karma.head.length === 1 && !o.node.karma.det && !o.node.karma.owner && !o.node.karma.quant && !(o.node.karma.adjs || []).length) objs.splice(k, 1); }
      if (word(g.i) === ',' && at(g.i + 1, 'QUOTE').length) objs.push(R({ karma: { quote: at(g.i + 1, 'QUOTE')[0].lemma } }, g.i + 2, ['K-KARMA-QUOTE-DIRECT-SPEECH']));
      /* V-PARTICLE-PREPOSED (Doc5 kāraka; particle verbs): "picked up the box" — the particle stands before the karma; same verb+particle as "picked the box up" */
      if (at(g.i, 'PART').length && !at(g.i, 'PREP').length) for (const o of np(g.i + 1, true)) objs.push(Object.assign(R({ karma: o.node }, o.i, ['V-PARTICLE-PREPOSED', 'K-KARMA'].concat(o.rules)), { part: word(g.i) }));
      for (const o of objs) {
        let j = o.i, part = o.part || null; if (!part && at(j, 'PART').length && !(j + 1 < T.length && KARAKA[word(j) + ' ' + word(j + 1)])) { part = word(j); j++; } /* a two-word preposition is not a particle */
        for (const a of adjuncts(j)) { if (o.node.karma && o.node.karma.clause && a.node.length) continue; /* K-CLAUSE-LATE-CLOSURE: material after a that-complement closes inside the lowest clause (structural, not a choice) */
          if (infOK && !o.node.karma && a.node[0] && a.node[0].prep === 'to' && j === g.i) continue; /* K-INFINITIVE-APAVADA: licensed "to V" is a complement, not a PP */
          res.push(R({ verb: Object.assign({ lemma: v.lemma, tense: v.tense, pol: v.pol, mod: v.mod }, v.aspect ? { aspect: v.aspect } : {}, part ? { particle: part } : {}, v.f ? { f: v.f } : {}, nf, v.coordLemma ? { coordLemma: v.coordLemma, coordOp: v.coordOp } : {}), roles: o.node, adj: (v.preAdv || []).map(x => ({ adv: x, role: 'prakara', pre: true })).concat(a.node) }, a.i, g.rules.concat(o.rules, a.rules))); }
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
    for (const s of np(i)) for (const v of vp(s.i).concat(preAdv(s.i) ? vp(s.i + 1).filter(x => x.node.verb && !x.node.verb.nf).map(x => R(Object.assign({}, x.node, { adj: [{ adv: word(s.i), role: 'prakara', pre: true }].concat(x.node.adj || []) }), x.i, ['K-PRAKARA-ADV-PREVERBAL'].concat(x.rules))) : [],
      /* LL-NEG-NEVER (4.9.50, Doc3 §15 negation scope): pre-verbal "never" negates the finite verb over all times — polarity neg, realized as "never" */
      word(s.i) === 'never' ? vp(s.i + 1).filter(x => x.node.verb && !x.node.verb.nf && x.node.verb.pol === 'pos' && !x.node.verb.dosupport && x.node.verb.lemma !== 'be').map(x => R(Object.assign({}, x.node, { verb: Object.assign({}, x.node.verb, { pol: 'neg', never: true }) }), x.i, ['LL-NEG-NEVER'].concat(x.rules))) : [],
      /* Q-FLOAT (4.9.82): a floating quantifier after the subject ("X and Y both rise", "the boys all left") quantifies the subject; "both" needs
         a two-member coordination, "all / each" a coordination or a plural */
      ((word(s.i) === 'both' && s.node.conj && s.node.op === 'and') || (/^(all|each)$/.test(word(s.i)) && (s.node.conj || s.node.plural))) ? vp(s.i + 1).filter(x => x.node.verb && !x.node.verb.nf).map(x => R(Object.assign({}, x.node, { adj: [{ adv: word(s.i), role: 'prakara', pre: true, float: true }].concat(x.node.adj || []) }), x.i, ['Q-FLOAT'].concat(x.rules))) : [])) {
      const f = v.node.verb && v.node.verb.f; if ((f === 'base' && sg3(s.node)) || (f === 'pres3' && !sg3(s.node))) continue; // LL-AGREEMENT (subject–verb concord)
      const times = (v.node.adj || []).filter(a => a.time).map(a => a.time).join(' '); const tn = v.node.verb && v.node.verb.tense;
      if (tn && ((/\b(yesterday|last)\b/.test(times) && tn !== 'past') || (/\b(tomorrow|next)\b/.test(times) && tn === 'past'))) continue; // LL-TENSE-KALA-CONCORD
      const c = Object.assign({ subj: s.node }, v.node); res.push(R(c, v.i, s.rules.concat(['K-KARTA'], v.rules, f ? ['LL-AGREEMENT'] : [], times ? ['LL-TENSE-KALA-CONCORD'] : [])));
      /* G-COORD-VP (4.9.50; Merge of two predicates under one kartā): "the radiologist reviewed the scan and found a small lesion" — two clauses
         sharing the subject; the second is realized without repeating it */
      if (['and', 'but', 'or'].includes(word(v.i)) && v.node.verb && !v.node.verb.nf) for (const v2 of vp(v.i + 1)) { const f2 = v2.node.verb && v2.node.verb.f; if (!v2.node.verb || v2.node.verb.nf || (f2 === 'base' && sg3(s.node)) || (f2 === 'pres3' && !sg3(s.node))) continue;
        res.push(R({ coord: [c, Object.assign({ subj: s.node, sharedSubj: true }, v2.node)], op: word(v.i) }, v2.i, s.rules.concat(['K-KARTA'], v.rules, ['G-COORD-VP'], v2.rules))); }
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
  /* PARTIAL (4.9.48; graceful structure, Merge bottom-up): when no derivation spans the whole sentence, the best-scoring partial structure is kept instead of
     failing — the longest clause from the left edge (kartā + verb + its kāraka roles), else the longest kartā NP, else the longest verb phrase. The score is
     the number of words the structure covers, then the number of roles it fills. The uncovered words are reported as the unattached span, and the missing
     constituent (verb or kartā) is named so the reply can ask for exactly that piece. */
  function partial() { const n = T.length; let best = null; const roleN = c => Object.keys(c.roles || {}).length + (c.adj || []).length + (c.pred ? 1 : 0);
    const keep = (cand) => { if (!best || cand.i > best.i || (cand.i === best.i && cand.score > best.score)) best = cand; };
    for (const c of clause(0)) if (c.i < n && !c.node.coord) keep({ kind: 'clause', node: c.node, i: c.i, score: roleN(c.node), rules: c.rules });
    if (!best) { for (const s of np(0)) if (s.i <= n) keep({ kind: 'np', node: s.node, i: s.i, score: 0, rules: s.rules, missing: T.slice(s.i).some(t => t.an.some(a => a.tag === 'V' || a.tag === 'COP' || a.tag === 'AUX' || a.tag === 'MOD')) ? null : 'verb' });
      if (!['COP', 'AUX', 'MOD'].some(t => at(0, t).length)) for (const v of vp(0)) if (v.i <= n && v.i > 0) keep({ kind: 'vp', node: v.node, i: v.i, score: roleN(v.node), rules: v.rules, missing: 'subject' }); }
    if (!best) return { kind: 'none', i: 0, rest: [0, n], missing: null };
    return Object.assign(best, { rest: best.i < n ? [best.i, n] : null }); }
  return { T, np, vp, vpNF, clause, sentence, adjuncts, fronted, at, word, partial };
}
/* ---------- generation (inverse) ---------- */
function npText(n, persp) {
  if (!n) return '';
  if (n.conj) { const parts = n.conj.map(x => npText(x, persp)); return parts.length > 2 ? parts.slice(0, -1).join(', ') + (n.serial ? ',' : '') + ' ' + n.op + ' ' + parts[parts.length - 1] : parts.join(' ' + n.op + ' '); }
  if (n.boundOrig) return npText(n.boundOrig, persp); /* REF-BOUND-LOCAL: a structurally bound pronoun is realized as the pronoun */
  if (n.pron === 'user') return persp === 'user' ? 'I' : 'you'; if (n.pron === 'kernel') return persp === 'user' ? 'you' : 'I';
  if (n.members) return npText(Object.assign({}, n, { members: undefined }), persp) + ', ' + npText(n.members, persp); /* NP-APPOSITIVE-COUNT */
  if (n.pron3) return n.pron3; if (n.indef) return n.indef + (n.adjs && n.adjs.length ? ' ' + n.adjs.join(' ') : ''); if (n.propn) return (n.appos ? npText(n.appos, persp) + ' ' : '') + n.propn + (n.of ? ' of ' + npText(n.of, persp) : '') + (n.pp ? ' ' + n.pp.prep + ' ' + (n.pp.np.pron ? objText(n.pp.np, persp) : npText(n.pp.np, persp)) : ''); /* 4.9.90: a name's of-phrase is said ("the Treaty of Versailles") */ /* NP-APPOSITION-CLOSE: the description, then the name */ if (n.quote !== undefined) return '"' + n.quote + '"';
  let s = '';
  if (n.quant) s += n.quant + (n.partitive ? ' of ' : ' ');
  if (n.owner === 'user') s += persp === 'user' ? 'my ' : 'your '; else if (n.owner === 'kernel') s += persp === 'user' ? 'your ' : 'my '; else if (n.owner && n.owner.pron3) s += n.owner.pron3 + ' '; else if (n.owner && n.owner.boundOrig) s += n.owner.boundOrig.pron3 + ' '; else if (n.owner) s += npText(n.owner, persp) + "'s ";
  if (n.det) s += n.det + ' ';
  if (n.num) s += n.num + (n.head ? ' ' : '');
  if (n.adjs && n.adjs.length) s += n.adjs.join(' ') + ' ';
  if (n.head) s += (n.surface || n.head).join(' ');
  if (n.of) s += ' of ' + npText(n.of, persp);
  if (n.pp) s += ' ' + n.pp.prep + ' ' + (n.pp.np.pron ? objText(n.pp.np, persp) : npText(n.pp.np, persp)); if (n.partRel) s += ' ' + nfText(n.partRel, persp); if (n.ppRel) s += ' ' + n.ppRel.v + (n.ppRel.adv ? ' ' + n.ppRel.adv : '') + ' ' + n.ppRel.prep + ' ' + npText(n.ppRel.np, persp);
  if (n.rel) s += (n.propn || (n.head && n.head.some(h => FEMALE.has(h) || MALE.has(h) || PERSONISH.has(h))) ? ' who ' : ' that ') + vpText(n.rel, n, persp);
  if (n.relWhose) s += ' whose ' + npText(n.relWhose.possessed, persp) + ' ' + vpText(n.relWhose.vp, n.relWhose.possessed, persp); /* G-REL-WHOSE */
  if (n.relObj) s += ' that ' + clauseText(n.relObj, persp) + (n.relObj.gapPrep ? ' ' + n.relObj.gapPrep : '');
  return s.trim();
}
function agree(subj) { if (!subj) return 'pres3'; if (subj.pron === 'user') return 'pres1'; if (subj.pron === 'kernel') return 'pres'; if (subj.conj && subj.op === 'and') return 'pres'; if (subj.pron3) return ['they', 'we'].includes(subj.pron3) ? 'pres' : 'pres3'; if (subj.plural) return 'pres'; return 'pres3'; }
function nfText(c, persp) { // non-finite VP: "to buy a car" / "reading books"
  const v = c.verb; const head = v.lemma === 'be' ? (v.nf === 'inf' ? 'to be ' : 'being ') + predText(c.pred, persp) : (v.nf === 'inf' ? 'to ' + v.lemma : inflect(v.lemma, 'ing') + (v.coordLemma ? ' ' + v.coordOp + ' ' + inflect(v.coordLemma, 'ing') : '')) + (v.particle ? ' ' + v.particle : '');
  return head + rolesText(c.roles || {}, persp) + adjText(c, persp); }
function rolesText(r, persp) { if (r.vidheya && r.vidheya.of === 'karma' && r.karma) return ' ' + objText(r.karma, persp) + ' ' + r.vidheya.adjp.join(' '); if (r.vidheya) return ' ' + r.vidheya.adjp.join(' '); if (r.prayojana && r.karma) return ' ' + objText(r.karma, persp) + ' ' + nfText(r.prayojana.inf, persp); if (r.sampradana && r.karma) return ' ' + objText(r.sampradana, persp) + ' ' + objText(r.karma, persp); if (r.karma) return ' ' + objText(r.karma, persp); return ''; }
function adjText(c, persp) { let s = ''; for (const a of c.adj || []) if (!a.pre) s += a.ger ? ' ' + a.prep + ' ' + nfText(a.ger, persp) : a.adv ? ' ' + a.adv : a.time ? ' ' + a.time : ' ' + a.prep + ' ' + (a.np.pron ? objText(a.np, persp) : npText(a.np, persp)); return s; }
const PAST_IS_OTHER_LEMMA = new Set(['saw', 'found', 'wound', 'ground', 'felt', 'fell', 'lay', 'bound', 'rent', 'flew']);
function vpText(c, subj, persp) {
  const v = c.verb; const ag = agree(subj); const persUser = subj && subj.pron === 'user'; let vs;
  const neg = v.pol === 'neg' && !v.never;
  const MODW = { possible: 'might', able: 'can', necessary: 'must', obligation: 'should', conditional: 'would' };
  if (v.nf) return nfText(c, persp);
  if (v.voice === 'passive') { let be; if (v.tense === 'future') be = 'will' + (neg ? ' not' : '') + ' be'; else if (v.mod && v.mod !== 'asserted') be = MODW[v.mod] + (neg ? (v.mod === 'able' ? 'not' : ' not') : '') + ' be';
    else if (v.aspect === 'perfect') be = (v.tense === 'past' ? 'had' : ag === 'pres3' ? 'has' : 'have') + (neg ? ' not' : '') + ' been';
    else { if (v.tense === 'past') be = (ag === 'pres' || (ag === 'pres1' && persp === 'kernel')) ? 'were' : 'was'; else be = ag === 'pres3' ? 'is' : ag === 'pres1' ? (persp === 'user' ? 'am' : 'are') : 'are'; if (persUser && persp === 'kernel') be = v.tense === 'past' ? 'were' : 'are'; if (subj && subj.pron === 'kernel' && persp === 'kernel') be = v.tense === 'past' ? 'was' : 'am'; if (neg) be += ' not'; }
    { const pa = (c.adj || []).filter(a => a.pre && a.adv).map(a => a.adv); if (pa.length) { const t = be.split(' '); be = [t[0]].concat(pa, t.slice(1)).join(' '); } }
    return be + ' ' + (v.ppw || inflect(v.lemma, 'pp')) /* the participle keeps the spelling it was read in */ + (v.particle ? ' ' + v.particle : '') + (c.roles && c.roles.karma ? ' ' + objText(c.roles.karma, persp) : '') /* K-KARMA-RETAINED */ + (c.roles && c.roles.karta ? ' by ' + objText(c.roles.karta, persp) : '') + adjText(c, persp); }
  if (v.lemma === 'be') {
    let cop; if (v.tense === 'future') cop = 'will' + (neg ? ' not' : '') + ' be'; else if (v.mod !== 'asserted') cop = MODW[v.mod] + (neg ? (v.mod === 'able' ? 'not' : ' not') : '') + ' be';
    else { if (v.tense === 'past') cop = (ag === 'pres' || (ag === 'pres1' && persp === 'kernel')) ? 'were' : 'was'; else cop = ag === 'pres3' ? 'is' : ag === 'pres1' ? (persp === 'user' ? 'am' : 'are') : 'are'; if (persUser && persp === 'kernel') cop = v.tense === 'past' ? 'were' : 'are'; if (subj && subj.pron === 'kernel' && persp === 'kernel') cop = v.tense === 'past' ? 'was' : 'am'; /* LL-AGREEMENT: Forge speaking of itself is first person */ if (neg) cop += ' not'; }
    if (v.aspect === 'perfect' && v.mod === 'asserted' && v.tense !== 'future') cop = (v.tense === 'past' ? 'had' : ag === 'pres3' ? 'has' : 'have') + (neg ? ' not' : '') + ' been';
    vs = cop + ' ' + predText(c.pred, persp);
  } else {
    const base = v.lemma; const part = v.particle ? ' ' + v.particle : '';
    if (v.tense === 'future') vs = 'will' + (neg ? ' not ' : ' ') + base;
    else if (v.mod && v.mod !== 'asserted') vs = MODW[v.mod] + (neg ? (v.mod === 'able' ? 'not ' : ' not ') : ' ') + base;
    else if (v.aspect === 'progressive') { const be = v.tense === 'past' ? (ag === 'pres3' || (ag === 'pres1' && persp === 'user') ? 'was' : 'were') : (ag === 'pres3' ? 'is' : (ag === 'pres1' && persp === 'user') || (subj && subj.pron === 'kernel' && persp === 'kernel') ? 'am' : 'are'); vs = be + (neg ? ' not ' : ' ') + inflect(base, 'ing'); }
    else if (v.aspect === 'perfect') vs = (ag === 'pres3' ? 'has' : 'have') + (neg ? ' not ' : ' ') + inflect(base, 'pp');
    else if (neg) vs = (v.tense === 'past' ? 'did' : ag === 'pres3' ? 'does' : 'do') + ' not ' + base;
    else if (v.tense === 'past' && ag !== 'pres3' && !c.resolved_reading && PAST_IS_OTHER_LEMMA.has(inflect(base, 'past')) && !(c.adj || []).some(a => a.role === 'kala')) vs = 'did ' + base; /* v4.9.36: a 3sg subject already rules out the homograph (she saws ≠ she saw); a reading the user chose keeps its own surface (Echo masks it) */ // GEN-PAST-HOMOGRAPH-DO: past form is itself another verb lemma in WordNet (saw, found, felt…) → do-support keeps the realization single-derivation (Echo)
    else if (!c.resolved_reading && !(c.adj || []).some(a => a.role === 'kala') && inflect(base, 'past') === (ag === 'pres3' ? inflect(base, 'pres3') : base)) vs = (v.tense === 'past' ? 'did' : ag === 'pres3' ? 'does' : 'do') + ' ' + base; // GEN-TENSE-DISAMBIG-DO: past ≡ present surface (read, put, cut…) → emphatic do-support so the realization re-derives to exactly one tense (Echo)
    else vs = v.tense === 'past' ? inflect(base, 'past') : ag === 'pres3' ? inflect(base, 'pres3') : base;
    vs += part;
    vs += rolesText(c.roles || {}, persp);
  }
  const pre = (v.never ? ['never'] : []).concat((c.adj || []).filter(a => a.pre && a.adv).map(a => a.adv)); if (pre.length) { const t = vs.split(' '); const aux = /^(cannot|will|would|can|could|shall|should|may|might|must|do|does|did|has|have|had|is|are|am|was|were)$/.test(t[0]) && t.length > 1 && (v.lemma === 'be' || v.voice === 'passive' || ![c.verb.lemma, inflect(c.verb.lemma, 'pres3'), inflect(c.verb.lemma, 'past')].includes(t[0]) || t[1] === 'not'); const k = aux ? (t[1] === 'not' ? 2 : 1) : 0; vs = t.slice(0, k).concat(pre, t.slice(k)).join(' '); } /* a pre-verbal adverb stays before the main verb */
  return vs + adjText(c, persp);
}
function objText(o, persp) { if (o.clause) return 'that ' + clauseText(o.clause, persp); if (o.whinf) return o.whinf.wh + ' ' + nfText(o.whinf.inf, persp); if (o.freerel) return 'what ' + clauseText(o.freerel.clause, persp); if (o.inf || o.ger) return nfText(o.inf || o.ger, persp); if (o.quote !== undefined && o.direct) return ', "' + o.quote + '"'; const t = npText(o, persp); return o.pron === 'user' ? (persp === 'user' ? 'me' : 'you') : o.pron === 'kernel' ? (persp === 'user' ? 'you' : 'me') : t; }
function predText(p, persp) { if (p.type === 'adj' || p.type === 'adv') return p.words.join(' ') + (p.of ? ' of ' + objText(p.of, persp) : ''); if (p.type === 'adjinf') return p.words.join(' ') + ' ' + (p.inf.verb.voice === 'passive' ? 'to be ' + inflect(p.inf.verb.lemma, 'pp') + adjText(p.inf, persp) : nfText(p.inf, persp)); if (p.type === 'cmp') return (p.surface || [p.degree === 'less' ? 'less' : 'more', p.adj]).join(' ') + ' than ' + objText(p.than, persp); if (p.type === 'sup') return 'the ' + (p.surface || [p.degree, p.adj]).join(' '); if (p.type === 'np') return npText(p.np, persp); return p.prep + ' ' + npText(p.np, persp); }
function clauseText(c, persp) {
  let body; /* 4.9.91: a coordination keeps its subordinate clause and condition ("… and creates a demand deposit while making loans") */
  if (c.coord && c.coord.some(x => x.sharedSubj)) body = c.coord.map(x => (x.sharedSubj ? vpText(x, x.subj, persp) : clauseText(x, persp))).join(' ' + (c.op || 'and') + ' ');
  else if (c.coord) body = c.coord.map(x => clauseText(x, persp)).join(', and ');
  else body = npText(c.subj, persp) + ' ' + vpText(c, c.subj, persp);
  if (c.sub) body = c.sub.pre ? c.sub.conj + ' ' + clauseText(c.sub.clause, persp) + ', ' + body : body + ' ' + c.sub.conj + ' ' + clauseText(c.sub.clause, persp);
  return c.cond ? 'if ' + clauseText(c.cond, persp) + ', ' + body : body;
}
/* canonical material meaning (for Echo comparison) */
function material(x) { return JSON.parse(JSON.stringify(x, (k, v) => (v && typeof v === 'object' && v.boundOrig ? v.boundOrig : ['rules', 'surface', 'f', 'form', 'dosupport', 'sense', 'resolvedFrom', 'plural', 'resolved_reading', 'front', 'indefinite', 'group'].includes(k) ? undefined : v))); }
const api = { ADJ_INF, FRAME_SUPP, SEED_FRAMES, IRRV, IRRF, IRRNP, IRRN, dbl, CLOSED, CL, PRON, TIMEW, FEMALE, MALE, PERSONISH, NAMEISH, SUBW, CTRL_INF, CTRL_GER, learnExc, splitSentences, tokenize, analyse, analyseAll, lemmatize, inflect, Parser, npText, clauseText, vpText, material };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KGrammar = api;
})(this);
