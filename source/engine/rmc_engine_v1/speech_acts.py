"""4.9.241 speech-act lexicon (Nic: natural conversation; plan 229 step 10). No model, no phrase book.

speech_acts.json holds general English conversational acts as meanings: the act, the surface forms that perform it,
the act that answers it (the second part of its adjacency pair) and its kāraka frame. Nothing here stores a reply
line. A reply is the expected response act realized from that act's own forms:
  - a reciprocal act (greet → greet, farewell → farewell) is realized in the asker's own form, the register the
    asker chose;
  - another act is realized in the first form of the response act that names the act it answers ("of"), or else
    its first general form (thank → acknowledge, in the acknowledge form marked of: thank).
An act answered by its frame (ask_wellbeing, ask_help) is not answered here: the phone compiles it to its kāraka frame
and the world model answers it from the kernel's facts, like any question.

Measurement (never forced): the response is measured by the same kernel (measurement_kernel.measure_candidate and
coherence_components, formula unchanged) against one memory node, the lexicon item it realizes; the node's weight is
the act's lexical match (words of the turn the matched forms cover); the phase is the question's. Echo is structural:
the reply is re-read with the same lexicon and must be the expected response act to each act, and nothing else.
Mirrored in src/speech_acts.js; the data and the classifier are suite-checked to agree.
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

SCHEMA = "forge.speech_acts/v1"
_LEX: dict[str, Any] | None = None
_TOKEN = re.compile(r"[a-z0-9']+|[,.!?;:]")
_BOUNDARY = {",", ".", "!", "?", ";", ":"}


def lexicon() -> dict[str, Any]:
    global _LEX
    if _LEX is None:
        _LEX = json.loads(Path(__file__).with_name("speech_acts.json").read_text(encoding="utf-8"))
    return _LEX


def _norm(text: Any) -> str:
    return str(text or "").replace("\u2019", "'").replace("\u2018", "'").lower()


def _tokens(text: str) -> list[tuple[str, int, int]]:
    return [(m.group(0), m.start(), m.end()) for m in _TOKEN.finditer(_norm(text))]


def _forms() -> list[tuple[list[str], str, dict[str, Any]]]:
    out = []
    for act, entry in (lexicon().get("acts") or {}).items():
        for f in entry.get("forms") or []:
            out.append((str(f["form"]).split(), act, f))
    out.sort(key=lambda x: -len(x[0]))  # longest form first
    return out


def classify(text: str) -> dict[str, Any]:
    """The acts the utterance performs from its start, each a whole lexicon form ending at punctuation or at the end
    of the utterance, and the rest of the utterance after them. Nothing is guessed: no form, no act."""
    toks = _tokens(text)
    words = [t for t in toks if t[0] not in _BOUNDARY]
    acts: list[dict[str, Any]] = []
    i = 0
    end_char = 0
    while i < len(toks):
        while i < len(toks) and toks[i][0] in _BOUNDARY:
            i += 1
        if i >= len(toks):
            break
        hit = None
        for form, act, rec in _forms():
            n = len(form)
            seg = [t[0] for t in toks[i:i + n]]
            if seg == form and (i + n == len(toks) or toks[i + n][0] in _BOUNDARY):
                hit = (form, act, rec, n)
                break
        if not hit:
            break
        form, act, rec, n = hit
        acts.append({"act": act, "form": " ".join(form), "of": rec.get("of"), "start": toks[i][1], "end": toks[i + n - 1][2]})
        end_char = toks[i + n - 1][2]
        i += n
    rest = str(text or "")[end_char:].lstrip(" ,.!?;:") if acts else str(text or "").strip()
    covered = sum(len(a["form"].split()) for a in acts)
    return {"schema": SCHEMA, "acts": acts, "rest": rest, "pure": bool(acts) and not rest.strip(),
            "words": len(words), "covered": covered, "match": round(covered / len(words), 6) if words else 0.0, "calls_llm": False}


def _cap(text: str) -> str:
    return (text[:1].upper() + text[1:] + ".") if text else ""


def respond(act: dict[str, Any]) -> dict[str, Any] | None:
    """The response act to one classified act, realized from the response act's own forms; None when the act is
    answered by its frame (the world model's) or ends the pair."""
    acts = lexicon().get("acts") or {}
    entry = acts.get(act.get("act")) or {}
    if entry.get("answered_by") != "act" or not entry.get("response"):
        return None
    r_id = str(entry["response"])
    r_entry = acts.get(r_id) or {}
    if r_id == act.get("act"):
        form, basis = act["form"], "reciprocal: the asker's own form of the same act"
    else:
        named = [f for f in r_entry.get("forms") or [] if f.get("of") == act.get("act")]
        general = [f for f in r_entry.get("forms") or [] if not f.get("of")]
        pick = (named or general or [None])[0]
        if not pick:
            return None
        form, basis = pick["form"], ("the response act's form for " + act["act"]) if named else "the response act's first general form"
    return {"act": act.get("act"), "response_act": r_id, "of": act.get("act"), "form": form, "text": _cap(form),
            "basis": basis, "atom": {"predicate": "speech_act", "args": [r_id, act.get("act")], "form": form, "polarity": "pos"}}


def turn(question: str) -> dict[str, Any]:
    """The leading acts the lexicon answers (the prefix), their responses, and the rest of the turn (a question, or an
    act answered by its frame) for the frame path."""
    c = classify(question)
    prefix = []
    for a in c["acts"]:
        r = respond(a)
        if r is None:
            break
        prefix.append((a, r))
    if prefix:
        last_end = prefix[-1][0]["end"]
        rest = str(question or "")[last_end:].lstrip(" ,.!?;:")
    else:
        rest = str(question or "").strip()
    return {"schema": SCHEMA, "classified": c, "prefix": [a for a, _ in prefix], "responses": [r for _, r in prefix],
            "rest": rest, "pure": bool(prefix) and not rest.strip(),
            "spoken": " ".join(r["text"] for _, r in prefix), "calls_llm": False}


def echo(question: str, reply: str) -> dict[str, Any]:
    """Structural Echo for speech acts: the reply re-read with the lexicon must be (act) the expected response act to
    each act of the question's prefix, in order, (reciprocal) answering that act (a reciprocal act repeats it; a
    response form that names the act it answers names this one), and (only_the_act) nothing else."""
    t = turn(question)
    r = classify(reply)
    want = [x["response_act"] for x in t["responses"]]
    got = [a["act"] for a in r["acts"]]
    act_ok = bool(want) and got == want
    recip = act_ok and all((a["of"] in (None, q["act"])) and (w != q["act"] or a["act"] == q["act"])
                           for a, q, w in zip(r["acts"], t["prefix"], want))
    only = bool(r["acts"]) and r["pure"] and r["match"] == 1.0
    checks = {"act": act_ok, "reciprocal": bool(recip), "only_the_act": only}
    score = round(sum(1 for v in checks.values() if v) / 3.0, 6)
    return {"score": score, "min": 0.85, "pass": all(checks.values()), "method": "structural_speech_act",
            "checks": checks, "question_acts": [a["act"] for a in t["prefix"]], "expected": want, "reply_acts": got,
            "compares": "reply acts (re-read with the speech-act lexicon) to the question's expected response acts", "calls_llm": False}


def _node(q_act: dict[str, Any], resp: dict[str, Any], weight: float, path: list[str]) -> dict[str, Any]:
    return {
        "memory_id": "speech_act:" + resp["response_act"] + ":" + resp["form"].replace(" ", "_"),
        "content": resp["form"],
        "content_summary": "", "summary": "", "memory_role": "", "source": "", "source_path": "", "chunk_id": "", "symbolic_signature": "",
        "ancestry": {"lexicon": "speech_acts.json#" + resp["response_act"], "answers": q_act["act"]},
        # the lexicon is a curated store, read at the confidence the kernel gives a curated row
        "confidence": "medium_high",
        "retrieval_weight": float(weight),
        "retrieval_weight_basis": "speech_acts.classify match (words of the act part the lexicon forms cover)",
        "prior_drift_score": 0.0,
        "phase_tags": list(path),
    }


def measure_turn(question: str, phase_path: list[Any], *, trace_spine: dict[str, Any] | None = None,
                 structural_drift: dict[str, Any] | None = None, pf2_preview: dict[str, Any] | None = None,
                 coherence_report: dict[str, Any] | None = None) -> dict[str, Any] | None:
    """The kernel reading of the act responses, or None when the turn opens with no act the lexicon answers."""
    from rmc_engine_v1.world_claim_measure import _measure, _route
    t = turn(question)
    if not t["responses"]:
        return None
    path = [p for p in (phase_path or []) if p] or ["Φ1"]
    act_part = classify(str(question or "")[: t["prefix"][-1]["end"]])
    weight = act_part["match"]
    sentences = []
    for a, r in zip(t["prefix"], t["responses"]):
        m = _measure(r["text"], "memory", [_node(a, r, weight, path)], path)
        measured, parts = m["measured"], m["parts"]
        sentences.append({
            "text": r["text"], "act": a["act"], "response_act": r["response_act"], "form": r["form"], "basis": r["basis"],
            "C": parts.get("coherence_score"), "epsilon_s": measured.get("epsilon_s"), "sigma_res": measured.get("sigma_res"),
            "circuit_breaker": bool(measured.get("circuit_breaker")),
            "phase_ok": bool((measured.get("phase_metrics") or {}).get("phase_path_legal")),
            "components": {k: parts.get(k) for k in ("memory_fit", "phase_validity", "drift_containment", "source_confidence", "utility_fit",
                                                      "bounded_novelty_score", "operator_legality", "conflict_penalty", "projection_gate_penalty", "coherence_score")},
            "formula": parts.get("formula"),
        })
    weakest = min(sentences, key=lambda s: float(s["C"] or 0.0))
    reading = {
        "candidate_id": "sa-" + hashlib.sha256(t["spoken"].encode("utf-8")).hexdigest()[:12],
        "spoken": t["spoken"], "pure": t["pure"], "rest": t["rest"],
        "acts": [a["act"] for a in t["prefix"]], "responses": t["responses"], "match": weight,
        "C": round(float(weakest["C"] or 0.0), 6), "C_rule": "min over the act responses (each against the lexicon item it realizes)",
        "epsilon_s": round(max(float(s["epsilon_s"] or 0.0) for s in sentences), 6),
        "sigma_res": max(float(s["sigma_res"] or 0.0) for s in sentences),
        "circuit_breaker": any(s["circuit_breaker"] for s in sentences),
        "phase_path": path, "phase_path_basis": "question.phase_path (a response is in the phase of the act it answers)",
        "phase_ok": all(s["phase_ok"] for s in sentences),
        "weakest_components": weakest["components"], "formula": weakest["formula"], "sentences": sentences,
        "calls_llm": False,
    }
    if trace_spine is not None:
        route = _route(reading, trace_spine, structural_drift or {}, pf2_preview or {}, coherence_report or {})
        reading["route"] = route.get("route")
        reading["route_reason_codes"] = route.get("reason_codes") or []
    return reading
