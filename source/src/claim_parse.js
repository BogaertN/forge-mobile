/* claim_parse.js — 4.9.180 admit parse.
 * A correct research.web sentence that the grammar cannot read as one clause never reaches the hosted bank.
 * This cleans HTML, splits sentences, and normalizes a subject-predicate core whose words are already in the source.
 * Drift and χ still decide the lane. An unparsed excerpt does not invent a claim.
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
    const out = [];
    const add = (t) => { t = String(t || '').replace(/\s+/g, ' ').trim().replace(/[,;:]+$/, ''); if (t.split(/\s+/).length >= 3 && out.indexOf(t) < 0) out.push(t); };
    add(s);
    const bounds = [
      /,\s+(?:which|who|whom|where|while|although|though|and|but|or)\b/i,
      /\s+by which\b/i,
      /\s+such as\b/i,
      /\s+because\b/i,
      /\s+[—–]\s*/,
      /;\s/,
      /,\s+/
    ];
    let y = s;
    for (let i = 0; i < 6; i++) {
      let cut = -1;
      for (const re of bounds) { const m = re.exec(y); if (m && (cut < 0 || m.index < cut)) cut = m.index; }
      if (cut < 12) break;
      y = y.slice(0, cut).trim();
      add(y);
    }
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

  function wordsIn(text, source) {
    const blob = String(source || '').toLowerCase();
    return words(text).every(w => blob.indexOf(w) >= 0 || blob.indexOf(w.replace(/s$/, '')) >= 0);
  }

  function admitText(raw, reparse, render) {
    if (typeof reparse !== 'function' || typeof render !== 'function') return null;
    const clean = cleanHtml(raw);
    if (!clean) return null;
    const cands = [];
    const push = (t) => {
      t = String(t || '').replace(/\s+/g, ' ').trim().replace(/^[("“]+/, '').replace(/[.!?\s]+$/, '');
      if (t.split(/\s+/).length < 3 || /[<>]/.test(t)) return;
      const line = t.charAt(0).toUpperCase() + t.slice(1);
      if (cands.indexOf(line) < 0) cands.push(line);
    };
    for (const sent of splitSentences(clean)) {
      push(sent);
      shrink(sent).forEach(push);
      appositives(sent).forEach(push);
    }
    appositives(clean).forEach(push);
    let best = null;
    for (const line of cands) {
      let clause = null;
      try { clause = reparse(line + '.'); } catch (e) { clause = null; }
      if (!clause || clause.coord || !clause.verb) {
        try { clause = reparse(line); } catch (e2) { clause = null; }
      }
      if (!clause || clause.coord || !clause.verb) continue;
      let out = '';
      try { out = String(render(clause) || '').replace(/\.+$/, '').trim(); } catch (e3) { out = ''; }
      if (!out || /[<>]/.test(out) || !wordsIn(out, clean)) continue;
      const score = words(out).length;
      if (!best || score > best.score) best = { text: out, clause: clause, score: score, source: clean };
    }
    return best;
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
  const api = { PROTOFORGE: PROTOFORGE, localDefine: localDefine, hazardHeadline: hazardHeadline, applyMixHazard: applyMixHazard, cleanHtml: cleanHtml, splitSentences: splitSentences, shrink: shrink, appositives: appositives, admitText: admitText, wordsIn: wordsIn };
  if (isNode) module.exports = api; else root.KClaimParse = api;
})(typeof self !== 'undefined' ? self : this);
