/* R4214 (4.9.214): Release C3 (Nic plan, 2026-10-31). derive and reparse leave kernel.js for the Pāṇini wording module next to
 * grammar.js (src/panini_wording.js, KPaniniWording.Wording(ctx)), with the same API and no behaviour change: the kāraka parse over
 * grammar.js, the canonical forms, G-ECONOMY / G-GIVEN compounds, the person swap, held-reading ancestry and reparseClause. The
 * per-turn derivation state (inward counts, held reading) moved with them behind resetTurnState / setHeld / rsInNow.
 * Parity: tools/c_parity.js (now with a clarification turn) equals the 4.9.211 record. No LLM. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
T('derive and reparse live in panini_wording.js next to grammar.js; the kernel no longer defines them', () => {
  const src = read('src/kernel.js'), mod = read('src/panini_wording.js');
  expect(/function derive\(toks, open\)/.test(mod) && !/function derive\(toks, open\)/.test(src), 'sentence derive moved (the lexicon\'s word derive(w, check) stays in kernel.js)');
  for (const n of ['reparseClause', 'reparseClause0', 'economy', 'givenCompound', 'canonPred', 'canonNPs']) {
    expect(new RegExp('function ' + n + '\\(').test(mod), 'module defines ' + n); expect(!new RegExp('function ' + n + '\\(').test(src), 'kernel still defines ' + n); }
  expect(/G\.Parser\(content\(toks\)/.test(mod) && /\.Wording\(\{/.test(src) && typeof require(ROOT + '/src/panini_wording.js').Wording === 'function', 'wiring');
  expect(!/\blet (rsIn|heldNow)\b/.test(src) && /resetTurnState\(\)/.test(src), 'per-turn derivation state moved with derive');
});
T('the kernel API for derive and reparse is unchanged', () => {
  const K = require(ROOT + '/src/kernel.js'); const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
  const k = K.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-31T20:00:00Z' });
  for (const n of ['derive', 'deriveSource', 'reparseClause', 'reparseSource']) expect(typeof k[n] === 'function', n);
  const c = K.parseClause('my car is red'); expect(c && K.renderClause(c) === 'your car is red', 'parse/render ' + (c && K.renderClause(c)));
  const r = K.parseRenderedClause('your car is red'); expect(r && K.renderClause(r) === 'your car is red', 'reparse');
  expect(k.derive('the dog chased the cat').parses.length >= 1, 'derive');
});
T('the phone loads panini_wording.js after grammar.js and before kernel.js; the service worker precaches it', () => {
  const html = read('index.html'), sw = read('sw.js'); const i = n => html.indexOf('src="src/' + n + '"');
  expect(i('grammar.js') > 0 && i('grammar.js') < i('panini_wording.js') && i('panini_wording.js') < i('kernel.js'), 'order');
  expect(sw.indexOf("'./src/panini_wording.js'") > 0, 'sw');
});
T('no behaviour change: the parity transcript equals the 4.9.211 record byte for byte', () => {
  const now = cp.execFileSync(process.execPath, [path.join(ROOT, 'tools', 'c_parity.js')], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const rec = read('data/c_parity_211.json');
  if (now !== rec) { const a = JSON.parse(now), b = JSON.parse(rec); throw new Error('differs: ' + Object.keys(b).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])).join(',')); }
  expect(JSON.parse(rec).turns.some(t => t.kind === 'clarify_readings'), 'the record includes a clarification turn');
});
T('the cold 60 for 4.9.214 is recorded (not tuned)', () => {
  const c = JSON.parse(read('data/cold_214_results.json'));
  expect(/^4\.9\.214$/.test(c.release) && c.tuned === false && c.of === 60 && c.false_admits === 0 && c.calls_llm === false && c.admitted + c.held === 60, JSON.stringify({ a: c.admitted, h: c.held }));
});
T('version registry names 4.9.214', () => {
  expect(/^4\.9\.21[4-9]$/.test(read('VERSION').trim()), 'VERSION');
  expect(JSON.stringify(JSON.parse(read('data/feature_registry.json'))).indexOf('R4214-') >= 0, 'registry');
});
(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4214', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4214', name: t.name, ok: false, why: String(e && e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
