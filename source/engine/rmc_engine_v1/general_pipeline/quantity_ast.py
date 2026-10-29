"""GP-011B — Pint-bound typed quantity AST for governed capacity reasoning.

This module gives the existing fraction-change capacity domain a typed quantity
boundary. It accepts only a quantity unit token already extracted by the
bounded capacity parser, resolves that token with the audited Pint registry,
and permits only mass or volume capacity dimensions. It does not interpret
arbitrary prose, authorize a new domain, render output, or write state.
"""
from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction
from typing import Any, Dict, Optional
import re

import pint

from .contracts import ParsedQuestion, canonical_hash, fraction_to_text

GP011B_BUILD_ID = "GENERAL-PIPELINE-PINT-QUANTITY-CAPACITY-INTEGRATION-BUILD-GP-011B"
GP011B_SCHEMA_VERSION = "general_pipeline_pint_quantity_capacity_integration_v1_build_gp011b"
CAPACITY_QUANTITY_AST_SCHEMA = "fraction_change_capacity_quantity_ast_v1"
CAPACITY_UNIT_POLICY_ID = "unit_policy.capacity_mass_or_volume.pint_0_25_3.v1"
PINT_BACKEND = "pint==0.25.3"

class QuantityASTBoundaryError(ValueError):
    pass

_UREG = pint.UnitRegistry()
_ALLOWED_DIMENSIONALITIES = {"[mass]", "[length] ** 3"}
_SAFE_UNIT_TOKEN = re.compile(r"^[a-z]+(?:\s+per\s+[a-z]+|/[a-z]+)?$", re.IGNORECASE)

def _validated_unit(raw: str) -> pint.Unit:
    normalized = " ".join(str(raw).strip().lower().split())
    if not normalized or _SAFE_UNIT_TOKEN.fullmatch(normalized) is None:
        raise QuantityASTBoundaryError("unit token violates the capacity unit grammar")
    expression = normalized.replace(" per ", " / ")
    try:
        unit = _UREG.parse_units(expression)
    except Exception as exc:
        raise QuantityASTBoundaryError("unit is not recognized by the audited Pint registry") from exc
    return unit

def _dimension_text(unit: pint.Unit) -> str:
    return str(unit.dimensionality)

@dataclass(frozen=True)
class CapacityQuantityAST:
    initial_fraction: Fraction
    final_fraction: Fraction
    removed_amount: Fraction
    removed_unit_text: str
    requested_output_unit_text: str
    normalized_removed_unit: str
    normalized_output_unit: str
    dimensionality: str
    normalized_input: str
    ast_schema: str = CAPACITY_QUANTITY_AST_SCHEMA
    unit_policy_id: str = CAPACITY_UNIT_POLICY_ID
    parser_backend: str = PINT_BACKEND
    full_input_consumed: bool = True

    def __post_init__(self) -> None:
        if self.ast_schema != CAPACITY_QUANTITY_AST_SCHEMA or self.unit_policy_id != CAPACITY_UNIT_POLICY_ID:
            raise QuantityASTBoundaryError("unapproved quantity AST schema or unit policy")
        if self.parser_backend != PINT_BACKEND or not self.full_input_consumed:
            raise QuantityASTBoundaryError("quantity AST lacks approved Pint/full-input attestation")
        if self.initial_fraction <= self.final_fraction:
            raise QuantityASTBoundaryError("capacity problem requires a positive removed fraction")
        if self.removed_amount <= 0:
            raise QuantityASTBoundaryError("capacity problem requires a positive removed amount")
        if self.dimensionality not in _ALLOWED_DIMENSIONALITIES:
            raise QuantityASTBoundaryError("supported capacity quantities must be mass or volume")
        input_unit = _validated_unit(self.removed_unit_text)
        output_unit = _validated_unit(self.requested_output_unit_text)
        if _dimension_text(input_unit) != self.dimensionality or _dimension_text(output_unit) != self.dimensionality:
            raise QuantityASTBoundaryError("output unit is not dimensionally compatible with removed quantity")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ast_schema": self.ast_schema,
            "unit_policy_id": self.unit_policy_id,
            "parser_backend": self.parser_backend,
            "initial_fraction": fraction_to_text(self.initial_fraction),
            "final_fraction": fraction_to_text(self.final_fraction),
            "removed_amount": fraction_to_text(self.removed_amount),
            "removed_unit_text": self.removed_unit_text,
            "requested_output_unit_text": self.requested_output_unit_text,
            "normalized_removed_unit": self.normalized_removed_unit,
            "normalized_output_unit": self.normalized_output_unit,
            "dimensionality": self.dimensionality,
            "normalized_input": self.normalized_input,
            "full_input_consumed": self.full_input_consumed,
        }

    def ast_hash(self) -> str:
        return canonical_hash(self.to_dict())

def build_capacity_quantity_ast(parsed: ParsedQuestion) -> CapacityQuantityAST:
    if parsed.domain != "fraction_change_capacity":
        raise QuantityASTBoundaryError("quantity AST binds only the fraction-change capacity domain")
    unit_text = parsed.metadata.get("unit", "").strip().lower()
    output_unit_text = parsed.metadata.get("output_unit", unit_text).strip().lower()
    input_unit = _validated_unit(unit_text)
    output_unit = _validated_unit(output_unit_text)
    dimensionality = _dimension_text(input_unit)
    if dimensionality not in _ALLOWED_DIMENSIONALITIES:
        raise QuantityASTBoundaryError("capacity domain supports only mass or volume quantities")
    if _dimension_text(output_unit) != dimensionality:
        raise QuantityASTBoundaryError("requested output unit is incompatible with removed quantity")
    return CapacityQuantityAST(
        initial_fraction=parsed.quantities["initial"],
        final_fraction=parsed.quantities["final"],
        removed_amount=parsed.quantities["removed"],
        removed_unit_text=unit_text,
        requested_output_unit_text=output_unit_text,
        normalized_removed_unit=str(input_unit),
        normalized_output_unit=str(output_unit),
        dimensionality=dimensionality,
        normalized_input=" ".join(parsed.raw_question.strip().lower().split()),
    )

def bind_capacity_quantity_metadata(parsed: ParsedQuestion) -> ParsedQuestion:
    ast = build_capacity_quantity_ast(parsed)
    metadata = dict(parsed.metadata)
    metadata.update({
        "quantity_ast_schema": ast.ast_schema,
        "quantity_ast_hash": ast.ast_hash(),
        "quantity_parser_backend": ast.parser_backend,
        "quantity_dimensionality": ast.dimensionality,
        "normalized_unit": ast.normalized_removed_unit,
        "normalized_output_unit": ast.normalized_output_unit,
    })
    return ParsedQuestion(parsed.domain, parsed.raw_question, dict(parsed.quantities), metadata)

def require_capacity_quantity_ast(parsed: ParsedQuestion) -> CapacityQuantityAST:
    ast = build_capacity_quantity_ast(parsed)
    if parsed.metadata.get("quantity_ast_schema") != ast.ast_schema:
        raise QuantityASTBoundaryError("parsed payload lacks quantity AST schema binding")
    if parsed.metadata.get("quantity_ast_hash") != ast.ast_hash():
        raise QuantityASTBoundaryError("parsed payload quantity AST hash is stale or tampered")
    if parsed.metadata.get("quantity_parser_backend") != PINT_BACKEND:
        raise QuantityASTBoundaryError("parsed payload lacks approved Pint backend attestation")
    return ast

def quantity_ast_boundary_contract() -> Dict[str, Any]:
    return {
        "build_id": GP011B_BUILD_ID,
        "schema_version": GP011B_SCHEMA_VERSION,
        "typed_ast_schema": CAPACITY_QUANTITY_AST_SCHEMA,
        "unit_policy_id": CAPACITY_UNIT_POLICY_ID,
        "parser_backend": PINT_BACKEND,
        "active_domain": "fraction_change_capacity",
        "allowed_dimensionalities": sorted(_ALLOWED_DIMENSIONALITIES),
        "full_input_required": True,
        "arbitrary_expression_evaluation_allowed": False,
        "adds_new_domain": False,
        "writes_memory": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "writes_ledgers": False,
        "mints_ct": False,
    }

__all__ = [
    "GP011B_BUILD_ID", "GP011B_SCHEMA_VERSION", "CAPACITY_QUANTITY_AST_SCHEMA",
    "CAPACITY_UNIT_POLICY_ID", "PINT_BACKEND", "QuantityASTBoundaryError",
    "CapacityQuantityAST", "build_capacity_quantity_ast", "bind_capacity_quantity_metadata",
    "require_capacity_quantity_ast", "quantity_ast_boundary_contract",
]
