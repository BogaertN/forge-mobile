"""MATH-001R1 / GP-012R1 — Governed symbolic mathematics computation kernel.

This service accepts only a typed operation manifest and allowlisted recursive AST,
executes inside a resource-limited isolated SymPy worker, and returns hash-bound
computation evidence.  It deliberately does *not* render, Echo-approve, authorize,
or deliver user-facing output.  A later lawful caller may submit verified computation
evidence into the existing Manifest Contract v2 and Echo delivery spine.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Mapping, Sequence, Tuple
import json
import os
import subprocess
import sys

from .contracts import canonical_hash
from .dependency_registry import (
    active_runtime_dependency_ids,
    dependency_records_for_ids,
    dependency_registry_hash,
    validate_service_dependency_binding,
)
from .symbolic_math_ast import (
    MATH001_BUILD_ID,
    MATH001_CAPABILITY_ID,
    MATH001_SCHEMA_VERSION,
    SUPPORTED_OPERATION_FAMILIES,
    SymbolicMathOperationManifest,
    symbolic_math_ast_boundary,
)

MATH001_SERVICE_ID = "svc.math.symbolic_math.sympy_isolated.computation_only.v1"
MATH001_EXECUTION_SCHEMA = "aiweb_symbolic_math_execution_receipt_v1_math001r1"
MATH001_PENDING_GOVERNANCE_SCHEMA = "aiweb_symbolic_math_pending_governance_receipt_v1"
MATH001_NON_DELIVERY_SCHEMA = "aiweb_symbolic_math_non_delivery_receipt_v1_math001r1"
SUCCESS_STATUS = "COMPUTED_VERIFIED_PENDING_DOWNSTREAM_GOVERNANCE"
REQUIRED_DELIVERY_AUTHORITY = "EXISTING_MANIFEST_CONTRACT_V2_AND_ECHO_DELIVERY_AUTHORIZATION_ONLY"


class SymbolicMathServiceError(ValueError):
    pass


def _service_dependency_binding() -> tuple[Tuple[str, ...], Tuple[str, ...]]:
    ids = active_runtime_dependency_ids("symbolic_math")
    validate_service_dependency_binding(ids, "symbolic_math")
    hashes = tuple(record.record_hash() for record in dependency_records_for_ids(ids))
    if not any("sympy" in dependency_id for dependency_id in ids):
        raise SymbolicMathServiceError("symbolic mathematics service is not bound to the audited SymPy record")
    return ids, hashes


def symbolic_math_service_contract() -> Dict[str, Any]:
    dependency_ids, dependency_hashes = _service_dependency_binding()
    return {
        "build_id": MATH001_BUILD_ID,
        "schema_version": MATH001_SCHEMA_VERSION,
        "capability_id": MATH001_CAPABILITY_ID,
        "service_id": MATH001_SERVICE_ID,
        "operation_manifest_required": True,
        "supported_operation_family_count": len(SUPPORTED_OPERATION_FAMILIES),
        "supported_operation_families": list(SUPPORTED_OPERATION_FAMILIES),
        "backend": "sympy==1.14.0",
        "worker_policy": "ISOLATED_RESOURCE_LIMITS_APPLIED_BEFORE_SYMPY_IMPORT",
        "dependency_registry_hash": dependency_registry_hash(),
        "active_dependency_record_ids": list(dependency_ids),
        "active_dependency_record_hashes": list(dependency_hashes),
        "raw_mathematical_source_accepted": False,
        "natural_language_compiler_added": False,
        "computation_only_capability": True,
        "successful_operation_status": SUCCESS_STATUS,
        "direct_user_facing_delivery_authorized": False,
        "render_allowed": False,
        "actual_echo_invoked_by_kernel": False,
        "required_delivery_authority": REQUIRED_DELIVERY_AUTHORITY,
        "writes_memory": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "mints_ct": False,
        "writes_ledgers": False,
        "ingests_corpus": False,
    }


@dataclass(frozen=True)
class SymbolicMathExecutionReceipt:
    operation_id: str
    operation_family: str
    manifest_hash: str
    service_contract_hash: str
    dependency_registry_hash: str
    active_dependency_record_ids: Tuple[str, ...]
    active_dependency_record_hashes: Tuple[str, ...]
    result_hash: str
    backend: str
    verification: Mapping[str, Any]
    worker_boundary: str
    schema_version: str = MATH001_EXECUTION_SCHEMA
    status: str = "SYMBOLIC_MATH_EXECUTION_VERIFIED"
    writes_memory: bool = False
    writes_identity_vault: bool = False
    writes_contribution_economy: bool = False
    mints_ct: bool = False
    writes_ledgers: bool = False
    ingests_corpus: bool = False

    def __post_init__(self) -> None:
        if self.operation_family not in SUPPORTED_OPERATION_FAMILIES or self.backend != "sympy==1.14.0":
            raise SymbolicMathServiceError("execution receipt authority mismatch")
        for value in (self.manifest_hash, self.service_contract_hash, self.dependency_registry_hash, self.result_hash):
            if not isinstance(value, str) or len(value) != 64:
                raise SymbolicMathServiceError("execution receipt requires SHA-256 bindings")
        if not self.verification.get("passed"):
            raise SymbolicMathServiceError("unverified results cannot obtain execution receipts")
        if any((self.writes_memory, self.writes_identity_vault, self.writes_contribution_economy, self.mints_ct, self.writes_ledgers, self.ingests_corpus)):
            raise SymbolicMathServiceError("symbolic computation receipt cannot claim side effects")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": self.schema_version, "status": self.status,
            "operation_id": self.operation_id, "operation_family": self.operation_family,
            "manifest_hash": self.manifest_hash, "service_contract_hash": self.service_contract_hash,
            "dependency_registry_hash": self.dependency_registry_hash,
            "active_dependency_record_ids": list(self.active_dependency_record_ids),
            "active_dependency_record_hashes": list(self.active_dependency_record_hashes),
            "result_hash": self.result_hash, "backend": self.backend,
            "verification": dict(self.verification), "worker_boundary": self.worker_boundary,
            "writes_memory": self.writes_memory, "writes_identity_vault": self.writes_identity_vault,
            "writes_contribution_economy": self.writes_contribution_economy,
            "mints_ct": self.mints_ct, "writes_ledgers": self.writes_ledgers,
            "ingests_corpus": self.ingests_corpus,
        }

    def receipt_hash(self) -> str:
        return canonical_hash(self.to_dict())


@dataclass(frozen=True)
class SymbolicMathPendingGovernanceReceipt:
    manifest_hash: str
    execution_receipt_hash: str
    result_hash: str
    operation_family: str
    verification_strength: str
    schema_version: str = MATH001_PENDING_GOVERNANCE_SCHEMA
    status: str = "SYMBOLIC_MATH_COMPUTED_PENDING_MANIFEST_V2_ECHO"
    required_delivery_authority: str = REQUIRED_DELIVERY_AUTHORITY
    delivery_authorized: bool = False
    render_allowed: bool = False
    actual_echo_invoked: bool = False
    writes_memory: bool = False
    writes_identity_vault: bool = False
    writes_contribution_economy: bool = False
    mints_ct: bool = False
    writes_ledgers: bool = False
    ingests_corpus: bool = False

    def __post_init__(self) -> None:
        for value in (self.manifest_hash, self.execution_receipt_hash, self.result_hash):
            if not isinstance(value, str) or len(value) != 64:
                raise SymbolicMathServiceError("pending-governance receipt requires SHA-256 bindings")
        if self.operation_family not in SUPPORTED_OPERATION_FAMILIES:
            raise SymbolicMathServiceError("pending-governance operation family mismatch")
        if self.delivery_authorized or self.render_allowed or self.actual_echo_invoked:
            raise SymbolicMathServiceError("computation-only kernel cannot claim downstream delivery authority")
        if self.required_delivery_authority != REQUIRED_DELIVERY_AUTHORITY:
            raise SymbolicMathServiceError("pending-governance receipt must retain exclusive delivery authority")
        if any((self.writes_memory, self.writes_identity_vault, self.writes_contribution_economy, self.mints_ct, self.writes_ledgers, self.ingests_corpus)):
            raise SymbolicMathServiceError("pending-governance receipt cannot claim side effects")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": self.schema_version, "status": self.status,
            "manifest_hash": self.manifest_hash, "execution_receipt_hash": self.execution_receipt_hash,
            "result_hash": self.result_hash, "operation_family": self.operation_family,
            "verification_strength": self.verification_strength,
            "required_delivery_authority": self.required_delivery_authority,
            "delivery_authorized": self.delivery_authorized, "render_allowed": self.render_allowed,
            "actual_echo_invoked": self.actual_echo_invoked,
            "writes_memory": self.writes_memory, "writes_identity_vault": self.writes_identity_vault,
            "writes_contribution_economy": self.writes_contribution_economy,
            "mints_ct": self.mints_ct, "writes_ledgers": self.writes_ledgers,
            "ingests_corpus": self.ingests_corpus,
        }

    def receipt_hash(self) -> str:
        return canonical_hash(self.to_dict())


@dataclass(frozen=True)
class SymbolicMathNonDeliveryReceipt:
    reason_code: str
    manifest_hash: str
    detail: str
    operation_family: str = "UNBOUND_INVALID_OR_REFUSED"
    schema_version: str = MATH001_NON_DELIVERY_SCHEMA
    status: str = "SYMBOLIC_MATH_CONTAINED_NON_DELIVERY"
    result_delivered: bool = False
    delivery_authorized: bool = False
    render_allowed: bool = False
    actual_echo_invoked: bool = False
    writes_memory: bool = False
    writes_identity_vault: bool = False
    writes_contribution_economy: bool = False
    mints_ct: bool = False
    writes_ledgers: bool = False
    ingests_corpus: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": self.schema_version, "status": self.status,
            "reason_code": self.reason_code, "manifest_hash": self.manifest_hash,
            "operation_family": self.operation_family, "detail": self.detail[:400],
            "result_delivered": self.result_delivered, "delivery_authorized": self.delivery_authorized,
            "render_allowed": self.render_allowed, "actual_echo_invoked": self.actual_echo_invoked,
            "writes_memory": self.writes_memory, "writes_identity_vault": self.writes_identity_vault,
            "writes_contribution_economy": self.writes_contribution_economy,
            "mints_ct": self.mints_ct, "writes_ledgers": self.writes_ledgers,
            "ingests_corpus": self.ingests_corpus,
        }

    def receipt_hash(self) -> str:
        return canonical_hash(self.to_dict())


def _raw_hash(value: Any) -> str:
    try:
        return canonical_hash(value)
    except Exception:
        return canonical_hash({"unserializable_input_type": type(value).__name__})


def _worker_path() -> Path:
    return Path(__file__).resolve().with_name("symbolic_math_worker.py")


def _package_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _invoke_worker(manifests: Sequence[SymbolicMathOperationManifest], *, batch: bool) -> Dict[str, Any]:
    if not manifests:
        raise SymbolicMathServiceError("worker invocation requires at least one manifest")
    if batch and len(manifests) > len(SUPPORTED_OPERATION_FAMILIES):
        raise SymbolicMathServiceError("attestation batch exceeds operation-family bound")
    envelope_policy = max((m.resource_policy for m in manifests), key=lambda p: p.wall_timeout_seconds)
    if batch:
        policy = dict(envelope_policy.to_dict())
        policy["wall_timeout_seconds"] = min(30, max(12, envelope_policy.wall_timeout_seconds * 2))
        policy["cpu_seconds"] = min(20, max(12, envelope_policy.cpu_seconds * 2))
        policy["memory_megabytes"] = max(4096, envelope_policy.memory_megabytes)
    else:
        policy = envelope_policy.to_dict()
    request = {"resource_policy": policy, "manifests": [m.to_dict() for m in manifests], "attestation_batch": batch}
    env = dict(os.environ)
    prior_path = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = str(_package_root()) + (os.pathsep + prior_path if prior_path else "")
    try:
        completed = subprocess.run(
            [sys.executable, str(_worker_path())],
            input=json.dumps(request, sort_keys=True),
            text=True,
            capture_output=True,
            cwd=str(_package_root()),
            env=env,
            timeout=policy["wall_timeout_seconds"],
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise SymbolicMathServiceError("isolated worker exceeded governed wall timeout") from exc
    if completed.returncode != 0:
        detail = completed.stdout.strip() or completed.stderr.strip() or f"worker exit status {completed.returncode}"
        raise SymbolicMathServiceError(detail[:400])
    try:
        response = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise SymbolicMathServiceError("isolated worker returned non-JSON output") from exc
    if response.get("worker_status") != "COMPLETED" or not response.get("resource_limits_applied_before_backend_import"):
        raise SymbolicMathServiceError("isolated worker did not attest governed initialization")
    return response


def _record_computed_artifact(manifest: SymbolicMathOperationManifest, result: Mapping[str, Any]) -> Dict[str, Any]:
    service = symbolic_math_service_contract()
    service_hash = canonical_hash(service)
    dependency_ids = tuple(service["active_dependency_record_ids"])
    dependency_hashes = tuple(service["active_dependency_record_hashes"])
    if result.get("status") != "EXECUTED_VERIFIED" or not result.get("verification", {}).get("passed"):
        receipt = SymbolicMathNonDeliveryReceipt(
            reason_code=str(result.get("reason_code", "UNVERIFIED_OR_REFUSED_RESULT")),
            manifest_hash=manifest.manifest_hash(),
            detail=str(result.get("detail", "isolated computation was not verified")),
            operation_family=manifest.operation_family,
        )
        return {"status": "CONTAINED", "non_delivery_receipt": receipt.to_dict(), "non_delivery_receipt_hash": receipt.receipt_hash()}
    result_payload = result["result"]
    result_hash = canonical_hash(result_payload)
    execution = SymbolicMathExecutionReceipt(
        operation_id=manifest.operation_id,
        operation_family=manifest.operation_family,
        manifest_hash=manifest.manifest_hash(),
        service_contract_hash=service_hash,
        dependency_registry_hash=service["dependency_registry_hash"],
        active_dependency_record_ids=dependency_ids,
        active_dependency_record_hashes=dependency_hashes,
        result_hash=result_hash,
        backend=result["backend"],
        verification=result["verification"],
        worker_boundary=result["worker_boundary"],
    )
    pending = SymbolicMathPendingGovernanceReceipt(
        manifest_hash=manifest.manifest_hash(),
        execution_receipt_hash=execution.receipt_hash(),
        result_hash=result_hash,
        operation_family=manifest.operation_family,
        verification_strength=str(result["verification"]["strength"]),
    )
    return {
        "status": SUCCESS_STATUS,
        "capability_id": MATH001_CAPABILITY_ID,
        "service_id": MATH001_SERVICE_ID,
        "operation_manifest": manifest.to_dict(),
        "operation_manifest_hash": manifest.manifest_hash(),
        "computed_artifact": result_payload,
        "computed_artifact_hash": result_hash,
        "execution_receipt": execution.to_dict(),
        "execution_receipt_hash": execution.receipt_hash(),
        "pending_governance_receipt": pending.to_dict(),
        "pending_governance_receipt_hash": pending.receipt_hash(),
        "delivery_authorized": False,
        "render_allowed": False,
        "actual_echo_invoked": False,
        "required_delivery_authority": REQUIRED_DELIVERY_AUTHORITY,
    }


def execute_symbolic_math_operation(raw_manifest: Mapping[str, Any] | SymbolicMathOperationManifest) -> Dict[str, Any]:
    try:
        manifest = raw_manifest if isinstance(raw_manifest, SymbolicMathOperationManifest) else SymbolicMathOperationManifest.from_mapping(raw_manifest)
    except Exception as exc:
        receipt = SymbolicMathNonDeliveryReceipt(
            reason_code="MANIFEST_OR_AST_BOUNDARY_REFUSED",
            manifest_hash=_raw_hash(raw_manifest),
            detail=f"{type(exc).__name__}: {exc}",
        )
        return {"status": "CONTAINED", "non_delivery_receipt": receipt.to_dict(), "non_delivery_receipt_hash": receipt.receipt_hash()}
    try:
        response = _invoke_worker([manifest], batch=False)
        return _record_computed_artifact(manifest, response["results"][0])
    except Exception as exc:
        receipt = SymbolicMathNonDeliveryReceipt(
            reason_code="ISOLATED_WORKER_CONTAINMENT",
            manifest_hash=manifest.manifest_hash(),
            detail=f"{type(exc).__name__}: {exc}",
            operation_family=manifest.operation_family,
        )
        return {"status": "CONTAINED", "non_delivery_receipt": receipt.to_dict(), "non_delivery_receipt_hash": receipt.receipt_hash()}


def execute_symbolic_math_attestation_batch(raw_manifests: Sequence[Mapping[str, Any] | SymbolicMathOperationManifest]) -> List[Dict[str, Any]]:
    manifests = [m if isinstance(m, SymbolicMathOperationManifest) else SymbolicMathOperationManifest.from_mapping(m) for m in raw_manifests]
    if tuple(m.operation_family for m in manifests) != SUPPORTED_OPERATION_FAMILIES:
        raise SymbolicMathServiceError("attestation batch must cover all operation families in canonical order")
    response = _invoke_worker(manifests, batch=True)
    results = response.get("results", [])
    if len(results) != len(manifests):
        raise SymbolicMathServiceError("attestation worker returned incomplete result set")
    return [_record_computed_artifact(manifest, result) for manifest, result in zip(manifests, results)]


def symbolic_math_kernel_boundary() -> Dict[str, Any]:
    service = symbolic_math_service_contract()
    return {
        "build_id": MATH001_BUILD_ID,
        "schema_version": MATH001_SCHEMA_VERSION,
        "capability_id": MATH001_CAPABILITY_ID,
        "service_contract": service,
        "service_contract_hash": canonical_hash(service),
        "ast_boundary": symbolic_math_ast_boundary(),
        "isolated_worker_path": "rmc_engine_v1/general_pipeline/symbolic_math_worker.py",
        "resource_limits_applied_before_backend_import": True,
        "runtime_single_manifest_isolated": True,
        "attestation_batch_uses_one_resource_limited_isolated_worker": True,
        "computation_only_capability": True,
        "successful_operation_status": SUCCESS_STATUS,
        "direct_user_facing_delivery_authorized": False,
        "render_allowed": False,
        "actual_echo_invoked_by_kernel": False,
        "required_delivery_authority": REQUIRED_DELIVERY_AUTHORITY,
        "natural_language_compiler_added": False,
        "raw_mathematical_source_accepted": False,
        "writes_memory": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "mints_ct": False,
        "writes_ledgers": False,
        "ingests_corpus": False,
    }


__all__ = [
    "MATH001_SERVICE_ID", "MATH001_EXECUTION_SCHEMA", "MATH001_PENDING_GOVERNANCE_SCHEMA",
    "MATH001_NON_DELIVERY_SCHEMA", "SUCCESS_STATUS", "REQUIRED_DELIVERY_AUTHORITY",
    "SymbolicMathServiceError", "SymbolicMathExecutionReceipt",
    "SymbolicMathPendingGovernanceReceipt", "SymbolicMathNonDeliveryReceipt",
    "symbolic_math_service_contract", "execute_symbolic_math_operation",
    "execute_symbolic_math_attestation_batch", "symbolic_math_kernel_boundary",
]
