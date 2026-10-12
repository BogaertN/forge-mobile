#!/bin/sh
# Forge Mobile release pipeline: run from a fresh clone with  sh source/tools/release.sh
#   1. prepare_clone.sh   decode binary inputs (git-ignored)
#   2. verify/run.js      the full suite: the source of release truth; writes only to the artifact dir
#   3. build.py           refuses unless verification passed on this exact tree; writes _release/site (Pages) + _release/single
#   4. verify_release.js  deployed-file hashes, one version / one total / one commit everywhere, CSP, secret scan, clean git tree
# Artifact dir: <repo>/_release (git-ignored), or $FORGE_ARTIFACT.
set -e
cd "$(dirname "$0")/.."
sh tools/prepare_clone.sh
node verify/run.js
python3 build.py
node tools/verify_release.js
echo "git status --porcelain:"; git status --porcelain; echo "(end)"
