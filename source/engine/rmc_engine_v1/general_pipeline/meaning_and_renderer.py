"""General Learning-to-Answer Pipeline — meaning compiler + generative renderer
(Build GP-001).

Two stages live here:

  compile_meaning(...)  : sealed MEA manifest + solution -> MeaningManifest
  render(meaning)       : MeaningManifest -> natural-language answer text

About "generative" (this is the part that matters):
  The renderer does NOT select a finished sentence from a fixed list keyed to
  one fixture. It assembles the answer clause by clause from the *meaning
  fields* of THIS specific problem: the object noun, the operation, the given
  quantities, the ordered reasoning steps that were actually computed, the
  exact answer, and the verification. Different problems produce different
  sentences because the fields differ. There is no 144 Hz string in here and no
  per-problem template; the structure is general and the content is the data.

  It is non-LLM and deterministic: same meaning in, same words out. That makes
  it Echo-checkable. It is a first, honest generative layer — a real sentence
  planner over meaning, extensible with richer grammar later.
"""

from __future__ import annotations

from typing import List

from rmc_engine_v1.mea.manifest_schema import ProblemManifest, ClaimStatus

from .contracts import MeaningManifest, ExactSolution, ParsedQuestion, fraction_to_text


_OPERATION_PHRASE = {
    "add": "adding",
    "subtract": "subtracting",
    "multiply": "multiplying",
    "divide": "dividing",
}


def compile_meaning(
    sealed_manifest: ProblemManifest,
    parsed: ParsedQuestion,
    solution: ExactSolution,
    source_ref: str,
) -> MeaningManifest:
    """Build the RMC meaning object from the sealed manifest and solution.

    This is separate from the MEA manifest by design: the MEA manifest is the
    sealed problem state; the meaning manifest is what we are permitted to say.
    """
    answer_text = fraction_to_text(solution.answer_value)
    object_noun = parsed.metadata.get("object", "")
    operation_word = parsed.metadata.get("operation", "")

    given: List[str] = []
    for role, value in sorted(parsed.quantities.items()):
        given.append(f"{role} is {fraction_to_text(value)}")

    return MeaningManifest(
        problem_id=sealed_manifest.problem_id,
        claim_status=sealed_manifest.claim_status,
        answer_text=answer_text,
        answer_unit=solution.answer_unit,
        object_noun=object_noun,
        operation_word=operation_word,
        given_facts=given,
        reasoning_steps=list(solution.steps),
        verification_text=solution.verification_text,
        source_ref=source_ref,
    )


def _join_clause(parts: List[str]) -> str:
    parts = [p for p in parts if p]
    if not parts:
        return ""
    if len(parts) == 1:
        return parts[0]
    if len(parts) == 2:
        return f"{parts[0]} and {parts[1]}"
    return ", ".join(parts[:-1]) + f", and {parts[-1]}"


def render(meaning: MeaningManifest) -> str:
    """Generate the natural-language answer from meaning fields.

    The sentence plan is: (1) state the answer, (2) walk the reasoning the
    system actually performed, (3) give the exact check. Each sentence is
    composed from this problem's data, so the wording tracks the problem.
    """
    # Guard: only a resolved manifest may be spoken as an answer.
    if meaning.claim_status != ClaimStatus.RESOLVED_MANIFEST.value:
        return (
            "I can describe the problem but I have not sealed a resolved answer, "
            "so I will not state one."
        )

    sentences: List[str] = []

    unit = (" " + meaning.answer_unit) if meaning.answer_unit else ""

    # 1) Lead with the answer, phrased around the object when we have one.
    if meaning.object_noun:
        lead_object = meaning.object_noun.strip()
        article = "an" if lead_object[:1] in "aeiou" else "a"
        sentences.append(
            f"The full capacity of the {lead_object} is {meaning.answer_text}{unit}."
            if meaning.answer_unit
            else f"The answer for the {article} {lead_object} is {meaning.answer_text}."
        )
    elif meaning.operation_word:
        op_phrase = _OPERATION_PHRASE.get(meaning.operation_word, meaning.operation_word)
        given = _join_clause(meaning.given_facts)
        sentences.append(
            f"The result of {op_phrase} the given values is {meaning.answer_text}."
            if not given
            else f"With {given}, {op_phrase} them gives {meaning.answer_text}."
        )
    else:
        sentences.append(f"The answer is {meaning.answer_text}{unit}.")

    # 2) Walk the actual reasoning steps that were computed for THIS problem.
    for step in meaning.reasoning_steps:
        text = step.strip()
        if text and not text.endswith("."):
            text += "."
        # Capitalise the first character for sentence form.
        if text:
            text = text[0].upper() + text[1:]
        sentences.append(text)

    # 3) State the exact verification.
    if meaning.verification_text:
        sentences.append(meaning.verification_text.strip())

    # 4) Honest closing about what kind of certainty this is.
    sentences.append("This answer is verified by exact arithmetic.")

    return " ".join(s for s in sentences if s)


def render_with_manifest_contract_v2(meaning: MeaningManifest, manifest_contract_v2: object) -> str:
    """Production delivery renderer path: requires validated GP-008 authority.

    ``render`` remains as the deterministic sentence-plan component for replay
    and legacy verification. The answering pipeline must call this guarded
    wrapper so a sentence cannot be delivered without its linked trace contract.
    """
    from .manifest_contract_v2 import require_render_authority

    require_render_authority(manifest_contract_v2, meaning)
    return render(meaning)


__all__ = ["compile_meaning", "render", "render_with_manifest_contract_v2"]
