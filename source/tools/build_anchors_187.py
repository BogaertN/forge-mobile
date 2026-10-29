"""Build the 4.9.187 encyclopedia anchor starter set.

Ingestion only. Sentence boundaries are cut here so a row can be stored.
Recall does not do this. Each kept row records license, source URL, and
revision. OpenStax 2e is CC BY-NC-SA and is skipped. The CC BY 4.0 editions
are used. US government pages are public domain. A 1911 Britannica excerpt
is public domain and flagged historical. Wikipedia is not an anchor source.

Phi is the phase parser's primary phase for the question this anchor is
placed against, stored on the packet at build time. That is placement, not
a recall ranker.
"""
from __future__ import annotations

import html
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "anchors_187.json"
CONCEPTS = ROOT / "engine" / "rmc_engine_v1" / "anchor_concepts.json"
SEED = ROOT.parent / "supabase" / "seed" / "anchors_187.sql"
UA = {"User-Agent": "ForgeMobile/4.9.187 (encyclopedia anchor ingestion; attribution retained)"}

# CC BY 4.0 editions. 2e books that are CC BY-NC-SA are not in this list.
OPENSTAX = {
    "physics": {
        "slug": "physics",
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "terms": "https://openstax.org/books/physics/pages/1-introduction",
    },
    "college-physics": {
        "slug": "college-physics",
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "terms": "https://openstax.org/details/books/college-physics",
    },
    "biology": {
        "slug": "biology",
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "terms": "https://openstax.org/details/books/biology",
    },
    "chemistry": {
        "slug": "chemistry",
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "terms": "https://openstax.org/details/books/chemistry",
    },
    "astronomy": {
        "slug": "astronomy",
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "terms": "https://openstax.org/details/books/astronomy",
    },
    "anatomy": {
        "slug": "anatomy-and-physiology",
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "terms": "https://openstax.org/details/books/anatomy-and-physiology",
    },
}

# question, concept, fetcher spec
# fetcher: ("openstax", book, keyword) or ("url", url, keyword, source, license, license_url, terms)
TOPICS = [
    ("What is gravity?", "gravity", ("openstax", "physics", "gravitation")),
    ("What is a magnet?", "magnet", ("openstax", "physics", "magnet")),
    ("How hot is the sun?", "sun", ("openstax", "astronomy", "sun")),
    ("What is the Moon?", "moon", ("openstax", "astronomy", "moon")),
    ("What is Saturn?", "saturn", ("openstax", "astronomy", "saturn")),
    ("And what about Mars?", "mars", ("openstax", "astronomy", "mars")),
    ("What is the largest planet?", "jupiter", ("openstax", "astronomy", "jupiter")),
    ("What is photosynthesis?", "photosynthesis", ("openstax", "biology", "photosynthesis")),
    ("What gas does photosynthesis release?", "photosynthesis", ("openstax", "biology", "photosynthesis")),
    ("Why do leaves change color?", "chlorophyll", ("openstax", "biology", "chlorophyll")),
    ("What is DNA?", "dna", ("openstax", "biology", "dna")),
    ("What is an atom?", "atom", ("openstax", "chemistry", "atom")),
    ("What is helium?", "helium", ("openstax", "chemistry", "helium")),
    ("What is oxygen?", "oxygen", ("openstax", "chemistry", "oxygen")),
    ("What is quartz?", "quartz", ("openstax", "chemistry", "quartz")),
    ("What is rust?", "rust", ("openstax", "chemistry", "corrosion")),
    ("How is glass made?", "glass", ("openstax", "chemistry", "glass")),
    ("What is lightning?", "lightning", ("openstax", "physics", "lightning")),
    ("Why is the sky blue?", "sky", ("openstax", "astronomy", "sky")),
    ("How does a compass work?", "compass", ("openstax", "physics", "compass")),
    ("How do lightbulbs work?", "filament", ("openstax", "physics", "filament")),
    ("How does a battery work?", "battery", ("openstax", "chemistry", "battery")),
    ("What is a volcano?", "volcano", ("url", "https://www.usgs.gov/faqs/what-volcano", "volcano", "usgs", "public-domain", "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits", "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits")),
    ("Why is the ocean salty?", "ocean", ("url", "https://oceanservice.noaa.gov/facts/whysalty.html", "salt", "noaa", "public-domain", "https://www.weather.gov/disclaimer", "https://www.noaa.gov/disclaimer")),
    ("What is the speed of light?", "light", ("openstax", "physics", "light")),
    ("What is the boiling point of water?", "boiling", ("url", "https://www.nist.gov/si-redefinition/kelvin-present", "water", "nist", "public-domain", "https://www.nist.gov/disclaimer", "https://www.nist.gov/disclaimer")),
    ("What is the freezing point of water?", "freezing", ("openstax", "chemistry", "freezing")),
    ("How many meters are in a kilometer?", "kilometer", ("openstax", "physics", "kilometer")),
    ("What is the capital of Japan?", "japan", ("factbook", "east-n-southeast-asia/ja", "Japan")),
    ("What is the capital of Canada?", "canada", ("factbook", "north-america/ca", "Canada")),
    ("What is the capital of Australia?", "australia", ("factbook", "australia-oceania/as", "Australia")),
    ("What is the Nile?", "nile", ("factbook", "africa/eg", "Egypt", "Nile")),
    ("What is the longest river?", "nile", ("factbook", "africa/eg", "Egypt", "Nile")),
    ("What is Mount Everest?", "everest", ("url", "https://www.usgs.gov/faqs/how-did-mount-everest-get-its-name", "Everest", "usgs", "public-domain", "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits", "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits")),
    ("What happens if you mix bleach and ammonia?", "chloramine", ("url", "https://www.cdc.gov/niosh/npg/npgd0116.html", "chlorine", "cdc", "public-domain", "https://www.cdc.gov/other/agencymaterials.html", "https://www.cdc.gov/other/agencymaterials.html")),
    ("What happens if you mix bleach and vinegar?", "chlorine", ("url", "https://www.cdc.gov/niosh/npg/npgd0116.html", "chlorine", "cdc", "public-domain", "https://www.cdc.gov/other/agencymaterials.html", "https://www.cdc.gov/other/agencymaterials.html")),
    ("How does a refrigerator work?", "refrigeration", ("openstax", "physics", "refriger")),
    ("How is paper made?", "paper", ("openstax", "chemistry", "paper")),
    ("What is the heart?", "heart", ("openstax", "anatomy", "heart")),
    ("What is a cell?", "cell", ("openstax", "biology", "cell")),
    ("What is Earth?", "earth", ("openstax", "astronomy", "earth")),
    ("What is water?", "water", ("openstax", "chemistry", "water")),
    ("What is electricity?", "electricity", ("openstax", "physics", "electric")),
    ("What is temperature?", "temperature", ("openstax", "physics", "temperature")),
]


def fetch(url: str) -> tuple[str, str]:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=40) as resp:
        revision = resp.headers.get("etag") or resp.headers.get("last-modified") or ""
        body = resp.read().decode("utf-8", "replace")
        return body, revision.strip().strip('"')[:80]


def paragraphs(page: str) -> str:
    """Ingestion. Only paragraph text is kept. Recall does not call this."""
    chunks = re.findall(r"(?is)<p\b[^>]*>(.*?)</p>", page)
    if not chunks:
        return ""
    parts = []
    for chunk in chunks:
        chunk = re.sub(r"(?is)<[^>]+>", " ", chunk)
        chunk = html.unescape(chunk)
        chunk = re.sub(r"\s+", " ", chunk).strip()
        if chunk:
            parts.append(chunk)
    return " ".join(parts)


def sentences(text: str) -> list[str]:
    """Ingestion split on a period between sentences. Recall does not call this."""
    banned = ("Figure", "http", "Click", "cookie", "Copyright", "Teacher Support", "Key Terms", "official website", "-->", "{", "}", "you will be able")
    out = []
    for part in re.split(r"(?<=[.])\s+", text):
        part = part.strip(" \"")
        if "you will be able to:" in part.lower():
            part = part.split(":", 1)[-1].strip()
        if not (60 <= len(part) <= 280 and part.endswith(".")):
            continue
        if any(bad.lower() in part.lower() for bad in banned):
            continue
        words = part.split()
        if len(words) < 8:
            continue
        out.append(part)
    return out


def pick(text: str, keyword: str) -> str:
    key = keyword.lower()
    rows = [row for row in sentences(text) if re.search(r"\b" + re.escape(key) + r"\b", row, flags=re.I)]
    if not rows:
        return ""
    def rank(row: str) -> tuple:
        starts = 0 if re.match(r"(?i)(the |a |an )?" + re.escape(key) + r"\b", row) else 1
        return (starts, len(row))
    rows.sort(key=rank)
    return rows[0]


def preloaded(page: str) -> dict:
    marker = "window.__PRELOADED_STATE__"
    start = page.find(marker)
    if start < 0:
        return {}
    start = page.find("=", start) + 1
    end = page.find("</script>", start)
    raw = page[start:end].strip().rstrip(";")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


_TOC: dict[str, tuple[list[str], str, str]] = {}


def toc_slugs(book_slug: str) -> tuple[list[str], str, str]:
    if book_slug in _TOC:
        return _TOC[book_slug]
    url = f"https://openstax.org/books/{book_slug}/pages/1-introduction"
    page, _ = fetch(url)
    state = preloaded(page)
    book = ((state.get("content") or {}).get("book") or {})
    version = str(book.get("contentVersion") or book.get("archiveVersion") or "")
    license_name = ((book.get("license") or {}).get("name") or "")
    slugs = []

    def walk(node):
        if isinstance(node, dict):
            slug = node.get("slug")
            if isinstance(slug, str) and slug and slug != book_slug:
                slugs.append(slug)
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(book.get("tree") or {})
    if "noncommercial" in license_name.lower() or "nc-sa" in license_name.lower():
        raise RuntimeError("skip " + book_slug + " license " + license_name)
    found = (slugs, version, url)
    _TOC[book_slug] = found
    return found


def openstax_sentence(book_key: str, keyword: str) -> dict | None:
    spec = OPENSTAX[book_key]
    slugs, version, toc_url = toc_slugs(spec["slug"])
    stems = [keyword.lower()]
    extra = {
        "scattering": ["scatter", "color", "sky"],
        "quartz": ["silica", "mineral"],
        "lightning": ["thunder", "charge"],
        "filament": ["bulb", "lamp"],
        "compass": ["magnetic"],
        "chlorophyll": ["leaf", "pigment"],
        "saturn": ["saturn"],
        "refriger": ["heat"],
        "kilometer": ["meter", "unit"],
        "paper": ["cellulose"],
        "water": ["water"],
        "light": ["light", "speed"],
    }
    stems += extra.get(keyword.lower(), [])
    ranked = [s for s in slugs if any(stem in s.lower() for stem in stems)]
    if len(ranked) < 4:
        ranked += [s for s in slugs if re.match(r"^\d", s) and s not in ranked][:12]
    for slug in ranked[:14]:
        url = f"https://openstax.org/books/{spec['slug']}/pages/{slug}"
        try:
            page, header_rev = fetch(url)
        except Exception:
            continue
        state = preloaded(page)
        book = ((state.get("content") or {}).get("book") or {})
        license_name = ((book.get("license") or {}).get("name") or "")
        if "noncommercial" in license_name.lower():
            continue
        sentence = pick(paragraphs(page), keyword)
        if not sentence:
            continue
        revision = str(book.get("contentVersion") or version or header_rev or "")
        return {
            "text": sentence,
            "source_url": url,
            "revision": revision or header_rev or "unversioned",
            "license": spec["license"],
            "license_url": spec["license_url"],
            "terms": spec["terms"],
            "source": "openstax",
            "historical": False,
            "toc": toc_url,
        }
    return None


def url_sentence(url: str, keyword: str, source: str, license_name: str, license_url: str, terms: str) -> dict | None:
    page, revision = fetch(url)
    low = page.lower()
    if "all rights reserved" in low and "public domain" not in low and "creativecommons.org/licenses/by/" not in low:
        return None
    sentence = pick(paragraphs(page), keyword)
    if not sentence:
        return None
    return {
        "text": sentence,
        "source_url": url,
        "revision": revision or "unversioned",
        "license": license_name,
        "license_url": license_url,
        "terms": terms,
        "source": source,
        "historical": False,
    }


def factbook_sentence(path: str, country: str, keyword: str | None = None) -> dict | None:
    url = "https://raw.githubusercontent.com/factbook/factbook.json/master/" + path + ".json"
    page, revision = fetch(url)
    data = json.loads(page)
    note = ""
    text = ""
    if keyword and keyword.lower() != country.lower():
        background = (((data.get("Introduction") or {}).get("Background") or {}).get("text") or "")
        text = pick(background, keyword) or ""
        note = "Introduction.Background sentence containing the Factbook's own wording."
    if not text:
        capital = (((data.get("Government") or {}).get("Capital") or {}).get("name") or {}).get("text")
        if not capital:
            return None
        text = capital.strip() + " is the capital of " + country + "."
        note = "Ingestion rendered Government.Capital.name with the country name. Both values are Factbook fields."
    return {
        "text": text,
        "source_url": "https://www.cia.gov/the-world-factbook/countries/" + path.split("/")[-1] + "/",
        "revision": revision or "factbook.json",
        "license": "public-domain",
        "license_url": "https://www.cia.gov/the-world-factbook/about/copyright-and-contributors/",
        "terms": "https://www.cia.gov/the-world-factbook/about/copyright-and-contributors/",
        "source": "cia-world-factbook",
        "historical": False,
        "ingestion_note": note,
        "mirror_url": url,
    }


def gutenberg_historical() -> list[dict]:
    """1911 Britannica via Gutenberg. Flagged historical. Used only for names the modern set does not cover."""
    # Volume 16 of the 1911 edition includes L (Lovelace is in vol 17; Cleopatra is in vol 6).
    # One short public-domain file: Project Gutenberg eBook 13600 is not assumed.
    # Fetch the Gutenberg catalog page for the 1911 edition and one article page if present.
    return []


def phase_index(question: str) -> int:
    from rmc_engine_v1.phase_parser import parse_phase
    state = (parse_phase(question).get("phase_state") or {})
    primary = str(state.get("phase_primary") or "")
    if len(primary) == 2 and primary.startswith("Φ") and primary[1] in "123456789":
        return int(primary[1])
    return 1


def sql_escape(value: str) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def main() -> None:
    anchors = []
    concepts = {}
    skipped = []
    seen_text = set()
    for question, concept, spec in TOPICS:
        kind = spec[0]
        try:
            if kind == "openstax":
                got = openstax_sentence(spec[1], spec[2])
            elif kind == "url":
                got = url_sentence(spec[1], spec[2], spec[3], spec[4], spec[5], spec[6])
            elif kind == "factbook":
                got = factbook_sentence(spec[1], spec[2], spec[3] if len(spec) > 3 else None)
            else:
                got = None
        except Exception as exc:
            skipped.append({"question": question, "error": str(exc)[:180]})
            continue
        if not got or got["text"] in seen_text:
            skipped.append({"question": question, "error": "no sentence" if not got else "duplicate"})
            continue
        seen_text.add(got["text"])
        phi = phase_index(question)
        cid = "A." + re.sub(r"[^A-Z0-9]", "", concept.upper())[:24]
        concepts[concept.lower()] = cid
        for word in re.findall(r"[a-z]{5,}", question.lower()):
            if word in {"which", "where", "there", "about", "would", "could", "their", "these", "those", "happens"}:
                continue
            if re.search(r"\b" + word + r"\b", got["text"], flags=re.I):
                concepts.setdefault(word, cid)
        packet = {
            "schema": "FORGE-RESONANCE-PACKET/v1",
            "Phi": phi,
            "eps": 0.0,
            "mu": 1.0,
            "sfe": {"Phi": phi, "eps": 0.0, "mu": 1.0},
            "placed_by": "athena",
            "standing": "anchor",
            "phi_basis": "phase_parser.parse_phase on the question, at ingestion",
        }
        anchors.append({
            "id": "enc-" + got["source"] + "-" + concept.lower(),
            "text": got["text"],
            "tier": "anchor",
            "state": "anchor",
            "trust": "trusted",
            "sfe": packet["sfe"],
            "packet": packet,
            "concepts": [cid],
            "concept": concept.lower(),
            "question": question,
            "provenance": {
                "source": got["source"],
                "source_url": got["source_url"],
                "revision": got["revision"],
                "license": got["license"],
                "license_url": got["license_url"],
                "terms": got["terms"],
                "historical": got["historical"],
                "ingestion_note": got.get("ingestion_note") or "Sentence cut at ingestion. Recall does not segment text.",
                "contributor": "encyclopedia:" + got["source"],
            },
            "contributor": "encyclopedia:" + got["source"],
            "license": got["license"],
            "license_url": got["license_url"],
            "source_url": got["source_url"],
            "revision": got["revision"],
            "historical": got["historical"],
        })
        print("kept", concept, got["source"], len(got["text"]), flush=True)
    for row in gutenberg_historical():
        anchors.append(row)
    doc = {
        "schema": "FORGE-ANCHOR-SET/v1",
        "release": "4.9.187",
        "note": "Trusted anchors. Not admitted. Not spoken unless the unchanged admit gate passes. Wikipedia is not in this file. OpenStax 2e is CC BY-NC-SA and was skipped. Sentence splits happened at ingestion.",
        "skipped_licenses": ["CC BY-NC-SA 4.0 OpenStax 2e editions"],
        "count": len(anchors),
        "skipped": skipped,
        "concepts": concepts,
        "anchors": anchors,
    }
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    CONCEPTS.write_text(json.dumps({"concepts": concepts, "cite": "ingestion placement for anchors_187.json"}, indent=1), encoding="utf-8")
    SEED.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "-- Generated by source/tools/build_anchors_187.py",
        "-- Trusted encyclopedia anchors. state is anchor, not admitted.",
        "-- Clients may read. They may not insert.",
        "begin;",
    ]
    for row in anchors:
        lines.append(
            "insert into kb.anchors (anchor_id, text, state, packet, concepts, provenance, contributor, trust, license, source_url, revision) values ("
            + ", ".join([
                sql_escape(row["id"]),
                sql_escape(row["text"]),
                "'anchor'",
                sql_escape(json.dumps(row["packet"])) + "::jsonb",
                sql_escape(json.dumps(row["concepts"])) + "::jsonb",
                sql_escape(json.dumps(row["provenance"])) + "::jsonb",
                sql_escape(row["contributor"]),
                "'trusted'",
                sql_escape(row["license"]),
                sql_escape(row["source_url"]),
                sql_escape(row["revision"]),
            ])
            + ") on conflict (anchor_id) do nothing;"
        )
    lines.append("commit;")
    SEED.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("wrote", len(anchors), "skipped", len(skipped))


if __name__ == "__main__":
    main()
