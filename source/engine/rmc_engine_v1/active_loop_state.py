"""RMC Active Loop State v1.

Patch 262J1R-Preflight-C11 implements the missing active loop state
object from Algorithm 6 without introducing mutation. The module reconstructs
L_t from the live RMC pipeline report and the local RMC memory dataset so the
system can tell what loop is active, where it is blocked, what has already
completed, which branches remain unresolved, and what the next lawful stage is.

This is not a UI convenience object and it is not an LLM hook. It is the
read-only continuity surface that future gated persistence, promotion, and the
RMC Memory Panel should consume.
"""
from __future__ import annotations

import datetime as _dt
import hashlib as _hashlib
import json as _json
import os as _os
import re as _re
from pathlib import Path as _Path
from typing import Any

ENGINE_VERSION = "rmc_active_loop_state_v1_patch262J1R_preflight_C11"
ENGINE_MODE = "read_only_active_loop_state_reconstruction"
DEFAULT_FORGE_ROOT = _Path("/home/nic/forge")
DEFAULT_DATASET_REL = _Path("memory/rmc_dataset_v1")
DEFAULT_LIVE_REL = _Path("memory/rmc_live_memory_v1")

CANONICAL_STAGE_ORDER = [
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

MUTATING_STAGE_NAMES = {"gated_memory_writer"}


def _utc_now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()


def _as_dict(value: Any) -> dict[str, Any]:
    return dict(value) if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if value in (None, "", {}):
        return []
    return [value]


def _text(value: Any, limit: int = 800) -> str:
    text = str(value or "").strip()
    text = _re.sub(r"\s+", " ", text)
    return text[:limit]


def _sha(value: Any) -> str:
    return _hashlib.sha256(_json.dumps(value, sort_keys=True, default=str).encode("utf-8", errors="replace")).hexdigest()


def _forge_root(root: str | _Path | None = None) -> _Path:
    if root is not None:
        return _Path(root).expanduser().resolve()
    env_root = _os.environ.get("FORGE_ROOT")
    if env_root:
        return _Path(env_root).expanduser().resolve()
    return DEFAULT_FORGE_ROOT


def _safe_read_json(path: _Path) -> Any:
    try:
        with path.open("r", encoding="utf-8") as handle:
            return _json.load(handle)
    except Exception:
        return None


def _safe_read_jsonl(path: _Path, limit: int = 50) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    try:
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                if len(rows) >= limit:
                    break
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = _json.loads(line)
                    if isinstance(obj, dict):
                        rows.append(obj)
                except Exception:
                    continue
    except Exception:
        return []
    return rows


def _iter_files(path: _Path, pattern: str = "*.json", limit: int = 80) -> list[_Path]:
    if not path.exists():
        return []
    try:
        files = [p for p in path.rglob(pattern) if p.is_file()]
        files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        return files[:limit]
    except Exception:
        return []


def _rel(path: _Path, root: _Path) -> str:
    try:
        return str(path.resolve().relative_to(root.resolve()))
    except Exception:
        return str(path)


def active_loop_boundary() -> dict[str, Any]:
    return {
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "engine_module_location": "forge/rmc_engine_v1/active_loop_state.py",
        "implements_rmc_stage": "Active Loop State / L_t",
        "algorithm_reference": "Algorithm 6 continuity object before gated persistence",
        "read_only": True,
        "writes_files": False,
        "writes_rmc_memory": False,
        "writes_identity_vault": False,
        "uses_llm": False,
        "executes_shell": False,
        "queries_chroma": False,
        "reads_db_files": False,
        "mutates_canonical_reference": False,
        "ui_is_authority": False,
        "forge_governs": True,
        "purpose": "Reconstruct current loop continuity from pipeline trace and RMC memory surfaces without mutating state.",
    }


def active_loop_schema_contract() -> dict[str, Any]:
    return {
        "symbol": "L_t",
        "formula": "L_t = reconstruct_active_loop(T_t, μ_t, R_t, V_t, W_t, M_t)",
        "required_fields": [
            "current_loop_id",
            "current_phase",
            "phase_path",
            "open_issues",
            "completed_stages",
            "unresolved_branches",
            "next_expected_step",
            "last_valid_manifest",
            "last_valid_render",
            "last_valid_echo",
            "memory_write_status",
            "user_session_continuity",
        ],
        "persistence_policy": "read_only_reconstruction_in_C11; gated persistence is future work",
        "mutation_policy": "no writes, no approval token consumption, no Identity Vault, no Chroma mutation",
        "design_reason": "Without L_t the pipeline can run per request but cannot know the continuing loop position except by reconstructing from files and reports.",
    }


def _stage_summaries(pipeline_report: dict[str, Any]) -> list[dict[str, Any]]:
    return [s for s in _as_list(pipeline_report.get("stage_summaries")) if isinstance(s, dict)]


def _stage_map(pipeline_report: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {str(s.get("stage")): s for s in _stage_summaries(pipeline_report) if s.get("stage")}


def _source_reports(pipeline_report: dict[str, Any]) -> dict[str, dict[str, Any]]:
    reports = pipeline_report.get("source_stage_reports")
    if isinstance(reports, dict):
        return {str(k): _as_dict(v) for k, v in reports.items()}
    return {}


def _phase_from_pipeline(pipeline_report: dict[str, Any]) -> dict[str, Any]:
    stages = _stage_map(pipeline_report)
    phase = _as_dict(stages.get("phase_parser"))
    if not phase:
        phase = _as_dict(stages.get("trace_spine"))
    path = _as_list(phase.get("phase_path_hypothesis")) or _as_list(phase.get("phase_path"))
    primary = phase.get("phase_primary") or (path[-1] if path else None)
    return {
        "phase_primary": primary,
        "phase_secondary": _as_list(phase.get("phase_secondary")),
        "phase_path": path,
        "confidence": phase.get("confidence"),
        "confidence_status": phase.get("confidence_status"),
    }


def _completed_stages(pipeline_report: dict[str, Any]) -> list[dict[str, Any]]:
    completed: list[dict[str, Any]] = []
    for s in _stage_summaries(pipeline_report):
        name = str(s.get("stage") or "")
        if not name:
            continue
        status = str(s.get("status") or "").upper()
        if s.get("algorithm_failure"):
            continue
        if name == "gated_memory_writer" and not s.get("memory_write_committed"):
            continue
        if s.get("gate_refusal") and name not in ("gated_memory_writer",):
            continue
        completed.append({
            "stage": name,
            "status": status,
            "evidence": _stage_completion_evidence(name, s),
        })
    return completed


def _stage_completion_evidence(name: str, summary: dict[str, Any]) -> dict[str, Any]:
    keys = {
        "phase_parser": ["phase_primary", "phase_path_hypothesis", "confidence"],
        "memory_recaller": ["active_memory_count", "candidate_nodes_collected"],
        "trace_spine": ["I_t_present", "M_t_present"],
        "candidate_generator": ["C_t_present", "candidate_count"],
        "evolutionary_drift_explorer": ["E_t_present", "bounded_branch_count"],
        "coherence_scorer": ["S_t_present", "selected_candidate_present"],
        "correction_naming": ["chi_t_present", "N_t_present", "stable_naming"],
        "manifest_compiler": ["manifest_packet_present", "manifest_readiness_score"],
        "output_renderer": ["R_t_present", "rendering_allowed"],
        "echo_validator": ["V_t_present", "echo_validation_passed", "echo_score"],
        "memory_writer_dry_run": ["W_t_present", "memory_write_plan_allowed"],
        "gated_memory_writer": ["W_t_commit_present", "memory_write_committed"],
    }.get(name, [])
    return {k: summary.get(k) for k in keys if k in summary}


def _open_issues(pipeline_report: dict[str, Any]) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    first = _as_dict(pipeline_report.get("first_blocker"))
    if first:
        issues.append({
            "issue_id": f"blocker_{_sha(first)[:12]}",
            "kind": first.get("kind") or "gate_refusal",
            "stage": first.get("stage"),
            "severity": "critical" if first.get("kind") == "algorithm_failure" else "normal_gate",
            "reason_codes": _as_list(first.get("reason_codes")),
            "failure_code": first.get("failure_code"),
            "recommended_action": _next_from_blocker(first),
        })
    for s in _stage_summaries(pipeline_report):
        if s.get("algorithm_failure") and not any(i.get("stage") == s.get("stage") for i in issues):
            issues.append({
                "issue_id": f"algorithm_{_sha(s)[:12]}",
                "kind": "algorithm_failure",
                "stage": s.get("stage"),
                "severity": "critical",
                "reason_codes": _as_list(s.get("reason_codes")),
                "failure_code": s.get("failure_code"),
                "recommended_action": "stop_and_repair_stage_before_continuing",
            })
    counts = _as_dict(pipeline_report.get("gate_counts"))
    if counts.get("actual_file_write_count", 0) and not pipeline_report.get("memory_write_committed"):
        issues.append({
            "issue_id": "unexpected_write_count_without_commit",
            "kind": "write_integrity_warning",
            "stage": "pipeline_summary",
            "severity": "critical",
            "reason_codes": ["actual_file_write_count_nonzero_without_commit"],
            "recommended_action": "audit_actual_files_written_before_next_patch",
        })
    return issues


def _next_from_blocker(first: dict[str, Any]) -> str:
    stage = str(first.get("stage") or "")
    kind = str(first.get("kind") or "")
    if kind == "algorithm_failure":
        return "repair_algorithm_failure_before_any_gate_or_ui_work"
    mapping = {
        "correction_naming": "run_or_improve_correction_and_naming_until_stable",
        "manifest_compiler": "repair_manifest_inputs_or_required_manifest_fields",
        "output_renderer": "repair_renderer_sentence_plan_or_manifest_renderability",
        "echo_validator": "repair_render_until_echo_preserves_manifest",
        "memory_writer_dry_run": "inspect_W_t_write_plan_refusal_before_commit_attempt",
        "gated_memory_writer": "supply_explicit_approval_only_after_C7_plan_and_echo_pass",
    }
    return mapping.get(stage, "continue_to_next_required_rmc_gate")


def _next_expected_step(pipeline_report: dict[str, Any], open_issues: list[dict[str, Any]]) -> dict[str, Any]:
    if open_issues:
        issue = open_issues[0]
        return {
            "stage": issue.get("stage"),
            "action": issue.get("recommended_action"),
            "reason": issue.get("kind"),
            "may_mutate": False,
        }
    if pipeline_report.get("memory_write_committed"):
        return {
            "stage": "promotion_path",
            "action": "review_committed_memory_for_promotion_queue_or_stable_memory",
            "reason": "memory_commit_completed_under_gate",
            "may_mutate": False,
        }
    return {
        "stage": "gated_memory_writer",
        "action": "optional_commit_only_with_explicit_approval_after_review",
        "reason": "pipeline_ready_no_commit_attempted",
        "may_mutate": False,
    }


def _find_nested_dict(obj: Any, key: str) -> dict[str, Any]:
    if isinstance(obj, dict):
        value = obj.get(key)
        if isinstance(value, dict):
            return value
        for child in obj.values():
            found = _find_nested_dict(child, key)
            if found:
                return found
    elif isinstance(obj, list):
        for child in obj:
            found = _find_nested_dict(child, key)
            if found:
                return found
    return {}


def _find_nested_value(obj: Any, key: str) -> Any:
    if isinstance(obj, dict):
        if key in obj:
            return obj.get(key)
        for child in obj.values():
            found = _find_nested_value(child, key)
            if found not in (None, "", [], {}):
                return found
    elif isinstance(obj, list):
        for child in obj:
            found = _find_nested_value(child, key)
            if found not in (None, "", [], {}):
                return found
    return None


def _last_valid_artifacts(pipeline_report: dict[str, Any]) -> dict[str, Any]:
    reports = _source_reports(pipeline_report)
    manifest_report = reports.get("manifest_compiler", {})
    renderer_report = reports.get("output_renderer", {})
    echo_report = reports.get("echo_validator", {})

    manifest_packet = _as_dict(manifest_report.get("manifest_packet"))
    mu = _as_dict(manifest_packet.get("μ_t"))
    render_packet = _as_dict(renderer_report.get("render_packet"))
    R_t = _as_dict(render_packet.get("R_t"))
    V_t = _as_dict(echo_report.get("V_t"))

    # Fall back to recursive search because endpoint wrappers can nest source reports.
    if not mu:
        mu = _find_nested_dict(pipeline_report, "μ_t")
    if not R_t:
        R_t = _find_nested_dict(pipeline_report, "R_t")
    if not V_t:
        V_t = _find_nested_dict(pipeline_report, "V_t")

    return {
        "last_valid_manifest": _artifact_summary("manifest", mu, required_key="claim"),
        "last_valid_render": _artifact_summary("render", R_t, required_key="rendered_text"),
        "last_valid_echo": _artifact_summary("echo", V_t, required_key="echo_score"),
    }


def _artifact_summary(kind: str, artifact: dict[str, Any], *, required_key: str) -> dict[str, Any] | None:
    if not artifact or required_key not in artifact:
        return None
    if kind == "manifest":
        return {
            "artifact_type": kind,
            "claim_preview": _text(artifact.get("claim"), 220),
            "phase_path": _as_list(artifact.get("phase_path")),
            "confidence": artifact.get("confidence"),
            "novelty": artifact.get("novelty"),
            "projection_status": artifact.get("projection_status"),
            "hash": _sha(artifact)[:18],
        }
    if kind == "render":
        return {
            "artifact_type": kind,
            "rendered_text_preview": _text(artifact.get("rendered_text"), 260),
            "render_mode": artifact.get("render_mode"),
            "hash": _sha(artifact)[:18],
        }
    return {
        "artifact_type": kind,
        "echo_score": artifact.get("echo_score"),
        "echo_validation_passed": artifact.get("echo_validation_passed"),
        "recommended_route": artifact.get("recommended_route"),
        "hash": _sha(artifact)[:18],
    }


def _memory_write_status(pipeline_report: dict[str, Any]) -> dict[str, Any]:
    stages = _stage_map(pipeline_report)
    dry = _as_dict(stages.get("memory_writer_dry_run"))
    gated = _as_dict(stages.get("gated_memory_writer"))
    counts = _as_dict(pipeline_report.get("gate_counts"))
    return {
        "write_plan_allowed": bool(dry.get("memory_write_plan_allowed")),
        "write_eligibility_score": dry.get("write_eligibility_score"),
        "blocked_write_candidate_present": bool(dry.get("blocked_write_candidate_present")),
        "commit_attempted": bool(gated.get("attempted")),
        "memory_write_committed": bool(gated.get("memory_write_committed") or pipeline_report.get("memory_write_committed")),
        "actual_file_write_count": counts.get("actual_file_write_count", 0),
        "actual_files_written": _as_list(pipeline_report.get("actual_files_written")),
        "requires_explicit_approval_token": True,
        "approval_token": "APPROVE_RMC_MEMORY_WRITE",
    }


def _unresolved_branches(pipeline_report: dict[str, Any]) -> list[dict[str, Any]]:
    branches: list[dict[str, Any]] = []
    reports = _source_reports(pipeline_report)
    evo = reports.get("evolutionary_drift_explorer", {})
    for key, route in (("archive_candidates", "archive_or_review"), ("rejected_candidates", "blocked"), ("bounded_branches", "candidate_review")):
        for item in _as_list(evo.get(key))[:8]:
            if isinstance(item, dict):
                branches.append({
                    "branch_id": item.get("candidate_id") or item.get("branch_id") or f"branch_{_sha(item)[:12]}",
                    "source": key,
                    "route": route,
                    "novelty": _find_nested_value(item, "novelty_delta") or item.get("novelty") or item.get("novelty_estimate"),
                    "epsilon_s": _find_nested_value(item, "epsilon_s"),
                    "reason": _text(item.get("reason") or item.get("archive_reason") or item.get("status"), 220),
                })
    if not branches:
        for issue in _open_issues(pipeline_report)[:4]:
            if issue.get("kind") != "algorithm_failure":
                branches.append({
                    "branch_id": f"unresolved_{_sha(issue)[:12]}",
                    "source": "gate_refusal",
                    "route": "return_to_required_gate",
                    "reason": _text(issue.get("recommended_action"), 220),
                    "stage": issue.get("stage"),
                })
    return branches


def _latest_file_summary(root: _Path, folder: _Path, pattern: str = "*.json") -> dict[str, Any] | None:
    files = _iter_files(root / folder, pattern=pattern, limit=1)
    if not files:
        return None
    path = files[0]
    data = _safe_read_json(path)
    return {
        "path": _rel(path, root),
        "modified_utc": _dt.datetime.fromtimestamp(path.stat().st_mtime, tz=_dt.timezone.utc).replace(microsecond=0).isoformat(),
        "sha256_16": _hashlib.sha256(path.read_bytes()).hexdigest()[:16],
        "object_id": _object_id(data, path),
    }


def _object_id(data: Any, path: _Path) -> str:
    if isinstance(data, dict):
        for key in ("event_id", "receipt_id", "memory_node_id", "candidate_id", "review_id", "commit_id"):
            if data.get(key):
                return str(data.get(key))
    return path.stem


def _count_files(path: _Path, pattern: str = "*.json") -> int:
    if not path.exists():
        return 0
    try:
        return sum(1 for p in path.rglob(pattern) if p.is_file())
    except Exception:
        return 0


def _memory_surface(root: _Path) -> dict[str, Any]:
    dataset = root / DEFAULT_DATASET_REL
    live = root / DEFAULT_LIVE_REL
    events_index = dataset / "indexes" / "events_index.jsonl"
    index_rows = _safe_read_jsonl(events_index, limit=500)
    return {
        "forge_root": str(root),
        "dataset_root": str(dataset),
        "dataset_root_exists": dataset.exists(),
        "live_memory_root": str(live),
        "live_memory_root_exists": live.exists(),
        "raw_event_count": _count_files(dataset / "raw_events"),
        "receipt_count": _count_files(dataset / "dataset_receipts"),
        "review_queue_count": _count_files(dataset / "review_queue"),
        "stable_memory_count": _count_files(dataset / "stable_memory"),
        "approved_promotion_count": _count_files(dataset / "approved_promotions"),
        "retrieval_index_exists": events_index.exists(),
        "retrieval_index_row_count": len(index_rows),
        "latest_raw_event": _latest_file_summary(root, DEFAULT_DATASET_REL / "raw_events"),
        "latest_receipt": _latest_file_summary(root, DEFAULT_DATASET_REL / "dataset_receipts"),
        "latest_review_queue_item": _latest_file_summary(root, DEFAULT_DATASET_REL / "review_queue"),
    }


def _user_session_continuity(pipeline_report: dict[str, Any], memory_surface: dict[str, Any]) -> dict[str, Any]:
    phase = _phase_from_pipeline(pipeline_report)
    source = _as_dict(_find_nested_dict(pipeline_report, "input_event")) or _as_dict(_find_nested_dict(pipeline_report, "I_t"))
    raw_input = source.get("x_t_raw_input") or source.get("x_t_raw_input_preview") or _find_nested_value(pipeline_report, "x_t_raw_input_preview")
    key_material = {
        "input": _text(raw_input, 280),
        "phase": phase.get("phase_primary"),
        "path": phase.get("phase_path"),
        "latest_receipt": _as_dict(memory_surface.get("latest_receipt")).get("object_id"),
        "latest_event": _as_dict(memory_surface.get("latest_raw_event")).get("object_id"),
    }
    return {
        "session_key": f"rmc_session_{_sha(key_material)[:18]}",
        "raw_input_preview": _text(raw_input, 260),
        "derived_from_pipeline_trace": True,
        "derived_from_memory_surface": True,
        "continuity_strength": _continuity_strength(memory_surface, phase),
        "continuity_inputs": key_material,
    }


def _continuity_strength(memory_surface: dict[str, Any], phase: dict[str, Any]) -> float:
    score = 0.0
    if memory_surface.get("dataset_root_exists"):
        score += 0.22
    if memory_surface.get("raw_event_count", 0) > 0:
        score += 0.18
    if memory_surface.get("receipt_count", 0) > 0:
        score += 0.18
    if memory_surface.get("retrieval_index_exists"):
        score += 0.16
    if phase.get("phase_primary"):
        score += 0.16
    if phase.get("phase_path"):
        score += 0.10
    return round(min(1.0, score), 6)


def _current_loop_id(pipeline_report: dict[str, Any], continuity: dict[str, Any]) -> str:
    first = _as_dict(pipeline_report.get("first_blocker"))
    phase = _phase_from_pipeline(pipeline_report)
    material = {
        "session_key": continuity.get("session_key"),
        "phase": phase,
        "first_blocker": first,
        "pipeline_verdict": pipeline_report.get("pipeline_verdict"),
    }
    return f"rmcloop_{_sha(material)[:18]}"


def build_active_loop_state(pipeline_report: dict[str, Any], *, forge_root: str | _Path | None = None) -> dict[str, Any]:
    """Reconstruct read-only active loop state from a live pipeline report.

    The function performs only bounded local JSON/file inspection under the Forge
    memory directory. It does not write, mutate, query Chroma, call an LLM, or
    consume approval tokens.
    """
    pipeline = _as_dict(pipeline_report)
    root = _forge_root(forge_root)
    phase = _phase_from_pipeline(pipeline)
    issues = _open_issues(pipeline)
    completed = _completed_stages(pipeline)
    memory = _memory_surface(root)
    continuity = _user_session_continuity(pipeline, memory)
    artifacts = _last_valid_artifacts(pipeline)
    write_status = _memory_write_status(pipeline)
    unresolved = _unresolved_branches(pipeline)
    next_step = _next_expected_step(pipeline, issues)
    loop_id = _current_loop_id(pipeline, continuity)

    L_t = {
        "current_loop_id": loop_id,
        "current_phase": phase.get("phase_primary"),
        "phase_path": phase.get("phase_path"),
        "phase_confidence": phase.get("confidence"),
        "open_issues": issues,
        "completed_stages": completed,
        "unresolved_branches": unresolved,
        "next_expected_step": next_step,
        "last_valid_manifest": artifacts.get("last_valid_manifest"),
        "last_valid_render": artifacts.get("last_valid_render"),
        "last_valid_echo": artifacts.get("last_valid_echo"),
        "memory_write_status": write_status,
        "user_session_continuity": continuity,
        "memory_surface": memory,
    }

    required = active_loop_schema_contract()["required_fields"]
    missing = [field for field in required if field not in L_t]
    status = "OK" if not missing and not any(i.get("kind") == "algorithm_failure" for i in issues) else "BLOCKED"
    result = {
        "status": status,
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "stage": "Active Loop State / L_t",
        "active_loop_state_id": f"activeloop_{_sha(L_t)[:18]}",
        "created_at_utc": _utc_now(),
        "L_t": L_t,
        "schema_contract": active_loop_schema_contract(),
        "missing_required_fields": missing,
        "loop_state_quality": _loop_state_quality(L_t, pipeline),
        "pipeline_link": {
            "pipeline_summary_id": pipeline.get("pipeline_summary_id") or pipeline.get("pipeline_run_id"),
            "pipeline_verdict": pipeline.get("pipeline_verdict"),
            "first_blocker": pipeline.get("first_blocker"),
            "gate_counts": pipeline.get("gate_counts"),
            "source_reports_included": bool(pipeline.get("source_reports_included")),
        },
        "persistence_status": {
            "persisted": False,
            "persistence_allowed_in_this_patch": False,
            "future_stage": "active_loop_state_gated_persistence_after_operator_review",
        },
        "approved_output": False,
        "projection_allowed": False,
        "memory_write_allowed": False,
        "writes_files": False,
        "identity_vault_write": False,
        "rmc_live_memory_write": False,
        "boundary": active_loop_boundary(),
    }
    return result


def _loop_state_quality(L_t: dict[str, Any], pipeline_report: dict[str, Any]) -> dict[str, Any]:
    completed_count = len(_as_list(L_t.get("completed_stages")))
    open_count = len(_as_list(L_t.get("open_issues")))
    unresolved_count = len(_as_list(L_t.get("unresolved_branches")))
    continuity = _as_dict(L_t.get("user_session_continuity")).get("continuity_strength", 0.0)
    has_phase = bool(L_t.get("current_phase"))
    has_next = bool(_as_dict(L_t.get("next_expected_step")).get("stage"))
    score = min(1.0, (completed_count / max(1, len(CANONICAL_STAGE_ORDER))) * 0.42 + float(continuity or 0.0) * 0.36 + (0.12 if has_phase else 0.0) + (0.10 if has_next else 0.0))
    return {
        "score": round(score, 6),
        "completed_stage_count": completed_count,
        "open_issue_count": open_count,
        "unresolved_branch_count": unresolved_count,
        "continuity_strength": continuity,
        "algorithm_failure_count": _as_dict(pipeline_report.get("gate_counts")).get("algorithm_failure_count", 0),
        "gate_refusal_count": _as_dict(pipeline_report.get("gate_counts")).get("gate_refusal_count", 0),
        "quality_label": "usable_read_only_state" if score >= 0.55 else "weak_reconstructed_state",
    }
