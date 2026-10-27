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

T('a memory resurrect is a proposal and does not write memory, the world head, or the shared KB', () => {
  const k = mk();
  const id = forgotten(k);
  const h = head(k);
  const attempts = k.cold().find(c => c.id === id).resurrection_attempts || 0;
  const r = k.resurrect(id, true);
  expect(r.ok === true && r.proposed === true && r.rule === 'RS-PROPOSAL', JSON.stringify(r));
  expect(!r.readback && !r.record, 'the proposal returned a store receipt');
  quiet(k, h, 'resurrect wrote ' + JSON.stringify({ mem: k.memory().length, shared: sharedN(k), head: head(k).version_id }));
  expect((k.cold().find(c => c.id === id).resurrection_attempts || 0) === attempts, 'the proposal spent an attempt');
  const staged = typeof k.resurrectionProposals === 'function' ? k.resurrectionProposals() : [];
  expect(staged.some(p => p.id === id && p.status === 'proposed'), JSON.stringify(staged));
  const cold = mk();
  cold.perm.setPolicy('forgottenTier', 'COLD', true);
  const cid = forgotten(cold);
  const ch = head(cold);
  const refused = cold.resurrect(cid, true);
  expect(!refused.ok && refused.proposed !== true && !cold.memory().length && sameHead(cold, ch), JSON.stringify(refused));
});

T('a separate commit tap is the only resurrection store', () => {
  const bare = mk();
  const bid = forgotten(bare);
  const bh = head(bare);
  const denied = bare.commitResurrection(bid, true);
  expect(!denied.ok && denied.rule === 'RS-PROPOSAL-REQUIRED', JSON.stringify(denied));
  quiet(bare, bh, 'a commit without a proposal wrote');
  expect((bare.cold().find(c => c.id === bid).resurrection_attempts || 0) === 1, 'a refused commit did not count');
  const k = mk();
  const id = forgotten(k);
  expect(k.resurrect(id, true).proposed === true, 'no proposal');
  const noTap = k.commitResurrection(id, false);
  expect(!noTap.ok && noTap.rule === 'PERM-NEEDS-USER-TAP' && !k.memory().length, JSON.stringify(noTap));
  expect(k.cold().find(c => c.id === id).resurrection_attempts === 1, 'a false tap did not count');
  const yes = k.commitResurrection(id, true);
  expect(yes.ok && yes.readback && yes.readback.readback === 'match', JSON.stringify(yes));
  expect(k.memory().length === 1 && k.memory()[0].resurrected && /ψ′/.test(k.memory()[0].resurrected.note), 'not stored');
  expect(/red/.test(k.process('what is my car?').reply), 'recall');
  expect(sharedN(k) === 0, 'shared KB');
  const twice = k.commitResurrection(id, true);
  expect(!twice.ok && k.memory().length === 1, JSON.stringify(twice));
  const clash = mk();
  clash.process('remember that my car is red');
  clash.process('remember that my car is blue');
  clash.process('yes');
  const old = clash.cold().slice(-1)[0].id;
  expect(clash.resurrect(old, true).proposed === true, 'conflict row did not propose');
  const blocked = clash.commitResurrection(old, true);
  expect(!blocked.ok && blocked.rule === 'RS-CONFLICTS-ACTIVE-FACT' && clash.memory().length === 1, JSON.stringify(blocked));
  const drift = mk();
  const did = forgotten(drift);
  expect(drift.resurrect(did, true).proposed === true);
  const cs = drift.store.load('cold_storage');
  cs.find(c => c.id === did).record.sfe.eps = 0.5;
  drift.store.save('cold_storage', cs);
  const held = drift.commitResurrection(did, true);
  expect(!held.ok && held.rule === 'RS-DRIFT-NOT-PROJECTABLE' && !drift.memory().length && sharedN(drift) === 0, JSON.stringify(held));
  const limit = mk();
  const lid = forgotten(limit);
  for (let i = 0; i < 5; i++) expect(!limit.commitResurrection(lid, false).ok);
  expect(limit.resurrectPreview(lid).decision === 'deep_archive_seal' && !limit.memory().length, 'five false taps did not seal');
});

T('a resurrection phrase stages a proposal and still does not write', () => {
  const k = mk();
  k.process('remember that my car is red');
  k.process('forget that my car is red');
  k.process('yes');
  const id = k.cold()[0].id;
  const h = head(k);
  const attempts = k.cold()[0].resurrection_attempts || 0;
  const a = k.process('resurrect that my car is red');
  expect(a.reply === PROPOSE, a.reply);
  expect(a.trace.intent_kind === 'PROPOSE_EVIDENCE', a.trace.intent_kind);
  expect(a.trace.echo && a.trace.echo.pass && a.trace.language !== 'LANGUAGE_UNEXPRESSIBLE', a.reply);
  expect(a.trace.containment && a.trace.containment.may_write_memory === false, JSON.stringify(a.trace.containment));
  expect(!(a.trace.memory || []).length, 'the phrase wrote on the trace');
  quiet(k, h, 'the phrase wrote');
  expect((k.cold()[0].resurrection_attempts || 0) === attempts, 'the phrase spent an attempt');
  const staged = k.resurrectionProposals();
  expect(staged.some(p => p.id === id && p.status === 'proposed'), JSON.stringify(staged));
  const back = k.process('bring back that my car is red');
  expect(back.trace.intent_kind === 'PROPOSE_EVIDENCE' && back.trace.echo.pass && /have not stored it/.test(back.reply) && !k.memory().length && sameHead(k, h), back.reply);
  const stored = k.commitResurrection(id, true);
  expect(stored.ok && k.memory().length === 1 && sharedN(k) === 0, JSON.stringify(stored));
});

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

T('a must_archive turn names the route on inspect and writes nothing', () => {
  const off = mk();
  expect(off.perm.policy().mustArchive === 'off', JSON.stringify(off.perm.policy().mustArchive));
  expect(off.process('show quarantine').reply === 'I have no items in the dream quarantine.', 'empty quarantine changed');
  expect(off.process('show cold storage').reply === 'I have no records in cold storage.', 'empty cold storage changed');
  const k = mk();
  expect(k.perm.setPolicy('mustArchive', 'on', true).decision === 'allow', 'switch');
  expect(k.perm.policy().mustArchive === 'on');
  const h = head(k);
  const r = k.process('remember that my car is red');
  expect(r.trace.containment.route === 'spc_cold_storage_required' && r.trace.containment.rules.includes('CR-MUST-ARCHIVE'), JSON.stringify(r.trace.containment));
  expect(r.trace.intent_kind === 'PROPOSE_EVIDENCE', r.trace.intent_kind + ' ' + r.reply);
  expect(r.trace.echo && r.trace.echo.pass, r.reply);
  expect(/must_archive/.test(r.reply), r.reply);
  expect(!(r.trace.memory || []).length, 'remember wrote on the trace');
  quiet(k, h, 'must_archive remember wrote');
  const q = k.process('show quarantine');
  expect(/^I have no items in the dream quarantine\./.test(q.reply) && /must_archive/.test(q.reply), q.reply);
  expect(q.trace.echo && q.trace.echo.pass && q.trace.containment.rules.includes('CR-MUST-ARCHIVE'), q.reply);
  expect(q.trace.containment.route === 'spc_cold_storage_required', q.trace.containment && q.trace.containment.route);
  quiet(k, h, 'inspect wrote');
  const d = k.process('suppose my car is red');
  expect(d.trace.containment.route === 'spc_cold_storage_required' && d.trace.containment.rules.includes('CR-MUST-ARCHIVE'), JSON.stringify(d.trace.containment));
  expect(d.trace.echo && d.trace.echo.pass && /must_archive/.test(d.reply), d.reply);
  expect(k.containment.list().dream.length === 0, 'must_archive still opened a dream row');
  quiet(k, h, 'must_archive dream wrote');
  const fault = mk({ renderFault: t => t.replace(/noted|stored/g, 'denied') });
  fault.perm.setPolicy('mustArchive', 'on', true);
  const g = fault.process('remember that my car is red');
  expect(g.blocked && g.trace.containment.route === 'ghost_loop_containment_required' && !g.trace.containment.rules.includes('CR-MUST-ARCHIVE'), JSON.stringify(g.trace.containment));
  expect(!fault.memory().length && sharedN(fault) === 0, 'ghost wrote');
});

T('dream, phrase, and quarantine turns do not silently write past echo', () => {
  const k = mk();
  k.process('remember that my car is blue');
  const h = head(k);
  const world = JSON.stringify(k.worldState());
  const d = k.process('suppose my car is red');
  expect(d.trace.containment.route === 'dream_state_quarantine_candidate' && d.trace.echo.pass, d.reply);
  expect(k.memory().length === 1 && sameHead(k, h) && JSON.stringify(k.worldState()) === world && sharedN(k) === 0, 'dream wrote');
  k.process('forget that my car is blue');
  k.process('yes');
  const after = head(k);
  const phrase = k.process('resurrect that my car is blue');
  expect(phrase.trace.intent_kind === 'PROPOSE_EVIDENCE' && phrase.trace.echo.pass && !k.memory().length && sameHead(k, after) && sharedN(k) === 0, phrase.reply);
  const id = k.cold().slice(-1)[0].id;
  const api = k.resurrect(id, true);
  expect(api.proposed === true && !k.memory().length && sameHead(k, after) && sharedN(k) === 0, JSON.stringify(api));
  const list = k.process('show quarantine');
  expect(list.trace.echo.pass && !k.memory().length && sameHead(k, after) && sharedN(k) === 0, list.reply);
  expect(!/Christ function/i.test([d.reply, phrase.reply, list.reply].join(' ')), 'christ');
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
  const parts = ver.split('.').map(Number);
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
  const tp = String(targeted.release || '').split('.').map(Number);
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
