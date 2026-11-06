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
from typing import Any, Callable

SCHEMA = "forge.sim_property/v1"
REL = 0.15  # two measurements of one physical quantity agree within 15 percent
MASS_REL = 0.005  # chemical masses agree within 0.5 percent (PubChem average vs ChEBI exact)
UA = "forge-mobile/4.9.246"
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
    "imcce": {"publisher": "IMCCE", "host": "ssp.imcce.fr", "license": "public-research",
              "license_url": "https://ssp.imcce.fr/webservices/ssodnet/"},
    "jpl": {"publisher": "NASA/JPL", "host": "ssd-api.jpl.nasa.gov", "license": "public-domain",
            "license_url": "https://www.jpl.nasa.gov/jpl-image-use-policy"},
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
    if not pub or not che:
        return {"ok": [], "held": [{"head": name.lower(), "property": "formula", "reason": "publisher_missing",
                                    "pubchem": bool(pub), "chebi": bool(che), "errors": [err_p, err_c]}],
                "calls_llm": False, "supabase_write": False}
    return gilligan(agree_chemical(name, pub, che))


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


def agree_objects(head: str, sides: list[tuple[str, str, dict[str, float]]]) -> list[dict[str, Any]]:
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
        if max(nums) <= 0 or not all(_agree_num(nums[0], n, REL) for n in nums[1:]):
            continue
        mean = sum(nums) / len(nums)
        pubs = [_pub(sid, url) for sid, url, _ in vals]
        unit = "kg" if prop == "mass" else "m"
        rows.append(_fact(head, prop, round(mean, 4), unit, pubs))
    if any(r["property"] == "height" for r in rows) and any(r["property"] == "width" for r in rows):
        pubs = rows[0]["publishers"]
        depth = next((r for r in rows if r["property"] == "depth"), None)
        shape = "box" if depth else "box"
        rows.append(_fact(head, "shape", shape, None, pubs))
    return rows


def _content_words(phrase: str) -> list[str]:
    stop = {"a", "an", "the", "of", "and", "or"}
    return [w for w in re.findall(r"[a-z0-9]+", phrase.lower()) if w not in stop and len(w) > 1]


def _blob(rec: dict[str, Any]) -> str:
    return " ".join(str(rec.get(k) or "") for k in ("title", "objectType", "classification", "description")).lower()


def _one_record(rec: dict[str, Any]) -> dict[str, float]:
    """One catalog record's overall height, width, depth (m) and mass (kg). A part that is not the whole object is skipped."""
    out: dict[str, float] = {}
    dims = rec.get("dimensions") or []
    if isinstance(dims, str):
        return out
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
        if name in ("height", "h", "hoogte") and unit.lower() not in ("kg", "kilogram", "kilograms"):
            out.setdefault("height", metres)
        elif name in ("width", "w", "breedte") and unit.lower() not in ("kg", "kilogram", "kilograms"):
            out.setdefault("width", metres)
        elif name in ("depth", "d", "diepte") and unit.lower() not in ("kg", "kilogram", "kilograms"):
            out.setdefault("depth", metres)
        elif name in ("weight", "mass", "gewicht") or unit.lower() in ("kg", "kilogram", "kilograms"):
            out.setdefault("mass", val if unit.lower() in ("kg", "kilogram", "kilograms") else metres)
    return out


def _spread(xs: list[float]) -> float | None:
    if len(xs) < 2:
        return None
    med = _median(xs)
    if not med:
        return None
    return (max(xs) - min(xs)) / med


def resolve_objects(phrase: str, sides: list[dict[str, Any]], head: str | None = None) -> dict[str, Any]:
    """Full noun phrase, not a stripped head. A bare noun whose catalog heights differ by more than 15 percent
    is underspecified (the caller asks which kind). A specific phrase is an average only where two publishers agree.
    """
    words = _content_words(phrase)
    label = (head or " ".join(words) or phrase).strip().lower()
    empty = {"ok": [], "ask": False, "held": [{"head": label, "property": "dimensions", "reason": "two_publishers_required"}],
             "calls_llm": False, "supabase_write": False}
    if not words:
        return empty
    per: list[tuple[str, str, list[dict[str, float]]]] = []
    heights: list[float] = []
    for side in sides:
        if not isinstance(side, dict):
            continue
        matched = []
        for rec in side.get("records") or []:
            if not isinstance(rec, dict) or _SKIP.search(_blob(rec)):
                continue
            if any(w not in _blob(rec) for w in words):
                continue
            one = _one_record(rec)
            if one:
                matched.append(one)
                if "height" in one:
                    heights.append(one["height"])
        if matched:
            per.append((str(side.get("id") or ""), str(side.get("url") or ""), matched))
    spread = _spread(heights)
    if len(words) == 1 and spread is not None and spread > REL:
        return {"ok": [], "ask": True, "word": words[0], "spread": round(spread, 4),
                "held": [{"head": label, "property": "kind", "reason": "underspecified", "spread": round(spread, 4)}],
                "calls_llm": False, "supabase_write": False}
    medians: list[tuple[str, str, dict[str, float]]] = []
    for sid, url, matched in per:
        med = {}
        for prop in ("height", "width", "depth", "mass"):
            xs = [m[prop] for m in matched if prop in m]
            got = _median(xs)
            if got is not None:
                med[prop] = got
        if med:
            medians.append((sid, url, med))
    rows = agree_objects(label, medians) if len(medians) >= 2 else []
    spoken = " ".join(words)
    for row in rows:
        row["average"] = True
        row["phrase"] = spoken
        row["head"] = label
    if not rows:
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

def fetch_body(name: str, http: Http = _http) -> dict[str, Any]:
    """Radius and mass when IMCCE and JPL both publish them and agree. Moons absent from both catalogs hold."""
    card_url = "https://ssp.imcce.fr/webservices/ssodnet/api/ssocard/" + urllib.parse.quote(name)
    jpl_url = "https://ssd-api.jpl.nasa.gov/sbdb.api?phys-par=1&sstr=" + urllib.parse.quote(name)
    imcce = None
    try:
        card = json.loads(http(card_url, 8.0))
        phys = ((card.get("parameters") or {}).get("physical") or {})
        diam = (phys.get("diameter") or {}).get("value")
        mass = (phys.get("mass") or {}).get("value")
        if diam and mass:
            imcce = {"radius_m": float(diam) * 500.0, "mass_kg": float(mass), "url": card_url}  # diameter km → radius m
    except Exception:
        imcce = None
    jpl = None
    try:
        raw = json.loads(http(jpl_url, 8.0))
        pars = {str(p.get("name") or p.get("desc") or ""): p for p in (raw.get("phys_par") or []) if isinstance(p, dict)}
        # SBDB names vary; accept diameter and mass titles when present.
        diam_km = gm_km = None
        for p in raw.get("phys_par") or []:
            label = str(p.get("name") or "").lower()
            m = re.search(r"[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?", str(p.get("value") or ""))
            if not m:
                continue
            val = float(m.group(0))
            if label == "diameter":
                diam_km = val
            elif label == "gm":
                gm_km = val
        if diam_km and gm_km:
            # GM is published in km^3/s^2. Mass = GM / G, with G the CODATA constant (not a guessed density).
            gm_si = gm_km * 1e9
            mass = gm_si / 6.67430e-11
            jpl = {"radius_m": diam_km * 500.0, "mass_kg": mass, "gm": gm_si, "url": jpl_url}
    except Exception:
        jpl = None
    if not imcce or not jpl:
        return {"ok": [], "held": [{"head": name.lower(), "property": "radius", "reason": "two_publishers_required",
                                    "imcce": bool(imcce), "jpl": bool(jpl)}], "calls_llm": False, "supabase_write": False}
    if not _agree_num(imcce["radius_m"], jpl["radius_m"], REL) or not _agree_num(imcce["mass_kg"], jpl["mass_kg"], REL):
        return {"ok": [], "held": [{"head": name.lower(), "property": "radius", "reason": "publishers_disagree"}],
                "calls_llm": False, "supabase_write": False}
    pubs = [_pub("imcce", imcce["url"]), _pub("jpl", jpl["url"])]
    radius = (imcce["radius_m"] + jpl["radius_m"]) / 2.0
    mass = (imcce["mass_kg"] + jpl["mass_kg"]) / 2.0
    gm = 6.67430e-11 * mass
    head = name.lower()
    return gilligan([
        _fact(head, "radius", round(radius, 1), "m", pubs),
        _fact(head, "mass", mass, "kg", pubs),
        _fact(head, "gm", gm, "m3/s2", pubs),
    ])


def facts_for(kind: str, name: str, http: Http = _http) -> dict[str, Any]:
    if kind == "chemical":
        return fetch_chemical(name, http)
    if kind == "object":
        return fetch_objects(name, http)
    if kind == "body":
        return fetch_body(name, http)
    return {"ok": [], "held": [{"reason": "unknown_kind", "kind": kind}], "calls_llm": False, "supabase_write": False}
