/* R4222 (4.9.222): Athena fetchers for every Tier-A trusted source, in one release (Nic 2026-11-04, t137u "add the trusted
 * sources that you named before right now").
 * 1. engine/rmc_engine_v1/athena_sources_222.py: NASA (science.nasa.gov, NSSDC fact sheets, Space Place), NLM MeSH scope
 *    notes, World Bank API, GeoNames, NIST CODATA, BIPM SI, PubChem, ChEBI, Open English WordNet glosses; Wikidata as a
 *    link and cross-check only. Each picks the defining sentence first (define_rank); a gloss or record is rendered
 *    "Label is definition." with the verbatim text kept. Per-source flags (reference/athena_sources_222.json).
 * 2. Disabled and reported, not shipped half-working: the CIA World Factbook (sunset by the CIA on 2026-02-04) and the IUPAC
 *    Gold Book (403 to a scripted fetch). Every enabled source passed a live 3-of-3 check (data/athena_sources_status_222.json).
 * 3. The allowlist gains the new hosts with their licence labels; Python and JS agree. Self-seed compares the subject on
 *    content words (both sides). Two independent publishers are still required; two NASA hosts are one publisher.
 * 4. Dry-run only (data/athena_dryrun_222.json): nothing written to kb.anchors. Cold 60 identical to 4.9.221.
 * Each source is unit-tested on its own offline (tools/test_athena_sources_222.py on verify/fixtures/athena_222). No network. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const S = require(path.join(ROOT, 'src/self_seed_202.js'));
const pyEnv = Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') });

/* 1. every source on its own: the Python unit tests, one row each */
const unit = cp.spawnSync('python3', [path.join(ROOT, 'tools/test_athena_sources_222.py')], { cwd: ROOT, env: pyEnv, encoding: 'utf8', maxBuffer: 1 << 26 });
let unitRows = [];
try { unitRows = JSON.parse(unit.stdout); } catch (e) { unitRows = [{ name: 'python unit tests ran', ok: false, why: String(unit.stderr || unit.stdout).slice(0, 800) }]; }
for (const r of unitRows) T('source unit test: ' + r.name, () => expect(r.ok, r.why));
T('the unit tests cover every enabled source by name', () => {
  const names = unitRows.map(r => r.name).join(' ');
  for (const s of ['nasa_science', 'nasa_spaceplace', 'nasa_nssdc', 'nlm_mesh', 'worldbank', 'geonames', 'nist_codata', 'bipm_si', 'pubchem', 'chebi', 'oewn', 'wikidata', 'disabled']) expect(names.indexOf(s) >= 0, s);
  expect(unit.status === 0, 'python exit ' + unit.status);
});

T('registry: every Tier-A source has a row, a publisher, a licence and a flag; the two failing ones are off with the reason', () => {
  const cfg = JSON.parse(read('engine/rmc_engine_v1/reference/athena_sources_222.json'));
  const ids = cfg.sources.map(s => s.id);
  expect(JSON.stringify(ids) === JSON.stringify(['nasa_science', 'nasa_nssdc', 'nasa_spaceplace', 'nlm_mesh', 'cia_factbook', 'worldbank', 'geonames', 'nist_codata', 'bipm_si', 'pubchem', 'chebi', 'iupac_goldbook', 'oewn', 'wikidata']), ids.join());
  for (const s of cfg.sources) expect(s.publisher && s.license && s.license_url && typeof s.enabled === 'boolean', s.id);
  const off = cfg.sources.filter(s => !s.enabled).map(s => s.id + ':' + s.status);
  expect(JSON.stringify(off) === JSON.stringify(['cia_factbook:SUNSET', 'iupac_goldbook:BLOCKED']), off.join());
  expect(/2026-02-04/.test(cfg.sources.find(s => s.id === 'cia_factbook').note) && /403/.test(cfg.sources.find(s => s.id === 'iupac_goldbook').note), 'reasons');
  const wd = cfg.sources.find(s => s.id === 'wikidata');
  expect(wd.role === 'crosscheck' && /never a source/.test(wd.note), 'wikidata cross-check only');
});

T('live check recorded: every enabled source answered 3 of 3 with the same sentence, allowlisted, licence label matching', () => {
  const st = JSON.parse(read('data/athena_sources_status_222.json')).sources;
  for (const [id, r] of Object.entries(st)) {
    if (!r.enabled) { expect(r.status === 'SUNSET' || r.status === 'BLOCKED', id); continue; }
    expect(r.status === 'OK' && r.stable_3_of_3 === true, id + ' ' + r.status);
    if (id !== 'wikidata') expect(r.allowlist_row && r.sentence && /\.$/.test(r.sentence), id);
  }
});

T('allowlist: the new hosts carry their licence labels; Python and JS agree on every Tier-A URL', () => {
  const cfg = JSON.parse(read('engine/rmc_engine_v1/reference/trusted_sources_202.json'));
  const lic = h => (cfg.sources.find(s => s.host === h) || {}).license;
  expect(lic('bipm.org') === 'CC BY 4.0' && lic('worldbank.org') === 'CC BY 4.0' && lic('geonames.org') === 'CC BY 4.0' && lic('ebi.ac.uk') === 'CC BY 4.0'
    && lic('en-word.net') === 'CC BY 4.0' && /CC BY-SA 4\.0/.test(lic('iupac.org')), 'licences');
  expect(cfg.pointer_hosts.includes('wikidata.org') && !cfg.sources.some(s => /wikidata/.test(s.host)), 'wikidata stays a pointer');
  const urls = ['https://science.nasa.gov/moon/facts/', 'https://spaceplace.nasa.gov/what-is-gravity/en/', 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html',
    'https://id.nlm.nih.gov/mesh/D000641.html', 'https://api.worldbank.org/v2/country/BFA?format=json', 'https://download.geonames.org/export/dump/countryInfo.txt#BF',
    'https://physics.nist.gov/cuu/Constants/Table/allascii.txt#speed', 'https://www.bipm.org/en/si-base-units/kilogram', 'https://pubchem.ncbi.nlm.nih.gov/element/8',
    'https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:16134', 'https://goldbook.iupac.org/terms/view/M03980', 'https://en-word.net/id/oewn-11484542-n', 'https://www.wikidata.org/wiki/Q629'];
  const js = urls.map(u => { const r = S.sourceFor(u); return r ? r.host + '|' + r.license : null; });
  const py = JSON.parse(cp.execFileSync('python3', ['-c', 'import sys,json; sys.path.insert(0,"engine"); from rmc_engine_v1 import self_seed_202 as s; print(json.dumps([(lambda r: r and (r["host"]+"|"+r["license"]))(s.source_for(u)) for u in json.loads(sys.argv[1])]))', JSON.stringify(urls)], { cwd: ROOT }).toString());
  expect(JSON.stringify(js) === JSON.stringify(py), JSON.stringify({ js, py }));
  expect(js.slice(0, 12).every(Boolean) && js[12] === null, JSON.stringify(js));
});

/* JS evaluate == Python evaluate on documents the fetchers produced from the recorded responses */
const docsPy = JSON.parse(cp.execFileSync('python3', ['-c', [
  'import json,os,sys', 'os.environ["FORGE_OEWN_DIR"]=sys.argv[2]', 'from rmc_engine_v1 import athena_sources_222 as A',
  'R=json.load(open(sys.argv[1]))["responses"]',
  'def h(u):', '    if u in R: return R[u]', '    raise A.FetchMiss(u)',
  'out={}', 'for q in ["What is the capital of Burkina Faso?","What is the Moon?","What is gravity?","What is ammonia?"]:',
  '    out[q]=A.fetch_all(q, http=h)["documents"]', 'print(json.dumps(out))'].join('\n'),
  path.join(ROOT, 'verify/fixtures/athena_222/responses.json'), path.join(ROOT, 'verify/fixtures/athena_222/oewn')], { cwd: path.join(ROOT, 'engine'), env: pyEnv }).toString());
function pyEval(payloads) {
  const r = cp.spawnSync('python3', ['-c', 'import json,sys\nfrom rmc_engine_v1.self_seed_202 import evaluate\nprint(json.dumps([evaluate(x) for x in json.load(sys.stdin)]))'],
    { input: JSON.stringify(payloads), cwd: path.join(ROOT, 'engine'), env: pyEnv, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status) throw new Error(String(r.stderr).slice(0, 600));
  return JSON.parse(r.stdout);
}
T('self-seed decision on fetched documents: JS equals Python; two publishers corroborate, two NASA hosts do not', () => {
  const ns = docsPy['What is the Moon?'][0];
  const payloads = [
    { question: 'What is the capital of Burkina Faso?', documents: docsPy['What is the capital of Burkina Faso?'], gap: true, reset: true, loop_phi: 6, now: 1000 },
    { question: 'What is the capital of Burkina Faso?', documents: docsPy['What is the capital of Burkina Faso?'], gap: true, reset: true, now: 1000 },
    { question: 'What is the Moon?', documents: [ns, Object.assign({}, ns, { url: 'https://spaceplace.nasa.gov/all-about-the-moon/en/' })], gap: true, reset: true, loop_phi: 9, now: 1000 },
    { question: 'What is gravity?', documents: docsPy['What is gravity?'], gap: true, reset: true, now: 1000 },
    { question: 'What is ammonia?', documents: docsPy['What is ammonia?'], gap: true, reset: true, now: 1000 },
  ];
  const js = payloads.map(p => S.evaluate(p)), py = pyEval(payloads);
  const key = r => JSON.stringify([r.rule, r.hosts || null, r.claim || null, r.anchor ? r.anchor.text : null, (r.trace || {}).kept, (r.trace || {}).echo_pass]);
  js.forEach((r, i) => expect(key(r) === key(py[i]), i + ' ' + key(r) + ' vs ' + key(py[i])));
  /* 4.9.223 (Nic, pt138u): GeoNames is tier 2 and never one of the two agreeing publishers, so World Bank + GeoNames alone is one publisher */
  expect(js[0].rule === 'SEED-CORROBORATION' && JSON.stringify(js[0].hosts) === '["worldbank.org"]', key(js[0]));
  expect(js[1].rule === 'SEED-PHASE', 'at the question loop the phase gate still refuses: ' + js[1].rule);
  expect(js[2].rule === 'SEED-CORROBORATION', 'one publisher: ' + js[2].rule);
});
T('content-word subject binding: JS equals Python', () => {
  const cases = [['What is the capital of Burkina Faso?', 'The capital of Burkina Faso is Ouagadougou.'], ['What is the speed of light?', 'The speed of light in vacuum is 299792458 m s^-1.'],
    ['What is the Moon?', "Earth's moon is bright."], ['What is the capital of Mali?', 'The capital of Burkina Faso is Ouagadougou.'], ['Who was Ada Lovelace?', 'Ada Lovelace was a mathematician.'],
    ['What is the kelvin?', 'The kelvin is the SI unit of thermodynamic temperature.']];
  const payloads = cases.map(([q, s]) => ({ question: q, gap: true, reset: true, now: 1000, documents: [{ url: 'https://www.nist.gov/x', text: s }, { url: 'https://www.bipm.org/x', text: s }] }));
  const js = payloads.map(p => S.evaluate(p)), py = pyEval(payloads);
  js.forEach((r, i) => expect(r.rule === py[i].rule && JSON.stringify(r.claim || null) === JSON.stringify(py[i].claim || null), cases[i][0] + ' ' + r.rule + ' vs ' + py[i].rule));
});

T('dry-run recorded on real gaps: Moon and gravity are gaps (not in kb.anchors); per source sentence, phase, band, verdict; nothing written', () => {
  const d = JSON.parse(read('data/athena_dryrun_222.json'));
  expect(d.writes === false && d.anchors_rows > 3000 && /kb/.test(d.anchors_source), 'kb export ' + d.anchors_source);
  const by = Object.fromEntries(d.results.map(r => [r.question, r]));
  for (const q of ['What is the Moon?', 'What is gravity?']) expect(by[q] && by[q].gap === true && by[q].anchored.length === 0, q + ' gap');
  expect(/^ASK/.test(by['What is Mercury?'].verdict), 'Mercury is asked: ' + by['What is Mercury?'].verdict);
  expect(/^PINNED/.test(by['What is the capital of Burkina Faso?'].verdict), 'anchored subject stays pinned');
  for (const r of d.results) {
    expect(r.writes === false && r.calls_llm === false && !/WRITTEN/.test(r.verdict), r.question);
    for (const s of r.sources) if (s.status === 'FETCHED') expect(s.sentence && 'phase_int' in s && 'band' in s && s.row_rule, r.question + ' ' + s.source);
  }
});

T('the app never fetches the new hosts; no answer path reads the fetchers', () => {
  for (const f of fs.readdirSync(path.join(ROOT, 'src'))) {
    const t = read('src/' + f);
    /* PubChem, ChEBI (OLS4) and MeSH were already read by src/archives.js before 4.9.222; the new hosts are not read by the app at all */
    expect(!/athena_sources_222|api\.worldbank\.org|geonames\.org|bipm\.org|physics\.nist\.gov|nssdc\.gsfc|spaceplace\.nasa/.test(t), f);
  }
  expect(!/athena_sources_222/.test(read('index.html')) && !/athena_sources_222/.test(read('sw.js')), 'shell');
  expect(!fs.readdirSync(path.join(ROOT, '..', 'supabase', 'migrations')).some(f => /sense|athena|222/i.test(f) && !/_22[4-9]\.sql$/.test(f)), 'no kb.anchors schema change before 4.9.224');
});

T('the cold 60 for 4.9.222 is recorded (not tuned) and identical to 4.9.221', () => {
  const c = JSON.parse(read('data/cold_222_results.json')), p = JSON.parse(read('data/cold_221_results.json'));
  expect(c.release === '4.9.222' && c.tuned === false && c.of === 60 && c.false_admits === 0 && c.admitted === 21 && c.admitted === p.admitted, JSON.stringify({ a: c.admitted, f: c.false_admits }));
  expect(JSON.stringify(c.rows) === JSON.stringify(p.rows), 'every row identical to 4.9.221');
});
T('version registry names 4.9.222', () => {
  expect(read('VERSION').trim() === '4.9.243', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.243' && reg.features.some(f => f.id === 'R4222-ATHENA-TIER-A') && reg.count === reg.features.length, 'registry');
});
(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4222', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4222', name: t.name, ok: false, why: String(e && e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
