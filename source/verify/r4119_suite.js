/* R4119 (4.9.119): dream/SPC cleanup. Written FIRST.
 * Resurrect returns to processing as a proposal. A separate tap is the only store.
 * must_archive is a containment route input and is named on inspect.
 * Dream, SPC, and quarantine do not silently write past Echo.
 * Creative writing is not this release. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const CT = require(ROOT + '/src/containment.js');
const KM = require(ROOT + '/src/kmath.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [], rows = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-27T16:19:00Z';
const mk = (o) => KMOD.Kernel(Object.assign({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK }, o || {}));
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
const head = k => k.worldHead();
const sameHead = (k, h) => head(k).version_id === h.version_id && head(k).content_hash === h.content_hash;
const quiet = (k, h, why) => { expect(!k.memory().length && sharedN(k) === 0 && sameHead(k, h), why || 'a silent write'); };
const forgotten = k => { k.process('remember that my car is red'); k.process('forget that my car is red'); k.process('yes'); return k.cold().slice(-1)[0].id; };
const PROPOSE = 'I derived a hypothesis “your car is red” from cold storage. I have not stored it. I can only seal it after your confirmation. It is the status “spc_cold_storage_required WARM”.';




T('must_archive is a containment route input after ghost and before dream', () => {
  const R = CT.route;
  const on = R({ kind: 'stored', must_archive: true, would_write: true });
  expect(on.route === 'spc_cold_storage_required' && on.rules.includes('CR-MUST-ARCHIVE') && on.may_write_memory === false, JSON.stringify(on));
  const ghost = R({ kind: 'no_frame', must_archive: true });
  expect(ghost.route === 'ghost_loop_containment_required' && !ghost.rules.includes('CR-MUST-ARCHIVE'), JSON.stringify(ghost));
  const breaker = R({ sealed: true, must_archive: true, kind: 'stored' });
  expect(breaker.route === 'spc_cold_storage_required' && breaker.rules[0] === 'CR-CIRCUIT-BREAKER-HARD-STOP' && !breaker.rules.includes('CR-MUST-ARCHIVE'), JSON.stringify(breaker));
  const dream = R({ kind: 'dream_held', dream: true, must_archive: true });
  expect(dream.route === 'spc_cold_storage_required' && dream.rules.includes('CR-MUST-ARCHIVE') && dream.route !== 'dream_state_quarantine_candidate', JSON.stringify(dream));
  const plain = R({ kind: 'stored' });
  expect(plain.route === 'active_stack_candidate' && plain.rules.includes('CR-ACTIVE') && !plain.rules.includes('CR-MUST-ARCHIVE') && plain.may_write_memory === true, JSON.stringify(plain));
  expect(KM.DRIFT_RULING.project_max === 0.35 && KM.DRIFT_RULING.explore_min === 0.4 && KM.DRIFT_RULING.explore_max === 0.8, JSON.stringify(KM.DRIFT_RULING));
});



T('product copy refuses hardware SPC and automatic ChristPing and keeps chi as the correction function', () => {
  const app = fs.readFileSync(ROOT + '/src/app.js', 'utf8');
  const readme = fs.readFileSync(ROOT + '/../README.md', 'utf8');
  expect(!/restore this record to active memory/.test(app), 'Memory Resurrect still offers a write');
  expect(/data-rscommit/.test(app) && /Nothing is stored/.test(app), 'no separate commit');
  expect(/[Hh]ardware SPC/.test(app) && /ChristPing/.test(app) && /correction function/.test(app), 'non-goals missing');
  expect(!/Christ function/i.test(app + readme), 'Christ function');
  expect(!/Resurrect control on the Memory screen writes/.test(readme), 'README still says the button writes');
  expect(/software tier/.test(readme) && /4\.9\.119/.test(readme), 'README');
  expect(!/failing-first|bot instruction/i.test(readme), 'README product');
  expect(!fs.existsSync(ROOT + '/src/creative.js'), 'creative writing started');
});

T('version, registry, CONFLICTS, and NEXT_BUILD name 4.9.119 and leave creative writing unstarted', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  const parts = ver.split('.').map(part => parseInt(part, 10));
  expect(parts[0] === 4 && parts[1] === 9 && parts[2] >= 119, ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver && reg.count === reg.features.length, reg.version + ' ' + reg.count);
  for (const id of ['R4119-RESURRECT', 'R4119-ARCHIVE', 'R4119-NOWRITE']) {
    const f = reg.features.find(x => x.id === id);
    expect(f && f.claim === 'Partial' && (f.proof || []).includes('R4119') && /4\.9\.119/.test(f.note), id);
    expect(f && /shared KB stays empty|Shared KB stays empty/.test(f.note) && !/Christ function/i.test(f.note), id + ' ' + (f && f.note));
  }
  const a11 = reg.features.find(x => x.id === 'A-11');
  expect(a11 && /4\.9\.117/.test(a11.note) && /4\.9\.118/.test(a11.note) && /4\.9\.119/.test(a11.note), a11 && a11.note);
  const tally = {}; for (const f of reg.features) tally[f.claim] = (tally[f.claim] || 0) + 1;
  expect(reg.claims.Implemented === 112 && reg.claims.Partial === tally.Partial + 1, JSON.stringify(reg.claims) + ' ' + tally.Partial);
  const cf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  const at = cf.lastIndexOf('## v4.9.119');
  expect(at > cf.lastIndexOf('## v4.9.118'), 'section');
  const sec = cf.slice(at);
  expect(/must_archive/.test(sec) && /CR-MUST-ARCHIVE/.test(sec) && /proposal/.test(sec), 'route');
  expect(/0\.35/.test(sec) && /creative writing/.test(sec) && /not started|do not start/.test(sec), 'queue');
  expect(/hardware SPC/.test(sec) && /ChristPing/.test(sec) && !/Christ function/i.test(sec), 'non-goals');
  const next = fs.readFileSync(ROOT + '/../NEXT_BUILD.md', 'utf8');
  expect(/4\.9\.119/.test(next) && /116–119|116-119/.test(next) && /creative writing/.test(next) && /not started|do not start/i.test(next), 'NEXT_BUILD');
  const targeted = JSON.parse(fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8'));
  const tp = String(targeted.release || '').split('.').map(part => parseInt(part, 10));
  expect(tp[0] === 4 && tp[1] === 9 && tp[2] >= 119 && targeted.suites.includes('r4119_suite.js') && targeted.suites.includes('r4118_suite.js'), targeted.release + ' ' + targeted.suites[0]);
  const RP = require(ROOT + '/src/req_packet.js');
  const slice = RP.packet('4.9.119');
  expect(slice && slice.requirements.some(r => r.id === 'R4119-DREAM'), JSON.stringify(slice && slice.requirements.map(r => r.id)));
  expect(RP.linksMissing(ROOT).length === 0, RP.linksMissing(ROOT).join(' '));
  expect(!fs.existsSync(ROOT + '/src/creative.js'), 'creative writing started');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4119', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4119', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
