/* R4110 (4.9.110): registry catch-up for the compiler releases that already shipped.
 * 4.9.83 through 4.9.96 had CONFLICTS sections and live code, and no feature ids.
 * FB-11 was already registered. Ledger “NOT LIVE” and Register L-08 “parks mobile”
 * are stale for Mobile acceptance. CONFLICTS + VERSION + NEXT_BUILD govern Mobile.
 * Written FIRST (failing). No new answer. */
const fs = require('fs');
const ROOT = require('path').join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const M = require(ROOT + '/src/kmath.js');
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const mk = () => KMOD.Kernel({ lexicon: require(ROOT + '/data/lexicon.json'), lexiconExt: require(ROOT + '/data/lexicon-ext.json'), clock: () => '2026-10-26T07:10:00Z' });
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
const SHOWN = 'I derived 1 hypothesis from the problem: (1) “144 Hz is a substrate (fundamental) frequency”. I have not stored the problem. I can only seal it after your confirmation. I archived 4 candidates.';
const reg = () => JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
const src = rel => fs.readFileSync(ROOT + '/' + rel, 'utf8');
/* id, release, file that already contains the shipped marker, marker */
const SHIPPED = [
  ['R483-QC', '4.9.83', 'src/qcompile.js', 'FORGE-QUERY-COMPILED/v1'],
  ['R484-GEN', '4.9.84', 'src/qcompile.js', 'GEN-ACTIVE-FROM-AGENT'],
  ['R485-DRIFT', '4.9.85', 'src/qcompile.js', 'function relationDrift'],
  ['R486-RATE', '4.9.86', 'src/crawler.js', '4.9.86: requests to one host are paced'],
  ['R487-ROLE', '4.9.87', 'src/derive.js', 'function researchPlan'],
  ['R488-TOOL', '4.9.88', 'src/kernel.js', 'WH-DET COPULAR (4.9.88)'],
  ['R489-GRAM', '4.9.89', 'src/grammar.js', 'NP-PASSIVE-PARTICIPLE-POSTMOD'],
  ['R490-DIR', '4.9.90', 'src/kernel.js', 'LL-DIRECTIVE-MEANING'],
  ['R491-NAME', '4.9.91', 'src/kernel.js', 'OPEN-NOMINAL (4.9.91)'],
  ['R492-PROP', '4.9.92', 'src/grammar.js', 'TAG-PROPN-LEXICON'],
  ['R493-STRUCT', '4.9.93', 'src/kernel.js', 'BARE-REASON (4.9.92'],
  ['R494-RSOC', '4.9.94', 'src/kmath.js', 'RSOC_STANDING'],
  ['R495-LEFT', '4.9.95', 'src/provenance.js', '4.9.95: a pertainym'],
  ['R496-WHOSE', '4.9.96', 'src/grammar.js', 'G-REL-WHOSE']
];

T('the fourteen shipped compiler releases are registered, and nothing else in that gap', () => {
  const r = reg();
  const by = {}; for (const f of r.features) by[f.id] = f;
  const ids = SHIPPED.map(s => s[0]);
  expect(ids.every(id => by[id]), 'missing ' + ids.filter(id => !by[id]).join(','));
  const gap = r.features.filter(f => /^R48[3-9]-|^R49[0-6]-/.test(f.id)).map(f => f.id);
  expect(gap.length === ids.length && ids.every((id, i) => gap[i] === id), JSON.stringify(gap));
  for (const [id, ver, file, marker] of SHIPPED) {
    const f = by[id];
    expect(f.claim === 'Partial' && (f.proof || []).includes('R4110') && String(f.note).includes(ver), id + ' ' + f.claim + ' ' + JSON.stringify(f.proof));
    expect(src(file).includes(marker), id + ' live marker missing in ' + file);
    expect(!/Christ function/i.test(f.note), id);
  }
  expect(r.count === r.features.length, 'count ' + r.count + ' len ' + r.features.length);
  const tally = {}; for (const f of r.features) tally[f.claim] = (tally[f.claim] || 0) + 1;
  expect(r.claims.Implemented === 112 && tally.Implemented === 113, 'implemented tally moved ' + r.claims.Implemented + '/' + tally.Implemented);
  expect(r.claims.Partial === tally.Partial + 1, 'partial delta moved ' + r.claims.Partial + '/' + tally.Partial);
  const fb = by['FB-11'];
  expect(fb && fb.claim === 'Implemented' && (fb.proof || []).includes('R496') && (fb.proof || []).includes('FORGE2-PORT'), JSON.stringify(fb && fb.proof));
  expect(!by['R4111-FAKE'] && !r.features.some(f => /unshipped|not built yet/i.test(f.name)), 'an unshipped feature was registered');
});
T('CONFLICTS and L-08 name the operative Mobile authority', () => {
  const cf = src('CONFLICTS.md');
  const sec = cf.slice(cf.lastIndexOf('## v4.9.110'));
  expect(/CONFLICTS\.md/.test(sec) && /VERSION/.test(sec) && /NEXT_BUILD/.test(sec), 'operative trio missing');
  expect(/General Language Runtime NOT LIVE/.test(sec) && /stale for Forge Mobile/.test(sec), 'Ledger line not superseded');
  expect(/L-08/.test(sec) && /Parked post-1\.0/.test(sec) && /desktop Forge 1/.test(sec), 'L-08 park not superseded');
  expect(/R483-QC/.test(sec) && /R496-WHOSE/.test(sec) && /FB-11/.test(sec), 'registry lag not named');
  const l08 = reg().features.find(f => f.id === 'L-08');
  expect(l08 && l08.claim === 'Partial' && /stale for Forge Mobile/.test(l08.note) && /Parked post-1\.0/.test(l08.source), JSON.stringify(l08 && { claim: l08.claim, note: l08.note }));
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  expect(reg().version === ver, reg().version + ' vs ' + ver);
});
T('guards: physics, remember, the 0.35 write law, and an empty shared KB', () => {
  const k = mk();
  const p = k.process('propose problem physics');
  expect(p.reply === SHOWN && p.trace.intent_kind === 'PROPOSE_EVIDENCE', p.reply);
  const r = k.process('remember that my car is red');
  expect(r.trace.intent_kind === 'REQUEST_COMMIT' && r.reply === 'I noted that your car is red.', (r.trace.intent_kind || '') + ' ' + r.reply);
  expect(sharedN(k) === 0, 'shared KB written');
  expect(M.DRIFT_RULING.project_max === 0.35 && M.DRIFT_RULING.explore_min === 0.4 && M.DRIFT_RULING.explore_max === 0.8, 'drift law moved');
  expect(M.equivalenceClaim('ROC ≡ CFBC ≡ RSOC').status === 'SOURCE_NOT_VERIFIED', 'I.1 moved');
  expect(!/Christ function/i.test(src('src/kmath.js')), 'Christ function in kmath');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4110', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4110', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 0));
  process.exit(failed ? 1 : 0);
})();
