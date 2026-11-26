/* Learning loop. Proposals are not facts. Gilligan validates. Admission is a separate step.
 * Nothing here writes a gate, calls a model, or deletes a row. */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const SCHEMA = 'forge.learning/v1';
  const MIN_SUPPORT = 3;
  const CLOSED = { the: 1, a: 1, an: 1, is: 1, are: 1, was: 1, were: 1, do: 1, does: 1, did: 1, you: 1, i: 1, we: 1, to: 1, of: 1, in: 1, on: 1, at: 1, before: 1, after: 1, and: 1, or: 1, not: 1, no: 1, have: 1, has: 1, had: 1 };
  let MEM = null;
  function blank() { return { schema: SCHEMA, frames: [], calibration: [], hosted: [], calls_llm: false, changes_gates: false }; }
  function load() { return MEM && MEM.schema === SCHEMA ? MEM : (MEM = blank()); }
  function save(doc) { MEM = Object.assign(blank(), doc, { schema: SCHEMA, calls_llm: false, changes_gates: false }); return MEM; }
  function clear() { MEM = blank(); return { ok: true }; }
  function norm(t) { return String(t || '').toLowerCase().replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, ''); }
  function head(np) {
    if (!np) return '';
    if (Array.isArray(np.head) && np.head.length) return norm(np.head[np.head.length - 1]);
    if (typeof np.head === 'string') return norm(np.head);
    return norm(np.text);
  }
  function words(text) { return norm(text).split(' ').filter(Boolean); }
  function content(text) { return words(text).filter(w => !CLOSED[w]); }

  function induce(facts) {
    const kinds = {}, props = {}, neg = {};
    for (const fact of facts || []) {
      const frame = fact && (fact.frame || fact.clause);
      if (!frame || !frame.kartr) continue;
      const subj = head(frame.kartr);
      if (!subj) continue;
      if (frame.kriya === 'be' && frame.polarity !== 'neg') {
        const kind = head(frame.pred);
        if (kind && kind !== subj) (kinds[kind] = kinds[kind] || {})[subj] = fact;
      } else if (frame.kriya === 'have') {
        const prop = head(frame.karma);
        if (!prop) continue;
        const denied = frame.polarity === 'neg' || (frame.karma && frame.karma.quant === 'no');
        if (denied) (neg[subj] = neg[subj] || []).push(prop);
        else (props[subj] = props[subj] || {})[prop] = fact;
      }
    }
    const out = [];
    Object.keys(kinds).sort().forEach(kind => {
      const members = kinds[kind];
      if (Object.keys(members).length < MIN_SUPPORT) return;
      const counted = {}, counters = {};
      Object.keys(members).forEach(subj => {
        Object.keys(props[subj] || {}).forEach(prop => { (counted[prop] = counted[prop] || []).push({ subject: subj, kind: members[subj], have: props[subj][prop] }); });
        (neg[subj] || []).forEach(prop => { (counters[prop] = counters[prop] || []).push(subj); });
      });
      Object.keys(counted).sort().forEach(prop => {
        const rows = counted[prop], against = counters[prop] || [];
        if (rows.length < MIN_SUPPORT) return;
        out.push({
          id: 'kind-property:' + kind + ':' + prop, kind: kind, property: prop, support: rows.length, counterexamples: against.length,
          confidence: rows.length / (rows.length + against.length),
          instances: rows.map(row => ({ subject: row.subject, kind_text: row.kind.text, have_text: row.have.text })),
          status: 'proposal', spoken_as_fact: false, calls_llm: false
        });
      });
    });
    return out;
  }
  function gilligan(proposal, facts, ledger) {
    const fresh = induce(facts).find(row => row.id === proposal.id);
    if (!fresh) return Object.assign({}, proposal, { status: 'refuted', reason: 'support_lost', validator: 'gilligan' });
    if (fresh.counterexamples) return Object.assign({}, fresh, { status: 'refuted', reason: 'counterexample_in_memory', validator: 'gilligan' });
    const hit = (ledger || []).find(entry => entry && norm(entry.text).indexOf(fresh.kind) >= 0 && norm(entry.text).indexOf(fresh.property) >= 0 && /\b(no|not|never)\b/.test(norm(entry.text)));
    if (hit) return Object.assign({}, fresh, { status: 'refuted', reason: 'refuted_ledger', validator: 'gilligan', ledger: hit.text });
    return Object.assign({}, fresh, { status: 'validated', reason: 'no_counterexample', validator: 'gilligan', admitted: false });
  }

  function rolesOf(frame) {
    const roles = [];
    if (frame && frame.kartr) roles.push({ role: 'kartr', head: head(frame.kartr) });
    if (frame && frame.karma) roles.push({ role: 'karma', head: head(frame.karma) });
    if (frame && frame.pred) roles.push({ role: 'pred', head: head(frame.pred) });
    return roles.filter(r => r.head);
  }
  function noteCorrection(failed, successText, successFrame) {
    const doc = load();
    const roles = rolesOf(successFrame);
    if (!roles.length || !successFrame || !successFrame.kriya) return { ok: false, rule: 'LEARN-FRAME-EMPTY' };
    const id = 'frame:' + norm(failed).slice(0, 80);
    const row = { id: id, status: 'proposal', failed: String(failed || ''), success: String(successText || ''), kriya: successFrame.kriya, roles: roles, provenance: { at: new Date().toISOString(), source: 'user_correction' }, replay: null, calls_llm: false };
    doc.frames = [row].concat((doc.frames || []).filter(r => r.id !== id));
    save(doc);
    return { ok: true, rule: 'LEARN-FRAME-PROPOSED', proposal: row, spoken_as_fact: false };
  }
  function align(text, roles) {
    const got = content(text);
    if (got.length !== roles.length) return null;
    const assigned = {};
    roles.forEach((role, i) => { assigned[role.role] = got[i]; });
    return assigned;
  }
  function validateReplay(id, heldOut, expected) {
    const doc = load();
    const row = (doc.frames || []).find(r => r.id === id && r.status !== 'retracted');
    if (!row) return { ok: false, rule: 'LEARN-FRAME-MISSING' };
    const assigned = align(heldOut, row.roles);
    const want = rolesOf(expected);
    const same = assigned && want.length === row.roles.length && want.every(role => assigned[role.role] === role.head) && expected.kriya === row.kriya;
    row.replay = { held_out: String(heldOut || ''), ok: !!same, at: new Date().toISOString() };
    row.status = same ? 'validated' : 'refuted';
    save(doc);
    return { ok: !!same, rule: same ? 'LEARN-FRAME-VALIDATED' : 'LEARN-FRAME-REPLAY-FAILED', proposal: row };
  }
  function admitFrame(id) {
    const doc = load();
    const row = (doc.frames || []).find(r => r.id === id);
    if (!row || row.status !== 'validated') return { ok: false, rule: 'LEARN-FRAME-NOT-VALIDATED' };
    row.status = 'admitted';
    save(doc);
    return { ok: true, rule: 'LEARN-FRAME-ADMITTED', proposal: row };
  }
  function retractFrame(id) {
    const doc = load();
    const row = (doc.frames || []).find(r => r.id === id);
    if (!row) return { ok: false, rule: 'LEARN-FRAME-MISSING' };
    row.status = 'retracted';
    save(doc);
    return { ok: true, rule: 'LEARN-FRAME-RETRACTED', proposal: row };
  }
  function applyFrame(text) {
    const row = (load().frames || []).find(r => r.status === 'admitted' && align(text, r.roles));
    if (!row) return null;
    const assigned = align(text, row.roles);
    const np = h => ({ text: h, head: h });
    return {
      schema: 'forge.qframe/v1', text: String(text || ''), parsed: true, kriya: row.kriya, polarity: 'pos',
      kartr: assigned.kartr ? np(assigned.kartr) : null,
      karma: assigned.karma ? np(assigned.karma) : null,
      pred: assigned.pred ? { type: 'np', text: assigned.pred, head: assigned.pred } : null,
      rule: 'QF-LEARNED', learning_id: row.id, calls_llm: false
    };
  }

  function noteAdmitted(row) {
    const doc = load();
    if (!row || !row.reply) return { ok: false };
    doc.pending = { question: row.question || '', reply: row.reply, coherence: row.coherence, echo: row.echo, drift: row.drift, at: new Date().toISOString() };
    save(doc);
    return { ok: true, pending: doc.pending };
  }
  function label(kind, text) {
    const doc = load();
    const pending = doc.pending;
    if (!pending || norm(pending.reply) !== norm(text)) return { ok: false, rule: 'LEARN-CALIBRATION-UNMATCHED' };
    const entry = Object.assign({}, pending, { label: kind, labelled_at: new Date().toISOString() });
    doc.calibration = [entry].concat(doc.calibration || []).slice(0, 200);
    doc.pending = null;
    save(doc);
    return { ok: true, rule: 'LEARN-CALIBRATION-RECORDED', entry: entry };
  }
  function calibrationReport() {
    const rows = load().calibration || [];
    const confirmed = rows.filter(r => r.label === 'confirmed').length;
    const refuted = rows.filter(r => r.label === 'refuted').length;
    const n = confirmed + refuted;
    return { n: n, confirmed: confirmed, refuted: refuted, reliability: n ? confirmed / n : null, changes_gates: false, calls_llm: false };
  }
  function proposeStricter() {
    const report = calibrationReport();
    const current = 0.87;
    const suggested = report.refuted ? Math.min(0.99, Math.round((current + 0.01) * 1000) / 1000) : current;
    return { proposal: 'stricter-only', field: 'C_min', current: current, suggested: suggested, needs_nic: true, applied: false, changes_gates: false, calls_llm: false, report: report };
  }

  function supersedeHosted(id, validTo, sources) {
    const doc = load();
    const rows = (sources || []).filter(s => s && s.text);
    if (rows.length < 2) return { ok: false, rule: 'LEARN-SUPERSEDE-NEEDS-TWO', changes_gates: false };
    const texts = rows.map(s => norm(s.text));
    if (texts.some(t => t !== texts[0])) return { ok: false, rule: 'LEARN-SUPERSEDE-DISAGREE' };
    const entry = { id: String(id || ''), valid_to: validTo || new Date().toISOString(), sources: rows.map(s => ({ source: s.source || s.id || '', text: s.text })), at: new Date().toISOString(), deleted: false };
    doc.hosted = [entry].concat((doc.hosted || []).filter(e => e.id !== entry.id));
    save(doc);
    return { ok: true, rule: 'LEARN-SUPERSEDED', entry: entry, deleted: false };
  }
  function ageHosted(rows, now) {
    const overlay = {};
    (load().hosted || []).forEach(e => { overlay[e.id] = e; });
    const at = now || new Date().toISOString();
    return (rows || []).map(row => {
      const copy = Object.assign({}, row);
      const mark = overlay[row.id];
      if (mark) { copy.valid_to = mark.valid_to; copy.status = 'superseded'; copy.deleted = false; }
      if (copy.valid_to && copy.valid_to < at) copy.status = copy.status || 'expired';
      return copy;
    });
  }

  function admittedIds() { return []; }
  function closeLoop(receipts) {
    const Mirror = isNode ? require('./mirror.js') : root.KMirror;
    const suggestion = Mirror && Mirror.suggest ? Mirror.suggest(receipts || []) : { hypotheses: [], changes_gates: false };
    return {
      stage: 'idle',
      mirror: suggestion,
      induction: 'Gilligan validates proposals from Derive before admission. Admitted rules re-enter Derive as WM-INDUCED.',
      calibration: calibrationReport(),
      stricter: proposeStricter(),
      writes_code: false,
      changes_gates: false,
      calls_llm: false
    };
  }
  const api = {
    SCHEMA, MIN_SUPPORT, clear, induce, gilligan, noteCorrection, validateReplay, admitFrame, retractFrame, applyFrame,
    noteAdmitted, label, calibrationReport, proposeStricter, supersedeHosted, ageHosted, admittedIds, closeLoop, load
  };
  if (isNode) module.exports = api; else root.KLearning = api;
})(typeof self !== 'undefined' ? self : this);
