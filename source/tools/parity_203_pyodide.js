/* Pyodide vs CPython on the 4.9.203 self-seed decision. No model. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { loadPyodide } = require('pyodide');

const ENGINE = path.join(__dirname, '..', 'engine');
const FILES = [
  'rmc_engine_v1/__init__.py',
  'rmc_engine_v1/self_seed_203.py',
  'rmc_engine_v1/self_seed_202.py',
  'rmc_engine_v1/echo_question.py',
  'rmc_engine_v1/mobile_config.py',
  'rmc_engine_v1/chi_hardening.py',
  'rmc_engine_v1/lexicon_resonance.py',
  'rmc_engine_v1/phase_parser.py',
  'rmc_engine_v1/concept_lexicon.json',
  'rmc_engine_v1/anchor_concepts.json',
  'rmc_engine_v1/reference/trusted_sources_202.json',
  'rmc_engine_v1/reference/trusted_sources_203.json',
  'rmc_engine_v1/reference/word_loop_seed_lexicon_v1.jsonl',
  'rmc_engine_v1/reference/letter_phase_map_v1.json',
  'rmc_engine_v1/reference/phase_codex_v2_5.json',
  'rmc_engine_v1/reference/phase_drift_flags_v2_5.json',
];
const cases = [
  { name: 'agree', body: { op: 'evaluate', question: 'Who was Cleopatra?', gap: true, now: 1000, loop_phi: 1, reset: true, documents: [
    { url: 'https://www.gutenberg.org/ebooks/1', title: 'Cleopatra', text: 'Cleopatra was a queen of Egypt in the ancient world.' },
    { url: 'https://openstax.org/books/x', title: 'Cleopatra', text: 'Cleopatra was a queen of Egypt in the ancient world.' }
  ] } },
  { name: 'coref', body: { op: 'evaluate', question: 'Who was Cleopatra?', gap: true, now: 1000, loop_phi: 1, reset: true, documents: [
    { url: 'https://www.gutenberg.org/ebooks/1', title: 'Cleopatra', own_entry: true, text: 'She was a queen of Egypt in the ancient world and Cleopatra ruled the Nile.' },
    { url: 'https://openstax.org/books/x', title: 'Cleopatra', own_entry: true, text: 'She was a queen of Egypt in the ancient world and Cleopatra ruled the Nile.' }
  ] } },
  { name: 'stale', body: { op: 'evaluate', question: 'When did World War II end?', gap: true, now: 1000, loop_phi: 1, reset: true, documents: [
    { url: 'https://www.gutenberg.org/ebooks/9', title: 'Encyclopaedia Britannica 11th Edition', period_year: 1911, text: 'World War II ended in 1945 after the recorded surrender.' }
  ] } },
  { name: 'wiki', body: { op: 'evaluate', question: 'Who was Cleopatra?', gap: true, now: 1000, loop_phi: 1, reset: true, documents: [
    { url: 'https://en.wikipedia.org/wiki/Cleopatra', role: 'pointer', text: 'See https://www.loc.gov/item/x' }
  ] } },
  { name: 'nonsense', body: { op: 'evaluate', question: 'Blargh floople zig?', gap: true, now: 1000, loop_phi: 1, reset: true, documents: [] } },
];

function cpython(body) {
  const r = cp.spawnSync('python3', ['-m', 'rmc_engine_v1.self_seed_203'], {
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
  py.runPython('import sys\nsys.path.insert(0, "/engine")\nfrom rmc_engine_v1.self_seed_203 import run');
  let maxGap = 0;
  const rows = [];
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
  const out = {
    pyodide: py.version,
    cases: rows.length,
    matched: rows.filter(r => r.matched).length,
    max_abs_gap: maxGap,
    rows: rows,
    calls_llm: false,
    c_min: 0.87,
  };
  fs.writeFileSync(path.join(__dirname, 'live_203_pyodide.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out));
}

main().catch(err => { console.error(err); process.exit(1); });
