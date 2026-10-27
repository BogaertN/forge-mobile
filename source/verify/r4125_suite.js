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

T('a valid pack admits confirmed anchors and leaves starter and remembered facts in place', () => {
  const k = mk();
  const remembered = k.process('Remember that a bike is a vehicle.');
  expect(remembered.trace.echo.pass && remembered.trace.intent_kind === 'REQUEST_COMMIT', remembered.trace.intent_kind + ' · ' + remembered.reply);
  const row = k.memory().find(r => r.kind !== 'note');
  expect(row && row.provenance && row.provenance.source === 'user' && row.provenance.rule === 'AUTH-EXPLICIT-REMEMBER', JSON.stringify(row && row.provenance));
  const starter = idsOf(k);
  expect(k.starterView().status === 'present' && starter.length > 0, 'starter missing');
  const h = head(k);
  const preview = k.previewImport(MIXED);
  expect(preview.ok && preview.class === 'import' && preview.admitted.some(t => /robin/i.test(t)) && preview.held.some(t => /whale/i.test(t)), JSON.stringify(preview));
  expect(/admit/i.test(preview.plain || '') && /held/i.test(preview.plain || ''), preview.plain);
  expect(admittedIds(k) === '' && !(k.importView().held || []).length, 'preview wrote the pack');
  const untapped = k.importConfirmedPack(MIXED, { userTap: false });
  expect(untapped.ok === false && untapped.rule === 'PERM-NEEDS-USER-TAP' && untapped.receipt && untapped.receipt.class === 'refused' && untapped.receipt.reason === 'needs_tap' && untapped.receipt.shared_kb === false, JSON.stringify(untapped));
  expect(admittedIds(k) === '', 'a tap-less import admitted a fact');
  const sneaky = packOf([item('a robin is a bird', 'confirmed', 'a field guide names the robin as a bird')], { wipe_starter: true, wipe_memory: true, shared_kb: false });
  const loaded = k.importConfirmedPack(sneaky, { userTap: true });
  expect(loaded.ok && loaded.receipt && loaded.receipt.schema === 'FORGE-IMPORT-RECEIPT/v1' && loaded.receipt.class === 'import' && loaded.receipt.shared_kb === false, JSON.stringify(loaded && loaded.receipt));
  expect(loaded.receipt.admitted.some(t => /robin/i.test(t)) && !(loaded.receipt.held || []).length, JSON.stringify(loaded.receipt));
  const view = k.importView();
  expect(view.provenance === 'import_pack' && view.admitted.length === 1 && view.admitted[0].provenance === 'import_pack', JSON.stringify(view));
  expect(/robin/i.test(view.admitted[0].text) && /field guide/.test(view.admitted[0].evidence || ''), JSON.stringify(view.admitted[0]));
  const raw = k.store.load('import_pack');
  expect(raw && raw.schema === SCHEMA && raw.provenance === 'import_pack', JSON.stringify(raw && raw.schema));
  expect((raw.facts || []).every(f => f.provenance && f.provenance.source === 'import_pack' && f.provenance.rule === 'IMPORT-PACK' && f.status === 'active'), 'fact provenance');
  expect(idsOf(k) === starter, 'import cleared the starter pack');
  expect(k.memory().length === 1 && k.memory()[0].provenance.source === 'user', 'import rewrote Remember');
  quiet(k, h, 1);
  const again = k.importConfirmedPack(GOOD, { userTap: true });
  expect(again.ok && again.view.admitted.length >= 2 && idsOf(k) === starter && k.memory().length === 1, JSON.stringify(again.view && again.view.admitted));
  quiet(k, h, 1);
});

T('a contested import stays held until a tap admits it', () => {
  const k = mk();
  k.clearStarterKnowledge();
  const h = head(k);
  const loaded = k.importConfirmedPack(HELD, { userTap: true });
  expect(loaded.ok && loaded.receipt.held.length === 2 && !(loaded.receipt.admitted || []).length, JSON.stringify(loaded.receipt));
  const view = k.importView();
  expect(view.admitted.length === 0 && view.held.length === 2, JSON.stringify(view));
  expect(view.held.every(f => /whale|fish|animal/i.test(f.text) && f.evidence), JSON.stringify(view.held));
  const unbound = k.process('invent a hypothesis');
  expect(unbound.trace.intent_kind === 'CREATE' && unbound.trace.echo.pass, unbound.trace.intent_kind + ' · ' + unbound.reply);
  expect(cr(unbound) && cr(unbound).failure && cr(unbound).failure.class === 'novelty_unbound', JSON.stringify(cr(unbound)));
  expect(k.importView().held.length === 2 && k.importView().admitted.length === 0, 'invent admitted a held fact');
  const id = view.held[0].id;
  const missed = k.admitImportItem(id, false);
  expect(missed.ok === false && missed.rule === 'PERM-NEEDS-USER-TAP', JSON.stringify(missed));
  expect(k.importView().held.some(f => f.id === id) && k.importView().admitted.length === 0, 'a tap-less admit projected the fact');
  const one = k.admitImportItem(id, true);
  expect(one.ok && one.receipt && one.receipt.class === 'admit' && one.receipt.shared_kb === false && one.receipt.admitted.length === 1, JSON.stringify(one.receipt));
  expect(k.importView().admitted.length === 1 && k.importView().held.length === 1, JSON.stringify(k.importView()));
  expect(k.importView().admitted[0].provenance === 'import_pack', JSON.stringify(k.importView().admitted[0]));
  const other = view.held[1].id;
  expect(k.admitImportItem(other, true).ok, 'second tap');
  expect(k.importView().held.length === 0 && k.importView().admitted.length === 2, JSON.stringify(k.importView()));
  const anchored = k.process('invent a hypothesis');
  expect(anchored.trace.intent_kind === 'CREATE' && anchored.trace.echo.pass, anchored.trace.intent_kind + ' · ' + anchored.reply);
  expect(!cr(anchored).failure, JSON.stringify(cr(anchored) && cr(anchored).failure));
  const spoken = (cr(anchored).candidates || []).filter(c => c.spoken);
  expect(spoken.length === 1 && spoken[0].novelty.anchored === true && spoken[0].novelty.class === 'bounded', JSON.stringify(spoken));
  expect(/whale|fish|animal/i.test(spoken[0].claim), spoken[0].claim);
  expect(/imported pack/.test(anchored.reply || '') && /have not stored/.test(anchored.reply || ''), anchored.reply);
  expect(k.importView().admitted.length === 2, 'invent wrote another confirmed fact');
  quiet(k, h, 0);
  expect(k.starterView().status === 'cleared', 'the tap restored the starter pack');
});

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

T('invent and compose use a newly admitted import anchor', () => {
  const k = mk();
  const starter = idsOf(k);
  const h = head(k);
  expect(k.importConfirmedPack(GOOD, { userTap: true }).ok, 'import');
  const r = k.process('invent a hypothesis');
  expect(r.trace.intent_kind === 'CREATE' && r.trace.echo.pass, r.trace.intent_kind + ' · ' + r.reply);
  expect(!cr(r).failure, JSON.stringify(cr(r) && cr(r).failure));
  const spoken = (cr(r).candidates || []).filter(c => c.spoken);
  expect(spoken.length === 1 && spoken[0].novelty.anchored === true && spoken[0].novelty.class === 'bounded', JSON.stringify(spoken));
  expect(/robin/.test(spoken[0].claim) && /animal/.test(spoken[0].claim), spoken[0].claim);
  expect(/imported pack/.test(r.reply || '') && !/starter pack/.test(r.reply || '') && /have not stored/.test(r.reply || ''), r.reply);
  expect(r.turn_packet.packet_version === '4.9.111' && r.turn_packet.schema === 'FORGE-TURN-PACKET/v1', r.turn_packet && r.turn_packet.packet_version);
  const composed = k.process('compose that idea');
  expect(composed.trace.intent_kind === 'COMPOSE' && composed.trace.echo.pass, composed.trace.intent_kind + ' · ' + composed.reply);
  expect(/imported pack/i.test(composed.reply || '') && !/You told me/.test(composed.reply || '') && !/starter pack/i.test(composed.reply || ''), composed.reply);
  expect(/robin/i.test(composed.reply || '') && /animal/i.test(composed.reply || ''), composed.reply);
  expect(/have not stored/.test(composed.reply || '') && /hypothesis/.test(composed.reply || ''), composed.reply);
  expect(composed.turn_packet.packet_version === '4.9.111', composed.turn_packet && composed.turn_packet.packet_version);
  expect(idsOf(k) === starter && admittedIds(k).split(',').filter(Boolean).length === 2, 'compose wrote confirmed facts');
  quiet(k, h, 0);
});

T('create compose and simulate do not store confirmed facts and Clear starter still works', () => {
  const kept = mk();
  const remembered = kept.process('Remember that a bike is a vehicle.');
  expect(remembered.trace.echo.pass, remembered.reply);
  const h = head(kept);
  const starter = idsOf(kept);
  expect(kept.importConfirmedPack(GOOD, { userTap: true }).ok, 'import');
  const imported = admittedIds(kept);
  kept.process('invent a hypothesis');
  kept.process('compose that idea');
  kept.process('suppose a story where a cat is a bird');
  kept.process('research dogs');
  expect(admittedIds(kept) === imported, 'a creative path wrote a confirmed fact');
  expect(idsOf(kept) === starter && kept.memory().length === 1 && kept.memory()[0].provenance.source === 'user', 'a creative path rewrote starter or Remember');
  quiet(kept, h, 1);
  kept.clearStarterKnowledge();
  expect(kept.starterView().status === 'cleared' && admittedIds(kept) === imported && kept.memory().length === 1, 'Clear starter touched the import or Remember');
  expect(sameHead(kept, h) && sharedN(kept) === 0, 'Clear starter moved the world or shared knowledge');
  const still = kept.process('invent a hypothesis');
  expect(still.trace.echo.pass && !cr(still).failure && /imported pack/.test(still.reply || ''), still.reply);
  const cleared = kept.clearImportPack();
  expect(!(cleared.admitted || []).length && !(cleared.held || []).length && kept.starterView().status === 'cleared', JSON.stringify(cleared));
  expect(kept.memory().length === 1 && sharedN(kept) === 0 && sameHead(kept, h), 'Clear import touched Remember or the world');
  const unbound = kept.process('invent a hypothesis');
  expect(unbound.trace.intent_kind === 'CREATE' && unbound.trace.echo.pass, unbound.trace.intent_kind + ' · ' + unbound.reply);
  expect(!/imported pack|starter pack/.test(unbound.reply || ''), unbound.reply);
  expect(admittedIds(kept) === '' && kept.starterView().status === 'cleared' && kept.memory().length === 1, 'invent restored a pack');
  quiet(kept, h, 1);
  const explicit = mk();
  explicit.process('Remember that a bike is a vehicle.');
  const eh = head(explicit);
  expect(explicit.importConfirmedPack(GOOD, { userTap: true, wipeStarter: true }).ok, 'explicit clear');
  expect(explicit.starterView().status === 'cleared' && explicit.memory().length === 1 && explicit.importView().admitted.length === 2, 'explicit starter clear wiped Remember or skipped the import');
  expect(sameHead(explicit, eh) && sharedN(explicit) === 0, 'explicit clear moved the world');
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
  expect(/starterCard\(\) \+ importCard\(\)/.test(app), 'import card is not next to starter');
  expect(!/shared KB/i.test(mem), mem.slice(0, 400));
});

T('the single-file budget stays within 1.920 MB raw and 570 kB gzip', () => {
  const rel = fs.readFileSync(ROOT + '/tools/verify_release.js', 'utf8');
  const w5 = fs.readFileSync(ROOT + '/verify/w5_suite.js', 'utf8');
  expect(/1920000/.test(rel) && /570e3/.test(rel), 'release budget moved');
  expect(/1920000/.test(w5) && /570e3/.test(w5), 'w5 budget moved');
  const p = path.join(ROOT, '..', '_release', 'single', 'kernel-app.html');
  if (!fs.existsSync(p)) return;
  const b = fs.readFileSync(p);
  if (!b.includes('4.9.125')) return;
  const gz = zlib.gzipSync(b).length;
  expect(b.length <= 1920000 && gz <= 570000, b.length + ' / ' + gz);
});

T('version, registry, CONFLICTS, and NEXT_BUILD name 4.9.125 and leave a shared write unstarted', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  const parts = ver.split('.').map(Number);
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
  const tpRel = String(targeted.release || '').split('.').map(Number);
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
