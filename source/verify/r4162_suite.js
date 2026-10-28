/* R4162 (4.9.162): READ-path connect — hosted confirmed_shared answers ordinary WH/YN
 * before AQ-1/research.web. Order: memory → hosted shared KB → GKS → AQ-1.
 * Not a First Amendment one-off: subject-about + surface match for any pulled fact.
 * Phone confirmed_shared stays empty; scrapbook stays empty; write still needs Nic's key. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [], rows = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-28T12:00:00Z';
const mk = extra => KMOD.Kernel(Object.assign({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK }, extra || {}));
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
const PACK_DIR = path.join(ROOT, 'packs', 'confirmed_shared');
const letter = L => fs.readFileSync(path.join(PACK_DIR, L + '.json'), 'utf8');
const ruleIds = r => (r.trace && r.trace.rules || []).map(x => x.id || x);
const hasRule = (r, id) => ruleIds(r).includes(id);
const phoneEmpty = k => { const p = k.store.load('confirmed_shared'); return !p || !Array.isArray(p.facts) || p.facts.length === 0; };

function pullAF(k) {
  expect(k.pullHostedSharedPack(letter('a')).ok, 'pull a');
  expect(k.pullHostedSharedPack(letter('f')).ok, 'pull f');
}

T('First Amendment answers from hosted shared KB without research.web', () => {
  const k = mk();
  k.clearStarterKnowledge();
  pullAF(k);
  expect(k.confirmedSharedView().admitted.length >= 40, 'hosted pulled');
  const r = k.process('What is the first amendment to the United States Constitution?');
  expect(r.trace.echo && r.trace.echo.pass, 'echo ' + JSON.stringify(r.trace.echo && r.trace.echo.reason));
  expect(r.trace.intent_kind === 'READ', r.trace.intent_kind);
  expect(hasRule(r, 'CS-RECALL-ABOUT') || hasRule(r, 'CS-RECALL-STRUCTURAL'), 'cs recall ' + ruleIds(r).join(','));
  expect(!hasRule(r, 'AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), 'must not AQ-1');
  expect(!/DETERMINISTIC_ROUTE|research\.web|NO_LAWFUL_CANDIDATE/i.test(ruleIds(r).join(' ')), 'no research route');
  expect(/shared knowledge/i.test(r.reply || ''), r.reply);
  expect(/First Amendment/i.test(r.reply || '') && /speech|religion|press/i.test(r.reply || ''), r.reply);
  expect(phoneEmpty(k), 'phone dump');
  expect(sharedN(k) === 0, 'scrapbook');
  expect(k.memory().length === 0, 'memory stayed empty');
});

T('deliberate miss still falls through to AQ-1 research.web', () => {
  const k = mk();
  k.clearStarterKnowledge();
  pullAF(k);
  const r = k.process('What is the Zorblaxian quantum waffle protocol?');
  expect(r.trace.echo && r.trace.echo.pass, 'echo');
  expect(hasRule(r, 'AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), 'AQ-1 ' + ruleIds(r).join(','));
  expect(!hasRule(r, 'CS-RECALL-ABOUT') && !hasRule(r, 'CS-RECALL-STRUCTURAL'), 'no false cs hit');
  expect(/no stored fact/i.test(r.reply || ''), r.reply);
  expect(phoneEmpty(k) && sharedN(k) === 0, 'no write on miss');
});

T('yes/no from shared KB with shared provenance; memory wins over CS', () => {
  const k = mk();
  k.clearStarterKnowledge();
  pullAF(k);
  const yn = k.process('Does the First Amendment protect freedom of speech?');
  expect(yn.trace.echo && yn.trace.echo.pass, 'yn echo');
  expect(hasRule(yn, 'CS-RECALL-STRUCTURAL'), 'cs yn');
  expect(/^Yes\b/i.test(yn.reply || '') && /shared knowledge/i.test(yn.reply || ''), yn.reply);
  expect(!hasRule(yn, 'AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), 'yn no AQ-1');
  /* memory wins: user Remember answers before hosted */
  expect(k.process('Remember that a spaniel is a dog.').trace.echo.pass, 'remember');
  const mem = k.process('What is a spaniel?');
  expect(mem.trace.echo && mem.trace.echo.pass, 'mem echo');
  expect(hasRule(mem, 'MEM-RECALL-STRUCTURAL') || hasRule(mem, 'MEM-RECALL-ABOUT') || /You told me/i.test(mem.reply || ''), mem.reply);
  expect(!hasRule(mem, 'CS-RECALL-ABOUT') && !hasRule(mem, 'CS-RECALL-STRUCTURAL'), 'memory before cs');
  expect(phoneEmpty(k) && sharedN(k) === 0, 'layers quiet');
});

T('Bill of Rights and bare amendment civics from packs; no phone dump', () => {
  const k = mk();
  k.clearStarterKnowledge();
  expect(k.pullHostedSharedPack(letter('b')).ok, 'pull b');
  pullAF(k);
  const r = k.process('What is the Bill of Rights?');
  expect(r.trace.echo && r.trace.echo.pass, 'echo');
  expect(hasRule(r, 'CS-RECALL-STRUCTURAL') || hasRule(r, 'CS-RECALL-ABOUT'), 'cs');
  expect(/shared knowledge/i.test(r.reply || '') && /Bill of Rights|amendment/i.test(r.reply || ''), r.reply);
  expect(!hasRule(r, 'AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), 'no AQ-1');
  expect(phoneEmpty(k) && sharedN(k) === 0, 'no dump');
});

T('version registry CONFLICTS NEXT_BUILD name 4.9.166', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  expect(ver === '4.9.166', ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver, reg.version);
  for (const id of ['R4162-READ-CONNECT', 'R4162-CS-BEFORE-AQ1', 'R4128-HOSTED']) {
    const f = reg.features.find(x => x.id === id);
    expect(f && (f.claim === 'Partial' || f.claim === 'Implemented'), id + ' ' + JSON.stringify(f));
  }
  const conf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  expect(/v4\.9\.162/.test(conf) && /READ-path|confirmed_shared|AQ-1/i.test(conf), 'CONFLICTS');
  const next = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.162/.test(next) && /READ-path|shared KB|AQ-1/i.test(next), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.162/.test(readme) || /4\.9\.163/.test(readme) || /4\.9\.164/.test(readme) || /4\.9\.165/.test(readme), 'README');
  const tgt = JSON.parse(fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8'));
  expect(tgt.release === '4.9.166' && (tgt.suites[0] === 'r4166_suite.js' || tgt.suites[0] === 'r4165_suite.js' || tgt.suites[0] === 'r4163_suite.js' || tgt.suites.includes('r4162_suite.js')), JSON.stringify(tgt));
  const req = fs.readFileSync(ROOT + '/src/req_packet.js', 'utf8');
  expect((/4\.9\.165/.test(req) || /4\.9\.164/.test(req) || /4\.9\.163/.test(req) || /4\.9\.162/.test(req)) && /R4162/.test(req), 'req_packet');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4162', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4162', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
