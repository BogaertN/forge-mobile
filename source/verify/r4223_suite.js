/* R4223 (4.9.223): Athena agrees on MEANING, not spelling (Nic 2026-11-04, pt138u "different words can have the same
 * meaning ... it would cause the two things to be able to relate to each other and it would let it enter").
 * 1. Phase: a definitional question takes its phase from the subject's meaning (the pinned concept's phase; else the
 *    lexicon placement of the subject) instead of the wh-question's default. An explicit loop_phi still wins; without a
 *    meaning payload the 4.9.222 decision is unchanged (the app passes none).
 * 2. Agreement (engine/rmc_engine_v1/meaning_223.py annotates; self_seed_202 decides, Python = JS = Pyodide): two
 *    independent publishers must agree on the subject's sense and a compatible category: on the WordNet hypernym chain,
 *    more specific than the subject's genus, or a synonym / more specific category of an on-chain one. A row naming another
 *    sense, or a category that belongs to another meaning of the same word, is a contradiction and holds the fact. A
 *    category WordNet does not know is unplaced (ChEBI's own is_a path is tried first). Lesk overlap is logged only.
 * 3. GeoNames is tier 2 and never one of the two agreeing publishers. A number is its own slot (canonical digits and unit:
 *    NIST CODATA and the BIPM defining constants agree). Short complete glosses pass. A document may carry its own licence
 *    (PubChem NCI Thesaurus descriptions, CC BY 4.0, with attribution). The CIA World Factbook is read from its last
 *    edition before the shutdown (public-domain mirror pinned at one commit). IUPAC stays off.
 * 4. Dry-run only (data/athena_dryrun_223.json): nothing written to kb.anchors. Cold 60 identical to 4.9.222. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const S = require(path.join(ROOT, 'src/self_seed_202.js'));
const pyEnv = Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine'), FORGE_OEWN_DIR: path.join(ROOT, 'verify/fixtures/athena_223/oewn') });

const unit = cp.spawnSync('python3', [path.join(ROOT, 'tools/test_athena_223.py')], { cwd: ROOT, env: pyEnv, encoding: 'utf8', maxBuffer: 1 << 26 });
let unitRows = [];
try { unitRows = JSON.parse(unit.stdout); } catch (e) { unitRows = [{ name: 'python unit tests ran', ok: false, why: String(unit.stderr || unit.stdout).slice(0, 800) }]; }
for (const r of unitRows) T('unit: ' + r.name, () => expect(r.ok, r.why));
T('the unit tests ran and cover the new rules and fetchers', () => {
  const names = unitRows.map(r => r.name).join(' ');
  for (const s of ['value_canon', 'short_complete', 'category_head', 'subject_meaning', 'chain_relations', 'sense_keyed_question_phase', 'meaning_agreement', 'geonames', 'value_slot', 'licence', 'cia_factbook', 'bipm_defining_constants', 'pubchem', 'chebi']) expect(names.indexOf(s) >= 0, s);
  expect(unit.status === 0, 'python exit ' + unit.status);
});

const cases = JSON.parse(cp.execFileSync('python3', [path.join(ROOT, 'tools/meaning_cases_223.py')], { cwd: ROOT, env: pyEnv, maxBuffer: 1 << 26 }).toString());
function py(script, input) {
  const r = cp.spawnSync('python3', ['-c', script], { input: JSON.stringify(input), cwd: path.join(ROOT, 'engine'), env: pyEnv, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status) throw new Error(String(r.stderr).slice(0, 600));
  return JSON.parse(r.stdout);
}
T('every meaning / phase / value / licence decision: JS equals Python (rule, hosts, claim, loop, anchor, meaning trace)', () => {
  const payloads = cases.payloads.map(c => c.payload);
  const pyr = py('import json,sys\nfrom rmc_engine_v1.self_seed_202 import evaluate\nprint(json.dumps([evaluate(x) for x in json.load(sys.stdin)]))', payloads);
  const key = r => JSON.stringify([r.rule, r.hosts || null, r.claim || null, r.loop_phi, r.loop_from, r.anchor ? [r.anchor.text, r.anchor.license, r.anchor.provenance.origin, r.anchor.provenance.archived_from, r.anchor.provenance.independent_hosts] : null,
    (r.trace || {}).meaning || null, (r.trace || {}).kept, (r.trace || {}).echo_pass]);
  payloads.forEach((p, i) => { const js = S.evaluate(JSON.parse(JSON.stringify(p))); expect(key(js) === key(pyr[i]), cases.payloads[i].name + '\n js ' + key(js) + '\n py ' + key(pyr[i])); });
  const rules = payloads.map(p => S.evaluate(JSON.parse(JSON.stringify(p))).rule);
  for (const r of ['SEED-CANDIDATE', 'SEED-CORROBORATION', 'SEED-DISAGREEMENT', 'SEED-UNPLACED']) expect(rules.includes(r), 'covers ' + r);
});
T('value canonical form and short sentences: JS equals Python', () => {
  const pv = py('import json,sys\nfrom rmc_engine_v1.self_seed_202 import value_canon, split_sentences\nd=json.load(sys.stdin)\nprint(json.dumps([[value_canon(v) for v in d["values"]],[split_sentences(s) for s in d["sentences"]]]))', cases);
  expect(JSON.stringify(cases.values.map(S.valueCanon)) === JSON.stringify(pv[0]), JSON.stringify({ js: cases.values.map(S.valueCanon), py: pv[0] }));
  expect(JSON.stringify(cases.sentences.map(S.splitSentences)) === JSON.stringify(pv[1]), 'split');
});

T('registry 4.9.223: Factbook frozen (pinned mirror commit, original cia.gov URL), BIPM constants on, IUPAC off, GeoNames not counted', () => {
  const cfg = JSON.parse(read('engine/rmc_engine_v1/reference/athena_sources_223.json'));
  const by = Object.fromEntries(cfg.sources.map(s => [s.id, s]));
  expect(cfg.build === '4.9.223' && by.cia_factbook.enabled === true && by.cia_factbook.status === 'FROZEN' && /^783ed27f7a11/.test(by.cia_factbook.mirror_commit) && by.cia_factbook.as_of === '2026-01-22', 'factbook');
  expect(by.iupac_goldbook.enabled === false && by.bipm_constants.enabled === true && by.geonames.agreement_counts === false, 'flags');
  expect(/NCI Thesaurus/.test(by.pubchem.note) && /CC BY 4\.0/.test(cfg.attribution.nci_thesaurus), 'NCIt licence and attribution');
  const allow = JSON.parse(read('engine/rmc_engine_v1/reference/trusted_sources_202.json'));
  expect(allow.sources.find(s => s.host === 'geonames.org').agreement_counts === false, 'allowlist row');
  expect(S.sourceFor('https://download.geonames.org/export/dump/countryInfo.txt').agreement_counts === false, 'JS reads it');
});
T('live check recorded: every enabled source 3 of 3 (the frozen Factbook included), NCIt carries CC BY', () => {
  const st = JSON.parse(read('data/athena_sources_status_223.json')).sources;
  for (const [id, r] of Object.entries(st)) {
    if (!r.enabled) { expect(id === 'iupac_goldbook' && r.status === 'BLOCKED', id); continue; }
    expect(r.status === 'OK' && r.stable_3_of_3 === true, id + ' ' + r.status);
  }
  expect(/factbook\.json\/783ed27f7a11/.test(st.cia_factbook.archived_from) && /^https:\/\/www\.cia\.gov\//.test(st.cia_factbook.url), 'frozen copy');
  const nci = (st.pubchem.extra_probes || []).find(e => e.origin === 'NCI Thesaurus (NCIt)');
  expect(nci && nci.license === 'CC BY 4.0', 'NCIt probe');
});

T('dry-run recorded (4.9.222 gaps + a wider fixed sample): nothing written; meaning, category, phase, band and verdict per source; asks carry the candidate meanings', () => {
  const d = JSON.parse(read('data/athena_dryrun_223.json'));
  expect(d.writes === false && d.anchors_rows > 3000 && d.results.length >= 47, 'shape ' + d.results.length);
  for (const q of ['Moon', 'gravity', 'ammonia', 'caffeine', 'a kilogram', 'oxygen', 'helium', 'insulin', 'photosynthesis', 'the kelvin', 'the speed of light', 'Mercury', 'Saturn', 'quartz']) expect(d.results.some(r => r.question === 'What is ' + (q === 'Moon' ? 'the Moon' : q) + '?'), 'the 4.9.222 gap ' + q);
  const by = Object.fromEntries(d.results.map(r => [r.question, r]));
  expect(by['What is the Moon?'].gap === true && by['What is gravity?'].gap === true, 'gaps');
  expect(/^ASK/.test(by['What is Mercury?'].verdict) && by['What is Mercury?'].candidates.length >= 2 && /Which 'Mercury' do you mean/.test(by['What is Mercury?'].ask), 'ask surfaced');
  for (const r of d.results) {
    expect(r.writes === false && r.calls_llm === false && !/WRITTEN/.test(r.verdict.replace('not written', '')), r.question);
    for (const s of r.sources) if (s.status === 'FETCHED') expect(s.sentence && 'phase_int' in s && 'band' in s && s.row_rule && 'meaning' in s, r.question + ' ' + s.source);
    if (r.hosts) expect(!(r.evaluate_rule === 'SEED-CANDIDATE' && r.hosts.length < 2) && !(r.evaluate_rule === 'SEED-CANDIDATE' && r.hosts.includes('geonames.org') && r.hosts.length < 3), r.question + ' geonames never one of two');
  }
});

T('the app never reads the Athena modules or the new hosts; no kb.anchors schema change', () => {
  for (const f of fs.readdirSync(path.join(ROOT, 'src'))) {
    const t = read('src/' + f);
    expect(!/athena_sources_22[23]|meaning_223|raw\.githubusercontent\.com\/factbook|si-defining-constants|pug_view/.test(t), f);
  }
  expect(!/athena_sources_223|meaning_223/.test(read('index.html')) && !/athena_sources_223|meaning_223/.test(read('sw.js')), 'shell');
  expect(!fs.readdirSync(path.join(ROOT, '..', 'supabase', 'migrations')).some(f => /sense|athena|meaning/i.test(f) && !/_22[4-9]\.sql$/.test(f)), 'no migration before 4.9.224');
});

T('the cold 60 for 4.9.223 is recorded (not tuned) and identical to 4.9.222: the phase change moved no answer', () => {
  const c = JSON.parse(read('data/cold_223_results.json')), p = JSON.parse(read('data/cold_222_results.json'));
  expect(c.release === '4.9.223' && c.tuned === false && c.of === 60 && c.false_admits === 0 && c.admitted === 21 && c.admitted === p.admitted, JSON.stringify({ a: c.admitted, f: c.false_admits }));
  expect(JSON.stringify(c.rows) === JSON.stringify(p.rows), 'every row identical to 4.9.222');
});
T('version registry names 4.9.223', () => {
  expect(read('VERSION').trim() === '4.9.246', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.246' && reg.features.some(f => f.id === 'R4223-ATHENA-MEANING') && reg.count === reg.features.length, 'registry');
});
(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4223', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4223', name: t.name, ok: false, why: String(e && e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
