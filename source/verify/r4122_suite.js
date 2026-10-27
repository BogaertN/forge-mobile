/* R4122 (4.9.122): Suppose story branches are isolated SIMULATE.
 * Written FIRST. A story, a simulation, or a counterfactual is a branch.
 * The surface names it a simulation and a counterfactual. It is not a fact.
 * Parking uses dream quarantine. Nothing is written to the world head,
 * memory, or the shared KB. No parallel story engine. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [], rows = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-27T17:10:00Z';
const mk = extra => KMOD.Kernel(Object.assign({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK }, extra || {}));
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
const head = k => k.worldHead();
const sameHead = (k, h) => head(k).version_id === h.version_id && head(k).content_hash === h.content_hash;
const cr = r => r.turn_packet && r.turn_packet.creative;
const ids = r => ((r.trace && r.trace.rules) || []).map(x => x.id);
const quietStores = (k, h, n, why) => {
  expect(k.memory().length === n, why || ('memory ' + k.memory().length));
  expect(sharedN(k) === 0, 'shared KB');
  expect(sameHead(k, h), 'world head moved');
  expect(!(k.store.load('drift_archive') || []).length, 'drift archive');
  expect(!(k.store.load('ede_calibration') || []).length, 'ede calibration');
  expect(!(k.store.load('creative_proposals') || []).length, 'idea record');
};
const echoOk = r => {
  const e = r.trace.echo;
  expect(e && e.pass === true, (e && e.reason) || r.block_reason || r.reply);
  expect(e.score === 1 && e.theta === 1 && e.components && e.components.structural_identity === 1, JSON.stringify(e.components));
  expect(/structural round trip/.test(e.mode || '') && !/overlap|soft echo|word-overlap measure/.test(String(e.mode).replace('no word-overlap measure', '')), e.mode);
  expect(!r._k || r._k.realize(r.msm.meaning).text === r.reply, 're-realize');
};
const tag = (k, r) => Object.assign(r, { _k: k });
const dreams = k => (k.containment.list().dream || []).filter(d => d.hyp_status === 'quarantined');
const named = r => { expect(/simulation/.test(r.reply || '') && /counterfactual/.test(r.reply || '') && /speculative_branch/.test(r.reply || '') && /not a stored fact/.test(r.reply || '') && /not the status “verified_claim”/.test(r.reply || '') && /world/.test(r.reply || ''), r.reply); };
const packetAnswer = r => {
  expect(r.turn_packet.schema === 'FORGE-TURN-PACKET/v1' && r.turn_packet.packet_version === '4.9.111', r.turn_packet && r.turn_packet.packet_version);
  expect(r.turn_packet.receipt_type === 'answer', r.turn_packet && r.turn_packet.receipt_type);
  expect(r.turn_packet.containment && r.turn_packet.containment.route, 'containment');
  expect(cr(r) && cr(r).intent === 'SIMULATE' && cr(r).branch_id && !cr(r).failure && cr(r).claim_status === 'speculative_branch', JSON.stringify(cr(r)));
  expect(!String(r.reply || '').includes(cr(r).branch_id), 'spoke the branch id');
  expect((r.trace.msm_v1.preservation_classes || []).includes('action_proposal_simulation_and_observation'), JSON.stringify(r.trace.msm_v1 && r.trace.msm_v1.preservation_classes));
};

T('a suppose story opens an isolated simulation and does not write the world', () => {
  for (const phrase of ['suppose a story', 'suppose a story where the dog flies', 'suppose a simulation', 'suppose a counterfactual', 'open a simulation', 'open a counterfactual', 'what if a story', 'what if the story where the dog flies']) {
    const k = mk();
    const h = head(k);
    const r = tag(k, k.process(phrase));
    expect(r.trace.intent_kind === 'SIMULATE', phrase + ' → ' + (r.trace.intent_kind || 'missing') + ' · ' + r.reply);
    expect(r.msm.meaning.kind === 'suppose_branch' && r.msm.meaning.creative_intent === 'SIMULATE', phrase + ' ' + (r.msm.meaning && r.msm.meaning.kind));
    echoOk(r);
    named(r);
    packetAnswer(r);
    expect(r.turn_packet.containment.route === 'active_stack_candidate', phrase + ' ' + r.turn_packet.containment.route);
    expect(!dreams(k).length, phrase + ' dreamed');
    expect(!k.worldState().entities.some(e => /dog|story|flies/.test(JSON.stringify(e))), phrase + ' world');
    quietStores(k, h, 0);
  }
  const k = mk();
  const h = head(k);
  const a = tag(k, k.process('suppose a story where the dog flies'));
  echoOk(a);
  const b = tag(k, k.process('suppose a story where the cat swims'));
  echoOk(b);
  expect(cr(a).branch_id === cr(b).branch_id, cr(a).branch_id + ' ' + cr(b).branch_id);
  expect(b.trace.intent_kind === 'SIMULATE' && b.msm.meaning.kind === 'suppose_branch' && cr(b).claim_status === 'speculative_branch', b.reply);
  quietStores(k, h, 0);
});

T('continuing the branch keeps the same simulation and the claim stays speculative', () => {
  for (const phrase of ['continue the branch', 'continue the simulation', 'continue the counterfactual', 'continue the story']) {
    const k = mk();
    const h = head(k);
    const opened = tag(k, k.process('suppose a story where the dog flies'));
    echoOk(opened);
    const id = cr(opened).branch_id;
    const r = tag(k, k.process(phrase));
    expect(r.trace.intent_kind === 'SIMULATE' && r.msm.meaning.kind === 'suppose_branch', phrase + ' → ' + r.trace.intent_kind + ' · ' + r.reply);
    echoOk(r);
    named(r);
    packetAnswer(r);
    expect(cr(r).branch_id === id, phrase + ' ' + cr(r).branch_id);
    expect(!dreams(k).length, phrase + ' parked');
    quietStores(k, h, 0);
  }
});

T('parking or ending the branch uses dream quarantine and does not write the world', () => {
  for (const phrase of ['park the branch', 'park the simulation', 'end the branch', 'end the simulation', 'close the simulation', 'end the counterfactual']) {
    const k = mk();
    const h = head(k);
    const opened = tag(k, k.process('suppose a story where the dog flies'));
    echoOk(opened);
    const id = cr(opened).branch_id;
    const r = tag(k, k.process(phrase));
    expect(r.trace.intent_kind === 'SIMULATE' && r.msm.meaning.kind === 'suppose_branch' && r.msm.meaning.contain !== 'fact', phrase + ' → ' + r.trace.intent_kind + ' · ' + r.reply);
    echoOk(r);
    expect(/dream quarantine/.test(r.reply || '') && /simulation/.test(r.reply || '') && /counterfactual/.test(r.reply || ''), phrase + ' · ' + r.reply);
    expect(/speculative_branch/.test(r.reply || '') && /not a stored fact/.test(r.reply || ''), phrase + ' · ' + r.reply);
    packetAnswer(r);
    expect(r.turn_packet.containment.route === 'dream_state_quarantine_candidate', phrase + ' ' + r.turn_packet.containment.route);
    expect(cr(r).branch_id === id, phrase);
    const held = dreams(k);
    expect(held.some(d => d.route === 'dream_state_quarantine_candidate' && /dog flies/.test(d.label || '')), phrase + ' ' + JSON.stringify(held.map(d => d.label)));
    quietStores(k, h, 0);
    const later = tag(k, k.process('continue the branch'));
    expect(later.trace.intent_kind === 'SIMULATE' && cr(later) && cr(later).failure && cr(later).failure.class === 'commit_without_proposal', phrase + ' still open · ' + later.reply);
    expect(later.turn_packet.receipt_type === 'gate_refusal', later.turn_packet.receipt_type);
    const again = tag(k, k.process('suppose a story where the bird sings'));
    echoOk(again);
    expect(cr(again).branch_id !== id, phrase + ' reused ' + cr(again).branch_id);
    const shown = k.process('show quarantine');
    expect(shown.trace.echo.pass && /dream_state_quarantine_candidate/.test(shown.reply || ''), shown.reply);
    quietStores(k, h, 0);
  }
});

T('a world-write attempt is refused and the world head stays', () => {
  for (const phrase of ['write the branch to the world', 'write the simulation to the world', 'store the simulation in the world', 'remember the branch', 'commit the branch', 'seal the simulation']) {
    const k = mk();
    const opened = tag(k, k.process('suppose a story where the dog flies'));
    echoOk(opened);
    const id = cr(opened).branch_id;
    const h = head(k);
    const r = tag(k, k.process(phrase));
    expect(r.trace.intent_kind === 'SIMULATE', phrase + ' → ' + r.trace.intent_kind + ' · ' + r.reply);
    echoOk(r);
    expect(cr(r) && cr(r).failure && cr(r).failure.class === 'world_write', phrase + ' ' + JSON.stringify(cr(r)));
    expect(r.turn_packet.receipt_type === 'gate_refusal' && r.turn_packet.schema === 'FORGE-TURN-PACKET/v1' && r.turn_packet.packet_version === '4.9.111', phrase + ' ' + (r.turn_packet && r.turn_packet.receipt_type));
    expect(/world_write/.test(r.reply || '') && /not the status “verified_claim”/.test(r.reply || ''), phrase + ' · ' + r.reply);
    expect(cr(r).claim_status !== 'verified_claim' && cr(r).branch_id === id, JSON.stringify(cr(r)));
    expect((cr(r).candidates || []).every(c => c.spoken === false && c.claim_status !== 'verified_claim'), JSON.stringify(cr(r)));
    quietStores(k, h, 0);
    const still = tag(k, k.process('continue the branch'));
    expect(still.trace.echo.pass && cr(still).branch_id === id && !cr(still).failure, phrase + ' closed · ' + still.reply);
  }
});

T('an unbound novelty spoken as a discovery is refused', () => {
  const bare = mk();
  const bh = head(bare);
  const disc = tag(bare, bare.process('suppose a discovery'));
  expect(disc.trace.intent_kind === 'SIMULATE', disc.trace.intent_kind + ' · ' + disc.reply);
  echoOk(disc);
  expect(cr(disc) && cr(disc).failure && cr(disc).failure.class === 'novelty_unbound', JSON.stringify(cr(disc)));
  expect(disc.turn_packet.receipt_type === 'gate_refusal', disc.turn_packet.receipt_type);
  expect(/novelty_unbound/.test(disc.reply || '') && /not the status “verified_claim”/.test(disc.reply || ''), disc.reply);
  expect(!dreams(bare).length && !cr(disc).branch_id, 'discovery opened a branch');
  quietStores(bare, bh, 0);
  const k = mk();
  const h = head(k);
  const opened = tag(k, k.process('suppose a story where the dog flies'));
  echoOk(opened);
  expect(cr(opened).claim_status === 'speculative_branch' && !/verified_claim/.test(cr(opened).claim_status), opened.reply);
  const id = cr(opened).branch_id;
  const claim = tag(k, k.process('claim the branch as a discovery'));
  expect(claim.trace.intent_kind === 'SIMULATE', claim.trace.intent_kind + ' · ' + claim.reply);
  echoOk(claim);
  expect(cr(claim) && cr(claim).failure && cr(claim).failure.class === 'novelty_unbound', JSON.stringify(cr(claim)));
  expect(claim.turn_packet.receipt_type === 'gate_refusal' && /novelty_unbound/.test(claim.reply || ''), claim.reply);
  expect(cr(claim).claim_status !== 'verified_claim', JSON.stringify(cr(claim)));
  quietStores(k, h, 0);
  const still = tag(k, k.process('continue the branch'));
  expect(still.trace.echo.pass && cr(still).branch_id === id && cr(still).claim_status === 'speculative_branch', still.reply);
  const anchored = mk();
  expect(anchored.process('Remember that a dog is an animal.').trace.echo.pass, 'remember');
  const ah = head(anchored);
  const story = tag(anchored, anchored.process('suppose a story where the dog flies'));
  echoOk(story);
  const kept = tag(anchored, anchored.process('claim the branch as a discovery'));
  expect(kept.trace.intent_kind === 'SIMULATE' && kept.msm.meaning.kind === 'suppose_branch', kept.trace.intent_kind + ' · ' + kept.reply);
  echoOk(kept);
  expect(!cr(kept).failure && cr(kept).claim_status === 'speculative_branch' && cr(kept).branch_id === cr(story).branch_id, JSON.stringify(cr(kept)));
  expect(/speculative_branch/.test(kept.reply || '') && /not the status “verified_claim”/.test(kept.reply || ''), kept.reply);
  expect(kept.turn_packet.receipt_type === 'answer', kept.turn_packet.receipt_type);
  quietStores(anchored, ah, 1);
});

T('commit the branch with no simulation is commit_without_proposal', () => {
  for (const phrase of ['commit the branch', 'seal the simulation', 'park the branch', 'continue the branch', 'end the story', 'write the branch to the world']) {
    const k = mk();
    const h = head(k);
    const r = tag(k, k.process(phrase));
    expect(r.trace.intent_kind === 'SIMULATE', phrase + ' → ' + (r.trace.intent_kind || 'missing') + ' · ' + r.reply);
    echoOk(r);
    expect(cr(r) && cr(r).failure && cr(r).failure.class === 'commit_without_proposal', phrase + ' ' + JSON.stringify(cr(r)));
    expect(r.turn_packet.receipt_type === 'gate_refusal', phrase + ' ' + (r.turn_packet && r.turn_packet.receipt_type));
    expect(/commit_without_proposal/.test(r.reply || ''), phrase + ' · ' + r.reply);
    expect(!dreams(k).length, phrase + ' stored a dream');
    quietStores(k, h, 0);
  }
});

T('an Echo miss blocks the simulation and stores nothing', () => {
  const k = mk({ renderFault: (text, msm) => (msm.meaning && msm.meaning.kind === 'suppose_branch' ? String(text).replace(/simulation/g, 'story') : text) });
  const h = head(k);
  const blocked = k.process('suppose a story where the dog flies');
  expect(blocked.reply == null && blocked.trace.blocked === true, blocked.reply);
  expect(blocked.trace.intent_kind === 'SIMULATE', blocked.trace.intent_kind);
  expect(blocked.trace.language === 'LANGUAGE_UNEXPRESSIBLE', blocked.trace.language || blocked.trace.block_reason);
  expect(blocked.trace.echo && blocked.trace.echo.pass === false, JSON.stringify(blocked.trace.echo));
  expect(blocked.turn_packet.receipt_type === 'echo_fail' && blocked.turn_packet.schema === 'FORGE-TURN-PACKET/v1', blocked.turn_packet && blocked.turn_packet.receipt_type);
  expect(!dreams(k).length, 'echo miss quarantined');
  quietStores(k, h, 0);
  const later = k.process('continue the branch');
  expect(later.trace.echo.pass && cr(later) && cr(later).failure && cr(later).failure.class === 'commit_without_proposal', later.reply);
});

T('a syllogism Suppose, a bare Suppose, and a dynamics what-if stay on their routes', () => {
  const k = mk();
  expect(k.process('Remember that Pim is inside Quo.').trace.echo.pass, 'remember');
  const branch = k.process('Suppose Quo is inside Rub. Is Pim inside Rub?');
  expect(branch.reply === 'I answered in a branch. Yes. The checked proof supports “pim is in rub”. The branch does not change the world.', branch.reply);
  expect(branch.trace.selection.winner === 'world.proof' && ids(branch).includes('WM-WHAT-IF-BRANCH') && ids(branch).includes('WM-OBSERVED-BASE'), (branch.trace.selection && branch.trace.selection.winner) + ' ' + ids(branch).join(','));
  expect(branch.trace.intent_kind === 'SIMULATE' && branch.trace.echo.pass, branch.trace.intent_kind);
  const bare = k.process('Suppose that a dog is an animal.');
  expect(bare.trace.intent_kind === 'SIMULATE' && bare.trace.echo.pass && /dream quarantine/.test(bare.reply || '') && /not a stored fact/.test(bare.reply || ''), bare.trace.intent_kind + ' · ' + bare.reply);
  expect(k.process('Remember that frost causes cracks.').trace.echo.pass, 'frost');
  const dyn = k.process('what if there is no frost?');
  expect(dyn.trace.selection.winner === 'world.dynamics' && ids(dyn).includes('DYN-WHATIF'), (dyn.trace.selection && dyn.trace.selection.winner) + ' ' + dyn.reply);
  expect(!/I answered in a branch/.test(dyn.reply || ''), dyn.reply);
  const made = mk();
  const invent = made.process('invent a hypothesis');
  expect(invent.trace.intent_kind === 'CREATE' && invent.trace.echo.pass, invent.trace.intent_kind + ' · ' + invent.reply);
  const compose = made.process('compose that idea');
  expect(compose.trace.intent_kind === 'COMPOSE' && compose.trace.echo.pass, compose.trace.intent_kind + ' · ' + compose.reply);
  const ideas = mk().process('explore ideas');
  expect(ideas.trace.intent_kind === 'PROPOSE_EVIDENCE' && ideas.trace.echo.pass, ideas.trace.intent_kind + ' · ' + ideas.reply);
  expect(sharedN(k) === 0 && sharedN(made) === 0, 'shared KB');
});

T('version, registry, CONFLICTS, and NEXT_BUILD name 4.9.122 and leave the next creative unstarted', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  const parts = ver.split('.').map(Number);
  expect(parts[0] === 4 && parts[1] === 9 && parts[2] >= 122, ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver && reg.count === reg.features.length && reg.count >= 298, reg.version + ' ' + reg.count);
  for (const id of ['R4122-ISOLATE', 'R4122-SURFACE', 'R4122-EXIT']) {
    const f = reg.features.find(x => x.id === id);
    expect(f && f.claim === 'Partial' && (f.proof || []).includes('R4122') && /4\.9\.122/.test(f.note), id);
    expect(f && /Shared KB stays empty/.test(f.note) && !/proven cognition/.test(f.note), id + ' ' + (f && f.note));
  }
  const a11 = reg.features.find(x => x.id === 'A-11');
  expect(a11 && /4\.9\.122/.test(a11.note), a11 && a11.note);
  const tally = {}; for (const f of reg.features) tally[f.claim] = (tally[f.claim] || 0) + 1;
  expect(reg.claims.Implemented === 112 && reg.claims.Partial === tally.Partial + 1, JSON.stringify(reg.claims) + ' ' + tally.Partial);
  const cf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  const at = cf.lastIndexOf('## v4.9.122');
  expect(at > cf.lastIndexOf('## v4.9.121'), 'section');
  const sec = cf.slice(at);
  expect(/SIMULATE/.test(sec) && /counterfactual/.test(sec) && /0\.35/.test(sec) && /0\.80/.test(sec), 'bands');
  expect(/dream quarantine/.test(sec) && /shared KB stays empty|Shared KB stays empty/.test(sec), 'park');
  expect(/creative queue 120–122 complete|await Nic|do not start a new creative/i.test(sec) && !/proven cognition/.test(sec), 'queue');
  const prior = cf.slice(cf.lastIndexOf('## v4.9.121'), at);
  expect(/Suppose/.test(prior) && /not started|do not start/.test(prior), '121 history');
  const next = fs.readFileSync(ROOT + '/../NEXT_BUILD.md', 'utf8');
  expect(/4\.9\.122/.test(next) && /creative queue 120–122 complete/.test(next), 'NEXT_BUILD');
  expect(/Suppose/.test(next) && /not started|do not start/i.test(next), 'history');
  const readme = fs.readFileSync(ROOT + '/../README.md', 'utf8');
  expect(/4\.9\.122/.test(readme) && /simulation|counterfactual/.test(readme) && /speculative/.test(readme) && /0\.35/.test(readme), 'README');
  expect(!/failing-first|bot instruction/i.test(readme), 'README product');
  const targeted = JSON.parse(fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8'));
  const tp = String(targeted.release || '').split('.').map(Number);
  expect(tp[0] === 4 && tp[1] === 9 && tp[2] >= 122 && targeted.suites.includes('r4122_suite.js') && targeted.suites.includes('r4121_suite.js'), targeted.release + ' ' + targeted.suites[0]);
  const RP = require(ROOT + '/src/req_packet.js');
  const slice = RP.packet('4.9.122');
  expect(slice && slice.requirements.some(r => r.id === 'R4122-SUPPOSE'), JSON.stringify(slice && slice.requirements.map(r => r.id)));
  expect(RP.linksMissing(ROOT).length === 0, RP.linksMissing(ROOT).join(' '));
  expect(!fs.existsSync(ROOT + '/src/suppose.js'), 'suppose.js');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4122', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4122', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
