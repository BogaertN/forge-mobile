"""Recursive Manifest Compiler / μ_t engine.

Patch 262J1R-Preflight-C4 builds the real pre-language manifest compiler
stage on top of C3R Correction/Naming.  This module compiles μ_t only when
measured correction and naming gates are strong enough.  If the gate is weak,
it returns a blocked manifest candidate with measured reasons instead of
fabricating a manifest.

It never renders final language, writes files, writes memory, calls an LLM,
executes shell, queries databases, touches Identity Vault, or mutates canonical
reference files.
"""
from __future__ import annotations

import datetime as _dt
from typing import Any

from rmc_engine_v1.measurement_kernel import (
    clamp,
    phase_path,
    phase_path_metrics,
    stable_hash,
    stable_id,
)

ENGINE_VERSION = "rmc_manifest_compiler_v1_patch262J1R_preflight_C10"
ENGINE_MODE = "read_only_recursive_manifest_compiler_mu_t"
PHASES = [f"Φ{i}" for i in range(1, 10)]

REQUIRED_MANIFEST_FIELDS = [
    "claim",
    "phase_path",
    "operator_path",
    "memory_links",
    "confidence",
    "novelty",
    "drift_status",
    "projection_status",
    "output_targets",
]


def _utc_now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()


def _clamp(value: Any, low: float = 0.0, high: float = 1.0) -> float:
    return clamp(value, low, high)


def _stable_id(prefix: str, obj: Any, n: int = 18) -> str:
    return stable_id(prefix, obj, n)


def _stable_hash(obj: Any) -> str:
    return stable_hash(obj)


def _as_dict(value: Any) -> dict[str, Any]:
    return dict(value or {}) if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if value in (None, "", {}):
        return []
    return [value]


def _dedupe(items: list[Any]) -> list[Any]:
    out: list[Any] = []
    seen: set[str] = set()
    for item in items:
        key = str(item)
        if key not in seen:
            out.append(item)
            seen.add(key)
    return out


def manifest_schema_contract() -> dict[str, Any]:
    return {
        "manifest_symbol": "μ_t",
        "manifest_name": "Recursive Manifest / pre-language symbolic output object",
        "required_fields": REQUIRED_MANIFEST_FIELDS,
        "field_meanings": {
            "claim": "selected meaning claim before rendering",
            "phase_path": "phase sequence that produced and bounds the claim",
            "operator_path": "ordered symbolic compiler operations applied to the trace",
            "memory_links": "source/ancestry links used as support, warning, or context",
            "confidence": "measured manifest stability score, not stylistic confidence",
            "novelty": "measured novelty delta against active memory",
            "drift_status": "measured drift/correction state used before output approval",
            "projection_status": "manifest-level projection/export readiness state; required before any renderer or memory writer may treat the claim as projectable",
            "output_targets": "allowed downstream render targets; no target renders here",
        },
        "axioms_enforced": {
            "no_output_without_trace": True,
            "meaning_precedes_rendering": True,
            "memory_must_be_phase_tagged": True,
            "drift_classified_before_suppression": True,
            "novelty_requires_bounded_drift": True,
            "phase6_closure_before_projection": True,
            "language_is_output_modality_not_core_state": True,
        },
        "compiler_stage": "Recursive Manifest Compiler",
        "renderer_stage_present": False,
        "memory_writer_stage_present": False,
    }


def manifest_compiler_boundary() -> dict[str, Any]:
    return {
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "engine_module_location": "forge/rmc_engine_v1/manifest_compiler.py",
        "implements_rmc_stage": "Recursive Manifest Compiler / μ_t",
        "input_contract": "C3R_correction_naming_report_with_chi_t_and_N_t",
        "output_contract": "manifest_packet_or_blocked_manifest_candidate_not_rendered_output",
        "manifest_schema_contract": manifest_schema_contract(),
        "uses_measurement_kernel": True,
        "real_readings_required": [
            "candidate_validity_score",
            "projection_gated_score",
            "naming_confidence",
            "post_correction_epsilon_s",
            "epsilon_s",
            "D_score",
            "sigma_res",
            "memory_fit",
            "semantic_distance",
            "novelty_delta",
            "source_confidence",
            "phase_path_legal",
            "route_consistent",
            "stable_naming",
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
        "note": "C4 compiles μ_t only from corrected/named measured trace state. It creates no final language and performs no memory write.",
    }


def _source_coherence(c3: dict[str, Any]) -> dict[str, Any]:
    return _as_dict(c3.get("source_coherence_scorer"))


def _source_candidate_report(c3: dict[str, Any]) -> dict[str, Any]:
    coh = _source_coherence(c3)
    evo = _as_dict(coh.get("source_evolutionary_drift"))
    return _as_dict(evo.get("source_candidate_conclusion"))


def _source_trace(c3: dict[str, Any]) -> dict[str, Any]:
    cand_report = _source_candidate_report(c3)
    return _as_dict(cand_report.get("source_trace_spine"))


def _selected_candidate(c3: dict[str, Any]) -> dict[str, Any]:
    coh = _source_coherence(c3)
    selected_id = str(c3.get("selected_candidate_id") or coh.get("selected_candidate_id") or "")
    preview = coh.get("selected_candidate_meaning_state_preview")
    if isinstance(preview, dict) and (not selected_id or str(preview.get("candidate_id") or "") == selected_id):
        return dict(preview)
    evo = _as_dict(coh.get("source_evolutionary_drift"))
    cand_report = _as_dict(evo.get("source_candidate_conclusion"))
    for candidate in _as_list(cand_report.get("candidate_set")):
        if isinstance(candidate, dict) and str(candidate.get("candidate_id") or "") == selected_id:
            return dict(candidate)
    return {}


def _selected_score(c3: dict[str, Any]) -> dict[str, Any]:
    coh = _source_coherence(c3)
    selected_id = str(c3.get("selected_candidate_id") or coh.get("selected_candidate_id") or "")
    preview = coh.get("selected_scored_candidate_preview")
    if isinstance(preview, dict) and (not selected_id or str(preview.get("candidate_id") or "") == selected_id):
        return dict(preview)
    for score in _as_list(coh.get("candidate_scores")):
        if isinstance(score, dict) and str(score.get("candidate_id") or "") == selected_id:
            return dict(score)
    return {}


def _memory_links(c3: dict[str, Any], selected_candidate: dict[str, Any]) -> list[dict[str, Any]]:
    links: list[dict[str, Any]] = []
    for item in _as_list(selected_candidate.get("memory_links"))[:12]:
        if not isinstance(item, dict):
            continue
        links.append({
            "memory_id": item.get("memory_id") or item.get("id"),
            "source_kind": item.get("source_kind"),
            "source_path": item.get("source_path"),
            "memory_role": item.get("memory_role"),
            "phase_tags": _as_list(item.get("phase_tags")),
            "confidence": item.get("confidence"),
            "retrieval_weight": item.get("retrieval_weight"),
            "manifest_role": "support_or_context_from_C_t_memory_links",
        })
    if links:
        return links[:12]

    trace = _source_trace(c3)
    recall = _as_dict(trace.get("memory_recall"))
    state = _as_dict(recall.get("memory_state"))
    nodes = _as_list(state.get("active_memory_nodes"))
    for node in nodes[:12]:
        if not isinstance(node, dict):
            continue
        links.append({
            "memory_id": node.get("memory_id") or node.get("id"),
            "source_kind": node.get("source_kind"),
            "source_path": node.get("source_path"),
            "memory_role": node.get("memory_role"),
            "phase_tags": _as_list(node.get("phase_tags")),
            "confidence": node.get("confidence"),
            "retrieval_weight": node.get("retrieval_weight"),
            "manifest_role": "support_or_context_from_M_t_active_memory",
        })
    return links[:12]


def _phase_index(path: list[str], phase: str) -> int | None:
    try:
        return path.index(phase)
    except ValueError:
        return None


def _phase6_before_projection(path: list[str]) -> bool:
    if "Φ8" not in path:
        return True
    i8 = _phase_index(path, "Φ8")
    i6 = _phase_index(path, "Φ6")
    i7 = _phase_index(path, "Φ7")
    return i6 is not None and i7 is not None and i6 < i7 < i8


def _phase6_before_naming(path: list[str]) -> bool:
    if "Φ7" not in path:
        return False
    i7 = _phase_index(path, "Φ7")
    i6 = _phase_index(path, "Φ6")
    return i6 is not None and i7 is not None and i6 < i7


def _projection_status(gate: dict[str, Any], phase: list[str], readings: dict[str, Any]) -> dict[str, Any]:
    """Return required manifest-level projection state.

    Projection status is a required μ_t field because projection/export is a
    gate, not a renderer style.  C10 keeps it explicit even for blocked
    manifest candidates so downstream stages cannot silently infer readiness.
    """
    checks = _as_dict(gate.get("gate_checks"))
    blocked = _as_list(gate.get("blocked_reasons"))
    phase6_export_ready = bool(checks.get("phase6_and_7_before_projection_if_projection_requested"))
    manifest_allowed = bool(gate.get("manifest_compile_allowed"))
    projection_ready = bool(manifest_allowed and phase6_export_ready and not blocked)
    if projection_ready:
        status = "internal_manifest_ready_for_renderer_echo_gate"
        reason = "manifest gates passed; renderer and echo validator still required before projection or memory write"
    else:
        status = "projection_blocked_or_not_yet_authorized"
        reason = "projection requires valid μ_t, Φ6 correction, Φ7 naming, renderer preservation, echo validation, and memory writer approval"
    return {
        "status": status,
        "projection_ready": projection_ready,
        "projection_allowed_now": False,
        "renderer_required": True,
        "echo_validation_required": True,
        "memory_write_allowed_now": False,
        "phase_path": phase,
        "phase6_and_7_before_projection": phase6_export_ready,
        "manifest_compile_allowed": manifest_allowed,
        "blocked_reasons": blocked,
        "post_epsilon_s": round(_clamp(readings.get("post_epsilon_s")), 6),
        "reason": reason,
    }


def _manifest_output_targets(c3: dict[str, Any], allowed: bool) -> list[dict[str, Any]]:
    # The manifest may declare downstream targets, but C4 never renders them.
    base = [
        {"target": "json_packet", "status": "manifest_only_not_rendered", "renderer_required": "C5_or_later"},
        {"target": "dashboard_state", "status": "manifest_only_not_rendered", "renderer_required": "C5_or_later"},
    ]
    if allowed:
        base.append({"target": "text", "status": "eligible_for_future_renderer_after_echo_gate", "renderer_required": "Output Renderer"})
        base.append({"target": "memory_record", "status": "eligible_for_future_memory_writer_after_echo_and_approval", "renderer_required": "Memory Writer"})
    else:
        base.append({"target": "review_record", "status": "blocked_manifest_review_only", "renderer_required": "human_or_correction_review"})
    return base


def _operator_path(c3: dict[str, Any], allowed: bool) -> list[dict[str, Any]]:
    ops = [
        {"op": "I_t", "stage": "Input Event", "status": "present"},
        {"op": "Φ_t", "stage": "Phase Parser", "status": "present"},
        {"op": "M_t", "stage": "Memory Recaller", "status": "present"},
        {"op": "D_t", "stage": "Drift Analyzer", "status": "present"},
        {"op": "C_t", "stage": "Candidate Conclusion Generator", "status": "present"},
        {"op": "E_t", "stage": "Evolutionary Drift Explorer", "status": "present"},
        {"op": "S_t", "stage": "Coherence Scorer", "status": "present"},
        {"op": "χ_t", "stage": "Correction Engine", "status": "present" if c3.get("chi_t_present") else "missing"},
        {"op": "N_t", "stage": "Naming Engine", "status": "present" if c3.get("N_t_present") else "missing"},
        {"op": "μ_t", "stage": "Recursive Manifest Compiler", "status": "compiled" if allowed else "blocked_preflight"},
    ]
    return ops


def _extract_readings(c3: dict[str, Any]) -> dict[str, Any]:
    chi = _as_dict(c3.get("chi_t"))
    N = _as_dict(c3.get("N_t"))
    measured_inputs = _as_dict(chi.get("measured_inputs"))
    quality = _as_dict(chi.get("quality_calibration"))
    quality_components = _as_dict(quality.get("components"))
    post = _as_dict(_as_dict(chi.get("correction_math")).get("post_correction_estimate"))
    repair = _as_dict(chi.get("phase_repair"))
    repaired_metrics = _as_dict(repair.get("repaired_phase_metrics"))
    naming_report = _as_dict(N.get("naming_confidence_report"))
    route = _as_dict(chi.get("route_consistency"))
    return {
        "candidate_validity_score": _clamp(chi.get("candidate_validity_score") if chi.get("candidate_validity_score") is not None else quality.get("candidate_validity_score")),
        "projection_gated_score": _clamp(chi.get("projection_gated_score") if chi.get("projection_gated_score") is not None else quality.get("projection_gated_score")),
        "naming_confidence": _clamp(naming_report.get("naming_confidence")),
        "pre_epsilon_s": _clamp(measured_inputs.get("epsilon_s")),
        "post_epsilon_s": _clamp(post.get("epsilon_s")),
        "D_score": _clamp(measured_inputs.get("D_score")),
        "post_D_score": _clamp(post.get("D_score")),
        "sigma_res": _clamp(measured_inputs.get("sigma_res")),
        "memory_fit": _clamp(measured_inputs.get("memory_fit") if measured_inputs.get("memory_fit") is not None else quality_components.get("memory_fit")),
        "semantic_distance": _clamp(measured_inputs.get("semantic_distance") if measured_inputs.get("semantic_distance") is not None else quality_components.get("semantic_distance")),
        "novelty_delta": _clamp(measured_inputs.get("novelty_delta") if measured_inputs.get("novelty_delta") is not None else quality_components.get("novelty_delta")),
        "source_confidence": _clamp(measured_inputs.get("source_confidence") if measured_inputs.get("source_confidence") is not None else quality_components.get("source_confidence")),
        "phase_validity_score": _clamp(repaired_metrics.get("phase_validity_score")),
        "phase_path_legal": bool(repaired_metrics.get("phase_path_legal", False)),
        "route_consistent": bool(route.get("route_consistent", False)),
        "stable_naming": bool(N.get("stable_naming", False)),
        "naming_allowed": bool(N.get("naming_allowed", False)),
        "correction_allowed": bool(chi.get("correction_allowed", False)),
        "correction_status": str(chi.get("status") or ""),
        "naming_status": str(N.get("status") or ""),
        "novelty_budget": _clamp(quality.get("novelty_budget"), 0.01, 1.0),
        "support_pressure": _clamp(quality.get("support_pressure")),
    }


def _readiness_score(readings: dict[str, Any], memory_link_count: int, phase_metrics: dict[str, Any]) -> dict[str, Any]:
    candidate_validity = _clamp(readings.get("candidate_validity_score"))
    naming_conf = _clamp(readings.get("naming_confidence"))
    post_stability = 1.0 - _clamp(readings.get("post_epsilon_s"))
    memory_fit = _clamp(readings.get("memory_fit"))
    semantic_proximity = 1.0 - _clamp(readings.get("semantic_distance"))
    source_conf = _clamp(readings.get("source_confidence"))
    phase_validity = _clamp(phase_metrics.get("phase_validity_score") if phase_metrics else readings.get("phase_validity_score"))
    novelty_delta = _clamp(readings.get("novelty_delta"))
    novelty_budget = max(0.01, _clamp(readings.get("novelty_budget"), 0.01, 1.0))
    bounded_novelty_score = 1.0 - min(1.0, max(0.0, novelty_delta - novelty_budget) / novelty_budget)
    memory_presence_bonus = min(0.06, memory_link_count * 0.008)
    high_semantic_penalty = max(0.0, _clamp(readings.get("semantic_distance")) - 0.72) * 0.46
    high_novelty_penalty = max(0.0, novelty_delta - novelty_budget) * 0.50
    low_memory_penalty = max(0.0, 0.55 - memory_fit) * 0.38
    support_pressure_penalty = _clamp(readings.get("support_pressure")) * 0.16
    raw = (
        0.22 * candidate_validity
        + 0.18 * naming_conf
        + 0.16 * post_stability
        + 0.13 * memory_fit
        + 0.11 * source_conf
        + 0.10 * phase_validity
        + 0.06 * semantic_proximity
        + 0.04 * bounded_novelty_score
        + memory_presence_bonus
        - high_semantic_penalty
        - high_novelty_penalty
        - low_memory_penalty
        - support_pressure_penalty
    )
    score = _clamp(raw)
    return {
        "manifest_readiness_score": round(score, 6),
        "formula": "0.22*candidate_validity + 0.18*naming_confidence + 0.16*post_stability + 0.13*memory_fit + 0.11*source_confidence + 0.10*phase_validity + 0.06*semantic_proximity + 0.04*bounded_novelty + memory_presence_bonus - semantic/novelty/memory/support penalties",
        "components": {
            "candidate_validity_score": round(candidate_validity, 6),
            "naming_confidence": round(naming_conf, 6),
            "post_stability": round(post_stability, 6),
            "memory_fit": round(memory_fit, 6),
            "source_confidence": round(source_conf, 6),
            "phase_validity": round(phase_validity, 6),
            "semantic_proximity": round(semantic_proximity, 6),
            "bounded_novelty_score": round(_clamp(bounded_novelty_score), 6),
            "memory_presence_bonus": round(memory_presence_bonus, 6),
        },
        "penalties": {
            "high_semantic_penalty": round(_clamp(high_semantic_penalty), 6),
            "high_novelty_penalty": round(_clamp(high_novelty_penalty), 6),
            "low_memory_penalty": round(_clamp(low_memory_penalty), 6),
            "support_pressure_penalty": round(_clamp(support_pressure_penalty), 6),
        },
    }


def _gate_report(c3: dict[str, Any], readings: dict[str, Any], phase_metrics: dict[str, Any], readiness: dict[str, Any], memory_links: list[dict[str, Any]]) -> dict[str, Any]:
    N = _as_dict(c3.get("N_t"))
    chi = _as_dict(c3.get("chi_t"))
    repaired_path = phase_path(_as_list(N.get("phase_path")) or _as_list(_as_dict(chi.get("phase_repair")).get("repaired_phase_path")))
    post_eps = _clamp(readings.get("post_epsilon_s"))
    candidate_validity = _clamp(readings.get("candidate_validity_score"))
    naming_conf = _clamp(readings.get("naming_confidence"))
    readiness_score = _clamp(readiness.get("manifest_readiness_score"))
    novelty_delta = _clamp(readings.get("novelty_delta"))
    novelty_budget = _clamp(readings.get("novelty_budget"), 0.01, 1.0)

    checks = {
        "trace_present": bool(c3.get("trace_id")),
        "chi_t_present": bool(c3.get("chi_t_present") and chi),
        "N_t_present": bool(c3.get("N_t_present") and N),
        "correction_allowed": bool(readings.get("correction_allowed")),
        "post_epsilon_within_manifest_threshold": post_eps <= 0.35,
        "candidate_validity_strong": candidate_validity >= 0.62,
        "naming_confidence_strong": naming_conf >= 0.62,
        "stable_naming": bool(readings.get("stable_naming")),
        "naming_allowed": bool(readings.get("naming_allowed")),
        "route_consistent": bool(readings.get("route_consistent")),
        "phase_path_legal": bool(phase_metrics.get("phase_path_legal")),
        "phase6_before_naming": _phase6_before_naming(repaired_path),
        "phase6_and_7_before_projection_if_projection_requested": _phase6_before_projection(repaired_path),
        "memory_links_present": bool(memory_links),
        "novelty_within_budget": novelty_delta <= novelty_budget,
        "manifest_readiness_score_strong": readiness_score >= 0.62,
    }
    blocked_reasons = [key for key, ok in checks.items() if not bool(ok)]
    allowed = not blocked_reasons
    return {
        "manifest_compile_allowed": bool(allowed),
        "blocked_reasons": blocked_reasons,
        "gate_checks": checks,
        "gate_thresholds": {
            "post_epsilon_max": 0.35,
            "candidate_validity_min": 0.62,
            "naming_confidence_min": 0.62,
            "manifest_readiness_min": 0.62,
            "novelty_budget": round(novelty_budget, 6),
        },
        "measured_readings": readings,
        "phase_path_checked": repaired_path,
        "readiness": readiness,
        "axiom_enforcement": {
            "no_output_without_trace": checks["trace_present"],
            "meaning_precedes_rendering": True,
            "memory_must_be_phase_tagged": checks["memory_links_present"],
            "drift_classified_before_suppression": True,
            "novelty_requires_bounded_drift": checks["novelty_within_budget"],
            "phase6_closure_before_projection": checks["phase6_and_7_before_projection_if_projection_requested"],
            "language_is_output_modality_not_core_state": True,
        },
    }


def _claim_from(c3: dict[str, Any], selected_candidate: dict[str, Any]) -> str:
    N = _as_dict(c3.get("N_t"))
    for value in (
        N.get("definition"),
        selected_candidate.get("candidate"),
        selected_candidate.get("title"),
        N.get("proposed_name"),
    ):
        text = str(value or "").strip()
        if text:
            return text[:800]
    return "Unnamed manifest claim unavailable; return to naming/correction."


def _drift_status(c3: dict[str, Any], readings: dict[str, Any], gate: dict[str, Any]) -> dict[str, Any]:
    chi = _as_dict(c3.get("chi_t"))
    return {
        "status": "corrected_or_bounded_for_manifest" if gate.get("manifest_compile_allowed") else "blocked_before_manifest",
        "pre_epsilon_s": round(_clamp(readings.get("pre_epsilon_s")), 6),
        "post_epsilon_s": round(_clamp(readings.get("post_epsilon_s")), 6),
        "D_score": round(_clamp(readings.get("D_score")), 6),
        "post_D_score": round(_clamp(readings.get("post_D_score")), 6),
        "sigma_res": round(_clamp(readings.get("sigma_res")), 6),
        "semantic_distance": round(_clamp(readings.get("semantic_distance")), 6),
        "memory_fit": round(_clamp(readings.get("memory_fit")), 6),
        "novelty_delta": round(_clamp(readings.get("novelty_delta")), 6),
        "source_confidence": round(_clamp(readings.get("source_confidence")), 6),
        "correction_status": readings.get("correction_status"),
        "chi_t_action": chi.get("chi_t_action"),
        "blocked_reasons": gate.get("blocked_reasons", []),
    }


def _manifest_payload(c3: dict[str, Any], selected_candidate: dict[str, Any], gate: dict[str, Any], memory_links: list[dict[str, Any]]) -> dict[str, Any]:
    N = _as_dict(c3.get("N_t"))
    chi = _as_dict(c3.get("chi_t"))
    readings = _as_dict(gate.get("measured_readings"))
    phase = phase_path(_as_list(N.get("phase_path")) or _as_list(_as_dict(chi.get("phase_repair")).get("repaired_phase_path")))
    phase_metrics = phase_path_metrics(phase)
    readiness = _as_dict(gate.get("readiness"))
    output_targets = _manifest_output_targets(c3, bool(gate.get("manifest_compile_allowed")))
    claim = _claim_from(c3, selected_candidate)
    mu = {
        "claim": claim,
        "phase_path": phase,
        "operator_path": _operator_path(c3, bool(gate.get("manifest_compile_allowed"))),
        "memory_links": memory_links,
        "confidence": round(_clamp(readiness.get("manifest_readiness_score")), 6),
        "novelty": round(_clamp(readings.get("novelty_delta")), 6),
        "drift_status": _drift_status(c3, readings, gate),
        "projection_status": _projection_status(gate, phase, readings),
        "output_targets": output_targets,
    }
    manifest_id = _stable_id("mut", {
        "trace_id": c3.get("trace_id"),
        "candidate_id": c3.get("selected_candidate_id"),
        "claim": claim,
        "phase_path": phase,
        "confidence": mu.get("confidence"),
        "drift_status": mu.get("drift_status"),
    })
    return {
        "manifest_id": manifest_id,
        "manifest_symbol": "μ_t",
        "manifest_created_at_utc": _utc_now(),
        "manifest_status": "compiled_manifest_dry_run" if gate.get("manifest_compile_allowed") else "blocked_manifest_candidate",
        "μ_t": mu,
        "manifest_hash": _stable_hash(mu),
        "phase_metrics": phase_metrics,
        "source_ids": {
            "trace_id": c3.get("trace_id"),
            "run_id": c3.get("run_id"),
            "score_set_id": c3.get("score_set_id"),
            "candidate_set_id": c3.get("candidate_set_id"),
            "selected_candidate_id": c3.get("selected_candidate_id"),
            "chi_t_id": chi.get("chi_t_id"),
            "N_t_id": N.get("N_t_id"),
        },
        "schema_contract": manifest_schema_contract(),
        "renders_final_language": False,
        "projection_allowed": False,
        "memory_write_allowed": False,
        "approved_output": False,
    }


def compile_manifest(correction_naming_report: dict[str, Any]) -> dict[str, Any]:
    """Compile μ_t from C3R correction/naming if gates allow.

    The result is still a dry-run manifest object.  It is a pre-language symbolic
    object and cannot be treated as final output until renderer and echo stages
    exist.
    """
    if not isinstance(correction_naming_report, dict):
        correction_naming_report = {}
    c3 = correction_naming_report
    selected = _selected_candidate(c3)
    readings = _extract_readings(c3)
    N = _as_dict(c3.get("N_t"))
    chi = _as_dict(c3.get("chi_t"))
    phase = phase_path(_as_list(N.get("phase_path")) or _as_list(_as_dict(chi.get("phase_repair")).get("repaired_phase_path")))
    phase_metrics = phase_path_metrics(phase)
    memory_links = _memory_links(c3, selected)
    readiness = _readiness_score(readings, len(memory_links), phase_metrics)
    gate = _gate_report(c3, readings, phase_metrics, readiness, memory_links)
    manifest_payload = _manifest_payload(c3, selected, gate, memory_links)
    allowed = bool(gate.get("manifest_compile_allowed"))
    manifest_packet = manifest_payload if allowed else None
    blocked_candidate = manifest_payload if not allowed else None
    result_status = "OK" if allowed else "BLOCKED"
    return {
        "status": result_status,
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "stage": "Recursive Manifest Compiler",
        "manifest_compilation_allowed": allowed,
        "μ_t_present": bool(allowed),
        "manifest_packet": manifest_packet,
        "blocked_manifest_candidate": blocked_candidate,
        "manifest_preflight": gate,
        "source_correction_naming": c3,
        "C4_summary": {
            "manifest_allowed": allowed,
            "blocked_reason_count": len(gate.get("blocked_reasons", [])),
            "manifest_readiness_score": readiness.get("manifest_readiness_score"),
            "candidate_validity_score": readings.get("candidate_validity_score"),
            "naming_confidence": readings.get("naming_confidence"),
            "post_epsilon_s": readings.get("post_epsilon_s"),
            "memory_link_count": len(memory_links),
            "phase_path_legal": phase_metrics.get("phase_path_legal"),
            "renderer_next": True,
            "renderer_allowed_now": False,
            "projection_allowed": False,
            "memory_write_allowed": False,
        },
        "recommended_sequence": [
            "Use μ_t only as pre-language manifest state.",
            "Do not render language from C4 directly; C5 must render from μ_t.",
            "Do not write memory until Echo Validator and Memory Writer gates exist.",
            "If C4 blocks, return to correction/naming or add memory support instead of fabricating output.",
        ],
        "boundary": manifest_compiler_boundary(),
        "writes_files": False,
        "identity_vault_write": False,
        "rmc_live_memory_write": False,
        "renders_final_language": False,
        "projection_allowed": False,
        "memory_write_allowed": False,
        "approved_output": False,
    }


# Compatibility names for older main.py adapters and verifiers.
def compile_manifest_dry_run(report: dict[str, Any]) -> dict[str, Any]:
    return compile_manifest(report)

