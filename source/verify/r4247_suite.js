/* R4247 (4.9.248): depth along the push, handbook densities, world-model state and spill,
 * buoyancy, heat, slope, a counterfactual follow-up, and a PySCF receipt that clears C.
 * Recorded publisher documents only. No live network. No test noun in the engine. */
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
const env = Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') + path.delimiter + ROOT });
const f = FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-06T12:00:00Z' });
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

T('a shallow box tips along its depth, and a square footprint still uses width', () => {
  const out = py(`
import json
from rmc_engine_v1.sim_device import tip_check, _geom, push_half
shallow = {"action":"push","body":{"shape":"box","height":1.23,"width":1.35,"depth":0.62,"mass":200},"surface":{"mu":0.4},"point":{"fraction":0.92}}
bottom = dict(shallow, point={"fraction":0.08})
square = {"action":"push","body":{"shape":"box","height":1.23,"width":1.35,"mass":200},"surface":{"mu":0.4},"point":{"fraction":0.92}}
print(json.dumps({
  "top": tip_check(shallow)["outcome"], "bot": tip_check(bottom)["outcome"],
  "half": push_half(shallow["body"]), "square_outcome": tip_check(square)["outcome"],
  "square_half": push_half(square["body"]), "geom": _geom(shallow["body"])[1]
}))`);
  expect(out.top === 'topple' && out.bot === 'slide', JSON.stringify(out));
  expect(Math.abs(out.half - 0.31) < 1e-9 && out.square_outcome === 'slide' && Math.abs(out.square_half - 0.675) < 1e-9, JSON.stringify(out));
  expect(out.geom.startsWith('0.310000'), out.geom);
});

T('wood plus metal is heavier than the wood shell, and a disagreeing fabric pair is not used', () => {
  const out = py(`
import json
from rmc_engine_v1.athena_props import resolve_objects, _density_of
def side(sid, materials):
    return {"id": sid, "url": "https://"+sid+".example/x", "records": [{
        "title": "cabinet", "objectType": "cabinet", "materials": materials,
        "dimensions": [
            {"dimension":"Height","value":100,"unit":"cm","part":""},
            {"dimension":"Width","value":80,"unit":"cm","part":""},
            {"dimension":"Depth","value":40,"unit":"cm","part":""}
        ]}]}
wood = resolve_objects("cabinet", [side("vam", ["oak"]), side("cleveland", ["oak"])], "cabinet", True)
both = resolve_objects("cabinet", [side("vam", ["oak", "cast iron"]), side("cleveland", ["oak", "steel"])], "cabinet", True)
wm = next(r["value"] for r in wood["ok"] if r["property"]=="mass")
bm = next(r["value"] for r in both["ok"] if r["property"]=="mass")
print(json.dumps({"wood": wm, "both": bm, "fabric": _density_of("fabric"), "hosts": sorted({h for r in both["ok"] for h in r["hosts"]})}))`);
  expect(out.both > out.wood && out.wood > 0 && out.fabric === null, JSON.stringify(out));
  expect(out.hosts.length >= 2 && out.hosts.every(h => !/wikipedia|wikidata/.test(h)), JSON.stringify(out.hosts));
});

T('two government hosts must both publish a curb weight; a class alone holds', () => {
  const out = py(`
import json
from rmc_engine_v1.athena_props import agree_vehicle, parse_nhtsa_specs, parse_epa_vehicle
nhtsa = parse_nhtsa_specs(json.dumps({"Results":[{"Specs":[{"Name":"OL","Value":"480"},{"Name":"OW","Value":"180"},{"Name":"OH","Value":"145"},{"Name":"CW","Value":"1500"}]}]}))
epa = {"height":1.46,"width":1.82,"depth":4.82,"mass":1520,"vclass":"Large Cars"}
ok = agree_vehicle("example", nhtsa, epa, "https://vpic.nhtsa.dot.gov/api/x", "https://www.fueleconomy.gov/ws/rest/x")
held = agree_vehicle("example", nhtsa, parse_epa_vehicle(json.dumps({"VClass":"Large Cars","id":"1"})), "https://vpic.nhtsa.dot.gov/api/x", "https://www.fueleconomy.gov/ws/rest/x")
print(json.dumps({"mass": next((r["value"] for r in ok["ok"] if r["property"]=="mass"), None), "held": held.get("held"), "hosts": ok["ok"][0]["hosts"] if ok["ok"] else []}))`);
  expect(out.mass > 1400 && out.mass < 1600 && out.held[0].reason === 'two_publishers_required', JSON.stringify(out));
  expect(out.hosts.every(h => !/wikipedia|wikidata/.test(h)), JSON.stringify(out.hosts));
});

T('a moon without two CORS publishers holds; two agreeing catalogs would admit', () => {
  const out = py(`
import json
from rmc_engine_v1.athena_props import agree_body, parse_quaero_sso, fetch_body
quaero = parse_quaero_sso(json.dumps({"data":[{"id":"x","name":"x","type":"Satellite"}]}))
one = agree_body("x", [{"id":"imcce","url":"https://ssp.imcce.fr/a","radius_m":1e6,"mass_kg":1e22}])
two = agree_body("x", [
  {"id":"imcce","url":"https://ssp.imcce.fr/a","radius_m":1.0e6,"mass_kg":1.0e22},
  {"id":"jpl","url":"https://pds.nasa.gov/a","radius_m":1.01e6,"mass_kg":1.02e22}
])
def http(url):
    if "ssocard" in url: raise RuntimeError("404")
    return json.dumps({"data":[{"id":"x","type":"Satellite","name":"x"}]})
live = fetch_body("x", http)
print(json.dumps({"quaero_mass": quaero.get("has_mass"), "one": one.get("held"), "two": any(r["property"]=="radius" for r in two["ok"]), "live": live.get("held")}))`);
  expect(out.quaero_mass === false && out.one[0].reason === 'two_publishers_required' && out.two === true, JSON.stringify(out));
  expect(out.live[0].reason === 'two_publishers_required' && out.live[0].jpl_cors === false, JSON.stringify(out.live));
});

T('topple plus a remembered hold spills the contents, with a why, and does not store the fact', () => {
  const q = 'What happens if you push a bottle near the top?';
  const fx = JSON.parse(read('server/sim_router/receipts_245.json')).receipts[q];
  const rec = py(`
import json, sys
from rmc_engine_v1.sim_device import seal
p, run = json.load(sys.stdin)
print(json.dumps(seal(p, run)))`, JSON.stringify([fx.problem, fx.run]));
  expect(rec.sha256 === fx.sha256, 'reseal changed the receipt hash');
  expect(rec.may_store_as_fact === false && rec.state_before && rec.state_after && rec.state_after.motion === 'topple', JSON.stringify(rec.state_after));
  expect(/exceeds the critical height/.test(rec.causal_reason), rec.causal_reason);
  const clause = Q.clause('The bottle holds water.', f);
  const row = ask(q, { phone: [{ id: 'h1', text: 'The bottle holds water.', clause }], simulation: rec.rows });
  expect(row.product_reply === true && row.coherence >= 0.87 && row.echo.score >= 0.85 && row.drift <= 0.35, JSON.stringify({ c: row.coherence, e: row.echo, d: row.drift, r: row.reply }));
  expect(/topples/.test(row.reply) && /spills the water/.test(row.reply) && /critical height/.test(row.reply), row.reply);
  const compiled = CORE.outwardCompile(row, { question: q }, f, null, Q);
  expect(compiled.product_reply === true, JSON.stringify(compiled.outward_compile));
});

T('buoyancy and heat come from the frame and the handbook, and a slope is compiled', () => {
  const floatQ = 'What happens if you put a block in water?';
  const sinkQ = 'What happens if you put a rock in oil?';
  const heatQ = 'What happens if you heat water to 120 degrees?';
  const warmQ = 'What happens if you heat 0.2 kilograms of water with 1000 watts for 60 seconds?';
  const slopeQ = 'What happens if you push a block near the top on a 30 degree ramp?';
  const frames = { floatQ: Q.compile(floatQ, f), sinkQ: Q.compile(sinkQ, f), heatQ: Q.compile(heatQ, f), warmQ: Q.compile(warmQ, f), slopeQ: Q.compile(slopeQ, f) };
  const out = py(`
import json, sys
from rmc_engine_v1.sim_device import plan, solve, seal, mujoco_job
body = json.load(sys.stdin)
def one(q, fr):
    p = plan(q, fr)
    if not p.get("ok"):
        return {"ok": False, "reason": p.get("reason"), "slope": (p.get("scene") or {}).get("slope_deg")}
    if p.get("solver") in ("buoyancy_ondevice", "thermal_ondevice"):
        rec = seal(p, solve(p))
        return {"ok": True, "effect": rec.get("effect_text"), "why": rec.get("causal_reason"), "after": rec.get("state_after"), "store": rec.get("may_store_as_fact")}
    job = mujoco_job(p["scene"])
    return {"ok": True, "slope": p["scene"].get("slope_deg"), "grav": job["xml"].split("gravity=\\"")[1].split("\\"")[0], "check": __import__("rmc_engine_v1.sim_device", fromlist=["tip_check"]).tip_check(p["scene"]).get("slope")}
print(json.dumps({k: one(body[k], body[k+"F"]) for k in ("floatQ","sinkQ","heatQ","warmQ","slopeQ")}))`,
    JSON.stringify({ floatQ, sinkQ, heatQ, warmQ, slopeQ, floatQF: frames.floatQ, sinkQF: frames.sinkQ, heatQF: frames.heatQ, warmQF: frames.warmQ, slopeQF: frames.slopeQ }));
  expect(/floats in water/.test(out.floatQ.effect) && /below the density/.test(out.floatQ.why) && out.floatQ.store === false, JSON.stringify(out.floatQ));
  expect(/sinks in oil/.test(out.sinkQ.effect) && /above the density/.test(out.sinkQ.why), JSON.stringify(out.sinkQ));
  expect(/boils/.test(out.heatQ.effect) && out.heatQ.after.phase === 'gas', JSON.stringify(out.heatQ));
  expect(/stays liquid/.test(out.warmQ.effect) && out.warmQ.after.temperature_c < 100 && out.warmQ.after.temperature_c > 80, JSON.stringify(out.warmQ));
  expect(out.slopeQ.slope === 30 && /^-?[0-9]/.test(out.slopeQ.grav) && !out.slopeQ.grav.startsWith('0 0'), JSON.stringify(out.slopeQ));
});

T('a follow-up keeps the prior patient and changes the named slot', () => {
  const ice = Q.compile('What if it is on ice?', f);
  const bottom = Q.compile('What if you push it near the bottom?', f);
  const out = py(`
import json, sys
from rmc_engine_v1.sim_karaka import continue_scene
from rmc_engine_v1.sim_device import plan
ice, bottom = json.load(sys.stdin)
prior = {"scene": {"verb":"push","action":"push","body":{"noun":"bottle","phrase":"a bottle"},"point":{"name":"top"},"surface":{"name":"table"}}}
measured = {"scene": {"verb":"push","action":"push","defaulted":[],"body":{"noun":"box","mass":200,"height":1.23,"width":1.35,"depth":0.62,"shape":"box"},"point":{"name":"top"},"surface":{"name":"wood"}}}
qi, qb = continue_scene(prior, ice), continue_scene(prior, bottom)
qm = continue_scene(measured, bottom)
planned = plan(qm)
body = (planned.get("scene") or {}).get("body") or {}
print(json.dumps({"ice": qi, "bottom": qb, "ice_surface": (plan(qi).get("scene") or {}).get("surface"), "bot_point": ((plan(qb).get("scene") or {}).get("point") or {}).get("name"), "kept": qm, "depth": body.get("depth"), "mass": body.get("mass"), "point": ((planned.get("scene") or {}).get("point") or {}).get("name")}))`,
    JSON.stringify([ice, bottom]));
  expect(/on ice/.test(out.ice) && out.ice_surface.name === 'ice', JSON.stringify(out));
  expect(out.bot_point === 'bottom', JSON.stringify(out));
  expect(/0\.62 meters deep/.test(out.kept) && out.depth === 0.62 && out.mass === 200 && out.point === 'bottom', JSON.stringify(out));
});

T('a valid PySCF receipt speaks with C at least 0.87 and names the energy below zero', () => {
  const q = 'What happens if you run Hartree-Fock on water?';
  const frame = Q.compile(q, f);
  const rec = py(`
import json, sys
from rmc_engine_v1.sim_device import plan, seal
q, fr = json.load(sys.stdin)
p = plan(q, fr)
run = {"solver":"pyscf_abinitio","engine":"pyscf test","outcome":"converge","measurements":{"molecule":"water","method":"RHF/6-31G","total_energy_hartree":-75.983972,"converged":True}}
print(json.dumps(seal(p, run, where="home_pc")))`, JSON.stringify([q, frame]));
  expect(/hartree below zero/.test(rec.effect_text) && /converged/.test(rec.causal_reason) && rec.may_store_as_fact === false, JSON.stringify(rec.effect_text));
  const row = ask(q, { phone: [], simulation: rec.rows });
  expect(row.product_reply === true && row.coherence >= 0.87 && row.echo.score >= 0.85 && row.drift <= 0.35, JSON.stringify({ c: row.coherence, e: row.echo, d: row.drift, r: row.reply }));
  expect(/below zero/.test(row.reply) && /converged/.test(row.reply), row.reply);
  const compiled = CORE.outwardCompile(row, { question: q }, f, null, Q);
  expect(compiled.product_reply === true && /compiled/.test(JSON.stringify(compiled.outward_compile.sentences)), JSON.stringify(compiled.outward_compile));
});

T('laws and version 4.9.248; the suite does not fetch the network', () => {
  expect(read('VERSION').trim() === '4.9.248', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.248' && reg.features.some(x => x.id === 'R4247-WORLD-SIM') && reg.count === reg.features.length, 'registry');
  expect(read('CONFLICTS.md').startsWith('## v4.9.248'), 'CONFLICTS');
  const T_ = py(`
import json
from rmc_engine_v1.mobile_config import THRESHOLDS as T
print(json.dumps({k: T.get(k) for k in ("C_min", "echo_min", "drift_quarantine", "hard_stop")}))`);
  expect(T_.C_min === 0.87 && T_.echo_min === 0.85 && T_.drift_quarantine === 0.35 && T_.hard_stop === 0.8, JSON.stringify(T_));
  const blob = read('engine/rmc_engine_v1/sim_device.py') + read('engine/rmc_engine_v1/athena_props.py') + read('src/sim_device.js');
  expect(!/sb_secret_|service_role/.test(blob) && !/openai|anthropic/.test(blob), 'no secret, no model');
});

const results = [];
for (const t of tests) {
  let ok = false, detail = '';
  try { t.fn(); ok = true; } catch (e) { detail = String(e && e.message || e).slice(0, 600); }
  results.push({ cls: 'R4247', name: t.name, ok, why: detail });
}
if (require.main === module) {
  console.log(JSON.stringify(results, null, 1));
  process.exit(results.every(r => r.ok) ? 0 : 1);
}
module.exports = results;
