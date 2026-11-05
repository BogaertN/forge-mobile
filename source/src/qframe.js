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
  function parse(forge, s) {
    if (!forge || typeof forge.derive !== 'function' || !s) return null;
    let d = null; try { d = forge.derive(s.replace(/[.]?$/, '.')); } catch (e) { return null; }
    const ps = (d && d.parses) || []; const p = ps.find(x => x && x.node && x.node.clause) || ps[0];
    if (!p || !p.node) return null;
    return { node: p.node, clause: p.node.clause || null, parses: ps.length, persp: d.persp || null, text: s };
  }
  const str = v => Array.isArray(v) ? v.join(' ') : (v == null ? null : String(v));
  const head = n => n ? str(n.pron || n.indef || n.head || n.propn || n.name || null) : null;
  function np(n) {
    if (!n) return null;
    let text = null; try { text = G.npText(n, 'user'); } catch (e) {}
    return { text, head: head(n), owner: n.owner || null, kernel: n.pron === 'kernel', user: n.pron === 'user', indef: !!n.indef };
  }
  function roles(cl) {
    if (!cl) return {};
    const v = cl.verb || {}; let material = null; try { material = G.material(cl); } catch (e) {}
    const karakas = {}; for (const [k, x] of Object.entries(cl.roles || {})) karakas[k] = x && typeof x === 'object' && !Array.isArray(x) ? np(x) : x;
    const pr = cl.pred || null;
    return {
      kriya: v.lemma || null, tense: v.tense || null, polarity: v.pol || null, modality: v.mod || null,
      kartr: np(cl.subj), karma: karakas.karma || null, karakas,
      pred: pr ? (pr.type === 'np' ? Object.assign({ type: 'np' }, np(pr.np)) : { type: pr.type || null, text: str(pr.words || pr.text || null) }) : null,
      adjuncts: (cl.adj || []).length, material,
    };
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
    /* interjection-only turn (closed class INTJ): the act is left to the engine's concept reading */
    if (lw.every(w => has(w.replace(/[,!.]/g, ''), 'INTJ') || has(w.replace(/[,!.]/g, ''), 'PLEASE'))) return Object.assign(f, { speech_act: 'interjection', mood: 'interjection', rule: 'QF-INTJ' });
    /* conditional: "if C, Q" → cond + main */
    if (has(lw[0], 'IF')) {
      let cut = lw.findIndex((w, i) => i > 1 && (/,$/.test(ws[i - 1]) || has(w, 'WH') || has(w, 'THEN')));
      if (cut > 1) {
        const condTxt = join(ws.slice(1, cut)).replace(/,$/, ''); const mainWs = has(lw[cut], 'THEN') ? ws.slice(cut + 1) : ws.slice(cut);
        const cond = parse(forge, condTxt); const main = compileQ(join(mainWs) + (/\?\s*$/.test(text) ? '?' : ''), forge);
        return Object.assign(main, { text: f.text, cond: cond ? Object.assign({ text: condTxt, parses: cond.parses }, roles(cond.clause)) : { text: condTxt, parsed: false }, conditional: true, speech_act: main.speech_act === 'stated' ? 'stated' : main.speech_act, rule: 'QF-IF-' + (main.rule || '') });
      }
    }
    const isQ = /\?\s*$/.test(text) || has(lw[0], 'WH') || ((has(lw[0], 'COP') || has(lw[0], 'AUX') || has(lw[0], 'MOD')) && ws.length > 1);
    if (has(lw[0], 'WH') && isQ) {
      const wh = lw[0]; f.wh = wh; f.mood = 'interrogative'; let rest = ws.slice(1); const lrest = lw.slice(1);
      if (wh === 'how' && /^(many|much)$/.test(lrest[0] || '')) { f.quantity = lrest[0]; rest = rest.slice(1); lrest.shift(); }
      const filler = FILLER[wh] || null; const adjunct = ADJUNCT[wh] || null;
      const a0 = lrest[0] || '';
      if (has(a0, 'COP') || has(a0, 'AUX') || has(a0, 'MOD')) {
        f.aux = a0; const body = rest.slice(1);
        const cands = filler ? declaratives(a0, body, filler) : (has(a0, 'COP') && body.length === 1 ? declaratives(a0, body, 'something') : declaratives(a0, body, null));
        for (const c of cands) { const p = parse(forge, c.s); if (p && p.clause) { Object.assign(f, roles(p.clause)); f.parsed = true; f.declarative = c.s; f.parses = p.parses; break; } }
        if (!f.parsed) { const so = subjectOnly(forge, body); if (so) { f.kartr = np(so.p.clause.subj); f.partial = true; f.declarative = null; } }
        f.wh_role = adjunct || (has(a0, 'COP') ? (body.length ? 'pred' : 'kartr') : 'karma');
        if (!filler && has(a0, 'COP') && body.length === 1) f.wh_role = adjunct || 'pred';
        f.rule = 'QF-WH-AUX-' + (f.parsed ? 'DECL' : f.partial ? 'SUBJ' : 'NOPARSE');
      } else if (filler) { /* subject question: the wh-word is kartṛ ("who wrote Hamlet" → "someone wrote Hamlet") */
        const s = join([filler].concat(rest)); const p = parse(forge, s);
        if (p && p.clause) { Object.assign(f, roles(p.clause)); f.parsed = true; f.declarative = s; f.parses = p.parses; }
        f.wh_role = 'kartr'; f.rule = 'QF-WH-SUBJ-' + (f.parsed ? 'DECL' : 'NOPARSE');
      } else { f.wh_role = adjunct; f.rule = 'QF-WH-ADJ-NOPARSE'; }
      f.speech_act = selfAct(f, wh, f.aux) || wh;
      return f;
    }
    if (isQ && (has(lw[0], 'COP') || has(lw[0], 'AUX') || has(lw[0], 'MOD'))) { /* yes/no: polarity of the declarative */
      f.mood = 'interrogative'; f.aux = lw[0]; f.wh_role = 'polarity';
      for (const c of declaratives(lw[0], ws.slice(1), null)) { const p = parse(forge, c.s); if (p && p.clause) { Object.assign(f, roles(p.clause)); f.parsed = true; f.declarative = c.s; f.parses = p.parses; break; } }
      f.speech_act = selfAct(f, null, f.aux) || 'stated'; f.polar = true; f.rule = 'QF-YN-' + (f.parsed ? 'DECL' : 'NOPARSE');
      return f;
    }
    /* declarative */
    const p = parse(forge, join(ws));
    if (p && p.clause) { Object.assign(f, roles(p.clause)); f.parsed = true; f.declarative = join(ws); f.parses = p.parses; f.rule = 'QF-DECL'; return f; }
    /* imperative: the addressee is kartṛ */
    const imps = ['you ' + join(ws)]; if (ws.length > 2) imps.push('you ' + join([ws[0], 'that'].concat(ws.slice(1)))); /* a clausal complement may drop "that" */
    for (const s of imps) { const pi = parse(forge, s);
      if (pi && pi.clause) { Object.assign(f, roles(pi.clause)); f.parsed = true; f.mood = 'imperative'; f.speech_act = 'command'; f.declarative = s; f.parses = pi.parses; f.rule = 'QF-IMP'; return f; } }
    /* a bare noun phrase (a fragment, e.g. a reply that picks a meaning) */
    const pf = parse(forge, join(ws) + ' is something');
    if (pf && pf.clause && pf.clause.subj) { f.kartr = np(pf.clause.subj); f.mood = 'fragment'; f.rule = 'QF-FRAGMENT-NP'; return f; }
    f.rule = 'QF-NOPARSE'; return f;
  }
  function compile(text, forge) { try { return compileQ(text, forge); } catch (e) { return { schema: SCHEMA, text: String(text || ''), speech_act: null, parsed: false, rule: 'QF-ERROR', error: String(e && e.message || e).slice(0, 200), calls_llm: false }; } }
  const api = { SCHEMA, compile, FILLER, ADJUNCT };
  if (isNode) module.exports = api; else root.KQFrame = api;
})(typeof self !== 'undefined' ? self : this);
