#!/usr/bin/env python3
"""Regenerate test/external_fixtures.json from the AUTHORITATIVE private sources (run only where they exist).
Only hashes, sizes and counts are written; no private paper or private code content is copied into the repo.
  forge   rmc_engine_v1/coherence_math.py      -> sha256 + byte length of the exact file
  forge2  contracts/request_state.py           -> ordered RequestState enum member names, parsed with Python's ast (independent of the app's list),
                                                  hashed as sha256(",".join(names)) + count
Usage: python3 tools/make_external_fixtures.py <forge coherence_math.py> <forge2 request_state.py> [provenance note]"""
import ast, hashlib, json, sys, os
here = os.path.dirname(os.path.abspath(__file__)); out = os.path.join(here, '..', 'test', 'external_fixtures.json')
cm, rs = sys.argv[1], sys.argv[2]; note = sys.argv[3] if len(sys.argv) > 3 else ''
b = open(cm, 'rb').read()
tree = ast.parse(open(rs, encoding='utf8').read()); names = None
for n in ast.walk(tree):
    if isinstance(n, ast.ClassDef) and n.name == 'RequestState':
        names = [t.id for st in n.body if isinstance(st, ast.Assign) for t in st.targets if isinstance(t, ast.Name)]
assert names, 'RequestState enum not found'
doc = {'schema': 'forge-external-fixtures/v1', 'note': 'hashes only; the private sources are not redistributed. ' + note,
       'fixtures': {'forge.rmc_engine_v1.coherence_math': {'sha256': hashlib.sha256(b).hexdigest(), 'bytes': len(b), 'derived_by': 'sha256 of the exact file bytes'},
                    'forge2.contracts.request_state.RequestState': {'members_sha256': hashlib.sha256(','.join(names).encode()).hexdigest(), 'count': len(names), 'derived_by': 'python ast: ordered Assign targets of class RequestState, joined with ","'}}}
open(out, 'w').write(json.dumps(doc, indent=1, sort_keys=True) + '\n'); print('wrote', out, len(names), 'states')
