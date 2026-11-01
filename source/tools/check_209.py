"""4.9.209 checks used by verify/r4209_suite.js. Real engine, no network, no LLM. Prints one JSON line."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine"))
sys.path.insert(0, str(ROOT))

from tools.live_188 import SEED, shard_rows, starter_rows  # noqa: E402
from rmc_engine_v1 import memory_writer_hosted as mwh  # noqa: E402
from rmc_engine_v1 import rmc_core  # noqa: E402
from rmc_engine_v1.rmc_core import run  # noqa: E402

# The 12 rows the 4.9.208 phone actually sent as "confirmed shared" (the last 12 of the Z pack: unsourced, trust unknown).
Z = [["cs:c96298fa8d98f5b9", "batteries use zinc anodes"], ["cs:37432b01cea44854", "Shaka led Zulu armies"], ["cs:132109df8edb698d", "Zenith marks sky overhead"],
     ["cs:b6c1f64e77b8a0ac", "Zest flavors baked goods"], ["cs:fe9c39414130bdd9", "a zoonosis crosses species"], ["cs:ba1e2cdcc22501d2", "zero marks empty quantity"],
     ["cs:c736148ff089ff89", "Zoisite forms green crystals"], ["cs:040319a1bef5933d", "Zoning guides city land use"], ["cs:3fce4f522c48bd30", "Zucchini grows summer fruit"],
     ["cs:871ad563f81086f3", "Zirconia hardens dental crowns"], ["cs:e3874a081b775eea", "Zirconium coats reactor tubes"], ["cs:96e2bf695cd8da1f", "Zibeline softens fur coats"]]


def mem_for(question: str, z: bool = False) -> dict:
    mem = json.loads(json.dumps(SEED))
    mem["anchors"] = starter_rows() + shard_rows(question)
    if z:
        mem["hosted"] = [{"id": i, "text": t, "tier": "confirmed_shared", "contributor": "product_curator"} for i, t in Z]
    return mem


def brief(r: dict) -> dict:
    return {"reply": r.get("reply"), "product_reply": bool(r.get("product_reply")), "echo": (r.get("echo") or {}).get("score"),
            "fallback": r.get("fallback"), "memory_write": r.get("memory_write"), "trust": (r.get("trust") or {}).get("rule")}


def main() -> None:
    out = {}
    out["sky_z"] = brief(run({"question": "Why is the sky blue?", "live": True, "memory": mem_for("Why is the sky blue?", True)}))
    out["sky"] = brief(run({"question": "Why is the sky blue?", "live": True, "memory": mem_for("Why is the sky blue?")}))
    # the same 12 rows sent the 4.9.209 way: as a pool the engine selects from by resonance-packet concepts
    pmem = mem_for("Why is the sky blue?")
    pmem["pools"] = [{"name": "confirmed_shared", "into": "hosted", "rows": [{"id": i, "text": t, "tier": "confirmed_shared", "contributor": "product_curator"} for i, t in Z]}]
    pr = run({"question": "Why is the sky blue?", "live": True, "memory": pmem})
    out["sky_pool"] = dict(brief(pr), preselect=pr.get("preselect"))
    out["planet"] = brief(run({"question": "What is the largest planet?", "live": True, "memory": mem_for("What is the largest planet?")}))
    # a failing candidate with nothing behind it: held, the record says why, every try is listed
    out["alone"] = brief(run({"question": "What color is my car?", "live": True, "memory": {"phone": [{"id": "rem-1", "text": "My car is red."}], "hosted": [], "receipts": [], "anchors": [], "research": []}}))
    out["mine"] = brief(run({"question": "Is my car red?", "live": True, "memory": {"phone": [{"id": "rem-1", "text": "My car is red."}], "hosted": [], "receipts": [], "anchors": [], "research": []}}))
    # the fallback never drops research rows and never runs on a hard stop or a conflict
    out["eligible"] = {
        "hard": rmc_core._fallback_eligible({"live": True, "product_reply": False, "admit": {"hard_stop": True}}),
        "conflict": rmc_core._fallback_eligible({"live": True, "product_reply": False, "admit": {}, "world_model": {"derive": {"status": "conflicted"}}}),
        "spoken": rmc_core._fallback_eligible({"live": True, "product_reply": True}),
        "dry": rmc_core._fallback_eligible({"live": False, "product_reply": False}),
        "held": rmc_core._fallback_eligible({"live": True, "product_reply": False, "admit": {"disposition": "held"}}),
        "research_rows": rmc_core._rows_for({"memory": {"research": [{"id": "w", "text": "My car is red."}]}}, "My car is red."),
        "max": rmc_core.FALLBACK_MAX,
    }
    out["unsourced_held"] = hasattr(rmc_core, "UNSOURCED_HELD")
    sample = {"p_kind": "fact", "p_payload": {"text": "Light — scattered by ε air.", "sfe": {"Phi": 6, "eps": 0.140001, "mu": 1}, "x": 1.0, "big": 1e21, "small": 1e-7, "neg": -0.5, "t": True, "n": None, "q": "a\"b\\c\n"},
              "p_sources": [], "p_proof": {"source": "rmc_core.admit_gate"}}
    out["canon"] = {"py": mwh.canon(sample), "sha": mwh._sha(mwh.canon(sample)), "sample": sample, "arg_keys": list(mwh.ARG_KEYS), "purpose": mwh.PURPOSE}
    print(json.dumps(out, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
