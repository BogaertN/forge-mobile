"""GP-010B-R1 — Lark-backed strict typed AST for governed linear equations."""
from __future__ import annotations
from dataclasses import dataclass
from fractions import Fraction
from typing import Any, Dict, Optional, Tuple
import re
from lark import Lark, Transformer, UnexpectedInput
from .contracts import ParsedQuestion, canonical_hash, fraction_to_text
GP007_BUILD_ID = "GENERAL-PIPELINE-STRICT-TYPED-AST-SAFE-ADAPTER-BUILD-GP-007"
GP007_SCHEMA_VERSION = "general_pipeline_strict_typed_ast_safe_adapter_v1_build_gp007"
GP010B_PARSER_ACTIVATION_ID = "GENERAL-PIPELINE-AUDITED-LARK-PARSER-ACTIVATION-BUILD-GP-010B-R1"
LINEAR_EQUATION_AST_SCHEMA = "linear_equation_one_unknown_ast_v1"
LINEAR_EQUATION_GRAMMAR_ID = "grammar.linear_equation_one_unknown.lark_1_3_1.v2"
class TypedASTBoundaryError(ValueError): pass
@dataclass(frozen=True)
class LinearEquationAST:
    variable: str; coefficient: Fraction; constant_offset: Fraction; right_hand_value: Fraction; normalized_input: str; expression_text: str; requested_variable: Optional[str] = None; ast_schema: str = LINEAR_EQUATION_AST_SCHEMA; grammar_id: str = LINEAR_EQUATION_GRAMMAR_ID; full_input_consumed: bool = True
    def __post_init__(self) -> None:
        if self.ast_schema != LINEAR_EQUATION_AST_SCHEMA or self.grammar_id != LINEAR_EQUATION_GRAMMAR_ID: raise TypedASTBoundaryError("unapproved AST schema or grammar")
        if not re.fullmatch(r"[a-z]", self.variable): raise TypedASTBoundaryError("invalid variable")
        if self.requested_variable is not None and self.requested_variable != self.variable: raise TypedASTBoundaryError("requested variable mismatch")
        if self.coefficient == 0 or not self.full_input_consumed: raise TypedASTBoundaryError("equation must resolve exactly one unknown with full parse")
    def to_dict(self) -> Dict[str, Any]:
        return {"ast_schema":self.ast_schema,"grammar_id":self.grammar_id,"variable":self.variable,"coefficient":fraction_to_text(self.coefficient),"constant_offset":fraction_to_text(self.constant_offset),"right_hand_value":fraction_to_text(self.right_hand_value),"normalized_input":self.normalized_input,"expression_text":self.expression_text,"requested_variable":self.requested_variable,"full_input_consumed":self.full_input_consumed,"parser_backend":"lark==1.3.1"}
    def ast_hash(self) -> str: return canonical_hash(self.to_dict())
@dataclass(frozen=True)
class TypedASTParseReceipt:
    raw_question_hash: str; normalized_input: str; grammar_id: str; status: str; full_input_consumed: bool; reason: str; token_payload: Tuple[Dict[str, Any], ...] = (); ast_hash: Optional[str] = None; parser_backend: str = "lark==1.3.1"
    def to_dict(self) -> Dict[str, Any]: return {"raw_question_hash":self.raw_question_hash,"normalized_input":self.normalized_input,"grammar_id":self.grammar_id,"status":self.status,"full_input_consumed":self.full_input_consumed,"reason":self.reason,"token_payload":list(self.token_payload),"ast_hash":self.ast_hash,"parser_backend":self.parser_backend}
    def receipt_hash(self) -> str: return canonical_hash(self.to_dict())
_GRAMMAR = r'''
start: prefix? variable_term offset? "=" signed_number request? punctuation?
prefix: "solve" | "find" | "compute" | "evaluate" | "what" "is" | "whats" | "what's"
variable_term: signed_number VAR -> numbered_var
             | "-" VAR          -> negative_unit_var
             | "+" VAR          -> positive_unit_var
             | VAR               -> unit_var
offset: "+" unsigned_number -> plus_offset
      | "-" unsigned_number -> minus_offset
request: "for" VAR
punctuation: "." | "?"
signed_number: SIGNED_FRAC
unsigned_number: UNSIGNED_FRAC
SIGNED_FRAC: /[+-]?\d+(?:\/\d+)?/
UNSIGNED_FRAC: /\d+(?:\/\d+)?/
VAR: /[a-z]/
%import common.WS
%ignore WS
'''
_PARSER = Lark(_GRAMMAR, parser="lalr", lexer="contextual", maybe_placeholders=False)
def _normalise(text: str) -> str: return " ".join(str(text).strip().lower().split())
def _fraction(text: str) -> Fraction:
    try: return Fraction(str(text))
    except Exception as exc: raise TypedASTBoundaryError("invalid rational numeric token") from exc
class _Fields(Transformer):
    def signed_number(self, items): return _fraction(items[0])
    def unsigned_number(self, items): return _fraction(items[0])
    def numbered_var(self, items): return {"coefficient": items[0], "variable": str(items[1])}
    def negative_unit_var(self, items): return {"coefficient": Fraction(-1), "variable": str(items[0])}
    def positive_unit_var(self, items): return {"coefficient": Fraction(1), "variable": str(items[0])}
    def unit_var(self, items): return {"coefficient": Fraction(1), "variable": str(items[0])}
    def plus_offset(self, items): return ("offset", items[0])
    def minus_offset(self, items): return ("offset", -items[0])
    def request(self, items): return ("request", str(items[0]))
    def prefix(self, items): return None
    def punctuation(self, items): return None
    def start(self, items):
        term = next(item for item in items if isinstance(item, dict))
        rhs = next(item for item in reversed(items) if isinstance(item, Fraction))
        offset = next((item[1] for item in items if isinstance(item, tuple) and item[0] == "offset"), Fraction(0))
        requested = next((item[1] for item in items if isinstance(item, tuple) and item[0] == "request"), None)
        return term["coefficient"], term["variable"], offset, rhs, requested
_TRANSFORMER = _Fields()
def inspect_linear_equation_parse(question: str):
    normalized = _normalise(question); qhash = canonical_hash({"question": question})
    try:
        coefficient, variable, offset, rhs, requested = _TRANSFORMER.transform(_PARSER.parse(normalized))
        ast = LinearEquationAST(variable, coefficient, offset, rhs, normalized, normalized, requested)
        return ast, TypedASTParseReceipt(qhash, normalized, LINEAR_EQUATION_GRAMMAR_ID, "ACCEPTED", True, "full input accepted by audited Lark grammar", (), ast.ast_hash())
    except (UnexpectedInput, TypedASTBoundaryError, ValueError, StopIteration, IndexError) as exc:
        return None, TypedASTParseReceipt(qhash, normalized, LINEAR_EQUATION_GRAMMAR_ID, "REFUSED", False, f"strict Lark grammar refusal: {type(exc).__name__}")
def parse_linear_equation_ast(question: str): return inspect_linear_equation_parse(question)[0]
def require_ast_for_parsed_question(parsed: ParsedQuestion) -> LinearEquationAST:
    ast = parse_linear_equation_ast(parsed.raw_question)
    if ast is None: raise TypedASTBoundaryError("parsed input no longer passes audited Lark grammar")
    if parsed.domain != "linear_equation_one_unknown": raise TypedASTBoundaryError("AST bound only to equation domain")
    expected = {"coefficient": ast.coefficient, "b": ast.constant_offset, "c": ast.right_hand_value}
    if parsed.quantities != expected or parsed.metadata.get("typed_ast_hash") != ast.ast_hash(): raise TypedASTBoundaryError("parsed payload does not match canonical AST")
    if parsed.metadata.get("parser_backend") != "lark==1.3.1": raise TypedASTBoundaryError("parsed payload missing Lark attestation")
    return ast
def typed_ast_boundary_contract() -> Dict[str, Any]:
    return {"build_id":GP010B_PARSER_ACTIVATION_ID,"schema_version":GP007_SCHEMA_VERSION,"supersedes_gp007_parser_backend":True,"typed_ast_schema":LINEAR_EQUATION_AST_SCHEMA,"grammar_id":LINEAR_EQUATION_GRAMMAR_ID,"parser_backend":"lark==1.3.1","third_party_parser_imported":True,"third_party_solver_imported":False,"full_input_required":True,"raw_expression_evaluation_allowed":False,"raw_expression_eval_allowed":False,"adds_new_domain":False,"adds_corpus_ingestion":False,"writes_memory":False,"writes_identity_vault":False,"writes_contribution_economy":False,"writes_ledgers":False,"mints_ct":False}
