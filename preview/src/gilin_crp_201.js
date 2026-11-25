/* 4.9.201 GILIN / CRP.
 * The map labelled this section 4.9.200. It ships as 4.9.201.
 * CRP 0.78, warn 0.40, and C* 0.82 are internal. They do not admit.
 * Calls the drift core, the renderer, the geometry merge, the lexicon,
 * and research_hooks. Does not copy those formulas. No model. */
(function (root) {
  const KM = (typeof module !== 'undefined' && module.exports) ? require('./kmath.js') : root.KMath;
  const V43 = (typeof module !== 'undefined' && module.exports) ? require('./drift_v43.js') : root.DriftV43;
  const G = (typeof module !== 'undefined' && module.exports) ? require('./geometry_199.js') : root.Geometry199;
  const PPE = (typeof module !== 'undefined' && module.exports) ? require('./ppe_lexicon_197.js') : root.Ppe197;
  const R = (typeof module !== 'undefined' && module.exports) ? require('./rmc_renderer_200.js') : root.RmcRenderer200;
  const Hooks = (typeof module !== 'undefined' && module.exports) ? require('./research_hooks.js') : root.ResearchHooks;
  const STORAGE_KEY = 'kernel.gilin_crp_201';
  const CRP_INTERNAL = 0.78;
  const WARN_INTERNAL = 0.40;
  const C_STAR_INTERNAL = 0.82;
  const CITE = 'GN Doc2 GILIN/CRP, retuned. The map section labelled 4.9.200 is this 4.9.201 release. CRP 0.78, warn 0.40, and C* 0.82 are internal and do not admit. Admission stays C_min 0.87 and write drift at or under 0.35. Echo stays 0.85 against the question. The Doc2 file is not in this tree. Heartbeat coordination calls the geometry merge inside pi/4. ChristPing stays Gilligan-only and is not started. 144 Hz is the Codex log, not a timer. No model.';
  const QUESTION = 'Why is the sky blue?';
  const CANDIDATE = 'The sky is blue because sunlight scatters.';

  function num(value, fallback) {
    if (typeof value === 'boolean' || value === null || value === undefined || value === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function whole(value, fallback) {
    const n = num(value, fallback);
    if (n === null || n === undefined) return fallback;
    return Math.round(n);
  }

  function nest(n) {
    let node = { v: 1 };
    for (let i = 1; i < n; i++) node = { n: node };
    return node;
  }

  function flags(laws) {
    return {
      admit_gate: false, keyword_admit: false, writes: false, calls_llm: false, network: false,
      money: false, dream_idle: false, economy: false, packs_gated: true,
      christping: 'gilligan-only', christping_started: false, wikipedia_anchor: false,
      c_min: laws.C_min, echo_min: laws.echo_min, write_max: laws.write_max, hard_stop: laws.hard_stop,
      resonance_not_parsing: true, coherence_formula_unchanged: true,
      gilin_build: '4.9.201', map_section: '4.9.200', merge_window: 'pi/4',
      hooks_config: 'research_hooks', heartbeat_hz: 144, heartbeat_is_timer: false
    };
  }

  function nodeOf(spec, fallbackId) {
    const row = spec || {};
    const word = String(row.word || '').trim();
    let phi, phaseName, glyph;
    if (word) {
      const placed = PPE.word(word);
      phi = whole(placed.Phi, 1);
      phaseName = placed.phase_name || ((KM.PHASES[phi] && KM.PHASES[phi].name) || '');
      glyph = placed.glyph || ((KM.PHASES[phi] && KM.PHASES[phi].glyph) || '');
    } else {
      phi = whole(row.Phi, 1);
      phaseName = (KM.PHASES[phi] && KM.PHASES[phi].name) || '';
      glyph = (KM.PHASES[phi] && KM.PHASES[phi].glyph) || '';
    }
    let mu = num(row.mu, null);
    if (mu === null) mu = Hooks.RESEARCH_HOOKS.mu_birth;
    return {
      id: String(row.id || fallbackId),
      Phi: phi,
      phase_name: phaseName,
      glyph: glyph,
      chi: num(row.chi, 0) ? 1 : 0,
      mu: mu,
      eps: num(row.eps, 0) || 0,
      Delta: num(row.Delta, 0) || 0,
      nu: num(row.nu, 0) || 0,
      word: word || null
    };
  }

  function walk(phases) {
    let dScore = 0;
    let flag48 = false;
    const nums = (phases || []).map(Number).filter(function (n) { return Number.isFinite(n); });
    for (let i = 1; i < nums.length; i++) {
      const prev = nums[i - 1];
      const nxt = nums[i];
      if (KM.luciferianDScore(prev, nxt) === 1) dScore = 1;
      else if (KM.FORBIDDEN.some(function (pair) { return pair[0] === prev && pair[1] === nxt; })) flag48 = true;
    }
    return { d_score: dScore, flag_4_to_8: flag48 };
  }

  function pair(body) {
    const raw = Array.isArray(body.nodes) ? body.nodes : [];
    const specs = raw.filter(function (row) { return row && typeof row === 'object'; });
    const left = nodeOf(specs[0] || { id: 'a', Phi: 1 }, 'a');
    const right = nodeOf(specs[1] || { id: 'b', Phi: 2 }, 'b');
    if (left.id === right.id) right.id = right.id + '-b';
    return [left, right];
  }

  function coordinate(left, right) {
    const geo = G.run({
      op: 'script',
      steps: [
        { op: 'birth', id: left.id, Phi: left.Phi, mu: left.mu, eps: left.eps, chi: left.chi, Delta: left.Delta, nu: left.nu },
        { op: 'birth', id: right.id, Phi: right.Phi, mu: right.mu, eps: right.eps, chi: right.chi, Delta: right.Delta, nu: right.nu },
        { op: 'merge', a: left.id, b: right.id, into: 'beat' }
      ]
    });
    const step = geo.log[2];
    return {
      ok: !!step.ok,
      delta: step.delta,
      reason: step.reason,
      pi_over_2_warning: !!step.pi_over_2_warning,
      warning_logged_only: true,
      admit_gate: false,
      window: 'pi/4'
    };
  }

  function driftCore(pathHard, phi) {
    const payload = pathHard ? nest(7) : { v: 1 };
    const prev = pathHard ? 5 : phi;
    const row = V43.score({ payload: payload, prev_phase: prev, recursion_n: 1 });
    return {
      d_score: row.d_score === 1 ? 1 : 0,
      disposition: row.disposition,
      categorical_hard_fire: !!row.categorical_hard_fire,
      phi_act: row.phi_act,
      phi_act_name: row.phi_act_name,
      laws: {
        C_min: row.laws.C_min,
        write_max: row.laws.write_max,
        hard_stop: row.laws.hard_stop,
        echo_min: row.laws.echo_min
      }
    };
  }

  function baseBody(extra) {
    return Object.assign({
      question: QUESTION,
      candidate: CANDIDATE,
      C: 0.9,
      drift: 0.2,
      nodes: [
        { id: 'a', Phi: 1, chi: 0, mu: 1, eps: 0, Delta: 0, nu: 0 },
        { id: 'b', Phi: 2, chi: 0, mu: 1, eps: 0, Delta: 0, nu: 0 }
      ]
    }, extra || {});
  }

  const HEARTBEAT = baseBody();
  const CRP = baseBody({ C: CRP_INTERNAL });
  const WARN = baseBody({ drift: WARN_INTERNAL });
  const CSTAR = baseBody({ C: C_STAR_INTERNAL });
  const LAW = baseBody({ C: 0.87, drift: 0.35 });
  const SKIP = baseBody({ path: [5, 8] });

  function evaluate(body) {
    const row = body || {};
    const nodes = pair(row);
    const left = nodes[0];
    const right = nodes[1];
    const path = Array.isArray(row.path) ? row.path : [];
    const stepped = walk(path);
    const core = driftCore(stepped.d_score === 1, left.Phi);
    const laws = core.laws;
    const question = String(row.question || '');
    const candidate = String(row.candidate || '');
    const drift = num(row.drift, 0) || 0;
    const source = String(row.source || '');
    const rendered = R.render({
      question: question,
      candidate: candidate,
      drift: drift,
      chi: 0,
      charge: 0.55,
      path: path,
      source: source
    });
    const echo = rendered.echo;
    const coherence = num(row.C, null);
    const wiki = source.toLowerCase().indexOf('wikipedia') >= 0;
    const hard = drift > Number(laws.hard_stop);
    const geometry = coordinate(left, right);
    const coordinated = !!(geometry.ok && stepped.d_score === 0 && !hard && !wiki);
    const crp = coherence !== null && coherence >= CRP_INTERNAL;
    const cStar = coherence !== null && coherence >= C_STAR_INTERNAL;
    const warn = drift >= WARN_INTERNAL;
    const echoOk = !!(echo && echo.pass) && Number(echo.score || 0) >= Number(laws.echo_min);
    const cOk = coherence !== null && coherence >= Number(laws.C_min);
    const writeOk = drift <= Number(laws.write_max);
    const lawWitness = !!(cOk && writeOk && echoOk && stepped.d_score === 0 && core.d_score === 0 && !wiki && !hard);
    let rule = 'GILIN-HEARTBEAT';
    if (wiki) rule = 'GILIN-WIKIPEDIA';
    else if (stepped.d_score === 1 || core.d_score === 1) rule = 'GILIN-5-TO-8';
    else if (hard) rule = 'GILIN-HARD-STOP';
    else if (!geometry.ok) rule = 'GILIN-WINDOW';
    else if (warn) rule = 'GILIN-WARN';
    else if (lawWitness) rule = 'GILIN-LAW-WITNESS';
    else if (cStar) rule = 'GILIN-C-STAR';
    else if (crp) rule = 'GILIN-CRP';
    return Object.assign({
      op: 'evaluate',
      rule: rule,
      question: question,
      candidate: candidate,
      C: coherence,
      drift: drift,
      nodes: [left, right],
      coordination: geometry,
      coordinated: coordinated,
      walk: stepped,
      drift_core: {
        d_score: core.d_score,
        disposition: core.disposition,
        categorical_hard_fire: core.categorical_hard_fire,
        phi_act: core.phi_act,
        phi_act_name: core.phi_act_name
      },
      echo: {
        score: echo.score,
        pass: echo.pass,
        compares: echo.compares
      },
      renderer: {
        rule: rendered.rule,
        response_closed: rendered.response_closed,
        output_empty: rendered.output === '',
        admit_gate: false
      },
      internal: {
        crp: crp,
        crp_threshold: CRP_INTERNAL,
        warn: warn,
        warn_threshold: WARN_INTERNAL,
        c_star: cStar,
        c_star_threshold: C_STAR_INTERNAL,
        logged_only: true,
        admit_gate: false
      },
      law_witness: lawWitness,
      write_ok: writeOk,
      c_ok: cOk,
      echo_ok: echoOk,
      laws: laws,
      hooks: {
        M: Hooks.memoryTermM(),
        mu_birth: Hooks.RESEARCH_HOOKS.mu_birth,
        mu_min: Hooks.RESEARCH_HOOKS.mu_min,
        mu_max: Hooks.RESEARCH_HOOKS.mu_max,
        spc_lambda: Hooks.spcLambda(),
        half_life_hours: Hooks.RESEARCH_HOOKS.half_life_hours,
        identity_half_life_hours: Hooks.RESEARCH_HOOKS.identity_half_life_hours,
        drift_loss: Hooks.RESEARCH_HOOKS.drift_loss
      },
      source: source,
      persisted: false,
      cite: CITE
    }, flags(laws));
  }

  function stage() {
    const beat = evaluate(HEARTBEAT);
    const crp = evaluate(CRP);
    const star = evaluate(CSTAR);
    const warned = evaluate(WARN);
    const law = evaluate(LAW);
    const skip = evaluate(SKIP);
    return Object.assign({
      persisted: false,
      coordinated: beat.coordinated,
      crp_admits: false,
      c_star_admits: false,
      warn_admits: false,
      crp_internal: crp.internal.crp,
      crp_law_witness: crp.law_witness,
      c_star_internal: star.internal.c_star,
      c_star_law_witness: star.law_witness,
      warn_internal: warned.internal.warn,
      warn_law_witness: warned.law_witness,
      law_witness: law.law_witness,
      law_admit_gate: false,
      skip_rule: skip.rule,
      skip_law_witness: skip.law_witness,
      M: beat.hooks.M,
      mu_min: beat.hooks.mu_min,
      mu_max: beat.hooks.mu_max,
      spc_lambda: beat.hooks.spc_lambda,
      half_life_hours: beat.hooks.half_life_hours,
      phase_names: [beat.nodes[0].phase_name, beat.nodes[1].phase_name],
      cite: CITE
    }, flags(beat.laws), { admit_gate: false });
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

  function monitorLines(mode) {
    const name = mode || 'heartbeat';
    if (name === 'crp') {
      const row = evaluate(CRP);
      return { mode: name, lines: [
        'Rule ' + row.rule + ' CRP ' + showNum(row.internal.crp) + ' C* ' + showNum(row.internal.c_star) + '.',
        'Law witness ' + showNum(row.law_witness) + ' admit gate ' + showNum(row.admit_gate) + '.',
        'C ' + showNum(row.C) + ' threshold 0.78 logged only.',
        'Echo ' + showNum(row.echo.score) + ' compares ' + String(row.echo.compares) + '.',
        'C_min 0.87. No LLM.'
      ] };
    }
    if (name === 'warn') {
      const row = evaluate(WARN);
      return { mode: name, lines: [
        'Rule ' + row.rule + ' warn ' + showNum(row.internal.warn) + ' write ok ' + showNum(row.write_ok) + '.',
        'Law witness ' + showNum(row.law_witness) + ' admit gate ' + showNum(row.admit_gate) + '.',
        'Drift ' + showNum(row.drift) + ' threshold 0.40 logged only.',
        'Hard stop ' + showNum(row.hard_stop) + '.',
        'C_min 0.87. No LLM.'
      ] };
    }
    if (name === 'cstar') {
      const row = evaluate(CSTAR);
      return { mode: name, lines: [
        'Rule ' + row.rule + ' C* ' + showNum(row.internal.c_star) + ' CRP ' + showNum(row.internal.crp) + '.',
        'Law witness ' + showNum(row.law_witness) + ' admit gate ' + showNum(row.admit_gate) + '.',
        'C ' + showNum(row.C) + ' threshold 0.82 logged only.',
        'Admission stays 0.87.',
        'C_min 0.87. No LLM.'
      ] };
    }
    if (name === 'law') {
      const row = evaluate(LAW);
      return { mode: name, lines: [
        'Rule ' + row.rule + ' law witness ' + showNum(row.law_witness) + '.',
        'Admit gate ' + showNum(row.admit_gate) + ' persisted ' + showNum(row.persisted) + '.',
        'C ' + showNum(row.C) + ' drift ' + showNum(row.drift) + ' echo ' + showNum(row.echo.score) + '.',
        'Write max 0.35. Echo min 0.85.',
        'C_min 0.87. No LLM.'
      ] };
    }
    if (name === 'skip') {
      const row = evaluate(SKIP);
      return { mode: name, lines: [
        'Rule ' + row.rule + ' d_score ' + showNum(row.walk.d_score) + ' core ' + showNum(row.drift_core.d_score) + '.',
        'Law witness ' + showNum(row.law_witness) + ' coordinated ' + showNum(row.coordinated) + '.',
        'Phase ' + row.drift_core.phi_act_name + ' categorical ' + showNum(row.drift_core.categorical_hard_fire) + '.',
        '4 to 8 is not this hard fire.',
        'C_min 0.87. No LLM.'
      ] };
    }
    const row = evaluate(HEARTBEAT);
    return { mode: 'heartbeat', lines: [
      'Rule ' + row.rule + ' coordinated ' + showNum(row.coordinated) + ' delta ' + showNum(row.coordination.delta) + '.',
      row.nodes[0].phase_name + ' ' + row.nodes[0].glyph + ' · ' + row.nodes[1].phase_name + ' ' + row.nodes[1].glyph + '.',
      'Law witness ' + showNum(row.law_witness) + ' admit gate ' + showNum(row.admit_gate) + '.',
      'M ' + showNum(row.hooks.M) + ' lambda ' + showNum(row.hooks.spc_lambda) + ' heartbeat 144 Hz log only.',
      'C_min 0.87. No LLM.'
    ] };
  }

  function paintMonitor(mode) {
    if (typeof document === 'undefined') return;
    const card = document.getElementById('gilin201');
    const host = document.getElementById('gilin201Body');
    if (!card || !host) return;
    const ran = monitorLines(mode || 'heartbeat');
    card.setAttribute('data-gilin201-mode', ran.mode);
    card.setAttribute('data-gilin201-status', ran.lines[0]);
    host.textContent = ran.lines.join('\n');
  }

  function bootMonitor() {
    if (typeof document === 'undefined' || !document.getElementById('gilin201')) return;
    paintMonitor('heartbeat');
    const buttons = document.querySelectorAll('[data-gilin201-run]');
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (ev) {
        paintMonitor(ev.currentTarget.getAttribute('data-gilin201-run'));
      });
    }
  }

  function run(payload) {
    const row = payload || {};
    const op = row.op || 'summary';
    if (op === 'evaluate') return evaluate(row);
    if (op === 'stage') return stage();
    if (op === 'monitor') return monitorLines(row.mode || 'heartbeat');
    const sample = V43.score({ payload: { v: 1 }, prev_phase: 1, recursion_n: 1 });
    return Object.assign({
      storage_key: STORAGE_KEY,
      cite: CITE,
      internal_thresholds: { crp: CRP_INTERNAL, warn: WARN_INTERNAL, c_star: C_STAR_INTERNAL, logged_only: true, admit_gate: false }
    }, flags(sample.laws));
  }

  const api = {
    CITE: CITE, STORAGE_KEY: STORAGE_KEY,
    HEARTBEAT: HEARTBEAT, CRP: CRP, WARN: WARN, CSTAR: CSTAR, LAW: LAW, SKIP: SKIP,
    evaluate: evaluate, stage: stage, monitorLines: monitorLines, paintMonitor: paintMonitor, run: run
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Gilin201 = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootMonitor);
    else bootMonitor();
  }
})(typeof self !== 'undefined' ? self : this);
