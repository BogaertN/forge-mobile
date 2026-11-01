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


(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4111', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4111', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows));
  process.exit(failed ? 1 : 0);
})();
