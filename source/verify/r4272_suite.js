/* Source trust, a simulated held gap, and a derivation from phone facts.
 * A new lineage becomes trusted only by agreeing with one that already is.
 * A second host of the same lineage does not count. A simulation is not stored. */
const { spawnSync } = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..');
function py(code, input) {
  const r = spawnSync('python3', ['-c', code], { cwd: ROOT, encoding: 'utf8', input: input || '', env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }) });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || 'python').slice(-700));
  return JSON.parse(r.stdout.trim().split('\n').pop());
}
const RUN = `
import json, sys
from rmc_engine_v1.athena_props import independent_lineages, note_sources, record_outcome
from rmc_engine_v1.sim_device import plan
req = json.load(sys.stdin)
def pub(i, host):
    return {"id": i, "host": host, "url": "https://" + host + "/x"}
if req.get("mode") == "trust":
    pair = {"publishers": [pub("alpha", "a.example"), pub("beta", "b.example")]}
    seeded = note_sources({}, [pair], admitted=True)
    stranger = {"publishers": [pub("gamma", "g.example"), pub("delta", "d.example")]}
    stayed = note_sources(seeded, [stranger], admitted=True)
    joined = note_sources(seeded, [{"publishers": [pub("gamma", "g.example"), pub("alpha", "a.example")]}], admitted=True)
    mirror = {"publishers": [pub("alpha", "a.example"), pub("alpha", "mirror.example")]}
    copied = note_sources(seeded, [mirror], admitted=True)
    fought = note_sources(seeded, [pair], disagreed=True)
    print(json.dumps({
        "seed": {k: seeded["sources"][k]["trusted"] for k in seeded["sources"]},
        "stranger": {k: stayed["sources"][k]["trusted"] for k in ("gamma", "delta")},
        "joined": stayed["sources"].get("gamma", {}).get("trusted") is not True and joined["sources"]["gamma"]["trusted"] is True and joined["sources"]["alpha"]["trusted"] is True,
        "copy_lineages": independent_lineages(mirror),
        "copy_trusted_keys": sorted(k for k, v in copied["sources"].items() if v.get("trusted")),
        "mirror_rejected": copied["sources"]["alpha"].get("rejected", 0) >= 1,
        "conflicts": fought["sources"]["alpha"]["conflicts"] >= 1 and fought["sources"]["alpha"]["trusted"] is True
    }))
elif req.get("mode") == "scene":
    bare = {"schema": "forge.qframe/v1", "conditional": True, "cond": {"parsed": True, "kriya": "push", "voice": "active", "karma": {"head": "crate", "text": "a crate"}, "adj": [{"prep": "near", "np": {"head": "top", "text": "the top"}}]}}
    held = plan("What happens if you push a crate near the top?", bare, None, [])
    def measure(num, unit, prop):
        return {"clause": {"kriya": "be", "parsed": True, "kartr": {"head": "crate", "text": "a crate"}, "pred": {"type": "measure", "num": num, "unit": unit, "property": prop}}}
    memory = [measure(4, "kilograms", "heavy"), measure(0.8, "meters", "high"), measure(0.4, "meters", "wide"), measure(0.3, "meters", "deep")]
    filled = plan("What happens if you push a crate near the top?", bare, None, memory)
    print(json.dumps({"held": held.get("ok") is False and held.get("reason") in ("property_missing", "unknown_body"), "missing": held.get("missing"), "filled": filled.get("ok") is True and filled.get("solver") == "mujoco_wasm" and filled.get("runtime") == "wasm"}))
`;
function register(C, expect) {
  C('ATHENA', 'an untrusted lineage becomes trusted only by agreeing with a trusted one, and a copy does not count', () => {
    const row = py(RUN, JSON.stringify({ mode: 'trust' }));
    expect(row.seed.alpha === true && row.seed.beta === true && row.stranger.gamma === false && row.stranger.delta === false && row.joined === true && row.copy_lineages.length === 1 && row.copy_lineages[0] === 'alpha' && row.copy_trusted_keys.indexOf('mirror.example') < 0 && row.mirror_rejected === true && row.conflicts === true, JSON.stringify(row));
  });
  C('ATHENA', 'a held push with a missing measure stays held until remembered measures make it a phone solver', () => {
    const row = py(RUN, JSON.stringify({ mode: 'scene' }));
    expect(row.held === true && row.filled === true, JSON.stringify(row));
  });
  C('ATHENA', 'a held question derives from phone facts and does not store the conclusion', async () => {
    const AP = require('./ask_path.js');
    const CU = require('../src/curators_208.js');
    const Core = require('../src/rmc_core.js');
    const s = AP.session();
    AP.remember(s, 'remember that a wren is a bird');
    AP.remember(s, 'remember that a bird is an animal');
    const before = s.phone.length;
    let inserts = 0;
    const mem = {};
    const c = CU.Curators({
      store: { get: k => mem[k], set: (k, v) => { mem[k] = JSON.parse(JSON.stringify(v)); } },
      now: () => 1,
      phone: () => s.phone,
      premises: () => s.phone.map(r => ({ id: r.id, text: r.text, clause: r.clause, provenance: { method: 'remembered', requested_by: 'user' } })),
      anchorsFor: async () => [],
      run: async p => Core.runSync(p),
      insert: async () => { inserts += 1; return { ok: true, id: 'should-not' }; }
    });
    c.noteHeld('is a wren an animal?', { product_reply: false, route: 'hold' }, { qframe: { schema: 'forge.qframe/v1', text: 'is a wren an animal?', kriya: 'be', parsed: true } });
    const tick = await c.tick();
    expect(tick.rule === 'GILLIGAN-DERIVED' && tick.to === 'simulated' && tick.rec && tick.rec.may_store_as_fact === false && tick.rec.athena === 'ATHENA-DERIVED' && inserts === 0 && s.phone.length === before, JSON.stringify({ rule: tick.rule, to: tick.to, athena: tick.rec && tick.rec.athena, reply: tick.rec && tick.rec.reply, inserts, phone: s.phone.length }));
  });
  C('ATHENA', 'a simulated gap is spoken and not inserted', async () => {
    const CU = require('../src/curators_208.js');
    const Neo = require('../src/neo.js');
    const mem = {};
    let inserts = 0;
    const receipt = { ok: true, may_store_as_fact: false, rows: [{ id: 'sim-1', text: 'The sample topples.', source: 'sim_receipt', trust: 'solver_receipt', sim: { effect_text: 'The sample topples.', sha256: 'ab', may_store_as_fact: false }, may_store_as_fact: false }] };
    let simRows = [];
    const c = CU.Curators({
      store: { get: k => mem[k], set: (k, v) => { mem[k] = JSON.parse(JSON.stringify(v)); } },
      now: () => 1,
      phone: () => [],
      simulation: () => simRows,
      rememberSimulation: (q, rows) => { simRows = rows; },
      premises: () => simRows.map(r => ({ id: r.id, text: r.text, provenance: { method: 'simulate', may_store_as_fact: false } })),
      anchorsFor: async () => [],
      research: async () => ({ rule: 'ATHENA-SIMULATED', method: 'simulate', proposals: [], receipt: receipt, simulated: true }),
      run: async () => ({ product_reply: true, reply: 'The sample topples.', coherence: 0.91, drift: 0.01, echo: { pass: true, score: 1 }, admit: { disposition: 'admit', drift_region: 'clean' }, trust: { low_trust: false, trusted_anchor: true, rests_on: 'sim-1', blocks_admit: false } }),
      insert: async () => { inserts += 1; return { ok: true, id: 'no' }; }
    });
    const n = Neo.create({ curators: () => c, now: () => 1 });
    n.noteHeld('What happens if you push a sample near the top?', { product_reply: false, route: 'hold' }, { sim: { reason: 'property_missing', missing: 'mass', body: 'sample' }, qframe: { schema: 'forge.qframe/v1', conditional: true, text: 'What happens if you push a sample near the top?' } });
    const tick = await n.tick();
    const events = n.resumeTrace(n.forQuestion('What happens if you push a sample near the top?'));
    expect(tick.rule === 'GILLIGAN-SIMULATED' && tick.to === 'simulated' && inserts === 0 && tick.rec && tick.rec.may_store_as_fact === false && events.map(e => e.event).join('>') === 'held>neo>athena>gilligan>resumed' && events[2].rule === 'ATHENA-SIMULATED' && events[3].rule === 'GILLIGAN-SIMULATED', JSON.stringify({ tick: tick.rule, to: tick.to, events, inserts }));
  });
}
module.exports = register;
if (require.main === module) {
  const jobs = [];
  register((cls, name, fn) => { jobs.push({ cls, name, fn }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  (async () => {
    const results = [];
    for (const j of jobs) {
      let ok = false, why = '';
      try { await j.fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 700); }
      results.push({ cls: j.cls, name: j.name, ok, why });
    }
    console.log(JSON.stringify(results, null, 1));
    if (results.some(r => !r.ok)) process.exit(1);
  })();
}
