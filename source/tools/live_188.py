"""Cold pass and two fill passes. Shards load by concept. The writer is idempotent."""
from __future__ import annotations

import json
from pathlib import Path

from rmc_engine_v1.anchor_store import clear_cache, select_anchors
from rmc_engine_v1.memory_writer import bank_admitted
from rmc_engine_v1.rmc_core import run
from rmc_engine_v1.source_trust import trust_tier

ROOT = Path(__file__).resolve().parents[1]
QUESTIONS = json.loads((ROOT / "tools" / "dryrun_182_questions.json").read_text(encoding="utf-8"))["questions"]
SEED = json.loads((ROOT / "data" / "ask_183_memory.json").read_text(encoding="utf-8"))
STARTER = json.loads((ROOT / "data" / "anchors_187.json").read_text(encoding="utf-8"))["anchors"]
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


def starter_rows() -> list[dict]:
    rows = []
    for row in STARTER:
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


def shard_rows(question: str) -> list[dict]:
    rows = []
    for row in select_anchors(question):
        rows.append({
            "id": row["id"],
            "text": row["text"],
            "sfe": row.get("sfe"),
            "packet": row.get("packet"),
            "tier": "anchor",
            "state": "anchor",
            "trust": "trusted",
            "provenance": row.get("provenance"),
            "contributor": row.get("contributor"),
            "license": row.get("license"),
            "source_url": row.get("source_url"),
            "revision": row.get("revision"),
        })
    return rows


def one(question: str, memory: dict) -> dict:
    row = run({"question": question, "live": True, "memory": memory})
    comp = row.get("coherence_components") or {}
    echo = row.get("echo") or {}
    cur = (row.get("quarantine_curation") or [{}])[0]
    bank = ((row.get("memory_write") or {}).get("bank") or {})
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
        "derived": str(((row.get("world_model") or {}).get("derived_text") or "")),
        "calls_llm": row.get("calls_llm"),
        "anchor": cur.get("rule"),
        "trust": (row.get("trust") or {}).get("rule"),
        "premise": cur.get("premise"),
        "bank": bank.get("reason"),
    }


def main() -> None:
    clear_cache()
    research = research_rows()
    starter = starter_rows()
    extra: list[dict] = []
    seen: set[str] = set()
    passes = []
    for n in range(3):
        rows = []
        admitted = 0
        for topic, question in QUESTIONS:
            memory = json.loads(json.dumps(SEED))
            memory["hosted"] = list(memory.get("hosted") or []) + extra
            memory["anchors"] = starter + shard_rows(question)
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
                if text:
                    row_body = {
                        "id": "admit-" + str(len(extra)),
                        "text": text,
                        "sfe": {"Phi": 9, "eps": item["drift"], "mu": 1},
                        "provenance": {"question": question, "contributor": "athena"},
                        "contributor": "athena",
                        "trust": "trusted",
                    }
                    session = {
                        "receipts": memory.get("receipts") or [],
                        "phone": memory.get("phone") or [],
                        "hosted": list(memory.get("hosted") or []) + extra,
                        "anchors": memory["anchors"],
                    }
                    bank = bank_admitted(session, row_body)
                    item["bank"] = bank["reason"]
                    if bank["written"] and text not in seen:
                        seen.add(text)
                        if bank.get("replace_id"):
                            extra = [row for row in extra if row.get("id") != bank["replace_id"]]
                        extra.append(row_body)
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
            "banked": len(extra),
            "rows": rows,
        })
        print(passes[-1]["name"], "admitted", admitted, "echo", passes[-1]["echo_pass"], "bank", len(extra), flush=True)
    # Echo on the three held questions must not move across passes.
    held = ("Why is the sky blue?", "What is helium?", "When was the telephone invented?")
    flips = []
    for question in held:
        series = [next(r for r in p["rows"] if r["question"] == question) for p in passes]
        if len({(r["echo"], r["derived"], r["C"]) for r in series}) != 1:
            flips.append(question)
    out = {
        "passes": passes,
        "flips": flips,
        "stable": not flips,
    }
    dest = ROOT / "tools" / "live_188_results.json"
    dest.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print("stable", out["stable"], "wrote", dest)


if __name__ == "__main__":
    main()
