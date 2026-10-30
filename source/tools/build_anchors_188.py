"""Grow the trusted anchor tier and shard it by concept.

Ingestion only. Sentence cuts happen here. Recall does not segment text
and does not rank by token overlap.

Allowed text:
  CIA World Factbook (US public domain; the factbook.json mirror is CC0)
  CC BY 4.0 OpenStax, already in anchors_187.json (CC BY-NC-SA is skipped)
  US government public-domain pages when a fetch returns one

Wikipedia and Wikimedia hosts are not sources.
"""
from __future__ import annotations

import html
import json
import re
import tarfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "anchors_188"
TARBALL = Path("/tmp/anchor-src/factbook.tar.gz")
FACTBOOK_ROOT = Path("/tmp/anchor-src/factbook.json-master")
SEED = ROOT.parent / "supabase" / "seed" / "anchors_188.sql"
MIGRATION = ROOT.parent / "supabase" / "migrations" / "20261030143000_seed_kb_anchors.sql"
CONCEPTS = ROOT / "engine" / "rmc_engine_v1" / "anchor_concepts.json"
UA = {"User-Agent": "ForgeMobile/4.9.188 (encyclopedia anchor ingestion; attribution retained)"}
STOP = {
    "the", "and", "for", "with", "from", "that", "this", "what", "which", "when",
    "where", "who", "how", "are", "was", "were", "its", "has", "have", "not",
    "but", "into", "about", "their", "there", "these", "those", "united", "states",
    "state", "north", "south", "east", "west", "new", "world", "country", "island",
    "islands", "republic", "kingdom", "people", "government", "land", "sea",
}
BANNED = (
    "wikipedia", "wikimedia", "wikidata", "dbpedia", "wikisource", "conceptnet",
    "share sensitive information", "all rights reserved", "cookie",
    "official website", "-->", "we have provided a link", "click here",
    "skip to", "javascript", "here's how you know",
    "this site will not be updated", "does not necessarily endorse",
    "does not endorse", "visit weather.gov", "for the latest forecasts",
    "critical weather information", "this website", "expand or collapse",
)
# NOAA's ocean-salt sentence already lives in anchors_187.json.
# USGS and CDC returned 404 and 403 on the pages tried here.
# NIST's SI page did not yield a clean paragraph, so it is not ingested.
GOV_PAGES = [
    ("https://science.nasa.gov/sun/", "sun", "nasa"),
    ("https://www.weather.gov/safety/lightning", "lightning", "nws"),
    ("https://medlineplus.gov/genetics/understanding/basics/dna/", "dna", "nih-medlineplus"),
]


def sql_escape(value: str) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def clean_text(raw: str) -> str:
    text = re.sub(r"(?is)<[^>]+>", " ", str(raw or ""))
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def sentences(raw: str) -> list[str]:
    out = []
    for part in re.split(r"(?<=[.])\s+", clean_text(raw)):
        part = part.strip(" \"")
        if not part or not part[0].isalpha():
            continue
        if not (60 <= len(part) <= 320 and part.endswith(".")):
            continue
        low = part.lower()
        if any(bad in low for bad in BANNED):
            continue
        if "http" in low or len(part.split()) < 8:
            continue
        if re.search(r"(?:\b[A-Za-z]\.){1,3}$", part):
            continue
        out.append(part)
    return out


def packet(phi: int = 1) -> dict:
    return {
        "schema": "FORGE-RESONANCE-PACKET/v1",
        "Phi": phi,
        "eps": 0.0,
        "mu": 1.0,
        "sfe": {"Phi": phi, "eps": 0.0, "mu": 1.0},
        "placed_by": "athena",
        "standing": "anchor",
        "phi_basis": "ingestion placement; factual anchor, phase Φ1",
    }


def row_for(anchor_id: str, text: str, source: str, source_url: str, revision: str, concept: str, concepts: list[str], note: str) -> dict:
    return {
        "id": anchor_id,
        "text": text,
        "tier": "anchor",
        "state": "anchor",
        "trust": "trusted",
        "sfe": {"Phi": 1, "eps": 0.0, "mu": 1.0},
        "packet": packet(1),
        "concepts": concepts,
        "concept": concept,
        "provenance": {
            "source": source,
            "source_url": source_url,
            "revision": revision,
            "license": "public-domain",
            "license_url": "https://www.cia.gov/the-world-factbook/about/copyright-and-contributors/" if source == "cia-world-factbook" else source_url,
            "terms": "https://www.usa.gov/government-works",
            "historical": False,
            "ingestion_note": note,
            "contributor": "encyclopedia:" + source,
        },
        "contributor": "encyclopedia:" + source,
        "license": "public-domain",
        "license_url": "https://www.cia.gov/the-world-factbook/about/copyright-and-contributors/" if source == "cia-world-factbook" else "https://www.usa.gov/government-works",
        "source_url": source_url,
        "revision": revision or "unversioned",
        "historical": False,
    }


def ensure_factbook() -> None:
    if FACTBOOK_ROOT.exists():
        return
    if not TARBALL.exists():
        TARBALL.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(
            "https://codeload.github.com/factbook/factbook.json/tar.gz/refs/heads/master",
            TARBALL,
        )
    with tarfile.open(TARBALL) as tar:
        tar.extractall(TARBALL.parent)


def factbook_rows() -> tuple[list[dict], dict[str, str]]:
    ensure_factbook()
    rows = []
    phrases: dict[str, str] = {}
    seen = set()
    files = sorted(p for p in FACTBOOK_ROOT.rglob("*.json") if p.parent != FACTBOOK_ROOT)
    for path in files:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        gov = data.get("Government") or {}
        name = (((gov.get("Country name") or {}).get("conventional short form") or {}).get("text") or "").strip()
        name = clean_text(name)
        if not name or name.lower() in {"none", "n/a"}:
            continue
        code = path.stem.lower()
        concept = "A." + re.sub(r"[^A-Z0-9]", "", name.upper())[:24]
        source_url = "https://www.cia.gov/the-world-factbook/countries/" + code + "/"
        revision = "factbook.json"
        phrase = " ".join(name.lower().split())
        if phrase and phrase not in STOP:
            phrases.setdefault(phrase, code)
        capital = clean_text((((gov.get("Capital") or {}).get("name") or {}).get("text") or ""))
        if capital and capital.lower() not in {"none", "n/a"} and " " not in capital and len(capital) >= 4:
            phrases.setdefault(capital.lower(), code)
        background = (((data.get("Introduction") or {}).get("Background") or {}).get("text") or "")
        kept = sentences(background)
        if capital and name:
            line = capital + " is the capital of " + name + "."
            if line not in kept and 8 <= len(line) <= 2000:
                kept = [line] + kept
        for i, text in enumerate(kept):
            if text in seen:
                continue
            seen.add(text)
            rows.append(row_for(
                "enc-cia-" + code + "-" + str(i),
                text,
                "cia-world-factbook",
                source_url,
                revision,
                concept,
                [concept],
                "Sentence cut at ingestion from the CIA World Factbook. The factbook.json mirror is CC0. Recall does not segment text.",
            ) | {"shard": code})
    return rows, phrases


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode("utf-8", "replace")


def gov_rows(phrases: dict[str, str]) -> list[dict]:
    rows = []
    seen = set()
    for url, concept_word, source in GOV_PAGES:
        try:
            page = fetch(url)
        except Exception as exc:
            print("skip", source, str(exc)[:120], flush=True)
            continue
        low = page.lower()
        if "wikipedia.org" in low and source not in {"nasa", "noaa", "nws", "nih-medlineplus", "nist", "usgs", "cdc"}:
            continue
        if "all rights reserved" in low and "public domain" not in low and "government work" not in low:
            print("skip", source, "not public domain", flush=True)
            continue
        picked = sentences(page)[:4]
        if not picked:
            print("skip", source, "no sentence", flush=True)
            continue
        concept = "A." + re.sub(r"[^A-Z0-9]", "", concept_word.upper())[:24]
        phrases.setdefault(concept_word.lower(), "gov-" + source)
        for i, text in enumerate(picked):
            if text in seen:
                continue
            seen.add(text)
            item = row_for(
                "enc-" + source + "-" + concept_word + "-" + str(i),
                text,
                source,
                url,
                "fetched",
                concept,
                [concept],
                "Sentence cut at ingestion from a US government public-domain page. Recall does not segment text.",
            )
            item["shard"] = "gov-" + source
            item["provenance"]["license_url"] = "https://www.usa.gov/government-works"
            item["license_url"] = "https://www.usa.gov/government-works"
            rows.append(item)
        print("kept", source, len(picked), flush=True)
    return rows


def write_outputs(rows: list[dict], phrases: dict[str, str]) -> None:
    by_shard: dict[str, list[dict]] = {}
    for row in rows:
        by_shard.setdefault(row["shard"], []).append({k: v for k, v in row.items() if k != "shard"})
    shard_dir = OUT / "shards"
    shard_dir.mkdir(parents=True, exist_ok=True)
    for old in shard_dir.glob("*.json"):
        old.unlink()
    surfaces: dict[str, list[str]] = {}
    for phrase, shard in sorted(phrases.items()):
        surfaces.setdefault(phrase, [])
        if shard not in surfaces[phrase]:
            surfaces[phrase].append(shard)
    existing = {}
    if CONCEPTS.exists():
        existing = json.loads(CONCEPTS.read_text(encoding="utf-8")).get("concepts") or {}
    for word, cid in existing.items():
        # A starter concept word loads the shard that already carries that phrase, if any.
        phrase = str(word).lower()
        if phrase in surfaces:
            continue
    shard_meta = {}
    for name, items in sorted(by_shard.items()):
        items.sort(key=lambda row: row["id"])
        body = json.dumps({"shard": name, "count": len(items), "anchors": items}, ensure_ascii=False)
        (shard_dir / (name + ".json")).write_text(body, encoding="utf-8")
        concepts = sorted({c for row in items for c in row.get("concepts") or []})
        shard_meta[name] = {"file": "shards/" + name + ".json", "count": len(items), "concepts": concepts}
    index = {
        "schema": "FORGE-ANCHOR-INDEX/v1",
        "release": "4.9.188",
        "note": "Lazy-loaded by a concept phrase placed at ingestion. Not inlined into the portable file. Wikipedia is not a source. OpenStax CC BY-NC-SA was not used. The starter set remains data/anchors_187.json.",
        "count": len(rows),
        "skipped_licenses": ["CC BY-NC-SA 4.0 OpenStax 2e editions"],
        "surfaces": surfaces,
        "shards": shard_meta,
    }
    (OUT / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    merged = dict(existing)
    for phrase, shard_names in surfaces.items():
        if " " in phrase or phrase in STOP or len(phrase) < 4:
            continue
        shard = shard_names[0]
        items = by_shard.get(shard) or []
        cid = (items[0].get("concepts") or ["A.CONCEPT"])[0] if items else "A.CONCEPT"
        merged.setdefault(phrase, cid)
    CONCEPTS.write_text(json.dumps({"concepts": merged, "cite": "ingestion placement for anchors_187.json and anchors_188"}, indent=1) + "\n", encoding="utf-8")
    lines = [
        "-- Generated by source/tools/build_anchors_188.py",
        "-- Seed for kb.anchors. The table already exists and is empty.",
        "-- Do not apply this in the 4.9.188 agent run. Nic applies it.",
        "-- Clients may read. They may not insert. state is anchor, not admitted.",
        "begin;",
    ]
    for row in sorted(rows, key=lambda item: item["id"]):
        lines.append(
            "insert into kb.anchors (anchor_id, text, state, packet, concepts, provenance, contributor, trust, license, source_url, revision) values ("
            + ", ".join([
                sql_escape(row["id"]),
                sql_escape(row["text"]),
                "'anchor'",
                sql_escape(json.dumps(row["packet"], ensure_ascii=False)) + "::jsonb",
                sql_escape(json.dumps(row["concepts"])) + "::jsonb",
                sql_escape(json.dumps(row["provenance"], ensure_ascii=False)) + "::jsonb",
                sql_escape(row["contributor"]),
                "'trusted'",
                sql_escape(row["license"]),
                sql_escape(row["source_url"]),
                sql_escape(row["revision"]),
            ])
            + ") on conflict (anchor_id) do nothing;"
        )
    lines.append("commit;")
    text = "\n".join(lines) + "\n"
    SEED.parent.mkdir(parents=True, exist_ok=True)
    MIGRATION.parent.mkdir(parents=True, exist_ok=True)
    SEED.write_text(text, encoding="utf-8")
    MIGRATION.write_text(text, encoding="utf-8")
    print("rows", len(rows), "shards", len(by_shard), "surfaces", len(surfaces), flush=True)


def main() -> None:
    rows, phrases = factbook_rows()
    rows.extend(gov_rows(phrases))
    # Drop any row that is not public domain or that names a forbidden host.
    kept = []
    for row in rows:
        blob = (row["text"] + " " + row["source_url"] + " " + row["contributor"]).lower()
        if any(bad in blob for bad in ("wikipedia", "wikimedia", "wikidata", "dbpedia", "wikisource")):
            continue
        if row["license"] not in {"public-domain", "CC BY 4.0"}:
            continue
        kept.append(row)
    write_outputs(kept, phrases)


if __name__ == "__main__":
    main()
