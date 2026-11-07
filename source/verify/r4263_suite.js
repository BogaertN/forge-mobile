/* R4263 (4.9.249): grammar roles on the one Ask path.
 * A passive keeps the by-phrase as the agent. A relative stays on its antecedent.
 * A why-question speaks the stored hetu and does not invent one. A tag confirms only
 * when its polarity confirms the clause. An ambiguous clause is not stored until a reading is chosen.
 * Forget is the same permission gate as Remember.
 */
const K = require('../src/kernel.js');
const FK = require('../src/forge.js');
const LEX = require('../data/lexicon.json');
const EXT = require('../data/lexicon-ext.json');
const A = require('./ask_path.js');
function fresh() { return FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-07T00:00:00Z' }); }
function register(C, expect) {
  C('GRAMMAR-V3', 'a passive question and its active question name the same agent', () => {
    const s = A.session();
    A.remember(s, 'remember that the cake was eaten by my brother');
    const passive = A.ask(s, 'was the cake eaten by my brother?');
    const active = A.ask(s, 'did my brother eat the cake?');
    const swapped = A.ask(s, 'was the cake eaten by my sister?');
    expect(/eaten by your brother/.test(passive.reply || '') && /eaten by your brother/.test(active.reply || ''), passive.reply + ' / ' + active.reply);
    expect(swapped.reply == null, swapped.reply);
  });
  C('GRAMMAR-V3', 'a negated passive keeps the agent and does not affirm the positive', () => {
    const s = A.session();
    A.remember(s, 'remember that the cake was not eaten by my brother');
    const neg = A.ask(s, 'was the cake not eaten by my brother?');
    const pos = A.ask(s, 'was the cake eaten by my brother?');
    expect(/not eaten by your brother/.test(neg.reply || ''), neg.reply);
    expect(pos.reply == null || /not eaten/.test(pos.reply || ''), pos.reply);
  });
  C('GRAMMAR-V3', 'a different relative does not answer for the book', () => {
    const s = A.session();
    A.remember(s, 'remember that the book that I read was long');
    const same = A.ask(s, 'was the book that I read long?');
    const other = A.ask(s, 'was the book that she read long?');
    expect(/book that you/.test(same.reply || '') && /long/.test(same.reply || ''), same.reply);
    expect(other.reply == null, other.reply);
  });
  C('GRAMMAR-V3', 'how old with no stated age invents no number', () => {
    const s = A.session();
    const n = s.phone.length;
    const row = A.ask(s, 'how old is my uncle?');
    expect(row.reply == null && !/\d/.test(JSON.stringify(row.claim || '')) && s.phone.length === n, row.reply);
  });
  C('GRAMMAR-V3', 'a tag that does not confirm the clause is not stored', () => {
    const s = A.session();
    const bad = A.remember(s, "remember that my dog is not happy, isn't it?");
    expect(bad.ok === false && bad.rule === 'GRAMMAR-TAG-POLARITY' && s.phone.length === 0, bad.rule);
  });
  C('GRAMMAR-V3', 'an ambiguous clause is stored only for the chosen reading', () => {
    const s = A.session();
    const a = A.remember(s, 'remember that I saw her duck');
    expect(a.rule === 'GRAMMAR-AMBIGUOUS' && s.phone.length === 0 && (a.readings || []).length >= 2, a.reply);
    const picked = A.chooseReading(s, '1');
    expect(picked.ok === true && s.phone.length === 1 && s.phone[0].clause.kriya === a.readings[0].kriya, picked.reply);
  });
  C('GRAMMAR-V3', 'ask and why do not write, and forget waits for a tap', () => {
    const k = fresh(); const s = A.session();
    A.remember(s, 'remember that my lamp is blue', k);
    const before = s.phone.length;
    A.ask(s, 'is my lamp blue?');
    A.ask(s, 'why is my lamp blue?');
    expect(s.phone.length === before && k.memory().length === 1, 'ask wrote');
    k.perm.setPolicy('memoryApproval', 'every_write', true);
    const held = A.forget(s, 'forget that my lamp is blue', k);
    expect(held.held === true && held.rule === 'PERM-D10-EVERY-WRITE' && s.phone.length === before && k.memory().length === 1, JSON.stringify(held));
    const noTap = A.commit(s, k, held.held_id, false);
    expect(!noTap.ok && noTap.rule === 'PERM-NEEDS-USER-TAP' && s.phone.length === before, JSON.stringify(noTap));
    const tapped = A.commit(s, k, held.held_id, true);
    expect(tapped.ok === true && s.phone.length === before - 1 && k.memory().length === 0, JSON.stringify(tapped));
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 500); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
