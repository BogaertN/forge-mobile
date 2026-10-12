# Build: kernel-app.html (all code inlined; lexicon tiers lazily loaded from data/*.json.gz sidecars when served over http(s))
#        kernel-app-full.html (everything inlined incl. gzip+base64 lexicon tiers — works from file:// on a phone)
import subprocess; subprocess.run(['node', 'tools/build_catalog.js'], check=True, cwd=__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import base64, os, zipfile, gzip
os.chdir(os.path.dirname(os.path.abspath(__file__)))
import json, datetime
T0 = json.load(open('verify/summary.json')) if os.path.exists('verify/summary.json') else None
open('src/build-info.js', 'w').write('window.FORGE_BUILD=' + json.dumps({'version': '4.8.2', 'built': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC'), 'tests': T0}) + ';\n')
h = open('index.html').read()
h = h.replace('<link rel="stylesheet" href="styles.css">', '<style>' + open('styles.css').read() + '</style>')
for s in ['lexicon', 'sha256', 'kmath', 'algebra', 'grammar', 'infer', 'privacy', 'governance', 'containment', 'claims', 'features', 'release', 'toolbench', 'operator', 'crawler', 'legal_flags', 'consent', 'derive', 'calculus', 'sim', 'symbols', 'sonify', 'render', 'protoforge', 'ede', 'kernel', 'forge_spine', 'migrate', 'ledger', 'sync', 'drift_export', 'platform', 'lifecycle', 'stubs', 'transitions', 'fscript', 'shared', 'economy', 'toolbuilder', 'doctor', 'sim3d', 'nodeclient', 'forge', 'app', 'app_bench', 'pycheck', 'app_lab', 'app_extra']:
    js = open(f'src/{s}.js').read().replace('</script', '<\\/script')
    h = h.replace(f'<script src="src/{s}.js"></script>', '<script>' + js + '</script>')
h = h.replace('<script src="src/build-info.js"></script>', '<script>' + open('src/build-info.js').read() + '</script>')
h = h.replace('<script src="src/app_lab.js">', '<script src="src/app_lab.js">')  # (inlined above)
h = h.replace('</head>', '<script>window.KPY_WORKER_SRC=' + json.dumps(open('src/py_worker.js').read()).replace('</', '<\\/') + ';window.KRMC_PY=' + json.dumps(open('data/py/coherence_math.py').read()).replace('</', '<\\/') + ';</script></head>', 1)
ico = base64.b64encode(open('icons/icon-192.png', 'rb').read()).decode()
h = h.replace('<link rel="manifest" href="manifest.json">', '').replace('href="icons/icon-192.png"', 'href="data:image/png;base64,' + ico + '"')
import re, hashlib
def with_csp(doc):
    hs = sorted({"'sha256-" + base64.b64encode(hashlib.sha256(m.encode()).digest()).decode() + "'" for m in re.findall(r'<script>(.*?)</script>', doc, re.S)})
    pol = "default-src 'self'; script-src " + ' '.join(hs) + " 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net; worker-src 'self' blob:; connect-src 'self' https: data:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; media-src 'self' blob: mediastream:; object-src 'none'; base-uri 'none'; form-action 'none'"
    return re.sub(r'<meta http-equiv="Content-Security-Policy" content="[^"]*">', '<meta http-equiv="Content-Security-Policy" content="' + pol + '">', doc, count=1)
h = with_csp(h)
open('kernel-app.html', 'w').write(h)
core = base64.b64encode(open('data/lexicon.json.gz', 'rb').read()).decode()
ext = base64.b64encode(open('data/lexicon-ext.json.gz', 'rb').read()).decode()
inl = '<script>window.KLEX_CORE_GZ="' + core + '";window.KLEX_EXT_GZ="' + ext + '";</script>'
full = with_csp(h.replace('<script>', inl + '<script>', 1))
open('kernel-app-full.html', 'w').write(full)
print('kernel-app.html', len(h), 'kernel-app-full.html', len(full), 'gz(full)', len(gzip.compress(full.encode())))  # R5 (approved 2026-10-11): the zip artefact is no longer built
