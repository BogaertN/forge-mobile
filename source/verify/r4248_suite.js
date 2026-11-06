/* R4248 (4.9.248): solver kāraka atoms pass through cause_effect and the world model into the outward
 * compile. No sentence split and no regex read-back of effect English. Novel asks only. No live network. */
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
const Q = require(ROOT + '/src/qframe.js');
const CORE = require(ROOT + '/src/rmc_core.js');
const PY = process.env.PYTHON || 'python3';
const env = Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') + path.delimiter + ROOT + path.delimiter + path.join(ROOT, '_mathlibs') + (process.env.PYTHONPATH ? path.delimiter + process.env.PYTHONPATH : '') });
const f = FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-06T18:00:00Z' });
const py = (code, input) => {
  const r = cp.spawnSync(PY, ['-c', code], { cwd: ROOT, env, encoding: 'utf8', input: input || '', maxBuffer: 1 << 26 });
  expect(r.status === 0, (r.stderr || r.stdout || '').slice(-800));
  return JSON.parse(r.stdout.trim().split('\n').pop());
};
const RUN = `import json, sys
from rmc_engine_v1.rmc_core import run
print(json.dumps(run(json.load(sys.stdin)), default=str))`;
const ask = (q, memory) => {
  let p = { question: q, live: true, memory: memory || { phone: [], simulation: [] }, frame: Q.compile(q, f) };
  p = CORE.withClauses(p, Q, f);
  const r = cp.spawnSync(PY, ['-c', RUN], { cwd: ROOT, env, encoding: 'utf8', input: JSON.stringify(p), maxBuffer: 1 << 26 });
  expect(r.status === 0, (r.stderr || '').slice(-800));
  return JSON.parse(r.stdout.trim().split('\n').pop());
};
const compiled = (row, q) => {
  const out = CORE.outwardCompile(row, { question: q }, f, null, Q);
  const oc = out.outward_compile;
  expect(out.product_reply === true && oc && oc.applied === true && oc.mode === 'compiled', JSON.stringify(oc));
  expect(oc.sentences.every(s => s.mode === 'compiled' && s.verbatim !== true), JSON.stringify(oc.sentences));
  expect(!oc.sentences.some(s => s.mode === 'quoted'), JSON.stringify(oc.sentences));
  return out;
};

T('the solver handoff does not reparse English into atoms', () => {
  const wm = read('engine/rmc_engine_v1/world_model_v1.py');
  const ce = read('engine/rmc_engine_v1/cause_effect.py');
  const sim = read('engine/rmc_engine_v1/sim_device.py');
  expect(!/def _compilable_atom/.test(wm) && !/def _sim_spoken_atoms/.test(wm), 'regex atom builders are gone');
  const step = ce.slice(ce.indexOf('def _solver_step'), ce.indexOf('def _spill_from_hold'));
  expect(step.includes('spoken_atoms') && !/_effect_atom_and_frame/.test(step), 'solver step does not reparse effect_text');
  expect(/def _spoken_from_run/.test(sim) && /def _effect_struct/.test(sim), 'atoms are built in the seal');
  expect(!/re\.split\(r"\(\?<=\[\.\!\?\]\)/.test(wm.slice(wm.indexOf('supplied = [a for a in (pred.get("spoken_atoms")'), wm.indexOf('def _spoken_atoms'))), 'no sentence split on the solver plan');
});

T('recorded receipts re-seal, and their atoms compile to the same sentence', () => {
  const q = 'What happens if you push a bottle near the top?';
  const fx = JSON.parse(read('server/sim_router/receipts_245.json')).receipts[q];
  const rec = py(`
import json, sys
from rmc_engine_v1.sim_device import seal
p, run = json.load(sys.stdin)
got = seal(p, run)
print(json.dumps({"sha": got["sha256"], "atoms": got["spoken_atoms"], "store": got["may_store_as_fact"]}))`, JSON.stringify([fx.problem, fx.run]));
  expect(rec.sha === fx.sha256 && rec.store === false, 'reseal');
  expect(rec.atoms.every(a => a.atom && a.atom.predicate && a.state_before && a.state_after), JSON.stringify(rec.atoms));
  for (const a of rec.atoms) {
    const r = f.outward(a.text, a.atom);
    expect(r.ok && r.R_t === a.text && r.step === 'compiled', a.text + ' ' + JSON.stringify(r));
  }
});

T('a shallow brick on concrete stays, the why compiles, and a follow-up keeps the brick', () => {
  const q = 'What happens if you push a 8 kilogram brick 0.09 meters tall near the top on concrete?';
  const slopeQ = 'What happens if you push a brick near the top on a 5 degree ramp?';
  const bottom = Q.compile('What if you push it near the bottom?', f);
  const out = py(`
import json, sys
from rmc_engine_v1.sim_device import plan, tip_check, seal
from rmc_engine_v1.sim_karaka import continue_scene
q, fr, slopeQ, slopeF, bottom = json.load(sys.stdin)
p = plan(q, fr)
chk = tip_check(p["scene"])
body = p["scene"]["body"]
run = {"solver":"mujoco_wasm","engine":"mujoco test","outcome":chk["outcome"],"measurements":{"final_tilt_deg":0,"horizontal_displacement_m":0}}
rec = seal(p, run)
sp = plan(slopeQ, slopeF)
schk = tip_check(sp["scene"])
srun = {"solver":"mujoco_wasm","engine":"mujoco test","outcome":"stay","measurements":{"final_tilt_deg":0,"horizontal_displacement_m":0}}
srec = seal(sp, srun)
prior = {"scene": {"verb":"push","action":"push","defaulted":[],"body":{"noun":body["noun"],"mass":body["mass"],"height":body["height"],"width":body["width"],"depth":body.get("depth"),"shape":body["shape"]},"point":{"name":"top"},"surface":{"name":"concrete"}}}
kept = continue_scene(prior, bottom)
planned = plan(kept)
b2 = (planned.get("scene") or {}).get("body") or {}
print(json.dumps({"outcome": chk.get("outcome"), "why": rec.get("causal_reason"), "atoms": rec.get("spoken_atoms"), "slope": (schk.get("slope") or {}).get("outcome"), "slope_why": srec.get("causal_reason"), "slope_atoms": srec.get("spoken_atoms"), "mass": body.get("mass"), "height": body.get("height"), "depth": body.get("depth"), "surface": p["scene"]["surface"]["name"], "kept_mass": b2.get("mass"), "kept_height": b2.get("height"), "point": ((planned.get("scene") or {}).get("point") or {}).get("name")}))`,
    JSON.stringify([q, Q.compile(q, f), slopeQ, Q.compile(slopeQ, f), bottom]));
  expect(out.outcome === 'stay' && out.mass === 8 && out.height === 0.09 && out.depth === 0.1025 && out.surface === 'concrete', JSON.stringify(out));
  expect(out.why === 'The static friction exceeds the push force.', out.why);
  expect(out.slope === 'stay' && out.slope_why === 'The static friction exceeds the downhill pull.', JSON.stringify(out));
  for (const a of out.atoms.concat(out.slope_atoms)) {
    const r = f.outward(a.text, a.atom);
    expect(r.ok && r.R_t === a.text && r.step === 'compiled', a.text + ' ' + JSON.stringify(r));
  }
  expect(out.kept_mass === 8 && out.kept_height === 0.09 && out.point === 'bottom', JSON.stringify(out));
});

T('a vase that topples spills remembered sand, and the clauses compile', () => {
  const q = 'What happens if you push a vase near the top on concrete?';
  const frame = Q.compile(q, f);
  const rec = py(`
import json, sys
from rmc_engine_v1.sim_device import plan, tip_check, seal
q, fr = json.load(sys.stdin)
p = plan(q, fr)
chk = tip_check(p["scene"])
run = {"solver":"mujoco_wasm","engine":"mujoco test","outcome":chk["outcome"],"measurements":{"final_tilt_deg":90 if chk["outcome"]=="topple" else 0}}
print(json.dumps(seal(p, run)))`, JSON.stringify([q, frame]));
  expect(rec.may_store_as_fact === false && rec.state_after && rec.state_after.motion === 'topple', JSON.stringify(rec.state_after));
  expect(rec.spoken_atoms.some(a => a.atom.predicate === 'topple') && rec.spoken_atoms.some(a => a.atom.predicate === 'exceed'), JSON.stringify(rec.spoken_atoms));
  const clause = Q.clause('The vase holds sand.', f);
  const row = ask(q, { phone: [{ id: 'h1', text: 'The vase holds sand.', clause }], simulation: rec.rows });
  expect(row.product_reply === true && row.coherence >= 0.87 && row.echo.score >= 0.85 && row.drift <= 0.35, JSON.stringify({ c: row.coherence, e: row.echo, d: row.drift, r: row.reply }));
  expect(/topples/.test(row.reply) && /spills the sand/.test(row.reply) && /critical height/.test(row.reply), row.reply);
  expect(row.may_store_as_fact !== true, 'simulation is not a fact');
  const out = compiled(row, q);
  expect(/spills the sand/.test(out.reply), out.reply);
});

T('a brick sinks in ethanol, a light block floats, and ethanol heated to 90 degrees boils', () => {
  const floatQ = 'What happens if you put a brick in ethanol?';
  const lightQ = 'What happens if you put a 0.4 kilogram block 0.2 meters tall and 0.2 meters wide and 0.2 meters deep in seawater?';
  const boilQ = 'What happens if you heat ethanol to 90 degrees?';
  const warmQ = 'What happens if you heat 0.4 kilograms of seawater with 800 watts for 30 seconds?';
  const frames = { floatQ: Q.compile(floatQ, f), lightQ: Q.compile(lightQ, f), boilQ: Q.compile(boilQ, f), warmQ: Q.compile(warmQ, f) };
  const out = py(`
import json, sys
from rmc_engine_v1.sim_device import plan, solve, seal
body = json.load(sys.stdin)
def one(q, fr):
    p = plan(q, fr)
    rec = seal(p, solve(p))
    ms = (rec.get("run") or {}).get("measurements") or {}
    return {"effect": rec.get("effect_text"), "why": rec.get("causal_reason"), "after": rec.get("state_after"), "store": rec.get("may_store_as_fact"), "atoms": rec.get("spoken_atoms"), "rho": ms.get("rho_body"), "fluid": ms.get("rho_fluid")}
print(json.dumps({k: one(body[k], body[k+"F"]) for k in ("floatQ","lightQ","boilQ","warmQ")}))`,
    JSON.stringify({ floatQ, lightQ, boilQ, warmQ, floatQF: frames.floatQ, lightQF: frames.lightQ, boilQF: frames.boilQ, warmQF: frames.warmQ }));
  expect(/sinks in ethanol/.test(out.floatQ.effect) && /above the density of ethanol/.test(out.floatQ.why) && out.floatQ.rho > 1500 && out.floatQ.rho > out.floatQ.fluid && out.floatQ.store === false, JSON.stringify(out.floatQ));
  expect(/floats in seawater/.test(out.lightQ.effect) && /below the density of seawater/.test(out.lightQ.why) && out.lightQ.rho < out.lightQ.fluid, JSON.stringify(out.lightQ));
  expect(/boils/.test(out.boilQ.effect) && out.boilQ.after.phase === 'gas', JSON.stringify(out.boilQ));
  expect(/stays liquid/.test(out.warmQ.effect) && out.warmQ.after.temperature_c < 100, JSON.stringify(out.warmQ));
  for (const key of ['floatQ', 'lightQ', 'boilQ', 'warmQ']) {
    for (const a of out[key].atoms) {
      const r = f.outward(a.text, a.atom);
      expect(r.ok && r.R_t === a.text, a.text + ' ' + JSON.stringify(r));
    }
  }
});

T('a can thrown at 40 degrees and nitrogen with hydrogen come from the solvers', () => {
  const throwQ = 'What happens if you throw a can at 40 degrees at 8 m/s?';
  const chemQ = 'What happens when nitrogen reacts with hydrogen?';
  const divQ = 'What happens if you put 9 volts across a 3k and 6k voltage divider?';
  const frames = { throwQ: Q.compile(throwQ, f), chemQ: Q.compile(chemQ, f), divQ: Q.compile(divQ, f) };
  const out = py(`
import json, sys
from rmc_engine_v1.sim_device import plan, solve, seal
body = json.load(sys.stdin)
def one(q, fr, live):
    p = plan(q, fr)
    if not live:
        return {"ok": p.get("ok"), "solver": p.get("solver"), "topology": p.get("topology"), "answered": "effect_text" in p}
    rec = seal(p, solve(p))
    return {"ok": True, "effect": rec.get("effect_text"), "store": rec.get("may_store_as_fact"), "atoms": rec.get("spoken_atoms")}
print(json.dumps({"throwQ": one(body["throwQ"], body["throwQF"], True), "chemQ": one(body["chemQ"], body["chemQF"], True), "divQ": one(body["divQ"], body["divQF"], False)}))`,
    JSON.stringify({ throwQ, chemQ, divQ, throwQF: frames.throwQ, chemQF: frames.chemQ, divQF: frames.divQ }));
  expect(/lands/.test(out.throwQ.effect) && /meters away/.test(out.throwQ.effect) && out.throwQ.store === false, JSON.stringify(out.throwQ));
  expect(/N2 \+ 3 H2 -> 2 NH3/.test(out.chemQ.effect) && out.chemQ.store === false, JSON.stringify(out.chemQ));
  expect(out.divQ.ok && out.divQ.solver === 'circuits_wasm' && out.divQ.topology === 'divider' && out.divQ.answered === false, JSON.stringify(out.divQ));
  for (const key of ['throwQ', 'chemQ']) {
    const rowAtoms = out[key].atoms;
    for (const a of rowAtoms) {
      const r = f.outward(a.text, a.atom);
      expect(r.ok && r.R_t === a.text, a.text + ' ' + JSON.stringify(r));
    }
    const q = key === 'throwQ' ? throwQ : chemQ;
    const rec = py(`
import json, sys
from rmc_engine_v1.sim_device import plan, solve, seal
q, fr = json.load(sys.stdin)
print(json.dumps(seal(plan(q, fr), solve(plan(q, fr)))))`, JSON.stringify([q, frames[key]]));
    const row = ask(q, { phone: [], simulation: rec.rows });
    expect(row.product_reply === true && row.coherence >= 0.87 && row.coherence < 1 && row.echo.score >= 0.85 && row.drift <= 0.35, q + ' ' + JSON.stringify({ c: row.coherence, e: row.echo, d: row.drift, r: row.reply }));
    compiled(row, q);
  }
});

T('a sim-ask reply merges measures or a named kind through the kāraka resume', () => {
  const q = 'What happens if you push a violin near the top?';
  const sized = Q.supplement('A baroque violin, 0.6 meters tall and 0.4 kilograms.', f);
  const wide = Q.supplement('0.6 meters tall, 0.2 meters wide, and 0.4 kilograms', f);
  const kind = Q.supplement('A cello.', f);
  expect(sized.stated.length >= 2 && /violin/i.test(sized.phrase || ''), JSON.stringify(sized));
  expect(wide.stated.length === 3 && !wide.phrase, JSON.stringify(wide));
  expect(/cello/i.test(kind.phrase || '') && kind.stated.length === 0, JSON.stringify(kind));
  const resumed = py(`
import json, sys
from rmc_engine_v1.sim_karaka import resume_pending
q, fr, sized, wide, kind = json.load(sys.stdin)
print(json.dumps({"sized": resume_pending(q, fr, sized), "wide": resume_pending(q, fr, wide), "kind": resume_pending(q, fr, kind)}))`,
    JSON.stringify([q, Q.compile(q, f), sized, wide, kind]));
  const planned = py(`
import json, sys
from rmc_engine_v1.sim_device import plan, tip_check
rows = json.load(sys.stdin)
out = {}
for name, row in rows.items():
    p = plan(row["question"], row["frame"])
    sc = p.get("scene") if isinstance(p.get("scene"), dict) else {}
    body = sc.get("body") if isinstance(sc.get("body"), dict) else {}
    chk = tip_check(sc) if sc.get("action") == "push" else None
    out[name] = {"plan": p.get("ok"), "reason": p.get("reason"), "mass": body.get("mass"), "height": body.get("height"), "width": body.get("width"), "depth": body.get("depth"), "noun": body.get("noun"), "outcome": (chk or {}).get("outcome"), "defaulted": sc.get("defaulted")}
print(json.dumps(out))`, JSON.stringify({
    sized: { question: resumed.sized.question, frame: Object.assign(Q.compile(resumed.sized.question, f), { derive_missing: !!resumed.sized.derive_missing }) },
    wide: { question: resumed.wide.question, frame: Object.assign(Q.compile(resumed.wide.question, f), { derive_missing: !!resumed.wide.derive_missing }) },
    kind: { question: resumed.kind.question, frame: Q.compile(resumed.kind.question, f) },
  }));
  expect(planned.sized.plan === true && planned.sized.mass === 0.4 && planned.sized.height === 0.6 && planned.sized.width === 0.6 && planned.sized.depth === 0.6 && planned.sized.outcome, JSON.stringify(planned.sized));
  expect(planned.wide.plan === true && planned.wide.mass === 0.4 && planned.wide.height === 0.6 && planned.wide.width === 0.2 && planned.wide.outcome, JSON.stringify(planned.wide));
  expect(resumed.kind.specific === true && /cello/.test(resumed.kind.question) && planned.kind.plan === false, JSON.stringify({ resumed: resumed.kind, planned: planned.kind }));
});

T('spoken solver clauses are measured, and C is not pinned to 1', () => {
  expect(!/gate\.get\("C"\) or 1\.0/.test(read('engine/rmc_engine_v1/world_claim_measure.py')), 'C pin still present');
  const q = 'What happens if you put a brick in ethanol?';
  const rec = py(`
import json, sys
from rmc_engine_v1.sim_device import plan, solve, seal
q, fr = json.load(sys.stdin)
print(json.dumps(seal(plan(q, fr), solve(plan(q, fr)))))`, JSON.stringify([q, Q.compile(q, f)]));
  const row = ask(q, { phone: [], simulation: rec.rows });
  expect(row.product_reply === true && row.coherence >= 0.87 && row.coherence < 1 && row.echo.score >= 0.85 && row.drift <= 0.35, JSON.stringify({ c: row.coherence, e: row.echo, d: row.drift, r: row.reply }));
  compiled(row, q);
});

T('a formula with an undigited element symbol still compiles', () => {
  const t = 'The reaction balances as 2 Mg + O2 -> 2 MgO.';
  const atom = { predicate: 'balance', args: ['the reaction'], polarity: 'pos', tense: 'present', modifiers: [{ role: 'upadhi', prep: 'as', text: '2 Mg + O2 -> 2 MgO' }] };
  const r = f.outward(t, atom);
  expect(r.ok && r.R_t === t && r.step === 'compiled', JSON.stringify(r));
});

T('an unknown body is held and nothing is stored', () => {
  const q = 'What happens if you push a quorble near the top?';
  const row = ask(q, { phone: [], simulation: [] });
  expect(row.product_reply === false && !row.reply, JSON.stringify({ r: row.reply, c: row.coherence, route: row.route }));
  const planned = py(`
import json, sys
from rmc_engine_v1.sim_device import plan
q, fr = json.load(sys.stdin)
p = plan(q, fr)
print(json.dumps({"ok": p.get("ok"), "reason": p.get("reason"), "missing": p.get("missing")}))`, JSON.stringify([q, Q.compile(q, f)]));
  expect(planned.ok === false && planned.reason === 'unknown_body', JSON.stringify(planned));
});

T('laws and version 4.9.248; no model and no secret', () => {
  expect(read('VERSION').trim() === '4.9.248', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.248' && reg.features.some(x => x.id === 'R4248-SOLVER-ATOMS') && reg.count === reg.features.length, 'registry');
  expect(read('CONFLICTS.md').startsWith('## v4.9.248'), 'CONFLICTS');
  const T_ = py(`
import json
from rmc_engine_v1.mobile_config import THRESHOLDS as T
print(json.dumps({k: T.get(k) for k in ("C_min", "echo_min", "drift_quarantine", "hard_stop")}))`);
  expect(T_.C_min === 0.87 && T_.echo_min === 0.85 && T_.drift_quarantine === 0.35 && T_.hard_stop === 0.8, JSON.stringify(T_));
  const blob = read('engine/rmc_engine_v1/sim_device.py') + read('engine/rmc_engine_v1/cause_effect.py') + read('engine/rmc_engine_v1/world_model_v1.py');
  expect(!/sb_secret_|service_role/.test(blob) && !/openai|anthropic/.test(blob), 'no secret, no model');
});

const results = [];
for (const t of tests) {
  let ok = false, detail = '';
  try { t.fn(); ok = true; } catch (e) { detail = String(e && e.message || e).slice(0, 800); }
  results.push({ cls: 'R4248', name: t.name, ok, why: detail });
}
if (require.main === module) {
  console.log(JSON.stringify(results, null, 1));
  process.exit(results.every(r => r.ok) ? 0 : 1);
}
module.exports = results;
