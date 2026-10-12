# forge-mobile source + verifier

This folder is the full source of the app published at the repository root: kernel, derivation rules, build scripts and the complete verifier (`verify/run.js` plus the suite files it runs). Large and binary inputs (lexicon, icons, vendored three.js / cannon-es) are not duplicated here; `tools/prepare_clone.sh` rebuilds them from the published copies at the repo root.

Reproduce the full run from a fresh clone (Node ≥ 20, Python 3 with sympy):

```
git clone https://github.com/BogaertN/forge-mobile.git && cd forge-mobile/source && sh tools/prepare_clone.sh && python3 build.py && python3 tools/make_deploy.py && node verify/run.js
```

`node verify/run.js` prints one PASS/FAIL line per check and ends with `TOTAL passed/total`. It also rewrites `verify/results.json`, `verify/REPORT.md` and `verify/summary.json` (generated records, not committed). Checks that compare against the private forge/forge2 repositories or the private papers only run where those files exist locally.
