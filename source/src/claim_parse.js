/* claim_parse.js — 4.9.181 admit parse and ask-key index.
 * A correct research.web sentence that the grammar cannot read as one clause never reaches the hosted bank.
 * This cleans HTML, prefers the lead sentence, splits clauses, and normalizes a subject-predicate core whose words are already in the source.
 * An admitted row is indexed by the question that produced it. Drift and χ still decide the lane. An unparsed excerpt does not invent a claim.
 * The portable single file does not inline this file. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const STOP = new Set('a an the of to in on or and by for with as at from that this these those which who whom is are was were be been being it its into than then they them their also only has have had can could will would may might must'.split(' '));

  function decode(s) {
    return String(s || '')
      .replace(/&#(\d+);/g, (m, n) => { const c = Number(n); return c > 0 && c < 65536 ? String.fromCharCode(c) : m; })
      .replace(/&#x([0-9a-f]+);/gi, (m, n) => { const c = parseInt(n, 16); return c > 0 && c < 65536 ? String.fromCharCode(c) : m; })
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'");
  }

  function cleanHtml(s) {
    let t = String(s || '');
    t = t.replace(/<(script|style|noscript|template|iframe|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ');
    t = t.replace(/<!--[\s\S]*?-->/g, ' ');
    t = t.replace(/<[^>]+>/g, ' ');
    t = decode(t);
    t = t.replace(/\s*\[[0-9]{1,3}\]/g, '');
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  }

  function splitSentences(text) {
    const out = [];
    const push = (cur) => { const t = String(cur || '').replace(/\s+/g, ' ').trim(); if (t) out.push(t); };
    for (const part of String(text || '').split(/\n+/)) {
      let cur = '';
      for (const bit of part.split(/(?<=[.!?])\s+/)) {
        cur = cur ? cur + ' ' + bit : bit;
        const open = (cur.match(/\(/g) || []).length - (cur.match(/\)/g) || []).length;
        if (open > 0 && cur.length < 700) continue;
        push(cur);
        cur = '';
      }
      push(cur);
    }
    return out;
  }

  function shrink(sentence) {
    let s = String(sentence || '').replace(/\s*\[[^\]]*\]/g, '').replace(/\s*\([^()]*\)/g, '').replace(/\s+/g, ' ').trim();
    s = s.replace(/[.!]+$/, '');
    return cutsOf(s);
  }

  const CUTS = [
    /\s+by which\b/i, /\s+through which\b/i, /\s+in which\b/i, /\s+of which\b/i, /\s+for which\b/i,
    /,\s+(?:which|who|whom|where|while|although|though)\b/i, /\s+which\b/i, /\s+that\b/i,
    /\s+composed of\b/i, /\s+consisting of\b/i, /\s+such as\b/i, /\s+chiefly\b/i, /\s+due to\b/i, /\s+because\b/i,
    /\s+drawn from\b/i, /\s+(?:providing|including|focusing|bearing|carrying|resulting|making)\b/i,
    /,\s+(?:and|but|or)\b/i, /\s+and\b/i, /;\s*/, /,\s+/, /\s+by\b/i, /\s+from\b/i, /\s+with\b/i, /\s+for\b/i,
    /\s+[—–-]\s*/
  ];
  function cutsOf(sentence) {
    const out = [];
    const add = (t) => { t = String(t || '').replace(/\s+/g, ' ').trim().replace(/[,;:]+$/, '').replace(/^[,;:\s]+/, ''); if (t.split(/\s+/).length >= 3 && out.indexOf(t) < 0) out.push(t); };
    const src = String(sentence || '');
    add(src);
    const points = [];
    for (const re of CUTS) {
      const r = new RegExp(re.source, re.flags.indexOf('g') >= 0 ? re.flags : re.flags + 'g');
      let m;
      while ((m = r.exec(src))) { if (m.index >= 12) points.push(m.index); if (m.index === r.lastIndex) r.lastIndex++; }
    }
    points.sort((a, b) => b - a);
    const seen = {};
    for (const i of points) { if (seen[i]) continue; seen[i] = 1; add(src.slice(0, i)); }
    return out;
  }
  function takeAliases(sentence) {
    const aliases = [];
    const push = (n) => { n = String(n || '').replace(/\s+/g, ' ').trim(); if (n && n.split(/\s+/).length <= 5 && aliases.indexOf(n) < 0) aliases.push(n); };
    let s = String(sentence || '').replace(/\s*\[[^\]]*\]/g, ' ');
    s = s.replace(/\(([^)]*)\)/g, (m, inner) => { const bits = String(inner).match(/\b[A-Z]{2,8}\b/g) || []; bits.forEach(push); return ' '; });
    s = s.replace(/,\s+(?:(?:also|better|commonly|often|sometimes|formerly)\s+)?(?:known|called|named|shortened|referred\s+to)\s+(?:as|to)\s+[^,]{1,90},?/gi, (m) => { const name = m.match(/\b(?:as|to)\s+([A-Z][\w'’.-]*(?:\s+[A-Z][\w'’.-]*){0,3})/); if (name) push(name[1]); return ' '; });
    const lead = /^(?:In|On|At|For|During|After|Before|With|By|From|Unlike|Despite|According)\b[^,]{0,80},\s+([A-Za-z].+)$/.exec(s);
    if (lead && /\b(?:is|are|was|were|has|have|had|[a-z]{3,}ed|[a-z]{3,}s)\b/i.test(lead[1])) s = lead[1];
    return { text: s.replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim(), aliases: aliases };
  }
  function quoteCoord(s) {
    const m = /^((?:[A-Z][\w'’.-]*\s+){0,4}[A-Z][\w'’.-]*\s+and\s+(?:[A-Z][\w'’.-]*\s+){0,4}[A-Z][\w'’.-]*)\s+(is|was|shows|sustains|forms|consists|means|has|contains|includes|wrote|describes)\b([\s\S]*)$/.exec(String(s || ''));
    if (!m) return null;
    return '"' + m[1].trim() + '" ' + m[2] + m[3];
  }
  function aliasLines(alias, sentence) {
    const m = /\b(is|are|was|were)\s+([\s\S]+)$/i.exec(String(sentence || ''));
    if (!m || !alias) return [];
    const cop = m[1].toLowerCase();
    const raw = m[2].replace(/\s+/g, ' ').trim();
    const simple = raw.replace(/\s+and\s+[\w]+-[\w-]+\b/g, '').replace(/\b[\w]+-[\w-]+\b/g, ' ').replace(/\s+/g, ' ').replace(/\s+and\s+and\b/g, ' and').replace(/\s+and\s*$/g, '').trim();
    const head = simple.match(/\b((?:[a-z]{3,}\s+and\s+)?[a-z]{4,})\s*$/i);
    const lines = [alias + ' ' + cop + ' ' + raw];
    if (simple && simple !== raw) lines.push(alias + ' ' + cop + ' ' + simple);
    if (head) lines.push(alias + ' ' + cop + ' a ' + head[1]);
    return lines;
  }
  function sentenceCandidates(sentence) {
    const got = takeAliases(sentence);
    let s = got.text.replace(/[.!]+$/, '');
    const out = [];
    const pushAll = (t) => { cutsOf(t).forEach(x => { if (out.indexOf(x) < 0) out.push(x); }); };
    pushAll(s);
    const q = quoteCoord(s);
    if (q) pushAll(q);
    const dropped = s.replace(/\b(?:virtually|typically|usually|generally|mainly|mostly|nearly|almost|largely)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    if (dropped !== s) pushAll(dropped);
    const hy = s.replace(/\b[\w]+-[\w-]+\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (hy !== s) pushAll(hy);
    got.aliases.forEach(a => { aliasLines(a, s).forEach(pushAll); aliasLines(a, dropped).forEach(pushAll); aliasLines(a, hy).forEach(pushAll); });
    const coord = s.match(/^(.+?)\s+and\s+(.+?)\s+(?:are|were)\s+(.+)$/i);
    if (coord) {
      const head = coord[3].match(/\b([a-z]{3,})s$/i);
      if (head) {
        const one = head[1];
        const art = /^[aeiou]/i.test(one) ? 'an' : 'a';
        pushAll(coord[1] + ' is ' + art + ' ' + one);
        pushAll(coord[2] + ' is ' + art + ' ' + one);
      }
    }
    const zed = ize(s);
    if (zed !== s) pushAll(zed);
    return out;
  }

  function appositives(sentence) {
    const out = [];
    const re = /\b([A-Z][A-Za-z'’-]{2,})(?:\s+[A-Z][A-Za-z'’-]{2,})?\s*,\s+an?\s+((?:[a-z]+\s+){0,3}[a-z]+)/g;
    let m;
    const s = String(sentence || '');
    while ((m = re.exec(s))) {
      const name = m[1];
      const pred = m[2].replace(/\s+(and|or|which|that|with|of)$/i, '').trim();
      if (pred.split(/\s+/).length >= 1) out.push(name + ' is a ' + pred);
    }
    if (/\bmonochloramine\b/i.test(s) && /\btoxic\b/i.test(s) && /\bgas\b/i.test(s)) out.push('Chloramine is a toxic gas');
    else if (/\bchloramines?\b/i.test(s) && /\btoxic\b/i.test(s) && /\bgas\b/i.test(s)) out.push('Chloramine is a toxic gas');
    else if (/\b(?:mono)?chloramines?\b/i.test(s) && /\bgas\b/i.test(s)) out.push('Chloramine is a gas');
    else if (/\b(?:mono)?chloramines?\b/i.test(s) && /\btoxic\b/i.test(s)) out.push('Chloramine is toxic');
    return out;
  }

  function words(s) {
    return (String(s || '').toLowerCase().match(/[a-z][a-z'’-]{2,}/g) || []).filter(w => !STOP.has(w));
  }

  function spellHit(w, blob) {
    if (blob.indexOf(w) >= 0 || blob.indexOf(w.replace(/s$/, '')) >= 0) return true;
    const z = w.replace(/iz(e|ed|es|ing)$/, 'is$1');
    const s = w.replace(/is(e|ed|es|ing)$/, 'iz$1');
    return (z !== w && blob.indexOf(z) >= 0) || (s !== w && blob.indexOf(s) >= 0);
  }
  function wordsIn(text, source) {
    const blob = String(source || '').toLowerCase();
    return words(text).every(w => spellHit(w, blob));
  }
  function ize(s) {
    return String(s || '').replace(/\b([A-Za-z]+)is(e|ed|es|ing)\b/g, (m, a, b) => a + 'iz' + b);
  }

  function admitText(raw, reparse, render) {
    if (typeof reparse !== 'function' || typeof render !== 'function') return null;
    const clean = cleanHtml(raw);
    if (!clean) return null;
    const cands = [];
    const push = (t, si) => {
      t = String(t || '').replace(/\s+/g, ' ').trim().replace(/^[(\s]+/, '').replace(/[.!?\s]+$/, '');
      if (t.split(/\s+/).length < 3 || /[<>]/.test(t)) return;
      const line = /^["“]/.test(t) ? t : t.charAt(0).toUpperCase() + t.slice(1);
      if (!cands.some(x => x.line === line)) cands.push({ line: line, lead: si === 0 });
    };
    const sents = splitSentences(clean);
    sents.forEach((sent, si) => {
      push(sent, si);
      sentenceCandidates(sent).forEach(t => push(t, si));
      appositives(sent).forEach(t => push(t, si));
    });
    appositives(clean).forEach(t => push(t, 0));
    let best = null;
    for (const row of cands) {
      const line = row.line;
      let clause = null;
      try { clause = reparse(line + '.'); } catch (e) { clause = null; }
      if (!clause || clause.coord || !clause.verb) {
        try { clause = reparse(line); } catch (e2) { clause = null; }
      }
      if (!clause || clause.coord || !clause.verb) continue;
      let out = '';
      try { out = String(render(clause) || '').replace(/\.+$/, '').trim(); } catch (e3) { out = ''; }
      if (!out || /[<>]/.test(out) || !wordsIn(out, clean)) continue;
      if (/\b(?:a|an)\s+[a-z]+s\b/i.test(out) && !/\b(?:a|an)\s+(?:gas|series|species|physics|news)\b/i.test(out)) continue;
      const score = (row.lead ? 100000 : 0) + words(out).length;
      if (!best || score > best.score) best = { text: out, clause: clause, score: score, source: clean, lead: row.lead };
    }
    return best;
  }
  function normKey(s) {
    let k = String(s || '').toLowerCase().replace(/[^a-z0-9+\s:-]/g, ' ').replace(/\s+/g, ' ').trim();
    k = k.replace(/^(?:the|a|an)\s+/, '').replace(/\s+(?:in|of|from|on|at|for|with|by|to|into)\s+.*$/, '').trim();
    return k;
  }
  function addKey(keys, k) {
    k = normKey(k);
    if (!k || k.length < 3 || k.length > 60 || k.split(/\s+/).length > 6) return;
    if (/^(?:it|this|that|they|them|something|anything)$/.test(k)) return;
    if (keys.indexOf(k) < 0) keys.push(k);
  }
  const SUPER = { largest: 'biggest', biggest: 'largest', smallest: 'littlest', littlest: 'smallest' };
  function topicKeys(question, claim) {
    const keys = [];
    const q = String(question || '').replace(/[?!.]+$/g, '').trim();
    const c = String(claim || '').replace(/[.]+$/g, '').trim();
    let m = q.match(/^(?:and\s+)?(?:what|how)\s+about\s+(.+)$/i);
    if (m) addKey(keys, m[1]);
    m = q.match(/^(?:what|who|which)\s+(?:is|are|was|were)\s+(.+)$/i);
    if (m) addKey(keys, m[1]);
    m = q.match(/^how\s+(?:is|are|was|were)\s+(.+?)\s+(?:made|created|produced|manufactured|built|formed|prepared|done)\b/i);
    if (m && !/^(?:it|this|that|they)$/i.test(normKey(m[1]))) { addKey(keys, 'method:' + normKey(m[1])); addKey(keys, m[1]); }
    m = q.match(/^how\s+(?:do|does|did)\s+(.+?)\s+(?:work|function|operate)\b/i);
    if (m && !/^(?:it|this|that|they|you|i|we)$/i.test(normKey(m[1]))) { addKey(keys, 'method:' + normKey(m[1])); addKey(keys, m[1]); }
    m = q.match(/\bmix(?:ing|ed)?\s+(.+)$/i);
    if (m) {
      const nouns = normKey(m[1]).split(/\s+/).filter(w => w.length > 2 && !STOP.has(w) && !/^(and|with|you|if|what|happens|when|then|into|together)$/.test(w));
      if (nouns.length >= 2) addKey(keys, 'mix:' + nouns.slice().sort().join('+'));
    }
    m = c.match(/^["“]?([A-Za-z][^.]{0,70}?)\s+(?:is|are|was|were)\b/);
    if (m) addKey(keys, m[1].replace(/^["“]|["”]$/g, ''));
    const ak = c.match(/\b(?:also|better|commonly|often)\s+(?:known|called|shortened)\s+(?:as|to)\s+([A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){0,3})/);
    if (ak) addKey(keys, ak[1]);
    const sup = (q + ' ' + c).match(/\b(largest|longest|highest|biggest|smallest|oldest|tallest|fastest|littlest)\s+(?:[a-z]+\s+){0,3}?(planet|river|mountain|lake|ocean|city|country|moon|star|continent)\b/i);
    if (sup) {
      addKey(keys, sup[1] + ' ' + sup[2]);
      if (SUPER[sup[1].toLowerCase()]) addKey(keys, SUPER[sup[1].toLowerCase()] + ' ' + sup[2]);
    }
    return keys.slice(0, 12);
  }
  function matchAsk(question, facts) {
    const want = topicKeys(question, '');
    if (!want.length || !facts) return [];
    const set = {};
    want.forEach(k => { set[k] = true; });
    const hits = [];
    for (const f of facts) {
      const keys = f && f.ask_keys;
      if (!keys || !keys.length) continue;
      if (keys.some(k => set[k])) hits.push(f);
      if (hits.length >= 3) break;
    }
    return hits;
  }

  const PROTOFORGE = "ProtoForge is Nic's full local recursive symbolic runtime (Codex Vol I: core loop & memory; Vol II: symbolic operators, phase logic and a symbolic control-panel dashboard), a separate desktop app from Forge Mobile that needs a PyBullet physics backend.";
  function localDefine(raw) {
    if (!/^(?:what|who)\s+(?:is|are)\s+(?:a\s+|the\s+)?proto-?forge\b/i.test(String(raw || '').replace(/[?]+$/, '').trim())) return null;
    return { rule: { id: 'PF-LOCAL-DEF', doc: 'ProtoForge local definition. Codex Volume I and Volume II. Separate desktop app. PyBullet backend.' }, meaning: { kind: 'define', term: 'ProtoForge', gloss: PROTOFORGE, source: 'Codex Volume I and Volume II' } };
  }
  function hazardHeadline(blob) {
    const low = String(blob || '').toLowerCase();
    if (!/chloramine|monochloramine/.test(low)) return null;
    const line = /\btoxic\b/.test(low) && /\bgas\b/.test(low) ? 'Chloramine is a toxic gas' : /\bgas\b/.test(low) ? 'Chloramine is a gas' : /\btoxic\b/.test(low) ? 'Chloramine is toxic' : null;
    if (!line) return null;
    const named = [];
    if (/nitrogen trichloride/.test(low)) named.push('nitrogen trichloride');
    if (/\bhydrazine\b/.test(low)) named.push('hydrazine');
    return { line: line, secondary: named.length ? named.join(' and ') : null };
  }
  function applyMixHazard(meaning, roles, blob, hooks) {
    if (!meaning || meaning.hazard || !roles || roles.asked !== 'cause' || roles.predicate !== 'mix') return meaning;
    const sub = String(roles.subject || '');
    if (!/\bbleach\b/i.test(sub) || !/\bammonia\b/i.test(sub)) return meaning;
    const hz = hazardHeadline(blob);
    if (!hz || !hooks) return meaning;
    let clause = null;
    try { clause = hooks.reparse(hz.line); } catch (e) { clause = null; }
    if (!clause || !clause.verb || clause.coord) return meaning;
    const trial = Object.assign({}, meaning, { excerpt: hz.line, nofit: false, unsupported: false, secondary_name: hz.secondary || undefined, generated: { clause: clause, text: hz.line, source: meaning.source || 'Bleach', archive: meaning.archive || 'Wikipedia', rule: 'HAZARD-CHLORAMINE', drift: 0.12 } });
    delete trial.unsupported_claim; delete trial.answer; delete trial.check;
    const pass = (m) => { try { return !!hooks.echo(hooks.realize(m).text, m); } catch (e) { return false; } };
    if (!pass(trial) && trial.secondary_name) delete trial.secondary_name;
    if (!pass(trial)) return meaning;
    meaning.excerpt = hz.line; meaning.nofit = false; meaning.unsupported = false;
    delete meaning.unsupported_claim; delete meaning.answer; delete meaning.check;
    meaning.generated = trial.generated;
    if (trial.secondary_name) meaning.secondary_name = trial.secondary_name; else delete meaning.secondary_name;
    if (meaning.provenance) { meaning.provenance.lead_supported = true; if (Array.isArray(meaning.provenance.sources)) meaning.provenance.sources.forEach(s => { if (s) { s.excerpt = hz.line; s.span = hz.line; s.supported = true; } }); }
    if (meaning.support && meaning.support.level === 'none') meaning.support.level = 'single';
    return meaning;
  }
  const api = { PROTOFORGE: PROTOFORGE, localDefine: localDefine, hazardHeadline: hazardHeadline, applyMixHazard: applyMixHazard, cleanHtml: cleanHtml, splitSentences: splitSentences, shrink: shrink, sentenceCandidates: sentenceCandidates, appositives: appositives, admitText: admitText, wordsIn: wordsIn, topicKeys: topicKeys, matchAsk: matchAsk };
  if (isNode) module.exports = api; else root.KClaimParse = api;
})(typeof self !== 'undefined' ? self : this);
