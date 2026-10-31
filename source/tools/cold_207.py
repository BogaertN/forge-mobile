"""Honest cold 60 for 4.9.207 (Nic decision (a)): the ask_183 test answers are deleted.

Memory per question: empty phone, hosted and receipt stores; the shipped starter anchors plus the trusted
anchors selected by concept; the cached Wikipedia excerpt only as quarantined, low-trust research (never a
premise). Nothing is tuned to recover the old 48/60, which used the deleted answers as premises.
Writes data/cold_207_results.json and docs/LIVE_TEST_207.md. No network. No LLM.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine"))
sys.path.insert(0, str(ROOT))

from tools.audit_204 import run_cold  # noqa: E402


def main() -> None:
    out = run_cold()
    rows = [{k: row.get(k) for k in ("n", "topic", "question", "admitted", "reply", "drift", "coherence", "echo", "trust", "premise", "calls_llm") if k in row} for row in out["rows"]]
    body = {
        "schema": "FORGE-COLD60/v1",
        "release": "4.9.207",
        "memory": "starter anchors + trusted anchors by concept; phone/hosted/receipts empty; Wikipedia quarantined",
        "ask_183_seed": "deleted",
        "previous_claim": {"admitted": 48, "of": 60, "note": "used the deleted hand-written ask_183 answers as premises"},
        "admitted": out["admitted"], "held": out["held"], "false_admits": out["false_admits"], "of": len(rows),
        "calls_llm": False, "rows": rows,
    }
    (ROOT / "data" / "cold_207_results.json").write_text(json.dumps(body, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    lines = [
        "# Cold 60 — 4.9.207 (test answers deleted)",
        "",
        f"Admitted {out['admitted']} of {len(rows)}. Held {out['held']}. False admits (LLM or Wikipedia premise) {out['false_admits']}.",
        "",
        "The earlier 48/60 (4.9.188 to 4.9.206) used the hand-written `data/ask_183_memory.json` rows as premises. Those rows are deleted.",
        "Nothing was tuned to recover the score. An admitted line below passed drift, coherence and Echo; it is not necessarily a good answer.",
        "",
        "| # | question | result | reply |",
        "|---|---|---|---|",
    ]
    for row in rows:
        reply = (row.get("reply") or "").replace("|", "\\|")
        lines.append(f"| {row.get('n')} | {row.get('question')} | {'admitted' if row.get('admitted') else 'held'} | {reply} |")
    (ROOT.parent / "docs" / "LIVE_TEST_207.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"admitted": out["admitted"], "held": out["held"], "false_admits": out["false_admits"], "of": len(rows)}))


if __name__ == "__main__":
    main()
