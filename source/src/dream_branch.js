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
    const scenes = sceneSearch(admitted, box, opts || {});
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
  const BANNED = { mechanism: 1, mechanisms: 1, scene: 1, branch: 1, chained: 1, imagined: 1, sandbox: 1, untested: 1 };
  function wordsOf(name) {
    const words = String(name || '').replace(/_/g, ' ').split(/[^A-Za-z0-9]+/).filter(Boolean);
    if (words.length > 1 && words[words.length - 1].length === 1) words.pop();
    return words.filter(w => !BANNED[w.toLowerCase()]);
  }
  function grammar() { return isNode ? require('./grammar.js') : root.KGrammar; }
  function say(clause, mark, persp) {
    const G = grammar();
    if (!G || typeof G.clauseText !== 'function') return '';
    let text = '';
    try { text = String(G.clauseText(clause, persp || 'user') || '').replace(/\s+/g, ' ').trim(); } catch (e) { text = ''; }
    if (!text || forbidden(text)) return '';
    if (mark === 'raw') return text;
    text = text.charAt(0).toUpperCase() + text.slice(1);
    return mark === '?' ? text + '?' : (/[.!?]$/.test(text) ? text : text + '.');
  }
  function forbidden(text) {
    return String(text || '').toLowerCase().split(/[^a-z]+/).some(w => BANNED[w]);
  }
  function numText(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '';
    const digits = Math.abs(n) >= 1 ? 1000 : 10000;
    const rounded = Math.round(n * digits) / digits;
    return String(rounded);
  }
  function speakUnit(unit) {
    const u = String(unit || '').toLowerCase();
    if (u === 'v' || u === 'volt' || u === 'volts') return 'volts';
    if (u === 'ohm' || u === 'ohms') return 'ohms';
    if (u === 'a' || u === 'amp' || u === 'amps' || u === 'ampere' || u === 'amperes') return 'amperes';
    if (u === 'kg') return 'kilograms';
    if (u === 'm') return 'meters';
    return u;
  }
  function quantityWords(name, unit) {
    const u = String(unit || '').toLowerCase();
    if (u === 'v' || u === 'volt' || u === 'volts') return ['voltage'];
    if (u === 'ohm' || u === 'ohms') return ['resistance'];
    if (u === 'a' || u === 'amp' || u === 'amps' || u === 'ampere' || u === 'amperes') return ['current'];
    if (name === 'density' || u.indexOf('kg/m') === 0) return ['density'];
    return wordsOf(name);
  }
  function isVolt(unit) { const u = String(unit || '').toLowerCase(); return u === 'v' || u === 'volt' || u === 'volts'; }
  function isOhm(unit) { const u = String(unit || '').toLowerCase(); return u === 'ohm' || u === 'ohms'; }
  function circuitQuestion(voltage, resistance) {
    const cond = say({
      subj: { pron: 'user' },
      verb: { lemma: 'put', tense: 'present', pol: 'pos', mod: 'asserted' },
      roles: { karma: { head: [numText(voltage), Number(numText(voltage)) === 1 ? 'volt' : 'volts'] } },
      adj: [{ prep: 'across', np: { det: 'a', head: [numText(resistance), 'ohm', 'resistor'] } }]
    }, 'raw', 'kernel');
    if (!cond) return '';
    return 'What happens if ' + cond + '?';
  }
  function whenQuestion(outputWords, pairs) {
    const parts = pairs.filter(p => p && p.words && p.words.length && p.num).map(p => ({
      subj: { det: 'the', head: p.words }, verb: BE,
      pred: { type: 'measure', num: p.num, unit: p.unit }
    }));
    if (!parts.length || !outputWords.length) return '';
    const when = parts.length === 1 ? parts[0] : { coord: parts, op: 'and', comma: false };
    return say({
      subj: { head: ['what'] }, verb: BE,
      pred: { type: 'np', np: { det: 'the', head: outputWords } },
      sub: { conj: 'when', clause: when }
    }, '?');
  }
  function resultSentence(outputWords, value, unit) {
    let n = value, u = speakUnit(unit);
    if (u === 'amperes' && typeof value === 'number' && Math.abs(value) < 1) { n = value * 1000; u = 'milliamps'; }
    return say({
      subj: { det: 'the', head: outputWords }, verb: BE,
      pred: { type: 'measure', num: numText(n), unit: u }
    });
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
  function namedNoun(opts, circuit) {
    const nouns = (opts && opts.nouns) || [];
    const topic = wordsOf(opts && opts.object);
    const picked = nouns.map(n => String(n || '').toLowerCase().trim()).find(n => n && n !== 'object' && !BANNED[n]);
    if (picked) return wordsOf(picked);
    if (topic.length && topic.join(' ') !== 'object') return topic;
    if (circuit) return ['resistor'];
    return [];
  }
  function sceneSearch(admitted, box, opts) {
    const { Mech } = mods();
    const scenes = [];
    (admitted || []).forEach(law => {
      const span = law.range || {};
      const names = Object.keys(span).filter(name => span[name] && span[name].max > span[name].min);
      const circuit = names.some(name => isVolt(span[name].unit)) && names.some(name => isOhm(span[name].unit));
      const noun = namedNoun(opts, circuit);
      names.forEach(name => {
        const row = span[name];
        const past = Math.ceil(row.max + (row.max - row.min) * 0.25);
        const below = Math.floor(row.min - (row.max - row.min) * 0.25);
        [past, below].forEach(point => {
          if (!(point > 0) || point === row.min || point === row.max) return;
          const values = {};
          names.forEach(key => {
            if (key === name) values[key] = point;
            else {
              const mid = (span[key].min + span[key].max) / 2;
              const rounded = Math.round(mid);
              values[key] = rounded > span[key].min && rounded < span[key].max ? rounded : mid;
            }
          });
          const mech = Mech ? judge(Mech, law, { values: values }) : { applied: false };
          const sim = formula(law, values);
          const disagree = mech.reason === 'out_of_range' && typeof sim === 'number' && isFinite(sim);
          const volt = names.filter(isName => isVolt(span[isName].unit))[0];
          const ohm = names.filter(isName => isOhm(span[isName].unit))[0];
          const pairs = names.map(key => ({ words: quantityWords(key, span[key].unit), num: numText(values[key]), unit: speakUnit(span[key].unit) }));
          const output = quantityWords(law.output, law.unit);
          const question = circuit && volt && ohm
            ? circuitQuestion(values[volt], values[ohm])
            : whenQuestion(output, pairs);
          if (!question) return;
          scenes.push(box.tag({
            id: 'range:' + String(law.id || law.expression || 'law') + ':' + name + ':' + numText(point),
            axis: 'range', name: name, object: noun.join(' '), solver: law.solver || null,
            expression: law.expression || null, outside: point > row.max || point < row.min, missing: null,
            values: values, unit: law.unit || null,
            mechanism: mech.reason || (mech.applied ? 'applied' : 'silent'), simulator: sim,
            disagree: disagree, score: disagree ? 4 : 2, question: question,
            probe: { kind: circuit ? 'circuit' : 'quant', ask: question, value: sim, output: output, unit: law.unit || null, values: values },
            fact: false, may_store_as_fact: false
          }));
        });
      });
    });
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
    take(r => r.axis === 'range' && r.name && (found.scenes || []).some(s => s && s.expression === r.expression && (s.values && Object.prototype.hasOwnProperty.call(s.values, r.name))));
    take(r => r.axis === 'range');
    take(r => r.axis === 'range');
    take(r => r.axis === 'range');
    rows.forEach(r => { if (picked.length < 4 && r && r.question && !seen[r.question]) { seen[r.question] = 1; picked.push(r); } });
    return picked.slice(0, 4).map(row => ({
      kind: 'dream_hypothesis', question: row.question, axis: row.axis, name: row.name, score: row.score,
      hypothesis: true, experiment: row.axis === 'range', athena_gap: row.missing != null,
      probe: row.probe ? { kind: row.probe.kind, ask: row.probe.ask, value: row.probe.value, output: row.probe.output, unit: row.probe.unit, noun: row.probe.noun || null, values: row.probe.values } : null,
      fact: false, may_store_as_fact: false, truth_support_allowed: false, stable_memory_allowed: false,
      projection_allowed: false, calls_llm: false
    }));
  }
  function clauseSentences(topic, clauses) {
    const lines = [];
    const seen = {};
    const head = String(topic || '').toLowerCase();
    (clauses || []).forEach(row => {
      let text = String(row && row.text || row || '').replace(/\s+/g, ' ').trim();
      if (!text || forbidden(text)) return;
      if (head && text.toLowerCase().indexOf(head) < 0) return;
      const words = text.replace(/[.!?]+$/, '').split(/\s+/);
      if (words.length <= 4 && BANNED[words[words.length - 1].toLowerCase()]) return;
      if (/^a\s+\S+\s+is\s+any\.?$/i.test(text)) return;
      if (!/[.!?]$/.test(text)) text += '.';
      const key = text.toLowerCase();
      if (seen[key]) return;
      seen[key] = 1;
      lines.push(text.charAt(0).toUpperCase() + text.slice(1));
    });
    return lines;
  }
  function simSentences(sims) {
    const lines = [];
    (sims || []).forEach(sim => {
      const atoms = (sim && sim.spoken_atoms) || (sim && sim.sim && sim.sim.spoken_atoms) || [];
      atoms.forEach(atom => { if (atom && atom.text && !forbidden(atom.text)) lines.push(String(atom.text).trim()); });
      ['effect_text', 'causal_reason'].forEach(key => {
        if (sim && sim[key] && !forbidden(sim[key])) lines.push(String(sim[key]).trim());
      });
    });
    return lines;
  }
  function coveredWords(text, topic) {
    const stop = { a: 1, an: 1, the: 1, is: 1, was: 1, were: 1, are: 1, be: 1, and: 1, of: 1, with: 1, has: 1, have: 1, had: 1 };
    const head = String(topic || '').toLowerCase();
    return String(text || '').toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter(w => w && w !== head && !stop[w] && w.length > 2);
  }
  function withoutRepeat(topic, lines) {
    const seen = {};
    const covered = {};
    return lines.filter(text => {
      const key = String(text || '').toLowerCase();
      if (!text || seen[key] || forbidden(text)) return false;
      const words = coveredWords(text, topic);
      if (words.length && words.every(w => covered[w])) return false;
      seen[key] = 1;
      words.forEach(w => { covered[w] = 1; });
      return true;
    });
  }
  function prose(topic, clauses, sims, act, events) {
    const facts = withoutRepeat(topic, clauseSentences(topic, clauses));
    if (act === 'narrate' || act === 'compose') {
      const told = withoutRepeat(topic, events || []);
      let setting = '';
      const consequences = [];
      (sims || []).forEach(sim => {
        const built = storySim(sim);
        if (built) {
          if (built.before && !setting) setting = built.before;
          built.lines.forEach(text => { if (text && consequences.indexOf(text) < 0) consequences.push(text); });
          return;
        }
        simSentences([sim]).forEach(text => { if (text && consequences.indexOf(text) < 0) consequences.push(text); });
      });
      const lines = [];
      const seen = {};
      [setting].concat(told).concat(consequences).forEach(text => {
        if (!text || seen[text] || forbidden(text)) return;
        seen[text] = 1;
        lines.push(text);
      });
      const body = lines.length ? lines : withoutRepeat(topic, facts);
      return act === 'compose' ? body.join('\n') : body.join(' ');
    }
    return withoutRepeat(topic, facts.concat(simSentences(sims))).join(' ');
  }
  function ingStem(word, lex) {
    const w = String(word || '');
    if (!w.endsWith('ing') || w.length < 6 || !lex || !lex.hasPos) return '';
    const known = lex.exc && lex.exc(w);
    if (known && lex.hasPos(known, 'v')) return known;
    const base = w.slice(0, -3);
    const restored = base + 'e';
    const cands = [];
    if (lex.hasPos(restored, 'v')) cands.push(restored);
    if (lex.hasPos(base, 'v')) cands.push(base);
    if (base.length > 2 && base.charAt(base.length - 1) === base.charAt(base.length - 2)) {
      const undoubled = base.slice(0, -1);
      if (lex.hasPos(undoubled, 'v')) cands.push(undoubled);
    }
    const uniq = cands.filter((item, i) => cands.indexOf(item) === i);
    uniq.sort((a, b) => {
      const klass = item => { const s = (lex.senses(item) || []).find(x => x && x.pos === 'v'); return s && s.lexname || ''; };
      const rank = item => klass(item) === 'verb.motion' ? 0 : 1;
      return rank(a) - rank(b) || a.length - b.length;
    });
    return uniq[0] || '';
  }
  function wnHyp(lex, id) {
    const banks = (lex && lex.wn) || {};
    for (const tier of ['core', 'ext', 'pro']) {
      const table = banks[tier] && banks[tier].H;
      if (table && Object.prototype.hasOwnProperty.call(table, id)) return table[id];
    }
    return [];
  }
  function wnName(lex, id) {
    const banks = (lex && lex.wn) || {};
    for (const tier of ['core', 'ext', 'pro']) {
      const table = banks[tier] && banks[tier].N;
      if (table && Object.prototype.hasOwnProperty.call(table, id)) return String(table[id] || '').replace(/_/g, ' ');
    }
    return '';
  }
  function oneSister(lex, topic) {
    const senses = ((lex && lex.senses && lex.senses(topic)) || []).filter(s => s && s.pos === 'n' && s.lexname === 'noun.animal');
    const sense = senses[0];
    const id = String((sense && (sense.sid || sense.id)) || '').replace(/^wn30:/, '');
    const parent = (wnHyp(lex, id) || [])[0];
    if (!parent) return '';
    const names = [];
    for (const tier of ['core', 'ext', 'pro']) {
      const table = lex.wn[tier] && lex.wn[tier].H;
      if (!table) continue;
      for (const child in table) {
        if (child !== id && table[child] && table[child][0] === parent) {
          const name = wnName(lex, child);
          if (name && name.indexOf(' ') < 0 && name.indexOf('-') < 0 && name !== topic) names.push(name);
          if (names.length >= 1) return names[0];
        }
      }
    }
    return '';
  }
  function mediumOf(lex, lemma, depth) {
    if (!lex || !lex.senses || depth > 1) return null;
    const sense = (lex.senses(lemma) || []).find(s => s && s.pos === 'v' && s.gloss);
    if (!sense) return null;
    const preps = { in: 1, through: 1, on: 1, into: 1, over: 1 };
    const skipName = { cognition: 1, attribute: 1, act: 1, communication: 1, feeling: 1, time: 1, event: 1, state: 1 };
    const rank = { 'noun.substance': 0, 'noun.object': 1, 'noun.body': 2, 'noun.location': 3, 'noun.animal': 4, 'noun.artifact': 5, 'noun.plant': 6 };
    let prep = '';
    const found = [];
    const words = String(sense.gloss || '').toLowerCase().match(/[a-z]+/g) || [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (preps[w]) { prep = w; continue; }
      const stem = ingStem(w, lex);
      if (stem && stem !== lemma) {
        const inner = mediumOf(lex, stem, depth + 1);
        if (inner) found.push(inner);
        continue;
      }
      if (!lex.hasPos || !lex.hasPos(w, 'n') || w === lemma || w.length < 3) continue;
      const kind = lex.lexnameOf ? String(lex.lexnameOf(w) || '') : '';
      const leaf = kind.split('.').pop();
      if (skipName[leaf]) continue;
      const stuff = kind === 'noun.substance' || kind === 'noun.object';
      if (lex.hasPos(w, 'a') && kind !== 'noun.substance' && kind !== 'noun.location') continue;
      if (lex.hasPos(w, 'v') && !stuff) continue;
      found.push({ prep: prep, noun: w, kind: kind });
    }
    found.sort((a, b) => {
      const liquid = row => {
        const gloss = String((((lex.senses(row.noun) || []).find(s => s && s.pos === 'n' && s.gloss)) || {}).gloss || '');
        return /\bliquid\b/.test(gloss) ? 0 : 1;
      };
      return liquid(a) - liquid(b) || (rank[a.kind] == null ? 9 : rank[a.kind]) - (rank[b.kind] == null ? 9 : rank[b.kind]);
    });
    return found[0] || null;
  }
  function instrumentFrom(texts, forge) {
    const G = grammar();
    if (!G || !G.Parser || !G.tokenize || !forge || !forge.grammarLex) return null;
    for (let n = 0; n < (texts || []).length; n++) {
      const toks = G.tokenize(String(texts[n] || ''));
      for (let i = 0; i < toks.length; i++) {
        if (toks[i].w !== 'with' && toks[i].w !== 'having') continue;
        let best = null;
        G.Parser(toks, forge.grammarLex).np(i + 1).forEach(hit => {
          const node = hit.node && hit.node.head && hit.node.head.length ? hit.node : (hit.node && hit.node.conj && hit.node.conj[0] && hit.node.conj[0].head ? hit.node.conj[0] : null);
          const span = hit.i - (i + 1);
          if (node && (!best || span > best.span)) best = { span: span, node: node };
        });
        if (best) return best.node.det || best.node.plural ? best.node : Object.assign({ det: 'a' }, best.node);
      }
    }
    return null;
  }
  function havePhrase(text, forge) {
    const Q = isNode ? require('./qframe.js') : root.KQFrame;
    let clause = null;
    try { clause = Q && Q.clause ? Q.clause(text, forge) : null; } catch (e) { clause = null; }
    const verb = clause && ((clause.verb && clause.verb.lemma) || clause.kriya);
    if (verb !== 'have') return null;
    const karma = clause.roles && clause.roles.karma;
    const head = karma && (Array.isArray(karma.head) ? karma.head : (karma.head ? [karma.head] : []));
    if (!head || !head.length) return null;
    return karma;
  }
  function verbMotion(lex, lemma) {
    const sense = ((lex && lex.senses && lex.senses(lemma)) || []).find(s => s && s.pos === 'v');
    return !!(sense && (sense.lexname === 'verb.motion' || sense.lexname === 'verb.contact'));
  }
  function actionsOf(texts, forge) {
    const Q = isNode ? require('./qframe.js') : root.KQFrame;
    const lex = forge && forge.lexicon;
    const motion = [];
    const other = [];
    function add(stem, onlyMotion) {
      if (!stem || stem === 'be' || stem === 'have' || stem === 'do' || stem === 'include' || stem === 'consist' || stem === 'use' || stem === 'follow') return;
      const moves = verbMotion(lex, stem);
      if (onlyMotion && !moves) return;
      const list = moves ? motion : other;
      if (motion.indexOf(stem) < 0 && other.indexOf(stem) < 0) list.push(stem);
    }
    (texts || []).forEach(text => {
      const words = String(text || '').toLowerCase().match(/[a-z]+/g) || [];
      words.forEach(w => {
        const stem = ingStem(w, lex);
        if (stem) add(stem, false);
        else if (lex && lex.hasPos && lex.hasPos(w, 'v') && verbMotion(lex, w)) {
          const medium = mediumOf(lex, w, 0);
          const kind = medium && medium.kind;
          if (kind === 'noun.substance' || kind === 'noun.object' || kind === 'noun.location') add(w, true);
        }
      });
      let clause = null;
      try { clause = Q && Q.clause ? Q.clause(text, forge) : null; } catch (e) { clause = null; }
      const verb = clause && ((clause.verb && clause.verb.lemma) || clause.kriya);
      if (verb) add(verb, true);
    });
    return motion.concat(other).slice(0, 3);
  }
  function nounHead(text) {
    return String(text || '').toLowerCase().replace(/^(?:a|an|the)\s+/, '').split(/[^a-z0-9.]+/).filter(Boolean);
  }
  function storySim(sim) {
    const outcome = sim && (sim.outcome || (sim.run && sim.run.outcome));
    if (outcome !== 'float' && outcome !== 'sink' && outcome !== 'suspend') return null;
    const ms = (sim && (sim.measurements || (sim.run && sim.run.measurements))) || {};
    const problem = (sim && sim.problem) || {};
    const fluid = nounHead(ms.fluid || problem.fluid || '');
    const who = nounHead(ms.patient || problem.patient || '');
    if (!fluid.length || !who.length) return null;
    const past = { tense: 'past', pol: 'pos', mod: 'asserted' };
    const where = { det: 'the', head: fluid };
    const before = say({ subj: { det: 'the', head: who }, verb: Object.assign({ lemma: 'be' }, past), pred: { prep: 'out of', np: where } });
    const effect = say({
      subj: { det: 'the', head: who },
      verb: Object.assign({ lemma: outcome === 'suspend' ? 'hang' : outcome }, past),
      adj: [{ prep: 'in', np: where }]
    });
    const side = outcome === 'float' ? 'below' : outcome === 'sink' ? 'above' : '';
    const why = side ? say({
      subj: { det: 'the', head: ['density'], of: { det: 'the', head: who } },
      verb: Object.assign({ lemma: 'be' }, past),
      pred: { prep: side, np: { det: 'the', head: ['density'], of: { det: 'the', head: fluid } } }
    }) : '';
    let figure = '';
    if (typeof ms.rho_lo === 'number' && typeof ms.rho_hi === 'number') {
      figure = say({
        subj: { det: 'the', head: who },
        verb: Object.assign({ lemma: 'have' }, past),
        roles: { karma: { det: 'a', head: ['density'] } },
        adj: [{ prep: 'from', np: { head: [String(ms.rho_lo)] } }, { prep: 'to', np: { head: [String(ms.rho_hi), 'kilograms'] } }, { prep: 'per', np: { head: ['cubic', 'meter'] } }]
      });
    } else if (typeof ms.rho_body === 'number') {
      figure = say({
        subj: { det: 'the', head: who },
        verb: Object.assign({ lemma: 'have' }, past),
        roles: { karma: { det: 'a', head: ['density', 'of', String(ms.rho_body), 'kilograms', 'per', 'cubic', 'meter'] } }
      });
    }
    const depth = (ms.depth_vs_leg === 'below' || ms.depth_vs_leg === 'above') ? say({
      subj: { det: 'the', head: ['depth'] },
      verb: Object.assign({ lemma: 'be' }, past),
      pred: { prep: ms.depth_vs_leg, np: { det: 'the', head: ['length'], of: { det: 'the', head: ['leg'] } } }
    }) : '';
    const frac = ms.submerged_fraction;
    const after = (typeof frac === 'number' && frac > 0 && frac < 1)
      ? say({ subj: { head: [String(frac)], of: { det: 'the', head: who } }, verb: Object.assign({ lemma: 'be' }, past), pred: { prep: 'in', np: where } })
      : say({ subj: { det: 'the', head: who }, verb: Object.assign({ lemma: 'be' }, past), pred: { prep: 'in', np: where } });
    return { before: before, lines: [effect, figure, why, depth, after].filter(Boolean) };
  }
  function liquidNoun(lex, noun) {
    if (!lex || !lex.senses || !noun) return '';
    const gloss = String((((lex.senses(noun) || []).find(s => s && s.pos === 'n' && s.gloss)) || {}).gloss || '');
    if (/\bliquid\b/.test(gloss)) return noun;
    const words = gloss.toLowerCase().match(/[a-z]+/g) || [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (!lex.hasPos || !lex.hasPos(w, 'n') || w === noun) continue;
      const inner = String((((lex.senses(w) || []).find(s => s && s.pos === 'n' && s.gloss)) || {}).gloss || '');
      if (/\bliquid\b/.test(inner)) return w;
    }
    return '';
  }
  function argumentOf(texts, verb, forge) {
    const Q = isNode ? require('./qframe.js') : root.KQFrame;
    const lex = forge && forge.lexicon;
    let compound = null;
    let place = null;
    (texts || []).forEach(text => {
      const words = String(text || '').toLowerCase().match(/[a-z]+/g) || [];
      for (let i = 1; i < words.length; i++) {
        if (ingStem(words[i], lex) !== verb || !lex || !lex.hasPos || !lex.hasPos(words[i - 1], 'n')) continue;
        const kind = lex.lexnameOf ? String(lex.lexnameOf(words[i - 1]) || '') : '';
        if (kind !== 'noun.food' && kind !== 'noun.animal' && kind !== 'noun.substance' && kind !== 'noun.object' && kind !== 'noun.body') continue;
        compound = { det: 'a', head: [words[i - 1]] };
      }
      let clause = null;
      try { clause = Q && Q.clause ? Q.clause(text, forge) : null; } catch (e) { clause = null; }
      const preps = { in: 1, on: 1, into: 1, through: 1, over: 1 };
      if ((!clause || clause.parsed === false) && grammar() && forge.grammarLex) {
        const G = grammar();
        const toks = G.tokenize(String(text || ''));
        for (let i = 0; i < toks.length; i++) {
          if (!preps[toks[i].w]) continue;
          let best = null;
          G.Parser(toks, forge.grammarLex).np(i + 1).forEach(hit => {
            const node = hit.node && hit.node.head && hit.node.head.length ? hit.node : null;
            if (node && (!best || hit.i - (i + 1) > best.span)) best = { span: hit.i - (i + 1), node: node, prep: toks[i].w };
          });
          if (!best) continue;
          const head = best.node.head[0];
          const kind = lex && lex.lexnameOf ? String(lex.lexnameOf(head) || '') : '';
          if (kind === 'noun.substance' || kind === 'noun.location' || kind === 'noun.object') {
            if (!place || kind === 'noun.substance') place = { prep: best.prep, kind: kind, np: { det: best.node.det || 'the', head: [head], plural: !!best.node.plural } };
          }
        }
      }
      ((clause && clause.adj) || []).forEach(adj => {
        if (!adj || !preps[adj.prep] || !adj.np) return;
        const head = Array.isArray(adj.np.head) ? adj.np.head[0] : adj.np.head;
        if (!head || !lex || !lex.hasPos || !lex.hasPos(head, 'n')) return;
        const kind = lex.lexnameOf ? String(lex.lexnameOf(head) || '') : '';
        if (kind !== 'noun.substance' && kind !== 'noun.location' && kind !== 'noun.object' && kind !== 'noun.body') return;
        if (!place || kind === 'noun.substance') place = { prep: adj.prep, kind: kind, np: { det: adj.np.det || 'the', head: [head], plural: !!adj.np.plural } };
      });
      const karma = clause && clause.roles && clause.roles.karma;
      const khead = karma && (Array.isArray(karma.head) ? karma.head[0] : karma.head);
      const kverb = clause && ((clause.verb && clause.verb.lemma) || clause.kriya);
      if (kverb === verb && khead && lex && lex.hasPos && lex.hasPos(khead, 'n') && !compound) {
        const kind = lex.lexnameOf ? String(lex.lexnameOf(khead) || '') : '';
        if (kind === 'noun.food' || kind === 'noun.animal' || kind === 'noun.substance' || kind === 'noun.object' || kind === 'noun.body') compound = karma.det ? karma : Object.assign({ det: 'a' }, karma);
      }
    });
    return { compound: compound, place: place };
  }
  function eventPlan(topic, clauses, forge) {
    const lex = forge && forge.lexicon;
    const head = wordsOf(topic);
    if (!head.length) return { sentences: [], question: '' };
    const texts = (clauses || []).map(row => String(row && row.text || row || ''));
    const verbs = actionsOf(texts, forge);
    let instrument = null;
    texts.forEach(text => { if (!instrument) instrument = havePhrase(text, forge); });
    if (!instrument) instrument = instrumentFrom(texts, forge);
    const held = instrument ? say({
      subj: { det: 'the', head: head },
      verb: { lemma: 'have', tense: 'past', pol: 'pos', mod: 'asserted' },
      roles: { karma: instrument }
    }) : '';
    let question = '';
    let setting = '';
    const actions = verbs.map(verb => {
      const moves = verbMotion(lex, verb);
      const medium = moves ? mediumOf(lex, verb, 0) : null;
      const arg = argumentOf(texts, verb, forge);
      const sister = moves && !medium && !arg.place ? oneSister(lex, head[0]) : '';
      const clause = {
        subj: { det: 'the', head: head },
        verb: { lemma: verb, tense: 'past', pol: 'pos', mod: 'asserted' }
      };
      if (medium && medium.noun) {
        const np = { det: 'the', head: [medium.noun] };
        if (medium.prep) clause.adj = [{ prep: medium.prep, np: np }];
        else clause.roles = { karma: np };
      } else if (!moves && arg.compound) {
        clause.roles = { karma: arg.compound };
      } else if (arg.place) {
        clause.adj = [{ prep: arg.place.prep, np: arg.place.np }];
        if (!setting) setting = say({ subj: { det: 'the', head: head }, verb: { lemma: 'be', tense: 'past', pol: 'pos', mod: 'asserted' }, pred: { prep: arg.place.prep, np: arg.place.np } });
      } else if (arg.compound) {
        clause.roles = { karma: arg.compound };
      } else if (sister) {
        clause.adj = [{ prep: 'near', np: { det: 'the', head: [sister] } }];
      }
      const named = (medium && medium.noun) || (arg.place && arg.place.np && arg.place.np.head && arg.place.np.head[0]) || '';
      const fluid = liquidNoun(lex, named);
      if (!question && fluid) question = 'What happens if I put the ' + head.join(' ') + ' in the ' + fluid + '?';
      return say(clause);
    }).filter(Boolean);
    return { sentences: [setting, held].concat(actions).filter(Boolean), question: question, verb: verbs[0] || '', medium: null };
  }
  function narrate(topic, found, clauses) {
    return prose(topic, clauses, null);
  }
  function imagine(topic, laws, clauses) {
    const found = search(laws || [], { object: topic });
    return {
      label: 'imagined', imagined: true, fact: false, may_store_as_fact: false, taint: 'sandbox', stored: false,
      story: narrate(topic, found, clauses), expression: found.best && found.best.expression || null,
      scenes: (found.scenes || []).length, question: (questions(found)[0] || {}).question || null, calls_llm: false
    };
  }
  function resolve(gap) {
    const probe = gap && gap.probe;
    if (!probe) return { ok: false, fact: false, may_store_as_fact: false, calls_llm: false };
    let value = typeof probe.value === 'number' ? probe.value : null;
    let method = 'simulator';
    if (probe.kind === 'circuit' && probe.ask && isNode) {
      try {
        const cp = require('child_process');
        const path = require('path');
        const rootDir = path.join(__dirname, '..');
        const py = 'import json,sys\nfrom rmc_engine_v1.sim_device import plan, solve\nq=json.load(sys.stdin)["q"]\np=plan(q)\nout={"ok": bool(p.get("ok")), "solver": p.get("solver"), "reason": p.get("reason")}\n\nif p.get("ok"):\n    s=solve(p)\n    out["measurements"]=s.get("measurements") or {}\n    out["outcome"]=s.get("outcome")\nprint(json.dumps(out))\n';
        const env = Object.assign({}, process.env, { PYTHONPATH: [path.join(rootDir, 'engine'), rootDir, path.join(rootDir, '_mathlibs')].join(path.delimiter) });
        const proc = cp.spawnSync('python3', ['-c', py], { input: JSON.stringify({ q: probe.ask }), cwd: rootDir, env: env, encoding: 'utf8', maxBuffer: 1 << 22, timeout: 60000 });
        if (proc.status === 0) {
          const row = JSON.parse(String(proc.stdout || '').trim().split('\n').pop());
          const measured = row && row.measurements && row.measurements.source_current_a;
          if (typeof measured === 'number') { value = measured; method = 'simulate'; }
        }
      } catch (e) { /* the expression value remains the reading */ }
    }
    const output = Array.isArray(probe.output) && probe.output.length ? probe.output : ['value'];
    const reply = typeof value === 'number' ? resultSentence(output, value, probe.unit) : '';
    return {
      ok: !!reply, question: gap.question, reply: reply || null, method: method,
      fact: false, may_store_as_fact: false, calls_llm: false, stored: false
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
        story: narrate('object', found, null),
        question: asked && asked.question || null, calls_llm: false
      };
    }
    return {
      label: 'hypothesis', imagined: false, fact: false, may_store_as_fact: false,
      answer_from: 'real_world', reply: null,
      question: asked && asked.question || null, calls_llm: false
    };
  }
  const api = { search: search, points: points, questions: questions, consider: consider, imagine: imagine, narrate: narrate, prose: prose, eventPlan: eventPlan, resolve: resolve, readExplorer: readExplorer };
  if (isNode) module.exports = api; else root.KDreamBranch = api;
})(typeof self !== 'undefined' ? self : this);
