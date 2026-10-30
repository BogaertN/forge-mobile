/* 4.9.199 Geometry gates.
 * Phase 6 membrane before naming or export. Closure is Delta-Phi total = 2 pi n.
 * M and V_c are axes. RSOC operator numbers win. Unified Algebra forms are recorded.
 * Calls kmath, the v4.3 laws, and the 4.9.195 seal. Does not copy those formulas.
 * No LLM. */
(function (root) {
  const KM = (typeof module !== 'undefined' && module.exports) ? require('./kmath.js') : root.KMath;
  const V43 = (typeof module !== 'undefined' && module.exports) ? require('./drift_v43.js') : root.DriftV43;
  const Dpa = (typeof module !== 'undefined' && module.exports) ? require('./dpa_195.js') : root.Dpa195;
  const SHA = (typeof module !== 'undefined' && module.exports) ? require('./sha256.js') : root.KSha;
  const Hooks = (typeof module !== 'undefined' && module.exports) ? require('./research_hooks.js') : root.ResearchHooks;
  const LAW = V43.score({ payload: { v: 1 }, prev_phase: 1, recursion_n: 1 }).laws;
  const C_MIN = LAW.C_min;
  const ECHO_MIN = LAW.echo_min;
  const WRITE_MAX = LAW.write_max;
  const HARD_STOP = LAW.hard_stop;
  const TAU = Math.PI * 2;
  const STORAGE_KEY = 'kernel.geometry_199';
  const CITE = 'Geometry gates. Phase 6 membrane before naming or export (Geometry of Mind; manifest compiler phase-6 order). Phase closure total angle 2 pi n (Waking the Web l278). M and V_c (Waking2; UA b l.4322-4389). RSOC operators l.1190-1390. UA forms are recorded and RSOC numbers win (READ_NEW_PDFS section B). Chi precedence RSOC l.1411-1510. SHA-256 stands in for BLAKE3. No LLM.';
  const PRECEDENCE = ['chi', 'archive', 'advance', 'merge', 'lock', 'sever', 'amplify', 'discharge', 'memory', 'echo'];

  function flags() {
    return {
      admit_gate: false, keyword_admit: false, writes: false, calls_llm: false,
      money: false, dream_idle: false, economy: false, packs_gated: true,
      christping: 'gilligan-only', christping_started: false, wikipedia_anchor: false,
      c_min: C_MIN, echo_min: ECHO_MIN, write_max: WRITE_MAX, hard_stop: HARD_STOP,
      resonance_not_parsing: true, rsoc_numbers: true, ua_applied: false,
      coherence_formula_unchanged: true, geometry_build: '4.9.199',
      renderer_build: '4.9.200'
    };
  }

  function r4(x) {
    const n = Number(x);
    if (!Number.isFinite(n)) return 0;
    return Math.floor(n * 10000 + 0.5) / 10000;
  }

  function num(value, fallback) {
    if (typeof value === 'boolean' || value === null || value === undefined || value === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function phaseName(phi) {
    const n = Math.round(Number(phi));
    if (n >= 1 && n <= 9) return KM.CANONICAL_PHASE_NAMES[n];
    return '';
  }

  function angleOf(phi) { return ((Number(phi) - 1) / 9) * TAU; }

  function signed(a, b) {
    let d = b - a;
    d = d % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  }

  function ua(op, form) {
    return {
      op: op, form: form, cite: 'UA Vol I b l.4322-4389',
      numbers: 'RSOC', applied: false, constants_numeric: false, admit_gate: false
    };
  }

  function birth(spec) {
    const row = spec || {};
    const phi = num(row.Phi, 1);
    return {
      Phi: phi, phase_name: phaseName(phi), rho: num(row.rho, 0),
      Delta: num(row.Delta, 0), nu: num(row.nu, 0), mu: num(row.mu, 1),
      eps: num(row.eps, 0), chi: num(row.chi, 0) ? 1 : 0,
      id: String(row.id || ''), H: num(row.H, 1), Phi0: num(row.Phi0, phi),
      lambda: row.lambda === undefined || row.lambda === null ? null : num(row.lambda, 0),
      tau: Array.isArray(row.tau) ? row.tau.slice() : [],
      archived: false
    };
  }

  function copyState(row) {
    const next = birth(row);
    next.tau = (row.tau || []).slice();
    next.archived = !!row.archived;
    next.id = row.id || next.id;
    return next;
  }

  function publicState(row) {
    return {
      Phi: r4(row.Phi), phase_name: phaseName(row.Phi), rho: r4(row.rho),
      Delta: r4(row.Delta), nu: r4(row.nu), mu: r4(row.mu), eps: r4(Math.max(0, row.eps)),
      chi: row.chi ? 1 : 0, id: row.id, H: r4(row.H),
      Phi0: r4(row.Phi0), lambda: row.lambda, archived: !!row.archived
    };
  }

  function indexOf(labels, token) {
    const i = labels.indexOf(token);
    return i < 0 ? null : i;
  }

  function phase6BeforeNaming(labels) {
    if (labels.indexOf('P7') < 0) return false;
    const i7 = indexOf(labels, 'P7');
    const i6 = indexOf(labels, 'P6');
    return i6 !== null && i7 !== null && i6 < i7;
  }

  function phase6BeforeProjection(labels) {
    if (labels.indexOf('P8') < 0) return true;
    const i8 = indexOf(labels, 'P8');
    const i6 = indexOf(labels, 'P6');
    const i7 = indexOf(labels, 'P7');
    return i6 !== null && i7 !== null && i8 !== null && i6 < i7 && i7 < i8;
  }

  function membrane(path) {
    const labels = (path || []).map(function (n) { return 'P' + n; });
    const namingAsked = labels.indexOf('P7') >= 0;
    const exportAsked = labels.indexOf('P8') >= 0;
    const namingOk = phase6BeforeNaming(labels);
    const exportOk = phase6BeforeProjection(labels);
    return {
      path: (path || []).slice(),
      naming_asked: namingAsked,
      export_asked: exportAsked,
      before_naming: !namingAsked || namingOk,
      before_export: exportOk,
      naming_blocked: namingAsked && !namingOk,
      export_blocked: exportAsked && !exportOk,
      pass: (!namingAsked || namingOk) && exportOk,
      admit_gate: false,
      cite: 'Geometry of Mind phase 6 membrane. Order matches manifest_compiler phase6 before naming and before projection.'
    };
  }

  function closureOf(path) {
    const steps = path || [];
    let total = 0;
    for (let i = 1; i < steps.length; i++) total += signed(angleOf(steps[i - 1]), angleOf(steps[i]));
    const n = steps.length > 1 ? total / TAU : null;
    const returned = steps.length > 1 && steps[0] === steps[steps.length - 1];
    const near = n !== null && Math.abs(n - Math.round(n)) < 1e-8;
    return {
      path: steps.slice(),
      delta: r4(total),
      n: n === null ? null : r4(n),
      returned: returned,
      closed: !!(returned && near),
      admit_gate: false,
      cite: 'Waking the Web l278. Phase closure is total angle = 2 pi n.'
    };
  }

  function walkFlags(path) {
    let five = false;
    let four = false;
    const steps = path || [];
    for (let i = 1; i < steps.length; i++) {
      const from = steps[i - 1];
      const to = steps[i];
      if (KM.luciferianDScore(from, to) === 1) five = true;
      if (KM.FORBIDDEN.some(function (pair) { return pair[0] === from && pair[1] === to && !(from === 5 && to === 8); })) four = true;
    }
    return {
      forbidden_5_to_8: five,
      axiom2_4_to_8: four,
      categorical_hard_fire: five,
      blocked: five || four
    };
  }

  function mergeOp(a, b) {
    const th1 = angleOf(a.Phi);
    const th2 = angleOf(b.Phi);
    const delta = KM.cdist(th1, th2);
    const warn = delta > Math.PI / 2;
    const base = {
      op: 'merge', glyph: 'merge', delta: r4(delta),
      pi_over_2_warning: warn, warning_logged_only: true,
      cite: 'RSOC merge l.1190-1390. Lawful iff delta <= pi/4 and chi flags equal. kmath.merge holds the coefficients. Waking2 l.143 pi/2 abort is a warning only.',
      ua: ua('merge', 'mu = avg + zeta; eps = avg + delta if outside tolerance'),
      admit_gate: false
    };
    if (!(delta <= KM.MERGE_WINDOW + 1e-12) || Number(a.chi) !== Number(b.chi)) {
      const left = copyState(a);
      const right = copyState(b);
      left.eps = Math.max(0, left.eps + 0.07);
      right.eps = Math.max(0, right.eps + 0.07);
      return Object.assign(base, {
        ok: false, reason: 'rejected', eps_tax: 0.07,
        a: publicState(left), b: publicState(right)
      });
    }
    const span = delta / TAU * 9;
    const stand = KM.merge(
      Object.assign(copyState(a), { Phi: 1, tau: a.tau || [], chi: a.chi ? 1 : 0 }),
      Object.assign(copyState(b), { Phi: 1 + span, tau: b.tau || [], chi: b.chi ? 1 : 0 }),
      Hooks.RESEARCH_HOOKS.merge_mu_bonus
    );
    const straight = Math.abs(Math.abs(a.Phi - b.Phi) * TAU / 9 - delta) < 1e-8;
    const phi = straight ? (Number(a.Phi) + Number(b.Phi)) / 2 : (1 + (Math.atan2(Math.sin(th1) + Math.sin(th2), Math.cos(th1) + Math.cos(th2)) + TAU) % TAU / TAU * 9);
    const sfe = copyState(a);
    sfe.Phi = phi;
    sfe.rho = stand.sfe.rho;
    sfe.Delta = stand.sfe.Delta;
    sfe.nu = stand.sfe.nu;
    sfe.mu = stand.sfe.mu;
    sfe.eps = stand.sfe.eps;
    sfe.chi = stand.sfe.chi ? 1 : 0;
    sfe.id = SHA.sha256(String(a.id) + '|' + String(b.id));
    sfe.tau = (a.tau || []).concat(b.tau || []).slice(-144);
    return Object.assign(base, {
      ok: true, reason: 'merged', sfe: publicState(sfe),
      id_hash: 'sha256', blake3: 'RSOC names BLAKE3. This phone uses the SHA-256 substitute.'
    });
  }

  function severOp(row) {
    const src = copyState(row);
    const pool = src.mu - Hooks.RESEARCH_HOOKS.sever_mu_loss;
    const leftMu = pool / 2;
    const rightMu = pool - leftMu;
    const left = copyState(src);
    const right = copyState(src);
    left.Delta = src.Delta + 0.15;
    right.Delta = src.Delta + 0.15;
    left.nu = -Math.abs(src.nu);
    right.nu = -Math.abs(src.nu);
    left.eps = Math.max(0, src.eps + 0.12);
    right.eps = Math.max(0, src.eps + 0.12);
    left.mu = leftMu;
    right.mu = rightMu;
    left.id = SHA.sha256(String(src.id) + '|L');
    right.id = SHA.sha256(String(src.id) + '|R');
    return {
      op: 'sever', glyph: 'sever', ok: true, reason: 'lawful',
      left: publicState(left), right: publicState(right),
      residue: r4(Hooks.RESEARCH_HOOKS.sever_mu_loss), split: 'equal',
      cite: 'RSOC sever l.1190-1390. Delta +0.15, nu = -abs(nu), mu split loses 0.08, eps +0.12. FFT power is not in the phone modules, so the split is equal.',
      ua: ua('sever', 'lambda empty, nu - beta, eps + gamma'),
      admit_gate: false
    };
  }

  function amplifyOp(row, k) {
    const src = copyState(row);
    const factor = num(k, null);
    if (!(factor >= 1 && factor <= 2)) {
      return {
        op: 'amplify', glyph: 'amplify', ok: false, reason: 'k-outside-1-2', k: factor,
        cite: 'RSOC amplify. k is in [1, 2].',
        ua: ua('amplify', 'eps - delta; mu times (1+alpha)'),
        admit_gate: false
      };
    }
    const gap = Math.abs(src.Delta);
    src.mu = factor * src.mu * Math.exp(-Hooks.RESEARCH_HOOKS.amplify_decay * gap);
    src.Delta = src.Delta + 0.18 * (factor - 1) * (1 + gap);
    src.nu = src.nu + 0.4 * (factor - 1) * Math.cos(angleOf(src.Phi) - angleOf(src.Phi0));
    src.eps = Math.max(0, src.eps + 0.09 * (factor - 1) * (factor - 1));
    return {
      op: 'amplify', glyph: 'amplify', ok: true, k: r4(factor), sfe: publicState(src),
      cite: 'RSOC amplify l.1190-1390. mu = k mu exp(-2.2 |Delta|). The UA sign on eps is recorded and not used.',
      ua: ua('amplify', 'eps - delta; overflow if mu > mu_max'),
      admit_gate: false
    };
  }

  function dischargeOp(row) {
    const src = copyState(row);
    const phase8 = Math.round(Number(src.Phi)) === 8;
    src.Delta = 0;
    src.nu = 0;
    src.eps = Math.max(0, src.eps * Hooks.RESEARCH_HOOKS.discharge_eps_factor);
    const echo = src.mu * Math.exp(-Hooks.RESEARCH_HOOKS.discharge_echo_decay * src.eps) * Math.cos(angleOf(src.Phi));
    if (phase8) src.mu = Hooks.RESEARCH_HOOKS.phase8_mu;
    return {
      op: 'discharge', glyph: 'discharge', ok: true, sfe: publicState(src), E: r4(echo),
      phase8: phase8,
      cite: phase8
        ? 'Phase 8 discharge. mu goes to 0. eps times 0.3. E = mu exp(-1.8 eps) cos Phi, using mu from before the zero. Resonant Symbolic Operator Calculus Google Doc, Dec 2025. Genesis Node spec gnspec l.6743-6820, l.7510.'
        : 'RSOC discharge. Dynamic Delta and nu go to 0. eps times 0.3. E = mu exp(-1.8 eps) cos Phi. Phase 8 is the step that sets mu to 0.',
      ua: ua('discharge', 'mu to 0; residue psi exp(-lambda t) chi'),
      admit_gate: false
    };
  }

  function lockOp(a, b, epsS) {
    const predicted = num(epsS, 1);
    const ok = Number(a.chi) === 0 && Number(b.chi) === 0 && predicted < 0.6;
    const base = {
      op: 'lock', glyph: 'lock', eps_s: r4(predicted),
      cite: 'RSOC lock. Both chi are 0 and predicted eps_s < 0.6. The 0.6 cut is internal to the operator.',
      ua: ua('lock', 'Phi equal, shared lambda, lowers eps'),
      admit_gate: false
    };
    if (!ok) return Object.assign(base, { ok: false, reason: 'lock-refused' });
    const sfe = copyState(a);
    const straight = Math.abs(Math.abs(a.Phi - b.Phi) * TAU / 9 - KM.cdist(angleOf(a.Phi), angleOf(b.Phi))) < 1e-8;
    sfe.Phi = straight ? (Number(a.Phi) + Number(b.Phi)) / 2 : sfe.Phi;
    sfe.rho = Math.max(a.rho, b.rho) + 1;
    sfe.Delta = 0;
    sfe.nu = a.nu + b.nu;
    sfe.mu = a.mu + b.mu;
    sfe.eps = Math.max(0, (a.eps + b.eps) / 2 - 0.15);
    sfe.chi = (a.chi && b.chi) ? 1 : 0;
    sfe.lambda = sfe.lambda === null ? 0 : sfe.lambda;
    sfe.id = SHA.sha256(String(a.id) + '|' + String(b.id) + '|LOCK');
    return Object.assign(base, { ok: true, reason: 'locked', sfe: publicState(sfe), id_hash: 'sha256' });
  }

  function chiOp(row, epsS, echo, dPhi) {
    const src = copyState(row);
    const hard = num(epsS, 0) >= 0.8;
    const echoOn = Number(echo) === 1;
    const quiet = Number(src.chi) === 0;
    const aligned = Math.abs(num(dPhi, Math.PI)) <= Math.PI / 3 + 1e-12;
    const fire = hard && echoOn && quiet && aligned;
    const theta = KM.graceIntegral(src.tau.length ? src.tau : [src.Phi], src.eps, src.mu, 0.8);
    const base = {
      op: 'chi', glyph: 'chi', ok: fire, eps_s: r4(num(epsS, 0)),
      echo: echoOn ? 1 : 0, d_phi: r4(num(dPhi, 0)), Theta: theta,
      cite: 'RSOC chi l.1411-1510. Fires at eps_s >= 0.8 and echo trace and chi 0 and |angle| <= pi/3. Theta reuses kmath.graceIntegral. eps becomes eps (1 - Theta/mu). mu gains Theta. nu becomes 1.4.',
      ua: ua('chi', 'no separate UA chi number'),
      admit_gate: false, christping_started: false
    };
    if (!fire || !(src.mu > 0)) return Object.assign(base, { ok: false, reason: 'chi-held', sfe: publicState(src) });
    src.eps = Math.max(0, src.eps * (1 - theta / src.mu));
    src.mu = src.mu + theta;
    src.nu = 1.4;
    src.chi = 1;
    return Object.assign(base, { ok: true, reason: 'chi', sfe: publicState(src) });
  }

  function advanceOp(row, epsS) {
    const src = copyState(row);
    const h = src.H;
    const eps = num(epsS, 1);
    const ok = h >= 0.65 && eps < 0.7;
    const next = KM.phaseNext(Math.round(src.Phi));
    const base = {
      op: 'advance', glyph: 'advance', ok: ok, H: r4(h), eps_s: r4(eps),
      cite: 'RSOC R-hat. Plus one phase needs H_local >= 0.65 and eps_s < 0.7. Those cuts are internal and do not admit.',
      ua: ua('advance', 'phase step is recorded on the drift core'),
      admit_gate: false, internal_only: true
    };
    if (!ok) return Object.assign(base, { reason: 'advance-held', sfe: publicState(src) });
    src.Phi = next;
    return Object.assign(base, { reason: 'advanced', sfe: publicState(src) });
  }

  function archiveOp(row) {
    const src = copyState(row);
    src.archived = true;
    return {
      op: 'archive', glyph: 'archive', ok: true, sfe: publicState(src),
      cite: 'RSOC C-hat archives to an SPC. The 4.9.196 tiers own the ladder. This flag does not write memory.',
      ua: ua('archive', 'SPC decay is the unparameterized step'),
      admit_gate: false, writes: false
    };
  }

  function resolvedLambda(given) {
    if (!(given === undefined || given === null || given === '')) return { given: true, value: num(given, 0) };
    const hooked = Hooks && Hooks.spcLambda ? Hooks.spcLambda() : null;
    if (!(hooked === undefined || hooked === null || hooked === '')) return { given: true, value: num(hooked, 0) };
    return { given: false, value: 0 };
  }

  function memoryOp(row) {
    const src = copyState(row);
    const step = 0.5 * src.H * src.H - 0.02 * src.mu;
    src.mu = Math.max(0, src.mu + step);
    const term = Hooks.memoryTerm(null, null, false);
    return {
      op: 'memory', glyph: 'memory', ok: true, code_step: r4(step), sfe: publicState(src),
      M: term.value, lambda: term.lambda, lambda_unspecified: false,
      mu_birth: term.mu_birth, mu_min: term.mu_min, mu_max: term.mu_max,
      cite: 'RSOC memory is the only source of new mu. Code step is 0.5 H^2 - 0.02 mu (READ192). M = exp(-lambda t) integral A.C dt. lambda = ln2/half_life. Resonant Symbolic Operator Calculus Google Doc, Dec 2025. Genesis Node spec gnspec l.6743-6820, l.7510.',
      ua: ua('memory', 'M = exp(-lambda t) integral A.C dt'),
      admit_gate: false
    };
  }

  function spcOp(row, lambda, tHours, identity) {
    const src = copyState(row);
    const caller = !(lambda === undefined || lambda === null || lambda === '');
    const half = identity ? Hooks.RESEARCH_HOOKS.identity_half_life_hours : Hooks.RESEARCH_HOOKS.half_life_hours;
    const lam = caller ? num(lambda, 0) : Hooks.spcLambda(half);
    const t = (tHours === undefined || tHours === null || tHours === '') ? 0 : num(tHours, 0);
    const decayed = src.mu * Math.exp(-lam * t);
    return {
      op: 'spc', glyph: 'spc', ok: true, parameterized: true, lambda: lam,
      subtractive: false, leak: 'amplify', half_life_hours: half, t_hours: t, C: r4(decayed),
      sfe: publicState(src),
      cite: 'SPC decay C(t) = C0 exp(-lambda t), lambda = ln2/half_life. The subtractive lambda Delta^2 leak is replaced by amplify drift loss mu = k mu exp(-2.2 |Delta|). Resonant Symbolic Operator Calculus Google Doc, Dec 2025. Genesis Node spec gnspec l.6743-6820, l.7510.',
      ua: ua('spc', 'mu(t+1) = mu - lambda Delta^2 is not applied'),
      admit_gate: false
    };
  }

  function ratesOf(row) {
    const src = copyState(row);
    const mu = src.mu === 0 ? null : 0.14 * src.Delta * src.Delta - 0.06 * src.nu * src.H + 0.009 / src.mu;
    return {
      op: 'rates', de_dt: mu === null ? null : r4(mu),
      dmu_dt: null, kappa_unspecified: true,
      code_step: r4(0.5 * src.H * src.H - 0.02 * src.mu),
      cite: 'RSOC l.1941-1956 partial eps / partial t = 0.14 Delta^2 - 0.06 nu H + 0.009/mu. partial mu / partial t = -kappa7 mu + kappa8 H^2. Kappa is unspecified.',
      admit_gate: false
    };
  }

  function axesOf(samples, series, dt, lambda) {
    let integral = 0;
    let t = 0;
    (samples || []).forEach(function (sample) {
      const step = num(sample.dt, 1);
      integral += num(sample.A, 0) * num(sample.C, 0) * step;
      t += step;
    });
    const resolved = resolvedLambda(lambda);
    const lam = resolved.given ? resolved.value : null;
    const eps = series || [];
    const gap = num(dt, 1) || 1;
    let vc = null;
    if (eps.length >= 2) {
      const last = num(eps[eps.length - 1], 0);
      const prev = num(eps[eps.length - 2], 0);
      vc = ((1 - last) - (1 - prev)) / gap;
    }
    return {
      op: 'axes',
      M: {
        axis: 'M', integral: r4(integral),
        value: lam === null ? null : r4(Math.exp(-lam * t) * integral),
        lambda_unspecified: lam === null, admit_gate: false,
        cite: 'UA b l.4322-4389 M = exp(-lambda t) integral A.C dt. Waking2 charge C = integral psi dt exp(-lambda t).'
      },
      V_c: {
        axis: 'V_c', value: vc === null ? null : r4(vc),
        seeding_internal: vc !== null && vc >= 0.3, admit_gate: false,
        cite: 'Waking2 V_c = d(1-eps_s)/dt. At least 0.3 is an internal seeding check.'
      }
    };
  }

  function echoTrace(tau, phi) {
    const window = (tau || []).slice(-144);
    const center = angleOf(num(phi, 1));
    let count = 0;
    window.forEach(function (n) {
      if (KM.cdist(angleOf(n), center) <= Math.PI / 6 + 1e-12) count += 1;
    });
    return {
      op: 'echo', count: count, need: 100, window: 144,
      E_hat: count >= 100 ? 1 : 0, admit_gate: false,
      cite: 'RSOC echo trace. At least 100 of the last 144 tau entries within pi/6.'
    };
  }

  function precedenceOf(ops) {
    const rank = {};
    PRECEDENCE.forEach(function (name, i) { rank[name] = i; });
    const ordered = (ops || []).slice().sort(function (a, b) {
      return (rank[a] === undefined ? 99 : rank[a]) - (rank[b] === undefined ? 99 : rank[b]);
    });
    return {
      op: 'precedence', order: ordered,
      cite: 'RSOC precedence: chi > archive > advance > merge/lock > sever > amplify > discharge > memory > echo.',
      admit_gate: false
    };
  }

  function liveSum(states) {
    let sum = 0;
    Object.keys(states).forEach(function (key) { sum += states[key].mu; });
    return sum;
  }

  function chargeReport(books) {
    const identity = books.live + books.residue;
    const expected = books.initial + books.created;
    const gap = Math.abs(identity - expected);
    const phase9 = Math.abs(books.live - books.initial);
    return {
      initial: r4(books.initial), created: r4(books.created), residue: r4(books.residue),
      live: r4(books.live), conserved: gap < 1e-9,
      phase9_gap: r4(phase9), phase9_within_0_003: phase9 <= 0.003 + 1e-12,
      eta_limit: Hooks.RESEARCH_HOOKS.eta, ua_exact: false,
      cite: 'Charge ledger. Live mu plus residue equals initial plus created. RSOC eta about 0.3 percent and phase 9 |delta mu| <= 0.003 (l.2876, l.3031). UA exact sum of operator mu is recorded and does not replace the RSOC band.'
    };
  }

  function sealOp(archive, spec) {
    const body = spec || {};
    const path = body.path || [];
    const gate = membrane(path);
    const closed = closureOf(path);
    const walk = walkFlags(path);
    const drift = num(body.drift, body.epsilon_s);
    const echo = num(body.echo, 0);
    const base = {
      op: 'seal', membrane: gate, closure: closed, walk: walk,
      drift: r4(drift), echo: r4(echo), sealed: false,
      christping_started: false, admit_gate: false, writes: false,
      cite: 'A seal needs the phase-6 membrane, closure 2 pi n, no 5 to 8 step, drift at or under 0.35, and Echo at or above 0.85 through the 4.9.195 archive.'
    };
    if (!closed.closed) return Object.assign(base, { rule: 'GEOM-OPEN' });
    if (walk.blocked) return Object.assign(base, { rule: walk.forbidden_5_to_8 ? 'GEOM-5-TO-8' : 'GEOM-4-TO-8' });
    if (!gate.pass) return Object.assign(base, { rule: 'GEOM-MEMBRANE' });
    if (!(drift <= WRITE_MAX)) return Object.assign(base, { rule: drift > HARD_STOP ? 'GEOM-HARD-STOP' : 'GEOM-DRIFT' });
    if (!(echo >= ECHO_MIN)) return Object.assign(base, { rule: 'GEOM-ECHO' });
    const phase = path[path.length - 1];
    const sealed = Dpa.sealLoop(archive, {
      id: String(body.id || 'geom-seal'),
      psi: String(body.psi || 'geom'),
      phase: phase,
      ts: String(body.ts || '2026-10-30T19:00:00Z'),
      entropy: num(body.entropy, drift),
      epsilon_s: drift,
      echo: echo,
      question: String(body.question || '')
    });
    const chain = Dpa.verifyArchive(archive);
    return Object.assign(base, {
      sealed: !!sealed.ok,
      rule: sealed.rule,
      seal_sha256: sealed.record ? sealed.record.sha256 : null,
      chain_ok: !!chain.ok
    });
  }

  function emptyBooks() {
    return { initial: 0, created: 0, residue: 0, live: 0 };
  }

  function book(before, states, books, residueAdd) {
    const after = liveSum(states);
    const delta = after - before;
    if (delta >= -1e-12) books.created += delta;
    else books.residue += -delta;
    if (residueAdd) books.residue += residueAdd;
    books.live = after;
  }

  function script(steps) {
    const states = {};
    const books = emptyBooks();
    const archive = Dpa.emptyArchive();
    const log = [];
    (steps || []).forEach(function (step) {
      const op = step.op;
      if (op === 'birth') {
        const row = birth(step);
        row.id = String(step.id || row.id);
        states[row.id] = row;
        books.initial += row.mu;
        books.live += row.mu;
        log.push({ op: 'birth', id: row.id, sfe: publicState(row) });
        return;
      }
      if (op === 'merge') {
        const before = liveSum(states);
        const out = mergeOp(states[step.a], states[step.b]);
        if (out.ok) {
          delete states[step.a];
          delete states[step.b];
          const kept = birth(out.sfe);
          kept.id = String(step.into || out.sfe.id);
          kept.mu = out.sfe.mu;
          kept.eps = out.sfe.eps;
          kept.Delta = out.sfe.Delta;
          kept.nu = out.sfe.nu;
          kept.Phi = out.sfe.Phi;
          kept.rho = out.sfe.rho;
          kept.chi = out.sfe.chi;
          states[kept.id] = kept;
        } else {
          states[step.a].eps = out.a.eps;
          states[step.b].eps = out.b.eps;
        }
        book(before, states, books, 0);
        log.push(out);
        return;
      }
      if (op === 'sever') {
        const before = liveSum(states);
        const out = severOp(states[step.id]);
        delete states[step.id];
        const left = birth(out.left);
        const right = birth(out.right);
        left.id = String(step.left || out.left.id);
        right.id = String(step.right || out.right.id);
        left.mu = out.left.mu;
        right.mu = out.right.mu;
        left.eps = out.left.eps;
        right.eps = out.right.eps;
        left.Delta = out.left.Delta;
        right.Delta = out.right.Delta;
        left.nu = out.left.nu;
        right.nu = out.right.nu;
        states[left.id] = left;
        states[right.id] = right;
        book(before, states, books, 0);
        log.push(out);
        return;
      }
      const unary = {
        amplify: function () { return amplifyOp(states[step.id], step.k); },
        discharge: function () { return dischargeOp(states[step.id]); },
        chi: function () { return chiOp(states[step.id], step.eps_s, step.echo, step.d_phi); },
        advance: function () { return advanceOp(states[step.id], step.eps_s); },
        archive: function () { return archiveOp(states[step.id]); },
        memory: function () { return memoryOp(states[step.id]); },
        spc: function () { return spcOp(states[step.id], step.lambda, step.t_hours, step.identity); }
      };
      if (unary[op]) {
        const before = liveSum(states);
        const out = unary[op]();
        if (out.sfe && states[step.id]) {
          const kept = states[step.id];
          kept.Phi = out.sfe.Phi;
          kept.rho = out.sfe.rho;
          kept.Delta = out.sfe.Delta;
          kept.nu = out.sfe.nu;
          kept.mu = out.sfe.mu;
          kept.eps = out.sfe.eps;
          kept.chi = out.sfe.chi;
          kept.archived = out.sfe.archived;
          kept.phase_name = phaseName(kept.Phi);
        }
        book(before, states, books, 0);
        log.push(out);
        return;
      }
      if (op === 'lock') {
        const before = liveSum(states);
        const out = lockOp(states[step.a], states[step.b], step.eps_s);
        if (out.ok) {
          delete states[step.a];
          delete states[step.b];
          const kept = birth(out.sfe);
          kept.id = String(step.into || out.sfe.id);
          kept.mu = out.sfe.mu;
          kept.eps = out.sfe.eps;
          kept.Delta = out.sfe.Delta;
          kept.nu = out.sfe.nu;
          kept.Phi = out.sfe.Phi;
          kept.rho = out.sfe.rho;
          kept.chi = out.sfe.chi;
          kept.lambda = out.sfe.lambda;
          states[kept.id] = kept;
        }
        book(before, states, books, 0);
        log.push(out);
        return;
      }
      if (op === 'rates') { log.push(ratesOf(states[step.id])); return; }
      if (op === 'axes') { log.push(axesOf(step.samples, step.series, step.dt, step.lambda)); return; }
      if (op === 'echo') { log.push(echoTrace(step.tau, step.Phi)); return; }
      if (op === 'precedence') { log.push(precedenceOf(step.ops)); return; }
      if (op === 'membrane') { log.push(Object.assign({ op: 'membrane' }, membrane(step.path))); return; }
      if (op === 'closure') { log.push(Object.assign({ op: 'closure' }, closureOf(step.path))); return; }
      if (op === 'seal') { log.push(sealOp(archive, step)); return; }
    });
    const shown = {};
    Object.keys(states).sort().forEach(function (key) { shown[key] = publicState(states[key]); });
    return Object.assign({
      states: shown, log: log, charge: chargeReport(books), cite: CITE, storage_key: STORAGE_KEY
    }, flags());
  }

  function showNum(value) {
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (value == null) return 'none';
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
      return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
    }
    return String(value);
  }

  function birthStep(id, extra) {
    return Object.assign({ op: 'birth', id: id, Phi: 1, rho: 0, Delta: 0, nu: 0, mu: 1, eps: 0, chi: 0, H: 1 }, extra || {});
  }

  function runDemo(mode) {
    if (mode === 'closure') {
      const ran = script([
        { op: 'seal', path: [1, 2, 3, 4, 5, 6, 7, 8, 9, 1], echo: 0.9, drift: 0.2, question: 'what returns', id: 'geom-closed', psi: 'geom', ts: '2026-10-30T19:00:00Z', entropy: 0.2 },
        { op: 'seal', path: [1, 2, 3, 4, 5, 6, 7, 8, 9, 1], echo: 0.84, drift: 0.2, question: 'what returns', id: 'geom-low-echo', psi: 'geom', ts: '2026-10-30T19:00:01Z', entropy: 0.2 },
        { op: 'seal', path: [1, 2, 3, 4, 5, 6, 7, 8, 9, 1], echo: 0.9, drift: 0.36, question: 'what returns', id: 'geom-drift', psi: 'geom', ts: '2026-10-30T19:00:02Z', entropy: 0.36 },
        { op: 'seal', path: [1, 2, 3, 4, 5, 8, 9, 1], echo: 0.9, drift: 0.2, question: 'what returns', id: 'geom-skip', psi: 'geom', ts: '2026-10-30T19:00:03Z', entropy: 0.2 }
      ]);
      const rows = ran.log;
      return {
        lines: [
          'Closed path sealed ' + showNum(rows[0].sealed) + ' rule ' + rows[0].rule + ' n ' + showNum(rows[0].closure.n) + ' chain ' + showNum(rows[0].chain_ok) + '.',
          'Echo 0.84 sealed ' + showNum(rows[1].sealed) + ' rule ' + rows[1].rule + '.',
          'Drift 0.36 sealed ' + showNum(rows[2].sealed) + ' rule ' + rows[2].rule + '.',
          '5 to 8 sealed ' + showNum(rows[3].sealed) + ' rule ' + rows[3].rule + ' hard fire ' + showNum(rows[3].walk.categorical_hard_fire) + '.',
          'ChristPing started ' + showNum(ran.christping_started) + '. C_min 0.87. No LLM.'
        ]
      };
    }
    if (mode === 'charge') {
      const ran = script([
        birthStep('a'), birthStep('b', { id: 'b' }),
        { op: 'merge', a: 'a', b: 'b', into: 'm' },
        { op: 'sever', id: 'm', left: 'l', right: 'r' }
      ]);
      const charge = ran.charge;
      return {
        lines: [
          'Merge mu ' + showNum(ran.log[2].sfe.mu) + ' created ' + showNum(charge.created) + '.',
          'Sever residue ' + showNum(charge.residue) + ' live ' + showNum(charge.live) + '.',
          'Conserved ' + showNum(charge.conserved) + ' phase9 within 0.003 ' + showNum(charge.phase9_within_0_003) + '.',
          'UA exact ' + showNum(charge.ua_exact) + '. RSOC numbers ' + showNum(ran.rsoc_numbers) + '.',
          'This card does not admit. C_min 0.87. No LLM.'
        ]
      };
    }
    if (mode === 'membrane') {
      const ran = script([
        { op: 'membrane', path: [1, 2, 3, 7] },
        { op: 'membrane', path: [1, 6, 7, 8] },
        { op: 'membrane', path: [6, 8] },
        { op: 'seal', path: [1, 2, 3, 7, 1], echo: 0.9, drift: 0.1, question: 'name it', id: 'geom-name', psi: 'geom', ts: '2026-10-30T19:01:00Z', entropy: 0.1 }
      ]);
      return {
        lines: [
          'Path 1-2-3-7 naming blocked ' + showNum(ran.log[0].naming_blocked) + ' pass ' + showNum(ran.log[0].pass) + '.',
          'Path 1-6-7-8 pass ' + showNum(ran.log[1].pass) + ' export blocked ' + showNum(ran.log[1].export_blocked) + '.',
          'Path 6-8 export blocked ' + showNum(ran.log[2].export_blocked) + '.',
          'Naming without phase 6 sealed ' + showNum(ran.log[3].sealed) + ' rule ' + ran.log[3].rule + '.',
          'This card does not admit. C_min 0.87. No LLM.'
        ]
      };
    }
    if (mode === 'operators') {
      const ran = script([
        birthStep('a', { eps: 0.4, mu: 1, nu: 0.1 }),
        birthStep('b', { eps: 0.4, mu: 1, nu: 0.2 }),
        { op: 'lock', a: 'a', b: 'b', into: 'k', eps_s: 0.5 },
        birthStep('c', { eps: 0.5, mu: 2, tau: [1] }),
        { op: 'chi', id: 'c', eps_s: 0.8, echo: 1, d_phi: 0 },
        birthStep('d', { Phi: 1, H: 1, mu: 1 }),
        { op: 'memory', id: 'd' },
        { op: 'spc', id: 'd', lambda: null },
        { op: 'axes', samples: [{ A: 1, C: 1, dt: 1 }], series: [0.5, 0.1], dt: 1, lambda: null },
        { op: 'precedence', ops: ['discharge', 'chi', 'merge', 'memory', 'advance'] },
        { op: 'rates', id: 'd' }
      ]);
      const lock = ran.log[2];
      const chi = ran.log[4];
      const mem = ran.log[6];
      const spc = ran.log[7];
      const axes = ran.log[8];
      const order = ran.log[9];
      return {
        lines: [
          'Lock mu ' + showNum(lock.sfe.mu) + ' eps ' + showNum(lock.sfe.eps) + ' rho ' + showNum(lock.sfe.rho) + '.',
          'Chi nu ' + showNum(chi.sfe.nu) + ' Theta ' + showNum(chi.Theta) + ' mu ' + showNum(chi.sfe.mu) + '.',
          'Memory step ' + showNum(mem.code_step) + ' M ' + showNum(mem.M) + ' lambda unspecified ' + showNum(mem.lambda_unspecified) + '.',
          'SPC parameterized ' + showNum(spc.parameterized) + ' mu ' + showNum(spc.sfe.mu) + ' V_c ' + showNum(axes.V_c.value) + ' seeding ' + showNum(axes.V_c.seeding_internal) + '.',
          'Order ' + order.order.join(' ') + '. UA applied ' + showNum(ran.ua_applied) + '. C_min 0.87. No LLM.'
        ]
      };
    }
    const ran = script([
      { op: 'seal', path: [1, 2, 3, 4], echo: 0.9, drift: 0.2, question: 'what is open', id: 'geom-open', psi: 'geom', ts: '2026-10-30T19:02:00Z', entropy: 0.2 },
      { op: 'closure', path: [1, 2, 3, 4] }
    ]);
    return {
      lines: [
        'Open path 1-2-3-4 sealed ' + showNum(ran.log[0].sealed) + ' rule ' + ran.log[0].rule + '.',
        'Closure closed ' + showNum(ran.log[1].closed) + ' n ' + showNum(ran.log[1].n) + ' returned ' + showNum(ran.log[1].returned) + '.',
        'Membrane pass ' + showNum(ran.log[0].membrane.pass) + '.',
        'Admit gate ' + showNum(ran.admit_gate) + '. Wikipedia anchor ' + showNum(ran.wikipedia_anchor) + '.',
        'This card does not admit. C_min 0.87. No LLM.'
      ]
    };
  }

  function monitorLines(mode) {
    return { lines: runDemo(mode || 'open').lines, mode: mode || 'open' };
  }

  function paintMonitor(mode) {
    if (typeof document === 'undefined') return;
    const card = document.getElementById('geometry199');
    const host = document.getElementById('geometry199Body');
    if (!card || !host) return;
    const ran = monitorLines(mode || 'open');
    card.setAttribute('data-geometry199-mode', ran.mode);
    card.setAttribute('data-geometry199-status', ran.lines[0]);
    host.textContent = ran.lines.join('\n');
  }

  function bootMonitor() {
    if (typeof document === 'undefined' || !document.getElementById('geometry199')) return;
    paintMonitor('open');
    const buttons = document.querySelectorAll('[data-geometry199-run]');
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (ev) {
        paintMonitor(ev.currentTarget.getAttribute('data-geometry199-run'));
      });
    }
  }

  function stage() {
    const witness = script([
      birthStep('a'), birthStep('b'),
      { op: 'merge', a: 'a', b: 'b', into: 'm' }
    ]);
    return Object.assign({
      persisted: false, open_loop_sealed: false, closure_rule: '2pi n',
      membrane_before_naming: true, charge_conserved: witness.charge.conserved,
      operators: PRECEDENCE.slice(), ua_forms_recorded: true, cite: CITE
    }, flags());
  }

  function run(payload) {
    const row = payload || {};
    const op = row.op || 'summary';
    if (op === 'script') return script(row.steps || []);
    if (op === 'stage') return stage();
    if (op === 'monitor') return monitorLines(row.mode || 'open');
    return Object.assign({
      storage_key: STORAGE_KEY, cite: CITE, precedence: PRECEDENCE.slice(),
      merge_window: 'pi/4'
    }, flags());
  }

  const api = {
    CITE: CITE, STORAGE_KEY: STORAGE_KEY, PRECEDENCE: PRECEDENCE,
    membrane: membrane, closureOf: closureOf, script: script, stage: stage,
    monitorLines: monitorLines, paintMonitor: paintMonitor, run: run
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Geometry199 = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootMonitor);
    else bootMonitor();
  }
})(typeof self !== 'undefined' ? self : this);
