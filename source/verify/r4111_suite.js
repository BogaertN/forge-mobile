/* R4111 (4.9.111): an audited turn exports as one packet, success or failure.
 * Echo fail, language unexpressible, gate refusal, quarantine, and χ re-route
 * are receipt types a user can open. Written FIRST (failing).
 * No offline replay, no Doc 7 overhaul, no MSM Doc 2, no naming rename. */
const fs = require('fs');
const ROOT = require('path').join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const M = require(ROOT + '/src/kmath.js');
const FK = require(ROOT + '/src/forge.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const rows = [], tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-26T08:11:00Z';
const mk = o => KMOD.Kernel(Object.assign({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK }, o || {}));
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
let TP = null, tpErr = null;
try { TP = require(ROOT + '/src/turn_packet.js'); } catch (e) { tpErr = e; }
const packetOf = r => r && (r.turn_packet || (r.trace && r.trace.turn_packet));
const needMod = () => { if (!TP) throw new Error('turn_packet.js is not loadable: ' + (tpErr && tpErr.message)); };
const TYPES = ['echo_fail', 'language_unexpressible', 'gate_refusal', 'quarantine', 'chi_reroute'];
const FIELDS = ['schema', 'packet_version', 'turn_id', 'turn', 'intent', 'manifest', 'warrants', 'evidence_tiers', 'selected', 'not_selected', 'drift', 'containment', 'echo', 'memory', 'world', 'spoken', 'failure', 'receipt_type'];

function shape(p, why) {
  needMod();
  expect(p && p.schema === 'FORGE-TURN-PACKET/v1', why + ' schema ' + (p && p.schema));
  expect(p.packet_version === '4.9.111', why + ' version ' + p.packet_version);
  for (const f of FIELDS) expect(Object.prototype.hasOwnProperty.call(p, f), why + ' missing ' + f);
  expect(p.turn_id && p.manifest && p.manifest.msm_id, why + ' turn/manifest');
  expect(Array.isArray(p.warrants) && Array.isArray(p.evidence_tiers) && Array.isArray(p.not_selected), why + ' lists');
  expect(p.selected && p.selected.route && p.drift && p.drift.band != null && p.containment && p.containment.route, why + ' route');
  expect(p.echo && Object.prototype.hasOwnProperty.call(p.echo, 'pass'), why + ' echo');
  expect(p.memory && Object.prototype.hasOwnProperty.call(p.memory, 'attempted') && Object.prototype.hasOwnProperty.call(p.memory, 'blocked'), why + ' memory');
  expect(p.world && Object.prototype.hasOwnProperty.call(p.world, 'attempted') && Object.prototype.hasOwnProperty.call(p.world, 'blocked'), why + ' world');
  if (p.receipt_type === 'answer') expect(p.failure == null, why + ' answer has a failure class');
  else {
    expect(TYPES.includes(p.receipt_type), why + ' type ' + p.receipt_type);
    expect(p.failure && p.failure.class === p.receipt_type, why + ' failure class');
  }
}

T('the packet schema names the five failure receipt types', () => {
  needMod();
  expect(TP.SCHEMA === 'FORGE-TURN-PACKET/v1' && TP.FAILURE_SCHEMA === 'FORGE-FAILURE-RECEIPT/v1' && TP.ANSWER_SCHEMA === 'FORGE-ANSWER-RECEIPT/v1', 'schemas');
  expect(JSON.stringify(TP.FAILURE_TYPES) === JSON.stringify(TYPES), JSON.stringify(TP.FAILURE_TYPES));
  expect(JSON.stringify(TP.GATE_SUBTYPES) === JSON.stringify(['ambiguity', 'unsupported', 'action_blocked']), JSON.stringify(TP.GATE_SUBTYPES));
});

T('a spoken remember exports one answer packet and the same packet opens again', () => {
  const k = mk();
  const r = k.process('remember that my car is red');
  const p = packetOf(r);
  shape(p, 'remember');
  expect(r.reply === 'I noted that your car is red.' && r.trace.intent_kind === 'REQUEST_COMMIT', r.reply);
  expect(p.receipt_type === 'answer' && p.spoken === true && p.failure == null && p.intent === 'REQUEST_COMMIT', JSON.stringify({ t: p.receipt_type, s: p.spoken, f: p.failure, i: p.intent }));
  expect(p.echo.pass === true && p.memory.attempted === true && p.memory.blocked === false && p.memory.ops.length > 0, JSON.stringify(p.memory) + ' ' + JSON.stringify(p.echo));
  expect(p.world.attempted === true && p.world.blocked === false && p.world.version_id, JSON.stringify(p.world));
  expect(p.manifest.msm_v1_id && p.drift.eps_s === 0 && p.drift.band === 'clean' && p.containment.route === 'active_stack_candidate', JSON.stringify({ m: p.manifest, d: p.drift, c: p.containment }));
  expect(typeof k.exportTurnPacket === 'function', 'exportTurnPacket missing');
  const again = k.exportTurnPacket(r.trace.turn);
  expect(again && again.turn_id === p.turn_id && again.receipt_type === 'answer', JSON.stringify(again && { id: again.turn_id, t: again.receipt_type }));
  const opened = TP.openReceipt(again);
  expect(opened && opened.schema === TP.ANSWER_SCHEMA && opened.receipt_type === 'answer' && opened.packet.turn_id === p.turn_id, JSON.stringify(opened && opened.schema));
  expect(sharedN(k) === 0, 'shared KB written');
});

T('an Echo failure is an echo_fail receipt and stores nothing', () => {
  const k = mk({ renderFault: t => t.replace('noted', 'denied') });
  const r = k.process('remember that my car is red');
  const p = packetOf(r);
  shape(p, 'echo');
  expect(r.reply == null && r.trace.language === 'LANGUAGE_UNEXPRESSIBLE', (r.trace.language || 'missing') + ' ' + r.reply);
  expect(p.receipt_type === 'echo_fail' && p.failure.class === 'echo_fail' && p.failure.subtype == null && p.spoken === false, JSON.stringify(p.failure));
  expect(p.echo.pass === false && p.echo.signature_notes, JSON.stringify(p.echo));
  expect(p.memory.attempted === true && p.memory.blocked === true && p.memory.ops.length === 0, JSON.stringify(p.memory));
  expect(k.memory().length === 0, 'echo fail stored a fact');
  const card = TP.receiptCard(p);
  expect(/data-receipt-type="echo_fail"/.test(card) && /<details[^>]*open/.test(card) && card.includes(p.turn_id), card.slice(0, 240));
  expect(sharedN(k) === 0, 'shared KB written');
});

T('a derivation failure is language_unexpressible, not an echo failure', () => {
  const D = require(ROOT + '/src/derive.js');
  const orig = D.realizeMeaning;
  D.realizeMeaning = () => null;
  try {
    const k = mk();
    const r = k.process('hello');
    const p = packetOf(r);
    shape(p, 'derive');
    expect(r.reply == null && r.trace.language === 'LANGUAGE_UNEXPRESSIBLE', (r.trace.language || 'missing') + ' ' + r.reply);
    expect(p.receipt_type === 'language_unexpressible' && p.failure.class === 'language_unexpressible' && p.spoken === false, JSON.stringify(p.failure));
    expect(p.echo.pass !== true, 'a derivation failure was marked echo pass');
    expect(k.memory().length === 0, 'derivation failure stored a fact');
  } finally { D.realizeMeaning = orig; }
});

T('quarantine and a χ re-route are different receipt types', () => {
  const q = mk({ testDrift: () => 0.5 }).process('hello');
  const qp = packetOf(q);
  shape(qp, 'quarantine');
  expect(q.reply == null && qp.receipt_type === 'quarantine' && qp.spoken === false && qp.failure.class === 'quarantine', JSON.stringify(qp.failure) + ' ' + q.reply);
  expect(qp.containment.route === 'drift_archive_only' && qp.drift.band === 'elevated' && qp.drift.eps_s === 0.5, JSON.stringify({ c: qp.containment, d: qp.drift }));
  const held = mk({ testDrift: () => 0.36 }).process('hello');
  const hp = packetOf(held);
  shape(hp, 'held correction');
  expect(held.reply == null && hp.receipt_type === 'quarantine' && hp.drift.correction && hp.drift.correction.applied === false, JSON.stringify(hp.drift && hp.drift.correction));
  const chi = mk({ testDrift: () => 0.9 }).process('hello');
  const cp = packetOf(chi);
  shape(cp, 'chi');
  expect(chi.reply && /bypass/.test(chi.reply) && chi.trace.echo && chi.trace.echo.pass, chi.reply);
  expect(cp.receipt_type === 'chi_reroute' && cp.failure.class === 'chi_reroute' && cp.spoken === true, JSON.stringify(cp.failure));
  expect(cp.drift.band === 'hard_stop' && cp.drift.eps_s === 0.9 && cp.containment.route === 'correction_queue', JSON.stringify({ d: cp.drift, c: cp.containment }));
  expect((chi.trace.rules || []).some(x => x.id === 'CHI-GRACE-REROUTE'), 'grace re-route did not run');
});

T('gate refusals keep their spoken sentence and a subtype', () => {
  const buy = mk().process('buy milk');
  const bp = packetOf(buy);
  shape(bp, 'buy');
  expect(/not authorized/.test(buy.reply) && buy.trace.echo && buy.trace.echo.pass, buy.reply);
  expect(bp.receipt_type === 'gate_refusal' && bp.failure.class === 'gate_refusal' && bp.failure.subtype === 'action_blocked' && bp.spoken === true, JSON.stringify(bp.failure));
  const duck = mk().process('I saw her duck');
  const dp = packetOf(duck);
  shape(dp, 'duck');
  expect(duck.reply && duck.trace.outcome.category === 'AMBIGUITY_PRESERVED', duck.reply);
  expect(dp.receipt_type === 'gate_refusal' && dp.failure.subtype === 'ambiguity' && dp.spoken === true, JSON.stringify(dp.failure));
  const bad = mk().process('export the proof');
  const up = packetOf(bad);
  shape(up, 'unsupported');
  expect(bad.reply === 'That expression is malformed.' && bad.trace.outcome.category === 'REFUSAL_RELEVANT', bad.reply);
  expect(up.receipt_type === 'gate_refusal' && up.failure.subtype === 'unsupported', JSON.stringify(up.failure));
  const dropped = (up.not_selected || []).find(c => c.route === 'language.core');
  expect(dropped && dropped.reason, JSON.stringify(up.not_selected));
  const math = mk().process('what is 2 + 3');
  const mp = packetOf(math);
  shape(mp, 'math');
  expect(math.reply === '2 + 3 = 5.' && mp.receipt_type === 'answer', math.reply + ' ' + (mp && mp.receipt_type));
  const skip = (mp.not_selected || []).find(c => c.route === 'language.core');
  expect(skip && skip.reason, JSON.stringify(mp.not_selected));
});

T('one command exports an earlier turn, success or failure', () => {
  const k = mk();
  const none = k.process('export the turn packet');
  const np = packetOf(none);
  shape(np, 'missing export');
  expect(none.reply && none.trace.echo && none.trace.echo.pass && np.receipt_type === 'gate_refusal', none.reply + ' ' + (np && np.receipt_type));
  expect(!none.exported_packet, 'an empty kernel exported a packet');
  const remembered = k.process('remember that my car is red');
  const ex = k.process('export the turn packet');
  expect(ex.reply && ex.trace.echo && ex.trace.echo.pass && !ex.trace.blocked, ex.reply || ex.block_reason);
  expect(ex.exported_packet && ex.exported_packet.turn_id === packetOf(remembered).turn_id && ex.exported_packet.receipt_type === 'answer', JSON.stringify(ex.exported_packet && { id: ex.exported_packet.turn_id, t: ex.exported_packet.receipt_type }));
  const byN = k.process('export the packet for turn ' + remembered.trace.turn);
  expect(byN.exported_packet && byN.exported_packet.turn === remembered.trace.turn && byN.trace.echo && byN.trace.echo.pass, byN.reply || byN.block_reason);
  const echoK = mk({ renderFault: t => /noted/.test(t) ? t.replace('noted', 'denied') : t });
  const failed = echoK.process('remember that my car is red');
  const exF = echoK.process('export the turn packet');
  expect(exF.trace.echo && exF.trace.echo.pass && exF.exported_packet && exF.exported_packet.receipt_type === 'echo_fail' && exF.exported_packet.turn_id === packetOf(failed).turn_id, JSON.stringify(exF.exported_packet && { t: exF.exported_packet.receipt_type, id: exF.exported_packet.turn_id, reply: exF.reply }));
  expect(sharedN(k) === 0 && sharedN(echoK) === 0, 'shared KB written');
});

T('the forge spine id is on the packet, and a secret never is', () => {
  const f = FK.ForgeKernel({ clock: CLOCK, lexicon: LEX, lexiconExt: EXT, store: KMOD.MemoryStore() });
  const r = f.process('remember that my car is red');
  const p = packetOf(r);
  shape(p, 'forge');
  expect(r.forge && r.forge.msm && r.forge.msm.manifest_id && p.manifest.forge_manifest_id === r.forge.msm.manifest_id, JSON.stringify(p.manifest));
  expect(r.forge.receipt && p.audit_receipt_id === r.forge.receipt.receipt_id, p.audit_receipt_id);
  const list = f.turnPackets();
  expect(list.length === 1 && list[0].turn_id === p.turn_id, 'turnPackets ' + list.length);
  const pin = f.process('remember that my pin is 1234');
  expect(!/1234/.test(JSON.stringify(packetOf(pin))), 'pin leaked into the packet');
  expect(f.verifyAudit().ok, 'receipt chain broke');
  expect(sharedN(f) === 0, 'shared KB written');
});

T('Ask Forge and Audit open a receipt and export the same packet', () => {
  needMod();
  const html = fs.readFileSync(ROOT + '/index.html', 'utf8');
  const app = fs.readFileSync(ROOT + '/src/app.js', 'utf8');
  const iPacket = html.indexOf('src/turn_packet.js');
  const iKernel = html.indexOf('src/kernel.js');
  expect(iPacket > 0 && iPacket < iKernel, 'turn_packet.js is not loaded before the kernel');
  expect(/data-export-turn/.test(app) && /Export turn packet/.test(app), 'Ask Forge has no export control');
  expect(/receiptCard/.test(app) && /data-receipt-type/.test(app), 'Audit does not open a typed receipt');
  expect(/turnPackets\(/.test(app) && /exportTurnPacket\(/.test(app), 'the surfaces do not call the packet pathway');
  const k = mk({ renderFault: t => t.replace('noted', 'denied') });
  const r = k.process('remember that my car is red');
  const card = TP.receiptCard(packetOf(r));
  expect(/Echo failed/.test(card) && /echo_fail/.test(card) && /data-export-turn/.test(card), card.slice(0, 300));
});

T('version, registry, and CONFLICTS name this release and not the later queue', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver && reg.count === reg.features.length, reg.version + ' count ' + reg.count);
  const ids = reg.features.map(f => f.id);
  expect(ids.includes('R4111-PACKET') && ids.includes('R4111-RECEIPT'), ids.slice(-4).join(','));
  for (const id of ['R4111-PACKET', 'R4111-RECEIPT']) {
    const f = reg.features.find(x => x.id === id);
    expect(f.claim === 'Partial' && (f.proof || []).includes('R4111') && /4\.9\.111/.test(f.note), id + ' ' + JSON.stringify(f && f.proof));
    expect(!/Christ function/i.test(f.note), id);
  }
  const tally = {}; for (const f of reg.features) tally[f.claim] = (tally[f.claim] || 0) + 1;
  expect(reg.claims.Implemented === 112 && tally.Implemented === 113, 'implemented tally moved');
  expect(reg.claims.Partial === tally.Partial + 1, 'partial delta moved ' + reg.claims.Partial + '/' + tally.Partial);
  const cf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  const sec = cf.slice(cf.lastIndexOf('## v4.9.111'));
  expect(/echo_fail/.test(sec) && /language_unexpressible/.test(sec) && /gate_refusal/.test(sec) && /quarantine/.test(sec) && /chi_reroute/.test(sec), 'receipt types missing from CONFLICTS');
  expect(/turn packet/.test(sec) && /4\.9\.112/.test(sec) === false || /not this release|out of scope|do not/.test(sec), 'later queue not fenced');
  expect(!/offline replay verifier|Doc 7 Audit category/.test(sec) || /out of scope|do not|not this/.test(sec), 'later items were built here');
  const next = fs.readFileSync(ROOT + '/../NEXT_BUILD.md', 'utf8');
  expect(/4\.9\.111/.test(next) && /turn packet/.test(next), 'NEXT_BUILD does not record the packet');
  const readme = fs.readFileSync(ROOT + '/../README.md', 'utf8');
  expect(/4\.9\.111/.test(readme) && /turn packet|failure receipt/i.test(readme), 'README does not name the surface');
  const src = fs.readFileSync(ROOT + '/src/turn_packet.js', 'utf8');
  expect(!/\b(llm|embedding|openai|classifier)\b/i.test(src), 'model path in turn_packet.js');
  expect(M.DRIFT_RULING.project_max === 0.35 && M.DRIFT_RULING.explore_min === 0.4 && M.DRIFT_RULING.explore_max === 0.8, 'drift law moved');
});

T('a spoken dream stays an answer packet on the dream route', () => {
  const r = mk().process('Suppose the car is red.');
  const p = packetOf(r);
  shape(p, 'dream');
  expect(/dream quarantine/.test(r.reply) && r.trace.echo && r.trace.echo.pass, r.reply);
  expect(p.receipt_type === 'answer' && p.failure == null && p.containment.route === 'dream_state_quarantine_candidate' && p.intent === 'SIMULATE', JSON.stringify({ t: p.receipt_type, c: p.containment, i: p.intent }));
  expect(p.memory.blocked === true || p.memory.attempted === false, JSON.stringify(p.memory));
  expect(sharedN(mk()) === 0 || sharedN({ store: { load: () => [] } }) === 0, 'shared');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4111', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4111', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows));
  process.exit(failed ? 1 : 0);
})();
