/* RELATION-PROPERTY GUARD (4.9.65, M5 fix): one case per MEA-mutable cell (relation × transitive / symmetric), written from what the words MEAN,
 * not from the shipped table and not from the held-out file. A transitive relation must chain ("A inside B, B inside C ⇒ A inside C"); a relation
 * that is not transitive must NOT chain (being next to two things says nothing about those two; a parent's parent is a grandparent; half-siblings
 * break sibling transitivity). A symmetric relation must reverse; any other must NOT. A manifest proposal that flips a cell now breaks a case here,
 * so it is rejected by evidence instead of looking safe because no test covered it. tools/mea_eval.js judges proposals on this suite too. */
module.exports = ({ C, expect, ROOT }) => {
  const KM = require(ROOT + '/src/kernel.js'), MEA = require(ROOT + '/src/mea.js'); const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
  const K = () => { const st = {}; return KM.Kernel({ clock: () => '2026-10-18T12:00:00Z', lexicon: LEX, lexiconExt: EXT, store: KM.MemoryStore({ get: k => (k in st ? st[k] : null), set: (k, v) => { st[k] = String(v); }, del: k => { delete st[k]; }, keys: () => Object.keys(st) }) }); };
  /* the meaning table (hand-written): [transitive?, symmetric?, statement surface, question surface] */
  const cop = w => [(a, b) => a + ' is ' + w + ' ' + b, (a, b) => 'is ' + a + ' ' + w + ' ' + b + '?'];
  const T = { inside: [1, 0, ...cop('inside')], contain: [1, 0, (a, b) => a + ' contains ' + b, (a, b) => 'does ' + a + ' contain ' + b + '?'], in: [1, 0, ...cop('in')], within: [1, 0, ...cop('within')],
    part_of: [1, 0, ...cop('part of')], ancestor_of: [1, 0, ...cop('an ancestor of')], descendant_of: [1, 0, ...cop('a descendant of')], parent_of: [0, 0, ...cop('a parent of')], child_of: [0, 0, ...cop('a child of')],
    married_to: [0, 1, ...cop('married to')], next_to: [0, 1, ...cop('next to')], adjacent_to: [0, 1, ...cop('adjacent to')], sibling_of: [0, 1, ...cop('a sibling of')],
    before: [1, 0, ...cop('before')], after: [1, 0, ...cop('after')], above: [1, 0, ...cop('above')], below: [1, 0, ...cop('below')] };
  const yes = r => /^Yes\b/.test(r.reply);
  C('RELPROP-GUARD', 'the meaning table covers every MEA-mutable cell (no cell is adoptable by absence of a test)', () => { const miss = MEA.cells().filter(([p]) => !T[p]); expect(!miss.length, 'uncovered: ' + JSON.stringify(miss)); });
  for (const p of Object.keys(T)) { const [tr, sy, say, ask] = T[p];
    C('RELPROP-GUARD', p.replace(/_/g, ' ') + (tr ? ' chains (transitive)' : ' does not chain (not transitive)'), () => { const f = K(); f.process('remember that ' + say('Tolva', 'Mirek')); f.process('remember that ' + say('Mirek', 'Sanju'));
      const r = f.process(ask('Tolva', 'Sanju')); expect(tr ? yes(r) && r.trace.echo.pass : !yes(r), (tr ? 'no chain: ' : 'wrong chain: ') + r.reply); });
    C('RELPROP-GUARD', p.replace(/_/g, ' ') + (sy ? ' reverses (symmetric)' : ' does not reverse (not symmetric)'), () => { const f = K(); f.process('remember that ' + say('Orla', 'Pemba'));
      const r = f.process(ask('Pemba', 'Orla')); expect(sy ? yes(r) && r.trace.echo.pass : !yes(r), (sy ? 'no reversal: ' : 'wrong reversal: ') + r.reply); }); }
};
