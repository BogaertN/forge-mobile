/* R4123 (4.9.123): richer COMPOSE expansion. Written FIRST.
 * A staged idea or a selected MSM becomes several Language Core sentences
 * that develop the idea (roles, relations, licensed anchors, a lexicon gloss).
 * Custody still names the claim and says it has not stored. Exact Echo only.
 * Status stays hypothesis or speculative_branch. Shared KB stays empty.
 * The confirmed-facts design Page and any shared-KB write are not this release. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [], rows = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-27T18:10:00Z';
const mk = extra => KMOD.Kernel(Object.assign({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK }, extra || {}));
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
const head = k => k.worldHead();
const sameHead = (k, h) => head(k).version_id === h.version_id && head(k).content_hash === h.content_hash;
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
const CUSTODY = /^(I composed|The paragraph states|I have not stored|I did not write|It is the status)/;
const dev = t => sents(t).filter(s => !CUSTODY.test(s));
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

T('a projectable idea expands beyond the claim into roles, anchors, and a lexicon gloss', () => {
  const k = plant();
  const h = head(k);
  const before = k.creativeProposals();
  expect(before.length === 1 && before[0].status === 'proposed' && before[0].claim_status === 'hypothesis', JSON.stringify(before));
  const id = before[0].id;
  const claim = before[0].claim;
  const r = tag(k, k.process('compose that idea'));
  expect(r.trace.intent_kind === 'COMPOSE', r.trace.intent_kind + ' · ' + r.reply);
  expect(r.msm.meaning.kind === 'compose_narrative', r.msm.meaning && r.msm.meaning.kind);
  echoOk(r);
  expect(dev(r.reply).length >= 5, 'development ' + dev(r.reply).length + ' · ' + r.reply);
  expect(/A spaniel is an animal\./.test(r.reply || ''), r.reply);
  expect(/You told me that a spaniel is a dog\./.test(r.reply || ''), r.reply);
  expect(/You told me that a dog is an animal\./.test(r.reply || ''), r.reply);
  expect(/The subject holds the role “spaniel”\./.test(r.reply || ''), r.reply);
  expect(/The relation holds the role “is a”\./.test(r.reply || ''), r.reply);
  expect(/The predicate holds the role “animal”\./.test(r.reply || ''), r.reply);
  expect(/The frame holds the role “is a”\./.test(r.reply || ''), r.reply);
  expect(/gun dogs/.test(r.reply || '') && /silky coat/.test(r.reply || ''), r.reply);
  expect(r.reply.includes(claim) && claim === 'spaniel is a animal', claim + ' · ' + r.reply);
  expect(/hypothesis/.test(r.reply || '') && /have not stored/.test(r.reply || ''), r.reply);
  expect(/shared/.test(r.reply || '') && /world/.test(r.reply || ''), r.reply);
  expect(!/verified_claim|derived_claim|resolved_manifest|named_concept|I noted that/.test(r.reply || ''), r.reply);
  expect(!/soft echo|word-overlap measure/.test(String(r.trace.echo.mode).replace('no word-overlap measure', '')), r.trace.echo.mode);
  expect(!cr(r).failure && cr(r).intent === 'COMPOSE' && cr(r).source === 'idea', JSON.stringify(cr(r)));
  expect((cr(r).candidates || []).some(c => c.spoken && c.id === id && c.claim_status === 'hypothesis'), JSON.stringify(cr(r)));
  expect(r.turn_packet.schema === 'FORGE-TURN-PACKET/v1' && r.turn_packet.packet_version === '4.9.111' && r.turn_packet.receipt_type === 'answer', r.turn_packet && r.turn_packet.receipt_type);
  expect(k.creativeProposals().every(p => p.id !== id || p.status === 'proposed'), 'compose committed');
  quietStores(k, h, 2);
  const yes = k.commitIdea(id, true);
  expect(yes && yes.ok === true && yes.wrote_memory === false && yes.wrote_world === false && yes.wrote_shared === false, JSON.stringify(yes));
  quietStores(k, h, 2, 'the tap wrote memory');
});

T('compose phrases still route to COMPOSE and each one expands the same idea', () => {
  const k = plant();
  const h = head(k);
  for (const phrase of ['compose that idea', 'write it out', 'explain it as a short paragraph', 'write the idea out', 'explain the idea as a short paragraph']) {
    const r = tag(k, k.process(phrase));
    expect(r.trace.intent_kind === 'COMPOSE', phrase + ' → ' + r.trace.intent_kind + ' · ' + r.reply);
    echoOk(r);
    expect(/A spaniel is an animal\./.test(r.reply || '') && dev(r.reply).length >= 5, phrase + ' · ' + r.reply);
    expect(/have not stored/.test(r.reply || '') && /hypothesis/.test(r.reply || ''), phrase + ' · ' + r.reply);
    quietStores(k, h, 2);
  }
});

T('a quarantine idea expands and stays non-projectable', () => {
  const k = explore();
  const h = head(k);
  const q = k.creativeProposals().find(p => p.drift && p.drift.band === 'explore' && p.status === 'proposed');
  expect(q && q.claim_status === 'speculative_branch', JSON.stringify(k.creativeProposals()));
  const r = tag(k, k.process('write it out'));
  expect(r.trace.intent_kind === 'COMPOSE', r.trace.intent_kind + ' · ' + r.reply);
  echoOk(r);
  expect(dev(r.reply).length >= 5, 'development ' + dev(r.reply).length + ' · ' + r.reply);
  expect(/You told me that Rex is a dog\./.test(r.reply || ''), r.reply);
  expect(/You told me that Fido is a dog\./.test(r.reply || ''), r.reply);
  expect(/The subject holds the role “fido”\./.test(r.reply || ''), r.reply);
  expect(/The relation holds the role “shares is a with”\./.test(r.reply || ''), r.reply);
  expect(/The predicate holds the role “rex”\./.test(r.reply || ''), r.reply);
  expect(/genus Canis/.test(r.reply || ''), r.reply);
  expect(r.reply.includes(q.claim) && /speculative_branch/.test(r.reply || '') && /have not stored/.test(r.reply || ''), r.reply);
  expect(!cr(r).failure && cr(r).source === 'idea', JSON.stringify(cr(r)));
  expect(k.creativeProposals().every(p => p.status === 'proposed'), JSON.stringify(k.creativeProposals()));
  const tap = k.commitIdea(q.id, true);
  expect(tap && tap.ok === false && tap.rule === 'CREATIVE-DRIFT-NOT-PROJECTABLE', JSON.stringify(tap));
  quietStores(k, h, 4);
});

T('compose refusals stay commit_without_proposal, novelty_unbound, drift_hard, and language_unexpressible', () => {
  for (const phrase of ['compose that idea', 'write it out', 'explain it as a short paragraph']) {
    const k = mk();
    const h = head(k);
    const r = tag(k, k.process(phrase));
    expect(r.trace.intent_kind === 'COMPOSE', phrase + ' → ' + r.trace.intent_kind);
    echoOk(r);
    expect(cr(r) && cr(r).failure && cr(r).failure.class === 'commit_without_proposal', phrase + ' ' + JSON.stringify(cr(r)));
    expect(/holds the role/.test(r.reply || '') === false, phrase + ' expanded · ' + r.reply);
    expect(!(k.creativeProposals() || []).length, phrase);
    quietStores(k, h, 0);
  }
  const k = plant();
  const h = head(k);
  const rowsP = k.store.load('creative_proposals');
  const claim = rowsP[0].claim;
  rowsP[0].novelty = { N: null, class: 'unbound', anchored: false };
  rowsP[0].claim_status = 'verified_claim';
  k.store.save('creative_proposals', rowsP);
  const unbound = tag(k, k.process('compose that idea'));
  expect(unbound.trace.intent_kind === 'COMPOSE' && unbound.msm.meaning.kind === 'compose_refusal', unbound.reply);
  echoOk(unbound);
  expect(cr(unbound).failure.class === 'novelty_unbound', JSON.stringify(cr(unbound)));
  expect(!unbound.reply.includes(claim) && /holds the role/.test(unbound.reply || '') === false, unbound.reply);
  quietStores(k, h, 2);
  const hardRows = k.store.load('creative_proposals');
  hardRows[0].novelty = { N: 0.5, class: 'bounded', anchored: true };
  hardRows[0].claim_status = 'hypothesis';
  hardRows[0].drift = { eps_s: 0.91, band: 'reject' };
  k.store.save('creative_proposals', hardRows);
  const hard = tag(k, k.process('write it out'));
  echoOk(hard);
  expect(cr(hard).failure.class === 'drift_hard' && !hard.reply.includes(claim), hard.reply);
  expect(/holds the role/.test(hard.reply || '') === false, hard.reply);
  quietStores(k, h, 2);
  const bare = plant();
  const bh = head(bare);
  const empty = bare.store.load('creative_proposals');
  empty[0].claim = '';
  bare.store.save('creative_proposals', empty);
  const spoken = tag(bare, bare.process('explain it as a short paragraph'));
  echoOk(spoken);
  expect(cr(spoken).failure.class === 'language_unexpressible', JSON.stringify(cr(spoken)));
  expect(/holds the role/.test(spoken.reply || '') === false, spoken.reply);
  quietStores(bare, bh, 2);
});

T('compose that meaning expands the selected clause and does not store', () => {
  const k = mk();
  const noted = k.process('Remember that a spaniel is a dog.');
  expect(noted.trace.echo.pass && /I noted that a spaniel is a dog/.test(noted.reply || ''), noted.reply);
  const h = head(k);
  const r = tag(k, k.process('compose that meaning'));
  expect(r.trace.intent_kind === 'COMPOSE' && r.msm.meaning.kind === 'compose_narrative', r.trace.intent_kind + ' · ' + r.reply);
  echoOk(r);
  expect(sents(r.reply).some(s => /^A spaniel is a dog\.$/.test(s)), r.reply);
  expect(/The subject holds the role “spaniel”\./.test(r.reply || ''), r.reply);
  expect(/gun dogs/.test(r.reply || ''), r.reply);
  expect(/I noted that a spaniel is a dog/.test(r.reply || '') && /meaning/.test(r.reply || ''), r.reply);
  expect(/have not stored/.test(r.reply || '') && /shared/.test(r.reply || '') && /world/.test(r.reply || ''), r.reply);
  expect(/You told me that a spaniel is a dog/.test(r.reply || '') === false, r.reply);
  expect(!(k.creativeProposals() || []).length, JSON.stringify(k.creativeProposals()));
  quietStores(k, h, 1);
});

T('an Echo miss blocks the expansion and stores nothing', () => {
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
  expect(/soft echo|word-overlap/.test(String(blocked.trace.echo.mode || '')) === false || /no word-overlap measure/.test(blocked.trace.echo.mode || ''), blocked.trace.echo.mode);
  expect(blocked.turn_packet.receipt_type === 'echo_fail' && blocked.turn_packet.packet_version === '4.9.111', blocked.turn_packet && blocked.turn_packet.receipt_type);
  expect(k.creativeProposals().every(p => p.status === 'proposed'), JSON.stringify(k.creativeProposals()));
  quietStores(k, h, n);
});

T('version, registry, CONFLICTS, and NEXT_BUILD name 4.9.123 and leave the confirmed-facts design unstarted', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  expect(ver === '4.9.123', ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver && reg.count === reg.features.length && reg.count === 301, reg.version + ' ' + reg.count);
  for (const id of ['R4123-EXPAND', 'R4123-GROUND', 'R4123-QUIET']) {
    const f = reg.features.find(x => x.id === id);
    expect(f && f.claim === 'Partial' && (f.proof || []).includes('R4123') && /4\.9\.123/.test(f.note), id);
    expect(f && /Shared KB stays empty/.test(f.note) && !/proven cognition/.test(f.note), id + ' ' + (f && f.note));
  }
  const a11 = reg.features.find(x => x.id === 'A-11');
  expect(a11 && /4\.9\.123/.test(a11.note), a11 && a11.note);
  const tally = {}; for (const f of reg.features) tally[f.claim] = (tally[f.claim] || 0) + 1;
  expect(reg.claims.Implemented === 112 && reg.claims.Partial === tally.Partial + 1, JSON.stringify(reg.claims) + ' ' + tally.Partial);
  const cf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  const at = cf.lastIndexOf('## v4.9.123');
  expect(at > cf.lastIndexOf('## v4.9.122'), 'section');
  const sec = cf.slice(at);
  expect(/COMPOSE/.test(sec) && /0\.35/.test(sec) && /0\.80/.test(sec), 'bands');
  expect(/confirmed-facts design/.test(sec) && /not started|do not start/.test(sec), 'design');
  expect(/shared KB write/.test(sec) && /not started|do not start/.test(sec), 'shared write');
  expect(/Soft Echo/.test(sec) && /exact/.test(sec) && !/proven cognition/.test(sec), 'echo');
  const next = fs.readFileSync(ROOT + '/../NEXT_BUILD.md', 'utf8');
  expect(/4\.9\.123/.test(next) && /confirmed-facts design/.test(next), 'NEXT_BUILD');
  expect(/not started|do not start/i.test(next) && /shared KB/i.test(next), 'queue');
  const readme = fs.readFileSync(ROOT + '/../README.md', 'utf8');
  expect(/4\.9\.123/.test(readme) && /paragraph/.test(readme) && /hypothesis/.test(readme) && /0\.35/.test(readme), 'README');
  expect(!/failing-first|bot instruction/i.test(readme), 'README product');
  const targeted = JSON.parse(fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8'));
  expect(targeted.release === '4.9.123' && targeted.suites[0] === 'r4123_suite.js' && targeted.suites.includes('r4122_suite.js'), targeted.release + ' ' + targeted.suites[0]);
  const RP = require(ROOT + '/src/req_packet.js');
  const slice = RP.packet('4.9.123');
  expect(slice && slice.requirements.some(r => r.id === 'R4123-COMPOSE'), JSON.stringify(slice && slice.requirements.map(r => r.id)));
  expect(RP.linksMissing(ROOT).length === 0, RP.linksMissing(ROOT).join(' '));
  expect(!fs.existsSync(ROOT + '/src/compose.js'), 'compose.js');
  expect(!fs.existsSync(ROOT + '/src/confirmed_facts.js'), 'confirmed-facts design started');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4123', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4123', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
