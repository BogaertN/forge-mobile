/* Ask path. Calls rmc_engine_v1.rmc_core. live:true runs all 16 stages.
 * Browser: Pyodide worker first, then POST /api/rmc/deep-dry-run.
 * The reply, when one is admitted, is the engine's rendered answer. No model. */
(function (root) {
'use strict';
const RMC = typeof module !== 'undefined' && module.exports ? require('./rmc_client.js') : root.KRMC;
/* 4.9.230 (plan 229 step 1): every engine call for a question carries its kāraka frame
 * (src/qframe.js, forge.qframe/v1), compiled from the same text with the loaded grammar.
 * The caller's payload is not mutated; Python checks frame.text === question. */
function withFrame(payload) {
  if (!payload || typeof payload !== 'object' || payload.frame || typeof payload.question !== 'string') return payload;
  const QF = root && root.KQFrame, F = root && root.forge;
  if (!QF || !F) return payload;
  let frame = null;
  try { frame = QF.compile(payload.question, F); } catch (e) { frame = null; }
  return frame ? Object.assign({}, payload, { frame: frame }) : payload;
}
function run(payload, opts) {
  payload = withFrame(payload);
  if (!RMC) return Promise.resolve({ ok: false, foundations: true, product_reply: false, calls_llm: false, error: 'rmc_client_missing' });
  if (typeof require === 'function' && typeof fetch === 'undefined') return Promise.resolve(RMC.askSync(payload));
  return RMC.ask(payload, opts);
}
function runSync(payload) { return RMC && RMC.askSync ? RMC.askSync(payload) : { ok: false, foundations: true, product_reply: false, calls_llm: false, error: 'no_sync' }; }
const api = { run, runSync, withFrame };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KRMCCore = api;
})(typeof self !== 'undefined' ? self : this);
