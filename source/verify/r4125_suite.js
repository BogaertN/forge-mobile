/* R4125 (4.9.125): importable confirmed pack. Written FIRST.
 * A person can load extra confirmed facts from a file or a paste.
 * Confirmed items are admitted. Contested items stay held until a tap.
 * A bad pack is a typed refusal. Import does not write shared knowledge,
 * and it does not clear starter knowledge or Remember unless asked. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const TP = require(ROOT + '/src/turn_packet.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [], rows = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-27T20:00:00Z';
const mk = extra => KMOD.Kernel(Object.assign({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK }, extra || {}));
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
const head = k => k.worldHead();
const sameHead = (k, h) => head(k).version_id === h.version_id && head(k).content_hash === h.content_hash;
const cr = r => r.turn_packet && r.turn_packet.creative;
const idsOf = k => (k.starterView().facts || []).map(f => f.id).join(',');
const admittedIds = k => (k.importView().admitted || []).map(f => f.id).join(',');
const SCHEMA = 'FORGE-CONFIRMED-PACK/v1';
const item = (text, standing, evidence) => ({ text, standing, evidence });
const packOf = (items, extra) => JSON.stringify(Object.assign({ schema: SCHEMA, items }, extra || {}));
const GOOD = packOf([
  item('a robin is a bird', 'confirmed', 'a field guide names the robin as a bird'),
  item('a bird is an animal', 'projectable', 'the same note names a bird as an animal')
]);
const MIXED = packOf([
  item('a robin is a bird', 'confirmed', 'a field guide names the robin as a bird'),
  item('a bird is an animal', 'confirmed', 'the same note names a bird as an animal'),
  item('a whale is a fish', 'contested', 'an old textbook calls a whale a fish')
]);
const HELD = packOf([
  item('a whale is a fish', 'quarantine', 'an old textbook calls a whale a fish'),
  item('a fish is an animal', 'contested', 'the same textbook calls a fish an animal')
]);
const quiet = (k, h, n) => {
  expect(k.memory().length === n, 'memory ' + k.memory().length);
  expect(sharedN(k) === 0, 'shared knowledge');
  expect(sameHead(k, h), 'world head moved');
};



T('a bad pack refuses with a typed receipt and writes no anchor', () => {
  const k = mk();
  const starter = idsOf(k);
  const h = head(k);
  const seeded = k.importConfirmedPack(GOOD, { userTap: true });
  expect(seeded.ok && seeded.view.admitted.length === 2, 'seed');
  const before = admittedIds(k);
  const cases = [
    ['not a pack', 'not_json'],
    [JSON.stringify({ schema: 'FORGE-SHARED-KB/v1', items: [item('a robin is a bird', 'confirmed', 'a note')] }), 'schema'],
    [packOf([]), 'empty'],
    [packOf([item('zzzz qqqq', 'confirmed', 'a note that does not parse')]), 'unparsed'],
    [packOf([item('a robin is a bird', 'confirmed', '')]), 'evidence'],
    [packOf([item('a robin is a bird', 'maybe', 'a note')]), 'standing'],
    [packOf([item('a robin is a bird', 'confirmed', 'a note'), item('a robin is a bird', 'confirmed', 'a note')]), 'duplicate'],
    [packOf([item('a crow is a bird', 'confirmed', 'a note')], { shared_kb: true }), 'shared_write']
  ];
  for (const [text, reason] of cases) {
    const preview = k.previewImport(text);
    expect(preview.ok === false && preview.class === 'refused' && preview.reason === reason, reason + ' preview ' + JSON.stringify(preview));
    const r = k.importConfirmedPack(text, { userTap: true });
    expect(r.ok === false && r.receipt && r.receipt.schema === 'FORGE-IMPORT-RECEIPT/v1' && r.receipt.class === 'refused' && r.receipt.reason === reason && r.receipt.shared_kb === false, reason + ' ' + JSON.stringify(r && r.receipt));
    expect(admittedIds(k) === before, reason + ' changed admitted anchors');
    expect(idsOf(k) === starter && k.memory().length === 0 && sharedN(k) === 0, reason + ' wrote memory or starter or shared knowledge');
  }
  const panel = TP.categoryPanel(c => k.store.load(c));
  expect(/data-import-pack/.test(panel) && /import_pack/.test(panel) && /data-import-receipt/.test(panel), panel);
  expect(/refused/.test(panel) && /shared_write/.test(panel), panel);
  expect(/Shared knowledge/.test(panel) && /empty/.test(panel), panel);
  expect(!/shared KB/i.test(panel), panel);
  quiet(k, h, 0);
  expect(k.starterView().status === 'present', 'a refusal cleared the starter pack');
});



T('Audit shows the import receipt and the Memory screen has Import next to starter', () => {
  const k = mk();
  k.importConfirmedPack(MIXED, { userTap: true });
  const panel = TP.categoryPanel(c => k.store.load(c));
  expect(/data-import-pack/.test(panel) && /import_pack/.test(panel) && /Admitted/.test(panel) && /Held for tap/.test(panel), panel);
  expect(/data-import-receipt/.test(panel) && /data-starter-pack/.test(panel), panel);
  expect(/Shared knowledge/.test(panel) && /empty/.test(panel) && !/shared KB/i.test(panel), panel);
  const app = fs.readFileSync(ROOT + '/src/app.js', 'utf8');
  const mem = app.slice(app.indexOf('function importCard'), app.indexOf('function renderMem'));
  expect(/id="importPack"/.test(mem) && /id="importPaste"/.test(mem) && /id="importFile"/.test(mem) && /type="file"/.test(mem), mem.slice(0, 500));
  expect(/Held for tap/.test(mem) && /data-import-admit/.test(mem) && /id="clearImport"/.test(mem) && /Clear import/.test(mem), 'import controls');
  expect(/data-import-pack/.test(mem) && /data-starter-pack/.test(mem) && /id="clearStarter"/.test(mem) && /Clear starter knowledge/.test(mem), 'starter stays beside import');
  expect(/starterCard\(\) \+ (?:confirmedSharedCard\(\) \+ )?importCard\(\)/.test(app), 'import card is not next to starter');
  expect(!/shared KB/i.test(mem), mem.slice(0, 400));
});

T('the single-file budget stays within 2.500 MB raw and 750 kB gzip', () => {
  const rel = fs.readFileSync(ROOT + '/tools/verify_release.js', 'utf8');
  const w5 = fs.readFileSync(ROOT + '/verify/w5_suite.js', 'utf8');
  expect(/2500000/.test(rel) && /750e3/.test(rel), 'release budget moved');
  expect(/2500000/.test(w5) && /750e3/.test(w5), 'w5 budget moved');
  const p = path.join(ROOT, '..', '_release', 'single', 'kernel-app.html');
  if (!fs.existsSync(p)) return;
  const b = fs.readFileSync(p);
  if (!b.includes('4.9.125')) return;
  const gz = zlib.gzipSync(b).length;
  expect(b.length <= 2500000 && gz <= 750000, b.length + ' / ' + gz);
});

T('version, registry, CONFLICTS, and NEXT_BUILD name 4.9.125 and leave a shared write unstarted', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  const parts = ver.split('.').map(part => parseInt(part, 10));
  expect(parts[0] === 4 && parts[1] === 9 && parts[2] >= 125, ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver && reg.count === reg.features.length && reg.count >= 307, reg.version + ' ' + reg.count);
  for (const id of ['R4125-ADMIT', 'R4125-HOLD', 'R4125-QUIET']) {
    const f = reg.features.find(x => x.id === id);
    expect(f && f.claim === 'Partial' && (f.proof || []).includes('R4125') && /4\.9\.125/.test(f.note), id);
    expect(f && /Shared KB stays empty/.test(f.note) && !/proven cognition/.test(f.note), id + ' ' + (f && f.note));
  }
  const a11 = reg.features.find(x => x.id === 'A-11');
  expect(a11 && /4\.9\.124/.test(a11.note) && /4\.9\.125/.test(a11.note), a11 && a11.note);
  const tally = {}; for (const f of reg.features) tally[f.claim] = (tally[f.claim] || 0) + 1;
  expect(reg.claims.Implemented === 112 && reg.claims.Partial === tally.Partial + 1, JSON.stringify(reg.claims) + ' ' + tally.Partial);
  const cf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  const at = cf.lastIndexOf('## v4.9.125');
  expect(at > cf.lastIndexOf('## v4.9.124'), 'section');
  const sec = cf.slice(at);
  expect(/FORGE-CONFIRMED-PACK\/v1/.test(sec) && /import_pack/.test(sec) && /Held for tap|held until/.test(sec), 'pack');
  expect(/shared KB write/.test(sec) && /not started|do not start/.test(sec), 'shared write');
  expect(/exact/.test(sec) && /Soft Echo/.test(sec) && !/proven cognition/.test(sec), 'echo');
  expect(!/Option C/.test(sec), 'option c named');
  const prev = cf.slice(cf.lastIndexOf('## v4.9.124'), at);
  expect(/import pack/.test(prev) && /not started|do not start/.test(prev), '4.9.124 import stays historical');
  const next = fs.readFileSync(ROOT + '/../NEXT_BUILD.md', 'utf8');
  expect(/4\.9\.125/.test(next) && /import/.test(next) && /shared KB/i.test(next), 'NEXT_BUILD');
  expect(/not started|do not start/i.test(next), 'queue');
  const readme = fs.readFileSync(ROOT + '/../README.md', 'utf8');
  expect(/4\.9\.125/.test(readme) && /import_pack/.test(readme) && /4\.9\.124/.test(readme), 'README');
  expect(!/failing-first|bot instruction/i.test(readme), 'README product');
  expect(!/shared KB/i.test(readme.slice(0, 900)), 'README names a shared KB');
  const targeted = JSON.parse(fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8'));
  const tpRel = String(targeted.release || '').split('.').map(part => parseInt(part, 10));
  expect(tpRel[0] === 4 && tpRel[1] === 9 && tpRel[2] >= 125 && targeted.suites.includes('r4125_suite.js') && targeted.suites.includes('r4124_suite.js'), targeted.release + ' ' + targeted.suites[0]);
  const tp = fs.readFileSync(ROOT + '/src/turn_packet.js', 'utf8');
  expect(/PACKET_VERSION = '4\.9\.111'/.test(tp), 'packet_version');
  const RP = require(ROOT + '/src/req_packet.js');
  const slice = RP.packet('4.9.125');
  expect(slice && slice.requirements.some(r => r.id === 'R4125-IMPORT'), JSON.stringify(slice && slice.requirements.map(r => r.id)));
  expect(RP.linksMissing(ROOT).length === 0, RP.linksMissing(ROOT).join(' '));
  expect(!fs.existsSync(ROOT + '/src/confirmed_facts.js'), 'confirmed_facts.js');
  expect(!fs.existsSync(ROOT + '/src/starter_import.js'), 'starter_import.js');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4125', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4125', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
