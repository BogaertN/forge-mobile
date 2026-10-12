#!/bin/sh
# Fresh-clone setup: rebuild the large/binary inputs from the published app at the repo root (they are stored there as *.b64).
set -e
cd "$(dirname "$0")/.."
mkdir -p data icons vendor
for f in ../data/*.gz.b64; do n=$(basename "$f" .b64); base64 -d "$f" > "data/$n"; gunzip -c "data/$n" > "data/${n%.gz}"; done
for f in ../icons/*.b64; do base64 -d "$f" > "icons/$(basename "$f" .b64)"; done
cp ../vendor/* vendor/
echo "prepared: data/lexicon*.json, icons, vendor"
