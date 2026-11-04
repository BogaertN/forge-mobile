"""4.9.223 Athena dry-run: meaning + category agreement, sense-keyed question phase, numeric slot. No writes anywhere,
no model, no embeddings.

For each question: the gap is computed from the anchors held (a read-only kb.anchors export with --anchors=, else the
shipped starter + anchors_188 shards); the subject's meaning is resolved (meaning_223.resolve_subject: pinned, the only
meaning of the asked phrase, or ASK with the candidate meanings and their glosses); every enabled 4.9.223 source is
fetched on its own; the meaning layer annotates each document (category, on the subject's WordNet chain, compatible,
another meaning, unplaced); self_seed_202.evaluate decides with the question phase taken from the subject's meaning.
usage: FORGE_OEWN_DIR=<oewn 2025 plus json dir> python3 tools/athena_dryrun_223.py out.json [--anchors=kb.json] "Q1" ..."""
import json
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, os.path.join(ROOT, "engine"))
from rmc_engine_v1 import self_seed_202 as ss  # noqa: E402
from rmc_engine_v1 import athena_sources_223 as A  # noqa: E402
from rmc_engine_v1 import meaning_223 as M  # noqa: E402
from rmc_engine_v1 import resonance_recall as rr  # noqa: E402
from rmc_engine_v1.band_tuning import place  # noqa: E402

ECHO_MEMORY_MIN = 0.97


def anchored_concepts(path):
    rows = []
    if path:
        data = json.load(open(path, encoding="utf-8"))
        rows = data.get("anchors", data) if isinstance(data, dict) else data
    else:
        rows = json.load(open(os.path.join(ROOT, "data", "anchors_187.json"), encoding="utf-8")).get("anchors", [])
        shard_dir = os.path.join(ROOT, "data", "anchors_188", "shards")
        for f in sorted(os.listdir(shard_dir)):
            rows += json.load(open(os.path.join(shard_dir, f), encoding="utf-8")).get("anchors", [])
    found = {}
    for r in rows:
        for c in (r.get("concepts") or []):
            found.setdefault(c, r.get("anchor_id") or r.get("id"))
    return found, len(rows)


def ask_question(subject):
    label = M.re.sub(r"^(the|a|an)\s+", "", (subject.get("thing") or subject.get("label") or ""), flags=M.re.IGNORECASE)
    opts = ["%s (%s)" % (c["gloss"], c["sense"]) for c in subject.get("candidates") or []]
    return "Which '%s' do you mean: %s?" % (label, "; or ".join(opts))


def run_one(q, anchored, table, http=A.http_get):
    concepts = rr.question_concepts(q, set(anchored))
    have = sorted(c for c in concepts if c in anchored)
    gap = not have
    subject = M.resolve_subject(q, table)
    fetched = A.fetch_all(q, http=http, subject=subject)
    docs = fetched["documents"]
    meaning = M.annotate(q, docs, subject)
    payload = {"question": q, "documents": docs, "gap": True, "reset": True, "meaning": meaning}
    res = ss.evaluate(payload)
    loop = res.get("loop_phi")
    found = ss._candidates(q, docs, loop)
    kept = {r["url"]: r for r in found["kept"]}
    skipped = {}
    for r in found["skipped"]:
        skipped.setdefault(r["url"], r)
    rows = []
    rows_by_src = A.source_rows()
    for sid, v in fetched["per_source"].items():
        row = {"source": sid, "status": v["status"], "publisher": (rows_by_src.get(sid) or {}).get("publisher"),
               "counts": (rows_by_src.get(sid) or {}).get("agreement_counts") is not False}
        for key in ("error", "senses", "crosscheck"):
            if v.get(key):
                row[key] = v[key]
        for d in v.get("docs") or []:
            sp = ss.sentence_placement(d["text"])
            p = place(d["text"], sp["phi"], {"concept": sp.get("concept")}) if isinstance(sp.get("phi"), int) else None
            k = kept.get(d["url"])
            sk = skipped.get(d["url"])
            row.update({"url": d["url"], "sentence": d["text"], "verbatim": d["verbatim"] if d["verbatim"] != d["text"] else None,
                        "how": d["how"], "license": d.get("license"), "origin": d.get("origin"), "archived_from": d.get("archived_from"),
                        "phase_int": sp.get("phi"), "concept": sp.get("concept"), "loop_phi": loop,
                        "Phi": p and p["Phi"], "band": p and p["band"]["band"], "hz": p and p["band"]["hz"],
                        "echo": k and k["echo"], "claim": k and k["claim"], "host": k and k["host"],
                        "row_rule": "KEPT" if k else (sk or {}).get("rule", "NO-SENTENCE"), "meaning": d.get("meaning")})
        rows.append(row)
    rule = res.get("rule")
    echo = float(res.get("echo") or 0)
    # advisory only (decides nothing): the hosts whose definition agrees on meaning but whose sentence the lexicon filed
    # under another word's phase (e.g. 'Earth' in a Moon definition) -- what filing a definition under the meaning it
    # defines would change
    sense = meaning.get("subject_sense")
    phase_held = sorted({ss.source_for(x["url"])["host"] for x in rows if x.get("row_rule") == "PHASE" and sense and x.get("counts")
                         and ((x.get("meaning") or {}).get("sense") == sense or (x.get("meaning") or {}).get("on_chain") or (x.get("meaning") or {}).get("under_chain"))})
    agree_now = set(((res.get("trace") or {}).get("meaning") or {}).get("agree") or [])
    agree_now = {h for h in agree_now if h != "geonames.org"}
    if not gap:
        verdict = "PINNED (already anchored: " + ", ".join(have) + "; not a gap, nothing considered)"
    elif subject.get("state") == "ask":
        verdict = "ASK"
    elif rule == "SEED-CANDIDATE":
        verdict = "WOULD ADMIT (not written)" if echo >= ECHO_MEMORY_MIN else "HOLD memory write (Echo %.3f < 0.97)" % echo
    else:
        verdict = "HOLD " + str(rule)
    return {"question": q, "gap": gap, "anchored": have, "subject": {k: subject.get(k) for k in ("label", "attr", "thing", "state", "sense", "concept", "phi", "phi_from", "attr_sense")},
            "subject_gloss": ((M._syn(subject["sense"]) or {}).get("definition") or [""])[0] if subject.get("sense") else None,
            "ask": ask_question(subject) if subject.get("state") == "ask" else None, "candidates": subject.get("candidates") or [],
            "loop_phi": loop, "loop_from": res.get("loop_from"), "meaning_payload": meaning,
            "evaluate_rule": rule, "claim": res.get("claim"), "hosts": res.get("hosts"), "echo": res.get("echo"),
            "agreement": (res.get("trace") or {}).get("meaning"), "anchor_text": (res.get("anchor") or {}).get("text"),
            "anchor_license": (res.get("anchor") or {}).get("license"), "anchor_source": (res.get("anchor") or {}).get("source_url"),
            "verdict": verdict, "sources": rows, "writes": False, "calls_llm": False,
            "advisory_phase_held_agreeing_hosts": phase_held,
            "advisory_if_filed_by_meaning": (len(agree_now | set(phase_held)) >= 2) if sense and gap and subject.get("state") != "ask" else None}


def main():
    args = sys.argv[2:]
    anchors_path = None
    while args and args[0].startswith("--"):
        k, v = args.pop(0)[2:].split("=", 1)
        anchors_path = v if k == "anchors" else anchors_path
    anchored, n_rows = anchored_concepts(anchors_path)
    table = json.load(open(os.path.join(ROOT, "data", "concept_senses.json"), encoding="utf-8"))
    out = [run_one(q, anchored, table) for q in args]
    json.dump({"schema": "FORGE-ATHENA-DRYRUN/223", "anchors_rows": n_rows, "anchors_source": anchors_path or "shipped starter + anchors_188",
               "writes": False, "results": out}, open(sys.argv[1], "w"), indent=1, ensure_ascii=False)
    for r in out:
        s = r["subject"]
        print("==", r["question"], "|", r["verdict"], "| if-filed-by-meaning", r["advisory_if_filed_by_meaning"], "| sense", s["state"], s["sense"], "| loop", r["loop_phi"], r["loop_from"], "| claim", r["claim"], "| hosts", r["hosts"])
        if r["ask"]:
            print("   ASK:", r["ask"][:300])
        for x in r["sources"]:
            if x["status"] == "FETCHED":
                m = x.get("meaning") or {}
                print("   %-15s %-10s ph %s Phi %s %s echo %s cat=%s on=%s other=%s | %s" % (x["source"], x["row_rule"], x["phase_int"], x["Phi"], x["band"], x["echo"], m.get("category"), m.get("on_chain"), m.get("other_meaning"), x["sentence"][:90]))
            elif x["status"] not in ("NO-ENTRY", "CROSSCHECK"):
                print("   %-15s %s %s" % (x["source"], x["status"], json.dumps(x.get("senses") or x.get("error") or "")[:140]))


if __name__ == "__main__":
    main()
