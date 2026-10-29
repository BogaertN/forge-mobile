"""General Learning-to-Answer Pipeline — GP-002 compatibility activation under GP-004.

The original GP-002 build introduced one-variable linear equations. GP-004
preserves its public activation API while replacing compiler monkey-patching
with the centralized bounded capability registry.

activate() now does one thing:
  Register cap.math.linear_equation_one_unknown.v1.

The central source compiler reads installed contracts deterministically, so
activation order no longer changes compiler behavior. Source text cannot
register a capability. Boundaries remain in-memory only: no route, UI, LLM,
file I/O, memory write, Identity Vault write, CT, or ledger activity.
"""

from __future__ import annotations

from .domains_equations import register as _register_domain

GP002_BUILD_ID = "GENERAL-LEARNING-TO-ANSWER-PIPELINE-LINEAR-EQUATIONS-BUILD-GP-002"
GP002_SCHEMA_VERSION = "general_pipeline_v1_build_gp002"

_ACTIVATED = False


def activate() -> bool:
    """Register the existing GP-002 bounded capability. Idempotent."""
    global _ACTIVATED
    if _ACTIVATED:
        return False
    _register_domain()
    _ACTIVATED = True
    return True


def is_active() -> bool:
    return _ACTIVATED


__all__ = ["activate", "is_active", "GP002_BUILD_ID", "GP002_SCHEMA_VERSION"]
