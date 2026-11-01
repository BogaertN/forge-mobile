"""4.9.210 checks used by verify/r4210_suite.js (Release A2). Real engine, no network, no LLM. Prints one JSON line."""
from __future__ import annotations

import glob
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine"))
sys.path.insert(0, str(ROOT))

from tools.live_188 import SEED, anchor_pool, starter_rows  # noqa: E402
from rmc_engine_v1.echo_question import echo_against_question  # noqa: E402
from rmc_engine_v1.resonance_recall import compound_names, question_concepts, row_concepts  # noqa: E402
from rmc_engine_v1.rmc_core import run, shared_sourced  # noqa: E402

POOL = anchor_pool()
PACKS = []
for f in sorted(glob.glob(str(ROOT / "packs" / "confirmed_shared" / "[a-z].json"))):
    for r in json.loads(Path(f).read_text(encoding="utf-8"))["items"]:
        PACKS.append({"id": r["id"], "text": r["text"][:400], "tier": "confirmed_shared", "contributor": "product_curator"})


def ask(q: str, packs: bool = True) -> dict:
    mem = json.loads(json.dumps(SEED))
    mem["anchors"] = starter_rows()
    mem["pools"] = [{"name": "anchors", "into": "anchors", "rows": POOL}] + ([{"name": "confirmed_shared", "into": "hosted", "rows": PACKS}] if packs else [])
    r = run({"question": q, "live": True, "memory": mem})
    pre = r.get("preselect") or {}
    return {"reply": r.get("reply"), "product_reply": bool(r.get("product_reply")), "echo": r.get("echo"),
            "q_concepts": pre.get("question_concepts"), "anchors_kept": (pre.get("pools") or [{}])[0].get("kept"),
            "rests_on": ((r.get("trust") or {}).get("rests_on")), "trust": (r.get("trust") or {}).get("rule")}


def personal(q: str) -> dict:
    r = run({"question": q, "live": True, "memory": {"phone": [{"id": "rem-1", "text": "My car is red."}], "hosted": [], "receipts": [], "anchors": [], "research": []}})
    return {"reply": r.get("reply"), "echo": (r.get("echo") or {}).get("score")}


def main() -> None:
    out = {"pool": len(POOL), "packs": len(PACKS)}
    for key, q in (("moon", "What is the Moon?"), ("burkina", "What is the capital of Burkina Faso?"), ("bosnia", "What is the capital of Bosnia and Herzegovina?"),
                   ("antigua", "What is the capital of Antigua and Barbuda?"), ("japan", "What is the capital of Japan?"), ("gravity", "What is gravity?"),
                   ("ocean", "Why is the ocean salty?"), ("hamlet", "Who wrote Hamlet?")):
        out[key] = ask(q)
    out["moon_jae_in"] = sorted(row_concepts({"text": "In 2016, the National Assembly passed an impeachment motion against PARK, won by MOON Jae-in."}))
    out["moon_plain"] = sorted(row_concepts({"text": "The Moon, on the other hand, moves completely around Earth in that time."}))
    out["names"] = compound_names("Ouagadougou is the capital of Burkina Faso, and Sarajevo of Bosnia and Herzegovina; MOON Jae-in won.")
    out["q_compound"] = sorted(question_concepts("what is the capital of burkina faso", {"A.BURKINAFASO", "A.FASO"}))
    out["sourced"] = {"pack": shared_sourced({"tier": "confirmed_shared", "text": "x"}), "url": shared_sourced({"tier": "confirmed_shared", "source_url": "https://www.nasa.gov/"}),
                      "trace": shared_sourced({"tier": "confirmed_shared", "provenance": {"trust": {"rests_on": "enc-nasa-sky-eyes", "blocks_admit": False}}}),
                      "blocked": shared_sourced({"tier": "confirmed_shared", "provenance": {"trust": {"rests_on": "x", "blocks_admit": True}}}),
                      "anchor": shared_sourced({"tier": "anchor"}), "mine": shared_sourced({"text": "My car is red."})}
    out["car"] = {q: personal(q) for q in ("What color is my car?", "What colour is my car?", "Is my car red?", "Is my car blue?", "Why is my car red?")}
    out["echo"] = {
        "salty_quality": echo_against_question("Why is the ocean salty?", "One of the most well known qualities of the ocean is that it is salty.", rendered=True),
        "salty_cause": echo_against_question("Why is the ocean salty?", "Salt in the ocean comes from two sources: runoff from the land and openings in the seafloor.", rendered=True),
        "sky": echo_against_question("Why is the sky blue?", "Even though violet is scattered more than blue, the sky looks blue to us because our eyes are more sensitive to blue light.", rendered=True),
        "color_wrong_slot": echo_against_question("Is my car green?", "My car is red.", rendered=True),
    }
    print(json.dumps(out, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
