"""4.9.226 engine test: the chosen sense steers pool preselection; with no sense nothing changes."""
from __future__ import annotations

import json
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, os.path.join(ROOT, "engine"))

from rmc_engine_v1 import rmc_core  # noqa: E402


def row(i, text, concepts):
    return {"id": i, "text": text, "concepts": concepts, "tier": "anchor", "state": "anchor", "trust": "trusted", "sfe": {"Phi": 4, "eps": 0.0, "mu": 0.1}}


POOL = [row("a-liquid", "Water is a clear liquid.", ["A.WATER"]), row("a-food", "Water is the drink taken with a meal.", ["N.FOOD", "A.WATERFOOD"])]


def kept(payload):
    out = rmc_core.preselect_pools(payload)
    pre = out["_preselect"]["pools"][0]["kept"]
    return sorted(pre)


def base(extra=None):
    p = {"question": "What is water?", "memory": {"pools": [{"name": "anchors", "into": "anchors", "rows": [dict(r) for r in POOL]}]}}
    p.update(extra or {})
    return p


def main():
    rows = []
    plain = kept(base())
    rows.append({"name": "no sense: unchanged (the water concept row is kept)", "ok": "a-liquid" in plain, "why": json.dumps(plain)})
    again = kept(base())
    rows.append({"name": "no sense: deterministic", "ok": plain == again})
    ch = kept(base({"sense": {"concept": "N.FOOD", "exclude_concepts": ["A.WATER"]}}))
    rows.append({"name": "sense N.FOOD keeps the food row, drops the liquid row", "ok": ch == ["a-food"], "why": json.dumps(ch)})
    ch2 = kept(base({"sense": {"concept": "A.WATER", "exclude_concepts": ["N.FOOD"]}}))
    rows.append({"name": "sense A.WATER keeps the liquid row", "ok": "a-liquid" in ch2 and "a-food" not in ch2, "why": json.dumps(ch2)})
    junk = kept(base({"sense": "planet"}))
    rows.append({"name": "a malformed sense is ignored", "ok": junk == plain})
    nocon = kept(base({"sense": {"concept": None, "exclude_concepts": []}}))
    rows.append({"name": "a sense with no concept changes nothing", "ok": nocon == plain})
    print(json.dumps(rows))


if __name__ == "__main__":
    main()
