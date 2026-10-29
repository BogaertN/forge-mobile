"""
forge/rmc_engine_v1/renderer/renderer.py

RMC-NON-LLM-RENDERER-AND-SEMANTIC-LEXICON-BUILD-009
MEA-admitted deterministic non-LLM renderer preview orchestrator.

Pipeline implemented here:
    Build 008 admission packet
    -> semantic lexicon concept plan
    -> finite grammar sentence plan
    -> deterministic text preview

Build 009 deliberately stops before Echo Validation and approval.  The
returned text is an auditable *preview*, not public or approved system
output.  Build 010 must validate the render back against the admitted
meaning boundary before output may be approved.
"""
from __future__ import annotations

from typing import Any, Dict, Mapping

from rmc_engine_v1.mea.fixed_point_math_contract import canonical_hash
from rmc_engine_v1.renderer.grammar_templates import (
    build_sentence_plan,
    grammar_templates_boundary,
)
from rmc_engine_v1.renderer.mea_render_gate import (
    build_historical_hypothesis_admission_request,
    evaluate_mea_render_admission_request,
)
from rmc_engine_v1.renderer.semantic_lexicon import (
    BUILD_ID,
    SUPPORTED_DELIVERY_MODES,
    build_semantic_plan,
    semantic_lexicon_boundary,
)
from rmc_engine_v1.renderer.surface_realizer import (
    PREVIEW_STATUS,
    realize_sentence_plan,
    surface_realizer_boundary,
)

SCHEMA_VERSION = "rmc_non_llm_renderer_v1_build009"
RENDER_REPORT_SCHEMA_VERSION = "rmc_non_llm_render_report_v1_build009"


def non_llm_renderer_boundary() -> Dict[str, Any]:
    return {
        "build_id": BUILD_ID,
        "schema_version": SCHEMA_VERSION,
        "layer": "RMC deterministic language preview downstream of Build008 MEA admission",
        "input_contract": "accepted_Build008_MEA_render_admission_packet",
        "output_contract": "unapproved_deterministic_render_preview_requires_Build010_echo_validation",
        "supported_delivery_modes": list(SUPPORTED_DELIVERY_MODES),
        "uses_semantic_lexicon": True,
        "uses_grammar_templates": True,
        "uses_surface_realizer": True,
        "uses_free_form_generation": False,
        "calls_llm": False,
        "invokes_generic_output_renderer": False,
        "invokes_existing_echo_validator": False,
        "echo_validation_required_later": True,
        "approves_user_output": False,
        "renders_public_output": False,
        "compiles_rmc_meaning_manifest": False,
        "writes_files": False,
        "writes_mea_memory": False,
        "writes_rmc_output_memory": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "mints_ct": False,
        "writes_ledgers": False,
        "writes_chroma": False,
        "creates_http_routes": False,
        "modifies_ui": False,
        "performs_network_io": False,
        "executes_shell": False,
    }


def _reject(reason_code: str, errors: Any = None) -> Dict[str, Any]:
    return {
        "schema_version": RENDER_REPORT_SCHEMA_VERSION,
        "build_id": BUILD_ID,
        "status": "REJECTED",
        "accepted": False,
        "render_preview_available": False,
        "reason_code": reason_code,
        "errors": errors if errors is not None else [],
        "boundary": non_llm_renderer_boundary(),
        "render_preview": None,
        "echo_validation_required": True,
        "echo_validation_performed": False,
        "approved_output": False,
        "user_facing_output_authorized": False,
        "memory_write_allowed": False,
    }


def render_admitted_preview(admission_packet: Mapping[str, Any], *, delivery_mode: str = "explanation") -> Dict[str, Any]:
    """Render an unapproved preview from one already admitted MEA packet."""
    semantic_result = build_semantic_plan(admission_packet, delivery_mode=delivery_mode)
    if semantic_result.get("accepted") is not True:
        return _reject(semantic_result.get("reason_code", "semantic_plan_rejected"), semantic_result.get("errors", []))

    sentence_result = build_sentence_plan(semantic_result["semantic_plan"])
    if sentence_result.get("accepted") is not True:
        return _reject(sentence_result.get("reason_code", "sentence_plan_rejected"), sentence_result.get("errors", []))

    realization = realize_sentence_plan(sentence_result["sentence_plan"])
    if realization.get("accepted") is not True:
        return _reject(realization.get("reason_code", "surface_realizer_rejected"), realization.get("errors", []))

    render_preview = realization["render_preview"]
    report_body = {
        "schema_version": RENDER_REPORT_SCHEMA_VERSION,
        "build_id": BUILD_ID,
        "status": "OK",
        "accepted": True,
        "render_status": PREVIEW_STATUS,
        "delivery_mode": delivery_mode,
        "render_preview_available": True,
        "source_admission_packet_hash": admission_packet.get("admission_packet_hash"),
        "semantic_plan_hash": semantic_result["semantic_plan"]["semantic_plan_hash"],
        "sentence_plan_hash": sentence_result["sentence_plan"]["sentence_plan_hash"],
        "render_preview_hash": render_preview["render_preview_hash"],
        "render_preview": render_preview,
        "boundary": non_llm_renderer_boundary(),
        "echo_validation_required": True,
        "echo_validation_performed": False,
        "approved_output": False,
        "user_facing_output_authorized": False,
        "memory_write_allowed": False,
    }
    return {**report_body, "render_report_hash": canonical_hash(report_body)}


def render_historical_hypothesis_preview(*, forge_root: Any, delivery_mode: str = "explanation") -> Dict[str, Any]:
    """Re-run Build 008 admission, then render preview text if admission passes."""
    request = build_historical_hypothesis_admission_request(forge_root=forge_root)
    admission = evaluate_mea_render_admission_request(request, forge_root=forge_root)
    if admission.get("accepted") is not True:
        return _reject("build008_admission_rejected", admission.get("errors", []))
    return render_admitted_preview(admission["render_admission_packet"], delivery_mode=delivery_mode)


def non_llm_renderer_status(*, forge_root: Any) -> Dict[str, Any]:
    """Return read-only status plus a deterministic explanation preview."""
    preview = render_historical_hypothesis_preview(forge_root=forge_root, delivery_mode="explanation")
    return {
        "build_id": BUILD_ID,
        "schema_version": SCHEMA_VERSION,
        "status": "OK" if preview.get("accepted") is True else "BLOCKED",
        "preview_status": preview.get("render_status"),
        "qualified_hypothesis_preview_available": preview.get("accepted") is True,
        "supported_delivery_modes": list(SUPPORTED_DELIVERY_MODES),
        "preview": preview,
        "boundary": non_llm_renderer_boundary(),
        "lexicon_boundary": semantic_lexicon_boundary(),
        "grammar_boundary": grammar_templates_boundary(),
        "surface_realizer_boundary": surface_realizer_boundary(),
    }


__all__ = [
    "BUILD_ID",
    "SCHEMA_VERSION",
    "RENDER_REPORT_SCHEMA_VERSION",
    "SUPPORTED_DELIVERY_MODES",
    "non_llm_renderer_boundary",
    "render_admitted_preview",
    "render_historical_hypothesis_preview",
    "non_llm_renderer_status",
]
