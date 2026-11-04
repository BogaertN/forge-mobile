/* 4.9.220: Pyodide vs CPython on fact placement (band_tuning.place, tune, relation), run from the shipped engine bundle
 * (data/py/rmc_engine_bundle.json, the same files the phone loads). No model, no network.
 * usage: NODE_PATH=<dir with pyodide> node tools/parity_220_pyodide.js */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { loadPyodide } = require('pyodide');
const ROOT = path.join(__dirname, '..');
const QS = [['What is the Moon?', 1], ['Why is the sky blue?', 1], ['What is 17 times 23?', 1], ['Convert 5 miles to km', 1], ['What color is my car?', 1],
  ['What is the capital of Burkina Faso?', 4], ['Why is the ocean salty?', 5], ['What is gravity?', 9], ['hello', 1], ['', 1]];
const SCRIPT = 'import json,sys\nfrom rmc_engine_v1.band_tuning import tune, relation, place\nprint(json.dumps([tune(q, b) for q, b in json.loads(sys.argv[1])] + [place(q, b) for q, b in json.loads(sys.argv[1])] + [relation(a, b) for a in range(1, 10) for b in range(1, 10)], sort_keys=True))';
(async () => {
  const cpy = cp.execFileSync('python3', ['-c', SCRIPT, JSON.stringify(QS)], { cwd: path.join(ROOT, 'engine'), encoding: 'utf8' }).trim();
  const py = await loadPyodide();
  const files = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/py/rmc_engine_bundle.json'), 'utf8')).files;
  for (const [rel, src] of Object.entries(files)) { const full = '/eng/' + rel; py.FS.mkdirTree(path.posix.dirname(full)); py.FS.writeFile(full, src); }
  py.runPython('import sys; sys.path.insert(0, "/eng")');
  py.globals.set('QS', JSON.stringify(QS));
  const pyo = py.runPython('import json\nfrom rmc_engine_v1.band_tuning import tune, relation, place\njson.dumps([tune(q, b) for q, b in json.loads(QS)] + [place(q, b) for q, b in json.loads(QS)] + [relation(a, b) for a in range(1, 10) for b in range(1, 10)], sort_keys=True)');
  const same = pyo === cpy;
  console.log(JSON.stringify({ ok: same, cases: QS.length, hz: JSON.parse(pyo).slice(0, QS.length).map(r => r.hz) }));
  process.exit(same ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
