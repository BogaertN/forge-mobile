"""GP-007 — Strict Typed AST and Safe Solver Adapter Boundary status surface.

GP-007 established the typed-AST/safe-adapter socket. GP-010B-R1 activates audited Lark parsing and SymPy exact solving inside that socket without adding a new domain or bypassing Forge gates. This module now reports the truthful current backend state.
"""

from __future__ import annotations

from typing import Any, Dict

from . import gp006_dependency_license_registry as gp6
from .typed_ast import GP007_BUILD_ID, GP007_SCHEMA_VERSION, typed_ast_boundary_contract
from .safe_solver_adapters import safe_solver_adapter_boundary_contract


def activate() -> Dict[str, Any]:
    gp6.activate()
    return status()


def status() -> Dict[str, Any]:
    return {
        "build_id": GP007_BUILD_ID,
        "schema_version": GP007_SCHEMA_VERSION,
        "typed_ast_boundary": typed_ast_boundary_contract(),
        "safe_solver_adapter_boundary": safe_solver_adapter_boundary_contract(),
        "gp006_status": gp6.status(),
    }


__all__ = ["activate", "status", "GP007_BUILD_ID", "GP007_SCHEMA_VERSION"]
