"""Echo of an answer against the original question.

The live rule is coverage of the question's meaning tokens by the answer.
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


def echo_against_question(question: str, output_text: str, *, rendered: bool = False) -> dict[str, Any]:
    """Echo ≥ 0.85.

    Live path: coverage of the original question's meaning tokens by the
    rendered answer. A longer truthful sentence is not punished for extra words.
    Dry run: Jaccard of the selected candidate meaning against the question,
    which stays 0 while stages 14–16 are skipped.
    """
    left = _tokens(question)
    right = _tokens(output_text)
    if rendered:
        if not left:
            score = 0.0
        else:
            score = len(left & right) / len(left)
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
    }
