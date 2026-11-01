"""Honest cold 60, recorded per release (4.9.209 on). Recorded only, never tuned.

Memory per question: empty phone, hosted and receipt stores; the shipped starter anchors plus the trusted
anchors selected by concept; the cached Wikipedia excerpt only as quarantined, low-trust research (never a
premise). Same questions and same memory as tools/cold_207.py.
usage: python3 tools/cold60.py 4.9.209 "what changed in the engine"
Writes data/cold_<release>_results.json and docs/LIVE_TEST_<nnn>.md. No network. No LLM.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine"))
sys.path.insert(0, str(ROOT))

from tools.audit_204 import run_cold  # noqa: E402

KEYS = ("n", "topic", "question", "admitted", "reply", "drift", "coherence", "echo", "trust", "premise", "calls_llm")


def main() -> None:
    release, note = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "")
    tag = release.split(".")[-1]
    out = run_cold()
    rows = [{k: row.get(k) for k in KEYS if k in row} for row in out["rows"]]
    prev = json.loads((ROOT / "data" / "cold_207_results.json").read_text(encoding="utf-8"))
    body = {
        "schema": "FORGE-COLD60/v1",
        "release": release,
        "memory": "starter anchors + trusted anchors by concept; phone/hosted/receipts empty; Wikipedia quarantined",
        "engine_change": note,
        "tuned": False,
        "previous": {"release": prev["release"], "admitted": prev["admitted"], "of": prev["of"]},
        "admitted": out["admitted"], "held": out["held"], "false_admits": out["false_admits"], "of": len(rows),
        "calls_llm": False, "rows": rows,
    }
    (ROOT / "data" / f"cold_{tag}_results.json").write_text(json.dumps(body, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    old = {r["question"]: r for r in prev["rows"]}
    lines = [
        f"# Cold 60 — {release} (recorded only, not tuned)",
        "",
        f"Admitted {out['admitted']} of {len(rows)}. Held {out['held']}. False admits (LLM or Wikipedia premise) {out['false_admits']}.",
        f"Previous recorded: {prev['release']} {prev['admitted']}/{prev['of']}.",
        "",
        f"Engine change: {note}",
        "",
        "An admitted line passed drift, coherence and Echo; it is not necessarily a good answer.",
        "",
        "| # | question | result | reply | vs 4.9.207 |",
        "|---|---|---|---|---|",
    ]
    for row in rows:
        reply = (row.get("reply") or "").replace("|", "\\|")
        was = old.get(row["question"]) or {}
        delta = "same" if bool(was.get("admitted")) == bool(row.get("admitted")) and was.get("reply") == row.get("reply") else ("was held" if not was.get("admitted") else ("now held" if not row.get("admitted") else "different reply"))
        lines.append(f"| {row.get('n')} | {row.get('question')} | {'admitted' if row.get('admitted') else 'held'} | {reply} | {delta} |")
    (ROOT.parent / "docs" / f"LIVE_TEST_{tag}.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"admitted": out["admitted"], "held": out["held"], "false_admits": out["false_admits"], "of": len(rows)}))


if __name__ == "__main__":
    main()
