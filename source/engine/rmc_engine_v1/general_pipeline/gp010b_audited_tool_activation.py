"""GP-010B-R1 audited tool activation status surface.

This is the transition that installs and actively binds the audited Lark and
SymPy tools into the existing governed equation socket, while authorizing
Hypothesis exclusively for boundary verification.
"""
from __future__ import annotations
from importlib import metadata
from typing import Any, Dict
from . import gp009_outcome_closure as gp9
from .dependency_registry import GP010B_BUILD_ID, GP010B_SCHEMA_VERSION, dependency_boundary_contract, dependency_registry_hash, dependency_registry_snapshot
from .typed_ast import typed_ast_boundary_contract
from .safe_solver_adapters import safe_solver_adapter_boundary_contract
_EXPECTED = {"lark": "1.3.1", "sympy": "1.14.0", "hypothesis": "6.155.1", "mpmath": "1.3.0", "sortedcontainers": "2.4.0"}
def installed_distribution_versions() -> Dict[str, str]:
    return {name: metadata.version(name) for name in sorted(_EXPECTED)}
def verify_installed_distributions() -> bool:
    return installed_distribution_versions() == {name: _EXPECTED[name] for name in sorted(_EXPECTED)}
def activate() -> Dict[str, Any]:
    gp9.activate()
    if not verify_installed_distributions():
        raise RuntimeError("GP-010B audited dependency versions are not installed exactly")
    return status()
def status() -> Dict[str, Any]:
    return {"build_id": GP010B_BUILD_ID, "schema_version": GP010B_SCHEMA_VERSION, "installed_versions": installed_distribution_versions(), "installation_exact": verify_installed_distributions(), "dependency_boundary": dependency_boundary_contract(), "dependency_registry_hash": dependency_registry_hash(), "dependency_registry": dependency_registry_snapshot(), "typed_ast_boundary": typed_ast_boundary_contract(), "safe_solver_boundary": safe_solver_adapter_boundary_contract(), "gp009_status": gp9.status()}
__all__ = ["activate", "status", "installed_distribution_versions", "verify_installed_distributions", "GP010B_BUILD_ID", "GP010B_SCHEMA_VERSION"]
