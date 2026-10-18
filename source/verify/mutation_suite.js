/* MUTATION-EVAL (M0 guard rails, 4.9.57) — metamorphic variants generated automatically from cases that already pass elsewhere in this verifier
 * (run.js GELC-ACCEPT worlds, w19 world cases, the POSITIVE memory cases). Operators, each with the answer the variant MUST give:
 *   rename      every made-up word and proper name → a fresh seeded pseudo-word (plural kept)            → same verdict
 *   synonym     every monosemous noun/adjective → a single-word lemma of the same WordNet synset          → same verdict
 *   shuffle     premise order permuted (the question stays last)                                       → same verdict
 *   paraphrase  one sentence rewritten in a form the grammar supports (Every X is a Y ↔ All Xs are Ys,
 *               No X is a Y ↔ No Xs are Ys, If something is a X then it is a Y → Every X is a Y, comma)   → same verdict
 *   word-order  a copular question as a tag question ("X is Y, isn't he?") and with a fronted topic ("As for X, is he Y?") → same verdict
 *   neg-q       "not" inserted into (or removed from) the question                                     → verdict flips (yes↔no; conflict/unknown stay)
 *   neg-fact    the minor premise negated                                                              → answer withheld (unknown), or flips when the
 *                                                                                                        premise IS the asked proposition
 *   contradict  the negation of the asked proposition added as a premise                               → conflict
 * Scores are REPORTED (artifact verify/mutation_scores.json + console). The suite blocks a release only on a crash, on a base case that no longer
 * passes, or on a variant that passed at the recorded baseline (eval_baseline.json) and fails now. Seeded: the same tree gives the same variants. */
const E = require('./eval_lib.js'); const ROOT = E.ROOT;
const KMOD = require(ROOT + '/src/kernel.js'), G = require(ROOT + '/src/grammar.js'); const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const open = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-18T12:00:00Z' });
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn }); const expect = (x, why) => { if (!x) throw new Error(why || 'expectation failed'); };
/* base cases: copied verbatim from passing checks (source noted); fact = index of the minor premise for neg-fact, factIsQuery = that premise is the asked proposition */
const BASES = [
  { id: 'b01', src: 'run.js GELC-ACCEPT', turns: ['All blorfs are zindles. Tom is a blorf. Is Tom a zindle?'], expect: 'yes', fact: 1 },
  { id: 'b02', src: 'run.js GELC-ACCEPT', turns: ['If something is a wug then it is a dax. Pim is a wug. Is Pim a dax?'], expect: 'yes', fact: 1 },
  { id: 'b03', src: 'run.js GELC-ACCEPT', turns: ['No glorbs are frits. Zed is a glorb. Is Zed a frit?'], expect: 'no', fact: 1 },
  { id: 'b04', src: 'run.js GELC-ACCEPT', turns: ['Every krell that is red is a vosk. Ana is a krell. Ana is red. Is Ana a vosk?'], expect: 'yes', fact: 2 },
  { id: 'b05', src: 'run.js GELC-ACCEPT', turns: ['Tom is a blorf. Tom is not a blorf. Is Tom a blorf?'], expect: 'conflict' },
  { id: 'b06', src: 'w19 worldCase', turns: ['Every glimmer is a nova. Every nova is quiet. Rhea is a glimmer. Is Rhea quiet?'], expect: 'yes', fact: 2 },
  { id: 'b07', src: 'w19', turns: ['Every arin is bel. Every bel is cor. Every cor is dul. Ivo is an arin. Is Ivo dul?'], expect: 'yes', fact: 3 },
  { id: 'b08', src: 'w19', turns: ['Every pilot vexes Orin. Sava is a pilot. Does Sava vex Orin?'], expect: 'yes', fact: 1 },
  { id: 'b09', src: 'w19', turns: ['If someone admires Sol, then they trust Luna. Nera admires Sol. Does Nera trust Luna?'], expect: 'yes', fact: 1 },
  { id: 'b10', src: 'w19', turns: ['Lio is amber. Is Lio not amber?'], expect: 'no', fact: 0, factIsQuery: true },
  { id: 'b11', src: 'w19', turns: ['Every flint is gleam. Rava is flint. Orin is quiet. Is Rava gleam?'], expect: 'yes', fact: 1 },
  { id: 'b12', src: 'w19', turns: ['Every glimmer is quiet. Rhea is not glimmer. Is Rhea quiet?'], expect: 'unknown' },
  { id: 'b13', src: 'w19', turns: ['Every quorin is a vexal. Every vexal is lucid. Toma is a quorin. Is Toma lucid?'], expect: 'yes', fact: 2 },
  { id: 'b14', src: 'run.js POSITIVE', turns: ['remember that my car is red', 'is my car red?'], expect: 'yes', memory: true },
  { id: 'b15', src: 'w19', turns: ['Every blorf is a zindle. Suppose Tom is a blorf. Is Tom a zindle?'], expect: 'yes', noShuffle: true },
  { id: 'b16', src: 'w19', turns: ['All horses are animals. Tom is a horse. Is Tom an animal?'], expect: 'yes', fact: 1 },
  { id: 'b17', src: 'w19', turns: ['Every dog is an animal. Rex is a dog. Is Rex an animal?'], expect: 'yes', fact: 1 },
  { id: 'b18', src: 'w19', turns: ['Every artist admires Luna. Nera is an artist. Does Nera admire Luna?'], expect: 'yes', fact: 1 },
  { id: 'b19', src: 'w19', turns: ['All buses are cars. Tom is a bus. Is Tom a car?'], expect: 'yes', fact: 1 },
  { id: 'b20', src: 'run.js POSITIVE', turns: ['remember that my sister lives in Paris', 'where does my sister live?'], expect: 'contains:Paris', memory: true }];
const FUNC = new Set(['every', 'all', 'no', 'if', 'is', 'are', 'does', 'do', 'can', 'suppose', 'each', 'some', 'then', 'it', 'they', 'something', 'someone', 'not', 'a', 'an', 'the', 'that', 'remember', 'my']);
const inLex = l => !!(LEX.L[l] || (EXT.L && EXT.L[l]) || (LEX.exc && LEX.exc[l]));
const known = w => { const l = w.toLowerCase(); return inLex(l) || inLex(l.replace(/s$/, '')) || inLex(l.replace(/es$/, '')) || inLex(l.replace(/e?d$/, '')); };
const fixArt = t => t.replace(/\b(a|an) ([A-Za-z])/g, (m, a, c) => (/[aeiou]/i.test(c) ? 'an ' : 'a ') + c);
/* synonyms: single-word lemmas sharing the FIRST WordNet sense (same synset) of a noun or adjective — a consistent substitution keeps the meaning */
let SYN = null; function synIndex() { if (SYN) return SYN; SYN = new Map(); for (const [w, es] of Object.entries(LEX.L)) { if (!/^[a-z]{3,12}$/.test(w)) continue; for (const e of es) if ((e[0] === 'n' || e[0] === 'a') && e[1] && e[1][0]) { const k = e[0] + ':' + e[1][0][0]; if (!SYN.has(k)) SYN.set(k, []); SYN.get(k).push(w); } } return SYN; }
function synonymOf(w) { const es = LEX.L[w]; if (!es) return null; const e = es.find(x => x[0] === 'n' || x[0] === 'a'); if (!e || !e[1] || !e[1][0]) return null; const sid = e[1][0][0]; /* the word's first sense */
  const alts = (synIndex().get(e[0] + ':' + sid) || []).filter(x => x !== w && !known(x + 's') === false && (LEX.L[x] || []).find(y => y[0] === e[0])[1][0][0] === sid && !FUNC.has(x)); return alts.length ? alts.sort()[0] : null; } /* the synonym's own first sense is the same synset */
function synonym(b) { const text = b.turns.join(' \u0001 '); const toks = [...new Set((text.match(/\b[a-z]+\b/g) || []))]; const map = new Map();
  for (const t of toks) { if (FUNC.has(t) || t.length < 3 || G.CL[t]) continue; /* closed-class words (prepositions, auxiliaries, wh-words) never change */ const s = LEX.L[t] ? t : LEX.L[t.replace(/s$/, '')] ? t.replace(/s$/, '') : null; if (!s || map.has(s)) continue; const y = synonymOf(s); if (y) map.set(s, y); }
  if (!map.size) return null; const out = text.replace(/\b[a-z]+\b/g, w => map.has(w) ? map.get(w) : /s$/.test(w) && map.has(w.slice(0, -1)) ? pl(map.get(w.slice(0, -1))) : w); return out === text ? null : fixArt(out).split(' \u0001 '); }
function rng(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
function pseudo(r, used) { const C = 'bdfgklmnprtvz', V = 'aeiou'; for (;;) { const p = k => k[Math.floor(r() * k.length)]; const w = p(C) + p(V) + p(C) + p(C) + p(V) + p('dklmnrt'); if (!known(w) && !used.has(w)) { used.add(w); return w; } } }
const sentences = t => t.split(/(?<=[.?!])\s+/);
const flipV = { yes: 'no', no: 'yes', conflict: 'conflict', unknown: 'unknown' };
/* rename: made-up words (outside the lexicon) and capitalised names; plural forms share the stem */
function rename(b, seed) { if (b.memory) return null; /* memory bases use lexicon words and a quoted answer: nothing made up to rename */ const r = rng(seed), used = new Set(), map = new Map(); const text = b.turns.join(' \u0001 '); const toks = text.match(/[A-Za-z]+/g) || []; const all = new Set(toks.map(t => t.toLowerCase()));
  const stem = w => { const l = w.toLowerCase(); if (/es$/.test(l) && all.has(l.slice(0, -2))) return [l.slice(0, -2), 's']; if (/s$/.test(l) && all.has(l.slice(0, -1))) return [l.slice(0, -1), 's']; return [l, '']; };
  const out = text.replace(/[A-Za-z]+/g, w => { const l = w.toLowerCase(); if (FUNC.has(l)) return w; const [s, suf] = stem(w); const isName = /^[A-Z]/.test(w) && !FUNC.has(l); if (!isName && known(s)) return w;
    if (!map.has(s)) map.set(s, pseudo(r, used)); const n = map.get(s) + suf; return isName ? n[0].toUpperCase() + n.slice(1) : n; });
  return map.size ? fixArt(out).split(' \u0001 ') : null; }
function shuffles(b) { if (b.memory || b.noShuffle) return []; const ss = sentences(b.turns[0]), q = ss.pop(); if (ss.length < 2) return []; const out = [], seen = new Set([ss.join(' ')]); /* (no article change needed) */
  for (let s = 1; s <= 6 && out.length < 2; s++) { const r = rng(s * 7919), p = ss.slice(); for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } const k = p.join(' '); if (!seen.has(k)) { seen.add(k); out.push([k + ' ' + q]); } } return out; }
const pl = w => (/(s|x|z|ch|sh)$/.test(w) ? w + 'es' : w + 's'), sg = w => { if (!/s$/.test(w)) return w; const a = w.slice(0, -2), b = w.slice(0, -1); if (/es$/.test(w) && inLex(a) && !inLex(b)) return a; if (/(xes|ches|shes|sses|zes)$/.test(w)) return a; return b; };
const vbase = v => (/(xes|ches|shes|sses|zes)$/.test(v) ? v.slice(0, -2) : v.replace(/s$/, ''));
const PARA = [[/^Every (\w+) is (a|an) (\w+)\.$/, m => 'All ' + pl(m[1]) + ' are ' + pl(m[3]) + '.'], [/^Every (\w+) is (\w+)\.$/, m => 'All ' + pl(m[1]) + ' are ' + m[2] + '.'],
  [/^All (\w+) are (\w+)\.$/, m => 'Every ' + sg(m[1]) + ' is ' + (m[2].endsWith('s') ? 'a ' + sg(m[2]) : m[2]) + '.'], [/^No (\w+) are (\w+)\.$/, m => 'No ' + sg(m[1]) + ' is a ' + sg(m[2]) + '.'],
  [/^If something is (a|an) (\w+),? then it is (a|an) (\w+)\.$/, m => 'Every ' + m[2] + ' is ' + m[3] + ' ' + m[4] + '.'], [/^If (\w+) (\w+) (\w+), then (.+)$/, m => 'If ' + m[1] + ' ' + m[2] + ' ' + m[3] + ' then ' + m[4]],
  [/^Every (\w+) (\w+s) ([A-Z]\w+)\.$/, m => 'All ' + pl(m[1]) + ' ' + vbase(m[2]) + ' ' + m[3] + '.']];
function paraphrases(b) { if (b.memory) return []; const ss = sentences(b.turns[0]), out = []; ss.forEach((s, i) => { for (const [re, f] of PARA) { const m = s.match(re); if (m) { const t = ss.slice(); t[i] = f(m); out.push([fixArt(t.join(' '))]); break; } } }); return out; }
/* word order the grammar declares (LL-TAG-QUESTION, LL-TOPIC-FRONTED): a copular question as a tag question and with a fronted topic */
function wordOrder(b) { if (b.memory) return []; const ss = sentences(b.turns[0]), q = ss.pop(); const m = q.match(/^Is ([A-Z]\w*) (?!not )(.+)\?$/); if (!m) return [];
  return [[ss.concat([m[1] + ' is ' + m[2] + ", isn't he?"]).join(' ')], [ss.concat(['As for ' + m[1] + ', is he ' + m[2] + '?']).join(' ')]]; }
function negQ(b) { const last = b.turns[b.turns.length - 1], ss = sentences(last), q = ss.pop(); const m = q.match(/^(Is|Are|Does|Do|is|are|does|do) (\S+(?: \S+)??) (not )?(.+)\?$/); if (!m) return null;
  const ws = (m[2] + ' ' + (m[3] || '') + m[4]).replace(/\s+/g, ' ').replace(/^(\S+(?: \S+)?) not /, '$1 ').split(' '); const sl = /^(my|the|your)$/i.test(ws[0]) ? 2 : 1; const subj = ws.slice(0, sl).join(' '), rest = ws.slice(sl).join(' '); const nq = m[1] + ' ' + subj + ' ' + (m[3] ? '' : 'not ') + rest + '?';
  return b.turns.slice(0, -1).concat([ss.concat([nq]).join(' ')]); }
function negFact(b) { if (b.fact === undefined || b.memory) return null; const ss = sentences(b.turns[0]), s = ss[b.fact]; const m = s.match(/^(\S+) (is|are) (?!not )(.+)\.$/) || s.match(/^(\S+) (admires|likes) (.+)\.$/); if (!m) return null;
  ss[b.fact] = /^(is|are)$/.test(m[2]) ? m[1] + ' ' + m[2] + ' not ' + m[3] + '.' : m[1] + ' does not ' + vbase(m[2]) + ' ' + m[3] + '.'; return [ss.join(' ')]; }
function contradict(b) { if (b.expect !== 'yes' || b.memory || b.noShuffle) return null; const ss = sentences(b.turns[0]), q = ss.pop(); const m = q.match(/^(Is|Does) (\S+) (.+)\?$/); if (!m) return null;
  const neg = m[1] === 'Is' ? m[2] + ' is not ' + m[3] + '.' : m[2] + ' does not ' + m[3] + '.'; return [ss.concat([neg, q]).join(' ')]; }
function variants(b) { const v = []; for (const s of [11, 23, 37]) { const t = rename(b, s + b.id.charCodeAt(2) * 101); if (t) v.push({ op: 'rename', turns: t, expect: b.expect }); }
  { const t = synonym(b); if (t) v.push({ op: 'synonym', turns: t, expect: b.expect }); }
  shuffles(b).forEach(t => v.push({ op: 'shuffle', turns: t, expect: b.expect })); paraphrases(b).forEach(t => v.push({ op: 'paraphrase', turns: t, expect: b.expect }));
  wordOrder(b).forEach(t => v.push({ op: 'word-order', turns: t, expect: b.expect }));
  { const t = negQ(b); if (t) v.push({ op: 'neg-q', turns: t, expect: flipV[b.expect] }); }
  { const t = negFact(b); if (t) v.push({ op: 'neg-fact', turns: t, expect: b.factIsQuery ? flipV[b.expect] : 'unknown' }); }
  { const t = contradict(b); if (t) v.push({ op: 'contradict', turns: t, expect: 'conflict' }); }
  const n = {}; return v.map(x => Object.assign(x, { id: b.id + ':' + x.op + ':' + (n[x.op] = (n[x.op] || 0) + 1) })); }
const run = (turns, ex) => { let r = null, err = null; try { r = E.runCase(open, turns); } catch (e) { err = String(e && e.message || e).slice(0, 200); } const v = err ? 'crash' : E.verdict(r); return { verdict: v, pass: !err && E.judge(ex, v, r && r.reply), crash: err, reply: r && r.reply ? String(r.reply).slice(0, 160) : null }; };
const baseRes = BASES.map(b => Object.assign({ id: b.id, src: b.src, expect: b.expect }, run(b.turns, b.expect)));
const muts = []; for (const b of BASES) for (const v of variants(b)) muts.push(Object.assign({ id: v.id, base: b.id, op: v.op, input: v.turns.join(' ⏎ '), expect: v.expect }, run(v.turns, v.expect)));
const baseline = E.readBaseline(), passed = muts.filter(x => x.pass).length;
E.writeArtifact('mutation_scores.json', { schema: 'forge-mutation-score/v1', bases: baseRes.length, bases_passed: baseRes.filter(x => x.pass).length, variants: muts.length, passed, rate: +(passed / (muts.length || 1)).toFixed(4), by_operator: E.tally(muts, 'op'), results: muts, base_results: baseRes });
T('MUTATION every base case (copied from a passing check) still passes', () => { const bad = baseRes.filter(x => !x.pass); expect(!bad.length, bad.map(x => x.id + ' ' + x.verdict + ' ≠ ' + x.expect).join(' | ')); });
T('MUTATION generator yields every operator (rename, synonym, shuffle, paraphrase, word-order, neg-q, neg-fact, contradict) and at least 80 variants', () => { const ops = new Set(muts.map(x => x.op)); for (const o of ['rename', 'synonym', 'shuffle', 'paraphrase', 'word-order', 'neg-q', 'neg-fact', 'contradict']) expect(ops.has(o), 'no ' + o + ' variants'); expect(muts.length >= 80, muts.length + ' variants'); });
T('MUTATION every variant runs to a reply without a crash', () => { const bad = muts.filter(x => x.crash); expect(!bad.length, bad.slice(0, 5).map(x => x.id + ': ' + x.crash).join(' | ')); });
T('MUTATION no regression: every variant that passed at the recorded baseline still passes (scores are reported, not required)', () => {
  expect(baseline && baseline.mutation && Array.isArray(baseline.mutation.passed_ids), 'no recorded mutation baseline in verify/eval_baseline.json');
  const now = new Set(muts.filter(x => x.pass).map(x => x.id)); const lost = baseline.mutation.passed_ids.filter(id => !now.has(id));
  expect(!lost.length, 'regressed vs baseline: ' + lost.map(id => { const x = muts.find(y => y.id === id); return id + (x ? ' (' + x.verdict + ' ≠ ' + x.expect + ': ' + x.input + ')' : ' (variant no longer generated)'); }).join(' | ')); });
for (const t of tests) { try { t.fn(); rows.push({ cls: 'MUTATION-EVAL', name: t.name, ok: true }); } catch (e) { rows.push({ cls: 'MUTATION-EVAL', name: t.name, ok: false, why: String(e && e.message || e).slice(0, 1400) }); } }
if (process.argv.includes('--report')) process.stderr.write('MUTATION ' + passed + '/' + muts.length + ' ' + JSON.stringify(E.tally(muts, 'op')) + '\n' + muts.map(x => (x.pass ? 'PASS ' : 'FAIL ') + x.id + ' [' + x.verdict + ' vs ' + x.expect + '] ' + x.input + ' → ' + (x.reply || x.crash || '')).join('\n') + '\n');
process.stdout.write(JSON.stringify(rows));
