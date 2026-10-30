/* R4188 (4.9.190): stable Echo, idempotent memory writer, sharded anchors.
 * C_min stays 0.87. The coherence formula is unchanged. No LLM. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const Next = require(ROOT + '/src/next_layer.js');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };

function py(code) {
  return cp.execFileSync('python3', ['-c', code], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }),
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
}

T('held questions keep one derived sentence across two runs', () => {
  const out = py(`
import runpy
runpy.run_path('tools/check_determinism_188.py', run_name='__main__')
`);
  const row = JSON.parse(out.trim().split('\n').pop());
  expect(row.ok === true, JSON.stringify(row.held && row.held.rows));
});

T('the memory writer keeps derived text when the sentence is already banked', () => {
  const out = py(`
import runpy
runpy.run_path('tools/check_bank_188.py', run_name='__main__')
`);
  const row = JSON.parse(out.trim().split('\n').pop());
  expect(row.ok === true, JSON.stringify(row.writer));
});

T('Pyodide matches python on the 60 questions', () => {
  const row = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_188_pyodide.json'), 'utf8'));
  expect(row.n === 60 && row.bad === 0 && row.maxC <= 0.001 && row.maxD <= 0.001, JSON.stringify(row));
  const live = fs.readFileSync(path.join(ROOT, '..', 'docs', 'LIVE_TEST_188.md'), 'utf8');
  expect(/cold/.test(live) && /pass 2/.test(live) && /pass 3/.test(live) && /53/.test(live), 'table');
});

T('version registry names 4.9.190 and the switches stay off', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.190', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.188/.test(conf) && /C_min stays 0\.87/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.188/.test(nb) && /WIRING_188/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.188/.test(readme) && /WIRING_188/.test(readme), 'README');
  const doc = fs.readFileSync(path.join(ROOT, '..', 'docs', 'WIRING_188.md'), 'utf8');
  expect(/must not apply|does not apply/i.test(doc) && /language core/i.test(doc) && /0\.87/.test(doc), 'WIRING');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.190' && tgt.suites[0] === 'r4190_suite.js' || tgt.suites[0] === 'r4189_suite.js' || tgt.suites[0] === 'r4188_suite.js', JSON.stringify({ release: tgt.release, head: tgt.suites[0] }));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.190' && reg.features.some(f => f.id === 'R4188-ANCHOR-SHARDS') && reg.count === reg.features.length, reg.version + ' ' + reg.count);
  expect(Next.SWITCHES.dream_idle === false && Next.SWITCHES.economy === false, JSON.stringify(Next.SWITCHES));
  const formula = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'measurement_kernel.py'), 'utf8');
  expect(/0\.24\*memory_fit \+ 0\.20\*phase_validity/.test(formula), 'formula');
  const sql = fs.readFileSync(path.join(ROOT, '..', 'supabase', 'migrations', '20261030143000_seed_kb_anchors.sql'), 'utf8');
  expect(/do not apply/i.test(sql) && /insert into kb\.anchors/.test(sql), 'seed');
});

(async () => {
  let failed = 0;
  const rows = [];
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4188', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4188', name: t.name, ok: false, why: String(e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
