/* msm.js — K3 + K4 (4.9.69): MeaningStructureManifest v1 completion (KERNEL_COMPONENTS_SPEC §4, Appendix R — a RECONSTRUCTION of Doc 2 from forge
 * Slices 35A–35E). Adds what forge-mobile lacked:
 *   - the lifecycle transition LAW (Slice 35C): exactly 31 lawful (from_state → to_state) rules with their transition kinds and authority flags;
 *     every lawful transition appends exactly one SemanticTransitionTrace; records are never mutated; correction / supersession are a new
 *     same-kind, same-state successor that must differ substantively; anything else is rejected with an issue code;
 *   - canonical serialization (Slice 35D): one versioned envelope, canonical strict JSON (sorted keys, no whitespace, NFC, integers only),
 *     validation before encoding and after decoding, non-canonical bytes / duplicate names / unknown fields / unknown versions rejected,
 *     byte-for-byte round trip;
 *   - the turn path's real MSM-v1 records (buildTurn): LineageRoot → CandidateMeaning(s) → SelectedGovernedMeaning or NonSelectionOutcome →
 *     GovernedOutwardMeaning → ExpressionLink → ValidationLink (Echo) → Delivery / Containment link, each step through the law.
 * MSM owns meaning and semantic ancestry only: selection, Echo, memory and delivery appear as ExternalAuthorityReferences, never exercised.
 * Deterministic: same inputs, same bytes. No weights, no model. */
(function (root) {
const isNode = typeof module !== 'undefined' && module.exports;
const H = isNode ? require('./sha256.js') : root.KSha;
const SP = () => (isNode ? require('./forge_spine.js') : root.KSpine); /* forge 35B validator port (lazy: loaded after the kernel in the browser) */
const IDS = Object.freeze({ package_id: 'aiweb-forge-meaning-structure-manifest', schema_id: 'aiweb-forge-meaning-structure-manifest-v1', schema_version: 'MSM-v1' });
const ENVELOPE = Object.freeze({ envelope_id: 'aiweb-forge-msm-envelope', envelope_version: 1 });
const PRESERVATION = Object.freeze(['negation', 'uncertainty_and_claim_strength', 'modality_and_conditional_scope', 'time_and_operational_status', 'evidence_boundary', 'action_proposal_simulation_and_observation', 'permission_versus_request', 'privacy_and_identity_boundary', 'refusal_and_containment_boundary', 'unresolved_ambiguity', 'memory_boundary', 'economic_and_ledger_boundary', 'non_llm_provenance']);
/* Slice 35C LIFECYCLE_TRANSITION_RULES: [from, to, kinds, authority_required] — exactly 31 */
const R_ = (f, t, k, a) => Object.freeze({ from: f, to: t, kinds: Object.freeze(k.split(' ')), authority: a });
const RULES = Object.freeze([
  R_('lineage_origin', 'candidate_meaning', 'ancestry', false),
  R_('lineage_origin', 'unresolved', 'ancestry', true), R_('lineage_origin', 'clarification_required', 'ancestry', true), R_('lineage_origin', 'unsupported', 'ancestry', true), R_('lineage_origin', 'governed_outward_meaning', 'ancestry', true),
  R_('candidate_meaning', 'unresolved', 'ancestry', true), R_('candidate_meaning', 'clarification_required', 'ancestry', true),
  R_('candidate_meaning', 'refused', 'rejection', true), R_('candidate_meaning', 'unsupported', 'rejection', true),
  R_('candidate_meaning', 'authority_blocked', 'ancestry', true), R_('candidate_meaning', 'selected_governed_meaning', 'ancestry', true),
  R_('unresolved', 'candidate_meaning', 'ancestry narrowing', true), R_('clarification_required', 'candidate_meaning', 'narrowing', true), R_('unsupported', 'candidate_meaning', 'ancestry narrowing', true), R_('refused', 'candidate_meaning', 'narrowing', true),
  R_('authority_blocked', 'selected_governed_meaning', 'ancestry', true),
  R_('unresolved', 'governed_outward_meaning', 'ancestry', true), R_('clarification_required', 'governed_outward_meaning', 'ancestry', true), R_('refused', 'governed_outward_meaning', 'ancestry', true), R_('unsupported', 'governed_outward_meaning', 'ancestry', true), R_('authority_blocked', 'governed_outward_meaning', 'ancestry', true),
  R_('selected_governed_meaning', 'refused', 'rejection', true),
  R_('selected_governed_meaning', 'authority_blocked', 'ancestry', true), R_('selected_governed_meaning', 'governed_result_referenced', 'ancestry', true), R_('selected_governed_meaning', 'governed_outward_meaning', 'ancestry', true),
  R_('governed_result_referenced', 'governed_outward_meaning', 'ancestry', true),
  R_('governed_outward_meaning', 'expression_linked', 'ancestry', true),
  R_('expression_linked', 'validation_linked', 'ancestry', true), R_('expression_linked', 'containment_linked', 'containment', true),
  R_('validation_linked', 'delivery_linked', 'ancestry', true), R_('validation_linked', 'containment_linked', 'containment', true)]);
const COLL = Object.freeze({ candidate_meaning: 'candidate_meanings', non_selection_outcome: 'non_selection_outcomes', selected_governed_meaning: 'selected_governed_meanings', governed_result_reference: 'governed_result_references', governed_outward_meaning: 'governed_outward_meanings', expression_link: 'expression_links', validation_link: 'validation_links', delivery_or_containment_link: 'delivery_or_containment_links', external_authority_reference: 'external_authority_references', semantic_transition_trace: 'semantic_transition_traces' });
const COLLECTIONS = Object.freeze(Object.values(COLL));
const stateOf = r => r.record_kind === 'lineage_root' ? 'lineage_origin' : r.record_kind === 'non_selection_outcome' ? r.outcome_kind : r.record_kind === 'delivery_or_containment_link' ? r.disposition : r.lifecycle_state;
/* reconstructed Doc 2: action proposals, simulations, and observations. Not the forge2 draft/candidate contract edges. */
function observesAction(meaning, ctx) { const m = meaning || {}, k = String(m.kind || ''), c = ctx || {};
  if (c.intent === 'SIMULATE' || c.intent === 'CREATE' || c.intent === 'EXPLORE' || c.intent === 'COMPOSE') return true;
  if (/^suppose_/.test(k)) return true;
  if (k === 'blocked' || k === 'dream_held' || k === 'sim_result' || k === 'sim_replay') return true;
  if (/^(?:tool_|ede_|mea_p|mea_proposals|spc_proposal|must_archive|creative_|compose_)/.test(k)) return true;
  if (k === 'dynamics' && m.mode === 'whatif') return true;
  return /what_?if|predict|hypothes|observ/.test(k); }
/* canonical strict JSON (35D; forge2 profile): sorted keys, no whitespace, NFC strings, integers only */
function canon(v) { if (v === null) return 'null'; if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') { if (!Number.isSafeInteger(v)) throw new Error('float_rejected'); return String(v); } if (typeof v === 'string') return JSON.stringify(v.normalize('NFC'));
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']'; if (typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k.normalize('NFC')) + ':' + canon(v[k])).join(',') + '}';
  throw new Error('unsupported_type'); }
const freeze = o => { if (o && typeof o === 'object') { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
const clone = o => JSON.parse(JSON.stringify(o));
function create({ manifest_id, lineage_id, origin_ref, origin_kind, direction }) { const m = Object.assign({ manifest_id, record_kind: 'meaning_structure_manifest' }, IDS, {
    lineage_root: { record_kind: 'lineage_root', lineage_id, origin_ref, origin_kind: origin_kind || 'source_bound_human_expression', direction: direction || 'inward', lifecycle_state: 'lineage_origin' } });
  for (const c of COLLECTIONS) m[c] = []; return freeze(m); }
const find = (m, id) => id === m.lineage_root.lineage_id ? m.lineage_root : COLLECTIONS.map(c => m[c].find(r => r.record_id === id)).find(Boolean) || null;
const fail = (code, msg) => ({ ok: false, issue: { code, message: msg } });
/* append a record that needs no transition (external authority references) */
function reference(m, rec) { if (rec.record_kind !== 'external_authority_reference') return fail('record_kind_mismatch', 'only external authority references are appended without a transition');
  if (find(m, rec.record_id)) return fail('duplicate_record_id', rec.record_id); const n = clone(m); n.external_authority_references.push(Object.assign({ lineage_id: m.lineage_root.lineage_id }, rec)); return { ok: true, manifest: freeze(n) }; }
/* the law: move from an existing record to a NEW record through one of the 31 rules (or a correction / supersession successor) */
function transition(m, { from_ref, to, kind, reason, authority_ref }) {
  const from = find(m, from_ref); if (!from) return fail('unresolved_reference', from_ref); if (!to || !to.record_id || find(m, to.record_id)) return fail(to && to.record_id ? 'duplicate_record_id' : 'required_value_missing', 'to.record_id');
  const coll = COLL[to.record_kind]; if (!coll || coll === 'semantic_transition_traces' || coll === 'external_authority_references') return fail('record_kind_mismatch', String(to.record_kind));
  const fs = stateOf(from), ts = stateOf(to); if (!fs || !ts) return fail('lifecycle_state_mismatch', 'missing state');
  if (kind === 'correction' || kind === 'supersession') { if (from.record_kind !== to.record_kind || fs !== ts) return fail('illegal_transition', kind + ' needs a same-kind, same-state successor');
    const body = r => { const x = clone(r); delete x.record_id; delete x.lineage_id; return canon(x); }; /* identity fields excluded: the stored record carries lineage_id, the proposed successor does not yet */ if (body(from) === body(to)) return fail('illegal_transition', kind + ' successor is not substantive'); }
  else { const rule = RULES.find(r => r.from === fs && r.to === ts); if (!rule) return fail('illegal_transition', fs + ' → ' + ts + ' is not one of the 31 lawful transitions');
    if (!rule.kinds.includes(kind)) return fail('illegal_transition_kind', fs + ' → ' + ts + ' admits ' + rule.kinds.join('/') + ', not ' + kind);
    if (rule.authority) { const a = authority_ref && find(m, authority_ref); if (!a || a.record_kind !== 'external_authority_reference') return fail('authority_required', fs + ' → ' + ts + ' must name an external authority reference in this manifest'); } }
  if (authority_ref && !(find(m, authority_ref) || {}).record_kind) return fail('unresolved_reference', authority_ref);
  const n = clone(m), lin = m.lineage_root.lineage_id; n[coll].push(Object.assign({ lineage_id: lin }, to));
  n.semantic_transition_traces.push({ record_kind: 'semantic_transition_trace', record_id: 'stt:' + (n.semantic_transition_traces.length + 1) + ':' + to.record_id, lineage_id: lin, from_record_ref: from_ref, to_record_ref: to.record_id, from_state: fs, to_state: ts, transition_kind: kind, reason: reason || kind, authority_reference_ref: authority_ref || null });
  return { ok: true, manifest: freeze(n) }; }
function validate(m) { return SP().validateManifest(m); }
/* 35D: validate before encoding; one envelope; canonical bytes */
function encode(m) { const v = validate(m); if (!v.valid) return { ok: false, issues: v.issues }; return { ok: true, bytes: canon(Object.assign({}, ENVELOPE, { manifest: m })) }; }
function decode(bytes) { if (typeof bytes !== 'string') return { ok: false, issue: 'type_mismatch' }; let o; try { o = JSON.parse(bytes); } catch (e) { return { ok: false, issue: 'invalid_json' }; }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, issue: 'type_mismatch' };
  const keys = Object.keys(o).sort().join(','); if (keys !== 'envelope_id,envelope_version,manifest') return { ok: false, issue: 'unknown_or_missing_field' };
  if (o.envelope_id !== ENVELOPE.envelope_id) return { ok: false, issue: 'fixed_value_mismatch' }; if (o.envelope_version !== ENVELOPE.envelope_version) return { ok: false, issue: 'unknown_version (no migration)' };
  let re; try { re = canon(o); } catch (e) { return { ok: false, issue: String(e.message) }; } if (re !== bytes) return { ok: false, issue: 'non_canonical_bytes (whitespace, ordering, escaping, duplicate names or trailing data)' };
  const v = validate(o.manifest); if (!v.valid) return { ok: false, issue: 'validation_failed', issues: v.issues }; return { ok: true, manifest: freeze(o.manifest) }; }
const sha = m => H.sha256(canon(m));
/* preservation classes of a turn meaning (R.4 / Doc 1 §8): read off the meaning's own fields — no scoring */
function preservation(meaning, ctx) { const m = meaning || {}, c = m.clause || m.claim || null, v = c && c.verb || {}, k = String(m.kind || ''), out = new Set(['non_llm_provenance']);
  if (v.pol === 'neg' || m.answer === 'no' || /neg/.test(k)) out.add('negation'); if ((v.mod && v.mod !== 'asserted') || /hypothes|maybe|unconfirmed/.test(k) || m.answer === 'unconfirmed') out.add('uncertainty_and_claim_strength');
  if (c && c.cond) out.add('modality_and_conditional_scope'); if (v.tense === 'past' || v.tense === 'future' || /lifecycle|when|time|remind/.test(k)) out.add('time_and_operational_status');
  if ((ctx.evidence || []).length) out.add('evidence_boundary'); if (observesAction(meaning, ctx)) out.add('action_proposal_simulation_and_observation');
  if (ctx.act === 'request') out.add('permission_versus_request'); if (ctx.sensitive || /vault|sensitive|secret/.test(k)) out.add('privacy_and_identity_boundary');
  if (/refus|blocked|neg_act/.test(k) || ctx.blocked) out.add('refusal_and_containment_boundary'); if (/clarif|ambig|readings/.test(k)) out.add('unresolved_ambiguity');
  if (ctx.write || /recall|stored|noted|forget|remember|facts|assert_ack|working/.test(k)) out.add('memory_boundary'); if (/econ|ledger|credit|capsule/.test(k)) out.add('economic_and_ledger_boundary');
  return PRESERVATION.filter(p => out.has(p)); }
const NONSEL = { clarify: 'clarification_required', ambiguous: 'clarification_required', reject: 'refused', refuse: 'refused', unsupported: 'unsupported', blocked: 'authority_blocked' };
/* the turn's MSM-v1 manifest. t = { psi, turn, act, frame, outcome_category, outcome_class, meaning, candidates[{route,kind,frame,outcome}], evidence[], blocked, block_reason,
   sealed, quarantined, output (text or null), echo { pass, ambiguous } | null, write (bool), sensitive (bool), limitations[] } */
function buildTurn(t) { const id = String(t.psi).slice(0, 24), lin = 'lin:' + id; let m = create({ manifest_id: 'msm:' + id, lineage_id: lin, origin_ref: 'turn:' + t.turn });
  const step = r => { if (!r.ok) throw new Error('MSM law: ' + r.issue.code + ' — ' + r.issue.message); m = r.manifest; return r; };
  const ea = (rid, kind, ref, why) => step(reference(m, { record_kind: 'external_authority_reference', record_id: rid, authority_kind: kind, external_object_ref: ref, semantic_relevance: why }));
  ea('ea:input:' + id, 'parsed_question_or_typed_input', 'turn:' + t.turn, 'the parsed user turn');
  ea('ea:select:' + id, 'capability_contract_or_routing_admission', 'rmc.selection:' + t.turn, 'RMC candidate gates and selection (outside MSM)');
  const pcs = preservation(t.meaning, t), mods = [].concat(t.meaning && t.meaning.clause && t.meaning.clause.verb ? ['polarity:' + (t.meaning.clause.verb.pol || 'pos'), 'modality:' + (t.meaning.clause.verb.mod || 'asserted'), 'tense:' + (t.meaning.clause.verb.tense || 'present')] : []);
  const cands = (t.candidates && t.candidates.length ? t.candidates : [{ route: 'turn', kind: (t.meaning || {}).kind, frame: t.frame, outcome: t.outcome_category }]).slice(0, 8);
  const cid = cands.map((c, i) => 'cm:' + (i + 1) + ':' + id);
  cands.forEach((c, i) => step(transition(m, { from_ref: lin, kind: 'ancestry', reason: 'candidate from route ' + (c.route || c.frame || 'turn'), to: { record_kind: 'candidate_meaning', record_id: cid[i], lifecycle_state: 'candidate_meaning', source_expression_ref: 'turn:' + t.turn, communicative_act: String(t.act || 'unknown'), concept_refs: [String(c.kind || (t.meaning || {}).kind || 'none')], relation_refs: [String(c.frame || t.frame || 'none')], meaning_modifiers: mods, ambiguity_reasons: /clarif|ambig/.test(String(c.kind || '')) ? ['ambiguity preserved'] : [], unresolved_referents: [], authority_sensitive_implications: t.write ? ['memory write requested'] : [], preservation_classes: pcs } })));
  const wsel = cands.findIndex(c => c.selected), winner = cid[Math.max(0, wsel >= 0 ? wsel : cands.findIndex(c => c.outcome === t.outcome_category && (!c.kind || c.kind === (t.meaning || {}).kind)))];
  let basis;
  if (t.outcome_class === 'selected' && !t.blocked) {
    step(transition(m, { from_ref: winner, kind: 'ancestry', authority_ref: 'ea:select:' + id, reason: 'selected by the RMC gates', to: { record_kind: 'selected_governed_meaning', record_id: 'sgm:' + id, lifecycle_state: 'selected_governed_meaning', selected_candidate_ref: winner, selection_authority_ref: 'ea:select:' + id, communicative_act: String(t.act || 'unknown'), concept_refs: [String((t.meaning || {}).kind || 'none')], relation_refs: [String(t.frame || 'none')], meaning_modifiers: mods, inherited_limitations: (t.limitations || []).map(String), authority_sensitive_distinctions: t.write ? ['memory write'] : [], preservation_classes: pcs } }));
    basis = 'sgm:' + id; }
  else { const nk = t.blocked ? 'authority_blocked' : NONSEL[t.outcome_class] || 'unresolved', kind = nk === 'refused' || nk === 'unsupported' ? 'rejection' : 'ancestry';
    step(transition(m, { from_ref: winner, kind, authority_ref: 'ea:select:' + id, reason: t.block_reason ? String(t.block_reason).slice(0, 160) : 'not selected: ' + String(t.outcome_category), to: { record_kind: 'non_selection_outcome', record_id: 'nso:' + id, outcome_kind: nk, candidate_refs: cid, reasons: [String(t.block_reason || t.outcome_category || nk).slice(0, 200)], required_clarifications: nk === 'clarification_required' ? [String((t.meaning || {}).kind || 'clarification')] : [], external_authority_refs: ['ea:select:' + id] } }));
    basis = 'nso:' + id; }
  const echoHeld = !!(t.echo && t.echo.disposition && t.echo.disposition !== 'PASSED'); /* R-ECHO-5: a failed Echo still gets its ValidationLink (the contained surface is linked, never delivered) */
  if (t.output == null && !echoHeld) return { manifest: m, selected_ref: basis.startsWith('sgm:') ? basis : null, non_selection_ref: basis.startsWith('nso:') ? basis : null, outward_ref: null };
  ea('ea:render:' + id, 'render_preview_or_output_object', 'output:' + t.turn, 'the derived surface (render authority outside MSM)');
  step(transition(m, { from_ref: basis, kind: 'ancestry', authority_ref: 'ea:render:' + id, reason: basis.startsWith('nso:') ? 'lawful outward explanation of a non-selection' : 'outward meaning of the selected meaning', to: { record_kind: 'governed_outward_meaning', record_id: 'gom:' + id, lifecycle_state: 'governed_outward_meaning', outward_basis_refs: [basis], prior_selected_meaning_ref: basis.startsWith('sgm:') ? basis : null, permitted_claims: [String((t.meaning || {}).kind || 'none')], required_qualifications: (t.limitations || []).map(String), prohibited_enlargements: ['claim_strengthening', 'scope_expansion', 'certainty_upgrade', 'evidence_status_upgrade'], external_dependency_refs: ['ea:render:' + id], preservation_classes: pcs } }));
  step(transition(m, { from_ref: 'gom:' + id, kind: 'ancestry', authority_ref: 'ea:render:' + id, reason: 'expression derived', to: { record_kind: 'expression_link', record_id: 'exl:' + id, lifecycle_state: 'expression_linked', governed_outward_meaning_ref: 'gom:' + id, expression_candidate_ref: 'output:' + t.turn } }));
  if (!t.echo) return { manifest: m, selected_ref: basis.startsWith('sgm:') ? basis : null, non_selection_ref: basis.startsWith('nso:') ? basis : null, outward_ref: 'gom:' + id };
  ea('ea:echo:' + id, 'rmc_echo_validator_receipt', 'echo:' + t.turn, 'deterministic RMC Echo disposition (owned by Echo)'); ea('ea:delivery:' + id, 'delivery_or_containment_receipt', 'delivery:' + t.turn, 'delivery or containment receipt');
  const disp = t.echo.disposition || (t.echo.pass ? 'PASSED' : t.echo.ambiguous ? 'CONTAINED' : 'REJECTED');
  /* R-ECHO-5 (43G): every Echo — passing or failing — creates one ValidationLink carrying its disposition; delivery follows only PASSED */
  step(transition(m, { from_ref: 'exl:' + id, kind: 'ancestry', authority_ref: 'ea:echo:' + id, reason: 'Echo ' + disp, to: { record_kind: 'validation_link', record_id: 'val:' + id, lifecycle_state: 'validation_linked', expression_link_ref: 'exl:' + id, external_validation_receipt_ref: 'ea:echo:' + id, external_validation_disposition: disp } }));
  const held = disp !== 'PASSED' || t.sealed || t.quarantined;
  step(transition(m, { from_ref: 'val:' + id, kind: held ? 'containment' : 'ancestry', authority_ref: held && disp !== 'PASSED' ? 'ea:echo:' + id : 'ea:delivery:' + id, reason: disp !== 'PASSED' ? 'Echo ' + disp + ': output contained, not delivered' : held ? 'held in containment' : 'delivered', to: { record_kind: 'delivery_or_containment_link', record_id: 'dcl:' + id, disposition: held ? 'containment_linked' : 'delivery_linked', prior_link_ref: 'val:' + id, external_receipt_ref: held && disp !== 'PASSED' ? 'ea:echo:' + id : 'ea:delivery:' + id } }));
  return { manifest: m, selected_ref: basis.startsWith('sgm:') ? basis : null, non_selection_ref: basis.startsWith('nso:') ? basis : null, outward_ref: 'gom:' + id }; }
/* ---- K4: the RMC projection manifest μ_t (RMC App D; KERNEL_COMPONENTS_SPEC §5 R-MAN-1..4) ----
   One per turn, built from the turn's trace BEFORE any rendering; source_trace_id is mandatory (D.4 rule 1). No floats invented:
   confidence is integer basis points only for exact / proved results, otherwise null with its basis (CONFLICTS #3). */
const PROJECTION_SCHEMA_VERSION = '1.0.0'; /* D.8 semver: shape changes bump the version; older manifests go through compatProjection */
const PROJECTION_STATUSES = Object.freeze(['approved', 'correction_required', 'archive_required', 'projection_blocked', 'catastrophic_block']);
const BLOCKING = Object.freeze(PROJECTION_STATUSES.slice(1)); /* D.4 rule 4 */
const PUBLIC_TARGETS = Object.freeze(['speech', 'json', 'code.js', 'code.py', 'glyph', 'field', 'tone', 'dashboard', 'api']); /* everything except the private text reply and on-device memory */
const DERIVATION_BOUND = /^(?:GP014-(?!REFUSED)|ALG-|CALC-(?!REFUSED|NUMERIC))/; /* exact-lane rule families (exact rationals, symbolic calculus, verified substitution); CALC-NUMERIC is approximate and excluded */
function projectionStatus(t) { /* t: { band, sealed, forbidden, quarantined, correction_held, blocked } — drift.status first (D.4 rule 4), then the turn's own block */
  if (t.sealed || t.forbidden || t.band === 'hard_stop') return 'catastrophic_block';
  if (t.quarantined || t.band === 'elevated') return 'archive_required';
  if (t.correction_held) return 'correction_required';
  if (t.blocked) return 'projection_blocked';
  return 'approved'; }
/* t = { psi, turn, at, act, frame, input_sha256, outcome_category, meaning, phases[], ops[], rules[], evidence[{id,mu,eps}], eps_s, band, sealed, forbidden,
   quarantined, correction_held, blocked, sensitive, limitations[], forms[], msm_ref{manifest_id,sha}|null } */
function projection(t) { const status = projectionStatus(t), k = String((t.meaning || {}).kind || 'none');
  const exact = status === 'approved' && t.outcome_category === 'SELECTED_MEANING' && (t.rules || []).some(id => DERIVATION_BOUND.test(id));
  const targets = status !== 'approved' ? [] : t.sensitive ? ['text'] : (t.forms || ['text']).slice();
  const lim = [].concat((t.limitations || []).map(String), t.sensitive ? ['private: never rendered to a public target (D.4 rule 3)'] : [], status !== 'approved' ? ['projection ' + status] : []);
  return { manifest_id: 'mu:' + String(t.psi).slice(0, 24), schema_version: PROJECTION_SCHEMA_VERSION, source_trace_id: 'trace:' + t.turn, msm_ref: t.msm_ref || null,
    input_summary: { act: String(t.act || 'unknown'), frame: String(t.frame || 'none'), input_sha256: t.input_sha256 || null },
    selected_conclusion: { outcome: String(t.outcome_category || 'none'), kind: k },
    claim: { kind: k, required_limitations: lim, forbidden_claims: (SP().GP014 || {}).forbidden_claim_fragments ? SP().GP014.forbidden_claim_fragments.slice() : [] },
    phase_path: (t.phases || []).slice(), operator_path: (t.ops || []).slice(),
    memory_links: (t.evidence || []).map(e => ({ id: e.id, source_confidence: { mu: e.mu, eps: e.eps } })), /* D.4 rule 9: the source's own figures, unchanged */
    confidence_bps: exact ? 10000 : null, confidence_basis: exact ? 'exact derivation / proof (' + t.rules.filter(id => DERIVATION_BOUND.test(id)).slice(0, 3).join(', ') + ')' : 'not an exact or proved result: no confidence number is invented',
    drift_score: t.eps_s, drift_status: status === 'approved' ? 'projectable' : status,
    novelty_score: t.novelty && t.novelty.score != null ? t.novelty.score : null, novelty_class: t.novelty ? t.novelty.class : 'not_measured', /* K5: recorded, never an approval (D.4 rule 5) */
    projection_status: status, render_targets: targets,
    validation_requirements: { echo_required: true, echo_threshold: 'structural_identity', schema_validation_required: true, human_review_required: status === 'correction_required' },
    visibility: t.sensitive ? 'private' : 'user', created_at: t.at }; }
/* D.8: a stored trace from before 4.9.69 has no μ_t. It is never reconstructed into an authoritative manifest (D.4 rule 1). */
function compatProjection(tr) { return tr && tr.output_manifest ? tr.output_manifest : null; }
/* D.7 validation order: schema → source trace → target ∈ render_targets → projection_status not blocked → visibility/privacy → drift.status → approve */
function validateProjection(om, target) { const no = (step, why) => ({ ok: false, step, why });
  if (!om || typeof om !== 'object') return no('schema', 'no projection manifest (pre-4.9.69 trace or none built): no rendering without projection_status (D.4 rule 2)');
  if (typeof om.schema_version !== 'string' || om.schema_version.split('.')[0] !== PROJECTION_SCHEMA_VERSION.split('.')[0]) return no('schema', 'unknown projection schema version ' + om.schema_version);
  for (const f of ['manifest_id', 'projection_status', 'render_targets', 'phase_path', 'operator_path', 'created_at']) if (!(f in om)) return no('schema', 'missing field ' + f);
  if (!PROJECTION_STATUSES.includes(om.projection_status)) return no('schema', 'projection_status is not one of ' + PROJECTION_STATUSES.join('/'));
  if (!/^trace:\d+$/.test(String(om.source_trace_id || ''))) return no('source_trace', 'no source_trace_id (D.4 rule 1)');
  if (!om.render_targets.includes(target)) return no('target', target + ' is not in render_targets [' + om.render_targets.join(', ') + '] (D.4 rule 8)');
  if (BLOCKING.includes(om.projection_status)) return no('projection_status', 'projection ' + om.projection_status + ' (D.4 rule 4)');
  if (om.visibility === 'private' && PUBLIC_TARGETS.includes(target)) return no('visibility', 'private memory never renders to a public target (D.4 rule 3)');
  if (om.drift_status !== 'projectable') return no('drift_status', 'drift status ' + om.drift_status);
  return { ok: true, step: 'approve' }; }
const api = { IDS, ENVELOPE, PRESERVATION, RULES, COLLECTIONS, create, reference, transition, validate, encode, decode, canon, sha, buildTurn, preservation, observesAction, find, stateOf,
  PROJECTION_SCHEMA_VERSION, PROJECTION_STATUSES, PUBLIC_TARGETS, projectionStatus, projection, compatProjection, validateProjection };
if (isNode) module.exports = api; else root.KMSM = api;
})(typeof self !== 'undefined' ? self : this);
