/* R4255 (4.9.249): part-of is its own relation.
 *
 * Old assertion                                              Live assertion
 * wheel ⊂ engine ⊂ car, Yes I infer, INF-REL-TRANSITIVE-PARTOF
 *   and LL-COPULA-OF-APAVADA                                 WM-PART-CHAIN; "part of" is not a bare of-predicate
 * Gem ⊂ Hub ⊂ Ivo                                            the same chain for the world-state names
 * (bundled with inside and ancestor; those stay separate)   part-of does not use containment
 *
 * The construction is a copular nominal whose head is "part" and whose of-phrase is the whole.
 * It is not inside/within, not geographic "in", and not every of-phrase. It does not run backwards.
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
  C('PART-OF', 'a wheel that is part of an engine that is part of a car is part of the car', () => {
    const row = ask(['remember that the wheel is part of the engine', 'remember that the engine is part of the car'], 'is the wheel part of the car?');
    expect(admitted(row) && row.reply === 'The wheel is part of the engine. The engine is part of the car. The wheel is part of the car.', row.reply);
    const how = row.world_model.derive.survivor.how;
    expect(how === 'WM-PART-CHAIN', how);
  });
  C('PART-OF', 'Gem part of Hub part of Ivo', () => {
    const row = ask(['remember that Gem is part of Hub', 'remember that Hub is part of Ivo'], 'is Gem part of Ivo?');
    expect(admitted(row) && row.reply === 'Gem is part of Hub. Hub is part of Ivo. Gem is part of Ivo.', row.reply);
  });
  C('PART-OF', 'three hops stay inside the round limit and cite every premise', () => {
    const row = ask(['remember that the nut is part of the wheel', 'remember that the wheel is part of the engine', 'remember that the engine is part of the car'], 'is the nut part of the car?');
    expect(admitted(row) && /The nut is part of the car\.$/.test(row.reply) && row.reply.indexOf('The nut is part of the wheel.') === 0, row.reply);
  });
  C('PART-OF', 'part-of does not run backwards and a cycle is not identity', () => {
    const back = ask(['remember that the wheel is part of the engine'], 'is the engine part of the wheel?');
    expect(back.product_reply !== true, back.reply);
    const cycle = ask(['remember that Gem is part of Hub', 'remember that Hub is part of Gem'], 'is Gem part of Gem?');
    expect(cycle.product_reply !== true, cycle.reply);
  });
  C('PART-OF', 'a stored negative of the derived part conflicts and nothing is spoken', () => {
    const row = ask(['remember that the wheel is part of the engine', 'remember that the engine is part of the car', 'remember that the wheel is not part of the car'], 'is the wheel part of the car?');
    const d = row.world_model && row.world_model.derive;
    expect(row.product_reply !== true && d && d.status === 'conflicted', (row.reply || '') + ' ' + (d && d.status));
  });
  C('PART-OF', 'inside and a bare of-phrase are not part-of', () => {
    const box = ask(['remember that the wheel is inside the car', 'remember that the car is part of the fleet'], 'is the wheel part of the fleet?');
    expect(box.product_reply !== true, box.reply);
    const geo = ask(['remember that Paris is in France'], 'is Paris part of France?');
    expect(geo.product_reply !== true, geo.reply);
  });
}
if (require.main === module) {
  const tests = [];
  const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
  const C = (cls, name, fn) => tests.push({ cls, name, fn });
  register(C, expect);
  const results = [];
  for (const t of tests) {
    let ok = false, why = '';
    try { t.fn(); ok = true; } catch (e) { why = String(e && e.message || e).slice(0, 800); }
    results.push({ cls: t.cls, name: t.name, ok, why });
  }
  console.log(JSON.stringify(results, null, 1));
  process.exit(results.every(r => r.ok) ? 0 : 1);
}
module.exports = register;
