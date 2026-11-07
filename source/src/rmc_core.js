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
 * has one (a remembered statement keeps the clause it was parsed into) is left as it is. A stored record
 * that did not parse is not a clause: Ask reads it again with the grammar that is loaded now (the extended
 * lexicon attaches after the core, and a remember in that window used to freeze parsed:false). The others
 * are parsed once per text (KQFrame.clauseCached) and the rows are copied, never changed in place. A sentence
 * that still does not parse is sent without a clause. */
const CLAUSE_KEYS = ['receipts', 'phone', 'hosted', 'anchors', 'self'];
/* 4.9.241 (Nic plan 229 step 10): SELF-FACTS FROM CLAUSES. The kernel's facts about itself are the kāraka clauses of
 * src/selfmodel.js FACTS (true facts: a computer program that derives sentences by fixed rules, has no body, …). Each is
 * realized by grammar.js as the asker would say it to the kernel (second person), re-read by the same
 * clause parser as any memory, and sent as memory.self (source self_model in the engine). A fact whose re-read clause is not
 * about the kernel (kartṛ you, or a possessive of you) is not sent. There is no reply string: the engine answers a self
 * question from these rows through frame, Derive, outward compile and Echo, or holds. */
let SELF_ROWS = null;
function selfRows(QF, F) {
  if (SELF_ROWS) return SELF_ROWS;
  const node = typeof module !== 'undefined' && module.exports;
  const SM = node ? require('./selfmodel.js') : root.KSelf, G = node ? require('./grammar.js') : root.KGrammar;
  if (!SM || !SM.FACTS || !G || typeof G.clauseText !== 'function') return [];
  const out = [];
  for (const [k, c] of Object.entries(SM.FACTS)) {
    let t = null; try { t = G.clauseText(c, 'user'); } catch (e) { t = null; }
    if (!t) continue;
    const text = t.charAt(0).toUpperCase() + t.slice(1) + '.';
    const cl = QF.clauseCached(text, F);
    const about = cl && cl.parsed && cl.kartr && (cl.kartr.kernel || cl.kartr.owner === 'kernel');
    if (!about) continue;
    out.push({ id: 'self:' + k, memory_id: 'self:' + k, text, tier: 'self', trust: 'trusted', clause: cl,
      provenance: { source: 'src/selfmodel.js FACTS.' + k, kind: 'self_fact', perspective: 'asker_to_kernel' } });
  }
  SELF_ROWS = out; return out;
}
/* 4.9.241 (Nic: natural conversation) SELF-STATE FROM MEASURED LIVE STATE. The kernel's state is not a stored sentence:
 * after each Ask the engine's own reading of that turn is kept (C, ε, the engine's thresholds and verdicts: admit.coherence_ok,
 * admit.drift_region). The next turn gets one self-state clause built from it, a copula with adjective predicates: "awake"
 * (the engine has run a turn this session) and, only when that reading had C ≥ C_min and a clean drift region, "coherent".
 * It is realized and re-read like the self-facts and carries the measured numbers in its provenance. Before the first turn
 * there is no reading and no state row, so the state question holds. */
let LAST_STATE = null;
function noteState(o) {
  if (!o || typeof o !== 'object' || o.coherence == null) return;
  const a = o.admit || {}, th = a.thresholds || {};
  LAST_STATE = { C: o.coherence, epsilon_s: o.drift, C_min: th.C_min, theta_admit: a.theta_admit, coherence_ok: a.coherence_ok === true,
    drift_region: a.drift_region || null, route: o.route || null, spoke: !!o.product_reply };
}
function stateRows(QF, F) {
  if (!LAST_STATE) return [];
  const node = typeof module !== 'undefined' && module.exports;
  const SM = node ? require('./selfmodel.js') : root.KSelf, G = node ? require('./grammar.js') : root.KGrammar;
  if (!SM || !SM.FACTS || !SM.FACTS.identity || !G || typeof G.clauseText !== 'function') return [];
  const coherent = LAST_STATE.coherence_ok && LAST_STATE.drift_region === 'clean';
  const c = { subj: SM.FACTS.identity.subj, verb: { lemma: 'be', tense: 'present', pol: 'pos', mod: 'asserted' }, pred: { type: 'adj', words: coherent ? ['awake', 'and', 'coherent'] : ['awake'] } };
  let t = null; try { t = G.clauseText(c, 'user'); } catch (e) { t = null; }
  if (!t) return [];
  const text = t.charAt(0).toUpperCase() + t.slice(1) + '.';
  const cl = QF.clauseCached(text, F);
  if (!(cl && cl.parsed && cl.kartr && cl.kartr.kernel)) return [];
  return [{ id: 'state:live', memory_id: 'state:live', text, tier: 'self', trust: 'trusted', clause: cl,
    provenance: { source: 'measured live state (the previous Ask turn)', kind: 'self_state', perspective: 'asker_to_kernel', measured: Object.assign({}, LAST_STATE), coherent } }];
}
function clauseParsed(c) {
  if (!c || typeof c !== 'object') return false;
  if (c.parsed) return true;
  if ((c.clauses || []).some(clauseParsed)) return true; /* 4.9.238: a concessive or causal sentence */
  if ((c.sentences || []).some(clauseParsed)) return true;
  return false;
}
function clauseRow(row, QF, F, stat) {
  if (!row || typeof row !== 'object' || !row.text) return row;
  stat.rows++;
  if (row.clause && row.clause.schema === QF.CLAUSE && clauseParsed(row.clause)) { stat.kept++; return row; }
  const c = QF.clauseCached(row.text, F); stat.parsed++;
  if (!c || !clauseParsed(c)) {
    stat.unparsed++;
    /* a frozen parsed:false record is not sent on; Observe would keep it and skip a real reading */
    if (row.clause && row.clause.schema === QF.CLAUSE) { const copy = Object.assign({}, row); delete copy.clause; return copy; }
    return row;
  }
  // the row's meaning id rides on its clause; phase, band and Hz are placed by the engine's resonance placement each turn
  return Object.assign({}, row, { clause: row.meaning_id ? Object.assign({}, c, { meaning_id: row.meaning_id }) : c });
}
function withClauses(payload, QF, F) {
  const mem = payload && payload.memory;
  if (!mem || typeof mem !== 'object' || typeof QF.clauseCached !== 'function') return payload;
  const t0 = Date.now(), stat = { rows: 0, kept: 0, parsed: 0, unparsed: 0 };
  const m = Object.assign({}, mem);
  if (!Array.isArray(m.self)) { try { m.self = selfRows(QF, F).concat(stateRows(QF, F)); } catch (e) { m.self = []; } }
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
function outwardCompile(row, payload, F, R2, QFin) {
  if (!row || typeof row !== 'object' || !row.product_reply || !row.reply) return row;
  const plan = row.outward;
  const rec = { schema: 'forge.outward_compile/v1', applied: false, mode: null, sentences: [], quotes: plan && plan.quotes || [], calls_llm: false };
  if (!plan || !Array.isArray(plan.sentences) || !plan.sentences.length) { rec.mode = 'quoted'; rec.reason = 'no_atoms'; return Object.assign({}, row, { outward_compile: rec }); }
  if (!F || typeof F.outward !== 'function') { rec.mode = 'quoted'; rec.reason = 'compiler_missing'; return Object.assign({}, row, { outward_compile: rec }); }
  const out = [];
  for (const s of plan.sentences) {
    if (!s || !s.atom) { out.push(String(s && s.text || '')); rec.sentences.push({ text: s && s.text, mode: 'quoted', source_id: s && s.source_id || null }); continue; }
    /* 4.9.241: a speech-act response is compiled from its act atom by the speech-act lexicon (realize, re-read, same act) */
    if (s.atom.predicate === 'speech_act') {
      const SA = (typeof module !== 'undefined' && module.exports) ? require('./speech_acts.js') : root.KSpeechActs;
      let r = null; try { r = SA ? SA.compile(s.text, s.atom) : { ok: false, step: 'compiler_missing' }; } catch (e) { r = { ok: false, step: 'throw' }; }
      rec.sentences.push({ text: s.text, mode: r.ok ? 'compiled' : 'failed', step: r.step, R_t: r.R_t || null, role: s.role, source_id: s.source_id || null, roundtrip: !!r.roundtrip, via: 'speech_acts' });
      if (!r.ok) return holdOutward(row, rec, 'OUTWARD-COMPILE-FAIL');
      out.push(r.R_t); continue;
    }
    let r = null; try { r = F.outward(s.text, s.atom); } catch (e) { r = { ok: false, step: 'throw' }; }
    /* a stored sentence the phone grammar cannot read at all (brackets, numbers, lists) is spoken verbatim as the cited
     * quote it is; a sentence that reads as another atom, or a rule-made sentence that does not read, holds */
    if (!r.ok && r.step === 'parse' && s.verbatim && s.source_id) {
      out.push(String(s.text)); rec.sentences.push({ text: s.text, mode: 'quoted', step: 'parse', role: s.role, source_id: s.source_id }); continue;
    }
    /* 4.9.241: a sentence whose surface reads as another shape than the atom ("Whales are mammals." — a bare-plural kind) is
     * compiled from the reading the clause reader's own canonical rule gives that whole sentence (QF-CANON-*: the indefinite-singular kind reading); that
     * reading must state the engine's atom and round-trip, and the surface must round-trip too, or the answer holds */
    if (!r.ok && r.step === 'atom') {
      const QF = QFin || (root && root.KQFrame); let cl = null; try { cl = QF && QF.clauseCached ? QF.clauseCached(s.text, F) : null; } catch (e) { cl = null; }
      const whole = normS(String(s.text).replace(/[.!?]+$/, ''));
      const canon = (cl && Array.isArray(cl.canonical) ? cl.canonical : []).find(x => x && x.reading && normS(x.surface) === whole);
      if (canon) { let r2 = null; try { r2 = F.outward(canon.reading, s.atom); } catch (e) { r2 = null; }
        /* the surface itself must also round-trip through the grammar; its own realization is spoken (the reading is the proof) */
        let r0 = null; try { r0 = F.outward(s.text, null); } catch (e) { r0 = null; }
        if (r2 && r2.ok && r0 && r0.ok) { r = Object.assign({}, r0, { via: 'canonical', canon_rule: canon.rule, canon_R_t: r2.R_t }); } }
    }
    rec.sentences.push({ text: s.text, mode: r.ok ? 'compiled' : 'failed', step: r.step, R_t: r.R_t || null, role: s.role, source_id: s.source_id || null, roundtrip: !!r.roundtrip, via: r.via || null, canon_rule: r.canon_rule || null });
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
  return row => { try { noteState(row); } catch (e) {} try { return outwardCompile(row, payload, F, R2); } catch (e) { return row && row.product_reply ? holdOutward(row, { schema: 'forge.outward_compile/v1', error: String(e && e.message || e), calls_llm: false }, 'OUTWARD-COMPILE-ERROR') : row; } };
}
function run(payload, opts) {
  payload = withFrame(payload);
  if (!RMC) return Promise.resolve({ ok: false, foundations: true, product_reply: false, calls_llm: false, error: 'rmc_client_missing' });
  if (typeof require === 'function' && typeof fetch === 'undefined') return Promise.resolve(RMC.askSync(payload));
  return RMC.ask(payload, opts).then(compileOut(payload));
}
function runSync(payload) { payload = withFrame(payload); return RMC && RMC.askSync ? RMC.askSync(payload) : { ok: false, foundations: true, product_reply: false, calls_llm: false, error: 'no_sync' }; }
const api = { run, runSync, withFrame, withClauses, outwardCompile, selfRows, stateRows, noteState };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KRMCCore = api;
})(typeof self !== 'undefined' ? self : this);
