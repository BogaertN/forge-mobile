/* R4175 (4.9.175): tools the learning pipeline calls.
 * A session write-key grant lets a measured claim admit. No key is hardcoded.
 * research.web fetch returns a method excerpt. The vault is not that source.
 * The admitted sentence is recalled before AQ-1. Packs stay gated. No LLM. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
const D = require(ROOT + '/src/dream_idle.js');
const PT = require(ROOT + '/src/pipeline_tools.js');
const KMOD = require(ROOT + '/src/kernel.js');
const FK = require(ROOT + '/src/forge.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-29T02:10:00Z';
const KEY = 'nic-write-key-ok';
const METHOD = 'A bulb produces light by heating a filament.';
const mkStore = () => { const st = {}; return KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }); };
const mk = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK, vaultState: () => 'locked', store: mkStore() });
const phoneFacts = k => { const phone = k.store.load('confirmed_shared'); return (phone && phone.facts) || []; };
const rulesOf = r => (r.trace && r.trace.rules || []).map(x => x.id);

function wiki(pages, pick) {
  return u => {
    const ok = (ct, body) => Promise.resolve({ ok: true, status: 200, url: u, headers: { get: h => String(h).toLowerCase() === 'content-type' ? ct : null }, text: () => Promise.resolve(body) });
    const dec = decodeURIComponent(u);
    if (/robots\.txt$/.test(u)) return ok('text/plain', 'User-agent: *\nDisallow: /w/index.php?title=Special');
    if (/srsearch=|list=search/.test(dec)) {
      const hits = pick ? pick(dec) : (/light|bulb/i.test(dec) ? Object.keys(pages) : []);
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

const PAGES = {
  'Light bulb': { title: 'Light bulb', extract: 'A light bulb is an electric lamp that produces light from electricity.\nA bulb produces light by heating a filament.\nIncandescent bulbs produce light by heating a filament until it glows.', description: 'electric lamp' }
};

T('write key grant lets a measured claim admit and a missing key leaves the bank at 0', () => {
  const k = mk();
  k.clearStarterKnowledge();
  const bag = { key: null };
  const w = D.createIdleDream({ clock: CLOCK, host: k, publishPacks: false, research: D.curatedResearch });
  const access = PT.createWriteAccess({ host: k, mesh: w, remember: v => { bag.key = v; } });
  const gap = { id: 'gap:bulb', kind: 'aq1_miss', question: 'How do lightbulbs work', claim: METHOD.replace(/\.$/, ''), eps: 0.08, integrity: 0.92, extracts: [{ text: METHOD.replace(/\.$/, ''), verified: true, integrity: 0.92, source: 'curated', curated: true, allow_listed: true }], calls_llm: false };
  expect(access.grant('short').ok === false && access.grant('short').rule === 'SHARED-KB-WRITE-KEY-WEAK' && access.held() === false, 'weak');
  w.enqueue([gap]);
  const off = w.tick({ answering: false });
  expect(off.lane === 'promote_candidate' && off.wrote_confirmed_shared !== true && k.sharedKnowledgeView().count === 0, JSON.stringify({ lane: off.lane, wrote: off.wrote_confirmed_shared }));
  expect(access.grant(KEY).held === true && access.held() === true && bag.key === KEY && w.writeKeyHeld() === true, 'grant');
  w.enqueue([Object.assign({}, gap, { id: 'gap:bulb-2' })]);
  w.prefer('gap:bulb-2');
  const on = w.tick({ answering: false });
  expect(on.wrote_confirmed_shared === true && on.rule === 'DREAM-BACKEND-FILL' && on.backend_fill && on.backend_fill.wrote_pack === false, JSON.stringify({ rule: on.rule, wrote: on.wrote_confirmed_shared, fill: on.backend_fill }));
  expect(k.sharedKnowledgeView().count === 1 && phoneFacts(k).length === 0, 'one hosted row');
  expect(access.clear().held === false && w.writeKeyHeld() === false && bag.key === '', 'clear');
});

T('research tool returns a method excerpt and does not answer from the vault', async () => {
  let vaultReads = 0;
  const vault = { reveal() { vaultReads++; return 'sealed'; } };
  const missing = await PT.researchExcerpt('How do lightbulbs work?', { fetch: null, vault: vault });
  expect(missing.ok === false && missing.rule === 'RESEARCH-FETCH-UNAVAILABLE' && missing.vault_only === false && missing.excerpt == null && vaultReads === 0, JSON.stringify(missing));
  const crawl = await PT.researchExcerpt('https://example.com/secret', { fetch: wiki(PAGES), vault: vault });
  expect(crawl.ok === false && crawl.rule === 'RESEARCH-OPEN-CRAWL-REFUSED' && crawl.vault_only === false && vaultReads === 0, JSON.stringify(crawl));
  const hit = await PT.researchExcerpt('How do lightbulbs work?', { fetch: wiki(PAGES), clock: CLOCK, vault: vault });
  expect(hit.ok === true && hit.tool === 'research.web' && hit.vault_only === false && hit.open_crawl === false && hit.calls_llm === false && /heating a filament/i.test(hit.excerpt || ''), JSON.stringify({ rule: hit.rule, excerpt: hit.excerpt, tool: hit.tool }));
  expect(vaultReads === 0, 'vault was not the source');
});

T('a fetched method sentence admits under the granted key and Ask recalls it', async () => {
  const k = mk();
  k.clearStarterKnowledge();
  const w = D.createIdleDream({ clock: CLOCK, host: k, publishPacks: false, research: D.curatedResearch });
  const access = PT.createWriteAccess({ host: k, mesh: w });
  const hit = await PT.researchExcerpt('How do lightbulbs work?', { fetch: wiki(PAGES), clock: CLOCK, reparse: t => k.reparseClause(t) });
  expect(hit.ok === true && hit.parsed === true && hit.measured && hit.measured.extracts[0].source === 'curated' && /heating a filament/i.test(hit.claim || ''), JSON.stringify({ rule: hit.rule, claim: hit.claim, parsed: hit.parsed }));
  w.enqueue([{ id: 'gap:bulb', kind: 'aq1_miss', question: 'How do lightbulbs work', claim: null, extracts: [], calls_llm: false }]);
  const applied = w.applyMeasured('gap:bulb', hit);
  expect(applied.ok === true && applied.rule === 'PIPELINE-MEASURED', JSON.stringify(applied));
  expect(access.grant(KEY).held === true, 'held');
  const step = w.tick({ answering: false });
  expect(step.lane === 'promote_candidate' && step.wrote_confirmed_shared === true && step.rule === 'DREAM-BACKEND-FILL' && step.backend_fill && step.backend_fill.wrote_pack === false, JSON.stringify({ lane: step.lane, rule: step.rule, wrote: step.wrote_confirmed_shared }));
  expect(k.sharedKnowledgeView().count === 1 && phoneFacts(k).length === 0, 'hosted');
  const ask = k.process('How do lightbulbs work?');
  expect(ask.trace.echo && ask.trace.echo.pass, 'echo ' + (ask.trace.echo && ask.trace.echo.reason));
  expect(rulesOf(ask).includes('CS-RECALL-MANNER'), rulesOf(ask).join(','));
  expect(!rulesOf(ask).includes('AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), 'no second research');
  expect(ask.trace.msm.meaning.kind === 'recall' && /filament|heating/i.test(ask.reply || '') && /shared knowledge/i.test(ask.reply || ''), ask.reply);
  expect(k.memory().length === 0, 'memory');
});

T('an open crawl and an unparsed excerpt are not admitted', async () => {
  const k = mk();
  k.clearStarterKnowledge();
  k.setSharedKbWriteKey(KEY);
  const w = D.createIdleDream({ clock: CLOCK, host: k, writeKey: KEY, publishPacks: false });
  w.enqueue([{ id: 'gap:crawl', kind: 'aq1_miss', question: 'How do lightbulbs work', claim: null, extracts: [] }]);
  const crawl = w.applyMeasured('gap:crawl', { research_web: true, excerpt: METHOD, measured: { claim: METHOD.replace(/\.$/, ''), eps: 0.1, integrity: 0.9, extracts: [{ text: METHOD, verified: true, source: 'research.web' }] } });
  expect(crawl.ok === false && crawl.rule === 'DREAM-OPEN-CRAWL-REFUSED', JSON.stringify(crawl));
  const raw = await PT.researchExcerpt('How do lightbulbs work?', { fetch: wiki(PAGES), clock: CLOCK });
  expect(raw.ok === true && raw.parsed === false && raw.measured == null && /heating a filament/i.test(raw.excerpt || ''), JSON.stringify({ rule: raw.rule, parsed: raw.parsed }));
  w.enqueue([{ id: 'gap:raw', kind: 'aq1_miss', question: 'How do lightbulbs work', claim: null, extracts: [] }]);
  const unparsed = w.applyMeasured('gap:raw', raw);
  expect(unparsed.ok === false && unparsed.rule === 'DREAM-UNMEASURED' && k.sharedKnowledgeView().count === 0, JSON.stringify(unparsed));
  const llm = w.applyMeasured('gap:raw', { calls_llm: true, prompt: 'write it', measured: { claim: METHOD, eps: 0.05, extracts: [{ text: METHOD, verified: true, source: 'curated' }] } });
  expect(llm.ok === false && llm.rule === 'DREAM-LLM-REFUSED', JSON.stringify(llm));
});

T('Gilligan cold re-curate writes the same hosted bank with the granted key', () => {
  const k = mk();
  k.clearStarterKnowledge();
  const w = D.createIdleDream({ clock: CLOCK, host: k, publishPacks: false, maxAttempts: 1 });
  const access = PT.createWriteAccess({ host: k, mesh: w });
  w.enqueue([{ id: 'gap:letter:z', kind: 'letter_hole', letter: 'z', claim: null, extracts: [] }]);
  const q = w.tick({ answering: false });
  expect(q.lane === 'quarantine' && q.rule === 'DREAM-UNMEASURED', JSON.stringify({ lane: q.lane, rule: q.rule }));
  const keep = w.tick({ answering: false });
  expect(keep.role === 'gilligan' && keep.rule === 'GILLIGAN-COLD-KEEP' && keep.wrote_confirmed_shared === false, JSON.stringify({ role: keep.role, rule: keep.rule }));
  const good = w.spawnHelper({ task: 'research', parent: 'gilligan', spawned_by: 'athena', gap_id: 'cold-bulb', packet: { schema: D.SCHEMA, calls_llm: false, parent: 'gilligan', spawned_by: 'athena', task: 'research', gap_id: 'cold-bulb', kind: 'aq1_miss' } });
  expect(good.ok === true, JSON.stringify(good));
  w.athena.run(good.agent.id, { gap: { kind: 'aq1_miss', claim: METHOD.replace(/\.$/, ''), eps: 0.12, integrity: 0.95, extracts: [{ text: METHOD.replace(/\.$/, ''), verified: true, integrity: 0.95, source: 'allow-listed' }] } });
  expect(w.retireHelper(good.agent.id).ok === true, 'retire');
  expect(access.grant(KEY).held === true, 'grant for cold');
  let cold = null;
  for (let i = 0; i < 6 && !(cold && cold.rule === 'GILLIGAN-COLD-RECURATE'); i++) cold = w.tick({ answering: false });
  expect(cold && cold.rule === 'GILLIGAN-COLD-RECURATE' && cold.wrote_confirmed_shared === true && cold.backend_fill && cold.backend_fill.wrote_pack === false, JSON.stringify(cold && { rule: cold.rule, wrote: cold.wrote_confirmed_shared }));
  expect(k.sharedKnowledgeView().count >= 1 && phoneFacts(k).length === 0, 'same bank');
});

T('Ask still answers a how-method question from a Wikipedia-class source', async () => {
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
  expect(/heating a filament|heated by passing/i.test(t.reply || ''), t.reply);
  expect(f.memory().length === 0, 'evidence is not memory');
});

T('phone access holds the key in the session, packs stay gated, and the portable file skips the tools', () => {
  const b = D.boundary();
  expect(b.calls_llm === false && b.always_on === true && b.idle_gated === false && b.phone_pack_publish === 'gated' && b.mesh === '4.9.187' && b.pipeline_tools === true, JSON.stringify({ mesh: b.mesh, tools: b.pipeline_tools }));
  const tools = fs.readFileSync(path.join(ROOT, 'src', 'pipeline_tools.js'), 'utf8');
  const ui = fs.readFileSync(path.join(ROOT, 'src', 'app_custody.js'), 'utf8');
  const dream = fs.readFileSync(path.join(ROOT, 'src', 'dream_idle.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const build = fs.readFileSync(path.join(ROOT, 'build.py'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  expect(/researchExcerpt/.test(tools) && /createWriteAccess/.test(tools) && /RESEARCH-FETCH-UNAVAILABLE/.test(tools) && /RESEARCH-OPEN-CRAWL-REFUSED/.test(tools), 'tool surface');
  expect(!/nic-write-key/.test(tools) && !/nic-write-key/.test(ui), 'key is not in source');
  expect(/holdWriteKey/.test(ui) && /sessionStorage/.test(ui) && /researchExcerpt/.test(ui) && /curatedResearch/.test(ui) && /bridgeAskEvidence/.test(ui), 'custody wires the tools');
  expect(/publishPacks:\s*false/.test(ui) && !/publishPacks:\s*true/.test(ui), 'packs gated');
  expect(/src="src\/pipeline_tools\.js"/.test(html) && /src="src\/dream_idle\.js"/.test(html), 'site scripts');
  expect(/pipeline_tools\.js/.test(sw), 'service worker');
  expect(/src\/pipeline_tools\.js/.test(build) && /src\/dream_idle\.js/.test(build) && /does not inline/.test(build), 'single file skips the tools');
  expect(!/setInterval|setTimeout|child_process|openai|anthropic|ollama|Math\.random/.test(dream), 'mesh has no timer or model');
  expect(!/openai|anthropic|ollama/.test(tools), 'tools have no model');
  const single = path.join(ROOT, '..', '_release', 'single', 'kernel-app.html');
  if (fs.existsSync(single)) {
    const gz = zlib.gzipSync(fs.readFileSync(single)).length;
    expect(gz <= 570000 - 5000, 'gzip leave ' + (570000 - gz));
    const packed = fs.readFileSync(single, 'utf8');
    expect(!/FORGE-PIPELINE-TOOLS/.test(packed) && !/FORGE-IDLE-DREAM/.test(packed), 'portable file does not inline the tools');
  }
});

T('a buy-milk receipt hides patterns that do not apply and a math turn still names its route', () => {
  const TP = require(ROOT + '/src/turn_packet.js');
  const buy = mk().process('buy milk');
  const packet = buy.turn_packet || buy.trace.turn_packet;
  const pre = (packet.not_selected || []).find(c => c.route === 'world.preflight');
  expect(pre && pre.status === 'not_applicable' && pre.reason === 'pattern does not apply', JSON.stringify(pre));
  const card = TP.receiptCard(packet);
  expect(!/pattern does not apply/.test(card) && !/data-route="world\.preflight"/.test(card), card.slice(0, 400));
  const math = mk().process('what is 2 + 3');
  expect(math.trace.selection && math.trace.selection.winner === 'math.gp014', JSON.stringify(math.trace.selection && math.trace.selection.winner));
  const shown = TP.receiptCard(math.turn_packet || math.trace.turn_packet);
  expect(/data-route="language\.core"/.test(shown) && /not_evaluated/.test(shown), shown.slice(0, 400));
  const cap = mk().process('start over');
  expect(cap.trace.selection && cap.trace.selection.winner === 'capability.frame', JSON.stringify(cap.trace.selection && cap.trace.selection.winner));
});

T('bleach and ammonia is answered from web evidence and mustard gas is a warning not a procedure', async () => {
  const pages = {
    Bleach: { title: 'Bleach', extract: 'Bleach is a chemical product used to remove color.\nMixing bleach and ammonia produces chloramine, a toxic gas that can injure the lungs.', description: 'chemical product' },
    Ammonia: { title: 'Ammonia', extract: 'Ammonia is a compound of nitrogen and hydrogen.\nMixing bleach and ammonia produces chloramine, a toxic gas that can injure the lungs.', description: 'chemical compound' },
    'Mustard gas': { title: 'Mustard gas', extract: 'Mustard gas is a chemical weapon and a blister agent.\nIts use as a weapon is prohibited.\nPLACEHOLDERSTEP is not a procedure.', description: 'chemical weapon' }
  };
  const pick = dec => /mustard/i.test(dec) ? ['Mustard gas'] : /bleach|ammonia|mix/i.test(dec) ? ['Bleach', 'Ammonia'] : [];
  const st = {};
  const store = KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } });
  const f = FK.ForgeKernel({ clock: CLOCK, lexicon: LEX, lexiconExt: EXT, store, vaultIterations: 1000, fetch: wiki(pages, pick) });
  await f.vault.setup('correct horse');
  await f.vault.unlock('correct horse');
  f.clearStarterKnowledge();
  const TP = require(ROOT + '/src/turn_packet.js');
  const bleach = f.process('what happens if you mix bleach and ammonia?');
  expect(bleach.trace.msm.meaning.kind === 'tool_started' && bleach.trace.msm.meaning.tool === 'research.web', bleach.reply);
  expect(bleach.forge && bleach.forge.authority_boundary && bleach.forge.authority_boundary.tool_egress === 'research.web · external', JSON.stringify(bleach.forge && bleach.forge.authority_boundary));
  expect(!/pattern does not apply/.test(TP.receiptCard(bleach.turn_packet || bleach.trace.turn_packet)), 'dead patterns on the ask receipt');
  const b = await bleach.toolJob;
  expect(/chloramine/i.test(b.reply || '') && /toxic gas/i.test(b.reply || ''), b.reply);
  expect(b.forge && b.forge.authority_boundary && b.forge.authority_boundary.tool_egress === 'research.web · external', JSON.stringify(b.forge && b.forge.authority_boundary));
  expect(b.trace.outcome.category === 'SELECTED_MEANING', b.trace.outcome && b.trace.outcome.category);
  const mustard = f.process('how do you make mustard gas?');
  expect(mustard.trace.msm.meaning.kind === 'tool_started' && mustard.trace.msm.meaning.tool === 'research.web', mustard.reply);
  const g = await mustard.toolJob;
  expect(/chemical weapon/i.test(g.reply || '') && /blister agent/i.test(g.reply || ''), g.reply);
  expect(!/PLACEHOLDERSTEP/.test(g.reply || ''), g.reply);
  expect(g.trace.msm.meaning.hazard === 'chemical_weapon', JSON.stringify(g.trace.msm.meaning && g.trace.msm.meaning.hazard));
});

T('version registry CONFLICTS NEXT_BUILD name 4.9.175', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.202', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.175/.test(conf) && /pipeline tools/.test(conf) && /Gilligan Codex/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.175/.test(nb) && /stubs/.test(nb) && /Gilligan Codex/.test(nb) && /Athena document/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.175/.test(readme) && /[Ww]rite key/.test(readme) && /research/.test(readme), 'README');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.202' && (((((tgt.suites[0] === 'r4201_suite.js' || tgt.suites[0] === 'r4200_suite.js' || tgt.suites[0] === 'r4199_suite.js' || tgt.suites[0] === 'r4198_suite.js' || tgt.suites[0] === 'r4197_suite.js' || tgt.suites[0] === 'r4196_suite.js' || tgt.suites[0] === 'r4195_suite.js' || tgt.suites[0] === 'r4194_suite.js') || tgt.suites[0] === 'r4193_suite.js' || tgt.suites[0] === 'r4191_suite.js' || tgt.suites[0] === 'r4190_suite.js' || tgt.suites[0] === 'r4189_suite.js' || tgt.suites[0] === 'r4188_suite.js' || tgt.suites[0] === 'r4187_suite.js' || tgt.suites[0] === 'r4186_suite.js' || tgt.suites[0] === 'r4185_suite.js' || tgt.suites[0] === 'r4184_suite.js' || tgt.suites[0] === 'r4183_suite.js' || tgt.suites[0] === 'r4182_suite.js' || tgt.suites[0] === 'r4181_suite.js' || tgt.suites[0] === 'r4180_suite.js') || tgt.suites[0] === 'r4179_suite.js') || tgt.suites[0] === 'r4178_suite.js') || tgt.suites[0] === 'r4177_suite.js' || tgt.suites[0] === 'r4176_suite.js' || tgt.suites[0] === 'r4175_suite.js') && tgt.suites.includes('r4174_suite.js'), JSON.stringify({ release: tgt.release, head: tgt.suites[0] }));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.202' && reg.features.some(f => f.id === 'R4175-PIPELINE-TOOLS'), reg.version);
  expect(reg.count === reg.features.length && reg.count >= 334, 'count ' + reg.count);
});

(async () => {
  let failed = 0;
  const rows = [];
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4175', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4175', name: t.name, ok: false, why: String(e.message || e).slice(0, 800) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
