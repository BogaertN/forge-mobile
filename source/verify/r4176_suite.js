/* R4176 (4.9.176): the held-row admit that 4.9.128 left as a refusal.
 * A tap with the write key already held moves a contested row into the session bank.
 * Quarantine stays held. Phone DB and letter packs stay empty. No LLM. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-29T03:20:00Z';
const KEY = 'nic-write-key-ok';
const METHOD = 'A bulb produces light by heating a filament';
const QUAR = 'A dog is an animal';
const mkStore = () => { const st = {}; return KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }); };
const mk = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK, vaultState: () => 'locked', store: mkStore() });
const phoneFacts = k => { const phone = k.store.load('confirmed_shared'); return (phone && phone.facts) || []; };
const rulesOf = r => (r.trace && r.trace.rules || []).map(x => x.id);
const PACK = JSON.stringify({
  schema: 'FORGE-CONFIRMED-PACK/v1',
  provenance: 'confirmed_shared',
  shared_kb: false,
  items: [
    { id: 'cs:held-bulb', text: METHOD, standing: 'contested', evidence: 'curated extract', sfe: { Phi: 9, eps: 0.08, mu: 1 } },
    { id: 'cs:quar-dog', text: QUAR, standing: 'quarantine', evidence: 'quarantine extract', sfe: { Phi: 5, eps: 0.6, mu: 0 } }
  ]
});

function loaded() {
  const k = mk();
  k.clearStarterKnowledge();
  const pulled = k.pullHostedSharedPack(PACK);
  expect(pulled.ok === true, JSON.stringify(pulled));
  const view = k.sharedKnowledgeView();
  expect((view.admitted || []).length === 0 && (view.held || []).length === 2, JSON.stringify(view));
  expect(phoneFacts(k).length === 0 && (k.store.load('shared_knowledge') || []).length === 0, 'phone and scrapbook');
  return k;
}

T('a tap without a held write key leaves the contested row held', () => {
  const k = loaded();
  const bare = k.admitConfirmedSharedItem('cs:held-bulb', true);
  expect(bare.ok === false && bare.rule === 'SHARED-KB-WRITE-KEY-REQUIRED' && bare.wrote_pack === false && bare.phone_db === false, JSON.stringify(bare));
  expect(k.sharedKnowledgeView().admitted.length === 0 && k.sharedKnowledgeView().held.length === 2, 'still held');
  const untapped = k.admitConfirmedSharedItem('cs:held-bulb', false);
  expect(untapped.ok === false && untapped.rule === 'PERM-NEEDS-USER-TAP', JSON.stringify(untapped));
  expect(k.setSharedKbWriteKey('short').ok === false, 'weak key');
  expect(k.admitConfirmedSharedItem('cs:held-bulb', true).rule === 'SHARED-KB-WRITE-KEY-REQUIRED', 'weak key does not hold');
  expect(k.admitConfirmedSharedItem('cs:missing', true).rule === 'SHARED-KB-WRITE-KEY-REQUIRED', 'missing id still needs the key');
});



T('version registry CONFLICTS NEXT_BUILD name 4.9.176', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.244', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.176/.test(conf) && /admitConfirmedSharedItem/.test(conf) && /Gilligan Codex/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.176/.test(nb) && /Forge GitHub/.test(nb) && /Gilligan Codex/.test(nb) && /Athena document/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.176/.test(readme) && /held/.test(readme) && /write key/.test(readme), 'README');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.244' && (((((tgt.suites[0] === 'r4244_suite.js' || tgt.suites[0] === 'r4243_suite.js' || tgt.suites[0] === 'r4242_suite.js' || tgt.suites[0] === 'r4201_suite.js' || tgt.suites[0] === 'r4200_suite.js' || tgt.suites[0] === 'r4199_suite.js' || tgt.suites[0] === 'r4198_suite.js' || tgt.suites[0] === 'r4197_suite.js' || tgt.suites[0] === 'r4196_suite.js' || tgt.suites[0] === 'r4195_suite.js' || tgt.suites[0] === 'r4194_suite.js') || tgt.suites[0] === 'r4193_suite.js' || tgt.suites[0] === 'r4191_suite.js' || tgt.suites[0] === 'r4190_suite.js' || tgt.suites[0] === 'r4189_suite.js' || tgt.suites[0] === 'r4188_suite.js' || tgt.suites[0] === 'r4187_suite.js' || tgt.suites[0] === 'r4186_suite.js' || tgt.suites[0] === 'r4185_suite.js' || tgt.suites[0] === 'r4184_suite.js' || tgt.suites[0] === 'r4183_suite.js' || tgt.suites[0] === 'r4182_suite.js' || tgt.suites[0] === 'r4181_suite.js' || tgt.suites[0] === 'r4180_suite.js') || tgt.suites[0] === 'r4179_suite.js') || tgt.suites[0] === 'r4178_suite.js') || tgt.suites[0] === 'r4177_suite.js' || tgt.suites[0] === 'r4176_suite.js') && tgt.suites.includes('r4175_suite.js'), JSON.stringify({ release: tgt.release, head: tgt.suites[0] }));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.244' && reg.features.some(f => f.id === 'R4176-HELD-ADMIT'), reg.version);
  expect(reg.count === reg.features.length && reg.count >= 334, 'count ' + reg.count);
  const src = fs.readFileSync(path.join(ROOT, 'src', 'kernel.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'src', 'kpacks.js'), 'utf8'); /* 4.9.213 C2: the shared-knowledge views moved to kpacks.js */
  expect(/function admitConfirmedSharedItem/.test(src) && /DREAM-QUARANTINE-NO-TRUTH/.test(src) && /CONFIRMED-SHARED-MISSING/.test(src), 'kernel');
});

(async () => {
  let failed = 0;
  const rows = [];
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4176', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4176', name: t.name, ok: false, why: String(e.message || e).slice(0, 800) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
