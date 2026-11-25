/* R4262 (4.9.249): the permission gate on explicit Remember.
 * A forged approval is not trusted. A used approval is not reused. Ask does not write.
 * An unauthorized action and a cross-scope allow leave the fact store unchanged.
 */
const K = require('../src/kernel.js');
const FK = require('../src/forge.js');
const LEX = require('../data/lexicon.json');
const EXT = require('../data/lexicon-ext.json');
const A = require('./ask_path.js');
function fresh() { return FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-07T00:00:00Z' }); }
function register(C, expect) {
  C('PERMISSION', 'a forged approval and a reused approval do not write', () => {
    const k = fresh(); const s = A.session();
    k.perm.setPolicy('memoryApproval', 'every_write', true);
    const held = A.remember(s, 'remember that my lamp is blue', k);
    expect(held.held === true && s.phone.length === 0 && k.memory().length === 0, held.reply);
    const id = k.heldWrites()[0].id;
    k.heldWrites()[0].permission = { decision: 'allow', rule: 'FORGED' };
    const forged = k.commitHeld(id, false);
    expect(!forged.ok && forged.rule === 'PERM-NEEDS-USER-TAP' && k.memory().length === 0, JSON.stringify(forged));
    const ok = k.commitHeld(id, true);
    expect(ok.ok && k.memory().length === 1 && ok.readback.every(x => x.readback === 'match'), JSON.stringify(ok));
    const again = k.commitHeld(id, true);
    expect(!again.ok && again.rule === 'HELD-UNKNOWN' && k.memory().length === 1, JSON.stringify(again));
  });
  C('PERMISSION', 'an explicit refusal and a cross-scope allow leave the store unchanged', () => {
    const k = fresh(); const s = A.session();
    const denied = k.perm.authorize('memory.write', { explicit: false, userTap: true, subject: 'My lamp is blue.' });
    expect(denied.decision === 'deny' && denied.rule === 'PERM-NO-EXPLICIT-REQUEST' && k.memory().length === 0 && s.phone.length === 0, JSON.stringify(denied));
    const other = k.perm.authorize('export.json', { userTap: true, subject: 'export' });
    expect(other.decision === 'allow' && other.action === 'export.json' && k.memory().length === 0, JSON.stringify(other));
    const n = s.phone.length;
    const row = A.ask(s, 'is my lamp blue?');
    expect(s.phone.length === n && k.memory().length === 0 && !(row.memory_write && row.memory_write.committed), row.reply || row.route);
  });
  C('PERMISSION', 'a rational pole is not a finite value, and a positive-domain integral is not a full-real primitive', () => {
    const low = A.ask(A.session(), 'simplify (x+1)/(x-1)');
    const res = low.computed && low.computed.receipt && low.computed.receipt.result;
    expect(low.product_reply === true && res && res.excluded.length === 0 && res.domain[0].value === '1' && res.domain[0].reason === 'denominator' && res.finite_at_domain === false && low.reply.includes('x ≠ 1'), low.reply);
    const hole = A.ask(A.session(), 'integrate 1/x');
    expect(hole.product_reply === true && hole.computed.receipt.result.primitive === 'positive-domain' && hole.computed.receipt.result.domain.join() === 'x > 0' && !/all real|x < 0|x ≠ 0/.test(hole.reply), hole.reply);
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 500); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
