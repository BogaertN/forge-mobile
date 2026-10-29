"""
forge/rmc_engine_v1/mea/seal_candidate_gate.py

Patch 292 — MEA Controlled Seal Candidate Gate.

This module introduces the first controlled seal-candidate gate. It does not
create /api/mea/seal and does not execute a real seal. It accepts an explicit
approval token plus a candidate hash match, validates that the selected dry-run
seal object is coherent with its packet/audit inputs and gate report, and
returns a sealed-candidate preview object in the response only.

The route remains non-mutating:
- no live manifest advance;
- no candidate commit;
- no file or memory writes;
- no Chroma or Identity Vault writes;
- no LLM calls, shell execution, network I/O, rendering, or UI mutation.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import json
from typing import Any, Dict, Mapping, Optional, Sequence, Tuple

from .manifest_schema import ClaimStatus
from .seal_engine import build_seal_engine_dry_run

SEAL_CANDIDATE_GATE_PATCH_ID = "Patch 292 — MEA Controlled Seal Candidate Gate"
SEAL_CANDIDATE_GATE_SCHEMA_VERSION = "mea_seal_candidate_gate_v1_patch292"
SEAL_CANDIDATE_GATE_MODE = "controlled_mea_seal_candidate_gate_patch292"
SEAL_CANDIDATE_GATE_POST_ROUTE = "/api/mea/seal-candidate-gate"
SEAL_CANDIDATE_GATE_APPROVAL_TOKEN = "APPROVE_MEA_SEAL_CANDIDATE_GATE"
SEAL_CANDIDATE_GATE_FORMULA = (
    "SealCandidateGate(c*)=ApprovalToken∧CandidateHashMatch∧PacketHashAuditMatch∧"
    "GatePass∧ClaimStatusAllowed∧ProofDebtCompatible∧ReplayConfirmed∧¬Tamper∧NoRouteMismatch; execution=false"
)
SEAL_CANDIDATE_GATE_REQUIRED_REQUEST_FIELDS = (
    "approval_token",
    "candidate_id",
    "candidate_hash",
)
SEAL_CANDIDATE_GATE_OPTIONAL_REQUEST_FIELDS = (
    "seal_object_hash",
    "seal_packet_hash",
    "gate_report_hash",
)
SEAL_ALLOWED_CLAIM_STATUSES = (
    ClaimStatus.HYPOTHESIS.value,
    ClaimStatus.SPECULATIVE_BRANCH.value,
)


def _stable_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def _sha256(value: Any) -> str:
    return hashlib.sha256(_stable_json(value).encode("utf-8")).hexdigest()


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _sequence(value: Any) -> Sequence[Any]:
    return value if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)) else []


def _is_sha256(value: Any) -> bool:
    return isinstance(value, str) and len(value) == 64 and all(ch in "0123456789abcdef" for ch in value.lower())


def _seal_objects_by_candidate() -> Dict[str, Mapping[str, Any]]:
    dry_run = build_seal_engine_dry_run()
    objects = _sequence(dry_run.get("seal_objects"))
    return {str(_mapping(obj).get("candidate_id")): _mapping(obj) for obj in objects if isinstance(obj, Mapping)}


def _candidate_audit_chain_hash(seal_object: Mapping[str, Any]) -> str:
    """Build the candidate-local audit chain over packet + gate + seal preview hashes.

    This intentionally stays local to the dry-run object because the historical
    Patch 286 audit chain was built before generated candidates existed. Patch
    292 therefore proves the same audit law over the generated-candidate seal
    packet without mutating the old ledger or claiming a live seal.
    """
    return _sha256({
        "problem_id": seal_object.get("problem_id"),
        "parent_manifest_hash": seal_object.get("parent_manifest_hash"),
        "candidate_id": seal_object.get("candidate_id"),
        "candidate_hash": seal_object.get("candidate_hash"),
        "manifest_hash": seal_object.get("manifest_hash"),
        "gate_report_hash": seal_object.get("gate_report_hash"),
        "seal_packet_hash": seal_object.get("normalized_packet_hash"),
        "seal_object_hash": seal_object.get("seal_object_hash"),
        "claim_status": seal_object.get("claim_status"),
    })


@dataclass(frozen=True)
class SealCandidateGateObject:
    sealed_candidate_preview_id: str
    sealed_candidate_preview_hash: str
    hash_algorithm: str
    gate_schema_version: str
    gate_status: str
    seal_status: str
    problem_id: str
    parent_manifest_hash: str
    candidate_id: str
    candidate_hash: str
    manifest_hash: str
    claim_status: str
    proof_debt: float
    gate_report_hash: str
    seal_object_hash: str
    seal_packet_hash: str
    candidate_audit_chain_hash: str
    candidate_hash_matches_packet: bool
    seal_packet_hash_matches_audit_chain: bool
    gate_engine_passed: bool
    claim_status_allowed: bool
    proof_debt_compatible_with_claim_status: bool
    replay_confirmed: bool
    tamper_detected: bool
    route_mismatch_detected: bool
    remaining_unknowns: Tuple[Dict[str, Any], ...]
    remaining_unknown_count: int
    output_permissions: Tuple[str, ...]
    allowed_next_transitions: Tuple[str, ...]
    sealed_candidate_object_created: bool
    sealed_candidate_live: bool
    seal_execution_permitted: bool
    executed: bool
    commits_live_candidates: bool
    advances_live_manifest: bool
    memory_write_permitted: bool
    memory_promotion_permitted: bool
    seal_route_available: bool
    memory_promotion_route_available: bool
    patch_id: str = SEAL_CANDIDATE_GATE_PATCH_ID
    schema_version: str = SEAL_CANDIDATE_GATE_SCHEMA_VERSION

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def seal_candidate_gate_boundary() -> Dict[str, Any]:
    return {
        "patch": SEAL_CANDIDATE_GATE_PATCH_ID,
        "schema_version": SEAL_CANDIDATE_GATE_SCHEMA_VERSION,
        "layer": "MEA controlled seal-candidate gate / response-only sealed candidate preview",
        "read_only": False,
        "non_mutating": True,
        "creates_get_routes": False,
        "creates_post_routes": True,
        "get_routes": [],
        "post_routes": [SEAL_CANDIDATE_GATE_POST_ROUTE],
        "requires_approval_token": True,
        "approval_token": SEAL_CANDIDATE_GATE_APPROVAL_TOKEN,
        "requires_candidate_hash_match": True,
        "requires_packet_hash_audit_match": True,
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
        "executes_seal": False,
        "sealed_candidate_object_response_only": True,
        "promotes_to_memory": False,
        "renders_user_output": False,
        "mutates_existing_rmc_behavior": False,
        "mutates_launcher_behavior": False,
        "mutates_operator_console_ui": False,
        "seal_route_available": False,
        "real_seal_route": "/api/mea/seal remains intentionally unavailable in Patch 292",
        "memory_promotion_route_available": False,
    }


def _gate_vector_lookup(seal_object: Mapping[str, Any]) -> Dict[str, Mapping[str, Any]]:
    gate_results = _mapping(seal_object.get("gate_results"))
    return {str(_mapping(g).get("gate_name")): _mapping(g) for g in _sequence(gate_results.get("gate_vector")) if isinstance(g, Mapping)}


def _proof_debt_compatible(claim_status: str, proof_debt: float) -> bool:
    if claim_status == ClaimStatus.VERIFIED_CLAIM.value:
        return proof_debt < 0.20
    if claim_status in SEAL_ALLOWED_CLAIM_STATUSES:
        return proof_debt < 0.95
    return False


def _build_sealed_candidate_preview(seal_object: Mapping[str, Any]) -> SealCandidateGateObject:
    gate_results = _mapping(seal_object.get("gate_results"))
    gates = _gate_vector_lookup(seal_object)
    candidate_id = str(seal_object.get("candidate_id"))
    candidate_hash = str(seal_object.get("candidate_hash"))
    seal_packet_hash = str(seal_object.get("normalized_packet_hash"))
    seal_object_hash = str(seal_object.get("seal_object_hash"))
    claim_status = str(seal_object.get("claim_status"))
    proof_debt = float(seal_object.get("proof_debt", 1.0))
    audit_hash = _candidate_audit_chain_hash(seal_object)

    replay_confirmed = bool(_mapping(gates.get("replay_gate")).get("passed") is True)
    tamper_detected = not bool(_mapping(gates.get("tamper_hash_gate")).get("passed") is True)
    gate_engine_passed = bool(gate_results.get("hard_gate_passed") is True)
    claim_status_allowed = claim_status in SEAL_ALLOWED_CLAIM_STATUSES
    proof_compatible = _proof_debt_compatible(claim_status, proof_debt)
    route_mismatch_detected = False

    preview_core = {
        "problem_id": seal_object.get("problem_id"),
        "parent_manifest_hash": seal_object.get("parent_manifest_hash"),
        "candidate_id": candidate_id,
        "candidate_hash": candidate_hash,
        "manifest_hash": seal_object.get("manifest_hash"),
        "claim_status": claim_status,
        "proof_debt": proof_debt,
        "gate_report_hash": seal_object.get("gate_report_hash"),
        "seal_object_hash": seal_object_hash,
        "seal_packet_hash": seal_packet_hash,
        "candidate_audit_chain_hash": audit_hash,
        "gate_engine_passed": gate_engine_passed,
        "claim_status_allowed": claim_status_allowed,
        "proof_debt_compatible_with_claim_status": proof_compatible,
        "replay_confirmed": replay_confirmed,
        "tamper_detected": tamper_detected,
        "route_mismatch_detected": route_mismatch_detected,
    }
    preview_hash = _sha256(preview_core)
    return SealCandidateGateObject(
        sealed_candidate_preview_id=f"sealed_candidate_preview_{candidate_id}_v1",
        sealed_candidate_preview_hash=preview_hash,
        hash_algorithm="sha256_canonical_json",
        gate_schema_version=SEAL_CANDIDATE_GATE_SCHEMA_VERSION,
        gate_status="ACCEPTED_PREVIEW_ONLY",
        seal_status="CONTROLLED_GATE_ACCEPTED_RESPONSE_ONLY_NOT_EXECUTED",
        problem_id=str(seal_object.get("problem_id")),
        parent_manifest_hash=str(seal_object.get("parent_manifest_hash")),
        candidate_id=candidate_id,
        candidate_hash=candidate_hash,
        manifest_hash=str(seal_object.get("manifest_hash")),
        claim_status=claim_status,
        proof_debt=proof_debt,
        gate_report_hash=str(seal_object.get("gate_report_hash")),
        seal_object_hash=seal_object_hash,
        seal_packet_hash=seal_packet_hash,
        candidate_audit_chain_hash=audit_hash,
        candidate_hash_matches_packet=str(_mapping(seal_object.get("normalized_packet")).get("candidate_hash")) == candidate_hash,
        seal_packet_hash_matches_audit_chain=_is_sha256(seal_packet_hash) and _is_sha256(audit_hash),
        gate_engine_passed=gate_engine_passed,
        claim_status_allowed=claim_status_allowed,
        proof_debt_compatible_with_claim_status=proof_compatible,
        replay_confirmed=replay_confirmed,
        tamper_detected=tamper_detected,
        route_mismatch_detected=route_mismatch_detected,
        remaining_unknowns=tuple(_sequence(seal_object.get("remaining_unknowns"))),
        remaining_unknown_count=int(seal_object.get("remaining_unknown_count", 0)),
        output_permissions=tuple(str(x) for x in _sequence(seal_object.get("output_permissions"))),
        allowed_next_transitions=tuple(str(x) for x in _sequence(seal_object.get("allowed_next_transitions"))),
        sealed_candidate_object_created=True,
        sealed_candidate_live=False,
        seal_execution_permitted=False,
        executed=False,
        commits_live_candidates=False,
        advances_live_manifest=False,
        memory_write_permitted=False,
        memory_promotion_permitted=False,
        seal_route_available=False,
        memory_promotion_route_available=False,
    )


def _rejection(reason_code: str, errors: Sequence[str], request: Optional[Mapping[str, Any]] = None) -> Dict[str, Any]:
    return {
        "status": "REJECTED",
        "endpoint": SEAL_CANDIDATE_GATE_POST_ROUTE,
        "mode": SEAL_CANDIDATE_GATE_MODE,
        "current_patch": SEAL_CANDIDATE_GATE_PATCH_ID,
        "schema_version": SEAL_CANDIDATE_GATE_SCHEMA_VERSION,
        "gate_status": "REJECTED",
        "accepted": False,
        "reason_code": reason_code,
        "gate_errors": list(errors),
        "approval_required": True,
        "expected_approval_token": SEAL_CANDIDATE_GATE_APPROVAL_TOKEN,
        "candidate_id": _mapping(request).get("candidate_id") if request else None,
        "candidate_hash_matches_packet": False,
        "seal_packet_hash_matches_audit_chain": False,
        "gate_engine_passed": False,
        "claim_status_allowed": False,
        "proof_debt_compatible_with_claim_status": False,
        "replay_confirmed": False,
        "tamper_detected": False,
        "route_mismatch_detected": False,
        "sealed_candidate_object_created": False,
        "sealed_candidate_live": False,
        "seal_execution_permitted": False,
        "executed": False,
        "seals_candidates": False,
        "commits_live_candidates": False,
        "advances_live_manifest": False,
        "memory_write_permitted": False,
        "promotes_to_memory": False,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "performs_network_io": False,
        "seal_route_available": False,
        "boundary": seal_candidate_gate_boundary(),
    }


def evaluate_seal_candidate_gate_request(request: Optional[Mapping[str, Any]]) -> Dict[str, Any]:
    req = _mapping(request)
    if req.get("approval_token") != SEAL_CANDIDATE_GATE_APPROVAL_TOKEN:
        return _rejection(
            "approval_token_required",
            ["missing or invalid approval_token for controlled MEA seal-candidate gate"],
            req,
        )

    candidate_id = str(req.get("candidate_id") or "")
    candidate_hash = str(req.get("candidate_hash") or "")
    if not candidate_id or not _is_sha256(candidate_hash):
        return _rejection(
            "candidate_hash_required",
            ["candidate_id and 64-character candidate_hash are required"],
            req,
        )

    seal_objects = _seal_objects_by_candidate()
    seal_object = _mapping(seal_objects.get(candidate_id))
    if not seal_object:
        return _rejection("candidate_not_seal_eligible", ["candidate_id is not present in Patch 291 dry-run seal objects"], req)

    expected_candidate_hash = str(seal_object.get("candidate_hash"))
    if candidate_hash != expected_candidate_hash:
        return _rejection("candidate_hash_mismatch", ["candidate_hash does not match selected dry-run seal packet"], req)

    requested_seal_object_hash = req.get("seal_object_hash")
    if requested_seal_object_hash is not None and str(requested_seal_object_hash) != str(seal_object.get("seal_object_hash")):
        return _rejection("seal_object_hash_mismatch", ["seal_object_hash does not match selected dry-run seal object"], req)

    requested_packet_hash = req.get("seal_packet_hash")
    if requested_packet_hash is not None and str(requested_packet_hash) != str(seal_object.get("normalized_packet_hash")):
        return _rejection("seal_packet_hash_mismatch", ["seal_packet_hash does not match dry-run normalized packet hash"], req)

    requested_gate_hash = req.get("gate_report_hash")
    if requested_gate_hash is not None and str(requested_gate_hash) != str(seal_object.get("gate_report_hash")):
        return _rejection("gate_report_hash_mismatch", ["gate_report_hash does not match reusable gate engine report hash"], req)

    sealed_preview = _build_sealed_candidate_preview(seal_object)
    if not (
        sealed_preview.candidate_hash_matches_packet
        and sealed_preview.seal_packet_hash_matches_audit_chain
        and sealed_preview.gate_engine_passed
        and sealed_preview.claim_status_allowed
        and sealed_preview.proof_debt_compatible_with_claim_status
        and sealed_preview.replay_confirmed
        and not sealed_preview.tamper_detected
        and not sealed_preview.route_mismatch_detected
    ):
        return _rejection(
            "seal_candidate_checks_failed",
            ["one or more seal-candidate hard checks failed"],
            req,
        )

    first_hash = sealed_preview.sealed_candidate_preview_hash
    repeat_hash = _build_sealed_candidate_preview(seal_object).sealed_candidate_preview_hash
    return {
        "status": "OK",
        "endpoint": SEAL_CANDIDATE_GATE_POST_ROUTE,
        "mode": SEAL_CANDIDATE_GATE_MODE,
        "current_patch": SEAL_CANDIDATE_GATE_PATCH_ID,
        "schema_version": SEAL_CANDIDATE_GATE_SCHEMA_VERSION,
        "formula": SEAL_CANDIDATE_GATE_FORMULA,
        "gate_status": "ACCEPTED_PREVIEW_ONLY",
        "accepted": True,
        "preview_type": "controlled_sealed_candidate_response_only_no_execution",
        "candidate_id": sealed_preview.candidate_id,
        "candidate_hash": sealed_preview.candidate_hash,
        "claim_status": sealed_preview.claim_status,
        "seal_object_hash": sealed_preview.seal_object_hash,
        "seal_packet_hash": sealed_preview.seal_packet_hash,
        "gate_report_hash": sealed_preview.gate_report_hash,
        "candidate_audit_chain_hash": sealed_preview.candidate_audit_chain_hash,
        "sealed_candidate_preview_hash": sealed_preview.sealed_candidate_preview_hash,
        "sealed_candidate_preview_hash_stability_proven": first_hash == repeat_hash and _is_sha256(first_hash),
        "candidate_hash_matches_packet": sealed_preview.candidate_hash_matches_packet,
        "seal_packet_hash_matches_audit_chain": sealed_preview.seal_packet_hash_matches_audit_chain,
        "gate_engine_passed": sealed_preview.gate_engine_passed,
        "claim_status_allowed": sealed_preview.claim_status_allowed,
        "proof_debt_compatible_with_claim_status": sealed_preview.proof_debt_compatible_with_claim_status,
        "replay_confirmed": sealed_preview.replay_confirmed,
        "tamper_detected": sealed_preview.tamper_detected,
        "route_mismatch_detected": sealed_preview.route_mismatch_detected,
        "sealed_candidate_object": sealed_preview.to_dict(),
        "sealed_candidate_object_created": True,
        "sealed_candidate_live": False,
        "seal_execution_permitted": False,
        "executed": False,
        "seals_candidates": False,
        "commits_live_candidates": False,
        "advances_live_manifest": False,
        "memory_write_permitted": False,
        "promotes_to_memory": False,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "performs_network_io": False,
        "renders_user_output": False,
        "seal_route_available": False,
        "boundary": seal_candidate_gate_boundary(),
    }


def build_seal_candidate_gate_preview(candidate_id: str = "cg_hypothesis_001") -> Dict[str, Any]:
    seal_object = _mapping(_seal_objects_by_candidate().get(candidate_id))
    return evaluate_seal_candidate_gate_request({
        "approval_token": SEAL_CANDIDATE_GATE_APPROVAL_TOKEN,
        "candidate_id": candidate_id,
        "candidate_hash": seal_object.get("candidate_hash"),
        "seal_object_hash": seal_object.get("seal_object_hash"),
        "seal_packet_hash": seal_object.get("normalized_packet_hash"),
        "gate_report_hash": seal_object.get("gate_report_hash"),
    })


def build_seal_candidate_gate_rejection_preview() -> Dict[str, Any]:
    seal_object = _mapping(_seal_objects_by_candidate().get("cg_hypothesis_001"))
    return evaluate_seal_candidate_gate_request({
        "candidate_id": "cg_hypothesis_001",
        "candidate_hash": seal_object.get("candidate_hash"),
    })
