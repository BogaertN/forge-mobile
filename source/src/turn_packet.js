/* 4.9.111: one audited turn packet, success or failure, and a receipt a person can open.
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
    const notSelected = (sel.candidates || []).filter(c => c && c.status && c.status !== 'selected' && c.status !== 'agreed').map(c => ({ route: c.route, status: c.status, reason: c.why || c.reason || '' }));
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
    const sub = packet.failure && packet.failure.subtype ? ' · ' + String(packet.failure.subtype).replace(/_/g, '-') : '';
    const detail = packet.failure && packet.failure.detail ? packet.failure.detail : '';
    const open = t === 'answer' ? '' : ' open';
    return '<details class="card"' + open + ' data-receipt-type="' + esc(t) + '"><summary>' + esc((LABELS[t] || t) + sub) + '</summary><div class="meta">turn ' + esc(packet.turn) + ' · ' + esc(packet.turn_id) + '</div>' + (detail ? '<div class="small">' + esc(detail) + '</div>' : '') + '<button type="button" data-export-turn="' + esc(packet.turn) + '">Export turn packet</button></details>';
  }
  const api = { SCHEMA, FAILURE_SCHEMA, ANSWER_SCHEMA, FAILURE_TYPES, GATE_SUBTYPES, PACKET_VERSION, build, classify, openReceipt, receiptCard };
  if (isNode) module.exports = api; else root.KTurnPacket = api;
})(typeof self !== 'undefined' ? self : this);
