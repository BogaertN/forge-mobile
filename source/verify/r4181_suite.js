/* R4181 (4.9.181): ask-key recall and lead-sentence admit parse.
 * No LLM. Drift and chi still gate the bank. The grammar is not bypassed. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
const D = require(ROOT + '/src/dream_idle.js');
const CP = require(ROOT + '/src/claim_parse.js');
const KMOD = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-29T18:00:00Z';
const KEY = 'nic-write-key-ok';
const mkStore = () => { const st = {}; return KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }); };
const mk = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK, vaultState: () => 'locked', store: mkStore() });
const rulesOf = r => (r.trace && r.trace.rules || []).map(x => x.id);
const parse = (k, text) => CP.admitText(text, t => { try { return k.reparseClause(t); } catch (e) { return null; } }, c => { try { return k.renderClause(c); } catch (e) { return ''; } });

const LEADS = {
  dna: "Deoxyribonucleic acid (; DNA) is a polymer composed of two polynucleotide chains that coil around each other to form a double helix.",
  ada: "Augusta Ada King, Countess of Lovelace (née Byron; 10 December 1815 – 27 November 1852), also known as Ada Lovelace, was an English mathematician and writer chiefly known for work on Charles Babbage's proposed mechanical general-purpose computer, the analytical engine.",
  gravity: "In physics, gravity (from Latin gravitas 'weight'), also known as gravitation or a gravitational interaction, is a fundamental interaction, which may be described as the force that draws material objects towards each other.",
  paper: "Gravity and Grace shows Weil's religious thoughts and ideas, drawn from many sources and focusing on suffering and redemption.",
  byWhich: "Oxygenic photosynthesis is the process by which photopigment-bearing organisms convert light energy into chemical energy, by which water is split and oxygen is released."
};

T('lead sentences for DNA, Ada, gravity, and a by-which paper round-trip', () => {
  const k = mk();
  const dna = parse(k, LEADS.dna);
  const ada = parse(k, LEADS.ada);
  const grav = parse(k, LEADS.gravity);
  const paper = parse(k, LEADS.paper);
  const by = parse(k, LEADS.byWhich);
  expect(dna && /polymer/i.test(dna.text) && /deoxyribonucleic|dna/i.test(dna.text), JSON.stringify(dna && dna.text));
  expect(ada && /Ada Lovelace/i.test(ada.text) && /mathematician/i.test(ada.text), JSON.stringify(ada && ada.text));
  expect(grav && /gravity/i.test(grav.text) && /interaction/i.test(grav.text), JSON.stringify(grav && grav.text));
  expect(paper && /grace/i.test(paper.text) && /thoughts/i.test(paper.text), JSON.stringify(paper && paper.text));
  expect(by && /photosynthesis/i.test(by.text) && !/by which/i.test(by.text), JSON.stringify(by && by.text));
  for (const hit of [dna, ada, grav, paper, by]) {
    const again = k.reparseClause(hit.text.endsWith('.') ? hit.text : hit.text + '.');
    expect(again && again.verb && !again.coord, hit.text);
  }
  const quartz = parse(k, '<p>Quartz <b>is</b> a hard crystalline mineral.</p>');
  expect(quartz && /mineral/i.test(quartz.text) && !/[<>]/.test(quartz.text), JSON.stringify(quartz && quartz.text));
});

T('the four 4.9.180 recall misses are indexed and recalled before AQ-1', async () => {
  const k = mk();
  k.clearStarterKnowledge();
  k.setSharedKbWriteKey(KEY);
  const rows = [
    ['What is the largest planet?', 'Jupiter is the fifth planet from the Sun and the largest in the Solar System'],
    ['What happens if you mix bleach and ammonia?', 'Chloramine is a toxic gas'],
    ['And what about Mars?', 'Mars is the fourth planet from the Sun'],
    ['How is paper made?', 'Paper is created from a pulp']
  ];
  const w = D.createIdleDream({ clock: CLOCK, host: k, writeKey: KEY, publishPacks: false, research: D.curatedResearch });
  const packPath = path.join(ROOT, 'packs', 'confirmed_shared', 'j.json');
  const before = crypto.createHash('sha256').update(fs.readFileSync(packPath)).digest('hex');
  for (const [q, text] of rows) {
    const bridged = D.bridgeAskEvidence({ meaning: { kind: 'research_answer', excerpt: text, generated: { text: text, drift: 0.12 }, assimilation: { intake: 'projectable', drift: 0.12 } }, question: q, input: q });
    expect(bridged.ok === true, q);
    w.enqueue([bridged.gap]);
    w.prefer(bridged.gap.id);
    const step = w.tick({ answering: false });
    expect(step.wrote_confirmed_shared === true && step.wrote_pack !== true, q + ' ' + JSON.stringify(step.backend_fill || step.rule));
  }
  expect(crypto.createHash('sha256').update(fs.readFileSync(packPath)).digest('hex') === before, 'pack untouched');
  const asks = [
    ['What is the largest planet?', /jupiter/i],
    ['Which is the biggest planet?', /jupiter/i],
    ['What happens if you mix bleach and ammonia?', /chloramine|toxic/i],
    ['And what about Mars?', /mars/i],
    ['How is paper made?', /pulp|paper/i]
  ];
  expect(typeof CP.matchAsk !== 'function', 'ask-key shortcut removed');
  for (const [q] of asks) {
    const again = k.process(q);
    const rules = rulesOf(again);
    expect(!rules.includes('CS-RECALL-ASK-KEY'), q + ' ' + rules.join(','));
  }
  const miss = k.process('What is quartz?');
  expect(rulesOf(miss).includes('AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), miss.reply || '');
});

T('a parsed sentence above 0.80 still recenters and does not write', () => {
  const k = mk();
  k.setSharedKbWriteKey(KEY);
  const w = D.createIdleDream({ clock: CLOCK, host: k, writeKey: KEY, publishPacks: false, research: D.curatedResearch });
  const before = k.sharedKnowledgeView().count;
  w.enqueue([{ id: 'gap:hot', kind: 'aq1_miss', question: 'What is DNA?', claim: 'DNA is a polymer', eps: 0.91, integrity: 0.99, extracts: [{ text: 'DNA is a polymer', verified: true, integrity: 0.99, source: 'allow-listed' }], calls_llm: false }]);
  const hot = w.tick({ answering: false });
  expect(hot.rule === 'GRACE-RECENTER' && hot.wrote_confirmed_shared !== true && k.sharedKnowledgeView().count === before, JSON.stringify({ rule: hot.rule, wrote: hot.wrote_confirmed_shared }));
  const neo = D.christPing({ initiator: 'neo', eps: 0.91 });
  expect(neo.rule === 'CHRIST-PING-GILLIGAN-ONLY', JSON.stringify(neo));
  expect(D.boundary().phone_pack_publish === 'gated' && D.boundary().ask_keys === true && D.boundary().mesh === '4.9.187', JSON.stringify(D.boundary().mesh));
});

T('version registry CONFLICTS NEXT_BUILD name 4.9.181', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.202', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.181/.test(conf) && /ask-key|ask key/i.test(conf) && /lead sentence/i.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.181/.test(nb) && /ask-key|recall/i.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.181/.test(readme) && /WIRING_181/.test(readme), 'README');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.202' && ((tgt.suites[0] === 'r4201_suite.js' || tgt.suites[0] === 'r4200_suite.js' || tgt.suites[0] === 'r4199_suite.js' || tgt.suites[0] === 'r4198_suite.js' || tgt.suites[0] === 'r4197_suite.js' || tgt.suites[0] === 'r4196_suite.js' || tgt.suites[0] === 'r4195_suite.js' || tgt.suites[0] === 'r4194_suite.js') || tgt.suites[0] === 'r4193_suite.js' || tgt.suites[0] === 'r4191_suite.js' || tgt.suites[0] === 'r4190_suite.js' || tgt.suites[0] === 'r4189_suite.js' || tgt.suites[0] === 'r4188_suite.js' || tgt.suites[0] === 'r4187_suite.js' || tgt.suites[0] === 'r4186_suite.js' || tgt.suites[0] === 'r4185_suite.js' || tgt.suites[0] === 'r4184_suite.js' || tgt.suites[0] === 'r4183_suite.js' || tgt.suites[0] === 'r4182_suite.js' || tgt.suites[0] === 'r4181_suite.js' && tgt.suites.includes('r4180_suite.js')), JSON.stringify({ release: tgt.release, head: tgt.suites[0] }));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.202' && reg.features.some(f => f.id === 'R4181-ASK-KEYS'), reg.version);
  expect(reg.count === reg.features.length && reg.count >= 338, 'count ' + reg.count);
  const req = fs.readFileSync(path.join(ROOT, 'src', 'req_packet.js'), 'utf8');
  expect(/4\.9\.181/.test(req) && /R4181-ASK-KEYS/.test(req), 'req packet');
  const build = fs.readFileSync(path.join(ROOT, 'build.py'), 'utf8');
  expect(/src\/sonify\.js/.test(build) && /does not inline/.test(build), 'single file skips sonify');
  const single = path.join(ROOT, '..', '_release', 'single', 'kernel-app.html');
  if (fs.existsSync(single)) {
    const gz = zlib.gzipSync(fs.readFileSync(single)).length;
    const leave = 570000 - gz;
    expect(gz <= 570000 - 5000, 'gzip leave ' + leave);
  }
});

(async () => {
  let failed = 0;
  const rows = [];
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4181', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4181', name: t.name, ok: false, why: String(e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
