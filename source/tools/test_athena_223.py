"""4.9.223 unit tests: the meaning layer (subject meaning, category head, WordNet chain, more specific than the genus,
another meaning), the numeric value slot, short glosses, the sense-keyed question phase, GeoNames not counted, the
document licence, and the new fetchers (frozen CIA World Factbook, BIPM defining constants, PubChem NCIt, ChEBI is_a
path), all offline: OEWN from verify/fixtures/athena_223/oewn, web answers from verify/fixtures/athena_223/responses.json
(any URL not recorded answers 404). Prints a JSON list of {name, ok, why}; exit 1 on any failure."""
import json
import os
import sys
import traceback

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
FIX = os.path.join(ROOT, "verify", "fixtures", "athena_223")
os.environ["FORGE_OEWN_DIR"] = os.path.join(FIX, "oewn")
sys.path.insert(0, os.path.join(ROOT, "engine"))
from rmc_engine_v1 import athena_sources_223 as A  # noqa: E402
from rmc_engine_v1 import meaning_223 as M  # noqa: E402
from rmc_engine_v1 import self_seed_202 as ss  # noqa: E402

RESP = json.load(open(os.path.join(FIX, "responses.json"), encoding="utf-8"))["responses"]
TABLE = json.load(open(os.path.join(ROOT, "data", "concept_senses.json"), encoding="utf-8"))
CASES = {c["name"]: c["payload"] for c in json.loads(os.popen(sys.executable + " " + os.path.join(ROOT, "tools", "meaning_cases_223.py")).read())["payloads"]}
TESTS = []


def http(url):
    if url in RESP:
        return RESP[url]
    raise A.FetchMiss(url)


def T(fn):
    TESTS.append(fn)
    return fn


def expect(cond, why):
    if not cond:
        raise AssertionError(why)


def case(prefix):
    name = next(n for n in CASES if n.startswith(prefix))
    return ss.evaluate(json.loads(json.dumps(CASES[name])))


@T
def value_canon_is_string_arithmetic_with_unit_algebra():
    v = ss.value_canon
    expect(v("6.626 070 15 x 10^-34 J Hz^-1 (exact)") == v("6.62607015 × 10^−34 J s") == "6.62607015e-34 J s", v("6.626 070 15 x 10^-34 J Hz^-1 (exact)"))
    expect(v("299 792 458 m s^-1 (exact)") == v("299 792 458 m/s") == "2.99792458e8 m s^-1", "speed of light")
    expect(v("0.07346 × 10^24 kg") == v("7.346 x 10^22 kg") == "7.346e22 kg", "scale")
    expect(v("4th planet from the Sun") is None and v("12 apples and pears") is None, "prose is not a value")
    expect(v("6.626 070 16 x 10^-34 J s") != v("6.626 070 15 x 10^-34 J s"), "different digits never agree")


@T
def short_complete_gloss_sentences_pass():
    expect(ss.split_sentences("Gravity is a force.") == ["Gravity is a force."], "short gloss kept")
    expect(ss.split_sentences("It is.") == [] and ss.split_sentences("gravity is a force.") == [] and ss.split_sentences("Gravity is a force") == [], "fragments refused")


@T
def category_head_is_the_wordnet_noun_that_ends_the_predicate_np():
    got = {s: M.category_of(s)["category"] for s in ["Moon is the natural satellite of the planet Earth.", "Gravity is a force of attraction.",
           "Ammonia is a pungent gas compounded of nitrogen and hydrogen.", "Water is a clear, odorless, tasteless liquid.", "The Moon is a heavenly body.",
           "Helium is a noble gas with the atomic symbol He.", "Oxygen is a chemical element with symbol O."]}
    expect(list(got.values()) == ["satellite", "force", "gas", "liquid", "heavenly body", "noble gas", "chemical element"], json.dumps(got))


@T
def subject_meaning_pinned_resolved_or_ask():
    moon = M.resolve_subject("What is the Moon?", TABLE)
    expect(moon["state"] == "pinned" and moon["sense"] == "09381255-n" and moon["phi"] == 9 and moon["phi_from"] == "pinned concept A.MOON", json.dumps(moon))
    merc = M.resolve_subject("What is Mercury?", TABLE)
    expect(merc["state"] == "ask" and len(merc["candidates"]) == 2 and all(c["gloss"] for c in merc["candidates"]), json.dumps(merc))
    sol = M.resolve_subject("What is the speed of light?", TABLE)
    expect(sol["state"] == "resolved" and sol["sense"] == "15309503-n", "multiword lemma first: " + json.dumps(sol))
    mass = M.resolve_subject("What is the mass of the Moon?", TABLE)
    expect(mass["attr"] == "mass" and mass["attr_sense"] == "05031420-n" and mass["sense"] == "09381255-n", "attribute meaning fixed, never asked")


@T
def chain_relations():
    chain = M.ancestors("14767761-n")  # ammonia
    expect(not M.on_chain("gas", chain) and M.under_chain("gas", chain) is None, "gas is not read as 'gasoline' to reach compound")
    expect(M.under_chain("inorganic compound", chain) and M.under_chain("hydride", chain), "more specific than the genus")
    expect(M.on_chain("satellite", M.ancestors("09381255-n")) and M.on_chain("heavenly body", M.ancestors("09381255-n")), "moon chain")


@T
def sense_keyed_question_phase():
    r = case("moon: NASA + MeSH")
    expect(r["loop_phi"] == 9 and r["loop_from"] == "subject meaning" and r["rule"] == "SEED-CANDIDATE", json.dumps([r["loop_phi"], r["rule"]]))
    r = case("moon: explicit loop_phi")
    expect(r["loop_phi"] == 1 and r["loop_from"] == "question", "explicit loop wins")
    r = case("moon: no meaning payload")
    expect(r["loop_from"] == "question" and r["claim"].startswith("identity|"), "no meaning: the 4.9.222 decision is unchanged")
    r = case("time slot")
    expect(r["loop_from"] == "question", "only definitional (identity) questions take the subject phase")


@T
def meaning_agreement_rules():
    expect(case("moon: two NASA hosts")["rule"] == "SEED-CORROBORATION", "one publisher")
    expect(case("moon: a synonym category")["rule"] == "SEED-CANDIDATE", "synonym agrees")
    expect(case("moon: OEWN row carrying the subject sense")["rule"] == "SEED-CANDIDATE", "same sense agrees")
    expect(case("moon: OEWN row carrying ANOTHER sense")["rule"] == "SEED-CORROBORATION", "4.9.228: other sense is off-sense, NASA alone needs a second publisher")
    r = case("Mercury the planet")
    expect(r["rule"] == "SEED-CANDIDATE", "4.9.228: metal other-meaning does not veto planet agreement")
    expect(sorted(r.get("hosts") or []) == ["nasa.gov", "nih.gov"] and not (r.get("trace") or {}).get("meaning", {}).get("contradict"), "planet publishers stand; metal is off_sense")
    r = case("ammonia: more specific")
    expect(r["rule"] == "SEED-CANDIDATE" and r["hosts"] == ["ebi.ac.uk", "nih.gov"] and [u["category"] for u in r["trace"]["meaning"]["unplaced"]] == ["gas"], json.dumps(r.get("trace", {}).get("meaning")))
    expect(case("ammonia: only unplaced")["rule"] == "SEED-UNPLACED", "unplaced neither agrees nor blocks")


@T
def geonames_never_counts_and_frozen_factbook_does():
    r = case("capital: World Bank + GeoNames")
    expect(r["rule"] == "SEED-CORROBORATION" and r["hosts"] == ["worldbank.org"], json.dumps([r["rule"], r.get("hosts")]))
    r = case("capital: World Bank + frozen Factbook")
    expect(r["rule"] == "SEED-CANDIDATE" and r["hosts"] == ["cia.gov", "worldbank.org"], json.dumps([r["rule"], r.get("hosts")]))
    expect(r["anchor"]["provenance"]["archived_from"] is None or "factbook.json" in str(r["anchor"]["provenance"]["archived_from"]), "archived_from kept")


@T
def value_slot_agreement():
    r = case("Planck: NIST")
    expect(r["rule"] == "SEED-CANDIDATE" and r["claim"] == "value|planck constant|6.62607015e-34 J s", json.dumps([r["rule"], r.get("claim")]))
    expect(case("Planck: different digits")["rule"] == "SEED-DISAGREEMENT", "different values hold")


@T
def short_glosses_and_document_licence():
    expect(case("gravity: short complete")["rule"] == "SEED-CANDIDATE", "short glosses agree")
    r = case("NCIt document licence")
    expect(r["anchor"]["license"] == "CC BY 4.0" and r["anchor"]["provenance"]["origin"] == "NCI Thesaurus (NCIt)", json.dumps(r["anchor"]["provenance"])[:300])


@T
def config_flags():
    rows = A.source_rows()
    expect(rows["cia_factbook"]["enabled"] and rows["cia_factbook"]["status"] == "FROZEN" and rows["cia_factbook"]["mirror_commit"].startswith("783ed27"), "factbook frozen")
    expect(not rows["iupac_goldbook"]["enabled"], "IUPAC stays off")
    expect(rows["geonames"]["agreement_counts"] is False and ss.source_for("https://download.geonames.org/x")["agreement_counts"] is False, "GeoNames not counted")
    expect(rows["bipm_constants"]["enabled"] and rows["bipm_constants"]["license"] == "CC BY 4.0", "BIPM constants")


@T
def fetch_cia_factbook_frozen_copy():
    v = A.fetch_all("What is the capital of Burkina Faso?", http=http, only=["cia_factbook"])["per_source"]["cia_factbook"]
    d = v["docs"][0]
    expect(d["text"] == "The capital of Burkina Faso is Ouagadougou." and d["url"].startswith("https://www.cia.gov/the-world-factbook/countries/") and "783ed27f7a11" in d["archived_from"] and d["as_of"] == "2026-01-22", json.dumps(d)[:300])


@T
def fetch_bipm_defining_constants():
    d = A.fetch_all("What is the Planck constant?", http=http, only=["bipm_constants"])["per_source"]["bipm_constants"]["docs"][0]
    expect(d["text"] == "The Planck constant is 6.626 070 15 × 10^-34 J s (exact)." and ss.source_for(d["url"])["host"] == "bipm.org", d["text"])


@T
def fetch_pubchem_origins_and_licence():
    d = A.fetch_all("What is caffeine?", http=http, only=["pubchem"])["per_source"]["pubchem"]["docs"][0]
    expect(d.get("origin") == "LiverTox" and "license" not in d, "public domain origin first: " + str(d.get("origin")))
    d = A.fetch_all("What is glucose?", http=http, only=["pubchem"])["per_source"]["pubchem"]["docs"][0]
    expect(d.get("origin") == "NCI Thesaurus (NCIt)" and d["license"] == "CC BY 4.0" and d["license_url"].endswith("/by/4.0/") and "NCI Thesaurus" in d.get("attribution", ""), json.dumps(d)[:300])


@T
def fetch_chebi_is_a_path():
    d = A.fetch_all("What is ammonia?", http=http, only=["chebi"])["per_source"]["chebi"]["docs"][0]
    expect(d.get("category_path") and d["category_path_source"].startswith("ChEBI"), json.dumps(d.get("category_path")))


def main():
    out = []
    for fn in TESTS:
        try:
            fn()
            out.append({"name": fn.__name__, "ok": True})
        except Exception as exc:
            out.append({"name": fn.__name__, "ok": False, "why": str(exc)[:400] or traceback.format_exc()[-400:]})
    print(json.dumps(out, indent=1))
    sys.exit(0 if all(r["ok"] for r in out) else 1)


if __name__ == "__main__":
    main()
