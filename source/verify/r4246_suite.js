/* R4246 (4.9.246): simulators read the Pāṇini kāraka frame. Athena fills a missing property only when two
 * independent publishers agree. No noun is a special case. No hosted Supabase write. */
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
const PY = process.env.PYTHON || 'python3';
const env = Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') + path.delimiter + ROOT });
const f = FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-06T12:00:00Z' });
const py = (code, input) => {
  const r = cp.spawnSync(PY, ['-c', code], { cwd: ROOT, env, encoding: 'utf8', input: input || '', maxBuffer: 1 << 26 });
  expect(r.status === 0, (r.stderr || r.stdout || '').slice(-800));
  return JSON.parse(r.stdout.trim().split('\n').pop());
};

T('paraphrases of one push compile to the same kāraka scene', () => {
  const qs = [
    'What happens if you push a bottle near the top on ice?',
    'If a bottle is pushed near its top on ice, what happens?',
    'What happens when you push a bottle near the top on ice?',
  ];
  const frames = qs.map(q => Q.compile(q, f));
  expect(frames.every(fr => fr.conditional && fr.cond && fr.cond.kriya === 'push'), JSON.stringify(frames.map(fr => fr.cond && fr.cond.kriya)));
  const out = py(`
import json, sys
from rmc_engine_v1.sim_device import plan
qs = json.load(sys.stdin)
print(json.dumps([plan(q, fr) for q, fr in qs]))`, JSON.stringify(qs.map((q, i) => [q, frames[i]])));
  expect(out.every(p => p.ok && p.solver === 'mujoco_wasm' && p.scene.surface.name === 'ice' && p.scene.point.name === 'top'), JSON.stringify(out.map(p => [p.solver, p.reason, p.scene && p.scene.surface])));
  expect(out.every(p => p.scene.intervention_key === out[0].scene.intervention_key), out.map(p => p.scene.intervention_key).join(' | '));
});

T('molar-mass paraphrases are the same copula frame and the same RDKit problem', () => {
  const qs = ['What is the molar mass of aspirin?', 'What is the molecular weight of aspirin?', 'Aspirin has what molecular weight?'];
  const frames = qs.map(q => Q.compile(q, f));
  expect(frames.every(fr => fr.kriya === 'be' && fr.kartr && fr.kartr.of && /aspirin/i.test(fr.kartr.of.head || fr.kartr.of.text || '')), JSON.stringify(frames.map(fr => fr.kartr)));
  const out = py(`
import json, sys
from rmc_engine_v1.sim_device import plan
pairs = json.load(sys.stdin)
print(json.dumps([plan(q, fr) for q, fr in pairs]))`, JSON.stringify(qs.map((q, i) => [q, frames[i]])));
  expect(out.every(p => p.ok && p.solver === 'rdkit_wasm' && p.substance === 'aspirin'), JSON.stringify(out));
});

T('Athena: PubChem and ChEBI agree on an unlisted compound; a push with no two-publisher mass holds', () => {
  const massQ = 'What is the molar mass of theobromine?';
  const burnQ = 'What happens if you burn heptane?';
  const frames = { mass: Q.compile(massQ, f), burn: Q.compile(burnQ, f) };
  const out = py(`
import json, sys
from rmc_engine_v1.sim_device import plan
from rmc_engine_v1 import athena_props as A
body = json.load(sys.stdin)
theo = A.fetch_chemical("theobromine")
hep = A.fetch_chemical("heptane")
pm = plan(body["massQ"], body["mass"], theo["ok"])
pb = plan(body["burnQ"], body["burn"], hep["ok"])
print(json.dumps({"theo": theo, "hep_reactants": pb.get("reactants"), "pm": {"ok": pm.get("ok"), "solver": pm.get("solver"), "substance": pm.get("substance"), "reason": pm.get("reason")}, "pb_ok": pb.get("ok"), "pb_solver": pb.get("solver"), "hosts": (theo["ok"][0]["hosts"] if theo["ok"] else [])}))`,
    JSON.stringify({ massQ, burnQ, mass: frames.mass, burn: frames.burn }));
  expect(out.theo.ok.length >= 2 && out.theo.ok.some(r => r.property === 'formula' && r.value === 'C7H8N4O2'), JSON.stringify(out.theo));
  expect(out.hosts.length >= 2 && out.hosts.every(h => !/wikipedia|wikidata/.test(h)), JSON.stringify(out.hosts));
  expect(out.pm.ok && out.pm.solver === 'rdkit_wasm' && out.pm.substance === 'theobromine', JSON.stringify(out.pm));
  expect(out.pb_ok && out.pb_solver === 'chemistry_ondevice' && out.hep_reactants.includes('C7H16') && out.hep_reactants.includes('O2'), JSON.stringify(out));
});

T('a noun with no agreed dimensions is an honest hold, and the engine source does not name a test object', () => {
  const q = 'What happens if you push a wardrobe near the top?';
  const frame = Q.compile(q, f);
  const out = py(`
import json, sys
from rmc_engine_v1.sim_device import plan
q, fr = json.load(sys.stdin)
p = plan(q, fr, [])
print(json.dumps({"ok": p.get("ok"), "reason": p.get("reason"), "missing": p.get("missing")}))`, JSON.stringify([q, frame]));
  expect(out.ok === false && /unknown_body|property_missing/.test(out.reason), JSON.stringify(out));
  const skip = new Set(['kind_member_glosses.json', 'lexicon.json', 'lexicon-ext.json', 'lexicon-pro.json', 'rmc_engine_bundle.json']);
  const hits = [];
  const walk = dir => { for (const name of fs.readdirSync(dir)) { const p = path.join(dir, name); if (skip.has(name) || name === 'self_seed_202_demo.json' || name === 'self_seed_202_fixtures.json') continue; const st = fs.statSync(p); if (st.isDirectory()) { if (name === 'node_modules' || name === '__pycache__') continue; walk(p); } else if (/\.(py|js|json|md)$/.test(name) && fs.readFileSync(p, 'utf8').toLowerCase().includes('piano')) hits.push(path.relative(ROOT, p)); } };
  walk(path.join(ROOT, 'src')); walk(path.join(ROOT, 'engine')); walk(path.join(ROOT, 'data'));
  expect(hits.length === 0, 'piano is hardcoded in ' + hits.join(', '));
});

T('empty PORT does not crash the router, and new modules do not write Supabase', () => {
  const serve = read('server/sim_router/serve.py');
  expect(/int\(env_port\) if env_port else a\.port/.test(serve), 'PORT="" guard');
  const out = py(`
import json, os
os.environ["PORT"] = ""
env_port = os.environ.get("PORT")
print(json.dumps({"port": int(env_port) if env_port else 8790}))
`);
  expect(out.port === 8790, JSON.stringify(out));
  const blob = read('engine/rmc_engine_v1/athena_props.py') + read('engine/rmc_engine_v1/sim_karaka.py') + read('src/sim_device.js');
  expect(!/sb_secret_|service_role|supabase\.co\/rest/i.test(blob) && /supabase_write/.test(blob), 'no hosted write');
  expect(!/_CFD\s*=/.test(read('engine/rmc_engine_v1/sim_device.py')) && !/_MOL\s*=/.test(read('engine/rmc_engine_v1/sim_device.py')), 'question-template regexes removed');
});

T('laws and version 4.9.246', () => {
  expect(read('VERSION').trim() === '4.9.246', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.246' && reg.features.some(x => x.id === 'R4246-KARAKA-ATHENA') && reg.count === reg.features.length, 'registry');
  expect(read('CONFLICTS.md').startsWith('## v4.9.246'), 'CONFLICTS');
  const T_ = py(`
import json
from rmc_engine_v1.mobile_config import THRESHOLDS as T
print(json.dumps({k: T.get(k) for k in ("C_min", "echo_min", "drift_quarantine", "hard_stop")}))`);
  expect(T_.C_min === 0.87 && T_.echo_min === 0.85 && T_.drift_quarantine === 0.35 && T_.hard_stop === 0.8, JSON.stringify(T_));
});

const results = [];
for (const t of tests) {
  let ok = false, detail = '';
  try { t.fn(); ok = true; } catch (e) { detail = String(e && e.message || e).slice(0, 600); }
  results.push({ cls: 'R4246', name: t.name, ok, why: detail });
}
if (require.main === module) {
  console.log(JSON.stringify(results, null, 1));
  process.exit(results.every(r => r.ok) ? 0 : 1);
}
module.exports = results;
