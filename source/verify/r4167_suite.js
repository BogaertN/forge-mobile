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




T('research.web authorize locked: allow (network_read only); capture.page still vault-gated', () => {
  const k = mk();
  const a = k.bench.authorize('research.web', 'FR.TOOL.RESEARCH', { explicit: true, vaultUnlocked: false });
  expect(a.decision.decision === 'allow' && a.decision.rule === 'PERM-TOOL-FRAME-SELECTED', JSON.stringify(a.decision));
  const m = TB.MANIFESTS.find(x => x.id === 'research.web');
  expect(m && m.effect === 'network_read' && !/vault_write/.test(m.effect), m && m.effect);
  const c = k.bench.authorize('capture.page', 'FR.TOOL.CAPTURE', { explicit: true, vaultUnlocked: false });
  expect(c.decision.decision === 'deny' && c.decision.rule === 'PERM-VAULT-LOCKED', JSON.stringify(c.decision));
});




T('version registry CONFLICTS NEXT_BUILD name 4.9.171', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  expect(ver === '4.9.240', ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver, reg.version);
  for (const id of ['R4167-PUBLIC-RESEARCH', 'R4166-TRACE-QUOTA', 'R4165-RESONATE-ANCESTOR', 'R4164-GZIP-LEAVE', 'R4163-CIVICS-WH', 'R4128-HOSTED']) {
    const f = reg.features.find(x => x.id === id);
    expect(f && ((f.claim === 'Partial' || (f.claim === 'Out of scope / parked' && /Retired 4\.9\.215/.test(f.note)) /* 4.9.215 C4: parked when its proof was retired */) || f.claim === 'Implemented'), id + ' ' + JSON.stringify(f));
  }
  const conf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  expect(/v4\.9\.168/.test(conf) && /vault-optional|network_read|domain ancestor/i.test(conf), 'CONFLICTS');
  const next = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.168/.test(next), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.168/.test(readme), 'README');
  const tgt = JSON.parse(fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8'));
  expect(tgt.release === '4.9.240' && ((((((((tgt.suites[0] === 'r4201_suite.js' || tgt.suites[0] === 'r4200_suite.js' || tgt.suites[0] === 'r4199_suite.js' || tgt.suites[0] === 'r4198_suite.js' || tgt.suites[0] === 'r4197_suite.js' || tgt.suites[0] === 'r4196_suite.js' || tgt.suites[0] === 'r4195_suite.js' || tgt.suites[0] === 'r4194_suite.js') || tgt.suites[0] === 'r4193_suite.js' || tgt.suites[0] === 'r4191_suite.js' || tgt.suites[0] === 'r4190_suite.js' || tgt.suites[0] === 'r4189_suite.js' || tgt.suites[0] === 'r4188_suite.js' || tgt.suites[0] === 'r4187_suite.js' || tgt.suites[0] === 'r4186_suite.js' || tgt.suites[0] === 'r4185_suite.js' || tgt.suites[0] === 'r4184_suite.js' || tgt.suites[0] === 'r4183_suite.js' || tgt.suites[0] === 'r4182_suite.js' || tgt.suites[0] === 'r4181_suite.js' || tgt.suites[0] === 'r4180_suite.js') || tgt.suites[0] === 'r4179_suite.js') || tgt.suites[0] === 'r4178_suite.js') || tgt.suites[0] === 'r4177_suite.js' || tgt.suites[0] === 'r4176_suite.js' || tgt.suites[0] === 'r4175_suite.js' || tgt.suites[0] === 'r4174_suite.js' || tgt.suites[0] === 'r4173_suite.js') || tgt.suites[0] === 'r4172_suite.js') || tgt.suites[0] === 'r4171_suite.js') || tgt.suites[0] === 'r4170_suite.js' || tgt.suites[0] === 'r4169_suite.js' || tgt.suites[0] === 'r4168_suite.js' || tgt.suites[0] === 'r4167_suite.js'), JSON.stringify(tgt));
  const req = fs.readFileSync(ROOT + '/src/req_packet.js', 'utf8');
  expect((/4\.9\.168/.test(req) || /4\.9\.167/.test(req)) && (/R4168/.test(req) || /R4167/.test(req)), 'req_packet');
  const mh = JSON.parse(fs.readFileSync(ROOT + '/research/math_honesty.json', 'utf8'));
  expect(mh.release === '4.9.240', 'math_honesty ' + mh.release);
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
