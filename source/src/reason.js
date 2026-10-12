/* reason.js — bounded compositional discourse reasoning for Forge Mobile.
 *
 * This module does not generate prose and does not match complete prompts. It turns a
 * premise/question discourse into propositions, evidence roles, competing conclusions,
 * proof edges and a realization plan. derive.js alone turns that plan into language.
 * Every inference is an exact predicate-family rule; no model, vector, similarity score,
 * network call or hidden corpus participates. */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports;
const G = isNode ? require('./grammar.js') : root.KGrammar;
const SCHEMA = 'forge-discourse-reasoning/v1';
const MAX_SEGMENTS = 12, MAX_TOKENS = 240, MAX_FACTS = 16, MAX_GRAPH_NODES = 48;

const AUX = new Set('am is are was were be been being do does did have has had will would shall should can cannot could may might must'.split(' '));
const NEG = new Set(['not', 'never', 'no', 'nothing', 'nobody']);
const CONTRAST = new Set(['but', 'however', 'yet', 'whereas', 'although']);
const EXPLAIN = new Set(['explain', 'justify', 'reason', 'show']);
const RETENTION = new Set('remember retain record memorize memorise store log recall preserve keep note'.split(' '));
const UNDERSTANDING = new Set('understand explain identify know diagnose infer account recognize recognise'.split(' '));
const ADAPTATION = new Set('adapt improve change revise correct avoid predict generalize generalise apply solve adjust transfer'.split(' '));
const FAILURE = new Set('repeat persist fail worsen regress'.split(' '));
const LEARNING = new Set('learn adapt improve master'.split(' '));
const CAUSAL = new Set('why cause reason mechanism explanation'.split(' '));
const IGNORE = new Set('a an the this that these those all every each some any many few several most both of to from with by for about in on at into after before during while and or but however yet whereas although actually really just already still ever then so please cannot'.split(' '));
const FOLLOW = {
  distinction: ['distinction', 'difference', 'different', 'mean'],
  analogy: ['example', 'analogy', 'unrelated'],
  counter: ['against', 'counterargument', 'opposite', 'other side'],
  compare: ['stronger', 'better argument', 'better case'],
  revise: ['change your conclusion', 'change your mind', 'what evidence', 'which evidence', 'evidence could']
};
const DOC = 'FORGE-RMC-ROADMAP/SEMANTIC-SPINE';

const copy = x => JSON.parse(JSON.stringify(x));
const words = ts => ts.map(t => t.w);
const range = ts => ts.length ? { start: ts[0].start, end: ts[ts.length - 1].end, token_start: ts[0].index, token_end: ts[ts.length - 1].index + 1 } : null;
const norm = s => String(s || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
const stable = o => { if (Array.isArray(o)) return '[' + o.map(stable).join(',') + ']'; if (o && typeof o === 'object') return '{' + Object.keys(o).sort().map(k => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}'; return JSON.stringify(o); };

function tokenise(text) {
  const out = []; const re = /"[^"]*"|[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ-]*(?:'[A-Za-z]+)?|\d+(?:\.\d+)?|[?,;:.!]/g; let m;
  while ((m = re.exec(String(text || ''))) && out.length < MAX_TOKENS) out.push({ w: m[0].toLowerCase(), orig: m[0], start: m.index, end: m.index + m[0].length, index: out.length });
  return out;
}

function segment(text) {
  const ts = tokenise(text), out = []; let cur = [];
  const push = (kind, relation) => { if (!cur.length || out.length >= MAX_SEGMENTS) return; const r = range(cur); out.push({ id: 's' + (out.length + 1), kind, relation: relation || null, tokens: cur, span: r, source: String(text).slice(r.start, r.end) }); cur = []; };
  for (const t of ts) {
    if ((t.w === ',' || t.w === ';') && cur.length && CONTRAST.has(ts[t.index + 1] && ts[t.index + 1].w)) { push('assertion'); continue; }
    if (CONTRAST.has(t.w) && cur.length) { push('assertion'); cur.push(t); continue; }
    cur.push(t);
    if (/^[.?!]$/.test(t.w)) { const raw = words(cur).join(' '); const first = cur.find(x => /^[a-z]/.test(x.w)); const kind = t.w === '?' || /^(what|why|how|which|who|has|have|had|is|are|was|were|do|does|did|can|could|would|should|will|may|might|must)\b/.test(raw) ? 'question' : first && EXPLAIN.has(first.w) ? 'directive' : 'assertion'; push(kind); }
  }
  push('assertion');
  return { tokens: ts, segments: out };
}

function tags(tok, i, lex) {
  try { return G.analyse({ w: tok.w, orig: tok.orig, i0: i }, i, lex); } catch (e) { return []; }
}
function lemma(tok, pos, i, lex) {
  const tag = { v: 'V', n: 'N', a: 'ADJ', r: 'ADV' }[pos]; const a = tags(tok, i, lex).find(x => x.tag === tag); return a ? a.lemma : null;
}
function unknown(tok, i, lex) { const a = tags(tok, i, lex); return !!a.length && a.every(x => x.tag === 'UNK'); }
function verbIndices(ts, lex) { const out = []; for (let i = 0; i < ts.length; i++) { const l = lemma(ts[i], 'v', i, lex); if (l && !AUX.has(l)) out.push({ i, lemma: l }); } return out; }
function nounAt(tok, i, lex) { const a = tags(tok, i, lex).find(x => x.tag === 'N'); return a ? { lemma: a.lemma, plural: a.f === 'pl' } : null; }
function unresolvedRoles(ts, mainIndex, lex) {
  const items = ts.map((t, i) => ({ t, i, analyses: tags(t, i, lex) })).filter(x => !IGNORE.has(x.t.w) && x.analyses.length && x.analyses.every(a => a.tag === 'UNK'));
  const nominal = ts.findIndex((t, i) => tags(t, i, lex).some(a => /^(N|PROPN|PRON)$/.test(a.tag)));
  const clauseMarker = new Set(['and', 'but', 'because', 'while', 'although', 'whereas', 'that', 'who', 'which']);
  const material = [], nonmaterial = [];
  for (const x of items) {
    // In the bounded SVO path, an opaque token after an established subject but
    // before the selected predicate is a predicate hole. Treating it as an object
    // label would let a later noun/verb homograph silently replace the premise.
    let marker = -1; for (let i = 0; i < x.i; i++) if (clauseMarker.has(ts[i].w)) marker = i;
    const afterClauseMarker = marker >= 0 && x.i > marker && !/ly$/.test(x.t.w);
    const predicateHole = !/ly$/.test(x.t.w) && ((nominal >= 0 && x.i > nominal && x.i < mainIndex) || afterClauseMarker);
    (predicateHole ? material : nonmaterial).push(x.t.w);
  }
  return { all: items.map(x => x.t.w), material, nonmaterial };
}

function np(ts, lex, fallback) {
  ts = ts.filter(t => !/^[,;:.!?]$/.test(t.w) && !CONTRAST.has(t.w));
  if (!ts.length) return fallback ? copy(fallback) : null;
  const pr = ts[0] && /^(i|me|you|he|him|she|her|it|we|us|they|them)$/.test(ts[0].w) ? ts[0] : null;
  if (pr && !ts.some((t, i) => i > 0 && nounAt(t, i, lex))) return { pron3: pr.w };
  const proper = ts.filter((t, i) => /^[A-Z]/.test(t.orig) && !(G.CL[t.w] || []).length && tags(t, i, lex).some(a => a.tag === 'PROPN')); if (proper.length) return { propn: proper.map(t => t.orig).join(' ') };
  let head = null, hi = -1;
  for (let i = 0; i < ts.length; i++) { const n = nounAt(ts[i], i, lex); if (n) { head = n; hi = i; if (i > 0 && /^(that|who|which)$/.test(ts[i - 1].w)) break; } }
  if (!head) return fallback ? copy(fallback) : null;
  const before = ts.slice(0, hi); const det = before.find(t => /^(a|an|the|this|these|those)$/.test(t.w)); const quant = before.find(t => /^(all|every|each|some|any|many|few|several|most|both|no)$/.test(t.w));
  const adjs = before.map((t, i) => lemma(t, 'a', i, lex)).filter(Boolean).slice(-3);
  const n = { head: [head.lemma], surface: [ts[hi].w], plural: head.plural };
  if (det) n.det = det.w === 'an' ? 'a' : det.w; if (quant) n.quant = quant.w; if (adjs.length) n.adjs = adjs;
  return n;
}
function npLabel(n) { if (!n) return 'entity'; if (n.propn) return n.propn; if (n.head) return n.head[n.head.length - 1]; return n.pron3 || n.indef || 'entity'; }
function resolvePronoun(n, discourse) { return n && n.pron3 && discourse.lastSubject ? copy(discourse.lastSubject) : n; }
function family(pred, objectWords) {
  if (RETENTION.has(pred)) return 'retention';
  if (ADAPTATION.has(pred)) return 'adaptation';
  if (FAILURE.has(pred)) return 'failure';
  if (UNDERSTANDING.has(pred) || objectWords.some(w => CAUSAL.has(w))) return 'understanding';
  return 'other';
}

function parseClause(seg, lex, discourse) {
  let ts = seg.tokens.filter(t => !/^[,;:.!?]$/.test(t.w));
  let relation = null; if (ts[0] && CONTRAST.has(ts[0].w)) { relation = 'contrast'; ts = ts.slice(1); }
  if (!ts.length) return null;
  const vs = verbIndices(ts, lex); if (!vs.length) { const ur = unresolvedRoles(ts, ts.length, lex); return { id: seg.id, kind: seg.kind, relation, span: seg.span, source: seg.source, unresolved: ur.all.slice(0, 4), unresolved_material: ur.material.slice(0, 4), unresolved_nonmaterial: ur.nonmaterial.slice(0, 4) }; }
  const question = seg.kind === 'question'; const auxAt = question && AUX.has(ts[0].w) ? 0 : -1;
  const main = vs.find(v => auxAt < 0 || v.i > auxAt) || vs[0];
  let sb = auxAt === 0 ? ts.slice(1, main.i).filter(t => !/^(actually|really|ever|already|still|just|not|never)$/.test(t.w)) : ts.slice(0, main.i).filter(t => !NEG.has(t.w));
  if (/^(what|why|how|which|who)$/.test(sb[0] && sb[0].w)) sb = sb.slice(1);
  let subject = resolvePronoun(np(sb, lex, discourse.lastSubject), discourse);
  if (!subject && discourse.lastSubject) subject = copy(discourse.lastSubject);
  if (subject && !sb.some(t => /^(it|he|she|they|this|that)$/.test(t.w))) discourse.lastSubject = copy(subject);
  const tail = ts.slice(main.i + 1), tailWords = words(tail);
  const rel = tail.findIndex((t, i) => i > 0 && /^(it|he|she|they|that|who|which)$/.test(t.w) && verbIndices(tail.slice(i + 1), lex).some(v => v.i === 0));
  const boundary = tail.findIndex((t, i) => i > 0 && (/^(after|before|during|while|because|without)$/.test(t.w) || (t.w === 'and' && verbIndices(tail.slice(i + 1), lex).some(v => v.i === 0))));
  const end = [rel, boundary].filter(i => i > 0).sort((a, b) => a - b)[0];
  let objTs = end ? tail.slice(0, end) : tail; if (objTs[0] && objTs[0].w === 'why') objTs = objTs.slice(1);
  let object = np(objTs, lex, null);
  if (tailWords.some(w => CAUSAL.has(w)) || tailWords[0] === 'why') object = { head: ['cause'], surface: ['causes'], plural: true, det: 'the' };
  if (!object && /^(anything|something|nothing|everything)$/.test(tail[0] && tail[0].w)) object = { indef: tail[0].w };
  const polarity = ts.some(t => NEG.has(t.w)) || (ts.some(t => /^(cannot|can't|doesn't|doesnt|isn't|isnt|hasn't|hasnt)$/.test(t.w))) ? 'negative' : 'positive';
  const fam = family(main.lemma, tailWords);
  const ur = unresolvedRoles(ts, main.i, lex); const unique = a => a.filter((w, i) => a.indexOf(w) === i).slice(0, 4);
  return { id: seg.id, kind: seg.kind, relation, span: seg.span, source: seg.source, subject, predicate: main.lemma, object, polarity, family: fam, unresolved: unique(ur.all), unresolved_material: unique(ur.material), unresolved_nonmaterial: unique(ur.nonmaterial), token_span: range(ts) };
}

function queryNominal(p) { return { head: [{ learn: 'learning', adapt: 'adaptation', improve: 'improvement', master: 'mastery', understand: 'understanding', know: 'knowledge' }[p] || p], surface: [{ learn: 'learning', adapt: 'adaptation', improve: 'improvement', master: 'mastery', understand: 'understanding', know: 'knowledge' }[p] || p] }; }
function candidate(id, claim, support, oppose, threshold) { const score = support.reduce((n, x) => n + x.weight, 0) - oppose.reduce((n, x) => n + x.weight, 0); return { id, claim, support, oppose, score, threshold, warranted: score >= threshold, formula: support.map(x => '+' + x.weight + '*' + x.ref).concat(oppose.map(x => '-' + x.weight + '*' + x.ref)).join(' ') + ' = ' + score }; }

function buildInitial(raw, lex) {
  const doc = segment(raw); if (doc.tokens.length < 6 || doc.segments.length < 2 || doc.tokens.length >= MAX_TOKENS) return null;
  const discourse = { lastSubject: null }, clauses = doc.segments.map(s => parseClause(s, lex, discourse)).filter(Boolean).slice(0, MAX_FACTS);
  const questions = clauses.filter(c => c.kind === 'question' && c.predicate); const q = questions[questions.length - 1];
  if (!q || !LEARNING.has(q.predicate)) return null;
  const materialUnknown = [...new Set([].concat(...clauses.map(c => c.unresolved_material || [])))].filter(w => !/^(anything|something|nothing|everything)$/.test(w));
  if (materialUnknown.length) return { clarify: materialUnknown };
  const facts = clauses.filter(c => c.kind === 'assertion' && c.predicate && c.family !== 'other');
  if (!facts.length) return null;
  const nonmaterialUnknown = [...new Set([].concat(...clauses.map(c => c.unresolved_nonmaterial || [])))].filter(w => !/^(anything|something|nothing|everything)$/.test(w));
  const ret = facts.filter(f => f.family === 'retention' && f.polarity === 'positive');
  const un = facts.filter(f => f.family === 'understanding' && f.polarity === 'negative');
  const up = facts.filter(f => f.family === 'understanding' && f.polarity === 'positive');
  const ad = facts.filter(f => f.family === 'adaptation' && f.polarity === 'positive');
  const an = facts.filter(f => f.family === 'adaptation' && f.polarity === 'negative');
  const fail = facts.filter(f => f.family === 'failure' && f.polarity === 'positive');
  const refs = a => a.map(x => ({ ref: x.id, weight: 1 }));
  const yesSupport = refs(ret).concat(refs(ad).map(x => Object.assign(x, { weight: 3 })));
  const yesOppose = refs(an).map(x => Object.assign(x, { weight: 3 })).concat(refs(fail).map(x => Object.assign(x, { weight: 2 })));
  const noSupport = refs(an).map(x => Object.assign(x, { weight: 3 })).concat(refs(fail).map(x => Object.assign(x, { weight: 2 })));
  const noOppose = refs(ad).map(x => Object.assign(x, { weight: 3 })).concat(refs(ret));
  const yes = candidate('c-yes', { polarity: 'positive', predicate: q.predicate }, yesSupport, yesOppose, 3);
  const no = candidate('c-no', { polarity: 'negative', predicate: q.predicate }, noSupport, noOppose, 3);
  const conflict = !!((ad.length && (an.length || fail.length)) || (ret.length && (an.length || fail.length)));
  const categoricalWarrant = yes.warranted || no.warranted;
  const qualifiedSupport = [].concat(ret.length ? [{ ref: ret[0].id, weight: 1 }] : [], un.length ? [{ ref: un[0].id, weight: 1 }] : [], conflict ? [{ ref: 'r-conflict', weight: 3 }] : !categoricalWarrant ? [{ ref: 'r-insufficient', weight: 3 }] : []);
  const qualifiedOppose = yes.warranted && !conflict ? refs(ad).map(x => Object.assign(x, { weight: 1 })) : [];
  const qualified = candidate('c-qualified', { polarity: 'qualified', predicate: q.predicate }, qualifiedSupport, qualifiedOppose, 3);
  let status, selected;
  if (conflict && qualified.warranted) { status = ret.length ? 'qualified' : 'uncertain'; selected = 'c-qualified'; }
  else if (yes.warranted) { status = un.length ? 'qualified' : 'yes'; selected = 'c-yes'; }
  else if (no.warranted) { status = ret.length ? 'qualified' : 'no'; selected = 'c-no'; }
  else { status = ret.length ? 'qualified' : 'uncertain'; selected = 'c-qualified'; }
  const candidates = [yes, no, qualified], selectedCandidate = candidates.find(c => c.id === selected);
  if (!selectedCandidate || !selectedCandidate.warranted) return { noWarrant: true, candidates };
  const nodes = facts.map(f => ({ id: f.id, type: 'evidence', proposition: { subject: f.subject, predicate: f.predicate, object: f.object, polarity: f.polarity }, family: f.family, span: f.span, source: f.source }));
  nodes.push({ id: 'r-retention', type: 'rule', rule: 'RSN-RETENTION-IS-EVIDENCE-NOT-ENTAILMENT' }, { id: 'r-understanding', type: 'rule', rule: 'RSN-CAUSAL-UNDERSTANDING-SEPARATE' }, { id: 'r-insufficient', type: 'rule', rule: 'RSN-CATEGORICAL-WARRANT-WITHHELD' }, { id: 'r-conflict', type: 'rule', rule: 'RSN-CONFLICT-REQUIRES-QUALIFICATION' }, { id: 'q1', type: 'question', proposition: { subject: q.subject, predicate: q.predicate, object: q.object }, span: q.span }, { id: 'k1', type: 'conclusion', status, selected, score: selectedCandidate.score, threshold: selectedCandidate.threshold, warranted: true });
  const edges = [];
  for (const f of ret) edges.push({ from: f.id, to: 'c-yes', relation: 'supports-limited' }, { from: f.id, to: 'r-retention', relation: 'instantiates' });
  for (const f of un) edges.push({ from: f.id, to: 'c-yes', relation: 'weakens-strong-sense' }, { from: f.id, to: 'r-understanding', relation: 'instantiates' });
  for (const f of ad) edges.push({ from: f.id, to: 'c-yes', relation: 'supports' });
  for (const f of an.concat(fail)) edges.push({ from: f.id, to: 'c-no', relation: 'supports' });
  if (conflict) edges.push({ from: 'r-conflict', to: 'c-qualified', relation: 'supports' });
  else if (!categoricalWarrant) edges.push({ from: 'r-insufficient', to: 'c-qualified', relation: 'supports' });
  edges.push({ from: selected, to: 'k1', relation: 'selected' });
  const subject = q.subject || (ret[0] || un[0] || facts[0]).subject; const object = ret[0] && ret[0].object;
  const material = { kind: 'reasoned_answer', schema: SCHEMA, mode: 'initial', status, subject, query: { subject, predicate: q.predicate, nominal: queryNominal(q.predicate), span: q.span },
    findings: { retention: ret.slice(0, 2), understanding_absent: un.slice(0, 2), understanding_present: up.slice(0, 2), adaptation: ad.slice(0, 2), adaptation_absent: an.slice(0, 2), failure: fail.slice(0, 2) },
    object: object || null, distinction: { left: 'retention', right: 'causal understanding' },
    proof: { schema: 'forge-proof-graph/v1', nodes: nodes.slice(0, MAX_GRAPH_NODES), edges: edges.slice(0, MAX_GRAPH_NODES), candidates, selected },
    counterargument: { rule: 'RSN-RETENTION-AS-LIMITED-LEARNING', premise: 'retention', conclusion: q.predicate }, revision: { behavior_change: true, prediction: true, causal_explanation: true },
    unresolved_nonmaterial: nonmaterialUnknown, source_summary: { segments: doc.segments.map(s => ({ id: s.id, kind: s.kind, span: s.span })), token_count: doc.tokens.length } };
  const rules = [{ id: 'RSN-DISCOURSE-SEGMENT', doc: DOC, note: doc.segments.length + ' segments / ' + doc.tokens.length + ' tokens' }, { id: 'RSN-REFERENCE-RESOLVE', doc: DOC, note: npLabel(subject) },
    { id: 'RSN-CANDIDATE-CONSTRUCT', doc: DOC, note: 'affirmative, negative, qualified' }, { id: 'RSN-CANDIDATE-COMPARE', doc: DOC, note: [yes.id + ':' + yes.score, no.id + ':' + no.score, qualified.id + ':' + qualified.score].join(' ') },
    { id: 'RSN-WARRANT-SELECT', doc: DOC, note: selected + ' ' + selectedCandidate.score + '/' + selectedCandidate.threshold + ' → ' + status }];
  if (ret.length) rules.push({ id: 'RSN-RETENTION-EVIDENCE', doc: DOC, note: ret.map(x => x.id).join(',') });
  if (un.length || up.length) rules.push({ id: 'RSN-UNDERSTANDING-EVIDENCE', doc: DOC, note: un.concat(up).map(x => x.id).join(',') });
  if (ad.length || an.length) rules.push({ id: 'RSN-ADAPTATION-EVIDENCE', doc: DOC, note: ad.concat(an).map(x => x.id).join(',') });
  if (!categoricalWarrant) rules.push({ id: conflict ? 'RSN-EVIDENCE-CONFLICT' : 'RSN-WARRANT-WITHHOLD', doc: DOC, note: conflict ? 'opposed evidence requires qualification' : 'no categorical candidate reached its threshold' });
  return { material, rules, candidates, state: compactState(material) };
}

function hasAny(low, xs) { return xs.some(x => low.includes(x)); }
function followMode(raw) {
  const low = norm(raw); if (hasAny(low, FOLLOW.revise)) return 'revision'; if (hasAny(low, FOLLOW.counter)) return 'counterargument'; if (hasAny(low, FOLLOW.compare)) return 'comparison'; if (hasAny(low, FOLLOW.analogy)) return 'analogy'; if (hasAny(low, FOLLOW.distinction)) return 'distinction'; return null;
}
const ANALOGIES = [
  { subject: { det: 'a', head: ['student'], surface: ['student'] }, predicate: 'memorize', object: { quant: 'every', head: ['formula'], surface: ['formula'] }, absent: 'explain', cause: { det: 'the', head: ['rule'], surface: ['rule'], plural: true } },
  { subject: { det: 'a', head: ['gardener'], surface: ['gardener'] }, predicate: 'record', object: { quant: 'every', head: ['plant'], surface: ['plant'] }, absent: 'identify', cause: { det: 'the', head: ['cause'], surface: ['cause'], plural: true } },
  { subject: { det: 'a', head: ['mechanic'], surface: ['mechanic'] }, predicate: 'log', object: { quant: 'every', head: ['failure'], surface: ['failure'] }, absent: 'diagnose', cause: { det: 'the', head: ['cause'], surface: ['cause'], plural: true } },
  { subject: { det: 'a', head: ['player'], surface: ['player'] }, predicate: 'remember', object: { quant: 'every', head: ['move'], surface: ['move'] }, absent: 'explain', cause: { det: 'the', head: ['strategy'], surface: ['strategy'] } }
];
function pickAnalogy(last) { const avoid = npLabel(last.subject); const pool = ANALOGIES.filter(a => npLabel(a.subject) !== avoid); let n = 0; for (const ch of stable(last.proof).slice(0, 24)) n = (n * 33 + ch.charCodeAt(0)) >>> 0; return copy(pool[n % pool.length]); }
function compactState(m) { return { schema: SCHEMA, subject: copy(m.subject), query: copy(m.query), object: copy(m.object), distinction: copy(m.distinction), proof: copy(m.proof), counterargument: copy(m.counterargument), revision: copy(m.revision) }; }
function buildFollowup(raw, last) {
  const mode = followMode(raw); if (!mode || !last || last.schema !== SCHEMA || !last.proof) return null;
  const material = { kind: 'reasoned_answer', schema: SCHEMA, mode, status: 'selected', subject: copy(last.subject), query: copy(last.query), object: copy(last.object), distinction: copy(last.distinction), proof: copy(last.proof), counterargument: copy(last.counterargument), revision: copy(last.revision) };
  if (mode === 'analogy') material.analogy = pickAnalogy(last);
  return { material, state: last, candidates: last.proof.candidates, rules: [{ id: 'RSN-DIALOGUE-REENTRY', doc: DOC, note: mode }, { id: 'RSN-PROOF-GROUNDED-FOLLOWUP', doc: DOC, note: last.proof.selected }] };
}

function evaluate(raw, opts) {
  opts = opts || {}; const follow = buildFollowup(raw, opts.last); const built = follow || buildInitial(raw, opts.lex);
  if (!built) return { handled: false };
  if (built.clarify) return { handled: true, outcome: 'CLARIFICATION_REQUIRED', material: { kind: 'clarify_unknown', words: built.clarify }, frame: 'FR.REASON', act: 'question', rules: [{ id: 'RSN-MATERIAL-UNKNOWN', doc: DOC, note: built.clarify.join(', ') }] };
  if (built.noWarrant) return { handled: true, outcome: 'NO_LAWFUL_CANDIDATE', material: { kind: 'no_frame' }, frame: 'FR.REASON', act: 'question', rules: [{ id: 'RSN-NO-WARRANTED-CANDIDATE', doc: DOC, note: 'no candidate reached its declared threshold' }], reasoningCandidates: built.candidates };
  return { handled: true, outcome: 'SELECTED_MEANING', material: built.material, frame: follow ? 'FR.REASON.FOLLOWUP' : 'FR.REASON', act: 'question', rules: built.rules, reasoningCandidates: built.candidates, reasoningState: built.state, uncertainty: built.material.status };
}

const api = { SCHEMA, evaluate, segment, parseClause, buildInitial, buildFollowup, compactState, limits: { MAX_SEGMENTS, MAX_TOKENS, MAX_FACTS, MAX_GRAPH_NODES } };
if (isNode) module.exports = api; else root.KReason = api;
})(typeof self !== 'undefined' ? self : this);
