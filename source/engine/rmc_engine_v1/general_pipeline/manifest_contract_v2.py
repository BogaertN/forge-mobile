"""GP-008 — Manifest Contract v2: governed trace envelope before rendering.

GP-008 does not alter the MEA ``ProblemManifest`` contract. MEA continues to
represent the unresolved/resolved problem state. This module adds a separate,
hash-bound RMC-facing trace envelope that must exist before the production
pipeline may render or Echo-approve an answer.

The envelope links only evidence that already exists in the governed path:
source support, installed capability authority, Forge-owned service execution,
verification/gate proof, sealed MEA state, and RMC meaning. It also makes the
current negative boundaries explicit: no persistence, no Identity Vault write,
no corpus ingestion, no Contribution Economy action, no CT, and no ledger.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple
import re

from rmc_engine_v1.mea.manifest_schema import ClaimStatus

from .contracts import MeaningManifest, ParsedQuestion, SemanticSource, ExactSolution, canonical_hash


GP008_BUILD_ID = "GENERAL-PIPELINE-MANIFEST-CONTRACT-V2-BUILD-GP-008"
GP008_SCHEMA_VERSION = "general_pipeline_manifest_contract_v2_build_gp008"
MANIFEST_CONTRACT_V2_SCHEMA = "rmc_governed_trace_manifest_contract_v2"
DELIVERY_RECEIPT_V2_SCHEMA = "rmc_echo_bound_delivery_authorization_v2"

FORMAL_DERIVATION = "formal_derivation"
SYMBOLIC_MATH_TOOL_EVIDENCE_VERIFICATION = "symbolic_math_typed_ast_verified_tool_evidence"
IN_MEMORY_GOVERNED_SOURCE = "IN_MEMORY_GOVERNED_SOURCE_SUPPORT"
RENDER_AFTER_ECHO = "HUMAN_TEXT_AFTER_ECHO_VALIDATION"
NO_PERSISTENT_MEMORY_WRITE = "NO_PERSISTENT_MEMORY_WRITE_GP008"
NO_IDENTITY_WRITE = "NO_IDENTITY_VAULT_WRITE_GP008"
NO_ECONOMIC_ACTION = "NO_CONTRIBUTION_CT_OR_LEDGER_ACTION_GP008"
IN_MEMORY_REJECTION_ONLY = "IN_MEMORY_REJECTION_ONLY_GP008"
NOT_CORPUS_INGESTED = "NOT_CORPUS_INGESTED_GP008"
NO_EXTERNAL_PROVENANCE_LINK = "NO_EXTERNAL_PROVENANCE_LINK_GP008"

_REQUIRED_AUTHORITY_BASIS = (
    "source:governed_in_memory_instructional_support",
    "capability:installed_bounded_contract",
    "service:forge_owned_execution_boundary",
    "verification:exact_solution_and_gate_pass",
    "mea:sealed_resolved_manifest",
    "rmc:meaning_bound_before_render",
)


class ManifestContractV2BoundaryError(ValueError):
    """Raised when a rendering/output path lacks a complete GP-008 contract."""


def _require_sha256(label: str, value: str) -> None:
    if not isinstance(value, str) or re.fullmatch(r"[0-9a-f]{64}", value) is None:
        raise ManifestContractV2BoundaryError(f"{label} must be a canonical SHA-256 hex digest")


@dataclass(frozen=True)
class SourceAncestryReferenceV2:
    source_id: str
    source_hash: str
    raw_text_hash: str
    procedure_id: str
    source_ref: str
    domain_id: str
    authority_class: str = IN_MEMORY_GOVERNED_SOURCE
    corpus_state: str = NOT_CORPUS_INGESTED
    external_provenance_state: str = NO_EXTERNAL_PROVENANCE_LINK

    def __post_init__(self) -> None:
        required = (
            self.source_id,
            self.source_hash,
            self.raw_text_hash,
            self.procedure_id,
            self.source_ref,
            self.domain_id,
        )
        if any(not isinstance(item, str) or not item.strip() for item in required):
            raise ManifestContractV2BoundaryError("source ancestry requires non-empty stable identifiers")
        _require_sha256("source_hash", self.source_hash)
        _require_sha256("raw_text_hash", self.raw_text_hash)
        if self.authority_class != IN_MEMORY_GOVERNED_SOURCE:
            raise ManifestContractV2BoundaryError("GP-008 source ancestry cannot claim corpus authority")
        if self.corpus_state != NOT_CORPUS_INGESTED:
            raise ManifestContractV2BoundaryError("GP-008 does not ingest a corpus")
        if self.external_provenance_state != NO_EXTERNAL_PROVENANCE_LINK:
            raise ManifestContractV2BoundaryError("GP-008 does not create external provenance links")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source_id": self.source_id,
            "source_hash": self.source_hash,
            "raw_text_hash": self.raw_text_hash,
            "procedure_id": self.procedure_id,
            "source_ref": self.source_ref,
            "domain_id": self.domain_id,
            "authority_class": self.authority_class,
            "corpus_state": self.corpus_state,
            "external_provenance_state": self.external_provenance_state,
        }

    def reference_hash(self) -> str:
        return canonical_hash(self.to_dict())


@dataclass(frozen=True)
class VerificationReceiptV2:
    solution_hash: str
    gate_hash: str
    verification_method: str
    verification_text: str
    solution_verified: bool
    gate_passed: bool
    claim_scope: str = FORMAL_DERIVATION
    limitations: Tuple[str, ...] = (
        "Verified only within the installed bounded problem domain.",
        "This is not an empirical-world claim or corpus-derived assertion.",
    )
    verification_strength: Optional[str] = None

    def __post_init__(self) -> None:
        _require_sha256("solution_hash", self.solution_hash)
        _require_sha256("gate_hash", self.gate_hash)
        if self.verification_method not in {
            "exact_arithmetic_replay_or_substitution",
            SYMBOLIC_MATH_TOOL_EVIDENCE_VERIFICATION,
        }:
            raise ManifestContractV2BoundaryError("Manifest Contract v2 permits only installed bounded verification methods")
        if self.verification_method == SYMBOLIC_MATH_TOOL_EVIDENCE_VERIFICATION:
            if self.verification_strength not in {
                "EXACT_SYMBOLIC_EQUIVALENCE",
                "EXACT_SUBSTITUTION_VERIFICATION",
                "DETERMINISTIC_ENGINE_REPLAY",
                "STRUCTURAL_SYMBOLIC_RECEIPT",
            }:
                raise ManifestContractV2BoundaryError("symbolic mathematics evidence requires a declared verification strength")
        elif self.verification_strength is not None:
            raise ManifestContractV2BoundaryError("legacy arithmetic verification may not claim symbolic verification strength")
        if not self.verification_text.strip():
            raise ManifestContractV2BoundaryError("verification text may not be empty")
        if not self.solution_verified or not self.gate_passed:
            raise ManifestContractV2BoundaryError("unverified or unsealed results cannot enter Manifest Contract v2")
        if self.claim_scope != FORMAL_DERIVATION:
            raise ManifestContractV2BoundaryError("current GP-008 claim scope is formal derivation only")

    def to_dict(self) -> Dict[str, Any]:
        payload = {
            "solution_hash": self.solution_hash,
            "gate_hash": self.gate_hash,
            "verification_method": self.verification_method,
            "verification_text": self.verification_text,
            "solution_verified": self.solution_verified,
            "gate_passed": self.gate_passed,
            "claim_scope": self.claim_scope,
            "limitations": list(self.limitations),
        }
        if self.verification_strength is not None:
            payload["verification_strength"] = self.verification_strength
        return payload

    def receipt_hash(self) -> str:
        return canonical_hash(self.to_dict())


@dataclass(frozen=True)
class ManifestContractV2:
    problem_id: str
    claim_type: str
    claim_status: str
    authority_basis: Tuple[str, ...]
    source_ancestry: Tuple[SourceAncestryReferenceV2, ...]
    selected_capability_id: str
    capability_contract_hash: str
    selected_service_id: str
    service_contract_hash: str
    invocation_request_hash: str
    execution_receipt_hash: str
    verification_receipt: VerificationReceiptV2
    open_mea_manifest_hash: str
    sealed_mea_manifest_hash: str
    meaning_manifest_hash: str
    parsed_question_hash: str
    typed_ast_hash: Optional[str] = None
    safe_solver_adapter_receipt_hash: Optional[str] = None
    quantity_ast_hash: Optional[str] = None
    safe_quantity_adapter_receipt_hash: Optional[str] = None
    symbolic_math_operation_manifest_hash: Optional[str] = None
    symbolic_math_execution_receipt_hash: Optional[str] = None
    symbolic_math_pending_governance_receipt_hash: Optional[str] = None
    symbolic_math_verification_strength: Optional[str] = None
    symbolic_math_computation_status: Optional[str] = None
    render_permissions: Tuple[str, ...] = (RENDER_AFTER_ECHO,)
    delivery_requires_echo: bool = True
    memory_permission: str = NO_PERSISTENT_MEMORY_WRITE
    identity_permission: str = NO_IDENTITY_WRITE
    economic_permission: str = NO_ECONOMIC_ACTION
    containment_destination: str = IN_MEMORY_REJECTION_ONLY
    contribution_event_refs: Tuple[str, ...] = ()
    schema_version: str = MANIFEST_CONTRACT_V2_SCHEMA

    def __post_init__(self) -> None:
        mandatory_ids = (
            self.problem_id,
            self.selected_capability_id,
            self.capability_contract_hash,
            self.selected_service_id,
            self.service_contract_hash,
            self.invocation_request_hash,
            self.execution_receipt_hash,
            self.open_mea_manifest_hash,
            self.sealed_mea_manifest_hash,
            self.meaning_manifest_hash,
            self.parsed_question_hash,
        )
        if any(not isinstance(item, str) or not item.strip() for item in mandatory_ids):
            raise ManifestContractV2BoundaryError("Manifest Contract v2 requires all linked trace identifiers")
        for label, digest in (
            ("capability_contract_hash", self.capability_contract_hash),
            ("service_contract_hash", self.service_contract_hash),
            ("invocation_request_hash", self.invocation_request_hash),
            ("execution_receipt_hash", self.execution_receipt_hash),
            ("open_mea_manifest_hash", self.open_mea_manifest_hash),
            ("sealed_mea_manifest_hash", self.sealed_mea_manifest_hash),
            ("meaning_manifest_hash", self.meaning_manifest_hash),
            ("parsed_question_hash", self.parsed_question_hash),
        ):
            _require_sha256(label, digest)
        if self.typed_ast_hash is not None:
            _require_sha256("typed_ast_hash", self.typed_ast_hash)
        if self.safe_solver_adapter_receipt_hash is not None:
            _require_sha256("safe_solver_adapter_receipt_hash", self.safe_solver_adapter_receipt_hash)
        if self.quantity_ast_hash is not None:
            _require_sha256("quantity_ast_hash", self.quantity_ast_hash)
        if self.safe_quantity_adapter_receipt_hash is not None:
            _require_sha256("safe_quantity_adapter_receipt_hash", self.safe_quantity_adapter_receipt_hash)
        if self.schema_version != MANIFEST_CONTRACT_V2_SCHEMA:
            raise ManifestContractV2BoundaryError("unknown Manifest Contract v2 schema")
        if self.claim_type != FORMAL_DERIVATION:
            raise ManifestContractV2BoundaryError("GP-008 currently supports formal-derivation claim type only")
        if self.claim_status != ClaimStatus.RESOLVED_MANIFEST.value:
            raise ManifestContractV2BoundaryError("only sealed resolved MEA states may form a render contract")
        if self.authority_basis != _REQUIRED_AUTHORITY_BASIS:
            raise ManifestContractV2BoundaryError("authority basis is incomplete or reordered")
        if not self.source_ancestry:
            raise ManifestContractV2BoundaryError("source ancestry is mandatory")
        if self.render_permissions != (RENDER_AFTER_ECHO,) or not self.delivery_requires_echo:
            raise ManifestContractV2BoundaryError("human-text delivery must remain gated by Echo")
        if self.memory_permission != NO_PERSISTENT_MEMORY_WRITE:
            raise ManifestContractV2BoundaryError("GP-008 cannot permit persistent memory writes")
        if self.identity_permission != NO_IDENTITY_WRITE:
            raise ManifestContractV2BoundaryError("GP-008 cannot permit Identity Vault writes")
        if self.economic_permission != NO_ECONOMIC_ACTION or self.contribution_event_refs:
            raise ManifestContractV2BoundaryError("GP-008 cannot permit contribution or economic activity")
        if self.containment_destination != IN_MEMORY_REJECTION_ONLY:
            raise ManifestContractV2BoundaryError("GP-008 containment remains in-memory only")
        ast_bound = self.typed_ast_hash is not None
        adapter_bound = self.safe_solver_adapter_receipt_hash is not None
        if ast_bound != adapter_bound:
            raise ManifestContractV2BoundaryError("typed AST and safe-adapter receipt references must bind together")
        quantity_ast_bound = self.quantity_ast_hash is not None
        quantity_adapter_bound = self.safe_quantity_adapter_receipt_hash is not None
        if quantity_ast_bound != quantity_adapter_bound:
            raise ManifestContractV2BoundaryError("quantity AST and Pint-adapter receipt references must bind together")
        if ast_bound and quantity_ast_bound:
            raise ManifestContractV2BoundaryError("one manifest execution may bind only one adapter family")
        symbolic_values = (
            self.symbolic_math_operation_manifest_hash,
            self.symbolic_math_execution_receipt_hash,
            self.symbolic_math_pending_governance_receipt_hash,
            self.symbolic_math_verification_strength,
            self.symbolic_math_computation_status,
        )
        symbolic_bound = any(value is not None for value in symbolic_values)
        if symbolic_bound and not all(value is not None for value in symbolic_values):
            raise ManifestContractV2BoundaryError("symbolic mathematics evidence bindings must be complete")
        if symbolic_bound:
            if ast_bound or quantity_ast_bound:
                raise ManifestContractV2BoundaryError("one manifest execution may bind only one evidence family")
            _require_sha256("symbolic_math_operation_manifest_hash", self.symbolic_math_operation_manifest_hash)
            _require_sha256("symbolic_math_execution_receipt_hash", self.symbolic_math_execution_receipt_hash)
            _require_sha256("symbolic_math_pending_governance_receipt_hash", self.symbolic_math_pending_governance_receipt_hash)
            if self.symbolic_math_computation_status != "COMPUTED_VERIFIED_PENDING_DOWNSTREAM_GOVERNANCE":
                raise ManifestContractV2BoundaryError("symbolic computation must remain pending actual Echo delivery authority")
            if self.verification_receipt.verification_method != SYMBOLIC_MATH_TOOL_EVIDENCE_VERIFICATION:
                raise ManifestContractV2BoundaryError("symbolic evidence must use the symbolic tool verification receipt")
            if self.symbolic_math_verification_strength != self.verification_receipt.verification_strength:
                raise ManifestContractV2BoundaryError("symbolic verification strength must remain bound across the contract")

    def to_dict(self) -> Dict[str, Any]:
        payload = {
            "schema_version": self.schema_version,
            "problem_id": self.problem_id,
            "claim_type": self.claim_type,
            "claim_status": self.claim_status,
            "authority_basis": list(self.authority_basis),
            "source_ancestry": [ref.to_dict() for ref in self.source_ancestry],
            "source_ancestry_hashes": [ref.reference_hash() for ref in self.source_ancestry],
            "selected_capability_id": self.selected_capability_id,
            "capability_contract_hash": self.capability_contract_hash,
            "selected_service_id": self.selected_service_id,
            "service_contract_hash": self.service_contract_hash,
            "invocation_request_hash": self.invocation_request_hash,
            "execution_receipt_hash": self.execution_receipt_hash,
            "verification_receipt": self.verification_receipt.to_dict(),
            "verification_receipt_hash": self.verification_receipt.receipt_hash(),
            "open_mea_manifest_hash": self.open_mea_manifest_hash,
            "sealed_mea_manifest_hash": self.sealed_mea_manifest_hash,
            "meaning_manifest_hash": self.meaning_manifest_hash,
            "parsed_question_hash": self.parsed_question_hash,
            "typed_ast_hash": self.typed_ast_hash,
            "safe_solver_adapter_receipt_hash": self.safe_solver_adapter_receipt_hash,
            "quantity_ast_hash": self.quantity_ast_hash,
            "safe_quantity_adapter_receipt_hash": self.safe_quantity_adapter_receipt_hash,
            "render_permissions": list(self.render_permissions),
            "delivery_requires_echo": self.delivery_requires_echo,
            "memory_permission": self.memory_permission,
            "identity_permission": self.identity_permission,
            "economic_permission": self.economic_permission,
            "containment_destination": self.containment_destination,
            "contribution_event_refs": list(self.contribution_event_refs),
        }
        if self.symbolic_math_operation_manifest_hash is not None:
            payload.update({
                "symbolic_math_operation_manifest_hash": self.symbolic_math_operation_manifest_hash,
                "symbolic_math_execution_receipt_hash": self.symbolic_math_execution_receipt_hash,
                "symbolic_math_pending_governance_receipt_hash": self.symbolic_math_pending_governance_receipt_hash,
                "symbolic_math_verification_strength": self.symbolic_math_verification_strength,
                "symbolic_math_computation_status": self.symbolic_math_computation_status,
            })
        return payload

    def contract_hash(self) -> str:
        return canonical_hash(self.to_dict())


@dataclass(frozen=True)
class DeliveryAuthorizationReceiptV2:
    manifest_contract_v2_hash: str
    meaning_manifest_hash: str
    echo_receipt_hash: str
    echo_approved: bool
    output_mode: str = "human_text"
    delivery_status: str = "ECHO_APPROVED_DELIVERY_AUTHORIZED"
    side_effects_observed: str = "none"
    schema_version: str = DELIVERY_RECEIPT_V2_SCHEMA

    def __post_init__(self) -> None:
        _require_sha256("manifest_contract_v2_hash", self.manifest_contract_v2_hash)
        _require_sha256("meaning_manifest_hash", self.meaning_manifest_hash)
        _require_sha256("echo_receipt_hash", self.echo_receipt_hash)
        if not self.echo_approved or self.delivery_status != "ECHO_APPROVED_DELIVERY_AUTHORIZED":
            raise ManifestContractV2BoundaryError("delivery may not authorize an Echo-rejected rendering")
        if self.output_mode != "human_text" or self.side_effects_observed != "none":
            raise ManifestContractV2BoundaryError("GP-008 delivery is text-only and side-effect free")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "manifest_contract_v2_hash": self.manifest_contract_v2_hash,
            "meaning_manifest_hash": self.meaning_manifest_hash,
            "echo_receipt_hash": self.echo_receipt_hash,
            "echo_approved": self.echo_approved,
            "output_mode": self.output_mode,
            "delivery_status": self.delivery_status,
            "side_effects_observed": self.side_effects_observed,
        }

    def receipt_hash(self) -> str:
        return canonical_hash(self.to_dict())


def build_manifest_contract_v2(
    *,
    source: SemanticSource,
    parsed: ParsedQuestion,
    solution: ExactSolution,
    capability: Any,
    service: Any,
    invocation: Any,
    execution_receipt: Any,
    gate: Any,
    open_mea_manifest_hash: str,
    sealed_mea_manifest: Any,
    sealed_mea_manifest_hash: str,
    meaning: MeaningManifest,
) -> ManifestContractV2:
    """Assemble the render-authorizing trace envelope from already-proven stages."""
    procedure = source.procedure_for_domain(parsed.domain)
    if procedure is None:
        raise ManifestContractV2BoundaryError("source procedure is required for ancestry")
    if not gate.passed or not solution.verified:
        raise ManifestContractV2BoundaryError("Manifest Contract v2 cannot be built before verified gate passage")
    if sealed_mea_manifest.claim_status != ClaimStatus.RESOLVED_MANIFEST.value:
        raise ManifestContractV2BoundaryError("MEA state must already be sealed and resolved")
    source_ref = SourceAncestryReferenceV2(
        source_id=source.source_id,
        source_hash=source.source_hash(),
        raw_text_hash=source.raw_text_hash,
        procedure_id=procedure.procedure_id,
        source_ref=procedure.source_ref,
        domain_id=parsed.domain,
    )
    verification = VerificationReceiptV2(
        solution_hash=canonical_hash(solution.to_dict()),
        gate_hash=gate.gate_hash(),
        verification_method="exact_arithmetic_replay_or_substitution",
        verification_text=solution.verification_text,
        solution_verified=solution.verified,
        gate_passed=gate.passed,
    )
    adapter_receipt = execution_receipt.safe_solver_adapter_receipt
    quantity_adapter_receipt = execution_receipt.safe_quantity_adapter_receipt
    return ManifestContractV2(
        problem_id=sealed_mea_manifest.problem_id,
        claim_type=FORMAL_DERIVATION,
        claim_status=sealed_mea_manifest.claim_status,
        authority_basis=_REQUIRED_AUTHORITY_BASIS,
        source_ancestry=(source_ref,),
        selected_capability_id=capability.capability_id,
        capability_contract_hash=capability.contract_hash(),
        selected_service_id=service.service_id,
        service_contract_hash=service.service_contract_hash(),
        invocation_request_hash=invocation.request_hash(),
        execution_receipt_hash=execution_receipt.receipt_hash(),
        verification_receipt=verification,
        open_mea_manifest_hash=open_mea_manifest_hash,
        sealed_mea_manifest_hash=sealed_mea_manifest_hash,
        meaning_manifest_hash=meaning.meaning_hash(),
        parsed_question_hash=canonical_hash(parsed.to_dict()),
        typed_ast_hash=execution_receipt.typed_ast_hash,
        safe_solver_adapter_receipt_hash=(
            canonical_hash(adapter_receipt) if adapter_receipt is not None else None
        ),
        quantity_ast_hash=execution_receipt.quantity_ast_hash,
        safe_quantity_adapter_receipt_hash=(
            canonical_hash(quantity_adapter_receipt) if quantity_adapter_receipt is not None else None
        ),
    )


def require_render_authority(contract: ManifestContractV2, meaning: MeaningManifest) -> None:
    """Raise unless the validated v2 contract grants Echo-gated rendering."""
    if not isinstance(contract, ManifestContractV2):
        raise ManifestContractV2BoundaryError("renderer requires Manifest Contract v2")
    if contract.meaning_manifest_hash != meaning.meaning_hash():
        raise ManifestContractV2BoundaryError("render request meaning does not match Manifest Contract v2")
    if contract.claim_status != meaning.claim_status:
        raise ManifestContractV2BoundaryError("render request claim status differs from Manifest Contract v2")
    if RENDER_AFTER_ECHO not in contract.render_permissions or not contract.delivery_requires_echo:
        raise ManifestContractV2BoundaryError("render permission is not Echo-gated")


def finalize_echo_delivery(
    contract: ManifestContractV2,
    meaning: MeaningManifest,
    echo_result: Any,
) -> DeliveryAuthorizationReceiptV2:
    require_render_authority(contract, meaning)
    if not echo_result.approved_output:
        raise ManifestContractV2BoundaryError("Echo-rejected output cannot receive delivery authorization")
    return DeliveryAuthorizationReceiptV2(
        manifest_contract_v2_hash=contract.contract_hash(),
        meaning_manifest_hash=meaning.meaning_hash(),
        echo_receipt_hash=echo_result.echo_hash(),
        echo_approved=echo_result.approved_output,
    )



def required_authority_basis_v2() -> Tuple[str, ...]:
    """Expose the canonical authority chain for specialized downstream v2 builders."""
    return _REQUIRED_AUTHORITY_BASIS

def manifest_contract_v2_boundary() -> Dict[str, Any]:
    return {
        "build_id": GP008_BUILD_ID,
        "schema_version": GP008_SCHEMA_VERSION,
        "manifest_contract_schema": MANIFEST_CONTRACT_V2_SCHEMA,
        "layer": "RMC render-authority trace envelope; MEA ProblemManifest remains separate",
        "claim_types_enabled": [FORMAL_DERIVATION],
        "requires_source_ancestry": True,
        "requires_capability_execution_receipt": True,
        "requires_verification_receipt": True,
        "requires_sealed_mea_manifest": True,
        "requires_meaning_manifest_before_render": True,
        "requires_echo_before_delivery": True,
        "corpus_ingestion_added": False,
        "persistent_memory_write_allowed": False,
        "identity_vault_write_allowed": False,
        "contribution_economy_write_allowed": False,
        "ct_mint_allowed": False,
        "ledger_write_allowed": False,
        "new_domain_added": False,
        # GP-010B-R1 activated audited tools after GP-008 was originally authored.
        # Render authority still depends on the service/execution receipt hashes;
        # this boundary now truthfully exposes the active backend state.
        "third_party_dependency_promoted": True,
        "runtime_tool_activation_transition": "SUPERSEDED_BY_GP010B_R1",
        "active_external_tools_for_equation_delivery": ["lark==1.3.1", "sympy==1.14.0", "mpmath==1.3.0"],
        "active_external_tools_for_capacity_delivery": ["Pint==0.25.3", "flexcache==0.3", "flexparser==0.4", "platformdirs==4.10.0", "typing_extensions==4.15.0 (reused)"],
        "quantity_ast_and_dimensional_receipt_supported": True,
        "symbolic_math_verified_tool_evidence_supported": True,
        "symbolic_math_delivery_requires_actual_echo": True,
        "dependency_binding_path": ["capability_service_contract_hash", "capability_execution_receipt_hash", "dependency_registry_hash"],
    }


__all__ = [
    "GP008_BUILD_ID",
    "GP008_SCHEMA_VERSION",
    "MANIFEST_CONTRACT_V2_SCHEMA",
    "ManifestContractV2BoundaryError",
    "SourceAncestryReferenceV2",
    "VerificationReceiptV2",
    "ManifestContractV2",
    "DeliveryAuthorizationReceiptV2",
    "build_manifest_contract_v2",
    "require_render_authority",
    "finalize_echo_delivery",
    "manifest_contract_v2_boundary",
    "SYMBOLIC_MATH_TOOL_EVIDENCE_VERIFICATION",
    "required_authority_basis_v2",
]
