"""Output Renderer / R_t engine.

Patch 262J1R-Preflight-C5 renders a compiled RMC manifest (μ_t) into a
read-only rendered output object (R_t).  Rendering is downstream of the
manifest: no μ_t means no R_t.  This module never compiles meaning, never
calls an LLM, never writes files, never writes memory, never executes shell,
and never treats a rendering as approved before Echo Validator exists.

The frozen legacy LLM compatibility lane is withdrawn from live runtime
authority. Text rendering is deterministic only. Legacy LLM-related parameters
remain refusal inputs for compatibility and never trigger fallback behavior.
"""
from __future__ import annotations

import datetime as _dt
import re
from typing import Any

from rmc_engine_v1.measurement_kernel import clamp, stable_hash, stable_id
from rmc_engine_v1.frozen_legacy_boundary import classify_llm_request

ENGINE_VERSION = "rmc_output_renderer_v1_frozen_legacy_containment_v1"
ENGINE_MODE = "read_only_output_renderer_R_t"

RENDER_MODES = {"text", "json_packet", "dashboard_state", "glyph_packet"}
REQUIRED_MU_FIELDS = [
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


def _as_dict(value: Any) -> dict[str, Any]:
    return dict(value or {}) if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if value in (None, "", {}):
        return []
    return [value]


def _text(value: Any, limit: int = 1200) -> str:
    text = str(value or "").strip()
    text = re.sub(r"\s+", " ", text)
    return text[:limit]


def _tokens(value: Any) -> set[str]:
    return {tok for tok in re.findall(r"[a-z0-9_]+", str(value or "").lower()) if len(tok) > 2}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return len(a & b) / max(1, len(a | b))


def renderer_boundary() -> dict[str, Any]:
    return {
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "engine_module_location": "forge/rmc_engine_v1/output_renderer.py",
        "implements_rmc_stage": "Output Renderer / R_t",
        "input_contract": "C4_manifest_report_with_manifest_packet_or_blocked_manifest_candidate",
        "output_contract": "R_t_render_packet_or_blocked_render_candidate",
        "manifest_required_before_rendering": True,
        "echo_validator_stage_present": False,
        "memory_writer_stage_present": False,
        "uses_llm": False,
        "uses_llm_by_default": False,
        "optional_llm_renderer_available": False,
        "legacy_llm_parameters_are_refusal_inputs": True,
        "calls_llm_only_when_explicitly_enabled": False,
        "llm_output_is_authority": False,
        "queries_chroma": False,
        "reads_db_files": False,
        "executes_shell": False,
        "writes_files": False,
        "writes_rmc_memory": False,
        "writes_identity_vault": False,
        "mutates_canonical_reference": False,
        "approved_output": False,
        "glyph_packet_uses_real_renderer": True,
        "projection_allowed": False,
        "memory_write_allowed": False,
        "read_only_means": "no filesystem or memory mutation; HTTP response rendering is allowed when μ_t exists",
        "note": "Rendering is deterministic only. Any legacy LLM request is refused before rendering; no fallback is performed.",
    }


def renderer_schema_contract() -> dict[str, Any]:
    return {
        "render_symbol": "R_t",
        "render_formula": "R_t = ρ(μ_t, a, s)",
        "required_source": "μ_t manifest packet",
        "required_render_packet_fields": [
            "rendered_output_id",
            "source_manifest_id",
            "render_mode",
            "audience_profile",
            "style_mode",
            "R_t",
            "render_fidelity_precheck",
            "echo_validation_required",
        ],
        "supported_render_modes": sorted(RENDER_MODES),
        "legacy_llm_request_policy": {
            "available": False,
            "runtime_authorized": False,
            "request_parameters_retained_for_refusal_only": True,
            "fallback_allowed": False,
        },
        "sentence_plan_required": True,
        "sentence_plan_fields": ["core_claim", "required_qualifiers", "required_definitions", "forbidden_claims", "allowed_claim_scope", "audience", "mode"],
        "axioms_enforced": {
            "no_output_without_trace": True,
            "meaning_precedes_rendering": True,
            "language_is_output_modality_not_core_state": True,
            "no_memory_write_before_echo_validation": True,
            "blocked_manifest_cannot_render_language": True,
        },
    }


def _manifest_packet(report: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(report, dict):
        return {}
    packet = report.get("manifest_packet")
    if isinstance(packet, dict) and packet:
        return dict(packet)
    # Allow direct packet injection in tests/tools, but still validate μ_t below.
    if report.get("manifest_symbol") == "μ_t" and isinstance(report.get("μ_t"), dict):
        return dict(report)
    return {}


def _blocked_manifest(report: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(report, dict):
        return {}
    blocked = report.get("blocked_manifest_candidate")
    return dict(blocked or {}) if isinstance(blocked, dict) else {}


def _mu(packet: dict[str, Any]) -> dict[str, Any]:
    return _as_dict(packet.get("μ_t"))


def _missing_mu_fields(mu: dict[str, Any]) -> list[str]:
    return [field for field in REQUIRED_MU_FIELDS if field not in mu]


def _target_names(mu: dict[str, Any]) -> list[str]:
    names: list[str] = []
    for target in _as_list(mu.get("output_targets")):
        if isinstance(target, dict):
            name = str(target.get("target") or "").strip()
            if name:
                names.append(name)
        else:
            names.append(str(target))
    return names


def _manifest_metrics(mu: dict[str, Any]) -> dict[str, Any]:
    drift = _as_dict(mu.get("drift_status"))
    memory_links = [m for m in _as_list(mu.get("memory_links")) if isinstance(m, dict)]
    return {
        "confidence": round(_clamp(mu.get("confidence")), 6),
        "novelty": round(_clamp(mu.get("novelty")), 6),
        "post_epsilon_s": round(_clamp(drift.get("post_epsilon_s")), 6),
        "pre_epsilon_s": round(_clamp(drift.get("pre_epsilon_s")), 6),
        "semantic_distance": round(_clamp(drift.get("semantic_distance")), 6),
        "memory_fit": round(_clamp(drift.get("memory_fit")), 6),
        "source_confidence": round(_clamp(drift.get("source_confidence")), 6),
        "memory_link_count": len(memory_links),
        "phase_count": len(_as_list(mu.get("phase_path"))),
        "operator_count": len(_as_list(mu.get("operator_path"))),
    }


DEFAULT_FORBIDDEN_CLAIMS = [
    "approved final output",
    "final approved output",
    "projection allowed",
    "memory write allowed",
    "write committed",
    "truth sealed",
    "settled truth",
    "proven final",
]


def _sentence_plan(mu: dict[str, Any], audience: str, style: str, mode: str) -> dict[str, Any]:
    drift = _as_dict(mu.get("drift_status"))
    projection = _as_dict(mu.get("projection_status"))
    confidence = _clamp(mu.get("confidence"))
    novelty = _clamp(mu.get("novelty"))
    extra_forbidden = [_text(x, 160).lower() for x in _as_list(mu.get("forbidden_claims")) if _text(x, 160)]
    forbidden = []
    for item in DEFAULT_FORBIDDEN_CLAIMS + extra_forbidden:
        if item and item not in forbidden:
            forbidden.append(item)
    qualifiers = [
        "rendered from μ_t",
        "awaiting Echo Validator approval",
        "not a memory write",
        "not final projection",
    ]
    drift_status = _text(drift.get("status"), 180)
    if drift_status:
        qualifiers.append(f"drift_status={drift_status}")
    if confidence < 0.70:
        qualifiers.append("low_or_moderate_confidence_must_be_qualified")
    if novelty > 0.65:
        qualifiers.append("high_novelty_must_be_marked_as_candidate_or_hypothesis")
    return {
        "sentence_plan_version": "rmc_sentence_plan_v1_C10",
        "core_claim": _text(mu.get("claim"), 1600),
        "required_qualifiers": qualifiers,
        "required_definitions": [
            "μ_t is the pre-language manifest",
            "R_t is only a rendered output awaiting echo validation",
        ],
        "forbidden_claims": forbidden,
        "allowed_claim_scope": projection.get("status") or "projection_status_missing",
        "audience": audience,
        "mode": mode,
        "style": style,
    }


def _sentence_plan_validation(rendered: Any, plan: dict[str, Any]) -> dict[str, Any]:
    hay = str(rendered or "").lower()
    forbidden_hits = [item for item in _as_list(plan.get("forbidden_claims")) if str(item).lower() in hay]
    required_hits = []
    for qualifier in _as_list(plan.get("required_qualifiers")):
        q = str(qualifier).lower()
        # Human text may express these as words rather than exact machine tokens.
        if q in hay or ("echo validator" in hay and "echo" in q) or ("memory write" in hay and "memory" in q) or ("final projection" in hay and "projection" in q):
            required_hits.append(qualifier)
    return {
        "passed": not forbidden_hits,
        "forbidden_hits": forbidden_hits,
        "required_qualifier_hits": required_hits,
        "forbidden_claims_enforced": True,
        "blocked_reason": "forbidden_claims_present_in_rendered_output" if forbidden_hits else None,
    }


def _render_text_deterministic(mu: dict[str, Any], audience: str, style: str, sentence_plan: dict[str, Any]) -> str:
    claim = _text(sentence_plan.get("core_claim") or mu.get("claim"), 1600)
    phase_path = " → ".join(str(p) for p in _as_list(mu.get("phase_path"))) or "unknown"
    drift = _as_dict(mu.get("drift_status"))
    confidence = _clamp(mu.get("confidence"))
    novelty = _clamp(mu.get("novelty"))
    drift_status = _text(drift.get("status"), 300) or "unknown"
    post_eps = _clamp(drift.get("post_epsilon_s"))
    memory_count = len([m for m in _as_list(mu.get("memory_links")) if isinstance(m, dict)])
    targets = ", ".join(_target_names(mu)) or "unspecified"
    if style == "compact":
        return (
            f"Manifest rendering draft: {claim} | phase_path={phase_path} | "
            f"confidence={confidence:.3f} novelty={novelty:.3f} drift={drift_status} "
            f"post_epsilon_s={post_eps:.3f} memory_links={memory_count} targets={targets}."
        )
    if audience == "machine":
        return (
            f"R_t_TEXT_DRAFT claim={claim}; phase_path={phase_path}; confidence={confidence:.6f}; "
            f"novelty={novelty:.6f}; drift_status={drift_status}; post_epsilon_s={post_eps:.6f}; "
            f"memory_link_count={memory_count}; output_targets={targets}."
        )
    return (
        "Rendered output draft from μ_t: "
        f"{claim}\n"
        f"Phase path: {phase_path}.\n"
        f"Manifest confidence: {confidence:.3f}. Novelty: {novelty:.3f}.\n"
        f"Drift status: {drift_status}; post-correction ε_s: {post_eps:.3f}.\n"
        f"Memory links carried into this rendering: {memory_count}.\n"
        "This is a renderer output awaiting Echo Validator approval, not a memory write or final projection. "
        f"Allowed claim scope: {_text(sentence_plan.get('allowed_claim_scope'), 220)}."
    )


def _render_text(mu: dict[str, Any], audience: str, style: str, sentence_plan: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    deterministic = _render_text_deterministic(mu, audience, style, sentence_plan)
    return deterministic, {
        "status": "NOT_REQUESTED",
        "reason_code": "DETERMINISTIC_RENDERING_ONLY",
        "legacy_llm_runtime_authorized": False,
        "llm_renderer_requested": False,
        "llm_renderer_used": False,
        "calls_llm": False,
        "calls_model": False,
    }


def _render_json_packet(packet: dict[str, Any], mu: dict[str, Any], audience: str, style: str) -> dict[str, Any]:
    return {
        "packet_kind": "rmc_rendered_json_packet_v1",
        "source_manifest_id": packet.get("manifest_id"),
        "claim": mu.get("claim"),
        "phase_path": _as_list(mu.get("phase_path")),
        "operator_path": _as_list(mu.get("operator_path")),
        "memory_links": _as_list(mu.get("memory_links")),
        "confidence": mu.get("confidence"),
        "novelty": mu.get("novelty"),
        "drift_status": _as_dict(mu.get("drift_status")),
        "output_targets": _as_list(mu.get("output_targets")),
        "audience_profile": audience,
        "style_mode": style,
        "approved_output": False,
        "echo_validation_required": True,
    }


def _render_dashboard_state(packet: dict[str, Any], mu: dict[str, Any]) -> dict[str, Any]:
    metrics = _manifest_metrics(mu)
    drift = _as_dict(mu.get("drift_status"))
    return {
        "dashboard_card_kind": "rmc_manifest_render_state_v1",
        "source_manifest_id": packet.get("manifest_id"),
        "title": _text(mu.get("claim"), 90),
        "phase_path": _as_list(mu.get("phase_path")),
        "status_flags": {
            "rendered_from_manifest": True,
            "echo_validation_required": True,
            "approved_output": False,
            "memory_write_allowed": False,
            "projection_allowed": False,
        },
        "metrics": metrics,
        "drift_status": drift.get("status"),
        "memory_link_count": metrics.get("memory_link_count"),
    }


def _render_glyph_packet(packet: dict[str, Any], mu: dict[str, Any]) -> dict[str, Any]:
    from rmc_engine_v1.glyph_renderer import render_glyph_packet as _render_real_glyph_packet

    result = _render_real_glyph_packet({"manifest_packet": packet}, render_mode="phase_path_glyph")
    glyph_packet = _as_dict(result.get("glyph_packet"))
    if not glyph_packet:
        return {
            "glyph_packet_kind": "rmc_phase_glyph_render_packet_v2_C14_BLOCKED",
            "source_manifest_id": packet.get("manifest_id"),
            "blocked_reason": result.get("failure_code") or "glyph_renderer_failed",
            "approved_output": False,
            "echo_validation_required": True,
        }
    # Compatibility fields kept for older renderer tests and UI consumers.
    glyph_packet["glyph_codec"] = "FBSC Phase Glyph Codex v2.5 deterministic SVG renderer"
    glyph_packet["drift_overlay"] = _as_dict(mu.get("drift_status")).get("status")
    glyph_packet["claim_anchor_hash"] = stable_hash(_text(mu.get("claim")))
    glyph_packet["echo_validation_required"] = True
    return glyph_packet


def _build_render_content(packet: dict[str, Any], mu: dict[str, Any], mode: str, audience: str, style: str, sentence_plan: dict[str, Any]) -> tuple[Any, dict[str, Any]]:
    if mode == "json_packet":
        return _render_json_packet(packet, mu, audience, style), {"status": "SKIPPED", "llm_renderer_requested": False, "llm_renderer_used": False, "reason": "non_text_render_mode"}
    if mode == "dashboard_state":
        return _render_dashboard_state(packet, mu), {"status": "SKIPPED", "llm_renderer_requested": False, "llm_renderer_used": False, "reason": "non_text_render_mode"}
    if mode == "glyph_packet":
        return _render_glyph_packet(packet, mu), {"status": "SKIPPED", "llm_renderer_requested": False, "llm_renderer_used": False, "reason": "non_text_render_mode"}
    return _render_text(mu, audience, style, sentence_plan)


def _fidelity_precheck(mu: dict[str, Any], rendered: Any, mode: str) -> dict[str, Any]:
    rendered_text = str(rendered)
    claim = _text(mu.get("claim"), 1200)
    phase_path = [str(p) for p in _as_list(mu.get("phase_path"))]
    drift = _as_dict(mu.get("drift_status"))
    memory_links = [m for m in _as_list(mu.get("memory_links")) if isinstance(m, dict)]
    claim_overlap = _jaccard(_tokens(claim), _tokens(rendered_text))
    if mode == "text":
        claim_score = claim_overlap
    else:
        claim_score = 1.0 if claim and claim in rendered_text else max(0.75, claim_overlap)
    phase_score = 1.0 if all(str(p) in rendered_text for p in phase_path) else 0.0
    drift_status = _text(drift.get("status"), 200)
    drift_score = 1.0 if drift_status and drift_status in rendered_text else (0.7 if "drift" in rendered_text.lower() else 0.0)
    confidence_present = str(round(_clamp(mu.get("confidence")), 3)) in rendered_text or "confidence" in rendered_text.lower()
    novelty_present = str(round(_clamp(mu.get("novelty")), 3)) in rendered_text or "novelty" in rendered_text.lower()
    metric_score = (0.5 if confidence_present else 0.0) + (0.5 if novelty_present else 0.0)
    memory_score = 1.0 if not memory_links else (1.0 if "memory" in rendered_text.lower() else 0.0)
    schema_score = 1.0 if all(field in mu for field in REQUIRED_MU_FIELDS) else 0.0
    score = _clamp(
        0.28 * claim_score
        + 0.20 * phase_score
        + 0.16 * drift_score
        + 0.14 * metric_score
        + 0.12 * memory_score
        + 0.10 * schema_score
    )
    return {
        "fidelity_score": round(score, 6),
        "formula": "0.28*claim_preservation + 0.20*phase_preservation + 0.16*drift_preservation + 0.14*metric_preservation + 0.12*memory_reference + 0.10*schema_integrity",
        "components": {
            "claim_preservation": round(_clamp(claim_score), 6),
            "phase_preservation": round(_clamp(phase_score), 6),
            "drift_preservation": round(_clamp(drift_score), 6),
            "metric_preservation": round(_clamp(metric_score), 6),
            "memory_reference": round(_clamp(memory_score), 6),
            "schema_integrity": round(_clamp(schema_score), 6),
        },
        "echo_validation_still_required": True,
        "approved_output": False,
    }


def _blocked_render(report: dict[str, Any], reason: str, mode: str, audience: str, style: str) -> dict[str, Any]:
    blocked = _blocked_manifest(report)
    preflight = _as_dict(report.get("manifest_preflight"))
    reasons = _as_list(preflight.get("blocked_reasons")) or _as_list(_as_dict(blocked.get("drift_status")).get("blocked_reasons"))
    if reason and reason not in reasons:
        reasons.append(reason)
    return {
        "status": "BLOCKED",
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "stage": "Output Renderer",
        "rendering_allowed": False,
        "R_t_present": False,
        "R_t": None,
        "render_mode_requested": mode,
        "audience_profile": audience,
        "style_mode": style,
        "blocked_render_candidate": {
            "blocked_render_id": stable_id("rblock", {"reason": reason, "blocked": blocked, "mode": mode}),
            "status": "blocked_before_rendering",
            "reason": reason,
            "blocked_reasons": reasons,
            "source_manifest_status": blocked.get("manifest_status") or report.get("status"),
            "source_manifest_id": blocked.get("manifest_id"),
            "source_manifest_readiness": _as_dict(preflight.get("readiness")),
        },
        "approved_output": False,
        "glyph_packet_uses_real_renderer": True,
        "projection_allowed": False,
        "memory_write_allowed": False,
        "writes_files": False,
        "renders_human_readable_language": False,
        "echo_validation_required": False,
        "boundary": renderer_boundary(),
    }


def render_manifest(
    manifest_report: dict[str, Any],
    audience_profile: str = "operator",
    style_mode: str = "standard",
    render_mode: str = "text",
    llm_renderer_enabled: bool | str = False,
    model_endpoint: str | None = None,
    model: str | None = None,
    llm_timeout_seconds: float | int | str | None = None,
    llm_client: Any = None,
) -> dict[str, Any]:
    """Render R_t from μ_t only.

    If the source manifest is blocked or missing, this function returns a
    blocked-render result.  It never fabricates language from raw input or from
    a blocked_manifest_candidate.
    """
    if not isinstance(manifest_report, dict):
        manifest_report = {}
    mode = str(render_mode or "text").strip().lower().replace("-", "_")
    if mode not in RENDER_MODES:
        mode = "text"
    audience = _text(audience_profile or "operator", 80) or "operator"
    style = _text(style_mode or "standard", 80) or "standard"
    legacy_llm_request = classify_llm_request(
        enabled=llm_renderer_enabled,
        model_endpoint=model_endpoint,
        model=model,
        timeout_seconds=llm_timeout_seconds,
        llm_client=llm_client,
    )
    if legacy_llm_request.get("status") == "BLOCKED":
        return _blocked_render(
            {**manifest_report, "blocked_manifest_candidate": _manifest_packet(manifest_report)},
            str(legacy_llm_request.get("reason_code") or "FROZEN_LEGACY_LLM_REQUEST_PROHIBITED"),
            mode,
            audience,
            style,
        ) | {
            "legacy_llm_request": legacy_llm_request,
            "llm_render_attempt": legacy_llm_request,
            "llm_renderer_used": False,
            "optional_llm_renderer_available": False,
            "fallback_performed": False,
        }

    packet = _manifest_packet(manifest_report)
    if not packet:
        return _blocked_render(manifest_report, "manifest_packet_missing_or_manifest_blocked", mode, audience, style)
    mu = _mu(packet)
    missing = _missing_mu_fields(mu)
    if missing:
        return _blocked_render({**manifest_report, "blocked_manifest_candidate": packet}, f"manifest_mu_missing_required_fields:{','.join(missing)}", mode, audience, style)
    if bool(manifest_report.get("manifest_compilation_allowed")) is False and not manifest_report.get("manifest_packet"):
        return _blocked_render(manifest_report, "manifest_compilation_not_allowed", mode, audience, style)

    sentence_plan = _sentence_plan(mu, audience, style, mode)
    rendered, llm_attempt = _build_render_content(packet, mu, mode, audience, style, sentence_plan)
    sentence_guard = _sentence_plan_validation(rendered, sentence_plan)
    if not sentence_guard.get("passed"):
        return _blocked_render({**manifest_report, "blocked_manifest_candidate": packet}, str(sentence_guard.get("blocked_reason") or "sentence_plan_guard_failed"), mode, audience, style) | {
            "sentence_plan": sentence_plan,
            "sentence_plan_validation": sentence_guard,
        }
    fidelity = _fidelity_precheck(mu, rendered, mode)
    render_packet = {
        "rendered_output_id": stable_id("rt", {"manifest_id": packet.get("manifest_id"), "mode": mode, "audience": audience, "style": style, "rendered": rendered}),
        "render_symbol": "R_t",
        "render_created_at_utc": _utc_now(),
        "source_manifest_id": packet.get("manifest_id"),
        "source_manifest_hash": packet.get("manifest_hash"),
        "render_mode": mode,
        "audience_profile": audience,
        "style_mode": style,
        "R_t": rendered,
        "rendered_output_hash": stable_hash(rendered),
        "sentence_plan": sentence_plan,
        "sentence_plan_validation": sentence_guard,
        "render_fidelity_precheck": fidelity,
        "llm_render_attempt": llm_attempt,
        "llm_renderer_used": bool(isinstance(llm_attempt, dict) and llm_attempt.get("llm_renderer_used")),
        "llm_renderer_default_off": True,
        "legacy_llm_runtime_authorized": False,
        "manifest_fields_preserved": REQUIRED_MU_FIELDS,
        "echo_validation_required": True,
        "approved_output": False,
        "glyph_packet_uses_real_renderer": True,
        "projection_allowed": False,
        "memory_write_allowed": False,
        "writes_files": False,
    }
    return {
        "status": "OK",
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "stage": "Output Renderer",
        "rendering_allowed": True,
        "R_t_present": True,
        "render_packet": render_packet,
        "R_t": rendered,
        "source_manifest_packet": packet,
        "render_summary": {
            "source_manifest_id": packet.get("manifest_id"),
            "render_mode": mode,
            "fidelity_score": fidelity.get("fidelity_score"),
            "echo_validator_next": True,
            "approved_output": False,
            "projection_allowed": False,
            "memory_write_allowed": False,
            "sentence_plan_guard_passed": sentence_guard.get("passed"),
            "llm_renderer_used": bool(isinstance(llm_attempt, dict) and llm_attempt.get("llm_renderer_used")),
        },
        "sentence_plan": sentence_plan,
        "sentence_plan_validation": sentence_guard,
        "schema_contract": renderer_schema_contract(),
        "boundary": renderer_boundary(),
        "approved_output": False,
        "llm_render_attempt": llm_attempt,
        "llm_renderer_used": bool(isinstance(llm_attempt, dict) and llm_attempt.get("llm_renderer_used")),
        "optional_llm_renderer_available": False,
        "legacy_llm_request": legacy_llm_request,
        "fallback_performed": False,
        "glyph_packet_uses_real_renderer": True,
        "projection_allowed": False,
        "memory_write_allowed": False,
        "writes_files": False,
        "identity_vault_write": False,
        "rmc_live_memory_write": False,
        "renders_human_readable_language": mode == "text",
        "echo_validation_required": True,
    }


# Compatibility alias for future adapters.
def render_output(manifest_report: dict[str, Any], audience_profile: str = "operator", style_mode: str = "standard", render_mode: str = "text", **kwargs: Any) -> dict[str, Any]:
    return render_manifest(manifest_report, audience_profile=audience_profile, style_mode=style_mode, render_mode=render_mode, **kwargs)
