"""Before and after for the twelve questions 4.9.202 held.

Pass 1 may fetch reference prose. Later passes replay the recorded documents.
The re-ask is rmc_core.run. A candidate the re-ask does not admit is quarantined.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from rmc_engine_v1.anchor_store import clear_cache
from rmc_engine_v1.rmc_core import run
from rmc_engine_v1.self_seed_203 import entity_phrase, evaluate, fetch_documents, reset_backoff
from tools.live_188 import SEED, research_rows, shard_rows, starter_rows

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "data" / "self_seed_203_fixtures.json"
DEMO = ROOT / "data" / "self_seed_203_demo.json"
RESULTS = ROOT / "tools" / "live_203_results.json"

QUESTIONS = [
    "Who was Ada Lovelace?",
    "When did the French Revolution begin?",
    "Who painted the Mona Lisa?",
    "What happens if you mix bleach and ammonia?",
    "What happened in the news today?",
    "Who was Marie Curie?",
    "Who wrote Hamlet?",
    "When was the telephone invented?",
    "What happens if you mix bleach and vinegar?",
    "Who was Cleopatra?",
    "When did World War II end?",
    "Blargh floople zig?",
]


def memory_for(question: str, research: dict, starter: list[dict]) -> dict:
    memory = json.loads(json.dumps(SEED))
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
    return memory


def snapshot(question: str, row: dict) -> dict:
    echo = row.get("echo") or {}
    lang = row.get("language_core") if isinstance(row.get("language_core"), dict) else {}
    return {
        "question": question,
        "admitted": bool(row.get("product_reply")),
        "reply": row.get("reply"),
        "C": row.get("coherence"),
        "drift": row.get("drift"),
        "echo": echo.get("score"),
        "echo_pass": echo.get("pass"),
        "gap": lang.get("gap"),
        "anchors_connected": lang.get("anchors_connected"),
        "route": row.get("route"),
        "calls_llm": row.get("calls_llm"),
    }


def keep_doc(doc: dict) -> dict:
    return {key: doc.get(key) for key in (
        "url", "role", "text", "title", "own_entry", "period_year", "sha256",
        "fetch_sha256", "fetched_at", "license", "license_url", "error",
    ) if doc.get(key) not in (None, "")}


def main() -> None:
    network = "--network" in sys.argv
    clear_cache()
    research = research_rows()
    starter = starter_rows()
    fixtures = {"schema": "FORGE-SELF-SEED-FIXTURES/v203", "questions": {}}
    if FIXTURES.exists() and not network:
        fixtures = json.loads(FIXTURES.read_text(encoding="utf-8"))
    if network:
        for question in QUESTIONS:
            print("fetch", question, flush=True)
            docs = [keep_doc(doc) for doc in fetch_documents(question)]
            fixtures["questions"][question] = {
                "query": " ".join(entity_phrase(question)),
                "documents": docs,
            }
            print(" ", len(docs), "docs", flush=True)
        FIXTURES.write_text(json.dumps(fixtures, ensure_ascii=False), encoding="utf-8")
    passes = []
    for n in range(3):
        reset_backoff()
        rows = []
        for question in QUESTIONS:
            before = snapshot(question, run({"question": question, "live": True, "memory": memory_for(question, research, starter)}))
            docs = ((fixtures.get("questions") or {}).get(question) or {}).get("documents") or []
            usable = [doc for doc in docs if doc.get("role") != "error"]
            decision = evaluate({
                "question": question,
                "gap": before["gap"] is True and int(before["anchors_connected"] or 0) == 0,
                "anchors_connected": before["anchors_connected"] or 0,
                "documents": usable,
                "now": 1000 + n,
                "reset": False,
            })
            after = dict(before)
            if decision.get("anchor"):
                memory = memory_for(question, research, starter)
                memory["anchors"] = list(memory["anchors"]) + [decision["anchor"]]
                again = run({"question": question, "live": True, "memory": memory})
                reask = snapshot(question, again)
                if reask["admitted"]:
                    after = reask
                    decision = dict(decision)
                    decision["reask"] = "admitted"
                else:
                    decision = dict(decision)
                    decision["rule"] = "SEED-REASK"
                    decision["quarantined"] = True
                    decision["anchor_kept"] = False
                    decision["reask"] = "held"
                    after = reask
            prov = ((decision.get("anchor") or {}).get("provenance") or {}) if decision.get("reask") == "admitted" else {}
            rows.append({
                "question": question,
                "query": ((fixtures.get("questions") or {}).get(question) or {}).get("query"),
                "before": before,
                "after_admitted": bool(after.get("admitted")) and decision.get("reask") == "admitted",
                "reply": after.get("reply") if decision.get("reask") == "admitted" else None,
                "C": after.get("C"),
                "drift": after.get("drift"),
                "echo": after.get("echo"),
                "rule": decision.get("rule"),
                "tier": decision.get("tier"),
                "hosts": decision.get("hosts"),
                "claim": decision.get("claim") if decision.get("reask") == "admitted" else None,
                "skip_rules": (decision.get("trace") or {}).get("skip_rules"),
                "wikipedia_anchor": decision.get("wikipedia_anchor"),
                "calls_llm": decision.get("calls_llm") or before.get("calls_llm"),
                "anchor_text": ((decision.get("anchor") or {}).get("text") if decision.get("reask") == "admitted" else None),
                "source_url": prov.get("source_url"),
                "license": prov.get("license"),
                "fetched_at": prov.get("fetched_at"),
                "content_sha256": prov.get("content_sha256"),
                "period_year": prov.get("period_year"),
                "stale": prov.get("stale"),
                "sources": prov.get("independent_hosts"),
            })
            print(n, question, rows[-1]["rule"], "after", rows[-1]["after_admitted"], flush=True)
        admitted = sum(1 for row in rows if row["after_admitted"])
        passes.append({"pass": n, "admitted": admitted, "held": len(rows) - admitted, "rows": rows})
    keys = ("rule", "after_admitted", "reply", "echo")
    flips = []
    for row in passes[0]["rows"]:
        series = [next(item for item in p["rows"] if item["question"] == row["question"]) for p in passes]
        if len({tuple(item[k] for k in keys) for item in series}) != 1:
            flips.append(row["question"])
    out = {
        "passes": passes,
        "stable": not flips,
        "flips": flips,
        "calls_llm": False,
        "network_recorded": network,
        "before_admitted": sum(1 for row in passes[0]["rows"] if row["before"]["admitted"]),
        "after_admitted": passes[0]["admitted"],
    }
    RESULTS.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    demo = {"schema": "FORGE-SELF-SEED-DEMO/v203", "questions": {}}
    for row in passes[0]["rows"]:
        docs = ((fixtures.get("questions") or {}).get(row["question"]) or {}).get("documents") or []
        demo["questions"][row["question"]] = {
            "query": row.get("query"),
            "documents": [doc for doc in docs if doc.get("role") != "error"],
            "rule": row["rule"],
            "reask": {"admitted": row["after_admitted"], "echo": row["echo"], "reply": row["reply"]},
        }
    DEMO.write_text(json.dumps(demo, ensure_ascii=False), encoding="utf-8")
    print("before", out["before_admitted"], "after", out["after_admitted"], "stable", out["stable"], flush=True)


if __name__ == "__main__":
    main()
