/* 4.9.288: a disagreed class is an interval. The outcome is spoken when every figure is on one side of the fluid. */
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
  C('R4298', 'a density interval decides the outcome, and a crossing asks for the kind', () => {
    const decided = py(`
import json
from rmc_engine_v1.athena_props import density_from_words, place_interval
from rmc_engine_v1.sim_device import plan, solve, seal
from rmc_engine_v1.sim_karaka import resume_pending
metal = place_interval(density_from_words(["nail", "thin", "pointed", "piece", "metal", "seawater"]), "seawater")
bulk = place_interval(density_from_words(["toy", "bulk", "seawater"]), "seawater")
below = {"lo": 590, "hi": 740}
facts = [{"head": "nail", "property": "density_lo", "value": metal["lo"]}, {"head": "nail", "property": "density_hi", "value": metal["hi"]}, {"head": "nail", "property": "material", "value": metal.get("class")}]
p = plan("What happens if you put a nail in seawater?", None, facts)
run = solve(p)
rec = seal(p, run)
atoms = [a for a in rec.get("spoken_atoms") or [] if a.get("text") and a.get("atom")]
float_facts = [{"head": "cork", "property": "density_lo", "value": below["lo"]}, {"head": "cork", "property": "density_hi", "value": below["hi"]}, {"head": "cork", "property": "material", "value": "wood"}]
fp = plan("What happens if you put a cork in seawater?", None, float_facts)
frun = solve(fp)
frec = seal(fp, frun)
fatoms = [a for a in frec.get("spoken_atoms") or [] if a.get("text") and a.get("atom")]
resumed = resume_pending("What happens if you put a nail in seawater?", None, {"phrase": "steel"})
looked = density_from_words((resumed.get("question") or "").lower().split())
print(json.dumps({"metal": metal, "bulk": bulk, "outcome": run.get("outcome"), "atoms": atoms, "float_outcome": frun.get("outcome"), "float_atoms": fatoms, "resumed": resumed, "looked": looked}))
`);
    expect(decided.metal.determined === true && decided.metal.side === 'above' && decided.metal.lo === 2700 && decided.metal.hi === 8960 && decided.metal.fact === false, JSON.stringify(decided.metal));
    expect(decided.outcome === 'sink' && decided.atoms.length === 2, JSON.stringify(decided.atoms));
    expect(decided.bulk.straddles === true && decided.bulk.determined === false && decided.bulk.fact === false, JSON.stringify(decided.bulk));
    expect(decided.float_outcome === 'float' && decided.float_atoms.length === 2, JSON.stringify(decided.float_atoms));
    expect(decided.resumed.ok === true && /steel nail/.test(decided.resumed.question || '') && /seawater/.test(decided.resumed.question || ''), JSON.stringify(decided.resumed));
    expect(decided.looked.ok === true && decided.looked.span === false && decided.looked.material === 'steel' && decided.looked.rho > 7000, JSON.stringify(decided.looked));
    const LEX = require(path.join(ROOT, 'data/lexicon.json'));
    const EXT = require(path.join(ROOT, 'data/lexicon-ext.json'));
    const forge = require(path.join(ROOT, 'src/forge.js')).ForgeKernel({ store: require(path.join(ROOT, 'src/kernel.js')).MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-27T06:00:00Z' });
    decided.atoms.concat(decided.float_atoms).forEach(row => {
      const compiled = forge.outward(row.text, row.atom);
      expect(compiled.ok === true, JSON.stringify({ text: row.text, step: compiled.step, atom: row.atom }));
    });
    const senses = require(path.join(ROOT, 'src/senses.js'));
    const ask = senses.askText({ kind: 'sim', ask_kind: true, missing: 'kind', word: 'toy' }, false);
    expect(ask === 'What kind of toy is it?' && !/density/.test(ask), ask);
    const fromNoun = senses.askText({ kind: 'sim', ask_kind: true, missing: 'kind', word: 'it', patient: 'nail' }, false);
    expect(fromNoun === 'What kind of nail is it?' && !/kind of it/.test(fromNoun), fromNoun);
    const senseSrc = require('fs').readFileSync(path.join(ROOT, 'src/senses.js'), 'utf8');
    expect(senseSrc.includes('clauseText') && !senseSrc.includes("'What kind of '"), 'the kind question is a clause');
    const src = require('fs').readFileSync(path.join(ROOT, 'src/sim_device.js'), 'utf8');
    const body = src.slice(src.indexOf('p.missing === \'density\''), src.indexOf('if (p && p.ok && p.scene)'));
    expect(body.indexOf('hit.determined') >= 0 && body.indexOf('hit.determined') < body.indexOf('hit.rho') && /fluid: p\.fluid/.test(body), 'the interval is decided before a single density');
    const worker = require('fs').readFileSync(path.join(ROOT, 'src/py_worker.js'), 'utf8');
    expect(/fluid: arg\.fluid/.test(worker), 'the fluid reaches the interval comparison');
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 900); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
