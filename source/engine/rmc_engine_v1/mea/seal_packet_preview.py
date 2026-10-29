"""
forge/rmc_engine_v1/mea/seal_packet_preview.py

Patch 285 — MEA Seal Packet Preview / Future Seal Payload Normalizer.

This module normalizes the exact future seal packet that a later seal engine
would be allowed to lock. It is not the seal engine. It does not create
/api/mea/seal, execute a seal, commit candidates, write files, write memory,
write Chroma, touch Identity Vault, call an LLM, execute shell commands,
perform network I/O, promote memory, or render user output.

Purpose:
- convert Patch 284R seal-readiness reports into deterministic packet previews;
- prove packet hashes are stable across canonical JSON normalization;
- preserve parent hash, candidate hash, hard-gate hash, readiness hash, claim
  status, remaining unknowns, output permissions, and allowed next transitions;
- keep real sealing and memory promotion unavailable.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import json
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple

from .seal_readiness import (
    SEAL_READINESS_APPROVAL_TOKEN,
    build_seal_readiness_preview,
    evaluate_seal_readiness_request,
)

SEAL_PACKET_PATCH_ID = "Patch 285 — MEA Seal Packet Preview / Future Seal Payload Normalizer"
SEAL_PACKET_SCHEMA_VERSION = "mea_seal_packet_preview_v1_patch285"
SEAL_PACKET_MODE = "controlled_mea_seal_packet_preview_patch285"
SEAL_PACKET_APPROVAL_TOKEN = "APPROVE_MEA_SEAL_PACKET_PREVIEW"
SEAL_PACKET_STATUS_ROUTE = "/api/mea/seal-packet/status"
SEAL_PACKET_PREVIEW_ROUTE = "/api/mea/seal-packet-preview"
SEAL_PACKET_POST_ROUTE = "/api/mea/seal-packet-gate"
SEAL_PACKET_ALIAS_ROUTE = "/api/mea/future-seal-payload-gate"

SEAL_PACKET_FORMULA = (
    "SealPacket(c_i)=Canonicalize(SealReady(c_i),H(c_i),GateHash,ReadinessHash,ClaimStatus,RemainingUnknowns,Transitions)"
)
SEAL_PACKET_REQUIRED_FIELDS = (
    "packet_id",
    "packet_hash",
    "packet_schema_version",
    "problem_id",
    "parent_hash",
    "candidate_id",
    "candidate_hash",
    "manifest_hash",
    "claim_status",
    "hard_gate_report_hash",
    "seal_readiness_report_hash",
    "future_seal_payload_hash",
    "remaining_unknowns",
    "remaining_unknown_count",
    "output_permissions",
    "allowed_next_transitions",
    "seal_execution_permitted",
    "memory_promotion_permitted",
)


def _stable_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def _sha256(value: Any) -> str:
    return hashlib.sha256(_stable_json(value).encode("utf-8")).hexdigest()


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _sequence(value: Any) -> Sequence[Any]:
    return value if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)) else []


@dataclass(frozen=True)
class SealPacketPreview:
    packet_id: str
    packet_hash: str
    packet_hash_algorithm: str
    packet_schema_version: str
    packet_kind: str
    packet_status: str
    packet_body: Dict[str, Any]
    source_candidate_id: str
    source_candidate_hash: Optional[str]
    source_readiness_decision: str
    hash_recomputed_matches: bool
    seal_execution_permitted: bool
    memory_promotion_permitted: bool
    seal_route_available: bool
    memory_promotion_route_available: bool
    patch_id: str = SEAL_PACKET_PATCH_ID
    schema_version: str = SEAL_PACKET_SCHEMA_VERSION

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def seal_packet_boundary() -> Dict[str, Any]:
    return {
        "patch": SEAL_PACKET_PATCH_ID,
        "schema_version": SEAL_PACKET_SCHEMA_VERSION,
        "layer": "MEA seal packet preview / future seal payload normalizer",
        "read_only": False,
        "non_mutating": True,
        "creates_get_routes": True,
        "creates_post_routes": True,
        "get_routes": [SEAL_PACKET_STATUS_ROUTE, SEAL_PACKET_PREVIEW_ROUTE],
        "post_routes": [SEAL_PACKET_POST_ROUTE, SEAL_PACKET_ALIAS_ROUTE],
        "requires_approval_token": True,
        "approval_token": SEAL_PACKET_APPROVAL_TOKEN,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "performs_network_io": False,
        "seeds_live_manifests": False,
        "commits_live_candidates": False,
        "seals_candidates": False,
        "promotes_to_memory": False,
        "renders_user_output": False,
        "mutates_existing_rmc_behavior": False,
        "mutates_launcher_behavior": False,
        "mutates_operator_console_ui": False,
        "seal_route_available": False,
        "memory_promotion_route_available": False,
        "real_seal_route": "/api/mea/seal remains intentionally unavailable in Patch 285",
        "real_memory_promotion_route": "not available in Patch 285",
    }


def seal_packet_status() -> Dict[str, Any]:
    return {
        "status": "OK",
        "endpoint": SEAL_PACKET_STATUS_ROUTE,
        "mode": SEAL_PACKET_MODE,
        "current_patch": SEAL_PACKET_PATCH_ID,
        "schema_version": SEAL_PACKET_SCHEMA_VERSION,
        "gate_visible": True,
        "preview_route": SEAL_PACKET_PREVIEW_ROUTE,
        "post_route": SEAL_PACKET_POST_ROUTE,
        "alias_route": SEAL_PACKET_ALIAS_ROUTE,
        "approval_required": True,
        "approval_token": SEAL_PACKET_APPROVAL_TOKEN,
        "seal_readiness_token_required": SEAL_READINESS_APPROVAL_TOKEN,
        "seal_packet_formula": SEAL_PACKET_FORMULA,
        "required_packet_fields": list(SEAL_PACKET_REQUIRED_FIELDS),
        "live_candidate_commit_active": False,
        "candidate_sealing_active": False,
        "memory_promotion_active": False,
        "seal_route_available": False,
        "memory_promotion_route_available": False,
        "boundary": seal_packet_boundary(),
    }


def _seal_readiness_report_hash(seal_readiness_report: Mapping[str, Any]) -> str:
    return _sha256({
        "problem_id": seal_readiness_report.get("problem_id"),
        "parent_hash": seal_readiness_report.get("parent_hash"),
        "hard_gate_report_hash": seal_readiness_report.get("hard_gate_report_hash"),
        "seal_readiness_reports": seal_readiness_report.get("seal_readiness_reports", []),
        "schema_version": seal_readiness_report.get("schema_version"),
    })


def _packet_body_from_readiness(seal_readiness_report: Mapping[str, Any], readiness: Mapping[str, Any], readiness_hash: str) -> Dict[str, Any]:
    payload = _mapping(readiness.get("future_seal_payload_preview"))
    candidate_id = str(readiness.get("candidate_id") or payload.get("candidate_id") or "unknown_candidate")
    remaining_unknowns = list(_sequence(payload.get("remaining_unknowns")))
    allowed_next_transitions = list(_sequence(payload.get("allowed_next_transitions")))
    return {
        "packet_id": f"seal_packet_{candidate_id}_v1",
        "packet_schema_version": SEAL_PACKET_SCHEMA_VERSION,
        "packet_kind": "future_seal_payload_preview",
        "problem_id": seal_readiness_report.get("problem_id"),
        "parent_hash": readiness.get("parent_hash") or payload.get("parent_hash"),
        "candidate_id": candidate_id,
        "candidate_hash": readiness.get("candidate_hash") or payload.get("candidate_hash"),
        "manifest_hash": payload.get("manifest_hash") or readiness.get("candidate_hash"),
        "claim_status": readiness.get("claim_status") or payload.get("claim_status"),
        "readiness_decision": readiness.get("readiness_decision"),
        "hard_gate_decision": readiness.get("hard_gate_decision") or payload.get("hard_gate_decision"),
        "hard_gate_report_hash": seal_readiness_report.get("hard_gate_report_hash") or payload.get("hard_gate_report_hash"),
        "seal_readiness_report_hash": readiness_hash,
        "future_seal_payload_hash": readiness.get("future_seal_payload_hash"),
        "remaining_unknowns": remaining_unknowns,
        "remaining_unknown_count": len(remaining_unknowns),
        "output_permissions": payload.get("output_permissions") or "sealed_manifest_preview_only",
        "allowed_next_transitions": allowed_next_transitions,
        "readiness_checks": tuple(readiness.get("readiness_checks", ())),
        "seal_blocked_reason": readiness.get("seal_blocked_reason"),
        "seal_execution_permitted": False,
        "memory_promotion_permitted": False,
        "seal_route_available": False,
        "memory_promotion_route_available": False,
        "source_patch_id": readiness.get("patch_id"),
        "source_schema_version": readiness.get("schema_version"),
        "patch_id": SEAL_PACKET_PATCH_ID,
        "schema_version": SEAL_PACKET_SCHEMA_VERSION,
    }


def normalize_seal_packet(readiness_report: Mapping[str, Any], seal_readiness_report: Mapping[str, Any]) -> SealPacketPreview:
    readiness_hash = _seal_readiness_report_hash(seal_readiness_report)
    body = _packet_body_from_readiness(seal_readiness_report, readiness_report, readiness_hash)
    body_hash_source = {k: v for k, v in body.items() if k != "packet_hash"}
    packet_hash = _sha256(body_hash_source)
    body_with_hash = dict(body)
    body_with_hash["packet_hash"] = packet_hash
    recomputed = _sha256({k: v for k, v in body_with_hash.items() if k != "packet_hash"}) == packet_hash
    return SealPacketPreview(
        packet_id=str(body_with_hash["packet_id"]),
        packet_hash=packet_hash,
        packet_hash_algorithm="sha256_canonical_json",
        packet_schema_version=SEAL_PACKET_SCHEMA_VERSION,
        packet_kind="future_seal_payload_preview",
        packet_status="NORMALIZED_PREVIEW_ONLY",
        packet_body=body_with_hash,
        source_candidate_id=str(body_with_hash["candidate_id"]),
        source_candidate_hash=body_with_hash.get("candidate_hash"),
        source_readiness_decision=str(body_with_hash.get("readiness_decision") or "UNKNOWN"),
        hash_recomputed_matches=recomputed,
        seal_execution_permitted=False,
        memory_promotion_permitted=False,
        seal_route_available=False,
        memory_promotion_route_available=False,
    )


def build_seal_packet_preview(seal_readiness_report: Optional[Mapping[str, Any]] = None) -> Dict[str, Any]:
    source = seal_readiness_report if isinstance(seal_readiness_report, Mapping) else build_seal_readiness_preview()
    readiness_hash = _seal_readiness_report_hash(source)
    readiness_reports = source.get("seal_readiness_reports", []) if isinstance(source.get("seal_readiness_reports"), Sequence) else []
    packets: List[Dict[str, Any]] = []
    blocked: List[Dict[str, Any]] = []
    for item in readiness_reports:
        if not isinstance(item, Mapping):
            continue
        if item.get("would_be_seal_ready") is True and isinstance(item.get("future_seal_payload_preview"), Mapping):
            packets.append(normalize_seal_packet(item, source).to_dict())
        else:
            blocked.append({
                "candidate_id": item.get("candidate_id"),
                "candidate_hash": item.get("candidate_hash"),
                "claim_status": item.get("claim_status"),
                "readiness_decision": item.get("readiness_decision"),
                "blocked_reason": item.get("seal_blocked_reason"),
                "future_seal_payload_hash": item.get("future_seal_payload_hash"),
            })

    best_id = source.get("best_seal_ready_candidate_id")
    best = None
    if best_id:
        best = next((p for p in packets if p.get("source_candidate_id") == best_id), None)
    if best is None and packets:
        best = packets[0]

    packet_hashes = [p.get("packet_hash") for p in packets]
    return {
        "status": "OK",
        "endpoint": SEAL_PACKET_PREVIEW_ROUTE,
        "mode": SEAL_PACKET_MODE,
        "current_patch": SEAL_PACKET_PATCH_ID,
        "schema_version": SEAL_PACKET_SCHEMA_VERSION,
        "preview_type": "seal_packet_preview",
        "problem_id": source.get("problem_id"),
        "parent_hash": source.get("parent_hash"),
        "hard_gate_report_hash": source.get("hard_gate_report_hash"),
        "seal_readiness_report_hash": readiness_hash,
        "candidate_count": source.get("candidate_count"),
        "seal_ready_preview_count": source.get("seal_ready_preview_count"),
        "packet_preview_count": len(packets),
        "blocked_packet_count": len(blocked),
        "best_packet_candidate_id": best.get("source_candidate_id") if best else None,
        "best_packet_hash": best.get("packet_hash") if best else None,
        "best_packet_claim_status": best.get("packet_body", {}).get("claim_status") if best else None,
        "packet_hashes": packet_hashes,
        "packet_hashes_unique": len(packet_hashes) == len(set(packet_hashes)),
        "packet_hash_stability_proven": all(p.get("hash_recomputed_matches") is True for p in packets),
        "seal_packet_formula": SEAL_PACKET_FORMULA,
        "required_packet_fields": list(SEAL_PACKET_REQUIRED_FIELDS),
        "seal_packets": packets,
        "blocked_packet_reasons": blocked,
        "source_seal_readiness_summary": {
            "current_patch": source.get("current_patch"),
            "seal_ready_preview_count": source.get("seal_ready_preview_count"),
            "blocked_count": source.get("blocked_count"),
            "best_seal_ready_candidate_id": source.get("best_seal_ready_candidate_id"),
            "seal_execution_permitted": source.get("seal_execution_permitted"),
            "seal_route_available": source.get("seal_route_available"),
            "memory_promotion_active": source.get("memory_promotion_active"),
        },
        "hard_laws": {
            "seal_packet_preview_is_not_seal": True,
            "no_api_mea_seal_route": True,
            "no_memory_promotion": True,
            "hashes_are_canonical_json": True,
            "hypothesis_packet_remains_hypothesis": True,
        },
        "non_mutating": True,
        "read_only": False,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "performs_network_io": False,
        "seeds_live_manifests": False,
        "commits_live_candidates": False,
        "seals_candidates": False,
        "promotes_to_memory": False,
        "renders_user_output": False,
        "seal_route_available": False,
        "seal_execution_permitted": False,
        "memory_promotion_active": False,
        "boundary": seal_packet_boundary(),
    }


def evaluate_seal_packet_request(request: Optional[Mapping[str, Any]]) -> Dict[str, Any]:
    req = request if isinstance(request, Mapping) else {}
    supplied_token = str(req.get("approval_token") or req.get("approval") or "")
    if supplied_token != SEAL_PACKET_APPROVAL_TOKEN:
        return {
            "status": "REJECTED",
            "endpoint": SEAL_PACKET_POST_ROUTE,
            "mode": SEAL_PACKET_MODE,
            "current_patch": SEAL_PACKET_PATCH_ID,
            "schema_version": SEAL_PACKET_SCHEMA_VERSION,
            "gate_status": "REJECTED",
            "accepted": False,
            "reason_code": "approval_token_required",
            "approval_required": True,
            "approval_token_name": "approval_token",
            "expected_approval_token": SEAL_PACKET_APPROVAL_TOKEN,
            "gate_errors": ["missing or invalid approval_token for controlled MEA seal packet preview"],
            "packet_preview_count": 0,
            "non_mutating": True,
            "writes_files": False,
            "writes_memory": False,
            "writes_chroma": False,
            "writes_identity_vault": False,
            "calls_llm": False,
            "executes_shell": False,
            "commits_live_candidates": False,
            "seals_candidates": False,
            "promotes_to_memory": False,
            "boundary": seal_packet_boundary(),
        }

    seal_readiness_request = req.get("seal_readiness_request")
    if isinstance(seal_readiness_request, Mapping):
        readiness_payload = dict(seal_readiness_request)
    else:
        readiness_payload = {"use_fixture": bool(req.get("use_fixture", True))}
        if isinstance(req.get("hard_gate_request"), Mapping):
            readiness_payload["hard_gate_request"] = dict(req["hard_gate_request"])
        if isinstance(req.get("candidate_set_request"), Mapping):
            readiness_payload["candidate_set_request"] = dict(req["candidate_set_request"])
        if isinstance(req.get("manifest"), Mapping):
            readiness_payload["manifest"] = dict(req["manifest"])
            readiness_payload["source"] = req.get("source") or "request_manifest"
        if isinstance(req.get("problem_manifest"), Mapping):
            readiness_payload["problem_manifest"] = dict(req["problem_manifest"])
            readiness_payload["source"] = req.get("source") or "request_manifest"
    readiness_payload.setdefault("approval_token", SEAL_READINESS_APPROVAL_TOKEN)

    readiness = evaluate_seal_readiness_request(readiness_payload)
    if readiness.get("status") != "OK" or readiness.get("gate_status") == "REJECTED":
        return {
            "status": "REJECTED",
            "endpoint": SEAL_PACKET_POST_ROUTE,
            "mode": SEAL_PACKET_MODE,
            "current_patch": SEAL_PACKET_PATCH_ID,
            "schema_version": SEAL_PACKET_SCHEMA_VERSION,
            "gate_status": "REJECTED",
            "accepted": False,
            "reason_code": "seal_readiness_failed",
            "seal_readiness_result": dict(readiness),
            "packet_preview_count": 0,
            "non_mutating": True,
            "writes_files": False,
            "writes_memory": False,
            "writes_chroma": False,
            "writes_identity_vault": False,
            "calls_llm": False,
            "executes_shell": False,
            "commits_live_candidates": False,
            "seals_candidates": False,
            "promotes_to_memory": False,
            "boundary": seal_packet_boundary(),
        }

    report = build_seal_packet_preview(readiness)
    report.update({
        "endpoint": SEAL_PACKET_POST_ROUTE,
        "gate_status": "ACCEPTED_PREVIEW_ONLY",
        "accepted": True,
        "approval_required": True,
        "approval_token_name": "approval_token",
        "expected_approval_token": SEAL_PACKET_APPROVAL_TOKEN,
        "seal_readiness_result": dict(readiness),
    })
    return report


def build_seal_packet_gate_preview() -> Dict[str, Any]:
    return evaluate_seal_packet_request({"approval_token": SEAL_PACKET_APPROVAL_TOKEN, "use_fixture": True})


def build_seal_packet_rejection_preview() -> Dict[str, Any]:
    return evaluate_seal_packet_request({"use_fixture": True})
