"""Open reference sources for a creative gather.

These are queried by the topic's own name. A page is kept only when that name is
the subject of the sentence. Wikipedia, Wikidata, DBpedia and Wiktionary are one
Wikimedia lineage and low-trust: they count toward admission only together with a
publisher outside that lineage. NASA's hosts are one publisher.
"""
from __future__ import annotations

import html as _html
import json
import re
import urllib.parse
from typing import Any, Callable

from rmc_engine_v1.athena_sources_222 import FetchMiss

Http = Callable[[str], str]

# One organization, however many hosts it has.
LINEAGE = {
    "wikipedia": "wikimedia",
    "wikidata": "wikimedia",
    "dbpedia": "wikimedia",
    "wiktionary": "wikimedia",
    "nasa_science": "nasa",
    "nasa_spaceplace": "nasa",
    "nasa_nssdc": "nasa",
    "nlm_mesh": "nlm",
    "pubchem": "nlm",
}
LOW = {"wikimedia"}


def lineage_of(source_id: str, publisher: str = "") -> str:
    sid = str(source_id or "").strip().lower()
    if sid in LINEAGE:
        return LINEAGE[sid]
    pub = str(publisher or "").strip().lower()
    if "nasa" in pub:
        return "nasa"
    if pub in {"wikipedia", "wikidata", "dbpedia", "wiktionary", "wikimedia"}:
        return "wikimedia"
    return pub or sid


def low_trust(lineage: str) -> bool:
    return lineage in LOW


def _doc(sid: str, publisher: str, url: str, text: str) -> dict[str, Any]:
    lin = lineage_of(sid, publisher)
    return {
        "url": url, "text": text, "role": "source", "source_id": sid, "publisher": publisher,
        "lineage": lin, "counts": not low_trust(lin), "trust": "low" if low_trust(lin) else "trusted",
    }


def _sentence(text: str) -> str:
    raw = " ".join(_html.unescape(re.sub(r"<[^>]+>", " ", str(text or ""))).split())
    raw = re.sub(r"\s+([,.;:!?])", r"\1", raw)
    part = re.split(r"(?<=[.!?])\s+", raw, maxsplit=1)[0].strip()
    return part if part.endswith((".", "!", "?")) else (part + "." if part else "")


def _about(topic: str, sentence: str) -> bool:
    word = re.escape(topic.lower())
    return re.search(r"\b" + word + r"(es|s)?\b", sentence.lower()) is not None


def fetch_wikidata(topic: str, http: Http) -> list[dict[str, Any]]:
    url = "https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode({
        "action": "wbsearchentities", "search": topic, "language": "en", "format": "json", "limit": 5, "type": "item",
    })
    hits = json.loads(http(url) or "{}").get("search") or []
    want = topic.lower()
    hit = next((h for h in hits if str((h.get("label") or "")).lower() == want and h.get("description")), None)
    if not hit:
        return []
    desc = str(hit.get("description"))
    text = _sentence(topic[:1].upper() + topic[1:] + " is " + desc)
    if not _about(topic, text):
        return []
    return [_doc("wikidata", "Wikimedia", "https://www.wikidata.org/wiki/" + str(hit.get("id") or ""), text)]


def fetch_wikipedia(topic: str, http: Http) -> list[dict[str, Any]]:
    title = urllib.parse.quote(topic[:1].upper() + topic[1:])
    url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + title
    data = json.loads(http(url) or "{}")
    extract = str(data.get("extract") or "")
    if data.get("type") == "disambiguation" or not extract:
        return []
    text = _sentence(extract)
    if not _about(topic, text):
        return []
    return [_doc("wikipedia", "Wikimedia", str(data.get("content_urls", {}).get("desktop", {}).get("page") or url), text)]


def fetch_wiktionary(topic: str, http: Http) -> list[dict[str, Any]]:
    url = "https://en.wiktionary.org/api/rest_v1/page/definition/" + urllib.parse.quote(topic.lower())
    data = json.loads(http(url) or "{}")
    block = (data.get("en") or [None])[0] or {}
    defs = block.get("definitions") or []
    raw = ""
    for item in defs:
        cleaned = _sentence(item.get("definition") or "")
        if cleaned and not cleaned.lower().startswith("plural of"):
            raw = cleaned
            break
    if not raw:
        return []
    if not re.match(r"^(a|an|the|any)\b", raw, flags=re.I):
        text = _sentence(topic[:1].upper() + topic[1:] + " is " + raw[0].lower() + raw[1:])
    else:
        text = _sentence(topic[:1].upper() + topic[1:] + " is " + raw[0].lower() + raw[1:])
    if not _about(topic, text):
        return []
    return [_doc("wiktionary", "Wikimedia", "https://en.wiktionary.org/wiki/" + urllib.parse.quote(topic), text)]


def fetch_dbpedia(topic: str, http: Http) -> list[dict[str, Any]]:
    url = "https://lookup.dbpedia.org/api/search?" + urllib.parse.urlencode({"query": topic, "format": "json", "maxResults": 5})
    docs = json.loads(http(url) or "{}").get("docs") or []
    want = topic.lower()
    hit = None
    for doc in docs:
        label = re.sub(r"<[^>]+>", "", str((doc.get("label") or [""])[0])).strip().lower()
        if label == want:
            hit = doc
            break
    if not hit:
        return []
    comment = str((hit.get("comment") or [""])[0])
    text = _sentence(comment)
    if not _about(topic, text):
        return []
    resource = str((hit.get("resource") or [""])[0])
    return [_doc("dbpedia", "Wikimedia", resource or url, text)]


def fetch_gbif(topic: str, http: Http) -> list[dict[str, Any]]:
    url = "https://api.gbif.org/v1/species/match?" + urllib.parse.urlencode({"name": topic, "verbose": "false"})
    data = json.loads(http(url) or "{}")
    if str(data.get("matchType") or "") not in {"EXACT", "HIGHERRANK"} or int(data.get("confidence") or 0) < 80:
        return []
    name = str(data.get("canonicalName") or data.get("scientificName") or "")
    rank = str(data.get("rank") or "species").lower()
    if not name or name.lower() == topic.lower():
        return []
    text = topic[:1].upper() + topic[1:] + " is a " + rank + ", " + name + "."
    return [_doc("gbif", "GBIF", "https://www.gbif.org/species/" + str(data.get("usageKey") or ""), text)]


def fetch_eol(topic: str, http: Http) -> list[dict[str, Any]]:
    url = "https://eol.org/api/search/1.0.json?" + urllib.parse.urlencode({"q": topic, "page": 1, "exact": "true"})
    results = json.loads(http(url) or "{}").get("results") or []
    want = topic.lower()

    def names_it(text: str) -> bool:
        for part in re.split(r"[;,]", str(text or "")):
            words = re.findall(r"[a-z]+", part.lower())
            if words and (words[0] == want or words[-1] == want or " ".join(words) == want):
                return True
        return False

    hit = next((r for r in results if names_it(r.get("content") or "") or names_it(r.get("title") or "")), None)
    if not hit:
        return []
    content = str(hit.get("content") or hit.get("title") or "")
    if not re.search(r"\b(is|are|was|were)\b", content, flags=re.I):
        return []
    text = _sentence(content if _about(topic, content) else topic[:1].upper() + topic[1:] + " is " + content)
    if not _about(topic, text):
        return []
    return [_doc("eol", "Encyclopedia of Life", str(hit.get("link") or url), text)]


def fetch_pubchem(topic: str, http: Http) -> list[dict[str, Any]]:
    url = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/" + urllib.parse.quote(topic) + "/description/JSON"
    try:
        data = json.loads(http(url) or "{}")
    except FetchMiss:
        return []
    infos = ((data.get("InformationList") or {}).get("Information") or [])
    for info in infos:
        desc = str(info.get("Description") or "")
        if desc:
            text = _sentence(desc if _about(topic, desc) else topic[:1].upper() + topic[1:] + " is " + desc)
            if _about(topic, text):
                return [_doc("pubchem", "NLM", url, text)]
    return []


def fetch_openstax(topic: str, http: Http) -> list[dict[str, Any]]:
    url = "https://openstax.org/api/search?" + urllib.parse.urlencode({"q": topic})
    try:
        data = json.loads(http(url) or "{}")
    except Exception:
        return []
    hits = data.get("results") or data.get("books") or []
    if not isinstance(hits, list):
        return []
    for hit in hits[:4]:
        if not isinstance(hit, dict):
            continue
        title = str(hit.get("title") or "")
        if topic.lower() not in title.lower():
            continue
        blurb = str(hit.get("description") or hit.get("blurb") or "")
        text = _sentence(blurb)
        if text and _about(topic, text):
            return [_doc("openstax", "OpenStax", "https://openstax.org", text)]
    return []


OPEN = {
    "wikidata": fetch_wikidata,
    "wikipedia": fetch_wikipedia,
    "wiktionary": fetch_wiktionary,
    "dbpedia": fetch_dbpedia,
    "gbif": fetch_gbif,
    "eol": fetch_eol,
    "pubchem_desc": fetch_pubchem,
    "openstax": fetch_openstax,
}


def fetch_one(sid: str, topic: str, http: Http) -> list[dict[str, Any]]:
    fn = OPEN.get(sid)
    if not fn:
        return []
    try:
        return fn(topic, http) or []
    except FetchMiss:
        return []
    except Exception:
        raise
