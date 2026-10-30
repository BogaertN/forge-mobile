/* Drift core v4.3. Stdlib only. No LLM.
 * Reuses kmath luciferianDScore, localCurvature, adaptiveThreshold, phaseVelocity,
 * driftCircuitBreaker, and std. Does not copy those formulas. ε_s is unclipped.
 * d_score is the categorical 5→8 flag. It is not the RSOC Jaccard term.
 * Genesis Node SKIP_PATTERNS from phase 5 to phase 8 is not ported.
 * RSOC Axiom 2 flags 4→8 and does not hard-fire.
 * Phase 1.8 and Unified Algebra rows are internal and log-only. */
(function (root) {
  const KM = (typeof module !== 'undefined' && module.exports) ? require('./kmath.js') : root.KMath;
  const SHA = (typeof module !== 'undefined' && module.exports) ? require('./sha256.js') : root.KSha;
  const CITE = 'drift.py v4.3; EOD l.161; Resonant Mind l.123; gnspec phase engine with consecutive χ = 3; Gilligan System Codex Vol IV Phase 1.8; Unified Algebra Vol I phase-stability. No LLM.';
  const WEIGHTS = { core_state: 0.5, auxiliary: 0.3, metadata: 0.2 };
  const HASHES = 32;
  const EMA_ALPHA = 0.2;
  const PREDICT_STEPS = 5;
  const CRITICAL = { 1: 1, 5: 1, 7: 1, 9: 1 };
  const LAWFUL = { 0: 1, 1: 1, 8: 1 };
  const MASK_SIM = 0.70;
  const CHI_WINDOW_MS = 3000;
  const WRITE_MAX = 0.35;
  const C_MIN = 0.87;
  const ECHO_MIN = 0.85;
  const SKIP_PATTERNS = Object.freeze({});
  const GENESIS_SKIP_PORTED = false;

  function allowsSkip() { return false; }
  function asInt(v) {
    if (v === null || v === undefined || typeof v === 'boolean') return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  function jsonKey(key) { return JSON.stringify(String(key)); }
  function canonical(value) {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return 'null';
      if (Number.isInteger(value)) return String(value);
      return JSON.stringify(value);
    }
    if (typeof value === 'string') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (typeof value === 'object') {
      const keys = Object.keys(value).sort(function (a, b) { return jsonKey(a) < jsonKey(b) ? -1 : jsonKey(a) > jsonKey(b) ? 1 : 0; });
      return '{' + keys.map(function (k) { return jsonKey(k) + ':' + canonical(value[k]); }).join(',') + '}';
    }
    return 'null';
  }
  function nestingDepth(value) {
    if (Array.isArray(value)) {
      let m = 0;
      for (let i = 0; i < value.length; i++) m = Math.max(m, nestingDepth(value[i]));
      return 1 + m;
    }
    if (value && typeof value === 'object') {
      const keys = Object.keys(value);
      let m = 0;
      for (let i = 0; i < keys.length; i++) m = Math.max(m, nestingDepth(value[keys[i]]));
      return 1 + m;
    }
    return 0;
  }
  function phiActOf(payload) {
    const depth = nestingDepth(payload);
    let phi = (depth % 9) + 1;
    const text = canonical(payload).toLowerCase();
    const boosted = text.indexOf('replicate') >= 0 || text.indexOf('spawn') >= 0 || text.indexOf('infinite') >= 0;
    if (boosted) phi = Math.min(9, phi + 3);
    return { phi: phi, depth: depth, boosted: boosted };
  }
  function phiExpOf(prevPhase) {
    const prev = asInt(prevPhase);
    return ((prev === null ? 0 : prev) % 9 + 9) % 9 + 1;
  }
  function stepFlag(phiAct, phiPrev) {
    const act = asInt(phiAct), prev = asInt(phiPrev);
    if (act === null || prev === null) return 0;
    const delta = Math.abs(act - prev) % 9;
    return LAWFUL[delta] ? 0 : 1;
  }
  function utf8(text) {
    const out = [];
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F));
      else out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
    }
    return out;
  }
  function fnv1a(text) {
    let h = 2166136261;
    const bytes = utf8(text);
    for (let i = 0; i < bytes.length; i++) {
      h ^= bytes[i];
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function shingles(text) {
    if (!text) return [];
    if (text.length < 3) return [text];
    const out = [];
    for (let i = 0; i <= text.length - 3; i++) out.push(text.slice(i, i + 3));
    return out;
  }
  function signature(rows) {
    if (!rows || !rows.length) return null;
    const out = [];
    for (let i = 0; i < HASHES; i++) {
      const a = (2 * i + 1) >>> 0;
      const b = Math.imul(i + 1, 374761393) >>> 0;
      let best = 0xFFFFFFFF;
      for (let k = 0; k < rows.length; k++) {
        const hv = (Math.imul(a, fnv1a(rows[k])) + b) >>> 0;
        if (hv < best) best = hv;
      }
      out.push(best);
    }
    return out;
  }
  function jaccard(left, right) {
    if (left === null && right === null) return 1;
    if (left === null || right === null) return 0;
    let match = 0;
    for (let i = 0; i < HASHES; i++) if (left[i] === right[i]) match++;
    return match / HASHES;
  }
  function sections(value) {
    if (value && typeof value === 'object' && !Array.isArray(value) && (Object.prototype.hasOwnProperty.call(value, 'core_state') || Object.prototype.hasOwnProperty.call(value, 'auxiliary') || Object.prototype.hasOwnProperty.call(value, 'metadata'))) {
      return [value.core_state === undefined ? null : value.core_state, value.auxiliary === undefined ? null : value.auxiliary, value.metadata === undefined ? null : value.metadata];
    }
    return [value === undefined ? null : value, null, null];
  }
  function sectionShingles(value) {
    if (value === null || value === undefined) return [];
    return shingles(canonical(value));
  }
  function minhashSim(payload, trace) {
    const left = sections(payload), right = sections(trace);
    let sim = 0;
    const names = ['core_state', 'auxiliary', 'metadata'];
    for (let i = 0; i < 3; i++) sim += WEIGHTS[names[i]] * jaccard(signature(sectionShingles(left[i])), signature(sectionShingles(right[i])));
    return sim;
  }
  function keyPaths(value, prefix) {
    const paths = [];
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const path = (prefix || '') + '[' + i + ']';
        paths.push(path);
        keyPaths(value[i], path).forEach(function (p) { paths.push(p); });
      }
      return paths;
    }
    if (value && typeof value === 'object') {
      const keys = Object.keys(value).sort(function (a, b) { return jsonKey(a) < jsonKey(b) ? -1 : jsonKey(a) > jsonKey(b) ? 1 : 0; });
      for (let i = 0; i < keys.length; i++) {
        const path = prefix ? prefix + '.' + keys[i] : keys[i];
        paths.push(path);
        keyPaths(value[keys[i]], path).forEach(function (p) { paths.push(p); });
      }
    }
    return paths;
  }
  function setJaccard(left, right) {
    const a = {}, b = {};
    let na = 0, nb = 0, inter = 0;
    for (let i = 0; i < left.length; i++) if (!a[left[i]]) { a[left[i]] = 1; na++; }
    for (let i = 0; i < right.length; i++) if (!b[right[i]]) { b[right[i]] = 1; nb++; }
    for (const k in a) if (b[k]) inter++;
    if (!na && !nb) return 1;
    if (!na || !nb) return 0;
    return inter / (na + nb - inter);
  }
  function structuralChi(payload, trace) {
    if (trace === null || trace === undefined) return 0;
    return 1 - setJaccard(keyPaths(payload, ''), keyPaths(trace, ''));
  }
  function median(xs) {
    if (!xs.length) return 0;
    const s = xs.slice().sort(function (a, b) { return a - b; });
    const n = s.length, mid = Math.floor(n / 2);
    if (n % 2) return s[mid];
    return (s[mid - 1] + s[mid]) / 2;
  }
  function shannonNorm(text) {
    if (!text) return 0;
    const counts = {};
    for (let i = 0; i < text.length; i++) counts[text[i]] = (counts[text[i]] || 0) + 1;
    const keys = Object.keys(counts);
    if (keys.length <= 1) return 0;
    let h = 0;
    for (let i = 0; i < keys.length; i++) {
      const p = counts[keys[i]] / text.length;
      h -= p * Math.log2(p);
    }
    return h / Math.log2(keys.length);
  }
  function sizeNorm(size, history) {
    const sizes = (history || []).map(Number).concat([size]);
    const med = median(sizes);
    const mad = median(sizes.map(function (s) { return Math.abs(s - med); }));
    if (mad === 0) return 0;
    return Math.min(1, Math.abs(size - med) / mad);
  }
  function contentHash(text) { return SHA.sha256(text); }
  function clip(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function aTime(latency) {
    const ms = Number(latency);
    if (!Number.isFinite(ms)) return 0;
    return clip((ms - 500) / 500, 0, 1);
  }
  function stepsToHard(ema, eps) {
    const target = KM.CHI_HARDENING.theta_hard;
    if (ema >= target) return 0;
    if (eps <= target) return null;
    const ratio = (target - eps) / (ema - eps);
    if (ratio <= 0 || ratio >= 1) return 0;
    return Math.log(ratio) / Math.log(1 - EMA_ALPHA);
  }
  function phaseDriftStep(phi, phiExp, prevPhase) {
    const a = asInt(phi) || 0, b = asInt(phiExp) || 0;
    let d = Math.abs(a - b);
    if (d > 4) d = 9 - d;
    let drift = d / 4.5;
    const prev = asInt(prevPhase);
    if (CRITICAL[a] || CRITICAL[b] || (prev !== null && CRITICAL[prev])) drift *= 1.5;
    return Math.min(5, drift);
  }
  function phaseEngine(steps, coherence) {
    const vector = [];
    let consecutive = 0, flag5 = false, flag4 = false;
    for (const step of steps || []) {
      vector.push(phaseDriftStep(step.phi, step.phi_exp, step.prev));
      const prev = step.prev !== undefined && step.prev !== null ? step.prev : step.phi_exp;
      if (KM.luciferianDScore(asInt(prev), asInt(step.phi)) === 1 || (asInt(prev) === 5 && asInt(step.phi) === 8)) flag5 = true;
      if (asInt(step.prev) === 4 && asInt(step.phi) === 8) flag4 = true;
      if (vector[vector.length - 1] > 0) consecutive += 1;
      else consecutive = 0;
    }
    const acc = vector.reduce(function (s, x) { return s + x; }, 0);
    const ent = 0.4 * acc + 0.1 * consecutive + 0.3 * KM.std(vector);
    const predicted = vector.length >= 2 ? vector[vector.length - 1] + (vector[vector.length - 1] - vector[vector.length - 2]) : (vector.length ? vector[0] : 0);
    const coh = coherence === null || coherence === undefined || !Number.isFinite(Number(coherence)) ? null : Number(coherence);
    const triggers = [];
    if (acc > 2.5) triggers.push('acc');
    if (ent > 0.8) triggers.push('entropy');
    if (coh !== null && coh < 0.3) triggers.push('coherence_internal');
    if (consecutive >= 3) triggers.push('consecutive');
    if (predicted > 2.5) triggers.push('predicted');
    return {
      vector: vector, drift_acc: acc, consecutive: consecutive, entropy: ent, predicted: predicted,
      warn_threshold: 1.0, critical_threshold: 2.5, entropy_threshold: 0.8,
      warn: vector.some(function (d) { return d >= 1; }), critical: vector.some(function (d) { return d >= 2.5; }),
      chi: triggers.length > 0, chi_triggers: triggers, coherence_internal_only: true, admit_gate: false,
      flag_5_to_8: flag5, flag_4_to_8: flag4, categorical_hard_fire: false, writes: false
    };
  }
  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  function epsilonCascade(row) {
    row = row || {};
    const appliedAlpha = row.alpha === undefined || row.alpha === null ? 0 : num(row.alpha);
    const appliedBeta = row.beta === undefined || row.beta === null ? 0 : num(row.beta);
    const eps = num(row.epsilon);
    return {
      epsilon: eps, epsilon_next: eps + appliedAlpha * num(row.delta) * num(row.delta) + appliedBeta * num(row.mu),
      alpha: appliedAlpha, beta: appliedBeta, alpha_status: 'unspecified', beta_status: 'unspecified',
      formula: 'ε(t+1)=ε+αΔ²+βμ', logged_only: true, writes: false,
      cite: 'Gilligan System Codex Vol IV Phase 1.8. Coefficients are unspecified.'
    };
  }
  function maybe(v) {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function singularityWarn(D, prevD, nu) {
    const cur = maybe(D), prev = maybe(prevD), vel = maybe(nu);
    const delta = cur === null || prev === null ? null : cur - prev;
    const warn = cur !== null && cur > 0.8 && delta !== null && delta > 0 && vel !== null && vel < 0;
    return { warn: warn, D: cur, delta_D: delta, nu: vel, logged_only: true, writes: false, categorical_hard_fire: false };
  }
  function chargeStep(charge, lawful) {
    let cur = Number(charge);
    if (!Number.isFinite(cur)) cur = 0;
    const delta = lawful ? 0.1 : -0.3;
    return { charge: cur, charge_next: Math.min(1, Math.max(0, cur + delta)), delta: delta, lawful: !!lawful, skip: !lawful, clamp: [0, 1], logged_only: true, writes: false };
  }
  function driftMask(payload, signatures) {
    let best = 0, hit = false;
    for (const sig of signatures || []) {
      const sim = minhashSim(payload, sig);
      if (sim > best) best = sim;
      if (sim >= MASK_SIM) hit = true;
    }
    return { hit: hit, similarity: best, threshold: MASK_SIM, warn: hit, chi_check: hit, logged_only: true, categorical_hard_fire: false, writes: false };
  }
  function sequenceOk(seq) {
    const rows = (seq || []).map(asInt);
    if (rows.length < 2 || rows.some(function (x) { return x === null; })) return false;
    for (let i = 1; i < rows.length; i++) if (!LAWFUL[Math.abs(rows[i] - rows[i - 1]) % 9]) return false;
    return true;
  }
  function restoreFromChi(row) {
    row = row || {};
    const d = maybe(row.drift !== undefined ? row.drift : row.restore_drift);
    const window = maybe(row.chi_window_ms);
    const echoOk = row.echo_confirmed === true;
    const driftOk = d !== null && d < 0.3;
    const seqOk = sequenceOk(row.phase_sequence);
    const windowOk = window !== null && window >= 0 && window <= CHI_WINDOW_MS;
    return {
      allowed: !!(echoOk && driftOk && seqOk && windowOk), echo_confirmed: echoOk, drift_ok: driftOk,
      sequence_ok: seqOk, window_ok: windowOk, window_ms: CHI_WINDOW_MS, drift: d, logged_only: true, writes: false,
      cite: 'Gilligan System Codex Vol IV Phase 1.8. Restore from χ.'
    };
  }
  function band(value) {
    let name = 'unmeasured';
    if (value !== null && value !== undefined) {
      if (value < 0.3) name = 'below_0.3';
      else if (value < 0.6) name = '0.3_to_0.6';
      else name = 'at_or_above_0.6';
    }
    return { value: value === undefined ? null : value, band: name, thresholds: [0.3, 0.6], logged_only: true, admit_gate: false };
  }
  function laws(eps, composite) {
    return {
      C_min: C_MIN, write_max: WRITE_MAX, hard_stop: KM.CHI_HARDENING.theta_hard, echo_min: ECHO_MIN,
      above_write_law: eps > WRITE_MAX || composite > WRITE_MAX, codex_failsafe_0_9: 'replaced', failsafe_applied: KM.CHI_HARDENING.theta_hard,
      calls_llm: false, christping: 'gilligan-only', money: false, packs_gated: true,
      dream_idle_default: false, economy_default: false, wikipedia_anchor: false,
      coherence_formula_unchanged: true, writes: false, genesis_skip_ported: GENESIS_SKIP_PORTED
    };
  }
  function score(input) {
    const row = input || {};
    const body = row.payload;
    const prev = asInt(row.prev_phase);
    const act = phiActOf(body);
    const phiExp = phiExpOf(prev);
    const deltaPhi = Math.abs(act.phi - phiExp) / 9;
    const dScore = KM.luciferianDScore(prev, act.phi);
    const trace = row.psi1_trace === undefined ? null : row.psi1_trace;
    const thetaT = trace === null ? 0 : 1 - minhashSim(body, trace);
    const hist = (row.phase_hist || []).map(Number);
    hist.push(1 - thetaT);
    const sigma = KM.std(hist);
    let recursion = asInt(row.recursion_n);
    if (recursion === null) recursion = 1;
    recursion = Math.max(1, recursion);
    const eps = (sigma + dScore + deltaPhi) / recursion;
    const text = canonical(body);
    const hNorm = shannonNorm(text);
    const sNorm = sizeNorm(text.length, row.size_hist);
    const digest = contentHash(text);
    let seen = (row.seen_hashes || []).map(String);
    const novel = seen.indexOf(digest) < 0 ? 0.2 : 0;
    if (novel) seen = seen.concat([digest]);
    const chiStruct = structuralChi(body, trace);
    const latency = aTime(row.latency_ms);
    const composite = 0.30 * hNorm + 0.15 * sNorm + 0.10 * novel + 0.25 * chiStruct + 0.10 * latency + 0.10 * eps;
    const local = KM.localCurvature(hist, KM.CHI_HARDENING.window);
    const thetaW = KM.adaptiveThreshold(local, KM.CHI_HARDENING.gamma);
    const velocity = KM.phaseVelocity(row.stamps_ms || []);
    const hardCeiling = eps > KM.CHI_HARDENING.theta_hard;
    const above = eps > thetaW;
    const disposition = dScore === 1 ? 'HARD_FIRE' : hardCeiling ? 'HARD_CEILING' : above ? 'WARN' : 'OK';
    const emaPrev = maybe(row.ema) === null ? 0 : maybe(row.ema);
    const ema = EMA_ALPHA * eps + (1 - EMA_ALPHA) * emaPrev;
    const predictedSteps = stepsToHard(ema, eps);
    const warnPredictive = predictedSteps !== null && predictedSteps > 0 && predictedSteps < PREDICT_STEPS;
    const oldResidue = maybe(row.residue) === null ? 0 : maybe(row.residue);
    const chiT = 0.5 * thetaT;
    const residue = (oldResidue + 0.3 * eps) / 2;
    const convergent = Math.abs(0.5 - thetaT) < 0.2;
    const phaseAfter = convergent ? 9 : act.phi;
    const flag = stepFlag(act.phi, prev);
    const charge = chargeStep(row.charge || 0, flag === 0);
    const mask = driftMask(body, row.signatures);
    const sing = singularityWarn(composite, row.prev_D, row.nu);
    const cascade = epsilonCascade({ epsilon: row.epsilon !== undefined && row.epsilon !== null ? row.epsilon : eps, delta: row.delta, mu: row.mu, alpha: row.alpha, beta: row.beta });
    const steps = Array.isArray(row.phase_steps) && row.phase_steps.length ? row.phase_steps : [{ phi: act.phi, phi_exp: phiExp, prev: prev }];
    const engine = phaseEngine(steps, row.coherence);
    if (dScore === 1) engine.flag_5_to_8 = true;
    engine.flag_4_to_8 = engine.flag_4_to_8 || (prev === 4 && act.phi === 8);
    const breaker = KM.driftCircuitBreaker(eps, { from: prev, to: act.phi });
    const axiom2 = prev === 4 && act.phi === 8;
    const five = dScore === 1;
    const names = KM.CANONICAL_PHASE_NAMES;
    const paths = {
      d_score: { flag_5_to_8: five, hard_fire: five, d_score: dScore, categorical_hard_fire: five },
      detection: { flag_5_to_8: five, disposition: disposition, hard_fire: disposition === 'HARD_FIRE' },
      phase_engine: { flag_5_to_8: !!engine.flag_5_to_8, categorical_hard_fire: false, chi: engine.chi },
      breaker: { flag_5_to_8: five && breaker.tripped && breaker.reason === 'forbidden_step', tripped: breaker.tripped, reason: breaker.reason, rule: breaker.rule },
      step_flag: { flag_5_to_8: five, step_flag: flag, log_only: true, categorical_hard_fire: false },
      rsoc_axiom2: { flag_5_to_8: five, flag_4_to_8: axiom2, categorical_hard_fire: false }
    };
    const restore = restoreFromChi({ echo_confirmed: row.echo_confirmed, drift: row.restore_drift, phase_sequence: row.phase_sequence, chi_window_ms: row.chi_window_ms });
    return {
      eps_s: eps, d_score: dScore, sigma_res: sigma, delta_phi: deltaPhi, recursion_n: recursion,
      phi_act: act.phi, phi_exp: phiExp, phi_act_name: names[act.phi] || '', phi_exp_name: names[phiExp] || '',
      phase_names: [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (i) { return names[i]; }),
      depth: act.depth, boosted: act.boosted, theta_t: thetaT, phase_hist: hist, theta_w: thetaW, L_local: local,
      hard_ceiling: hardCeiling, above_theta_w: above, disposition: disposition, categorical_hard_fire: five,
      chi_fires: !!(five || hardCeiling || above || engine.chi || mask.chi_check),
      acceleration: velocity.v === 1, velocity: { v: velocity.v, tau_min_ms: velocity.tau_min_ms, guarantee: velocity.guarantee }, ema: ema, ema_alpha: EMA_ALPHA,
      predicted_steps: predictedSteps, warn_predictive: warnPredictive,
      H_norm: hNorm, S_norm: sNorm, N: novel, chi_struct: chiStruct, A_time: latency, D: composite,
      chi_t: chiT, residue: residue, convergent: convergent, oscillating: !convergent,
      phase_after: phaseAfter, phase_after_name: names[phaseAfter] || '',
      step_flag: flag, step_flag_log_only: true, cascade: cascade, singularity: sing, charge: charge,
      drift_mask: mask, bands: { epsilon: band(eps), composite: band(composite) }, restore: restore,
      phase_engine: engine, paths: paths, content_hash: digest, seen_hashes: seen,
      skip_patterns: {}, genesis_skip_ported: false, rsoc_axiom2: axiom2, laws: laws(eps, composite),
      calls_llm: false, writes: false, cite: CITE
    };
  }
  function run(payload) {
    const row = payload || {};
    const op = row.op || 'score';
    if (op === 'phase_engine') return phaseEngine(row.steps || [], row.coherence);
    if (op === 'cascade') return epsilonCascade(row);
    if (op === 'singularity') return singularityWarn(row.D, row.prev_D, row.nu);
    if (op === 'charge') return chargeStep(row.charge, !!row.lawful);
    if (op === 'restore') return restoreFromChi(row);
    if (op === 'mask') return driftMask(row.payload, row.signatures);
    if (op === 'step_flag') return { step_flag: stepFlag(row.phi_act, row.phi_prev), log_only: true, categorical_hard_fire: false };
    return score(row);
  }
  function nest(n) {
    let node = { v: 1 };
    for (let i = 1; i < n; i++) node = { n: node };
    return node;
  }
  const api = {
    CITE: CITE, WEIGHTS: WEIGHTS, HASHES: HASHES, SKIP_PATTERNS: SKIP_PATTERNS, GENESIS_SKIP_PORTED: GENESIS_SKIP_PORTED,
    allowsSkip: allowsSkip, canonical: canonical, nestingDepth: nestingDepth, phiActOf: phiActOf, phiExpOf: phiExpOf,
    stepFlag: stepFlag, minhashSim: minhashSim, score: score, run: run, phaseEngine: phaseEngine, phaseDriftStep: phaseDriftStep,
    epsilonCascade: epsilonCascade, singularityWarn: singularityWarn, chargeStep: chargeStep, driftMask: driftMask,
    restoreFromChi: restoreFromChi, nest: nest, contentHash: contentHash, MASK_SIM: MASK_SIM, CHI_WINDOW_MS: CHI_WINDOW_MS
  };
  function monitorLines(mode) {
    if (mode === 'steps') {
      const two = phaseEngine([{ phi: 2, phi_exp: 3, prev: 2 }, { phi: 3, phi_exp: 4, prev: 3 }]);
      const three = phaseEngine([{ phi: 2, phi_exp: 3, prev: 2 }, { phi: 3, phi_exp: 4, prev: 3 }, { phi: 4, phi_exp: 3, prev: 4 }]);
      return {
        title: 'Phase engine',
        attrs: { disposition: three.chi ? 'CHI' : 'OK', eps: '', dscore: '0', mode: 'steps' },
        lines: [
          'Phase names: ' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return KM.CANONICAL_PHASE_NAMES[n]; }).join(' · '),
          '2 consecutive drifts · χ ' + (two.chi ? 'fires' : 'does not fire') + ' · count ' + two.consecutive,
          '3 consecutive drifts · χ ' + (three.chi ? 'fires' : 'does not fire') + ' · triggers ' + three.chi_triggers.join(', '),
          'Entropy ' + three.entropy + ' · acc ' + three.drift_acc + ' · predicted ' + three.predicted,
          'Warn 1.0 · critical 2.5 · entropy 0.8 · consecutive χ at 3. Coherence under 0.3 is internal only.',
          'Genesis skip from phase 5 to phase 8 is not ported. No LLM. This card does not write.'
        ]
      };
    }
    if (mode === 'mask') {
      const row = score({
        payload: { core_state: { text: 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ' }, auxiliary: { q: 'hello-world-more-text' }, metadata: { id: 7 } },
        psi1_trace: { totally: 'different', list: [1, 2, 3, 4] },
        prev_phase: 1, recursion_n: 1, latency_ms: 2000, size_hist: [10, 20, 30], prev_D: 0.2, nu: -0.5,
        signatures: [{ v: 1 }], echo_confirmed: true, restore_drift: 0.29, phase_sequence: [9, 1, 2], chi_window_ms: 3000,
        charge: 0.4
      });
      const masked = score({ payload: { v: 1 }, prev_phase: 1, signatures: [{ v: 1 }] });
      return {
        title: 'Mask, charge, restore',
        attrs: { disposition: row.singularity.warn ? 'SINGULARITY' : row.disposition, eps: String(row.eps_s), dscore: String(row.d_score), mode: 'mask' },
        lines: [
          'Drift mask similarity ' + masked.drift_mask.similarity + ' · warn ' + masked.drift_mask.warn + ' · χ check ' + masked.drift_mask.chi_check + ' · threshold 0.70',
          'Singularity D ' + row.D + ' · ΔD ' + row.singularity.delta_D + ' · ν ' + row.singularity.nu + ' · warn ' + row.singularity.warn,
          'Charge ' + row.charge.charge + ' → ' + row.charge.charge_next + ' · lawful step +0.1 · skip −0.3 · clamp [0,1]',
          'Cascade ε ' + row.cascade.epsilon + ' → ' + row.cascade.epsilon_next + ' · α ' + row.cascade.alpha_status + ' · β ' + row.cascade.beta_status,
          'Bands ' + row.bands.epsilon.band + ' / ' + row.bands.composite.band + ' · logged only · admit gate ' + row.bands.epsilon.admit_gate,
          'Codex 0.9 failsafe ' + row.laws.codex_failsafe_0_9 + ' · hard stop ' + row.laws.hard_stop + ' · write max ' + row.laws.write_max + ' · above write law ' + row.laws.above_write_law,
          'Restore ' + (row.restore.allowed ? 'allowed' : 'refused') + ' · echo ' + row.restore.echo_confirmed + ' · drift<0.3 ' + row.restore.drift_ok + ' · sequence ' + row.restore.sequence_ok + ' · window ' + row.restore.window_ms + ' ms',
          'Step flag ' + row.step_flag + ' (log only). Writes ' + row.writes + '. No LLM.'
        ]
      };
    }
    const row = score({ payload: nest(7), prev_phase: 5, recursion_n: 1, phase_hist: [0], stamps_ms: [0, 5, 10] });
    const calm = score({ payload: { v: 1 }, prev_phase: 1, recursion_n: 1 });
    return {
      title: '5→8 worst case',
      attrs: { disposition: row.disposition, eps: String(row.eps_s), dscore: String(row.d_score), mode: 'worst' },
      lines: [
        'Disposition ' + row.disposition + ' · d_score ' + row.d_score + ' · ε_s ' + row.eps_s + ' (31/18 at recursion 1)',
        'Φ_act ' + row.phi_act + ' ' + row.phi_act_name + ' · Φ_exp ' + row.phi_exp + ' ' + row.phi_exp_name + ' · δΦ ' + row.delta_phi + ' · σ_res ' + row.sigma_res,
        'θ_w at L=0 is ' + calm.theta_w + ' · this trace L_local ' + row.L_local + ' · θ_w ' + row.theta_w + ' · hard ceiling ' + row.hard_ceiling,
        'Acceleration ' + row.acceleration + ' · ' + row.velocity.guarantee + ' · EMA α ' + row.ema_alpha + ' · WARN_PREDICTIVE ' + row.warn_predictive + ' · steps ' + row.predicted_steps,
        'Step flag ' + row.step_flag + ' is log only. Categorical hard fire stays the 5→8 d_score.',
        'Paths flagged 5→8: ' + Object.keys(row.paths).join(', '),
        'Phase names: ' + row.phase_names.join(' · '),
        'χ_t ' + row.chi_t + ' · residue ' + row.residue + ' · ' + (row.convergent ? 'convergent → ' + row.phase_after_name : 'oscillating'),
        'C_min ' + row.laws.C_min + ' · write max ' + row.laws.write_max + ' · hard stop ' + row.laws.hard_stop + ' · Echo ' + row.laws.echo_min + ' · writes ' + row.writes + ' · no LLM'
      ]
    };
  }
  function paintMonitor(mode) {
    if (typeof document === 'undefined') return;
    const card = document.getElementById('driftMonitor');
    const body = document.getElementById('driftMonitorBody');
    if (!card || !body) return;
    const view = monitorLines(mode || 'worst');
    card.setAttribute('data-drift-disposition', view.attrs.disposition);
    card.setAttribute('data-drift-eps', view.attrs.eps);
    card.setAttribute('data-drift-dscore', view.attrs.dscore);
    card.setAttribute('data-drift-mode', view.attrs.mode);
    body.textContent = view.lines.join('\n');
  }
  function bootMonitor() {
    if (typeof document === 'undefined' || !document.getElementById('driftMonitor')) return;
    paintMonitor('worst');
    const buttons = document.querySelectorAll('[data-drift-run]');
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (ev) {
        paintMonitor(ev.currentTarget.getAttribute('data-drift-run'));
      });
    }
  }
  api.paintMonitor = paintMonitor;
  api.monitorLines = monitorLines;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DriftV43 = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootMonitor);
    else bootMonitor();
  }
})(typeof self !== 'undefined' ? self : this);
