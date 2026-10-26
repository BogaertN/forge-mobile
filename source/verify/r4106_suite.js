/* R4106 (4.9.106): dream quarantine and SPC cold storage are inspectable.
 * A contained turn names one live containment route. Forget is not erasure.
 * Show quarantine / show cold storage list route, tier, and a short label.
 * “resurrect” / “bring back” proposes a WARM row and does not write.
 * Written FIRST (failing). */
const ROOT = require('path').join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const CT = require(ROOT + '/src/containment.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-26T04:10:00Z';
const mk = (o) => KMOD.Kernel(Object.assign({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK }, o || {}));
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
const head = k => (typeof k.worldHead === 'function' ? k.worldHead() : null);
const ROUTES = CT.ROUTES;
const named = text => ROUTES.filter(r => String(text || '').includes(r));
const oneRoute = (r, why) => { expect(r && r.trace && r.trace.containment && ROUTES.includes(r.trace.containment.route), why || JSON.stringify(r && r.trace && r.trace.containment)); };
const noChrist = text => expect(!/Christ function/i.test(String(text || '')), text);
const noErase = text => expect(!/eras|deleted forever|forgotten forever|gone forever/i.test(String(text || '')), text);
const PHYSICS = 'I derived 1 hypothesis from the problem: (1) “144 Hz is a substrate (fundamental) frequency”. I have not stored the problem. I can only seal it after your confirmation. I archived 4 candidates.';

T('an empty inspect names nothing and stores nothing', () => {
  const k = mk();
  const q = k.process('show quarantine');
  expect(q.reply === 'I have no items in the dream quarantine.', q.reply);
  expect(q.trace.intent_kind === 'READ', q.trace.intent_kind);
  expect(q.trace.echo && q.trace.echo.pass, q.reply);
  oneRoute(q);
  expect(named(q.reply).length === 0, q.reply);
  const c = k.process('show cold storage');
  expect(c.reply === 'I have no records in cold storage.', c.reply);
  expect(c.trace.intent_kind === 'READ', c.trace.intent_kind);
  expect(c.trace.echo && c.trace.echo.pass, c.reply);
  const both = k.process('show containment');
  expect(both.reply === 'I have no items in the dream quarantine. I have no records in cold storage.', both.reply);
  expect(both.trace.echo && both.trace.echo.pass, both.reply);
  expect(!k.memory().length && sharedN(k) === 0, 'inspect wrote');
  expect(head(k).committed === false, 'an empty inspect committed a head');
  noChrist(q.reply); noChrist(c.reply); noChrist(both.reply);
});

T('a bare suppose is dream quarantine and the list names that route', () => {
  const k = mk();
  k.process('remember that my car is blue');
  const h = head(k);
  const world = JSON.stringify(k.worldState());
  const d = k.process('suppose my car is red');
  expect(d.trace.intent_kind === 'SIMULATE', d.trace.intent_kind + ' ' + d.reply);
  expect(d.msm && d.msm.meaning && d.msm.meaning.kind === 'dream_held', d.reply);
  expect(d.trace.containment.route === 'dream_state_quarantine_candidate', d.trace.containment && d.trace.containment.route);
  oneRoute(d);
  expect(d.trace.echo && d.trace.echo.pass, d.reply);
  expect(k.memory().length === 1 && k.memory()[0].clause && k.memory()[0].clause.pred && k.memory()[0].clause.pred.words && k.memory()[0].clause.pred.words[0] === 'blue', JSON.stringify(k.memory().map(m => m.clause)));
  expect(k.containment.list().dream.length === 1 && k.containment.list().dream[0].truth_support_allowed === false, 'dream row missing');
  expect(head(k).version_id === h.version_id && head(k).content_hash === h.content_hash, 'the dream moved the head');
  expect(JSON.stringify(k.worldState()) === world, 'the dream wrote the projection');
  const q = k.process('show quarantine');
  expect(q.reply === 'I have 1 item in the dream quarantine: (1) “dream_state_quarantine_candidate quarantined your car is red”.', q.reply);
  expect(named(q.reply).length === 1 && named(q.reply)[0] === 'dream_state_quarantine_candidate', named(q.reply).join(','));
  expect(q.trace.intent_kind === 'READ', q.trace.intent_kind);
  expect(q.trace.echo && q.trace.echo.pass && q.trace.language !== 'LANGUAGE_UNEXPRESSIBLE', q.reply);
  expect(head(k).version_id === h.version_id, 'the list moved the head');
  expect(sharedN(k) === 0, 'shared KB written');
  noChrist(d.reply); noChrist(q.reply); noErase(q.reply);
});

T('forget moves a fact to cold storage and a later list still finds it', () => {
  const k = mk();
  k.process('remember that my car is red');
  const before = head(k);
  k.process('forget that my car is red');
  const r = k.process('yes');
  expect(r.reply === 'I moved 1 fact to cold storage: (1) your car is red. It no longer answers questions.', r.reply);
  expect(r.trace.intent_kind === 'REQUEST_COMMIT', r.trace.intent_kind);
  expect(r.trace.containment.route === 'correction_queue', r.trace.containment && r.trace.containment.route);
  oneRoute(r);
  noErase(r.reply);
  expect(!k.memory().length, 'forget left the fact active');
  const cold = k.store.load('cold_storage');
  expect(cold.length === 1, 'cold storage empty');
  expect(k.containment.tierOf(cold[0], k.perm.policy()) === 'WARM', k.containment.tierOf(cold[0], k.perm.policy()));
  const h = head(k);
  expect(h.version_id !== before.version_id && h.parent_versions[0] === before.version_id, 'forget did not commit the next head');
  const list = k.process('show cold storage');
  expect(list.reply === 'I have 1 record in cold storage: (1) “spc_cold_storage_required WARM your car is red”.', list.reply);
  expect(named(list.reply).length === 1 && named(list.reply)[0] === 'spc_cold_storage_required', list.reply);
  expect(list.trace.intent_kind === 'READ' && list.trace.echo && list.trace.echo.pass, list.reply);
  expect(head(k).version_id === h.version_id && head(k).content_hash === h.content_hash, 'the list moved the head');
  expect(k.store.load('cold_storage').length === 1 && !k.memory().length, 'the list restored or dropped the row');
  const both = k.process('show containment');
  expect(/dream quarantine/.test(both.reply) && /cold storage/.test(both.reply) && /spc_cold_storage_required WARM your car is red/.test(both.reply), both.reply);
  expect(both.trace.echo && both.trace.echo.pass, both.reply);
  expect(sharedN(k) === 0, 'shared KB written');
  noChrist(r.reply); noChrist(list.reply); noErase(list.reply);
});

T('resurrect and bring back propose a WARM row and do not write', () => {
  const k = mk();
  k.process('remember that my car is red');
  k.process('forget that my car is red');
  k.process('yes');
  const h = head(k);
  const attempts = k.store.load('cold_storage')[0].resurrection_attempts || 0;
  const a = k.process('resurrect that my car is red');
  const want = 'I derived a hypothesis “your car is red” from cold storage. I have not stored it. I can only seal it after your confirmation. It is the status “spc_cold_storage_required WARM”.';
  expect(a.reply === want, a.reply);
  expect(a.trace.intent_kind === 'PROPOSE_EVIDENCE', a.trace.intent_kind + ' ' + a.reply);
  expect(a.trace.echo && a.trace.echo.pass && a.trace.language !== 'LANGUAGE_UNEXPRESSIBLE', a.reply);
  oneRoute(a);
  expect(named(a.reply).length === 1 && named(a.reply)[0] === 'spc_cold_storage_required', a.reply);
  expect(!k.memory().length, 'the phrase restored memory');
  expect(head(k).version_id === h.version_id && head(k).content_hash === h.content_hash, 'the proposal moved the head');
  expect((k.store.load('cold_storage')[0].resurrection_attempts || 0) === attempts, 'the phrase spent a resurrection attempt');
  const b = k.process('bring back that my car is red');
  expect(b.reply === want, b.reply);
  expect(b.trace.intent_kind === 'PROPOSE_EVIDENCE', b.trace.intent_kind);
  expect(!k.memory().length && head(k).version_id === h.version_id, 'bring back wrote');
  const miss = k.process('resurrect that my boat is blue');
  expect(miss.reply === 'I have no record “your boat is blue” in cold storage.', miss.reply);
  expect(miss.trace.intent_kind === 'READ', miss.trace.intent_kind);
  expect(!k.memory().length && sharedN(k) === 0, 'a miss wrote');
  noChrist(a.reply); noErase(a.reply);
});

T('a COLD forgotten row is listed as COLD and is not returned', () => {
  const k = mk();
  k.process('remember that my car is red');
  k.process('forget that my car is red');
  k.process('yes');
  const set = k.perm.setPolicy('forgottenTier', 'COLD', true);
  expect(set && set.decision === 'allow', JSON.stringify(set));
  const h = head(k);
  const list = k.process('show cold storage');
  expect(list.reply === 'I have 1 record in cold storage: (1) “spc_cold_storage_required COLD your car is red”.', list.reply);
  expect(k.containment.tierOf(k.store.load('cold_storage')[0], k.perm.policy()) === 'COLD', 'tierOf');
  const r = k.process('resurrect that my car is red');
  expect(r.reply === 'I cannot restore the record “your car is red”. It is the status “COLD”.', r.reply);
  expect(r.trace.intent_kind === 'UNSUPPORTED', r.trace.intent_kind + ' ' + r.reply);
  expect(r.trace.echo && r.trace.echo.pass, r.reply);
  expect(!k.memory().length, 'COLD was restored');
  expect(head(k).version_id === h.version_id, 'COLD refusal moved the head');
  expect(k.store.load('cold_storage').length === 1 && sharedN(k) === 0, 'the row left cold storage');
  noChrist(list.reply); noChrist(r.reply); noErase(r.reply);
});

T('guards: physics propose, a suppose branch, and no Christ function', () => {
  const k = mk();
  const p = k.process('propose problem physics');
  expect(p.reply === PHYSICS, p.reply);
  expect(p.trace.intent_kind === 'PROPOSE_EVIDENCE', p.trace.intent_kind);
  expect(head(k).committed === false, 'the proposal committed a world head');
  k.process('Remember that Pim is inside Quo.');
  const h = head(k);
  const sim = k.process('Suppose Quo is inside Rub. Is Pim inside Rub?');
  expect(sim.trace.intent_kind === 'SIMULATE', sim.trace.intent_kind);
  expect(/branch/.test(sim.reply || '') && /Yes/.test(sim.reply || ''), sim.reply);
  expect(head(k).version_id === h.version_id, 'the branch moved the head');
  expect(sharedN(k) === 0, 'shared KB written');
  noChrist(p.reply); noChrist(sim.reply);
});

(async () => {
  for (const t of tests) { try { await t.fn(); rows.push({ cls: 'R4106', name: t.name, ok: true }); } catch (e) { rows.push({ cls: 'R4106', name: t.name, ok: false, detail: String(e.message || e).slice(0, 400) }); } }
  console.log(JSON.stringify(rows));
  process.exit(rows.some(r => !r.ok) ? 1 : 0);
})();
