(function (root) {
const isNode = typeof module !== 'undefined' && module.exports;
const G = isNode ? require('./grammar.js') : root.KGrammar;
const M = isNode ? require('./kmath.js') : root.KMath;
const words = s => s.split(' ');

const VERBS = new Set(words('change tag link match forget recover schedule explore keep archive spawn hibernate restore use render pass match index replay start arrive notice run report set unlock lock be have do tell note know remember forget move keep store seal answer ask mean read say define follow reveal open add solve factor verify find use understand authorize ' +
  'confirm conflict infer reinforce replace show calculate need refer name pick rephrase run call write browse exist hold reach lead list start reset recognise derive support depend decide determine explain count state cite ' +
  'give make quote assert guess display admit receive record require check contain compute round agree hide mention choose see stop mark archive report apply block want type issue ' +
  'resolve compile lose leave go look come cover try work restate pass fail differentiate integrate divide convert reduce acknowledge refuse substitute expand simplify measure enter unlock lock ' +
  'count close accept state remove bypass exclude save memorise memorize repeat echo print output delete erase send email text buy post share suppose imagine approve restore retain record log recall preserve explain identify diagnose infer recognize recognise adapt improve revise correct avoid predict generalize generalise apply adjust transfer learn master establish support weaken differ cause'));
const MODALS = { can: { past: 'could' }, should: {}, must: {}, may: { past: 'might' } };
const NOUNS = new Set(words('tag link memory reminder time device branch candidate fact scene feed item intervention sample agent task status turn form check answer symbol body hash preview replay tool topic page result excerpt pattern evidence repository file passphrase vault tab fact note word sense way reading record storage value source time date unit solution equation system variable expression factorization quotient division zero identity statement ' +
  'request rule validation step gender inference kernel model capability register command file lexicon entry receipt chain drift turn flag loop simulation backend gate result device reason question ' +
  'memory meaning manifest thing polynomial degree root decimal rational answer sentence structure form prototype compiler language binding integral derivative number evidence authority action ' +
  'definition term project frame referent version phone build plan status history conflict transition phase operator quantity reply list example band delivery text part run lane report hold ' +
  'failure relation sign code divisor limit limitation vault passphrase secret tab chat screen discriminant interval fraction function context confirmation suite detail quarantine hypothesis approval case cause premise claim formula move change world proof decision derivation checker'));
const IRR_PL = { capability: 'capabilities', entry: 'entries', identity: 'identities', quantity: 'quantities', history: 'histories', memory: 'memories', reply: 'replies', inference: 'inferences', hypothesis: 'hypotheses' };
const ADJ = new Set(words('other open admitted bounded drift echo preview final recorded best deterministic language stored sensitive earlier new right cold real approximate exact irrational welcome incomplete malformed valid single definite linear polynomial authorized ' +
  'evidence external different false independent unknown active legacy refusal audit last drift grace simulation desktop phone ProtoForge Forge meaning sentence supported free broken project ' +
  'several online simplified expanded controlled local encrypted locked unlocked hidden empty inconsistent advisory disabled clarification echo missing possible sealed family WordNet dream limited correct same additional checked complete'));
const PREVERB_ADV = new Set(['also', 'only', 'still', 'already', 'never', 'no-longer', 'now']);
const POSTVERB_ADV = new Set(['further', 'again', 'exactly', 'normally', 'unambiguously', 'here', 'yet', 'first', 'locally']);
const PARTICLES = new Set(['yes', 'no', 'partly', 'hello', 'goodbye', 'please']);
const SCONJ = new Set(['but', 'so', 'or', 'then']);
const DETS = new Set(['a', 'the', 'no', 'every', 'any', 'both', 'this', 'that', 'those', 'which', 'its', 'my', 'your', 'their']);
const SAMP_PR = new Set(['I', 'you', 'they']); const ADDRESSEE_VERBS = new Set(['ask', 'tell', 'show', 'give']);
const ROLE_VERBS = { apeksha: ['depend'], upamana: ['record'], domain: ['factor'], sthana: ['close'] };
const PP_ADJ = new Set();
const INF_VERBS = new Set(['ask', 'authorize', 'say', 'open', 'want']); const NOUN_INF = new Set(['request']);
const POSS = new Set(['its', 'my', 'your', 'their']);
const PRON = { I: { nom: 'I', acc: 'me', p: 1, n: 'sg' }, you: { nom: 'you', acc: 'you', p: 2, n: 'pl' }, it: { nom: 'it', acc: 'it', p: 3, n: 'sg' }, they: { nom: 'they', acc: 'them', p: 3, n: 'pl' },
  that: { nom: 'that', acc: 'that', p: 3, n: 'sg' }, anything: { nom: 'anything', acc: 'anything', p: 3, n: 'sg' }, something: { nom: 'something', acc: 'something', p: 3, n: 'sg' }, nothing: { nom: 'nothing', acc: 'nothing', p: 3, n: 'sg' }, everything: { nom: 'everything', acc: 'everything', p: 3, n: 'sg' },
  anyone: { nom: 'anyone', acc: 'anyone', p: 3, n: 'sg' }, someone: { nom: 'someone', acc: 'someone', p: 3, n: 'sg' }, noone: { nom: 'noone', acc: 'noone', p: 3, n: 'sg' }, everyone: { nom: 'everyone', acc: 'everyone', p: 3, n: 'sg' }, anybody: { nom: 'anybody', acc: 'anybody', p: 3, n: 'sg' }, somebody: { nom: 'somebody', acc: 'somebody', p: 3, n: 'sg' }, nobody: { nom: 'nobody', acc: 'nobody', p: 3, n: 'sg' }, everybody: { nom: 'everybody', acc: 'everybody', p: 3, n: 'sg' }, why: { nom: 'why', acc: 'why', p: 3, n: 'sg' } };
const FORM2PRON = {}; for (const [k, v] of Object.entries(PRON)) { (FORM2PRON[v.nom] = FORM2PRON[v.nom] || []).push({ pr: k, c: 'nom' }); if (v.acc !== v.nom) (FORM2PRON[v.acc] = FORM2PRON[v.acc] || []).push({ pr: k, c: 'acc' }); }
const NAMES = { 'Identity Vault': 'vault', 'permission service': 'service', 'Context Library tab': 'tab', WordNet: 'lexicon', Echo: 'validator', Forge: 'system', EchoForge: 'lane', 'Recursive Manifest Compiler': 'compiler',
  'Forge Bidirectional Language Kernel': 'kernel', 'Doc 9': 'document', 'Forge Mobile': 'system', 'RMC Memory tab': 'tab' };
const NAME_LIST = Object.keys(NAMES).sort((a, b) => b.split(' ').length - a.split(' ').length);
const ROLE_PREP = { visaya: 'about', adhikarana: 'in', karana: 'with', apadana: 'from', gati: 'to', tadartha: 'for', hetu: 'by', domain: 'over', apeksha: 'on', sthana: 'at', purva: 'before', paschat: 'after', upamana: 'as' };
const ON_NOUNS = new Set(['turn', 'tab', 'screen', 'device', 'phone']); const AT_NOUNS = new Set(['time']);
const PREP_ROLES = {}; for (const [r, p] of Object.entries(ROLE_PREP)) (PREP_ROLES[p] = PREP_ROLES[p] || []).push(r); PREP_ROLES.on.push('adhikarana'); PREP_ROLES.at.push('adhikarana');
const ROLE_ORDER = ['visaya', 'gati', 'apadana', 'karana', 'adhikarana', 'domain', 'apeksha', 'sthana', 'tadartha', 'upamana', 'purva', 'paschat', 'hetu'];
const MENTIONS = {
  remember: 'remember that my sister lives in Paris', recall: 'where does my sister live?', note: 'note: buy milk', math: 'what is 12 * (3 + 4)?', solve: 'solve x^2 - 5x + 6 = 0', define: 'define bank',
  forget: 'forget that my car is red', remember_ellipsis: 'remember that …', solve_for: 'solve for x …', infer: 'is my dog an animal?' };

const SECTIONS = { 1: { phase: 1, name: 'saṃjñā / selection' }, 2: { phase: 2, name: 'kāraka → vibhakti' }, 3: { phase: 3, name: 'lakāra (dhātoḥ)' }, 4: { phase: 4, name: 'utsarga–apavāda resolution' },
  6: { phase: 6, name: 'repair (do-support, agreement)' }, 7: { phase: 7, name: 'affixation (tiṅ / sup analogue)' }, 8: { phase: 8, name: 'linearization and sandhi' }, 9: { phase: 9, name: 'marker deletion' }, M: { phase: 7, name: 'math notation' } };
const RULES = {}; const rule = (id, name) => { RULES[id] = { id, name, sec: id.split('.')[0] }; };
rule('1.1.1', 'dhātu insertion: the MSM predicate supplies the verbal root'); rule('1.1.2', 'prātipadika insertion: a nominal stem for each role filler'); rule('1.1.3', 'sarvanāma: speaker → I, addressee → you, anaphor → it / they');
rule('1.1.4', 'nipāta: a discourse particle (yes / no / hello / goodbye / please) from the speech act'); rule('1.1.5', 'uddhāraṇa: mentioned material is kept verbatim inside “ ”');
rule('1.1.6', 'sub-derivation: a user clause or NP is realized by grammar.js (the inward grammar)'); rule('1.1.7', 'symbol atom: a formula, value or symbol is carried unchanged');
rule('2.1.1', 'kartari prathamā: in active voice the kartā is the subject'); rule('2.1.2', 'karmaṇi (apavāda of 2.1.1): in passive voice the karman is the subject');
rule('2.1.3', 'pronoun case: the subject takes the nominative form'); rule('2.1.4', 'pronoun case: a non-subject takes the accusative form');
rule('2.2.1', 'vibhakti: an adjunct role is marked by its preposition (utsarga table)'); rule('2.2.2', 'apavāda of 2.2.1: adhikaraṇa of turn / tab / screen / device → "on"'); rule('2.2.3', 'apavāda of 2.2.1: adhikaraṇa of time → "at"');
rule('2.2.4', 'sampradāna is marked "to" (utsarga)'); rule('2.2.5', 'apavāda of 2.2.4: a pronominal sampradāna stays bare before a karman or complement, or after an addressee root (ask / tell / show / give)');
rule('2.2.6', 'sambandha: a genitive dependent is marked "of"'); rule('2.3.1', 'negation scope: "not" follows the first element of the verb group');
rule('3.1.1', 'laṭ / laṅ (utsarga): the finite verb takes present or past tense'); rule('3.1.2', 'lṛṭ (apavāda of 3.1.1): future → will + bare root'); rule('3.1.3', 'modal (apavāda of 3.1.1, 3.1.2): modal + bare root; past → could / would / might');
rule('3.1.4', 'perfect: have + past participle'); rule('3.1.5', 'passive: be + past participle'); rule('3.1.6', 'progressive: be + -ing participle'); rule('3.1.7', 'copula: be + predicate');
rule('3.2.1', 'question: the first auxiliary inverts with the subject'); rule('3.2.2', 'imperative: no subject, bare root'); rule('3.2.3', 'wh-fronting: an interrogative karman moves to the front');
rule('3.2.4', 'infinitive: to + bare root (not to + root when negated)');
rule('4.1.1', 'vipratiṣedhe paraṃ kāryam: of two applicable rules, the later one wins'); rule('4.1.2', 'apavāda blocks utsarga: a specific rule blocks the general rule it is an exception to');
rule('6.1.1', 'do-support (Φ6 correction): a negated or questioned lexical verb without an auxiliary takes "do"'); rule('6.1.2', 'agreement: the first finite element agrees with the subject in person and number');
rule('6.1.3', 'suppletion: be → am / is / are / was / were'); rule('6.1.4', 'irregular past / participle (apavāda of 7.1.2)'); rule('6.1.5', 'irregular plural (apavāda of 7.2.1)');
rule('7.1.1', 'tiṅ 3sg present: root + s⟨3sg⟩'); rule('7.1.2', 'past / participle: root + ed⟨kta⟩'); rule('7.1.3', 'present participle: root + ing⟨śatṛ⟩'); rule('7.2.1', 'sup plural: stem + s⟨pl⟩');
rule('7.3.1', 'morphophonemics: s → es after a sibilant or o'); rule('7.3.2', 'morphophonemics: consonant + y → i before an affix'); rule('7.3.3', 'morphophonemics: final e drops before -ed / -ing');
rule('7.3.4', 'morphophonemics: a final consonant doubles after a single stressed vowel'); rule('7.4.1', 'number agreement: a numeral other than 1 makes the head plural');
rule('8.1.1', 'word order: subject, verb group, objects, predicate, adjuncts, complement'); rule('8.1.2', 'adjunct order follows the kāraka sequence'); rule('8.1.3', 'a list is extraposed to the end of its clause after ":"');
rule('8.1.4', 'a fronted adjunct or particle is followed by a comma'); rule('8.1.5', 'a sentence-initial connective (but / so / or) opens the sentence');
rule('8.2.1', 'article sandhi: a → an before a vowel sound'); rule('8.2.2', 'sandhi: can + not → cannot'); rule('8.3.1', 'the first letter of the sentence is capitalized'); rule('8.3.2', 'final punctuation from force: "." or "?"');
rule('8.3.3', 'coordination: two items with and / or; more items with commas'); rule('8.3.4', 'numbered list: (n) item; items separated by ";"');
rule('9.1.1', 'marker deletion: internal ⟨…⟩ markers are removed before the surface (cf. 1.3.9 tasya lopaḥ)');
rule('M.1.1', 'relation: exact equality → "="'); rule('M.1.2', 'apavāda of M.1.1: an approximate value → "≈"'); rule('M.1.3', 'implication: an equation and its solution set are joined by "⇒"');
rule('M.1.4', 'disjunction of solutions → "or"'); rule('M.1.5', 'conjunction of equations or solutions → "and"'); rule('M.1.6', 'subsumption chain (WordNet hypernyms) → "⊑"'); rule('M.1.7', 'excluded value (domain restriction) → "≠"');
const cmpId = (a, b) => { const f = s => s.split('.').map(v => (isNaN(v) ? v.charCodeAt(0) : +v)); const x = f(a), y = f(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };
function Deriv() { const log = [], trail = [], comps = [];
  const apply = (id, note, blocked) => { const r = RULES[id]; if (!r) throw new Error('unknown sūtra ' + id); const ph = SECTIONS[r.sec].phase; log.push({ id, phase: 'Φ' + ph, adhikara: '§' + r.sec + ' ' + SECTIONS[r.sec].name, rule: r.name, note: note === undefined ? undefined : String(note), blocked: blocked && blocked.length ? blocked : undefined }); trail.push(ph); return id; };
  const choose = (cands, note) => { const ok = cands.filter(c => c.when); if (!ok.length) return null; const blockedBy = new Set(); for (const c of ok) for (const b of c.apavada_of || []) blockedBy.add(b);
    let live = ok.filter(c => !blockedBy.has(c.id)); const blocked = ok.filter(c => blockedBy.has(c.id)).map(c => c.id);
    if (blocked.length) apply('4.1.2', blocked.join(', ') + ' blocked by apavāda');
    if (live.length > 1) { const later = live.slice().sort((a, b) => cmpId(b.id, a.id)); apply('4.1.1', later.slice(1).map(c => c.id).join(', ') + ' yield to ' + later[0].id); live = [later[0]]; }
    apply(live[0].id, note, blocked); return live[0]; };
  const compose = (a, b, ph) => { if (comps.length < 60) comps.push((a || '∅') + ' ⊕[Φ' + ph + '] ' + b); };
  return { log, trail, comps, apply, choose, compose }; }

const DBL_EXTRA = new Set(['admit', 'refer', 'occur', 'prefer', 'commit', 'submit', 'permit', 'control', 'omit']);
const NO_DBL = new Set(['open', 'answer', 'differ', 'enter', 'offer', 'happen', 'listen', 'visit', 'limit', 'edit', 'credit', 'travel', 'cover', 'deliver', 'consider', 'order', 'gather', 'number', 'register', 'filter', 'alter', 'render', 'wonder', 'echo', 'email']);
const dbl = w => !NO_DBL.has(w) && (DBL_EXTRA.has(w) || G.dbl(w));
function verbForm(D, root, f) {
  if (f === 'base') return root;
  if (root === 'be') { D && D.apply('6.1.3', 'be → ' + f); return { s: 'is', past: 'was', pp: 'been', ing: 'being' }[f]; }
  if (f === 's') { if (root === 'have') { D && D.apply('6.1.4', 'have + s⟨3sg⟩ → has'); return 'has'; }
    D && D.apply('7.1.1', root + ' + s⟨3sg⟩'); if (/[^aeiou]y$/.test(root)) { D && D.apply('7.3.2', root); return root.slice(0, -1) + 'ies'; } if (/(s|x|z|ch|sh|o)$/.test(root)) { D && D.apply('7.3.1', root); return root + 'es'; } return root + 's'; }
  if (f === 'past' || f === 'pp') { const irr = G.IRRV[root]; if (irr) { D && D.apply('6.1.4', root + ' + ed⟨kta⟩ → ' + irr[f]); return irr[f]; }
    D && D.apply('7.1.2', root + ' + ed⟨kta⟩'); if (/e$/.test(root)) { D && D.apply('7.3.3', root); return root + 'd'; } if (/[^aeiou]y$/.test(root)) { D && D.apply('7.3.2', root); return root.slice(0, -1) + 'ied'; }
    if (dbl(root)) { D && D.apply('7.3.4', root); return root + root.slice(-1) + 'ed'; } return root + 'ed'; }
  if (f === 'ing') { D && D.apply('7.1.3', root + ' + ing⟨śatṛ⟩'); if (/ie$/.test(root)) return root.slice(0, -2) + 'ying'; if (/[^e]e$/.test(root) && root !== 'be' && root !== 'see') { D && D.apply('7.3.3', root); return root.slice(0, -1) + 'ing'; } if (dbl(root)) { D && D.apply('7.3.4', root); return root + root.slice(-1) + 'ing'; } return root + 'ing'; }
  return root; }
function plural(D, n) { const irr = IRR_PL[n] || (G.IRRNP && G.IRRNP[n]); if (irr) { D && D.apply('6.1.5', n + ' → ' + irr); return irr; } D && D.apply('7.2.1', n + ' + s⟨pl⟩');
  if (/[^aeiou]y$/.test(n)) { D && D.apply('7.3.2', n); return n.slice(0, -1) + 'ies'; } if (/(s|x|z|ch|sh)$/.test(n)) { D && D.apply('7.3.1', n); return n + 'es'; } return n + 's'; }
const vowelSound = w => { const l = String(w).replace(/^[“"(]/, '').toLowerCase(); if (/^(hour|honest|honour|honor)/.test(l)) return true; if (/^(uni|use|usu|uti|one|once|eu)/.test(l)) return false; if (/^[0-9]/.test(l)) return /^(8|11|18)/.test(l); return /^[aeiou]/.test(l); };
const MATHY = w => /[\d^=+\-*/()√∛∜_ΦεχλΘ⟁÷×∫±₀-₉]/.test(w) || /^[a-z]{1,2}$/.test(w) || /^(sin|cos|tan|exp|log|ln|sqrt)$/.test(w);
const GENWORD = w => { const l = w.toLowerCase(); return VERBS.has(l) || NOUNS.has(l) || ADJ.has(l) || DETS.has(l) || l === 'an' || PARTICLES.has(l) || SCONJ.has(l) || !!ROLE_PREP[l] || !!PREP_ROLES[l] || !!FORM2PRON[l] || !!MODALS[l] || l === 'cannot' || l === 'not' || l === 'to' || PREVERB_ADV.has(l) || l === 'before' || /^(is|are|am|was|were|has|had|does|did|could|would|might)$/.test(l); };

function Realizer(env) {
  env = env || {}; const userNP = env.npText || (n => G.npText(n, 'kernel')); const userClause = env.clauseText || (c => G.clauseText(c, 'kernel'));
  const isVerb = r => VERBS.has(r);
  function personOf(x) { if (!x) return { p: 2, n: 'pl' }; if (x.pr) return PRON[x.pr]; if (x.coord) return x.coord === 'and' ? { p: 3, n: 'pl' } : personOf(x.items[x.items.length - 1]);
    if (x.n) return { p: 3, n: x.pl || (x.cnt !== undefined && Number(x.cnt) !== 1) ? 'pl' : 'sg' }; if (x.num !== undefined) return { p: 3, n: Number(x.num) === 1 ? 'sg' : 'pl' };
    if (x.u) { const u = x.u; if (u.pron === 'user') return { p: 2, n: 'pl' }; if (u.pron === 'kernel') return { p: 1, n: 'sg' }; return { p: 3, n: u.plural || (u.conj && u.op === 'and') ? 'pl' : 'sg' }; }
    return { p: 3, n: 'sg' }; }
  function np(D, x, role, out) {
    if (x.pr) { const c = role === 'subj' ? 'nom' : 'acc'; D.apply('1.1.3', x.pr); D.apply(c === 'nom' ? '2.1.3' : '2.1.4', x.pr + ' → ' + PRON[x.pr][c]); out.push(PRON[x.pr][c]); return; }
    if (x.coord) { D.apply('8.3.3', x.coord + ' × ' + x.items.length); x.items.forEach((it, i) => { if (i > 0) { if (x.items.length > 2 && i < x.items.length - 1) out[out.length - 1] += ','; else { if (x.items.length > 2) out[out.length - 1] += ','; out.push(x.coord); } } np(D, it, role, out); }); return; }
    if (x.m !== undefined) { D.apply('1.1.5', x.m); out.push('“' + x.m + '”'); return; }
    if (x.x !== undefined) { D.apply('1.1.7', x.x); out.push(...String(x.x).split(' ')); return; }
    if (x.stamp !== undefined) { D.apply('1.1.7', 'time stamp'); out.push('[' + x.stamp + ']'); return; }
    if (x.u) { D.apply('1.1.6', 'NP'); out.push(...userNP(x.u).split(' ')); return; }
    if (x.ut !== undefined) { D.apply('1.1.6', 'NP'); out.push(...String(x.ut).split(' ')); return; }
    if (x.name) { D.apply('1.1.2', 'name ' + x.name); if (x.det) out.push(x.det); out.push(...x.name.split(' ')); return; }
    if (x.num !== undefined) { D.apply('1.1.7', 'numeral ' + x.num); out.push(String(x.num)); if (x.of) { D.apply('2.2.6'); out.push('of'); np(D, x.of, 'obj', out); } return; }
    if (!NOUNS.has(x.n)) throw new Error('derive: no nominal stem "' + x.n + '"'); D.apply('1.1.2', x.n);
    const start = out.length;
    if (x.poss) out.push(x.poss); else if (x.det) out.push(x.det); if (x.cnt !== undefined) out.push(String(x.cnt));
    for (const a of x.adj || []) { if (!ADJ.has(a)) throw new Error('derive: no adjective "' + a + '"'); out.push(a); }
    const pl = x.pl || (x.cnt !== undefined && Number(x.cnt) !== 1); if (x.cnt !== undefined && Number(x.cnt) !== 1) D.apply('7.4.1', x.cnt + ' ' + x.n);
    const head = pl ? plural(D, x.n) : x.n; D.compose(out.slice(start).join(' '), head, 7); out.push(head);
    if (x.idx !== undefined) out.push(String(x.idx));
    if (x.app) np(D, x.app, 'obj', out);
    if (x.inf) out.push(...vpInf(D, x.inf));
    if (x.of) { D.apply('2.2.6'); out.push('of'); np(D, x.of, 'obj', out); }
    if (x.det === 'a' && out[start + 1] && vowelSound(out[start + 1])) { D.apply('8.2.1', 'a → an before ' + out[start + 1]); out[start] = 'an'; } }
  function prepFor(D, role, x) { const head = x && (x.n || (x.name && NAMES[x.name]));
    const c = D.choose([{ id: '2.2.1', when: true }, { id: '2.2.2', when: role === 'adhikarana' && ON_NOUNS.has(head), apavada_of: ['2.2.1'] }, { id: '2.2.3', when: role === 'adhikarana' && AT_NOUNS.has(head), apavada_of: ['2.2.1'] }], role);
    return c.id === '2.2.2' ? 'on' : c.id === '2.2.3' ? 'at' : ROLE_PREP[role]; }
  const form = (D, lex, f) => (f === 'base' ? lex : verbForm(D, lex, f));
  function vgroup(D, c, subj, force) {
    const root = c.v; if (!isVerb(root)) throw new Error('derive: no verbal root "' + root + '"'); D.apply('1.1.1', root);
    const pers = personOf(subj); const neg = c.pol === 'neg'; if (neg) D.apply('2.3.1');
    const chain = []; const voice = c.voice === 'pass'; const mod = c.mod || null;
    const pick = D.choose([{ id: '3.1.1', when: true }, { id: '3.1.2', when: c.tense === 'fut', apavada_of: ['3.1.1'] }, { id: '3.1.3', when: !!mod, apavada_of: ['3.1.1', '3.1.2'] }], c.tense + (mod ? ' / ' + mod : ''));
    let nextF = 'fin'; if (pick.id === '3.1.2') { chain.push({ lex: 'will', modal: true }); nextF = 'base'; } if (pick.id === '3.1.3') { chain.push({ lex: c.tense === 'past' && MODALS[mod].past ? MODALS[mod].past : mod, modal: true }); nextF = 'base'; }
    if (c.aspect === 'perf') { D.apply('3.1.4'); chain.push({ lex: 'have', f: nextF }); nextF = 'pp'; }
    if (c.aspect === 'prog') { D.apply('3.1.6'); chain.push({ lex: 'be', f: nextF }); nextF = 'ing'; }
    if (voice) { D.apply('3.1.5'); D.apply('2.1.2'); chain.push({ lex: 'be', f: nextF }); nextF = 'pp'; } else if (subj && force !== 'imp') D.apply('2.1.1');
    if (root === 'be' && !voice) D.apply('3.1.7');
    chain.push({ lex: root, f: nextF, main: true });
    if (force === 'imp') { D.apply('3.2.2'); const t = chain.map(e => (e.modal ? e.lex : e.f === 'fin' ? e.lex : form(D, e.lex, e.f))); if (neg) { D.apply('6.1.1', 'imperative'); return { toks: ['do', 'not'].concat(t) }; } return { toks: t }; }
    const first = chain[0]; if ((neg || force === 'ques') && first.main && first.lex !== 'be' && !first.modal) { D.apply('6.1.1', root); chain.unshift({ lex: 'do', f: 'fin' }); chain[1].f = 'base'; }
    const toks = []; chain.forEach((e, i) => { let w; if (e.modal) w = e.lex; else if (e.f === 'fin') { D.apply('6.1.2', e.lex + ' ↔ ' + pers.p + pers.n);
        if (e.lex === 'be') { D.apply('6.1.3'); w = c.tense === 'past' ? (pers.n === 'sg' ? 'was' : 'were') : pers.p === 1 && pers.n === 'sg' ? 'am' : pers.n === 'sg' && pers.p === 3 ? 'is' : 'are'; }
        else w = c.tense === 'past' ? verbForm(D, e.lex, 'past') : (pers.p === 3 && pers.n === 'sg' ? verbForm(D, e.lex, 's') : e.lex); D.compose(e.lex, w, 7); }
      else w = form(D, e.lex, e.f);
      toks.push(w); if (i === 0 && neg) toks.push('not'); });
    if (neg && toks[0] === 'can' && toks[1] === 'not') { D.apply('8.2.2'); toks.splice(0, 2, 'cannot'); }
    return { toks }; }
  function vpInf(D, c) { const t = []; if (c.pol === 'neg') t.push('not'); D.apply('3.2.4', c.v); if (!isVerb(c.v)) throw new Error('derive: no verbal root "' + c.v + '"'); D.apply('1.1.1', c.v); t.push('to', c.v); t.push(...rest(D, c)); return t; }
  function vpBare(D, c) { if (!isVerb(c.v)) throw new Error('derive: no verbal root "' + c.v + '"'); D.apply('1.1.1', c.v); return [c.v].concat(rest(D, c)); }
  function rest(D, c) { const out = []; const comp = c.comp || {}; const hasObj = c.karma || comp.that || comp.inf;
    if (c.samp) { const ch = D.choose([{ id: '2.2.4', when: true }, { id: '2.2.5', when: !!(SAMP_PR.has(c.samp.pr) && (hasObj || ADDRESSEE_VERBS.has(c.v))), apavada_of: ['2.2.4'] }], 'sampradāna'); if (ch.id === '2.2.4') out.push('to'); np(D, c.samp, 'obj', out); }
    if (c.karma && c.wh !== 'karma') np(D, c.karma, 'obj', out);
    if (c.pred) { if (typeof c.pred.adj === 'string' && !c.pred.n) out.push(c.pred.adj); else if (c.pred.that) { out.push('that'); D.apply('1.1.6', 'clause'); out.push(...userClause(c.pred.that.uc).split(' ')); } else np(D, c.pred, 'obj', out); }
    for (const a of c.post || []) out.push(a);
    const roles = c.roles || {}; const ks = Object.keys(roles).filter(k => roles[k]).sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b)); if (ks.length > 1) D.apply('8.1.2', ks.join(' < '));
    for (const r of ks) { out.push(prepFor(D, r, roles[r])); np(D, roles[r], 'obj', out); }
    if (comp.that) { out.push('that'); D.apply('1.1.6', 'clause'); out.push(...userClause(comp.that.uc).split(' ')); }
    if (comp.inf) out.push(...vpInf(D, comp.inf));
    const lst = c.karma && c.karma.list; if (lst) { D.apply('8.1.3'); out[out.length - 1] += ':'; D.apply('8.3.4', lst.items.length + ' items');
      lst.items.forEach((it, i) => { out.push('(' + (i + 1) + ')'); const tk = [];
        if (lst.kind === 'clause') { D.apply('1.1.6', 'clause'); tk.push(...userClause(it).split(' ')); } else if (lst.kind === 'mention') { D.apply('1.1.5'); tk.push('“' + it + '”'); } else if (lst.kind === 'vp') tk.push(...vpBare(D, it)); else np(D, it, 'obj', tk);
        if (i < lst.items.length - 1) tk[tk.length - 1] += ';'; out.push(...tk); }); }
    return out; }
  const insertAdv = (vg, pre) => { if (!pre.length) return vg; if (vg.length === 1) return pre.concat(vg); const i = vg[1] === 'not' ? 2 : 1; return vg.slice(0, i).concat(pre, vg.slice(i)); };
  function clauseToks(D, c, force) {
    const subj = c.voice === 'pass' ? c.karma : c.karta; const cc = c.voice === 'pass' ? Object.assign({}, c, { karma: null, roles: Object.assign({}, c.roles, c.karta ? { hetu: c.karta } : {}) }) : c;
    const vg = vgroup(D, c, force === 'imp' ? null : subj, force);
    const st = []; if (subj && force !== 'imp') np(D, subj, 'subj', st);
    const pre = (c.adv || []).map(a => a.replace('-', ' ')); let toks;
    if (force === 'ques') { D.apply('3.2.1', vg.toks[0]); const wh = []; if (c.wh === 'karma') { D.apply('3.2.3'); np(D, c.karma, 'obj', wh); } toks = wh.concat([vg.toks[0]], st, insertAdv(vg.toks.slice(1), pre)); }
    else { D.apply('8.1.1'); toks = st.concat(insertAdv(vg.toks, pre)); }
    return toks.concat(rest(D, cc)); }
  function mathToks(D, items) { const out = []; for (const it of items) { if (it.x !== undefined) { D.apply('1.1.7', it.x); out.push(...String(it.x).split(' ')); }
      else if (it.rel) { const r = D.choose([{ id: 'M.1.1', when: it.rel === 'eq' || it.rel === 'approx' }, { id: 'M.1.2', when: it.rel === 'approx', apavada_of: ['M.1.1'] }, { id: 'M.1.3', when: it.rel === 'implies' }, { id: 'M.1.6', when: it.rel === 'sub' }, { id: 'M.1.7', when: it.rel === 'neq' }], it.rel); out.push({ 'M.1.1': '=', 'M.1.2': '≈', 'M.1.3': '⇒', 'M.1.6': '⊑', 'M.1.7': '≠' }[r.id]); }
      else if (it.w) { D.apply(it.w === 'or' ? 'M.1.4' : 'M.1.5'); out.push(it.w); } } return out; }
  function sentence(D, s) { const toks = [];
    if (s.conj) { D.apply('8.1.5', s.conj); toks.push(s.conj); }
    if (s.part) { D.apply('1.1.4', s.part); toks.push(s.part); if ((s.c && s.part !== 'please') || s.mth || (s.front && s.front.length)) { D.apply('8.1.4'); toks[toks.length - 1] += ','; } }
    for (const f of s.front || []) { if (f.adv) toks.push(f.adv); else { toks.push(prepFor(D, f.role, f.np)); np(D, f.np, 'obj', toks); } D.apply('8.1.4'); toks[toks.length - 1] += ','; }
    if (s.mth) toks.push(...mathToks(D, s.mth)); else if (s.c) toks.push(...clauseToks(D, s.c, s.force));
    if (!toks.length) throw new Error('derive: empty sentence');
    D.apply('8.3.2', s.force === 'ques' ? '?' : '.'); toks[toks.length - 1] = toks[toks.length - 1].replace(/[,:;]$/, '') + (s.force === 'ques' ? '?' : '.');
    if (!s.mth || s.front || s.part || s.conj) { const w = toks[0]; if (/^[a-z]/.test(w) && GENWORD(w.replace(/[,.?]$/, ''))) { D.apply('8.3.1'); toks[0] = w[0].toUpperCase() + w.slice(1); } }
    return toks.join(' '); }
  function realize(sentences) { const D = Deriv(); const out = sentences.map(s => sentence(D, s));
    D.apply('9.1.1'); const text = out.join(' ').replace(/⟨[^⟩]*⟩/g, '');
    const tr = D.trail; let forbidden = null; for (let i = 1; i < tr.length; i++) if ((tr[i - 1] === 4 || tr[i - 1] === 5) && tr[i] === 8) { forbidden = 'Φ' + tr[i - 1] + '→Φ8 at step ' + i; break; }
    const drift = M.driftFunctional({ phaseHistory: tr.slice(-9), transition: forbidden ? { from: 5, to: 8, expected: 6 } : { from: 8, to: 9, expected: 9 }, depth: Math.max(1, Math.ceil(D.log.length / 10)) });
    return { text, derivation: { rules: D.log, phase_trail: tr.map(n => 'Φ' + n).join('→').replace(/(Φ\d)(→\1)+/g, '$1'), compositions: D.comps, forbidden_transition: forbidden,
      drift: { eps_s: drift.eps_s, band: drift.band, formula: drift.formula, note: 'drift of the derivation itself over its phase trail (RMC Addendum §3)' }, rule_count: D.log.length, distinct_rules: [...new Set(D.log.map(l => l.id))].length, sentences: out.length } }; }
  return { realize, personOf, _vg: vgroup, _adv: insertAdv };
}

function Analyser(env) {
  env = env || {}; const R = Realizer(env); const isVerb = r => VERBS.has(r); const memo = new Map();
  function tokenize(s) { const toks = []; let i = 0; while (i < s.length) { const ch = s[i]; if (ch === ' ') { i++; continue; }
      if (ch === '“') { const j = s.indexOf('”', i); if (j < 0) return null; toks.push({ m: s.slice(i + 1, j) }); i = j + 1; continue; }
      if (ch === '[') { const j = s.indexOf(']', i); if (j < 0) return null; toks.push({ stamp: s.slice(i + 1, j) }); i = j + 1; continue; }
      let j = i; while (j < s.length && s[j] !== ' ' && s[j] !== '“' && s[j] !== '[') j++; let w = s.slice(i, j); i = j; const tail = [];
      while (/[,.;:?]$/.test(w) && !/^\(\d+\)$/.test(w)) { tail.unshift(w.slice(-1)); w = w.slice(0, -1); } if (w) toks.push({ w }); for (const t of tail) toks.push({ p: t }); }
    return toks; }
  const W = t => (t && t.w !== undefined ? t.w : null);
  const detok = toks => toks.map(t => (t.w !== undefined ? t.w : t.m !== undefined ? '"' + t.m + '"' : t.stamp !== undefined ? '[' + t.stamp + ']' : t.p)).join(' ').replace(/ ([,.;:?])/g, '$1');
  function verbCands(w) { const out = []; const add = (root, f) => { if (isVerb(root) && verbForm(null, root, f) === w && !out.some(o => o.root === root && o.f === f)) out.push({ root, f }); };
    for (const [b, x] of Object.entries(G.IRRV)) { if (x.past === w) add(b, 'past'); if (x.pp === w) add(b, 'pp'); }
    for (const r of [w, w.replace(/ies$/, 'y'), w.replace(/es$/, ''), w.replace(/s$/, ''), w.replace(/ied$/, 'y'), w.replace(/ed$/, ''), w.replace(/d$/, ''), w.replace(/(.)\1ed$/, '$1'), w.replace(/ing$/, ''), w.replace(/ing$/, 'e'), w.replace(/(.)\1ing$/, '$1'), w.replace(/ying$/, 'ie')]) for (const f of ['base', 's', 'past', 'pp', 'ing']) add(r, f);
    if (w === 'has' || w === 'had') add('have', w === 'has' ? 's' : 'past'); if (/^(is|am|are|was|were|been|being)$/.test(w)) out.push({ root: 'be', f: 'x' }); if (/^(do|does|did)$/.test(w)) out.push({ root: 'do', f: 'x' });
    return out; }
  function nounCand(w) { const out = []; if (NOUNS.has(w)) out.push({ n: w, pl: false }); for (const n of NOUNS) if (plural(null, n) === w) out.push({ n, pl: true }); return out; }
  function parseNP(toks, role) { const key = role + '|' + JSON.stringify(toks); if (memo.has(key)) return memo.get(key); const res = npAll(toks, role); memo.set(key, res); return res; }
  function npAll(toks, role) { const res = []; if (!toks.length) return res; const ws = toks.map(W); const allW = toks.every(t => t.w !== undefined);
    if (toks.length === 1 && toks[0].m !== undefined) res.push({ m: toks[0].m });
    if (toks.length === 1 && toks[0].stamp !== undefined) res.push({ stamp: toks[0].stamp });
    if (toks.length === 1 && ws[0] && FORM2PRON[ws[0]]) for (const a of FORM2PRON[ws[0]]) if (PRON[a.pr].nom === PRON[a.pr].acc || (role === 'subj') === (a.c === 'nom')) res.push({ pr: a.pr });
    if (allW) { const s = ws.join(' '); for (const nm of NAME_LIST) { if (s === nm) res.push({ name: nm }); if (s === 'the ' + nm) res.push({ name: nm, det: 'the' }); } }
    if (ws[0] && /^\d+$/.test(ws[0]) && ws[1] === 'of') for (const o of parseNP(toks.slice(2), 'obj')) res.push({ num: ws[0], of: o });
    for (const cj of ['or', 'and']) { const k = ws.lastIndexOf(cj); if (k > 0 && k < toks.length - 1) { const parts = []; let cur = []; for (const t of toks.slice(0, k)) { if (t.p === ',') { parts.push(cur); cur = []; } else cur.push(t); } if (cur.length || !parts.length) parts.push(cur); parts.push(toks.slice(k + 1));
        if (parts.length >= 2 && parts.every(p => p.length)) { const alts = parts.map(p => parseNP(p, role).filter(x => !x.u)); if (alts.every(a => a.length === 1) && (parts.length === 2 || toks[k - 1].p === ',')) res.push({ coord: cj, items: alts.map(a => a[0]) }); } } }
    let i = 0; const nd = {}; const d0 = ws[0] === 'an' ? 'a' : ws[0];
    if (d0 && DETS.has(d0)) { if (POSS.has(d0)) nd.poss = d0; else nd.det = d0; i = 1; }
    if (ws[i] && /^\d+$/.test(ws[i]) && ws[i + 1] !== 'of') { nd.cnt = Number(ws[i]); i++; }
    const artOk = !(ws[0] === 'an' && !vowelSound(ws[1] || '')) && !(ws[0] === 'a' && vowelSound(ws[1] || 'x'));
    if (artOk) { const adjs = []; const tryHead = (j, adj) => { for (const nc of ws[j] ? nounCand(ws[j]) : []) { if (nd.cnt !== undefined && (nd.cnt !== 1) !== nc.pl) continue; const b = Object.assign({}, nd, adj.length ? { adj: adj.slice() } : {}, { n: nc.n }); if (nc.pl && nd.cnt === undefined) b.pl = true;
          const tails = [[b, j + 1]]; if (ws[j + 1] && /^\d+$/.test(ws[j + 1])) tails.push([Object.assign({}, b, { idx: Number(ws[j + 1]) }), j + 2]);
          for (const [bb, k] of tails) { if (k === toks.length) res.push(bb); else {
              if (ws[k] === 'of') for (const o of parseNP(toks.slice(k + 1), 'obj')) res.push(Object.assign({}, bb, { of: o }));
              if ((ws[k] === 'to' || (ws[k] === 'not' && ws[k + 1] === 'to')) && NOUN_INF.has(bb.n)) for (const v of parseInf(toks.slice(k))) res.push(Object.assign({}, bb, { inf: v }));
              for (let e = k + 1; e <= toks.length; e++) for (const a of parseNP(toks.slice(k, e), 'obj')) if (a.m !== undefined || (a.x !== undefined && !/^\d+$/.test(a.x)) || a.stamp !== undefined) { if (e === toks.length) res.push(Object.assign({}, bb, { app: a })); else if (ws[e] === 'of') for (const o of parseNP(toks.slice(e + 1), 'obj')) res.push(Object.assign({}, bb, { app: a, of: o })); } } } } };
      let j = i; tryHead(j, adjs); while (ws[j] && ADJ.has(ws[j])) { adjs.push(ws[j]); j++; tryHead(j, adjs); } }
    if (!res.length && allW && !ws.some(w => DETS.has(w) || w === 'an' || PREP_ROLES[w] || FORM2PRON[w] || w === 'of') && /[0-9^=+\-*/()√∛∜_ΦεχλΘ⟁÷×∫]|^[b-z]$/.test(ws.join(' ')) && ws.every(MATHY)) res.push({ x: ws.join(' ') });
    if (env.reparseNP && !res.length && toks.every(t => t.w !== undefined || t.m !== undefined)) { const n = env.reparseNP(detok(toks)); if (n) res.push({ u: G.material(n) }); }
    return res; }
  function parseInf(toks) { const ws = toks.map(W); let neg = false, i = 0; if (ws[0] === 'not') { neg = true; i = 1; } if (ws[i] !== 'to') return []; const v = ws[i + 1]; if (!v || !isVerb(v)) return [];
    return parseRest(toks.slice(i + 2), { v, tense: 'pres', pol: neg ? 'neg' : 'pos' }, v === 'be'); }
  const rprep = (role, n) => { const head = n && (n.n || (n.name && NAMES[n.name])); if (role === 'adhikarana' && ON_NOUNS.has(head)) return 'on'; if (role === 'adhikarana' && AT_NOUNS.has(head)) return 'at'; return ROLE_PREP[role]; };
  function finish(c, objs, isBe, list) { c = Object.assign({}, c);
    if (isBe) { if (objs.length === 1 && !c.pred) c.pred = objs[0]; else if (objs.length) return null; if (!c.pred) return null; }
    else { if (objs.length === 2) { if (c.samp) return null; c.samp = objs[0]; c.karma = objs[1]; } else if (objs.length === 1) { if (ADDRESSEE_VERBS.has(c.v) && !c.samp && objs[0].pr && SAMP_PR.has(objs[0].pr) && !c.karma) c.samp = objs[0]; else c.karma = objs[0]; } else if (objs.length > 2) return null; }
    if (c.samp && !c.sampTo && !(SAMP_PR.has(c.samp.pr) && (ADDRESSEE_VERBS.has(c.v) || c.karma || (c.comp && (c.comp.that || c.comp.inf))))) return null;
    if (c.samp && c.sampTo && SAMP_PR.has(c.samp.pr) && (c.karma || c.comp || ADDRESSEE_VERBS.has(c.v))) return null; delete c.sampTo;
    if (list) { if (!c.karma || c.karma.list) return null; c.karma = Object.assign({}, c.karma, { list }); }
    return c; }
  function parseRest(toks, base, isBe) { const out = []; const ws = toks.map(W);
    const go = (i, c, objs) => { if (out.length > 40) return;
      if (i === toks.length) { const r = finish(c, objs, isBe); if (r) out.push(r); return; }
      const w = ws[i];
      if (w && POSTVERB_ADV.has(w)) go(i + 1, Object.assign({}, c, { post: (c.post || []).concat([w]) }), objs);
      if (w === 'that' && i + 1 < toks.length && env.reparseClause) { const cl = env.reparseClause(detok(toks.slice(i + 1))); if (cl) { const x = { uc: G.material(cl) }; const r = finish(Object.assign({}, c, isBe && !objs.length && !c.pred ? { pred: { that: x } } : { comp: { that: x } }), objs, isBe); if (r) out.push(r); } }
      if ((w === 'to' || (w === 'not' && ws[i + 1] === 'to')) && !(c.comp && c.comp.inf) && INF_VERBS.has(c.v)) for (const v of parseInf(toks.slice(i))) { const r = finish(Object.assign({}, c, { comp: { inf: v } }), objs, isBe); if (r) out.push(r); }
      if (toks[i].p === ':' && w === null) { const items = splitList(toks.slice(i + 1)); for (const li of items) { const r = finish(c, objs, isBe, li); if (r) out.push(r); } return; }
      if (w && PREP_ROLES[w]) for (let j = i + 2; j <= toks.length; j++) { if (toks[j] && toks[j].p === ',') continue; for (const n of parseNP(toks.slice(i + 1, j), 'obj')) for (const role of PREP_ROLES[w]) { if (rprep(role, n) !== w || (c.roles || {})[role] || (ROLE_VERBS[role] && !ROLE_VERBS[role].includes(c.v))) continue; go(j, Object.assign({}, c, { roles: Object.assign({}, c.roles, { [role]: n }) }), objs); } }
      if (w === 'to' && !objs.length && !c.samp && ADDRESSEE_VERBS.has(c.v)) for (let j = i + 2; j <= toks.length; j++) for (const n of parseNP(toks.slice(i + 1, j), 'obj')) go(j, Object.assign({}, c, { samp: n, sampTo: true }), objs);
      if (isBe && w && ADJ.has(w) && !PP_ADJ.has(w) && !objs.length && !c.pred) go(i + 1, Object.assign({}, c, { pred: { adj: w } }), objs);
      if (objs.length < 2 && !(c.roles && Object.keys(c.roles).length) && !c.post) for (let j = i + 1; j <= toks.length; j++) { const last = toks[j - 1]; if (last.p) continue; if (toks[j] && toks[j].p && toks[j].p !== ':') continue; for (const n of parseNP(toks.slice(i, j), 'obj')) { if (isBe && n.u && j === i + 1 && ADJ.has(ws[i])) continue; go(j, c, objs.concat([n])); } }
    };
    go(0, Object.assign({}, base), []); return out; }
  function splitList(toks) { const items = []; let cur = null; for (const t of toks) { if (t.w && /^\(\d+\)$/.test(t.w)) { if (cur) items.push(cur); if (+t.w.slice(1, -1) !== items.length + 1) return []; cur = []; continue; } if (!cur) return []; if (t.p === ';') { items.push(cur); cur = null; continue; } cur.push(t); } if (cur) items.push(cur); if (!items.length || items.some(x => !x.length)) return [];
    const kinds = [];
    if (items.every(it => it.length === 1 && it[0].m !== undefined)) kinds.push({ kind: 'mention', items: items.map(it => it[0].m) });
    if (env.reparseClause) { const cs = items.map(it => { const c = env.reparseClause(detok(it)); return c ? G.material(c) : null; }); if (cs.every(Boolean)) kinds.push({ kind: 'clause', items: cs }); }
    const vs = items.map(it => { const v = W(it[0]); if (!v || !isVerb(v)) return null; const r = parseRest(it.slice(1), { v }, false); return r.length === 1 ? r[0] : null; }); if (vs.every(Boolean)) kinds.push({ kind: 'vp', items: vs });
    const ns = items.map(it => { const r = parseNP(it, 'obj'); return r.length === 1 ? r[0] : null; }); if (ns.every(Boolean) && !kinds.length) kinds.push({ kind: 'np', items: ns });
    return kinds; }
  const FEATS = []; for (const tense of ['pres', 'past', 'fut']) for (const pol of ['pos', 'neg']) for (const mod of [null, 'can', 'should', 'must', 'may']) for (const voice of ['act', 'pass']) for (const aspect of [null, 'perf', 'prog']) { if (tense === 'fut' && mod) continue; if (tense === 'past' && mod && !MODALS[mod].past) continue; FEATS.push({ tense, pol, mod, voice, aspect }); }
  const clean = c => { const o = { v: c.v, tense: c.tense, pol: c.pol }; if (c.mod) o.mod = c.mod; if (c.voice === 'pass') o.voice = 'pass'; if (c.aspect) o.aspect = c.aspect; return o; };
  function rootsNear(ws, i, n) { const s = new Set(); for (let j = i; j < Math.min(ws.length, i + n); j++) if (ws[j]) for (const v of verbCands(ws[j])) s.add(v.root); return s; }
  function vgSynth(ws, i, subj, force, adv) { const out = []; for (const root of rootsNear(ws, i, 6)) for (const f of FEATS) { if (f.voice === 'pass' && root === 'be') continue; const c = Object.assign({ v: root }, f); let vg;
      try { vg = R._vg(Deriv(), c, subj, force); } catch (e) { continue; } const t = force === 'ques' ? vg.toks : R._adv(vg.toks, adv); if (ws.slice(i, i + t.length).join(' ') === t.join(' ')) out.push({ c: clean(c), end: i + t.length }); } return out; }
  function clauses(toks, force) { const res = []; const ws = toks.map(W);
    if (force === 'imp') { let i = 0, pol = 'pos'; if (ws[0] === 'do' && ws[1] === 'not') { i = 2; pol = 'neg'; } const v = ws[i]; if (v && isVerb(v)) for (const r of parseRest(toks.slice(i + 1), { v, tense: 'pres', pol }, v === 'be')) res.push(r); return res; }
    if (force === 'ques') { for (let w = 0; w <= 2; w++) { const whs = w ? parseNP(toks.slice(0, w), 'obj').filter(x => x.det === 'which') : [null]; for (const wh of whs) for (let s = w + 2; s <= toks.length; s++) for (const subj of parseNP(toks.slice(w + 1, s), 'subj')) {
            for (const root of new Set([...rootsNear(ws, s, 4), ...verbCands(ws[w] || '').map(x => x.root), ...(MODALS[ws[w]] ? [] : [])])) for (const f of FEATS) { if (f.voice === 'pass' && root === 'be') continue; const c0 = Object.assign({ v: root }, f); let vg; try { vg = R._vg(Deriv(), c0, subj, 'ques'); } catch (e) { continue; }
              if (vg.toks[0] !== ws[w]) continue; const tail = vg.toks.slice(1); if (ws.slice(s, s + tail.length).join(' ') !== tail.join(' ')) continue; const c = clean(c0);
              for (const r of parseRest(toks.slice(s + tail.length), c, root === 'be' && c.voice !== 'pass')) { if (wh) { if (r.karma) continue; r.karma = wh; r.wh = 'karma'; } if (c.voice === 'pass') r.karma = subj; else r.karta = subj; res.push(r); } } } }
      return res; }
    for (let s = 1; s < toks.length; s++) for (const subj of parseNP(toks.slice(0, s), 'subj')) for (const adv of [[], ['also'], ['only'], ['still'], ['already'], ['never'], ['no-longer'], ['now']]) {
      for (const g of vgSynth(ws, s, subj, 'decl', adv.map(a => a.replace('-', ' ')).join(' ').split(' ').filter(Boolean))) { const isBe = g.c.v === 'be' && g.c.voice !== 'pass';
        for (const r of parseRest(toks.slice(g.end), Object.assign({}, g.c), isBe)) { if (adv.length) r.adv = adv; if (g.c.voice === 'pass') { r.karma = subj; if (r.roles && r.roles.hetu) { r.karta = r.roles.hetu; r.roles = Object.assign({}, r.roles); delete r.roles.hetu; } } else r.karta = subj; res.push(r); } } }
    return res; }
  const lcFirst = w => (w && /^[A-Z][a-z]*$/.test(w) && GENWORD(w) && w !== 'I' && !NAME_LIST.some(n => n.split(' ')[0] === w) ? w.toLowerCase() : w);
  function sentence(st) { const res = []; const force0 = st[st.length - 1].p === '?' ? 'ques' : 'decl'; let toks = st.slice(0, -1).map((t, k) => (k === 0 && t.w ? { w: lcFirst(t.w) } : t)); const pre = {};
    if (toks[0] && SCONJ.has(toks[0].w)) { pre.conj = toks[0].w; toks = toks.slice(1); if (toks[0] && toks[0].w) toks[0] = { w: lcFirst(toks[0].w) }; }
    if (toks[0] && PARTICLES.has(toks[0].w) && (toks.length === 1 || toks[1].p === ',')) { pre.part = toks[0].w; toks = toks.slice(toks.length === 1 ? 1 : 2); }
    else if (toks[0] && toks[0].w === 'please' && toks[1] && toks[1].w) { pre.part = 'please'; toks = toks.slice(1); }
    const fronts = []; for (;;) { const w0 = W(toks[0]); const ci = toks.findIndex(t => t.p === ',');
      if (w0 === 'before' && toks[1] && toks[1].p === ',') { fronts.push({ adv: 'before' }); toks = toks.slice(2); continue; }
      if (w0 && PREP_ROLES[w0] && ci > 1) { const nps = parseNP(toks.slice(1, ci), 'obj'); const alts = []; for (const n of nps) for (const r of PREP_ROLES[w0]) if (rprep(r, n) === w0 && !ROLE_VERBS[r]) alts.push({ role: r, np: n }); if (alts.length === 1) { fronts.push(alts[0]); toks = toks.slice(ci + 1); continue; } if (alts.length > 1) return [{ ambiguous: true }]; } break; }
    const base = Object.assign({ force: force0 }, pre, fronts.length ? { front: fronts } : {});
    if (!toks.length) { if (pre.part) res.push(base); return res; }
    if (toks.some(t => /^(=|≈|⇒|⊑|≠)$/.test(t.w || ''))) { const items = []; let cur = []; const flush = () => { if (cur.length) items.push({ x: cur.join(' ') }); cur = []; };
      for (const t of toks) { if (t.w === undefined) return []; if (/^(=|≈|⇒|⊑|≠)$/.test(t.w)) { flush(); items.push({ rel: { '=': 'eq', '≈': 'approx', '⇒': 'implies', '⊑': 'sub', '≠': 'neq' }[t.w] }); } else if (t.w === 'or' || t.w === 'and') { flush(); items.push({ w: t.w }); } else cur.push(t.w); } flush(); res.push(Object.assign({}, base, { mth: items })); return res; }
    for (const f of force0 === 'ques' ? ['ques'] : ['decl', 'imp']) for (const c of clauses(toks, f)) res.push(Object.assign({}, base, { force: f, c }));
    return res; }
  function analyse(text) { const toks = tokenize(text); if (!toks) return { analyses: [], reason: 'untokenizable surface' }; const ss = []; let cur = []; for (const t of toks) { cur.push(t); if (t.p === '.' || t.p === '?') { ss.push(cur); cur = []; } } if (cur.length) return { analyses: [], reason: 'unterminated sentence' };
    let acc = [[]]; for (let k = 0; k < ss.length; k++) { const as = sentence(ss[k]); if (as.some(a => a.ambiguous)) return { analyses: [], ambiguous: true, reason: 'ambiguous fronted adjunct in sentence ' + (k + 1) }; if (!as.length) return { analyses: [], reason: 'sentence ' + (k + 1) + ' has no analysis: ' + detok(ss[k]) };
      const nx = []; for (const a of acc) for (const b of as) nx.push(a.concat([b])); acc = nx.slice(0, 64); }
    return { analyses: acc, sentences: ss.length }; }
  return { analyse, tokenize, parseNP };
}

const pr = p => ({ pr: p }), N = (n, o) => Object.assign({ n }, o || {}), U = a => ({ u: a }), UC = a => ({ uc: a }), Mn = t => ({ m: String(t) }), X = t => ({ x: String(t) }), Nm = (s, det) => (det ? { name: s, det } : { name: s });
const C = (v, o) => Object.assign({ v, tense: 'pres', pol: 'pos' }, o || {}); const S = (c, o) => Object.assign({ c, force: 'decl' }, o || {}); const MS = (items, o) => Object.assign({ mth: items, force: 'decl' }, o || {});
const I = pr('I'), YOU = pr('you'), uo = s => s && s.pron === 'kernel' ? pr('I') : s && s.pron === 'user' ? YOU : U(s);
const told = cl => S(C('tell', { karta: YOU, samp: I, comp: { that: UC(cl) }, tense: 'past' }));
const coldStorage = () => N('storage', { adj: ['cold'] });
const yesNo = () => S(C('answer', { karma: { coord: 'or', items: [Mn('yes'), Mn('no')] } }), { force: 'imp', part: 'please' });
const forExample = k => S(C('say', { karma: Mn(MENTIONS[k]) }), { force: 'imp', front: [{ role: 'tadartha', np: N('example') }] });
const cannot = (v, karma) => S(C(v, { karta: I, karma: karma || pr('that'), mod: 'can', pol: 'neg' }));
const REASON = {
  NO_TIME_SOURCE: () => [cannot('answer'), S(C('have', { karta: I, karma: N('source', { det: 'no', adj: ['authorized', 'evidence'] }), roles: { tadartha: N('time', { det: 'the' }) } }))],
  DEFINITE_ONE_VAR: () => [S(C('need', { karta: N('integral', { det: 'a', adj: ['definite'] }), karma: N('variable', { det: 'a', adj: ['single'] }) }))],
  CALC_SCOPE: () => [cannot('differentiate', N('expression', { det: 'that' }))],
  INTEGRAL_SCOPE: () => [cannot('integrate', N('expression', { det: 'that' }))],
  MALFORMED_EXPR: () => [S(C('be', { karta: N('expression', { det: 'that' }), pred: { adj: 'malformed' } }))],
  NONLINEAR_SYSTEM: () => [S(C('solve', { karta: I, karma: N('system', { adj: ['linear'], pl: true }), mod: 'can', adv: ['only'] }))],
  MALFORMED_SYSTEM: () => [S(C('be', { karta: N('system', { det: 'that' }), pred: { adj: 'malformed' } }))],
  INCONSISTENT_SYSTEM: () => [S(C('have', { karta: N('system', { det: 'that' }), karma: N('solution', { det: 'no' }) })), S(C('be', { karta: N('equation', { poss: 'its', pl: true }), pred: { adj: 'inconsistent' } }))],
  UNDERDETERMINED: m => [S(C('have', { karta: N('system', { det: 'that' }), karma: N('solution', { det: 'no', adj: ['single'] }) })), S(C('be', { karta: N('variable', { det: 'the', adj: ['free'], pl: m.free.length > 1 }), pred: m.free.length > 1 ? { coord: 'and', items: m.free.map(X) } : X(m.free[0]) })), S(C('add', { karma: N('equation', { det: 'a', adj: ['independent'] }) }), { force: 'imp' })],
  UNVERIFIED: () => [S(C('verify', { karta: I, karma: N('solution', { det: 'the' }), mod: 'can', tense: 'past', pol: 'neg' }))],
  UNVERIFIED_FACTOR: () => [S(C('verify', { karta: I, karma: N('factorization', { det: 'the' }), mod: 'can', tense: 'past', pol: 'neg' }))],
  NO_VARIABLE: () => [S(C('have', { karta: N('expression', { det: 'that' }), karma: N('variable', { det: 'no' }) }))],
  DIV0: () => [S(C('divide', { karta: I, mod: 'can', pol: 'neg', roles: { hetu: X('0') } }))],
  DIV0_PHI: () => [S(C('divide', { karta: I, mod: 'can', pol: 'neg', roles: { hetu: X('0') } })), S(C('require', { karta: N('operator', { det: 'the', app: X('÷_Φ') }), karma: N('quotient', { det: 'a', adj: ['valid'] }) }))],
  MULTIVARIABLE: m => [S(C('have', { karta: N('equation', { det: 'the' }), karma: N('variable', { adj: ['several'], pl: true, list: { kind: 'mention', items: m.vars } }) })), S(C('name', { karma: N('variable', { det: 'a' }) }), { force: 'imp', part: 'please' }), forExample('solve_for')],
  DEGREE_LIMIT: () => [cannot('solve', N('equation', { det: 'that' })), S(C('be', { karta: N('limit', { poss: 'my', adj: ['polynomial'] }), pred: N('degree', { idx: 4 }) }))],
  NOT_EQUATION: () => [S(C('need', { karta: I, karma: N('equation', { det: 'a' }) })), S(C('contain', { karta: pr('it'), mod: 'must', karma: N('sign', { det: 'the', app: Mn('=') }) }))],
  BAD_EQUATION: () => [S(C('be', { karta: N('equation', { det: 'that' }), pred: { adj: 'malformed' } }))],
  IDENTITY_EQ: () => [S(C('hold', { karta: N('equation', { det: 'that' }), roles: { tadartha: N('value', { det: 'every' }) } })), S(C('be', { karta: pr('it'), pred: N('identity', { det: 'a' }) }))],
  FALSE_EQ: () => [S(C('have', { karta: N('equation', { det: 'that' }), karma: N('solution', { det: 'no' }) })), S(C('reduce', { karta: pr('it'), roles: { gati: N('statement', { det: 'a', adj: ['false'] }) } }))],
  UNKNOWN_UNIT: m => [S(C('know', { karta: I, karma: N('unit', { det: 'the', app: Mn(m.unit) }), pol: 'neg' }))],
  DIM_MISMATCH: m => [S(C('measure', { karta: N('unit', { det: 'those', pl: true }), karma: N('quantity', { adj: ['different'], pl: true, list: { kind: 'mention', items: m.dims } }) }))],
  NO_EXTERNAL: () => [S(C('have', { karta: N('kernel', { det: 'this' }), karma: N('capability', { det: 'no' }), roles: { tadartha: N('action', { adj: ['external'], pl: true }) } }))],
  NOT_REGISTERED: () => [S(C('contain', { karta: N('register', { poss: 'my' }), karma: N('capability', { det: 'that' }), pol: 'neg' }))],
  FORGET_SCOPE: () => [S(C('forget', { karta: I, karma: N('fact', { pl: true }), mod: 'can', adv: ['only'], roles: { adhikarana: N('memory', { poss: 'my' }), paschat: N('confirmation') } })), forExample('forget')],
  OUT_OF_SCOPE: () => [S(C('contain', { karta: N('register', { poss: 'my' }), karma: N('capability', { det: 'that' }), pol: 'neg' }))],
  GENDER_UNSTATED: m => [S(C('infer', { karta: I, karma: N('relation', { det: 'a', adj: ['family'], app: Mn(m.want) }) })), S(C('tell', { karta: YOU, samp: I, karma: N('gender', { poss: 'their' }), aspect: 'perf', pol: 'neg' }), { conj: 'but' })],
  SENSITIVE_RECORD: () => [S(C('be', { karta: N('record', { det: 'that' }), pred: { adj: 'sensitive' } })), S(C('display', { karta: I, karma: pr('it'), adv: ['never'], roles: { adhikarana: N('chat') } })), S(C('open', { karma: Nm('Identity Vault', 'the'), comp: { inf: C('reveal', { karma: pr('it') }) } }), { force: 'imp' })],
  VAULT_LOCKED: () => [S(C('be', { karta: Nm('Identity Vault', 'the'), pred: { adj: 'locked' } })), S(C('unlock', { karma: pr('it'), roles: { karana: N('passphrase', { poss: 'your' }) } }), { force: 'imp', part: 'please' })],
  BYPASS: () => [S(C('follow', { karta: I, karma: N('request', { pl: true, inf: C('bypass', { karma: N('validation', { poss: 'my' }) }) }), pol: 'neg' })), S(C('ask', { post: ['normally'] }), { force: 'imp' })],
  PF_INTERNAL: () => [S(C('be', { karta: N('tool', { det: 'that' }), pred: N('part', { of: Nm('Forge') }) })), S(C('use', { karta: YOU, karma: pr('it'), mod: 'can', pol: 'neg' }))],
  PF_GATE: () => [S(C('need', { karta: N('run', { det: 'a' }), karma: { coord: 'and', items: [N('gate', { det: 'the', app: X('RUN-PROTOFORGE') }), N('backend', { det: 'the', adj: ['desktop'] })] } }))],
  LLM_GENERATION: () => [S(C('need', { karta: N('command', { det: 'that' }), karma: N('model', { det: 'a', adj: ['language'] }) })), S(C('remove', { karta: Nm('Forge'), karma: N('authority', { det: 'that' }), tense: 'past' })), S(C('replace', { karta: N('lane', { det: 'no', adj: ['deterministic'] }), karma: pr('it'), mod: 'can' }))],
  ECHOFORGE: () => [S(C('need', { karta: Nm('EchoForge'), karma: N('model', { det: 'a', adj: ['language'] }) })), S(C('contain', { karta: N('build', { det: 'this' }), karma: N('model', { det: 'no', adj: ['language'] }) }))],
};
const MISSING = { NOTE_TEXT: () => N('text', { det: 'the', of: N('note', { det: 'the' }) }), REMEMBER_WHAT: () => N('fact', { det: 'the' }) };
const hiddenS = h => (h ? [S(C('show', { karta: I, karma: N('record', { cnt: h, adj: ['sensitive'] }), tense: 'past', pol: 'neg' }))] : []);
const eqItems = (str, o) => { const parts = String(str).split(/ (=|≈) /); const out = []; parts.forEach((p, i) => { if (i % 2) out.push({ rel: p === '=' ? 'eq' : 'approx' }); else out.push(X(p)); }); return out; };
const wnChain = m => (m.wn ? [MS(m.wn.reduce((a, w, i) => (i ? a.concat([{ rel: 'sub' }, X(w.replace(/ /g, '_'))]) : [X(w.replace(/ /g, '_'))]), []), { front: [{ role: 'adhikarana', np: Nm('WordNet') }] })] : []);
const LANE = {
  SELF_REPORT: m => [S(C('find', { karta: I, karma: N('word', { cnt: m.unknown.length, adj: ['unknown'], list: m.unknown.length ? { kind: 'mention', items: m.unknown } : undefined }), tense: 'past' })), S(C('find', { karta: I, karma: N('hold', { cnt: m.held, adj: ['clarification'] }), tense: 'past' })), S(C('find', { karta: I, karma: N('failure', { cnt: m.echoFail, adj: ['echo'] }), tense: 'past' }))],
  ECHO_REVIEW: m => (m.review === null || m.review === undefined ? [S(C('have', { karta: I, karma: N('reply', { det: 'no', adj: ['earlier'] }) }))] : [S(C(m.review ? 'pass' : 'fail', { karta: N('reply', { det: 'the', adj: ['last'] }), karma: Nm('Echo'), tense: 'past' }))]),
  VERIFY_SUITE: () => [S(C('be', { karta: N('lane', { det: 'the' }), pred: N('suite', { det: 'the', of: Nm('Doc 9') }) }))] };
function worldPlan(m) {
  const plan = worldStatusPlan(m); if (!m.branch) return plan;
  return [S(C('answer', { karta: I, roles: { adhikarana: N('branch', { det: 'a' }) }, tense: 'past' }))].concat(plan, [S(C('change', { karta: N('branch', { det: 'the' }), karma: N('world', { det: 'the' }), pol: 'neg' }))]);
}
function worldStatusPlan(m) {
  const checkedWorld = N('world', { det: 'the', adj: ['checked'] });
  const checkedProof = N('proof', { det: 'the', adj: ['checked'] });
  if (m.why) { const w = m.why, q = Mn(w.query_text), L = xs => xs.length > 1 ? { coord: xs === w.hypotheses ? 'or' : 'and', items: xs.map(Mn) } : Mn(xs[0]);
    if (w.status === 'supported_only') return w.premises.length === 1 && w.premises[0] === w.query_text && !w.rules ? [S(C('state', { karma: q, voice: 'pass', tense: 'past' })), S(C('derive', { karta: N('rule', { det: 'no' }), karma: pr('it') }))]
      : [S(C('derive', { karta: checkedProof, karma: q, roles: { apadana: L(w.premises) } })), S(C('use', { karta: pr('it'), karma: N('rule', { cnt: w.rules }) }))];
    if (w.status === 'undetermined') return [S(C('derive', { karta: checkedWorld, karma: q, pol: 'neg' }))].concat(w.hypotheses.length ? [S(C('explain', { karta: L(w.hypotheses), karma: pr('it'), mod: 'can' })), S(C('be', { karta: pr(w.hypotheses.length > 1 ? 'they' : 'it'), pred: N('hypothesis', { det: w.hypotheses.length > 1 ? undefined : 'a', pl: w.hypotheses.length > 1 }) }))] : [S(C('explain', { karta: N('rule', { det: 'no' }), karma: pr('it') }))]);
  }
  if (m.wh) { const a = m.wh.answers; if (!a.length) return m.status === 'incomplete' ? [S(C('reach', { karta: N('derivation', { det: 'the' }), karma: N('limit', { det: 'the' }), tense: 'past' })), S(C('answer', { karta: I, karma: Mn(m.wh.question), mod: 'can', pol: 'neg' }))] : [S(C('support', { karta: checkedWorld, karma: N('answer', { det: 'no' }), roles: { tadartha: Mn(m.wh.question) } })), S(C('need', { karta: I, karma: N('premise', { det: 'a', adj: ['additional'] }) }))];
    return (m.wh.count ? [S(C('count', { karta: I, karma: N('answer', { cnt: a.length, adj: ['checked'] }), tense: 'past' }))] : []).concat([S(C('support', { karta: N('proof', { det: 'the', adj: ['checked'], pl: a.length > 1 }), karma: a.length > 1 ? { coord: 'and', items: a.map(x => Mn(x.text)) } : Mn(a[0].text) })), S(C('determine', { karta: N('world', { det: 'the' }), karma: N('answer', { adj: ['other'], pl: true }), pol: 'neg' }))]); }
  if (m.status === 'supported_only') return [
    S(null, { part: 'yes' }),
    S(C('support', { karta: checkedProof, karma: Mn(m.query_text) }))
  ];
  if (m.status === 'refuted_only') return [
    S(null, { part: 'no' }),
    S(C('support', { karta: checkedProof, karma: Mn(m.opposite_text) }))
  ];
  if (m.status === 'conflicted') return [
    S(C('support', { karta: checkedWorld, karma: N('claim', { cnt: 2, list: { kind: 'mention', items: [m.query_text, m.opposite_text] } }) })),
    S(C('conflict', { karta: N('proof', { det: 'the', pl: true }) }))
  ];
  if (m.status === 'undetermined') return [
    S(C('support', { karta: checkedWorld, karma: Mn(m.query_text), pol: 'neg' })),
    S(C('support', { karta: pr('it'), karma: Mn(m.opposite_text), pol: 'neg' })),
    S(C('need', { karta: I, karma: N('premise', { det: 'a', adj: ['additional'] }) }))
  ];
  if (m.status === 'incomplete') return [
    S(C('reach', { karta: N('derivation', { det: 'the' }), karma: N('limit', { det: 'the' }), tense: 'past' })),
    S(C('make', { karta: I, karma: N('decision', { det: 'a', adj: ['complete'] }), tense: 'past', pol: 'neg' }))
  ];
  return [
    S(C('pass', { karta: N('proof', { det: 'the' }), karma: N('check', { det: 'the', adj: ['independent'] }), tense: 'past', pol: 'neg' })),
    S(C('answer', { karta: I, mod: 'can', pol: 'neg' }))
  ];
}
function worldLimitationPlan(m) {
  return [
    S(C('derive', { karta: I, karma: N('structure', { det: 'a', of: N('world', { det: 'the' }) }), roles: { tadartha: Mn(m.source) }, mod: 'can', tense: 'past', pol: 'neg' })),
    S(C('be', { karta: N('code', { det: 'the', of: N('limitation', { det: 'the' }) }), pred: Mn(m.code) }))
  ];
}
const PLANS = {
  ack: () => [S(C('acknowledge', { karta: I, karma: pr('that') }))],
  help: () => [S(C('do', { karta: I, karma: N('thing', { cnt: 8, list: { kind: 'vp', items: [C('remember', { karma: N('fact', { pl: true }) }), C('answer', { roles: { apadana: N('memory') } }), C('keep', { karma: N('note', { pl: true }) }), C('define', { karma: N('word', { pl: true }) }), C('solve', { karma: N('equation', { pl: true }) }), C('factor', { karma: N('polynomial', { pl: true }) }), C('convert', { karma: N('unit', { pl: true }) }), C('forget', { karma: N('fact', { pl: true }), roles: { paschat: N('confirmation') } })] } }), mod: 'can' })),
    S(C('say', { karma: { coord: 'or', items: ['remember', 'recall', 'note', 'math', 'solve', 'define', 'infer'].map(k => Mn(MENTIONS[k])) } }), { force: 'imp', front: [{ role: 'tadartha', np: N('example') }] })],
  loop: () => [S(C('start', { karta: N('binding', { det: 'a', adj: ['new'], app: X('λ') }), aspect: 'perf' })), S(C('reset', { karta: I, karma: N('flag', { det: 'the', adj: ['grace'], app: X('χ(t)') }), aspect: 'perf' }))],
  no_frame: () => [S(C('recognise', { karta: I, karma: N('word', { det: 'every' }), tense: 'past' })), S(C('derive', { karta: I, karma: N('structure', { det: 'a', adj: ['sentence'] }), roles: { tadartha: pr('that') }, mod: 'can', tense: 'past', pol: 'neg' }), { conj: 'but' }), S(C('type', { karma: Mn('help'), roles: { tadartha: N('list', { det: 'a', of: N('form', { adj: ['supported'], pl: true }) }) } }), { force: 'imp' })],
  world_answer: worldPlan,
  world_limitation: worldLimitationPlan,
  stored: m => [S(C('note', { karta: I, comp: { that: UC(m.clause) }, tense: 'past' }))],
  vault_locked: m => { const val = N('value', { det: 'the', of: m.subjNP ? U(m.subjNP) : { ut: m.subj } }); const vault = Nm('Identity Vault', 'the');
    const s1 = m.state === 'locked' ? S(C('lock', { karma: vault, voice: 'pass' })) : S(C('have', { karta: vault, karma: N('passphrase', { det: 'no' }) }));
    const s3 = m.state === 'locked' ? S(C('unlock', { karma: N('vault', { det: 'the' }) }), { force: 'imp' }) : S(C('set', { karma: N('passphrase', { det: 'a' }), roles: { adhikarana: N('vault', { det: 'the' }) } }), { force: 'imp' });
    return [s1, S(C('keep', { karta: I, karma: val, tense: 'past', pol: 'neg' }), { conj: 'so' }), s3, S(C('tell', { samp: I, post: ['again'] }), { force: 'imp', conj: 'then' })]; },
  secret_dropped: m => [S(C('keep', { karta: I, karma: N('value', { det: 'the', of: m.subjNP ? U(m.subjNP) : { ut: m.subj } }), tense: 'past', pol: 'neg' })), S(C('say', { karma: Mn(MENTIONS.remember_ellipsis), comp: { inf: C('seal', { karma: pr('it') }) } }), { force: 'imp' })],
  stored_sensitive: m => [S(C('seal', { karta: I, karma: m.subjNP ? U(m.subjNP) : { ut: m.subj }, roles: { adhikarana: Nm('Identity Vault', 'the') }, tense: 'past' })), S(C('show', { karta: I, karma: N('value', { poss: 'its' }), pol: 'neg' }))],
  merged: m => [S(C('note', { karta: I, comp: { that: UC(m.clause) }, tense: 'past', adv: ['already'] })), S(C('reinforce', { karta: I, karma: pr('it'), roles: { karana: X('⟁') }, tense: 'past' }))],
  replaced: m => [S(C('store', { karta: I, comp: { that: UC(m.clause) }, tense: 'past' })), S(C('move', { karta: I, karma: N('fact', { det: 'the', adj: ['earlier'] }), roles: { gati: coldStorage() }, tense: 'past' }))],
  recall: m => m.items.map(told),
  recall_none: m => m.clause ? [S(C('confirm', { karta: I, comp: { that: UC(m.clause) }, mod: 'can', pol: 'neg' })), S(C('decide', { karta: N('fact', { det: 'no', adj: ['stored'] }), karma: pr('it') }))] : [S(C('have', { karta: I, karma: N('fact', { det: 'no', adj: ['stored'] }), roles: { visaya: uo(m.subj) } }))],
  yesno: m => [m.answer === 'unconfirmed' ? cannot('confirm') : S(null, { part: m.answer })].concat(m.items.map(told)),
  inferred: m => (m.answer === 'contradiction'
    ? [S(C('conflict', { karta: N('fact', { poss: 'your', pl: true }) })), S(C('infer', { karta: I, comp: { that: UC(m.claim) } })), S(C('tell', { karta: YOU, samp: I, comp: { that: UC(m.neg) }, tense: 'past', adv: ['also'] }), { conj: 'but' })].concat(m.steps.map(told), wnChain(m), [S(C('tell', { samp: I, karma: N('fact', { det: 'the', adj: ['right'] }) }), { force: 'imp', part: 'please' })])
    : [S(C('infer', { karta: I, comp: { that: UC(m.claim) } }), { part: 'yes' })].concat(m.steps.map(told), wnChain(m), m.admitted ? [S(C('use', { karta: I, karma: N('rule', { cnt: m.admitted, adj: ['admitted'] }), tense: 'past' }))] : [])),
  confirm_forget: m => [S(C('ask', { karta: YOU, samp: I, comp: { inf: C('forget', { karma: N('fact', { cnt: m.items.length, list: { kind: 'clause', items: m.items } }) }) }, tense: 'past' })), S(C('move', { karta: I, karma: pr(m.items.length > 1 ? 'they' : 'it'), roles: { gati: coldStorage() }, mod: 'should' }), { force: 'ques' }), yesNo()],
  forgotten: m => [S(C('move', { karta: I, karma: N('fact', { cnt: m.items.length, list: { kind: 'clause', items: m.items } }), roles: { gati: coldStorage() }, tense: 'past' })), S(C('answer', { karta: pr(m.items.length > 1 ? 'they' : 'it'), karma: N('question', { pl: true }), adv: ['no-longer'] }))],
  forget_kept: () => [S(C('forget', { karta: I, karma: pr('anything'), tense: 'past', pol: 'neg' }))],
  no_reason: m => [told(m.clause), S(C('tell', { karta: YOU, samp: I, karma: pr('why'), tense: 'past', pol: 'neg' }))],
  depends: m => [S(C('depend', { karta: pr('that'), roles: { apeksha: N('sense', { det: 'the', of: Mn(m.word) }) } })), S(C('lead', { karta: { num: String(m.reach), of: N('sense', { poss: 'its', cnt: Number(m.n), adj: ['WordNet'] }) }, roles: { gati: Mn(m.target) } })), S(C('guess', { karta: I, tense: 'fut', pol: 'neg' })), S(C('say', { karma: Mn('define ' + m.word) }), { force: 'imp' }), S(C('pick', { karma: N('sense', { det: 'a' }) }), { force: 'imp' })],
  assert_ack: m => [S(C('understand', { karta: I, comp: { that: UC(m.clause) } })), S(C('store', { karta: I, karma: pr('it'), aspect: 'perf', pol: 'neg' })), S(C('say', { karma: Mn(MENTIONS.remember_ellipsis), comp: { inf: C('keep', { karma: pr('it') }) } }), { force: 'imp' })],
  neg_act: m => [S(C('ask', { karta: YOU, samp: I, comp: { inf: C(m.act, { karma: pr('that'), pol: 'neg' }) }, tense: 'past' })), S(C(m.act, { karta: I, karma: pr('it'), tense: 'past', pol: 'neg' }), { conj: 'so' })],
  confirm_replace: m => [S(C('tell', { karta: YOU, samp: I, comp: { that: UC(m.old) }, tense: 'past' }), { front: [{ adv: 'before' }] }), S(C('replace', { karta: I, karma: pr('it'), roles: { karana: N('fact', { det: 'the', adj: ['new'] }) }, mod: 'should' }), { force: 'ques' }), S(C('be', { karta: N('fact', { det: 'the', adj: ['new'] }), pred: { that: UC(m.clause) } })), yesNo()],
  kept: m => [S(C('remember', { karta: I, comp: { that: UC(m.clause) }, adv: ['still'] })), S(C('store', { karta: I, karma: N('statement', { det: 'the', adj: ['new'] }), tense: 'past', pol: 'neg' }))],
  about: m => (m.items.length ? [S(C('tell', { karta: YOU, samp: I, karma: N('fact', { cnt: m.items.length, list: { kind: 'clause', items: m.items } }), roles: { visaya: U(m.subj) }, tense: 'past' }))] : [S(C('have', { karta: I, karma: N('fact', { det: 'no', adj: ['stored'], pl: true }), roles: { visaya: U(m.subj) } }))]).concat(hiddenS(m.hidden)),
  when: m => m.items.map(x => S(C('tell', { karta: YOU, samp: I, comp: { that: UC(x.clause) }, tense: 'past' }), { front: [{ role: 'adhikarana', np: N('turn', { idx: Number(x.turn), app: { stamp: x.when } }) }] })),
  note_added: m => [S(C('add', { karta: I, karma: N('note', { det: 'a' }), tense: 'past' })), S(C('be', { karta: N('note', { idx: Number(m.n) }), pred: Mn(m.text) }))],
  notes: m => [m.items.length ? S(C('have', { karta: YOU, karma: N('note', { cnt: m.items.length, list: { kind: 'mention', items: m.items } }) })) : S(C('have', { karta: YOU, karma: N('note', { det: 'no', pl: true }) }))],
  facts: m => [m.items.length ? S(C('remember', { karta: I, karma: N('fact', { cnt: m.items.length, list: { kind: 'clause', items: m.items } }) })) : S(C('have', { karta: I, karma: N('fact', { det: 'no', adj: ['stored'], pl: true }), post: ['yet'] }))].concat(hiddenS(m.hidden)),
  count_about: m => [S(C('know', { karta: I, karma: N('fact', { cnt: Number(m.n) }), roles: { visaya: U(m.subj) } }))],
  count: m => [S(C('have', { karta: YOU, karma: N(m.what, { cnt: Number(m.n) }) }))],
  math: m => [MS(eqItems(m.phi ? m.exprPhi : m.expr).concat([{ rel: m.approx ? 'approx' : 'eq' }, X(m.value)]))].concat(m.approx ? [S(C('round', { karta: I, karma: pr('it'), roles: { gati: N('decimal', { cnt: 6 }) }, tense: 'past' })), S(C('be', { karta: N('result', { det: 'the' }), pred: { adj: 'irrational' } }))] : []),
  solved: m => { if (m.noReal) return [MS(eqItems(m.phi ? m.polyPhi : m.poly)), S(C('have', { karta: pr('it'), karma: N('solution', { det: 'no', adj: ['real'] }) }))].concat(m.discriminant !== undefined ? [S(C('be', { karta: N('discriminant', { poss: 'its' }), pred: X(m.discriminant) }))] : []);
    const items = eqItems(m.phi ? m.polyPhi : m.poly).concat([{ rel: 'implies' }]); m.roots.forEach((r, i) => { if (i) items.push({ w: 'or' }); items.push(X(m.x), { rel: m.numeric && m.numeric[i] ? 'approx' : 'eq' }, X(r)); });
    return [MS(items)].concat(m.numeric && m.numeric.some(Boolean) ? [S(C('round', { karta: I, karma: N('root', { det: 'the', adj: ['approximate'], pl: true }), roles: { gati: N('decimal', { cnt: 6 }) }, tense: 'past' }))].concat(m.closed ? [MS(m.closed.flatMap((r, i) => (i ? [{ w: 'or' }] : []).concat([X(m.x), { rel: 'eq' }, X(r)])))] : []) : []); },
  factored: m => (m.irreducible ? [S(C('factor', { karta: X(m.input), pol: 'neg', post: ['further'], roles: { domain: N('rational', { det: 'the', pl: true }) } }))] : [MS([X(m.input), { rel: 'eq' }, X(m.result)])]),
  system: m => { const items = []; m.eqs.forEach((e, i) => { if (i) items.push({ w: 'and' }); items.push(...eqItems(e)); }); items.push({ rel: 'implies' }); m.sol.forEach((s, i) => { if (i) items.push({ w: 'and' }); items.push(X(s.v), { rel: 'eq' }, X(s.exact)); }); return [MS(items)]; },
  calculus: m => [MS(m.op === 'derivative' ? [X('d/d' + m.x + ' (' + m.input + ')'), { rel: 'eq' }, X(m.result)] : m.a !== undefined ? [X('∫ from ' + m.a + ' to ' + m.b + ' of (' + m.input + ') d' + m.x), { rel: 'eq' }, X(m.result)] : [X('∫ (' + m.input + ') d' + m.x), { rel: 'eq' }, X(m.result + ' + C')])],
  simplified: m => [S(C('be', { karta: N('form', { det: 'the', adj: [m.op === 'expand' ? 'expanded' : 'simplified'] }), pred: X(m.phi ? m.resultPhi : m.result) }))].concat((m.excluded || []).length ? [MS(m.excluded.flatMap((v, i) => (i ? [{ w: 'and' }] : []).concat([X(m.x), { rel: 'neq' }, X(v)])))] : []),
  converted: m => [MS([X(m.from), { rel: 'eq' }, X(m.value + ' ' + m.to)])].concat(m.fraction ? [S(C('be', { karta: N('value', { det: 'the', adj: ['exact'] }), pred: X(m.fraction) }))] : []),
  define: m => [S(C('mean', { karta: Mn(m.term), karma: Mn(m.gloss) })), S(C('be', { karta: N('source', { det: 'the' }), pred: Mn(m.source) }))],
  clarify_unknown: m => { const many = m.words.length > 1; return [S(C('know', { karta: I, karma: many ? N('word', { det: 'the', pl: true, list: { kind: 'mention', items: m.words } }) : N('word', { det: 'the', app: Mn(m.words[0]) }), pol: 'neg' })), S(C('rephrase', { karma: pr(many ? 'they' : 'it') }), { force: 'imp', part: 'please' }), S(C('admit', { karma: pr(many ? 'they' : 'it'), roles: { adhikarana: Nm('Context Library tab', 'the') } }), { force: 'imp', conj: 'or' })]; },
  clarify_ambiguous: m => [S(C('have', { karta: Mn(m.word), karma: N('sense', { cnt: m.senses.length, list: { kind: 'mention', items: m.senses } }) })), S(C('mean', { karta: YOU, karma: N('sense', { det: 'which' }), wh: 'karma' }), { force: 'ques' })],
  clarify_readings: m => [S(C('find', { karta: I, karma: N('reading', { cnt: m.readings.length, list: { kind: 'mention', items: m.readings } }) })), S(C('mean', { karta: YOU, karma: N('reading', { det: 'which' }), wh: 'karma' }), { force: 'ques' })],
  clarify_referent: m => (m.options && m.options.length ? [S(C('have', { karta: N('word', { det: 'the', app: Mn(m.word) }), karma: N('referent', { cnt: m.options.length, adj: ['possible'], list: { kind: 'np', items: m.options.map(o => ({ ut: o })) } }) }))] : [cannot('resolve', N('word', { det: 'the', app: Mn(m.word) }))]).concat([S(C('name', { karma: pr('it') }), { force: 'imp', part: 'please' })]),
  clarify_incomplete: m => [S(C('be', { karta: N('request', { poss: 'your', inf: C(m.act) }), pred: { adj: 'incomplete' } })), S(C('say', { karma: (MISSING[m.missing] || MISSING.REMEMBER_WHAT)() }), { force: 'imp', part: 'please' }), forExample(m.missing === 'NOTE_TEXT' ? 'note' : 'remember')],
  blocked: m => [S(C('ask', { karta: YOU, samp: I, roles: { tadartha: N('action', { det: 'the', app: Mn(m.action) }) }, tense: 'past' })), S(C('authorize', { karma: I, voice: 'pass', pol: 'neg', comp: { inf: C('do', { karma: pr('that') }) } }), { conj: 'but' })].concat((REASON[m.reason] || REASON.NO_EXTERNAL)(m)),
  refuse: m => (REASON[m.reason] || (() => [cannot('answer')]))(m),
  quoted: m => [S(C('ask', { karta: YOU, samp: I, comp: { inf: C('say', { karma: Mn(m.text) }) }, tense: 'past' })), S(C('quote', { karta: I, karma: pr('it'), aspect: 'prog' })), S(C('assert', { karta: I, karma: pr('it'), pol: 'neg' }))],
  status: m => [S(C('be', { karta: N('drift', { det: 'the', app: X('ε_s') }), pred: X(m.eps) })), S(C('be', { karta: N('band', { det: 'the', adj: ['drift'] }), pred: Mn(m.band) })), S(C('close', { karta: N('turn', { det: 'the', adj: ['last'] }), roles: { sthana: X(m.phase) }, tense: 'past' })), S(C('be', { karta: N('flag', { det: 'the', adj: ['grace'], app: X('χ(t)') }), pred: X(m.chi) }))],
  terms: m => [S(C('define', { karta: I, karma: N('term', { cnt: m.items.length, adj: ['project'], list: { kind: 'mention', items: m.items } }), mod: 'can' }))],
  clarify_echo: () => [S(C('restate', { karta: I, karma: pr('that'), mod: 'can', pol: 'neg', post: ['unambiguously'] })), S(C('store', { karta: I, karma: pr('it'), tense: 'past', pol: 'neg' }), { conj: 'so' }), S(C('rephrase', { karma: pr('it') }), { force: 'imp', part: 'please' })],
  legacy_refused: m => [S(C('refuse', { karta: I, karma: N('command', { det: 'the', adj: ['legacy'], app: Mn(m.command) }) })), S(C('be', { karta: N('code', { det: 'the', adj: ['refusal'] }), pred: X(m.code) }))].concat(REASON.LLM_GENERATION()),
  legacy_replaced: m => [S(C('replace', { karta: I, karma: N('command', { det: 'the', adj: ['legacy'], app: Mn(m.command) }), roles: { karana: N('lane', { det: 'a', adj: ['deterministic'] }) } }))].concat(LANE[m.lane] ? LANE[m.lane](m) : []),
  tool_started: m => [S(C('start', { karta: I, karma: N('tool', { det: 'the', app: Mn(m.tool) }), roles: { tadartha: N(m.noun || 'topic', { det: 'the', app: Mn(m.target) }) }, tense: 'past' }))].concat(m.local ? [S(C('keep', { karta: I, karma: N('result', { poss: 'its', pl: true }), roles: { adhikarana: N('device', { det: 'this' }) } }))] : [S(C('seal', { karta: I, karma: N('result', { poss: 'its', pl: true }), roles: { adhikarana: Nm('Identity Vault', 'the') } }))]),
  tool_result: m => [S(C('find', { karta: N('tool', { det: 'the', app: Mn(m.tool) }), karma: N(m.noun || 'source', { cnt: m.items.length, list: { kind: 'mention', items: m.items } }), tense: 'past' }))].concat(m.excerpt ? [S(C('say', { karta: N('excerpt', { det: 'the', adj: ['best'] }), karma: Mn(m.excerpt) }))] : []).concat(m.sealed ? [S(C('seal', { karta: I, karma: pr(m.items.length === 1 ? 'it' : 'they'), roles: { adhikarana: Nm('Identity Vault', 'the') }, tense: 'past' }))] : []).concat(m.indexed != null ? [S(C('index', { karta: I, karma: N('symbol', { cnt: m.indexed }), tense: 'past' }))] : m.sealed ? [] : [S(C('store', { karta: I, karma: pr(m.items.length === 1 ? 'it' : 'they'), tense: 'past', pol: 'neg' }))]),
  tool_failed: m => [S(C('find', { karta: N('tool', { det: 'the', app: Mn(m.tool) }), karma: N('evidence', { det: 'no' }), tense: 'past' })), S(C('report', { karta: pr('it'), karma: Mn(m.reason), tense: 'past' }))],
  rendered: m => [S(C('render', { karta: I, karma: N('turn', { det: 'the', app: Mn(String(m.turn)) }), tense: 'past' })), S(C('be', { karta: N('form', { det: 'the' }), pred: Mn(m.form) })), S(C('pass', { karta: N('check', { poss: 'its', adj: ['echo'] }), tense: 'past', pol: m.pass ? 'pos' : 'neg' }))],
  render_none: m => [S(C('find', { karta: I, karma: N('answer', { det: 'no', adj: ['earlier'] }), tense: 'past' })), S(C('be', { karta: N('form', { det: 'the' }), pred: Mn(m.form) }))],
  note_edited: m => [S(C('change', { karta: I, karma: N('note', { idx: Number(m.n) }), tense: 'past' })), S(C('be', { karta: N('note', { idx: Number(m.n) }), pred: Mn(m.text) }))],
  note_tagged: m => [S(C('tag', { karta: I, karma: N('note', { idx: Number(m.n) }), tense: 'past' })), S(C('be', { karta: N('tag', { poss: 'its' }), pred: Mn(m.tag) }))],
  note_linked: m => [S(C('link', { karta: I, karma: N('note', { idx: Number(m.n) }), tense: 'past' })), S(C('match', { karta: N('memory', { cnt: m.count }), karma: Mn(m.target) }))],
  note_forgotten: m => [S(C('forget', { karta: I, karma: N('note', { idx: Number(m.n) }), tense: 'past' }))],
  note_missing: m => [S(C('have', { karta: YOU, karma: N('note', { idx: Number(m.n) }), pol: 'neg' }))],
  notes_found: m => [m.items.length ? S(C('find', { karta: I, karma: N('note', { cnt: m.items.length, list: { kind: 'mention', items: m.items } }), tense: 'past' })) : S(C('match', { karta: N('note', { det: 'no', pl: true }), karma: Mn(m.query) }))],
  reminder_set: m => [S(C('schedule', { karta: I, karma: N('reminder', { det: 'a', app: Mn(m.text) }), tense: 'past' })), S(C('be', { karta: N('time', { poss: 'its' }), pred: Mn(m.when) }))],
  reminders: m => [m.items.length ? S(C('have', { karta: YOU, karma: N('reminder', { cnt: m.items.length, list: { kind: 'mention', items: m.items } }) })) : S(C('have', { karta: YOU, karma: N('reminder', { det: 'no', pl: true }) }))],
  ede_result: m => [S(C('explore', { karta: I, karma: N('branch', { cnt: m.explored }), tense: 'past' })), ...(m.items.length ? [S(C('keep', { karta: I, karma: N('candidate', { cnt: m.items.length, list: { kind: 'mention', items: m.items } }), tense: 'past' }))] : [S(C('keep', { karta: I, karma: N('candidate', { det: 'no' }), tense: 'past' }))]), ...(m.rules && m.rules.length ? [S(C('keep', { karta: I, karma: N('rule', { cnt: m.rules.length, list: { kind: 'mention', items: m.rules } }), tense: 'past' }))] : []), S(C('archive', { karta: I, karma: N('branch', { cnt: m.archived }), tense: 'past' })), S(C('be', { karta: N('candidate', { det: 'a', adj: ['bounded'] }), pol: 'neg', pred: N('fact', { det: 'a' }) }))],
  pf_drift: m => [S(C('be', { karta: N('pattern', { det: 'the', adj: ['drift'] }), pred: Mn(m.pattern) })), S(C('be', { karta: N('intervention', { det: 'the' }), pred: Mn(m.intervention) })), S(C('use', { karta: I, karma: N('sample', { cnt: m.samples }), tense: 'past' }))],
  pf_agent: m => [S(C(m.action === 'spawn' ? 'spawn' : m.action === 'run' ? 'run' : m.action, { karta: I, karma: N('agent', { det: 'the', app: Mn(m.id) }), tense: 'past' })), S(C('be', { karta: N('task', { poss: 'its' }), pred: Mn(m.task) })), ...(m.status ? [S(C('be', { karta: N('status', { poss: 'its' }), pred: Mn(m.status) }))] : [])],
  sim_result: m => [S(C('run', { karta: I, karma: N('simulation', { det: 'a', adj: ['preview'], of: N('body', { cnt: m.bodies }) }), tense: 'past' })), S(C('be', { karta: N('hash', { poss: 'its', adj: ['final'] }), pred: Mn(m.hash) })), S(C('be', { karta: pr('it'), pol: 'neg', pred: N('result', { det: 'a', adj: ['ProtoForge'] }) }))],
  sim_replay: m => [S(C('match', { karta: N('replay', { det: 'the' }), karma: N('hash', { det: 'the', adj: ['recorded'] }), tense: 'past', pol: m.ok ? 'pos' : 'neg' }))],
  tool_denied: m => [S(C('run', { karta: I, karma: N('tool', { det: 'the', app: Mn(m.tool) }), tense: 'past', pol: 'neg' })), S(C('report', { karta: Nm('permission service', 'the'), karma: Mn(m.rule), tense: 'past' }))],
  patterns: m => m.items.length ? [S(C('notice', { karta: I, karma: N('pattern', { cnt: m.items.length, list: { kind: 'mention', items: m.items } }), tense: 'past' })), S(C('store', { karta: I, karma: pr('they'), tense: 'past', pol: 'neg' }))] : [S(C('notice', { karta: I, karma: N('pattern', { det: 'no', pl: true }), tense: 'past' }))],
  dream_held: m => [S(C(m.verb || 'suppose', { karta: YOU, comp: { that: UC(m.clause) }, tense: 'past' })), S(C('keep', { karta: I, karma: pr('it'), roles: { adhikarana: N('quarantine', { det: 'the', adj: ['dream'] }) }, tense: 'past' })), S(C('be', { karta: pr('it'), pol: 'neg', pred: N('fact', { det: 'a', adj: ['stored'] }) }))],
  write_held: m => [S(C('hold', { karta: I, karma: N('fact', { det: 'the' }), roles: { tadartha: N('approval', { poss: 'your' }) }, tense: 'past' }))].concat(m.sensitive ? [S(C('keep', { karta: I, karma: N('value', { det: 'the', adj: ['sensitive'] }), tense: 'past', pol: 'neg' }))] : []).concat([S(C('approve', { karma: pr('it'), roles: { adhikarana: Nm('RMC Memory tab', 'the') } }), { force: 'imp', part: 'please' })]),
  write_failed: () => [S(C('verify', { karta: I, karma: N('record', { det: 'the', adj: ['new'] }), mod: 'can', tense: 'past', pol: 'neg' })), S(C('restore', { karta: I, karma: N('memory', { poss: 'my' }), tense: 'past' }), { conj: 'so' }), S(C('say', { karma: pr('it'), post: ['again'] }), { force: 'imp', part: 'please' })],
  echoforge_disabled: () => [S(C('be', { karta: Nm('EchoForge'), pred: { adj: 'disabled' } }))].concat(REASON.ECHOFORGE()),
  echoforge_llm_excluded: () => [S(C('need', { karta: N('command', { det: 'the', app: Mn('echoforge-advisory') }), karma: N('model', { det: 'a', adj: ['language'] }) })), S(C('contain', { karta: N('build', { det: 'this' }), karma: N('model', { det: 'no', adj: ['language'] }) })), S(C('use', { karta: Nm('EchoForge'), karma: N('tool', { adj: ['deterministic'], pl: true }) }))],
};

for (const v of VERBS) { const pp = verbForm(null, v, 'pp'); if (ADJ.has(pp)) PP_ADJ.add(pp); }
function plan(m) { const P = PLANS[m.kind]; if (!P) throw new Error('derive: no plan for meaning kind "' + m.kind + '"'); return P(m); }
function realizeMeaning(m, env) { const vakya = plan(m); const r = Realizer(env).realize(vakya); r.vakya = vakya; r.derivation.plan = m.kind; r.derivation.surface = r.text; return r; }
function strip(x) { return JSON.parse(JSON.stringify(x, (k, v) => { if (v === null || v === undefined) return undefined; if ((k === 'tense' && v === 'pres') || (k === 'pol' && v === 'pos') || (k === 'voice' && v === 'act') || (k === 'force' && v === 'decl') || (k === 'pl' && v === false)) return undefined; if (Array.isArray(v) && !v.length && k !== 'items') return undefined; if (k === 'roles' && v && typeof v === 'object' && !Object.keys(v).length) return undefined; return v; })); }
const canon = o => { if (Array.isArray(o)) return '[' + o.map(canon).join(',') + ']'; if (o && typeof o === 'object') return '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}'; return JSON.stringify(o); };
function canonPlan(vakya, env, A, faults) { const userNP = env.npText || (n => G.npText(n, 'kernel'));
  const walk = v => { if (Array.isArray(v)) return v.map(walk); if (!v || typeof v !== 'object') return v;
    if (v.u || v.ut !== undefined) { const surf = v.u ? userNP(v.u) : String(v.ut); const toks = A.tokenize(surf) || []; const rs = A.parseNP(toks, 'obj'); const ds = [...new Set(rs.map(r => canon(strip(r))))];
      if (ds.length !== 1) { faults.push('user NP "' + surf + '" has ' + ds.length + ' readings'); return { u: '⊥' }; } const r = rs[0];
      if (r.u && v.u && canon(r.u) !== canon(G.material(v.u))) faults.push('user NP "' + surf + '" re-derives to different material'); return r; }
    if (v.uc) return { uc: G.material(v.uc) };
    const o = {}; for (const k of Object.keys(v)) o[k] = walk(v[k]); if (v.kind === 'clause' && Array.isArray(v.items)) o.items = v.items.map(c => G.material(c)); return o; };
  return walk(vakya); }
function echo(text, m, env) { env = env || {}; const vakya = plan(m); const A = Analyser(env); const faults = []; const want = canon(strip(canonPlan(vakya, env, A, faults)));
  const a = A.analyse(text); const distinct = [...new Set(a.analyses.map(x => canon(strip(x))))]; const match = distinct.includes(want);
  const comps = { reparse: a.analyses.length ? 1 : 0, unique_analysis: distinct.length === 1 ? 1 : 0, structural_identity: match && !faults.length ? 1 : 0 };
  if (env.reverify) { const rv = env.reverify(m, text); if (rv !== undefined) comps.independent_reverification = rv ? 1 : 0; }
  const pass = Object.values(comps).every(v => v === 1);
  return { pass, score: pass ? 1 : 0, theta: 1, components: comps, analyses: distinct.length, ambiguous: distinct.length > 1 || !!a.ambiguous,
    reason: pass ? undefined : faults[0] || a.reason || (distinct.length > 1 ? 'the surface has ' + distinct.length + ' analyses' : !match ? 'the surface re-derives to a different vākya' : 'independent re-verification failed'),
    mode: 'structural round trip: inverse sūtras (analysis by synthesis) + inward grammar; no word-overlap measure', cite: 'RMC §5.12, §6.7; Doc 3 reversible derivation', _want: env.debug ? want : undefined, _got: env.debug ? distinct : undefined }; }
const api = { realizeMeaning, echo, plan, Realizer, Analyser, RULES, SECTIONS, PLANS, REASON, MENTIONS, VERBS, NOUNS, ADJ, NAMES, strip, canon };
if (isNode) module.exports = api; else root.KDerive = api;
})(typeof self !== 'undefined' ? self : this);
