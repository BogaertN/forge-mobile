"""Hosted kb.contributions write for an admitted fact (4.9.209: the Edge Function path).

Since 4.9.205 the only write path is the `memory-writer` Edge Function. The old
client RPC public.memory_writer_insert is revoked and always refuses
(KB-WRITER-SIGNED-PATH-REQUIRED). This module now builds exactly the request
the Edge Function accepts:

    POST {SUPABASE_URL}/functions/v1/memory-writer
    {"args": {p_consent, p_contributor, p_kind, p_payload, p_proof, p_provenance, p_sources},
     "proof": {"body": {purpose, uid, signer, nonce, ts, content_sha256}, "sig": <ECDSA P-256>}}

content_sha256 is the SHA-256 of canon(args), the same canonical JSON as
supabase/functions/memory-writer/writer.js and src/sb_sync.js. The proof body
must be signed by a device key registered to a linked writer account. This
process holds no device key, so a caller must pass sign(uid, content_sha256,
nonce) -> {"body": ..., "sig": ...}. With no session, no uid or no signer the
row is NOT sent and written stays false. That is not a success.

Ask never calls this (4.9.209: admitted answers are proposals; only an explicit
user request writes). No model is called.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import secrets
from typing import Any, Callable
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

FUNCTION = "supabase/functions/memory-writer/writer.js"
ARG_KEYS = ("p_consent", "p_contributor", "p_kind", "p_payload", "p_proof", "p_provenance", "p_sources")
PURPOSE = "forge-memory-writer/v1"


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _num(value: float) -> str:
    """A number as JavaScript's JSON.stringify writes it."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if not math.isfinite(value):
        return "null"
    if value == int(value) and abs(value) < 1e21:
        return str(int(value))
    text = repr(value)
    if "e" in text:
        mant, exp = text.split("e")
        sign = "-" if exp.startswith("-") else "+"
        text = mant + "e" + sign + exp.lstrip("+-").lstrip("0")
    return text


def canon(value: Any) -> str:
    """Canonical JSON: sorted keys, no spaces, JS number form (writer.js canon)."""
    if isinstance(value, dict):
        keys = sorted(value)
        return "{" + ",".join(json.dumps(k, ensure_ascii=False) + ":" + canon(value[k]) for k in keys) + "}"
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(canon(v) for v in value) + "]"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return _num(value)
    return json.dumps(value, ensure_ascii=False)


def args_for(row: dict[str, Any]) -> dict[str, Any]:
    """The seven write arguments, the same shape src/sb_sync.js insertAdmitted sends."""
    sfe = row.get("sfe") if isinstance(row.get("sfe"), dict) else {}
    provenance = row.get("provenance") if isinstance(row.get("provenance"), dict) else {}
    contributor = str((provenance or {}).get("contributor") or row.get("contributor") or "").strip()
    payload = {
        "text": str(row.get("text") or ""),
        "schema": "FORGE-RESONANCE-PACKET/v1",
        "sfe": {"Phi": sfe.get("Phi"), "eps": sfe.get("eps"), "mu": sfe.get("mu")},
        "provenance": provenance,
        "contributor": contributor,
        "state": "admitted",
    }
    return {
        "p_kind": "fact",
        "p_payload": payload,
        "p_proof": {"source": str(row.get("proof_source") or "rmc_core.admit_gate")},
        "p_sources": [],
        "p_consent": {"contributor": contributor},
        "p_provenance": provenance,
        "p_contributor": contributor,
    }


def payload_for(row: dict[str, Any]) -> dict[str, Any]:
    """Kept name: the write arguments plus their content hash (what the device signs)."""
    args = args_for(row)
    return {"args": args, "content_sha256": _sha(canon(args))}


def _matches(args: dict[str, Any], readback: dict[str, Any]) -> bool:
    if not isinstance(readback, dict) or str(readback.get("state") or "") != "admitted":
        return False
    payload = readback.get("payload") if isinstance(readback.get("payload"), dict) else {}
    want = args.get("p_payload") or {}
    sfe = payload.get("sfe") if isinstance(payload.get("sfe"), dict) else {}
    need = want.get("sfe") or {}
    if sfe.get("Phi") != need.get("Phi") or sfe.get("eps") != need.get("eps") or sfe.get("mu") != need.get("mu"):
        return False
    if not isinstance(payload.get("provenance"), dict) or not payload.get("provenance"):
        return False
    return str(payload.get("contributor") or "") == str(want.get("contributor") or "") and str(payload.get("text") or "") == str(want.get("text") or "")


def _env_transport():
    url = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
    token = os.environ.get("SUPABASE_ACCESS_TOKEN") or ""
    anon = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_PUBLISHABLE_KEY") or ""
    if not url or not token or not anon:
        return None

    def transport(call: dict[str, Any]) -> dict[str, Any]:
        if call.get("op") != "write":
            return {"ok": False, "rule": "KB-WRITER-INSERT-FAILED"}
        req = urlrequest.Request(
            url + "/functions/v1/memory-writer",
            data=json.dumps(call.get("body") or {}, ensure_ascii=False).encode("utf-8"),
            headers={"apikey": anon, "authorization": "Bearer " + token, "content-type": "application/json", "accept": "application/json"},
            method="POST",
        )
        try:
            with urlrequest.urlopen(req, timeout=20) as resp:
                body = json.loads(resp.read().decode("utf-8") or "null")
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:240]
            rule = "KB-WRITER-REFUSED"
            try:
                rule = str(json.loads(detail).get("rule") or rule)
            except (ValueError, AttributeError):
                pass
            return {"ok": False, "rule": rule, "error": detail, "status": exc.code}
        except URLError as exc:
            return {"ok": False, "rule": "KB-WRITER-INSERT-FAILED", "error": str(exc.reason)[:240]}
        ok = isinstance(body, dict) and body.get("ok") is True and isinstance(body.get("row"), dict)
        return {"ok": ok, "row": body.get("row") if ok else {}, "rule": None if ok else (body or {}).get("rule")}
    return transport


def commit_hosted(row: dict[str, Any] | None, transport=None, sign: Callable[[str, str, str], Any] | None = None, uid: str | None = None) -> dict[str, Any]:
    """Send one admitted row through the memory-writer Edge Function. written only when the readback matches."""
    built = payload_for(row or {})
    args, digest = built["args"], built["content_sha256"]
    base = {"attempted": True, "written": False, "verified": False, "calls_llm": False, "cite": FUNCTION,
            "path": "edge:memory-writer", "contributor": args.get("p_contributor"), "content_sha256": digest}
    sfe = (args.get("p_payload") or {}).get("sfe") or {}
    if not args.get("p_contributor") or any(sfe.get(k) is None for k in ("Phi", "eps", "mu")):
        base["rule"] = "KB-WRITER-PROVENANCE-REQUIRED"
        return base
    if transport is None:
        transport = _env_transport()
    if transport is None:
        base.update(rule="KB-WRITER-NO-SESSION", pending=True)
        return base
    uid = uid or os.environ.get("SUPABASE_USER_ID") or ""
    if not uid or sign is None:
        base.update(rule="KB-WRITER-UNSIGNED", pending=True)
        return base
    nonce = secrets.token_hex(16)
    try:
        proof = sign(uid, digest, nonce)
    except Exception as exc:  # a signer failure is not a write
        base.update(rule="KB-WRITER-DEVICE-LOCKED", error=str(exc)[:240], pending=True)
        return base
    if not isinstance(proof, dict) or not proof.get("body") or not proof.get("sig"):
        base.update(rule="KB-WRITER-DEVICE-LOCKED", pending=True)
        return base
    try:
        result = transport({"op": "write", "body": {"args": args, "proof": {"body": proof["body"], "sig": proof["sig"]}}})
    except Exception as exc:
        base.update(rule="KB-WRITER-INSERT-FAILED", error=str(exc)[:240])
        return base
    if not isinstance(result, dict) or result.get("ok") is not True:
        base["rule"] = str((result or {}).get("rule") or "KB-WRITER-INSERT-FAILED")
        if isinstance(result, dict) and result.get("error"):
            base["error"] = str(result.get("error"))[:240]
        return base
    readback = result.get("row") if isinstance(result.get("row"), dict) else {}
    if not _matches(args, readback):
        base.update(rule="KB-WRITER-READBACK-FAILED", id=readback.get("id"))
        return base
    inserted = readback.get("inserted", True) is not False
    base.update(verified=True, written=inserted, id=readback.get("id"),
                rule="KB-WRITER-VERIFIED" if inserted else "KB-WRITER-ALREADY-PRESENT")
    return base
