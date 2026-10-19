/* MEA-K GUARD (4.9.75, MEA build-plan step 6): one case per MEA-K mutable cell (data/mea_k_cells.json), written from what the words MEAN — not
 * from the shipped tables and not from the held-out file — exactly as the relation-property guard (relprop_guard_suite.js) is for MEA's relation
 * cells. A manifest that flips a cell against the meaning breaks a case here and is rejected by evidence, never adopted for want of a test.
 *   LEXCLASS  a noun that means a female (male) person takes "she" ("he") and not the other pronoun; a noun that is not gendered by its common
 *             meaning takes either (it must not enter a gender class).
 *   FRAME     "X is ADJ to V": the kāraka the subject fills (kartā: it does the V-ing; karma: it undergoes it; both: two readings kept open).
 *             Bare-infinitive perception/causative verbs keep the "saw her duck" second reading open; object-control verbs take "V somebody to V".
 *   PARSER    each open function-category word still parses in its category (PREP before a noun phrase, SUB before a clause, ADV, PART).
 * GROWTH cases (pool words a candidate may ADD) are run only by the MEA-K evaluator (opts.growth): today's grammar does not yet have them,
 * so in the release run they are counted against a declared list instead of asserted — a candidate that adds one correctly GAINS a case.
 * GAPS: cells whose meaning case the current grammar cannot express, each with its reason; the release run asserts they are still gaps, so a
 * gap that closes is noticed and gets its case. */
module.exports = ({ C, expect, ROOT, growth }) => {
  const KM = require(ROOT + '/src/kernel.js'), G = require(ROOT + '/src/grammar.js'), MK = require(ROOT + '/src/mea_k.js'); const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
  const K = () => { const st = {}; return KM.Kernel({ clock: () => '2026-10-18T12:00:00Z', lexicon: LEX, lexiconExt: EXT, store: KM.MemoryStore({ get: k => (k in st ? st[k] : null), set: (k, v) => { st[k] = String(v); }, del: k => { delete st[k]; }, keys: () => Object.keys(st) }) }); };
  const yes = r => /(?:^|[.!?] )Yes\b/.test(r.reply), ask = t => K().process(t);
  /* the meaning tables (hand-written) */
  const GENDER = { f: 'aunt daughter girl girlfriend grandma grandmother lady mom mother mum niece queen sister wife woman widow housewife mistress miss', m: 'boy boyfriend brother dad father grandfather grandpa husband king man nephew son uncle fellow gentleman guy sir lad', n: 'eve adam don stiff' };
  const SUBJ_FILLS = { able: 'karta', afraid: 'karta', anxious: 'karta', eager: 'karta', glad: 'karta', happy: 'karta', keen: 'karta', likely: 'karta', reluctant: 'karta', unable: 'karta', unlikely: 'karta', willing: 'karta',
    difficult: 'karma', easy: 'karma', hard: 'karma', impossible: 'karma', pleasant: 'karma', simple: 'karma', tough: 'karma', fit: 'karma+karta', ready: 'karma+karta' };
  const SECOND_READING = { y: 'feel have hear help let make notice observe see watch present show', n: 'blast suffer gag look air expose' }; /* present/show: ditransitive */
  const OBJ_CONTROL = { y: 'advise allow ask authorise authorize cause compel direct enable encourage expect force help instruct invite oblige order permit persuade remind require teach tell train urge want warn', n: 'call point deal rail snap deliver project say' };
  const GAPS = { 'frame|ADJ_INF|willing': '"willing" is analysed as the participle of "will", so "X is willing to V" yields no adjective-infinitive reading', 'frame|objinf|authorise': 'British spelling: not a lexicon lemma, so the frame cell is inert',
    'parser|SUB|although': 'no subordinate-clause position the grammar parses for it yet', 'parser|SUB|whereas': 'no subordinate-clause position the grammar parses for it yet' };
  const tab = o => Object.fromEntries(Object.entries(o).flatMap(([v, ws]) => ws.split(' ').map(w => [w, v])));
  const GEN = tab(GENDER), SEC = tab(SECOND_READING), OBJ = tab(OBJ_CONTROL), past = v => G.inflect(v, 'past');
  const D = t => K().derive(t).parses;
  const PT = { PREP: [w => 'Tom waited ' + w + ' the house'], SUB: [w => 'Tom waited ' + w + ' Bob ran', w => w + ' Bob ran, Tom waited'], ADV: [w => 'Tom waited ' + w, w => 'Tom ' + w + ' waited', w => 'Tom is ' + w + ' tall', w => 'Tom will ' + w + ' wait'], PART: [w => 'Tom ran ' + w] };
  const check = c => { const k = c.fam + '|' + c.row + '|' + c.key;
    if (c.fam === 'lexclass') { const g = GEN[c.key]; if (!g) return () => expect(false, 'no meaning entry for ' + c.key);
      if (g === 'n') return () => { expect(yes(ask('The ' + c.key + ' is tall. Is she tall?')) && yes(ask('The ' + c.key + ' is tall. Is he tall?')), '"' + c.key + '" is not gendered by meaning but a pronoun was refused'); };
      const same = g === 'f' ? 'she' : 'he', other = g === 'f' ? 'he' : 'she';
      return () => { const a = ask('The ' + c.key + ' is tall. Is ' + same + ' tall?'), b = ask('The ' + c.key + ' is tall. Is ' + other + ' tall?'); expect(yes(a) && a.trace.echo.pass, '"' + same + '" did not take "' + c.key + '": ' + a.reply); expect(!yes(b), '"' + other + '" took "' + c.key + '": ' + b.reply); }; }
    if (c.fam === 'frame' && c.row === 'ADJ_INF') return () => { const got = [...new Set(D('the visitor is ' + c.key + ' to see').map(p => (JSON.stringify(p.node.clause).match(/"ctrl":"(\w+)"/) || [])[1]).filter(Boolean))].sort().join('+'); expect(got === SUBJ_FILLS[c.key], '"' + c.key + ' to V": subject fills ' + (got || 'nothing') + ', meaning says ' + SUBJ_FILLS[c.key]); };
    if (c.fam === 'frame' && c.row === 'bareinf') return () => { const got = D('I ' + past(c.key) + ' Tom duck').some(p => p.rules.includes('K-SAMPRADANA-DOUBLE-OBJECT')); expect(got === (SEC[c.key] === 'y'), '"I ' + past(c.key) + ' Tom duck": second reading ' + (got ? 'open' : 'missing') + ', meaning says ' + (SEC[c.key] === 'y' ? 'open' : 'none')); };
    if (c.fam === 'frame' && c.row === 'objinf') return () => { const got = D('I ' + past(c.key) + ' Tom to swim').some(p => p.rules.includes('K-KARMA-CONTROL-INF')); expect(got === (OBJ[c.key] === 'y'), '"I ' + past(c.key) + ' Tom to swim": object control ' + (got ? 'taken' : 'missing') + ', meaning says ' + (OBJ[c.key] === 'y' ? 'yes' : 'no')); };
    if (c.fam === 'parser') return () => { expect(PT[c.row].some(f => D(f(c.key)).length > 0), '"' + c.key + '" no longer parses as ' + c.row); };
    return () => expect(false, 'undeclared family ' + k); };
  const cells = MK.cells(), name = c => c.fam + ' ' + c.row + ' ' + c.key;
  C('MEAK-GUARD', 'the meaning tables cover every MEA-K mutable cell (no cell is adoptable by absence of a test)', () => {
    const miss = cells.filter(c => c.fam === 'lexclass' ? !GEN[c.key] : c.row === 'ADJ_INF' ? !SUBJ_FILLS[c.key] : c.row === 'bareinf' ? !SEC[c.key] : c.row === 'objinf' ? !OBJ[c.key] : c.fam === 'parser' ? !PT[c.row] : true); expect(!miss.length, 'uncovered: ' + miss.map(name).join(', ')); });
  C('MEAK-GUARD', 'declared gaps are still gaps (a gap that closes must get its case)', () => { for (const c of cells) { const k = c.fam + '|' + c.row + '|' + c.key; if (!GAPS[k]) continue; let ok = false; try { check(c)(); ok = true; } catch (e) { ok = false; } expect(!ok, 'gap closed: ' + k); } });
  for (const c of cells) { const k = c.fam + '|' + c.row + '|' + c.key; if (GAPS[k]) continue;
    if (c.growth && !growth) continue; C(c.growth ? 'MEAK-GROWTH' : 'MEAK-GUARD', name(c), check(c)); }
  if (!growth) C('MEAK-GUARD', 'growth cases exist for every pool word (run by tools/mea_k_eval.js)', () => { const g = cells.filter(c => c.growth); expect(g.length === 37 && g.every(c => !GAPS[c.fam + '|' + c.row + '|' + c.key]), 'pool size ' + g.length); });
};
