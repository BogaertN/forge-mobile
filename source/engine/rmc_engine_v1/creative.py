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
        clause = row.get("clause") if isinstance(row.get("clause"), dict) else {}
        for role in ("kartr", "karma", "pred"):
            np = clause.get(role)
            word = str(np.get("head") or "").lower() if isinstance(np, dict) else ""
            if word and word not in heads and word not in extra_heads and len(word) > 3:
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
    mods = []
    for adj in cl.get("adj") or []:
        if isinstance(adj, dict) and adj.get("prep") and isinstance(adj.get("np"), dict):
            mods.append({"prep": adj.get("prep"), "text": str(adj["np"].get("text") or adj["np"].get("head") or ""), "role": adj.get("role")})
    if verb and verb != "be" and (karma_text or mods):
        pol = "neg" if cl.get("polarity") == "neg" else "pos"
        args = [subject, karma_text] if karma_text else [subject]
        return _karaka(verb, args, polarity=pol, tense=tense, modifiers=mods or None)
    if pred.get("text"):
        return _karaka("be", [subject, str(pred.get("text"))], tense=tense)
    return None


def _kin_facts(facts: list[dict[str, Any]], topic: str | None) -> list[dict[str, Any]]:
    """Facts about a noun that a topic fact already names. A harbor fact that names water may bring the boat.
    A noun the prompt did not ask about, and that no topic fact names, stays out.
    """
    named: set[str] = set()
    for fact in facts:
        for node in _walk_clauses(fact.get("clause") or {}):
            if not isinstance(node, dict):
                continue
            head = _head_of(node.get("kartr"))
            if topic and head and head != topic:
                continue
            for role in ("karma", "pred"):
                np = node.get(role) if isinstance(node.get(role), dict) else {}
                if np.get("num") is not None:
                    continue
                other = _head_of(np)
                if other and other != topic:
                    named.add(other)
            for adj in node.get("adj") or []:
                if isinstance(adj, dict):
                    other = _head_of(adj.get("np"))
                    if other and other != topic:
                        named.add(other)
    kin = []
    for fact in facts:
        heads = []
        linked = False
        for node in _walk_clauses(fact.get("clause") or {}):
            if not isinstance(node, dict):
                continue
            head = _head_of(node.get("kartr"))
            if head:
                heads.append(head)
            nouns = [head, _head_of(node.get("karma")), _head_of(node.get("pred"))]
            for adj in node.get("adj") or []:
                if isinstance(adj, dict):
                    nouns.append(_head_of(adj.get("np")))
            if any(n in named for n in nouns if n):
                linked = True
        if topic and any(h == topic for h in heads):
            continue
        if linked:
            kin.append(fact)
    return kin


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
    from rmc_engine_v1.sim_device import _reason_struct
    reason = _reason_struct(problem, run)
    before, after = _state_pair(problem, run)
    return {
        "id": problem.get("solver"), "text": text, "source": problem.get("solver"), "kind": "sim",
        "outcome": run.get("outcome"), "atom": atom, "reason_atom": reason,
        "reason_text": _realize(reason) if reason else "",
        "before": before, "after": after, "question": question,
    }


def _sim_from_receipt(sim: dict[str, Any]) -> dict[str, Any] | None:
    """A receipt the phone already measured on its own sim path."""
    if not isinstance(sim, dict):
        return None
    spoken = [x for x in (sim.get("spoken_atoms") or []) if isinstance(x, dict)]
    effect = next((x for x in spoken if x.get("role") == "effect"), None)
    reason = next((x for x in spoken if x.get("role") == "reason"), None)
    text = str((effect or {}).get("text") or sim.get("effect_text") or "").strip()
    if not text:
        return None
    solver = str(sim.get("solver") or "")
    return {
        "id": solver, "text": text, "source": solver, "kind": "sim",
        "outcome": sim.get("outcome"), "atom": (effect or {}).get("atom"),
        "reason_atom": (reason or {}).get("atom"),
        "reason_text": str((reason or {}).get("text") or sim.get("causal_reason") or ""),
        "before": sim.get("state_before"), "after": sim.get("state_after"),
        "question": sim.get("question"),
    }


def _math_lines(question: str) -> tuple[list[dict[str, Any]], list[str]]:
    from rmc_engine_v1.computed_math import compute
    lines = []
    needs: list[str] = []
    parts = re.split(r"(?<=[.!?])\s+", question)
    for part in parts:
        try:
            row = compute(part.strip())
        except Exception:
            row = None
        if not isinstance(row, dict):
            continue
        if row.get("status") == "needs_libs":
            for name in row.get("needs_libs") or []:
                if name not in needs:
                    needs.append(str(name))
            continue
        if row.get("status") == "ok" and row.get("sentence"):
            sentence = str(row["sentence"])
            if all(sentence != line["text"] for line in lines):
                lines.append({"id": "compute", "text": sentence, "source": "computation", "kind": "math", "atom": None})
    return lines, needs


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


def _gathered(memory: dict[str, Any]) -> dict[str, Any]:
    """Clauses Athena already gathered for this turn. Admitted ones are facts. A single source is imagery only."""
    raw = memory.get("creative_clauses") if isinstance(memory.get("creative_clauses"), dict) else {}
    facts = []
    for row in raw.get("clauses") or []:
        if not isinstance(row, dict) or not row.get("text"):
            continue
        if not (row.get("admitted") or row.get("single_source")):
            continue
        facts.append({
            "id": "athena:" + str(row.get("claim") or row.get("text"))[:80],
            "text": str(row.get("text")),
            "source": "athena",
            "kind": "fact" if row.get("admitted") else "imagery",
            "clause": row.get("clause") if isinstance(row.get("clause"), dict) else {},
            "source_count": row.get("source_count"),
            "publishers": row.get("publishers") or [],
            "admitted": bool(row.get("admitted")),
            "single_source": bool(row.get("single_source")),
            "fact": bool(row.get("fact")),
            "persisted": False,
        })
    summary = {
        "topic": raw.get("topic"),
        "atoms": raw.get("atoms") or [],
        "queried": raw.get("queried") or [],
        "admitted": raw.get("admitted") or 0,
        "single": raw.get("single") or 0,
        "creative_persisted": False,
    } if raw else None
    return {"facts": facts, "summary": summary}


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


def _walk_clauses(cl: Any):
    if not isinstance(cl, dict):
        return
    nested = cl.get("clauses") if isinstance(cl.get("clauses"), list) and cl.get("clauses") else None
    if nested is None and isinstance(cl.get("sentences"), list) and cl.get("sentences"):
        nested = cl.get("sentences")
    if nested:
        for child in nested:
            yield from _walk_clauses(child)
        return
    yield cl


def _sim_about(sim: dict[str, Any], heads: list[str], facts: list[dict[str, Any]]) -> bool:
    """A simulator result belongs only when its question names the topic or a noun in the topic's facts."""
    blob = (str(sim.get("question") or "") + " " + str(sim.get("text") or "")).lower()
    if any(h and h in blob for h in heads):
        return True
    nouns = set()
    for fact in facts:
        clause = fact.get("clause") if isinstance(fact.get("clause"), dict) else {}
        for role in ("kartr", "karma", "pred"):
            np = clause.get(role)
            if isinstance(np, dict) and np.get("head"):
                nouns.add(str(np.get("head")).lower())
    return any(n in blob for n in nouns if n not in set(heads))


def _fact_picture(facts: list[dict[str, Any]], topic: str | None) -> dict[str, Any]:
    """The user's noun stays the subject. An is-a fact is an appositive, not a new subject.
    Measures fold into that same noun. The chain is the cited classes, in order.
    """
    subject = topic or ""
    isa = None
    measures: list[str] = []
    events: list[dict[str, Any]] = []
    chain = [topic] if topic else []
    for fact in facts:
        for node in _walk_clauses(fact.get("clause") or {}):
            if not isinstance(node, dict):
                continue
            head = _head_of(node.get("kartr"))
            if head and not subject:
                subject = head
                if head not in chain:
                    chain.insert(0, head)
            if topic and head and head != topic:
                continue
            pred = node.get("pred") if isinstance(node.get("pred"), dict) else {}
            verb = str(node.get("kriya") or "")
            if verb == "be" and pred.get("type") == "np" and (pred.get("head") or pred.get("text")):
                isa = str(pred.get("head") or pred.get("text"))
                if isa and isa not in chain:
                    chain.append(isa)
                continue
            if pred.get("type") == "measure" and pred.get("num") is not None:
                bit = str(pred.get("num")) + " " + str(pred.get("unit") or "")
                prop = str(pred.get("property") or "").strip()
                if prop:
                    bit += " " + prop
                measures.append(bit.strip())
                continue
            karma = node.get("karma") if isinstance(node.get("karma"), dict) else {}
            if verb and verb != "be":
                karma_text = str(karma.get("text") or karma.get("head") or "").strip()
                events.append({
                    "verb": verb,
                    "karma": karma_text,
                    "pol": "neg" if node.get("polarity") == "neg" else "pos",
                })
    return {"subject": subject, "isa": isa, "measures": measures, "events": events, "chain": chain}


def _setting_atom(picture: dict[str, Any], tense: str) -> dict[str, Any] | None:
    from rmc_engine_v1.sim_device import _karaka
    subject = picture.get("subject") or ""
    if not subject:
        return None
    who = "the " + subject
    meta = {}
    if picture.get("isa") and picture["isa"] != subject:
        det = "an" if str(picture["isa"])[:1].lower() in "aeiou" else "a"
        # A cited class is a relative clause when the noun also does something ("the mink that is a mammal").
        # A measure list takes the comma appositive instead, which is the shape the grammar reads back.
        if picture.get("events") and not picture.get("measures"):
            meta["rel_be"] = det + " " + str(picture["isa"])
        else:
            meta["appos"] = det + " " + str(picture["isa"])
    events = list(picture.get("events") or [])
    if events:
        if picture.get("measures"):
            meta["measures"] = picture["measures"]
        main = next((ev for ev in events if ev.get("karma")), events[0])
        prior = next((ev for ev in events if ev is not main), None)
        args = [who, main["karma"]] if main.get("karma") else [who]
        atom = _karaka(main["verb"], args, polarity=main["pol"], tense=tense)
        # A second stated event is the time clause. The one with an object stays the consequence,
        # because that is the shape the grammar reads back.
        if prior and main.get("karma"):
            pargs = [who, prior["karma"]] if prior.get("karma") else [who]
            atom["front"] = {"conj": "after", "atom": _karaka(prior["verb"], pargs, polarity=prior["pol"], tense=tense)}
            picture["extra"] = [ev for ev in events if ev is not main and ev is not prior]
        else:
            picture["extra"] = [ev for ev in events if ev is not main]
    elif picture.get("isa"):
        atom = _karaka("be", [who, meta.get("appos") or picture["isa"]], tense=tense)
        meta.pop("appos", None)
    elif picture.get("measures"):
        atom = _karaka("be", [who, picture["measures"][0]], tense=tense)
        atom["pred_parts"] = picture["measures"]
    else:
        return None
    if meta:
        atom["subject"] = meta
    atom["chain"] = picture.get("chain") or []
    return atom


def _arc(form: str, tense: str, facts: list[dict[str, Any]], sims: list[dict[str, Any]], maths: list[dict[str, Any]], topic: str | None = None) -> list[dict[str, Any]]:
    """One subject, the user's noun. Measures and the cited class fold into it.
    A sim is the next clause: its before-state is a time clause, its mechanism is because.
    """
    beats: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(beat: dict[str, Any] | None) -> None:
        if not beat or not beat.get("text"):
            return
        key = re.sub(r"\s+", " ", str(beat["text"]).strip().lower())
        if key in seen:
            return
        seen.add(key)
        beats.append(beat)

    picture = _fact_picture(facts, topic)
    setting = _setting_atom(picture, tense)
    if not setting:
        # A gathered sentence the clause reader did not split still counts as imagery. It is quoted, not a new fact.
        for fact in facts:
            if fact.get("source") == "athena" and fact.get("text") and (not topic or topic in str(fact.get("text")).lower()):
                spoken = _beat(str(fact["text"]), None, "setting", "athena", fact.get("id"))
                spoken["source_count"] = fact.get("source_count")
                spoken["single_source"] = fact.get("single_source")
                add(spoken)
                break
    if setting:
        beat = _speak_beat(setting, "", "setting", "fact", None)
        if beat:
            beat["chain"] = setting.get("chain") or []
            add(beat)
    for fact in _kin_facts(facts, picture.get("subject") or topic):
        add(_speak_beat(_imagery_atom(fact, tense), "", "setting", str(fact.get("source") or "fact"), fact.get("id")))
    for ev in picture.get("extra") or []:
        who = "the " + str(picture.get("subject") or "")
        args = [who, ev["karma"]] if ev.get("karma") else [who]
        from rmc_engine_v1.sim_device import _karaka
        add(_speak_beat(_karaka(ev["verb"], args, polarity=ev["pol"], tense=tense), "", "setting", "fact", None))
    for sim in sims:
        src = str(sim.get("source") or "sim")
        before = _state_atom(sim.get("before"), "present")
        effect = dict(sim["atom"]) if isinstance(sim.get("atom"), dict) else None
        reason = sim.get("reason_atom") if isinstance(sim.get("reason_atom"), dict) else None
        # Fold the topic's measures into the effect's subject once, not as extra lines.
        if effect and picture.get("measures") and not any(b.get("kind") == "setting" for b in beats):
            effect["subject"] = {"measures": picture["measures"]}
        if effect and reason:
            effect["sub"] = {"conj": "because", "atom": reason}
        if before and effect:
            effect["front"] = {"conj": "after", "atom": before}
        add(_speak_beat(effect, sim.get("text") or "", "after", src, sim.get("id")))
    for row in maths:
        add(_beat(row["text"], None, "math", "computation", "compute"))
    return beats


def _format(form: str, beats: list[dict[str, Any]]) -> str:
    lines = [b["text"].strip() for b in beats if b.get("text")]
    if form != "lines":
        return " ".join(lines)
    # The lexicon senses carry no syllable count. Line rhythm is the clause length.
    if len(lines) < 3:
        return "\n".join(lines)
    lengths = [len(t.split()) for t in lines]
    med = sorted(lengths)[len(lengths) // 2]
    mad = sorted(abs(n - med) for n in lengths)[len(lengths) // 2]
    gap = max(mad, 1)
    groups = [[lines[0]]]
    for i in range(1, len(lines)):
        if abs(lengths[i] - lengths[i - 1]) > gap:
            groups.append([])
        groups[-1].append(lines[i])
    return "\n\n".join("\n".join(g) for g in groups if g)


def compose(question: str, frame: dict[str, Any] | None, memory: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(frame, dict) or frame.get("speech_act") not in _ACTS:
        return None
    memory = memory if isinstance(memory, dict) else {}
    heads = _heads(frame)
    facts = _facts(memory, heads)
    gathered = _gathered(memory)
    for row in gathered["facts"]:
        key = row["text"].strip().lower()
        if key and all(key != str(f.get("text") or "").strip().lower() for f in facts):
            facts.append(row)
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
    supplied = memory.get("creative_sims") if isinstance(memory.get("creative_sims"), list) else None
    if supplied is not None:
        # The phone already measured these on its sim path. Do not plan again (that would need Node).
        for row in supplied:
            line = _sim_from_receipt(row if isinstance(row, dict) and row.get("spoken_atoms") else (row.get("sim") if isinstance(row, dict) else None))
            if not line or not line.get("source") or line["source"] in seen_solvers:
                continue
            if not _sim_about(line, heads, facts):
                continue
            seen_solvers.add(line["source"])
            sims.append(line)
    elif frame.get("speech_act") != "prefer":
        for scene in questions_for_rows(scene_rows):
            line = _sim_line(scene, phone)
            if not line or line.get("source") in seen_solvers:
                continue
            seen_solvers.add(line.get("source"))
            if not _sim_about(line, heads, facts):
                continue
            sims.append(line)
            if len(sims) >= 4:
                break
    maths, needs_libs = _math_lines(question)
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
                "well_formed": bool(gap.get("text")), "athena": athena, "gather": gathered["summary"], "needs_libs": needs_libs,
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
            "why": opinion.get("why"), "well_formed": bool(text), "athena": athena, "gather": gathered["summary"], "needs_libs": needs_libs,
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
                "well_formed": bool(gap.get("text")), "athena": athena, "gather": gathered["summary"], "needs_libs": needs_libs,
            }
    topic = heads[0] if heads else None
    beats = _arc(form, tense, facts, sims, maths, topic)
    if not beats:
        topic = heads[0] if heads else "that"
        gap = _gap_line(topic, athena or {})
        return {
            "text": gap["text"], "form": form, "persisted": False, "calls_llm": False,
            "facts": facts, "sims": sims, "math": maths, "lines": [gap], "beats": [gap],
            "well_formed": bool(gap.get("text")), "athena": athena, "gather": gathered["summary"], "needs_libs": needs_libs,
        }
    text = _format(form, beats)
    return {
        "text": text, "form": form, "persisted": False, "calls_llm": False,
        "facts": facts, "sims": sims, "math": maths, "lines": beats, "beats": beats,
        "well_formed": bool(text), "athena": athena, "gather": gathered["summary"], "needs_libs": needs_libs,
    }
