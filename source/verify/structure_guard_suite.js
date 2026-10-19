/* STRUCTURE-DEPENDENCE GUARD (4.9.75, MEA build-plan step 6; Nic's Chomsky ruling): grammar evolution may change VOCABULARY (which words fill an
 * open category), never structure. Rules stay category-based, so these cases — written from what the sentences mean — must hold under every
 * MEA-K candidate; tools/mea_k_eval.js treats ANY regression here as a hard gate (the candidate is rejected, whatever else it gains).
 *   · the auxiliary that fronts is the MAIN-clause one ("Is the man who is tall happy?"), never the linearly first ("*Is the man who tall is happy?")
 *   · a relative clause modifies its noun; it is not the main predication (subject gap / object gap)
 *   · a prepositional phrase inside the subject stays inside it; negation inside a relative clause stays there
 *   · closed functional categories (AUX COP MOD WH NEG DET REL …) can never be touched by a manifest (legality), and none is ever empty */
module.exports = ({ C, expect, ROOT }) => {
  const KM = require(ROOT + '/src/kernel.js'), G = require(ROOT + '/src/grammar.js'), MK = require(ROOT + '/src/mea_k.js'); const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
  const K = () => { const st = {}; return KM.Kernel({ clock: () => '2026-10-18T12:00:00Z', lexicon: LEX, lexiconExt: EXT, store: KM.MemoryStore({ get: k => (k in st ? st[k] : null), set: (k, v) => { st[k] = String(v); }, del: k => { delete st[k]; }, keys: () => Object.keys(st) }) }); };
  const yes = r => /(?:^|[.!?] )Yes\b/.test(r.reply), ask = t => K().process(t), D = t => K().derive(t).parses;
  C('STRUCTURE-GUARD', 'aux-fronting takes the main-clause auxiliary: "Is the man who is tall happy?" is answered from "The man who is tall is happy"', () => { const r = ask('The man who is tall is happy. Is the man who is tall happy?'); expect(yes(r) && r.trace.echo.pass, r.reply); });
  C('STRUCTURE-GUARD', 'fronting the linearly first auxiliary is not English: "*Is the man who tall is happy?" gets no answer', () => { const r = ask('The man who is tall is happy. Is the man who tall is happy?'); expect(!yes(r), r.reply); });
  C('STRUCTURE-GUARD', 'the relative clause is not the main predication: "Is the man who is happy tall?" is not confirmed', () => { const r = ask('The man who is tall is happy. Is the man who is happy tall?'); expect(!yes(r), r.reply); });
  C('STRUCTURE-GUARD', 'subject-gap relative: "the man who is tall is happy" has one derivation, main predicate "happy"', () => { const ps = D('the man who is tall is happy'); expect(ps.length === 1 && ps[0].rules.includes('G-REL-SUBJ-GAP') && JSON.stringify(ps[0].node.clause.pred).includes('happy') && !JSON.stringify(ps[0].node.clause.pred).includes('tall'), JSON.stringify(ps.map(p => p.rules))); });
  C('STRUCTURE-GUARD', 'object-gap relative: "the dog that the cat saw is brown" derives with the object gap', () => { const ps = D('the dog that the cat saw is brown'); expect(ps.length >= 1 && ps.every(p => p.rules.includes('G-REL-OBJ-GAP')), JSON.stringify(ps.map(p => p.rules))); });
  C('STRUCTURE-GUARD', 'scrambled auxiliaries do not derive: "the man who tall is is happy"', () => { expect(D('the man who tall is is happy').length === 0, 'derived'); });
  C('STRUCTURE-GUARD', 'a PP inside the subject stays inside it: "Is the book on the table red?"', () => { const r = ask('The book on the table is red. Is the book on the table red?'); expect(yes(r), r.reply); });
  C('STRUCTURE-GUARD', 'negation inside a relative clause stays there: "Is the man who is not tall happy?"', () => { const r = ask('The man who is not tall is happy. Is the man who is not tall happy?'); expect(yes(r), r.reply); });
  C('STRUCTURE-GUARD', 'a manifest can never touch a closed functional category or a functional head (legality)', () => {
    for (const cat of MK.IMMUTABLE_CATS) expect(MK.legality([{ fam: 'parser', row: cat, key: 'zzq', value: true }]).length > 0, 'closed ' + cat + ' accepted');
    for (const w of ['is', 'who', 'not', 'the', 'can', 'that']) expect(MK.legality([{ fam: 'parser', row: 'ADV', key: w, value: true }]).length > 0, 'functional head ' + w + ' accepted'); });
  C('STRUCTURE-GUARD', 'no category can be emptied and every closed category is non-empty', () => { const C0 = MK.CELLS.parser; for (const row of Object.keys(C0)) expect(MK.legality(C0[row].members.map(key => ({ fam: 'parser', row, key, value: false }))).includes('MEAK-EMPTY-CATEGORY:' + row), 'emptied ' + row);
    for (const cat of MK.IMMUTABLE_CATS) expect(G.CLOSED[cat] && G.CLOSED[cat].trim().length, 'empty ' + cat); });
  C('STRUCTURE-GUARD', 'every proposed candidate (seeds 1–5) leaves the closed categories byte-identical when applied', () => { const snap = () => JSON.stringify(MK.IMMUTABLE_CATS.map(c => G.CLOSED[c])) + JSON.stringify(Object.keys(G.CL).filter(w => G.CL[w].some(t => MK.IMMUTABLE_CATS.includes(t))).map(w => [w, G.CL[w]]));
    const s0 = snap(); try { for (let seed = 1; seed <= 5; seed++) for (const c of MK.propose({ seed })) { if (MK.legality(c.deltas).length) continue; MK.apply(c.deltas); expect(snap() === s0, 'closed category changed by ' + c.id); } } finally { MK.apply(null); } });
};
