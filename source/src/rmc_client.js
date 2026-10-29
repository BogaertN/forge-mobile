/* Browser-first client for rmc_engine_v1.mobile_ask.
 * Node calls the same package with python3. The browser worker loads the
 * Pyodide bundle after its integrity check, then falls back to
 * POST /api/rmc/deep-dry-run when the bundle cannot load.
 * The reply is the engine's. No model is invoked. */
(function (root) {
'use strict';
const HELD = 'The answer is held.';
const BUNDLE = { url: 'data/py/rmc_engine_bundle.json', sri: 'sha384-GXx7KGLquaWIFKn8Oi/MXTuPKu71yKDs3zzB7mJjLLaEY7nXZV9eMvPT3SpzEsJy' };
function held(extra) { return Object.assign({ ok: false, engine: 'rmc_engine_v1', reply: HELD, admitted: false, held: true, fallback: true, calls_llm: false, model_invoked: false }, extra || {}); }
function askSync(payload) {
  if (typeof require !== 'function') return held({ error: 'browser_uses_worker' });
  const cp = require('child_process');
  const path = require('path');
  const engine = path.join(__dirname, '..', 'engine');
  let r;
  try {
    r = cp.spawnSync(process.env.PYTHON || 'python3', ['-m', 'rmc_engine_v1.rmc_core'], {
      input: JSON.stringify(payload || {}),
      cwd: engine,
      env: Object.assign({}, process.env, { PYTHONPATH: engine }),
      encoding: 'utf8',
      timeout: 20000,
      maxBuffer: 8 * 1024 * 1024
    });
  } catch (e) { return held({ error: String(e && e.message || e).slice(0, 200), path: 'python' }); }
  if (!r || r.error || r.status) return held({ error: String((r && (r.stderr || r.error && r.error.message)) || 'python_failed').slice(0, 240), path: 'python' });
  try { const out = JSON.parse(r.stdout); out.path = 'python'; return out; }
  catch (e) { return held({ error: 'bad_json', path: 'python' }); }
}
async function askBackend(payload, url) {
  const endpoint = url || '/api/rmc/deep-dry-run';
  const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload || {}) });
  if (!res.ok) throw new Error('rmc_http_' + res.status);
  const out = await res.json();
  out.path = 'backend';
  return out;
}
function askBrowser(payload, opts) {
  opts = opts || {};
  const Py = root.KPyCheck;
  const runWorker = async () => {
    if (!Py || !Py.Client) throw new Error('pyodide_client_missing');
    const client = opts.client || Py.Client({ workerUrl: opts.workerUrl || 'src/py_worker.js' });
    return client.rmcAsk(payload, { bundleUrl: BUNDLE.url, bundleSri: BUNDLE.sri });
  };
  return runWorker().then(out => Object.assign({ path: 'pyodide' }, out)).catch(() => askBackend(payload, opts.endpoint).catch(e => held({ error: String(e && e.message || e).slice(0, 200), path: 'backend' })));
}
function ask(payload, opts) {
  if (typeof require === 'function' && typeof fetch === 'undefined') return Promise.resolve(askSync(payload));
  return askBrowser(payload, opts);
}
const api = { HELD, BUNDLE, askSync, askBrowser, ask, askBackend };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KRMC = api;
})(typeof self !== 'undefined' ? self : this);
