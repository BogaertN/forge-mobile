/* R4174 (4.9.174): one learning pipeline.
 * Ask answers a how/method question from Wikipedia-class excerpts.
 * Measured research bridges into Athena. A write key admits it. Ask later recalls it.
 * Unmeasured quarantine stays cold custody. No LLM. Packs stay gated. */
const fs = require('fs');
const path = require('path');
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
const CLOCK = () => '2026-10-29T01:20:00Z';
const KEY = 'nic-write-key-ok';
const mkStore = () => { const st = {}; return KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }); };
const mk = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK, vaultState: () => 'locked', store: mkStore() });
const phoneFacts = k => { const phone = k.store.load('confirmed_shared'); return (phone && phone.facts) || []; };
const rulesOf = r => (r.trace && r.trace.rules || []).map(x => x.id);
const METHOD = 'A bulb produces light by heating a filament.';

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

T('research callback plus write key admits and the hosted bank grows from the write', () => {
  const k = mk();
  k.clearStarterKnowledge();
  k.setSharedKbWriteKey(KEY);
  const before = k.sharedKnowledgeView().count;
  const w = D.createIdleDream({
    clock: CLOCK, host: k, publishPacks: false,
    research: gap => gap.kind === 'aq1_miss' ? { claim: 'Quartz is a mineral', eps: 0.12, integrity: 0.95, extracts: [{ text: 'Quartz is a mineral', verified: true, integrity: 0.95, source: 'allow-listed' }], calls_llm: false } : D.curatedResearch(gap)
  });
  expect(w.writeKeyHeld() === false, 'no key yet');
  w.enqueue([{ id: 'gap:quartz', kind: 'aq1_miss', claim: null, extracts: [] }]);
  const heldOff = w.tick({ answering: false });
  expect(heldOff.lane === 'promote_candidate' && heldOff.wrote_confirmed_shared !== true && k.sharedKnowledgeView().count === before, JSON.stringify({ lane: heldOff.lane, wrote: heldOff.wrote_confirmed_shared, n: k.sharedKnowledgeView().count }));
  expect(w.setWriteKey(KEY).held === true, 'grant');
  w.enqueue([{ id: 'gap:quartz-2', kind: 'aq1_miss', claim: null, extracts: [] }]);
  const held = w.tick({ answering: false });
  expect(held.wrote_confirmed_shared === true && held.backend_fill && held.backend_fill.wrote_pack === false, JSON.stringify(held.backend_fill));
  expect(k.sharedKnowledgeView().count === before + 1, 'kb ' + k.sharedKnowledgeView().count);
  expect(phoneFacts(k).length === 0, 'phone db');
  const view = w.custody({ kb_count: k.sharedKnowledgeView().count });
  expect(view.always_on === true && view.idle_gated === false && view.write_key_held === true && view.athena.admits >= 1 && view.publish_packs === false, JSON.stringify({ on: view.always_on, key: view.write_key_held, admits: view.athena.admits }));
});

T('Ask research evidence becomes an Athena gap with curated extracts and a crawl shape is refused', () => {
  const claim = METHOD.replace(/\.$/, '');
  const bridged = D.bridgeAskEvidence({ question: 'How do lightbulbs work', meaning: { kind: 'research_answer', excerpt: METHOD, generated: { text: METHOD, drift: 0.08 }, support: { level: 'answered' } } });
  expect(bridged.ok === true && bridged.gap.kind === 'aq1_miss' && bridged.gap.extracts.length === 1 && bridged.gap.extracts[0].verified === true && bridged.gap.extracts[0].source === 'curated' && bridged.gap.claim === claim, JSON.stringify(bridged.gap));
  expect(Number.isFinite(bridged.gap.eps) && Number.isFinite(bridged.gap.integrity) && bridged.gap.integrity >= 0.85, JSON.stringify({ eps: bridged.gap.eps, integrity: bridged.gap.integrity }));
  const crawl = D.bridgeAskEvidence({ research_web: true, excerpt: METHOD, eps: 0.1, extracts: [{ text: METHOD, verified: true, source: 'research.web' }] });
  expect(crawl.ok === false && crawl.rule === 'DREAM-OPEN-CRAWL-REFUSED' && crawl.gap == null, JSON.stringify(crawl));
  const llm = D.bridgeAskEvidence({ calls_llm: true, prompt: 'write a method', excerpt: METHOD, eps: 0.05 });
  expect(llm.ok === false && llm.rule === 'DREAM-LLM-REFUSED', JSON.stringify(llm));
  const bare = D.curatedResearch({ id: 'gap:letter:z', kind: 'letter_hole', letter: 'z', claim: null, extracts: [] });
  expect(bare.claim == null && !(bare.extracts || []).length, 'letter hole stays empty');
});

T('after a lawful admit Ask recalls the taught method from hosted knowledge', () => {
  const k = mk();
  k.clearStarterKnowledge();
  k.setSharedKbWriteKey(KEY);
  const w = D.createIdleDream({ clock: CLOCK, host: k, writeKey: KEY, publishPacks: false, research: D.curatedResearch });
  const bridged = D.bridgeAskEvidence({ question: 'How do lightbulbs work', input: 'How do lightbulbs work', meaning: { kind: 'research_answer', generated: { text: METHOD, drift: 0.08 }, excerpt: METHOD } });
  w.enqueue([bridged.gap]);
  const step = w.tick({ answering: false });
  expect(step.lane === 'promote_candidate' && step.wrote_confirmed_shared === true && step.rule === 'DREAM-BACKEND-FILL', JSON.stringify({ lane: step.lane, rule: step.rule, wrote: step.wrote_confirmed_shared }));
  expect(k.sharedKnowledgeView().count === 1 && phoneFacts(k).length === 0, 'one hosted row');
  const ask = k.process('How do lightbulbs work?');
  expect(ask.trace.echo && ask.trace.echo.pass, 'echo ' + (ask.trace.echo && ask.trace.echo.reason));
  expect(rulesOf(ask).includes('CS-RECALL-MANNER'), rulesOf(ask).join(','));
  expect(!rulesOf(ask).includes('AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), 'no second research');
  expect(ask.trace.msm.meaning.kind === 'recall' && /filament|heating/i.test(ask.reply || '') && /shared knowledge/i.test(ask.reply || ''), ask.reply);
  expect(k.memory().length === 0, 'memory');
});

T('a how-method question with a Wikipedia-class source is a research answer, not a gate refusal', async () => {
  const pages = {
    'Light bulb': { title: 'Light bulb', extract: 'A light bulb is an electric lamp that produces light from electricity.\nIncandescent bulbs produce light by heating a filament until it glows.', description: 'electric lamp' },
    'Incandescent light bulb': { title: 'Incandescent light bulb', extract: 'An incandescent light bulb is an electric light with a wire filament heated until it glows.\nThe filament is heated by passing an electric current through it until the metal glows.', description: 'electric lamp' }
  };
  const st = {};
  const store = KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } });
  const f = FK.ForgeKernel({ clock: CLOCK, lexicon: LEX, lexiconExt: EXT, store, vaultIterations: 1000, fetch: wiki(pages) });
  await f.vault.setup('correct horse');
  await f.vault.unlock('correct horse');
  f.clearStarterKnowledge();
  const started = f.process('How do lightbulbs work?');
  expect(started.trace.msm.meaning.kind === 'tool_started' && started.trace.msm.meaning.tool === 'research.web', started.reply);
  const t = await started.toolJob;
  const m = t.trace.msm.meaning;
  expect(m.kind === 'research_answer' && t.trace.outcome.category !== 'NO_LAWFUL_CANDIDATE', JSON.stringify({ kind: m.kind, cat: t.trace.outcome.category, reply: t.reply }));
  expect(t.trace.echo && t.trace.echo.pass, t.trace.echo && t.trace.echo.reason);
  expect(/heating a filament|heated by passing/i.test(t.reply || ''), t.reply);
  expect(!/No source described the method/i.test(t.reply || ''), t.reply);
  expect(f.memory().length === 0 && t.trace.msm.limits.may_write_memory === false, 'evidence is not memory');
  const bridged = D.bridgeAskEvidence(t);
  expect(bridged.ok === true && bridged.gap.extracts[0].source === 'curated' && /filament/i.test(bridged.gap.claim), JSON.stringify(bridged));
});

T('unmeasured quarantine stays Gilligan custody and a promoteable cold row uses the write key', () => {
  const k = mk();
  k.clearStarterKnowledge();
  k.setSharedKbWriteKey(KEY);
  const w = D.createIdleDream({ clock: CLOCK, host: k, publishPacks: false, maxAttempts: 1 });
  w.enqueue([{ id: 'gap:letter:z', kind: 'letter_hole', letter: 'z', claim: null, extracts: [] }]);
  const q = w.tick({ answering: false });
  expect(q.kind === 'letter_hole' && q.lane === 'quarantine' && q.rule === 'DREAM-UNMEASURED' && q.claim == null, JSON.stringify({ kind: q.kind, rule: q.rule }));
  expect(w.coldBank().some(r => r.route === 'dream_state_quarantine_candidate'), 'custody row');
  const keep = w.tick({ answering: false });
  expect(keep.role === 'gilligan' && keep.rule === 'GILLIGAN-COLD-KEEP' && keep.wrote_confirmed_shared === false, JSON.stringify({ role: keep.role, rule: keep.rule, wrote: keep.wrote_confirmed_shared }));
  const neo = D.christPing({ initiator: 'neo', eps: 0.91 });
  expect(neo.rule === 'CHRIST-PING-GILLIGAN-ONLY' && neo.wrote_confirmed_shared === false, JSON.stringify(neo));
  const good = w.spawnHelper({ task: 'research', parent: 'gilligan', spawned_by: 'athena', gap_id: 'cold-bulb', packet: { schema: D.SCHEMA, calls_llm: false, parent: 'gilligan', spawned_by: 'athena', task: 'research', gap_id: 'cold-bulb', kind: 'aq1_miss' } });
  expect(good.ok === true, JSON.stringify(good));
  w.athena.run(good.agent.id, { gap: { kind: 'aq1_miss', claim: METHOD.replace(/\.$/, ''), eps: 0.12, integrity: 0.95, extracts: [{ text: METHOD.replace(/\.$/, ''), verified: true, integrity: 0.95, source: 'allow-listed' }] } });
  expect(w.retireHelper(good.agent.id).ok === true, 'retire');
  w.setWriteKey(KEY);
  let cold = null;
  for (let i = 0; i < 6 && !(cold && cold.rule === 'GILLIGAN-COLD-RECURATE'); i++) cold = w.tick({ answering: false });
  expect(cold && cold.rule === 'GILLIGAN-COLD-RECURATE' && cold.wrote_confirmed_shared === true && cold.backend_fill && cold.backend_fill.wrote_pack === false, JSON.stringify(cold && { rule: cold.rule, wrote: cold.wrote_confirmed_shared, fill: cold.backend_fill }));
  expect(k.sharedKnowledgeView().count >= 1 && phoneFacts(k).length === 0, 'cold write');
});

T('no LLM, always on, packs gated, and the portable file still leaves the mesh out', () => {
  const b = D.boundary();
  expect(b.calls_llm === false && b.always_on === true && b.idle_gated === false && b.phone_pack_publish === 'gated' && b.christ_ping === true, JSON.stringify({ llm: b.calls_llm, on: b.always_on, idle: b.idle_gated }));
  const llm = D.routeMeasurement({ calls_llm: true, eps: 0.05, integrity: 1, claim: 'Quartz is a mineral' });
  expect(llm.rule === 'DREAM-LLM-REFUSED' && llm.claim == null, JSON.stringify(llm));
  const ui = fs.readFileSync(path.join(ROOT, 'src', 'app_custody.js'), 'utf8');
  const dream = fs.readFileSync(path.join(ROOT, 'src', 'dream_idle.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const build = fs.readFileSync(path.join(ROOT, 'build.py'), 'utf8');
  expect(/publishPacks:\s*false/.test(ui) && !/publishPacks:\s*true/.test(ui), 'packs gated');
  expect(/curatedResearch/.test(ui) && /bridgeAskEvidence/.test(ui) && /holdWriteKey/.test(ui), 'loop wired');
  expect(!/setInterval|setTimeout|child_process|openai|anthropic|ollama|Math\.random/.test(dream), 'mesh has no timer or model');
  expect(/src\/dream_idle\.js/.test(build) && /continue/.test(build), 'single file skips the mesh');
  const single = path.join(ROOT, '..', '_release', 'single', 'kernel-app.html');
  if (fs.existsSync(single)) {
    const gz = zlib.gzipSync(fs.readFileSync(single)).length;
    expect(gz <= 570000 - 5000, 'gzip leave ' + gz);
  }
});

T('version registry CONFLICTS NEXT_BUILD name 4.9.174', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.181', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.174/.test(conf) && /learning pipeline/.test(conf) && /Gilligan Codex/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.174/.test(nb) && /Gilligan Codex/.test(nb) && /Athena document/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.174/.test(readme) && /[Ll]earning pipeline/.test(readme), 'README');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.181' && ((((tgt.suites[0] === 'r4181_suite.js' || tgt.suites[0] === 'r4180_suite.js') || tgt.suites[0] === 'r4179_suite.js') || tgt.suites[0] === 'r4178_suite.js') || tgt.suites[0] === 'r4177_suite.js' || tgt.suites[0] === 'r4176_suite.js' || tgt.suites[0] === 'r4175_suite.js' || tgt.suites[0] === 'r4174_suite.js'), JSON.stringify({ release: tgt.release, head: tgt.suites[0] }));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.181' && reg.features.some(f => f.id === 'R4174-LEARNING-LOOP'), reg.version);
  expect(reg.count === reg.features.length && reg.count >= 334, 'count ' + reg.count);
});

(async () => {
  let failed = 0;
  const rows = [];
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4174', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4174', name: t.name, ok: false, why: String(e.message || e).slice(0, 800) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
