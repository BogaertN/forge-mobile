"""4.9.222 Athena fetchers for the Tier-A trusted sources (FORGE-ATHENA-SOURCES/v1). Deterministic: no model, no embeddings.

Each fetcher turns a question into zero or one document per source page for self_seed_202.evaluate:
  - prose pages (NASA, Space Place, BIPM): the defining sentence is picked first (relation_echo.define_rank, best rank,
    first in page order); a page with no defining sentence gives no document;
  - glosses (MeSH scope note, ChEBI definition, OEWN gloss): rendered "Label is definition." (the first sentence of the
    gloss), which counts as a whole sentence; the verbatim gloss is kept in the document;
  - structured records (NSSDC, World Bank, GeoNames, CODATA, PubChem periodic table): rendered as one plain sentence
    from the record fields, with the record kept verbatim.
Wikidata is a link and cross-check only (crosscheck()): it never returns a source document.
A source is used only while its flag in reference/athena_sources_222.json is on. Nothing here writes anywhere.
The http getter is injectable so every source is unit-tested offline on recorded responses."""
from __future__ import annotations

import gzip
import hashlib
import html as _html
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from rmc_engine_v1.relation_echo import asked, define_rank

HERE = Path(__file__).resolve().parent
CONFIG = HERE / "reference" / "athena_sources_222.json"
UA = "ForgeMobile/4.9.222 (Athena trusted-source fetch; no model; contact via github.com/BogaertN/forge-mobile)"
Http = Callable[[str], str]


class FetchMiss(Exception):
    """The page or record does not exist (404 or empty)."""


def load_config() -> dict[str, Any]:
    return json.loads(CONFIG.read_text(encoding="utf-8"))


def source_rows() -> dict[str, dict[str, Any]]:
    return {row["id"]: row for row in load_config()["sources"]}


def enabled(sid: str) -> bool:
    return bool(source_rows().get(sid, {}).get("enabled"))


def http_get(url: str, timeout: float = 25.0, tries: int = 2) -> str:
    last: Exception | None = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/sparql-results+json,application/json;q=0.9,text/html;q=0.8,text/plain;q=0.7,*/*;q=0.5"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read(4_000_000)
                if raw[:2] == b"\x1f\x8b":
                    raw = gzip.decompress(raw)
                return raw.decode("utf-8", "replace")
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                raise FetchMiss(url) from exc
            last = exc
        except Exception as exc:  # network: retried once, then reported, never read as "no source"
            last = exc
        time.sleep(1.5 * (attempt + 1))
    raise last or RuntimeError("fetch failed")


def sha256_text(text: str) -> str:
    return hashlib.sha256(str(text or "").encode("utf-8")).hexdigest()


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


# ---------------------------------------------------------------- subject, sentences, renders
_Q = re.compile(r"^\s*(?:what|who|which)\s+(?:is|are|was|were)\s+(?:the\s+|a\s+|an\s+)?(.+?)\s*\??\s*$", re.IGNORECASE)
KNOWN_ATTRS = {"capital", "mass", "mean radius", "radius", "density", "mean density", "surface gravity", "gravity", "escape velocity"}
_OF = re.compile(r"^(?P<attr>[A-Za-z][A-Za-z ]*?)\s+of\s+(?:the\s+)?(?P<thing>.+)$", re.IGNORECASE)


def subject_of(question: str) -> dict[str, Any]:
    """The asked label with the asker's own capitalisation, and for 'X of Y' the attribute and the thing."""
    m = _Q.match(str(question or ""))
    label = m.group(1).strip() if m else ""
    out: dict[str, Any] = {"question": question, "label": label, "ask": asked(question), "attr": None, "thing": None}
    of = _OF.match(label) if label else None
    if of and of.group("attr").strip().lower() in KNOWN_ATTRS:
        out["attr"], out["thing"] = of.group("attr").strip().lower(), of.group("thing").strip()
    return out


def page_text_blocks(page: str) -> list[str]:
    """Paragraph text of an HTML page (scripts, styles, navigation and footers dropped)."""
    t = re.sub(r"(?is)<(script|style|noscript|svg|nav|header|footer|form)\b.*?</\1>", " ", page)
    blocks = re.findall(r"(?is)<p\b[^>]*>(.*?)</p>", t)
    out = []
    for b in blocks:
        text = " ".join(_html.unescape(re.sub(r"<[^>]+>", " ", b)).split())
        text = re.sub(r"\s+([,.;:!?])", r"\1", text)
        if len(text) >= 20:
            out.append(text)
    return out


def sentences_of(blocks: list[str]) -> list[str]:
    out = []
    for block in blocks:
        for part in re.split(r"(?<=[.!?])\s+(?=[A-Z\"'(])", block):
            part = part.strip()
            if part:
                out.append(part)
    return out


def choose_defining(question: str, sentences: list[str]) -> dict[str, Any] | None:
    """define_rank first: the best-ranked sentence, first in page order; rank 0 (only a mention) is never chosen."""
    ask = asked(question)
    best = None
    for i, s in enumerate(sentences):
        r = define_rank(ask, s)
        if r.get("rank", 0) >= 1 and (best is None or r["rank"] > best["rank"]):
            best = {"sentence": s, "rank": r["rank"], "kind": r.get("kind"), "index": i}
            if r["rank"] == 2:
                break
    return best


_LOWER_OK = {"the", "a", "an", "any", "one", "some", "either", "each"}


def render_gloss(label: str, gloss: str) -> str | None:
    """'Label is definition.' from the first sentence (or first ';' clause) of a dictionary-style gloss."""
    g = " ".join(str(gloss or "").split())
    if not g or not label:
        return None
    g = re.sub(r"^\((?:[a-z ]+)\)\s+", "", g)  # OEWN domain label, e.g. "(physics) the force of ..."
    g = re.split(r"(?<=[a-z0-9)\]])\.\s+(?=[A-Z])", g, maxsplit=1)[0]
    depth, cut = 0, len(g)
    for i, ch in enumerate(g):  # first '; ' outside brackets ("atomic weight [15.99903; 15.99977]" stays whole)
        depth += ch in "([" ; depth -= ch in ")]"
        if ch == ";" and depth <= 0 and g[i + 1:i + 2] == " ":
            cut = i
            break
    g = g[:cut].strip().rstrip(".;: ")
    if re.sub(r"[^a-z0-9]", "", g.lower()).startswith(re.sub(r"[^a-z0-9]", "", label.lower())):
        return None  # a tautology ("Quartz is Quartz (SiO2).") defines nothing
    first = g.split(" ", 1)[0]
    if first and first[0].isupper() and first[1:] == first[1:].lower() and (first.lower() in _LOWER_OK or first.lower() not in label.lower().split()):
        g = first[0].lower() + g[1:]
    if not g:
        return None
    return label[0].upper() + label[1:] + " is " + g + "."


def _doc(sid: str, url: str, text: str, verbatim: str, how: dict[str, Any], raw: str = "") -> dict[str, Any]:
    row = source_rows()[sid]
    return {
        "url": url, "text": text, "role": "source", "source_id": sid, "publisher": row["publisher"], "kind": row["kind"],
        "verbatim": verbatim, "how": how, "fetched_at": now_iso(), "sha256": sha256_text(text),
        "raw_sha256": sha256_text(raw or verbatim),
    }


def _slug(label: str) -> str:
    s = re.sub(r"^(the|a|an)\s+", "", label.strip().lower())
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


# ---------------------------------------------------------------- NASA (one publisher, three hosts)
def fetch_nasa_science(q: str, http: Http) -> list[dict[str, Any]]:
    subj = subject_of(q)
    if not subj["label"] or subj["attr"]:
        return []
    slug = _slug(subj["label"])
    for url in (f"https://science.nasa.gov/{slug}/facts/", f"https://science.nasa.gov/{slug}/"):
        try:
            page = http(url)
        except FetchMiss:
            continue
        pick = choose_defining(q, sentences_of(page_text_blocks(page)))
        if pick:
            return [_doc("nasa_science", url, pick["sentence"], pick["sentence"], {"define_rank": pick["rank"], "index": pick["index"]}, page)]
    return []


def fetch_nasa_spaceplace(q: str, http: Http) -> list[dict[str, Any]]:
    subj = subject_of(q)
    if not subj["label"] or subj["attr"]:
        return []
    slug = _slug(subj["label"])
    for path in (f"all-about-the-{slug}", f"all-about-{slug}", f"what-is-{slug}", slug):
        url = f"https://spaceplace.nasa.gov/{path}/en/"
        try:
            page = http(url)
        except FetchMiss:
            continue
        if "<title>Page Not Found" in page or "Page not found" in page[:4000]:
            continue
        pick = choose_defining(q, sentences_of(page_text_blocks(page)))
        if pick:
            return [_doc("nasa_spaceplace", url, pick["sentence"], pick["sentence"], {"define_rank": pick["rank"], "index": pick["index"]}, page)]
    return []


NSSDC_BODIES = {"mercury", "venus", "earth", "moon", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "sun"}
NSSDC_ATTRS = {  # question attribute -> fact-sheet row label (the label text before the unit)
    "mass": "Mass", "mean radius": "Volumetric mean radius", "radius": "Volumetric mean radius", "density": "Mean density",
    "mean density": "Mean density", "surface gravity": "Surface gravity", "gravity": "Surface gravity", "escape velocity": "Escape velocity",
}


def _nssdc_rows(page: str) -> dict[str, tuple[str, str]]:
    out = {}
    for row in re.findall(r"(?is)<tr[^>]*>(.*?)</tr>", page):
        cells = [" ".join(_html.unescape(re.sub(r"<[^>]+>", " ", c)).split()) for c in re.findall(r"(?is)<t[dh][^>]*>(.*?)</t[dh]>", row)]
        if len(cells) >= 2 and cells[0]:
            m = re.match(r"^(.*?)\s*\((.*)\)\s*$", cells[0])
            name, unit = (m.group(1), m.group(2)) if m else (cells[0], "")
            out[name.strip()] = (cells[1], unit)
    return out


def _nssdc_unit(unit: str) -> tuple[str, str]:
    """'10 24 kg' (superscripts flattened by the page) -> ('× 10^24', 'kg')."""
    m = re.match(r"^(?:x\s*)?10\s+(-?\d+)\s+(.*)$", unit.strip())
    if m:
        return "× 10^" + m.group(1), re.sub(r"\s+(\d)\b", r"^\1", m.group(2)).strip()
    return "", re.sub(r"(?<=[a-z])\s+(\d)\b", r"^\1", unit.strip())


def fetch_nasa_nssdc(q: str, http: Http) -> list[dict[str, Any]]:
    subj = subject_of(q)
    attr, thing = subj["attr"], (subj["thing"] or "")
    body = re.sub(r"^(the)\s+", "", thing.lower())
    if not attr or attr not in NSSDC_ATTRS or body not in NSSDC_BODIES:
        return []
    url = f"https://nssdc.gsfc.nasa.gov/planetary/factsheet/{body}fact.html"
    page = http(url)
    rows = _nssdc_rows(page)
    want = NSSDC_ATTRS[attr]
    if want not in rows:
        return []
    value, unit = rows[want]
    scale, unit = _nssdc_unit(unit)
    name = "the Moon" if body == "moon" else ("the Sun" if body == "sun" else body.capitalize())
    text = f"The {attr} of {name} is {value}{(' ' + scale) if scale else ''} {unit}.".replace("  ", " ")
    return [_doc("nasa_nssdc", url, text, f"{want} ({unit}): {value}", {"record": want}, page)]


# ---------------------------------------------------------------- NLM MeSH
MESH = "https://id.nlm.nih.gov/mesh"


def fetch_nlm_mesh(q: str, http: Http) -> list[dict[str, Any]]:
    subj = subject_of(q)
    label = subj["label"]
    if not label or subj["attr"]:
        return []
    tried = []
    for form in dict.fromkeys([label, label[0].upper() + label[1:], label.title()]):
        hits = json.loads(http(f"{MESH}/lookup/term?" + urllib.parse.urlencode({"label": form, "match": "exact", "limit": 3})) or "[]")
        tried.append(form)
        for hit in hits:
            term = str(hit.get("resource") or "").rsplit("/", 1)[-1]
            query = ("PREFIX meshv: <http://id.nlm.nih.gov/mesh/vocab#> PREFIX mesh: <http://id.nlm.nih.gov/mesh/> "
                     "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> SELECT ?d ?dl ?c ?note WHERE { "
                     "{ ?c meshv:preferredTerm mesh:%s } UNION { ?c meshv:term mesh:%s } . ?d meshv:preferredConcept ?c . "
                     "?d rdfs:label ?dl . ?c meshv:scopeNote ?note }" % (term, term))
            res = json.loads(http(f"{MESH}/sparql?" + urllib.parse.urlencode({"query": query, "format": "JSON"})))
            for b in (res.get("results") or {}).get("bindings") or []:
                note = b["note"]["value"]
                desc = b["d"]["value"].rsplit("/", 1)[-1]
                text = render_gloss(str(hit.get("label") or form), note)
                if text:
                    # the term is in the descriptor's preferred concept: a synonym, the same meaning
                    return [_doc("nlm_mesh", f"https://id.nlm.nih.gov/mesh/{desc}.html", text, note,
                                 {"descriptor": desc, "descriptor_label": b["dl"]["value"], "term": term, "render": "GLOSS-FIT"})]
    return []


# ---------------------------------------------------------------- countries (World Bank, GeoNames)
def _country_thing(subj: dict[str, Any]) -> str | None:
    if subj["attr"] != "capital" or not subj["thing"]:
        return None
    return subj["thing"].strip()


def _cnorm(name: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", name.lower().replace("&", "and")))


def fetch_worldbank(q: str, http: Http) -> list[dict[str, Any]]:
    thing = _country_thing(subject_of(q))
    if not thing:
        return []
    url = "https://api.worldbank.org/v2/country?format=json&per_page=400"
    raw = http(url)
    data = json.loads(raw)
    for c in data[1] if isinstance(data, list) and len(data) > 1 else []:
        if _cnorm(c.get("name") or "") == _cnorm(thing) and (c.get("capitalCity") or "").strip():
            text = f"The capital of {c['name']} is {c['capitalCity'].strip()}."
            return [_doc("worldbank", f"https://api.worldbank.org/v2/country/{c['id']}?format=json", text,
                         json.dumps({k: c.get(k) for k in ("id", "name", "capitalCity")}, ensure_ascii=False), {"record": c["id"]}, raw)]
    return []


def fetch_geonames(q: str, http: Http) -> list[dict[str, Any]]:
    thing = _country_thing(subject_of(q))
    if not thing:
        return []
    url = "https://download.geonames.org/export/dump/countryInfo.txt"
    raw = http(url)
    for line in raw.splitlines():
        if not line or line.startswith("#"):
            continue
        f = line.split("\t")
        if len(f) > 5 and _cnorm(f[4]) == _cnorm(thing) and f[5].strip():
            text = f"The capital of {f[4]} is {f[5].strip()}."
            return [_doc("geonames", url + "#" + f[0], text, "\t".join(f[:9]), {"record": f[0]}, raw)]
    return []


# ---------------------------------------------------------------- NIST CODATA, BIPM SI
def _codata_value(v: str) -> str:
    v = v.replace(" ", "").replace("...", "")
    m = re.match(r"^(-?[\d.]+)e(-?\d+)$", v)
    return f"{m.group(1)} × 10^{int(m.group(2))}" if m else v


def fetch_nist_codata(q: str, http: Http) -> list[dict[str, Any]]:
    subj = subject_of(q)
    label = re.sub(r"^(the|a|an)\s+", "", subj["label"].lower())
    if not label:
        return []
    url = "https://physics.nist.gov/cuu/Constants/Table/allascii.txt"
    raw = http(url)
    rows = []
    for line in raw.splitlines():
        m = re.match(r"^(\S.*?)\s{2,}(-?[\d. ]+(?:e-?\d+)?(?:\.\.\.)?)\s{2,}(\(exact\)|[\d. ]+(?:e-?\d+)?)\s*(.*)$", line)
        if m:
            rows.append((m.group(1).strip(), m.group(2).strip(), m.group(3).strip(), m.group(4).strip()))
    pick = next((r for r in rows if r[0].lower() == label), None)
    if not pick:  # "speed of light" -> "speed of light in vacuum": the one row that extends the asked name
        ext = [r for r in rows if r[0].lower().startswith(label + " ")]
        pick = ext[0] if len(ext) == 1 else None
    if not pick:
        return []
    name, value, unc, unit = pick
    text = f"The {name} is {_codata_value(value)}{(' ' + unit) if unit else ''}{' (exact)' if unc == '(exact)' else ''}."
    return [_doc("nist_codata", url + "#" + urllib.parse.quote(name), text, " | ".join(pick), {"record": name, "edition": "CODATA 2022"}, raw)]


BIPM_UNITS = {"second": "second", "metre": "metre", "meter": "metre", "kilogram": "kilogram", "ampere": "ampere",
              "kelvin": "kelvin", "mole": "mole", "candela": "candela"}


def fetch_bipm_si(q: str, http: Http) -> list[dict[str, Any]]:
    subj = subject_of(q)
    word = re.sub(r"^(the|a|an)\s+", "", subj["label"].lower())
    unit = BIPM_UNITS.get(word)
    if not unit or subj["attr"]:
        return []
    url = f"https://www.bipm.org/en/si-base-units/{unit}"
    page = http(url)
    plain = " ".join(_html.unescape(re.sub(r"<[^>]+>", " ", re.sub(r"(?is)<(script|style)\b.*?</\1>", " ", page))).split())
    m = re.search(r"The (%s), symbol (\S+), is (the SI unit of [^.]+)\." % unit, plain)
    if not m:
        return []
    verbatim = m.group(0)
    shown = word if word != unit else unit  # the asker's spelling (meter) of the BIPM name (metre)
    text = f"The {shown} is {m.group(3)}."
    return [_doc("bipm_si", url, text, verbatim, {"render": "drop the symbol apposition", "symbol": m.group(2)}, page)]


# ---------------------------------------------------------------- chemistry: PubChem, ChEBI
PUBCHEM_PD_ORIGINS = {"LiverTox", "Hazardous Substances Data Bank (HSDB)"}


def fetch_pubchem(q: str, http: Http) -> list[dict[str, Any]]:
    subj = subject_of(q)
    label = re.sub(r"^(the|a|an)\s+", "", subj["label"])
    if not label or subj["attr"]:
        return []
    url = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON"
    raw = http(url)
    table = json.loads(raw)["Table"]
    cols = table["Columns"]["Column"]
    for row in table["Row"]:
        rec = dict(zip(cols, row["Cell"]))
        if rec.get("Name", "").lower() == label.lower():
            text = f"{rec['Name']} is a chemical element with symbol {rec['Symbol']} and atomic number {rec['AtomicNumber']}."
            return [_doc("pubchem", f"https://pubchem.ncbi.nlm.nih.gov/element/{rec['AtomicNumber']}", text,
                         json.dumps({k: rec[k] for k in ("AtomicNumber", "Symbol", "Name", "GroupBlock", "StandardState")}), {"record": "periodic table"}, raw)]
    durl = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{urllib.parse.quote(label)}/description/JSON"
    try:
        info = json.loads(http(durl)).get("InformationList", {}).get("Information", [])
    except FetchMiss:
        return []
    cid = next((i.get("CID") for i in info if i.get("CID")), None)
    for item in info:
        if item.get("Description") and item.get("DescriptionSourceName") in PUBCHEM_PD_ORIGINS:
            sents = sentences_of([item["Description"]])
            pick = choose_defining(q, sents)
            if pick:
                return [_doc("pubchem", f"https://pubchem.ncbi.nlm.nih.gov/compound/{cid}", pick["sentence"], item["Description"],
                             {"origin": item["DescriptionSourceName"], "define_rank": pick["rank"]})]
    return []


def fetch_chebi(q: str, http: Http) -> list[dict[str, Any]]:
    subj = subject_of(q)
    label = re.sub(r"^(the|a|an)\s+", "", subj["label"])
    if not label or subj["attr"]:
        return []
    url = "https://www.ebi.ac.uk/ols4/api/search?" + urllib.parse.urlencode({"q": label, "ontology": "chebi", "exact": "true", "rows": 5})
    docs = (json.loads(http(url)).get("response") or {}).get("docs") or []
    for d in docs:
        if str(d.get("label") or "").lower() == label.lower() and d.get("description"):
            gloss = str(d["description"][0])
            text = render_gloss(label, gloss)
            if text:
                return [_doc("chebi", "https://www.ebi.ac.uk/chebi/searchId.do?chebiId=" + str(d.get("obo_id")), text, gloss,
                             {"chebi": d.get("obo_id"), "render": "GLOSS-FIT"})]
    return []


# ---------------------------------------------------------------- Open English WordNet 2025 plus (pinned sense)
_OEWN_CACHE: dict[str, Any] = {}


def oewn_dir() -> Path | None:
    p = os.environ.get("FORGE_OEWN_DIR")
    return Path(p) if p and Path(p).is_dir() else None


def _oewn_entries(letter: str) -> dict[str, Any]:
    key = "e" + letter
    if key not in _OEWN_CACHE:
        d = oewn_dir()
        f = d / f"entries-{letter if letter.isalpha() else '0'}.json" if d else None
        _OEWN_CACHE[key] = json.loads(f.read_text(encoding="utf-8")) if f and f.exists() else {}
    return _OEWN_CACHE[key]


def _oewn_synset(sid: str) -> dict[str, Any] | None:
    if "syn" not in _OEWN_CACHE:
        d = oewn_dir()
        syn: dict[str, Any] = {}
        for f in sorted(d.glob("noun.*.json")) if d else []:
            syn.update(json.loads(f.read_text(encoding="utf-8")))
        _OEWN_CACHE["syn"] = syn
    return _OEWN_CACHE["syn"].get(sid)


def fetch_oewn(q: str, http: Http, pinned: dict[str, str] | None = None) -> list[dict[str, Any]]:
    """The gloss of the pinned sense when the concept is pinned; otherwise the only noun meaning of the word as asked
    (capitalisation kept). Two or more meanings and no pin: nothing is guessed (the dry-run asks)."""
    subj = subject_of(q)
    label = re.sub(r"^(the|a|an)\s+", "", subj["label"], flags=re.IGNORECASE)
    if not label or subj["attr"] or not oewn_dir():
        return []
    sid = (pinned or {}).get(label.lower())
    how = {"sense": "pinned"} if sid else {}
    if not sid:
        forms = [label] if label[:1].isupper() else [label, label.lower()]
        senses = []
        for form in forms:
            ent = _oewn_entries(form[:1].lower()).get(form) or {}
            senses += [s["synset"] for s in (ent.get("n") or {}).get("sense") or []]
        senses = list(dict.fromkeys(senses))
        if len(senses) != 1:
            return [{"role": "ambiguous", "source_id": "oewn", "senses": senses, "url": "", "text": ""}] if senses else []
        sid, how = senses[0], {"sense": "only noun meaning"}
    syn = _oewn_synset(sid)
    if not syn or not syn.get("definition"):
        return []
    gloss = str(syn["definition"][0])
    text = render_gloss(label, gloss)
    return [_doc("oewn", f"https://en-word.net/id/oewn-{sid}", text, gloss, dict(how, synset=sid, ili=syn.get("ili"), qid=_qid(syn.get("wikidata")), render="GLOSS-FIT"))] if text else []


# ---------------------------------------------------------------- Wikidata: link and cross-check only
def _qid(value: Any) -> str | None:
    if isinstance(value, list):
        value = value[0] if value else None
    value = str(value or "").strip()
    return value if re.fullmatch(r"Q\d+", value) else None


def crosscheck(q: str, http: Http, qid: str | None = None) -> dict[str, Any] | None:
    """Wikidata as a link and a cross-check only. With the QID the pinned OEWN sense links to, read that item's label and
    description; without one, only report how many items carry the label (it is never used to pick a meaning)."""
    subj = subject_of(q)
    label = re.sub(r"^(the|a|an)\s+", "", subj["label"], flags=re.IGNORECASE)
    if not label:
        return None
    if qid:
        url = "https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode({"action": "wbgetentities", "ids": qid, "props": "labels|descriptions", "languages": "en", "format": "json"})
        ent = (json.loads(http(url)).get("entities") or {}).get(qid) or {}
        lab = ((ent.get("labels") or {}).get("en") or {}).get("value")
        desc = ((ent.get("descriptions") or {}).get("en") or {}).get("value")
        return {"role": "crosscheck", "source_id": "wikidata", "qid": qid, "label": lab, "description": desc, "via": "OEWN sense link",
                "label_matches": bool(lab) and lab.lower() == label.lower(), "url": "https://www.wikidata.org/wiki/" + qid, "counts_as_publisher": False}
    url = "https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode({"action": "wbsearchentities", "search": label, "language": "en", "format": "json", "limit": 7, "type": "item"})
    hits = json.loads(http(url)).get("search") or []
    exact = [h for h in hits if str(h.get("label") or "").lower() == label.lower()]
    return {"role": "crosscheck", "source_id": "wikidata", "qid": None, "via": "label search (not resolved)", "exact_label_items": len(exact),
            "counts_as_publisher": False}


def pins_from_table(table: dict[str, Any]) -> tuple[dict[str, str], dict[str, str]]:
    """The 4.9.221 curated meaning table (passed in by the caller) -> (surface -> pinned OEWN sense, surface -> the QID that sense links to)."""
    pinned = {r["surface"]: r["sense"] for r in (table.get("concepts") or {}).values() if r.get("surface") and r.get("sense")}
    senses = table.get("senses") or {}
    qids = {}
    for surface, sid in pinned.items():
        q = _qid((senses.get(sid) or [None, None, None])[2])
        if q:
            qids[surface] = q
    return pinned, qids


FETCHERS: dict[str, Callable[..., list[dict[str, Any]]]] = {
    "nasa_science": fetch_nasa_science, "nasa_nssdc": fetch_nasa_nssdc, "nasa_spaceplace": fetch_nasa_spaceplace,
    "nlm_mesh": fetch_nlm_mesh, "worldbank": fetch_worldbank, "geonames": fetch_geonames, "nist_codata": fetch_nist_codata,
    "bipm_si": fetch_bipm_si, "pubchem": fetch_pubchem, "chebi": fetch_chebi, "oewn": fetch_oewn,
}


def fetch_all(question: str, http: Http = http_get, pinned: dict[str, str] | None = None, only: list[str] | None = None, pinned_qid: dict[str, str] | None = None) -> dict[str, Any]:
    """Every enabled source, one by one. A source error is recorded for that source and never stops the others."""
    rows = source_rows()
    per: dict[str, Any] = {}
    docs: list[dict[str, Any]] = []
    for sid, row in rows.items():
        if only and sid not in only:
            continue
        if not row.get("enabled"):
            per[sid] = {"status": row.get("status") or "DISABLED", "docs": []}
            continue
        if sid == "wikidata":
            continue  # after every source: it reads the QID the OEWN sense links to
        try:
            got = FETCHERS[sid](question, http, pinned) if sid == "oewn" else FETCHERS[sid](question, http)
        except FetchMiss:
            got = []
        except Exception as exc:
            per[sid] = {"status": "ERROR", "error": type(exc).__name__ + ": " + str(exc)[:120], "docs": []}
            continue
        amb = [d for d in got if d.get("role") == "ambiguous"]
        src = [d for d in got if d.get("role") == "source"]
        per[sid] = {"status": "AMBIGUOUS" if amb else ("FETCHED" if src else "NO-ENTRY"), "docs": src, "senses": amb[0]["senses"] if amb else None}
        docs += src
    if rows.get("wikidata", {}).get("enabled") and (not only or "wikidata" in only):
        qid = next((d["how"].get("qid") for d in docs if d.get("source_id") == "oewn"), None) or (pinned_qid or {}).get(subject_of(question)["label"].lower().removeprefix("the ").removeprefix("a "))
        try:
            per["wikidata"] = {"status": "CROSSCHECK", "crosscheck": crosscheck(question, http, qid)}
        except Exception as exc:
            per["wikidata"] = {"status": "ERROR", "error": type(exc).__name__ + ": " + str(exc)[:120]}
    return {"question": question, "per_source": per, "documents": docs, "calls_llm": False, "writes": False}
