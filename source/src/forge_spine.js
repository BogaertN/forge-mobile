/* forge_spine.js — faithful JS ports of
 *   forge2 (BogaertN/forge2 @262a95eb) src/forge2/contracts/{canonical,identity,successor,request_state,input_event,
 *          classification_candidate,request_contract,context_manifest,capability_requirement}.py
 *   forge  (BogaertN/forge @fcbf9176) aiweb_language_core_bootstrap/{meaning_structure_manifest,verbal_cognition_gate_runtime/*,
 *          selected_meaning_runtime/eligibility_evaluation}, forge_language_bridge_v1/interpreter.py, agents/forge/llm_authority.py,
 *          forge/rmc_engine_v1/mea/{fixed_point_math_contract,evidence_tier_contract}.py, rmc_engine_v1/reference/symbolic_math_expression_lexicon_v1_gp014.json
 * Deterministic; no model; no network. Authority values are recorded evidence only (forge2 CONTRACT_IDENTITY_METADATA_V1). */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const sha256 = isNode ? require('./sha256.js').sha256 : root.KSha.sha256;

  /* ===== forge2 canonical.py ===== */
  const MAX_SAFE = 2 ** 53 - 1; const NS_RE = /^[a-z][a-z0-9_.-]{0,95}$/;
  class CanonicalizationError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
  function canonicalize(v, anc) { anc = anc || new Set();
    if (v === null || v === undefined) { if (v === undefined) throw new CanonicalizationError('unsupported_type', 'undefined has no approved encoding'); return null; }
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') { if (!Number.isInteger(v)) throw new CanonicalizationError('float_rejected', 'floating-point values are rejected by the Forge 2 canonical profile'); if (Math.abs(v) > MAX_SAFE) throw new CanonicalizationError('unsafe_integer', 'integer outside the JSON safe range'); return v; }
    if (typeof v === 'bigint') { if (v > BigInt(MAX_SAFE) || v < -BigInt(MAX_SAFE)) throw new CanonicalizationError('unsafe_integer', 'integer outside the JSON safe range'); return Number(v); }
    if (typeof v === 'string') return v.normalize('NFC');
    if (v instanceof Date) return utc(v);
    if (typeof v === 'object') { if (anc.has(v)) throw new CanonicalizationError('cycle', 'recursive container ancestry'); anc.add(v);
      let out; if (Array.isArray(v)) out = v.map(x => canonicalize(x, anc));
      else if (v instanceof Set || v instanceof Map || ArrayBuffer.isView(v)) throw new CanonicalizationError('unsupported_type', 'sets, maps and bytes are rejected');
      else { out = {}; const seen = new Set(); for (const k of Object.keys(v)) { const nk = k.normalize('NFC'); if (seen.has(nk)) throw new CanonicalizationError('key_collision', 'mapping keys collide after Unicode normalization'); seen.add(nk); out[nk] = canonicalize(v[k], anc); } }
      anc.delete(v); return out; }
    throw new CanonicalizationError('unsupported_type', typeof v + ' has no approved encoding'); }
  const sortKeys = v => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.keys(v).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {}) : v);
  const canonicalJson = v => JSON.stringify(sortKeys(canonicalize(v)));
  const canonicalSha256 = v => sha256(canonicalJson(v));
  function stableIdentifier(ns, v) { ns = String(ns).normalize('NFC'); if (!NS_RE.test(ns)) throw new CanonicalizationError('invalid_namespace', 'Namespace must begin with a lowercase ASCII letter and contain only lowercase letters, digits, dots, underscores, or hyphens.'); return ns + ':sha256:' + canonicalSha256(v); }
  /* UTC datetime: isoformat(timespec="microseconds") with Z */
  function utc(d) { const x = d instanceof Date ? d : new Date(d); if (isNaN(x)) throw new CanonicalizationError('invalid_datetime', 'invalid datetime'); return x.toISOString().replace(/\.(\d{3})Z$/, '.$1000Z'); }

  /* ===== forge2 identity.py ===== */
  const LIFECYCLE = ['draft', 'candidate', 'accepted', 'superseded', 'rejected', 'archived'];
  const AUTHORITY = ['none', 'advisory', 'requested', 'authorized', 'denied', 'revoked'];
  const EFFECTS = ['read', 'write', 'delete', 'execute', 'network', 'install', 'apply', 'commit', 'release'];
  class ContractValidationError extends Error { constructor(code, field, msg) { super(code + ' @' + field + ': ' + msg); this.code = code; this.field = field; } }
  const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  function createContractMetadata({ schema_version = '1.0.0', contract_type, body, created_at, lifecycle_state = 'candidate', authority_status = 'none', parent = null, declared_effects = [] }) {
    if (!SEMVER.test(schema_version)) throw new ContractValidationError('invalid_schema_version', 'schema_version', 'must be canonical major.minor.patch');
    if (!/^[A-Z][A-Za-z0-9]{0,95}$/.test(contract_type || '')) throw new ContractValidationError('invalid_contract_type', 'contract_type', 'must be an UpperCamel identifier');
    if (!LIFECYCLE.includes(lifecycle_state)) throw new ContractValidationError('invalid_lifecycle_state', 'lifecycle_state', lifecycle_state);
    if (!AUTHORITY.includes(authority_status)) throw new ContractValidationError('invalid_authority_status', 'authority_status', authority_status);
    const effects = declared_effects.map(e => { if (!EFFECTS.includes(e.kind)) throw new ContractValidationError('invalid_effect', 'declared_effects', e.kind); return { description: e.description === undefined ? null : e.description, kind: e.kind, target: String(e.target || '') }; }).sort((a, b) => { const ka = [a.kind, a.target, a.description || ''], kb = [b.kind, b.target, b.description || '']; for (let i = 0; i < 3; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1; return 0; });
    const content_hash = canonicalSha256(body); const at = utc(created_at);
    const material = { authority_status, body_sha256: content_hash, contract_type, created_at: at, declared_effects: effects, lifecycle_state, parent, schema_version };
    return { contract_id: stableIdentifier('aiweb.contract', material), schema_version, contract_type, content_hash, created_at: at, lifecycle_state, authority_status, parent, declared_effects: effects }; }
  function verifyContractMetadata(meta, body) { const re = createContractMetadata(Object.assign({}, meta, { body })); return re.contract_id === meta.contract_id && re.content_hash === meta.content_hash; }
  const toReference = m => ({ contract_id: m.contract_id, content_hash: m.content_hash, contract_type: m.contract_type, schema_version: m.schema_version });

  /* ===== forge2 successor.py (Version 1 laws) ===== */
  const LIFECYCLE_EDGES = { draft: ['candidate', 'rejected', 'archived'], candidate: ['accepted', 'rejected', 'archived'], accepted: ['superseded', 'archived'], superseded: ['archived'], rejected: ['archived'], archived: [] };
  const AUTH_EDGES = { none: ['advisory', 'requested'], advisory: ['requested', 'none'], requested: ['authorized', 'denied'], authorized: ['revoked'], denied: ['requested'], revoked: ['requested'] };
  function validateSuccessor(pred, succ, observed_at) { const ch = [];
    if (succ.contract_id === pred.contract_id) throw new ContractValidationError('successor_same_id', 'contract_id', 'a successor must have a different contract ID');
    if (succ.contract_type !== pred.contract_type) throw new ContractValidationError('successor_type_changed', 'contract_type', 'contract type must be preserved');
    if (!succ.parent || succ.parent.contract_id !== pred.contract_id) throw new ContractValidationError('successor_parent_missing', 'parent', 'successor must directly reference its predecessor');
    if (!(succ.created_at > pred.created_at)) throw new ContractValidationError('successor_not_later', 'created_at', 'successor creation time must be later');
    if (succ.content_hash !== pred.content_hash) ch.push('body'); if (succ.schema_version !== pred.schema_version) ch.push('schema_version'); if (succ.lifecycle_state !== pred.lifecycle_state) ch.push('lifecycle_state'); if (succ.authority_status !== pred.authority_status) ch.push('authority_status'); if (canonicalJson(succ.declared_effects) !== canonicalJson(pred.declared_effects)) ch.push('declared_effects');
    if (!ch.length) throw new ContractValidationError('successor_no_op', 'metadata', 'a later timestamp alone does not make a valid successor');
    let kind;
    if (ch.includes('schema_version')) { if (ch.some(c => !['schema_version', 'body'].includes(c))) throw new ContractValidationError('successor_mixed_transition', 'metadata', 'schema revision may only include a body change'); const [a, b, c] = pred.schema_version.split('.').map(Number), [x, y, z] = succ.schema_version.split('.').map(Number); if (!((x === a && y === b && z === c + 1) || (x === a && y === b + 1 && z === 0) || (x === a + 1 && y === 0 && z === 0))) throw new ContractValidationError('successor_bad_version_step', 'schema_version', 'only next patch/minor/major'); kind = 'schema_revision'; }
    else if (ch.length > 1) throw new ContractValidationError('successor_mixed_transition', 'metadata', 'independent changes must be separate successors: ' + ch.join(', '));
    else if (ch[0] === 'body') { if (!['draft', 'candidate'].includes(pred.lifecycle_state)) throw new ContractValidationError('successor_body_locked', 'lifecycle_state', 'body revisions only while draft or candidate'); kind = 'body_revision'; }
    else if (ch[0] === 'lifecycle_state') { if (!LIFECYCLE_EDGES[pred.lifecycle_state].includes(succ.lifecycle_state)) throw new ContractValidationError('successor_bad_lifecycle', 'lifecycle_state', pred.lifecycle_state + ' → ' + succ.lifecycle_state + ' is not in the transition table'); kind = 'lifecycle_transition'; }
    else if (ch[0] === 'authority_status') { if (pred.authority_status === 'none' && succ.authority_status === 'authorized') throw new ContractValidationError('successor_authority_jump', 'authority_status', 'direct none → authorized is forbidden; authority must first become requested'); if (!AUTH_EDGES[pred.authority_status].includes(succ.authority_status)) throw new ContractValidationError('successor_bad_authority', 'authority_status', pred.authority_status + ' → ' + succ.authority_status); kind = 'authority_disposition_transition'; }
    else { if (!['draft', 'candidate'].includes(pred.lifecycle_state)) throw new ContractValidationError('successor_effects_locked', 'declared_effects', 'declared-effect revision only while draft or candidate'); kind = 'declared_effect_revision'; }
    const receipt = { predecessor: toReference(pred), successor: toReference(succ), successor_kind: kind, rule: 'APPEND_ONLY_SUCCESSOR_LAWS_V1:' + kind, changed_fields: ch.sort(), observed_at: utc(observed_at || succ.created_at), predecessor_state_hash: canonicalSha256(pred), successor_state_hash: canonicalSha256(succ) };
    return Object.assign({ receipt_id: stableIdentifier('aiweb.successor', receipt) }, receipt); }

  /* ===== forge2 request_state.py ===== */
  const REQUEST_STATES = ['RECEIVED', 'CUSTODIED', 'INTERPRETATION_CANDIDATES_READY', 'CLARIFICATION_REQUIRED', 'REQUEST_CONTRACT_READY', 'CONTEXT_READY', 'CAPABILITY_REQUIREMENTS_READY', 'CAPABILITY_RESOLVED', 'PLAN_READY', 'AWAITING_AUTHORITY', 'AUTHORIZED', 'EXECUTING', 'EXECUTION_COMPLETE', 'VERIFYING', 'VERIFIED', 'FAILED', 'HELD', 'CANCELLED', 'RESULT_READY', 'DELIVERED', 'APPLY_PENDING', 'APPLIED', 'COMMITTED', 'RELEASED', 'ARCHIVED'];
  const stateIdentity = v => { const ord = REQUEST_STATES.indexOf(v); if (ord < 0) throw new ContractValidationError('unknown_state', 'state', v); const body = { ordinal: ord, schema_version: '1.0.0', state: v, state_code: 'request.state.' + v.toLowerCase() + '.v1' }; return Object.assign({}, body, { state_id: stableIdentifier('aiweb.request-state', body) }); };
  const stateRegistryId = () => stableIdentifier('aiweb.request-state-registry', { schema_version: '1.0.0', states: REQUEST_STATES.map(stateIdentity), transition_policy_defined: false });
  const TRANSITION_POLICY_DEFINED = false;

  /* ===== forge2 input_event.py ===== */
  function createInputEvent({ raw_input, conversation_context = [], identity_context = {}, session_metadata = {} }, created_at) {
    if (typeof raw_input !== 'string') throw new ContractValidationError('type_mismatch', 'raw_input', 'must be text');
    const body = canonicalize({ conversation_context, identity_context, raw_input, session_metadata });
    const metadata = createContractMetadata({ contract_type: 'InputEvent', body, created_at, lifecycle_state: 'candidate', authority_status: 'none' });
    return Object.freeze({ metadata, body }); }
  function decodeInputEvent(obj) { const top = Object.keys(obj).sort().join(','); if (top !== 'body,metadata') throw new ContractValidationError('unexpected_fields', '$', top); const bk = Object.keys(obj.body).sort().join(','); if (bk !== 'conversation_context,identity_context,raw_input,session_metadata') throw new ContractValidationError('unexpected_fields', 'body', bk); if (obj.metadata.authority_status !== 'none' || obj.metadata.declared_effects.length) throw new ContractValidationError('authority_forbidden', 'metadata', 'InputEvent must use authority none and declare no effects'); if (!verifyContractMetadata(obj.metadata, obj.body)) throw new ContractValidationError('integrity', 'metadata', 'content hash or contract id mismatch'); return obj; }

  /* ===== forge2 classification_candidate.py ===== */
  const DIMENSIONS = ['request_kind', 'domain', 'expected_result', 'side_effect_class', 'freshness_requirement', 'capability', 'code_explanation_distinction', 'tool_discovery_requirement', 'simulation_requirement', 'clarification_requirement', 'risk_candidate'];
  function featureEvidence({ pointer = '/raw_input', start = null, end = null, observed }, ie) { if (!/^\/[A-Za-z0-9_\/-]*$/.test(pointer)) throw new ContractValidationError('invalid_pointer', 'json_pointer', pointer);
    if (start !== null) { const t = ie.body.raw_input; if (!(Number.isInteger(start) && Number.isInteger(end) && 0 <= start && start <= end && end <= t.length) || t.slice(start, end) !== observed) throw new ContractValidationError('feature_evidence_span_mismatch', 'span', 'observed text does not equal the exact half-open span'); }
    const body = { json_pointer: pointer, observed_value: observed, span: start === null ? null : { end, start } }; return Object.assign({ evidence_id: stableIdentifier('aiweb.feature-evidence', body) }, body); }
  function candidate({ dimension, label, origin = 'rule', producer, confidence_bps, evidence }) { if (!DIMENSIONS.includes(dimension)) throw new ContractValidationError('invalid_dimension', 'dimension', dimension); if (!['rule', 'model'].includes(origin)) throw new ContractValidationError('invalid_origin', 'origin', origin);
    if (!Number.isInteger(confidence_bps) || confidence_bps < 0 || confidence_bps > 10000) throw new ContractValidationError('invalid_confidence', 'confidence_bps', 'integer basis points 0..10000 (floats are forbidden)'); if (!evidence || !evidence.length) throw new ContractValidationError('evidence_required', 'evidence', 'every candidate needs FeatureEvidence');
    const body = { confidence_bps, dimension, evidence: evidence.map(e => e.evidence_id), label, origin, producer }; return Object.assign({ candidate_id: stableIdentifier('aiweb.classification-candidate', body) }, body); }
  function createCandidateSet(ie, cands, { uncertainty = [], clarification_recommended = false, clarification_reasons = [] }, created_at) {
    if (!cands.length && !(clarification_recommended && clarification_reasons.length)) throw new ContractValidationError('empty_without_clarification', 'candidates', 'zero candidates only when clarification is recommended with a reason');
    const body = { candidates: cands, clarification_reasons: [...clarification_reasons].sort(), clarification_recommended, input_event: toReference(ie.metadata), uncertainty_codes: [...uncertainty].sort() };
    return { metadata: createContractMetadata({ contract_type: 'ClassificationCandidateSet', body, created_at, authority_status: 'none' }), body }; }

  /* ===== forge2 request_contract.py ===== */
  const REQUIRED_DIMS = ['request_kind', 'expected_result', 'side_effect_class'];
  function createRequestContract(ie, set, selections, statements, producer, created_at) {
    if (set.body.clarification_recommended) throw new ContractValidationError('clarification_recommended', 'candidate_set', 'a ClassificationCandidateSet that recommends clarification cannot produce a RequestContract');
    const sel = selections.map(s => { const c = set.body.candidates.find(x => x.candidate_id === s.candidate_id); if (!c) throw new ContractValidationError('candidate_not_in_set', 'selections', s.candidate_id); return { basis_codes: s.basis_codes, candidate_id: c.candidate_id, dimension: c.dimension, label: c.label, selection_id: stableIdentifier('aiweb.candidate-selection', { c: c.candidate_id, b: s.basis_codes }) }; });
    for (const d of REQUIRED_DIMS) { const n = sel.filter(s => s.dimension === d).length; if (n !== 1) throw new ContractValidationError('selected_dimension_count', d, 'exactly one selected candidate required, got ' + n); }
    const dims = sel.map(s => s.dimension); if (new Set(dims).size !== dims.length) throw new ContractValidationError('dimension_selected_twice', 'selections', 'no dimension may be selected more than once');
    const allowedEv = new Set(sel.flatMap(s => set.body.candidates.find(c => c.candidate_id === s.candidate_id).evidence));
    const st = statements.map(x => { if (!['goal', 'constraint', 'desired_result'].includes(x.kind)) throw new ContractValidationError('invalid_statement_kind', 'statements', x.kind); if (!x.evidence.length || !x.evidence.every(e => allowedEv.has(e))) throw new ContractValidationError('unselected_evidence', 'statements', 'statement evidence must originate from selected candidates'); const b = { code: x.code, evidence: x.evidence, kind: x.kind, text: x.text }; return Object.assign({ statement_id: stableIdentifier('aiweb.request-statement', b) }, b); });
    const body = { candidate_set: toReference(set.metadata), input_event: toReference(ie.metadata), producer, selections: sel, statements: st, uncertainty_codes: set.body.uncertainty_codes };
    return { metadata: createContractMetadata({ contract_type: 'RequestContract', body, created_at, authority_status: 'none' }), body }; }

  /* ===== forge2 context_manifest.py (subset: admitted/excluded with reasons; memory ≠ truth) ===== */
  const CONTEXT_CATEGORIES = ['file_slice', 'symbol_reference', 'repository_commit', 'test_output', 'policy', 'documentation', 'capability_description', 'memory_candidate', 'prior_task_result'];
  function createContextManifest(rc, step, admitted, excluded, budgets, created_at) {
    for (const a of admitted) if (!CONTEXT_CATEGORIES.includes(a.category)) throw new ContractValidationError('invalid_category', 'admitted', a.category);
    if (admitted.length > budgets.max_items) throw new ContractValidationError('budget_exceeded', 'admitted', 'item budget');
    const body = { admitted: admitted.map(a => ({ category: a.category, item_ref: a.ref, reason: a.reason })), budgets, excluded: excluded.map(e => ({ item_ref: e.ref, reason: e.reason })), memory_is_not_truth: true, request_contract: toReference(rc.metadata), task_step: step };
    return { metadata: createContractMetadata({ contract_type: 'ContextManifest', body, created_at, authority_status: 'none' }), body }; }
  /* ===== forge2 capability_requirement.py (provider-neutral) ===== */
  const FORBIDDEN_PROVIDER_FIELDS = ['provider', 'package', 'tool', 'executable', 'command', 'endpoint', 'adapter', 'provider_version', 'ranking'];
  function createCapabilityRequirement(rc, cm, req, created_at) { for (const f of FORBIDDEN_PROVIDER_FIELDS) if (f in req) throw new ContractValidationError('provider_identity_forbidden', f, 'CapabilityRequirement is provider-neutral');
    const body = { acceptance_criteria: req.acceptance_criteria, context_manifest: toReference(cm.metadata), request_contract: toReference(rc.metadata), required_behavior: req.required_behavior, required_properties: req.required_properties || [], side_effect_class: req.side_effect_class, statement_refs: req.statement_refs, uncertainty_codes: rc.body.uncertainty_codes };
    return { metadata: createContractMetadata({ contract_type: 'CapabilityRequirement', body, created_at, authority_status: 'none' }), body }; }

  /* ===== forge verbal_cognition_gate_runtime evaluators (Slices 40C–40G) ===== */
  const gateId = (fam, x) => stableIdentifier('aiweb.gate-' + fam, x);
  function evaluateExpectancy(reqs, obs) { let sat = 0, miss = 0, opt = 0, ind = 0; const findings = [];
    for (const r of reqs) { const o = obs[r.id] || { authority_state: 'absent', observed_count: 0 };
      if (o.authority_state !== 'admitted') { ind++; findings.push({ requirement: r.id, kind: 'indeterminate_required_authority_absent' }); continue; }
      if (o.observed_count >= r.minimum_count) { if (r.kind !== 'optional_detail') sat++; continue; }
      if (r.kind === 'optional_detail') { opt++; findings.push({ requirement: r.id, kind: 'optional_detail_omitted' }); } else { miss++; findings.push({ requirement: r.id, kind: r.kind + '_missing' }); } }
    const overall = ind ? 'expectancy_indeterminate' : miss ? 'expectancy_incomplete' : 'structurally_complete_for_expectancy'; if (!ind && !miss) findings.push({ kind: 'structurally_complete_for_expectancy' });
    return { family: 'expectancy', overall_state: overall, findings, counts: { satisfied_required: sat, missing_required: miss, optional_omitted: opt, indeterminate: ind }, deterministic: true, candidate_structure_mutated: false }; }
  function evalAssertions(fam, assertions, okJ, badJ, states) { const counts = { ok: 0, bad: 0, ambiguous: 0, unsupported: 0, conflicted: 0, indeterminate: 0 }; const findings = [];
    for (const a of assertions) { const st = a.authority_state; let k;
      if (st === 'admitted') { if (a.judgment === okJ) { counts.ok++; k = okJ + '_assertion'; } else { counts.bad++; k = badJ + '_assertion'; } }
      else if (st === 'ambiguous') { counts.ambiguous++; k = 'ambiguous_assertion'; } else if (st === 'unsupported') { counts.unsupported++; k = 'unsupported_assertion'; } else if (st === 'conflicted') { counts.conflicted++; k = 'conflicted_assertion'; } else { counts.indeterminate++; k = 'indeterminate_authority_absent'; }
      findings.push({ assertion: a.kind, kind: k, note: a.note || '' }); }
    const overall = counts.conflicted ? states.conflicted : counts.unsupported ? states.unsupported : counts.ambiguous ? states.ambiguous : counts.indeterminate ? states.indeterminate : counts.bad ? states.bad : states.ok;
    return { family: fam, overall_state: overall, findings, counts, deterministic: true }; }
  const evaluateCongruity = as => evalAssertions('congruity', as, 'compatible', 'incompatible', { ok: 'congruity_compatible', bad: 'congruity_incompatible', ambiguous: 'congruity_ambiguous', unsupported: 'congruity_unsupported', conflicted: 'congruity_conflicted', indeterminate: 'congruity_indeterminate' });
  const evaluateConnectedness = as => evalAssertions('connectedness', as, 'connected', 'disconnected', { ok: 'connectedness_connected', bad: 'connectedness_disconnected', ambiguous: 'connectedness_ambiguous', unsupported: 'connectedness_unsupported', conflicted: 'connectedness_conflicted', indeterminate: 'connectedness_indeterminate' });
  const evaluateRecoverablePurpose = as => evalAssertions('recoverable_purpose', as, 'recoverable', 'unrecoverable', { ok: 'recoverable_purpose_recoverable', bad: 'recoverable_purpose_unrecoverable', ambiguous: 'recoverable_purpose_ambiguous', unsupported: 'recoverable_purpose_unsupported', conflicted: 'recoverable_purpose_conflicted', indeterminate: 'recoverable_purpose_indeterminate' });
  const DISPOSITIONS = ['candidate_supported_for_later_selection_review', 'material_ambiguity_preserved', 'clarification_relevant', 'unsupported', 'refusal_relevant', 'held', 'blocked_progression'];
  function composeGates(familyResults, dispositionAssertions) { // gate_composition/evaluator.py
    const states = new Set(dispositionAssertions.map(a => a.authority_state));
    const status = states.has('conflicted') ? 'conflicted_authority' : states.has('unsupported') ? 'unsupported_authority' : states.has('ambiguous') ? 'ambiguous_authority' : states.has('absent') ? 'indeterminate_authority' : 'composed';
    const dc = {}; DISPOSITIONS.forEach(d => { dc[d] = 0; }); const ac = { ambiguous: 0, unsupported: 0, conflicted: 0, absent: 0 };
    for (const a of dispositionAssertions) { if (a.authority_state === 'admitted' && a.judgment === 'applies') dc[a.disposition_kind]++; else if (a.authority_state in ac) ac[a.authority_state]++; }
    return { composition_status: status, family_results: familyResults.map(f => ({ family: f.family, overall_state: f.overall_state })), dispositions: Object.keys(dc).filter(k => dc[k]), disposition_counts: dc, authority_counts: ac, all_family_results_preserved: familyResults.length === 4 }; }
  function determineEligibility(comp, explicitPositive) { // selected_meaning_runtime/eligibility_evaluation/evaluator.py determine_outcome
    const d = comp.disposition_counts, a = comp.authority_counts;
    if (comp.composition_status === 'conflicted_authority' || a.conflicted) return 'conflicted';
    if (comp.composition_status === 'unsupported_authority' || a.unsupported || d.unsupported) return 'unsupported';
    if (d.clarification_relevant) return 'clarification_dependent';
    if (comp.composition_status === 'ambiguous_authority' || a.ambiguous || d.material_ambiguity_preserved) return 'materially_unresolved';
    if (d.held || d.blocked_progression || d.refusal_relevant) return 'held_pending_authority';
    if (comp.composition_status === 'indeterminate_authority' || a.absent) return 'indeterminate';
    if (d.candidate_supported_for_later_selection_review && explicitPositive) return 'eligible_for_selected_meaning_construction';
    return 'indeterminate'; }

  /* ===== forge meaning_structure_manifest (MSM-v1) ===== */
  const MSM_IDS = { package_id: 'aiweb-forge-meaning-structure-manifest', schema_id: 'aiweb-forge-meaning-structure-manifest-v1', schema_version: 'MSM-v1', authority_document: 'Document 2 of 10 - MeaningStructureManifest v1' };
  const PRESERVATION = ['negation', 'uncertainty_and_claim_strength', 'modality_and_conditional_scope', 'time_and_operational_status', 'evidence_boundary', 'permission_versus_request', 'privacy_and_identity_boundary', 'refusal_and_containment_boundary', 'unresolved_ambiguity', 'memory_boundary', 'economic_and_ledger_boundary', 'non_llm_provenance'];
  const NON_SELECTION = ['unresolved', 'clarification_required', 'refused', 'unsupported', 'authority_blocked'];

  /* ===== forge MEA fixed_point_math_contract.py ===== */
  const UNIT_SCALE = 1000000, WEIGHT_SCALE = 10000; const POS = ['R', 'P', 'U', 'N', 'I', 'Omega', 'A'], PEN = ['D', 'B', 'K'];
  const WEIGHTS = { research_synthesis: { R: 1000, P: 1300, U: 700, N: 500, I: 2000, Omega: 1600, A: 1400, D: 1600, B: 2300, K: 500 }, coding_verification: { R: 900, P: 1700, U: 900, N: 250, I: 1600, Omega: 1500, A: 1100, D: 2300, B: 2700, K: 900 }, theory_exploration: { R: 900, P: 1100, U: 600, N: 1100, I: 2300, Omega: 1200, A: 1000, D: 1300, B: 1900, K: 300 }, memory_recall: { R: 2500, P: 1000, U: 300, N: 0, I: 0, Omega: 0, A: 1500, D: 1500, B: 1300, K: 300 }, safety_critical: { R: 1000, P: 2000, U: 500, N: 100, I: 1300, Omega: 1500, A: 900, D: 3000, B: 3500, K: 800 } };
  function meaScore(terms_micro, mode) { mode = mode || 'research_synthesis'; const w = WEIGHTS[mode]; if (!w) throw new Error('unknown MEA mode ' + mode);
    for (const t of POS.concat(PEN)) { const v = terms_micro[t]; if (!Number.isInteger(v) || v < 0 || v > UNIT_SCALE) throw new Error(t + ' must be integer micro-units in [0, ' + UNIT_SCALE + ']'); }
    const pos = {}, pen = {}; POS.forEach(t => { pos[t] = terms_micro[t] * w[t]; }); PEN.forEach(t => { pen[t] = terms_micro[t] * w[t]; });
    const ptot = POS.reduce((s, t) => s + pos[t], 0), ntot = PEN.reduce((s, t) => s + pen[t], 0), signed = ptot - ntot;
    const scaled = signed / (UNIT_SCALE * WEIGHT_SCALE); const q = Math.round(Math.abs(scaled) * 1e6) / 1e6 * Math.sign(scaled); // ROUND_HALF_UP on the absolute value
    return { mode, terms_micro, weights_bps: w, positive_total: ptot, penalty_total: ntot, signed_score_micro_bps: signed, signed_score_decimal_text: q.toFixed(6), equation: 'S = Σ w·{R,P,U,N,I,Ω,A} − Σ w·{D,B,K} (MEA master equation, governed integers)' }; }
  const EVIDENCE_TIERS = ['external_empirical_measurement', 'external_peer_reviewed_derivation', 'internal_verified_trace', 'internal_theory_ancestry', 'operator_derivation_unvalidated', 'unsourced_assertion'];

  /* ===== forge GP-014 symbolic math expression lexicon (verbatim data) ===== */
  const GP014 = { schema_version: 'aiweb_symbolic_math_expression_lexicon_v1_gp014', authority_class: 'BOUNDED_VERSIONED_EXPRESSION_LEXICON_NOT_CORPUS', forbidden_claim_fragments: ['proven scientifically', 'empirically confirmed', 'proves that reality', 'law of nature'],
    operator_roles: [{ glyph: '⧙', render_role: 'lock_required_meaning_atoms' }, { glyph: '⟁', render_role: 'merge_locked_atoms_into_clause_tree' }, { glyph: 'ΔΦ', render_role: 'measure_clause_transition_order' }, { glyph: '⧧', render_role: 'sever_candidates_that_lose_meaning_or_overclaim' }, { glyph: '⧀', render_role: 'discharge_rejected_candidates_without_delivery' }] };
  /* GP-014 operator roles applied to the DERIVED reply (no phrase templates): ⧙ lock the meaning atoms; ⟁ the vākya produced by derive.js merges them
     into one clause tree; ΔΦ the derivation's phase trail gives the order; ⧧ severs the output if an atom is lost or an overclaim fragment appears; ⧀ nothing to discharge (one derivation). */
  function gp014Check(family, atoms, derived) { const locked = { expression: atoms.expression, answer: atoms.answer, variable: atoms.variable || '' }; const text = derived && derived.text || '';
    const lost = ['expression', 'answer'].filter(k => locked[k] && !text.includes(locked[k])); const over = GP014.forbidden_claim_fragments.filter(f => text.toLowerCase().includes(f));
    const severed = lost.length || over.length ? [{ id: family, reason: lost.length ? 'lost atoms: ' + lost.join(',') : 'overclaim' }] : [];
    return { family, locked_atoms: locked, phase_trail: derived && derived.derivation ? derived.derivation.phase_trail : null, severed, selected: severed.length ? null : { id: family, text }, discharged: [], rule: 'GP-014 operator roles over the derivation: ⧙ lock → ⟁ merge (derive.js vākya) → ΔΦ phase order → ⧧ sever check → ⧀ none' }; }

  /* ===== agents/forge/llm_authority.py LEGACY_FORGE_LLM_COMMANDS + deterministic replacements ===== */
  const LEGACY_LLM = ['llm-engine-review-model-test', 'llm-engine-review-draft', 'llm-engine-review-batch-next', 'llm-engine-review-batch-run', 'llm-live-draft', 'generic-repair-llm', 'generic-repair-candidate-build', 'generic-repair-candidate-verify', 'generic-repair-review-llm', 'generic-repair-review-verify', 'generic-repair-sandbox-plan', 'generic-repair-sandbox-run', 'generic-sandbox-dependency-plan', 'generic-sandbox-dependency-run', 'generic-revision-llm', 'generic-revision-candidate-build', 'generic-revision-candidate-verify', 'generic-revision-sandbox-plan', 'generic-revision-sandbox-run', 'generic-revision-loop-llm', 'generic-revision-loop-candidate', 'forge-command-implement', 'forge-command-implement-review', 'forge-command-implement-write', 'forge-command-implement-install', 'forge-tool-wrap', 'forge-tool-wrap-install', 'forge-self-suggest'];
  const LEGACY_REPLACEMENT = { // deterministic, lawful replacements where one exists; otherwise explicit refusal with reason
    'forge-self-suggest': { kind: 'replaced', lane: 'SELF_REPORT', by: 'deterministic self-report: lists unknown words, held/ambiguous turns and echo failures from the receipt log (no generation)' },
    'llm-engine-review-draft': { kind: 'replaced', lane: 'ECHO_REVIEW', by: 'Echo structural re-derivation of the last reply (review = re-parse + material comparison)' },
    'generic-repair-candidate-verify': { kind: 'replaced', lane: 'VERIFY_SUITE', by: 'Doc 9 verification suite (deterministic)' }, 'generic-revision-candidate-verify': { kind: 'replaced', lane: 'VERIFY_SUITE', by: 'Doc 9 verification suite (deterministic)' }, 'generic-repair-review-verify': { kind: 'replaced', lane: 'VERIFY_SUITE', by: 'Doc 9 verification suite (deterministic)' } };
  const LLM_REFUSAL = 'FORGE_LLM_AUTHORITY_REMOVED_USE_EXPLICIT_ECHOFORGE';
  function legacyCommand(text) { const m = String(text).trim().toLowerCase().match(/^([a-z][a-z0-9-]+)(?:\s|$)/); if (!m) return null; if (m[1] === 'echoforge-advisory') return { command: m[1], kind: 'disabled', reason: 'the echoforge-advisory command is the LLM lane; this build contains no language model; EchoForge here is the no-LLM tool bench' };
    if (!LEGACY_LLM.includes(m[1])) return null; const r = LEGACY_REPLACEMENT[m[1]]; return Object.assign({ command: m[1], refusal_code: LLM_REFUSAL }, r || { kind: 'refused', reason: 'this command required a language model to generate code, drafts or reviews; Forge removed that authority and no deterministic replacement can lawfully generate it' }); }

  const api = { canonicalize, canonicalJson, canonicalSha256, stableIdentifier, utc, CanonicalizationError, ContractValidationError, LIFECYCLE, AUTHORITY, EFFECTS, createContractMetadata, verifyContractMetadata, toReference, validateSuccessor,
    REQUEST_STATES, stateIdentity, stateRegistryId, TRANSITION_POLICY_DEFINED, createInputEvent, decodeInputEvent, DIMENSIONS, featureEvidence, candidate, createCandidateSet, createRequestContract, createContextManifest, createCapabilityRequirement, CONTEXT_CATEGORIES,
    evaluateExpectancy, evaluateCongruity, evaluateConnectedness, evaluateRecoverablePurpose, composeGates, determineEligibility, DISPOSITIONS, gateId,
    MSM_IDS, PRESERVATION, NON_SELECTION, meaScore, WEIGHTS, EVIDENCE_TIERS, GP014, gp014Check, LEGACY_LLM, legacyCommand, LLM_REFUSAL };
  if (isNode) module.exports = api; else root.KSpine = api;
})(typeof self !== 'undefined' ? self : this);
