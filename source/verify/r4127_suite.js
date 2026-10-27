/* R4127 (4.9.127): gated confirmed_shared + letter-A pack. Written FIRST.
 * Distributed curated general facts land in confirmed_shared (not scrapbook shared_knowledge).
 * Hosted packs/confirmed_shared/a.json (FORGE-CONFIRMED-PACK/v1) admits on first open.
 * Invent/compose prefer memory > confirmed_shared > import > starter. Audit names confirmed_shared.
 * CREATE/COMPOSE/SIMULATE never auto-write confirmed. Soft budget unchanged; packs stay out of single-file. */
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
  expect(sharedN(k) === 0, 'shared knowledge');
  expect(sameHead(k, h), 'world head moved');
};
const PACK_DIR = path.join(ROOT, 'packs', 'confirmed_shared');
const letterA = () => fs.readFileSync(path.join(PACK_DIR, 'a.json'), 'utf8');
const SCHEMA = 'FORGE-CONFIRMED-PACK/v1';

T('hosted letter-A pack is FORGE-CONFIRMED-PACK/v1 with provenance confirmed_shared and LC-admissible items', () => {
  expect(fs.existsSync(path.join(PACK_DIR, 'a.json')), 'missing packs/confirmed_shared/a.json');
  expect(fs.existsSync(path.join(PACK_DIR, 'index.json')), 'missing index');
  const pack = JSON.parse(letterA());
  expect(pack.schema === SCHEMA || pack.format === SCHEMA, JSON.stringify({ schema: pack.schema, format: pack.format }));
  expect(pack.provenance === 'confirmed_shared', pack.provenance);
  expect(pack.who_confirmed === 'product_curator' || pack.who_confirmed === 'product curator', pack.who_confirmed);
  expect(pack.shared_kb !== true && pack.write_shared !== true, 'shared write flag');
  expect(Array.isArray(pack.items) && pack.items.length >= 40, 'items ' + (pack.items && pack.items.length));
  expect(pack.items.every(it => it && typeof it.text === 'string' && it.text && (it.standing === 'confirmed' || it.standing === 'projectable') && it.evidence), 'item shape');
  const ship = fs.readFileSync(ROOT + '/tools/shipset.js', 'utf8');
  expect(/packs\/confirmed_shared\/a\.json/.test(ship), 'shipset hosts a.json');
  expect(/packs\/confirmed_shared\/index\.json/.test(ship), 'shipset hosts index');
  const idx = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'index.json'), 'utf8'));
  expect(idx.provenance === 'confirmed_shared' && (idx.letters || []).includes('a') && (idx.letters || []).length === 26, JSON.stringify({ letters: (idx.letters || []).length, provenance: idx.provenance }));
  expect(/packs\/confirmed_shared\/z\.json/.test(ship), 'shipset hosts z.json');
});

T('product curator admit loads confirmed_shared without a user tap and leaves scrapbook empty', () => {
  const k = mk();
  const h = head(k);
  const starter = (k.starterView().facts || []).map(f => f.id).join(',');
  expect(typeof k.admitConfirmedShared === 'function' && typeof k.confirmedSharedView === 'function', 'api missing');
  const untappedImportStyle = k.admitConfirmedShared(letterA(), { userTap: false, productCurator: false });
  expect(untappedImportStyle.ok === false && untappedImportStyle.rule === 'PERM-NEEDS-USER-TAP', JSON.stringify(untappedImportStyle));
  const loaded = k.admitConfirmedShared(letterA(), { productCurator: true });
  expect(loaded.ok && loaded.receipt && loaded.receipt.schema === 'FORGE-IMPORT-RECEIPT/v1' && loaded.receipt.class === 'import' && loaded.receipt.shared_kb === false, JSON.stringify(loaded && loaded.receipt));
  expect((loaded.receipt.admitted || []).length >= 40, 'admitted ' + ((loaded.receipt && loaded.receipt.admitted) || []).length);
  const view = k.confirmedSharedView();
  expect(view.provenance === 'confirmed_shared' && view.admitted.length >= 40, JSON.stringify({ provenance: view.provenance, n: view.admitted.length }));
  expect(view.admitted.every(f => f.provenance === 'confirmed_shared'), 'row provenance');
  const raw = k.store.load('confirmed_shared');
  expect(raw && raw.provenance === 'confirmed_shared' && (raw.facts || []).every(f => f.provenance && f.provenance.source === 'confirmed_shared' && f.provenance.rule === 'CONFIRMED-SHARED'), 'store provenance');
  expect((k.starterView().facts || []).map(f => f.id).join(',') === starter, 'cleared starter');
  expect(k.importView().admitted.length === 0, 'touched import_pack');
  quiet(k, h, 0);
  const again = k.admitConfirmedShared(letterA(), { productCurator: true });
  expect(again.ok && again.view.admitted.length >= 40, 're-admit');
  quiet(k, h, 0);
});

T('invent and compose prefer confirmed_shared over starter and name confirmed pack, never shared KB', () => {
  const k = mk();
  k.clearStarterKnowledge();
  const h = head(k);
  expect(k.admitConfirmedShared(letterA(), { productCurator: true }).ok, 'admit');
  const r = k.process('invent a hypothesis');
  expect(r.trace.intent_kind === 'CREATE' && r.trace.echo.pass, r.trace.intent_kind + ' · ' + r.reply);
  expect(!cr(r).failure, JSON.stringify(cr(r) && cr(r).failure));
  const spoken = (cr(r).candidates || []).filter(c => c.spoken);
  expect(spoken.length === 1 && spoken[0].novelty.anchored === true && spoken[0].novelty.class === 'bounded', JSON.stringify(spoken));
  expect(/confirmed pack/.test(r.reply || '') && !/starter pack/.test(r.reply || '') && !/imported pack/.test(r.reply || ''), r.reply);
  expect(!/shared KB/i.test(r.reply || ''), r.reply);
  expect(/have not stored/.test(r.reply || ''), r.reply);
  expect(r.turn_packet.packet_version === '4.9.111', r.turn_packet && r.turn_packet.packet_version);
  const composed = k.process('compose that idea');
  expect(composed.trace.intent_kind === 'COMPOSE' && composed.trace.echo.pass, composed.trace.intent_kind + ' · ' + composed.reply);
  expect(/confirmed pack/i.test(composed.reply || '') && !/You told me/.test(composed.reply || '') && !/shared KB/i.test(composed.reply || ''), composed.reply);
  expect(/have not stored/.test(composed.reply || ''), composed.reply);
  quiet(k, h, 0);
});

T('user memory still wins over confirmed_shared; import stays available; scrapbook stays empty', () => {
  const k = mk();
  /* invent needs a short is-a chain; a lone bike/vehicle edge yields no spoken candidate */
  expect(k.process('Remember that a spaniel is a dog.').trace.echo.pass, 'remember spaniel');
  expect(k.process('Remember that a dog is an animal.').trace.echo.pass, 'remember dog');
  expect(k.admitConfirmedShared(letterA(), { productCurator: true }).ok, 'admit');
  const h = head(k);
  const r = k.process('invent a hypothesis');
  expect(r.trace.intent_kind === 'CREATE' && r.trace.echo.pass, r.reply);
  expect(!cr(r).failure, JSON.stringify(cr(r)));
  expect(/your facts/.test(r.reply || '') && !/confirmed pack/.test(r.reply || '') && !/starter pack/.test(r.reply || ''), r.reply);
  expect(k.memory().length === 2 && k.memory().every(m => m.provenance.source === 'user'), 'memory');
  expect(k.confirmedSharedView().admitted.length >= 40, 'confirmed cleared');
  quiet(k, h, 2);
  const packImport = JSON.stringify({ schema: SCHEMA, items: [{ text: 'a robin is a bird', standing: 'confirmed', evidence: 'a field guide' }] });
  expect(k.importConfirmedPack(packImport, { userTap: true }).ok, 'import still works');
  expect(k.importView().admitted.length >= 1 && k.confirmedSharedView().admitted.length >= 40, 'layers coexist');
  expect(sharedN(k) === 0, 'scrapbook');
});

T('CREATE COMPOSE SIMULATE never auto-write confirmed_shared and Clear confirmed shared works', () => {
  const k = mk();
  const h = head(k);
  expect(k.admitConfirmedShared(letterA(), { productCurator: true }).ok, 'admit');
  const before = k.confirmedSharedView().admitted.length;
  for (const phrase of ['invent a hypothesis', 'compose that idea', 'suppose a dog flies']) {
    const r = k.process(phrase);
    expect(r.trace.echo.pass || r.outcome, phrase + ' ' + (r.reply || ''));
    expect(k.confirmedSharedView().admitted.length === before, phrase + ' grew confirmed');
    expect(sharedN(k) === 0 && k.memory().length === 0, phrase + ' wrote scrapbook or memory');
  }
  expect(typeof k.clearConfirmedShared === 'function', 'clear api');
  const cleared = k.clearConfirmedShared();
  expect(cleared.admitted.length === 0 && cleared.provenance === 'confirmed_shared', JSON.stringify(cleared));
  expect(sharedN(k) === 0 && sameHead(k, h), 'clear wrote scrapbook or head');
  const unbound = k.process('invent a hypothesis');
  expect(unbound.trace.intent_kind === 'CREATE', unbound.trace.intent_kind);
  /* starter was still present unless cleared — clear only confirmed */
});

T('Audit census names confirmed_shared; Memory card never says shared KB; packs stay out of single-file budget', () => {
  const k = mk();
  expect(k.admitConfirmedShared(letterA(), { productCurator: true }).ok, 'admit');
  const panel = TP.categoryPanel(c => k.store.load(c));
  expect(/data-confirmed-shared/.test(panel) && /confirmed_shared/.test(panel), panel);
  expect(/Shared knowledge/.test(panel) && /empty/.test(panel), panel);
  expect(!/shared KB/i.test(panel), panel);
  const app = fs.readFileSync(ROOT + '/src/app.js', 'utf8');
  expect(/data-confirmed-shared/.test(app) && /confirmed_shared/.test(app), 'app card');
  expect(/packs\/confirmed_shared/.test(app) && /admitConfirmedShared|ensureConfirmedShared/.test(app), 'fetch wire');
  expect(!/shared KB/i.test(app.slice(Math.max(0, app.indexOf('confirmedShared') - 200), app.indexOf('confirmedShared') + 800) || ''), 'app shared KB label');
  const rel = fs.readFileSync(ROOT + '/tools/verify_release.js', 'utf8');
  const w5 = fs.readFileSync(ROOT + '/verify/w5_suite.js', 'utf8');
  expect(/1920000/.test(rel) && /570e3/.test(rel), 'budget');
  expect(/1920000/.test(w5) && /570e3/.test(w5), 'w5');
  const p = path.join(ROOT, '..', '_release', 'single', 'kernel-app.html');
  if (fs.existsSync(p)) {
    const b = fs.readFileSync(p);
    if (b.includes('4.9.127')) {
      const gz = zlib.gzipSync(b).length;
      expect(b.length <= 1920000 && gz <= 570000, b.length + ' / ' + gz);
      expect(!/packs\/confirmed_shared\/a\.json/.test(b.toString('utf8').slice(0, 5000)) || b.length < 3e6, 'pack not baked as main brain');
    }
  }
});

T('version, registry, CONFLICTS, and NEXT_BUILD name 4.9.127 and leave scrapbook shared write as next', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  expect(ver === '4.9.127', ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === '4.9.127' && reg.count === 313, JSON.stringify({ v: reg.version, c: reg.count }));
  const ids = ['R4127-GATE', 'R4127-LETTER-A', 'R4127-PROV'];
  for (const id of ids) {
    const f = reg.features.find(x => x.id === id);
    expect(f && f.claim === 'Partial' && /confirmed_shared|letter|Audit/i.test(f.name + ' ' + f.note), id);
  }
  const tally = {}; for (const f of reg.features) tally[f.claim] = (tally[f.claim] || 0) + 1;
  expect(reg.claims.Implemented === 112 && reg.claims.Partial === tally.Partial + 1, JSON.stringify(reg.claims) + ' ' + tally.Partial);
  const conf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  expect(/v4\.9\.127/.test(conf) && /confirmed_shared/.test(conf) && /letter A|letter-A|letter_a/i.test(conf), 'CONFLICTS');
  expect(/shared KB|shared-knowledge scrapbook|scrapbook/i.test(conf) && /empty|not started|stays empty/i.test(conf), 'scrapbook locked');
  const next = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.127/.test(next) && (/scrapbook|shared_knowledge|shared write/i.test(next)), 'NEXT_BUILD scrapbook next');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.127/.test(readme) && /confirmed_shared/.test(readme), 'README');
  const tgt = JSON.parse(fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8'));
  expect(tgt.release === '4.9.127' && tgt.suites[0] === 'r4127_suite.js', JSON.stringify(tgt));
  const req = fs.readFileSync(ROOT + '/src/req_packet.js', 'utf8');
  expect(/4\.9\.127/.test(req) && /R4127/.test(req), 'req_packet');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4127', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4127', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
