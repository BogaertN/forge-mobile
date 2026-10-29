"""
forge/rmc_engine_v1/mea/operator_engine.py

Patch 287 — MEA Operator Engine Preview.

This module formalizes the draft layer of Manifest Evolution Algebra.
It executes registered deterministic operators in preview mode and returns
unverified drafts d_i = O_gen(M_t). A draft is not a candidate, cannot be
sealed, cannot render, cannot write memory, and cannot be promoted.

Verification into candidates c_i = O_verify ∘ O_gen(M_t) belongs to Patch 288.

Boundary: stdlib only, deterministic, no file writes, no memory writes,
no Chroma writes, no Identity Vault writes, no LLM calls, no shell execution,
no network I/O, no live candidate commit, no live manifest advance, no seal.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, Mapping, Optional, Tuple

from .manifest_schema import (
    ProblemManifest,
    build_144hz_test_manifest,
    canonical_hash,
    to_dict,
)
from .operator_registry import (
    OperatorRegistry,
    build_default_operator_registry,
    canonical_parameter_hash,
)

OPERATOR_ENGINE_PATCH_ID = "Patch 287 — MEA Operator Engine Preview"
OPERATOR_ENGINE_SCHEMA_VERSION = "mea_operator_engine_draft_v1_patch287"
OPERATOR_ENGINE_MODE = "controlled_mea_operator_engine_preview_patch287"
OPERATOR_ENGINE_APPROVAL_TOKEN = "APPROVE_MEA_OPERATOR_ENGINE_PREVIEW"
OPERATOR_ENGINE_STATUS_ROUTE = "/api/mea/operator-engine/status"
OPERATOR_ENGINE_PREVIEW_ROUTE = "/api/mea/operator-engine-preview"
OPERATOR_ENGINE_POST_ROUTE = "/api/mea/operator-engine-gate"
OPERATOR_ENGINE_FORMULA = "d_i = O_gen(M_t); c_i = O_verify ∘ d_i"

_DRAFT_NOTE = (
    "Unverified draft d_i = O_gen(M_t). NOT a candidate c_i. "
    "Candidates require O_verify in Patch 288."
)

_PREVIEW_OPERATOR_CALLS: Tuple[Dict[str, Any], ...] = (
    {
        "operator_id": "noop_recall",
        "theta_k": {},
        "label": "noop_recall — reference-only draft; no discovery",
    },
    {
        "operator_id": "hypothesize",
        "theta_k": {
            "hypothesis_id": "harmonic_from_90hz",
            "hypothesis_text": (
                "144 Hz is a derived harmonic of the 90 Hz binding frequency "
                "via approximate golden-ratio scaling (90 * 1.6 ≈ 144)."
            ),
            "confidence": 0.35,
        },
        "label": "hypothesize — 144 Hz harmonic path draft",
    },
    {
        "operator_id": "branch",
        "theta_k": {
            "branch_label": "empirical_measurement_path",
            "branch_goal": "Find published myelin-specific measurement of 144 Hz.",
            "branch_unknown": "Direct empirical measurement of 144 Hz in myelin.",
        },
        "label": "branch — empirical measurement investigation draft",
    },
)


def _canonical_json_hash(value: Any) -> str:
    blob = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def _draft_id(parent_hash: str, operator_id: str, theta_hash: str) -> str:
    return _canonical_json_hash({
        "parent_hash": parent_hash,
        "operator_id": operator_id,
        "theta_hash": theta_hash,
        "schema_version": OPERATOR_ENGINE_SCHEMA_VERSION,
    })


@dataclass(frozen=True)
class OperatorDraftResult:
    draft_id: str
    parent_hash: str
    parent_problem_id: str
    operator_id: str
    theta_raw_hash: str
    theta_hash: str
    theta_k: Dict[str, Any]
    theta_normalized: Dict[str, Any]
    operator_registered: bool
    operator_replayable: bool
    parameters_valid: bool
    draft_executed: bool
    draft_manifest: Optional[Dict[str, Any]]
    draft_hash: Optional[str]
    operator_definition: Optional[Dict[str, Any]]
    parameter_validation: Optional[Dict[str, Any]]
    operator_trace: Dict[str, Any]
    is_draft: bool = True
    is_candidate: bool = False
    verified: bool = False
    sealed: bool = False
    render_permitted: bool = False
    memory_promotion_permitted: bool = False
    candidate_sealing_permitted: bool = False
    live_candidate_commit_permitted: bool = False
    live_manifest_advance_permitted: bool = False
    draft_note: str = _DRAFT_NOTE
    errors: Tuple[str, ...] = field(default_factory=tuple)
    warnings: Tuple[str, ...] = field(default_factory=tuple)
    patch_id: str = OPERATOR_ENGINE_PATCH_ID
    schema_version: str = OPERATOR_ENGINE_SCHEMA_VERSION

    def __post_init__(self) -> None:
        forbidden_true = (
            "is_candidate",
            "verified",
            "sealed",
            "render_permitted",
            "memory_promotion_permitted",
            "candidate_sealing_permitted",
            "live_candidate_commit_permitted",
            "live_manifest_advance_permitted",
        )
        for attr in forbidden_true:
            if getattr(self, attr):
                raise ValueError(f"OperatorDraftResult.{attr} must remain False in Patch 287")

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _registry() -> OperatorRegistry:
    return build_default_operator_registry()


def _validate_and_normalize(registry: OperatorRegistry, operator_id: str, theta_k: Mapping[str, Any]) -> tuple[bool, Dict[str, Any], Dict[str, Any], Tuple[str, ...], Tuple[str, ...]]:
    validation = registry.validate_parameters(operator_id, theta_k)
    normalized = dict(validation.normalized_parameters) if validation.valid else {}
    return (
        bool(validation.valid),
        validation.to_dict(),
        normalized,
        tuple(validation.errors),
        tuple(validation.warnings),
    )


def run_operator_preview(
    starting_manifest: ProblemManifest,
    operator_id: str,
    theta_k: Optional[Mapping[str, Any]] = None,
) -> OperatorDraftResult:
    """Execute O_gen in preview mode and return unverified draft d_i.

    This function is deterministic and side-effect free. It never writes state and
    never returns a sealable candidate. Patch 288 must verify drafts before they
    may become candidate previews.
    """
    if not isinstance(starting_manifest, ProblemManifest):
        raise TypeError("starting_manifest must be ProblemManifest")

    registry = _registry()
    operator_id_clean = str(operator_id or "").strip()
    theta_raw = dict(theta_k or {})
    theta_raw_hash = canonical_parameter_hash(theta_raw)
    parent_hash = canonical_hash(starting_manifest)
    parent_problem_id = starting_manifest.problem_id

    errors: list[str] = []
    warnings: list[str] = []
    operator_definition: Optional[Dict[str, Any]] = None
    parameter_validation: Optional[Dict[str, Any]] = None
    theta_normalized: Dict[str, Any] = {}
    operator_registered = registry.has_operator(operator_id_clean)
    operator_replayable = False
    parameters_valid = False
    draft_manifest: Optional[Dict[str, Any]] = None
    draft_hash: Optional[str] = None

    if not operator_id_clean:
        errors.append("operator_id must be non-empty")
    elif not operator_registered:
        errors.append(f"unknown operator_id: {operator_id_clean!r}")
    else:
        definition = registry.get(operator_id_clean)
        operator_definition = definition.to_dict()
        operator_replayable = bool(definition.replayable)
        if not operator_replayable:
            errors.append(f"operator {operator_id_clean!r} is registered but non-replayable")
        try:
            parameters_valid, parameter_validation, theta_normalized, val_errors, val_warnings = _validate_and_normalize(registry, operator_id_clean, theta_raw)
            errors.extend(val_errors)
            warnings.extend(val_warnings)
        except Exception as exc:
            errors.append(f"parameter validation error: {exc}")
            parameter_validation = {"valid": False, "normalized_parameters": {}, "errors": tuple(errors), "warnings": tuple(warnings)}
        if operator_replayable and parameters_valid:
            try:
                result_manifest = registry.apply(starting_manifest, operator_id_clean, theta_normalized)
                draft_manifest = to_dict(result_manifest)
                draft_hash = canonical_hash(result_manifest)
            except Exception as exc:
                errors.append(f"operator execution error: {exc}")

    theta_effective = theta_normalized if parameters_valid else theta_raw
    theta_hash = canonical_parameter_hash(theta_effective)
    draft_id = _draft_id(parent_hash, operator_id_clean, theta_hash)
    draft_executed = draft_hash is not None and not errors
    if draft_executed:
        warnings.append(_DRAFT_NOTE)

    operator_trace = {
        "trace_type": "operator_preview_draft_trace",
        "formula": OPERATOR_ENGINE_FORMULA,
        "parent_hash": parent_hash,
        "operator_id": operator_id_clean,
        "theta_raw_hash": theta_raw_hash,
        "theta_hash": theta_hash,
        "operator_registered": operator_registered,
        "operator_replayable": operator_replayable,
        "parameters_valid": parameters_valid,
        "draft_hash": draft_hash,
        "draft_is_candidate": False,
        "verification_required_before_candidate": True,
        "patch_id": OPERATOR_ENGINE_PATCH_ID,
        "schema_version": OPERATOR_ENGINE_SCHEMA_VERSION,
    }

    return OperatorDraftResult(
        draft_id=draft_id,
        parent_hash=parent_hash,
        parent_problem_id=parent_problem_id,
        operator_id=operator_id_clean,
        theta_raw_hash=theta_raw_hash,
        theta_hash=theta_hash,
        theta_k=theta_raw,
        theta_normalized=theta_effective,
        operator_registered=operator_registered,
        operator_replayable=operator_replayable,
        parameters_valid=parameters_valid,
        draft_executed=draft_executed,
        draft_manifest=draft_manifest,
        draft_hash=draft_hash,
        operator_definition=operator_definition,
        parameter_validation=parameter_validation,
        operator_trace=operator_trace,
        errors=tuple(errors),
        warnings=tuple(warnings),
    )


def build_operator_engine_preview() -> Dict[str, Any]:
    parent = build_144hz_test_manifest()
    draft_results = []
    for call in _PREVIEW_OPERATOR_CALLS:
        result = run_operator_preview(parent, call["operator_id"], call.get("theta_k", {}))
        row = result.to_dict()
        row["preview_label"] = call.get("label", call["operator_id"])
        draft_results.append(row)

    return {
        "status": "OK",
        "endpoint": OPERATOR_ENGINE_PREVIEW_ROUTE,
        "mode": OPERATOR_ENGINE_MODE,
        "current_patch": OPERATOR_ENGINE_PATCH_ID,
        "schema_version": OPERATOR_ENGINE_SCHEMA_VERSION,
        "formula": OPERATOR_ENGINE_FORMULA,
        "preview_type": "operator_engine_draft_preview",
        "parent_problem_id": parent.problem_id,
        "parent_hash": canonical_hash(parent),
        "draft_count": len(draft_results),
        "executed_draft_count": sum(1 for item in draft_results if item.get("draft_executed") is True),
        "draft_results": draft_results,
        "operator_engine_visible": True,
        "live_operator_execution_active": False,
        "draft_sealing_active": False,
        "draft_rendering_active": False,
        "live_candidate_commit_active": False,
        "candidate_sealing_active": False,
        "memory_promotion_active": False,
        "seal_route_available": False,
        "boundary": operator_engine_boundary(),
    }


def build_operator_engine_rejection_preview(endpoint: str = OPERATOR_ENGINE_POST_ROUTE) -> Dict[str, Any]:
    return {
        "status": "REJECTED",
        "endpoint": endpoint,
        "mode": OPERATOR_ENGINE_MODE,
        "current_patch": OPERATOR_ENGINE_PATCH_ID,
        "schema_version": OPERATOR_ENGINE_SCHEMA_VERSION,
        "gate_status": "REJECTED",
        "accepted": False,
        "reason_code": "approval_token_required",
        "approval_required": True,
        "approval_token_name": "approval_token",
        "expected_approval_token": OPERATOR_ENGINE_APPROVAL_TOKEN,
        "gate_errors": ["missing or invalid approval_token for controlled MEA operator engine preview"],
        "draft_count": 0,
        "non_mutating": True,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "commits_live_candidates": False,
        "advances_live_manifest": False,
        "seals_candidates": False,
        "promotes_to_memory": False,
        "boundary": operator_engine_boundary(),
    }


def evaluate_operator_engine_request(request: Optional[Mapping[str, Any]] = None, endpoint: str = OPERATOR_ENGINE_POST_ROUTE) -> Dict[str, Any]:
    req = dict(request or {})
    token = str(req.get("approval_token", "") or "")
    if token != OPERATOR_ENGINE_APPROVAL_TOKEN:
        return build_operator_engine_rejection_preview(endpoint=endpoint)

    operator_id = str(req.get("operator_id", "") or "").strip()
    theta_k = req.get("theta_k") or {}
    if operator_id:
        parent = build_144hz_test_manifest()
        result = run_operator_preview(parent, operator_id, theta_k if isinstance(theta_k, Mapping) else {})
        payload = {
            "status": "OK",
            "endpoint": endpoint,
            "mode": OPERATOR_ENGINE_MODE,
            "current_patch": OPERATOR_ENGINE_PATCH_ID,
            "schema_version": OPERATOR_ENGINE_SCHEMA_VERSION,
            "gate_status": "ACCEPTED_PREVIEW_ONLY",
            "accepted": True,
            "preview_type": "single_operator_draft_preview",
            "draft_count": 1,
            "draft_result": result.to_dict(),
            "live_operator_execution_active": False,
            "draft_sealing_active": False,
            "draft_rendering_active": False,
            "live_candidate_commit_active": False,
            "seals_candidates": False,
            "promotes_to_memory": False,
            "seal_route_available": False,
            "boundary": operator_engine_boundary(),
        }
        return payload

    preview = build_operator_engine_preview()
    preview.update({
        "endpoint": endpoint,
        "gate_status": "ACCEPTED_PREVIEW_ONLY",
        "accepted": True,
        "seals_candidates": False,
        "promotes_to_memory": False,
        "seal_route_available": False,
    })
    return preview


def operator_engine_status() -> Dict[str, Any]:
    registry = _registry()
    definitions = registry.list_definitions()
    return {
        "status": "OK",
        "endpoint": OPERATOR_ENGINE_STATUS_ROUTE,
        "mode": OPERATOR_ENGINE_MODE,
        "current_patch": OPERATOR_ENGINE_PATCH_ID,
        "schema_version": OPERATOR_ENGINE_SCHEMA_VERSION,
        "formula": OPERATOR_ENGINE_FORMULA,
        "operator_engine_visible": True,
        "preview_route": OPERATOR_ENGINE_PREVIEW_ROUTE,
        "post_route": OPERATOR_ENGINE_POST_ROUTE,
        "approval_required": True,
        "approval_token": OPERATOR_ENGINE_APPROVAL_TOKEN,
        "registered_operator_count": len(definitions),
        "replayable_operator_count": sum(1 for item in definitions if item.replayable),
        "preview_operators": [item["operator_id"] for item in _PREVIEW_OPERATOR_CALLS],
        "live_operator_execution_active": False,
        "draft_sealing_active": False,
        "draft_rendering_active": False,
        "live_candidate_commit_active": False,
        "candidate_sealing_active": False,
        "memory_promotion_active": False,
        "seal_route_available": False,
        "boundary": operator_engine_boundary(),
    }


def operator_engine_boundary() -> Dict[str, Any]:
    return {
        "patch": OPERATOR_ENGINE_PATCH_ID,
        "schema_version": OPERATOR_ENGINE_SCHEMA_VERSION,
        "layer": "MEA operator engine / draft generation preview",
        "read_only": False,
        "non_mutating": True,
        "creates_get_routes": True,
        "creates_post_routes": True,
        "get_routes": [OPERATOR_ENGINE_STATUS_ROUTE, OPERATOR_ENGINE_PREVIEW_ROUTE],
        "post_routes": [OPERATOR_ENGINE_POST_ROUTE],
        "requires_approval_token": True,
        "approval_token": OPERATOR_ENGINE_APPROVAL_TOKEN,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "performs_network_io": False,
        "seeds_live_manifests": False,
        "commits_live_candidates": False,
        "advances_live_manifest": False,
        "seals_candidates": False,
        "promotes_to_memory": False,
        "renders_user_output": False,
        "mutates_existing_rmc_behavior": False,
        "mutates_launcher_behavior": False,
        "mutates_operator_console_ui": False,
        "seal_route_available": False,
        "memory_promotion_route_available": False,
        "draft_is_not_candidate": True,
        "draft_requires_patch288_verification": True,
    }
