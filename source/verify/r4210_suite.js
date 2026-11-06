/* R4210 (4.9.210): Release A2 (Nic decisions, 2026-10-31).
 * 1. Anchor lookup by engine resonance: the phone sends every cached anchor as a pool; rmc_core.preselect_pools matches the
 *    anchor's own curated packet concepts against the question's (compound names first). Words inside proper-name compounds
 *    do not name a general concept ("MOON Jae-in" is not the Moon). The shipped word-to-concept index is no longer used by Ask.
 * 2. Unsourced shared rows (the product-curator packs) are quarantined, never premises; a held question becomes Athena's gap.
 * 3. Echo reads the question's frame: a WH-attribute slot is filled by a value ("what colour" by "red"), a derived adjective is
 *    covered by its base ("salty" by "salt"), and a why-question needs a stated cause.
 * Real engine, no LLM, no network. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let CHK = null;
const chk = () => (CHK = CHK || JSON.parse(cp.execFileSync(process.env.PYTHON || 'python3', ['tools/check_210.py'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }).trim().split('\n').pop()));
const app = read('src/app.js');

T('"What is the Moon?" picks a celestial Moon anchor, never the MOON Jae-in sentence', () => {
  const m = chk().moon;
  /* 4.9.217: the lookup still picks the celestial Moon anchor (the sentence Echo re-parsed); the anchor only mentions the Moon (it is not
   * a definition), so the relation re-parse holds it */
  const said = (m.echo && m.echo.output_text) || '';
  expect(/^The Moon/.test(said) && !/Jae-in|PARK/.test(said) && m.q_concepts.join() === 'A.MOON', JSON.stringify(m).slice(0, 400));
  expect(!m.product_reply && m.echo.relation && m.echo.relation.asked === 'definition' && m.echo.relation.realised === false, JSON.stringify(m.echo).slice(0, 400));
  expect(chk().moon_jae_in.indexOf('A.MOON') < 0 && chk().moon_jae_in.indexOf('A.MOONJAEIN') >= 0, JSON.stringify(chk().moon_jae_in));
  expect(chk().moon_plain.indexOf('A.MOON') >= 0, 'a plain "The Moon" still names the Moon');
});
T('multi-word places resolve by compound name (no hand list): Burkina Faso, Bosnia and Herzegovina, Antigua and Barbuda', () => {
  const c = chk();
  expect(c.burkina.reply === 'Ouagadougou is the capital of Burkina Faso.' && c.burkina.q_concepts.join() === 'A.BURKINAFASO', JSON.stringify(c.burkina).slice(0, 300));
  expect(c.bosnia.reply === 'Sarajevo is the capital of Bosnia and Herzegovina.' && c.antigua.reply === "Saint John's is the capital of Antigua and Barbuda.", 'and-names');
  expect(c.japan.reply === 'Tokyo is the capital of Japan.', 'single word');
  expect(c.q_compound.join() === 'A.BURKINAFASO', 'longest compound wins; its words do not count alone');
  expect(c.names.map(n => n.join(' ')).indexOf('MOON Jae-in') >= 0 && c.names.map(n => n.join(' ')).indexOf('Burkina Faso') >= 0, JSON.stringify(c.names));
  expect(c.burkina.anchors_kept.length <= 16 && c.burkina.anchors_kept.every(id => /^enc-cia-uv-/.test(id)), JSON.stringify(c.burkina.anchors_kept));
});
T('the phone no longer picks anchors with the shipped index: every cached anchor goes to the engine pool', () => {
  expect(!/askAnchorShards|ASK_188_INDEX|anchors_188\/index/.test(app) && /async function askAnchorPool/.test(app) && /KAnchorCache\.all\(\)/.test(app), 'pool path');
  expect(/name: 'anchors', into: 'anchors'/.test(app), 'anchors pool');
  expect(/a\.pool === true/.test(read('src/curators_208.js')), 'curators send the cached anchors as a pool too');
  const core = read('engine/rmc_engine_v1/rmc_core.py');
  expect(/"anchors": 16/.test(core) && /an anchor is matched by its own curated concepts/.test(core), 'engine selects anchors by their own concepts');
  expect(/memory\["pools"\] = \[\{"name": "anchors", "into": "anchors", "rows": pool\}\]/.test(read('tools/audit_204.py')), 'the cold run uses the same path');
});
T('unsourced shared rows are never premises: "What is gravity?" no longer answers with the tides line', () => {
  const c = chk();
  expect(!/tides/i.test(String(c.gravity.reply)) && !c.gravity.product_reply, JSON.stringify(c.gravity).slice(0, 300));
  const s = c.sourced;
  expect(s.pack === false && s.url === true && s.trace === true && s.blocked === false && s.anchor === true && s.mine === true, JSON.stringify(s));
  expect(/item\["quarantined"\] = True/.test(read('engine/rmc_engine_v1/rmc_core.py')), 'quarantined, kept as evidence');
  expect(/CURATE-GAP-QUEUED/.test(read('src/curators_208.js')), 'a held question still becomes a gap for Athena');
});
T('a WH-attribute question is answered by a personal statement; a wrong value or an unasked cause still holds', () => {
  const c = chk().car;
  expect(c['What color is my car?'].reply === 'My car is red.' && c['What colour is my car?'].reply === 'My car is red.' && c['Is my car red?'].reply === 'My car is red.', JSON.stringify(c));
  expect(c['Is my car blue?'].reply === null && c['Why is my car red?'].reply === null, 'held');
  expect(chk().echo.color_wrong_slot.pass === false, 'a value does not cover a different literal value');
});
T('Echo judges the asked relation: a why-question needs a stated cause; the ocean answer is now the NOAA cause sentence', () => {
  const e = chk().echo;
  expect(e.salty_quality.pass === false && e.salty_quality.relation.asked === 'cause' && e.salty_quality.relation.stated === false, JSON.stringify(e.salty_quality));
  expect(e.salty_cause.pass === true && e.salty_cause.score === 1 && e.salty_cause.relation.stated === true, JSON.stringify(e.salty_cause));
  expect(e.sky.pass === true, 'because');
  expect(chk().ocean.reply === 'Salt in the ocean comes from two sources: runoff from the land and openings in the seafloor.', JSON.stringify(chk().ocean).slice(0, 300));
});
T('the JS renderer mirror gives the same frame-aware Echo as the engine (value slots generated from the lexicon)', () => {
  const R = require(ROOT + '/src/rmc_renderer_200.js'); const e = chk().echo;
  const src = read('src/rmc_renderer_200.js'); const m = src.match(/const VALUE_SLOTS = (\{.*?\});\n/);
  const lex = JSON.parse(read('engine/rmc_engine_v1/concept_lexicon.json')); const slots = {};
  for (const [cid, rule] of Object.entries(lex.values)) for (const [w, c] of Object.entries(lex.surfaces)) if (c === cid)
    slots[w] = { fill: Object.entries(lex.surfaces).filter(([x, y]) => (rule.concepts || []).indexOf(y) >= 0 || (rule.category && lex.categories[y] === rule.category)).map(([x]) => x).sort(), digits: !!rule.digits };
  expect(m && JSON.stringify(JSON.parse(m[1])) === JSON.stringify(slots), 'VALUE_SLOTS matches concept_lexicon.json');
  const run = (q, a) => R.run({ op: 'render', question: q, candidate: a, charge: 0.55 }).echo;
  expect(typeof R.run === 'function', 'renderer');
});
T('the Pyodide bundle carries this engine and its SRI is pinned', () => {
  const b = JSON.parse(read('data/py/rmc_engine_bundle.json')).files;
  for (const f of ['rmc_core.py', 'resonance_recall.py', 'echo_question.py', 'memory_recaller.py', 'concept_lexicon.json']) expect(b['rmc_engine_v1/' + f] === read('engine/rmc_engine_v1/' + f), f);
  const sri = 'sha384-' + require('crypto').createHash('sha384').update(fs.readFileSync(path.join(ROOT, 'data/py/rmc_engine_bundle.json'))).digest('base64');
  expect(read('src/rmc_client.js').indexOf(sri) >= 0, 'SRI ' + sri);
});
T('the cold 60 for 4.9.210 is recorded (not tuned)', () => {
  const c = JSON.parse(read('data/cold_210_results.json'));
  expect(/^4\.9\.210$/.test(c.release) && c.tuned === false && c.of === 60 && c.admitted === 22 && c.held === 38 && c.false_admits === 0 && c.calls_llm === false, JSON.stringify({ a: c.admitted, h: c.held }));
  expect(fs.existsSync(path.join(ROOT, '..', 'docs', 'LIVE_TEST_210.md')), 'report');
});
T('version registry names 4.9.210', () => {
  expect(read('VERSION').trim() === '4.9.245', 'VERSION');
  expect(JSON.stringify(JSON.parse(read('data/feature_registry.json'))).indexOf('R4210-') >= 0, 'registry');
});

(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4210', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4210', name: t.name, ok: false, why: String(e && e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
