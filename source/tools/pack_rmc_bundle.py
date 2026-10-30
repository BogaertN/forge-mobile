"""Refresh data/py/rmc_engine_bundle.json from the engine tree.

Reference files that exist only inside the previous bundle are kept.
Anchor shards stay out of the bundle. The phone loads those by concept.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "engine" / "rmc_engine_v1"
BUNDLE = ROOT / "data" / "py" / "rmc_engine_bundle.json"


def main() -> None:
    previous = json.loads(BUNDLE.read_text(encoding="utf-8")) if BUNDLE.exists() else {"files": {}}
    files = dict(previous.get("files") or {})
    for path in ENGINE.rglob("*"):
        if not path.is_file() or "__pycache__" in path.parts:
            continue
        if path.suffix not in {".py", ".json", ".jsonl"}:
            continue
        rel = str(path.relative_to(ENGINE.parent))
        files[rel] = path.read_text(encoding="utf-8")
    # Drop anything whose source file was removed, except reference payloads
    # that were never stored as loose files beside the package.
    kept = {}
    for rel, src in files.items():
        disk = ENGINE.parent / rel
        if disk.exists() or rel.startswith("rmc_engine_v1/reference/"):
            kept[rel] = src if disk.exists() else src
            if disk.exists():
                kept[rel] = disk.read_text(encoding="utf-8")
    body = json.dumps({"files": dict(sorted(kept.items()))}, ensure_ascii=False, separators=(",", ":"))
    raw = body.encode("utf-8")
    BUNDLE.write_bytes(raw)
    digest = hashlib.sha384(raw).digest()
    import base64
    sri = "sha384-" + base64.b64encode(digest).decode("ascii")
    print(json.dumps({"files": len(kept), "bytes": len(raw), "sri": sri}))


if __name__ == "__main__":
    main()
