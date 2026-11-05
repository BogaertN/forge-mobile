"""4.9.238 (Nic): a concessive or causal sentence is read as its clauses.

"Even though X, Y because Z" is the concessive clause X, the main clause Y and its hetu (cause) Z. Only the subordinators
split: "even though", "although", an initial "though", and "because" (never "because of", a prepositional cause inside one
clause). A part shorter than two words is not split off. This is the exact mirror of src/qframe.js splitClauses, so the
phone's clause records and the engine's sentence parts carry the same texts. Deterministic; no model; no word list of
topics.
"""
from __future__ import annotations

import re
from typing import Any

_SPLIT = (
    (re.compile(r"^(?:even though|although|though)\s+(.+?),\s+(.+)$", re.I), ("concessive", None)),
    (re.compile(r"^because\s+(?!of\b)(.+?),\s+(.+)$", re.I), ("hetu", None)),
    (re.compile(r"^(.+?),?\s+(?:even though|although)\s+(.+)$", re.I), (None, "concessive")),
    (re.compile(r"^(.+?),?\s+because\s+(?!of\b)(.+)$", re.I), (None, "hetu")),
)


def split_clauses(sentence: Any, link: str | None = None) -> list[dict[str, str]]:
    text = re.sub(r"[.!?]+$", "", str(sentence or "")).strip()
    own = link or "main"
    for rx, links in _SPLIT:
        m = rx.match(text)
        if not m:
            continue
        a, b = m.group(1).strip(), m.group(2).strip()
        if len(a.split()) < 2 or len(b.split()) < 2:
            continue
        return split_clauses(a, links[0] or own) + split_clauses(b, links[1] or own)
    return [{"text": text, "link": own}]
