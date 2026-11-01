/* R4112 (4.9.112): Doc 6 gate states are visible, and every not-selected
 * route is on the turn packet with the rejection reason already recorded.
 * Written FIRST (failing). No Doc 7 Audit overhaul, no MSM Doc 2, no naming
 * rename, no offline replay. No chatbot menu. */
const fs = require('fs');
const ROOT = require('path').join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const M = require(ROOT + '/src/kmath.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const rows = [], tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-27T00:12:00Z';
const mk = o => KMOD.Kernel(Object.assign({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK }, o || {}));
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
let TP = null, tpErr = null;
try { TP = require(ROOT + '/src/turn_packet.js'); } catch (e) { tpErr = e; }
const packetOf = r => r && (r.turn_packet || (r.trace && r.trace.turn_packet));
const needMod = () => { if (!TP) throw new Error('turn_packet.js is not loadable: ' + (tpErr && tpErr.message)); };
const summaryOf = html => { const a = html.indexOf('<summary>'), b = html.indexOf('</summary>'); return a < 0 ? '' : html.slice(a, b < 0 ? html.length : b); };

function routesComplete(r, why) {
  const p = packetOf(r);
  const sel = r.trace.selection || {};
  const routes = sel.routes || [];
  const winner = sel.winner || null;
  expect(routes.length > 1, why + ' selection.routes missing');
  const want = routes.filter(x => x && x.route && x.route !== winner);
  expect(Array.isArray(p.not_selected) && p.not_selected.length === want.length, why + ' not_selected ' + (p.not_selected || []).length + ' want ' + want.length + ' ' + JSON.stringify((p.not_selected || []).map(c => c.route)));
  expect(p.not_selected.map(c => c.route).join('|') === want.map(x => x.route).join('|'), why + ' order ' + p.not_selected.map(c => c.route).join('|'));
  const seen = new Set();
  for (const row of p.not_selected) {
    expect(row.route && row.status && row.reason && String(row.reason).trim(), why + ' empty ' + JSON.stringify(row));
    expect(!seen.has(row.route), why + ' duplicate ' + row.route);
    seen.add(row.route);
    expect(row.route !== winner && row.status !== 'selected', why + ' winner listed ' + row.route);
    const src = want.find(x => x.route === row.route);
    const cand = (sel.candidates || []).find(c => c.route === row.route && c.status && c.status !== 'selected');
    if (cand) expect(row.status === cand.status && row.reason === (cand.why || cand.reason), why + ' candidate reason ' + JSON.stringify(row) + ' vs ' + JSON.stringify({ s: cand.status, w: cand.why }));
    else expect(row.reason === src.why && row.status === (src.evaluated === false ? 'not_evaluated' : 'not_applicable'), why + ' route reason ' + JSON.stringify(row) + ' vs ' + JSON.stringify(src && { e: src.evaluated, w: src.why }));
  }
}





T('version, registry, CONFLICTS, and NEXT_BUILD name 4.9.112 and leave the later queue parked', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver && reg.count === reg.features.length, reg.version + ' count ' + reg.count);
  const ids = reg.features.map(f => f.id);
  expect(ids.includes('R4111-PACKET') && ids.includes('R4111-RECEIPT'), '4.9.111 rows dropped');
  expect(ids.includes('R4112-GATE') && ids.includes('R4112-CANDIDATES'), ids.slice(-4).join(','));
  for (const id of ['R4112-GATE', 'R4112-CANDIDATES']) {
    const f = reg.features.find(x => x.id === id);
    expect((f.claim === 'Partial' || (f.claim === 'Out of scope / parked' && /Retired 4\.9\.215/.test(f.note)) /* 4.9.215 C4: parked when its proof was retired */) && (f.proof || []).includes('R4112') && /4\.9\.112/.test(f.note), id + ' ' + JSON.stringify(f && f.proof));
    expect(!/Christ function/i.test(f.note), id);
  }
  const tally = {}; for (const f of reg.features) tally[f.claim] = (tally[f.claim] || 0) + 1;
  expect(reg.claims.Implemented === 112 && tally.Implemented === 113, 'implemented tally moved ' + reg.claims.Implemented + '/' + tally.Implemented);
  expect(reg.claims.Partial === tally.Partial + 1, 'partial delta moved ' + reg.claims.Partial + '/' + tally.Partial);
  const cf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  const sec = cf.slice(cf.lastIndexOf('## v4.9.112'));
  expect(/clarification-required/.test(sec) && /meaning-understood-but-action-blocked/.test(sec) && /action_blocked/.test(sec) && /unsupported/.test(sec), 'Doc 6 names missing');
  expect(/not-selected|not_selected/.test(sec) && /pattern does not apply|rejection reason/.test(sec), 'candidates missing');
  expect(/4\.9\.113|Doc 7/.test(sec) && /out of scope|do not/.test(sec), 'later queue not fenced');
  expect(!/Christ function/i.test(sec), 'Christ function');
  const next = fs.readFileSync(ROOT + '/../NEXT_BUILD.md', 'utf8');
  expect(/4\.9\.112/.test(next) && /clarification-required/.test(next) && /not-selected|not selected/.test(next), 'NEXT_BUILD does not record the gate');
  const readme = fs.readFileSync(ROOT + '/../README.md', 'utf8');
  expect(/4\.9\.112/.test(readme) && /clarification-required/.test(readme) && /not-selected|not selected/.test(readme), 'README does not name the surface');
  const targeted = fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8');
  expect(/r4112_suite\.js/.test(targeted), 'targeted gate omits this suite');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4112', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4112', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows));
  process.exit(failed ? 1 : 0);
})();
