/* 4.9.290: a stated resistance is a problem quantity. A named material fills density; a class that disagrees does not. */
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const env = Object.assign({}, process.env, { PYTHONPATH: [path.join(ROOT, 'engine'), ROOT, path.join(ROOT, '_mathlibs')].join(path.delimiter) });
function py(code, arg) {
  const proc = cp.spawnSync('python3', ['-c', code, arg == null ? '' : JSON.stringify(arg)], { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 1 << 22, timeout: 60000 });
  if (proc.status !== 0) throw new Error((proc.stderr || proc.stdout || 'python').slice(-700));
  return JSON.parse(proc.stdout.trim().split('\n').pop());
}
function register(C, expect) {
  C('R4296', 'a resistor question keeps R, and a lexicon material fills density only when the handbooks agree', () => {
    const planned = py(`
import json
from rmc_engine_v1.sim_device import plan
p = plan("What happens if you put 4 volts across a 100 ohm resistor?")
print(json.dumps({"ok": p.get("ok"), "R": p.get("R"), "V": p.get("V")}))
`);
    expect(planned.ok === true && planned.R === 100 && planned.V === 4, JSON.stringify(planned));
    const words = py(`
import json
from rmc_engine_v1.athena_props import density_from_words
steel = density_from_words(["pin", "steel", "seawater"])
nail = density_from_words(["nail", "thin", "pointed", "piece", "metal", "hammered", "materials", "fastener", "seawater"])
print(json.dumps({"steel": steel, "nail": nail}))
`);
    expect(words.steel.ok === true && words.steel.ambiguous === false && words.steel.material === 'steel' && words.steel.rho > 7000 && words.steel.fact === false, JSON.stringify(words.steel));
    expect(words.nail.span === true && words.nail.ambiguous === true && words.nail.lo < words.nail.hi && words.nail.fact === false, JSON.stringify(words.nail));
    const sunk = py(`
import json, sys
from rmc_engine_v1.sim_device import plan, solve, seal
hit = json.loads(sys.argv[1])
facts = [{"head": "steel pin", "property": "density", "value": hit["rho"]}, {"head": "steel pin", "property": "material", "value": hit["material"]}]
p = plan("What happens if you put a steel pin in seawater?", None, facts)
run = solve(p)
rec = seal(p, run)
reason = next((a for a in rec.get("spoken_atoms") or [] if a.get("role") == "reason"), {})
print(json.dumps({"ok": p.get("ok"), "rho": p.get("rho_body"), "source": p.get("density_source"), "outcome": run.get("outcome"), "effect": rec.get("effect_text"), "why": rec.get("causal_reason"), "text": reason.get("text"), "atom": reason.get("atom")}))
`, words.steel);
    expect(sunk.ok === true && sunk.outcome === 'sink' && /steel/.test(sunk.source || '') && /kilograms per cubic meter/.test(sunk.why || ''), JSON.stringify(sunk));
    const LEX = require(path.join(ROOT, 'data/lexicon.json'));
    const EXT = require(path.join(ROOT, 'data/lexicon-ext.json'));
    const forge = require(path.join(ROOT, 'src/forge.js')).ForgeKernel({ store: require(path.join(ROOT, 'src/kernel.js')).MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-27T05:00:00Z' });
    const compiled = forge.outward(sunk.text, sunk.atom);
    expect(compiled.ok === true, JSON.stringify({ step: compiled.step, why: sunk.why, atom: sunk.atom, clause: compiled.clause_atom }));
    const src = require('fs').readFileSync(path.join(ROOT, 'src/sim_device.js'), 'utf8');
    const body = src.slice(src.indexOf('async function simulate'), src.indexOf('function propertyHold'));
    expect(/p\.ok && root\.KMechanisms/.test(body) && !/p\.ok && p\.scene && root\.KMechanisms/.test(body), 'a circuit problem has no scene');
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 900); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
