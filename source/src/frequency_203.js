/* 4.9.203 phase + frequency packets.
 * The formula is proposal v1 in rmc_engine_v1/frequency_203_config.py, awaiting Nic.
 * θ=(Φ−1)·40° stays the master. Decimals are hundredths of a hertz.
 * RSOC operators run per component. This is not FHRR. No LLM. */
(function (root) {
  'use strict';
  const SHA = (typeof module !== 'undefined' && module.exports) ? require('./sha256.js') : root.KSha;
  const PROPOSAL = 'proposal v1';
  const AWAITING = 'Nic';
  const MASTER_HZ = 144;
  const BANDS = [3, 4, 6, 8, 9, 12, 16, 18, 24, 36, 48, 72, 144, 432, 1296];
  const HOME = { 1: 4, 2: 8, 3: 12, 4: 18, 5: 36, 6: 48, 7: 72, 8: 432, 9: 1296 };
  const K_LETTERS = 8;
  const EPSILON = 0.02;
  const OFFSET_CAP = 0.40;
  const NUDGE_SPAN = 0.45;
  const MIN_LETTERS = 2;
  const C_AGREE = 0.87;
  const MASTER_WINDOW_DEG = 45;
  const JUMP_DEG = 120;
  const JUMP_TOL = 0.5;
  const MEMBRANE_PHASE = 6;
  const MERGE_BONUS = 0.12;
  const SEVER_LOSS = 0.08;
  const AMPLIFY_DECAY = 2.2;
  const DISCHARGE_EPS = 0.3;
  const DISCHARGE_ECHO = 1.8;
  const PHASE_NAMES = {
    1: 'Initiation', 2: 'Polarity', 3: 'Desire', 4: 'Friction', 5: 'Entropy',
    6: 'Grace', 7: 'Naming', 8: 'Power', 9: 'Recursion'
  };
  const CITE = 'Appendix A ω0=2π·144, harmonics 432 and 1296, channels 0/120/240. Glyph master θ=(Φ−1)·40° is the existing packet phase. FBSC Vol II |r_i−r_j|≤ε with ε unspecified; this module sets ε=0.02 on hz/marker. Letter phasors are the Phase Parsing Engine map. The decimal offset is proposal v1, awaiting Nic. RSOC coefficients are research_hooks (merge 0.12, fracture 0.08, amplify 2.2, discharge 0.3). Not FHRR. No LLM.';
  let cache = null;

  function q(value, places) {
    const scale = Math.pow(10, places);
    const sign = value < 0 ? -1 : 1;
    let out = sign * Math.floor(Math.abs(Number(value)) * scale + 0.5) / scale;
    if (out === 0) out = 0;
    return out;
  }

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
      } catch (e2) { /* offline */ }
    }
    return '';
  }

  function load() {
    if (cache) return cache;
    const letterFile = JSON.parse(readText('engine/rmc_engine_v1/reference/letter_phase_map_v1.json') || '{"letters":{}}');
    const lex = JSON.parse(readText('engine/rmc_engine_v1/concept_lexicon.json') || '{"surfaces":{}}');
    const seeds = {};
    String(readText('engine/rmc_engine_v1/reference/word_loop_seed_lexicon_v1.jsonl') || '').split('\n').forEach(function (line) {
      line = line.trim();
      if (!line || line.charAt(0) === '#') return;
      const row = JSON.parse(line);
      const word = String(row.word || '').toLowerCase();
      if (word) seeds[word] = row;
    });
    const surfaces = {};
    const by = {};
    Object.keys(lex.surfaces || {}).forEach(function (key) {
      const word = String(key).toLowerCase();
      const cid = String(lex.surfaces[key]);
      surfaces[word] = cid;
      if (!by[cid]) by[cid] = [];
      by[cid].push(word);
    });
    cache = { letters: letterFile.letters || {}, seeds: seeds, surfaces: surfaces, by: by };
    return cache;
  }

  function flags() {
    return {
      admit_gate: false, keyword_admit: false, writes: false, calls_llm: false,
      money: false, dream_idle: false, economy: false, packs_gated: true,
      christping: 'gilligan-only', christping_started: false, wikipedia_anchor: false,
      c_min: 0.87, echo_min: 0.85, write_max: 0.35, hard_stop: 0.8,
      phase_agree_min: C_AGREE, frequency_epsilon: EPSILON, resonance_not_parsing: true,
      coherence_formula_unchanged: true, proposal: PROPOSAL, awaiting: AWAITING,
      fhrr: false, rsoc: true
    };
  }

  function lettersOf(word) {
    const table = load().letters;
    const out = [];
    String(word || '').toUpperCase().split('').forEach(function (ch) {
      const spec = table[ch];
      if (!spec) return;
      const phase = String(spec.phase || '');
      if (phase.length !== 2 || '123456789'.indexOf(phase.charAt(1)) < 0) return;
      const charge = parseInt(spec.charge, 10);
      out.push({ letter: ch, phi: parseInt(phase.charAt(1), 10), charge: isNaN(charge) ? 0 : charge });
    });
    return out;
  }

  function resultant(indexes) {
    if (!indexes.length) return null;
    const counts = {};
    indexes.forEach(function (n) { counts[n] = (counts[n] || 0) + 1; });
    const ranked = Object.keys(counts).map(function (key) { return [parseInt(key, 10), counts[key]]; });
    ranked.sort(function (a, b) { return b[1] - a[1] || a[0] - b[0]; });
    if (ranked.length === 1 || ranked[0][1] > ranked[1][1]) return ranked[0][0];
    let sx = 0, sy = 0;
    indexes.forEach(function (n) {
      const ang = ((n - 1) / 9) * Math.PI * 2;
      sx += Math.sin(ang); sy += Math.cos(ang);
    });
    const mean = Math.atan2(sx, sy);
    const tau = Math.PI * 2;
    const wrapped = (mean % tau + tau) % tau;
    let best = null, gap = 1e9;
    for (let n = 1; n <= 9; n++) {
      const raw = Math.abs(((n - 1) / 9) * tau - wrapped);
      const dist = Math.min(raw, tau - raw);
      if (dist < gap - 1e-12 || (Math.abs(dist - gap) < 1e-12 && (best === null || n < best))) {
        gap = dist; best = n;
      }
    }
    return best;
  }

  function nearestBand(hz) {
    let best = BANDS[0];
    let gap = Math.abs(hz - best);
    for (let i = 1; i < BANDS.length; i++) {
      const dist = Math.abs(hz - BANDS[i]);
      if (dist < gap - 1e-9 || (Math.abs(dist - gap) <= 1e-9 && BANDS[i] < best)) {
        gap = dist; best = BANDS[i];
      }
    }
    return best;
  }

  function voronoiHalf(marker) {
    const index = BANDS.indexOf(marker);
    const left = index ? (marker - BANDS[index - 1]) / 2 : marker;
    const right = index + 1 < BANDS.length ? (BANDS[index + 1] - marker) / 2 : marker;
    return Math.min(left, right);
  }

  function degNorm(value) {
    let out = q(((value % 360) + 360) % 360, 4);
    if (out >= 360) return 0;
    return out;
  }

  function masterDeg(phi) { return (parseInt(phi, 10) - 1) * 40; }

  function cdistDeg(a, b) {
    const d = Math.abs(a - b) % 360;
    return Math.min(d, 360 - d);
  }

  function signedDeg(oldDeg, nextDeg) {
    let d = (nextDeg - oldDeg) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  function plus120(oldDeg, nextDeg) {
    return Math.abs(signedDeg(oldDeg, nextDeg) - JUMP_DEG) <= JUMP_TOL;
  }

  function component(band, hz, phase, amp, master) {
    let snapped = q(hz, 2);
    if (nearestBand(snapped) !== band) snapped = q(band, 2);
    return {
      band: band, hz: snapped, phase_deg: degNorm(phase),
      amp: q(Math.max(0, amp), 4), master: !!master,
      nearest: nearestBand(snapped) === band || master ? band : nearestBand(snapped)
    };
  }

  function phasors(word) {
    const lets = lettersOf(word);
    const n = Math.max(1, lets.length);
    const net = lets.reduce(function (sum, row) { return sum + row.charge; }, 0);
    const nudge = lets.length ? Math.tanh(net / 8) / 4 : 0;
    const acc = {};
    lets.forEach(function (row, index) {
      let theta = (row.phi - 1) * 40;
      if (row.charge < 0) theta += 180;
      const weight = 1 + Math.abs(row.charge);
      const base = HOME[row.phi];
      const half = voronoiHalf(base);
      const frac = ((index + 1) - 0.5) / n - 0.5;
      let chargeFrac = row.charge / 3;
      if (chargeFrac > 1) chargeFrac = 1;
      if (chargeFrac < -1) chargeFrac = -1;
      let unit = 0.50 * frac + 0.25 * chargeFrac + nudge;
      if (unit > OFFSET_CAP) unit = OFFSET_CAP;
      if (unit < -OFFSET_CAP) unit = -OFFSET_CAP;
      const hz = base + unit * half;
      if (!acc[base]) acc[base] = [0, 0, 0, 0];
      const rad = theta * Math.PI / 180;
      acc[base][0] += weight * Math.cos(rad);
      acc[base][1] += weight * Math.sin(rad);
      acc[base][2] += weight * hz;
      acc[base][3] += weight;
    });
    const comps = [];
    Object.keys(acc).forEach(function (key) {
      const base = parseInt(key, 10);
      const slot = acc[key];
      const phase = Math.atan2(slot[1], slot[0]) * 180 / Math.PI;
      comps.push(component(base, slot[2] / slot[3], phase, Math.hypot(slot[0], slot[1]), false));
    });
    comps.sort(function (a, b) { return b.amp - a.amp || a.band - b.band; });
    return comps.slice(0, K_LETTERS);
  }

  function masterComponent(phi, others) {
    const amp = others.reduce(function (sum, row) { return sum + row.amp; }, 0) || 1;
    return component(144, MASTER_HZ, masterDeg(phi), amp, true);
  }

  function pack(word, phi, components, source, concept, placing) {
    const letters = components.slice().sort(function (a, b) { return a.band - b.band; });
    const ordered = [masterComponent(phi, letters)].concat(letters);
    const canonical = ordered.map(function (row) {
      return row.band + ':' + row.hz.toFixed(2) + ':' + row.phase_deg.toFixed(4) + ':' + row.amp.toFixed(4);
    }).join('|');
    return {
      word: word, Phi: phi, phase_name: PHASE_NAMES[phi] || '', master_degrees: masterDeg(phi),
      source: source, concept: concept || '', placing_surface: placing || '',
      proposal: PROPOSAL, awaiting: AWAITING, epsilon: EPSILON,
      omega0: q(2 * Math.PI * MASTER_HZ, 4), components: ordered, k: ordered.length,
      content_hash: SHA.sha256(canonical), canonical: canonical, calls_llm: false, cite: CITE
    };
  }

  function ownGain(word) {
    const lets = lettersOf(word);
    if (!lets.length) return 0;
    const net = lets.reduce(function (sum, row) { return sum + row.charge; }, 0);
    return q(Math.tanh(net / 8), 6);
  }

  function nudge(components, gain) {
    return components.filter(function (row) { return !row.master; }).map(function (row) {
      const shift = gain * EPSILON * row.band * NUDGE_SPAN;
      let hz = q(row.hz + shift, 2);
      if (nearestBand(hz) !== row.band) hz = row.hz;
      const nxt = {};
      Object.keys(row).forEach(function (key) { nxt[key] = row[key]; });
      nxt.hz = hz;
      nxt.nearest = row.band;
      return nxt;
    });
  }

  function seedPhase(word) {
    const row = load().seeds[String(word || '').toLowerCase()];
    if (!row) return null;
    const phase = row.phase;
    if (typeof phase === 'string' && phase.length === 2 && '123456789'.indexOf(phase.charAt(1)) >= 0) return parseInt(phase.charAt(1), 10);
    return null;
  }

  function conceptPhi(cid) {
    const surfaces = load().by[cid] || [];
    const hits = [];
    surfaces.forEach(function (surface) {
      const phase = seedPhase(surface);
      if (phase) hits.push(phase);
    });
    if (hits.length) return resultant(hits);
    if (!surfaces.length) return null;
    const placing = surfaces.slice().sort(function (a, b) { return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0); })[0];
    return resultant(lettersOf(placing).map(function (row) { return row.phi; }));
  }

  function placingSurface(cid) {
    const surfaces = (load().by[cid] || []).slice();
    const seeded = surfaces.filter(function (surface) { return seedPhase(surface); });
    const pool = seeded.length ? seeded : surfaces;
    if (!pool.length) return '';
    return pool.slice().sort(function (a, b) { return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0); })[0];
  }

  function letterSignature(word, master) {
    const key = String(word || '').toLowerCase();
    let phi = (typeof master === 'number' && master >= 1 && master <= 9) ? master : resultant(lettersOf(key).map(function (row) { return row.phi; }));
    if (!phi) phi = 1;
    return pack(key, phi, phasors(key), 'letters', '', '');
  }

  function wordSignature(word, master) {
    const key = String(word || '').toLowerCase();
    if (typeof master === 'number' && master >= 1 && master <= 9) return letterSignature(key, master);
    const phase = seedPhase(key);
    if (phase) return letterSignature(key, phase);
    const cid = load().surfaces[key];
    if (cid) {
      let phi = conceptPhi(cid);
      if (!phi) phi = 1;
      const placing = placingSurface(cid);
      const backbone = phasors(placing || key);
      return pack(key, phi, nudge(backbone, ownGain(key)), 'concept', cid, placing);
    }
    return letterSignature(key, null);
  }

  function matchComponents(a, b) {
    const used = {};
    const pairs = [];
    const lettersB = b.filter(function (row) { return !row.master; });
    a.forEach(function (ca) {
      if (ca.master) return;
      let best = null, bestGap = 1e9;
      lettersB.forEach(function (cb, index) {
        if (used[index] || ca.band !== cb.band) return;
        const gap = Math.abs(ca.hz - cb.hz) / ca.band;
        if (gap <= EPSILON + 1e-12 && gap < bestGap) { best = index; bestGap = gap; }
      });
      if (best !== null) { used[best] = true; pairs.push([ca, lettersB[best]]); }
    });
    return { pairs: pairs, n: lettersB.length };
  }

  function resonate(left, right) {
    const a = (left && left.components) || [];
    const b = (right && right.components) || [];
    const ma = a.filter(function (row) { return row.master; })[0];
    const mb = b.filter(function (row) { return row.master; })[0];
    if (!ma || !mb) return { resonate: false, reason: 'no-master', R: 0, cover: 0, matched: 0, calls_llm: false };
    const masterGap = cdistDeg(ma.phase_deg, mb.phase_deg);
    const masterOk = masterGap <= MASTER_WINDOW_DEG + 1e-9;
    const forward = matchComponents(a, b);
    const backward = matchComponents(b, a);
    const shorter = Math.min(forward.n, backward.n);
    const matched = forward.n <= backward.n ? forward.pairs.length : backward.pairs.length;
    const cover = shorter ? matched / shorter : 0;
    const pairs = forward.n <= backward.n ? forward.pairs : backward.pairs.map(function (pair) { return [pair[1], pair[0]]; });
    const masterDelta = (mb.phase_deg - ma.phase_deg) * Math.PI / 180;
    let sx = Math.cos(masterDelta), sy = Math.sin(masterDelta), count = 1;
    pairs.forEach(function (pair) {
      const delta = (pair[1].phase_deg - pair[0].phase_deg) * Math.PI / 180;
      sx += Math.cos(delta); sy += Math.sin(delta); count += 1;
    });
    const score = Math.hypot(sx, sy) / count;
    const ok = !!(masterOk && shorter >= MIN_LETTERS && matched === shorter && score + 1e-12 >= C_AGREE);
    const reason = ok ? 'resonate' : !masterOk ? 'master' : (matched !== shorter || shorter < MIN_LETTERS) ? 'frequency' : 'phase';
    return {
      resonate: ok, reason: reason, R: q(score, 6), cover: q(cover, 6), matched: matched,
      shorter: shorter, master_ok: masterOk, master_deg: q(masterGap, 4),
      epsilon: EPSILON, phase_agree_min: C_AGREE, calls_llm: false
    };
  }

  function stateOf(spec) {
    const row = spec || {};
    const phi = parseInt(row.Phi || 1, 10);
    let comps = row.components;
    if (!comps && row.word) comps = wordSignature(String(row.word), phi).components;
    return {
      word: String(row.word || ''), Phi: phi,
      eps: row.eps === undefined || row.eps === null ? 0 : Number(row.eps),
      mu: row.mu === undefined || row.mu === null ? 1 : Number(row.mu),
      chi: parseInt(row.chi || 0, 10),
      components: (comps || []).map(function (item) {
        const copy = {};
        Object.keys(item).forEach(function (key) { copy[key] = item[key]; });
        return copy;
      })
    };
  }

  function publicState(row, extra) {
    const out = {
      word: row.word, Phi: row.Phi, phase_name: PHASE_NAMES[row.Phi] || '',
      eps: q(Math.max(0, row.eps), 6), mu: q(row.mu, 6), chi: row.chi,
      components: row.components.map(function (item) {
        const copy = {};
        Object.keys(item).forEach(function (key) { copy[key] = item[key]; });
        return copy;
      }),
      calls_llm: false
    };
    if (extra) Object.keys(extra).forEach(function (key) { out[key] = extra[key]; });
    return out;
  }

  function jumpReport(before, after) {
    const by = {};
    before.forEach(function (row) { by[row.band] = row; });
    const banned = [];
    after.forEach(function (row) {
      const prev = by[row.band];
      if (prev && plus120(prev.phase_deg, row.phase_deg)) banned.push({ band: row.band, from: prev.phase_deg, to: row.phase_deg });
    });
    return { banned: banned, forbidden: banned.length > 0 };
  }

  function membraneOpen(phi) { return parseInt(phi, 10) === MEMBRANE_PHASE; }

  function mergeOp(left, right) {
    const a = stateOf(left), b = stateOf(right);
    const ma = a.components.filter(function (row) { return row.master; })[0];
    const mb = b.components.filter(function (row) { return row.master; })[0];
    const delta = cdistDeg(ma.phase_deg, mb.phase_deg) * Math.PI / 180;
    if (delta > Math.PI / 4 + 1e-12 || a.chi !== b.chi) {
      a.eps = Math.max(0, a.eps + 0.07);
      b.eps = Math.max(0, b.eps + 0.07);
      return { op: 'merge', ok: false, reason: 'rejected', eps_tax: 0.07, a: publicState(a), b: publicState(b), calls_llm: false, admit_gate: false };
    }
    if (!(membraneOpen(a.Phi) && membraneOpen(b.Phi))) {
      return { op: 'merge', ok: false, reason: 'phase-6 membrane', a: publicState(a), b: publicState(b), calls_llm: false, admit_gate: false };
    }
    const used = {};
    const lettersB = b.components.filter(function (row) { return !row.master; });
    const mergedLetters = [];
    const shared = [];
    a.components.forEach(function (ca) {
      if (ca.master) return;
      let hit = null;
      lettersB.forEach(function (cb, index) {
        if (hit !== null || used[index] || ca.band !== cb.band) return;
        if (Math.abs(ca.hz - cb.hz) / ca.band <= EPSILON + 1e-12) hit = index;
      });
      if (hit === null) { mergedLetters.push(Object.assign({}, ca)); return; }
      used[hit] = true;
      const cb = lettersB[hit];
      shared.push(cdistDeg(ca.phase_deg, cb.phase_deg));
      const radA = ca.phase_deg * Math.PI / 180, radB = cb.phase_deg * Math.PI / 180;
      const phase = Math.atan2(Math.sin(radA) + Math.sin(radB), Math.cos(radA) + Math.cos(radB)) * 180 / Math.PI;
      const weight = ca.amp + cb.amp || 1;
      const hz = (ca.amp * ca.hz + cb.amp * cb.hz) / weight;
      mergedLetters.push(component(ca.band, hz, phase, weight, false));
    });
    lettersB.forEach(function (cb, index) { if (!used[index]) mergedLetters.push(Object.assign({}, cb)); });
    mergedLetters.sort(function (x, y) { return y.amp - x.amp || x.band - y.band; });
    const kept = mergedLetters.slice(0, K_LETTERS);
    const phi = a.Phi;
    const merged = [masterComponent(phi, kept)].concat(kept.slice().sort(function (x, y) { return x.band - y.band; }));
    const jump = jumpReport(a.components.concat(b.components), merged);
    if (jump.forbidden || (a.Phi === 5 && phi === 8) || (b.Phi === 5 && phi === 8)) {
      return { op: 'merge', ok: false, reason: '5→8', jump: jump, a: publicState(a), b: publicState(b), calls_llm: false, admit_gate: false };
    }
    const meanDelta = shared.length ? shared.reduce(function (s, n) { return s + n; }, 0) / shared.length : cdistDeg(ma.phase_deg, mb.phase_deg);
    const deltaRad = meanDelta * Math.PI / 180;
    const bonus = MERGE_BONUS * Math.cos(deltaRad) * Math.cos(deltaRad);
    const state = {
      word: a.word || b.word, Phi: phi,
      eps: Math.max(0, (a.eps + b.eps) / 2 - 0.05 * Math.cos(deltaRad)),
      mu: a.mu + b.mu + bonus, chi: a.chi, components: merged
    };
    return {
      op: 'merge', ok: true, reason: 'merged', delta: q(deltaRad, 6), mu_bonus: q(bonus, 6),
      state: publicState(state), calls_llm: false, admit_gate: false, fhrr: false
    };
  }

  function lockOp(left, right) {
    const a = stateOf(left), b = stateOf(right);
    if (!(membraneOpen(a.Phi) && membraneOpen(b.Phi))) {
      return { op: 'lock', ok: false, reason: 'phase-6 membrane', state: publicState(a), calls_llm: false, admit_gate: false };
    }
    const verdict = resonate({ components: a.components }, { components: b.components });
    if (!verdict.resonate || a.Phi !== b.Phi) return { op: 'lock', ok: false, reason: 'not aligned', verdict: verdict, calls_llm: false, admit_gate: false };
    const pairs = matchComponents(a.components, b.components).pairs;
    for (let i = 0; i < pairs.length; i++) {
      if (cdistDeg(pairs[i][0].phase_deg, pairs[i][1].phase_deg) > 40 + 1e-9) {
        return { op: 'lock', ok: false, reason: 'phase step', calls_llm: false, admit_gate: false };
      }
    }
    const locked = a.components.map(function (row) {
      const nxt = Object.assign({}, row);
      nxt.phase_deg = masterDeg(a.Phi);
      return nxt;
    });
    const jump = jumpReport(a.components, locked);
    if (jump.forbidden) return { op: 'lock', ok: false, reason: '5→8', jump: jump, calls_llm: false, admit_gate: false };
    a.mu = a.mu + b.mu;
    a.components = locked;
    return { op: 'lock', ok: true, reason: 'locked', state: publicState(a), calls_llm: false, admit_gate: false };
  }

  function fractureOp(spec) {
    const row = stateOf(spec);
    if (!membraneOpen(row.Phi)) return { op: 'fracture', ok: false, reason: 'phase-6 membrane', state: publicState(row), calls_llm: false, admit_gate: false };
    const low = row.components.filter(function (item) { return item.master || item.band < MASTER_HZ; }).map(function (item) { return Object.assign({}, item); });
    const high = row.components.filter(function (item) { return item.master || item.band > MASTER_HZ; }).map(function (item) { return Object.assign({}, item); });
    const each = (row.mu - SEVER_LOSS) / 2;
    const left = Object.assign({}, row, { components: low, mu: each, word: row.word + ':low' });
    const right = Object.assign({}, row, { components: high, mu: each, word: row.word + ':high' });
    return {
      op: 'fracture', ok: true, reason: 'split', mu_tax: SEVER_LOSS, mu_sum: q(left.mu + right.mu, 6),
      low: publicState(left), high: publicState(right), calls_llm: false, admit_gate: false
    };
  }

  function carrierDrift(components) {
    const master = components.filter(function (row) { return row.master; })[0];
    if (!master) return 0;
    const deltas = components.filter(function (row) { return !row.master; }).map(function (row) {
      return cdistDeg(row.phase_deg, master.phase_deg) * Math.PI / 180;
    });
    if (!deltas.length) return 0;
    const mean = deltas.reduce(function (s, n) { return s + n; }, 0) / deltas.length;
    const vari = deltas.reduce(function (s, n) { return s + (n - mean) * (n - mean); }, 0) / deltas.length;
    return Math.min(1, Math.sqrt(vari) / Math.PI);
  }

  function amplifyOp(spec, k, drift) {
    const row = stateOf(spec);
    const gain = Number(k);
    if (gain < 1 || gain > 2) return { op: 'amplify', ok: false, reason: 'k', calls_llm: false, admit_gate: false };
    const delta = drift === undefined || drift === null ? carrierDrift(row.components) : Number(drift);
    const comps = row.components.map(function (item) {
      const nxt = Object.assign({}, item);
      nxt.amp = q(item.amp * gain, 4);
      return nxt;
    });
    const jump = jumpReport(row.components, comps);
    if (jump.forbidden) return { op: 'amplify', ok: false, reason: '5→8', jump: jump, calls_llm: false, admit_gate: false };
    row.components = comps;
    row.mu = gain * row.mu * Math.exp(-AMPLIFY_DECAY * Math.abs(delta));
    return { op: 'amplify', ok: true, reason: 'amplified', k: gain, delta: q(delta, 6), state: publicState(row), calls_llm: false, admit_gate: false };
  }

  function dischargeOp(spec) {
    const row = stateOf(spec);
    const echo = row.mu * Math.exp(-DISCHARGE_ECHO * row.eps) * Math.cos(masterDeg(row.Phi) * Math.PI / 180);
    row.components = row.components.map(function (item) {
      const nxt = Object.assign({}, item);
      if (!item.master) nxt.amp = 0;
      return nxt;
    });
    row.mu = 0;
    row.eps = row.eps * DISCHARGE_EPS;
    return {
      op: 'discharge', ok: true, reason: 'discharged', echo: q(echo, 6), eps_factor: DISCHARGE_EPS,
      state: publicState(row), calls_llm: false, admit_gate: false
    };
  }

  function banOp(spec, carrierBand, nextDeg) {
    const row = stateOf(spec);
    let hit = false;
    const comps = row.components.map(function (item) {
      const nxt = Object.assign({}, item);
      if (item.band === parseInt(carrierBand, 10)) { hit = true; nxt.phase_deg = degNorm(nextDeg); }
      return nxt;
    });
    const jump = jumpReport(row.components, comps);
    const masterBefore = row.components.filter(function (item) { return item.master; })[0].phase_deg;
    const masterAfter = comps.filter(function (item) { return item.master; })[0].phase_deg;
    let phiAfter = Math.round(masterAfter / 40) + 1;
    if (phiAfter < 1) phiAfter = 1;
    if (phiAfter > 9) phiAfter = 9;
    const five = (row.Phi === 5 && phiAfter === 8) || (parseInt(carrierBand, 10) === 144 && plus120(masterBefore, masterAfter) && row.Phi === 5);
    if (jump.forbidden || five || !hit) {
      return { op: 'ban', ok: false, reason: (jump.forbidden || five) ? '5→8' : 'no carrier', jump: jump, applied: false, calls_llm: false, admit_gate: false };
    }
    row.components = comps;
    return { op: 'ban', ok: true, reason: 'step', state: publicState(row), calls_llm: false, admit_gate: false };
  }

  function migratePacket(packet) {
    const nxt = Object.assign({}, packet);
    const phi = nxt.Phi;
    const master = (typeof phi === 'number' && phi >= 1 && phi <= 9) ? phi : null;
    const sig = letterSignature(String(nxt.word || ''), master);
    nxt.frequency = {
      proposal: PROPOSAL, Phi: sig.Phi, master_degrees: sig.master_degrees, epsilon: EPSILON,
      components: sig.components, content_hash: sig.content_hash, k: sig.k, source: 'letters'
    };
    nxt.master_kept = nxt.Phi === sig.Phi;
    return nxt;
  }

  function run(payload) {
    const row = payload || {};
    const op = String(row.op || 'signature');
    if (op === 'flags') return flags();
    if (op === 'config') return { bands: BANDS, home: HOME, epsilon: EPSILON, k: 9, omega0: q(2 * Math.PI * 144, 4), proposal: PROPOSAL, cite: CITE, calls_llm: false };
    if (op === 'signature') return wordSignature(String(row.word || ''), typeof row.master === 'number' ? row.master : undefined);
    if (op === 'resonate') {
      const left = wordSignature(String(row.a || ''));
      const right = wordSignature(String(row.b || ''));
      return { a: left, b: right, verdict: resonate(left, right), calls_llm: false };
    }
    if (op === 'merge') return mergeOp(row.a || {}, row.b || {});
    if (op === 'lock') return lockOp(row.a || {}, row.b || {});
    if (op === 'fracture') return fractureOp(row.state || {});
    if (op === 'amplify') return amplifyOp(row.state || {}, row.k === undefined ? 1 : row.k, row.drift);
    if (op === 'discharge') return dischargeOp(row.state || {});
    if (op === 'ban') return banOp(row.state || {}, row.band || 144, row.phase_deg || 0);
    if (op === 'migrate-packet') return migratePacket(row.packet || {});
    return { op: op, ok: false, calls_llm: false };
  }

  function signatureLines(sig) {
    const lines = [
      sig.word + ' · Φ' + sig.Phi + ' ' + sig.phase_name + ' · master ' + sig.master_degrees + '° on 144 Hz',
      'source ' + sig.source + (sig.concept ? ' · ' + sig.concept + ' via ' + sig.placing_surface : ' · own letters'),
      'ε ' + sig.epsilon + ' · K ' + sig.k + ' · proposal v1 · awaiting Nic'
    ];
    sig.components.forEach(function (row) {
      lines.push((row.master ? 'master ' : 'band ') + row.hz.toFixed(2) + ' Hz · nearest ' + row.nearest + ' · phase ' + row.phase_deg.toFixed(2) + '° · amp ' + row.amp.toFixed(3));
    });
    return lines;
  }

  function pairLine(a, b) {
    const left = wordSignature(a);
    const right = wordSignature(b);
    const verdict = resonate(left, right);
    return a + ' / ' + b + ' · ' + (verdict.resonate ? 'resonate' : 'no') + ' · ' + verdict.reason + ' · R ' + verdict.R;
  }

  function paint(mode) {
    if (typeof document === 'undefined') return;
    const card = document.getElementById('freq203');
    const host = document.getElementById('freq203Body');
    if (!card || !host) return;
    const proof = root.FREQUENCY_203_PROOF || null;
    const lines = [];
    if (mode === 'related') {
      ['sun/hot', 'sun/warm', 'hot/sunny', 'sun/light', 'hot/light', 'sun/dog', 'light/quartz'].forEach(function (pair) {
        const bits = pair.split('/');
        lines.push(pairLine(bits[0], bits[1]));
      });
      lines.push('sun, hot, warm, and sunny share N.WEATHER. light is not that packet.');
    } else if (mode === 'merge') {
      const a = wordSignature('grace');
      const b = wordSignature('correct');
      const merged = mergeOp({ word: 'grace', Phi: a.Phi, eps: 0.1, mu: 1, components: a.components }, { word: 'correct', Phi: b.Phi, eps: 0.1, mu: 1, components: b.components });
      lines.push('merge grace + correct · ' + merged.reason + ' · μ ' + (merged.state ? merged.state.mu : '') + ' · bonus ' + (merged.mu_bonus === undefined ? '' : merged.mu_bonus));
    } else if (mode === 'membrane') {
      const blocked = mergeOp({ word: 'sun', Phi: 7, eps: 0, mu: 1, components: wordSignature('sun').components }, { word: 'hot', Phi: 7, eps: 0, mu: 1, components: wordSignature('hot').components });
      lines.push('merge off phase 6 · ' + blocked.reason);
    } else if (mode === 'fracture') {
      const sig = wordSignature('grace');
      const split = fractureOp({ word: 'grace', Phi: sig.Phi, eps: 0.1, mu: 1, components: sig.components });
      lines.push('fracture · ' + split.reason + ' · μ sum ' + split.mu_sum + ' · tax ' + split.mu_tax);
    } else if (mode === 'amplify') {
      const sig = wordSignature('sun');
      const amp = amplifyOp({ word: 'sun', Phi: sig.Phi, eps: 0.1, mu: 1, components: sig.components }, 1.5, 0.1);
      lines.push('amplify k=1.5 Δ=0.1 · μ ' + amp.state.mu + ' · ' + amp.reason);
    } else if (mode === 'discharge') {
      const sig = wordSignature('sun');
      const out = dischargeOp({ word: 'sun', Phi: sig.Phi, eps: 0.2, mu: 1, components: sig.components });
      lines.push('discharge · ε ' + out.state.eps + ' · μ ' + out.state.mu + ' · echo ' + out.echo);
    } else if (mode === 'ban') {
      const sig = wordSignature('grace');
      const carrier = sig.components.filter(function (row) { return !row.master; })[0];
      const banned = banOp({ word: 'grace', Phi: sig.Phi, eps: 0, mu: 1, components: sig.components }, carrier.band, carrier.phase_deg + 120);
      lines.push('+' + '120° on ' + carrier.hz.toFixed(2) + ' Hz · ' + banned.reason + ' · applied ' + (banned.applied === false ? 'no' : 'yes'));
    } else if (mode === 'chart' && proof) {
      const lex = proof.lexicon;
      lines.push('lexicon pairs ' + lex.pairs);
      lines.push('before ' + lex.before + ' (' + lex.before_rate + ')');
      lines.push('after ' + lex.after + ' (' + lex.after_rate + ')');
      lines.push('neighbor bleed ' + lex.neighbor_pairs + ' → ' + lex.neighbor_after);
      (proof.synthetic || []).forEach(function (row) {
        lines.push(row.n + ' words · before ' + row.before_rate + ' · after ' + row.after_rate + ' · expected false ' + row.expected_after_pairs);
      });
    } else {
      lines.push.apply(lines, signatureLines(wordSignature('sun')));
      if (proof && proof.epsilon_why) lines.push(proof.epsilon_why);
    }
    card.setAttribute('data-freq203-mode', mode || 'sun');
    host.textContent = lines.join('\n');
    paintChart(proof);
  }

  function paintChart(proof) {
    const chart = document.getElementById('freq203Chart');
    if (!chart || !proof || !proof.lexicon) return;
    const lex = proof.lexicon;
    const rows = [
      ['Lexicon before', lex.before_rate],
      ['Lexicon after', lex.after_rate]
    ];
    (proof.synthetic || []).forEach(function (row) {
      rows.push([row.n + ' before', row.before_rate]);
      rows.push([row.n + ' after', row.after_rate]);
    });
    const max = rows.reduce(function (m, row) { return Math.max(m, row[1]); }, 0.01);
    chart.innerHTML = rows.map(function (row) {
      const width = Math.max(2, Math.round(100 * row[1] / max));
      const tone = /after/.test(row[0]) ? '#e0a45a' : '#7dcea0';
      return '<div class="freq-row" style="margin:4px 0"><span style="display:inline-block;width:11em">' + row[0] + '</span><span style="display:inline-block;width:5em">' + row[1] + '</span><span style="display:inline-block;width:46%;height:12px;background:#0a1320;vertical-align:middle"><i style="display:block;height:12px;width:' + width + '%;background:' + tone + '"></i></span></div>';
    }).join('');
  }

  function boot() {
    if (typeof document === 'undefined' || !document.getElementById('freq203')) return;
    const start = function () {
      paint('sun');
      const buttons = document.querySelectorAll('[data-freq203-run]');
      for (let i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener('click', function (ev) {
          paint(ev.currentTarget.getAttribute('data-freq203-run'));
        });
      }
    };
    if (typeof fetch !== 'function') { start(); return; }
    fetch('data/frequency_203_proof.json').then(function (res) { return res.ok ? res.json() : null; }).then(function (proof) {
      root.FREQUENCY_203_PROOF = proof;
      start();
    }).catch(function () { start(); });
  }

  const api = {
    flags: flags, load: load, wordSignature: wordSignature, letterSignature: letterSignature,
    resonate: resonate, mergeOp: mergeOp, lockOp: lockOp, fractureOp: fractureOp,
    amplifyOp: amplifyOp, dischargeOp: dischargeOp, banOp: banOp, migratePacket: migratePacket,
    run: run, paint: paint, boot: boot, EPSILON: EPSILON, BANDS: BANDS, CITE: CITE
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Frequency203 = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
