/* R4128 (4.9.128–4.9.154): hosted shared knowledge A–Z. Read for all (pull into session RAM).
 * Write needs Nic's write key. A–Z is NOT the on-phone DB product brain.
 * UI/Audit name shared knowledge base. Scrapbook stays empty. Soft budget unchanged. */
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
const quiet = (k, h, n) => {
  expect(k.memory().length === n, 'memory ' + k.memory().length);
  expect(sharedN(k) === 0, 'shared knowledge scrapbook');
  expect(sameHead(k, h), 'world head moved');
};
const PACK_DIR = path.join(ROOT, 'packs', 'confirmed_shared');
const letterA = () => fs.readFileSync(path.join(PACK_DIR, 'a.json'), 'utf8');
const SCHEMA = 'FORGE-CONFIRMED-PACK/v1';
const CURATOR_KEY = 'nic-shared-kb-write-key-4128';

T('hosted A-Z index and packs', () => {
  expect(fs.existsSync(path.join(PACK_DIR, 'index.json')), 'index');
  const idx = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'index.json'), 'utf8'));
  const parts = String(idx.version || '').split('.').map(Number);
  expect(parts[0] === 4 && parts[1] === 9 && parts[2] >= 128, 'version ' + idx.version);
  expect((idx.letters || []).length === 26, 'letters');
  expect(idx.provenance === 'confirmed_shared', 'prov');
  expect((idx.total_items || 0) >= 1890, 'total_items ' + idx.total_items);
  expect((idx.total_curated || 0) >= 2622, 'total_curated ' + idx.total_curated);
  let sum = 0;
  for (const L of idx.letters) {
    const p = JSON.parse(fs.readFileSync(path.join(PACK_DIR, L + '.json'), 'utf8'));
    expect(p.schema === SCHEMA || p.format === SCHEMA, L + ' schema');
    expect(p.provenance === 'confirmed_shared', L + ' prov');
    expect(Array.isArray(p.items) && p.items.length >= 40, L + ' items ' + (p.items && p.items.length));
    sum += p.items.length;
  }
  expect(sum === idx.total_items, 'sum ' + sum + ' vs ' + idx.total_items);
  const ship = fs.readFileSync(ROOT + '/tools/shipset.js', 'utf8');
  expect(/packs\/confirmed_shared\/index\.json/.test(ship) && /packs\/confirmed_shared\/z\.json/.test(ship), 'shipset');
});

T('pull hosted shared knowledge without write key; phone DB stays empty', () => {
  const k = mk();
  const h = head(k);
  expect(typeof k.pullHostedSharedPack === 'function' && typeof k.sharedKnowledgeView === 'function', 'api');
  const pulled = k.pullHostedSharedPack(letterA());
  expect(pulled.ok && pulled.view && pulled.view.hosted === true && pulled.view.phone_db === false, JSON.stringify(pulled && pulled.view));
  expect((pulled.view.admitted || []).length >= 40, 'admitted ' + ((pulled.view.admitted || []).length));
  expect(pulled.view.label === 'shared knowledge', pulled.view.label);
  const phone = k.store.load('confirmed_shared');
  expect(!phone || !Array.isArray(phone.facts) || phone.facts.length === 0, 'phone dump ' + JSON.stringify(phone && (phone.facts || []).length));
  expect(sharedN(k) === 0, 'scrapbook');
  quiet(k, h, 0);
});

T('write without key refuses; write with Nic key mutates session only', () => {
  const k = mk();
  const h = head(k);
  const noKey = k.admitConfirmedShared(letterA(), { productCurator: true });
  expect(noKey.ok === false && noKey.rule === 'SHARED-KB-WRITE-KEY-REQUIRED', JSON.stringify(noKey));
  const tapOnly = k.admitConfirmedShared(letterA(), { userTap: true });
  expect(tapOnly.ok === false && tapOnly.rule === 'SHARED-KB-WRITE-KEY-REQUIRED', JSON.stringify(tapOnly));
  const bare = k.writeSharedKnowledge(letterA(), {});
  expect(bare.ok === false && bare.rule === 'SHARED-KB-WRITE-KEY-REQUIRED', JSON.stringify(bare));
  expect(k.setSharedKbWriteKey(CURATOR_KEY).ok, 'set key');
  const wrote = k.writeSharedKnowledge(letterA(), { writeKey: CURATOR_KEY });
  expect(wrote.ok && (wrote.view.admitted || []).length >= 40, JSON.stringify(wrote && wrote.view));
  const phone = k.store.load('confirmed_shared');
  expect(!phone || !Array.isArray(phone.facts) || phone.facts.length === 0, 'write still not phone DB');
  k.clearSharedKbWriteKey();
  const again = k.writeSharedKnowledge(letterA(), { writeKey: CURATOR_KEY });
  expect(again.ok === false && again.rule === 'SHARED-KB-WRITE-KEY-REQUIRED', 'cleared key still gates');
  quiet(k, h, 0);
});

T('invent compose prefer hosted shared knowledge; speech names it', () => {
  const k = mk();
  k.clearStarterKnowledge();
  const h = head(k);
  expect(k.pullHostedSharedPack(letterA()).ok, 'pull');
  const r = k.process('invent a hypothesis');
  expect(r.trace.intent_kind === 'CREATE' && r.trace.echo.pass, r.trace.intent_kind + ' · ' + r.reply);
  expect(!cr(r).failure, JSON.stringify(cr(r) && cr(r).failure));
  const spoken = (cr(r).candidates || []).filter(c => c.spoken);
  expect(spoken.length === 1 && spoken[0].novelty.anchored === true && spoken[0].novelty.class === 'bounded', JSON.stringify(spoken));
  expect(/shared knowledge base/.test(r.reply || '') && !/starter pack/.test(r.reply || '') && !/imported pack/.test(r.reply || ''), r.reply);
  expect(/have not stored/.test(r.reply || ''), r.reply);
  const composed = k.process('compose that idea');
  expect(composed.trace.echo.pass || composed.outcome, composed.reply);
  expect(sharedN(k) === 0 && k.memory().length === 0, 'creative wrote');
  quiet(k, h, 0);
});

T('user memory wins; scrapbook empty; CREATE never auto-writes', () => {
  const k = mk();
  expect(k.process('Remember that a spaniel is a dog.').trace.echo.pass, 'remember spaniel');
  expect(k.process('Remember that a dog is an animal.').trace.echo.pass, 'remember dog');
  expect(k.pullHostedSharedPack(letterA()).ok, 'pull');
  const h = head(k);
  const before = k.sharedKnowledgeView().admitted.length;
  const r = k.process('invent a hypothesis');
  expect(r.trace.intent_kind === 'CREATE' && r.trace.echo.pass, r.reply);
  expect(/your facts/.test(r.reply || '') && !/shared knowledge base/.test(r.reply || ''), r.reply);
  for (const phrase of ['invent a hypothesis', 'compose that idea', 'suppose a dog flies']) {
    k.process(phrase);
    expect(k.sharedKnowledgeView().admitted.length === before, phrase + ' grew hosted');
    expect(sharedN(k) === 0, phrase + ' scrapbook');
  }
  quiet(k, h, 2);
});

T('Audit and UI name shared knowledge base; phone cache empty; budget', () => {
  const k = mk();
  expect(k.pullHostedSharedPack(letterA()).ok, 'pull');
  const load = c => k.store.load(c);
  load.host_shared_count = k.sharedKnowledgeView().count;
  const panel = TP.categoryPanel(load);
  expect(/data-shared-knowledge-hosted/.test(panel) && /Shared knowledge base/.test(panel), panel.slice(0, 500));
  expect(/Read for everyone/.test(panel) && /Write needs Nic/.test(panel), panel);
  expect(/Shared knowledge scrapbook/.test(panel) && /empty/.test(panel), panel);
  const app = fs.readFileSync(ROOT + '/src/app.js', 'utf8');
  expect(/Shared knowledge base/.test(app) && /pullHostedSharedPack/.test(app), 'app card');
  expect(/data-shared-knowledge-hosted/.test(app) && /not phone DB/.test(app), 'app hosted');
  expect(/ensureSharedKnowledge|ensureConfirmedShared/.test(app), 'fetch wire');
  const rel = fs.readFileSync(ROOT + '/tools/verify_release.js', 'utf8');
  const w5 = fs.readFileSync(ROOT + '/verify/w5_suite.js', 'utf8');
  expect(/1920000/.test(rel) && /570e3/.test(rel), 'budget');
  expect(/1920000/.test(w5) && /570e3/.test(w5), 'w5');
  const phone = k.store.load('confirmed_shared');
  expect(!phone || !(phone.facts || []).length, 'phone facts after pull');
});

T('version registry CONFLICTS NEXT_BUILD name 4.9.154', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  expect(ver === '4.9.154', ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver, reg.version);
  const ids = ['R4128-HOSTED', 'R4128-WRITE-KEY', 'R4128-AZ'];
  for (const id of ids) {
    const f = reg.features.find(x => x.id === id);
    expect(f && f.claim === 'Partial', id + ' ' + JSON.stringify(f));
  }
  const conf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  expect(/v4\.9\.12[89]|v4\.9\.13[0-9]|v4\.9\.14[0-9]|v4\.9\.15[01]/.test(conf) && /shared knowledge/i.test(conf) && /write key|WRITE-KEY/i.test(conf), 'CONFLICTS');
  expect(/hosted/i.test(conf) && /phone DB|on-phone|localStorage|IndexedDB/i.test(conf), 'hosted not phone');
  const next = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.12[89]|4\.9\.13[0-9]|4\.9\.14[0-9]|4\.9\.15[0-4]/.test(next), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.12[89]|4\.9\.13[0-9]|4\.9\.14[0-9]|4\.9\.15[0-4]/.test(readme) && /shared knowledge/i.test(readme), 'README');
  const tgt = JSON.parse(fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8'));
  expect(tgt.release === '4.9.154' && tgt.suites[0] === 'r4128_suite.js', JSON.stringify(tgt));
  const req = fs.readFileSync(ROOT + '/src/req_packet.js', 'utf8');
  expect(/4\.9\.12[89]|4\.9\.13[0-9]|4\.9\.14[0-9]|4\.9\.15[0-4]/.test(req) && /R4128/.test(req), 'req_packet');
  const briefPath = '/workspace/kernel-papers/oct25/BRIEF_4.9.128_SHARED_KB_AZ.md';
  if (fs.existsSync(briefPath)) {
    const brief = fs.readFileSync(briefPath, 'utf8');
    expect(/write key|read-for-all|read for/i.test(brief) && /not.*on-phone|does not belong in the on-phone/i.test(brief), 'BRIEF');
  }
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4128', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4128', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
