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
  const DRIFT = Object.freeze({ surface: 0, morph: 0.05, numeral: 0.05, redirect: 0.10, alias: 0.10, synonym: 0.15, hypernym: 0.30, hypernym2: 0.45, description: 0.05, narrower: 0.2, sense: 0.3 });
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
  const RELATION = { cause: 'cause', method: 'method', person: 'agent', date: 'time', place: 'place', quantity: 'quantity', description: 'description', verdict: 'verdict' };
  function compile(lp, text, lex, subject) { lp = lp || {}; const q = String(text || lp.question || '');
    const subj = String(subject || lp.subject || lp.entity || lp.object || '').toLowerCase().trim(); const sw = words(subj);
    const asked = RELATION[lp.atype] || (/^\s*why\b/i.test(q) ? 'cause' : /^\s*how\b/i.test(q) ? 'method' : /^\s*who\b/i.test(q) ? 'agent' : /^\s*when\b/i.test(q) ? 'time' : /^\s*where\b/i.test(q) ? 'place' : 'description');
    const sl = sw.map(w => otherNumber(w).concat([w])); const notSubj = w => !sl.some(f => f.includes(w)) && !(lp.juris && w === lp.juris);
    /* the predicate root (dhātu): the asked verb, else the last content lemma of the plan that is not a subject word */
    const predW = (lp.terms || []).map(String).filter(w => !/\s/.test(w) && !FW.has(w) && notSubj(w)); const predicate = lp.asked || predW[predW.length - 1] || null;
    const ps = predicate && lex && lex.senses ? (lex.senses(predicate) || []).map(x => x.pos) : []; const qw = words(q);
    /* the predicate's part of speech from the question itself: a verb when it is inflected there or follows do-support, else an adjective / noun */
    const predPos = !predicate ? null : ps.includes('v') && (lp.asked || qw.some(w => w !== predicate && verbForms(predicate).concat(irregular(lex, predicate)).includes(w)) || /^(do|does|did)$/.test(qw[1] || '')) ? 'v' : ps.includes('a') || ps.includes('s') ? 'a' : ps[0] || null;
    const roles = { subject: subj || null, predicate, predicate_pos: predPos, asked, modifiers: Object.assign({}, lp.juris ? { jurisdiction: lp.juris } : {}) };
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
      const sid = firstSynset(lex, predicate, 'v'); if (sid) for (const l of synIndex(lex).get(sid) || []) if (l !== predicate && !/_/.test(l)) add('predicate', l, DRIFT.synonym, 'wordnet:synonym'); }
    return { schema: 'FORGE-QUERY-COMPILED/v1', band: BAND, roles, expansions: exps, qwords: words(q) }; }
  const used = (Q, role) => Q.expansions.filter(e => e.role === role && e.used);
  /* the forms worth trying as direct titles (surface, morphology, numeral words; never a hypernym) */
  const titleForms = Q => used(Q, 'subject').filter(e => /^(surface|morphology|numeral)$/.test(e.via)).map(e => e.form);
  /* SUBJECT DRIFT of a source: the lowest-drift subject expansion naming its title, an alternate name (redirect / alias) or its lead subject */
  function subjectDrift(Q, src) { if (!Q.roles.subject) return { drift: 0, via: 'none', form: null };
    let best = null; for (const e of used(Q, 'subject')) { const m = PV.subjectMatch(e.form, src); if (!m.ok || m.basis === 'none') continue; let d = e.drift + (m.basis === 'alias' ? DRIFT.redirect : m.basis === 'description' ? DRIFT.description : 0);
      /* SENSE drift of the title itself: a title that adds content words to the subject names a narrower thing (a kind of it, or a compound
         name: "personal cloud", "cirrus cloud"); a title with a disambiguating qualifier the question does not name is one of several senses */
      if (m.basis === 'title') { const tw = PV.primaryEntity({ title: src.title }).split(' ').filter(Boolean), fw = words(e.form); const extra = tw.filter(w => !fw.some(x => PV.covers(w, { entities: [x] })) && !FW.has(w)); if (extra.length) d += DRIFT.narrower; }
      { const qual = /\(([^)]*)\)\s*$/.exec(String(src.title || '')); if (qual && !words(qual[1]).some(w => Q.qwords.includes(w))) d += DRIFT.sense; }
      if (!best || d < best.drift) best = { drift: Math.round(d * 100) / 100, via: e.via + (m.basis === 'alias' ? '+redirect' : m.basis === 'description' ? '+description' : ''), form: e.form, basis: m.basis, resolved: m.resolved_entity || null }; }
    if (best) return best; const tw = words(src && src.title), sw = words(Q.roles.subject); return { drift: sw.length && sw.every(w => tw.some(x => PV.covers(x, { entities: [w] }))) ? 0.6 : 1, via: 'unmatched', form: null }; }
  /* RELATION DRIFT of a sentence: does it fill the asked relation (and name the subject / the predicate)? */
  const CUE = { cause: /\b(because|due to|caus(?:e|es|ed|ing)|result(?:s|ing)? (?:of|from|in)|as a result|owing to|reason|so that|leads? to|responsible for|since)\b/i,
    /* a manner / means: the means cue after the predicate, or a process verb of formation */
    method: /\b(form(?:s|ed)? (?:when|by|from|through|as)|(?:is|are|was|were) (?:formed|produced|created|made|generated) (?:by|from|when|through|as|in)|process|mechanism|consists? of|made (?:of|from|by)|works? by|occurs? when|develops? (?:when|from))\b/i,
    agent: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z.]+)+\b/, time: /\b(1[0-9]{3}|20[0-9]{2}|[0-9]{1,4} (?:BC|BCE|AD|CE))\b/, place: /\b(in|at|near|located|between)\s+(?:the\s+)?[A-Z][a-z]+/,
    quantity: /\d/ };
  function relationDrift(Q, sent, names) { const s = String(sent || ''), ws = words(s); let r;
    const forms = used(Q, 'subject').filter(e => e.drift <= DRIFT.synonym).map(e => e.form).concat(names || []); const defn = forms.some(f => PV.definitional(s, f)); /* a definition is a sentence whose grammatical subject is the question's subject (or an alternate name of the source) */
    const meansAfterPred = Q.roles.asked === 'method' && used(Q, 'predicate').some(e => new RegExp('\\b' + e.form + '\\s+(?:by|through|using|via|when|because)\\b', 'i').test(s)); /* "X works by …" */
    const predIn = used(Q, 'predicate').some(e => ws.includes(e.form));
    if (Q.roles.asked === 'verdict') r = predIn ? 0 : 0.4; /* a yes/no question: the sentence must state the asked predicate of the subject */
    else if (Q.roles.asked === 'description') r = defn ? 0 : 0.4; else r = meansAfterPred || (CUE[Q.roles.asked] && CUE[Q.roles.asked].test(s)) ? 0 : defn ? 0.4 : 0.6;
    const pf = used(Q, 'predicate').map(e => e.form); if (r > 0 && pf.length && ws.some(w => pf.includes(w))) r = Math.max(0, r - 0.2);
    /* the subject's role in the sentence: it LEADS a clause (kartā / karma of the clause, no extra modifiers) → 0; named elsewhere → +0.1; not named → +0.2 */
    const led = s.split(/[,;:()]/).some(cl => { const cw = words(cl).filter(w => !/^(the|a|an|on|in|at|for|most|all|many|some)$/.test(w)); return forms.some(f => { const fw = words(f); return fw.length && fw.every((w, i) => cw[i] && PV.covers(cw[i], { entities: [w] })); }); });
    const named = led || forms.some(f => words(f).every(w => ws.some(x => PV.covers(x, { entities: [w] }))));
    if (!led) r = Math.min(1, r + (named || /^(It|They|He|She)\b/.test(s) ? 0.1 : 0.2));
    return Math.round(r * 100) / 100; }
  const total = (sd, rd) => Math.round(Math.min(1, sd + 0.5 * rd) * 100) / 100;
  /* the lowest-drift sentence of a source text (its lead first on ties) */
  function bestSentence(Q, text, sd, names) { const s = String(text || ''); let best = null; let n = 0;
    for (const [a, b] of PV._sentences(s)) { const t = s.slice(a, b).trim(); if (t.length < 25 || t.length > 420 || /^=|\?$/.test(t) || !/[.!]["”’)]?$/.test(t)) continue; if (++n > 80) break;
      const rd = relationDrift(Q, t, names), d = total(sd, rd); if (!best || d < best.drift) best = { sentence: t, drift: d, relation_drift: rd }; if (d === sd) break; }
    return best; }
  /* the LOOKUP built from the roles (not keywords): the subject forms of drift ≤ 0.05 that differ from the typed subject (a numeral word, the
     other number), then the subject with the predicate root when the relation needs a predicate (why / how / cause) */
  function queries(Q) { if (!Q.roles.subject) return []; const out = []; const sf = used(Q, 'subject').filter(e => e.drift <= DRIFT.numeral);
    for (const e of sf.filter(e => e.via === 'numeral')) out.push(e.form);
    if (Q.roles.predicate && /^(cause|method|agent|time|place)$/.test(Q.roles.asked)) out.push(Q.roles.subject + ' ' + Q.roles.predicate);
    return out.slice(0, 2); }
  const api = { compile, queries, subjectDrift, relationDrift, bestSentence, total, titleForms, BAND, DRIFT, numeralForms };
  if (isNode) module.exports = api; else root.KQC = api;
})(typeof self !== 'undefined' ? self : this);
