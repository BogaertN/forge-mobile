"""General Pipeline — Forge-owned capability service contracts (Build GP-005).

GP-004 established the centralized installed-capability registry. GP-005 adds
the invocation boundary between a parsed question and an executable domain.

A capability service is deliberately not an agent. It cannot choose a goal,
authorize itself from source text, write memory, write Identity Vault state,
mint CT, render final language, or approve its own output. It accepts one
canonical in-memory invocation request bound to an installed capability
contract, performs that bounded computation, and returns a hash-bound execution
receipt. The existing governed gate, RMC meaning compiler, and Echo validator
retain the authority to decide whether any result may become spoken output.

This module remains in-memory only. GP-010B-R1 activates audited Lark/SymPy dependencies only for the existing linear-equation service through its existing strict typed-AST safe-adapter boundary.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from .contracts import ParsedQuestion, ExactSolution, canonical_hash
from .capability_registry import (
    CapabilityContract,
    all_capability_contracts,
    capability_for_domain,
)
from .dependency_registry import (
    active_runtime_dependency_ids,
    dependency_registry_hash as current_dependency_registry_hash,
    validate_service_dependency_binding,
)
from .safe_solver_adapters import (
    safe_solver_adapter_for_domain,
    typed_ast_binding_for_parsed,
    execute_with_safe_solver_adapter,
)
from .quantity_adapters import (
    safe_quantity_adapter_for_domain,
    quantity_ast_binding_for_parsed,
    execute_with_safe_quantity_adapter,
)


GP005_BUILD_ID = "GENERAL-PIPELINE-CAPABILITY-SERVICE-CONTRACTS-BUILD-GP-005"
GP005_SCHEMA_VERSION = "general_pipeline_capability_services_v1_build_gp005"


class CapabilityServiceBoundaryError(ValueError):
    """Raised when an invocation violates a Forge-owned service contract."""


@dataclass(frozen=True)
class CapabilityServiceContract:
    """Immutable execution boundary derived from an installed capability.

    The service contract is narrower than the capability contract. A capability
    declares what problem family code exists; a service contract declares the
    only authority path by which the runtime pipeline may execute that code.
    """

    service_id: str
    capability_id: str
    capability_contract_hash: str
    domain_id: str
    parser_policy: str
    executor_policy: str
    verification_policy: str
    dependency_record_ids: Tuple[str, ...]
    dependency_registry_hash: str
    dependency_policy: str = "registered_active_runtime_dependencies_only"
    request_schema: str = "capability_invocation_request_v1"
    receipt_schema: str = "capability_execution_receipt_v1"
    authority_owner: str = "forge"
    invocation_policy: str = "forge_pipeline_bound_request_only"
    side_effect_policy: str = "none"
    memory_write_allowed: bool = False
    identity_write_allowed: bool = False
    contribution_economy_write_allowed: bool = False
    ct_mint_allowed: bool = False
    render_output_allowed: bool = False
    echo_approval_allowed: bool = False

    def __post_init__(self) -> None:
        if not self.service_id or not self.capability_id or not self.domain_id:
            raise ValueError("service_id, capability_id, and domain_id are required")
        if self.authority_owner != "forge":
            raise ValueError("GP-005 service authority must remain owned by Forge")
        if self.invocation_policy != "forge_pipeline_bound_request_only":
            raise ValueError("GP-005 services must use a Forge-bound invocation request")
        if self.parser_policy != "full_input_required":
            raise ValueError("GP-005 services require full-input parse policy")
        if self.side_effect_policy != "none":
            raise ValueError("GP-005 services are computation-only with no side effects")
        if self.dependency_policy != "registered_active_runtime_dependencies_only":
            raise ValueError("GP-006 services require the dependency governance boundary")
        if self.dependency_registry_hash != current_dependency_registry_hash():
            raise ValueError("service contract does not bind the active dependency registry hash")
        validate_service_dependency_binding(self.dependency_record_ids, self.domain_id)
        if any(
            (
                self.memory_write_allowed,
                self.identity_write_allowed,
                self.contribution_economy_write_allowed,
                self.ct_mint_allowed,
                self.render_output_allowed,
                self.echo_approval_allowed,
            )
        ):
            raise ValueError(
                "GP-005 service contracts cannot write state, mint CT, render, "
                "or approve output"
            )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "service_id": self.service_id,
            "capability_id": self.capability_id,
            "capability_contract_hash": self.capability_contract_hash,
            "domain_id": self.domain_id,
            "parser_policy": self.parser_policy,
            "executor_policy": self.executor_policy,
            "verification_policy": self.verification_policy,
            "dependency_record_ids": list(self.dependency_record_ids),
            "dependency_registry_hash": self.dependency_registry_hash,
            "dependency_policy": self.dependency_policy,
            "request_schema": self.request_schema,
            "receipt_schema": self.receipt_schema,
            "authority_owner": self.authority_owner,
            "invocation_policy": self.invocation_policy,
            "side_effect_policy": self.side_effect_policy,
            "memory_write_allowed": self.memory_write_allowed,
            "identity_write_allowed": self.identity_write_allowed,
            "contribution_economy_write_allowed": self.contribution_economy_write_allowed,
            "ct_mint_allowed": self.ct_mint_allowed,
            "render_output_allowed": self.render_output_allowed,
            "echo_approval_allowed": self.echo_approval_allowed,
        }

    def service_contract_hash(self) -> str:
        return canonical_hash(self.to_dict())


@dataclass(frozen=True)
class CapabilityInvocationRequest:
    """Canonical in-memory request for a single bounded capability execution."""

    service_id: str
    service_contract_hash: str
    capability_id: str
    capability_contract_hash: str
    domain_id: str
    dependency_record_ids: Tuple[str, ...]
    dependency_registry_hash: str
    operation: str
    parsed_question_payload: Dict[str, Any]
    parsed_question_hash: str
    parser_attestation: str = "full_input_consumed_by_registered_parser"
    side_effect_request: str = "none"
    typed_ast_schema: Optional[str] = None
    typed_ast_hash: Optional[str] = None
    typed_ast_payload: Optional[Dict[str, Any]] = None
    safe_solver_adapter_id: Optional[str] = None
    safe_solver_adapter_contract_hash: Optional[str] = None
    quantity_ast_schema: Optional[str] = None
    quantity_ast_hash: Optional[str] = None
    quantity_ast_payload: Optional[Dict[str, Any]] = None
    safe_quantity_adapter_id: Optional[str] = None
    safe_quantity_adapter_contract_hash: Optional[str] = None

    def __post_init__(self) -> None:
        if self.operation != "execute_exact_solution":
            raise ValueError("only execute_exact_solution is permitted in GP-005")
        if self.dependency_registry_hash != current_dependency_registry_hash():
            raise ValueError("invocation request does not bind current dependency registry")
        validate_service_dependency_binding(self.dependency_record_ids, self.domain_id)
        if self.parser_attestation != "full_input_consumed_by_registered_parser":
            raise ValueError("request is missing the full-input parser attestation")
        if self.side_effect_request != "none":
            raise ValueError("GP-005 capability requests may not request side effects")
        typed_fields = (
            self.typed_ast_schema,
            self.typed_ast_hash,
            self.typed_ast_payload,
            self.safe_solver_adapter_id,
            self.safe_solver_adapter_contract_hash,
        )
        if any(item is not None for item in typed_fields):
            if not all(item is not None for item in typed_fields):
                raise ValueError("typed-AST invocation binding must be complete")
            if canonical_hash(self.typed_ast_payload) != self.typed_ast_hash:
                raise ValueError("typed-AST payload hash does not match invocation binding")
        quantity_fields = (
            self.quantity_ast_schema,
            self.quantity_ast_hash,
            self.quantity_ast_payload,
            self.safe_quantity_adapter_id,
            self.safe_quantity_adapter_contract_hash,
        )
        if any(item is not None for item in quantity_fields):
            if not all(item is not None for item in quantity_fields):
                raise ValueError("quantity-AST invocation binding must be complete")
            if canonical_hash(self.quantity_ast_payload) != self.quantity_ast_hash:
                raise ValueError("quantity-AST payload hash does not match invocation binding")
        if any(item is not None for item in typed_fields) and any(item is not None for item in quantity_fields):
            raise ValueError("one invocation may bind exactly one safe adapter family")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "service_id": self.service_id,
            "service_contract_hash": self.service_contract_hash,
            "capability_id": self.capability_id,
            "capability_contract_hash": self.capability_contract_hash,
            "domain_id": self.domain_id,
            "dependency_record_ids": list(self.dependency_record_ids),
            "dependency_registry_hash": self.dependency_registry_hash,
            "operation": self.operation,
            "parsed_question_payload": dict(self.parsed_question_payload),
            "parsed_question_hash": self.parsed_question_hash,
            "parser_attestation": self.parser_attestation,
            "side_effect_request": self.side_effect_request,
            "typed_ast_schema": self.typed_ast_schema,
            "typed_ast_hash": self.typed_ast_hash,
            "typed_ast_payload": dict(self.typed_ast_payload) if self.typed_ast_payload else None,
            "safe_solver_adapter_id": self.safe_solver_adapter_id,
            "safe_solver_adapter_contract_hash": self.safe_solver_adapter_contract_hash,
            "quantity_ast_schema": self.quantity_ast_schema,
            "quantity_ast_hash": self.quantity_ast_hash,
            "quantity_ast_payload": dict(self.quantity_ast_payload) if self.quantity_ast_payload else None,
            "safe_quantity_adapter_id": self.safe_quantity_adapter_id,
            "safe_quantity_adapter_contract_hash": self.safe_quantity_adapter_contract_hash,
        }

    def request_hash(self) -> str:
        return canonical_hash(self.to_dict())


@dataclass(frozen=True)
class CapabilityExecutionReceipt:
    """Hash-bound evidence of one bounded in-memory tool execution.

    This receipt is not a gate approval and not an Echo approval. It only proves
    what bounded service received, what result it produced, and what validation
    observations were handed forward to the governed gate.
    """

    service_id: str
    service_contract_hash: str
    capability_id: str
    capability_contract_hash: str
    domain_id: str
    dependency_record_ids: Tuple[str, ...]
    dependency_registry_hash: str
    request_hash: str
    parsed_question_hash: str
    solution_hash: str
    execution_status: str
    solution_verified_observed: bool
    information_gain_observed: int
    typed_ast_schema: Optional[str] = None
    typed_ast_hash: Optional[str] = None
    safe_solver_adapter_id: Optional[str] = None
    safe_solver_adapter_contract_hash: Optional[str] = None
    safe_solver_adapter_receipt: Optional[Dict[str, Any]] = None
    quantity_ast_schema: Optional[str] = None
    quantity_ast_hash: Optional[str] = None
    safe_quantity_adapter_id: Optional[str] = None
    safe_quantity_adapter_contract_hash: Optional[str] = None
    safe_quantity_adapter_receipt: Optional[Dict[str, Any]] = None
    side_effects_observed: str = "none"
    gate_authority_retained: bool = True
    renderer_authority_retained: bool = True
    echo_authority_retained: bool = True
    authority_path: Tuple[str, ...] = (
        "forge_pipeline",
        "capability_service",
        "governed_gate",
        "rmc_meaning_compiler",
        "renderer",
        "echo_validator",
    )

    def __post_init__(self) -> None:
        if self.execution_status not in (
            "VERIFIED_EXECUTION_COMPLETE",
            "EXECUTED_UNVERIFIED",
        ):
            raise ValueError("unsupported capability execution status")
        if self.side_effects_observed != "none":
            raise ValueError("GP-005 receipt cannot acknowledge side effects")
        adapter_fields = (
            self.typed_ast_schema,
            self.typed_ast_hash,
            self.safe_solver_adapter_id,
            self.safe_solver_adapter_contract_hash,
            self.safe_solver_adapter_receipt,
        )
        if any(item is not None for item in adapter_fields) and not all(item is not None for item in adapter_fields):
            raise ValueError("safe-adapter execution receipt binding must be complete")
        if self.safe_solver_adapter_receipt is not None:
            if self.safe_solver_adapter_receipt.get("typed_ast_hash") != self.typed_ast_hash:
                raise ValueError("safe-adapter receipt typed-AST hash does not match")
            if canonical_hash(self.safe_solver_adapter_receipt.get("typed_ast_payload")) != self.typed_ast_hash:
                raise ValueError("safe-adapter receipt AST payload hash does not match")
            if self.safe_solver_adapter_receipt.get("adapter_contract_hash") != self.safe_solver_adapter_contract_hash:
                raise ValueError("safe-adapter receipt contract hash does not match")
        quantity_adapter_fields = (
            self.quantity_ast_schema,
            self.quantity_ast_hash,
            self.safe_quantity_adapter_id,
            self.safe_quantity_adapter_contract_hash,
            self.safe_quantity_adapter_receipt,
        )
        if any(item is not None for item in quantity_adapter_fields) and not all(item is not None for item in quantity_adapter_fields):
            raise ValueError("safe-quantity-adapter execution receipt binding must be complete")
        if self.safe_quantity_adapter_receipt is not None:
            if self.safe_quantity_adapter_receipt.get("quantity_ast_hash") != self.quantity_ast_hash:
                raise ValueError("safe-quantity receipt AST hash does not match")
            if canonical_hash(self.safe_quantity_adapter_receipt.get("quantity_ast_payload")) != self.quantity_ast_hash:
                raise ValueError("safe-quantity receipt payload hash does not match")
            if self.safe_quantity_adapter_receipt.get("adapter_contract_hash") != self.safe_quantity_adapter_contract_hash:
                raise ValueError("safe-quantity receipt contract hash does not match")
        if self.safe_solver_adapter_receipt is not None and self.safe_quantity_adapter_receipt is not None:
            raise ValueError("execution receipt may contain only one safe adapter family")
        if self.dependency_registry_hash != current_dependency_registry_hash():
            raise ValueError("execution receipt does not bind current dependency registry")
        validate_service_dependency_binding(self.dependency_record_ids, self.domain_id)
        if not all(
            (
                self.gate_authority_retained,
                self.renderer_authority_retained,
                self.echo_authority_retained,
            )
        ):
            raise ValueError("capability service cannot absorb downstream authority")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "service_id": self.service_id,
            "service_contract_hash": self.service_contract_hash,
            "capability_id": self.capability_id,
            "capability_contract_hash": self.capability_contract_hash,
            "domain_id": self.domain_id,
            "dependency_record_ids": list(self.dependency_record_ids),
            "dependency_registry_hash": self.dependency_registry_hash,
            "request_hash": self.request_hash,
            "parsed_question_hash": self.parsed_question_hash,
            "solution_hash": self.solution_hash,
            "execution_status": self.execution_status,
            "solution_verified_observed": self.solution_verified_observed,
            "information_gain_observed": self.information_gain_observed,
            "typed_ast_schema": self.typed_ast_schema,
            "typed_ast_hash": self.typed_ast_hash,
            "safe_solver_adapter_id": self.safe_solver_adapter_id,
            "safe_solver_adapter_contract_hash": self.safe_solver_adapter_contract_hash,
            "safe_solver_adapter_receipt": dict(self.safe_solver_adapter_receipt) if self.safe_solver_adapter_receipt else None,
            "quantity_ast_schema": self.quantity_ast_schema,
            "quantity_ast_hash": self.quantity_ast_hash,
            "safe_quantity_adapter_id": self.safe_quantity_adapter_id,
            "safe_quantity_adapter_contract_hash": self.safe_quantity_adapter_contract_hash,
            "safe_quantity_adapter_receipt": dict(self.safe_quantity_adapter_receipt) if self.safe_quantity_adapter_receipt else None,
            "side_effects_observed": self.side_effects_observed,
            "gate_authority_retained": self.gate_authority_retained,
            "renderer_authority_retained": self.renderer_authority_retained,
            "echo_authority_retained": self.echo_authority_retained,
            "authority_path": list(self.authority_path),
        }

    def receipt_hash(self) -> str:
        return canonical_hash(self.to_dict())


def service_contract_from_capability(
    capability: CapabilityContract,
) -> CapabilityServiceContract:
    """Derive a service boundary from an already-installed capability only."""
    return CapabilityServiceContract(
        service_id=f"svc.forge.{capability.domain_id}.executor.v1",
        capability_id=capability.capability_id,
        capability_contract_hash=capability.contract_hash(),
        domain_id=capability.domain_id,
        parser_policy=capability.parser_policy,
        executor_policy=capability.executor_policy,
        verification_policy=capability.verification_policy,
        dependency_record_ids=active_runtime_dependency_ids(capability.domain_id),
        dependency_registry_hash=current_dependency_registry_hash(),
    )


def all_service_contracts() -> List[CapabilityServiceContract]:
    """Return service boundaries derived from installed capability authority."""
    return [
        service_contract_from_capability(capability)
        for capability in all_capability_contracts()
    ]


def service_contract_for_domain(domain_id: str) -> Optional[CapabilityServiceContract]:
    capability = capability_for_domain(domain_id)
    if capability is None:
        return None
    return service_contract_from_capability(capability)


def service_registry_snapshot() -> Dict[str, Any]:
    services = [service.to_dict() for service in all_service_contracts()]
    return {
        "build_id": GP005_BUILD_ID,
        "schema_version": GP005_SCHEMA_VERSION,
        "service_contracts": services,
        "service_contract_count": len(services),
    }


def service_registry_hash() -> str:
    return canonical_hash(service_registry_snapshot())


def build_execution_request(parsed: ParsedQuestion) -> CapabilityInvocationRequest:
    """Create the one canonical request for executing a parsed question."""
    capability = capability_for_domain(parsed.domain)
    if capability is None:
        raise CapabilityServiceBoundaryError(
            f"no installed capability contract for parsed domain {parsed.domain!r}"
        )
    service = service_contract_from_capability(capability)
    payload = parsed.to_dict()
    typed_binding = typed_ast_binding_for_parsed(parsed)
    quantity_binding = quantity_ast_binding_for_parsed(parsed)
    typed_kwargs = typed_binding if typed_binding is not None else {}
    quantity_kwargs = quantity_binding if quantity_binding is not None else {}
    if typed_kwargs and quantity_kwargs:
        raise CapabilityServiceBoundaryError("a parsed question cannot bind two adapter families")
    return CapabilityInvocationRequest(
        service_id=service.service_id,
        service_contract_hash=service.service_contract_hash(),
        capability_id=capability.capability_id,
        capability_contract_hash=capability.contract_hash(),
        domain_id=parsed.domain,
        dependency_record_ids=service.dependency_record_ids,
        dependency_registry_hash=service.dependency_registry_hash,
        operation="execute_exact_solution",
        parsed_question_payload=payload,
        parsed_question_hash=canonical_hash(payload),
        **typed_kwargs,
        **quantity_kwargs,
    )


def execute_request(
    request: CapabilityInvocationRequest,
    parsed: ParsedQuestion,
) -> Tuple[ExactSolution, CapabilityExecutionReceipt]:
    """Execute only a canonical Forge-generated request for the parsed input."""
    expected = build_execution_request(parsed)
    if request.to_dict() != expected.to_dict():
        raise CapabilityServiceBoundaryError(
            "invocation request does not match the canonical Forge-bound request"
        )

    capability = capability_for_domain(parsed.domain)
    if capability is None:  # guarded above; retained as defensive boundary
        raise CapabilityServiceBoundaryError("installed capability disappeared during invocation")

    domain = capability.instantiate_domain()
    replayed_parse = domain.parse(parsed.raw_question)
    if replayed_parse is None or replayed_parse.to_dict() != parsed.to_dict():
        raise CapabilityServiceBoundaryError(
            "registered parser could not deterministically replay the accepted full input"
        )

    # GP-007: where a strict typed-AST safe adapter exists, the production
    # service path must use it. Domains without a migrated adapter continue
    # through the GP-005 controlled executor path until their own migration.
    adapter_contract = safe_solver_adapter_for_domain(parsed.domain)
    quantity_adapter_contract = safe_quantity_adapter_for_domain(parsed.domain)
    adapter_receipt = None
    quantity_adapter_receipt = None
    if adapter_contract is not None:
        _adapter_contract, _typed_ast, solution, adapter_receipt = execute_with_safe_solver_adapter(parsed)
    elif quantity_adapter_contract is not None:
        _quantity_contract, _quantity_ast, solution, quantity_adapter_receipt = execute_with_safe_quantity_adapter(parsed)
    else:
        # Non-migrated domains remain behind the controlled service boundary.
        solution = domain.execute(parsed)
    if solution.domain != parsed.domain:
        raise CapabilityServiceBoundaryError(
            "capability returned a solution for a different domain"
        )

    status = (
        "VERIFIED_EXECUTION_COMPLETE"
        if solution.verified
        else "EXECUTED_UNVERIFIED"
    )
    receipt = CapabilityExecutionReceipt(
        service_id=expected.service_id,
        service_contract_hash=expected.service_contract_hash,
        capability_id=expected.capability_id,
        capability_contract_hash=expected.capability_contract_hash,
        domain_id=expected.domain_id,
        dependency_record_ids=expected.dependency_record_ids,
        dependency_registry_hash=expected.dependency_registry_hash,
        request_hash=expected.request_hash(),
        parsed_question_hash=expected.parsed_question_hash,
        solution_hash=canonical_hash(solution.to_dict()),
        execution_status=status,
        solution_verified_observed=solution.verified,
        information_gain_observed=solution.information_gain,
        typed_ast_schema=adapter_receipt.typed_ast_schema if adapter_receipt else None,
        typed_ast_hash=adapter_receipt.typed_ast_hash if adapter_receipt else None,
        safe_solver_adapter_id=adapter_receipt.adapter_id if adapter_receipt else None,
        safe_solver_adapter_contract_hash=adapter_receipt.adapter_contract_hash if adapter_receipt else None,
        safe_solver_adapter_receipt=adapter_receipt.to_dict() if adapter_receipt else None,
        quantity_ast_schema=quantity_adapter_receipt.quantity_ast_schema if quantity_adapter_receipt else None,
        quantity_ast_hash=quantity_adapter_receipt.quantity_ast_hash if quantity_adapter_receipt else None,
        safe_quantity_adapter_id=quantity_adapter_receipt.adapter_id if quantity_adapter_receipt else None,
        safe_quantity_adapter_contract_hash=quantity_adapter_receipt.adapter_contract_hash if quantity_adapter_receipt else None,
        safe_quantity_adapter_receipt=quantity_adapter_receipt.to_dict() if quantity_adapter_receipt else None,
    )
    return solution, receipt


def execute_registered_capability(
    parsed: ParsedQuestion,
) -> Tuple[
    CapabilityServiceContract,
    CapabilityInvocationRequest,
    ExactSolution,
    CapabilityExecutionReceipt,
]:
    """Run the Forge-owned service path used by the public answering pipeline."""
    service = service_contract_for_domain(parsed.domain)
    if service is None:
        raise CapabilityServiceBoundaryError(
            f"no service boundary for parsed domain {parsed.domain!r}"
        )
    request = build_execution_request(parsed)
    solution, receipt = execute_request(request, parsed)
    return service, request, solution, receipt


def service_boundary_contract() -> Dict[str, Any]:
    """Inspectable GP-005 service restrictions; policy only, no state change."""
    return {
        "build_id": GP005_BUILD_ID,
        "schema_version": GP005_SCHEMA_VERSION,
        "service_model": "forge_owned_bounded_executor_not_agent",
        "execution_entrypoint": "execute_registered_capability",
        "direct_domain_execution_in_pipeline_allowed": False,
        "in_memory_only": True,
        "writes_memory": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "mints_ct": False,
        "renders_final_output": False,
        "approves_echo": False,
        "adds_corpus_ingestion": False,
        "adds_new_domain": False,
        # GP-005 historically added no dependency.  GP-010B-R1 later and lawfully
        # activated audited tools through this same service socket.  This live
        # boundary must report the current truth, not the historical pre-activation state.
        "third_party_dependencies_added_during_original_gp005": [],
        "third_party_dependencies_added": ["lark==1.3.1", "sympy==1.14.0", "mpmath==1.3.0", "Pint==0.25.3", "flexcache==0.3", "flexparser==0.4", "platformdirs==4.10.0"],
        "protected_preexisting_dependency_reused": ["typing_extensions==4.15.0"],
        "runtime_tool_activation_transition": "SUPERSEDED_BY_GP010B_R1",
        "dependency_registry_enforced": True,
        "active_dependency_binding_policy": "registered_active_runtime_dependencies_only",
        "third_party_dependency_records_are_non_executable_review_only": False,
        "typed_ast_safe_adapter_boundary_added_for_existing_equation_domain": True,
        "raw_expression_eval_allowed": False,
        "third_party_parser_imported": True,
        "third_party_solver_imported": True,
        "active_runtime_parser_backends": ["lark==1.3.1"],
        "active_runtime_solver_backends": ["sympy==1.14.0"],
        "active_runtime_quantity_backends": ["pint==0.25.3"],
        "capacity_dimensional_verification_active": True,
        "active_runtime_transitive_dependencies": ["mpmath==1.3.0"],
    }


__all__ = [
    "GP005_BUILD_ID",
    "GP005_SCHEMA_VERSION",
    "CapabilityServiceBoundaryError",
    "CapabilityServiceContract",
    "CapabilityInvocationRequest",
    "CapabilityExecutionReceipt",
    "service_contract_from_capability",
    "all_service_contracts",
    "service_contract_for_domain",
    "service_registry_snapshot",
    "service_registry_hash",
    "build_execution_request",
    "execute_request",
    "execute_registered_capability",
    "service_boundary_contract",
]
