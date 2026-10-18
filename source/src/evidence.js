/* evidence.js — the evidence engine (M3 part 2, 4.9.62). A lookup excerpt becomes an EVIDENCE OBJECT { claim, source, source rank class,
 * excerpt hash, retrieved-at }: it is evidence only, never a fact, never memory, never shared knowledge. Objects are sealed in the Identity
 * Vault; outside the vault only hashes remain. The SUPPORT LEVEL of an answer is read from the objects:
 *   corroborated — N ≥ 2 independent ranked sources state the same answer and none states another;
 *   single       — exactly one independent source states the answer ("probably");
 *   conflicting  — sources state different answers: both are shown with their ranks; the higher RANK CLASS decides (primary authority >
 *                  peer reviewed > structured reference > Wikipedia); equal top classes leave the answer undetermined;
 *   none         — no source states an answer ("No source decided the question").
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
function object(e, question, at) { const st = stance(e), excerpt = String(e.excerpt || '');
  const body = { schema: SCHEMA, question_sha256: sha256(norm(question)), claim: st ? { kind: st.kind, answer: st.answer } : null, source: { archive: String(e.archive || 'wikipedia'), name: String(e.name || 'Wikipedia'), title: String(e.title || '').slice(0, 120), url: String(e.url || '') },
    rank_class: classOf(e), excerpt_sha256: sha256(excerpt), retrieved_at: String(e.captured_at || at || ''), evidence_only: true };
  return Object.assign({ id: 'evd:' + sha256(canon(body)).slice(0, 24) }, body); }
/* independence: an encyclopedia or a structured reference is ONE source per archive (one publisher: two Wikipedia articles are not two witnesses);
   a primary authority or a peer-reviewed document is one source per document (archive + title) */
const sourceKey = o => (o.rank_class === 'encyclopedia' || o.rank_class === 'structured_reference' ? o.source.archive : o.source.archive + '|' + norm(o.source.title));
/* the support level of an answer, from evidence objects alone (deterministic; same objects → same level) */
function support(objs) { const dec = objs.filter(o => o && o.claim), groups = new Map();
  for (const o of dec) { const k = o.claim.answer; if (!groups.has(k)) groups.set(k, new Map()); const g = groups.get(k), sk = sourceKey(o); if (!g.has(sk)) g.set(sk, o); }
  const side = ([answer, g]) => { const os = [...g.values()].sort((a, b) => RANK_ORDER.indexOf(a.rank_class) - RANK_ORDER.indexOf(b.rank_class) || a.source.name.localeCompare(b.source.name) || a.id.localeCompare(b.id)); return { answer, sources: os.length, top: best(os.map(o => o.rank_class)), ids: os.map(o => o.id).sort(), names: os.map(o => o.source.name) }; };
  const sides = [...groups.entries()].map(side).sort((a, b) => RANK_ORDER.indexOf(a.top) - RANK_ORDER.indexOf(b.top) || a.answer.localeCompare(b.answer));
  const out = { schema: SUPPORT_SCHEMA, evidence: objs.length, deciding: dec.length };
  if (!sides.length) return Object.assign(out, { level: 'none', answer: null });
  if (sides.length === 1) return Object.assign(out, sides[0].sources >= 2 ? { level: 'corroborated', answer: sides[0].answer, n: sides[0].sources, side: sides[0] } : { level: 'single', answer: sides[0].answer, n: 1, side: sides[0] });
  const top = sides[0], tie = sides.filter(s => s.top === top.top).length > 1;
  return Object.assign(out, { level: 'conflicting', sides, decided: !tie, answer: tie ? null : top.answer, rule: tie ? 'equal top rank (' + RANK_NAME[top.top] + '): undetermined; evidence counts over majority' : 'the ' + RANK_NAME[top.top] + ' source outranks the ' + RANK_NAME[sides[1].top] + ' source; evidence counts over majority' }); }
const api = { SCHEMA, SUPPORT_SCHEMA, RANK_ORDER, RANK_NAME, classOf, outranks, stance, object, support, sourceKey };
if (isNode) module.exports = api; else root.KEvidence = api;
})(typeof self !== 'undefined' ? self : this);
