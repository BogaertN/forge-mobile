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

from rmc_engine_v1.resonance_recall import WH, _concept_ids, _frame_roles, _lexicon, _question_phi, asked_filler, place_packet

CITE = (
    "Drive 1jqKxPpoEBW5cigcpHvYj0OU_ir_9cV5fdCGZ_cVgXbQ "
    "PROTO – SYSTEM OVERVIEW, chat_controller.py handle_chat; "
    "the local model runner is not called"
)


# Doc 3 §18 function words. They are not content concepts. "can" names a
# capability question. "How are you?" has no capability modal, so it stays
# a self question about state.
_FUNCTION = {"can": "F.CAN", "could": "F.CAN"}
CHAT_ACTS = {"greeting", "request", "self", "capability"}


def chat_fact_act(speech: str, concepts: set[str] | None = None) -> str:
    """The world-model sentence for a chat act. Empty when the act is not one."""
    concepts = concepts or set()
    if speech == "greeting":
        return "greeting"
    if speech == "capability":
        return "capability"
    if speech == "request" and "A.TELL" in concepts:
        return "tell"
    if speech == "request":
        return "help"
    if speech == "self":
        return "self"
    return ""


def _speech_act(user_input: str, roles: dict[str, Any] | None) -> tuple[str, str]:
    """Name the act from the Doc 5 frame and the Doc 4 concept.

    A greeting, a help request, and a self question are not knowledge lookups.
    A turn whose content words are all outside the lexicon is a refusal.
    This does not match keywords with a regular expression.
    """
    from rmc_engine_v1.language_core_debate import uninterpreted_symbols
    from rmc_engine_v1.world_model_v1 import _STOP

    speech = "stated"
    head = ""
    filled = (roles or {}).get("filled") or {}
    karta = str(filled.get("karta") or "")
    parts = karta.strip().lower().split()
    if parts and parts[0] in WH:
        speech = parts[0]
        head = parts[0]
    concepts = _concept_ids(user_input)
    known = set(_STOP)
    known.update((_lexicon().get("surfaces") or {}).keys())
    symbols = uninterpreted_symbols(user_input, known_surfaces=known)
    words = [w.strip(".,;:!?\"'()[]").lower() for w in str(user_input or "").split()]
    words = [w for w in words if w]
    has_function = any(w in _STOP or len(w) <= 2 for w in words)
    if concepts & {"I.HELLO", "I.BYE", "I.THANKS"}:
        return "greeting", head
    if "A.HELP" in concepts or "A.TELL" in concepts:
        return "request", head
    if symbols and not concepts and not has_function:
        return "refusal", head
    content = [w for w in words if len(w) > 2 and w not in _STOP]
    functions = {_FUNCTION[w] for w in words if w in _FUNCTION}
    # A capability modal with no content word is not a feeling question.
    if "F.CAN" in functions and not content:
        return "capability", head
    if not content and speech == "stated":
        return "self", head
    return speech, head


def handle_chat(user_input: str, *, phase_report: dict[str, Any] | None = None) -> dict[str, Any]:
    """The Proto chat entry. The model call is the language core."""
    roles = _frame_roles(user_input)
    asked = asked_filler(user_input)
    speech, head = _speech_act(user_input, roles)
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
