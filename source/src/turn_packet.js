/* 4.9.111: one audited turn packet, success or failure, and a receipt a person can open.
 * 4.9.112: the same packet names the Doc 6 gate, when one already fired, and lists every
 * route that was not selected with the reason the turn already recorded.
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
      evidence_tiers: ids.map(id => ({ id: id, tier: 'user_statement' })),
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
    return '<details class="card"' + open + ' data-receipt-type="' + esc(t) + '"' + doc + '><summary>' + esc((LABELS[t] || t) + sub) + '</summary><div class="meta">turn ' + esc(packet.turn) + ' · ' + esc(packet.turn_id) + intent + '</div>' + (detail ? '<div class="small">' + esc(detail) + '</div>' : '') + list + '<button type="button" data-export-turn="' + esc(packet.turn) + '">Export turn packet</button></details>';
  }
  const api = { SCHEMA, FAILURE_SCHEMA, ANSWER_SCHEMA, FAILURE_TYPES, GATE_SUBTYPES, DOC6_LABEL, PACKET_VERSION, build, classify, doc6Of, notSelectedOf, openReceipt, receiptCard };
  if (isNode) module.exports = api; else root.KTurnPacket = api;
})(typeof self !== 'undefined' ? self : this);
