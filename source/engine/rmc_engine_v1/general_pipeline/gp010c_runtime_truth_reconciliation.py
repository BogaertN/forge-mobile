"""GP-010C runtime truth reconciliation activation/status surface."""
from __future__ import annotations
from typing import Any, Dict
from . import gp010b_audited_tool_activation as gp10b
from .runtime_truth_attestation_gp010c import GP010C_BUILD_ID, GP010C_SCHEMA_VERSION, runtime_truth_boundary

def activate() -> Dict[str, Any]:
    gp10b.activate()
    return status()

def status() -> Dict[str, Any]:
    return {"build_id": GP010C_BUILD_ID, "schema_version": GP010C_SCHEMA_VERSION, "runtime_truth_boundary": runtime_truth_boundary(), "gp010b_status": gp10b.status()}

__all__ = ["activate", "status", "GP010C_BUILD_ID", "GP010C_SCHEMA_VERSION"]
