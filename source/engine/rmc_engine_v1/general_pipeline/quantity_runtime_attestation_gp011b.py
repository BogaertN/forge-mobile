"""GP-011B — Side-effect-free Pint capacity delivery attestation."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, Tuple

from .contracts import canonical_hash
from .pipeline import learn_and_answer
from .dependency_registry import (
    dependency_registry_hash, active_runtime_dependency_ids, dependency_records_for_ids,
)

GP011B_BUILD_ID = "GENERAL-PIPELINE-PINT-QUANTITY-CAPACITY-INTEGRATION-BUILD-GP-011B"
GP011B_SCHEMA_VERSION = "general_pipeline_pint_quantity_capacity_integration_v1_build_gp011b"

class QuantityRuntimeAttestationError(ValueError):
    pass

@dataclass(frozen=True)
class ActiveQuantityDeliveryAttestationReceipt:
    question_hash: str
    answer_text_hash: str
    domain_id: str
    dependency_registry_hash: str
    active_dependency_record_ids: Tuple[str, ...]
    active_dependency_record_hashes: Tuple[str, ...]
    quantity_backend: str
    quantity_ast_hash: str
    safe_quantity_adapter_receipt_hash: str
    execution_receipt_hash: str
    manifest_contract_v2_hash: str
    delivery_authorization_v2_hash: str
    dimensionality: str
    status: str = "ACTIVE_PINT_QUANTITY_DELIVERY_ATTESTED"
    writes_memory: bool = False
    writes_identity_vault: bool = False
    writes_contribution_economy: bool = False
    mints_ct: bool = False
    writes_ledgers: bool = False
    schema_version: str = GP011B_SCHEMA_VERSION

    def __post_init__(self) -> None:
        if self.domain_id != "fraction_change_capacity" or self.quantity_backend != "pint==0.25.3":
            raise QuantityRuntimeAttestationError("attestation binds only the Pint capacity service")
        if self.dimensionality not in {"[mass]", "[length] ** 3"}:
            raise QuantityRuntimeAttestationError("capacity attestation contains unsupported dimensionality")
        if any((self.writes_memory, self.writes_identity_vault, self.writes_contribution_economy, self.mints_ct, self.writes_ledgers)):
            raise QuantityRuntimeAttestationError("quantity attestation cannot claim side effects")
        required_hashes = (
            self.question_hash, self.answer_text_hash, self.dependency_registry_hash,
            self.quantity_ast_hash, self.safe_quantity_adapter_receipt_hash,
            self.execution_receipt_hash, self.manifest_contract_v2_hash,
            self.delivery_authorization_v2_hash,
        )
        if any(not isinstance(value, str) or len(value) != 64 for value in required_hashes):
            raise QuantityRuntimeAttestationError("attestation requires complete SHA-256 bindings")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": self.schema_version, "status": self.status,
            "question_hash": self.question_hash, "answer_text_hash": self.answer_text_hash,
            "domain_id": self.domain_id, "dependency_registry_hash": self.dependency_registry_hash,
            "active_dependency_record_ids": list(self.active_dependency_record_ids),
            "active_dependency_record_hashes": list(self.active_dependency_record_hashes),
            "quantity_backend": self.quantity_backend, "quantity_ast_hash": self.quantity_ast_hash,
            "safe_quantity_adapter_receipt_hash": self.safe_quantity_adapter_receipt_hash,
            "execution_receipt_hash": self.execution_receipt_hash,
            "manifest_contract_v2_hash": self.manifest_contract_v2_hash,
            "delivery_authorization_v2_hash": self.delivery_authorization_v2_hash,
            "dimensionality": self.dimensionality, "writes_memory": self.writes_memory,
            "writes_identity_vault": self.writes_identity_vault,
            "writes_contribution_economy": self.writes_contribution_economy,
            "mints_ct": self.mints_ct, "writes_ledgers": self.writes_ledgers,
        }

    def receipt_hash(self) -> str:
        return canonical_hash(self.to_dict())

def attest_delivered_capacity(source_text: str, source_ref: str, question: str) -> Dict[str, Any]:
    from . import gp011b_pint_quantity_integration as gp011b
    gp011b.activate()
    result = learn_and_answer(source_text, source_ref, question)
    if result.status != "ANSWERED" or result.domain != "fraction_change_capacity":
        raise QuantityRuntimeAttestationError("question did not produce a delivered Pint capacity answer")
    trace = result.trace
    dependency_ids = active_runtime_dependency_ids("fraction_change_capacity")
    record_hashes = tuple(record.record_hash() for record in dependency_records_for_ids(dependency_ids))
    observed_ids = tuple(item["dependency_id"] for item in trace["active_dependency_records"])
    if observed_ids != dependency_ids or tuple(trace["active_dependency_record_hashes"]) != record_hashes:
        raise QuantityRuntimeAttestationError("live dependency record chain does not match capacity authority")
    adapter = trace["safe_quantity_adapter_receipt"]
    manifest = trace["manifest_contract_v2"]
    if adapter["quantity_backend"] != "pint==0.25.3":
        raise QuantityRuntimeAttestationError("delivered capacity answer did not execute through Pint")
    if manifest["quantity_ast_hash"] != trace["quantity_ast_hash"]:
        raise QuantityRuntimeAttestationError("Manifest Contract v2 did not preserve quantity AST")
    receipt = ActiveQuantityDeliveryAttestationReceipt(
        question_hash=canonical_hash({"question": question}),
        answer_text_hash=canonical_hash({"answer_text": result.answer_text}),
        domain_id=result.domain,
        dependency_registry_hash=dependency_registry_hash(),
        active_dependency_record_ids=dependency_ids,
        active_dependency_record_hashes=record_hashes,
        quantity_backend=adapter["quantity_backend"],
        quantity_ast_hash=trace["quantity_ast_hash"],
        safe_quantity_adapter_receipt_hash=trace["safe_quantity_adapter_receipt_hash"],
        execution_receipt_hash=trace["capability_execution_receipt_hash"],
        manifest_contract_v2_hash=trace["manifest_contract_v2_hash"],
        delivery_authorization_v2_hash=trace["delivery_authorization_v2_hash"],
        dimensionality=adapter["dimensionality"],
    )
    return {"pipeline_result": result.to_dict(), "receipt": receipt.to_dict(), "receipt_hash": receipt.receipt_hash()}

def quantity_runtime_truth_boundary() -> Dict[str, Any]:
    return {
        "build_id": GP011B_BUILD_ID, "schema_version": GP011B_SCHEMA_VERSION,
        "attestation_entrypoint": "attest_delivered_capacity",
        "attested_domain": "fraction_change_capacity",
        "active_quantity_backend": "pint==0.25.3",
        "attestation_requires_dependency_record_hashes": True,
        "attestation_requires_quantity_ast_hash": True,
        "attestation_requires_manifest_contract_v2_hash": True,
        "attestation_requires_echo_delivery_authorization_hash": True,
        "writes_memory": False, "writes_identity_vault": False,
        "writes_contribution_economy": False, "mints_ct": False, "writes_ledgers": False,
    }

__all__ = [
    "QuantityRuntimeAttestationError", "ActiveQuantityDeliveryAttestationReceipt",
    "attest_delivered_capacity", "quantity_runtime_truth_boundary",
]
