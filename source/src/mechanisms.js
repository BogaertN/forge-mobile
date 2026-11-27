/* A mechanism is a regularity read off simulation evidence. The quantities are the ones
 * the scene already named. The search tries products and ratios, in a fixed order, and keeps
 * a threshold that separates the measured outcomes. Gilligan checks held-out receipts and
 * two probes beside the threshold. An admitted row is evidence. It is not a fact. */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const SCHEMA = 'forge.mechanism/v1';
  const KEY = 'forge.mechanism.v1';
  const MIN_TRAIN = 4;
  let MEM = null;
  let DISK = null;
  function blank() { return { schema: SCHEMA, mechanisms: [], calls_llm: false, changes_gates: false, may_store_as_fact: false, publisher: false }; }
  function backend() {
    if (!isNode) {
      try {
        localStorage.setItem(KEY + '.probe', '1');
        localStorage.removeItem(KEY + '.probe');
        return { get: k => localStorage.getItem(k), set: (k, v) => localStorage.setItem(k, v), del: k => localStorage.removeItem(k) };
      } catch (e) { return null; }
    }
    if (!DISK) DISK = {};
    return { get: k => (Object.prototype.hasOwnProperty.call(DISK, k) ? DISK[k] : null), set: (k, v) => { DISK[k] = String(v); }, del: k => { delete DISK[k]; } };
  }
  function load() {
    if (MEM && MEM.schema === SCHEMA) return MEM;
    const b = backend();
    if (b) {
      try {
        const v = JSON.parse(b.get(KEY) || 'null');
        if (v && v.schema === SCHEMA && Array.isArray(v.mechanisms)) return (MEM = Object.assign(blank(), v));
      } catch (e) { /* a torn record starts empty */ }
    }
    return (MEM = blank());
  }
  function save(doc) {
    MEM = Object.assign(blank(), doc, { schema: SCHEMA, calls_llm: false, changes_gates: false, may_store_as_fact: false, publisher: false });
    const b = backend();
    if (b) { try { b.set(KEY, JSON.stringify(MEM)); } catch (e) { /* the in-memory copy still holds this turn */ } }
    return MEM;
  }
  function clear() { MEM = blank(); const b = backend(); if (b) { try { b.del(KEY); } catch (e) {} } return { ok: true }; }
  function reload() { MEM = null; return load(); }
  function sceneMap(receipt) {
    const map = {};
    (receipt.variables || []).forEach(v => {
      if (!v || v.source !== 'scene' || typeof v.value !== 'number' || !isFinite(v.value)) return;
      const path = String(v.path || '');
      if (!/^scene\.(body|surface|point|gravity|slope_deg|launch|drop_height)/.test(path) && path.indexOf('.') >= 0) return;
      if (!map[v.name]) map[v.name] = { value: v.value, unit: v.unit || null, dimension: v.dimension || null, path: path };
    });
    return map;
  }
  function combos(names, k) {
    const out = [];
    function rec(start, acc) {
      if (acc.length === k) { out.push(acc.slice()); return; }
      for (let i = start; i < names.length; i++) { acc.push(names[i]); rec(i + 1, acc); acc.pop(); }
    }
    rec(0, []);
    return out;
  }
  function dimVector(variable) {
    const unit = String((variable && variable.unit) || '');
    const dim = String((variable && variable.dimension) || '');
    if (dim === 'dimensionless' || unit === '1') return [0, 0, 0];
    if (dim === 'length' || unit === 'm' || unit === 'km') return [1, 0, 0];
    if (dim === 'mass' || unit === 'kg') return [0, 1, 0];
    if (dim === 'time' || unit === 's' || unit === 'min') return [0, 0, 1];
    if (dim === 'acceleration' || unit === 'm/s^2') return [1, 0, -2];
    return null;
  }
  function piExprs(names, sample) {
    const dims = {};
    names.forEach(name => { dims[name] = dimVector(sample[name]); });
    const known = names.filter(name => dims[name]);
    const exprs = [];
    function add(terms) {
      const sum = [0, 0, 0];
      terms.forEach(term => dims[term.name].forEach((part, i) => { sum[i] += part * term.exp; }));
      if (sum.some(part => part !== 0)) return;
      const num = terms.filter(term => term.exp > 0).map(term => term.name).sort();
      const den = terms.filter(term => term.exp < 0).map(term => term.name).sort();
      if (!num.length && !den.length) return;
      const text = (num.length > 1 ? '(' + num.join('*') + ')' : num.join('*') || '1') + (den.length ? '/' + (den.length > 1 ? '(' + den.join('*') + ')' : den[0]) : '');
      if (exprs.some(ex => ex.text === text)) return;
      exprs.push({
        text: text, vars: terms.map(term => term.name), factors: terms.length, pi: true,
        eval: vals => {
          let value = 1;
          for (const term of terms) {
            const part = vals[term.name];
            if (part == null || !isFinite(part) || (term.exp < 0 && part === 0)) return null;
            value *= term.exp > 0 ? part : 1 / part;
          }
          return value;
        }
      });
    }
    known.forEach(name => { if (dims[name].every(part => part === 0)) add([{ name: name, exp: 1 }]); });
    for (let i = 0; i < known.length; i++) for (let j = i + 1; j < known.length; j++) {
      add([{ name: known[i], exp: 1 }, { name: known[j], exp: -1 }]);
      add([{ name: known[i], exp: 1 }, { name: known[j], exp: 1 }]);
    }
    for (let i = 0; i < known.length; i++) for (let j = i + 1; j < known.length; j++) for (let k = j + 1; k < known.length; k++) {
      [known[i], known[j], known[k]].forEach(den => {
        const num = [known[i], known[j], known[k]].filter(name => name !== den);
        add([{ name: num[0], exp: 1 }, { name: num[1], exp: 1 }, { name: den, exp: -1 }]);
      });
    }
    if (known.length >= 4) for (let a = 0; a < known.length; a++) for (let b = a + 1; b < known.length; b++) for (let c = b + 1; c < known.length; c++) for (let d = c + 1; d < known.length; d++) {
      const four = [known[a], known[b], known[c], known[d]];
      four.forEach(den => {
        const num = four.filter(name => name !== den);
        add(num.map(name => ({ name: name, exp: 1 })).concat([{ name: den, exp: -1 }]));
      });
    }
    return exprs;
  }
  function enumerate(names) {
    const exprs = [];
    function push(text, used, fn, factors) { exprs.push({ text: text, vars: used, eval: fn, factors: factors }); }
    names.forEach(n => push(n, [n], m => m[n], 1));
    combos(names, 2).forEach(pair => {
      const a = pair[0], b = pair[1];
      push(a + '/' + b, pair, m => m[b] === 0 ? null : m[a] / m[b], 2);
      push(b + '/' + a, pair, m => m[a] === 0 ? null : m[b] / m[a], 2);
      push(a + '*' + b, pair, m => m[a] * m[b], 2);
    });
    combos(names, 3).forEach(trio => {
      trio.forEach(den => {
        const num = trio.filter(n => n !== den);
        const text = '(' + num.join('*') + ')/' + den;
        push(text, trio, m => m[den] === 0 ? null : num.reduce((p, n) => p * m[n], 1) / m[den], 3);
      });
    });
    if (names.length >= 4) combos(names, 4).forEach(quad => {
      quad.forEach(den => {
        const num = quad.filter(n => n !== den);
        const text = '(' + num.join('*') + ')/' + den;
        push(text, quad, m => m[den] === 0 ? null : num.reduce((p, n) => p * m[n], 1) / m[den], 4);
      });
    });
    return exprs;
  }
  function bestCut(scored) {
    const s = scored.slice().sort((a, b) => a.e - b.e);
    let best = null;
    function majority(side) {
      const counts = {};
      side.forEach(x => { counts[x.y] = (counts[x.y] || 0) + 1; });
      const label = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || String(a).localeCompare(String(b)))[0];
      return { label: label, hit: counts[label] };
    }
    for (let i = 1; i < s.length; i++) {
      if (s[i].e === s[i - 1].e) continue;
      const left = majority(s.slice(0, i));
      const right = majority(s.slice(i));
      if (!left.label || left.label === right.label) continue;
      const hit = left.hit + right.hit;
      const cutAcc = hit / s.length;
      const gap = s[i].e - s[i - 1].e;
      if (!best || cutAcc > best.acc || (cutAcc === best.acc && gap > best.gap)) {
        best = { threshold: (s[i - 1].e + s[i].e) / 2, below: left.label, above: right.label, gap: gap, acc: cutAcc, lo: s[i - 1].e, hi: s[i].e };
      }
    }
    return best;
  }
  function separate(scored) {
    const s = scored.slice().sort((a, b) => a.e - b.e);
    let best = null;
    for (let i = 1; i < s.length; i++) {
      if (s[i].e === s[i - 1].e) continue;
      const left = s.slice(0, i).map(x => x.y);
      const right = s.slice(i).map(x => x.y);
      const ly = left.filter((y, j) => left.indexOf(y) === j);
      const ry = right.filter((y, j) => right.indexOf(y) === j);
      if (ly.length !== 1 || ry.length !== 1 || ly[0] === ry[0]) continue;
      const gap = s[i].e - s[i - 1].e;
      if (!best || gap > best.gap) best = { threshold: (s[i - 1].e + s[i].e) / 2, below: ly[0], above: ry[0], gap: gap };
    }
    return best;
  }
  function evaluate(expression, vals) {
    const text = String(expression || '').replace(/\s+/g, '');
    const parts = text.split('/');
    if (!text || parts.length > 2) return null;
    function prod(side) {
      const body = side.replace(/[()]/g, '');
      if (!body || body === '1') return 1;
      let value = 1;
      const names = body.split('*').filter(Boolean);
      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        if (!Object.prototype.hasOwnProperty.call(vals, name) || typeof vals[name] !== 'number' || !isFinite(vals[name])) return null;
        value *= vals[name];
      }
      return value;
    }
    const num = prod(parts[0]);
    const den = parts.length === 2 ? prod(parts[1]) : 1;
    if (num == null || den == null || den === 0) return null;
    return num / den;
  }
  function scoreLaw(law, vals) {
    if (law && typeof law._eval === 'function') return law._eval(vals);
    return evaluate(law && law.expression, vals);
  }
  function predict(law, receipt) {
    const map = sceneMap(receipt);
    const vals = {};
    law.variables.forEach(n => { if (!map[n]) return; vals[n] = map[n].value; });
    if (law.variables.some(n => vals[n] == null)) return null;
    const e = scoreLaw(law, vals);
    if (e == null || !isFinite(e)) return null;
    return e > law.threshold ? law.above : law.below;
  }
  function acc(law, rows) {
    let n = 0;
    let hit = 0;
    rows.forEach(r => {
      const map = sceneMap(r);
      if (law.variables.some(name => !map[name])) return;
      const vals = {};
      law.variables.forEach(name => { vals[name] = map[name].value; });
      const e = scoreLaw(law, vals);
      if (e == null || !isFinite(e)) return;
      n += 1;
      if ((e > law.threshold ? law.above : law.below) === r.outcome) hit += 1;
    });
    return n ? hit / n : 0;
  }
  function holds(law, rows) {
    return rows.every(r => {
      const map = sceneMap(r);
      const vals = {};
      if (law.variables.some(n => !map[n])) return false;
      law.variables.forEach(n => { vals[n] = map[n].value; });
      const e = scoreLaw(law, vals);
      if (e == null || !isFinite(e)) return false;
      return (e > law.threshold ? law.above : law.below) === r.outcome;
    });
  }
  function search(train, held, all) {
    const maps = train.map(sceneMap);
    const names = Object.keys(maps[0] || {}).filter(n => maps.every(m => m[n] && typeof m[n].value === 'number')).sort();
    const varying = names.filter(n => maps.map(m => m[n].value).filter((v, i, a) => a.indexOf(v) === i).length > 1);
    const outcomes = train.map(r => r.outcome).filter((y, i, a) => a.indexOf(y) === i);
    if (varying.length < 2 || outcomes.length !== 2) return null;
    let tried = 0;
    const passing = [];
    enumerate(varying).concat(piExprs(varying, maps[0] || {})).forEach(ex => {
      tried += 1;
      const scored = [];
      for (let i = 0; i < train.length; i++) {
        const vals = {};
        ex.vars.forEach(n => { vals[n] = maps[i][n].value; });
        const e = ex.eval(vals);
        if (e == null || !isFinite(e)) return;
        scored.push({ e: e, y: train[i].outcome });
      }
      if (scored.length !== train.length) return;
      const sep = bestCut(scored);
      if (!sep || sep.acc < 0.75) return;
      const cand = { expression: ex.text, variables: ex.vars.slice(), factors: ex.factors, pi: ex.pi === true, threshold: sep.threshold, above: sep.above, below: sep.below, gap: sep.gap, _bounds: { lo: sep.lo, hi: sep.hi }, _eval: ex.eval, trainAcc: sep.acc };
      const trainAcc = cand.trainAcc;
      const heldAcc = acc(cand, held || []);
      if (trainAcc < 0.75 || heldAcc < 0.75) return;
      cand.trainAcc = trainAcc;
      cand.heldAcc = heldAcc;
      cand.fullAcc = acc(cand, all || train.concat(held || []));
      passing.push(cand);
    });
    const best = passing.sort((a, b) => b.fullAcc - a.fullAcc || b.heldAcc - a.heldAcc || (b.pi === true) - (a.pi === true) || a.factors - b.factors || b.gap - a.gap)[0] || null;
    if (!best) return null;
    best.alts = passing.map(p => ({ expression: p.expression, fullAcc: p.fullAcc, heldAcc: p.heldAcc, factors: p.factors }));
    best.tried = tried;
    const range = {};
    best.variables.forEach(n => {
      const values = maps.map(m => m[n].value);
      range[n] = { unit: maps[0][n].unit, dimension: maps[0][n].dimension, min: Math.min.apply(null, values), max: Math.max.apply(null, values) };
    });
    best.range = range;
    return best;
  }
  function causesOf(rows) {
    const counts = {};
    rows.forEach(r => {
      if (!r || !r.outcome) return;
      const list = r.mechanism_atoms || [];
      const atom = list.map(a => a && a.atom).find(a => a && a.predicate && Array.isArray(a.args));
      if (!atom) return;
      const copy = { predicate: atom.predicate, args: atom.args.map(x => String(x)), polarity: atom.polarity || 'pos', tense: atom.tense || 'present' };
      const id = JSON.stringify(copy);
      const slot = counts[r.outcome] || (counts[r.outcome] = {});
      slot[id] = slot[id] || { atom: copy, n: 0 };
      slot[id].n += 1;
    });
    const out = {};
    Object.keys(counts).forEach(outcome => {
      const best = Object.keys(counts[outcome]).sort((a, b) => counts[outcome][b].n - counts[outcome][a].n || a.localeCompare(b))[0];
      if (best) out[outcome] = counts[outcome][best].atom;
    });
    return out;
  }
  function induce(receipts) {
    const groups = {};
    (receipts || []).forEach(r => {
      if (!r || r.fact === true || r.evidence_class !== 'simulation' || !r.outcome || !r.solver) return;
      (groups[r.solver] = groups[r.solver] || []).push(r);
    });
    const proposals = [];
    Object.keys(groups).sort().forEach(solver => {
      const ordered = groups[solver].slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
      const labels = ordered.map(r => r.outcome).filter((y, i, a) => a.indexOf(y) === i).sort();
      const subsets = labels.length <= 2 ? [ordered] : [];
      if (labels.length > 2) {
        for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
          subsets.push(ordered.filter(r => r.outcome === labels[i] || r.outcome === labels[j]));
        }
      }
      subsets.forEach(subset => {
      const holdN = Math.max(2, Math.floor(subset.length / 4));
      if (subset.length - holdN < MIN_TRAIN) return;
      const train = subset.slice(0, subset.length - holdN);
      const held = subset.slice(subset.length - holdN);
      const found = search(train, held, subset);
      if (!found) return;
      const law = Object.assign(found, { solver: solver });
      const heldMiss = held.filter(r => predict(law, r) !== r.outcome);
      proposals.push({
        schema: SCHEMA,
        id: 'mech:' + solver + ':' + found.expression,
        solver: solver,
        expression: found.expression,
        pi: found.pi === true,
        variables: found.variables,
        range: found.range,
        threshold: found.threshold,
        above: found.above,
        below: found.below,
        gap: found.gap,
        factors: found.factors,
        trainAcc: found.trainAcc,
        heldAcc: found.heldAcc,
        fullAcc: found.fullAcc,
        alts: found.alts,
        tried: found.tried,
        assumptions: found.variables.map(n => n + (found.range[n].unit ? ' in ' + found.range[n].unit : '')),
        atom: { predicate: 'exceed', args: [found.expression, String(found.threshold)], polarity: 'pos', tense: 'present', above: found.above, below: found.below },
        causes: causesOf(subset),
        train: train.map(r => r.id),
        held: held.map(r => r.id),
        held_miss: heldMiss.map(r => r.id),
        status: heldMiss.length ? 'refuted' : 'proposal',
        evidence_class: 'mechanism',
        fact: false,
        may_store_as_fact: false,
        publisher: false,
        hosted_eligible: false,
        calls_llm: false,
        _eval: found._eval,
        _bounds: found._bounds
      });
      });
    });
    return { proposals: proposals, calls_llm: false, changes_gates: false };
  }
  function nudge(law, receipt, sign) {
    const map = sceneMap(receipt);
    const vals = {};
    law.variables.forEach(n => { vals[n] = map[n].value; });
    const cur = scoreLaw(law, vals);
    if (!cur) return null;
    const name = law.variables[0];
    const target = law.threshold * (1 + sign * 0.05);
    const next = {};
    law.variables.forEach(n => { next[n] = vals[n]; });
    next[name] = vals[name] * (target / cur);
    return { values: next, expect: target > law.threshold ? law.above : law.below, moved: name };
  }
  function at(law, sample, target) {
    const map = sceneMap(sample);
    const vals = {};
    law.variables.forEach(n => { vals[n] = map[n].value; });
    const cur = scoreLaw(law, vals);
    const name = law.variables[0];
    if (!cur || !vals[name]) return null;
    const next = {};
    law.variables.forEach(n => { next[n] = vals[n]; });
    next[name] = vals[name] * (target / cur);
    return next;
  }
  function validate(proposal, sample, probe) {
    if (!proposal || proposal.status === 'refuted') return { ok: false, status: 'refuted', fact: false, publisher: false };
    let lo = proposal.threshold;
    let hi = proposal.threshold;
    if (proposal._bounds) { lo = proposal._bounds.lo; hi = proposal._bounds.hi; }
    const probes = [];
    for (let step = 0; step < 6 && hi > lo; step++) {
      const mid = (lo + hi) / 2;
      const values = at(proposal, sample, mid);
      if (!values) return { ok: false, status: 'refuted', rule: 'MECH-NO-EDGE', fact: false, publisher: false };
      const got = probe(values);
      probes.push({ step: step, target: mid, values: values, got: got });
      if (got === proposal.below) lo = mid;
      else hi = mid;
    }
    const threshold = (lo + hi) / 2;
    const lowV = at(proposal, sample, lo * 0.99);
    const highV = at(proposal, sample, hi * 1.01);
    const gotLow = probe(lowV);
    const gotHigh = probe(highV);
    probes.push({ side: 'below', values: lowV, expect: proposal.below, got: gotLow });
    probes.push({ side: 'above', values: highV, expect: proposal.above, got: gotHigh });
    const agree = gotLow === proposal.below && gotHigh === proposal.above;
    proposal.threshold = threshold;
    const atom = Object.assign({}, proposal.atom, { args: [proposal.expression, String(threshold)] });
    const row = {
      schema: SCHEMA, id: proposal.id, solver: proposal.solver, expression: proposal.expression,
      variables: proposal.variables, range: proposal.range, threshold: threshold,
      above: proposal.above, below: proposal.below, assumptions: proposal.assumptions, atom: atom,
      causes: proposal.causes || {},
      tried: proposal.tried, train: proposal.train, held: proposal.held, probes: probes,
      status: agree ? 'admitted' : 'refuted',
      evidence_class: 'mechanism', fact: false, may_store_as_fact: false, publisher: false, hosted_eligible: false, calls_llm: false
    };
    if (agree) {
      const doc = load();
      const rows = doc.mechanisms.filter(r => r && r.id !== row.id);
      rows.push(row);
      doc.mechanisms = rows.slice(-40);
      save(doc);
    }
    return { ok: agree, status: row.status, id: row.id, fact: false, publisher: false, probes: row.probes };
  }
  function nextScenes(proposals) {
    const ranked = (proposals || []).filter(p => p && p.variables && p.variables.length).slice(0, 2);
    if (!ranked.length) return [];
    const lead = ranked[0];
    const other = ranked[1];
    const span = lead.range || {};
    const names = Object.keys(span);
    if (!names.length) return [];
    const scenes = [];
    names.forEach(name => {
      const row = span[name];
      if (!row || !(row.max > row.min)) return;
      const mid = (row.min + row.max) / 2;
      [row.min, mid, row.max].forEach(value => {
        const values = {};
        names.forEach(key => { values[key] = key === name ? value : (span[key].min + span[key].max) / 2; });
        const atLead = scoreLaw(lead, values);
        const atOther = other ? scoreLaw(other, values) : null;
        const leadLabel = atLead == null ? null : (atLead > lead.threshold ? lead.above : lead.below);
        const otherLabel = atOther == null || !other ? null : (atOther > other.threshold ? other.above : other.below);
        if (other && leadLabel === otherLabel) return;
        scenes.push({ values: values, near: name, lead: lead.expression, other: other && other.expression });
      });
    });
    return scenes.slice(0, 8);
  }
  function sceneValues(scene) {
    const body = scene && scene.body || {};
    const surface = scene && scene.surface || {};
    const point = scene && scene.point || {};
    const slots = {
      height: { value: body.height, unit: 'm' },
      radius: { value: body.radius, unit: 'm' },
      mass: { value: body.mass, unit: 'kg' },
      depth: { value: body.depth, unit: 'm' },
      width: { value: body.width, unit: 'm' },
      mu: { value: surface.mu, unit: '1' },
      fraction: { value: point.fraction, unit: '1' },
      gravity: { value: scene && scene.gravity, unit: 'm/s^2' }
    };
    const out = {};
    Object.keys(slots).forEach(name => {
      const row = slots[name];
      if (typeof row.value === 'number' && isFinite(row.value)) out[name] = row;
    });
    return out;
  }
  function apply(law, values) {
    if (!law || law.status !== 'admitted' || law.fact === true || !law.expression || !Array.isArray(law.variables)) {
      return { applied: false, reason: 'not_admitted', fact: false };
    }
    const nums = {};
    const trace = [];
    let outside = null;
    for (let i = 0; i < law.variables.length; i++) {
      const name = law.variables[i];
      const raw = values && values[name];
      const value = raw && typeof raw === 'object' ? raw.value : raw;
      const span = law.range && law.range[name];
      const unit = (span && span.unit) || (raw && raw.unit) || null;
      if (typeof value !== 'number' || !isFinite(value)) return { applied: false, reason: 'missing', name: name, fact: false };
      trace.push({ name: name, value: value, unit: unit });
      if (span && typeof span.min === 'number' && typeof span.max === 'number' && (value < span.min || value > span.max)) {
        outside = { name: name, value: value, min: span.min, max: span.max, unit: unit };
      }
      nums[name] = value;
    }
    if (outside) return { applied: false, reason: 'out_of_range', variable: outside, trace: trace, law: law, fact: false };
    const value = scoreLaw(law, nums);
    if (value == null || !isFinite(value)) return { applied: false, reason: 'unevaluable', fact: false };
    const outcome = value > law.threshold ? law.above : law.below;
    return {
      applied: true, mode: 'derive', outcome: outcome, value: value, threshold: law.threshold,
      expression: law.expression, assumptions: law.assumptions || [], atom: law.atom || null,
      trace: trace, law: law, fact: false, may_store_as_fact: false, method: 'learned_mechanism'
    };
  }
  function prepare(problem, laws) {
    const scene = problem && problem.scene;
    if (!scene) return { mode: 'simulate', reason: 'no_scene', fact: false };
    const values = sceneValues(scene);
    const rows = (laws || []).filter(law => law && (!law.solver || !problem.solver || law.solver === problem.solver));
    let outside = null;
    for (let i = 0; i < rows.length; i++) {
      const got = apply(rows[i], values);
      if (got.applied) return got;
      if (got.reason === 'out_of_range' && !outside) outside = got;
    }
    if (outside) return Object.assign({ mode: 'simulate' }, outside);
    return { mode: 'simulate', reason: rows.length ? 'missing' : 'no_mechanism', fact: false };
  }
  function counterfactual(law, before, after) {
    const prior = apply(law, before);
    const next = apply(law, after);
    const names = [];
    Object.keys(before || {}).concat(Object.keys(after || {})).forEach(name => { if (names.indexOf(name) < 0) names.push(name); });
    const changed = [];
    names.forEach(name => {
      const fromRow = before && before[name];
      const toRow = after && after[name];
      const from = fromRow && typeof fromRow === 'object' ? fromRow.value : fromRow;
      const to = toRow && typeof toRow === 'object' ? toRow.value : toRow;
      if (from === to) return;
      changed.push({ name: name, from: from, to: to, unit: (toRow && toRow.unit) || (fromRow && fromRow.unit) || null });
    });
    return {
      steps: ['abduction', 'action', 'prediction'],
      abduction: { values: before || {}, outcome: prior.applied ? prior.outcome : null, applied: prior.applied === true, reason: prior.reason || null, value: prior.value == null ? null : prior.value, fact: false },
      action: { do: changed, fact: false },
      prediction: { outcome: next.applied ? next.outcome : null, applied: next.applied === true, reason: next.reason || null, value: next.value == null ? null : next.value, expression: law && law.expression, threshold: law && law.threshold, fact: false },
      fact: false, may_store_as_fact: false, calls_llm: false
    };
  }
  function refit(receipts) {
    const rows = (receipts || []).filter(r => r && r.id && r.outcome);
    const found = induce(rows);
    const doc = load();
    const now = new Date().toISOString();
    let changed = false;
    (doc.mechanisms || []).forEach(law => {
      if (!law || law.status !== 'admitted') return;
      const fresh = rows.filter(r => (law.train || []).indexOf(r.id) < 0 && (law.held || []).indexOf(r.id) < 0 && law.solver === (r.solver || r.primary_solver));
      const miss = fresh.filter(r => { const pred = predict(law, r); return pred && pred !== r.outcome; });
      if (miss.length) {
        law.status = 'archived';
        law.valid_to = now;
        law.refit = { at: now, disagreed: miss.map(r => r.id), fact: false };
        changed = true;
        return;
      }
      const next = (found.proposals || []).find(p => p && p.expression === law.expression && p.solver === law.solver && p.status === 'proposal');
      if (!next) return;
      const agreed = rows.filter(r => predict(law, r) === r.outcome);
      const range = JSON.parse(JSON.stringify(law.range || {}));
      agreed.forEach(r => {
        const map = sceneMap(r);
        law.variables.forEach(name => {
          if (!map[name] || typeof map[name].value !== 'number') return;
          const row = range[name] || { unit: map[name].unit, dimension: map[name].dimension, min: map[name].value, max: map[name].value };
          row.min = Math.min(row.min, map[name].value);
          row.max = Math.max(row.max, map[name].value);
          range[name] = row;
        });
      });
      const grew = law.variables.some(name => range[name] && law.range[name] && (range[name].min < law.range[name].min || range[name].max > law.range[name].max));
      if (!grew) return;
      law.range = range;
      law.threshold = next.threshold;
      law.assumptions = next.assumptions;
      law.train = next.train;
      law.held = next.held;
      if (law.atom && Array.isArray(law.atom.args)) law.atom = Object.assign({}, law.atom, { args: [law.expression, String(next.threshold)] });
      const causes = causesOf(agreed);
      if (Object.keys(causes).length) law.causes = Object.assign({}, law.causes || {}, causes);
      law.refit = { at: now, expanded: fresh.map(r => r.id), fact: false };
      changed = true;
    });
    if (changed) save(doc);
    return { ok: true, changed: changed, admitted: admitted().map(r => r.id), fact: false, may_store_as_fact: false };
  }
  function list() { return load().mechanisms.slice(); }
  function admitted() { return list().filter(r => r && r.status === 'admitted' && r.fact === false); }
  const api = { SCHEMA, clear, reload, induce, validate, nudge, list, admitted, sceneMap, nextScenes, evaluate, apply, prepare, sceneValues, refit, counterfactual };
  if (isNode) module.exports = api; else root.KMechanisms = api;
})(typeof self !== 'undefined' ? self : this);
