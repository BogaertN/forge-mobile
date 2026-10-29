"""General Learning-to-Answer Pipeline — linear equation domain.

GP-007 hardening:
  The existing `linear_equation_one_unknown` domain now parses through the
  AI.Web-owned strict token/grammar parser in `typed_ast.py`. The parser emits
  a canonical typed AST only after consuming the full governed input. Runtime
  execution for this domain is routed through `safe_solver_adapters.py`, which
  accepts only a hash-bound AST reconstruction and computes with exact
  Fraction arithmetic.

Supported family remains unchanged:
    a*x + b = c, a*x - b = c, x +/- b = c, a*x = c

Still refused:
    multiple variables, quadratics, parentheses, functions, decimals,
    malformed content, unmatched requested variables, and trailing content.

GP-010B-R1 supersedes the temporary backend: Lark performs strict parsing and SymPy performs exact solving behind the same Forge-owned contracts.
"""

from __future__ import annotations

from typing import Optional

from .contracts import ParsedQuestion, ExactSolution
from .typed_ast import parse_linear_equation_ast


class LinearEquationOneUnknownDomain:
    domain_id = "linear_equation_one_unknown"

    def relation_text(self) -> str:
        return "for a*var + b = c, var = (c - b) / a, solved by exact arithmetic and checked by substitution"

    def matches(self, question: str) -> bool:
        return self.parse(question) is not None

    def parse(self, question: str) -> Optional[ParsedQuestion]:
        ast = parse_linear_equation_ast(question)
        if ast is None:
            return None
        return ParsedQuestion(
            domain=self.domain_id,
            raw_question=question,
            quantities={
                "coefficient": ast.coefficient,
                "b": ast.constant_offset,
                "c": ast.right_hand_value,
            },
            metadata={
                "variable": ast.variable,
                "typed_ast_schema": ast.ast_schema,
                "typed_ast_hash": ast.ast_hash(),
                "grammar_id": ast.grammar_id,
                "parser_attestation": "strict_typed_ast_full_input_consumed",
                "parser_backend": "lark==1.3.1",
            },
        )

    def execute(self, parsed: ParsedQuestion) -> ExactSolution:
        """Compatibility entry point; execution still crosses the safe adapter."""
        from .safe_solver_adapters import execute_with_safe_solver_adapter
        _contract, _ast, solution, _receipt = execute_with_safe_solver_adapter(parsed)
        return solution


def register() -> bool:
    """Register the bounded equation capability contract. Idempotent."""
    from .capability_registry import CapabilityContract, register_capability
    return register_capability(
        CapabilityContract(
            capability_id="cap.math.linear_equation_one_unknown.v1",
            domain_id=LinearEquationOneUnknownDomain.domain_id,
            domain_factory=LinearEquationOneUnknownDomain,
            relation_text=LinearEquationOneUnknownDomain().relation_text(),
            source_fingerprints=("equation", "solve", "unknown", "variable", "both sides", "isolate"),
            min_fingerprint_hits=2,
            priority=30,
            parser_policy="full_input_required",
            executor_policy="typed_ast_sympy_exact_v2",
            verification_policy="sympy_exact_substitution_mandatory",
        )
    )


__all__ = ["LinearEquationOneUnknownDomain", "register"]
