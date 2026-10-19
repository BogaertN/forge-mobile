/* tools/mea_k_cells.js — 4.9.75 MEA step 6: the DECLARED mutable-cell sets of the new MEA-K delta families, generated mechanically (no hand-picked
   words, no test vocabulary) and written to data/mea_k_cells.json (shipped as part of src/mea_k_data.js by tools/mea_k_eval.js).
   lexclass  FEMALE / MALE (pronoun gender classes): every current member may be removed; growth pool = WordNet nouns whose PRIMARY sense has the
             class anchor ('female' 09619168n / 'male' 09624168n, both under 'person') in its hypernym closure, not already in a class (vocabulary
             growth by the taxonomy, Chomsky ruling: grow vocabulary, not rules)
   frame     ADJ_INF role cells (the kāraka the subject of "ADJ to V" fills: subj / karma / both) for every current entry; FRAME_SUPP membership
             (bareinf / objinf) for every current member, growth pool = WordNet verbs whose primary sense shares a direct hypernym with a member's
             primary sense (typed by the taxonomy, never by name)
   parser    category membership in the OPEN function categories only (PREP, SUB, ADV, PART): every current member may be removed; growth pool =
             WordNet adverbs (primary sense, highest SemCor count) for ADV. Closed functional heads (COP AUX MOD WH NEG DET POSS QUANT PRON CONJ REL
             COMP IF THEN THAN PLEASE INTJ) are not mutable (structure-dependence gate).
   Pools are capped (POOL) and sorted (SemCor count ↓, then word) so the set is finite and deterministic. Usage: node tools/mea_k_cells.js */
const fs = require('fs'), path = require('path'), ROOT = path.join(__dirname, '..');
const G = require(ROOT + '/src/grammar.js'), LX = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'lexicon.json'), 'utf8'));
const POOL = 8, L = LX.L, H = LX.H;
const prim = (w, pos) => { const e = (L[w] || []).find(x => x[0] === pos); return e && e[1][0] ? { syn: e[1][0][0], lexname: e[1][0][1], count: e[2] || 0 } : null; };
const closure = s => { const out = new Set(), st = [s]; while (st.length) { const x = st.pop(); for (const h of H[x] || []) if (!out.has(h)) { out.add(h); st.push(h); } } return out; };
const inAnyClosed = w => !!G.CL[w];
const pool = (pos, pred, exclude) => Object.keys(L).filter(w => /^[a-z]+$/.test(w) && !exclude.has(w) && !inAnyClosed(w)).map(w => ({ w, p: prim(w, pos) })).filter(x => x.p && pred(x.w, x.p)).sort((a, b) => b.p.count - a.p.count || (a.w < b.w ? -1 : 1)).slice(0, POOL).map(x => x.w);
const gender = new Set([...G.FEMALE, ...G.MALE]);
const ANCHOR = { FEMALE: '09619168n', MALE: '09624168n' };
const lexclass = Object.fromEntries(Object.entries(ANCHOR).map(([cls, a]) => [cls, { members: [...G[cls]].sort(), pool: pool('n', (w, p) => closure(p.syn).has(a), gender) }]));
/* WordNet ships no verb hypernyms in this tier: verbs are typed by the lexicographer file (semantic field) the members share most */
const fieldOf = ws => { const c = {}; for (const w of ws) { const p = prim(w, 'v'); if (p) c[p.lexname] = (c[p.lexname] || 0) + 1; } return Object.entries(c).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]; };
const frameSupp = {}; for (const kind of ['bareinf', 'objinf']) { const ms = [...G.FRAME_SUPP[kind]], f = fieldOf(ms); frameSupp[kind] = { members: ms.sort(), field: f ? LX.meta.lexnames[+f[0]] : null, pool: f ? pool('v', (w, p) => p.lexname === +f[0], new Set(ms)) : [] }; }
const OPEN = ['PREP', 'SUB', 'ADV', 'PART'], parser = {}; for (const cat of OPEN) parser[cat] = { members: G.CLOSED[cat].split(' ').sort(), pool: cat === 'ADV' ? pool('r', () => true, new Set()) : [] };
const out = { schema: 'FORGE-MEA-K-CELLS/v1', generated_by: 'tools/mea_k_cells.js', pool_cap: POOL, lexclass, frame: { ADJ_INF: { entries: Object.keys(G.ADJ_INF).sort(), values: ['subj', 'karma', 'both'] }, FRAME_SUPP: frameSupp }, parser, immutable_categories: Object.keys(G.CLOSED).filter(c => !OPEN.includes(c)).sort() };
fs.writeFileSync(path.join(ROOT, 'data', 'mea_k_cells.json'), JSON.stringify(out, null, 1) + '\n');
console.log('lexclass pools', Object.values(lexclass).map(x => x.pool.join(',')).join(' | '), '· frame pools', Object.values(frameSupp).map(x => x.pool.join(',')).join(' | '), '· ADV pool', parser.ADV.pool.join(','));
