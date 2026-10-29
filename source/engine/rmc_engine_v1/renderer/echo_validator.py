"""
forge/rmc_engine_v1/renderer/echo_validator.py

RMC-MEA-ECHO-VALIDATOR-HARDENING-BUILD-010
MEA-specific read-only Echo Validator for deterministic Build 009 previews.

Purpose
-------
Build 010 validates a deterministic rendered preview back against the typed
Build 008 MEA render-admission packet that authorized its meaning.  This
module is downstream of rendering and upstream of any future output-approval
gate.  It does not rewrite text, approve user-facing output, write memory,
create a route, or invoke an LLM.

Production rule
---------------
No rendered preview is eligible for a later approval gate unless it preserves
all material limitations of the admitted manifest boundary in the *rendered
language itself*.  Structured metadata is required, but it is not a substitute
for saying the governing limitation to the eventual reader.

For the stored 144 Hz hypothesis, the rendered language must preserve:
- candidate identity and hypothesis status;
- test_required as the required next action;
- the material proof-debt limitation, 0.85;
- the prohibition on verified-claim / empirical-fact / discovery upgrades;
- the fact that Echo Validation does not itself approve public output.

Build 009 currently includes the full proof-debt caveat in explanation,
verification_result and uncertain_result modes.  Decision, warning,
next_step and refusal omit that caveat from rendered text; this validator
rejects those modes pending later template repair rather than silently
blessing a meaning loss.
"""
from __future__ import annotations

import re
from typing import Any, Dict, Mapping, Sequence

from rmc_engine_v1.mea.fixed_point_math_contract import canonical_hash
from rmc_engine_v1.renderer.mea_render_gate import (
    build_historical_hypothesis_admission_request,
    evaluate_mea_render_admission_request,
)
from rmc_engine_v1.renderer.renderer import (
    RENDER_REPORT_SCHEMA_VERSION,
    render_admitted_preview,
    render_historical_hypothesis_preview,
)
from rmc_engine_v1.renderer.semantic_lexicon import (
    BUILD_ID as RENDERER_BUILD_ID,
    SUPPORTED_DELIVERY_MODES,
    validate_render_admission_packet,
)
from rmc_engine_v1.renderer.surface_realizer import (
    PREVIEW_STATUS,
    RENDER_PREVIEW_SCHEMA_VERSION,
)

BUILD_ID = "RMC-MEA-ECHO-VALIDATOR-HARDENING-BUILD-010"
SCHEMA_VERSION = "rmc_mea_echo_validator_v1_build010"
ECHO_REPORT_SCHEMA_VERSION = "rmc_mea_echo_validation_report_v1_build010"

VALID_STATUS = "ECHO_VALID_PREVIEW_ELIGIBLE_FOR_LATER_APPROVAL_GATE_NOT_APPROVED"
REJECTED_STATUS = "ECHO_VALIDATION_REJECTED_NO_APPROVAL_NO_WRITE"

EXPECTED_CLAIM_STATUS = "hypothesis"
EXPECTED_REQUIRED_NEXT_ACTION = "test_required"
EXPECTED_PROOF_DEBT_TEXT = "0.85"
EXPECTED_PROOF_DEBT_MICRO = 850_000
EXPECTED_SEMANTIC_CLASS = "qualified_hypothesis_explanation"
EXPECTED_PROBLEM_ID = "144hz_substrate_status"
EXPECTED_CANDIDATE_ID = "cg_hypothesis_001"

# Every hard-preservation dimension must pass.  The fixed-point score is a
# human-readable audit metric; it never overrides a failed hard gate.
DIMENSION_WEIGHTS_MICRO = {
    "source_integrity": 130_000,
    "candidate_identity_preservation": 100_000,
    "claim_status_preservation": 140_000,
    "required_next_action_preservation": 140_000,
    "proof_debt_preservation": 150_000,
    "uncertainty_preservation": 110_000,
    "evidence_boundary_preservation": 110_000,
    "permission_boundary_preservation": 120_000,
}
ECHO_PASS_SCORE_MICRO = 1_000_000

_FORBIDDEN_TEXT_RULES: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("verified_claim_upgrade", re.compile(r"\b(?:is|has been|was)\s+(?:a\s+)?verified\s+claim\b", re.I)),
    ("empirical_fact_upgrade", re.compile(r"\b(?:is|has been|was)\s+(?:an?\s+)?empirical\s+fact\b", re.I)),
    ("proven_substrate_claim", re.compile(r"\b144\s*hz\b.*\b(?:is|has been|was)\s+(?:proven|verified|confirmed)\b", re.I)),
    ("unsupported_harmonic_assertion", re.compile(r"\b144\s*hz\b.*\b(?:is|equals|confirms|proves)\b.*\bharmonic\b", re.I)),
    ("discovery_upgrade", re.compile(r"\b(?:this|the)\s+discovery\b|\bwe\s+discovered\b|\bconfirms\s+the\s+hypothesis\b", re.I)),
    ("invented_published_evidence", re.compile(r"\b(?:published|measured|experimental|empirical)\s+(?:evidence|data|measurement)\s+(?:confirms|proves|verifies|shows)\b", re.I)),
)


def echo_validator_boundary() -> Dict[str, Any]:
    return {
        "build_id": BUILD_ID,
        "schema_version": SCHEMA_VERSION,
        "layer": "RMC Echo Validator for MEA-admitted deterministic rendered preview",
        "input_contract": "Build009_unapproved_render_report_plus_exact_Build008_admission_packet",
        "output_contract": "read_only_echo_validation_report_eligible_for_later_approval_or_rejection",
        "requires_build008_admission_packet": True,
        "requires_build009_render_report": True,
        "requires_render_hash_binding": True,
        "requires_claim_status_preservation": True,
        "requires_required_next_action_preservation": True,
        "requires_proof_debt_in_rendered_language": True,
        "requires_uncertainty_preservation": True,
        "rejects_invented_evidence": True,
        "rejects_claim_upgrade": True,
        "rejects_missing_material_caveat": True,
        "uses_fixed_point_echo_score": True,
        "all_hard_checks_required": True,
        "existing_generic_echo_validator_left_untouched": True,
        "approves_user_output": False,
        "authorizes_public_release": False,
        "creates_http_routes": False,
        "modifies_ui": False,
        "writes_files": False,
        "writes_mea_memory": False,
        "writes_rmc_output_memory": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "mints_ct": False,
        "writes_ledgers": False,
        "writes_chroma": False,
        "calls_llm": False,
        "executes_shell": False,
        "performs_network_io": False,
    }


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _has_phrase(text: str, phrase: str) -> bool:
    return phrase.lower() in text.lower()


def _hash_valid(obj: Mapping[str, Any], hash_field: str) -> bool:
    supplied = obj.get(hash_field)
    if not isinstance(supplied, str) or len(supplied) != 64:
        return False
    body = {key: value for key, value in obj.items() if key != hash_field}
    return canonical_hash(body) == supplied


def _base_result(*, delivery_mode: Any = None) -> Dict[str, Any]:
    return {
        "build_id": BUILD_ID,
        "schema_version": ECHO_REPORT_SCHEMA_VERSION,
        "delivery_mode": delivery_mode,
        "boundary": echo_validator_boundary(),
        "echo_validation_performed": True,
        "rendered_output_approved": False,
        "user_facing_output_authorized": False,
        "eligible_for_later_approval_gate": False,
        "memory_write_allowed": False,
        "write_performed": False,
    }


def _finalize_report(
    *,
    delivery_mode: Any,
    checks: Mapping[str, bool],
    failures: Sequence[str],
    source_admission_packet_hash: Any,
    render_report_hash: Any,
    render_preview_hash: Any,
) -> Dict[str, Any]:
    dimension_scores = {
        name: (weight if checks.get(name) is True else 0)
        for name, weight in DIMENSION_WEIGHTS_MICRO.items()
    }
    score_micro = sum(dimension_scores.values())
    passed = not failures and score_micro == ECHO_PASS_SCORE_MICRO
    body = {
        **_base_result(delivery_mode=delivery_mode),
        "status": "OK" if passed else "REJECTED",
        "accepted": passed,
        "echo_status": VALID_STATUS if passed else REJECTED_STATUS,
        "source_admission_packet_hash": source_admission_packet_hash,
        "render_report_hash": render_report_hash,
        "render_preview_hash": render_preview_hash,
        "hard_checks": dict(checks),
        "failure_reasons": list(failures),
        "echo_dimensions_micro": dimension_scores,
        "echo_score_micro": score_micro,
        "echo_score_text": f"{score_micro / ECHO_PASS_SCORE_MICRO:.6f}",
        "echo_pass_threshold_micro": ECHO_PASS_SCORE_MICRO,
        "eligible_for_later_approval_gate": passed,
        "recommended_route": "later_render_approval_gate_review" if passed else "repair_renderer_template_or_reject_output",
        "manifest_failure_detected": False,
        "rendering_failure_detected": not passed,
    }
    return {**body, "echo_validation_report_hash": canonical_hash(body)}


def validate_render_preview_echo(
    render_report: Mapping[str, Any],
    admission_packet: Mapping[str, Any],
) -> Dict[str, Any]:
    """Validate Build 009 rendered language against its Build 008 admission packet."""
    if not isinstance(render_report, Mapping) or not isinstance(admission_packet, Mapping):
        failures = ["render_report_and_admission_packet_mappings_required"]
        return _finalize_report(
            delivery_mode=None,
            checks={name: False for name in DIMENSION_WEIGHTS_MICRO},
            failures=failures,
            source_admission_packet_hash=None,
            render_report_hash=None,
            render_preview_hash=None,
        )

    preview = _mapping(render_report.get("render_preview"))
    epistemic = _mapping(preview.get("epistemic_contract"))
    admission_epistemic = _mapping(admission_packet.get("epistemic_boundary"))
    source = _mapping(admission_packet.get("source_binding"))
    text = _text(preview.get("rendered_text_preview"))
    failures: list[str] = []

    admission_validation = validate_render_admission_packet(admission_packet)
    report_hash_valid = _hash_valid(render_report, "render_report_hash")
    preview_hash_valid = _hash_valid(preview, "render_preview_hash")

    source_integrity = (
        admission_validation.get("valid") is True
        and report_hash_valid
        and preview_hash_valid
        and render_report.get("schema_version") == RENDER_REPORT_SCHEMA_VERSION
        and render_report.get("build_id") == RENDERER_BUILD_ID
        and preview.get("schema_version") == RENDER_PREVIEW_SCHEMA_VERSION
        and preview.get("build_id") == RENDERER_BUILD_ID
        and render_report.get("source_admission_packet_hash") == admission_packet.get("admission_packet_hash")
        and preview.get("semantic_class") == EXPECTED_SEMANTIC_CLASS
    )
    if not source_integrity:
        failures.append("source_or_render_hash_binding_invalid")

    candidate_identity = (
        source.get("problem_id") == EXPECTED_PROBLEM_ID
        and source.get("candidate_id") == EXPECTED_CANDIDATE_ID
        and "`144hz_substrate_status`" in text
    )
    if not candidate_identity:
        failures.append("candidate_identity_not_preserved_in_text")

    claim_status = (
        admission_epistemic.get("claim_status") == EXPECTED_CLAIM_STATUS
        and epistemic.get("claim_status") == EXPECTED_CLAIM_STATUS
        and _has_phrase(text, "classified as a hypothesis")
    )
    if not claim_status:
        failures.append("hypothesis_claim_status_not_preserved")

    required_next_action = (
        admission_epistemic.get("required_next_action") == EXPECTED_REQUIRED_NEXT_ACTION
        and epistemic.get("required_next_action") == EXPECTED_REQUIRED_NEXT_ACTION
        and _has_phrase(text, "Testing is required before any claim-status upgrade")
    )
    if not required_next_action:
        failures.append("required_next_action_test_required_missing")

    proof_debt = (
        admission_epistemic.get("proof_debt_text") == EXPECTED_PROOF_DEBT_TEXT
        and admission_epistemic.get("proof_debt_micro") == EXPECTED_PROOF_DEBT_MICRO
        and epistemic.get("proof_debt_text") == EXPECTED_PROOF_DEBT_TEXT
        and epistemic.get("proof_debt_micro") == EXPECTED_PROOF_DEBT_MICRO
        and _has_phrase(text, "proof-debt value is 0.85")
    )
    if not proof_debt:
        failures.append("material_proof_debt_not_preserved_in_contract_and_rendered_text")

    uncertainty = (
        admission_epistemic.get("uncertainty_must_be_preserved") is True
        and epistemic.get("uncertainty_preserved") is True
        and _has_phrase(text, "hypothesis")
        and _has_phrase(text, "Testing is required")
    )
    if not uncertainty:
        failures.append("uncertainty_not_preserved")

    forbidden_matches = [
        label for label, pattern in _FORBIDDEN_TEXT_RULES if pattern.search(text)
    ]
    evidence_boundary = (
        admission_epistemic.get("may_render_as_verified_claim") is False
        and admission_epistemic.get("may_render_as_empirical_fact") is False
        and admission_epistemic.get("may_render_as_discovery") is False
        and epistemic.get("may_render_as_verified_claim") is False
        and epistemic.get("may_render_as_empirical_fact") is False
        and epistemic.get("may_render_as_discovery") is False
        and not forbidden_matches
    )
    if forbidden_matches:
        failures.extend(["language_exceeds_admitted_scope:" + match for match in forbidden_matches])
    if not evidence_boundary and not forbidden_matches:
        failures.append("evidence_or_claim_upgrade_boundary_not_preserved")

    permissions = (
        render_report.get("echo_validation_required") is True
        and render_report.get("echo_validation_performed") is False
        and render_report.get("approved_output") is False
        and render_report.get("user_facing_output_authorized") is False
        and render_report.get("memory_write_allowed") is False
        and preview.get("preview_status") == PREVIEW_STATUS
        and preview.get("echo_validation_required") is True
        and preview.get("echo_validation_performed") is False
        and preview.get("approved_output") is False
        and preview.get("user_facing_output_authorized") is False
        and preview.get("memory_write_allowed") is False
        and _has_phrase(text, "unapproved until Echo Validation passes")
    )
    if not permissions:
        failures.append("approval_or_memory_permission_boundary_not_preserved")

    checks = {
        "source_integrity": source_integrity,
        "candidate_identity_preservation": candidate_identity,
        "claim_status_preservation": claim_status,
        "required_next_action_preservation": required_next_action,
        "proof_debt_preservation": proof_debt,
        "uncertainty_preservation": uncertainty,
        "evidence_boundary_preservation": evidence_boundary,
        "permission_boundary_preservation": permissions,
    }
    return _finalize_report(
        delivery_mode=render_report.get("delivery_mode"),
        checks=checks,
        failures=failures,
        source_admission_packet_hash=admission_packet.get("admission_packet_hash"),
        render_report_hash=render_report.get("render_report_hash"),
        render_preview_hash=preview.get("render_preview_hash"),
    )


def validate_historical_hypothesis_preview_echo(
    *,
    forge_root: Any,
    delivery_mode: str = "explanation",
) -> Dict[str, Any]:
    """Render a deterministic preview and validate it without approving or writing."""
    request = build_historical_hypothesis_admission_request(forge_root=forge_root)
    admission_response = evaluate_mea_render_admission_request(request, forge_root=forge_root)
    if admission_response.get("accepted") is not True:
        return _finalize_report(
            delivery_mode=delivery_mode,
            checks={name: False for name in DIMENSION_WEIGHTS_MICRO},
            failures=["build008_render_admission_failed"],
            source_admission_packet_hash=None,
            render_report_hash=None,
            render_preview_hash=None,
        )
    admission_packet = admission_response["render_admission_packet"]
    render_report = render_admitted_preview(admission_packet, delivery_mode=delivery_mode)
    if render_report.get("accepted") is not True:
        return _finalize_report(
            delivery_mode=delivery_mode,
            checks={name: False for name in DIMENSION_WEIGHTS_MICRO},
            failures=["build009_render_preview_failed"],
            source_admission_packet_hash=admission_packet.get("admission_packet_hash"),
            render_report_hash=render_report.get("render_report_hash"),
            render_preview_hash=None,
        )
    return validate_render_preview_echo(render_report, admission_packet)


def echo_validator_status(*, forge_root: Any) -> Dict[str, Any]:
    """Read-only Build 010 status across all currently rendered preview modes."""
    reports = {
        mode: validate_historical_hypothesis_preview_echo(
            forge_root=forge_root,
            delivery_mode=mode,
        )
        for mode in SUPPORTED_DELIVERY_MODES
    }
    valid_modes = [mode for mode, report in reports.items() if report.get("accepted") is True]
    rejected_modes = [mode for mode, report in reports.items() if report.get("accepted") is not True]
    canonical = reports["explanation"]
    return {
        "build_id": BUILD_ID,
        "schema_version": SCHEMA_VERSION,
        "status": "OK" if canonical.get("accepted") is True else "BLOCKED",
        "canonical_preview_mode": "explanation",
        "canonical_preview_echo_valid": canonical.get("accepted") is True,
        "canonical_preview_eligible_for_later_approval_gate": canonical.get("eligible_for_later_approval_gate") is True,
        "approved_output": False,
        "user_facing_output_authorized": False,
        "valid_preview_modes": valid_modes,
        "template_repair_required_modes": rejected_modes,
        "mode_reports": reports,
        "boundary": echo_validator_boundary(),
    }


__all__ = [
    "BUILD_ID",
    "SCHEMA_VERSION",
    "ECHO_REPORT_SCHEMA_VERSION",
    "VALID_STATUS",
    "REJECTED_STATUS",
    "DIMENSION_WEIGHTS_MICRO",
    "ECHO_PASS_SCORE_MICRO",
    "echo_validator_boundary",
    "validate_render_preview_echo",
    "validate_historical_hypothesis_preview_echo",
    "echo_validator_status",
]
