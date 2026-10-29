"""GP-011B — Pint quantity/capacity adapter behind Forge capability authority."""
from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction
from typing import Any, Dict, Optional, Tuple

import pint

from .contracts import ParsedQuestion, ExactSolution, canonical_hash, fraction_to_text
from .dependency_registry import active_runtime_dependency_ids, dependency_registry_hash
from .quantity_ast import (
    GP011B_BUILD_ID, GP011B_SCHEMA_VERSION, CAPACITY_QUANTITY_AST_SCHEMA,
    CAPACITY_UNIT_POLICY_ID, PINT_BACKEND, CapacityQuantityAST,
    require_capacity_quantity_ast,
)

class SafeQuantityAdapterBoundaryError(ValueError):
    pass

_UREG = pint.UnitRegistry()

@dataclass(frozen=True)
class SafeQuantityAdapterContract:
    adapter_id: str
    domain_id: str
    accepted_ast_schema: str
    unit_policy_id: str
    dependency_record_ids: Tuple[str, ...]
    dependency_registry_hash: str
    execution_policy: str = "pint_quantity_computation_from_validated_ast_only"
    verification_policy: str = "pint_dimensional_replay_and_exact_fraction_check"
    input_policy: str = "never_parse_arbitrary_expression_or_prose"
    side_effect_policy: str = "none"
    authority_owner: str = "forge"
    memory_write_allowed: bool = False
    identity_write_allowed: bool = False
    contribution_economy_write_allowed: bool = False
    ct_mint_allowed: bool = False
    render_output_allowed: bool = False
    echo_approval_allowed: bool = False

    def __post_init__(self) -> None:
        if self.domain_id != "fraction_change_capacity" or self.accepted_ast_schema != CAPACITY_QUANTITY_AST_SCHEMA:
            raise SafeQuantityAdapterBoundaryError("quantity adapter may bind only the approved capacity AST")
        if self.dependency_registry_hash != dependency_registry_hash():
            raise SafeQuantityAdapterBoundaryError("quantity adapter does not bind current dependency registry")
        if self.authority_owner != "forge" or self.side_effect_policy != "none":
            raise SafeQuantityAdapterBoundaryError("quantity adapter retains Forge ownership and no side effects")
        if any((self.memory_write_allowed, self.identity_write_allowed, self.contribution_economy_write_allowed,
                self.ct_mint_allowed, self.render_output_allowed, self.echo_approval_allowed)):
            raise SafeQuantityAdapterBoundaryError("quantity adapter cannot write, mint, render, or approve")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "adapter_id": self.adapter_id, "domain_id": self.domain_id,
            "accepted_ast_schema": self.accepted_ast_schema, "unit_policy_id": self.unit_policy_id,
            "dependency_record_ids": list(self.dependency_record_ids),
            "dependency_registry_hash": self.dependency_registry_hash,
            "execution_policy": self.execution_policy, "verification_policy": self.verification_policy,
            "input_policy": self.input_policy, "side_effect_policy": self.side_effect_policy,
            "authority_owner": self.authority_owner, "memory_write_allowed": self.memory_write_allowed,
            "identity_write_allowed": self.identity_write_allowed,
            "contribution_economy_write_allowed": self.contribution_economy_write_allowed,
            "ct_mint_allowed": self.ct_mint_allowed, "render_output_allowed": self.render_output_allowed,
            "echo_approval_allowed": self.echo_approval_allowed,
        }

    def contract_hash(self) -> str:
        return canonical_hash(self.to_dict())

@dataclass(frozen=True)
class SafeQuantityAdapterReceipt:
    adapter_id: str
    adapter_contract_hash: str
    domain_id: str
    quantity_ast_schema: str
    quantity_ast_hash: str
    quantity_ast_payload: Dict[str, Any]
    solution_hash: str
    solution_verified_observed: bool
    quantity_backend: str = PINT_BACKEND
    verification_method: str = "pint_dimensional_replay_and_exact_fraction_check"
    dimensionality: str = ""
    removed_quantity_repr: str = ""
    capacity_quantity_repr: str = ""
    converted_capacity_repr: str = ""
    side_effects_observed: str = "none"
    gate_authority_retained: bool = True
    renderer_authority_retained: bool = True
    echo_authority_retained: bool = True

    def __post_init__(self) -> None:
        if canonical_hash(self.quantity_ast_payload) != self.quantity_ast_hash:
            raise SafeQuantityAdapterBoundaryError("quantity AST payload hash mismatch")
        if self.quantity_backend != PINT_BACKEND or self.side_effects_observed != "none":
            raise SafeQuantityAdapterBoundaryError("unapproved quantity backend or side effect")
        if self.verification_method != "pint_dimensional_replay_and_exact_fraction_check":
            raise SafeQuantityAdapterBoundaryError("unapproved quantity verification method")
        if not self.solution_verified_observed:
            raise SafeQuantityAdapterBoundaryError("unverified quantity solution cannot form a receipt")
        if not all((self.gate_authority_retained, self.renderer_authority_retained, self.echo_authority_retained)):
            raise SafeQuantityAdapterBoundaryError("quantity adapter absorbed downstream authority")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "adapter_id": self.adapter_id, "adapter_contract_hash": self.adapter_contract_hash,
            "domain_id": self.domain_id, "quantity_ast_schema": self.quantity_ast_schema,
            "quantity_ast_hash": self.quantity_ast_hash, "quantity_ast_payload": dict(self.quantity_ast_payload),
            "solution_hash": self.solution_hash, "solution_verified_observed": self.solution_verified_observed,
            "quantity_backend": self.quantity_backend, "verification_method": self.verification_method,
            "dimensionality": self.dimensionality, "removed_quantity_repr": self.removed_quantity_repr,
            "capacity_quantity_repr": self.capacity_quantity_repr,
            "converted_capacity_repr": self.converted_capacity_repr,
            "side_effects_observed": self.side_effects_observed,
            "gate_authority_retained": self.gate_authority_retained,
            "renderer_authority_retained": self.renderer_authority_retained,
            "echo_authority_retained": self.echo_authority_retained,
        }

    def receipt_hash(self) -> str:
        return canonical_hash(self.to_dict())

_CAPACITY = SafeQuantityAdapterContract(
    adapter_id="adapter.math.fraction_change_capacity.pint_quantity.v1",
    domain_id="fraction_change_capacity",
    accepted_ast_schema=CAPACITY_QUANTITY_AST_SCHEMA,
    unit_policy_id=CAPACITY_UNIT_POLICY_ID,
    dependency_record_ids=active_runtime_dependency_ids("fraction_change_capacity"),
    dependency_registry_hash=dependency_registry_hash(),
)

def safe_quantity_adapter_for_domain(domain_id: str) -> Optional[SafeQuantityAdapterContract]:
    return _CAPACITY if domain_id == _CAPACITY.domain_id else None

def quantity_ast_binding_for_parsed(parsed: ParsedQuestion) -> Optional[Dict[str, Any]]:
    adapter = safe_quantity_adapter_for_domain(parsed.domain)
    if adapter is None:
        return None
    ast = require_capacity_quantity_ast(parsed)
    return {
        "quantity_ast_schema": ast.ast_schema,
        "quantity_ast_hash": ast.ast_hash(),
        "quantity_ast_payload": ast.to_dict(),
        "safe_quantity_adapter_id": adapter.adapter_id,
        "safe_quantity_adapter_contract_hash": adapter.contract_hash(),
    }

def _fraction_from_magnitude(value: Any) -> Fraction:
    if isinstance(value, Fraction):
        return value
    return Fraction(str(value))

def execute_with_safe_quantity_adapter(parsed: ParsedQuestion):
    adapter = safe_quantity_adapter_for_domain(parsed.domain)
    if adapter is None:
        raise SafeQuantityAdapterBoundaryError("no approved quantity adapter")
    ast = require_capacity_quantity_ast(parsed)
    initial, final = ast.initial_fraction, ast.final_fraction
    delta = initial - final
    removed_unit = _UREG.parse_units(ast.removed_unit_text.replace(" per ", " / "))
    output_unit = _UREG.parse_units(ast.requested_output_unit_text.replace(" per ", " / "))
    removed_quantity = _UREG.Quantity(ast.removed_amount, removed_unit)
    capacity_quantity = removed_quantity / delta
    converted = capacity_quantity.to(output_unit)
    capacity = _fraction_from_magnitude(converted.magnitude)
    native_capacity = _fraction_from_magnitude(capacity_quantity.magnitude)
    initial_amount = _UREG.Quantity(initial * capacity, output_unit)
    final_amount = _UREG.Quantity(final * capacity, output_unit)
    diff = initial_amount - final_amount
    expected_removed = removed_quantity.to(output_unit)
    verified = diff == expected_removed and str(converted.dimensionality) == ast.dimensionality
    output_label = ast.requested_output_unit_text
    ct = fraction_to_text(capacity)
    steps = [
        f"The fill changed from {fraction_to_text(initial)} to {fraction_to_text(final)}, a decrease of {fraction_to_text(delta)} of the whole.",
        f"That decrease equals {fraction_to_text(ast.removed_amount)} {ast.removed_unit_text}; Pint classifies this as {ast.dimensionality}.",
        f"Capacity = {fraction_to_text(ast.removed_amount)} {ast.removed_unit_text} ÷ {fraction_to_text(delta)} = {fraction_to_text(native_capacity)} {ast.removed_unit_text}.",
    ]
    if ast.requested_output_unit_text != ast.removed_unit_text:
        steps.append(f"Pint converts {fraction_to_text(native_capacity)} {ast.removed_unit_text} to the requested compatible unit: {ct} {output_label}.")
    verification = (
        f"Check: {fraction_to_text(initial)} of {ct} is {fraction_to_text(initial_amount.magnitude)} {output_label}, "
        f"and {fraction_to_text(final)} of {ct} is {fraction_to_text(final_amount.magnitude)} {output_label}; "
        f"the difference is {fraction_to_text(diff.magnitude)} {output_label}, which equals "
        f"{fraction_to_text(expected_removed.magnitude)} {output_label} after Pint dimensional conversion."
    )
    solution = ExactSolution(
        domain=parsed.domain, answer_value=capacity, answer_unit=output_label,
        steps=steps, verification_text=verification, verified=verified,
        information_gain=1_000_000 if verified else 0,
    )
    receipt = SafeQuantityAdapterReceipt(
        adapter_id=adapter.adapter_id, adapter_contract_hash=adapter.contract_hash(),
        domain_id=parsed.domain, quantity_ast_schema=ast.ast_schema,
        quantity_ast_hash=ast.ast_hash(), quantity_ast_payload=ast.to_dict(),
        solution_hash=canonical_hash(solution.to_dict()), solution_verified_observed=verified,
        dimensionality=ast.dimensionality, removed_quantity_repr=str(removed_quantity),
        capacity_quantity_repr=str(capacity_quantity), converted_capacity_repr=str(converted),
    )
    return adapter, ast, solution, receipt

def safe_quantity_adapter_boundary_contract() -> Dict[str, Any]:
    return {
        "build_id": GP011B_BUILD_ID, "schema_version": GP011B_SCHEMA_VERSION,
        "adapter_model": "forge_governed_pint_quantity_adapter_not_agent",
        "active_adapter_ids": [_CAPACITY.adapter_id],
        "active_domain": _CAPACITY.domain_id,
        "quantity_backend": PINT_BACKEND,
        "adapter_accepts_raw_user_expression": False,
        "adapter_accepts_only_verified_quantity_ast_binding": True,
        "allowed_dimensions": ["[length] ** 3", "[mass]"],
        "candidate_dependencies_promoted": [
            "Pint==0.25.3", "flexcache==0.3", "flexparser==0.4",
            "platformdirs==4.10.0", "typing_extensions==4.15.0 (pre-existing exact match)"
        ],
        "adds_new_domain": False, "writes_memory": False, "writes_identity_vault": False,
        "writes_contribution_economy": False, "writes_ledgers": False, "mints_ct": False,
        "adds_corpus_ingestion": False,
    }

__all__ = [
    "SafeQuantityAdapterBoundaryError", "SafeQuantityAdapterContract", "SafeQuantityAdapterReceipt",
    "safe_quantity_adapter_for_domain", "quantity_ast_binding_for_parsed",
    "execute_with_safe_quantity_adapter", "safe_quantity_adapter_boundary_contract",
]
