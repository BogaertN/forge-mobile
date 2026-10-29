"""Ghost Loop Containment — forge/rmc_engine_v1/ghost_loop_containment.py

Patch 266 — Containment for Gate 7 (system capacity) failures.

A ghost loop is NOT a wrong loop.  It is a loop the current runtime LACKS THE
CAPACITY to resolve.  The distinction matters:
  - SPC cold storage: content failed (high drift, circuit breaker, projection violation)
  - Ghost loop:       system failed (Gate 7 — capacity insufficient to close this loop)

Ghost loops are preserved indefinitely, tagged for future resolution when the
system evolves sufficient phase resolution capacity.  They:
  - CANNOT re-enter active runtime
  - CANNOT project
  - CANNOT support truth claims
  - CANNOT be resurrected by the current ChristPing protocol (Gate 7 failure means
    the current system cannot even reach the comparator)
  - ARE preserved as evidence for future system generations

Doctrine reference:
  "Ghost loops are cold-stored because the current runtime lacks the operator
  stack to resolve them, not because they are wrong."
  — Symbolic Cold Storage Theory (AI.Web internal doc)

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

ENGINE_VERSION = "rmc_ghost_loop_containment_v1_patch266"
ENGINE_MODE    = "ghost_loop_containment_system_capacity_failure"
APPROVAL_TOKEN = "APPROVE_GHOST_LOOP_WRITE"
DEFAULT_GHOST_ROOT = _Path("/home/nic/forge/memory/ghost_loops_v1")
GATE_FAILED    = 7  # Gate 7 = system capacity gate

def _utc() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()

def boundary() -> dict:
    return {
        "engine_version":          ENGINE_VERSION,
        "engine_mode":             ENGINE_MODE,
        "description":             "Ghost loop containment — system capacity failures preserved for future runtimes.",
        "gate_failed":             GATE_FAILED,
        "failure_type":            "system_capacity_not_content_error",
        "future_runtime_required": True,
        "truth_support_allowed":   False,
        "projection_allowed":      False,
        "active_runtime_reentry":  False,
        "resurrection_via_current_protocol": False,
        "resurrection_via_future_runtime":   True,  # possible in principle
        "stable_memory_allowed":   False,
        "deletion_allowed":        False,
        "read_only":               True,
        "writes_files":            False,
        "writes_rmc_memory":       False,
        "writes_identity_vault":   False,
        "queries_chroma":          False,
        "calls_llm":               False,
        "executes_shell":          False,
    }

def preview_ghost_record(scored_candidate: dict) -> dict:
    """Plan a ghost loop containment record.  Does NOT write."""
    sc = dict(scored_candidate) if isinstance(scored_candidate, dict) else {}
    candidate_id     = str(sc.get("candidate_id") or "unknown")
    ghost_pressure   = float(sc.get("ghost_loop_pressure") or
                              _d(sc.get("math_terms")).get("ghost_loop_pressure") or
                              _d(sc.get("cold_storage_gate")).get("ghost_loop_pressure") or 0.0)
    capacity_failure_reason = _infer_capacity_reason(sc)
    phase_path = list(sc.get("phase_path") or [])
    ghost_id   = stable_id("ghost", {"candidate_id": candidate_id,
                                       "ghost_pressure": round(ghost_pressure, 4),
                                       "ts": _utc()[:19]}, 20)
    return {
        "status":                  "PREVIEW_OK",
        # Required spec fields
        "ghost_loop_id":           ghost_id,
        "capacity_failure_reason": capacity_failure_reason,
        "gate_failed":             GATE_FAILED,
        "future_runtime_required": True,
        "truth_support_allowed":   False,
        "projection_allowed":      False,
        "active_runtime_reentry_allowed": False,
        "resurrection_via_current_protocol": False,
        "stable_memory_allowed":   False,
        "deletion_allowed":        False,
        # Preservation metadata
        "ghost_loop_pressure":     round(ghost_pressure, 4),
        "source_candidate_id":     candidate_id,
        "phase_path_at_containment": phase_path,
        "epsilon_s":               float(sc.get("epsilon_s") or 0.0),
        "coherence_score":         float(sc.get("coherence_score") or 0.0),
        "preservation_note": (
            "This loop is not wrong. The current system lacks sufficient phase "
            "resolution capacity to close it. It is preserved for a future "
            "runtime generation with expanded operator stack."
        ),
        "preview_at_utc":          _utc(),
        "approval_token_for_commit": APPROVAL_TOKEN,
        "engine_version":          ENGINE_VERSION,
        "read_only":               True,
        "writes_files":            False,
        "boundary":                boundary(),
    }

def _d(v: Any) -> dict:
    return dict(v) if isinstance(v, dict) else {}

def _infer_capacity_reason(sc: dict) -> str:
    math = _d(sc.get("math_terms"))
    phase_skip = bool(math.get("phase_skip_risk") or sc.get("has_projection_skip"))
    destructive = float(math.get("D_score") or sc.get("D_score") or 0.0)
    ghost_p = float(math.get("ghost_loop_pressure") or 0.0)

    parts = []
    if phase_skip:
        parts.append("phase_skip_risk_exceeds_system_resolution_capacity")
    if destructive >= 0.55:
        parts.append(f"destructive_drift_D={destructive:.2f}_beyond_current_correction_capacity")
    if ghost_p > 0.30:
        parts.append(f"ghost_loop_pressure={ghost_p:.3f}_system_capacity_gate_7_failed")
    if not parts:
        parts.append("system_capacity_gate_7_failed_reason_unspecified")
    return " | ".join(parts)

def commit_ghost_record(preview: dict, *, approval_token: str,
                         ghost_root: str | _Path | None = None) -> dict:
    if approval_token != APPROVAL_TOKEN:
        return {"status": "REFUSED", "reason": "approval_token_required",
                "approval_token_required": APPROVAL_TOKEN}
    root   = _Path(ghost_root or DEFAULT_GHOST_ROOT).expanduser().resolve()
    rec_id = str(preview.get("ghost_loop_id", stable_id("ghost", preview, 20)))
    try:
        root.mkdir(parents=True, exist_ok=True)
        target = root / f"{rec_id}.json"
        if target.exists():
            return {"status": "IDEMPOTENT_NO_OP", "ghost_loop_id": rec_id}
        with _tf.NamedTemporaryFile("w", dir=root, suffix=".tmp", delete=False) as f:
            _json.dump({**preview, "committed_at_utc": _utc()}, f, indent=2, default=str)
            tmp = f.name
        _os.replace(tmp, target)
    except Exception as exc:
        return {"status": "WRITE_ERROR", "error": str(exc)}
    return {"status": "COMMITTED", "ghost_loop_id": rec_id, "path": str(target),
            "writes_files": True, "writes_rmc_memory": False}
