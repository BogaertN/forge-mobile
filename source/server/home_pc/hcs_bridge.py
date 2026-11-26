"""Packet exchange between Forge Mobile, this home node, and Harmonic Conductor Studio.

HCS stays a separate desktop app. This process only moves .hfield packets.
A packet that arrives from HCS is a claim. It is not a publisher and it is not stored.
Gilligan still has to pass it. A service_role token is refused.
"""
from __future__ import annotations

import os
from typing import Any


SCHEMA = "aiweb.hfield"
MEMORY = "forge.hfield.memory.v1"
BRIDGE = "aiweb.hfield.forge_packet_bridge_stub.v1"


def _policy(packet: dict[str, Any]) -> dict[str, Any]:
    mem = packet.get("forge_memory") if isinstance(packet.get("forge_memory"), dict) else {}
    policy = mem.get("receiver_policy") if isinstance(mem.get("receiver_policy"), dict) else {}
    top = packet.get("receiver_policy") if isinstance(packet.get("receiver_policy"), dict) else {}
    return dict(top, **policy)


def claim_from_hcs(packet: dict[str, Any] | None, *, bearer: str | None = None) -> dict[str, Any]:
    """An HCS packet is a claim. Nothing here admits it or writes it."""
    token = bearer if bearer is not None else (os.environ.get("FORGE_WRITER_BEARER") or "")
    if "service_role" in token:
        return {"ok": False, "rule": "HCS-SERVICE-ROLE-REFUSED", "admitted": False, "wrote": False, "calls_llm": False}
    if not isinstance(packet, dict):
        return {"ok": False, "rule": "HCS-PACKET-MISSING", "admitted": False, "wrote": False, "calls_llm": False}
    if str(packet.get("schema") or packet.get("format") or "") not in (SCHEMA, "forge.hfield", ""):
        if packet.get("schema") not in (None, SCHEMA):
            return {"ok": False, "rule": "HCS-SCHEMA-REFUSED", "admitted": False, "wrote": False, "calls_llm": False}
    policy = _policy(packet)
    if policy.get("peer_is_publisher") is True or policy.get("auto_persist") is True:
        return {"ok": False, "rule": "HCS-PUBLISHER-REFUSED", "admitted": False, "wrote": False, "publisher": False, "calls_llm": False}
    if packet.get("calls_llm") is True:
        return {"ok": False, "rule": "HCS-LLM-REFUSED", "admitted": False, "wrote": False, "calls_llm": False}
    records = []
    mem = packet.get("forge_memory") if isinstance(packet.get("forge_memory"), dict) else {}
    for row in mem.get("records") or packet.get("records") or []:
        if isinstance(row, dict) and str(row.get("text") or "").strip():
            records.append({"text": str(row.get("text"))[:400], "source": "hcs", "publisher": False, "evidence_only": True})
    return {
        "ok": True,
        "rule": "HCS-CLAIM",
        "admitted": False,
        "wrote": False,
        "publisher": False,
        "needs_gilligan": True,
        "auto_persist": False,
        "records": records,
        "bridge": BRIDGE,
        "calls_llm": False,
    }


def exchange(packet: dict[str, Any] | None, *, hcs_url: str | None = None) -> dict[str, Any]:
    """Hold the packet unless an HCS URL is configured. This build does not open that URL."""
    url = (hcs_url if hcs_url is not None else os.environ.get("FORGE_HCS_URL") or "").strip()
    claim = claim_from_hcs(packet)
    if not claim.get("ok"):
        return claim
    if not url:
        return dict(claim, rule="HCS-HELD", reason="hcs_not_configured", forwarded=False)
    return dict(claim, rule="HCS-READY", forwarded=False, reason="no_live_post_in_this_process", hcs_url=url)
