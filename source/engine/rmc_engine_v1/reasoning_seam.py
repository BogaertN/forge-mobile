"""Reasoning slot between memory recall and the output renderer.

4.9.183 does not reason. It returns the recalled memory unchanged.
4.9.184 replaces run_reasoning_seam with world-model Derive and an EchoForge
debate on the language core. The renderer reads derived_text only when
applied is true. No model is called from this module.
"""
from __future__ import annotations

import hashlib
from typing import Any


def run_reasoning_seam(question: str, memory: dict[str, Any] | None = None) -> dict[str, Any]:
    """Passthrough. The next build fills this function. Do not add a model here."""
    memory = dict(memory or {})
    count = int(memory.get("active_memory_count") or memory.get("active") or 0)
    return {
        "layer": "world_model",
        "slot": "reasoning",
        "status": "seam",
        "applied": False,
        "sits_after": "memory_recall",
        "sits_before": "output_renderer",
        "question_sha256_16": hashlib.sha256(str(question or "").encode("utf-8", errors="replace")).hexdigest()[:16],
        "input_memory_count": count,
        "output_memory_count": count,
        "derived_text": "",
        "memory": memory,
        "calls_llm": False,
        "writes_memory": False,
        "next_184": {
            "derive": "World-model Derive on the language core. Not implemented in 4.9.183.",
            "echoforge_debate": "EchoForge debate on the language core. Not implemented in 4.9.183.",
            "replaces": "rmc_engine_v1.reasoning_seam.run_reasoning_seam",
            "when_applied": "The renderer uses derived_text. Until then it renders admitted memory.",
        },
        "later_184": {
            "self_facts": "Self-facts live in the world model and are evolvable. Self-extension is a core function. Not implemented in 4.9.183.",
            "contract": "4.9.184 puts Derive and the EchoForge debate in this seam, between recall and the renderer. This passthrough is not that contract.",
        },
    }
