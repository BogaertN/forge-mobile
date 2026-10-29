/* R4171 (4.9.171): Athena spawn mesh on the 4.9.170 registry.
 * Lifecycle, budget refuses, Ask pause of every helper, maySpawn/mayAdmit,
 * cold-bank integrity, packet shape, research contract, single admit.
 * Quarantine does not write confirmed_shared. No LLM. Continuous fill stays paused. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = require(ROOT + '/src/dream_idle.js');
const sha256 = require(ROOT + '/src/sha256.js').sha256;
const KMOD = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-28T22:00:00Z';
const KEY = 'nic-write-key-ok';
const mkStore = () => { const st = {}; return KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }); };
const mk = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK, vaultState: () => 'locked', store: mkStore() });
const verified = (text, integrity) => [{ text: text, verified: true, integrity: integrity, source: 'allow-listed' }];
const quartzGap = extra => Object.assign({ kind: 'aq1_miss', claim: 'Quartz is a mineral', eps: 0.12, integrity: 0.95, extracts: verified('Quartz is a mineral', 0.95), calls_llm: false }, extra || {});
function idlePacket(extra) {
  return Object.assign({ schema: D.SCHEMA, calls_llm: false, parent: 'gilligan', spawned_by: 'athena' }, extra || {});
}
function researchSpec(gapId, parent) {
  return {
    task: 'research', parent: parent || 'gilligan', spawned_by: 'athena', gap_id: gapId,
    packet: idlePacket({ task: 'research', parent: parent || 'gilligan', gap_id: gapId, kind: 'aq1_miss', eps: 0.12, integrity: 0.95, claim: 'Quartz is a mineral' })
  };
}
function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dream-mesh-'));
  const seed = { schema: 'FORGE-CONFIRMED-PACK/v1', format: 'FORGE-CONFIRMED-PACK/v1', pack_id: 'confirmed_shared_letter_q', provenance: 'confirmed_shared', letter: 'Q', who_confirmed: 'product_curator', shared_kb: false, curated_facts: 1, items: [{ id: 'cs_seed_q', text: 'Qatar hosts Doha', standing: 'projectable', evidence: 'geography · curator', sfe: { Phi: 9, eps: 0, mu: 1 } }] };
  fs.writeFileSync(path.join(dir, 'q.json'), JSON.stringify(seed, null, 1) + '\n');
  const index = { schema: 'FORGE-CONFIRMED-SHARED-INDEX/v1', provenance: 'confirmed_shared', version: '4.9.168', letters: ['q'], packs: { q: { path: 'q.json', letter: 'Q', items: 1, curated_facts: 1 } }, total_items: 1, total_curated: 1 };
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index, null, 1) + '\n');
  return dir;
}

T('registry lifecycle spawns, hibernates, retires into a hashed cold bank, and resurrects', () => {
  const b = D.boundary();
  expect(b.calls_llm === false && b.os_process_pool === false && b.continuous_fill === 'backend_hosted' && b.christ_ping === true && b.always_on === true && b.idle_gated === false && b.spawn_pool === 'in_process_mesh', JSON.stringify({ pool: b.spawn_pool, fill: b.continuous_fill }));
  expect(b.spawn_budget.max_helpers === 8 && b.spawn_budget.max_per_parent === 4 && b.spawn_budget.max_spawn_per_idle_window === 8, JSON.stringify(b.spawn_budget));
  expect(b.priority.join(',') === 'neo,athena,gilligan', b.priority.join(','));
  const a = D.createIdleOrchestrator({ clock: CLOCK });
  expect(a.orchestrator === 'FORGE-IDLE-ORCHESTRATOR/v1' && a.lifecycle.join(',') === 'spawn,run,hibernate,retire,resurrect', a.lifecycle.join(','));
  const spawned = a.spawn('resonance_place', 'gate');
  expect(spawned.ok === true && spawned.agent.os_process === false && spawned.agent.status === 'active' && spawned.agent.active === true && spawned.packet.schema === D.SCHEMA && spawned.calls_llm === false, JSON.stringify(spawned.agent));
  expect(spawned.agent.psi1 === D.PSI1 && spawned.agent.drift_index && spawned.agent.drift_index.status === 'unmeasured', JSON.stringify(spawned.agent.drift_index));
  expect(spawned.packet.manifest && spawned.packet.manifest.source_trace === D.PSI1 && spawned.packet.manifest.forbidden_actions.indexOf('calls_llm') >= 0 && spawned.packet.manifest.forbidden_actions.indexOf('direct_peer') >= 0, JSON.stringify(spawned.packet.manifest));
  expect(a.spcLog().length === 1 && a.spcLog()[0].wrote_confirmed_shared === false && a.spcLog()[0].psi1 === D.PSI1, JSON.stringify(a.spcLog()[0]));
  expect(a.ancestry()[0].phase === 'spawn' && a.ancestry()[0].phase_index === 'init', JSON.stringify(a.ancestry()[0]));
  expect(D.boundary().docs.orchestration === '1O5Txx2rLvWehvmHY_8miMtVrFTqmQgo_xLyzA_P5dGA' && D.boundary().docs.rmc_10_8 === '1COtSEuXYxfgfomzDBu99jrnaHoLWuIM79WVUy-glq54' && D.boundary().idle_drift_below === 0.4, JSON.stringify(D.boundary().docs));
  expect(a.listActive().length === 1 && a.listActive()[0].id === spawned.agent.id, 'active');
  const ran = a.run(spawned.agent.id, { rec: { lane: 'quarantine', route: 'dream_state_quarantine_candidate', eps: 0.55 } });
  expect(ran.ok === false && ran.rule === 'DREAM-QUARANTINE-NO-TRUTH' && ran.wrote_confirmed_shared === false && ran.wrote_pack === false && ran.schema === D.SCHEMA, JSON.stringify(ran));
  const hib = a.hibernateHelper(spawned.agent.id);
  expect(hib.ok === true && hib.agent.status === 'hibernated' && a.listActive().length === 0, JSON.stringify(hib.agent));
  const blocked = a.run(spawned.agent.id, { rec: { lane: 'promote_candidate', eps: 0 } });
  expect(blocked.rule === 'ATHENA-HELPER-NOT-ACTIVE', JSON.stringify(blocked));
  const retired = a.retireHelper(spawned.agent.id);
  expect(retired.ok === true && retired.agent.status === 'retired' && retired.cold && retired.cold.wrote_confirmed_shared === false, JSON.stringify(retired.cold));
  const cold = a.coldBank();
  expect(cold.length === 1 && cold[0].schema === D.COLD_SCHEMA && cold[0].wrote_confirmed_shared === false && cold[0].wrote_pack === false && sha256(cold[0].bytes) === cold[0].sha256, 'cold hash');
  expect(a.resurrect('missing').rule === 'ATHENA-HELPER-UNKNOWN', 'unknown');
  const back = a.resurrectHelper(spawned.agent.id);
  expect(back.ok === true && back.agent.status === 'active' && a.listActive().length === 1, JSON.stringify(back.agent));
  const phases = a.ancestry().map(x => x.phase);
  for (const phase of ['spawn', 'run', 'hibernate', 'retire', 'resurrect']) expect(phases.indexOf(phase) >= 0, phases.join(','));
  const src = fs.readFileSync(path.join(ROOT, 'src', 'dream_idle.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  expect(!/setInterval|setTimeout|child_process|openai|anthropic|ollama/.test(src), 'no timer, process pool, or model');
});

T('spawn budget refuses a parent storm, a helper storm, and an idle-window storm', () => {
  const parent = D.createAthena({ clock: CLOCK });
  for (let i = 0; i < D.SPAWN_BUDGET.max_per_parent; i++) {
    const row = parent.spawnHelper(researchSpec('parent-' + i, 'gilligan'));
    expect(row.ok === true && row.wrote_confirmed_shared === false, i + ' ' + JSON.stringify(row));
  }
  const overParent = parent.spawnHelper({
    task: 'letter_fill', parent: 'gilligan', spawned_by: 'athena', gap_id: 'letter-q', letter: 'q',
    packet: idlePacket({ task: 'letter_fill', gap_id: 'letter-q', kind: 'letter_hole', letter: 'q' })
  });
  expect(overParent.ok === false && overParent.rule === 'ATHENA-SPAWN-PARENT-CAP' && overParent.wrote_confirmed_shared === false && parent.helpers().length === D.SPAWN_BUDGET.max_per_parent, JSON.stringify(overParent));
  const storm = D.createAthena({ clock: CLOCK });
  for (let i = 0; i < D.SPAWN_BUDGET.max_helpers; i++) {
    const row = storm.spawnHelper(researchSpec('storm-' + i, 'parent-' + i));
    expect(row.ok === true, 'helper ' + i + ' ' + JSON.stringify(row));
  }
  const overHelpers = storm.spawnHelper(researchSpec('storm-extra', 'parent-extra'));
  expect(overHelpers.ok === false && overHelpers.rule === 'ATHENA-SPAWN-CAP' && storm.listActive().length === D.SPAWN_BUDGET.max_helpers, JSON.stringify(overHelpers));
  const windowed = D.createAthena({ clock: CLOCK });
  for (let i = 0; i < D.SPAWN_BUDGET.max_spawn_per_idle_window; i++) {
    const row = windowed.spawnHelper({
      task: 'ancestor_probe', parent: 'athena', spawned_by: 'athena', gap_id: 'win-' + i,
      packet: idlePacket({ task: 'ancestor_probe', parent: 'athena', gap_id: 'win-' + i, kind: 'rpmc_ancestor_none', ancestors: [], eps: 0.2, integrity: 0.9, claim: 'Quartz is a mineral' })
    });
    expect(row.ok === true, 'window ' + i + ' ' + JSON.stringify(row));
    expect(windowed.retireHelper(row.agent.id).ok === true, 'retire ' + i);
  }
  expect(windowed.listActive().length === 0, 'retired out of the living cap');
  const overWindow = windowed.spawn('pack_append');
  expect(overWindow.ok === false && overWindow.rule === 'ATHENA-SPAWN-WINDOW-CAP' && overWindow.wrote_pack === false && overWindow.wrote_confirmed_shared === false, JSON.stringify(overWindow));
  windowed.setAnswering(true);
  windowed.setAnswering(false);
  const afterIdle = windowed.spawn('pack_append');
  expect(afterIdle.ok === true && afterIdle.agent.task === 'pack_append', JSON.stringify(afterIdle));
});

T('Ask answering pauses every helper and Gilligan yields to Athena', () => {
  const w = D.createIdleDream({ clock: CLOCK });
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const row = w.spawnHelper(researchSpec('ask-' + i, 'gilligan'));
    expect(row.ok === true, JSON.stringify(row));
    ids.push(row.agent.id);
  }
  w.setAnswering(true);
  expect(w.listActive().length === 0, 'none active');
  const held = w.helpers();
  expect(held.length === 3 && held.every(h => h.status === 'hibernated' && h.hold === 'ask'), JSON.stringify(held.map(h => [h.status, h.hold])));
  const run = w.athena.run(ids[0], { gap: quartzGap() });
  expect(run.ok === false && run.rule === 'DREAM-IDLE-BUSY' && run.ran === false, JSON.stringify(run));
  const spawned = w.athena.spawn('resonance_place');
  expect(spawned.ok === false && spawned.rule === 'DREAM-IDLE-BUSY' && w.helpers().length === 3, JSON.stringify(spawned));
  w.enqueue([Object.assign({ id: 'gap:wait' }, quartzGap())]);
  const tick = w.tick({ answering: false });
  expect(tick.ran === false && tick.rule === 'DREAM-IDLE-BUSY' && w.queued()[0] === 'gap:wait', JSON.stringify(tick));
  w.setAnswering(false);
  expect(w.listActive().map(h => h.id).sort().join(',') === ids.slice().sort().join(','), 'resumed');
  const gate = w.athena.spawn('resonance_place');
  expect(gate.ok === true && gate.agent.status === 'active', JSON.stringify(gate));
  const deferred = w.tick({ answering: false });
  expect(deferred.ran === false && deferred.rule === 'DREAM-ATHENA-PRIORITY' && w.queued()[0] === 'gap:wait', JSON.stringify(deferred));
  expect(w.daemons().find(d => d.role === 'gilligan').spawns_helpers === false, 'gilligan does not spawn');
  expect(w.daemons().find(d => d.role === 'neo').spawns_helpers === false, 'neo does not spawn');
  expect(w.daemons().find(d => d.role === 'athena').spawns_helpers === true, 'athena authorizes');
});

T('Athena maySpawn and mayAdmit refuse Neo, freeform, a held domain, and a second admit', () => {
  const w = D.createIdleDream({ clock: CLOCK });
  const neo = w.maySpawn({ task: 'research', parent: 'neo', spawned_by: 'neo', packet: idlePacket({ task: 'research', parent: 'neo', gap_id: 'n' }) });
  expect(neo.ok === false && neo.rule === 'NEO-DOES-NOT-SPAWN' && neo.wrote_confirmed_shared === false, JSON.stringify(neo));
  const gilligan = w.maySpawn({ task: 'research', parent: 'gilligan', spawned_by: 'gilligan', gap_id: 'g', packet: idlePacket({ task: 'research', spawned_by: 'gilligan', gap_id: 'g' }) });
  expect(gilligan.ok === false && gilligan.rule === 'GILLIGAN-DOES-NOT-SPAWN', JSON.stringify(gilligan));
  const free = w.maySpawn({ task: 'research', parent: 'athena', packet: { hello: 'freeform' } });
  expect(free.ok === false && free.rule === 'DREAM-PACKET-REQUIRED', JSON.stringify(free));
  const llm = w.maySpawn({ task: 'research', calls_llm: true, parent: 'athena', packet: idlePacket({ task: 'research', calls_llm: true, gap_id: 'm' }) });
  expect(llm.ok === false && llm.rule === 'DREAM-LLM-REFUSED' && llm.calls_llm === false, JSON.stringify(llm));
  const hard = w.maySpawn({ task: 'research', parent: 'gilligan', gap_id: 'hard', eps: 0.91, packet: idlePacket({ task: 'research', gap_id: 'hard', kind: 'aq1_miss', eps: 0.91 }) });
  expect(hard.ok === false && hard.rule === 'ATHENA-SPAWN-HARD-REJECT', JSON.stringify(hard));
  const first = w.spawnHelper(researchSpec('same-gap', 'gilligan'));
  expect(first.ok === true, JSON.stringify(first));
  const second = w.maySpawn(researchSpec('same-gap', 'athena'));
  expect(second.ok === false && second.rule === 'ATHENA-DOMAIN-HELD' && /gap_research:same-gap/.test(second.domain || ''), JSON.stringify(second));
  const quarantined = D.routeMeasurement({ eps: 0.55, integrity: 0.99, claim: 'Phlogiston is a substance', extracts: verified('Phlogiston is a substance', 0.99) });
  const refused = w.mayAdmit(Object.assign({ gap_id: 'gap:phlog' }, quarantined));
  expect(refused.ok === false && refused.rule === 'DREAM-QUARANTINE-NO-TRUTH' && refused.wrote_confirmed_shared === false && refused.wrote_pack === false, JSON.stringify(refused));
  const k = mk();
  k.clearStarterKnowledge();
  k.setSharedKbWriteKey(KEY);
  const before = k.sharedKnowledgeView().count;
  const direct = w.admitRecord(Object.assign({ gap_id: 'gap:phlog' }, quarantined), { host: k, writeKey: KEY, publishPacks: false });
  expect(direct.ok === false && direct.rule === 'DREAM-QUARANTINE-NO-TRUTH' && direct.wrote_confirmed_shared === false, JSON.stringify(direct));
  expect(k.sharedKnowledgeView().count === before, 'quarantine admit wrote nothing');
  const phone = k.store.load('confirmed_shared');
  expect(!phone || !(phone.facts || []).length, 'phone ' + JSON.stringify(phone && phone.facts));
  const cold = w.coldBank().filter(r => r.route === 'dream_state_quarantine_candidate');
  expect(cold.length >= 1 && cold.every(r => r.wrote_confirmed_shared === false && r.wrote_pack === false), 'cold custody');
});

T('helper results are resonance or idle-dream packets and research refuses a model', () => {
  const a = D.createAthena({ clock: CLOCK });
  const resonance = a.spawnHelper({
    task: 'research', parent: 'gilligan', spawned_by: 'athena', gap_id: 'res',
    packet: { schema: D.PACKET_SCHEMA, Phi: 9, eps: 0.12, mu: 0.95, sfe: { Phi: 9, eps: 0.12, mu: 0.95 }, task: 'research', gap_id: 'res', calls_llm: false }
  });
  expect(resonance.ok === true && resonance.packet.schema === D.PACKET_SCHEMA && resonance.packet.sfe.Phi === 9 && resonance.packet.sfe.eps === 0.12 && resonance.packet.sfe.mu === 0.95, JSON.stringify(resonance.packet));
  const ran = a.run(resonance.agent.id, { gap: quartzGap() });
  expect(ran.schema === D.SCHEMA && ran.packet && ran.packet.schema === D.PACKET_SCHEMA && ran.packet.sfe.eps === 0.12 && ran.lane === 'promote_candidate' && ran.calls_llm === false, JSON.stringify({ lane: ran.lane, eps: ran.eps, schema: ran.schema }));
  a.retire(resonance.agent.id);
  expect(a.resurrect(resonance.agent.id).ok === true, 'projectable research returns');
  const tooFar = a.maySpawn({ task: 'research', parent: 'gilligan', spawned_by: 'athena', gap_id: 'mid', eps: 0.55, packet: idlePacket({ task: 'research', gap_id: 'mid', kind: 'aq1_miss', eps: 0.55 }) });
  expect(tooFar.ok === false && tooFar.rule === 'ATHENA-SPAWN-DRIFT' && tooFar.wrote_confirmed_shared === false, JSON.stringify(tooFar));
  const drifted = a.spawnHelper({
    task: 'research', parent: 'gilligan', spawned_by: 'athena', gap_id: 'drift',
    packet: idlePacket({ task: 'research', gap_id: 'drift', kind: 'aq1_miss', eps: 0.12, integrity: 0.99, claim: 'Quartz is a mineral' })
  });
  expect(drifted.ok === true, JSON.stringify(drifted));
  a.run(drifted.agent.id, { gap: { kind: 'aq1_miss', claim: 'Phlogiston is a substance', eps: 0.55, integrity: 0.99, extracts: verified('Phlogiston is a substance', 0.99) } });
  a.retire(drifted.agent.id);
  const stay = a.resurrect(drifted.agent.id);
  expect(stay.ok === false && stay.rule === 'ATHENA-RESURRECT-DRIFT' && stay.wrote_confirmed_shared === false, JSON.stringify(stay));
  const row = a.coldBank().find(r => r.id === drifted.agent.id);
  expect(row && row.route === 'dream_state_quarantine_candidate' && row.wrote_confirmed_shared === false, JSON.stringify(row && row.route));
  const dumped = JSON.parse(a.exportCold());
  dumped[0].bytes = dumped[0].bytes.replace('athena', 'ATHENA');
  const tampered = a.loadCold(JSON.stringify(dumped));
  expect(tampered.ok === false && tampered.rule === 'ATHENA-RESURRECT-INTEGRITY', JSON.stringify(tampered));
  expect(a.coldBank().some(r => r.id === resonance.agent.id) && a.resurrect(resonance.agent.id).rule === 'ATHENA-HELPER-NOT-ACTIVE', 'bank unchanged and the live helper stays active');
  const unmeasured = a.spawnHelper({
    task: 'extract', parent: 'gilligan', spawned_by: 'athena', gap_id: 'null-eps',
    packet: idlePacket({ task: 'extract', gap_id: 'null-eps', kind: 'aq1_miss', eps: null, claim: 'Quartz is a mineral' })
  });
  const measured = a.run(unmeasured.agent.id, { gap: { kind: 'aq1_miss', claim: 'Quartz is a mineral', eps: null, integrity: 0.99, extracts: verified('Quartz is a mineral', 0.99) } });
  expect(measured.eps == null && measured.rule === 'DREAM-UNMEASURED' && measured.may_project === false, JSON.stringify({ eps: measured.eps, rule: measured.rule, meter: measured.meter }));
  a.retire(unmeasured.agent.id);
  expect(a.resurrect(unmeasured.agent.id).rule === 'DREAM-RESURRECT-UNMEASURED', 'null eps is not a lawful return');
  const contract = D.applyResearchContract({ extracts: [{ text: 'from the open web', verified: true, integrity: 1, source: 'crawl' }], claim: 'Quartz is a mineral', eps: 0.05 });
  expect(contract.ok === false && contract.rule === 'DREAM-RESEARCH-CONTRACT' && contract.body.claim == null && contract.body.eps == null, JSON.stringify(contract));
  const shaped = D.routeMeasurement(D.applyResearchContract({ llm: true, eps: 0, claim: 'Quartz is a mineral', extracts: verified('Quartz is a mineral', 1) }).body);
  expect(shaped.rule === 'DREAM-LLM-REFUSED' && shaped.calls_llm === false && shaped.claim == null && shaped.lane === 'quarantine', JSON.stringify({ rule: shaped.rule, eps: shaped.eps, lane: shaped.lane }));
  const mismatch = a.spawnHelper({ task: 'letter_fill', parent: 'athena', gap_id: 'bad-letter', packet: idlePacket({ task: 'letter_fill', gap_id: 'bad-letter', kind: 'aq1_miss' }) });
  const wrong = a.run(mismatch.agent.id, { gap: { kind: 'aq1_miss', claim: 'Quartz is a mineral' } });
  expect(wrong.ok === false && wrong.rule === 'ATHENA-TASK-MISMATCH' && wrong.wrote_confirmed_shared === false, JSON.stringify(wrong));
});

T('orchestrator forks a seeded helper and refuses a direct peer call', () => {
  const a = D.createAthena({ clock: CLOCK });
  const parent = a.spawnHelper(researchSpec('fork-src', 'gilligan'));
  expect(parent.ok === true && parent.agent.psi1 === D.PSI1, JSON.stringify(parent.agent && parent.agent.psi1));
  const peer = a.run(parent.agent.id, { peer: 'athena-9', gap: quartzGap() });
  expect(peer.ok === false && peer.rule === 'ORCH-UNMEDIATED' && peer.wrote_confirmed_shared === false && a.listActive().length === 1, JSON.stringify(peer));
  const forked = a.forkHelper(parent.agent.id);
  expect(forked.ok === true && forked.forked_from === parent.agent.id && forked.agent.id !== parent.agent.id && forked.agent.parent_id === parent.agent.id, JSON.stringify(forked.agent));
  expect(forked.agent.psi1 === D.PSI1 && forked.wrote_confirmed_shared === false, 'fork keeps the seed and does not write truth');
  expect(a.ancestry().some(row => row.phase === 'fork' && row.forked_from === parent.agent.id), 'fork ancestry');
  expect(a.spcLog().every(row => row.wrote_confirmed_shared === false && row.psi1 === D.PSI1), 'spc custody');
  const child = a.run(parent.agent.id, {
    gap: quartzGap(),
    child: researchSpec('fork-child', 'gilligan')
  });
  expect(child.ok === true && child.child && child.child.ok === true && child.child.agent.parent_id === parent.agent.id, JSON.stringify(child.child));
  expect(child.child.wrote_confirmed_shared === false, 'child spawn is not an admit');
});

T('a helper reintegrates once and Athena admits the gap once', () => {
  const dir = sandbox();
  const k = mk();
  k.clearStarterKnowledge();
  k.setSharedKbWriteKey(KEY);
  const mem0 = k.memory().length;
  const w = D.createIdleDream({ clock: CLOCK, packDir: dir });
  w.enqueue([Object.assign({ id: 'gap:quartz' }, quartzGap())]);
  expect(w.tick({ answering: false }).lane === 'promote_candidate', 'gilligan stages');
  expect(w.helpers().every(h => h.task !== 'research'), 'the tick itself does not spawn a research helper');
  const helper = w.spawnHelper({
    task: 'research', parent: 'gilligan', spawned_by: 'athena', gap_id: 'gap:quartz',
    packet: { schema: D.PACKET_SCHEMA, Phi: 9, eps: 0.12, mu: 0.95, sfe: { Phi: 9, eps: 0.12, mu: 0.95 }, task: 'research', parent: 'gilligan', gap_id: 'gap:quartz', calls_llm: false }
  });
  expect(helper.ok === true, JSON.stringify(helper));
  const ran = w.athena.run(helper.agent.id, { gap: quartzGap() });
  expect(ran.ok === true && ran.lane === 'promote_candidate', JSON.stringify({ ok: ran.ok, lane: ran.lane, rule: ran.rule }));
  const againRun = w.athena.run(helper.agent.id, { gap: quartzGap() });
  expect(againRun.ok === true, 'second run still measures');
  const gap = w.gapRecord('gap:quartz');
  const mine = (gap.integrations || []).filter(x => x.helper_id === helper.agent.id);
  expect(mine.length === 1 && mine[0].wrote_confirmed_shared === false && mine[0].lane === 'promote_candidate' && mine[0].packet && mine[0].packet.schema === D.PACKET_SCHEMA, JSON.stringify(gap.integrations));
  const adm = w.admitRecord(w.promoteCandidates()[0], { host: k, writeKey: KEY, packDir: dir });
  expect(adm.ok === true && adm.wrote_confirmed_shared === true && adm.wrote_pack === true && adm.rule === 'DREAM-IDLE-ADMITTED', JSON.stringify({ ok: adm.ok, rule: adm.rule, wrote: adm.wrote_confirmed_shared, pack: adm.wrote_pack }));
  const before = fs.readFileSync(path.join(dir, 'q.json'), 'utf8');
  const twice = w.admitRecord(w.promoteCandidates()[0], { host: k, writeKey: KEY, packDir: dir });
  expect(twice.ok === false && twice.rule === 'ATHENA-ADMIT-ONCE' && twice.wrote_confirmed_shared === false && twice.wrote_pack === false, JSON.stringify(twice));
  expect(fs.readFileSync(path.join(dir, 'q.json'), 'utf8') === before, 'pack not appended twice');
  expect(w.mayAdmit(w.promoteCandidates()[0]).rule === 'ATHENA-ADMIT-ONCE', 'mayAdmit sees the ledger');
  const pack = JSON.parse(before);
  expect(pack.items.filter(it => /quartz/i.test(it.text || '')).length === 1, 'one quartz row');
  expect(!(k.sharedKnowledgeView().admitted || []).some(x => /phlogiston/i.test(x.text || '')), 'no quarantine claim');
  expect((k.sharedKnowledgeView().admitted || []).filter(x => /quartz/i.test(x.text || '')).length === 1, 'one session row');
  expect((k.store.load('shared_knowledge') || []).length === 0, 'scrapbook');
  expect(!k.store.load('confirmed_shared') || !(k.store.load('confirmed_shared').facts || []).length, 'phone');
  expect(k.memory().length === mem0, 'memory');
  const k2 = mk();
  k2.clearStarterKnowledge();
  k2.setSharedKbWriteKey(KEY);
  const w2 = D.createIdleDream({ clock: CLOCK });
  w2.enqueue([Object.assign({ id: 'gap:race' }, quartzGap({ claim: 'Quartz is a mineral' }))]);
  w2.tick({ answering: false });
  const orig = k2.writeSharedKnowledge.bind(k2);
  let nested = null;
  k2.writeSharedKnowledge = (body, o) => {
    if (!nested) nested = w2.admitRecord(w2.promoteCandidates()[0], { host: k2, writeKey: KEY, publishPacks: false });
    return orig(body, o);
  };
  const outer = w2.admitRecord(w2.promoteCandidates()[0], { host: k2, writeKey: KEY, publishPacks: false });
  expect(outer.ok === true && outer.wrote_confirmed_shared === true, JSON.stringify({ ok: outer.ok, rule: outer.rule }));
  expect(nested && nested.rule === 'ATHENA-ADMIT-ONCE' && nested.wrote_confirmed_shared === false, JSON.stringify(nested));
  expect((k2.sharedKnowledgeView().admitted || []).filter(x => /quartz/i.test(x.text || '')).length === 1, 're-entrant admit did not double the session row');
  fs.rmSync(dir, { recursive: true, force: true });
});

T('version registry CONFLICTS NEXT_BUILD name 4.9.171', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.186', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.171/.test(conf) && /S1/.test(conf) && /Athena/.test(conf) && /Gilligan/.test(conf) && /Neo/.test(conf) && /DREAM-QUARANTINE-NO-TRUTH|quarantine/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.171/.test(nb) && /S1/.test(nb) && /4\.9\.170/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.171/.test(readme) && /dream_idle/.test(readme) && /maySpawn/.test(readme), 'README');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.186' && ((((((tgt.suites[0] === 'r4186_suite.js' || tgt.suites[0] === 'r4185_suite.js' || tgt.suites[0] === 'r4184_suite.js' || tgt.suites[0] === 'r4183_suite.js' || tgt.suites[0] === 'r4182_suite.js' || tgt.suites[0] === 'r4181_suite.js' || tgt.suites[0] === 'r4180_suite.js') || tgt.suites[0] === 'r4179_suite.js') || tgt.suites[0] === 'r4178_suite.js') || tgt.suites[0] === 'r4177_suite.js' || tgt.suites[0] === 'r4176_suite.js' || tgt.suites[0] === 'r4175_suite.js' || tgt.suites[0] === 'r4174_suite.js' || tgt.suites[0] === 'r4173_suite.js') || tgt.suites[0] === 'r4172_suite.js') || tgt.suites[0] === 'r4171_suite.js') && tgt.suites.includes('r4170_suite.js') && tgt.suites.includes('r4169_suite.js'), JSON.stringify(tgt));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.186', reg.version);
  expect(reg.features.some(f => f.id === 'R4171-SPAWN-MESH'), 'feature');
  expect(reg.count === reg.features.length, 'count');
  expect(reg.claims.Implemented === 112 && reg.claims.Partial >= 166, JSON.stringify(reg.claims));
  const mh = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'math_honesty.json'), 'utf8'));
  expect(mh.release === '4.9.186' && mh.idle_dream_router && mh.idle_dream_router.christ_ping === true && mh.idle_dream_router.continuous_admit_default === true && mh.idle_dream_router.always_on === true && mh.idle_dream_router.os_process_pool === false, 'math_honesty');
  const req = fs.readFileSync(path.join(ROOT, 'src', 'req_packet.js'), 'utf8');
  expect(/4\.9\.171/.test(req) && /R4171-SPAWN-MESH/.test(req), 'req_packet');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  expect(/forge-mobile-v__FORGE_VERSION__/.test(sw) || /forge-mobile-v4\.9\.171/.test(sw), 'sw');
});

(async () => {
  let failed = 0;
  const rows = [];
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4171', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4171', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
