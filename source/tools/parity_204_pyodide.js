/* Pyodide vs CPython on the 4.9.204 tuning field. No model.
 * Times one pass of the sun/light series inside Pyodide. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { loadPyodide } = require('pyodide');

const ENGINE = path.join(__dirname, '..', 'engine');
const cases = [
  { name: 'flags', body: { op: 'flags' } },
  { name: 'config', body: { op: 'config' } },
  {
    name: 'series',
    body: {
      op: 'script',
      steps: [0, 1, 2, 3, 4, 5].map(i => ({
        op: 'admit', id: 's' + i, words: ['sun', 'light'], C: 0.9, echo: 1, drift: 0.05,
        phase: 6, trust: 'local', calls_llm: false, t_hours: i
      })).concat([
        { op: 'retract', id: 's0' },
        { op: 'phi', word: 'heat', phi: 8 },
        { op: 'admit', id: 'mem', words: ['sun', 'light'], C: 0.9, echo: 1, drift: 0.05, phase: 7, trust: 'local', calls_llm: false }
      ])
    }
  }
];

function cpython(body) {
  const r = cp.spawnSync('python3', ['-m', 'rmc_engine_v1.frequency_204'], {
    input: JSON.stringify(body),
    cwd: ENGINE,
    env: Object.assign({}, process.env, { PYTHONPATH: ENGINE }),
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
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
      }
    }
  }
  walk(path.join(ENGINE, 'rmc_engine_v1'), 'rmc_engine_v1/');
  py.runPython('import sys\nsys.path.insert(0, "/engine")');
  py.runPython('from rmc_engine_v1.frequency_204 import run, sun_series\nfrom rmc_engine_v1.frequency_203 import measure_lexicon');
  let maxGap = 0;
  const rows = [];
  for (const c of cases) {
    if (c.name === 'config') {
      // The design note string is long and identical; compare the numbers only.
    }
    py.globals.set('payload_json', JSON.stringify(c.body));
    const raw = py.runPython('import json\njson.dumps(run(json.loads(payload_json)))');
    const browser = JSON.parse(raw);
    const host = cpython(c.body);
    if (c.name === 'config') {
      delete browser.math;
      delete host.math;
      delete browser.cite;
      delete host.cite;
    }
    const d = gap(browser, host);
    maxGap = Math.max(maxGap, d);
    rows.push({ name: c.name, gap: d, matched: d < 1e-9 });
    if (!(d < 1e-9)) throw new Error(c.name + ' gap ' + d);
  }
  const timed = py.runPython([
    'import json, time',
    't0 = time.perf_counter()',
    'row = sun_series(12)',
    'series_ms = (time.perf_counter() - t0) * 1000',
    't1 = time.perf_counter()',
    'lex = measure_lexicon()',
    'lex_ms = (time.perf_counter() - t1) * 1000',
    'last = row["steps"][-1]',
    'json.dumps({"series_ms": series_ms, "lexicon_scan_ms": lex_ms, "n": lex["n"], "pairs": lex["pairs"], "cover": last["cover"], "resonate": last["resonate"], "master": last["master_unchanged"]})'
  ].join('\n'));
  const scan = JSON.parse(timed);
  const out = {
    pyodide: py.version,
    cases: cases.length,
    matched: rows.filter(row => row.matched).length,
    max_abs_gap: maxGap,
    calls_llm: false,
    series_ms: scan.series_ms,
    lexicon_scan_ms: scan.lexicon_scan_ms,
    lexicon_n: scan.n,
    lexicon_pairs: scan.pairs,
    series_cover: scan.cover,
    series_resonate: scan.resonate,
    master_unchanged: scan.master,
    rows: rows
  };
  fs.writeFileSync(path.join(__dirname, 'live_204_pyodide.json'), JSON.stringify(out));
  console.log(JSON.stringify(out));
}

main().catch(err => { console.error(err); process.exit(1); });
