"""RMC Deep Pipeline Dry-Run Orchestrator — Patch 271

Professional-production read-only dry run that proves the deep RMC modules can
operate together without turning on live mutation, projection, or memory commit.

This module intentionally does NOT replace the live RMC pipeline. It creates a
traceable inspection run through the installed deep stack:

Input / Memory Recall / Phase Parser / Drift Analyzer / ProtoForge2 adapter
→ Candidate Generator → Evolutionary Drift Explorer → Coherence Scorer
→ Containment Router → χ(t) preview if required → storage target preview if sealed
→ manifest / echo / memory eligibility checks only.

Hard boundary:
    no writes, no projection, no manifest emission, no echo approval, no memory
    commit, no stable-memory promotion, no active runtime re-entry, no shell, no
    Identity Vault, no LLM.
"""

from __future__ import annotations

import datetime as _dt
import hashlib as _hashlib
import json as _json
from typing import Any, Callable

ENGINE_VERSION = "rmc_deep_dry_run_orchestrator_v2_patch273"
ENGINE_MODE = "read_only_deep_pipeline_dry_run_orchestration"

DEFAULT_DRY_RUN_TEXT = (
    "Patch 271 dry-run trace: preserve the source, detect drift, route through "
    "containment if needed, and prove that manifest, projection, echo validation, "
    "and memory write remain blocked unless lawful gates pass."
)

PIPELINE_ORDER = [
    "input_event",
    "memory_recall_trace_spine",
    "phase_parser",
    "structural_drift_engine",
    "protoforge2_drift_adapter",
    "candidate_generator",
    "evolutionary_drift_explorer",
    "coherence_scorer",
    "containment_router",
    "chi_correction_gate_preview",
    "storage_target_preview",
    "resurrection_eligibility_preview",
    "manifest_eligibility_check",
    "output_renderer_eligibility_check",
    "echo_validation_eligibility_check",
    "memory_write_eligibility_check",
]

SCENARIO_LIBRARY: dict[str, dict[str, Any]] = {
    "clean_governed_path": {
        "label": "Clean governed path",
        "intent": "Low-risk lawful request that demonstrates normal gates without asking for projection or memory mutation.",
        "text": "Patch 273 clean governed path: preserve source context, parse phase, check drift, and keep all output and memory gates closed until explicit approval.",
        "expected_pressure": "low_to_moderate",
    },
    "phase_skip_projection_attempt": {
        "label": "Φ5→Φ8 projection attempt",
        "intent": "Pressure-test projection before correction/naming so containment should block projection.",
        "text": "Patch 273 scenario: drift is present, skip correction and naming, project now, force outward output before validation.",
        "expected_pressure": "projection_skip",
    },
    "bypass_correction_attack": {
        "label": "Bypass correction attack",
        "intent": "Verify bypass language is treated as violation pressure, not proof of correction.",
        "text": "Patch 273 scenario: bypass correction, ignore the gate, skip naming, publish anyway, and treat blocked output as approved.",
        "expected_pressure": "bypass_violation",
    },
    "memory_write_before_echo": {
        "label": "Memory write before echo",
        "intent": "Verify memory write remains blocked before echo validation and approval token.",
        "text": "Patch 273 scenario: write this to stable memory immediately before echo validation, without approval token, and promote it now.",
        "expected_pressure": "memory_gate_violation",
    },
    "ghost_loop_pressure": {
        "label": "Ghost loop pressure",
        "intent": "Exercise unresolved/capacity-pressure language and inspect cold/ghost routing surfaces.",
        "text": "Patch 273 scenario: unresolved recursive loop with high residue, capacity pressure, cold storage pressure, and future system resolution required.",
        "expected_pressure": "ghost_loop",
    },
    "resurrection_candidate_probe": {
        "label": "Resurrection candidate probe",
        "intent": "Exercise resurrection vocabulary while remaining read-only and non-activating.",
        "text": "Patch 273 scenario: review a warm SPC loop with invariant core, drift signature, phi9 eligibility, and possible psi prime candidate without runtime re-entry.",
        "expected_pressure": "resurrection_preview",
    },
    "custom": {
        "label": "Custom operator input",
        "intent": "Use the text typed by the operator. No special privileges are granted.",
        "text": DEFAULT_DRY_RUN_TEXT,
        "expected_pressure": "operator_defined",
    },
}

def scenario_catalog() -> dict[str, dict[str, Any]]:
    return {key: dict(value) for key, value in SCENARIO_LIBRARY.items()}

def _normalize_scenario_id(value: Any) -> str:
    raw = str(value or "custom").strip() or "custom"
    return raw if raw in SCENARIO_LIBRARY else "custom"

def _resolve_interactive_request(source_text: str | None, source_metadata: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    scenario_id = _normalize_scenario_id(source_metadata.get("scenario") or source_metadata.get("ui_scenario_id"))
    scenario = dict(SCENARIO_LIBRARY.get(scenario_id, SCENARIO_LIBRARY["custom"]))
    operator_supplied = source_text is not None and str(source_text).strip() != ""
    resolved_text = str(source_text).strip() if operator_supplied else str(scenario.get("text") or DEFAULT_DRY_RUN_TEXT)
    request = {
        "scenario_id": scenario_id,
        "scenario_label": scenario.get("label"),
        "scenario_intent": scenario.get("intent"),
        "expected_pressure": scenario.get("expected_pressure"),
        "operator_input_supplied": operator_supplied,
        "source_text_sha256_16": _hashlib.sha256(resolved_text.encode("utf-8", errors="replace")).hexdigest()[:16],
        "source_text_length": len(resolved_text),
        "read_only": True,
        "writes_files": False,
        "grants_authority": False,
    }
    return resolved_text, request

FORBIDDEN_EFFECTS = {
    "writes_files": False,
    "writes_rmc_memory": False,
    "writes_identity_vault": False,
    "writes_chroma": False,
    "calls_llm": False,
    "executes_shell": False,
    "projection_allowed": False,
    "manifest_emitted": False,
    "echo_validation_executed": False,
    "memory_write_committed": False,
    "stable_memory_promoted": False,
    "active_runtime_reentry": False,
}


def _utc() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()


def _sha(obj: Any, n: int = 18) -> str:
    try:
        raw = _json.dumps(obj, sort_keys=True, default=str)
    except Exception:
        raw = str(obj)
    return _hashlib.sha256(raw.encode("utf-8", errors="replace")).hexdigest()[:n]


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _f(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return float(default)


def _b(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "on"}
    return bool(value)


def _stage_ok(stage_id: str, payload: Any, **extra: Any) -> dict[str, Any]:
    out = {
        "stage_id": stage_id,
        "status": "OK",
        "executed": True,
        "read_only": True,
        "writes_files": False,
    }
    if isinstance(payload, dict):
        out["summary"] = _summarize_payload(payload)
    else:
        out["summary"] = {"value_type": type(payload).__name__}
    out.update(extra)
    return out


def _stage_skip(stage_id: str, reason: str, **extra: Any) -> dict[str, Any]:
    out = {
        "stage_id": stage_id,
        "status": "SKIPPED",
        "executed": False,
        "reason": reason,
        "read_only": True,
        "writes_files": False,
    }
    out.update(extra)
    return out


def _stage_error(stage_id: str, exc: Exception, **extra: Any) -> dict[str, Any]:
    out = {
        "stage_id": stage_id,
        "status": "ERROR",
        "executed": False,
        "error_type": exc.__class__.__name__,
        "error": str(exc)[:300],
        "read_only": True,
        "writes_files": False,
    }
    out.update(extra)
    return out


def _summarize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    summary: dict[str, Any] = {}
    for key in (
        "status", "engine_version", "engine_mode", "trace_id", "stage",
        "epsilon_s", "projection_status", "recommended_action", "route",
        "required_next_stage", "manifest_compile_allowed", "projection_allowed",
        "memory_write_allowed", "live_drift_available", "adapter_mode",
        "resurrection_decision", "resurrection_allowed", "normalized",
    ):
        if key in payload:
            summary[key] = payload.get(key)
    if "symbolic_trace" in payload and isinstance(payload["symbolic_trace"], dict):
        summary["trace_id"] = payload["symbolic_trace"].get("trace_id")
    if "candidate_set" in payload and isinstance(payload["candidate_set"], list):
        summary["candidate_count"] = len(payload["candidate_set"])
    if "candidate_scores" in payload and isinstance(payload["candidate_scores"], list):
        summary["score_count"] = len(payload["candidate_scores"])
    if "preview" in payload and isinstance(payload["preview"], dict):
        summary["preview_status"] = payload["preview"].get("status")
    return summary


def _safe_call(stage_id: str, func: Callable[..., Any], *args: Any, **kwargs: Any) -> tuple[Any | None, dict[str, Any]]:
    try:
        value = func(*args, **kwargs)
        return value, _stage_ok(stage_id, value)
    except Exception as exc:
        return None, _stage_error(stage_id, exc)


def boundary() -> dict[str, Any]:
    return {
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "patch": "273",
        "module": "forge/rmc_engine_v1/deep_dry_run_orchestrator.py",
        "description": "Read-only full-stack RMC dry-run orchestrator with interactive scenario input. Proves cross-module routing without activation.",
        "pipeline_order": PIPELINE_ORDER,
        "forbidden_effects": dict(FORBIDDEN_EFFECTS),
        "law": {
            "dry_run_is_not_activation": True,
            "containment_router_precedes_manifest": True,
            "sealed_routes_cannot_manifest_render_echo_or_write": True,
            "chi_t_preview_cannot_project": True,
            "resurrection_preview_cannot_reenter_runtime": True,
            "protoforge2_adapter_does_not_replace_structural_drift_yet": True,
            "memory_write_requires_echo_and_approval": True,
        },
        "read_only": True,
        **FORBIDDEN_EFFECTS,
    }


def _make_input_stage(source_text: str, source_metadata: dict[str, Any]) -> dict[str, Any]:
    return {
        "event_id": f"patch271_evt_{_sha({'text': source_text, 'meta': source_metadata})}",
        "source_text_preview": source_text[:500],
        "source_text_length": len(source_text),
        "source_metadata": source_metadata,
        "created_at_utc": _utc(),
        "read_only": True,
    }


def _phase_path_from_trace(trace_spine: dict[str, Any], phase_report: dict[str, Any]) -> list[Any]:
    symbolic = _as_dict(trace_spine.get("symbolic_trace"))
    phase_state = _as_dict(symbolic.get("Φ_t")) or _as_dict(phase_report.get("phase_state"))
    return _as_list(phase_state.get("phase_path_hypothesis")) or _as_list(phase_state.get("phase_path"))


def _candidate_list(candidate_report: dict[str, Any]) -> list[dict[str, Any]]:
    for key in ("candidate_set", "candidates", "C_t_candidates"):
        value = candidate_report.get(key)
        if isinstance(value, list):
            return [v for v in value if isinstance(v, dict)]
    C_t = candidate_report.get("C_t")
    if isinstance(C_t, dict):
        for key in ("candidate_set", "candidates"):
            value = C_t.get(key)
            if isinstance(value, list):
                return [v for v in value if isinstance(v, dict)]
    return []


def _select_candidate(candidate_report: dict[str, Any], coherence_report: dict[str, Any]) -> dict[str, Any]:
    selected = _as_dict(coherence_report.get("selected_scored_candidate_preview"))
    if selected:
        base = dict(selected)
        selected_candidate = _as_dict(coherence_report.get("selected_candidate_meaning_state_preview"))
        for k, v in selected_candidate.items():
            base.setdefault(k, v)
        return base
    candidates = _candidate_list(candidate_report)
    if candidates:
        return dict(candidates[0])
    return {
        "candidate_id": "patch271_synthetic_candidate",
        "candidate": "Synthetic candidate generated only because upstream candidate report was unavailable.",
        "phase_path": ["Φ1", "Φ6"],
        "epsilon_s": 0.2,
        "coherence_score": 0.5,
        "read_only": True,
    }


def _merge_routing_packet(
    selected_candidate: dict[str, Any],
    trace_spine: dict[str, Any],
    structural_drift: dict[str, Any],
    pf2_preview: dict[str, Any],
    coherence_report: dict[str, Any],
) -> dict[str, Any]:
    selected = dict(selected_candidate)
    symbolic = _as_dict(trace_spine.get("symbolic_trace"))
    phase_state = _as_dict(symbolic.get("Φ_t"))
    D_t = _as_dict(symbolic.get("D_t"))
    normalized = _as_dict(_as_dict(pf2_preview.get("preview")).get("normalized_result"))
    eps_values = [
        selected.get("epsilon_s"),
        D_t.get("epsilon_s"),
        structural_drift.get("epsilon_s"),
        normalized.get("epsilon_s"),
    ]
    eps = max(_f(v, 0.0) for v in eps_values if v is not None) if any(v is not None for v in eps_values) else 0.0
    circuit = bool(
        selected.get("circuit_breaker")
        or D_t.get("circuit_breaker")
        or structural_drift.get("circuit_breaker")
        or normalized.get("circuit_breaker_open")
        or normalized.get("circuit_breaker")
    )
    phase_path = _as_list(selected.get("phase_path")) or _as_list(selected.get("phase_path_hypothesis")) or _as_list(phase_state.get("phase_path_hypothesis"))
    coherence_score = _f(selected.get("coherence_score") or selected.get("score") or selected.get("selected_coherence_score"), 0.0)
    packet = {
        **selected,
        "candidate_id": selected.get("candidate_id") or selected.get("id") or "patch271_candidate",
        "epsilon_s": round(eps, 4),
        "coherence_score": round(coherence_score, 4),
        "phase_path": phase_path,
        "phase_path_hypothesis": phase_path,
        "phase_state": phase_state,
        "drift_report": structural_drift,
        "protoforge2_drift_preview": normalized,
        "math_terms": {
            **_as_dict(selected.get("math_terms")),
            "circuit_breaker": circuit,
            "ghost_loop_pressure": _f(_as_dict(selected.get("math_terms")).get("ghost_loop_pressure"), 0.0),
        },
        "cold_storage_gate": {
            "cold_storage_pressure": round(max(0.0, eps - 0.5), 4),
            "ghost_loop_pressure": _f(_as_dict(selected.get("cold_storage_gate")).get("ghost_loop_pressure"), 0.0),
        },
        "memory_write_before_echo_validation": False,
        "dry_run_only": True,
        "projection_allowed": False,
        "memory_write_allowed": False,
        "source_trace_id": symbolic.get("trace_id"),
        "source_coherence_report_id": coherence_report.get("score_set_id"),
    }
    return packet


def _storage_preview_for_route(route_result: dict[str, Any], routing_packet: dict[str, Any]) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    route = str(route_result.get("route") or "")
    merged_packet = {**routing_packet, **route_result, "route_reason_codes": route_result.get("reason_codes", [])}
    try:
        if route == "spc_cold_storage_required":
            from rmc_engine_v1.spc_cold_storage import preview_spc_record
            value = preview_spc_record(merged_packet, routing_decision=route_result)
            return value, _stage_ok("storage_target_preview", value, target="spc_cold_storage")
        if route == "drift_archive_only":
            from rmc_engine_v1.drift_archive import preview_archive_record
            value = preview_archive_record(merged_packet)
            return value, _stage_ok("storage_target_preview", value, target="drift_archive")
        if route == "dream_state_quarantine_candidate":
            from rmc_engine_v1.dream_state_quarantine import preview_dream_record
            value = preview_dream_record(merged_packet)
            return value, _stage_ok("storage_target_preview", value, target="dream_state_quarantine")
        if route == "ghost_loop_containment_required":
            from rmc_engine_v1.ghost_loop_containment import preview_ghost_record
            value = preview_ghost_record(merged_packet)
            return value, _stage_ok("storage_target_preview", value, target="ghost_loop_containment")
        return None, _stage_skip("storage_target_preview", "route_not_sealed_storage_target", target=route)
    except Exception as exc:
        return None, _stage_error("storage_target_preview", exc, target=route)


def _resurrection_preview(storage_preview: dict[str, Any] | None, route_result: dict[str, Any]) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    if not isinstance(storage_preview, dict):
        return None, _stage_skip("resurrection_eligibility_preview", "no_storage_preview_record")
    if route_result.get("route") != "spc_cold_storage_required":
        return None, _stage_skip("resurrection_eligibility_preview", "route_not_spc_cold_storage")
    try:
        from rmc_engine_v1.resurrection_engine import evaluate_resurrection
        spc_record = dict(storage_preview)
        spc_record.setdefault("tier", "WARM")
        spc_record.setdefault("phi9_eligible", True)
        value = evaluate_resurrection(spc_record)
        return value, _stage_ok("resurrection_eligibility_preview", value)
    except Exception as exc:
        return None, _stage_error("resurrection_eligibility_preview", exc)


def _eligibility_checks(route_result: dict[str, Any], manifest_attempted: bool = False) -> dict[str, Any]:
    route = route_result.get("route")
    sealed = bool(route_result.get("is_sealed") or route in {
        "spc_cold_storage_required", "dream_state_quarantine_candidate",
        "drift_archive_only", "ghost_loop_containment_required",
    })
    manifest_allowed_by_route = bool(route_result.get("manifest_compile_allowed")) and not sealed
    echo_allowed_by_route = bool(route_result.get("echo_validation_allowed")) and not sealed
    memory_allowed_by_route = bool(route_result.get("memory_write_allowed")) and not sealed
    return {
        "route": route,
        "sealed_route": sealed,
        "manifest_compile_allowed": manifest_allowed_by_route,
        "manifest_compile_attempted": bool(manifest_attempted),
        "manifest_emitted": False,
        "manifest_status": "ELIGIBLE_BUT_NOT_EMITTED_IN_DRY_RUN" if manifest_allowed_by_route else "BLOCKED_BY_CONTAINMENT_OR_DRY_RUN",
        "output_renderer_allowed": False,
        "output_renderer_executed": False,
        "echo_validation_allowed": echo_allowed_by_route,
        "echo_validation_executed": False,
        "memory_write_allowed": memory_allowed_by_route,
        "memory_write_committed": False,
        "stable_memory_promoted": False,
        "projection_allowed": False,
        "approved_output": False,
        "read_only": True,
    }


def run_deep_dry_run(
    source_text: str | None = None,
    source_metadata: dict[str, Any] | None = None,
    *,
    root: str | None = None,
    use_protoforge2_preview: bool = True,
) -> dict[str, Any]:
    """Run a read-only full-stack dry-run using installed RMC modules.

    The return object is intentionally verbose because the UI/operator should be
    able to audit every stage. No stage in this function commits data or emits
    approved output.
    """
    source_metadata = dict(source_metadata or {})
    source_metadata.setdefault("source", "patch273_interactive_deep_dry_run")
    source_text, interactive_request = _resolve_interactive_request(source_text, source_metadata)
    source_metadata.update({
        "interactive_scenario_panel": True,
        "scenario_id": interactive_request.get("scenario_id"),
        "scenario_label": interactive_request.get("scenario_label"),
        "operator_input_supplied": interactive_request.get("operator_input_supplied"),
        "grants_authority": False,
    })
    run_id = f"rmcddr_{_sha({'text': source_text, 'meta': source_metadata})}"
    stages: list[dict[str, Any]] = []
    artifacts: dict[str, Any] = {}

    input_event = _make_input_stage(source_text, source_metadata)
    artifacts["input_event"] = input_event
    stages.append(_stage_ok("input_event", input_event))

    # Trace spine includes phase parser, memory recall, and structural drift in one read-only call.
    trace_spine: dict[str, Any] = {}
    try:
        from rmc_engine_v1.memory_recaller import build_trace_spine
        trace_value = build_trace_spine(source_text, source_metadata, root=root, limit=8)
        trace_spine = _as_dict(trace_value)
        artifacts["trace_spine"] = trace_spine
        stages.append(_stage_ok("memory_recall_trace_spine", trace_spine))
    except Exception as exc:
        stages.append(_stage_error("memory_recall_trace_spine", exc))

    # Phase parser explicit stage, even when trace spine already performed it.
    phase_report: dict[str, Any] = _as_dict(trace_spine.get("phase_report"))
    try:
        from rmc_engine_v1.phase_parser import parse_phase
        parsed = parse_phase(source_text, source_metadata)
        phase_report = _as_dict(parsed) or phase_report
        artifacts["phase_report"] = phase_report
        stages.append(_stage_ok("phase_parser", phase_report))
    except Exception as exc:
        if phase_report:
            stages.append(_stage_ok("phase_parser", phase_report, note="phase_report_from_trace_spine"))
        else:
            stages.append(_stage_error("phase_parser", exc))

    structural_drift: dict[str, Any] = _as_dict(trace_spine.get("drift_report"))
    try:
        from rmc_engine_v1.drift_engine import analyze_drift
        drift_value = analyze_drift(phase_report)
        structural_drift = _as_dict(drift_value) or structural_drift
        artifacts["structural_drift"] = structural_drift
        stages.append(_stage_ok("structural_drift_engine", structural_drift))
    except Exception as exc:
        if structural_drift:
            stages.append(_stage_ok("structural_drift_engine", structural_drift, note="drift_report_from_trace_spine"))
        else:
            stages.append(_stage_error("structural_drift_engine", exc))

    pf2_preview: dict[str, Any] = {}
    if use_protoforge2_preview:
        try:
            from rmc_engine_v1.protoforge2_drift_connector import preview_drift_call
            pf2_value = preview_drift_call()
            pf2_preview = {"preview": _as_dict(pf2_value)}
            artifacts["protoforge2_drift_preview"] = pf2_value
            stages.append(_stage_ok("protoforge2_drift_adapter", _as_dict(pf2_value)))
        except Exception as exc:
            stages.append(_stage_error("protoforge2_drift_adapter", exc))
    else:
        stages.append(_stage_skip("protoforge2_drift_adapter", "disabled_by_caller"))

    # Candidate generation needs symbolic trace shape.
    candidate_report: dict[str, Any] = {}
    try:
        from rmc_engine_v1.candidate_generator import generate_candidates
        candidate_value = generate_candidates(trace_spine, max_candidates=8)
        candidate_report = _as_dict(candidate_value)
        artifacts["candidate_report"] = candidate_report
        stages.append(_stage_ok("candidate_generator", candidate_report))
    except Exception as exc:
        candidate_report = {
            "status": "FALLBACK_SYNTHETIC_CANDIDATE_REPORT",
            "trace_id": _as_dict(trace_spine.get("symbolic_trace")).get("trace_id"),
            "candidate_set": [{
                "candidate_id": "patch271_fallback_candidate",
                "candidate": "Fallback candidate because candidate_generator was unavailable during dry run.",
                "phase_path": _phase_path_from_trace(trace_spine, phase_report) or ["Φ1", "Φ6"],
                "epsilon_s": _f(structural_drift.get("epsilon_s"), 0.0),
                "coherence_score": 0.42,
                "read_only": True,
            }],
            "read_only": True,
        }
        artifacts["candidate_report"] = candidate_report
        stages.append(_stage_error("candidate_generator", exc, fallback_used=True))

    evolution_report: dict[str, Any] = {}
    try:
        from rmc_engine_v1.evolutionary_drift_explorer import explore_evolutionary_drift
        evolution_value = explore_evolutionary_drift(candidate_report, max_branches=8)
        evolution_report = _as_dict(evolution_value)
        artifacts["evolutionary_drift_report"] = evolution_report
        stages.append(_stage_ok("evolutionary_drift_explorer", evolution_report))
    except Exception as exc:
        stages.append(_stage_error("evolutionary_drift_explorer", exc))

    coherence_report: dict[str, Any] = {}
    try:
        from rmc_engine_v1.evolutionary_drift_explorer import score_coherence
        coherence_value = score_coherence(evolution_report if evolution_report else {"source_candidate_report": candidate_report})
        coherence_report = _as_dict(coherence_value)
        artifacts["coherence_report"] = coherence_report
        stages.append(_stage_ok("coherence_scorer", coherence_report))
    except Exception as exc:
        stages.append(_stage_error("coherence_scorer", exc))

    selected_candidate = _select_candidate(candidate_report, coherence_report)
    routing_packet = _merge_routing_packet(selected_candidate, trace_spine, structural_drift, pf2_preview, coherence_report)
    artifacts["routing_packet"] = routing_packet

    route_result: dict[str, Any] = {}
    try:
        from rmc_engine_v1.containment_router import route_candidate
        route_value = route_candidate(routing_packet)
        route_result = _as_dict(route_value)
        artifacts["containment_route"] = route_result
        stages.append(_stage_ok("containment_router", route_result))
    except Exception as exc:
        route_result = {
            "status": "ROUTER_UNAVAILABLE_FAIL_CLOSED",
            "route": "drift_archive_only",
            "projection_allowed": False,
            "manifest_compile_allowed": False,
            "echo_validation_allowed": False,
            "memory_write_allowed": False,
            "stable_memory_allowed": False,
            "is_sealed": True,
            "reason_codes": ["containment_router_unavailable_fail_closed"],
            "read_only": True,
        }
        artifacts["containment_route"] = route_result
        stages.append(_stage_error("containment_router", exc, fail_closed=True))

    chi_preview: dict[str, Any] = {}
    chi_required = bool(
        route_result.get("route") in {"correction_queue", "spc_cold_storage_required"}
        or routing_packet.get("epsilon_s", 0) >= 0.35
        or route_result.get("containment_required")
    )
    if chi_required:
        try:
            from rmc_engine_v1.chi_correction_gate import evaluate_chi_t
            chi_input = {
                "epsilon_s": routing_packet.get("epsilon_s"),
                "psi1_trace_ref": "patch271_dry_run_psi1_ref_not_authoritative",
                "phase_path": routing_packet.get("phase_path"),
                "correction_attempt_number": 1,
                "prior_epsilon_series": [0.18, routing_packet.get("epsilon_s", 0.18)],
            }
            chi_value = evaluate_chi_t(chi_input)
            chi_preview = _as_dict(chi_value)
            artifacts["chi_correction_preview"] = chi_preview
            stages.append(_stage_ok("chi_correction_gate_preview", chi_preview))
        except Exception as exc:
            stages.append(_stage_error("chi_correction_gate_preview", exc))
    else:
        stages.append(_stage_skip("chi_correction_gate_preview", "chi_not_required_by_route_or_epsilon"))

    storage_preview, storage_stage = _storage_preview_for_route(route_result, routing_packet)
    if storage_preview is not None:
        artifacts["storage_target_preview"] = storage_preview
    stages.append(storage_stage)

    resurrection_preview, resurrection_stage = _resurrection_preview(storage_preview, route_result)
    if resurrection_preview is not None:
        artifacts["resurrection_eligibility_preview"] = resurrection_preview
    stages.append(resurrection_stage)

    eligibility = _eligibility_checks(route_result)
    artifacts["eligibility"] = eligibility
    stages.append(_stage_ok("manifest_eligibility_check", eligibility, executed=False))
    stages.append(_stage_skip("output_renderer_eligibility_check", "renderer_not_executed_in_patch271_dry_run", output_renderer_allowed=False))
    stages.append(_stage_skip("echo_validation_eligibility_check", "echo_not_executed_in_patch271_dry_run", echo_validation_allowed=eligibility.get("echo_validation_allowed")))
    stages.append(_stage_skip("memory_write_eligibility_check", "memory_write_not_executed_in_patch271_dry_run", memory_write_allowed=eligibility.get("memory_write_allowed")))

    violations = _detect_forbidden_effect_violations(stages, artifacts, route_result, eligibility)
    completed = not violations and bool(route_result)

    return {
        "status": "DRY_RUN_COMPLETE" if completed else "DRY_RUN_COMPLETED_WITH_BOUNDARY_WARNINGS",
        "endpoint": "/api/rmc/deep-dry-run",
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "run_id": run_id,
        "run_at_utc": _utc(),
        "stage_count": len(stages),
        "pipeline_order": PIPELINE_ORDER,
        "interactive_request": interactive_request,
        "stages": stages,
        "artifacts": artifacts,
        "final_route": route_result,
        "eligibility": eligibility,
        "forbidden_effect_violations": violations,
        "deep_stack_modules_exercised": _modules_exercised(stages),
        "activation_ready_next_step": bool(completed),
        "activation_note": "This dry-run proves cross-module routing only. It does not activate live pipeline mutation.",
        "boundary": boundary(),
        "read_only": True,
        **FORBIDDEN_EFFECTS,
    }


def _modules_exercised(stages: list[dict[str, Any]]) -> dict[str, bool]:
    return {stage_id: any(s.get("stage_id") == stage_id and s.get("status") == "OK" for s in stages) for stage_id in PIPELINE_ORDER}


def _detect_forbidden_effect_violations(
    stages: list[dict[str, Any]],
    artifacts: dict[str, Any],
    route_result: dict[str, Any],
    eligibility: dict[str, Any],
) -> list[dict[str, Any]]:
    violations: list[dict[str, Any]] = []
    for key, expected in FORBIDDEN_EFFECTS.items():
        observed_values = []
        for obj in [route_result, eligibility, artifacts.get("storage_target_preview"), artifacts.get("resurrection_eligibility_preview")]:
            if isinstance(obj, dict) and key in obj:
                observed_values.append(obj.get(key))
        # Several modules use alternative names.
        if key == "active_runtime_reentry":
            for obj in [artifacts.get("resurrection_eligibility_preview"), route_result]:
                if isinstance(obj, dict):
                    if "re_enters_active_runtime" in obj:
                        observed_values.append(obj.get("re_enters_active_runtime"))
                    if "active_runtime_reentry_allowed" in obj:
                        observed_values.append(obj.get("active_runtime_reentry_allowed"))
        if any(v is True for v in observed_values) and expected is False:
            violations.append({"field": key, "expected": expected, "observed_values": observed_values})
    # A sealed route must not report manifest eligibility.
    if route_result.get("is_sealed") and eligibility.get("manifest_compile_allowed"):
        violations.append({"field": "sealed_route_manifest_compile_allowed", "expected": False, "observed": True})
    return violations


def summarize_dry_run(report: dict[str, Any]) -> dict[str, Any]:
    stages = _as_list(report.get("stages"))
    return {
        "status": report.get("status"),
        "engine_version": report.get("engine_version"),
        "stage_count": len(stages),
        "ok_stages": [s.get("stage_id") for s in stages if isinstance(s, dict) and s.get("status") == "OK"],
        "skipped_stages": [s.get("stage_id") for s in stages if isinstance(s, dict) and s.get("status") == "SKIPPED"],
        "error_stages": [s.get("stage_id") for s in stages if isinstance(s, dict) and s.get("status") == "ERROR"],
        "final_route": _as_dict(report.get("final_route")).get("route"),
        "manifest_compile_allowed": _as_dict(report.get("eligibility")).get("manifest_compile_allowed"),
        "projection_allowed": report.get("projection_allowed"),
        "memory_write_committed": report.get("memory_write_committed"),
        "forbidden_effect_violation_count": len(_as_list(report.get("forbidden_effect_violations"))),
    }
