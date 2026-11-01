/* R4121 (4.9.121): COMPOSE governed LC narrative. Written FIRST.
 * A compose, write-out, or short-paragraph request narrates an admitted idea
 * or a selected MSM in more than one sentence. The paragraph exact-Echoes.
 * The source claim status stays the status it already has. Nothing is written
 * to memory, the world head, or the shared KB. Suppose is not this release. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [], rows = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-27T16:20:00Z';
const mk = extra => KMOD.Kernel(Object.assign({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK }, extra || {}));
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
const echoOk = r => {
  const e = r.trace.echo;
  expect(e && e.pass === true, (e && e.reason) || r.block_reason || r.reply);
  expect(e.score === 1 && e.theta === 1 && e.components && e.components.structural_identity === 1, JSON.stringify(e.components));
  expect(/structural round trip/.test(e.mode || '') && !/overlap|soft echo|word-overlap measure/.test(String(e.mode).replace('no word-overlap measure', '')), e.mode);
  expect(kRealize(r), 're-realize');
};
const kRealize = r => !r._k || r._k.realize(r.msm.meaning).text === r.reply;
const tag = (k, r) => Object.assign(r, { _k: k });
const sents = t => String(t || '').split(/(?<=[.?!])\s+/).filter(s => s.trim());
const plant = () => {
  const k = mk();
  expect(k.process('Remember that a spaniel is a dog.').trace.echo.pass, 'remember');
  expect(k.process('Remember that a dog is an animal.').trace.echo.pass, 'remember');
  const made = k.process('invent a hypothesis');
  expect(made.trace.intent_kind === 'CREATE' && made.trace.echo.pass, made.trace.intent_kind + ' · ' + made.reply);
  return k;
};
const explore = () => {
  const k = mk();
  k.process('Remember that Rex is a dog.');
  k.process('Remember that Fido is a dog.');
  k.process('Remember that a terrier is a hound.');
  k.process('Remember that a hound is a hunter.');
  const mem = k.memory();
  for (const row of mem) {
    if (!row.sfe) continue;
    const ent = (row.entities || []).join(' ');
    if (/rex|fido/.test(ent)) row.sfe.Phi = 3;
    else if (/terrier/.test(ent)) row.sfe.Phi = 4;
    else if (/hound/.test(ent) && /hunter/.test(ent)) row.sfe.Phi = 5;
  }
  k.store.save('memory', mem);
  const r = k.process('explore alternatives');
  expect(r.trace.intent_kind === 'EXPLORE' && r.trace.echo.pass, r.trace.intent_kind + ' · ' + r.reply);
  return k;
};








T('version, registry, CONFLICTS, and NEXT_BUILD name 4.9.121 and leave Suppose unstarted', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  const parts = ver.split('.').map(part => parseInt(part, 10));
  expect(parts[0] === 4 && parts[1] === 9 && parts[2] >= 121, ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver && reg.count === reg.features.length, reg.version + ' ' + reg.count);
  for (const id of ['R4121-INTENT', 'R4121-PROSE', 'R4121-CUSTODY']) {
    const f = reg.features.find(x => x.id === id);
    expect(f && (f.claim === 'Partial' || (f.claim === 'Out of scope / parked' && /Retired 4\.9\.215/.test(f.note)) /* 4.9.215 C4: parked when its proof was retired */) && (f.proof || []).includes('R4121') && /4\.9\.121/.test(f.note), id);
    expect(f && /Shared KB stays empty/.test(f.note) && !/proven cognition/.test(f.note), id + ' ' + (f && f.note));
  }
  const a11 = reg.features.find(x => x.id === 'A-11');
  expect(a11 && /4\.9\.120/.test(a11.note) && /4\.9\.121/.test(a11.note), a11 && a11.note);
  const tally = {}; for (const f of reg.features) tally[f.claim] = (tally[f.claim] || 0) + 1;
  expect(reg.claims.Implemented === 112 && reg.claims.Partial === tally.Partial + 1, JSON.stringify(reg.claims) + ' ' + tally.Partial);
  const cf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  const at = cf.lastIndexOf('## v4.9.121');
  expect(at > cf.lastIndexOf('## v4.9.120'), 'section');
  const sec = cf.slice(at);
  expect(/COMPOSE/.test(sec) && /0\.35/.test(sec) && /0\.80/.test(sec), 'bands');
  expect(/Suppose/.test(sec) && /not started|do not start/.test(sec), 'queue');
  expect(/Shared KB stays empty/.test(sec) && !/proven cognition/.test(sec), 'shared');
  const next = fs.readFileSync(ROOT + '/../NEXT_BUILD.md', 'utf8');
  expect(/4\.9\.121/.test(next) && /4\.9\.122/.test(next) && /Suppose/.test(next) && /not started|do not start/i.test(next), 'NEXT_BUILD');
  const readme = fs.readFileSync(ROOT + '/../README.md', 'utf8');
  expect(/4\.9\.121/.test(readme) && /paragraph/.test(readme) && /hypothesis/.test(readme) && /0\.35/.test(readme), 'README');
  expect(!/failing-first|bot instruction/i.test(readme), 'README product');
  const targeted = JSON.parse(fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8'));
  const tp = String(targeted.release || '').split('.').map(part => parseInt(part, 10));
  expect(tp[0] === 4 && tp[1] === 9 && tp[2] >= 121 && targeted.suites.includes('r4121_suite.js') && targeted.suites.includes('r4120_suite.js'), targeted.release + ' ' + targeted.suites[0]);
  const RP = require(ROOT + '/src/req_packet.js');
  const slice = RP.packet('4.9.121');
  /* 4.9.215 (C4): the requirement is retired with the old JS answer path (only this version check was left), recorded with its reason. */
  expect((slice && slice.requirements.some(r => r.id === 'R4121-COMPOSE')) || (RP.RETIRED_REQUIREMENTS || []).some(r => r.id === 'R4121-COMPOSE' && r.release === '4.9.121' && r.why), JSON.stringify(slice && slice.requirements.map(r => r.id)));
  expect(RP.linksMissing(ROOT).length === 0, RP.linksMissing(ROOT).join(' '));
  expect(!fs.existsSync(ROOT + '/src/compose.js'), 'compose.js');
  expect(!fs.existsSync(ROOT + '/src/suppose.js'), 'Suppose started');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4121', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4121', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
