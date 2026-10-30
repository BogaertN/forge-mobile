"""Grok-1-style inference flow as a language-core function. No model.

Source
  Drive 1lVaKETZLqiKDD2TBtRXwngnbXKyYpWJ_Mcp0DPwAJck
  "Symbolic Developer Co-Pilot (Grok-Backed, Recursion-Tracked, Fully Local Runtime)".
  The model line is Grok-1. Phase 1 builds model_inference_server and confirms
  local Grok-1. Phase 2 connects the runtime to that model. Those calls are
  not ported.

What the forward step is now
  The next state is the next trusted, phase-aligned fact. A Doc 5 copula
  continues when the next karta is the current karma. Otherwise the next fact
  shares a Doc 4 concept with the question. Order is rounded grace, then the
  memory id. There is no sampling and no temperature.

Placement
  The co-pilot map puts model_inference_server in the core runtime, after
  memory and before the reply. Contract 1g2034-K §2 gives inference to the
  World Model. Contract §5 bounds the forward derivation. This function is
  that step. The orchestration Run calls it.
"""
from __future__ import annotations

from typing import Any

from rmc_engine_v1.resonance_recall import (
    _concept_ids,
    _frame_roles,
    _grace,
    _norm_role,
    _quarantined,
    clean_text,
)

CITE = (
    "Drive 1lVaKETZLqiKDD2TBtRXwngnbXKyYpWJ_Mcp0DPwAJck "
    "Symbolic Developer Co-Pilot, model_inference_server / Grok-1; "
    "the model host is not called. "
    "Contract 1g2034-K §2 World Model owns inference; §5 bounded forward derivation"
)

# Mobile budget inside the world-model MAX_ROUNDS ceiling.
# Recursive Agent Orchestration Manual Ch 6.3 fork budget, one question, one agent.
MAX_STEPS = 4


def _low_trust(node: dict[str, Any]) -> bool:
    trust = str(node.get("trust") or "").lower()
    source = str(node.get("source") or node.get("source_kind") or "").lower()
    url = str(node.get("url") or node.get("source_url") or "").lower()
    if trust == "low":
        return True
    if "wikipedia" in source or "wikipedia" in url or "wikimedia" in url:
        return True
    return _quarantined(node)


def _usable(node: dict[str, Any], question_phi: int) -> bool:
    if not isinstance(node, dict) or _low_trust(node):
        return False
    if not clean_text(node):
        return False
    packet = node.get("packet") if isinstance(node.get("packet"), dict) else None
    if not packet:
        return False
    grace = _grace(packet, question_phi)
    return bool(grace.get("aligned"))


def _sort_key(node: dict[str, Any], question_phi: int) -> tuple:
    packet = node.get("packet") if isinstance(node.get("packet"), dict) else {}
    grace = _grace(packet, question_phi)
    return (-round(float(grace.get("grace") or 0.0), 6), str(node.get("memory_id") or node.get("id") or ""))


def _copula_karma(node: dict[str, Any]) -> str:
    roles = _frame_roles(clean_text(node))
    if not roles or roles.get("predicate") != "is":
        return ""
    return _norm_role(str((roles.get("filled") or {}).get("karma") or ""))


def _copula_karta(node: dict[str, Any]) -> str:
    roles = _frame_roles(clean_text(node))
    if not roles or roles.get("predicate") != "is":
        return ""
    return _norm_role(str((roles.get("filled") or {}).get("karta") or ""))


def infer_step(current: dict[str, Any] | None, pool: list[dict[str, Any]], question: str, question_phi: int, seen: set[int]) -> dict[str, Any] | None:
    """One forward step. The Grok-1 sample is this selection. No model."""
    wanted = _copula_karma(current) if current else ""
    q_concepts = _concept_ids(question)
    ranked = [n for n in pool if id(n) not in seen and _usable(n, question_phi)]
    ranked.sort(key=lambda n: _sort_key(n, question_phi))
    for node in ranked:
        if wanted and _copula_karta(node) == wanted:
            return node
    if current is None:
        locked = [n for n in ranked if _shares_role(question, n)]
        if locked:
            return locked[0]
    if current is not None:
        cur_concepts = _concept_ids(clean_text(current))
        for node in ranked:
            nxt = _concept_ids(clean_text(node))
            shared = q_concepts & nxt & (cur_concepts or q_concepts)
            # A fact that names a concept the question did not ask is not the next state.
            if shared and not (nxt - q_concepts):
                return node
        return None
    for node in ranked:
        if q_concepts & _concept_ids(clean_text(node)):
            return node
    return None


def _shares_role(question: str, node: dict[str, Any]) -> bool:
    from rmc_engine_v1.resonance_recall import _role_hit, asked_filler
    asked = asked_filler(question)
    if not asked:
        return False
    return _role_hit(asked.get("filler") or "", clean_text(node)) is not None


def infer_chain(question: str, pool: list[dict[str, Any]], question_phi: int, *, max_steps: int = MAX_STEPS) -> dict[str, Any]:
    """The inference server. Bounded forward steps over phase-aligned facts."""
    steps = max(1, min(int(max_steps or MAX_STEPS), MAX_STEPS))
    seen: set[int] = set()
    hops: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    for n in range(steps):
        nxt = infer_step(current, pool, question, question_phi, seen)
        if nxt is None:
            break
        seen.add(id(nxt))
        text = clean_text(nxt)
        packet = nxt.get("packet") if isinstance(nxt.get("packet"), dict) else {}
        grace = _grace(packet, question_phi)
        hops.append({
            "n": n + 1,
            "memory_id": nxt.get("memory_id") or nxt.get("id"),
            "text": text,
            "grace": grace.get("grace"),
            "phi": (packet.get("sfe") or {}).get("Phi"),
            "eps": (packet.get("sfe") or {}).get("eps"),
            "mu": (packet.get("sfe") or {}).get("mu"),
            "trust": nxt.get("trust") or "trusted",
            "premise": True,
            "calls_llm": False,
        })
        current = nxt
    return {
        "function": "model_inference_server",
        "module": "language_core_grok_infer",
        "cite": CITE,
        "calls_llm": False,
        "model_invoked": False,
        "grok_1_called": False,
        "sampling": False,
        "max_steps": steps,
        "hops": hops,
        "halt": "no_next_fact" if len(hops) < steps else "budget",
    }
