"""Builds verify/fixtures/athena_223/oewn: the OEWN 2025 plus entries for the listed lemmas and every noun synset they
reach (their senses and the full hypernym / instance-hypernym closure), so the meaning-layer tests run offline.
usage: FORGE_OEWN_DIR=<oewn 2025 plus json dir> python3 tools/make_oewn_fixture_223.py"""
import json
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, os.path.join(ROOT, "engine"))
from rmc_engine_v1 import athena_sources_222 as S  # noqa: E402

LEMMAS = ["Moon", "moon", "gravity", "ammonia", "oxygen", "helium", "insulin", "Mercury", "mercury", "planet", "gas", "satellite",
          "natural satellite", "heavenly body", "force", "attraction", "element", "chemical element", "metallic element", "metal", "hormone", "compound",
          "inorganic compound", "binary compound", "hydride", "liquid", "clear", "colorless", "odorless", "tasteless", "unit", "structural",
          "functional", "pungent", "alkaline", "noble gas", "body", "celestial body", "fluid", "substance", "speed of light", "speed",
          "Planck's constant", "constant", "quartz", "water", "basic", "natural", "only", "heavenly", "naturally", "minimally", "photosynthesis", "synthesis", "sun", "Earth", "earth"]
OUT = os.path.join(ROOT, "verify", "fixtures", "athena_223", "oewn")


def main():
    entries = {}
    syn = {}
    todo = []
    for lemma in LEMMAS:
        ent = S._oewn_entries(lemma[:1].lower()).get(lemma)
        if ent:
            entries.setdefault(lemma[:1].lower(), {})[lemma] = ent
            todo += [s["synset"] for s in (ent.get("n") or {}).get("sense") or []]
    while todo:
        sid = todo.pop()
        if sid in syn:
            continue
        row = S._oewn_synset(sid)
        if not row:
            continue
        syn[sid] = {k: row[k] for k in ("definition", "members", "hypernym", "instance_hypernym", "ili", "wikidata", "partOfSpeech") if k in row}
        todo += (row.get("hypernym") or []) + (row.get("instance_hypernym") or [])
    os.makedirs(OUT, exist_ok=True)
    for letter, rows in sorted(entries.items()):
        json.dump(dict(sorted(rows.items())), open(os.path.join(OUT, "entries-%s.json" % letter), "w"), indent=0, sort_keys=True, ensure_ascii=False)
    json.dump(dict(sorted(syn.items())), open(os.path.join(OUT, "noun.fixture.json"), "w"), indent=0, sort_keys=True, ensure_ascii=False)
    print(len(entries), "letters", sum(len(v) for v in entries.values()), "lemmas", len(syn), "synsets")


if __name__ == "__main__":
    main()
