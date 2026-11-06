/* R4229 (4.9.229, Nic pt146u/t147u): Athena's continuous gap-filling runner and the cause-and-effect spot.
 * - the runner is dry-run by default and runs a queued gap through Athena's own write path (athena_write_224.process_one)
 *   without committing; --commit needs FORGE_ATHENA_COMMIT=1 too; an unpinned many-meaning subject waits (ASK), never guessed
 * - cause_effect.py exists, its hook is a no-op, and a prediction is never stored as a fact (the writer refuses it)
 * - Ask: an unpicked many-meaning subject asks before answering; after a pick, facts filed under another meaning are off-sense
 * No network, no writes (the RPC writer is a recorder in the Python tests). */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const env = Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine'), FORGE_OEWN_DIR: path.join(ROOT, 'verify/fixtures/athena_223/oewn') });
delete env.FORGE_ATHENA_COMMIT; delete env.SUPABASE_SERVICE_ROLE_KEY;

const unit = cp.spawnSync('python3', [path.join(ROOT, 'tools/test_athena_229.py')], { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 1 << 26 });
let unitRows = [];
try { unitRows = JSON.parse(unit.stdout); } catch (e) { unitRows = [{ name: 'python unit tests ran', ok: false, why: String(unit.stderr || unit.stdout).slice(0, 800) }]; }
for (const r of unitRows) T('unit: ' + r.name, () => expect(r.ok, r.why || r.name));
T('the unit tests ran', () => expect(unit.status === 0 && unitRows.length >= 10, 'python exit ' + unit.status + ' n=' + unitRows.length));

T('runner CLI: --commit without FORGE_ATHENA_COMMIT is locked (exit 2, nothing fetched)', () => {
  const q = path.join(require('os').tmpdir(), 'r4229_q_' + process.pid + '.json'); fs.writeFileSync(q, JSON.stringify(['What is gravity?']));
  const r = cp.spawnSync('python3', [path.join(ROOT, 'tools/athena_runner_229.py'), '--commit', q], { cwd: ROOT, env, encoding: 'utf8' });
  fs.unlinkSync(q);
  expect(r.status === 2 && /ATHENA-COMMIT-LOCKED/.test(r.stdout), 'status ' + r.status + ' ' + r.stdout.slice(0, 200));
});

T('the runner uses the existing write path and lock, not its own lookup or writer', () => {
  const src = read('tools/athena_runner_229.py');
  expect(/W\.process_one/.test(src) && /FORGE_ATHENA_COMMIT/.test(src) && !/urllib|requests\.|rest\/v1/.test(src), 'runner wiring');
  expect(!/athena_runner/.test(read('src/app.js')) && !/athena_runner/.test(read('index.html')), 'the runner is not loaded by the page (never blocks Ask, nothing written on page load)');
});

T('the runner is recursive per the papers: writeback -> discover -> loop; Gate 7 resurrection; ghost loops kept; follow-on kinds keyed by sense ids', () => {
  const src = read('tools/athena_runner_229.py');
  expect(/RESURRECTION_LIMIT = 5/.test(src) && /BREAKER_FAILS = 3/.test(src) && /def discover\(/.test(src) && /def run\(/.test(src), 'loop pieces');
  expect(/Gate 7/.test(src) && /"ghost"/.test(src) && /no_progress/.test(src) && /provisional/.test(src), 'paper rules');
  const fo = JSON.parse(read('data/athena_followons_229.json'));
  expect(fo.schema === 'FORGE-ATHENA-FOLLOWONS/229' && Object.keys(fo.kinds).length && Object.keys(fo.kinds).every(k => /^\d{8}-n$/.test(k)), 'kinds keyed by OEWN sense ids');
});

T('cause-and-effect spot: module, types, no-op hook wired into world_model simulate, bundled for the phone', () => {
  const ce = read('engine/rmc_engine_v1/cause_effect.py');
  expect(/FORGE-CAUSAL-RULE\/v1/.test(ce) && /class CausalRule\(TypedDict/.test(ce) && /SOURCE_CLASSES = \("sourced", "derived"/.test(ce), 'types');
  expect(/RULES: tuple\[CausalRule, \.\.\.\] = \(/.test(ce) && /WM-CAUSES-APPLY/.test(ce) && /WM-MAKES-APPLY/.test(ce) && /PREDICTION IS NEVER STORED AS A FACT/.test(ce), 'rules + never-store');
  expect(/_cause_effect_hook\(world, query\)/.test(read('engine/rmc_engine_v1/world_model_v1.py')), 'simulate hook');
  expect(/ATHENA-PREDICTION-NOT-A-FACT/.test(read('tools/athena_write_224.py')), 'writer refuses predictions');
  const b = JSON.parse(read('data/py/rmc_engine_bundle.json')).files;
  expect(b['rmc_engine_v1/cause_effect.py'] === ce && /picked_sense/.test(b['rmc_engine_v1/rmc_core.py']), 'bundle carries 4.9.229 engine');
});

T('Ask asks before answering an unpicked many-meaning subject; the reply picks the meaning (senses.js plumbing)', () => {
  const S = require(path.join(ROOT, 'src/senses.js'));
  const pack = { lexfiles: ['noun.person', 'noun.object'], lemmas: { mercury: [
    ['09585833-n', 0, 1, 0, 0, '(Roman mythology) messenger of Jupiter and god of commerce; counterpart of Greek Hermes'],
    ['09374305-n', 1, 1, 0, 0, 'the smallest planet and the nearest to the sun']] } };
  S.setData({ concepts: {}, surfaces: {} }, pack);
  const pa = S.planAsk('What is Mercury?', { product_reply: true, reply: 'x' }, {});
  expect(pa && pa.kind === 'sense' && pa.options.length === 2, JSON.stringify(pa));
  const f = S.follow(pa, 'the planet');
  expect(f.state === 'resolved' && f.run.sense.sense === '09374305-n' && f.run.sensed === 'Mercury', JSON.stringify(f));
  expect(S.planAsk('What is Mercury?', { product_reply: true }, { sensed: 'Mercury' }) === null, 'a picked meaning does not ask again');
  const app = read('src/app.js');
  // 4.9.235 (plan 229 step 7): the ask moved before the engine run; it still asks first, now before any answer exists.
  expect(/if \(!askCtx\.sense && window\.KSenses && KSenses\.planAsk\)/.test(app) && /product_reply: false, meaning_ask: true, asked_before_engine: true/.test(app) && app.indexOf('asked_before_engine: true') < app.indexOf('row = await KRMCCore.run('), 'app asks first');
  expect(/meaning_id: row\.meaning_id \|\| null/.test(app), 'anchor rows keep meaning_id');
  const poolFn = app.slice(app.indexOf('async function askAnchorPool'), app.indexOf('window.KAskAnchors'));
  expect(/meaning_id: row\.meaning_id \|\| null/.test(poolFn), 'the cached kb.anchors pool rows carry meaning_id (the live god-pick bug)');
  expect(/revision,meaning_id'/.test(read('src/sb_sync.js')) && /meaning_ids: true/.test(read('src/anchor_cache.js')), 'phone fetches meaning ids');
});

T('version registry names 4.9.229', () => {
  expect(read('VERSION').trim() === '4.9.247', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.247' && reg.features.some(f => f.id === 'R4229-ATHENA-RUNNER') && reg.count === reg.features.length, 'registry');
});

(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4229', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4229', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
