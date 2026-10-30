"""Cold pass and two fill passes for 4.9.195. The archive stage is on the trace and does not change the admit gate."""
from __future__ import annotations

import json
from pathlib import Path

from rmc_engine_v1.anchor_store import clear_cache
from rmc_engine_v1.memory_writer import bank_admitted
from rmc_engine_v1.rmc_core import run
from tools.live_188 import QUESTIONS, SEED, research_rows, shard_rows, starter_rows

ROOT = Path(__file__).resolve().parents[1]


def one(question: str, memory: dict) -> dict:
    row = run({"question": question, "live": True, "memory": memory})
    comp = row.get("coherence_components") or {}
    echo = row.get("echo") or {}
    cur = (row.get("quarantine_curation") or [{}])[0]
    bank = ((row.get("memory_write") or {}).get("bank") or {})
    lc = row.get("language_core") if isinstance(row.get("language_core"), dict) else {}
    dpa = ((row.get("engines") or {}).get("dpa_195") or {})
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
        "model_invoked": (lc.get("model_invoked") if lc else None) or row.get("model_invoked"),
        "anchor": cur.get("rule"),
        "trust": (row.get("trust") or {}).get("rule"),
        "premise": cur.get("premise"),
        "bank": bank.get("reason"),
        "speech_act": lc.get("speech_act"),
        "anchors_connected": lc.get("anchors_connected"),
        "gap": lc.get("gap"),
        "language_core": lc.get("function"),
        "claim": lc.get("claim"),
        "dpa_eligible": dpa.get("eligible"),
        "dpa_admit_gate": dpa.get("admit_gate"),
        "dpa_calls_llm": dpa.get("calls_llm"),
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
    keys = ("echo", "derived", "C", "admitted", "reply")
    flips = []
    cold = passes[0]["rows"]
    for row in cold:
        series = [next(r for r in p["rows"] if r["question"] == row["question"]) for p in passes]
        if len({tuple(r[k] for k in keys) for r in series}) != 1:
            flips.append(row["question"])
    gaps = [
        {"n": r["n"], "topic": r["topic"], "question": r["question"], "speech_act": r["speech_act"], "C": r["C"]}
        for r in cold if not r["admitted"] and r.get("gap")
    ]
    out = {"passes": passes, "flips": flips, "stable": not flips, "gaps": gaps, "calls_llm": any(r["calls_llm"] for p in passes for r in p["rows"])}
    dest = ROOT / "tools" / "live_195_results.json"
    dest.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print("stable", out["stable"], "gaps", len(gaps), "wrote", dest)


if __name__ == "__main__":
    main()
