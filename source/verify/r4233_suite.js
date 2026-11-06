/* R4233 (4.9.233, Nic plan 229 step 5, pt258u + 9:27): Derive by frame match AND phase/band alignment. A fact or a
 * copula-chain conclusion answers only when its frame unifies with the phone's question frame and its placement is
 * phase-aligned with the question (grace = rpm·cos²δ, δ ≤ π/4); band relation and the 4.9.204 attraction rank aligned matches;
 * word coverage is a logged tie-break. No match is undetermined. These checks guard the wiring; the proof is the live Ask run
 * (CONFLICTS.md v4.9.233).
 * 4.9.236 (Nic, Memory Phase Invariance with Contextual Phase Alignment): the δ ≤ π/4 veto is superseded. ΔΦ to the
 * operation's phase is one factor of G = f(ΔΦ, S, C); the alignment reading is still recorded. Tests 1, 3 and 4 follow. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const CLOCK = () => '2026-11-05T10:00:00Z';
const kernel = () => { const K = require(ROOT + '/src/kernel.js'), F = require(ROOT + '/src/forge.js'); return F.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: CLOCK }); };
const clauses = texts => { const Q = require(ROOT + '/src/qframe.js'), f = kernel(); return texts.map(t => Q.clause(t, f)); };
const py = (code, input) => {
  const r = cp.spawnSync('python3', ['-c', code], { cwd: ROOT, input: JSON.stringify(input), env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }), encoding: 'utf8', maxBuffer: 1 << 26 });
  expect(r.status === 0, r.stderr.slice(-800));
  return JSON.parse(r.stdout.trim().split('\n').pop());
};

const qframes = qs => { const Q = require(ROOT + '/src/qframe.js'), f = kernel(); return qs.map(q => Q.compile(q, f)); };
const DERIVE = `
import json, sys
from rmc_engine_v1 import world_model_v1 as W
c = json.load(sys.stdin)
src = c.get("sources") or {}
ev = [dict({"id": "r%d" % i, "text": t, "clause": cl, "place": W.place_row({}, t, False)}, **({"source": src[t]} if t in src else {})) for i, (t, cl) in enumerate(zip(c["texts"], c["clauses"]))]
base, _ = W.seed_self_facts(W.empty_world())
world, tr = W.observe(base, ev)
out = []
for q, f in zip(c["qs"], c["frames"]):
    d = W.derive(world, q, c.get("path") or ["Φ1"], f if c.get("use_frame", True) else None)
    s = d.get("survivor") or {}
    out.append({"q": q, "status": d["status"], "reason": d["reason"], "mode": d.get("match_mode"), "text": s.get("text"), "spoken": d.get("derived_text"),
                "match": s.get("frame_match"), "align": s.get("alignment"), "gate": s.get("gate"), "trace": d.get("frame_trace"), "tie": s.get("coverage_tiebreak")})
print(json.dumps(out))`;
const run = (texts, qs, extra) => py(DERIVE, Object.assign({ texts, clauses: clauses(texts), qs, frames: qframes(qs) }, extra || {}));
const FACTS = ['A whale is a mammal.', 'A mammal is an animal.', 'An animal is a living thing.', 'Paris is the capital of France.',
  'Shakespeare wrote Hamlet.', 'Photosynthesis uses sunlight to make oxygen and sugar from water and carbon dioxide.'];

T('the question frame picks the fact: polar chain, copula, specificational copula, transitive gap', () => {
  const out = run(FACTS, ['Is a whale a living thing?', 'What is a whale?', 'What is the capital of France?', 'Who wrote Hamlet?']);
  const [polar, what, cap, who] = out;
  expect(polar.status === 'supported_only' && /^a whale is a living thing\.$/i.test(polar.text) && polar.match.rule === 'polar' && polar.match.filler === 'yes', JSON.stringify(polar));
  expect(/A whale is a mammal\. A mammal is an animal\. An animal is a living thing\. A whale is a living thing\./.test(polar.spoken), 'speaks its own chain: ' + polar.spoken);
  expect(what.text === 'A whale is a mammal.' && what.match.gap === 'pred' && what.match.filler === 'a mammal', JSON.stringify(what));
  expect(cap.text === 'Paris is the capital of France.' && cap.match.rule === 'copula_specificational' && cap.match.filler === 'Paris', JSON.stringify(cap));
  expect(who.text === 'Shakespeare wrote Hamlet.' && who.match.gap === 'kartr' && who.match.filler === 'Shakespeare', JSON.stringify(who));
  for (const r of out) expect(r.mode === 'frame_gate' && r.gate.passes === true && r.gate.S === 1 && r.gate.C === 1 && typeof r.tie === 'number', JSON.stringify(r));
});

T('no frame match is undetermined: oxygen does not get the photosynthesis sentence; "a mammal" is not answered by "a whale"', () => {
  const out = run(FACTS, ['What is oxygen?', 'What is a mammal?', 'Who wrote Macbeth?']);
  const [ox, mam, mac] = out;
  expect(ox.status === 'undetermined' && !ox.text && ox.reason === 'no fact frame unifies with the question frame', JSON.stringify(ox));
  expect(mam.text === 'A mammal is an animal.', 'predicational copula reads X as the kartr only: ' + JSON.stringify(mam));
  expect(mac.status === 'undetermined' && !mac.text, JSON.stringify(mac));
});

T('4.9.236: ΔΦ weighs a frame match (G = S·C·A) and no longer vetoes it; grace, band relation and the 204 attraction are still recorded', () => {
  const ok = run(['Paris is the capital of France.'], ['What is the capital of France?'], { path: ['Φ1'] })[0];
  const a = ok.align;
  const cos2 = Math.cos(a.delta_deg * Math.PI / 180) ** 2;
  expect(a.aligned && a.delta_deg <= 45 && Math.abs(a.grace - Math.round(a.rpm * cos2 * 1e6) / 1e6) < 1e-5, 'grace = rpm·cos²δ: ' + JSON.stringify(a));
  expect(['same', 'x3', 'x9', 'none'].includes(a.band_relation) && typeof a.band_weight === 'number' && typeof a.attraction_dh === 'number' && typeof a.coupling === 'number' && a.question_hz > 0, JSON.stringify(a));
  const g = ok.gate;
  expect(g.operation === 'retrieve' && g.phi_query === 7 && Math.abs(g.A - (1 + Math.cos(g.delta_phi_deg * Math.PI / 180)) / 2) < 1e-5 && Math.abs(g.G - g.S * g.C * g.A) < 1e-5, JSON.stringify(g));
  expect(g.delta_stored === false && g.identity_rewritten === false, 'ΔΦ is relational and never stored; Φ_identity is not rewritten');
  const off = run(['Paris is the capital of France.'], ['What is the capital of France?'], { path: ['Φ5'] })[0];
  expect(off.status === 'supported_only' && off.text === 'Paris is the capital of France.' && off.gate.phi_query === 7, 'the question-text path does not set Φ_query: ' + JSON.stringify(off.gate));
});

T('WM-NAME-OF: "my dog\'s name" is the proper-noun predicate of a copula fact on my dog; without a frame the old ranking runs', () => {
  const name = run(['My dog is Rex.', 'A dog is an animal.'], ["What is my dog's name?"], { sources: { 'My dog is Rex.': 'phone_kb' } })[0];
  expect(/^my dog's name is Rex\.$/i.test(name.text) && name.match.rule === 'WM-NAME-OF' && name.match.filler === 'Rex', JSON.stringify(name));
  const unscoped = run(['My dog is Rex.'], ["What is my dog's name?"])[0];
  expect(unscoped.status === 'undetermined' && /possessor scope/.test(unscoped.reason), 'a first-person memory that is not personal (phone_kb) does not answer: ' + JSON.stringify(unscoped));
  const other = run(['A dog is an animal.'], ["What is my dog's name?"])[0];
  expect(other.status === 'undetermined', 'a general dog fact does not answer a personal question: ' + JSON.stringify(other));
  const bare = run(FACTS, ['Is a whale a living thing?'], { use_frame: false })[0];
  expect(bare.mode == null && !bare.trace, 'no frame: coverage mode, labelled by the absent match_mode');
  const src = read('engine/rmc_engine_v1/derive_frame.py');
  expect(/_grace/.test(src) && /attract_dh/.test(src) && /relation\(/.test(src), 'uses the existing resonance, band and 204 code');
  expect(!/\b(llm|openai|anthropic|transformers)\b/i.test(src.replace(/calls_llm|LLM/g, '')), 'no model');
});

T('version registry names 4.9.233', () => {
  expect(read('VERSION').trim() === '4.9.247', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.247' && reg.features.some(f => f.id === 'R4233-DERIVE-FRAME-PHASE') && reg.count === reg.features.length, 'registry');
});

(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4233', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4233', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
