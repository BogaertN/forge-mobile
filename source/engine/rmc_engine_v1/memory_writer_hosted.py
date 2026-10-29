"""Hosted kb.contributions insert for an admitted fact.

The memory writer calls public.memory_writer_insert. It reports written only
when the readback is the same admitted fact: state admitted, sfe {Phi, eps, mu},
provenance, and contributor credit.

No project credentials in this process means the insert was not sent.
written stays false. That is not a success.

Anon cannot use this path. The migration grants execute to authenticated only,
and the function rejects a missing user and any row that is not an admitted fact.
"""
from __future__ import annotations

import hashlib
import json
import os
from typing import Any
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

MIGRATION = "supabase/migrations/20261029201023_memory_writer_admitted_insert.sql"
PENDING = (
    "Apply supabase/migrations/20261029201023_memory_writer_admitted_insert.sql "
    "to project hqcvywujrygbnaowgwln. This process has no SUPABASE_URL and no "
    "SUPABASE_ACCESS_TOKEN, so the insert was not sent and is not reported as written."
)


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def payload_for(row: dict[str, Any]) -> dict[str, Any]:
    sfe = row.get("sfe") if isinstance(row.get("sfe"), dict) else {}
    provenance = row.get("provenance") if isinstance(row.get("provenance"), dict) else {}
    contributor = str((provenance or {}).get("contributor") or row.get("contributor") or "").strip()
    text = str(row.get("text") or "")
    body = {
        "text": text,
        "schema": "FORGE-RESONANCE-PACKET/v1",
        "sfe": {"Phi": sfe.get("Phi"), "eps": sfe.get("eps"), "mu": sfe.get("mu")},
        "provenance": provenance,
        "contributor": contributor,
        "state": "admitted",
    }
    digest = _sha(json.dumps(body, sort_keys=True, ensure_ascii=False))
    return {
        "p_kind": "fact",
        "p_payload": body,
        "p_proof": {"source": "rmc_core.admit_gate", "text_sha256": _sha(text)},
        "p_sources": [],
        "p_content_sha256": digest,
        "p_signature": digest,
        "p_consent": {"contributor": contributor, "credit": provenance.get("credit") or contributor},
        "p_provenance": provenance,
        "p_contributor": contributor,
    }


def _matches(sent: dict[str, Any], readback: dict[str, Any]) -> bool:
    if not isinstance(readback, dict):
        return False
    if str(readback.get("state") or "") != "admitted":
        return False
    payload = readback.get("payload") if isinstance(readback.get("payload"), dict) else {}
    want = sent.get("p_payload") if isinstance(sent.get("p_payload"), dict) else {}
    sfe = payload.get("sfe") if isinstance(payload.get("sfe"), dict) else {}
    need = want.get("sfe") if isinstance(want.get("sfe"), dict) else {}
    if sfe.get("Phi") != need.get("Phi") or sfe.get("eps") != need.get("eps") or sfe.get("mu") != need.get("mu"):
        return False
    if not isinstance(payload.get("provenance"), dict) or not payload.get("provenance"):
        return False
    if str(payload.get("contributor") or "") != str(want.get("contributor") or ""):
        return False
    if str(payload.get("text") or "") != str(want.get("text") or ""):
        return False
    return True


def _env_transport():
    url = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
    token = os.environ.get("SUPABASE_ACCESS_TOKEN") or ""
    anon = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_PUBLISHABLE_KEY") or ""
    if not url or not token or not anon:
        return None

    def transport(call: dict[str, Any]) -> dict[str, Any]:
        if call.get("op") != "insert":
            return {"ok": False, "rule": "KB-WRITER-INSERT-FAILED"}
        req = urlrequest.Request(
            url + "/rest/v1/rpc/memory_writer_insert",
            data=json.dumps(call.get("row") or {}).encode("utf-8"),
            headers={
                "apikey": anon,
                "authorization": "Bearer " + token,
                "content-type": "application/json",
                "accept": "application/json",
            },
            method="POST",
        )
        try:
            with urlrequest.urlopen(req, timeout=20) as resp:
                body = json.loads(resp.read().decode("utf-8") or "null")
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:240]
            return {"ok": False, "rule": "KB-WRITER-INSERT-FAILED", "error": detail, "status": exc.code}
        except URLError as exc:
            return {"ok": False, "rule": "KB-WRITER-INSERT-FAILED", "error": str(exc.reason)[:240]}
        return {"ok": isinstance(body, dict), "row": body if isinstance(body, dict) else {}, "inserted": True}
    return transport


def commit_hosted(row: dict[str, Any] | None, transport=None) -> dict[str, Any]:
    """Verify the hosted insert. written is true only when readback matches."""
    sent = payload_for(row or {})
    base = {
        "attempted": True,
        "written": False,
        "verified": False,
        "calls_llm": False,
        "cite": MIGRATION,
        "hosted_session": True,
        "contributor": sent.get("p_contributor"),
    }
    if not sent.get("p_contributor") or not isinstance((sent.get("p_payload") or {}).get("sfe"), dict):
        base["rule"] = "KB-WRITER-PROVENANCE-REQUIRED"
        return base
    if transport is None:
        transport = _env_transport()
    if transport is None:
        base["rule"] = "KB-WRITER-CREDENTIALS-PENDING"
        base["pending"] = PENDING
        return base
    try:
        result = transport({"op": "insert", "row": sent})
    except Exception as exc:
        base["rule"] = "KB-WRITER-INSERT-FAILED"
        base["error"] = str(exc)[:240]
        return base
    if not isinstance(result, dict) or result.get("ok") is not True:
        base["rule"] = str((result or {}).get("rule") or "KB-WRITER-INSERT-FAILED")
        if isinstance(result, dict) and result.get("error"):
            base["error"] = str(result.get("error"))[:240]
        return base
    readback = result.get("row") if isinstance(result.get("row"), dict) else {}
    if result.get("needs_select") and readback.get("id"):
        try:
            selected = transport({"op": "select", "id": readback.get("id"), "expect": sent})
        except Exception as exc:
            base["rule"] = "KB-WRITER-READBACK-FAILED"
            base["error"] = str(exc)[:240]
            return base
        if isinstance(selected, dict) and isinstance(selected.get("row"), dict):
            readback = selected["row"]
    if not _matches(sent, readback):
        base["rule"] = "KB-WRITER-READBACK-FAILED"
        base["id"] = readback.get("id")
        return base
    inserted = result.get("inserted", readback.get("inserted", True))
    base["verified"] = True
    base["written"] = bool(inserted) and str(readback.get("state") or "") == "admitted"
    base["id"] = readback.get("id")
    base["rule"] = "KB-WRITER-VERIFIED" if base["written"] else "KB-WRITER-ALREADY-PRESENT"
    if base["rule"] == "KB-WRITER-ALREADY-PRESENT":
        base["written"] = False
        base["verified"] = True
    return base
