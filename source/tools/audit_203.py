"""Cold 60 and the twelve held questions for 4.9.203. No network. No LLM."""
from __future__ import annotations

import json
from pathlib import Path

from rmc_engine_v1.anchor_store import clear_cache
from tools.live_188 import QUESTIONS, SEED, research_rows, shard_rows, starter_rows
from tools.live_201 import one

ROOT = Path(__file__).resolve().parents[1]
HELD = [
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


def main() -> None:
    clear_cache()
    research = research_rows()
    starter = starter_rows()
    rows = []
    for topic, question in QUESTIONS:
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
        item = one(question, memory)
        item["topic"] = topic
        item["n"] = len(rows) + 1
        rows.append(item)
        print(item["n"], "admit" if item["admitted"] else "held", question, flush=True)
    admitted = [row for row in rows if row["admitted"]]
    held = [row for row in rows if not row["admitted"]]
    false_admits = [
        row for row in admitted
        if row["calls_llm"] or (row.get("trust") == "wikipedia" and row.get("premise"))
    ]
    out = {
        "admitted": len(admitted),
        "held": len(held),
        "false_admits": len(false_admits),
        "calls_llm": any(row["calls_llm"] for row in rows),
        "rows": rows,
    }
    (ROOT / "tools" / "live_203_results.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    lines = [
        "# Admitted sentences on the cold 60 — 4.9.203",
        "",
        "This is the Ask path. Every admitted sentence is printed so a wrong answer is visible. Thresholds are unchanged. Frequency signatures do not admit.",
        "",
        "| n | question | C | Echo | sentence |",
        "|---:|---|---:|---:|---|",
    ]
    for row in admitted:
        sentence = str(row["reply"] or "").replace("|", "/")
        lines.append(f"| {row['n']} | {row['question']} | {row['C']} | {row['echo']} | {sentence} |")
    lines += [
        "",
        f"Admitted {len(admitted)} of {len(rows)}. Held {len(held)}. False admits {len(false_admits)}.",
        "",
        "## Held",
        "",
    ]
    for row in held:
        lines.append(f"- {row['question']} — Echo {row['echo']}, C {row['C']}")
    lines += ["", "## The twelve held questions", ""]
    by = {row["question"]: row for row in rows}
    for question in HELD:
        row = by[question]
        state = "admitted" if row["admitted"] else "held"
        lines.append(f"- {question} — {state}. Echo {row['echo']}, C {row['C']}.")
    (ROOT.parent / "docs" / "ADMIT_AUDIT_203.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("admitted", len(admitted), "held", len(held), "false", len(false_admits))


if __name__ == "__main__":
    main()
