/* R4236 (4.9.236, Nic 10:39 CST): Memory Phase Invariance with Contextual Phase Alignment. A memory keeps its native
 * phase Φ_identity; Φ_query is the phase of the operation (retrieval = Φ7), not of the question text; ΔΦ is relational
 * and never stored; the gate is G = f(ΔΦ, S, C) and phase alignment never creates a match. The operation is modelled,
 * not the question: name, breed and owner asks read the same memory. These checks guard the wiring; the proof is the
 * live Ask run (CONFLICTS.md v4.9.236). */
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
const Q = require(ROOT + '/src/qframe.js');
const py = (code, input) => {
  const r = cp.spawnSync('python3', ['-c', code], { cwd: ROOT, input: JSON.stringify(input || {}), env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }), encoding: 'utf8', maxBuffer: 1 << 26 });
  expect(r.status === 0, r.stderr.slice(-800));
  return JSON.parse(r.stdout.trim().split('\n').pop());
};
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
    d = W.derive(world, q, c.get("path") or ["Φ1"], f)
    s = d.get("survivor") or {}
    out.append({"q": q, "status": d["status"], "reason": d["reason"], "text": s.get("text"), "spoken": d.get("derived_text"), "how": s.get("how"),
                "checker_ok": s.get("checker_ok"), "debate": (s.get("debate") or {}).get("survived"), "gate": s.get("gate"), "perspective": s.get("perspective"),
                "facts": [f.get("text") for f in world.get("facts") or []][-4:]})
print(json.dumps(out))`;
const run = (texts, qs, extra) => {
  const f = kernel();
  return py(DERIVE, Object.assign({ texts, clauses: texts.map(t => Q.clause(t, f)), qs, frames: qs.map(q => Q.compile(q, f)) }, extra || {}));
};
const DOG = { sources: { 'My dog is Rex.': 'phone_kb' } };

T('one memory, three operations: name and owner are derived by replayed rules; breed holds; Φ_identity is not rewritten', () => {
  const [name, owner, breed] = run(['My dog is Rex.', 'A whale is a mammal.'], ["What is my dog's name?", 'Who owns Rex?', 'What breed is my dog?'], DOG);
  expect(name.status === 'supported_only' && name.how === 'WM-NAME-OF' && /^my dog's name is Rex\.$/i.test(name.text) && name.checker_ok && name.debate, JSON.stringify(name));
  expect(name.spoken === "Your dog is Rex. Your dog's name is Rex." && name.perspective === 'listener', 'spoken to the listener: ' + name.spoken);
  expect(owner.status === 'supported_only' && owner.how === 'WM-OWNER-OF' && owner.text === 'I own Rex.' && owner.checker_ok && owner.debate, JSON.stringify(owner));
  expect(owner.spoken === 'Your dog is Rex. You own Rex.', 'owner spoken: ' + owner.spoken);
  expect(breed.status === 'undetermined' && !breed.text, 'no breed is stored, so the copula with a kind holds: ' + JSON.stringify(breed));
  for (const r of [name, owner]) {
    const g = r.gate;
    expect(g.operation === 'retrieve' && g.phi_query === 7 && g.passes && g.S === 1 && g.C === 1, JSON.stringify(g));
    expect(g.delta_stored === false && g.identity_rewritten === false && Math.abs(g.G - g.A) < 1e-6, JSON.stringify(g));
  }
  expect(name.gate.phi_identity === owner.gate.phi_identity && name.gate.delta_phi_deg === owner.gate.delta_phi_deg, 'the same memory keeps the same phase for both asks');
});

T('the checker replays the new rules: the honest proofs pass, a forged conclusion ("Max") or a common-noun name fails', () => {
  const f = kernel();
  const r = py(`
import json, sys
from rmc_engine_v1 import world_model_v1 as W
c = json.load(sys.stdin)
ev = [{"id": "r%d" % i, "text": t, "clause": cl, "place": W.place_row({}, t, False), "source": "phone_kb"} for i, (t, cl) in enumerate(zip(c["texts"], c["clauses"]))]
base, _ = W.seed_self_facts(W.empty_world())
world, _ = W.observe(base, ev)
fact = {f["text"]: f for f in world["facts"]}
def proof(text, rule, sub, head):
    fa = fact[text]
    concl = W._atom(head[0], head[1], "pos")
    return W.check_proof(world, W._proof_shell(world, concl, [
        {"n": 1, "kind": "fact", "fact_id": fa["id"], "premises": [], "substitution": {}, "atom": fa["atom"]},
        {"n": 2, "kind": "rule", "rule_id": rule, "premises": [1], "substitution": sub, "atom": concl}]))["ok"]
print(json.dumps([
  proof("My dog is Rex.", "WM-NAME-OF", {"$x": "My dog", "$n": "Rex"}, ("is", ["My dog's name", "Rex"])),
  proof("My dog is Rex.", "WM-NAME-OF", {"$x": "My dog", "$n": "Rex"}, ("is", ["My dog's name", "Max"])),
  proof("My dog is a beagle.", "WM-NAME-OF", {"$x": "My dog", "$n": "a beagle"}, ("is", ["My dog's name", "a beagle"])),
  proof("My dog is Rex.", "WM-OWNER-OF", {"$owned": "My dog", "$n": "Rex", "$o": "I"}, ("owns", ["I", "Rex"])),
  proof("My dog is Rex.", "WM-OWNER-OF", {"$owned": "My dog", "$n": "Rex", "$o": "I"}, ("owns", ["I", "Max"])),
]))`, { texts: ['My dog is Rex.', 'My dog is a beagle.'], clauses: ['My dog is Rex.', 'My dog is a beagle.'].map(t => Q.clause(t, f)) });
  expect(JSON.stringify(r) === JSON.stringify([true, false, false, true, false]), JSON.stringify(r));
});

T('phase alignment never creates a match, and a first-person memory must be personal (phone_kb)', () => {
  const [ox] = run(['Photosynthesis uses sunlight to make oxygen.'], ['What is oxygen?'], { path: ['Φ7'] });
  expect(ox.status === 'undetermined' && !ox.text, 'Φ_query = Φ7 with no frame match is still undetermined: ' + JSON.stringify(ox));
  const [own] = run(['My dog is Rex.'], ['Who owns Rex?']);
  expect(own.status === 'undetermined' && /possessor scope/.test(own.reason), JSON.stringify(own));
  const [oth] = run(['A dog is an animal.'], ['Who owns Rex?'], DOG);
  expect(oth.status === 'undetermined', JSON.stringify(oth));
});

T('G = S·C·(1 + cos ΔΦ)/2; Φ9 against Φ7 is 80° and weighs 0.586824', () => {
  const r = py(`
import json
from rmc_engine_v1 import derive_frame as DF
a = DF.phase_factor(9, 7); b = DF.phase_factor(7, 7)
print(json.dumps({"a": a, "b": b, "op": DF.operation({"kriya": "own"}), "phi": DF.OPERATION_PHASE}))`);
  expect(r.a.delta_phi_deg === 80 && Math.abs(r.a.A - 0.586824) < 1e-6 && r.b.A === 1, JSON.stringify(r));
  expect(r.op === 'retrieve' && r.phi.retrieve === 7, 'the operation, not the question, sets Φ_query');
});

T('deixis: a personal memory is spoken to the listener and measured as stored', () => {
  const r = py(`
import json
from rmc_engine_v1.world_model_v1 import to_listener
print(json.dumps([to_listener(t) for t in ["My dog is Rex.", "I own Rex.", "my dog's name is Rex.", "A whale is a mammal."]]))`);
  expect(JSON.stringify(r) === JSON.stringify(['Your dog is Rex.', 'You own Rex.', "Your dog's name is Rex.", 'A whale is a mammal.']), JSON.stringify(r));
  const src = read('engine/rmc_engine_v1/world_claim_measure.py');
  expect(/measured_as/.test(src) && /memory\.phase_identity/.test(src) && /derive\.gate\.G/.test(src), 'measured in the stored person and phase; weight G');
  expect(/phase_state=state, phase_path_hypothesis=list\(reading\["phase_path"\]\)/.test(src), 'routed on the memory phase path');
  const t = py(`
import json
from rmc_engine_v1.rmc_core import _trust_trace
rows = [{"id": "m", "text": "My dog is Rex.", "source": "phone_kb"}, {"id": "w", "text": "Rex is a name.", "source": "research_quarantine"}]
print(json.dumps([_trust_trace("Your dog is Rex. You own Rex.", rows, [])["rests_on"], _trust_trace("Your dog is Rex.", [dict(rows[0], source="lookup")], [])["rests_on"]]))`);
  expect(t[0] === 'm' && t[1] === null, 'a personal row rests in the listener person; a non-personal row does not: ' + JSON.stringify(t));
});

T('Echo: the asked relation is re-read; "own" covers "owns" by agreement only; a non-answer still fails', () => {
  const r = py(`
import json
from rmc_engine_v1.echo_question import echo_against_question as E
print(json.dumps([E("Who owns Rex?", "Your dog is Rex. You own Rex.", rendered=True)["score"],
                  E("What is my dog's name?", "Your dog is Rex. Your dog's name is Rex.", rendered=True)["score"],
                  E("Who owns Rex?", "Rex is a dog.", rendered=True)["score"],
                  E("What is my dog's name?", "Your dog is Rex.", rendered=True)["score"],
                  E("How do lightbulbs work?", "A lightbulb glows when current flows.", rendered=True)["score"]]))`);
  expect(r[0] === 1 && r[1] === 1 && r[2] < 0.85 && r[3] < 0.85 && r[4] === 0, JSON.stringify(r));
  const R = require(path.join(ROOT, 'src', 'rmc_renderer_200.js'));
  const js = q_a => R.run({ op: 'render', question: q_a[0], candidate: q_a[1], charge: 0.55, drift: 0.2, chi: 0 }).echo.score;
  expect(js(['Who owns Rex?', 'Your dog is Rex. You own Rex.']) === r[0] && js(['How do lightbulbs work?', 'A lightbulb glows when current flows.']) === r[4], 'the renderer copy reads the same');
});

T('qframe: "What breed is my dog?" is the copula on my dog with a kind gap', () => {
  const f = Q.compile('What breed is my dog?', kernel());
  expect(f.rule === 'QF-WH-DET-COP-SUBJ' && f.kriya === 'be' && f.kartr.text === 'my dog' && f.pred.kind === 'breed' && f.wh_role === 'pred', JSON.stringify(f));
});

T('thresholds unchanged and no model', () => {
  const th = py(`
import json
from rmc_engine_v1.mobile_config import THRESHOLDS
print(json.dumps(THRESHOLDS))`);
  expect(th.C_min === 0.87 && th.echo_min === 0.85, JSON.stringify(th));
  for (const f of ['derive_frame.py', 'world_model_v1.py', 'world_claim_measure.py', 'echo_question.py', 'relation_echo.py', 'language_core_debate.py']) {
    const src = read('engine/rmc_engine_v1/' + f);
    expect(!/\b(openai|anthropic|transformers)\b/i.test(src) && !/import\s+(torch|openai)/.test(src), 'no model: ' + f);
  }
});

T('version registry names 4.9.236', () => {
  expect(read('VERSION').trim() === '4.9.236', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.236' && reg.features.some(f => f.id === 'R4236-PHASE-INVARIANCE-GATE') && reg.count === reg.features.length, 'registry');
});

(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4236', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4236', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
