"""Echo of an answer against the original question.

4.9.217: the live rule is a re-parse. The answer must realise the asked relation about the asked
subject (relation_echo.py). Coverage of the question's meaning tokens is the secondary number.
A longer truthful sentence is not punished for extra words.
The 4.9.200 renderer calls this function. It does not keep a second copy.
"""
from __future__ import annotations

import re
from typing import Any

from rmc_engine_v1.mobile_config import THRESHOLDS

_STOP = {
    "the", "and", "for", "with", "from", "that", "this", "what", "which", "when",
    "where", "who", "whom", "why", "how", "are", "was", "were", "you", "your",
    "does", "did", "can", "could", "into", "about", "have", "has", "not", "but",
}


def _tokens(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", str(text or "").lower()) if len(w) > 2 and w not in _STOP}


_WH_SLOT = {"what", "which", "whose"}
# A why-question asks for a cause. These are the cause relations a sentence states
# (Panini hetu / apadana readings of English): "because", "due to", "comes from", ...
_CAUSE = {"because", "since", "due", "cause", "causes", "caused", "causing", "result", "results", "resulting",
          "reason", "reasons", "therefore", "thus", "hence", "leads", "lead", "owing", "comes", "come", "came",
          "originates", "stems", "produces", "produced", "makes", "made", "so"}


def _lex() -> dict[str, Any]:
    global _LEX
    if _LEX is None:
        from pathlib import Path
        import json
        _LEX = json.loads(Path(__file__).with_name("concept_lexicon.json").read_text(encoding="utf-8"))
    return _LEX


_LEX: dict[str, Any] | None = None


def _words(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", str(text or "").lower())


def _asked_slot(question: str) -> tuple[str, dict[str, Any]] | None:
    """WH-attribute frame: "what colour is my car" asks for a value of colour.
    Returns the slot word and its value rule when the lexicon names one."""
    words = _words(question)
    lex = _lex()
    for i, w in enumerate(words[:-1]):
        if w in _WH_SLOT:
            cid = (lex.get("surfaces") or {}).get(words[i + 1])
            rule = (lex.get("values") or {}).get(cid or "")
            if rule:
                return words[i + 1], rule
    return None


def _fills_slot(rule: dict[str, Any], answer: str) -> bool:
    lex = _lex()
    surfaces, cats = lex.get("surfaces") or {}, lex.get("categories") or {}
    for w in _words(answer):
        cid = surfaces.get(w)
        if cid and cid in (rule.get("concepts") or []):
            return True
        if cid and rule.get("category") and cats.get(cid) == rule.get("category"):
            return True
        if rule.get("digits") and w.isdigit():
            return True
    return False


def _stem_cover(word: str, right: set[str]) -> bool:
    """A derived adjective is covered by its base noun: salty / salt, rainy / rain.
    Only the adjective -y on a base that is itself in the answer; nothing else."""
    return len(word) > 4 and word.endswith("y") and word[:-1] in right


def asks_cause(question: str) -> bool:
    words = _words(question)
    return bool(words) and words[0] == "why"


def states_cause(answer: str) -> bool:
    return any(w in _CAUSE for w in _words(answer))


def echo_against_question(question: str, output_text: str, *, rendered: bool = False) -> dict[str, Any]:
    """Echo ≥ 0.85.

    Live path: coverage of the original question's meaning tokens by the
    rendered answer. A longer truthful sentence is not punished for extra words.
    Dry run: Jaccard of the selected candidate meaning against the question,
    which stays 0 while stages 14–16 are skipped.
    """
    left = _tokens(question)
    right = _tokens(output_text)
    relation = None
    if rendered:
        # 4.9.210 (Release A2): the Echo re-parse reads the question's frame, not only its words.
        # A WH-attribute slot ("what colour") is covered by a value of that attribute ("red"); a
        # derived adjective is covered by its base noun ("salty" by "salt"); a why-question must be
        # answered by a sentence that states a cause, or Echo fails whatever the coverage.
        slot = _asked_slot(question)
        covered = {w for w in left if w in right or _stem_cover(w, right)}
        if slot and slot[0] in left and slot[0] not in covered and _fills_slot(slot[1], output_text):
            covered.add(slot[0])
        if not left:
            score = 0.0
        else:
            score = len(covered) / len(left)
        if asks_cause(question):
            relation = {"asked": "cause", "stated": states_cause(output_text)}
            if not relation["stated"]:
                score = min(score, 0.5)
        # 4.9.217: the relation re-parse is the primary check. The answer is re-read (relation_echo: the engine's
        # FR.BE.COP parse and the Panini karaka readings) and must realise the asked relation (definition, identity,
        # attribute, cause, quantity, place, time, agent, manner) about the asked subject. A sentence that only
        # mentions the subject fails whatever its word coverage. Coverage stays the secondary number, so a
        # realised relation still needs the same coverage as before (0.85 to speak, 0.97 to write).
        from rmc_engine_v1.relation_echo import realises
        reparse = realises(question, output_text)
        if reparse.get("realised") is not None:
            relation = dict(relation or {}, asked=reparse["asked"], subject=reparse.get("subject"),
                            realised=bool(reparse["realised"]), method="relation_reparse")
            for key in ("define_rank", "frame", "role", "kind"):
                if reparse.get(key) is not None:
                    relation[key] = reparse[key]
            if reparse["asked"] == "cause":
                relation["stated"] = bool(reparse.get("stated", relation.get("stated")))
            if not reparse["realised"]:
                score = min(score, 0.5)
        method = "question_meaning_coverage"
        compares = "rendered_answer_to_original_question_meaning"
    else:
        if not left and not right:
            score = 1.0
        elif not left or not right:
            score = 0.0
        else:
            score = len(left & right) / len(left | right)
        method = "jaccard_content_tokens"
        compares = "selected_candidate_meaning_to_original_question"
    score = round(score, 6)
    return {
        "score": score,
        "min": THRESHOLDS["echo_min"],
        "pass": score >= float(THRESHOLDS["echo_min"]),
        "method": method,
        "compares": compares,
        "output_text": str(output_text or "")[:400],
        **({"relation": relation} if relation else {}),
    }
