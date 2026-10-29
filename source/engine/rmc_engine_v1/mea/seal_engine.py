"""
forge/rmc_engine_v1/mea/seal_engine.py

Patch 291 — MEA Seal Engine Dry-Run.

This module introduces the MEA seal engine as a deterministic dry-run compiler
only. It extends the RMC Algorithm 4 manifest-compilation shape by assembling a
future seal object with manifest hash, gate results, proof debt, claim status,
remaining unknowns, output permissions, and allowed next transitions.

It does not create /api/mea/seal. It does not execute a seal, advance live
state, commit candidates, write files, write memory, write Chroma, touch
Identity Vault, call an LLM, execute shell commands, perform network I/O,
promote memory, render user output, or mutate UI/launcher behavior.

Core law:
    This module can compile the seal object shape.
    This module cannot execute the seal.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import json
from typing import Any, Dict, Mapping, Optional, Sequence, Tuple

from .candidate_generator import build_candidate_generator_preview
from .gate_engine import build_gate_engine_preview
from .manifest_schema import ClaimStatus, OutputPermission, build_144hz_test_manifest, canonical_hash

SEAL_ENGINE_PATCH_ID = "Patch 291 — MEA Seal Engine Dry-Run"
SEAL_ENGINE_SCHEMA_VERSION = "mea_seal_engine_dry_run_v1_patch291"
SEAL_ENGINE_MODE = "controlled_mea_seal_engine_dry_run_patch291"
SEAL_ENGINE_STATUS_ROUTE = "/api/mea/seal-engine/status"
SEAL_ENGINE_DRY_RUN_ROUTE = "/api/mea/seal-engine-dry-run"
SEAL_ENGINE_FORMULA = (
    "SealDryRun(c*)=C_compile(c*,T_t)+H(c*)+GateResults+ClaimStatus+RemainingUnknowns+OutputPermissions; execution=false"
)
SEAL_ENGINE_ALGORITHM_REFERENCE = "RMC Algorithm 4 / mu_t = C_compile(c*, T_t) extended for MEA dry-run seal shape"

SEAL_OBJECT_REQUIRED_FIELDS = (
    "seal_object_id",
    "seal_object_hash",
    "problem_id",
    "parent_manifest_hash",
    "candidate_id",
    "candidate_hash",
    "manifest_hash",
    "claim_status",
    "gate_results",
    "gate_report_hash",
    "proof_debt",
    "remaining_unknowns",
    "remaining_unknown_count",
    "output_permissions",
    "allowed_next_transitions",
    "seal_execution_permitted",
    "sealed_candidate",
    "live_manifest_advance_permitted",
    "memory_write_permitted",
)


def _stable_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def _sha256(value: Any) -> str:
    return hashlib.sha256(_stable_json(value).encode("utf-8")).hexdigest()


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _sequence(value: Any) -> Sequence[Any]:
    return value if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)) else []


def _candidate_lookup() -> Dict[str, Mapping[str, Any]]:
    preview = build_candidate_generator_preview()
    candidates = _sequence(preview.get("candidates"))
    return {str(_mapping(c).get("candidate_id")): _mapping(c) for c in candidates if isinstance(c, Mapping)}


def _proof_debt_from_candidate(candidate: Mapping[str, Any]) -> float:
    score_bundle = _mapping(candidate.get("score_bundle"))
    proof = _mapping(score_bundle.get("proof_debt"))
    try:
        return round(float(proof.get("proof_debt", candidate.get("proof_debt", 1.0))), 6)
    except Exception:
        return 1.0


def _remaining_unknowns_for(candidate: Mapping[str, Any]) -> Tuple[Dict[str, Any], ...]:
    """Return unresolved unknowns that must remain visible in the dry-run seal object."""
    manifest = build_144hz_test_manifest()
    original_unknowns = tuple(str(u) for u in getattr(manifest, "unknowns", ()) or ())
    status = str(candidate.get("claim_status", ""))
    operator_id = str(candidate.get("operator_id", ""))

    remaining = []
    for idx, text in enumerate(original_unknowns, start=1):
        gap_type = "unverified"
        if "measurement" in text.lower():
            gap_type = "missing_empirical_measurement"
        elif "derived harmonic" in text.lower() or "substrate" in text.lower():
            gap_type = "unresolved_substrate_or_harmonic_status"
        remaining.append({
            "unknown_id": f"u{idx}",
            "description": text,
            "gap_type": gap_type,
            "resolved_by_candidate": False,
        })

    if status in {ClaimStatus.HYPOTHESIS.value, ClaimStatus.SPECULATIVE_BRANCH.value} and operator_id in {"hypothesize", "branch"}:
        remaining.append({
            "unknown_id": "u_derived_status",
            "description": "Harmonic derivation path is opened but not sealed as empirical measurement.",
            "gap_type": "test_required",
            "resolved_by_candidate": False,
        })
    return tuple(remaining)


def _allowed_next_transitions(candidate: Mapping[str, Any], gate_report: Mapping[str, Any]) -> Tuple[str, ...]:
    status = str(candidate.get("claim_status", ""))
    if gate_report.get("decision") == "PASS_BOUNDED_PREVIEW_ONLY":
        return (
            "seal_candidate_gate_preview_only",
            "request_empirical_evidence",
            "route_to_test_required_manifest",
            "keep_memory_promotion_blocked",
        )
    if status == ClaimStatus.HYPOTHESIS.value:
        return (
            "seal_candidate_gate_preview_only",
            "request_evidence_or_derivation_chain",
            "promote_only_after_real_seal_and_echo_validation",
            "keep_memory_promotion_blocked",
        )
    return (
        "reference_or_containment_only",
        "do_not_seal_in_patch291",
        "keep_memory_promotion_blocked",
    )


def seal_engine_boundary() -> Dict[str, Any]:
    return {
        "patch": SEAL_ENGINE_PATCH_ID,
        "schema_version": SEAL_ENGINE_SCHEMA_VERSION,
        "layer": "MEA seal engine dry-run / RMC Algorithm 4 extension preview",
        "read_only": False,
        "non_mutating": True,
        "creates_get_routes": True,
        "creates_post_routes": False,
        "get_routes": [SEAL_ENGINE_STATUS_ROUTE, SEAL_ENGINE_DRY_RUN_ROUTE],
        "post_routes": [],
        "requires_approval_token": False,
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
        "promotes_to_memory": False,
        "renders_user_output": False,
        "mutates_existing_rmc_behavior": False,
        "mutates_launcher_behavior": False,
        "mutates_operator_console_ui": False,
        "seal_route_available": False,
        "memory_promotion_route_available": False,
        "real_seal_route": "/api/mea/seal remains intentionally unavailable in Patch 291",
        "real_memory_promotion_route": "not available in Patch 291",
        "dry_run_only": True,
    }


def seal_engine_status(endpoint: str = SEAL_ENGINE_STATUS_ROUTE) -> Dict[str, Any]:
    return {
        "status": "OK",
        "endpoint": endpoint,
        "mode": SEAL_ENGINE_MODE,
        "current_patch": SEAL_ENGINE_PATCH_ID,
        "schema_version": SEAL_ENGINE_SCHEMA_VERSION,
        "formula": SEAL_ENGINE_FORMULA,
        "algorithm_reference": SEAL_ENGINE_ALGORITHM_REFERENCE,
        "seal_engine_visible": True,
        "dry_run_route": SEAL_ENGINE_DRY_RUN_ROUTE,
        "required_seal_object_fields": list(SEAL_OBJECT_REQUIRED_FIELDS),
        "seal_execution_permitted": False,
        "seal_route_available": False,
        "candidate_sealing_active": False,
        "live_candidate_commit_active": False,
        "live_manifest_advance_active": False,
        "memory_write_active": False,
        "memory_promotion_active": False,
        "boundary": seal_engine_boundary(),
    }


@dataclass(frozen=True)
class SealDryRunObject:
    seal_object_id: str
    seal_object_hash: str
    seal_hash_algorithm: str
    seal_schema_version: str
    seal_kind: str
    seal_status: str
    problem_id: str
    parent_manifest_hash: str
    candidate_id: str
    candidate_hash: str
    manifest_hash: str
    claim_status: str
    gate_results: Dict[str, Any]
    gate_report_hash: str
    proof_debt: float
    remaining_unknowns: Tuple[Dict[str, Any], ...]
    remaining_unknown_count: int
    output_permissions: Tuple[str, ...]
    allowed_next_transitions: Tuple[str, ...]
    normalized_packet: Dict[str, Any]
    normalized_packet_hash: str
    rmc_algorithm_reference: str
    seal_execution_permitted: bool
    executed: bool
    sealed_candidate: bool
    live_candidate_commit_permitted: bool
    live_manifest_advance_permitted: bool
    memory_write_permitted: bool
    memory_promotion_permitted: bool
    seal_route_available: bool
    memory_promotion_route_available: bool
    patch_id: str = SEAL_ENGINE_PATCH_ID
    schema_version: str = SEAL_ENGINE_SCHEMA_VERSION

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _build_normalized_packet(candidate: Mapping[str, Any], gate_report: Mapping[str, Any]) -> Dict[str, Any]:
    candidate_id = str(candidate.get("candidate_id"))
    claim_status = str(candidate.get("claim_status"))
    parent_hash = str(candidate.get("parent_hash"))
    candidate_hash = str(candidate.get("candidate_hash"))
    proof_debt = _proof_debt_from_candidate(candidate)
    remaining_unknowns = _remaining_unknowns_for(candidate)
    output_permissions = tuple(dict.fromkeys([
        str(candidate.get("render_permission") or gate_report.get("render_permission") or OutputPermission.PROJECTION_ONLY.value),
        "sealed_output_blocked_in_patch291",
        "memory_write_blocked_in_patch291",
    ]))
    allowed_next_transitions = _allowed_next_transitions(candidate, gate_report)
    packet_body = {
        "packet_id": f"seal_dry_run_packet_{candidate_id}_v1",
        "packet_schema_version": SEAL_ENGINE_SCHEMA_VERSION,
        "packet_kind": "mea_future_seal_packet_dry_run",
        "problem_id": "144hz_substrate_status",
        "parent_manifest_hash": parent_hash,
        "candidate_id": candidate_id,
        "candidate_hash": candidate_hash,
        "manifest_hash": candidate_hash,
        "claim_status": claim_status,
        "gate_results": gate_report,
        "gate_report_hash": gate_report.get("gate_report_hash"),
        "proof_debt": proof_debt,
        "remaining_unknowns": remaining_unknowns,
        "remaining_unknown_count": len(remaining_unknowns),
        "output_permissions": output_permissions,
        "allowed_next_transitions": allowed_next_transitions,
        "seal_execution_permitted": False,
        "memory_promotion_permitted": False,
        "seal_route_available": False,
    }
    packet_body["packet_hash"] = _sha256({k: v for k, v in packet_body.items() if k != "packet_hash"})
    return packet_body


def _seal_object_from_candidate(candidate: Mapping[str, Any], gate_report: Mapping[str, Any]) -> SealDryRunObject:
    packet = _build_normalized_packet(candidate, gate_report)
    seal_body = {
        "seal_object_id": f"seal_dry_run_{packet['candidate_id']}_v1",
        "seal_schema_version": SEAL_ENGINE_SCHEMA_VERSION,
        "seal_kind": "mea_seal_object_dry_run",
        "seal_status": "DRY_RUN_ONLY_NOT_EXECUTED",
        "problem_id": packet["problem_id"],
        "parent_manifest_hash": packet["parent_manifest_hash"],
        "candidate_id": packet["candidate_id"],
        "candidate_hash": packet["candidate_hash"],
        "manifest_hash": packet["manifest_hash"],
        "claim_status": packet["claim_status"],
        "gate_results": packet["gate_results"],
        "gate_report_hash": packet["gate_report_hash"],
        "proof_debt": packet["proof_debt"],
        "remaining_unknowns": packet["remaining_unknowns"],
        "remaining_unknown_count": packet["remaining_unknown_count"],
        "output_permissions": packet["output_permissions"],
        "allowed_next_transitions": packet["allowed_next_transitions"],
        "normalized_packet_hash": packet["packet_hash"],
        "rmc_algorithm_reference": SEAL_ENGINE_ALGORITHM_REFERENCE,
        "seal_execution_permitted": False,
        "executed": False,
        "sealed_candidate": False,
        "live_candidate_commit_permitted": False,
        "live_manifest_advance_permitted": False,
        "memory_write_permitted": False,
        "memory_promotion_permitted": False,
        "seal_route_available": False,
        "memory_promotion_route_available": False,
    }
    seal_hash = _sha256(seal_body)
    return SealDryRunObject(
        seal_object_id=str(seal_body["seal_object_id"]),
        seal_object_hash=seal_hash,
        seal_hash_algorithm="sha256_canonical_json",
        seal_schema_version=SEAL_ENGINE_SCHEMA_VERSION,
        seal_kind=str(seal_body["seal_kind"]),
        seal_status=str(seal_body["seal_status"]),
        problem_id=str(seal_body["problem_id"]),
        parent_manifest_hash=str(seal_body["parent_manifest_hash"]),
        candidate_id=str(seal_body["candidate_id"]),
        candidate_hash=str(seal_body["candidate_hash"]),
        manifest_hash=str(seal_body["manifest_hash"]),
        claim_status=str(seal_body["claim_status"]),
        gate_results=dict(seal_body["gate_results"]),
        gate_report_hash=str(seal_body["gate_report_hash"]),
        proof_debt=float(seal_body["proof_debt"]),
        remaining_unknowns=tuple(packet["remaining_unknowns"]),
        remaining_unknown_count=int(seal_body["remaining_unknown_count"]),
        output_permissions=tuple(packet["output_permissions"]),
        allowed_next_transitions=tuple(packet["allowed_next_transitions"]),
        normalized_packet=dict(packet),
        normalized_packet_hash=str(packet["packet_hash"]),
        rmc_algorithm_reference=SEAL_ENGINE_ALGORITHM_REFERENCE,
        seal_execution_permitted=False,
        executed=False,
        sealed_candidate=False,
        live_candidate_commit_permitted=False,
        live_manifest_advance_permitted=False,
        memory_write_permitted=False,
        memory_promotion_permitted=False,
        seal_route_available=False,
        memory_promotion_route_available=False,
    )


def build_seal_engine_dry_run(endpoint: str = SEAL_ENGINE_DRY_RUN_ROUTE) -> Dict[str, Any]:
    manifest = build_144hz_test_manifest()
    parent_hash = canonical_hash(manifest)
    candidates_by_id = _candidate_lookup()
    gate_preview = build_gate_engine_preview()
    gate_reports = tuple(_mapping(g) for g in _sequence(gate_preview.get("gate_reports")))

    dry_run_objects = []
    blocked_candidates = []
    for report in gate_reports:
        candidate_id = str(report.get("candidate_id"))
        candidate = candidates_by_id.get(candidate_id, {})
        is_compilable = (
            bool(report.get("hard_gate_passed"))
            and bool(report.get("selectable_preview"))
            and not bool(report.get("reference_only"))
            and str(report.get("claim_status")) not in {ClaimStatus.REJECTED.value, ClaimStatus.RECALL.value}
        )
        if is_compilable:
            dry_run_objects.append(_seal_object_from_candidate(candidate, report).to_dict())
        else:
            blocked_candidates.append({
                "candidate_id": candidate_id,
                "claim_status": report.get("claim_status"),
                "decision": report.get("decision"),
                "reason": "not selectable for dry-run seal object compilation",
                "seal_execution_permitted": False,
                "memory_write_permitted": False,
            })

    first_hash = _sha256(dry_run_objects)
    second_hash = _sha256(dry_run_objects)
    object_hashes = [obj.get("seal_object_hash") for obj in dry_run_objects]
    return {
        "status": "OK",
        "endpoint": endpoint,
        "mode": SEAL_ENGINE_MODE,
        "current_patch": SEAL_ENGINE_PATCH_ID,
        "schema_version": SEAL_ENGINE_SCHEMA_VERSION,
        "formula": SEAL_ENGINE_FORMULA,
        "algorithm_reference": SEAL_ENGINE_ALGORITHM_REFERENCE,
        "preview_type": "mea_seal_engine_dry_run_no_execution",
        "problem_id": "144hz_substrate_status",
        "parent_manifest_hash": parent_hash,
        "candidate_source": "rmc_engine_v1/mea/candidate_generator.py",
        "gate_source": "rmc_engine_v1/mea/gate_engine.py",
        "normalized_packet_source": "seal_engine.py dry-run normalizer over generated candidates and gate reports",
        "seal_engine_visible": True,
        "dry_run_only": True,
        "seal_object_count": len(dry_run_objects),
        "blocked_candidate_count": len(blocked_candidates),
        "candidate_count": len(gate_reports),
        "best_dry_run_candidate_id": dry_run_objects[0].get("candidate_id") if dry_run_objects else None,
        "best_dry_run_claim_status": dry_run_objects[0].get("claim_status") if dry_run_objects else None,
        "seal_object_hashes": object_hashes,
        "seal_object_hash_stability_proven": first_hash == second_hash and all(isinstance(h, str) and len(h) == 64 for h in object_hashes),
        "dry_run_collection_hash": first_hash,
        "seal_objects": dry_run_objects,
        "blocked_candidates": blocked_candidates,
        "seal_execution_permitted": False,
        "executed": False,
        "seals_candidates": False,
        "candidate_sealing_active": False,
        "live_candidate_commit_active": False,
        "live_manifest_advance_active": False,
        "advances_live_manifest": False,
        "seal_route_available": False,
        "memory_write_active": False,
        "memory_write_permitted": False,
        "memory_promotion_active": False,
        "promotes_to_memory": False,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "performs_network_io": False,
        "renders_user_output": False,
        "boundary": seal_engine_boundary(),
    }
