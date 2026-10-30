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

T('a granted key admits the contested row and Ask recalls it before research', () => {
  const k = loaded();
  expect(k.setSharedKbWriteKey(KEY).ok === true, 'grant');
  const admitted = k.admitConfirmedSharedItem('cs:held-bulb', true);
  expect(admitted.ok === true && admitted.wrote_pack === false && admitted.phone_db === false && admitted.receipt && admitted.receipt.shared_kb === false, JSON.stringify({ ok: admitted.ok, rule: admitted.rule, wrote: admitted.wrote_pack, phone: admitted.phone_db }));
  const view = admitted.view || k.sharedKnowledgeView();
  expect(view.admitted.length === 1 && /heating a filament/i.test(view.admitted[0].text || '') && view.held.length === 1 && view.held[0].id === 'cs:quar-dog', JSON.stringify(view));
  expect(view.admitted[0].sfe && view.admitted[0].sfe.Phi === 9 && view.admitted[0].sfe.mu === 1, JSON.stringify(view.admitted[0].sfe));
  expect(phoneFacts(k).length === 0 && (k.store.load('shared_knowledge') || []).length === 0 && k.memory().length === 0, 'stores');
  const again = k.admitConfirmedSharedItem('cs:held-bulb', true);
  expect(again.ok === false && again.rule === 'CONFIRMED-SHARED-MISSING', JSON.stringify(again));
  const ask = k.process('How do lightbulbs work?');
  expect(ask.trace.echo && ask.trace.echo.pass, 'echo ' + (ask.trace.echo && ask.trace.echo.reason));
  expect(rulesOf(ask).includes('CS-RECALL-MANNER'), rulesOf(ask).join(','));
  expect(!rulesOf(ask).includes('AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), 'no research');
  expect(/filament|heating/i.test(ask.reply || '') && /shared knowledge/i.test(ask.reply || ''), ask.reply);
  k.clearSharedKbWriteKey();
  expect(k.admitConfirmedSharedItem('cs:quar-dog', true).rule === 'SHARED-KB-WRITE-KEY-REQUIRED', 'cleared key');
});

T('a quarantine held row stays held and does not become shared knowledge', () => {
  const k = loaded();
  k.setSharedKbWriteKey(KEY);
  const refused = k.admitConfirmedSharedItem('cs:quar-dog', true);
  expect(refused.ok === false && refused.rule === 'DREAM-QUARANTINE-NO-TRUTH' && refused.wrote_pack === false && refused.phone_db === false, JSON.stringify(refused));
  const view = k.sharedKnowledgeView();
  expect(view.admitted.length === 0 && view.held.some(h => h.id === 'cs:quar-dog'), JSON.stringify(view));
  expect(phoneFacts(k).length === 0 && k.memory().length === 0, 'quiet');
  const ask = k.process('Is a dog an animal?');
  expect(!/shared knowledge/i.test(ask.reply || '') || (ask.trace.msm.meaning && ask.trace.msm.meaning.kind !== 'recall'), ask.reply);
  expect(!(k.sharedKnowledgeView().admitted || []).some(r => /dog is an animal/i.test(r.text || '')), 'quarantine not admitted');
});

T('version registry CONFLICTS NEXT_BUILD name 4.9.176', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.188', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.176/.test(conf) && /admitConfirmedSharedItem/.test(conf) && /Gilligan Codex/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.176/.test(nb) && /Forge GitHub/.test(nb) && /Gilligan Codex/.test(nb) && /Athena document/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.176/.test(readme) && /held/.test(readme) && /write key/.test(readme), 'README');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.188' && ((((tgt.suites[0] === 'r4188_suite.js' || tgt.suites[0] === 'r4187_suite.js' || tgt.suites[0] === 'r4186_suite.js' || tgt.suites[0] === 'r4185_suite.js' || tgt.suites[0] === 'r4184_suite.js' || tgt.suites[0] === 'r4183_suite.js' || tgt.suites[0] === 'r4182_suite.js' || tgt.suites[0] === 'r4181_suite.js' || tgt.suites[0] === 'r4180_suite.js') || tgt.suites[0] === 'r4179_suite.js') || tgt.suites[0] === 'r4178_suite.js') || tgt.suites[0] === 'r4177_suite.js' || tgt.suites[0] === 'r4176_suite.js') && tgt.suites.includes('r4175_suite.js'), JSON.stringify({ release: tgt.release, head: tgt.suites[0] }));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.188' && reg.features.some(f => f.id === 'R4176-HELD-ADMIT'), reg.version);
  expect(reg.count === reg.features.length && reg.count >= 334, 'count ' + reg.count);
  const src = fs.readFileSync(path.join(ROOT, 'src', 'kernel.js'), 'utf8');
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
