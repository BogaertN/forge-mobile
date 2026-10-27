/* Pyodide worker. Fetched pyodide.js is SHA-384 checked, then imported from a Blob URL. Packages use Pyodide's lock file.
 * Results are evidence: agree or disagree with the kernel. Never authority, never reply text. */
'use strict';
let py = null;
async function sha384b64(buf) { const d = await crypto.subtle.digest('SHA-384', buf); let s = ''; for (const b of new Uint8Array(d)) s += String.fromCharCode(b); return btoa(s); }
async function init(o) {
  if (py) return { ok: true, cached: true };
  const res = await fetch(o.base + 'pyodide.js', { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'force-cache' }); if (!res.ok) throw new Error('pyodide_http_' + res.status);
  const buf = await res.arrayBuffer(); const got = 'sha384-' + await sha384b64(buf); if (got !== o.sri) throw new Error('pyodide_integrity_mismatch');
  importScripts(URL.createObjectURL(new Blob([buf], { type: 'text/javascript' })));
  py = await self.loadPyodide({ indexURL: o.base }); await py.loadPackage(['sympy']);
  let pint = false; if (o.pint) { try { await py.loadPackage('micropip'); await py.runPythonAsync('import micropip\nawait micropip.install("pint")'); pint = true; } catch (e) { pint = false; } }
  if (o.rmc) { py.FS.mkdirTree('/forge'); py.FS.writeFile('/forge/coherence_math.py', o.rmc); py.runPython('import sys\nsys.path.insert(0, "/forge")'); }
  return { ok: true, version: py.version, pint }; }
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
self.onmessage = async e => { const { id, cmd, arg } = e.data || {}; try {
    let out; if (cmd === 'init') out = await init(arg); else if (cmd === 'check') out = { agree: await check(arg) }; else if (cmd === 'rmc') out = await rmcThresholds(arg); else throw new Error('unknown_cmd');
    self.postMessage({ id, ok: true, out }); } catch (err) { self.postMessage({ id, ok: false, error: String(err && err.message || err).slice(0, 200) }); } };
