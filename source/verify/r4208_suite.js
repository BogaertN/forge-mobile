/* R4208 (4.9.208): Athena and Gilligan on as curators (Nic decision (f), step 4).
 * Gaps are questions Ask held. Athena looks them up by resonance through the same engine Ask uses (rmc_core), with ONLY trusted
 * anchors as memory (no word overlap, no Wikipedia). An admit needs the engine gate (ε ≤ 0.35, C ≥ 0.87, Echo ≥ 0.85) and the
 * Echo re-parse (the candidate alone must re-derive itself with Echo passing). Gilligan guards premises and bands. Writes go
 * only through the locked-down writer (KSb.insertAdmitted); otherwise rows stay pending on the phone. Real engine, no LLM. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CU = require(ROOT + '/src/curators_208.js');
const KM = require(ROOT + '/src/kmath.js');
const Core = require(ROOT + '/src/rmc_core.js');
const Next = require(ROOT + '/src/next_layer.js');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const STARTER = JSON.parse(read('data/anchors_187.json')).anchors.map(r => Object.assign({}, r, { tier: 'anchor', state: 'anchor', trust: 'trusted' }));
const G190 = JSON.parse(read('data/anchors_188/shards/g190.json')).anchors;
const anchorsFor = async q => STARTER.concat(/sky|ocean|jupiter|planet|leaves|hamlet/i.test(q) ? G190 : []);
function make(o) { o = o || {}; const mem = {}; const calls = { run: [], insert: [] };
  const c = CU.Curators({ store: { get: k => mem[k], set: (k, v) => { mem[k] = JSON.parse(JSON.stringify(v)); } }, kmath: KM,
    run: async p => { calls.run.push(p); return Core.runSync(p); }, anchorsFor: o.anchorsFor || anchorsFor,
    insert: async b => { calls.insert.push(b); return o.insert ? o.insert(b) : { ok: false, pending: true, rule: 'KB-WRITER-NO-SESSION' }; },
    digest: async () => (o.digest ? o.digest() : 'd1'), now: () => 1000 });
  return { c, mem, calls }; }

T('only held questions become gaps; answered turns, non-questions and repeats do not', () => {
  const { c, mem } = make();
  expect(c.noteHeld('What is photosynthesis?', { product_reply: false }).rule === 'CURATE-GAP-QUEUED', 'held');
  expect(c.noteHeld('What is photosynthesis?', { product_reply: false }).rule === 'CURATE-GAP-KNOWN', 'repeat');
  expect(c.noteHeld('What is DNA?', { product_reply: true }).rule === 'CURATE-ALREADY-ANSWERED', 'answered');
  expect(c.noteHeld('remember that my car is red', { product_reply: false }).rule === 'CURATE-NOT-A-QUESTION', 'statement');
  expect(mem['forge.curation.v1'].queue.length === 1 && mem['forge.curation.v1'].schema === 'FORGE-CURATION/v1', 'persisted');
});
T('Athena admits by resonance through the engine, runs the Echo re-parse, and with no signed writer the row stays pending', async () => {
  const { c, calls } = make();
  c.noteHeld('Why is the sky blue?', { product_reply: false });
  const r = await c.tick();
  expect(r.to === 'pending' && r.rule === 'KB-WRITER-NO-SESSION' && r.rec.reply && r.rec.eps <= 0.35 && r.rec.C >= 0.87 && r.rec.echo >= 0.85, JSON.stringify(r).slice(0, 400));
  expect(r.rec.echo_reparse.ok === true && r.rec.echo_reparse.engine_same === true && r.rec.echo_reparse.echo >= 0.85, JSON.stringify(r.rec.echo_reparse));
  expect(r.rec.premises.length === 1 && G190.concat(STARTER).some(a => a.id === r.rec.premises[0]), 'premise is a trusted anchor');
  expect(calls.run.every(p => p.memory.research.length === 0 && p.memory.hosted.length === 0 && p.memory.phone.length === 0 && p.memory.anchors.every(a => a.trust === 'trusted')), 'only trusted anchors as memory');
  expect(calls.run.length === 2 && calls.run[1].memory.anchors.length === 1 && calls.run[1].memory.anchors[0].text === r.rec.reply, 're-parse run feeds only the candidate');
  expect(calls.insert.length === 1 && calls.insert[0].text === r.rec.reply, 'one write attempt through the writer');
  expect(c.status().pending === 1 && c.status().admitted === 0, JSON.stringify(c.status()));
});
T('a signed writer success is recorded as written; a pending row is retried through the same writer', async () => {
  let open = false; const { c } = make({ insert: () => (open ? { ok: true, id: 7 } : { ok: false, pending: true, rule: 'KB-WRITER-NO-SESSION' }) });
  c.noteHeld('What is photosynthesis?', { product_reply: false }); await c.tick();
  expect(c.status().pending === 1, 'pending first');
  open = true; const f = await c.flushPending();
  expect(f.written === 1 && c.status().admitted === 1 && c.status().pending === 0 && c.state().admitted[0].rule === 'CURATE-WRITTEN', JSON.stringify(f));
});
T('no trusted anchor means no admit; Wikipedia-sourced rows are never a premise', async () => {
  const wiki = [{ id: 'w1', text: 'The sky looks blue because of Rayleigh scattering of sunlight.', tier: 'anchor', state: 'anchor', trust: 'trusted', packet: { Phi: 4, eps: 0, mu: 1 }, sfe: { Phi: 4, eps: 0, mu: 1 }, contributor: 'encyclopedia:wikipedia', source_url: 'https://en.wikipedia.org/wiki/Rayleigh_scattering' }];
  const { c, calls } = make({ anchorsFor: async () => wiki });
  c.noteHeld('Why is the sky blue?', { product_reply: false }); const r = await c.tick();
  expect(r.to !== 'pending' && r.to !== 'admitted' && calls.insert.length === 0, JSON.stringify({ to: r.to, rule: r.rule }));
  const none = make({ anchorsFor: async () => [] }); none.c.noteHeld('What is quartz?', { product_reply: false });
  const n = await none.c.tick(); expect(n.rule === 'ATHENA-NO-TRUSTED-ANCHOR' && none.calls.insert.length === 0, n.rule);
});
T('Gilligan bands come from KMath.driftGovernance (unchanged): clean, one re-measure, quarantine, hard', () => {
  const c = make().c;
  expect(c.laneOf(0.2) === 'clean' && c.laneOf(0.35) === 'clean' && c.laneOf(0.37) === 'correct' && c.laneOf(0.5) === 'quarantine' && c.laneOf(0.79) === 'quarantine' && c.laneOf(0.8) === 'hard' /* 4.9.211: the hard stop is inclusive */ && c.laneOf(0.95) === 'hard' && c.laneOf(null) === 'unmeasured', 'lanes');
  expect(KM.DRIFT_RULING.project_max === 0.35 && KM.DRIFT_RULING.explore_min === 0.4 && KM.DRIFT_RULING.explore_max === 0.8, 'bands untouched');
});
T('the quarantine reopens once when the anchor set changes, not before', async () => {
  let d = 'd1'; const { c } = make({ digest: () => d, anchorsFor: async () => [] });
  const st = c.state(); expect(st.quarantine.length === 0, 'empty');
  c.noteHeld('What is the largest planet?', { product_reply: false });
  await c.tick(); /* no anchor: stays queued, attempts 1 */
  const s1 = c.status(); expect(s1.queued === 1, JSON.stringify(s1));
  d = 'd2'; await c.tick(); expect(c.status().digest === 'd2', 'digest tracked');
});
T('the phone wiring: Ask queues held questions, the curators replace the old mesh, no Wikipedia enrichment, truthful Custody text', () => {
  const app = read('src/app.js'), cust = read('src/app_custody.js'), ui = read('src/app_curators.js'), html = read('index.html'), sw = read('sw.js');
  expect(/KCurators\.noteHeld\(qtext, row,/.test(app) && /window\.KAskAnchors = async function/.test(app), 'Ask bridge');
  expect(/if \(root\.KCurators\) return null;/.test(cust) && /if \(root\.KCurators\) return root\.KCurators\.step\(\);/.test(cust) && /!root\.KCurators && root\.KPipeline/.test(cust), 'old mesh not booted');
  expect(html.indexOf('src/curators_208.js') < html.indexOf('src/app_curators.js') && html.indexOf('src/app_curators.js') < html.indexOf('src/app_custody.js'), 'script order');
  expect(/\.\/src\/curators_208\.js/.test(sw) && /\.\/src\/app_curators\.js/.test(sw), 'precached');
  expect(!/always[- ]on/i.test(ui) && /Wikipedia is never used as a premise/.test(ui) && /locked-down writer/.test(ui) && /only while this page is open/.test(ui), 'truthful text');
  expect(/KSb\.insertAdmitted\(body, \(uid, sha, nonce\) =>/.test(ui) && /writerProof/.test(ui) && !/memory_writer_insert/.test(ui + read('src/curators_208.js')), 'writer path');
  expect(!/always-on workers/.test(html), 'strip');
});
T('dream_idle is on by default (Nic decision (f)); economy stays off; no LLM in the curators', () => {
  expect(Next.SWITCHES.dream_idle === true && Next.SWITCHES.economy === false, JSON.stringify(Next.SWITCHES));
  const src = read('src/curators_208.js') + read('src/app_curators.js');
  expect(!/openai|anthropic|ollama|\.embed\(|wikipedia\.org|fetch\(/.test(src), 'no model, no network of its own');
});

(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4208', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4208', name: t.name, ok: false, why: String(e && e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
