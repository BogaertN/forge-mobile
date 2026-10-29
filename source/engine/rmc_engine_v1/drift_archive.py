"""Drift Archive — forge/rmc_engine_v1/drift_archive.py

Patch 266 — diagnostic-only append-only archive for drift_archive_only candidates.

The drift archive is the forensic record of loops that could not be classified
into any other route cleanly, or loops routed as diagnostic-only.  It is:
  - append-only (no updates, no deletes)
  - diagnostic-read-only (cannot support truth claims)
  - not resurrection-eligible
  - not a truth-support source
  - not a projection source

Design source: AI.Web Forge/RMC Build Objective — Patch 266 spec
"""
from __future__ import annotations
import datetime as _dt, hashlib as _hl, json as _json, os as _os, tempfile as _tf
from pathlib import Path as _Path
from typing import Any

try:
    from rmc_engine_v1.measurement_kernel import stable_hash, stable_id
except Exception:
    def stable_hash(obj):  # type: ignore
        return _hl.sha256(_json.dumps(obj, sort_keys=True, default=str).encode()).hexdigest()
    def stable_id(prefix, obj, n=18):  # type: ignore
        return f"{prefix}_{_hl.sha256(str(obj).encode()).hexdigest()[:n]}"

ENGINE_VERSION = "rmc_drift_archive_v1_patch266"
ENGINE_MODE    = "drift_archive_diagnostic_only"
APPROVAL_TOKEN = "APPROVE_DRIFT_ARCHIVE_WRITE"
DEFAULT_ARCHIVE_ROOT = _Path("/home/nic/forge/memory/drift_archive_v1")

def _utc() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()

def boundary() -> dict:
    return {
        "engine_version":     ENGINE_VERSION,
        "engine_mode":        ENGINE_MODE,
        "description":        "Append-only diagnostic archive for drift_archive_only route candidates.",
        "truth_support_allowed":   False,
        "projection_allowed":      False,
        "resurrection_eligible":   False,
        "stable_memory_allowed":   False,
        "read_only":               True,
        "writes_files":            False,
        "writes_rmc_memory":       False,
        "writes_identity_vault":   False,
        "queries_chroma":          False,
        "calls_llm":               False,
        "executes_shell":          False,
    }

def preview_archive_record(scored_candidate: dict) -> dict:
    """Plan a drift archive record.  Does NOT write."""
    sc = dict(scored_candidate) if isinstance(scored_candidate, dict) else {}
    candidate_id   = str(sc.get("candidate_id") or "unknown")
    reason_codes   = list(sc.get("reason_codes") or sc.get("route_reason_codes") or [])
    drift_report   = dict(sc.get("drift_report") or {})
    drift_type_raw = str(drift_report.get("drift_type") or "unknown_drift_type")
    drift_signature = stable_hash({"candidate_id": candidate_id, "reason_codes": reason_codes,
                                    "drift_type": drift_type_raw, "eps": sc.get("epsilon_s", 0)})
    attempted_correction = bool(sc.get("correction_attempted") or sc.get("chi_attempted"))
    archive_id = stable_id("darec", {"sig": drift_signature, "ts": _utc()[:19]}, 20)
    return {
        "status":               "PREVIEW_OK",
        # Required spec fields
        "archive_record_id":    archive_id,
        "drift_type":           drift_type_raw,
        "drift_signature":      drift_signature,
        "reason_codes":         reason_codes,
        "attempted_correction": attempted_correction,
        "diagnostic_only":      True,
        "truth_support_allowed": False,
        "projection_allowed":   False,
        "stable_memory_allowed": False,
        "resurrection_eligible": False,
        "source_candidate_id":  candidate_id,
        "epsilon_s":            sc.get("epsilon_s", 0.0),
        "preview_at_utc":       _utc(),
        "approval_token_for_commit": APPROVAL_TOKEN,
        "engine_version":       ENGINE_VERSION,
        "read_only":            True,
        "writes_files":         False,
    }

def commit_archive_record(preview: dict, *, approval_token: str,
                           archive_root: str | _Path | None = None) -> dict:
    """Write drift archive record.  Requires approval token."""
    if approval_token != APPROVAL_TOKEN:
        return {"status": "REFUSED", "reason": "approval_token_required",
                "approval_token_required": APPROVAL_TOKEN}
    root = _Path(archive_root or DEFAULT_ARCHIVE_ROOT).expanduser().resolve()
    rec_id = str(preview.get("archive_record_id", stable_id("darec", preview, 20)))
    try:
        root.mkdir(parents=True, exist_ok=True)
        target = root / f"{rec_id}.json"
        if target.exists():
            return {"status": "IDEMPOTENT_NO_OP", "reason": "record_already_exists",
                    "archive_record_id": rec_id}
        with _tf.NamedTemporaryFile("w", dir=root, suffix=".tmp", delete=False) as f:
            _json.dump({**preview, "committed_at_utc": _utc()}, f, indent=2, default=str)
            tmp = f.name
        _os.replace(tmp, target)
    except Exception as exc:
        return {"status": "WRITE_ERROR", "error": str(exc)}
    return {"status": "COMMITTED", "archive_record_id": rec_id, "path": str(target),
            "writes_files": True, "writes_rmc_memory": False}
