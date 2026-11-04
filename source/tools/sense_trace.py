"""4.9.221 shadow sense trace, Python mirror of src/senses.js (KSenses.trace). Advisory only: it is never read by
recall, Echo, drift or any gate, and it changes no answer. Deterministic: no model, no embeddings, no randomness.

Order (Nic 2026-11-04, t136u): an existing concept is PINNED to its curated meaning (data/concept_senses.json);
a word with one WordNet category is plain; a homograph (two or more categories, the forge-ref sense pack) is
resolved only by capitalisation; anything else is logged as would_ask (Forge would ask). Lesk word overlap is
computed and logged as a hint only; it never decides.
"""
from __future__ import annotations

import re

STOP = set("""a an the of and or in on at to for by with from as is are was were be been being it its this that these those
which who whom whose what when where why how not no any some all one two used use usually especially often very more most
such than other into out up down over under about after before between also can may do does did has have had he she they
them his her their our we you your i me my there here so if then because while much many each every only same""".split())
WORD = re.compile(r"[A-Za-z][A-Za-z'-]*")
GLOSS = re.compile(r"[A-Za-z][A-Za-z'-]+")
SUFFIXES = ("ing", "ies", "es", "s", "ed", "al", "ly")


def stem(w: str) -> str:
    w = w.lower()
    for suf in SUFFIXES:
        if len(w) > len(suf) + 3 and w.endswith(suf):
            w = w[: -len(suf)]
            break
    return w[:6]


def forms(w: str) -> list[str]:
    out = [w]
    if w.endswith("ies") and len(w) > 4:
        out.append(w[:-3] + "y")
    if w.endswith("es") and len(w) > 3:
        out.append(w[:-2])
    if w.endswith("s") and len(w) > 3:
        out.append(w[:-1])
    return out


def tokens(text: str) -> list[dict]:
    text = str(text or "")
    any_upper = re.search(r"[A-Z]", text) is not None
    out = []
    for m in WORD.finditer(text):
        raw = m.group(0)
        word = re.sub(r"('s|')$", "", raw.lower()).strip("-'")
        before = text[: m.start()].rstrip()
        initial = (not before) or before[-1] in '.!?:;"\n'
        cap = None if (initial or not any_upper) else bool(re.match(r"[A-Z]", raw))
        out.append({"w": word, "cap": cap})
    return out


def _lesk(word: str, senses: list, context: set) -> str | None:
    scored = []
    for s in senses:
        sig = {stem(t) for t in GLOSS.findall(s[5]) if t.lower() not in STOP and len(t) > 2}
        scored.append((len(sig & context), s[0]))
    scored.sort(key=lambda x: (-x[0], x[1]))
    if not scored or scored[0][0] < 1:
        return None
    if len(scored) > 1 and scored[0][0] - scored[1][0] < 1:
        return None
    return scored[0][1]


def trace(text: str, table: dict, pack: dict | None = None) -> dict:
    surf = table.get("surfaces") or {}
    lemmas = (pack or {}).get("lemmas") or {}
    lexfiles = (pack or {}).get("lexfiles") or []
    toks = [t for t in tokens(text) if t["w"] and t["w"] not in STOP and len(t["w"]) > 2]
    used = [False] * len(toks)
    entries = []
    for size in (3, 2):
        for i in range(0, len(toks) - size + 1):
            if any(used[i:i + size]):
                continue
            key = " ".join(t["w"] for t in toks[i:i + size])
            if key in surf:
                for j in range(i, i + size):
                    used[j] = True
                entries.append({"at": i, "w": key, "state": "pinned", "by": "curated", "concepts": [c for c, _ in surf[key]], "senses": [s for _, s in surf[key]]})
    context = {stem(t["w"]) for t in toks}
    plain = 0
    for i, t in enumerate(toks):
        if used[i]:
            continue
        w = t["w"]
        hit = next((f for f in forms(w) if f in surf), None)
        if hit:
            entries.append({"at": i, "w": w, "state": "pinned", "by": "curated", "concepts": [c for c, _ in surf[hit]], "senses": [s for _, s in surf[hit]]})
            continue
        lem = next((f for f in forms(w) if f in lemmas), None)
        if not lem:
            plain += 1
            continue
        ss = lemmas[lem]
        proper = [s for s in ss if s[2] == 1]
        common = [s for s in ss if s[2] == 0]
        e = {"at": i, "w": w, "n": len(ss)}
        if t["cap"] is True and len(proper) == 1:
            e.update({"state": "resolved", "by": "capitalisation", "sense": proper[0][0], "lexfile": lexfiles[proper[0][1]] if lexfiles else proper[0][1]})
        elif t["cap"] is False and common and len({s[1] for s in common}) == 1:
            e.update({"state": "resolved", "by": "lowercase", "sense": common[0][0], "lexfile": lexfiles[common[0][1]] if lexfiles else common[0][1]})
        else:
            e.update({"state": "would_ask", "by": "ambiguous"})
        ctx = context - {stem(w)}
        e["lesk"] = _lesk(w, proper if (t["cap"] is True and proper) else (common if (t["cap"] is False and common) else ss), ctx)
        entries.append(e)
    entries.sort(key=lambda e: e["at"])
    pinned = [e for e in entries if e["state"] == "pinned"]
    return {"schema": "FORGE-SENSE-TRACE/v1", "mode": "advisory", "pack": bool(lemmas), "entries": entries,
            "counts": {"pinned": len(pinned), "pinned_with_sense": sum(1 for e in pinned if any(e["senses"])),
                       "resolved": sum(1 for e in entries if e["state"] == "resolved"),
                       "would_ask": sum(1 for e in entries if e["state"] == "would_ask"), "plain": plain}}
