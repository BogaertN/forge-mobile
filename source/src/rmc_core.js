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
  const anyParsed = x => !!x && (x.parsed || (x.clauses || []).some(y => y && y.parsed)); /* 4.9.238: a split sentence counts by its clauses */
  if (!c || !(anyParsed(c) || (c.sentences || []).some(anyParsed))) { stat.unparsed++; return row; }
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
/* 4.9.237 OUTWARD COMPILE (Nic plan 229 step 8). The engine measured a reply and sent its sentences with the atom each states
 * (row.outward, forge.outward/v1). Each sentence with an atom is compiled by the Pāṇini wording module (forge.outward: kernel
 * clause → grammar.js realization R_t → re-read, same clause); the reply shown is the joined R_t. A sentence the engine sent
 * without an atom (no clause) is spoken as the cited quote it is (mode 'quoted'). A compile failure holds the answer
 * (OUTWARD-COMPILE-FAIL); a realized surface that differs from the measured text is Echo-measured again with the renderer's
 * own echoOf and holds below Echo_min. The source premises ride along as cited quotes. Nothing is invented; no model. */
const normS = t => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
function holdOutward(row, rec, rule) {
  rec.applied = false; rec.rule = rule;
  return Object.assign({}, row, { product_reply: false, held: true, reply: null, held_reply: row.reply, route: 'outward_compile_hold',
    admit: Object.assign({}, row.admit || {}, { disposition: 'held', rule: rule }), outward_compile: rec });
}
function outwardCompile(row, payload, F, R2) {
  if (!row || typeof row !== 'object' || !row.product_reply || !row.reply) return row;
  const plan = row.outward;
  const rec = { schema: 'forge.outward_compile/v1', applied: false, mode: null, sentences: [], quotes: plan && plan.quotes || [], calls_llm: false };
  if (!plan || !Array.isArray(plan.sentences) || !plan.sentences.length) { rec.mode = 'quoted'; rec.reason = 'no_atoms'; return Object.assign({}, row, { outward_compile: rec }); }
  if (!F || typeof F.outward !== 'function') { rec.mode = 'quoted'; rec.reason = 'compiler_missing'; return Object.assign({}, row, { outward_compile: rec }); }
  const out = [];
  for (const s of plan.sentences) {
    if (!s || !s.atom) { out.push(String(s && s.text || '')); rec.sentences.push({ text: s && s.text, mode: 'quoted', source_id: s && s.source_id || null }); continue; }
    let r = null; try { r = F.outward(s.text, s.atom); } catch (e) { r = { ok: false, step: 'throw' }; }
    /* a stored sentence the phone grammar cannot read at all (brackets, numbers, lists) is spoken verbatim as the cited
     * quote it is; a sentence that reads as another atom, or a rule-made sentence that does not read, holds */
    if (!r.ok && r.step === 'parse' && s.verbatim && s.source_id) {
      out.push(String(s.text)); rec.sentences.push({ text: s.text, mode: 'quoted', step: 'parse', role: s.role, source_id: s.source_id }); continue;
    }
    rec.sentences.push({ text: s.text, mode: r.ok ? 'compiled' : 'failed', step: r.step, R_t: r.R_t || null, role: s.role, source_id: s.source_id || null, roundtrip: !!r.roundtrip });
    if (!r.ok) return holdOutward(row, rec, 'OUTWARD-COMPILE-FAIL');
    out.push(r.R_t);
  }
  const R_t = out.join(' ').trim();
  rec.mode = rec.sentences.every(x => x.mode === 'compiled') ? 'compiled' : rec.sentences.every(x => x.mode === 'quoted') ? 'quoted' : 'mixed';
  rec.R_t = R_t; rec.measured_text = plan.measured_text || row.reply;
  rec.surface_changed = normS(R_t) !== normS(rec.measured_text);
  if (rec.surface_changed) {
    let e = null; try { e = R2 && R2.echoOf ? R2.echoOf(payload && payload.question, R_t) : null; } catch (x) { e = null; }
    rec.echo = e ? { score: e.score, pass: !!e.pass } : null;
    if (!e || !e.pass) return holdOutward(row, rec, 'OUTWARD-ECHO-FAIL');
  }
  rec.applied = true;
  return Object.assign({}, row, { reply: R_t, outward_compile: rec });
}
function compileOut(payload) {
  const F = root && root.forge, R2 = root && root.RmcRenderer200;
  return row => { try { return outwardCompile(row, payload, F, R2); } catch (e) { return row && row.product_reply ? holdOutward(row, { schema: 'forge.outward_compile/v1', error: String(e && e.message || e), calls_llm: false }, 'OUTWARD-COMPILE-ERROR') : row; } };
}
function run(payload, opts) {
  payload = withFrame(payload);
  if (!RMC) return Promise.resolve({ ok: false, foundations: true, product_reply: false, calls_llm: false, error: 'rmc_client_missing' });
  if (typeof require === 'function' && typeof fetch === 'undefined') return Promise.resolve(RMC.askSync(payload));
  return RMC.ask(payload, opts).then(compileOut(payload));
}
function runSync(payload) { return RMC && RMC.askSync ? RMC.askSync(payload) : { ok: false, foundations: true, product_reply: false, calls_llm: false, error: 'no_sync' }; }
const api = { run, runSync, withFrame, withClauses, outwardCompile };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KRMCCore = api;
})(typeof self !== 'undefined' ? self : this);
