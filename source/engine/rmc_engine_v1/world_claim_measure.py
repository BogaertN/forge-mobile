"""4.9.234 (plan 229 step 6): RMC and the world model in series.

The orchestrator's RMC pass (coherence, epsilon, route) runs first and is handed to the
world model as its upstream reading. When the world model speaks a derived chain, the
sentence it speaks is measured by the same kernel (measurement_kernel.measure_candidate
and coherence_components), routed by the same containment router, and that reading is
what the Ask gate scores. The orchestrator's other candidate is no longer scored in its place.

A chain is its hops. Each spoken hop is a recalled fact, measured against its own memory row
(the language core measures a recalled fact the same way). The chain's C is its weakest hop.
The conclusion is not a recalled fact: it is admitted by the checker's replay of those hops,
and its drift is measured and gated like every other sentence. Its own lexical C is reported.
The chain's epsilon is the largest epsilon of any spoken sentence. No threshold is read here.
No model is called.
"""
from __future__ import annotations

import hashlib
import re
from typing import Any

from rmc_engine_v1.measurement_kernel import coherence_components, measure_candidate

CITE = "source/engine/rmc_engine_v1/world_claim_measure.py measure_spoken"


def _norm(text: Any) -> str:
    return " ".join(re.sub(r"[^a-z0-9 ]+", " ", str(text or "").lower()).split())


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", str(text or "").strip()) if s.strip()]


def _digest(text: str) -> str:
    return hashlib.sha256(str(text).encode("utf-8", errors="replace")).hexdigest()[:16]


def upstream_reading(coherence_report: dict[str, Any], routing_packet: dict[str, Any], route_result: dict[str, Any]) -> dict[str, Any]:
    """The RMC pass that runs before the world model: its C, epsilon, route and phase path."""
    selected = coherence_report.get("selected_scored_candidate_preview") if isinstance(coherence_report.get("selected_scored_candidate_preview"), dict) else {}
    parts = selected.get("score_components") if isinstance(selected.get("score_components"), dict) else {}
    drift = selected.get("measured_evolutionary_drift") if isinstance(selected.get("measured_evolutionary_drift"), dict) else {}
    try:
        c_value = float(parts.get("coherence_score") if parts.get("coherence_score") is not None else selected.get("coherence_score") or 0.0)
    except (TypeError, ValueError):
        c_value = 0.0
    try:
        eps = float(drift.get("epsilon_s") if drift.get("epsilon_s") is not None else routing_packet.get("epsilon_s") or 0.0)
    except (TypeError, ValueError):
        eps = 0.0
    return {
        "candidate_id": selected.get("candidate_id"),
        "C": round(c_value, 6),
        "epsilon_s": round(eps, 6),
        "route": route_result.get("route"),
        "phase_path": list(routing_packet.get("phase_path") or []),
        "circuit_breaker": bool(drift.get("circuit_breaker")),
        "cite": "deep_dry_run_orchestrator coherence_scorer + containment_router (RMC, before the world model)",
    }


def _premise_node(premise: dict[str, Any], row: dict[str, Any] | None, alignment: dict[str, Any]) -> dict[str, Any]:
    """The recalled row as the kernel reads a memory node. Every number is the row's own reading."""
    row = row or {}
    weight = row.get("retrieval_weight")
    weight_basis = "recall.retrieval_weight"
    if weight is None:
        # A row resonance did not lock carries no recall weight. Its measured resonance with this
        # question (grace = rpm x cos^2 of the phase gap, resonance_recall._grace) is the weight.
        weight_basis = "resonance_recall._grace"
        weight = None
        packet = row.get("packet") if isinstance(row.get("packet"), dict) else None
        qphi = alignment.get("question_phi")
        if packet is not None and qphi is not None:
            try:
                from rmc_engine_v1.resonance_recall import _grace
                weight = _grace(packet, qphi).get("grace")
            except Exception:
                weight = None
        if weight is None:
            weight = alignment.get("grace")
            weight_basis = "derive.alignment.grace"
    return {
        "memory_id": row.get("memory_id") or premise.get("id"),
        "content": str(premise.get("text") or row.get("content") or "").strip(),
        # The receipt path is ancestry, not compared text (resonance_recall clears these the same way).
        "content_summary": "",
        "summary": "",
        "memory_role": "",
        "source": "",
        "source_path": "",
        "chunk_id": "",
        "symbolic_signature": "",
        "ancestry": row.get("ancestry") or {"premise": premise.get("id")},
        "confidence": "low" if premise.get("quarantined") else (row.get("confidence") or "medium"),
        "retrieval_weight": float(weight or 0.0),
        "retrieval_weight_basis": weight_basis,
        "prior_drift_score": row.get("prior_drift_score") or 0.0,
        "phase_tags": list(row.get("phase_tags") or []),
        "packet": row.get("packet") if isinstance(row.get("packet"), dict) else None,
    }


def _measure(text: str, kind: str, nodes: list[dict[str, Any]], phase_path: list[Any]) -> dict[str, Any]:
    path = [p for p in (phase_path or []) if p] or ["Φ1"]
    candidate = {
        "candidate_id": "wm-" + _digest(text)[:12],
        "title": "",
        "candidate": text,
        "rationale": "",
        "candidate_kind": kind,
        "phase_path": path,
        "phase_target": path[-1],
    }
    measured = measure_candidate(
        candidate, {}, memory_nodes=nodes,
        phase_state={"phase_path_hypothesis": path, "phase_primary": path[0]},
    )
    parts = coherence_components(candidate, measured)
    return {"candidate": candidate, "measured": measured, "parts": parts}


def _route(reading: dict[str, Any], trace_spine: dict[str, Any], structural_drift: dict[str, Any], pf2_preview: dict[str, Any], coherence_report: dict[str, Any]) -> dict[str, Any]:
    from rmc_engine_v1.containment_router import route_candidate
    from rmc_engine_v1.deep_dry_run_orchestrator import _merge_routing_packet
    selected = {
        "candidate_id": reading["candidate_id"],
        "phase_path": reading["phase_path"],
        "coherence_score": reading["C"],
        "score_components": {"coherence_score": reading["C"]},
        "measured_evolutionary_drift": {"epsilon_s": reading["epsilon_s"], "circuit_breaker": reading["circuit_breaker"]},
    }
    packet = _merge_routing_packet(selected, trace_spine, structural_drift, pf2_preview, coherence_report)
    result = route_candidate(packet)
    return result if isinstance(result, dict) else {}


def measure_spoken(
    reasoning: dict[str, Any],
    observe_rows: list[dict[str, Any]],
    phase_path: list[Any],
    upstream: dict[str, Any],
    *,
    trace_spine: dict[str, Any] | None = None,
    structural_drift: dict[str, Any] | None = None,
    pf2_preview: dict[str, Any] | None = None,
    coherence_report: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """The kernel reading of the sentence the world model speaks, or None when it speaks no derived chain."""
    if not isinstance(reasoning, dict) or reasoning.get("applied") is not True:
        return None
    spoken = str(reasoning.get("derived_text") or "").strip()
    derive = reasoning.get("derive") if isinstance(reasoning.get("derive"), dict) else {}
    survivor = derive.get("survivor") if isinstance(derive.get("survivor"), dict) else None
    status = str(derive.get("status") or "")
    if not spoken or survivor is None or status in {"conflicted", "undetermined", ""}:
        return None
    premises = [p for p in (survivor.get("premises") or []) if isinstance(p, dict)]
    if not premises:
        return None
    by_id = {str(r.get("memory_id")): r for r in observe_rows or [] if isinstance(r, dict) and r.get("memory_id")}
    # A row resonance locked carries recall's own measured weight on its active node; that reading wins.
    recall_state = ((trace_spine or {}).get("memory_recall") or {}).get("memory_state") or {}
    for node in recall_state.get("active_memory_nodes") or []:
        if isinstance(node, dict) and node.get("memory_id") and node.get("retrieval_weight") is not None:
            mid = str(node["memory_id"])
            base = by_id.get(mid) or {}
            by_id[mid] = dict(node, **{k: v for k, v in base.items() if k not in node})
    # Observe keeps one copy of a repeated sentence; the other copies are the same premise read from another row.
    by_text: dict[str, list[dict[str, Any]]] = {}
    for r in by_id.values():
        by_text.setdefault(_norm(str(r.get("content_summary") or r.get("content") or "")), []).append(r)
    alignment = survivor.get("alignment") if isinstance(survivor.get("alignment"), dict) else {}
    nodes = []
    for premise in premises:
        # The same sentence can arrive as several rows (Observe merges them); the row recall measured wins.
        rows = [by_id[str(pid)] for pid in list(premise.get("provenance") or []) + [str(premise.get("id") or "").split(":")[0]] if str(pid) in by_id]
        rows += [r for r in by_text.get(_norm(str(premise.get("text") or "")), []) if r not in rows]
        weighed = [r for r in rows if r.get("retrieval_weight") is not None]
        row = max(weighed, key=lambda r: float(r.get("retrieval_weight") or 0.0)) if weighed else (rows[0] if rows else None)
        nodes.append(_premise_node(premise, row, alignment))
    premise_by_text = {_norm(n["content"]): n for n in nodes if n["content"]}
    sentences = []
    for sentence in _sentences(spoken):
        own = premise_by_text.get(_norm(sentence))
        if own is not None:
            role, kind, support = "hop", "memory", [own]
        else:
            role, kind, support = "conclusion", "derived_claim", nodes
        m = _measure(sentence, kind, support, phase_path)
        measured, parts = m["measured"], m["parts"]
        sentences.append({
            "text": sentence,
            "role": role,
            "candidate_kind": kind,
            "support": [n["memory_id"] for n in support],
            "C": parts.get("coherence_score"),
            "epsilon_s": measured.get("epsilon_s"),
            "D_score": measured.get("D_score"),
            "sigma_res": measured.get("sigma_res"),
            "delta_phi": (measured.get("phase_metrics") or {}).get("max_delta_phi"),
            "circuit_breaker": bool(measured.get("circuit_breaker")),
            "bounded": bool(measured.get("bounded_evolutionary_drift")),
            "phase_ok": bool((measured.get("phase_metrics") or {}).get("phase_path_legal")),
            "components": {k: parts.get(k) for k in (
                "memory_fit", "phase_validity", "drift_containment", "source_confidence", "utility_fit",
                "bounded_novelty_score", "operator_legality", "conflict_penalty", "projection_gate_penalty", "coherence_score",
            )},
            "formula": parts.get("formula"),
            "drift_terms": {k: measured.get(k) for k in ("entropy_norm", "structure_delta", "semantic_distance", "taxonomy_penalty")},
        })
    hops = [s for s in sentences if s["role"] == "hop"]
    conclusion = [s for s in sentences if s["role"] == "conclusion"]
    if not hops:
        return None
    weakest = min(hops, key=lambda s: float(s["C"] or 0.0))
    eps = max(float(s["epsilon_s"] or 0.0) for s in sentences)
    breaker = any(s["circuit_breaker"] for s in sentences)
    path = [p for p in (phase_path or []) if p] or ["Φ1"]
    reading = {
        "candidate_id": "wm-" + _digest(spoken)[:12],
        "spoken": spoken,
        "C": round(float(weakest["C"] or 0.0), 6),
        "C_rule": "min over spoken hops (each hop against its own recalled row)",
        "epsilon_s": round(eps, 6),
        "epsilon_rule": "max over every spoken sentence, the conclusion included",
        "sigma_res": max(float(s["sigma_res"] or 0.0) for s in sentences),
        "circuit_breaker": breaker,
        "phase_path": path,
        "phase_ok": all(s["phase_ok"] for s in sentences),
        "checker_ok": bool(survivor.get("checker_ok")),
        "checker_reason": survivor.get("checker_reason"),
        "proof_id": survivor.get("proof_id"),
        "weakest_hop": weakest["text"],
        "weakest_components": weakest["components"],
        "conclusion": conclusion[0] if conclusion else None,
        "sentences": sentences,
        "premises": [{k: n.get(k) for k in ("memory_id", "content", "confidence", "retrieval_weight", "retrieval_weight_basis", "phase_tags")} for n in nodes],
        "upstream": dict(upstream or {}),
        # The kernel's own formula string (measurement_kernel.coherence_components); the weights are unchanged.
        "formula": weakest.get("formula") or "measurement_kernel.coherence_components",
        "calls_llm": False,
        "cite": CITE,
    }
    if not reading["checker_ok"]:
        # An unreplayed conclusion is not admitted by its hops.
        reading["C"] = 0.0
        reading["C_rule"] = "checker did not replay the conclusion"
    if trace_spine is not None:
        route = _route(reading, trace_spine, structural_drift or {}, pf2_preview or {}, coherence_report or {})
        reading["route"] = route.get("route")
        reading["route_reason_codes"] = route.get("reason_codes") or []
        reading["route_result"] = route
    return reading
