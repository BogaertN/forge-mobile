"""Creative and opinion replies. Composition from cited facts, installed simulators, and computed values.

A line is spoken only when it is a remembered fact, a solver sentence, or a computed sentence.
Nothing here is stored, and nothing is handed to Gilligan as a fact.
"""
from __future__ import annotations

import re
from typing import Any

_ACTS = {"compose", "narrate", "describe", "prefer"}


def _heads(frame: dict[str, Any]) -> list[str]:
    found: list[str] = []

    def add(np: Any) -> None:
        if isinstance(np, dict):
            head = str(np.get("head") or "").strip().lower()
            if head and head not in found and head not in {"you", "kernel", "poem", "story"}:
                found.append(head)

    add(frame.get("karma"))
    for adj in frame.get("adj") or []:
        if isinstance(adj, dict):
            add(adj.get("np"))
    if frame.get("speech_act") == "prefer" and isinstance(frame.get("locus"), dict):
        for tok in frame["locus"].get("tokens") or []:
            w = str(tok.get("w") or "").lower()
            if w and w not in {"prefer", "a", "an", "the", "or", ","} and w not in found:
                found.append(w)
    return found


def _options(frame: dict[str, Any]) -> list[str]:
    if not isinstance(frame.get("locus"), dict):
        return []
    words = [str(t.get("w") or "") for t in frame["locus"].get("tokens") or []]
    text = " ".join(w for w in words if w not in {","})
    parts = re.split(r"\bor\b", text, flags=re.I)
    if len(parts) < 2:
        return []
    out = []
    for part in parts[:2]:
        kept = [w.lower() for w in part.split() if w.lower() not in {"prefer", "a", "an", "the"}]
        if kept:
            out.append(kept[-1])
    return out[:2]


def _facts(memory: dict[str, Any], heads: list[str], expand: bool = True) -> list[dict[str, Any]]:
    rows = []
    for key in ("phone", "hosted", "self"):
        for row in memory.get(key) or []:
            if not isinstance(row, dict) or not row.get("text"):
                continue
            clause = row.get("clause") if isinstance(row.get("clause"), dict) else row.get("frame") if isinstance(row.get("frame"), dict) else {}
            names = []
            for role in ("kartr", "karma", "pred"):
                np = clause.get(role) if isinstance(clause, dict) else None
                if isinstance(np, dict) and np.get("head"):
                    names.append(str(np.get("head")).lower())
            blob = " ".join(names) + " " + str(row.get("text") or "").lower()
            if heads and not any(h in blob for h in heads):
                continue
            if str(row.get("source") or "") == "self_model" and not heads:
                continue
            rows.append({"id": row.get("id"), "text": str(row.get("text")), "source": row.get("source") or key, "kind": "fact"})
    seen = set()
    out = []
    for row in rows:
        key = row["text"].strip().lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(row)
    # A fact that shares a noun with an already cited fact is the same scene (water in a harbor fact, a boat fact).
    extra_heads = []
    for row in out:
        for word in re.findall(r"[a-z]+", row["text"].lower()):
            if word not in heads and word not in extra_heads and len(word) > 3:
                extra_heads.append(word)
    if expand and extra_heads:
        more = _facts(memory, extra_heads[:6], False)
        for row in more:
            key = row["text"].strip().lower()
            if key not in seen:
                seen.add(key)
                out.append(row)
    return out[:8]


def _scenes(facts: list[dict[str, Any]], heads: list[str]) -> list[str]:
    """A simulator question built from a fact's own measured body, not from a fixed scene."""
    scenes = []
    for fact in facts:
        text = fact["text"]
        if re.search(r"\d", text) and re.search(r"\b(tall|high|wide|deep)\b", text, re.I):
            name = None
            for head in heads:
                if head in text.lower():
                    name = head
                    break
            if not name:
                m = re.search(r"\b(?:the|a|an)\s+([a-z]+)", text, re.I)
                name = m.group(1).lower() if m else None
            if name:
                scenes.append("What happens if I push the " + name + " near the top?")
        if re.search(r"\b(water|sea|tide|harbor|boat)\b", text, re.I):
            scenes.append("What happens if I drop a boat in the water?")
    return scenes[:2]


def _sim_line(question: str, memory: list[dict[str, Any]]) -> dict[str, Any] | None:
    from rmc_engine_v1.sim_device import _effect_struct, _realize, plan, solve
    problem = plan(question, memory=memory)
    if not problem.get("ok"):
        return None
    try:
        run = solve(problem)
    except Exception:
        return None
    if not isinstance(run, dict) or run.get("error"):
        return None
    atom = _effect_struct(problem, run)
    text = _realize(atom) if atom else ""
    if not text:
        return None
    if not text.endswith("."):
        text += "."
    return {"id": problem.get("solver"), "text": text[:1].upper() + text[1:], "source": problem.get("solver"), "kind": "sim", "outcome": run.get("outcome")}


def _math_lines(question: str) -> list[dict[str, Any]]:
    from rmc_engine_v1.computed_math import compute
    lines = []
    parts = re.split(r"(?<=[.!?])\s+", question)
    for part in parts:
        try:
            row = compute(part.strip())
        except Exception:
            row = None
        if isinstance(row, dict) and row.get("status") == "ok" and row.get("sentence"):
            sentence = str(row["sentence"])
            if all(sentence != line["text"] for line in lines):
                lines.append({"id": "compute", "text": sentence, "source": "computation", "kind": "math"})
    return lines


def _opinion(options: list[str], facts: list[dict[str, Any]]) -> dict[str, Any] | None:
    if len(options) < 2:
        return None
    support = []
    for name in options:
        hit = next((f for f in facts if name in f["text"].lower()), None)
        support.append(hit)
    if support[0] and not support[1]:
        choice, why = options[0], support[0]
    elif support[1] and not support[0]:
        choice, why = options[1], support[1]
    else:
        return {"text": "Neither " + options[0] + " nor " + options[1] + " is backed by a fact.", "lines": [], "why": None}
    return {"text": "The " + choice + ". " + why["text"], "lines": [why], "why": why["id"], "choice": choice}


def compose(question: str, frame: dict[str, Any] | None, memory: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(frame, dict) or frame.get("speech_act") not in _ACTS:
        return None
    memory = memory if isinstance(memory, dict) else {}
    heads = _heads(frame)
    facts = _facts(memory, heads)
    phone = [r for r in (memory.get("phone") or []) if isinstance(r, dict)]
    sims = []
    for scene in _scenes(facts, heads):
        line = _sim_line(scene, phone)
        if line:
            sims.append(line)
    maths = _math_lines(question)
    form = frame.get("expressive") or ("lines" if frame.get("speech_act") == "compose" else "prose")
    if frame.get("speech_act") == "prefer":
        opinion = _opinion(_options(frame), facts)
        if not opinion:
            return None
        why = opinion["text"]
        if opinion.get("choice"):
            from rmc_engine_v1.rmc_core import run
            derived = run({"question": "What is a " + opinion["choice"] + "?", "live": True, "memory": memory})
            if derived.get("product_reply") and derived.get("reply"):
                why = "The " + opinion["choice"] + ". " + str(derived["reply"])
                opinion["lines"] = opinion["lines"] + [{"id": "derive", "text": derived["reply"], "source": "derive", "kind": "derive"}]
        return {
            "text": why, "form": "prose", "persisted": False, "calls_llm": False,
            "facts": facts, "sims": [], "math": [], "lines": opinion["lines"], "why": opinion.get("why"),
            "well_formed": True,
        }
    lines = facts + sims + maths
    if not lines:
        topic = heads[0] if heads else "that"
        text = "I have no fact about the " + topic + "."
        return {"text": text, "form": form, "persisted": False, "calls_llm": False, "facts": [], "sims": [], "math": [], "lines": [], "well_formed": True}
    body = [row["text"].strip() for row in lines if row.get("text")]
    text = ("\n".join(body) if form == "lines" else " ".join(body))
    return {
        "text": text, "form": form, "persisted": False, "calls_llm": False,
        "facts": facts, "sims": sims, "math": maths, "lines": lines, "well_formed": True,
    }
