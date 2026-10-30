/* Pyodide vs CPython on the drift v4.3 fixtures. No LLM. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { loadPyodide } = require('pyodide');

const ENGINE = path.join(__dirname, '..', 'engine');
const FILES = [
  'rmc_engine_v1/__init__.py',
  'rmc_engine_v1/chi_hardening.py',
  'rmc_engine_v1/language_core_engines.py',
  'rmc_engine_v1/drift_v43.py',
];

function nest(n) {
  let node = { v: 1 };
  for (let i = 1; i < n; i++) node = { n: node };
  return node;
}
const payload = { core_state: { text: 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ' }, auxiliary: { q: 'hello-world-more-text' }, metadata: { id: 7 } };
const cases = [
  { name: 'worst', body: { payload: nest(7), prev_phase: 5, recursion_n: 1, phase_hist: [0], stamps_ms: [0, 5, 10] } },
  { name: 'calm', body: { payload: { v: 1 }, prev_phase: 1, recursion_n: 1 } },
  { name: 'axiom', body: { payload: nest(7), prev_phase: 4, recursion_n: 1, phase_hist: [0] } },
  { name: 'singularity', body: { payload: payload, psi1_trace: { totally: 'different', list: [1, 2, 3, 4] }, prev_phase: 1, recursion_n: 1, latency_ms: 2000, size_hist: [10, 20, 30], prev_D: 0.2, nu: -0.5, signatures: [{ v: 1 }], echo_confirmed: true, restore_drift: 0.29, phase_sequence: [9, 1, 2], chi_window_ms: 3000 } },
  { name: 'engine3', body: { op: 'phase_engine', steps: [{ phi: 2, phi_exp: 3, prev: 2 }, { phi: 3, phi_exp: 4, prev: 3 }, { phi: 4, phi_exp: 3, prev: 4 }] } },
  { name: 'engine2', body: { op: 'phase_engine', steps: [{ phi: 2, phi_exp: 3, prev: 2 }, { phi: 3, phi_exp: 4, prev: 3 }] } },
  { name: 'cascade', body: { op: 'cascade', epsilon: 0.2, delta: 4, mu: 2 } },
  { name: 'restore', body: { op: 'restore', echo_confirmed: true, drift: 0.29, phase_sequence: [9, 1, 2], chi_window_ms: 3000 } },
];

function cpython(body) {
  const r = cp.spawnSync('python3', ['-m', 'rmc_engine_v1.drift_v43'], {
    input: JSON.stringify(body),
    cwd: ENGINE,
    env: Object.assign({}, process.env, { PYTHONPATH: ENGINE }),
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status) throw new Error(r.stderr || 'cpython failed');
  return JSON.parse(r.stdout);
}

function gap(a, b) {
  let max = 0;
  const walk = (x, y) => {
    if (typeof x === 'number' && typeof y === 'number') max = Math.max(max, Math.abs(x - y));
    else if (Array.isArray(x) && Array.isArray(y)) x.forEach((v, i) => walk(v, y[i]));
    else if (x && y && typeof x === 'object' && typeof y === 'object') {
      for (const k of new Set(Object.keys(x).concat(Object.keys(y)))) walk(x[k], y[k]);
    } else if (x !== y) max = Math.max(max, 1);
  };
  walk(a, b);
  return max;
}

async function main() {
  const py = await loadPyodide();
  py.FS.mkdirTree('/engine/rmc_engine_v1');
  for (const rel of FILES) {
    py.FS.writeFile('/engine/' + rel, fs.readFileSync(path.join(ENGINE, rel), 'utf8'));
  }
  py.runPython('import sys\nsys.path.insert(0, "/engine")\nfrom rmc_engine_v1.drift_v43 import run');
  let maxGap = 0;
  const rows = [];
  for (const c of cases) {
    py.globals.set('payload_json', JSON.stringify(c.body));
    const raw = py.runPython('import json\njson.dumps(run(json.loads(payload_json)))');
    const browser = JSON.parse(raw);
    const host = cpython(c.body);
    const d = gap(browser, host);
    maxGap = Math.max(maxGap, d);
    rows.push({ name: c.name, gap: d, matched: d === 0 || d < 1e-9 });
    if (!(d < 1e-9)) throw new Error(c.name + ' gap ' + d);
  }
  const out = {
    pyodide: py.version,
    cases: rows.length,
    matched: rows.filter(r => r.matched).length,
    max_abs_gap: maxGap,
    rows: rows,
    calls_llm: false,
    admits_unchanged: 48,
  };
  const dest = path.join(__dirname, 'live_193_pyodide.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out));
}

main().catch(err => { console.error(err); process.exit(1); });
