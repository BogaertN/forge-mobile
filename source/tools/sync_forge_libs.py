"""4.9.216: write the pinned wheel manifest (data/forge_libs.json) into src/pycheck.js as FORGE_LIBS.

The phone verifies each wheel's SHA-256 against this shipped copy before it unpacks it. The JSON file is the record;
the suite checks the two are equal. Run after editing data/forge_libs.json."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def shipped() -> dict:
    m = json.loads((ROOT / "data" / "forge_libs.json").read_text(encoding="utf-8"))
    return {
        "schema": m["schema"], "cache": m["cache"], "groups": m["groups"],
        "wheels": [{k: w[k] for k in ("name", "version", "file", "url", "bytes", "sha256", "integrity")} for w in m["wheels"]],
    }


def main() -> None:
    path = ROOT / "src" / "pycheck.js"
    src = path.read_text(encoding="utf-8")
    line = "const FORGE_LIBS = " + json.dumps(shipped(), separators=(",", ":")) + ";"
    if "const FORGE_LIBS = " in src:
        src = re.sub(r"^const FORGE_LIBS = .*;$", lambda _: line, src, count=1, flags=re.M)
    else:
        src = src.replace("const CHECKABLE =", line + "\nconst CHECKABLE =", 1)
    path.write_text(src, encoding="utf-8")


if __name__ == "__main__":
    main()
