/* shared.js — the SHARED KNOWLEDGE LAYER (user architecture 2026-10-11): everyone running the app shares RMC knowledge/manifests; each
 * person's Identity Vault stays private (per-user key, never shared). Design sources:
 *  - The Epistemic Manifest Network (Drive): Claim Manifest fields (§5); "evidence outranks consensus" (§2); the Evidence Ancestry Graph,
 *    where descendants of one root count once (§7–8); a confidence VECTOR, not a truth score, with ordinal states Unassessed … Falsified Within
 *    Scope (§9); typed challenges (§10); signatures prove who created a record, never that it is true (§4.6, §18); privacy (§21).
 *  - GenNode Doc 11 (network sync): manifest exchange plus per-record checksum verification. Doc 12: an attribution ledger entry per contribution.
 *  - Forge evidence governance (EMN §4.2): admitted / disputed / superseded / rejected / quarantined; stored material is not authority.
 * Rules enforced here: contributions are per-item, tap-consented, signed (ECDSA P-256 device key sealed in the vault) and attributed; secret
 * shapes and sensitive/vault records can never enter; incoming manifests are verified, then QUARANTINED until the user reviews them;
 * accepted knowledge is evidence_only and never becomes a memory fact; no price/payment fields are accepted (economy NOT_AUTHORIZED). */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports; const { sha256 } = isNode ? require('./sha256.js') : root.KSha;
const SECRETISH = /\b(?:\d{4}[ -]?){3}\d{4}\b|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_|-----BEGIN|password\s*(?:is|=)\s*\S/i;
/* v4.9.1: the secret-shape scan looks at CONTENT strings only. Machine encodings (signatures, public keys, ids, hashes) are random
 * base64url/hex and occasionally contain a 16-digit run bounded by '-', which made ~3% of honest publications fail as "secret-shaped". */
const MACHINE_KEY = /^(sig|pub|signer|id|x|y|hash|prev|nonce|kid)$|sha256$|_hash$|digest$|_ref$/;
const MACHINE_VAL = /^(?:sig-[0-9a-f]{16}|[a-z]{2,8}:[0-9a-f]{16,64}|[0-9a-f]{64})$/; /* key-derived signer ids, typed hash ids, bare sha256 */
const secretIn = (v, k, d) => { if ((d || 0) > 64) return false; if (typeof v === 'string') return !(k && MACHINE_KEY.test(k)) && !MACHINE_VAL.test(v) && SECRETISH.test(v); if (Array.isArray(v)) return v.some(x => secretIn(x, k, (d || 0) + 1)); if (v && typeof v === 'object') return Object.keys(v).some(kk => (!MACHINE_KEY.test(kk) && SECRETISH.test(kk)) || secretIn(v[kk], kk, (d || 0) + 1)); return false; };
const canon = o => (Array.isArray(o) ? '[' + o.map(canon).join(',') + ']' : o && typeof o === 'object' ? '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}' : JSON.stringify(o));
const CHALLENGES = ['provenance', 'method', 'scope', 'contradiction', 'dependency', 'reproducibility', 'statistical', 'falsification']; /* EMN §10 */
const STATES = ['Unassessed', 'Unsupported', 'Preliminary', 'Supported', 'Strongly Supported', 'Contested', 'Undermined', 'Superseded', 'Falsified Within Scope']; /* EMN §9 */
const FORBIDDEN_KEYS = /^(price|payment|payout|wallet|buyer|amount|currency)$/i;
const b64 = u => { let s = ''; const a = new Uint8Array(u); for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return (typeof btoa !== 'undefined' ? btoa(s) : Buffer.from(s, 'binary').toString('base64')); };
const unb64 = t => { const s = typeof atob !== 'undefined' ? atob(t) : Buffer.from(t, 'base64').toString('binary'); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
const subtle = () => globalThis.crypto.subtle; const te = new TextEncoder();
/* device signer: identity proves origin, never truth */
function Signer(store, vault) { const KEY = 'signing_key';
  async function ensure() { let k = store.load(KEY); if (k && !Array.isArray(k) && k.pub) return k; if (vault.status() !== 'unlocked') return null;
    const kp = await subtle().generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']); const pub = await subtle().exportKey('jwk', kp.publicKey); const priv = await subtle().exportKey('jwk', kp.privateKey);
    const e = await vault.seal('secret', 'device signing key (shared layer)', JSON.stringify(priv), {}); k = { pub: { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }, key_ref: e.id, signer: 'sig-' + sha256(canon({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y })).slice(0, 16) }; store.save(KEY, k); return k; }
  async function sign(body) { const k = await ensure(); if (!k) return null; const priv = await vault.reveal(k.key_ref); if (!priv) return null; const key = await subtle().importKey('jwk', JSON.parse(priv), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const sig = await subtle().sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(canon(body))); return { sig: b64(sig), signer: k.signer, pub: k.pub }; }
  return { ensure, sign, id: () => { const k = store.load(KEY); return k && k.signer ? k.signer : null; } }; }
async function verifySig(body, sig, pub) { try { const key = await subtle().importKey('jwk', Object.assign({ ext: true }, pub), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']); return await subtle().verify({ name: 'ECDSA', hash: 'SHA-256' }, key, unb64(sig), te.encode(canon(body))); } catch (e) { return false; } }
const bodyOf = m => { const b = Object.assign({}, m); delete b.sig; delete b.id; delete b.cosigners; return b; }; /* co-signatures sign the same body */
const hasForbidden = o => (o && typeof o === 'object' ? Object.keys(o).some(k => FORBIDDEN_KEYS.test(k) || hasForbidden(o[k])) : false);
/* ---- v4.8.4 strict, bounded per-kind schemas (validated AFTER signature verification, BEFORE storing or rendering) ---- */
const SIGID = /^sig-[0-9a-f]{16}$/, EMNID = /^emn:[0-9a-f]{64}$/, B64URL43 = /^[A-Za-z0-9_-]{43}$/, B64SIG = /^[A-Za-z0-9+/]{1,200}={0,2}$/;
const Str = (max, re, min) => ({ t: 'str', max, re, min: min || 0 }); const Int = (min, max) => ({ t: 'int', min, max }); const Bool = { t: 'bool' }; const En = (...v) => ({ t: 'enum', v });
const Obj = (req, opt) => ({ t: 'obj', req: req || {}, opt: opt || {} }); const Arr = (of, max, min) => ({ t: 'arr', of, max, min: min || 0 }); const Any = (depth, maxStr, maxArr, maxKeys) => ({ t: 'any', depth, maxStr, maxArr, maxKeys });
const JWK = Obj({ kty: En('EC'), crv: En('P-256'), x: Str(43, B64URL43), y: Str(43, B64URL43) }, { ext: Bool });
const SIGNED_BY = Obj({ signer: Str(20, SIGID), pub: JWK, sig: Str(200, B64SIG) }, { at: Str(40) });
const SOURCE = Obj({ kind: Str(40, null, 1), signer: Str(20, SIGID), pub: JWK }, { device: Str(100) });
const COMMON_OPT = { cosigners: Arr(SIGNED_BY, 8), co_creators: Arr(Str(20, SIGID), 8), first_breath: Arr(Obj({ signer: Str(20, SIGID), pub: JWK, sig: Str(200, B64SIG) }), 8), lineage: Arr(Obj({ parent: Str(80, EMNID), creator: Str(20, SIGID) }), 20) };
const HEAD = kind => ({ id: Str(68, EMNID), sig: Str(200, B64SIG), kind: En(kind), source: SOURCE, created: Str(40, null, 1), authority: En('evidence_only') });
const SCHEMAS = {
  'emn-claim-manifest/v1': Obj(Object.assign(HEAD('claim'), { schema: En('emn-claim-manifest/v1'), proposition: Str(2000, null, 1), scope: Str(500), falsification_conditions: Str(1000), polarity: En('pos', 'neg'),
    evidence: Arr(Obj({ type: Str(100, null, 1) }, { ref: Str(200), method: Str(200), uncertainty: Str(100) }), 20), ancestry_root: Str(200, null, 1) }),
    Object.assign({ proof_debt: Bool, consent: Obj({}, { item: Str(200), at: Str(40), scope: Str(100), revocable: Bool }) }, COMMON_OPT)),
  'emn-tool-package/v1': Obj(Object.assign(HEAD('tool_package'), { schema: En('emn-tool-package/v1'), lineage: COMMON_OPT.lineage,
    tool: Obj({ name: Str(31, /^[a-z][a-z0-9-]{1,30}$/), version: Int(1, 1000000), code: Str(20000, null, 1), sha: Str(64, /^[0-9a-f]{64}$/),
      tests: Arr(Obj({ input: Str(2000), expect: Any(4, 2000, 50, 20) }), 50, 1),
      manifest: Obj({ id: Str(80, null, 1), name: Str(31, /^[a-z][a-z0-9-]{1,30}$/), description: Str(300, null, 1), inputs: Arr(Str(40), 10), outputs: Arr(Str(40), 10), effect: En('compute'), side_effects: Arr(En('READ_ONLY'), 4), grants: Arr(Str(40), 0), authority: En('evidence_only'), uses_model: En(false), language: En('ForgeScript') }) }) }),
    { cosigners: COMMON_OPT.cosigners, co_creators: COMMON_OPT.co_creators, first_breath: COMMON_OPT.first_breath }),
  'emn-credit-ledger/v1': Obj(Object.assign(HEAD('credit_ledger'), { schema: En('emn-credit-ledger/v1'), format: Str(40, null, 1), device: Str(100, null, 1), checkpoint: Any(4, 200, 16, 16), chain: Arr(Any(3, 600, 16, 16), 200000),
    capsules: Arr(Any(5, 2000, 64, 40), 20000), econ_events: Arr(Any(6, 2000, 64, 40), 200000), usage_events: Arr(Any(2, 600, 4, 20), 200000), usage_totals: Arr(Any(2, 600, 4, 8), 200000), policy_version: Str(60, null, 1) }),
    { manifests: Arr(Any(8, 20000, 64, 40), 20000), usage: Any(3, 600, 1000, 1000), cosigners: COMMON_OPT.cosigners }) };
const MAX_DEPTH = 16;
function depthOf(v, d) { d = d || 0; if (d > MAX_DEPTH) return d; if (v && typeof v === 'object') { let m = d; for (const k of Object.keys(v)) { m = Math.max(m, depthOf(v[k], d + 1)); if (m > MAX_DEPTH) return m; } return m; } return d; }
function vcheck(v, sp, path, d) { const P = path || '$'; if (d > MAX_DEPTH) return 'NESTING ' + P;
  switch (sp.t) {
    case 'str': if (typeof v !== 'string') return 'TYPE ' + P; if (v.length > sp.max) return 'OVERSIZE ' + P; if (v.length < sp.min) return 'MISSING ' + P; if (sp.re && !sp.re.test(v)) return 'FORMAT ' + P; return null;
    case 'int': return Number.isInteger(v) && v >= sp.min && v <= sp.max ? null : 'TYPE ' + P;
    case 'bool': return typeof v === 'boolean' ? null : 'TYPE ' + P;
    case 'enum': return sp.v.includes(v) ? null : 'VALUE ' + P;
    case 'arr': { if (!Array.isArray(v)) return 'TYPE ' + P; if (v.length > sp.max) return 'OVERSIZE ' + P; if (v.length < sp.min) return 'MISSING ' + P; for (let i = 0; i < v.length; i++) { const e = vcheck(v[i], sp.of, P + '[' + i + ']', d + 1); if (e) return e; } return null; }
    case 'obj': { if (!v || typeof v !== 'object' || Array.isArray(v)) return 'TYPE ' + P; for (const k of Object.keys(sp.req)) if (!(k in v)) return 'MISSING ' + P + '.' + k;
      for (const k of Object.keys(v)) { const s2 = sp.req[k] || sp.opt[k]; if (!s2) return 'UNKNOWN-FIELD ' + P + '.' + k; const e = vcheck(v[k], s2, P + '.' + k, d + 1); if (e) return e; } return null; }
    case 'any': { if (d > MAX_DEPTH) return 'NESTING ' + P; const go = (x, dd, pp) => { if (dd > sp.depth) return 'NESTING ' + pp; if (x === null || typeof x === 'number' || typeof x === 'boolean') return x === null || typeof x !== 'number' || Number.isFinite(x) ? null : 'TYPE ' + pp;
        if (typeof x === 'string') return x.length > sp.maxStr ? 'OVERSIZE ' + pp : null; if (Array.isArray(x)) { if (x.length > sp.maxArr) return 'OVERSIZE ' + pp; for (let i = 0; i < x.length; i++) { const e = go(x[i], dd + 1, pp + '[' + i + ']'); if (e) return e; } return null; }
        if (typeof x === 'object') { const ks = Object.keys(x); if (ks.length > sp.maxKeys) return 'OVERSIZE ' + pp; for (const k of ks) { if (k.length > 64) return 'OVERSIZE ' + pp; const e = go(x[k], dd + 1, pp + '.' + k); if (e) return e; } return null; } return 'TYPE ' + pp; };
      return go(v, 0, P); }
  } return 'SPEC ' + P; }
function schemaProblem(m) { if (depthOf(m) > MAX_DEPTH) return 'SHARED-SCHEMA-NESTING'; const sp = SCHEMAS[m && m.schema]; if (!sp) return 'SHARED-SCHEMA';
  const kindOf = { 'emn-claim-manifest/v1': 'claim', 'emn-tool-package/v1': 'tool_package', 'emn-credit-ledger/v1': 'credit_ledger' }; if (m.kind !== kindOf[m.schema]) return 'SHARED-SCHEMA-KIND-MISMATCH';
  const e = vcheck(m, sp, '$', 0); return e ? 'SHARED-SCHEMA-' + e.split(' ')[0] + ':' + e.split(' ').slice(1).join(' ').slice(0, 80) : null; }
/* first breath: a named co-creator signs the exact author draft (the final body without first_breath) BEFORE the author signs and publishes */
const draftOf = m => { const b = bodyOf(m); delete b.first_breath; return b; };
const FB_PURPOSE = 'forge-first-breath-cocreate/v1';
const fbBody = draft => ({ purpose: FB_PURPOSE, draft_sha256: sha256(canon(draft)) });
async function check(m) { if (!m || typeof m !== 'object' || !/^emn:/.test(m.id || '')) return 'SHARED-BAD-SHAPE'; if (!/^emn-(claim-manifest|tool-package|credit-ledger)\/v1$/.test(m.schema || '')) return 'SHARED-SCHEMA';
  if ('emn:' + sha256(canon(bodyOf(m))) !== m.id) return 'SHARED-ID-HASH'; if (!m.source || !m.source.pub || !m.sig) return 'SHARED-UNSIGNED';
  if ('sig-' + sha256(canon(m.source.pub)).slice(0, 16) !== m.source.signer) return 'SHARED-SIGNER-MISMATCH'; if (!(await verifySig(bodyOf(m), m.sig, m.source.pub))) return 'SHARED-SIGNATURE';
  if (secretIn(m)) return 'SHARED-SECRET-SHAPE'; if (hasForbidden(m)) return 'SHARED-ECONOMY-NOT-AUTHORIZED'; if (m.authority !== 'evidence_only') return 'SHARED-AUTHORITY-CLAIM';
  if (m.cosigners !== undefined) { if (!Array.isArray(m.cosigners) || m.cosigners.length > 8) return 'SHARED-COSIGN-SHAPE'; const seen = new Set([m.source.signer]);
    for (const c of m.cosigners) { if (!c || !c.pub || !c.sig || seen.has(c.signer) || 'sig-' + sha256(canon(c.pub)).slice(0, 16) !== c.signer) return 'SHARED-COSIGNER-MISMATCH'; if (!(await verifySig(bodyOf(m), c.sig, c.pub))) return 'SHARED-COSIGNATURE'; seen.add(c.signer); } }
  const sp = schemaProblem(m); if (sp) return sp;
  if (m.first_breath !== undefined) { const named = new Set(m.co_creators || []); const seen = new Set([m.source.signer]); const fb = fbBody(draftOf(m));
    for (const c of m.first_breath) { if (!named.has(c.signer) || seen.has(c.signer) || 'sig-' + sha256(canon(c.pub)).slice(0, 16) !== c.signer) return 'SHARED-FIRST-BREATH-SIGNER'; if (!(await verifySig(fb, c.sig, c.pub))) return 'SHARED-FIRST-BREATH-SIGNATURE'; seen.add(c.signer); } }
  return null; }
/* deterministic co-signature merge: union by signer (first verified signature per signer kept), sorted by signer */
function mergeCosigners(a, b) { const by = new Map(); for (const c of [].concat(a || [], b || [])) if (c && c.signer && !by.has(c.signer)) by.set(c.signer, c); return [...by.keys()].sort().map(k => by.get(k)); }
const norm = t => String(t || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
function Shared(store, deps) { const { perm, ledger, signer } = deps; const now = () => (deps.clock ? deps.clock() : new Date().toISOString());
  async function publish(body) { const k = await signer.ensure(); if (!k) return { ok: false, rule: 'SHARED-VAULT-LOCKED' };
    const b = Object.assign({}, body, { source: Object.assign({}, body.source, { signer: k.signer, pub: k.pub }) }); const s = await signer.sign(b); if (!s) return { ok: false, rule: 'SHARED-VAULT-LOCKED' };
    const m = Object.assign({ id: 'emn:' + sha256(canon(b)), sig: s.sig }, b); const err = await check(m); if (err) return { ok: false, rule: err };
    const out = store.load('shared_outbox'); if (!out.some(x => x.id === m.id)) out.push(Object.assign({}, m, { _state: 'pending' })); store.save('shared_outbox', out.slice(-1000)); return { ok: true, manifest: m }; }
  /* per-item consented contribution of one of the user's own memory records */
  async function contribute(recordId, o) { o = o || {}; const d = perm.authorize('shared.contribute', { userTap: !!o.userTap, subject: recordId }); if (d.decision !== 'allow') return { ok: false, rule: d.rule };
    const cb = await contributeBody(recordId, o); if (!cb.ok) return cb; const res = await publish(cb.body); if (res.ok) ledger.append('shared_contribution', res.manifest.id); return res; }
  async function contributeBody(recordId, o) { o = o || {};
    const r = store.load('memory').find(x => x.id === recordId && x.status === 'active'); if (!r) return { ok: false, rule: 'SHARED-NO-SUCH-RECORD' };
    if (r.sensitive || r.kind === 'secret' || r.vault_ref) return { ok: false, rule: 'SHARED-VAULT-DATA-NEVER-SHARED' }; const tr = store.load('trace').find(x => r.provenance && x.turn === r.provenance.turn); const text = String(o.text || (tr && tr.input ? tr.input.replace(/^\s*(?:please\s+)?(?:remember|note|store|save)\s+(?:that\s+)?/i, '').replace(/[.!]+\s*$/, '') : '')).slice(0, 2000);
    if (!text) return { ok: false, rule: 'SHARED-NO-PROPOSITION' }; if (SECRETISH.test(text)) return { ok: false, rule: 'SHARED-SECRET-SHAPE' };
    const body = { schema: 'emn-claim-manifest/v1', kind: 'claim', proposition: text, scope: String(o.scope || 'as stated by the contributor'), falsification_conditions: String(o.falsification || 'unstated (proof debt)'), polarity: r.clause && r.clause.verb && r.clause.verb.pol === 'neg' ? 'neg' : 'pos',
      evidence: [{ type: 'contributor statement', ref: 'rec:' + sha256(r.id).slice(0, 16), method: 'user assertion via Forge kernel', uncertainty: 'unassessed' }], ancestry_root: o.root || 'root:' + sha256(norm(text) + '|' + (signer.id() || '')).slice(0, 16),
      source: { kind: 'user_memory', device: ledger.device() }, created: now(), authority: 'evidence_only', proof_debt: true, consent: { item: recordId, at: now(), scope: 'shared_layer', revocable: true } };
    return { ok: true, body }; }
  /* E3 co-signing: a collaborator signs the author's exact body; the author attaches it before (or after) publishing — id is unchanged */
  async function cosign(m, o) { o = o || {}; const d = perm.authorize('shared.contribute', { userTap: !!o.userTap, subject: m && m.id }); if (d.decision !== 'allow') return { ok: false, rule: d.rule };
    const err = await check(m); if (err) return { ok: false, rule: err }; const k = await signer.ensure(); if (!k) return { ok: false, rule: 'SHARED-VAULT-LOCKED' }; if (k.signer === m.source.signer) return { ok: false, rule: 'SHARED-COSIGN-SELF' };
    const sg = await signer.sign(bodyOf(m)); return { ok: true, cosignature: { signer: k.signer, pub: k.pub, sig: sg.sig, at: now() } }; }
  async function attachCosignature(id, cs) { const out = store.load('shared_outbox'); const m = out.find(x => x.id === id); if (!m) return { ok: false, rule: 'SHARED-NO-SUCH-CONTRIBUTION' };
    const t = Object.assign({}, m, { cosigners: mergeCosigners(m.cosigners, [cs]) }); if (t.cosigners.length === (m.cosigners || []).length) return { ok: true, dup: true, cosigners: t.cosigners.length }; delete t._state; const err = await check(t); if (err) return { ok: false, rule: err };
    m.cosigners = t.cosigners; if (m._state === 'pushed') m._state = 'pending'; store.save('shared_outbox', out); return { ok: true, cosigners: m.cosigners.length }; }
  /* ---- normal first-breath co-creation flow (v4.8.4) ----
   * 1. the author makes a DRAFT naming co-creators (nothing is published); 2. each named co-creator signs that exact draft on their own device;
   * 3. the author adds those signatures and publishes. Only signatures embedded before the author signs count as first-breath (x1). */
  async function draft(recordIdOrBody, coCreators, o) { o = o || {}; const d = perm.authorize('shared.contribute', { userTap: !!o.userTap, subject: 'draft' }); if (d.decision !== 'allow') return { ok: false, rule: d.rule };
    const k = await signer.ensure(); if (!k) return { ok: false, rule: 'SHARED-VAULT-LOCKED' }; const names = [...new Set((coCreators || []).map(String))].sort();
    if (!names.length || names.length > 8 || names.some(x => !SIGID.test(x) || x === k.signer)) return { ok: false, rule: 'SHARED-CO-CREATORS-INVALID' };
    let body; if (typeof recordIdOrBody === 'string') { const r = await contributeBody(recordIdOrBody, o); if (!r.ok) return r; body = r.body; } else body = Object.assign({}, recordIdOrBody);
    delete body.first_breath; delete body.cosigners; body.co_creators = names; body.source = Object.assign({}, body.source, { signer: k.signer, pub: k.pub });
    const dr = { draft_id: 'draft:' + sha256(canon(body)).slice(0, 24), body, purpose: FB_PURPOSE, draft_sha256: sha256(canon(body)), signatures: [], created: now(), state: 'draft' };
    const l = store.load('shared_drafts'); if (!l.some(x => x.draft_id === dr.draft_id)) l.push(dr); store.save('shared_drafts', l.slice(-200)); return { ok: true, draft: { draft_id: dr.draft_id, body, purpose: FB_PURPOSE, draft_sha256: dr.draft_sha256 } }; }
  async function signDraft(dr, o) { o = o || {}; const d = perm.authorize('shared.contribute', { userTap: !!o.userTap, subject: dr && dr.draft_id }); if (d.decision !== 'allow') return { ok: false, rule: d.rule };
    if (!dr || !dr.body || sha256(canon(dr.body)) !== dr.draft_sha256) return { ok: false, rule: 'SHARED-DRAFT-HASH' }; const k = await signer.ensure(); if (!k) return { ok: false, rule: 'SHARED-VAULT-LOCKED' };
    if (!(dr.body.co_creators || []).includes(k.signer)) return { ok: false, rule: 'SHARED-NOT-NAMED-CO-CREATOR' }; if (dr.body.source && dr.body.source.signer === k.signer) return { ok: false, rule: 'SHARED-COSIGN-SELF' };
    const sg = await signer.sign(fbBody(dr.body)); if (!sg) return { ok: false, rule: 'SHARED-VAULT-LOCKED' }; return { ok: true, signature: { draft_id: dr.draft_id, signer: k.signer, pub: k.pub, sig: sg.sig } }; }
  async function addDraftSignature(draftId, sgn) { const l = store.load('shared_drafts'); const dr = l.find(x => x.draft_id === draftId); if (!dr) return { ok: false, rule: 'SHARED-NO-SUCH-DRAFT' }; if (dr.state !== 'draft') return { ok: false, rule: 'SHARED-DRAFT-ALREADY-PUBLISHED' };
    if (!sgn || !(dr.body.co_creators || []).includes(sgn.signer) || 'sig-' + sha256(canon(sgn.pub || {})).slice(0, 16) !== sgn.signer || !(await verifySig(fbBody(dr.body), sgn.sig, sgn.pub))) return { ok: false, rule: 'SHARED-FIRST-BREATH-SIGNATURE' };
    dr.signatures = mergeCosigners(dr.signatures, [{ signer: sgn.signer, pub: sgn.pub, sig: sgn.sig }]); store.save('shared_drafts', l); return { ok: true, signed: dr.signatures.length, named: dr.body.co_creators.length }; }
  async function publishDraft(draftId, o) { o = o || {}; const l = store.load('shared_drafts'); const dr = l.find(x => x.draft_id === draftId); if (!dr) return { ok: false, rule: 'SHARED-NO-SUCH-DRAFT' }; if (dr.state !== 'draft') return { ok: false, rule: 'SHARED-DRAFT-ALREADY-PUBLISHED' };
    const d = perm.authorize('shared.contribute', { userTap: !!o.userTap, subject: draftId }); if (d.decision !== 'allow') return { ok: false, rule: d.rule };
    const body = Object.assign({}, dr.body); if (dr.signatures.length) body.first_breath = dr.signatures.map(x => ({ signer: x.signer, pub: x.pub, sig: x.sig }));
    const res = await publish(body); if (!res.ok) return res; dr.state = 'published'; dr.manifest_id = res.manifest.id; store.save('shared_drafts', l); ledger.append('shared_contribution', res.manifest.id); return Object.assign(res, { first_breath: dr.signatures.length }); }
  function revoke(id) { const out = store.load('shared_outbox'); const m = out.find(x => x.id === id); if (!m) return { ok: false, rule: 'SHARED-NO-SUCH-CONTRIBUTION' }; m._state = 'revoked'; m._revoked_at = now(); store.save('shared_outbox', out); return { ok: true, note: 'copies already pulled by others cannot be recalled; future pushes stop' }; }
  async function receive(list) { const inbox = store.load('shared_inbox'); const res = { quarantined: 0, refused: [], dup: 0 }; const mine = new Set(store.load('shared_outbox').map(x => x.id));
    for (const m of (Array.isArray(list) ? list : []).slice(0, 500)) { const known = inbox.find(x => x.manifest.id === (m && m.id)) || null;
      if (known || mine.has(m && m.id)) { /* v4.8.4: a known manifest may arrive with NEW verified co-signatures; merge them deterministically */
        if (m && Array.isArray(m.cosigners) && m.cosigners.length) { const err = await check(m); if (err) { res.refused.push(err); continue; }
          const merged = await mergeInto(m, inbox); if (merged) { res.cosign_merged = (res.cosign_merged || 0) + merged; continue; } }
        res.dup++; continue; }
      const err = await check(m); if (err) { res.refused.push(err); continue; }
      if (m.kind === 'credit_ledger') { const r = deps.economy ? await deps.economy.mergeForeign(m) : { ok: false, rule: 'ECON-ABSENT' }; (res.credit = res.credit || []).push(r.ok ? 'ok:' + r.rule : r.rule); continue; }
      inbox.push({ manifest: m, status: 'quarantined', received: now(), checks: ['id-hash', 'signature', 'signer-key', 'secret-shape', 'no-economy', 'evidence_only'] }); res.quarantined++; }
    store.save('shared_inbox', inbox.slice(-2000)); return res; }
  /* merge verified co-signatures of an already-known manifest into the inbox, accepted knowledge and own outbox copies (each re-verified as a whole) */
  async function mergeInto(m, inbox) { let added = 0; const targets = []; /* inbox: the caller's working copy (receive() saves it) */
    const ib = inbox.find(x => x.manifest.id === m.id); if (ib) targets.push([null, inbox, ib, 'manifest']);
    const kb = store.load('shared_knowledge'); const kk = kb.find(x => x.id === m.id); if (kk) targets.push(['shared_knowledge', kb, kk, 'manifest']);
    const out = store.load('shared_outbox'); const oo = out.find(x => x.id === m.id); if (oo) targets.push(['shared_outbox', out, oo, null]);
    for (const [name, list, ent, key] of targets) { const cur = key ? ent[key] : ent; const next = mergeCosigners(cur.cosigners, m.cosigners); if (next.length === (cur.cosigners || []).length) continue;
      const t = Object.assign({}, cur, { cosigners: next }); delete t._state; delete t._revoked_at; if (await check(t)) continue; const n = next.length - (cur.cosigners || []).length; cur.cosigners = next; if (!key && cur._state === 'pushed') cur._state = 'pending'; if (name) store.save(name, list); added = Math.max(added, n); }
    return added; }
  function review(id, decision, o) { o = o || {}; const d = perm.authorize('shared.review', { userTap: !!o.userTap, subject: id }); if (d.decision !== 'allow') return { ok: false, rule: d.rule };
    const inbox = store.load('shared_inbox'); const e = inbox.find(x => x.manifest.id === id && x.status === 'quarantined'); if (!e) return { ok: false, rule: 'SHARED-NOT-QUARANTINED' };
    e.status = decision === 'accept' ? 'accepted_as_evidence' : 'rejected'; e.reviewed = now(); e.reason = o.reason || null; store.save('shared_inbox', inbox);
    if (decision === 'accept') { const kb = store.load('shared_knowledge'); kb.push({ id, manifest: e.manifest, accepted: now(), authority: 'evidence_only' }); store.save('shared_knowledge', kb.slice(-5000)); ledger.append('shared_accept', id); if (deps.economy) e.candidate = deps.economy.candidate(e.manifest, { difficulty: o.difficulty }).candidate_id || null; store.save('shared_inbox', inbox); } /* evidence only: a ContributionEventCandidate, never canonical CT */
    if (decision !== 'accept' && deps.economy) deps.economy.void(id, 'rejected at review');
    return { ok: true, status: e.status, candidate: e.candidate || null }; }
  function challenge(id, type, note) { if (!CHALLENGES.includes(type)) return { ok: false, rule: 'SHARED-CHALLENGE-TYPE' }; const c = store.load('shared_challenges'); c.push({ target: id, type, note: String(note || '').slice(0, 500), at: now() }); store.save('shared_challenges', c.slice(-2000)); return { ok: true }; }
  /* EMN §7–9: support counts distinct ancestry roots (descendants count once); ordinal state + confidence vector; no scalar truth score */
  function assess(prop) { const n = norm(prop); const kb = store.load('shared_knowledge').filter(k => k.manifest.kind === 'claim' && norm(k.manifest.proposition) === n);
    const ch = store.load('shared_challenges').filter(c => kb.some(k => k.id === c.target)); const pos = kb.filter(k => k.manifest.polarity !== 'neg'), neg = kb.filter(k => k.manifest.polarity === 'neg');
    const roots = new Set(pos.map(k => k.manifest.ancestry_root)); const signers = new Set(pos.map(k => k.manifest.source.signer));
    if (deps.economy) for (const k of kb) deps.economy.use(k.id, k.manifest.source.signer, 'cite');
    let state = 'Unassessed'; if (pos.length) state = roots.size >= 2 ? 'Supported' : 'Preliminary'; if (neg.length || ch.some(c => c.type === 'contradiction' || c.type === 'falsification')) state = 'Contested';
    return { proposition: prop, state, contributions: kb.length, independent_roots: roots.size, signers: signers.size, vector: { directness: 'contributor statements only', provenance_integrity: kb.length ? 'signed' : 'none', independence_of_ancestry: roots.size, reproducibility: 'unassessed', resistance_to_challenge: ch.length ? ch.length + ' open challenge(s)' : 'unchallenged', unresolved_contradiction: neg.length, proof_debt: kb.some(k => k.manifest.proof_debt) },
      rule: 'EMN §2 evidence outranks consensus: repeated contributions from one root count once', authority: 'evidence_only' }; }
  async function sync(rpc) { const d = perm.authorize('shared.sync', { switchOn: perm.policy().sharedLayer === 'on' }); if (d.decision !== 'allow') return { ok: false, rule: d.rule };
    const out = store.load('shared_outbox'); const pend = out.filter(x => x._state === 'pending'); let pushed = 0;
    if (pend.length) { const r = await rpc('shared.put', { manifests: pend.map(x => { const m = Object.assign({}, x); delete m._state; return m; }) }); if (!r || !r.ok) return { ok: false, rule: 'SHARED-NODE-' + (r && r.error || 'error') }; pend.forEach(x => { x._state = 'pushed'; }); store.save('shared_outbox', out); pushed = pend.length; }
    const cur = store.load('shared_cursor'); let since = (cur && cur.since) || 0; let got = { quarantined: 0, refused: [], dup: 0 };
    for (let i = 0; i < 25; i++) { const r = await rpc('shared.get', { since }); if (!r || !r.ok) break; const x = await receive(r.manifests); got.quarantined += x.quarantined; got.dup += x.dup; got.refused.push(...x.refused); if (r.next === since || !r.manifests.length) break; since = r.next; }
    store.save('shared_cursor', { since }); return { ok: true, pushed, received: got }; }
  return { publish, contribute, draft, signDraft, addDraftSignature, publishDraft, drafts: () => store.load('shared_drafts'), cosign, attachCosignature, revoke, receive, review, challenge, assess, sync, outbox: () => store.load('shared_outbox'), inbox: () => store.load('shared_inbox'), knowledge: () => store.load('shared_knowledge') }; }
const api = { Shared, Signer, check, verifySig, canon, schemaProblem, mergeCosigners, SCHEMAS, fbBody, draftOf, CHALLENGES, STATES, SECRETISH, secretIn };
if (isNode) module.exports = api; else root.KShared = api;
})(typeof self !== 'undefined' ? self : this);
