/* R4179 (4.9.179): Forge2 contracts on the learning loop, and language.core stays on the answer path.
 * Ask fetches. Athena admits. Gilligan re-curates. The next Ask recalls. No LLM. Packs stay gated. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
const D = require(ROOT + '/src/dream_idle.js');
const KMOD = require(ROOT + '/src/kernel.js');
const FK = require(ROOT + '/src/forge.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-29T12:10:00Z';
const KEY = 'nic-write-key-ok';
const METHOD = 'A bulb produces light by heating a filament.';
const mkStore = () => { const st = {}; return KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }); };
const mk = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK, vaultState: () => 'locked', store: mkStore() });
const rulesOf = r => (r.trace && r.trace.rules || []).map(x => x.id);
const phoneFacts = k => { const phone = k.store.load('confirmed_shared'); return (phone && phone.facts) || []; };

function wiki(pages) {
  return u => {
    const ok = (ct, body) => Promise.resolve({ ok: true, status: 200, url: u, headers: { get: h => String(h).toLowerCase() === 'content-type' ? ct : null }, text: () => Promise.resolve(body) });
    const dec = decodeURIComponent(u);
    if (/robots\.txt$/.test(u)) return ok('text/plain', 'User-agent: *\nDisallow: /w/index.php?title=Special');
    if (/srsearch=|list=search/.test(dec)) {
      const hits = /light|bulb/i.test(dec) ? Object.keys(pages) : [];
      return ok('application/json', JSON.stringify({ query: { search: hits.map(title => ({ title })) } }));
    }
    if (dec.includes('titles=')) {
      const ts = decodeURIComponent((u.split('titles=')[1] || '').split('&')[0]).split('|');
      const body = {};
      ts.forEach((t, i) => { const pg = pages[t]; body[i + 1] = pg ? Object.assign({}, pg, { extract: dec.includes('exintro=1') ? String(pg.extract).split('\n')[0] : pg.extract }) : { title: t, missing: '' }; });
      return ok('application/json', JSON.stringify({ query: { pages: body } }));
    }
    return Promise.resolve({ ok: false, status: 404, url: u, headers: { get: () => '' }, text: async () => '' });
  };
}

T('language.core answers a public how-question and a protoforge question', () => {
  const k = mk();
  k.clearStarterKnowledge();
  const how = k.process('How is quartz?');
  expect(how.trace.selection && how.trace.selection.winner === 'language.core', JSON.stringify(how.trace.selection && how.trace.selection.winner));
  expect(how.trace.selection.routes.find(r => r.route === 'language.core').evaluated === true, 'language.core ran');
  expect(how.trace.msm.meaning.kind === 'tool_started' && how.trace.msm.meaning.tool === 'research.web', how.reply);
  expect(!/Unlock the vault/i.test(how.reply || ''), how.reply);
  expect(rulesOf(how).includes('Q-WH-HOW-STATE') && rulesOf(how).includes('AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), rulesOf(how).join(','));
  const self = k.process('How are you?');
  expect(self.trace.msm.meaning.kind === 'self_answer' && /no emotions/i.test(self.reply || ''), self.reply);
  const named = k.process('What is protoforge?');
  expect(named.trace.selection.winner === 'language.core' && named.trace.msm.meaning.reason !== 'PF_INTERNAL', named.reply);
  expect(named.trace.msm.meaning.kind === 'define' && /recursive symbolic runtime/.test(named.reply || '') && /PyBullet/.test(named.reply || ''), named.reply);
  const cmd = k.process('analyze drift');
  expect(cmd.trace.msm.meaning.reason === 'PF_INTERNAL' && cmd.trace.selection.winner === 'directive.frame', cmd.reply);
  const run = k.process('run protoforge');
  expect(run.trace.msm.meaning.reason === 'PF_INTERNAL', run.reply);
});

T('a real question runs Ask, research.web, Athena, Gilligan, the hosted bank, and recall', async () => {
  const pages = {
    'Light bulb': { title: 'Light bulb', extract: 'A bulb produces light by heating a filament.', description: 'electric lamp' }
  };
  const fetched = [];
  const fetch = u => { fetched.push(String(u)); return wiki(pages)(u); };
  const st = {};
  const store = KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } });
  const f = FK.ForgeKernel({ clock: CLOCK, lexicon: LEX, lexiconExt: EXT, store, vaultIterations: 1000, fetch });
  await f.vault.setup('correct horse');
  await f.vault.unlock('correct horse');
  f.clearStarterKnowledge();
  f.setSharedKbWriteKey(KEY);
  const packPath = path.join(ROOT, 'packs', 'confirmed_shared', 'a.json');
  const beforePack = crypto.createHash('sha256').update(fs.readFileSync(packPath)).digest('hex');
  const started = f.process('How do lightbulbs work?');
  expect(started.trace.selection && started.trace.selection.routes.some(r => r.route === 'language.core' && r.evaluated === true), 'language.core');
  expect(started.trace.msm.meaning.tool === 'research.web', started.reply);
  const t = await started.toolJob;
  expect(t.trace.msm.meaning.kind === 'research_answer' && /filament/i.test(t.reply || ''), t.reply);
  expect(fetched.some(u => /wikipedia|wikimedia/i.test(u)), 'research.web fetched');
  expect(t.forge && t.forge.input_event && t.forge.input_event.metadata && t.forge.input_event.metadata.contract_id, 'Ask spine input event');
  const bridged = D.bridgeAskEvidence(t);
  expect(bridged.ok === true && /filament/i.test(bridged.gap.claim), JSON.stringify(bridged.gap && bridged.gap.claim));
  const w = D.createIdleDream({ clock: CLOCK, host: f, writeKey: KEY, publishPacks: false, research: D.curatedResearch });
  w.enqueue([bridged.gap]);
  const step = w.tick({ answering: false });
  expect(step.lane === 'promote_candidate' && step.rule === 'DREAM-BACKEND-FILL' && step.wrote_confirmed_shared === true && step.wrote_pack !== true, JSON.stringify({ lane: step.lane, rule: step.rule, wrote: step.wrote_confirmed_shared }));
  expect(step.researcher === 'athena' && step.forge2 && step.forge2.ok === true && step.forge2.model_refused === true && step.forge2.network_refused === true && step.forge2.successor_kind === 'lifecycle_transition' && step.forge2.product_capability_claimed === false, JSON.stringify(step.forge2));
  expect(f.sharedKnowledgeView().count === 1 && phoneFacts(f).length === 0, 'hosted row');
  const again = f.process('How do lightbulbs work?');
  expect(again.trace.echo && again.trace.echo.pass, 'echo');
  expect(rulesOf(again).includes('CS-RECALL-MANNER') && !rulesOf(again).includes('AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), rulesOf(again).join(','));
  expect(/filament|heating/i.test(again.reply || '') && /shared knowledge/i.test(again.reply || ''), again.reply);
  const good = w.spawnHelper({ task: 'research', parent: 'gilligan', spawned_by: 'athena', gap_id: 'cold-quartz', packet: { schema: D.SCHEMA, calls_llm: false, parent: 'gilligan', spawned_by: 'athena', task: 'research', gap_id: 'cold-quartz', kind: 'aq1_miss' } });
  expect(good.ok === true, JSON.stringify(good));
  w.athena.run(good.agent.id, { gap: { kind: 'aq1_miss', claim: 'Quartz is a mineral', eps: 0.12, integrity: 0.95, extracts: [{ text: 'Quartz is a mineral', verified: true, integrity: 0.95, source: 'allow-listed' }] } });
  expect(w.retireHelper(good.agent.id).ok === true, 'retire');
  let cold = null;
  for (let i = 0; i < 8 && !(cold && cold.rule === 'GILLIGAN-COLD-RECURATE'); i++) cold = w.tick({ answering: false });
  expect(cold && cold.role === 'gilligan' && cold.rule === 'GILLIGAN-COLD-RECURATE' && cold.wrote_confirmed_shared === true && cold.forge2 && cold.forge2.successor, JSON.stringify(cold && { rule: cold.rule, wrote: cold.wrote_confirmed_shared, forge2: cold.forge2 }));
  expect(f.sharedKnowledgeView().count >= 2, 'cold row joined the bank');
  const neo = D.christPing({ initiator: 'neo', eps: 0.91 });
  expect(neo.rule === 'CHRIST-PING-GILLIGAN-ONLY' && neo.christ_ping === false, JSON.stringify(neo));
  expect(crypto.createHash('sha256').update(fs.readFileSync(packPath)).digest('hex') === beforePack, 'letter pack untouched');
  expect(D.boundary().forge2 === true && D.boundary().always_on === true && D.boundary().idle_gated === false && D.boundary().phone_pack_publish === 'gated', 'boundary');
});

T('version registry CONFLICTS NEXT_BUILD name 4.9.179', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.189', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.179/.test(conf) && /Forge2/.test(conf) && /language\.core/.test(conf) && /Athena document/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.179/.test(nb) && /Forge2/.test(nb) && /Athena document/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.179/.test(readme) && /Forge2/.test(readme) && /WIRING_179/.test(readme), 'README');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.189' && ((tgt.suites[0] === 'r4189_suite.js' || tgt.suites[0] === 'r4188_suite.js' || tgt.suites[0] === 'r4187_suite.js' || tgt.suites[0] === 'r4186_suite.js' || tgt.suites[0] === 'r4185_suite.js' || tgt.suites[0] === 'r4184_suite.js' || tgt.suites[0] === 'r4183_suite.js' || tgt.suites[0] === 'r4182_suite.js' || tgt.suites[0] === 'r4181_suite.js' || tgt.suites[0] === 'r4180_suite.js') || tgt.suites[0] === 'r4179_suite.js') && tgt.suites.includes('r4178_suite.js'), JSON.stringify({ release: tgt.release, head: tgt.suites[0] }));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.189' && reg.features.some(f => f.id === 'R4179-FORGE2-WIRING'), reg.version);
  expect(reg.count === reg.features.length && reg.count >= 336, 'count ' + reg.count);
  const inv = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'forge_tool_inventory.json'), 'utf8'));
  expect(inv.forge2 && inv.forge2.release === '4.9.179' && inv.forge2.head.indexOf('262a95e') === 0, JSON.stringify(inv.forge2 && inv.forge2.counts));
  expect(inv.forge2.counts.ported >= 2 && inv.forge2.counts.present >= 8 && inv.forge2.counts.skipped >= 4, JSON.stringify(inv.forge2.counts));
  expect(inv.forge2.modules.every(m => m.name && m.status && m.reason), 'inventory rows');
  const req = fs.readFileSync(path.join(ROOT, 'src', 'req_packet.js'), 'utf8');
  expect(/4\.9\.179/.test(req) && /R4179-FORGE2-WIRING/.test(req), 'req packet');
  const wiring = fs.readFileSync(path.join(ROOT, '..', 'docs', 'WIRING_179.md'), 'utf8');
  expect(/Stale code \/ language\.core blockers/.test(wiring) && /research\.web/.test(wiring) && /validateSuccessor/.test(wiring), 'wiring report');
  const single = path.join(ROOT, '..', '_release', 'single', 'kernel-app.html');
  if (fs.existsSync(single)) {
    const gz = zlib.gzipSync(fs.readFileSync(single)).length;
    expect(gz <= 570000 - 5000, 'gzip leave ' + (570000 - gz));
  }
});

(async () => {
  let failed = 0;
  const rows = [];
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4179', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4179', name: t.name, ok: false, why: String(e.message || e).slice(0, 800) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
