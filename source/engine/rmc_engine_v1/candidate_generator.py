"""RMC Candidate Conclusion Generator v1.

Patch 262J1R-Preflight-C adds the next real RMC application stage after
Input Event, Phase Parser, Memory Recaller, and Drift Analyzer.

This module generates C_t: candidate meaning states. It does not render final
language, approve output, write memory, mutate datasets, query Chroma, execute
shell, call an LLM, or touch Identity Vault.

Core law:
    A conclusion is not a sentence.
    A candidate is a possible next state of meaning.
    Candidate generation is exploration, not approval.
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import json
from typing import Any

ENGINE_VERSION = "rmc_candidate_generator_v2_patch262J1R_preflight_C13"
ENGINE_MODE = "read_only_candidate_meaning_state_generation"
PHASES = [f"Φ{i}" for i in range(1, 10)]


def _utc_now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()


def _sha(obj: Any) -> str:
    try:
        payload = json.dumps(obj, sort_keys=True, ensure_ascii=False, default=str)
    except Exception:
        payload = str(obj)
    return hashlib.sha256(payload.encode("utf-8", errors="replace")).hexdigest()


def _stable_id(prefix: str, obj: Any, n: int = 18) -> str:
    return f"{prefix}_{_sha(obj)[:n]}"


def _clamp(value: Any, low: float = 0.0, high: float = 1.0) -> float:
    try:
        v = float(value)
    except Exception:
        v = 0.0
    return max(float(low), min(float(high), v))


def _as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if value in (None, "", {}):
        return []
    return [value]


def _phase_index(phase: Any) -> int | None:
    s = str(phase or "")
    for i in range(1, 10):
        if f"Φ{i}" in s or s.strip() == str(i):
            return i
    return None


def candidate_generator_boundary() -> dict[str, Any]:
    return {
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "engine_module_location": "forge/rmc_engine_v1/candidate_generator.py",
        "implements_rmc_stage": "Candidate Conclusion Generator / C_t",
        "input_contract": "read_only_trace_spine_through_memory_recaller",
        "output_contract": "candidate_meaning_states_not_final_language",
        "calls_llm": False,
        "queries_chroma": False,
        "reads_db_files": False,
        "executes_shell": False,
        "writes_files": False,
        "writes_rmc_memory": False,
        "writes_identity_vault": False,
        "mutates_canonical_reference": False,
        "renders_final_language": False,
        "approved_output": False,
        "projection_allowed": False,
        "memory_write_allowed": False,
        "uses_measurement_kernel": True,
        "overextension_gate": "candidate_novelty_delta_must_not_exceed_task_N_max_before_normal_scoring",
        "overextension_policy": "mark_overextended_and_route_to_review_or_archive_not_normal_candidate",
        "real_readings_attached": [
            "token_count",
            "entropy_norm",
            "semantic_distance",
            "memory_fit",
            "phase_delta",
            "sigma_res",
            "D_score",
            "epsilon_s",
            "novelty_delta",
            "bounded_evolutionary_drift",
        ],
        "note": "Candidates are possible next states of meaning. C2R attaches real measurement-kernel readings; candidates still require coherence scoring, correction/naming gates, manifest compilation, rendering, echo validation, and memory writer before any approval.",
    }


def _trace_id(trace_spine: dict[str, Any]) -> str:
    symbolic = trace_spine.get("symbolic_trace") if isinstance(trace_spine, dict) else {}
    if isinstance(symbolic, dict) and symbolic.get("trace_id"):
        return str(symbolic.get("trace_id"))
    input_event = trace_spine.get("input_event") if isinstance(trace_spine, dict) else {}
    if isinstance(input_event, dict) and input_event.get("event_id"):
        return str(input_event.get("event_id"))
    return _stable_id("rmctrace_unknown", trace_spine)


def _phase_state(trace_spine: dict[str, Any]) -> dict[str, Any]:
    symbolic = trace_spine.get("symbolic_trace") if isinstance(trace_spine, dict) else {}
    if isinstance(symbolic, dict) and isinstance(symbolic.get("Φ_t"), dict):
        return dict(symbolic.get("Φ_t") or {})
    phase_report = trace_spine.get("phase_report") if isinstance(trace_spine, dict) else {}
    if isinstance(phase_report, dict):
        if isinstance(phase_report.get("phase_state"), dict):
            return dict(phase_report.get("phase_state") or {})
        return dict(phase_report)
    return {}


def _input_event(trace_spine: dict[str, Any]) -> dict[str, Any]:
    symbolic = trace_spine.get("symbolic_trace") if isinstance(trace_spine, dict) else {}
    if isinstance(symbolic, dict) and isinstance(symbolic.get("I_t"), dict):
        return dict(symbolic.get("I_t") or {})
    event = trace_spine.get("input_event") if isinstance(trace_spine, dict) else {}
    return dict(event or {}) if isinstance(event, dict) else {}


def _drift_state(trace_spine: dict[str, Any]) -> dict[str, Any]:
    drift = trace_spine.get("drift_report") if isinstance(trace_spine, dict) else {}
    if isinstance(drift, dict) and drift:
        return drift
    symbolic = trace_spine.get("symbolic_trace") if isinstance(trace_spine, dict) else {}
    if isinstance(symbolic, dict) and isinstance(symbolic.get("D_t"), dict):
        return dict(symbolic.get("D_t") or {})
    return {}


def _memory_nodes(trace_spine: dict[str, Any]) -> list[dict[str, Any]]:
    symbolic = trace_spine.get("symbolic_trace") if isinstance(trace_spine, dict) else {}
    if isinstance(symbolic, dict):
        m_t = symbolic.get("M_t") or {}
        if isinstance(m_t, dict) and isinstance(m_t.get("active_memory_nodes"), list):
            return [n for n in m_t.get("active_memory_nodes") if isinstance(n, dict)]
    recall = trace_spine.get("memory_recall") if isinstance(trace_spine, dict) else {}
    if isinstance(recall, dict):
        state = recall.get("memory_state") or {}
        if isinstance(state, dict) and isinstance(state.get("active_memory_nodes"), list):
            return [n for n in state.get("active_memory_nodes") if isinstance(n, dict)]
    return []


def _phase_vector(trace_spine: dict[str, Any]) -> dict[str, float]:
    resonance = trace_spine.get("resonance_summary") if isinstance(trace_spine, dict) else {}
    if isinstance(resonance, dict) and isinstance(resonance.get("phase_vector"), dict):
        return {str(k): _clamp(v) for k, v in resonance.get("phase_vector", {}).items()}
    return {}


def _epsilon(drift: dict[str, Any]) -> float:
    eps = drift.get("epsilon_s") if isinstance(drift, dict) else None
    if isinstance(eps, dict):
        return _clamp(eps.get("epsilon_s", 0.0))
    return _clamp(eps)


def _circuit_breaker(trace_spine: dict[str, Any], drift: dict[str, Any]) -> bool:
    cb = drift.get("circuit_breaker") if isinstance(drift, dict) else {}
    if isinstance(cb, dict) and bool(cb.get("triggered")):
        return True
    resonance = trace_spine.get("resonance_summary") if isinstance(trace_spine, dict) else {}
    if isinstance(resonance, dict) and bool(resonance.get("circuit_breaker_candidate")):
        return True
    status = str(drift.get("projection_status") or "").lower() if isinstance(drift, dict) else ""
    if "circuit" in status or "blocked_circuit" in status:
        return True
    return False


def _drift_classes(drift: dict[str, Any]) -> list[dict[str, Any]]:
    for key in ("drift_classes", "top_drift_classes"):
        val = drift.get(key) if isinstance(drift, dict) else []
        if isinstance(val, list):
            return [d for d in val if isinstance(d, dict)]
    return []


def _phase_path(phase_state: dict[str, Any]) -> list[str]:
    path = [str(p) for p in _as_list(phase_state.get("phase_path_hypothesis")) if str(p) in PHASES]
    if path:
        return path
    primary = str(phase_state.get("phase_primary") or "")
    return [primary] if primary in PHASES else []


def _memory_support(nodes: list[dict[str, Any]], phase_path: list[str]) -> dict[str, Any]:
    selected = []
    phase_hits: dict[str, int] = {}
    for node in nodes[:12]:
        phase_tags = [str(p) for p in _as_list(node.get("phase_tags"))]
        hit = [p for p in phase_tags if p in phase_path]
        for p in hit:
            phase_hits[p] = phase_hits.get(p, 0) + 1
        selected.append({
            "memory_id": node.get("memory_id"),
            "source_kind": node.get("source_kind"),
            "source_path": node.get("source_path"),
            "memory_role": node.get("memory_role"),
            "phase_tags": phase_tags,
            "confidence": node.get("confidence"),
            "retrieval_weight": node.get("retrieval_weight", 0.0),
        })
    weights = [_clamp(n.get("retrieval_weight")) for n in nodes[:12]]
    avg_weight = round(sum(weights) / max(1, len(weights)), 3)
    return {
        "active_memory_count": len(nodes),
        "linked_memory_count": len(selected),
        "linked_memory_nodes": selected,
        "phase_hit_counts": phase_hits,
        "average_retrieval_weight": avg_weight,
        "memory_support_present": bool(selected),
    }


def _candidate(prefix: str, trace_id: str, title: str, candidate: str, phase_target: str, phase_path: list[str],
               candidate_kind: str, confidence: float, novelty: float, drift: float, memory_support: dict[str, Any],
               limitations: list[str], rationale: str, allowed: bool = True) -> dict[str, Any]:
    base = {
        "trace_id": trace_id,
        "title": title,
        "candidate": candidate,
        "phase_target": phase_target,
        "phase_path": phase_path,
        "candidate_kind": candidate_kind,
    }
    return {
        "candidate_id": _stable_id(prefix, base, 18),
        "title": title,
        "candidate": candidate,
        "candidate_kind": candidate_kind,
        "meaning_state_not_sentence": True,
        "phase_target": phase_target,
        "phase_path": phase_path,
        "memory_links": memory_support.get("linked_memory_nodes", [])[:8],
        "memory_support": {
            "memory_support_present": memory_support.get("memory_support_present", False),
            "active_memory_count": memory_support.get("active_memory_count", 0),
            "linked_memory_count": min(8, int(memory_support.get("linked_memory_count", 0) or 0)),
            "phase_hit_counts": memory_support.get("phase_hit_counts", {}),
            "average_retrieval_weight": memory_support.get("average_retrieval_weight", 0.0),
        },
        "confidence": round(_clamp(confidence), 3),
        "novelty": round(_clamp(novelty), 3),
        "drift": round(_clamp(drift), 3),
        "rationale": rationale,
        "required_limitations": list(dict.fromkeys(limitations + [
            "candidate_only",
            "not_final_language",
            "not_manifest",
            "not_renderer_input_until_scored",
            "no_memory_write",
            "no_projection",
        ])),
        "allowed_to_continue_to_scoring": bool(allowed),
        "allowed_to_render": False,
        "projection_allowed": False,
        "memory_write_allowed": False,
        "approved_output": False,
    }



def _apply_overextension_contract(candidate: dict[str, Any], measurement: dict[str, Any]) -> dict[str, Any]:
    """Attach the Algorithm-5/novelty-bound preflight contract to one candidate.

    The generator does not delete over-budget candidates. It marks them before
    they reach downstream evolutionary exploration/coherence scoring so the
    pipeline can route them to review/archive instead of treating them as
    normal bounded novelty. This enforces 0 < N(c) <= N_max at the candidate
    boundary without pretending the branch has no future research value.
    """
    try:
        novelty_delta = float(measurement.get("novelty_delta", 1.0))
    except Exception:
        novelty_delta = 1.0
    try:
        novelty_budget = float(measurement.get("novelty_budget", 0.55))
    except Exception:
        novelty_budget = 0.55
    task_type = str(measurement.get("task_type") or "default")
    over_budget = bool(novelty_delta > novelty_budget)
    epsilon_s = _clamp(measurement.get("epsilon_s"))
    reason_codes: list[str] = []
    if over_budget:
        reason_codes.append("novelty_delta_exceeds_N_max")
    if bool(measurement.get("circuit_breaker")):
        reason_codes.append("circuit_breaker_blocks_normal_candidate")
    phase_metrics = measurement.get("phase_metrics") or {}
    if isinstance(phase_metrics, dict) and not bool(phase_metrics.get("phase_path_legal", True)):
        reason_codes.append("phase_path_illegal")

    check = {
        "checked": True,
        "formula": "0 < N(c) <= N_max",
        "N_c": round(max(0.0, min(1.0, novelty_delta)), 6),
        "N_max": round(max(0.0, min(1.0, novelty_budget)), 6),
        "task_type": task_type,
        "epsilon_s": round(epsilon_s, 6),
        "bounded_evolutionary_drift": bool(measurement.get("bounded_evolutionary_drift")),
        "overextended": over_budget,
        "reason_codes": reason_codes,
    }
    candidate["overextension_check"] = check
    candidate["overextended"] = over_budget
    candidate["novelty_over_budget"] = over_budget
    candidate["N_c"] = check["N_c"]
    candidate["N_max"] = check["N_max"]

    if over_budget:
        # Do not delete the candidate at generation time. Keep it visible for
        # audit/review, but mark it so downstream explorer/scorer cannot treat
        # it as ordinary bounded novelty.
        candidate["recommended_route"] = "overextended_candidate_route_to_evolutionary_review_or_archive"
        candidate.setdefault("routing_notes", [])
        if isinstance(candidate["routing_notes"], list):
            candidate["routing_notes"].append("candidate_generator_preflight_marked_overextended_before_explorer")
        limitations = candidate.setdefault("required_limitations", [])
        if isinstance(limitations, list):
            for item in ("overextended", "novelty_delta_exceeds_N_max", "requires_evolutionary_review_or_archive"):
                if item not in limitations:
                    limitations.append(item)
    else:
        candidate.setdefault("recommended_route", "normal_candidate_to_evolutionary_drift_explorer")
    return candidate


def generate_candidates(trace_spine: dict[str, Any], *, max_candidates: int = 8) -> dict[str, Any]:
    """Generate read-only candidate meaning states C_t from a trace spine."""
    if not isinstance(trace_spine, dict):
        trace_spine = {}
    trace_id = _trace_id(trace_spine)
    input_event = _input_event(trace_spine)
    phase_state = _phase_state(trace_spine)
    drift = _drift_state(trace_spine)
    nodes = _memory_nodes(trace_spine)
    vector = _phase_vector(trace_spine)
    from rmc_engine_v1.measurement_kernel import measure_candidate as _rmc_measure_candidate, measure_trace_summary as _rmc_measure_trace_summary
    trace_measurement = _rmc_measure_trace_summary(trace_spine)
    phase_path = _phase_path(phase_state)
    primary = str(phase_state.get("phase_primary") or (phase_path[0] if phase_path else "Φ1"))
    if primary not in PHASES:
        primary = "Φ1"
    eps = _epsilon(drift)
    circuit = _circuit_breaker(trace_spine, drift)
    memory_support = _memory_support(nodes, phase_path)
    confidence = _clamp(phase_state.get("confidence"), 0.12, 0.95)
    has_phi5 = "Φ5" in phase_path or primary == "Φ5"
    has_phi6 = "Φ6" in phase_path or primary == "Φ6"
    has_phi7 = "Φ7" in phase_path or primary == "Φ7"
    has_phi8 = "Φ8" in phase_path or primary == "Φ8"

    candidates: list[dict[str, Any]] = []

    if circuit:
        candidates.append(_candidate(
            "ct_quarantine", trace_id,
            "Circuit-Breaker Containment Candidate",
            "Hold the active loop in correction or cold-storage review; do not generate outward projection.",
            "Φ6", phase_path or ["Φ5", "Φ6"], "containment_correction_route",
            0.22, 0.0, max(eps, 0.88), memory_support,
            ["circuit_breaker_triggered", "projection_blocked", "requires_human_or_correction_review"],
            "Circuit breaker or equivalent projection violation was detected upstream. Candidate expansion is blocked except containment routing.",
            allowed=False,
        ))
    else:
        candidates.append(_candidate(
            "ct_direct", trace_id,
            "Direct Trace-Preserving Candidate",
            "Preserve the active input event, phase path, drift report, and memory links as the next candidate meaning state.",
            primary, phase_path or [primary], "direct_trace_candidate",
            confidence * (0.82 + 0.18 * memory_support.get("average_retrieval_weight", 0.0)),
            0.12, eps, memory_support,
            ["requires_coherence_scoring", "trace_first"],
            "Provides the conservative candidate nearest to the current trace without claiming final language.",
            allowed=True,
        ))
        if has_phi5 or has_phi6 or eps >= 0.25:
            candidates.append(_candidate(
                "ct_correction", trace_id,
                "Correction-First Candidate",
                "Route the meaning state through Φ6 correction before any naming or projection is considered.",
                "Φ6", list(dict.fromkeys((phase_path or []) + ["Φ6"])), "correction_candidate",
                min(0.92, confidence + 0.08), 0.18, eps, memory_support,
                ["requires_correction_before_projection", "requires_phi6_gate", "blocks_premature_projection"],
                "The trace contains drift/correction pressure; lawful movement requires correction before naming and projection.",
                allowed=True,
            ))
        if memory_support.get("memory_support_present"):
            candidates.append(_candidate(
                "ct_memory", trace_id,
                "Memory-Anchored Candidate",
                "Use the active memory set as ancestry support for the next meaning state while preserving source, phase, confidence, and drift relation.",
                primary if primary in PHASES else "Φ6", phase_path or [primary], "memory_anchored_candidate",
                min(0.9, 0.44 + memory_support.get("average_retrieval_weight", 0.0) * 0.5), 0.24, eps, memory_support,
                ["requires_memory_link_audit", "source_ancestry_preserved", "trace_first"],
                "Memory is present and phase-related; the candidate keeps ancestry attached instead of relying on surface language.",
                allowed=True,
            ))
        if has_phi7 or "naming" in str(input_event.get("raw_input_preview", "")).lower():
            candidates.append(_candidate(
                "ct_naming", trace_id,
                "Naming-Gate Candidate",
                "Prepare a Φ7 naming candidate only after Φ6 correction is preserved in the trace.",
                "Φ7", list(dict.fromkeys((phase_path or []) + ["Φ6", "Φ7"])), "naming_gate_candidate",
                max(0.34, confidence - 0.03), 0.31, eps, memory_support,
                ["requires_phi6_before_phi7", "definition_scope_required", "allowed_use_forbidden_use_required"],
                "The trace references naming. Naming can be prepared, but it cannot become projection without correction and later scoring.",
                allowed=True,
            ))
        if has_phi8 or "projection" in str(input_event.get("raw_input_preview", "")).lower():
            candidates.append(_candidate(
                "ct_projection_gate", trace_id,
                "Projection-Gate Hold Candidate",
                "Hold Φ8 projection as conditional until correction, naming, coherence score, manifest, renderer, and echo validation exist.",
                "Φ8", list(dict.fromkeys((phase_path or []) + ["Φ6", "Φ7", "Φ8"])), "projection_gate_candidate",
                max(0.25, confidence - 0.12), 0.2, max(eps, 0.18), memory_support,
                ["projection_blocked_in_candidate_stage", "requires_phi6", "requires_phi7", "requires_manifest_and_echo_validation"],
                "Projection appears in the trace, so the candidate explicitly blocks outward expression until downstream gates exist.",
                allowed=True,
            ))
        # Bounded novelty is allowed only as a candidate, never as truth.
        if eps < 0.55 and not circuit:
            candidates.append(_candidate(
                "ct_evo", trace_id,
                "Bounded Evolutionary Drift Candidate",
                "Explore one adjacent meaning branch while keeping memory ancestry, phase path, and drift budget visible.",
                primary, phase_path or [primary], "bounded_evolutionary_candidate",
                max(0.2, confidence - 0.18), 0.58, eps, memory_support,
                ["hypothesis_only", "bounded_novelty", "requires_coherence_scoring", "not_truth_claim"],
                "Keeps novelty available without letting novelty bypass the trace or become approved output.",
                allowed=True,
            ))
        if eps >= 0.5:
            candidates.append(_candidate(
                "ct_archive", trace_id,
                "Archive-or-Correction Candidate",
                "Preserve the branch as unresolved review material if correction cannot reduce drift below threshold.",
                "Φ9", list(dict.fromkeys((phase_path or []) + ["Φ6", "Φ9"])), "archive_candidate",
                0.42, 0.08, eps, memory_support,
                ["archive_if_uncorrected", "not_active_projection", "cold_storage_possible"],
                "Moderate or high drift should be preservable as review material without being projected as conclusion.",
                allowed=True,
            ))

    # Stable deterministic ordering: correction and memory candidates should appear before novelty.
    candidates = candidates[: max(1, min(int(max_candidates or 8), 12))]
    # C2R: attach real shared measurement-kernel readings to every candidate.
    for _candidate_obj in candidates:
        _measurement = _rmc_measure_candidate(
            _candidate_obj,
            trace_spine,
            memory_nodes=nodes,
            phase_state=phase_state,
            drift_state=drift,
            phase_vector=vector,
        )
        _candidate_obj["measurement_kernel"] = _measurement
        _candidate_obj["measured_novelty_delta"] = _measurement.get("novelty_delta")
        _candidate_obj["measured_novelty_budget"] = _measurement.get("novelty_budget")
        _candidate_obj["measured_task_type"] = _measurement.get("task_type")
        _candidate_obj["measured_epsilon_s"] = _measurement.get("epsilon_s")
        _candidate_obj["measured_memory_fit"] = _measurement.get("memory_fit")
        _candidate_obj["measured_semantic_distance"] = _measurement.get("semantic_distance")
        _apply_overextension_contract(_candidate_obj, _measurement)
    allowed_count = sum(1 for c in candidates if c.get("allowed_to_continue_to_scoring"))
    overextended_candidates = [c for c in candidates if c.get("overextended")]
    candidate_set_id = _stable_id("ct_set", {"trace_id": trace_id, "candidates": [c.get("candidate_id") for c in candidates]})
    selected_preview = None
    for c in candidates:
        if c.get("allowed_to_continue_to_scoring"):
            selected_preview = c
            break

    return {
        "status": "OK",
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "stage": "Candidate Conclusion Generator",
        "candidate_set_id": candidate_set_id,
        "trace_id": trace_id,
        "C_t_present": True,
        "candidate_generation_status": {
            "candidate_generation_allowed": bool(allowed_count > 0 and not circuit),
            "allowed_candidate_count": allowed_count,
            "overextended_candidate_count": len(overextended_candidates),
            "total_candidate_count": len(candidates),
            "reason": "circuit breaker blocks candidate expansion" if circuit else "read-only candidate meaning states generated for downstream coherence scoring",
            "projection_allowed": False,
            "final_language_allowed": False,
            "memory_write_allowed": False,
            "manifest_allowed": False,
        },
        "source_trace_summary": {
            "trace_id": trace_id,
            "input_event_id": input_event.get("event_id"),
            "phase_primary": primary,
            "phase_path_hypothesis": phase_path,
            "phase_confidence": phase_state.get("confidence"),
            "epsilon_s": eps,
            "circuit_breaker": circuit,
            "active_memory_count": len(nodes),
            "measurement_kernel_version": trace_measurement.get("measurement_kernel_version"),
            "trace_epsilon_s": trace_measurement.get("epsilon_s"),
            "trace_sigma_res": trace_measurement.get("sigma_res"),
            "trace_D_score": trace_measurement.get("D_score"),
        },
        "trace_measurement_kernel": trace_measurement,
        "candidate_measurement_summary": {
            "candidate_count": len(candidates),
            "all_candidates_have_measurements": all(bool(c.get("measurement_kernel")) for c in candidates),
            "epsilon_s_values": [c.get("measured_epsilon_s") for c in candidates],
            "novelty_delta_values": [c.get("measured_novelty_delta") for c in candidates],
            "memory_fit_values": [c.get("measured_memory_fit") for c in candidates],
            "novelty_budget_values": [c.get("measured_novelty_budget") for c in candidates],
            "overextended_candidate_count": len(overextended_candidates),
            "overextended_candidate_ids": [c.get("candidate_id") for c in overextended_candidates],
            "all_candidates_have_overextension_check": all(bool(c.get("overextension_check")) for c in candidates),
        },
        "source_drift_report": drift,
        "source_phase_state": phase_state,
        "source_memory_support": memory_support,
        "candidate_set": candidates,
        "selected_candidate_preview": selected_preview,
        "recommended_sequence": [
            "Use C_t as candidate meaning states only; do not render as final language.",
            "Next stage must score coherence against trace, memory, phase validity, novelty, and drift.",
            "Correction Engine and Naming Engine must still run before manifest compilation or projection.",
        ],
        "boundary": candidate_generator_boundary(),
    }
