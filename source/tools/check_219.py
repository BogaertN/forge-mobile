"""4.9.219 checks used by verify/r4219_suite.js. Real engine, no network, no LLM. Prints one JSON line.

Band tuning on the 144/n ladder (DRIFT-SPEC/v1 D15, Nic 2026-11-04, option 4c). The phase alone picks the named band;
the item's words tune a symbolic Hz inside it (eps 0.02, cap 0.40, nudge 0.45). Same band 1.0, x3 0.3, x9 0.1, a
ranking key only. Decimal-phase rows below are test fixtures (copies of a shipped anchor with a stated phase).
"""
from __future__ import annotations

import itertools
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine"))
sys.path.insert(0, str(ROOT))
_MATHLIBS = ROOT / "_mathlibs"
if _MATHLIBS.is_dir() and str(_MATHLIBS) not in sys.path:
    sys.path.insert(0, str(_MATHLIBS))

from rmc_engine_v1.anchor_store import clear_cache  # noqa: E402
from tools.live_188 import anchor_pool, starter_rows  # noqa: E402
from tools import check_218 as c218  # noqa: E402
from rmc_engine_v1 import band_tuning as bt  # noqa: E402
from rmc_engine_v1.drift_policy import BAND_TABLE, BAND_TABLE_META  # noqa: E402

TEXTS = c218.GENERAL + ["Oranjestad is the capital of Aruba.", "Photosynthesis converts light into chemical energy.", "zzzz"]
PROBES = ["sky blue", "the Moon", "Burkina Faso", "capital of Burkina Faso", "ocean salty", "what is gravity",
          "17 times 23", "convert 5 miles to km", "remember that my car is red", "then what color is my car",
          "What is a volcano?", "Why do leaves change color?", "What is the capital of Peru?"]


def main() -> None:
    clear_cache()
    c218.STARTER, c218.POOL = starter_rows(), anchor_pool()
    by_id = {r["id"]: r for r in list(c218.POOL) + list(c218.STARTER)}
    base = dict(by_id["enc-cia-uv-0"])
    q = "What is Burkina Faso?"
    s = "Burkina Faso is a landlocked country in West Africa."
    same = dict(base, id="b-a", memory_id="b-a", text=s, sfe={"Phi": 9.5, "eps": 0.0, "mu": 1.0})
    harm = dict(base, id="b-z", memory_id="b-z", text=s, sfe={"Phi": 8.5, "eps": 0.0, "mu": 1.0})
    only = dict(base, id="b-h", memory_id="b-h", text=s, sfe={"Phi": 3, "eps": 0.0, "mu": 1.0})
    rec = c218.recall(q, [harm, same], {"phase_state": {"phase_primary": 9}})
    rec_only = c218.recall(q, [only], {"phase_state": {"phase_primary": 9}})
    car = [{"id": "rem-car", "text": "My car is red.", "scope": "phone", "provenance": {"requested_by": "user", "request": "remember_command", "kind": "statement"}}]
    tunes = [{"t": t, **bt.tune(t, p)} for t in TEXTS for p in range(1, 10)]
    out = {
        "table": BAND_TABLE, "meta": BAND_TABLE_META, "markers": {p: bt.band_markers(p) for p in range(1, 10)},
        "relations": {f"{a}-{b}": bt.relation(a, b)["relation"] for a, b in itertools.combinations(range(1, 10), 2)},
        "tunes_in_band": all(bt.in_band(r["phase"], r["hz"]) for r in tunes),
        "tunes_r_ok": all(abs(r["r"]) <= 0.4 + 1e-9 for r in tunes),
        "repeat_same": all(bt.tune(t, 3) == bt.tune(t, 3) for t in TEXTS),
        "decimal_phase_band": [bt.band_of(x) for x in (1, 1.5, 4.0, 9.9, "Φ6", None, 0, 10)],
        "sample": [r for r in tunes if r["t"] in ("What is gravity?", "")],
        "recall": {"active": [a.get("memory_id") for a in rec["active"]], "question_phi": rec["question_phi"], "tuning": rec["question_tuning"],
                   "evidence": {a.get("memory_id"): a["retrieval_evidence"][0] for a in rec["active"]},
                   "packets": {n["memory_id"]: n["packet"].get("band") for n in rec["admitted_for_observe"]}},
        "harmonic_only_active": [a.get("memory_id") for a in rec_only["active"]], "harmonic_only_how": rec_only["how"],
        "dna": c218.ask("What is DNA?"), "moon": c218.ask("What is the Moon?"), "sky": c218.ask("Why is the sky blue?"),
        "math": c218.ask("What is 17 times 23?"), "convert": c218.ask("Convert 5 miles to km"),
        "car": c218.ask("What color is my car?", phone=car),
        "dry_math": c218.ask("What is 17 times 23?", dry=True), "dry_sky": c218.ask("Why is the sky blue?", dry=True),
    }
    if "--probes" in sys.argv:
        out["probes"] = {p: c218.ask(p, phone=car if "color is my car" in p else None) for p in PROBES}
    print(json.dumps(out, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
