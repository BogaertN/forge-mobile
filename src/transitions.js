/* transitions.js — the transition rules the documents actually specify, and nothing more.
 * (A) Request lifecycle — Forge 2.0 Production Build Bible §7.4 (25 states, same order as forge2 contracts/request_state.py,
 *     REQUEST_LIFECYCLE_STATE_IDENTITIES_V1): "No state may be skipped silently. Every transition creates a receipt."
 *     §22.1 receipt/event fields; §22.3 "Users must be able to cancel tasks".
 *     Implemented edges: next state in sequence; forward skip ONLY with a recorded reason naming every skipped state; CANCELLED from
 *     any non-terminal state. Every other edge (returns from CLARIFICATION_REQUIRED/HELD/FAILED, backward moves) is NOT specified →
 *     refused with REQ-TRANSITION-UNSPECIFIED and logged as a policy gap (forge2 keeps transition_policy_defined = false).
 * (B) Controlled status ladder — Doc 10 §46.31 upgrade rules (evidence-gated, no jumps) and §46.32 downgrades (recorded with old status
 *     and reason). */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports; const { sha256 } = isNode ? require('./sha256.js') : root.KSha;
const canon = o => (Array.isArray(o) ? '[' + o.map(canon).join(',') + ']' : o && typeof o === 'object' ? '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}' : JSON.stringify(o));
const STATES = ['RECEIVED', 'CUSTODIED', 'INTERPRETATION_CANDIDATES_READY', 'CLARIFICATION_REQUIRED', 'REQUEST_CONTRACT_READY', 'CONTEXT_READY', 'CAPABILITY_REQUIREMENTS_READY', 'CAPABILITY_RESOLVED', 'PLAN_READY', 'AWAITING_AUTHORITY', 'AUTHORIZED', 'EXECUTING', 'EXECUTION_COMPLETE', 'VERIFYING', 'VERIFIED', 'FAILED', 'HELD', 'CANCELLED', 'RESULT_READY', 'DELIVERED', 'APPLY_PENDING', 'APPLIED', 'COMMITTED', 'RELEASED', 'ARCHIVED'];
const TERMINAL = new Set(['CANCELLED', 'ARCHIVED']); const DETOUR = new Set(['CLARIFICATION_REQUIRED', 'HELD', 'FAILED']); /* CANCELLED: §22.3 cancellation ends the task; ARCHIVED: last state */
function RequestLifecycle(store, opts) { opts = opts || {}; const now = () => (opts.clock ? opts.clock() : new Date().toISOString()); const KEY = 'request_receipts';
  const all = () => store.load(KEY); const of = task => all().filter(r => r.task === task);
  const state = task => { const r = of(task); return r.length ? r[r.length - 1].next : null; };
  function emit(task, prior, next, ev) { const l = all(); const prev = l.length ? l[l.length - 1].hash : null; const rec = { task, actor: ev.actor || 'kernel', service: ev.service || null, prior, next, skipped: ev.skipped || [], reason: ev.reason || null, input_refs: ev.input_refs || [], output_refs: ev.output_refs || [], decision: ev.decision || 'allow', timestamp: now(), error: ev.error || null, request_class: ev.request_class || null, prev };
    rec.hash = sha256(canon(rec)); l.push(rec); store.save(KEY, l.slice(-5000)); return rec; }
  function open(task, ev) { if (state(task)) return { ok: false, rule: 'REQ-ALREADY-OPEN' }; return { ok: true, receipt: emit(task, null, 'RECEIVED', ev || {}) }; }
  function move(task, next, ev) { ev = ev || {}; const cur = state(task); if (!cur) return { ok: false, rule: 'REQ-NOT-OPEN' }; if (!STATES.includes(next)) return { ok: false, rule: 'REQ-STATE-UNKNOWN' };
    if (TERMINAL.has(cur)) return { ok: false, rule: 'REQ-TERMINAL' }; const i = STATES.indexOf(cur), j = STATES.indexOf(next);
    if (next === 'CANCELLED') return { ok: true, receipt: emit(task, cur, next, Object.assign({}, ev, { reason: ev.reason || 'user cancellation (§22.3)' })) };
    if (j === i + 1) return { ok: true, receipt: emit(task, cur, next, ev) };
    /* user decision 2026-10-11 (1): CLARIFICATION_REQUIRED / HELD / FAILED are detours entered from any non-terminal state, and a request
     * returns from them to the step it came from, with a receipt. */
    if (DETOUR.has(next) && !DETOUR.has(cur)) return { ok: true, receipt: emit(task, cur, next, Object.assign({}, ev, { reason: ev.reason || 'detour' })) };
    if (DETOUR.has(cur)) { const rs = of(task); const enter = rs[rs.length - 1]; if (next === enter.prior) return { ok: true, receipt: emit(task, cur, next, Object.assign({}, ev, { reason: ev.reason || 'return to the step it came from (user decision 2026-10-11)' })) }; }
    if (j > i + 1 && !DETOUR.has(cur)) { if (!ev.reason) return { ok: false, rule: 'REQ-SILENT-SKIP', skipped: STATES.slice(i + 1, j) }; return { ok: true, receipt: emit(task, cur, next, Object.assign({}, ev, { skipped: STATES.slice(i + 1, j) })) }; }
    const gaps = store.load('request_policy_gaps'); gaps.push({ task, from: cur, to: next, at: now(), rule: 'REQ-TRANSITION-UNSPECIFIED' }); store.save('request_policy_gaps', gaps.slice(-500)); return { ok: false, rule: 'REQ-TRANSITION-UNSPECIFIED' }; }
  function walk(task, path, ev) { const out = []; for (const step of path) { const r = move(task, step.to, Object.assign({}, ev, step)); out.push(r); if (!r.ok) break; } return out; }
  function verify() { const l = all(); let prev = null; for (let i = 0; i < l.length; i++) { const e = Object.assign({}, l[i]); const h = e.hash; delete e.hash; if (e.prev !== prev || sha256(canon(e)) !== h) return { ok: false, broken_at: i }; prev = h; } return { ok: true, count: l.length }; }
  return { STATES, open, move, walk, state, receipts: of, verify, gaps: () => store.load('request_policy_gaps') }; }
/* Bible §7.1 request types / §7.2 result types — rule-based tagging from the kernel-selected frame (user decision 2026-10-11 (3); no classifier).
 * Ordered rules: first matching frame prefix wins; meaning kind refines refusals and clarifications. */
const TYPE_RULES = [
  ['FR.TOOL.RESEARCH', 'current public research', 'source comparison'], ['FR.TOOL.FEED', 'current public research', 'source comparison'], ['FR.TOOL.CAPTURE', 'document analysis', 'file artifact'],
  ['FR.TOOL.GITHUB', 'software inspection', 'file artifact'], ['FR.TOOL.SYMBOLS', 'software inspection', 'file artifact'], ['FR.TOOL.SYMFIND', 'software inspection', 'natural-language explanation'],
  ['FR.TOOL.SIM', 'simulation', 'simulation report'], ['FR.TOOL.PFDRIFT', 'data transformation', 'numeric result'], ['FR.TOOL.PFAGENT', 'data transformation', 'natural-language explanation'],
  ['FR.TOOL.EDE', 'project knowledge question', 'plan only'], ['FR.TOOL.USER', 'data transformation', 'numeric result'], ['FR.TOOL', 'tool discovery', 'natural-language explanation'],
  ['FR.MATH', 'mathematical computation', 'numeric result'], ['FR.ALGEBRA', 'mathematical computation', 'numeric result'], ['FR.UNITS', 'mathematical computation', 'numeric result'],
  ['FR.RENDER', 'data transformation', 'file artifact'], ['FR.DEFINE', 'information question', 'natural-language explanation'], ['FR.CAPABILITY', 'tool discovery', 'natural-language explanation'],
  ['FR.REMEMBER', 'project knowledge question', 'natural-language explanation'], ['FR.FORGET', 'project knowledge question', 'natural-language explanation'], ['FR.NOTE', 'project knowledge question', 'natural-language explanation'],
  ['FR.REMIND', 'project knowledge question', 'natural-language explanation'], ['FR.MEM', 'project knowledge question', 'natural-language explanation'], ['FR.CONFIRM', 'clarification response', 'natural-language explanation'],
  ['FR.EXTERNAL', 'system administration', 'refusal or limitation'], ['FR.IMPERATIVE', 'system administration', 'refusal or limitation'], ['FR.', 'information question', 'natural-language explanation']];
function classify(frame, kind) { const f = String(frame || 'FR.'); const r = TYPE_RULES.find(x => f.startsWith(x[0])) || TYPE_RULES[TYPE_RULES.length - 1]; let result = r[2];
  if (/^(refuse|neg_act|tool_denied|tool_failed|external|blocked|capability_no)/.test(kind || '')) result = 'refusal or limitation'; else if (/^clarify/.test(kind || '')) result = 'approval request';
  return { request_type: r[1], result_type: result, rule: 'REQTYPE-' + r[0], source: 'Bible §7.1/§7.2 (frame rule, no classifier)' }; }
/* (B) Doc 10 §46.31 / §46.32 */
const LADDER = ['planned', 'designed', 'authorized_for_installation', 'installed', 'tested', 'verified', 'accepted_within_scope', 'current_baseline', 'production_ready'];
const SIDE = { release_candidate: ['released'] }; /* "Release candidate may upgrade to released only after release decision." */
const GATE = { designed: 'design', authorized_for_installation: 'inspection+patch_design+backup', installed: 'installation_record', tested: 'test_record', verified: 'verifier_record', accepted_within_scope: 'result_packet+decision_record', current_baseline: 'accepted_baseline_update', production_ready: 'production_readiness_decision', released: 'release_decision' };
const DOWN = ['stale', 'blocked', 'rollback_required', 'held', 'contaminated', 'prohibited', 'superseded'];
function upgrade(cur, next, evidence) { const ok = (LADDER.indexOf(next) === LADDER.indexOf(cur) + 1 && LADDER.indexOf(cur) >= 0) || (SIDE[cur] || []).includes(next); if (!ok) return { ok: false, rule: 'STATUS-NO-JUMP (Doc10 §46.31)' };
  const need = GATE[next]; if (!evidence || !evidence[need]) return { ok: false, rule: 'STATUS-EVIDENCE-MISSING', needs: need }; return { ok: true, record: { from: cur, to: next, evidence_ref: evidence[need] } }; }
function downgrade(cur, next, reason) { if (!DOWN.includes(next)) return { ok: false, rule: 'STATUS-DOWNGRADE-UNKNOWN' }; if (!reason) return { ok: false, rule: 'STATUS-DOWNGRADE-NEEDS-REASON (§46.32)' }; return { ok: true, record: { from: cur, to: next, old_status: cur, reason } }; }
const api = { classify, TYPE_RULES, DETOUR, STATES, TERMINAL, RequestLifecycle, LADDER, SIDE, GATE, DOWN, upgrade, downgrade };
if (isNode) module.exports = api; else root.KTransitions = api;
})(typeof self !== 'undefined' ? self : this);
