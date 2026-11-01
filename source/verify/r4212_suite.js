/* R4212 (4.9.212): Release C1 (Nic plan, 2026-10-31). The phone store and the receipt/audit log leave the old kernel files with
 * the same API and no behaviour change. kstore.js: MemoryStore (generations, quota), the store categories, canon(), and Layered()
 * (the route-sandbox TX overlay and the case-file namespace). kaudit.js: the turn receipt chain and verifyAudit (was forge.js).
 * The vault (privacy.js Vault) and permissions (governance.js PermissionService) were already their own modules; they stay.
 * Parity: tools/c_parity.js runs a fixed transcript and every moved API; its output must equal the 4.9.211 record. No LLM. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
T('the store lives in kstore.js and KKernel re-exports the same MemoryStore and canon', () => {
  const KS = require(ROOT + '/src/kstore.js'), K = require(ROOT + '/src/kernel.js');
  expect(K.MemoryStore === KS.MemoryStore && K.canon === KS.canon && typeof KS.Layered === 'function', 'same functions');
  expect(JSON.stringify(Object.keys(K).sort()) === JSON.stringify(['Kernel', 'MemoryStore', 'canon', 'mathSurface', 'parseClause', 'parseRenderedClause', 'renderClause']), 'KKernel API ' + Object.keys(K));
  const src = read('src/kernel.js');
  expect(!/function MemoryStore\(/.test(src) && !/function canon\(/.test(src) && !/\bTX\s*=/.test(src), 'kernel.js no longer defines the store');
  expect(/function MemoryStore\(/.test(read('src/kstore.js')) && /STORE-QUOTA-SOFT/.test(read('src/kstore.js')), 'kstore.js defines it');
});
T('the layered store keeps sandbox writes in the overlay until commit, and namespaces case files', () => {
  const KS = require(ROOT + '/src/kstore.js'); const base = KS.MemoryStore(); let ns = null;
  const L = KS.Layered(base, c => (ns && c === 'memory' ? ns + ':' + c : c));
  L.store.save('memory', [1]); expect(JSON.stringify(base.load('memory')) === '[1]', 'direct write');
  const tx = L.txOpen(); L.store.save('memory', [1, 2]); expect(JSON.stringify(L.store.load('memory')) === '[1,2]' && JSON.stringify(base.load('memory')) === '[1]', 'overlay');
  L.txClose(tx); expect(JSON.stringify(L.store.load('memory')) === '[1]', 'overlay closed'); L.txCommit(tx.map); expect(JSON.stringify(base.load('memory')) === '[1,2]', 'committed');
  ns = 'case:x'; L.store.save('memory', [9]); expect(JSON.stringify(base.load('case:x:memory')) === '[9]' && JSON.stringify(base.load('memory')) === '[1,2]', 'case namespace');
});
T('receipts and the audit chain live in kaudit.js; forge.receipts and forge.verifyAudit keep their API', () => {
  const KA = require(ROOT + '/src/kaudit.js'), K = require(ROOT + '/src/kernel.js'), F = require(ROOT + '/src/forge.js');
  expect(typeof KA.ReceiptLog === 'function' && !/function verifyAudit\(\) \{/.test(read('src/forge.js')), 'moved');
  const st = K.MemoryStore(); const f = F.ForgeKernel({ store: st, clock: () => '2026-10-31T20:00:00Z' }); f.process('hello'); f.process('remember that my car is red');
  const a = f.verifyAudit(); expect(a.ok === true && a.count === 2 && f.receipts().length === 2, JSON.stringify(a));
  const rs = st.load('receipts'); rs[0].turn = 99; st.save('receipts', rs); const b = f.verifyAudit(); expect(b.ok === false && b.broken_at.indexOf(0) >= 0, 'tamper ' + JSON.stringify(b));
});
T('the vault and permissions stay in their own modules (privacy.js, governance.js); the kernel only calls them', () => {
  expect(/function Vault\(/.test(read('src/privacy.js')) && /PermissionService/.test(read('src/governance.js')), 'modules');
  expect(/Gv\.PermissionService\(store/.test(read('src/kernel.js')) && /P\.Vault\(/.test(read('src/forge.js')), 'calls');
});
T('the phone loads kstore.js and kaudit.js before kernel.js and the service worker precaches them', () => {
  const html = read('index.html'), sw = read('sw.js');
  const i = n => html.indexOf('src="src/' + n + '"');
  expect(i('kstore.js') > 0 && i('kaudit.js') > 0 && i('kstore.js') < i('kernel.js') && i('kaudit.js') < i('forge.js') && i('forge_spine.js') < i('kaudit.js') && i('sha256.js') < i('kaudit.js'), 'order');
  expect(sw.indexOf("'./src/kstore.js'") > 0 && sw.indexOf("'./src/kaudit.js'") > 0, 'sw');
});
T('no behaviour change: the parity transcript equals the 4.9.211 record byte for byte', () => {
  const now = cp.execFileSync(process.execPath, [path.join(ROOT, 'tools', 'c_parity.js')], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const rec = read('data/c_parity_211.json');
  if (now !== rec) { const a = JSON.parse(now), b = JSON.parse(rec); const d = Object.keys(b).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])); throw new Error('differs: ' + d.join(',')); }
});
T('the cold 60 for 4.9.212 is recorded (not tuned)', () => {
  const c = JSON.parse(read('data/cold_212_results.json'));
  expect(/^4\.9\.212$/.test(c.release) && c.tuned === false && c.of === 60 && c.false_admits === 0 && c.calls_llm === false && c.admitted + c.held === 60, JSON.stringify({ a: c.admitted, h: c.held }));
});
T('version registry names 4.9.212', () => {
  expect(/^4\.9\.21[2-9]$/.test(read('VERSION').trim()), 'VERSION');
  expect(JSON.stringify(JSON.parse(read('data/feature_registry.json'))).indexOf('R4212-') >= 0, 'registry');
});
(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4212', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4212', name: t.name, ok: false, why: String(e && e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
