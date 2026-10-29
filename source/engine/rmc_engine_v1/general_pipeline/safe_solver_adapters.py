"""GP-010B-R1 — SymPy-backed safe solver adapter.

The solver receives only a validated AI.Web typed AST. It never parses or
evaluates raw user text. The exact result remains subordinate to the governed
gate, Manifest Contract v2, renderer, and Echo approval.
"""
from __future__ import annotations
from dataclasses import dataclass
from fractions import Fraction
from typing import Any, Dict, Optional, Tuple
import sympy as sp
from .contracts import ParsedQuestion, ExactSolution, canonical_hash, fraction_to_text
from .dependency_registry import dependency_registry_hash, active_runtime_dependency_ids, validate_service_dependency_binding
from .typed_ast import LinearEquationAST, require_ast_for_parsed_question
GP007_BUILD_ID = "GENERAL-PIPELINE-STRICT-TYPED-AST-SAFE-ADAPTER-BUILD-GP-007"
GP007_SCHEMA_VERSION = "general_pipeline_strict_typed_ast_safe_adapter_v1_build_gp007"
GP010B_SOLVER_ACTIVATION_ID = "GENERAL-PIPELINE-AUDITED-SYMPY-SOLVER-ACTIVATION-BUILD-GP-010B-R1"
class SafeSolverAdapterBoundaryError(ValueError): pass
@dataclass(frozen=True)
class SafeSolverAdapterContract:
    adapter_id: str
    domain_id: str
    accepted_ast_schema: str
    grammar_id: str
    dependency_record_ids: Tuple[str, ...]
    dependency_registry_hash: str
    execution_policy: str = "typed_ast_sympy_exact_only"
    verification_policy: str = "sympy_exact_substitution_mandatory"
    input_policy: str = "strict_ast_reconstruction_required"
    side_effect_policy: str = "none"
    authority_owner: str = "forge"
    memory_write_allowed: bool = False
    identity_write_allowed: bool = False
    contribution_economy_write_allowed: bool = False
    ct_mint_allowed: bool = False
    render_output_allowed: bool = False
    echo_approval_allowed: bool = False
    def __post_init__(self) -> None:
        if self.authority_owner != "forge" or self.input_policy != "strict_ast_reconstruction_required" or self.side_effect_policy != "none": raise SafeSolverAdapterBoundaryError("invalid adapter authority")
        if self.execution_policy != "typed_ast_sympy_exact_only": raise SafeSolverAdapterBoundaryError("only typed-AST SymPy execution is approved")
        if self.dependency_registry_hash != dependency_registry_hash(): raise SafeSolverAdapterBoundaryError("adapter registry hash mismatch")
        validate_service_dependency_binding(self.dependency_record_ids, self.domain_id)
        if any((self.memory_write_allowed, self.identity_write_allowed, self.contribution_economy_write_allowed, self.ct_mint_allowed, self.render_output_allowed, self.echo_approval_allowed)): raise SafeSolverAdapterBoundaryError("solver cannot write, mint, render, or approve")
    def to_dict(self) -> Dict[str, Any]:
        return {"adapter_id":self.adapter_id,"domain_id":self.domain_id,"accepted_ast_schema":self.accepted_ast_schema,"grammar_id":self.grammar_id,"dependency_record_ids":list(self.dependency_record_ids),"dependency_registry_hash":self.dependency_registry_hash,"execution_policy":self.execution_policy,"verification_policy":self.verification_policy,"input_policy":self.input_policy,"side_effect_policy":self.side_effect_policy,"authority_owner":self.authority_owner,"memory_write_allowed":self.memory_write_allowed,"identity_write_allowed":self.identity_write_allowed,"contribution_economy_write_allowed":self.contribution_economy_write_allowed,"ct_mint_allowed":self.ct_mint_allowed,"render_output_allowed":self.render_output_allowed,"echo_approval_allowed":self.echo_approval_allowed}
    def contract_hash(self) -> str: return canonical_hash(self.to_dict())
@dataclass(frozen=True)
class SafeSolverAdapterReceipt:
    adapter_id: str
    adapter_contract_hash: str
    domain_id: str
    typed_ast_schema: str
    typed_ast_hash: str
    typed_ast_payload: Dict[str, Any]
    solution_hash: str
    solution_verified_observed: bool
    verification_method: str = "sympy_exact_substitution"
    solver_backend: str = "sympy==1.14.0"
    sympy_equation_repr: str = ""
    sympy_solution_repr: str = ""
    side_effects_observed: str = "none"
    gate_authority_retained: bool = True
    renderer_authority_retained: bool = True
    echo_authority_retained: bool = True
    def __post_init__(self) -> None:
        if canonical_hash(self.typed_ast_payload) != self.typed_ast_hash: raise SafeSolverAdapterBoundaryError("AST payload hash mismatch")
        if self.solver_backend != "sympy==1.14.0" or self.side_effects_observed != "none": raise SafeSolverAdapterBoundaryError("unapproved solver backend or side effect")
        if not all((self.gate_authority_retained, self.renderer_authority_retained, self.echo_authority_retained)): raise SafeSolverAdapterBoundaryError("solver absorbed downstream authority")
    def to_dict(self) -> Dict[str, Any]:
        return {"adapter_id":self.adapter_id,"adapter_contract_hash":self.adapter_contract_hash,"domain_id":self.domain_id,"typed_ast_schema":self.typed_ast_schema,"typed_ast_hash":self.typed_ast_hash,"typed_ast_payload":dict(self.typed_ast_payload),"solution_hash":self.solution_hash,"solution_verified_observed":self.solution_verified_observed,"verification_method":self.verification_method,"solver_backend":self.solver_backend,"sympy_equation_repr":self.sympy_equation_repr,"sympy_solution_repr":self.sympy_solution_repr,"side_effects_observed":self.side_effects_observed,"gate_authority_retained":self.gate_authority_retained,"renderer_authority_retained":self.renderer_authority_retained,"echo_authority_retained":self.echo_authority_retained}
    def receipt_hash(self) -> str: return canonical_hash(self.to_dict())
_LINEAR = SafeSolverAdapterContract(
    "adapter.math.linear_equation_one_unknown.sympy_exact.v2",
    "linear_equation_one_unknown",
    "linear_equation_one_unknown_ast_v1",
    "grammar.linear_equation_one_unknown.lark_1_3_1.v2",
    active_runtime_dependency_ids("linear_equation_one_unknown"),
    dependency_registry_hash(),
)
def safe_solver_adapter_for_domain(domain_id: str) -> Optional[SafeSolverAdapterContract]: return _LINEAR if domain_id == _LINEAR.domain_id else None
def _as_fraction(value: sp.Rational) -> Fraction: return Fraction(int(value.p), int(value.q))
def _solve_linear_ast(ast: LinearEquationAST) -> Tuple[ExactSolution, str, str]:
    variable = sp.Symbol(ast.variable)
    a = sp.Rational(ast.coefficient.numerator, ast.coefficient.denominator)
    b = sp.Rational(ast.constant_offset.numerator, ast.constant_offset.denominator)
    c = sp.Rational(ast.right_hand_value.numerator, ast.right_hand_value.denominator)
    equation = sp.Eq(a * variable + b, c)
    solution_set = sp.solveset(equation, variable, domain=sp.S.Reals)
    if not isinstance(solution_set, sp.FiniteSet) or len(solution_set) != 1: raise SafeSolverAdapterBoundaryError("SymPy did not return exactly one solution")
    sympy_value = next(iter(solution_set))
    verified = sp.simplify((a * variable + b).subs(variable, sympy_value) - c) == 0
    solution = _as_fraction(sympy_value)
    a_text, c_text, var = fraction_to_text(ast.coefficient), fraction_to_text(ast.right_hand_value), ast.variable
    var_term = ("" if ast.coefficient == 1 else "-" if ast.coefficient == -1 else a_text) + var
    lhs = var_term + (f" {'+' if ast.constant_offset >= 0 else '-'} {fraction_to_text(abs(ast.constant_offset))}" if ast.constant_offset else "")
    steps = []
    if ast.constant_offset:
        move = "Subtract" if ast.constant_offset > 0 else "Add"
        magnitude = fraction_to_text(abs(ast.constant_offset))
        steps.append(f"Start from {lhs} = {c_text}. {move} {magnitude} {'from' if ast.constant_offset > 0 else 'to'} both sides: {var_term} = {fraction_to_text(ast.right_hand_value - ast.constant_offset)}.")
    if ast.coefficient != 1:
        steps.append(f"Divide both sides by {a_text}: {var} = {fraction_to_text(ast.right_hand_value - ast.constant_offset)} ÷ {a_text} = {fraction_to_text(solution)}.")
    elif ast.constant_offset:
        steps.append(f"So {var} = {fraction_to_text(solution)}.")
    else:
        steps.append(f"The equation already gives {var} = {fraction_to_text(solution)}.")
    calculated = ast.coefficient * solution + ast.constant_offset
    verification = f"Check: substituting {var} = {fraction_to_text(solution)} gives {fraction_to_text(calculated)} = {c_text}, which matches {c_text}."
    result = ExactSolution(domain="linear_equation_one_unknown", answer_value=solution, answer_unit="", steps=steps, verification_text=verification, verified=bool(verified), information_gain=1_000_000 if verified else 0)
    return result, str(equation), str(sympy_value)
def typed_ast_binding_for_parsed(parsed: ParsedQuestion) -> Optional[Dict[str, Any]]:
    adapter = safe_solver_adapter_for_domain(parsed.domain)
    if adapter is None: return None
    ast = require_ast_for_parsed_question(parsed)
    return {"safe_solver_adapter_id":adapter.adapter_id,"safe_solver_adapter_contract_hash":adapter.contract_hash(),"typed_ast_schema":ast.ast_schema,"typed_ast_hash":ast.ast_hash(),"typed_ast_payload":ast.to_dict()}
def execute_with_safe_solver_adapter(parsed: ParsedQuestion):
    adapter = safe_solver_adapter_for_domain(parsed.domain)
    if adapter is None: raise SafeSolverAdapterBoundaryError("no approved solver adapter")
    ast = require_ast_for_parsed_question(parsed)
    solution, equation_repr, solution_repr = _solve_linear_ast(ast)
    receipt = SafeSolverAdapterReceipt(adapter.adapter_id, adapter.contract_hash(), parsed.domain, ast.ast_schema, ast.ast_hash(), ast.to_dict(), canonical_hash(solution.to_dict()), solution.verified, sympy_equation_repr=equation_repr, sympy_solution_repr=solution_repr)
    return adapter, ast, solution, receipt
def safe_solver_adapter_boundary_contract() -> Dict[str, Any]:
    return {"build_id":GP010B_SOLVER_ACTIVATION_ID,"schema_version":GP007_SCHEMA_VERSION,"adapter_model":"forge_governed_sympy_typed_ast_solver_not_agent","active_adapter_ids":[_LINEAR.adapter_id],"adapter_accepts_raw_user_expression":False,"adapter_accepts_only_verified_typed_ast_binding":True,"solver_backend":"sympy==1.14.0","third_party_solver_imported":True,"candidate_dependencies_promoted":["sympy==1.14.0", "mpmath==1.3.0"],"adds_new_domain":False,"writes_memory":False,"writes_identity_vault":False,"writes_contribution_economy":False,"writes_ledgers":False,"mints_ct":False,"adds_corpus_ingestion":False}
