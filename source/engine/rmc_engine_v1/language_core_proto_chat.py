"""Proto system chat handler as a language-core function. No model.

Source
  Drive 1jqKxPpoEBW5cigcpHvYj0OU_ir_9cV5fdCGZ_cVgXbQ
  "PROTO – SYSTEM OVERVIEW", section
  "chat_controller.py – Proto Chat Inference Pipeline".
  handle_chat built a prompt with build_context and called the local model
  runner. That call is not ported.
  POST /chat in the same overview is the conversation entry this replaces.

What this function does
  It reads the Doc 5 frame already returned by language_core_debate and the
  resonance packet {Phi, eps, mu}. It names the speech act. It does not build
  a model prompt, write chat history, or call a model.

Placement
  The overview puts handle_chat on the conversation entry. rmc_core.run is
  that entry, so this function runs first, before orchestration.
"""
from __future__ import annotations

from typing import Any

from rmc_engine_v1.resonance_recall import WH, _frame_roles, _question_phi, asked_filler, place_packet

CITE = (
    "Drive 1jqKxPpoEBW5cigcpHvYj0OU_ir_9cV5fdCGZ_cVgXbQ "
    "PROTO – SYSTEM OVERVIEW, chat_controller.py handle_chat; "
    "the local model runner is not called"
)


def handle_chat(user_input: str, *, phase_report: dict[str, Any] | None = None) -> dict[str, Any]:
    """The Proto chat entry. The model call is the language core."""
    roles = _frame_roles(user_input)
    asked = asked_filler(user_input)
    speech = "stated"
    head = ""
    filled = (roles or {}).get("filled") or {}
    karta = str(filled.get("karta") or "")
    parts = karta.strip().lower().split()
    if parts and parts[0] in WH:
        speech = parts[0]
        head = parts[0]
    phi = _question_phi(phase_report)
    packet = place_packet({"sfe": {"Phi": phi, "eps": 0.0, "mu": 1.0}}, quarantined=False)
    return {
        "function": "handle_chat",
        "module": "language_core_proto_chat",
        "cite": CITE,
        "calls_llm": False,
        "model_invoked": False,
        "local_runner": False,
        "prompt_built": False,
        "writes_memory": False,
        "speech_act": speech,
        "wh": head,
        "asked": asked,
        "frame": (roles or {}).get("frame"),
        "packet": packet,
        "input": str(user_input or ""),
    }
