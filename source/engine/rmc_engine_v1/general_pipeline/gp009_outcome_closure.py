"""GP-009 — Existing Domain Outcome Closure and Refusal Containment.

GP-008 already migrated successful GP-001/GP-002/GP-003 answers through the
shared Manifest Contract v2 delivery path. GP-009 completes the real remaining
migration boundary: all modeled non-delivery outcomes now return hash-bound,
in-memory containment receipts rather than untraced refusals.

This build adds no domain, dependency, persistence, corpus state, Identity
Vault action, contribution event, CT mint, or ledger write.
"""

from __future__ import annotations

from typing import Any, Dict

from . import gp008_manifest_contract_v2 as gp8
from .outcome_contract_v2 import (
    GP009_BUILD_ID,
    GP009_SCHEMA_VERSION,
    outcome_contract_v2_boundary,
)


def activate() -> Dict[str, Any]:
    gp8.activate()
    return status()


def status() -> Dict[str, Any]:
    return {
        "build_id": GP009_BUILD_ID,
        "schema_version": GP009_SCHEMA_VERSION,
        "outcome_contract_v2_boundary": outcome_contract_v2_boundary(),
        "gp008_status": gp8.status(),
    }


__all__ = ["activate", "status", "GP009_BUILD_ID", "GP009_SCHEMA_VERSION"]
