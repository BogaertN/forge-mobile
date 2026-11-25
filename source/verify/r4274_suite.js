/* 4.9.251: the stubs the audit named. The HCS adapter stays reference-only. Home PC solvers
 * say not-installed when the import is missing and run the fixed model when it is present.
 * The calibration harness reports that there is no labelled dataset. A stated year is a valid interval. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const RD = require(ROOT + '/src/render.js');
const R = require(ROOT + '/src/reason.js');
const WF = require(ROOT + '/src/world_facts.js');
const EDE = require(ROOT + '/src/ede.js');
const Q = require(ROOT + '/src/qframe.js');
const FK = require(ROOT + '/src/forge.js');
const K = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
function forge() { return FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-25T00:00:00Z' }); }
function worldOf(text) {
  const i = R.interpret(text);
  if (!i.handled || !i.candidate) throw new Error((i.failure && i.failure.code) || 'unhandled');
  const w = R.buildTurnWorld(i.candidate);
  return { w, d: R.deriveWorld(w) };
}
function py(code) {
  const env = Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') + path.delimiter + ROOT });
  const r = cp.spawnSync('python3', ['-c', code], { cwd: ROOT, env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || 'python failed').slice(0, 500));
  return JSON.parse(r.stdout);
}
function register(C, expect) {
  C('R4274', 'the Forge to HCS adapter is the reference stub and does not go live', () => {
    const report = RD.bridgeReport({ psi_id: 'trace-1', outcome: { category: 'admitted' }, rules: [{ id: 'echo' }], reply: 'A wren is a bird.' }, { schema: 'forge.hfield.memory.v1', records: [{ text: 'A wren is a bird.' }], receiver_policy: { content_is_claim: true, auto_persist: false, peer_is_publisher: false } });
    const refused = RD.bridgeReport({}, { schema: 'forge.hfield.memory.v1', receiver_policy: { peer_is_publisher: true, auto_persist: true } });
    expect(RD.HCS_BOUNDARY.emits_hfield === false && /not live/.test(RD.HCS_BOUNDARY.adapter) && RD.HCS_BOUNDARY.live_execution_authorized === false && report.bridge_contract_id === 'aiweb.hfield.forge_packet_bridge_stub.v1' && report.execution_mode === 'reference_only_no_live_forge_execution' && report.live_execution_authorized === false && report.emits_hfield === false && report.calls_llm === false && report.forge_sends.receipt_id === 'trace-1' && report.forge_memory.schema === 'forge.hfield.memory.v1' && report.payload_layers.indexOf('forge_memory') >= 0 && refused.status === 'error' && refused.export_policy.safe_for_reference_export === false, JSON.stringify({ report: report.status, refused: refused.fatal_errors }));
  });
  C('R4274', 'PyBullet and COPASI report not installed until the import succeeds, then run the fixed model', () => {
    const out = py(`
import json
from server.sim_router.solvers import pybullet_falling_cube as B, copasi_network as C
from server.sim_router import router as R
h = R.health()
names = [s["name"] for s in h["solvers"]]
def one(mod):
    if not mod.installed():
        held = mod.solve({})
        return {"installed": False, "hold": held.get("hold"), "reason": held.get("reason"), "install": bool(held.get("install"))}
    ran = mod.solve({})
    return {"installed": True, "hold": ran.get("hold") is True, "outcome": ran.get("outcome"), "fell": (ran.get("measurements") or {}).get("fell"), "species": sorted(((ran.get("measurements") or {}).get("species") or {}).keys()), "calls_llm": ran.get("calls_llm")}
print(json.dumps({"names": names, "bullet": one(B), "copasi": one(C)}))
`);
    expect(out.names.indexOf('pybullet_falling_cube') >= 0 && out.names.indexOf('copasi_network') >= 0, JSON.stringify(out.names));
    const check = row => row.installed ? (row.hold === false && row.calls_llm === false) : (row.hold === true && row.install === true);
    expect(check(out.bullet) && check(out.copasi) && (!out.bullet.installed || out.bullet.fell === true) && (!out.copasi.installed || (out.copasi.species.indexOf('A') >= 0 && out.copasi.species.indexOf('B') >= 0)), JSON.stringify(out));
  });
  C('R4274', 'phase ablation and calibration say there is no labelled dataset and fit nothing', () => {
    const H = require(ROOT + '/research/math_honesty.js');
    const report = H.run();
    expect(report.phase_ablation.length === 9 && report.phase_ablation.every(s => s.measured === false && s.status === 'stub' && s.delta_eps === null && s.dataset === 'no labelled dataset' && s.proven_cognition === false), 'ablation');
    expect(report.calibration.status === 'no labelled dataset' && report.calibration.labelled === 0 && report.calibration.fitted_weights === null && report.calibration.rows.length === 0, JSON.stringify(report.calibration));
    const harness = EDE.calibrationHarness([EDE.calibrationRecord({ branch_id: 'b', claim: { subject: 'a' }, novelty: { simple_score: 0.1, N_vector: {} }, N_base: { value: 0.1 }, task_mode: 'explore', shadow: {}, drift: { eps_s: 0.1, theta: 0.35, status: 'below_threshold' }, hard_gates: {}, memory_anchors: [], novelty_formula_version: EDE.FORMULA_VERSION }, 'held')]);
    expect(harness.status === 'no labelled dataset' && harness.labelled === 0 && harness.fitted_weights === null && harness.rows[0].human_label === null, JSON.stringify(harness));
  });
  C('R4274', 'a stated year is a valid interval, and a query outside it is not that fact', () => {
    const same = worldOf('Mira visits Rome in 1990. Does Mira visit Rome in 1990?');
    const other = worldOf('Mira visits Rome in 1990. Does Mira visit Rome in 2001?');
    const now = worldOf('Mira visits Rome in 1990. Does Mira visit Rome?');
    const plain = worldOf('Mira visits Rome. Does Mira visit Rome?');
    const rhea = worldOf('Every glimmer is a nova. Every nova is quiet. Rhea is a glimmer. Is Rhea quiet?');
    const scanned = R.factsAt([{ id: 'a', time: { valid_from: '1990-01-01T00:00:00Z', valid_to: '1990-12-31T23:59:59Z' }, atom: { predicate: 'visit', args: ['mira', 'rome'], polarity: 'pos' } }, { id: 'b', time: null, atom: { predicate: 'visit', args: ['mira', 'rome'], polarity: 'pos' } }], null);
    expect(same.d.support && !other.d.support && !now.d.support && plain.d.support && rhea.d.support && same.w.facts[0].time.valid_from === '1990-01-01T00:00:00Z' && scanned.facts.length === 1 && scanned.facts[0].id === 'b' && scanned.index.length === 2, JSON.stringify({ same: !!same.d.support, other: !!other.d.support, now: !!now.d.support, plain: !!plain.d.support }));
    const f = forge();
    const clause = Q.clause('The treaty held from 1775 to 1783.', f);
    WF.clear();
    const kept = WF.upsert({ text: 'The treaty held from 1775 to 1783.', clause: clause, kind: 'remember' });
    const during = { valid_from: '1776-01-01T00:00:00Z', valid_to: '1776-12-31T23:59:59Z' };
    const later = { valid_from: '1800-01-01T00:00:00Z', valid_to: '1800-12-31T23:59:59Z' };
    expect(kept.ok && kept.fact.valid_from === '1775-01-01T00:00:00Z' && kept.fact.valid_to === '1783-12-31T23:59:59Z' && WF.rows().length === 1 && WF.rows({ at: null }).length === 0 && WF.rows({ at: during }).length === 1 && WF.rows({ at: later }).length === 0, JSON.stringify(kept.fact && { from: kept.fact.valid_from, to: kept.fact.valid_to, n: WF.rows().length }));
  });
  C('R4274', 'the forge2 codec rejects a bad reference and the grammar registry stays closed', () => {
    const out = py(`
import json, sys
sys.path.insert(0, "engine")
from forge2_contract import ContractValidationError
from forge2_contract.codec import contract_reference_from_dict
import aiweb_language_core_bootstrap.symbolic_grammar_operator_registry as G
try:
    contract_reference_from_dict({})
    refused = None
except ContractValidationError as e:
    refused = e.code
reg = G.build_default_symbolic_grammar_operator_registry()
print(json.dumps({"refused": refused, "n": len(reg.operators), "expected": G.EXPECTED_GRAMMAR_OPERATOR_COUNT, "runtime": reg.default_runtime_enabled, "write": reg.permission_authority_available, "action": reg.action_authority_available}))
`);
    expect(out.refused === 'mapping_key_mismatch' && out.n === out.expected && out.expected === 25 && out.runtime === false && out.write === false && out.action === false, JSON.stringify(out));
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 500); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
