/* provenance.js — honest evidence and authority layers (4.9.74, Nic 2026-10-19: "make the evidence and authority layers honest", items 1–6).
 * Pure and deterministic: no model, no embeddings, no network, no store, no memory, no imports. evidence.js re-exports the evidence half.
 * 1. EGRESS. The authority boundary carries no single "network" flag. kernel_network is always "none" (the kernel never fetches);
 *    tool_egress is "<tool> · external" when the tool's Tool Bench manifest declares a network effect (an unknown tool counts as external),
 *    "<tool> · on-device" otherwise, or "none" when no tool ran. boundaryLabels renders the labels the app shows.
 * 2. TIERS. primary_authority → curated_archive; peer_reviewed → peer_reviewed_index; structured_reference (Wikidata, openly edited),
 *    encyclopedia (Wikipedia) and any other class (general web) → open_fallback. The summary line counts the non-zero tiers in that order
 *    ("sources: 3 curated, 2 open fallback"); an open-fallback-only answer says so in the line itself.
 * 3. ENTAILMENT. Citation presence is not support. A cited source supports the sentence it is attached to only through a VERBATIM span of
 *    its stored excerpt (an exact substring) holding the sentence's key content: every token of the extracted value (and a value at all when
 *    the question asks for a date / person / place / quantity), every entity word of the question, one relation-word form when the question
 *    has one, and for a yes/no answer its polarity (a negation cue exactly when the answer is "no", flipped for a negated question).
 *    The span is one sentence. Two adjacent sentences form one span only when the first names the entity in its subject and the second's
 *    subject is a pronoun (It / He / She / They) or a definite reference ("The X") whose noun X is the entity's head or the noun of the
 *    first sentence's copular predicate ("Berlin is the capital city … The city …"); anything else is unsupported (Nic's span ruling).
 *    A span offered from outside is accepted only by checkSpan: an exact substring of that source's own excerpt, lawful in length, with the
 *    key content (not_verbatim / multi_sentence_span / missing_key_content otherwise).
 * 4. SUBJECT GUARD. A source may support a claim only if its PRIMARY ENTITY matches the question's entity. Primary entity: the title's head
 *    phrase (the words before the first preposition / conjunction / punctuation; a parenthetical qualifier is dropped), else the excerpt's
 *    lead subject. Match: every question-entity word is in the head phrase (ordinals and numbers exactly: "first" ≠ "twenty-first"), and the
 *    head phrase ends in the entity's head noun (a "First Amendment audit" is about the entity, not the entity). Mismatch: SUBJECT_MISMATCH.
 * 5. AGREEMENT. "K agree, M disagree, N unusable", counted over ORIGINS, never over ranked results: one publisher / upstream is one origin
 *    (Wikipedia and Wikidata are one Wikimedia origin; an archive is its publisher); a peer-reviewed record is its paper (one paper in two
 *    indexes is one origin); a general web page is its domain. An origin agrees when one of its subject-matched sources has a verbatim span
 *    for the answer; it disagrees when its span states a different answer; otherwise it is unusable. */
(function (root) {
'use strict';
const SCHEMA = 'FORGE-PROVENANCE/v1';
const TIERS = Object.freeze(['curated_archive', 'peer_reviewed_index', 'open_fallback']);
const TIER_OF_RANK = Object.freeze({ primary_authority: 'curated_archive', peer_reviewed: 'peer_reviewed_index', structured_reference: 'open_fallback', encyclopedia: 'open_fallback' });
const TIER_LABEL = Object.freeze({ curated_archive: 'curated archive', peer_reviewed_index: 'peer-reviewed index', open_fallback: 'open fallback' });
const TIER_SHORT = Object.freeze({ curated_archive: 'curated', peer_reviewed_index: 'peer-reviewed', open_fallback: 'open fallback' });
const tierOf = cls => (Object.prototype.hasOwnProperty.call(TIER_OF_RANK, cls) ? TIER_OF_RANK[cls] : 'open_fallback');
/* ---------------- 1. EGRESS ---------------- */
const egressOf = manifest => (manifest && !manifest.network ? 'on-device' : 'external');
const egressLabel = (tool, manifest) => (tool ? String(tool) + ' · ' + egressOf(manifest) : 'none');
function boundaryLabels(ab) { const b = ab || {}; const flag = k => k.replace(/_/g, ' ') + ': ' + (b[k] ? 'yes' : 'no');
  const eg = typeof b.tool_egress === 'string' && b.tool_egress ? b.tool_egress : 'none';
  return [flag('calls_llm'), flag('writes_files'), 'kernel network: ' + (b.kernel_network || 'none'), 'tool egress: ' + eg, flag('execution_enabled'), flag('memory_write')]; }
/* ---------------- 2. TIERS ---------------- */
function summaryText(c) { const n = k => (c && c[k]) || 0; const parts = TIERS.filter(k => n(k) > 0).map(k => n(k) + ' ' + TIER_SHORT[k]);
  if (!parts.length) return 'sources: none'; const fb = n('open_fallback') > 0 && n('curated_archive') + n('peer_reviewed_index') === 0;
  return 'sources: ' + parts.join(', ') + (fb ? ' (open fallback only: no curated or peer-reviewed source)' : ''); }
/* ---------------- words ---------------- */
const FUNCTION_WORDS = new Set(('a an the of to in on at by for with from into onto about than as and or but if then so not no nor yes ' +
  'what who whom whose when where why how which that this these those there here it its they them their he she his her him we us our you your i me my mine ' +
  'do does did done doing can could will would shall should may might must be is are was were been being am have has had having ' +
  'research search look up tell please find show give explain describe much many some any all').split(' '));
const NEG = /\b(not|no|never|none|cannot|without|neither|nor)\b|n't\b/i;
const ORDINAL = /^(\d+(st|nd|rd|th)?|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|[a-z]+-(first|second|third|[a-z]+th)|[a-z]+teenth|[a-z]+ieth|hundredth|thousandth)$/;
const words = t => String(t || '').replace(/(\d),(?=\d{3}\b)/g, '$1').toLowerCase().replace(/[‐‑–]/g, '-').match(/[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[0-9]+)?/g) || [];
const stem = w => (ORDINAL.test(w) || /\d/.test(w) ? w : (s => (s.length >= 3 ? s : w))(w.replace(/(ing|ed|es|s|e)$/, '')));
const same = (a, b) => a === b || (!ORDINAL.test(a) && !ORDINAL.test(b) && stem(a) === stem(b));
const uniq = xs => [...new Set(xs)];
const flat = xs => [].concat(...(xs || []).map(x => (Array.isArray(x) ? flat(x) : words(x))));
/* ---------------- 3. ENTAILMENT ---------------- */
const VALUE_TYPES = new Set(['date', 'person', 'place', 'quantity']);
/* relation words of the question (asked predicate forms; the degree word and dimension noun of a quantity question) */
const relationOf = p => uniq([].concat(p.askedForms || [], p.predForms || [], [p.asked, p.pred, p.degree, p.dimNoun]).filter(Boolean).map(x => String(x).toLowerCase()).filter(x => /^[a-z]+$/.test(x)));
/* the question's entity: the lookup plan's entity / object, else the first run of content words that are not relation words */
function questionEntity(plan, question) { const p = plan || {}; if (p.subject) return words(p.subject).join(' '); /* 4.9.78: the parse's subject noun phrase first */ if (p.entity) return words(p.entity).join(' '); const ws = words(question || p.question || '');
  /* 4.9.80 ENT-OF-COMPLEMENT: an attribute noun phrase "the N of X" ("the main function of the spleen", "the symptoms of measles", "the boiling
     point of ethanol") is about X: when the candidate is directly followed by "of", the entity is the content run after it */
  const ofTail = cand => { const cw = words(cand); if (!cw.length) return cand; /* a capitalised head is part of a name ("the Bank of England"), kept whole */ if (new RegExp('(?:^|\\s)(?:the\\s+)?' + cw[cw.length - 1].replace(/[^a-z0-9]/g, '') + '\\s+of\\b', 'i').test(question || '') && new RegExp('\\b' + cw[cw.length - 1][0].toUpperCase() + cw[cw.length - 1].slice(1).replace(/[^a-z0-9]/g, '') + '\\s+of\\b').test(String(question || '').replace(/^\\s*\\S+/, ''))) return cand; for (let i = 0; i + cw.length < ws.length; i++) { if (cw.every((w, j) => ws[i + j] === w) && ws[i + cw.length] === 'of') { const out = []; for (const w of ws.slice(i + cw.length + 1)) { if (!out.length && /^(the|a|an)$/.test(w)) continue; if (FUNCTION_WORDS.has(w)) break; out.push(w); } return out.length ? out.join(' ') : cand; } } return cand; };
  if (p.object) return ofTail(words(p.object).join(' '));
  const rel = relationOf(p), run = []; let started = false;
  for (const w of ws) { const content = !FUNCTION_WORDS.has(w) && !rel.some(r => same(r, w)); if (content) { run.push(w); started = true; } else if (started) break; }
  return ofTail(run.join(' ')); }
/* the key content of the answer sentence a source is cited for */
function keyContent(plan, claim) { const p = plan || {}; const relation = relationOf(p);
  const value = claim && claim.kind === 'value' && claim.answer ? uniq(words(claim.answer)) : [];
  const entities = uniq(words(p.subject || p.question || [].concat(p.object ? [p.object] : [], p.entity ? [p.entity] : [], p.args || []).join(' ')).filter( /* 4.9.78: the parse's subject noun phrase when it has one (a participle predicate is not an entity word) */w => !FUNCTION_WORDS.has(w) && !relation.some(r => same(r, w)) && !value.some(v => same(v, w))));
  const polarity = claim && claim.kind === 'verdict' && /^(yes|no)$/i.test(claim.answer) ? ((String(claim.answer).toLowerCase() === 'no') !== !!p.neg ? 'negative' : 'positive') : null;
  return { value, entities, relation, polarity, needs_value: VALUE_TYPES.has(p.atype) && !value.length }; }
/* any key shape (keyContent's, or { value: '1989', entities: [['berlin', 'wall']], relation: [...] }) → the normal form */
const normKey = k => { k = k || {}; return { value: Array.isArray(k.value) ? k.value.map(String) : k.value ? words(k.value) : [], entities: uniq(flat(k.entities)), relation: (k.relation || []).map(r => String(r).toLowerCase()), polarity: k.polarity || null, needs_value: !!k.needs_value }; };
const hasKey = k => !k.needs_value && !!(k.value.length || k.entities.length || k.relation.length);
function covers(span, k0) { const k = normKey(k0); if (!hasKey(k)) return false; const ws = words(span); const has = w => ws.some(x => same(x, w));
  if (!k.value.every(w => ws.includes(w))) return false; if (!k.entities.every(has)) return false; if (k.relation.length && !k.relation.some(has)) return false;
  if (k.polarity && NEG.test(span) !== (k.polarity === 'negative')) return false; return true; }
/* sentences as [start, end) offsets: a break after . ! ? followed by space and a capital / digit / quote, or at a newline */
function sentences(ex) { const s = String(ex || ''), out = []; const re = /[.!?]["”’)]?(?=\s+[A-Z0-9“"(])|\n+/g; let a = 0, m;
  while ((m = re.exec(s))) { const b = m[0][0] === '\n' ? m.index : m.index + m[0].length; out.push([a, b]); a = b; } out.push([a, s.length]);
  return out.map(([x, y]) => { const t = s.slice(x, y), lead = t.length - t.replace(/^\s+/, '').length, tail = t.length - t.replace(/\s+$/, '').length; return [x + lead, y - tail]; }).filter(([x, y]) => y > x); }
const COPULA = /\b(is|was|are|were)\b/i;
/* may sentence s2 continue s1 as one span? s1 names every entity word in its subject (its first entity-length + 2 words); s2's subject is a
   pronoun, or "The / This X" with X the entity's head noun or a noun of s1's copular predicate */
function joinable(s1, s2, k0) { const k = normKey(k0), ents = k.entities; if (!ents.length) return false; const w1 = words(s1), lead = w1.slice(0, ents.length + 2);
  if (!ents.every(e => lead.some(x => same(x, e)))) return false;
  if (/^(It|He|She|They)\b/.test(s2)) return true;
  const d = /^(?:The|This)\s+([a-z]+)\b/.exec(s2); if (!d) return false; const x = d[1];
  if (same(x, ents[ents.length - 1])) return true; const cop = COPULA.exec(s1); return !!cop && words(s1.slice(cop.index + cop[0].length)).some(w => same(w, x)); }
function extractSpan(excerpt, key) { const s = String(excerpt || ''), ss = sentences(s); if (!hasKey(normKey(key))) return null;
  for (const [a, b] of ss) { const t = s.slice(a, b); if (covers(t, key)) return t; }
  for (let i = 0; i + 1 < ss.length; i++) { const s1 = s.slice(ss[i][0], ss[i][1]), s2 = s.slice(ss[i + 1][0], ss[i + 1][1]); if (joinable(s1, s2, key)) { const t = s.slice(ss[i][0], ss[i + 1][1]); if (covers(t, key)) return t; } }
  return null; }
function checkSpan(excerpt, span, key) { if (typeof span !== 'string' || !span.trim()) return { ok: false, reason: 'empty_span' };
  if (!String(excerpt || '').includes(span)) return { ok: false, reason: 'not_verbatim' };
  if (!hasKey(normKey(key))) return { ok: false, reason: 'no_key_content' };
  const ss = sentences(span); if (ss.length > 2 || (ss.length === 2 && !joinable(span.slice(ss[0][0], ss[0][1]), span.slice(ss[1][0], ss[1][1]), key))) return { ok: false, reason: 'multi_sentence_span' };
  if (!covers(span, key)) return { ok: false, reason: 'missing_key_content' }; return { ok: true, reason: 'verbatim_span_with_key_content' }; }
/* ---------------- 4. SUBJECT GUARD ---------------- */
const CUT = new Set('to of in on at for and or from by with as under versus vs'.split(' '));
function primaryEntity(src) { const s = src || {}; const title = String(s.title || '').replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  if (title) { const head = []; for (const part of title.split(/[,:;–—|]/)[0].split(/\s+/)) { const w = words(part)[0]; if (!w) continue; if (CUT.has(w) && head.length) break; if (!(head.length === 0 && /^(the|a|an)$/.test(w))) head.push(...words(part)); } return head.join(' '); }
  const first = String(s.excerpt || '').slice(0, (sentences(s.excerpt)[0] || [0, 0])[1]); const toks = first.split(/\s+/).filter(Boolean); const run = [];
  for (const t of toks) { if (!run.length && /^(The|A|An)$/.test(t)) continue; if (/^[A-Z0-9]/.test(t)) run.push(...words(t)); else break; }
  if (run.length) return run.join(' '); const cop = COPULA.exec(first); return words(cop ? first.slice(0, cop.index) : first).filter(w => !/^(the|a|an)$/.test(w)).join(' '); }
/* 4.9.75 (Nic 12:32): the LEAD SUBJECT of a text: the grammatical subject of its first sentence. The subject is the run of words before
   the first finite verb: a copula, modal or common verb, or a lowercase word ending in -s/-es/-ed after a noun. It is cut to its head like
   a title. A sentence that opens with a preposition or a pronoun has no lead subject. Deterministic; no model */
const VERB_LIST = new Set('is are was were be been has have had do does did can could may might must shall should will would means refers provides prevents protects requires became remains includes contains fell began wrote made took gave came went built won led grew rose held ran found brought saw said told left met kept lost paid sent spent broke chose drew drove flew knew lay rode sang sank shook spoke stole struck threw wore bore sought taught thought fought'.split(' '));
const PRONOUN_LEAD = new Set('it he she they this that these those we you i there here'.split(' '));
function headCut(toks) { const head = []; for (const w of toks) { if (CUT.has(w) && head.length) break; if (!(head.length === 0 && /^(the|a|an)$/.test(w))) head.push(w); } return head; }
function leadSubject(text) { const c = leadClause(text); return c ? c.subject : null; }
function leadClause(text) { const s = String(text || ''); const ss = sentences(s); if (!ss.length) return null; const first = s.slice(ss[0][0], ss[0][1]).replace(/\s*\([^)]*\)\s*/g, ' ');
  const raw = first.split(/\s+/).filter(Boolean); const toks = []; for (const t of raw) { const w = words(t); if (!w.length) continue; toks.push({ w: w.join('-').replace(/-/g, w.length > 1 ? '-' : ''), ws: w, cap: /^[A-Z0-9“"]/.test(t), punct: /[,;:]$/.test(t) }); }
  if (!toks.length) return null; const f0 = toks[0].ws[0]; if (PRONOUN_LEAD.has(f0) || (CUT.has(f0) && !/^(the|a|an)$/.test(f0))) return null;
  const subj = []; for (let i = 0; i < toks.length; i++) { const t = toks[i], w = t.ws[t.ws.length - 1];
    const verb = subj.some(x => !/^(the|a|an)$/.test(x)) && !t.cap && !CUT.has(w) && !FUNCTION_WORDS.has(w) ? (VERB_LIST.has(w) || /^[a-z]{3,}(s|es|ed)$/.test(w) && !/(ss|us|is)$/.test(w)) : VERB_LIST.has(w) && subj.length > 0;
    const nx = toks[i + 1] && toks[i + 1].ws[0]; const beforeDet = subj.length > 0 && !t.cap && !CUT.has(w) && !FUNCTION_WORDS.has(w) && /^(the|a|an|this|that|these|those|its|their|his|her)$/.test(nx || ''); /* "Auditors test the …": a bare word before a determiner is the verb */
    if (verb || beforeDet) { const head = headCut(subj); return head.length ? { subject: head.join(' '), verb: w } : null; } subj.push(...t.ws); if (t.punct) break; if (i > 14) return null; }
  const head = headCut(subj); return head.length ? { subject: head.join(' '), verb: null } : null; }
/* 4.9.75 (Nic 12:32, "What is X?"): a DEFINITIONAL sentence: its grammatical subject names X and a finite verb follows ("The First Amendment …
   prevents Congress from …"); returns that verbatim sentence, or null */
function definitional(text, entity) { const s = String(text || ''), q = words(entity); if (!q.length) return null;
  for (const [a, b] of sentences(s)) { const t = s.slice(a, b), c = leadClause(t); if (c && c.verb && names(q, words(c.subject))) return t; } return null; }
/* the parties of a case name ("Miranda v. Arizona" → ["miranda", "arizona"]) */
function partiesOf(title) { const m = /^(.+?)\s+v(?:s)?\.?\s+(.+)$/i.exec(String(title || '').replace(/\s*\([^)]*\)\s*/g, ' ').trim()); if (!m) return []; return [m[1], m[2].split(/[,;]/)[0]].map(x => headCut(words(x)).join(' ')).filter(Boolean); }
/* the head of a source's primary entity, minus the archive's declared document noun ("ASPIRIN drug label" → "aspirin") */
function headOf(src) { let h = words(primaryEntity(src)); const dn = words((src && src.doc_noun) || ''); if (dn.length && h.length > dn.length && dn.every((w, i) => same(h[h.length - dn.length + i], w))) h = h.slice(0, h.length - dn.length); return h; }
/* the question entity q names this head: every question word is in the head (ordinals exact), and the head nouns agree */
const names0 = (q, h) => q.length > 0 && h.length > 0 && q.every(w => h.some(x => same(x, w))) && same(h[h.length - 1], q[q.length - 1]);
/* ALT-NAME-INITIALISM (4.9.79): an initialism names the run of words it abbreviates: "u s tax code" / "us tax code" names "united states tax code"
   (single letters of a dotted initialism are rejoined; a run of 2–4 question words may stand as its initials) */
const rejoin = h => { const o = []; for (let i = 0; i < h.length; i++) { if (h[i].length === 1 && /[a-z]/.test(h[i]) && h[i + 1] && h[i + 1].length === 1) { let j = i, s = ''; while (j < h.length && h[j].length === 1 && /[a-z]/.test(h[j])) s += h[j++]; o.push(s); i = j - 1; } else o.push(h[i]); } return o; };
const names = (q, h) => { if (names0(q, h)) return true; const hc = rejoin(h); if (names0(q, hc)) return true; for (let a = 0; a < q.length; a++) for (let b = a + 2; b <= Math.min(q.length, a + 4); b++) { const v = q.slice(0, a).concat([q.slice(a, b).map(w => w[0]).join('')], q.slice(b)); if (hc.includes(v[a]) && names0(v, hc)) return true; } return false; };
/* the answer entity a names this head: every answer word is in the head (ordinals exact) and the head nouns agree, or the answer is the
   head's leading run of two or more words (an extracted "alexander graham" for the head "alexander graham bell") */
const namesAnswer = (a, h) => a.length > 0 && h.length > 0 && a.every(w => h.some(x => same(x, w))) && (same(h[h.length - 1], a[a.length - 1]) || (a.length >= 2 && a.every((w, i) => same(h[i], w))));
/* SUBJECT GUARD (4.9.74, Nic item 4 + ruling 11:15): a source's primary entity must match the question's subject entity (via "question") or the
   candidate answer entity (via "answer"; the caller then also needs a verbatim span naming both, see qualifies). Otherwise SUBJECT_MISMATCH */
function subjectMatch(questionEnt, src, answerEnt) { const q = words(questionEnt), h = headOf(src), pe = h.join(' ');
  const res = { ok: false, via: null, basis: null, limitation: 'SUBJECT_MISMATCH', primary_entity: pe, question_entity: q.join(' ') };
  if (!q.length) return Object.assign(res, { ok: true, via: 'question', basis: 'none', limitation: null, note: 'no question entity resolved' });
  /* 4.9.75: the primary entity is the title head OR a case party OR the lead subject (first sentence subject); each is tested the same way */
  const parties = partiesOf(src && src.title); /* a case name's entity is its parties, not "miranda v arizona" */ const cands = (parties.length ? [] : [['title', h]]).concat(parties.map(p => ['party', words(p)]), (() => { const l = leadSubject(src && src.excerpt); return l ? [['lead', words(l)]] : []; })());
  /* 4.9.78: an ALTERNATE NAME of the source (a title that redirects to it, a recorded alias) is tested like its title: "<Country> military"
     → "<Country> Armed Forces" */
  for (const al of (src && src.aliases) || []) cands.push(['alias', headCut(words(String(al).replace(/\s*\([^)]*\)\s*/g, ' ')))]);
  for (const [basis, c] of cands) if (names(q, c)) return Object.assign(res, { ok: true, via: 'question', basis, limitation: null, primary_entity: c.join(' ') });
  /* 4.9.78 DESCRIPTION: a sentence of the source that states "<Name> is the <question subject>" verbatim makes the source the subject's
     referent (a definite description resolves to the name it is predicated of); the resolved name is recorded */
  { const d = describedBy(src && src.excerpt, q.join(' ')); if (d) return Object.assign(res, { ok: true, via: 'question', basis: 'description', limitation: null, primary_entity: d.answer, resolved_entity: d.answer, span: d.span }); }
  const a = answerEnt == null ? [] : words(String(answerEnt).replace(/^probably\s+/i, ''));
  for (const [basis, c] of cands) if (namesAnswer(a, c)) return Object.assign(res, { ok: true, via: 'answer', basis, limitation: null, answer_entity: a.join(' '), primary_entity: c.join(' ') });
  return res; }
/* DESCRIBED BY (4.9.78): the first sentence whose grammatical subject X is followed by a copula, "the" and then the description's words in
   order (contiguous, ordinals and numbers exact); returns { answer: X, span } or null. A description of one word is not a description */
function describedBy(text, descr) { const s = String(text || ''), d = words(descr); if (d.length < 2) return null;
  for (const [a, b] of sentences(s)) { const t = s.slice(a, b), ws = words(t), c = leadClause(t); if (!c || !c.subject) continue;
    for (let i = 0; i + d.length + 2 <= ws.length; i++) if (/^(is|was|are|were)$/.test(ws[i]) && ws[i + 1] === 'the' && d.every((w, j) => ws[i + 2 + j] === w)) return { answer: c.subject, span: t }; }
  return null; }
/* a verbatim span (one sentence) naming both the question subject and the answer */
function bothSpan(excerpt, questionEnt, answerEnt) { const s = String(excerpt || ''), q = words(questionEnt), a = words(String(answerEnt || '').replace(/^probably\s+/i, '')); if (!q.length || !a.length) return null;
  for (const [x, y] of sentences(s)) { const t = s.slice(x, y), ws = words(t); if (q.every(w => ws.some(v => same(v, w))) && a.every(w => ws.some(v => same(v, w)))) return t; } return null; }
/* does a source qualify for the answer? via the question subject; or via the answer entity WITH a verbatim span naming both */
function qualifies(questionEnt, src, answerEnt) { const m = subjectMatch(questionEnt, src, answerEnt); if (!m.ok || m.via === 'question') return m;
  const sp = bothSpan(src && src.excerpt, questionEnt, answerEnt); return sp ? Object.assign(m, { span: sp }) : Object.assign(m, { ok: false, via: null, limitation: 'SUBJECT_MISMATCH', note: 'answer entity without a span naming the question subject and the answer' }); }
/* ---------------- 5. AGREEMENT ---------------- */
const ORIGIN = Object.freeze({ wikipedia: 'wikimedia', wikidata: 'wikimedia', medlineplus: 'nlm', openfda: 'fda', courtlistener: 'free-law-project', ecfr: 'federal-register',
  /* 4.9.78: one publisher is one origin (agreement counts origins, never archives or results) */ pubchem: 'nlm', mesh: 'nlm', ncbigene: 'nlm', rxclass: 'nlm', chebi: 'embl-ebi', federalregister: 'federal-register', legislationgovuk: 'the-national-archives-uk', uniprot: 'uniprot', gbif: 'gbif', loc: 'library-of-congress' });
function originOf(r) { if (r.origin) return String(r.origin); /* a record that restates another archive's text (PubChem quoting ChEBI) has that archive's origin */ if (r.cls === 'peer_reviewed') return 'paper:' + words(r.title).join(' '); if (ORIGIN[r.archive]) return ORIGIN[r.archive];
  const dom = /^https?:\/\/([^/]+)/i.exec(String(r.url || '')); return dom ? 'web:' + dom[1].toLowerCase().replace(/^www\./, '') : 'archive:' + String(r.archive || 'unknown'); }
const normAns = a => words(String(a == null ? '' : a).replace(/^probably\s+/i, '')).join(' ');
function agreement(rows, answer) { const by = new Map(); const ans = answer == null ? null : normAns(answer);
  for (const r of rows || []) { const st = r.subject_ok === false || !r.supported ? 'unusable' : ans !== null && r.claim != null && normAns(r.claim) !== ans ? 'disagree' : 'agree';
    const o = originOf(r), cur = by.get(o); const rank = { agree: 2, disagree: 1, unusable: 0 }; if (!cur || rank[st] > rank[cur]) by.set(o, st); }
  const n = k => [...by.values()].filter(v => v === k).length; const out = { agree: n('agree'), disagree: n('disagree'), unusable: n('unusable'), origins: [...by.keys()].sort() };
  out.text = out.agree + ' agree, ' + out.disagree + ' disagree, ' + out.unusable + ' unusable'; return out; }
/* ---------------- the report ---------------- */
const claimText = c => (c == null ? null : typeof c === 'object' ? (c.answer == null ? null : String(c.answer)) : String(c));
/* rows for cited sources; keyFor(source) gives the key of the sentence each one is attached to */
function rowsFor(sources, keyFor) { let rejected_spans = 0;
  const rows = (sources || []).map((s, i) => { const tier = tierOf(s.cls), title = String(s.title || '').replace(/\s+/g, ' ').trim().slice(0, 70), name = String(s.name || 'Wikipedia'), key = keyFor(s);
    let span = null, reason; if (s.span != null) { const c = checkSpan(s.excerpt, s.span, key); if (c.ok) { span = s.span; reason = c.reason; } else rejected_spans++; }
    if (span === null) { span = extractSpan(s.excerpt, key); reason = span ? 'verbatim_span_with_key_content' : hasKey(normKey(key)) ? 'no_span_with_key_content' : normKey(key).needs_value ? 'no_extracted_value' : 'no_key_content'; }
    return Object.assign({ n: i + 1, archive: String(s.archive || 'wikipedia'), name, title, url: String(s.url || ''), label: name + ': ' + (title || 'untitled'), rank_class: s.cls || 'unknown', tier, tier_label: TIER_LABEL[tier], tier_name: TIER_LABEL[tier], supported: span !== null, span, reason, claim: claimText(s.claim) }, s.origin ? { origin: String(s.origin) } : {}); });
  return { rows, rejected_spans }; }
const countsOf = rows => { const c = { curated_archive: 0, peer_reviewed_index: 0, open_fallback: 0 }; for (const r of rows) c[r.tier]++; return c; };
const itemOf = r => r.label + ' · ' + r.tier_label + (r.supported ? '' : ' · unsupported');
/* the provenance report of one evidence answer. plan: the lookup plan; claim: the answer's claim (a source's own s.claim, when given, is
   the claim of the sentence that source is attached to); sources failing the subject guard are rejected (SUBJECT_MISMATCH), never cited */
function report(sources, plan, claim, opts) { const o = opts || {}; const qe = o.questionEntity != null ? o.questionEntity : questionEntity(plan, plan && plan.question);
  const answer0 = o.answer !== undefined ? o.answer : claimText(claim); const rej = (s, m) => rejected.push({ archive: String(s.archive || 'wikipedia'), name: String(s.name || 'Wikipedia'), title: String(s.title || '').slice(0, 120), limitation: 'SUBJECT_MISMATCH', primary_entity: m.primary_entity, question_entity: m.question_entity });
  const cited = [], rejected = []; for (const s of sources || []) { const m = qualifies(qe, s, answer0); if (m.ok) cited.push(Object.assign({}, s, { _via: m.via, _both: m.span || null })); else rejected.push({ archive: String(s.archive || 'wikipedia'), name: String(s.name || 'Wikipedia'), title: String(s.title || '').slice(0, 120), limitation: m.limitation, primary_entity: m.primary_entity, question_entity: m.question_entity }); }
  const r0 = rowsFor(cited, s => keyContent(plan, s.claim !== undefined ? s.claim : claim)); const rejected_spans = r0.rejected_spans;
  /* an answer-entity source counts only when its supporting span itself names both the question subject and the answer; else it is set aside */
  const rows = []; r0.rows.forEach((r, i) => { const s = cited[i]; r.subject_match = s._via; if (s._via === 'answer' && !(r.supported && bothSpan(r.span, qe, answer0))) { if (s._both && covers(s._both, keyContent(plan, s.claim !== undefined ? s.claim : claim))) { r.supported = true; r.span = s._both; r.reason = 'verbatim_span_with_key_content'; } else { rej(s, subjectMatch(qe, s)); return; } } rows.push(r); });
  rows.forEach((r, i) => { r.n = i + 1; }); const counts = countsOf(rows);
  const fallback_only = rows.length > 0 && counts.open_fallback === rows.length; const sup = rows.filter(r => r.supported).length;
  const answer = o.answer !== undefined ? o.answer : claimText(claim);
  const ag = agreement(rows.map(r => Object.assign({}, r, { subject_ok: true })).concat(rejected.map(r => ({ archive: r.archive, cls: (sources.find(s => s.title === r.title) || {}).cls, title: r.title, supported: false, subject_ok: false }))), answer);
  return { schema: SCHEMA, question_entity: qe, sources: rows, rejected, summary: Object.assign({}, counts, { total: rows.length, fallback_only, text: summaryText(counts) }), counts, fallback_only, unsupported: rows.length - sup, rejected_spans,
    items: rows.map(itemOf), agreement: ag, claim: { kind: claim && typeof claim === 'object' ? claim.kind : null, answer: claimText(claim), key: keyContent(plan, claim), supported_by: sup, unsupported: rows.length - sup } }; }
/* the evidence.js form: an explicit key (or keyFor) instead of a plan; summary is the line itself */
function provenance(sources, key, keyFor) { const { rows, rejected_spans } = rowsFor(sources, keyFor || (() => key)); const counts = countsOf(rows);
  const fallback_only = rows.length > 0 && counts.open_fallback === rows.length;
  return { schema: SCHEMA, sources: rows, counts, summary: summaryText(counts), fallback_only, unsupported: rows.filter(r => !r.supported).length, rejected_spans, items: rows.map(itemOf) }; }
/* what may be persisted (counts only: no spans, no excerpt text) */
const sealedCounts = pv => (pv ? { text: pv.summary && typeof pv.summary === 'object' ? pv.summary.text : pv.summary, total: pv.sources.length, fallback_only: !!pv.fallback_only, supported: pv.sources.filter(s => s.supported).length, unsupported: pv.unsupported, rejected: (pv.rejected || []).length, agreement: pv.agreement ? pv.agreement.text : null } : null);
/* the evidence card: tier beside each source, the summary line, the verbatim span or "unsupported", the rejected sources; esc = the caller's escaper */
function reportHTML(pv, esc) { if (!pv) return ''; const e = esc || (s => String(s)); const sum = pv.summary && typeof pv.summary === 'object' ? pv.summary.text : pv.summary;
  return '<div class="prov' + (pv.fallback_only ? ' fallback' : '') + '"><div class="provsum' + (pv.fallback_only ? ' fallback' : '') + '"><b>' + e(sum) + '</b>' + (pv.agreement ? ' · ' + e(pv.agreement.text) : '') + '</div><ol class="provsrc">' +
    pv.sources.map(s => '<li class="tier-' + e(s.tier) + (s.tier === 'open_fallback' ? ' fallback' : '') + '">' + e(s.label) + ' <span class="pill' + (s.tier === 'open_fallback' ? ' warn' : '') + '">' + e(s.tier_label) + '</span> ' +
      (s.supported ? '<span class="pill ok">supported</span><div class="small">verbatim span: “' + e(s.span) + '”</div>' : '<span class="pill bad">unsupported</span><div class="small">no verbatim span with the answer\'s key content (' + e(String(s.reason).replace(/_/g, ' ')) + ')</div>') + '</li>').join('') + '</ol>' +
    ((pv.rejected || []).length ? '<div class="small">set aside (' + e(pv.rejected[0].limitation) + '): ' + pv.rejected.map(r => e(r.name + ': ' + r.title) + ' — about “' + e(r.primary_entity) + '”, not “' + e(r.question_entity) + '”').join('; ') + '</div>' : '') + '</div>'; }
const api = { describedBy, SCHEMA, TIERS, TIER_OF_RANK, TIER_LABEL, TIER_SHORT, ORIGIN, tierOf, egressOf, egressLabel, boundaryLabels, summaryText, questionEntity, keyContent, normKey, covers, extractSpan, checkSpan, joinable, primaryEntity, leadSubject, leadClause, definitional, partiesOf, subjectMatch, qualifies, bothSpan, originOf, agreement, report, provenance, sealedCounts, reportHTML, _sentences: sentences };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KProv = api;
})(typeof self !== 'undefined' ? self : this);
