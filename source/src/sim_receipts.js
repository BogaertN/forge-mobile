/* Simulation evidence. A sealed receipt is kept as a structured record: the scene, the
 * numbers it carried and the units those numbers already had, the outcome, and the mechanism
 * atoms the solver spoke. It is evidence. It is not a fact, and it is not a publisher.
 * Reloading the page reads the same records back. Nothing here writes a world fact or a gate. */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const SCHEMA = 'forge.sim_evidence/v1';
  const KEY = 'forge.sim_evidence.v1';
  const MAX = 200;
  let MEM = null;
  let DISK = null;
  function algebra() {
    if (isNode) { try { return require('./algebra.js'); } catch (e) { return {}; } }
    return root.KAlgebra || {};
  }
  function blank() { return { schema: SCHEMA, receipts: [], calls_llm: false, changes_gates: false, may_store_as_fact: false, publisher: false }; }
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
        if (v && v.schema === SCHEMA && Array.isArray(v.receipts)) return (MEM = Object.assign(blank(), v, { may_store_as_fact: false, publisher: false }));
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
  function clear() {
    MEM = blank();
    const b = backend();
    if (b) { try { b.del(KEY); } catch (e) { /* an empty memory is the cleared store */ } }
    return { ok: true };
  }
  function reload() { MEM = null; return load(); }
  function unitFor(key) {
    const alg = algebra();
    const U = alg.U || {};
    const TEMP = alg.TEMP || {};
    const k = String(key || '').toLowerCase();
    if (U[k]) return { unit: U[k].name, dimension: U[k].dim };
    if (TEMP[k]) return { unit: TEMP[k] === 'C' ? 'celsius' : TEMP[k] === 'F' ? 'fahrenheit' : 'kelvin', dimension: 'temperature' };
    const bits = k.split('_');
    if (bits.length > 1) {
      const last = bits[bits.length - 1];
      if (U[last]) return { unit: U[last].name, dimension: U[last].dim };
      if (TEMP[last]) return { unit: TEMP[last] === 'C' ? 'celsius' : TEMP[last] === 'F' ? 'fahrenheit' : 'kelvin', dimension: 'temperature' };
    }
    /* Quantities the scene compiler already stores in SI. The name is the slot, not an object. */
    const SI = {
      height: ['m', 'length'], width: ['m', 'length'], depth: ['m', 'length'], radius: ['m', 'length'],
      drop_height: ['m', 'length'], mass: ['kg', 'mass'], gravity: ['m/s^2', 'acceleration'],
      speed: ['m/s', 'velocity'], mu: ['1', 'dimensionless'], fraction: ['1', 'dimensionless']
    };
    if (SI[k]) return { unit: SI[k][0], dimension: SI[k][1] };
    if (k === 'slope_deg' || k === 'angle_deg' || k === 'tilt_deg' || k.endsWith('_deg')) return { unit: 'degree', dimension: 'angle' };
    return { unit: null, dimension: null };
  }
  function walk(node, path, source, out) {
    if (!node || typeof node !== 'object' || out.length >= 64) return;
    Object.keys(node).forEach(key => {
      if (key === 'question' || key === 'sources' || key === 'calls_llm' || key === 'text' || key === 'equations') return;
      const v = node[key];
      const here = path ? path + '.' + key : key;
      if (typeof v === 'number' && isFinite(v)) {
        const u = unitFor(key);
        out.push({ name: key, path: here, value: v, unit: u.unit, dimension: u.dimension, source: source });
      } else if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, here, source, out);
    });
  }
  function atomsOf(receipt, role) {
    const spoken = Array.isArray(receipt.spoken_atoms) ? receipt.spoken_atoms : [];
    return spoken.filter(row => row && row.role === role && row.atom).map(row => ({
      role: role === 'reason' ? 'mechanism' : role,
      text: row.text || '',
      atom: row.atom
    }));
  }
  function structuredScene(scene) {
    if (!scene || typeof scene !== 'object') return null;
    const body = scene.body && typeof scene.body === 'object' ? scene.body : {};
    const surface = scene.surface && typeof scene.surface === 'object' ? scene.surface : {};
    return {
      schema: scene.schema || null,
      action: scene.action || null,
      verb: scene.verb || null,
      karaka: scene.karaka || null,
      body: {
        noun: body.noun || null, shape: body.shape || null, adjectives: body.adjectives || [],
        height: body.height, width: body.width, depth: body.depth, radius: body.radius, mass: body.mass
      },
      surface: { name: surface.name || null, mu: surface.mu },
      point: scene.point || null,
      gravity: scene.gravity,
      slope_deg: scene.slope_deg,
      launch: scene.launch || null,
      drop_height: scene.drop_height
    };
  }
  function fromReceipt(receipt) {
    if (!receipt || receipt.ok !== true || receipt.may_store_as_fact === true) return null;
    const id = String(receipt.receipt_id || '');
    const sha = String(receipt.sha256 || '');
    if (!id || !sha) return null;
    const problem = receipt.problem && typeof receipt.problem === 'object' ? receipt.problem : {};
    const run = receipt.run && typeof receipt.run === 'object' ? receipt.run : {};
    const scene = problem.scene && typeof problem.scene === 'object' ? problem.scene : null;
    const variables = [];
    if (scene) walk(scene, 'scene', 'scene', variables);
    const stated = {};
    Object.keys(problem).forEach(key => {
      if (key === 'scene' || key === 'question' || key === 'frame') return;
      if (typeof problem[key] === 'number' && isFinite(problem[key])) stated[key] = problem[key];
    });
    walk(stated, 'problem', 'problem', variables);
    walk(run.measurements || {}, 'measurement', 'measurement', variables);
    const outcome = String(receipt.outcome || run.outcome || '');
    if (!outcome) return null;
    return {
      schema: SCHEMA,
      id: id,
      sha256: sha,
      evidence_class: 'simulation',
      fact: false,
      may_store_as_fact: false,
      publisher: false,
      hosted_eligible: false,
      supabase_write: false,
      calls_llm: false,
      question: String(receipt.question || receipt.asked || problem.question || ''),
      solver: String(receipt.primary_solver || problem.solver || ''),
      family: problem.family || null,
      outcome: outcome,
      scene: structuredScene(scene),
      variables: variables,
      mechanism_atoms: atomsOf(receipt, 'reason'),
      effect_atoms: atomsOf(receipt, 'effect'),
      recorded_at: new Date().toISOString()
    };
  }
  function record(receipt) {
    const row = fromReceipt(receipt);
    if (!row) return { ok: false, rule: 'SIM-EVIDENCE-REFUSED', fact: false, publisher: false };
    const doc = load();
    const rows = doc.receipts.filter(r => r && r.id !== row.id);
    rows.push(row);
    doc.receipts = rows.slice(-MAX);
    save(doc);
    return { ok: true, id: row.id, fact: false, publisher: false, may_store_as_fact: false };
  }
  function list() { return load().receipts.slice(); }
  const api = { SCHEMA, KEY, clear, reload, record, list, fromReceipt, unitFor };
  if (isNode) module.exports = api; else root.KSimReceipts = api;
})(typeof self !== 'undefined' ? self : this);
