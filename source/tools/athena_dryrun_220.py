"""4.9.220 Athena dry-run: real gaps, real sources, no writes. For each gap question Athena fetches sources
(self_seed_202.fetch_documents: LOC first, Wikipedia only as a pointer), runs the unchanged self-seed decision, and
shows the phase and band she would store with each kept sentence and whether the fact would pass the DRIFT-SPEC/v1
write gates (eps_s <= 0.35, Echo >= 0.97 for memory writes, C >= 0.87, sourced, >= 2 independent hosts).
Nothing is written anywhere. usage: python3 tools/athena_dryrun_220.py out.json [--anchors=kb_export.json] "Q1" "Q2" ...
4.9.221: the gap is computed from the anchors already held (ALREADY-ANCHORED questions are skipped), never forced."""
import json, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "engine"))
from rmc_engine_v1 import self_seed_202 as ss
from rmc_engine_v1.band_tuning import place

ECHO_MEMORY_MIN = 0.97
# 4.9.221: the gap is computed, not forced. A question whose concepts already have an anchor (the shipped starter and
# anchors_188 shards, or --anchors <kb export>) is not a gap and is skipped (e.g. Burkina Faso, enc-cia-uv-0).
from rmc_engine_v1 import resonance_recall as rr
ROOT = os.path.join(os.path.dirname(__file__), "..")


def anchored_concepts(path=None):
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
    return found


def gap_of(question, anchored):
    concepts = rr.question_concepts(question, set(anchored))
    have = sorted(c for c in concepts if c in anchored)
    return (not have), {c: anchored[c] for c in have}


args = sys.argv[2:]
anchors_path = None
if args and args[0].startswith("--anchors="):
    anchors_path = args.pop(0).split("=", 1)[1]
ANCHORED = anchored_concepts(anchors_path)
out = []
for q in args:
    import time
    gap, have = gap_of(q, ANCHORED)
    if not gap:
        out.append({"question": q, "rule": "ALREADY-ANCHORED", "gap": False, "anchored": have, "docs": [], "kept": [], "refused_placed": [],
                    "anchor": None, "writes": False, "calls_llm": False})
        continue
    for attempt in range(4):  # the LOC search is flaky; a fetch error is retried, never treated as "no source"
        docs = ss.fetch_documents(q)
        if not any(d.get("role") == "error" for d in docs):
            break
        time.sleep(6)
    res = ss.evaluate({"question": q, "documents": docs, "gap": gap, "reset": True})
    found = ss._candidates(q, [d for d in docs if isinstance(d, dict)], ss.loop_phi(q))
    kept = []
    for row in found["kept"]:
        p = place(row["text"], row["phi"], {"concept": row.get("concept")})
        kept.append({"text": row["text"][:220], "host": row.get("host"), "url": row.get("url"), "phase_int": row["phi"], "Phi": p["Phi"],
                     "band": p["band"]["band"], "hz": p["band"]["hz"], "echo": row.get("echo"), "echo_pass": row.get("echo_pass"),
                     "delta": row.get("delta"), "claim": bool(row.get("claim"))})
    refused = []
    for row in found["skipped"]:
        if row.get("text"):
            sp = ss.sentence_placement(row["text"])
            if sp.get("phi"):
                p = place(row["text"], sp["phi"], {"concept": sp.get("concept")})
                refused.append({"text": row["text"][:220], "url": row.get("url"), "refused": row.get("rule"), "phase_int": sp["phi"],
                                "concept": sp.get("concept"), "Phi": p["Phi"], "band": p["band"]["band"], "hz": p["band"]["hz"]})
    a = res.get("anchor")
    verdict = None
    if a:
        prov = a["provenance"]; pk = a["packet"]
        echo = float(prov.get("echo") or 0)
        verdict = {"text": a["text"], "Phi": pk["placement"]["Phi"], "band": pk["band"]["band"], "hz": pk["band"]["hz"],
                   "hosts": prov.get("independent_hosts"), "source_url": a.get("source_url"), "echo": echo,
                   "self_seed_candidate": True, "memory_write_echo_ok": echo >= ECHO_MEMORY_MIN,
                   "would_admit": echo >= ECHO_MEMORY_MIN}
    out.append({"question": q, "rule": res.get("rule"), "gap": gap, "loop_phi": res.get("loop_phi"), "docs": [(d.get("role"), d.get("url")) for d in docs],
                "skipped": [s.get("rule") for s in found["skipped"]][:20], "kept": kept, "refused_placed": refused, "anchor": verdict, "writes": False, "calls_llm": False})
json.dump(out, open(sys.argv[1], "w"), indent=1)
for r in out:
    print(r["question"], "|", r["rule"], "| gap", r.get("gap"), "| kept", len(r["kept"]), "| docs", len(r["docs"]), "| anchor", json.dumps(r["anchor"])[:300])
    for k in r["refused_placed"][:3]: print("    refused", k["refused"], k["phase_int"], k["Phi"], k["band"], k["hz"], "|", k["text"][:100])
    for k in r["kept"][:4]: print("   ", k["phase_int"], k["Phi"], k["band"], k["hz"], "echo", k["echo"], k["echo_pass"], "|", k["text"][:110])
