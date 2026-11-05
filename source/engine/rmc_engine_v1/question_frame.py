"""The Ask's kāraka frame (plan 229 steps 1-2, v4.9.230).

The phone compiles the question with its own grammar (src/qframe.js) and sends the frame in the
payload. One Ask turn holds it in a context variable so every layer that reads the question
(handle_chat, the world model's chat derivation) reads the same frame. Each reader records that it
used it, so the trace shows which layers the frame reached. No model; nothing here answers.
"""
from __future__ import annotations

import contextvars
from typing import Any

SCHEMA = "forge.qframe/v1"
# The engine's own speech-act names (language_core_proto_chat._speech_act). A frame act outside
# this set is recorded but not used, so the engine keeps its own reading.
ENGINE_ACTS = frozenset({
    "stated", "greeting", "request", "refusal", "capability", "self",
    "what", "who", "whom", "whose", "which", "where", "when", "why", "how",
})

_FRAME: contextvars.ContextVar[dict[str, Any] | None] = contextvars.ContextVar("forge_qframe", default=None)
_USES: contextvars.ContextVar[list[dict[str, Any]] | None] = contextvars.ContextVar("forge_qframe_uses", default=None)


def valid(frame: Any, question: str) -> bool:
    """A frame counts only when it is the phone's schema and was compiled from this question."""
    if not isinstance(frame, dict) or frame.get("schema") != SCHEMA:
        return False
    return str(frame.get("text") or "").strip() == str(question or "").strip()


def begin(frame: Any, question: str) -> tuple[Any, Any]:
    f = frame if valid(frame, question) else None
    return _FRAME.set(f), _USES.set([])


def end(tokens: tuple[Any, Any]) -> None:
    _FRAME.reset(tokens[0])
    _USES.reset(tokens[1])


def current() -> dict[str, Any] | None:
    return _FRAME.get()


def speech_act(question: str) -> str | None:
    """The frame's act when the frame parsed and the act is one the engine knows."""
    f = current()
    if not f or str(f.get("text") or "").strip() != str(question or "").strip():
        return None
    act = f.get("speech_act")
    if not (f.get("parsed") or (f.get("partial") and f.get("kartr"))) or act not in ENGINE_ACTS:
        return None
    return str(act)


def note(consumer: str, **info: Any) -> None:
    uses = _USES.get()
    if uses is not None:
        uses.append(dict({"consumer": consumer}, **info))


def summary(frame: Any, question: str) -> dict[str, Any]:
    ok = valid(frame, question)
    f = frame if isinstance(frame, dict) else {}
    keep = ("speech_act", "mood", "wh", "wh_role", "aux", "parsed", "rule", "declarative", "kriya", "acts", "act_rest", "canonical",
            "kartr", "karma", "pred", "cond", "conditional", "polar", "parses")
    return {
        "schema": SCHEMA,
        "received": bool(frame),
        "valid": ok,
        "frame": {k: f.get(k) for k in keep if k in f} if ok else None,
        "uses": list(_USES.get() or []),
        "calls_llm": False,
    }
