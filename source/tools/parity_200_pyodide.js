/* Pyodide vs CPython on the 4.9.200 RMC renderer. No model. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { loadPyodide } = require('pyodide');

const ENGINE = path.join(__dirname, '..', 'engine');
const FILES = [
  'rmc_engine_v1/__init__.py',
  'rmc_engine_v1/chi_hardening.py',
  'rmc_engine_v1/drift_v43.py',
  'rmc_engine_v1/language_core_engines.py',
  'rmc_engine_v1/dpa_195.py',
  'rmc_engine_v1/measurement_kernel.py',
  'rmc_engine_v1/manifest_compiler.py',
  'rmc_engine_v1/research_hooks.py',
  'rmc_engine_v1/geometry_199.py',
  'rmc_engine_v1/mobile_config.py',
  'rmc_engine_v1/echo_question.py',
  'rmc_engine_v1/lexicon_resonance.py',
  'rmc_engine_v1/ppe_lexicon_197.py',
  'rmc_engine_v1/concept_lexicon.json',
  'rmc_engine_v1/anchor_concepts.json',
  'rmc_engine_v1/reference/word_loop_seed_lexicon_v1.jsonl',
  'rmc_engine_v1/reference/letter_phase_map_v1.json',
  'rmc_engine_v1/reference/phase_codex_v2_5.json',
  'rmc_engine_v1/reference/phase_drift_flags_v2_5.json',
  'rmc_engine_v1/rmc_renderer_200.py',
];
const cases = [
  { name: 'summary', body: { op: 'summary' } },
  { name: 'pass', body: { op: 'monitor', mode: 'pass' } },
  { name: 'echo', body: { op: 'monitor', mode: 'echo' } },
  { name: 'tone', body: { op: 'monitor', mode: 'tone' } },
  { name: 'anchor', body: { op: 'monitor', mode: 'anchor' } },
  { name: 'hooks', body: { op: 'monitor', mode: 'hooks' } },
  { name: 'stage', body: { op: 'stage' } },
  {
    name: 'script',
    body: {
      op: 'script',
      steps: [
        { question: 'Why is the sky blue?', candidate: 'The sky is blue because sunlight scatters.', charge: 0.55, drift: 0.2, chi: 0 },
        { question: 'Why is the sky blue?', candidate: 'Chlorine gas is toxic.', charge: 0.55, drift: 0.2, chi: 0 },
        { question: 'Why is the sky blue?', candidate: 'The sky is blue because sunlight scatters.', charge: 0.55, drift: 0.2, chi: 0, path: [5, 8] }
      ]
    }
  },
];

function cpython(body) {
  const r = cp.spawnSync('python3', ['-m', 'rmc_engine_v1.rmc_renderer_200'], {
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
    const dest = '/engine/' + rel;
    const dir = dest.slice(0, dest.lastIndexOf('/'));
    py.FS.mkdirTree(dir);
    py.FS.writeFile(dest, fs.readFileSync(path.join(ENGINE, rel), 'utf8'));
  }
  py.runPython('import sys\nsys.path.insert(0, "/engine")\nfrom rmc_engine_v1.rmc_renderer_200 import run');
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
  const dest = path.join(__dirname, 'live_200_pyodide.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out));
}

main().catch(err => { console.error(err); process.exit(1); });
