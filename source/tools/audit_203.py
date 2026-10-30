"""Cold 60 admit audit for 4.9.203. No self-seed. No model."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from rmc_engine_v1.anchor_store import clear_cache
from rmc_engine_v1.rmc_core import run
from tools.live_188 import QUESTIONS, SEED, research_rows, shard_rows, starter_rows

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent / "docs" / "ADMIT_AUDIT_203.md"
CHAT = ROOT / "data" / "chat_act_203.json"


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


def main() -> None:
    clear_cache()
    research = research_rows()
    starter = starter_rows()
    admitted = []
    held = []
    acts = []
    lines = [
        "# Admitted sentences on the cold 60 — 4.9.203",
        "",
        "This is the Ask path without self-seeding. Every admitted sentence is printed so a wrong answer is visible. Thresholds are unchanged.",
        "",
        "| n | question | C | Echo | sentence |",
        "|---:|---|---:|---:|---|",
    ]
    for n, (_topic, question) in enumerate(QUESTIONS, start=1):
        row = run({"question": question, "live": True, "memory": memory_for(question, research, starter)})
        echo = (row.get("echo") or {}).get("score")
        coherence = row.get("coherence")
        reply = row.get("reply")
        act = ((row.get("language_core") or {}).get("speech_act"))
        if row.get("product_reply") and reply:
            admitted.append(question)
            lines.append(f"| {n} | {question} | {coherence} | {echo} | {reply} |")
        else:
            held.append((question, echo, coherence))
        if question in {"How are you?", "What can you do?"}:
            acts.append({"question": question, "reply": reply, "admitted": bool(row.get("product_reply")), "speech_act": act, "C": coherence, "echo": echo})
        print(n, question, "ADMIT" if row.get("product_reply") else "HOLD", flush=True)
    lines += ["", f"Admitted {len(admitted)} of 60. Held {len(held)}.", "", "## Held", ""]
    for question, echo, coherence in held:
        lines.append(f"- {question} — Echo {echo}, C {coherence}")
    lines.append("")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    CHAT.write_text(json.dumps({"schema": "FORGE-CHAT-ACT/v203", "acts": acts}, indent=1) + "\n", encoding="utf-8")
    print("wrote", OUT, "admitted", len(admitted), flush=True)


if __name__ == "__main__":
    main()
