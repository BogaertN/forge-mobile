(function (root) {
const isNode = typeof module !== 'undefined' && module.exports;
const L = isNode ? require('./lexicon.js') : root.KLexicon;
const M = isNode ? require('./kmath.js') : root.KMath;
const A = isNode ? require('./algebra.js') : root.KAlgebra;
const CA = isNode ? require('./calculus.js') : root.KCalc;
const JT = isNode ? require('./justify.js') : root.KJustify; const HY = isNode ? require('./hypothesis.js') : root.KHyp;   /* K3/K4 4.9.69 */
const G = isNode ? require('./grammar.js') : root.KGrammar;
const D = isNode ? require('./derive.js') : root.KDerive;
const IF = isNode ? require('./infer.js') : root.KInfer;
const R = isNode ? require('./reason.js') : root.KReason;
const WR = isNode ? require('./world_rules.js') : root.KWorldRules; const EVO = isNode ? require('./evolve.js') : root.KEvolve; const MEA = isNode ? require('./mea.js') : root.KMEA; const MEAD = isNode ? require('./mea_data.js') : (root.KMEAData || { candidates: [] }); const MEAP = isNode ? require('./mea_p.js') : root.KMEAP; const MEAPD = isNode ? require('./mea_problems_data.js') : (root.KMEAProblems || { problems: [] }); const QC = isNode ? require('./qcompile.js') : root.KQC; const KN = isNode ? require('./knowledge.js') : root.KKnow; const MEAK = isNode ? require('./mea_k.js') : root.KMEAK; const MEAKD = isNode ? require('./mea_k_data.js') : (root.KMEAKData || { candidates: [], archive: [] }); const DY = isNode ? require('./dynamics.js') : root.KDynamics;
const { sha256 } = isNode ? require('./sha256.js') : root.KSha;
const TB = isNode ? require('./toolbench.js') : root.KTools;

const KS = isNode ? require('./kstore.js') : root.KStore; /* 4.9.212 C1: the store lives in kstore.js */
const { CATEGORIES, MemoryStore, canon } = KS;
const clone = o => JSON.parse(JSON.stringify(o));

const CAT2POS = { entity: 'n', term: 'n', time: 'n', attribute: 'a', action: 'v', math: 'v' };
function Lexicon(store) {
  const seed = L.SEED_CONCEPTS.map(c => Object.assign({}, c, { surfaces: c.surfaces.map(x => x.toLowerCase()) }));
  const user = store.load('lexicon_user'); const wn = { core: null, ext: null, pro: null };
  const all = () => seed.concat(user);
  let ix; const reindex = () => { ix = Object.create(null); for (const c of all()) { if (c.retired) continue; for (const s of c.surfaces) (ix[s] = ix[s] || []).push(c); } }; reindex();
  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const wnMerged = new Map(); const wnDirect = l => { const es = ['core', 'ext', 'pro'].map(t => wn[t] && own(wn[t].L, l) && wn[t].L[l]).filter(Boolean); if (es.length < 2) return es[0] || null; /* 4.9.50: tiers merge by part of speech (the complete tier adds a POS a higher tier lacks); a higher tier's POS wins */
    const key = l + '|' + es.length; if (wnMerged.has(key)) return wnMerged.get(key); const out = es[0].slice(); for (const e of es.slice(1)) for (const x of e) if (!out.some(y => y[0] === x[0])) out.push(x); wnMerged.set(key, out); return out; };
  const prov = new Map(); let strict = true, convo = new Set(); const wnEntry = l => wnDirect(l) || (strict && provInfo.has(l) && /^LX-PROVISIONAL/.test(provInfo.get(l).rule) && !convo.has(l) ? null : prov.get(l)) || null; /* 4.9.81 LX-CONVERSATION-WORD: a position-read word that a current fact of this conversation uses stays readable in later turns (questions about it) */ /* position-read words count only in the turn of a plain statement (never for memory writes or questions) */ /* 4.9.50: third tier 'complete' (every remaining WordNet lemma) */
  const controlled = w => (ix[w] || []).filter(c => c.category !== 'function' && c.category !== 'number');
  /* M-DERIVE (4.9.50; Doc4 morphology; Pāṇini kṛt/taddhita derivation): a word absent from every tier is derived from a lexicon word and admitted
     PROVISIONALLY (runtime only, never stored, Doc8 state 'provisional-derived'). Rules, most specific first (apavāda before utsarga):
     ORTHO (British/American spelling) → COMPOUND (hyphen; the head carries the class) → PREFIX + base → SUFFIX + base (agent, person, quality,
     manner, ability, medical combining forms). Every derived sense names its base and rule in the gloss. */
  const LXI = n => (wn.core ? wn.core.meta.lexnames.indexOf(n) : -1);
  const ORTHO = [[/our(?=s?$|ed$|ing$|ite|ful|able|less)/g, 'or'], [/isation/g, 'ization'], [/is(e|ed|es|ing|er|ers)$/, 'iz$1'], [/ys(e|ed|es|ing|is)$/, 'yz$1'], [/ae/g, 'e'], [/oe(?=[a-z])/g, 'e'], [/([^aeiou])tre(s?)$/, '$1ter$2'], [/([^aeiou])re(s?)$/, '$1er$2'], [/ence$/, 'ense'], [/ogue$/, 'og'], [/([aeiou])ll(ed|ing|er|ers)$/, '$1l$2'], [/mme$/, 'm'], [/eable$/, 'able']];
  const PREFIX = { un: 'av', re: 'vn', over: 'vna', under: 'vna', out: 'vn', mis: 'vn', pre: 'vna', co: 'vn', counter: 'vn', inter: 'van', sub: 'nva', super: 'nva', non: 'an', anti: 'an', de: 'v', dis: 'va', post: 'an', semi: 'an', multi: 'an', micro: 'n', hyper: 'an', hypo: 'an', trans: 'av', cross: 'vn', self: 'na', mid: 'n', ultra: 'a', neuro: 'n', cardio: 'n', electro: 'n', bio: 'n', auto: 'n' };
  const MED = [[/(ectomy|otomy|ostomy|plasty|scopy|graphy|centesis)$/, 'noun.act', 'surgical or diagnostic procedure'], [/(itis|osis|emia|aemia|algia|opathy|oma|plasia|ectasis|uria|rrhea|rrhoea|sclerosis|megaly|penia)$/, 'noun.state', 'medical condition'], [/(ology)$/, 'noun.cognition', 'field of study'], [/(ologist|iatrist|ician)$/, 'noun.person', 'specialist']];
  const ent = (p, lexname, gloss, fr) => [p, [['drv:' + gloss.replace(/\W+/g, '_').slice(0, 40) + p, Math.max(0, LXI(lexname)), gloss.slice(0, 90), fr || '']], 0];
  const posOf = e => e ? e.map(x => x[0]) : [];
  function derivedEntry(w) {
    for (const [re, rep] of ORTHO) { const v = w.replace(re, rep); if (v !== w && wnDirect(v)) return { e: wnDirect(v), rule: 'M-DERIVE-ORTHO', base: v }; }
    if (w.includes('-')) { const parts = w.split('-'), hd = parts[parts.length - 1], j = parts.join(''); if (wnDirect(j)) return { e: wnDirect(j), rule: 'M-DERIVE-COMPOUND-JOINED', base: j };
      const he = wnDirect(hd); if (he && parts.slice(0, -1).every(x => /^[a-z]+$/.test(x))) return { e: he.filter(x => x[0] !== 'r').map(([p, ss]) => [p, ss.slice(0, 1).map(s => ['drv:' + w + p, s[1], parts.slice(0, -1).join('-') + ' ' + hd + ': ' + s[2], s[3]]), 0]), rule: 'M-DERIVE-COMPOUND-HEAD', base: hd }; }
    for (const pre of Object.keys(PREFIX).sort((a, b) => b.length - a.length)) { if (!w.startsWith(pre) || w.length - pre.length < 3) continue; const b = w.slice(pre.length).replace(/^-/, ''); const be = wnDirect(b);
      if (be) { const ok = be.filter(x => PREFIX[pre].includes(x[0])); if (ok.length) return { e: ok.map(([p, ss]) => [p, ss.slice(0, 1).map(s => ['drv:' + w + p, s[1], pre + '- + ' + b + ': ' + s[2], s[3]]), 0]), rule: 'M-DERIVE-PREFIX', base: b }; } }
    for (const [re, ln, g] of MED) if (re.test(w)) return { e: [ent('n', ln, g + ' (' + w + ')')], rule: 'M-DERIVE-COMBINING-FORM', base: w.replace(re, '') };
    const suf = [[/(?:er|or)$/, ['', 'e'], 'v', 'n', 'noun.person', b => 'one who does “' + b + '”'], [/ist$/, ['', 'y', 'ism', 'e'], 'na', 'n', 'noun.person', b => 'specialist in “' + b + '”'], [/ian$/, ['', 'y', 'ia', 'e'], 'n', 'n', 'noun.person', b => 'person of “' + b + '”'],
      [/ness$/, ['', 'y'], 'a', 'n', 'noun.attribute', b => 'quality of being “' + b + '”'], [/ity$/, ['', 'e'], 'a', 'n', 'noun.attribute', b => 'quality of being “' + b + '”'], [/ment$/, [''], 'v', 'n', 'noun.act', b => 'act of “' + b + '”'], [/(?:ation|ition|tion|sion)$/, ['e', '', 'ate'], 'v', 'n', 'noun.act', b => 'act of “' + b + '”'], [/al$/, ['', 'e'], 'v', 'n', 'noun.act', b => 'act of “' + b + '”'],
      [/ly$/, ['', 'le', 'e'], 'a', 'r', 'adv.all', b => 'in a “' + b + '” way'], [/ally$/, ['', 'al'], 'a', 'r', 'adv.all', b => 'in a “' + b + '” way'], [/(?:able|ible)$/, ['', 'e'], 'v', 'a', 'adj.all', b => 'able to be “' + b + '”-ed'], [/(?:ic|al|ous|ive)$/, ['', 'y', 'e', 'ia'], 'n', 'a', 'adj.pert', b => 'of “' + b + '”'], [/less$/, [''], 'n', 'a', 'adj.all', b => 'without “' + b + '”'], [/ful$/, [''], 'n', 'a', 'adj.all', b => 'full of “' + b + '”'],
      [/(?:ize|ise)$/, ['', 'y', 'e'], 'na', 'v', 'verb.change', b => 'make “' + b + '”']];
    for (const [re, reps, bp, p, ln, g] of suf) { if (!re.test(w)) continue; const stem = w.replace(re, ''); if (stem.length < 3) continue;
      for (const r of reps) { const b = stem + r, be = wnDirect(b); if (be && posOf(be).some(x => bp.includes(x))) return { e: [ent(p, ln, g(b), p === 'v' ? '\u0038\u0039' : '')], rule: 'M-DERIVE-SUFFIX', base: b };
        const b2 = stem.slice(0, -1); if (r === '' && /(.)\1$/.test(stem) && wnDirect(b2) && posOf(wnDirect(b2)).some(x => bp.includes(x))) return { e: [ent(p, ln, g(b2))], rule: 'M-DERIVE-SUFFIX', base: b2 }; } }
    return null;
  }
  /* derive(w, check): admit a provisional derived entry for w (or for its stem under the inflection rules) when check(w) then succeeds */
  const derived = new Map();
  function derive(w, check) { if (derived.has(w)) return derived.get(w); derived.set(w, false); const stems = [w].concat([[/ies$/, 'y'], [/es$/, ''], [/s$/, ''], [/ied$/, 'y'], [/ed$/, ''], [/ed$/, 'e'], [/(.)\1ed$/, '$1'], [/ing$/, ''], [/ing$/, 'e'], [/(.)\1ing$/, '$1']].filter(([re]) => re.test(w)).map(([re, r]) => w.replace(re, r)));
    for (const c of stems) { if (c.length < 3 || wnDirect(c) || prov.has(c)) continue; const d = derivedEntry(c); if (!d) continue; prov.set(c, d.e); provInfo.set(c, { rule: d.rule, base: d.base }); if (check(w)) { derived.set(w, true); return true; } prov.delete(c); provInfo.delete(c); }
    return false; }
  const provInfo = new Map();
  /* provisional(l, p): a position-read unknown word (LX-PROVISIONAL-NOUN) is admitted for this runtime with a placeholder sense */
  function provisional(l, p) { if (wnEntry(l)) return; prov.set(l, [ent(p, p === 'n' ? 'noun.Tops' : 'adj.all', 'provisional ' + (p === 'n' ? 'noun' : 'modifier') + ' read from its position (unknown word “' + l + '”)')]); provInfo.set(l, { rule: p === 'n' ? 'LX-PROVISIONAL-NOUN' : 'LX-PROVISIONAL-MODIFIER', base: null, pos: p }); }

  /* 4.9.74: a PROVISIONAL entry (morphological derivation or position reading, prov) never shadows a user-approved concept: the user's taught
     category is consulted too (before, "defin" derived as a verb from de- + fin stayed a verb after the user taught it as a noun, so the teach loop repeated) */
  function hasPos(l, p) { const e = wnEntry(l); if (e && e.some(x => x[0] === p)) return true; if (controlled(l).some(c => String(c.id).startsWith('C.') && c.surfaces[0] === l && CAT2POS[c.category] === p)) return true; if (e && !prov.has(l)) return false; return controlled(l).some(c => c.surfaces[0] === l && (CAT2POS[c.category] === p || (p === 'n' && c.category === 'social'))); }
  function senses(l) { const out = []; const tier = wn.core && own(wn.core.L, l) ? 'core' : wn.ext && own(wn.ext.L, l) ? 'extended' : 'complete'; const LN = wn.core ? wn.core.meta.lexnames : [];
    for (const [p, ss, q] of wnEntry(l) || []) for (const [id, lx, gl, fr] of ss) out.push({ sid: 'wn30:' + id, pos: p, lexname: LN[lx] || lx, gloss: gl, frames: [...fr].map(ch => ch.charCodeAt(0) - 48), tier, quarantined_other: q, provenance: 'Princeton WordNet 3.0', license: 'WordNet 3.0 License', doc8_state: tier === 'core' ? 'admitted (SemCor-attested)' : tier === 'extended' ? 'admitted-extended (lower assurance)' : 'admitted-complete (lowest assurance)' });
    return out; }
  function lookup(w) { if (/^\d+(\.\d+)?$/.test(w)) return [{ id: 'NUM.LITERAL', category: 'number', senses: [{ sid: 'NUM.LITERAL.s1', gloss: 'numeral ' + w }] }]; const b = w.replace(/'s$/, ''); return ix[w] || ix[b] || []; }
  function addConcept({ surface, gloss, category, example, supersede }) {
    surface = String(surface || '').trim().toLowerCase(); gloss = String(gloss || '').trim();
    if (!/^[a-z][a-z'\-]{0,40}$/.test(surface) || !gloss) return { ok: false, reason: 'surface must be one lowercase word and gloss is required' };
    { const Pv = typeof P !== 'undefined' ? P : (isNode ? require('./privacy.js') : root.KPrivacy); if (Pv.redact(surface + ' ' + (gloss || '')).secrets.length) return { ok: false, reason: 'PRIV: the entry contains a sensitive value; admitted concepts are stored in plaintext, so it is refused' }; }
    const existing = lookup(surface).filter(c => c.id !== 'NUM.LITERAL');
    if (existing.length && !supersede) return { ok: false, conflict: existing.map(c => ({ id: c.id, status: c.status, gloss: c.senses[0].gloss })), reason: 'surface already exists; adding requires explicit supersede (new version), never silent overwrite' };
    if (existing.some(c => c.status === 'seed')) return { ok: false, reason: 'seed (controlled) concepts cannot be superseded from the UI', conflict: existing.map(c => ({ id: c.id, status: c.status })) };
    const prev = existing.find(c => c.status === 'user-admitted'); const id = prev ? prev.id : 'U.' + surface.toUpperCase().replace(/[^A-Z]/g, '_'); const version = prev ? prev.version + 1 : 1; const at = new Date().toISOString();
    const c = { id, senses: [{ sid: id + '.s' + version, gloss }], surfaces: [surface], category: category || 'entity', source: 'user-admitted', status: 'user-admitted', version, provenance: 'user', license: 'user-owned', doc8_state: 'admitted (user authority)', history: prev ? prev.history.concat([{ version: prev.version, gloss: prev.senses[0].gloss, retired_at: at }]) : [], admitted_at: at };
    if (prev) prev.retired = true; user.push(c); store.save('lexicon_user', user); reindex();
    if (example) { const ex = store.load('language_examples'); ex.push({ concept: id, version, example, at }); store.save('language_examples', ex); }
    return { ok: true, concept: c };
  }
  const LICENCES = ['user-owned', 'CC0-1.0', 'public-domain', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'WordNet-3.0'];
  const shaQ = t => sha256(t);
  function proposeConcept(o) { const q = store.load('admission_queue'); const surface = String(o.surface || '').trim().toLowerCase(), gloss = String(o.gloss || '').trim();
    const rec = { id: 'adm:' + (q.length + 1) + ':' + surface, surface, gloss, category: o.category || 'entity', example: o.example || '', licence: String(o.licence || ''), evidence: String(o.evidence || '').trim().slice(0, 500), supersede: !!o.supersede, state: 'quarantined', proposed_at: new Date().toISOString(), checks: [] };
    rec.content_sha256 = shaQ(JSON.stringify([rec.surface, rec.gloss, rec.licence, rec.evidence])); q.push(rec); store.save('admission_queue', q); return inspectConcept(rec.id); }
  function inspectConcept(id) { const q = store.load('admission_queue'); const rec = q.find(x => x.id === id); if (!rec) return { ok: false, reason: 'no such admission record' }; if (rec.state !== 'quarantined') return { ok: false, reason: 'already ' + rec.state, record: rec };
    const Pv = typeof P !== 'undefined' ? P : (isNode ? require('./privacy.js') : root.KPrivacy); const existing = lookup(rec.surface).filter(c => c.id !== 'NUM.LITERAL');
    const checks = [['ADM-SURFACE-FORM', /^[a-z][a-z'\-]{0,40}$/.test(rec.surface) && !!rec.gloss], ['ADM-LICENCE-ADMITTED', LICENCES.includes(rec.licence)], ['ADM-EVIDENCE-PRESENT', rec.evidence.length >= 3],
      ['ADM-PRIVACY', !Pv.redact(rec.surface + ' ' + rec.gloss + ' ' + rec.evidence).secrets.length], ['ADM-NO-SILENT-OVERWRITE', !existing.length || rec.supersede], ['ADM-SEED-PROTECTED', !existing.some(c => c.status === 'seed')], ['ADM-HASH', rec.content_sha256 === shaQ(JSON.stringify([rec.surface, rec.gloss, rec.licence, rec.evidence]))]];
    rec.checks = checks.map(([rule, pass]) => ({ rule, pass })); rec.state = checks.every(c => c[1]) ? 'inspected' : 'rejected'; if (rec.state === 'rejected') rec.reason = checks.filter(c => !c[1]).map(c => c[0]).join(', '); rec.inspected_at = new Date().toISOString(); store.save('admission_queue', q);
    return { ok: rec.state === 'inspected', record: rec, reason: rec.reason || null }; }
  function approveConcept(id, userTap) { const q = store.load('admission_queue'); const rec = q.find(x => x.id === id); if (!rec || rec.state !== 'inspected') return { ok: false, reason: 'only an inspected record can be approved' }; if (userTap !== true) return { ok: false, reason: 'ADM-USER-TAP-REQUIRED' };
    const r = addConcept({ surface: rec.surface, gloss: rec.gloss, category: rec.category, example: rec.example, supersede: rec.supersede }); if (!r.ok) { rec.state = 'rejected'; rec.reason = r.reason; store.save('admission_queue', q); return r; }
    const c = user.find(x => x.id === r.concept.id && x.version === r.concept.version); if (c) { c.license = rec.licence; c.evidence = rec.evidence; c.admission = rec.id; c.content_sha256 = rec.content_sha256; c.doc8_state = 'admitted (quarantine → inspected → user-approved)'; store.save('lexicon_user', user); reindex(); }
    rec.state = 'admitted'; rec.admitted_at = new Date().toISOString(); rec.concept = r.concept.id + ' v' + r.concept.version; store.save('admission_queue', q); return { ok: true, concept: c || r.concept, record: rec }; }
  function rejectConcept(id, reason) { const q = store.load('admission_queue'); const rec = q.find(x => x.id === id); if (!rec || rec.state === 'admitted') return { ok: false }; rec.state = 'rejected'; rec.reason = String(reason || 'user rejected'); store.save('admission_queue', q); return { ok: true, record: rec }; }
  const exc = x => (wn.core && own(wn.core.exc, x) ? wn.core.exc[x] : undefined);
  const known = w => !!(G.CL[w] || wnEntry(w) || ix[w] || G.lemmatize(w, { hasPos, exc, controlled }).length);
  const isName = w => { const e = wnEntry(w); return !!(e && e.some(([p, ss]) => p === 'n' && ss.some(s => s[1] === 15 || s[1] === 18))); };
  const isProper = w => ['core', 'ext', 'pro'].some(t => wn[t] && Array.isArray(wn[t].P) && (wn[t]._P || (Object.defineProperty(wn[t], '_P', { value: new Set(wn[t].P), enumerable: false }), wn[t]._P)).has(w)); /* 4.9.92 PROPER-NOUN FLAG (tools/build_propn.py): WordNet writes the word only with its capital */
  const lexnameOf = l => { const e = wnEntry(l); if (!e) return null; const n = e.find(x => x[0] === 'n'); return n && wn.core ? wn.core.meta.lexnames[n[1][0][1]] : null; };
  const coreNoun = w => [...new Set([w, w.replace(/ies$/, 'y'), w.replace(/es$/, ''), w.replace(/s$/, '')])].some(x => { const e = wnDirect(x); return !!(e && e.some(y => y[0] === 'n') && (x !== w || !isName(x))); }); /* 4.9.50: a common noun of any tier (or its plural) is not read as a sentence-initial name */
  const tierPos = (l, p) => { for (const [k, t] of [[0, 'core'], [1, 'ext'], [2, 'pro']]) if (wn[t] && own(wn[t].L, l) && wn[t].L[l].some(e => e[0] === p)) return k; return prov.has(l) ? 3 : 4; };
  return { setStrict: b => { strict = !!b; }, isStrict: () => strict, setConvo: s => { convo = s instanceof Set ? s : new Set(); }, provWords: () => [...provInfo.keys()].filter(l => /^LX-PROVISIONAL/.test(provInfo.get(l).rule)), tierPos, tier: l => (wn.core && own(wn.core.L, l) ? 0 : wn.ext && own(wn.ext.L, l) ? 1 : wn.pro && own(wn.pro.L, l) ? 2 : prov.has(l) ? 3 : 4), derive, provisional, provInfo: l => provInfo.get(l) || null, LICENCES, proposeConcept, inspectConcept, approveConcept, rejectConcept, admissions: () => store.load('admission_queue'), lookup, addConcept, all, controlled, hasPos, senses, known, isName, isProper, lexnameOf, exc, coreNoun, doc45: l => controlled(l).filter(c => String(c.id).startsWith('C.') && c.surfaces[0] === l), doc45of: l => (L.DOC45_OF && L.DOC45_OF[l]) || null,
    attach(data, tier) { wn[tier] = data; if (data && data.exc) G.learnExc(data.exc); },
    stats() { return { controlled: all().filter(c => !c.retired).length, user_admitted: user.length, wordnet_core: wn.core ? Object.keys(wn.core.L).length : 0, wordnet_extended: wn.ext ? Object.keys(wn.ext.L).length : 0, wordnet_complete: wn.pro ? Object.keys(wn.pro.L).length : 0, wn_meta: wn.core ? wn.core.meta.stats : null }; },
    count: () => all().filter(c => !c.retired).length + (wn.core ? Object.keys(wn.core.L).length : 0) + (wn.ext ? Object.keys(wn.ext.L).length : 0) + (wn.pro ? Object.keys(wn.pro.L).length : 0), wn };
}

const NUMW = Object.assign(Object.create(null), { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000 });
/* MATH-FRAME (4.9.92; replaces the phrase prefix strip): the expression is the span from its first operand or operator word to the end; what
   precedes it is the question frame, accepted only when every word of it is a frame word (frame(w): a closed-class wh-word, copula, auxiliary,
   quantifier or determiner, or a verb of calculation by its WordNet gloss). With do-support ("what does X equal") the final bare verb belongs to
   the frame. No frame hook: no frame words are accepted (the expression must stand alone). */
function mathSurface(s, frame) { const tw = String(s).trim().split(/\s+/); const opnd = w => /^[\d(√−-]/.test(w) || w in NUMW || /^(sqrt|square|add|sum|subtract|multiply|divide)$/.test(w) || /^(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)-/.test(w);
  let k = tw.findIndex((w, i) => opnd(w) || (w === 'the' && tw[i + 1] === 'square')); if (k < 0) return null; const pre = tw.slice(0, k); if (!pre.every((w, i) => !!frame && (frame(w, pre[i - 1]) || pre[i - 1] === 'how' /* the wh-degree phrase "how much" */))) return null;
  let body = tw.slice(k); if (pre.some(w => /^(do|does|did)$/.test(w)) && body.length > 1 && !opnd(body[body.length - 1]) && frame && frame.verb && frame.verb(body[body.length - 1])) body = body.slice(0, -1);
  /* a free relative ("tell me what 2 plus 2 is"): the wh-word in the frame leaves its copula after the expression */
  if (frame && pre.some(w => (G.CL[w] || []).includes('WH')) && body.length > 1 && (G.CL[body[body.length - 1]] || []).includes('COP')) body = body.slice(0, -1);
  let t = body.join(' ');
  t = t.replace(/^(add|sum) (.+?) (?:and|to) (.+)$/, '($2) + ($3)').replace(/^subtract (.+?) from (.+)$/, '($2) - ($1)').replace(/^multiply (.+?) (?:by|and) (.+)$/, '($1) * ($2)').replace(/^divide (.+?) by (.+)$/, '($1) / ($2)');
  t = t.replace(/\bthe square root of\b|\bsquare root of\b|\bsqrt of\b|√/g, ' sqrt ').replace(/(\S+) percent of (\S+)/g, '($1/100*$2)')
    .replace(/\bmultiplied by\b|\btimes\b|×/g, ' * ').replace(/\bdivided by\b|\bover\b|÷/g, ' / ').replace(/\bplus\b/g, ' + ').replace(/\bminus\b|−/g, ' - ')
    .replace(/\bto the power of\b|\braised to\b/g, ' ^ ').replace(/\bsquared\b/g, ' ^ 2 ').replace(/\bcubed\b/g, ' ^ 3 ');
  t = t.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[- ](one|two|three|four|five|six|seven|eight|nine)\b/g, (m, a, b) => String(NUMW[a] + NUMW[b]));
  t = t.replace(/\b([a-z]+)\b/g, w => (w in NUMW ? String(NUMW[w]) : w)).replace(/\s+/g, ' ').trim();
  if (!/\d/.test(t) || /[a-z]/.test(t.replace(/sqrt/g, ''))) return null; if (!/[-+*/^]|sqrt/.test(t)) return null; return t;
}
const algebraText = s => s.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/²/g, '^2').replace(/\s+/g, ' ').trim();

const SENSITIVE = /\b(pin|password|passcode|passphrase|secret|code|ssn|passport|cvv|cvc|iban|token|key|login|combination|card number|account number|routing number|security number|license number|licence number|seed phrase|recovery phrase)\b/;
const P = isNode ? require('./privacy.js') : root.KPrivacy;
const Gv = isNode ? require('./governance.js') : root.KGov; const CT = isNode ? require('./containment.js') : root.KContain;
const SINGLE_ATTR = new Set('name age birthday address phone email job colour color favorite favourite capital height weight number surname nickname'.split(' '));
const EXCLUSIVE = [new Set('red blue green yellow black white orange purple pink brown gray grey silver gold'.split(' ')), new Set(['alive', 'dead']), new Set(['married', 'single', 'divorced']), new Set(['open', 'closed']), new Set(['true', 'false']), new Set(['hot', 'cold', 'warm']), new Set(['happy', 'sad']), new Set(['young', 'old'])];
const SINGLE_VERB = new Set(['live', 'reside', 'work']);

function Kernel(opts) {
  opts = opts || {};
  /* private case files (4.9.42, plan §2): while a case is open, the case-scoped stores are a separate namespace case:<id>:<store>; nothing outside the case
     sees them, and the shared layer reads only the global namespace (SHARED-CASEFILE-NEVER-SHARED). At rest a closed case is sealed with the vault key. */
  /* M1 (4.9.57): every route proposes inside a sandbox; store writes made while a route proposes go to a transaction overlay (TX, nestable) and
     only the selected candidate's overlay is committed. Nothing a losing route did reaches memory. */
  let caseNS = null; const CASE_CATS0 = new Set(['memory', 'evidence', 'cold_storage', 'reminders', 'trace', 'justifications', 'withdrawal_receipts', 'world_state', 'world_head', 'world_head_stage']);
  const LS = KS.Layered(opts.store || MemoryStore(), c => (caseNS && CASE_CATS0.has(c) ? caseNS + ':' + c : c)); /* 4.9.212 C1: TX overlay + case namespace in kstore.js */
  const baseStore = LS.baseStore;
  let pendingCase; const CASE_CATS = CASE_CATS0;
  const store = LS.store;
  /* GKS shared facts: the build-manifest seed plus facts ingested from a verified GKS snapshot (store gks_facts); read-only premises with provenance */
  const gksFacts = () => { const st = baseStore.load('gks_facts') || []; return KN.SEED.filter(f => !st.some(x => x.id === f.id)).concat(st).filter(f => f.status !== 'retracted'); };
  /* nouns of shared-fact subjects are lexicon entries supplied by the shared layer (grow by lexicon, not by phrases) */
  let gksN = null, gksNSig = ''; const GKS_N = () => { const fs = gksFacts(), sig = fs.length + ':' + (fs[fs.length - 1] || {}).id; if (gksN && sig === gksNSig) return gksN; gksNSig = sig; gksN = new Set(); for (const f of fs) for (const t of [f.subject].concat(f.aliases || []).join(' ').toLowerCase().split(/\s+/)) if (!G.CL[t]) gksN.add(t); return gksN; };
  const npKey = n => { const y = JSON.parse(JSON.stringify(G.material(n))); delete y.det; delete y.plural; delete y.adjs; return canon(Object.assign(y, { adjs: (G.material(n).adjs || []) })); };
  let gksIdx = null, gksSig = '';
  const gksIndex = () => { const fs = gksFacts(), sig = fs.map(f => f.id + f.status).join('|'); if (gksIdx && sig === gksSig) return gksIdx; gksSig = sig;
    gksIdx = fs.map(f => { const keys = [f.subject].concat(f.aliases || []).map(t => npOnly(G.tokenize(t))).filter(Boolean).map(npKey); let clause = null; try { const d = derive(G.tokenize(f.text.replace(/[.]$/, ''))); clause = d.parses.length === 1 ? d.parses[0].node.clause : null; } catch (e) { clause = null; } const quals = (f.qualifiers || []).map(q => { const n = npOnly(G.tokenize(q.np)); return n ? q.prep + ' ' + npKey(n) : null; }).filter(Boolean); return { f, keys, clause, quals }; }); return gksIdx; };

  const lex = Lexicon(store);
  if (opts.lexicon) lex.attach(opts.lexicon, 'core'); if (opts.lexiconExt) lex.attach(opts.lexiconExt, 'ext'); if (opts.lexiconPro) lex.attach(opts.lexiconPro, 'pro');
  let meta = Object.assign({ turn: 0, loop: 1, chi: 0, phaseHistory: [], last: null, discourse: [], alias: {}, pending: null, notation: 'plain', reasoning: null }, store.load('meta'));
  const saveMeta = () => store.save('meta', meta);
  const now = () => (opts.clock ? opts.clock() : new Date().toISOString());
  const perm = opts.perm || Gv.PermissionService(store, { clock: now }); const cont = CT.Containment(store, { clock: now, perm }); const bench = TB.Bench(store, { clock: now, perm });
  
  const glex = { hasPos: (l, p) => lex.hasPos(l, p) || (p === 'v' && SELF_V.has(l)) || (p === 'n' && (SELF_N.has(l) || GKS_N().has(l))), /* Forge's own self-query words are lexicon entries of the kernel (closed class), so they parse even with no WordNet lexicon */ exc: lex.exc, tier: lex.tier, tierPos: lex.tierPos, derive: lex.derive, provisional: (l, p) => (lex.isStrict() ? null : lex.provisional(l, p)), provisionalOK: () => !lex.isStrict(), lexnameOf: w => (lex.lexnameOf && !(lex.provInfo && lex.provInfo(w)) ? lex.lexnameOf(w) : null), /* 4.9.82: a word known only by derivation has no lexicographer class here */ controlled: lex.controlled, known: w => lex.known(w) || GKS_N().has(String(w).toLowerCase()), isName: lex.isName, isProper: lex.isProper, entityName: w => memNames().get(w) || null, /* 4.9.92: a word the stored facts hold as a name (or as a common noun) keeps that reading at the start of a sentence */ coreNoun: lex.coreNoun,
    /* 4.9.48: verb complement frames are lexicon facts (WordNet 3.0 generic frames of the lemma's verb senses), read by grammar.js */
    vclasses: l => lex.senses(l).filter(s => s.pos === 'v').map(s => s.lexname), /* WordNet lexicographer classes of the verb senses, most frequent first */
    vframes1: l => { const FR = lex.wn.core ? lex.wn.core.meta.verb_frames : null; const s = FR && lex.senses(l).find(x => x.pos === 'v'); return s ? s.frames.map(f => FR[f]).filter(Boolean) : []; },
    vframes: (() => { const cache = new Map(); return l => { const FR = lex.wn.core ? lex.wn.core.meta.verb_frames : null; if (!FR) return []; const k = l + '|' + (lex.wn.ext ? 1 : 0) + (lex.wn.pro ? 1 : 0); if (!cache.has(k)) cache.set(k, [...new Set(lex.senses(l).filter(s => s.pos === 'v').flatMap(s => s.frames))].map(f => FR[f]).filter(Boolean)); return cache.get(k); }; })(),
    doc45of: l => lex.doc45of(l) };
  
  /* 4.9.66 MEMORY-WRITE RULE. A plain statement ("Rex is in Paris") is a WORKING fact: it lives for this conversation only (this kernel instance,
     never persisted, never synced, never in the durable world), it is checked against the known facts (stored + working) and a contradiction
     is asked about before either side changes. Lasting memory only on an explicit "remember …" or a confirm tap (promoteWorking). Working facts
     are premises like stored ones: answers that use them carry their wf: id, and retracting one withdraws its dependents (M2). */
  const working = [];
  const storedFacts = () => store.load('memory').filter(r => r.kind !== 'note' && r.status === 'active');
  const activeFacts = () => storedFacts().concat(working.filter(w => w.status === 'active'));

  let memNamesKey = null, memNamesMap = new Map(); const memNames = () => { let fs; try { fs = activeFacts(); } catch (e) { return memNamesMap; } const key = fs.length + ':' + (fs.length ? fs[fs.length - 1].id : ''); if (key === memNamesKey) return memNamesMap; const m = new Map();
    const walk = o => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk); if (typeof o.propn === 'string' && /^[A-Z]/.test(o.propn) && !o.propn.includes(' ')) m.set(o.propn.toLowerCase(), 'name'); if (Array.isArray(o.head) && o.head.length === 1 && !m.has(o.head[0])) m.set(o.head[0], 'common'); for (const v of Object.values(o)) walk(v); };
    for (const f of fs) if (!f.sensitive) walk(f.clause); memNamesKey = key; memNamesMap = m; return m; };
  
  function retractWorking(id, status, by) { const w = working.find(x => x.id === id && x.status === 'active'); if (!w) return null; w.status = status; w.changed_by = by || null; return w; }
  
  const { reparseClause, derive, content, swapToks, reparseClause0, outward } = (isNode ? require('./panini_wording.js') : root.KPaniniWording).Wording({ G, glex, lex, featsOf, M, clone, canon, activeFacts, memNames }); /* 4.9.212: moved to panini_wording.js (same API) */

  function npOnly(toks) { toks = content(toks); const P = G.Parser(toks, glex); const r = P.np(0).filter(x => x.i === toks.length); return r.length ? clone(r[0].node) : null; }
  /* 4.9.87: the question's subject as the noun phrase it is in the question (its determiner kept), so a reply can name it as a role */
  function subjectNP(raw) { let lp = null; try { lp = lookupPlan(raw); } catch (e) { return null; } const sw = lp && (lp.subject || lp.entity || lp.object); if (!sw) return null; const toks = G.tokenize(raw); let ws = String(sw).split(' '); { const Pw = G.Parser(G.tokenize(ws.join(' ')), glex); const k = ws.findIndex((w, j) => j > 0 && w !== 'of' && Pw.at(j, 'PREP').length && !Pw.at(j, 'N').length); if (k > 0) ws = ws.slice(0, k); } /* G-ECONOMY: a PP after the subject's head attaches to the verb ("in 1776"), not to the subject */
    const i = toks.findIndex((t, k) => ws.every((w, j) => toks[k + j] && toks[k + j].w === w)); if (i < 0) { try { return npOnly(G.tokenize('the ' + ws.join(' '))); } catch (e) { return null; } } /* a subject the compiler assembled (ADJ + wh head) is a definite NP */ const j0 = i > 0 && G.CL[toks[i - 1].w] && G.CL[toks[i - 1].w].includes('DET') ? i - 1 : i;
    let e = i + ws.length; if (toks[e] && toks[e].w === 'of') { const P = G.Parser(toks, glex); let lim = e + 1; while (lim < toks.length && !(toks[lim].w !== 'of' && P.at(lim, 'PREP').length && !P.at(lim, 'N').length)) lim++; for (let k = lim; k > e + 1; k--) { let n = null; try { n = npOnly(toks.slice(j0, k)); } catch (x) { n = null; } if (n) { e = k; break; } } } /* an of-phrase belongs to its head ("the capital of France") */
    try { return npOnly(toks.slice(j0, e)); } catch (e2) { return null; } }
  /* the wh-phrase's head noun names what the question asks for ("which planet …" asks for a planet) */
  function askedNP(raw) { let lp = null; try { lp = lookupPlan(raw); } catch (e) { return null; } if (!lp || !lp.whHead) return null; try { return npOnly(G.tokenize('the ' + lp.whHead)); } catch (e) { return null; } }
  const reparseNP = text => npOnly(swapToks(text));

  function entKey(n) { if (!n) return null; let k;
    if (n.pron === 'user') k = 'user'; else if (n.pron === 'kernel') k = 'kernel'; else if (n.propn) k = 'name:' + n.propn.toLowerCase(); else if (n.quote !== undefined) k = 'quote:' + n.quote;
    else if (n.conj) k = 'conj:' + n.conj.map(entKey).join('+'); else if (n.num && !n.head) k = 'num:' + n.num;
    else { const own = n.owner === 'user' ? 'user/' : n.owner === 'kernel' ? 'kernel/' : n.owner && typeof n.owner === 'object' && !n.owner.pron3 ? entKey(n.owner) + '/' : ''; k = (own || 'thing:') + (n.head || []).join(' ') + (n.of ? ' of ' + entKey(n.of) : ''); }
    return meta.alias[k] || k; }
  const entKeys = n => (n && n.conj ? n.conj.map(entKey) : [entKey(n)]);
  function featsOf(n) { if (n.propn) { const ln = lex.isName(n.propn.toLowerCase()) ? lex.lexnameOf(n.propn.toLowerCase()) : null; return ln === 'noun.location' ? { g: 'n', anim: false, n: 'sg' } : { g: 'u', anim: true, n: 'sg' }; } if (n.conj) return { g: 'u', anim: true, n: 'pl' }; const h = n.head && n.head[n.head.length - 1]; if (!h) return { g: 'n', anim: false, n: 'sg' };
    const num = n.plural ? 'pl' : 'sg'; if (G.FEMALE.has(h)) return { g: 'f', anim: true, n: num }; if (G.MALE.has(h)) return { g: 'm', anim: true, n: num };
    const ln = lex.lexnameOf(h); if (G.PERSONISH.has(h) || ln === 'noun.person') return { g: 'u', anim: true, n: num }; return { g: 'n', anim: false, animal: ln === 'noun.animal', n: num }; }
  function nps(c, out) { out = out || []; if (!c) return out; if (c.coord) { c.coord.forEach(x => nps(x, out)); return out; }
    const visit = n => { if (!n || typeof n !== 'object') return; if (n.clause) { nps(n.clause, out); return; } out.push(n); if (n.conj) n.conj.forEach(visit); if (n.owner && typeof n.owner === 'object') visit(n.owner); if (n.of) visit(n.of); if (n.pp) visit(n.pp.np); if (n.rel) nps(Object.assign({}, n.rel, { subj: null }), out); };
    visit(c.subj); if (c.pred && c.pred.np) visit(c.pred.np); for (const v of Object.values(c.roles || {})) visit(v); for (const a of c.adj || []) if (a.np) visit(a.np); if (c.cond) nps(c.cond, out); return out; }

  const predOf = c => (c && c.verb ? c.verb.lemma : null);
  /* stored facts as binary relation edges (typed relations first, then any two-entity clause) — the anchors of exploration and the facts admitted rules run over */
  function ruleEdges(mem) { const edges = INF.relEdges(mem).map(e => Object.assign({}, e)); const typed = new Set(edges.map(e => e.id));
    for (const r of mem) { if (typed.has(r.id) || !r.entities || r.entities.length !== 2 || r.clause.coord || r.clause.cond) continue; edges.push({ id: r.id, a: r.entities[0], b: r.entities[1], rel: r.pred === 'be' ? 'isa' : r.pred, neg: r.clause.verb && r.clause.verb.pol === 'neg' }); } return edges; }
  const { ensureStarter, starterView, clearStarterKnowledge, previewImport, importConfirmedPack, admitImportItem, clearImportPack, importView, confirmedSharedView, sharedKnowledgeView, pullHostedSharedPack, writeSharedKnowledge, setSharedKbWriteKey, clearSharedKbWriteKey, admitConfirmedShared, admitConfirmedSharedItem, clearConfirmedShared, clearHostedSharedKnowledge } = (isNode ? require('./kpacks.js') : root.KPacks).Packs({ store, nps, entKey, reparseClause, G, sha256 }); /* 4.9.212: moved to kpacks.js (same API) */

  const ruleFacts = mem => ruleEdges(mem).map(e => ({ id: e.id, atom: { predicate: e.rel, args: [e.a, e.b], polarity: e.neg ? 'neg' : 'pos' } }));
  const admittedRules = () => store.load('admitted_rules').filter(r => r.status === 'admitted').map(r => r.rule);
  /* M3 (4.9.60) DURABLE WORLD STATE. The world the user has authorized: every active stored fact (memory written by an explicit "remember"
     or a confirmed correction) read by the world grammar as an atom with provenance. Entities, relations (binary atoms) and attributes (unary
     atoms) are rebuilt from memory whenever memory changes; relations derived by the DECLARED relation properties (world_rules.js RELATIONS) are
     ledger items (M2) with their proof as the justification, so retraction keeps the state consistent. The turn world (incl. "Suppose …")
     never writes here: only stored facts do. Nothing here is a fact store of its own and nothing leaves the device. */
  const DWS_SCHEMA = 'FORGE-WORLD-STATE/v1';
  function durableAtoms(facts) { const out = []; for (const r of facts) { if (!r.clause || r.clause.coord || r.clause.cond || r.sensitive) continue; let a = null; try { a = R.parseAtomic(G.clauseText(r.clause, 'kernel'), false); } catch (e) { a = null; }
      if (a && a.args.every(x => typeof x === 'string' && !/^(?:any_|\$)/.test(x))) out.push({ id: r.id, atom: a, rec: r }); } return out; }
  const relRulesFor = preds => { const seen = new Set(), out = []; for (const p of preds) for (const r of WR.propertyDataRules(p)) if (!seen.has(r.id)) { seen.add(r.id); out.push(r); } return out; };

  function dwsBuild(turn) { const mem = storedFacts().filter(r => !r.sensitive), sig = sha256(canon(mem.map(r => [r.id, r.status]))), old = store.load('world_state');
    if (old && !Array.isArray(old) && old.signature === sig) return { changed: false, state: old };
    const A = durableAtoms(mem), ents = new Map(), rels = [], attrs = [], prov = f => ({ premise: f.id, turn: f.rec.provenance && f.rec.provenance.turn != null ? f.rec.provenance.turn : f.rec.turn != null ? f.rec.turn : null, source: 'stored fact', text: tmsText(memText(f.rec)) });
    const ent = (k, f) => { if (!ents.has(k)) ents.set(k, { id: 'ent:' + k, name: k.replace(/_/g, ' '), first: prov(f), premises: [] }); const e = ents.get(k); if (!e.premises.includes(f.id)) e.premises.push(f.id); };
    for (const f of A) { for (const x of f.atom.args) ent(x, f); if (f.atom.args.length === 2) rels.push(Object.assign({ pred: f.atom.predicate, a: f.atom.args[0], b: f.atom.args[1], polarity: f.atom.polarity, origin: 'stated', text: R.atomText(f.atom) }, prov(f))); else attrs.push(Object.assign({ entity: f.atom.args[0], attr: f.atom.predicate, polarity: f.atom.polarity, text: R.atomText(f.atom) }, prov(f))); }
    const rules = relRulesFor(new Set(A.filter(f => f.atom.args.length === 2).map(f => f.atom.predicate))), derived = [];
    if (rules.length) { try { const F = A.map(f => ({ id: f.id, atom: f.atom })), rw = R.ruleWorld(F, rules), stated = new Set(F.map(f => R.atomKey(f.atom)));
      for (const a of rw.atoms().filter(a => a.args.length === 2 && !stated.has(R.atomKey(a))).slice(0, 400)) { const pr = rw.prove(a); if (!pr) continue; const text = tmsText(R.atomText(a)), id = 'rel:' + sha256(R.atomKey(a)).slice(0, 20);
        const premises = pr.fact_ids.filter((x, i, xs) => xs.indexOf(x) === i).map(pid => { const f = A.find(y => y.id === pid); return { id: pid, text: f ? tmsText(memText(f.rec)) : null }; });
        TMS.justify({ id, kind: 'relation', text, key: R.atomKey(a), turn }, { premises, rules: pr.rule_ids.slice(), derivation_rules: ['INF-RELPROP'], selection: null, replay: { kind: 'relprop', proof_id: pr.proof_id, atom: a }, turn });
        derived.push({ pred: a.predicate, a: a.args[0], b: a.args[1], polarity: a.polarity, origin: 'derived', text, item: id, premises: premises.map(p => p.id), rules: pr.rule_ids.slice(), proof: pr.proof_id }); } } catch (e) { /* a closure over the stored facts that fails is simply not derived */ } }
    /* 4.9.98 temporal stub: non-overlapping kāla years are the same `before` relation, recomputed from stored facts. Not a ledger item and not a new store. */
    const bare = k => String(k || '').replace(/^(?:thing|name):/, '').replace(/_/g, ' ');
    const yp = INF.yearPairs(mem);
    for (const p of yp.pairs) { if (rels.concat(derived).some(r => r.pred === 'before' && r.a === p.a && r.b === p.b && r.polarity === 'pos')) continue;
      derived.push({ pred: 'before', a: p.a, b: p.b, polarity: 'pos', origin: 'derived', text: bare(p.a) + ' is before ' + bare(p.b), premises: p.ids, rules: ['TEMPORAL-YEAR-ORDER'] }); }
    for (const iv of yp.intervals) attrs.push({ entity: iv.key, attr: 'interval', polarity: 'pos', origin: 'derived', start: iv.start, end: iv.end, years: iv.years, unit: 'year', premises: iv.ids, text: iv.start + '–' + iv.end, rules: ['TEMPORAL-YEAR-INTERVAL'] });
    const state = { schema: DWS_SCHEMA, signature: sig, built_turn: turn, entities: [...ents.values()].sort((x, y) => x.id.localeCompare(y.id)), relations: rels.concat(derived), attributes: attrs, relation_properties: [...new Set(rules.map(r => r.id))].sort(), note: 'derived from stored facts only; the turn world and "Suppose" branches never write here' };
    return { changed: true, state }; } /* 4.9.105: the projection is saved only after the world head readback */
  /* the view with ledger status: a derived relation whose justifications all lost a premise is listed as withdrawn (with its receipt), never silently dropped */
  function projectView(state) { const s = state == null ? store.load('world_state') : state; if (!s || Array.isArray(s)) return { schema: DWS_SCHEMA, entities: [], relations: [], attributes: [], withdrawn: [] };
    const withdrawn = TMS.list().filter(x => x.kind === 'relation' && x.status === 'withdrawn').map(x => ({ item: x.id, text: x.text, receipt: (x.history.filter(h => h.status === 'withdrawn').pop() || {}).receipt || null }));
    return Object.assign({}, s, { relations: s.relations.filter(r => r.origin === 'stated' || (r.rules || []).includes('TEMPORAL-YEAR-ORDER') || (TMS.get(r.item) || {}).status === 'in'), withdrawn }); } /* 4.9.98: a year-order row is recomputed from stored facts, so it has no ledger item */
  function worldStateView() { return projectView(null); }
  /* 4.9.105 W_v. A WorldSnapshot is the selectable world head. MemoryStore's generation is only the storage pointer.
     The head is published after a staged readback. A failed stage leaves the previous head selectable and does not save the new projection. */
  const WV_SCHEMA = 'forge-world-state/v1', WV_ID = 'world:local';
  const wvBy = (a, b) => { const x = canon(a), y = canon(b); return x < y ? -1 : x > y ? 1 : 0; };
  function worldBody(view) { const v = view || { entities: [], relations: [], attributes: [], withdrawn: [] };
    return { entities: (v.entities || []).map(e => [e.id, (e.premises || []).slice().sort()]).sort(wvBy),
      relations: (v.relations || []).map(r => [r.origin || null, r.pred, r.a, r.b, r.polarity, r.premise || null, r.item || null, (r.premises || []).slice().sort(), (r.rules || []).slice().sort()]).sort(wvBy),
      attributes: (v.attributes || []).map(a => [a.origin || 'stated', a.entity || null, a.attr, a.polarity, a.premise || null, a.text || null, (a.premises || []).slice().sort()]).sort(wvBy),
      withdrawn: (v.withdrawn || []).map(w => [w.item, w.receipt || null]).sort(wvBy) }; }
  const emptyFactSig = sha256(canon([])); /* the signature dwsBuild records when no stored fact is in the projection */
  const worldContentHash = (view, factSig) => sha256(canon([worldBody(view), factSig == null ? emptyFactSig : factSig]));
  const wvGen = () => (typeof store.generation === 'function' ? store.generation() : 0);
  function storedHead() { const h = store.load('world_head'); return h && !Array.isArray(h) && h.schema === WV_SCHEMA && h.version_id ? h : null; }
  function implicitHead() { const content_hash = worldContentHash(null, emptyFactSig), storage_generation = wvGen(), parent_versions = [];
    return { schema: WV_SCHEMA, world_id: WV_ID, version_id: 'wv:' + sha256(canon([WV_ID, content_hash, parent_versions, storage_generation])).slice(0, 24), parent_versions, content_hash, commit_receipt: null, storage_generation, invalidated: [], committed: false }; }
  function liveHead() { const s = storedHead(); return s ? Object.assign({}, s, { committed: true, parent_versions: (s.parent_versions || []).slice(), invalidated: (s.invalidated || []).slice() }) : implicitHead(); }
  function publishWorldHead(view, pendingState, turn, withdrawnIds) { const factSig = (pendingState && pendingState.signature) || (view && view.signature) || emptyFactSig, content_hash = worldContentHash(view, factSig), prev = storedHead(), storage_generation = wvGen(), base = prev ? Object.assign({}, prev, { committed: true, parent_versions: (prev.parent_versions || []).slice(), invalidated: (prev.invalidated || []).slice() }) : implicitHead();
    const same = !!(prev && prev.content_hash === content_hash), emptySame = !prev && content_hash === implicitHead().content_hash && !(withdrawnIds && withdrawnIds.length);
    if (same || emptySame) { if (pendingState) store.save('world_state', pendingState); return { ok: true, skipped: true, head: base }; }
    const parent_versions = prev ? [prev.version_id] : [], invalidated = (withdrawnIds || []).slice();
    const version_id = 'wv:' + sha256(canon([WV_ID, content_hash, parent_versions, storage_generation, invalidated, turn])).slice(0, 24);
    const commit_receipt = 'wrc:' + sha256(canon([version_id, content_hash, parent_versions])).slice(0, 24);
    const next = { schema: WV_SCHEMA, world_id: WV_ID, version_id, parent_versions, content_hash, commit_receipt, storage_generation, invalidated, recorded_turn: turn };
    store.save('world_head_stage', next);
    try { if (typeof opts.worldPublishFault === 'function') opts.worldPublishFault(next); } catch (e) { return { ok: false, rule: 'WV-STAGE-ABORTED', head: base }; }
    const staged = store.load('world_head_stage');
    if (!staged || Array.isArray(staged) || staged.version_id !== version_id || staged.content_hash !== content_hash || staged.commit_receipt !== commit_receipt) return { ok: false, rule: 'WV-STAGE-MISMATCH', head: base };
    const priorProjection = store.load('world_state');
    if (pendingState) store.save('world_state', pendingState);
    store.save('world_head', staged);
    const live = store.load('world_head');
    const restore = () => { if (prev) store.save('world_head', prev); else store.save('world_head', []); if (pendingState) store.save('world_state', Array.isArray(priorProjection) ? [] : priorProjection); };
    if (!live || Array.isArray(live) || live.version_id !== version_id || live.content_hash !== content_hash) { restore(); return { ok: false, rule: 'WV-HEAD-UNREADABLE', head: base }; }
    const proj = store.load('world_state');
    if (pendingState && (!proj || Array.isArray(proj) || proj.signature !== pendingState.signature)) { restore(); return { ok: false, rule: 'WV-PROJECTION-MISMATCH', head: base }; }
    return { ok: true, head: Object.assign({}, live, { committed: true, parent_versions: (live.parent_versions || []).slice(), invalidated: (live.invalidated || []).slice() }) }; }
  /* GELC promotion gate: the rule must be range-restricted, must PROVE its own claim from stored facts (RuleProof replayed by the independent checker),
     and the rule together with every admitted rule must derive nothing whose opposite is stated. A high score or a tap alone never admits. */
  function admissionCheck(rule, claim) { const facts = ruleFacts(storedFacts().filter(r => !r.sensitive)), all = admittedRules().concat([rule]); let rw;
    try { rw = R.ruleWorld(facts, all); } catch (e) { return { ok: false, rule: 'ADM-UNSAFE-RULE' }; }
    const F = facts.filter(f => canon(f.atom) !== canon(claim)); let pr = null; try { pr = R.ruleWorld(F, all).prove(claim); } catch (e) { pr = null; } /* held out: the claim must follow from the OTHER facts through the rule */
    if (!pr || !pr.rule_ids.includes(rule.id) || !R.checkRuleProof(F, all, pr).ok) return { ok: false, rule: 'ADM-NO-REPLAYED-SUPPORT' };
    const stated = new Set(facts.map(f => canon(f.atom))), bad = rw.atoms().filter(a => stated.has(canon(Object.assign({}, a, { polarity: a.polarity === 'neg' ? 'pos' : 'neg' }))));
    return bad.length ? { ok: false, rule: 'ADM-CONTRADICTS-STATED', conflicts: bad } : { ok: true, proof: pr, support: pr.fact_ids }; }
  
  const restr = n => n && !n.conj && (n.rel || n.relObj) ? canon(G.material(n.rel || n.relObj)) : null; /* LL-RESTRICTOR-EXACT: a relative clause restricts its head ("eagles that can fly" ≠ "eagles that fly"); a question restrictor must equal the stored one — no inflation from a looser or different restrictor */
  const subjMatch = (qs, rs) => { if (!qs) return true; if (rs && restr(qs) !== null && restr(qs) !== restr(rs)) return false; /* a restricted fact never answers an unrestricted yes/no (see exact) */ const b = entKeys(rs); return entKeys(qs).every(k => b.includes(k)); };

   /* missing packet → sealed (Axiom 4) */

   /* per-turn: RPMC-gated CS ancestors handed to AQ-1/research as candidates */

  let sideRules = [];  let stagedHyps = [];  let phoneProposals = [];  let meaPProposals = [];    
  /* M2 (4.9.59) TRUTH MAINTENANCE. Every derived item Forge keeps or carries across turns — an answer's conclusion (world proof, stored-fact
     inference, recall), a staged or approved hypothesis, an admitted rule — is a ledger item (justify.js) with every justification it ever had:
     the exact premise ids + texts, the rule ids, the selection record that produced it and a replay recipe. A premise that leaves (forget,
     supersede, a withdrawn rule or hypothesis) withdraws every dependent item transitively unless another justification survives; a withdrawn
     item is marked with a receipt, never deleted. The ledger is bookkeeping like the trace (case-scoped), not memory: nothing in it is a fact. */
  const TMS = JT.Ledger(store, { clock: now });
  const tmsText = t => String(t == null ? '' : t).replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '');
  const memText = r => (r.clause ? G.clauseText(r.clause, 'kernel') : r.text || r.clause_text || r.id);
  function tmsIsIn(id) { id = String(id);
    if (/^wf:/.test(id)) { const w = working.find(x => x.id === id); return w && (w.status === 'active' || w.status === 'promoted') ? { in: true, status: w.status === 'active' ? 'working' : 'promoted to memory' } : { in: false, status: w ? w.status : 'absent (conversation ended)' }; }
    if (/^mem:/.test(id)) { const r = store.load('memory').find(x => x.id === id); if (r && r.status === 'active') return { in: true, status: 'active' };
      const c = store.load('cold_storage').filter(x => x.record && x.record.id === id).pop(); return { in: false, status: r ? r.status : c ? c.record.status || 'cold' : 'absent', why: c ? c.reason : null }; }
    if (/^gks:/.test(id)) { const e = gksIndex().find(x => x.f.id === id); return e && e.f.status === 'active' ? { in: true, status: 'active' } : { in: false, status: e ? e.f.status : 'absent' }; }
    { const m = /^RELPROP-(TRANSITIVE|SYMMETRIC):([a-z_]+)$/.exec(id); if (m && MEA.rows().includes(m[2])) { const i = WR.relInfo(m[2]); return { in: !!(i && i.row[m[1].toLowerCase()]), status: i && i.row[m[1].toLowerCase()] ? 'declared' : 'not declared by the active manifest' }; } } /* M5: a property rule is IN while the active rows declare it */
    if (/^mea-adopt:/.test(id)) { const r = store.load('admitted_manifests').find(x => 'mea-adopt:' + x.id === id); return { in: !!r && r.status === 'adopted', status: r ? r.status : 'absent' }; } /* M5: an adopted manifest is IN while its adoption stands */
    if (/^meak-adopt:/.test(id)) { const r = store.load('admitted_manifests_k').find(x => 'meak-adopt:' + x.id === id); return { in: !!r && r.status === 'adopted', status: r ? r.status : 'absent' }; } /* MEA-K (4.9.75): an adopted grammar manifest is IN while its adoption stands */
    if (/^adm:/.test(id)) { const r = store.load('admitted_rules').find(x => x.id === id); return { in: !!r && r.status === 'admitted', status: r ? r.status : 'absent' }; }
    if (/^hyp:/.test(id)) { const h = (tmsDeep ? cont.hypotheses.get(id) : null) || stagedHyps.find(x => x.id === id); /* turns never read the hypothesis store (GELC-S0); its status changes only through the governed APIs, which sync deep */ const st = h ? h.status : 'absent'; return { in: !/^(?:withdrawn|archived|rejected|quarantined)$/.test(st), status: st }; }
    return { in: true, status: 'recorded in its turn' }; }
  /* governed items: staged hypotheses (EDE / GELC), approved hypotheses and admitted rules are recorded as soon as they exist */
  let tmsDeep = false;
  function tmsGoverned() { const seen = new Set(TMS.list().map(x => x.id)), mem = store.load('memory'), txt = id => { const r = mem.find(x => x.id === id); return r ? (r.sensitive ? null : memText(r)) : null; };
    const hyps = stagedHyps.concat(!tmsDeep ? [] : cont.hypotheses.list().filter(h => h.provenance && /^(?:ede\.explore|gelc\.evolve)$/.test(h.provenance.source || '')));
    for (const h of hyps) { if (seen.has(h.id) || /^(?:withdrawn|archived|rejected)$/.test(h.status) || !(h.parents || []).length) continue; seen.add(h.id);
      const body = h.body && typeof h.body === 'object' ? [h.body.subject, h.body.relation, h.body.object].map(x => String(x == null ? '' : x).replace(/^[a-z]+:/, '').replace(/_/g, ' ')).join(' ').trim() : String(h.body || h.id);
      TMS.justify({ id: h.id, kind: 'hypothesis', text: body, external: true, turn: h.provenance ? h.provenance.turn : null }, { premises: h.parents.map(id => ({ id, text: txt(id) })), rules: [], derivation_rules: [h.provenance && h.provenance.source === 'gelc.evolve' ? 'GELC-EVOLVE' : 'EDE-ALG3'], selection: null, replay: { kind: 'hypothesis', hyp: h.id }, turn: h.provenance ? h.provenance.turn : null }); }
    for (const r of store.load('admitted_rules')) { if (seen.has(r.id) || r.status !== 'admitted') continue; seen.add(r.id);
      TMS.justify({ id: r.id, kind: 'rule', text: r.rule.id, external: true }, { premises: (r.hypothesis ? [{ id: r.hypothesis, text: 'hypothesis ' + r.hypothesis }] : []).concat((r.support || []).map(id => ({ id, text: txt(id) }))), rules: [], derivation_rules: ['GELC-ADMISSION'], selection: null, replay: { kind: 'admission', proof_id: r.proof_id } }); } }
  /* one sync: record governed items, recompute the fixpoint, apply each governed withdrawal to its own store (with the store's receipt) */
  function tmsSync(cause, deep) { tmsDeep = deep !== false && !(cause && cause.turn != null); try { return tmsSync0(cause); } finally { tmsDeep = false; } }
  function tmsSync0(cause) { tmsGoverned(); const res = TMS.propagate(tmsIsIn, cause || null);
    for (const w of res.withdrawn) { if (w.kind === 'hypothesis') { const h = stagedHyps.find(x => x.id === w.id); if (h) h.status = 'withdrawn'; const hh = cont.hypotheses.get(w.id); /* read only when a withdrawal reaches a hypothesis */ if (hh && hh.status !== 'withdrawn') cont.hypotheses.setStatus(w.id, 'withdrawn', 'a premise was withdrawn (truth maintenance)'); }
      if (w.kind === 'rule') { const ar = store.load('admitted_rules'), r = ar.find(x => x.id === w.id && x.status === 'admitted'); if (r) { const inv = store.load('trace').flatMap(t => (t.rules || []).filter(x => x.id === 'GELC-ADMITTED-RULE' && (x.rules_used || []).includes(r.rule.id)).map(x => ({ turn: t.turn, proof: x.proof })));
        Object.assign(r, { status: 'withdrawn', withdrawn_at: now(), withdrawn_by: 'truth maintenance', invalidated_proofs: inv }); store.save('admitted_rules', ar); } }
      if (w.kind !== 'conclusion') cont.receipt('tms.withdraw', { id: w.id, kind: w.kind, receipt: (res.receipts.find(r => r.item === w.id) || {}).id || null }); }
    if (res.withdrawn.some(w => w.kind !== 'conclusion')) { const again = TMS.propagate(tmsIsIn, cause || null); res.withdrawn = res.withdrawn.concat(again.withdrawn); res.reinstated = res.reinstated.concat(again.reinstated); res.receipts = res.receipts.concat(again.receipts); }
    return res; }

  /* deterministic replay of an item's justifications: the hash re-derives from the content; world proofs are re-derived from the recorded premise
     sentences alone; stored-fact justifications re-check that each premise still says what was recorded */
  function tmsReplay(id) { return TMS.replay(id, (j, it) => { const rp = j.replay || {};
    if (rp.kind === 'world') { const rr = R.evaluate(rp.text || ''), mm = rr && rr.material; if (!mm || mm.kind !== 'world_answer') return false; const k = JT.norm(it.text);
      if (mm.wh) return (mm.wh.answers || []).some(a => a.status === rp.status && JT.norm(a.text) === k); return mm.status === rp.status && JT.norm(rp.status === 'refuted_only' ? mm.opposite_text : mm.query_text) === k; }
    if (rp.kind === 'stated' || rp.kind === 'memory') { const mem = store.load('memory'), cold = store.load('cold_storage'); return j.premises.every(p => { if (/^gks:/.test(p.id)) { const e = gksIndex().find(x => x.f.id === p.id); return !!e && tmsText(e.f.text) === p.text; } const r = mem.find(x => x.id === p.id) || (cold.filter(x => x.record && x.record.id === p.id).pop() || {}).record; return !!r && tmsText(memText(r)) === p.text; }); }
    if (rp.kind === 'relprop') { const mem = store.load('memory'), cold = store.load('cold_storage'), recs = j.premises.map(p => mem.find(x => x.id === p.id) || (cold.filter(x => x.record && x.record.id === p.id).pop() || {}).record);
      if (recs.some(r => !r) || recs.some((r, i) => tmsText(memText(r)) !== j.premises[i].text) || !rp.atom) return false; const F = durableAtoms(recs).map(f => ({ id: f.id, atom: f.atom })), rules = relRulesFor(new Set(F.map(f => f.atom.predicate).concat([rp.atom.predicate]))).filter(r => j.rules.includes(r.id));
      try { const pr = R.ruleWorld(F, rules).prove(rp.atom); return !!pr && R.checkRuleProof(F, rules, pr).ok && R.atomKey(rp.atom) === it.key; } catch (e) { return false; } }
    return undefined; }); }

   /* the first senses of each part of speech */

  function justifyMaterial(it) { if (!it) return { kind: 'justification', state: 'none', conclusion: null, premises: [], rules: 0, stated: false };
    const ok = j => j.premises.every(p => tmsIsIn(p.id).in || (TMS.get(p.id) || {}).status === 'in'), J = it.justifications.find(ok) || it.justifications[it.justifications.length - 1];
    const stated = J.premises.length === 1 && !J.rules.length && JT.norm(J.premises[0].text) === JT.norm(it.text);
    return { kind: 'justification', state: it.status, conclusion: it.text, premises: J.premises.map(p => p.text), rules: J.rules.length, stated, item: it.id, jid: J.id, alternatives: it.justifications.length }; }

  /* Echo's independent re-verification of a read-back: the quotes are exactly the recorded conclusion and premises, and the justification replays */
  function justifyReverify(m, text) { if (m.state === 'none') return !/“/.test(String(text)); const it = TMS.get(m.item); if (!it) return false; const J = it.justifications.find(j => j.id === m.jid); if (!J || JT.jid(it.id, J) !== J.id || it.status !== m.state) return false;
    const qs = [...String(text).matchAll(/“([^”]+)”/g)].map(x => x[1]), want = [it.text].concat(m.stated ? [] : J.premises.map(p => p.text)); return qs.length === want.length && qs.every((q, i) => q === want[i]); }
  const QCLASS = q => (q === 'every' || q === 'each' || q === 'all') ? 'univ' : q || null;
  function scopeOf(c) { if (!c || c.coord || !c.subj || QCLASS(c.subj.quant) !== 'univ') return null; const k = c.roles && c.roles.karma; if (!k || k.clause || !(k.det === 'a' || k.det === 'an' || k.quant === 'some')) return null;
    return { selected: '∀x∃y', preserved: ['∃y∀x'], rule: 'LL-QSCOPE-SURFACE' }; }

  const SELF_V = new Set(['repeat', 'echo', 'print', 'output', 'help', 'use', 'do', 'remember', 'recall', 'tell', 'say', 'mention', 'list', 'show', 'display', 'mean', 'define', 'explain', 'text']), /* capability-frame verbs: verb-class entries read only in the capability frame position (not added to the general parse, where e.g. "sealed" stays adjectival) */ SELF_N = new Set(['colour', 'color', 'reminder', 'status', 'drift', 'phase', 'help', 'command', 'time', 'day', 'date', 'term', 'fact', 'thing', 'memory', 'note', 'meaning', 'definition']);
   /* external-effect verb class (lexical) */

   /* closed value class for the attribute noun colour */
   /* memory-write directive verb class */
  
   /* interjection → speech-act class (lexical) */

   // the status-bearing entity: the karma of an active, the surface subject otherwise
  function conflicts(c) { if (c.coord) return []; const out = [];
    const noPol = x => { const y = clone(G.material(x)); y.verb.pol = null; return canon(y); };
    for (const r of activeFacts()) { const o = r.clause; if (o.coord || predOf(o) !== predOf(c) || !subjMatch(c.subj, o.subj) || canon(G.material(o.cond || null)) !== canon(G.material(c.cond || null))) continue;
      if (canon(G.material(o)) === canon(G.material(c))) continue;
      if (noPol(o) === noPol(c)) { out.push({ r, why: 'MEM-CONFLICT-POLARITY' }); continue; }
      if (o.verb.pol !== 'pos' || c.verb.pol !== 'pos' || o.verb.mod !== c.verb.mod) continue;
      if (predOf(c) === 'be' && o.pred && c.pred) { const head = c.subj.head ? c.subj.head[c.subj.head.length - 1] : null;
        if (head && SINGLE_ATTR.has(head) && o.pred.type !== 'pp' && c.pred.type !== 'pp') out.push({ r, why: 'MEM-CONFLICT-SINGLE-VALUED-ATTRIBUTE' });
        else if (o.pred.type === 'adj' && c.pred.type === 'adj' && EXCLUSIVE.some(s => o.pred.words.every(w => s.has(w)) && c.pred.words.every(w => s.has(w)))) out.push({ r, why: 'MEM-CONFLICT-EXCLUSIVE-CLASS' }); }
      else if (SINGLE_VERB.has(predOf(c)) && (o.adj || []).some(a => a.role === 'adhikarana') && (c.adj || []).some(a => a.role === 'adhikarana') && !(c.adj || []).some(a => a.role === 'kala')) out.push({ r, why: 'MEM-CONFLICT-SINGLE-VALUED-VERB' }); }
    /* M3: a declared FUNCTIONAL relation (world_rules.js) holds one value per subject (or one subject per value): a second value is a real contradiction
       only when the two are APART (4.9.61 ruling 1: not contained in one another via the containment rows, not declared aliases) */
    if (c.verb && c.verb.pol === 'pos' && !c.cond) { let a = null; try { a = R.parseAtomic(G.clauseText(c, 'kernel'), false); } catch (e) { a = null; } const fi = a && a.args.length === 2 && WR.relInfo(a.predicate), fn = fi && fi.row.functional;
      if (fn) { const k = fn === 'subject' ? 0 : 1, D = durableAtoms(activeFacts()), apart = WR.apartness(D.map(f => f.atom).concat([a])); for (const f of D) { const b = f.atom; if (b.predicate === a.predicate && b.polarity === 'pos' && b.args[k] === a.args[k] && apart(b.args[1 - k], a.args[1 - k]) && !out.some(x => x.r.id === f.id)) out.push({ r: f.rec, why: 'MEM-CONFLICT-FUNCTIONAL-RELATION' }); } } }
    return out; }

  /* M4 (4.9.65): cause/effect + rate/time + report/scope constructions (dynamics.js decides from the whole input; the turn world never writes to the
     durable world; a what-if reads the user's stored causal links and is recorded in the ledger with those facts as premises) */
  /* a stored conditional ("if X, Y") is a causal link between two clauses, with the fact as its premise */
  const condLinks = () => activeFacts().filter(r => r.clause && r.clause.cond && !r.sensitive).map(r => { const t = memText(r), m = t.match(/^if (.+?), (?:then )?(.+?)\.?$/i); return m ? { a: m[1].toLowerCase(), b: m[2].toLowerCase(), premise: r.id, text: tmsText(t) } : null; }).filter(Boolean);
  const causalOf = p => { const i = WR.relInfo(p); return (i && i.row.causal) || null; };

   /* 4.9.92 WHAT-IF verb classes from WordNet glosses */

  const ENV = { debug: !!(isNode && globalThis.process.env.FDEBUG), reparseClause: t => reparseClause(t), reparseEmbedded: t => reparseClause0(t, true), reparseNP: t => reparseNP(t), reverify: (m, text) => m && m.kind === 'dynamics' ? DY.check(m, { links: worldStateView().relations, causalOf, conds: condLinks() }) : m && m.kind === 'world_answer' ? worldReverify(m, text) : m && m.kind === 'justification' ? justifyReverify(m, text) : mathReverify(m) };
  /* world answers: the proposition quoted in the surface is re-parsed by the world grammar and must be the checked query (or its
     opposite) of that status, and the proof it cites is replayed again against its own (branch-scoped) world */
  function worldReverify(m, text) { if (m.pron) { const pm = String(text).match(/^([\s\S]*?) The pronoun means “([^”]+)”\. It can mean “([^”]+)”\.([\s\S]*)$/), sy = s => String(s).replace(/_/g, ' ');
      if (!pm || pm[2] !== sy(m.pron.chosen) || pm[3] !== sy(m.pron.also)) return false; m = Object.assign({}, m); delete m.pron; text = pm[1] + pm[4]; }
    if (m.shared_premises) { const t = String(text), n = m.shared_premises.length, qs = [...t.matchAll(/“([^”]+)”/g)], tail = qs.slice(-2 * n); /* the last 2n quotes are (id, citation) per shared premise, each a live active fact with that exact citation */
      if (tail.length !== 2 * n || m.shared_premises.some((x, i) => tail[2 * i][1] !== x.id || tail[2 * i + 1][1] !== x.citation || !gksIndex().some(e => e.f.id === x.id && e.f.status === 'active' && e.f.source.citation === x.citation))) return false;
      const cut = t.lastIndexOf('. ', tail[0].index); if (cut < 0) return false; m = Object.assign({}, m); delete m.shared_premises; text = t.slice(0, cut + 1); }
    if (m.qty) { try { return R.qtyCheck(m.qty, text); } catch (e) { return false; } }
    /* 4.9.94 (d): a preempting rule is named last ("The rule “S” outranks the rule “G”."); re-verified on its own: the defeated proof replays in the
       same world and the specificity reading, re-run from the world's rules over the two proofs, selects the same winner */
    const pe = m.derivation && m.derivation.preempted; if (pe) { const t = String(text), tail = ' The rule “' + pe.specific_text + '” outranks the rule “' + pe.general_text + '”.';
      if (!t.endsWith(tail) || !pe.defeated || !R.checkProof(m.world, pe.defeated).ok) return false; const win = pe.winner === 'support' ? m.proofs.support : m.proofs.refutation; if (!win) return false;
      const re = pe.winner === 'support' ? R.specificity(m.world, win, pe.defeated) : R.specificity(m.world, pe.defeated, win);
      if (!re || re.winner !== pe.winner || re.specific_rule !== pe.specific_rule || re.general_rule !== pe.general_rule) return false; text = t.slice(0, t.length - tail.length); }
    if (m.wh) return whReverify(m, text); if (m.why) return whyReverify(m, text); if (m.conj) return conjReverify(m, text); try { const syms = [m.query.predicate].concat(m.query.args).filter(x => /_/.test(x) && !/_(?:than|v)$/.test(x) && !(WR.relInfo(x) && WR.relInfo(x).row.phrase)); /* a declared relation phrase re-parses by itself (M3) */
      const parse = t => { let u = t; for (const x of syms) u = u.split(x.replace(/_/g, ' ')).join(x); const at = R.parseAtomic(u, false, new Set([m.query.predicate])); if (at) R.alignVerbs(Object.assign({}, m.query), [at]); return at; };
      const said = (String(text).match(/“([^”]+)”/g) || []).map(q => parse(q.slice(1, -1))); if (!said.length || said.some(a => !a)) return false;
      const q = R.canon(m.query), o = R.canon(R.opposite(m.query)), ks = said.map(a => R.canon(a));
      const want = m.status === 'supported_only' ? [q] : m.status === 'refuted_only' ? [o] : m.status === 'conflicted' || m.status === 'undetermined' ? [q, o] : null; if (!want) return undefined;
      if (ks.length !== want.length || ks.some((k, i) => k !== want[i])) return false;
      const pf = m.status === 'supported_only' ? m.proofs.support : m.status === 'refuted_only' ? m.proofs.refutation : null; return pf ? !!R.checkProof(m.world, pf).ok : true; } catch (e) { return false; } }
  /* a wh answer quotes only checked bindings (each re-parsed and its own proof replayed in its own world); with no binding it may quote only the question */
  function whReverify(m, text) { try { const qs = (String(text).match(/“([^”]+)”/g) || []).map(q => q.slice(1, -1)), a = m.wh.answers;
      if (!a.length) return qs.length === 1 && qs[0] === m.wh.question; if (qs.length !== a.length) return false; if (m.wh.count && !new RegExp('\\bcounted ' + a.length + ' ').test(text)) return false;
      return a.every((x, i) => { if (x.status !== 'supported_only') return qs[i] === x.text; const sub = { kind: 'world_answer', status: 'supported_only', query: x.query, proofs: { support: x.proof }, world: x.world }; return worldReverify(sub, '“' + qs[i] + '”') === true; }); } catch (e) { return false; } }
  /* why: the first quote is the question's proposition (its proof replayed when supported); the rest must be exactly the proof's own premises or the branch-checked hypotheses */
  /* a conjunctive answer quotes exactly its deciding parts: each supported/refuted part's proof is replayed in its own world; undetermined parts are quoted as asked */
  function conjReverify(m, text) { try { const qs = (String(text).match(/“([^”]+)”/g) || []).map(q => q.slice(1, -1)), p = m.conj.parts; return qs.length === p.length && p.every((x, i) => x.status === 'undetermined' ? qs[i] === x.text : worldReverify({ kind: 'world_answer', status: x.status, query: x.query, proofs: x.proofs, world: x.world }, '“' + qs[i] + '”') === true); } catch (e) { return false; } }
  function whyReverify(m, text) { try { const w = m.why, qs = (String(text).match(/“([^”]+)”/g) || []).map(q => q.slice(1, -1)); if (qs[0] !== w.query_text) return false;
      if (w.status === 'supported_only' && !R.checkProof(w.world, w.proof).ok) return false; const rest = w.status === 'supported_only' ? (w.premises.length === 1 && w.premises[0] === w.query_text && !w.rules ? [] : w.premises) : w.hypotheses;
      return qs.length === 1 + rest.length && rest.every((x, i) => qs[i + 1] === x); } catch (e) { return false; } }
  function mathReverify(m) { try {
    if (m.kind === 'math') return reverifyMath(m.expr, m.value, m.approx);
    if (m.kind === 'solved' && m.closed) { const z = CA.cubicExact(...[3, 2, 1, 0].map(i => A.P.coef(A.poly(String(m.poly).split('=')[0]), m.x, i).toNumber())); if (!z || z.roots.map(t => t.exact).join('|') !== m.closed.join('|')) return false; }
    if (m.kind === 'solved') return reverifySolve(m.poly, m.noReal ? 'no real solution' : m.roots.map((r, i) => m.x + (m.numeric && m.numeric[i] ? ' ≈ ' : ' = ') + r).join(' or '));
    if (m.kind === 'factored') { const f = A.factor(algebraText(m.input)); return !!(f.ok && (m.irreducible ? f.irreducible : f.result === m.result)); }
    if (m.kind === 'system') { const r = A.solveSystem(m.eqs.map(algebraText)); return !!(r.ok && r.status === 'unique' && m.sol.every(z => r.solution.some(y => y.v === z.v && y.exact === z.exact))); }
    if (m.kind === 'calculus' && m.engine === 'sym') { const d = m.op === 'derivative' ? CA.derivative(m.input, m.x) : CA.integral(m.input, m.x, m.a, m.b); return !!(d.ok && (m.op === 'derivative' ? d.result === m.result : m.a !== undefined ? d.definite.value === m.result : d.result.replace(/ \+ C$/, '') === m.result)); }
    if (m.kind === 'calculus') { if (m.op === 'derivative') { const d = A.derivative(algebraText(m.input), m.x); return !!(d.ok && d.result === m.result); }
      const d = m.a !== undefined ? A.integral(algebraText(m.input), m.x, m.a, m.b) : A.integral(algebraText(m.input), m.x); return !!(d.ok && d.verified && (m.a !== undefined ? d.definite.value === m.result : d.result === m.result)); }
    if (m.kind === 'simplified' && m.rational) { const rs = A.ratSimplify(m.input); return !!(rs.ok && rs.result === m.result && rs.excluded.join() === (m.excluded || []).join()); }
    if (m.kind === 'simplified') return reverifySimplify(m.result);
  } catch (e) { return false; } return undefined; }
  function echo(text, material, vk) { return D.echo(text, material, ENV, vk); }

  function reverifyMath(expr, value, approx) {
    const at = expr.match(/^(.+) at ([a-z]) = (-?[\d.]+)$/); if (at) { const r = A.evaluateAt(algebraText(at[1].replace(/\+_Φ/g, '+').replace(/−_Φ/g, '-')), at[2], at[3]); return !!(r.ok && r.value === value); }
    const e = expr.replace(/×_Φ|×/g, '*').replace(/÷_Φ|÷/g, '/').replace(/\+_Φ/g, '+').replace(/−_Φ|−/g, '-').replace(/√/g, ' sqrt ').replace(/\^_Φ/g, '^');
    const r = M.computeExpr(e); return !!(r.ok && (approx ? Math.abs(parseFloat(r.value) - parseFloat(value)) < 1e-6 : r.value === value)); }
  function reverifySolve(eq, ans) { const e = algebraText(eq.replace(/\+_Φ/g, '+').replace(/−_Φ/g, '-').replace(/ = 0$/, '')); let p; try { p = A.poly(e); } catch (x) { return false; }
    if (/^no real solution/.test(ans)) { const s = A.solveAny(e + '=0'); return !!(s.ok && s.noReal); }
    return ans.split(' or ').every(part => { const m = part.match(/^([a-z]) (=|≈) (.+)$/); if (!m) return false; const val = m[3]; m[2] = val;
      if (/[±√∛∜]/.test(val) || m[0].includes('≈')) { const s = A.solveAny(e + '=0', m[1]); return !!(s.ok && s.verified && s.roots.some(z => z.exact === val)); }
      let v; try { const [n, d] = m[2].split('/'); v = d ? new M.Q(BigInt(n), BigInt(d)) : M.Q.parse(n); } catch (x) { return false; } const r = A.P.subst(p, m[1], v); return A.P.isConst(r) && A.P.constVal(r).n === 0n; }); }
  function reverifySimplify(t) { try { A.poly(algebraText(t.replace(/\+_Φ/g, '+').replace(/−_Φ/g, '-'))); return true; } catch (e) { return false; } }

  const INF = IF.Infer({ lex, entKey: n => entKey(n), entKeys: n => entKeys(n), G }); 

   /* 4.9.79: a premise the world cannot read as a whole (a conditional, a causal statement) is read as discourse, one sentence at a time */
   /* 4.9.81: the meaning of Forge's last top-level answer (for G-REPEAT-REQUEST) */
   /* 4.9.82: the user's last answered question (for NP ellipsis and "tell me more") */

  let lastWritten = [];
  function commitWrite(sel, msm, sfe, turn, at, input) {
    const snap = { memory: store.load('memory'), evidence: store.load('evidence'), cold_storage: store.load('cold_storage') }; const ops = write(sel, msm, sfe, turn, at, input);
    const readback = lastWritten.map(w => (w.absent ? (store.load(w.cat).some(x => x.id === w.absent) ? { store: w.cat, id: w.absent, readback: 'still present' } : { store: w.cat, id: w.absent, readback: 'match', expected: 'absent' }) : Gv.readback(store, w.cat, w.rec.id, w.rec)));
    if (readback.every(x => x.readback === 'match')) return { ops, readback };
    for (const c of Object.keys(snap)) store.save(c, snap[c]); const restored = Object.keys(snap).every(c => Gv.hash(store.load(c)) === Gv.hash(snap[c]));
    return { ops, readback, rollback: { restored, stores: Object.keys(snap), pre_hash: Gv.hash(snap).slice(0, 16) } }; }
  function write(sel, msm, sfe, turn, at, input) {
    const mem = store.load('memory'), evd = store.load('evidence'), cold = store.load('cold_storage'); const ops = []; const W = []; lastWritten = W; const pushW = (cat, rec) => W.push({ cat, rec: clone(rec) });
    const evId = 'ev:' + msm.msm_id.slice(0, 16); evd.push({ id: evId, utterance: input, turn, at, msm_id: msm.msm_id, category: 'user statement' }); pushW('evidence', evd[evd.length - 1]); ops.push({ op: 'evidence.add', id: evId });
    const node = { Phi: 9, rho: sfe.rho, Delta: 0, nu: 0, mu: 1.0, eps: sfe.eps, tau: sfe.tau, lambda: sfe.lambda, chi: sfe.chi };
    if (sel.write.forget) { for (const id of sel.write.forget) { if (/^wf:/.test(id)) { if (retractWorking(id, 'forgotten', msm.msm_id)) ops.push({ op: 'working.forget', id }); continue; } const i = mem.findIndex(x => x.id === id); if (i < 0) continue; const old = mem[i]; old.status = 'forgotten'; old.forgotten_by = msm.msm_id; cold.push({ id: old.id, sealed_at: at, reason: 'forgotten at user request (confirmed, turn ' + turn + ')', record: old, successor: { kind: 'lifecycle_transition', from: 'accepted', to: 'archived', rule: 'forge2 APPEND_ONLY_SUCCESSOR_LAWS_V1 §Lifecycle transition' }, tier: 'WARM', resurrection_attempts: 0 }); mem.splice(i, 1); pushW('cold_storage', cold[cold.length - 1]); W.push({ cat: 'memory', absent: id }); ops.push({ op: 'fact.forget → Ĉ cold storage', id }); }
      store.save('memory', mem); store.save('evidence', evd); store.save('cold_storage', cold); return ops; }
    if (sel.write.note) { mem.push({ id: 'mem:' + msm.msm_id.slice(0, 16), kind: 'note', text: sel.write.note, status: 'active', sfe: node, phase_tag: 'Φ₉', provenance: { source: 'user', turn, at, msm_id: msm.msm_id, evidence: evId } }); ops.push({ op: 'note.add (⧜)' }); pushW('memory', mem[mem.length - 1]); }
    else if (sel.write.mergeWith) { const r = mem.find(x => x.id === sel.write.mergeWith); const mg = M.merge(r.sfe, node); if (mg.ok) r.sfe = mg.sfe; r.provenance.reinforced = (r.provenance.reinforced || []).concat([{ turn, at, evidence: evId }]); pushW('memory', r); ops.push({ op: mg.ok ? 'fact.merge ⟁ (μ ' + mg.sfe.mu + ')' : 'fact.reinforce (⟁ rejected: χ flags differ)', cite: mg.cite }); }
    else { const c = sel.write.clause;
      for (const id of sel.write.supersede || []) { if (/^wf:/.test(id)) { if (retractWorking(id, 'superseded', msm.msm_id)) ops.push({ op: 'working.supersede', id }); continue; } const i = mem.findIndex(x => x.id === id); if (i >= 0) { const old = mem[i]; old.status = 'superseded'; old.superseded_by = msm.msm_id; cold.push({ id: old.id, sealed_at: at, reason: 'superseded by ' + msm.msm_id.slice(0, 12), record: old, tier: 'WARM', resurrection_attempts: 0 }); mem.splice(i, 1); pushW('cold_storage', cold[cold.length - 1]); W.push({ cat: 'memory', absent: id }); ops.push({ op: 'fact.supersede → Ĉ cold storage', id }); } }
      if (!c.coord && c.verb.lemma === 'be' && c.subj.head && c.subj.head[c.subj.head.length - 1] === 'name' && c.subj.owner && c.pred && c.pred.type === 'np' && c.pred.np.propn) { const tgt = typeof c.subj.owner === 'object' ? entKey(c.subj.owner) : c.subj.owner; meta.alias['name:' + c.pred.np.propn.toLowerCase()] = tgt; ops.push({ op: 'alias ' + c.pred.np.propn + ' ≡ ' + tgt + ' (Doc6 §23)' }); }
      const ents = [...new Set(nps(c).filter(n => !n.pron3).map(entKey).filter(Boolean))];
      const subjTxt = c.coord ? '' : G.npText(c.subj, 'user').toLowerCase();
      { const sc = scopeOf(c); if (sc) sideRules.push({ id: sc.rule, doc: 'Doc3 scope; MSM-v1 rejected-meaning record', note: sc.selected + ' selected; ' + sc.preserved.join(',') + ' preserved' }); }
      mem.push({ id: 'mem:' + msm.msm_id.slice(0, 16), kind: 'relation', clause: c, scope: scopeOf(c), pred: c.coord ? 'and' : c.verb.lemma, subjKey: c.coord ? null : entKey(c.subj), entities: ents, sensitive: SENSITIVE.test(subjTxt), sense: sel.sense || null, status: 'active', sfe: node, phase_tag: 'Φ₉ committed (named at Φ₇)', provenance: { source: 'user', turn, at, msm_id: msm.msm_id, evidence: evId, rule: sel.auth ? 'G-REENTRY-CONFIRM' : 'AUTH-EXPLICIT-REMEMBER' } });
      ops.push({ op: 'relation.write (⧜)' }); pushW('memory', mem[mem.length - 1]);
      for (const w of working) if (w.status === 'active' && canon(G.material(w.clause)) === canon(G.material(c))) { w.status = 'promoted'; w.promoted_to = mem[mem.length - 1].id; ops.push({ op: 'working.promote → memory', id: w.id }); } }
    store.save('memory', mem); store.save('evidence', evd); store.save('cold_storage', cold); return ops;
  }

  function exportTurnPacket(turn) { const tr = store.load('trace') || []; const row = turn == null || turn === '' ? tr[tr.length - 1] : tr.filter(t => t && t.turn === +turn).slice(-1)[0]; return row && row.turn_packet ? row.turn_packet : null; }
  function turnPackets() { return (store.load('trace') || []).map(t => t && t.turn_packet).filter(Boolean); }

  function commitHeld(id, userTap) {
    const hw = store.load('held_writes'); const h = hw.find(x => x.id === id && x.status === 'held'); if (!h) return { ok: false, rule: 'HELD-UNKNOWN' };
    if (h.kind === 'phone_statement' && Array.isArray(h.readings)) {
      const sig = r => [r && r.kriya, r && r.voice, r && r.kartr && r.kartr.text, r && r.karma && r.karma.text, r && r.karakas && r.karakas.sampradana && r.karakas.sampradana.text, r && r.text].join('|');
      const chosen = h.selected == null ? null : h.readings[h.selected];
      if (!chosen || !Array.isArray(h.canon) || h.canon[h.selected] !== sig(chosen) || (h.clause && sig(h.clause) !== h.canon[h.selected])) return { ok: false, rule: chosen ? 'GRAMMAR-FORGED-READING' : 'GRAMMAR-NO-READING', held: true };
      h.text = chosen.text; h.clause = chosen;
    }
    const d = perm.authorize('memory.approve_held', { userTap, subject: id }); if (d.decision !== 'allow') return { ok: false, rule: d.rule };
    if (h.kind === 'phone_forget') {
      const canon = Array.isArray(h.canon) ? h.canon : [h.text];
      const asked = Array.isArray(h.texts) ? h.texts : [h.text];
      if (asked.length !== canon.length || asked.some((t, i) => t !== canon[i])) return { ok: false, rule: 'FORGET-FORGED-TARGET', held: true };
      const gone = new Set(canon.map(t => String(t || '')));
      store.save('memory', store.load('memory').filter(r => !gone.has(String(r.text || ''))));
      h.status = 'committed'; h.decided_at = now(); h.permission = d.id; store.save('held_writes', hw);
      return { ok: true, id: h.id, kind: 'phone_forget', rule: 'PERM-EXPLICIT-REQUEST', text: h.text, texts: canon.slice(), permission: d, readback: canon.map(() => ({ readback: 'match' })) };
    }
    if (h.kind === 'phone_statement') {
      const mem = store.load('memory');
      const rec = { id: 'mem:' + h.id, kind: 'statement', text: h.text, clause: h.clause || null, status: 'active', sensitive: !!h.sensitive, provenance: { source: 'user', request: 'remember_command', rule: 'PERM-EXPLICIT-REQUEST', actor: 'user' } };
      mem.push(rec); store.save('memory', mem);
      const rb = Gv.readback(store, 'memory', rec.id, rec);
      if (rb.readback !== 'match') { mem.pop(); store.save('memory', mem); h.status = 'failed (rolled back)'; h.decided_at = now(); store.save('held_writes', hw); return { ok: false, rule: 'RB-READBACK-MISMATCH-ROLLBACK', readback: [rb] }; }
      h.status = 'approved'; h.decided_at = now(); h.permission = d.id; store.save('held_writes', hw);
      return { ok: true, readback: [rb], fact: rec };
    }
    const res = commitWrite({ write: h.write, auth: h.auth, sense: null }, { msm_id: h.msm_id }, h.sfe, h.turn, now(), h.input);
    h.status = res.rollback ? 'failed (rolled back)' : 'approved'; h.decided_at = now(); h.permission = d.id; store.save('held_writes', hw);
    cont.receipt('held.' + (res.rollback ? 'rollback' : 'commit'), { id, readback: res.readback.map(x => x.readback) }); tmsSync({ op: 'held.commit', id }); return { ok: !res.rollback, ops: res.ops, readback: res.readback, rollback: res.rollback || null }; }
  function rejectHeld(id, userTap) { const hw = store.load('held_writes'); const h = hw.find(x => x.id === id && x.status === 'held'); if (!h) return { ok: false, rule: 'HELD-UNKNOWN' }; if (!userTap) return { ok: false, rule: 'PERM-NEEDS-USER-TAP' }; h.status = 'rejected'; h.decided_at = now(); store.save('held_writes', hw); cont.receipt('held.reject', { id }); return { ok: true }; }
  function resurrectPreview(id) { const c = store.load('cold_storage').find(x => x.id === id); return c ? cont.gates(c, perm.policy()) : null; }
  function proposals() { const v = store.load('resurrection_proposals'); return Array.isArray(v) ? v : []; }
  function stageProposal(rec) { const rows = proposals().filter(x => x.id !== rec.id); rows.push({ id: rec.id, label: rec.label || null, tier: rec.tier || null, status: 'proposed', at: now() }); store.save('resurrection_proposals', rows); return rows[rows.length - 1]; }
  function clearProposal(id) { store.save('resurrection_proposals', proposals().filter(x => x.id !== id)); }
  /* 4.9.119: the seven gates return a record to processing. They do not store it. */
  function resurrect(id) {
    const c = store.load('cold_storage').find(x => x.id === id); if (!c) return { ok: false, proposed: false, rule: 'RS-UNKNOWN' };
    const ev = cont.gates(c, perm.policy());
    if (ev.decision !== 'resurrection_candidate') return { ok: false, proposed: false, rule: 'RS-' + ev.decision.toUpperCase(), gates: ev };
    stageProposal({ id, tier: ev.tier }); return { ok: true, proposed: true, rule: 'RS-PROPOSAL', gates: ev, id }; }
  /* The tap is the only store. A missing proposal, a failed gate, a conflict, or drift above 0.35 writes nothing. */
  function commitResurrection(id, userTap) {
    const cs = store.load('cold_storage'); const c = cs.find(x => x.id === id); if (!c) return { ok: false, rule: 'RS-UNKNOWN' };
    const ev = cont.gates(c, perm.policy()); c.resurrection_attempts = (c.resurrection_attempts || 0) + 1; c.last_gate_eval = { at: now(), decision: ev.decision };
    if (ev.decision !== 'resurrection_candidate') { if (ev.decision === 'deep_archive_seal') c.tier = 'DEEP'; store.save('cold_storage', cs); cont.receipt('resurrection.' + ev.decision, { id }); return { ok: false, rule: 'RS-' + ev.decision.toUpperCase(), gates: ev }; }
    if (userTap !== true) { store.save('cold_storage', cs); return { ok: false, rule: 'PERM-NEEDS-USER-TAP', gates: ev }; }
    if (!proposals().some(p => p.id === id && p.status === 'proposed')) { store.save('cold_storage', cs); return { ok: false, rule: 'RS-PROPOSAL-REQUIRED', gates: ev }; }
    const mem = store.load('memory'); if (c.record && mem.some(r => r.id === c.record.id)) { store.save('cold_storage', cs); return { ok: false, rule: 'RS-ALREADY-ACTIVE', gates: ev }; }
    if (c.record && c.record.clause) { const cf = conflicts(c.record.clause); if (cf.length) { store.save('cold_storage', cs); return { ok: false, rule: 'RS-CONFLICTS-ACTIVE-FACT', conflicts: cf.map(x => x.r.id), gates: ev }; } }
    const eps = c.record && c.record.sfe ? c.record.sfe.eps : null;
    if (typeof eps === 'number' && eps > 0.35) { store.save('cold_storage', cs); return { ok: false, rule: 'RS-DRIFT-NOT-PROJECTABLE', gates: ev }; }
    const d = perm.authorize('memory.restore', { userTap: true, subject: id }); if (d.decision !== 'allow') { store.save('cold_storage', cs); return { ok: false, rule: d.rule, gates: ev }; }
    if (!c.record) { store.save('cold_storage', cs); return { ok: false, rule: 'RS-NO-RECORD', gates: ev }; }
    const psi = clone(c.record); psi.status = 'active'; psi.resurrected = { at: now(), from: c.id, attempts: c.resurrection_attempts, note: 'ψ′ — constituted by collapse history (resurrection_engine.py)' }; delete psi.forgotten_by; delete psi.superseded_by;
    const snap = { memory: clone(mem), cold_storage: clone(cs) }; mem.push(psi); c.status = 'resurrected'; c.resurrected_at = now(); store.save('memory', mem); store.save('cold_storage', cs);
    const rb = Gv.readback(store, 'memory', psi.id, psi); if (rb.readback !== 'match') { store.save('memory', snap.memory); store.save('cold_storage', snap.cold_storage); return { ok: false, rule: 'RB-READBACK-MISMATCH-ROLLBACK', readback: rb }; }
    clearProposal(id); cont.receipt('resurrection.commit', { id, readback: rb.readback, permission: d.id }); const tm = tmsSync({ op: 'resurrection', id }); return { ok: true, tms: { reinstated: tm.reinstated.map(x => x.id) }, gates: ev, readback: rb, record: psi.id }; }
  /* 4.9.120: the tap commits the idea record only. Memory, the world head, and the shared KB stay unchanged. */
  function commitIdea(id, userTap) {
    const rows = store.load('creative_proposals') || []; const row = rows.find(r => r && r.id === id && r.status === 'proposed');
    if (!row) return { ok: false, rule: 'CREATIVE-PROPOSAL-REQUIRED' };
    if (userTap !== true) return { ok: false, rule: 'PERM-NEEDS-USER-TAP' };
    if (!row.novelty || row.novelty.class === 'unbound' || row.novelty.anchored === false) return { ok: false, rule: 'CREATIVE-NOVELTY-UNBOUND' };
    const eps = row.drift && typeof row.drift.eps_s === 'number' ? row.drift.eps_s : null; const band = M.driftGovernance(eps).band;
    if (band === 'reject' || (typeof eps === 'number' && eps >= 0.80)) return { ok: false, rule: 'CREATIVE-DRIFT-HARD' };
    if (band !== 'projectable' || !(typeof eps === 'number' && eps <= 0.35) || row.novelty.class !== 'bounded') return { ok: false, rule: 'CREATIVE-DRIFT-NOT-PROJECTABLE' };
    const d = perm.authorize('hypothesis.write', { userTap: true, subject: id }); if (d.decision !== 'allow') return { ok: false, rule: d.rule };
    row.status = 'committed'; row.committed_at = now(); row.receipt = d.id || null; store.save('creative_proposals', rows);
    return { ok: true, id, status: 'committed', wrote_memory: false, wrote_world: false, wrote_shared: false }; }
  function releaseDream(id, userTap) { const r = cont.hypotheses.view('dream').find(x => x.id === id && x.status === 'quarantined'); if (!r) return { ok: false, rule: 'DQ-UNKNOWN' }; const d = perm.authorize('containment.release', { userTap, subject: id }); if (d.decision !== 'allow') return { ok: false, rule: d.rule }; cont.hypotheses.setStatus(id, 'archived', 'archived by operator'); cont.receipt('dream.archive', { id }); tmsSync({ op: 'dream.archive', id }); return { ok: true }; }
  /* 4.9.66 confirm tap: a working fact becomes lasting memory only by an explicit user tap (or "remember …" in the conversation). A working fact that
     contradicts a stored fact is not promoted by a tap: the conversation asks first (no silent overwrite). The write is the ordinary governed write. */
  function promoteWorking(id, userTap) { if (userTap !== true) return { ok: false, rule: 'PERM-NEEDS-USER-TAP' }; const w = working.find(x => x.id === id && x.status === 'active'); if (!w) return { ok: false, rule: 'WF-NOT-ACTIVE' };
    const cf = conflicts(w.clause).filter(x => !x.r.working); if (cf.length) return { ok: false, rule: 'MEM-CONTRADICTION-ASK-FIRST', conflicts: cf.map(x => x.r.id) };
    const d = perm.authorize('memory.write', { explicit: true, userTap: true, sensitive: !!w.sensitive, subject: id }); if (d.decision !== 'allow') return { ok: false, rule: d.rule };
    const msm_id = sha256('wf-promote|' + id + '|' + now()); const res = commitWrite({ write: { clause: w.clause }, auth: 'explicit confirmation', sense: w.sense }, { msm_id }, w.sfe, meta.turn, now(), memText(w));
    const ok = !res.rollback; if (ok) tmsSync0({ turn: meta.turn, ops: ['working.promote'] }); return { ok, rule: ok ? 'WF-PROMOTED-BY-TAP' : 'WRITE-ROLLED-BACK', id, memory_id: w.promoted_to || null, readback: res.readback, rollback: res.rollback || null }; }
  /* 4.9.102: a phone proposal is admitted by the same proof gate as approveHypothesis. The show publishes it only after Echo.
     The tap recomputes fitness on the facts stored now: drift must still project (ε_s ≤ 0.35) and the replay must still contradict nothing. */
  function adoptPhoneProposal(id, userTap) { const p = phoneProposals.find(x => x.id === id); if (!p) return { ok: false, rule: 'MEA-UNKNOWN' };
    if (userTap !== true) return { ok: false, rule: 'PERM-NEEDS-USER-TAP' };
    if (!p.echo) return { ok: false, rule: 'MEA-ECHO-HELD' };
    if (p.route !== 'promotable') return { ok: false, rule: 'MEA-NOT-APPROVABLE', route: p.route };
    const facts = ruleFacts(storedFacts().filter(r => !r.sensitive)), fit = EVO.fitness(p.rule, facts);
    if (!fit) return { ok: false, rule: 'ADM-UNSAFE-RULE' };
    if (!fit.drift.may_project || !(fit.drift.eps_s <= 0.35)) return { ok: false, rule: 'HYP-DRIFT-NOT-PROJECTABLE', governance: fit.drift };
    if (fit.contradicts.length) return { ok: false, rule: 'MEA-NOT-APPROVABLE', route: 'conflicted', drift: fit.drift };
    const adm = admissionCheck(p.rule, p.claim_atom); if (!adm.ok) return adm;
    const d = perm.authorize('hypothesis.write', { userTap, subject: id }); if (d.decision !== 'allow') return { ok: false, rule: d.rule, decision: d.decision };
    const ar = store.load('admitted_rules'); if (!ar.some(r => r.rule.id === p.rule.id && r.status === 'admitted')) ar.push({ id: 'adm:' + sha256(canon(p.rule)).slice(0, 16), rule: p.rule, hypothesis: null, proof_id: adm.proof.proof_id, support: adm.support, eps_s: fit.drift.eps_s, status: 'admitted', admitted_at: now(), receipt: d.id || null, source: 'mea.phone' });
    store.save('admitted_rules', ar); cont.receipt('rules.admit', { id: p.rule.id, hypothesis: null, proof: adm.proof.proof_id }); tmsSync({ op: 'rules.admit', id: p.rule.id });
    return { ok: true, admitted: p.rule.id, proof: adm.proof.proof_id, eps_s: fit.drift.eps_s }; }
  function approveHypothesis(id, userTap) { const h = stagedHyps.find(x => x.id === id) || cont.hypotheses.list().find(x => x.id === id && x.status !== 'promoted' && x.status !== 'withdrawn'); if (!h) return { ok: false, rule: 'HYP-NOT-STAGED' };
    if (h.status === 'withdrawn' || (TMS.get(id) || {}).status === 'withdrawn') return { ok: false, rule: 'HYP-WITHDRAWN', receipt: (TMS.receipts().filter(r => r.item === id).pop() || {}).id || null }; /* M2: a hypothesis whose premise left needs a new derivation */
    const g = HY.governance(h); if (typeof HY.epsOf(h) === 'number' && !g.may_project) return { ok: false, rule: 'HYP-DRIFT-NOT-PROJECTABLE', governance: g };
    const rule = h.detail && h.detail.rule, adm = rule ? admissionCheck(rule, h.detail.claim_atom) : null; if (adm && !adm.ok) return adm;
    const d = perm.authorize('hypothesis.write', { userTap, subject: id }); if (d.decision !== 'allow') return { ok: false, rule: d.rule, decision: d.decision };
    const w = cont.hypotheses.get(id) ? { ok: true, id } : cont.hypotheses.put(h, { kind: 'approval_receipt', approved: true, decision: d.decision, rule: d.rule, receipt: d.id || null }); if (!w.ok) return w; cont.receipt('hypotheses.approve', { id });
    if (!rule) { tmsSync({ op: 'hypotheses.approve', id }); return w; } const ar = store.load('admitted_rules'); if (!ar.some(r => r.rule.id === rule.id && r.status === 'admitted')) ar.push({ id: 'adm:' + sha256(canon(rule)).slice(0, 16), rule, hypothesis: id, proof_id: adm.proof.proof_id, support: adm.support, eps_s: HY.epsOf(h), status: 'admitted', admitted_at: now(), receipt: d.id || null });
    store.save('admitted_rules', ar); cont.hypotheses.setStatus(id, 'promoted', 'proof-checked promotion to an admitted rule'); cont.receipt('rules.admit', { id: rule.id, hypothesis: id, proof: adm.proof.proof_id }); tmsSync({ op: 'rules.admit', id: rule.id }); return Object.assign({}, w, { admitted: rule.id, proof: adm.proof.proof_id }); }
  const { meaDetail, meaMetaK, adoptMetaK, withdrawMetaK, meaCandidatesK, meaArchiveK, meaRequeueK, adoptManifestK, withdrawManifestK, meaProblems, meaCycle, meaSupply, meaCommit, meaRequeue, meaHandoffOf, meaCandidates, adoptManifest, withdrawManifest } = (isNode ? require('./kmea_panels.js') : root.KMEAPanels).MeaPanels({ opts, MEAD, MEAKD, store, MEA, perm, now, sha256, canon, WR, TMS, cont, tmsSync, G, lex, activeFacts, QC, MEAP, entKeys, MEAPD, MEAK }); /* 4.9.212: moved to kmea_panels.js (same API) */
  /* GELC S5: withdrawal is a governed write; every answer whose replayed proof used the rule is listed as invalidated (the audit trace itself is never edited) */
  function withdrawRule(id, userTap) { const ar = store.load('admitted_rules'), r = ar.find(x => (x.id === id || x.rule.id === id) && x.status === 'admitted'); if (!r) return { ok: false, rule: 'ADM-UNKNOWN' };
    const d = perm.authorize('hypothesis.write', { userTap, subject: r.id }); if (d.decision !== 'allow') return { ok: false, rule: d.rule, decision: d.decision };
    const inv = store.load('trace').flatMap(t => (t.rules || []).filter(x => x.id === 'GELC-ADMITTED-RULE' && (x.rules_used || []).includes(r.rule.id)).map(x => ({ turn: t.turn, proof: x.proof })));
    Object.assign(r, { status: 'withdrawn', withdrawn_at: now(), invalidated_proofs: inv }); store.save('admitted_rules', ar); if (cont.hypotheses.get(r.hypothesis)) cont.hypotheses.setStatus(r.hypothesis, 'withdrawn', 'admitted rule withdrawn by the user');
    cont.receipt('rules.withdraw', { id: r.rule.id, invalidated: inv.length }); const tm = tmsSync({ op: 'rules.withdraw', id: r.id }); return { ok: true, withdrawn: r.rule.id, invalidated_proofs: inv, tms: { withdrawn: tm.withdrawn.map(x => x.id), receipts: tm.receipts.map(x => x.id) } }; }
  /* case API (plan §2): seal/unseal at rest with the Identity Vault key (AES-GCM via vault.encryptBlob) — never a shared key */
  const caseState = () => (pendingCase !== undefined ? pendingCase : caseNS);
  async function caseSeal(id, vault) { id = String(id).toLowerCase(); if (caseState() === 'case:' + id) return { ok: false, rule: 'CASE-OPEN-CLOSE-FIRST' }; if (!vault || vault.status() !== 'unlocked') return { ok: false, rule: 'CASE-VAULT-LOCKED' };
    const data = {}; for (const c of CASE_CATS) data[c] = baseStore.load('case:' + id + ':' + c); const box = await vault.encryptBlob(JSON.stringify(data)); baseStore.save('case:' + id + ':sealed', box); for (const c of CASE_CATS) baseStore.save('case:' + id + ':' + c, []); return { ok: true, rule: 'CASE-SEALED-VAULT' }; }
  async function caseUnseal(id, vault) { id = String(id).toLowerCase(); const box = baseStore.load('case:' + id + ':sealed'); if (!box || Array.isArray(box) || !box.ct) return { ok: false, rule: 'CASE-NOT-SEALED' }; if (!vault || vault.status() !== 'unlocked') return { ok: false, rule: 'CASE-VAULT-LOCKED' };
    const data = JSON.parse(await vault.decryptBlob(box)); for (const c of CASE_CATS) baseStore.save('case:' + id + ':' + c, data[c] || []); baseStore.save('case:' + id + ':sealed', []); return { ok: true }; }
  /* GKS fact ingestion (plan §1): body.facts from a snapshot the caller verified with the GKS pin/verify module (publisher key + hash + signature). The signature is
     recorded as who published, never as truth; invalid entries (no citation, popularity fields, no lineage root) are rejected individually. */
  function ingestShared(body, verified) { const r = KN.ingest(body, verified); if (!r.ok) return r; const cur = (baseStore.load('gks_facts') || []).filter(f => !r.facts.some(n => n.id === f.id)); baseStore.save('gks_facts', cur.concat(r.facts)); return { ok: true, admitted: r.facts.map(f => f.id), rejected: r.rejected }; }
  function challengeShared(id, ev) { const all = baseStore.load('gks_facts') || [], i = all.findIndex(f => f.id === id), f = i >= 0 ? all[i] : KN.SEED.find(x => x.id === id); if (!f) return { ok: false, rule: 'GKS-NO-SUCH-FACT' };
    const c = KN.challenge(f, ev); if (!c.ok) return c; if (i >= 0) all[i] = c.fact; else all.push(c.fact); baseStore.save('gks_facts', all); return c; }
  /* proof export (plan §3): explicit user action; self-contained, re-verifiable offline (tools/verify_proof.js); case exports are labelled confidential */
  function exportProof(turn) { const tl = store.load('trace'); const t = turn == null ? tl.filter(x => x.msm && x.output).slice(-1)[0] : tl.find(x => x.turn === turn); if (!t || !t.msm || !t.msm.meaning) return { ok: false, rule: 'PROOF-NO-TURN' };
    const mem = store.load('memory'), refs = (t.msm.evidence && t.msm.evidence.refs) || []; const prem = [];
    for (const id of [...new Set(refs.concat((t.msm.meaning.shared_premises || []).map(x => x.id)))]) { const g = gksFacts().find(f => f.id === id); if (g) { prem.push({ id, kind: 'shared', class: g.source.class, citation: g.source.citation, url: g.source.url || null, lineage_root: g.lineage_root, status: g.status, body_sha256: g.body_sha256, fact: g }); continue; }
      const r = mem.find(x => x.id === id); if (r && r.sensitive) return { ok: false, rule: 'PROOF-SENSITIVE-PREMISE' }; prem.push(r ? { id, kind: caseNS ? 'case' : 'private', clause: r.clause, at: r.created_at || r.at || null } : { id, kind: 'unresolved' }); }
    const body = { schema: 'FORGE-PROOF/v1', turn: t.turn, at: t.at, question: t.input, answer: t.output, meaning: t.msm.meaning, outcome: t.outcome, rules: (t.rules || []).map(r => r.id), echo: t.echo ? { pass: !!t.echo.pass, mode: t.echo.mode || null } : null, premises: prem, selection: t.selection ? { schema: t.selection.schema, winner: t.selection.winner, reason: t.selection.reason, keys: t.selection.keys, routes: t.selection.routes, candidates: (t.selection.candidates || []).map(c => ({ route: c.route, specificity: c.specificity, status: c.status, why: c.why, outcome: c.outcome, answer: c.answer, echo: c.echo && c.echo.pass, completeness: c.completeness, eps_s: c.eps_s, score: c.score, distances: c.distances })) } : null, confidential: caseNS ? 'Confidential — case ' + caseNS.slice(5) : null, checker: 'derive.js realize + inverse analysis (Echo); knowledge.js validate/bodyHash' };
    return { ok: true, bundle: Object.assign(body, { sha256: sha256(canon(body)) }) }; }
  /* LOOKUP PLAN (4.9.51) — what a cited lookup asks, read from the parse and the lexicon, never from keywords: the named entity (a proper-name run, with a
     lower-case initialism next to it: "oj Simpson"), the content lemmas, the yes/no structure ("is A a B" → class check; "is A a P of B" → property check),
     and the domains of the content nouns by WordNet class (hypernym closure reaching a field's anchor class). archives.js routes by these domains. */
  const DOMAIN_ANCHORS = { medical: ['disease', 'illness', 'symptom', 'drug', 'medicine', 'organ', 'injury', 'hormone', 'antigen', 'infection', 'vaccine', 'physician', 'pathology', 'medication'],
    legal: ['law', 'crime', 'lawman', 'adjudicator', 'lawyer', 'court', 'punishment', 'legislator', 'judiciary', 'statute', 'lawsuit', 'verdict', 'trial', 'guilt', 'offense', 'contract', 'right'],
    engineering: ['structure', 'building', 'machine', 'device', 'mechanism', 'material', 'paving', 'vehicle', 'engine', 'construction', 'conveyance', 'alloy', 'metal'],
    science: ['planet', 'star', 'element', 'compound', 'particle', 'animal', 'plant', 'mineral', 'energy'],
    /* 4.9.78 FIELDS for the added archives, by the same WordNet class test (hypernym anchors, never question keywords) */
    chemistry: ['compound', 'element', 'chemical', 'substance', 'molecule', 'acid', 'alloy', 'mineral', 'drug'],
    biology: ['organism', 'animal', 'plant', 'protein', 'gene', 'cell', 'enzyme', 'hormone', 'tissue', 'fungus', 'bacteria'] };
  /* JURIS (4.9.55): a polity from WordNet — a noun.location whose gloss names a sovereign kind (republic, kingdom, nation, country, federation, monarchy,
     empire, principality, emirate, sultanate), or an adj.pert "of or relating to X" over one; the United States reads as home (the default jurisdiction) */
  const CTRYC = new Map(); function countryOf(w0) { const w = String(w0 || '').toLowerCase(); if (CTRYC.has(w)) return CTRYC.get(w); let r = null; const SOV = /\b(republic|kingdom|nation|country|federation|monarchy|empire|principality|emirate|sultanate|commonwealth)\b/; if (SOV.test(w) && !/\s/.test(w)) { CTRYC.set(w, null); return null; } /* 4.9.78: a sovereign KIND ("kingdom", "republic") names no polity */
    for (const t of ['core', 'ext', 'pro']) { const L = lex.wn[t] && lex.wn[t].L; if (!L || !L[w] || r) continue; for (const e of L[w]) for (const sn of e[1]) { const g = String(sn[2] || ''), ln = (lex.wn.core.meta && lex.wn.core.meta.lexnames || [])[sn[1]];
        if (r) break; if (e[0] === 'n' && ln === 'noun.location' && SOV.test(g.split(' ').slice(0, 6).join(' ')) && !/\b(former|formerly)\b/.test(g.split(/[;,]/)[0]) || e[0] === 'n' && ln === 'noun.location' && /^a (communist|federal|constitutional|parliamentary|socialist) /.test(g)) r = /United States|North American republic/.test(g) ? 'united states' : w;
        else if (e[0] === 'a' && ln === 'adj.pert' && w !== w0) { const m = /^of or (?:relating|pertaining) to (?:or characteristic of )?(?:the )?([A-Z][a-z]+(?: [A-Z][a-z]+)*)/.exec(g); if (m && m[1] !== w0) { const c = /United States|America$/.test(m[1]) ? 'united states' : countryOf(m[1].split(' ').pop()); if (c) r = c; } } } }
    if (!r) { for (const t of ['core', 'ext', 'pro']) { const L = lex.wn[t] && lex.wn[t].L; if (!L || !L[w]) continue; for (const e of L[w]) for (const sn of e[1]) if (!r && e[0] === 'n' && /former communist country|largest Soviet/.test(String(sn[2]))) r = w; } }
    CTRYC.set(w, r); return r; }
  /* JURIS (4.9.78): the jurisdiction is set only when the question names a polity (a country word, its nationality adjective, or a multi-word
     country name); there is no default polity. A nationality adjective outside the loaded tiers is read by derivational morphology onto a
     country noun in the lexicon (-ian → -a, -an → -a, -ese / -ish / -i → stem): "Canadian" → canada */
  function nationOf(w0) { const c = countryOf(w0); if (c) return c; const w = String(w0 || ''); if (!/^[A-Z][a-z]{3,}$/.test(w)) return null; const l = w.toLowerCase();
    for (const s of [l.replace(/ian$/, 'a'), l.replace(/ian$/, ''), l.replace(/an$/, 'a'), l.replace(/an$/, ''), l.replace(/ese$/, ''), l.replace(/ish$/, ''), l.replace(/i$/, '')]) if (s !== l && s.length >= 3) { const r = countryOf(s); if (r) return r; } return null; }
  function jurisOf(text) { const ws = String(text).match(/[A-Za-z]+/g) || []; for (let n = 4; n >= 2; n--) for (let i = 0; i + n <= ws.length; i++) { const ph = ws.slice(i, i + n); if (ph.every(x => /^[A-Z]/.test(x) || (x === 'of' && n > 2))) { const r = countryOf(ph.join(' ')) || countryOf(ph.filter(x => /^[A-Z]/.test(x)).map(x => x[0]).join('')); if (r) return r; } } /* a multi-word name, or its initials ("United States" → US, a WordNet lemma) */
    for (const x of ws) { if (!/^[A-Z]/.test(x)) continue; /* a lowercase word is never a polity name ("tell us") */ const r = nationOf(x); if (r) return r; } return null; }
  const NEGC = new Map(); function negatorsOf(p) { if (NEGC.has(p)) return NEGC.get(p); const out = new Set(), re = new RegExp('^(?:[a-z]+ )?not ' + p + '\\b');
    for (const t of ['core', 'ext', 'pro']) { const L = lex.wn[t] && lex.wn[t].L; if (!L) continue; for (const w in L) for (const e of L[w]) if ((e[0] === 'v' || e[0] === 'a') && e[1].some(sn => re.test(String(sn[2] || '')))) out.add(w); }
    for (const pre of ['un', 'in', 'non']) if (lex.hasPos(pre + p, 'a')) out.add(pre + p);
    /* NEG-ADVISE (4.9.53): a safety predicate (its gloss names danger / risk / harm: safe = "free from danger or the risk of harm") is also negated by
       what makes a use inadvisable — words whose gloss contains a "not advisable" adjective, where advisable = "worthy of being recommended":
       contraindicate = "make a treatment inadvisable" → not safe. Two definition hops, no word list. */
    const gl = w => { const g = []; for (const t of ['core', 'ext', 'pro']) { const L = lex.wn[t] && lex.wn[t].L; if (L && L[w]) for (const e of L[w]) for (const sn of e[1]) g.push(String(sn[2] || '')); } return g.join(' / '); };
    if (/danger|risk|harm/.test(gl(p))) { const bad = new Set(); for (const t of ['core', 'ext', 'pro']) { const L = lex.wn[t] && lex.wn[t].L; if (!L) continue; for (const w in L) for (const e of L[w]) if (e[0] === 'a' && e[1].some(sn => { const m = /^not ([a-z]+)$/.exec(String(sn[2] || '')); return m && /recommend/.test(gl(m[1])); })) bad.add(w); }
      if (bad.size) { const reB = new RegExp('\\b(' + [...bad].join('|') + ')\\b'); for (const t of ['core', 'ext', 'pro']) { const L = lex.wn[t] && lex.wn[t].L; if (!L) continue; for (const w in L) for (const e of L[w]) if ((e[0] === 'v' || e[0] === 'a') && e[1].some(sn => reB.test(String(sn[2] || '')))) out.add(w); } for (const b of bad) out.add(b); } }
    const r = [...out].filter(w => /^[a-z]+$/.test(w)).slice(0, 12); NEGC.set(p, r); return r; }
  /* AFFIRM (4.9.54): verbs whose gloss is a verdict of P ("find or declare guilty" → convict) state P; negators are the "not P" glosses */
  /* RECIP (4.9.56): a reciprocal (symmetric) verb from its WordNet verb glosses — "act together or towards others or with others" (interact),
     "… each other / one another / jointly / mutually", or a gloss over a noun of joining ("take in marriage" → marriage "… joined …") */
  const RECC = new Map(); function reciprocal(v) { if (RECC.has(v)) return RECC.get(v); let r = false; const RE = /\b(together|each other|one another|with others|jointly|mutual(?:ly)?|reciprocal(?:ly)?|joined|couple)\b/;
    for (const t of ['core', 'ext', 'pro']) { const L = lex.wn[t] && lex.wn[t].L; if (!L || !L[v]) continue; for (const e of L[v]) if (e[0] === 'v') for (const sn of e[1]) { const g = String(sn[2] || ''); if (RE.test(g)) r = true; const m = /^take in ([a-z]+)$/.exec(g); if (m && L[m[1]]) for (const e2 of L[m[1]]) if (e2[0] === 'n') for (const s2 of e2[1]) if (RE.test(String(s2[2] || ''))) r = true; } }
    RECC.set(v, r); return r; }
  /* COMING (4.9.56): the asked verb names a coming-into-being (a verb.creation sense, or a gloss of finishing / starting to operate / setting up / beginning):
     "completed", "opened", "built", "founded", "begin" — its date is the thing's opening or inception */
  const COMC = new Map(); function comingOf(v) { if (!v) return false; if (COMC.has(v)) return COMC.get(v); let r = false; const cr = lex.wn.core && lex.wn.core.meta ? lex.wn.core.meta.lexnames.indexOf('verb.creation') : -1;
    for (const t of ['core', 'ext', 'pro']) { const L = lex.wn[t] && lex.wn[t].L; if (!L || !L[v]) continue; for (const e of L[v]) if (e[0] === 'v') for (const sn of e[1]) { const g = String(sn[2] || ''); if (/\b(to a finish|start to operate)\b/.test(g)) r = 'finish'; else if (!r && (sn[1] === cr || /\b(set up|have a beginning|take the first step|with one's signature)\b/.test(g))) r = 'begin'; } }
    /* finish: completion / opening (the thing in service); begin: creation, founding, signing */
    COMC.set(v, r); return r; }
  /* EFFECT-N (4.9.56): the nouns that name what P brings about — a noun whose gloss is "a phenomenon that … is <P-ed> by …" (cause → effect, result,
     consequence): "common side effects include … cough" states that the drug causes a cough */
  const EFFC = new Map(); function effectNounsOf(p) { if (!p) return []; if (EFFC.has(p)) return EFFC.get(p); const pp = G.inflect(p, 'pp'); const out = new Set(); if (pp) { const re = new RegExp('^an? [a-z]+ that (?:[a-z]+ and )?is ' + pp + ' by\\b'); for (const t of ['core', 'ext', 'pro']) { const L = lex.wn[t] && lex.wn[t].L; if (!L) continue; for (const w in L) for (const e of L[w]) if (e[0] === 'n' && e[1][0] && re.test(String(e[1][0][2] || ''))) out.add(w); } }
    const r = [...out].filter(w => /^[a-z]+$/.test(w)).slice(0, 8); EFFC.set(p, r); return r; }
  const AFFC = new Map(); function affirmersOf(p) { if (AFFC.has(p)) return AFFC.get(p); const out = new Set(), re = new RegExp('^(?:[a-z]+ ){1,2}(?:or [a-z]+ )?' + p + '\\b'); for (const t of ['core', 'ext', 'pro']) { const L = lex.wn[t] && lex.wn[t].L; if (!L) continue; for (const w in L) for (const e of L[w]) if (e[0] === 'v' && e[1].some(sn => re.test(String(sn[2] || '')) && !/\bnot\b/.test(String(sn[2] || '')))) out.add(w); } const r = [...out].filter(w => /^[a-z]+$/.test(w)).slice(0, 12); AFFC.set(p, r); return r; }
  /* DIM-NOUN (4.9.54): the attribute noun a degree adjective measures — the noun.attribute entry whose gloss shares the most content words with the
     adjective's glosses (tall "great in vertical dimension" ~ height "the vertical dimension of extension"), or that the gloss names ("marked by depth") */
  const DIMC = new Map(); function dimNounOf(a) { if (DIMC.has(a)) return DIMC.get(a); const ag = []; for (const t of ['core', 'ext', 'pro']) { const L = lex.wn[t] && lex.wn[t].L; if (L && L[a]) for (const e of L[a]) if (e[0] === 'a') for (const sn of e[1]) ag.push(String(sn[2] || '')); }
    const cw = x => new Set(String(x).toLowerCase().split(/[^a-z]+/).filter(w => w.length > 3 && !G.CL[w] && !/^(great|having|relatively|very|greater|than|from|with|more|most)$/.test(w))); const A = cw(ag.join(' ')); let best = null, bs = 1;
    const L0 = lex.wn.core; const attr = L0 && L0.meta ? L0.meta.lexnames.indexOf('noun.attribute') : 7;
    for (const t of ['core', 'ext', 'pro']) { const L = lex.wn[t] && lex.wn[t].L; if (!L) continue; for (const w in L) { if (!/^[a-z]+$/.test(w) || w === a) continue; for (const e of L[w]) if (e[0] === 'n') for (const sn of e[1]) if (sn[1] === attr) { const N = cw(sn[2]); let sc = 0; for (const x of N) if (A.has(x) && x !== w) sc++; if (A.has(w) && sc >= 1) sc += 2; else if (A.has(w) && new RegExp('\\b(?:by|of) ' + w + '\\b').test(ag.join(' '))) sc += 2; if (sc > bs) { bs = sc; best = w; } } } }
    DIMC.set(a, best); return best; }
  function lookupPlan(text) { const toks = content(G.tokenize(String(text).replace(/[?.!\s]+$/, ''))); if (!toks.length) return null; const P = G.Parser(toks, glex); const T = toks.map((t, i) => ({ w: t.w, orig: t.orig || t.w, an: P.at(i, 'N').concat(P.at(i, 'V'), P.at(i, 'ADJ'), P.at(i, 'PROPN'), P.at(i, 'UNK')) }));
    const closed = i => !!G.CL[toks[i].w] && !P.at(i, 'N').length; const yn = !!(P.at(0, 'AUX').length || P.at(0, 'COP').length || P.at(0, 'MOD').length || /^(is|are|was|were|do|does|did|can|could|will|would|should|has|have|had|may|might|must)$/.test(toks[0].w));
    const name = [], names2 = []; let entity = null; for (let i = 0; i < toks.length; i++) { const nm = toks[i].w !== 'i' && (P.at(i, 'PROPN').length || (/^[A-Z]/.test(toks[i].orig || '') && i > 0) || (!closed(i) && T[i].an.every(a => a.tag === 'UNK') && ((i + 1 < toks.length && /^[A-Z]/.test(toks[i + 1].orig || '')) || (i > 0 && /^[A-Z]/.test(toks[i - 1].orig || '') && i - 1 > 0))));
      const capAt = j => j < toks.length && j > 0 && /^[A-Z]/.test(toks[j].orig || ''); /* NAME-OF (4.9.91): a name continues through "of" (+ "the") into a following capitalised word — "Treaty of Versailles", "Bank of England" are one name */
      if (!nm && name.length && toks[i].w === 'of' && (capAt(i + 1) || (toks[i + 1] && toks[i + 1].w === 'the' && capAt(i + 2)))) { name.push('of'); if (toks[i + 1].w === 'the') { name.push('the'); i++; } continue; }
      if (nm) name.push(toks[i].w); else if (name.length) { if (!entity) entity = name.join(' '); else names2.push(name.join(' ')); name.length = 0; } } if (!entity && name.length) entity = name.join(' '); else if (name.length) names2.push(name.join(' ')); /* NAMES2 (4.9.56): a second proper name ("did Caesar cross the Rubicon") is an argument too */
    /* NP-HEAD (4.9.78, Nic's approval of the audit fixes): a proper name followed by common nouns is ONE noun phrase whose head is its last noun
       (a tatpuruṣa compound: "<Country> military", "<Country> tax code"); the name is a modifier of that head, never the subject by itself.
       Read from the parse: the following tokens are open-class nouns, not a participle, not a verb taking an object (a determiner follows), and
       under do-support the final bare verb is the predicate. A copular subject directly followed by its predicate noun is not extended. */
    const isPart = i => P.at(i, 'V').some(v => v.f === 'pp' || v.f === 'past') && !P.at(i, 'N').length;
    const doSup = toks.slice(0, 2).some(t => /^(do|does|did)$/.test(t.w));
    let subject = null, descr = null, npExt = false, partQ = false, whHead = null;
    if (entity) { const ew = entity.split(' '); const ei = toks.findIndex((t, i) => ew.every((w, j) => toks[i + j] && toks[i + j].w === w)); let ee = ei + ew.length; const more = [];
      if (ei >= 0 && !(yn && ei === 1)) while (ee < toks.length && !closed(ee) && P.at(ee, 'N').length && !isPart(ee) && !(toks[ee + 1] && /^(the|a|an)$/.test(toks[ee + 1].w)) && !(doSup && P.at(ee, 'V').some(v => v.f === 'base'))) { more.push(toks[ee].w); ee++; }
      if (more.length) { entity = entity + ' ' + more.join(' '); npExt = true; } }
    /* SUBJ-PART (4.9.78): "what is X <participle> of / by / from …" — the subject is the noun phrase X; the participle and its phrase are the
       predicate (passive: X is the karma of the participle's verb), so they never join the subject */
    if (!yn && /^(what|which|who|whom)$/.test(toks[0].w) && toks[1] && /^(is|are|was|were)$/.test(toks[1].w)) { let i = 2; while (i < toks.length && /^(a|an|the)$/.test(toks[i].w)) i++; const np = [];
      while (i < toks.length && !closed(i) && !isPart(i) && (P.at(i, 'N').length || P.at(i, 'ADJ').length || P.at(i, 'PROPN').length || T[i].an.every(a => a.tag === 'UNK'))) { np.push(toks[i].w); i++; }
      if (np.length && i < toks.length && isPart(i)) { subject = np.join(' '); partQ = true; }
      else if (!subject && np.length && i >= toks.length && !(toks[2] && toks[2].w === 'the' && toks[3] && (/est$/.test(toks[3].w) || toks[3].w === 'most'))) { subject = np.join(' '); } /* 4.9.167: bare "what is NP". 4.9.179: "the largest N" stays a description, not a name. */
      /* DESCR (4.9.78): "what is the <ordinal | superlative> <noun> (<preposition> <NP>)" is a definite description, not a name: the subject
         is the whole description; a source resolves it only by a sentence that states "<Name> is the <description>" verbatim */
      const d0 = toks[2] && toks[2].w === 'the' ? 3 : -1; const ORD = /^(\d+(st|nd|rd|th)|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|last|[a-z]+-(first|second|third|[a-z]+th)|[a-z]+teenth|[a-z]+ieth)$/;
      const sup = j => toks[j] && (ORD.test(toks[j].w) || (/est$/.test(toks[j].w) && P.at(j, 'ADJ').some(a => a.lemma !== toks[j].w)) || toks[j].w === 'most');
      if (!subject && d0 > 0 && sup(d0) && toks.length > d0 + 1 && P.at(d0 + 1, 'N').length + P.at(d0 + 2, 'N').length > 0) { descr = toks.slice(d0).map(t => t.w).join(' '); subject = descr; } }
    /* DESCR-WHICH (4.9.92): "which <N> is the <superlative | ordinal> (<PP>)" asks the same definite description as "what is the <superlative> <N>
       (<PP>)": the wh-determiner's noun is the head the superlative leaves out (an elided head, read back from the wh-phrase) */
    if (!subject && !yn && toks[0].w === 'which' && toks.length >= 5) { const ORD2 = /^(\d+(st|nd|rd|th)|first|second|third|fourth|fifth|last|[a-z]+-(first|second|third|[a-z]+th))$/; let k = 1; const hn = []; while (k < toks.length && !closed(k) && (P.at(k, 'N').length || P.at(k, 'ADJ').length) && !/^(is|are|was|were)$/.test(toks[k].w)) { hn.push(toks[k]); k++; }
      if (hn.length && P.at(k - 1, 'N').length && toks[k] && /^(is|are|was|were)$/.test(toks[k].w) && toks[k + 1] && toks[k + 1].w === 'the' && toks[k + 2] && (ORD2.test(toks[k + 2].w) || (/est$/.test(toks[k + 2].w) && P.at(k + 2, 'ADJ').some(a => a.lemma !== toks[k + 2].w)) || (toks[k + 2].w === 'most' && toks[k + 3] && P.at(k + 3, 'ADJ').length))) {
        const supN = toks[k + 2].w === 'most' ? 2 : 1, after = toks.slice(k + 2 + supN).map(t => t.w); if (!after.length || G.CL[after[0]] && !/^(is|are|was|were)$/.test(after[0])) { const hd = P.at(k - 1, 'N')[0]; descr = toks.slice(k + 2, k + 2 + supN).map(t => t.w).concat(hn.slice(0, -1).map(t => t.w), [hd && hd.lemma || toks[k - 1].w], after).join(' '); subject = descr; } } }
    /* SUBJ-CLAUSE (4.9.83; live-probe classes a/e): in a wh-question with an inverted auxiliary ("how are bricks made", "why is the desert hot",
       "how does a compass work"), the subject is the noun phrase between the auxiliary and the predicate; the participle, bare verb or predicate
       adjective that follows it is the predicate and never joins the subject. Read from the parse: the longest noun phrase after the auxiliary
       that is directly followed by a verb or adjective reading. With a subject gap ("what causes tides") the question is about the object NP. */
    if (!subject && !yn && toks.length >= 3 && /^(how|why|when|where|what|which|who)$/.test(toks[0].w)) { const AUXW = /^(is|are|was|were|be|been|do|does|did|can|could|will|would|should|shall|may|might|must|has|have|had)$/;
      const DET = /^(a|an|the|this|that|these|those|its|their|his|her|our|your|my)$/; const cw = (a, b) => toks.slice(a, b).map(t => t.w).filter(w => !DET.test(w));
      if (AUXW.test(toks[1].w) && !(/^(what|which|who)$/.test(toks[0].w) && /^(is|are|was|were)$/.test(toks[1].w))) { /* "what is NP …" asks for the NP itself (SUBJ-PART / DESCR / ENT-OF-COMPLEMENT above decide it) */ const rest = toks.slice(2), P2 = G.Parser(rest, glex); const doSup = /^(do|does|did)$/.test(toks[1].w); /* do-support: "how do NP V …" — the bare verb opens the predicate, so the subject is everything before the first bare verb after a nominal */
            const cands = doSup ? rest.map((t, k) => k).filter(k => k > 0 && (t => t.w === 'do' || P2.at(k, 'V').some(v => v.f === 'base') || (k === rest.length - 1 && P2.at(k, 'UNK').length > 0))(rest[k]) /* an unknown word in the bare-verb slot at the end is that verb */ && rest.slice(0, k).some((t, j) => P2.at(j, 'N').length || P2.at(j, 'PROPN').length || P2.at(j, 'UNK').length || !P2.at(j, 'ADJ').length && !G.CL[t.w])).slice(0, 1) : P2.np(0).map(x => x.i).concat(rest.map((t, k) => k).filter(k => k > 0 && rest.slice(0, k).every((t, j) => P2.at(j, 'UNK').length || P2.at(j, 'N').length || P2.at(j, 'PROPN').length || /^(a|an|the)$/.test(t.w)) && rest.slice(0, k).some((t, j) => P2.at(j, 'UNK').length))).filter((k, j, a) => a.indexOf(k) === j).sort((x, y) => y - x); /* a nominal span holding an unknown word is a subject candidate too (the NP parser cannot see unknown heads) */
        for (const k of cands) { if (k >= rest.length) continue; const pred = doSup || P2.at(k, 'V').some(v => /^(pp|past|base|ing)$/.test(v.f)) || (P2.at(k, 'ADJ').length > 0 && (k + 1 >= rest.length || (!!G.CL[rest[k + 1].w] && !P2.at(k + 1, 'V').length && !/^(do|does|did)$/.test(rest[k + 1].w)))); /* an adjective predicate ends the clause or opens a PP; one followed by a verb is a modifier inside the subject */ if (pred && !closed(k + 2)) { const s = cw(2, 2 + k); if (s.length) { subject = s.join(' '); break; } } } }
      else if (/^(what|which|who)$/.test(toks[0].w) && !AUXW.test(toks[1].w) && P.at(1, 'V').some(v => /^(pres3|past)$/.test(v.f)) && toks.length > 2) { const rest = toks.slice(2), P2 = G.Parser(rest, glex); if (P2.np(0).some(x => x.i === rest.length)) { const s = cw(2, toks.length); if (s.length) subject = s.join(' '); } } }
    if (!subject && npExt) subject = entity;
    const terms = [], nouns = [], surf = []; if (entity) terms.push(entity); for (const n2 of names2) if (!terms.includes(n2)) terms.push(n2); const AUXV = /^(be|do|have|can|will|shall|may|might|must|should|would|could|get)$/;
    for (let i = 0; i < toks.length; i++) { if (closed(i) || (entity && entity.split(' ').includes(toks[i].w))) continue; const n = P.at(i, 'N')[0], a = P.at(i, 'ADJ')[0], v = P.at(i, 'V').find(x => !AUXV.test(x.lemma));
      const lem = n ? n.lemma : v ? v.lemma : a ? a.lemma : null; if (!lem || AUXV.test(lem) || /^(more|less|much|many|most|very|than|then)$/.test(toks[i].w)) continue; if (!terms.includes(lem)) { terms.push(lem); surf.push(toks[i].w); } if (n) nouns.push(n.lemma); else if (v && /ing$/.test(toks[i].w)) nouns.push(v.lemma); }
    for (const t of terms) if (!t.includes(' ') && !nouns.includes(t)) for (const c of [t.replace(/y$/, ''), t + 'ment', t + 'ion', t.replace(/e$/, '') + 'ation', t + 'ness']) if (c !== t && lex.hasPos(c, 'n')) { nouns.push(c); break; } /* M-DERIVE nominal of an adjective / verb term (guilty → guilt, impeach → impeachment) classifies it */
    const headN = entity && !entity.includes(' ') && lex.hasPos(entity, 'n') && !nouns.includes(entity) ? [entity] : []; /* 4.9.78: the subject's own semantic type classifies the field too ("water" is a compound) */
    /* CHEM-FORMULA (4.9.85/4.9.167): chemical formula tokens (H2O, CO2, NaCl, h2s) name a compound — case-insensitive when a digit is present (avoids ordinary words like "has"); no-digit needs chem capitalization (NaCl/CO) so English "What" never parses as W+H+At; authorities (PubChem, ChEBI) resolve the formula */
    const ELEM = new Set('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr'.split(' '));
    function parseChemFormula(w0){const s0=String(w0||'');if(!s0||s0.length>32||/\s/.test(s0))return null;if(/^(what|who|which|whom|where|when|why|how|this|that|these|those|with|from|have|has|had|was|were|been|being)$/i.test(s0))return null;let i=0,parts=[];while(i<s0.length){let matched=null;for(const len of[2,1]){if(i+len>s0.length)continue;const chunk=s0.slice(i,i+len);const canon=[...ELEM].find(e=>e.toLowerCase()===chunk.toLowerCase());if(canon){matched=canon;i+=len;break}}if(!matched)return null;let digits='';while(i<s0.length&&/\d/.test(s0[i]))digits+=s0[i++];parts.push(matched+digits)}if(!parts.length)return null;const formula=parts.join('');const hasDigit=/\d/.test(formula);const hasTwo=parts.some(p=>/[a-z]/.test(p.replace(/\d+$/,'')));if(!(hasDigit||(parts.length>=2&&hasTwo)))return null;/* no digit: source must be chem-capitalized (each element starts upper) — blocks What→WHAt */if(!hasDigit&&!/^[A-Z][a-z]?(?:[A-Z][a-z]?\d*)+$/.test(s0)&&!/^[A-Z][a-z]?$/.test(s0))return null;return formula}
    const formula = (()=>{const cands=[];for(let i=0;i<toks.length;i++){if(closed(i))continue;const w=toks[i].orig||toks[i].w;const f=parseChemFormula(w);if(f)cands.push(f)}return cands.find(f=>/\d/.test(f))||cands[0]||null})();
    if (formula) { entity = formula.toLowerCase(); if (!subject) subject = formula; const fl = formula.toLowerCase(); if (!terms.includes(fl) && !terms.includes(formula)) terms.unshift(fl); }
    /* 4.9.175: "what happens if/when …" asks for the effect. The subject is the nouns in that clause, not the verb happens. */
    if (toks[0] && toks[0].w === 'how' && toks[1] && /^(do|does|did)$/.test(toks[1].w) && toks[2] && /^(you|i|we)$/.test(toks[2].w) && toks[3] && P.at(3, 'V').some(v => v.f === 'base')) {
      const obj = []; for (let i = 4; i < toks.length; i++) if (!/^(a|an|the)$/.test(toks[i].w)) obj.push(toks[i].w);
      if (obj.length) { subject = obj.join(' '); entity = subject; }
    }
    if (toks[0] && toks[0].w === 'what' && toks[1] && toks[1].w === 'happens' && toks[2] && /^(if|when)$/.test(toks[2].w)) {
      const ns = []; for (let i = 3; i < toks.length; i++) if (P.at(i, 'N').length && !/^(you|i|we)$/.test(toks[i].w)) ns.push(toks[i].w);
      if (ns.length) { subject = ns.join(' '); entity = subject; }
    }
    /* 4.9.175: "can I mix A and B" asks for the effect of mixing, not whether the speaker is able. The subject is those nouns. */
    let mixEffect = false;
    if (yn && toks[0] && /^(can|could|should|may|might)$/.test(toks[0].w) && toks[1] && /^(i|you|we)$/.test(toks[1].w)) {
      const vi = toks.findIndex((t, i) => i > 1 && P.at(i, 'V').some(v => v.f === 'base' && /^(mix|combine)$/.test(v.lemma)));
      if (vi > 1) { const ns = []; for (let i = vi + 1; i < toks.length; i++) if (P.at(i, 'N').length) ns.push(toks[i].w); if (ns.length >= 2) { subject = ns.join(' '); entity = subject; mixEffect = true; } }
    }
    /* 4.9.167: bare what/who/which-is NP is the lookup entity (repairs a prior wh-entity). Do NOT set entity for when/how/date asks — that would rebuild key as [entity-head]+surf and drop the asked predicate (berlin wall fall → wall,berlin,wall). Formula already set entity above. */
    if ((!entity || /^(what|who|which|whom)$/i.test(entity)) && subject && !partQ && !descr && /^(what|who|which)$/i.test(toks[0].w)) entity = subject;
    const domains = formula ? ['chemistry'] : []; for (const [d, anchors] of Object.entries(DOMAIN_ANCHORS)) if (!domains.includes(d) && nouns.concat(headN).some(nw => anchors.some(an => { if (nw === an) return true; try { const r = INF.isA(nw, an); return r.status === 'yes' || r.status === 'mixed'; } catch (e) { return false; } }))) domains.push(d);
    const drug = nouns.find(nw => { try { const r = INF.isA(nw, 'drug'); return r.status === 'yes' || r.status === 'mixed'; } catch (e) { return false; } }) || null;
    let isa = null, rel = null; if (yn && /^(is|are|was|were)$/.test(toks[0].w)) { const s1 = P.np(1).sort((x, y) => y.i - x.i)[0]; if (s1 && /^(a|an|the)$/.test(toks[s1.i] && toks[s1.i].w || '')) { const s2 = P.np(s1.i).filter(x => x.i === toks.length).sort((x, y) => y.i - x.i)[0];
        const hd = n => n && (n.head ? n.head[n.head.length - 1] : n.ger && n.ger.verb ? n.ger.verb.lemma : n.propn ? String(n.propn).toLowerCase() : null); const a = hd(s1.node), b = s2 && hd(s2.node);
        const forms = (x, i) => [...new Set([x, toks[i] && toks[i].w].concat(P.at(i, 'V').map(v => v.lemma)).filter(Boolean))]; if (a && b) { if (s2.node.of) rel = { a: forms(a, s1.i - 1), p: b, b: hd(s2.node.of) }; else { const yw = toks.slice(s1.i + 1).map(t => t.w).filter(w => /^[a-z-]+$/.test(w)); isa = { x: a, y: [yw.length > 1 && yw[yw.length - 1] === b ? yw.join(' ') : b] }; } }  /* ISA-MOD (4.9.56): a modified class ("a ferromagnetic material") is the whole phrase; its head alone (material) is a wider class */ } }
    /* ISA-UNKNOWN (4.9.56): "is X a W" whose class word W is outside the lexicon (opioid) still has the copular frame: the words after the last
       article are the class, the words between the copula and it the subject; W joins the terms (it is the asked class) */
    if (!isa && !rel && yn && /^(is|are|was|were)$/.test(toks[0].w)) { const d = toks.map(t => t.w).lastIndexOf('a') > 0 ? toks.map(t => t.w).lastIndexOf('a') : toks.map(t => t.w).lastIndexOf('an'); if (d > 1 && d < toks.length - 1) { const yw = toks.slice(d + 1).map(t => t.w).join(' '), xw = toks.slice(1, d).filter(t => !/^(a|an|the)$/.test(t.w)).map(t => t.w);
        if (xw.length && toks.slice(d + 1).some(t => !lex.lookup(t.w).length && !lex.hasPos(t.w, 'n'))) { isa = { x: xw[xw.length - 1], y: [yw] }; if (!terms.includes(yw)) terms.push(yw); if (!surf.includes(yw)) surf.push(yw); } } }
    const key = partQ ? [subject.split(' ').pop()] /* 4.9.78: the participle is the asked relation (composition, agent, source), not a word the answer must repeat */ : entity ? [entity.split(' ').pop()].concat(surf.slice(0, 2)) : surf.slice(0, 3);
    const nominal = [...new Set((entity ? [entity] : []).concat(nouns.filter(x => terms.includes(x))))];
    /* ANS-TYPE (4.9.52; the wh-word / degree-adverb is the operator whose variable the answer binds — Chomsky's wh-movement leaves a typed gap):
       who → person, when → date, where → place, why → cause, how + ADJ / how many / how much → quantity, bare how → method, aux-first → verdict */
    const w0 = toks[0].w, a1 = toks[1] && (P.at(1, 'ADJ').length || /^(many|much)$/.test(toks[1].w)); const atype = mixEffect ? 'cause' : yn ? 'verdict' : w0 === 'what' && toks[1] && toks[1].w === 'happens' && toks[2] && /^(if|when)$/.test(toks[2].w) ? 'cause' : w0 === 'what' && toks[1] && P.at(1, 'V').some(v => effectNounsOf(v.lemma).length) ? 'cause' /* CAUSE-WHAT (4.9.56): "what causes X" asks for the cause (the verb has effect nominals) */ : /^(who|whom|whose)$/.test(w0) ? 'person' : w0 === 'when' ? 'date' : w0 === 'where' ? 'place' : w0 === 'why' ? 'cause' : w0 === 'how' ? (a1 ? 'quantity' : 'method') : 'description';
    const proDo = /^(what|which)$/.test(w0) && toks.length > 3 && /^(do|does|did)$/.test(toks[1].w) && toks[toks.length - 1].w === 'do' && P.at(toks.length - 1, 'AUX').length && !toks.slice(2, -1).some((t, k) => P.at(k + 2, 'V').length && !P.at(k + 2, 'N').length); /* PRO-VERB (4.9.87): the wh-word is the karma of the pro-verb "do" after do-support — the gap is the subject's activity, read from the parse */
    if (proDo && !subject) { const sw = toks.slice(2, -1).map(t => t.w).filter(w => !(G.CL[w] && G.CL[w].includes('DET'))); if (sw.length) subject = sw.join(' '); } /* PRO-VERB: the subject is the noun phrase between do-support and the pro-verb */
    /* WH-DET COPULAR (4.9.88): "what/which <NP> <be> <XP>" — the wh-phrase is the predicate nominal (the class asked for), the copula's other side is the
       subject. An XP that is only a superlative ("the largest", "the lightest in …") is a property of the wh-phrase's head, so the subject is ADJ + head.
       Read from the tags, not from a list of question phrasings. */
    if (!subject && /^(what|which|whose)$/.test(w0) && toks.length > 3) { const c = toks.findIndex((t, k) => k > 1 && /^(is|are|was|were)$/.test(t.w)); /* the copula's finite forms */
      const whNP = c > 1 ? toks.slice(1, c) : [], isN = k => P.at(k, 'N').length > 0, isV = k => P.at(k, 'V').length > 0 && !isN(k);
      if (c > 1 && whNP.some((t, k) => isN(k + 1)) && !whNP.some((t, k) => isV(k + 1))) { let r = toks.slice(c + 1).map((t, k) => ({ w: t.w, k: k + c + 1 })).filter(x => !P.at(x.k, 'DET').length);
        const pp = r.findIndex(x => P.at(x.k, 'PREP').length && !isN(x.k) || P.at(x.k, 'V').some(v => v.f === 'pp' || v.f === 'past')); if (pp >= 0) r = r.slice(0, pp); /* a PP or a passive participle closes the subject NP */
        const head = [...whNP.keys()].reverse().map(k => k + 1).find(isN), sup = r.length && r.every(x => P.at(x.k, 'ADJ').length && !isN(x.k) || x.w === 'most' || x.w === 'least');
        if (r.length && sup && head) { subject = r.map(x => x.w).concat([toks[head].w]).join(' '); whHead = toks[head].w; }
        else if (r.length && r.length <= 5) { subject = r.map(x => x.w).join(' '); if (w0 === 'whose' && head) whHead = toks[head].w; /* 4.9.96: whose <possessed> is <XP> — possessed head is the asked NP; XP is the looked-up subject */ }
        else if (w0 === 'whose' && head) { whHead = toks[head].w; if (!subject && entity) subject = entity; } } }
    /* DIM (4.9.52): the dimension a degree adjective measures is read from its WordNet glosses (tall = "great in vertical dimension" → length;
       heavy = "great physical weight" → mass; old = "lived … long time" → time) */
    const dimOf = a => { const g = []; for (const t of ['core', 'ext', 'pro']) { const L = lex.wn[t] && lex.wn[t].L; if (L && L[a]) for (const e of L[a]) if (e[0] === 'a') for (const sn of e[1]) g.push(String(sn[2] || '')); } const G2 = g.join(' / '); const d = [];
      if (/dimension|depth|elevation|extension|extent|distance|length|spatial|height|stature|size/.test(G2)) d.push('length'); if (/weight|density|mass/.test(G2)) d.push('mass'); if (/lived|\bage\b|duration|temporal|time/.test(G2)) d.push('time');
      if (/heat|temperature/.test(G2)) d.push('temperature'); if (/quickly|speed|moving/.test(G2)) d.push('speed'); if (/strength|power|force|pressure/.test(G2)) d.push('strength'); return d; };
    const degree = w0 === 'how' && a1 && /^[a-z]+$/.test(toks[1].w) && !/^(many|much)$/.test(toks[1].w) ? toks[1].w : null;
    /* the asked predicate of a yes/no question (last adjective / participle / verb content term) and its lexical negators: every lexicon word whose WordNet
       gloss is "not P…" (acquit = "pronounce not guilty …") plus "un-P"/"in-P" adjective forms in the lexicon; derived from glosses, not listed */
    let pred = null; if (yn && /^(can|could|do|does|did|will|would|may|might|must|should|shall)$/.test(w0)) for (let i = 1; i < toks.length && !pred; i++) { const v = P.at(i, 'V').find(x => !AUXV.test(x.lemma) && (x.f === 'base' || ((x.f === 'pp' || x.f === 'past') && toks[i - 1] && toks[i - 1].w === 'be'))); if (v && i > 1) pred = v.lemma; } /* do/modal question: the main verb is the predicate */
    if (yn && !pred) for (let i = toks.length - 1; i > 0 && !pred; i--) { const a = P.at(i, 'ADJ')[0], v = P.at(i, 'V').find(x => !AUXV.test(x.lemma)); if (a && !/^(more|less|most|least|much|many)$/.test(toks[i].w) && !(entity && entity.includes(toks[i].w))) pred = a.lemma; else if (v && (v.f === 'pp' || v.f === 'past')) pred = v.lemma; }
    if (yn && !pred) for (let i = 1; i < toks.length && !pred; i++) { const v = P.at(i, 'V').find(x => !AUXV.test(x.lemma)); if (v && v.f === 'base') pred = v.lemma; } /* do-support: the bare main verb is the asked predicate */
    if (yn && !pred && /^(is|are|was|were)$/.test(toks[0].w)) for (let i = toks.length - 1; i > 1 && !pred; i--) { const n = P.at(i, 'N')[0]; if (n && !closed(i)) { pred = n.lemma; if (!isa && !rel && P.at(i, 'ADJ').length === 0) isa = { x: entity || (terms.find(t => t !== n.lemma && t !== toks[i].w) || ''), y: [n.lemma] }; } } /* copula + NP: the predicate noun — a class statement (4.9.56: "is the Moon a planet") */
    const negators = pred ? negatorsOf(pred) : [];
    /* the asked relation and its object for a structured lookup: who/when → the verb ("who wrote X" → write), quantity → the degree adjective; the object
       is the named entity or the content span after it ("the Mariana trench") */
    let asked = degree, object = entity, vi = -1; if (!asked && /^(person|date|place)$/.test(atype)) for (let i = 1; i < toks.length && vi < 0; i++) { const v = P.at(i, 'V').find(x => !AUXV.test(x.lemma)); if (v && !P.at(i, 'N').length) { asked = v.lemma; vi = i; } }
    if (!asked && /^(person|date|place)$/.test(atype)) for (let i = toks.length - 1; i > 0 && vi < 0; i--) { const v = P.at(i, 'V').find(x => !AUXV.test(x.lemma)); if (v) { asked = v.lemma; vi = i; } } /* do-support leaves the bare verb last ("when did the wall fall") */
    if (object && asked) { const ws = object.split(' '); let j = toks.findIndex(t => t.w === ws[ws.length - 1]); const more = []; while (j >= 0 && ++j < toks.length && j !== vi && P.at(j, 'N').length && !closed(j)) more.push(toks[j].w); if (more.length) object = object + ' ' + more.join(' '); } /* "Mariana trench": the named head with its common-noun completion */
    if (!object && asked) { if (vi > 0 && atype !== 'person') { const sp = toks.slice(1, vi).filter((t, j) => !closed(1 + j)).map(t => t.w); if (sp.length) object = sp.join(' '); } }
    if (!object && asked) { const from = degree ? 2 : vi + 1; object = toks.slice(from).filter((t, j) => !closed(from + j) || t.w === 'of').map(t => t.w).join(' ').replace(/^of |\bof$/g, '').trim() || null; }
    /* POLITY-ADJUNCT (4.9.56): a named polity after in/of/for ("… in the United States", "emperor of China") locates the question; it is the jurisdiction,
       not the asked object — a polity is a country word (countryOf), its initials ("United States" → us), or a phrase headed by a sovereignty noun ("United Kingdom") */
    let polAdj = null; if (entity && /^(person|place|date|description)$/.test(atype)) { const ew = entity.split(' '); const ei = toks.findIndex((t, i) => ew.every((w, j) => toks[i + j] && toks[i + j].w === w)); let pi = ei - 1; if (pi > 0 && /^(the)$/.test(toks[pi].w)) pi--;
      if (pi > 0 && /^(in|of|for|within)$/.test(toks[pi].w)) { const c = countryOf(entity) || (ew.length > 1 ? countryOf(ew.map(w => w[0]).join('')) : null) || (ew.length > 1 && countryOf(ew[ew.length - 1]) ? entity : null); if (c) { polAdj = c;
        if (!object || object.startsWith(entity)) { const from = vi > 0 ? vi + 1 : 1; const sp = toks.slice(from, pi).filter((t, j) => !closed(from + j) && !AUXV.test(t.w) && !/^(is|are|was|were)$/.test(t.w)).map(t => t.w); object = sp.length ? sp.join(' ') : null; } } } }
    const copNP = /^(person|place)$/.test(atype) && toks[1] && /^(is|are|was|were)$/.test(toks[1].w) && toks.length > 3 ? toks.slice(2).map(t => t.w).filter((w, j) => j > 0 || !/^(a|an|the)$/.test(w)).join(' ') : null; /* COP-NP: "who was the last king of Rome" — the identity the answer is */
    if (rel && rel.p) pred = rel.p; else if (isa && isa.y) pred = isa.y[0]; const dims = degree ? dimOf(degree) : [];
    /* the nominal arguments a verdict sentence must mention (not the predicate, not a participle/past form) */
    const args = (entity ? [entity.split(' ').pop()] : []).concat(names2.map(n => n.split(' ').pop())); for (let i = 0; i < toks.length; i++) { if (closed(i)) continue; const n = P.at(i, 'N')[0]; if (!n || P.at(i, 'V').some(v => v.f === 'past' || v.f === 'pp') || n.lemma === pred || (entity && entity.split(' ').includes(toks[i].w) && toks[i].w !== entity.split(' ').pop())) continue; if (!args.includes(toks[i].w)) args.push(toks[i].w); }
    let predVerb = false; if (pred) for (let i = 1; i < toks.length; i++) if (P.at(i, 'V').some(v => v.lemma === pred && v.f === 'base') && !P.at(i, 'ADJ').length) predVerb = true;
    const predForms = pred && predVerb ? [...new Set([pred, G.inflect(pred, 'past'), G.inflect(pred, 'pp'), pred + 's', pred.replace(/e$/, '') + 'es'].filter(Boolean))] : [];
    /* CMP (4.9.53): "do A have more N than B" → a rank comparison of A over B in dimension N */
    let cmp = null; { const mi = toks.findIndex(t => /^(more|less|greater|higher|lower)$/.test(t.w)); const ti = toks.findIndex((t, j) => t.w === 'than' || (t.w === 'then' && mi >= 0 && j > mi && j - mi <= 4)); /* M-THAN-ORTHO */ if (ti > 0 && mi > 0 && mi < ti) { const nb = toks.slice(ti + 1).filter((t, j) => !closed(ti + 1 + j)).map(t => t.w).pop(); const na = toks.slice(1, mi).filter((t, j) => !closed(1 + j) && P.at(1 + j, 'N').length).map(t => t.w).pop(); const dim = toks.slice(mi + 1, ti).filter((t, j) => P.at(mi + 1 + j, 'N').length).map(t => t.w).pop();
      if (na && nb) cmp = { a: na.replace(/s$/, ''), b: nb.replace(/s$/, ''), dim: dim || null, dir: /^(less|lower)$/.test(toks[mi].w) ? -1 : 1 }; } }
    const askedForms = asked && !degree ? [...new Set([G.inflect(asked, 'past'), G.inflect(asked, 'pp'), G.inflect(asked, '3sg')].filter(Boolean))] : [];
    const affirmers = pred ? affirmersOf(pred) : []; const dimNoun = degree ? dimNounOf(degree) : null;
    const plan = { question: String(text), whHead, entity: polAdj && object !== entity ? null : entity, terms: terms.slice(0, 6), nominal, atype, gap: proDo ? 'function' : null, degree, dims, dimNoun, affirmers, args, askedForms, predVerb, predForms, cmp, asked, object, pred, negators: pred ? negatorsOf(pred) : negators, symmetric: !!(pred && predVerb && reciprocal(pred)), effectNouns: pred && predVerb ? effectNounsOf(pred) : [], coming: atype === 'date' && comingOf(asked), juris: polAdj || jurisOf(text), subject, descr, copNP, polAdj: !!polAdj, effectNP: atype === 'cause' && w0 === 'what' ? toks.slice(2).filter((t, j) => !closed(2 + j) || /^\d+$/.test(t.w)).map(t => t.w).join(' ') || null : null, key, domains, yn, isa, rel, drug, neg: toks.some(t => t.w === 'not' || t.w === 'never') }; Object.defineProperty(plan, 'countryOf', { value: countryOf, enumerable: false }); return plan; }
  ensureStarter();
  return { meaDetail, meaMetaK, adoptMetaK, withdrawMetaK, meaMetaAdoptions: () => store.load('admitted_meta'), meaCandidatesK, meaArchiveK, meaRequeueK, adoptManifestK, withdrawManifestK, meaAdoptionsK: () => store.load('admitted_manifests_k'), meaProblems, meaCycle, meaSupply, meaCommit, meaArchive: () => store.load('mea_archive'), meaReceipts: () => store.load('mea_receipts'), meaRequeue, meaHandoff: meaHandoffOf, workingFacts: () => working.filter(w => w.status === 'active').map(w => ({ id: w.id, text: w.sensitive ? null : memText(w), turn: w.provenance.turn })), promoteWorking, meaCandidates, adoptManifest, withdrawManifest, meaAdoptions: () => store.load('admitted_manifests'), exportTurnPacket, turnPackets, lookupPlan, subjectNP, askedNP, grammarLex: glex, countryOf, gksIndex: () => gksIndex(), proofExports: () => baseStore.load('proof_exports'), caseState, caseSeal, caseUnseal, exportProof, gksFacts, ingestShared, challengeShared, withdrawRule, lexicon: lex, store, echo, perm, containment: cont, bench, commitHeld, rejectHeld, heldWrites: () => store.load('held_writes'), resurrect, commitResurrection, commitIdea, creativeProposals: () => (store.load('creative_proposals') || []).map(p => ({ id: p.id, claim: p.claim, claim_status: p.claim_status, novelty: p.novelty, drift: p.drift, status: p.status, intent: p.intent })), resurrectionProposals: () => proposals().map(p => ({ id: p.id, label: p.label, tier: p.tier, status: p.status })), resurrectPreview, releaseDream, approveHypothesis, adoptPhoneProposal, phoneProposals: () => phoneProposals.map(p => ({ id: p.id, text: p.text, route: p.route, eps_s: p.eps_s, may_project: !!p.may_project, contradicts: p.contradicts, echo: !!p.echo })), meaPProposals: () => meaPProposals.map(p => ({ candidate_id: p.candidate_id, op: p.op, claim: p.claim, claim_status: p.claim_status, eps: p.eps, route: p.route, novelty: p.novelty, standing: p.standing, echo: !!p.echo })), admittedRules: () => store.load('admitted_rules'), stagedHypotheses: () => stagedHyps.map(h => JSON.parse(JSON.stringify(h))), hypotheses: () => cont.hypotheses.list(), realize: m => D.realizeMeaning(m, ENV), deriveEnv: ENV, meta: () => meta, setNotation(n) { meta.notation = n === 'phi' ? 'phi' : 'plain'; saveMeta(); },
    attachLexicon(data, tier) { lex.attach(data, tier); ensureStarter(); },
    starterView, clearStarterKnowledge, previewImport, importConfirmedPack, admitImportItem, clearImportPack, importView, confirmedSharedView, sharedKnowledgeView, pullHostedSharedPack, writeSharedKnowledge, setSharedKbWriteKey, clearSharedKbWriteKey, admitConfirmedShared, admitConfirmedSharedItem, clearConfirmedShared, clearHostedSharedKnowledge,
    memory: () => store.load('memory'), cold: () => store.load('cold_storage'), evidence: () => store.load('evidence'), traces: () => store.load('trace'), examples: () => store.load('language_examples'),
    deleteRecord(id, reason, userTap) { if (userTap === false) return false; const pd = perm.authorize('memory.delete_ui', { userTap: true, subject: id }); if (pd.decision !== 'allow') return false; const mem = store.load('memory'); const i = mem.findIndex(r => r.id === id); if (i < 0) return false; const r = mem.splice(i, 1)[0]; r.status = 'forgotten'; store.save('memory', mem); const cold = store.load('cold_storage'); cold.push({ id: r.id, sealed_at: now(), reason: 'forgotten from the Memory screen (explicit tap + confirm)', record: r, successor: { kind: 'lifecycle_transition', from: 'accepted', to: 'archived', rule: 'forge2 APPEND_ONLY_SUCCESSOR_LAWS_V1 §Lifecycle transition' }, tier: 'WARM', resurrection_attempts: 0 }); store.save('cold_storage', cold); const tr = store.load('trace'); tr.push({ turn: 'ui', at: now(), input: '[Memory screen] delete ' + id, rules: [{ id: 'AUTH-UI-DELETE', doc: 'Doc7 (explicit user action)', note: reason || '' }], deleted: { id, kind: r.kind } }); store.save('trace', tr); const ws = dwsBuild(meta.turn); const tm = tmsSync({ op: 'memory.delete_ui', id }); try { publishWorldHead(projectView(ws.changed ? ws.state : null), ws.changed ? ws.state : null, meta.turn, tm.withdrawn.map(w => w.id)); } catch (e) { /* the delete already landed; a head failure does not report the tap as refused */ } return true; },
    justifications: () => TMS.list(), worldState: () => worldStateView(), worldHead: () => liveHead(), withdrawalReceipts: () => TMS.receipts(), replayJustification: id => tmsReplay(id), whyOf: id => justifyMaterial(TMS.get(id)),
    categories: CATEGORIES, exportAll() { const o = {}; for (const c of CATEGORIES) o[c] = store.load(c); return o; }, reparseClause, derive: t => derive(G.tokenize(t)), deriveSource: t => derive(G.tokenize(t), true), reparseSource: t => reparseClause(t, true), renderClause: c => G.clauseText(c, 'kernel'), outward: (t, a) => outward(t, a) };
}
function compat(c) { const v = c.verb || {}; return Object.assign({}, c, { _ast: c, pol: v.pol, mod: v.mod, tense: v.tense, val: c.pred ? (c.pred.type === 'adj' ? c.pred.words.join(' ') : (c.pred.prep ? c.pred.prep + ' ' : '') + G.npText(c.pred.np, 'kernel')) : G.vpText(c, c.subj, 'kernel'), cond: c.cond ? G.clauseText(c.cond, 'kernel') : null }); }
let _ck = null; const ck = () => (_ck = _ck || Kernel({ lexicon: isNode ? (() => { try { return require('../data/lexicon.json'); } catch (e) { return null; } })() : root.KLEX_CORE }));
const api = { Kernel, MemoryStore, mathSurface, canon,
  renderClause: c => G.clauseText(c._ast || c, 'kernel'),
  parseClause: s => { const d = ck().derive(s); return d.parses[0] ? compat(d.parses[0].node.clause) : null; },
  parseRenderedClause: t => { const c = ck().reparseClause(t); return c ? compat(c) : null; } };
if (isNode) module.exports = api; else root.KKernel = api;
})(this);
