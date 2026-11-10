/* evidence.js — the evidence engine (M3 part 2, 4.9.62). A lookup excerpt becomes an EVIDENCE OBJECT { claim, source, source rank class,
 * excerpt hash, retrieved-at }: it is evidence only, never a fact, never memory, never shared knowledge. Objects are sealed in the Identity
 * Vault; outside the vault only hashes remain. The SUPPORT LEVEL of an answer is read from the objects:
 *   corroborated — N ≥ 2 independent ranked sources state the same answer and none states another;
 *   single       — exactly one independent source states the answer ("probably");
 *   conflicting  — sources state different answers: both are shown with their ranks; the higher RANK CLASS decides (primary authority >
 *                  peer reviewed > structured reference > Wikipedia); equal top classes leave the answer undetermined;
 *   answered     — (4.9.63) no comparable value, but N independent sources give a passage fitted to the question's answer type
 *                  (a definition, a method, a cause): passages are never compared, so they neither corroborate nor conflict;
 *   none         — no source states an answer. A yes/no question says "No source decided the question."; a wh/value question
 *                  says it found related passages that did not answer it directly (the claim is the EXTRACTED answer, archives.extract).
 * Evidence counts over majority: the number of sources on each side is never compared — only the rank order (an ordinal, no weights).
 * Independence: an encyclopedia / structured reference counts once per archive; a primary or peer-reviewed document once per document. */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports;
const { sha256 } = isNode ? require('./sha256.js') : root.KSha;
const SCHEMA = 'FORGE-EVIDENCE/v1', SUPPORT_SCHEMA = 'FORGE-SUPPORT/v1';
/* the rank ORDER, highest first; position is the only thing compared */
const RANK_ORDER = Object.freeze(['primary_authority', 'peer_reviewed', 'structured_reference', 'encyclopedia']);
const RANK_NAME = Object.freeze({ primary_authority: 'primary authority', peer_reviewed: 'peer reviewed', structured_reference: 'structured reference', encyclopedia: 'Wikipedia' });
const classOf = e => (RANK_ORDER.includes(e.cls) ? e.cls : 'encyclopedia');
const outranks = (a, b) => RANK_ORDER.indexOf(a) < RANK_ORDER.indexOf(b);
const best = cls => cls.slice().sort((a, b) => RANK_ORDER.indexOf(a) - RANK_ORDER.indexOf(b))[0];
const canon = v => (Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v));
const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/* the answer an excerpt STATES: a yes/no verdict, or a typed value (a Wikidata-style value); a prose excerpt that merely fits the answer type
   states no comparable answer and decides nothing on its own */
function stance(e) { if (e.verdict && /^(yes|no)$/i.test(e.verdict.answer)) return { kind: 'verdict', answer: e.verdict.answer.toLowerCase() };
  if (e.value != null && String(e.value).trim()) return { kind: 'value', answer: norm(e.value) }; return null; }
function object(e, question, at) { const st = 'claim' in e ? e.claim : stance(e), /* 4.9.63: the caller's answer-type-fitted claim (archives.extract) when given */ excerpt = String(e.excerpt || '');
  const body = { schema: SCHEMA, question_sha256: sha256(norm(question)), claim: st ? { kind: st.kind, answer: st.answer } : null, source: { archive: String(e.archive || 'wikipedia'), name: String(e.name || 'Wikipedia'), title: String(e.title || '').slice(0, 120), url: String(e.url || '') },
    rank_class: classOf(e), excerpt_sha256: sha256(excerpt), retrieved_at: String(e.captured_at || at || ''), evidence_only: true };
  if (typeof e.entailed === 'boolean') body.entailed = e.entailed; /* 4.9.74: false = no verbatim span of the excerpt states the claim */
  return Object.assign({ id: 'evd:' + sha256(canon(body)).slice(0, 24) }, body); }
/* independence: an encyclopedia or a structured reference is ONE source per archive (one publisher: two Wikipedia articles are not two witnesses);
   a primary authority or a peer-reviewed document is one source per document (archive + title) */
const sourceKey = o => (o.rank_class === 'encyclopedia' || o.rank_class === 'structured_reference' ? o.source.archive : o.source.archive + '|' + norm(o.source.title));
/* the support level of an answer, from evidence objects alone (deterministic; same objects → same level) */
function support(all) { const objs = all.filter(o => o && o.entailed !== false); /* 4.9.74: citation presence is not support: an object whose excerpt holds no verbatim span stating its claim never counts */ const dec = objs.filter(o => o && o.claim && o.claim.kind !== 'passage'), pas = objs.filter(o => o && o.claim && o.claim.kind === 'passage'), groups = new Map();
  for (const o of dec) { const k = o.claim.answer; if (!groups.has(k)) groups.set(k, new Map()); const g = groups.get(k), sk = sourceKey(o); if (!g.has(sk)) g.set(sk, o); }
  const side = ([answer, g]) => { const os = [...g.values()].sort((a, b) => RANK_ORDER.indexOf(a.rank_class) - RANK_ORDER.indexOf(b.rank_class) || a.source.name.localeCompare(b.source.name) || a.id.localeCompare(b.id)); return { answer, sources: os.length, top: best(os.map(o => o.rank_class)), ids: os.map(o => o.id).sort(), names: os.map(o => o.source.name) }; };
  const sides = [...groups.entries()].map(side).sort((a, b) => RANK_ORDER.indexOf(a.top) - RANK_ORDER.indexOf(b.top) || a.answer.localeCompare(b.answer));
  const out = { schema: SUPPORT_SCHEMA, evidence: all.length, deciding: dec.length };
  /* 4.9.63: a fitted descriptive passage answers, but two passages are never compared: the level says how many independent sources answered */
  if (!sides.length && pas.length) { const ks = new Set(pas.map(sourceKey)); return Object.assign(out, { level: 'answered', answer: null, n: ks.size }); }
  if (!sides.length) return Object.assign(out, { level: 'none', answer: null });
  if (sides.length === 1) return Object.assign(out, sides[0].sources >= 2 ? { level: 'corroborated', answer: sides[0].answer, n: sides[0].sources, side: sides[0] } : { level: 'single', answer: sides[0].answer, n: 1, side: sides[0] });
  const top = sides[0], tie = sides.filter(s => s.top === top.top).length > 1;
  return Object.assign(out, { level: 'conflicting', sides, decided: !tie, answer: tie ? null : top.answer, rule: tie ? 'equal top rank (' + RANK_NAME[top.top] + '): undetermined; evidence counts over majority' : 'the ' + RANK_NAME[top.top] + ' source outranks the ' + RANK_NAME[sides[1].top] + ' source; evidence counts over majority' }); }

/* ---- 4.9.74 PROVENANCE, ENTAILMENT, SUBJECT GUARD, AGREEMENT (Nic): the logic lives in provenance.js (pure, no imports; see its header);
   evidence.js re-exports it so the evidence API stays one surface. Tier mapping (declared data, documented in CONFLICTS.md): primary authority →
   curated_archive; peer reviewed → peer_reviewed_index; structured reference (Wikidata, openly edited), Wikipedia and general web → open_fallback. */
const PV = isNode ? require('./provenance.js') : root.KProv;
const TIERS = PV.TIERS, TIER_OF = PV.TIER_OF_RANK, TIER_NAME = PV.TIER_LABEL, tierOf = PV.tierOf, keyOf = PV.keyContent, covers = PV.covers, entail = PV.extractSpan, provenance = PV.provenance;
const verifySpan = (excerpt, span, key) => PV.checkSpan(excerpt, span, key).ok;
const api = { TIERS, TIER_OF, TIER_NAME, tierOf, keyOf, covers, entail, verifySpan, provenance, subjectMatch: PV.subjectMatch, agreement: PV.agreement, report: PV.report, SCHEMA, SUPPORT_SCHEMA, RANK_ORDER, RANK_NAME, classOf, outranks, stance, object, support, sourceKey };
if (isNode) module.exports = api; else root.KEvidence = api;
})(typeof self !== 'undefined' ? self : this);
