/* Client for the Pyodide cross-check worker. Lazy: nothing is downloaded until the user taps "Cross-check with Python".
 * Governed by the permission service as the declared tool "python.crosscheck" (network_read+compute, explicit tap required). */
(function (root) {
'use strict';
const PYODIDE = { version: '0.27.7', base: 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/', sri: 'sha384-90so5tCKvl0xs9agU29IMKlAVzhfzFX7QO//YxQkRhJG58bBZrFN+2ZTRB026X5X' };
const CHECKABLE = /^(calculus|simplified|solved|math)$/;
function Client(opts) { opts = opts || {}; let w = null, n = 0; const pend = new Map(); let ready = null;
  const call = (cmd, arg) => new Promise((res, rej) => { const id = ++n; pend.set(id, { res, rej }); w.postMessage({ id, cmd, arg }); });
  function start() { if (w) return; const src = root.KPY_WORKER_SRC; const url = src ? URL.createObjectURL(new Blob([src], { type: 'text/javascript' })) : (opts.workerUrl || 'src/py_worker.js'); w = new (opts.Worker || root.Worker)(url); w.onmessage = e => { const p = pend.get(e.data.id); if (!p) return; pend.delete(e.data.id); e.data.ok ? p.res(e.data.out) : p.rej(new Error(e.data.error)); }; }
  async function ensure(rmcSource) { start(); ready = ready || call('init', { base: PYODIDE.base, sri: PYODIDE.sri, pint: false, rmc: rmcSource || null }); return ready; }
  async function ensureCore() { start(); ready = ready || call('init', { base: PYODIDE.base, sri: PYODIDE.sri, pint: false, sympy: false, rmc: null }); return ready; }
  return { PYODIDE, checkable: m => !!(m && CHECKABLE.test(m.kind)), ensure, check: async m => { await ensure(); return call('check', m); }, rmc: async src => { await ensure(); return call('rmc', src); }, rmcAsk: async (payload, bundle) => { await ensureCore(); return call('rmcAsk', Object.assign({ base: PYODIDE.base, sri: PYODIDE.sri, sympy: false, payload: payload || {} }, bundle || {})); }, stop: () => { if (w) w.terminate(); w = null; ready = null; } }; }
const api = { Client, PYODIDE, CHECKABLE };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KPyCheck = api;
})(typeof self !== 'undefined' ? self : this);
