"""RMC Pipeline Summary + Compact Trace Surface.

Patch 262J1R-Preflight-C9 adds a compact orchestration surface on top of the
already-built RMC spine. It does not replace the individual stage engines and it
must not hide their gates. Its job is to read the stage reports, classify which
stage is blocking, distinguish algorithm failures from lawful gate refusals, and
return a compact status object suitable for the Forge UI and operator review.

Default behavior is read-only. The gated memory writer is not called unless the
adapter explicitly supplies a C8 report, which should only happen when the user
supplies an approval token through the gated writer endpoint.
"""
from __future__ import annotations

import datetime as _dt
import hashlib as _hashlib
import re as _re
from typing import Any

ENGINE_VERSION = "rmc_pipeline_summary_v1_patch262J1R_preflight_C9"
ENGINE_MODE = "rmc_pipeline_summary_compact_trace_C9"

STAGE_ORDER = [
    "phase_parser",
    "memory_recaller",
    "trace_spine",
    "candidate_generator",
    "evolutionary_drift_explorer",
    "coherence_scorer",
    "correction_naming",
    "manifest_compiler",
    "output_renderer",
    "echo_validator",
    "memory_writer_dry_run",
    "gated_memory_writer",
]


def _now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()


def _as_dict(value: Any) -> dict[str, Any]:
    return dict(value) if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if value in (None, "", {}):
        return []
    return [value]


def _text(value: Any, limit: int = 500) -> str:
    text = str(value or "").strip()
    text = _re.sub(r"\s+", " ", text)
    return text[:limit]


def _hash(value: Any) -> str:
    return _hashlib.sha256(str(value).encode("utf-8", errors="replace")).hexdigest()


def _bool(value: Any) -> bool:
    return bool(value is True or str(value).lower() in ("true", "yes", "1", "ok"))


def pipeline_boundary() -> dict[str, Any]:
    return {
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "engine_module_location": "forge/rmc_engine_v1/rmc_pipeline.py",
        "implements_rmc_stage": "RMC Pipeline Summary + Compact Trace Surface",
        "read_only_by_default": True,
        "writes_files": False,
        "writes_rmc_memory": False,
        "commits_memory_only_if_external_C8_report_supplied": True,
        "uses_llm": False,
        "executes_shell": False,
        "queries_chroma": False,
        "writes_identity_vault": False,
        "mutates_canonical_reference": False,
        "ui_is_authority": False,
        "forge_governs": True,
        "purpose": "Expose compact pipeline truth without flattening lawful gate refusals into algorithm failures.",
    }


def _status_word(report: dict[str, Any]) -> str:
    return str(report.get("status") or report.get("stage_status") or "UNKNOWN").upper()


def _failure_code(report: dict[str, Any]) -> str | None:
    value = report.get("failure_code") or report.get("error") or report.get("exception")
    return str(value) if value else None


def _blocked_reasons(report: dict[str, Any]) -> list[str]:
    reasons: list[str] = []
    for key in ("blocked_reasons", "reason_codes", "failure_reasons"):
        for item in _as_list(report.get(key)):
            if isinstance(item, str) and item not in reasons:
                reasons.append(item)
    for container_key in ("blocked_manifest_candidate", "blocked_render_candidate", "blocked_echo_candidate", "blocked_write_candidate"):
        container = _as_dict(report.get(container_key))
        for item in _as_list(container.get("reason_codes") or container.get("blocked_reasons")):
            if isinstance(item, str) and item not in reasons:
                reasons.append(item)
    return reasons


def _gate_class(report: dict[str, Any]) -> dict[str, Any]:
    gate = _as_dict(report.get("gate_classification"))
    if gate:
        return {
            "algorithm_failure": bool(gate.get("algorithm_failure")),
            "gate_refusal": bool(gate.get("gate_refusal")),
            "read_only_refusal": gate.get("read_only_refusal", False),
            "explanation": _text(gate.get("explanation"), 300),
        }
    status = _status_word(report)
    failure = _failure_code(report)
    reasons = _blocked_reasons(report)
    algorithm_failure = status in ("ERROR", "EXCEPTION", "TRACEBACK") or bool(failure and "EXCEPTION" in failure.upper())
    gate_refusal = status in ("BLOCKED", "REFUSED") and not algorithm_failure
    return {
        "algorithm_failure": algorithm_failure,
        "gate_refusal": gate_refusal,
        "read_only_refusal": bool(report.get("read_only") and gate_refusal),
        "explanation": "derived from stage status and failure/reason codes",
        "failure_code": failure,
        "reason_codes": reasons,
    }


def _extract_phase(report: dict[str, Any]) -> dict[str, Any]:
    phase_report = _as_dict(report.get("phase_report")) or report
    state = _as_dict(phase_report.get("phase_state"))
    if not state:
        state = _as_dict(report.get("phase_state"))
    return {
        "phase_primary": state.get("phase_primary"),
        "phase_secondary": _as_list(state.get("phase_secondary")),
        "phase_path_hypothesis": _as_list(state.get("phase_path_hypothesis")),
        "confidence": state.get("confidence"),
        "confidence_status": state.get("confidence_status"),
        "token_boundary_mode": state.get("token_boundary_mode"),
    }


def _stage_summary(name: str, report: dict[str, Any]) -> dict[str, Any]:
    report = _as_dict(report)
    status = _status_word(report)
    gate = _gate_class(report)
    summary: dict[str, Any] = {
        "stage": name,
        "status": status,
        "engine_version": report.get("engine_version"),
        "mode": report.get("mode") or report.get("engine_mode"),
        "algorithm_failure": gate.get("algorithm_failure", False),
        "gate_refusal": gate.get("gate_refusal", False),
        "read_only_refusal": gate.get("read_only_refusal", False),
        "failure_code": gate.get("failure_code") or _failure_code(report),
        "reason_codes": gate.get("reason_codes") or _blocked_reasons(report),
    }

    if name == "phase_parser":
        summary.update(_extract_phase(report))
    elif name == "memory_recaller":
        memory_state = _as_dict(report.get("memory_state"))
        summary.update({
            "active_memory_count": report.get("active_memory_count") or memory_state.get("active_memory_count"),
            "candidate_nodes_collected": report.get("candidate_nodes_collected") or memory_state.get("candidate_nodes_collected"),
            "retrieval_dimensions": _as_list(report.get("retrieval_dimensions") or memory_state.get("retrieval_dimensions")),
        })
    elif name == "trace_spine":
        summary.update({
            "I_t_present": bool(report.get("I_t") or report.get("input_event")),
            "M_t_present": bool(report.get("M_t") or report.get("memory_recall")),
            "phase_primary": _extract_phase(report).get("phase_primary"),
            "rendering_allowed": bool(report.get("rendering_allowed", False)),
            "memory_write_allowed": bool(report.get("memory_write_allowed", False)),
        })
    elif name == "candidate_generator":
        C_t = _as_dict(report.get("C_t"))
        candidate_set = _as_list(report.get("candidate_set") or C_t.get("candidate_set"))
        summary.update({
            "C_t_present": bool(report.get("C_t") or candidate_set),
            "candidate_count": report.get("candidate_count") or len(candidate_set),
            "candidate_generation_allowed": report.get("candidate_generation_allowed"),
            "renders_final_language": bool(report.get("renders_final_language", False)),
            "memory_write_allowed": bool(report.get("memory_write_allowed", False)),
        })
    elif name == "evolutionary_drift_explorer":
        summary.update({
            "E_t_present": bool(report.get("E_t") or report.get("E_t_present")),
            "bounded_branch_count": report.get("bounded_branch_count"),
            "measured_evolutionary_drift_present": bool(report.get("measured_evolutionary_drift") or report.get("measurement_summary")),
            "memory_write_allowed": bool(report.get("memory_write_allowed", False)),
        })
    elif name == "coherence_scorer":
        selected = report.get("selected_scored_candidate_preview") or report.get("selected_candidate")
        summary.update({
            "S_t_present": bool(report.get("S_t") or report.get("S_t_present") or report.get("candidate_scores")),
            "candidate_scores_count": len(_as_list(report.get("candidate_scores"))),
            "selected_candidate_present": bool(selected),
            "manifest_allowed": bool(report.get("manifest_allowed", False)),
            "projection_allowed": bool(report.get("projection_allowed", False)),
        })
    elif name == "correction_naming":
        N_t = _as_dict(report.get("N_t"))
        chi = _as_dict(report.get("chi_t"))
        conf = _as_dict(N_t.get("naming_confidence_report"))
        summary.update({
            "chi_t_present": bool(report.get("chi_t_present") or chi),
            "N_t_present": bool(report.get("N_t_present") or N_t),
            "candidate_validity_score": chi.get("candidate_validity_score"),
            "projection_gated_score": chi.get("projection_gated_score"),
            "naming_allowed": N_t.get("naming_allowed"),
            "stable_naming": N_t.get("stable_naming"),
            "naming_confidence": conf.get("naming_confidence"),
            "recommended_route": chi.get("recommended_route") or report.get("recommended_route"),
        })
    elif name == "manifest_compiler":
        preflight = _as_dict(report.get("manifest_preflight"))
        summary.update({
            "manifest_compilation_allowed": bool(report.get("manifest_compilation_allowed")),
            "manifest_packet_present": bool(report.get("manifest_packet")),
            "blocked_manifest_candidate_present": bool(report.get("blocked_manifest_candidate")),
            "manifest_readiness_score": preflight.get("manifest_readiness_score") or report.get("manifest_readiness_score"),
            "renders_final_language": bool(report.get("renders_final_language", False)),
            "memory_write_allowed": bool(report.get("memory_write_allowed", False)),
        })
    elif name == "output_renderer":
        summary.update({
            "rendering_allowed": bool(report.get("rendering_allowed")),
            "R_t_present": bool(report.get("R_t_present") or report.get("render_packet")),
            "blocked_render_candidate_present": bool(report.get("blocked_render_candidate")),
            "approved_output": bool(report.get("approved_output", False)),
            "projection_allowed": bool(report.get("projection_allowed", False)),
            "memory_write_allowed": bool(report.get("memory_write_allowed", False)),
        })
    elif name == "echo_validator":
        summary.update({
            "V_t_present": bool(report.get("V_t_present") or report.get("V_t")),
            "echo_validation_passed": bool(report.get("echo_validation_passed")),
            "echo_score": report.get("echo_score") or _as_dict(report.get("V_t")).get("echo_score"),
            "blocked_echo_candidate_present": bool(report.get("blocked_echo_candidate")),
            "approved_output": bool(report.get("approved_output", False)),
            "memory_write_allowed": bool(report.get("memory_write_allowed", False)),
        })
    elif name == "memory_writer_dry_run":
        summary.update({
            "W_t_present": bool(report.get("W_t_present")),
            "memory_write_plan_allowed": bool(report.get("memory_write_plan_allowed")),
            "write_eligibility_score": _as_dict(_as_dict(report.get("write_plan")).get("write_eligibility")).get("write_eligibility_score"),
            "blocked_write_candidate_present": bool(report.get("blocked_write_candidate")),
            "actual_files_written": _as_list(report.get("actual_files_written")),
            "memory_write_allowed": bool(report.get("memory_write_allowed", False)),
        })
    elif name == "gated_memory_writer":
        summary.update({
            "attempted": bool(report),
            "W_t_commit_present": bool(report.get("W_t_commit_present")),
            "memory_write_committed": bool(report.get("memory_write_committed")),
            "failure_code": report.get("failure_code"),
            "actual_files_written": _as_list(report.get("actual_files_written")),
            "memory_write_allowed": bool(report.get("memory_write_allowed", False)),
        })
    return summary


def _first_blocker(stage_summaries: list[dict[str, Any]]) -> dict[str, Any] | None:
    for item in stage_summaries:
        name = item.get("stage")
        if item.get("algorithm_failure"):
            return {"stage": name, "kind": "algorithm_failure", "reason_codes": item.get("reason_codes"), "failure_code": item.get("failure_code")}
        if name == "correction_naming" and item.get("stable_naming") is False:
            return {"stage": name, "kind": "gate_refusal", "reason_codes": ["naming_not_stable"], "failure_code": None}
        if name == "manifest_compiler" and not item.get("manifest_compilation_allowed"):
            return {"stage": name, "kind": "gate_refusal", "reason_codes": item.get("reason_codes") or ["manifest_not_compiled"], "failure_code": item.get("failure_code")}
        if name == "output_renderer" and not item.get("R_t_present"):
            return {"stage": name, "kind": "gate_refusal", "reason_codes": item.get("reason_codes") or ["render_not_produced"], "failure_code": item.get("failure_code")}
        if name == "echo_validator" and not item.get("echo_validation_passed"):
            return {"stage": name, "kind": "gate_refusal", "reason_codes": item.get("reason_codes") or ["echo_not_validated"], "failure_code": item.get("failure_code")}
        if name == "memory_writer_dry_run" and not item.get("memory_write_plan_allowed"):
            return {"stage": name, "kind": "gate_refusal", "reason_codes": item.get("reason_codes") or ["write_plan_not_allowed"], "failure_code": item.get("failure_code")}
    return None


def build_pipeline_summary(stage_reports: dict[str, Any], *, include_full_reports: bool = False) -> dict[str, Any]:
    """Create a compact C9 pipeline summary from individual RMC reports.

    The function intentionally performs no I/O and no side effects. It classifies
    stage outcomes from live reports and exposes the first blocking gate without
    treating a lawful refusal as an algorithm failure.
    """
    reports = {key: _as_dict(value) for key, value in _as_dict(stage_reports).items()}
    stage_summaries = [_stage_summary(name, reports.get(name, {})) for name in STAGE_ORDER if name in reports]
    blocker = _first_blocker(stage_summaries)
    algorithm_failures = [s for s in stage_summaries if s.get("algorithm_failure")]
    gate_refusals = [s for s in stage_summaries if s.get("gate_refusal")]
    actual_files_written: list[str] = []
    for s in stage_summaries:
        for path in _as_list(s.get("actual_files_written")):
            if isinstance(path, str) and path not in actual_files_written:
                actual_files_written.append(path)

    committed = any(bool(s.get("memory_write_committed")) for s in stage_summaries)
    if algorithm_failures:
        pipeline_status = "ERROR"
        verdict = "algorithm_failure_detected"
    elif committed:
        pipeline_status = "OK"
        verdict = "memory_commit_completed_under_gate"
    elif blocker:
        pipeline_status = "BLOCKED"
        verdict = "lawful_gate_refusal"
    else:
        pipeline_status = "OK"
        verdict = "pipeline_ready_no_commit_attempted"

    result = {
        "status": pipeline_status,
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "stage": "RMC Pipeline Summary + Compact Trace Surface",
        "pipeline_summary_id": f"rmcpipe_{_hash(stage_summaries)[:18]}",
        "created_at_utc": _now(),
        "stage_order": list(STAGE_ORDER),
        "stage_summaries": stage_summaries,
        "first_blocker": blocker,
        "pipeline_verdict": verdict,
        "gate_counts": {
            "stages_reported": len(stage_summaries),
            "algorithm_failure_count": len(algorithm_failures),
            "gate_refusal_count": len(gate_refusals),
            "actual_file_write_count": len(actual_files_written),
        },
        "actual_files_written": actual_files_written,
        "approved_output": False,
        "projection_allowed": False,
        "memory_write_committed": committed,
        "memory_write_allowed": committed,
        "compact_surface": True,
        "source_reports_included": bool(include_full_reports),
        "artifact_hygiene": {
            "c8_checksum_manifest_issue_folded_into_C9": True,
            "sha256_manifest_must_exclude": ["__pycache__", "*.pyc"],
            "patch_archive_expected_to_contain_only_source_readme_tests_and_SHA256SUMS": True,
        },
        "gate_classification_legend": {
            "algorithm_failure": "broken code, exception, or invalid computation",
            "gate_refusal": "correct protection because an upstream RMC condition failed",
            "read_only_refusal": "expected refusal because the current stage is allowed to compute but not mutate",
        },
        "boundary": pipeline_boundary(),
    }
    if include_full_reports:
        result["source_stage_reports"] = reports
    return result
