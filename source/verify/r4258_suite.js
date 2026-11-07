/* R4258 (4.9.249): before/after and above/below are two orders.
 *
 * Old assertion                                      Live assertion
 * meeting before lunch, dinner after lunch,          WM-BEFORE-CHAIN cites both stored sentences
 *   is the meeting before dinner? Yes, INF-REL-TRANSITIVE-BEFORE
 * meeting before lunch before dinner,                the opposite direction stays a hold
 *   is dinner before the meeting? not Yes
 * RELPROP before/after/above/below chains            the same predicate, WM-*-CHAIN
 * RELPROP does not reverse                           the inverse is the partner preposition, not a swapped same one
 *
 * A different scene does not chain. A verb's before-adjunct is not the copular order.
 * before does not answer above. Ask does not store the derivation.
 */
const A = require('./ask_path.js');
function admitted(row) {
  return row && row.product_reply === true && row.echo && row.echo.pass === true && row.echo.method === 'structural_frame' && row.calls_llm !== true && !(row.memory_write && row.memory_write.committed) && typeof row.drift === 'number' && row.drift <= 0.35 && row.outward_compile && row.outward_compile.applied === true;
}
function ask(mem, q) {
  const s = A.session();
  for (const m of mem) { const k = A.remember(s, m); if (!k.ok) throw new Error(m); }
  const n = s.phone.length;
  const row = A.ask(s, q);
  if (s.phone.length !== n) throw new Error('ask wrote');
  return row;
}
function register(C, expect) {
  C('ORDER', 'a time order keeps one scene and refuses two scenes', () => {
    const same = ask(['remember that the meeting is before lunch in the hall', 'remember that lunch is before dinner in the hall'], 'is the meeting before dinner in the hall?');
    expect(admitted(same) && same.reply === 'The meeting is before lunch in the hall. Lunch is before dinner in the hall. The meeting is before dinner in the hall.' && same.world_model.derive.survivor.how === 'WM-BEFORE-CHAIN', same.reply || same.route);
    const mixed = ask(['remember that the meeting is before lunch in the hall', 'remember that lunch is before dinner on the roof'], 'is the meeting before dinner?');
    expect(mixed.product_reply !== true, mixed.reply || mixed.route);
  });
  C('ORDER', 'above does not reverse as above, and before is not above', () => {
    const below = ask(['remember that the lantern is above the crate'], 'is the crate below the lantern?');
    expect(admitted(below) && below.world_model.derive.survivor.how === 'WM-ABOVE-INVERSE' && /The crate is below the lantern\./.test(below.reply), below.reply);
    const up = ask(['remember that the lantern is above the crate'], 'is the crate above the lantern?');
    expect(up.product_reply !== true, up.reply || up.route);
    const cross = ask(['remember that the rehearsal is before the toast'], 'is the rehearsal above the toast?');
    expect(cross.product_reply !== true, cross.reply || cross.route);
  });
  C('ORDER', 'a verb adjunct before lunch is not the copular order, and a negative of the chain conflicts', () => {
    const arrived = ask(['remember that she arrived before lunch', 'remember that lunch is before dinner'], 'did she arrive before dinner?');
    expect(arrived.product_reply !== true, arrived.reply || arrived.route);
    const neg = ask(['remember that the meeting is before lunch', 'remember that lunch is before dinner', 'remember that the meeting is not before dinner'], 'is the meeting before dinner?');
    const d = neg.world_model && neg.world_model.derive;
    expect(neg.product_reply !== true && d && d.status === 'conflicted', (neg.reply || neg.route || '') + ' ' + (d && d.status));
  });
  C('ORDER', 'an order does not yield itself, and next-to still does not chain', () => {
    const self = ask(['remember that the meeting is before lunch', 'remember that lunch is before the meeting'], 'is the meeting before the meeting?');
    expect(self.product_reply !== true, self.reply || self.route);
    const next = ask(['remember that the lantern is next to the crate', 'remember that the crate is next to the mat'], 'is the lantern next to the mat?');
    expect(next.product_reply !== true, next.reply || next.route);
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 400); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
