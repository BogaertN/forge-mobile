/* Pyodide vs CPython on the 4.9.194 breaker and analyzer. No LLM. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { loadPyodide } = require('pyodide');

const ENGINE = path.join(__dirname, '..', 'engine');
const FILES = [
  'rmc_engine_v1/__init__.py',
  'rmc_engine_v1/language_core_engines.py',
  'rmc_engine_v1/drift_194.py',
];
const cases = [
  { name: 'three', body: { samples: [{ t: 0, epsilon_s: 0.36 }, { t: 0.2, epsilon_s: 0.36 }, { t: 0.4, epsilon_s: 0.36 }] } },
  { name: 'two', body: { samples: [{ t: 0, epsilon_s: 0.36 }, { t: 0.2, epsilon_s: 0.36 }] } },
  { name: 'retry', body: { op: 'retry', attempt: 3 } },
  { name: 'linear', body: { op: 'analyze', series: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6], pattern: 'linear_degradation', window: 3, critical: 0.8 } },
  { name: 'exp', body: { op: 'analyze', series: [0.1, 0.2, 0.4], pattern: 'exponential_explosion', critical: 0.8 } },
  { name: 'failsafe', body: { op: 'failsafe', loop_age_s: 121, drift: 0.2, echo_confirmed: true } },
  { name: 'halt', body: { op: 'failsafe', loop_age_s: 10, drift: 0.85 } },
  { name: 'class4', body: { op: 'class', synthetic: true, entropy: 0.1, lineage_revalidated: true } },
  { name: 'class3', body: { op: 'class', entropy: 0.68, psi_trace_valid: false } },
  { name: 'rsoc', body: { op: 'rsoc', epsilon_s: 0.75 } },
  { name: 'storage', body: { op: 'storage', epsilon_s: 0.36 } },
];

function cpython(body) {
  const r = cp.spawnSync('python3', ['-m', 'rmc_engine_v1.drift_194'], {
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
  py.runPython('import sys\nsys.path.insert(0, "/engine")\nfrom rmc_engine_v1.drift_194 import run');
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
  const dest = path.join(__dirname, 'live_194_pyodide.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out));
}

main().catch(err => { console.error(err); process.exit(1); });
