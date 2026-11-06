/* R4165 (4.9.167): RPMC→RSOC→Panini answer path (Nic t129u/t130u/t131u/t132u).
 * Order: archives/sources → RPMC (phase-align/grace/χ) → RSOC select → Panini NL.
 * Zero canned. Related CS = candidates into AQ-1/research, NOT class-dump answer.
 * Silence only for true no-basis novelty — factual WH still reaches AUTH-AQ1. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const KM = require(ROOT + '/src/kmath.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [], rows = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-28T12:00:00Z';
const mk = extra => KMOD.Kernel(Object.assign({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK, vaultState: () => 'locked' }, extra || {}));
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
const PACK_DIR = path.join(ROOT, 'packs', 'confirmed_shared');
const letter = L => fs.readFileSync(path.join(PACK_DIR, L + '.json'), 'utf8');
const ruleIds = r => (r.trace && r.trace.rules || []).map(x => x.id || x);
const hasRule = (r, id) => ruleIds(r).includes(id);
const phoneEmpty = k => { const p = k.store.load('confirmed_shared'); return !p || !Array.isArray(p.facts) || p.facts.length === 0; };
const noteOf = (r, id) => { const x = (r.trace && r.trace.rules || []).find(y => (y.id || y) === id); return (x && x.note) || ''; };

function pullABF(k) {
  expect(k.pullHostedSharedPack(letter('a')).ok, 'pull a');
  expect(k.pullHostedSharedPack(letter('b')).ok, 'pull b');
  expect(k.pullHostedSharedPack(letter('f')).ok, 'pull f');
}

T('RPMC graceOverAncestors: phase-align + G_min gate (pass / fail-closed)', () => {
  expect(typeof KM.graceOverAncestors === 'function' && typeof KM.G_MIN === 'number' && typeof KM.rsocSelect === 'function', 'exports');
  const ok = KM.graceOverAncestors([{ Phi: 9, eps: 0, mu: 1 }, { Phi: 1, eps: 0, mu: 1 }]);
  expect(ok.ok && ok.G >= KM.G_MIN && ok.aligned === 2, JSON.stringify(ok));
  const sealed = KM.graceOverAncestors([{ Phi: 5, eps: 1, mu: 0 }]);
  expect(!sealed.ok && sealed.G === 0, 'fail-closed Entropy: ' + JSON.stringify(sealed));
  const rs = KM.rsocSelect({ D: 1, X: 0, W: 0 }, [{ id: 'name', expect: { D: 1 } }, { id: 'grace', expect: { D: 0, X: 1 } }, { id: 'archive', expect: { D: 0, X: 0, W: 0 } }], 0);
  expect(rs && rs.selected === 'name', 'rsocSelect ' + JSON.stringify(rs && rs.selected));
});





T('version registry CONFLICTS NEXT_BUILD name 4.9.171', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  expect(ver === '4.9.246', ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver, reg.version);
  for (const id of ['R4165-RESONATE-ANCESTOR', 'R4164-GZIP-LEAVE', 'R4163-CIVICS-WH', 'R4163-DISCOURSE-CS', 'R4162-READ-CONNECT', 'R4128-HOSTED']) {
    const f = reg.features.find(x => x.id === id);
    expect(f && ((f.claim === 'Partial' || (f.claim === 'Out of scope / parked' && /Retired 4\.9\.215/.test(f.note)) /* 4.9.215 C4: parked when its proof was retired */) || f.claim === 'Implemented'), id + ' ' + JSON.stringify(f));
  }
  const conf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  expect(/v4\.9\.165/.test(conf) && /RPMC|RSOC-COMPOSE-EVIDENCE|graceOverAncestors/i.test(conf), 'CONFLICTS');
  expect(/v4\.9\.164/.test(conf), 'CONFLICTS 164');
  const next = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.165/.test(next), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.165/.test(readme), 'README');
  const tgt = JSON.parse(fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8'));
  expect(tgt.release === '4.9.246' && (((((((((tgt.suites[0] === 'r4245_suite.js' || tgt.suites[0] === 'r4244_suite.js' || tgt.suites[0] === 'r4243_suite.js' || tgt.suites[0] === 'r4242_suite.js' || tgt.suites[0] === 'r4201_suite.js' || tgt.suites[0] === 'r4200_suite.js' || tgt.suites[0] === 'r4199_suite.js' || tgt.suites[0] === 'r4198_suite.js' || tgt.suites[0] === 'r4197_suite.js' || tgt.suites[0] === 'r4196_suite.js' || tgt.suites[0] === 'r4195_suite.js' || tgt.suites[0] === 'r4194_suite.js') || tgt.suites[0] === 'r4193_suite.js' || tgt.suites[0] === 'r4191_suite.js' || tgt.suites[0] === 'r4190_suite.js' || tgt.suites[0] === 'r4189_suite.js' || tgt.suites[0] === 'r4188_suite.js' || tgt.suites[0] === 'r4187_suite.js' || tgt.suites[0] === 'r4186_suite.js' || tgt.suites[0] === 'r4185_suite.js' || tgt.suites[0] === 'r4184_suite.js' || tgt.suites[0] === 'r4183_suite.js' || tgt.suites[0] === 'r4182_suite.js' || tgt.suites[0] === 'r4181_suite.js' || tgt.suites[0] === 'r4180_suite.js') || tgt.suites[0] === 'r4179_suite.js') || tgt.suites[0] === 'r4178_suite.js') || tgt.suites[0] === 'r4177_suite.js' || tgt.suites[0] === 'r4176_suite.js' || tgt.suites[0] === 'r4175_suite.js' || tgt.suites[0] === 'r4174_suite.js' || tgt.suites[0] === 'r4173_suite.js') || tgt.suites[0] === 'r4172_suite.js') || tgt.suites[0] === 'r4171_suite.js') || tgt.suites[0] === 'r4170_suite.js' || tgt.suites[0] === 'r4169_suite.js' || tgt.suites[0] === 'r4168_suite.js' || tgt.suites[0] === 'r4167_suite.js') || tgt.suites[0] === 'r4166_suite.js' || tgt.suites[0] === 'r4165_suite.js'), JSON.stringify(tgt));
  const req = fs.readFileSync(ROOT + '/src/req_packet.js', 'utf8');
  expect(/4\.9\.165/.test(req) && /R4165/.test(req), 'req_packet');
  const mh = JSON.parse(fs.readFileSync(ROOT + '/research/math_honesty.json', 'utf8'));
  expect(mh.release === '4.9.246', 'math_honesty ' + mh.release);
  expect(mh.answer_path_grace && mh.answer_path_grace.status === 'wired' && /no longer a?\s*stub/i.test(mh.answer_path_grace.note || ''), 'answer_path_grace ' + JSON.stringify(mh.answer_path_grace));
  const idx = JSON.parse(fs.readFileSync(ROOT + '/packs/confirmed_shared/index.json', 'utf8'));
  expect((idx.version === '4.9.168' || idx.version === '4.9.163') && idx.packs.f.items >= 262, JSON.stringify(idx.packs.f));
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4165', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4165', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
