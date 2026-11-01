/* R4122 (4.9.122): Suppose story branches are isolated SIMULATE.
 * Written FIRST. A story, a simulation, or a counterfactual is a branch.
 * The surface names it a simulation and a counterfactual. It is not a fact.
 * Parking uses dream quarantine. Nothing is written to the world head,
 * memory, or the shared KB. No parallel story engine. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [], rows = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-27T17:10:00Z';
const mk = extra => KMOD.Kernel(Object.assign({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK }, extra || {}));
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
const head = k => k.worldHead();
const sameHead = (k, h) => head(k).version_id === h.version_id && head(k).content_hash === h.content_hash;
const cr = r => r.turn_packet && r.turn_packet.creative;
const ids = r => ((r.trace && r.trace.rules) || []).map(x => x.id);
const quietStores = (k, h, n, why) => {
  expect(k.memory().length === n, why || ('memory ' + k.memory().length));
  expect(sharedN(k) === 0, 'shared KB');
  expect(sameHead(k, h), 'world head moved');
  expect(!(k.store.load('drift_archive') || []).length, 'drift archive');
  expect(!(k.store.load('ede_calibration') || []).length, 'ede calibration');
  expect(!(k.store.load('creative_proposals') || []).length, 'idea record');
};
const echoOk = r => {
  const e = r.trace.echo;
  expect(e && e.pass === true, (e && e.reason) || r.block_reason || r.reply);
  expect(e.score === 1 && e.theta === 1 && e.components && e.components.structural_identity === 1, JSON.stringify(e.components));
  expect(/structural round trip/.test(e.mode || '') && !/overlap|soft echo|word-overlap measure/.test(String(e.mode).replace('no word-overlap measure', '')), e.mode);
  expect(!r._k || r._k.realize(r.msm.meaning).text === r.reply, 're-realize');
};
const tag = (k, r) => Object.assign(r, { _k: k });
const dreams = k => (k.containment.list().dream || []).filter(d => d.hyp_status === 'quarantined');
const named = r => { expect(/simulation/.test(r.reply || '') && /counterfactual/.test(r.reply || '') && /speculative_branch/.test(r.reply || '') && /not a stored fact/.test(r.reply || '') && /not the status “verified_claim”/.test(r.reply || '') && /world/.test(r.reply || ''), r.reply); };
const packetAnswer = r => {
  expect(r.turn_packet.schema === 'FORGE-TURN-PACKET/v1' && r.turn_packet.packet_version === '4.9.111', r.turn_packet && r.turn_packet.packet_version);
  expect(r.turn_packet.receipt_type === 'answer', r.turn_packet && r.turn_packet.receipt_type);
  expect(r.turn_packet.containment && r.turn_packet.containment.route, 'containment');
  expect(cr(r) && cr(r).intent === 'SIMULATE' && cr(r).branch_id && !cr(r).failure && cr(r).claim_status === 'speculative_branch', JSON.stringify(cr(r)));
  expect(!String(r.reply || '').includes(cr(r).branch_id), 'spoke the branch id');
  expect((r.trace.msm_v1.preservation_classes || []).includes('action_proposal_simulation_and_observation'), JSON.stringify(r.trace.msm_v1 && r.trace.msm_v1.preservation_classes));
};









T('version, registry, CONFLICTS, and NEXT_BUILD name 4.9.122 and leave the next creative unstarted', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  const parts = ver.split('.').map(part => parseInt(part, 10));
  expect(parts[0] === 4 && parts[1] === 9 && parts[2] >= 122, ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver && reg.count === reg.features.length && reg.count >= 298, reg.version + ' ' + reg.count);
  for (const id of ['R4122-ISOLATE', 'R4122-SURFACE', 'R4122-EXIT']) {
    const f = reg.features.find(x => x.id === id);
    expect(f && (f.claim === 'Partial' || (f.claim === 'Out of scope / parked' && /Retired 4\.9\.215/.test(f.note)) /* 4.9.215 C4: parked when its proof was retired */) && (f.proof || []).includes('R4122') && /4\.9\.122/.test(f.note), id);
    expect(f && /Shared KB stays empty/.test(f.note) && !/proven cognition/.test(f.note), id + ' ' + (f && f.note));
  }
  const a11 = reg.features.find(x => x.id === 'A-11');
  expect(a11 && /4\.9\.122/.test(a11.note), a11 && a11.note);
  const tally = {}; for (const f of reg.features) tally[f.claim] = (tally[f.claim] || 0) + 1;
  expect(reg.claims.Implemented === 112 && reg.claims.Partial === tally.Partial + 1, JSON.stringify(reg.claims) + ' ' + tally.Partial);
  const cf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  const at = cf.lastIndexOf('## v4.9.122');
  expect(at > cf.lastIndexOf('## v4.9.121'), 'section');
  const sec = cf.slice(at);
  expect(/SIMULATE/.test(sec) && /counterfactual/.test(sec) && /0\.35/.test(sec) && /0\.80/.test(sec), 'bands');
  expect(/dream quarantine/.test(sec) && /shared KB stays empty|Shared KB stays empty/.test(sec), 'park');
  expect(/creative queue 120–122 complete|await Nic|do not start a new creative/i.test(sec) && !/proven cognition/.test(sec), 'queue');
  const prior = cf.slice(cf.lastIndexOf('## v4.9.121'), at);
  expect(/Suppose/.test(prior) && /not started|do not start/.test(prior), '121 history');
  const next = fs.readFileSync(ROOT + '/../NEXT_BUILD.md', 'utf8');
  expect(/4\.9\.122/.test(next) && /creative queue 120–122 complete/.test(next), 'NEXT_BUILD');
  expect(/Suppose/.test(next) && /not started|do not start/i.test(next), 'history');
  const readme = fs.readFileSync(ROOT + '/../README.md', 'utf8');
  expect(/4\.9\.122/.test(readme) && /simulation|counterfactual/.test(readme) && /speculative/.test(readme) && /0\.35/.test(readme), 'README');
  expect(!/failing-first|bot instruction/i.test(readme), 'README product');
  const targeted = JSON.parse(fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8'));
  const tp = String(targeted.release || '').split('.').map(part => parseInt(part, 10));
  expect(tp[0] === 4 && tp[1] === 9 && tp[2] >= 122 && targeted.suites.includes('r4122_suite.js') && targeted.suites.includes('r4121_suite.js'), targeted.release + ' ' + targeted.suites[0]);
  const RP = require(ROOT + '/src/req_packet.js');
  const slice = RP.packet('4.9.122');
  /* 4.9.215 (C4): the requirement is retired with the old JS answer path (only this version check was left), recorded with its reason. */
  expect((slice && slice.requirements.some(r => r.id === 'R4122-SUPPOSE')) || (RP.RETIRED_REQUIREMENTS || []).some(r => r.id === 'R4122-SUPPOSE' && r.release === '4.9.122' && r.why), JSON.stringify(slice && slice.requirements.map(r => r.id)));
  expect(RP.linksMissing(ROOT).length === 0, RP.linksMissing(ROOT).join(' '));
  expect(!fs.existsSync(ROOT + '/src/suppose.js'), 'suppose.js');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4122', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4122', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
