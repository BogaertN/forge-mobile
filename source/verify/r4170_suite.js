/* R4170 (4.9.170): null ε is not measured zero; admit defaults on; Athena pack publish;
 * quarantine does not write packs. Spawn→Run→Hibernate→Retire→Resurrect is an in-process registry.
 * Gilligan researches only while idle. Neo is the Ask surface and is not this file. No LLM. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = require(ROOT + '/src/dream_idle.js');
const KMOD = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-28T21:00:00Z';
const KEY = 'nic-write-key-ok';
const mkStore = () => { const st = {}; return KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }); };
const mk = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK, vaultState: () => 'locked', store: mkStore() });
const verified = (text, integrity) => [{ text: text, verified: true, integrity: integrity, source: 'allow-listed' }];
const quartz = () => ({ id: 'gap:quartz', kind: 'aq1_miss', subject: 'quartz', claim: 'Quartz is a mineral', eps: 0.12, integrity: 0.95, extracts: verified('Quartz is a mineral', 0.95) });

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dream-pack-'));
  const seed = (letter, text) => ({
    schema: 'FORGE-CONFIRMED-PACK/v1', format: 'FORGE-CONFIRMED-PACK/v1',
    pack_id: 'confirmed_shared_letter_' + letter, provenance: 'confirmed_shared',
    letter: letter.toUpperCase(), who_confirmed: 'product_curator', shared_kb: false, curated_facts: 1,
    items: [{ id: 'cs_seed_' + letter, text: text, standing: 'projectable', evidence: 'geography · curator', sfe: { Phi: 9, eps: 0, mu: 1 } }]
  });
  fs.writeFileSync(path.join(dir, 'q.json'), JSON.stringify(seed('q', 'Qatar hosts Doha'), null, 1) + '\n');
  fs.writeFileSync(path.join(dir, 'p.json'), JSON.stringify(seed('p', 'Paris is in France'), null, 1) + '\n');
  const index = {
    schema: 'FORGE-CONFIRMED-SHARED-INDEX/v1', provenance: 'confirmed_shared', version: '4.9.168',
    letters: ['p', 'q'],
    packs: { p: { path: 'p.json', letter: 'P', items: 1, curated_facts: 1 }, q: { path: 'q.json', letter: 'Q', items: 1, curated_facts: 1 } },
    total_items: 2, total_curated: 2
  };
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index, null, 1) + '\n');
  return dir;
}

T('null and undefined epsilon are not measured zero and are not projectable as zero', () => {
  const bare = D.measure({ eps: null, claim: 'Quartz is a mineral' });
  expect(bare.eps == null && bare.meter == null, JSON.stringify(bare));
  const routed = D.routeMeasurement({ eps: null, integrity: 0.99, verified: true, claim: 'Quartz is a mineral' });
  expect(routed.eps == null && routed.lane === 'quarantine' && routed.rule === 'DREAM-UNMEASURED' && routed.may_project === false, JSON.stringify({ eps: routed.eps, lane: routed.lane, rule: routed.rule, meter: routed.meter }));
  const missing = D.routeMeasurement({ claim: 'Quartz is a mineral' });
  expect(missing.eps == null && missing.lane === 'quarantine' && missing.rule === 'DREAM-UNMEASURED', JSON.stringify({ eps: missing.eps, rule: missing.rule }));
  const omitted = D.routeMeasurement({ integrity: 0.9, verified: true, claim: 'Quartz is a mineral' });
  expect(omitted.meter === 'integrity_complement' && omitted.eps === 0.1 && omitted.eps !== 0 && omitted.lane === 'promote_candidate', JSON.stringify({ meter: omitted.meter, eps: omitted.eps, lane: omitted.lane }));
  const zero = D.routeMeasurement({ eps: 0, integrity: 0.95, verified: true, claim: 'Quartz is a mineral' });
  expect(zero.eps === 0 && zero.meter === 'measured' && zero.lane === 'promote_candidate', JSON.stringify({ eps: zero.eps, meter: zero.meter, lane: zero.lane }));
  const crawl = D.routeMeasurement({ open_crawl: true, eps: 0.05, integrity: 1, claim: 'Quartz is a mineral', extracts: [{ text: 'from the open web', verified: true, integrity: 1, source: 'crawl' }] });
  expect(crawl.lane === 'quarantine' && crawl.rule === 'DREAM-OPEN-CRAWL-REFUSED' && crawl.claim == null && crawl.calls_llm === false, JSON.stringify({ lane: crawl.lane, rule: crawl.rule }));
});

T('admit defaults on and the tick still no-ops while Ask is answering', () => {
  const b = D.boundary();
  expect(b.continuous_admit_default === true && b.always_on === true && b.idle_gated === false && b.one_shot_fill === false && b.calls_llm === false, JSON.stringify({ on: b.continuous_admit_default, always: b.always_on }));
  expect(b.roles.gilligan === 'gap_fill_within_drift' && b.roles.athena === 'strict_curate_admit' && b.roles.neo === 'ask_surface', JSON.stringify(b.roles));
  const w = D.createIdleDream({ clock: CLOCK });
  expect(w.admitEnabled() === true, 'default on');
  const names = w.daemons().map(d => d.role).sort().join(',');
  expect(names === 'athena,gilligan,neo' && w.daemons().length >= 3, names);
  expect(w.daemons().find(d => d.role === 'neo').in_this_file === false, 'neo is Ask');
  expect(w.daemons().find(d => d.role === 'gilligan').spawns_helpers === false, 'gilligan does not spawn');
  expect(w.daemons().find(d => d.role === 'athena').spawns_helpers === true, 'athena spawns');
  w.enqueue([quartz()]);
  const busy = w.tick({ answering: true });
  expect(busy.ran === false && busy.rule === 'DREAM-IDLE-BUSY', JSON.stringify(busy));
  w.setAnswering(true);
  const held = w.athena.spawn('resonance_place');
  expect(held.ok === false && held.rule === 'DREAM-IDLE-BUSY' && w.helpers().length === 0, JSON.stringify(held));
  w.setAnswering(false);
  const t = w.tick({ answering: false });
  expect(t.lane === 'promote_candidate' && w.helpers().length === 0, 'gilligan tick does not spawn');
  const paused = D.createIdleDream({ clock: CLOCK, admitEnabled: false });
  paused.enqueue([quartz()]);
  paused.tick({ answering: false });
  const stop = paused.admitStaged({ writeKey: KEY, host: {}, publishPacks: false });
  expect(stop.rule === 'DREAM-IDLE-ADMIT-PAUSED' && stop.wrote_confirmed_shared === false && stop.wrote_pack === false, JSON.stringify(stop));
  const src = fs.readFileSync(path.join(ROOT, 'src', 'dream_idle.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  expect(!/setInterval|setTimeout|child_process|openai|anthropic|ollama/.test(src), 'no timer, process pool, or model');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const kernel = fs.readFileSync(path.join(ROOT, 'src', 'kernel.js'), 'utf8');
  expect(!/dream_idle/.test(kernel), 'not on the ask path');
  expect(/src\/dream_idle\.js/.test(html), 'site custody loads the mesh');
});

T('Athena registry spawns only declared helpers and gates the pack write', () => {
  const a = D.createAthena({ clock: CLOCK });
  expect(a.lifecycle.join(',') === 'spawn,run,hibernate,retire,resurrect', a.lifecycle.join(','));
  expect(a.daemons().length >= 3, 'three daemons');
  const bad = a.spawn('llm');
  expect(bad.ok === false && bad.rule === 'ATHENA-TASK-UNDECLARED' && bad.calls_llm === false && a.helpers().length === 0, JSON.stringify(bad));
  const spawned = a.spawn('resonance_place');
  expect(spawned.ok && spawned.agent.os_process === false && spawned.agent.status === 'active', JSON.stringify(spawned.agent));
  const refused = a.run(spawned.agent.id, { rec: { lane: 'quarantine', route: 'dream_state_quarantine_candidate', eps: 0.5 } });
  expect(refused.ok === false && refused.rule === 'DREAM-QUARANTINE-NO-TRUTH' && refused.wrote_pack === false, JSON.stringify(refused));
  const hib = a.hibernate(spawned.agent.id);
  expect(hib.ok && hib.agent.status === 'hibernated', JSON.stringify(hib));
  const blocked = a.run(spawned.agent.id, { rec: { lane: 'promote_candidate', eps: 0 } });
  expect(blocked.ok === false && blocked.rule === 'ATHENA-HELPER-NOT-ACTIVE', JSON.stringify(blocked));
  const retired = a.retire(spawned.agent.id);
  expect(retired.ok && retired.agent.status === 'retired', JSON.stringify(retired));
  expect(a.resurrect('missing').rule === 'ATHENA-HELPER-UNKNOWN', 'unknown');
  const back = a.resurrect(spawned.agent.id);
  expect(back.ok && back.agent.status === 'active', JSON.stringify(back));
  const unmeasured = a.run(spawned.agent.id, { rec: { lane: 'promote_candidate', eps: null, packet: { schema: D.PACKET_SCHEMA, sfe: { Phi: 9, eps: 0, mu: 1 } } } });
  expect(unmeasured.ok === false && unmeasured.rule === 'DREAM-ATHENA-UNMEASURED' && unmeasured.wrote_pack === false, JSON.stringify(unmeasured));
  const writer = a.spawn('pack_append');
  const naked = a.run(writer.agent.id, { item: { text: 'Quartz is a mineral' }, dir: '/tmp/none' });
  expect(naked.ok === false && naked.rule === 'DREAM-ATHENA-GATE-REQUIRED' && naked.wrote_pack === false, JSON.stringify(naked));
});

T('promote admit persists the letter pack and quarantine does not', () => {
  const dir = sandbox();
  const beforeP = fs.readFileSync(path.join(dir, 'p.json'), 'utf8');
  const k = mk();
  k.clearStarterKnowledge();
  k.setSharedKbWriteKey(KEY);
  const mem0 = k.memory().length;
  const w = D.createIdleDream({ clock: CLOCK, packDir: dir });
  expect(w.admitEnabled() === true, 'default on reaches pack path');
  w.enqueue([
    quartz(),
    { id: 'gap:phlog', kind: 'rpmc_ancestor_none', claim: 'Phlogiston is a substance', eps: 0.55, integrity: 0.99, extracts: verified('Phlogiston is a substance', 0.99) }
  ]);
  expect(w.tick({ answering: false }).lane === 'promote_candidate', 'promote');
  expect(w.tick({ answering: false }).lane === 'quarantine', 'quarantine');
  const one = w.admitRecord(w.quarantine()[0], { host: k, writeKey: KEY, packDir: dir });
  expect(one.ok === false && one.rule === 'DREAM-QUARANTINE-NO-TRUTH' && one.wrote_confirmed_shared === false && one.wrote_pack === false, JSON.stringify(one));
  expect(fs.readFileSync(path.join(dir, 'p.json'), 'utf8') === beforeP, 'quarantine pack untouched');
  const adm = w.admitStaged({ host: k, writeKey: KEY, packDir: dir });
  expect(adm.ok === true && adm.wrote_confirmed_shared === true && adm.wrote_pack === true && adm.admitted.length === 1, JSON.stringify({ ok: adm.ok, wrote: adm.wrote_confirmed_shared, pack: adm.wrote_pack, rule: adm.rule, refused: (adm.refused || []).map(r => r.rule) }));
  expect(/pages\.yml/.test(adm.pack_publish_trigger) && /pack_append/.test(adm.pack_publish_trigger), adm.pack_publish_trigger);
  const pack = JSON.parse(fs.readFileSync(path.join(dir, 'q.json'), 'utf8'));
  const row = pack.items.find(it => /quartz/i.test(it.text || ''));
  expect(row && row.sfe && row.sfe.Phi === 9 && row.sfe.eps === 0.12 && row.sfe.mu === 0.95 && row.standing === 'projectable', JSON.stringify(row));
  expect(!pack.items.some(it => /phlogiston/i.test(it.text || '')), 'no quarantine row');
  const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  expect(index.packs.q.items === 2 && index.total_items === 3, JSON.stringify({ q: index.packs.q, total: index.total_items }));
  expect(fs.readFileSync(path.join(dir, 'p.json'), 'utf8') === beforeP, 'p still untouched');
  const phone = k.store.load('confirmed_shared');
  expect(!phone || !(phone.facts || []).length, 'phone');
  expect((k.store.load('shared_knowledge') || []).length === 0, 'scrapbook');
  expect(k.memory().length === mem0, 'memory');
  expect(!(k.sharedKnowledgeView().admitted || []).some(x => /phlogiston/i.test(x.text || '')), 'session quarantine absent');
  const session = (k.sharedKnowledgeView().admitted || []).find(x => /quartz/i.test(x.text || ''));
  expect(session && session.sfe && session.sfe.Phi === 9, JSON.stringify(session));
  fs.rmSync(dir, { recursive: true, force: true });
});

T('version registry CONFLICTS NEXT_BUILD name 4.9.171', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.189', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.170/.test(conf) && /Athena/.test(conf) && /Gilligan/.test(conf) && /Neo/.test(conf) && /4\.9\.171/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.170/.test(nb) && /4\.9\.171/.test(nb) && /S1/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.170/.test(readme) && /pack_append/.test(readme) && /answering/.test(readme), 'README');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.189' && ((((((tgt.suites[0] === 'r4189_suite.js' || tgt.suites[0] === 'r4188_suite.js' || tgt.suites[0] === 'r4187_suite.js' || tgt.suites[0] === 'r4186_suite.js' || tgt.suites[0] === 'r4185_suite.js' || tgt.suites[0] === 'r4184_suite.js' || tgt.suites[0] === 'r4183_suite.js' || tgt.suites[0] === 'r4182_suite.js' || tgt.suites[0] === 'r4181_suite.js' || tgt.suites[0] === 'r4180_suite.js') || tgt.suites[0] === 'r4179_suite.js') || tgt.suites[0] === 'r4178_suite.js') || tgt.suites[0] === 'r4177_suite.js' || tgt.suites[0] === 'r4176_suite.js' || tgt.suites[0] === 'r4175_suite.js' || tgt.suites[0] === 'r4174_suite.js' || tgt.suites[0] === 'r4173_suite.js') || tgt.suites[0] === 'r4172_suite.js') || tgt.suites[0] === 'r4171_suite.js') && tgt.suites.includes('r4170_suite.js') && tgt.suites.includes('r4169_suite.js'), JSON.stringify(tgt));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.189', reg.version);
  expect(reg.features.some(f => f.id === 'R4170-IDLE-ADMIT'), 'feature');
  expect(reg.count === reg.features.length, 'count');
  expect(reg.claims.Implemented === 112 && reg.claims.Partial >= 165, JSON.stringify(reg.claims));
  const mh = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'math_honesty.json'), 'utf8'));
  expect(mh.release === '4.9.189' && mh.idle_dream_router && mh.idle_dream_router.christ_ping === true && mh.idle_dream_router.continuous_admit_default === true && mh.idle_dream_router.always_on === true, 'math_honesty');
  const req = fs.readFileSync(path.join(ROOT, 'src', 'req_packet.js'), 'utf8');
  expect(/4\.9\.170/.test(req) && /R4170-IDLE-ADMIT/.test(req), 'req_packet');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  expect(/forge-mobile-v__FORGE_VERSION__/.test(sw) || /forge-mobile-v4\.9\.170/.test(sw), 'sw');
});

(async () => {
  let failed = 0;
  const rows = [];
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4170', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4170', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
