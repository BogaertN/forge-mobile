"""4.9.222 Athena dry-run over the Tier-A fetchers. No writes anywhere, no model, no embeddings.

For each question: the gap is computed from the anchors held (a kb.anchors export with --anchors=, else the shipped
starter + anchors_188 shards); the meaning is checked (shadow sense trace + the OEWN fetcher: a word with two or more
meanings and no pin is ASK, never guessed); every enabled source is fetched on its own; the unchanged self-seed decision
(self_seed_202.evaluate: allowlist, PHASE, SHAPE, Echo, DISAGREEMENT, two independent hosts) runs on the documents.
Per source the table shows the chosen sentence, its phase and band (band_tuning.place), Echo and admit/refuse.
A 'genus' column is advisory only (logged, decides nothing): the head noun of each definition, to show what a
meaning+category agreement rule (4.9.223) would see.
usage: FORGE_OEWN_DIR=<oewn 2025 plus json dir> python3 tools/athena_dryrun_222.py out.json [--anchors=kb.json] [--pack=pack.json.gz] "Q1" ..."""
import gzip
import json
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, os.path.join(ROOT, "engine"))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from rmc_engine_v1 import self_seed_202 as ss  # noqa: E402
from rmc_engine_v1 import athena_sources_222 as A  # noqa: E402
from rmc_engine_v1 import resonance_recall as rr  # noqa: E402
from rmc_engine_v1.band_tuning import place  # noqa: E402
from sense_trace import trace  # noqa: E402

ECHO_MEMORY_MIN = 0.97
_CUT = {"of", "that", "which", "who", "in", "on", "with", "from", "for", "by", "consisting", "and", "or", "to", "at", "when", "where", "whose", "is", "at", "as", "than", "about", "into", "found", "used", "made", "known"}


def genus(sentence: str) -> str | None:
    """Advisory: last word of the predicate's first noun phrase ('the natural satellite of ...' -> 'satellite')."""
    cop = ss._copula(sentence)
    if not cop:
        return None
    words = re.findall(r"[A-Za-z][A-Za-z'-]*", cop[2].replace("\u2019", "'"))
    head = []
    if re.match(r"^\s*[-\d]", cop[2]):
        return None  # a value, not a category
    for w in words:
        lw = w.lower()
        if lw.endswith("'s") or lw in {"the", "a", "an", "only"}:
            continue  # a possessive or a determiner is never the head ("Earth's only natural satellite" -> satellite)
        if lw in _CUT or (head and re.search(r"(?:ed|ing|ly)$", lw)):
            break
        head.append(lw)
    return head[-1] if head else None


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


def main():
    args = sys.argv[2:]
    anchors_path = pack_path = None
    while args and args[0].startswith("--"):
        k, v = args.pop(0)[2:].split("=", 1)
        anchors_path = v if k == "anchors" else anchors_path
        pack_path = v if k == "pack" else pack_path
    anchored, n_rows = anchored_concepts(anchors_path)
    table = json.load(open(os.path.join(ROOT, "data", "concept_senses.json"), encoding="utf-8"))
    pack = json.loads(gzip.open(pack_path).read()) if pack_path else None
    pinned, pinned_qid = A.pins_from_table(table)
    out = []
    for q in args:
        concepts = rr.question_concepts(q, set(anchored))
        have = sorted(c for c in concepts if c in anchored)
        gap = not have
        st = trace(q, table, pack)
        asks = [e for e in st["entries"] if e.get("state") == "would_ask"]
        fetched = A.fetch_all(q, pinned=pinned, pinned_qid=pinned_qid)
        docs = fetched["documents"]
        loop = ss.loop_phi(q)
        res = ss.evaluate({"question": q, "documents": docs, "gap": True, "reset": True})
        found = ss._candidates(q, docs, loop)
        kept = {r["url"]: r for r in found["kept"]}
        skipped = {}
        for r in ss._candidates(q, docs, loop)["skipped"]:
            skipped.setdefault(r["url"], r)
        ambiguous = [sid for sid, v in fetched["per_source"].items() if v.get("status") == "AMBIGUOUS"]
        rows = []
        for sid, v in fetched["per_source"].items():
            row = {"source": sid, "status": v["status"]}
            if v.get("error"):
                row["error"] = v["error"]
            if v.get("senses"):
                row["senses"] = v["senses"]
            if v.get("crosscheck"):
                row["crosscheck"] = v["crosscheck"]
            for d in v.get("docs") or []:
                sp = ss.sentence_placement(d["text"])
                p = place(d["text"], sp["phi"], {"concept": sp.get("concept")}) if isinstance(sp.get("phi"), int) else None
                k = kept.get(d["url"])
                sk = skipped.get(d["url"])
                row.update({"url": d["url"], "sentence": d["text"], "verbatim": d["verbatim"] if d["verbatim"] != d["text"] else None,
                            "how": d["how"], "phase_int": sp.get("phi"), "concept": sp.get("concept"), "loop_phi": loop,
                            "Phi": p and p["Phi"], "band": p and p["band"]["band"], "hz": p and p["band"]["hz"],
                            "echo": k and k["echo"], "claim": k and k["claim"], "host": k and k["host"],
                            "row_rule": "KEPT" if k else (sk or {}).get("rule", "NO-SENTENCE"), "genus_advisory": genus(d["text"])})
            rows.append(row)
        verdict = res.get("rule")
        if not gap:
            verdict = "PINNED (already anchored: " + ", ".join(have) + "; not a gap, nothing considered)"
        elif asks or ambiguous:
            verdict = "ASK (more than one meaning: " + ", ".join([e["w"] for e in asks] + ambiguous) + ")"
        elif res.get("rule") == "SEED-CANDIDATE":
            echo = float(res.get("echo") or 0)
            verdict = ("WOULD ADMIT (not written)" if echo >= ECHO_MEMORY_MIN else "REFUSE memory write (Echo %.3f < 0.97)" % echo)
        else:
            verdict = "REFUSE " + str(res.get("rule"))
        gen, gen_all = {}, {}
        pubs = {sid: row["publisher"] for sid, row in A.source_rows().items()}
        for r in rows:
            if r.get("genus_advisory") and r.get("host"):
                gen.setdefault(r["genus_advisory"], set()).add(r["host"])
            if r.get("genus_advisory"):
                gen_all.setdefault(r["genus_advisory"], set()).add(pubs[r["source"]])
        out.append({"question": q, "gap": gap, "anchored": have, "loop_phi": loop, "sense_trace": st["counts"], "would_ask": [e["w"] for e in asks],
                    "evaluate_rule": res.get("rule"), "hosts": res.get("hosts"), "verdict": verdict, "sources": rows,
                    "genus_agreement_advisory": {g: sorted(h) for g, h in gen.items()},
                    "genus_publishers_any_phase_advisory": {g: sorted(h) for g, h in gen_all.items()}, "writes": False, "calls_llm": False})
    json.dump({"schema": "FORGE-ATHENA-DRYRUN/222", "anchors_rows": n_rows, "anchors_source": anchors_path or "shipped starter + anchors_188",
               "writes": False, "results": out}, open(sys.argv[1], "w"), indent=1, ensure_ascii=False)
    for r in out:
        print("==", r["question"], "|", r["verdict"])
        for s in r["sources"]:
            if s["status"] in ("FETCHED",):
                print("   %-15s %-10s phase %s/loop %s  Phi %s band %s  echo %s  %s | %s" % (s["source"], s["row_rule"], s["phase_int"], s["loop_phi"], s["Phi"], s["band"], s["echo"], s["genus_advisory"], s["sentence"][:90]))
            elif s["status"] not in ("NO-ENTRY",):
                print("   %-15s %s %s" % (s["source"], s["status"], json.dumps(s.get("senses") or s.get("crosscheck") or s.get("error") or "")[:140]))


if __name__ == "__main__":
    main()
