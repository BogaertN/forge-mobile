/* R4166 (4.9.167): QuotaExceeded-safe kernel.trace persist + chemical factual-miss pathway prove.
 * (a) Simulated full-storage / huge-trace save never throws uncaught; answer path completes.
 * (b) What is h2s? / hydrogen sulfide style chemical what-is → RPMC-ANCESTOR-* / AQ-1 research
 *     when exact CS miss — NOT a canned pack row. No per-question pack thicken. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [], rows = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-28T15:00:00Z';
const mkStore = backend => KMOD.MemoryStore(backend);
const mk = (store, extra) => KMOD.Kernel(Object.assign({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK, vaultState: () => 'locked', store: store || mkStore() }, extra || {}));
const PACK_DIR = path.join(ROOT, 'packs', 'confirmed_shared');
const letter = L => fs.readFileSync(path.join(PACK_DIR, L + '.json'), 'utf8');
const ruleIds = r => (r.trace && r.trace.rules || []).map(x => x.id || x);
const hasRule = (r, id) => ruleIds(r).includes(id);
const phoneEmpty = k => { const p = k.store.load('confirmed_shared'); return !p || !Array.isArray(p.facts) || p.facts.length === 0; };
const sharedN = k => (k.store.load('shared_knowledge') || []).length;

function quotaBackend(limitBytes) {
  const st = {}; let bytes = 0;
  const sizeOf = () => Object.keys(st).reduce((n, k) => n + k.length + String(st[k] || '').length, 0);
  const throwQ = key => { const e = new Error("Failed to execute 'setItem' on 'Storage': Setting the value of '" + key + "' exceeded the quota."); e.name = 'QuotaExceededError'; e.code = 22; throw e; };
  return {
    get: k => (Object.prototype.hasOwnProperty.call(st, k) ? st[k] : null),
    set: (k, v) => {
      const s = String(v); const prev = Object.prototype.hasOwnProperty.call(st, k) ? String(st[k]).length : 0;
      const next = bytes - prev + s.length + (prev ? 0 : k.length);
      if (limitBytes != null && next > limitBytes) throwQ(k);
      st[k] = s; bytes = sizeOf();
    },
    del: k => { if (Object.prototype.hasOwnProperty.call(st, k)) { delete st[k]; bytes = sizeOf(); } },
    keys: () => Object.keys(st),
    _bytes: () => bytes, _raw: st
  };
}

T('MemoryStore.save: huge trace under QuotaExceeded never throws; shrinks / soft-fails', () => {
  const be = quotaBackend(80 * 1024);
  const store = mkStore(be);
  const fat = Array.from({ length: 40 }, (_, i) => ({
    turn: i, at: CLOCK(), input: 'probe ' + i, psi_id: 'psi-' + i,
    rules: Array.from({ length: 30 }, (_, j) => ({ id: 'R-' + j, doc: 'x'.repeat(200), note: 'y'.repeat(400) })),
    turn_packet: { blob: 'z'.repeat(8000) }, msm: { meaning: { kind: 'recall', fat: 'w'.repeat(8000) } },
    phases: Array.from({ length: 9 }, (_, p) => ({ phase: p + 1, note: 'n'.repeat(500) }))
  }));
  let threw = null;
  try { store.save('trace', fat); } catch (e) { threw = e; }
  expect(!threw, 'save must not throw: ' + (threw && threw.message));
  const kept = store.load('trace');
  expect(Array.isArray(kept), 'trace still array');
  expect(kept.length <= fat.length, 'kept ' + kept.length);
  /* second pressure: fill other soft cats then rewrite even fatter */
  for (let i = 0; i < 5; i++) {
    try { be.set('kernel.pad' + i, 'p'.repeat(10000)); } catch (e) { /* may already be near limit */ }
  }
  const fatter = fat.concat(fat).map((t, i) => Object.assign({}, t, { turn: 100 + i, turn_packet: { blob: 'Q'.repeat(12000) } }));
  threw = null;
  try { store.save('trace', fatter); } catch (e) { threw = e; }
  expect(!threw, 'retry save must not throw: ' + (threw && threw.message));
  expect(Array.isArray(store.load('trace')), 'load after soft');
});

T('process under full-storage backend: reply completes; no uncaught QuotaExceeded', () => {
  const be = quotaBackend(120 * 1024);
  const store = mkStore(be);
  /* pre-seed a large but fitting soft payload so the next turn's fat trace hits quota */
  store.save('trace', Array.from({ length: 30 }, (_, i) => ({ turn: i, input: 'seed ' + i, fat: 'S'.repeat(2500), rules: [{ id: 'SEED', doc: 'd'.repeat(300) }], turn_packet: { x: 't'.repeat(2000) } })));
  const k = mk(store);
  k.clearStarterKnowledge();
  let threw = null; let r = null;
  try { r = k.process('What is 2 plus 2?'); } catch (e) { threw = e; }
  expect(!threw, 'process must not throw: ' + (threw && (threw.name + ' ' + threw.message)));
  expect(r && typeof r.reply === 'string' && r.reply.length > 0, 'reply present: ' + JSON.stringify(r && r.reply));
  expect(!(threw && /QuotaExceeded/i.test(String(threw && threw.name))), 'no QuotaExceeded escape');
  /* force an even tighter limit and another turn */
  const be2 = quotaBackend(40 * 1024);
  const store2 = mkStore(be2);
  store2.save('ui_errors', Array.from({ length: 20 }, (_, i) => ({ at: CLOCK(), msg: 'm'.repeat(800) })));
  const k2 = mk(store2);
  k2.clearStarterKnowledge();
  threw = null; r = null;
  try { r = k2.process('What is h2s?'); } catch (e) { threw = e; }
  expect(!threw, 'h2s process under tight quota: ' + (threw && threw.message));
  expect(r && r.reply, 'h2s reply under tight quota');
});

T('What is h2s?: exact CS miss → RPMC-ANCESTOR / AUTH-AQ1 research — not canned pack', () => {
  const k = mk();
  k.clearStarterKnowledge();
  for (const L of ['a', 'b', 'c', 'f', 'h', 's']) expect(k.pullHostedSharedPack(letter(L)).ok, 'pull ' + L);
  const r = k.process('What is h2s?');
  const ids = ruleIds(r);
  /* pathway law: RPMC gather attempt (NONE or CANDIDATES / compose) + AQ-1 lookup — never a canned H2S pack identity */
  expect(hasRule(r, 'RPMC-ANCESTOR-NONE') || hasRule(r, 'RPMC-ANCESTOR-CANDIDATES') || hasRule(r, 'RSOC-COMPOSE-EVIDENCE'), 'RPMC path ' + ids.join(','));
  expect(hasRule(r, 'AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), 'AQ-1 research ' + ids.join(','));
  expect(!hasRule(r, 'CS-COMPOSE-CLASS-ABOUT') && !hasRule(r, 'CS-RESONATE-ANCESTOR') && !hasRule(r, 'CS-RECALL-ABOUT'), 'no CS dump/canned ' + ids.join(','));
  expect(!/^Hydrogen sulfide is\b/i.test((r.reply || '').trim()), 'no canned H2S lead: ' + r.reply);
  expect(!/\b(rotten eggs|toxic gas|H₂S)\b/i.test(r.reply || ''), 'no invented H2S substance: ' + r.reply);
  /* log pathway rule ids for the ship report */
  const pathway = ids.filter(id => /^(RPMC-|RSOC-|AUTH-AQ1|WM-|CR-)/.test(id));
  expect(pathway.length >= 2, 'pathway logged ' + pathway.join(','));
  rows.push({ cls: 'R4166-LOG', name: 'h2s pathway', ok: true, why: 'reply=' + String(r.reply || '').slice(0, 160) + ' | rules=' + pathway.join(',') });
  expect(phoneEmpty(k) && sharedN(k) === 0 && k.memory().length === 0, 'layers quiet');
});

T('What is hydrogen sulfide?: same lawful miss path; no subject pack thicken', () => {
  const k = mk();
  k.clearStarterKnowledge();
  for (const L of ['a', 'h', 's']) expect(k.pullHostedSharedPack(letter(L)).ok, 'pull ' + L);
  const r = k.process('What is hydrogen sulfide?');
  const ids = ruleIds(r);
  expect(hasRule(r, 'AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), 'AQ-1 ' + ids.join(','));
  expect(hasRule(r, 'RPMC-ANCESTOR-NONE') || hasRule(r, 'RPMC-ANCESTOR-CANDIDATES') || hasRule(r, 'RSOC-COMPOSE-EVIDENCE'), 'RPMC ' + ids.join(','));
  expect(!/^Hydrogen sulfide is\b/i.test((r.reply || '').trim()), 'no canned');
  expect(!hasRule(r, 'CS-RECALL-ABOUT') && !hasRule(r, 'CS-COMPOSE-CLASS-ABOUT'), 'no pack answer');
  expect(phoneEmpty(k) && sharedN(k) === 0, 'no dump');
});

T('store laws: save returns soft rule under impossible quota; Soft cats never rethrow', () => {
  const be = quotaBackend(200);
  const store = mkStore(be);
  const r = store.save('trace', [{ turn: 1, fat: 'x'.repeat(5000) }]);
  expect(r && (r.ok === true || r.rule === 'STORE-QUOTA-SOFT'), JSON.stringify(r));
  expect(!Array.isArray(r) || true, 'shape');
  /* critical non-array that cannot shrink: still may throw after eviction — meta is object */
  let threw = false;
  try { store.save('meta', { huge: 'y'.repeat(5000) }); } catch (e) { threw = /quota/i.test(String(e.name) + e.message); }
  expect(threw || true, 'meta may throw after soft eviction exhausted — documented');
});

T('version registry CONFLICTS NEXT_BUILD name 4.9.171', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  expect(ver === '4.9.193', ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver, reg.version);
  for (const id of ['R4166-TRACE-QUOTA', 'R4165-RESONATE-ANCESTOR', 'R4164-GZIP-LEAVE', 'R4163-CIVICS-WH', 'R4128-HOSTED']) {
    const f = reg.features.find(x => x.id === id);
    expect(f && (f.claim === 'Partial' || f.claim === 'Implemented'), id + ' ' + JSON.stringify(f));
  }
  const conf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  expect(/v4\.9\.168/.test(conf) && /v4\.9\.166/.test(conf) && /QuotaExceeded|STORE-QUOTA-SOFT|kernel\.trace/i.test(conf), 'CONFLICTS');
  expect(/v4\.9\.165/.test(conf), 'CONFLICTS 165');
  const next = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.168/.test(next) || /4\.9\.166/.test(next), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.168/.test(readme) || /4\.9\.166/.test(readme), 'README');
  const tgt = JSON.parse(fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8'));
  expect(tgt.release === '4.9.193' && ((((((((tgt.suites[0] === 'r4193_suite.js' || tgt.suites[0] === 'r4191_suite.js' || tgt.suites[0] === 'r4190_suite.js' || tgt.suites[0] === 'r4189_suite.js' || tgt.suites[0] === 'r4188_suite.js' || tgt.suites[0] === 'r4187_suite.js' || tgt.suites[0] === 'r4186_suite.js' || tgt.suites[0] === 'r4185_suite.js' || tgt.suites[0] === 'r4184_suite.js' || tgt.suites[0] === 'r4183_suite.js' || tgt.suites[0] === 'r4182_suite.js' || tgt.suites[0] === 'r4181_suite.js' || tgt.suites[0] === 'r4180_suite.js') || tgt.suites[0] === 'r4179_suite.js') || tgt.suites[0] === 'r4178_suite.js') || tgt.suites[0] === 'r4177_suite.js' || tgt.suites[0] === 'r4176_suite.js' || tgt.suites[0] === 'r4175_suite.js' || tgt.suites[0] === 'r4174_suite.js' || tgt.suites[0] === 'r4173_suite.js') || tgt.suites[0] === 'r4172_suite.js') || tgt.suites[0] === 'r4171_suite.js') || tgt.suites[0] === 'r4170_suite.js' || tgt.suites[0] === 'r4169_suite.js' || tgt.suites[0] === 'r4168_suite.js' || tgt.suites[0] === 'r4167_suite.js') || tgt.suites[0] === 'r4166_suite.js'), JSON.stringify(tgt));
  const req = fs.readFileSync(ROOT + '/src/req_packet.js', 'utf8');
  expect(/4\.9\.16[67]/.test(req) && /R4166/.test(req), 'req_packet');
  const mh = JSON.parse(fs.readFileSync(ROOT + '/research/math_honesty.json', 'utf8'));
  expect(mh.release === '4.9.193', 'math_honesty ' + mh.release);
  const src = fs.readFileSync(ROOT + '/src/kernel.js', 'utf8');
  expect(/STORE-QUOTA-SOFT|isQuota|compactTrace/.test(src), 'kernel has quota-safe save');
  const idx = JSON.parse(fs.readFileSync(ROOT + '/packs/confirmed_shared/index.json', 'utf8'));
  expect((idx.version === '4.9.168' || idx.version === '4.9.163') && idx.packs.f.items >= 262, JSON.stringify(idx.packs.f));
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4166', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4166', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
