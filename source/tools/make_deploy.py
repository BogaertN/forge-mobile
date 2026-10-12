#!/usr/bin/env python3
"""Copy the shippable app into /workspace/deploy and write BUILD_MANIFEST.json (sha256 of every shipped file) — Register B-04/FB-25."""
import hashlib, json, os, shutil, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('FORGE_DEPLOY', os.path.join(os.path.dirname(ROOT), 'deploy'))
FILES = ['index.html', 'manifest.json', 'styles.css', 'sw.js', 'data/lexicon.json.gz', 'data/lexicon-ext.json.gz', 'data/WORDNET_LICENSE.txt', 'data/SBOM.json', 'data/command_catalog.json', 'data/py/coherence_math.py', 'icons/icon-192.png', 'icons/icon-512.png', 'vendor/three.module.min.js', 'vendor/cannon-es.js', 'vendor/LICENSE.three.txt', 'vendor/LICENSE.cannon-es.txt'] + ['src/' + f for f in sorted(os.listdir(os.path.join(ROOT, 'src'))) if f.endswith('.js')]
if os.path.isdir(OUT): shutil.rmtree(OUT)
man = []
for f in FILES:
    os.makedirs(os.path.dirname(os.path.join(OUT, f)) or OUT, exist_ok=True); shutil.copyfile(os.path.join(ROOT, f), os.path.join(OUT, f))
    b = open(os.path.join(OUT, f), 'rb').read(); man.append({'path': f, 'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest()})
bi = open(os.path.join(ROOT, 'src/build-info.js')).read(); ver = bi.split('"version": "')[1].split('"')[0] if '"version": "' in bi else '?'
doc = {'schema': 'forge-mobile-build-manifest/v1', 'version': ver, 'files': man}; doc['manifest_sha256'] = hashlib.sha256(json.dumps(man, sort_keys=True).encode()).hexdigest()
json.dump(doc, open(os.path.join(OUT, 'BUILD_MANIFEST.json'), 'w'), indent=1); print(OUT, len(man), 'files', doc['manifest_sha256'][:16])
