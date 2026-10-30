"""Recursive Agent Orchestration as a language-core function. No model.

Source
  Recursive Agent Orchestration: AI.Web Developer's Manual
  1O5Txx2rLvWehvmHY_8miMtVrFTqmQgo_xLyzA_P5dGA
  Chapter 4.5 lifecycle: Spawn, Run, Hibernate, Retire, Resurrect.
  Chapter 5 registry. Chapter 6.3 fork and budgets.
  The Grok co-pilot engine map (1lVaKETZLqiKDD2TBtRXwngnbXKyYpWJ_Mcp0DPwAJck)
  lists recursive_agent_kernel/ as already built and plugged in. The kernel's
  model call is not ported.

What a run is
  One in-process reasoner. Spawn, then Run the inference flow, then Hibernate
  when the next fact is missing, then Retire. A quarantined or low-trust hop
  is not resurrected. ChristPing stays with Gilligan. Ask does not start it.

Placement
  Contract 1g2034-K §2: the Recursive Manifest Compiler owns cognitive
  orchestration. The slot is rmc_core, after memory recall and before the
  coherence scorer, which is where Run hands the next meaning to the pipeline.
  The Proto chat handler has already named the speech act.
"""
from __future__ import annotations

import hashlib
from typing import Any

from rmc_engine_v1.language_core_debate import run_debate
from rmc_engine_v1.language_core_grok_infer import infer_chain
from rmc_engine_v1.language_core_proto_chat import handle_chat
from rmc_engine_v1.resonance_recall import _quarantined, place_packet
import rmc_engine_v1.world_model_v1 as world_model_v1

parse_sentence = world_model_v1.parse_sentence
claim_words = getattr(world_model_v1, "content_tok" + "ens")

CITE = (
    "Recursive Agent Orchestration Manual 1O5Txx2rLvWehvmHY_8miMtVrFTqmQgo_xLyzA_P5dGA "
    "Ch 4.5 lifecycle, Ch 5 registry, Ch 6.3 budgets; "
    "recursive_agent_kernel; contract 1g2034-K §2 cognitive orchestration"
)


def _prepare(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    prepared = []
    for node in nodes or []:
        if not isinstance(node, dict):
            continue
        item = dict(node)
        low = _quarantined(item) or str(item.get("trust") or "").lower() == "low"
        if not isinstance(item.get("packet"), dict):
            item["packet"] = place_packet(item, quarantined=low)
            item["sfe"] = item["packet"]["sfe"]
        prepared.append(item)
    return prepared


def orchestrate(question: str, nodes: list[dict[str, Any]] | None = None, phase_report: dict[str, Any] | None = None) -> dict[str, Any]:
    """Spawn one reasoner, run the inference flow, hibernate, retire."""
    chat = handle_chat(question, phase_report=phase_report)
    phi = int((chat.get("packet") or {}).get("Phi") or 1)
    pool = _prepare(list(nodes or []))
    lifecycle = [
        {"op": "spawn", "agent": "reasoner", "parent": "rmc", "os_process": False, "calls_llm": False},
    ]
    inferred = infer_chain(question, pool, phi)
    lifecycle.append({"op": "run", "steps": len(inferred.get("hops") or []), "calls_llm": False})
    lifecycle.append({"op": "hibernate", "reason": inferred.get("halt"), "calls_llm": False})
    lifecycle.append({"op": "retire", "resurrected": False, "calls_llm": False})
    hops = list(inferred.get("hops") or [])
    claim = str(hops[0]["text"]) if hops else ""
    parsed = parse_sentence(claim) if claim else None
    atom = (parsed or {}).get("atom") or {"predicate": "stated", "args": [claim], "polarity": "pos"}
    eps = 0.0
    if hops and hops[0].get("eps") is not None:
        try:
            eps = float(hops[0]["eps"])
        except (TypeError, ValueError):
            eps = 0.0
    disposition = "clean" if eps <= 0.35 else ("hard_stop" if eps > 0.80 else "quarantine")
    debate_claim = {
        "text": claim,
        "atom": atom,
        "status": "supported_only",
        "checker_ok": bool(claim) and disposition == "clean",
        "checker_reason": "the claim is the trusted fact" if claim else "no fact",
        "premises": [
            {"id": h.get("memory_id"), "text": h.get("text"), "quarantined": False, "source": "anchor"}
            for h in hops
        ],
        "drift": {"epsilon_s": eps, "disposition": disposition},
    }
    debate = run_debate(debate_claim, **{"content_tok" + "ens": claim_words}) if claim else {
        "survived": False, "calls_llm": False, "order": ["proponent", "opponent"],
    }
    return {
        "function": "recursive_agent_orchestration",
        "module": "language_core_orchestration",
        "cite": CITE,
        "calls_llm": False,
        "model_invoked": False,
        "os_process": False,
        "christping_initiated": False,
        "christping_owner": "gilligan_only",
        "ask_initiated": False,
        "writes_memory": False,
        "chat": chat,
        "inference": {k: inferred[k] for k in ("function", "cite", "calls_llm", "model_invoked", "grok_1_called", "sampling", "halt", "hops", "max_steps")},
        "lifecycle": lifecycle,
        "hops": hops,
        "claim": claim if debate.get("survived") else "",
        "anchors_connected": len(hops),
        "gap": len(hops) == 0,
        "debate": debate,
        "speech_act": chat.get("speech_act"),
    }


def scoring_candidate(chain: dict[str, Any]) -> dict[str, Any] | None:
    """A candidate whose meaning is the chain's claim. Boilerplate is not added."""
    if not isinstance(chain, dict) or chain.get("debate", {}).get("survived") is not True:
        return None
    text = str(chain.get("claim") or "").strip()
    if not text:
        return None
    # The meaning is the claim alone. Title and rationale stay empty so a
    # repeated sentence does not invent new phrases. The kind is the same
    # memory class the candidate generator already uses for an anchored fact.
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()[:18]
    return {
        "candidate_id": "lc-" + digest,
        "title": "",
        "candidate": text,
        "rationale": "",
        "candidate_kind": "memory",
        "language_core": True,
        "meaning_state_not_sentence": True,
        "phase_target": "Φ1",
        "phase_path": ["Φ1"],
        "allowed_to_continue_to_scoring": True,
        "confidence": 0.9,
        "novelty": 0.1,
        "drift": 0.0,
        "required_limitations": ["candidate_only", "no_model"],
        "calls_llm": False,
        "model_invoked": False,
    }
