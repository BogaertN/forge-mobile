/* c_parity.js (4.9.212, Release C1–C3): behaviour parity for the kernel.js extraction.
 * With a fixed clock and an in-memory store it exercises every API that moved (4.9.215: forge.process and its transcript are
 * deleted with the old JS answer path, so only APIs that still exist are called): the store (generations, layered TX/case store), receipts and the audit chain,
 * the starter / import / shared-knowledge views, the MEA panels, and derive / reparse. The output is canonical JSON with
 * hashes, so the same behaviour gives the same bytes (the random device id and the ledger keyed by it are not compared). usage: node tools/c_parity.js [SRC_DIR] > out.json
 * The recorded 4.9.211 output (before any move; re-recorded in 4.9.215 from the 4.9.211 source with this trimmed tool) is data/c_parity_211.json; verify/r4212_suite.js compares against it. No LLM. */
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const SRC = path.resolve(process.argv[2] || path.join(ROOT, 'src'));
const KMOD = require(path.join(SRC, 'kernel.js')), FK = require(path.join(SRC, 'forge.js'));
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const CLOCK = () => '2026-10-31T20:00:00Z';
const canon = KMOD.canon; const h = o => crypto.createHash('sha256').update(canon(o === undefined ? null : o)).digest('hex');
const safe = f => { try { const v = f(); return v; } catch (e) { return { threw: String(e && e.message || e).slice(0, 200) }; } };
function run() {
  const out = {};
  const mem = {}; const backend = { get: k => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null), set: (k, v) => { mem[k] = String(v); }, del: k => { delete mem[k]; }, keys: () => Object.keys(mem) };
  const st = KMOD.MemoryStore(backend);
  const f = FK.ForgeKernel({ store: st, lexicon: LEX, lexiconExt: EXT, clock: CLOCK });
  /* 4.9.215 (C4): forge.process (the old JS answer path) is deleted, so the transcript is gone. The store, receipts and MEA/pack
   * checks below run on a seeded store instead; the receipt chain is built with forge_spine.stableIdentifier exactly as kaudit does. */
  const SP = require(path.join(SRC, 'forge_spine.js')); const rs = []; let prev = null;
  for (let i = 1; i <= 5; i++) { const body = { at: '2026-10-31T20:0' + i + ':00Z', echo: 'pass', eligibility: 'eligible', input_event: 'ie:' + i, msm_manifest: 'msm:' + i, output_sha256: null, previous_receipt: prev, request_contract: null, states: ['received', 'answered'], turn: i };
    const rec = Object.assign({ receipt_id: SP.stableIdentifier('aiweb.forge-mobile.receipt', body) }, body); rs.push(rec); prev = rec.receipt_id; }
  st.save('receipts', rs);
  st.save('memory', [{ id: 'm1', kind: 'note', status: 'active', text: 'buy milk', created: '2026-10-31T20:00:00Z' }]);
  out.receipts = h(f.receipts()); out.audit = f.verifyAudit();
  { const bad = st.load('receipts'); bad[2].turn = 99; st.save('receipts', bad); out.audit_tampered = f.verifyAudit(); st.save('receipts', rs); }
  // store
  out.generation = st.generation(); out.categories = h(st.categories); out.allStores = h(st.allStores);
  const sg = st.stageGeneration({ memory: st.load('memory') }); out.stage = { from: sg.from, to: sg.to, bad: sg.bad, n: sg.names.length };
  out.commit = safe(() => st.commitGeneration(sg)); out.hasRollback = st.hasRollback(); out.rollback = st.rollbackGeneration(); out.generationAfter = st.generation();
  out.keys = h(Object.keys(mem).sort());
  // packs and shared knowledge
  const SCHEMA = 'FORGE-CONFIRMED-PACK/v1'; const item = (text, standing, evidence) => ({ text, standing, evidence });
  const MIXED = JSON.stringify({ schema: SCHEMA, items: [item('a robin is a bird', 'confirmed', 'a field guide'), item('a whale is a fish', 'contested', 'an old textbook')] });
  out.starter = h(f.starterView()); out.preview = h(f.previewImport(MIXED)); out.preview_bad = h(f.previewImport('not json'));
  out.import_untapped = h(f.importConfirmedPack(MIXED, { userTap: false })); out.import = h(f.importConfirmedPack(MIXED, { userTap: true }));
  const held = (f.importView().held || [])[0]; out.importView = h(f.importView()); out.admitItem = h(held ? f.admitImportItem(held.id, true) : null);
  const pack = fs.readFileSync(ROOT + '/packs/confirmed_shared/a.json', 'utf8');
  out.cs_untapped = h(f.admitConfirmedShared(pack, { userTap: false, productCurator: false })); out.cs_pull = h(f.pullHostedSharedPack(pack));
  out.shared = h(f.sharedKnowledgeView()); out.confirmedShared = h(f.confirmedSharedView()); out.writeKey = h(f.setSharedKbWriteKey('short'));
  out.clearImport = h(f.clearImportPack()); out.clearShared = h(f.clearConfirmedShared()); out.clearStarter = h(f.clearStarterKnowledge());
  // MEA panels
  out.meaCandidates = h(safe(() => f.meaCandidates())); out.meaCandidatesK = h(safe(() => f.meaCandidatesK())); out.meaMetaK = h(safe(() => f.meaMetaK()));
  out.meaArchiveK = h(safe(() => f.meaArchiveK())); out.meaRequeueK = h(safe(() => f.meaRequeueK(5)));
  const probs = safe(() => f.meaProblems()); out.meaProblems = h(probs);
  const p0 = Array.isArray(probs) && probs[0] && (probs[0].problem_id || probs[0].id); out.meaDetail = h(p0 ? safe(() => f.meaDetail(p0)) : null); out.meaCycle = h(p0 ? safe(() => f.meaCycle(p0)) : null);
  out.meaSupply = h(p0 ? safe(() => f.meaSupply(p0, 'u0', 'x')) : null); out.meaHandoff = h(p0 ? safe(() => f.meaHandoffOf(p0)) : null); out.meaCommit = h(p0 ? safe(() => f.meaCommit(p0, 'none', false)) : null);
  out.meaRequeue = h(safe(() => f.meaRequeue(5))); out.adopt = h(safe(() => f.adoptManifest('none', false))); out.adoptK = h(safe(() => f.adoptManifestK('none', false)));
  // derive / reparse (Pāṇini parse) and the KKernel helpers
  const S = ['my car is red', 'Anna lives in Paris', 'the dog chased the cat', 'a robin is a bird', 'if it rains then the grass is wet', 'I bought a car yesterday'];
  out.derive = S.map(s => h(safe(() => f.derive(s)))); out.deriveSource = S.map(s => h(safe(() => f.deriveSource(s))));
  out.reparse = S.map(s => h(safe(() => f.reparseClause(s)))); out.reparseSource = S.map(s => h(safe(() => f.reparseSource && f.reparseSource(s))));
  out.parseClause = S.map(s => h(safe(() => KMOD.parseClause(s)))); out.parseRendered = S.map(s => h(safe(() => KMOD.parseRenderedClause(s))));
  out.render = S.map(s => safe(() => { const c = KMOD.parseClause(s); return c ? KMOD.renderClause(c) : null; }));
  out.store_final = Object.fromEntries(Object.keys(mem).sort().map(k => [k, /trace|receipts|meta|device|attribution_ledger/.test(k) ? null : h(mem[k])]));
  return out;
}
const o = run(); o.api = { kkernel: Object.keys(KMOD).sort() };
process.stdout.write(JSON.stringify(o, null, 1) + '\n');
