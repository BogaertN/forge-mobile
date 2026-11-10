/* echo_types.js — K6 (4.9.70): typed results for the deterministic RMC Echo (KERNEL_COMPONENTS_SPEC §6 R-ECHO-2..5; forge Slices 43D–43G).
 * Structural identity (CONFLICTS #9) stays the ONLY pass condition: this module never passes or fails anything on its own. It types the
 * existing structural comparison: the planned vākya (want) against the inward-grammar analyses of the surface (got), and reports
 *   - 13 MeaningPreservationDimension findings ∈ {preserved, changed, missing, unsupported, conflicted, indeterminate},
 *   - drift findings over the 17 DriftKinds with materiality, and one classification state,
 *   - one disposition: PASSED (all material obligations pass) / REJECTED (deterministic Echo-law violation) / CONTAINED (incomplete authority:
 *     the surface is ambiguous and the turn is lawfully held for clarification), with its custody record.
 * Input is structures only (planned and analysed vākya, Echo components): raw text is never an input (raw_text_prohibited).
 * The key → dimension / drift-kind crosswalk below is a RECONSTRUCTION (forge 43D/43E name the kinds; the mapping onto vākya keys is ours). */
(function (root) {
'use strict';
const DIMENSIONS = Object.freeze(['semantic_content', 'communicative_purpose', 'claim_status', 'scope', 'certainty', 'evidence_status', 'caveats_and_limitations', 'refusal_state', 'unresolved_conditions', 'action_status', 'memory_status', 'delivery_status', 'required_next_step_or_hold_status']);
const FINDINGS = Object.freeze(['preserved', 'changed', 'missing', 'unsupported', 'conflicted', 'indeterminate']);
const DRIFT_KINDS = Object.freeze(['omitted_meaning', 'claim_strengthening', 'scope_expansion', 'certainty_upgrade', 'evidence_status_upgrade', 'caveat_omission', 'refusal_softening', 'ambiguity_erasure', 'unresolved_state_erasure', 'invented_fact', 'invented_evidence', 'authority_escalation', 'action_status_distortion', 'memory_status_distortion', 'delivery_status_distortion', 'ancestry_mismatch', 'unsupported_surface_addition']);
const MATERIALITY = Object.freeze(['not_applicable', 'non_material', 'material', 'unsupported', 'conflicted', 'indeterminate']);
const STATES = Object.freeze(['no_drift', 'drift_classified', 'classification_unsupported', 'classification_conflicted', 'classification_indeterminate']);
const DISPOSITIONS = Object.freeze(['PASSED', 'REJECTED', 'CONTAINED']);
/* lemma families (closed lists of the kernel's own outward verbs; a lemma outside every family is plain semantic content) */
const FAM = { memory: /^(note|store|remember|forget|keep|save|seal|recall|retain|delete|erase|write)$/, delivery: /^(deliver|send|render|show|display|publish|post|share|export)$/,
  refusal: /^(refuse|decline|block|deny|withhold|follow|bypass)$/, evidence: /^(tell|say|find|report|cite|source|claim|suggest|indicate)$/, strong_evidence: /^(prove|show|confirm|establish|verify|know|demonstrate)$/,
  hold: /^(rephrase|confirm|approve|hold|ask|wait|clarify|choose|answer|admit|restate)$/, authority: /^(authorize|allow|grant|permit|approve|override|unlock|delete)$/, action: /^(start|run|do|execute|perform|schedule|launch|call)$/ };
const HEDGE_RANK = { might: 1, may: 2, could: 3, can: 4, should: 5, would: 6, will: 7, must: 8, asserted: 9 };
const famOf = (v, depth) => { if (v && typeof v === 'object') { if ((depth || 0) > 3) return null; const l = v.lemma || (v.verb && v.verb.lemma) || (v.c && v.c.verb && v.c.verb.lemma); if (typeof l === 'string') return famOf(l);
    for (const k of Object.keys(v)) { const f = famOf(v[k], (depth || 0) + 1); if (f) return f; } return null; }
  if (typeof v !== 'string') return null; for (const k of Object.keys(FAM)) if (FAM[k].test(v)) return k; return null; }; /* a removed / added subtree is typed by the first lemma it carries */
const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
/* structural diff of two stripped vākya trees; bounded */
function diff(a, b, path, out) { if (out.length >= 48) return out;
  if (Array.isArray(a) || Array.isArray(b)) { const A = Array.isArray(a) ? a : [], B = Array.isArray(b) ? b : []; if (A.length !== B.length) out.push({ path, key: path[path.length - 1], want: A.length, got: B.length, array: true });
    for (let i = 0; i < Math.min(A.length, B.length); i++) diff(A[i], B[i], path.concat(String(i)), out); return out; }
  if (isObj(a) || isObj(b)) { const A = isObj(a) ? a : {}, B = isObj(b) ? b : {}; if (!isObj(a) || !isObj(b)) { out.push({ path, key: path[path.length - 1], want: a, got: b }); return out; }
    for (const k of [...new Set([...Object.keys(A), ...Object.keys(B)])].sort()) diff(A[k], B[k], path.concat(k), out); return out; }
  if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ path, key: path[path.length - 1], want: a, got: b }); return out; }
const presence = d => d.want === undefined ? 'added' : d.got === undefined ? 'removed' : 'changed';
const finding = p => p === 'added' ? 'unsupported' : p === 'removed' ? 'missing' : 'changed';
/* one diff → one drift finding (kind, dimension) */
function classifyDiff(d) { const k = String(d.key || ''), pr = presence(d), anyFam = famOf(d.want) || famOf(d.got);
  const F = (kind, dim) => ({ kind, dimension: dim, path: d.path.join('.'), want: d.want === undefined ? null : d.want, got: d.got === undefined ? null : d.got, finding: finding(pr), materiality: 'material' });
  if (k === 'pol') return d.want === 'neg' ? F('omitted_meaning', 'claim_status') : F('unsupported_surface_addition', 'claim_status');
  if (k === 'mod') { const w = HEDGE_RANK[d.want || 'asserted'] || 9, g = HEDGE_RANK[d.got || 'asserted'] || 9; return g === 9 && w < 9 ? F('certainty_upgrade', 'certainty') : g > w ? F('claim_strengthening', 'certainty') : F('unsupported_surface_addition', 'certainty'); }
  if (k === 'cond') return pr === 'removed' ? F('scope_expansion', 'scope') : F('unsupported_surface_addition', 'scope');
  if (/^(det|q|quant|cnt|pl|all|scope)$/.test(k)) return F('scope_expansion', 'scope');
  if (/^(tense|aspect)$/.test(k)) return F('action_status_distortion', 'action_status');
  if (k === 'force') return F('ancestry_mismatch', 'communicative_purpose');
  if (/^(post|adv|hedge|limit|limits|caveat)$/.test(k) && (pr === 'removed' || (d.array && d.got < d.want))) return F('caveat_omission', 'caveats_and_limitations');
  if (/^(readings|alts|or)$/.test(k) || d.path.includes('readings')) return F('ambiguity_erasure', 'unresolved_conditions');
  if (anyFam === 'memory') return F('memory_status_distortion', 'memory_status');
  if (anyFam === 'delivery') return F('delivery_status_distortion', 'delivery_status');
  if (anyFam === 'refusal') return F('refusal_softening', 'refusal_state');
  if (anyFam === 'hold') return F('unresolved_state_erasure', 'required_next_step_or_hold_status');
  if (anyFam === 'authority' && famOf(d.got) === 'authority' && famOf(d.want) !== 'authority') return F('authority_escalation', 'action_status');
  if (anyFam === 'action') return F('action_status_distortion', 'action_status');
  if (famOf(d.want) === 'evidence' && famOf(d.got) === 'strong_evidence') return F('evidence_status_upgrade', 'evidence_status');
  if ((famOf(d.got) === 'evidence' || famOf(d.got) === 'strong_evidence') && pr === 'added') return F('invented_evidence', 'evidence_status');
  if (d.array) return d.got > d.want ? F('invented_fact', 'semantic_content') : F('omitted_meaning', 'semantic_content');
  if (/^(kind|type|role|roles|frame|voice)$/.test(k)) return F('ancestry_mismatch', 'semantic_content'); /* a different structural derivation, not a different fact */
  if (pr === 'removed') return F('omitted_meaning', 'semantic_content');
  return F('invented_fact', 'semantic_content'); /* content added or substituted (a value the plan does not carry) */ }
/* pick the analysis nearest the plan (fewest differences; ties by canonical order) */
function nearest(want, gots) { let best = null; for (const g of gots || []) { const n = diff(want, g, [], []).length; if (!best || n < best.n) best = { g, n }; } return best ? best.g : undefined; }
/* x = { pass, components, faults[], analyses (count), ambiguous, want (stripped plan), gots (stripped analyses), status_drift, reverify_failed } */
function classify(x) { const dims = Object.fromEntries(DIMENSIONS.map(d => [d, 'preserved'])), drift = [];
  const set = (d, f) => { if (dims[d] === 'preserved' || f === 'conflicted') dims[d] = f; };
  let state = 'no_drift', disposition;
  if (x.pass) disposition = 'PASSED';
  else if (!x.components || !x.components.reparse) { for (const d of DIMENSIONS) dims[d] = 'indeterminate'; dims.semantic_content = 'unsupported'; state = 'classification_unsupported'; disposition = 'REJECTED'; }
  else if (x.ambiguous) { set('semantic_content', 'indeterminate'); set('unresolved_conditions', 'indeterminate'); state = 'classification_indeterminate'; disposition = 'CONTAINED'; }
  else { if (x.reverify_failed) { drift.push({ kind: 'invented_fact', dimension: 'semantic_content', path: 'independent_reverification', want: null, got: null, finding: 'conflicted', materiality: 'conflicted' }); set('semantic_content', 'conflicted'); }
    if (x.status_drift) { drift.push({ kind: 'memory_status_distortion', dimension: 'memory_status', path: 'status_markers', want: null, got: null, finding: 'changed', materiality: 'material' }); set('memory_status', 'changed'); }
    for (const f of x.faults || []) if (/different material/.test(f)) { drift.push({ kind: 'ancestry_mismatch', dimension: 'semantic_content', path: 'user_np', want: null, got: null, finding: 'changed', materiality: 'material' }); set('semantic_content', 'changed'); }
    if (x.want !== undefined && x.components.structural_identity === 0) { const g = nearest(x.want, x.gots); for (const d of diff(x.want, g, [], [])) { const c = classifyDiff(d); drift.push(c); set(c.dimension, c.finding); } }
    state = drift.length ? (drift.some(d => d.materiality === 'conflicted') ? 'classification_conflicted' : 'drift_classified') : 'classification_indeterminate'; disposition = 'REJECTED'; }
  const kinds = [...new Set(drift.map(d => d.kind))].filter(k => DRIFT_KINDS.includes(k));
  return { schema: 'RMC-ECHO-TYPED/v1', dimensions: dims, drift: drift.slice(0, 16), drift_kinds: kinds, classification_state: state,
    materiality: x.pass ? 'not_applicable' : drift.some(d => d.materiality === 'material') ? 'material' : state === 'classification_indeterminate' ? 'indeterminate' : state === 'classification_unsupported' ? 'unsupported' : 'conflicted',
    disposition, custody: disposition === 'REJECTED' ? 'rejection_custody: output blocked, no memory write (RMC §5.12)' : disposition === 'CONTAINED' ? 'containment_custody: held for clarification (Doc 6 §29), never a guess' : null,
    raw_text_input: false, pass_condition: 'structural identity (CONFLICTS #9); typing never changes the verdict' }; }
const api = { DIMENSIONS, FINDINGS, DRIFT_KINDS, MATERIALITY, STATES, DISPOSITIONS, classify, classifyDiff, diff, nearest };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KEchoTypes = api;
})(typeof self !== 'undefined' ? self : this);
