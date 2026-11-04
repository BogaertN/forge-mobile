"""4.9.221 sense data builder (offline, run by hand; no network, no model).

Reads the Open English WordNet 2025 "plus" JSON release (CC BY 4.0; github.com/globalwordnet/english-wordnet,
2025 edition, the edition that keeps proper nouns) and writes:
  1. data/concept_senses.json  the curated concept -> meaning table shipped in the app. Every existing concept is
     PINNED to the meaning it has today (Nic 2026-11-04, t136u): pinning never changes its phase or band.
  2. <out>/senses_oewn2025plus_homographs.json.gz  the homograph sense pack (nouns whose senses fall in two or more
     WordNet categories), uploaded to the forge-ref Storage bucket and pinned by SHA-256 in src/senses.js.
usage: python3 tools/build_senses_221.py <oewn-plus-json-dir> <out-dir> [anchors_snapshot.json] [qid_fill.json]
Wikidata QIDs come from OEWN's own wikidata field, then (optional) a P8814 lookup file; Wikidata is a link only.
"""
from __future__ import annotations

import collections
import gzip
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENG = ROOT / "engine" / "rmc_engine_v1"
ATTRIBUTION = ("Sense ids and glosses: Open English WordNet 2025 (plus edition), (c) the Open English WordNet team and "
               "Princeton University, CC BY 4.0, https://en-word.net/ . Changes: subset and reformatted for Forge.")

# Concepts whose meaning is read from their own shipped anchors (data/anchors_187.json, kb.anchors) and fixed by hand.
MANUAL = {
    "A.BATTERY": "02813606-n", "A.CELL": "00006484-n", "A.COMPASS": "03084501-n", "A.CURIE": "10937455-n",
    "A.EARTH": "09293800-n", "A.ELECTRICITY": "11470244-n", "A.GLASS": "03443167-n", "A.GRAVITY": "11484542-n",
    "A.HEART": "05396148-n", "A.HELP": "01210099-n", "A.JUPITER": "09345360-n", "A.LIGHT": "11494354-n",
    "A.LIGHTNING": "11495679-n", "A.MAGNET": "03710918-n", "A.MARS": "09370342-n", "A.METER": "13681046-n",
    "A.MOON": "09381255-n", "A.OCEAN": "09399110-n", "A.PAPER": "14998823-n", "A.REVOLUTION": "00964833-n",
    "A.RUST": "13573473-n", "A.SUN": "09473312-n", "A.TELEPHONE": "04408223-n", "A.TEMPERATURE": "05018974-n",
    "A.VINEGAR": "07844963-n", "A.WAR": "00975181-n", "A.WATER": "14869913-n", "A.AMMONIA": "14767761-n",
    # CIA World Factbook entries are today's countries (not the island, the US state or the former USSR)
    "A.BAHRAIN": "08867086-n", "A.GEORGIA": "09041218-n", "A.JAPAN": "08941623-n", "A.JERSEY": "08907465-n",
    "A.MONTENEGRO": "86097949-n", "A.RUSSIA": "09028783-n",
    # the anchor is Shakespeare's play; OEWN has the character, not the play: no sense is pinned (asked, never guessed)
    "A.HAMLET": None,
}
REVIEW = {"A.GLASS": "anchor reads 'a glass of water' (the container), not the material",
          "A.HELP": "no anchor text; first sense", "A.REVOLUTION": "no anchor text; political overthrow chosen",
          "A.RUST": "anchor is about corrosion (the process)", "A.HAMLET": "the play is not an OEWN sense"}
# Forge category concepts (concept_lexicon): the WordNet category each surface word means there, in order of preference.
CATEGORY_LEXFILE = {
    "N.PERSON": ["noun.person", "noun.Tops"], "N.SISTER": ["noun.person"], "N.PET": ["noun.animal"], "N.ANIMAL": ["noun.animal"],
    "N.CAR": ["noun.artifact"], "N.COLOR": ["noun.attribute"], "N.RED": ["noun.attribute"], "N.PLACE": ["noun.location", "noun.artifact"],
    "N.TIMEW": ["noun.time"], "N.WEEKDAY": ["noun.time"], "N.MONTH": ["noun.time"], "N.FOOD": ["noun.food", "noun.Tops"],
    "N.WEATHER": ["noun.phenomenon", "noun.object"],
}
COUNTRY = re.compile(r"\b(country|republic|kingdom|island|islands|territory|state|nation|principality|commonwealth|archipelago|dependency|emirate|sultanate|federation|monarchy|colony|region|continent)\b")


def load_oewn(d: Path):
    E, S = {}, {}
    for f in sorted(d.glob("*.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        if f.name.startswith("entries-"):
            E.update(data)
        elif f.name != "frames.json":
            for sid, s in data.items():
                s = dict(s)
                s["lexfile"] = f.stem
                S[sid] = s
    return E, S


def main() -> None:
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    snap = json.loads(Path(sys.argv[3]).read_text()) if len(sys.argv) > 3 else []
    qfill = json.loads(Path(sys.argv[4]).read_text()) if len(sys.argv) > 4 else {}
    out.mkdir(parents=True, exist_ok=True)
    E, S = load_oewn(src)
    lexfiles = sorted({s["lexfile"] for s in S.values()})
    LX = {n: i for i, n in enumerate(lexfiles)}

    def qid(sid):
        w = S[sid].get("wikidata") or ""
        if isinstance(w, list):  # OEWN may list several QIDs for one synset; the first is kept
            w = w[0] if w else ""
        w = str(w).strip()
        return (w if re.fullmatch(r"Q[0-9]+", w) else "") or qfill.get(sid)  # placeholders such as "n.a" are dropped

    def gloss(sid):
        return ((S[sid].get("definition") or [""])[0])[:160]

    # noun senses by lower-cased lemma, case variants merged (lower-case key first), OEWN order kept
    keys_by_low = collections.defaultdict(list)
    for k in E:
        if "n" in E[k]:
            keys_by_low[k.lower()].append(k)
    def nsenses(low):
        out_, seen = [], set()
        for k in sorted(keys_by_low.get(low, []), key=lambda x: (x != x.lower(), x)):
            for s in E[k]["n"].get("sense", []):
                sid = s["synset"]
                if sid in seen or sid not in S:
                    continue
                seen.add(sid)
                out_.append({"sid": sid, "proper": 1 if k[:1].isupper() else 0, "lexfile": S[sid]["lexfile"]})
        return out_

    # 1. homograph pack: single-word noun lemmas whose senses span two or more categories
    lemmas = {}
    for low in sorted(keys_by_low):
        if not re.fullmatch(r"[a-z][a-z'-]*", low):
            continue
        ss = nsenses(low)
        if len({x["lexfile"] for x in ss}) < 2:
            continue
        lemmas[low] = [[x["sid"], LX[x["lexfile"]], x["proper"], S[x["sid"]].get("ili") or "", qid(x["sid"]) or "", gloss(x["sid"])] for x in ss]
    pack = {"schema": "FORGE-SENSE-PACK/v1", "source": "Open English WordNet 2025 (plus edition)", "licence": "CC BY 4.0",
            "attribution": ATTRIBUTION, "pos": "n", "fields": ["synset", "lexfile", "proper", "ili", "qid", "gloss"],
            "lexfiles": lexfiles, "count": len(lemmas), "lemmas": lemmas}
    raw = json.dumps(pack, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")
    gz = gzip.compress(raw, compresslevel=9, mtime=0)
    (out / "senses_oewn2025plus_homographs.json.gz").write_bytes(gz)

    # 2. curated concept table
    ac = json.loads((ENG / "anchor_concepts.json").read_text())["concepts"]
    cl = json.loads((ENG / "concept_lexicon.json").read_text())["surfaces"]
    kb = sorted({c for r in snap for c in (r.get("concepts") or [])})
    cia = {c for r in snap for c in (r.get("concepts") or []) if "cia.gov" in str(r.get("source_url") or "")}
    norm = collections.defaultdict(list)
    for k in E:
        if "n" in E[k]:
            norm[re.sub(r"[^A-Za-z0-9]", "", k).upper()].append(k)
    senses_used, concepts, surfaces = {}, {}, collections.defaultdict(list)

    def use(sid):
        if sid:
            senses_used[sid] = [S[sid]["lexfile"], S[sid].get("ili") or "", qid(sid) or "", gloss(sid)]
        return sid

    for cid in sorted(set(kb) | set(ac.values())):
        if not cid.startswith("A."):
            continue
        lem = sorted(norm.get(cid[2:], []), key=lambda x: (x != x.lower(), x))
        ss = []
        for k in lem:
            for x in nsenses(k.lower()):
                if x["sid"] not in [y["sid"] for y in ss]:
                    ss.append(x)
        row = {"surface": lem[0].lower() if lem else None, "kind": "kb_concept" if cid in kb else "anchor_concept"}
        if cid in MANUAL:
            sid, basis = MANUAL[cid], "manual_from_own_anchors"
        elif not ss:
            sid, basis = None, "no_oewn_entry"
        elif cid in cia:
            cand = [x for x in ss if x["lexfile"] == "noun.location"] or ss
            fit = [x for x in cand if COUNTRY.search(gloss(x["sid"]).lower())] or cand
            fit = sorted(fit, key=lambda x: (not qid(x["sid"]), cand.index(x)))
            sid, basis = fit[0]["sid"], "cia_polity"
            if len([x for x in fit if qid(x["sid"])]) > 1 or (len(fit) > 1 and not qid(fit[0]["sid"])):
                row["review"] = "more than one place sense: " + ", ".join(x["sid"] for x in fit[:4])
        elif len({x["lexfile"] for x in ss}) == 1:
            sid, basis = ss[0]["sid"], "single_category"
            if len(ss) > 1:
                row["review"] = "%d senses in one category; first (most frequent) kept" % len(ss)
        else:
            sid, basis = ss[0]["sid"], "first_sense"
            row["review"] = "senses in %d categories; first kept" % len({x['lexfile'] for x in ss})
        if cid in REVIEW:
            row["review"] = REVIEW[cid]
        row.update({"sense": use(sid), "basis": basis, "pinned": True})
        concepts[cid] = row
        if row["surface"]:
            surfaces[row["surface"]].append([cid, sid])
        if re.fullmatch(r"[A-Z]+", cid[2:]) and cid[2:].lower() != row["surface"]:
            surfaces[cid[2:].lower()].append([cid, sid])
    for w, cid in sorted(ac.items()):
        if [cid, concepts.get(cid, {}).get("sense")] not in surfaces[w]:
            surfaces[w].append([cid, concepts.get(cid, {}).get("sense")])
    for w, cid in sorted(cl.items()):
        prefs = CATEGORY_LEXFILE.get(cid)
        sid = None
        if prefs:
            ss = nsenses(w)
            for lf in prefs:
                hit = [x for x in ss if x["lexfile"] == lf]
                if hit:
                    sid = hit[0]["sid"]
                    break
        if cid not in concepts:
            concepts[cid] = {"surface": None, "kind": "forge_category" if prefs else "forge_term", "sense": None, "basis": "forge_concept", "pinned": True}
        surfaces[w].append([cid, use(sid)])
    table = {"schema": "FORGE-CONCEPT-SENSES/v1", "release": "4.9.221", "mode": "advisory",
             "rule": "Every existing concept is pinned to the meaning it has today; pinning never changes its phase or band (placement still comes from surface_phase_202 and band_tuning). A new ambiguous word is logged as would_ask; nothing is answered from a sense in 4.9.221.",
             "source": {"name": "Open English WordNet 2025 (plus edition)", "licence": "CC BY 4.0", "attribution": ATTRIBUTION,
                        "wikidata": "QIDs are links only (OEWN wikidata field, else Wikidata P8814); never a source"},
             "counts": {"concepts": len(concepts), "with_sense": sum(1 for c in concepts.values() if c["sense"]),
                        "review": sum(1 for c in concepts.values() if c.get("review")), "surfaces": len(surfaces), "senses": len(senses_used)},
             "senses_fields": ["lexfile", "ili", "qid", "gloss"],
             "concepts": dict(sorted(concepts.items())), "surfaces": dict(sorted(surfaces.items())), "senses": dict(sorted(senses_used.items()))}
    (ROOT / "data" / "concept_senses.json").write_text(json.dumps(table, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({"pack_lemmas": len(lemmas), "pack_raw": len(raw), "pack_gz": len(gz), "pack_sha256": hashlib.sha256(gz).hexdigest(),
                      "table": table["counts"], "no_sense_A": [c for c, r in concepts.items() if c.startswith("A.") and not r["sense"]],
                      "review": {c: r["review"] for c, r in concepts.items() if r.get("review")}}, indent=1))


if __name__ == "__main__":
    main()
