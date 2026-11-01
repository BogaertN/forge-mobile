"""4.9.218 checks used by verify/r4218_suite.js. Real engine, no network, no LLM. Prints one JSON line.

Continuous question tuning on the 9 / 144 dial (Nic-approved, pt125u). The integer phase is the band; the
question's own words tune the decimal inside it with the 4.9.203 / 4.9.204 constants (ε 0.02, offset cap 0.40,
nudge 0.45). Two decimal-phase rows below are test fixtures (copies of a shipped anchor with a stated decimal Φ);
they show the continuous gap at work. Everything else is the shipped memory.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine"))
sys.path.insert(0, str(ROOT))
_MATHLIBS = ROOT / "_mathlibs"
if _MATHLIBS.is_dir() and str(_MATHLIBS) not in sys.path:
    sys.path.insert(0, str(_MATHLIBS))

from rmc_engine_v1.anchor_store import clear_cache  # noqa: E402
from tools.live_188 import SEED, anchor_pool, starter_rows  # noqa: E402
from rmc_engine_v1.rmc_core import run  # noqa: E402
from rmc_engine_v1 import question_tuning as qt  # noqa: E402
from rmc_engine_v1 import resonance_recall as rr  # noqa: E402
from rmc_engine_v1 import frequency_203_config as cfg  # noqa: E402
from rmc_engine_v1.drift_policy import QUESTION_TUNING  # noqa: E402

GENERAL = [
    "What is the Moon?", "Why is the sky blue?", "What is 17 times 23?", "Convert 5 miles to km", "What color is my car?",
    "What is Burkina Faso?", "What is the capital of Burkina Faso?", "Why is the ocean salty?", "What is gravity?",
    "Who wrote Hamlet?", "How many legs does a spider have?", "Where is the Sahara?", "When did the Berlin Wall fall?",
    "zzzz qqqq", "a", "", "The the the", "WHAT IS THE MOON???", "what is the moon",
]


def ask(q, extra_direct=None, phone=None, dry=False):
    mem = json.loads(json.dumps(SEED))
    mem["anchors"] = list(STARTER) + list(extra_direct or [])
    mem["pools"] = [{"name": "anchors", "into": "anchors", "rows": list(POOL)}]
    if phone:
        mem["phone"] = phone
    body = {"question": q, "live": True, "memory": mem}
    if dry:
        body["dry_run"] = True
    r = run(body)
    e = r.get("echo") or {}
    rec = (r.get("recall") or {}).get("resonance") or r.get("resonance") or {}
    return {"reply": r.get("reply"), "product_reply": bool(r.get("product_reply")), "echo": e.get("score"), "echo_method": e.get("method"),
            "relation": e.get("relation"), "calls_llm": r.get("calls_llm"), "drift": (r.get("drift") or {}).get("epsilon_s") if isinstance(r.get("drift"), dict) else r.get("drift"),
            "writes": bool((r.get("memory_write") or {}).get("written")), "keys": sorted(r.keys())}


def recall(q, rows, band_report=None):
    return rr.rank_memory(q, json.loads(json.dumps(rows)), band_report)


def main() -> None:
    global STARTER, POOL
    clear_cache()
    STARTER, POOL = starter_rows(), anchor_pool()
    by_id = {r["id"]: r for r in list(POOL) + list(STARTER)}
    base = dict(by_id["enc-cia-uv-0"])
    q = "What is Burkina Faso?"
    t1 = qt.tune(q, 1)
    # Fixtures: the same sentence at three stated phases. Near the tuned station, at the band centre, one band away.
    near = dict(base, id="t-near", memory_id="t-near", text="Burkina Faso is a landlocked country in West Africa.", sfe={"Phi": t1["Phi"], "eps": 0.0, "mu": 1.0})
    centre = dict(base, id="t-centre", memory_id="t-centre", text="Burkina Faso is a landlocked country in West Africa.", sfe={"Phi": 1, "eps": 0.0, "mu": 1.0})
    far = dict(base, id="t-far", memory_id="t-far", text="Burkina Faso is a landlocked country in West Africa.", sfe={"Phi": 2.3, "eps": 0.0, "mu": 1.0})
    rec = recall(q, [near, centre, far], {"phase_state": {"phase_primary": 1}})
    car = [{"id": "rem-car", "text": "My car is red.", "scope": "phone", "provenance": {"requested_by": "user", "request": "remember_command", "kind": "statement"}}]
    out = {
        "constants": {"epsilon": cfg.EPSILON, "offset_cap": cfg.OFFSET_CAP, "nudge_span": cfg.NUDGE_SPAN, "approved": getattr(cfg, "CONSTANTS_APPROVED", None)},
        "policy": QUESTION_TUNING,
        "tunes": [{"q": qq, **qt.tune(qq, b)} for qq in GENERAL for b in (1, 5, 9)],
        "repeat_same": all(qt.tune(qq, 1) == qt.tune(qq, 1) for qq in GENERAL),
        "case_same": qt.tune("WHAT IS THE MOON???", 1)["Phi"] == qt.tune("what is the moon", 1)["Phi"] == qt.tune("What is the Moon?", 1)["Phi"],
        "recall": {"question_phi": rec["question_phi"], "question_band": rec["question_band"], "tuning": rec["question_tuning"],
                   "active": [a.get("memory_id") for a in rec["active"]],
                   "evidence": {a.get("memory_id"): a["retrieval_evidence"][0] for a in rec["active"]},
                   "grace": {n["memory_id"]: rr._grace(n["sfe"], rec["question_phi"]) for n in (near, centre, far)},
                   "integer_grace": {n["memory_id"]: rr._grace(n["sfe"], 1) for n in (near, centre, far)}},
        "window": {"edge_in": rr.phase_aligned(1.1, 9.0), "edge_out": rr.phase_aligned(0.0 + 9.8, 2.0), "d_centre": round(rr._circular_delta(t1["Phi"], 1), 6)},
        "dna": ask("What is DNA?"),
        "moon": ask("What is the Moon?"),
        "sky": ask("Why is the sky blue?"),
        "math": ask("What is 17 times 23?"),
        "convert": ask("Convert 5 miles to km"),
        "car": ask("What color is my car?", phone=car),
        "dry_math": ask("What is 17 times 23?", dry=True),
        "dry_sky": ask("Why is the sky blue?", dry=True),
    }
    out["tunes_ok"] = all(abs(r["offset"]) <= 0.2 + 1e-9 and (math.isclose(((r["Phi"] - r["band"]) + 4.5) % 9 - 4.5, r["offset"], abs_tol=1e-9)) for r in out["tunes"])
    print(json.dumps(out, ensure_ascii=False, default=str))


STARTER: list = []
POOL: list = []

if __name__ == "__main__":
    main()
