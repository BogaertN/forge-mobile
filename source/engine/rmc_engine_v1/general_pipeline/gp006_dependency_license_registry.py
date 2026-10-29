"""GP-006 — Dependency and License Registry activation/status surface.

GP-006 established the initial review-only registry. GP-010B-R1 supersedes that temporary no-external-tool state by activating only audited Lark/SymPy services and Hypothesis verification through the same registry surface. This status module now exposes the truthful current authority state.
"""

from __future__ import annotations

from typing import Any, Dict

from . import gp005_capability_services as gp5
from .dependency_registry import (
    GP006_BUILD_ID,
    GP006_SCHEMA_VERSION,
    dependency_boundary_contract,
    dependency_registry_hash,
    dependency_registry_snapshot,
)


def activate() -> Dict[str, Any]:
    """Activate the prior service layer and expose GP-006 governance records."""
    gp5.activate()
    return status()


def status() -> Dict[str, Any]:
    return {
        "build_id": GP006_BUILD_ID,
        "schema_version": GP006_SCHEMA_VERSION,
        "boundary": dependency_boundary_contract(),
        "dependency_registry": dependency_registry_snapshot(),
        "dependency_registry_hash": dependency_registry_hash(),
        "gp005_status": gp5.status(),
    }


__all__ = ["activate", "status", "GP006_BUILD_ID", "GP006_SCHEMA_VERSION"]
