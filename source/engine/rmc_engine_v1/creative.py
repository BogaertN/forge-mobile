"""Creative and opinion replies. An arc of kāraka atoms, realized by grammar.js.

Setting imagery comes from a cited fact's own roles. A transition is the simulator's before
state and its effect atom. A consequence is that effect after the before state, joined by a
conjunction the grammar already has. Nothing here is stored, and nothing is handed to Gilligan
as a fact.
"""
from __future__ import annotations

import re
from typing import Any

_ACTS = {"compose", "narrate", "describe", "prefer"}
_CONJ = {"transition": "after", "reason": "because"}


def _heads(frame: dict[str, Any]) -> list[str]:
    found: list[str] = []

    def add(np: Any) -> None:
        if isinstance(np, dict):
            head = str(np.get("head") or "").strip().lower()
            if head and head not in found and head not in {"you", "kernel", "poem", "story"}:
                found.append(head)
            for child in np.get("conj") or []:
                add(child)

    add(frame.get("karma"))
    add(frame.get("kartr"))
    for adj in frame.get("adj") or []:
        if isinstance(adj, dict):
            add(adj.get("np"))
    for name in frame.get("prefer_options") or []:
        w = str(name or "").strip().lower()
        if w and w not in found:
            found.append(w)
    return found


def _options(frame: dict[str, Any]) -> list[str]:
    named = [str(x).strip().lower() for x in (frame.get("prefer_options") or []) if str(x).strip()]
    if len(named) >= 2:
        return named[:2]
    if not isinstance(frame.get("locus"), dict):
        return named[:2]
    words = [str(t.get("w") or "") for t in frame["locus"].get("tokens") or []]
    text = " ".join(w for w in words if w not in {","})
    parts = re.split(r"\bor\b", text, flags=re.I)
    if len(parts) < 2:
        return named[:2]
    out = []
    for part in parts[:2]:
        kept = [w.lower() for w in part.split() if w.lower() not in {"prefer", "a", "an", "the", "rather", "would", "you"}]
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
                if isinstance(np, dict):
                    for child in np.get("conj") or []:
                        if isinstance(child, dict) and child.get("head"):
                            names.append(str(child.get("head")).lower())
            blob = " ".join(names) + " " + str(row.get("text") or "").lower()
            if heads and not any(h in blob for h in heads):
                continue
            if str(row.get("source") or "") == "self_model" and not heads:
                continue
            rows.append({
                "id": row.get("id"), "text": str(row.get("text")), "source": row.get("source") or key,
                "kind": "fact", "clause": clause if isinstance(clause, dict) else {},
            })
    seen = set()
    out = []
    for row in rows:
        key = row["text"].strip().lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(row)
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


def _realize(atom: dict[str, Any] | None) -> str:
    from rmc_engine_v1.sim_device import _realize as speak
    text = speak(atom) if atom else ""
    return text.strip()


def _head_of(np: Any) -> str:
    if isinstance(np, dict):
        return str(np.get("head") or "").strip().lower()
    return ""


def _imagery_atom(fact: dict[str, Any], tense: str) -> dict[str, Any] | None:
    """One clause from the fact's own kartṛ, kriyā and karma or measure. Not a stock image."""
    from rmc_engine_v1.sim_device import _karaka
    cl = fact.get("clause") if isinstance(fact.get("clause"), dict) else {}
    clauses = cl.get("clauses") if isinstance(cl.get("clauses"), list) else cl.get("sentences") if isinstance(cl.get("sentences"), list) else None
    if clauses:
        cl = next((c for c in clauses if isinstance(c, dict) and c.get("kriya")), cl)
    head = _head_of(cl.get("kartr"))
    if not head:
        return None
    subject = "the " + head
    pred = cl.get("pred") if isinstance(cl.get("pred"), dict) else {}
    if pred.get("type") == "measure" and pred.get("num") is not None:
        prop = str(pred.get("property") or "").strip()
        right = str(pred.get("num")) + " " + str(pred.get("unit") or "")
        if prop:
            right = right + " " + prop
        return _karaka("be", [subject, right.strip()], tense=tense)
    verb = str(cl.get("kriya") or "")
    karma = cl.get("karma") if isinstance(cl.get("karma"), dict) else {}
    karma_text = str(karma.get("text") or karma.get("head") or "").strip()
    if verb and verb != "be" and karma_text:
        pol = "neg" if cl.get("polarity") == "neg" else "pos"
        return _karaka(verb, [subject, karma_text], polarity=pol, tense=tense)
    if pred.get("text"):
        return _karaka("be", [subject, str(pred.get("text"))], tense=tense)
    return None


def _state_atom(state: dict[str, Any] | None, tense: str) -> dict[str, Any] | None:
    from rmc_engine_v1.sim_device import _karaka
    if not isinstance(state, dict):
        return None
    patient = state.get("patient") or state.get("substance") or state.get("species")
    if not patient:
        return None
    motion = str(state.get("motion") or "")
    phase = str(state.get("phase") or "")
    verb = motion or phase
    if verb in ("", "initial", "out", "None"):
        verb = "rest"
    name = str(patient).strip()
    if not name.lower().startswith("the "):
        name = "the " + name
    return _karaka(verb, [name], tense=tense)


def _beat(text: str, atom: dict[str, Any] | None, kind: str, source: str, source_id: Any = None) -> dict[str, Any]:
    return {"text": text, "atom": atom, "kind": kind, "source": source, "id": source_id}


def _speak_beat(atom: dict[str, Any] | None, fallback: str, kind: str, source: str, source_id: Any = None) -> dict[str, Any] | None:
    text = _realize(atom) if atom else ""
    if not text:
        text = fallback
        atom = None
    if not text:
        return None
    return _beat(text, atom, kind, source, source_id)


def _sim_line(question: str, memory: list[dict[str, Any]]) -> dict[str, Any] | None:
    from rmc_engine_v1.sim_device import _effect_struct, _realize, _state_pair, plan, solve
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
    before, after = _state_pair(problem, run)
    return {
        "id": problem.get("solver"), "text": text, "source": problem.get("solver"), "kind": "sim",
        "outcome": run.get("outcome"), "atom": atom, "before": before, "after": after, "question": question,
    }


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
                lines.append({"id": "compute", "text": sentence, "source": "computation", "kind": "math", "atom": None})
    return lines


def _members(facts: list[dict[str, Any]], heads: list[str]) -> list[str]:
    """Subjects of cited facts whose predicate is one of the asked heads ("a drum is an instrument")."""
    found = []
    for fact in facts:
        cl = fact.get("clause") if isinstance(fact.get("clause"), dict) else {}
        pred = cl.get("pred") if isinstance(cl.get("pred"), dict) else {}
        pred_head = str(pred.get("head") or "").lower()
        subj = ""
        kartr = cl.get("kartr") if isinstance(cl.get("kartr"), dict) else {}
        subj = str(kartr.get("head") or "").lower()
        if subj and pred_head and pred_head in heads and subj not in found:
            found.append(subj)
    return found


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
        return {"text": "", "lines": [], "why": None, "choice": None, "unranked": options}
    return {"text": "", "lines": [why], "why": why["id"], "choice": choice}


def _opinion_text(opinion: dict[str, Any], derived: str | None) -> tuple[str, list[dict[str, Any]]]:
    from rmc_engine_v1.sim_device import _karaka
    lines = list(opinion.get("lines") or [])
    if opinion.get("unranked"):
        a, b = opinion["unranked"]
        atom = _karaka("rank", ["no fact", "the " + a], polarity="neg", modifiers=[{"role": "sambandha", "prep": "or", "text": "the " + b}])
        text = _realize(atom) or ("No fact ranks the " + a + " or the " + b + ".")
        return text, lines
    choice = opinion.get("choice")
    why = lines[0]["text"] if lines else ""
    atom = _karaka("be", ["the " + str(choice), "the choice"])
    lead = _realize(atom) or ("The " + str(choice) + ".")
    body = lead
    if derived:
        body = lead + " " + derived
        lines = lines + [{"id": "derive", "text": derived, "source": "derive", "kind": "derive"}]
    elif why:
        because = _karaka("be", ["the " + str(choice), "the choice"], sub={"conj": "because", "atom": _imagery_atom(lines[0], "present") or _karaka("be", ["the " + str(choice), why.rstrip(".")])})
        spoken = _realize(because)
        body = spoken or (lead + " " + why)
    return body, lines


def _athena(topic: str, question: str, frame: dict[str, Any] | None) -> dict[str, Any]:
    """A gap handed to Athena. The proposals stay on this turn. Nothing is written."""
    try:
        from rmc_engine_v1.athena_props import fill_gap
        found = fill_gap({
            "question": "What is a " + topic + "?",
            "qframe": frame if isinstance(frame, dict) else None,
            "sim": {"reason": "unknown_body", "body": topic},
        })
    except Exception as exc:
        return {"rule": "ATHENA-UNREACHABLE", "facts": [], "phone_remember": False, "error": str(exc)[:160]}
    facts = []
    for prop in found.get("proposals") or []:
        if not isinstance(prop, dict):
            continue
        text = str(prop.get("text") or "").strip()
        unit = str(prop.get("unit") or "").strip()
        if not text:
            value = prop.get("value")
            head = prop.get("head") or topic
            property_ = prop.get("property") or "value"
            if value is None:
                continue
            shown = str(value) + ((" " + unit) if unit else "")
            text = "The " + str(property_) + " of the " + str(head) + " is " + shown + "."
        elif unit and unit not in text:
            text = text.rstrip(".") + " " + unit + "."
        facts.append({
            "id": prop.get("id") or ("athena:" + topic), "text": text, "source": "athena",
            "kind": "fact", "persisted": False, "clause": prop.get("clause") if isinstance(prop.get("clause"), dict) else {},
        })
    return {"rule": found.get("rule"), "facts": facts, "phone_remember": False, "supabase_write": False}


def _gap_line(topic: str, athena: dict[str, Any]) -> dict[str, Any]:
    from rmc_engine_v1.sim_device import _karaka, _mod
    atom = _karaka("have", ["I", "a fact"], polarity="neg", modifiers=[_mod("about", "the " + topic, "vishaya")])
    text = _realize(atom) or ("I have no fact about the " + topic + ".")
    return _beat(text, atom if text and atom else None, "gap", "athena", athena.get("rule"))


def _arc(form: str, tense: str, facts: list[dict[str, Any]], sims: list[dict[str, Any]], maths: list[dict[str, Any]]) -> list[dict[str, Any]]:
    from rmc_engine_v1.sim_device import _karaka
    beats: list[dict[str, Any]] = []
    for fact in facts:
        atom = _imagery_atom(fact, tense)
        beat = _speak_beat(atom, fact.get("text") or "", "setting", str(fact.get("source") or "fact"), fact.get("id"))
        if beat:
            beats.append(beat)
    for sim in sims:
        before = _state_atom(sim.get("before"), tense)
        after = dict(sim["atom"]) if isinstance(sim.get("atom"), dict) else None
        if after is not None and tense != "past":
            after["tense"] = tense
        if form == "lines":
            b1 = _speak_beat(before, "", "before", str(sim.get("source") or "sim"), sim.get("id"))
            b2 = _speak_beat(after, sim.get("text") or "", "after", str(sim.get("source") or "sim"), sim.get("id"))
            if b1:
                beats.append(b1)
            if b2:
                beats.append(b2)
            if before and after:
                linked = dict(after)
                linked["sub"] = {"conj": _CONJ["transition"], "atom": before}
                b3 = _speak_beat(linked, "", "consequence", str(sim.get("source") or "sim"), sim.get("id"))
                if b3 and b3["text"] not in (b1["text"] if b1 else "", b2["text"] if b2 else ""):
                    beats.append(b3)
        else:
            # The solver's atom keeps the tense it was measured in. Forcing a past on an
            # irregular verb ("slide") realizes a form the grammar will not read back.
            if before and after:
                linked = dict(after)
                linked["sub"] = {"conj": _CONJ["transition"], "atom": before}
                beat = _speak_beat(linked, sim.get("text") or "", "transition", str(sim.get("source") or "sim"), sim.get("id"))
            else:
                beat = _speak_beat(after, sim.get("text") or "", "after", str(sim.get("source") or "sim"), sim.get("id"))
            if beat:
                beats.append(beat)
    for row in maths:
        beats.append(_beat(row["text"], None, "math", "computation", "compute"))
    if sims and form == "lines":
        last = sims[-1]
        patient = (last.get("before") or {}).get("patient") or (last.get("after") or {}).get("patient")
        if patient:
            name = str(patient)
            if not name.lower().startswith("the "):
                name = "the " + name
            reason = _state_atom(last.get("before"), tense)
            atom = _karaka(str((last.get("atom") or {}).get("predicate") or "change"), [name], tense=tense)
            if reason:
                atom = dict(atom)
                atom["sub"] = {"conj": _CONJ["reason"], "atom": reason}
            beat = _speak_beat(atom, "", "consequence", str(last.get("source") or "sim"), last.get("id"))
            if beat and all(beat["text"] != b["text"] for b in beats):
                beats.append(beat)
    return [b for b in beats if b.get("text")]


def _format(form: str, beats: list[dict[str, Any]]) -> str:
    if form != "lines":
        return " ".join(b["text"].strip() for b in beats if b.get("text"))
    setting = [b["text"].strip() for b in beats if b.get("kind") == "setting"]
    rest = [b["text"].strip() for b in beats if b.get("kind") != "setting"]
    parts = []
    if setting:
        parts.append("\n".join(setting))
    if rest:
        parts.append("\n".join(rest))
    return "\n\n".join(parts)


def compose(question: str, frame: dict[str, Any] | None, memory: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(frame, dict) or frame.get("speech_act") not in _ACTS:
        return None
    memory = memory if isinstance(memory, dict) else {}
    heads = _heads(frame)
    facts = _facts(memory, heads)
    athena = None
    if not facts and heads:
        athena = _athena(heads[0], question, frame)
        if athena.get("facts"):
            facts = athena["facts"]
    phone = []
    for key in ("phone", "hosted", "self"):
        phone.extend(r for r in (memory.get(key) or []) if isinstance(r, dict))
    cited = {row["text"].strip().lower() for row in facts}
    scene_rows = [r for r in phone if str(r.get("text") or "").strip().lower() in cited]
    have = {str(r.get("text") or "").strip().lower() for r in scene_rows}
    for fact in facts:
        key = str(fact.get("text") or "").strip().lower()
        if key and key not in have:
            scene_rows.append(fact)
            have.add(key)
    from rmc_engine_v1.sim_karaka import questions_for_rows
    sims = []
    seen_solvers = set()
    for scene in questions_for_rows(scene_rows):
        line = _sim_line(scene, phone)
        if not line or line.get("source") in seen_solvers:
            continue
        seen_solvers.add(line.get("source"))
        sims.append(line)
        if len(sims) >= 4:
            break
    maths = _math_lines(question)
    act = frame.get("speech_act")
    form = "lines" if act == "compose" else "prose"
    tense = "past" if act == "narrate" else "present"
    if act == "prefer":
        options = _options(frame)
        if len(options) < 2:
            options = _members(facts, heads) or options
        opinion = _opinion(options, facts) if len(options) >= 2 else None
        if opinion is None and len(options) == 1:
            hit = next((f for f in facts if options[0] in f["text"].lower()), None)
            opinion = {"text": "", "lines": [hit] if hit else [], "why": hit.get("id") if hit else None, "choice": options[0]}
        if not opinion:
            topic = heads[0] if heads else "that"
            if athena is None:
                athena = _athena(topic, question, frame)
            gap = _gap_line(topic, athena or {})
            return {
                "text": gap["text"], "form": "prose", "persisted": False, "calls_llm": False,
                "facts": facts, "sims": [], "math": [], "lines": [gap], "beats": [gap],
                "well_formed": bool(gap.get("text")), "athena": athena,
            }
        derived = None
        if opinion.get("choice"):
            from rmc_engine_v1.rmc_core import run
            chain = run({"question": "What is a " + opinion["choice"] + "?", "live": True, "memory": memory})
            if chain.get("product_reply") and chain.get("reply"):
                derived = str(chain["reply"])
        text, lines = _opinion_text(opinion, derived)
        return {
            "text": text, "form": "prose", "persisted": False, "calls_llm": False,
            "facts": facts, "sims": [], "math": [], "lines": lines, "beats": lines,
            "why": opinion.get("why"), "well_formed": bool(text), "athena": athena,
        }
    if not facts and not sims and not maths:
        topic = heads[0] if heads else "that"
        if athena is None:
            athena = _athena(topic, question, frame)
            facts = athena.get("facts") or []
        if not facts:
            gap = _gap_line(topic, athena or {})
            return {
                "text": gap["text"], "form": form, "persisted": False, "calls_llm": False,
                "facts": [], "sims": [], "math": [], "lines": [gap], "beats": [gap],
                "well_formed": bool(gap.get("text")), "athena": athena,
            }
    beats = _arc(form, tense, facts, sims, maths)
    if not beats:
        return None
    text = _format(form, beats)
    return {
        "text": text, "form": form, "persisted": False, "calls_llm": False,
        "facts": facts, "sims": sims, "math": maths, "lines": beats, "beats": beats,
        "well_formed": bool(text), "athena": athena,
    }
