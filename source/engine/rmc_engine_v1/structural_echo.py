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
GAP_ROLES = {"kartr", "karma", "pred", "polarity"}


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
    for k in ROLES:
        qnp = qframe.get(k)
        if not isinstance(qnp, dict) or DF.is_gap(qnp) or not str(qnp.get("text") or "").strip():
            continue
        hit = bool(m) or any(DF.np_unify(qnp, f) for f in croles)
        checks.append({"check": "role:" + k, "ok": hit, "question": qnp.get("text")})
    filler = (m or {}).get("filler")
    checks.append({"check": "gap:" + gap, "ok": bool(filler), "filler": filler, "kind": ((qframe.get("pred") or {}).get("kind") if isinstance(qframe.get("pred"), dict) else None)})
    args = [_norm(a) for a in atom.get("args") or []]
    if gap == "polarity":
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
