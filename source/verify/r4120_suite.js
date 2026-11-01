/* R4120 (4.9.120): CREATE and EXPLORE novelty-banded ideas. Written FIRST.
 * A creative candidate carries novelty N and drift. Novelty without a memory
 * anchor is unbound and is not a discovery claim. A quarantine-band idea may
 * be spoken as a hypothesis or a speculative branch. A tap is the only commit,
 * and that commit is an idea record: memory, the world head, and the shared KB
 * stay unchanged. COMPOSE and Suppose are not this release. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const MEAP = require(ROOT + '/src/mea_p.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [], rows = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-27T16:20:00Z';
const mk = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK });
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
const head = k => k.worldHead();
const sameHead = (k, h) => head(k).version_id === h.version_id && head(k).content_hash === h.content_hash;
const DISCOVERY = ['verified_claim', 'derived_claim', 'resolved_manifest', 'named_concept'];
const cr = r => r.turn_packet && r.turn_packet.creative;
const quietStores = (k, h, n, why) => {
  expect(k.memory().length === n, why || ('memory ' + k.memory().length));
  expect(sharedN(k) === 0, 'shared KB');
  expect(sameHead(k, h), 'world head moved');
  expect(!(k.store.load('drift_archive') || []).length, 'drift archive');
  expect(!(k.store.load('ede_calibration') || []).length, 'ede calibration');
};

T('novelty without anchors is unbound and not a discovery claim', () => {
  expect(typeof MEAP.creativeScreen === 'function', 'creativeScreen missing');
  const s = MEAP.creativeScreen({ anchors: 0, retained: [], archived: [], rejected: [] }, { intent: 'CREATE' });
  expect(s.failure && s.failure.class === 'novelty_unbound', JSON.stringify(s.failure));
  expect(s.candidates.length === 1 && s.candidates[0].novelty.class === 'unbound' && s.candidates[0].novelty.N == null && s.candidates[0].novelty.anchored === false, JSON.stringify(s.candidates));
  expect(!s.candidates.some(c => DISCOVERY.includes(c.claim_status)), JSON.stringify(s.candidates.map(c => c.claim_status)));
  expect(!s.speak.length && s.candidates.every(c => c.spoken === false), 'unbound was spoken');
  const hard = MEAP.creativeScreen({ anchors: 1, retained: [], archived: [{ branch_id: 'b_hard', creation_operator: 'adjacent_synthesis', claim: { subject: 'thing:a', relation: 'isa', object: 'thing:b' }, anchor_ids: ['m1'], novelty: { N: 0.5 }, drift: { eps_s: 0.9 } }], rejected: [] }, { intent: 'CREATE' });
  expect(hard.failure && hard.failure.class === 'drift_hard' && hard.candidates.every(c => c.spoken === false) && hard.candidates[0].drift.band === 'reject', JSON.stringify(hard));
});






T('version, registry, CONFLICTS, and NEXT_BUILD name 4.9.120 and leave COMPOSE and Suppose unstarted', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  const parts = ver.split('.').map(part => parseInt(part, 10));
  expect(parts[0] === 4 && parts[1] === 9 && parts[2] >= 120, ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver && reg.count === reg.features.length, reg.version + ' ' + reg.count);
  for (const id of ['R4120-INTENT', 'R4120-NOVELTY', 'R4120-QUARANTINE']) {
    const f = reg.features.find(x => x.id === id);
    expect(f && f.claim === 'Partial' && (f.proof || []).includes('R4120') && /4\.9\.120/.test(f.note), id);
    expect(f && /shared KB stays empty|Shared KB stays empty/.test(f.note) && !/proven cognition/.test(f.note), id + ' ' + (f && f.note));
  }
  const a11 = reg.features.find(x => x.id === 'A-11');
  expect(a11 && /4\.9\.117/.test(a11.note) && /4\.9\.118/.test(a11.note) && /4\.9\.119/.test(a11.note) && /4\.9\.120/.test(a11.note), a11 && a11.note);
  const tally = {}; for (const f of reg.features) tally[f.claim] = (tally[f.claim] || 0) + 1;
  expect(reg.claims.Implemented === 112 && reg.claims.Partial === tally.Partial + 1, JSON.stringify(reg.claims) + ' ' + tally.Partial);
  const cf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  const at = cf.lastIndexOf('## v4.9.120');
  expect(at > cf.lastIndexOf('## v4.9.119'), 'section');
  const sec = cf.slice(at);
  expect(/CREATE/.test(sec) && /EXPLORE/.test(sec) && /0\.35/.test(sec) && /0\.80/.test(sec), 'bands');
  expect(/COMPOSE/.test(sec) && /Suppose/.test(sec) && /not started|do not start/.test(sec), 'queue');
  expect(/shared KB stays empty|Shared KB stays empty/.test(sec), 'shared');
  const next = fs.readFileSync(ROOT + '/../NEXT_BUILD.md', 'utf8');
  expect(/4\.9\.120/.test(next) && /4\.9\.121/.test(next) && /COMPOSE/.test(next) && /Suppose/.test(next) && /not started|do not start/i.test(next), 'NEXT_BUILD');
  const readme = fs.readFileSync(ROOT + '/../README.md', 'utf8');
  expect(/4\.9\.120/.test(readme) && /hypothesis/.test(readme) && /0\.35/.test(readme), 'README');
  expect(!/failing-first|bot instruction/i.test(readme), 'README product');
  const targeted = JSON.parse(fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8'));
  const tp = String(targeted.release || '').split('.').map(part => parseInt(part, 10));
  expect(tp[0] === 4 && tp[1] === 9 && tp[2] >= 120 && targeted.suites.includes('r4120_suite.js') && targeted.suites.includes('r4119_suite.js'), targeted.release + ' ' + targeted.suites[0]);
  const RP = require(ROOT + '/src/req_packet.js');
  const slice = RP.packet('4.9.120');
  /* 4.9.215 (C4): the requirement is retired with the old JS answer path (only this version check was left), recorded with its reason. */
  expect((slice && slice.requirements.some(r => r.id === 'R4120-IDEA')) || (RP.RETIRED_REQUIREMENTS || []).some(r => r.id === 'R4120-IDEA' && r.release === '4.9.120' && r.why), JSON.stringify(slice && slice.requirements.map(r => r.id)));
  expect(RP.linksMissing(ROOT).length === 0, RP.linksMissing(ROOT).join(' '));
  expect(!fs.existsSync(ROOT + '/src/creative.js'), 'creative.js');
  expect(!fs.existsSync(ROOT + '/src/compose.js'), 'COMPOSE started');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4120', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4120', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
