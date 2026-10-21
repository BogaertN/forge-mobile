#!/bin/sh
# Forge Mobile publish pipeline with the TARGETED gate (Nic, 2026-10-21 4:49 PM: the full release.sh gate is dropped).
#   1. prepare_clone.sh   2. verify/targeted.js (suites in verify/targeted.json)   3. build.py   4. verify_release.js
#   5. live probe: reports its pass rate when the private probe set is present (FORGE_PRIVATE); never blocks (network flakiness)
set -e
cd "$(dirname "$0")/.."
sh tools/prepare_clone.sh
node verify/targeted.js
python3 build.py
node tools/verify_release.js
node tools/live_probe.js --limit 25 || true
echo "git status --porcelain:"; git status --porcelain; echo "(end)"
