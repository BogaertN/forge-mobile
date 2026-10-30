/* R4190 (4.9.190): anchor growth for held questions.
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

T('the language-core functions do not parse with a regex or call a model', () => {
  for (const name of ['language_core_proto_chat.py', 'language_core_grok_infer.py', 'language_core_orchestration.py']) {
    const src = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', name), 'utf8');
    expect(!/_tokens|jaccard|semantic_overlap|token overlap/.test(src), name + ' overlap');
    expect(!/import re\b|ollama|openai|query_local_llm\(/.test(src), name + ' model');
    expect(/calls_llm/.test(src) && /False/.test(src), name + ' flag');
  }
});

T('a greeting is a speech act and nonsense is a refusal', () => {
  const out = py(`
import json
from rmc_engine_v1.language_core_proto_chat import handle_chat
hello = handle_chat("Hello")
noise = handle_chat("Blargh floople zig?")
sky = handle_chat("Why is the sky blue?")
print(json.dumps({"hello": hello["speech_act"], "noise": noise["speech_act"], "sky": sky["speech_act"], "llm": hello["calls_llm"]}))
`);
  const row = JSON.parse(out.trim().split('\n').pop());
  expect(row.hello === 'greeting' && row.noise === 'refusal' && row.sky === 'why' && row.llm === false, JSON.stringify(row));
});

T('the 60-question table admits 58 and keeps news and nonsense held', () => {
  const live = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_190_results.json'), 'utf8'));
  expect(live.stable === true && live.calls_llm === false, JSON.stringify({ stable: live.stable, llm: live.calls_llm }));
  for (const p of live.passes) expect(p.admitted === 58 && p.held === 2, p.name + ' ' + p.admitted);
  const cold = live.passes[0].rows;
  const news = cold.find(r => r.question === 'What happened in the news today?');
  const noise = cold.find(r => r.question === 'Blargh floople zig?');
  const ada = cold.find(r => r.question === 'Who was Ada Lovelace?');
  expect(news && news.admitted === false && news.echo_pass === false, 'news');
  expect(noise && noise.admitted === false && noise.speech_act === 'refusal', 'noise');
  expect(ada && ada.admitted === true && /Lovelace/.test(ada.reply), 'ada');
  const doc = fs.readFileSync(path.join(ROOT, '..', 'docs', 'LIVE_TEST_190.md'), 'utf8');
  expect(/cold/.test(doc) && /58/.test(doc) && /news/.test(doc), 'table');
});

T('Pyodide matches python on the 60 questions', () => {
  const row = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_190_pyodide.json'), 'utf8'));
  expect(row.n === 60 && row.bad === 0 && row.maxC <= 0.001 && row.maxD <= 0.001, JSON.stringify(row));
});

T('the new anchor migration is additive and does not lower the gate', () => {
  const sql = fs.readFileSync(path.join(ROOT, '..', 'supabase', 'migrations', '20261030190000_seed_kb_anchors_190.sql'), 'utf8');
  expect(/on conflict \(anchor_id\) do nothing/.test(sql) && /enc-nasa-sky-blue/.test(sql), 'sql');
  expect(!/delete from kb\.anchors/i.test(sql), 'no delete');
  const shard = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'anchors_188', 'shards', 'g190.json'), 'utf8'));
  expect(shard.count >= 8 && shard.anchors.every(a => a.packet && a.packet.schema === 'FORGE-RESONANCE-PACKET/v1' && a.license && a.source_url), 'shard');
});

T('version registry names 4.9.190 and the switches stay off', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.201', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.190/.test(conf) && /C_min stays 0\.87/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.190/.test(nb) && /WIRING_190/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.190/.test(readme) && /WIRING_190/.test(readme), 'README');
  const doc = fs.readFileSync(path.join(ROOT, '..', 'docs', 'WIRING_190.md'), 'utf8');
  expect(/0\.87/.test(doc) && /No model is called/.test(doc), 'WIRING');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.201' && ((tgt.suites[0] === 'r4201_suite.js' || tgt.suites[0] === 'r4200_suite.js' || tgt.suites[0] === 'r4199_suite.js' || tgt.suites[0] === 'r4198_suite.js' || tgt.suites[0] === 'r4197_suite.js' || tgt.suites[0] === 'r4196_suite.js' || tgt.suites[0] === 'r4195_suite.js' || tgt.suites[0] === 'r4194_suite.js') || tgt.suites[0] === 'r4193_suite.js' || tgt.suites[0] === 'r4191_suite.js' || tgt.suites[0] === 'r4190_suite.js'), JSON.stringify({ release: tgt.release, head: tgt.suites[0] }));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.201' && reg.features.some(f => f.id === 'R4190-ANCHOR-GROWTH') && reg.count === reg.features.length, reg.version + ' ' + reg.count);
  expect(Next.SWITCHES.dream_idle === false && Next.SWITCHES.economy === false, JSON.stringify(Next.SWITCHES));
  const formula = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'measurement_kernel.py'), 'utf8');
  expect(/0\.24\*memory_fit \+ 0\.20\*phase_validity/.test(formula), 'formula');
  const cfg = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'mobile_config.py'), 'utf8');
  expect(/0\.87/.test(cfg) && /0\.85/.test(cfg), 'thresholds');
});

(async () => {
  let failed = 0;
  const rows = [];
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4190', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4190', name: t.name, ok: false, why: String(e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
