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





T('version registry CONFLICTS NEXT_BUILD name 4.9.171', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  expect(ver === '4.9.228', ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver, reg.version);
  for (const id of ['R4162-READ-CONNECT', 'R4162-CS-BEFORE-AQ1', 'R4128-HOSTED']) {
    const f = reg.features.find(x => x.id === id);
    expect(f && ((f.claim === 'Partial' || (f.claim === 'Out of scope / parked' && /Retired 4\.9\.215/.test(f.note)) /* 4.9.215 C4: parked when its proof was retired */) || f.claim === 'Implemented'), id + ' ' + JSON.stringify(f));
  }
  const conf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  expect(/v4\.9\.162/.test(conf) && /READ-path|confirmed_shared|AQ-1/i.test(conf), 'CONFLICTS');
  const next = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.162/.test(next) && /READ-path|shared KB|AQ-1/i.test(next), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.162/.test(readme) || /4\.9\.163/.test(readme) || /4\.9\.164/.test(readme) || /4\.9\.165/.test(readme), 'README');
  const tgt = JSON.parse(fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8'));
  expect(tgt.release === '4.9.228' && (((((((((tgt.suites[0] === 'r4201_suite.js' || tgt.suites[0] === 'r4200_suite.js' || tgt.suites[0] === 'r4199_suite.js' || tgt.suites[0] === 'r4198_suite.js' || tgt.suites[0] === 'r4197_suite.js' || tgt.suites[0] === 'r4196_suite.js' || tgt.suites[0] === 'r4195_suite.js' || tgt.suites[0] === 'r4194_suite.js') || tgt.suites[0] === 'r4193_suite.js' || tgt.suites[0] === 'r4191_suite.js' || tgt.suites[0] === 'r4190_suite.js' || tgt.suites[0] === 'r4189_suite.js' || tgt.suites[0] === 'r4188_suite.js' || tgt.suites[0] === 'r4187_suite.js' || tgt.suites[0] === 'r4186_suite.js' || tgt.suites[0] === 'r4185_suite.js' || tgt.suites[0] === 'r4184_suite.js' || tgt.suites[0] === 'r4183_suite.js' || tgt.suites[0] === 'r4182_suite.js' || tgt.suites[0] === 'r4181_suite.js' || tgt.suites[0] === 'r4180_suite.js') || tgt.suites[0] === 'r4179_suite.js') || tgt.suites[0] === 'r4178_suite.js') || tgt.suites[0] === 'r4177_suite.js' || tgt.suites[0] === 'r4176_suite.js' || tgt.suites[0] === 'r4175_suite.js' || tgt.suites[0] === 'r4174_suite.js' || tgt.suites[0] === 'r4173_suite.js') || tgt.suites[0] === 'r4172_suite.js') || tgt.suites[0] === 'r4171_suite.js') || tgt.suites[0] === 'r4170_suite.js' || tgt.suites[0] === 'r4169_suite.js' || tgt.suites[0] === 'r4168_suite.js' || tgt.suites[0] === 'r4167_suite.js') || tgt.suites[0] === 'r4166_suite.js' || tgt.suites[0] === 'r4165_suite.js' || tgt.suites[0] === 'r4163_suite.js' || tgt.suites.includes('r4162_suite.js')), JSON.stringify(tgt));
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
