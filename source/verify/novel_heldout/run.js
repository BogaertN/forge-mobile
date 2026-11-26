/* Executes verify/novel_heldout/set.js. Does not judge the wording and does not
 * teach the engine these questions. A snapshot is a record, not a golden. */
const path = require('path');
const cp = require('child_process');
const SET = process.argv[3] ? require(path.resolve(process.argv[3])) : require('./set.js');
const ROOT = path.join(__dirname, '..', '..');
const Q = require(ROOT + '/src/qframe.js');
const FK = require(ROOT + '/src/forge.js');
const K = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const Core = require(ROOT + '/src/rmc_core.js');
const R = require(ROOT + '/src/rmc_client.js');
const WF = require(ROOT + '/src/world_facts.js');
function kernel() {
  return FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-26T03:00:00Z' });
}
function askEngine(question, phone) {
  const f = kernel();
  const frame = Q.compile(question, f);
  const payload = Core.withClauses({ question, frame, live: true, memory: { phone: phone || [], pools: [] } }, Q, f);
  const row = R.askSync(payload);
  const d = row.world_model && row.world_model.derive;
  return {
    reply: row.reply || null,
    product_reply: row.product_reply === true,
    held: row.product_reply !== true,
    route: row.route || null,
    path: row.answer_path || null,
    derive: d && d.status,
    how: d && d.survivor && d.survivor.how,
    engines: row.engines && Object.keys(row.engines),
    stages: (row.trace && row.trace.pipeline) || (row.pipeline && row.pipeline.stages) || null
  };
}
function simEngine(question) {
  const py = `
import json, sys
from rmc_engine_v1.sim_device import plan, solve
q = json.load(sys.stdin)["q"]
p = plan(q)
out = {"ok": bool(p.get("ok")), "solver": p.get("solver"), "reason": p.get("reason"), "runtime": p.get("runtime")}
if p.get("ok") and p.get("solver"):
    try:
        s = solve(p)
        out["outcome"] = s.get("outcome")
        out["error"] = s.get("error")
    except Exception as e:
        out["error"] = str(e)[:180]
print(json.dumps(out))
`;
  const env = Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') + path.delimiter + ROOT });
  const r = cp.spawnSync('python3', ['-c', py], { cwd: ROOT, input: JSON.stringify({ q: question }), env, encoding: 'utf8', maxBuffer: 1 << 22 });
  if (r.status !== 0) return { error: String(r.stderr || '').slice(-200) };
  try { return JSON.parse(r.stdout.trim().split('\n').pop()); } catch (e) { return { error: 'bad_json' }; }
}
function phoneOf(f, texts) {
  return (texts || []).map((text, i) => {
    const sentence = /[.!?]$/.test(text) ? text : text + '.';
    const clause = Q.clause(sentence, f);
    WF.upsert({ text: sentence, clause, kind: 'remember', source: 'phone_kb', trust: 'trusted' });
    return { id: 'n' + i, text: sentence, clause, tier: 'phone', trust: 'trusted', scope: 'phone' };
  });
}
const rows = [];
for (const item of SET.items) {
  WF.clear();
  const f = kernel();
  const phone = phoneOf(f, item.setup || []);
  const asked = askEngine(item.q, phone);
  const sim = simEngine(item.q);
  rows.push({ id: item.id, engine: item.engine, q: item.q, asked, sim });
  process.stderr.write(item.id + (asked.held ? ' held' : ' spoke') + '\n');
}
const out = { schema: 'forge.novel_heldout.snapshot/v1', fit_forbidden: true, not_a_golden: true, n: rows.length, rows };
if (process.argv[2]) require('fs').writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
else process.stdout.write(JSON.stringify(out));
