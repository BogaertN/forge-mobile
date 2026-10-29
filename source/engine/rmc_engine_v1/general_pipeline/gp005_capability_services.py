"""GP-005 — Capability Service Contracts activation and status surface.

GP-005 does not add a new reasoning domain. It activates the GP-004 registered
capability baseline, then exposes the immutable Forge-owned execution service
contracts derived from those installed capabilities.
"""

from __future__ import annotations

from typing import Any, Dict

from . import gp004_production_reground as gp4
from .capability_services import (
    GP005_BUILD_ID,
    GP005_SCHEMA_VERSION,
    service_boundary_contract,
    service_registry_hash,
    service_registry_snapshot,
)


def activate() -> Dict[str, Any]:
    """Activate the GP-004 capability baseline and expose GP-005 services."""
    gp4.activate()
    return status()


def status() -> Dict[str, Any]:
    return {
        "build_id": GP005_BUILD_ID,
        "schema_version": GP005_SCHEMA_VERSION,
        "boundary": service_boundary_contract(),
        "service_registry": service_registry_snapshot(),
        "service_registry_hash": service_registry_hash(),
    }


__all__ = ["activate", "status", "GP005_BUILD_ID", "GP005_SCHEMA_VERSION"]
