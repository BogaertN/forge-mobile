/* R4235 (4.9.235, Nic plan 229 step 7, 10:06): measured values replace fixed numbers, and the constant drift is fixed.
 * (1) D = f(entropy, structure, semantic distance, phase, taxonomy) read the candidate's no-information entropy (~1 for any
 * short sentence) and a dict-shape structure delta that is fixed per candidate class, so every language-core sentence read
 * D 0.331794, ε 0.110598. With recalled nodes, entropy is now relative to them (H_norm x the share of the claim's bits the
 * nodes do not carry) and structure is the sentence-form distance to the nearest node. No nodes: the old terms, unchanged.
 * (2) The live manifest (μ_t) carries the measured reading, not 0.90/0.20/0.20/0.80/0.80. (3) scoring_candidate reads the
 * hop (Φ, grace, ε), the world model's premise weight is recall's or the resonance grace, and a copula hop is weighed by
 * measurement, not 0.72. (4) The meaning (sense) question is asked before the engine runs, never after it has spoken.
 * Thresholds unchanged. The proof is the real Ask run (CONFLICTS.md v4.9.235). */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const py = (code, input) => {
  const r = cp.spawnSync(process.env.PYTHON || 'python3', ['-c', code], { cwd: ROOT, input: JSON.stringify(input || {}), env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') + path.delimiter + ROOT }), encoding: 'utf8', maxBuffer: 1 << 26 });
  expect(r.status === 0, r.stderr.slice(-800));
  return JSON.parse(r.stdout.trim().split('\n').pop());
};

T('D is measured per sentence against its recalled nodes; it is no longer the constant 0.331794', () => {
  const out = py(`
import json
from rmc_engine_v1.measurement_kernel import measure_candidate
nodes = [{"memory_id": "m1", "content": "Paris is the capital of France.", "content_summary": "Paris is the capital of France.", "retrieval_weight": 0.9, "confidence": "high"},
         {"memory_id": "m2", "content": "Shakespeare wrote Hamlet.", "content_summary": "Shakespeare wrote Hamlet.", "retrieval_weight": 0.9, "confidence": "high"}]
res = []
for t in ["Paris is the capital of France.", "Shakespeare wrote Hamlet.", "The capital of France is a large old city on a river.", "Hello there friend."]:
    m = measure_candidate({"candidate_id": "c", "candidate": t, "candidate_kind": "language_core"}, {"input_text": t}, memory_nodes=nodes)
    res.append({"t": t, "D": m.get("D_score"), "eps": m.get("epsilon_s"), "terms": m.get("D_terms")})
print(json.dumps(res))`);
  const Ds = out.map(r => r.D);
  expect(Ds.every(d => typeof d === 'number' && Math.abs(d - 0.331794) > 1e-6), 'no constant D: ' + JSON.stringify(Ds));
  expect(new Set(Ds.map(d => d.toFixed(4))).size >= 3, 'D varies with the sentence: ' + JSON.stringify(Ds));
  expect(out[0].D < out[2].D && out[1].D < out[3].D, 'a sentence its memory carries drifts less than one it does not: ' + JSON.stringify(Ds));
  expect(out.every(r => r.terms && r.terms.entropy_basis === 'relative_to_memory_nodes' && r.terms.structure_basis === 'sentence_form_vs_nearest_node'), 'measured basis named');
});

T('relative entropy and sentence-form delta are general measurements', () => {
  const out = py(`
import json
from rmc_engine_v1.measurement_kernel import relative_entropy, sentence_form, form_delta
a = relative_entropy("Shakespeare wrote Hamlet.", ["Shakespeare wrote Hamlet."])
b = relative_entropy("Shakespeare wrote Hamlet.", ["The sky is blue."])
print(json.dumps({"a": a, "b": b, "f1": form_delta("A whale is a mammal.", "A mammal is an animal."), "f2": form_delta("A whale is a mammal.", "Who wrote the play about the prince of Denmark?"), "s": sentence_form("An animal is a living thing.")}))`);
  expect(out.a.uncarried_share === 0 && out.a.entropy_relative === 0, 'a claim its node carries adds no entropy: ' + JSON.stringify(out.a));
  expect(out.b.uncarried_share > 0.9 && out.b.entropy_relative > 0.5, 'an uncarried claim keeps its entropy: ' + JSON.stringify(out.b));
  expect(out.f1 === 0 && out.f2 > 0.5, 'same copular form reads 0, a different form reads high: ' + out.f1 + ' ' + out.f2);
  expect(Array.isArray(out.s) && out.s.includes('_') && out.s.includes('is'), 'form keeps function words and slots content');
});

T('with no recalled nodes the old terms stand (no new number appears)', () => {
  const out = py(`
import json
from rmc_engine_v1.measurement_kernel import measure_candidate
m = measure_candidate({"candidate_id": "c", "candidate": "Hello there.", "candidate_kind": "language_core"}, {"input_text": "Hello there."}, memory_nodes=[])
print(json.dumps(m.get("D_terms")))`);
  expect(out.entropy_basis === 'candidate_entropy_no_nodes' && out.structure_basis === 'candidate_shape_vs_template_no_nodes', JSON.stringify(out));
});

T('the live manifest carries the measured reading of the spoken answer', () => {
  const out = py(`
import json
import rmc_engine_v1.deep_dry_run_orchestrator as d
from rmc_engine_v1.rmc_core import run
seen = []
orig = d._live_manifest
def wrap(*a, **k):
    m = orig(*a, **k); seen.append(m["manifest_packet"]["μ_t"]); return m
d._live_manifest = wrap
r = run({"question": "Who wrote Hamlet?", "live": True, "memory": {"phone": [{"id": "p0", "text": "Shakespeare wrote Hamlet.", "scope": "phone"}]}})
print(json.dumps({"mu": seen[-1] if seen else None, "wm": r.get("world_model_measure"), "C": r.get("coherence"), "eps": r.get("drift"), "reply": r.get("reply")}))`);
  expect(out.mu && out.wm, 'manifest compiled and world model measured');
  expect(out.mu.confidence === out.wm.C && out.mu.drift_status.post_epsilon_s === out.wm.epsilon_s, 'manifest = measured: ' + JSON.stringify(out.mu));
  expect(out.mu.confidence !== 0.9 && out.mu.drift_status.memory_fit !== 0.8 && out.mu.drift_status.source_confidence !== 0.8 && /world_model_measure/.test(out.mu.drift_status.measured_basis), 'no fixed numbers');
  const src = read('engine/rmc_engine_v1/deep_dry_run_orchestrator.py');
  const body = src.slice(src.indexOf('def _live_manifest'), src.indexOf('def _run_late_stages'));
  expect(!/"confidence": 0\.9|"novelty": 0\.2|0\.80\b/.test(body), 'the old literals are gone');
});

T('scoring_candidate, premise weight and hop weight read measurements, not 0.72 / 0.8 / "medium_high"', () => {
  const out = py(`
import json
from rmc_engine_v1.language_core_orchestration import scoring_candidate
ch = {"claim": "Shakespeare wrote Hamlet.", "debate": {"survived": True}}
a = scoring_candidate(ch, {"phi": 3, "grace": 0.61, "eps": 0.04})
b = scoring_candidate(ch, None)
print(json.dumps({"a": {k: a.get(k) for k in ("phase_target", "confidence", "novelty", "drift")}, "b": {k: b.get(k) for k in ("phase_target", "confidence", "novelty", "drift")}}))`);
  expect(out.a.phase_target === 'Φ3' && out.a.confidence === 0.61 && out.a.drift === 0.04 && out.a.novelty === 0, JSON.stringify(out.a));
  expect(out.b.confidence === 0 && out.b.drift === 0, 'no hop: reads 0, not a made-up value ' + JSON.stringify(out.b));
  const wm = read('engine/rmc_engine_v1/world_model_v1.py'), rr = read('engine/rmc_engine_v1/resonance_recall.py');
  expect(!/"retrieval_weight": 0\.8/.test(wm) && !/"medium_high"/.test(wm.slice(wm.indexOf('def _drift_for'))) && /_premise_weight\(premise, phase_path\)/.test(wm), 'premise weight measured');
  expect(!/0\.72 if hop/.test(rr) && /_hop_weight\(node, chosen, question_phi\)/.test(rr), 'hop weight measured');
});

T('the meaning question is asked before the engine runs, never after it has spoken', () => {
  const app = read('src/app.js');
  const pre = app.indexOf('asked_before_engine: true'), run = app.indexOf('row = await KRMCCore.run(');
  expect(pre > 0 && run > 0 && pre < run, 'ask before run');
  expect(!/row && row\.product_reply && row\.reply && !askCtx\.sense && window\.KSenses && KSenses\.planAsk/.test(app), 'the after-answer ask is gone');
  expect(/if \(pa && pa\.kind === 'unit'\)/.test(app), 'the held path asks only the unit question (it needs the engine reading)');
  const S = require(path.join(ROOT, 'src/senses.js'));
  S.setData({ concepts: {}, surfaces: {} }, { lexfiles: ['noun.person', 'noun.object'], lemmas: { mercury: [['a-n', 0, 1, 0, 0, 'messenger god'], ['b-n', 1, 1, 0, 0, 'the smallest planet']] } });
  const pa = S.planAsk('What is Mercury?', null, {});
  expect(pa && pa.kind === 'sense', 'planAsk works with no engine row: ' + JSON.stringify(pa));
});

T('thresholds unchanged and no model', () => {
  const k = read('engine/rmc_engine_v1/measurement_kernel.py');
  expect(!/\b(openai|anthropic|transformers|llama)\b/i.test(k), 'no model');
  const g = read('engine/rmc_engine_v1/rmc_core.py');
  expect(/0\.87/.test(g) && /0\.35/.test(g + read('engine/rmc_engine_v1/resonance_recall.py')), 'C_min 0.87 and drift 0.35 still present');
});

T('version registry names 4.9.235', () => {
  expect(read('VERSION').trim() === '4.9.244', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.244' && reg.features.some(f => f.id === 'R4235-MEASURED-MANIFEST-AND-DRIFT') && reg.count === reg.features.length, 'registry');
});

(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4235', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4235', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
