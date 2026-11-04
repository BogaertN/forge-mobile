/* 4.9.223: Pyodide (the shipped engine bundle, the files the phone loads) vs CPython vs JS on every 4.9.223 decision case
 * (tools/meaning_cases_223.py: meaning agreement, subject-meaning phase, GeoNames not counted, value slot, short glosses,
 * document licence) and the canonical value form. No model, no network.
 * usage: NODE_PATH=<dir with pyodide> node tools/parity_223_pyodide.js */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { loadPyodide } = require('pyodide');
const ROOT = path.join(__dirname, '..');
const env = Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine'), FORGE_OEWN_DIR: path.join(ROOT, 'verify/fixtures/athena_223/oewn') });
const cases = JSON.parse(cp.execFileSync('python3', [path.join(ROOT, 'tools/meaning_cases_223.py')], { cwd: ROOT, env, maxBuffer: 1 << 26 }).toString());
const S = require(path.join(ROOT, 'src/self_seed_202.js'));
const SCRIPT = 'import json\nfrom rmc_engine_v1.self_seed_202 import evaluate, value_canon\nd=json.loads(INPUT)\nOUT=json.dumps([[evaluate(c["payload"]) for c in d["payloads"]],[value_canon(v) for v in d["values"]]], sort_keys=True)';
const canon = v => Array.isArray(v) ? v.map(canon) : (v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => { o[k] = canon(v[k]); return o; }, {}) : v);
const key = r => JSON.stringify(canon([r.rule, r.hosts || null, r.claim || null, r.loop_phi, r.loop_from, r.anchor ? [r.anchor.text, r.anchor.license, r.anchor.provenance.origin] : null, (r.trace || {}).meaning || null]));
(async () => {
  const cpy = cp.execFileSync('python3', ['-c', 'import sys\nINPUT=sys.stdin.read()\n' + SCRIPT + '\nprint(OUT)'], { input: JSON.stringify(cases), cwd: path.join(ROOT, 'engine'), env, encoding: 'utf8', maxBuffer: 1 << 26 }).trim();
  const py = await loadPyodide();
  const files = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/py/rmc_engine_bundle.json'), 'utf8')).files;
  for (const [rel, src] of Object.entries(files)) { const full = '/eng/' + rel; py.FS.mkdirTree(path.posix.dirname(full)); py.FS.writeFile(full, src); }
  py.runPython('import sys; sys.path.insert(0, "/eng")');
  py.globals.set('INPUT', JSON.stringify(cases));
  py.runPython(SCRIPT);
  const pyo = py.globals.get('OUT');
  const js = [cases.payloads.map(c => S.evaluate(JSON.parse(JSON.stringify(c.payload)))), cases.values.map(S.valueCanon)];
  const a = JSON.parse(pyo), b = JSON.parse(cpy);
  const same = pyo === cpy && a[0].every((r, i) => key(r) === key(js[0][i])) && JSON.stringify(a[1]) === JSON.stringify(js[1]);
  console.log(JSON.stringify({ ok: same, pyodide_equals_cpython: pyo === cpy, js_equals: a[0].every((r, i) => key(r) === key(js[0][i])), cases: cases.payloads.length, values: cases.values.length, rules: a[0].map(r => r.rule) }));
  process.exit(same ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
