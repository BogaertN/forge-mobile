/* R4250 (4.9.249): spatial containment on the live Ask path.
 *
 * Old guarantee (world_state_suite.js, Kernel.process / RELPROP)     Production assertion (verify/ask_path.js)
 * WS-TRANSITIVE inside: Aster⊂Beryl⊂Cobalt answers yes               ask admits the chain, how WM-CONTAIN-CHAIN, Echo pass, outward compiled, not committed
 * WS-INVERSE: Kip contains Lop ⇒ Lop is inside Kip                   the stored contain sentence answers the inside question
 * WS-INVERSE the other way: inside facts answer "does C contain A?"  the chain answers the contain question
 * WS-SYMMETRIC negative: inside does not run backwards               "is Beryl inside Aster?" holds
 * a cycle does not conclude x inside x                               "is Aster inside Aster?" holds
 * a stated negative is spoken, and it blocks the positive chain      lone negative admits "is not inside"; chain plus that negative holds
 * married-to is not this relation                                     "is Ann married to Cy?" holds
 * "on" is not this relation                                           "is the book on the floor?" holds
 * three hops keep the three original premises                         provenance texts are the three remembered sentences, checker_ok
 *
 * The old tests also bundled part-of, ancestor, and TMS receipts. Those are not this relation and stay on the old
 * interface until their own batch. Kernel.process is not called.
 */
const A = require('./ask_path.js');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
function turn(mem, q) {
  const s = A.session();
  for (const m of mem) {
    const kept = A.remember(s, m);
    expect(kept.ok, kept.rule || m);
  }
  const before = s.phone.length;
  const row = A.ask(s, q);
  expect(s.phone.length === before, 'ask stored a row');
  expect(row.calls_llm !== true, 'model');
  expect(!(row.memory_write && row.memory_write.committed), 'committed');
  return row;
}
const chain = ['remember that Aster is inside Beryl', 'remember that Beryl is inside Cobalt'];
T('WS-TRANSITIVE inside: two hops admit the compiled chain and do not commit', () => {
  const row = turn(chain, 'is Aster inside Cobalt?');
  const surv = row.world_model && row.world_model.derive && row.world_model.derive.survivor;
  expect(row.product_reply === true && row.reply === 'Aster is inside Beryl. Beryl is inside Cobalt. Aster is inside Cobalt.', row.reply);
  expect(row.echo && row.echo.pass === true && row.echo.method === 'structural_frame', JSON.stringify(row.echo && row.echo.method));
  expect(row.outward_compile && row.outward_compile.applied === true, JSON.stringify(row.outward_compile && row.outward_compile.rule));
  expect(surv && surv.how === 'WM-CONTAIN-CHAIN' && surv.checker_ok === true, JSON.stringify(surv && { how: surv.how, checker: surv.checker_ok }));
});
T('WS-INVERSE: a contain sentence answers the inside question', () => {
  const row = turn(['remember that Kip contains Lop'], 'is Lop inside Kip?');
  expect(row.product_reply === true && row.reply === 'Kip contains Lop.' && row.echo.pass === true && row.outward_compile.applied === true, row.reply);
});
T('WS-INVERSE: inside facts answer a contain question', () => {
  const row = turn(chain, 'does Cobalt contain Aster?');
  expect(row.product_reply === true && /Aster is inside Cobalt\.$/.test(row.reply) && row.echo.pass === true, row.reply);
  expect(row.world_model.derive.survivor.how === 'WM-CONTAIN-CHAIN', row.world_model.derive.survivor.how);
});
T('WS-SYMMETRIC negative: inside does not run backwards', () => {
  const row = turn(['remember that Aster is inside Beryl'], 'is Beryl inside Aster?');
  expect(row.product_reply !== true, row.reply);
});
T('a cycle does not conclude that something is inside itself', () => {
  const row = turn(['remember that Aster is inside Beryl', 'remember that Beryl is inside Aster'], 'is Aster inside Aster?');
  expect(row.product_reply !== true, row.reply);
});
T('a stated negative is spoken, and together with the chain it holds', () => {
  const lone = turn(['remember that Aster is not inside Cobalt'], 'is Aster inside Cobalt?');
  expect(lone.product_reply === true && lone.reply === 'Aster is not inside Cobalt.' && lone.echo.pass === true, lone.reply);
  const both = turn(chain.concat(['remember that Aster is not inside Cobalt']), 'is Aster inside Cobalt?');
  expect(both.product_reply !== true, both.reply);
});
T('married-to is not containment and does not chain', () => {
  const row = turn(['remember that Ann is married to Bob', 'remember that Bob is married to Cy'], 'is Ann married to Cy?');
  expect(row.product_reply !== true, row.reply);
});
T('on is not containment and does not chain', () => {
  const row = turn(['remember that the book is on the table', 'remember that the table is on the floor'], 'is the book on the floor?');
  expect(row.product_reply !== true, row.reply);
});
T('three hops cite the three remembered sentences', () => {
  const row = turn(chain.concat(['remember that Cobalt is inside Delta']), 'is Aster inside Delta?');
  const surv = row.world_model.derive.survivor;
  const texts = (surv.premises || []).map(p => p.text);
  expect(row.product_reply === true && /Aster is inside Delta\.$/.test(row.reply) && row.echo.pass === true && row.outward_compile.applied === true, row.reply);
  expect(surv.how === 'WM-CONTAIN-CHAIN' && surv.checker_ok === true && texts.join(' | ') === 'Aster is inside Beryl. | Beryl is inside Cobalt. | Cobalt is inside Delta.', JSON.stringify(texts));
  expect(row.drift <= 0.35, String(row.drift));
});
const results = [];
for (const t of tests) {
  let ok = false, why = '';
  try { t.fn(); ok = true; } catch (e) { why = String(e && e.message || e).slice(0, 800); }
  results.push({ cls: 'R4250', name: t.name, ok, why });
}
if (require.main === module) {
  console.log(JSON.stringify(results, null, 1));
  process.exit(results.every(r => r.ok) ? 0 : 1);
}
module.exports = results;
