/* Records 4.9.261 creative traces. Not a golden. */
const path = require('path');
const cp = require('child_process');
const fs = require('fs');
const SET = require('./creative_261.js');
const ROOT = path.join(__dirname, '..', '..');
const Q = require(ROOT + '/src/qframe.js');
const FK = require(ROOT + '/src/forge.js');
const K = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const Core = require(ROOT + '/src/rmc_core.js');
function kernel() { return FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-26T18:00:00Z' }); }
function ask(q, phone) {
  const f = kernel();
  const frame = Q.compile(q, f);
  const rows = (phone || []).map((t, i) => ({ id: 'c' + i, text: /[.!?]$/.test(t) ? t : t + '.', clause: Q.clause(t, f), source: 'phone_kb', trust: 'trusted' }));
  const payload = Core.withClauses({ question: q, frame, live: true, memory: { phone: rows, pools: [] } }, Q, f);
  const py = `import json,sys
from rmc_engine_v1.rmc_core import run
r=run(json.load(sys.stdin))
c=r.get("creative") or {}
print(json.dumps({"product":r.get("product_reply"),"route":r.get("route"),"reply":r.get("reply"),"write":(r.get("memory_write") or {}).get("proposed"),"facts":[{"text":x.get("text"),"source":x.get("source")} for x in (c.get("facts") or [])],"sims":[{"solver":x.get("source"),"outcome":x.get("outcome"),"text":x.get("text"),"question":x.get("question")} for x in (c.get("sims") or [])],"math":[x.get("text") for x in (c.get("math") or [])],"why":c.get("why"),"athena":(c.get("athena") or {}).get("rule")},default=str))`;
  const env = Object.assign({}, process.env, { PYTHONPATH: [path.join(ROOT, 'engine'), ROOT, path.join(ROOT, '_mathlibs')].join(path.delimiter) });
  const proc = cp.spawnSync('python3', ['-c', py], { cwd: ROOT, input: JSON.stringify(payload), env, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (proc.status !== 0) return { error: String(proc.stderr || '').slice(-400), speech: frame.speech_act };
  const row = JSON.parse(proc.stdout.trim().split('\n').pop());
  row.speech = frame.speech_act;
  return row;
}
const rows = SET.map(item => Object.assign({ id: item.id, q: item.q }, ask(item.q, item.setup)));
const out = { schema: 'forge.creative_heldout/v1', not_a_golden: true, n: rows.length, rows };
const dest = process.argv[2] || path.join(__dirname, 'creative_261.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 1));
for (const row of rows) process.stderr.write(row.id + ' ' + (row.route || row.error) + ' ' + ((row.sims || []).map(s => s.solver).join(',') || '-') + '\n');
