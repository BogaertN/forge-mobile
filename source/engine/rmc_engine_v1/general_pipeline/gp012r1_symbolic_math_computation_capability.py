"""MATH-001R1 / GP-012R1 computation-only capability activation and status surface."""
from __future__ import annotations

from importlib import metadata
from typing import Any, Dict

from .symbolic_math_ast import MATH001_BUILD_ID, MATH001_CAPABILITY_ID, MATH001_SCHEMA_VERSION
from .symbolic_math_kernel import symbolic_math_kernel_boundary, symbolic_math_service_contract

_EXPECTED = {"sympy": "1.14.0", "mpmath": "1.3.0"}


def installed_symbolic_math_distribution_versions() -> Dict[str, str]:
    return {name: metadata.version(name) for name in sorted(_EXPECTED)}


def verify_symbolic_math_installation_boundary() -> bool:
    return installed_symbolic_math_distribution_versions() == {name: _EXPECTED[name] for name in sorted(_EXPECTED)}


def activate() -> Dict[str, Any]:
    if not verify_symbolic_math_installation_boundary():
        raise RuntimeError("MATH-001R1 requires the already-audited SymPy/mpmath runtime versions exactly")
    return status()


def status() -> Dict[str, Any]:
    return {
        "build_id": MATH001_BUILD_ID,
        "schema_version": MATH001_SCHEMA_VERSION,
        "capability_id": MATH001_CAPABILITY_ID,
        "installed_versions": installed_symbolic_math_distribution_versions(),
        "installation_exact": verify_symbolic_math_installation_boundary(),
        "service_contract": symbolic_math_service_contract(),
        "kernel_boundary": symbolic_math_kernel_boundary(),
    }


__all__ = [
    "activate", "status", "installed_symbolic_math_distribution_versions",
    "verify_symbolic_math_installation_boundary", "MATH001_BUILD_ID",
    "MATH001_SCHEMA_VERSION", "MATH001_CAPABILITY_ID",
]
