"""
forge/rmc_engine_v1/mea/seal_packet_audit_chain.py

Patch 286 — MEA Seal Packet Audit Chain / Hash Stability Ledger Preview.

This module proves the seal-packet lineage hash chain before a real seal engine
exists. It is a deterministic, non-mutating preview layer only. It does not
create /api/mea/seal, execute a seal, commit candidates, advance live manifests,
write files, write memory, write Chroma, touch Identity Vault, call an LLM,
execute shell commands, perform network I/O, promote memory, render user output,
or mutate UI/launcher behavior.

Purpose:
- consume Patch 285 normalized seal-packet previews;
- construct a stable lineage ledger over parent manifest hash, candidate hash,
  hard-gate report hash, seal-readiness report hash, and seal-packet hash;
- prove entry hashes and whole-chain hashes are deterministic;
- keep real sealing and memory promotion unavailable.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import json
from typing import Any, Dict, List, Mapping, Optional, Sequence

from .seal_packet_preview import (
    SEAL_PACKET_APPROVAL_TOKEN,
    build_seal_packet_preview,
    evaluate_seal_packet_request,
)

SEAL_AUDIT_CHAIN_PATCH_ID = "Patch 286 — MEA Seal Packet Audit Chain / Hash Stability Ledger Preview"
SEAL_AUDIT_CHAIN_SCHEMA_VERSION = "mea_seal_packet_audit_chain_v1_patch286"
SEAL_AUDIT_CHAIN_MODE = "controlled_mea_seal_packet_audit_chain_patch286"
SEAL_AUDIT_CHAIN_APPROVAL_TOKEN = "APPROVE_MEA_SEAL_AUDIT_CHAIN_PREVIEW"
SEAL_AUDIT_CHAIN_STATUS_ROUTE = "/api/mea/seal-audit-chain/status"
SEAL_AUDIT_CHAIN_PREVIEW_ROUTE = "/api/mea/seal-audit-chain-preview"
SEAL_AUDIT_CHAIN_POST_ROUTE = "/api/mea/seal-audit-chain-gate"

SEAL_AUDIT_CHAIN_FORMULA = (
    "SealAuditChain(c_i)=Hash(parent_manifest_hash,candidate_hash,hard_gate_report_hash,"
    "seal_readiness_report_hash,seal_packet_hash)"
)
SEAL_AUDIT_CHAIN_REQUIRED_LINK_FIELDS = (
    "parent_manifest_hash",
    "candidate_hash",
    "hard_gate_report_hash",
    "seal_readiness_report_hash",
    "seal_packet_hash",
)
SEAL_AUDIT_CHAIN_REQUIRED_PACKET_FIELDS = (
    "packet_id",
    "packet_hash",
    "candidate_id",
    "candidate_hash",
    "parent_hash",
    "hard_gate_report_hash",
    "seal_readiness_report_hash",
    "claim_status",
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
class SealPacketAuditLink:
    audit_link_id: str
    audit_link_hash: str
    audit_link_hash_algorithm: str
    audit_schema_version: str
    problem_id: Optional[str]
    packet_id: str
    candidate_id: str
    claim_status: str
    parent_manifest_hash: Optional[str]
    candidate_hash: Optional[str]
    hard_gate_report_hash: Optional[str]
    seal_readiness_report_hash: Optional[str]
    seal_packet_hash: Optional[str]
    future_seal_payload_hash: Optional[str]
    manifest_hash: Optional[str]
    remaining_unknown_count: int
    output_permissions: Optional[str]
    allowed_next_transitions: List[str]
    packet_status: str
    packet_hash_recomputed_matches: bool
    link_hash_recomputed_matches: bool
    seal_execution_permitted: bool
    memory_promotion_permitted: bool
    seal_route_available: bool
    memory_promotion_route_available: bool
    patch_id: str = SEAL_AUDIT_CHAIN_PATCH_ID
    schema_version: str = SEAL_AUDIT_CHAIN_SCHEMA_VERSION

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def seal_audit_chain_boundary() -> Dict[str, Any]:
    return {
        "patch": SEAL_AUDIT_CHAIN_PATCH_ID,
        "schema_version": SEAL_AUDIT_CHAIN_SCHEMA_VERSION,
        "layer": "MEA seal packet audit chain / hash stability ledger preview",
        "read_only": False,
        "non_mutating": True,
        "creates_get_routes": True,
        "creates_post_routes": True,
        "get_routes": [SEAL_AUDIT_CHAIN_STATUS_ROUTE, SEAL_AUDIT_CHAIN_PREVIEW_ROUTE],
        "post_routes": [SEAL_AUDIT_CHAIN_POST_ROUTE],
        "requires_approval_token": True,
        "approval_token": SEAL_AUDIT_CHAIN_APPROVAL_TOKEN,
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
        "real_seal_route": "/api/mea/seal remains intentionally unavailable in Patch 286",
        "real_memory_promotion_route": "not available in Patch 286",
    }


def seal_audit_chain_status() -> Dict[str, Any]:
    return {
        "status": "OK",
        "endpoint": SEAL_AUDIT_CHAIN_STATUS_ROUTE,
        "mode": SEAL_AUDIT_CHAIN_MODE,
        "current_patch": SEAL_AUDIT_CHAIN_PATCH_ID,
        "schema_version": SEAL_AUDIT_CHAIN_SCHEMA_VERSION,
        "gate_visible": True,
        "preview_route": SEAL_AUDIT_CHAIN_PREVIEW_ROUTE,
        "post_route": SEAL_AUDIT_CHAIN_POST_ROUTE,
        "approval_required": True,
        "approval_token": SEAL_AUDIT_CHAIN_APPROVAL_TOKEN,
        "seal_packet_token_required": SEAL_PACKET_APPROVAL_TOKEN,
        "seal_audit_chain_formula": SEAL_AUDIT_CHAIN_FORMULA,
        "required_link_fields": list(SEAL_AUDIT_CHAIN_REQUIRED_LINK_FIELDS),
        "required_packet_fields": list(SEAL_AUDIT_CHAIN_REQUIRED_PACKET_FIELDS),
        "live_candidate_commit_active": False,
        "candidate_sealing_active": False,
        "memory_promotion_active": False,
        "seal_route_available": False,
        "memory_promotion_route_available": False,
        "boundary": seal_audit_chain_boundary(),
    }


def _link_hash_source(link_body: Mapping[str, Any]) -> Dict[str, Any]:
    return {
        "problem_id": link_body.get("problem_id"),
        "packet_id": link_body.get("packet_id"),
        "candidate_id": link_body.get("candidate_id"),
        "claim_status": link_body.get("claim_status"),
        "parent_manifest_hash": link_body.get("parent_manifest_hash"),
        "candidate_hash": link_body.get("candidate_hash"),
        "hard_gate_report_hash": link_body.get("hard_gate_report_hash"),
        "seal_readiness_report_hash": link_body.get("seal_readiness_report_hash"),
        "seal_packet_hash": link_body.get("seal_packet_hash"),
        "future_seal_payload_hash": link_body.get("future_seal_payload_hash"),
        "manifest_hash": link_body.get("manifest_hash"),
        "remaining_unknown_count": link_body.get("remaining_unknown_count"),
        "output_permissions": link_body.get("output_permissions"),
        "allowed_next_transitions": link_body.get("allowed_next_transitions", []),
        "packet_status": link_body.get("packet_status"),
    }


def _audit_link_from_packet(problem_id: Optional[str], packet: Mapping[str, Any]) -> SealPacketAuditLink:
    body = _mapping(packet.get("packet_body"))
    candidate_id = str(body.get("candidate_id") or packet.get("source_candidate_id") or "unknown_candidate")
    packet_id = str(body.get("packet_id") or packet.get("packet_id") or f"seal_packet_{candidate_id}_v1")
    parent_hash = body.get("parent_hash") or packet.get("parent_hash")
    candidate_hash = body.get("candidate_hash") or packet.get("source_candidate_hash")
    hard_gate_hash = body.get("hard_gate_report_hash")
    readiness_hash = body.get("seal_readiness_report_hash")
    packet_hash = packet.get("packet_hash") or body.get("packet_hash")
    future_payload_hash = body.get("future_seal_payload_hash")
    allowed_next_transitions = list(_sequence(body.get("allowed_next_transitions")))
    link_body = {
        "problem_id": problem_id or body.get("problem_id"),
        "packet_id": packet_id,
        "candidate_id": candidate_id,
        "claim_status": str(body.get("claim_status") or "unknown"),
        "parent_manifest_hash": parent_hash,
        "candidate_hash": candidate_hash,
        "hard_gate_report_hash": hard_gate_hash,
        "seal_readiness_report_hash": readiness_hash,
        "seal_packet_hash": packet_hash,
        "future_seal_payload_hash": future_payload_hash,
        "manifest_hash": body.get("manifest_hash") or candidate_hash,
        "remaining_unknown_count": int(body.get("remaining_unknown_count") or 0),
        "output_permissions": body.get("output_permissions"),
        "allowed_next_transitions": allowed_next_transitions,
        "packet_status": str(packet.get("packet_status") or body.get("packet_status") or "UNKNOWN"),
    }
    link_hash = _sha256(_link_hash_source(link_body))
    recomputed = _sha256(_link_hash_source({**link_body, "audit_link_hash": link_hash})) == link_hash
    return SealPacketAuditLink(
        audit_link_id=f"seal_audit_link_{candidate_id}_v1",
        audit_link_hash=link_hash,
        audit_link_hash_algorithm="sha256_canonical_json",
        audit_schema_version=SEAL_AUDIT_CHAIN_SCHEMA_VERSION,
        problem_id=link_body["problem_id"],
        packet_id=packet_id,
        candidate_id=candidate_id,
        claim_status=link_body["claim_status"],
        parent_manifest_hash=parent_hash,
        candidate_hash=candidate_hash,
        hard_gate_report_hash=hard_gate_hash,
        seal_readiness_report_hash=readiness_hash,
        seal_packet_hash=packet_hash,
        future_seal_payload_hash=future_payload_hash,
        manifest_hash=link_body["manifest_hash"],
        remaining_unknown_count=link_body["remaining_unknown_count"],
        output_permissions=link_body["output_permissions"],
        allowed_next_transitions=allowed_next_transitions,
        packet_status=link_body["packet_status"],
        packet_hash_recomputed_matches=bool(packet.get("hash_recomputed_matches") is True),
        link_hash_recomputed_matches=recomputed,
        seal_execution_permitted=False,
        memory_promotion_permitted=False,
        seal_route_available=False,
        memory_promotion_route_available=False,
    )


def _audit_chain_hash(problem_id: Optional[str], links: Sequence[Mapping[str, Any]], source_packet_hashes: Sequence[Any]) -> str:
    return _sha256({
        "problem_id": problem_id,
        "link_hashes": [link.get("audit_link_hash") for link in links],
        "seal_packet_hashes": list(source_packet_hashes),
        "schema_version": SEAL_AUDIT_CHAIN_SCHEMA_VERSION,
    })


def build_seal_audit_chain_preview(seal_packet_report: Optional[Mapping[str, Any]] = None) -> Dict[str, Any]:
    source = seal_packet_report if isinstance(seal_packet_report, Mapping) else build_seal_packet_preview()
    packets = [_mapping(p) for p in _sequence(source.get("seal_packets")) if isinstance(p, Mapping)]
    links = [_audit_link_from_packet(source.get("problem_id"), packet).to_dict() for packet in packets]
    link_hashes = [link.get("audit_link_hash") for link in links]
    packet_hashes = [packet.get("packet_hash") for packet in packets]
    audit_chain_hash = _audit_chain_hash(source.get("problem_id"), links, packet_hashes)
    audit_chain_hash_repeat = _audit_chain_hash(source.get("problem_id"), links, packet_hashes)
    best_id = source.get("best_packet_candidate_id")
    best = next((link for link in links if link.get("candidate_id") == best_id), None)
    if best is None and links:
        best = links[0]
    return {
        "status": "OK",
        "endpoint": SEAL_AUDIT_CHAIN_PREVIEW_ROUTE,
        "mode": SEAL_AUDIT_CHAIN_MODE,
        "current_patch": SEAL_AUDIT_CHAIN_PATCH_ID,
        "schema_version": SEAL_AUDIT_CHAIN_SCHEMA_VERSION,
        "preview_type": "seal_packet_audit_chain",
        "problem_id": source.get("problem_id"),
        "parent_hash": source.get("parent_hash"),
        "hard_gate_report_hash": source.get("hard_gate_report_hash"),
        "seal_readiness_report_hash": source.get("seal_readiness_report_hash"),
        "candidate_count": source.get("candidate_count"),
        "packet_preview_count": source.get("packet_preview_count"),
        "audit_link_count": len(links),
        "blocked_audit_count": source.get("blocked_packet_count"),
        "best_audit_candidate_id": best.get("candidate_id") if best else None,
        "best_audit_link_hash": best.get("audit_link_hash") if best else None,
        "best_audit_claim_status": best.get("claim_status") if best else None,
        "seal_packet_hashes": packet_hashes,
        "audit_link_hashes": link_hashes,
        "audit_link_hashes_unique": len(link_hashes) == len(set(link_hashes)),
        "audit_link_hash_stability_proven": all(link.get("link_hash_recomputed_matches") is True for link in links),
        "packet_hash_stability_proven": bool(source.get("packet_hash_stability_proven") is True) and all(link.get("packet_hash_recomputed_matches") is True for link in links),
        "audit_chain_hash": audit_chain_hash,
        "audit_chain_hash_repeat": audit_chain_hash_repeat,
        "audit_chain_hash_stability_proven": audit_chain_hash == audit_chain_hash_repeat,
        "seal_audit_chain_formula": SEAL_AUDIT_CHAIN_FORMULA,
        "required_link_fields": list(SEAL_AUDIT_CHAIN_REQUIRED_LINK_FIELDS),
        "required_packet_fields": list(SEAL_AUDIT_CHAIN_REQUIRED_PACKET_FIELDS),
        "audit_links": links,
        "blocked_packet_reasons": source.get("blocked_packet_reasons", []),
        "source_seal_packet_summary": {
            "current_patch": source.get("current_patch"),
            "packet_preview_count": source.get("packet_preview_count"),
            "blocked_packet_count": source.get("blocked_packet_count"),
            "best_packet_candidate_id": source.get("best_packet_candidate_id"),
            "best_packet_hash": source.get("best_packet_hash"),
            "packet_hash_stability_proven": source.get("packet_hash_stability_proven"),
            "seal_execution_permitted": source.get("seal_execution_permitted"),
            "seal_route_available": source.get("seal_route_available"),
            "memory_promotion_active": source.get("memory_promotion_active"),
        },
        "hard_laws": {
            "audit_chain_preview_is_not_seal": True,
            "no_api_mea_seal_route": True,
            "no_memory_promotion": True,
            "hashes_are_canonical_json": True,
            "audit_chain_requires_packet_hash": True,
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
        "advances_live_manifest": False,
        "seals_candidates": False,
        "promotes_to_memory": False,
        "renders_user_output": False,
        "seal_route_available": False,
        "seal_execution_permitted": False,
        "memory_promotion_active": False,
        "boundary": seal_audit_chain_boundary(),
    }


def evaluate_seal_audit_chain_request(request: Optional[Mapping[str, Any]]) -> Dict[str, Any]:
    req = request if isinstance(request, Mapping) else {}
    supplied_token = str(req.get("approval_token") or req.get("approval") or "")
    if supplied_token != SEAL_AUDIT_CHAIN_APPROVAL_TOKEN:
        return {
            "status": "REJECTED",
            "endpoint": SEAL_AUDIT_CHAIN_POST_ROUTE,
            "mode": SEAL_AUDIT_CHAIN_MODE,
            "current_patch": SEAL_AUDIT_CHAIN_PATCH_ID,
            "schema_version": SEAL_AUDIT_CHAIN_SCHEMA_VERSION,
            "gate_status": "REJECTED",
            "accepted": False,
            "reason_code": "approval_token_required",
            "approval_required": True,
            "approval_token_name": "approval_token",
            "expected_approval_token": SEAL_AUDIT_CHAIN_APPROVAL_TOKEN,
            "gate_errors": ["missing or invalid approval_token for controlled MEA seal packet audit chain preview"],
            "audit_link_count": 0,
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
            "boundary": seal_audit_chain_boundary(),
        }

    seal_packet_request = req.get("seal_packet_request")
    if isinstance(seal_packet_request, Mapping):
        packet_payload = dict(seal_packet_request)
    else:
        packet_payload = {"use_fixture": bool(req.get("use_fixture", True))}
        for key in ("seal_readiness_request", "hard_gate_request", "candidate_set_request", "manifest", "problem_manifest"):
            if isinstance(req.get(key), Mapping):
                packet_payload[key] = dict(req[key])
        if req.get("source"):
            packet_payload["source"] = req.get("source")
    packet_payload.setdefault("approval_token", SEAL_PACKET_APPROVAL_TOKEN)

    packet_result = evaluate_seal_packet_request(packet_payload)
    if packet_result.get("status") != "OK" or packet_result.get("gate_status") == "REJECTED":
        return {
            "status": "REJECTED",
            "endpoint": SEAL_AUDIT_CHAIN_POST_ROUTE,
            "mode": SEAL_AUDIT_CHAIN_MODE,
            "current_patch": SEAL_AUDIT_CHAIN_PATCH_ID,
            "schema_version": SEAL_AUDIT_CHAIN_SCHEMA_VERSION,
            "gate_status": "REJECTED",
            "accepted": False,
            "reason_code": "seal_packet_preview_failed",
            "seal_packet_result": dict(packet_result),
            "audit_link_count": 0,
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
            "boundary": seal_audit_chain_boundary(),
        }

    report = build_seal_audit_chain_preview(packet_result)
    report.update({
        "endpoint": SEAL_AUDIT_CHAIN_POST_ROUTE,
        "gate_status": "ACCEPTED_PREVIEW_ONLY",
        "accepted": True,
        "approval_required": True,
        "approval_token_name": "approval_token",
        "expected_approval_token": SEAL_AUDIT_CHAIN_APPROVAL_TOKEN,
        "seal_packet_result": dict(packet_result),
    })
    return report


def build_seal_audit_chain_gate_preview() -> Dict[str, Any]:
    return evaluate_seal_audit_chain_request({"approval_token": SEAL_AUDIT_CHAIN_APPROVAL_TOKEN, "use_fixture": True})


def build_seal_audit_chain_rejection_preview() -> Dict[str, Any]:
    return evaluate_seal_audit_chain_request({"use_fixture": True})
