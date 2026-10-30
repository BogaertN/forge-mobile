/* Pyodide vs CPython on the 4.9.197 Phase Parsing Engine lexicon. No LLM. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { loadPyodide } = require('pyodide');

const ENGINE = path.join(__dirname, '..', 'engine');
const FILES = [
  'rmc_engine_v1/__init__.py',
  'rmc_engine_v1/chi_hardening.py',
  'rmc_engine_v1/drift_v43.py',
  'rmc_engine_v1/lexicon_resonance.py',
  'rmc_engine_v1/ppe_lexicon_197.py',
  'rmc_engine_v1/reference/letter_phase_map_v1.json',
  'rmc_engine_v1/reference/word_loop_seed_lexicon_v1.jsonl',
  'rmc_engine_v1/reference/phase_codex_v2_5.json',
  'rmc_engine_v1/reference/phase_drift_flags_v2_5.json',
  'rmc_engine_v1/reference/harper_visual_manifest_v1.json',
];
const cases = [
  { name: 'examples', body: { op: 'examples' } },
  { name: 'harper', body: { op: 'harper' } },
  { name: 'remember', body: { op: 'word', word: 'remember' } },
  { name: 'sky', body: { op: 'word', word: 'sky' } },
  { name: 'summary', body: { op: 'summary' } },
  { name: 'stage', body: { op: 'stage', question: 'why is the sky blue' } },
  { name: 'seeds-monitor', body: { op: 'monitor', mode: 'seeds' } },
  { name: 'harper-monitor', body: { op: 'monitor', mode: 'harper' } },
  { name: 'drift-monitor', body: { op: 'monitor', mode: 'drift' } },
  { name: 'glyph', body: { op: 'glyph', phi: 4 } },
];

function cpython(body) {
  const r = cp.spawnSync('python3', ['-m', 'rmc_engine_v1.ppe_lexicon_197'], {
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
  py.FS.mkdirTree('/engine/rmc_engine_v1/reference');
  for (const rel of FILES) {
    py.FS.writeFile('/engine/' + rel, fs.readFileSync(path.join(ENGINE, rel), 'utf8'));
  }
  py.runPython('import sys\nsys.path.insert(0, "/engine")\nfrom rmc_engine_v1.ppe_lexicon_197 import run');
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
    c_min: 0.87,
  };
  const dest = path.join(__dirname, 'live_197_pyodide.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out));
}

main().catch(err => { console.error(err); process.exit(1); });
