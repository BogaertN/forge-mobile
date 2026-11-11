/* R4264 (4.9.249): phone-fact recall, counts, and provenance time.
 * A question does not write. Counts are the distinct admitted phone facts in the asked scope.
 * A when-question speaks the timestamp stored with the fact, and holds when that timestamp is absent.
 */
const A = require('./ask_path.js');
function register(C, expect) {
  C('LC-NO-ROUTES', 'tell, everything, show, and how many keep the asked scope', () => {
    const s = A.session();
    A.remember(s, 'remember that my sister lives in Paris');
    A.remember(s, 'remember that my sister lives in Paris');
    A.remember(s, 'remember that my brother lives in Rome');
    const n = s.phone.length;
    const told = A.ask(s, 'tell me about my sister');
    const all = A.ask(s, 'tell me everything about my sister');
    const shown = A.ask(s, 'show me my facts');
    const one = A.ask(s, 'how many facts do you know about my sister');
    const many = A.ask(s, 'how many facts');
    expect(/Paris/.test(told.reply || '') && !/Rome/.test(told.reply || ''), told.reply);
    expect(/Paris/.test(all.reply || '') && !/Rome/.test(all.reply || '') && !/4821/.test(all.reply || ''), all.reply);
    expect(/Paris/.test(shown.reply || '') && /Rome/.test(shown.reply || '') && !/Aachen/.test(shown.reply || ''), shown.reply);
    expect(/1 fact about your sister/.test(one.reply || '') && /Paris/.test(one.reply || '') && !/Rome/.test(one.reply || ''), one.reply);
    expect(/2 facts/.test(many.reply || '') && /Paris/.test(many.reply || '') && /Rome/.test(many.reply || ''), many.reply);
    expect(s.phone.length === n, 'a question wrote');
  });
  C('LC-NO-ROUTES', 'a secret, a quarantined row, and a held proposal are not counted', () => {
    const s = A.session();
    A.remember(s, 'remember that my sister lives in Paris');
    const pin = A.remember(s, 'remember that my pin is 4821');
    expect(pin.ok !== true && pin.rule === 'PRIV-SECRET-NOT-KEPT' && s.phone.length === 1, pin.rule);
    A.remember(s, 'remember that my cousin lives in Lyon');
    s.phone[s.phone.length - 1].quarantined = true;
    A.remember(s, 'remember that my notebook is blue');
    s.phone[s.phone.length - 1].sensitive = true;
    const FK = require('../src/forge.js'); const KS = require('../src/kernel.js');
    const k = FK.ForgeKernel({ store: KS.MemoryStore(), lexicon: require('../data/lexicon.json'), lexiconExt: require('../data/lexicon-ext.json'), clock: () => '2026-11-07T00:00:00Z' });
    expect(k.perm.setPolicy('memoryApproval', 'every_write', true).decision === 'allow', 'policy');
    const held = A.remember(s, 'remember that my uncle lives in Bern', k);
    expect(held.held === true && held.rule === 'PERM-D10-EVERY-WRITE' && !s.phone.some(r => /Bern/.test(r.text)), held.rule);
    const n = s.phone.length;
    const told = A.ask(s, 'tell me about my sister');
    const all = A.ask(s, 'tell me everything about my sister');
    const shown = A.ask(s, 'show me my facts');
    const many = A.ask(s, 'how many facts');
    expect(/Paris/.test(told.reply || '') && !/4821|Lyon|blue|Bern/.test(told.reply || ''), told.reply);
    expect(/Paris/.test(all.reply || '') && !/4821|Lyon|blue|Bern/.test(all.reply || ''), all.reply);
    expect(/Paris/.test(shown.reply || '') && !/4821|Lyon|blue|Bern/.test(shown.reply || ''), shown.reply);
    expect(/^1 fact\./.test(many.reply || '') && !/4821|Lyon|blue|Bern/.test(many.reply || ''), many.reply);
    expect(s.phone.length === n, 'a question wrote');
  });
  C('LC-NO-ROUTES', 'when speaks the stored timestamp and holds when it is missing', () => {
    const s = A.session();
    const kept = A.remember(s, 'remember that my sister lives in Paris');
    const when = A.ask(s, 'when did I tell you that my sister lives in Paris');
    expect(kept.ok === true && /2026-11-07T00:00:00Z/.test(when.reply || '') && /Paris/.test(when.reply || '') && !/1999/.test(when.reply || ''), when.reply);
    const bare = A.session();
    A.remember(bare, 'remember that my aunt lives in Oslo');
    delete bare.phone[0].provenance.at;
    const missing = A.ask(bare, 'when did I tell you that my aunt lives in Oslo on 1999-01-01');
    expect(missing.reply == null && missing.world_model.derive.reason === 'no provenance time' && !/1999/.test(JSON.stringify(missing.reply || '')), missing.world_model.derive.reason);
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 500); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
