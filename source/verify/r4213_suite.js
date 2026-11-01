/* R4213 (4.9.213): Release C2 (Nic plan, 2026-10-31). The MEA panels and the starter / import / shared-knowledge views leave
 * kernel.js with the same API and no behaviour change. kmea_panels.js: MeaPanels(ctx) (manifest proposals, the MEA-P problem lane,
 * MEA-K manifests and meta). kpacks.js: Packs(ctx) (starter pack, confirmed-pack import, confirmed_shared / sharedKnowledgeView).
 * The kernel passes the services it owns and gets the same functions back. Parity: tools/c_parity.js equals the 4.9.211 record. No LLM. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const MEA_API = ['meaDetail', 'meaMetaK', 'adoptMetaK', 'withdrawMetaK', 'meaCandidatesK', 'meaArchiveK', 'meaRequeueK', 'adoptManifestK', 'withdrawManifestK', 'meaProblems', 'meaCycle', 'meaSupply', 'meaCommit', 'meaRequeue', 'meaCandidates', 'adoptManifest', 'withdrawManifest'];
const PACK_API = ['starterView', 'clearStarterKnowledge', 'previewImport', 'importConfirmedPack', 'admitImportItem', 'clearImportPack', 'importView', 'confirmedSharedView', 'sharedKnowledgeView', 'pullHostedSharedPack', 'writeSharedKnowledge', 'setSharedKbWriteKey', 'clearSharedKbWriteKey', 'admitConfirmedShared', 'admitConfirmedSharedItem', 'clearConfirmedShared', 'clearHostedSharedKnowledge'];
T('the MEA panels live in kmea_panels.js and the kernel no longer defines them', () => {
  const src = read('src/kernel.js'), mod = read('src/kmea_panels.js');
  for (const n of ['meaDetail', 'meaCycle', 'meaCommit', 'adoptManifest', 'adoptManifestK', 'adoptMetaK', 'withdrawManifest', 'withdrawManifestK']) {
    expect(new RegExp('function ' + n + '\\(').test(mod), 'module defines ' + n); expect(!new RegExp('function ' + n + '\\(').test(src), 'kernel still defines ' + n); }
  expect(typeof require(ROOT + '/src/kmea_panels.js').MeaPanels === 'function' && /\.MeaPanels\(\{/.test(src), 'kernel calls MeaPanels');
});
T('the starter, import and shared-knowledge views live in kpacks.js and the kernel no longer defines them', () => {
  const src = read('src/kernel.js'), mod = read('src/kpacks.js');
  for (const n of ['starterView', 'previewImport', 'importConfirmedPack', 'importView', 'sharedKnowledgeView', 'pullHostedSharedPack', 'writeSharedKnowledge', 'admitConfirmedShared']) {
    expect(new RegExp('function ' + n + '\\(').test(mod), 'module defines ' + n); expect(!new RegExp('function ' + n + '\\(').test(src), 'kernel still defines ' + n); }
  expect(typeof require(ROOT + '/src/kpacks.js').Packs === 'function' && /\.Packs\(\{/.test(src), 'kernel calls Packs');
});
T('forge and the kernel expose the same MEA, pack and shared-knowledge functions as before', () => {
  const K = require(ROOT + '/src/kernel.js'), F = require(ROOT + '/src/forge.js');
  const f = F.ForgeKernel({ store: K.MemoryStore(), clock: () => '2026-10-31T20:00:00Z' });
  for (const n of MEA_API.concat(PACK_API)) expect(typeof f[n] === 'function', 'forge.' + n);
  const d = f.meaDetail('canon:physics-144hz'); expect(d.ok === true && d.problem_id === 'canon:physics-144hz', JSON.stringify(d).slice(0, 200));
  expect(f.meaCommit('canon:physics-144hz', 'x', true).rule === 'MEAP-NO-CYCLE' && f.adoptManifest('none', true).ok === false, 'MEA refusals');
  expect(f.admitImportItem('x', false).rule === 'PERM-NEEDS-USER-TAP' && f.previewImport('not json').ok === false, 'pack refusals');
});
T('the phone loads kpacks.js and kmea_panels.js before kernel.js and the service worker precaches them', () => {
  const html = read('index.html'), sw = read('sw.js'); const i = n => html.indexOf('src="src/' + n + '"');
  expect(i('kpacks.js') > 0 && i('kmea_panels.js') > 0 && i('kpacks.js') < i('kernel.js') && i('kmea_panels.js') < i('kernel.js'), 'order');
  expect(sw.indexOf("'./src/kpacks.js'") > 0 && sw.indexOf("'./src/kmea_panels.js'") > 0, 'sw');
});
T('no behaviour change: the parity transcript equals the 4.9.211 record byte for byte', () => {
  const now = cp.execFileSync(process.execPath, [path.join(ROOT, 'tools', 'c_parity.js')], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const rec = read('data/c_parity_211.json');
  if (now !== rec) { const a = JSON.parse(now), b = JSON.parse(rec); throw new Error('differs: ' + Object.keys(b).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])).join(',')); }
});
T('the cold 60 for 4.9.213 is recorded (not tuned)', () => {
  const c = JSON.parse(read('data/cold_213_results.json'));
  expect(/^4\.9\.213$/.test(c.release) && c.tuned === false && c.of === 60 && c.false_admits === 0 && c.calls_llm === false && c.admitted + c.held === 60, JSON.stringify({ a: c.admitted, h: c.held }));
});
T('version registry names 4.9.213', () => {
  expect(/^4\.9\.21[3-9]$/.test(read('VERSION').trim()), 'VERSION');
  expect(JSON.stringify(JSON.parse(read('data/feature_registry.json'))).indexOf('R4213-') >= 0, 'registry');
});
(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4213', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4213', name: t.name, ok: false, why: String(e && e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
