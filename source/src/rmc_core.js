/* Ask path. Calls rmc_engine_v1.rmc_core. live:true runs all 16 stages.
 * Browser: Pyodide worker first, then POST /api/rmc/deep-dry-run.
 * The reply, when one is admitted, is the engine's rendered answer. No model. */
(function (root) {
'use strict';
const RMC = typeof module !== 'undefined' && module.exports ? require('./rmc_client.js') : root.KRMC;
function run(payload, opts) {
  if (!RMC) return Promise.resolve({ ok: false, foundations: true, product_reply: false, calls_llm: false, error: 'rmc_client_missing' });
  if (typeof require === 'function' && typeof fetch === 'undefined') return Promise.resolve(RMC.askSync(payload));
  return RMC.ask(payload, opts);
}
function runSync(payload) { return RMC && RMC.askSync ? RMC.askSync(payload) : { ok: false, foundations: true, product_reply: false, calls_llm: false, error: 'no_sync' }; }
const api = { run, runSync };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KRMCCore = api;
})(typeof self !== 'undefined' ? self : this);
