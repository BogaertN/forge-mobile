/* R4173 (4.9.173): phone custody monitor on the always-on mesh, plus the web icon.
 * The screen reads boundary, schedule, ticks, research, admit, cold re-curate, and KB counts.
 * Ask pauses that work, then it resumes. Letter packs stay gated. No LLM.
 * The site loads dream_idle.js. kernel.js does not. The portable single file does not inline it. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const D = require(ROOT + '/src/dream_idle.js');
const KMOD = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-28T23:40:00Z';
const KEY = 'nic-write-key-ok';
const mkStore = () => { const st = {}; return KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }); };
const mk = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK, vaultState: () => 'locked', store: mkStore() });
const verified = (text, integrity) => [{ text: text, verified: true, integrity: integrity, source: 'allow-listed' }];
const quartzGap = extra => Object.assign({ kind: 'aq1_miss', claim: 'Quartz is a mineral', eps: 0.12, integrity: 0.95, extracts: verified('Quartz is a mineral', 0.95), calls_llm: false }, extra || {});
const phoneFacts = k => { const phone = k.store.load('confirmed_shared'); return (phone && phone.facts) || []; };
function researchSpec(gapId) {
  return {
    task: 'research', parent: 'gilligan', spawned_by: 'athena', gap_id: gapId,
    packet: { schema: D.SCHEMA, calls_llm: false, parent: 'gilligan', spawned_by: 'athena', task: 'research', gap_id: gapId, kind: 'aq1_miss', eps: 0.12, integrity: 0.95, claim: 'Quartz is a mineral' }
  };
}
function pngSize(buf) {
  expect(buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a', 'png signature');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

T('custody snapshot follows a real always-on tick, admit, and cold re-curate', () => {
  const b = D.boundary();
  expect(b.always_on === true && b.idle_gated === false && b.schedule_law === 'DREAM-ALWAYS-ON' && b.custody_monitor === true && b.calls_llm === false, JSON.stringify({ on: b.always_on, law: b.schedule_law, mesh: b.mesh }));
  expect(b.mesh === '4.9.187' && b.phone_pack_publish === 'gated' && b.ui_click_required === false, JSON.stringify({ mesh: b.mesh, packs: b.phone_pack_publish }));
  const k = mk();
  k.clearStarterKnowledge();
  k.setSharedKbWriteKey(KEY);
  const packPath = path.join(ROOT, 'packs', 'confirmed_shared', 'q.json');
  const beforePack = crypto.createHash('sha256').update(fs.readFileSync(packPath)).digest('hex');
  const w = D.createIdleDream({ clock: CLOCK, host: k, writeKey: KEY, publishPacks: false });
  const quiet = w.custody({ kb_count: k.sharedKnowledgeView().count });
  expect(quiet.schema === 'FORGE-CUSTODY-MONITOR/v1' && quiet.always_on === true && quiet.idle_gated === false && quiet.publish_packs === false && quiet.athena.research_ticks === 0 && quiet.kb.count === 0 && quiet.kb.phone_db === false && quiet.neo_is_neil === false, JSON.stringify({ ticks: quiet.athena.research_ticks, kb: quiet.kb }));
  expect(quiet.daemons.map(d => d.role + ':' + d.runs).join(',') === 'gilligan:always_on,athena:always_on,neo:kernel_process', quiet.daemons.map(d => d.runs).join(','));
  w.enqueue([Object.assign({ id: 'gap:quartz' }, quartzGap())]);
  const step = w.schedule({ answering: false });
  expect(step.rule === 'DREAM-ALWAYS-ON' && step.step && step.step.rule === 'DREAM-BACKEND-FILL' && step.step.researcher === 'athena' && step.step.wrote_pack !== true, JSON.stringify({ rule: step.rule, step: step.step && step.step.rule, pack: step.step && step.step.wrote_pack }));
  const after = w.custody({ kb_count: k.sharedKnowledgeView().count });
  expect(after.athena.research_ticks === 1 && after.athena.admits === 1 && after.kb.count === 1 && after.kb.admits === 1 && after.kb.delta === 1 && after.kb.pack_stuffed === false, JSON.stringify(after.athena) + ' ' + JSON.stringify(after.kb));
  expect(after.gilligan.cold_quiet >= 1 && after.gilligan.last && after.gilligan.last.rule === 'GILLIGAN-COLD-QUIET', JSON.stringify(after.gilligan));
  expect(phoneFacts(k).length === 0, 'phone db');
  expect(crypto.createHash('sha256').update(fs.readFileSync(packPath)).digest('hex') === beforePack, 'letter pack not stuffed');
  const good = w.spawnHelper(researchSpec('cold-quartz'));
  expect(good.ok === true, JSON.stringify(good));
  expect(w.athena.run(good.agent.id, { gap: quartzGap({ claim: 'Quartz forms crystals', extracts: verified('Quartz forms crystals', 0.95) }) }).lane === 'promote_candidate', 'cold research');
  expect(w.retireHelper(good.agent.id).ok === true, 'retire');
  let coldStep = null;
  const seenCold = [];
  for (let i = 0; i < 8; i++) {
    const s = w.schedule({ answering: false });
    seenCold.push(s.step && s.step.rule);
    if (s.step && s.step.rule === 'GILLIGAN-COLD-RECURATE') { coldStep = s; break; }
  }
  expect(coldStep && coldStep.rule === 'DREAM-ALWAYS-ON' && coldStep.step.role === 'gilligan' && coldStep.step.wrote_pack !== true, JSON.stringify(seenCold));
  const coldView = w.custody({ kb_count: k.sharedKnowledgeView().count });
  expect(coldView.gilligan.cold_recurate >= 1 && coldView.gilligan.admits >= 1 && coldView.kb.count === 2 && coldView.kb.pack_stuffed === false, JSON.stringify({ g: coldView.gilligan, kb: coldView.kb }));
  expect(crypto.createHash('sha256').update(fs.readFileSync(packPath)).digest('hex') === beforePack, 'cold re-curate did not stuff the pack');
  const holes = D.enumerateGaps({ lettersCovered: 'abcdefghijklmnopqrstuvwxy' });
  w.enqueue(holes);
  const novel = w.schedule({ answering: false });
  expect(novel.step && novel.step.kind === 'letter_hole' && novel.step.lane === 'quarantine' && novel.step.claim == null && novel.step.calls_llm === false, JSON.stringify({ kind: novel.step && novel.step.kind, lane: novel.step && novel.step.lane, claim: novel.step && novel.step.claim }));
  const nov = w.custody({ kb_count: k.sharedKnowledgeView().count });
  expect(nov.athena.quarantine >= 1 && nov.gilligan.novel_ticks >= 1 && nov.novel_open >= 0 && nov.kb.count === 2, JSON.stringify({ q: nov.athena.quarantine, novel: nov.gilligan.novel_ticks, kb: nov.kb.count }));
  expect(!(k.sharedKnowledgeView().admitted || []).some(x => /^z is /i.test(x.text || '')), 'no invented letter fact');
});

T('Ask pause is visible on the custody mesh and resume keeps working', () => {
  const w = D.createIdleDream({ clock: CLOCK, publishPacks: false });
  w.enqueue([Object.assign({ id: 'gap:quartz' }, quartzGap())]);
  w.setAnswering(true);
  const paused = w.schedule({ answering: true });
  const held = w.custody({ kb_count: 0 });
  expect(paused.rule === 'DREAM-ASK-PAUSE' && paused.ran === false && paused.always_on === true && paused.idle_gated === false, JSON.stringify(paused));
  expect(held.answering === true && held.athena.research_ticks === 0 && held.schedule_law === 'DREAM-ALWAYS-ON', JSON.stringify({ on: held.answering, ticks: held.athena.research_ticks }));
  w.setAnswering(false);
  const resumed = w.schedule({ answering: false });
  expect(resumed.rule === 'DREAM-ALWAYS-ON' && resumed.ran === true && resumed.step && resumed.step.researcher === 'athena', JSON.stringify({ rule: resumed.rule, step: resumed.step && resumed.step.rule }));
  expect(w.custody().athena.research_ticks === 1 && w.custody().answering === false, 'resumed tick counted');
});

T('phone custody screen binds the mesh and does not publish packs', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const kernel = fs.readFileSync(path.join(ROOT, 'src', 'kernel.js'), 'utf8');
  const ui = fs.readFileSync(path.join(ROOT, 'src', 'app_custody.js'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
  const gov = fs.readFileSync(path.join(ROOT, 'src', 'governance.js'), 'utf8');
  const bench = fs.readFileSync(path.join(ROOT, 'src', 'app_bench.js'), 'utf8');
  const build = fs.readFileSync(path.join(ROOT, 'build.py'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const dream = fs.readFileSync(path.join(ROOT, 'src', 'dream_idle.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  expect(/data-tab="custody"/.test(html) && /id="custody"/.test(html) && /id="custodyStrip"/.test(html), 'custody tab and strip');
  expect(/src="src\/dream_idle\.js"/.test(html) && /src="src\/app_custody\.js"/.test(html), 'scripts');
  expect(!/dream_idle/.test(kernel), 'not on the ask path');
  expect(/publishPacks:\s*false/.test(ui) && !/publishPacks:\s*true/.test(ui), 'packs stay gated');
  expect(/always-on/i.test(ui) && /DREAM-ALWAYS-ON/.test(ui) && !/idle dream only/i.test(ui) && !/only when Ask is idle/i.test(ui), 'product copy');
  expect(/Codex 3\.24/.test(ui) && /yield etiquette/.test(ui), 'doc idle note');
  expect(!/Gilligan is not built/.test(app) && /always-on cold curator/.test(app), 'status copy');
  expect(!/ChristPing is not built/.test(app) && /ChristPing is Gilligan-only/.test(app), 'resurrection copy');
  expect(!/ChristPing is not built/.test(gov) && /ChristPing is Gilligan-only/.test(gov), 'governance copy');
  expect(/marketplace/.test(bench) && /4\.9\.174/.test(bench) && !/marketplace UI/.test(ui), 'tools hook stays a comment');
  expect(/src\/dream_idle\.js/.test(build) && /does not inline it/.test(build) && /continue/.test(build), 'single file skips the mesh');
  expect(/\.\/src\/dream_idle\.js/.test(sw) && /\.\/src\/app_custody\.js/.test(sw), 'service worker caches the monitor');
  expect(!/setInterval|setTimeout|child_process|openai|anthropic|ollama|Math\.random/.test(dream), 'mesh still has no timer or model');
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const icons = manifest.icons || [];
  expect(icons.some(i => i.src === 'icons/icon-192.png' && i.sizes === '192x192' && /maskable/.test(i.purpose)) && icons.some(i => i.src === 'icons/icon-512.png' && i.sizes === '512x512'), JSON.stringify(icons));
  expect(/rel="icon"/.test(html) && /apple-touch-icon/.test(html) && /icons\/icon-192\.png/.test(html), 'favicon and apple touch');
  const i192 = Buffer.from(fs.readFileSync(path.join(ROOT, '..', 'icons', 'icon-192.png.b64'), 'utf8').trim(), 'base64');
  const i512 = Buffer.from(fs.readFileSync(path.join(ROOT, '..', 'icons', 'icon-512.png.b64'), 'utf8').trim(), 'base64');
  const s192 = pngSize(i192), s512 = pngSize(i512);
  expect(s192.w === 192 && s192.h === 192 && i192.length < 8000, JSON.stringify(s192) + ' ' + i192.length);
  expect(s512.w === 512 && s512.h === 512 && i512.length < 40000, JSON.stringify(s512) + ' ' + i512.length);
});

T('version registry CONFLICTS NEXT_BUILD name 4.9.173', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.198', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.173/.test(conf) && /Custody/.test(conf) && /always-on/.test(conf) && /14fVCPgQ0UtRBnSclMfQ-3fazrdwKc-BrknfqYFolJ8g/.test(conf) && /1HSjAk6UYKnqpT6LZo_30DjAAA9eWKoaWdpXrKk9LMnE/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.173/.test(nb) && /4\.9\.172/.test(nb) && /marketplace/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.173/.test(readme) && /dream_idle/.test(readme) && /Custody/.test(readme) && /ChristPing/.test(readme), 'README');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.198' && (((((tgt.suites[0] === 'r4198_suite.js' || tgt.suites[0] === 'r4197_suite.js' || tgt.suites[0] === 'r4196_suite.js' || tgt.suites[0] === 'r4195_suite.js' || tgt.suites[0] === 'r4194_suite.js') || tgt.suites[0] === 'r4193_suite.js' || tgt.suites[0] === 'r4191_suite.js' || tgt.suites[0] === 'r4190_suite.js' || tgt.suites[0] === 'r4189_suite.js' || tgt.suites[0] === 'r4188_suite.js' || tgt.suites[0] === 'r4187_suite.js' || tgt.suites[0] === 'r4186_suite.js' || tgt.suites[0] === 'r4185_suite.js' || tgt.suites[0] === 'r4184_suite.js' || tgt.suites[0] === 'r4183_suite.js' || tgt.suites[0] === 'r4182_suite.js' || tgt.suites[0] === 'r4181_suite.js' || tgt.suites[0] === 'r4180_suite.js') || tgt.suites[0] === 'r4179_suite.js') || tgt.suites[0] === 'r4178_suite.js') || tgt.suites[0] === 'r4177_suite.js' || tgt.suites[0] === 'r4176_suite.js' || tgt.suites[0] === 'r4175_suite.js' || tgt.suites[0] === 'r4174_suite.js' || tgt.suites[0] === 'r4173_suite.js') && tgt.suites.includes('r4172_suite.js'), JSON.stringify({ release: tgt.release, head: tgt.suites[0] }));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.198', reg.version);
  expect(reg.features.some(f => f.id === 'R4173-CUSTODY' && f.claim === 'Partial'), 'feature');
  expect(reg.count === reg.features.length && reg.count >= 334, 'count ' + reg.count);
  expect(reg.claims.Implemented === 112 && reg.claims.Partial >= 168, JSON.stringify(reg.claims));
  const mh = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'math_honesty.json'), 'utf8'));
  expect(mh.release === '4.9.198' && mh.idle_dream_router && mh.idle_dream_router.always_on === true && mh.idle_dream_router.christ_ping === true && mh.idle_dream_router.continuous_fill === 'backend_hosted' && mh.idle_dream_router.write_law_unchanged === true, 'math_honesty');
  const req = fs.readFileSync(path.join(ROOT, 'src', 'req_packet.js'), 'utf8');
  expect(/4\.9\.173/.test(req) && /R4173-CUSTODY/.test(req), 'req_packet');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  expect(/forge-mobile-v__FORGE_VERSION__/.test(sw) || /forge-mobile-v4\.9\.173/.test(sw), 'sw');
});

(async () => {
  let failed = 0;
  const rows = [];
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4173', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4173', name: t.name, ok: false, why: String(e.message || e).slice(0, 800) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
