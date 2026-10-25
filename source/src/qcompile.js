/* qcompile.js — 4.9.83 QUERY COMPILER (Nic 2026-10-21 4:55 PM). Replaces the keyword bag and the binary SUBJECT_MISMATCH guard.
 * Design sources (Nic's papers, cited in CONFLICTS.md v4.9.83):
 *   - Pāṇini compiler shape (roots → roles → rules → surface): the question is compiled into its kāraka roles — the subject (kartā / karma of
 *     the asked predicate), the predicate (dhātu), the ASKED RELATION (the gap the wh-word opens: hetu "why" → cause, karaṇa "how" → method,
 *     kartā "who" → agent, kāla "when" → time, adhikaraṇa "where" → place, "what is" → description) and modifiers (jurisdiction).
 *   - RSOC / RMC drift bands (kmath.DRIFT_RULING, Nic ruling 2026-10-14): ε ≤ 0.35 is projectable; anything above is not used.
 * Every role is expanded to the forms within its drift band (surface 0; morphology / numeral word 0.05; archive redirect or alias 0.10;
 * WordNet synonym 0.15; WordNet hypernym 0.30; a second hypernym step 0.45 is recorded and NOT used). A candidate source is scored by its
 * subject drift (the lowest-drift expansion that names the source's title, alias, or lead subject) plus half its relation drift (does the
 * chosen sentence fill the asked relation). The lowest-drift answer is taken; the compiler refuses only when every candidate is above the band.
 * Deterministic; no model; no topic lists. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const PV = isNode ? require('./provenance.js') : root.KProv; const KM = isNode ? require('./kmath.js') : root.KMath;
  const BAND = (KM && KM.DRIFT_RULING && KM.DRIFT_RULING.project_max) || 0.35;
  const DRIFT = Object.freeze({ surface: 0, morph: 0.05, numeral: 0.05, redirect: 0.10, alias: 0.10, synonym: 0.15, hypernym: 0.30, hypernym2: 0.45, description: 0.05, narrower: 0.2, sense: 0.3, qualifier: 0.1, derivation: 0.05, claim: 0.1 });
  const words = t => String(t || '').toLowerCase().replace(/[‐‑–]/g, '-').match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) || [];
  const FW = new Set('a an the of to in on at by for with from into about than as and or but is are was were be been being do does did can could will would should may might must has have had what who whom when where why how which that this these those it its'.split(' '));
  const numeralForms = w => PV.numeralForms(w); /* digits ↔ words (provenance.js NUMERAL FORMS) */
  /* morphology: the other number of a noun (regular rules; WordNet exceptions via the host) */
  const otherNumber = w => /ies$/.test(w) ? [w.slice(0, -3) + 'y'] : /(s|x|z|ch|sh)es$/.test(w) ? [w.slice(0, -2)] : /ss$/.test(w) ? [w + 'es'] : /s$/.test(w) && w.length > 3 ? [w.slice(0, -1)] : /[^aeiou]y$/.test(w) ? [w.slice(0, -1) + 'ies'] : /(s|x|z|ch|sh)$/.test(w) ? [w + 'es'] : /\d/.test(w) ? [] : [w + 's'];
  const verbForms = v => { if (!v) return []; const o = new Set([v]); o.add(/[^aeiou]y$/.test(v) ? v.slice(0, -1) + 'ies' : /(s|x|z|ch|sh)$/.test(v) ? v + 'es' : v + 's'); o.add(/e$/.test(v) ? v + 'd' : /[^aeiou]y$/.test(v) ? v.slice(0, -1) + 'ied' : v + 'ed'); o.add(/ie$/.test(v) ? v.slice(0, -2) + 'ying' : /[^e]e$/.test(v) ? v.slice(0, -1) + 'ing' : v + 'ing'); return [...o]; };
  /* irregular forms of a lemma (WordNet exception lists, inverted once) */
  let IRR = null; const irregular = (lex, l) => { if (!IRR) { IRR = new Map(); const wn = (lex && lex.wn) || {}; for (const t of ['core', 'ext', 'pro']) { const e = wn[t] && wn[t].exc; if (e) for (const f of Object.keys(e)) { const ls = [].concat(e[f]); for (const x of ls) { const a = IRR.get(x) || []; if (!a.includes(f)) a.push(f); IRR.set(x, a); } } } } return IRR.get(l) || []; };
  /* WordNet access through the kernel's lexicon (lex.wn tiers: L lemma → senses, H synset → hypernyms, N synset → head lemma) */
  let SYN = null; const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  function synIndex(lex) { if (SYN) return SYN; SYN = new Map(); const wn = (lex && lex.wn) || {}; for (const t of ['core', 'ext', 'pro']) { const d = wn[t]; if (!d || !d.L) continue; for (const l of Object.keys(d.L)) for (const [p, ss] of d.L[l]) for (const s of ss) { if (p !== 'n' && p !== 'v') continue; let a = SYN.get(s[0]); if (!a) SYN.set(s[0], a = []); if (!a.includes(l)) a.push(l); } } return SYN; }
  function firstSynset(lex, w, pos) { const wn = (lex && lex.wn) || {}; for (const x of [w].concat(pos === 'n' ? otherNumber(w) : [])) for (const t of ['core', 'ext', 'pro']) { const d = wn[t]; if (d && own(d.L, x)) for (const [p, ss] of d.L[x]) if (p === pos && ss.length) return ss[0][0]; } return null; }
  function hypernymOf(lex, sid) { const wn = (lex && lex.wn) || {}; for (const t of ['core', 'ext', 'pro']) { const d = wn[t]; if (d && d.H && own(d.H, sid)) return d.H[sid][0] || null; } return null; }
  const lemmaOf = (lex, sid) => { const a = synIndex(lex).get(sid); return a && a.length ? a[0] : null; };
  /* the ASKED RELATION from the language core's answer type (the gap of the wh-word) */
  const RELATION = { function: 'function', cause: 'cause', method: 'method', person: 'agent', date: 'time', place: 'place', quantity: 'quantity', description: 'description', verdict: 'verdict' };
  function compile(lp, text, lex, subject) { lp = lp || {}; const q = String(text || lp.question || '');
    const subj = String(subject || lp.subject || lp.entity || lp.object || '').toLowerCase().trim(); const sw = words(subj);
    /* 4.9.87 (Nic 7:36 PM (e)): the asked relation is the wh-operator's typed gap as the parse reads it (lookupPlan ANS-TYPE), never a phrase list */
    const asked2 = RELATION[lp.gap || lp.atype] || 'description', asked = asked2;
    const sl = sw.map(w => otherNumber(w).concat([w])); const notSubj = w => !sl.some(f => f.includes(w)) && !(lp.juris && w === lp.juris);
    /* the predicate root (dhātu): the asked verb, else the last content lemma of the plan that is not a subject word */
    const predW = (lp.terms || []).map(String).filter(w => !/\s/.test(w) && !FW.has(w) && notSubj(w)); const predicate = lp.asked || predW[predW.length - 1] || null;
    const ps = predicate && lex && lex.senses ? (lex.senses(predicate) || []).map(x => x.pos) : []; const qw = words(q);
    /* the predicate's part of speech from the question itself: a verb when it is inflected there or follows do-support, else an adjective / noun */
    const predPos = !predicate ? null : ps.includes('v') && (lp.asked || qw.some(w => w !== predicate && verbForms(predicate).concat(irregular(lex, predicate)).includes(w)) || /^(do|does|did)$/.test(qw[1] || '')) ? 'v' : ps.includes('a') || ps.includes('s') ? 'a' : ps[0] || null;
    const roles = { subject: subj || null, predicate: asked2 === 'function' ? null : predicate, predicate_pos: asked2 === 'function' ? null : predPos, asked: asked2, modifiers: Object.assign({}, lp.juris ? { jurisdiction: lp.juris } : {}) };
    const exps = []; const add = (role, form, drift, via) => { form = String(form).trim(); if (!form || exps.some(e => e.role === role && e.form === form)) return; exps.push({ role, form, drift: Math.round(drift * 100) / 100, via, used: drift <= BAND }); };
    if (sw.length) { add('subject', sw.join(' '), DRIFT.surface, 'surface'); const head = sw[sw.length - 1], pre = sw.slice(0, -1);
      for (const h of otherNumber(head)) add('subject', pre.concat([h]).join(' '), DRIFT.morph, 'morphology');
      sw.forEach((w, i) => { for (const n of numeralForms(w)) add('subject', sw.slice(0, i).concat([n], sw.slice(i + 1)).join(' '), DRIFT.numeral, 'numeral'); });
      const key = sw.length > 1 && firstSynset(lex, sw.join('_'), 'n') ? sw.join('_') : head; const sid = firstSynset(lex, key, 'n');
      if (sid && !(key === head && pre.length)) { for (const l of synIndex(lex).get(sid) || []) if (l !== key) add('subject', (key === head ? pre.concat([l.replace(/_/g, ' ')]) : [l.replace(/_/g, ' ')]).join(' '), DRIFT.synonym, 'wordnet:synonym');
        /* a synonym / hypernym stands for the whole subject only when the subject is one lexicon concept (a modified head's loses its modifiers) */
        const h1 = hypernymOf(lex, sid); if (h1) { const l1 = lemmaOf(lex, h1); if (l1) add('subject', l1.replace(/_/g, ' '), DRIFT.hypernym, 'wordnet:hypernym');
          const h2 = hypernymOf(lex, h1); const l2 = h2 && lemmaOf(lex, h2); if (l2) add('subject', l2.replace(/_/g, ' '), DRIFT.hypernym2, 'wordnet:hypernym'); } } }
    if (predicate) { const irr = irregular(lex, predicate); for (const f of (predPos === 'v' ? verbForms(predicate).filter(f => !(irr.length && /ed$/.test(f))).concat(irr) : [predicate])) add('predicate', f, f === predicate ? 0 : DRIFT.morph, f === predicate ? 'surface' : 'morphology');
      const sid = firstSynset(lex, predicate, 'v'); if (sid) for (const l of synIndex(lex).get(sid) || []) if (l !== predicate && !/_/.test(l)) add('predicate', l, DRIFT.synonym, 'wordnet:synonym');
      /* the verb's NOMINALISATION (derivational morphology, a noun of the lexicon): invent → invention, form → formation, discover → discovery */
      if (predPos === 'v') { const st = predicate.replace(/e$/, ''); for (const n of [st + 'ion', st + 'tion', st + 'ation', predicate + 'ment', st + 'y', st + 'al', st + 'ure']) if (n !== predicate && firstSynset(lex, n, 'n')) add('predicate', n, DRIFT.derivation, 'derivation'); } }
    const Q = { schema: 'FORGE-QUERY-COMPILED/v1', band: BAND, roles, expansions: exps, qwords: words(q), text: q.replace(/[?!.]+\s*$/, '').trim() }; Object.defineProperty(Q, 'lex', { value: lex, enumerable: false }); return Q; }
  const used = (Q, role) => Q.expansions.filter(e => e.role === role && e.used);
  /* the forms worth trying as direct titles (surface, morphology, numeral words; never a hypernym) */
  const titleForms = Q => used(Q, 'subject').filter(e => /^(surface|morphology|numeral)$/.test(e.via)).map(e => e.form);
  /* SUBJECT DRIFT of a source: the lowest-drift subject expansion naming its title, an alternate name (redirect / alias) or its lead subject */
  function subjectDrift(Q, src) { if (!Q.roles.subject) return { drift: 0, via: 'none', form: null };
    let best = null; for (const e of used(Q, 'subject')) { const m = PV.subjectMatch(e.form, src); if (!m.ok || m.basis === 'none') continue; let d = e.drift + (m.basis === 'alias' ? DRIFT.redirect : m.basis === 'description' ? DRIFT.description : 0);
      /* SENSE drift of the title itself: a title that adds content words to the subject names a narrower thing (a kind of it, or a compound
         name: "personal cloud", "cirrus cloud"); a title with a disambiguating qualifier the question does not name is one of several senses */
      /* the title's HEAD phrase (before of / to / in / for / from) names the referent; its complement only locates it. Content words the subject
         lacks in the head make a narrower thing (+0.2 one word, +0.3 more) — unless the head word is the asked predicate's nominalisation
         ("Invention of the telephone", "Formation of clouds": the article is about the asked relation itself, +0.05); in the complement they
         qualify the same referent (+0.1: "Fifteenth Amendment to the United States Constitution") */
      if (m.basis === 'title') { const tw = PV.primaryEntity({ title: src.title }).split(' ').filter(Boolean), fw = words(e.form); const cut = tw.findIndex((w, i) => i > 0 && /^(of|to|in|for|from|on)$/.test(w)); const head = cut > 0 ? tw.slice(0, cut) : tw, comp = cut > 0 ? tw.slice(cut + 1) : [];
        const extra = ws => ws.filter(w => !fw.some(x => PV.covers(w, { entities: [x] })) && !FW.has(w)); const xh = extra(head), xc = extra(comp); const subjInComp = fw.every(x => comp.some(w => PV.covers(w, { entities: [x] })));
        const nomin = w => used(Q, 'predicate').some(pe => pe.form.length >= 4 && w !== pe.form && w.startsWith(pe.form.replace(/e$/, '').slice(0, Math.max(4, pe.form.length - 2))) && /(tion|sion|ment|ance|ence|al|ure|ing)$/.test(w));
        if (xh.length && subjInComp && xh.every(nomin)) d += DRIFT.derivation; else if (xh.length) d += xh.length > 1 ? DRIFT.narrower + 0.1 : DRIFT.narrower; else if (xc.length) d += DRIFT.qualifier; }
      { const qual = /\(([^)]*)\)\s*$/.exec(String(src.title || '')); if (qual && !words(qual[1]).some(w => Q.qwords.includes(w))) d += DRIFT.sense; }
      if (!best || d < best.drift) best = { drift: Math.round(d * 100) / 100, via: e.via + (m.basis === 'alias' ? '+redirect' : m.basis === 'description' ? '+description' : ''), form: e.form, basis: m.basis, resolved: m.resolved_entity || null }; }
    if (best) return best; return titleWords(Q, src); }
  /* a title that names the subject among other words: its HEAD phrase (before of / to / in / for / from / on) names the referent. The asked
     predicate's nominalisation as the head with the subject in the complement is the asked relation itself ("Invention of the telephone",
     +0.05); other head words make a narrower or different thing (+0.2 one word, +0.3 more: "Diffuse sky radiation"); a subject named only in
     the complement of another head is a related thing (+0.3); not named: 1 */
  /* 4.9.95: a PERTAINYM names its noun (WordNet adj.pert: "volcanic" relating to volcanoes, "solar" relating to the sun): a title word that is the
     subject's pertainym covers the subject word ("Volcanic eruption" names the volcano's eruption) */
  const pertains = (Q, w, x) => { const lx = Q.lex; if (!lx || !lx.senses || w === x) return false; return (lx.senses(w) || []).some(z => z.pos === 'a' && z.lexname === 'adj.pert' && words(z.gloss).some(g => g === x || PV.covers(g, { entities: [x] }))); };
  function titleWords(Q, src) { const tw = words(PV.primaryEntity({ title: src && src.title }) || (src && src.title)), all = words(src && src.title); let best = { drift: 1, via: 'unmatched', form: null };
    for (const e of used(Q, 'subject')) { const fw = words(e.form); const cov = (t, x) => PV.covers(t, { entities: [x] }) || pertains(Q, t, x); if (!fw.length || !fw.every(w => all.some(x => cov(x, w)))) continue;
      const cut = all.findIndex((w, i) => i > 0 && /^(of|to|in|for|from|on)$/.test(w)); const head = cut > 0 ? all.slice(0, cut) : all, comp = cut > 0 ? all.slice(cut + 1) : [];
      const xs = ws => ws.filter(w => !fw.some(x => cov(w, x)) && !FW.has(w)); const xh = xs(head); const inHead = fw.every(x => head.some(w => cov(w, x)));
      const nominal = used(Q, 'predicate').filter(p => p.via === 'derivation').map(p => p.form); let d;
      if (xh.length && xh.every(w => nominal.includes(w))) d = DRIFT.derivation; /* "Invention of the telephone", "Cloud formation" */ else if (inHead && PV.covers(head[head.length - 1], { entities: [fw[fw.length - 1]] })) d = xh.length > 1 ? DRIFT.narrower + 0.1 : DRIFT.narrower; /* a kind of the subject ("Cirrus cloud") */ else d = 0.4; /* the subject only modifies another head ("First Amendment audit", "Diffuse sky radiation"): another thing — its sentences may still carry the claim */
      d = Math.round((e.drift + d) * 100) / 100; if (d < best.drift) best = { drift: d, via: e.via + (d === e.drift + DRIFT.derivation ? '+topic' : '+title-words'), form: e.form, basis: 'title-words' }; void tw; }
    return best; }
  /* RELATION DRIFT of a sentence: does it fill the asked relation (and name the subject / the predicate)? */
  const CUE = { cause: /\b(because|due to|caus(?:e|es|ed|ing)|result(?:s|ing)? (?:of|from|in)|as a result|owing to|reason|so that|leads? to|responsible for|since)\b/i,
    /* a manner / means: the means cue after the predicate, or a process verb of formation */
    method: /\b(form(?:s|ed)? (?:when|by|from|through|as)|(?:is|are|was|were) (?:formed|produced|created|made|generated) (?:by|from|when|through|as|in)|process|mechanism|consists? of|made (?:of|from|by)|works? by|occurs? when|develops? (?:when|from))\b/i,
    agent: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z.]+)+\b/, time: /\b(1[0-9]{3}|20[0-9]{2}|[0-9]{1,4} (?:BC|BCE|AD|CE))\b/, place: /\b(in|at|near|located|between)\s+(?:the\s+)?[A-Z][a-z]+/,
    quantity: /\d/, function: /\b(functions?|role|serves?|acts? as|works? as|responsible for|used (?:for|to)|helps?|purpose)\b/i };
  /* RELATION DRIFT of a sentence (RSOC: the distance between the compiled question and the claim the sentence makes), summed over the
     question's kāraka roles, each 0 when the sentence fills it as asked:
       SUBJECT — the subject (or an expansion / the source's own name) leads a clause of the sentence: 0; the article's lead pronoun stands for
         it: 0.05; it is named inside another phrase: 0.15; not named: 0.3
       PREDICATE — the asked predicate (or a form / synonym of it) is stated: its expansion drift; not stated: 0.3 (a description or a function
         question has no predicate role)
       ASKED RELATION — the gap is filled: a definition for "what is X"; X doing something (an active verb with X leading) for "what does X do";
         the relation's marker (because / due to / causes …, by / when / through …, a name, a date, a place, a number) for the others; a definition
         instead of the asked relation: 0.2; nothing: 0.3. A yes/no question asks for the predicate only. */
  function relationDrift(Q, sent, names, parts, body) { const s0 = String(sent || ''), ws0 = words(s0);
    /* a MENTION is not the referent: "a device … called telephone", "known as X", "the term X" name the word, not the thing; the subject is looked for outside them */
    let s = s0.replace(/,\s+(?:also\s+|commonly\s+|often\s+|sometimes\s+)?(?:known|called|named|termed|referred to)\s+(?:as\s+)?[^,]{1,60},/gi, '').replace(/\b(?:called|named|termed|dubbed|known as|the (?:term|word|name))\s+(?:the\s+|a\s+)?[\w-]+/gi, ' '); /* 4.9.93: a naming aside goes whole first (another name, not the claim) */ let ws;
    const forms = used(Q, 'subject').filter(e => e.drift <= DRIFT.synonym).map(e => e.form).concat(names || []).filter(Boolean); const defn = forms.some(f => PV.definitional(s, f));
    /* 4.9.86: ANOTHER NAME is not the subject: a capitalised run holding a subject word next to a word of no subject form ("Blue Sky Studios", "Blue Sky") names something else; its words do not count */
    const sw = new Set([].concat(...forms.map(f => words(f)))); s = s.replace(/\b[A-Z][\w'’-]*(?:\s+[A-Z][\w'’-]*)+/g, run => { const rw = words(run).filter(w => !/^(the|of|a|an)$/.test(w)); return rw.some(w => sw.has(w) || [...sw].some(x => PV.covers(w, { entities: [x] }))) && rw.some(w => !sw.has(w) && ![...sw].some(x => PV.covers(w, { entities: [x] }))) ? ' ' : run; }); ws = words(s); const ws0m = words(s);
    /* the subject LEADS a clause when the clause opens with it and it is the whole phrase: the next word is not another noun of a compound
       ("A First Amendment audit is …" leads with "first amendment audit", not with "first amendment") */
    const VERBISH = /^(is|are|was|were|be|been|has|have|had|can|could|will|would|may|might|must|should|shall|does|do|did|not|also|which|that|who|and|or|of|in|on|at|to|by|for|from|with|as|consists?|\w+ed|\w+s)$/;
    const LEADSKIP = /^(the|a|an|on|in|at|for|most|all|many|some|also|thus|hence|however|therefore|for|example|of|this|that)$/; const leads = cl => { const cw = words(cl).filter(w => !LEADSKIP.test(w)); return forms.some(f => { const fw = words(f).filter(w => !LEADSKIP.test(w)); /* the form is read with the same words skipped ("treaty of versailles") */ return fw.length && fw.every((w, i) => cw[i] && PV.covers(cw[i], { entities: [w] })) && (cw.length === fw.length || VERBISH.test(cw[fw.length])); }); };
    const clauses = s.split(/[,;:()]|\s(?:and|but|while|whereas|because|since|so)\s/); const led = clauses.some(leads);
    const named = forms.some(f => words(f).every(w => ws.some(x => PV.covers(x, { entities: [w] }))));
    const pe = used(Q, 'predicate');
    /* the subject as the KARMA of the asked predicate: right after the verb or its nominalisation ("invented the telephone", "the invention of the telephone") */
    const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const karma = pe.length && forms.some(f => pe.some(p => new RegExp('\\b' + esc(p.form) + '\\s+(?:of\\s+)?(?:the\\s+|a\\s+|an\\s+)?' + esc(f) + '\\b', 'i').test(s) || new RegExp('\\b' + esc(p.form) + '\\s+\\w+\\s+of\\s+(?:the\\s+)?(?:\\w+\\s+)?' + esc(f) + '\\b', 'i').test(s)))
      || (Q.roles.asked === 'cause' && forms.some(f => new RegExp('\\b(?:caus(?:es|ed|ing)|cause|makes?|made|making|gives?|gave)\\s+(?:the\\s+|a\\s+)?' + esc(f) + '\\b', 'i').test(s))); /* 4.9.86: "the blue color of the sky"; for a why-question the subject as the karma of the causal verb ("causes the sky to appear blue") */
    /* 4.9.95: the subject's PERTAINYM modifying the predicate's nominalisation is the subject as that event's argument ("a volcanic eruption" =
       a volcano erupting) */
    const pertK = !karma && pe.length && (() => { const w = words(s); for (let i = 0; i + 1 < w.length; i++) if (pe.some(p => p.form === w[i + 1]) && forms.some(f => words(f).length === 1 && pertains(Q, w[i], words(f)[0]))) return true; return false; })();
    const subjR = !Q.roles.subject ? 0 : led || karma || pertK ? 0 : !body && /^(It|They|This)\b/.test(s) ? 0.05 : /* 4.9.95: past the lead a pronoun stands for its local antecedent, not the article's subject */ named ? 0.15 : 0.3;
    const predHit = pe.filter(e => ws0m.some(w => w === e.form || PV.covers(w, { entities: [e.form] }))).map(e => e.drift);
    const predR = !Q.roles.predicate || /^(description|function)$/.test(Q.roles.asked) ? 0 : predHit.length ? Math.min(...predHit) : 0.3;
    const a = Q.roles.asked; let askR;
    if (a === 'verdict') askR = 0; else if (a === 'description') askR = defn && led ? 0 : 0.3;
    else if (a === 'function') { const act = forms.some(f => new RegExp('(?:^|[,;:]\\s*|\\b(?:the|a|an)\\s+)' + f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+(?:\\w+ly\\s+)?(?!is\\b|was\\b|are\\b|were\\b|has\\b|had\\b)(\\w+s)\\b', 'i').test(s)); askR = act || CUE.function.test(s) ? 0 : defn ? 0.2 : 0.3; }
    else { const means = a === 'method' && pe.some(e => new RegExp('\\b' + e.form + '\\s+(?:by|through|using|via|when|because|as)\\b', 'i').test(s)); askR = means || (CUE[a] && CUE[a].test(s)) ? 0 : defn ? 0.2 : 0.3; }
    if (predR >= 0.3 && askR < 0.3) askR = 0.3; /* 4.9.86: a relation marker of another predicate ("low oxygen due to …" for "why is the ocean salty") fills nothing */
    const rd = Math.round(Math.min(1, subjR + predR + askR) * 100) / 100; return parts ? { rd, ask: predR + askR } : rd; }
  /* CLAIM DRIFT: a sentence of any fetched source that itself carries the subject, the predicate and the asked relation answers the question
     whatever the article's title (the claim is measured, not the title): DRIFT.claim + its relation drift, unhalved */
  const claimTotal = rd => Math.round(Math.min(1, DRIFT.claim + rd) * 100) / 100;
  const total = (sd, r) => { const rd = typeof r === 'object' ? r.rd : r, ask = typeof r === 'object' ? r.ask : 0; return Math.round(Math.min(1, sd + 0.5 * (rd - ask) + ask) * 100) / 100; }; /* 4.9.86: only the subject role is halved (the title can supply it); a missing predicate or unfilled asked relation counts in full */
  /* the lowest-drift sentence of a source text (its lead first on ties) */
  function bestSentence(Q, text, sd, names, claim) { const s = String(text || ''); let best = null; let n = 0; const leadEnd = (i => i < 0 ? s.length : i)(s.search(/\n/));
    for (const [a, b] of PV._sentences(s)) { const t = s.slice(a, b).trim(); if (t.length < 25 || t.length > 420 || /^=|\?$/.test(t) || !/[.!]["”’')]?$/.test(t)) continue; if (++n > 400) break; /* 4.9.95: the whole body, not only the lead (a process is often described past the lead) */
      const rp = relationDrift(Q, t, names, true, a >= leadEnd), rd = rp.rd, d = claim ? claimTotal(rd) : total(sd, rp); if (!best || d < best.drift) best = { sentence: t, drift: d, relation_drift: rd, body: a >= leadEnd }; if (d === sd) break; }
    return best; }
  /* the LOOKUP built from the roles (not keywords): the subject forms of drift ≤ 0.05 that differ from the typed subject (a numeral word, the
     other number), then the subject with the predicate root when the relation needs a predicate (why / how / cause) */
  function queries(Q) { if (!Q.roles.subject) return []; const out = []; const sf = used(Q, 'subject').filter(e => e.drift <= DRIFT.numeral);
    for (const e of sf.filter(e => e.via === 'numeral')) out.push(e.form);
    if (Q.roles.predicate && /^(cause|method|agent|time|place)$/.test(Q.roles.asked)) { out.push(Q.roles.subject + ' ' + Q.roles.predicate); if (Q.text) out.push(Q.text); } /* the question as asked finds the article that explains the relation ("Diffuse sky radiation") */
    return out.slice(0, 3); }
  /* 4.9.97: a naming aside is another name, not the claim — commas or dashes, aka, a short "or" alias, or a reduced naming relative before the finite verb */
  const titleCaseName = name => String(name || '').trim().split(/\s+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const pluralHead = name => { const p = String(name || '').trim().split(/\s+/).filter(Boolean); if (!p.length) return ''; const h = p.pop(); const pl = /[^aeiou]y$/i.test(h) ? h.slice(0, -1) + 'ies' : /(s|x|z|ch|sh)$/i.test(h) ? h + 'es' : /s$/i.test(h) ? h : h + 's'; return p.concat([pl]).join(' '); };
  function stripNaming(s) { let t = String(s || ''); const namePred = '(?:(?:also|commonly|often|sometimes|formerly)\\s+)?(?:known|called|named|termed|nicknamed|dubbed|referred\\s+to)(?:\\s+as)?';
    t = t.replace(new RegExp('\\s+[–—-]\\s+' + namePred + '\\s+[^–—-]{1,80}\\s+[–—-]\\s+', 'gi'), ' ');
    t = t.replace(/\s+[–—-]\s+(?:a\.?\s*k\.?\s*a\.?|aka)\s+[^–—-]{1,60}\s+[–—-]\s+/gi, ' ');
    t = t.replace(new RegExp(',\\s+' + namePred + '\\s+[^,]{1,80},', 'gi'), '');
    t = t.replace(/,\s+(?:a\.?\s*k\.?\s*a\.?|aka)\s+[^,]{1,60},/gi, '');
    t = t.replace(/,\s+or\s+((?:(?:a|an|the)\s+)?(?:[\w'’-]+\s+){0,3}[\w'’-]+),/gi, (m, np) => /\b(?:is|are|was|were|has|have|had|can|could|will|would|may|might|must|does|do|did)\b/i.test(np) ? m : '');
    t = t.replace(/\b((?:the|a|an)\s+[\w'’-]+(?:\s+[\w'’-]+){0,2})\s+(?:called|named|termed|nicknamed|dubbed|known\s+as)\s+(?:(?:the|a|an)\s+)?[\w'’-]+(?:\s+[\w'’.-]+){0,4}\s+(?=(?:is|are|was|were|has|have|had|can|could|will|would|may|might|must|shall|should|does|do|did|[a-z]{3,}s)\b)/gi, '$1 ');
    return t.replace(/\s+/g, ' ').replace(/\s+,/g, ',').replace(/,\s*,/g, ',').trim(); }
  /* a lowercase finite lexical verb (not a noun after a preposition or article) means the left side of a comma is already the clause */
  function hasFiniteLexical(s) { const ws = String(s || '').split(/\s+/), PRE = /^(the|a|an|for|of|in|on|to|from|with|by)$/i;
    for (let i = 0; i < ws.length; i++) { const w = ws[i].replace(/[^A-Za-z'-]/g, ''); if (!/^[a-z]{3,}(?:s|ed)$/.test(w)) continue; const prev = i ? ws[i - 1].replace(/[^A-Za-z]/g, '') : ''; if (PRE.test(prev)) continue; return true; } return false; }
  /* 4.9.97 pronoun locality (the 4.9.95 scoring law, now in generation): on the lead, It/They/He/She stand for the article; past the lead, only a compatible local antecedent */
  function bindPronoun(s, leadName, opt) { opt = opt || {}; const inLead = opt.inLead !== false;
    const m = /^((?:(?:In|On|At|During|After|Before|For|With|By|From)\b[^,]{0,48},\s+)?)(It|They|He|She|it|they|he|she)\b([\s\S]*)$/.exec(s); if (!m) return s;
    const pro = m[2].toLowerCase(); let repl = null;
    if (inLead && leadName) { const tc = titleCaseName(leadName); repl = pro === 'it' ? 'The ' + tc : pro === 'they' ? 'The ' + titleCaseName(pluralHead(leadName)) : tc; }
    else if (!inLead && opt.localAnte) { const ante = String(opt.localAnte).trim(), bits = ante.split(/\s+/).filter(Boolean), head = bits[bits.length - 1] || '';
      const plural = /\b(?:and|or)\b/i.test(ante) || (/s$/i.test(head) && !/^(is|was|has|this)$/i.test(head)); const person = bits.length >= 2 && bits.every(w => /^[A-Z]/.test(w));
      if ((pro === 'it' && !plural && !person) || (pro === 'they' && plural) || ((pro === 'he' || pro === 'she') && person)) repl = ante.charAt(0).toUpperCase() + ante.slice(1); }
    return repl ? m[1] + repl + m[3] : s; }
  /* CORES of a proved source sentence, fullest first, for the generated answer (roots → roles → rules → surface): the sentence without
     parentheticals / reference marks; without a leading adjunct ("Except for X, …", "On Earth, …"); cut at a non-restrictive boundary
     (", which", ", and", "; " …). Each core is a sub-span of the proved sentence, so it adds no fact; the parser decides which one parses.
     opt.inLead / opt.localAnte (4.9.97): pronoun binding. leadName stays the article subject. */
  function cores(sentence, leadName, opt) { opt = opt || {}; let s0 = String(sentence || '').replace(/(^|[\s(])['‘“"]+|['’”"]+(?=[\s,.;:)]|$)/g, '$1').replace(/\s*\[[^\]]*\]/g, '').replace(/\s*\([^()]*\)/g, '').replace(/\s+([,.;:])/g, '$1').replace(/\s+/g, ' ').trim(); s0 = s0.split(/(?<=[a-z0-9)][.!?])\s*(?=[A-Z])/)[0].replace(/[.!]+$/, ''); /* one sentence: captions glued to the excerpt are not the claim */
    s0 = s0.replace(/,\s+(?:among(?:st)? others|for example|for instance|in particular|in turn|for the most part)\s*,/gi, ''); /* a non-restrictive aside */
    s0 = stripNaming(s0); /* 4.9.97: naming asides (comma, dash, aka, or-alias, reduced relative) are another name, not the claim */
    s0 = s0.replace(/\b([\w'’-]+(?: [\w'’-]+){0,3}), ((?:[\w'’-]+ ){0,3}[\w'’-]+), ((?:and|or) )/g, '$1\u0001 $2\u0001 $3');
    for (let k = 0; k < 8; k++) { const s1 = s0.replace(/([\w'’-]+), (?=(?:[\w'’-]+ ){0,3}[\w'’-]+\u0001)/g, '$1\u0001 '); if (s1 === s0) break; s0 = s1; } /* 4.9.91: every comma of a list ends in the marked serial comma ("private, public, academic, business, and government") */
    const out = []; const add = t => { t = bindPronoun(String(t || '').replace(/\u0001/g, ',').trim().replace(/[,;:]+$/, ''), leadName, opt); if (t.split(' ').length >= 3) { t = t.charAt(0).toUpperCase() + t.slice(1) + '.'; if (!out.includes(t)) out.push(t); } };
    const LEADW = /^(?:for|in|on|at|during|after|before|with|without|from|by|as|under|over|near|since|unlike|like|except|despite|according|apart|following|when|while|although|though|if|because|however|thus|therefore|also|moreover|typically|generally|usually|today|currently|historically)\b/i; const noLead = x => { let y = x, n = 0; for (let m; n < 3 && (m = /^([^,]{1,70}),\s+(.+)$/.exec(y)) && m[2].split(' ').length >= 3 && (n === 0 ? !(/^(?:[A-Z][\w'’.-]*\s?)+$/.test(m[1]) && /^[A-Z]/.test(m[2])) && !/\b(?:is|are|was|were|has|have|had|can|could|will|would|may|might|must)\b/i.test(m[1]) && !hasFiniteLexical(m[1]) : LEADW.test(m[1])) /* a lead adjunct has no finite auxiliary and no finite lexical verb: "Granite contains quartz," is the clause itself */; n++) y = m[2]; return n ? y : null; }; /* every lead adjunct is left out ("For the example …, in broad daylight, the sky is …"): the first comma phrase, then further ones that open with an adjunct word */
    const cut = x => { const m = /^(.+?)(?:,\s+(?:which|who|whom|where|while|although|though|and|but|or|as|so|with|making|including|leading|resulting)\b|;\s|\s[–—]\s|:\s|\s(?:when|whereas|unless)\s)/i.exec(x); return m ? m[1] : null; };
    const listTail = /, [a-z][\w'’-]*(?: [a-z][\w'’-]*){0,4}(?:,| and | or )/i; /* 4.9.97: a list tail is one nominal, not a place to cut the claim */
    for (const x of [s0, noLead(s0)]) { if (!x) continue; add(x); let y = x; for (let i = 0; i < 3; i++) { const c = cut(y); if (!c || c === y) break; add(c); y = c; } const k = y.indexOf(', '); if (k > 0 && /^, [a-z]/.test(y.slice(k)) && !listTail.test(y.slice(k))) add(y.slice(0, k)); /* never inside a list of names */ /* last resort: the first clause up to its first comma */ }
    return out; }
  /* NO ADDED FACTS: every content word of the generated sentence is a word (or a form of a word) of the proved source sentence */
  /* NOTHING DROPPED: every content word of the proved core is said (the passive's 'by' and auxiliaries aside) */
  function dropsNothing(generated, core) { const gw = words(generated); return words(core).filter(w => !FW.has(w)).every(w => gw.some(x => x === w || PV.covers(x, { entities: [w] }) || PV.covers(w, { entities: [x] }))); }
  function addsNothing(generated, source, extra) { const sw = words(source).concat(words(extra || '')); return words(generated).filter(w => !FW.has(w)).every(w => sw.some(x => x === w || PV.covers(x, { entities: [w] }) || PV.covers(w, { entities: [x] }))); }
  /* ---------------- GENERATED ANSWER (Nic 2026-10-21 4:58 PM: experts say it in their own words; the verbatim span is the hidden proof) ----------------
     roots → roles → rules → surface: (1) the proved sentence (a core of it) is read into its kāraka roles by the kernel's own tagger (kartā,
     the verb root with tense / voice / polarity, karma or the copular predicate, the agent of a passive, the adjunct phrases); (2) the answer
     rules re-voice it (a passive with its agent is said actively: "X is caused by Y" → "Y causes X"; a lead adjunct and non-restrictive
     clauses are left out); (3) the grammar's clause realizer gives the surface; (4) ECHO: the generated sentence is read back into roles and
     must state the same claim (same agent, patient, root, predicate, adjuncts) and add no word that is not in the proof. */
  const isTag = (t, g) => (t.an || []).some(a => a.tag === g); const vf = (t, f) => (t.an || []).some(a => a.tag === 'V' && (!f || f.test(a.f || '')));
  let PREF = null; /* 4.9.87 (specific over general): of a word's verb readings, the one whose root is the question's own predicate (fell → fall for "when did X fall") */
  const vlemma = t => { const vs = (t.an || []).filter(x => x.tag === 'V'), a = (PREF && vs.find(x => x.lemma === PREF)) || vs[0]; return a ? a.lemma : t.w; };
  const BE = /^(is|are|was|were|be|been|being)$/; const AUXW = /^(has|have|had|do|does|did)$/; const MODW = /^(can|could|may|might|must|shall|should|will|would)$/;
  /* a sentence-initial common word loses its capital when the phrase moves (a proper name keeps it) */
  const lowerLead = t => t.replace(/^([A-Z])([a-z])/, (m, a, b) => a.toLowerCase() + b);
  /* number of a phrase: its head (the last noun before its first preposition) is a plural noun */
  const plOf = ts => { const k = ts.findIndex((t, i) => i > 0 && isTag(t, 'PREP')); const head = (k > 0 ? ts.slice(0, k) : ts).filter(t => isTag(t, 'N') || isTag(t, 'PROPN') || isTag(t, 'UNK')).pop(); return !!head && (head.an || []).some(a => a.tag === 'N' && a.f === 'pl') && !(head.an || []).some(a => a.tag === 'N' && a.f === 'sg'); };
  function rolesOf(T) { const toks = (T || []).filter(t => !/^[.!?]$/.test(t.w)); let v = -1;
    const isAdvT = t => !!t && (isTag(t, 'ADV') || /ly$/.test(t.w)); /* 4.9.96: ADV (closed or open /-ly/) is prakāra, never subject / object material */
    const finiteClause = t => !!t && (BE.test(t.w) || AUXW.test(t.w) || MODW.test(t.w) || (isTag(t, 'V') && !isTag(t, 'N') && (vf(t, /^pres3$/) || (vf(t, /^past$/) && !vf(t, /^pp$/)) || vf(t, /^base$/))));
    /* 4.9.97: a comma is inside one nominal while a later and/or closes on a nominal and not on a finite clause; intermediate commas continue the scan */
    const inList = i => { for (let j = i + 1; j < Math.min(toks.length, i + 40); j++) { if (/^(and|or)$/.test(toks[j].w)) { let sawNom = false; for (let k = j + 1; k < Math.min(toks.length, j + 8); k++) { const u = toks[k]; if (!u || u.w === ',' || u.w === ';' || u.w === ':') break; if (isTag(u, 'PREP')) return sawNom; if (finiteClause(u) && !vf(u, /^pp$/)) return false; if (isTag(u, 'N') || isTag(u, 'PROPN') || isTag(u, 'UNK')) sawNom = true; } return sawNom; } if (toks[j].w === ',') continue; if (finiteClause(toks[j]) && !vf(toks[j], /^pp$/)) return false; } return false; }; const cap = t => !!t && /^[A-Z]/.test(t.orig || t.w); const modW = t => !!t && (isTag(t, 'ADJ') || vf(t, /^(pp|past)$/)); const adjComma = i => modW(toks[i - 1]) && modW(toks[i + 1]) && !!toks[i + 2] && (isTag(toks[i + 2], 'N') || isTag(toks[i + 2], 'ADJ')); /* 4.9.91: a comma between coordinate modifiers ("roasted, ground coffee beans") is inside the noun phrase */
    if (toks.some((t, i) => /^[;:]$/.test(t.w) || (t.w === ',' && !adjComma(i) && !(cap(toks[i - 1]) && (cap(toks[i + 1]) || (toks[i + 1] && /^(and|or)$/.test(toks[i + 1].w) && cap(toks[i + 2])))) && !inList(i) && !(toks[i + 1] && /^(and|or)$/.test(toks[i + 1].w) && toks[i + 2] && toks[i + 2].w === 'the' && (toks[i + 3] && (toks[i + 3].an || []).some(a => a.tag === 'ADJ' && a.f === 'sup')))))) return null; /* 4.9.92: the comma before an elided-head conjunct (", and the largest …") */ /* one clause only: the comma-free cores carry the claim (a comma inside a list of names is part of the phrase) */
    const laterFinite = i => { for (let j = i + 1; j < Math.min(toks.length, i + 14); j++) { const u = toks[j]; if (!u || u.w === ',' || u.w === ';') return false; if (BE.test(u.w) || AUXW.test(u.w) || MODW.test(u.w) || vf(u, /^pres3$/)) return true; } return false; };
    for (let i = 1; i < toks.length; i++) { const t = toks[i], p = toks[i - 1]; if (isTag(p, 'DET') || isTag(p, 'PREP')) continue; if (isAdvT(t)) continue; /* skip preverbal prakāra when locating the finite verb */ if (vf(t, /^(pp|past)$/) && !BE.test(t.w) && !AUXW.test(t.w) && !MODW.test(t.w) && laterFinite(i)) continue; /* 4.9.97: a reduced participle is not the clause verb when a finite verb still follows ("called the telephone sends") */ if (isTag(t, 'COP') || isTag(t, 'AUX') || isTag(t, 'MOD') || BE.test(t.w) || AUXW.test(t.w) || MODW.test(t.w) || vf(t, /^(pres3|past)$/) || (isAdvT(p) && vf(t, /^(base|pres3|past)$/))) { v = i; break; } } /* 4.9.96: a base verb after an ADV is the finite verb ("winds frequently damage …") */
    if (v < 1) return null; let i = v; const grp = []; while (i < toks.length && (isTag(toks[i], 'COP') || isTag(toks[i], 'AUX') || isTag(toks[i], 'MOD') || BE.test(toks[i].w) || AUXW.test(toks[i].w) || MODW.test(toks[i].w) || toks[i].w === 'not' || /ly$/.test(toks[i].w) || isTag(toks[i], 'ADV') || (grp.length && /^(all|both|each)$/.test(toks[i].w)))) grp.push(toks[i++]);
    let main = null, voice = 'active'; const hasBe = grp.some(t => BE.test(t.w));
    if (i < toks.length && vf(toks[i], /^(pp|past)$/) && grp.length && hasBe) { main = toks[i++]; voice = 'passive'; } else if (i < toks.length && vf(toks[i], grp.some(t => /^(has|have|had)$/.test(t.w)) ? /^(pp|past)$/ : /^(base|ing|pp)$/) && grp.length && !hasBe) main = toks[i++]; else if (!grp.length) main = toks[i++];
    if (!main && grp.length && !grp.some(t => BE.test(t.w))) return null;
    const first = grp[0] || main; const tense = /^(was|were|did|had)$/.test(first.w) || (!grp.length && vf(main, /^past$/)) ? 'past' : 'present'; const pol = grp.some(t => t.w === 'not') ? 'neg' : 'pos'; const perf = grp.some(t => /^(has|have|had)$/.test(t.w)) && (!!main && vf(main, /^(pp|past)$/) || grp.some(t => t.w === 'been')); const mod = (grp.find(t => MODW.test(t.w)) || {}).w || null;
    const lemma = main ? vlemma(main) : 'be'; const advs = []; for (const t of toks.slice(0, v)) if (isAdvT(t)) advs.push({ w: t.w, pre: true }); for (const t of grp) if (isAdvT(t)) advs.push({ w: t.w, pre: true }); /* preverbal + mid-group (is often blue) prakāra */
    const subjT = toks.slice(0, v).filter(t => !isAdvT(t)); const subj = subjT.map(t => t.orig || t.w);
    const rest = toks.slice(i); let agent = null, obj = [], pps = [], cur = null; const TOP = new Set(['by', 'in', 'on', 'at', 'from', 'to', 'with', 'for', 'during', 'after', 'before', 'through', 'into', 'as', 'because', 'due', 'since', 'when', 'within', 'across', 'over', 'under']);
    let agentT = [], whole = false; for (const t of rest) { const w = t.w; if (whole) { cur.np.push(t.orig || t.w); cur.T.push(t); continue; } /* a subordinate clause (since / because / when / while ...) is one adjunct, kept whole */ if (/^(since|because|when|while|although|though|whereas|if|unless)$/.test(w) && cur !== undefined) { cur = { prep: w, np: [], T: [] }; pps.push(cur); whole = true; continue; } if (cur && !cur.np.length && /^(due|according|prior|owing|thanks)$/.test(cur.prep) && w === 'to') { cur.prep += ' to'; continue; } /* a two-word preposition ("due to") */ if (TOP.has(w) && (isTag(t, 'PREP') || /^(because|due|since|when|as)$/.test(w))) { cur = { prep: w, np: [], T: [] }; pps.push(cur); continue; } if (cur) { cur.np.push(t.orig || t.w); cur.T.push(t); } else if (isAdvT(t)) advs.push({ w: t.w, pre: false }); else obj.push(t.orig || t.w); }
    pps = pps.filter(p => p.np.length); if (voice === 'passive') { const b = pps.findIndex(p => p.prep === 'by'); if (b >= 0) { agent = pps[b].np.join(' '); agentT = pps[b].T; pps.splice(b, 1); } }
    /* multiword prepositions keep their words: "as a result of X", "due to X", "because of X" */
    for (const p of pps) if ((p.prep === 'as' || p.prep === 'due' || p.prep === 'because') && p.np.length) { const m = /^(a result of|to|of)\s+(.+)$/i.exec(p.np.join(' ')); if (m) { p.prep = p.prep + ' ' + m[1]; p.np = m[2].split(' '); } }
    if (!subj.length) return null; const agr = toks.slice(v, v + 3).find(t => /^(is|are|was|were|has|have|does|do)$/.test(t.w)); return { subj: subj.join(' '), subjPl: agr ? /^(are|were|have|do)$/.test(agr.w) : plOf(subjT) || subjT.some(t => t.w === 'and'), subjCommon: !!subjT[0] && (isTag(subjT[0], 'N') || !isTag(subjT[0], 'PROPN')) && !/^[A-Z]{2,}/.test(subjT[0].orig || ''), agentPl: plOf(agentT), agentCommon: !!agentT[0] && (isTag(agentT[0], 'N') || !isTag(agentT[0], 'PROPN')) && !/^[A-Z]{2,}/.test(agentT[0].orig || ''), lemma, tense, pol, mod, perf, fq: (grp.find(t => /^(all|both|each)$/.test(t.w)) || {}).w || null, advs, voice, cop: lemma === 'be', obj: obj.join(' ') || null, agent, pps: pps.map(p => ({ prep: p.prep, np: p.np.join(' ') })) }; }
  /* the answer clause (grammar clause structure for G.clauseText) from the roles, with the answer rules applied */
  function answerClause(R) { const detok = x => String(x).replace(/\s+([,;:])/g, '$1').replace(/\s+(['’]s?)(?=\s|$)/g, '$1'); const NP = (t, pl, moved) => Object.assign({ propn: detok(moved ? lowerLead(t) : t) }, pl ? { plural: true } : {}); let c;
    if (R.voice === 'passive' && R.agent) c = { subj: NP(R.agent, R.agentPl), verb: Object.assign({ lemma: R.lemma, tense: R.tense, pol: R.pol, mod: R.mod || 'asserted' }, R.perf ? { aspect: 'perfect' } : {}), roles: { karma: NP(R.subj, R.subjPl, R.subjCommon) }, adj: [], rule: 'GEN-ACTIVE-FROM-AGENT' }; /* said actively: the agent is the kartā */
    else if (R.cop) c = { subj: NP(R.subj, R.subjPl), verb: Object.assign({ lemma: 'be', tense: R.tense, pol: R.pol, mod: R.mod || 'asserted' }, R.perf ? { aspect: 'perfect' } : {}), pred: { type: 'np', np: NP(R.obj || '') }, adj: [], rule: 'GEN-COPULA' };
    else c = { subj: NP(R.subj, R.subjPl), verb: Object.assign({ lemma: R.lemma, tense: R.tense, pol: R.pol, mod: R.mod || 'asserted' }, R.perf ? { aspect: 'perfect' } : {}, R.voice === 'passive' ? { voice: 'passive' } : {}), roles: R.obj ? { karma: NP(R.obj) } : {}, adj: [], rule: R.voice === 'passive' ? 'GEN-PASSIVE' : 'GEN-ACTIVE' };
    if (R.cop && !R.obj) return null; if (R.fq && c.rule !== 'GEN-ACTIVE-FROM-AGENT') c.adj.push({ pre: true, adv: R.fq }); for (const a of R.advs || []) c.adj.push({ adv: a.w, role: 'prakara', pre: a.pre !== false }); /* 4.9.96: prakāra from the proved span survives generate → Echo */ for (const p of R.pps) c.adj.push({ prep: p.prep, np: NP(p.np) }); return c; }
  /* the claim as an active-normalised role tuple (for Echo): who acts, on what, the root, the predicate and the adjuncts */
  const tuple = R => R && JSON.stringify({ lemma: R.lemma, pol: R.pol, cop: R.cop, tense: R.tense, perf: !!R.perf, agent: String((R.voice === 'passive' ? R.agent : R.subj) || '').toLowerCase(), advs: (R.advs || []).map(a => a.w).sort(), rest: words([R.voice === 'passive' ? R.subj : R.obj].concat(R.pps.map(p => p.prep + ' ' + p.np)).join(' ')).sort() }); /* PP attachment may differ between the two readings; the words of the non-agent material may not */
  function generate(Q, sentence, hooks) { PREF = Q && Q.roles && Q.roles.predicate || null; try { return generate0(Q, sentence, hooks); } finally { PREF = null; } }
  function generate0(Q, sentence, hooks) { const out = []; const sents = String(sentence || '').split(/(?<=[a-z0-9)\]][.!?])\s+(?=[A-Z])/).slice(0, 3); /* each proved sentence in turn: the one that fills the asked relation is said */
    let localAnte = null; hooks = hooks || {};
    for (let si = 0; si < sents.length; si++) { const one = sents[si]; const inLead = si === 0 && hooks.inLead !== false; let subj = null; /* 4.9.97: only the lead sentence may take the article name; later sentences take the local antecedent */
      for (const core of cores(one, hooks.leadName, { inLead, localAnte: inLead ? null : localAnte })) { let T; try { T = hooks.derive(core).T; } catch (e) { continue; } const R = rolesOf(T); if (!R) continue; const c = answerClause(R); if (!c) continue;
      let text; try { text = hooks.clauseText(c); } catch (e) { continue; } text = text.replace(/\s+(['’]s)\b/g, '$1').replace(/\s+,/g, ','); text = text.charAt(0).toUpperCase() + text.slice(1).replace(/[.\s]+$/, '') + '.';
      let R2 = null; try { R2 = rolesOf(hooks.derive(text).T); } catch (e) { R2 = null; } const echo = !!R2 && tuple(R2) === tuple(R) && addsNothing(text, sentence, inLead ? hooks.leadName : '') && dropsNothing(text, core); if (!subj && R.subj && !/^(it|they|he|she|this|that|these|those)$/i.test(String(R.subj).trim())) subj = R.subj;
      /* the realizer's own reading of the generated surface is the clause it says (its nouns keep their number and form) */
      let clause = c; if (echo && hooks.reparse) { try { const lc = c.rule === 'GEN-ACTIVE-FROM-AGENT' ? R.agentCommon : R.subjCommon; const g = (lc && hooks.reparse(lowerLead(text))) || hooks.reparse(text); const norm = x => String(x || '').replace(/\s+(['’]s)\b/g, '$1').replace(/\s+,/g, ',').replace(/[.\s]+$/, '').toLowerCase(); if (g && norm(hooks.clauseText(g)) === norm(text)) clause = g; /* a common noun read in place, not as a sentence-initial name */ } catch (e) { /* keep the built clause */ } }
      out.push({ core, roles: R, clause, text, rule: c.rule, echo }); }
      if (subj) localAnte = subj; }
    return out; }
  /* 4.9.87 (Nic 7:36 PM; RMC §8.3 θ, RSOC 0.4–0.8 band, Nic drift ruling): every meaning comparison is governed by the ONE drift table — ≤0.35 project, 0.35–0.40 χ correction once then re-measured, 0.40–0.80 quarantine (traced, never cited), >0.80 hard stop */
  const govern = eps => KM && KM.turnGovernance ? KM.turnGovernance(eps, null).route : eps <= BAND ? 'project' : 'quarantine';
  /* χ for a source in the correction band: the admitted sources are its phase-aligned ancestors (a completed record wraps 9→1, Φ₁); the corrected drift is re-measured against the same table; applied at most once (chiCorrect is non-repeatable) */
  const correct = (eps, admitted) => { const ch = KM.chiCorrect({ eps, ancestors: (admitted || []).filter(a => Number.isFinite(a.drift)).map(a => ({ Phi: 1, eps: a.drift, mu: 1 })) }); return Object.assign(ch, { route: ch.applied ? govern(ch.eps_after) : 'quarantine' }); };
  /* MEA-P slice 1 (4.9.96): rank candidate options against archive evidence already on the consult path.
     Each option's best evidence drift is governed by DRIFT_TABLE; standing is RSOC_STANDING over dims C/K/S/R.
     Hold when every option's route is above the projectable band. Not an answer writer; does not seed shared KB. */
  function rankOptions(options, evidence, Q) {
    const terms = t => new Set(words(t).filter(w => w.length >= 3 && !FW.has(w)));
    const cover = (opt, blob) => { const A = terms(opt), B = terms(blob); if (!A.size) return 0; let n = 0; for (const x of A) if (B.has(x)) n++; return n / A.size; };
    const ranked = (options || []).map(o => {
      let best = { drift: 1, title: null, supported: false, cover: 0 };
      for (const e of evidence || []) {
        const blob = [e.title, e.excerpt, e.intro, e.span].filter(Boolean).join(' ');
        const cov = cover(o.text, blob); let d = Number.isFinite(+e.drift) ? +e.drift : 1;
        if (cov < 0.34) d = Math.min(1, Math.max(d, 0.55)); /* option not named by the evidence → above projectable band */
        else if (e.supported && cov >= 0.5) d = Math.min(d, Math.max(0, d * (1 - 0.1 * cov)));
        if (d < best.drift || (d === best.drift && cov > best.cover)) best = { drift: Math.round(d * 100) / 100, title: e.title || null, supported: !!e.supported, cover: Math.round(cov * 100) / 100 };
      }
      const route = govern(best.drift);
      const dims = { C: 1, K: best.drift <= BAND ? 1 : 0, S: best.supported && best.cover >= 0.34 ? 1 : 0, R: 0 };
      const st = KM && KM.rsocStanding ? KM.rsocStanding(dims) : { selected: dims.K && dims.S ? 'supported_only' : dims.K ? 'undetermined' : 'proof_rejected' };
      return { id: o.id, text: o.text, drift: best.drift, route, evidence: best.title, cover: best.cover, supported: best.supported, standing: st.selected || st, dims };
    }).sort((a, b) => a.drift - b.drift || (b.cover || 0) - (a.cover || 0));
    return { schema: 'FORGE-OPTION-RANK/v1', band: BAND, hold: !ranked.some(o => o.route === 'project'), options: ranked, cite: 'RSOC_STANDING + DRIFT_TABLE (Nic ruling project_max)' };
  }
  /* 4.9.97 ASSIMILATION INTAKE (vision §3.2, intake only): research standing and ε_w, through the one drift table, decide whether a
     research-derived claim is projectable (offer an explicit remember) or contested / held / hard-stopped. No new thresholds. χ is the
     correction function, applied by the caller at most once, then re-measured (chiApplied). Nothing here writes memory or the shared KB. */
  function intakeStanding(ev) { ev = ev || {}; const driftN = Number(ev.drift), s = Math.max(0, Number(ev.superseded) || 0), epsW = Math.round((1 - 1 / (1 + s)) * 100) / 100;
    const gD = KM.turnGovernance(Number.isFinite(driftN) ? driftN : 1, null), gW = KM.turnGovernance(epsW, null);
    let standing = ev.standing || null; if (!standing && ev.dims && KM.rsocStanding) { try { const st = KM.rsocStanding(ev.dims); standing = st && (st.selected || st); } catch (e) { standing = null; } }
    const order = { project: 0, correct: 1, quarantine: 2, hard_stop: 3, blocked_forbidden_transition: 4 }; const rank = r => order[r] == null ? 0 : order[r];
    let route = gD.route; if (rank(gW.route) > rank(route)) route = gW.route;
    if (standing === 'conflicted' || standing === 'refuted_only') { if (rank(route) < order.quarantine) route = 'quarantine'; }
    const dims = ev.dims || {}; const supported = standing === 'supported_only' || (!!ev.supported && !!dims.K && !!dims.S && !dims.R);
    let intake, offer = null, hold = false;
    if (route === 'hard_stop' || route === 'blocked_forbidden_transition') intake = 'hard_stop';
    else if (route === 'correct' && !ev.chiApplied) intake = 'correction';
    else if (route === 'project' && supported && gW.may_write_memory) { intake = 'projectable'; offer = 'remember'; }
    else { intake = 'contested'; hold = true; }
    return { schema: 'FORGE-ASSIMILATION-INTAKE/v1', intake, route, standing, drift: Number.isFinite(driftN) ? Math.round(driftN * 100) / 100 : null, eps_w: epsW, superseded: s, offer, hold, stored: false, shared_kb: false, chi_applied: !!ev.chiApplied, cite: 'RSOC_STANDING + DRIFT_TABLE + ε_w' }; }
  const api = { govern, correct, claimTotal, compile, queries, cores, addsNothing, rolesOf, answerClause, generate, subjectDrift, relationDrift, bestSentence, total, titleForms, BAND, DRIFT, numeralForms, rankOptions, intakeStanding };
  if (isNode) module.exports = api; else root.KQC = api;
})(typeof self !== 'undefined' ? self : this);
