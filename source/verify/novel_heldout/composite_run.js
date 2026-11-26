/* Records composite held-out turns. Not a golden. Does not score wording. */
const path = require('path');
const cp = require('child_process');
const fs = require('fs');
const SET = require(process.argv[3] ? path.resolve(process.argv[3]) : './composites.js');
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
  return FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-26T04:40:00Z' });
}
function askEngine(question, phone) {
  const f = kernel();
  const frame = Q.compile(question, f);
  const payload = Core.withClauses({ question, frame, live: true, memory: { phone: phone || [], pools: [] } }, Q, f);
  const row = R.askSync(payload);
  const d = row.world_model && row.world_model.derive;
  const how = d && d.survivor && d.survivor.how;
  return {
    reply: row.reply || null,
    product_reply: row.product_reply === true,
    held: row.product_reply !== true,
    route: row.route || null,
    path: row.answer_path || (row.pipeline && row.pipeline.answer_path) || null,
    derive: d && d.status,
    how: how || null,
    gap: row.pipeline ? row.pipeline.gap : null,
    stages: (row.pipeline && row.pipeline.stages) || null,
    frame: frame.rule || null
  };
}
function simEngine(question, phone) {
  const f = kernel();
  const frame = Q.compile(question, f);
  const py = `
import json, sys
from rmc_engine_v1.sim_device import plan, solve
body = json.load(sys.stdin)
p = plan(body["q"], body.get("frame"), memory=body.get("memory"))
out = {"ok": bool(p.get("ok")), "solver": p.get("solver"), "reason": p.get("reason"), "missing": p.get("missing"), "runtime": p.get("runtime")}
if p.get("ok") and p.get("solver"):
    try:
        s = solve(p)
        out["outcome"] = s.get("outcome")
        out["error"] = s.get("error")
    except Exception as e:
        out["error"] = str(e)[:180]
print(json.dumps(out))
`;
  const env = Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') + path.delimiter + ROOT + path.delimiter + path.join(ROOT, '_mathlibs') });
  const r = cp.spawnSync('python3', ['-c', py], { cwd: ROOT, input: JSON.stringify({ q: question, frame, memory: phone || [] }), env, encoding: 'utf8', maxBuffer: 1 << 22 });
  if (r.status !== 0) return { error: String(r.stderr || '').slice(-240) };
  try { return JSON.parse(r.stdout.trim().split('\n').pop()); } catch (e) { return { error: 'bad_json' }; }
}
function phoneOf(f, texts, prior) {
  const all = (prior || []).concat(texts || []);
  return all.map((text, i) => {
    const sentence = /[.!?]$/.test(text) ? text : text + '.';
    const clause = Q.clause(sentence, f);
    return { id: 'n' + i, text: sentence, clause, tier: 'phone', trust: 'trusted', scope: 'phone', source: 'phone_kb' };
  });
}
function observed(turn) {
  const tags = [];
  const a = turn.asked || {};
  const s = turn.sim || {};
  if (a.path === 'recalled' || (a.how && String(a.how).indexOf('RECALL') >= 0)) tags.push('recall');
  if (a.path === 'derived') tags.push('derive');
  if (a.path === 'computed') tags.push('compute');
  if (a.path === 'simulated' || (a.how && String(a.how).indexOf('SOLVER') >= 0)) tags.push('simulate');
  if (s.solver) tags.push(String(s.solver));
  if (s.reason) tags.push(String(s.reason));
  if (a.held) tags.push(a.route || 'held');
  return tags;
}
function breakAt(expect, turn) {
  if (!turn.asked || !turn.asked.held) return null;
  return {
    route: turn.asked.route,
    path: turn.asked.path,
    derive: turn.asked.derive,
    how: turn.asked.how,
    sim_reason: turn.sim && (turn.sim.reason || turn.sim.error) || null,
    missing: turn.sim && turn.sim.missing || null,
    expected: expect
  };
}
const rows = [];
for (const item of SET.items) {
  WF.clear();
  const f = kernel();
  const turns = item.turns || [{ setup: item.setup, q: item.q }];
  let memory = [];
  const done = [];
  for (const turn of turns) {
    memory = phoneOf(f, turn.setup || [], memory.map(r => r.text.replace(/\.$/, '')));
    const statement = turn.q && !/[?]/.test(turn.q) && !/^(what|who|where|when|why|how|is|are|was|were|did|does|do|can|could)\b/i.test(turn.q);
    const askedQ = statement && done.length ? done[done.length - 1].q : turn.q;
    if (statement) memory = phoneOf(f, [turn.q], memory.map(r => r.text.replace(/\.$/, '')));
    const asked = askEngine(askedQ, memory);
    const sim = simEngine(askedQ, memory);
    done.push({ q: turn.q, asked, sim, saw: observed({ asked, sim }), break: breakAt(item.expect, { asked, sim }) });
  }
  const last = done[done.length - 1];
  rows.push({ id: item.id, expect: item.expect, q: item.q || turns.map(t => t.q).join(' || '), turns: done, reply: last.asked.reply, path: last.asked.path, held: last.asked.held });
  process.stderr.write(item.id + (last.asked.held ? ' held' : ' spoke') + '\n');
}
const out = { schema: 'forge.novel_composite.snapshot/v1', fit_forbidden: true, not_a_golden: true, n: rows.length, rows };
const dest = process.argv[2];
if (dest) fs.writeFileSync(dest, JSON.stringify(out, null, 1));
else process.stdout.write(JSON.stringify(out));
