"""Memory as clauses (plan 229 step 3, v4.9.231).

The phone parses each remembered or recalled sentence with its own grammar (src/qframe.js
KQFrame.clause, schema forge.clause/v1) and sends the clause beside the row's text. One Ask turn
holds the clauses in a context variable, keyed by row id and by the normalized sentence, so a layer
that meets a recalled node (the world model's Observe) finds the same clause the phone parsed.
A clause counts only when its schema is right and it was parsed from that row's own text.
No model; nothing here answers; nothing is written.
"""
from __future__ import annotations

import contextvars
import re
from typing import Any

SCHEMA = "forge.clause/v1"
KEYS = ("receipts", "phone", "hosted", "anchors", "research")

_REG: contextvars.ContextVar[dict[str, Any] | None] = contextvars.ContextVar("forge_memory_clauses", default=None)


def norm(text: Any) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip().rstrip(".!?").strip().lower()


def valid(clause: Any, text: Any) -> bool:
    """The phone's schema, parsed from this row's own text (not a clause carried over from another row)."""
    if not isinstance(clause, dict) or clause.get("schema") != SCHEMA:
        return False
    return norm(clause.get("text")) == norm(text)


def sentences(clause: dict[str, Any]) -> list[dict[str, Any]]:
    """The clause records of a row: one per sentence (a one-sentence row is its own record)."""
    if isinstance(clause.get("sentences"), list):
        return [c for c in clause["sentences"] if isinstance(c, dict) and c.get("schema") == SCHEMA]
    return [clause]


def _rows(memory: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    out: list[tuple[str, dict[str, Any]]] = []
    for key in KEYS:
        for row in memory.get(key) or []:
            if isinstance(row, dict):
                out.append((key, row))
    for pool in memory.get("pools") or []:
        if isinstance(pool, dict):
            for row in pool.get("rows") or []:
                if isinstance(row, dict):
                    out.append(("pool:" + str(pool.get("name") or ""), row))
    return out


def begin(payload: dict[str, Any]) -> Any:
    memory = payload.get("memory") if isinstance(payload.get("memory"), dict) else {}
    by_id: dict[str, dict[str, Any]] = {}
    by_text: dict[str, dict[str, Any]] = {}
    stats = {"rows": 0, "with_clause": 0, "valid": 0, "rejected": 0, "parsed_sentences": 0, "unparsed_sentences": 0, "by_store": {}}
    for store, row in _rows(memory):
        text = row.get("text") or row.get("content")
        if not str(text or "").strip():
            continue
        stats["rows"] += 1
        cl = row.get("clause")
        if cl is None:
            continue
        stats["with_clause"] += 1
        if not valid(cl, text):
            stats["rejected"] += 1
            continue
        stats["valid"] += 1
        st = stats["by_store"].setdefault(store, 0)
        stats["by_store"][store] = st + 1
        for s in sentences(cl):
            stats["parsed_sentences" if s.get("parsed") else "unparsed_sentences"] += 1
            if s.get("parsed"):
                by_text.setdefault(norm(s.get("text")), s)
        if row.get("id"):
            by_id[str(row["id"])] = cl
        by_text.setdefault(norm(text), cl)
    return _REG.set({"by_id": by_id, "by_text": by_text, "stats": stats, "lookups": []})


def end(token: Any) -> None:
    _REG.reset(token)


def lookup(row_id: Any = None, text: Any = None) -> dict[str, Any] | None:
    """The clause the phone parsed for this row (by id, else by its normalized sentence)."""
    reg = _REG.get()
    if not reg:
        return None
    cl = reg["by_id"].get(str(row_id or "")) if row_id else None
    if cl is not None and text is not None and not valid(cl, text):
        # the id's row text and this text differ (a sentence of a longer row): look the sentence up instead
        cl = None
    if cl is None and text is not None:
        cl = reg["by_text"].get(norm(text))
    return cl


def with_place(clause: dict[str, Any], place: dict[str, Any]) -> dict[str, Any]:
    """A copy of the clause (and of each of its sentences) carrying the row's meaning id, phase, band and Hz."""
    out = dict(clause)
    out["place"] = dict(place)
    if isinstance(clause.get("sentences"), list):
        out["sentences"] = [dict(c, place=dict(place)) if isinstance(c, dict) else c for c in clause["sentences"]]
    return out


def note(consumer: str, **info: Any) -> None:
    reg = _REG.get()
    if reg is not None:
        reg["lookups"].append(dict({"consumer": consumer}, **info))


def summary() -> dict[str, Any]:
    reg = _REG.get()
    if not reg:
        return {"schema": SCHEMA, "active": False}
    return {"schema": SCHEMA, "active": True, **reg["stats"], "uses": reg["lookups"][:12], "calls_llm": False}
