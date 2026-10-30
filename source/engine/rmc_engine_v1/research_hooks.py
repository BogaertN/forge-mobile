"""Named research hooks. One config.

M is the memory term. spc_lambda is the SPC decay step.
Both stay unparameterized. Values are pending research.
Set them here. Geometry and the RMC renderer read this object.
"""
from __future__ import annotations

from typing import Any

RESEARCH_HOOKS: dict[str, Any] = {
    "M": None,
    "spc_lambda": None,
}


def memory_term_m() -> Any:
    return RESEARCH_HOOKS["M"]


def spc_lambda() -> Any:
    return RESEARCH_HOOKS["spc_lambda"]
