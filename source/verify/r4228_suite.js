/* R4228 (4.9.228): general meaning/agreement pipeline (Nic pt144u/t145u).
 * - Different WordNet meanings of the same spelling are OFF-SENSE, not SEED-DISAGREEMENT
 * - True disagreement remains incompatible claims about the SAME meaning (e.g. value conflict)
 * - Unpinned multi-sense subjects ASK
 * - Real genus agreement uses hypernym HOP distance (Saturn planet at BFS index 4 / hop 2 counts)
 * - Caffeine "component" upper-ontology match still refused
 * - No FORGE_ATHENA_COMMIT; no kb.anchors writes */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const S = require(path.join(ROOT, 'src/self_seed_202.js'));
const pyEnv = Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine'), FORGE_OEWN_DIR: process.env.FORGE_OEWN_DIR || path.join(ROOT, 'verify/fixtures/athena_223/oewn') });

const unit = cp.spawnSync('python3', [path.join(ROOT, 'tools/test_athena_228.py')], { cwd: ROOT, env: pyEnv, encoding: 'utf8', maxBuffer: 1 << 26 });
let unitRows = [];
try { unitRows = JSON.parse(unit.stdout); } catch (e) { unitRows = [{ name: 'python unit tests ran', ok: false, why: String(unit.stderr || unit.stdout).slice(0, 800) }]; }
for (const r of unitRows) T('unit: ' + r.name, () => expect(r.ok, r.why || r.name));
T('the unit tests ran', () => expect(unit.status === 0 && unitRows.length >= 6, 'python exit ' + unit.status + ' n=' + unitRows.length));

T('JS equals Python: off-sense metal does not veto planet agreement', () => {
  const sha = t => require('crypto').createHash('sha256').update(t).digest('hex');
  const docs = [
    { url: 'https://science.nasa.gov/mercury/facts/', text: 'Mercury is the smallest planet in our solar system.', sha256: sha('Mercury is the smallest planet in our solar system.'), fetched_at: '2026-11-05T00:00:00Z',
      meaning: { category: 'planet', known: true, on_chain: true, under_chain: false, sense: null, other_meaning: null } },
    { url: 'https://en-word.net/id/oewn-09374305-n', text: 'Mercury is the smallest planet and the nearest to the sun.', sha256: sha('Mercury is the smallest planet and the nearest to the sun.'), fetched_at: '2026-11-05T00:00:00Z',
      meaning: { category: 'planet', known: true, on_chain: true, under_chain: false, sense: '09374305-n', other_meaning: null } },
    { url: 'https://pubchem.ncbi.nlm.nih.gov/element/80', text: 'Mercury is a chemical element with symbol Hg.', sha256: sha('Mercury is a chemical element with symbol Hg.'), fetched_at: '2026-11-05T00:00:00Z',
      meaning: { category: 'chemical element', known: true, on_chain: false, under_chain: false, sense: null, other_meaning: '14669524-n' } }
  ];
  const meaning = { subject_sense: '09374305-n', subject_phi: 5, compatible: [] };
  const payload = { question: 'What is Mercury?', documents: docs, gap: true, reset: true, meaning: meaning };
  const js = S.evaluate(JSON.parse(JSON.stringify(payload)));
  const py = JSON.parse(cp.execFileSync('python3', ['-c',
    'import json,sys\nfrom rmc_engine_v1.self_seed_202 import evaluate\nprint(json.dumps(evaluate(json.load(sys.stdin))))'],
    { input: JSON.stringify(payload), cwd: path.join(ROOT, 'engine'), env: pyEnv, maxBuffer: 1 << 26 }));
  const key = r => JSON.stringify([r.rule, (r.hosts || []).slice().sort(), r.loop_phi, ((r.trace || {}).meaning || {}).contradict || [], (((r.trace || {}).meaning || {}).off_sense || []).map(o => o.other_meaning || o.sense).sort()]);
  expect(key(js) === key(py), 'js ' + key(js) + ' py ' + key(py));
  expect(js.rule === 'SEED-CANDIDATE' && (js.hosts || []).includes('nasa.gov') && (js.hosts || []).includes('en-word.net'), key(js));
});

T('engine marks hop-distance agreement and off-sense skip', () => {
  const py = read('engine/rmc_engine_v1/meaning_223.py');
  expect(/def ancestor_distances\(/.test(py) && /shortest-path hop/.test(py), 'hop distance');
  expect(/dist\[s\] < HYPERNYM_AGREE_DEPTH/.test(py), 'chain_sense uses hops');
  const ss = read('engine/rmc_engine_v1/self_seed_202.py');
  expect(/off_sense/.test(ss) && /different meanings of the same word are not disagreement/.test(ss), 'py off-sense');
  expect(/off_sense/.test(read('src/self_seed_202.js')) && /different meanings of the same word are not disagreement/.test(read('src/self_seed_202.js')), 'js off-sense');
});

T('the engine bundle carries the 4.9.228 rules', () => {
  const b = read('data/py/rmc_engine_bundle.json');
  expect(/ancestor_distances/.test(b) && /off_sense/.test(b), 'bundle');
});

T('the cold 60 is honest: identical to 4.9.227 offline (Athena pipeline only; no answer tuning)', () => {
  const a = JSON.parse(read('data/cold_227_results.json')); const b = JSON.parse(read('data/cold_228_results.json'));
  expect(b.admitted === 21 && b.false_admits === 0 && b.of === 60 && b.tuned === false, JSON.stringify({ a: b.admitted, f: b.false_admits }));
  const k = r => JSON.stringify([r.n, r.question, r.admitted, r.reply]);
  expect(a.rows.map(k).join('|') === b.rows.map(k).join('|'), 'rows differ from 4.9.227');
});

T('version registry names 4.9.228', () => {
  expect(read('VERSION').trim() === '4.9.245', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.245' && reg.features.some(f => f.id === 'R4228-MEANING-AGREE') && reg.count === reg.features.length, 'registry');
});

(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4228', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4228', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
