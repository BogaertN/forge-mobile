"""RMC Evolutionary Drift Explorer + Coherence Scorer v2.

Patch 262J1R-Preflight-C2R reinforces C2 with the shared RMC Measurement
Kernel. C2R does not merely expose named fields; it computes real readings from
live candidate reports, trace spines, active memory nodes, phase paths, drift
state, structure signatures, entropy, semantic distance, novelty deltas,
resonance variance, phase deviation, epsilon_s, and coherence components.

This module consumes C_t candidate meaning states and produces:
    E_t — bounded evolutionary-drift exploration report.
    S_t — read-only coherence score set and selected candidate preview.

It does not render final language, approve projection, compile manifests,
write memory, mutate datasets, query Chroma, execute shell, call an LLM, or
touch Identity Vault.
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import json
from typing import Any

from rmc_engine_v1.measurement_kernel import (
    ENGINE_VERSION as MEASUREMENT_KERNEL_VERSION,
    clamp,
    coherence_components,
    extract_drift_state_from_trace,
    extract_memory_nodes_from_trace,
    extract_phase_state_from_trace,
    extract_phase_vector,
    measure_candidate,
    measurement_boundary,
    phase_path,
    phase_path_metrics,
    stable_hash,
    stable_id,
)

ENGINE_VERSION = "rmc_evolutionary_drift_explorer_v2_patch262J1R_preflight_C2R"
ENGINE_MODE = "read_only_real_measurement_evolutionary_drift_and_coherence_scoring"
PHASES = [f"Φ{i}" for i in range(1, 10)]


def _utc_now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()


def _sha(obj: Any) -> str:
    return stable_hash(obj)


def _stable_id(prefix: str, obj: Any, n: int = 18) -> str:
    return stable_id(prefix, obj, n)


def _clamp(value: Any, low: float = 0.0, high: float = 1.0) -> float:
    return clamp(value, low, high)


def _as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if value in (None, "", {}):
        return []
    return [value]


def _candidate_id(candidate: dict[str, Any], index: int) -> str:
    return str(candidate.get("candidate_id") or _stable_id(f"ct_auto_{index:02d}", candidate))


def evolutionary_drift_boundary() -> dict[str, Any]:
    return {
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "engine_module_location": "forge/rmc_engine_v1/evolutionary_drift_explorer.py",
        "implements_rmc_stages": [
            "Evolutionary Drift Explorer / E_t",
            "Coherence Scorer / S_t",
        ],
        "input_contract": "candidate_conclusion_report_C_t_with_trace_spine",
        "output_contract": "measured_bounded_drift_exploration_and_coherence_scores_not_final_language",
        "uses_measurement_kernel": True,
        "measurement_kernel_version": MEASUREMENT_KERNEL_VERSION,
        "real_readings_required": [
            "entropy_norm",
            "structure_signature",
            "structure_delta",
            "semantic_distance",
            "memory_fit",
            "phase_delta",
            "resonance_variance_sigma_res",
            "D_score",
            "epsilon_s",
            "novelty_delta",
            "bounded_evolutionary_drift",
            "coherence_components",
        ],
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
        "manifest_allowed": False,
        "note": "C2R ranks candidate meaning states through real measurement-kernel readings. It still cannot render, approve, project, write memory, or compile a manifest.",
        "measurement_boundary": measurement_boundary(),
    }


def _candidate_set(candidate_report: dict[str, Any]) -> list[dict[str, Any]]:
    candidates = candidate_report.get("candidate_set") if isinstance(candidate_report, dict) else []
    if not isinstance(candidates, list):
        return []
    return [c for c in candidates if isinstance(c, dict)]


def _candidate_generation_blocked(candidate_report: dict[str, Any]) -> bool:
    status = candidate_report.get("candidate_generation_status") if isinstance(candidate_report, dict) else {}
    if isinstance(status, dict) and status.get("candidate_generation_allowed") is False:
        return True
    for c in _candidate_set(candidate_report):
        if str(c.get("candidate_kind") or "") == "containment_correction_route":
            return True
        m = c.get("measurement_kernel") if isinstance(c, dict) else {}
        if isinstance(m, dict) and bool(m.get("circuit_breaker")):
            return True
    return False


def _measurement(candidate: dict[str, Any], candidate_report: dict[str, Any]) -> dict[str, Any]:
    existing = candidate.get("measurement_kernel") if isinstance(candidate, dict) else {}
    if isinstance(existing, dict) and existing.get("measurement_kernel_version"):
        return existing
    return measure_candidate(
        candidate,
        candidate_report,
        memory_nodes=extract_memory_nodes_from_trace(candidate_report),
        phase_state=extract_phase_state_from_trace(candidate_report),
        drift_state=extract_drift_state_from_trace(candidate_report),
        phase_vector=extract_phase_vector(candidate_report),
    )


def _branch_route_from_measurement(candidate: dict[str, Any], measurement: dict[str, Any]) -> str:
    if bool(candidate.get("overextended")):
        return "candidate_marked_overextended_route_to_review_or_archive"
    if bool(measurement.get("circuit_breaker")):
        return "circuit_breaker_blocks_evolutionary_exploration"
    if not bool(measurement.get("bounded_evolutionary_drift")):
        if measurement.get("epsilon_s", 0.0) > 0.60:
            return "epsilon_s_exceeds_bounded_threshold_route_to_correction_or_archive"
        if measurement.get("novelty_delta", 1.0) > measurement.get("novelty_budget", 0.55):
            return "novelty_delta_exceeds_task_budget_route_to_review"
        if not (measurement.get("phase_metrics") or {}).get("phase_path_legal", False):
            return "phase_path_illegal_route_to_correction_engine"
        return "insufficient_memory_or_trace_support_hold_for_review"
    if str(candidate.get("candidate_kind") or "") == "bounded_evolutionary_candidate":
        return "bounded_evolutionary_drift_allowed_for_scoring"
    return "trace_preserving_branch_allowed_for_scoring"


def _boundedness(candidate: dict[str, Any], measurement: dict[str, Any]) -> dict[str, Any]:
    bounded = bool(measurement.get("bounded_evolutionary_drift")) and bool(candidate.get("allowed_to_continue_to_scoring", False))
    route = _branch_route_from_measurement(candidate, measurement)
    return {
        "novelty_delta": round(_clamp(measurement.get("novelty_delta")), 6),
        "epsilon_s": round(_clamp(measurement.get("epsilon_s")), 6),
        "D_score": round(_clamp(measurement.get("D_score")), 6),
        "sigma_res": round(_clamp(measurement.get("sigma_res")), 6),
        "phase_delta": round(_clamp((measurement.get("phase_metrics") or {}).get("max_delta_phi")), 6),
        "semantic_distance": round(_clamp(measurement.get("semantic_distance")), 6),
        "memory_fit": round(_clamp(measurement.get("memory_fit")), 6),
        "novelty_budget": round(_clamp(measurement.get("novelty_budget"), 0.0, 1.0), 6),
        "task_type": measurement.get("task_type"),
        "bounded_evolutionary_drift": bool(measurement.get("bounded_evolutionary_drift")),
        "candidate_overextended": bool(candidate.get("overextended")),
        "overextension_check": candidate.get("overextension_check", {}),
        "bounded_for_scoring": bool(bounded and not measurement.get("circuit_breaker") and not candidate.get("overextended")),
        "recommended_route": route,
        "chi_t_required": bool(measurement.get("chi_t_required")),
        "chi_t_action": measurement.get("chi_t_action"),
        "axiom_binding": {
            "drift_not_always_error": True,
            "novelty_requires_bounded_drift": True,
            "no_projection_without_correction_naming_manifest_echo": True,
        },
    }


def _adjacency_vectors(candidate: dict[str, Any], measurement: dict[str, Any]) -> list[str]:
    adjacency: list[str] = []
    kind = str(candidate.get("candidate_kind") or "")
    p_metrics = measurement.get("phase_metrics") or {}
    p_path = p_metrics.get("phase_path") or []
    if kind == "bounded_evolutionary_candidate" or measurement.get("novelty_delta", 0.0) > 0.05:
        adjacency.extend(["adjacent_meaning_branch", "memory_distance_measured", "hypothesis_only"])
    if measurement.get("epsilon_s", 0.0) > 0.35 or "Φ5" in p_path:
        adjacency.extend(["drift_pressure", "correction_or_archive_check"])
    if "correction" in kind or "Φ6" in p_path:
        adjacency.extend(["correction_path", "drift_reduction_branch"])
    if "naming" in kind or "Φ7" in p_path:
        adjacency.extend(["naming_candidate", "definition_boundary_needed"])
    if "projection" in kind or "Φ8" in p_path:
        adjacency.extend(["projection_risk", "export_gate_required"])
    if measurement.get("memory_fit", 0.0) > 0.25:
        adjacency.append("memory_anchored")
    if not adjacency:
        adjacency.append("trace_preserving_branch")
    return list(dict.fromkeys(adjacency))


def _exploration_branch(candidate: dict[str, Any], candidate_report: dict[str, Any], index: int) -> dict[str, Any]:
    cid = _candidate_id(candidate, index)
    measurement = _measurement(candidate, candidate_report)
    p_metrics = measurement.get("phase_metrics") or phase_path_metrics(candidate.get("phase_path"))
    bounded = _boundedness(candidate, measurement)
    branch_id = _stable_id("et_branch", {
        "candidate_id": cid,
        "epsilon_s": measurement.get("epsilon_s"),
        "novelty_delta": measurement.get("novelty_delta"),
        "phase": p_metrics,
    }, 18)
    return {
        "branch_id": branch_id,
        "candidate_id": cid,
        "candidate_kind": candidate.get("candidate_kind"),
        "phase_target": candidate.get("phase_target"),
        "adjacency_vectors": _adjacency_vectors(candidate, measurement),
        "phase_analysis": p_metrics,
        "measured_evolutionary_drift": measurement,
        "boundedness": bounded,
        "branch_allowed_to_score": bool(bounded.get("bounded_for_scoring")),
        "branch_allowed_to_render": False,
        "branch_allowed_to_write_memory": False,
        "branch_allowed_to_project": False,
    }


def explore_evolutionary_drift(candidate_report: dict[str, Any], *, max_branches: int = 12) -> dict[str, Any]:
    """Create E_t, a real-measured bounded evolutionary-drift report from C_t."""
    if not isinstance(candidate_report, dict):
        candidate_report = {}
    candidates = _candidate_set(candidate_report)
    blocked = _candidate_generation_blocked(candidate_report)
    candidate_set_id = str(candidate_report.get("candidate_set_id") or _stable_id("ct_set_unknown", candidate_report))
    trace_id = str(candidate_report.get("trace_id") or ((candidate_report.get("dry_run_trace") or {}).get("trace_id") if isinstance(candidate_report.get("dry_run_trace"), dict) else "") or _stable_id("trace_unknown", candidate_report))
    branches: list[dict[str, Any]] = []
    if not blocked:
        for idx, candidate in enumerate(candidates[: max(1, min(int(max_branches or 12), 24))], start=1):
            branches.append(_exploration_branch(candidate, candidate_report, idx))
    else:
        branches.append({
            "branch_id": _stable_id("et_branch_blocked", candidate_report, 18),
            "candidate_id": "circuit_breaker_containment_only",
            "candidate_kind": "containment_correction_route",
            "adjacency_vectors": ["containment", "correction_or_archive_only"],
            "measured_evolutionary_drift": {
                "measurement_kernel_version": MEASUREMENT_KERNEL_VERSION,
                "circuit_breaker": True,
                "epsilon_s": 1.0,
                "bounded_evolutionary_drift": False,
                "chi_t_required": True,
                "chi_t_action": "circuit_breaker_block_projection_route_to_correction_or_archive",
            },
            "boundedness": {
                "bounded_for_scoring": False,
                "recommended_route": "circuit_breaker_blocks_evolutionary_exploration",
                "axiom_binding": {"drift_not_always_error": True, "novelty_requires_bounded_drift": True},
            },
            "branch_allowed_to_score": False,
            "branch_allowed_to_render": False,
            "branch_allowed_to_write_memory": False,
            "branch_allowed_to_project": False,
        })

    allowed = [b for b in branches if b.get("branch_allowed_to_score")]
    eps_values = [((b.get("measured_evolutionary_drift") or {}).get("epsilon_s")) for b in branches]
    novelty_values = [((b.get("measured_evolutionary_drift") or {}).get("novelty_delta")) for b in branches]
    E_id = _stable_id("et", {"candidate_set_id": candidate_set_id, "branches": [b.get("branch_id") for b in branches]})
    return {
        "status": "OK",
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "stage": "Evolutionary Drift Explorer",
        "candidate_set_id": candidate_set_id,
        "trace_id": trace_id,
        "E_t_present": True,
        "E_t": {
            "status": "IMPLEMENTED_READ_ONLY_IN_PATCH_C2R_WITH_REAL_MEASUREMENTS",
            "exploration_id": E_id,
            "branch_count": len(branches),
            "bounded_branch_count": len(allowed),
            "exploration_allowed": bool(not blocked and allowed),
            "measurement_kernel_version": MEASUREMENT_KERNEL_VERSION,
        },
        "exploration_id": E_id,
        "source_candidate_conclusion": candidate_report,
        "evolutionary_branches": branches,
        "measurement_summary": {
            "measurement_kernel_version": MEASUREMENT_KERNEL_VERSION,
            "candidate_count": len(candidates),
            "branch_count": len(branches),
            "all_branches_have_measurements": all(bool(b.get("measured_evolutionary_drift")) for b in branches),
            "epsilon_s_values": eps_values,
            "novelty_delta_values": novelty_values,
            "bounded_branch_count": len(allowed),
            "reads_actual_memory_nodes": any(bool((b.get("measured_evolutionary_drift") or {}).get("reads_actual_memory_nodes")) for b in branches),
            "reads_actual_phase_path": any(bool((b.get("measured_evolutionary_drift") or {}).get("reads_actual_phase_path")) for b in branches),
            "reads_actual_resonance_vector": any(bool((b.get("measured_evolutionary_drift") or {}).get("reads_actual_resonance_vector")) for b in branches),
        },
        "exploration_summary": {
            "candidate_count": len(candidates),
            "branch_count": len(branches),
            "bounded_branch_count": len(allowed),
            "blocked_by_circuit_breaker_or_candidate_gate": bool(blocked),
            "projection_allowed": False,
            "final_language_allowed": False,
            "memory_write_allowed": False,
            "manifest_allowed": False,
        },
        "recommended_sequence": [
            "Use E_t to preserve bounded novelty as measured inspectable branches, not as truth.",
            "Next score candidates through S_t before Correction Engine or Naming Engine.",
            "Do not render, project, write memory, or compile a manifest from E_t directly.",
        ],
        "boundary": evolutionary_drift_boundary(),
    }


def _score_candidate(candidate: dict[str, Any], branch: dict[str, Any] | None, index: int, candidate_report: dict[str, Any]) -> dict[str, Any]:
    cid = _candidate_id(candidate, index)
    measurement = (branch or {}).get("measured_evolutionary_drift") if isinstance(branch, dict) else None
    if not isinstance(measurement, dict) or not measurement.get("measurement_kernel_version"):
        measurement = _measurement(candidate, candidate_report)
    components = coherence_components(candidate, measurement)
    bounded_ok = bool((branch or {}).get("branch_allowed_to_score")) and bool(candidate.get("allowed_to_continue_to_scoring", False)) and not bool(measurement.get("circuit_breaker"))
    coherence = _clamp(components.get("coherence_score")) if bounded_ok else 0.0
    if bool(candidate.get("overextended")):
        status = "not_scoreable_due_to_overextended_novelty"
    elif not bounded_ok:
        status = "not_scoreable_due_to_unbounded_drift_or_gate"
    elif coherence >= 0.72:
        status = "coherence_candidate_strong_for_correction_or_naming"
    elif coherence >= 0.58:
        status = "coherence_candidate_ready_for_correction_or_naming"
    elif coherence >= 0.42:
        status = "coherence_candidate_requires_correction_or_more_memory"
    else:
        status = "coherence_candidate_weak_hold_for_review"
    manifest_ready = False
    phase_path_value = (measurement.get("phase_metrics") or {}).get("phase_path", [])
    return {
        "candidate_id": cid,
        "candidate_kind": candidate.get("candidate_kind"),
        "title": candidate.get("title"),
        "score_components": components,
        "coherence_score": round(coherence, 6),
        "coherence_status": status,
        "measured_evolutionary_drift": measurement,
        "boundedness": (branch or {}).get("boundedness"),
        "candidate_overextended": bool(candidate.get("overextended")),
        "overextension_check": candidate.get("overextension_check", {}),
        "phase_analysis": measurement.get("phase_metrics"),
        "selected_candidate_eligible": bool(bounded_ok and coherence >= 0.58),
        "allowed_to_continue_to_correction_engine": bool(bounded_ok and coherence >= 0.42),
        "allowed_to_continue_to_naming_engine": bool(bounded_ok and coherence >= 0.58 and "Φ6" in phase_path_value),
        "allowed_to_continue_to_manifest_compiler": manifest_ready,
        "renders_final_language": False,
        "projection_allowed": False,
        "memory_write_allowed": False,
        "approved_output": False,
        "rationale": "C2R score uses measured memory fit, phase validity, epsilon_s drift containment, source confidence, utility fit, bounded novelty, operator legality, conflict penalty, and projection-gate penalty. Manifest remains blocked until correction/naming/manifest stages exist.",
    }


def score_coherence(evolution_report: dict[str, Any]) -> dict[str, Any]:
    """Create S_t, read-only real-measured coherence scores from E_t."""
    if not isinstance(evolution_report, dict):
        evolution_report = {}
    candidate_report = evolution_report.get("source_candidate_conclusion") if isinstance(evolution_report.get("source_candidate_conclusion"), dict) else {}
    candidates = _candidate_set(candidate_report)
    branches = evolution_report.get("evolutionary_branches") if isinstance(evolution_report, dict) else []
    branches_by_candidate: dict[str, dict[str, Any]] = {}
    if isinstance(branches, list):
        for branch in branches:
            if isinstance(branch, dict):
                branches_by_candidate[str(branch.get("candidate_id"))] = branch
    scores = []
    for idx, candidate in enumerate(candidates, start=1):
        cid = _candidate_id(candidate, idx)
        scores.append(_score_candidate(candidate, branches_by_candidate.get(cid), idx, candidate_report))
    scores.sort(key=lambda item: (item.get("selected_candidate_eligible") is True, item.get("coherence_score", 0.0)), reverse=True)
    selected = None
    for score in scores:
        if score.get("selected_candidate_eligible"):
            selected = score
            break
    if selected is None and scores:
        selected = scores[0]
    S_id = _stable_id("st", {"exploration_id": evolution_report.get("exploration_id"), "scores": [(s.get("candidate_id"), s.get("coherence_score")) for s in scores]})
    selected_candidate = None
    if selected:
        selected_id = selected.get("candidate_id")
        for idx, candidate in enumerate(candidates, start=1):
            if _candidate_id(candidate, idx) == selected_id:
                selected_candidate = candidate
                break
    return {
        "status": "OK",
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "stage": "Coherence Scorer",
        "trace_id": evolution_report.get("trace_id"),
        "candidate_set_id": evolution_report.get("candidate_set_id"),
        "exploration_id": evolution_report.get("exploration_id"),
        "S_t_present": True,
        "S_t": {
            "status": "IMPLEMENTED_READ_ONLY_IN_PATCH_C2R_WITH_REAL_MEASUREMENTS",
            "score_set_id": S_id,
            "candidate_score_count": len(scores),
            "selected_candidate_id": (selected or {}).get("candidate_id"),
            "selected_coherence_score": (selected or {}).get("coherence_score"),
            "manifest_allowed": False,
            "projection_allowed": False,
            "memory_write_allowed": False,
            "measurement_kernel_version": MEASUREMENT_KERNEL_VERSION,
        },
        "score_set_id": S_id,
        "source_evolutionary_drift": evolution_report,
        "candidate_scores": scores,
        "selected_scored_candidate_preview": selected,
        "selected_candidate_meaning_state_preview": selected_candidate,
        "measurement_summary": {
            "measurement_kernel_version": MEASUREMENT_KERNEL_VERSION,
            "all_scores_have_measured_drift": all(bool(s.get("measured_evolutionary_drift")) for s in scores),
            "coherence_formula_used": bool(scores and isinstance(scores[0].get("score_components"), dict) and "formula" in scores[0].get("score_components", {})),
            "epsilon_s_values": [(s.get("measured_evolutionary_drift") or {}).get("epsilon_s") for s in scores],
            "semantic_distance_values": [(s.get("measured_evolutionary_drift") or {}).get("semantic_distance") for s in scores],
            "memory_fit_values": [(s.get("measured_evolutionary_drift") or {}).get("memory_fit") for s in scores],
            "novelty_delta_values": [(s.get("measured_evolutionary_drift") or {}).get("novelty_delta") for s in scores],
        },
        "coherence_summary": {
            "candidate_count": len(candidates),
            "scored_count": len(scores),
            "eligible_count": sum(1 for s in scores if s.get("selected_candidate_eligible")),
            "correction_engine_next": True,
            "naming_engine_next": True,
            "manifest_compiler_allowed": False,
            "renderer_allowed": False,
            "projection_allowed": False,
            "memory_write_allowed": False,
        },
        "recommended_sequence": [
            "Use S_t to choose the strongest candidate meaning state, not to render final language.",
            "Next stage should implement Correction Engine and Naming Engine before manifest compilation.",
            "Manifest, Renderer, Echo Validator, and Memory Writer remain blocked in C2R.",
        ],
        "boundary": evolutionary_drift_boundary(),
        "writes_files": False,
        "identity_vault_write": False,
        "rmc_live_memory_write": False,
        "renders_final_language": False,
        "approved_output": False,
    }
