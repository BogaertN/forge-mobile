/* 4.9.111: one audited turn packet, success or failure, and a receipt a person can open.
 * 4.9.112: the same packet names the Doc 6 gate, when one already fired, and lists every
 * route that was not selected with the reason the turn already recorded.
 * 4.9.113: the same receipt names the Doc 7 category the belief rests on.
 * Echo stays an exact reparse. This module names the receipt. It does not choose the route. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const SCHEMA = 'FORGE-TURN-PACKET/v1';
  const FAILURE_SCHEMA = 'FORGE-FAILURE-RECEIPT/v1';
  const ANSWER_SCHEMA = 'FORGE-ANSWER-RECEIPT/v1';
  const PACKET_VERSION = '4.9.111';
  const FAILURE_TYPES = ['echo_fail', 'language_unexpressible', 'gate_refusal', 'quarantine', 'chi_reroute'];
  const GATE_SUBTYPES = ['ambiguity', 'unsupported', 'action_blocked'];
  const LABELS = { echo_fail: 'Echo failed', language_unexpressible: 'Language unexpressible', gate_refusal: 'Gate refusal', quarantine: 'Quarantine', chi_reroute: 'χ re-route', answer: 'Answer' };
  const DOC6_LABEL = { ambiguity: 'ambiguity / clarification-required', 'clarification-required': 'clarification-required', unsupported: 'unsupported', action_blocked: 'meaning-understood-but-action-blocked' };
  /* 4.9.113: five categories, from records the turn already kept. Presence is not truth. A lookup is evidence. */
  const DOC7_IDS = ['language_corpus', 'evidence', 'memory', 'trace_receipt', 'authority'];
  const DOC7_LABEL = { language_corpus: 'Language corpus', evidence: 'Evidence', memory: 'Memory', trace_receipt: 'Trace/receipt', authority: 'Authority records' };
  const PRESENCE_LAW = 'presence ≠ truth';
  const NOT_STORE = ' This is not a knowledge store.';
  const DOC7_WHY = {
    memory: 'Why: it is in memory.',
    memory_evidence: 'Why: it is in memory. The utterance is evidence of what was said, a different category.',
    language_corpus: 'Why: a gloss in the language corpus. That is not evidence and not memory.',
    evidence: 'Why: the lookup is evidence. A source can be present without support.' + NOT_STORE,
    evidence_supported: 'Why: the lookup is evidence. A verbatim span supports the sentence.' + NOT_STORE,
    evidence_unsupported: 'Why: the lookup is evidence. The citation is present and unsupported.' + NOT_STORE,
    evidence_started: 'Why: a lookup is starting. Its results are evidence, not a knowledge store.',
    authority: 'Why: an authority record withheld the action.',
    trace_receipt: 'Why: the calculation is on this receipt, not evidence, not memory, and not the language corpus.',
    none: 'Why: this turn adds no belief. The receipt records what happened.'
  };
  function tierFor(id) {
    const s = String(id || '');
    if (/^lexicon:/.test(s)) return 'language_corpus';
    if (/^mem:/.test(s)) return 'memory';
    if (/^ev:/.test(s)) return 'user_statement';
    return /^(evd:|archive:|src:)/.test(s) ? 'evidence' : 'user_statement';
  }
  function doc7Of(trace, msm) {
    trace = trace || {}; msm = msm || trace.msm || {};
    const m = msm.meaning || {}, kind = m.kind || '', tool = m.tool || (trace.tool && trace.tool.tool) || '';
    const refs = (msm.evidence && msm.evidence.refs) || [], ops = trace.memory || [];
    const rules = new Set((trace.rules || []).map(r => r && r.id).filter(Boolean));
    const winner = (trace.selection && trace.selection.winner) || '';
    const results = !!(trace.research) || kind === 'research_answer' || (kind === 'tool_result' && tool === 'research.web');
    const started = !results && kind === 'tool_started' && tool === 'research.web';
    const lexicon = kind === 'define' || refs.some(id => /^lexicon:/.test(id));
    const memWrite = ops.some(op => op && op.op && !/^evidence\./.test(op.op));
    const memRead = (trace.rpm || []).length > 0 || refs.some(id => /^mem:/.test(id));
    const evTouch = results || ops.some(op => op && /^evidence\./.test(String(op.op || '')));
    const withheld = kind === 'blocked' || kind === 'tool_denied' || kind === 'neg_act' || rules.has('AUTH-UNDERSTOOD-NOT-AUTHORIZED') || rules.has('PERM-VAULT-LOCKED');
    let belief = 'none', why = DOC7_WHY.none;
    if (results) {
      belief = 'evidence';
      const bad = !!(m.unsupported || (m.provenance && m.provenance.lead_supported === false) || (m.support && m.support.level === 'none'));
      const good = !bad && (!!(m.provenance && m.provenance.lead_supported === true) || !!(m.support && /^(single|corroborated|answered)$/.test(m.support.level)));
      why = bad ? DOC7_WHY.evidence_unsupported : good ? DOC7_WHY.evidence_supported : DOC7_WHY.evidence;
    } else if (lexicon) { belief = 'language_corpus'; why = DOC7_WHY.language_corpus; }
    else if (memWrite || memRead) { belief = 'memory'; why = evTouch ? DOC7_WHY.memory_evidence : DOC7_WHY.memory; }
    else if (kind === 'math' || winner === 'math.gp014') { belief = 'trace_receipt'; why = DOC7_WHY.trace_receipt; }
    else if (withheld) { belief = 'authority'; why = DOC7_WHY.authority; }
    else if (started) { belief = 'evidence'; why = DOC7_WHY.evidence_started; }
    return { law: PRESENCE_LAW, belief, why, knowledge_store: false, research: results || started, present: { language_corpus: lexicon, evidence: evTouch || started || belief === 'evidence', memory: memWrite || memRead, trace_receipt: true, authority: !!(trace.permission) || withheld } };
  }
  function nOf(load, keys) { let n = 0; for (const k of keys) { const v = load(k); if (Array.isArray(v)) n += v.length; } return n; }
  function census(load) {
    load = typeof load === 'function' ? load : () => [];
    return { law: PRESENCE_LAW, knowledge_store: false, shared_knowledge: nOf(load, ['shared_knowledge']), counts: { language_corpus: nOf(load, ['language_examples', 'lexicon_user']), evidence: nOf(load, ['evidence', 'web_evidence']), memory: nOf(load, ['memory', 'cold_storage']), trace_receipt: nOf(load, ['trace', 'receipts', 'containment_receipts']), authority: nOf(load, ['permissions', 'admitted_rules']) } };
  }
  function categoryPanel(load) {
    const c = census(load);
    const rows = DOC7_IDS.map(id => '<div data-doc7-cat="' + id + '"><b>' + esc(DOC7_LABEL[id]) + '</b> ' + c.counts[id] + '</div>').join('');
    return '<div class="card" data-doc7-census><div class="cardhead">Doc 7 categories</div><div class="small">Language corpus ≠ Evidence ≠ Memory ≠ Trace/receipt ≠ Authority records. ' + esc(PRESENCE_LAW) + '.</div>' + rows + '<div data-doc7-shared>Shared knowledge ' + c.shared_knowledge + (c.shared_knowledge ? '' : ' · empty') + '. A lookup is not written here.</div></div>';
  }
  function doc7HTML(d) {
    if (!d || !d.present) return '';
    const tags = DOC7_IDS.map(id => '<span class="tag doc7' + (d.belief === id ? ' on' : '') + '" data-doc7-cat="' + id + '"' + (d.belief === id ? ' data-doc7-belief="1"' : '') + '>' + esc(DOC7_LABEL[id]) + '</span>').join('');
    return '<div class="doc7" data-doc7-belief="' + esc(d.belief) + '"' + (d.research ? ' data-doc7-research="evidence"' : '') + '><div class="small">Doc 7 · ' + esc(d.law) + '</div>' + tags + '<div class="small" data-doc7-why>' + esc(d.why) + '</div></div>';
  }

  function idsOf(trace, msm) {
    const ev = (msm && msm.evidence && msm.evidence.refs) || [];
    const rpm = (trace && trace.rpm) || [];
    const out = [];
    for (const id of ev) if (id && !out.includes(id)) out.push(id);
    for (const r of rpm) if (r && r.id && !out.includes(r.id)) out.push(r.id);
    return out;
  }
  function classify(trace, msm) {
    const rules = new Set((trace.rules || []).map(r => r && r.id).filter(Boolean));
    const cat = (trace.outcome && trace.outcome.category) || '';
    const cls = (trace.outcome && trace.outcome.class) || '';
    const kind = (msm && msm.meaning && msm.meaning.kind) || '';
    const reason = String(trace.block_reason || '');
    const cause = trace.containment && trace.containment.cause;
    if ((trace.echo && trace.echo.pass === false) || cause === 'echo_failed' || /Echo validation failed/.test(reason)) return { class: 'echo_fail', subtype: null, detail: reason || (trace.echo && trace.echo.reason) || 'echo failed' };
    if (trace.language === 'LANGUAGE_UNEXPRESSIBLE' || /Derivation failed|forbidden transition/.test(reason)) return { class: 'language_unexpressible', subtype: null, detail: reason || 'language unexpressible' };
    if (rules.has('CHI-GRACE-REROUTE') || rules.has('CR-CHI-CORRECTION') || (trace.chi && trace.chi.fire)) return { class: 'chi_reroute', subtype: null, detail: (trace.chi && trace.chi.result) || 'χ re-route' };
    if ((trace.containment && trace.containment.route === 'drift_archive_only') || /^Quarantine:/.test(reason)) return { class: 'quarantine', subtype: null, detail: reason || 'quarantine' };
    let subtype = null;
    if (cat === 'UNDERSTOOD_ACTION_BLOCKED' || cls === 'understood-but-blocked' || kind === 'blocked' || kind === 'neg_act' || kind === 'tool_denied') subtype = 'action_blocked';
    else if (cat === 'AMBIGUITY_PRESERVED' || cls === 'ambiguous') subtype = 'ambiguity';
    else if (cls === 'refuse' || cls === 'reject' || cat === 'REFUSAL_RELEVANT' || cat === 'UNSUPPORTED_PRESERVED' || cat === 'NO_LAWFUL_CANDIDATE' || cat === 'INCONGRUENT_REJECTED' || cat === 'DISCONNECTED_REJECTED' || cat === 'PURPOSE_UNRECOVERABLE') subtype = 'unsupported';
    if (subtype) return { class: 'gate_refusal', subtype, detail: reason || cat || kind };
    return null;
  }
  /* Doc 6 names for a gate the turn already classified. A clarification that is
   * spoken as an answer stays an answer; the label is the state, not a new receipt. */
  function doc6Of(trace, failure, intent) {
    const cat = (trace.outcome && trace.outcome.category) || '';
    const cls = (trace.outcome && trace.outcome.class) || '';
    const sub = failure && failure.class === 'gate_refusal' ? failure.subtype : null;
    let state = null;
    if (sub === 'action_blocked') state = 'action_blocked';
    else if (sub === 'unsupported') state = 'unsupported';
    else if (sub === 'ambiguity') state = 'ambiguity';
    else if (failure) state = null;
    else if (cat === 'UNDERSTOOD_ACTION_BLOCKED' || cls === 'understood-but-blocked') state = 'action_blocked';
    else if (cat === 'AMBIGUITY_PRESERVED' || cls === 'ambiguous') state = 'ambiguity';
    else if (cat === 'CLARIFICATION_REQUIRED' || cat === 'INCOMPLETE_PRESERVED' || cls === 'clarify') state = 'clarification-required';
    else if (cat === 'UNSUPPORTED_PRESERVED' || cat === 'NO_LAWFUL_CANDIDATE' || cat === 'REFUSAL_RELEVANT' || cat === 'INCONGRUENT_REJECTED' || cat === 'DISCONNECTED_REJECTED' || cat === 'PURPOSE_UNRECOVERABLE' || cls === 'refuse' || cls === 'reject') state = 'unsupported';
    if (!state || !DOC6_LABEL[state]) return null;
    return { state: state, label: DOC6_LABEL[state], intent: intent || null, subtype: sub };
  }
  /* Every route except the winner. A candidate that lost keeps its recorded why.
   * A route that never proposed keeps the reason on the route table. */
  function notSelectedOf(sel) {
    sel = sel || {};
    const routes = sel.routes || [];
    const cands = sel.candidates || [];
    const winner = sel.winner || null;
    const cand = new Map();
    for (const c of cands) if (c && c.route && c.status && c.status !== 'selected') cand.set(c.route, c);
    const out = [];
    const seen = new Set();
    const push = (route, status, reason) => {
      const why = String(reason || '').trim();
      if (!route || route === winner || seen.has(route) || !status || !why) return;
      seen.add(route);
      out.push({ route: route, status: status, reason: why });
    };
    if (routes.length) {
      for (const rt of routes) {
        if (!rt || !rt.route || rt.route === winner) continue;
        const c = cand.get(rt.route);
        if (c) push(rt.route, c.status, c.why || c.reason || rt.why);
        else push(rt.route, rt.evaluated === false ? 'not_evaluated' : 'not_applicable', rt.why);
      }
      for (const c of cands) if (c && c.status && c.status !== 'selected') push(c.route, c.status, c.why || c.reason);
      return out;
    }
    return cands.filter(c => c && c.status && c.status !== 'selected' && c.status !== 'agreed').map(c => ({ route: c.route, status: c.status, reason: c.why || c.reason || '' })).filter(c => c.route && c.reason);
  }
  function echoOf(trace) {
    const ev = trace.echo;
    if (!ev) return { pass: null, signature_notes: null };
    if (ev.pass === false) {
      const failed = Object.keys(ev.components || {}).filter(k => !ev.components[k]);
      const notes = [ev.reason || 'echo failed'].concat(failed.length ? ['failed components ' + failed.join(', ')] : []).join('; ');
      return { pass: false, signature_notes: notes };
    }
    return { pass: ev.pass === true ? true : null, signature_notes: ev.pass === true && ev.mode ? String(ev.mode) : null };
  }
  function build(trace, text, msm) {
    trace = trace || {}; msm = msm || trace.msm || {};
    const sel = trace.selection || {};
    const winner = (sel.candidates || []).find(c => c && c.status === 'selected');
    const notSelected = notSelectedOf(sel);
    const ids = idsOf(trace, msm);
    const ops = (trace.memory || []).map(m => ({ op: m.op, id: m.id || null }));
    const intent = trace.intent_kind || null;
    const kind = (msm.meaning && msm.meaning.kind) || '';
    const memAttempted = intent === 'REQUEST_COMMIT' || ops.length > 0 || !!(msm.limits && msm.limits.may_write_memory) || /^(stored|stored_sensitive|merged|replaced|forgotten|note_added|write_held|write_failed)$/.test(kind);
    const wc = trace.world_commit || null;
    const worldAttempted = !!(wc && wc.skipped === false);
    const failure = classify(trace, msm);
    const spoken = text != null && text !== '';
    return {
      schema: SCHEMA,
      packet_version: PACKET_VERSION,
      turn_id: trace.psi_id || (msm && msm.msm_id) || null,
      turn: trace.turn,
      intent: intent,
      input: trace.input || null,
      manifest: {
        msm_id: (msm && msm.msm_id) || trace.psi_id || null,
        msm_v1_id: trace.msm_v1 && trace.msm_v1.manifest_id ? trace.msm_v1.manifest_id : null,
        forge_manifest_id: null
      },
      warrants: ids.map(id => ({ id: id, source: 'turn' })),
      evidence_tiers: ids.map(id => ({ id: id, tier: tierFor(id) })),
      selected: {
        route: sel.winner || (winner && winner.route) || (msm.purpose && msm.purpose.frame) || null,
        score_notes: sel.reason || (winner && winner.why) || (trace.drift && trace.drift.formula) || null
      },
      not_selected: notSelected,
      drift: {
        eps_s: trace.drift ? trace.drift.eps_s : null,
        band: trace.drift ? trace.drift.band : null,
        formula: trace.drift && trace.drift.formula || null,
        correction: trace.correction ? { applied: trace.correction.applied === true, eps_after: trace.correction.eps_after, reason: trace.correction.reason || null, projectable: !!trace.correction.projectable } : null
      },
      containment: { route: trace.containment && trace.containment.route || null, cause: trace.containment && trace.containment.cause || null },
      echo: echoOf(trace),
      memory: { attempted: memAttempted, blocked: memAttempted && ops.length === 0, ops: ops },
      world: { attempted: worldAttempted, blocked: worldAttempted && !(wc && wc.ok), version_id: worldAttempted && wc && wc.ok ? (wc.version_id || null) : null },
      spoken: spoken,
      failure: failure,
      gate: doc6Of(trace, failure, intent),
      doc7: doc7Of(trace, msm),
      receipt_type: failure ? failure.class : 'answer',
      audit_receipt_id: null
    };
  }
  function openReceipt(packet) {
    if (!packet) return null;
    if (packet.receipt_type === 'answer') return { schema: ANSWER_SCHEMA, receipt_type: 'answer', packet: packet };
    return { schema: FAILURE_SCHEMA, receipt_type: packet.receipt_type, failure: packet.failure, packet: packet };
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function receiptCard(packet) {
    if (!packet) return '';
    const t = packet.receipt_type || 'answer';
    const gate = packet.gate || null;
    const label = gate && gate.label ? gate.label : '';
    const sub = label ? ' · ' + label : '';
    const detail = packet.failure && packet.failure.detail ? packet.failure.detail : '';
    const ns = Array.isArray(packet.not_selected) ? packet.not_selected : [];
    const open = (t === 'answer' && !ns.length && !gate) ? '' : ' open';
    const doc = gate && gate.state ? ' data-doc6-state="' + esc(gate.state) + '"' : '';
    const list = ns.length ? '<ul class="not-selected" data-not-selected="' + ns.length + '">' + ns.map(c => '<li data-route="' + esc(c.route) + '"><b>' + esc(c.route) + '</b> <span class="meta">' + esc(c.status) + '</span> — ' + esc(c.reason) + '</li>').join('') + '</ul>' : '';
    const intent = gate && gate.intent ? ' · intent ' + esc(gate.intent) : '';
    const cats = doc7HTML(packet.doc7);
    return cats + '<details class="card"' + open + ' data-receipt-type="' + esc(t) + '"' + doc + '><summary>' + esc((LABELS[t] || t) + sub) + '</summary><div class="meta">turn ' + esc(packet.turn) + ' · ' + esc(packet.turn_id) + intent + '</div>' + (detail ? '<div class="small">' + esc(detail) + '</div>' : '') + list + '<button type="button" data-export-turn="' + esc(packet.turn) + '">Export turn packet</button></details>';
  }
  const api = { SCHEMA, FAILURE_SCHEMA, ANSWER_SCHEMA, FAILURE_TYPES, GATE_SUBTYPES, DOC6_LABEL, DOC7_IDS, DOC7_LABEL, PRESENCE_LAW, PACKET_VERSION, build, classify, doc6Of, doc7Of, census, categoryPanel, notSelectedOf, openReceipt, receiptCard };
  if (isNode) module.exports = api; else root.KTurnPacket = api;
})(typeof self !== 'undefined' ? self : this);
