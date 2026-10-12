/* economy.js: creator credit and the Memory Economy. It is COUNT-ONLY: CT is a count of recognised contribution, not money,
 * not transferable and not redeemable; economic_processing is NOT_AUTHORIZED and payout_hook is always null.
 * Sources: "Memory Economy - Breathing Life" (Drive, May 30 2026): contribution types CRT/CPT/BLD; difficulty Light/Standard/Heavy/Monument;
 * base-CT chart (section 4.1); influence Direct 1, Indirect 1/2, Collaborative 1/3 (sections 1.1-1.3, 4.3); CT only after validation (section 8).
 * forge Patch 300 contribution_economy_v1 (consent scope). GenNode Doc 12 (attribution ledger).
 * v4.8.3 lifecycle (user decision 2026-10-12), all append-only:
 *   accepting shared knowledge as evidence records a ContributionEventCandidate ONLY (no canonical CT, no capsule);
 *   a local reviewer may raise difficulty (default Light). The reviewer is NOT a "Memory Steward";
 *   a BreathValidation event records validator identity, time, result and evidence;
 *   finalize() writes a hashed capsule only after a lawful passing validation;
 *   nullify()/supersede() append a signed event. A hashed capsule is never mutated; its proof hash stays valid.
 * Uses and citations are unique append-only events (no editable aggregate); totals are derived from verified events. */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports; const { sha256 } = isNode ? require('./sha256.js') : root.KSha; const LG = isNode ? require('./ledger.js') : root.KLedger;
const canon = o => (Array.isArray(o) ? '[' + o.map(canon).join(',') + ']' : o && typeof o === 'object' ? '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}' : JSON.stringify(o));
/* exact rationals "n/d" (no floats in canonical credit) */
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a)); const Q = (n, d) => { d = d || 1; const g = gcd(n, d) || 1; return (n / g) + '/' + (d / g); };
const qp = s => { const [n, d] = String(s).split('/').map(Number); return [n, d || 1]; }; const qmul = (a, b) => { const [x, y] = qp(a), [u, v] = qp(b); return Q(x * u, y * v); }; const qadd = (a, b) => { const [x, y] = qp(a), [u, v] = qp(b); return Q(x * v + u * y, y * v); };
const qnum = s => { const [n, d] = qp(s); return Math.round((n / d) * 1000) / 1000; };
const BASE_CT_Q = { CRT: { Light: '1/1', Standard: '5/1', Heavy: '20/1', Monument: '60/1' }, CPT: { Light: '1/2', Standard: '2/1', Heavy: '8/1', Monument: '40/1' }, BLD: { Light: '2/1', Standard: '10/1', Heavy: '30/1', Monument: '80/1' } };
const BASE_CT = Object.fromEntries(Object.entries(BASE_CT_Q).map(([t, m]) => [t, Object.fromEntries(Object.entries(m).map(([c, q]) => [c, qnum(q)]))]));
const DIFFICULTY = ['Light', 'Standard', 'Heavy', 'Monument'];
const POLICY = Object.freeze({ version: 'forge-mobile-econ-policy/v1',
  weights: Object.freeze({ direct: '1/1', indirect: '1/2', collaborative: '1/3' }),
  roles: Object.freeze({ direct: 'first-breath creator: the signing author, or a co-creator named in the author-signed body who signed that exact draft before first publication (each gets x1)',
    collaborative: 'later collaborator / co-signer not named as a co-creator in the original body (x1/3, exact rational)',
    indirect: 'lineage ancestor of a fork (x1/2) - provisional Forge Mobile policy interpretation of fork half-credit; exact lineage kept; counts zero on a foreign device until the signed lineage is resolved' }),
  difficulty: 'defaults to Light; a local reviewer may raise it (never lower it after validation); the local reviewer is not a Memory Steward',
  uses_citations: 'counts only; no reward, no CT',
  validation: 'BreathValidation by a validator who is not a contributor, with evidence; finalization only after a passing validation of the current difficulty',
  preview_label: 'provisional recognition preview, not canonical CT, not money' });
const BREATH = POLICY.weights;
const CONSENT_SCOPE = { attribution: 'granted_per_item', storage: 'granted_per_item', public_display: 'granted_per_item', portability: 'granted_per_item', economic_processing: 'NOT_AUTHORIZED' };
const evHash = e => { const b = Object.assign({}, e); delete b.hash; delete b.sig; return sha256(canon(b)); };
/* append-only hash chain verification for lifecycle and usage event lists */
function verifyEvents(list, device) { let prev = 'genesis'; for (let i = 0; i < (list || []).length; i++) { const e = list[i]; if (e.seq !== i + 1) return 'SEQ-GAP'; if (e.prev !== prev) return 'PREV-MISMATCH'; if (device && e.device !== device) return 'DEVICE-MISMATCH'; if (evHash(e) !== e.hash) return 'HASH-MISMATCH'; prev = e.hash; } return null; }
function usageTotals(events) { const m = new Map(); for (const e of events) { const k = e.item + '|' + e.creator; const t = m.get(k) || { item: e.item, creator: e.creator, uses: 0, citations: 0 }; if (e.kind === 'use') t.uses++; else if (e.kind === 'cite') t.citations++; m.set(k, t); } return [...m.values()].sort((a, b) => (a.item + '|' + a.creator < b.item + '|' + b.creator ? -1 : 1)); }
/* v4.8.4 roles. direct x1: the signing author, plus each co-creator who is NAMED in the author-signed body (co_creators) AND whose first-breath
 * signature over that exact draft is embedded in the author-signed body (first_breath), which proves it existed before first publication.
 * collaborative x1/3: every other verified co-signer (later co-signatures, including a named co-creator who only co-signed after publication).
 * indirect x1/2: fork ancestors (provisional; counts ZERO on a foreign device until its signed lineage is resolved). */
function contributorsOf(item) { const out = []; const seen = new Set(); const add = c => { if (!c.signer || seen.has(c.signer)) return; seen.add(c.signer); out.push(c); };
  const named = new Set(item.co_creators || []); const fb = new Set((item.first_breath || []).map(x => x && x.signer).filter(x => named.has(x))); const cos = (item.cosigners || []).slice().sort((x, y) => (x.signer < y.signer ? -1 : x.signer > y.signer ? 1 : 0));
  add({ signer: item.source && item.source.signer, role: 'direct', weight: POLICY.weights.direct, basis: 'signing author (first breath)' });
  for (const sg of [...fb].sort()) add({ signer: sg, role: 'direct', weight: POLICY.weights.direct, basis: 'first-breath co-creator: named in the author-signed body and co-signed that exact draft before first publication' });
  for (const c of cos) add({ signer: c.signer, role: 'collaborative', weight: POLICY.weights.collaborative, basis: 'later co-signer' });
  for (const l of item.lineage || []) add({ signer: l.creator, role: 'indirect', weight: POLICY.weights.indirect, via: l.parent, lineage: { parent: l.parent, creator: l.creator }, basis: 'fork ancestor (provisional Forge Mobile policy interpretation)' });
  return out; }
const defaultType = item => (item.kind === 'tool_package' ? 'BLD' : 'CRT');
const consentOf = item => Object.assign({}, CONSENT_SCOPE, { item_consent: item.consent || null });
/* deterministic candidate digest: recomputable on ANY device from the original signed manifest alone */
const candidateDigest = c => sha256(canon({ candidate_id: c.candidate_id, item: c.item, kind: c.kind, contribution_type: c.contribution_type, manifest_sha256: c.manifest_sha256, contributors: c.contributors, consent: c.consent, policy_version: c.policy_version }));
const VALIDATION_KEYS = ['type', 'schema', 'candidate_id', 'candidate_digest', 'manifest_sha256', 'result', 'evidence', 'difficulty', 'validated_at', 'policy_version', 'validator'];
const validationBody = e => { const b = {}; for (const k of VALIDATION_KEYS) b[k] = e[k]; return b; };
const signerIdOf = pub => 'sig-' + sha256(canon({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y })).slice(0, 16);
function Economy(store, deps) { const { ledger } = deps; const now = () => (deps.clock ? deps.clock() : new Date().toISOString()); const signer = deps.signer || null;
  const rnd = n => { const a = new Uint8Array(n); (root.crypto || globalThis.crypto).getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2, '0')).join(''); };
  const events = () => store.load('economy_events'); const uevents = () => store.load('usage_events');
  function appendEvent(body, kind) { const l = events(); const e = Object.assign({ device: ledger.device(), seq: l.length + 1, prev: l.length ? l[l.length - 1].hash : 'genesis', at: now() }, body); e.hash = evHash(e); l.push(e); store.save('economy_events', l); ledger.append(kind, e.hash); return e; }
  const candOf = id => events().find(e => e.type === 'ContributionEventCandidate' && e.candidate_id === id);
  const stateOf = id => { const ev = events().filter(e => e.candidate_id === id); if (!ev.length) return null; const c = ev[0]; let difficulty = c.difficulty; let validation = null; let status = 'candidate'; let capsule = null;
    for (const e of ev) { if (e.type === 'DifficultyReview') { difficulty = e.difficulty; validation = null; } if (e.type === 'BreathValidation') validation = e; if (e.type === 'CandidateRejected') status = 'rejected'; if (e.type === 'CapsuleFinalized') { status = 'finalized'; capsule = e.proof_hash; } }
    if (status === 'candidate' && validation && validation.result === 'pass') status = 'validated'; return { candidate: c, difficulty, validation, status, capsule }; };
  /* 1. candidate: provenance, roles, consent and difficulty basis; no CT, no capsule */
  function candidate(item, o) { o = o || {}; const type = defaultType(item); if (o.type && o.type !== type) return { ok: false, rule: 'ECON-CLASS-NOT-DETERMINISTIC' };
    const id = 'cand:' + sha256('candidate|' + item.id).slice(0, 24); if (candOf(id)) return { ok: true, dup: true, candidate_id: id };
    const contributors = contributorsOf(item); if (!contributors.length) return { ok: false, rule: 'ECON-NO-CONTRIBUTOR' };
    const msha = sha256(canon(item)); const ms = store.load('economy_manifests'); if (!ms.some(x => sha256(canon(x)) === msha)) { ms.push(JSON.parse(JSON.stringify(item))); store.save('economy_manifests', ms); } /* the exact signed manifest the candidate was derived from */
    const body = { type: 'ContributionEventCandidate', candidate_id: id, item: item.id, kind: item.kind, contribution_type: type, policy_version: POLICY.version, manifest_sha256: msha,
      provenance: { manifest_id: item.id, schema: item.schema, author: item.source && item.source.signer, ancestry_root: item.ancestry_root || null, evidence: (item.evidence || []).map(x => x.ref || x.type).slice(0, 20), accepted_as: 'evidence_only' },
      contributors, consent: consentOf(item), difficulty: 'Light', difficulty_basis: 'policy default Light (no review yet)', canonical_ct: 'none (candidate)' };
    body.candidate_digest = candidateDigest(body); const e = appendEvent(body, 'economy_candidate');
    if (o.difficulty && o.difficulty !== 'Light') raiseDifficulty(id, o.difficulty, { reviewer: o.reviewer, basis: 'set at review' }); return { ok: true, candidate_id: id, event: e }; }
  function raiseDifficulty(id, cls, o) { o = o || {}; const s = stateOf(id); if (!s) return { ok: false, rule: 'ECON-NO-CANDIDATE' }; if (s.status === 'finalized' || s.status === 'rejected') return { ok: false, rule: 'ECON-CANDIDATE-CLOSED' };
    if (!DIFFICULTY.includes(cls)) return { ok: false, rule: 'ECON-CLASS' }; if (DIFFICULTY.indexOf(cls) <= DIFFICULTY.indexOf(s.difficulty)) return { ok: false, rule: 'ECON-DIFFICULTY-ONLY-RAISED' };
    return { ok: true, event: appendEvent({ type: 'DifficultyReview', candidate_id: id, difficulty: cls, from: s.difficulty, reviewer: { id: o.reviewer || (signer && signer.id()) || 'local', role: 'local reviewer' }, basis: String(o.basis || 'local reviewer judgement') }, 'economy_validation') }; }
  /* 2. breath validation (v4.8.4): a SIGNED BreathValidation. The validator ID is derived from the validator's public key and the signature covers the
   * canonical validation body (candidate digest, manifest hash, result, evidence, difficulty, time, policy). A free-text validator string is refused. */
  function validationRequest(id) { const s = stateOf(id); if (!s) return null; return { candidate_id: id, candidate_digest: s.candidate.candidate_digest, manifest_sha256: s.candidate.manifest_sha256, difficulty: s.difficulty, policy_version: POLICY.version }; }
  async function signValidation(req, o) { o = o || {}; if (!signer) return { ok: false, rule: 'ECON-SIGNER-UNAVAILABLE' }; const k = await signer.ensure(); if (!k) return { ok: false, rule: 'ECON-SIGNER-UNAVAILABLE' };
    if (!req || typeof req.candidate_digest !== 'string') return { ok: false, rule: 'ECON-NO-CANDIDATE' }; if (o.validator !== undefined && o.validator !== k.signer) return { ok: false, rule: 'ECON-VALIDATOR-NOT-SIGNER' };
    if (!['pass', 'fail'].includes(o.result)) return { ok: false, rule: 'ECON-VALIDATION-RESULT' }; const ev = (Array.isArray(o.evidence) ? o.evidence : []).map(String).filter(Boolean).map(x => x.slice(0, 500)).slice(0, 20); if (!ev.length) return { ok: false, rule: 'ECON-VALIDATION-NO-EVIDENCE' };
    const body = { type: 'BreathValidation', schema: 'forge-breath-validation/v1', candidate_id: req.candidate_id, candidate_digest: req.candidate_digest, manifest_sha256: req.manifest_sha256, result: o.result, evidence: ev, difficulty: req.difficulty, validated_at: now(), policy_version: POLICY.version, validator: { id: k.signer, pub: k.pub, role: 'local reviewer' } };
    const sg = await signer.sign(body); if (!sg) return { ok: false, rule: 'ECON-SIGNER-UNAVAILABLE' }; return { ok: true, validation: Object.assign({}, body, { sig: sg.sig }) }; }
  async function checkValidation(v, cand, difficulty) { if (!v || typeof v !== 'object' || v.type !== 'BreathValidation' || v.schema !== 'forge-breath-validation/v1') return 'ECON-VALIDATION-SHAPE';
    const pub = v.validator && v.validator.pub; if (!pub || typeof pub !== 'object' || typeof v.sig !== 'string') return 'ECON-VALIDATOR-UNSIGNED'; if (signerIdOf(pub) !== v.validator.id) return 'ECON-VALIDATOR-ID-NOT-FROM-KEY';
    if (!(await SHM().verifySig(validationBody(v), v.sig, pub))) return 'ECON-VALIDATOR-SIGNATURE'; if (v.candidate_digest !== cand.candidate_digest || v.candidate_id !== cand.candidate_id || v.manifest_sha256 !== cand.manifest_sha256) return 'ECON-VALIDATION-CANDIDATE-MISMATCH';
    if (cand.contributors.some(c => c.signer === v.validator.id)) return 'ECON-SELF-VALIDATION'; if (!['pass', 'fail'].includes(v.result)) return 'ECON-VALIDATION-RESULT'; if (!Array.isArray(v.evidence) || !v.evidence.length) return 'ECON-VALIDATION-NO-EVIDENCE';
    if (v.policy_version !== POLICY.version) return 'ECON-POLICY-VERSION'; if (difficulty !== undefined && v.difficulty !== difficulty) return 'ECON-VALIDATION-DIFFICULTY-STALE'; if (cand.consent.attribution !== 'granted_per_item') return 'ECON-NO-CONSENT'; return null; }
  async function addValidation(id, v) { const s = stateOf(id); if (!s) return { ok: false, rule: 'ECON-NO-CANDIDATE' }; if (s.status === 'finalized' || s.status === 'rejected') return { ok: false, rule: 'ECON-CANDIDATE-CLOSED' };
    const err = await checkValidation(v, s.candidate, s.difficulty); if (err) return { ok: false, rule: err }; return { ok: true, event: appendEvent(Object.assign(validationBody(v), { sig: v.sig }), 'economy_validation') }; }
  /* validate on THIS device: the device key signs; a contributor cannot validate their own contribution */
  async function validate(id, o) { o = o || {}; const s = stateOf(id); if (!s) return { ok: false, rule: 'ECON-NO-CANDIDATE' }; if (s.status === 'finalized' || s.status === 'rejected') return { ok: false, rule: 'ECON-CANDIDATE-CLOSED' };
    if (!signer || !signer.id()) return { ok: false, rule: 'ECON-VALIDATOR-UNIDENTIFIED' }; if (o.validator !== undefined && o.validator !== signer.id()) return { ok: false, rule: 'ECON-VALIDATOR-NOT-SIGNER' };
    if (s.candidate.contributors.some(c => c.signer === signer.id())) return { ok: false, rule: 'ECON-SELF-VALIDATION' };
    const r = await signValidation(validationRequest(id), o); if (!r.ok) return r; return addValidation(id, r.validation); }
  /* 3. finalize: a capsule exists only after a lawful passing validation of the current difficulty */
  function finalize(id) { const s = stateOf(id); if (!s) return { ok: false, rule: 'ECON-NO-CANDIDATE' }; if (s.status === 'finalized') return { ok: true, dup: true, proof_hash: s.capsule }; if (s.status !== 'validated') return { ok: false, rule: s.status === 'rejected' ? 'ECON-CANDIDATE-CLOSED' : 'ECON-NOT-VALIDATED' };
    const c = s.candidate; const base = BASE_CT_Q[c.contribution_type][s.difficulty];
    const cap = { schema: 'forge-ct-capsule/v3', candidate_id: id, candidate_digest: c.candidate_digest, manifest_sha256: c.manifest_sha256, item: c.item, kind: c.kind, type: c.contribution_type, difficulty: s.difficulty, difficulty_basis: s.difficulty === 'Light' ? 'policy default Light' : 'raised by local reviewer; attested by the signed validation', base_ct: base, policy_version: POLICY.version,
      contributors: c.contributors.map(x => Object.assign({}, x, { ct: qmul(base, x.weight) })), validation_ref: s.validation.hash, validator: s.validation.validator.id, status: 'finalized', finalized_at: now(), consent_scope: CONSENT_SCOPE, economic_processing: 'NOT_AUTHORIZED', payout_hook: null };
    cap.proof_hash = sha256(canon(cap)); const caps = store.load('economy_capsules'); caps.push(cap); store.save('economy_capsules', caps); ledger.append('economy_count', cap.proof_hash);
    appendEvent({ type: 'CapsuleFinalized', candidate_id: id, proof_hash: cap.proof_hash }, 'economy_validation'); return { ok: true, capsule: cap }; }
  /* 4. nullification / supersession: append a SIGNED event; the original capsule and its proof hash are untouched */
  async function nullify(proof, reason, o) { o = o || {}; const cap = store.load('economy_capsules').find(c => c.proof_hash === proof); if (!cap) return { ok: false, rule: 'ECON-NONE' }; if (nullified().has(proof)) return { ok: true, dup: true };
    if (!signer) return { ok: false, rule: 'ECON-SIGNER-UNAVAILABLE' }; const body = { type: o.supersededBy ? 'CapsuleSuperseded' : 'CapsuleNullified', target: proof, candidate_id: cap.candidate_id, reason: String(reason || 'rejected or fraudulent (doc section 8: earns nothing)'), superseded_by: o.supersededBy || null, policy_version: POLICY.version };
    const s = await signer.sign(body); if (!s) return { ok: false, rule: 'ECON-SIGNER-UNAVAILABLE' }; return { ok: true, event: appendEvent(Object.assign({}, body, { signed_body_sha256: sha256(canon(body)), signer: s.signer, sig: s.sig }), 'economy_nullify') }; }
  function nullified(list) { return new Set((list || events()).filter(e => e.type === 'CapsuleNullified' || e.type === 'CapsuleSuperseded').map(e => e.target)); }
  /* void: kept for the review flow. A candidate is closed by an appended rejection; a finalized capsule gets a signed nullification */
  async function void_(itemId, reason) { const id = 'cand:' + sha256('candidate|' + itemId).slice(0, 24); const s = stateOf(id); if (!s) return { ok: false, rule: 'ECON-NONE' };
    if (s.status === 'finalized') return nullify(s.capsule, reason); if (s.status === 'rejected') return { ok: true, dup: true }; return { ok: true, event: appendEvent({ type: 'CandidateRejected', candidate_id: id, reason: String(reason || 'rejected at review') }, 'economy_validation') }; }
  /* usage / citation EVENTS (counts only, no reward) */
  function use(itemId, creator, kind) { const k = kind === 'cite' ? 'cite' : 'use'; const l = uevents(); const seq = l.length + 1; const nonce = 'n' + rnd(8); /* letter prefix: never a digit run that looks like a card number */
    const e = { schema: 'forge-usage-event/v1', event_id: 'ue:' + sha256(canon({ device: ledger.device(), seq, nonce })).slice(0, 32), item: itemId, creator: creator || 'unknown', kind: k, device: ledger.device(), seq, prev: l.length ? l[l.length - 1].hash : 'genesis', at: now(), nonce };
    e.hash = evHash(e); l.push(e); store.save('usage_events', l); ledger.append(k === 'cite' ? 'knowledge_cite' : 'tool_use', e.hash); return usageTotals(l).find(t => t.item === itemId && t.creator === e.creator); }
  /* the snapshot exports the FULL own chain (anchored at genesis), every own lifecycle and usage event; derived totals are checked by receivers */
  /* v4.8.4: the snapshot carries the ORIGINAL signed source manifests (and resolvable fork parents) so a receiver can rebuild every lifecycle itself */
  function manifestsFor(caps) { const pool = store.load('economy_manifests').concat(store.load('shared_knowledge').map(k => k.manifest), store.load('shared_inbox').map(k => k.manifest)); const out = new Map();
    const bySha = new Map(pool.map(m => [sha256(canon(m)), m])); const byId = new Map(); for (const m of pool) if (m && m.id && !byId.has(m.id)) byId.set(m.id, m);
    for (const c of caps) { const m = bySha.get(c.manifest_sha256); if (!m) continue; out.set(c.manifest_sha256, m); for (const l of m.lineage || []) { const pm = byId.get(l.parent); if (pm) out.set(sha256(canon(pm)), pm); } }
    return [...out.keys()].sort().map(k => out.get(k)); }
  function snapshotBody() { const ue = uevents(); const caps = store.load('economy_capsules'); return { schema: 'emn-credit-ledger/v1', kind: 'credit_ledger', format: 'forge-credit-ledger/v3', device: ledger.device(), checkpoint: LG.checkpointOf([], 1), chain: ledger.own(), capsules: caps, manifests: manifestsFor(caps),
    econ_events: events(), usage_events: ue, usage_totals: usageTotals(ue), created: now(), authority: 'evidence_only', policy_version: POLICY.version, source: { kind: 'economy' } }; }
  const SHM = () => (isNode ? require('./shared.js') : root.KShared);
  const fmapL = () => { const f = store.load('economy_foreign'); return f && !Array.isArray(f) ? f : {}; };
  async function verifyBody(m) { if (m.usage !== undefined) return { err: 'ECON-TAMPER-AGGREGATE-NOT-EVENTS' };
    const v = LG.verifyChain(m.chain || [], m.checkpoint); if (!v.ok) return { err: 'ECON-TAMPER-CHAIN:' + v.why }; if (v.n && v.device !== m.device) return { err: 'ECON-TAMPER-DEVICE-MISMATCH' };
    const inChain = kinds => new Set(m.chain.filter(e => kinds.includes(e.kind)).map(e => e.payload_sha256)); const counted = inChain(['economy_count']);
    for (const c of m.capsules || []) { const base = Object.assign({}, c); delete base.proof_hash; if (sha256(canon(base)) !== c.proof_hash) return { err: 'ECON-TAMPER-PROOF-HASH' }; if (!counted.has(c.proof_hash)) return { err: 'ECON-TAMPER-NOT-IN-CHAIN' };
      if (c.payout_hook !== null || c.economic_processing !== 'NOT_AUTHORIZED') return { err: 'ECON-VALUE-NOT-AUTHORIZED' }; }
    const ee = m.econ_events || []; const e1 = verifyEvents(ee, m.device); if (e1) return { err: 'ECON-TAMPER-EVENTS:' + e1 }; const econK = inChain(['economy_candidate', 'economy_validation', 'economy_nullify']); if (ee.some(e => !econK.has(e.hash))) return { err: 'ECON-TAMPER-EVENT-NOT-IN-CHAIN' };
    for (const e of ee.filter(x => x.type === 'CapsuleNullified' || x.type === 'CapsuleSuperseded')) { const body = { type: e.type, target: e.target, candidate_id: e.candidate_id, reason: e.reason, superseded_by: e.superseded_by, policy_version: e.policy_version };
      if (e.signer !== m.source.signer || !(await SHM().verifySig(body, e.sig, m.source.pub))) return { err: 'ECON-TAMPER-NULLIFICATION-SIGNATURE' }; }
    const ue = m.usage_events || []; const e2 = verifyEvents(ue, m.device); if (e2) return { err: 'ECON-TAMPER-USAGE:' + e2 }; const useK = inChain(['tool_use', 'knowledge_cite']); if (ue.some(e => !useK.has(e.hash) || !/^(use|cite)$/.test(e.kind))) return { err: 'ECON-TAMPER-USAGE-NOT-IN-CHAIN' };
    if (new Set(ue.map(e => e.event_id)).size !== ue.length) return { err: 'ECON-TAMPER-USAGE-DUPLICATE-ID' };
    if (canon(usageTotals(ue)) !== canon(m.usage_totals || [])) return { err: 'ECON-TAMPER-AGGREGATE' };
    return { v }; }
  /* concurrent valid branches: union + dedupe (capsules by proof hash, events by event_id), then RECOMPUTE totals from events (not max) */
  function reconcile(branches, device) { const caps = new Map(), ev = new Map(), ue = new Map(); let clash = null;
    for (const b of branches) { for (const c of b.capsules) if (!caps.has(c.proof_hash)) caps.set(c.proof_hash, c); for (const e of b.econ_events || []) if (!ev.has(e.hash)) ev.set(e.hash, e);
      for (const e of b.usage_events || []) { const p = ue.get(e.event_id); if (p && p.hash !== e.hash) clash = e.event_id; if (!p) ue.set(e.event_id, e); } }
    const byTime = (a, b, k) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0);
    const capsules = [...caps.values()].sort((a, b) => (a.finalized_at < b.finalized_at ? -1 : a.finalized_at > b.finalized_at ? 1 : a.proof_hash < b.proof_hash ? -1 : 1)); const econ_events = [...ev.values()].sort((a, b) => byTime(a, b, 'hash')); const usage_events = [...ue.values()].sort((a, b) => byTime(a, b, 'event_id'));
    const heads = branches.map(b => b.head).sort(); const totals = usageTotals(usage_events);
    const receipt = { kind: 'local_reconciliation_receipt', authority: 'local view on this receiving device only; no global authority', remote_device: device, remote_heads: heads, capsules: capsules.length, usage_events: usage_events.length,
      rule: 'union of verified branches; dedupe capsules by proof_hash and events by event_id; totals recomputed from events; each branch chain kept as received' };
    receipt.receipt_hash = sha256(canon({ heads, caps: capsules.map(c => c.proof_hash), events: usage_events.map(e => e.event_id), econ: econ_events.map(e => e.hash) })); return { capsules, econ_events, usage_events, totals, heads, clash, receipt }; }
  /* v4.8.4 FOREIGN CREDIT = RECONSTRUCTED, never trusted. For each capsule the receiver rebuilds, from verified records only:
   * original signed manifest -> deterministic candidate -> independently signed BreathValidation -> deterministic policy calculation ->
   * matching CapsuleFinalized -> (append-only nullification handled by credits()). Roles, difficulty, base CT, weights, exact totals, consent,
   * policy version and proof hashes are recomputed HERE. Any missing or mismatching record: the capsule is quarantined and contributes ZERO.
   * Fork ancestors (x1/2, provisional) count ZERO here unless the parent's signed manifest is present and names that creator. */
  async function reconstruct(c, ctx) { const Q0 = rule => ({ ok: false, rule });
    const man = ctx.bySha.get(c.manifest_sha256); if (!c.manifest_sha256 || !man) return Q0('ECON-Q-MISSING-SOURCE-MANIFEST');
    const merr = await SHM().check(man); if (merr) return Q0('ECON-Q-SOURCE-MANIFEST-INVALID:' + merr); if (man.kind === 'credit_ledger' || man.id !== c.item) return Q0('ECON-Q-SOURCE-MANIFEST-MISMATCH');
    const type = defaultType(man); const cid = 'cand:' + sha256('candidate|' + man.id).slice(0, 24); const contributors = contributorsOf(man);
    const exp = { candidate_id: cid, item: man.id, kind: man.kind, contribution_type: type, manifest_sha256: c.manifest_sha256, contributors, consent: consentOf(man), policy_version: POLICY.version }; exp.candidate_digest = candidateDigest(exp);
    const cand = ctx.events.find(e => e.type === 'ContributionEventCandidate' && e.candidate_id === c.candidate_id); if (!cand) return Q0('ECON-Q-NO-CANDIDATE');
    if (c.candidate_id !== cid || cand.candidate_digest !== exp.candidate_digest || candidateDigest(cand) !== exp.candidate_digest || cand.contribution_type !== type || cand.policy_version !== POLICY.version) return Q0('ECON-Q-CANDIDATE-MISMATCH');
    if (exp.consent.attribution !== 'granted_per_item' || exp.consent.economic_processing !== 'NOT_AUTHORIZED') return Q0('ECON-Q-CONSENT');
    const val = ctx.events.find(e => e.hash === c.validation_ref); if (!val || val.type !== 'BreathValidation') return Q0('ECON-Q-NO-VALIDATION');
    const verr = await checkValidation(val, exp); if (verr) return Q0('ECON-Q-' + verr.replace(/^ECON-/, '')); if (val.result !== 'pass') return Q0('ECON-Q-VALIDATION-NOT-PASSED'); if (c.validator !== val.validator.id) return Q0('ECON-Q-VALIDATOR-MISMATCH');
    if (!DIFFICULTY.includes(val.difficulty) || c.difficulty !== val.difficulty) return Q0('ECON-Q-DIFFICULTY-MISMATCH');
    const base = BASE_CT_Q[type][val.difficulty]; if (c.type !== type) return Q0('ECON-Q-TYPE-MISMATCH'); if (c.base_ct !== base) return Q0('ECON-Q-BASE-CT-MISMATCH');
    if (c.policy_version !== POLICY.version) return Q0('ECON-Q-POLICY-VERSION'); if (canon(c.consent_scope) !== canon(CONSENT_SCOPE)) return Q0('ECON-Q-CONSENT');
    const want = contributors.map(x => Object.assign({}, x, { ct: qmul(base, x.weight) })); if (canon(c.contributors) !== canon(want)) return Q0('ECON-Q-ROLE-OR-WEIGHT-MISMATCH');
    if (c.candidate_digest !== exp.candidate_digest) return Q0('ECON-Q-CANDIDATE-MISMATCH');
    const fins = ctx.events.filter(e => e.type === 'CapsuleFinalized' && e.candidate_id === c.candidate_id); if (!fins.length) return Q0('ECON-Q-NO-FINALIZATION'); if (!fins.some(e => e.proof_hash === c.proof_hash)) return Q0('ECON-Q-FINALIZATION-REF-MISMATCH');
    const b0 = Object.assign({}, c); delete b0.proof_hash; if (sha256(canon(b0)) !== c.proof_hash) return Q0('ECON-Q-PROOF-HASH');
    const accepted = []; for (const x of want) { if (x.role !== 'indirect') { accepted.push({ signer: x.signer, role: x.role, ct: x.ct }); continue; }
      const pm = ctx.byId.get(x.lineage.parent); if (!pm) { accepted.push({ signer: x.signer, role: x.role, ct: '0/1', note: 'fork lineage unresolved on this device: provisional x1/2 counts zero' }); continue; }
      const perr = await SHM().check(pm); if (perr || !pm.source || pm.source.signer !== x.signer) return Q0('ECON-Q-FABRICATED-LINEAGE'); accepted.push({ signer: x.signer, role: x.role, ct: x.ct, note: 'fork lineage resolved from the signed parent manifest (provisional policy)' }); }
    return { ok: true, credit: { proof_hash: c.proof_hash, item: c.item, contributors: accepted, validator: val.validator.id, difficulty: val.difficulty } }; }
  async function reconstructAll(caps, events, manifests) { const ms = (manifests || []).filter(x => x && typeof x === 'object'); const ctx = { events, bySha: new Map(ms.map(x => [sha256(canon(x)), x])), byId: new Map() }; for (const x of ms) if (x.id && !ctx.byId.has(x.id)) ctx.byId.set(x.id, x);
    const credit = [], quarantined = []; for (const c of caps) { const r = await reconstruct(c, ctx); if (r.ok) credit.push(r.credit); else quarantined.push({ proof_hash: c.proof_hash, item: c.item, rule: r.rule }); } return { credit, quarantined }; }
  async function mergeForeign(m) { const err = await SHM().check(m); if (err) return { ok: false, rule: 'ECON-TAMPER-' + err, class: 'tampering' };
    if (m.kind !== 'credit_ledger') return { ok: false, rule: 'ECON-NOT-A-LEDGER' }; if (m.device === ledger.device()) return { ok: false, rule: 'ECON-OWN-DEVICE' };
    const r = await verifyBody(m); if (r.err) return { ok: false, rule: r.err, class: 'tampering' }; const v = r.v;
    const map = fmapL(); const cur = map[m.device]; const seenIds = store.load('economy_seen'); if (seenIds.includes(m.id)) return { ok: false, rule: 'ECON-REPLAY', class: 'replay' };
    if (cur && cur.signer !== m.source.signer) return { ok: false, rule: 'ECON-TAMPER-SIGNER-FOR-DEVICE', class: 'tampering' };
    const branch = { head: v.head || null, chain_len: v.n, chain: m.chain, capsules: m.capsules || [], econ_events: m.econ_events || [], usage_events: m.usage_events || [], manifests: m.manifests || [], snapshot: m.id };
    const known = cur ? cur.branches || [] : [];
    const extendsB = b => b.chain_len <= v.n && (!b.chain_len || (m.chain[b.chain_len - 1] && m.chain[b.chain_len - 1].hash === b.head));
    let rule; let next;
    if (!known.length) { next = [branch]; rule = 'ECON-MERGED'; }
    else if (known.some(b => b.head === branch.head)) { seenIds.push(m.id); store.save('economy_seen', seenIds); return { ok: false, rule: 'ECON-REPLAY', class: 'replay' }; }
    else if (known.some(b => b.chain_len > v.n && b.prefix_heads && b.prefix_heads.includes(branch.head))) { return { ok: false, rule: 'ECON-REPLAY-STALE', class: 'replay' }; }
    else { const others = known.filter(b => !extendsB(b)); next = others.concat([branch]); rule = others.length ? 'ECON-CONCURRENT-QUARANTINED' : 'ECON-FAST-FORWARD'; }
    branch.prefix_heads = m.chain.map(e => e.hash);
    const rc = reconcile(next, m.device); if (rc.clash) return { ok: false, rule: 'ECON-TAMPER-EVENT-ID-COLLISION', class: 'tampering' };
    seenIds.push(m.id); store.save('economy_seen', seenIds);
    const rec = await reconstructAll(rc.capsules, rc.econ_events, [].concat(...next.map(b => b.manifests || [])));
    if (rec.quarantined.length) { const q = store.load('economy_quarantine'); for (const x of rec.quarantined) if (!q.some(y => y.class === 'unverified_credit' && y.proof_hash === x.proof_hash && y.device === m.device)) q.push({ device: m.device, signer: m.source.signer, class: 'unverified_credit', proof_hash: x.proof_hash, item: x.item, rule: x.rule, contributes: '0/1', at: now() }); store.save('economy_quarantine', q); }
    if (next.length > 1) { const q = store.load('economy_quarantine'); q.push({ device: m.device, signer: m.source.signer, heads: rc.heads, at: now(), class: 'concurrent_offline_history', status: 'reconciled', receipt: rc.receipt }); store.save('economy_quarantine', q);
      map[m.device] = { signer: m.source.signer, branches: next, capsules: rc.capsules, econ_events: rc.econ_events, usage_events: rc.usage_events, usage: rc.totals, credit: rec.credit, credit_quarantined: rec.quarantined, status: 'concurrent_reconciled', receipt: rc.receipt, at: now() }; ledger.append('economy_reconcile', rc.receipt.receipt_hash); }
    else map[m.device] = { signer: m.source.signer, branches: next, chain_len: v.n, head: v.head || null, capsules: rc.capsules, econ_events: rc.econ_events, usage_events: rc.usage_events, usage: rc.totals, credit: rec.credit, credit_quarantined: rec.quarantined, status: 'linear', at: now() };
    store.save('economy_foreign', map); return { ok: true, rule, device: m.device, capsules: map[m.device].capsules.length, usage_events: rc.usage_events.length, credit_verified: rec.credit.length, credit_quarantined: rec.quarantined.length, quarantine_rules: rec.quarantined.map(x => x.rule), class: next.length > 1 ? 'concurrent_history' : 'linear' }; }
  const blank = s => ({ signer: s, ct_exact: '0/1', ct_count: 0, direct: 0, indirect: 0, collaborative: 0, uses: 0, citations: 0 });
  function credits(o) { o = o || {}; const by = {}; const seen = new Set(); const foreign = o.merged ? Object.values(fmapL()) : [];
    const own = { capsules: store.load('economy_capsules'), econ_events: events(), usage_events: uevents() };
    const sources = [own].concat(foreign.map(f => ({ capsules: f.credit || [], econ_events: f.econ_events || [], usage_events: f.usage_events || [] }))); /* foreign: reconstructed credit only; legacy entries without it count zero */
    for (const src of sources) { const dead = nullified(src.econ_events || []); for (const c of src.capsules) { if (dead.has(c.proof_hash)) continue; for (const x of c.contributors) { if (!x.signer) continue; const key = c.item + '|' + x.signer; if (seen.has(key)) continue; seen.add(key); const b = by[x.signer] || (by[x.signer] = blank(x.signer)); b.ct_exact = qadd(b.ct_exact, x.ct); b.ct_count = qnum(b.ct_exact); b[x.role]++; } } }
    for (const src of sources) for (const u of usageTotals(src.usage_events || [])) { const b = by[u.creator] || (by[u.creator] = blank(u.creator)); b.uses += u.uses; b.citations += u.citations; }
    return { creators: Object.values(by).sort((a, b) => b.ct_count - a.ct_count), scope: o.merged ? 'this device + ' + foreign.length + ' verified device ledger(s)' : 'this device', basis: 'finalized, non-nullified capsules only; foreign credit only where the full lifecycle was reconstructed and recomputed on this device', unit: 'CT count (recognition only; not money; economic_processing NOT_AUTHORIZED)', payout_hook: null, policy_version: POLICY.version }; }
  /* local recognition before finalization: labelled preview, never canonical */
  function preview() { const ids = [...new Set(events().filter(e => e.type === 'ContributionEventCandidate').map(e => e.candidate_id))]; const rows = [];
    for (const id of ids) { const s = stateOf(id); if (s.status === 'finalized' || s.status === 'rejected') continue; const base = BASE_CT_Q[s.candidate.contribution_type][s.difficulty]; rows.push({ candidate_id: id, item: s.candidate.item, status: s.status, difficulty: s.difficulty, contributors: s.candidate.contributors.map(x => ({ signer: x.signer, role: x.role, provisional: qmul(base, x.weight) })) }); }
    return { label: POLICY.preview_label, canonical: false, rows }; }
  return { candidate, raiseDifficulty, validate, validationRequest, signValidation, addValidation, reconstructAll, finalize, nullify, supersede: (proof, by, reason) => nullify(proof, reason || 'superseded', { supersededBy: by }), void: void_, use, credits, preview, state: stateOf,
    candidateId: itemId => 'cand:' + sha256('candidate|' + itemId).slice(0, 24), snapshotBody, mergeForeign, verifyBody, quarantine: () => store.load('economy_quarantine'), capsules: () => store.load('economy_capsules'), events, usageEvents: uevents, usage: () => usageTotals(uevents()) }; }
const api = { Economy, candidateDigest, validationBody, signerIdOf, BASE_CT, BASE_CT_Q, BREATH, POLICY, CONSENT_SCOPE, DIFFICULTY, Q, qadd, qmul, qnum, usageTotals, verifyEvents, contributorsOf };
if (isNode) module.exports = api; else root.KEconomy = api;
})(typeof self !== 'undefined' ? self : this);
