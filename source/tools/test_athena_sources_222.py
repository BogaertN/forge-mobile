"""4.9.222 unit tests for the Athena Tier-A fetchers, each source on its own, offline on recorded responses
(verify/fixtures/athena_222). Any URL not recorded answers 404, so a test never touches the network.
Prints a JSON list of {name, ok, why}; exit 1 on any failure."""
import json
import os
import sys
import traceback

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
FIX = os.path.join(ROOT, "verify", "fixtures", "athena_222")
os.environ["FORGE_OEWN_DIR"] = os.path.join(FIX, "oewn")
sys.path.insert(0, os.path.join(ROOT, "engine"))
from rmc_engine_v1 import athena_sources_222 as A  # noqa: E402
from rmc_engine_v1 import self_seed_202 as ss  # noqa: E402

RESP = json.load(open(os.path.join(FIX, "responses.json"), encoding="utf-8"))["responses"]
CALLS = []


def http(url):
    CALLS.append(url)
    if url in RESP:
        return RESP[url]
    raise A.FetchMiss(url)


TABLE = json.load(open(os.path.join(ROOT, "data", "concept_senses.json"), encoding="utf-8"))
PINNED, PINNED_QID = A.pins_from_table(TABLE)
ROWS = A.source_rows()
TESTS = []


def T(fn):
    TESTS.append(fn)
    return fn


def expect(cond, why):
    if not cond:
        raise AssertionError(why)


def one(sid, q, **kw):
    got = A.fetch_all(q, http=http, pinned=PINNED, pinned_qid=PINNED_QID, only=[sid], **kw)
    v = got["per_source"][sid]
    return v, (v.get("docs") or [None])[0], got


def allowlisted(doc, sid):
    row = ss.source_for(doc["url"])
    expect(row is not None, sid + ": url not on the allowlist " + doc["url"])
    expect(row["license"].split(" (")[0] == ROWS[sid]["license"].split(" (")[0], sid + ": licence label " + row["license"] + " vs " + ROWS[sid]["license"])
    expect(doc["text"][:1].isupper() and doc["text"].endswith("."), sid + ": not a whole sentence: " + doc["text"])
    expect(doc["role"] == "source" and doc["sha256"] == A.sha256_text(doc["text"]), sid + ": doc shape")


@T
def nasa_science_defining_sentence_first():
    v, d, _ = one("nasa_science", "What is the Moon?")
    expect(v["status"] == "FETCHED" and d["text"] == "The Moon is Earth's only natural satellite.", str(d and d["text"]))
    expect(d["how"]["define_rank"] == 2 and d["how"]["index"] > 0, "define_rank picked a later sentence over the page's first: " + json.dumps(d["how"]))
    allowlisted(d, "nasa_science")


@T
def nasa_spaceplace_tries_slugs_and_misses_cleanly():
    CALLS.clear()
    v, d, _ = one("nasa_spaceplace", "What is gravity?")
    expect(d and d["text"] == "Gravity is the force by which a planet or other body draws objects toward its center.", str(d and d["text"]))
    expect(CALLS[-1].endswith("/what-is-gravity/en/") and len(CALLS) == 3, "slug order " + json.dumps(CALLS))
    allowlisted(d, "nasa_spaceplace")
    v2, d2, _ = one("nasa_spaceplace", "What is a quasar?")
    expect(v2["status"] == "NO-ENTRY" and d2 is None, "a missing page is NO-ENTRY")


@T
def nasa_nssdc_numbers_only_for_attribute_questions():
    v, d, _ = one("nasa_nssdc", "What is the mass of the Moon?")
    expect(d and d["text"] == "The mass of the Moon is 0.07346 × 10^24 kg.", str(d and d["text"]))
    allowlisted(d, "nasa_nssdc")
    v2, d2, _ = one("nasa_nssdc", "What is the Moon?")
    expect(v2["status"] == "NO-ENTRY", "the fact sheet never defines a body")


@T
def nlm_mesh_scope_note_gloss_fit():
    v, d, _ = one("nlm_mesh", "What is ammonia?")
    expect(d and d["text"] == "Ammonia is a colorless alkaline gas.", str(d and d["text"]))
    expect(d["verbatim"].startswith("A colorless alkaline gas.") and d["how"]["render"] == "GLOSS-FIT" and d["how"]["descriptor"].startswith("D"), json.dumps(d["how"]))
    allowlisted(d, "nlm_mesh")


@T
def worldbank_capital_record():
    v, d, _ = one("worldbank", "What is the capital of Burkina Faso?")
    expect(d and d["text"] == "The capital of Burkina Faso is Ouagadougou.", str(d and d["text"]))
    allowlisted(d, "worldbank")
    expect(one("worldbank", "What is gravity?")[0]["status"] == "NO-ENTRY", "only capital questions")


@T
def geonames_capital_record():
    v, d, _ = one("geonames", "What is the capital of Burkina Faso?")
    expect(d and d["text"] == "The capital of Burkina Faso is Ouagadougou.", str(d and d["text"]))
    allowlisted(d, "geonames")


@T
def nist_codata_constant():
    v, d, _ = one("nist_codata", "What is the speed of light?")
    expect(d and d["text"] == "The speed of light in vacuum is 299792458 m s^-1 (exact).", str(d and d["text"]))
    allowlisted(d, "nist_codata")
    v2, d2, _ = one("nist_codata", "What is the Planck constant?")
    expect(d2 and d2["text"] == "The Planck constant is 6.62607015 × 10^-34 J Hz^-1 (exact).", str(d2 and d2["text"]))
    expect(one("nist_codata", "What is the mass?")[0]["status"] == "NO-ENTRY", "an ambiguous name (many '... mass' rows) is not guessed")


@T
def bipm_si_base_unit():
    v, d, _ = one("bipm_si", "What is a kilogram?")
    expect(d and d["text"] == "The kilogram is the SI unit of mass.", str(d and d["text"]))
    expect(d["verbatim"] == "The kilogram, symbol kg, is the SI unit of mass." and d["how"]["symbol"] == "kg", d["verbatim"])
    allowlisted(d, "bipm_si")


@T
def pubchem_periodic_table():
    v, d, _ = one("pubchem", "What is oxygen?")
    expect(d and d["text"] == "Oxygen is a chemical element with symbol O and atomic number 8.", str(d and d["text"]))
    allowlisted(d, "pubchem")
    v2, d2, _ = one("pubchem", "What is quartz?")  # description not recorded -> 404 -> nothing, no guess
    expect(v2["status"] == "NO-ENTRY", v2["status"])


@T
def chebi_definition_gloss_fit():
    v, d, _ = one("chebi", "What is ammonia?")
    expect(d and d["text"].startswith("Ammonia is an azane that consists of a single nitrogen atom"), str(d and d["text"]))
    expect(d["how"]["chebi"].startswith("CHEBI:"), json.dumps(d["how"]))
    allowlisted(d, "chebi")


@T
def oewn_pinned_sense_and_ask_when_ambiguous():
    v, d, _ = one("oewn", "What is gravity?")
    expect(d and d["text"] == "Gravity is the force of attraction between all masses in the universe.", str(d and d["text"]))
    expect(d["how"]["sense"] == "pinned" and d["how"]["synset"] == "11484542-n", json.dumps(d["how"]))
    allowlisted(d, "oewn")
    v2, d2, _ = one("oewn", "What is Mercury?")
    expect(v2["status"] == "AMBIGUOUS" and len(v2["senses"]) == 2 and d2 is None, "Mercury (planet, god) is asked, never guessed: " + json.dumps(v2))
    v3, d3, _ = one("oewn", "What is oxygen?")
    expect(d3 and d3["text"].startswith("Oxygen is a nonmetallic bivalent element"), str(d3 and d3["text"]))


@T
def wikidata_crosscheck_only():
    got = A.fetch_all("What is oxygen?", http=http, pinned=PINNED, pinned_qid=PINNED_QID, only=["oewn", "wikidata"])
    cc = got["per_source"]["wikidata"]["crosscheck"]
    expect(cc["qid"] == "Q629" and cc["counts_as_publisher"] is False and cc["role"] == "crosscheck", json.dumps(cc))
    expect(all(d["source_id"] != "wikidata" for d in got["documents"]), "Wikidata never returns a source document")
    expect(ss.is_pointer_host(cc["url"]) and ss.source_for(cc["url"]) is None, "wikidata.org stays a pointer host, never a trusted source")


@T
def disabled_sources_are_never_fetched():
    CALLS.clear()
    got = A.fetch_all("What is the capital of Burkina Faso?", http=http, pinned=PINNED, only=["cia_factbook", "iupac_goldbook"])
    expect(got["per_source"]["cia_factbook"]["status"] == "SUNSET" and got["per_source"]["iupac_goldbook"]["status"] == "BLOCKED", json.dumps(got["per_source"]))
    expect(not CALLS and not got["documents"], "a disabled source made a call: " + json.dumps(CALLS))
    expect(not ROWS["cia_factbook"]["enabled"] and not ROWS["iupac_goldbook"]["enabled"], "flags")


@T
def one_source_failing_never_stops_the_others():
    bad = dict(RESP)
    bad["https://api.worldbank.org/v2/country?format=json&per_page=400"] = "<html>maintenance</html>"

    def h(url):
        if url in bad:
            return bad[url]
        raise A.FetchMiss(url)
    got = A.fetch_all("What is the capital of Burkina Faso?", http=h, only=["worldbank", "geonames"])
    expect(got["per_source"]["worldbank"]["status"] == "ERROR" and got["per_source"]["geonames"]["status"] == "FETCHED", json.dumps({k: v["status"] for k, v in got["per_source"].items()}))


@T
def gloss_render_rules():
    r = A.render_gloss
    expect(r("Gravity", "(physics) the force of attraction between all masses in the universe") == "Gravity is the force of attraction between all masses in the universe.", "domain label")
    expect(r("Oxygen", "An element with atomic symbol O, atomic number 8, and atomic weight [15.99903; 15.99977]. It is common.") == "Oxygen is an element with atomic symbol O, atomic number 8, and atomic weight [15.99903; 15.99977].", "bracketed ';' and the first sentence only")
    expect(r("Quartz", "Quartz (SiO2).") is None, "a tautology defines nothing")
    expect(r("Kilogram", "one thousand grams; the basic unit of mass") == "Kilogram is one thousand grams.", "first clause")


@T
def define_rank_picks_the_defining_sentence():
    sents = ["Earth's Moon records evidence of our solar system's history.", "The Moon is Earth's only natural satellite.", "The Moon is bright."]
    pick = A.choose_defining("What is the Moon?", sents)
    expect(pick["index"] == 1 and pick["rank"] == 2, json.dumps(pick))
    expect(A.choose_defining("What is the Moon?", ["Earth's Moon records evidence."]) is None, "a mention is never a definition")


@T
def two_independent_publishers_corroborate_one_does_not():
    wb = one("worldbank", "What is the capital of Burkina Faso?")[1]
    gn = one("geonames", "What is the capital of Burkina Faso?")[1]
    res = ss.evaluate({"question": "What is the capital of Burkina Faso?", "documents": [wb, gn], "gap": True, "reset": True, "loop_phi": 6})
    expect(res["rule"] == "SEED-CANDIDATE" and res["hosts"] == ["geonames.org", "worldbank.org"], json.dumps({k: res.get(k) for k in ("rule", "hosts", "claim")}))
    expect(res["anchor"]["provenance"]["independent_hosts"] == ["geonames.org", "worldbank.org"], "provenance hosts")
    ns = one("nasa_science", "What is the Moon?")[1]
    sp = dict(ns, url="https://spaceplace.nasa.gov/all-about-the-moon/en/")
    res2 = ss.evaluate({"question": "What is the Moon?", "documents": [ns, sp], "gap": True, "reset": True, "loop_phi": 9})
    expect(res2["rule"] == "SEED-CORROBORATION", "two NASA hosts are one publisher: " + str(res2["rule"]))


@T
def subject_binds_on_content_words_only():
    c = ss.claim_of("What is the capital of Burkina Faso?", "The capital of Burkina Faso is Ouagadougou.")
    expect(c["ok"] and c["claim"] == "identity|capital burkina faso|ouagadougou", json.dumps(c))
    c2 = ss.claim_of("What is the speed of light?", "The speed of light in vacuum is 299792458 m s^-1.")
    expect(c2["ok"], json.dumps(c2))
    expect(not ss.claim_of("What is the Moon?", "Earth's moon is bright.")["ok"], "a possessive subject still never binds")
    expect(not ss.claim_of("What is the capital of Mali?", "The capital of Burkina Faso is Ouagadougou.")["ok"], "another subject never binds")


@T
def nothing_writes_and_no_model():
    src = open(A.__file__, encoding="utf-8").read()
    src = src.split('"""', 2)[2]  # the module docstring says "no model, no embeddings"; the code itself must not
    for bad in ("supabase", "SUPABASE", "insert", "upsert", "openai", "anthropic", "embedding", "/rest/v1"):
        expect(bad not in src, "fetchers mention " + bad)
    got = A.fetch_all("What is the Moon?", http=http, pinned=PINNED, only=["nasa_science"])
    expect(got["writes"] is False and got["calls_llm"] is False, "flags")


rows, failed = [], 0
for fn in TESTS:
    try:
        fn()
        rows.append({"name": fn.__name__, "ok": True})
    except Exception as exc:  # noqa: BLE001
        failed += 1
        rows.append({"name": fn.__name__, "ok": False, "why": (str(exc) or traceback.format_exc())[:600]})
print(json.dumps(rows, indent=1, ensure_ascii=False))
sys.exit(1 if failed else 0)
