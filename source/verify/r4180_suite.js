/* R4180 (4.9.180): Athena document tools, admit parse, chloramine headline, ProtoForge definition.
 * No LLM. Packs stay gated. Drift and chi still gate the bank. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
const D = require(ROOT + '/src/dream_idle.js');
const CP = require(ROOT + '/src/claim_parse.js');
const A = require(ROOT + '/src/athena_doc.js');
const KMOD = require(ROOT + '/src/kernel.js');
const FK = require(ROOT + '/src/forge.js');
const Core = require(ROOT + '/src/rmc_core.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-29T16:00:00Z';
const KEY = 'nic-write-key-ok';
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
      const hits = Object.keys(pages).filter(title => pages[title].hit ? pages[title].hit(dec) : true);
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

T('what is protoforge answers the local definition and a command stays internal', () => {
  const k = mk();
  k.clearStarterKnowledge();
  const named = k.process('What is protoforge?');
  expect(named.trace.selection.winner === 'language.core', named.reply);
  expect(named.trace.msm.meaning.kind === 'define', named.reply);
  expect(/ProtoForge is Nic's full local recursive symbolic runtime/.test(named.reply || ''), named.reply);
  expect(/PyBullet/.test(named.reply || '') && /Forge Mobile/.test(named.reply || ''), named.reply);
  expect(named.trace.msm.meaning.tool !== 'research.web', named.reply);
  expect(rulesOf(named).includes('PF-LOCAL-DEF'), rulesOf(named).join(','));
  const cmd = k.process('analyze drift');
  expect(cmd.trace.msm.meaning.reason === 'PF_INTERNAL', cmd.reply);
  const run = k.process('run protoforge');
  expect(run.trace.msm.meaning.reason === 'PF_INTERNAL', run.reply);
});

T('an HTML sentence and a which-clause admit and the next Ask recalls them', async () => {
  const k = mk();
  k.clearStarterKnowledge();
  k.setSharedKbWriteKey(KEY);
  const html = '<p>Quartz <b>is</b> a hard crystalline mineral.</p>';
  const which = 'Jupiter is the largest planet, which orbits the Sun.';
  const quartz = CP.admitText(html, t => k.reparseClause(t), c => k.renderClause(c));
  const jup = CP.admitText(which, t => k.reparseClause(t), c => k.renderClause(c));
  expect(quartz && /quartz/i.test(quartz.text) && /mineral/i.test(quartz.text) && !/[<>]/.test(quartz.text), JSON.stringify(quartz && quartz.text));
  expect(jup && /jupiter/i.test(jup.text) && /planet/i.test(jup.text) && !/which/i.test(jup.text), JSON.stringify(jup && jup.text));
  const w = D.createIdleDream({ clock: CLOCK, host: k, writeKey: KEY, publishPacks: false, research: D.curatedResearch });
  const packPath = path.join(ROOT, 'packs', 'confirmed_shared', 'q.json');
  const before = crypto.createHash('sha256').update(fs.readFileSync(packPath)).digest('hex');
  for (const hit of [quartz, jup]) {
    const bridged = D.bridgeAskEvidence({ meaning: { kind: 'research_answer', excerpt: hit.source, generated: { text: hit.source, drift: 0.12 }, assimilation: { intake: 'projectable', drift: 0.12 } }, question: 'What is ' + hit.text.split(' ')[0] + '?' });
    expect(bridged.ok === true, JSON.stringify(bridged));
    w.enqueue([bridged.gap]);
    const step = w.tick({ answering: false });
    expect(step.wrote_confirmed_shared === true && step.wrote_pack !== true, JSON.stringify({ rule: step.rule, wrote: step.wrote_confirmed_shared, why: step.backend_fill }));
  }
  expect(k.sharedKnowledgeView().count >= 2 && phoneFacts(k).length === 0, 'hosted rows');
  const again = k.process('What is quartz?');
  expect(/mineral/i.test(again.reply || '') && !rulesOf(again).includes('AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), again.reply + ' ' + rulesOf(again).join(','));
  const planet = k.process('What is the largest planet?');
  expect(/jupiter/i.test(planet.reply || ''), planet.reply);
  expect(crypto.createHash('sha256').update(fs.readFileSync(packPath)).digest('hex') === before, 'pack untouched');
  const beforeCount = k.sharedKnowledgeView().count;
  w.enqueue([{ id: 'gap:junk', kind: 'aq1_miss', claim: '@@@', eps: 0.1, integrity: 0.95, extracts: [{ text: '@@@', verified: true, integrity: 0.95, source: 'allow-listed' }], calls_llm: false }]);
  const junk = w.tick({ answering: false });
  expect(junk.wrote_confirmed_shared !== true && k.sharedKnowledgeView().count === beforeCount, JSON.stringify(junk.backend_fill || junk.rule));
});

T('bleach and ammonia headlines chloramine gas and does not give a procedure', async () => {
  expect(typeof CP.hazardHeadline !== 'function' && typeof CP.applyMixHazard !== 'function', 'headline removed');
  const pages = {
    Bleach: { title: 'Bleach', hit: dec => /bleach|ammonia|mix/i.test(dec), extract: 'Bleach is a chemical product used to remove color.\nMixing bleach and ammonia produces chloramine, a toxic gas that can injure the lungs. Mixing bleach with ammonia similarly produces nitrogen trichloride. Add one cup of bleach. Heat the mixture.', description: 'chemical product' },
    Ammonia: { title: 'Ammonia', hit: dec => /bleach|ammonia|mix/i.test(dec), extract: 'Ammonia is a compound of nitrogen and hydrogen.\nMixing bleach and ammonia produces chloramine, a toxic gas that can injure the lungs. Hydrazine is a compound named beside that reaction.', description: 'chemical compound' }
  };
  const st = {};
  const store = KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } });
  const f = FK.ForgeKernel({ clock: CLOCK, lexicon: LEX, lexiconExt: EXT, store, vaultIterations: 1000, fetch: wiki(pages) });
  await f.vault.setup('correct horse');
  await f.vault.unlock('correct horse');
  f.clearStarterKnowledge();
  f.setSharedKbWriteKey(KEY);
  const started = f.process('What happens if you mix bleach and ammonia?');
  const t = await started.toolJob;
  const reply = t.reply || '';
  expect(!/\b(add one cup|heat the mixture|tablespoon)\b/i.test(reply), reply);
  expect(!rulesOf(f.process('What is Chloramine?')).includes('CS-RECALL-ASK-KEY'), 'ask-key shortcut removed');
  const wikiOnly = Core.runSync({ question: 'What happens if you mix bleach and ammonia?', live: true, memory: { research: [{ id: 'wiki', text: 'Mixing bleach and ammonia produces chloramine, a toxic gas that can injure the lungs.', url: 'https://en.wikipedia.org/wiki/Chloramine', source: 'wikipedia', trust: 'low', quarantined: true }] } });
  expect(wikiOnly.product_reply === false && !wikiOnly.reply, JSON.stringify({ reply: wikiOnly.reply, rule: (wikiOnly.quarantine_curation || [])[0] }));
});

T('seventeen Athena tools are wired and sixty-seven stays are skipped', async () => {
  const c = A.counts();
  expect(c.built === 17 && c.skipped === 67 && c.total === 84, JSON.stringify(c));
  expect(A.INVENTORY.filter(x => x.status === 'skipped').every(x => x.reason && x.caller == null), 'skip reasons');
  expect(A.INVENTORY.filter(x => x.status === 'built').every(x => x.caller), 'built callers');
  const k = mk();
  const doc = A.create({ store: k.store, publishPacks: false, clock: CLOCK });
  const noted = doc.noteAdmit({ claim: 'Quartz is a mineral', eps: 0.12, packet: { sfe: { Phi: 9, eps: 0.12, mu: 1 } } });
  expect(noted.private.ok === true && noted.private.published === false, JSON.stringify(noted.private));
  expect(noted.community.ok === true && noted.community.rule === 'COMMUNITY-PACK-GATED' && noted.community.published === false, JSON.stringify(noted.community));
  expect(noted.global.ok === true && noted.global.published === false, JSON.stringify(noted.global));
  expect(noted.defense.route === 'project' && noted.learned.ref === '7.5', JSON.stringify(noted.defense));
  const held = doc.node('global', 'A noisy claim stays out', 0.91, null);
  expect(held.ok === false && held.rule === 'GLOBAL-DRIFT-HELD' && held.route === 'hard_stop', JSON.stringify(held));
  const chi = doc.defend(0.37);
  expect(chi.write_global === false && chi.route === 'chi', JSON.stringify(chi));
  const route = doc.interact('What is quartz?');
  expect(route.lane === 'ask' && route.calls_llm === false && route.network === false, JSON.stringify(route));
  expect(doc.dashboard().tabs.indexOf('Ask') === 0 && doc.roleMap().athena, 'dashboard');
  const box = await doc.sealChat('Quartz is a mineral');
  expect(box.ok === true && box.plaintext_stored === false && box.network === false && box.box.ct.indexOf('Quartz') < 0, JSON.stringify(box));
  const opened = await doc.openChat(box.box);
  expect(opened.ok === true && opened.text === 'Quartz is a mineral', opened.text);
  const inv = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'forge_tool_inventory.json'), 'utf8'));
  expect(inv.athena_doc && inv.athena_doc.counts.built === 17 && inv.athena_doc.counts.skipped === 67, JSON.stringify(inv.athena_doc && inv.athena_doc.counts));
  expect(inv.athena_doc.items.filter(x => x.status === 'skipped').length === 67, 'inventory skips');
});

T('hard drift, a locked passcode, and pack publish stay refused', () => {
  const k = mk();
  k.setSharedKbWriteKey(KEY);
  const w = D.createIdleDream({ clock: CLOCK, host: k, writeKey: KEY, publishPacks: false, research: D.curatedResearch });
  w.enqueue([{ id: 'gap:hot', kind: 'aq1_miss', question: 'hot', claim: 'A noisy claim is false', eps: 0.91, integrity: 0.99, extracts: [{ text: 'A noisy claim is false', verified: true, integrity: 0.99, source: 'allow-listed' }], calls_llm: false }]);
  const hot = w.tick({ answering: false });
  expect(hot.rule === 'GRACE-RECENTER' && hot.wrote_confirmed_shared !== true, JSON.stringify({ rule: hot.rule, wrote: hot.wrote_confirmed_shared }));
  const doc = w.athenaDoc;
  expect(doc.setPasscode('1234').ok === true, 'passcode');
  const locked = doc.node('private', 'A private node', 0.1, null);
  expect(locked.ok === false && locked.rule === 'PASSCODE-LOCKED', JSON.stringify(locked));
  expect(doc.unlock('nope').ok === false && doc.unlock('1234').unlocked === true, 'unlock');
  expect(D.boundary().phone_pack_publish === 'gated' && D.boundary().athena_doc === true && D.boundary().mesh === '4.9.187', JSON.stringify(D.boundary().mesh));
  const neo = D.christPing({ initiator: 'neo', eps: 0.91 });
  expect(neo.rule === 'CHRIST-PING-GILLIGAN-ONLY', JSON.stringify(neo));
});

T('version registry CONFLICTS NEXT_BUILD name 4.9.180', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.191', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.180/.test(conf) && /Athena document/.test(conf) && /chloramine/.test(conf) && /ProtoForge/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.180/.test(nb) && /Athena document/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.180/.test(readme) && /WIRING_180/.test(readme), 'README');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.191' && (tgt.suites[0] === 'r4191_suite.js' || tgt.suites[0] === 'r4190_suite.js' || tgt.suites[0] === 'r4189_suite.js' || tgt.suites[0] === 'r4188_suite.js' || tgt.suites[0] === 'r4187_suite.js' || tgt.suites[0] === 'r4186_suite.js' || tgt.suites[0] === 'r4185_suite.js' || tgt.suites[0] === 'r4184_suite.js' || tgt.suites[0] === 'r4183_suite.js' || tgt.suites[0] === 'r4182_suite.js' || tgt.suites[0] === 'r4181_suite.js' || tgt.suites[0] === 'r4180_suite.js') && tgt.suites.includes('r4179_suite.js'), JSON.stringify({ release: tgt.release, head: tgt.suites[0] }));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.191' && reg.features.some(f => f.id === 'R4180-ATHENA-DOC'), reg.version);
  expect(reg.count === reg.features.length && reg.count >= 337, 'count ' + reg.count);
  const req = fs.readFileSync(path.join(ROOT, 'src', 'req_packet.js'), 'utf8');
  expect(/4\.9\.180/.test(req) && /R4180-ATHENA-DOC/.test(req), 'req packet');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const build = fs.readFileSync(path.join(ROOT, 'build.py'), 'utf8');
  expect(html.indexOf('src/claim_parse.js') < html.indexOf('src/dream_idle.js') && html.indexOf('src/athena_doc.js') < html.indexOf('src/dream_idle.js'), 'script order');
  expect(/\.\/src\/athena_doc\.js/.test(sw) && /\.\/src\/claim_parse\.js/.test(sw), 'service worker');
  expect(/src\/athena_doc\.js/.test(build) && /does not inline/.test(build), 'single file skips the doc');
  const single = path.join(ROOT, '..', '_release', 'single', 'kernel-app.html');
  if (fs.existsSync(single)) {
    const gz = zlib.gzipSync(fs.readFileSync(single)).length;
    const leave = 570000 - gz;
    expect(gz < 570000 && leave >= 4000, 'gzip leave ' + leave);
    const packed = fs.readFileSync(single, 'utf8');
    expect(!/FORGE-ATHENA-DOC/.test(packed), 'portable file does not inline the doc');
  }
});

(async () => {
  let failed = 0;
  const rows = [];
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4180', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4180', name: t.name, ok: false, why: String(e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
