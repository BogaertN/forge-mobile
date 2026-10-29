"""GP-009 — Outcome Closure and Refusal Containment Contracts.

GP-008 authorizes successful delivery only after a sealed MEA state, RMC meaning,
a validated Manifest Contract v2, and Echo approval. This module closes the
complementary production gap: a result that is *not* delivered must also carry a
typed, hash-bound receipt proving where the pipeline stopped and which side
effects remain forbidden.

This is deliberately not persistence or cold-storage implementation. The
receipts are in-memory trace objects only. They create no corpus record, memory
write, Identity Vault write, contribution event, CT, or ledger entry.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple
import re

from .contracts import SemanticSource, canonical_hash

GP009_BUILD_ID = "GENERAL-PIPELINE-OUTCOME-CLOSURE-REFUSAL-CONTAINMENT-BUILD-GP-009"
GP009_SCHEMA_VERSION = "general_pipeline_outcome_closure_refusal_containment_build_gp009"
NON_DELIVERY_RECEIPT_V2_SCHEMA = "rmc_non_delivery_outcome_receipt_v2"

REFUSED_UNLEARNED = "REFUSED_UNLEARNED"
GATE_BLOCKED = "GATE_BLOCKED"
ECHO_REJECTED = "ECHO_REJECTED"

ROUTING_NO_DOMAIN = "ROUTING_NO_SUPPORTED_DOMAIN"
CAPABILITY_NOT_INSTALLED = "CAPABILITY_AUTHORITY_MISSING"
SOURCE_AUTHORITY_NOT_PRESENT = "SOURCE_SUPPORT_NOT_PRESENT"
PARSER_REFUSED = "FULL_INPUT_PARSE_REFUSED"
GOVERNED_GATE_BLOCKED = "GOVERNED_GATE_BLOCKED"
ECHO_REJECTED_DELIVERY = "ECHO_REJECTED_DELIVERY"

IN_MEMORY_NON_DELIVERY_TRACE_ONLY = "IN_MEMORY_NON_DELIVERY_TRACE_ONLY_GP009"
NO_PERSISTENT_MEMORY_WRITE = "NO_PERSISTENT_MEMORY_WRITE_GP009"
NO_IDENTITY_WRITE = "NO_IDENTITY_VAULT_WRITE_GP009"
NO_ECONOMIC_ACTION = "NO_CONTRIBUTION_CT_OR_LEDGER_ACTION_GP009"
NO_HUMAN_TEXT_DELIVERY = "NO_HUMAN_TEXT_DELIVERY_GP009"

_REFUSAL_STAGES = {
    ROUTING_NO_DOMAIN,
    CAPABILITY_NOT_INSTALLED,
    SOURCE_AUTHORITY_NOT_PRESENT,
    PARSER_REFUSED,
}
_REQUIRED_STAGE_STATUS = {
    ROUTING_NO_DOMAIN: REFUSED_UNLEARNED,
    CAPABILITY_NOT_INSTALLED: REFUSED_UNLEARNED,
    SOURCE_AUTHORITY_NOT_PRESENT: REFUSED_UNLEARNED,
    PARSER_REFUSED: REFUSED_UNLEARNED,
    GOVERNED_GATE_BLOCKED: GATE_BLOCKED,
    ECHO_REJECTED_DELIVERY: ECHO_REJECTED,
}


class OutcomeContractV2BoundaryError(ValueError):
    """Raised when a non-delivery trace attempts to overclaim authority."""


def _require_sha256(label: str, value: str) -> None:
    if not isinstance(value, str) or re.fullmatch(r"[0-9a-f]{64}", value) is None:
        raise OutcomeContractV2BoundaryError(f"{label} must be a canonical SHA-256 hex digest")


@dataclass(frozen=True)
class NonDeliveryOutcomeReceiptV2:
    """Hash-bound proof that a requested output was refused or contained.

    The receipt says where the pipeline stopped. It cannot grant rendering,
    persistent storage, identity authority, or economic action.
    """

    status: str
    stage: str
    question_hash: str
    source_id: str
    source_hash: str
    raw_text_hash: str
    reasons: Tuple[str, ...]
    domain_id: Optional[str] = None
    capability_contract_hash: Optional[str] = None
    service_contract_hash: Optional[str] = None
    invocation_request_hash: Optional[str] = None
    execution_receipt_hash: Optional[str] = None
    open_mea_manifest_hash: Optional[str] = None
    manifest_contract_v2_hash: Optional[str] = None
    echo_receipt_hash: Optional[str] = None
    output_delivery_permission: str = NO_HUMAN_TEXT_DELIVERY
    containment_destination: str = IN_MEMORY_NON_DELIVERY_TRACE_ONLY
    memory_permission: str = NO_PERSISTENT_MEMORY_WRITE
    identity_permission: str = NO_IDENTITY_WRITE
    economic_permission: str = NO_ECONOMIC_ACTION
    contribution_event_refs: Tuple[str, ...] = ()
    schema_version: str = NON_DELIVERY_RECEIPT_V2_SCHEMA

    def __post_init__(self) -> None:
        if self.schema_version != NON_DELIVERY_RECEIPT_V2_SCHEMA:
            raise OutcomeContractV2BoundaryError("unknown non-delivery outcome receipt schema")
        if self.stage not in _REQUIRED_STAGE_STATUS:
            raise OutcomeContractV2BoundaryError("unsupported non-delivery pipeline stage")
        if self.status != _REQUIRED_STAGE_STATUS[self.stage]:
            raise OutcomeContractV2BoundaryError("non-delivery stage/status mismatch")
        if not self.source_id or not self.reasons or any(not str(reason).strip() for reason in self.reasons):
            raise OutcomeContractV2BoundaryError("non-delivery receipt requires source identity and reasons")
        for label, digest in (
            ("question_hash", self.question_hash),
            ("source_hash", self.source_hash),
            ("raw_text_hash", self.raw_text_hash),
        ):
            _require_sha256(label, digest)
        for label, digest in (
            ("capability_contract_hash", self.capability_contract_hash),
            ("service_contract_hash", self.service_contract_hash),
            ("invocation_request_hash", self.invocation_request_hash),
            ("execution_receipt_hash", self.execution_receipt_hash),
            ("open_mea_manifest_hash", self.open_mea_manifest_hash),
            ("manifest_contract_v2_hash", self.manifest_contract_v2_hash),
            ("echo_receipt_hash", self.echo_receipt_hash),
        ):
            if digest is not None:
                _require_sha256(label, digest)
        if self.output_delivery_permission != NO_HUMAN_TEXT_DELIVERY:
            raise OutcomeContractV2BoundaryError("non-delivery receipt cannot permit human-text output")
        if self.containment_destination != IN_MEMORY_NON_DELIVERY_TRACE_ONLY:
            raise OutcomeContractV2BoundaryError("GP-009 containment is in-memory trace only")
        if self.memory_permission != NO_PERSISTENT_MEMORY_WRITE:
            raise OutcomeContractV2BoundaryError("GP-009 cannot permit persistent memory writes")
        if self.identity_permission != NO_IDENTITY_WRITE:
            raise OutcomeContractV2BoundaryError("GP-009 cannot permit Identity Vault writes")
        if self.economic_permission != NO_ECONOMIC_ACTION or self.contribution_event_refs:
            raise OutcomeContractV2BoundaryError("GP-009 cannot permit contribution or economic activity")

        # Early refusals stop before execution and must not invent downstream evidence.
        if self.stage in _REFUSAL_STAGES:
            downstream = (
                self.service_contract_hash,
                self.invocation_request_hash,
                self.execution_receipt_hash,
                self.open_mea_manifest_hash,
                self.manifest_contract_v2_hash,
                self.echo_receipt_hash,
            )
            if any(item is not None for item in downstream):
                raise OutcomeContractV2BoundaryError("early refusal cannot claim downstream execution evidence")
            if self.stage in {CAPABILITY_NOT_INSTALLED, ROUTING_NO_DOMAIN} and self.capability_contract_hash is not None:
                raise OutcomeContractV2BoundaryError("no-authority refusal cannot claim a capability contract")
            if self.stage in {SOURCE_AUTHORITY_NOT_PRESENT, PARSER_REFUSED}:
                if not self.domain_id or self.capability_contract_hash is None:
                    raise OutcomeContractV2BoundaryError("source/parse refusal must bind the selected installed capability")

        if self.stage == GOVERNED_GATE_BLOCKED:
            required = (
                self.domain_id,
                self.capability_contract_hash,
                self.service_contract_hash,
                self.invocation_request_hash,
                self.execution_receipt_hash,
                self.open_mea_manifest_hash,
            )
            if any(item is None for item in required):
                raise OutcomeContractV2BoundaryError("gate-blocked receipt requires executed open-MEA trace evidence")
            if self.manifest_contract_v2_hash is not None or self.echo_receipt_hash is not None:
                raise OutcomeContractV2BoundaryError("gate-blocked path cannot claim render or Echo authority")

        if self.stage == ECHO_REJECTED_DELIVERY:
            required = (
                self.domain_id,
                self.capability_contract_hash,
                self.service_contract_hash,
                self.invocation_request_hash,
                self.execution_receipt_hash,
                self.open_mea_manifest_hash,
                self.manifest_contract_v2_hash,
                self.echo_receipt_hash,
            )
            if any(item is None for item in required):
                raise OutcomeContractV2BoundaryError("Echo-rejected receipt requires complete rejected-delivery trace evidence")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "status": self.status,
            "stage": self.stage,
            "question_hash": self.question_hash,
            "source_id": self.source_id,
            "source_hash": self.source_hash,
            "raw_text_hash": self.raw_text_hash,
            "reasons": list(self.reasons),
            "domain_id": self.domain_id,
            "capability_contract_hash": self.capability_contract_hash,
            "service_contract_hash": self.service_contract_hash,
            "invocation_request_hash": self.invocation_request_hash,
            "execution_receipt_hash": self.execution_receipt_hash,
            "open_mea_manifest_hash": self.open_mea_manifest_hash,
            "manifest_contract_v2_hash": self.manifest_contract_v2_hash,
            "echo_receipt_hash": self.echo_receipt_hash,
            "output_delivery_permission": self.output_delivery_permission,
            "containment_destination": self.containment_destination,
            "memory_permission": self.memory_permission,
            "identity_permission": self.identity_permission,
            "economic_permission": self.economic_permission,
            "contribution_event_refs": list(self.contribution_event_refs),
        }

    def receipt_hash(self) -> str:
        return canonical_hash(self.to_dict())


def _source_fields(source: SemanticSource) -> Dict[str, str]:
    return {
        "source_id": source.source_id,
        "source_hash": source.source_hash(),
        "raw_text_hash": source.raw_text_hash,
    }


def build_early_refusal_receipt(
    *,
    question: str,
    source: SemanticSource,
    stage: str,
    reasons: Tuple[str, ...],
    domain_id: Optional[str] = None,
    capability_contract_hash: Optional[str] = None,
) -> NonDeliveryOutcomeReceiptV2:
    if stage not in _REFUSAL_STAGES:
        raise OutcomeContractV2BoundaryError("early-refusal builder accepts only refusal stages")
    return NonDeliveryOutcomeReceiptV2(
        status=REFUSED_UNLEARNED,
        stage=stage,
        question_hash=canonical_hash({"question": question}),
        reasons=reasons,
        domain_id=domain_id,
        capability_contract_hash=capability_contract_hash,
        **_source_fields(source),
    )


def build_gate_blocked_receipt(
    *,
    question: str,
    source: SemanticSource,
    domain_id: str,
    capability_contract_hash: str,
    service_contract_hash: str,
    invocation_request_hash: str,
    execution_receipt_hash: str,
    open_mea_manifest_hash: str,
    reasons: Tuple[str, ...],
) -> NonDeliveryOutcomeReceiptV2:
    return NonDeliveryOutcomeReceiptV2(
        status=GATE_BLOCKED,
        stage=GOVERNED_GATE_BLOCKED,
        question_hash=canonical_hash({"question": question}),
        reasons=reasons,
        domain_id=domain_id,
        capability_contract_hash=capability_contract_hash,
        service_contract_hash=service_contract_hash,
        invocation_request_hash=invocation_request_hash,
        execution_receipt_hash=execution_receipt_hash,
        open_mea_manifest_hash=open_mea_manifest_hash,
        **_source_fields(source),
    )


def build_echo_rejected_receipt(
    *,
    question: str,
    source: SemanticSource,
    domain_id: str,
    capability_contract_hash: str,
    service_contract_hash: str,
    invocation_request_hash: str,
    execution_receipt_hash: str,
    open_mea_manifest_hash: str,
    manifest_contract_v2_hash: str,
    echo_receipt_hash: str,
    reasons: Tuple[str, ...],
) -> NonDeliveryOutcomeReceiptV2:
    return NonDeliveryOutcomeReceiptV2(
        status=ECHO_REJECTED,
        stage=ECHO_REJECTED_DELIVERY,
        question_hash=canonical_hash({"question": question}),
        reasons=reasons,
        domain_id=domain_id,
        capability_contract_hash=capability_contract_hash,
        service_contract_hash=service_contract_hash,
        invocation_request_hash=invocation_request_hash,
        execution_receipt_hash=execution_receipt_hash,
        open_mea_manifest_hash=open_mea_manifest_hash,
        manifest_contract_v2_hash=manifest_contract_v2_hash,
        echo_receipt_hash=echo_receipt_hash,
        **_source_fields(source),
    )


def outcome_contract_v2_boundary() -> Dict[str, Any]:
    return {
        "build_id": GP009_BUILD_ID,
        "schema_version": GP009_SCHEMA_VERSION,
        "receipt_schema": NON_DELIVERY_RECEIPT_V2_SCHEMA,
        "purpose": "trace-bound non-delivery closure for existing General Pipeline outcome states",
        "answered_path_receipt": "DeliveryAuthorizationReceiptV2_from_GP008",
        "non_delivery_statuses_covered": [REFUSED_UNLEARNED, GATE_BLOCKED, ECHO_REJECTED],
        "non_delivery_stages_covered": sorted(_REQUIRED_STAGE_STATUS),
        "refusal_has_trace_receipt": True,
        "blocked_execution_has_containment_receipt": True,
        "echo_rejection_has_containment_receipt": True,
        "containment_is_persistent_storage": False,
        "in_memory_only": True,
        "corpus_ingestion_added": False,
        "persistent_memory_write_allowed": False,
        "identity_vault_write_allowed": False,
        "contribution_economy_write_allowed": False,
        "ct_mint_allowed": False,
        "ledger_write_allowed": False,
        "new_domain_added": False,
        # Executed rejection paths may now contain audited Lark/SymPy evidence;
        # early refusals still correctly claim no execution evidence.
        "third_party_dependency_promoted": True,
        "runtime_tool_activation_transition": "SUPERSEDED_BY_GP010B_R1",
        "active_external_tools_for_executed_outcomes": ["lark==1.3.1", "sympy==1.14.0", "mpmath==1.3.0", "Pint==0.25.3", "flexcache==0.3", "flexparser==0.4", "platformdirs==4.10.0", "typing_extensions==4.15.0 (reused)"],
        "capacity_parser_refusal_preserves_pint_dimensional_reason": True,
        "early_refusal_claims_no_executed_dependency": True,
        "executed_rejection_dependency_binding_via_execution_receipt": True,
    }


__all__ = [
    "GP009_BUILD_ID",
    "GP009_SCHEMA_VERSION",
    "NON_DELIVERY_RECEIPT_V2_SCHEMA",
    "REFUSED_UNLEARNED",
    "GATE_BLOCKED",
    "ECHO_REJECTED",
    "ROUTING_NO_DOMAIN",
    "CAPABILITY_NOT_INSTALLED",
    "SOURCE_AUTHORITY_NOT_PRESENT",
    "PARSER_REFUSED",
    "GOVERNED_GATE_BLOCKED",
    "ECHO_REJECTED_DELIVERY",
    "OutcomeContractV2BoundaryError",
    "NonDeliveryOutcomeReceiptV2",
    "build_early_refusal_receipt",
    "build_gate_blocked_receipt",
    "build_echo_rejected_receipt",
    "outcome_contract_v2_boundary",
]
