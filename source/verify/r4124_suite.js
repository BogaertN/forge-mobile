/* R4124 (4.9.124): on-device starter confirmed seed. Written FIRST.
 * A fresh kernel carries a small confirmed starter pack so CREATE and COMPOSE
 * have anchors. Provenance is starter_pack. Clear starter knowledge removes it.
 * Remember stays person-authored. Creative paths do not write confirmed facts.
 * Import pack and a shared KB write are not this release. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const TP = require(ROOT + '/src/turn_packet.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [], rows = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-27T19:00:00Z';
const mk = extra => KMOD.Kernel(Object.assign({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK }, extra || {}));
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
const head = k => k.worldHead();
const sameHead = (k, h) => head(k).version_id === h.version_id && head(k).content_hash === h.content_hash;
const cr = r => r.turn_packet && r.turn_packet.creative;
const idsOf = k => (k.starterView().facts || []).map(f => f.id).join(',');
const quiet = (k, h, n) => {
  expect(k.memory().length === n, 'memory ' + k.memory().length);
  expect(sharedN(k) === 0, 'shared KB');
  expect(sameHead(k, h), 'world head moved');
};





T('version, registry, CONFLICTS, and NEXT_BUILD name 4.9.124 and leave import and a shared write unstarted', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  const parts = ver.split('.').map(part => parseInt(part, 10));
  expect(parts[0] === 4 && parts[1] === 9 && parts[2] >= 124, ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver && reg.count === reg.features.length && reg.count >= 304, reg.version + ' ' + reg.count);
  for (const id of ['R4124-SEED', 'R4124-CLEAR', 'R4124-PROV']) {
    const f = reg.features.find(x => x.id === id);
    expect(f && (f.claim === 'Partial' || (f.claim === 'Out of scope / parked' && /Retired 4\.9\.215/.test(f.note)) /* 4.9.215 C4: parked when its proof was retired */) && (f.proof || []).includes('R4124') && /4\.9\.124/.test(f.note), id);
    expect(f && /Shared KB stays empty/.test(f.note) && !/proven cognition/.test(f.note), id + ' ' + (f && f.note));
  }
  const a11 = reg.features.find(x => x.id === 'A-11');
  expect(a11 && /4\.9\.117/.test(a11.note) && /4\.9\.123/.test(a11.note) && /4\.9\.124/.test(a11.note), a11 && a11.note);
  const tally = {}; for (const f of reg.features) tally[f.claim] = (tally[f.claim] || 0) + 1;
  expect(reg.claims.Implemented === 112 && reg.claims.Partial === tally.Partial + 1, JSON.stringify(reg.claims) + ' ' + tally.Partial);
  const cf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  const at = cf.lastIndexOf('## v4.9.124');
  expect(at > cf.lastIndexOf('## v4.9.123'), 'section');
  const sec = cf.slice(at);
  expect(/starter_pack/.test(sec) && /Clear starter knowledge/.test(sec), 'seed');
  expect(/import pack/.test(sec) && /not started|do not start/.test(sec), 'import');
  expect(/shared KB write/.test(sec) && /not started|do not start/.test(sec), 'shared write');
  expect(/exact/.test(sec) && /Soft Echo/.test(sec) && !/proven cognition/.test(sec), 'echo');
  const prev = cf.slice(cf.lastIndexOf('## v4.9.123'), at);
  expect(/confirmed-facts design/.test(prev) && /not started|do not start/.test(prev), '4.9.123 design stays historical');
  const next = fs.readFileSync(ROOT + '/../NEXT_BUILD.md', 'utf8');
  expect(/4\.9\.124/.test(next) && /starter/.test(next) && /import pack/.test(next), 'NEXT_BUILD');
  expect(/not started|do not start/i.test(next) && /shared KB/i.test(next), 'queue');
  const readme = fs.readFileSync(ROOT + '/../README.md', 'utf8');
  expect(/4\.9\.124/.test(readme) && /starter_pack/.test(readme) && /4\.9\.123/.test(readme), 'README');
  expect(!/failing-first|bot instruction/i.test(readme), 'README product');
  const targeted = JSON.parse(fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8'));
  const tpRel = String(targeted.release || '').split('.').map(part => parseInt(part, 10));
  expect(tpRel[0] === 4 && tpRel[1] === 9 && tpRel[2] >= 124 && targeted.suites.includes('r4124_suite.js') && targeted.suites.includes('r4123_suite.js'), targeted.release + ' ' + targeted.suites[0]);
  const tp = fs.readFileSync(ROOT + '/src/turn_packet.js', 'utf8');
  expect(/PACKET_VERSION = '4\.9\.111'/.test(tp), 'packet_version');
  const RP = require(ROOT + '/src/req_packet.js');
  const slice = RP.packet('4.9.124');
  /* 4.9.215 (C4): the requirement is retired with the old JS answer path (only this version check was left), recorded with its reason. */
  expect((slice && slice.requirements.some(r => r.id === 'R4124-SEED')) || (RP.RETIRED_REQUIREMENTS || []).some(r => r.id === 'R4124-SEED' && r.release === '4.9.124' && r.why), JSON.stringify(slice && slice.requirements.map(r => r.id)));
  expect(RP.linksMissing(ROOT).length === 0, RP.linksMissing(ROOT).join(' '));
  expect(!fs.existsSync(ROOT + '/src/confirmed_facts.js'), 'confirmed_facts.js');
  expect(!fs.existsSync(ROOT + '/src/starter_import.js'), 'import pack started');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4124', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4124', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
