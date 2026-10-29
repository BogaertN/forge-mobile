"""Cold pass and two fill passes. Anchors are trusted. Wikipedia research is low trust."""
from __future__ import annotations

import json
from pathlib import Path

from rmc_engine_v1.rmc_core import run
from rmc_engine_v1.source_trust import trust_tier

ROOT = Path(__file__).resolve().parents[1]
QUESTIONS = json.loads((ROOT / "tools" / "dryrun_182_questions.json").read_text(encoding="utf-8"))["questions"]
SEED = json.loads((ROOT / "data" / "ask_183_memory.json").read_text(encoding="utf-8"))
ANCHORS = json.loads((ROOT / "data" / "anchors_187.json").read_text(encoding="utf-8"))["anchors"]
CACHE = ROOT / "data" / "ask_186_research.json"


def research_rows() -> dict[str, dict]:
    rows = json.loads(CACHE.read_text(encoding="utf-8"))["rows"]
    out = {}
    for row in rows:
        item = dict(row)
        item["trust"] = "low" if trust_tier(item) == "low" or "wikipedia" in str(item.get("url") or "").lower() else trust_tier(item)
        item["quarantined"] = True
        item["premise"] = False
        out[item.get("question") or ""] = item
    return out


def anchor_rows() -> list[dict]:
    rows = []
    for row in ANCHORS:
        rows.append({
            "id": row["id"],
            "text": row["text"],
            "sfe": row["sfe"],
            "packet": row["packet"],
            "tier": "anchor",
            "state": "anchor",
            "trust": "trusted",
            "provenance": row["provenance"],
            "contributor": row["contributor"],
            "license": row["license"],
            "source_url": row["source_url"],
            "revision": row["revision"],
        })
    return rows


def one(question: str, memory: dict) -> dict:
    row = run({"question": question, "live": True, "memory": memory})
    comp = row.get("coherence_components") or {}
    echo = row.get("echo") or {}
    cur = (row.get("quarantine_curation") or [{}])[0]
    return {
        "question": question,
        "route": row.get("route"),
        "C": row.get("coherence"),
        "memory_fit": comp.get("memory_fit"),
        "drift": row.get("drift"),
        "echo": echo.get("score"),
        "echo_pass": echo.get("pass"),
        "admitted": bool(row.get("product_reply")),
        "reply": row.get("reply"),
        "calls_llm": row.get("calls_llm"),
        "anchor": cur.get("rule"),
        "trust": (row.get("trust") or {}).get("rule"),
        "premise": cur.get("premise"),
    }


def main() -> None:
    research = research_rows()
    anchors = anchor_rows()
    extra: list[dict] = []
    seen: set[str] = set()
    passes = []
    for n in range(3):
        rows = []
        admitted = 0
        for topic, question in QUESTIONS:
            memory = json.loads(json.dumps(SEED))
            memory["hosted"] = list(memory.get("hosted") or []) + extra
            memory["anchors"] = anchors
            web = research.get(question) or {}
            if web.get("text"):
                memory["research"] = [{
                    "id": "web-" + question[:24],
                    "text": web["text"],
                    "url": web.get("url") or "",
                    "source": "wikipedia",
                    "trust": "low",
                    "quarantined": True,
                    "premise": False,
                }]
            item = one(question, memory)
            item["topic"] = topic
            item["n"] = len(rows) + 1
            rows.append(item)
            if item["admitted"]:
                admitted += 1
                text = item["reply"]
                already = {str(row.get("text") or "") for row in (memory.get("hosted") or [])}
                already.update(str(row.get("text") or "") for row in anchors)
                if text and text not in seen and text not in already:
                    seen.add(text)
                    extra.append({
                        "id": "admit-" + str(len(extra)),
                        "text": text,
                        "sfe": {"Phi": 9, "eps": item["drift"], "mu": 1},
                        "provenance": {"question": question, "contributor": "athena"},
                        "contributor": "athena",
                        "trust": "trusted",
                    })
        passes.append({
            "pass": n,
            "name": "cold" if n == 0 else "pass " + str(n + 1),
            "admitted": admitted,
            "held": len(rows) - admitted,
            "echo_pass": sum(1 for r in rows if r["echo_pass"]),
            "routes": {
                "active_stack_candidate": sum(1 for r in rows if r["route"] == "active_stack_candidate"),
                "correction_queue": sum(1 for r in rows if r["route"] == "correction_queue"),
            },
            "C_min": min(r["C"] for r in rows),
            "C_max": max(r["C"] for r in rows),
            "rows": rows,
        })
        print(passes[-1]["name"], "admitted", admitted, "echo", passes[-1]["echo_pass"], flush=True)
    out = ROOT / "tools" / "live_187_results.json"
    out.write_text(json.dumps({"passes": passes}, ensure_ascii=False), encoding="utf-8")
    print("wrote", out)


if __name__ == "__main__":
    main()
