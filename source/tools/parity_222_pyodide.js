/* 4.9.222: Pyodide (the shipped engine bundle, the files the phone loads) vs CPython on the self-seed decision for documents
 * the Tier-A fetchers produced from the recorded responses (verify/fixtures/athena_222), plus content-word subject binding.
 * No model, no network. usage: NODE_PATH=<dir with pyodide> node tools/parity_222_pyodide.js */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { loadPyodide } = require('pyodide');
const ROOT = path.join(__dirname, '..');
const FIX = path.join(ROOT, 'verify/fixtures/athena_222');
const env = Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine'), FORGE_OEWN_DIR: path.join(FIX, 'oewn') });
const docs = JSON.parse(cp.execFileSync('python3', ['-c', [
  'import json,sys', 'from rmc_engine_v1 import athena_sources_222 as A', 'R=json.load(open(sys.argv[1]))["responses"]',
  'def h(u):', '    if u in R: return R[u]', '    raise A.FetchMiss(u)', 'out={}',
  'for q in ["What is the capital of Burkina Faso?","What is the Moon?","What is gravity?","What is ammonia?","What is the speed of light?","What is a kilogram?"]:',
  '    out[q]=A.fetch_all(q, http=h)["documents"]', 'print(json.dumps(out))'].join('\n'), path.join(FIX, 'responses.json')], { cwd: path.join(ROOT, 'engine'), env }).toString());
const payloads = [];
for (const [q, d] of Object.entries(docs)) { payloads.push({ question: q, documents: d, gap: true, reset: true, now: 1000 }); payloads.push({ question: q, documents: d, gap: true, reset: true, now: 1000, loop_phi: 6 }); }
const SCRIPT = 'import json,sys\nfrom rmc_engine_v1.self_seed_202 import evaluate\nprint(json.dumps([evaluate(x) for x in json.load(sys.stdin)], sort_keys=True))';
(async () => {
  const cpy = cp.execFileSync('python3', ['-c', SCRIPT], { input: JSON.stringify(payloads), cwd: path.join(ROOT, 'engine'), env, encoding: 'utf8', maxBuffer: 1 << 26 }).trim();
  const py = await loadPyodide();
  const files = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/py/rmc_engine_bundle.json'), 'utf8')).files;
  for (const [rel, src] of Object.entries(files)) { const full = '/eng/' + rel; py.FS.mkdirTree(path.posix.dirname(full)); py.FS.writeFile(full, src); }
  py.runPython('import sys; sys.path.insert(0, "/eng")');
  py.globals.set('PAYLOADS', JSON.stringify(payloads));
  const pyo = py.runPython('import json\nfrom rmc_engine_v1.self_seed_202 import evaluate\njson.dumps([evaluate(x) for x in json.loads(PAYLOADS)], sort_keys=True)');
  const same = pyo === cpy;
  console.log(JSON.stringify({ ok: same, cases: payloads.length, rules: JSON.parse(pyo).map(r => r.rule) }));
  process.exit(same ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
