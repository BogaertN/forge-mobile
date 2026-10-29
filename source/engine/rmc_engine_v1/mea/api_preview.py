"""
forge/rmc_engine_v1/mea/api_preview.py

Patch 280 — MEA Read-Only API / Operator Console Visibility.

This module exposes deterministic, read-only preview payload builders for the
Forge Discovery Kernel. It does not seed live manifests, seal candidates,
promote memory, write files, write databases, call LLMs, call network tools, or
execute shell commands.

The four Patch 280 GET-only preview surfaces are:
- /api/mea/problem-manifest-preview
- /api/mea/unknown-vector-preview
- /api/mea/claim-status-preview
- /api/mea/replay-preview
"""

from __future__ import annotations

from typing import Any, Dict, Mapping

from .claim_status_classifier import (
    CLAIM_STATUS_CLASSIFIER_FORMULA,
    claim_status_taxonomy,
    classify_claim_status,
    classifier_boundary,
)
from .convergence_scorer import score_convergence
from .discovery_kernel import kernel_identity
from .information_gain_scorer import score_information_gain
from .manifest_schema import (
    MEA_SCHEMA_VERSION,
    ClaimStatus,
    build_144hz_test_manifest,
    canonical_hash,
    from_dict,
    to_dict,
    validate_manifest,
)
from .operator_registry import operator_registry_summary
from .proof_debt_scorer import score_proof_debt
from .replay_engine import REPLAY_LAW_FORMULA, replay_candidate, replay_operator_path
from .unknown_detector import detect_unknowns

API_PREVIEW_PATCH_ID = "Patch 280 — MEA Read-Only API / Operator Console Visibility"
API_PREVIEW_SCHEMA_VERSION = "mea_read_only_api_preview_v1_patch280"
API_PREVIEW_MODE = "read_only_mea_api_preview_patch280"

MEA_READ_ONLY_PREVIEW_ROUTES: Dict[str, str] = {
    "problem_manifest_preview": "/api/mea/problem-manifest-preview",
    "unknown_vector_preview": "/api/mea/unknown-vector-preview",
    "claim_status_preview": "/api/mea/claim-status-preview",
    "replay_preview": "/api/mea/replay-preview",
}


def api_preview_boundary() -> Dict[str, Any]:
    """Declare the Patch 280 read-only API surface boundary."""

    return {
        "patch": API_PREVIEW_PATCH_ID,
        "schema_version": API_PREVIEW_SCHEMA_VERSION,
        "layer": "MEA read-only API / Operator Console visibility",
        "read_only": True,
        "get_routes_only": True,
        "creates_get_routes": True,
        "creates_post_routes": False,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "performs_network_io": False,
        "seeds_live_manifests": False,
        "seals_candidates": False,
        "promotes_to_memory": False,
        "renders_user_output": False,
        "mutates_existing_rmc_behavior": False,
        "mutates_launcher_behavior": False,
        "mutates_operator_console_ui": False,
        "operator_console_visibility": "backend_route_manifest_and_read_only_json_payloads_only",
    }


def operator_console_visibility_manifest() -> Dict[str, Any]:
    """Return the backend-owned route manifest fragment React may inspect."""

    return {
        "patch": API_PREVIEW_PATCH_ID,
        "schema_version": API_PREVIEW_SCHEMA_VERSION,
        "authority": "Forge backend owns these paths; browser UI is only a control surface.",
        "routes": [
            {
                "route_key": route_key,
                "method": "GET",
                "path": path,
                "group": "mea",
                "stage": "read_only_preview",
                "requires_approval": False,
                "approval_token": None,
                "read_only": True,
            }
            for route_key, path in MEA_READ_ONLY_PREVIEW_ROUTES.items()
        ],
        "forbidden_routes": [
            "/api/mea/problem-manifest",
            "/api/mea/candidates",
            "/api/mea/seal",
            "/api/mea/replay",
            "/api/mea/seed",
        ],
        "boundary": api_preview_boundary(),
    }


def _base_payload(endpoint: str) -> Dict[str, Any]:
    return {
        "status": "OK",
        "endpoint": endpoint,
        "mode": API_PREVIEW_MODE,
        "current_patch": API_PREVIEW_PATCH_ID,
        "schema_version": MEA_SCHEMA_VERSION,
        "preview_schema_version": API_PREVIEW_SCHEMA_VERSION,
        "read_only": True,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "creates_post_routes": False,
        "seeds_live_manifests": False,
        "seals_candidates": False,
        "promotes_to_memory": False,
    }


def _fixture():
    return build_144hz_test_manifest()


def _validation_dict(manifest) -> Dict[str, Any]:
    result = validate_manifest(manifest)
    return {"valid": result.valid, "errors": list(result.errors), "warnings": list(result.warnings)}


def _build_144hz_hypothesis_path() -> Dict[str, Any]:
    """Build the deterministic anti-confabulation preview path.

    This path is a read-only replay proof. It does not seal the candidate.
    """

    parent = _fixture()
    operator_calls = [
        {
            "operator_id": "derive",
            "theta_k": {
                "derived_fact": "144 Hz remains hypothesis-bound until direct measurement or a sealed derivation chain exists.",
                "resolves_unknown": "",
                "proof_debt_delta": 0.15,
            },
        }
    ]
    preview = replay_operator_path(parent, operator_calls)
    confirmed = replay_operator_path(parent, operator_calls, expected_final_hash=preview.produced_final_hash)
    candidate = from_dict(confirmed.final_manifest) if confirmed.final_manifest else parent
    classification = classify_claim_status(
        parent,
        candidate,
        replay_result=confirmed,
        proof_debt_score=score_proof_debt(candidate),
        information_gain_score=score_information_gain(parent, candidate),
        convergence_score=score_convergence(parent, candidate),
    )
    return {
        "operator_calls": operator_calls,
        "preview_replay": preview.to_dict(),
        "confirmed_replay": confirmed.to_dict(),
        "candidate_manifest": to_dict(candidate),
        "candidate_hash": canonical_hash(candidate),
        "classification": classification.to_dict(),
        "expected_classification": "hypothesis_not_verified_claim",
        "anti_confabulation_rule": "A replay-confirmed candidate with proof debt remains hypothesis/test-required; replay does not imply verified_claim.",
    }


def build_problem_manifest_preview(raw_path: str = "/api/mea/problem-manifest-preview") -> Dict[str, Any]:
    """Return the canonical 144 Hz seed manifest for inspection only."""

    manifest = _fixture()
    payload = _base_payload(MEA_READ_ONLY_PREVIEW_ROUTES["problem_manifest_preview"])
    payload.update(
        {
            "preview_type": "problem_manifest",
            "source": "canonical_144hz_test_fixture",
            "manifest_hash": canonical_hash(manifest),
            "problem_manifest": to_dict(manifest),
            "validation": _validation_dict(manifest),
            "operator_console_visibility": operator_console_visibility_manifest(),
            "kernel": kernel_identity(),
            "boundary": api_preview_boundary(),
        }
    )
    return payload


def build_unknown_vector_preview(raw_path: str = "/api/mea/unknown-vector-preview") -> Dict[str, Any]:
    """Return the explicit unknown vector for the canonical fixture."""

    manifest = _fixture()
    vector = detect_unknowns(manifest)
    payload = _base_payload(MEA_READ_ONLY_PREVIEW_ROUTES["unknown_vector_preview"])
    payload.update(
        {
            "preview_type": "unknown_vector",
            "source": "canonical_144hz_test_fixture",
            "problem_id": manifest.problem_id,
            "manifest_hash": canonical_hash(manifest),
            "unknown_vector": vector.to_dict(),
            "expected_unknown_count": 2,
            "expected_unverified_gap_count": 1,
            "boundary": api_preview_boundary(),
        }
    )
    return payload


def build_claim_status_preview(raw_path: str = "/api/mea/claim-status-preview") -> Dict[str, Any]:
    """Return read-only claim status previews for recall and 144 Hz hypothesis."""

    parent = _fixture()
    noop_replay = replay_candidate(parent, "noop_recall", {}, expected_candidate_hash=canonical_hash(parent))
    recall = classify_claim_status(
        parent,
        parent,
        replay_result=noop_replay,
        proof_debt_score=score_proof_debt(parent),
        information_gain_score=score_information_gain(parent, parent),
        convergence_score=score_convergence(parent, parent),
    )
    hypothesis_path = _build_144hz_hypothesis_path()
    payload = _base_payload(MEA_READ_ONLY_PREVIEW_ROUTES["claim_status_preview"])
    payload.update(
        {
            "preview_type": "claim_status",
            "classifier_formula": CLAIM_STATUS_CLASSIFIER_FORMULA,
            "taxonomy": claim_status_taxonomy(),
            "self_recall_classification": recall.to_dict(),
            "hypothesis_path_classification": hypothesis_path["classification"],
            "expected_self_classification": ClaimStatus.RECALL.value,
            "expected_144hz_d1_classification": "hypothesis_not_verified_claim",
            "hard_render_laws": {
                "recall_not_discovery": True,
                "hypothesis_not_verified_claim": True,
                "rejected_not_user_visible": True,
            },
            "boundary": api_preview_boundary(),
            "classifier_boundary": classifier_boundary(),
        }
    )
    return payload


def build_replay_preview(raw_path: str = "/api/mea/replay-preview") -> Dict[str, Any]:
    """Return deterministic replay preview and confirmed path reports."""

    parent = _fixture()
    noop = replay_candidate(parent, "noop_recall", {}, expected_candidate_hash=canonical_hash(parent))
    hypothesis_path = _build_144hz_hypothesis_path()
    payload = _base_payload(MEA_READ_ONLY_PREVIEW_ROUTES["replay_preview"])
    payload.update(
        {
            "preview_type": "replay",
            "replay_law_formula": REPLAY_LAW_FORMULA,
            "operator_registry_summary": operator_registry_summary(),
            "noop_replay": noop.to_dict(),
            "hypothesis_path_preview": hypothesis_path,
            "sealing_active": False,
            "sealing_permitted_by_endpoint": False,
            "boundary": api_preview_boundary(),
        }
    )
    return payload


def build_preview_payload(endpoint: str, raw_path: str = "") -> Dict[str, Any]:
    """Route to one Patch 280 preview payload builder."""

    if endpoint == MEA_READ_ONLY_PREVIEW_ROUTES["problem_manifest_preview"]:
        return build_problem_manifest_preview(raw_path)
    if endpoint == MEA_READ_ONLY_PREVIEW_ROUTES["unknown_vector_preview"]:
        return build_unknown_vector_preview(raw_path)
    if endpoint == MEA_READ_ONLY_PREVIEW_ROUTES["claim_status_preview"]:
        return build_claim_status_preview(raw_path)
    if endpoint == MEA_READ_ONLY_PREVIEW_ROUTES["replay_preview"]:
        return build_replay_preview(raw_path)
    return {
        "status": "UNKNOWN_ENDPOINT",
        "endpoint": endpoint,
        "mode": API_PREVIEW_MODE,
        "current_patch": API_PREVIEW_PATCH_ID,
        "known_routes": dict(MEA_READ_ONLY_PREVIEW_ROUTES),
        "read_only": True,
        "writes_files": False,
        "calls_llm": False,
        "boundary": api_preview_boundary(),
    }
