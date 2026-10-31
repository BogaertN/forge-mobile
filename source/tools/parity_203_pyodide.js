/* Pyodide vs CPython on the 4.9.203 frequency signature. No model.
 * Also times a full seed-lexicon resonance scan inside Pyodide. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { loadPyodide } = require('pyodide');

const ENGINE = path.join(__dirname, '..', 'engine');
const FILES = [
  'rmc_engine_v1/__init__.py',
  'rmc_engine_v1/frequency_203.py',
  'rmc_engine_v1/frequency_203_config.py',
  'rmc_engine_v1/drift_v43.py',
  'rmc_engine_v1/language_core_engines.py',
  'rmc_engine_v1/research_hooks.py',
  'rmc_engine_v1/chi_hardening.py',
  'rmc_engine_v1/concept_lexicon.json',
  'rmc_engine_v1/reference/word_loop_seed_lexicon_v1.jsonl',
  'rmc_engine_v1/reference/letter_phase_map_v1.json',
];
const cases = [
  { name: 'sun', body: { op: 'signature', word: 'sun' } },
  { name: 'light', body: { op: 'signature', word: 'light' } },
  { name: 'pair', body: { op: 'resonate', a: 'sun', b: 'hot' } },
  { name: 'unrelated', body: { op: 'resonate', a: 'sun', b: 'dog' } },
  { name: 'flags', body: { op: 'flags' } },
];

function cpython(body) {
  const r = cp.spawnSync('python3', ['-m', 'rmc_engine_v1.frequency_203'], {
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
    py.FS.mkdirTree(dest.slice(0, dest.lastIndexOf('/')));
    py.FS.writeFile(dest, fs.readFileSync(path.join(ENGINE, rel), 'utf8'));
  }
  // drift_v43 imports more modules. Mount the whole package if a case import fails.
  py.runPython('import sys\nsys.path.insert(0, "/engine")');
  let maxGap = 0;
  const rows = [];
  try {
    py.runPython('from rmc_engine_v1.frequency_203 import run, measure_lexicon');
  } catch (err) {
    const extra = [];
    function walk(dir, prefix) {
      for (const name of fs.readdirSync(dir)) {
        const abs = path.join(dir, name);
        const rel = prefix + name;
        if (fs.statSync(abs).isDirectory()) {
          if (name === '__pycache__') continue;
          py.FS.mkdirTree('/engine/' + rel);
          walk(abs, rel + '/');
        } else if (/\.(py|json|jsonl)$/.test(name)) {
          py.FS.writeFile('/engine/' + rel, fs.readFileSync(abs));
          extra.push(rel);
        }
      }
    }
    walk(path.join(ENGINE, 'rmc_engine_v1'), 'rmc_engine_v1/');
    py.runPython('from rmc_engine_v1.frequency_203 import run, measure_lexicon');
    rows.push({ name: 'mounted', extra: extra.length });
  }
  for (const c of cases) {
    py.globals.set('payload_json', JSON.stringify(c.body));
    const raw = py.runPython('import json\njson.dumps(run(json.loads(payload_json)))');
    const browser = JSON.parse(raw);
    const host = cpython(c.body);
    const d = gap(browser, host);
    maxGap = Math.max(maxGap, d);
    rows.push({ name: c.name, gap: d, matched: d < 1e-9 });
    if (!(d < 1e-9)) throw new Error(c.name + ' gap ' + d);
  }
  const timed = py.runPython([
    'import json, time',
    't0 = time.perf_counter()',
    'row = measure_lexicon()',
    'ms = (time.perf_counter() - t0) * 1000',
    'json.dumps({"ms": ms, "n": row["n"], "pairs": row["pairs"], "before": row["before"], "after": row["after"]})'
  ].join('\n'));
  const scan = JSON.parse(timed);
  const out = {
    pyodide: py.version,
    cases: cases.length,
    matched: rows.filter(row => row.matched).length,
    max_abs_gap: maxGap,
    calls_llm: false,
    lexicon_scan_ms: scan.ms,
    lexicon_n: scan.n,
    lexicon_pairs: scan.pairs,
    lexicon_before: scan.before,
    lexicon_after: scan.after,
    rows: rows
  };
  fs.writeFileSync(path.join(__dirname, 'live_203_pyodide.json'), JSON.stringify(out));
  console.log(JSON.stringify(out));
}

main().catch(err => { console.error(err); process.exit(1); });
