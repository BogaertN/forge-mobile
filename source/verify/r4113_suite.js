/* R4113 (4.9.113): Doc 7 categories are visible and kept apart.
 * Language corpus ≠ Evidence ≠ Memory ≠ Trace/receipt ≠ Authority records.
 * Presence ≠ truth. A lookup stays evidence. Written FIRST (failing).
 * No offline replay, no MSM Doc 2, no naming rename. No new knowledge store. */
const fs = require('fs');
const ROOT = require('path').join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const FK = require(ROOT + '/src/forge.js');
const M = require(ROOT + '/src/kmath.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const rows = [], tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-27T00:13:00Z';
const mk = o => KMOD.Kernel(Object.assign({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK }, o || {}));
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
let TP = null, tpErr = null;
try { TP = require(ROOT + '/src/turn_packet.js'); } catch (e) { tpErr = e; }
const packetOf = r => r && (r.turn_packet || (r.trace && r.trace.turn_packet));
const need = () => { if (!TP || !TP.doc7Of || !TP.census || !TP.categoryPanel) throw new Error('doc7 pathway missing' + (tpErr ? ': ' + tpErr.message : '')); };
const IDS = ['language_corpus', 'evidence', 'memory', 'trace_receipt', 'authority'];
const LAW = 'presence ≠ truth';

function cats(r, why) {
  need();
  const p = packetOf(r);
  const d = p && p.doc7;
  expect(d && d.law === LAW && d.knowledge_store === false, why + ' doc7 ' + JSON.stringify(d && { law: d.law, b: d.belief, k: d.knowledge_store }));
  expect(JSON.stringify(Object.keys(d.present)) === JSON.stringify(IDS), why + ' keys ' + Object.keys(d.present || {}));
  expect(d.present.trace_receipt === true, why + ' receipt missing');
  const card = TP.receiptCard(p);
  expect(card.indexOf('data-doc7-belief="' + d.belief + '"') >= 0 && card.indexOf(LAW) >= 0 && card.indexOf(d.why) >= 0, why + ' card');
  const on = IDS.filter(id => card.indexOf('data-doc7-cat="' + id + '"') >= 0);
  expect(on.length === 5, why + ' cats ' + on.join(','));
  expect((card.match(/data-doc7-belief="1"/g) || []).length === (d.belief === 'none' ? 0 : 1), why + ' belief marks');
  return d;
}





T('version, registry, CONFLICTS, and NEXT_BUILD name 4.9.113 and leave the later queue parked', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver && reg.count === reg.features.length, reg.version + ' count ' + reg.count);
  const ids = reg.features.map(f => f.id);
  expect(ids.includes('R4112-GATE') && ids.includes('R4112-CANDIDATES'), '4.9.112 rows dropped');
  expect(ids.includes('R4113-CATEGORIES') && ids.includes('R4113-BELIEF'), ids.slice(-4).join(','));
  for (const id of ['R4113-CATEGORIES', 'R4113-BELIEF']) {
    const f = reg.features.find(x => x.id === id);
    expect((f.claim === 'Partial' || (f.claim === 'Out of scope / parked' && /Retired 4\.9\.215/.test(f.note)) /* 4.9.215 C4: parked when its proof was retired */) && (f.proof || []).includes('R4113') && /4\.9\.113/.test(f.note), id + ' ' + JSON.stringify(f && f.proof));
    expect(!/Christ function/i.test(f.note), id);
  }
  const tally = {}; for (const f of reg.features) tally[f.claim] = (tally[f.claim] || 0) + 1;
  expect(reg.claims.Implemented === 112 && tally.Implemented === 113, 'implemented tally moved ' + reg.claims.Implemented + '/' + tally.Implemented);
  expect(reg.claims.Partial === tally.Partial + 1, 'partial delta moved ' + reg.claims.Partial + '/' + tally.Partial);
  const cf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  const sec = cf.slice(cf.lastIndexOf('## v4.9.113'));
  expect(/Language corpus/.test(sec) && /Evidence/.test(sec) && /Memory/.test(sec) && /Trace\/receipt/.test(sec) && /Authority records/.test(sec) && /presence ≠ truth/.test(sec), 'categories missing');
  expect(/not a knowledge store|lookup is evidence/.test(sec) && /shared KB stays empty|Shared KB stays empty/.test(sec), 'lookup law missing');
  expect(/4\.9\.114|MSM Doc 2/.test(sec) && /4\.9\.115|naming/.test(sec) && /out of scope|do not/.test(sec), 'later queue not fenced');
  expect(!/Christ function/i.test(sec), 'Christ function');
  const next = fs.readFileSync(ROOT + '/../NEXT_BUILD.md', 'utf8');
  expect(/4\.9\.113/.test(next) && /Language corpus/.test(next) && /presence ≠ truth/.test(next), 'NEXT_BUILD does not record the categories');
  const readme = fs.readFileSync(ROOT + '/../README.md', 'utf8');
  expect(/4\.9\.113/.test(readme) && /presence ≠ truth/.test(readme) && /Language corpus/.test(readme), 'README does not name the surface');
  const targeted = fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8');
  expect(/r4113_suite\.js/.test(targeted), 'targeted gate omits this suite');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4113', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4113', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows));
  process.exit(failed ? 1 : 0);
})();
