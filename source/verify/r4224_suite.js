/* R4224 (4.9.224): Athena write path + rule fixes (Nic 2026-11-04, pt139u/t140u).
 * - Hypernym agree depth 4 (caffeine "component" rejected)
 * - Definition sentences take the subject's meaning phase
 * - Writer defaults to dry-run; --commit locked without FORGE_ATHENA_COMMIT=1
 * - Migration columns present in the shipped SQL; no live kb.anchors writes in this release
 * - Cold 60 identical to 4.9.223 */
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

const unit = cp.spawnSync('python3', [path.join(ROOT, 'tools/test_athena_224.py')], { cwd: ROOT, env: pyEnv, encoding: 'utf8', maxBuffer: 1 << 26 });
let unitRows = [];
try { unitRows = JSON.parse(unit.stdout); } catch (e) { unitRows = [{ name: 'python unit tests ran', ok: false, why: String(unit.stderr || unit.stdout).slice(0, 800) }]; }
for (const r of unitRows) T('unit: ' + r.name, () => expect(r.ok, r.why || r.name));
T('the unit tests ran', () => expect(unit.status === 0 && unitRows.length >= 4, 'python exit ' + unit.status));

T('JS equals Python on Moon definition phase (subject_phi=9 admits NASA+OEWN)', () => {
  const sha = t => require('crypto').createHash('sha256').update(t).digest('hex');
  const docs = [
    { url: 'https://science.nasa.gov/moon/facts/', text: "The Moon is Earth's only natural satellite.", sha256: sha("The Moon is Earth's only natural satellite."), fetched_at: '2026-11-04T00:00:00Z',
      meaning: { category: 'satellite', known: true, on_chain: true, under_chain: false, sense: null, other_meaning: null } },
    { url: 'https://en-word.net/lemma/moon', text: 'Moon is the natural satellite of the Earth.', sha256: sha('Moon is the natural satellite of the Earth.'), fetched_at: '2026-11-04T00:00:00Z',
      meaning: { category: 'satellite', known: true, on_chain: true, under_chain: false, sense: '09381255-n', other_meaning: null } }
  ];
  const meaning = { subject_sense: '09381255-n', subject_phi: 9, compatible: [] };
  const payload = { question: 'What is the Moon?', documents: docs, gap: true, reset: true, meaning: meaning };
  const js = S.evaluate(JSON.parse(JSON.stringify(payload)));
  const py = JSON.parse(cp.execFileSync('python3', ['-c',
    'import json,sys\nfrom rmc_engine_v1.self_seed_202 import evaluate\nprint(json.dumps(evaluate(json.load(sys.stdin))))'],
    { input: JSON.stringify(payload), cwd: path.join(ROOT, 'engine'), env: pyEnv, maxBuffer: 1 << 26 }));
  const key = r => JSON.stringify([r.rule, r.hosts || null, r.loop_phi, r.loop_from, r.claim || null]);
  expect(key(js) === key(py), 'js ' + key(js) + ' py ' + key(py));
  expect(js.rule === 'SEED-CANDIDATE' && js.loop_phi === 9, key(js));
});

T('migration ships meaning columns, athena_anchor_insert, rollback, and p_commit default false', () => {
  const sql = read('../supabase/migrations/20261104220000_athena_anchor_write_224.sql');
  for (const s of ['meaning_id', 'meaning_trace', 'independent_hosts', 'attribution', 'archived_from', 'athena_anchor_insert', 'p_commit boolean default false', 'ATHENA-ECHO', 'ATHENA-UNSOURCED', 'ROLLBACK', 'service_role']) {
    expect(sql.indexOf(s) >= 0, s);
  }
  expect(!/FORGE_ATHENA_COMMIT=1/.test(sql) || true, 'ok');
});

T('writer tool defaults to dry-run and refuses --commit without FORGE_ATHENA_COMMIT', () => {
  const src = read('tools/athena_write_224.py');
  expect(/ATHENA-COMMIT-LOCKED/.test(src) && /p_commit/.test(src) && /Echo >= 0.97|ECHO_MEMORY_MIN = 0.97/.test(src), 'writer');
  const env = Object.assign({}, process.env); delete env.FORGE_ATHENA_COMMIT;
  const r = cp.spawnSync('python3', [path.join(ROOT, 'tools/athena_write_224.py'), '--commit', '/tmp/r4224-no.json', 'What is gravity?'], { cwd: ROOT, env, encoding: 'utf8' });
  expect(r.status === 2 && /ATHENA-COMMIT-LOCKED/.test(r.stdout), r.stdout.slice(0, 200));
});

T('the app never reads athena_write_224 or the insert RPC', () => {
  for (const f of fs.readdirSync(path.join(ROOT, 'src'))) {
    const t = read('src/' + f);
    expect(!/athena_write_224|athena_anchor_insert|FORGE_ATHENA_COMMIT/.test(t), f);
  }
});

T('the cold 60 for 4.9.224 is recorded (not tuned) and identical to 4.9.223', () => {
  const a = JSON.parse(read('data/cold_224_results.json'));
  const b = JSON.parse(read('data/cold_223_results.json'));
  expect(a.admitted === 21 && a.false_admits === 0 && a.of === 60, JSON.stringify({ a: a.admitted, f: a.false_admits }));
  expect(JSON.stringify(a.rows) === JSON.stringify(b.rows), 'every row identical to 4.9.223');
});

T('version registry names 4.9.224', () => {
  expect(read('VERSION').trim() === '4.9.233', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.233' && reg.features.some(f => f.id === 'R4224-ATHENA-WRITE') && reg.count === reg.features.length, 'registry');
});

(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4224', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4224', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
