/* 4.9.200 RMC renderer.
 * Sentence plan, template, decode, then Echo against the original question.
 * Calls the 4.9.197 lexicon, the v4.3 laws, kmath, the echo coverage rule,
 * and the geometry hooks. Does not copy those formulas.
 * No model. A failing Echo returns no output. */
(function (root) {
  const KM = (typeof module !== 'undefined' && module.exports) ? require('./kmath.js') : root.KMath;
  const V43 = (typeof module !== 'undefined' && module.exports) ? require('./drift_v43.js') : root.DriftV43;
  const PPE = (typeof module !== 'undefined' && module.exports) ? require('./ppe_lexicon_197.js') : root.Ppe197;
  const G = (typeof module !== 'undefined' && module.exports) ? require('./geometry_199.js') : root.Geometry199;
  const SHA = (typeof module !== 'undefined' && module.exports) ? require('./sha256.js') : root.KSha;
  const Hooks = (typeof module !== 'undefined' && module.exports) ? require('./research_hooks.js') : root.ResearchHooks;
  const LAW = V43.score({ payload: { v: 1 }, prev_phase: 1, recursion_n: 1 }).laws;
  const STORAGE_KEY = 'kernel.rmc_renderer_200';
  const CITE = 'RMC algorithm 5. Sentence plan, template render, decode, then Echo at or above 0.85 against the original question. Echo Preservation E = R*psi(t-tau) is Waking the Web l275 and is an internal sub-check. Codex 3.5 binds the answer to the question loop and withholds output until response_closed (a l.1810-1828). Tone bands choose the template (a l.2164-2168). The coverage rule is echo_question. The 0.6 tone cut is log-only. No model.';
  const STOP = {
    the: 1, and: 1, for: 1, with: 1, from: 1, that: 1, this: 1, what: 1, which: 1, when: 1,
    where: 1, who: 1, whom: 1, why: 1, how: 1, are: 1, was: 1, were: 1, you: 1, your: 1,
    does: 1, did: 1, can: 1, could: 1, into: 1, about: 1, have: 1, has: 1, not: 1, but: 1
  };
  const PASS = {
    question: 'Why is the sky blue?',
    candidate: 'The sky is blue because sunlight scatters.',
    charge: 0.55,
    drift: 0.2,
    chi: 0
  };
  const FAIL = {
    question: 'Why is the sky blue?',
    candidate: 'Chlorine gas is toxic.',
    charge: 0.55,
    drift: 0.2,
    chi: 0
  };

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

  function round6(x) {
    return Math.round(Number(x) * 1e6) / 1e6;
  }

  function flags() {
    return {
      admit_gate: false, keyword_admit: false, writes: false, calls_llm: false, network: false,
      money: false, dream_idle: false, economy: false, packs_gated: true,
      christping: 'gilligan-only', christping_started: false, wikipedia_anchor: false,
      c_min: LAW.C_min, echo_min: LAW.echo_min, write_max: LAW.write_max, hard_stop: LAW.hard_stop,
      resonance_not_parsing: true, coherence_formula_unchanged: true,
      renderer_build: '4.9.200',
      merge_window: Math.abs(KM.MERGE_WINDOW - Math.PI / 4) < 1e-12 ? 'pi/4' : 'mismatch',
      hooks_config: 'research_hooks'
    };
  }

  function contentWords(text) {
    const out = [];
    const seen = {};
    const re = /[a-z0-9]+/g;
    const s = String(text || '').toLowerCase();
    let m;
    while ((m = re.exec(s))) {
      const w = m[0];
      if (w.length > 2 && !STOP[w] && !seen[w]) {
        seen[w] = true;
        out.push(w);
      }
    }
    return out;
  }

  function echoOf(question, outputText) {
    const left = contentWords(question);
    const right = {};
    contentWords(outputText).forEach(function (w) { right[w] = true; });
    let score = 0;
    if (left.length) {
      let hit = 0;
      left.forEach(function (w) { if (right[w]) hit += 1; });
      score = hit / left.length;
    }
    score = round6(score);
    return {
      score: score,
      min: LAW.echo_min,
      pass: score >= LAW.echo_min,
      method: 'question_meaning_coverage',
      compares: 'rendered_answer_to_original_question_meaning',
      output_text: String(outputText || '').slice(0, 400)
    };
  }

  function packet(word) {
    const row = PPE.word(word);
    return {
      word: row.word,
      Phi: row.Phi,
      phase_name: row.phase_name,
      glyph: row.glyph,
      angle_degrees: row.angle_degrees
    };
  }

  function walk(phases) {
    let dScore = 0;
    let flag48 = false;
    for (let i = 1; i < phases.length; i++) {
      const prev = Number(phases[i - 1]);
      const next = Number(phases[i]);
      if (KM.luciferianDScore(prev, next) === 1) dScore = 1;
      else if (KM.FORBIDDEN.some(function (pair) { return pair[0] === prev && pair[1] === next; })) flag48 = true;
    }
    return { d_score: dScore, flag_4_to_8: flag48 };
  }

  function toneOf(charge, phi, chi, drift) {
    const supplied = !(charge === undefined || charge === null || charge === '');
    const c = supplied ? num(charge, 0.55) : 0.55;
    const base = {
      charge: r4(c), charge_supplied: supplied, phi: phi, admit_gate: false,
      intermediate_bounds: 'unspecified', logged_only: false,
      cite: 'Codex tone_engine 3.9 a l.2164-2168. Charge 0-0.3 is silent. Charge 0.91-1 is expressive. Phi 1-3 is cautious, 4-6 structured, 7-9 fluid. Null when chi is set or drift is above 0.6. The 0.6 cut is log-only.'
    };
    if (chi) return Object.assign(base, { id: 'null', reason: 'chi', logged_only: true });
    if (num(drift, 0) > 0.6) return Object.assign(base, { id: 'null', reason: 'drift-above-0.6', logged_only: true });
    if (c <= 0.3) return Object.assign(base, { id: 'silent', reason: 'charge-0-to-0.3' });
    if (c >= 0.91) return Object.assign(base, { id: 'expressive', reason: 'charge-0.91-to-1' });
    const n = Math.round(Number(phi)) || 1;
    const id = n <= 3 ? 'cautious' : n <= 6 ? 'structured' : 'fluid';
    return Object.assign(base, { id: id, reason: 'phase-family', logged_only: true });
  }

  function speak(id, sentence) {
    const body = String(sentence || '').trim();
    if (!body || id === 'silent' || id === 'null') return '';
    if (id === 'cautious') return 'Noted with care: ' + body;
    if (id === 'fluid') return 'The return is this: ' + body;
    if (id === 'expressive') return 'Spoken in full: ' + body;
    return body;
  }

  function covers(outer, inner) {
    const have = {};
    contentWords(outer).forEach(function (w) { have[w] = true; });
    return inner.every(function (w) { return !!have[w]; });
  }

  function preservation(score, qPhi, aPhi) {
    const cite = 'Waking the Web l275. Echo Preservation E = R*psi(t-tau). Internal sub-check. It does not admit.';
    const base = {
      formula: 'E = R*psi(t-tau)', R: score, psi: null, E: null,
      admit_gate: false, internal_only: true, cite: cite
    };
    if (!Number.isFinite(Number(qPhi)) || !Number.isFinite(Number(aPhi))) return base;
    const delta = KM.cdist(KM.phaseAngle(Number(qPhi)), KM.phaseAngle(Number(aPhi)));
    const psi = (1 + Math.cos(delta)) / 2;
    return Object.assign(base, { psi: r4(psi), E: r4(score * psi) });
  }

  function hookReport() {
    const m = Hooks.memoryTermM();
    const lam = Hooks.spcLambda();
    const set = !(m === undefined || m === null || m === '') || !(lam === undefined || lam === null || lam === '');
    return { config: 'research_hooks', M: m, spc_lambda: lam, parameterized: set };
  }

  function render(body) {
    const row = body || {};
    const question = String(row.question || '');
    const candidate = String(row.candidate || '');
    const qWords = contentWords(question).map(packet);
    const aWords = contentWords(candidate).map(packet);
    const qPhi = qWords.length && Number.isFinite(Number(qWords[0].Phi)) ? Number(qWords[0].Phi) : null;
    const aPhi = aWords.length && Number.isFinite(Number(aWords[0].Phi)) ? Number(aWords[0].Phi) : null;
    const phi = Number.isFinite(Number(row.phi)) ? Number(row.phi) : (aPhi || qPhi || 1);
    const drift = num(row.drift, 0);
    const chi = num(row.chi, 0) ? 1 : 0;
    const tone = toneOf(row.charge, phi, chi, drift);
    const spoken = speak(tone.id, candidate);
    const compared = spoken || candidate;
    const echo = echoOf(question, compared);
    const answerWords = aWords.map(function (w) { return w.word; });
    const decode = {
      pass: spoken ? covers(spoken, answerWords) : false,
      answer_words: answerWords,
      admit_gate: false
    };
    const wordPhases = aWords.map(function (w) { return w.Phi; }).filter(function (n) { return Number.isFinite(Number(n)); });
    const pathPhases = Array.isArray(row.path) ? row.path.map(Number).filter(function (n) { return Number.isFinite(n); }) : [];
    const wordWalk = walk(wordPhases);
    const pathWalk = walk(pathPhases);
    const stepped = {
      d_score: wordWalk.d_score || pathWalk.d_score ? 1 : 0,
      flag_4_to_8: !!(wordWalk.flag_4_to_8 || pathWalk.flag_4_to_8)
    };
    const loop = SHA.sha256(question);
    const supplied = row.loop_id;
    const loopBound = supplied === undefined || supplied === null || supplied === '' || supplied === loop;
    const source = String(row.source || '');
    const wiki = source.toLowerCase().indexOf('wikipedia') >= 0;
    let rule = 'RENDER-CLOSED';
    if (wiki) rule = 'WIKIPEDIA-NOT-ANCHOR';
    else if (stepped.d_score === 1) rule = 'RENDER-5-TO-8';
    else if (drift > LAW.hard_stop) rule = 'RENDER-HARD-STOP';
    else if (!echo.pass) rule = 'RENDER-ECHO';
    else if (!(drift <= LAW.write_max)) rule = 'RENDER-DRIFT';
    else if (tone.id === 'null') rule = 'RENDER-TONE-NULL';
    else if (tone.id === 'silent') rule = 'RENDER-TONE-SILENT';
    else if (!loopBound) rule = 'RENDER-ANCHOR';
    else if (!decode.pass) rule = 'RENDER-DECODE';
    const closed = rule === 'RENDER-CLOSED';
    return Object.assign({
      op: 'render',
      question: question,
      candidate: candidate,
      output: closed ? spoken : '',
      response_closed: closed,
      rule: rule,
      echo: echo,
      preservation: preservation(echo.score, qPhi, aPhi),
      tone: tone,
      decode: decode,
      anchor: {
        loop_id: loop,
        bound: loopBound,
        question: question,
        cite: 'Codex 3.5 intention anchor a l.1810-1828. The answer is bound to the question loop. No output unless response_closed.'
      },
      plan: {
        question_words: qWords,
        answer_words: aWords,
        clauses: [
          { role: 'anchor', text: question },
          { role: 'answer', text: candidate }
        ]
      },
      walk: stepped,
      drift: r4(drift),
      chi: chi,
      source: source,
      reflection: closed ? null : { held: true, reason: rule, loop_id: loop },
      hooks: hookReport(),
      persisted: false,
      cite: CITE
    }, flags());
  }

  function script(steps) {
    return Object.assign({ op: 'script', log: (steps || []).map(render), steps: (steps || []).length }, flags());
  }

  function stage() {
    const passed = render(PASS);
    const failed = render(FAIL);
    return Object.assign({
      persisted: false,
      response_closed: passed.response_closed,
      failing_echo_output: failed.output,
      failing_echo_closed: failed.response_closed,
      failing_echo_rule: failed.rule,
      loop_bound: passed.anchor.bound,
      echo_pass: passed.echo.pass,
      output_withheld_on_echo_fail: failed.output === '',
      M: Hooks.memoryTermM(),
      spc_lambda: Hooks.spcLambda(),
      cite: CITE
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

  function monitorLines(mode) {
    const name = mode || 'pass';
    if (name === 'echo') {
      const row = render(FAIL);
      return { mode: name, lines: [
        'Output [' + row.output + '] rule ' + row.rule + '.',
        'Closed ' + showNum(row.response_closed) + ' echo ' + showNum(row.echo.score) + ' pass ' + showNum(row.echo.pass) + '.',
        'Reflection ' + showNum(row.reflection && row.reflection.held) + '.',
        'Network ' + showNum(row.network) + '.',
        'C_min 0.87. No LLM.'
      ] };
    }
    if (name === 'tone') {
      const silent = render(Object.assign({}, PASS, { charge: 0.2 }));
      const loud = render(Object.assign({}, PASS, { charge: 0.95 }));
      const nulled = render(Object.assign({}, PASS, { chi: 1, charge: 0.95 }));
      return { mode: name, lines: [
        'Silent rule ' + silent.rule + ' output [' + silent.output + '].',
        'Expressive ' + loud.output,
        'Chi null rule ' + nulled.rule + ' logged ' + showNum(nulled.tone.logged_only) + '.',
        'Admit gate ' + showNum(silent.admit_gate) + '.',
        'C_min 0.87. No LLM.'
      ] };
    }
    if (name === 'anchor') {
      const row = render(Object.assign({}, PASS, { loop_id: 'other-loop' }));
      return { mode: name, lines: [
        'Rule ' + row.rule + ' output [' + row.output + '].',
        'Bound ' + showNum(row.anchor.bound) + ' closed ' + showNum(row.response_closed) + '.',
        'Loop ' + row.anchor.loop_id + '.',
        'ChristPing started ' + showNum(row.christping_started) + '.',
        'C_min 0.87. No LLM.'
      ] };
    }
    if (name === 'hooks') {
      const geo = G.run({
        op: 'script',
        steps: [
          { op: 'birth', id: 'p', Phi: 1, mu: 1, eps: 0, chi: 0, Delta: 0, nu: 0, H: 1 },
          { op: 'memory', id: 'p' },
          { op: 'spc', id: 'p', lambda: null }
        ]
      });
      const mem = geo.log[1];
      const spc = geo.log[2];
      const hooks = hookReport();
      return { mode: name, lines: [
        'M ' + showNum(mem.M) + ' lambda unspecified ' + showNum(mem.lambda_unspecified) + '.',
        'SPC parameterized ' + showNum(spc.parameterized) + ' config ' + hooks.config + '.',
        'Hook M ' + showNum(hooks.M) + ' hook lambda ' + showNum(hooks.spc_lambda) + ' parameterized ' + showNum(hooks.parameterized) + '.',
        'Merge window ' + flags().merge_window + '.',
        'C_min 0.87. No LLM.'
      ] };
    }
    const row = render(PASS);
    return { mode: 'pass', lines: [
      'Output ' + row.output,
      'Closed ' + showNum(row.response_closed) + ' rule ' + row.rule + ' echo ' + showNum(row.echo.score) + '.',
      'Loop ' + row.anchor.loop_id + ' bound ' + showNum(row.anchor.bound) + '.',
      'Phase ' + ((row.plan.question_words[0] && row.plan.question_words[0].phase_name) || '') + ' glyph set ' + showNum(!!(row.plan.question_words[0] && row.plan.question_words[0].glyph)) + '.',
      'C_min 0.87. No LLM.'
    ] };
  }

  function paintMonitor(mode) {
    if (typeof document === 'undefined') return;
    const card = document.getElementById('renderer200');
    const host = document.getElementById('renderer200Body');
    if (!card || !host) return;
    const ran = monitorLines(mode || 'pass');
    card.setAttribute('data-renderer200-mode', ran.mode);
    card.setAttribute('data-renderer200-status', ran.lines[0]);
    host.textContent = ran.lines.join('\n');
  }

  function bootMonitor() {
    if (typeof document === 'undefined' || !document.getElementById('renderer200')) return;
    paintMonitor('pass');
    const buttons = document.querySelectorAll('[data-renderer200-run]');
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (ev) {
        paintMonitor(ev.currentTarget.getAttribute('data-renderer200-run'));
      });
    }
  }

  function run(payload) {
    const row = payload || {};
    const op = row.op || 'summary';
    if (op === 'render') return render(row);
    if (op === 'script') return script(row.steps || []);
    if (op === 'stage') return stage();
    if (op === 'monitor') return monitorLines(row.mode || 'pass');
    return Object.assign({ storage_key: STORAGE_KEY, cite: CITE, hooks: hookReport() }, flags());
  }

  const api = {
    CITE: CITE, STORAGE_KEY: STORAGE_KEY, PASS: PASS, FAIL: FAIL,
    render: render, script: script, stage: stage, monitorLines: monitorLines,
    paintMonitor: paintMonitor, run: run
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RmcRenderer200 = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootMonitor);
    else bootMonitor();
  }
})(typeof self !== 'undefined' ? self : this);
