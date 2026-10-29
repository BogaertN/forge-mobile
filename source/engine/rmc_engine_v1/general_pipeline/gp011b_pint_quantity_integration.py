"""GP-011B activation/status surface for Pint-backed quantity/capacity reasoning."""
from __future__ import annotations

from importlib import metadata
from typing import Any, Dict

from . import gp010c_runtime_truth_reconciliation as gp010c
from .dependency_registry import dependency_boundary_contract, dependency_registry_hash
from .quantity_ast import quantity_ast_boundary_contract
from .quantity_adapters import safe_quantity_adapter_boundary_contract

GP011B_BUILD_ID = "GENERAL-PIPELINE-PINT-QUANTITY-CAPACITY-INTEGRATION-BUILD-GP-011B"
GP011B_SCHEMA_VERSION = "general_pipeline_pint_quantity_capacity_integration_v1_build_gp011b"

_NEW_INSTALLS = {
    "pint": "0.25.3",
    "flexcache": "0.3",
    "flexparser": "0.4",
    "platformdirs": "4.10.0",
}
_PROTECTED_REUSED = {"typing_extensions": "4.15.0"}

def installed_pint_distribution_versions() -> Dict[str, str]:
    names = sorted({**_NEW_INSTALLS, **_PROTECTED_REUSED})
    return {name: metadata.version(name) for name in names}

def verify_pint_installation_and_reuse_boundary() -> bool:
    expected = {**_NEW_INSTALLS, **_PROTECTED_REUSED}
    return installed_pint_distribution_versions() == {name: expected[name] for name in sorted(expected)}

def activate() -> Dict[str, Any]:
    gp010c.activate()
    if not verify_pint_installation_and_reuse_boundary():
        raise RuntimeError("GP-011B Pint or protected pre-existing dependency versions are not exact")
    return status()

def status() -> Dict[str, Any]:
    return {
        "build_id": GP011B_BUILD_ID,
        "schema_version": GP011B_SCHEMA_VERSION,
        "newly_installed_distribution_versions": {name: metadata.version(name) for name in sorted(_NEW_INSTALLS)},
        "protected_preexisting_reused_distribution_versions": {name: metadata.version(name) for name in sorted(_PROTECTED_REUSED)},
        "installation_exact": verify_pint_installation_and_reuse_boundary(),
        "dependency_registry_hash": dependency_registry_hash(),
        "dependency_boundary": dependency_boundary_contract(),
        "quantity_ast_boundary": quantity_ast_boundary_contract(),
        "safe_quantity_adapter_boundary": safe_quantity_adapter_boundary_contract(),
        "gp010c_status": gp010c.status(),
    }

__all__ = [
    "activate", "status", "installed_pint_distribution_versions",
    "verify_pint_installation_and_reuse_boundary", "GP011B_BUILD_ID", "GP011B_SCHEMA_VERSION",
]
