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
  const out = frame ? Object.assign({}, payload, { frame: frame }) : Object.assign({}, payload);
  return withClauses(out, QF, F);
}
/* 4.9.231 (Nic plan 229, step 3): every memory row the Ask sends carries its kāraka clause beside its text. A row that already
 * has one (a remembered statement keeps the clause it was parsed into) is left as it is; the others are parsed once per text
 * (KQFrame.clauseCached) and the rows are copied, never changed in place. A sentence that does not parse is sent without one. */
const CLAUSE_KEYS = ['receipts', 'phone', 'hosted', 'anchors'];
function clauseRow(row, QF, F, stat) {
  if (!row || typeof row !== 'object' || !row.text) return row;
  stat.rows++;
  if (row.clause && row.clause.schema === QF.CLAUSE) { stat.kept++; return row; }
  const c = QF.clauseCached(row.text, F); stat.parsed++;
  if (!c || !(c.parsed || (c.sentences || []).some(x => x.parsed))) { stat.unparsed++; return row; }
  // the row's meaning id rides on its clause; phase, band and Hz are placed by the engine's resonance placement each turn
  return Object.assign({}, row, { clause: row.meaning_id ? Object.assign({}, c, { meaning_id: row.meaning_id }) : c });
}
function withClauses(payload, QF, F) {
  const mem = payload && payload.memory;
  if (!mem || typeof mem !== 'object' || typeof QF.clauseCached !== 'function') return payload;
  const t0 = Date.now(), stat = { rows: 0, kept: 0, parsed: 0, unparsed: 0 };
  const m = Object.assign({}, mem);
  for (const k of CLAUSE_KEYS) if (Array.isArray(m[k])) m[k] = m[k].map(r => clauseRow(r, QF, F, stat));
  if (Array.isArray(m.pools)) m.pools = m.pools.map(p => p && Array.isArray(p.rows) ? Object.assign({}, p, { rows: p.rows.map(r => clauseRow(r, QF, F, stat)) }) : p);
  stat.ms = Date.now() - t0;
  try { if (root) root.FORGE_LAST_CLAUSES = stat; } catch (e) {}
  return Object.assign({}, payload, { memory: m });
}
function run(payload, opts) {
  payload = withFrame(payload);
  if (!RMC) return Promise.resolve({ ok: false, foundations: true, product_reply: false, calls_llm: false, error: 'rmc_client_missing' });
  if (typeof require === 'function' && typeof fetch === 'undefined') return Promise.resolve(RMC.askSync(payload));
  return RMC.ask(payload, opts);
}
function runSync(payload) { return RMC && RMC.askSync ? RMC.askSync(payload) : { ok: false, foundations: true, product_reply: false, calls_llm: false, error: 'no_sync' }; }
const api = { run, runSync, withFrame, withClauses };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KRMCCore = api;
})(typeof self !== 'undefined' ? self : this);
