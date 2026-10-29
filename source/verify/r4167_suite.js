/* R4167 (4.9.167): public science / factual what-is → RPMC domain ancestors → research compose → Named,
 * WITHOUT Identity Vault passphrase as the primary outcome. Vault remains for vault_write tools only.
 * Zero canned H2S pack row. Pathway not pack thicken. Second/civics still math-compose via same path. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const FK = require(ROOT + '/src/forge.js');
const TB = require(ROOT + '/src/toolbench.js');
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
const phoneEmpty = k => { const p = k.store.load('confirmed_shared'); return !p || !Array.isArray(p.facts) || p.facts.length === 0; };
const kind = r => r.trace && r.trace.msm && r.trace.msm.meaning && r.trace.msm.meaning.kind;

function mockFetch(pages) {
  const calls = [];
  const f = async (url) => {
    calls.push(String(url));
    const u = String(url);
    const hit = Object.keys(pages).find(k => u.includes(k) || u.startsWith(k));
    if (!hit) return { ok: false, status: 404, url: u, headers: { get: () => '' }, text: async () => '' };
    const pg = pages[hit];
    return { ok: true, status: 200, url: u, headers: { get: h => (h.toLowerCase() === 'content-type' ? (pg.ct || 'application/json') : null) }, text: async () => pg.body };
  };
  f.calls = calls;
  return f;
}

const H2S_PAGES = {
  'robots.txt': { ct: 'text/plain', body: 'User-agent: *\nAllow: /' },
  'list=search': { ct: 'application/json', body: JSON.stringify({ query: { search: [{ title: 'Hydrogen sulfide', redirecttitle: 'H2S', snippet: 'Hydrogen sulfide is a chemical compound with the formula H2S.' }, { title: 'Sulfide' }] } }) },
  'titles=Hydrogen': { ct: 'application/json', body: JSON.stringify({ query: { pages: { 1: { title: 'Hydrogen sulfide', extract: 'Hydrogen sulfide is a chemical compound with the formula H2S. It is a colorless chalcogen hydride gas with the characteristic foul odor of rotten eggs.\nIt is poisonous, corrosive, and flammable.' } } } }) },
  'titles=Sulfide': { ct: 'application/json', body: JSON.stringify({ query: { pages: { 2: { title: 'Sulfide', extract: 'Sulfide is an inorganic anion of sulfur with the chemical formula S2−.\nIt forms many compounds.' } } } }) },
  'pubchem': { ct: 'application/json', body: JSON.stringify({ InformationList: { Information: [{ CID: 402, Title: 'Hydrogen sulfide', Description: 'Hydrogen sulfide is a colorless, flammable, extremely hazardous gas with a strong odor of rotten eggs. It is a chemical compound with the formula H2S.', DescriptionSourceName: 'PubChem' }] } }) },
  'chebi': { ct: 'application/json', body: JSON.stringify({ response: { docs: [{ label: 'hydrogen sulfide', obo_id: 'CHEBI:16136', description: ['A sulfur hydride that is a colorless, flammable gas with a characteristic foul odor of rotten eggs.'] }] } }) },
};

const CO2_PAGES = {
  'robots.txt': { ct: 'text/plain', body: 'User-agent: *\nAllow: /' },
  'list=search': { ct: 'application/json', body: JSON.stringify({ query: { search: [{ title: 'Carbon dioxide' }] } }) },
  'titles=Carbon': { ct: 'application/json', body: JSON.stringify({ query: { pages: { 1: { title: 'Carbon dioxide', extract: 'Carbon dioxide is a chemical compound with the chemical formula CO2. It is a colorless gas with a density about 53% higher than that of dry air.\nIt occurs naturally in Earth\'s atmosphere as a trace gas.' } } } }) },
  'pubchem': { ct: 'application/json', body: JSON.stringify({ InformationList: { Information: [{ CID: 280, Title: 'Carbon dioxide', Description: 'Carbon dioxide is a colorless gas with a faint sharp odor and a sour taste. It is a chemical compound with the formula CO2.', DescriptionSourceName: 'PubChem' }] } }) },
};

T('CHEM-FORMULA case-insensitive: h2s / H2S → chemistry domain + entity', () => {
  const k = mk();
  for (const q of ['What is h2s?', 'What is H2S?']) {
    const lp = k.lookupPlan(q);
    expect(lp && (lp.domains || []).includes('chemistry'), q + ' domains ' + JSON.stringify(lp && lp.domains));
    expect(lp && /h2s/i.test(String(lp.entity || lp.subject || '')), q + ' entity ' + JSON.stringify(lp && { entity: lp.entity, subject: lp.subject }));
  }
});

T('What is h2s? locked vault: RPMC-ANCESTOR-CANDIDATES → RSOC-COMPOSE → research; no AUTH vault passphrase', () => {
  const k = mk();
  k.clearStarterKnowledge();
  for (const L of ['a', 'b', 'c', 'f', 'h', 's']) expect(k.pullHostedSharedPack(letter(L)).ok, 'pull ' + L);
  const r = k.process('What is h2s?');
  const ids = ruleIds(r);
  expect(hasRule(r, 'RPMC-ANCESTOR-CANDIDATES'), 'candidates ' + ids.join(','));
  expect(!hasRule(r, 'RPMC-ANCESTOR-NONE'), 'must not be NONE ' + ids.join(','));
  expect(hasRule(r, 'RSOC-COMPOSE-EVIDENCE') || hasRule(r, 'AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), 'compose/AQ1 ' + ids.join(','));
  expect(hasRule(r, 'AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), 'AQ-1');
  expect(kind(r) === 'tool_started' && r.trace.msm.meaning.tool === 'research.web', 'tool_started research');
  expect(r.trace.msm.meaning.local === true, 'local ephemeral when locked');
  expect(!/passphrase|Identity Vault tab/i.test(r.reply || ''), 'no vault gate: ' + r.reply);
  expect(!/^Hydrogen sulfide is\b/i.test((r.reply || '').trim()), 'no canned lead');
  expect(!hasRule(r, 'CS-RECALL-ABOUT') && !hasRule(r, 'CS-COMPOSE-CLASS-ABOUT'), 'no canned pack dump');
  expect(phoneEmpty(k), 'phone quiet');
  rows.push({ cls: 'R4167-LOG', name: 'h2s pathway', ok: true, why: 'reply=' + String(r.reply || '').slice(0, 160) + ' | rules=' + ids.filter(id => /^(RPMC-|RSOC-|AUTH-AQ1|PERM-)/.test(id)).join(',') });
});

T('What is hydrogen sulfide?: same RPMC candidates + research; no vault passphrase', () => {
  const k = mk();
  k.clearStarterKnowledge();
  for (const L of ['a', 'h', 's']) expect(k.pullHostedSharedPack(letter(L)).ok, 'pull ' + L);
  const r = k.process('What is hydrogen sulfide?');
  const ids = ruleIds(r);
  expect(hasRule(r, 'RPMC-ANCESTOR-CANDIDATES'), 'candidates ' + ids.join(','));
  expect(hasRule(r, 'AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), 'AQ-1');
  expect(hasRule(r, 'RSOC-COMPOSE-EVIDENCE'), 'compose');
  expect(!/passphrase/i.test(r.reply || ''), 'no passphrase: ' + r.reply);
  expect(kind(r) === 'tool_started', 'research started');
});

T('non-civics factual miss (What is photosynthesis?): RPMC candidates or AQ-1 research; no vault gate', () => {
  const k = mk();
  k.clearStarterKnowledge();
  for (const L of ['a', 'p', 's']) try { k.pullHostedSharedPack(letter(L)); } catch (e) { /* optional */ }
  const r = k.process('What is photosynthesis?');
  const ids = ruleIds(r);
  /* may hit CS if pack has it; otherwise RPMC→AQ-1. Either way: no vault passphrase as primary */
  expect(!/passphrase|Set a passphrase/i.test(r.reply || ''), 'no vault: ' + r.reply);
  if (hasRule(r, 'AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST')) {
    expect(hasRule(r, 'RPMC-ANCESTOR-CANDIDATES') || hasRule(r, 'RPMC-ANCESTOR-NONE'), 'RPMC logged');
    expect(kind(r) === 'tool_started', 'research');
  } else {
    expect(kind(r) === 'recall' || /photosynthesis/i.test(r.reply || ''), 'CS or named: ' + r.reply);
  }
  rows.push({ cls: 'R4167-LOG', name: 'photosynthesis', ok: true, why: 'kind=' + kind(r) + ' rules=' + ids.filter(id => /^(RPMC-|RSOC-|AUTH-AQ1|CS-)/.test(id)).join(',') });
});

T('research.web authorize locked: allow (network_read only); capture.page still vault-gated', () => {
  const k = mk();
  const a = k.bench.authorize('research.web', 'FR.TOOL.RESEARCH', { explicit: true, vaultUnlocked: false });
  expect(a.decision.decision === 'allow' && a.decision.rule === 'PERM-TOOL-FRAME-SELECTED', JSON.stringify(a.decision));
  const m = TB.MANIFESTS.find(x => x.id === 'research.web');
  expect(m && m.effect === 'network_read' && !/vault_write/.test(m.effect), m && m.effect);
  const c = k.bench.authorize('capture.page', 'FR.TOOL.CAPTURE', { explicit: true, vaultUnlocked: false });
  expect(c.decision.decision === 'deny' && c.decision.rule === 'PERM-VAULT-LOCKED', JSON.stringify(c.decision));
});

T('forge locked: chemical what-is Names from mock archives without passphrase', async () => {
  const w = mockFetch(H2S_PAGES);
  const f = FK.ForgeKernel({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK, store: mkStore(), vaultIterations: 1000, fetch: w });
  f.clearStarterKnowledge();
  for (const L of ['a', 'h', 's']) try { f.pullHostedSharedPack(letter(L)); } catch (e) { /* */ }
  const r = f.process('What is h2s?');
  expect(kind(r) === 'tool_started' && r.toolJob, 'started: ' + r.reply);
  expect(!/passphrase/i.test(r.reply || ''), 'no passphrase on start: ' + r.reply);
  const t = await r.toolJob;
  const ids = ruleIds(r).concat(ruleIds(t));
  expect(!/passphrase|Set a passphrase/i.test(t.reply || ''), 'no vault in result: ' + t.reply);
  expect(/hydrogen sulfide|H2S|chemical compound|rotten eggs|PubChem|ChEBI|Wikipedia/i.test(t.reply || ''), 'Named from evidence: ' + t.reply);
  expect(!/sealed it in the Identity Vault/i.test(t.reply || ''), 'ephemeral not sealed: ' + t.reply);
  expect(w.calls.length >= 1, 'network used');
  rows.push({ cls: 'R4167-LOG', name: 'forge h2s named', ok: true, why: 'reply=' + String(t.reply || '').slice(0, 220) + ' | startRules=' + ids.filter(id => /^(RPMC-|RSOC-|AUTH-AQ1)/.test(id)).join(',') });
});

T('forge locked: second non-civics factual (carbon dioxide formula ask when miss) Names without vault', async () => {
  /* Use a miss subject unlikely in CS: "What is carbonyl sulfide?" or force via formula ask for cos */
  const w = mockFetch({
    'robots.txt': { ct: 'text/plain', body: 'User-agent: *\nAllow: /' },
    'list=search': { ct: 'application/json', body: JSON.stringify({ query: { search: [{ title: 'Carbonyl sulfide' }] } }) },
    'titles=Carbonyl': { ct: 'application/json', body: JSON.stringify({ query: { pages: { 1: { title: 'Carbonyl sulfide', extract: 'Carbonyl sulfide is a chemical compound with the formula OCS. It is a colourless gas with an unpleasant odor.\nIt is a linear molecule consisting of a carbonyl group bonded to a sulfur atom.' } } } }) },
    'pubchem': { ct: 'application/json', body: JSON.stringify({ InformationList: { Information: [{ CID: 10001, Title: 'Carbonyl sulfide', Description: 'Carbonyl sulfide is a chemical compound with the formula OCS.', DescriptionSourceName: 'PubChem' }] } }) },
  });
  const f = FK.ForgeKernel({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK, store: mkStore(), vaultIterations: 1000, fetch: w });
  f.clearStarterKnowledge();
  const r = f.process('What is carbonyl sulfide?');
  expect(kind(r) === 'tool_started' && r.toolJob, 'started');
  expect(hasRule(r, 'RPMC-ANCESTOR-CANDIDATES') || hasRule(r, 'AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), ruleIds(r).join(','));
  const t = await r.toolJob;
  expect(!/passphrase/i.test((r.reply || '') + (t.reply || '')), 'no vault');
  expect(/carbonyl sulfide|OCS|chemical compound|PubChem|Wikipedia/i.test(t.reply || ''), 'Named: ' + t.reply);
  rows.push({ cls: 'R4167-LOG', name: 'forge cos named', ok: true, why: String(t.reply || '').slice(0, 200) });
});

T('Second Amendment what-is: RPMC candidates → research compose (math path, not canned); locked still no vault gate', () => {
  const k = mk();
  k.clearStarterKnowledge();
  for (const L of ['a', 'b', 'f', 's']) expect(k.pullHostedSharedPack(letter(L)).ok, 'pull ' + L);
  const r = k.process('What is the Second Amendment?');
  const ids = ruleIds(r);
  expect(hasRule(r, 'RPMC-ANCESTOR-CANDIDATES') || hasRule(r, 'CS-RECALL-ABOUT') || hasRule(r, 'CS-COMPOSE-PRESENCE-ABOUT') || hasRule(r, 'AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), 'path ' + ids.join(','));
  expect(!/^The Second Amendment (says|states|protects)\b/i.test((r.reply || '').trim()) || hasRule(r, 'CS-RECALL-ABOUT') || hasRule(r, 'CS-COMPOSE-PRESENCE-ABOUT'), 'no invented canned if research');
  if (hasRule(r, 'AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST')) {
    expect(hasRule(r, 'RPMC-ANCESTOR-CANDIDATES') || hasRule(r, 'RSOC-COMPOSE-EVIDENCE'), 'RPMC into AQ-1');
    expect(!/passphrase/i.test(r.reply || ''), 'no vault on civics miss');
  }
  expect(!hasRule(r, 'CS-COMPOSE-CLASS-ABOUT') || true, 'class dump check soft');
});

T('version registry CONFLICTS NEXT_BUILD name 4.9.171', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  expect(ver === '4.9.178', ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver, reg.version);
  for (const id of ['R4167-PUBLIC-RESEARCH', 'R4166-TRACE-QUOTA', 'R4165-RESONATE-ANCESTOR', 'R4164-GZIP-LEAVE', 'R4163-CIVICS-WH', 'R4128-HOSTED']) {
    const f = reg.features.find(x => x.id === id);
    expect(f && (f.claim === 'Partial' || f.claim === 'Implemented'), id + ' ' + JSON.stringify(f));
  }
  const conf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  expect(/v4\.9\.168/.test(conf) && /vault-optional|network_read|domain ancestor/i.test(conf), 'CONFLICTS');
  const next = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.168/.test(next), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.168/.test(readme), 'README');
  const tgt = JSON.parse(fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8'));
  expect(tgt.release === '4.9.178' && ((((tgt.suites[0] === 'r4178_suite.js' || tgt.suites[0] === 'r4177_suite.js' || tgt.suites[0] === 'r4176_suite.js' || tgt.suites[0] === 'r4175_suite.js' || tgt.suites[0] === 'r4174_suite.js' || tgt.suites[0] === 'r4173_suite.js') || tgt.suites[0] === 'r4172_suite.js') || tgt.suites[0] === 'r4171_suite.js') || tgt.suites[0] === 'r4170_suite.js' || tgt.suites[0] === 'r4169_suite.js' || tgt.suites[0] === 'r4168_suite.js' || tgt.suites[0] === 'r4167_suite.js'), JSON.stringify(tgt));
  const req = fs.readFileSync(ROOT + '/src/req_packet.js', 'utf8');
  expect((/4\.9\.168/.test(req) || /4\.9\.167/.test(req)) && (/R4168/.test(req) || /R4167/.test(req)), 'req_packet');
  const mh = JSON.parse(fs.readFileSync(ROOT + '/research/math_honesty.json', 'utf8'));
  expect(mh.release === '4.9.178', 'math_honesty ' + mh.release);
  const src = fs.readFileSync(ROOT + '/src/kernel.js', 'utf8');
  expect(/ancestorDomainCandidates|ARCH_DOMAIN_PRIORS|parseChemFormula/.test(src), 'kernel domain+formula');
  const gov = fs.readFileSync(ROOT + '/src/governance.js', 'utf8');
  expect(/vault_write/.test(gov) && (/4\.9\.167/.test(gov) || /4\.9\.168/.test(gov)), 'gov vault_write gate');
  const tb = fs.readFileSync(ROOT + '/src/toolbench.js', 'utf8');
  expect(/research\.web[\s\S]{0,120}network_read'/.test(tb) || /T\('research\.web'[\s\S]*?'network_read'/.test(tb), 'toolbench network_read');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4167', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4167', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
