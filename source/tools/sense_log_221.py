"""4.9.221: what the shadow sense trace logs, counted over the anchors and the cold 60 questions (advisory; nothing
is written to any store and no answer reads it). usage:
  python3 tools/sense_log_221.py <pack.json.gz> out.json [kb_anchor_export.json]
Without an export it reads the shipped anchors (data/anchors_187.json + data/anchors_188 shards)."""
from __future__ import annotations

import collections
import gzip
import json
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
sys.path.insert(0, os.path.join(ROOT, "tools"))
from sense_trace import trace  # noqa: E402


def shipped_anchors():
    rows = json.load(open(os.path.join(ROOT, "data", "anchors_187.json"), encoding="utf-8")).get("anchors", [])
    d = os.path.join(ROOT, "data", "anchors_188", "shards")
    for f in sorted(os.listdir(d)):
        rows += json.load(open(os.path.join(d, f), encoding="utf-8")).get("anchors", [])
    return rows


def main() -> None:
    pack = json.loads(gzip.open(sys.argv[1]).read())
    table = json.load(open(os.path.join(ROOT, "data", "concept_senses.json"), encoding="utf-8"))
    rows = json.load(open(sys.argv[3], encoding="utf-8")) if len(sys.argv) > 3 else shipped_anchors()
    concepts = table["concepts"]
    a = collections.Counter(); ask_words = collections.Counter()
    for r in rows:
        own = [c for c in (r.get("concepts") or [])]
        t = trace(r.get("text") or "", table, pack)
        c = t["counts"]
        a["anchors"] += 1
        a["own_concepts_all_pinned_with_sense"] += bool(own) and all((concepts.get(x) or {}).get("sense") for x in own)
        a["own_concepts_some_without_sense"] += bool(own) and not all((concepts.get(x) or {}).get("sense") for x in own)
        a["with_pinned_word"] += c["pinned"] > 0
        a["with_resolved_word"] += c["resolved"] > 0
        a["with_would_ask_word"] += c["would_ask"] > 0
        for k in ("pinned", "pinned_with_sense", "resolved", "would_ask"):
            a["words_" + k] += c[k]
        for e in t["entries"]:
            if e["state"] == "would_ask":
                ask_words[e["w"]] += 1
    cold = json.load(open(os.path.join(ROOT, "data", "cold_220_results.json"), encoding="utf-8"))["rows"]
    q = collections.Counter(); per_q = []
    for row in cold:
        t = trace(row["question"], table, pack)
        c = t["counts"]
        q["questions"] += 1
        q["with_pinned_meaning"] += c["pinned_with_sense"] > 0
        q["with_resolved_word"] += c["resolved"] > 0
        q["with_would_ask_word"] += c["would_ask"] > 0
        q["no_sense_word_at_all"] += (c["pinned"] + c["resolved"] + c["would_ask"]) == 0
        per_q.append({"question": row["question"], "admitted": bool(row.get("admitted")),
                      "pinned": [e["w"] for e in t["entries"] if e["state"] == "pinned"],
                      "resolved": [[e["w"], e["sense"], e["by"]] for e in t["entries"] if e["state"] == "resolved"],
                      "would_ask": [[e["w"], e["n"], e.get("lesk")] for e in t["entries"] if e["state"] == "would_ask"]})
    body = {"schema": "FORGE-SENSE-LOG/v1", "release": "4.9.221", "mode": "advisory", "answers_changed": 0,
            "table": table["counts"], "pack_lemmas": pack["count"], "anchors": dict(a), "questions": dict(q),
            "top_would_ask_words_in_anchors": ask_words.most_common(25), "per_question": per_q}
    json.dump(body, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps({k: body[k] for k in ("table", "pack_lemmas", "anchors", "questions")}, indent=1))
    print("top would_ask:", ask_words.most_common(12))


if __name__ == "__main__":
    main()
