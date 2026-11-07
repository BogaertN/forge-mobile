/* RELATION-PROPERTY GUARD (4.9.65, M5 fix): one case per MEA-mutable cell (relation × transitive / symmetric), written from what the words MEAN,
 * not from the shipped table and not from the held-out file. A transitive relation must chain ("A inside B, B inside C ⇒ A inside C"); a relation
 * that is not transitive must NOT chain (being next to two things says nothing about those two; a parent's parent is a grandparent; half-siblings
 * break sibling transitivity). A symmetric relation must reverse; any other must NOT. A manifest proposal that flips a cell now breaks a case here,
 * so it is rejected by evidence instead of looking safe because no test covered it. tools/mea_eval.js judges proposals on this suite too. */
module.exports = ({ C, expect, ROOT }) => {
  const MEA = require(ROOT + '/src/mea.js');
  /* the meaning table (hand-written): [transitive?, symmetric?, statement surface, question surface] */
  const cop = w => [(a, b) => a + ' is ' + w + ' ' + b, (a, b) => 'is ' + a + ' ' + w + ' ' + b + '?'];
  const T = { inside: [1, 0, ...cop('inside')], contain: [1, 0, (a, b) => a + ' contains ' + b, (a, b) => 'does ' + a + ' contain ' + b + '?'], in: [1, 0, ...cop('in')], within: [1, 0, ...cop('within')],
    part_of: [1, 0, ...cop('part of')], ancestor_of: [1, 0, ...cop('an ancestor of')], descendant_of: [1, 0, ...cop('a descendant of')], parent_of: [0, 0, ...cop('a parent of')], child_of: [0, 0, ...cop('a child of')],
    married_to: [0, 1, ...cop('married to')], next_to: [0, 1, ...cop('next to')], adjacent_to: [0, 1, ...cop('adjacent to')], sibling_of: [0, 1, ...cop('a sibling of')],
    before: [1, 0, ...cop('before')], after: [1, 0, ...cop('after')], above: [1, 0, ...cop('above')], below: [1, 0, ...cop('below')] };
  /* Every cell is the production Ask, with the shipped pools. A chain or a reversal has to be admitted.
   * A negative cell counts only when the stated direction itself is admitted, so a hold is not evidence
   * that a relation the engine never read is non-transitive. Kernel.process is not called. */
  const HOW = { inside: 'WM-CONTAIN-CHAIN', within: 'WM-CONTAIN-CHAIN', contain: 'WM-CONTAIN-CHAIN', part_of: 'WM-PART-CHAIN', ancestor_of: 'WM-ANCESTOR-CHAIN', descendant_of: 'WM-DESCENDANT-CHAIN' };
  const Ask = require(ROOT + '/verify/ask_path.js');
  const liveAsk = (mem, q) => { const s = Ask.session(); for (const m of mem) { const kept = Ask.remember(s, m); expect(kept.ok, m + ' ' + (kept.why || '')); } const n = s.phone.length; const row = Ask.ask(s, q); expect(s.phone.length === n, 'ask wrote'); return row; };
  const admitted = row => row && row.product_reply === true && row.echo && row.echo.pass === true && row.calls_llm !== true && !(row.memory_write && row.memory_write.committed);
  const shown = row => (row && (row.reply || row.route)) || 'held';
  C('RELPROP-GUARD', 'the meaning table covers every MEA-mutable cell (no cell is adoptable by absence of a test)', () => { const miss = MEA.cells().filter(([p]) => !T[p]); expect(!miss.length, 'uncovered: ' + JSON.stringify(miss)); });
  for (const p of Object.keys(T)) { const [tr, sy, say, ask] = T[p];
    C('RELPROP-GUARD', p.replace(/_/g, ' ') + (tr ? ' chains (transitive)' : ' does not chain (not transitive)'), () => {
      const row = liveAsk(['remember that ' + say('Tolva', 'Mirek'), 'remember that ' + say('Mirek', 'Sanju')], ask('Tolva', 'Sanju'));
      if (tr) {
        const how = row.world_model && row.world_model.derive && row.world_model.derive.survivor && row.world_model.derive.survivor.how;
        expect(admitted(row) && how === HOW[p], shown(row) + (how ? ' ' + how : ''));
        return;
      }
      const fwd = liveAsk(['remember that ' + say('Tolva', 'Mirek')], ask('Tolva', 'Mirek'));
      expect(admitted(fwd) && row.product_reply !== true, 'stated ' + shown(fwd) + ' / chain ' + shown(row));
    });
    C('RELPROP-GUARD', p.replace(/_/g, ' ') + (sy ? ' reverses (symmetric)' : ' does not reverse (not symmetric)'), () => {
      const fwd = liveAsk(['remember that ' + say('Orla', 'Pemba')], ask('Orla', 'Pemba'));
      const row = liveAsk(['remember that ' + say('Orla', 'Pemba')], ask('Pemba', 'Orla'));
      if (sy) { expect(admitted(row), shown(row)); return; }
      expect(admitted(fwd) && row.product_reply !== true, 'stated ' + shown(fwd) + ' / reverse ' + shown(row));
    }); }
};
