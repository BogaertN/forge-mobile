/* Pyodide worker. Fetched pyodide.js is SHA-384 checked, then imported from a Blob URL. SymPy and Pint are the pinned forge-libs wheels (4.9.216).
 * The RMC reply is the engine's rendered answer when the admit gate passes. No model is called. */
'use strict';
let py = null;
async function sha384b64(buf) { const d = await crypto.subtle.digest('SHA-384', buf); let s = ''; for (const b of new Uint8Array(d)) s += String.fromCharCode(b); return btoa(s); }
async function init(o) {
  if (!py) {
    const res = await fetch(o.base + 'pyodide.js', { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'force-cache' }); if (!res.ok) throw new Error('pyodide_http_' + res.status);
    const buf = await res.arrayBuffer(); const got = 'sha384-' + await sha384b64(buf); if (got !== o.sri) throw new Error('pyodide_integrity_mismatch');
    importScripts(URL.createObjectURL(new Blob([buf], { type: 'text/javascript' })));
    py = await self.loadPyodide({ indexURL: o.base });
  }
  if (o.sympy !== false && !py._forgeSympy) { await installLibs(['sympy'], o.libs); py._forgeSympy = true; }
  let pint = false; if (o.pint) { try { await installLibs(['pint'], o.libs); pint = true; } catch (e) { pint = false; } }
  if (o.rmc) { py.FS.mkdirTree('/forge'); py.FS.writeFile('/forge/coherence_math.py', o.rmc); py.runPython('import sys\nsys.path.insert(0, "/forge")'); }
  return { ok: true, version: py.version, pint, sympy: !!py._forgeSympy }; }
const CHECK = `
import json, sympy as sp
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application, convert_xor
T = standard_transformations + (implicit_multiplication_application, convert_xor)
def P(s):
    s = s.replace('·', '*').replace('π', 'pi').replace('−', '-').replace('ln(', 'log(').replace('∛', 'cbrt').replace('√', 'sqrt').replace('⅓', '(1/3)').replace('arccos', 'acos')
    return parse_expr(s, transformations=T, local_dict={'e': sp.E, 'x': sp.Symbol('x'), 'cbrt': lambda z: sp.real_root(z, 3)})
def run(m):
    k = m.get('kind'); x = sp.Symbol(m.get('x') or 'x')
    if k == 'calculus' and m.get('op') == 'derivative':
        return sp.simplify(sp.diff(P(m['input']), x) - P(m['result'])) == 0
    if k == 'calculus' and m.get('a') is not None:
        v = sp.integrate(P(m['input']), (x, P(m['a']), P(m['b']))); r = m['result']
        return abs(float(sp.N(v)) - (float(sp.N(P(r))) if not r.startswith('≈') else float(r[1:]))) < 1e-6
    if k == 'calculus':
        return sp.simplify(sp.diff(P(m['result']), x) - P(m['input'])) == 0
    if k == 'simplified' and m.get('input'):
        return sp.simplify(P(m['input']) - P(m['result'])) == 0
    if k == 'solved':
        f = P(m['poly'].split('=')[0]) - P(m['poly'].split('=')[1]) if '=' in m['poly'] else P(m['poly'])
        roots = m.get('closed') or m.get('roots') or []
        return all(abs(complex(sp.N(f.subs(x, P(r.replace('± ', ''))))) ) < 1e-6 for r in roots if '±' not in r) if roots else True
    if k == 'math':
        return abs(float(sp.N(P(m['expr']))) - float(str(m['value']).replace('≈', ''))) < 1e-6
    return None
`;
async function check(m) { py.globals.set('mjson', JSON.stringify(m)); py.runPython(CHECK); const r = py.runPython('run(json.loads(mjson))'); return r === undefined ? null : r; }
async function rmcThresholds(src) { if (src) { py.FS.mkdirTree('/forge'); py.FS.writeFile('/forge/coherence_math.py', src); py.runPython('import sys, importlib\nsys.path.insert(0, "/forge") if "/forge" not in sys.path else None\nif "coherence_math" in sys.modules: importlib.reload(sys.modules["coherence_math"])'); } const r = py.runPython('import json, coherence_math\njson.dumps(coherence_math.gate_thresholds())'); return JSON.parse(r); }
/* 4.9.216: the math libraries. Each wheel is fetched from the pinned forge-libs URL (public read, no credentials), checked
 * against the SHA-256 shipped in FORGE_LIBS (fetch integrity and a second digest here) before anything is unpacked, and kept
 * in the Cache API so math works offline after first use. A mismatch is never installed and its cache entry is removed. */
const libsDone = new Set();
async function sha256hex(buf) { const d = new Uint8Array(await crypto.subtle.digest('SHA-256', buf)); let s = ''; for (const b of d) s += b.toString(16).padStart(2, '0'); return s; }
async function wheelBytes(w, cacheName) {
  let cache = null; try { cache = await caches.open(cacheName); } catch (e) { cache = null; }
  let res = cache ? await cache.match(w.url) : null; let from = 'cache';
  if (!res) { from = 'network'; res = await fetch(w.url, { credentials: 'omit', referrerPolicy: 'no-referrer', integrity: w.integrity, cache: 'no-store' }); if (!res.ok) throw new Error('forge_libs_http_' + res.status + '_' + w.name); }
  const buf = await res.arrayBuffer();
  if (await sha256hex(buf) !== w.sha256) { if (cache) { try { await cache.delete(w.url); } catch (e) {} } throw new Error('forge_libs_sha256_mismatch_' + w.name); }
  if (from === 'network' && cache) { try { await cache.put(w.url, new Response(buf.slice(0), { headers: { 'content-type': 'application/zip' } })); } catch (e) {} }
  return { buf, from };
}
async function installLibs(groups, libs) {
  if (!libs || !Array.isArray(libs.wheels) || !libs.groups) throw new Error('forge_libs_manifest_missing');
  const names = []; for (const g of groups || []) for (const n of (libs.groups[g] || [])) if (!names.includes(n)) names.push(n);
  const log = [];
  for (const name of names) {
    if (libsDone.has(name)) continue;
    const w = libs.wheels.find(x => x.name === name); if (!w) throw new Error('forge_libs_not_pinned_' + name);
    const { buf, from } = await wheelBytes(w, libs.cache || 'forge-libs-v1');
    py.FS.mkdirTree('/tmp/forge_libs'); py.FS.writeFile('/tmp/forge_libs/' + w.file, new Uint8Array(buf));
    py.globals.set('forge_whl', '/tmp/forge_libs/' + w.file);
    py.runPython('import zipfile, sysconfig\nwith zipfile.ZipFile(forge_whl) as z: z.extractall(sysconfig.get_paths()["purelib"])');
    libsDone.add(name); log.push({ name: w.name, version: w.version, sha256: w.sha256, verified: true, from });
  }
  py.runPython('import importlib\nimportlib.invalidate_caches()');
  return log;
}
async function mountEngine(o) {
  if (py.FS.analyzePath('/engine/rmc_engine_v1/rmc_core.py').exists) return;
  const res = await fetch(o.bundleUrl, { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'force-cache' }); if (!res.ok) throw new Error('rmc_bundle_http_' + res.status);
  const buf = await res.arrayBuffer(); const got = 'sha384-' + await sha384b64(buf); if (got !== o.bundleSri) throw new Error('rmc_bundle_integrity_mismatch');
  const pack = JSON.parse(new TextDecoder().decode(buf));
  py.FS.mkdirTree('/engine');
  for (const [rel, src] of Object.entries(pack.files || {})) {
    const parts = ('/engine/' + rel).split('/'); const file = parts.pop(); py.FS.mkdirTree(parts.join('/')); py.FS.writeFile(parts.concat(file).join('/'), src);
  }
  py.runPython('import sys\nsys.path.insert(0, "/engine") if "/engine" not in sys.path else None');
}
async function rmcAsk(arg) {
  if (!py) await init({ base: arg.base, sri: arg.sri, pint: false, sympy: false, rmc: null, libs: arg.libs });
  await mountEngine(arg);
  py.globals.set('payload_json', JSON.stringify(arg.payload || {}));
  const runOnce = () => JSON.parse(py.runPython('import json\nfrom rmc_engine_v1.rmc_core import run\njson.dumps(run(json.loads(payload_json)), default=str)'));
  let out = runOnce();
  if (Array.isArray(out.needs_libs) && out.needs_libs.length) {
    /* The engine understood a math question and asked for its libraries. Load the pinned wheels, then ask again. */
    let libs;
    try { libs = { rule: 'FORGE-LIBS-PINNED-SHA256', groups: out.needs_libs, installed: await installLibs(out.needs_libs, arg.libs) }; }
    catch (e) { libs = { rule: 'FORGE-LIBS-PINNED-SHA256', groups: out.needs_libs, error: String(e && e.message || e).slice(0, 200) }; }
    if (!libs.error) out = runOnce();
    out.libs = libs;
  }
  out.path = 'pyodide'; out.calls_llm = false; return out;
}
/* 4.9.245: on-device simulators. plan compiles the question (engine sim_device, the same code a Home PC runs); solve
 * loads the family's packages from the pinned Pyodide 0.27.7 lock (loadPackage checks each file's sha256 from the lock
 * and the browser caches it) and runs SymPy / SciPy / Biopython / astropy; finish reads a WASM engine's measurements;
 * each returns a sealed FORGE-SIM-RECEIPT/v1. */
const SIM_PY = `
import json
from rmc_engine_v1 import sim_device as S
a = json.loads(sim_json); op = a.get('op')
if op == 'plan':
    p = S.plan(a.get('question') or '', a.get('frame'), a.get('facts'))
    out = {'problem': p, 'job': S.mujoco_job(p['scene']) if p.get('solver') == 'mujoco_wasm' else None}
elif op == 'resolve':
    from rmc_engine_v1 import athena_props as A
    out = A.gilligan(a.get('rows') or [])
elif op == 'chem':
    from rmc_engine_v1 import athena_props as A
    pub = A.parse_pubchem(a.get('name') or '', a.get('pub') or '')
    che = A.parse_chebi_term(a.get('term') or '')
    out = A.gilligan(A.agree_chemical(a.get('name') or '', pub, che)) if pub and che else {'ok': [], 'held': [{'reason': 'publisher_missing'}], 'calls_llm': False, 'supabase_write': False}
elif op == 'objects':
    from rmc_engine_v1 import athena_props as A
    sides = []
    for side in a.get('sides') or []:
        got = A.museum_measures(side.get('records') or [], a.get('name') or '')
        if got:
            sides.append((side.get('id'), side.get('url'), got))
    out = A.gilligan(A.agree_objects(a.get('name') or '', sides)) if len(sides) >= 2 else {'ok': [], 'held': [{'reason': 'two_publishers_required', 'publishers': [s[0] for s in sides]}], 'calls_llm': False, 'supabase_write': False}
elif op == 'gaps':
    from rmc_engine_v1.sim_karaka import read
    out = read(a.get('question') or '', a.get('frame'), a.get('facts'))
elif op == 'solve':
    out = S.seal(a['problem'], S.solve(a['problem']))
elif op == 'finish':
    out = S.seal(a['problem'], S.finish(a['problem'], a['raw']))
else:
    out = S.hold_receipt(a.get('problem') or {}, a.get('reason') or 'hold')
json.dumps(out, default=str)
`;
const pkgsDone = new Set();
async function sim(arg) {
  if (!py) await init({ base: arg.base, sri: arg.sri, pint: false, sympy: false, rmc: null, libs: arg.libs });
  await mountEngine(arg);
  let packages = null;
  if (arg.op === 'solve') {
    const want = ((arg.problem && arg.problem.packages) || []).filter(n => /^[a-z0-9_-]+$/.test(n));
    const todo = want.filter(n => !pkgsDone.has(n));
    if (todo.length) { await py.loadPackage(todo, { checkIntegrity: true }); todo.forEach(n => pkgsDone.add(n)); }
    packages = { rule: 'PYODIDE-LOCK-SHA256', lock: 'pyodide 0.27.7', requested: want, loaded_now: todo };
  }
  py.globals.set('sim_json', JSON.stringify({ op: arg.op, question: arg.question, problem: arg.problem, raw: arg.raw, reason: arg.reason, frame: arg.frame, facts: arg.facts, rows: arg.rows, name: arg.name, pub: arg.pub, term: arg.term, sides: arg.sides }));
  const out = JSON.parse(py.runPython(SIM_PY));
  if (packages) out.packages = packages;
  return out;
}
self.onmessage = async e => { const { id, cmd, arg } = e.data || {}; try {
    let out; if (cmd === 'init') out = await init(arg); else if (cmd === 'check') out = { agree: await check(arg) }; else if (cmd === 'rmc') out = await rmcThresholds(arg); else if (cmd === 'rmcAsk') out = await rmcAsk(arg); else if (cmd === 'sim') out = await sim(arg); else throw new Error('unknown_cmd');
    self.postMessage({ id, ok: true, out }); } catch (err) { self.postMessage({ id, ok: false, error: String(err && err.message || err).slice(0, 200) }); } };
