"""Lazy anchor shards. A question loads the shards whose ingestion phrase it names.

This module does not parse with a regular expression and does not rank by
token overlap. Concept phrases were placed when the shard was built.
The starter set in anchors_187.json is always loaded by the caller.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2] / "data" / "anchors_188"
LIMIT = 16
MAX_SHARDS = 2


def _words(text: str) -> str:
    raw = str(text or "").lower()
    chars = []
    for ch in raw:
        if ("a" <= ch <= "z") or ("0" <= ch <= "9") or ch == " ":
            chars.append(ch)
        else:
            chars.append(" ")
    return " ".join("".join(chars).split())


@lru_cache(maxsize=1)
def _index() -> dict[str, Any]:
    path = ROOT / "index.json"
    if not path.exists():
        return {"surfaces": {}, "shards": {}, "count": 0}
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache(maxsize=64)
def _shard(name: str) -> list[dict[str, Any]]:
    meta = (_index().get("shards") or {}).get(name) or {}
    rel = str(meta.get("file") or "")
    path = ROOT / rel
    if not rel or not path.exists() or not path.resolve().is_relative_to(ROOT.resolve()):
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    rows = data.get("anchors") if isinstance(data, dict) else None
    return [row for row in rows or [] if isinstance(row, dict)]


def select_anchors(question: str, limit: int = LIMIT) -> list[dict[str, Any]]:
    """Return at most `limit` trusted rows from the shards the question names."""
    index = _index()
    surfaces = index.get("surfaces") or {}
    blob = " " + _words(question) + " "
    named: list[str] = []
    for phrase in sorted(surfaces, key=len, reverse=True):
        if (" " + phrase + " ") not in blob:
            continue
        for shard in surfaces.get(phrase) or []:
            if shard not in named:
                named.append(shard)
        if len(named) >= MAX_SHARDS:
            break
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for name in named[:MAX_SHARDS]:
        for row in _shard(name):
            text = str(row.get("text") or "")
            if not text or text in seen:
                continue
            seen.add(text)
            rows.append(row)
    rows.sort(key=lambda row: str(row.get("id") or ""))
    return rows[:limit]


def clear_cache() -> None:
    _index.cache_clear()
    _shard.cache_clear()
