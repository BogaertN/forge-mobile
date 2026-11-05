"""4.9.215 checks used by verify/r4215_suite.js (Release C4): the Dry-Run tab's engine call. Real engine, dry_run: true, no network,
no LLM. For each question it runs the same payload live and as a dry run, and prints one JSON line."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine"))
sys.path.insert(0, str(ROOT))

from tools.live_188 import SEED, anchor_pool, starter_rows  # noqa: E402
# 4.9.242: r4215 expects "17 times 23" held as needs_libs — the phone has not loaded its pinned wheels yet.
# A system sympy (if installed on the build host) must not make that dry-run admit; hide it for this check only.
import builtins as _bi, sys as _sys
_real_import = _bi.__import__
def _import_no_math(name, globals=None, locals=None, fromlist=(), level=0):
    if name == "sympy" or (isinstance(name, str) and name.startswith("sympy.")):
        raise ImportError("forge-check-215: phone wheels not loaded")
    if name == "pint" or (isinstance(name, str) and name.startswith("pint.")):
        raise ImportError("forge-check-215: phone wheels not loaded")
    return _real_import(name, globals, locals, fromlist, level)
_bi.__import__ = _import_no_math
for _m in [k for k in list(_sys.modules) if k == "sympy" or k.startswith("sympy.") or k == "pint" or k.startswith("pint.")]:
    del _sys.modules[_m]
from rmc_engine_v1.rmc_core import run  # noqa: E402

POOL = anchor_pool()
QUESTIONS = json.loads(sys.argv[1]) if len(sys.argv) > 1 else ["Why is the sky blue?", "What is 17 times 23?"]


def payload(q: str, dry: bool) -> dict:
    mem = json.loads(json.dumps(SEED))
    mem["anchors"] = starter_rows()
    mem["pools"] = [{"name": "anchors", "into": "anchors", "rows": POOL}]
    p = {"question": q, "live": True, "memory": mem}
    if dry:
        p["dry_run"] = True
    return p


out = []
for q in QUESTIONS:
    before = json.dumps(payload(q, True), sort_keys=True)
    d = run(payload(q, True))
    live = run(payload(q, False))
    stages = d.get("stages") or []
    out.append({
        "question": q,
        "disposition": (d.get("admit") or {}).get("disposition"),
        "drift_region": (d.get("admit") or {}).get("drift_region"),
        "eps": d.get("drift"), "C": d.get("coherence"),
        "live_eps": live.get("drift"), "live_C": live.get("coherence"),
        "live_disposition": (live.get("admit") or {}).get("disposition"),
        "n_stages": len(stages),
        "skipped": [s.get("n") for s in stages if str(s.get("status")).upper() == "SKIPPED"],
        "reply": d.get("reply"), "product_reply": d.get("product_reply"),
        "memory_write": d.get("memory_write"),
        "echo_method": (d.get("echo") or {}).get("method"),
        "candidate": (d.get("echo") or {}).get("output_text"),
        "payload_unchanged": json.dumps(payload(q, True), sort_keys=True) == before,
    })
print(json.dumps(out))
