"""4.9.238 (plan 229 step 9): Echo by structure.

Echo scores the meaning structure of the spoken clause against the question's kāraka frame (forge.qframe/v1), not the
words they share. The spoken clause is the world model's answering claim: the fact it states (the phone's own clause of
that sentence, else the engine's atom reading) or the conclusion a replayed rule derived from it. Four checks, each named:

  kriya   the clause's kriyā is the asked kriyā (or the copula read through a linking verb for an attribute question, or
          the relational rule the checker replayed: possession over an identity copula, a name over a copula);
  roles   every role the question states (kartṛ, karma, predicate) unifies with a role of the clause (same head, the
          question's words inside the role, the same owner);
  gap     the asked role (the indefinite pro-form the wh-word stands for, with its kind when it has one) is filled; a
          yes/no question needs both roles and the polarity;
  stated  the spoken conclusion states that filler: its atom carries the filler in an argument (or the asked polarity),
          and that sentence is in the reply.

score = checks held / checks made. 0.85 to speak and 0.97 to write are unchanged. There is no token-coverage term.
Echo by structure applies when the question compiled to a frame with a kriyā and a role gap (or a polar question) and the
reply is the world model's claim; any other reply keeps the 4.9.217 relation re-parse (recorded, not hidden).
Deterministic; no model.
"""
from __future__ import annotations

import re
from typing import Any

from rmc_engine_v1.mobile_config import THRESHOLDS

ROLES = ("kartr", "karma", "pred")
GAP_ROLES = {"kartr", "karma", "pred", "polarity", "prakara", "hetu"}  # 4.9.241: a how-gap (state); a why-gap is the stored hetu


def _norm(text: Any) -> str:
    t = re.sub(r"\s+", " ", str(text or "").strip().lower()).strip(" .")
    return re.sub(r"^(the|a|an)\s+", "", t)


def usable(qframe: Any) -> bool:
    if not isinstance(qframe, dict) or not str(qframe.get("kriya") or "").strip():
        return False
    if not (qframe.get("parsed") or qframe.get("partial")):
        return False
    return str(qframe.get("wh_role") or "") in GAP_ROLES


def _roles_of(frame: dict[str, Any]) -> list[dict[str, Any]]:
    out = []
    for k in ROLES:
        np = frame.get(k)
        if isinstance(np, dict) and str(np.get("text") or "").strip():
            out.append(np)
            if isinstance(np.get("of"), dict):
                out.append(np["of"])
    return out


def score(qframe: dict[str, Any], claim: dict[str, Any] | None, reply: str) -> dict[str, Any] | None:
    """Echo of the spoken claim's frame against the question frame; None when either side has no frame."""
    from rmc_engine_v1 import derive_frame as DF
    from rmc_engine_v1.world_model_v1 import to_listener

    if not usable(qframe) or not isinstance(claim, dict) or not str(reply or "").strip():
        return None
    ff = claim.get("fact_frame") if isinstance(claim.get("fact_frame"), dict) else None
    atom = claim.get("atom") if isinstance(claim.get("atom"), dict) else None
    if ff is None or atom is None:
        return None
    # 4.9.243: "What happens if …?" — Simulate filled the effect gap from a causal frame. Score by effect, not kriyā identity.
    q_rule = str(qframe.get("rule") or "")
    how = str((claim.get("frame_match") or {}).get("rule") or claim.get("how") or "")
    if (q_rule == "QF-WHAT-HAPPENS-IF" or str(qframe.get("kriya") or "").lower() == "happen") and (
        how.startswith("WM-") or claim.get("kind") == "causal_prediction" or (claim.get("simulate_chain") is not None)
    ):
        filler = str((claim.get("frame_match") or {}).get("filler") or claim.get("text") or "").strip()
        checks = [
            {"check": "kriya", "ok": True, "question": "happen", "clause": ff.get("kriya"),
             "reading": "effect of a what-happens-if intervention (Simulate)"},
            {"check": "gap:pred", "ok": bool(filler), "filler": filler, "kind": "effect"},
            {"check": "stated", "ok": bool(filler) and _norm(filler).rstrip(".") in _norm(reply),
             "atom": {"predicate": atom.get("predicate"), "args": atom.get("args")}, "spoken": filler},
            {"check": "chain", "ok": True, "reading": how or "WM-SIMULATE"},
        ]
        held = sum(1 for c in checks if c["ok"])
        value = round(held / len(checks), 6) if checks else 0.0
        return {
            "score": value,
            "min": THRESHOLDS["echo_min"],
            "pass": value >= float(THRESHOLDS["echo_min"]),
            "method": "structural_frame",
            "compares": "spoken_clause_frame_to_question_frame",
            "output_text": str(reply or "")[:400],
            "structure": {"checks": checks, "held": held, "made": len(checks), "rule": how or "WM-SIMULATE",
                          "frame_source": "simulate", "question_rule": q_rule, "uses_token_overlap": False},
            "calls_llm": False,
        }
    if str(qframe.get("wh_role") or "") == "hetu" and how == "WM-HETU":
        filler = str((claim.get("frame_match") or {}).get("filler") or claim.get("text") or "").strip()
        said = _norm(filler).rstrip(".") in _norm(reply)
        checks = [
            {"check": "kriya", "ok": str(qframe.get("kriya") or "").lower() == str(ff.get("kriya") or "").lower(),
             "question": qframe.get("kriya"), "clause": ff.get("kriya"), "reading": "the asked event"},
            {"check": "gap:hetu", "ok": said, "filler": filler, "kind": "hetu"},
            {"check": "stated", "ok": said, "atom": {"predicate": atom.get("predicate"), "args": atom.get("args")}, "spoken": filler},
        ]
        held = sum(1 for c in checks if c["ok"])
        value = round(held / len(checks), 6) if checks else 0.0
        return {
            "score": value, "min": THRESHOLDS["echo_min"], "pass": value >= float(THRESHOLDS["echo_min"]),
            "method": "structural_frame", "compares": "spoken_clause_frame_to_question_frame",
            "output_text": str(reply or "")[:400],
            "structure": {"checks": checks, "held": held, "made": len(checks), "rule": "WM-HETU",
                          "frame_source": "hetu", "question_rule": q_rule, "uses_token_overlap": False},
            "calls_llm": False,
        }
    m = DF.match(qframe, ff)
    qk, fk = str(qframe.get("kriya") or "").lower(), str(ff.get("kriya") or "").lower()
    rule = (m or {}).get("rule")
    checks: list[dict[str, Any]] = []
    kriya_ok = qk == fk or bool(m)
    checks.append({"check": "kriya", "ok": kriya_ok, "question": qk, "clause": fk,
                   "reading": "same kriyā" if qk == fk else ("linking verb read as the copula for an attribute" if (m or {}).get("linking")
                                                             else ("relational rule " + str(rule) if m else "different kriyā"))})
    gap = str(qframe.get("wh_role") or "")
    croles = _roles_of(ff)
    orient = str((m or {}).get("orientation") or "")
    # 4.9.240: for a copula claim each question role is checked at the position the match says it fills, not just
    # anywhere in the fact; and a swapped reading (question kartṛ = fact predicate) holds only for an identity between
    # two referring phrases. "Is a living thing a whale?" against "a whale is a living thing" fails both checks.
    positional = fk == "be" and (rule in ("polar", "copula", "copula_specificational", DF.RULE_CONVERSE) or (m is None and qk == "be"))
    swapped = orient == "kartr=pred"
    place = {"kartr": "pred" if swapped else "kartr", "pred": "kartr" if swapped else "pred"}
    for k in ROLES:
        qnp = qframe.get(k)
        if not isinstance(qnp, dict) or DF.is_gap(qnp) or not str(qnp.get("text") or "").strip():
            continue
        if positional and k in place:
            hit = DF.np_unify(qnp, ff.get(place[k]))
            checks.append({"check": "role:" + k, "ok": hit, "question": qnp.get("text"), "at": place[k]})
            continue
        hit = bool(m) or any(DF.np_unify(qnp, f) for f in croles)
        checks.append({"check": "role:" + k, "ok": hit, "question": qnp.get("text")})
    if positional and swapped and rule == DF.RULE_CONVERSE:
        # 4.9.241: the converse of a kind inclusion is faithful only as "not necessarily", never as yes
        said = DF.NOT_NECESSARILY in _norm(reply)
        ok = (m or {}).get("filler") == DF.NOT_NECESSARILY and DF.kind_inclusion(ff.get("kartr"), ff.get("pred")) and said
        checks.append({"check": "orientation", "ok": ok, "hard": True, "reading": "converse of a kind inclusion: it does not follow, said as not necessarily"})
    elif positional and swapped:
        ident = DF.identity(ff.get("kartr"), ff.get("pred"))
        checks.append({"check": "orientation", "ok": ident, "hard": True, "reading": "identity runs both ways" if ident else "kind or membership does not run backwards"})
    filler = (m or {}).get("filler")
    if gap == "prakara":
        # 4.9.241: a how-gap asks a state or manner; the clause must supply it as a predicate adjective
        fp = ff.get("pred") if isinstance(ff.get("pred"), dict) else {}
        checks.append({"check": "state", "ok": str(fp.get("type") or "").startswith("adj"), "hard": True, "pred_type": fp.get("type")})
    checks.append({"check": "gap:" + gap, "ok": bool(filler), "filler": filler, "kind": ((qframe.get("pred") or {}).get("kind") if isinstance(qframe.get("pred"), dict) else None)})
    args = [_norm(a) for a in atom.get("args") or []]
    if rule == DF.RULE_PRO_VERB:
        # 4.9.241: the pro-verb's filler is the fact's verb phrase: the spoken atom states that verb and its object
        fo = ff.get("karma") if isinstance(ff.get("karma"), dict) else {}
        stated = _norm(atom.get("predicate")) == _norm((m or {}).get("action")) and _norm(fo.get("text")) in args
    elif gap == "polarity":
        stated = bool(m) and (atom.get("polarity") or "pos") == (ff.get("polarity") or "pos")
    else:
        stated = bool(filler) and (_norm(filler) in args or _norm(to_listener(str(filler))) in args)
    spoken = [s for s in (claim.get("spoken_atoms") or []) if isinstance(s, dict)]
    conclusion = next((s for s in reversed(spoken) if s.get("role") == "conclusion"), None)
    in_reply = conclusion is None or _norm(conclusion.get("text")) in _norm(reply)
    checks.append({"check": "stated", "ok": bool(stated and in_reply), "atom": {"predicate": atom.get("predicate"), "args": atom.get("args")},
                   "spoken": (conclusion or {}).get("text")})
    held = sum(1 for c in checks if c["ok"])
    value = round(held / len(checks), 6) if checks else 0.0
    if any(c.get("hard") and not c["ok"] for c in checks):
        value = 0.0  # 4.9.240: a converse read off a kind or membership is not the claim asked about, whatever else holds
    return {
        "score": value,
        "min": THRESHOLDS["echo_min"],
        "pass": value >= float(THRESHOLDS["echo_min"]),
        "method": "structural_frame",
        "compares": "spoken_clause_frame_to_question_frame",
        "output_text": str(reply or "")[:400],
        "structure": {"checks": checks, "held": held, "made": len(checks), "rule": rule, "frame_source": (claim.get("frame_match") or {}).get("frame_source"),
                      "question_rule": qframe.get("rule"), "uses_token_overlap": False},
        "calls_llm": False,
    }


def speech_act_score(question: str, reply: str) -> dict[str, Any]:
    """4.9.241 (plan 229 step 10; Nic: natural conversation): structural Echo for speech acts. The reply is re-read with
    the speech-act lexicon (speech_acts.classify, the same reader as the question) and must be (act) the expected response
    act to each act of the question, in order, (reciprocal) the answer to that act, and (only_the_act) nothing else.
    Each check is measured on the reply; nothing is set to pass. A greeting answered by a fact, or by another act, fails."""
    from rmc_engine_v1.speech_acts import echo as _act_echo

    e = _act_echo(question, reply)
    checks = [{"check": k, "ok": bool(v)} for k, v in e["checks"].items()]
    held = sum(1 for c in checks if c["ok"])
    value = round(held / len(checks), 6)
    return {
        "score": value,
        "min": THRESHOLDS["echo_min"],
        "pass": value >= float(THRESHOLDS["echo_min"]),
        "method": "structural_speech_act",
        "compares": "reply_acts_to_expected_response_acts",
        "output_text": str(reply or "")[:400],
        "structure": {"checks": checks, "held": held, "made": len(checks), "question_acts": e["question_acts"],
                      "expected": e["expected"], "reply_acts": e["reply_acts"], "uses_token_overlap": False},
        "calls_llm": False,
    }
