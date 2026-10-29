"""NL-MATH-001 / GP-013 — bounded natural-language symbolic mathematics compiler.

This compiler is an AI.Web-owned, standard-library parser for one complete
vertical slice.  It accepts ordinary request language surrounding a bounded
mathematical expression, consumes the entire input, converts the expression to
the installed MATH-001R1 allowlisted recursive AST, and emits a typed
SymbolicMathOperationManifest.

It never passes natural-language text or raw expression strings to SymPy.
Unsupported phrasing is refused; it is not guessed or partially consumed.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Mapping, Optional, Tuple
import re

from .contracts import canonical_hash
from .symbolic_math_ast import (
    MATH001_CAPABILITY_ID,
    SymbolicMathOperationManifest,
    SymbolicMathResourcePolicy,
)

BUILD_ID = "NL-MATH-001-GP-013-NATURAL-LANGUAGE-SYMBOLIC-EXPRESSION-TO-ECHO-VERTICAL-SLICE"
SCHEMA_VERSION = "aiweb_nl_symbolic_math_request_compiler_v1_gp013"
DOMAIN_ID = "symbolic_math_expression_calculus"
LANGUAGE_CAPABILITY_ID = "cap.language.symbolic_math_expression_calculus.v1"
PARSER_ID = "parser.aiweb.nl_symbolic_expression_calculus.v1"

SUPPORTED_LANGUAGE_FAMILIES: Tuple[str, ...] = (
    "simplification",
    "expansion",
    "factoring",
    "trigonometric_simplification",
    "trigonometric_expansion",
    "differentiation",
    "integration",
    "limits",
)

_FUNCTION_NAMES = {"sin", "cos", "tan", "asin", "acos", "atan", "exp", "log", "sqrt", "abs"}
_CONSTANT_NAMES = {"pi": "pi", "e": "E", "i": "I", "oo": "oo", "infinity": "oo"}
_ALLOWED_SYMBOL_NAMES = {"x", "y", "z", "t", "n", "i", "a", "b", "c", "u", "v"}
_IDENTIFIER = re.compile(r"^[a-z][a-z0-9_]{0,31}$", re.I)
_MAX_INPUT_CHARS = 600
_MAX_TOKENS = 192
_LANGUAGE_SLICE_DEFAULT_RESOURCE_POLICY = {
    "wall_timeout_seconds": 15,
    "cpu_seconds": 12,
    "memory_megabytes": 4096,
    "output_character_limit": 24000,
    "ast_node_limit": 256,
}


class SymbolicMathLanguageBoundaryError(ValueError):
    """Raised when user language cannot be fully and safely compiled."""


@dataclass(frozen=True)
class LanguageCompilerReceipt:
    raw_question_hash: str
    normalized_request_hash: str
    operation_family: str
    expression_ast_hash: str
    operation_manifest_hash: str
    parsed_variable: str
    full_input_consumed: bool = True
    parser_id: str = PARSER_ID
    parser_backend: str = "aiweb_stdlib_recursive_descent_bounded_expression_v1"
    raw_text_sent_to_sympy: bool = False
    corpus_used: bool = False
    llm_used: bool = False
    schema_version: str = "aiweb_nl_symbolic_math_compiler_receipt_v1_gp013"

    def __post_init__(self) -> None:
        for digest in (
            self.raw_question_hash,
            self.normalized_request_hash,
            self.expression_ast_hash,
            self.operation_manifest_hash,
        ):
            if not isinstance(digest, str) or re.fullmatch(r"[0-9a-f]{64}", digest) is None:
                raise SymbolicMathLanguageBoundaryError("compiler receipt requires SHA-256 bindings")
        if self.operation_family not in SUPPORTED_LANGUAGE_FAMILIES:
            raise SymbolicMathLanguageBoundaryError("compiler receipt operation is outside the language slice")
        if not self.full_input_consumed or self.raw_text_sent_to_sympy or self.corpus_used or self.llm_used:
            raise SymbolicMathLanguageBoundaryError("compiler boundary may not be weakened")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "parser_id": self.parser_id,
            "parser_backend": self.parser_backend,
            "raw_question_hash": self.raw_question_hash,
            "normalized_request_hash": self.normalized_request_hash,
            "operation_family": self.operation_family,
            "expression_ast_hash": self.expression_ast_hash,
            "operation_manifest_hash": self.operation_manifest_hash,
            "parsed_variable": self.parsed_variable,
            "full_input_consumed": self.full_input_consumed,
            "raw_text_sent_to_sympy": self.raw_text_sent_to_sympy,
            "corpus_used": self.corpus_used,
            "llm_used": self.llm_used,
        }

    def receipt_hash(self) -> str:
        return canonical_hash(self.to_dict())


@dataclass(frozen=True)
class CompiledSymbolicMathRequest:
    raw_question: str
    normalized_request: str
    operation_family: str
    expression_display: str
    variable: str
    operation_manifest: SymbolicMathOperationManifest
    compiler_receipt: LanguageCompilerReceipt
    requested_output_mode: str = "human_text"
    domain_id: str = DOMAIN_ID
    schema_version: str = SCHEMA_VERSION

    def __post_init__(self) -> None:
        if self.operation_family not in SUPPORTED_LANGUAGE_FAMILIES:
            raise SymbolicMathLanguageBoundaryError("compiled request operation is unsupported")
        if self.domain_id != DOMAIN_ID or self.requested_output_mode != "human_text":
            raise SymbolicMathLanguageBoundaryError("compiled request authority mismatch")
        if self.operation_manifest.operation_family != self.operation_family:
            raise SymbolicMathLanguageBoundaryError("compiler and operation manifest families differ")
        if self.operation_manifest.manifest_hash() != self.compiler_receipt.operation_manifest_hash:
            raise SymbolicMathLanguageBoundaryError("compiled request does not bind operation manifest")
        if self.variable and _IDENTIFIER.fullmatch(self.variable) is None:
            raise SymbolicMathLanguageBoundaryError("invalid request variable")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "domain_id": self.domain_id,
            "raw_question": self.raw_question,
            "normalized_request": self.normalized_request,
            "operation_family": self.operation_family,
            "expression_display": self.expression_display,
            "variable": self.variable,
            "requested_output_mode": self.requested_output_mode,
            "operation_manifest": self.operation_manifest.to_dict(),
            "operation_manifest_hash": self.operation_manifest.manifest_hash(),
            "compiler_receipt": self.compiler_receipt.to_dict(),
            "compiler_receipt_hash": self.compiler_receipt.receipt_hash(),
        }

    def request_hash(self) -> str:
        return canonical_hash(self.to_dict())


def _integer(value: int) -> Dict[str, Any]:
    return {"node": "integer", "value": value}


def _symbol(name: str) -> Dict[str, Any]:
    if not _IDENTIFIER.fullmatch(name) or name.lower() not in _ALLOWED_SYMBOL_NAMES:
        raise SymbolicMathLanguageBoundaryError(
            "expression symbol is outside the bounded first-slice symbol vocabulary"
        )
    return {"node": "symbol", "name": name.lower()}


def _constant(name: str) -> Dict[str, Any]:
    return {"node": "constant", "name": _CONSTANT_NAMES[name.lower()]}


def _normalise_phrase(text: str) -> str:
    q = str(text).strip()
    if not q or len(q) > _MAX_INPUT_CHARS:
        raise SymbolicMathLanguageBoundaryError("request is empty or exceeds length boundary")
    q = q.replace("−", "-").replace("×", "*").replace("÷", "/")
    q = q.replace("²", "^2").replace("³", "^3")
    q = re.sub(r"\s+", " ", q).strip().lower()
    q = q.rstrip(" ?.!").strip()
    return q


def _rewrite_expression_words(expr: str) -> str:
    value = " " + expr.strip().lower() + " "
    replacements = (
        (r"\s+squared\b", "^2"),
        (r"\s+cubed\b", "^3"),
        (r"\bmultiplied\s+by\b", "*"),
        (r"\btimes\b", "*"),
        (r"\bdivided\s+by\b", "/"),
        (r"\bplus\b", "+"),
        (r"\bminus\b", "-"),
    )
    for pattern, replacement in replacements:
        value = re.sub(pattern, replacement, value)
    return re.sub(r"\s+", " ", value).strip()


_TOKEN_RE = re.compile(
    r"\s*(?:(?P<int>\d+)|(?P<name>[a-z][a-z0-9_]*)|(?P<op>[+\-*/^(),]))",
    re.I,
)


def _tokenize(expr: str) -> List[Tuple[str, str]]:
    expression = _rewrite_expression_words(expr)
    tokens: List[Tuple[str, str]] = []
    pos = 0
    while pos < len(expression):
        match = _TOKEN_RE.match(expression, pos)
        if not match:
            raise SymbolicMathLanguageBoundaryError(
                f"expression contains unsupported content near {expression[pos:pos+20]!r}"
            )
        if match.group("int") is not None:
            tokens.append(("int", match.group("int")))
        elif match.group("name") is not None:
            tokens.append(("name", match.group("name").lower()))
        else:
            tokens.append(("op", match.group("op")))
        pos = match.end()
    if not tokens or len(tokens) > _MAX_TOKENS:
        raise SymbolicMathLanguageBoundaryError("expression token budget violated")

    # Insert deterministic implicit multiplication: 4x, 2(x+1), (x+1)(x-1),
    # and x sin(x).  A recognized function directly followed by '(' remains a call.
    output: List[Tuple[str, str]] = []
    for token in tokens:
        if output:
            prev = output[-1]
            prev_closes = prev[0] in {"int", "name"} or (prev[0] == "op" and prev[1] == ")")
            curr_opens = token[0] in {"int", "name"} or (token[0] == "op" and token[1] == "(")
            function_call = prev[0] == "name" and prev[1] in _FUNCTION_NAMES and token == ("op", "(")
            if prev_closes and curr_opens and not function_call:
                output.append(("op", "*"))
        output.append(token)
    return output


class _ExpressionParser:
    def __init__(self, tokens: Iterable[Tuple[str, str]]) -> None:
        self.tokens = list(tokens)
        self.index = 0

    def peek(self) -> Optional[Tuple[str, str]]:
        return self.tokens[self.index] if self.index < len(self.tokens) else None

    def take(self, expected: Optional[str] = None) -> Tuple[str, str]:
        token = self.peek()
        if token is None:
            raise SymbolicMathLanguageBoundaryError("expression ended unexpectedly")
        if expected is not None and token[1] != expected:
            raise SymbolicMathLanguageBoundaryError(f"expected {expected!r}, received {token[1]!r}")
        self.index += 1
        return token

    def parse(self) -> Dict[str, Any]:
        node = self.expression()
        if self.peek() is not None:
            raise SymbolicMathLanguageBoundaryError("expression input was not fully consumed")
        return node

    def expression(self) -> Dict[str, Any]:
        node = self.product()
        while self.peek() is not None and self.peek()[1] in {"+", "-"}:
            op = self.take()[1]
            right = self.product()
            node = {"node": "add", "args": [node, right if op == "+" else {"node": "neg", "arg": right}]}
        return node

    def product(self) -> Dict[str, Any]:
        node = self.unary()
        while self.peek() is not None and self.peek()[1] in {"*", "/"}:
            op = self.take()[1]
            right = self.unary()
            node = {
                "node": "mul",
                "args": [node, right if op == "*" else {"node": "pow", "base": right, "exponent": _integer(-1)}],
            }
        return node

    def unary(self) -> Dict[str, Any]:
        if self.peek() is not None and self.peek()[1] == "-":
            self.take("-")
            return {"node": "neg", "arg": self.unary()}
        return self.power()

    def power(self) -> Dict[str, Any]:
        node = self.primary()
        if self.peek() is not None and self.peek()[1] == "^":
            self.take("^")
            node = {"node": "pow", "base": node, "exponent": self.unary()}
        return node

    def primary(self) -> Dict[str, Any]:
        token = self.peek()
        if token is None:
            raise SymbolicMathLanguageBoundaryError("missing expression atom")
        if token[0] == "int":
            self.take()
            return _integer(int(token[1]))
        if token[0] == "name":
            name = self.take()[1]
            if name in _CONSTANT_NAMES:
                return _constant(name)
            if self.peek() == ("op", "("):
                if name not in _FUNCTION_NAMES:
                    raise SymbolicMathLanguageBoundaryError(f"function {name!r} is not allowlisted")
                self.take("(")
                args = [self.expression()]
                while self.peek() == ("op", ","):
                    self.take(",")
                    args.append(self.expression())
                self.take(")")
                return {"node": "function", "name": name, "args": args}
            return _symbol(name)
        if token == ("op", "("):
            self.take("(")
            node = self.expression()
            self.take(")")
            return node
        raise SymbolicMathLanguageBoundaryError(f"unsupported expression atom {token!r}")


def compile_expression_ast(expression: str) -> Dict[str, Any]:
    return _ExpressionParser(_tokenize(expression)).parse()


def _operation_parts(normalized: str) -> Tuple[str, str, str, Optional[str]]:
    patterns: Tuple[Tuple[str, str], ...] = (
        ("differentiation", r"^(?:differentiate|find the derivative of|what is the derivative of)\s+(.+?)\s+(?:with respect to|in terms of)\s+([a-z][a-z0-9_]*)$"),
        ("integration", r"^(?:integrate|find the indefinite integral of|find the antiderivative of)\s+(.+?)\s+(?:with respect to|in terms of)\s+([a-z][a-z0-9_]*)$"),
        ("limits", r"^(?:find the limit of|compute the limit of|limit of)\s+(.+?)\s+as\s+([a-z][a-z0-9_]*)\s+approaches\s+(.+)$"),
        ("trigonometric_simplification", r"^(?:trigonometric simplify|trig simplify|simplify the trigonometric expression)\s+(.+)$"),
        ("trigonometric_expansion", r"^(?:trigonometric expand|trig expand|expand the trigonometric expression)\s+(.+)$"),
        ("simplification", r"^(?:simplify|reduce)\s+(.+)$"),
        ("expansion", r"^(?:expand)\s+(.+)$"),
        ("factoring", r"^(?:factor|factorize)\s+(.+)$"),
    )
    for family, pattern in patterns:
        match = re.fullmatch(pattern, normalized)
        if match:
            if family in {"differentiation", "integration"}:
                return family, match.group(1), match.group(2), None
            if family == "limits":
                return family, match.group(1), match.group(2), match.group(3)
            return family, match.group(1), "", None
    raise SymbolicMathLanguageBoundaryError("request is outside the supported full-input language grammar")


def compile_symbolic_math_request(
    question: str,
    *,
    resource_policy: Optional[SymbolicMathResourcePolicy] = None,
) -> CompiledSymbolicMathRequest:
    normalized = _normalise_phrase(question)
    family, expression, variable, point_expression = _operation_parts(normalized)
    expression_ast = compile_expression_ast(expression)
    policy = resource_policy or SymbolicMathResourcePolicy(**_LANGUAGE_SLICE_DEFAULT_RESOURCE_POLICY)
    operands: Dict[str, Any]
    if family == "differentiation":
        operands = {"value": expression_ast, "variable": _symbol(variable), "order": 1}
    elif family == "integration":
        operands = {"value": expression_ast, "variable": _symbol(variable)}
    elif family == "limits":
        operands = {
            "value": expression_ast,
            "variable": _symbol(variable),
            "point": compile_expression_ast(str(point_expression)),
            "direction": "+-",
        }
    else:
        operands = {"value": expression_ast}

    manifest = SymbolicMathOperationManifest(
        operation_id="nlmath.gp013." + canonical_hash({"question": normalized, "family": family})[:24],
        operation_family=family,
        operands=operands,
        resource_policy=policy,
    )
    receipt = LanguageCompilerReceipt(
        raw_question_hash=canonical_hash({"raw_question": str(question)}),
        normalized_request_hash=canonical_hash({"normalized_request": normalized}),
        operation_family=family,
        expression_ast_hash=canonical_hash(expression_ast),
        operation_manifest_hash=manifest.manifest_hash(),
        parsed_variable=variable,
    )
    return CompiledSymbolicMathRequest(
        raw_question=str(question),
        normalized_request=normalized,
        operation_family=family,
        expression_display=_rewrite_expression_words(expression),
        variable=variable,
        operation_manifest=manifest,
        compiler_receipt=receipt,
    )


def language_compiler_boundary() -> Dict[str, Any]:
    return {
        "build_id": BUILD_ID,
        "schema_version": SCHEMA_VERSION,
        "domain_id": DOMAIN_ID,
        "language_capability_id": LANGUAGE_CAPABILITY_ID,
        "delegated_computation_capability_id": MATH001_CAPABILITY_ID,
        "supported_operation_families": list(SUPPORTED_LANGUAGE_FAMILIES),
        "full_input_consumption_required": True,
        "bounded_symbol_vocabulary": sorted(_ALLOWED_SYMBOL_NAMES),
        "parser_backend": "aiweb_stdlib_recursive_descent_bounded_expression_v1",
        "raw_user_text_sent_to_sympy": False,
        "typed_symbolic_math_manifest_emitted": True,
        "default_isolated_worker_resource_policy": dict(_LANGUAGE_SLICE_DEFAULT_RESOURCE_POLICY),
        "resource_policy_remains_within_math001r1_governed_bounds": True,
        "corpus_ingestion_added": False,
        "calls_llm": False,
        "writes_memory": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "mints_ct": False,
        "writes_ledgers": False,
    }


__all__ = [
    "BUILD_ID", "SCHEMA_VERSION", "DOMAIN_ID", "LANGUAGE_CAPABILITY_ID",
    "PARSER_ID", "SUPPORTED_LANGUAGE_FAMILIES", "SymbolicMathLanguageBoundaryError",
    "LanguageCompilerReceipt", "CompiledSymbolicMathRequest",
    "compile_expression_ast", "compile_symbolic_math_request", "language_compiler_boundary",
]
