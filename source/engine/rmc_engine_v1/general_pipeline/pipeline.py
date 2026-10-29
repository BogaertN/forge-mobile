"""General Learning-to-Answer Pipeline — orchestrator (Build GP-001).

Wires the full motion the architecture was designed for, for the domains the
system has actually learned:

  instructional source text
    -> compile governed semantic source            (source_compiler)
  user question
    -> match a learned domain                       (domains.match_domain)
    -> parse into typed quantities                  (domain.parse)
    -> build a real MEA ProblemManifest             (manifest_builder)
    -> execute exact arithmetic + verify            (domain.execute)
    -> governed gate decides if it may seal         (governed_gate.evaluate_gate)
    -> seal manifest to RESOLVED / RENDER_ALLOWED   (governed_gate.apply_seal)
    -> compile RMC meaning manifest                 (meaning_and_renderer.compile_meaning)
    -> generatively render natural language         (meaning_and_renderer.render)
    -> Echo approves the faithful rendering         (echo_approval.validate_and_approve)
    -> return the approved answer

Honesty boundary (Build GP-001):
  - If no learned domain matches the question, the pipeline REFUSES with a clear
    message. It never guesses an answer to an unrecognised question.
  - If the governed gate fails, no answer is delivered.
  - If Echo rejects the rendering, no answer is delivered.
  - GP-004: all executable domains must come through a centralized immutable
    capability contract; source may support use but cannot install a solver.
  - GP-005: the answering pipeline may execute a capability only through a
    Forge-owned service contract, canonical invocation request, and hash-bound
    execution receipt; no domain executor speaks or writes directly.
  - GP-007: the existing linear-equation path is parsed to a strict typed AST
    and computed only through a Forge-owned safe solver adapter; GP-010B-R1
    activates audited Lark/SymPy organs only inside that governed equation path.
  - GP-008: after MEA seal and RMC meaning compilation, a hash-bound Manifest
    Contract v2 must link source ancestry, execution and verification evidence,
    render permission and negative write/economic boundaries before rendering.
  - GP-009: each modeled non-delivery status carries a hash-bound in-memory
    refusal/containment receipt; a refusal cannot become an untraced side path.
  - In-memory only: no route, no UI, no memory write, no Chroma, no Identity
    Vault, no CT/ledger activity.

Return value is a structured PipelineResult with the answer (when approved) and
the full audited trace of every stage, each hashed for replay/inspection.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from rmc_engine_v1.mea.manifest_schema import (
    ProblemManifest,
    canonical_hash as manifest_hash,
    to_dict as manifest_to_dict,
)

from .contracts import (
    SemanticSource,
    canonical_hash,
    GENERAL_PIPELINE_BUILD_ID,
    GENERAL_PIPELINE_SCHEMA_VERSION,
)
from .domains import match_domain
from .capability_registry import capability_for_domain, registry_hash
from .capability_services import execute_registered_capability, service_registry_hash
from .dependency_registry import (
    dependency_boundary_contract,
    dependency_records_for_ids,
    dependency_registry_hash,
)
from .typed_ast import typed_ast_boundary_contract
from .safe_solver_adapters import safe_solver_adapter_boundary_contract
from .quantity_ast import quantity_ast_boundary_contract
from .quantity_adapters import safe_quantity_adapter_boundary_contract
from .source_compiler import compile_source
from .manifest_builder import build_problem_manifest
from .governed_gate import evaluate_gate, apply_seal
from .meaning_and_renderer import compile_meaning, render_with_manifest_contract_v2
from .echo_approval import validate_and_approve_v2
from .manifest_contract_v2 import (
    build_manifest_contract_v2,
    finalize_echo_delivery,
    manifest_contract_v2_boundary,
)
from .outcome_contract_v2 import (
    ROUTING_NO_DOMAIN,
    CAPABILITY_NOT_INSTALLED,
    SOURCE_AUTHORITY_NOT_PRESENT,
    PARSER_REFUSED,
    build_early_refusal_receipt,
    build_gate_blocked_receipt,
    build_echo_rejected_receipt,
    outcome_contract_v2_boundary,
)


@dataclass
class PipelineResult:
    status: str  # "ANSWERED" | "REFUSED_UNLEARNED" | "GATE_BLOCKED" | "ECHO_REJECTED"
    question: str
    answer_text: Optional[str] = None
    domain: Optional[str] = None
    trace: Dict[str, Any] = field(default_factory=dict)
    reasons: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "build_id": GENERAL_PIPELINE_BUILD_ID,
            "schema_version": GENERAL_PIPELINE_SCHEMA_VERSION,
            "status": self.status,
            "question": self.question,
            "answer_text": self.answer_text,
            "domain": self.domain,
            "trace": self.trace,
            "reasons": list(self.reasons),
        }

    def result_hash(self) -> str:
        # Deterministic content hash: exclude wall-clock timestamps that the
        # engine stamps into manifests (created_at/updated_at), so identical
        # inputs produce an identical hash across runs.
        payload = self.to_dict()
        trace = dict(payload.get("trace", {}))
        for key in ("open_manifest", "sealed_manifest"):
            man = trace.get(key)
            if isinstance(man, dict):
                man = {k: v for k, v in man.items() if k not in ("created_at", "updated_at")}
                trace[key] = man
        payload["trace"] = trace
        return canonical_hash(payload)


def learn(source_text: str, source_ref: str) -> SemanticSource:
    """Public entry point for the learning stage."""
    return compile_source(source_text, source_ref)


def _non_delivery_trace(receipt: object, trace: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Attach GP-009 in-memory containment authority to a refused/blocked outcome."""
    enriched = dict(trace or {})
    enriched.update({
        "outcome_contract_v2_boundary": outcome_contract_v2_boundary(),
        "non_delivery_outcome_v2": receipt.to_dict(),
        "non_delivery_outcome_v2_hash": receipt.receipt_hash(),
    })
    return enriched


def answer_question(question: str, source: SemanticSource) -> PipelineResult:
    """Run the full pipeline for one question against a compiled source."""
    domain = match_domain(question)
    if domain is None:
        reasons = [
            "no learned domain recognises this question; "
            "the system refuses rather than guessing"
        ]
        receipt = build_early_refusal_receipt(
            question=question,
            source=source,
            stage=ROUTING_NO_DOMAIN,
            reasons=tuple(reasons),
        )
        return PipelineResult(
            status="REFUSED_UNLEARNED",
            question=question,
            trace=_non_delivery_trace(receipt),
            reasons=reasons,
        )

    contract = capability_for_domain(domain.domain_id)
    if contract is None:
        reasons = [
            "matched parser has no installed capability contract; "
            "the system refuses executable authority outside the registry"
        ]
        receipt = build_early_refusal_receipt(
            question=question,
            source=source,
            stage=CAPABILITY_NOT_INSTALLED,
            reasons=tuple(reasons),
            domain_id=domain.domain_id,
        )
        return PipelineResult(
            status="REFUSED_UNLEARNED",
            question=question,
            domain=domain.domain_id,
            trace=_non_delivery_trace(receipt),
            reasons=reasons,
        )

    if not source.supports_domain(domain.domain_id):
        reasons = [
            f"question matches installed capability domain {domain.domain_id!r} "
            f"but the compiled source does not support its use; upload "
            "instructional text for this installed domain first"
        ]
        receipt = build_early_refusal_receipt(
            question=question,
            source=source,
            stage=SOURCE_AUTHORITY_NOT_PRESENT,
            reasons=tuple(reasons),
            domain_id=domain.domain_id,
            capability_contract_hash=contract.contract_hash(),
        )
        return PipelineResult(
            status="REFUSED_UNLEARNED",
            question=question,
            domain=domain.domain_id,
            trace=_non_delivery_trace(receipt),
            reasons=reasons,
        )

    parsed = domain.parse(question)
    if parsed is None:
        refusal_reason = getattr(domain, "refusal_reason", None)
        reasons = [refusal_reason(question) if callable(refusal_reason) else "domain matched but parsing failed"]
        receipt = build_early_refusal_receipt(
            question=question,
            source=source,
            stage=PARSER_REFUSED,
            reasons=tuple(reasons),
            domain_id=domain.domain_id,
            capability_contract_hash=contract.contract_hash(),
        )
        return PipelineResult(
            status="REFUSED_UNLEARNED",
            question=question,
            domain=domain.domain_id,
            trace=_non_delivery_trace(receipt),
            reasons=reasons,
        )

    manifest = build_problem_manifest(parsed, source)
    service, invocation, solution, execution_receipt = execute_registered_capability(parsed)
    gate = evaluate_gate(manifest, solution, source)

    trace: Dict[str, Any] = {
        "capability_contract": contract.to_dict(),
        "capability_contract_hash": contract.contract_hash(),
        "capability_registry_hash": registry_hash(),
        "capability_service_contract": service.to_dict(),
        "capability_service_contract_hash": service.service_contract_hash(),
        "capability_service_registry_hash": service_registry_hash(),
        "dependency_registry_hash": dependency_registry_hash(),
        "dependency_boundary": dependency_boundary_contract(),
        "active_dependency_records": [
            record.to_dict()
            for record in dependency_records_for_ids(service.dependency_record_ids)
        ],
        "active_dependency_record_hashes": [
            record.record_hash()
            for record in dependency_records_for_ids(service.dependency_record_ids)
        ],
        "capability_invocation_request": invocation.to_dict(),
        "capability_invocation_request_hash": invocation.request_hash(),
        "capability_execution_receipt": execution_receipt.to_dict(),
        "capability_execution_receipt_hash": execution_receipt.receipt_hash(),
        "typed_ast_boundary": typed_ast_boundary_contract(),
        "safe_solver_adapter_boundary": safe_solver_adapter_boundary_contract(),
        "quantity_ast_boundary": quantity_ast_boundary_contract(),
        "safe_quantity_adapter_boundary": safe_quantity_adapter_boundary_contract(),
        "parse_coverage": contract.parser_policy,
        "parsed_question": parsed.to_dict(),
        "open_manifest_hash": manifest_hash(manifest),
        "open_manifest": manifest_to_dict(manifest),
        "solution": solution.to_dict(),
        "gate": gate.to_dict(),
        "gate_hash": gate.gate_hash(),
    }
    if execution_receipt.safe_solver_adapter_receipt is not None:
        trace.update({
            "typed_ast_schema": execution_receipt.typed_ast_schema,
            "typed_ast_hash": execution_receipt.typed_ast_hash,
            "safe_solver_adapter_id": execution_receipt.safe_solver_adapter_id,
            "safe_solver_adapter_contract_hash": execution_receipt.safe_solver_adapter_contract_hash,
            "safe_solver_adapter_receipt": execution_receipt.safe_solver_adapter_receipt,
            "safe_solver_adapter_receipt_hash": canonical_hash(
                execution_receipt.safe_solver_adapter_receipt
            ),
        })
    if execution_receipt.safe_quantity_adapter_receipt is not None:
        trace.update({
            "quantity_ast_schema": execution_receipt.quantity_ast_schema,
            "quantity_ast_hash": execution_receipt.quantity_ast_hash,
            "safe_quantity_adapter_id": execution_receipt.safe_quantity_adapter_id,
            "safe_quantity_adapter_contract_hash": execution_receipt.safe_quantity_adapter_contract_hash,
            "safe_quantity_adapter_receipt": execution_receipt.safe_quantity_adapter_receipt,
            "safe_quantity_adapter_receipt_hash": canonical_hash(
                execution_receipt.safe_quantity_adapter_receipt
            ),
        })

    if not gate.passed:
        receipt = build_gate_blocked_receipt(
            question=question,
            source=source,
            domain_id=domain.domain_id,
            capability_contract_hash=contract.contract_hash(),
            service_contract_hash=service.service_contract_hash(),
            invocation_request_hash=invocation.request_hash(),
            execution_receipt_hash=execution_receipt.receipt_hash(),
            open_mea_manifest_hash=manifest_hash(manifest),
            reasons=tuple(gate.reasons),
        )
        return PipelineResult(
            status="GATE_BLOCKED",
            question=question,
            domain=domain.domain_id,
            trace=_non_delivery_trace(receipt, trace),
            reasons=gate.reasons,
        )

    sealed = apply_seal(manifest, solution)
    source_ref = source.procedure_for_domain(domain.domain_id).source_ref
    meaning = compile_meaning(sealed, parsed, solution, source_ref)
    manifest_contract_v2 = build_manifest_contract_v2(
        source=source,
        parsed=parsed,
        solution=solution,
        capability=contract,
        service=service,
        invocation=invocation,
        execution_receipt=execution_receipt,
        gate=gate,
        open_mea_manifest_hash=manifest_hash(manifest),
        sealed_mea_manifest=sealed,
        sealed_mea_manifest_hash=manifest_hash(sealed),
        meaning=meaning,
    )
    rendered = render_with_manifest_contract_v2(meaning, manifest_contract_v2)
    echo = validate_and_approve_v2(meaning, rendered, manifest_contract_v2)

    trace.update({
        "sealed_manifest_hash": manifest_hash(sealed),
        "sealed_manifest": manifest_to_dict(sealed),
        "meaning_manifest": meaning.to_dict(),
        "meaning_hash": meaning.meaning_hash(),
        "manifest_contract_v2_boundary": manifest_contract_v2_boundary(),
        "manifest_contract_v2": manifest_contract_v2.to_dict(),
        "manifest_contract_v2_hash": manifest_contract_v2.contract_hash(),
        "rendered_text": rendered,
        "echo": echo.to_dict(),
        "echo_hash": echo.echo_hash(),
    })

    if not echo.approved_output:
        receipt = build_echo_rejected_receipt(
            question=question,
            source=source,
            domain_id=domain.domain_id,
            capability_contract_hash=contract.contract_hash(),
            service_contract_hash=service.service_contract_hash(),
            invocation_request_hash=invocation.request_hash(),
            execution_receipt_hash=execution_receipt.receipt_hash(),
            open_mea_manifest_hash=manifest_hash(manifest),
            manifest_contract_v2_hash=manifest_contract_v2.contract_hash(),
            echo_receipt_hash=echo.echo_hash(),
            reasons=tuple(echo.failure_reasons),
        )
        return PipelineResult(
            status="ECHO_REJECTED",
            question=question,
            domain=domain.domain_id,
            trace=_non_delivery_trace(receipt, trace),
            reasons=echo.failure_reasons,
        )

    delivery_authorization = finalize_echo_delivery(manifest_contract_v2, meaning, echo)
    trace.update({
        "outcome_contract_v2_boundary": outcome_contract_v2_boundary(),
        "delivery_authorization_v2": delivery_authorization.to_dict(),
        "delivery_authorization_v2_hash": delivery_authorization.receipt_hash(),
    })

    return PipelineResult(
        status="ANSWERED",
        question=question,
        answer_text=echo.approved_text,
        domain=domain.domain_id,
        trace=trace,
    )


def learn_and_answer(source_text: str, source_ref: str, question: str) -> PipelineResult:
    """Convenience: compile a source then answer one question against it."""
    source = learn(source_text, source_ref)
    return answer_question(question, source)


__all__ = [
    "PipelineResult",
    "learn",
    "answer_question",
    "learn_and_answer",
    "GENERAL_PIPELINE_BUILD_ID",
    "GENERAL_PIPELINE_SCHEMA_VERSION",
]
