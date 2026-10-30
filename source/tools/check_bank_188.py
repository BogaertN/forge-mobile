"""Storing an already-banked sentence must not drop a longer derived chain."""
from __future__ import annotations

import json
from pathlib import Path

from rmc_engine_v1.memory_writer import bank_admitted
from rmc_engine_v1.rmc_core import run
from rmc_engine_v1.world_model_v1 import derive, empty_world, observe, seed_self_facts

ROOT = Path(__file__).resolve().parents[1]


def writer_cases() -> dict:
    memory = {
        "phone": [{"id": "ph-proto", "text": "ProtoForge is the local symbolic runtime. Forge Mobile is this phone app."}],
        "hosted": [{
            "id": "ho-quartz",
            "text": "Quartz is a mineral. A mineral is a solid substance.",
            "provenance": {"question": "What is quartz?"},
        }],
        "receipts": [],
        "anchors": [],
    }
    same = bank_admitted(memory, {"text": "ProtoForge is the local symbolic runtime. Forge Mobile is this phone app.", "provenance": {"question": "What is protoforge?"}})
    shorter = bank_admitted(memory, {"text": "Quartz is a mineral.", "provenance": {"question": "What is quartz?"}})
    other_q = bank_admitted(memory, {"text": "Quartz is a mineral.", "provenance": {"question": "What is a rock?"}})
    longer = bank_admitted(memory, {
        "id": "ho-quartz-2",
        "text": "Quartz is a mineral. A mineral is a solid substance. A solid substance has a fixed shape.",
        "provenance": {"question": "What is quartz?"},
    })
    fresh = bank_admitted(memory, {"text": "Helium is a light noble gas.", "provenance": {"question": "What is helium?"}})
    return {
        "same": same["reason"] == "already-banked" and same["written"] is False and same["kept"] == "ph-proto",
        "shorter": shorter["reason"] in ("already-banked", "question-keeps-derived") and shorter["written"] is False and shorter["kept"] == "ho-quartz",
        "contained": other_q["reason"] == "already-banked" and other_q["written"] is False,
        "longer": longer["written"] is True and longer["reason"] == "extended-derived" and longer["replace_id"] == "ho-quartz",
        "fresh": fresh["written"] is True and fresh["reason"] == "banked",
        "detail": {"same": same, "shorter": shorter, "other": other_q, "longer": longer, "fresh": fresh},
    }


def observe_keeps_chain() -> dict:
    base, _trace = seed_self_facts(empty_world())
    fillers = [{"id": f"f{i}", "text": f"Sample {i} is a filler item {i}."} for i in range(87)]
    dup = {"id": "f0-again", "text": "Sample 0 is a filler item 0."}
    chain = [
        {"id": "q1", "text": "Quartz is a mineral."},
        {"id": "q2", "text": "A mineral is a solid substance."},
    ]
    world, trace = observe(base, fillers + [dup] + chain)
    derived = derive(world, "What is quartz?")
    text = str(derived.get("derived_text") or "")
    copies = sum(1 for fact in world.get("facts") or [] if str(fact.get("text") or "").startswith("Sample 0 is a filler"))
    return {
        "kept": "Quartz is a solid substance." in text,
        "idempotent": copies == 1,
        "copies": copies,
        "derived": text,
        "facts": len(world.get("facts") or []),
        "ops": [row.get("op") for row in (trace.get("revisions") or []) if row.get("op") == "idempotent"][:4],
    }


def second_store_keeps_text() -> dict:
    seed = json.loads((ROOT / "data" / "ask_183_memory.json").read_text(encoding="utf-8"))
    anchors = json.loads((ROOT / "data" / "anchors_187.json").read_text(encoding="utf-8"))["anchors"]
    question = "What is photosynthesis?"
    memory = json.loads(json.dumps(seed))
    memory["anchors"] = [{
        "id": row["id"], "text": row["text"], "sfe": row["sfe"], "packet": row.get("packet"),
        "tier": "anchor", "state": "anchor", "trust": "trusted",
        "provenance": row.get("provenance"), "contributor": row.get("contributor"),
        "license": row.get("license"), "source_url": row.get("source_url"), "revision": row.get("revision"),
    } for row in anchors]
    first = run({"question": question, "live": True, "memory": json.loads(json.dumps(memory))})
    reply = first.get("reply")
    derived = str(((first.get("world_model") or {}).get("derived_text") or ""))
    if not first.get("product_reply") or not reply:
        return {"ok": False, "why": "photosynthesis did not admit", "derived": derived}
    again = json.loads(json.dumps(memory))
    again["hosted"] = list(again.get("hosted") or []) + [{
        "id": "dup-photo",
        "text": reply,
        "provenance": {"question": question},
        "contributor": "athena",
    }]
    second = run({"question": question, "live": True, "memory": again})
    bank = ((second.get("memory_write") or {}).get("bank") or {})
    derived2 = str(((second.get("world_model") or {}).get("derived_text") or ""))
    return {
        "ok": bank.get("written") is False and derived2 == derived and "Photosynthesis" in derived2,
        "bank": bank.get("reason"),
        "written": bank.get("written"),
        "derived": derived,
        "derived2": derived2,
        "same": derived2 == derived,
    }


def main() -> None:
    writer = writer_cases()
    chain = observe_keeps_chain()
    second = second_store_keeps_text()
    ok = all(writer[k] for k in ("same", "shorter", "contained", "longer", "fresh")) and chain["kept"] and chain["idempotent"] and second["ok"]
    print(json.dumps({"ok": ok, "writer": {k: writer[k] for k in writer if k != "detail"}, "detail": writer["detail"], "chain": chain, "second": second}, ensure_ascii=False))
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()
