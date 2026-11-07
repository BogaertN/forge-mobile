/* R4249 (4.9.249): step 13 gap export and a pure dry-run plan, plus the dimension repairs.
 * The phone curator row keeps the question frame and the sim hold. A user download round-trips through
 * athena_runner_229 --plan. The plan does not research, write, or schedule. A missing depth stays missing.
 * One publisher's depth is not labeled as two-publisher evidence. No model. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const os = require('os');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const CU = require(ROOT + '/src/curators_208.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const K = require(ROOT + '/src/kernel.js'), FK = require(ROOT + '/src/forge.js');
const Q = require(ROOT + '/src/qframe.js');
const PY = process.env.PYTHON || 'python3';
const env = Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') + path.delimiter + ROOT });
delete env.FORGE_ATHENA_COMMIT;
const f = FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-06T12:00:00Z' });
const py = (code, input) => {
  const r = cp.spawnSync(PY, ['-c', code], { cwd: ROOT, env, encoding: 'utf8', input: input || '', maxBuffer: 1 << 26 });
  expect(r.status === 0, (r.stderr || r.stdout || '').slice(-800));
  return JSON.parse(r.stdout.trim().split('\n').pop());
};
function plan(doc) {
  const file = path.join(os.tmpdir(), 'r4249_' + process.pid + '_' + Math.random().toString(16).slice(2) + '.json');
  fs.writeFileSync(file, JSON.stringify(doc));
  const r = cp.spawnSync(PY, [path.join(ROOT, 'tools/athena_runner_229.py'), '--plan', '--commit', file], {
    cwd: ROOT, env: Object.assign({}, env, { FORGE_ATHENA_COMMIT: '1' }), encoding: 'utf8', maxBuffer: 1 << 26
  });
  fs.unlinkSync(file);
  let body = null;
  try { body = JSON.parse(r.stdout); } catch (e) { body = { parse: r.stdout.slice(0, 400), err: r.stderr.slice(0, 400) }; }
  return { status: r.status, body: body };
}

T('the phone canon and the runner canon are the same hash', () => {
  const sample = { schema: 'FORGE-GAP-EXPORT/v1', n: 0.35, ok: false, z: null, items: [1, 'a box 0.62 m'] };
  const js = CU.canon(sample);
  const pyHash = py(`
import json, sys
from tools.athena_runner_229 import canon, canonical_sha256
doc = json.load(sys.stdin)
print(json.dumps({"canon": canon(doc), "sha": canonical_sha256(doc)}))`, JSON.stringify(sample));
  expect(pyHash.canon === js, pyHash.canon + ' vs ' + js);
  const sha = require(ROOT + '/src/sha256.js').sha256;
  expect(pyHash.sha === sha(js), 'hash');
});

T('a box with no depth holds, and stated full geometry keeps its own depth', () => {
  const q = 'What happens if you push a crate near the top?';
  const frame = Q.compile(q, f);
  const partial = Q.supplement('1 meter tall, 0.8 meters wide, and 20 kilograms', f);
  const full = Q.supplement('1 meter tall, 0.8 meters wide, 0.3 meters deep, and 20 kilograms', f);
  const heightOnly = Q.supplement('1 meter tall and 20 kilograms', f);
  const out = py(`
import json, sys
from rmc_engine_v1.sim_karaka import resume_pending
from rmc_engine_v1.sim_device import plan, tip_check
q, fr, partial, full, height_only = json.load(sys.stdin)
def one(sup):
    resumed = resume_pending(q, fr, sup)
    p = plan(resumed["question"])
    sc = p.get("scene") if isinstance(p.get("scene"), dict) else {}
    body = sc.get("body") if isinstance(sc.get("body"), dict) else {}
    chk = tip_check(sc) if sc.get("action") == "push" else None
    return {"plan": p.get("ok"), "reason": p.get("reason"), "missing": p.get("missing"),
            "depth": body.get("depth"), "width": body.get("width"), "height": body.get("height"),
            "prov": (sc.get("measure_provenance") or {}).get("depth"),
            "outcome": None if not chk else chk.get("outcome")}
print(json.dumps({"partial": one(partial), "full": one(full), "height": one(height_only)}))`,
    JSON.stringify([q, frame, partial, full, heightOnly]));
  expect(out.partial.plan === false && out.partial.missing === 'depth', JSON.stringify(out.partial));
  expect(out.height.plan === false && (out.height.missing === 'width' || out.height.missing === 'depth'), JSON.stringify(out.height));
  expect(out.full.plan === true && out.full.depth === 0.3 && out.full.width === 0.8 && out.full.prov === 'stated' && out.full.outcome, JSON.stringify(out.full));
});

T('a documented bottle still uses its own record, and a one-publisher depth is not admitted', () => {
  const out = py(`
import json
from rmc_engine_v1.sim_device import plan
from rmc_engine_v1.athena_props import resolve_objects
bottle = plan("What happens if you push a bottle near the top?")
body = ((bottle.get("scene") or {}).get("body") or {})
def side(sid, depth):
    dims = [{"dimension":"Height","value":100,"unit":"cm","part":""},{"dimension":"Width","value":80,"unit":"cm","part":""}]
    if depth: dims.append({"dimension":"Depth","value":40,"unit":"cm","part":""})
    return {"id": sid, "url": "https://"+sid+".example/x", "records": [{"title":"cabinet","objectType":"cabinet","materials":["oak"],"dimensions": dims}]}
one = resolve_objects("cabinet", [side("vam", True), side("cleveland", False)], "cabinet", True)
both = resolve_objects("cabinet", [side("vam", True), side("cleveland", True)], "cabinet", True)
depth = [r for r in both.get("ok") or [] if r.get("property") == "depth"]
print(json.dumps({
  "bottle": bottle.get("ok"), "radius": body.get("radius"), "prov": ((bottle.get("scene") or {}).get("measure_provenance") or {}).get("height"),
  "one_ok": len(one.get("ok") or []), "one_depth": [r.get("property") for r in (one.get("ok") or []) if r.get("property") == "depth"],
  "one_held": (one.get("held") or [{}])[0].get("reason"),
  "both_depth_hosts": sorted({h for r in depth for h in (r.get("hosts") or [])}),
  "both_pubs": len((depth[0].get("publishers") if depth else []) or [])
}))`);
  expect(out.bottle === true && out.radius === 0.0325 && out.prov === 'documented_default', JSON.stringify(out));
  expect(out.one_depth.length === 0 && out.one_ok === 0, JSON.stringify(out));
  expect(out.both_depth_hosts.length >= 2 && out.both_pubs >= 2, JSON.stringify(out));
});

T('export round-trips the same ids, frames and pending bodies, and an open follow-up is not a write', () => {
  const mem = {};
  const c = CU.Curators({ store: { get: k => mem[k], set: (k, v) => { mem[k] = JSON.parse(JSON.stringify(v)); } }, now: () => 1000 });
  const frame = Q.compile('What happens if you push a quorble near the top?', f);
  c.noteHeld('What happens if you push a quorble near the top?', { product_reply: false, route: 'correction_queue', qframe: { schema: 'forge.qframe/v1', valid: true, frame: frame } }, { sim: { schema: 'FORGE-SIM-PROBLEM/v1', ok: false, reason: 'unknown_body', missing: 'shape' } });
  const st = c.state();
  st.pending.push({ key: 'what is quartz', question: 'What is quartz?', reply: 'Quartz is a mineral.', eps: 0.2, C: 0.9, echo: 0.99,
    body: { id: 'admit-quartz', text: 'Quartz is a mineral.', contributor: 'athena', writerProof: 'sig-secret', provenance: { question: 'What is quartz?' } },
    gap: { schema: 'FORGE-GAP-ENVELOPE/v1', question: 'What is quartz?', qframe: { schema: 'forge.qframe/v1', text: 'What is quartz?', parsed: true }, sim: null, calls_llm: false, write_authority: false } });
  const before = JSON.stringify(st);
  const open = { kind: 'sense', question: 'What is Mercury?', word: 'Mercury', options: [{ label: 'the planet', sense: '09374305-n', concept: 'A.MERCURY', gloss: 'should not be required' }] };
  const doc = CU.exportDocument(st, open);
  expect(JSON.stringify(st) === before, 'export persisted the follow-up');
  expect(doc.disclosure && doc.write_authority === false && !JSON.stringify(doc).includes('sig-secret') && !JSON.stringify(doc).includes('gloss'), 'leak');
  const got = plan(doc);
  expect(got.status === 0 && got.body.ok === true && got.body.commit === false && got.body.network === false && got.body.writes === false && got.body.write_authority === false && got.body.scheduler === false, JSON.stringify(got.body).slice(0, 500));
  const rows = got.body.rows;
  const keys = rows.map(r => r.key);
  expect(keys.indexOf('what happens if you push a quorble near the top') >= 0 && keys.indexOf('what is quartz') >= 0 && keys.indexOf('what is mercury') >= 0, JSON.stringify(keys));
  const hold = rows.find(r => r.key.indexOf('quorble') >= 0);
  const pending = rows.find(r => r.key === 'what is quartz');
  const ask = rows.find(r => r.key === 'what is mercury');
  expect(hold.disposition === 'hold' && hold.structure === 'envelope' && hold.row.gap.qframe.text === frame.text && hold.row.gap.sim.missing === 'shape' && hold.write_authority === false, JSON.stringify(hold).slice(0, 500));
  expect(pending.disposition === 'list' && pending.row.body.text === 'Quartz is a mineral.' && pending.row.body.writerProof == null && pending.write_authority === false, JSON.stringify(pending).slice(0, 400));
  expect(ask.disposition === 'awaiting_user' && ask.row.continuation.kind === 'sense' && ask.row.continuation.options[0].sense === '09374305-n' && ask.write_authority === false, JSON.stringify(ask).slice(0, 400));
  expect(rows.length === doc.curation.queue.length + doc.curation.pending.length + doc.open_turns.length, 'count');
});

T('a tampered hash, a stale reply, a mismatched frame and a duplicate key are refused', () => {
  const c = CU.Curators({ store: { get: () => null, set: () => {} }, now: () => 1000 });
  c.noteHeld('What is quartz?', { product_reply: false, route: 'correction_queue' });
  const doc = CU.exportDocument(c.state(), null);
  const tampered = JSON.parse(JSON.stringify(doc));
  tampered.disclosure = 'changed';
  const badHash = plan(tampered);
  expect(badHash.status === 2 && badHash.body.ok === false && badHash.body.rule === 'GAP-PLAN-HASH' && badHash.body.rows.length === 0, JSON.stringify(badHash.body).slice(0, 300));
  const stale = CU.exportDocument({ schema: 'FORGE-CURATION/v1', queue: [], pending: [{ key: 'what is quartz', question: 'What is quartz?', reply: 'Quartz is a mineral.', body: { text: 'Something else.' } }], quarantine: [], cold: [], admitted: [] }, null);
  const stalePlan = plan(stale);
  expect(stalePlan.status === 0 && stalePlan.body.rejected.some(r => r.rule === 'GAP-PLAN-STALE-REPLY') && !stalePlan.body.rows.some(r => r.key === 'what is quartz'), JSON.stringify(stalePlan.body).slice(0, 400));
  const frame = CU.exportDocument({ schema: 'FORGE-CURATION/v1', queue: [{ key: 'what is quartz', question: 'What is quartz?', gap: { schema: 'FORGE-GAP-ENVELOPE/v1', question: 'What is quartz?', qframe: { schema: 'forge.qframe/v1', text: 'What is feldspar?' }, sim: null } }], pending: [], quarantine: [], cold: [], admitted: [] }, null);
  const framePlan = plan(frame);
  expect(framePlan.body.rejected.some(r => r.rule === 'GAP-PLAN-FRAME'), JSON.stringify(framePlan.body).slice(0, 300));
  const dup = CU.exportDocument({ schema: 'FORGE-CURATION/v1', queue: [{ key: 'what is quartz', question: 'What is quartz?' }, { key: 'what is quartz', question: 'What is quartz?' }], pending: [], quarantine: [], cold: [], admitted: [] }, null);
  const dupPlan = plan(dup);
  expect(dupPlan.status === 2 && dupPlan.body.rule === 'GAP-PLAN-DUPLICATE', JSON.stringify(dupPlan.body).slice(0, 200));
});

T('a question-only file stays an unsupported hold and --plan does not touch a socket or the commit flag', () => {
  const legacy = plan({ schema: 'FORGE-CURATION/v1', queue: [{ question: 'What is quartz?' }], pending: [] });
  expect(legacy.status === 0 && legacy.body.integrity === 'unchecked' && legacy.body.rows.length === 1 && legacy.body.rows[0].structure === 'unsupported' && legacy.body.rows[0].disposition === 'hold' && legacy.body.rows[0].row.qframe == null, JSON.stringify(legacy.body));
  const bare = plan(['What is quartz?']);
  expect(bare.body.rows[0].structure === 'unsupported' && bare.body.write_authority === false, JSON.stringify(bare.body.rows[0]));
  const src = read('tools/athena_runner_229.py');
  const planSrc = src.slice(src.indexOf('def plan_export'), src.indexOf('def main('));
  expect(!/process_one\(|urlopen|time\.sleep|discover\(/.test(planSrc), 'plan path is not the research runner');
  const sock = py(`
import json, socket
class Boom(Exception):
    pass
def boom(*a, **k):
    raise Boom("socket")
socket.socket = boom
socket.create_connection = boom
from tools.athena_runner_229 import plan_export
print(json.dumps(plan_export({"schema":"FORGE-CURATION/v1","queue":[{"question":"What is quartz?"}],"pending":[]})))`);
  expect(sock.ok === true && sock.network === false && sock.commit === false, JSON.stringify(sock));
});

T('steps 14, 15 and 16 stay written down and unbuilt', () => {
  const conf = read('CONFLICTS.md');
  expect(conf.startsWith('## v4.9.249'), 'CONFLICTS');
  expect(/step 14/i.test(conf) && /reparse/.test(conf) && /step 15/i.test(conf) && /dry-run/.test(conf) && /step 16/i.test(conf) && /Remember/.test(conf), 'next steps');
  expect(!/def neo_tick|NEO-SCHEDULER/.test(read('tools/athena_runner_229.py')), 'no scheduler in the runner');
});

T('laws and version 4.9.249; no model and no secret', () => {
  expect(read('VERSION').trim() === '4.9.249', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.249' && reg.features.some(x => x.id === 'R4249-GAP-PLAN') && reg.count === reg.features.length, 'registry');
  const T_ = py(`
import json
from rmc_engine_v1.mobile_config import THRESHOLDS as T
print(json.dumps({k: T.get(k) for k in ("C_min", "echo_min", "drift_quarantine", "hard_stop")}))`);
  expect(T_.C_min === 0.87 && T_.echo_min === 0.85 && T_.drift_quarantine === 0.35 && T_.hard_stop === 0.8, JSON.stringify(T_));
  const blob = read('engine/rmc_engine_v1/sim_device.py') + read('engine/rmc_engine_v1/sim_scene.py') + read('tools/athena_runner_229.py');
  expect(!/sb_secret_|SUPABASE_SERVICE_ROLE|openai|anthropic/.test(blob), 'no secret, no model');
});

const results = [];
for (const t of tests) {
  let ok = false, detail = '';
  try { t.fn(); ok = true; } catch (e) { detail = String(e && e.message || e).slice(0, 800); }
  results.push({ cls: 'R4249', name: t.name, ok, why: detail });
}
if (require.main === module) {
  console.log(JSON.stringify(results, null, 1));
  process.exit(results.every(r => r.ok) ? 0 : 1);
}
module.exports = results;
