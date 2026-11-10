/* Resonance lexicon. Port of the word-loop seed and the placement half of
 * lexicon_resonance.py. Tokens are letter runs. No regular expressions.
 * Phrase keyword scans are not used. A seed word is a medium signal.
 * Letters are a weak signal and do not claim εₙ = 0.
 * The letter map is the Phase Parsing Engine, not HarperScript.
 * θ=(Φ−1)·40°. Numeric μ applies only to a word tagged "proposal v1".
 * Drive codex 1xZWOfEFgYMn10XQtUOyQOQCCIaOwqfTEIcM-bgRHkjk. */
(function (root) {
  const WORD_URL = 'engine/rmc_engine_v1/reference/word_loop_seed_lexicon_v1.jsonl';
  const LETTER_URL = 'engine/rmc_engine_v1/reference/letter_phase_map_v1.json';
  let words = null;
  let letters = null;
  let letterAuthority = null;

  function readText(rel) {
    if (typeof require === 'function') {
      try {
        const fs = require('fs');
        const path = require('path');
        return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
      } catch (e) { /* browser */ }
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', rel, false);
        xhr.send(null);
        if (xhr.status === 200 || xhr.status === 0) return xhr.responseText;
      } catch (e) { /* offline */ }
    }
    return '';
  }

  function load() {
    if (words) return;
    words = {};
    String(readText(WORD_URL) || '').split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.charAt(0) === '#') return;
      const row = JSON.parse(line);
      if (row && row.word) words[String(row.word).toLowerCase()] = row;
    });
    const letterFile = JSON.parse(readText(LETTER_URL) || '{}');
    letters = letterFile.letters || {};
    letterAuthority = {
      map_authority: letterFile.map_authority || 'Phase Parsing Engine',
      not_map_authority: letterFile.not_map_authority || 'HarperScript',
      cite: letterFile.cite || '',
      signal: 'weak_letter_signal'
    };
  }

  function proposalCharge(row) {
    if (!row) return null;
    const blob = ['tag', 'status', 'family', 'notes', 'authority'].map(k => String(row[k] || '')).join(' ');
    if (blob.indexOf('proposal v1') < 0) return null;
    const eps = row.eps !== undefined ? row.eps : row.epsilon;
    const mu = row.mu;
    const numeric = typeof eps === 'number' && typeof mu === 'number';
    return { tagged: true, eps: numeric ? eps : 'unspecified', mu: numeric ? mu : 'unspecified', status: numeric ? 'stated' : 'tagged_without_numbers' };
  }

  function trimToken(buf) {
    let a = 0;
    let b = buf.length;
    while (a < b && (buf.charAt(a) === "'" || buf.charAt(a) === '-')) a++;
    while (b > a && (buf.charAt(b - 1) === "'" || buf.charAt(b - 1) === '-')) b--;
    return buf.slice(a, b);
  }

  function tokens(text) {
    const out = [];
    let buf = '';
    const s = String(text || '').toLowerCase();
    for (let i = 0; i < s.length; i++) {
      const ch = s.charAt(i);
      const letter = (ch >= 'a' && ch <= 'z') || ch === "'" || ch === '-';
      if (letter) buf += ch;
      else if (buf) { const w = trimToken(buf); if (w) out.push(w); buf = ''; }
    }
    if (buf) { const w = trimToken(buf); if (w) out.push(w); }
    return out;
  }

  function angle(n) { return ((n - 1) / 9) * Math.PI * 2; } /* θ=(Φ−1)·40° */

  function resultant(indexes) {
    if (!indexes.length) return { phi: null, how: 'none' };
    const counts = {};
    indexes.forEach(n => { counts[n] = (counts[n] || 0) + 1; });
    const ranked = Object.keys(counts).map(k => [Number(k), counts[k]]).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    if (ranked.length === 1 || ranked[0][1] > ranked[1][1]) return { phi: ranked[0][0], how: 'mode' };
    let c = 0, si = 0;
    indexes.forEach(n => { c += Math.cos(angle(n)); si += Math.sin(angle(n)); });
    const mean = Math.atan2(si, c);
    const wrapped = mean < 0 ? mean + Math.PI * 2 : mean;
    let best = null, gap = 1e9;
    for (let n = 1; n <= 9; n++) {
      const raw = Math.abs(angle(n) - wrapped);
      const dist = Math.min(raw, Math.PI * 2 - raw);
      if (dist < gap - 1e-12 || (Math.abs(dist - gap) < 1e-12 && (best === null || n < best))) { gap = dist; best = n; }
    }
    return { phi: best, how: 'circular_mean' };
  }

  function placeWord(word) {
    load();
    const Codex = (typeof require === 'function') ? require('./phase_codex.js') : root.PhaseCodex;
    const key = String(word || '').toLowerCase();
    const seed = words[key];
    const charged = proposalCharge(seed);
    let indexes = [];
    let cite = [];
    let authority = 'unspecified';
    let eps = 'unspecified';
    let mu = 'unspecified';
    let proposal = 'not_tagged';
    if (seed && typeof seed.phase === 'string' && seed.phase.length === 2) {
      indexes = [Number(seed.phase.charAt(1))];
      cite = [key];
      authority = 'medium_word_signal';
      eps = 0;
    } else {
      for (let i = 0; i < key.length; i++) {
        const ch = key.charAt(i).toUpperCase();
        const spec = letters[ch];
        if (!spec || typeof spec.phase !== 'string') continue;
        indexes.push(Number(spec.phase.charAt(1)));
        cite.push(ch + ':' + spec.phase);
      }
      authority = indexes.length ? 'weak_letter_signal' : 'unspecified';
    }
    if (charged && charged.status === 'stated') {
      eps = charged.eps;
      mu = charged.mu;
      proposal = 'stated_proposal_v1';
    } else if (charged) proposal = charged.status;
    const got = resultant(indexes);
    const id = got.phi ? 'Φ' + got.phi : null;
    const profile = id && Codex ? Codex.profile(id) : {};
    return {
      word: key, Phi: got.phi, how: got.how, glyph: profile.glyph || '',
      code_id: profile.code_identifier || '', name: profile.phase_name || '',
      eps: eps, mu: mu, proposal_v1: proposal, authority: authority,
      map_authority: letterAuthority.map_authority, not_map_authority: letterAuthority.not_map_authority,
      angle: 'θ=(Φ−1)·40°', cite: cite,
      drift_flag: id && Codex ? Codex.driftFlag(id) : 'unspecified',
      calls_llm: false
    };
  }

  function wordLoops(text) {
    load();
    const loops = [];
    tokens(text).forEach(word => {
      const spec = words[word];
      if (!spec) return;
      loops.push({ word: word, phase: spec.phase, operator: spec.operator, authority: 'medium_word_signal' });
    });
    return loops;
  }

  function proposalV1Count() {
    load();
    let n = 0;
    Object.keys(words).forEach(k => { if (proposalCharge(words[k])) n++; });
    return n;
  }

  function seedRows() { load(); return words; }
  function letterRows() { load(); return letters; }
  const api = {
    load, tokens, placeWord, wordLoops, proposalCharge, proposalV1Count,
    letterAuthority: () => { load(); return letterAuthority; },
    wordCount: () => { load(); return Object.keys(words).length; },
    seedRows, letterRows
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ResonanceLexicon = api;
})(typeof self !== 'undefined' ? self : this);
