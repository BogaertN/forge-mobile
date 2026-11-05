/* R4230 (4.9.230, Nic plan 229 steps 1-2, pt258u): the question is compiled into a kāraka frame by the kernel's own parser
 * (src/qframe.js) and sent to the engine; the engine names the speech act from the frame when it parsed and records every
 * layer that used it (trace.qframe). These checks guard the wiring; the proof is the live Ask run (CONFLICTS.md v4.9.230). */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const CLOCK = () => '2026-11-05T10:00:00Z';

T('the frame is the parser\'s declarative with the wh-gap filled; roles come from the parse', () => {
  const K = require(ROOT + '/src/kernel.js'), F = require(ROOT + '/src/forge.js'), Q = require(ROOT + '/src/qframe.js');
  const f = F.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: CLOCK });
  const c = q => Q.compile(q, f);
  let x = c('Who wrote Hamlet?'); expect(x.parsed && x.wh_role === 'kartr' && x.kriya === 'write' && x.karma && /hamlet/i.test(x.karma.text), JSON.stringify(x));
  x = c('What did Shakespeare write?'); expect(x.parsed && x.wh_role === 'karma' && x.kriya === 'write' && /shakespeare/i.test(x.kartr.text), JSON.stringify(x));
  x = c('Why is the sky blue?'); expect(x.parsed && x.wh_role === 'hetu' && x.declarative === 'the sky is blue', JSON.stringify(x));
  x = c('who are you'); expect(x.parsed && x.speech_act === 'self' && x.kartr.kernel, JSON.stringify(x));
  x = c('If I push a bottle at the top what happens?'); expect(x.conditional && x.cond && x.cond.kriya === 'push' && x.kriya === 'happen' && x.wh_role === 'kartr', JSON.stringify(x));
  x = c('Is the sky blue?'); expect(x.parsed && x.wh_role === 'polarity', JSON.stringify(x));
  x = c('2+2*3'); expect(x.speech_act === 'compute' && !x.parsed, JSON.stringify(x));
});

T('every engine call for a question (Ask, the sense re-ask, the dry-run card) gets its frame in KRMCCore.run; the caller payload is not mutated; the script is loaded and precached', () => {
  const vm = require('vm');
  const sent = [];
  const box = { self: { KRMC: { ask: p => { sent.push(p); return Promise.resolve({ ok: true }); } }, KQFrame: { compile: (t) => ({ schema: 'forge.qframe/v1', text: t }) }, forge: {} }, fetch: () => {} };
  vm.runInNewContext(read('src/rmc_core.js'), box);
  const api = box.self.KRMCCore;
  const p = { question: 'Who wrote Hamlet?', live: true, dry_run: true, memory: [] };
  api.run(p);
  expect(sent.length === 1 && sent[0].frame && sent[0].frame.text === 'Who wrote Hamlet?' && sent[0].dry_run === true, JSON.stringify(sent));
  expect(!('frame' in p), 'caller payload mutated');
  const own = { question: 'x', frame: { text: 'x', mine: 1 } }; api.run(own); expect(sent[1].frame.mine === 1, 'existing frame replaced');
  delete box.self.KQFrame; api.run({ question: 'y' }); expect(!sent[2].frame, 'frame invented without the compiler');
  const html = read('index.html'); expect(html.indexOf('src/qframe.js') > 0 && html.indexOf('src/qframe.js') < html.indexOf('src/app.js'), 'script order');
  expect(read('sw.js').includes("'./src/qframe.js'"), 'sw precache');
});

const SA = x => x.uses.filter(u => u.consumer !== 'world_model.derive');
T('the engine uses frame.speech_act when the frame parsed, keeps its own reading otherwise, and rejects a frame for another question', () => {
  const py = `
import json
from rmc_engine_v1.rmc_core import run
def fr(t, act, parsed=True): return {"schema": "forge.qframe/v1", "text": t, "speech_act": act, "parsed": parsed}
out = {}
r = run({"question": "Who wrote Hamlet?", "live": True, "dry_run": False, "memory": {}, "frame": fr("Who wrote Hamlet?", "who")})
out["used"] = r["trace"]["qframe"]
r = run({"question": "Who wrote Hamlet?", "live": True, "dry_run": False, "memory": {}, "frame": fr("Who wrote Hamlet?", "who", False)})
out["unparsed"] = r["qframe"]
r = run({"question": "Who wrote Hamlet?", "live": True, "dry_run": False, "memory": {}, "frame": fr("What is gravity?", "what")})
out["other"] = r["qframe"]
r = run({"question": "Who wrote Hamlet?", "live": True, "dry_run": False, "memory": {}})
out["none"] = r["qframe"]
print(json.dumps(out))`;
  const r = cp.spawnSync('python3', ['-c', py], { cwd: ROOT, env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }), encoding: 'utf8', maxBuffer: 1 << 26 });
  expect(r.status === 0, r.stderr.slice(-800));
  const o = JSON.parse(r.stdout.trim().split('\n').pop());
  expect(o.used.valid && /* 4.9.233: world_model.derive also notes its frame use; only speech-act consumers are checked here */ SA(o.used).length >= 1 && SA(o.used).every(u => u.source === 'qframe' && u.speech_act === 'who'), JSON.stringify(o.used));
  expect(o.unparsed.valid && SA(o.unparsed).every(u => u.source === 'heuristic'), JSON.stringify(o.unparsed));
  expect(!o.other.valid && SA(o.other).every(u => u.source === 'heuristic'), JSON.stringify(o.other));
  expect(!o.none.received && !o.none.valid, JSON.stringify(o.none));
  expect(!/\b(llm|openai|anthropic|transformers)\b/i.test(read('src/qframe.js') + read('engine/rmc_engine_v1/question_frame.py')), 'no model');
});

T('version registry names 4.9.230', () => {
  expect(read('VERSION').trim() === '4.9.236', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.236' && reg.features.some(f => f.id === 'R4230-QFRAME') && reg.count === reg.features.length, 'registry');
});

(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4230', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4230', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
