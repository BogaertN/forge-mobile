"""Echo Validator / V_t engine.

Patch 262J1R-Preflight-C6 validates rendered output (R_t) against the
compiled manifest (μ_t). Echo validation is downstream of rendering: no R_t
means no V_t approval path. The validator measures whether the rendered output
preserves the manifest claim, phase path, operator path, memory links, drift
state, confidence/novelty metrics, and output-mode schema.

This module is read-only. It never renders language, never compiles a manifest,
never calls an LLM, never writes files, never writes memory, never executes
shell, never touches Identity Vault, and never mutates canonical reference.
"""
from __future__ import annotations

import datetime as _dt
import re
from typing import Any

from rmc_engine_v1.measurement_kernel import clamp, stable_hash, stable_id

ENGINE_VERSION = "rmc_echo_validator_v1_patch262J1R_preflight_C10"
ENGINE_MODE = "read_only_echo_validator_V_t"

REQUIRED_RENDER_FIELDS = [
    "rendered_output_id",
    "source_manifest_id",
    "render_mode",
    "audience_profile",
    "style_mode",
    "R_t",
    "render_fidelity_precheck",
    "echo_validation_required",
]
ECHO_THRESHOLDS_BY_MODE = {
    "formal_text": 0.85,
    "text": 0.82,
    "json_packet": 0.90,
    "dashboard_state": 0.80,
    "glyph_packet": 0.80,
    "internal_debug": 0.72,
}

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


def _text(value: Any, limit: int = 2000) -> str:
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


def _contains_any(rendered_text: str, items: list[Any]) -> float:
    values = [_text(item, 120).lower() for item in items if _text(item, 120)]
    if not values:
        return 1.0
    hay = rendered_text.lower()
    hits = sum(1 for item in values if item in hay)
    return hits / max(1, len(values))


def echo_validator_boundary() -> dict[str, Any]:
    return {
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "engine_module_location": "forge/rmc_engine_v1/echo_validator.py",
        "implements_rmc_stage": "Echo Validator / V_t",
        "input_contract": "C5_render_report_with_R_t_and_source_manifest_packet",
        "output_contract": "V_t_echo_validation_report",
        "validates_render_against_manifest": True,
        "manifest_required": True,
        "render_packet_required": True,
        "memory_writer_stage_present": False,
        "uses_llm": False,
        "queries_chroma": False,
        "reads_db_files": False,
        "executes_shell": False,
        "writes_files": False,
        "writes_rmc_memory": False,
        "writes_identity_vault": False,
        "mutates_canonical_reference": False,
        "approved_output": False,
        "projection_allowed": False,
        "memory_write_allowed": False,
        "read_only_means": "no filesystem or memory mutation; validation math is computed in the response",
        "note": "C6 measures whether R_t preserves μ_t. It does not write memory or approve projection.",
    }


def echo_validator_schema_contract() -> dict[str, Any]:
    return {
        "echo_symbol": "V_t",
        "echo_formula": "V_t = validate_echo(R_t, μ_t)",
        "required_source": "C5 render packet plus source μ_t manifest packet",
        "required_echo_fields": [
            "echo_validation_id",
            "source_rendered_output_id",
            "source_manifest_id",
            "echo_score",
            "echo_components",
            "echo_validation_passed",
            "distortion_flags",
            "recommended_route",
        ],
        "echo_score_formula": "0.24*claim + 0.18*phase + 0.14*drift + 0.12*metrics + 0.12*memory + 0.10*operator + 0.10*schema - distortion_penalty",
        "pass_thresholds_by_mode": ECHO_THRESHOLDS_BY_MODE,
        "axioms_enforced": {
            "no_output_without_trace": True,
            "meaning_precedes_rendering": True,
            "language_is_output_modality_not_core_state": True,
            "rendering_must_preserve_manifest": True,
            "no_memory_write_before_memory_writer": True,
        },
    }


def _render_packet(render_report: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(render_report, dict):
        return {}
    packet = render_report.get("render_packet")
    return dict(packet or {}) if isinstance(packet, dict) else {}


def _manifest_packet(render_report: dict[str, Any], render_packet: dict[str, Any]) -> dict[str, Any]:
    # Preferred: C5 engine_result exposes source_manifest_packet at top level.
    packet = render_report.get("source_manifest_packet") if isinstance(render_report, dict) else None
    if isinstance(packet, dict) and packet:
        return dict(packet)
    source = render_report.get("source_manifest_compiler") if isinstance(render_report, dict) else None
    if isinstance(source, dict) and isinstance(source.get("manifest_packet"), dict):
        return dict(source.get("manifest_packet") or {})
    # Test/diagnostic injection may include it directly inside the render packet.
    injected = render_packet.get("source_manifest_packet") if isinstance(render_packet, dict) else None
    return dict(injected or {}) if isinstance(injected, dict) else {}


def _mu(packet: dict[str, Any]) -> dict[str, Any]:
    return _as_dict(packet.get("μ_t"))


def _drift_status(mu: dict[str, Any]) -> dict[str, Any]:
    return _as_dict(mu.get("drift_status"))


def _memory_links(mu: dict[str, Any]) -> list[dict[str, Any]]:
    return [m for m in _as_list(mu.get("memory_links")) if isinstance(m, dict)]


def _missing_fields(obj: dict[str, Any], fields: list[str]) -> list[str]:
    return [field for field in fields if field not in obj]


def _rendered_text(render_packet: dict[str, Any]) -> str:
    return _text(render_packet.get("R_t"), 10000)


def _score_claim_preservation(mu: dict[str, Any], render_packet: dict[str, Any]) -> float:
    claim = _text(mu.get("claim"), 1800)
    rendered = _rendered_text(render_packet)
    if not claim:
        return 0.0
    mode = str(render_packet.get("render_mode") or "text")
    if claim in rendered:
        return 1.0
    # Glyph packets preserve claim by anchor hash rather than prose.
    try:
        rt = render_packet.get("R_t")
        if mode == "glyph_packet" and isinstance(rt, dict):
            if rt.get("claim_anchor_hash") == stable_hash(claim):
                return 1.0
    except Exception:
        pass
    return _jaccard(_tokens(claim), _tokens(rendered))


def _score_phase_preservation(mu: dict[str, Any], render_packet: dict[str, Any]) -> float:
    phases = [str(p) for p in _as_list(mu.get("phase_path")) if str(p)]
    if not phases:
        return 0.0
    rt = render_packet.get("R_t")
    if isinstance(rt, dict):
        values = str(rt)
    else:
        values = _rendered_text(render_packet)
    return round(_contains_any(values, phases), 6)


def _score_operator_preservation(mu: dict[str, Any], render_packet: dict[str, Any]) -> float:
    operators = [str(op) for op in _as_list(mu.get("operator_path")) if str(op)]
    if not operators:
        return 0.75
    rendered = _rendered_text(render_packet)
    text_score = _contains_any(rendered, operators)
    # JSON/dashboard/glyph renderings can preserve operators by carrying the field name.
    rt = render_packet.get("R_t")
    schema_bonus = 1.0 if isinstance(rt, dict) and "operator" in str(rt).lower() else 0.0
    return round(max(text_score, schema_bonus), 6)


def _score_drift_preservation(mu: dict[str, Any], render_packet: dict[str, Any]) -> float:
    drift = _drift_status(mu)
    rendered = _rendered_text(render_packet)
    if not drift:
        return 0.0
    status = _text(drift.get("status"), 180).lower()
    eps = drift.get("post_epsilon_s")
    pre = drift.get("pre_epsilon_s")
    score = 0.0
    if status and status in rendered.lower():
        score += 0.55
    elif "drift" in rendered.lower():
        score += 0.35
    if eps is not None and (str(round(_clamp(eps), 3)) in rendered or str(round(_clamp(eps), 6)) in rendered):
        score += 0.30
    elif "epsilon" in rendered.lower() or "ε" in rendered:
        score += 0.20
    if pre is not None and ("pre" in rendered.lower() or "post" in rendered.lower()):
        score += 0.15
    return round(_clamp(score), 6)


def _score_metric_preservation(mu: dict[str, Any], render_packet: dict[str, Any]) -> float:
    rendered = _rendered_text(render_packet).lower()
    confidence = _clamp(mu.get("confidence"))
    novelty = _clamp(mu.get("novelty"))
    confidence_hit = "confidence" in rendered or str(round(confidence, 3)) in rendered or str(round(confidence, 6)) in rendered
    novelty_hit = "novelty" in rendered or str(round(novelty, 3)) in rendered or str(round(novelty, 6)) in rendered
    return round((0.5 if confidence_hit else 0.0) + (0.5 if novelty_hit else 0.0), 6)


def _score_memory_preservation(mu: dict[str, Any], render_packet: dict[str, Any]) -> float:
    links = _memory_links(mu)
    if not links:
        return 1.0
    rendered = _rendered_text(render_packet).lower()
    rt = render_packet.get("R_t")
    if isinstance(rt, dict) and "memory" in str(rt).lower():
        return 1.0
    # Text renderings may carry a count rather than every memory id.
    if "memory" in rendered and str(len(links)) in rendered:
        return 0.85
    id_hits = 0
    for item in links:
        for key in ("memory_id", "id", "source", "source_id"):
            val = _text(item.get(key), 100).lower()
            if val and val in rendered:
                id_hits += 1
                break
    return round(_clamp(id_hits / max(1, len(links))), 6)


def _score_schema_integrity(render_packet: dict[str, Any], manifest_packet: dict[str, Any], mu: dict[str, Any]) -> float:
    render_missing = _missing_fields(render_packet, REQUIRED_RENDER_FIELDS)
    mu_missing = _missing_fields(mu, REQUIRED_MU_FIELDS)
    manifest_id_match = bool(render_packet.get("source_manifest_id") and render_packet.get("source_manifest_id") == manifest_packet.get("manifest_id"))
    score = 1.0
    score -= 0.04 * len(render_missing)
    score -= 0.05 * len(mu_missing)
    if not manifest_id_match:
        score -= 0.25
    if not bool(render_packet.get("echo_validation_required")):
        score -= 0.20
    return round(_clamp(score), 6)


def _distortion_flags(mu: dict[str, Any], render_packet: dict[str, Any]) -> dict[str, Any]:
    rendered = _rendered_text(render_packet).lower()
    confidence = _clamp(mu.get("confidence"))
    novelty = _clamp(mu.get("novelty"))
    drift = _drift_status(mu)
    flags = {
        "claims_final_approval_before_echo": any(term in rendered for term in ["approved final", "final approved", "memory write allowed", "projection allowed"]),
        "claims_certainty_with_low_confidence": confidence < 0.55 and any(term in rendered for term in ["certain", "definitely", "proven", "settled truth"]),
        "hides_high_novelty": novelty > 0.70 and "novelty" not in rendered and "hypothesis" not in rendered and "candidate" not in rendered,
        "hides_drift_status": bool(drift) and "drift" not in rendered and "epsilon" not in rendered and "ε" not in rendered,
        "missing_claim_content": _score_claim_preservation(mu, render_packet) < 0.35,
    }
    penalty = 0.0
    penalty += 0.35 if flags["claims_final_approval_before_echo"] else 0.0
    penalty += 0.20 if flags["claims_certainty_with_low_confidence"] else 0.0
    penalty += 0.12 if flags["hides_high_novelty"] else 0.0
    penalty += 0.10 if flags["hides_drift_status"] else 0.0
    penalty += 0.18 if flags["missing_claim_content"] else 0.0
    flags["distortion_penalty"] = round(_clamp(penalty), 6)
    flags["hard_violation"] = bool(flags["claims_final_approval_before_echo"] or flags["missing_claim_content"])
    return flags


def _echo_components(mu: dict[str, Any], render_packet: dict[str, Any], manifest_packet: dict[str, Any]) -> dict[str, float]:
    return {
        "claim_preservation": round(_clamp(_score_claim_preservation(mu, render_packet)), 6),
        "phase_preservation": round(_clamp(_score_phase_preservation(mu, render_packet)), 6),
        "drift_preservation": round(_clamp(_score_drift_preservation(mu, render_packet)), 6),
        "metric_preservation": round(_clamp(_score_metric_preservation(mu, render_packet)), 6),
        "memory_preservation": round(_clamp(_score_memory_preservation(mu, render_packet)), 6),
        "operator_preservation": round(_clamp(_score_operator_preservation(mu, render_packet)), 6),
        "schema_integrity": round(_clamp(_score_schema_integrity(render_packet, manifest_packet, mu)), 6),
    }


def _echo_score(components: dict[str, float], penalty: float) -> float:
    score = (
        0.24 * components.get("claim_preservation", 0.0)
        + 0.18 * components.get("phase_preservation", 0.0)
        + 0.14 * components.get("drift_preservation", 0.0)
        + 0.12 * components.get("metric_preservation", 0.0)
        + 0.12 * components.get("memory_preservation", 0.0)
        + 0.10 * components.get("operator_preservation", 0.0)
        + 0.10 * components.get("schema_integrity", 0.0)
        - _clamp(penalty)
    )
    return round(_clamp(score), 6)


def _blocked_echo(render_report: dict[str, Any], reason: str) -> dict[str, Any]:
    return {
        "status": "BLOCKED",
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "stage": "Echo Validator",
        "echo_validation_allowed": False,
        "V_t_present": False,
        "V_t": None,
        "reason": reason,
        "source_render_status": render_report.get("status") if isinstance(render_report, dict) else None,
        "blocked_echo_candidate": {
            "blocked_echo_id": stable_id("vblock", {"reason": reason, "render_status": render_report.get("status") if isinstance(render_report, dict) else None}),
            "status": "blocked_before_echo_validation",
            "reason": reason,
            "rendering_allowed": bool(render_report.get("rendering_allowed")) if isinstance(render_report, dict) else False,
            "R_t_present": bool(render_report.get("R_t_present")) if isinstance(render_report, dict) else False,
        },
        "echo_validation_passed": False,
        "approved_output": False,
        "projection_allowed": False,
        "memory_write_allowed": False,
        "writes_files": False,
        "boundary": echo_validator_boundary(),
    }


def _threshold_for_render(render_packet: dict[str, Any], mu: dict[str, Any]) -> tuple[str, float]:
    mode = str(render_packet.get("render_mode") or "text").strip().lower().replace("-", "_")
    style = str(render_packet.get("style_mode") or "").strip().lower().replace("-", "_")
    audience = str(render_packet.get("audience_profile") or "").strip().lower().replace("-", "_")
    targets = []
    for target in _as_list(mu.get("output_targets")):
        if isinstance(target, dict):
            targets.append(str(target.get("target") or "").strip().lower().replace("-", "_"))
        else:
            targets.append(str(target).strip().lower().replace("-", "_"))
    if style in {"internal_debug", "debug"} or audience == "internal_debug":
        return "internal_debug", ECHO_THRESHOLDS_BY_MODE["internal_debug"]
    if mode == "text" and (style in {"formal", "formal_text", "scientific", "paper"} or "formal_text" in targets):
        return "formal_text", ECHO_THRESHOLDS_BY_MODE["formal_text"]
    if mode in ECHO_THRESHOLDS_BY_MODE:
        return mode, ECHO_THRESHOLDS_BY_MODE[mode]
    return "text", ECHO_THRESHOLDS_BY_MODE["text"]


def validate_echo(render_report: dict[str, Any]) -> dict[str, Any]:
    """Validate that rendered output R_t preserves manifest μ_t.

    The validator returns V_t only when R_t and μ_t are both present. A passed
    echo means the rendering is faithful enough for the next stage. It still
    does not write memory or approve projection.
    """
    if not isinstance(render_report, dict):
        render_report = {}
    render_packet = _render_packet(render_report)
    if not render_packet:
        return _blocked_echo(render_report, "render_packet_missing_or_render_blocked")
    if not bool(render_report.get("R_t_present")):
        return _blocked_echo(render_report, "R_t_not_present")
    manifest_packet = _manifest_packet(render_report, render_packet)
    if not manifest_packet:
        return _blocked_echo(render_report, "source_manifest_packet_missing")
    mu = _mu(manifest_packet)
    if not mu:
        return _blocked_echo(render_report, "source_mu_t_missing")
    render_missing = _missing_fields(render_packet, REQUIRED_RENDER_FIELDS)
    mu_missing = _missing_fields(mu, REQUIRED_MU_FIELDS)
    components = _echo_components(mu, render_packet, manifest_packet)
    distortion = _distortion_flags(mu, render_packet)
    score = _echo_score(components, distortion.get("distortion_penalty", 0.0))
    threshold_key, threshold = _threshold_for_render(render_packet, mu)
    passed = bool(score >= threshold and not distortion.get("hard_violation") and not render_missing and not mu_missing)
    recommended_route = "route_to_memory_writer_dry_run" if passed else "route_to_renderer_repair_or_manifest_review"
    validation_id = stable_id("vt", {
        "rendered_output_id": render_packet.get("rendered_output_id"),
        "manifest_id": manifest_packet.get("manifest_id"),
        "score": score,
        "components": components,
        "distortion": distortion,
    })
    V_t = {
        "echo_validation_id": validation_id,
        "echo_symbol": "V_t",
        "echo_created_at_utc": _utc_now(),
        "source_rendered_output_id": render_packet.get("rendered_output_id"),
        "source_manifest_id": manifest_packet.get("manifest_id"),
        "source_manifest_hash": manifest_packet.get("manifest_hash"),
        "render_mode": render_packet.get("render_mode"),
        "echo_score": score,
        "echo_threshold": threshold,
        "echo_threshold_key": threshold_key,
        "echo_thresholds_by_mode": ECHO_THRESHOLDS_BY_MODE,
        "echo_components": components,
        "distortion_flags": distortion,
        "render_missing_fields": render_missing,
        "mu_missing_fields": mu_missing,
        "echo_validation_passed": passed,
        "recommended_route": recommended_route,
        "formula": echo_validator_schema_contract().get("echo_score_formula"),
        "approved_for_memory_writer_dry_run": passed,
        "approved_output": False,
        "projection_allowed": False,
        "memory_write_allowed": False,
    }
    return {
        "status": "OK" if passed else "ECHO_REPAIR_REQUIRED",
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "stage": "Echo Validator",
        "echo_validation_allowed": True,
        "V_t_present": True,
        "V_t": V_t,
        "echo_validation_passed": passed,
        "echo_score": score,
        "echo_components": components,
        "distortion_flags": distortion,
        "source_render_packet": render_packet,
        "source_manifest_packet": manifest_packet,
        "schema_contract": echo_validator_schema_contract(),
        "boundary": echo_validator_boundary(),
        "recommended_route": recommended_route,
        "approved_output": False,
        "projection_allowed": False,
        "memory_write_allowed": False,
        "writes_files": False,
        "identity_vault_write": False,
        "rmc_live_memory_write": False,
    }


# Compatibility alias for future adapters.
def validate_render_echo(render_report: dict[str, Any]) -> dict[str, Any]:
    return validate_echo(render_report)
