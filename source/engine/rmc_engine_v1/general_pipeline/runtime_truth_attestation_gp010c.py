"""GP-010C — Runtime truth reconciliation and independent active-tool attestation.

GP-010B-R1 lawfully activated audited Lark and SymPy runtime tools and
Hypothesis verification tooling.  GP-010C makes that transition explicit in
all live boundary surfaces and provides a side-effect-free, hash-bound
attestation helper that proves a delivered equation answer actually traversed
Lark -> AI.Web typed AST -> SymPy -> Manifest Contract v2 -> Echo delivery.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, Tuple
from .contracts import canonical_hash
from .pipeline import learn_and_answer
from .dependency_registry import dependency_registry_hash, active_runtime_dependency_ids, dependency_records_for_ids
from .capability_services import service_boundary_contract
from .manifest_contract_v2 import manifest_contract_v2_boundary
from .outcome_contract_v2 import outcome_contract_v2_boundary

GP010C_BUILD_ID = "GENERAL-PIPELINE-RUNTIME-TRUTH-ATTESTATION-BUILD-GP-010C"
GP010C_SCHEMA_VERSION = "general_pipeline_runtime_truth_attestation_v1_build_gp010c"
_ATTESTABLE_DOMAIN = "linear_equation_one_unknown"
_APPROVED_PARSER = "lark==1.3.1"
_APPROVED_SOLVER = "sympy==1.14.0"

class RuntimeTruthAttestationError(ValueError):
    pass

@dataclass(frozen=True)
class ActiveToolDeliveryAttestationReceipt:
    question_hash: str
    answer_text_hash: str
    domain_id: str
    dependency_registry_hash: str
    active_dependency_record_ids: Tuple[str, ...]
    active_dependency_record_hashes: Tuple[str, ...]
    parser_backend: str
    solver_backend: str
    typed_ast_hash: str
    safe_solver_adapter_receipt_hash: str
    execution_receipt_hash: str
    manifest_contract_v2_hash: str
    delivery_authorization_v2_hash: str
    status: str = "ACTIVE_TOOL_DELIVERY_ATTESTED"
    writes_memory: bool = False
    writes_identity_vault: bool = False
    writes_contribution_economy: bool = False
    mints_ct: bool = False
    writes_ledgers: bool = False
    schema_version: str = GP010C_SCHEMA_VERSION
    def __post_init__(self) -> None:
        if self.domain_id != _ATTESTABLE_DOMAIN:
            raise RuntimeTruthAttestationError("GP-010C attests only the activated equation service")
        if self.parser_backend != _APPROVED_PARSER or self.solver_backend != _APPROVED_SOLVER:
            raise RuntimeTruthAttestationError("attestation observed an unapproved active backend")
        if not self.active_dependency_record_ids or len(self.active_dependency_record_ids) != len(self.active_dependency_record_hashes):
            raise RuntimeTruthAttestationError("attestation requires dependency identity and hash binding")
        if any((self.writes_memory, self.writes_identity_vault, self.writes_contribution_economy, self.mints_ct, self.writes_ledgers)):
            raise RuntimeTruthAttestationError("runtime attestation cannot write state or economic authority")
        for label, value in (
            ("question_hash", self.question_hash), ("answer_text_hash", self.answer_text_hash),
            ("dependency_registry_hash", self.dependency_registry_hash), ("typed_ast_hash", self.typed_ast_hash),
            ("safe_solver_adapter_receipt_hash", self.safe_solver_adapter_receipt_hash),
            ("execution_receipt_hash", self.execution_receipt_hash),
            ("manifest_contract_v2_hash", self.manifest_contract_v2_hash),
            ("delivery_authorization_v2_hash", self.delivery_authorization_v2_hash),
        ):
            if not isinstance(value, str) or len(value) != 64:
                raise RuntimeTruthAttestationError(f"{label} must be a SHA-256 digest")
    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": self.schema_version, "status": self.status,
            "question_hash": self.question_hash, "answer_text_hash": self.answer_text_hash,
            "domain_id": self.domain_id, "dependency_registry_hash": self.dependency_registry_hash,
            "active_dependency_record_ids": list(self.active_dependency_record_ids),
            "active_dependency_record_hashes": list(self.active_dependency_record_hashes),
            "parser_backend": self.parser_backend, "solver_backend": self.solver_backend,
            "typed_ast_hash": self.typed_ast_hash,
            "safe_solver_adapter_receipt_hash": self.safe_solver_adapter_receipt_hash,
            "execution_receipt_hash": self.execution_receipt_hash,
            "manifest_contract_v2_hash": self.manifest_contract_v2_hash,
            "delivery_authorization_v2_hash": self.delivery_authorization_v2_hash,
            "writes_memory": self.writes_memory, "writes_identity_vault": self.writes_identity_vault,
            "writes_contribution_economy": self.writes_contribution_economy,
            "mints_ct": self.mints_ct, "writes_ledgers": self.writes_ledgers,
        }
    def receipt_hash(self) -> str:
        return canonical_hash(self.to_dict())

def attest_delivered_equation(source_text: str, source_ref: str, question: str) -> Dict[str, Any]:
    # Attestation is safe to run as an independent operator proof command.
    # Ensure the idempotent GP-010B registration chain is active before
    # issuing the challenge; this changes no persistent state.
    from . import gp010b_audited_tool_activation as gp10b
    gp10b.activate()
    result = learn_and_answer(source_text, source_ref, question)
    if result.status != "ANSWERED" or result.domain != _ATTESTABLE_DOMAIN:
        raise RuntimeTruthAttestationError("question did not produce an attested delivered equation answer")
    trace = result.trace
    dependency_ids = active_runtime_dependency_ids(_ATTESTABLE_DOMAIN)
    expected_hashes = tuple(record.record_hash() for record in dependency_records_for_ids(dependency_ids))
    observed_ids = tuple(item["dependency_id"] for item in trace["active_dependency_records"])
    observed_hashes = tuple(trace["active_dependency_record_hashes"])
    if observed_ids != dependency_ids or observed_hashes != expected_hashes:
        raise RuntimeTruthAttestationError("trace dependency chain does not match current audited service binding")
    if trace["dependency_registry_hash"] != dependency_registry_hash():
        raise RuntimeTruthAttestationError("trace dependency registry hash is stale")
    receipt = ActiveToolDeliveryAttestationReceipt(
        question_hash=canonical_hash({"question": question}),
        answer_text_hash=canonical_hash({"answer_text": result.answer_text}),
        domain_id=result.domain,
        dependency_registry_hash=trace["dependency_registry_hash"],
        active_dependency_record_ids=dependency_ids,
        active_dependency_record_hashes=expected_hashes,
        parser_backend=trace["typed_ast_boundary"]["parser_backend"],
        solver_backend=trace["safe_solver_adapter_receipt"]["solver_backend"],
        typed_ast_hash=trace["typed_ast_hash"],
        safe_solver_adapter_receipt_hash=trace["safe_solver_adapter_receipt_hash"],
        execution_receipt_hash=trace["capability_execution_receipt_hash"],
        manifest_contract_v2_hash=trace["manifest_contract_v2_hash"],
        delivery_authorization_v2_hash=trace["delivery_authorization_v2_hash"],
    )
    return {"answer_text": result.answer_text, "receipt": receipt.to_dict(), "receipt_hash": receipt.receipt_hash()}

def runtime_truth_boundary() -> Dict[str, Any]:
    service = service_boundary_contract(); manifest = manifest_contract_v2_boundary(); outcome = outcome_contract_v2_boundary()
    if not (service["third_party_parser_imported"] and service["third_party_solver_imported"]):
        raise RuntimeTruthAttestationError("service boundary is not truthful about activated tools")
    if not manifest["third_party_dependency_promoted"] or not outcome["third_party_dependency_promoted"]:
        raise RuntimeTruthAttestationError("downstream boundaries are not truthful about activated tools")
    return {
        "build_id": GP010C_BUILD_ID, "schema_version": GP010C_SCHEMA_VERSION,
        "purpose": "current-runtime truth reconciliation and active-tool delivery attestation",
        "activated_service_backends": [_APPROVED_PARSER, _APPROVED_SOLVER],
        "service_boundary_truthful": True, "manifest_boundary_truthful": True,
        "outcome_boundary_truthful": True, "attestation_is_in_memory_only": True,
        "writes_memory": False, "writes_identity_vault": False,
        "writes_contribution_economy": False, "mints_ct": False, "writes_ledgers": False,
    }

__all__ = ["GP010C_BUILD_ID", "GP010C_SCHEMA_VERSION", "RuntimeTruthAttestationError", "ActiveToolDeliveryAttestationReceipt", "attest_delivered_equation", "runtime_truth_boundary"]
