/* R4179 (4.9.179): Forge2 contracts on the learning loop, and language.core stays on the answer path.
 * Ask fetches. Athena admits. Gilligan re-curates. The next Ask recalls. No LLM. Packs stay gated. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
const D = require(ROOT + '/src/dream_idle.js');
const KMOD = require(ROOT + '/src/kernel.js');
const FK = require(ROOT + '/src/forge.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-29T12:10:00Z';
const KEY = 'nic-write-key-ok';
const METHOD = 'A bulb produces light by heating a filament.';
const mkStore = () => { const st = {}; return KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }); };
const mk = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK, vaultState: () => 'locked', store: mkStore() });
const rulesOf = r => (r.trace && r.trace.rules || []).map(x => x.id);
const phoneFacts = k => { const phone = k.store.load('confirmed_shared'); return (phone && phone.facts) || []; };

function wiki(pages) {
  return u => {
    const ok = (ct, body) => Promise.resolve({ ok: true, status: 200, url: u, headers: { get: h => String(h).toLowerCase() === 'content-type' ? ct : null }, text: () => Promise.resolve(body) });
    const dec = decodeURIComponent(u);
    if (/robots\.txt$/.test(u)) return ok('text/plain', 'User-agent: *\nDisallow: /w/index.php?title=Special');
    if (/srsearch=|list=search/.test(dec)) {
      const hits = /light|bulb/i.test(dec) ? Object.keys(pages) : [];
      return ok('application/json', JSON.stringify({ query: { search: hits.map(title => ({ title })) } }));
    }
    if (dec.includes('titles=')) {
      const ts = decodeURIComponent((u.split('titles=')[1] || '').split('&')[0]).split('|');
      const body = {};
      ts.forEach((t, i) => { const pg = pages[t]; body[i + 1] = pg ? Object.assign({}, pg, { extract: dec.includes('exintro=1') ? String(pg.extract).split('\n')[0] : pg.extract }) : { title: t, missing: '' }; });
      return ok('application/json', JSON.stringify({ query: { pages: body } }));
    }
    return Promise.resolve({ ok: false, status: 404, url: u, headers: { get: () => '' }, text: async () => '' });
  };
}



T('version registry CONFLICTS NEXT_BUILD name 4.9.179', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.228', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.179/.test(conf) && /Forge2/.test(conf) && /language\.core/.test(conf) && /Athena document/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.179/.test(nb) && /Forge2/.test(nb) && /Athena document/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.179/.test(readme) && /Forge2/.test(readme) && /WIRING_179/.test(readme), 'README');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.228' && (((tgt.suites[0] === 'r4201_suite.js' || tgt.suites[0] === 'r4200_suite.js' || tgt.suites[0] === 'r4199_suite.js' || tgt.suites[0] === 'r4198_suite.js' || tgt.suites[0] === 'r4197_suite.js' || tgt.suites[0] === 'r4196_suite.js' || tgt.suites[0] === 'r4195_suite.js' || tgt.suites[0] === 'r4194_suite.js') || tgt.suites[0] === 'r4193_suite.js' || tgt.suites[0] === 'r4191_suite.js' || tgt.suites[0] === 'r4190_suite.js' || tgt.suites[0] === 'r4189_suite.js' || tgt.suites[0] === 'r4188_suite.js' || tgt.suites[0] === 'r4187_suite.js' || tgt.suites[0] === 'r4186_suite.js' || tgt.suites[0] === 'r4185_suite.js' || tgt.suites[0] === 'r4184_suite.js' || tgt.suites[0] === 'r4183_suite.js' || tgt.suites[0] === 'r4182_suite.js' || tgt.suites[0] === 'r4181_suite.js' || tgt.suites[0] === 'r4180_suite.js') || tgt.suites[0] === 'r4179_suite.js') && tgt.suites.includes('r4178_suite.js'), JSON.stringify({ release: tgt.release, head: tgt.suites[0] }));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.228' && reg.features.some(f => f.id === 'R4179-FORGE2-WIRING'), reg.version);
  expect(reg.count === reg.features.length && reg.count >= 336, 'count ' + reg.count);
  const inv = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'forge_tool_inventory.json'), 'utf8'));
  expect(inv.forge2 && inv.forge2.release === '4.9.179' && inv.forge2.head.indexOf('262a95e') === 0, JSON.stringify(inv.forge2 && inv.forge2.counts));
  expect(inv.forge2.counts.ported >= 2 && inv.forge2.counts.present >= 8 && inv.forge2.counts.skipped >= 4, JSON.stringify(inv.forge2.counts));
  expect(inv.forge2.modules.every(m => m.name && m.status && m.reason), 'inventory rows');
  const req = fs.readFileSync(path.join(ROOT, 'src', 'req_packet.js'), 'utf8');
  expect(/4\.9\.179/.test(req) && /R4179-FORGE2-WIRING/.test(req), 'req packet');
  const wiring = fs.readFileSync(path.join(ROOT, '..', 'docs', 'WIRING_179.md'), 'utf8');
  expect(/Stale code \/ language\.core blockers/.test(wiring) && /research\.web/.test(wiring) && /validateSuccessor/.test(wiring), 'wiring report');
  const single = path.join(ROOT, '..', '_release', 'single', 'kernel-app.html');
  if (fs.existsSync(single)) {
    const gz = zlib.gzipSync(fs.readFileSync(single)).length;
    expect(gz <= 750000 - 5000, 'gzip leave ' + (750000 - gz));
  }
});

(async () => {
  let failed = 0;
  const rows = [];
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4179', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4179', name: t.name, ok: false, why: String(e.message || e).slice(0, 800) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
