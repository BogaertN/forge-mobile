/* R4191 (4.9.191): Phase Glyph Codex, lexicon placement, provenance holds.
 * C_min stays 0.87. The coherence formula is unchanged. No LLM. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const Next = require(ROOT + '/src/next_layer.js');
const Codex = require(ROOT + '/src/phase_codex.js');
const Lex = require(ROOT + '/src/resonance_lexicon.js');
const KM = require(ROOT + '/src/kmath.js');
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

T('the codex loads nine phases and kmath records each role change', () => {
  const v = Codex.validate();
  expect(v.status === 'OK' && v.phase_count === 9, JSON.stringify(v));
  expect(KM.PHASES[1].name === 'Initiation' && KM.PHASES[1].glyph === '⊙' && KM.PHASES[1].codex_phase_name === 'Initiation Pulse', KM.PHASES[1].name);
  expect(KM.PHASES[8].name === 'Power' && KM.PHASES[9].name === 'Recursion', KM.PHASES[9].name);
  expect(KM.CANONICAL_PHASE_NAMES[9] === 'Recursion' && KM.luciferianDScore(5, 8) === 1 && KM.luciferianDScore(4, 8) === 0, 'lemma 5');
  expect(KM.FORBIDDEN.some(p => p[0] === 5 && p[1] === 8), 'luciferian skip stays forbidden');
  const theta = KM.chiAdaptive({ eps_s: 0.5, phaseHist: [1, 2, 4], prevPhase: 5, phiAct: 8 });
  expect(theta.logged === true && theta.theta_w > 0 && theta.theta_hard === 0.8 && theta.fires === true, JSON.stringify(theta));
  expect(KM.DRIFT_RULING.project_max === 0.35 && KM.internalPhaseCoherence(0.35).admit_gate === false && KM.internalPhaseCoherence(0.35).C_min === 0.87, 'laws');
  expect(KM.phaseVelocity([0, 5, 10]).v === 1 && KM.phaseVelocity([0, 5, 10]).guarantee === 'no formal guarantee', 'oq3');
  expect(KM.localCurvature([1]) === 0 && KM.localCurvature([1, 3]) === 2, 'curvature');
  expect(KM.PHASE_RECONCILIATION.length === 9, String(KM.PHASE_RECONCILIATION.length));
  expect(KM.PHASES[1].drift_flag === 'unspecified' && KM.PHASES[4].drift_flag === 'PRESSURE_CRACK', KM.PHASES[4].drift_flag);
  expect(KM.PAPER_CONSTANTS.phi_to_angle.status === 'stated' && KM.PAPER_CONSTANTS.phi_to_angle.degrees === 40 && KM.PAPER_CONSTANTS.mu.value === 'unspecified', 'constants');
  expect(KM.MERGE_WINDOW === Math.PI / 4 && Math.abs(KM.phaseAngle(4) - (3 * 40 * Math.PI / 180)) < 1e-12 && KM.phaseAngleDegrees(1) === 0 && KM.phaseAngleDegrees(9) === 320, 'angle');
  const two = KM.driftCircuitBreaker(0.36, null, [0.36]);
  const three = KM.driftCircuitBreaker(0.36, null, [0.36, 0.36]);
  const hard = KM.driftCircuitBreaker(0.9);
  const skip = KM.driftCircuitBreaker(0.1, { from: 5, to: 8 });
  expect(two.tripped === false && two.consecutive_failures === 2 && three.tripped === true && three.reason === 'consecutive_failures' && three.consecutive_limit === 3, JSON.stringify({ two, three }));
  expect(hard.tripped === true && hard.reason === 'hard_stop' && skip.tripped === true && skip.reason === 'forbidden_step' && three.money === false, JSON.stringify({ hard, skip }));
  expect(KM.PAPER_CONSTANTS.integrity_example.C_min === 0.87, 'C_min');
});

T('the seed lexicon is 425 words and placement does not use a regular expression', () => {
  expect(Lex.wordCount() === 425, String(Lex.wordCount()));
  const src = fs.readFileSync(path.join(ROOT, 'src', 'resonance_lexicon.js'), 'utf8');
  const pySrc = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'lexicon_resonance.py'), 'utf8');
  expect(src.indexOf('new RegExp') < 0 && src.indexOf('.match(') < 0 && src.indexOf('.replace(') < 0, 'js regex');
  expect(!/import re\b/.test(pySrc), 'py regex');
  const sky = Lex.placeWord('sky');
  const leaves = Lex.placeWord('leaves');
  const ocean = Lex.placeWord('ocean');
  expect(sky.Phi === 4 && sky.glyph === '◊' && sky.eps === 'unspecified' && sky.mu === 'unspecified' && sky.map_authority === 'Phase Parsing Engine' && sky.not_map_authority === 'HarperScript', JSON.stringify(sky));
  expect(Lex.proposalV1Count() === 0 && Lex.proposalCharge({ tag: 'proposal v1', eps: 0.2, mu: 0.5 }).status === 'stated' && Lex.proposalCharge({ notes: 'proposal v1' }).status === 'tagged_without_numbers' && Lex.proposalCharge({ word: 'sky' }) === null, 'proposal v1');
  expect(leaves.Phi === 5 && ocean.Phi === 1 && ocean.glyph === '⊙', JSON.stringify({ leaves: leaves.Phi, ocean: ocean.Phi }));
  const out = py(`
import json
from rmc_engine_v1.lexicon_resonance import letter_map_authority, packet, proposal_charge, proposal_v1_count, word_count
sky = packet("A.SKY")
print(json.dumps({"n": word_count(), "sky": sky["Phi"], "leaves": packet("A.LEAVES")["Phi"], "ocean": packet("A.OCEAN")["Phi"], "map": letter_map_authority()["map_authority"], "not_map": letter_map_authority()["not_map_authority"], "angle": sky["angle_status"], "tagged": proposal_v1_count(), "sample": proposal_charge({"tag": "proposal v1", "eps": 0.2, "mu": 0.5})["mu"], "bare": proposal_charge({"notes": "proposal v1"})["status"]}))
`);
  const row = JSON.parse(out.trim().split('\n').pop());
  expect(row.n === 425 && row.sky === 4 && row.leaves === 5 && row.ocean === 1 && row.map === 'Phase Parsing Engine' && row.not_map === 'HarperScript' && row.angle === 'stated' && row.tagged === 0 && row.sample === 0.5 && row.bare === 'tagged_without_numbers', JSON.stringify(row));
});

T('unsourced hosted history is not a premise and the why-facts are not hand-set', () => {
  const mem = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ask_183_memory.json'), 'utf8'));
  const ids = ['ho-ada', 'ho-french', 'ho-mona', 'ho-curie', 'ho-phone', 'ho-cleo', 'ho-ww2', 'ho-bleach', 'ho-vinegar', 'ho-hamlet'];
  for (const id of ids) {
    const row = mem.hosted.find(r => r.id === id);
    expect(row && row.unsourced === true && row.premise === false, id);
  }
  for (const id of ['ho-sky', 'ho-leaves', 'ho-ocean']) {
    const row = mem.hosted.find(r => r.id === id);
    expect(row && !row.sfe, id + ' still hand-set');
  }
  const src = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'rmc_core.py'), 'utf8');
  expect(/UNSOURCED_HELD/.test(src) && /ho-ada/.test(src), 'hold set');
});

T('seven resurrection gates and the genesis collapse do not admit', () => {
  const Gates = require(ROOT + '/src/phase_coherent_gates.js');
  const Gen = require(ROOT + '/src/genesis_collapse.js');
  const closed = Gates.phaseCoherentResurrection({});
  expect(closed.ok === false && closed.gates.length === 7 && closed.dream_idle === false, JSON.stringify(closed));
  const open = Gates.phaseCoherentResurrection({ phase: 9, noise_floor: 0.1, identity: 'a', resurrection_log_valid: true, cycle_count: 1, resurrection_limit: 3, capacity_ok: true, active_drift: false });
  expect(open.ok === true, JSON.stringify(open.gates));
  const col = Gen.chiCollapse({ drift: 1, entropy: 1 });
  expect(col.Phi === 1 && col.phase_name === 'Initiation' && col.drift_residue === 0.22 && col.drift_cleared === 0.78 && col.entropy === 0.3 && col.consecutive_drift === 0 && col.spc_override_residue.charge === 0.8, JSON.stringify(col));
  expect(Math.abs(Gen.spcCharge(1, 168) - 0.5) < 1e-9, String(Gen.spcCharge(1, 168)));
  expect(Gen.spcActive(0.11) === true && Gen.spcActive(0.1) === false && Gen.spcGc(0.04) === true && Gen.spcGc(0.05) === false, 'spc bands');
  const out = py(`
import json
from rmc_engine_v1.phase_coherent_gates import phase_coherent_resurrection
from rmc_engine_v1.genesis_collapse import chi_collapse, spc_charge
from rmc_engine_v1.chi_hardening import luciferian_d_score
row = phase_coherent_resurrection({})
col = chi_collapse({"drift": 1, "entropy": 1})
print(json.dumps({"gates": len(row["gates"]), "ok": row["ok"], "phi": col["Phi"], "residue": col["drift_residue"], "half": spc_charge(1, 168), "d": luciferian_d_score(5, 8), "d4": luciferian_d_score(4, 8)}))
`);
  const row = JSON.parse(out.trim().split('\n').pop());
  expect(row.gates === 7 && row.ok === false && row.phi === 1 && row.residue === 0.22 && Math.abs(row.half - 0.5) < 1e-9 && row.d === 1 && row.d4 === 0, JSON.stringify(row));
});

T('the language-core engines do not call a model or lower the gate', () => {
  const out = py(`
import json
from rmc_engine_v1.language_core_engines import run_engines
row = run_engines(0.12, 4, [{"id": "ho-ada", "unsourced": True}])
print(json.dumps({
  "llm": row["calls_llm"],
  "c": row["c_min"],
  "mode": row["protoforge2_drift_connector"]["adapter_mode"],
  "promoted": row["gilligan_re_curation"]["promoted"],
  "os": row["protoforge_os_layer"]["os_process"],
  "shell": row["protoforge_os_layer"]["shell"],
  "unspecified": row["drift_taxonomy"]["unspecified"],
  "breaker": row["drift_circuit_breaker"]["tripped"],
  "limit": row["drift_circuit_breaker"]["consecutive_limit"],
  "money": row["protoforge_os_layer"]["money"]
}))
`);
  const row = JSON.parse(out.trim().split('\n').pop());
  expect(row.llm === false && row.c === 0.87 && row.mode === 'FALLBACK' && row.promoted === 0, JSON.stringify(row));
  expect(row.os === false && row.shell === false && row.breaker === false && row.limit === 3 && row.money === false, JSON.stringify(row));
  const breaker = py(`
import json
from rmc_engine_v1.language_core_engines import drift_circuit_breaker
two = drift_circuit_breaker(0.36, history=[0.36])
three = drift_circuit_breaker(0.36, history=[0.36, 0.36])
hard = drift_circuit_breaker(0.9)
skip = drift_circuit_breaker(0.1, {"from": 5, "to": 8})
print(json.dumps({"two": two["tripped"], "n2": two["consecutive_failures"], "three": three["tripped"], "why": three["reason"], "hard": hard["reason"], "skip": skip["reason"], "money": three["money"]}))
`);
  const gate = JSON.parse(breaker.trim().split('\n').pop());
  expect(gate.two === false && gate.n2 === 2 && gate.three === true && gate.why === 'consecutive_failures' && gate.hard === 'hard_stop' && gate.skip === 'forbidden_step' && gate.money === false, JSON.stringify(gate));
  expect(row.unspecified.indexOf('syntactic') >= 0 && row.unspecified.indexOf('evolutionary') >= 0, JSON.stringify(row.unspecified));
});

T('the 60-question table admits 48 and keeps the unsourced rows held', () => {
  const live = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_191_results.json'), 'utf8'));
  expect(live.stable === true && live.calls_llm === false, JSON.stringify({ stable: live.stable, llm: live.calls_llm }));
  for (const p of live.passes) expect(p.admitted === 48 && p.held === 12, p.name + ' ' + p.admitted);
  const cold = live.passes[0].rows;
  const sky = cold.find(r => r.question === 'Why is the sky blue?');
  const leaves = cold.find(r => r.question === 'Why do leaves change color?');
  const ocean = cold.find(r => r.question === 'Why is the ocean salty?');
  const ada = cold.find(r => r.question === 'Who was Ada Lovelace?');
  const news = cold.find(r => r.question === 'What happened in the news today?');
  expect(sky && sky.admitted === true && leaves && leaves.admitted === true && ocean && ocean.admitted === true, 'why facts');
  expect(ada && ada.admitted === false && news && news.admitted === false && news.echo_pass === false, 'holds');
  const doc = fs.readFileSync(path.join(ROOT, '..', 'docs', 'LIVE_TEST_191.md'), 'utf8');
  expect(/48/.test(doc) && /sky/.test(doc) && /unsourced|no source/.test(doc), 'table');
});

T('version registry names 4.9.191 and the switches stay off', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.198', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.191/.test(conf) && /C_min stays 0\.87/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.191/.test(nb) && /WIRING_191/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.191/.test(readme) && /WIRING_191/.test(readme), 'README');
  const doc = fs.readFileSync(path.join(ROOT, '..', 'docs', 'WIRING_191.md'), 'utf8');
  expect(/0\.87/.test(doc) && /unspecified/.test(doc) && /No model is called/.test(doc), 'WIRING');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.198' && ((tgt.suites[0] === 'r4198_suite.js' || tgt.suites[0] === 'r4197_suite.js' || tgt.suites[0] === 'r4196_suite.js' || tgt.suites[0] === 'r4195_suite.js' || tgt.suites[0] === 'r4194_suite.js') || tgt.suites[0] === 'r4193_suite.js' || tgt.suites[0] === 'r4191_suite.js'), JSON.stringify({ release: tgt.release, head: tgt.suites[0] }));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.198' && reg.features.some(f => f.id === 'R4191-PHASE-CODEX') && reg.count === reg.features.length, reg.version + ' ' + reg.count);
  expect(Next.SWITCHES.dream_idle === false && Next.SWITCHES.economy === false, JSON.stringify(Next.SWITCHES));
  const formula = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'measurement_kernel.py'), 'utf8');
  expect(/0\.24\*memory_fit \+ 0\.20\*phase_validity/.test(formula), 'formula');
});

const rows = [];
let failed = 0;
for (const t of tests) {
  try { t.fn(); rows.push({ cls: 'R4191', name: t.name, ok: true }); }
  catch (e) { failed++; rows.push({ cls: 'R4191', name: t.name, ok: false, why: String(e.message || e).slice(0, 900) }); }
}
console.log(JSON.stringify(rows, null, 1));
process.exit(failed ? 1 : 0);
