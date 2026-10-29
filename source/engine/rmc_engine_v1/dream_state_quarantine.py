"""Dream State Quarantine — forge/rmc_engine_v1/dream_state_quarantine.py

Patch 266 — Speculative / dream-state candidate quarantine.

Dream state candidates are speculative loops that are:
  - Not wrong enough to archive
  - Not stable enough to correct into manifest
  - Eligible for future arbitration when the system has more context

They are held here indefinitely until operator review releases, returns
to correction queue, or permanently archives them.  They CANNOT:
  - Project
  - Compile a manifest
  - Support stable truth claims
  - Enter active memory

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

ENGINE_VERSION = "rmc_dream_state_quarantine_v1_patch266"
ENGINE_MODE    = "dream_state_quarantine_speculative"
APPROVAL_TOKEN = "APPROVE_DREAM_QUARANTINE_WRITE"
DEFAULT_QUARANTINE_ROOT = _Path("/home/nic/forge/memory/dream_quarantine_v1")

def _utc() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()

def boundary() -> dict:
    return {
        "engine_version":      ENGINE_VERSION,
        "engine_mode":         ENGINE_MODE,
        "description":         "Quarantine for speculative dream-state candidates awaiting future arbitration.",
        "truth_support_allowed":    False,
        "stable_memory_allowed":    False,
        "projection_allowed":       False,
        "manifest_compile_allowed": False,
        "echo_validation_allowed":  False,
        "memory_write_allowed":     False,
        "future_arbitration_required": True,
        "read_only":                True,
        "writes_files":             False,
        "writes_rmc_memory":        False,
        "writes_identity_vault":    False,
        "queries_chroma":           False,
        "calls_llm":                False,
        "executes_shell":           False,
    }

def preview_dream_record(scored_candidate: dict) -> dict:
    """Plan a dream-state quarantine record.  Does NOT write."""
    sc = dict(scored_candidate) if isinstance(scored_candidate, dict) else {}
    candidate_id  = str(sc.get("candidate_id") or "unknown")
    novelty       = float(sc.get("novelty_estimate") or 0.0)
    eps           = float(sc.get("epsilon_s") or 0.0)
    hypothesis_state = {
        "novelty_estimate": round(novelty, 4),
        "epsilon_s":        round(eps, 4),
        "coherence_score":  round(float(sc.get("coherence_score") or 0.0), 4),
        "phase_path":       list(sc.get("phase_path") or []),
    }
    dream_id = stable_id("dream", {"candidate_id": candidate_id,
                                    "novelty": round(novelty, 4), "ts": _utc()[:19]}, 20)
    return {
        "status":                  "PREVIEW_OK",
        # Required spec fields
        "dream_record_id":         dream_id,
        "hypothesis_state":        hypothesis_state,
        "speculative_status":      "quarantined_pending_future_arbitration",
        "future_arbitration_required": True,
        "truth_support_allowed":   False,
        "projection_allowed":      False,
        "stable_memory_allowed":   False,
        "manifest_compile_allowed": False,
        "echo_validation_allowed": False,
        "memory_write_allowed":    False,
        "source_candidate_id":     candidate_id,
        "preview_at_utc":          _utc(),
        "approval_token_for_commit": APPROVAL_TOKEN,
        "engine_version":          ENGINE_VERSION,
        "read_only":               True,
        "writes_files":            False,
        "boundary":                boundary(),
    }

def commit_dream_record(preview: dict, *, approval_token: str,
                         quarantine_root: str | _Path | None = None) -> dict:
    if approval_token != APPROVAL_TOKEN:
        return {"status": "REFUSED", "reason": "approval_token_required",
                "approval_token_required": APPROVAL_TOKEN}
    root   = _Path(quarantine_root or DEFAULT_QUARANTINE_ROOT).expanduser().resolve()
    rec_id = str(preview.get("dream_record_id", stable_id("dream", preview, 20)))
    try:
        root.mkdir(parents=True, exist_ok=True)
        target = root / f"{rec_id}.json"
        if target.exists():
            return {"status": "IDEMPOTENT_NO_OP", "dream_record_id": rec_id}
        with _tf.NamedTemporaryFile("w", dir=root, suffix=".tmp", delete=False) as f:
            _json.dump({**preview, "committed_at_utc": _utc()}, f, indent=2, default=str)
            tmp = f.name
        _os.replace(tmp, target)
    except Exception as exc:
        return {"status": "WRITE_ERROR", "error": str(exc)}
    return {"status": "COMMITTED", "dream_record_id": rec_id, "path": str(target),
            "writes_files": True, "writes_rmc_memory": False}
