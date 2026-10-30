/* R4182 (4.9.182): foundations. The new core runs the real dry-run.
 * The existing Ask path is unchanged. No LLM. Packs stay gated. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const Core = require(ROOT + '/src/rmc_core.js');
const CP = require(ROOT + '/src/claim_parse.js');
const D = require(ROOT + '/src/dream_idle.js');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };

T('the new core runs deep dry run and returns a trace', () => {
  const row = Core.runSync({ question: 'What is photosynthesis?' });
  expect(row.ok === true && row.foundations === true && row.product_reply === false, JSON.stringify(row.error || row.status));
  expect(row.engine === 'rmc_engine_v1' && row.entry === 'deep_dry_run_orchestrator.run_deep_dry_run', row.entry);
  expect(row.calls_llm === false && row.model_invoked === false, 'llm');
  const t = row.trace;
  expect(t && t.input === 'What is photosynthesis?' && t.memory && t.phase && Array.isArray(t.operator_chain) && t.drift && t.output, 'trace fields');
  expect(t.operator_chain.indexOf('memory_recall_trace_spine') >= 0 && t.operator_chain.indexOf('containment_router') >= 0, t.operator_chain.join(','));
  expect(t.output.product_reply === false && t.output.kind === 'foundation_trace', JSON.stringify(t.output));
  expect(t.admit && t.admit.applied_to_ask === false && t.admit.thresholds.C_min === 0.87 && t.admit.thresholds.echo_min === 0.85, JSON.stringify(t.admit && t.admit.thresholds));
  expect(t.admit.thresholds.drift_quarantine === 0.35 && t.admit.thresholds.hard_stop === 0.80, 'bands');
  expect(t.admit.thresholds.router_circuit_breaker_reference === 0.72 && t.admit.thresholds.router_babel_cutoff_reference === 0.78 && t.admit.thresholds.router_reference_role === 'reference_only', 'router reference');
  expect(row.ok_stages && row.ok_stages.length >= 10, 'stages ' + (row.ok_stages && row.ok_stages.length));
  expect(t.stages && t.stages.length === 16, 'sixteen stages');
  expect(t.echo && t.echo.method === 'jaccard_content_tokens' && t.echo.compares === 'selected_candidate_meaning_to_original_question' && t.echo.min === 0.85, JSON.stringify(t.echo));
  expect(t.late_stages && t.late_stages.length === 3 && t.late_stages.every(s => s.skipped === true), JSON.stringify(t.late_stages));
});

T('receipts and KB are visible to the memory recaller', () => {
  const cold = Core.runSync({ question: 'What is photosynthesis?', memory: { receipts: [], phone: [], hosted: [] } });
  const fed = Core.runSync({
    question: 'What is photosynthesis?',
    memory: {
      receipts: [{ id: 'rc1', text: 'A receipt names photosynthesis and light.' }],
      phone: [{ id: 'ph1', text: 'The phone KB names photosynthesis.' }],
      hosted: [{ id: 'ho1', text: 'The hosted KB names photosynthesis and plants.' }]
    }
  });
  expect(fed.memory_fed > cold.memory_fed, JSON.stringify({ cold: cold.memory_fed, fed: fed.memory_fed }));
  expect(fed.memory_fed === 3, 'fed ' + fed.memory_fed);
  expect(fed.resonance && fed.resonance.uses_token_overlap === false, JSON.stringify(fed.resonance && fed.resonance.method));
});

T('the world model sits between recall and the admit gate and does not write memory', () => {
  const row = Core.runSync({ question: 'What is quartz?', memory: { hosted: [{ id: 'q', text: 'Quartz is a mineral.' }] } });
  const names = ['memory', 'world_model', 'admit'];
  const keys = Object.keys(row.trace);
  expect(keys.indexOf('memory') < keys.indexOf('world_model') && keys.indexOf('world_model') < keys.indexOf('admit'), keys.join(','));
  expect(row.world_model.status === 'world_model_v1' && row.world_model.applied === true && row.world_model.writes_memory === false && row.world_model.calls_llm === false, JSON.stringify({ status: row.world_model.status, applied: row.world_model.applied }));
  expect(row.world_model.input_memory_count === row.world_model.output_memory_count, 'recalled memory unchanged');
  expect(row.product_reply === false && !row.reply, 'dry run does not speak');
  expect(typeof CP.admitText === 'function' && typeof CP.localDefine === 'function' && typeof CP.matchAsk !== 'function', 'answer stand-in matchAsk is gone; ingestion stays');
  expect(names.length === 3, 'order');
});

T('version registry CONFLICTS NEXT_BUILD name 4.9.182', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.200', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.182/.test(conf) && /foundations/i.test(conf) && /rmc_engine_v1/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.182/.test(nb) && /foundations/i.test(nb) && /run_deep_dry_run/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.182/.test(readme) && /ENGINE_182/.test(readme) && /foundations/i.test(readme), 'README');
  const doc = fs.readFileSync(path.join(ROOT, '..', 'docs', 'ENGINE_182.md'), 'utf8');
  expect(/foundations/i.test(doc) && /world.model|world model/i.test(doc) && /run_deep_dry_run/.test(doc), 'ENGINE_182');
  const dry = fs.readFileSync(path.join(ROOT, '..', 'docs', 'DRYRUN_182.md'), 'utf8');
  expect(/Pyodide/.test(dry) && /browser/.test(dry) && /python/.test(dry) && /stage/.test(dry), 'DRYRUN_182');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.200' && ((tgt.suites[0] === 'r4200_suite.js' || tgt.suites[0] === 'r4199_suite.js' || tgt.suites[0] === 'r4198_suite.js' || tgt.suites[0] === 'r4197_suite.js' || tgt.suites[0] === 'r4196_suite.js' || tgt.suites[0] === 'r4195_suite.js' || tgt.suites[0] === 'r4194_suite.js') || tgt.suites[0] === 'r4193_suite.js' || tgt.suites[0] === 'r4191_suite.js' || tgt.suites[0] === 'r4190_suite.js' || tgt.suites[0] === 'r4189_suite.js' || tgt.suites[0] === 'r4188_suite.js' || tgt.suites[0] === 'r4187_suite.js' || tgt.suites[0] === 'r4186_suite.js' || tgt.suites[0] === 'r4185_suite.js' || tgt.suites[0] === 'r4184_suite.js' || tgt.suites[0] === 'r4183_suite.js' || tgt.suites[0] === 'r4182_suite.js'), JSON.stringify({ release: tgt.release, head: tgt.suites[0] }));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.200' && reg.features.some(f => f.id === 'R4182-RMC-ENGINE'), reg.version);
  expect(reg.count === reg.features.length, 'count ' + reg.count);
  expect(D.boundary().phone_pack_publish === 'gated' && D.boundary().ask_keys === true && D.boundary().mesh === '4.9.187', JSON.stringify(D.boundary()));
  const worker = fs.readFileSync(path.join(ROOT, 'src', 'py_worker.js'), 'utf8');
  expect(/sha384-/.test(worker) && /rmc_bundle_integrity_mismatch/.test(worker) && /rmc_core/.test(worker), 'pyodide bundle');
  const forge = fs.readFileSync(path.join(ROOT, 'src', 'forge.js'), 'utf8');
  expect(!/applyEngineAnswer/.test(forge), 'ask path not replaced');
});

(async () => {
  let failed = 0;
  const rows = [];
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4182', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4182', name: t.name, ok: false, why: String(e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
