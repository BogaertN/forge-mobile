#!/bin/sh
# Forge Mobile publish pipeline with the TARGETED gate (Nic, 2026-10-21 4:49 PM: the full release.sh gate is dropped).
#   1. prepare_clone.sh   2. verify/targeted.js (suites in verify/targeted.json)   3. build.py   4. verify_release.js
#   (4.9.215: the old live probe tools/live_probe.js drove ForgeKernel.process and is deleted with the old answer path; the live check is
#    tools/verify_live.js plus the headless Ask probe after Pages deploys)
set -e
cd "$(dirname "$0")/.."
sh tools/prepare_clone.sh
node verify/targeted.js
python3 build.py
node tools/verify_release.js
# The preview/ folder on main is a static copy of another build. It is not part of the
# 4.9.248 shipset, so it is copied after the release check and does not change the root app.
if [ -d ../preview ]; then cp -a ../preview ../_release/site/preview; fi
echo "git status --porcelain:"; git status --porcelain; echo "(end)"
