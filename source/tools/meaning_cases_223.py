"""4.9.223 shared decision cases (Python, JS and Pyodide must agree on every one): meaning + category agreement, the
subject-meaning question phase, GeoNames not counted, the numeric value slot, short glosses, the document licence.
The documents are fixed sentences on allowlisted URLs; the meaning annotations come from meaning_223 on the offline
OEWN fixture (verify/fixtures/athena_223/oewn). Prints {"payloads": [...], "values": [...], "sentences": [...]}.
usage: python3 tools/meaning_cases_223.py"""
import json
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
os.environ["FORGE_OEWN_DIR"] = os.path.join(ROOT, "verify", "fixtures", "athena_223", "oewn")
sys.path.insert(0, os.path.join(ROOT, "engine"))
from rmc_engine_v1 import meaning_223 as M  # noqa: E402
from rmc_engine_v1 import self_seed_202 as ss  # noqa: E402

TABLE = json.load(open(os.path.join(ROOT, "data", "concept_senses.json"), encoding="utf-8"))
NASA = "https://science.nasa.gov/moon/facts/"
MESH = "https://id.nlm.nih.gov/mesh/D009007.html"
OEWN = "https://en-word.net/id/oewn-09381255-n"
WB = "https://api.worldbank.org/v2/country/BFA?format=json"
GN = "https://download.geonames.org/export/dump/countryInfo.txt#BF"
CIA = "https://www.cia.gov/the-world-factbook/countries/burkina-faso/"
NIST = "https://physics.nist.gov/cuu/Constants/Table/allascii.txt#Planck%20constant"
BIPM = "https://www.bipm.org/en/measurement-units/si-defining-constants#h"
PUBCHEM = "https://pubchem.ncbi.nlm.nih.gov/compound/2519"
EBI = "https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:16134"


def doc(url, text, **kw):
    d = {"url": url, "text": text, "role": "source", "fetched_at": "2026-11-04T00:00:00+00:00"}
    d.update(kw)
    return d


def meaning_payload(q, docs, subject=None, **kw):
    subject = subject or M.resolve_subject(q, TABLE)
    m = M.annotate(q, docs, subject)
    p = {"question": q, "documents": docs, "gap": True, "reset": True, "now": 1000, "meaning": m}
    p.update(kw)
    return p


def main():
    payloads = []
    moon = "What is the Moon?"
    s1 = "The Moon is Earth's only natural satellite."
    payloads.append(("moon: NASA + MeSH on the chain at the Moon's phase -> candidate", meaning_payload(moon, [doc(NASA, s1), doc(MESH, s1)])))
    payloads.append(("moon: two NASA hosts are one publisher", meaning_payload(moon, [doc(NASA, s1), doc("https://spaceplace.nasa.gov/all-about-the-moon/en/", s1)])))
    payloads.append(("moon: explicit loop_phi wins over the subject phase", meaning_payload(moon, [doc(NASA, s1), doc(MESH, s1)], loop_phi=1)))
    payloads.append(("moon: no meaning payload -> unchanged 4.9.222 decision", {"question": moon, "documents": [doc(NASA, s1), doc(MESH, s1)], "gap": True, "reset": True, "now": 1000}))
    payloads.append(("moon: a synonym category (heavenly body = celestial body) agrees", meaning_payload(moon, [doc(NASA, s1), doc(MESH, "The Moon is a heavenly body.")])))
    payloads.append(("moon: OEWN row carrying the subject sense agrees", meaning_payload(moon, [doc(NASA, s1), doc(OEWN, "The Moon is the natural satellite.", how={"synset": "09381255-n"}, source_id="oewn")])))
    payloads.append(("moon: OEWN row carrying ANOTHER sense is off-sense (not a veto)", meaning_payload(moon, [doc(NASA, s1), doc("https://en-word.net/id/oewn-09381447-n", "The Moon is a natural satellite.", source_id="oewn", how={"synset": "09381447-n"})])))
    merc = "What is Mercury?"
    planet = {"label": "Mercury", "attr": None, "state": "pinned", "sense": "09374305-n", "phi": None}
    sp = ss.sentence_placement("Mercury is the smallest planet in our solar system.")["phi"]
    payloads.append(("Mercury the planet: a 'metallic element' row is another meaning -> off-sense, not disagreement", meaning_payload(merc, [
        doc(NASA.replace("moon/facts", "mercury"), "Mercury is the smallest planet in our solar system."),
        doc(MESH, "Mercury is the smallest planet in our solar system."),
        doc(PUBCHEM, "Mercury is a metallic element that is liquid at room temperature.")], subject=planet, loop_phi=sp)))
    amm = "What is ammonia?"
    payloads.append(("ammonia: more specific than the genus (inorganic compound, hydride) agrees; 'gas' (off the WordNet chain) is unplaced", meaning_payload(amm, [
        doc(PUBCHEM, "Ammonia is an inorganic compound composed of a single nitrogen atom."),
        doc(EBI, "Ammonia is an azane that consists of a single nitrogen atom.", category_path=["nitrogen hydride", "hydrides"], category_path_source="ChEBI is_a (OLS4)"),
        doc(MESH, "Ammonia is a colorless alkaline gas.")])))
    payloads.append(("ammonia: only unplaced categories -> SEED-UNPLACED", meaning_payload(amm, [doc(MESH, "Ammonia is a colorless alkaline gas."), doc(EBI, "Ammonia is an azane that consists of one nitrogen atom.")])))
    bf = "What is the capital of Burkina Faso?"
    cap = "The capital of Burkina Faso is Ouagadougou."
    payloads.append(("capital: World Bank + GeoNames is one counting publisher", meaning_payload(bf, [doc(WB, cap), doc(GN, cap)], loop_phi=6)))
    payloads.append(("capital: World Bank + frozen Factbook -> candidate", meaning_payload(bf, [doc(WB, cap), doc(CIA, cap, archived_from="https://raw.githubusercontent.com/factbook/factbook.json/783ed27f7a1116663c10e7b39d162d0c4500505d/africa/uv.json")], loop_phi=6)))
    pl = "What is the Planck constant?"
    payloads.append(("Planck: NIST (J Hz^-1) and BIPM (J s) agree on the canonical value", meaning_payload(pl, [
        doc(NIST, "The Planck constant is 6.62607015 × 10^-34 J Hz^-1 (exact)."), doc(BIPM, "The Planck constant is 6.626 070 15 × 10^-34 J s (exact).")], loop_phi=3)))
    payloads.append(("Planck: different digits -> disagreement", meaning_payload(pl, [
        doc(NIST, "The Planck constant is 6.62607015 × 10^-34 J Hz^-1 (exact)."), doc(BIPM, "The Planck constant is 6.626 070 16 × 10^-34 J s (exact).")], loop_phi=3)))
    gr = "What is gravity?"
    payloads.append(("gravity: short complete glosses (< 35 chars) count", meaning_payload(gr, [doc("https://spaceplace.nasa.gov/what-is-gravity/en/", "Gravity is a force."), doc("https://en-word.net/id/oewn-11484542-n", "Gravity is an attraction.")])))
    caf = "What is caffeine?"
    payloads.append(("NCIt document licence travels to the anchor", meaning_payload(caf, [
        doc(PUBCHEM, "Caffeine is a methylxanthine alkaloid found in the seeds of plants.", license="CC BY 4.0", license_url="https://creativecommons.org/licenses/by/4.0/", origin="NCI Thesaurus (NCIt)"),
        doc(EBI, "Caffeine is a methylxanthine alkaloid found in the seeds of plants.")], loop_phi=ss.sentence_placement("Caffeine is a methylxanthine alkaloid found in the seeds of plants.")["phi"])))
    payloads.append(("time slot never takes the subject phase", meaning_payload("When was the Moon formed?", [doc(NASA, "The Moon was formed 4.5 billion years ago.")])))
    values = ["6.626 070 15 x 10^-34 J Hz^-1 (exact)", "6.62607015 × 10^−34 J s", "299 792 458 m s^-1 (exact)", "299 792 458 m/s", "0.07346 × 10^24 kg",
              "7.346 x 10^22 kg", "4th planet from the Sun", "1.380 649 x 10^-23 J K^-1", "6.022 140 76 × 10^23 mol^-1", "0.000123 m", "1969", "-40 K", "12 apples and pears", "3 m/s/s"]
    sentences = ["Gravity is a force.", "It is.", "gravity is a force.", "Gravity is a force", "The Sun is a star. It is hot.", "Water is wet."]
    print(json.dumps({"payloads": [{"name": n, "payload": p} for n, p in payloads], "values": values, "sentences": sentences}, ensure_ascii=False))


if __name__ == "__main__":
    main()
