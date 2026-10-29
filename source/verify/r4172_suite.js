/* R4172 (4.9.172): always-on workers, backend hosted fill, ChristPing, admit window.
 * Athena researches continuously. Gilligan re-curates cold storage. No UI click.
 * Ask pauses helpers, then they resume. Manual hibernate stays. No LLM.
 * Quarantine does not write confirmed_shared and does not spend the spawn window.
 * Phone pack publish stays gated. 4.9.173 loads the mesh on the site custody screen and still leaves it off kernel.js. */
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
const CLOCK = () => '2026-10-28T23:10:00Z';
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

T('boundary and schedule are always-on continuous work', () => {
  const b = D.boundary();
  expect(b.calls_llm === false && b.always_on === true && b.idle_gated === false && b.christ_ping === true, JSON.stringify({ on: b.always_on, idle: b.idle_gated, christ: b.christ_ping }));
  expect(b.continuous_fill === 'backend_hosted' && b.phone_pack_publish === 'gated' && b.pages_pack_ship === 'gated' && b.ui_click_required === false && b.automatic_curation === true, JSON.stringify({ fill: b.continuous_fill, ui: b.ui_click_required }));
  expect(b.gap_research === 'continuous' && b.cold_revisit === 'continuous' && b.schedule_law === 'DREAM-ALWAYS-ON', JSON.stringify({ gap: b.gap_research, cold: b.cold_revisit, law: b.schedule_law }));
  expect(b.christ_rules.indexOf('CHRIST-PING') >= 0 && b.christ_rules.indexOf('CHRIST-PING-GILLIGAN-ONLY') >= 0 && b.christ_rules.indexOf('GRACE-RECENTER') >= 0, b.christ_rules.join(','));
  expect(b.docs.gilligan_core === '1HSjAk6UYKnqpT6LZo_30DjAAA9eWKoaWdpXrKk9LMnE' && b.docs.gilligan_codex === '1hbLsNhrEeeomonxkHAUjEkw4tXsHllcnuUzx8Mv8hOM', 'gilligan docs');
  expect(b.docs.dream_drift === '14fVCPgQ0UtRBnSclMfQ-3fazrdwKc-BrknfqYFolJ8g' && b.docs.rpmc_protocol === '1G-Yj323feeMBklm6sENdawfBBTC1VfdL4slIGtoFRxE', 'rpmc dream');
  expect(b.docs.orchestration === '1O5Txx2rLvWehvmHY_8miMtVrFTqmQgo_xLyzA_P5dGA' && b.docs.rmc_10_8 === '1COtSEuXYxfgfomzDBu99jrnaHoLWuIM79WVUy-glq54' && b.docs.coherence === '1q5JcF-v1M2plJ500UcKxRHRM1fRbt1RCzc-AXjuoReE', 'orch rmc coherence');
  const runs = D.DAEMONS.map(d => d.role + ':' + d.runs).join(',');
  expect(runs === 'gilligan:always_on,athena:always_on,neo:kernel_process', runs);
  expect(D.DAEMONS.find(d => d.role === 'gilligan').spawns_helpers === false && D.DAEMONS.find(d => d.role === 'athena').spawns_helpers === true && D.DAEMONS.find(d => d.role === 'neo').spawns_helpers === false, 'spawn rights');
  const w = D.createIdleDream({ clock: CLOCK });
  const idle = w.schedule();
  expect(idle.ok === true && idle.always_on === true && idle.idle_gated === false && idle.rule === 'DREAM-ALWAYS-ON' && idle.rule !== 'DREAM-IDLE-GATED' && idle.ui_click_required === false && idle.calls_llm === false, JSON.stringify({ rule: idle.rule, on: idle.always_on, gated: idle.idle_gated }));
  expect(idle.researcher === 'athena' && idle.cold_curator === 'gilligan' && idle.step && idle.step.rule === 'DREAM-IDLE-EMPTY', JSON.stringify(idle.step && idle.step.rule));
  const src = fs.readFileSync(path.join(ROOT, 'src', 'dream_idle.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  expect(!/setInterval|setTimeout|child_process|openai|anthropic|ollama|Math\.random/.test(src), 'no timer, model, or random');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const kernel = fs.readFileSync(path.join(ROOT, 'src', 'kernel.js'), 'utf8');
  expect(!/dream_idle/.test(kernel), 'not on the ask path');
  expect(/src\/dream_idle\.js/.test(html) && /data-tab="custody"/.test(html), 'site custody loads the mesh');
});

T('Ask pauses helpers then resumes and a manual hibernate stays hibernated', () => {
  const w = D.createIdleDream({ clock: CLOCK });
  const live = w.spawnHelper(researchSpec('ask-live'));
  const manual = w.spawnHelper(researchSpec('ask-manual'));
  expect(live.ok === true && manual.ok === true, 'spawn');
  expect(w.hibernateHelper(manual.agent.id).ok === true, 'manual hibernate');
  w.setAnswering(true);
  expect(w.listActive().length === 0, 'ask paused the live helper');
  const held = w.helpers().find(h => h.id === live.agent.id);
  const stayed = w.helpers().find(h => h.id === manual.agent.id);
  expect(held.status === 'hibernated' && held.hold === 'ask', JSON.stringify(held));
  expect(stayed.status === 'hibernated' && stayed.hold == null, JSON.stringify(stayed));
  const paused = w.schedule();
  expect(paused.rule === 'DREAM-ASK-PAUSE' && paused.ran === false && paused.always_on === true, JSON.stringify(paused));
  const busy = w.tick({ answering: false });
  expect(busy.rule === 'DREAM-IDLE-BUSY' && busy.ran === false, JSON.stringify(busy));
  w.setAnswering(false);
  const resumed = w.schedule({ answering: false });
  expect(resumed.rule === 'DREAM-ALWAYS-ON' && resumed.paused_for_ask !== true, JSON.stringify({ rule: resumed.rule, paused: resumed.paused_for_ask }));
  const afterLive = w.helpers().find(h => h.id === live.agent.id);
  const afterManual = w.helpers().find(h => h.id === manual.agent.id);
  expect(afterLive.status === 'active' && afterLive.hold == null, JSON.stringify(afterLive));
  expect(afterManual.status === 'hibernated' && afterManual.hold == null, 'manual hibernate stays');
});

T('Athena researches continuously and backend fill writes hosted KB without a phone pack', () => {
  const k = mk();
  k.clearStarterKnowledge();
  k.setSharedKbWriteKey(KEY);
  const pack = fs.readFileSync(path.join(ROOT, 'packs', 'confirmed_shared', 'q.json'));
  const beforePack = crypto.createHash('sha256').update(pack).digest('hex');
  const mem0 = k.memory().length;
  const w = D.createIdleDream({ clock: CLOCK, host: k, writeKey: KEY, publishPacks: false });
  expect(w.admitEnabled() === true, 'admit default on');
  w.enqueue([
    Object.assign({ id: 'gap:quartz' }, quartzGap()),
    Object.assign({ id: 'gap:crystal' }, quartzGap({ claim: 'Quartz forms crystals', extracts: verified('Quartz forms crystals', 0.95) }))
  ]);
  const ran = w.run({ answering: false, steps: 2 });
  expect(ran.steps.length === 2 && ran.steps.every(s => s.ran === true && s.researcher === 'athena' && s.lane === 'promote_candidate' && s.calls_llm === false), JSON.stringify(ran.steps.map(s => ({ id: s.gap_id, lane: s.lane, rule: s.rule, who: s.researcher }))));
  expect(ran.steps.every(s => s.backend_fill && s.backend_fill.wrote_confirmed_shared === true && s.backend_fill.wrote_pack === false && s.backend_fill.phone_db === false), JSON.stringify(ran.steps.map(s => s.backend_fill)));
  const admitted = k.sharedKnowledgeView().admitted || [];
  expect(admitted.filter(x => /quartz/i.test(x.text || '')).length === 2, 'two hosted rows ' + admitted.length);
  expect(phoneFacts(k).length === 0, 'phone db stays empty');
  expect((k.store.load('shared_knowledge') || []).length === 0, 'scrapbook');
  expect(k.memory().length === mem0, 'memory');
  expect(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'packs', 'confirmed_shared', 'q.json'))).digest('hex') === beforePack, 'letter pack not stuffed');
  w.enqueue([Object.assign({ id: 'gap:ph' }, { kind: 'aq1_miss', claim: 'Phlogiston is a substance', eps: 0.55, integrity: 0.99, extracts: verified('Phlogiston is a substance', 0.99) })]);
  const q = w.tick({ answering: false });
  expect(q.lane === 'quarantine' && q.rule === 'DREAM-QUARANTINE-KEEP' && q.wrote_confirmed_shared !== true, JSON.stringify({ lane: q.lane, rule: q.rule, wrote: q.wrote_confirmed_shared }));
  expect(!(k.sharedKnowledgeView().admitted || []).some(x => /phlogiston/i.test(x.text || '')), 'quarantine is not hosted truth');
  const llm = D.routeMeasurement({ calls_llm: true, eps: 0.05, integrity: 1, claim: 'Quartz is a mineral' });
  expect(llm.rule === 'DREAM-LLM-REFUSED' && llm.calls_llm === false && llm.claim == null, JSON.stringify(llm));
});

T('ChristPing is Gilligan-only and high drift leaves the noisy claim off confirmed_shared', () => {
  const neo = D.christPing({ initiator: 'neo', eps: 0.91, ancestors: [{ Phi: 9, eps: 0, mu: 1 }], claim: 'Phlogiston is a substance' });
  expect(neo.ok === false && neo.rule === 'CHRIST-PING-GILLIGAN-ONLY' && neo.christ_ping === false && neo.wrote_confirmed_shared === false, JSON.stringify(neo));
  const athena = D.christPing({ initiator: 'athena', eps: 0.95 });
  expect(athena.rule === 'CHRIST-PING-GILLIGAN-ONLY' && athena.wrote_confirmed_shared === false, JSON.stringify(athena));
  const mid = D.christPing({ initiator: 'gilligan', eps: 0.55 });
  expect(mid.ok === false && mid.rule === 'CHRIST-PING-NOT-HARD' && mid.wrote_confirmed_shared === false, JSON.stringify(mid));
  const asked = D.christPing({ initiator: 'gilligan', request: true, eps: 0.2, gap_id: 'gap:ask', claim: 'Phlogiston is a substance' });
  expect(asked.ok === true && asked.rule === 'CHRIST-PING' && asked.initiator === 'gilligan' && asked.redirect && asked.redirect.claim == null && asked.redirect.rule === 'CHRIST-PING-REDIRECT' && asked.wrote_confirmed_shared === false, JSON.stringify({ rule: asked.rule, claim: asked.redirect && asked.redirect.claim }));
  const k = mk();
  k.clearStarterKnowledge();
  k.setSharedKbWriteKey(KEY);
  const w = D.createIdleDream({ clock: CLOCK, host: k, writeKey: KEY, publishPacks: false });
  w.enqueue([
    { id: 'gap:bad', kind: 'aq1_miss', claim: 'Phlogiston is a substance', eps: 0.91, integrity: 0.99, ancestors: [{ Phi: 9, eps: 0, mu: 1 }], extracts: verified('Phlogiston is a substance', 0.99) },
    Object.assign({ id: 'gap:next' }, quartzGap())
  ]);
  const t = w.tick({ answering: false });
  expect(t.lane === 'hard_reject' && t.rule === 'GRACE-RECENTER' && t.aborted === true && t.christ_ping === true && t.calls_llm === false, JSON.stringify({ lane: t.lane, rule: t.rule, christ: t.christ_ping }));
  expect(t.recenter && t.recenter.christ_ping === true && t.recenter.initiator === 'gilligan' && t.recenter.rule === 'GRACE-RECENTER', JSON.stringify(t.recenter && t.recenter.rule));
  expect(t.christ && t.christ.rule === 'CHRIST-PING' && t.christ.redirect && t.christ.redirect.id === 'gap:bad:christ' && t.christ.redirect.claim == null && t.christ.wrote_confirmed_shared === false, JSON.stringify(t.christ && { rule: t.christ.rule, id: t.christ.redirect && t.christ.redirect.id, claim: t.christ.redirect && t.christ.redirect.claim }));
  expect(t.next_id === 'gap:next' && t.shared_kb === false && t.may_write_memory === false, JSON.stringify({ next: t.next_id, shared: t.shared_kb }));
  expect(!(k.sharedKnowledgeView().admitted || []).some(x => /phlogiston/i.test(x.text || '')), 'noise not admitted');
  const n = w.tick({ answering: false });
  expect(n.gap_id === 'gap:next' && n.lane === 'promote_candidate' && n.backend_fill && n.backend_fill.wrote_confirmed_shared === true, JSON.stringify({ id: n.gap_id, lane: n.lane, fill: n.backend_fill }));
  expect((k.sharedKnowledgeView().admitted || []).some(x => /quartz is a mineral/i.test(x.text || '')) && !(k.sharedKnowledgeView().admitted || []).some(x => /phlogiston/i.test(x.text || '')), 'different path admitted, noise stayed out');
  const redirected = w.tick({ answering: false });
  expect(redirected.gap_id === 'gap:bad:christ' && redirected.lane !== 'promote_candidate' && redirected.claim == null, JSON.stringify({ id: redirected.gap_id, lane: redirected.lane, claim: redirected.claim, rule: redirected.rule }));
  expect(phoneFacts(k).length === 0, 'phone');
  const bare = D.graceRecenter(0.95, []);
  expect(bare.aborted === true && bare.christ_ping === true && bare.grace && bare.grace.ok === false && bare.initiator === 'gilligan', 'no ancestor still aborts under ChristPing');
});

T('quarantine admit does not burn the spawn window and a later promote still lands', () => {
  const k = mk();
  k.clearStarterKnowledge();
  k.setSharedKbWriteKey(KEY);
  const w = D.createIdleDream({ clock: CLOCK, publishPacks: false });
  const quarantined = D.routeMeasurement({ eps: 0.55, integrity: 0.99, claim: 'Phlogiston is a substance', extracts: verified('Phlogiston is a substance', 0.99) });
  for (let i = 0; i < D.SPAWN_BUDGET.max_spawn_per_idle_window; i++) {
    const row = w.admitRecord(Object.assign({ gap_id: 'gap:ph-' + i }, quarantined), { host: k, writeKey: KEY, publishPacks: false });
    expect(row.ok === false && row.rule === 'DREAM-QUARANTINE-NO-TRUTH' && row.wrote_confirmed_shared === false && row.wrote_pack === false, i + ' ' + JSON.stringify(row));
  }
  expect(w.athena.budget().spawns_this_window === 0, 'window ' + w.athena.budget().spawns_this_window);
  expect(w.coldBank().filter(r => r.route === 'dream_state_quarantine_candidate').length >= D.SPAWN_BUDGET.max_spawn_per_idle_window, 'custody without spawn');
  expect(k.sharedKnowledgeView().count === 0, 'no hosted rows from quarantine probes');
  w.enqueue([Object.assign({ id: 'gap:quartz' }, quartzGap())]);
  const staged = w.tick({ answering: false });
  expect(staged.lane === 'promote_candidate' && staged.backend_fill == null, JSON.stringify({ lane: staged.lane, fill: staged.backend_fill }));
  const adm = w.admitRecord(w.promoteCandidates()[0], { host: k, writeKey: KEY, publishPacks: false });
  expect(adm.ok === true && adm.wrote_confirmed_shared === true && adm.wrote_pack === false && adm.rule === 'DREAM-IDLE-ADMITTED', JSON.stringify({ ok: adm.ok, rule: adm.rule, wrote: adm.wrote_confirmed_shared, pack: adm.wrote_pack }));
  expect(w.athena.budget().spawns_this_window > 0 && w.athena.budget().spawns_this_window <= D.SPAWN_BUDGET.max_spawn_per_idle_window, 'promote spent window ' + w.athena.budget().spawns_this_window);
  expect((k.sharedKnowledgeView().admitted || []).filter(x => /quartz/i.test(x.text || '')).length === 1, 'one quartz row');
  expect(!(k.sharedKnowledgeView().admitted || []).some(x => /phlogiston/i.test(x.text || '')), 'probes did not admit');
  expect(phoneFacts(k).length === 0, 'phone');
  const blocked = w.admitRecord(Object.assign({ gap_id: 'gap:hard' }, D.routeMeasurement({ eps: 0.91, integrity: 0.99, claim: 'Phlogiston is a substance', ancestors: [{ Phi: 9, eps: 0, mu: 1 }] })), { host: k, writeKey: KEY, publishPacks: false });
  expect(blocked.rule === 'DREAM-HARD-REJECT-NO-TRUTH' && blocked.wrote_confirmed_shared === false, JSON.stringify(blocked));
});

T('Gilligan re-curates cold storage and quarantine cold does not become truth', () => {
  const k = mk();
  k.clearStarterKnowledge();
  k.setSharedKbWriteKey(KEY);
  const w = D.createIdleDream({ clock: CLOCK, host: k, writeKey: KEY, publishPacks: false });
  const good = w.spawnHelper(researchSpec('cold-quartz'));
  expect(good.ok === true, JSON.stringify(good));
  const ran = w.athena.run(good.agent.id, { gap: quartzGap() });
  expect(ran.lane === 'promote_candidate', JSON.stringify({ lane: ran.lane, rule: ran.rule }));
  expect(w.retireHelper(good.agent.id).ok === true, 'retire projectable research');
  const before = (k.sharedKnowledgeView().admitted || []).length;
  const again = w.tick({ answering: false });
  expect(again.role === 'gilligan' && again.rule === 'GILLIGAN-COLD-RECURATE' && again.wrote_confirmed_shared === true && again.backend_fill && again.backend_fill.wrote_pack === false, JSON.stringify({ role: again.role, rule: again.rule, wrote: again.wrote_confirmed_shared, fill: again.backend_fill }));
  expect((k.sharedKnowledgeView().admitted || []).length === before + 1, 'cold re-curate filled the hosted bank');
  expect(phoneFacts(k).length === 0, 'phone');
  const bad = w.spawnHelper({
    task: 'research', parent: 'gilligan', spawned_by: 'athena', gap_id: 'cold-ph',
    packet: { schema: D.SCHEMA, calls_llm: false, parent: 'gilligan', spawned_by: 'athena', task: 'research', gap_id: 'cold-ph', kind: 'aq1_miss', eps: 0.12, integrity: 0.99, claim: 'Quartz is a mineral' }
  });
  expect(bad.ok === true, JSON.stringify(bad));
  w.athena.run(bad.agent.id, { gap: { kind: 'aq1_miss', claim: 'Phlogiston is a substance', eps: 0.55, integrity: 0.99, extracts: verified('Phlogiston is a substance', 0.99) } });
  expect(w.retireHelper(bad.agent.id).ok === true, 'retire quarantine research');
  const n0 = (k.sharedKnowledgeView().admitted || []).length;
  const keep = w.tick({ answering: false });
  expect(keep.role === 'gilligan' && keep.rule === 'GILLIGAN-COLD-KEEP' && keep.wrote_confirmed_shared === false, JSON.stringify({ role: keep.role, rule: keep.rule, wrote: keep.wrote_confirmed_shared }));
  expect((k.sharedKnowledgeView().admitted || []).length === n0, 'quarantine cold did not grow the bank');
  expect(!(k.sharedKnowledgeView().admitted || []).some(x => /phlogiston/i.test(x.text || '')), 'cold quarantine is not truth');
});

T('version registry CONFLICTS NEXT_BUILD name 4.9.172', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.181', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.172/.test(conf) && /ChristPing/.test(conf) && /always-on|ALWAYS ON/.test(conf) && /backend/.test(conf) && /1HSjAk6UYKnqpT6LZo_30DjAAA9eWKoaWdpXrKk9LMnE/.test(conf) && /1hbLsNhrEeeomonxkHAUjEkw4tXsHllcnuUzx8Mv8hOM/.test(conf), 'CONFLICTS');
  expect(/14fVCPgQ0UtRBnSclMfQ-3fazrdwKc-BrknfqYFolJ8g/.test(conf) && /1G-Yj323feeMBklm6sENdawfBBTC1VfdL4slIGtoFRxE/.test(conf) && /1O5Txx2rLvWehvmHY_8miMtVrFTqmQgo_xLyzA_P5dGA/.test(conf), 'rpmc orch');
  expect(/1COtSEuXYxfgfomzDBu99jrnaHoLWuIM79WVUy-glq54/.test(conf) && /1q5JcF-v1M2plJ500UcKxRHRM1fRbt1RCzc-AXjuoReE/.test(conf), 'rmc coherence');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.172/.test(nb) && /4\.9\.171/.test(nb) && /ChristPing/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.172/.test(readme) && /dream_idle/.test(readme) && /ChristPing/.test(readme) && /maySpawn/.test(readme), 'README');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.181' && ((((tgt.suites[0] === 'r4181_suite.js' || tgt.suites[0] === 'r4180_suite.js') || tgt.suites[0] === 'r4179_suite.js') || tgt.suites[0] === 'r4178_suite.js') || tgt.suites[0] === 'r4177_suite.js' || tgt.suites[0] === 'r4176_suite.js' || tgt.suites[0] === 'r4175_suite.js' || tgt.suites[0] === 'r4174_suite.js' || tgt.suites[0] === 'r4173_suite.js' || tgt.suites[0] === 'r4172_suite.js') && tgt.suites.includes('r4171_suite.js'), JSON.stringify(tgt));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.181', reg.version);
  expect(reg.features.some(f => f.id === 'R4172-ALWAYS-ON'), 'feature');
  expect(reg.count === reg.features.length, 'count');
  expect(reg.claims.Implemented === 112 && reg.claims.Partial >= 167, JSON.stringify(reg.claims));
  const mh = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'math_honesty.json'), 'utf8'));
  expect(mh.release === '4.9.181' && mh.idle_dream_router && mh.idle_dream_router.christ_ping === true && mh.idle_dream_router.always_on === true && mh.idle_dream_router.continuous_fill === 'backend_hosted' && mh.idle_dream_router.write_law_unchanged === true && mh.idle_dream_router.os_process_pool === false, 'math_honesty');
  const req = fs.readFileSync(path.join(ROOT, 'src', 'req_packet.js'), 'utf8');
  expect(/4\.9\.172/.test(req) && /R4172-ALWAYS-ON/.test(req), 'req_packet');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  expect(/forge-mobile-v__FORGE_VERSION__/.test(sw) || /forge-mobile-v4\.9\.172/.test(sw), 'sw');
});

(async () => {
  let failed = 0;
  const rows = [];
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4172', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4172', name: t.name, ok: false, why: String(e.message || e).slice(0, 800) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
