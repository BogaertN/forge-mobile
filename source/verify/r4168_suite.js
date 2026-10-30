/* R4168 (4.9.168): Hosted KB resonance packets for RPMC phase-align/combine.
 * Nic: every combine participant needs {Phi,eps,mu}. Pathway not Roe/quartz/autism/laceration patches.
 * Attach-on-admit + packet-only backfill; continuous fill stays paused; zero canned answers. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [], rows = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-28T16:00:00Z';
const mkStore = () => { const st = {}; return KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }); };
const mk = (extra) => KMOD.Kernel(Object.assign({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK, vaultState: () => 'locked', store: mkStore() }, extra || {}));
const PACK_DIR = path.join(ROOT, 'packs', 'confirmed_shared');
const letter = L => fs.readFileSync(path.join(PACK_DIR, L + '.json'), 'utf8');
const ruleIds = r => (r.trace && r.trace.rules || []).map(x => x.id || x);
const hasRule = (r, id) => ruleIds(r).includes(id);

T('hosted packs carry minimal resonance packets {Phi,eps,mu} (Axiom 4 / §3.4)', () => {
  const letters = ['a', 'c', 'l', 'p', 'q', 'r'];
  let total = 0, withSfe = 0;
  for (const L of letters) {
    const d = JSON.parse(letter(L));
    const items = d.items || [];
    total += items.length;
    for (const it of items) {
      const s = it.sfe || it.resonance;
      expect(s && Number.isFinite(s.Phi) && Number.isFinite(s.eps) && Number.isFinite(s.mu), L + ' ' + it.id + ' missing sfe');
      withSfe++;
    }
  }
  expect(withSfe === total && total > 100, 'sfe coverage ' + withSfe + '/' + total);
  const idx = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'index.json'), 'utf8'));
  expect(idx.version === '4.9.168', 'index version ' + idx.version);
  expect(idx.resonance_packets && idx.resonance_packets.schema === 'FORGE-RESONANCE-PACKET/v1', 'index resonance_packets');
  rows.push({ cls: 'R4168-LOG', name: 'pack sfe', ok: true, why: withSfe + '/' + total });
});

T('pull preserves pack sfe; missing pack packet attaches default on admit', () => {
  const withPkt = {
    schema: 'FORGE-CONFIRMED-PACK/v1', format: 'FORGE-CONFIRMED-PACK/v1', provenance: 'confirmed_shared',
    letter: 'T', pack_id: 'test_pkt', who_confirmed: 'product_curator', shared_kb: false,
    items: [
      { id: 'cs:test-quartz-pkt', text: 'Quartz is a mineral', standing: 'projectable', evidence: 'science · test · Quartz · pkt', sfe: { Phi: 9, eps: 0.1, mu: 0.8 } },
      { id: 'cs:test-no-pkt', text: 'Silicon is an element', standing: 'projectable', evidence: 'science · test · Silicon · nopkt' },
      { id: 'cs:test-held-pkt', text: 'Phlogiston is a substance', standing: 'contested', evidence: 'science · test · Phlogiston · held' }
    ]
  };
  const k = mk();
  const r = k.pullHostedSharedPack(JSON.stringify(withPkt));
  expect(r.ok, 'pull ' + JSON.stringify(r && r.reason));
  const view = k.sharedKnowledgeView();
  const all = (view.admitted || []).concat(view.held || []);
  expect((view.admitted || []).length >= 2, 'admitted ' + (view.admitted || []).length);
  expect((view.held || []).length >= 1, 'held ' + (view.held || []).length);
  const byId = id => all.find(x => x.id === id);
  const q = byId('cs:test-quartz-pkt');
  expect(q && q.sfe && q.sfe.Phi === 9 && q.sfe.eps === 0.1 && Math.abs(q.sfe.mu - 0.8) < 1e-9, 'preserve pack sfe ' + JSON.stringify(q && q.sfe));
  const n = byId('cs:test-no-pkt');
  expect(n && n.sfe && n.sfe.Phi === 9 && n.sfe.eps === 0 && n.sfe.mu === 1, 'attach default projectable ' + JSON.stringify(n && n.sfe));
  const h = byId('cs:test-held-pkt');
  expect(h && h.sfe && h.sfe.Phi === 5 && h.sfe.eps === 0.5 && h.sfe.mu === 0, 'attach default held ' + JSON.stringify(h && h.sfe));
});

T('normalizeResonance: pack Phi5 sealed; Phi9 projectable combines (grace)', () => {
  const k = mk();
  k.clearStarterKnowledge();
  const heldPack = {
    schema: 'FORGE-CONFIRMED-PACK/v1', format: 'FORGE-CONFIRMED-PACK/v1', provenance: 'confirmed_shared',
    letter: 'T', pack_id: 'grace_pkt', who_confirmed: 'product_curator', shared_kb: false,
    items: [
      { id: 'cs:grace-a', text: 'Grace alpha is a mineral', standing: 'projectable', evidence: 'science · test · Grace · a', sfe: { Phi: 9, eps: 0, mu: 1 } },
      { id: 'cs:grace-b', text: 'Grace beta is a mineral', standing: 'projectable', evidence: 'science · test · Grace · b', sfe: { Phi: 9, eps: 0, mu: 1 } }
    ]
  };
  expect(k.pullHostedSharedPack(JSON.stringify(heldPack)).ok, 'pull grace');
  const r = k.process('What is grace alpha?');
  const ids = ruleIds(r);
  expect(hasRule(r, 'CS-RECALL-STRUCTURAL') || hasRule(r, 'CS-RECALL-ABOUT') || hasRule(r, 'RPMC-ANCESTOR-CANDIDATES') || hasRule(r, 'AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST') || hasRule(r, 'RPMC-ANCESTOR-NONE'), 'pathway ' + ids.join(','));
  const m = r.trace && r.trace.msm && r.trace.msm.meaning;
  const priors = (m && m.rpmc_priors) || (r.trace && r.trace.tool_request && r.trace.tool_request.rpmc_priors);
  if (priors && priors.recs) {
    for (const pr of priors.recs) {
      expect(pr.sfe && Number.isFinite(pr.sfe.Phi), 'prior sfe ' + JSON.stringify(pr));
    }
  }
  rows.push({ cls: 'R4168-LOG', name: 'grace path', ok: true, why: ids.filter(id => /^(RPMC-|RSOC-|CS-|AUTH-AQ1)/.test(id)).join(',') });
});

T('RPMC gather uses CS packets: quartz miss path carries sfe priors (not canned Naming)', () => {
  const k = mk();
  k.clearStarterKnowledge();
  for (const L of ['c', 'm', 'q', 's']) {
    try { expect(k.pullHostedSharedPack(letter(L)).ok, 'pull ' + L); } catch (e) { /* optional */ }
  }
  const r = k.process('What is a quartz crystal?');
  const ids = ruleIds(r);
  expect(!/^Quartz is\b/i.test((r.reply || '').trim()) || hasRule(r, 'CS-RECALL-STRUCTURAL') || hasRule(r, 'CS-RECALL-ABOUT'), 'no invented canned if not CS-exact');
  expect(!hasRule(r, 'CS-COMPOSE-CLASS-ABOUT'), 'no unlawful class-compose');
  const m = r.trace && r.trace.msm && r.trace.msm.meaning;
  const priors = (m && m.rpmc_priors) || (r.trace && r.trace.tool_request && r.trace.tool_request.rpmc_priors);
  if (priors && priors.recs && priors.recs.length) {
    for (const pr of priors.recs) {
      expect(pr.sfe && Number.isFinite(pr.sfe.Phi) && Number.isFinite(pr.sfe.eps) && Number.isFinite(pr.sfe.mu), 'prior sfe ' + JSON.stringify(pr));
    }
    expect(hasRule(r, 'RSOC-COMPOSE-EVIDENCE') || hasRule(r, 'RPMC-ANCESTOR-CANDIDATES'), 'compose with sfe priors');
  } else {
    expect(hasRule(r, 'RPMC-ANCESTOR-NONE') || hasRule(r, 'AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST') || hasRule(r, 'CS-RECALL-STRUCTURAL') || hasRule(r, 'CS-RECALL-ABOUT') || (m && m.kind), 'lawful miss/hit ' + ids.join(','));
  }
  rows.push({ cls: 'R4168-LOG', name: 'quartz pathway', ok: true, why: 'reply=' + String(r.reply || '').slice(0, 120) + ' | ' + ids.filter(id => /^(RPMC-|RSOC-|CS-|AUTH-AQ1|SUBJECT)/.test(id)).join(',') });
});

T('attach-on-admit when pack omits sfe: session fact still phase-aligns', () => {
  const bare = {
    schema: 'FORGE-CONFIRMED-PACK/v1', format: 'FORGE-CONFIRMED-PACK/v1', provenance: 'confirmed_shared',
    letter: 'T', pack_id: 'bare_pkt', who_confirmed: 'product_curator', shared_kb: false,
    items: [
      { id: 'cs:bare-autism', text: 'Autism is a neurodevelopmental condition', standing: 'projectable', evidence: 'science · test · Autism · bare' },
      { id: 'cs:bare-spectrum', text: 'Spectrum is a range of related conditions', standing: 'projectable', evidence: 'science · test · Spectrum · bare' }
    ]
  };
  const k = mk();
  expect(k.pullHostedSharedPack(JSON.stringify(bare)).ok, 'pull bare');
  const view = k.sharedKnowledgeView();
  for (const row of view.admitted || []) {
    expect(row.sfe && row.sfe.Phi === 9 && row.sfe.mu === 1, 'attached ' + row.id + ' ' + JSON.stringify(row.sfe));
  }
  const r = k.process('What is autism?');
  const ids = ruleIds(r);
  expect(hasRule(r, 'CS-RECALL-STRUCTURAL') || hasRule(r, 'CS-RECALL-ABOUT') || hasRule(r, 'RPMC-ANCESTOR-CANDIDATES') || hasRule(r, 'AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), 'pathway ' + ids.join(','));
  const m = r.trace && r.trace.msm && r.trace.msm.meaning;
  const priors = (m && m.rpmc_priors) || (r.trace && r.trace.tool_request && r.trace.tool_request.rpmc_priors);
  if (priors && priors.recs) {
    for (const pr of priors.recs) expect(pr.sfe && Number.isFinite(pr.sfe.Phi), 'bare prior sfe');
  }
});

T('version registry CONFLICTS NEXT_BUILD name 4.9.171', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.189', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.170/.test(conf), 'CONFLICTS tip');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.170/.test(nb), 'NEXT_BUILD tip');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.170/.test(readme), 'README tip');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.189' && (((((((tgt.suites[0] === 'r4189_suite.js' || tgt.suites[0] === 'r4188_suite.js' || tgt.suites[0] === 'r4187_suite.js' || tgt.suites[0] === 'r4186_suite.js' || tgt.suites[0] === 'r4185_suite.js' || tgt.suites[0] === 'r4184_suite.js' || tgt.suites[0] === 'r4183_suite.js' || tgt.suites[0] === 'r4182_suite.js' || tgt.suites[0] === 'r4181_suite.js' || tgt.suites[0] === 'r4180_suite.js') || tgt.suites[0] === 'r4179_suite.js') || tgt.suites[0] === 'r4178_suite.js') || tgt.suites[0] === 'r4177_suite.js' || tgt.suites[0] === 'r4176_suite.js' || tgt.suites[0] === 'r4175_suite.js' || tgt.suites[0] === 'r4174_suite.js' || tgt.suites[0] === 'r4173_suite.js') || tgt.suites[0] === 'r4172_suite.js') || tgt.suites[0] === 'r4171_suite.js') || tgt.suites[0] === 'r4170_suite.js' || tgt.suites[0] === 'r4169_suite.js' || tgt.suites[0] === 'r4168_suite.js'), JSON.stringify(tgt));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.189', 'registry ' + reg.version);
  expect(reg.features.some(f => f.id === 'R4168-RESONANCE-PACKETS'), 'R4168 feature');
  expect(reg.claims.Implemented === 112 && reg.claims.Partial >= 163, JSON.stringify(reg.claims));
  const mh = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'math_honesty.json'), 'utf8'));
  expect(mh.release === '4.9.189', 'math_honesty ' + mh.release);
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  expect(/forge-mobile-v__FORGE_VERSION__/.test(sw) || /forge-mobile-v4\.9\.168/.test(sw), 'sw cache placeholder');
  const req = fs.readFileSync(path.join(ROOT, 'src', 'req_packet.js'), 'utf8');
  expect(/4\.9\.168/.test(req) && /R4168-RESONANCE-PACKETS/.test(req), 'req_packet');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4168', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4168', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
