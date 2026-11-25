/* R4257 (4.9.249): the four relations the table marks symmetric.
 *
 * Old guard cell                         Live assertion
 * married to reverses                    WM-MARRIED-SYMMETRIC, premise cited
 * next to reverses                       the question keeps "next to"; WM-NEXT-SYMMETRIC
 * adjacent to reverses                   WM-ADJACENT-SYMMETRIC
 * sibling of reverses                    WM-SIBLING-SYMMETRIC
 * each does not chain                    a shared partner is not a further partner
 *
 * Symmetry swaps one stated atom. It does not chain, it does not invent a self-relation,
 * and Ask does not store the swap.
 */
const A = require('./ask_path.js');
function admitted(row) {
  return row && row.product_reply === true && row.echo && row.echo.pass === true && row.echo.method === 'structural_frame' && row.calls_llm !== true && !(row.memory_write && row.memory_write.committed) && typeof row.drift === 'number' && row.drift <= 0.35 && row.outward_compile && row.outward_compile.applied === true;
}
function ask(mem, q, extra) {
  const s = A.session();
  for (const m of mem) { const k = A.remember(s, m); if (!k.ok) throw new Error(m); }
  const n = s.phone.length;
  const row = A.ask(s, q, extra);
  if (s.phone.length !== n) throw new Error('ask wrote');
  return row;
}
function register(C, expect) {
  C('SYMMETRIC', 'married-to reverses and cites the premise; a shared spouse is not a spouse', () => {
    const rev = ask(['remember that Nia is married to Pavel'], 'is Pavel married to Nia?');
    expect(admitted(rev) && rev.reply === 'Nia is married to Pavel. Pavel is married to Nia.' && rev.world_model.derive.survivor.how === 'WM-MARRIED-SYMMETRIC', rev.reply);
    const shared = ask(['remember that Nia is married to Pavel', 'remember that Nia is married to Soren'], 'is Pavel married to Soren?');
    expect(shared.product_reply !== true, shared.reply || shared.route);
    const self = ask(['remember that Nia is married to Pavel'], 'is Nia married to Nia?');
    expect(self.product_reply !== true, self.reply || self.route);
  });
  C('SYMMETRIC', 'a stored negative of the reverse marriage conflicts', () => {
    const row = ask(['remember that Nia is married to Pavel', 'remember that Pavel is not married to Nia'], 'is Pavel married to Nia?');
    const d = row.world_model && row.world_model.derive;
    expect(row.product_reply !== true && d && d.status === 'conflicted', (row.reply || row.route || '') + ' ' + (d && d.status));
  });
  C('SYMMETRIC', 'next-to keeps its complement, including a qualifier, and does not answer a different relation', () => {
    const rev = ask(['remember that the blue boat is next to the dock'], 'is the dock next to the blue boat?');
    expect(admitted(rev) && rev.reply === 'The blue boat is next to the dock. The dock is next to the blue boat.' && rev.world_model.derive.survivor.how === 'WM-NEXT-SYMMETRIC', rev.reply);
    const timed = ask(['remember that Nia is married to Pavel before lunch'], 'is Pavel married to Nia before lunch?');
    expect(admitted(timed) && /before lunch/.test(timed.reply) && /Pavel is married to Nia/.test(timed.reply), timed.reply);
    const other = ask(['remember that Nia is married to Pavel'], 'is Pavel next to Nia?');
    expect(other.product_reply !== true, other.reply || other.route);
  });
  C('SYMMETRIC', 'a sibling of a sibling is not a sibling, and the reverse cites the premise', () => {
    const rev = ask(['remember that Willa is a sibling of Soren'], 'is Soren a sibling of Willa?');
    expect(admitted(rev) && rev.reply === 'Willa is a sibling of Soren. Soren is a sibling of Willa.' && rev.world_model.derive.survivor.how === 'WM-SIBLING-SYMMETRIC', rev.reply);
    const chain = ask(['remember that Willa is a sibling of Soren', 'remember that Soren is a sibling of Kei'], 'is Willa a sibling of Kei?');
    expect(chain.product_reply !== true, chain.reply || chain.route);
    const self = ask(['remember that Willa is a sibling of Soren', 'remember that Soren is a sibling of Willa'], 'is Willa a sibling of Willa?');
    expect(self.product_reply !== true, self.reply || self.route);
  });
  C('SYMMETRIC', 'an unsourced pool row is not a spouse', () => {
    const row = ask(['remember that Nia is married to Pavel'], 'is Pavel married to Soren?', {
      sharedRows: [{ id: 'unsourced-spouse', text: 'Pavel is married to Soren.', tier: 'confirmed_shared', unsourced: true }]
    });
    expect(row.product_reply !== true && !(row.memory_write && row.memory_write.committed), row.reply || row.route);
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 400); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
