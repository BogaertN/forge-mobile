/* R4121 (4.9.121): COMPOSE governed LC narrative. Written FIRST.
 * A compose, write-out, or short-paragraph request narrates an admitted idea
 * or a selected MSM in more than one sentence. The paragraph exact-Echoes.
 * The source claim status stays the status it already has. Nothing is written
 * to memory, the world head, or the shared KB. Suppose is not this release. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [], rows = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-27T16:20:00Z';
const mk = extra => KMOD.Kernel(Object.assign({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK }, extra || {}));
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
const echoOk = r => {
  const e = r.trace.echo;
  expect(e && e.pass === true, (e && e.reason) || r.block_reason || r.reply);
  expect(e.score === 1 && e.theta === 1 && e.components && e.components.structural_identity === 1, JSON.stringify(e.components));
  expect(/structural round trip/.test(e.mode || '') && !/overlap|soft echo|word-overlap measure/.test(String(e.mode).replace('no word-overlap measure', '')), e.mode);
  expect(kRealize(r), 're-realize');
};
const kRealize = r => !r._k || r._k.realize(r.msm.meaning).text === r.reply;
const tag = (k, r) => Object.assign(r, { _k: k });
const sents = t => String(t || '').split(/(?<=[.?!])\s+/).filter(s => s.trim());
const plant = () => {
  const k = mk();
  expect(k.process('Remember that a spaniel is a dog.').trace.echo.pass, 'remember');
  expect(k.process('Remember that a dog is an animal.').trace.echo.pass, 'remember');
  const made = k.process('invent a hypothesis');
  expect(made.trace.intent_kind === 'CREATE' && made.trace.echo.pass, made.trace.intent_kind + ' · ' + made.reply);
  return k;
};
const explore = () => {
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
  const r = k.process('explore alternatives');
  expect(r.trace.intent_kind === 'EXPLORE' && r.trace.echo.pass, r.trace.intent_kind + ' · ' + r.reply);
  return k;
};

T('compose that idea with no proposal is COMPOSE and refuses commit_without_proposal', () => {
  for (const phrase of ['compose that idea', 'write it out', 'explain it as a short paragraph', 'compose the meaning', 'write the idea out']) {
    const k = mk();
    const h = head(k);
    const r = tag(k, k.process(phrase));
    expect(r.trace.intent_kind === 'COMPOSE', phrase + ' → ' + (r.trace.intent_kind || 'missing') + ' · ' + r.reply);
    echoOk(r);
    expect(cr(r) && cr(r).intent === 'COMPOSE' && cr(r).failure && cr(r).failure.class === 'commit_without_proposal', phrase + ' ' + JSON.stringify(cr(r)));
    expect(/have not stored/.test(r.reply || '') && /commit_without_proposal/.test(r.reply || ''), phrase + ' · ' + r.reply);
    expect(sents(r.reply).length >= 3, phrase + ' · ' + r.reply);
    expect(r.turn_packet.schema === 'FORGE-TURN-PACKET/v1' && r.turn_packet.packet_version === '4.9.111' && r.turn_packet.receipt_type === 'gate_refusal', phrase + ' ' + (r.turn_packet && r.turn_packet.receipt_type));
    expect(!(k.store.load('creative_proposals') || []).length, phrase + ' stored a proposal');
    quietStores(k, h, 0);
  }
});

T('a projectable idea composes to a multi-sentence paragraph that exact-Echoes and a tap still commits the record only', () => {
  const k = plant();
  const h = head(k);
  const before = k.creativeProposals();
  expect(before.length === 1 && before[0].status === 'proposed' && before[0].claim_status === 'hypothesis', JSON.stringify(before));
  const id = before[0].id;
  const claim = before[0].claim;
  for (const phrase of ['compose that idea', 'compose the idea', 'compose this idea', 'write it out', 'write that out', 'write the idea out', 'write out the idea', 'explain it as a short paragraph', 'explain that idea as a short paragraph', 'explain the idea as a short paragraph']) {
    const r = tag(k, k.process(phrase));
    expect(r.trace.intent_kind === 'COMPOSE', phrase + ' → ' + r.trace.intent_kind + ' · ' + r.reply);
    expect(r.msm.meaning.kind === 'compose_narrative' && r.msm.meaning.creative_intent === 'COMPOSE', phrase + ' ' + (r.msm.meaning && r.msm.meaning.kind));
    echoOk(r);
    expect(sents(r.reply).length >= 3 && /paragraph/.test(r.reply || ''), phrase + ' · ' + r.reply);
    expect(r.reply.includes(claim) && /hypothesis/.test(r.reply || '') && /have not stored/.test(r.reply || ''), phrase + ' · ' + r.reply);
    expect(/shared/.test(r.reply || '') && /world/.test(r.reply || ''), phrase + ' · ' + r.reply);
    expect(!/verified_claim|derived_claim|resolved_manifest|named_concept|I noted that/.test(r.reply || ''), phrase + ' · ' + r.reply);
    expect(!cr(r).failure && cr(r).intent === 'COMPOSE' && cr(r).source === 'idea', phrase + ' ' + JSON.stringify(cr(r)));
    expect((cr(r).candidates || []).some(c => c.spoken && c.id === id && c.claim_status === 'hypothesis'), phrase + ' ' + JSON.stringify(cr(r)));
    expect(r.turn_packet.receipt_type === 'answer' && r.turn_packet.packet_version === '4.9.111', phrase + ' ' + r.turn_packet.receipt_type);
    expect((r.trace.msm_v1.preservation_classes || []).includes('action_proposal_simulation_and_observation'), phrase + ' ' + JSON.stringify(r.trace.msm_v1 && r.trace.msm_v1.preservation_classes));
    expect(k.creativeProposals().every(p => p.id !== id || p.status === 'proposed'), phrase + ' committed');
    quietStores(k, h, 2);
  }
  const yes = k.commitIdea(id, true);
  expect(yes && yes.ok === true && yes.status === 'committed' && yes.wrote_memory === false && yes.wrote_world === false && yes.wrote_shared === false, JSON.stringify(yes));
  quietStores(k, h, 2, 'the tap wrote memory');
  const again = tag(k, k.process('compose that idea'));
  expect(again.trace.intent_kind === 'COMPOSE' && again.trace.echo.pass && /hypothesis/.test(again.reply || ''), again.reply);
  expect(k.creativeProposals().some(p => p.id === id && p.status === 'committed'), 'compose uncommitted the record');
  quietStores(k, h, 2);
});

T('a quarantine idea stays a speculative branch when written out and a tap still refuses it', () => {
  const k = explore();
  const h = head(k);
  const q = k.creativeProposals().find(p => p.drift && p.drift.band === 'explore' && p.status === 'proposed');
  expect(q && (q.claim_status === 'speculative_branch' || q.claim_status === 'hypothesis'), JSON.stringify(k.creativeProposals()));
  const r = tag(k, k.process('write it out'));
  expect(r.trace.intent_kind === 'COMPOSE', r.trace.intent_kind + ' · ' + r.reply);
  echoOk(r);
  expect(sents(r.reply).length >= 3 && /paragraph/.test(r.reply || '') && r.reply.includes(q.claim), r.reply);
  expect(new RegExp(q.claim_status).test(r.reply || '') && /have not stored/.test(r.reply || ''), r.reply);
  expect(!cr(r).failure && cr(r).source === 'idea' && (cr(r).candidates || []).some(c => c.spoken && c.claim_status === q.claim_status), JSON.stringify(cr(r)));
  expect(k.creativeProposals().every(p => p.status !== 'committed'), JSON.stringify(k.creativeProposals()));
  const tap = k.commitIdea(q.id, true);
  expect(tap && tap.ok === false && tap.rule === 'CREATIVE-DRIFT-NOT-PROJECTABLE', JSON.stringify(tap));
  quietStores(k, h, 4);
  const para = tag(k, k.process('explain it as a short paragraph'));
  expect(para.trace.intent_kind === 'COMPOSE' && para.trace.echo.pass && new RegExp(q.claim_status).test(para.reply || ''), para.trace.intent_kind + ' · ' + para.reply);
  expect(k.creativeProposals().every(p => p.status !== 'committed'), 'a paragraph committed the quarantine idea');
  quietStores(k, h, 4);
});

T('an unbound novelty spoken as a discovery is refused', () => {
  const k = plant();
  const h = head(k);
  const rows = k.store.load('creative_proposals');
  expect(rows.length === 1, JSON.stringify(rows));
  const claim = rows[0].claim;
  rows[0].novelty = { N: null, class: 'unbound', anchored: false };
  rows[0].claim_status = 'verified_claim';
  k.store.save('creative_proposals', rows);
  const r = tag(k, k.process('compose that idea'));
  expect(r.trace.intent_kind === 'COMPOSE' && r.msm.meaning.kind === 'compose_refusal', r.trace.intent_kind + ' · ' + (r.msm.meaning && r.msm.meaning.kind));
  echoOk(r);
  expect(cr(r) && cr(r).failure && cr(r).failure.class === 'novelty_unbound', JSON.stringify(cr(r)));
  expect(/have not stored/.test(r.reply || '') && /unbound/.test(r.reply || ''), r.reply);
  expect(!/verified_claim|derived_claim|resolved_manifest|named_concept/.test(r.reply || '') && !r.reply.includes(claim), r.reply);
  expect((cr(r).candidates || []).every(c => c.spoken === false), JSON.stringify(cr(r)));
  expect(r.turn_packet.receipt_type === 'gate_refusal', r.turn_packet.receipt_type);
  expect(k.creativeProposals()[0].status === 'proposed', JSON.stringify(k.creativeProposals()));
  quietStores(k, h, 2);
  const hardRows = k.store.load('creative_proposals');
  hardRows[0].novelty = { N: 0.5, class: 'bounded', anchored: true };
  hardRows[0].claim_status = 'hypothesis';
  hardRows[0].drift = { eps_s: 0.91, band: 'reject' };
  k.store.save('creative_proposals', hardRows);
  const hard = tag(k, k.process('write it out'));
  expect(hard.trace.intent_kind === 'COMPOSE' && hard.trace.echo.pass, hard.trace.intent_kind + ' · ' + hard.reply);
  expect(cr(hard) && cr(hard).failure && cr(hard).failure.class === 'drift_hard', JSON.stringify(cr(hard)));
  expect(/have not stored/.test(hard.reply || '') && /hard_stop/.test(hard.reply || '') && !hard.reply.includes(claim), hard.reply);
  expect(k.creativeProposals()[0].status === 'proposed', 'hard drift committed');
  quietStores(k, h, 2);
});

T('an empty claim is language_unexpressible and an Echo miss blocks the paragraph', () => {
  const bare = plant();
  const bh = head(bare);
  const rows = bare.store.load('creative_proposals');
  rows[0].claim = '';
  bare.store.save('creative_proposals', rows);
  const spoken = tag(bare, bare.process('explain it as a short paragraph'));
  expect(spoken.trace.intent_kind === 'COMPOSE' && spoken.reply, spoken.trace.intent_kind + ' · ' + spoken.block_reason);
  echoOk(spoken);
  expect(cr(spoken) && cr(spoken).failure && cr(spoken).failure.class === 'language_unexpressible', JSON.stringify(cr(spoken)));
  expect(/have not stored/.test(spoken.reply || '') && /language_unexpressible/.test(spoken.reply || ''), spoken.reply);
  expect(spoken.turn_packet.receipt_type === 'gate_refusal' && spoken.turn_packet.failure && spoken.turn_packet.failure.class === 'gate_refusal', JSON.stringify(spoken.turn_packet && spoken.turn_packet.failure));
  expect(bare.creativeProposals()[0].status === 'proposed', 'an empty claim committed');
  quietStores(bare, bh, 2);
  const k = mk({ renderFault: (text, msm) => (msm.meaning && msm.meaning.kind === 'compose_narrative' ? String(text).replace(/paragraph/g, 'story') : text) });
  expect(k.process('Remember that a spaniel is a dog.').trace.echo.pass, 'remember');
  expect(k.process('Remember that a dog is an animal.').trace.echo.pass, 'remember');
  expect(k.process('invent a hypothesis').trace.intent_kind === 'CREATE', 'invent');
  const h = head(k);
  const n = k.memory().length;
  const blocked = k.process('compose that idea');
  expect(blocked.reply == null && blocked.trace.blocked === true, blocked.reply);
  expect(blocked.trace.intent_kind === 'COMPOSE', blocked.trace.intent_kind);
  expect(blocked.trace.language === 'LANGUAGE_UNEXPRESSIBLE', blocked.trace.language || blocked.trace.block_reason);
  expect(blocked.trace.echo && blocked.trace.echo.pass === false, JSON.stringify(blocked.trace.echo));
  expect(blocked.turn_packet.receipt_type === 'echo_fail' && blocked.turn_packet.schema === 'FORGE-TURN-PACKET/v1', blocked.turn_packet && blocked.turn_packet.receipt_type);
  expect(k.creativeProposals().every(p => p.status === 'proposed'), JSON.stringify(k.creativeProposals()));
  quietStores(k, h, n);
});

T('compose that meaning narrates the selected MSM and does not open an idea record', () => {
  const k = mk();
  const noted = k.process('Remember that a spaniel is a dog.');
  expect(noted.trace.echo.pass && noted.trace.intent_kind === 'REQUEST_COMMIT', noted.trace.intent_kind + ' · ' + noted.reply);
  const h = head(k);
  const r = tag(k, k.process('compose that meaning'));
  expect(r.trace.intent_kind === 'COMPOSE', r.trace.intent_kind + ' · ' + r.reply);
  expect(r.msm.meaning.kind === 'compose_narrative', r.msm.meaning && r.msm.meaning.kind);
  echoOk(r);
  expect(sents(r.reply).length >= 3 && /paragraph/.test(r.reply || '') && /meaning/.test(r.reply || ''), r.reply);
  expect(/I noted that a spaniel is a dog/.test(r.reply || '') && /stored/.test(r.reply || '') && /have not stored/.test(r.reply || ''), r.reply);
  expect(/shared/.test(r.reply || '') && /world/.test(r.reply || ''), r.reply);
  expect(!cr(r).failure && cr(r).source === 'msm' && cr(r).msm_id, JSON.stringify(cr(r)));
  expect((r.trace.msm_v1.preservation_classes || []).includes('action_proposal_simulation_and_observation'), JSON.stringify(r.trace.msm_v1 && r.trace.msm_v1.preservation_classes));
  expect(!(k.creativeProposals() || []).length, JSON.stringify(k.creativeProposals()));
  quietStores(k, h, 1);
  const out = tag(k, k.process('write the meaning out'));
  expect(out.trace.intent_kind === 'COMPOSE' && out.trace.echo.pass && cr(out).source === 'msm', out.trace.intent_kind + ' · ' + out.reply);
  const para = tag(k, k.process('explain the meaning as a short paragraph'));
  expect(para.trace.intent_kind === 'COMPOSE' && para.trace.echo.pass && /stored/.test(para.reply || ''), para.trace.intent_kind + ' · ' + para.reply);
  expect(k.memory().length === 1 && !(k.creativeProposals() || []).length, 'meaning compose wrote');
  quietStores(k, h, 1);
});

T('CREATE, EXPLORE, READ, PROPOSE_EVIDENCE, and SIMULATE stay on their own intents', () => {
  const k = mk();
  const invent = k.process('invent a hypothesis');
  expect(invent.trace.intent_kind === 'CREATE' && invent.trace.echo.pass, invent.trace.intent_kind + ' · ' + invent.reply);
  const alt = k.process('explore alternatives');
  expect(alt.trace.intent_kind === 'EXPLORE' && alt.trace.echo.pass, alt.trace.intent_kind + ' · ' + alt.reply);
  const ideas = k.process('explore ideas');
  expect(ideas.trace.intent_kind === 'PROPOSE_EVIDENCE' && ideas.trace.echo.pass, ideas.trace.intent_kind + ' · ' + ideas.reply);
  const q = k.process('What is an idea?');
  expect(q.trace.intent_kind === 'READ' && q.trace.echo.pass, q.trace.intent_kind + ' · ' + q.reply);
  const show = k.process('explain the proposals');
  expect(show.trace.intent_kind === 'PROPOSE_EVIDENCE' && show.trace.echo.pass, show.trace.intent_kind + ' · ' + show.reply);
  const bare = k.process('explain the idea');
  expect(bare.trace.intent_kind === 'EXPLAIN' && bare.trace.intent_kind !== 'COMPOSE', bare.trace.intent_kind + ' · ' + bare.reply);
  const sup = k.process('Suppose that a dog is an animal.');
  expect(sup.trace.intent_kind === 'SIMULATE' && sup.trace.echo.pass && /dream quarantine/.test(sup.reply || ''), sup.trace.intent_kind + ' · ' + sup.reply);
  const seal = mk().process('seal the idea');
  expect(seal.trace.intent_kind === 'CREATE' && cr(seal) && cr(seal).failure && cr(seal).failure.class === 'commit_without_proposal', seal.trace.intent_kind + ' · ' + seal.reply);
  expect(sharedN(k) === 0, 'shared KB');
});

T('version, registry, CONFLICTS, and NEXT_BUILD name 4.9.121 and leave Suppose unstarted', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  const parts = ver.split('.').map(Number);
  expect(parts[0] === 4 && parts[1] === 9 && parts[2] >= 121, ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver && reg.count === reg.features.length, reg.version + ' ' + reg.count);
  for (const id of ['R4121-INTENT', 'R4121-PROSE', 'R4121-CUSTODY']) {
    const f = reg.features.find(x => x.id === id);
    expect(f && f.claim === 'Partial' && (f.proof || []).includes('R4121') && /4\.9\.121/.test(f.note), id);
    expect(f && /Shared KB stays empty/.test(f.note) && !/proven cognition/.test(f.note), id + ' ' + (f && f.note));
  }
  const a11 = reg.features.find(x => x.id === 'A-11');
  expect(a11 && /4\.9\.120/.test(a11.note) && /4\.9\.121/.test(a11.note), a11 && a11.note);
  const tally = {}; for (const f of reg.features) tally[f.claim] = (tally[f.claim] || 0) + 1;
  expect(reg.claims.Implemented === 112 && reg.claims.Partial === tally.Partial + 1, JSON.stringify(reg.claims) + ' ' + tally.Partial);
  const cf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  const at = cf.lastIndexOf('## v4.9.121');
  expect(at > cf.lastIndexOf('## v4.9.120'), 'section');
  const sec = cf.slice(at);
  expect(/COMPOSE/.test(sec) && /0\.35/.test(sec) && /0\.80/.test(sec), 'bands');
  expect(/Suppose/.test(sec) && /not started|do not start/.test(sec), 'queue');
  expect(/Shared KB stays empty/.test(sec) && !/proven cognition/.test(sec), 'shared');
  const next = fs.readFileSync(ROOT + '/../NEXT_BUILD.md', 'utf8');
  expect(/4\.9\.121/.test(next) && /4\.9\.122/.test(next) && /Suppose/.test(next) && /not started|do not start/i.test(next), 'NEXT_BUILD');
  const readme = fs.readFileSync(ROOT + '/../README.md', 'utf8');
  expect(/4\.9\.121/.test(readme) && /paragraph/.test(readme) && /hypothesis/.test(readme) && /0\.35/.test(readme), 'README');
  expect(!/failing-first|bot instruction/i.test(readme), 'README product');
  const targeted = JSON.parse(fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8'));
  const tp = String(targeted.release || '').split('.').map(Number);
  expect(tp[0] === 4 && tp[1] === 9 && tp[2] >= 121 && targeted.suites.includes('r4121_suite.js') && targeted.suites.includes('r4120_suite.js'), targeted.release + ' ' + targeted.suites[0]);
  const RP = require(ROOT + '/src/req_packet.js');
  const slice = RP.packet('4.9.121');
  expect(slice && slice.requirements.some(r => r.id === 'R4121-COMPOSE'), JSON.stringify(slice && slice.requirements.map(r => r.id)));
  expect(RP.linksMissing(ROOT).length === 0, RP.linksMissing(ROOT).join(' '));
  expect(!fs.existsSync(ROOT + '/src/compose.js'), 'compose.js');
  expect(!fs.existsSync(ROOT + '/src/suppose.js'), 'Suppose started');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4121', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4121', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
