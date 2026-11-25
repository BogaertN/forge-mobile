/* R4260 (4.9.249): remembered premises, explicit forget, and a why follow-up.
 *
 * The two ledger rows stay in world_state_suite.js and stay failures. This file is the
 * compatible contract the targeted gate runs: reload from world_facts, forget one fact,
 * the same texts in both phone lists, an independent proof kept, a shared fixture left
 * in place, and why? re-checking the prior admitted derivation.
 */
const path = require('path');
const { execFileSync } = require('child_process');
const K = require('../src/kernel.js');
const FK = require('../src/forge.js');
const Q = require('../src/qframe.js');
const WF = require('../src/world_facts.js');
const A = require('./ask_path.js');
const Core = require('../src/rmc_core.js');
const LEX = require('../data/lexicon.json');
const EXT = require('../data/lexicon-ext.json');
const f = FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-07T00:00:00Z' });
function put(text) { return WF.upsert({ text, clause: Q.clause(text, f), kind: 'remember' }); }
function admitted(row) { return row && row.product_reply === true && row.echo && row.echo.pass === true && row.calls_llm !== true && !(row.memory_write && row.memory_write.committed); }

function register(C, expect) {
  C('WS-PERSIST', 'remembered premises survive a new read of the same store and the chain is recomputed from them (old: a new kernel on the same store answers the chain)', () => {
    WF.clear();
    expect(put('Aster is inside Beryl.').ok && put('Beryl is inside Cobalt.').ok && put('Aster is blue.').ok);
    const ids = WF.rows().map(r => r.id);
    expect(ids.length === 3 && ids.every(id => id) && WF.rows().every(r => r.clause && r.clause.parsed && r.provenance && r.provenance.store === 'world_facts'), JSON.stringify(WF.rows().map(r => r.text)));
    const first = A.askStored('does Cobalt contain Aster?');
    const again = A.askStored('does Cobalt contain Aster?');
    const blue = WF.rows().find(r => /blue/.test(r.text));
    expect(admitted(first) && first.reply === 'Aster is inside Beryl. Beryl is inside Cobalt. Aster is inside Cobalt.' && first.world_model.derive.survivor.how === 'WM-CONTAIN-CHAIN', first.reply);
    expect(admitted(again) && again.reply === first.reply, again.reply);
    const prem = (first.world_model.derive.survivor.premises || []).map(p => p.text);
    expect(blue && blue.clause && blue.clause.parsed && prem.some(t => /Aster is inside Beryl/.test(t)) && prem.some(t => /Beryl is inside Cobalt/.test(t)) && WF.rows().length === 3, JSON.stringify(prem));
    WF.clear();
  });
  C('WS-RETRACT', 'explicit forget removes only that premise; the chain stops and the other premise still derives (old: chain answer no longer given, remaining inverse stays)', () => {
    WF.clear();
    expect(put('Aster is inside Beryl.').ok && put('Beryl is inside Cobalt.').ok && put('Aster is blue.').ok);
    expect(admitted(A.askStored('is Aster inside Cobalt?')));
    const gone = WF.forget('Beryl is inside Cobalt.');
    expect(gone.ok && gone.rule === 'WORLD-FACTS-FORGOT' && gone.receipt && gone.receipt.fact_id && gone.receipt.text === 'Beryl is inside Cobalt.', JSON.stringify(gone));
    expect(WF.rows().map(r => r.text).sort().join('|') === 'Aster is blue.|Aster is inside Beryl.', WF.rows().map(r => r.text).join('|'));
    const chain = A.askStored('is Aster inside Cobalt?');
    const contain = A.askStored('does Cobalt contain Aster?');
    const left = A.askStored('is Aster inside Beryl?');
    const inv = A.askStored('does Beryl contain Aster?');
    expect(chain.product_reply !== true && contain.product_reply !== true, (chain.reply || chain.route) + ' | ' + (contain.reply || contain.route));
    expect(admitted(left) && left.reply === 'Aster is inside Beryl.' && admitted(inv) && inv.reply === 'Aster is inside Beryl.' && inv.world_model.derive.survivor.how === 'direct', (left.reply || '') + ' | ' + (inv.reply || ''));
    expect(put('Beryl is inside Cobalt.').ok);
    const back = A.askStored('does Cobalt contain Aster?');
    expect(admitted(back) && back.reply === 'Aster is inside Beryl. Beryl is inside Cobalt. Aster is inside Cobalt.' && WF.rows().length === 3, back.reply);
    WF.clear();
  });
  C('WS-RETRACT', 'the remembered list and world_facts name the same premises after forget', () => {
    WF.clear();
    expect(put('Aster is inside Beryl.').ok && put('Beryl is inside Cobalt.').ok && put('Aster is blue.').ok);
    const remembered = WF.rows().map(r => ({ text: r.text }));
    expect(put('Aster is inside Beryl.').rule === 'WORLD-FACTS-REFRESHED' && WF.rows().length === 3, 'a second copy was stored');
    const gone = WF.forget('Beryl is inside Cobalt.');
    const left = remembered.filter(x => !WF.sameText(x.text, gone.receipt.text));
    const wf = WF.rows().map(r => r.text).sort();
    expect(gone.ok && left.map(x => x.text).sort().join('|') === wf.join('|') && new Set(wf).size === wf.length, wf.join('|'));
    WF.clear();
  });
  C('WS-RETRACT', 'forgetting one chain leaves an independent proof, and a shared fixture stays', () => {
    WF.clear();
    const shared = A.productionPools().shared;
    const sharedN = shared.length;
    const sharedText = shared[0] && shared[0].text;
    expect(put('Aster is inside Beryl.').ok && put('Beryl is inside Cobalt.').ok && put('Nia is inside Ola.').ok);
    expect(admitted(A.askStored('is Aster inside Cobalt?')) && admitted(A.askStored('is Nia inside Ola?')));
    expect(WF.forget('Beryl is inside Cobalt.').ok);
    const chain = A.askStored('is Aster inside Cobalt?');
    const other = A.askStored('is Nia inside Ola?');
    expect(chain.product_reply !== true && admitted(other) && other.reply === 'Nia is inside Ola.', (chain.reply || chain.route) + ' | ' + (other.reply || other.route));
    expect(WF.forget(sharedText).ok === false && A.productionPools().shared.length === sharedN && A.productionPools().shared[0].text === sharedText, 'phone forget changed the shared fixture');
    WF.clear();
  });
  C('WS-WHY', 'why re-checks the prior derivation and stores nothing', () => {
    WF.clear();
    const s = A.session();
    expect(A.remember(s, 'remember that Aster is inside Beryl').ok && A.remember(s, 'remember that Beryl is inside Cobalt').ok);
    const chain = A.ask(s, 'is Aster inside Cobalt?');
    const n = s.phone.length;
    const facts = WF.rows().length;
    const why = A.ask(s, 'why?');
    expect(admitted(chain) && admitted(why) && why.reply === chain.reply && why.followup && why.followup.kind === 'why' && why.followup.how === 'WM-CONTAIN-CHAIN' && s.phone.length === n && WF.rows().length === facts, why.reply || why.route);
    const contain = A.ask(s, 'does Cobalt contain Aster?');
    const why2 = A.ask(s, 'why?');
    expect(admitted(contain) && why2.reply === contain.reply && why2.followup.how === 'WM-CONTAIN-CHAIN', why2.reply || why2.route);
    WF.clear();
  });
  C('WS-WHY', 'a later admitted answer becomes the why referent', () => {
    const s = A.session();
    A.remember(s, 'remember that Aster is inside Beryl');
    A.remember(s, 'remember that Beryl is inside Cobalt');
    A.ask(s, 'is Aster inside Cobalt?');
    const direct = A.ask(s, 'is Aster inside Beryl?');
    const why = A.ask(s, 'why?');
    expect(admitted(direct) && why.reply === 'Aster is inside Beryl.' && why.followup.of === 'is Aster inside Beryl?' && !/Cobalt/.test(why.reply), why.reply || why.route);
  });
  C('WS-WHY', 'a forgotten premise is not explained again, and a tampered or private premise is not spoken', () => {
    const s = A.session();
    A.remember(s, 'remember that Aster is inside Beryl');
    A.remember(s, 'remember that Beryl is inside Cobalt');
    const chain = A.ask(s, 'is Aster inside Cobalt?');
    s.phone = s.phone.filter(r => !/Cobalt/.test(r.text));
    const stale = A.ask(s, 'why?');
    expect(stale.product_reply !== true && stale.reply == null && !/Cobalt/.test(JSON.stringify(stale.followup || {})), stale.reply || stale.route);
    A.remember(s, 'remember that Beryl is inside Cobalt');
    A.ask(s, 'is Aster inside Cobalt?');
    s.prior.premises[0].text = 'Aster is inside Zog.';
    const tampered = A.ask(s, 'why?');
    expect(tampered.product_reply !== true && tampered.reply == null && !/Zog/.test(JSON.stringify(tampered)), tampered.reply || tampered.route);
    A.ask(s, 'is Aster inside Cobalt?');
    s.prior.premises[0].quarantined = true;
    const hidden = A.ask(s, 'why?');
    expect(hidden.product_reply !== true && hidden.reply == null, hidden.reply || hidden.route);
    const facts = WF.rows().length;
    A.ask(s, 'is Aster inside Cobalt?');
    s.prior.premises[0].text = 'the password is hunter2';
    const secret = A.ask(s, 'why?');
    const dumped = JSON.stringify(secret);
    expect(secret.product_reply !== true && secret.reply == null && !/hunter2|password/.test(dumped) && WF.rows().length === facts && s.phone.every(p => !/hunter2|password/.test(p.text || '')), dumped);
    const proof = Object.values(chain.world_model.proofs)[0];
    const checked = JSON.parse(execFileSync('python3', ['-c', 'import json,sys; from rmc_engine_v1.world_model_v1 import check_proof; p=json.load(sys.stdin); print(json.dumps(check_proof(p["world"], p["proof"])))'], { cwd: path.join(__dirname, '..'), env: Object.assign({}, process.env, { PYTHONPATH: path.join(__dirname, '..', 'engine') }), input: JSON.stringify({ world: chain.world_model.world, proof: proof }), encoding: 'utf8' }));
    expect(proof.ok === true && checked.ok === false, JSON.stringify(checked));
  });
  C('WS-WHY', 'why with no prior derivation holds', () => {
    const s = A.session();
    const why = A.ask(s, 'why?');
    expect(why.product_reply !== true && why.reply == null && why.route === 'why_no_derivation' && s.phone.length === 0, why.reply || why.route);
    const framed = Q.compile('why is Aster inside Cobalt?', A.kernel());
    expect(framed && framed.wh === 'why' && framed.declarative && !Core.bareWhy(framed), JSON.stringify(framed && { wh: framed.wh, parsed: framed.parsed, declarative: framed.declarative }));
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 500); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
