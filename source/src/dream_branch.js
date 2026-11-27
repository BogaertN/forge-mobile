/* Idle imagination. Bounded variations of an admitted law are scored together,
 * inside the sandbox. evolve.js, ede.js, and the RMC explorer all see the same
 * branches. The best is kept. Nothing here is a fact, and nothing is written. */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  function mods() {
    return {
      Mech: isNode ? require('./mechanisms.js') : root.KMechanisms,
      Evo: isNode ? require('./evolve.js') : root.KEvolve,
      Ede: isNode ? require('./ede.js') : root.KEDE,
      Box: isNode ? require('./sandbox.js') : root.KSandbox
    };
  }
  function num(row) { return row && typeof row === 'object' ? row.value : row; }
  function points(law) {
    const span = law && law.range || {};
    const names = Object.keys(span).filter(name => span[name] && span[name].max > span[name].min);
    if (!names.length) return [];
    const mid = {};
    names.forEach(name => { mid[name] = (span[name].min + span[name].max) / 2; });
    const out = [{ values: Object.assign({}, mid), varied: null, outside: false }];
    names.forEach(name => {
      const row = span[name];
      const past = row.max + (row.max - row.min) * 0.25;
      [row.min, mid[name], row.max, past].forEach(value => {
        const values = Object.assign({}, mid);
        values[name] = value;
        out.push({ values: values, varied: name, outside: value === past });
      });
    });
    const seen = {};
    return out.filter(row => {
      const key = Object.keys(row.values).sort().map(name => name + '=' + row.values[name]).join('|');
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    }).slice(0, 8);
  }
  function judge(Mech, law, point) {
    const values = {};
    Object.keys(point.values).forEach(name => { values[name] = { value: point.values[name], unit: law.range && law.range[name] && law.range[name].unit || null }; });
    if (law.kind === 'quantitative' && Mech.applyQuant) return Mech.applyQuant(law, values);
    if (Mech.apply) return Mech.apply(law, values);
    return { applied: false, reason: 'no_evaluator', fact: false };
  }
  function edgesOf(law) {
    const names = Object.keys(law.range || {});
    return names.map((name, i) => ({ id: 'e' + i, a: String(law.output || law.expression || 'law'), b: name, rel: 'depends', phi: 9 }));
  }
  function factsOf(branches) {
    return branches.filter(b => b.applied && typeof b.value === 'number').map(b => ({
      id: b.id,
      atom: { polarity: 'pos', predicate: 'predicts', args: [String(b.output || 'value'), String(b.value)] }
    }));
  }
  function explorer(report) {
    if (!isNode) return { ok: false, reason: 'browser_defers', calls_llm: false };
    try {
      const cp = require('child_process');
      const path = require('path');
      const rootDir = path.join(__dirname, '..');
      const py = 'import json,sys\nfrom rmc_engine_v1.evolutionary_drift_explorer import explore_evolutionary_drift\nprint(json.dumps(explore_evolutionary_drift(json.load(sys.stdin), max_branches=8)))';
      const env = Object.assign({}, process.env, { PYTHONPATH: [path.join(rootDir, 'engine'), rootDir, path.join(rootDir, '_mathlibs')].join(path.delimiter) });
      const proc = cp.spawnSync('python3', ['-c', py], { input: JSON.stringify(report), cwd: rootDir, env: env, encoding: 'utf8', maxBuffer: 1 << 22, timeout: 60000 });
      if (proc.status !== 0) return { ok: false, reason: String(proc.stderr || 'explorer').slice(-180), calls_llm: false };
      const row = JSON.parse(String(proc.stdout || '').trim().split('\n').pop());
      return { ok: true, calls_llm: false, memory_write_allowed: false, projection_allowed: false, branch_count: row && row.E_t && row.E_t.branch_count, bounded: row && row.E_t && row.E_t.bounded_branch_count, id: row && row.exploration_id };
    } catch (e) { return { ok: false, reason: String(e && e.message || e).slice(0, 180), calls_llm: false }; }
  }
  function search(laws, opts) {
    const { Mech, Evo, Ede, Box } = mods();
    const box = Box && Box.open ? Box.open() : { tag: x => x, atom: x => x };
    const admitted = (laws || []).filter(law => law && law.status === 'admitted' && law.fact === false);
    const branches = [];
    admitted.forEach(law => {
      points(law).forEach((point, i) => {
        const got = Mech ? judge(Mech, law, point) : { applied: false };
        const id = String(law.id || law.expression || 'law') + '#' + i;
        const row = {
          id: id, law: law.id || null, expression: law.expression || null, output: law.output || null,
          values: point.values, varied: point.varied, outside: point.outside === true,
          applied: got.applied === true, reason: got.reason || null, value: typeof got.value === 'number' ? got.value : null,
          unit: got.unit || law.unit || null, fact: false, may_store_as_fact: false
        };
        branches.push(box.tag(row));
      });
    });
    const edgeGroups = admitted.map(edgesOf).filter(rows => rows.length > 1);
    const ede = Ede && Ede.explore ? edgeGroups.map(edges => Ede.explore(edges, { seed: 1, budget: 8 })) : [];
    const facts = factsOf(branches);
    const evolved = Evo && Evo.evolve && facts.length >= 2 ? Evo.evolve(facts, { seed: 1, generations: 1, budget: 8 }) : null;
    branches.forEach(row => {
      const novel = ede.reduce((n, report) => n + ((report.retained || []).length ? 0.1 : 0), 0);
      row.score = (row.applied ? 2 : row.reason === 'out_of_range' ? 1 : 0) + novel;
    });
    branches.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const report = {
      candidate_set_id: 'dream-branch',
      candidate_generation_status: { candidate_generation_allowed: true },
      candidate_set: branches.slice(0, 8).map(row => ({
        candidate_id: row.id,
        candidate_kind: 'bounded_evolutionary_candidate',
        allowed_to_continue_to_scoring: row.applied === true,
        overextended: false,
        text: row.expression,
        measurement_kernel: {
          measurement_kernel_version: 'dream-branch/v1',
          epsilon_s: row.applied ? 0.1 : 0.5,
          novelty_delta: row.outside ? 0.4 : 0.2,
          novelty_budget: 0.75,
          bounded_evolutionary_drift: row.applied === true,
          circuit_breaker: false,
          D_score: 0, sigma_res: 0, semantic_distance: 0, memory_fit: 1,
          phase_metrics: { phase_path_legal: true, max_delta_phi: 0 }
        }
      }))
    };
    const scenes = sceneSearch(admitted, box, opts && opts.object);
    const ranked = report.candidate_set.length ? explorer(report) : { ok: false, reason: 'no_branch', calls_llm: false };
    const best = branches[0] ? box.tag(Object.assign({}, branches[0], { kept: true })) : null;
    const hypotheses = ((evolved && evolved.population) || []).slice(0, 4).map(row => box.tag({
      id: row.id, text: row.text, status: 'HYPOTHESIS', op: row.op, fact: false, may_store_as_fact: false
    }));
    return box.tag({
      branches: branches, best: best, hypotheses: hypotheses, scenes: scenes, report: report,
      ede: ede.map(r => ({ retained: (r.retained || []).length, archived: (r.archived || []).length })),
      evolved: evolved ? { explored: evolved.explored, population: (evolved.population || []).length } : null,
      explorer: ranked, calls_llm: false, fact: false, may_store_as_fact: false, dice: false
    });
  }
  function wordsOf(name) {
    const words = String(name || '').replace(/_/g, ' ').split(/[^A-Za-z0-9]+/).filter(Boolean);
    if (words.length > 1 && words[words.length - 1].length === 1) words.pop();
    return words;
  }
  function grammar() { return isNode ? require('./grammar.js') : root.KGrammar; }
  function say(clause, mark) {
    const G = grammar();
    if (!G || typeof G.clauseText !== 'function') return '';
    let text = '';
    try { text = String(G.clauseText(clause, 'user') || '').replace(/\s+/g, ' ').trim(); } catch (e) { text = ''; }
    if (!text) return '';
    text = text.charAt(0).toUpperCase() + text.slice(1);
    return mark === '?' ? text + '?' : (/[.!?]$/.test(text) ? text : text + '.');
  }
  const BE = { lemma: 'be', tense: 'present', pol: 'pos', mod: 'asserted' };
  const WAS = { lemma: 'be', tense: 'past', pol: 'pos', mod: 'asserted' };
  function formula(law, nums) {
    if (!law || law.form === 'exponential' || !Array.isArray(law.terms) || !law.terms.length) return null;
    let f = 1;
    for (let i = 0; i < law.terms.length; i++) {
      const x = nums[law.terms[i].name];
      if (typeof x !== 'number' || !isFinite(x)) return null;
      f *= Math.pow(x, law.terms[i].exp);
    }
    return law.scale == null ? f : law.scale * f;
  }
  /* Scene axes are the slots a mechanism already reads. A gap is a slot no admitted law records. */
  const GAPS = [
    { axis: 'material', name: 'density' },
    { axis: 'placement', name: 'fraction' },
    { axis: 'force', name: 'gravity' }
  ];
  function sceneSearch(admitted, box, objectName) {
    const { Mech } = mods();
    const object = wordsOf(objectName || 'object');
    const scenes = [];
    (admitted || []).forEach(law => {
      const span = law.range || {};
      Object.keys(span).forEach(name => {
        const row = span[name];
        if (!row || !(row.max > row.min)) return;
        const past = row.max + (row.max - row.min) * 0.25;
        const values = {};
        Object.keys(span).forEach(key => { values[key] = key === name ? past : (span[key].min + span[key].max) / 2; });
        const mech = Mech ? judge(Mech, law, { values: values }) : { applied: false };
        const sim = formula(law, values);
        const disagree = mech.reason === 'out_of_range' && typeof sim === 'number' && isFinite(sim);
        const question = say({
          subj: { head: ['what'] }, verb: BE,
          pred: { type: 'np', np: { det: 'the', head: wordsOf(law.output || 'result') } },
          sub: { conj: 'when', clause: { subj: { head: wordsOf(name) }, verb: BE, pred: { type: 'adj', words: ['untested'] } } }
        }, '?');
        scenes.push(box.tag({
          id: 'range:' + String(law.id || law.expression || 'law') + ':' + name,
          axis: 'range', name: name, object: object.join(' '), solver: law.solver || null, solvers: [law.solver || null],
          expression: law.expression || null, outside: true, missing: null,
          mechanism: mech.reason || (mech.applied ? 'applied' : 'silent'), simulator: sim,
          disagree: disagree, score: disagree ? 4 : 2, question: question,
          fact: false, may_store_as_fact: false
        }));
      });
    });
    const covered = {};
    (admitted || []).forEach(law => (law.variables || []).forEach(name => { covered[name] = true; }));
    GAPS.forEach(gap => {
      if (covered[gap.name]) return;
      const question = say({
        subj: { head: ['what'] }, verb: BE,
        pred: { type: 'np', np: { det: 'the', head: [gap.name], of: { det: 'the', head: object } } }
      }, '?');
      scenes.push(box.tag({
        id: 'gap:' + gap.axis + ':' + gap.name,
        axis: gap.axis, name: gap.name, object: object.join(' '), solver: null, solvers: [],
        expression: null, outside: false, missing: gap.name,
        mechanism: 'unmeasured', simulator: null, disagree: false,
        score: gap.name === 'density' ? 3 : 2, question: question,
        fact: false, may_store_as_fact: false
      }));
    });
    for (let i = 0; i < (admitted || []).length; i++) {
      for (let j = i + 1; j < admitted.length; j++) {
        const a = admitted[i], b = admitted[j];
        const shared = (a.variables || []).filter(name => (b.variables || []).indexOf(name) >= 0);
        const question = say({
          subj: { head: ['what'] }, verb: BE,
          pred: { type: 'np', np: { det: 'the', head: ['result'] } },
          sub: { conj: 'when', clause: { subj: { det: 'the', head: ['mechanisms'], plural: true }, verb: BE, pred: { type: 'adj', words: ['chained'] } } }
        }, '?');
        scenes.push(box.tag({
          id: 'chain:' + String(a.id || i) + '+' + String(b.id || j),
          axis: 'chain', name: shared[0] || null, object: object.join(' '),
          solver: a.solver || null, solvers: [a.solver || null, b.solver || null],
          expression: String(a.expression || '') + '+' + String(b.expression || ''),
          outside: false, missing: null, mechanism: a.expression || null, simulator: b.expression || null,
          disagree: String(a.expression || '') !== String(b.expression || ''),
          score: 3.5, question: question, fact: false, may_store_as_fact: false
        }));
      }
    }
    scenes.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return scenes;
  }
  function questions(found) {
    const rows = (found && found.scenes) || [];
    const seen = {};
    const picked = [];
    function take(pred) {
      const row = rows.find(r => r && r.question && !seen[r.question] && pred(r));
      if (!row) return;
      seen[row.question] = 1;
      picked.push(row);
    }
    take(r => r.axis === 'range');
    take(r => r.axis === 'range');
    take(r => r.missing === 'density');
    take(r => r.axis === 'chain');
    take(r => r.axis === 'placement' || r.axis === 'force');
    rows.forEach(r => { if (picked.length < 4 && r && r.question && !seen[r.question]) { seen[r.question] = 1; picked.push(r); } });
    return picked.slice(0, 4).map(row => ({
      kind: 'dream_hypothesis', question: row.question, axis: row.axis, name: row.name, score: row.score,
      hypothesis: true, experiment: row.axis === 'range' || row.axis === 'chain', athena_gap: row.missing != null,
      fact: false, may_store_as_fact: false, truth_support_allowed: false, stable_memory_allowed: false,
      projection_allowed: false, calls_llm: false
    }));
  }
  function narrate(topic, found) {
    const head = wordsOf(topic || 'object');
    const rows = (found && found.scenes) || [];
    const scene = rows.find(s => s && (s.axis === 'material' || s.axis === 'placement' || s.axis === 'force' || s.axis === 'chain')) || rows[0];
    const lead = say({ subj: { det: 'the', head: head }, verb: WAS, pred: { type: 'pp', prep: 'in', np: { det: 'the', head: ['scene'] } } });
    let because = '';
    if (scene && scene.missing) because = say({ subj: { det: 'the', head: [scene.missing] }, verb: WAS, pred: { type: 'adj', words: ['missing'] } });
    else if (scene && scene.outside) because = say({ subj: { head: wordsOf(scene.name) }, verb: WAS, pred: { type: 'adj', words: ['untested'] } });
    else if (scene && scene.axis === 'chain') because = say({ subj: { det: 'the', head: ['mechanisms'], plural: true }, verb: WAS, pred: { type: 'adj', words: ['chained'] } });
    const body = [lead, because].filter(Boolean).join(' ');
    return body ? 'Imagined. ' + body : '';
  }
  function imagine(topic, laws) {
    const found = search(laws || [], { object: topic });
    return {
      label: 'imagined', imagined: true, fact: false, may_store_as_fact: false, taint: 'sandbox', stored: false,
      story: narrate(topic, found), expression: found.best && found.best.expression || null,
      scenes: (found.scenes || []).length, question: (questions(found)[0] || {}).question || null, calls_llm: false
    };
  }
  function readExplorer(row) {
    if (!row || row.ok === false || (!row.E_t && !row.exploration_id && !row.branch_count)) {
      return { ok: false, reason: (row && (row.reason || row.error)) || 'explorer', calls_llm: false };
    }
    return {
      ok: true, calls_llm: false, memory_write_allowed: row.memory_write_allowed === true ? true : false,
      projection_allowed: false, path: 'pyodide',
      branch_count: (row.E_t && row.E_t.branch_count) || row.branch_count || null,
      id: row.exploration_id || null
    };
  }
  function consider(laws, mode) {
    const found = search(laws);
    const asked = questions(found)[0] || null;
    if (mode === 'creative') {
      return {
        label: 'imagined', imagined: true, fact: false, may_store_as_fact: false, taint: 'sandbox', stored: false,
        expression: found.best && found.best.expression || null,
        story: narrate('object', found),
        question: asked && asked.question || null, calls_llm: false
      };
    }
    return {
      label: 'hypothesis', imagined: false, fact: false, may_store_as_fact: false,
      answer_from: 'real_world', reply: null,
      question: asked && asked.question || null, calls_llm: false
    };
  }
  const api = { search: search, points: points, questions: questions, consider: consider, imagine: imagine, narrate: narrate, readExplorer: readExplorer };
  if (isNode) module.exports = api; else root.KDreamBranch = api;
})(typeof self !== 'undefined' ? self : this);
