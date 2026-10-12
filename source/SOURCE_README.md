# forge-mobile source and verifier

This folder holds the complete source of the published app, the build script and the verifier. The binary inputs (gzipped lexicon, icons, vendored three.js / cannon-es) are stored at the repository root as `*.b64` or vendor files. `tools/prepare_clone.sh` decodes them into git-ignored paths.

Release command, run from a fresh clone (Node 20; Python 3 with `cryptography`):

```
git clone https://github.com/BogaertN/forge-mobile.git && cd forge-mobile && sh source/tools/release.sh
```

See `README.md` in this folder and at the repo root for the pipeline order: verify → build → release check. All outputs go to `<repo>/_release/`, which is git-ignored. No tracked file is written. Checks that compare against private forge/forge2 repositories or private papers run only where those files exist locally. When the files are absent, the check is skipped, but it still counts in the total, so totals do not depend on the machine.
