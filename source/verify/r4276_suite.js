/* 4.9.253: several capability clauses, the HCS claim bridge, starter cases,
 * Mirror counts, and the Proposal v1 sensitivity report. Gates stay put. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const M = require(ROOT + '/src/mirror.js');
function py(code) {
  const env = Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') + path.delimiter + ROOT });
  const r = cp.spawnSync('python3', ['-c', code], { cwd: ROOT, env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || 'python').slice(-500));
  return JSON.parse(r.stdout);
}
function register(C, expect) {
  C('R4276', 'Mirror predicts from verified counts and does not move a gate', () => {
    const rows = [];
    for (let i = 0; i < 6; i++) rows.push({ verified: true, at: '2026-11-0' + (i + 1), route: i < 4 ? 'active_stack_candidate' : 'correction_queue', gate: i < 4 ? 'admit' : 'hold', recall_hit: i < 5, refuted: false });
    rows.push({ verified: false, at: '2026-11-08', route: 'invented', gate: 'admit', recall_hit: true, refuted: true });
    const guess = M.predict(rows);
    expect(guess.route === 'active_stack_candidate' && guess.gate === 'admit' && guess.from === 6 && guess.changes_gates === false, JSON.stringify(guess));
    const held = M.scoreHeldOut(rows, '2026-11-05');
    expect(held.train === 4 && held.held === 2 && held.prediction.changes_gates === false, JSON.stringify(held));
    const on = M.suggest(rows);
    const off = M.off();
    expect(on.on === true && on.hypotheses.every(h => h.status === 'needs_approval' && h.writes_code === false && h.changes_gates === false) && off.on === false && off.route_priority.length === 0, 'on/off');
    const deep = M.depth(40);
    expect(deep.cap === 27 && deep.depth === 27 && deep.stopped === true, JSON.stringify(deep));
    const drop = M.ablate([{ id: 'a', role: 'premise', gate: 'admit' }, { id: 'b', role: 'premise', gate: 'admit' }]);
    expect(drop.changes_gates === false && drop.drops.length === 2 && drop.drops[0].premises_left === 1, JSON.stringify(drop));
    const block = M.blocked([{ path_hash: 'abc', status: 'refuted' }], 'abc');
    expect(block.blocked === true && M.blocked([{ path_hash: 'abc' }], 'zzz').blocked === false, JSON.stringify(block));
  });
  C('R4276', 'an HCS packet is a claim, ozone holds, and a measurement is not a publisher', () => {
    const out = py(`
import json, os
os.environ.pop("FORGE_HCS_URL", None)
os.environ.pop("FORGE_WRITER_BEARER", None)
from server.home_pc.hcs_bridge import claim_from_hcs, exchange
from server.home_pc.cases import check, cases, PRIORITY_INSTALL
packet = {"schema": "aiweb.hfield", "forge_memory": {"schema": "forge.hfield.memory.v1", "records": [{"text": "A wren is a bird."}], "receiver_policy": {"content_is_claim": True, "auto_persist": False, "peer_is_publisher": False}}}
bad = {"schema": "aiweb.hfield", "receiver_policy": {"peer_is_publisher": True, "auto_persist": True}}
print(json.dumps({
  "claim": claim_from_hcs(packet),
  "bad": claim_from_hcs(bad),
  "role": claim_from_hcs(packet, bearer="service_role"),
  "held": exchange(packet),
  "o3": check("O3", 1.2),
  "near": check("lid-driven-cavity", -0.2109),
  "off": check("lid-driven-cavity", -0.9),
  "idle": check("sphere-drag"),
  "n": len(cases()),
  "first": PRIORITY_INSTALL[0]
}))
`);
    expect(out.claim.rule === 'HCS-CLAIM' && out.claim.admitted === false && out.claim.needs_gilligan === true && out.claim.wrote === false && out.claim.records.length === 1, JSON.stringify(out.claim));
    expect(out.bad.rule === 'HCS-PUBLISHER-REFUSED' && out.role.rule === 'HCS-SERVICE-ROLE-REFUSED' && out.held.rule === 'HCS-HELD' && out.held.forwarded === false, JSON.stringify({ bad: out.bad.rule, held: out.held.rule }));
    expect(out.o3.status === 'hold' && out.o3.publisher === false && out.near.publisher === false && out.near.stored_as_fact === false && out.near.status === 'evidence' && out.off.status === 'off_reference' && out.idle.status === 'not_run' && out.first === 'openfoam' && out.n >= 20, JSON.stringify(out));
  });
  C('R4276', 'Proposal v1 nominals are labeled and a ±50% scale does not move the floors', () => {
    const out = py(`
import json
from rmc_engine_v1.proposal_sensitivity import sweep, LABEL
from rmc_engine_v1.frequency_204_config import STATUS
print(json.dumps({"label": LABEL, "status": STATUS, "rows": sweep()}))
`);
    expect(out.label === 'approved nominal, not validated' && out.status === out.label, JSON.stringify(out.status));
    expect(out.rows.length === 3 && out.rows.every(r => r.floors_unchanged === true && r.floors.C_min === 0.87 && r.floors.echo_min === 0.85 && r.floors.drift_quarantine === 0.35 && r.floors.hard_stop === 0.8), JSON.stringify(out.rows.map(r => r.floors)));
    const mid = out.rows.find(r => r.scale === 1);
    const wide = out.rows.find(r => r.scale === 1.5);
    expect(mid && mid.recall_precision === 1 && wide && typeof wide.collisions === 'number' && typeof wide.recall_precision === 'number', JSON.stringify(out.rows));
    const cfg = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'frequency_203_config.py'), 'utf8');
    expect(cfg.includes('approved nominal, not validated') && cfg.includes('awaiting Nic') && cfg.includes('EPSILON = 0.02'), '203 label');
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 700); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
