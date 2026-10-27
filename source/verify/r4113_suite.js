/* R4113 (4.9.113): Doc 7 categories are visible and kept apart.
 * Language corpus ≠ Evidence ≠ Memory ≠ Trace/receipt ≠ Authority records.
 * Presence ≠ truth. A lookup stays evidence. Written FIRST (failing).
 * No offline replay, no MSM Doc 2, no naming rename. No new knowledge store. */
const fs = require('fs');
const ROOT = require('path').join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const FK = require(ROOT + '/src/forge.js');
const M = require(ROOT + '/src/kmath.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const rows = [], tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-27T00:13:00Z';
const mk = o => KMOD.Kernel(Object.assign({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK }, o || {}));
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
let TP = null, tpErr = null;
try { TP = require(ROOT + '/src/turn_packet.js'); } catch (e) { tpErr = e; }
const packetOf = r => r && (r.turn_packet || (r.trace && r.trace.turn_packet));
const need = () => { if (!TP || !TP.doc7Of || !TP.census || !TP.categoryPanel) throw new Error('doc7 pathway missing' + (tpErr ? ': ' + tpErr.message : '')); };
const IDS = ['language_corpus', 'evidence', 'memory', 'trace_receipt', 'authority'];
const LAW = 'presence ≠ truth';

function cats(r, why) {
  need();
  const p = packetOf(r);
  const d = p && p.doc7;
  expect(d && d.law === LAW && d.knowledge_store === false, why + ' doc7 ' + JSON.stringify(d && { law: d.law, b: d.belief, k: d.knowledge_store }));
  expect(JSON.stringify(Object.keys(d.present)) === JSON.stringify(IDS), why + ' keys ' + Object.keys(d.present || {}));
  expect(d.present.trace_receipt === true, why + ' receipt missing');
  const card = TP.receiptCard(p);
  expect(card.indexOf('data-doc7-belief="' + d.belief + '"') >= 0 && card.indexOf(LAW) >= 0 && card.indexOf(d.why) >= 0, why + ' card');
  const on = IDS.filter(id => card.indexOf('data-doc7-cat="' + id + '"') >= 0);
  expect(on.length === 5, why + ' cats ' + on.join(','));
  expect((card.match(/data-doc7-belief="1"/g) || []).length === (d.belief === 'none' ? 0 : 1), why + ' belief marks');
  return d;
}

T('a remember, a recall, a gloss, a calculation, and a blocked action are five different categories', () => {
  need();
  expect(JSON.stringify(TP.DOC7_IDS) === JSON.stringify(IDS), JSON.stringify(TP.DOC7_IDS));
  const k = mk();
  const rem = k.process('remember that my car is red');
  const rd = cats(rem, 'remember');
  expect(rem.reply === 'I noted that your car is red.' && rd.belief === 'memory' && rd.present.memory && rd.present.evidence && !rd.present.language_corpus, rem.reply + ' ' + JSON.stringify(rd.present));
  expect(/utterance is evidence/.test(rd.why) && /different category/.test(rd.why), rd.why);
  const rec = k.process('is my car red?');
  const yd = cats(rec, 'recall');
  expect(/^Yes\./.test(rec.reply) && yd.belief === 'memory' && yd.present.memory && !yd.present.evidence && !yd.present.language_corpus, rec.reply + ' ' + JSON.stringify(yd.present));
  const def = k.process('define car');
  const dd = cats(def, 'define');
  expect(def.trace.msm.meaning.kind === 'define' && dd.belief === 'language_corpus' && dd.present.language_corpus && !dd.present.memory && !dd.present.evidence, def.reply + ' ' + JSON.stringify(dd));
  expect(packetOf(def).evidence_tiers.some(t => t.tier === 'language_corpus' && /^lexicon:/.test(t.id)), JSON.stringify(packetOf(def).evidence_tiers));
  const math = k.process('what is 2 + 3');
  const md = cats(math, 'math');
  expect(math.reply === '2 + 3 = 5.' && md.belief === 'trace_receipt' && md.present.trace_receipt && !md.present.memory && !md.present.evidence && !md.present.language_corpus, math.reply + ' ' + JSON.stringify(md.present));
  const buy = k.process('buy milk');
  const bd = cats(buy, 'buy');
  expect(bd.belief === 'authority' && bd.present.authority && !bd.present.memory && !bd.present.evidence && packetOf(buy).gate.state === 'action_blocked', JSON.stringify(bd));
  expect(sharedN(k) === 0, 'shared KB written');
});

T('a lookup stays evidence, a denied lookup is not a found source, and presence is not support', () => {
  need();
  const bare = { outcome: { class: 'selected', category: 'SELECTED_MEANING' }, echo: { pass: true }, memory: [], selection: { routes: [], candidates: [] } };
  const msm = extra => ({ meaning: Object.assign({ tool: 'research.web' }, extra), evidence: { refs: [] }, limits: { may_write_memory: false } });
  const bad = TP.build(Object.assign({}, bare, { intent_kind: 'PROPOSE_EVIDENCE', research: { schema: 'FORGE-RESEARCH-TRACE/v1' } }), 'x', msm({ kind: 'research_answer', unsupported: true }));
  expect(bad.doc7.belief === 'evidence' && bad.doc7.research === true && bad.doc7.knowledge_store === false && !bad.doc7.present.memory, JSON.stringify(bad.doc7));
  expect(/citation is present and unsupported/.test(bad.doc7.why) && /not a knowledge store/.test(bad.doc7.why), bad.doc7.why);
  expect(!/biological process|chloroplast/.test(JSON.stringify(bad)), 'excerpt copied onto the packet');
  const ok = TP.build(Object.assign({}, bare, { intent_kind: 'PROPOSE_EVIDENCE', research: { schema: 'FORGE-RESEARCH-TRACE/v1' } }), 'x', msm({ kind: 'research_answer', support: { level: 'single' }, provenance: { lead_supported: true } }));
  expect(/verbatim span supports/.test(ok.doc7.why) && !/span:/.test(ok.doc7.why), ok.doc7.why);
  const card = TP.receiptCard(bad);
  expect(/data-doc7-research="evidence"/.test(card) && !/retrieved context|\bRAG\b|embedding|knowledge base/i.test(card), card.slice(0, 400));
  const denied = mk().process('research photosynthesis');
  const nd = cats(denied, 'denied');
  expect(denied.trace.msm.meaning.kind === 'tool_denied' && nd.belief === 'authority' && !nd.present.evidence && nd.research === false, denied.reply + ' ' + JSON.stringify(nd));
  expect(!/not a knowledge store/.test(nd.why), nd.why);
});

T('Audit, Memory, and the vault name the categories, and a real lookup does not fill a store', async () => {
  need();
  const k = mk();
  k.process('remember that my car is red');
  k.store.save('language_examples', [{ concept: 'wug', example: 'a wug glides' }]);
  k.store.save('lexicon_user', [{ id: 'U.WUG' }]);
  const c = TP.census(cat => k.store.load(cat));
  expect(c.law === LAW && c.knowledge_store === false && c.shared_knowledge === 0, JSON.stringify(c));
  expect(c.counts.language_corpus === 2 && c.counts.memory === k.memory().length + k.cold().length && c.counts.evidence === k.evidence().length + (k.store.load('web_evidence') || []).length, JSON.stringify(c.counts));
  expect(c.counts.trace_receipt === k.traces().length + (k.store.load('receipts') || []).length + (k.store.load('containment_receipts') || []).length, 'trace count');
  expect(c.counts.authority === (k.store.load('permissions') || []).length + (k.store.load('admitted_rules') || []).length, 'authority count');
  const panel = TP.categoryPanel(cat => k.store.load(cat));
  expect(/data-doc7-census/.test(panel) && /Language corpus ≠ Evidence ≠ Memory ≠ Trace\/receipt ≠ Authority records/.test(panel) && /data-doc7-shared/.test(panel) && /empty/.test(panel), panel.slice(0, 500));
  for (const id of IDS) expect(panel.indexOf('data-doc7-cat="' + id + '"') >= 0, id);
  const app = fs.readFileSync(ROOT + '/src/app.js', 'utf8');
  expect(/categoryPanel\(/.test(app) && /data-doc7-cat="memory"/.test(app) && /data-doc7-cat="evidence"/.test(app) && /data-doc7-cat="language_corpus"/.test(app) && /presence ≠ truth/.test(app), 'memory and audit surfaces');
  const bench = fs.readFileSync(ROOT + '/src/app_bench.js', 'utf8');
  expect(/data-doc7-cat="evidence"/.test(bench) && /not a knowledge store/.test(bench) && /presence ≠ truth/.test(bench) && /receiptCard\(/.test(bench), 'vault and tool receipt');
  const css = fs.readFileSync(ROOT + '/styles.css', 'utf8');
  expect(/\.tag\.doc7/.test(css), 'no doc7 tag style');
  const pages = {
    'https://en.wikipedia.org/robots.txt': { ct: 'text/plain', body: 'User-agent: *\nDisallow: /w/index.php?title=Special\n' },
    'list=search': { ct: 'application/json', body: JSON.stringify({ query: { search: [{ title: 'Photosynthesis' }] } }) },
    'titles=Photosynthesis': { ct: 'application/json', body: JSON.stringify({ query: { pages: { 1: { title: 'Photosynthesis', extract: 'Photosynthesis is a biological process used by plants to convert light energy into chemical energy.\nIt occurs in chloroplasts.' } } } }) }
  };
  const fetch = async url => { const u = String(url); const p = Object.keys(pages).find(x => u.includes(x)); if (!p) return { ok: false, status: 404, headers: { get: () => '' }, text: async () => '' }; const pg = pages[p]; return { ok: true, status: 200, headers: { get: h => h.toLowerCase() === 'content-type' ? pg.ct : null }, text: async () => pg.body }; };
  const st = {}; const store = KMOD.MemoryStore({ get: key => st[key], set: (key, v) => { st[key] = v; } });
  const f = FK.ForgeKernel({ lexicon: LEX, store, clock: CLOCK, vaultIterations: 1000, fetch });
  await f.vault.setup('correct horse'); await f.vault.unlock('correct horse');
  const start = f.process('research photosynthesis');
  const sd = cats(start, 'start');
  expect(start.trace.msm.meaning.kind === 'tool_started' && sd.belief === 'evidence' && sd.research === true && !sd.present.memory && /lookup is starting/.test(sd.why), start.reply + ' ' + sd.why);
  const t = await start.toolJob;
  const td = t.trace.turn_packet && t.trace.turn_packet.doc7;
  expect(t.trace.msm.meaning.kind === 'tool_result' && td && td.belief === 'evidence' && td.research === true && !td.present.memory && td.knowledge_store === false, JSON.stringify(td));
  expect(/not a knowledge store/.test(td.why) && !/biological process|chloroplast/.test(JSON.stringify(t.trace.turn_packet)), td.why);
  expect(f.memory().length === 0 && (f.store.load('shared_knowledge') || []).length === 0 && f.webEvidence().length === 1 && f.webEvidence()[0].candidate_evidence_only === true, 'lookup wrote a belief store');
  const after = TP.census(cat => f.store.load(cat));
  expect(after.counts.evidence === f.evidence().length + f.webEvidence().length && after.counts.memory === 0 && after.shared_knowledge === 0, JSON.stringify(after.counts));
  expect((f.store.load('trace') || []).some(row => row && row.turn_packet && row.turn_packet.doc7 && row.turn_packet.doc7.belief === 'evidence'), 'audit cannot see the lookup');
});

T('a greeting, a dream, and an Echo failure do not become a stored belief', () => {
  const hello = mk().process('hello');
  const hd = cats(hello, 'hello');
  expect(hello.trace.intent_kind === 'CLARIFY' && hd.belief === 'none' && hd.present.trace_receipt && !hd.present.memory && !hd.present.evidence && !hd.present.language_corpus && !hd.research, JSON.stringify(hd));
  const dream = mk().process('Suppose the car is red.');
  const dd = cats(dream, 'dream');
  expect(/dream quarantine/.test(dream.reply) && dd.belief === 'none' && !dd.present.memory && packetOf(dream).containment.route === 'dream_state_quarantine_candidate', dream.reply + ' ' + JSON.stringify(dd));
  const echo = mk({ renderFault: t => t.replace('noted', 'denied') }).process('remember that my car is red');
  const ed = cats(echo, 'echo');
  expect(echo.reply == null && packetOf(echo).receipt_type === 'echo_fail' && ed.belief === 'none' && !ed.present.memory, JSON.stringify(ed));
  expect(M.DRIFT_RULING.project_max === 0.35 && M.DRIFT_RULING.explore_min === 0.4 && M.DRIFT_RULING.explore_max === 0.8, 'drift law moved');
  const src = fs.readFileSync(ROOT + '/src/turn_packet.js', 'utf8');
  expect(!/\b(llm|embedding|openai|classifier)\b/i.test(src), 'model path');
  expect(sharedN(mk()) === 0, 'shared KB written');
});

T('version, registry, CONFLICTS, and NEXT_BUILD name 4.9.113 and leave the later queue parked', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  expect(ver === '4.9.113', ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver && reg.count === reg.features.length, reg.version + ' count ' + reg.count);
  const ids = reg.features.map(f => f.id);
  expect(ids.includes('R4112-GATE') && ids.includes('R4112-CANDIDATES'), '4.9.112 rows dropped');
  expect(ids.includes('R4113-CATEGORIES') && ids.includes('R4113-BELIEF'), ids.slice(-4).join(','));
  for (const id of ['R4113-CATEGORIES', 'R4113-BELIEF']) {
    const f = reg.features.find(x => x.id === id);
    expect(f.claim === 'Partial' && (f.proof || []).includes('R4113') && /4\.9\.113/.test(f.note), id + ' ' + JSON.stringify(f && f.proof));
    expect(!/Christ function/i.test(f.note), id);
  }
  const tally = {}; for (const f of reg.features) tally[f.claim] = (tally[f.claim] || 0) + 1;
  expect(reg.claims.Implemented === 112 && tally.Implemented === 113, 'implemented tally moved ' + reg.claims.Implemented + '/' + tally.Implemented);
  expect(reg.claims.Partial === tally.Partial + 1, 'partial delta moved ' + reg.claims.Partial + '/' + tally.Partial);
  const cf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  const sec = cf.slice(cf.lastIndexOf('## v4.9.113'));
  expect(/Language corpus/.test(sec) && /Evidence/.test(sec) && /Memory/.test(sec) && /Trace\/receipt/.test(sec) && /Authority records/.test(sec) && /presence ≠ truth/.test(sec), 'categories missing');
  expect(/not a knowledge store|lookup is evidence/.test(sec) && /shared KB stays empty|Shared KB stays empty/.test(sec), 'lookup law missing');
  expect(/4\.9\.114|MSM Doc 2/.test(sec) && /4\.9\.115|naming/.test(sec) && /out of scope|do not/.test(sec), 'later queue not fenced');
  expect(!/Christ function/i.test(sec), 'Christ function');
  const next = fs.readFileSync(ROOT + '/../NEXT_BUILD.md', 'utf8');
  expect(/4\.9\.113/.test(next) && /Language corpus/.test(next) && /presence ≠ truth/.test(next), 'NEXT_BUILD does not record the categories');
  const readme = fs.readFileSync(ROOT + '/../README.md', 'utf8');
  expect(/4\.9\.113/.test(readme) && /presence ≠ truth/.test(readme) && /Language corpus/.test(readme), 'README does not name the surface');
  const targeted = fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8');
  expect(/"release": "4\.9\.113"/.test(targeted) && /r4113_suite\.js/.test(targeted), 'targeted gate omits this suite');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4113', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4113', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows));
  process.exit(failed ? 1 : 0);
})();
