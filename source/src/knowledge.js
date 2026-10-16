/* knowledge.js (4.9.42): GKS shared-fact layer — fact schema, source classes, ingestion from a verified GKS snapshot, EMN enforcement.
   Governing principle (EMN, Nic Bogaert; plan §0): weight comes from evidence lineage, never from counts; a signature proves who published, not that it is
   true; every surfaced fact carries its source and class; one well-evidenced challenge can demote a fact. No popularity field is admissible. */
(function (root) {
const isNode = typeof module !== 'undefined' && module.exports, { sha256 } = isNode ? require('./sha256.js') : root.KSha;
const canon = o => Array.isArray(o) ? '[' + o.map(canon).join(',') + ']' : o && typeof o === 'object' ? '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}' : JSON.stringify(o);
const SCHEMA = 'GKS-FACT/v1';
const CLASSES = ['primary_authority', 'reviewed_reference', 'secondary', 'weak_unverified']; /* ordinal (EMN §9: a state, not a score) */
const rank = c => { const i = CLASSES.indexOf(c); return i < 0 ? -1 : CLASSES.length - i; };
const STATUS = ['active', 'challenged', 'retracted'];
const POPULARITY = /^(?:endorse|vote|like|upvote|share_count|repost|popularity|count|score|reputation|followers)/i;
function validate(f) {
  const bad = r => ({ ok: false, rule: r, id: f && f.id });
  if (!f || typeof f !== 'object') return bad('GKS-FACT-SHAPE');
  for (const k of Object.keys(f)) if (POPULARITY.test(k)) return bad('EMN-NO-POPULARITY-FIELD');
  if (!/^gks:[a-z0-9][a-z0-9.:-]{1,80}$/.test(f.id || '')) return bad('GKS-FACT-ID');
  if (typeof f.subject !== 'string' || !f.subject.trim() || typeof f.text !== 'string' || !f.text.trim()) return bad('GKS-FACT-TEXT');
  const s = f.source; if (!s || CLASSES.indexOf(s.class) < 0) return bad('GKS-FACT-SOURCE-CLASS');
  if (typeof s.citation !== 'string' || !s.citation.trim()) return bad('GKS-FACT-NO-CITATION');
  if (s.class === 'primary_authority' && !/^https:\/\//.test(s.url || '')) return bad('GKS-FACT-PRIMARY-NEEDS-URL');
  if (typeof f.lineage_root !== 'string' || !f.lineage_root) return bad('EMN-LINEAGE-ROOT-REQUIRED');
  if (STATUS.indexOf(f.status || 'active') < 0) return bad('GKS-FACT-STATUS');
  if (f.body_sha256 && f.body_sha256 !== bodyHash(f)) return bad('GKS-FACT-HASH-MISMATCH');
  return { ok: true };
}
const bodyOf = f => { const b = Object.assign({}, f); delete b.body_sha256; delete b.status; delete b.challenges; return b; };
const bodyHash = f => sha256(canon(bodyOf(f)));
const seal = f => Object.assign({}, f, { status: f.status || 'active', body_sha256: bodyHash(f) });
/* EMN §6–7: descendants of one root count once — aggregation is over lineage roots, never over records */
const lineages = facts => { const m = new Map(); for (const f of facts) if (!m.has(f.lineage_root)) m.set(f.lineage_root, f); return [...m.values()]; };
/* EMN §10: a single typed challenge with evidence of equal or stronger class demotes the fact (endorsements are not counted — there are none) */
function challenge(fact, ev) {
  if (!ev || CLASSES.indexOf(ev.class) < 0 || typeof ev.citation !== 'string' || !ev.citation.trim()) return { ok: false, rule: 'EMN-CHALLENGE-NEEDS-EVIDENCE' };
  if (ev.lineage_root && ev.lineage_root === fact.lineage_root) return { ok: false, rule: 'EMN-SAME-LINEAGE' };
  if (rank(ev.class) < rank(fact.source.class)) return { ok: false, rule: 'EMN-CHALLENGE-WEAKER-EVIDENCE', note: 'recorded, does not demote' };
  return { ok: true, fact: Object.assign({}, fact, { status: 'challenged', challenges: (fact.challenges || []).concat([{ class: ev.class, citation: ev.citation, at: ev.at || null }]) }), rule: 'EMN-SINGLE-EVIDENCE-DEMOTES' };
}
/* ingestion from a pinned GKS snapshot (signature verified by gks.js beforehand); the signature is recorded as who-published, never as truth */
function ingest(body, verified) {
  if (!verified || !verified.ok) return { ok: false, rule: 'GKS-NOT-VERIFIED', facts: [] };
  const out = [], rejected = []; for (const f of (body && body.facts) || []) { const v = validate(f); if (v.ok) out.push(Object.assign(seal(f), { published_by: verified.kid || f.published_by || null, signature_means: 'publisher identity only (EMN §4.6)' })); else rejected.push(v); }
  return { ok: true, facts: out, rejected };
}
/* First seed (plan §1 seed policy): primary-authority definitional facts only, each with citation + URL. Integrity: covered by the release build manifest
   (not by the GKS publisher signature — that key lives only in the Actions secret). Source: BIPM, The International System of Units (SI), 9th ed. (2019). */
const BIPM = 'BIPM, The International System of Units (SI), 9th edition (2019)', BURL = 'https://doi.org/10.59161/AUEZ1291';
const si = (id, subject, text, sec, aliases) => seal({ schema: SCHEMA, id: 'gks:si:' + id, subject, aliases: aliases || [], text, source: { class: 'primary_authority', citation: BIPM + ', ' + sec, url: BURL, retrieved_at: '2026-10-15' }, lineage_root: 'root:bipm-si-brochure-9', scope: 'SI definition', published_by: 'build-manifest' });
const T1 = '§2.2 Table 1', T2 = '§2.3.1 Table 2';
const SEED = [
  si('c', 'the speed of light', 'The speed of light in vacuum is exactly 299 792 458 metres per second.', T1),
  si('h', 'the Planck constant', 'The Planck constant is exactly 6.626 070 15 × 10^-34 joule seconds.', T1),
  si('e', 'the elementary charge', 'The elementary charge is exactly 1.602 176 634 × 10^-19 coulombs.', T1),
  si('k', 'the Boltzmann constant', 'The Boltzmann constant is exactly 1.380 649 × 10^-23 joules per kelvin.', T1),
  si('na', 'the Avogadro constant', 'The Avogadro constant is exactly 6.022 140 76 × 10^23 per mole.', T1),
  si('second', 'the second', 'The second is the SI unit of time.', T2),
  si('metre', 'the metre', 'The metre is the SI unit of length.', T2, ['the meter']),
  si('kilogram', 'the kilogram', 'The kilogram is the SI unit of mass.', T2),
  si('ampere', 'the ampere', 'The ampere is the SI unit of electric current.', T2),
  si('kelvin', 'the kelvin', 'The kelvin is the SI unit of thermodynamic temperature.', T2),
  si('mole', 'the mole', 'The mole is the SI unit of amount of substance.', T2),
  si('candela', 'the candela', 'The candela is the SI unit of luminous intensity.', T2)
];
/* offline proof re-verification (plan §3): bundle hash, every shared premise re-validated and re-hashed; the answer is re-derived by the caller's realize */
function verifyProof(bundle, realize) { const out = []; if (!bundle || bundle.schema !== 'FORGE-PROOF/v1') return { ok: false, checks: [['schema', false]] };
  const b = Object.assign({}, bundle); delete b.sha256; out.push(['bundle sha256', sha256(canon(b)) === bundle.sha256]);
  for (const p of bundle.premises || []) if (p.kind === 'shared') out.push(['premise ' + p.id + ' valid + hash', validate(p.fact).ok && bodyHash(p.fact) === p.body_sha256 && p.fact.source.citation === p.citation]);
  if (realize) { let t = null; try { t = realize(bundle.meaning); } catch (e) { t = null; } out.push(['answer re-derived byte-identically', !!t && t.text === bundle.answer]); out.push(['Echo round trip on re-derivation', !!(t && t.echo && t.echo.pass)]); }
  return { ok: out.every(c => c[1]), checks: out }; }
const esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function proofHTML(b) { return '<!doctype html><meta charset="utf-8"><title>Forge proof report</title>' + (b.confidential ? '<p><strong>' + esc(b.confidential) + '</strong></p>' : '') + '<h1>Proof report</h1><p>Question: ' + esc(b.question) + '</p><p>Answer: ' + esc(b.answer) + '</p><h2>Premises</h2><ol>' + (b.premises || []).map(p => '<li>' + esc(p.kind) + ' ' + esc(p.id) + (p.citation ? ' — ' + esc(p.class) + ': ' + esc(p.citation) + (p.url ? ' (' + esc(p.url) + ')' : '') : '') + '</li>').join('') + '</ol><h2>Rule chain</h2><p>' + esc((b.rules || []).join(' → ')) + '</p><p>Echo: ' + esc(b.echo && b.echo.pass ? 'pass' : 'fail') + '</p><p>SHA-256: <code>' + esc(b.sha256) + '</code></p>'; }
const api = { verifyProof, proofHTML, SCHEMA, CLASSES, rank, validate, bodyHash, seal, lineages, challenge, ingest, SEED, canon };
if (isNode) module.exports = api; else root.KKnow = api;
})(typeof self !== 'undefined' ? self : this);
