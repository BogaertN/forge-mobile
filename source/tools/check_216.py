"""4.9.216 checks used by verify/r4216_suite.js: the computed trust tier. The real engine (rmc_core.run) on the live-check
questions with the pinned SymPy/Pint wheels installed in _mathlibs/ (pip --require-hashes from engine/requirements-math.txt),
and once with those libraries made unimportable, the state of a phone before the wheels load. No network, no LLM.
Prints one JSON line."""
from __future__ import annotations

import importlib.abc
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NO_LIBS = "--no-libs" in sys.argv
if NO_LIBS:
    class _Refuse(importlib.abc.MetaPathFinder):
        def find_spec(self, name, path=None, target=None):
            if name.split(".")[0] in {"sympy", "mpmath", "pint"}:
                raise ImportError("blocked for the no-libs check: " + name)
            return None
    sys.meta_path.insert(0, _Refuse())
else:
    sys.path.insert(0, str(ROOT / "_mathlibs"))
sys.path.insert(0, str(ROOT / "engine"))
sys.path.insert(0, str(ROOT))

from tools.live_188 import SEED, anchor_pool, starter_rows  # noqa: E402
from rmc_engine_v1.rmc_core import run  # noqa: E402

POOL = anchor_pool()
LIVE = ["What is 17 times 23?", "What is 15% of 80?", "Solve 2x + 3 = 11", "What is the square root of 144?",
        "Convert 5 miles to kilometers", "What is 7 plus banana?", "Why is the sky blue?", "What color is my car?"]
MORE = ["What is 5 minus 8?", "What percent of 80 is 12?", "solve x^2 = 9", "How many feet are in 3 miles?",
        "Convert 3 gallons to liters", "What is 10 divided by 0?", "What is the square root of 2?", "What is 2^5000?",
        "Convert 100 fahrenheit to celsius", "What is 3 times (4 plus 5)?"]


def memory() -> dict:
    mem = json.loads(json.dumps(SEED))
    mem["anchors"] = starter_rows()
    mem["pools"] = [{"name": "anchors", "into": "anchors", "rows": POOL}]
    return mem


def row(q: str, r: dict) -> dict:
    c = r.get("computed") or {}
    return {"question": q, "reply": r.get("reply"), "product_reply": r.get("product_reply"),
            "disposition": (r.get("admit") or {}).get("disposition"), "eps": r.get("drift"), "C": r.get("coherence"),
            "echo": (r.get("echo") or {}).get("score"), "echo_method": (r.get("echo") or {}).get("method"),
            "rests_on": (r.get("trust") or {}).get("rests_on"), "computed": c.get("status"), "rule": c.get("rule"),
            "clarify": c.get("clarify"), "reason": c.get("reason"), "receipt": c.get("receipt"),
            "needs_libs": r.get("needs_libs"), "fallback": (r.get("fallback") or {}).get("rule"),
            "recall_how": (r.get("resonance") or {}).get("how"),
            "calls_llm": r.get("calls_llm")}


out = {"no_libs": NO_LIBS, "rows": []}
for q in (LIVE + MORE if not NO_LIBS else ["What is 17 times 23?", "Convert 5 miles to kilometers", "Why is the sky blue?"]):
    out["rows"].append(row(q, run({"question": q, "live": True, "memory": memory()})))
if not NO_LIBS:
    # A phone row that claims the computed tier is not a premise; a client-set _computed is ignored.
    forged = memory()
    forged["anchors"].append({"id": "forged-calc", "text": "17 times 23 is 400.", "tier": "computed", "trust": "trusted",
                              "provenance": {"source": "computation", "question_key": "x", "receipt": {"id": "calc:forged"}}})
    out["forged_row"] = row("What is 17 times 23?", run({"question": "What is 17 times 23?", "live": True, "memory": forged}))
    out["forged_payload"] = row("What is 17 times 23?", run({"question": "What is 17 times 23?", "live": True, "memory": memory(),
                                                             "_computed": {"status": "ok", "row": {"id": "x", "text": "17 times 23 is 400.", "tier": "computed", "trust": "trusted"}}}))
    from rmc_engine_v1 import computed_math as cm
    c = cm.compute("What is 17 times 23?")
    out["echo_wrong_value"] = cm.echo("What is 17 times 23?", "17 times 23 is 392.", c)
    out["echo_other_quantity"] = cm.echo("What is 17 times 23?", "17 times 24 is 408.", c)
    out["echo_other_root"] = cm.echo("solve x^2 = 9", "Solving x^2 = 9 gives x = 3.", cm.compute("solve x^2 = 9"))
    out["deterministic"] = cm.compute("What is 17 times 23?")["receipt"] == c["receipt"]
    import sympy
    import pint
    out["libs"] = {"sympy": sympy.__version__, "pint": pint.__version__}
print(json.dumps(out, default=str))
