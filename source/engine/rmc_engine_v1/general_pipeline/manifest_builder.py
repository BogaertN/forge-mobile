"""General Learning-to-Answer Pipeline — MEA manifest builder (Build GP-001).

Builds a genuine MEA ProblemManifest (the engine's own dataclass) from a
parsed question plus the governed source procedure that authorises the domain.

This is the bridge from "question understood" to "problem state the engine can
reason about and seal." It uses the real ProblemManifest contract so the result
is a first-class engine citizen, not a parallel structure.
"""

from __future__ import annotations

from typing import Optional

from rmc_engine_v1.mea.manifest_schema import (
    ProblemManifest,
    MemoryRef,
    ClaimStatus,
    OutputPermission,
    canonical_hash as manifest_canonical_hash,
)

from .contracts import ParsedQuestion, SemanticSource, fraction_to_text
from .capability_registry import capability_for_domain
from .capability_services import service_contract_for_domain
from .dependency_registry import dependency_records_for_ids
from .safe_solver_adapters import safe_solver_adapter_for_domain
from .quantity_adapters import safe_quantity_adapter_for_domain


def build_problem_manifest(
    parsed: ParsedQuestion,
    source: SemanticSource,
) -> ProblemManifest:
    """Construct an unsolved MEA ProblemManifest for a parsed question.

    The manifest starts at full proof_debt and UNCLASSIFIED claim status: it is
    an open problem, not a result. The governed source procedure for the domain
    is recorded as memory_ancestry. The installed bounded capability contract is
    explicitly named in allowed_tools; source ancestry cannot create that tool.
    """
    contract = capability_for_domain(parsed.domain)
    if contract is None:
        raise ValueError(
            f"no installed capability contract for domain {parsed.domain!r}; "
            "source cannot create executable authority"
        )
    service = service_contract_for_domain(parsed.domain)
    if service is None:
        raise ValueError(
            f"no Forge-owned capability service contract for domain {parsed.domain!r}; "
            "the answering pipeline cannot execute outside a service boundary"
        )
    procedure = source.procedure_for_domain(parsed.domain)
    if procedure is None:
        raise ValueError(
            f"no governed procedure for domain {parsed.domain!r}; "
            f"source does not support this installed capability"
        )

    known_facts = []
    for role, value in sorted(parsed.quantities.items()):
        known_facts.append(f"{role} = {fraction_to_text(value)}")
    for key, value in sorted(parsed.metadata.items()):
        known_facts.append(f"{key} = {value}")
    known_facts.append(f"governed_relation = {procedure.relation_text}")
    known_facts.append(f"installed_capability = {contract.capability_id}")
    known_facts.append(f"capability_service = {service.service_id}")
    known_facts.append(f"execution_authority = {service.invocation_policy}")
    known_facts.append(f"dependency_policy = {service.dependency_policy}")
    known_facts.append(f"dependency_registry_hash = {service.dependency_registry_hash}")
    for dependency in dependency_records_for_ids(service.dependency_record_ids):
        known_facts.append(
            f"active_dependency = {dependency.dependency_id} [{dependency.review_status}]"
        )
    known_facts.append(f"parser_policy = {contract.parser_policy}")
    adapter = safe_solver_adapter_for_domain(parsed.domain)
    if adapter is not None:
        known_facts.append(f"typed_ast_schema = {parsed.metadata.get('typed_ast_schema', 'MISSING')}")
        known_facts.append(f"typed_ast_hash = {parsed.metadata.get('typed_ast_hash', 'MISSING')}")
        known_facts.append(f"safe_solver_adapter = {adapter.adapter_id}")
        known_facts.append(f"safe_solver_adapter_policy = {adapter.execution_policy}")
    quantity_adapter = safe_quantity_adapter_for_domain(parsed.domain)
    if quantity_adapter is not None:
        known_facts.append(f"quantity_ast_schema = {parsed.metadata.get('quantity_ast_schema', 'MISSING')}")
        known_facts.append(f"quantity_ast_hash = {parsed.metadata.get('quantity_ast_hash', 'MISSING')}")
        known_facts.append(f"quantity_dimensionality = {parsed.metadata.get('quantity_dimensionality', 'MISSING')}")
        known_facts.append(f"safe_quantity_adapter = {quantity_adapter.adapter_id}")
        known_facts.append(f"safe_quantity_adapter_policy = {quantity_adapter.execution_policy}")

    problem_id = canonical_problem_id(parsed)

    ancestry = [
        MemoryRef(
            memory_key=procedure.procedure_id,
            source=procedure.source_ref,
            relevance=1.0,
            evidence_tier="governed_source_procedure",
        )
    ]

    manifest = ProblemManifest(
        problem_id=problem_id,
        goal=f"Resolve the unknown for a {parsed.domain} question and verify it by exact arithmetic.",
        known_facts=known_facts,
        unknowns=["target_value"],
        constraints=[
            "use only exact arithmetic permitted by the governed relation",
            "answer must satisfy the original problem statement under substitution",
        ],
        success_conditions=["unknown resolved", "result verified by exact substitution"],
        failure_conditions=["verification fails", "relation not supported by source"],
        proof_debt=1.0,
        memory_ancestry=ancestry,
        goal_ancestry=[f"domain:{parsed.domain}", f"source:{source.source_id}"],
        claim_status=ClaimStatus.UNCLASSIFIED.value,
        output_permissions=OutputPermission.SEALED.value,
        allowed_tools=[contract.capability_id],
    )
    return manifest


def canonical_problem_id(parsed: ParsedQuestion) -> str:
    return "gp_" + manifest_canonical_hash_safe(parsed)[:24]


def manifest_canonical_hash_safe(parsed: ParsedQuestion) -> str:
    # Hash the parsed question payload (stable) for a deterministic problem id.
    from .contracts import canonical_hash as _ch
    return _ch(parsed.to_dict())


__all__ = ["build_problem_manifest", "canonical_problem_id"]
