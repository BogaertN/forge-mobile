"""4.9.223 Athena sources (FORGE-ATHENA-SOURCES/v1, build 4.9.223). Deterministic: no model, no embeddings.

Adds to the 4.9.222 fetchers (athena_sources_222, unchanged):
  - cia_factbook: the last World Factbook edition before the 2026-02-04 shutdown, read from the public-domain
    factbook/factbook.json mirror pinned at one commit (CC0); capital only; the document URL is the original cia.gov page;
  - bipm_constants: the SI defining-constants table (exact values) so BIPM and NIST CODATA can agree on a number;
  - pubchem: compound descriptions from PUG-View, LiverTox / HSDB (public domain) and the NCI Thesaurus (CC BY 4.0,
    with its licence and attribution on the document);
  - oewn: the subject's meaning from the meaning layer (pinned, else the only meaning of the asked phrase).
The config is reference/athena_sources_223.json. Nothing here writes anywhere."""
from __future__ import annotations

import html as _html
import json
import re
import urllib.parse
from pathlib import Path
from typing import Any, Callable

from rmc_engine_v1 import athena_sources_222 as S
from rmc_engine_v1.athena_sources_222 import FetchMiss, Http, http_get, subject_of, sentences_of, choose_defining, render_gloss

HERE = Path(__file__).resolve().parent
CONFIG = HERE / "reference" / "athena_sources_223.json"


def load_config() -> dict[str, Any]:
    return json.loads(CONFIG.read_text(encoding="utf-8"))


def source_rows() -> dict[str, dict[str, Any]]:
    return {row["id"]: row for row in load_config()["sources"]}


def _doc(sid: str, url: str, text: str, verbatim: str, how: dict[str, Any], raw: str = "", **extra: Any) -> dict[str, Any]:
    row = source_rows()[sid]
    out = {
        "url": url, "text": text, "role": "source", "source_id": sid, "publisher": row["publisher"], "kind": row["kind"],
        "verbatim": verbatim, "how": how, "fetched_at": S.now_iso(), "sha256": S.sha256_text(text),
        "raw_sha256": S.sha256_text(raw or verbatim),
    }
    out.update({k: v for k, v in extra.items() if v is not None})
    return out


# ---------------------------------------------------------------- CIA World Factbook (frozen, last edition)
FACTBOOK_TREE = "https://api.github.com/repos/factbook/factbook.json/git/trees/{sha}?recursive=1"
FACTBOOK_RAW = "https://raw.githubusercontent.com/factbook/factbook.json/{sha}/{path}"


def _bare(name: str) -> str:
    return re.sub(r"^the ", "", S._cnorm(name))


def _fips_of(thing: str, http: Http) -> tuple[str, str] | None:
    raw = http("https://download.geonames.org/export/dump/countryInfo.txt")
    for line in raw.splitlines():
        if not line or line.startswith("#"):
            continue
        f = line.split("\t")
        if len(f) > 4 and _bare(f[4]) == _bare(thing) and f[3].strip():
            return f[3].strip().lower(), f[4]
    return None


def _factbook_capital(text: str) -> str | None:
    t = " ".join(_html.unescape(re.sub(r"<[^>]+>", " ", str(text or ""))).split())
    t = re.split(r";|\bnote\b", t, maxsplit=1)[0].strip().rstrip(",. ")
    t = re.sub(r"\s*\(.*?\)\s*$", "", t).strip()
    return t or None


def fetch_cia_factbook(q: str, http: Http) -> list[dict[str, Any]]:
    subj = subject_of(q)
    thing = S._country_thing(subj)
    if not thing:
        return []
    row = source_rows()["cia_factbook"]
    sha = row["mirror_commit"]
    fips = _fips_of(thing, http)  # routing only: GeoNames gives the Factbook (FIPS 10-4) code for the country name
    if not fips:
        return []
    code, _gname = fips
    tree = json.loads(http(FACTBOOK_TREE.format(sha=sha)))
    path = next((t["path"] for t in tree.get("tree") or [] if re.fullmatch(r"[a-z\-]+/%s\.json" % re.escape(code), t.get("path") or "")), None)
    if not path:
        return []
    raw_url = FACTBOOK_RAW.format(sha=sha, path=path)
    raw = http(raw_url)
    data = json.loads(raw)
    cap = (((data.get("Government") or {}).get("Capital") or {}).get("name") or {}).get("text")
    name = _factbook_capital(cap or "")
    short = ((((data.get("Government") or {}).get("Country name") or {}).get("conventional short form") or {}).get("text") or "")
    if not name:
        return []
    text = f"The capital of {thing} is {name}."
    slug = re.sub(r"[^a-z0-9]+", "-", (short or thing).lower()).strip("-")
    return [_doc("cia_factbook", f"https://www.cia.gov/the-world-factbook/countries/{slug}/", text, json.dumps({"Capital": {"name": cap}}, ensure_ascii=False),
                 {"record": code, "edition": row.get("as_of"), "mirror_commit": sha[:12], "country_short_form": short}, raw,
                 archived_from=raw_url, as_of=row.get("as_of"))]


# ---------------------------------------------------------------- BIPM SI defining constants
BIPM_CONSTANTS = {"c": "speed of light in vacuum", "h": "Planck constant", "e": "elementary charge", "k": "Boltzmann constant",
                  "NA": "Avogadro constant", "ΔνCs": "caesium hyperfine frequency", "Kcd": "luminous efficacy"}


def _cell(c: str) -> str:
    c = re.sub(r"(?is)<sup[^>]*>(.*?)</sup>", r"^\1", c)
    return " ".join(_html.unescape(re.sub(r"<[^>]+>", "", c)).split()).replace("\u2013", "-").replace("\u2212", "-")


def fetch_bipm_constants(q: str, http: Http) -> list[dict[str, Any]]:
    subj = subject_of(q)
    label = re.sub(r"^(the|a|an)\s+", "", subj["label"].lower())
    if not label or subj["attr"]:
        return []
    want = [(sym, name) for sym, name in BIPM_CONSTANTS.items() if name.lower() == label or name.lower().startswith(label + " ")]
    if len(want) != 1:
        return []
    sym, name = want[0]
    url = "https://www.bipm.org/en/measurement-units/si-defining-constants"
    page = http(url)
    for row in re.findall(r"(?is)<tr[^>]*>(.*?)</tr>", page):
        cells = [_cell(c) for c in re.findall(r"(?is)<t[dh][^>]*>(.*?)</t[dh]>", row)]
        if len(cells) >= 3 and cells[0].replace(" ", "").replace("^", "") == sym:
            value = re.sub(r"\s*x\s*10\^?", " × 10^", cells[1])
            text = f"The {name} is {value} {cells[2]} (exact)."
            return [_doc("bipm_constants", url + "#" + urllib.parse.quote(sym), text, " | ".join(cells[:3]), {"record": name, "symbol": sym}, page)]
    return []


# ---------------------------------------------------------------- PubChem (elements; PD and NCIt descriptions)
PUBCHEM_ORIGINS = {
    "LiverTox": {"license": "public-domain", "license_url": "https://www.nlm.nih.gov/copyright.html"},
    "Hazardous Substances Data Bank (HSDB)": {"license": "public-domain", "license_url": "https://www.nlm.nih.gov/copyright.html"},
    "NCI Thesaurus (NCIt)": {"license": "CC BY 4.0", "license_url": "https://creativecommons.org/licenses/by/4.0/",
                             "attribution": "Definition from the NCI Thesaurus (NCIt), National Cancer Institute, CC BY 4.0, via PubChem."},
}


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
    try:
        cids = (json.loads(http(f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{urllib.parse.quote(label)}/cids/JSON")).get("IdentifierList") or {}).get("CID") or []
    except FetchMiss:
        return []
    if not cids:
        return []
    cid = cids[0]
    view = json.loads(http(f"https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/{cid}/JSON?heading=Record+Description"))
    rec = view.get("Record") or {}
    refs = {r.get("ReferenceNumber"): r for r in rec.get("Reference") or []}
    infos: list[dict[str, Any]] = []

    def walk(sec: dict[str, Any]) -> None:
        for sub in sec.get("Section") or []:
            walk(sub)
        infos.extend(sec.get("Information") or [])

    walk(rec)
    for origin in PUBCHEM_ORIGINS:  # public domain first, then NCIt
        for inf in infos:
            ref = refs.get(inf.get("ReferenceNumber")) or {}
            if ref.get("SourceName") != origin:
                continue
            desc = " ".join(str(((inf.get("Value") or {}).get("StringWithMarkup") or [{}])[0].get("String") or "").split())
            pick = choose_defining(q, sentences_of([desc])) if desc else None
            if pick:
                lic = PUBCHEM_ORIGINS[origin]
                extra = {"origin": origin, "origin_url": ref.get("URL")}
                if lic["license"] != "public-domain":
                    extra.update(license=lic["license"], license_url=lic["license_url"], attribution=lic.get("attribution"))
                return [_doc("pubchem", f"https://pubchem.ncbi.nlm.nih.gov/compound/{cid}", pick["sentence"], desc,
                             {"origin": origin, "define_rank": pick["rank"], "cid": cid}, **extra)]
    return []


# ---------------------------------------------------------------- ChEBI with the category's own is_a path
OLS = "https://www.ebi.ac.uk/ols4/api"
CHEBI_PATH_DEPTH = 4


def _ols_iri(iri: str) -> str:
    return urllib.parse.quote(urllib.parse.quote(iri, safe=""), safe="")


def chebi_category_path(head: str, http: Http) -> list[str]:
    """Breadth-first is_a parents of the ChEBI class named by the definition's head ('azane' -> 'nitrogen hydride' ->
    ... ), nearest first, at most CHEBI_PATH_DEPTH levels. Used only when WordNet does not know the head."""
    url = f"{OLS}/search?" + urllib.parse.urlencode({"q": head, "ontology": "chebi", "exact": "true", "rows": 5})
    docs = (json.loads(http(url)).get("response") or {}).get("docs") or []
    start = next((d for d in docs if str(d.get("label") or "").lower() == head.lower() and d.get("iri")), None)
    if not start:
        return []
    out: list[str] = []
    level = [start["iri"]]
    seen = {start["iri"]}
    for _ in range(CHEBI_PATH_DEPTH):
        nxt: list[str] = []
        for iri in level:
            got = json.loads(http(f"{OLS}/ontologies/chebi/terms/{_ols_iri(iri)}/parents?size=20"))
            for t in sorted((got.get("_embedded") or {}).get("terms") or [], key=lambda t: str(t.get("label") or "")):
                if t.get("iri") and t["iri"] not in seen:
                    seen.add(t["iri"])
                    nxt.append(t["iri"])
                    out.append(str(t.get("label") or ""))
        level = nxt
        if not level:
            break
    return out


def fetch_chebi(q: str, http: Http) -> list[dict[str, Any]]:
    from rmc_engine_v1.meaning_223 import category_of

    docs = S.fetch_chebi(q, http)
    for d in docs:
        d["source_id"] = "chebi"
        cat = category_of(d["text"])
        if cat.get("category") and not cat.get("known"):
            try:
                d["category_path"] = chebi_category_path(cat["category"], http)
                d["category_path_source"] = "ChEBI is_a (OLS4)"
            except FetchMiss:
                pass
    return docs


# ---------------------------------------------------------------- OEWN through the meaning layer
def fetch_oewn(q: str, http: Http, subject: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    subj = subject_of(q)
    if not subj["label"] or subj["attr"] or not S.oewn_dir() or not subject:
        return []
    if subject.get("state") == "ask":
        return [{"role": "ambiguous", "source_id": "oewn", "senses": [c["sense"] for c in subject.get("candidates") or []], "url": "", "text": ""}]
    sid = subject.get("sense")
    if not sid:
        return []
    syn = S._oewn_synset(sid)
    if not syn or not syn.get("definition"):
        return []
    label = re.sub(r"^(the|a|an)\s+", "", subj["label"], flags=re.IGNORECASE)
    gloss = str(syn["definition"][0])
    text = render_gloss(label, gloss)
    how = {"sense": "pinned" if subject.get("state") == "pinned" else "only meaning of the asked phrase", "synset": sid, "ili": syn.get("ili"),
           "qid": S._qid(syn.get("wikidata")), "render": "GLOSS-FIT"}
    return [_doc("oewn", f"https://en-word.net/id/oewn-{sid}", text, gloss, how)] if text else []


FETCHERS: dict[str, Callable[..., list[dict[str, Any]]]] = dict(S.FETCHERS)
FETCHERS.update({"cia_factbook": fetch_cia_factbook, "bipm_constants": fetch_bipm_constants, "pubchem": fetch_pubchem, "chebi": fetch_chebi, "oewn": fetch_oewn})


def fetch_all(question: str, http: Http = http_get, subject: dict[str, Any] | None = None, only: list[str] | None = None) -> dict[str, Any]:
    """Every enabled source, one by one; a source error is recorded for that source and never stops the others."""
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
            continue
        try:
            got = FETCHERS[sid](question, http, subject) if sid == "oewn" else FETCHERS[sid](question, http)
        except FetchMiss:
            got = []
        except Exception as exc:
            per[sid] = {"status": "ERROR", "error": type(exc).__name__ + ": " + str(exc)[:120], "docs": []}
            continue
        amb = [d for d in got if d.get("role") == "ambiguous"]
        src = [d for d in got if d.get("role") == "source"]
        per[sid] = {"status": "AMBIGUOUS" if amb else ("FETCHED" if src else "NO-ENTRY"), "docs": src, "senses": amb[0]["senses"] if amb else None}
        if row.get("agreement_counts") is False:
            per[sid]["counts"] = False
        docs += src
    if rows.get("wikidata", {}).get("enabled") and (not only or "wikidata" in only):
        qid = next((d["how"].get("qid") for d in docs if d.get("source_id") == "oewn"), None) or (subject or {}).get("qid")
        try:
            per["wikidata"] = {"status": "CROSSCHECK", "crosscheck": S.crosscheck(question, http, qid)}
        except Exception as exc:
            per["wikidata"] = {"status": "ERROR", "error": type(exc).__name__ + ": " + str(exc)[:120]}
    return {"question": question, "per_source": per, "documents": docs, "calls_llm": False, "writes": False}
