"""4.9.246 Athena property resolution. No model.

A missing kāraka property (formula, SMILES, mass, height, width, depth, radius, GM) is filled only when two
independent Tier-A publishers agree. Wikipedia is never a publisher. Wikidata is never a publisher. The phone
fetches CORS-open public APIs and hands the raw documents here; CPython may fetch the same URLs for the Home PC
runner and the tests. Admitted rows are on-device clauses. Nothing here writes to Supabase.
"""
from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Callable

SCHEMA = "forge.sim_property/v1"
REL = 0.15  # identical constants (a chemical mass, a body's GM): agree within 15 percent
MASS_REL = 0.005  # chemical masses agree within 0.5 percent (PubChem average vs ChEBI exact)
# Museum specimens of one subtype are not identical constants. Publisher medians may differ by this much
# and still be the same kind (a 110 cm and a 132 cm example of one kind).
ARTIFACT_REL = 0.25
BROAD_SPREAD = 0.45  # a bare noun whose heights scatter more than this is more than one kind
UA = "forge-mobile/4.9.249"
Http = Callable[[str], str]

PUBLISHERS = {
    "pubchem": {"publisher": "NLM", "host": "pubchem.ncbi.nlm.nih.gov", "license": "public-domain",
                "license_url": "https://www.nlm.nih.gov/copyright.html"},
    "chebi": {"publisher": "EMBL-EBI", "host": "www.ebi.ac.uk", "license": "CC BY 4.0",
              "license_url": "https://creativecommons.org/licenses/by/4.0/"},
    "vam": {"publisher": "Victoria and Albert Museum", "host": "api.vam.ac.uk", "license": "CC BY 4.0",
            "license_url": "https://www.vam.ac.uk/info/va-api"},
    "artic": {"publisher": "Art Institute of Chicago", "host": "api.artic.edu", "license": "CC0 1.0",
              "license_url": "https://creativecommons.org/publicdomain/zero/1.0/"},
    "cleveland": {"publisher": "Cleveland Museum of Art", "host": "openaccess-api.clevelandart.org", "license": "CC0 1.0",
                  "license_url": "https://www.clevelandart.org/open-access"},
    "gent": {"publisher": "Design Museum Gent", "host": "data.designmuseumgent.be", "license": "open-data",
             "license_url": "https://data.designmuseumgent.be/v2/"},
    "smg": {"publisher": "Science Museum Group", "host": "collection.sciencemuseumgroup.org.uk",
            "license": "Open Government Licence v3", "license_url": "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"},
    "toolbox": {"publisher": "Engineering Toolbox", "host": "www.engineeringtoolbox.com", "license": "cited-handbook",
                "license_url": "https://www.engineeringtoolbox.com/wood-density-d_40.html"},
    "wooddb": {"publisher": "The Wood Database, citing USDA FPL Wood Handbook", "host": "www.wood-database.com",
               "license": "cited-handbook", "license_url": "https://www.wood-database.com/"},
    "imcce": {"publisher": "IMCCE", "host": "ssp.imcce.fr", "license": "public-research",
              "license_url": "https://ssp.imcce.fr/webservices/ssodnet/"},
    "jpl": {"publisher": "NASA/JPL", "host": "ssd-api.jpl.nasa.gov", "license": "public-domain",
            "license_url": "https://www.jpl.nasa.gov/jpl-image-use-policy", "cors": False},
    "nhtsa": {"publisher": "NHTSA", "host": "vpic.nhtsa.dot.gov", "license": "public-domain",
              "license_url": "https://vpic.nhtsa.dot.gov/api/", "cors": True},
    "epa": {"publisher": "US EPA", "host": "www.fueleconomy.gov", "license": "public-domain",
            "license_url": "https://www.fueleconomy.gov/feg/ws/", "cors": True},
}

BLOCKED_HOSTS = ("wikipedia.org", "wikidata.org", "wikimedia.org")


def _http(url: str, timeout: float = 4.0) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json", "Origin": "https://bogaertn.github.io"})
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.read().decode("utf-8", errors="replace")


def _host(url: str) -> str:
    try:
        return urllib.parse.urlparse(url).hostname or ""
    except Exception:
        return ""


def _blocked(url: str) -> bool:
    h = _host(url)
    return any(h == b or h.endswith("." + b) for b in BLOCKED_HOSTS)


def _pub(sid: str, url: str) -> dict[str, Any]:
    row = dict(PUBLISHERS[sid])
    row.update(id=sid, url=url)
    return row


def _agree_num(a: float, b: float, rel: float) -> bool:
    scale = max(abs(a), abs(b), 1e-12)
    return abs(a - b) / scale <= rel


def _fact(head: str, prop: str, value: Any, unit: str | None, publishers: list[dict[str, Any]]) -> dict[str, Any]:
    hosts = {_host(p.get("url") or "") or p.get("host") for p in publishers}
    return {
        "schema": SCHEMA, "head": head.lower(), "property": prop, "value": value, "unit": unit,
        "publishers": publishers, "hosts": sorted(h for h in hosts if h),
        "calls_llm": False, "supabase_write": False,
    }


def gilligan(facts: list[dict[str, Any]]) -> dict[str, Any]:
    """Two independent non-Wikipedia hosts, or the row is not admitted."""
    ok, held = [], []
    for f in facts:
        pubs = f.get("publishers") or []
        hosts = []
        for p in pubs:
            url = str(p.get("url") or "")
            if _blocked(url):
                continue
            h = _host(url) or str(p.get("host") or "")
            if h and h not in hosts:
                hosts.append(h)
        if len(hosts) >= 2 and len({p.get("publisher") for p in pubs}) >= 2:
            ok.append(f)
        else:
            held.append({"head": f.get("head"), "property": f.get("property"), "reason": "two_publishers_required", "hosts": hosts})
    return {"ok": ok, "held": held, "calls_llm": False, "supabase_write": False}


# ---------------------------------------------------------------- chemistry: PubChem (NLM) and ChEBI (EMBL-EBI)

def pubchem_url(name: str) -> str:
    q = urllib.parse.quote(name)
    return ("https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/" + q
            + "/property/MolecularFormula,MolecularWeight,InChIKey,IsomericSMILES/JSON")


def chebi_search_url(name: str) -> str:
    return "https://www.ebi.ac.uk/ols4/api/search?ontology=chebi&exact=true&q=" + urllib.parse.quote(name)


def chebi_term_url(obo: str) -> str:
    return "https://www.ebi.ac.uk/ols4/api/ontologies/chebi/terms?obo_id=" + urllib.parse.quote(obo)


def parse_pubchem(name: str, raw: str) -> dict[str, Any] | None:
    try:
        props = ((json.loads(raw).get("PropertyTable") or {}).get("Properties") or [None])[0]
    except Exception:
        return None
    if not isinstance(props, dict) or not props.get("MolecularFormula"):
        return None
    cid = props.get("CID")
    url = f"https://pubchem.ncbi.nlm.nih.gov/compound/{cid}" if cid else pubchem_url(name)
    return {"formula": str(props["MolecularFormula"]), "mass": float(props["MolecularWeight"]),
            "inchikey": props.get("InChIKey"),
            "smiles": props.get("IsomericSMILES") or props.get("CanonicalSMILES") or props.get("ConnectivitySMILES") or props.get("SMILES"),
            "url": url}


def parse_chebi_search(raw: str) -> str | None:
    try:
        docs = ((json.loads(raw).get("response") or {}).get("docs") or [])
    except Exception:
        return None
    for d in docs:
        obo = str(d.get("obo_id") or "")
        if obo.startswith("CHEBI:") and d.get("label"):
            return obo
    return None


def parse_chebi_term(raw: str) -> dict[str, Any] | None:
    try:
        terms = ((json.loads(raw).get("_embedded") or {}).get("terms") or [])
    except Exception:
        return None
    if not terms:
        return None
    ann = terms[0].get("annotation") or {}
    formula = (ann.get("generalized_empirical_formula") or [None])[0]
    mass = (ann.get("mass") or [None])[0]
    if not formula or mass is None:
        return None
    obo = terms[0].get("obo_id") or ""
    return {"formula": str(formula), "mass": float(mass), "inchikey": (ann.get("inchi_key_string") or [None])[0],
            "smiles": (ann.get("smiles_string") or [None])[0],
            "url": "https://www.ebi.ac.uk/chebi/searchId.do?chebiId=" + str(obo)}


def chemical_decision(name: str, pub: dict[str, Any] | None, che: dict[str, Any] | None, err_p: str | None = None, err_c: str | None = None) -> dict[str, Any]:
    """One decision for a fetched pair: missing, disagreement, or two-publisher agreement."""
    if not pub or not che:
        return {"ok": [], "held": [{"head": name.lower(), "property": "formula", "reason": "publisher_missing",
                                    "pubchem": bool(pub), "chebi": bool(che), "errors": [err_p, err_c]}],
                "calls_llm": False, "supabase_write": False}
    if str(pub.get("formula")) != str(che.get("formula")) or (
            pub.get("mass") is not None and che.get("mass") is not None and not _agree_num(float(pub["mass"]), float(che["mass"]), MASS_REL)):
        return {"ok": [], "held": [{"head": name.lower(), "property": "formula", "reason": "publishers_disagree",
                                    "pubchem": pub.get("formula"), "chebi": che.get("formula")}],
                "calls_llm": False, "supabase_write": False}
    return gilligan(agree_chemical(name, pub, che))


def agree_chemical(name: str, pub: dict[str, Any], che: dict[str, Any]) -> list[dict[str, Any]]:
    if str(pub.get("formula")) != str(che.get("formula")):
        return []
    if not _agree_num(float(pub["mass"]), float(che["mass"]), MASS_REL):
        return []
    if pub.get("inchikey") and che.get("inchikey") and pub["inchikey"] != che["inchikey"]:
        return []
    pubs = [_pub("pubchem", pub["url"]), _pub("chebi", che["url"])]
    head = name.lower()
    rows = [
        _fact(head, "formula", pub["formula"], None, pubs),
        _fact(head, "mass_da", round((float(pub["mass"]) + float(che["mass"])) / 2.0, 4), "Da", pubs),
    ]
    smiles = pub.get("smiles") or che.get("smiles")
    if smiles:
        rows.append(_fact(head, "smiles", smiles, None, pubs))
    return rows


def fetch_chemical(name: str, http: Http = _http) -> dict[str, Any]:
    """Live PubChem + ChEBI. Returns gilligan() on the agreed rows, or a hold naming the gap."""
    try:
        pub = parse_pubchem(name, http(pubchem_url(name)))
    except Exception as e:
        pub = None
        err_p = str(e)[:160]
    else:
        err_p = None
    che = None
    err_c = None
    try:
        obo = parse_chebi_search(http(chebi_search_url(name)))
        if obo:
            che = parse_chebi_term(http(chebi_term_url(obo)))
    except Exception as e:
        err_c = str(e)[:160]
    return chemical_decision(name, pub, che, err_p, err_c)


# ---------------------------------------------------------------- physical objects: two museums, measured records only

_SKIP = re.compile(r"\b(design|drawing|sketch|miniature|portrait|painting|print|photograph|study)\b", re.I)


def _cm(value: float, unit: str) -> float | None:
    u = (unit or "").lower()
    if u in ("cm", "centimeter", "centimeters"):
        return value / 100.0
    if u in ("mm", "millimeter", "millimeters"):
        return value / 1000.0
    if u in ("m", "meter", "meters", "metre", "metres"):
        return value
    if u in ("in", "inch", "inches"):
        return value * 0.0254
    if u in ("kg", "kilogram", "kilograms"):
        return value
    return None


def _median(xs: list[float]) -> float | None:
    if not xs:
        return None
    ys = sorted(xs)
    n = len(ys)
    return ys[n // 2] if n % 2 else (ys[n // 2 - 1] + ys[n // 2]) / 2.0


def museum_measures(records: list[dict[str, Any]], head: str) -> dict[str, float]:
    """Median height/width/depth/mass in metres and kilograms. Records whose title is a picture of the thing are dropped.
    `head` is the patient's head noun from the kāraka frame. No noun is special-cased."""
    want = head.lower()
    buckets: dict[str, list[float]] = {"height": [], "width": [], "depth": [], "mass": []}
    for rec in records:
        title = " ".join(str(rec.get(k) or "") for k in ("title", "objectType", "classification"))
        if want not in title.lower() or _SKIP.search(title):
            continue
        dims = rec.get("dimensions") or []
        if isinstance(dims, str):
            continue
        for d in dims:
            if not isinstance(d, dict):
                continue
            part = str(d.get("part") or "").lower()
            if part and part not in ("", "overall", "object"):
                continue
            name = str(d.get("dimension") or d.get("type") or "").lower()
            try:
                val = float(d.get("value"))
            except (TypeError, ValueError):
                continue
            unit = str(d.get("unit") or "")
            metres = _cm(val, unit)
            if metres is None:
                continue
            if name in ("height", "h", "højde") and unit.lower() not in ("kg", "kilogram", "kilograms"):
                buckets["height"].append(metres)
            elif name in ("width", "w", "bredde") and unit.lower() not in ("kg",):
                buckets["width"].append(metres)
            elif name in ("depth", "d", "dybde") and unit.lower() not in ("kg",):
                buckets["depth"].append(metres)
            elif name in ("weight", "mass") or unit.lower() in ("kg", "kilogram", "kilograms"):
                buckets["mass"].append(val if unit.lower() in ("kg", "kilogram", "kilograms") else metres)
    return {k: v for k, v in ((_k, _median(_v)) for _k, _v in buckets.items()) if v is not None}


def agree_objects(head: str, sides: list[tuple[str, str, dict[str, float]]], rel: float = REL) -> list[dict[str, Any]]:
    """sides: (publisher id, url, measures). A quantity is kept when at least two publishers measured it and they agree."""
    by_prop: dict[str, list[tuple[str, str, float]]] = {}
    for sid, url, measures in sides:
        for prop, val in measures.items():
            by_prop.setdefault(prop, []).append((sid, url, val))
    rows = []
    for prop, vals in by_prop.items():
        if len(vals) < 2:
            continue
        nums = [v for _, _, v in vals]
        if max(nums) <= 0 or not all(_agree_num(nums[0], n, rel) for n in nums[1:]):
            continue
        mean = sum(nums) / len(nums)
        pubs = [_pub(sid, url) for sid, url, _ in vals]
        unit = "kg" if prop == "mass" else "m"
        rows.append(_fact(head, prop, round(mean, 4), unit, pubs))
    return rows


def _content_words(phrase: str) -> list[str]:
    stop = {"a", "an", "the", "of", "and", "or"}
    return [w for w in re.findall(r"[a-z0-9]+", phrase.lower()) if w not in stop and len(w) > 1]


def _blob(rec: dict[str, Any]) -> str:
    return " ".join(str(rec.get(k) or "") for k in ("title", "objectType", "classification", "description")).lower()


def _num_text(value: Any) -> float | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    s = str(value or "").strip()
    m = re.fullmatch(r"(\d+)\s+(\d+)\s*/\s*(\d+)", s)
    if m:
        return float(m.group(1)) + float(m.group(2)) / float(m.group(3))
    m = re.fullmatch(r"(\d+)\s*/\s*(\d+)", s)
    if m:
        return float(m.group(1)) / float(m.group(2))
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def _from_dim_text(text: str) -> dict[str, float]:
    """Prose dimensions. A frame, plate, or sheet size is not the object."""
    out: dict[str, float] = {}
    for part in re.split(r"[;\n]", str(text or "")):
        if re.search(r"\b(framed|image|plate|sheet|mount|diam)\b", part, re.I):
            continue
        labeled = False
        for m in re.finditer(r"\b(height|width|depth|h|w|d)\.?\s*:?\s*(\d+(?:\.\d+)?)\s*cm\b", part, re.I):
            key = {"h": "height", "w": "width", "d": "depth"}.get(m.group(1).lower()[:1], "")
            if key:
                out.setdefault(key, float(m.group(2)) / 100.0)
                labeled = True
        if labeled:
            continue
        m = re.search(r"(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)(?:\s*[×x]\s*(\d+(?:\.\d+)?))?\s*cm", part, re.I)
        if not m:
            continue
        out.setdefault("height", float(m.group(1)) / 100.0)
        out.setdefault("width", float(m.group(2)) / 100.0)
        if m.group(3):
            out.setdefault("depth", float(m.group(3)) / 100.0)
    return out


# Densities live in physical_defaults.json with two handbook figures and a class
# (wood, metal, bulk, soft). A pair is used only when the two figures agree within REL.
_WORD_ALIAS = {
    "wooden": "oak", "wood": "oak", "timber": "oak",
    "aluminium": "aluminum", "aluminum": "aluminum",
    "plastic": "polyethylene", "polymer": "polyethylene", "polyethylene": "polyethylene",
    "saltwater": "seawater", "brine": "seawater",
}


def _material_table() -> dict[str, Any]:
    from rmc_engine_v1.sim_scene import defaults
    return (defaults().get("materials") or {})


def _material_rows() -> dict[str, dict[str, Any]]:
    return dict((_material_table().get("rows") or {}))
# Board thickness is physical_defaults.materials.board_m (18 mm and 19.05 mm).


def _one_record(rec: dict[str, Any]) -> dict[str, float]:
    """Overall height, width, depth (m) and mass (kg). A leg or a crate is skipped; closed/overall counts."""
    out: dict[str, float] = {}
    dims = rec.get("dimensions") or []
    if isinstance(dims, str):
        out.update(_from_dim_text(dims))
        dims = []
    whole = {"", "overall", "object", "closed"}
    for d in dims:
        if not isinstance(d, dict):
            continue
        part = str(d.get("part") or "").lower()
        if part and part not in whole:
            continue
        name = str(d.get("dimension") or d.get("type") or "").lower()
        val = _num_text(d.get("value"))
        if val is None:
            continue
        unit = str(d.get("unit") or "")
        metres = _cm(val, unit)
        if metres is None:
            continue
        if name in ("height", "h", "hoogte") and unit.lower() not in ("kg", "kilogram", "kilograms", "lb", "lbs"):
            out.setdefault("height", metres)
        elif name in ("width", "w", "breedde") and unit.lower() not in ("kg", "kilogram", "kilograms"):
            out.setdefault("width", metres)
        elif name in ("depth", "d", "diepte") and unit.lower() not in ("kg", "kilogram", "kilograms"):
            out.setdefault("depth", metres)
        elif name in ("weight", "mass", "gewicht") or unit.lower() in ("kg", "kilogram", "kilograms"):
            if unit.lower() in ("kg", "kilogram", "kilograms") and val > 0:
                out.setdefault("mass", val)
    for k, v in _from_dim_text(str(rec.get("dimension_text") or "")).items():
        out.setdefault(k, v)
    return out


def _species(blob: str) -> list[str]:
    """Material keys named in a record. Longer names win ('cast iron' before 'iron')."""
    rows = _material_rows()
    found: list[str] = []
    text = blob.lower()
    names = sorted(set(list(rows) + list(_WORD_ALIAS)), key=len, reverse=True)
    for word in names:
        if re.search(r"\b" + re.escape(word) + r"\b", text):
            key = _WORD_ALIAS.get(word, word)
            if key in rows and key not in found:
                found.append(key)
    return found


def _density_of(key: str) -> float | None:
    row = _material_rows().get(key) or {}
    pair = row.get("rho") or []
    if len(pair) != 2 or not _agree_num(float(pair[0]), float(pair[1]), REL):
        return None
    return (float(pair[0]) + float(pair[1])) / 2.0


def _board_m() -> float:
    pair = (_material_table().get("board_m") or [0.018, 0.01905])
    return (float(pair[0]) + float(pair[1])) / 2.0


def _class_of(key: str) -> str:
    return str((_material_rows().get(key) or {}).get("class") or "")


def _shell_mass(measures: dict[str, float], density: float, board: float | None = None) -> float | None:
    """Hollow carcass: surface area times agreed board thickness times density."""
    h, w, d = measures.get("height"), measures.get("width"), measures.get("depth")
    if not h or not w or not d or h <= 0 or w <= 0 or d <= 0 or density <= 0:
        return None
    area = 2.0 * (h * w + h * d + w * d)
    return area * (board if board is not None else _board_m()) * density


def _mass_from_materials(measures: dict[str, float], keys: list[str]) -> float | None:
    """Wood shell, plus a metal frame when the record names a metal, else a bulk volume.
    Fabric and any pair whose handbooks disagree are left out."""
    woods = [k for k in keys if _class_of(k) == "wood" and _density_of(k)]
    metals = [k for k in keys if _class_of(k) == "metal" and _density_of(k)]
    bulks = [k for k in keys if _class_of(k) in ("bulk", "soft") and _density_of(k)]
    h, w, d = measures.get("height"), measures.get("width"), measures.get("depth")
    board = _board_m()
    wood_rho = (sum(_density_of(k) or 0 for k in woods) / len(woods)) if woods else None
    metal_rho = (sum(_density_of(k) or 0 for k in metals) / len(metals)) if metals else None
    if wood_rho and h and w and d:
        shell = _shell_mass(measures, wood_rho, board) or 0.0
        if metal_rho:
            # Four corner posts of square board section, plus one face plate of board thickness.
            posts = 4.0 * float(h) * board * board * metal_rho
            plate = float(h) * float(w) * board * metal_rho
            return shell + posts + plate
        return shell
    if metal_rho and not wood_rho:
        return _shell_mass(measures, metal_rho, board)
    if bulks and h and w and d and not woods and not metals:
        rho = sum(_density_of(k) or 0 for k in bulks) / len(bulks)
        return float(h) * float(w) * float(d) * rho
    return None


def _spread(xs: list[float]) -> float | None:
    if len(xs) < 2:
        return None
    med = _median(xs)
    if not med:
        return None
    return (max(xs) - min(xs)) / med


def resolve_objects(phrase: str, sides: list[dict[str, Any]], head: str | None = None, specific: bool = False) -> dict[str, Any]:
    """Full noun phrase, not a stripped head. A bare noun whose heights scatter is underspecified.
    A specific phrase keeps the publisher medians when they lie within ARTIFACT_REL, and a missing mass
    is the wood shell of the agreed box when two handbooks agree on the named wood.
    """
    words = _content_words(phrase)
    label = (head or " ".join(words) or phrase).strip().lower()
    empty = {"ok": [], "ask": False, "held": [{"head": label, "property": "dimensions", "reason": "two_publishers_required"}],
             "calls_llm": False, "supabase_write": False}
    if not words:
        return empty
    per: list[tuple[str, str, list[dict[str, Any]]]] = []
    heights: list[float] = []
    for side in sides:
        if not isinstance(side, dict):
            continue
        matched = []
        for rec in side.get("records") or []:
            if not isinstance(rec, dict):
                continue
            # A picture is named in the title. A real object's description may mention a drawing of it.
            if _SKIP.search((str(rec.get("title") or "") + " " + str(rec.get("objectType") or "")).lower()):
                continue
            blob = (_blob(rec) + " " + " ".join(str(x) for x in (rec.get("materials") or []))).lower()
            if any(w not in blob for w in words):
                continue
            one = _one_record(rec)
            if not one:
                continue
            one["species"] = _species(blob)
            matched.append(one)
            if "height" in one:
                heights.append(one["height"])
        if matched:
            per.append((str(side.get("id") or ""), str(side.get("url") or ""), matched))
    spread = _spread(heights)
    if not specific and len(words) == 1 and spread is not None and spread > BROAD_SPREAD:
        return {"ok": [], "ask": True, "word": words[0], "spread": round(spread, 4),
                "held": [{"head": label, "property": "kind", "reason": "underspecified", "spread": round(spread, 4)}],
                "calls_llm": False, "supabase_write": False}
    # A search also returns parts and pictures. Keep the cluster of full-size specimens:
    # the agreeing group whose heights are the larger ones, not a handful of mechanisms.
    sized = [(sid, url, m) for sid, url, matched in per for m in matched if isinstance(m.get("height"), (int, float))]
    if len(sized) >= 2:
        best: list[tuple[str, str, dict[str, Any]]] = []
        best_key: tuple[int, float] = (0, 0.0)
        for _, _, pivot in sized:
            group = [row for row in sized if _agree_num(row[2]["height"], pivot["height"], 0.35)]
            pubs = len({row[0] for row in group})
            if pubs < 2:
                continue
            key = (pubs, _median([row[2]["height"] for row in group]) or 0.0)
            if key > best_key:
                best, best_key = group, key
        if best:
            grouped: dict[tuple[str, str], list[dict[str, Any]]] = {}
            for sid, url, m in best:
                grouped.setdefault((sid, url), []).append(m)
            per = [(sid, url, ms) for (sid, url), ms in grouped.items()]
    medians: list[tuple[str, str, dict[str, float]]] = []
    species_all: list[str] = []
    for sid, url, matched in per:
        med: dict[str, float] = {}
        for prop in ("height", "width", "depth", "mass"):
            xs = [m[prop] for m in matched if isinstance(m.get(prop), (int, float))]
            got = _median(xs)
            if got is not None:
                med[prop] = got
        for m in matched:
            for s in m.get("species") or []:
                if s not in species_all:
                    species_all.append(s)
        if med:
            medians.append((sid, url, med))
    rows = agree_objects(label, medians, ARTIFACT_REL) if len(medians) >= 2 else []
    spoken = " ".join(words)
    if rows and not any(r["property"] == "mass" for r in rows):
        by = {r["property"]: r for r in rows}
        geom = {k: by[k]["value"] for k in ("height", "width", "depth") if k in by}
        # A shell mass needs a depth that two publishers already agreed. One publisher's depth is not copied across.
        mass = _mass_from_materials(geom, species_all) if "depth" in by and "height" in by and "width" in by else None
        if mass and mass > 0:
            pubs: list[dict[str, Any]] = []
            seen: set[tuple[Any, Any]] = set()
            for prop in ("height", "width", "depth"):
                for p in by[prop]["publishers"]:
                    ident = (p.get("id"), p.get("url"))
                    if ident in seen:
                        continue
                    seen.add(ident)
                    pubs.append(p)
            pubs.append(_pub("toolbox", PUBLISHERS["toolbox"]["license_url"]))
            pubs.append(_pub("wooddb", PUBLISHERS["wooddb"]["license_url"]))
            rows.append(_fact(label, "mass", round(mass, 1), "kg", pubs))
    for row in rows:
        row["average"] = True
        row["phrase"] = spoken
        row["head"] = label
    if not rows or not any(r["property"] == "mass" for r in rows) or not any(r["property"] == "height" for r in rows):
        return empty
    packed = gilligan(rows)
    packed["ask"] = False
    packed["word"] = spoken
    return packed


def fetch_objects(head: str, http: Http = _http) -> dict[str, Any]:
    q = urllib.parse.quote(head)
    sides: list[tuple[str, str, dict[str, float]]] = []
    vam_url = f"https://api.vam.ac.uk/v2/objects/search?q={q}&page_size=8"
    try:
        search = json.loads(http(vam_url))
        recs = []
        for hit in (search.get("records") or [])[:6]:
            sysn = hit.get("systemNumber")
            if not sysn:
                continue
            obj = json.loads(http(f"https://api.vam.ac.uk/v2/object/{urllib.parse.quote(str(sysn))}"))
            rec = obj.get("record") or {}
            dims = []
            for d in rec.get("dimensions") or []:
                if str(d.get("part") or "").lower() in ("crate",):
                    continue
                dims.append({"dimension": d.get("dimension"), "value": d.get("value"), "unit": d.get("unit"), "part": d.get("part") or ""})
            recs.append({"title": rec.get("_primaryTitle") or hit.get("_primaryTitle") or "",
                         "objectType": rec.get("objectType") or hit.get("objectType") or "",
                         "dimensions": dims})
        got = museum_measures(recs, head)
        if got:
            sides.append(("vam", vam_url, got))
    except Exception:
        pass
    artic_url = ("https://api.artic.edu/api/v1/artworks/search?q=" + q
                 + "&limit=20&fields=id,title,dimensions,classification_title,artwork_type_title")
    try:
        data = json.loads(http(artic_url)).get("data") or []
        recs = []
        for a in data:
            text = str(a.get("dimensions") or "")
            # "128.9 × 143.2 cm" or "H. 50 cm"
            nums = re.findall(r"(\d+(?:\.\d+)?)\s*(?:×|x)?\s*(?:cm|mm)?", text)
            # Prefer explicit centimetre pairs in the first measurement clause.
            cm = re.findall(r"(\d+(?:\.\d+)?)\s*×\s*(\d+(?:\.\d+)?)(?:\s*×\s*(\d+(?:\.\d+)?))?\s*cm", text)
            dims = []
            if cm:
                h, w, d = cm[0]
                dims.append({"dimension": "Height", "value": h, "unit": "cm", "part": ""})
                dims.append({"dimension": "Width", "value": w, "unit": "cm", "part": ""})
                if d:
                    dims.append({"dimension": "Depth", "value": d, "unit": "cm", "part": ""})
            elif nums:
                continue
            recs.append({"title": a.get("title") or "", "objectType": a.get("classification_title") or "",
                         "classification": a.get("artwork_type_title") or "", "dimensions": dims})
        got = museum_measures(recs, head)
        if got:
            sides.append(("artic", artic_url, got))
    except Exception:
        pass
    if len(sides) < 2:
        return {"ok": [], "held": [{"head": head.lower(), "property": "dimensions", "reason": "two_publishers_required",
                                    "publishers": [s[0] for s in sides]}], "calls_llm": False, "supabase_write": False}
    return gilligan(agree_objects(head, sides))


# ---------------------------------------------------------------- celestial body: IMCCE ssoCard and NASA/JPL SBDB (asteroids / dwarf planets)

def parse_ssocard(raw: str, url: str) -> dict[str, Any] | None:
    """Radius and mass from an IMCCE ssoCard, when that card publishes both."""
    try:
        card = json.loads(raw)
    except Exception:
        return None
    phys = ((card.get("parameters") or {}).get("physical") or {})
    diam = (phys.get("diameter") or {}).get("value")
    mass = (phys.get("mass") or {}).get("value")
    if not diam or not mass:
        return None
    return {"radius_m": float(diam) * 500.0, "mass_kg": float(mass), "url": url,
            "type": str(card.get("type") or ""), "name": str(card.get("name") or "")}


def parse_quaero_sso(raw: str) -> dict[str, Any] | None:
    """Identity only. Quaero names a satellite; it does not publish mass or radius."""
    try:
        data = json.loads(raw)
    except Exception:
        return None
    rows = data.get("data") if isinstance(data, dict) else None
    if isinstance(data, dict) and data.get("type"):
        rows = [data]
    if not rows:
        return None
    row = rows[0]
    return {"id": row.get("id"), "name": row.get("name"), "type": row.get("type"),
            "has_mass": False, "has_radius": False}


def agree_body(name: str, sides: list[dict[str, Any]]) -> dict[str, Any]:
    """sides: publisher rows with radius_m and mass_kg. Two different non-blocked hosts, or hold."""
    usable = []
    for side in sides:
        if not isinstance(side, dict) or side.get("radius_m") is None or side.get("mass_kg") is None:
            continue
        url = str(side.get("url") or "")
        if _blocked(url):
            continue
        usable.append(side)
    hosts = []
    for side in usable:
        h = _host(str(side.get("url") or "")) or str(side.get("host") or "")
        if h and h not in hosts:
            hosts.append(h)
    if len(hosts) < 2:
        return {"ok": [], "held": [{"head": name.lower(), "property": "radius", "reason": "two_publishers_required",
                                    "hosts": hosts, "cors_note": "a catalog counts only when the phone can read it"}],
                "calls_llm": False, "supabase_write": False}
    radii = [float(s["radius_m"]) for s in usable]
    masses = [float(s["mass_kg"]) for s in usable]
    if not all(_agree_num(radii[0], r, REL) for r in radii[1:]) or not all(_agree_num(masses[0], m, REL) for m in masses[1:]):
        return {"ok": [], "held": [{"head": name.lower(), "property": "radius", "reason": "publishers_disagree"}],
                "calls_llm": False, "supabase_write": False}
    pubs = [_pub(str(s.get("id") or "imcce"), str(s["url"])) for s in usable[:2]]
    radius = sum(radii) / len(radii)
    mass = sum(masses) / len(masses)
    gm = 6.67430e-11 * mass
    head = name.lower()
    return gilligan([
        _fact(head, "radius", round(radius, 1), "m", pubs),
        _fact(head, "mass", mass, "kg", pubs),
        _fact(head, "gm", gm, "m3/s2", pubs),
    ])


def fetch_body(name: str, http: Http = _http) -> dict[str, Any]:
    """Radius and GM only from two CORS-readable catalogs that both publish them.

    IMCCE ssoCard sends Access-Control-Allow-Origin: * and publishes diameter and mass for
    many small bodies. A planetary-satellite name often 404s there, and a shared name can
    resolve to an asteroid instead of the moon. SsODNet Quaero (also CORS *) can identify
    a satellite and does not publish mass or radius. NASA/JPL SBDB JSON sends no
    Access-Control-Allow-Origin, so the phone cannot use it. One catalog is not agreement.
    """
    card_url = "https://ssp.imcce.fr/webservices/ssodnet/api/ssocard/" + urllib.parse.quote(name)
    quaero_url = "https://api.ssodnet.imcce.fr/quaero/1/sso?q=" + urllib.parse.quote(name) + "&type=Satellite&limit=1"
    imcce = None
    try:
        imcce = parse_ssocard(http(card_url), card_url)
    except Exception:
        imcce = None
    quaero = None
    try:
        quaero = parse_quaero_sso(http(quaero_url))
    except Exception:
        quaero = None
    if imcce and quaero and str(quaero.get("type") or "").lower() == "satellite" and str(imcce.get("type") or "").lower() != "satellite":
        # The card is a different body that shares the name (an asteroid, not the moon).
        imcce = None
    sides = []
    if imcce:
        sides.append({"id": "imcce", "url": imcce["url"], "radius_m": imcce["radius_m"], "mass_kg": imcce["mass_kg"]})
    # Quaero identifies; it does not add a radius. JPL is not readable on the phone.
    agreed = agree_body(name, sides)
    if not agreed.get("ok"):
        agreed["held"] = agreed.get("held") or []
        if agreed["held"]:
            agreed["held"][0]["imcce_numbers"] = bool(imcce)
            agreed["held"][0]["quaero_type"] = (quaero or {}).get("type")
            agreed["held"][0]["jpl_cors"] = False
    return agreed


def parse_nhtsa_specs(raw: str) -> dict[str, float]:
    """Canadian vehicle specifications as NHTSA vPIC publishes them (cm and kg)."""
    try:
        data = json.loads(raw)
    except Exception:
        return {}
    rows = data.get("Results") or data.get("results") or []
    buckets: dict[str, list[float]] = {"height": [], "width": [], "depth": [], "mass": []}
    for rec in rows:
        specs = rec.get("Specs") if isinstance(rec, dict) else None
        if not isinstance(specs, list):
            continue
        got = {}
        for item in specs:
            if not isinstance(item, dict):
                continue
            name = str(item.get("Name") or "")
            try:
                val = float(item.get("Value"))
            except (TypeError, ValueError):
                continue
            got[name] = val
        # OL overall length, OW width, OH height, in centimetres; CW curb weight in kilograms.
        if "OH" in got:
            buckets["height"].append(got["OH"] / 100.0)
        if "OW" in got:
            buckets["width"].append(got["OW"] / 100.0)
        if "OL" in got:
            buckets["depth"].append(got["OL"] / 100.0)
        if "CW" in got and got["CW"] > 0:
            buckets["mass"].append(got["CW"])
    return {k: v for k, v in ((key, _median(xs)) for key, xs in buckets.items()) if v}


def parse_epa_vehicle(raw: str) -> dict[str, Any]:
    """FuelEconomy.gov vehicle record. It publishes a size class. Dimensions are kept only if present."""
    try:
        data = json.loads(raw)
    except Exception:
        return {}
    if not isinstance(data, dict):
        return {}
    out: dict[str, Any] = {}
    if data.get("VClass"):
        out["vclass"] = str(data["VClass"])
    for src, dest, scale in (("height", "height", 1.0), ("width", "width", 1.0), ("length", "depth", 1.0), ("curbWeight", "mass", 1.0)):
        if data.get(src) not in (None, ""):
            try:
                out[dest] = float(data[src]) * scale
            except (TypeError, ValueError):
                pass
    return out


def agree_vehicle(head: str, nhtsa: dict[str, float], epa: dict[str, Any], nhtsa_url: str, epa_url: str) -> dict[str, Any]:
    """A number is admitted only when both government hosts publish it and they agree.
    FuelEconomy.gov currently publishes the size class and not the curb weight, so a class
    word with no shared number holds."""
    pubs = [_pub("nhtsa", nhtsa_url), _pub("epa", epa_url)]
    rows = []
    for prop in ("height", "width", "depth", "mass"):
        if prop not in nhtsa or prop not in epa:
            continue
        if not _agree_num(float(nhtsa[prop]), float(epa[prop]), ARTIFACT_REL):
            continue
        mean = (float(nhtsa[prop]) + float(epa[prop])) / 2.0
        rows.append(_fact(head, prop, round(mean, 4), "kg" if prop == "mass" else "m", pubs))
    if not rows or not any(r["property"] == "mass" for r in rows):
        return {"ok": [], "ask": False, "held": [{"head": head.lower(), "property": "mass", "reason": "two_publishers_required",
                                                  "nhtsa": sorted(nhtsa), "epa": sorted(k for k in epa if k != "vclass"),
                                                  "vclass": epa.get("vclass")}],
                "calls_llm": False, "supabase_write": False}
    for row in rows:
        row["average"] = True
        row["phrase"] = head
    packed = gilligan(rows)
    packed["ask"] = False
    return packed


def vehicle_concept(head: str) -> bool:
    """True when the lexicon already maps this head to the vehicle concept. No noun list is added here."""
    try:
        table = json.loads((Path(__file__).with_name("concept_lexicon.json")).read_text(encoding="utf-8"))
    except Exception:
        return False
    return str(table.get(str(head or "").lower()) or "") == "N.CAR"


def lineage_of(publisher: dict[str, Any]) -> str:
    """One origin is one lineage. A mirror host of the same publisher does not count twice."""
    pid = str(publisher.get("id") or "").strip().lower()
    if pid:
        return pid
    host = str(publisher.get("host") or _host(str(publisher.get("url") or ""))).lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def independent_lineages(fact: dict[str, Any]) -> list[str]:
    found: list[str] = []
    for raw in fact.get("publishers") or []:
        if not isinstance(raw, dict):
            continue
        url = str(raw.get("url") or "")
        if _blocked(url) or _blocked("https://" + str(raw.get("host") or "")):
            continue
        if str(raw.get("id") or "") in ("wikipedia", "wikidata"):
            continue
        lin = lineage_of(raw)
        if lin and lin not in found:
            found.append(lin)
    return found


def note_sources(ledger: dict[str, Any] | None, facts: list[dict[str, Any]], *, disagreed: bool = False) -> dict[str, Any]:
    """Persisted trust counts. A new source rises only by agreeing with a different lineage."""
    book = dict(ledger or {})
    rows = dict(book.get("sources") or {})
    for fact in facts:
        lins = independent_lineages(fact)
        for raw in fact.get("publishers") or []:
            if not isinstance(raw, dict):
                continue
            lin = lineage_of(raw)
            if not lin or lin in ("wikipedia", "wikidata"):
                continue
            row = dict(rows.get(lin) or {"lineage": lin, "agrees": 0, "conflicts": 0, "trusted": False})
            if disagreed:
                row["conflicts"] = int(row.get("conflicts") or 0) + 1
            elif len(lins) >= 2:
                row["agrees"] = int(row.get("agrees") or 0) + 1
                others = [x for x in lins if x != lin]
                if others and any((rows.get(o) or {}).get("trusted") or int((rows.get(o) or {}).get("agrees") or 0) >= 1 for o in others):
                    row["trusted"] = True
                if row["agrees"] >= 1 and len(lins) >= 2:
                    row["trusted"] = True
            rows[lin] = row
    book["sources"] = rows
    book["calls_llm"] = False
    book["supabase_write"] = False
    return book


def record_outcome(ledger: dict[str, Any] | None, method: str, rule: str, facts: list[dict[str, Any]] | None = None, *, disagreed: bool = False) -> dict[str, Any]:
    """The source ledger and the method counts, from one outcome."""
    book = note_sources(ledger, facts or [], disagreed=disagreed)
    methods = dict(book.get("methods") or {})
    row = dict(methods.get(method) or {"method": method, "proposed": 0, "rejected": 0, "simulated": 0})
    if rule == "ATHENA-PROPOSED":
        row["proposed"] = int(row.get("proposed") or 0) + 1
    elif rule == "ATHENA-SIMULATED":
        row["simulated"] = int(row.get("simulated") or 0) + 1
    else:
        row["rejected"] = int(row.get("rejected") or 0) + 1
    methods[method] = row
    book["methods"] = methods
    return book


def propose_rows(facts: list[dict[str, Any]], question: str = "") -> dict[str, Any]:
    """A structured proposal. The clause is the atom's fields, not a sentence that is parsed back."""
    proposals, rejected = [], []
    for fact in facts:
        if not isinstance(fact, dict):
            continue
        lins = independent_lineages(fact)
        atom = {"predicate": fact.get("property"), "args": [fact.get("head"), fact.get("value")], "polarity": "pos", "unit": fact.get("unit")}
        clause = {"property": fact.get("property"), "head": fact.get("head"), "value": fact.get("value"), "unit": fact.get("unit")}
        if len(lins) < 2 or clause["value"] != atom["args"][1] or clause["head"] != atom["args"][0]:
            rejected.append({"head": fact.get("head"), "property": fact.get("property"), "rule": "GILLIGAN-LINEAGE", "lineages": lins})
            continue
        prop, head, value = fact.get("property"), fact.get("head"), fact.get("value")
        shown = str(value) + ((" " + str(fact.get("unit"))) if fact.get("unit") else "")
        frame = {"kriya": "be", "polarity": "pos",
                 "kartr": {"text": "the " + str(prop) + " of " + str(head), "head": str(prop), "det": "the",
                           "of": {"text": str(head), "head": str(head)}},
                 "pred": {"type": "np", "text": shown, "head": str(value)}}
        proposals.append({
            "schema": SCHEMA, "head": head, "property": prop, "value": value,
            "unit": fact.get("unit"), "hosts": fact.get("hosts") or [], "publishers": fact.get("publishers") or [],
            "lineages": lins, "k": len(lins), "atom": atom, "clause": clause, "frame": frame, "question": question,
            "admitted": False, "phone_remember": False, "supabase_write": False, "calls_llm": False,
            "store": "proposal", "method": "lookup", "gilligan": "GILLIGAN-STRUCTURE-OK",
        })
    return {"proposals": proposals, "rejected": rejected, "calls_llm": False, "supabase_write": False}


def _personal(question: str) -> bool:
    return bool(re.search(r"\b(my|our)\b", str(question or ""), re.I))


def fill_gap(gap: dict[str, Any], http: Http = _http, ledger: dict[str, Any] | None = None) -> dict[str, Any]:
    """One generic step. Lookup, on-device simulate, or neither. Nothing is written."""
    gap = gap if isinstance(gap, dict) else {}
    question = str(gap.get("question") or "")
    sim = gap.get("sim") if isinstance(gap.get("sim"), dict) else {}
    frame = gap.get("qframe") if isinstance(gap.get("qframe"), dict) else None
    base = {"calls_llm": False, "supabase_write": False, "phone_remember": False, "question": question}
    if _personal(question):
        return {**base, "ok": [], "proposals": [], "rule": "ATHENA-PERSONAL", "ledger": ledger or {}}
    from rmc_engine_v1.sim_device import plan, tip_check
    if frame or not sim.get("reason"):
        planned = plan(question, frame)
    else:
        planned = {"ok": False, "reason": sim.get("reason"), "substance": sim.get("substance"), "body": sim.get("body")}
    if planned.get("ok") and planned.get("solver") in ("mujoco_wasm", "sympy_pyodide"):
        scene = planned.get("scene") if isinstance(planned.get("scene"), dict) else {}
        chk = tip_check(scene) if scene.get("action") == "push" else None
        return {**base, "ok": [], "proposals": [], "method": "simulate", "rule": "ATHENA-SIMULATED",
                "outcome": (chk or {}).get("outcome"), "solver": planned.get("solver"), "ledger": ledger or {}}
    reason = str(sim.get("reason") or planned.get("reason") or "")
    head = str(sim.get("substance") or sim.get("body") or planned.get("substance") or planned.get("body") or "").strip()
    if reason == "unknown_substance" and head:
        got = fetch_chemical(head, http)
    elif reason in ("unknown_body", "property_missing") and head:
        got = fetch_objects(head, http)
    else:
        return {**base, "ok": [], "proposals": [], "rule": "ATHENA-NOT-RESEARCHABLE", "reason": reason or "no_gap", "ledger": ledger or {}}
    held = got.get("held") or []
    disagree = any(str(h.get("reason") or "") == "publishers_disagree" for h in held if isinstance(h, dict))
    if disagree or not got.get("ok"):
        rule = "ATHENA-DISAGREEMENT" if disagree else "ATHENA-NO-AGREEMENT"
        book = record_outcome(ledger, "lookup", rule, got.get("ok") or [], disagreed=disagree)
        return {**base, "ok": [], "proposals": [], "held": held, "ledger": book, "rule": rule, "method": "lookup"}
    proposed = propose_rows(got.get("ok") or [], question)
    book = record_outcome(ledger, "lookup", "ATHENA-PROPOSED", got.get("ok") or [])
    return {**base, "ok": got.get("ok") or [], "proposals": proposed["proposals"], "rejected": proposed["rejected"],
            "held": held, "ledger": book, "rule": "ATHENA-PROPOSED", "method": "lookup"}


_BACKOFF = (0, 30, 120, 600)
_MAX_ATTEMPTS = 4


def tick_gaps(gaps: list[dict[str, Any]], *, now: float = 0, http: Http = _http, cancelled: list[str] | None = None,
              ledger: dict[str, Any] | None = None) -> dict[str, Any]:
    """One idle pass. Dedupes, backs off, and does not write."""
    seen: set[str] = set()
    stop = {str(x) for x in (cancelled or [])}
    log: list[dict[str, Any]] = []
    proposals: list[dict[str, Any]] = []
    book = dict(ledger or {})
    for gap in gaps or []:
        if not isinstance(gap, dict):
            continue
        key = " ".join(str(gap.get("question") or "").lower().split()).rstrip("?.!")
        if not key or key in seen:
            log.append({"key": key, "rule": "ATHENA-DEDUPED", "calls_llm": False})
            continue
        seen.add(key)
        if key in stop:
            log.append({"key": key, "rule": "ATHENA-CANCELLED", "calls_llm": False})
            continue
        attempts = int(gap.get("attempts") or 0)
        last = float(gap.get("last_at") or 0)
        wait = _BACKOFF[min(attempts, len(_BACKOFF) - 1)]
        if attempts and now < last + wait:
            log.append({"key": key, "rule": "ATHENA-BACKOFF", "calls_llm": False})
            continue
        if attempts >= _MAX_ATTEMPTS:
            log.append({"key": key, "rule": "ATHENA-EXHAUSTED", "calls_llm": False})
            continue
        found = fill_gap(gap, http, book)
        book = found.get("ledger") or book
        gap["attempts"] = attempts + 1
        gap["last_at"] = now
        gap["research_rule"] = found.get("rule")
        if found.get("proposals"):
            proposals.extend(found["proposals"])
        log.append({"key": key, "rule": found.get("rule"), "method": found.get("method"), "n": len(found.get("proposals") or []), "calls_llm": False})
    return {"log": log, "proposals": proposals, "ledger": book, "calls_llm": False, "supabase_write": False, "phone_remember": False}


def facts_for(kind: str, name: str, http: Http = _http) -> dict[str, Any]:
    if kind == "chemical":
        return fetch_chemical(name, http)
    if kind == "object":
        return fetch_objects(name, http)
    if kind == "body":
        return fetch_body(name, http)
    return {"ok": [], "held": [{"reason": "unknown_kind", "kind": kind}], "calls_llm": False, "supabase_write": False}
