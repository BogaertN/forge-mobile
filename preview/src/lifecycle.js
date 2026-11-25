/* W3 meaning lifecycle records (MSM-v1; forge_language_bridge_v2…v5; MEA proof_debt_scorer tiers).
 * Pure functions over a finished kernel trace. Records only — they grant no authority and produce no reply text.
 *  - msmLifecycle: ordered states captured → parsed → candidates → selected|rejected → validated → rendered → delivered|blocked
 *  - rejectedMeanings: every non-selected candidate kept with its reason (NonSelection records; Doc6 §29, §36)
 *  - bridges: Bridge 2 custody · Bridge 3 structural preview · Bridge 4 candidate custody · Bridge 5 eligibility (status + non-authority flags)
 *  - evidenceTiers: MEA tier per evidence ref (tier table ported from forge rmc_engine_v1/mea/proof_debt_scorer.py) */
(function (root) {
'use strict';
const TIERS = { peer_reviewed: 1.00, published_measurement: 1.00, published_derivation: 0.92, published: 0.90, primary_source: 0.86, official: 0.82, internal_verified: 0.70, internal: 0.55, derived: 0.50, unverified: 0.20, hypothesis: 0.12, speculative: 0.05, rejected: 0.0 };
const BLOCKED_DOWNSTREAM = ['truth_decision', 'permission_grant', 'delivery_action', 'execution_authority', 'memory_write', 'evidence_validation', 'tool_invocation', 'route_creation', 'action_execution'];
const ids = t => (t.rules || []).map(r => r.id);
function tierOf(ref, trace) { const id = String(ref || ''); const R = ids(trace);
  if (/^mem:/.test(id)) return R.some(x => /^INF-/.test(x)) ? 'derived' : 'internal_verified';  // user's own committed statement, read-back verified; inference ⇒ derived
  if (/^wn30:|^LX-EXTERNAL-WORDNET/.test(id)) return 'published';                                // Princeton WordNet 3.0 (licensed, Doc 8)
  if (/^web:|^research:|^capture:/.test(id)) return 'unverified';                                 // crawled excerpt: evidence only, never authority
  if (/^calc:|^math:/.test(id)) return 'internal_verified';                                       // recomputed + numerically cross-checked
  if (/^dream:|^ghost:/.test(id)) return 'speculative'; return 'internal'; }
function evidenceTiers(trace) { const refs = ((trace.msm && trace.msm.evidence && trace.msm.evidence.refs) || []).slice(); const m = trace.msm && trace.msm.meaning;
  if (m && /^(math|solved|calculus|simplified|factored|system|converted)$/.test(m.kind)) refs.push('calc:' + m.kind);
  if (ids(trace).includes('LX-EXTERNAL-WORDNET') || (m && m.wn)) refs.push('wn30:hypernym-path');
  return refs.map(r => { const tier = tierOf(r, trace); return { ref: r, tier, score: TIERS[tier] }; }); }
function rejectedMeanings(trace) { const out = []; const m = (trace.msm && trace.msm.meaning) || {}; const R = ids(trace); const add = (what, reason, rule) => out.push({ record_kind: 'rejected_meaning', candidate: what, reason, rule });
  if (m.kind === 'clarify_readings') (m.readings || []).forEach((r, i) => add('reading ' + (i + 1) + ': ' + r, 'structural ambiguity preserved; none selected without the user', 'G-STRUCTURAL-AMBIGUITY-PRESERVED'));
  for (const r of trace.rules || []) {
    if (r.id === 'LL-QSCOPE-SURFACE') add('inverse scope ∃y∀x', 'preserved, not selected (surface scope ∀x∃y selected)', r.id);
    if (r.id === 'LL-QSCOPE-INVERSE-NOT-ENTAILED') add('inverse scope ∃y∀x as an answer', 'not entailed by the stored surface reading', r.id);
    if (r.id === 'LL-COPULA-OF-APAVADA') add('copular “of”-predicate reading', 'blocked by apavāda (nominal reading exists)', r.id);
    if (r.id === 'LL-QUANT-MISMATCH') add('cross-quantifier match', 'no inference across quantifiers', r.id);
    if (/^K-SENSE-/.test(r.id) && r.note) add('other verb senses', 'held open / filtered by predicate frame', r.id); }
  if (trace.blocked && trace.block_reason) add('delivered surface', String(trace.block_reason).slice(0, 160), 'ECHO-OR-GATE-BLOCK');
  if (trace.outcome && /REJECTED|NO_LAWFUL|UNRECOVERABLE/.test(trace.outcome.category)) add('selected meaning', trace.outcome.category, 'Doc6 §36');
  if (R.includes('NO-INFERENCE-ACROSS-VALUES')) add('inferred yes/no', 'no lawful inference rule reached the claim', 'NO-INFERENCE-ACROSS-VALUES');
  return out; }
function msmLifecycle(trace) { const S = []; const st = (state, ok, note) => S.push({ state, ok: ok !== false, note: note || null });
  const cat = trace.outcome ? trace.outcome.category : null; st('captured', true, 'input event'); st('parsed', !!(trace.rules || []).length);
  const amb = cat === 'AMBIGUITY_PRESERVED'; st('candidates', true, amb ? 'several readings' : 'one candidate');
  const sel = /^SELECTED/.test(cat || ''); st(sel ? 'selected' : 'not_selected', true, cat);
  const echoOk = !!(trace.echo && trace.echo.pass); st('validated', echoOk, trace.echo ? (echoOk ? 'echo pass' : trace.echo.reason || 'echo fail') : 'no echo');
  st('rendered', !!trace.derivation, trace.derivation ? (trace.derivation.rule_count || (trace.derivation.rules || []).length) + ' derivation rules' : null);
  st(trace.blocked ? 'blocked' : 'delivered', true); if ((trace.memory || []).length) st('committed', true, (trace.memory || []).length + ' memory op(s), read-back verified');
  return S; }
function bridges(trace, sha) { const cat = trace.outcome ? trace.outcome.category : 'UNKNOWN'; const m = (trace.msm && trace.msm.meaning) || {}; const frame = trace.msm && trace.msm.purpose ? trace.msm.purpose.frame : null;
  const eff = { filesystem_read_performed: false, filesystem_write_performed: false, network_access_performed: !!trace.tool_request && /research|capture|github/.test(trace.tool_request.tool || ''), memory_read_performed: true, memory_write_performed: !!(trace.memory || []).length, tool_routing_performed: !!trace.tool_request, model_call_performed: false };
  return [
    { bridge: 2, bridge_version: 'forge_language_bridge_v2', status: 'CUSTODY_CREATED', observed_source_sha256: sha || null, ordinary_llm_fallback: false, unsupported_requests_are_held: true, effects: eff },
    { bridge: 3, bridge_version: 'forge_language_bridge_v3', status: 'STRUCTURAL_PREVIEW', stages: (trace.phases || []).map(p => p.phase || p).slice(0, 12), rule_count: (trace.rules || []).length },
    { bridge: 4, bridge_version: 'forge_language_bridge_v4', status: cat === 'AMBIGUITY_PRESERVED' ? 'CANDIDATE_CUSTODY_HELD' : 'CANDIDATE_CUSTODY', candidates: m.readings ? m.readings.length : 1, blocked_downstream_without_kernel_selection: BLOCKED_DOWNSTREAM },
    { bridge: 5, bridge_version: 'forge_language_bridge_v5', status: /^SELECTED/.test(cat) ? 'ELIGIBILITY_EVALUATED_SELECTED' : cat === 'AMBIGUITY_PRESERVED' ? 'PREDICATE_FRAME_NOMINATION_REQUIRED' : 'ELIGIBILITY_EVALUATED_HELD', predicate_frame: frame, gates: trace.gates || {}, authority_granted_by_bridge: false }];
}
function build(trace, sha) { return { schema: 'forge-mobile-w3-lifecycle-v1', lifecycle: msmLifecycle(trace), rejected_meanings: rejectedMeanings(trace), bridges: bridges(trace, sha), evidence_tiers: evidenceTiers(trace) }; }
const api = { TIERS, build, msmLifecycle, rejectedMeanings, bridges, evidenceTiers, tierOf };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KLife = api;
})(typeof self !== 'undefined' ? self : this);
