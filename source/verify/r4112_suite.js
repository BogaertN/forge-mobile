/* R4112 (4.9.112): Doc 6 gate states are visible, and every not-selected
 * route is on the turn packet with the rejection reason already recorded.
 * Written FIRST (failing). No Doc 7 Audit overhaul, no MSM Doc 2, no naming
 * rename, no offline replay. No chatbot menu. */
const fs = require('fs');
const ROOT = require('path').join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const M = require(ROOT + '/src/kmath.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const rows = [], tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-27T00:12:00Z';
const mk = o => KMOD.Kernel(Object.assign({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK }, o || {}));
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
let TP = null, tpErr = null;
try { TP = require(ROOT + '/src/turn_packet.js'); } catch (e) { tpErr = e; }
const packetOf = r => r && (r.turn_packet || (r.trace && r.trace.turn_packet));
const needMod = () => { if (!TP) throw new Error('turn_packet.js is not loadable: ' + (tpErr && tpErr.message)); };
const summaryOf = html => { const a = html.indexOf('<summary>'), b = html.indexOf('</summary>'); return a < 0 ? '' : html.slice(a, b < 0 ? html.length : b); };

function routesComplete(r, why) {
  const p = packetOf(r);
  const sel = r.trace.selection || {};
  const routes = sel.routes || [];
  const winner = sel.winner || null;
  expect(routes.length > 1, why + ' selection.routes missing');
  const want = routes.filter(x => x && x.route && x.route !== winner);
  expect(Array.isArray(p.not_selected) && p.not_selected.length === want.length, why + ' not_selected ' + (p.not_selected || []).length + ' want ' + want.length + ' ' + JSON.stringify((p.not_selected || []).map(c => c.route)));
  expect(p.not_selected.map(c => c.route).join('|') === want.map(x => x.route).join('|'), why + ' order ' + p.not_selected.map(c => c.route).join('|'));
  const seen = new Set();
  for (const row of p.not_selected) {
    expect(row.route && row.status && row.reason && String(row.reason).trim(), why + ' empty ' + JSON.stringify(row));
    expect(!seen.has(row.route), why + ' duplicate ' + row.route);
    seen.add(row.route);
    expect(row.route !== winner && row.status !== 'selected', why + ' winner listed ' + row.route);
    const src = want.find(x => x.route === row.route);
    const cand = (sel.candidates || []).find(c => c.route === row.route && c.status && c.status !== 'selected');
    if (cand) expect(row.status === cand.status && row.reason === (cand.why || cand.reason), why + ' candidate reason ' + JSON.stringify(row) + ' vs ' + JSON.stringify({ s: cand.status, w: cand.why }));
    else expect(row.reason === src.why && row.status === (src.evaluated === false ? 'not_evaluated' : 'not_applicable'), why + ' route reason ' + JSON.stringify(row) + ' vs ' + JSON.stringify(src && { e: src.evaluated, w: src.why }));
  }
}

T('Doc 6 names an ambiguity, an unsupported turn, and an action that was understood but blocked', () => {
  needMod();
  expect(TP.SCHEMA === 'FORGE-TURN-PACKET/v1' && TP.PACKET_VERSION === '4.9.111', 'schema moved ' + (TP && TP.PACKET_VERSION));
  expect(JSON.stringify(TP.GATE_SUBTYPES) === JSON.stringify(['ambiguity', 'unsupported', 'action_blocked']), JSON.stringify(TP && TP.GATE_SUBTYPES));
  const buy = mk().process('buy milk');
  const bp = packetOf(buy);
  expect(/not authorized/.test(buy.reply) && buy.trace.intent_kind === 'UNSUPPORTED' && bp.receipt_type === 'gate_refusal' && bp.failure.subtype === 'action_blocked', buy.reply + ' ' + JSON.stringify(bp.failure));
  expect(bp.gate && bp.gate.state === 'action_blocked' && bp.gate.label === 'meaning-understood-but-action-blocked' && bp.gate.intent === 'UNSUPPORTED' && bp.gate.subtype === 'action_blocked', JSON.stringify(bp.gate));
  const duck = mk().process('I saw her duck');
  const dp = packetOf(duck);
  expect(duck.trace.intent_kind === 'CLARIFY' && duck.trace.outcome.category === 'AMBIGUITY_PRESERVED' && dp.failure.subtype === 'ambiguity', duck.reply);
  expect(dp.gate && dp.gate.state === 'ambiguity' && dp.gate.label === 'ambiguity / clarification-required' && dp.gate.intent === 'CLARIFY' && dp.gate.subtype === 'ambiguity', JSON.stringify(dp.gate));
  const bad = mk().process('export the proof');
  const up = packetOf(bad);
  expect(bad.reply === 'That expression is malformed.' && bad.trace.intent_kind === 'UNSUPPORTED' && up.failure.subtype === 'unsupported', bad.reply + ' ' + (bad.trace.intent_kind || ''));
  expect(up.gate && up.gate.state === 'unsupported' && up.gate.label === 'unsupported' && up.gate.intent === 'UNSUPPORTED' && up.gate.subtype === 'unsupported', JSON.stringify(up.gate));
  const it = mk().process('what is it?');
  const ip = packetOf(it);
  expect(it.reply && it.trace.intent_kind === 'CLARIFY' && it.trace.outcome.category === 'CLARIFICATION_REQUIRED' && ip.receipt_type === 'answer' && ip.failure == null, it.reply + ' ' + (ip && ip.receipt_type));
  expect(ip.gate && ip.gate.state === 'clarification-required' && ip.gate.label === 'clarification-required' && ip.gate.intent === 'CLARIFY' && ip.gate.subtype == null, JSON.stringify(ip.gate));
  const pin = mk().process('my pin is 1234');
  const pp = packetOf(pin);
  expect(pin.trace.intent_kind === 'REQUEST_COMMIT' && pp.failure.subtype === 'action_blocked', pin.reply + ' ' + pin.trace.intent_kind);
  expect(pp.gate && pp.gate.state === 'action_blocked' && pp.gate.label === 'meaning-understood-but-action-blocked' && pp.gate.intent === 'REQUEST_COMMIT', JSON.stringify(pp.gate));
  expect(!/1234/.test(JSON.stringify(pp)), 'pin leaked');
  expect(sharedN(mk()) === 0, 'shared KB written');
});

T('a spoken answer, a greeting, a dream, an Echo failure, and a quarantine are not painted as Doc 6 gates', () => {
  const remembered = mk().process('remember that my car is red');
  expect(remembered.reply === 'I noted that your car is red.' && packetOf(remembered).receipt_type === 'answer' && packetOf(remembered).gate == null, JSON.stringify(packetOf(remembered).gate));
  const hello = mk().process('hello');
  expect(hello.trace.intent_kind === 'CLARIFY' && packetOf(hello).gate == null && packetOf(hello).receipt_type === 'answer', JSON.stringify(packetOf(hello).gate) + ' ' + hello.trace.intent_kind);
  const dream = mk().process('Suppose the car is red.');
  expect(/dream quarantine/.test(dream.reply) && packetOf(dream).receipt_type === 'answer' && packetOf(dream).gate == null && packetOf(dream).containment.route === 'dream_state_quarantine_candidate', dream.reply);
  const echo = mk({ renderFault: t => t.replace('noted', 'denied') }).process('remember that my car is red');
  expect(echo.reply == null && packetOf(echo).receipt_type === 'echo_fail' && packetOf(echo).gate == null, JSON.stringify(packetOf(echo).gate));
  const q = mk({ testDrift: () => 0.5 }).process('hello');
  expect(q.reply == null && packetOf(q).receipt_type === 'quarantine' && packetOf(q).gate == null, JSON.stringify(packetOf(q).gate));
  const chi = mk({ testDrift: () => 0.9 }).process('hello');
  expect(chi.reply && packetOf(chi).receipt_type === 'chi_reroute' && packetOf(chi).gate == null, JSON.stringify(packetOf(chi).gate) + ' ' + chi.reply);
  expect(M.DRIFT_RULING.project_max === 0.35 && M.DRIFT_RULING.explore_min === 0.4 && M.DRIFT_RULING.explore_max === 0.8, 'drift law moved');
});

T('every route that was not selected is on the packet with its recorded reason', () => {
  const buy = mk().process('buy milk');
  routesComplete(buy, 'buy');
  const pre = packetOf(buy).not_selected.find(c => c.route === 'world.preflight');
  expect(pre && pre.status === 'not_applicable' && pre.reason === 'pattern does not apply', JSON.stringify(pre));
  expect(!packetOf(buy).not_selected.some(c => c.route === buy.trace.selection.winner), 'winner included');
  const math = mk().process('what is 2 + 3');
  routesComplete(math, 'math');
  expect(math.reply === '2 + 3 = 5.' && packetOf(math).receipt_type === 'answer' && packetOf(math).gate == null, math.reply);
  const skip = packetOf(math).not_selected.find(c => c.route === 'language.core');
  expect(skip && skip.status === 'not_evaluated' && /not evaluated: outranked by specific route math\.gp014/.test(skip.reason), JSON.stringify(skip));
  const it = mk().process('what is it?');
  routesComplete(it, 'it');
  const lc = packetOf(it).not_selected.find(c => c.route === 'language.core');
  expect(lc && lc.status === 'not_selected' && /outranked by directive\.frame/.test(lc.reason), JSON.stringify(lc));
  expect(sharedN(mk()) === 0, 'shared KB written');
});

T('Ask Forge and Audit show the Doc 6 state and the not-selected reasons, not a menu', () => {
  needMod();
  const buy = mk().process('buy milk');
  const card = TP.receiptCard(packetOf(buy));
  const summary = summaryOf(card);
  expect(/data-doc6-state="action_blocked"/.test(card) && /meaning-understood-but-action-blocked/.test(summary), summary);
  expect(/data-not-selected=/.test(card) && /data-route="world\.preflight"/.test(card) && /pattern does not apply/.test(card), card.slice(0, 500));
  expect(/<details[^>]*open/.test(card), 'reasons are not open');
  expect(!/<button[^>]*>[^<]*(ambiguity|unsupported|clarification|action)/i.test(card), 'a gate button menu');
  const duck = TP.receiptCard(packetOf(mk().process('I saw her duck')));
  expect(/data-doc6-state="ambiguity"/.test(duck) && /ambiguity \/ clarification-required/.test(summaryOf(duck)), summaryOf(duck));
  const it = TP.receiptCard(packetOf(mk().process('what is it?')));
  expect(/data-receipt-type="answer"/.test(it) && /data-doc6-state="clarification-required"/.test(it) && /clarification-required/.test(summaryOf(it)), summaryOf(it));
  const app = fs.readFileSync(ROOT + '/src/app.js', 'utf8');
  expect(/data-doc6-state/.test(app) && /gate\.state/.test(app) && /gate\.label/.test(app), 'conversation does not render the packet gate');
  expect(/<span class="tag doc6"/.test(app), 'the conversation state is not a typed label');
  expect(!/<button[^>]*data-doc6/.test(app), 'conversation offers a gate menu');
  expect(/receiptCard\(/.test(app) && /turnPackets\(/.test(app), 'Audit does not use the receipt');
  const html = fs.readFileSync(ROOT + '/index.html', 'utf8');
  expect(html.indexOf('src/turn_packet.js') > 0 && html.indexOf('src/turn_packet.js') < html.indexOf('src/kernel.js'), 'script order');
  const src = fs.readFileSync(ROOT + '/src/turn_packet.js', 'utf8');
  expect(!/\b(llm|embedding|openai|classifier)\b/i.test(src), 'model path in turn_packet.js');
});

T('version, registry, CONFLICTS, and NEXT_BUILD name 4.9.112 and leave the later queue parked', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  expect(ver === '4.9.112', ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver && reg.count === reg.features.length, reg.version + ' count ' + reg.count);
  const ids = reg.features.map(f => f.id);
  expect(ids.includes('R4111-PACKET') && ids.includes('R4111-RECEIPT'), '4.9.111 rows dropped');
  expect(ids.includes('R4112-GATE') && ids.includes('R4112-CANDIDATES'), ids.slice(-4).join(','));
  for (const id of ['R4112-GATE', 'R4112-CANDIDATES']) {
    const f = reg.features.find(x => x.id === id);
    expect(f.claim === 'Partial' && (f.proof || []).includes('R4112') && /4\.9\.112/.test(f.note), id + ' ' + JSON.stringify(f && f.proof));
    expect(!/Christ function/i.test(f.note), id);
  }
  const tally = {}; for (const f of reg.features) tally[f.claim] = (tally[f.claim] || 0) + 1;
  expect(reg.claims.Implemented === 112 && tally.Implemented === 113, 'implemented tally moved ' + reg.claims.Implemented + '/' + tally.Implemented);
  expect(reg.claims.Partial === tally.Partial + 1, 'partial delta moved ' + reg.claims.Partial + '/' + tally.Partial);
  const cf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  const sec = cf.slice(cf.lastIndexOf('## v4.9.112'));
  expect(/clarification-required/.test(sec) && /meaning-understood-but-action-blocked/.test(sec) && /action_blocked/.test(sec) && /unsupported/.test(sec), 'Doc 6 names missing');
  expect(/not-selected|not_selected/.test(sec) && /pattern does not apply|rejection reason/.test(sec), 'candidates missing');
  expect(/4\.9\.113|Doc 7/.test(sec) && /out of scope|do not/.test(sec), 'later queue not fenced');
  expect(!/Christ function/i.test(sec), 'Christ function');
  const next = fs.readFileSync(ROOT + '/../NEXT_BUILD.md', 'utf8');
  expect(/4\.9\.112/.test(next) && /clarification-required/.test(next) && /not-selected|not selected/.test(next), 'NEXT_BUILD does not record the gate');
  const readme = fs.readFileSync(ROOT + '/../README.md', 'utf8');
  expect(/4\.9\.112/.test(readme) && /clarification-required/.test(readme) && /not-selected|not selected/.test(readme), 'README does not name the surface');
  const targeted = fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8');
  expect(/"release": "4\.9\.112"/.test(targeted) && /r4112_suite\.js/.test(targeted), 'targeted gate omits this suite');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4112', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4112', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows));
  process.exit(failed ? 1 : 0);
})();
