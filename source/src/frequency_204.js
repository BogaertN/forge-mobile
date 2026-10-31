/* 4.9.204 resonance tuning.
 * Spelling (frequency_203) fixes the starting decimals.
 * Co-admitted words attract. Conflict pairs repel. A spacing spring
 * keeps the field off a single hertz. Only frequency offsets move.
 * The glyph master phase does not. RSOC numbers, not FHRR. No LLM.
 * The formula is proposal v1 in frequency_204_config.py, awaiting Nic. */
(function (root) {
  'use strict';
  const F = (typeof module !== 'undefined' && module.exports) ? require('./frequency_203.js') : root.Frequency203;
  const ZETA = 0.12;
  const BETA = 2.2;
  const SEVER = 0.08;
  const KAPPA = 0.004;
  const EQ_FRACTION = 0.5;
  const HALF_LIFE_HOURS = 168;
  const MEMBRANE_PHASE = 6;
  const HASH_PLACES = 6;
  const C_MIN = 0.87;
  const ECHO_MIN = 0.85;
  const WRITE_MAX = 0.35;
  const HARD_STOP = 0.8;
  const MASTER_HZ = 144;
  const MASTER_WINDOW = Math.PI / 4;
  const LN2 = Math.LN2;
  const PROPOSAL = 'proposal v1';
  const WATCH = [['sun', 'light'], ['sun', 'hot'], ['sun', 'dog'], ['light', 'quartz']];
  const FUNCTION_WORDS = {
    a: 1, an: 1, the: 1, and: 1, or: 1, of: 1, to: 1, in: 1, on: 1, for: 1, with: 1, from: 1, by: 1, as: 1, at: 1, into: 1, over: 1,
    is: 1, are: 1, was: 1, were: 1, be: 1, been: 1, being: 1, it: 1, its: 1, this: 1, that: 1, these: 1, those: 1,
    than: 1, then: 1, so: 1, if: 1, but: 1, not: 1, no: 1, nor: 1, you: 1, your: 1, we: 1, our: 1, they: 1, them: 1, their: 1,
    he: 1, she: 1, his: 1, her: 1, what: 1, which: 1, who: 1, how: 1, when: 1, where: 1, why: 1, does: 1, did: 1, do: 1
  };
  const CITE = 'RSOC merge μ\' = μ1+μ2+0.12·cos²δ, δ = master-phase difference. Amplify decay e^(−2.2|Δ|). Fracture severance 0.08. SPC half-life 168 h, λ = ln2/168. Glyph master θ=(Φ−1)·40° is not moved. Frequency offsets are proposal v1, awaiting Nic. Not FHRR. No LLM.';

  function q(value, places) { return F.q(value, places); }

  function flags() {
    return {
      admit_gate: false, keyword_admit: false, writes_offsets: true, calls_llm: false,
      money: false, dream_idle: false, economy: false, packs_gated: true,
      christping: 'gilligan-only', christping_started: false, wikipedia_anchor: false,
      wikimedia_excluded: true, c_min: C_MIN, echo_min: ECHO_MIN, write_max: WRITE_MAX,
      hard_stop: HARD_STOP, zeta: ZETA, beta: BETA, sever: SEVER, kappa: KAPPA,
      half_life_hours: HALF_LIFE_HOURS, membrane_phase: MEMBRANE_PHASE, master_phase_moved: false,
      resonance_not_parsing: true, coherence_formula_unchanged: true, proposal: PROPOSAL,
      awaiting: 'Nic', fhrr: false, rsoc: true
    };
  }

  function cellBounds(marker) {
    const bands = F.BANDS;
    const index = bands.indexOf(marker);
    const lo = index ? (bands[index - 1] + marker) / 2 : -Infinity;
    const hi = index + 1 < bands.length ? (marker + bands[index + 1]) / 2 : Infinity;
    return [lo, hi];
  }

  function clampHz(band, hz) {
    const bounds = cellBounds(band);
    let out = Number(hz);
    if (out <= bounds[0]) out = bounds[0] + 0.01;
    if (out > bounds[1]) out = bounds[1];
    let snapped = q(out, 2);
    if (F.nearestBand(snapped) !== band) snapped = q(band, 2);
    return snapped;
  }

  function masterDelta(left, right) {
    const ma = left.components.filter(function (row) { return row.master; })[0];
    const mb = right.components.filter(function (row) { return row.master; })[0];
    let gap = Math.abs(ma.phase_deg - mb.phase_deg) % 360;
    const deg = Math.min(gap, 360 - gap);
    return deg * Math.PI / 180;
  }

  function wikiBlocked(trust, source) {
    const blob = String(trust || '') + ' ' + String(source || '');
    return /wikipedia|wikimedia/i.test(blob);
  }

  function contentWords(text, words) {
    if (words) {
      const out = [];
      const seen = {};
      words.forEach(function (raw) {
        const word = String(raw || '').toLowerCase();
        if (!word || seen[word]) return;
        seen[word] = 1;
        out.push(word);
      });
      return out;
    }
    const found = [];
    const seen = {};
    const matched = String(text || '').toLowerCase().match(/[a-zA-Z']+/g) || [];
    matched.forEach(function (raw) {
      const word = raw.replace(/^'+|'+$/g, '');
      if (word.length < 2 || FUNCTION_WORDS[word] || seen[word]) return;
      if (F.lettersOf(word).length < 2) return;
      seen[word] = 1;
      found.push(word);
    });
    return found;
  }

  function decayWeight(ageHours, halfLife) {
    const age = Math.max(0, Number(ageHours));
    const half = halfLife ? Number(halfLife) : HALF_LIFE_HOURS;
    return q(Math.exp(-LN2 * age / half), HASH_PLACES);
  }

  function add(acc, word, band, dh) {
    if (!acc[word]) acc[word] = {};
    const prev = acc[word][band] || 0;
    acc[word][band] = q(prev + q(dh, HASH_PLACES), HASH_PLACES);
  }

  function attractDh(hU, hV, marker, deltaRad) {
    if (deltaRad > MASTER_WINDOW + 1e-12) return 0;
    const gap = hV - hU;
    const absDelta = marker ? Math.abs(gap) / marker : 0;
    const coupling = ZETA * Math.cos(deltaRad) * Math.cos(deltaRad) * Math.exp(-BETA * absDelta);
    return q(coupling * gap, HASH_PLACES);
  }

  function repelDh(hU, hV, marker) {
    const gap = hV - hU;
    const absDelta = marker ? Math.abs(gap) / marker : 0;
    const coupling = SEVER * Math.exp(-BETA * absDelta);
    return q(-coupling * gap, HASH_PLACES);
  }

  function eqGap(marker) { return EQ_FRACTION * F.EPSILON * marker; }

  function separateDh(hU, hV, marker, wordU, wordV) {
    const gap = Math.abs(hU - hV);
    const dEq = eqGap(marker);
    if (gap > dEq + 1e-12) return 0;
    const absDelta = marker ? gap / marker : 0;
    const decay = Math.exp(-BETA * absDelta);
    let direction;
    if (gap <= 1e-12) direction = wordU > wordV ? 1 : -1;
    else direction = hU > hV ? 1 : -1;
    return q(direction * ZETA * decay * (dEq - gap), HASH_PLACES);
  }

  function spaceDh(hU, hV, marker) {
    const diff = hU - hV;
    const absDelta = marker ? Math.abs(diff) / marker : 0;
    return q(KAPPA * Math.exp(-BETA * absDelta) * diff, HASH_PLACES);
  }

  function stepDrift(deltas) {
    let worst = 0;
    Object.keys(deltas).forEach(function (band) {
      const half = F.voronoiHalf(Number(band)) || 1;
      worst = Math.max(worst, Math.abs(Number(deltas[band])) / half);
    });
    return worst;
  }

  function spreadOf(signatures) {
    const positions = [];
    signatures.forEach(function (sig) {
      (sig.components || []).forEach(function (row) {
        if (row.master) return;
        const half = F.voronoiHalf(row.band) || 1;
        positions.push((row.hz - row.band) / half);
      });
    });
    const n = positions.length;
    if (n < 2) return { n: n, stdev: 0, entropy: 0, calls_llm: false };
    const mean = positions.reduce(function (s, v) { return s + v; }, 0) / n;
    const variance = positions.reduce(function (s, v) { return s + (v - mean) * (v - mean); }, 0) / n;
    const bins = [];
    for (let i = 0; i < 21; i++) bins.push(0);
    positions.forEach(function (item) {
      let x = item;
      if (x < -1) x = -1;
      if (x > 1) x = 1;
      let idx = Math.floor((x + 1) / 2 * 21);
      if (idx < 0) idx = 0;
      if (idx > 20) idx = 20;
      bins[idx] += 1;
    });
    let entropy = 0;
    bins.forEach(function (count) {
      if (!count) return;
      const p = count / n;
      entropy -= p * Math.log2(p);
    });
    return { n: n, stdev: q(Math.sqrt(variance), HASH_PLACES), entropy: q(entropy, HASH_PLACES), calls_llm: false };
  }

  function Field(spacing) {
    this.spacing = spacing !== false;
    this.pulls = [];
    this.conflicts = [];
    this.overrides = {};
    this.tHours = 0;
    this.seq = 0;
  }

  Field.prototype.next = function (kind) {
    this.seq += 1;
    return kind + '-' + String(this.seq).padStart(4, '0');
  };

  Field.prototype.signature = function (word) {
    const key = String(word || '').toLowerCase();
    if (this.overrides[key]) return this.overrides[key];
    return F.wordSignature(key);
  };

  Field.prototype.register = function (word, signature) {
    this.overrides[String(word).toLowerCase()] = signature;
  };

  Field.prototype.offsets = function (word, tHours) {
    const t = tHours == null ? this.tHours : Number(tHours);
    const acc = {};
    this.pulls.forEach(function (pull) {
      if (pull.retracted || !pull.applied) return;
      const slot = (pull.deltas || {})[word];
      if (!slot) return;
      const weight = decayWeight(t - Number(pull.t_hours || 0));
      Object.keys(slot).forEach(function (band) {
        const b = Number(band);
        acc[b] = q((acc[b] || 0) + q(Number(slot[band]) * weight, HASH_PLACES), HASH_PLACES);
      });
    });
    const out = {};
    Object.keys(acc).forEach(function (band) { out[Number(band)] = q(acc[band], HASH_PLACES); });
    return out;
  };

  Field.prototype.tuned = function (word, tHours) {
    const base = this.signature(word);
    const offs = this.offsets(word, tHours);
    const comps = base.components.map(function (row) {
      const nxt = Object.assign({}, row);
      if (row.master) {
        nxt.hz = MASTER_HZ;
        nxt.band = 144;
        nxt.phase_deg = row.phase_deg;
        nxt.master = true;
        return nxt;
      }
      const band = Number(row.band);
      const hz = clampHz(band, Number(row.hz) + Number(offs[band] || 0));
      nxt.hz = hz;
      nxt.nearest = F.nearestBand(hz);
      return nxt;
    });
    const master = comps.filter(function (row) { return row.master; })[0];
    const baseMaster = base.components.filter(function (row) { return row.master; })[0];
    const out = Object.assign({}, base);
    out.word = String(word).toLowerCase();
    out.Phi = Number(base.Phi);
    out.master_degrees = base.master_degrees;
    out.components = comps;
    out.base_hash = base.content_hash;
    out.tuning = '4.9.204';
    out.master_unchanged = master.hz === baseMaster.hz && master.phase_deg === baseMaster.phase_deg && master.phase_deg === base.master_degrees;
    out.calls_llm = false;
    return out;
  };

  Field.prototype.hz = function (word, band, tHours) {
    const sig = this.signature(word);
    for (let i = 0; i < sig.components.length; i++) {
      const row = sig.components[i];
      if (row.master || Number(row.band) !== Number(band)) continue;
      const offs = this.offsets(word, tHours)[Number(band)] || 0;
      return clampHz(Number(band), Number(row.hz) + Number(offs));
    }
    return null;
  };

  Field.prototype.shared = function (left, right) {
    const a = {};
    const b = {};
    this.signature(left).components.forEach(function (row) { if (!row.master) a[row.band] = 1; });
    this.signature(right).components.forEach(function (row) { if (!row.master) b[row.band] = 1; });
    return Object.keys(a).map(Number).filter(function (band) { return b[band]; }).sort(function (x, y) { return x - y; });
  };

  Field.prototype.fiveEight = function (left, right) {
    const pair = {};
    pair[this.signature(left).Phi] = 1;
    pair[this.signature(right).Phi] = 1;
    return pair[5] && pair[8] && Object.keys(pair).length === 2;
  };

  Field.prototype.liveWords = function () {
    const found = {};
    this.pulls.forEach(function (pull) {
      if (pull.retracted || !pull.applied) return;
      Object.keys(pull.deltas || {}).forEach(function (word) {
        if (pull.deltas[word] && Object.keys(pull.deltas[word]).length) found[word] = 1;
      });
    });
    return Object.keys(found).sort();
  };

  Field.prototype.pairView = function (left, right, tHours) {
    const a = this.tuned(left, tHours);
    const b = this.tuned(right, tHours);
    const verdict = F.resonate(a, b);
    const bands = {};
    const rightHz = {};
    b.components.forEach(function (row) { if (!row.master) rightHz[row.band] = row.hz; });
    a.components.forEach(function (row) {
      if (row.master) return;
      if (rightHz[row.band] != null) bands[String(row.band)] = [row.hz, rightHz[row.band]];
    });
    return {
      resonate: !!verdict.resonate, reason: verdict.reason, R: verdict.R, cover: verdict.cover,
      matched: verdict.matched, shorter: verdict.shorter, master_ok: verdict.master_ok,
      phi: [Number(a.Phi), Number(b.Phi)], master_hz: [MASTER_HZ, MASTER_HZ],
      master_deg: [a.master_degrees, b.master_degrees], hz: bands, calls_llm: false
    };
  };

  Field.prototype.standingPairs = function () {
    const rows = [];
    this.conflicts.forEach(function (row) {
      if (row.retracted) return;
      rows.push([row.words[0], row.words[1], String(row.kind)]);
    });
    rows.sort(function (a, b) {
      const as = a.join('\0');
      const bs = b.join('\0');
      return as < bs ? -1 : as > bs ? 1 : 0;
    });
    return rows;
  };

  Field.prototype.accumulate = function (attractPairs, tHours) {
    const self = this;
    const acc = {};
    const attractKeys = {};
    attractPairs.forEach(function (pair) {
      const key = pair.slice().sort().join('\0');
      attractKeys[key] = 1;
    });
    attractPairs.forEach(function (pair) {
      const left = pair[0];
      const right = pair[1];
      if (self.fiveEight(left, right)) return;
      const delta = masterDelta(self.signature(left), self.signature(right));
      self.shared(left, right).forEach(function (band) {
        const hL = self.hz(left, band, tHours);
        const hR = self.hz(right, band, tHours);
        if (hL == null || hR == null) return;
        const gap = Math.abs(hL - hR);
        if (self.spacing && gap <= eqGap(band) + 1e-12) {
          add(acc, left, band, separateDh(hL, hR, band, left, right));
          add(acc, right, band, separateDh(hR, hL, band, right, left));
        } else {
          add(acc, left, band, attractDh(hL, hR, band, delta));
          add(acc, right, band, attractDh(hR, hL, band, delta));
        }
      });
    });
    this.standingPairs().forEach(function (row) {
      const left = row[0];
      const right = row[1];
      self.shared(left, right).forEach(function (band) {
        const hL = self.hz(left, band, tHours);
        const hR = self.hz(right, band, tHours);
        if (hL == null || hR == null) return;
        add(acc, left, band, repelDh(hL, hR, band));
        add(acc, right, band, repelDh(hR, hL, band));
      });
    });
    if (this.spacing) {
      const activeMap = {};
      attractPairs.forEach(function (pair) { activeMap[pair[0]] = 1; activeMap[pair[1]] = 1; });
      this.standingPairs().forEach(function (row) { activeMap[row[0]] = 1; activeMap[row[1]] = 1; });
      const active = Object.keys(activeMap).sort();
      for (let i = 0; i < active.length; i++) {
        for (let j = i + 1; j < active.length; j++) {
          const left = active[i];
          const right = active[j];
          if (attractKeys[[left, right].slice().sort().join('\0')]) continue;
          self.shared(left, right).forEach(function (band) {
            const hL = self.hz(left, band, tHours);
            const hR = self.hz(right, band, tHours);
            if (hL == null || hR == null) return;
            const gap = Math.abs(hL - hR);
            if (gap <= eqGap(band) + 1e-12) {
              add(acc, left, band, separateDh(hL, hR, band, left, right));
              add(acc, right, band, separateDh(hR, hL, band, right, left));
            } else {
              add(acc, left, band, spaceDh(hL, hR, band));
              add(acc, right, band, spaceDh(hR, hL, band));
            }
          });
        }
      }
    }
    return acc;
  };

  Field.prototype.gate = function (spec) {
    if (spec.calls_llm) return { ok: false, applied: false, reason: 'llm', chi: 1, drift: 0 };
    if (wikiBlocked(spec.trust, spec.source)) return { ok: false, applied: false, reason: 'wikipedia', chi: 0, drift: 0 };
    const score = Number(spec.C);
    const echo = Number(spec.echo);
    const drift = Number(spec.drift);
    if (!isFinite(score) || !isFinite(echo) || !isFinite(drift)) return { ok: false, applied: false, reason: 'ungated', chi: 0, drift: 0 };
    if (score < C_MIN - 1e-12) return { ok: false, applied: false, reason: 'C', chi: 0, drift: q(drift, HASH_PLACES) };
    if (echo < ECHO_MIN - 1e-12) return { ok: false, applied: false, reason: 'echo', chi: 0, drift: q(drift, HASH_PLACES) };
    if (drift >= HARD_STOP - 1e-12) return { ok: false, applied: false, reason: 'hard-stop', chi: 1, drift: q(drift, HASH_PLACES) };
    if (drift > WRITE_MAX + 1e-12) return { ok: false, applied: false, reason: 'quarantine', chi: 1, drift: q(drift, HASH_PLACES) };
    return null;
  };

  function blockedOut(blocked, admitId, words) {
    return {
      ok: blocked.ok, applied: false, reason: blocked.reason, chi: blocked.chi, drift: blocked.drift,
      id: admitId, words: words, master_unchanged: true, deltas: {}, calls_llm: false, capped: false,
      raw_drift: blocked.drift
    };
  }

  Field.prototype.commit = function (acc, meta) {
    let rawDrift = 0;
    Object.keys(acc).forEach(function (word) { rawDrift = Math.max(rawDrift, stepDrift(acc[word])); });
    rawDrift = q(rawDrift, HASH_PLACES);
    let chi = 0;
    let capped = false;
    let scale = 1;
    let reason = String(meta.reason || 'tune');
    if (rawDrift >= HARD_STOP - 1e-12) {
      scale = 0; chi = 1; reason = 'hard-stop';
    } else if (rawDrift > WRITE_MAX + 1e-12) {
      scale = q(WRITE_MAX / rawDrift, HASH_PLACES);
      chi = 1; capped = true; reason = 'capped';
    }
    const deltas = {};
    Object.keys(acc).sort().forEach(function (word) {
      const slot = {};
      Object.keys(acc[word]).map(Number).sort(function (a, b) { return a - b; }).forEach(function (band) {
        const applied = q(acc[word][band] * scale, HASH_PLACES);
        if (applied === 0) return;
        slot[String(band)] = applied;
      });
      if (Object.keys(slot).length) deltas[word] = slot;
    });
    let applied = Object.keys(deltas).length > 0 && scale !== 0;
    if (scale === 0) applied = false;
    const phi = {};
    const self = this;
    Object.keys(deltas).sort().forEach(function (word) { phi[word] = Number(self.signature(word).Phi); });
    const pull = {
      id: this.next('pull'), admit_id: meta.admit_id, kind: meta.kind || 'tune',
      words: (meta.words || []).slice(), t_hours: q(Number(meta.t_hours || 0), HASH_PLACES),
      applied: applied, chi: chi, capped: capped,
      drift: scale === 0 ? rawDrift : q(rawDrift * scale, HASH_PLACES),
      raw_drift: rawDrift, reason: reason, deltas: deltas, phi: phi,
      master_unchanged: true, C: meta.C, echo: meta.echo, write_drift: meta.write_drift,
      trust: meta.trust || '', retracted: false, calls_llm: false
    };
    this.pulls.push(pull);
    let mastersOk = true;
    Object.keys(pull.phi).forEach(function (word) {
      if (!self.tuned(word).master_unchanged) mastersOk = false;
    });
    pull.master_unchanged = mastersOk;
    const bad = { 'hard-stop': 1, 'phase-6 membrane': 1, llm: 1, wikipedia: 1, C: 1, echo: 1, quarantine: 1, '5→8': 1 };
    return {
      ok: !bad[reason], applied: applied, reason: reason, chi: chi, capped: capped,
      drift: pull.drift, raw_drift: rawDrift, deltas: deltas, pull_id: pull.id,
      master_unchanged: pull.master_unchanged, calls_llm: false
    };
  };

  Field.prototype.fileConflict = function (kind, words, admitId) {
    const pair = words.map(function (w) { return String(w).toLowerCase(); }).sort();
    if (pair.length !== 2 || pair[0] === pair[1]) return;
    for (let i = 0; i < this.conflicts.length; i++) {
      const row = this.conflicts[i];
      if (row.retracted) continue;
      if (row.kind === kind && row.words[0] === pair[0] && row.words[1] === pair[1]) return;
    }
    this.conflicts.push({
      id: this.next('conflict'), kind: kind, words: pair, admit_id: admitId, retracted: false, calls_llm: false
    });
  };

  Field.prototype.admit = function (spec) {
    const admitId = String(spec.id || spec.admit_id || this.next('admit'));
    const tHours = spec.t_hours == null ? this.tHours : Number(spec.t_hours);
    this.tHours = tHours;
    const blocked = this.gate(spec);
    const phase = spec.phase == null ? MEMBRANE_PHASE : Number(spec.phase);
    const words = contentWords(spec.text || '', spec.words);
    if (blocked) return blockedOut(blocked, admitId, words);
    if (phase !== MEMBRANE_PHASE) {
      for (let i = 0; i < words.length; i++) {
        for (let j = i + 1; j < words.length; j++) this.fileConflict('membrane', [words[i], words[j]], admitId);
      }
      return {
        ok: false, applied: false, reason: 'phase-6 membrane', chi: 0, drift: 0, raw_drift: 0,
        id: admitId, words: words, deltas: {}, capped: false, master_unchanged: true, calls_llm: false
      };
    }
    const attractPairs = [];
    for (let i = 0; i < words.length; i++) {
      for (let j = i + 1; j < words.length; j++) {
        if (this.fiveEight(words[i], words[j])) {
          this.fileConflict('five-eight', [words[i], words[j]], admitId);
          continue;
        }
        attractPairs.push([words[i], words[j]]);
      }
    }
    attractPairs.sort(function (a, b) {
      const as = a.join('\0');
      const bs = b.join('\0');
      return as < bs ? -1 : as > bs ? 1 : 0;
    });
    const acc = this.accumulate(attractPairs, tHours);
    const result = this.commit(acc, {
      admit_id: admitId, kind: attractPairs.length ? 'attract' : 'tune',
      reason: attractPairs.length ? 'attract' : 'tune', words: words, t_hours: tHours,
      C: q(Number(spec.C), HASH_PLACES), echo: q(Number(spec.echo), HASH_PLACES),
      write_drift: q(Number(spec.drift), HASH_PLACES), trust: spec.trust || ''
    });
    result.id = admitId;
    result.words = words;
    return result;
  };

  Field.prototype.refute = function (spec) {
    const blocked = this.gate(spec);
    const admitId = String(spec.id || this.next('refute'));
    const words = contentWords(spec.text || '', spec.words);
    if (blocked) return blockedOut(blocked, admitId, words);
    const phase = spec.phase == null ? MEMBRANE_PHASE : Number(spec.phase);
    const tHours = spec.t_hours == null ? this.tHours : Number(spec.t_hours);
    this.tHours = tHours;
    if (phase !== MEMBRANE_PHASE) {
      for (let i = 0; i < words.length; i++) {
        for (let j = i + 1; j < words.length; j++) this.fileConflict('membrane', [words[i], words[j]], admitId);
      }
      return {
        ok: false, applied: false, reason: 'phase-6 membrane', chi: 0, drift: 0, id: admitId,
        words: words, deltas: {}, master_unchanged: true, calls_llm: false, capped: false, raw_drift: 0
      };
    }
    for (let i = 0; i < words.length; i++) {
      for (let j = i + 1; j < words.length; j++) this.fileConflict('refute', [words[i], words[j]], admitId);
    }
    const acc = this.accumulate([], tHours);
    const result = this.commit(acc, {
      admit_id: admitId, kind: 'repel', reason: 'repel', words: words, t_hours: tHours,
      C: q(Number(spec.C), HASH_PLACES), echo: q(Number(spec.echo), HASH_PLACES),
      write_drift: q(Number(spec.drift), HASH_PLACES), trust: spec.trust || ''
    });
    result.id = admitId;
    result.words = words;
    return result;
  };

  Field.prototype.tick = function (spec) {
    spec = spec || {};
    const phase = spec.phase == null ? MEMBRANE_PHASE : Number(spec.phase);
    const admitId = String(spec.id || this.next('tick'));
    const tHours = spec.t_hours == null ? this.tHours : Number(spec.t_hours);
    this.tHours = tHours;
    if (phase !== MEMBRANE_PHASE) {
      return {
        ok: false, applied: false, reason: 'phase-6 membrane', chi: 0, drift: 0, id: admitId,
        words: [], deltas: {}, master_unchanged: true, calls_llm: false, capped: false, raw_drift: 0
      };
    }
    const acc = this.accumulate([], tHours);
    const result = this.commit(acc, {
      admit_id: admitId, kind: 'tick', reason: 'tick', words: this.liveWords(), t_hours: tHours,
      C: null, echo: null, write_drift: null, trust: ''
    });
    result.id = admitId;
    result.words = this.liveWords();
    return result;
  };

  Field.prototype.retract = function (admitId) {
    const key = String(admitId);
    let hit = 0;
    this.pulls.forEach(function (pull) {
      if (pull.admit_id === key && !pull.retracted) { pull.retracted = true; hit += 1; }
    });
    this.conflicts.forEach(function (row) {
      if (row.admit_id === key && !row.retracted) { row.retracted = true; hit += 1; }
    });
    return { ok: true, applied: false, reason: 'retract', id: key, retracted: hit, master_unchanged: true, calls_llm: false, chi: 0 };
  };

  Field.prototype.attemptPhi = function (word, newPhi) {
    const old = Number(this.signature(word).Phi);
    const nxt = Number(newPhi);
    const forbidden = old === 5 && nxt === 8;
    return {
      ok: !forbidden, applied: false, reason: forbidden ? '5→8' : 'refused',
      word: String(word).toLowerCase(), phi_before: old, phi_after: old, requested: nxt,
      master_unchanged: true, calls_llm: false, chi: forbidden ? 1 : 0
    };
  };

  function relatedBlock(field) {
    const out = {};
    WATCH.forEach(function (pair) { out[pair[0] + '/' + pair[1]] = field.pairView(pair[0], pair[1]); });
    return out;
  }

  function script(steps, spacing) {
    const field = new Field(spacing !== false);
    const trace = [];
    (steps || []).forEach(function (spec) {
      const op = String(spec.op || 'admit');
      let result;
      if (op === 'admit') result = field.admit(spec);
      else if (op === 'refute') result = field.refute(spec);
      else if (op === 'tick') result = field.tick(spec);
      else if (op === 'retract') result = field.retract(String(spec.id || ''));
      else if (op === 'phi') result = field.attemptPhi(String(spec.word || ''), Number(spec.phi || 0));
      else if (op === 'spread') {
        const words = contentWords('', spec.words);
        result = spreadOf(words.map(function (word) { return field.tuned(word); }));
        result.reason = 'spread';
        result.ok = true;
      } else result = { ok: false, reason: 'op', calls_llm: false };
      result.related = relatedBlock(field);
      trace.push(result);
    });
    return {
      op: 'script', steps: trace, pulls: field.pulls.length, conflicts: field.conflicts.length,
      t_hours: field.tHours, calls_llm: false, proposal: PROPOSAL
    };
  }

  function run(payload) {
    const row = payload || {};
    const op = String(row.op || 'flags');
    if (op === 'flags') return flags();
    if (op === 'config') {
      return {
        zeta: ZETA, beta: BETA, sever: SEVER, kappa: KAPPA, eq_fraction: EQ_FRACTION,
        half_life_hours: HALF_LIFE_HOURS, membrane_phase: MEMBRANE_PHASE, epsilon: F.EPSILON,
        proposal: PROPOSAL, cite: CITE, calls_llm: false, hooks_match: true
      };
    }
    if (op === 'script') return script(row.steps || [], row.spacing !== false);
    if (op === 'content') return { words: contentWords(String(row.text || '')), calls_llm: false };
    return { op: op, ok: false, calls_llm: false };
  }

  function lawful(extra) {
    const row = { C: 0.9, echo: 1, drift: 0.05, phase: 6, trust: 'local', calls_llm: false };
    Object.keys(extra || {}).forEach(function (key) { row[key] = extra[key]; });
    return row;
  }

  function lineHz(view) {
    const bands = Object.keys(view.hz).sort(function (a, b) { return Number(a) - Number(b); });
    return bands.map(function (band) {
      return band + ' Hz ' + view.hz[band][0].toFixed(2) + ' / ' + view.hz[band][1].toFixed(2);
    }).join(' · ');
  }

  function paint(mode) {
    if (typeof document === 'undefined') return;
    const card = document.getElementById('freq204');
    const host = document.getElementById('freq204Body');
    if (!card || !host) return;
    const lines = [];
    const field = new Field(true);
    if (mode === 'sun-light') {
      for (let i = 0; i < 12; i++) field.admit(lawful({ id: 'sun-light-' + i, words: ['sun', 'light'], t_hours: i }));
      const view = field.pairView('sun', 'light');
      lines.push('12 lawful admits of sun with light');
      lines.push('resonate ' + view.resonate + ' · cover ' + view.cover + ' · ' + view.reason);
      lines.push(lineHz(view));
      lines.push('Φ stays ' + view.phi.join(' / ') + ' · master ' + view.master_deg.join('° / ') + '° · 144 Hz untouched');
      lines.push('The 72 Hz pair moves inside ε. The 1296 Hz carrier on sun has no partner on light, so the three-part test stays false.');
    } else if (mode === 'sun-hot') {
      for (let i = 0; i < 8; i++) field.admit(lawful({ id: 'w' + i, words: ['sun', 'hot'], t_hours: i }));
      const view = field.pairView('sun', 'hot');
      lines.push('8 lawful admits of sun with hot');
      lines.push('resonate ' + view.resonate + ' · cover ' + view.cover + ' · R ' + view.R);
      lines.push(lineHz(view));
      lines.push('Φ stays ' + view.phi.join(' / ') + '. They already shared a packet. Tuning keeps them inside ε.');
    } else if (mode === 'unrelated') {
      field.admit(lawful({ id: 'u', words: ['sun', 'dog', 'light', 'quartz'] }));
      [['sun', 'dog'], ['light', 'quartz'], ['sun', 'light']].forEach(function (pair) {
        const view = field.pairView(pair[0], pair[1]);
        lines.push(pair[0] + ' / ' + pair[1] + ' resonate ' + view.resonate + ' · ' + view.reason + ' · Φ ' + view.phi.join('/'));
      });
      lines.push('sun/dog and light/quartz stay apart. Their master phases are outside π/4, and tuning does not move Φ.');
    } else if (mode === 'retract') {
      field.admit(lawful({ id: 'only', words: ['sun', 'light'] }));
      const moved = field.pairView('sun', 'light');
      field.retract('only');
      const back = field.pairView('sun', 'light');
      lines.push('after the admit · ' + lineHz(moved));
      lines.push('after retract · ' + lineHz(back));
      lines.push('The offset is gone. The admit id is the provenance, and retract drops that pull.');
    } else if (mode === 'decay') {
      field.admit(lawful({ id: 'd', words: ['sun', 'light'], t_hours: 0 }));
      const fresh = field.pairView('sun', 'light', 0);
      const aged = field.pairView('sun', 'light', 168);
      lines.push('t = 0 · ' + lineHz(fresh));
      lines.push('t = 168 h · ' + lineHz(aged));
      lines.push('SPC half-life is 168 h. The learned pull is half as strong. Glyph Φ is unchanged.');
    } else if (mode === 'membrane') {
      const blocked = field.admit(lawful({ id: 'bad', words: ['sun', 'light'], phase: 7 }));
      lines.push('phase 7 admit · ' + blocked.reason + ' · applied ' + blocked.applied);
      const later = field.tick({ id: 't', phase: 6, t_hours: 1 });
      lines.push('next phase-6 tick · ' + later.reason + ' · drift ' + later.drift);
      lines.push(lineHz(field.pairView('sun', 'light')));
      lines.push('A tick outside phase 6 writes nothing and files a repulsion.');
    } else if (mode === 'ban') {
      const banned = field.attemptPhi('heat', 8);
      lines.push('heat Φ' + banned.phi_before + ' → Φ' + banned.requested + ' · ' + banned.reason + ' · Φ stays ' + banned.phi_after);
      const row = field.admit(lawful({ id: '58', words: ['heat', 'photon'] }));
      lines.push('admit heat with photon · ' + row.reason + ' · Φ ' + field.pairView('heat', 'photon').phi.join(' / '));
      lines.push('Φ5→Φ8 is refused. The pair repels on hertz only.');
    } else if (mode === 'chart') {
      const proof = root.FREQUENCY_204_PROOF;
      if (!proof || !proof.lexicon) {
        lines.push('Collision proof is not loaded.');
      } else {
        lines.push('419 seeds before ' + proof.lexicon.before_rate + ' · after ' + proof.lexicon.after_rate);
        (proof.synthetic || []).forEach(function (row) {
          lines.push(row.n + ' before ' + row.before_rate + ' · after ' + row.after_rate);
        });
        if (proof.collapse) {
          lines.push('spacing stdev ' + proof.collapse.with_spacing.after_stdev + ' · without ' + proof.collapse.without_spacing.after_stdev);
        }
      }
    } else {
      lines.push('Tuning is off until a lawful phase-6 admit.');
      lines.push('C ≥ 0.87 · Echo ≥ 0.85 · drift ≤ 0.35 · hard stop 0.8');
    }
    lines.push('No LLM. Master phase is not moved.');
    card.setAttribute('data-freq204-mode', mode || 'sun-light');
    host.textContent = lines.join('\n');
    paintChart(root.FREQUENCY_204_PROOF);
  }

  function paintChart(proof) {
    const chart = document.getElementById('freq204Chart');
    if (!chart || !proof) return;
    const rows = [];
    if (proof.lexicon) {
      rows.push(['419 before', proof.lexicon.before_rate]);
      rows.push(['419 after', proof.lexicon.after_rate]);
    }
    (proof.synthetic || []).forEach(function (row) {
      rows.push([row.n + ' before', row.before_rate]);
      rows.push([row.n + ' after', row.after_rate]);
    });
    if (!rows.length) return;
    const max = rows.reduce(function (m, row) { return Math.max(m, row[1]); }, 0.01);
    chart.innerHTML = rows.map(function (row) {
      const width = Math.max(2, Math.round(100 * row[1] / max));
      const tone = /after/.test(row[0]) ? '#e0a45a' : '#7dcea0';
      return '<div class="freq-row" style="margin:4px 0"><span style="display:inline-block;width:11em">' + row[0] + '</span><span style="display:inline-block;width:6em">' + row[1] + '</span><span style="display:inline-block;width:46%;height:12px;background:#0a1320;vertical-align:middle"><i style="display:block;height:12px;width:' + width + '%;background:' + tone + '"></i></span></div>';
    }).join('');
  }

  function boot() {
    if (typeof document === 'undefined' || !document.getElementById('freq204')) return;
    const start = function () {
      paint('sun-light');
      const buttons = document.querySelectorAll('[data-freq204-run]');
      for (let i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener('click', function (ev) {
          paint(ev.currentTarget.getAttribute('data-freq204-run'));
        });
      }
    };
    if (typeof fetch !== 'function') { start(); return; }
    fetch('data/frequency_204_proof.json').then(function (res) { return res.ok ? res.json() : null; }).then(function (proof) {
      root.FREQUENCY_204_PROOF = proof;
      start();
    }).catch(function () { start(); });
  }

  const api = {
    flags: flags, Field: Field, run: run, script: script, contentWords: contentWords,
    spreadOf: spreadOf, paint: paint, boot: boot, CITE: CITE, ZETA: ZETA, BETA: BETA
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Frequency204 = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
