"""General Learning-to-Answer Pipeline — GP-003 compatibility activation under GP-004.

The original GP-003 build introduced multi-step count-change word problems.
GP-004 preserves its public activation API while replacing chained source
compiler wrappers with a deterministic centralized capability registry.

activate() registers only cap.math.multi_step_count_change.v1. The central
source compiler sees all installed capabilities in priority/id order regardless
of activation order. Source text cannot install executable authority.

Boundaries remain in-memory only: no route, UI, LLM, file I/O, memory write,
Identity Vault write, corpus ingestion, CT, or ledger activity.
"""

from __future__ import annotations

from .domains_wordproblems import register as _register_domain

GP003_BUILD_ID = "GENERAL-LEARNING-TO-ANSWER-PIPELINE-MULTISTEP-WORDPROBLEMS-BUILD-GP-003"
GP003_SCHEMA_VERSION = "general_pipeline_v1_build_gp003"

_ACTIVATED = False


def activate() -> bool:
    """Register the existing GP-003 bounded capability. Idempotent."""
    global _ACTIVATED
    if _ACTIVATED:
        return False
    _register_domain()
    _ACTIVATED = True
    return True


def is_active() -> bool:
    return _ACTIVATED


__all__ = ["activate", "is_active", "GP003_BUILD_ID", "GP003_SCHEMA_VERSION"]
