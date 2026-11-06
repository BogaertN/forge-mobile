/* 4.9.226: the same meanings now also drive the follow-up ask (planAsk / follow, see below); the trace itself is unchanged.
 * senses.js — 4.9.221 shadow sense trace (KSenses). Advisory only (Nic 2026-11-04, t136u): it is never read by recall,
 * Echo, drift or any gate and changes no answer; the trace is kept in memory for this session only (nothing is stored).
 * Order: an existing concept is PINNED to its curated meaning (data/concept_senses.json, Open English WordNet 2025 plus
 * sense ids, CC BY 4.0); a word with one WordNet category is plain; a homograph (the forge-ref sense pack) is resolved
 * only by capitalisation; anything else is logged as would_ask (Forge would ask). Lesk overlap is logged as a hint only.
 * The pack is lazy-loaded from the forge-ref Storage bucket (public read, no credentials), checked against the SHA-256
 * pinned below before it is used, and kept in the Cache API. Python mirror: tools/sense_trace.py (parity: tools/parity_221_senses.js).
 * No model, no embeddings, no randomness. */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports;
const FORGE_REF = {"schema":"FORGE-REF/v1","cache":"forge-ref-v1","pack":{"name":"senses_oewn2025plus_homographs","file":"senses_oewn2025plus_homographs.b455e78860f7.json.gz","url":"https://hqcvywujrygbnaowgwln.supabase.co/storage/v1/object/public/forge-ref/senses_oewn2025plus_homographs.b455e78860f7.json.gz","bytes":1085683,"sha256":"b455e78860f76bd6e0bb23172cf3d47fd90710bdac91b505d31e85d5985cf476","integrity":"sha256-tFXniGD3a9bguyMXLPPUf9kHEL2skbUF0x6F1Zhc9HY=","licence":"CC BY 4.0","source":"Open English WordNet 2025 (plus edition)"}};
const TABLE_URL = 'data/concept_senses.json';
const STOP = new Set(('a an the of and or in on at to for by with from as is are was were be been being it its this that these those ' +
  'which who whom whose what when where why how not no any some all one two used use usually especially often very more most ' +
  'such than other into out up down over under about after before between also can may do does did has have had he she they ' +
  'them his her their our we you your i me my there here so if then because while much many each every only same').split(/\s+/));
const SUFFIXES = ['ing', 'ies', 'es', 's', 'ed', 'al', 'ly'];
function stem(w) { w = w.toLowerCase(); for (const suf of SUFFIXES) { if (w.length > suf.length + 3 && w.endsWith(suf)) { w = w.slice(0, -suf.length); break; } } return w.slice(0, 6); }
function forms(w) { const out = [w]; if (w.endsWith('ies') && w.length > 4) out.push(w.slice(0, -3) + 'y'); if (w.endsWith('es') && w.length > 3) out.push(w.slice(0, -2)); if (w.endsWith('s') && w.length > 3) out.push(w.slice(0, -1)); return out; }
function stripEnds(w) { return w.replace(/^[-']+/, '').replace(/[-']+$/, ''); }
function tokens(text) {
  text = String(text == null ? '' : text); const anyUpper = /[A-Z]/.test(text); const out = []; const re = /[A-Za-z][A-Za-z'-]*/g; let m;
  while ((m = re.exec(text))) {
    const raw = m[0]; const word = stripEnds(raw.toLowerCase().replace(/('s|')$/, ''));
    const before = text.slice(0, m.index).trimEnd(); const initial = !before || '.!?:;"\n'.indexOf(before[before.length - 1]) >= 0;
    out.push({ w: word, cap: (initial || !anyUpper) ? null : /^[A-Z]/.test(raw) });
  }
  return out;
}
function lesk(senses, context) {
  const scored = senses.map(s => { const sig = new Set(); for (const t of (String(s[5]).match(/[A-Za-z][A-Za-z'-]+/g) || [])) if (!STOP.has(t.toLowerCase()) && t.length > 2) sig.add(stem(t)); let n = 0; for (const x of sig) if (context.has(x)) n++; return [n, s[0]]; });
  scored.sort((a, b) => (b[0] - a[0]) || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  if (!scored.length || scored[0][0] < 1) return null;
  if (scored.length > 1 && scored[0][0] - scored[1][0] < 1) return null;
  return scored[0][1];
}
function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
function trace(text, table, pack) {
  const surf = (table && table.surfaces) || {}; const lemmas = (pack && pack.lemmas) || {}; const lexfiles = (pack && pack.lexfiles) || [];
  const toks = tokens(text).filter(t => t.w && !STOP.has(t.w) && t.w.length > 2); const used = toks.map(() => false); const entries = [];
  for (const size of [3, 2]) for (let i = 0; i + size <= toks.length; i++) {
    if (used.slice(i, i + size).some(Boolean)) continue;
    const key = toks.slice(i, i + size).map(t => t.w).join(' ');
    if (has(surf, key)) { for (let j = i; j < i + size; j++) used[j] = true; entries.push({ at: i, w: key, state: 'pinned', by: 'curated', concepts: surf[key].map(x => x[0]), senses: surf[key].map(x => x[1]) }); }
  }
  const context = new Set(toks.map(t => stem(t.w))); let plain = 0;
  toks.forEach((t, i) => {
    if (used[i]) return; const w = t.w;
    const hit = forms(w).find(f => has(surf, f));
    if (hit) { entries.push({ at: i, w, state: 'pinned', by: 'curated', concepts: surf[hit].map(x => x[0]), senses: surf[hit].map(x => x[1]) }); return; }
    const lem = forms(w).find(f => has(lemmas, f));
    if (!lem) { plain++; return; }
    const ss = lemmas[lem]; const proper = ss.filter(s => s[2] === 1); const common = ss.filter(s => s[2] === 0);
    const e = { at: i, w, n: ss.length };
    if (t.cap === true && proper.length === 1) Object.assign(e, { state: 'resolved', by: 'capitalisation', sense: proper[0][0], lexfile: lexfiles.length ? lexfiles[proper[0][1]] : proper[0][1] });
    else if (t.cap === false && common.length && new Set(common.map(s => s[1])).size === 1) Object.assign(e, { state: 'resolved', by: 'lowercase', sense: common[0][0], lexfile: lexfiles.length ? lexfiles[common[0][1]] : common[0][1] });
    else Object.assign(e, { state: 'would_ask', by: 'ambiguous' });
    const ctx = new Set(context); ctx.delete(stem(w));
    e.lesk = lesk(t.cap === true && proper.length ? proper : (t.cap === false && common.length ? common : ss), ctx);
    entries.push(e);
  });
  entries.sort((a, b) => a.at - b.at);
  const pinned = entries.filter(e => e.state === 'pinned');
  return { schema: 'FORGE-SENSE-TRACE/v1', mode: 'advisory', pack: Object.keys(lemmas).length > 0, entries,
    counts: { pinned: pinned.length, pinned_with_sense: pinned.filter(e => e.senses.some(Boolean)).length, resolved: entries.filter(e => e.state === 'resolved').length, would_ask: entries.filter(e => e.state === 'would_ask').length, plain } };
}
/* browser side: lazy table + pack, in-memory session log (nothing persisted, no Supabase, no network write) */
let table = null, pack = null, packState = 'not_loaded', loading = null; const LOG = []; const LOG_MAX = 50;
const totals = { asks: 0, pinned: 0, pinned_with_sense: 0, resolved: 0, would_ask: 0, plain: 0 };
async function sha256hex(buf) { const d = new Uint8Array(await crypto.subtle.digest('SHA-256', buf)); let s = ''; for (const b of d) s += b.toString(16).padStart(2, '0'); return s; }
async function gunzip(buf) { const ds = new DecompressionStream('gzip'); const out = new Response(new Blob([buf]).stream().pipeThrough(ds)); return out.text(); }
async function loadPack() {
  const p = FORGE_REF.pack; let cache = null; try { cache = await caches.open(FORGE_REF.cache); } catch (e) { cache = null; }
  let res = cache ? await cache.match(p.url) : null; let from = 'cache';
  if (!res) { from = 'network'; res = await fetch(p.url, { credentials: 'omit', referrerPolicy: 'no-referrer', integrity: p.integrity, cache: 'no-store' }); if (!res.ok) throw new Error('forge_ref_http_' + res.status); }
  const buf = await res.arrayBuffer();
  if (await sha256hex(buf) !== p.sha256) { if (cache) { try { await cache.delete(p.url); } catch (e) {} } throw new Error('forge_ref_sha256_mismatch'); }
  if (from === 'network' && cache) { try { await cache.put(p.url, new Response(buf.slice(0), { headers: { 'content-type': 'application/gzip' } })); } catch (e) {} }
  const j = JSON.parse(await gunzip(buf)); if (!j || j.schema !== 'FORGE-SENSE-PACK/v1') throw new Error('forge_ref_schema'); return j;
}
function ensure() {
  if (loading) return loading;
  loading = (async () => {
    if (!table) { try { const r = await fetch(TABLE_URL); table = r.ok ? await r.json() : null; } catch (e) { table = null; } }
    if (!pack && packState !== 'failed') { try { pack = await loadPack(); packState = 'loaded'; } catch (e) { packState = 'failed'; root.KSensesError = String(e && e.message || e); } }
    return { table: !!table, pack: packState };
  })();
  return loading;
}
/* called after Ask has rendered its card; never awaited by Ask */
function note(question) {
  return ensure().then(() => {
    if (!table) return null; const t = trace(question, table, pack); totals.asks++; for (const k of ['pinned', 'pinned_with_sense', 'resolved', 'would_ask', 'plain']) totals[k] += t.counts[k];
    LOG.push({ entries: t.entries, counts: t.counts, pack: packState }); while (LOG.length > LOG_MAX) LOG.shift(); return t;
  }).catch(() => null);
}

/* ---- 4.9.226 ask follow-up (Nic pt141u): after Forge asks "which meaning do you mean?" the user's reply is read, the meaning is
 * fixed, and the ORIGINAL question is asked again under it. Deterministic: ordinals, token overlap with the option's own words, and a
 * small fixed paraphrase table (WordNet lexicographer class and unit family words). No model, no embeddings, no randomness.
 * The pending ask is kept in memory for this session only (nothing stored). A reply that is a new question drops the pending ask and
 * is answered as a new question; a reply that does not pick one option is asked about once more, then dropped (FOLLOW_MAX_TRIES). */
const FOLLOW_MAX_TRIES = 2; const FOLLOW_MAX_OPTIONS = 4; const FOLLOW_UNIT_CHAIN = 3;
const ORDINALS = { first: 1, one: 1, second: 2, two: 2, third: 3, three: 3, fourth: 4, four: 4, last: -1 };
const LEX_ALIAS = {
  'noun.object': 'planet star moon world body object mountain river land rock sea',
  'noun.person': 'god goddess person man woman people human someone character figure messenger king queen',
  'noun.substance': 'metal element chemical substance material liquid gas compound',
  'noun.attribute': 'temperature property quality measure attribute reading degree',
  'noun.artifact': 'thing device tool machine building artifact instrument',
  'noun.location': 'place city country location region area town',
  'noun.group': 'group organization company institution team bank financial',
  'noun.phenomenon': 'force energy rays weather phenomenon',
  'noun.time': 'day date time year month period',
  'noun.animal': 'animal creature bird fish insect',
  'noun.plant': 'plant flower herb tree',
  'noun.food': 'food drink meal',
  'noun.act': 'act action event deed',
  'noun.communication': 'word message language text communication',
  'noun.cognition': 'idea concept thought knowledge',
  'noun.quantity': 'amount number quantity unit measure',
  'noun.possession': 'money funds property supply stock',
  'noun.state': 'state condition',
  'noun.body': 'body organ part',
  'noun.shape': 'shape figure form'
};
const UNIT_ALIAS = [
  [/\bus\b/, 'american united states usa'], [/\bimperial\b/, 'british uk english britain'], [/\bmetric\b/, 'si'],
  [/\bcelsius\b/, 'centigrade celcius'], [/\bfahrenheit\b/, 'farenheit'], [/\bmass\b/, 'weight avoirdupois'], [/\btroy\b/, 'gold jewelry precious'],
  [/\bfluid\b/, 'liquid volume'], [/\bkilocalorie\b/, 'food large big'], [/\bsmall\b/, 'little gram'], [/\bshort\b/, 'us american'], [/\blong\b/, 'british imperial']
];
const FOLLOW_FILL = new Set(('the a an of it its it\'s that this one ones i mean meant meaning sense please option number no yes ok okay sure just like ' +
  'think guess say pick choose take want about with is are was').split(/\s+/));
function followTokens(text) { return (String(text == null ? '' : text).toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) || []).map(w => w.replace(/'s$/, '')); }
function signature(opt) {
  const words = followTokens(opt.label + ' ' + (opt.gloss || '') + ' ' + (opt.aliases || ''));
  const set = new Set(); for (const w of words) if (!STOP.has(w) && !FOLLOW_FILL.has(w) && w.length > 1) { set.add(w); set.add(stem(w)); }
  return set;
}
function looksLikeNewQuestion(reply) {
  const r = String(reply || '').trim(); const toks = followTokens(r);
  if (/\?\s*$/.test(r) && toks.length >= 2) return true;
  return toks.length >= 3 && /^(what|who|whom|whose|where|when|why|how|which|is|are|was|were|do|does|did|can|could|would|should|will|convert|solve|calculate|compute|remember|tell|explain|define|describe|show|give|find|list)\b/.test(toks[0]);
}
function ordinalPick(reply, n) {
  const toks = followTokens(reply).filter(w => !FOLLOW_FILL.has(w) || ORDINALS[w] !== undefined);
  let core = toks.filter(w => w !== 'option' && w !== 'number');
  if (core.length === 2 && core.indexOf('one') >= 0) core = core.filter(w => w !== 'one'); // "the second one"
  if (core.length !== 1) return null; const w = core[0];
  if (/^\d+$/.test(w)) { const k = parseInt(w, 10); return k >= 1 && k <= n ? k - 1 : null; }
  if (ORDINALS[w] !== undefined) { const k = ORDINALS[w]; if (k === -1) return n - 1; return k <= n ? k - 1 : null; }
  return null;
}
/* the reply -> { state: 'resolved', index } | { state: 'again', tied? } | { state: 'new' } */
function pickOption(pending, reply) {
  const opts = pending.options; const r = String(reply || '').trim();
  if (!r) return { state: 'again', why: 'empty' };
  const o = ordinalPick(r, opts.length); if (o !== null) return { state: 'resolved', index: o, by: 'ordinal' };
  const rl = r.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const exact = opts.findIndex(x => rl === x.label.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim());
  if (exact >= 0) return { state: 'resolved', index: exact, by: 'label' };
  if (looksLikeNewQuestion(r)) return { state: 'new' };
  const toks = followTokens(r).filter(w => !FOLLOW_FILL.has(w) && !STOP.has(w) && w.length > 1);
  if (!toks.length) return { state: 'again', why: 'no_content' };
  const scores = opts.map(x => { const sig = signature(x); let n = 0; for (const w of toks) if (sig.has(w) || sig.has(stem(w))) n++; return n; });
  const best = Math.max.apply(null, scores);
  if (best < 1) return toks.length > 5 ? { state: 'new' } : { state: 'again', why: 'no_match' };
  const winners = scores.map((s, i) => (s === best ? i : -1)).filter(i => i >= 0);
  if (winners.length === 1) return { state: 'resolved', index: winners[0], by: 'words' };
  return { state: 'again', why: 'tied', tied: winners };
}
function unitPhrase(label) { return String(label).replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase(); }
function rewriteUnit(question, word, label) {
  const phrase = unitPhrase(label); const re = new RegExp('\\b' + String(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(s|es)?\\b', 'i');
  return String(question).replace(re, (m, pl) => phrase + (pl && !/s$/.test(phrase) ? 's' : ''));
}
function optionHint(lex) { return String(lex || '').replace(/^noun\./, '').replace(/^Tops$/, 'thing'); }
function shortGloss(g) { let s = String(g || '').replace(/\s+/g, ' ').trim(); const cut = s.search(/;/); if (cut > 15) s = s.slice(0, cut); return s.length > 72 ? s.slice(0, 69).trimEnd() + '...' : s; }
function conceptForSense(sid) { const cs = (table && table.concepts) || {}; for (const cid of Object.keys(cs).sort()) if (cs[cid] && cs[cid].sense === sid) return cid; return null; }
const SUBJECT_Q = /^\s*(?:what|who)\s+(?:is|are|was|were)\s+(?:(?:a|an|the)\s+)?([A-Za-z][A-Za-z'-]*)\s*[?.!]*\s*$/i;
/* Ask is held: should Forge ask which meaning? (an ambiguous unit word, or a single asked word with 2-4 WordNet meanings) */
function planAsk(question, row, ctx) {
  ctx = ctx || {}; const comp = row && row.computed;
  if (comp && comp.status === 'ambiguous_unit' && Array.isArray(comp.options) && comp.options.length >= 2) {
    if ((ctx.chain || 0) >= FOLLOW_UNIT_CHAIN) return null;
    const options = comp.options.map(label => { const low = label.toLowerCase(); let al = ''; for (const [re, a] of UNIT_ALIAS) if (re.test(low)) al += ' ' + a; return { label: String(label), aliases: al.trim(), phrase: unitPhrase(label) }; });
    return { kind: 'unit', question: String(question), word: String(comp.unit), options, tries: 0, chain: (ctx.chain || 0) + 1 };
  }
  if (comp && comp.status) return null;
  const m = SUBJECT_Q.exec(String(question)); if (!m || !pack || !table) return null;
  const word = m[1]; if (ctx.sensed && String(ctx.sensed).toLowerCase() === word.toLowerCase()) return null;
  const tr = trace(question, table, pack); const e = tr.entries.find(x => x.state === 'would_ask' && x.w === word.toLowerCase()); if (!e) return null;
  const lemmas = pack.lemmas || {}; const lexfiles = pack.lexfiles || []; const ss = lemmas[forms(word.toLowerCase()).find(f => has(lemmas, f))] || [];
  const toks = tokens(question).find(t => t.w === word.toLowerCase()); const cap = toks ? toks.cap : null;
  const proper = ss.filter(s => s[2] === 1); const common = ss.filter(s => s[2] === 0);
  let cand = cap === true && proper.length ? proper : (cap === false && common.length ? common : ss);
  const seen = new Set(); cand = cand.filter(s => { const k = String(s[5]).slice(0, 40); if (seen.has(k)) return false; seen.add(k); return true; });
  if (cand.length < 2 || cand.length > FOLLOW_MAX_OPTIONS) return null;
  const options = cand.map(s => { const lex = lexfiles.length ? lexfiles[s[1]] : String(s[1]); return { label: shortGloss(s[5]), gloss: String(s[5]), aliases: LEX_ALIAS[lex] || '', sense: s[0], lexfile: lex, hint: optionHint(lex), concept: conceptForSense(s[0]) }; });
  return { kind: 'sense', question: String(question), word: word, options, tries: 0, chain: 0 };
}
function askText(p, again) {
  if (p && p.kind === 'sim') {
    const lead = again ? 'I still need the kind. ' : '';
    return lead + 'What kind of ' + p.word + ' is it? Name the kind, or give the mass and the size.';
  }
  const list = p.options.map((o, i) => (i + 1) + ') ' + o.label + (o.hint ? ' [' + o.hint + ']' : '')).join('  ');
  const lead = again ? 'I still need one meaning for "' + p.word + '". ' : '';
  return lead + 'Which ' + p.word + ' do you mean? ' + list + ' Reply with the number or a few words.';
}
function followSim(pending, reply) {
  const r = String(reply || '').trim();
  if (!r) return { state: 'again', why: 'empty' };
  if (looksLikeNewQuestion(r)) return { state: 'new' };
  const span = String(pending.patientText || '');
  const q = String(pending.question || '');
  const i = span ? q.toLowerCase().indexOf(span.toLowerCase()) : -1;
  if (i < 0) return { state: 'new' };
  const bare = r.replace(/[?.!]+$/, '').trim();
  const measured = /\d/.test(bare);
  const repl = measured ? (span + ' ' + bare) : (/^(a|an|the)\b/i.test(bare) ? bare : 'a ' + bare);
  return { state: 'resolved', by: measured ? 'measure' : 'kind', option: { label: repl }, run: { question: q.slice(0, i) + repl + q.slice(i + span.length) } };
}
/* the user's reply to a pending ask -> what to do next */
function follow(pending, reply) {
  if (pending && pending.kind === 'sim') {
    const got = followSim(pending, reply);
    if (got.state !== 'again') return got;
    const tries = (pending.tries || 0) + 1;
    if (tries >= FOLLOW_MAX_TRIES) return { state: 'giveup' };
    return { state: 'again', pending: Object.assign({}, pending, { tries: tries }), text: askText(pending, true) };
  }
  if (!pending || !Array.isArray(pending.options)) return { state: 'new' };
  const pk = pickOption(pending, reply);
  if (pk.state === 'new') return { state: 'new' };
  if (pk.state === 'resolved') {
    const opt = pending.options[pk.index];
    if (pending.kind === 'unit') return { state: 'resolved', by: pk.by, option: opt, run: { question: rewriteUnit(pending.question, pending.word, opt.label), chain: pending.chain } };
    const others = pending.options.filter((x, i) => i !== pk.index && x.concept).map(x => x.concept);
    return { state: 'resolved', by: pk.by, option: opt, run: { question: pending.question, sense: { word: pending.word, sense: opt.sense, concept: opt.concept || null, gloss: opt.gloss, exclude_concepts: others }, sensed: pending.word, chain: pending.chain } };
  }
  const tries = (pending.tries || 0) + 1;
  if (tries >= FOLLOW_MAX_TRIES) return { state: 'giveup' };
  const next = Object.assign({}, pending, { tries });
  if (pk.tied && pk.tied.length > 1) next.options = pending.options.filter((x, i) => pk.tied.indexOf(i) >= 0);
  return { state: 'again', pending: next, text: askText(next, true) };
}
const api = { FORGE_REF, TABLE_URL, STOP, stem, forms, tokens, trace, ensure, note, planAsk, follow, askText, pickOption, rewriteUnit, FOLLOW_MAX_TRIES, setData: (tb, pk) => { table = tb; pack = pk; }, log: () => LOG.slice(), totals: () => Object.assign({ pack: packState }, totals) };
if (isNode) module.exports = api; else root.KSenses = api;
})(typeof self !== 'undefined' ? self : this);
