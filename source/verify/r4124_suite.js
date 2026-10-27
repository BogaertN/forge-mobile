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

T('a cleared starter leaves invent unbound and an installed starter anchors invent', () => {
  const bare = mk();
  bare.clearStarterKnowledge();
  const bh = head(bare);
  const unbound = bare.process('invent a hypothesis');
  expect(unbound.trace.intent_kind === 'CREATE' && unbound.trace.echo.pass, unbound.trace.intent_kind + ' · ' + unbound.reply);
  expect(cr(unbound) && cr(unbound).failure && cr(unbound).failure.class === 'novelty_unbound', JSON.stringify(cr(unbound)));
  expect(bare.starterView().status === 'cleared' && bare.starterView().provenance === 'starter_pack', JSON.stringify(bare.starterView()));
  quiet(bare, bh, 0);
  const k = mk();
  const h = head(k);
  const view = k.starterView();
  expect(view.status === 'present' && view.provenance === 'starter_pack' && view.facts.length >= 2, JSON.stringify(view));
  expect(view.facts.some(f => /spaniel/i.test(f.text || '') && /dog/i.test(f.text || '')), JSON.stringify(view.facts));
  const raw = k.store.load('starter_pack');
  expect(raw && raw.status === 'present' && raw.provenance === 'starter_pack', JSON.stringify(raw && raw.status));
  expect((raw.facts || []).every(f => f.provenance && f.provenance.source === 'starter_pack' && f.provenance.rule === 'STARTER-PACK'), 'fact provenance');
  expect(k.memory().length === 0 && sharedN(k) === 0, 'seed wrote memory');
  const r = k.process('invent a hypothesis');
  expect(r.trace.intent_kind === 'CREATE' && r.trace.echo.pass, r.trace.intent_kind + ' · ' + r.reply);
  expect(!cr(r).failure, JSON.stringify(cr(r) && cr(r).failure));
  const spoken = (cr(r).candidates || []).filter(c => c.spoken);
  expect(spoken.length === 1 && spoken[0].novelty.anchored === true && spoken[0].novelty.class === 'bounded', JSON.stringify(spoken));
  expect(/spaniel/.test(spoken[0].claim) && /animal/.test(spoken[0].claim), spoken[0].claim);
  expect(/starter pack/.test(r.reply || '') && /hypothesis/.test(r.reply || '') && /have not stored/.test(r.reply || ''), r.reply);
  expect(r.turn_packet.packet_version === '4.9.111' && r.turn_packet.schema === 'FORGE-TURN-PACKET/v1', r.turn_packet && r.turn_packet.packet_version);
  quiet(k, h, 0);
  expect(idsOf(k) === view.facts.map(f => f.id).join(','), 'invent wrote the starter pack');
});

T('compose uses starter anchors and names starter pack provenance', () => {
  const k = mk();
  const h = head(k);
  const before = idsOf(k);
  expect(k.process('invent a hypothesis').trace.echo.pass, 'invent');
  const r = k.process('compose that idea');
  expect(r.trace.intent_kind === 'COMPOSE' && r.trace.echo.pass, r.trace.intent_kind + ' · ' + r.reply);
  expect(!cr(r).failure && cr(r).intent === 'COMPOSE', JSON.stringify(cr(r)));
  expect(/starter pack/i.test(r.reply || ''), r.reply);
  expect(!/You told me/.test(r.reply || ''), r.reply);
  expect(/spaniel/i.test(r.reply || '') && /animal/i.test(r.reply || ''), r.reply);
  expect(/have not stored/.test(r.reply || '') && /hypothesis/.test(r.reply || ''), r.reply);
  expect(/shared/.test(r.reply || '') && /world/.test(r.reply || ''), r.reply);
  expect(r.turn_packet.packet_version === '4.9.111', r.turn_packet && r.turn_packet.packet_version);
  quiet(k, h, 0);
  expect(idsOf(k) === before, 'compose wrote the starter pack');
  const wrote = k.process('write it out');
  expect(wrote.trace.intent_kind === 'COMPOSE' && wrote.trace.echo.pass && /starter pack/i.test(wrote.reply || '') && !/You told me/.test(wrote.reply || ''), wrote.reply);
  quiet(k, h, 0);
});

T('Clear starter knowledge restores unbound invent and does not write memory or shared knowledge', () => {
  const kept = mk();
  const remembered = kept.process('Remember that a bike is a vehicle.');
  expect(remembered.trace.echo.pass && remembered.trace.intent_kind === 'REQUEST_COMMIT', remembered.trace.intent_kind + ' · ' + remembered.reply);
  const row = kept.memory().find(r => r.kind !== 'note');
  expect(row && row.provenance && row.provenance.source === 'user' && row.provenance.rule === 'AUTH-EXPLICIT-REMEMBER', JSON.stringify(row && row.provenance));
  expect(kept.starterView().status === 'present', 'remember cleared the seed');
  const kh = head(kept);
  kept.clearStarterKnowledge();
  expect(kept.memory().length === 1 && sharedN(kept) === 0 && sameHead(kept, kh), 'clear touched a remembered fact');
  expect(kept.starterView().status === 'cleared', JSON.stringify(kept.starterView()));
  const k = mk();
  const h = head(k);
  const cleared = k.clearStarterKnowledge();
  expect(cleared.status === 'cleared' && cleared.provenance === 'starter_pack' && !(cleared.facts || []).length, JSON.stringify(cleared));
  expect(k.memory().length === 0 && sharedN(k) === 0, 'clear wrote memory');
  expect(sameHead(k, h), 'clear moved the world');
  const again = k.process('invent a hypothesis');
  expect(again.trace.intent_kind === 'CREATE' && again.trace.echo.pass, again.trace.intent_kind + ' · ' + again.reply);
  expect(cr(again) && cr(again).failure && cr(again).failure.class === 'novelty_unbound', JSON.stringify(cr(again)));
  expect(k.starterView().status === 'cleared', 'invent reinstalled the seed');
  k.attachLexicon(LEX, 'core');
  k.attachLexicon(EXT, 'ext');
  expect(k.starterView().status === 'cleared', 'lexicon attach reinstalled the seed');
  const still = k.process('come up with an idea');
  expect(still.trace.echo.pass && cr(still).failure.class === 'novelty_unbound', still.reply);
  quiet(k, h, 0);
});

T('Audit and the starter view name starter_pack and creative paths do not store confirmed facts', () => {
  const k = mk();
  const h = head(k);
  const before = idsOf(k);
  const panel = TP.categoryPanel(c => k.store.load(c));
  expect(/data-starter-pack/.test(panel) && /starter_pack/.test(panel) && /Starter knowledge/.test(panel), panel);
  expect(/Shared knowledge/.test(panel) && /empty/.test(panel), panel);
  expect(!/shared KB/i.test(panel), panel);
  const app = fs.readFileSync(ROOT + '/src/app.js', 'utf8');
  const fn = app.slice(app.indexOf('function starterCard'), app.indexOf('function renderMem'));
  expect(/Clear starter knowledge/.test(fn) && /id="clearStarter"/.test(fn) && /data-starter-pack/.test(fn), fn.slice(0, 400));
  expect(!/data-del|data-starter-del/.test(fn), 'per-fact starter control');
  k.process('invent a hypothesis');
  k.process('compose that idea');
  k.process('suppose a story where a cat is a bird');
  k.process('research dogs');
  expect(idsOf(k) === before, 'creative path wrote starter facts');
  expect(k.starterView().status === 'present' && k.starterView().provenance === 'starter_pack', JSON.stringify(k.starterView()));
  quiet(k, h, 0);
  const cleared = mk();
  cleared.clearStarterKnowledge();
  const gone = TP.categoryPanel(c => cleared.store.load(c));
  expect(/cleared/.test(gone) && /starter_pack/.test(gone), gone);
  expect(sharedN(cleared) === 0, 'shared KB');
});

T('version, registry, CONFLICTS, and NEXT_BUILD name 4.9.124 and leave import and a shared write unstarted', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  const parts = ver.split('.').map(Number);
  expect(parts[0] === 4 && parts[1] === 9 && parts[2] >= 124, ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver && reg.count === reg.features.length && reg.count >= 304, reg.version + ' ' + reg.count);
  for (const id of ['R4124-SEED', 'R4124-CLEAR', 'R4124-PROV']) {
    const f = reg.features.find(x => x.id === id);
    expect(f && f.claim === 'Partial' && (f.proof || []).includes('R4124') && /4\.9\.124/.test(f.note), id);
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
  const tpRel = String(targeted.release || '').split('.').map(Number);
  expect(tpRel[0] === 4 && tpRel[1] === 9 && tpRel[2] >= 124 && targeted.suites.includes('r4124_suite.js') && targeted.suites.includes('r4123_suite.js'), targeted.release + ' ' + targeted.suites[0]);
  const tp = fs.readFileSync(ROOT + '/src/turn_packet.js', 'utf8');
  expect(/PACKET_VERSION = '4\.9\.111'/.test(tp), 'packet_version');
  const RP = require(ROOT + '/src/req_packet.js');
  const slice = RP.packet('4.9.124');
  expect(slice && slice.requirements.some(r => r.id === 'R4124-SEED'), JSON.stringify(slice && slice.requirements.map(r => r.id)));
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
