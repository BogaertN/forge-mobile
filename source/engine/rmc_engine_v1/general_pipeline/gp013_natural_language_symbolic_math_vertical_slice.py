"""NL-MATH-001 / GP-013 — activation boundary for the first complete math-language slice."""
from __future__ import annotations

from typing import Any, Dict

from .symbolic_math_language_compiler import BUILD_ID, language_compiler_boundary
from .symbolic_math_mea_evidence_bridge import mea_symbolic_math_evidence_bridge_boundary
from .symbolic_math_rmc_delivery import symbolic_math_renderer_boundary
from .symbolic_math_language_vertical_slice import (
    natural_language_symbolic_math_vertical_slice_boundary,
    attest_natural_language_symbolic_math_vertical_slice,
)


def activate() -> Dict[str, Any]:
    """Expose installed scope without performing a user question or any write."""
    return {
        "build_id": BUILD_ID,
        "language_compiler": language_compiler_boundary(),
        "mea_evidence_bridge": mea_symbolic_math_evidence_bridge_boundary(),
        "rmc_renderer_echo_binding": symbolic_math_renderer_boundary(),
        "vertical_slice": natural_language_symbolic_math_vertical_slice_boundary(),
        "active": True,
        "computation_backend_preexisting": "cap.math.symbolic_math.v1",
        "actual_echo_delivery_required": True,
        "corpus_ingestion_added": False,
        "calls_llm": False,
        "writes_memory": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "mints_ct": False,
        "writes_ledgers": False,
    }


def attest() -> Dict[str, Any]:
    return attest_natural_language_symbolic_math_vertical_slice()


__all__ = ["activate", "attest"]
