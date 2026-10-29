"""
forge/rmc_engine_v1/mea/seed_manifest_gate.py

Patch 281 — MEA Controlled Seed Manifest Gate.

This module is the first controlled POST-facing MEA gate. It validates a
problem manifest seed request and returns a deterministic gate report, but it
still does not persist live MEA state.

Hard boundary:
- explicit approval token required for POST gate checks
- no file writes
- no memory writes
- no Chroma writes
- no Identity Vault writes
- no shell execution
- no LLM calls
- no network I/O
- no candidate sealing
- no memory promotion
- no renderer authority
"""

from __future__ import annotations

import copy
from dataclasses import dataclass
from typing import Any, Dict, Mapping, Optional, Tuple

from .claim_status_classifier import classify_claim_status
from .convergence_scorer import score_convergence
from .information_gain_scorer import score_information_gain
from .manifest_schema import (
    ClaimStatus,
    OutputPermission,
    ProblemManifest,
    build_144hz_test_manifest,
    canonical_hash,
    from_dict,
    to_dict,
    validate_manifest,
)
from .proof_debt_scorer import score_proof_debt
from .replay_engine import replay_candidate
from .unknown_detector import detect_unknowns

SEED_GATE_PATCH_ID = "Patch 281 — MEA Controlled Seed Manifest Gate"
SEED_GATE_SCHEMA_VERSION = "mea_controlled_seed_manifest_gate_v1_patch281"
SEED_GATE_MODE = "controlled_mea_seed_manifest_gate_patch281"
SEED_GATE_APPROVAL_TOKEN = "APPROVE_MEA_SEED_MANIFEST_GATE"
SEED_GATE_POST_ROUTE = "/api/mea/seed-manifest-gate"
SEED_GATE_STATUS_ROUTE = "/api/mea/seed-manifest-gate/status"
SEED_GATE_ALIAS_ROUTE = "/api/mea/problem-manifest-gate"

_ALLOWED_SEED_STATUSES = {
    ClaimStatus.UNCLASSIFIED.value,
    ClaimStatus.TEST_REQUIRED.value,
    ClaimStatus.HYPOTHESIS.value,
    ClaimStatus.SPECULATIVE_BRANCH.value,
    ClaimStatus.COLD_STORED.value,
}


@dataclass(frozen=True)
class SeedGateResult:
    """Serializable result for a controlled seed-manifest gate check."""

    status: str
    gate_status: str
    accepted: bool
    reason_code: str
    manifest_hash: Optional[str]
    problem_id: Optional[str]
    validation_errors: Tuple[str, ...]
    validation_warnings: Tuple[str, ...]
    gate_errors: Tuple[str, ...]
    gate_warnings: Tuple[str, ...]
    explicit_unknown_count: int
    proof_debt: Optional[float]
    claim_status: Optional[str]
    output_permissions: Optional[str]
    source: str
    manifest: Optional[Dict[str, Any]]
    diagnostic: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "endpoint": SEED_GATE_POST_ROUTE,
            "mode": SEED_GATE_MODE,
            "current_patch": SEED_GATE_PATCH_ID,
            "schema_version": SEED_GATE_SCHEMA_VERSION,
            "gate_status": self.gate_status,
            "accepted": self.accepted,
            "reason_code": self.reason_code,
            "approval_required": True,
            "approval_token_name": "approval_token",
            "expected_approval_token": SEED_GATE_APPROVAL_TOKEN,
            "manifest_hash": self.manifest_hash,
            "problem_id": self.problem_id,
            "validation_errors": list(self.validation_errors),
            "validation_warnings": list(self.validation_warnings),
            "gate_errors": list(self.gate_errors),
            "gate_warnings": list(self.gate_warnings),
            "explicit_unknown_count": self.explicit_unknown_count,
            "proof_debt": self.proof_debt,
            "claim_status": self.claim_status,
            "output_permissions": self.output_permissions,
            "source": self.source,
            "seed_manifest_preview": self.manifest,
            "diagnostic": self.diagnostic,
            "non_mutating": True,
            "read_only": False,
            "writes_files": False,
            "writes_memory": False,
            "writes_chroma": False,
            "writes_identity_vault": False,
            "calls_llm": False,
            "executes_shell": False,
            "performs_network_io": False,
            "creates_post_routes": True,
            "seeds_live_manifests": False,
            "seals_candidates": False,
            "promotes_to_memory": False,
            "renders_user_output": False,
            "boundary": seed_manifest_gate_boundary(),
        }


def seed_manifest_gate_boundary() -> Dict[str, Any]:
    return {
        "patch": SEED_GATE_PATCH_ID,
        "schema_version": SEED_GATE_SCHEMA_VERSION,
        "layer": "MEA controlled seed manifest gate",
        "read_only": False,
        "non_mutating": True,
        "creates_post_routes": True,
        "post_routes": [SEED_GATE_POST_ROUTE, SEED_GATE_ALIAS_ROUTE],
        "get_routes": [SEED_GATE_STATUS_ROUTE],
        "requires_approval_token": True,
        "approval_token": SEED_GATE_APPROVAL_TOKEN,
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
        "real_problem_manifest_post_route": "/api/mea/problem-manifest remains intentionally unavailable in Patch 281",
    }


def seed_manifest_gate_status() -> Dict[str, Any]:
    return {
        "status": "OK",
        "endpoint": SEED_GATE_STATUS_ROUTE,
        "mode": SEED_GATE_MODE,
        "current_patch": SEED_GATE_PATCH_ID,
        "schema_version": SEED_GATE_SCHEMA_VERSION,
        "gate_visible": True,
        "post_route": SEED_GATE_POST_ROUTE,
        "alias_route": SEED_GATE_ALIAS_ROUTE,
        "approval_required": True,
        "approval_token": SEED_GATE_APPROVAL_TOKEN,
        "live_seed_commit_active": False,
        "candidate_sealing_active": False,
        "memory_promotion_active": False,
        "canonical_fixture_allowed": True,
        "custom_manifest_allowed": True,
        "boundary": seed_manifest_gate_boundary(),
    }


def _empty_rejection(reason_code: str, errors: Tuple[str, ...], source: str = "request") -> SeedGateResult:
    return SeedGateResult(
        status="REJECTED",
        gate_status="REJECTED",
        accepted=False,
        reason_code=reason_code,
        manifest_hash=None,
        problem_id=None,
        validation_errors=(),
        validation_warnings=(),
        gate_errors=errors,
        gate_warnings=(),
        explicit_unknown_count=0,
        proof_debt=None,
        claim_status=None,
        output_permissions=None,
        source=source,
        manifest=None,
        diagnostic={},
    )


def _normalise_request(request: Optional[Mapping[str, Any]]) -> Mapping[str, Any]:
    if request is None:
        return {}
    if not isinstance(request, Mapping):
        return {}
    return request


def _manifest_from_request(request: Mapping[str, Any]) -> Tuple[Optional[ProblemManifest], str, Tuple[str, ...]]:
    use_fixture = bool(request.get("use_fixture") or request.get("canonical_144hz_fixture"))
    source = str(request.get("source") or "request_manifest")
    raw_manifest = request.get("manifest") or request.get("problem_manifest")

    if use_fixture:
        return build_144hz_test_manifest(), "canonical_144hz_test_fixture", ()
    if raw_manifest is None:
        return None, source, ("missing manifest: provide manifest/problem_manifest or use_fixture=true",)
    if not isinstance(raw_manifest, Mapping):
        return None, source, ("manifest must be a JSON object",)
    try:
        manifest = from_dict(dict(raw_manifest))
    except Exception as exc:
        return None, source, (f"manifest parse failed: {str(exc)[:180]}",)
    return manifest, source, ()


def _hard_gate_manifest(manifest: ProblemManifest) -> Tuple[Tuple[str, ...], Tuple[str, ...]]:
    errors = []
    warnings = []
    vector = detect_unknowns(manifest)

    if vector.unknown_count < 1:
        errors.append("seed manifest must include at least one explicit unknown")
    if not manifest.goal_ancestry:
        warnings.append("goal_ancestry was empty; downstream lineage scoring will degrade")
    if manifest.claim_status == ClaimStatus.VERIFIED_CLAIM.value:
        errors.append("seed manifest cannot enter as verified_claim")
    if manifest.claim_status not in _ALLOWED_SEED_STATUSES:
        errors.append(f"seed claim_status {manifest.claim_status!r} is not allowed for Patch 281")
    if manifest.output_permissions != OutputPermission.SEALED.value:
        errors.append("seed manifest output_permissions must remain sealed")
    if manifest.proof_debt < 0.0 or manifest.proof_debt > 1.0:
        errors.append("proof_debt must stay in [0.0, 1.0]")
    if manifest.drift_state.total > 0.35:
        errors.append("seed manifest drift_state exceeds Patch 281 drift gate threshold")
    if manifest.proof_debt >= 0.70:
        warnings.append("seed manifest has high proof debt; verified_claim promotion remains blocked")

    return tuple(errors), tuple(warnings)


def evaluate_seed_manifest_request(request: Optional[Mapping[str, Any]]) -> Dict[str, Any]:
    """Validate a controlled seed request without persisting it."""

    req = _normalise_request(request)
    supplied_token = str(req.get("approval_token") or req.get("approval") or "")
    if supplied_token != SEED_GATE_APPROVAL_TOKEN:
        return _empty_rejection(
            "approval_token_required",
            ("missing or invalid approval_token for controlled MEA seed gate",),
        ).to_dict()

    manifest, source, parse_errors = _manifest_from_request(req)
    if manifest is None:
        return _empty_rejection("manifest_unavailable", parse_errors, source=source).to_dict()

    validation = validate_manifest(manifest)
    vector = detect_unknowns(manifest)
    gate_errors, gate_warnings = _hard_gate_manifest(manifest)
    accepted = validation.valid and not gate_errors
    manifest_hash = canonical_hash(manifest)

    proof = score_proof_debt(manifest)
    noop = replay_candidate(manifest, "noop_recall", {}, expected_candidate_hash=manifest_hash)
    info = score_information_gain(manifest, manifest)
    conv = score_convergence(manifest, manifest)
    classification = classify_claim_status(
        manifest,
        manifest,
        replay_result=noop,
        proof_debt_score=proof,
        information_gain_score=info,
        convergence_score=conv,
    )

    if accepted:
        gate_status = "ACCEPTED_PREVIEW_ONLY"
        reason_code = "validated_non_mutating_seed_gate"
        status = "OK"
    else:
        gate_status = "REJECTED"
        reason_code = "manifest_failed_seed_gate"
        status = "REJECTED"

    diagnostic = {
        "manifest_hash": manifest_hash,
        "validation": {"valid": validation.valid, "errors": list(validation.errors), "warnings": list(validation.warnings)},
        "unknown_vector": vector.to_dict(),
        "proof_debt_score": proof.to_dict(),
        "noop_replay": noop.to_dict(),
        "self_information_gain": info.to_dict(),
        "self_convergence": conv.to_dict(),
        "self_claim_status_classification": classification.to_dict(),
        "live_seed_commit_active": False,
        "candidate_sealing_active": False,
        "memory_promotion_active": False,
    }

    return SeedGateResult(
        status=status,
        gate_status=gate_status,
        accepted=accepted,
        reason_code=reason_code,
        manifest_hash=manifest_hash,
        problem_id=manifest.problem_id,
        validation_errors=tuple(validation.errors),
        validation_warnings=tuple(validation.warnings),
        gate_errors=tuple(gate_errors),
        gate_warnings=tuple(gate_warnings),
        explicit_unknown_count=vector.unknown_count,
        proof_debt=manifest.proof_debt,
        claim_status=manifest.claim_status,
        output_permissions=manifest.output_permissions,
        source=source,
        manifest=to_dict(manifest),
        diagnostic=diagnostic,
    ).to_dict()


def build_seed_manifest_gate_preview() -> Dict[str, Any]:
    """Return a deterministic approved fixture gate report for GET/status previews."""

    return evaluate_seed_manifest_request(
        {
            "approval_token": SEED_GATE_APPROVAL_TOKEN,
            "use_fixture": True,
            "source": "canonical_144hz_test_fixture",
        }
    )


def build_seed_manifest_gate_rejection_preview() -> Dict[str, Any]:
    """Return deterministic rejection proof for missing approval."""

    return evaluate_seed_manifest_request({"use_fixture": True})


def clone_manifest_for_test(manifest: ProblemManifest) -> Dict[str, Any]:
    """Return a copy of a manifest dict for tests without exposing dataclass internals."""

    return copy.deepcopy(to_dict(manifest))
