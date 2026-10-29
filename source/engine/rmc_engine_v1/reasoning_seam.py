"""Reasoning slot between memory recall and the output renderer.

4.9.184 replaces the passthrough. run_reasoning_seam is
world-model Observe and Derive, then the EchoForge debate on the language
core. The renderer reads derived_text only when a claim survived that debate.
No model is called. Simulate stays deferred. ChristPing is not started.
"""
from __future__ import annotations

from typing import Any

from rmc_engine_v1.world_model_v1 import run_world_model


def run_reasoning_seam(question: str, memory: dict[str, Any] | None = None) -> dict[str, Any]:
    """Observe, Derive, debate. Spec 1vBx_Q9K §1.4. Contract 1g2034-K §6."""
    return run_world_model(question, memory)
