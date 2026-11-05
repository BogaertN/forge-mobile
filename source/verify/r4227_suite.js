/* R4227 (4.9.227): subject-keyed definitions and definitional Ask in the subject's meaning phase (Nic 2026-11-04, t142u).
 * "Fix the pipeline not the answer." A definition of X is keyed from X; a "What is X?" question also resonates in X's
 * meaning phase and prefers rows that define X. General rules: no subject->answer table, no row patched. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const pyEnv = Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') });
const unit = cp.spawnSync('python3', [path.join(ROOT, 'tools/test_subject_227.py')], { cwd: ROOT, env: pyEnv, encoding: 'utf8', maxBuffer: 1 << 26 });
let unitRows = [];
try { unitRows = JSON.parse(unit.stdout); } catch (e) { unitRows = [{ name: 'python unit tests ran', ok: false, why: String(unit.stderr || unit.stdout).slice(0, 800) }]; }
for (const r of unitRows) T('engine: ' + r.name, () => expect(r.ok, r.why || r.name));
T('the engine tests ran', () => expect(unit.status === 0 && unitRows.length >= 6, 'python exit ' + unit.status));

T('the JS evaluator keys the anchor from the subject meaning, same as Python', () => {
  const js = read('src/self_seed_202.js'); const py = read('engine/rmc_engine_v1/self_seed_202.py');
  expect(/anchor\.concepts = skeys\.map\(String\); anchor\.concepts_from = 'subject meaning'/.test(js), 'js keying');
  expect(/anchor\["concepts_from"\] = "subject meaning"/.test(py), 'py keying');
});
T('no subject->answer table: the new rules name no subject', () => {
  const src = read('engine/rmc_engine_v1/resonance_recall.py') + read('engine/rmc_engine_v1/lexicon_resonance.py');
  const block = src.split('4.9.227').slice(1).join('');
  for (const w of ['helium', 'Helium', 'MOON', 'Moon', 'water', 'oxygen', 'gravity', 'Mercury']) expect(!new RegExp("['\"]" + w).test(block), 'names ' + w);
});
T('the parser phase is kept; the subject phase is recorded beside it', () => {
  const lx = read('engine/rmc_engine_v1/lexicon_resonance.py');
  expect(/state\["subject_phase"\] = \{"Phi": sp/.test(lx), 'recorded');
  expect(!/state\["phase_primary"\] = .*subject/.test(lx), 'not replaced in lexicon placement');
});
T('the settle step runs on both recall paths', () => {
  expect(/settle_subject_phase\(phase_report, \(memory_report/.test(read('engine/rmc_engine_v1/memory_recaller.py')), 'trace spine');
  expect(/settle_subject_phase\(phase_report, _recall_nodes\)/.test(read('engine/rmc_engine_v1/deep_dry_run_orchestrator.py')), 'orchestrator');
});
T('the engine bundle carries the 4.9.227 rules', () => {
  const b = read('data/py/rmc_engine_bundle.json');
  expect(/settle_subject_phase/.test(b) && /subject_key/.test(b), 'bundle');
});
T('the cold 60 is honest: 21 of 60, 0 false admits, untuned, rows identical to 4.9.226 (offline pool has no Athena rows)', () => {
  const a = JSON.parse(read('data/cold_226_results.json')); const b = JSON.parse(read('data/cold_227_results.json'));
  expect(b.admitted === 21 && b.false_admits === 0 && b.of === 60 && b.tuned === false, JSON.stringify({ a: b.admitted, f: b.false_admits }));
  const k = r => JSON.stringify([r.n, r.question, r.admitted, r.reply]);
  expect(a.rows.map(k).join('|') === b.rows.map(k).join('|'), 'rows differ from 4.9.226');
});
T('the maintenance path: supersede/retire are service-role only, audited, Athena rows only, and the rewrite tool is commit-locked', () => {
  const sql = fs.readFileSync(path.join(ROOT, '..', 'supabase/migrations/20261105030000_athena_anchor_supersede_227.sql'), 'utf8');
  expect(/create table if not exists kb\.anchor_maintenance/.test(sql) && /enable row level security/.test(sql), 'audit table');
  expect(/revoke all on function public\.athena_anchor_supersede\(text, jsonb, text, text, boolean\) from public, anon, authenticated/.test(sql), 'supersede revoked');
  expect(/revoke all on function public\.athena_anchor_retire\(text, text, text, boolean\) from public, anon, authenticated/.test(sql), 'retire revoked');
  expect(/v_check := app\.athena_anchor_insert\(p_row, false\)/.test(sql), 'replacement passes the same gates');
  expect(/ATHENA-MAINT-NOT-ATHENA/.test(sql), 'only Athena rows');
  const tool = read('tools/athena_rewrite_227.py');
  expect(/FORGE_ATHENA_COMMIT/.test(tool) && /def rerun\(/.test(tool) && !/SUPABASE_SERVICE_ROLE_KEY"\]\s*\)/.test(tool), 'tool');
  const r = cp.spawnSync('python3', [path.join(ROOT, 'tools/athena_rewrite_227.py'), '--commit', 'a.json', 'b.json'], { cwd: ROOT, env: Object.assign({}, pyEnv, { FORGE_ATHENA_COMMIT: '' }), encoding: 'utf8' });
  expect(r.status === 2 && /ATHENA-COMMIT-LOCKED/.test(r.stdout), 'commit locked ' + r.status);
});
T('version registry names 4.9.227', () => {
  expect(read('VERSION').trim() === '4.9.232', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.232' && reg.count === reg.features.length, 'registry');
});

(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4227', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4227', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
