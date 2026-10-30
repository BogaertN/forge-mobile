/* R4183 (4.9.185): the live Ask path is rmc_engine_v1. Dry-run still skips 14–16. No LLM. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const Core = require(ROOT + '/src/rmc_core.js');
const Next = require(ROOT + '/src/next_layer.js');
const D = require(ROOT + '/src/dream_idle.js');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };

T('dry_run keeps stages 14-16 skipped', () => {
  const row = Core.runSync({ question: 'What is quartz?', live: true, dry_run: true });
  expect(row.ok === true && row.live === false && row.product_reply === false, JSON.stringify({ live: row.live, reply: row.product_reply }));
  expect(row.calls_llm === false && row.model_invoked === false, 'llm');
  expect(row.late_stages && row.late_stages.length === 3 && row.late_stages.every(s => s.skipped === true), JSON.stringify(row.late_stages));
  expect(row.late_stages[0].reason === 'renderer_not_executed_in_patch271_dry_run', row.late_stages[0].reason);
  expect(row.echo && row.echo.method === 'jaccard_content_tokens' && row.echo.min === 0.85, JSON.stringify(row.echo));
  expect(row.admit.thresholds.C_min === 0.87 && row.admit.applied_to_ask === false, JSON.stringify(row.admit.thresholds));
});

T('the world model sits between recall and the renderer', () => {
  const row = Core.runSync({ question: 'What is quartz?', live: true, dry_run: true, memory: { hosted: [{ id: 'q', text: 'Quartz is a mineral.' }] } });
  const seam = row.world_model;
  expect(seam && seam.status === 'world_model_v1' && seam.applied === true && seam.calls_llm === false && seam.writes_memory === false, JSON.stringify({ status: seam && seam.status, applied: seam && seam.applied, llm: seam && seam.calls_llm }));
  expect(seam.sits_after === 'memory_recall' && seam.sits_before === 'output_renderer' && seam.slot === 'reasoning', JSON.stringify(seam));
  expect(seam.input_memory_count === seam.output_memory_count, 'recalled memory changed');
  expect(seam.christping_initiated === false, 'christping');
  const keys = Object.keys(row.trace);
  expect(keys.indexOf('memory') < keys.indexOf('world_model') && keys.indexOf('world_model') < keys.indexOf('admit'), keys.join(','));
});

T('live Ask runs stages 14-16 and scores the rendered answer', () => {
  const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ask_183_memory.json'), 'utf8'));
  const row = Core.runSync({ question: 'What is quartz?', live: true, memory: seed });
  expect(row.live === true && row.calls_llm === false && row.model_invoked === false, 'live');
  expect(row.stage_count === 16 && row.stages.length === 16, 'stages ' + row.stage_count);
  expect(row.late_stages.length === 3 && row.late_stages.every(s => s.skipped === false && s.status === 'OK'), JSON.stringify(row.late_stages));
  expect(!row.late_stages.some(s => /patch271_dry_run/.test(String(s.reason || ''))), 'patch271 skip');
  expect(row.echo.method === 'question_meaning_coverage' && row.echo.compares === 'rendered_answer_to_original_question_meaning' && row.echo.min === 0.85, JSON.stringify(row.echo));
  expect(row.echo.pass === true && row.echo.score >= 0.85, 'echo ' + row.echo.score);
  expect(row.admit.thresholds.C_min === 0.87, JSON.stringify(row.admit.thresholds));
  const passed = row.coherence >= 0.87 && row.admit.disposition === 'admit' && row.product_reply === true && !!row.reply;
  const held = row.coherence < 0.87 && row.admit.disposition === 'held' && row.product_reply === false && !row.reply;
  expect(passed || held, JSON.stringify({ C: row.coherence, admit: row.admit.disposition, reply: row.reply }));
  expect(row.calls_llm === false, 'llm');
  expect(row.route !== 'spc_cold_storage_required', row.route);
  expect(row.drift <= 0.35, 'drift ' + row.drift);
});

T('quarantined web evidence is not spoken before admit', () => {
  const row = Core.runSync({
    question: 'What is quartz?',
    live: true,
    memory: { research: [{ id: 'web', text: 'Quartz is a hard crystalline mineral made of silicon dioxide.' }] }
  });
  expect(row.product_reply === false && !row.reply, 'quarantine spoken');
  expect(row.calls_llm === false, 'llm');
  expect(row.late_stages[0].reason === 'no_admitted_memory_covers_the_question' || row.admit.disposition !== 'admit', JSON.stringify(row.late_stages[0]));
});

T('dream_idle and economy default off and packs stay gated', () => {
  expect(Next.SWITCHES.dream_idle === false && Next.SWITCHES.economy === false, JSON.stringify(Next.SWITCHES));
  expect(Next.enabled('dream_idle') === false && Next.enabled('economy') === false, 'enabled');
  Next.set('dream_idle', true);
  expect(Next.enabled('dream_idle') === true, 'set');
  Next.set('dream_idle', false);
  expect(D.boundary().phone_pack_publish === 'gated' && D.boundary().mesh === '4.9.187', JSON.stringify(D.boundary().mesh));
});

T('Ask screen does not call the old JS answer path', () => {
  const app = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
  expect(/live:\s*true/.test(app) && /product_reply/.test(app) && /Held\. No answer was admitted/.test(app), 'ask wiring');
  expect(!/r = forge\.process\(/.test(app), 'forge.process still produces the Ask sentence');
  const forge = fs.readFileSync(path.join(ROOT, 'src', 'forge.js'), 'utf8');
  expect(/function process\(/.test(forge), 'old path still present for a later deletion');
});

T('version registry CONFLICTS NEXT_BUILD name 4.9.185', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.198', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.183/.test(conf) && /rmc_engine_v1/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.183/.test(nb) && /run_deep_dry_run/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.183/.test(readme) && /WIRING_183/.test(readme), 'README');
  const doc = fs.readFileSync(path.join(ROOT, '..', 'docs', 'WIRING_183.md'), 'utf8');
  expect(/Ask/.test(doc) && /0\.87/.test(doc) && /0\.85/.test(doc) && /reasoning_seam/.test(doc) && /EchoForge/.test(doc), 'WIRING');
  expect(/reasoning_seam/.test(nb) && /EchoForge/.test(nb), 'seam note');
  const live = fs.readFileSync(path.join(ROOT, '..', 'docs', 'LIVE_TEST_183.md'), 'utf8');
  expect(/60/.test(live) && /held/.test(live) && /C_min/.test(live), 'LIVE');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.198' && ((tgt.suites[0] === 'r4198_suite.js' || tgt.suites[0] === 'r4197_suite.js' || tgt.suites[0] === 'r4196_suite.js' || tgt.suites[0] === 'r4195_suite.js' || tgt.suites[0] === 'r4194_suite.js') || tgt.suites[0] === 'r4193_suite.js' || tgt.suites[0] === 'r4191_suite.js' || tgt.suites[0] === 'r4190_suite.js' || tgt.suites[0] === 'r4189_suite.js' || tgt.suites[0] === 'r4188_suite.js' || tgt.suites[0] === 'r4187_suite.js' || tgt.suites[0] === 'r4186_suite.js' || tgt.suites[0] === 'r4185_suite.js' || tgt.suites[0] === 'r4184_suite.js' || tgt.suites[0] === 'r4183_suite.js'), JSON.stringify({ release: tgt.release, head: tgt.suites[0] }));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.198' && reg.features.some(f => f.id === 'R4183-RMC-ASK'), reg.version);
  expect(reg.count === reg.features.length, 'count ' + reg.count);
});

(async () => {
  let failed = 0;
  const rows = [];
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4183', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4183', name: t.name, ok: false, why: String(e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
