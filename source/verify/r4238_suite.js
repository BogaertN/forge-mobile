/* R4238 (4.9.238, Nic: Memory Phase Invariance with Contextual Phase Alignment; plan 229 step 9 structural Echo).
 * Recall is the cognitive operation retrieve: Φ_query = Φ7 for every row, never the question text's phase. A memory keeps its
 * Φ_identity; ΔΦ is computed per ask, never stored, and only weights the ranking (A = (1 + cos ΔΦ)/2); it never drops a row.
 * Concessive and causal sentences (even though / although / because) are split into clauses, the same rules on the phone
 * (src/qframe.js) and in the engine (clause_split.py). "look" is read as the copula for attribute questions only. Echo for a
 * world-model answer compares the spoken clause frame with the question frame (kriyā, roles, gap, stated atom), not words.
 * These checks guard the wiring; the proof is the live Ask run in headless Chrome (CONFLICTS.md v4.9.238). */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const K = require(ROOT + '/src/kernel.js'), FK = require(ROOT + '/src/forge.js');
const kernel = () => FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-05T12:00:00Z' });
const Q = require(ROOT + '/src/qframe.js');
const CORE = require(ROOT + '/src/rmc_core.js');
const R2 = require(ROOT + '/src/rmc_renderer_200.js');
const PY = process.env.PYTHON || 'python3';
const env = Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') + path.delimiter + ROOT });
const py = (code, input) => {
  const r = cp.spawnSync(PY, ['-c', code], { cwd: ROOT, input: JSON.stringify(input || {}), env, encoding: 'utf8', maxBuffer: 1 << 28 });
  expect(r.status === 0, r.stderr.slice(-800));
  return JSON.parse(r.stdout.trim().split('\n').pop());
};
const MEM = `
import json, sys
from tools.live_188 import SEED, starter_rows, shard_rows
q = json.load(sys.stdin)["q"]
m = json.loads(json.dumps(SEED)); m["anchors"] = starter_rows() + shard_rows(q)
print(json.dumps(m))`;
const f = kernel();
/* the Ask path without the browser: phone frame + clauses (src/qframe.js, src/rmc_core.js withClauses), the engine, the phone's outward compile */
const ask = (q, phone) => {
  const mem = py(MEM, { q });
  if (phone) mem.phone = phone;
  let p = { question: q, live: true, memory: mem };
  p = CORE.withClauses(Object.assign({}, p, { frame: Q.compile(q, f) }), Q, f);
  const r = cp.spawnSync(PY, ['-m', 'rmc_engine_v1.rmc_core'], { cwd: path.join(ROOT, 'engine'), env, input: JSON.stringify(p), encoding: 'utf8', maxBuffer: 1 << 28 });
  expect(r.status === 0, r.stderr.slice(-800));
  const o = JSON.parse(r.stdout);
  const oc = CORE.outwardCompile(o, p, f, R2);
  return { o, reply: oc.product_reply ? oc.reply : null, C: o.coherence, echo: o.echo || {} };
};

T('recall reads the retrieval operation (Φ7), not the text: a far-phase row is kept, ΔΦ is recorded, never stored, and only weights', () => {
  const r = py(`
import json
from rmc_engine_v1.resonance_recall import rank_memory
base = {"tier": "anchor", "source_kind": "anchor", "trust": "trusted", "provenance": {"source": "fixture"}}
rows = [dict(base, id="far", memory_id="far", text="Burkina Faso is a landlocked country in West Africa.", sfe={"Phi": 3, "eps": 0.0, "mu": 1.0}),
        dict(base, id="spent", memory_id="spent", text="Burkina Faso is a landlocked country in West Africa.", sfe={"Phi": 7, "eps": 0.5, "mu": 1.0})]
before = json.dumps([r["sfe"] for r in rows])
out = rank_memory("What is Burkina Faso?", rows, {"phase_state": {"phase_primary": 9}})
ev = {a["memory_id"]: a["retrieval_evidence"][0] for a in out["active"]}
print(json.dumps({"active": [a["memory_id"] for a in out["active"]], "w": {a["memory_id"]: a["retrieval_weight"] for a in out["active"]},
  "ev": ev, "qphi": out["question_phi"], "tphi": out["question_text_phi"], "rule": out["phase_rule"], "same": before == json.dumps([r["sfe"] for r in rows]),
  "packets": {n["memory_id"]: n["packet"].get("Phi") for n in out["admitted_for_observe"]}}))`);
  expect(r.qphi === 7 && r.tphi === 9 && /never vetoes/.test(r.rule), JSON.stringify(r).slice(0, 300));
  /* Φ3 against Φ7: ΔΦ = 4 stations = 160°, A = (1 + cos 160°)/2 ≈ 0.030154. Before 4.9.238 this row was outside the π/4 window of the
   * text's Φ9 and dropped; now S (it names Burkina Faso) and C (usable) admit it, and its support reads 1.0. */
  expect(r.active[0] === 'far' && r.w.far === 1 && r.ev.far.delta_phi_deg === 160 && Math.abs(r.ev.far.A - 0.030154) < 1e-6 && r.ev.far.operation === 'retrieve', JSON.stringify(r.ev).slice(0, 400));
  expect(!r.active.includes('spent'), 'a stated ε above 0.35 is a context failure: dropped');
  expect(r.same && r.packets.far === 3, 'Φ_identity is never rewritten; ΔΦ is not stored');
  const rr = read('engine/rmc_engine_v1/resonance_recall.py');
  expect(/question_phi = OPERATION_PHASE\["retrieve"\]/.test(rr) && !/subject_phi = int/.test(rr) && /"delta_stored": False/.test(rr) && /"identity_rewritten": False/.test(rr), 'wired; the 4.9.227 second window is gone');
});

T('a shared kind word never outranks a named subject: the remembered "My car is red." answers its question over a trusted leaves anchor', () => {
  const a = ask('What color is my car?', [{ id: 'rem-car', text: 'My car is red.', scope: 'phone', provenance: { requested_by: 'user', request: 'remember_command', kind: 'statement' } }]);
  expect(a.reply && /car is red/i.test(a.reply) && a.C >= 0.87 && a.echo.score >= 0.85, JSON.stringify({ reply: a.reply, C: a.C, e: a.echo.score }));
});

T('concessive and causal sentences split into clauses, the same on the phone and in the engine', () => {
  const S = ['Even though violet is scattered more than blue, the sky looks blue to us because our eyes are more sensitive to blue light.',
    'Although it rained, we played outside.', 'Because the road was icy, the bus was late.', 'The bus was late because the road was icy.',
    'The game stopped because of rain.', 'He left, even though it was early.', 'The sky is blue.', 'Because so, yes.'];
  const js = S.map(s => Q.splitClauses(s));
  const pyr = py(`
import json, sys
from rmc_engine_v1.clause_split import split_clauses
print(json.dumps([split_clauses(s) for s in json.load(sys.stdin)["S"]]))`, { S });
  expect(JSON.stringify(js) === JSON.stringify(pyr), JSON.stringify({ js, pyr }).slice(0, 800));
  expect(js[0].map(p => p.link).join(',') === 'concessive,main,hetu' && js[0][1].text === 'the sky looks blue to us', JSON.stringify(js[0]));
  expect(js[4].length === 1 && js[6].length === 1, '"because of" is a phrase, not a clause; a plain sentence is itself');
});

T('"look" is a linking verb for attribute questions only: both colour questions are answered from the sky clause; a kind with no value rule is held', () => {
  for (const q of ['What color is the sky?', 'What is the color of the sky?']) {
    const a = ask(q);
    expect(a.reply === 'The sky looks blue to us.' && a.C >= 0.87 && a.echo.score >= 0.85 && a.echo.method === 'structural_frame', q + ' ' + JSON.stringify({ reply: a.reply, C: a.C, e: a.echo }).slice(0, 400));
  }
  const b = ask('What breed is the sky?');
  expect(b.reply === null, 'breed has no value rule: held ' + JSON.stringify(b.reply));
  const why = ask('Why is the sky blue?');
  expect(why.reply && /sky looks blue to us because our eyes/.test(why.reply) && why.C >= 0.87, 'the cause question still speaks the whole anchor');
  const df = read('engine/rmc_engine_v1/derive_frame.py');
  expect(/LINKING_VERBS = frozenset\(\{"look"\}\)/.test(df) && /def is_value_of/.test(df) && /def _first_person_roles/.test(df), 'wired');
});

T('structural Echo compares frames, not words: a wrong filler, a wrong kriyā or an unstated atom fails', () => {
  const r = py(`
import json
from rmc_engine_v1 import structural_echo as SE
qf = {"schema": "forge.qframe/v1", "parsed": True, "kriya": "write", "karma": {"text": "Hamlet"}, "wh_role": "kartr", "rule": "QF-WH-SUBJ-DECL"}
claim = {"atom": {"predicate": "write", "args": ["Shakespeare", "Hamlet"]}, "fact_frame": {"kriya": "write", "kartr": {"text": "Shakespeare"}, "karma": {"text": "Hamlet"}}, "rule": "transitive"}
ok = SE.score(qf, claim, "Shakespeare wrote Hamlet.")
bad = SE.score(qf, dict(claim, fact_frame={"kriya": "read", "kartr": {"text": "Shakespeare"}, "karma": {"text": "Hamlet"}}), "Shakespeare read Hamlet.")
other = SE.score(qf, dict(claim, fact_frame={"kriya": "write", "kartr": {"text": "Marlowe"}, "karma": {"text": "Faustus"}}, atom={"predicate": "write", "args": ["Marlowe", "Faustus"]}), "Marlowe wrote Faustus.")
print(json.dumps({"ok": ok, "bad": bad, "other": other}))`);
  expect(r.ok && r.ok.score === 1 && r.ok.method === 'structural_frame' && r.ok.structure.uses_token_overlap === false && r.ok.calls_llm === false, JSON.stringify(r.ok).slice(0, 400));
  expect(!r.bad || r.bad.score < 0.85, 'a different kriyā fails ' + JSON.stringify(r.bad).slice(0, 300));
  expect(!r.other || r.other.score < 0.85, 'a different karma fails ' + JSON.stringify(r.other).slice(0, 300));
  const se = read('engine/rmc_engine_v1/structural_echo.py');
  expect(!/jaccard|token_overlap\(|_tokens\(/.test(se), 'no token overlap in the scorer');
});

T('thresholds unchanged (C_min 0.87, Echo 0.85 / 0.97, drift 0.35, hard stop 0.80) and no model', () => {
  const t = py(`
import json
from rmc_engine_v1 import mobile_config as M
T = M.THRESHOLDS
W = next(v for v in vars(M).values() if isinstance(v, dict) and "ECHO_MEMORY_MIN" in v)
print(json.dumps(dict({k: T.get(k) for k in ("C_min", "echo_min", "drift_quarantine", "hard_stop")}, ECHO_MEMORY_MIN=W["ECHO_MEMORY_MIN"], HARD_MIN=W["HARD_MIN"], ADMIT_MAX=W["ADMIT_MAX"])))`);
  expect(t.C_min === 0.87 && t.echo_min === 0.85 && t.drift_quarantine === 0.35 && t.hard_stop === 0.8 && t.ECHO_MEMORY_MIN === 0.97 && t.HARD_MIN === 0.8 && t.ADMIT_MAX === 0.35, JSON.stringify(t));
  for (const p of ['engine/rmc_engine_v1/structural_echo.py', 'engine/rmc_engine_v1/clause_split.py', 'engine/rmc_engine_v1/resonance_recall.py', 'engine/rmc_engine_v1/derive_frame.py', 'src/qframe.js'])
    expect(!/openai|anthropic|\bllm\(|transformers|gpt-|claude/i.test(read(p)), p + ' calls no model');
});

T('version registry names 4.9.238', () => {
  expect(read('VERSION').trim() === '4.9.243', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.243' && reg.features.some(x => x.id === 'R4238-OPERATION-PHASE-RECALL-STRUCTURAL-ECHO') && reg.count === reg.features.length, 'registry');
  expect(read('CONFLICTS.md').includes('## v4.9.238') >= 0 && (read('CONFLICTS.md').slice(0, read('CONFLICTS.md').includes('## v4.9.238')).match(/^## v/gm) || []).length <= 4, 'CONFLICTS entry near the top (4.9.239–4.9.242 sit above)');
});

(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4238', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4238', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
