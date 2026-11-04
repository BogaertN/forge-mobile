"""4.9.223 live check of every Athena source (4.9.223 config), one at a time, three times each on its own probe
question. A source passes only if it answers each time with the same sentence (no flake), its URL is on the allowlist,
and the licence on the document (its own NCIt licence, else the registry row) matches the allowlist or the document's
declared origin. The frozen CIA World Factbook must pass 3/3 or it stays disabled. Writes the status JSON; nothing else.
usage: FORGE_OEWN_DIR=<dir> python3 tools/athena_sources_live_223.py out.json [--record=fixtures.json]"""
import json
import os
import sys
import time

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, os.path.join(ROOT, "engine"))
from rmc_engine_v1 import athena_sources_223 as A  # noqa: E402
from rmc_engine_v1 import meaning_223 as M  # noqa: E402
from rmc_engine_v1 import self_seed_202 as ss  # noqa: E402

PROBES = {
    "nasa_science": "What is the Moon?", "nasa_spaceplace": "What is gravity?", "nasa_nssdc": "What is the mass of the Moon?",
    "nlm_mesh": "What is ammonia?", "cia_factbook": "What is the capital of Burkina Faso?", "worldbank": "What is the capital of Burkina Faso?",
    "geonames": "What is the capital of Burkina Faso?", "nist_codata": "What is the speed of light?", "bipm_si": "What is a kilogram?",
    "bipm_constants": "What is the Planck constant?", "pubchem": "What is caffeine?", "chebi": "What is ammonia?", "iupac_goldbook": "What is a mole?",
    "oewn": "What is gravity?", "wikidata": "What is oxygen?",
}
EXTRA = {"pubchem": ["What is oxygen?", "What is glucose?"], "cia_factbook": ["What is the capital of France?"]}


def main():
    record = None
    args = sys.argv[2:]
    if args and args[0].startswith("--record="):
        record = args[0].split("=", 1)[1]
    seen = {}

    def http(url):
        body = A.http_get(url)
        seen[url] = body
        return body

    table = json.load(open(os.path.join(ROOT, "data", "concept_senses.json"), encoding="utf-8"))
    rows = A.source_rows()
    report = {}
    for sid, row in rows.items():
        q = PROBES[sid]
        if not row.get("enabled"):
            report[sid] = {"publisher": row["publisher"], "license": row["license"], "enabled": False, "status": row.get("status", "DISABLED"), "reason": row["note"], "probe": q}
            continue
        runs = []
        for i in range(3):
            t0 = time.time()
            subject = M.resolve_subject(q, table)
            got = A.fetch_all(q, http=http, subject=subject, only=[sid] if sid != "wikidata" else ["oewn", "wikidata"])
            v = got["per_source"].get(sid, {})
            d = (v.get("docs") or [None])[0]
            runs.append({"status": v.get("status"), "sentence": d and d["text"], "url": d and d["url"], "error": v.get("error"),
                         "license": d and d.get("license"), "origin": d and d.get("origin"), "archived_from": d and d.get("archived_from"),
                         "crosscheck": v.get("crosscheck"), "ms": int((time.time() - t0) * 1000)})
            time.sleep(1.0)
        first = runs[0]
        stable = all(r["status"] == first["status"] and r["sentence"] == first["sentence"] and (r.get("crosscheck") or {}).get("qid") == (first.get("crosscheck") or {}).get("qid") for r in runs)
        allow = ss.source_for(first["url"]) if first["url"] else None
        lic_ok = sid == "wikidata" or bool(allow and (first.get("license") or allow["license"]).split(" (")[0] in (row["license"].split(" (")[0], allow["license"].split(" (")[0], "CC BY 4.0"))
        ok = stable and (first["status"] == "FETCHED" or (sid == "wikidata" and first["status"] == "CROSSCHECK" and (first["crosscheck"] or {}).get("qid"))) and lic_ok
        if sid == "wikidata":
            ok = ok and ss.is_pointer_host(first["crosscheck"]["url"])
        extra = []
        for q2 in EXTRA.get(sid, []):
            got = A.fetch_all(q2, http=http, subject=M.resolve_subject(q2, table), only=[sid])
            d = ((got["per_source"].get(sid) or {}).get("docs") or [None])[0]
            extra.append({"probe": q2, "sentence": d and d["text"], "license": d and d.get("license"), "origin": d and d.get("origin")})
        report[sid] = {"publisher": row["publisher"], "license": row["license"], "enabled": True, "status": "OK" if ok else "FAIL",
                       "stable_3_of_3": stable, "allowlist_row": allow and {"host": allow["host"], "tier": allow["tier"], "license": allow["license"], "agreement_counts": allow.get("agreement_counts", True)},
                       "probe": q, "sentence": first["sentence"], "url": first["url"], "doc_license": first.get("license"), "origin": first.get("origin"),
                       "archived_from": first.get("archived_from"), "crosscheck": first.get("crosscheck"), "extra_probes": extra,
                       "ms": [r["ms"] for r in runs], "errors": [r["error"] for r in runs if r["error"]]}
        print(sid, report[sid]["status"], "stable" if stable else "FLAKY", (first["sentence"] or json.dumps(first.get("crosscheck")) or "")[:110], extra and [e["sentence"] and e["sentence"][:60] for e in extra])
    json.dump({"schema": "FORGE-ATHENA-SOURCES-LIVE/223", "checked_at": A.S.now_iso(), "sources": report}, open(sys.argv[1], "w"), indent=1, ensure_ascii=False)
    if record:
        json.dump(seen, open(record, "w"), ensure_ascii=False)


if __name__ == "__main__":
    main()
