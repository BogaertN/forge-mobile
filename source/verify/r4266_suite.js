/* R4266 (4.9.249): an explicit forget removes the sentence the grammar named.
 * A capability question, a bare name, a missing sentence, and a forged hold do not.
 * The phone list and world_facts lose that sentence together. A shared fixture stays.
 */
const K = require('../src/kernel.js');
const FK = require('../src/forge.js');
const LEX = require('../data/lexicon.json');
const EXT = require('../data/lexicon-ext.json');
const WF = require('../src/world_facts.js');
const A = require('./ask_path.js');
function fresh() { return FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-07T00:00:00Z' }); }
function register(C, expect) {
  C('FORGET', 'one sentence goes, and a vaguer or negative command does not widen it', () => {
    const s = A.session();
    expect(A.remember(s, 'remember that my car is red').ok && A.remember(s, 'remember that my car is not blue').ok && A.remember(s, 'remember that my bike is red').ok);
    const n = s.phone.length;
    expect(A.forget(s, 'can you forget that my car is red').rule === 'FORGET-NOT-A-COMMAND' && s.phone.length === n, 'a capability question forgot');
    expect(A.forget(s, 'forget my car').rule === 'FORGET-NOT-A-CLAUSE' && s.phone.length === n, 'a bare name forgot');
    expect(A.forget(s, 'forget that my car is not red').rule === 'WORLD-FACTS-FORGET-MISSING' && s.phone.length === n, 'the negative removed the positive');
    const gone = A.forget(s, 'please forget that my car is red');
    expect(gone.ok === true && s.phone.length === 2 && s.phone.some(r => /not blue/.test(r.text)) && s.phone.some(r => /bike/.test(r.text)) && !s.phone.some(r => /is red/.test(r.text) && /car/.test(r.text)), gone.reply);
    const asked = A.ask(s, 'is my car red?');
    const kept = A.ask(s, 'is my bike red?');
    expect(asked.product_reply !== true && kept.product_reply === true && /red/.test(kept.reply || ''), (asked.reply || '') + ' | ' + (kept.reply || ''));
  });
  C('FORGET', 'a held forget needs a tap, and a forged or repeated tap removes nothing else', () => {
    const k = fresh(); const s = A.session();
    expect(A.remember(s, 'remember that my coat is green', k).ok && A.remember(s, 'remember that my bag is green', k).ok);
    k.perm.setPolicy('memoryApproval', 'every_write', true);
    const denied = k.perm.authorize('memory.forget', { explicit: false, subject: 'my coat is green' });
    expect(denied.decision === 'deny' && denied.rule === 'PERM-NO-EXPLICIT-REQUEST' && s.phone.length === 2, denied.rule);
    const held = A.forget(s, 'forget that my coat is green', k);
    expect(held.held === true && s.phone.length === 2 && k.memory().length === 2, held.rule);
    expect(A.commit(s, k, held.held_id, false).rule === 'PERM-NEEDS-USER-TAP' && s.phone.length === 2, 'a missing tap forgot');
    const hw = k.store.load('held_writes');
    const h = hw.find(x => x.id === held.held_id);
    h.texts = ['My bag is green.']; h.text = 'My bag is green.';
    k.store.save('held_writes', hw);
    expect(A.commit(s, k, held.held_id, true).rule === 'FORGET-FORGED-TARGET' && s.phone.length === 2, 'a forged target forgot');
    h.texts = h.canon.slice(); h.text = h.canon[0];
    k.store.save('held_writes', hw);
    expect(A.commit(s, k, held.held_id, true).ok === true && s.phone.length === 1 && /bag/.test(s.phone[0].text), s.phone.map(r => r.text).join('|'));
    expect(A.commit(s, k, held.held_id, true).rule === 'HELD-UNKNOWN' && s.phone.length === 1, 'a second tap forgot again');
  });
  C('FORGET', 'the phone store and a fresh read lose the sentence, and a shared fixture stays', () => {
    WF.clear();
    const sharedN = A.productionPools().shared.length;
    const anchorN = A.productionPools().anchors.length;
    const s = A.session();
    expect(A.remember(s, 'remember that Aster is inside Beryl').ok && A.remember(s, 'remember that Beryl is inside Cobalt').ok && A.remember(s, 'remember that Nia is inside Ola').ok);
    for (const row of s.phone) expect(WF.upsert({ text: row.text, clause: row.clause, kind: 'remember' }).ok);
    const chain = A.ask(s, 'is Aster inside Cobalt?');
    expect(chain.product_reply === true, chain.reply || chain.route);
    const gone = A.forget(s, 'forget that Beryl is inside Cobalt');
    expect(gone.ok === true && !WF.rows().some(r => /Beryl is inside Cobalt/.test(r.text)) && WF.rows().some(r => /Nia is inside Ola/.test(r.text)), WF.rows().map(r => r.text).join('|'));
    const why = A.ask(s, 'why?');
    const other = A.ask(s, 'is Nia inside Ola?');
    expect(why.product_reply !== true && other.product_reply === true && /Nia is inside Ola/.test(other.reply || ''), (why.reply || why.route) + ' | ' + (other.reply || ''));
    const again = A.askStored('is Aster inside Cobalt?');
    expect(again.product_reply !== true, again.reply || again.route);
    const quiet = fresh();
    const secret = A.forget(s, 'forget that my pin is 4821', quiet);
    const logged = JSON.stringify(quiet.perm.log());
    expect(secret.rule === 'PRIV-SECRET-NOT-KEPT' && !logged.includes('4821') && !JSON.stringify(WF.receipts()).includes('4821'), secret.rule);
    const sharedText = A.productionPools().shared[0] && A.productionPools().shared[0].text;
    A.forget(s, 'forget that ' + sharedText);
    expect(A.productionPools().shared.length === sharedN && A.productionPools().anchors.length === anchorN, 'phone forget changed a shipped pool');
    WF.clear();
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 700); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
