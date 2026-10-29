"""
forge/rmc_engine_v1/renderer/surface_realizer.py

RMC-NON-LLM-RENDERER-AND-SEMANTIC-LEXICON-BUILD-009
Deterministic text surface realization for unapproved render previews.

The realizer joins a verified finite sentence plan into text.  It performs a
pre-Echo safety scan that can block obvious claim upgrades, but it is not the
Build 010 Echo Validator and cannot approve output.
"""
from __future__ import annotations

from typing import Any, Dict, Mapping

from rmc_engine_v1.mea.fixed_point_math_contract import canonical_hash
from rmc_engine_v1.renderer.grammar_templates import SENTENCE_PLAN_SCHEMA_VERSION
from rmc_engine_v1.renderer.semantic_lexicon import BUILD_ID, FORBIDDEN_ASSERTION_FRAGMENTS

SCHEMA_VERSION = "rmc_surface_realizer_v1_build009"
RENDER_PREVIEW_SCHEMA_VERSION = "rmc_non_llm_render_preview_v1_build009"
PREVIEW_STATUS = "UNAPPROVED_RENDER_PREVIEW_REQUIRES_BUILD010_ECHO_VALIDATION"


def surface_realizer_boundary() -> Dict[str, Any]:
    return {
        "build_id": BUILD_ID,
        "schema_version": SCHEMA_VERSION,
        "deterministic_non_llm_text_preview": True,
        "pre_echo_safety_scan_only": True,
        "invokes_echo_validator": False,
        "approves_user_output": False,
        "writes_files": False,
        "writes_memory": False,
        "calls_llm": False,
        "creates_http_routes": False,
        "modifies_ui": False,
    }


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _unsafe_fragments(text: str) -> list[str]:
    lowered = text.lower()
    return [fragment for fragment in FORBIDDEN_ASSERTION_FRAGMENTS if fragment.lower() in lowered]


def realize_sentence_plan(sentence_plan: Mapping[str, Any]) -> Dict[str, Any]:
    """Create deterministic preview text after sentence-plan integrity checks."""
    if not isinstance(sentence_plan, Mapping):
        return {"status": "REJECTED", "accepted": False, "reason_code": "sentence_plan_mapping_required"}
    if sentence_plan.get("schema_version") != SENTENCE_PLAN_SCHEMA_VERSION:
        return {"status": "REJECTED", "accepted": False, "reason_code": "sentence_plan_schema_invalid"}
    if sentence_plan.get("build_id") != BUILD_ID:
        return {"status": "REJECTED", "accepted": False, "reason_code": "sentence_plan_build_invalid"}

    body = {key: value for key, value in sentence_plan.items() if key != "sentence_plan_hash"}
    if canonical_hash(body) != sentence_plan.get("sentence_plan_hash"):
        return {"status": "REJECTED", "accepted": False, "reason_code": "sentence_plan_hash_invalid"}

    clauses = sentence_plan.get("clauses")
    if not isinstance(clauses, list) or not clauses:
        return {"status": "REJECTED", "accepted": False, "reason_code": "sentence_plan_clauses_required"}
    positions = [clause.get("position") for clause in clauses if isinstance(clause, Mapping)]
    if positions != list(range(1, len(clauses) + 1)):
        return {"status": "REJECTED", "accepted": False, "reason_code": "sentence_plan_order_invalid"}

    text = " ".join(str(clause["sentence"]) for clause in clauses)
    unsafe = _unsafe_fragments(text)
    required_strings = (
        "hypothesis",
        "Testing is required",
        "Echo Validation",
    )
    missing = [required for required in required_strings if required not in text]
    if unsafe or missing:
        return {
            "status": "REJECTED",
            "accepted": False,
            "reason_code": "pre_echo_surface_safety_check_failed",
            "errors": {"unsafe_fragments": unsafe, "missing_required_caveats": missing},
        }

    preview_body = {
        "schema_version": RENDER_PREVIEW_SCHEMA_VERSION,
        "build_id": BUILD_ID,
        "preview_status": PREVIEW_STATUS,
        "delivery_mode": sentence_plan["delivery_mode"],
        "semantic_class": sentence_plan["semantic_class"],
        "semantic_plan_hash": sentence_plan["semantic_plan_hash"],
        "sentence_plan_hash": sentence_plan["sentence_plan_hash"],
        "epistemic_contract": dict(_mapping(sentence_plan.get("epistemic_contract"))),
        "rendered_text_preview": text,
        "pre_echo_surface_safety": {
            "passed": True,
            "unsafe_fragments": [],
            "mandatory_caveats_present": True,
            "not_a_replacement_for_echo_validation": True,
        },
        "echo_validation_required": True,
        "echo_validation_performed": False,
        "approved_output": False,
        "user_facing_output_authorized": False,
        "memory_write_allowed": False,
    }
    return {
        "status": "OK",
        "accepted": True,
        "render_preview": {**preview_body, "render_preview_hash": canonical_hash(preview_body)},
    }


__all__ = [
    "SCHEMA_VERSION",
    "RENDER_PREVIEW_SCHEMA_VERSION",
    "PREVIEW_STATUS",
    "surface_realizer_boundary",
    "realize_sentence_plan",
]
