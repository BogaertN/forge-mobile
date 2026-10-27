/* R4126 (4.9.126): UI shell polish. Written FIRST.
 * Chrome, nav, typography, spacing, calm empty states, Doc 7 status pills,
 * invent/compose discoverability one-liners, gentler UNSUPPORTED redirects,
 * and a starter onboarding one-liner wired to the confirmed-facts lock.
 * No feature deletion. Power surfaces stay reachable. Soft budget unchanged. */
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

T('chrome, nav, typography, and spacing carry the calm shell markers', () => {
  const css = fs.readFileSync(ROOT + '/styles.css', 'utf8');
  const html = fs.readFileSync(ROOT + '/index.html', 'utf8');
  expect(/ui-shell-4126/.test(css) && /--shell-pad/.test(css) && /font-family:.*system-ui/.test(css), 'css shell');
  expect(/\.pill\.projectable/.test(css) && /\.pill\.contested/.test(css) && /\.pill\.quarantine/.test(css) && /\.pill\.hypothesis/.test(css), 'doc7 pills');
  expect(/\.empty-state/.test(css) && /\.next-step/.test(css) && /\.discover/.test(css), 'empty and discover styles');
  expect(/text-transform:\s*none/.test(css) || /cardhead[^{]*\{[^}]*text-transform:\s*none/.test(css), 'calm cardheads');
  expect(/data-ui-shell="4\.9\.126"/.test(html), 'html shell marker');
  expect(/>Ask</.test(html) && />Memory</.test(html) && />Ideas</.test(html) && />Audit</.test(html), 'calm tab labels');
  expect(/data-tab="output"/.test(html) && /data-tab="memory"/.test(html) && /data-tab="audit"/.test(html), 'tab ids stay');
  expect(/Forge Mobile/.test(html) && !/AI\.WEB FORGE/.test(html), 'calm brand');
  expect(/data-discover="invent-compose"/.test(html) || /data-discover="invent-compose"/.test(fs.readFileSync(ROOT + '/src/app.js', 'utf8')), 'discover marker');
});

T('Doc 7 status pills and calm empty states name projectable contested quarantine hypothesis', () => {
  const app = fs.readFileSync(ROOT + '/src/app.js', 'utf8');
  const css = fs.readFileSync(ROOT + '/styles.css', 'utf8');
  expect(/pill projectable|pill\.projectable|class="pill projectable"/.test(app + css), 'projectable pill');
  expect(/pill contested|class="pill contested"/.test(app), 'contested pill');
  expect(/pill quarantine|class="pill quarantine"/.test(app), 'quarantine pill');
  expect(/pill hypothesis|class="pill hypothesis"/.test(app), 'hypothesis pill');
  expect(/empty-state/.test(app) && /Say “remember that …”|invent a hypothesis|compose that idea/.test(app), 'calm empty next steps');
  const idea = app.slice(app.indexOf('function ideaCard'), app.indexOf('function hypCard'));
  expect(/pill/.test(idea) && /projectable|hypothesis|quarantine|contested/.test(idea), 'ideas use pills');
  expect(/none — try|empty-state|invent a hypothesis/.test(idea), 'ideas empty state teaches invent');
});

T('Ask shows invent and compose discoverability one-liners without hiding them behind Advanced', () => {
  const app = fs.readFileSync(ROOT + '/src/app.js', 'utf8');
  const html = fs.readFileSync(ROOT + '/index.html', 'utf8');
  const surf = html + app;
  expect(/invent a hypothesis/.test(surf) && /compose that idea/.test(surf), 'phrase examples');
  expect(/data-discover="invent-compose"/.test(surf), 'discover strip');
  expect(!/Advanced-only.*invent|invent.*Advanced only/i.test(surf), 'not advanced-only');
  expect(/suppose a story|Suppose/.test(surf), 'suppose still named');
});

T('UNSUPPORTED and dead-end turns show a gentle next-step redirect', () => {
  const app = fs.readFileSync(ROOT + '/src/app.js', 'utf8');
  expect(/data-next-step/.test(app) && /next-step/.test(app), 'next-step markup');
  expect(/unsupported|clarification-required|action_blocked/.test(app), 'gate states covered');
  expect(/rephrase|Remember|Ideas|Audit/.test(app), 'suggested next acts');
  const k = mk();
  const r = k.process('asdf qwerty zxcv');
  expect(r.outcome && (r.outcome.class === 'clarify' || r.outcome.class === 'refuse'), r.outcome && r.outcome.class);
  const gate = r.turn_packet && r.turn_packet.gate;
  expect(gate && (gate.state === 'clarification-required' || gate.state === 'unsupported' || gate.state === 'ambiguity'), JSON.stringify(gate));
  expect(/rephrase|admit|Context Library/i.test(r.reply || ''), r.reply);
});

T('starter onboarding one-liner names starter_pack and keeps Clear starter knowledge reachable', () => {
  const app = fs.readFileSync(ROOT + '/src/app.js', 'utf8');
  const html = fs.readFileSync(ROOT + '/index.html', 'utf8');
  expect(/data-starter-onboard/.test(app + html), 'onboard marker');
  expect(/starter_pack/.test(app) && /Clear starter knowledge/.test(app), 'provenance and clear');
  expect(/id="clearStarter"/.test(app) && /data-starter-pack/.test(app), 'clear control');
  expect(!/shared KB/i.test(app.slice(app.indexOf('function starterCard'), app.indexOf('function renderMem'))), 'not shared KB');
  const k = mk();
  const st = k.starterView();
  expect(st.status === 'present' && st.provenance === 'starter_pack' && (st.facts || []).length > 0, JSON.stringify(st));
  const h = head(k);
  k.clearStarterKnowledge();
  expect(k.starterView().status === 'cleared' && sharedN(k) === 0 && sameHead(k, h), 'clear still works');
});

T('non-negotiables stay reachable: gates, packet export, Audit, Ideas tap, Remember, invent/compose/suppose, Clear starter, Import', () => {
  const app = fs.readFileSync(ROOT + '/src/app.js', 'utf8');
  const html = fs.readFileSync(ROOT + '/index.html', 'utf8');
  expect(/data-export-turn|exportTurnBtn/.test(app) && /Export turn packet/.test(app), 'packet export');
  expect(/data-tab="audit"/.test(html) && /renderAudit/.test(app) && /Verify packet/.test(html), 'audit');
  expect(/data-ideacommit/.test(app) && /Commit idea record/.test(app), 'ideas tap');
  expect(/remember that/.test(app) && /Remember/.test(app), 'remember');
  expect(/invent a hypothesis/.test(app + html) && /compose that idea/.test(app + html) && /suppose/i.test(app + html), 'creative path');
  expect(/Clear starter knowledge/.test(app) && /id="clearStarter"/.test(app), 'clear starter');
  expect(/data-import-pack/.test(app) && /Import confirmed facts/.test(app) && /id="importGo"/.test(app), 'import');
  expect(/receiptCard|data-doc6-state|gate/.test(app), 'gates/receipts');
  const k = mk();
  const invent = k.process('invent a hypothesis');
  expect(invent.trace.intent_kind === 'CREATE' && invent.turn_packet && invent.turn_packet.creative, invent.trace.intent_kind);
  expect(sharedN(k) === 0 && k.memory().length === 0, 'creative did not store');
});

T('the single-file budget stays within 1.920 MB raw and 570 kB gzip', () => {
  const rel = fs.readFileSync(ROOT + '/tools/verify_release.js', 'utf8');
  const w5 = fs.readFileSync(ROOT + '/verify/w5_suite.js', 'utf8');
  expect(/1920000/.test(rel) && /570e3/.test(rel), 'release budget moved');
  expect(/1920000/.test(w5) && /570e3/.test(w5), 'w5 budget moved');
  const p = path.join(ROOT, '..', '_release', 'single', 'kernel-app.html');
  if (!fs.existsSync(p)) return;
  const b = fs.readFileSync(p);
  if (!b.includes('4.9.126')) return;
  const gz = zlib.gzipSync(b).length;
  expect(b.length <= 1920000 && gz <= 570000, b.length + ' / ' + gz);
});

T('version, registry, CONFLICTS, and NEXT_BUILD name 4.9.126 and leave a deep IA rewrite and a shared write unstarted', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  const parts = ver.split('.').map(Number);
  expect(parts[0] === 4 && parts[1] === 9 && parts[2] >= 126, ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver && reg.count === reg.features.length && reg.count >= 310, reg.version + ' ' + reg.count);
  for (const id of ['R4126-SHELL', 'R4126-COPY', 'R4126-REACH']) {
    const f = reg.features.find(x => x.id === id);
    expect(f && f.claim === 'Partial' && (f.proof || []).includes('R4126') && /4\.9\.126/.test(f.note), id);
    expect(f && /Shared KB stays empty/.test(f.note) && !/proven cognition/.test(f.note), id + ' ' + (f && f.note));
  }
  const a11 = reg.features.find(x => x.id === 'A-11');
  expect(a11 && /4\.9\.125/.test(a11.note) && /4\.9\.126/.test(a11.note), a11 && a11.note);
  const tally = {}; for (const f of reg.features) tally[f.claim] = (tally[f.claim] || 0) + 1;
  expect(reg.claims.Implemented === 112 && reg.claims.Partial === tally.Partial + 1, JSON.stringify(reg.claims) + ' ' + tally.Partial);
  const cf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  const at = cf.lastIndexOf('## v4.9.126');
  expect(at > cf.lastIndexOf('## v4.9.125'), 'section');
  const end127 = cf.indexOf('## v4.9.127', at);
  const sec = cf.slice(at, end127 > at ? end127 : undefined);
  expect(/UI shell|shell polish|typography|status pills|Doc 7/i.test(sec), 'shell');
  expect(/invent|compose|UNSUPPORTED|starter/i.test(sec), 'copy');
  expect(/deep IA|IA rewrite|shared KB write/i.test(sec) && /not started|do not start/i.test(sec), 'parked');
  expect(/exact/.test(sec) && /Soft Echo/.test(sec) && !/proven cognition/.test(sec), 'echo');
  expect(!/Option C/.test(sec), 'option c named');
  const prev = cf.slice(cf.lastIndexOf('## v4.9.125'), at);
  expect(/import|FORGE-CONFIRMED-PACK/.test(prev) && /shared KB write/.test(prev), '4.9.125 stays historical');
  const next = fs.readFileSync(ROOT + '/../NEXT_BUILD.md', 'utf8');
  expect(/4\.9\.126/.test(next), 'NEXT_BUILD keeps 4.9.126 baseline');
  expect(/shared KB|scrapbook/i.test(next), 'queue');
  expect(/deep IA|IA rewrite/i.test(next), 'deep IA parked');
  const readme = fs.readFileSync(ROOT + '/../README.md', 'utf8');
  expect(/4\.9\.126/.test(readme) && /shell|Ask|status pills|starter_pack/i.test(readme) && /4\.9\.125/.test(readme), 'README');
  expect(!/failing-first|bot instruction/i.test(readme), 'README product');
  expect(!/shared KB/i.test(readme.slice(0, 1200)), 'README names a shared KB');
  const targeted = JSON.parse(fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8'));
  const tpRel = String(targeted.release || '').split('.').map(Number);
  expect(tpRel[0] === 4 && tpRel[1] === 9 && tpRel[2] >= 126 && targeted.suites.includes('r4126_suite.js') && targeted.suites.includes('r4125_suite.js'), targeted.release + ' ' + targeted.suites[0]);
  const tp = fs.readFileSync(ROOT + '/src/turn_packet.js', 'utf8');
  expect(/PACKET_VERSION = '4\.9\.111'/.test(tp), 'packet_version');
  const RP = require(ROOT + '/src/req_packet.js');
  const slice = RP.packet('4.9.126');
  expect(slice && slice.requirements.some(r => r.id === 'R4126-SHELL'), JSON.stringify(slice && slice.requirements.map(r => r.id)));
  expect(RP.linksMissing(ROOT).length === 0, RP.linksMissing(ROOT).join(' '));
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4126', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4126', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
