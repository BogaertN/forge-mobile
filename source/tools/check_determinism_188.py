"""Receipt order and memory ids must not change the derived sentence.

Echo on held questions flickered between passes because receipt files were
read newest-mtime-first (ties follow directory order) and memory ids hashed
the absolute temp path. Two runs of the same memory must agree.
"""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

from rmc_engine_v1.memory_recaller import _iter_json_files, _node_from_receipt
from rmc_engine_v1.rmc_core import run

ROOT = Path(__file__).resolve().parents[1]
HELD = (
    "Why is the sky blue?",
    "What is helium?",
    "When was the telephone invented?",
)


def _touch(path: Path, ns: int) -> None:
    os.utime(path, ns=(ns, ns))


def file_order() -> dict:
    with tempfile.TemporaryDirectory(prefix="rmc-order-a-") as a, tempfile.TemporaryDirectory(prefix="rmc-order-b-") as b:
        left, right = Path(a), Path(b)
        names = ["m0002.json", "m0000.json", "m0001.json"]
        for i, name in enumerate(names):
            body = json.dumps({"receipt_id": name, "text": "row " + name})
            (left / name).write_text(body, encoding="utf-8")
            (right / name).write_text(body, encoding="utf-8")
        # Newest mtime is m0002. A reverse-mtime walk would read it first.
        for base, newest in ((left, "m0002.json"), (right, "m0000.json")):
            for name in names:
                _touch(base / name, 1_700_000_000_000_000_000)
            _touch(base / newest, 1_700_000_000_000_000_000 + 5_000_000_000)
        order_a = [p.name for p in _iter_json_files(left)]
        order_b = [p.name for p in _iter_json_files(right)]
    return {"a": order_a, "b": order_b, "same": order_a == order_b == ["m0000.json", "m0001.json", "m0002.json"]}


def stable_ids() -> dict:
    payload = {"receipt_id": "enc-sky", "text": "The sky looks blue because air scatters blue light.", "content": "The sky looks blue because air scatters blue light."}
    ids = []
    with tempfile.TemporaryDirectory(prefix="rmc-id-a-") as a, tempfile.TemporaryDirectory(prefix="rmc-id-b-") as b:
        for folder in (Path(a), Path(b)):
            path = folder / "m0007.json"
            path.write_text(json.dumps(payload), encoding="utf-8")
            node = _node_from_receipt(path, folder, payload)
            ids.append(node["memory_id"])
            leaked = str(folder) in node["memory_id"]
    return {"ids": ids, "same": ids[0] == ids[1], "leaked": leaked}


def held_runs() -> dict:
    seed = json.loads((ROOT / "data" / "ask_183_memory.json").read_text(encoding="utf-8"))
    anchors = json.loads((ROOT / "data" / "anchors_187.json").read_text(encoding="utf-8"))["anchors"]
    research = {row.get("question"): row for row in json.loads((ROOT / "data" / "ask_186_research.json").read_text(encoding="utf-8"))["rows"]}
    anchor_rows = [{
        "id": row["id"], "text": row["text"], "sfe": row["sfe"], "packet": row["packet"],
        "tier": "anchor", "state": "anchor", "trust": "trusted",
        "provenance": row.get("provenance"), "contributor": row.get("contributor"),
        "license": row.get("license"), "source_url": row.get("source_url"), "revision": row.get("revision"),
    } for row in anchors]

    def once(question: str) -> dict:
        memory = json.loads(json.dumps(seed))
        memory["anchors"] = anchor_rows
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
        row = run({"question": question, "live": True, "memory": memory})
        echo = row.get("echo") or {}
        derived = str(((row.get("world_model") or {}).get("derived_text") or ""))
        return {
            "derived": derived,
            "echo": echo.get("score"),
            "echo_pass": echo.get("pass"),
            "C": row.get("coherence"),
            "route": row.get("route"),
            "reply": row.get("reply"),
        }

    rows = []
    stable = True
    for question in HELD:
        first = once(question)
        second = once(question)
        same = first == second
        stable = stable and same
        rows.append({"question": question, "same": same, "first": first, "second": second})
    return {"stable": stable, "rows": rows}


def main() -> None:
    report = {"files": file_order(), "ids": stable_ids(), "held": held_runs()}
    report["ok"] = bool(report["files"]["same"] and report["ids"]["same"] and not report["ids"]["leaked"] and report["held"]["stable"])
    print(json.dumps(report, ensure_ascii=False))
    raise SystemExit(0 if report["ok"] else 1)


if __name__ == "__main__":
    main()
