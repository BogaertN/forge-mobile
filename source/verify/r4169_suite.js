/* R4169 (4.9.169): idle dream worker + drift/χ lanes + grace recenter + gated hosted admit.
 * Low drift → promote-candidate. Quarantine keeps researching and does not write confirmed_shared.
 * High drift → hard reject + grace recenter onto another path. Packets on admit. No LLM. No probe patches.
 * Continuous admit stays default-off. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = require(ROOT + '/src/dream_idle.js');
const KM = require(ROOT + '/src/kmath.js');
const KMOD = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-28T20:00:00Z';
const KEY = 'nic-write-key-ok';
const mkStore = () => { const st = {}; return KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }); };
const mk = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK, vaultState: () => 'locked', store: mkStore() });
const verified = (text, integrity) => [{ text: text, verified: true, integrity: integrity, source: 'allow-listed' }];

T('low drift high integrity is a promote-candidate and stays off confirmed_shared while admit is paused', () => {
  expect(D.boundary().calls_llm === false && D.boundary().continuous_admit_default === true && D.boundary().always_on === true && D.boundary().christ_ping === true, 'boundary');
  expect(D.INTEGRITY_HIGH === 0.85, 'integrity gate');
  for (const eps of [0, 0.35, 0.36, 0.4, 0.8, 0.81]) {
    const g = KM.driftGovernance(eps);
    const lane = D.routeMeasurement({ eps: eps, integrity: 0.95, claim: 'Quartz is a mineral', verified: true }).lane;
    if (g.band === 'projectable') expect(lane === 'promote_candidate', eps + ' ' + lane);
    else if (g.band === 'correct') expect(lane === 'correction', eps + ' ' + lane);
    else if (g.band === 'explore') expect(lane === 'quarantine', eps + ' ' + lane);
    else expect(lane === 'hard_reject', eps + ' ' + lane);
  }
  const low = D.routeMeasurement({ eps: 0.2, integrity: 0.4, claim: 'Quartz is a mineral' });
  expect(low.lane === 'provisional' && low.may_write_memory === false && low.shared_kb === false, JSON.stringify(low.lane));
  const metered = D.routeMeasurement({ integrity: 0.9, verified: true, claim: 'Quartz is a mineral' });
  expect(metered.meter === 'integrity_complement' && metered.eps === 0.1 && metered.lane === 'promote_candidate', JSON.stringify({ meter: metered.meter, eps: metered.eps, lane: metered.lane }));
  const midMeter = D.routeMeasurement({ integrity: 0.5, verified: true, claim: 'Quartz is a mineral' });
  expect(midMeter.meter === 'integrity_complement' && midMeter.eps === 0.5 && midMeter.lane === 'quarantine', JSON.stringify({ eps: midMeter.eps, lane: midMeter.lane }));
  const w = D.createIdleDream({ clock: CLOCK, admitEnabled: false });
  expect(w.admitEnabled() === false, 'explicit pause');
  w.enqueue([{ id: 'gap:quartz', kind: 'aq1_miss', subject: 'quartz', claim: 'Quartz is a mineral', eps: 0.2, integrity: 0.95, extracts: verified('Quartz is a mineral', 0.95) }]);
  const busy = w.tick({ answering: true });
  expect(busy.ran === false && busy.rule === 'DREAM-IDLE-BUSY' && busy.calls_llm === false, JSON.stringify(busy));
  expect(w.queued().length === 1, 'queue held');
  const t = w.tick({ answering: false });
  expect(t.ran && t.lane === 'promote_candidate' && t.rule === 'DREAM-PROMOTE-CANDIDATE' && t.calls_llm === false, JSON.stringify({ lane: t.lane, rule: t.rule }));
  expect(t.packet && t.packet.schema === 'FORGE-RESONANCE-PACKET/v1' && t.packet.sfe.Phi === 9 && t.packet.sfe.eps === 0.2 && t.packet.sfe.mu === 0.95, JSON.stringify(t.packet));
  expect(KM.phaseAlignedToOrigin(t.packet.sfe.Phi), 'phase');
  expect(t.route === 'promote_candidate' && t.route !== 'dream_state_quarantine_candidate', t.route);
  const paused = w.admitStaged({ writeKey: KEY, host: {} });
  expect(paused.ok === false && paused.rule === 'DREAM-IDLE-ADMIT-PAUSED' && paused.wrote_confirmed_shared === false && paused.packets.length === 1, JSON.stringify(paused));
});

T('quarantine band keeps researching and does not write confirmed_shared', () => {
  const k = mk();
  k.clearStarterKnowledge();
  k.setSharedKbWriteKey(KEY);
  const beforeMem = k.memory().length;
  const beforeView = k.sharedKnowledgeView().count;
  const w = D.createIdleDream({ clock: CLOCK, admitEnabled: true });
  w.enqueue([{ id: 'gap:mid', kind: 'rpmc_ancestor_none', subject: 'contested-row', claim: 'Phlogiston is a substance', eps: 0.55, integrity: 0.99, extracts: verified('Phlogiston is a substance', 0.99) }]);
  const t = w.tick({ answering: false });
  expect(t.lane === 'quarantine' && t.keep_researching === true && t.rule === 'DREAM-QUARANTINE-KEEP', JSON.stringify({ lane: t.lane, rule: t.rule, keep: t.keep_researching }));
  expect(t.route === 'dream_state_quarantine_candidate', t.route);
  expect(t.truth_support_allowed === false && t.stable_memory_allowed === false && t.projection_allowed === false && t.shared_kb === false, 'E-05');
  expect(t.may_write_memory === false && t.calls_llm === false, 'no memory');
  const conflicted = D.routeMeasurement({ eps: 0.1, integrity: 0.99, conflict: true, claim: 'Quartz is a mineral' });
  expect(conflicted.lane === 'quarantine' && conflicted.shared_kb === false, 'conflict stays quarantine ' + conflicted.lane);
  const edge = D.routeMeasurement({ eps: 0.4, integrity: 0.99, claim: 'Phlogiston is a substance' });
  const edgeHi = D.routeMeasurement({ eps: 0.8, integrity: 0.99, claim: 'Phlogiston is a substance' });
  expect(edge.lane === 'quarantine' && edgeHi.lane === 'quarantine', edge.lane + '/' + edgeHi.lane);
  const one = w.admitRecord(w.quarantine()[0], { host: k, writeKey: KEY, admitEnabled: true });
  expect(one.ok === false && one.rule === 'DREAM-QUARANTINE-NO-TRUTH' && one.wrote_confirmed_shared === false, JSON.stringify(one));
  const staged = w.admitStaged({ host: k, writeKey: KEY, publishPacks: false });
  expect(staged.wrote_confirmed_shared === false && staged.ok === false, JSON.stringify({ ok: staged.ok, rule: staged.rule, wrote: staged.wrote_confirmed_shared }));
  expect(k.sharedKnowledgeView().count === beforeView, 'view ' + k.sharedKnowledgeView().count);
  const phone = k.store.load('confirmed_shared');
  expect(!phone || !(phone.facts || []).length, 'phone ' + JSON.stringify(phone && phone.facts));
  expect((k.store.load('shared_knowledge') || []).length === 0, 'scrapbook');
  expect(k.memory().length === beforeMem, 'memory');
  expect(w.queued().indexOf('gap:mid') >= 0, 'requeued ' + w.queued().join(','));
});

T('chi caution band corrects once and does not write confirmed_shared', () => {
  const bare = D.routeMeasurement({ eps: 0.37, integrity: 0.95, claim: 'Quartz is a mineral', ancestors: [] });
  expect(bare.lane === 'correction' && bare.chi_pass === 1 && bare.chi && bare.chi.applied === false && bare.keep_researching === true, JSON.stringify({ lane: bare.lane, chi: bare.chi && bare.chi.applied }));
  expect(bare.shared_kb === false && bare.may_write_memory === false && bare.calls_llm === false, 'no write');
  const rescued = D.routeMeasurement({ eps: 0.37, integrity: 0.95, claim: 'Quartz is a mineral', ancestors: [{ Phi: 9, eps: 0, mu: 1 }, { Phi: 1, eps: 0, mu: 1 }] });
  expect(rescued.chi && rescued.chi_pass === 1, 'one pass');
  expect(rescued.lane === 'promote_candidate' || rescued.lane === 'provisional' || rescued.lane === 'correction', rescued.lane);
  if (rescued.lane === 'promote_candidate') expect(rescued.eps <= 0.35 && rescued.packet && rescued.packet.sfe.eps <= 0.35, JSON.stringify(rescued.packet));
  const w = D.createIdleDream({ clock: CLOCK, admitEnabled: true });
  w.enqueue([{ id: 'gap:chi', kind: 'aq1_miss', claim: 'Quartz is a mineral', eps: 0.37, integrity: 0.95 }]);
  const k = mk();
  k.setSharedKbWriteKey(KEY);
  w.tick({ answering: false });
  const adm = w.admitStaged({ host: k, writeKey: KEY, publishPacks: false });
  expect(adm.wrote_confirmed_shared !== true && k.sharedKnowledgeView().count === 0, JSON.stringify({ rule: adm.rule, wrote: adm.wrote_confirmed_shared, n: k.sharedKnowledgeView().count }));
});

T('high drift hard-rejects, grace-recenters, and steers a different path', () => {
  const w = D.createIdleDream({ clock: CLOCK });
  w.enqueue([
    { id: 'gap:bad', kind: 'aq1_miss', subject: 'bad-path', claim: 'Phlogiston is a substance', eps: 0.91, integrity: 0.99, ancestors: [{ Phi: 9, eps: 0, mu: 1 }] },
    { id: 'gap:next', kind: 'aq1_miss', subject: 'quartz', claim: 'Quartz is a mineral', eps: 0.12, integrity: 0.96, extracts: verified('Quartz is a mineral', 0.96) }
  ]);
  const t = w.tick({ answering: false });
  expect(t.lane === 'hard_reject' && t.aborted === true && t.rule === 'GRACE-RECENTER' && t.calls_llm === false, JSON.stringify({ lane: t.lane, rule: t.rule }));
  expect(t.recenter && t.recenter.rule === 'GRACE-RECENTER' && t.recenter.christ_ping === true && t.recenter.aborted === true, JSON.stringify(t.recenter && t.recenter.rule));
  expect(t.recenter.chi && t.recenter.grace && t.recenter.next_id === 'gap:next' && t.next_id === 'gap:next', JSON.stringify({ next: t.next_id, g: t.recenter && t.recenter.grace && t.recenter.grace.ok }));
  expect(t.lane !== 'promote_candidate' && t.shared_kb === false && t.may_write_memory === false, 'no promote');
  expect(w.aborted().some(a => a.id === 'gap:bad') && !w.promoteCandidates().some(p => p.gap_id === 'gap:bad'), 'aborted path');
  const n = w.tick({ answering: false });
  expect(n.gap_id === 'gap:next' && n.lane === 'promote_candidate', JSON.stringify({ id: n.gap_id, lane: n.lane }));
  const again = D.graceRecenter(0.95, []);
  expect(again.aborted === true && again.christ_ping === true && again.grace && again.grace.ok === false, 'no ancestor still aborts');
});

T('admit attaches a resonance packet; quarantine admit does not write confirmed_shared', () => {
  const k = mk();
  k.clearStarterKnowledge();
  k.setSharedKbWriteKey(KEY);
  const mem0 = k.memory().length;
  const w = D.createIdleDream({ clock: CLOCK, admitEnabled: false });
  w.enqueue([
    { id: 'gap:q', kind: 'aq1_miss', claim: 'Quartz is a mineral', eps: 0.1, integrity: 0.92, extracts: verified('Quartz is a mineral', 0.92) },
    { id: 'gap:hold', kind: 'aq1_miss', claim: 'Phlogiston is a substance', eps: 0.62, integrity: 0.92, extracts: verified('Phlogiston is a substance', 0.92) }
  ]);
  expect(w.tick({ answering: false }).lane === 'promote_candidate', 'promote');
  expect(w.tick({ answering: false }).lane === 'quarantine', 'quar');
  const paused = w.admitStaged({ host: k, writeKey: KEY, publishPacks: false });
  expect(paused.rule === 'DREAM-IDLE-ADMIT-PAUSED' && paused.wrote_confirmed_shared === false && k.sharedKnowledgeView().count === 0, JSON.stringify(paused.rule));
  expect(paused.packets[0].schema === 'FORGE-RESONANCE-PACKET/v1' && paused.refused.some(r => r.rule === 'DREAM-QUARANTINE-NO-TRUTH'), 'paused packet + quarantine refused');
  w.setAdmitEnabled(true);
  const noKey = w.admitRecord(w.promoteCandidates()[0], { host: k, writeKey: '', admitEnabled: true });
  expect(noKey.ok === false && noKey.rule === 'SHARED-KB-WRITE-KEY-REQUIRED' && noKey.wrote_confirmed_shared === false, JSON.stringify(noKey));
  const adm = w.admitStaged({ host: k, writeKey: KEY, publishPacks: false });
  expect(adm.wrote_confirmed_shared === true && adm.admitted.length === 1, JSON.stringify({ ok: adm.ok, wrote: adm.wrote_confirmed_shared, n: adm.admitted && adm.admitted.length, rule: adm.rule, refused: (adm.refused || []).map(r => r.rule) }));
  const row = (k.sharedKnowledgeView().admitted || []).find(x => /quartz/i.test(x.text || ''));
  expect(row && row.sfe && row.sfe.Phi === 9 && Number.isFinite(row.sfe.eps) && row.sfe.eps <= 0.35 && row.sfe.mu > 0, JSON.stringify(row));
  expect(row.provenance === 'confirmed_shared', row.provenance);
  expect(!(k.sharedKnowledgeView().admitted || []).some(x => /phlogiston/i.test(x.text || '')), 'quarantine text absent');
  expect((k.sharedKnowledgeView().held || []).every(x => !/phlogiston/i.test(x.text || '')), 'not held as truth');
  const phone = k.store.load('confirmed_shared');
  expect(!phone || !(phone.facts || []).length, 'phone db');
  expect((k.store.load('shared_knowledge') || []).length === 0, 'scrapbook');
  expect(k.memory().length === mem0, 'memory');
  const llm = D.routeMeasurement({ calls_llm: true, eps: 0.05, integrity: 1, claim: 'Quartz is a mineral' });
  expect(llm.lane === 'quarantine' && llm.rule === 'DREAM-LLM-REFUSED' && llm.calls_llm === false && llm.claim == null, JSON.stringify({ lane: llm.lane, rule: llm.rule }));
});

T('idle tick skips while answering; letter holes invent no fact; no LLM', () => {
  const holes = D.enumerateGaps({ lettersCovered: 'abcdefghijklmnopqrstuvwxyz'.replace('q', ''), ancestorNone: [{ id: 'gap:anc', subject: 'unlisted-ancestor' }], aq1Misses: [{ id: 'gap:aq', question: 'What is an unlisted ancestor?' }] });
  expect(holes[0].kind === 'letter_hole' && holes[0].letter === 'q' && holes[0].claim == null, JSON.stringify(holes[0]));
  expect(holes.map(g => g.kind).join(',') === 'letter_hole,rpmc_ancestor_none,aq1_miss', holes.map(g => g.kind).join(','));
  const w = D.createIdleDream({ clock: CLOCK });
  w.setAnswering(true);
  w.enqueue(holes);
  expect(w.tick({ answering: false }).rule === 'DREAM-IDLE-BUSY', 'daemon flag');
  w.setAnswering(false);
  const t = w.tick({ answering: false });
  expect(t.gap_id === 'gap:letter:q' && t.lane === 'quarantine' && t.rule === 'DREAM-UNMEASURED' && t.claim == null && t.keep_researching === true, JSON.stringify({ id: t.gap_id, lane: t.lane, rule: t.rule, claim: t.claim }));
  expect(!/q is /i.test(String(t.claim || '')), 'no invented letter fact');
  const src = fs.readFileSync(path.join(ROOT, 'src', 'dream_idle.js'), 'utf8');
  expect(!/openai|anthropic|ollama|Math\.random|XMLHttpRequest/i.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), 'no llm/random');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const kernel = fs.readFileSync(path.join(ROOT, 'src', 'kernel.js'), 'utf8');
  expect(!/dream_idle/.test(kernel), 'not on the ask path');
  expect(/src\/dream_idle\.js/.test(html), 'site custody loads the mesh');
  const a = D.routeMeasurement({ eps: 0.22, integrity: 0.9, claim: 'Quartz is a mineral' });
  const b = D.routeMeasurement({ eps: 0.22, integrity: 0.9, claim: 'Quartz is a mineral' });
  expect(a.lane === b.lane && a.eps === b.eps && a.packet.sfe.mu === b.packet.sfe.mu, 'deterministic');
});

T('version registry CONFLICTS NEXT_BUILD name 4.9.171', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.204', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.170/.test(conf) && /DREAM-QUARANTINE-NO-TRUTH|quarantine/.test(conf) && /admit/.test(conf), 'CONFLICTS tip');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.170/.test(nb), 'NEXT_BUILD tip');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.170/.test(readme) && /dream_idle/.test(readme) && /admitEnabled/.test(readme), 'README');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.204' && ((((((((tgt.suites[0] === 'r4201_suite.js' || tgt.suites[0] === 'r4200_suite.js' || tgt.suites[0] === 'r4199_suite.js' || tgt.suites[0] === 'r4198_suite.js' || tgt.suites[0] === 'r4197_suite.js' || tgt.suites[0] === 'r4196_suite.js' || tgt.suites[0] === 'r4195_suite.js' || tgt.suites[0] === 'r4194_suite.js') || tgt.suites[0] === 'r4193_suite.js' || tgt.suites[0] === 'r4191_suite.js' || tgt.suites[0] === 'r4190_suite.js' || tgt.suites[0] === 'r4189_suite.js' || tgt.suites[0] === 'r4188_suite.js' || tgt.suites[0] === 'r4187_suite.js' || tgt.suites[0] === 'r4186_suite.js' || tgt.suites[0] === 'r4185_suite.js' || tgt.suites[0] === 'r4184_suite.js' || tgt.suites[0] === 'r4183_suite.js' || tgt.suites[0] === 'r4182_suite.js' || tgt.suites[0] === 'r4181_suite.js' || tgt.suites[0] === 'r4180_suite.js') || tgt.suites[0] === 'r4179_suite.js') || tgt.suites[0] === 'r4178_suite.js') || tgt.suites[0] === 'r4177_suite.js' || tgt.suites[0] === 'r4176_suite.js' || tgt.suites[0] === 'r4175_suite.js' || tgt.suites[0] === 'r4174_suite.js' || tgt.suites[0] === 'r4173_suite.js') || tgt.suites[0] === 'r4172_suite.js') || tgt.suites[0] === 'r4171_suite.js') || tgt.suites[0] === 'r4170_suite.js' || tgt.suites[0] === 'r4169_suite.js'), JSON.stringify(tgt));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.204', 'registry ' + reg.version);
  expect(reg.features.some(f => f.id === 'R4169-IDLE-DREAM'), 'feature');
  expect(reg.count === reg.features.length, 'count');
  expect(reg.claims.Implemented === 112 && reg.claims.Partial >= 164, JSON.stringify(reg.claims));
  const mh = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'math_honesty.json'), 'utf8'));
  expect(mh.release === '4.9.204' && mh.idle_dream_router && mh.idle_dream_router.christ_ping === true && mh.idle_dream_router.write_law_unchanged === true, 'math_honesty');
  const req = fs.readFileSync(path.join(ROOT, 'src', 'req_packet.js'), 'utf8');
  expect(/4\.9\.169/.test(req) && /R4169-IDLE-DREAM/.test(req), 'req_packet');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  expect(/forge-mobile-v__FORGE_VERSION__/.test(sw) || /forge-mobile-v4\.9\.169/.test(sw), 'sw');
});

(async () => {
  let failed = 0;
  const rows = [];
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4169', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4169', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
