/* Learning loop. Gilligan validates a proposal and that pass admits it into this store.
 * Derive and Parse only read the store. A later counterexample sets valid_to and archives the row.
 * Nothing here writes a gate, calls a model, or deletes a row. */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const SCHEMA = 'forge.learning/v1';
  const KEY = 'forge.learning.v1';
  const MIN_SUPPORT = 3;
  const CLOSED = { the: 1, a: 1, an: 1, is: 1, are: 1, was: 1, were: 1, do: 1, does: 1, did: 1, you: 1, i: 1, we: 1, to: 1, of: 1, in: 1, on: 1, at: 1, before: 1, after: 1, and: 1, or: 1, not: 1, no: 1, have: 1, has: 1, had: 1 };
  let MEM = null;
  let DISK = null;
  function blank() { return { schema: SCHEMA, frames: [], rules: [], ledger: [], calibration: [], hosted: [], calls_llm: false, changes_gates: false }; }
  function backend() {
    if (!isNode) {
      try {
        localStorage.setItem(KEY + '.probe', '1');
        localStorage.removeItem(KEY + '.probe');
        return { get: k => localStorage.getItem(k), set: (k, v) => localStorage.setItem(k, v), del: k => localStorage.removeItem(k) };
      } catch (e) { return null; }
    }
    if (!DISK) DISK = {};
    return { get: k => (Object.prototype.hasOwnProperty.call(DISK, k) ? DISK[k] : null), set: (k, v) => { DISK[k] = String(v); }, del: k => { delete DISK[k]; } };
  }
  function load() {
    if (MEM && MEM.schema === SCHEMA) return MEM;
    const b = backend();
    if (b) {
      try {
        const v = JSON.parse(b.get(KEY) || 'null');
        if (v && v.schema === SCHEMA) return (MEM = v);
      } catch (e) { /* a torn record starts empty; the next save replaces it */ }
    }
    return (MEM = blank());
  }
  function save(doc) {
    MEM = Object.assign(blank(), doc, { schema: SCHEMA, calls_llm: false, changes_gates: false });
    const b = backend();
    if (b) { try { b.set(KEY, JSON.stringify(MEM)); } catch (e) { /* the in-memory copy still holds this turn */ } }
    return MEM;
  }
  function clear() {
    MEM = blank();
    const b = backend();
    if (b) { try { b.del(KEY); } catch (e) { /* an empty memory is the cleared store */ } }
    return { ok: true };
  }
  function reload() { MEM = null; return load(); }
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
  function retire(row, reason, doc) {
    row.status = 'archived';
    row.valid_to = new Date().toISOString();
    row.deleted = false;
    row.reason = reason || 'counterexample';
    const text = row.kind ? ('a ' + row.kind + ' has no ' + row.property) : (row.failed || row.id);
    doc.ledger = [{ id: row.id, text: text, status: 'refuted', at: row.valid_to, rule: row.id, reason: row.reason }].concat(doc.ledger || []).slice(0, 200);
  }
  function settle(facts, ledger) {
    const doc = load();
    const led = (ledger || []).concat(doc.ledger || []);
    const proposals = induce(facts || []).map(row => gilligan(row, facts || [], led));
    const byId = {};
    (doc.rules || []).forEach(row => { if (row && row.id) byId[row.id] = row; });
    const now = new Date().toISOString();
    proposals.forEach(row => {
      const prev = byId[row.id];
      if (row.status === 'validated') {
        byId[row.id] = Object.assign({}, prev || {}, row, {
          status: 'admitted', admitted: true, class: 'learned', hosted: false, deleted: false,
          admitted_at: (prev && prev.admitted_at) || now, valid_from: (prev && prev.valid_from) || now, valid_to: null,
          validator: 'gilligan', reason: 'no_counterexample'
        });
      } else if (row.status === 'refuted' && prev && prev.status === 'admitted') {
        retire(prev, row.reason, doc);
      }
    });
    doc.rules = Object.keys(byId).map(id => byId[id]);
    save(doc);
    return { proposals: proposals, admitted: doc.rules.filter(r => r.status === 'admitted' && !r.valid_to), archived: doc.rules.filter(r => r.status === 'archived'), calls_llm: false, changes_gates: false, spoken_as_fact: false };
  }
  function admittedIds() { return (load().rules || []).filter(r => r.status === 'admitted' && !r.valid_to).map(r => r.id); }
  function ledger() { return (load().ledger || []).slice(); }
  function list() { return { rules: (load().rules || []).slice(), frames: (load().frames || []).filter(r => r.status === 'admitted' || r.status === 'archived') }; }

  function rolesOf(frame) {
    const roles = [];
    if (frame && frame.kartr) roles.push({ role: 'kartr', head: head(frame.kartr) });
    if (frame && frame.karma) roles.push({ role: 'karma', head: head(frame.karma) });
    if (frame && frame.pred) roles.push({ role: 'pred', head: head(frame.pred) });
    return roles.filter(r => r.head);
  }
  function noteTurn(text, frame) {
    const doc = load();
    if (frame && frame.parsed && frame.rule !== 'QF-LEARNED' && doc.hold) {
      const noted = noteCorrection(doc.hold, text, frame);
      doc.hold = null;
      save(doc);
      return noted;
    }
    if (!frame || !frame.parsed) {
      doc.hold = String(text || '');
      save(doc);
      return { ok: true, rule: 'LEARN-FRAME-HELD', spoken_as_fact: false };
    }
    doc.hold = null;
    save(doc);
    return { ok: true, rule: 'LEARN-FRAME-IDLE' };
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
    if (same) {
      row.status = 'admitted';
      row.admitted = true;
      row.class = 'learned';
      row.admitted_at = row.admitted_at || new Date().toISOString();
      row.valid_from = row.valid_from || row.admitted_at;
      row.valid_to = null;
      row.deleted = false;
    } else if (row.status === 'admitted') {
      retire(row, 'replay_failed', doc);
    } else row.status = 'refuted';
    save(doc);
    return { ok: !!same, rule: same ? 'LEARN-FRAME-ADMITTED' : 'LEARN-FRAME-REPLAY-FAILED', proposal: row };
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
    retire(row, 'retract', doc);
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

  function closeLoop(receipts) {
    const Mirror = isNode ? require('./mirror.js') : root.KMirror;
    const suggestion = Mirror && Mirror.suggest ? Mirror.suggest(receipts || []) : { hypotheses: [], changes_gates: false };
    return {
      stage: 'idle',
      mirror: suggestion,
      induction: 'Gilligan validates a proposal and the same pass admits it. Derive reads that store as WM-INDUCED. A later counterexample archives the rule.',
      calibration: calibrationReport(),
      stricter: proposeStricter(),
      writes_code: false,
      changes_gates: false,
      calls_llm: false
    };
  }
  const api = {
    SCHEMA, MIN_SUPPORT, clear, reload, induce, gilligan, settle, admittedIds, ledger, list, noteCorrection, noteTurn, validateReplay, admitFrame, retractFrame, applyFrame,
    noteAdmitted, label, calibrationReport, proposeStricter, supersedeHosted, ageHosted, admittedIds, closeLoop, load
  };
  if (isNode) module.exports = api; else root.KLearning = api;
})(typeof self !== 'undefined' ? self : this);
