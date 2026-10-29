"""GP-008 — Manifest Contract v2 activation and boundary status surface.

This build adds the RMC-facing governed trace envelope required before the
production General Pipeline may render or Echo-deliver an answer. It modifies
neither the MEA ProblemManifest schema nor any persistent system state.
"""

from __future__ import annotations

from typing import Any, Dict

from . import gp007_strict_typed_ast as gp7
from .manifest_contract_v2 import (
    GP008_BUILD_ID,
    GP008_SCHEMA_VERSION,
    manifest_contract_v2_boundary,
)


def activate() -> Dict[str, Any]:
    gp7.activate()
    return status()


def status() -> Dict[str, Any]:
    return {
        "build_id": GP008_BUILD_ID,
        "schema_version": GP008_SCHEMA_VERSION,
        "manifest_contract_v2_boundary": manifest_contract_v2_boundary(),
        "gp007_status": gp7.status(),
    }


__all__ = ["activate", "status", "GP008_BUILD_ID", "GP008_SCHEMA_VERSION"]
