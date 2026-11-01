/* R4215 (4.9.215): Release C4 (Nic approved 2026-11-01, option B). The old JS answer path is deleted: ForgeKernel.process /
 * Kernel.process and everything reachable only from it (179 kernel owners, computed by reachability from the API), the forge.js
 * process wrapper, forge_tools.recallHosted and pipeline_tools.recallFromBank. recall_memory refuses FORGE-TOOL-RETIRED. The Dry-Run
 * tab runs the Python engine through the same rmc_client/Pyodide path as Ask with dry_run: true and writes nothing. Audit panels that
 * only the old path filled show an honest empty state. Retired tests and requirement links are listed in data/c4_retired_tests.json
 * and src/req_packet.js (RETIRED_LINKS). No LLM. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const CLOCK = () => '2026-11-01T10:00:00Z';
let CHK = null;
const chk = () => (CHK = CHK || JSON.parse(cp.execFileSync(process.env.PYTHON || 'python3', ['tools/check_215.py'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }).trim().split('\n').pop()));

T('the old JS answer path is deleted: no process on the kernel or forge API, and no source calls it', () => {
  const K = require(ROOT + '/src/kernel.js'), F = require(ROOT + '/src/forge.js');
  const k = K.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK }); const f = F.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: CLOCK });
  expect(typeof k.process === 'undefined' && typeof f.process === 'undefined', 'process still on the API');
  expect(!/function process\(/.test(read('src/kernel.js')) && !/function process\(/.test(read('src/forge.js')), 'process still defined');
  const live = fs.readdirSync(path.join(ROOT, 'src')).filter(n => /\.js$/.test(n));
  const callers = live.filter(n => /\b(forge|dk|kernel|k|f|K)\.process\(/.test(read('src/' + n)));
  expect(callers.length === 0, 'callers ' + callers.join(','));
  expect(read('src/kernel.js').length < 200000, 'kernel.js size ' + read('src/kernel.js').length);
});
T('the kept kernel and forge APIs still work (derive, reparse, the store, shared knowledge, the audit chain)', () => {
  const K = require(ROOT + '/src/kernel.js'), F = require(ROOT + '/src/forge.js');
  const f = F.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: CLOCK });
  for (const n of ['derive', 'reparseClause', 'sharedKnowledgeView', 'starterView', 'importView', 'meaProblems', 'receipts', 'verifyAudit', 'exportBundle', 'store']) expect(typeof f[n] !== 'undefined', n);
  expect(f.verifyAudit().ok === true && f.receipts().length === 0, 'empty chain verifies');
  expect(f.derive('the dog chased the cat').parses.length >= 1 && typeof f.sharedKnowledgeView().count !== 'undefined', 'derive / shared');
});
T('recall_memory and rmc_memory_recall refuse FORGE-TOOL-RETIRED; recallHosted is gone; device-path and vector recall stay refused', async () => {
  const FT = require(ROOT + '/src/forge_tools.js');
  expect(typeof FT.recallHosted === 'undefined' && !/function recallHosted\(/.test(read('src/forge_tools.js')), 'recallHosted still present');
  const src = read('src/forge_tools.js');
  const ROWS = [{ id: 'cs:bulb', text: 'A light bulb produces light when current heats the filament.', standing: 'confirmed' }];
  const tools = FT.sessionTools(ROWS);
  for (const n of ['recall_memory', 'rmc_memory_recall']) { const r = tools.dispatch(n, { query: 'bulb' }); expect(r.ok === false && r.rule === 'FORGE-TOOL-RETIRED' && r.network === false && r.writes === false, n + ' ' + JSON.stringify(r)); }
  expect(/'FORGE-TOOL-RETIRED'/.test(src), 'rule named in source');
  const disk = FT.recallMemory('bulb', { retrieval_backend: 'filesystem' }, { root: '/home/nic/forge', nodes: FT.nodesFromHosted(ROWS) });
  expect(disk.ok === false && disk.rule === 'FORGE-DEVICE-PATH-REFUSED' && disk.memory_state.active_memory_count === 0, JSON.stringify(disk));
  const vector = FT.recallMemory('bulb', { retrieval_backend: 'filesystem', chroma_collection: 'forge_kb' }, { nodes: FT.nodesFromHosted(ROWS) });
  expect(vector.status === 'BLOCKED' && vector.reason_code === 'FROZEN_LEGACY_VECTOR_CONTROL_PROHIBITED' && vector.calls_llm === false, JSON.stringify(vector));
});
T('the pipeline has no hosted-bank shortcut: recallFromBank is gone and a bank option does not skip the fetch', async () => {
  const PT = require(ROOT + '/src/pipeline_tools.js');
  expect(!/function recallFromBank|recallFromBank\(/.test(read('src/pipeline_tools.js')), 'recallFromBank still present');
  let fetched = 0;
  const r = await PT.researchExcerpt('How does a bulb produce light?', { bank: [{ id: 'cs:bulb', text: 'A light bulb produces light when current heats the filament.', standing: 'confirmed' }], fetch: () => { fetched += 1; throw new Error('offline'); } });
  expect(fetched === 1 && r.tool !== 'recall_memory', JSON.stringify({ fetched, tool: r.tool }));
});
T('the Dry-Run tab calls the Python engine with dry_run: true and writes nothing', () => {
  const app = read('src/app.js'); const a = app.indexOf('async function dryRun('), b = app.indexOf("$('#drReset')", a); const body = app.slice(a, b);
  expect(a > 0 && b > a, 'dryRun found');
  expect(/KRMCCore\.run\(\{ question: text, live: true, dry_run: true, memory: memory \}\)/.test(body) && /await askMemory\(text\)/.test(body), 'engine call');
  expect(!/ForgeKernel|\.process\(|rememberAnswer|\.save\(|noteHeld|commit|writeShared|admitConfirmedShared|KContribCache\.put/.test(body), 'a write or the old path in dryRun');
  expect(/Stages 14–16/.test(body) && /Candidate \(not spoken\)/.test(body) && /data-dryrun=/.test(body), 'honest labels');
  expect(/Runs the Python engine \(rmc_core, the same engine as Ask\) in dry-run/.test(read('index.html')), 'tab text');
});
T('the engine dry run: sky blue is admitted, 17 times 23 is held, stages 14–16 are skipped, nothing is spoken or written', () => {
  const [sky, mul] = chk();
  for (const r of [sky, mul]) {
    expect(r.n_stages === 16 && r.skipped.map(String).slice(-3).join(',') === '14,15,16', 'stages ' + JSON.stringify(r.skipped));
    expect(r.reply === null && r.product_reply === false && !r.memory_write && r.payload_unchanged === true, 'spoken or written ' + JSON.stringify(r));
    expect(r.eps === r.live_eps && r.C === r.live_C && r.disposition === r.live_disposition, 'dry run differs from live ' + JSON.stringify(r));
  }
  expect(sky.disposition === 'admit' && sky.drift_region === 'clean', JSON.stringify(sky));
  expect(mul.disposition === 'held', JSON.stringify(mul));
});
T('Audit shows an honest empty state for turn packets and receipts the deleted path used to write', () => {
  const app = read('src/app.js');
  expect(/data-audit-empty="turn_packets"/.test(app) && /data-audit-empty="receipts"/.test(app) && /removed in 4\.9\.215/.test(app), 'empty states');
  expect(!/no receipts yet/.test(app), 'old empty text');
});
T('retired tests and requirement links are recorded with a reason; no retired test is still linked', () => {
  const R = JSON.parse(read('data/c4_retired_tests.json')); const RP = require(ROOT + '/src/req_packet.js');
  expect(R.release === '4.9.215' && R.count === R.tests.length && R.tests.every(t => t.why && t.suite && t.name), 'record');
  for (const s of R.retired_suites) expect(!fs.existsSync(path.join(ROOT, 'verify', s)) && JSON.parse(read('verify/targeted.json')).suites.indexOf(s) < 0, 'suite still present ' + s);
  const linked = new Set(); for (const p of RP.PACKETS) for (const q of p.requirements) for (const t of q.tests) linked.add(t.suite + '|' + t.name);
  expect(R.tests.every(t => !linked.has(t.suite + '|' + t.name)), 'a retired test is still linked');
  expect(RP.RETIRED_LINKS.length > 0 && RP.RETIRED_LINKS.every(l => l.why) && RP.linksMissing(ROOT).length === 0, 'links');
  expect(/4\.9\.215/.test(read('CONFLICTS.md').slice(0, 4000)) && /c4_retired_tests\.json/.test(read('CONFLICTS.md').slice(0, 8000)), 'CONFLICTS');
});
T('features whose proof was retired are parked with the reason, not claimed', () => {
  const reg = JSON.parse(read('data/feature_registry.json')); const by = {}; for (const f of reg.features) by[f.id] = f;
  for (const id of ['R499-LANG', 'R4100-QTY', 'R4101-CF', 'R4102-MEA', 'R4103-INT', 'R4105-WV', 'R4106-DSPC', 'R490-DIR', 'R4122-ISOLATE', 'R4116-LEXICON'])
    expect(by[id] && by[id].claim === 'Out of scope / parked' && /Retired 4\.9\.215/.test(by[id].note), id);
  const tally = {}; for (const f of reg.features) tally[f.claim] = (tally[f.claim] || 0) + 1;
  expect(reg.count === reg.features.length && tally['Out of scope / parked'] === reg.claims['Out of scope / parked'], 'parked tally');
});
T('c_parity is trimmed to APIs that still exist and equals the 4.9.211 record byte for byte', () => {
  expect(!/f\.process\(/.test(read('tools/c_parity.js')), 'c_parity still calls process');
  const now = cp.execFileSync(process.execPath, [path.join(ROOT, 'tools', 'c_parity.js')], { encoding: 'utf8', maxBuffer: 1 << 26 });
  expect(now === read('data/c_parity_211.json'), 'parity differs');
  const o = JSON.parse(now); expect(o.audit.ok === true && o.audit.count === 5 && o.audit_tampered.ok === false, 'audit chain');
});
T('the cold 60 for 4.9.215 is recorded (not tuned)', () => {
  const c = JSON.parse(read('data/cold_215_results.json'));
  expect(/^4\.9\.215$/.test(c.release) && c.tuned === false && c.of === 60 && c.false_admits === 0 && c.calls_llm === false && c.admitted + c.held === 60, JSON.stringify({ a: c.admitted, h: c.held }));
});
T('version registry names 4.9.215', () => {
  expect(/^4\.9\.21[5-9]$/.test(read('VERSION').trim()), 'VERSION');
  expect(JSON.stringify(JSON.parse(read('data/feature_registry.json'))).indexOf('R4215-') >= 0, 'registry');
});
(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4215', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4215', name: t.name, ok: false, why: String(e && e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
