"""GP-004 — General Pipeline Production Reground activation and boundary report.

This build does not add a new reasoning domain. It activates the already built
GP-002 and GP-003 bounded capabilities under the centralized registry and
exposes an inspectable boundary receipt for tests and operator review.
"""

from __future__ import annotations

from typing import Any, Dict

from . import gp002_linear_equations as gp2
from . import gp003_word_problems as gp3
from .capability_registry import (
    GP004_BUILD_ID,
    GP004_SCHEMA_VERSION,
    boundary_contract,
    registry_hash,
    registry_snapshot,
)


def activate() -> Dict[str, Any]:
    """Activate previously built extension domains through the central registry."""
    gp2.activate()
    gp3.activate()
    return status()


def status() -> Dict[str, Any]:
    return {
        "build_id": GP004_BUILD_ID,
        "schema_version": GP004_SCHEMA_VERSION,
        "boundary": boundary_contract(),
        "registry": registry_snapshot(),
        "registry_hash": registry_hash(),
        "gp002_active": gp2.is_active(),
        "gp003_active": gp3.is_active(),
    }


__all__ = [
    "activate",
    "status",
    "GP004_BUILD_ID",
    "GP004_SCHEMA_VERSION",
]
