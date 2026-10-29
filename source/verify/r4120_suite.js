/* R4120 (4.9.120): CREATE and EXPLORE novelty-banded ideas. Written FIRST.
 * A creative candidate carries novelty N and drift. Novelty without a memory
 * anchor is unbound and is not a discovery claim. A quarantine-band idea may
 * be spoken as a hypothesis or a speculative branch. A tap is the only commit,
 * and that commit is an idea record: memory, the world head, and the shared KB
 * stay unchanged. COMPOSE and Suppose are not this release. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const MEAP = require(ROOT + '/src/mea_p.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [], rows = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-27T16:20:00Z';
const mk = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK });
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
const head = k => k.worldHead();
const sameHead = (k, h) => head(k).version_id === h.version_id && head(k).content_hash === h.content_hash;
const DISCOVERY = ['verified_claim', 'derived_claim', 'resolved_manifest', 'named_concept'];
const cr = r => r.turn_packet && r.turn_packet.creative;
const quietStores = (k, h, n, why) => {
  expect(k.memory().length === n, why || ('memory ' + k.memory().length));
  expect(sharedN(k) === 0, 'shared KB');
  expect(sameHead(k, h), 'world head moved');
  expect(!(k.store.load('drift_archive') || []).length, 'drift archive');
  expect(!(k.store.load('ede_calibration') || []).length, 'ede calibration');
};

T('novelty without anchors is unbound and not a discovery claim', () => {
  expect(typeof MEAP.creativeScreen === 'function', 'creativeScreen missing');
  const s = MEAP.creativeScreen({ anchors: 0, retained: [], archived: [], rejected: [] }, { intent: 'CREATE' });
  expect(s.failure && s.failure.class === 'novelty_unbound', JSON.stringify(s.failure));
  expect(s.candidates.length === 1 && s.candidates[0].novelty.class === 'unbound' && s.candidates[0].novelty.N == null && s.candidates[0].novelty.anchored === false, JSON.stringify(s.candidates));
  expect(!s.candidates.some(c => DISCOVERY.includes(c.claim_status)), JSON.stringify(s.candidates.map(c => c.claim_status)));
  expect(!s.speak.length && s.candidates.every(c => c.spoken === false), 'unbound was spoken');
  const hard = MEAP.creativeScreen({ anchors: 1, retained: [], archived: [{ branch_id: 'b_hard', creation_operator: 'adjacent_synthesis', claim: { subject: 'thing:a', relation: 'isa', object: 'thing:b' }, anchor_ids: ['m1'], novelty: { N: 0.5 }, drift: { eps_s: 0.9 } }], rejected: [] }, { intent: 'CREATE' });
  expect(hard.failure && hard.failure.class === 'drift_hard' && hard.candidates.every(c => c.spoken === false) && hard.candidates[0].drift.band === 'reject', JSON.stringify(hard));
});

T('an unanchored invent is CREATE and refuses an unbound novelty', () => {
  const k = mk();
  k.clearStarterKnowledge();
  const h = head(k);
  const r = k.process('invent a hypothesis');
  expect(r.trace.intent_kind === 'CREATE', (r.trace.intent_kind || 'missing') + ' · ' + r.reply);
  expect(r.trace.intent_kind !== 'READ' && r.trace.intent_kind !== 'UNSUPPORTED', r.trace.intent_kind);
  expect(r.trace.echo && r.trace.echo.pass, (r.trace.echo && r.trace.echo.reason) || r.reply);
  expect(cr(r) && cr(r).failure && cr(r).failure.class === 'novelty_unbound', JSON.stringify(cr(r)));
  expect(cr(r).candidates.some(c => c.novelty && c.novelty.class === 'unbound' && c.novelty.N == null), JSON.stringify(cr(r)));
  expect(!cr(r).candidates.some(c => DISCOVERY.includes(c.claim_status)), JSON.stringify(cr(r)));
  expect(/have not stored/.test(r.reply || '') && /unbound/.test(r.reply || ''), r.reply);
  expect(r.turn_packet.schema === 'FORGE-TURN-PACKET/v1' && r.turn_packet.packet_version === '4.9.111' && r.turn_packet.receipt_type === 'gate_refusal', r.turn_packet && r.turn_packet.receipt_type);
  quietStores(k, h, 0);
  const comeK = mk(); comeK.clearStarterKnowledge();
  const come = comeK.process('come up with an idea');
  expect(come.trace.intent_kind === 'CREATE' && come.trace.echo.pass && cr(come).failure.class === 'novelty_unbound', come.trace.intent_kind + ' · ' + come.reply);
  const madeK = mk(); madeK.clearStarterKnowledge();
  const made = madeK.process('create an idea');
  expect(made.trace.intent_kind === 'CREATE' && cr(made).failure.class === 'novelty_unbound', made.trace.intent_kind + ' · ' + made.reply);
});

T('a projectable hypothesis is CREATE and a tap commits the idea record only', () => {
  const k = mk();
  expect(k.process('Remember that a spaniel is a dog.').trace.echo.pass, 'remember');
  expect(k.process('Remember that a dog is an animal.').trace.echo.pass, 'remember');
  const h = head(k);
  const r = k.process('invent a hypothesis');
  expect(r.trace.intent_kind === 'CREATE' && r.trace.echo.pass, (r.trace.intent_kind || '') + ' · ' + r.reply);
  expect(!cr(r).failure, JSON.stringify(cr(r) && cr(r).failure));
  const spoken = (cr(r).candidates || []).filter(c => c.spoken);
  expect(spoken.length === 1, JSON.stringify(cr(r)));
  const c = spoken[0];
  expect(c.claim_status === 'hypothesis' && c.novelty.anchored === true && c.novelty.class === 'bounded', JSON.stringify(c));
  expect(typeof c.novelty.N === 'number' && c.novelty.N >= 0.15 && c.novelty.N <= 0.75, JSON.stringify(c.novelty));
  expect(typeof c.drift.eps_s === 'number' && c.drift.eps_s <= 0.35 && c.drift.band === 'projectable', JSON.stringify(c.drift));
  expect(/spaniel/.test(c.claim) && /animal/.test(c.claim), c.claim);
  expect(/have not stored/.test(r.reply || '') && /hypothesis/.test(r.reply || ''), r.reply);
  expect(!/verified_claim|derived_claim|I noted that/.test(r.reply || ''), r.reply);
  expect(r.turn_packet.receipt_type === 'answer' && r.turn_packet.packet_version === '4.9.111', r.turn_packet.receipt_type);
  const staged = k.creativeProposals();
  expect(staged.length === 1 && staged[0].id === c.id && staged[0].status === 'proposed', JSON.stringify(staged));
  quietStores(k, h, 2);
  const phrase = k.process('seal the idea');
  expect(phrase.trace.intent_kind === 'CREATE' && phrase.trace.echo.pass && /have not stored/.test(phrase.reply || ''), phrase.reply);
  expect(k.creativeProposals().every(p => p.status === 'proposed'), JSON.stringify(k.creativeProposals()));
  quietStores(k, h, 2);
  const missing = k.commitIdea(null, true);
  expect(missing && missing.ok === false && missing.rule === 'CREATIVE-PROPOSAL-REQUIRED', JSON.stringify(missing));
  const noTap = k.commitIdea(c.id, false);
  expect(noTap && noTap.ok === false && noTap.rule === 'PERM-NEEDS-USER-TAP', JSON.stringify(noTap));
  expect(k.creativeProposals()[0].status === 'proposed', 'a false tap committed');
  quietStores(k, h, 2);
  const yes = k.commitIdea(c.id, true);
  expect(yes && yes.ok === true && yes.status === 'committed', JSON.stringify(yes));
  expect(k.creativeProposals().some(p => p.id === c.id && p.status === 'committed'), JSON.stringify(k.creativeProposals()));
  quietStores(k, h, 2, 'the tap wrote memory');
  const twice = k.commitIdea(c.id, true);
  expect(twice && twice.ok === false && k.memory().length === 2, JSON.stringify(twice));
});

T('explore alternatives speaks a quarantine idea and a tap does not store it', () => {
  const k = mk();
  k.process('Remember that Rex is a dog.');
  k.process('Remember that Fido is a dog.');
  k.process('Remember that a terrier is a hound.');
  k.process('Remember that a hound is a hunter.');
  const mem = k.memory();
  for (const row of mem) {
    if (!row.sfe) continue;
    const ent = (row.entities || []).join(' ');
    if (/rex|fido/.test(ent)) row.sfe.Phi = 3;
    else if (/terrier/.test(ent)) row.sfe.Phi = 4;
    else if (/hound/.test(ent) && /hunter/.test(ent)) row.sfe.Phi = 5;
  }
  k.store.save('memory', mem);
  const h = head(k);
  const r = k.process('explore alternatives');
  expect(r.trace.intent_kind === 'EXPLORE', (r.trace.intent_kind || 'missing') + ' · ' + r.reply);
  expect(r.trace.intent_kind !== 'READ' && r.trace.intent_kind !== 'PROPOSE_EVIDENCE', r.trace.intent_kind);
  expect(r.trace.echo && r.trace.echo.pass, (r.trace.echo && r.trace.echo.reason) || r.reply);
  expect(!cr(r).failure, JSON.stringify(cr(r) && cr(r).failure));
  const spoken = (cr(r).candidates || []).filter(c => c.spoken);
  expect(spoken.some(c => c.drift.band === 'explore' && c.drift.eps_s >= 0.40 && c.drift.eps_s <= 0.80 && c.novelty.N != null && (c.claim_status === 'speculative_branch' || c.claim_status === 'hypothesis')), JSON.stringify(spoken));
  expect(/speculative_branch|hypothesis/.test(r.reply || '') && /have not stored/.test(r.reply || ''), r.reply);
  const held = (cr(r).candidates || []).filter(c => !c.spoken);
  expect(held.some(c => c.reason && /correction/.test(c.reason)), JSON.stringify(cr(r).candidates));
  expect(r.turn_packet.schema === 'FORGE-TURN-PACKET/v1' && r.turn_packet.echo.pass === true, JSON.stringify(r.turn_packet && r.turn_packet.echo));
  const q = k.creativeProposals().find(p => p.drift && p.drift.band === 'explore' && p.status === 'proposed');
  expect(q, JSON.stringify(k.creativeProposals()));
  const tap = k.commitIdea(q.id, true);
  expect(tap && tap.ok === false && tap.rule === 'CREATIVE-DRIFT-NOT-PROJECTABLE', JSON.stringify(tap));
  expect(k.creativeProposals().every(p => p.status !== 'committed'), JSON.stringify(k.creativeProposals()));
  quietStores(k, h, 4);
});

T('a hard drift seal is refused and a seal without a proposal is refused', () => {
  const bare = mk();
  const bh = head(bare);
  const none = bare.process('seal the idea');
  expect(none.trace.intent_kind === 'CREATE' && none.trace.echo.pass, none.trace.intent_kind + ' · ' + none.reply);
  expect(cr(none) && cr(none).failure && cr(none).failure.class === 'commit_without_proposal', JSON.stringify(cr(none)));
  expect(/have not stored/.test(none.reply || '') && /commit_without_proposal/.test(none.reply || ''), none.reply);
  expect(none.turn_packet.receipt_type === 'gate_refusal' && none.turn_packet.failure && none.turn_packet.failure.class === 'gate_refusal', JSON.stringify(none.turn_packet && none.turn_packet.failure));
  expect(!(bare.store.load('creative_proposals') || []).length, 'a missing proposal was stored');
  quietStores(bare, bh, 0);
  const k = mk();
  k.process('Remember that a spaniel is a dog.');
  k.process('Remember that a dog is an animal.');
  const made = k.process('invent a hypothesis');
  expect(made.trace.intent_kind === 'CREATE' && made.trace.echo.pass, made.reply);
  const h = head(k);
  const rows = k.store.load('creative_proposals');
  expect(rows.length === 1, JSON.stringify(rows));
  rows[0].drift = { eps_s: 0.9, band: 'reject' };
  k.store.save('creative_proposals', rows);
  const hard = k.process('seal the idea');
  expect(hard.trace.intent_kind === 'CREATE' && hard.trace.echo.pass, hard.trace.intent_kind + ' · ' + hard.reply);
  expect(cr(hard) && cr(hard).failure && cr(hard).failure.class === 'drift_hard', JSON.stringify(cr(hard)));
  expect(/have not stored/.test(hard.reply || '') && /hard_stop/.test(hard.reply || ''), hard.reply);
  expect(k.creativeProposals()[0].status === 'proposed', JSON.stringify(k.creativeProposals()));
  const api = k.commitIdea(rows[0].id, true);
  expect(api && api.ok === false && api.rule === 'CREATIVE-DRIFT-HARD', JSON.stringify(api));
  quietStores(k, h, 2);
});

T('explore ideas stays PROPOSE_EVIDENCE and a question about an idea stays READ', () => {
  const k = mk();
  const ideas = k.process('explore ideas');
  expect(ideas.trace.intent_kind === 'PROPOSE_EVIDENCE' && ideas.trace.echo.pass, ideas.trace.intent_kind + ' · ' + ideas.reply);
  expect(/explored /.test(ideas.reply || '') && !cr(ideas), ideas.reply);
  const show = k.process('show the proposals');
  expect(show.trace.intent_kind === 'PROPOSE_EVIDENCE' && show.trace.echo.pass, show.trace.intent_kind + ' · ' + show.reply);
  const q = k.process('What is an idea?');
  expect(q.trace.intent_kind === 'READ' && q.trace.echo.pass, q.trace.intent_kind + ' · ' + q.reply);
  const phys = k.process('propose problem physics');
  expect(phys.trace.intent_kind === 'PROPOSE_EVIDENCE' && phys.trace.echo.pass && /144 Hz is a substrate/.test(phys.reply || ''), phys.reply);
  expect(sharedN(k) === 0, 'shared KB');
});

T('version, registry, CONFLICTS, and NEXT_BUILD name 4.9.120 and leave COMPOSE and Suppose unstarted', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  const parts = ver.split('.').map(part => parseInt(part, 10));
  expect(parts[0] === 4 && parts[1] === 9 && parts[2] >= 120, ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver && reg.count === reg.features.length, reg.version + ' ' + reg.count);
  for (const id of ['R4120-INTENT', 'R4120-NOVELTY', 'R4120-QUARANTINE']) {
    const f = reg.features.find(x => x.id === id);
    expect(f && f.claim === 'Partial' && (f.proof || []).includes('R4120') && /4\.9\.120/.test(f.note), id);
    expect(f && /shared KB stays empty|Shared KB stays empty/.test(f.note) && !/proven cognition/.test(f.note), id + ' ' + (f && f.note));
  }
  const a11 = reg.features.find(x => x.id === 'A-11');
  expect(a11 && /4\.9\.117/.test(a11.note) && /4\.9\.118/.test(a11.note) && /4\.9\.119/.test(a11.note) && /4\.9\.120/.test(a11.note), a11 && a11.note);
  const tally = {}; for (const f of reg.features) tally[f.claim] = (tally[f.claim] || 0) + 1;
  expect(reg.claims.Implemented === 112 && reg.claims.Partial === tally.Partial + 1, JSON.stringify(reg.claims) + ' ' + tally.Partial);
  const cf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  const at = cf.lastIndexOf('## v4.9.120');
  expect(at > cf.lastIndexOf('## v4.9.119'), 'section');
  const sec = cf.slice(at);
  expect(/CREATE/.test(sec) && /EXPLORE/.test(sec) && /0\.35/.test(sec) && /0\.80/.test(sec), 'bands');
  expect(/COMPOSE/.test(sec) && /Suppose/.test(sec) && /not started|do not start/.test(sec), 'queue');
  expect(/shared KB stays empty|Shared KB stays empty/.test(sec), 'shared');
  const next = fs.readFileSync(ROOT + '/../NEXT_BUILD.md', 'utf8');
  expect(/4\.9\.120/.test(next) && /4\.9\.121/.test(next) && /COMPOSE/.test(next) && /Suppose/.test(next) && /not started|do not start/i.test(next), 'NEXT_BUILD');
  const readme = fs.readFileSync(ROOT + '/../README.md', 'utf8');
  expect(/4\.9\.120/.test(readme) && /hypothesis/.test(readme) && /0\.35/.test(readme), 'README');
  expect(!/failing-first|bot instruction/i.test(readme), 'README product');
  const targeted = JSON.parse(fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8'));
  const tp = String(targeted.release || '').split('.').map(part => parseInt(part, 10));
  expect(tp[0] === 4 && tp[1] === 9 && tp[2] >= 120 && targeted.suites.includes('r4120_suite.js') && targeted.suites.includes('r4119_suite.js'), targeted.release + ' ' + targeted.suites[0]);
  const RP = require(ROOT + '/src/req_packet.js');
  const slice = RP.packet('4.9.120');
  expect(slice && slice.requirements.some(r => r.id === 'R4120-IDEA'), JSON.stringify(slice && slice.requirements.map(r => r.id)));
  expect(RP.linksMissing(ROOT).length === 0, RP.linksMissing(ROOT).join(' '));
  expect(!fs.existsSync(ROOT + '/src/creative.js'), 'creative.js');
  expect(!fs.existsSync(ROOT + '/src/compose.js'), 'COMPOSE started');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4120', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4120', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
