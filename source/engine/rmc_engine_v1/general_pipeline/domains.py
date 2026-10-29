"""General Learning-to-Answer Pipeline — domain library (Build GP-001).

A *domain* is the unit of capability growth. Each domain is a small, explicit
object with four responsibilities:

  matches(question)   -> bool        : does this question belong to this domain?
  parse(question)     -> ParsedQuestion | None
  execute(parsed)     -> ExactSolution
  relation_text()     -> str         : the governed relation, for source ancestry

Honesty boundary (read this):
  This is NOT general natural-language understanding. Each domain recognises a
  bounded family of phrasings using explicit patterns. A question that no domain
  recognises is REFUSED, never guessed. That refusal is a feature: the system
  says "I have not learned that kind of problem yet" rather than fabricating.

  To teach the system a new kind of problem, add a new Domain here (plus tests).
  The engine never changes; only the library grows.

Build GP-001 ships two domains at the true beginning of arithmetic:
  - whole_number_arithmetic : "what is A plus/minus/times/divided by B"
  - fraction_change_capacity: "X was a/b full; after N removed it was c/d full;
                               what is the full capacity?"  (the Build 011 family)

All arithmetic uses exact fractions.Fraction. No floats. No LLM.\n\nGP-004 reground: built-in domains register through the centralized bounded\ncapability registry and consume their complete governed input form; source text\nmay support a registered domain but cannot install one.
"""

from __future__ import annotations

import re
from fractions import Fraction
from typing import List, Optional, Protocol

from .contracts import ParsedQuestion, ExactSolution, fraction_to_text
from .capability_registry import (
    CapabilityContract,
    instantiate_registered_domains,
    register_capability,
)

# Information-gain micro unit awarded when an unknown is genuinely resolved.
# (The engine treats >0 as "this produced new knowledge, not recall".)
_RESOLVED_INFORMATION_GAIN = 1_000_000


def _normalise(text: str) -> str:
    return " ".join(str(text).strip().lower().split())


def _parse_number(token: str) -> Optional[Fraction]:
    """Parse an integer or simple a/b fraction token into an exact Fraction."""
    token = token.strip()
    if re.fullmatch(r"\d+/\d+", token):
        num, den = token.split("/")
        if int(den) == 0:
            return None
        return Fraction(int(num), int(den))
    if re.fullmatch(r"\d+", token):
        return Fraction(int(token))
    return None


class Domain(Protocol):
    domain_id: str

    def relation_text(self) -> str: ...
    def matches(self, question: str) -> bool: ...
    def parse(self, question: str) -> Optional[ParsedQuestion]: ...
    def execute(self, parsed: ParsedQuestion) -> ExactSolution: ...


# ---------------------------------------------------------------------------
# Domain 1 — whole-number (and simple-fraction) arithmetic
# ---------------------------------------------------------------------------

_OP_WORDS = {
    "plus": "add", "added to": "add", "sum of": "add", "+": "add",
    "minus": "subtract", "less": "subtract", "-": "subtract",
    "times": "multiply", "multiplied by": "multiply", "x": "multiply", "*": "multiply",
    "divided by": "divide", "over": "divide", "/": "divide",
}

_OP_SYMBOL = {"add": "+", "subtract": "-", "multiply": "\u00d7", "divide": "\u00f7"}
_OP_VERB = {"add": "adding", "subtract": "subtracting", "multiply": "multiplying", "divide": "dividing"}


class WholeNumberArithmeticDomain:
    domain_id = "whole_number_arithmetic"

    def relation_text(self) -> str:
        return "answer = left_operand (operation) right_operand, computed by exact arithmetic"

    def _find_op(self, q: str):
        # Longest operator phrase first so "multiplied by" beats "by", etc.
        for phrase in sorted(_OP_WORDS, key=len, reverse=True):
            pattern = re.escape(phrase)
            if not phrase.isalpha():
                regex = pattern  # symbols can sit between digits
            else:
                regex = r"\b" + pattern + r"\b"
            m = re.search(regex, q)
            if m:
                return _OP_WORDS[phrase], m.start(), m.end()
        return None

    def matches(self, question: str) -> bool:
        return self.parse(question) is not None

    def parse(self, question: str) -> Optional[ParsedQuestion]:
        q = _normalise(question)
        # This domain answers short, direct arithmetic expressions only.
        # Reject multi-clause word problems so the right domain handles them.
        if len(q.split()) > 12:
            return None
        if any(w in q for w in (" full", "capacity", "removed", "remaining", "left over")):
            return None
        q = q.rstrip("?.! ")
        # strip a leading "what is" / "compute" / "calculate"
        q = re.sub(r"^(what is|whats|what's|compute|calculate|evaluate)\s+", "", q)
        found = self._find_op(q)
        if not found:
            return None
        op, start, end = found
        left_text = q[:start].strip()
        right_text = q[end:].strip()
        # GP-004 strict parse boundary: all remaining input must be the two
        # governed numeric operands. Never silently discard surrounding words.
        left = _parse_number(left_text)
        right = _parse_number(right_text)
        if left is None or right is None:
            return None
        if op == "divide" and right == 0:
            return None
        return ParsedQuestion(
            domain=self.domain_id,
            raw_question=question,
            quantities={"left": left, "right": right},
            metadata={"operation": op},
        )

    def execute(self, parsed: ParsedQuestion) -> ExactSolution:
        left = parsed.quantities["left"]
        right = parsed.quantities["right"]
        op = parsed.metadata["operation"]
        if op == "add":
            answer = left + right
        elif op == "subtract":
            answer = left - right
        elif op == "multiply":
            answer = left * right
        elif op == "divide":
            answer = left / right
        else:  # pragma: no cover - guarded by parse
            raise ValueError(f"unknown operation {op!r}")

        sym = _OP_SYMBOL[op]
        lt, rt, at = fraction_to_text(left), fraction_to_text(right), fraction_to_text(answer)
        steps = [f"{lt} {sym} {rt} = {at}"]

        # Exact verification: invert the operation where well-defined.
        verified = False
        verification_text = ""
        if op == "add":
            verified = (answer - right == left)
            verification_text = f"Check: {at} - {rt} = {fraction_to_text(answer - right)}, which matches {lt}."
        elif op == "subtract":
            verified = (answer + right == left)
            verification_text = f"Check: {at} + {rt} = {fraction_to_text(answer + right)}, which matches {lt}."
        elif op == "multiply":
            if right != 0:
                verified = (answer / right == left)
                verification_text = f"Check: {at} \u00f7 {rt} = {fraction_to_text(answer / right)}, which matches {lt}."
            else:
                verified = (answer == 0)
                verification_text = f"Check: multiplying by 0 gives 0, and the result is {at}."
        elif op == "divide":
            verified = (answer * right == left)
            verification_text = f"Check: {at} \u00d7 {rt} = {fraction_to_text(answer * right)}, which matches {lt}."

        return ExactSolution(
            domain=self.domain_id,
            answer_value=answer,
            answer_unit="",
            steps=steps,
            verification_text=verification_text,
            verified=verified,
            information_gain=_RESOLVED_INFORMATION_GAIN if verified else 0,
        )


# ---------------------------------------------------------------------------
# Domain 2 — fraction-change capacity (the Build 011 family), exact + verified
# ---------------------------------------------------------------------------

class FractionChangeCapacityDomain:
    domain_id = "fraction_change_capacity"

    def relation_text(self) -> str:
        return "whole_capacity = removed_quantity / (initial_fraction - final_fraction), dimensionally verified with Pint"

    _UNIT_TOKEN = r"[a-z]+(?:\s+per\s+[a-z]+|/[a-z]+)?"
    _PATTERN = re.compile(
        rf"(?:a|an|the)?\s*(?P<object>[a-z ]+?)\s+(?:was|is)\s+(?P<initial>\d+/\d+|\d+)\s+full"
        rf".*?after\s+(?P<removed>\d+/\d+|\d+)\s+(?P<unit>{_UNIT_TOKEN})\s+(?:were|was|are|is)\s+removed"
        rf".*?(?:it\s+(?:was|is))\s+(?P<final>\d+/\d+|\d+)\s+full",
        re.IGNORECASE | re.DOTALL,
    )
    _QUESTION = re.compile(
        rf"[.?!,; ]*what is the full capacity of (?:the )?[a-z ]+?"
        rf"(?:\s+in\s+(?P<output_unit>{_UNIT_TOKEN}))?[?!. ]*",
        re.IGNORECASE,
    )

    def _parse_structural_form(self, question: str) -> Optional[ParsedQuestion]:
        q = _normalise(question)
        m = self._PATTERN.search(q)
        if not m:
            return None
        prefix = q[:m.start()].strip()
        trailing = q[m.end():].strip()
        question_match = self._QUESTION.fullmatch(trailing) if trailing else None
        if prefix or question_match is None:
            return None
        initial = _parse_number(m.group("initial"))
        final = _parse_number(m.group("final"))
        removed = _parse_number(m.group("removed"))
        if initial is None or final is None or removed is None or initial <= final or removed <= 0:
            return None
        obj = m.group("object").strip()
        obj = " ".join(obj.split()[-2:]) if obj else "container"
        unit = " ".join(m.group("unit").strip().lower().split())
        output_unit = question_match.group("output_unit") or unit
        return ParsedQuestion(
            domain=self.domain_id,
            raw_question=question,
            quantities={"initial": initial, "final": final, "removed": removed},
            metadata={"object": obj, "unit": unit, "output_unit": " ".join(output_unit.strip().lower().split())},
        )

    def matches(self, question: str) -> bool:
        # Route the structurally recognized capacity family into its parser even
        # when Pint later refuses a unit or dimensional mismatch, so the refusal
        # receives a domain-specific containment receipt rather than vanishing as
        # an unexplained no-domain outcome.
        return self._parse_structural_form(question) is not None

    def parse(self, question: str) -> Optional[ParsedQuestion]:
        parsed = self._parse_structural_form(question)
        if parsed is None:
            return None
        # GP-011B: unit meaning must be validated before execution. Unknown or
        # dimensionally incompatible units are recognized as capacity attempts
        # and routed to the PARSER_REFUSED containment path.
        try:
            from .quantity_ast import bind_capacity_quantity_metadata
            return bind_capacity_quantity_metadata(parsed)
        except Exception:
            return None

    def refusal_reason(self, question: str) -> str:
        parsed = self._parse_structural_form(question)
        if parsed is None:
            return "capacity input does not satisfy the supported full-input grammar"
        try:
            from .quantity_ast import bind_capacity_quantity_metadata
            bind_capacity_quantity_metadata(parsed)
        except Exception as exc:
            return f"Pint quantity boundary refused the capacity input: {exc}"
        return "capacity input was not accepted for an unspecified governed reason"

    def execute(self, parsed: ParsedQuestion) -> ExactSolution:
        # Retained only as a defensive compatibility surface. The production
        # answer pipeline routes this domain through the GP-011B Pint adapter.
        from .quantity_adapters import execute_with_safe_quantity_adapter
        _adapter, _ast, solution, _receipt = execute_with_safe_quantity_adapter(parsed)
        return solution


# ---------------------------------------------------------------------------
# GP-004 centralized capability registrations for GP-001 capabilities.
# These registrations are installed code, not source-driven authority.
# ---------------------------------------------------------------------------

def _register_foundation_capabilities() -> None:
    register_capability(
        CapabilityContract(
            capability_id="cap.math.fraction_change_capacity.v1",
            domain_id=FractionChangeCapacityDomain.domain_id,
            domain_factory=FractionChangeCapacityDomain,
            relation_text=FractionChangeCapacityDomain().relation_text(),
            source_fingerprints=("fraction", "capacity", "full", "removed", "whole"),
            min_fingerprint_hits=2,
            priority=10,
        )
    )
    register_capability(
        CapabilityContract(
            capability_id="cap.math.whole_number_arithmetic.v1",
            domain_id=WholeNumberArithmeticDomain.domain_id,
            domain_factory=WholeNumberArithmeticDomain,
            relation_text=WholeNumberArithmeticDomain().relation_text(),
            source_fingerprints=("add", "subtract", "multiply", "divide", "sum", "product", "arithmetic"),
            min_fingerprint_hits=2,
            priority=20,
        )
    )


_register_foundation_capabilities()


def all_domains() -> List[Domain]:
    """Return registered domains in deterministic priority/id order."""
    return list(instantiate_registered_domains())


def match_domain(question: str) -> Optional[Domain]:
    """Return only an installed, registered domain that fully accepts input.

    None means either the system has not learned this problem family or the
    input falls outside its strict parse boundary. The pipeline must refuse.
    """
    for domain in all_domains():
        try:
            if domain.matches(question):
                return domain
        except Exception:
            continue
    return None


__all__ = [
    "Domain",
    "WholeNumberArithmeticDomain",
    "FractionChangeCapacityDomain",
    "all_domains",
    "match_domain",
]
