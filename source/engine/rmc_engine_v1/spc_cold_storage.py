"""Symbolic Phase Capacitor — forge/rmc_engine_v1/spc_cold_storage.py

Patch 266 — SPC / Archive / Dream / Ghost Storage Preview Suite

THE SYMBOLIC PHASE CAPACITOR.

Cold storage is silence and forensic preservation, not deletion.
A collapsed loop is not a failed loop — it is a loop the current runtime
cannot resolve.  The SPC stores it for a future generation that can.

Tiers
-----
HOT    : Active runtime. Not storage.
WARM   : Purgatory. Suspended loops awaiting ChristPing resurrection eligibility.
         Accessible via the 7-gate resurrection protocol (Patch 267/268).
COLD   : Deep Archive. Forensic preservation only. Not accessible to normal runtime.
DEEP   : Hell state. Permanently sealed. No resurrection. Triggered by:
           - resurrection_limit exceeded (default 5 attempts)
           - BREACH condition in resonance comparator

Collapse idempotence law
------------------------
If the same idempotence_key is submitted a second time, the SPC must refuse
with status="IDEMPOTENT_NO_OP".  Collapse cannot compound.
ϊ(⊙) = ⊙ : once at the collapse boundary, further collapse has no effect.

This module is PREVIEW mode in Patch 266.
  - preview_spc_record() plans what a real SPC write would create.
  - commit_spc_record() requires APPROVE_SPC_WRITE and writes to a temp
    directory (test-only) or the configured SPC root.
  - No write to Chroma, Identity Vault, active memory, or active runtime.
  - No LLM calls, no shell, no projection.

Design sources
--------------
  - Symbolic Cold Storage Theory (AI.Web internal doc)
  - FBSC Collapse-Resurrection Pipeline
  - AI.Web Forge/RMC Build Objective — Patch 266 spec
  - PCI: Section 4.4-4.5 Collapse-Resurrection Pipeline
"""
from __future__ import annotations

import datetime as _dt
import hashlib  as _hl
import json     as _json
import os       as _os
from pathlib import Path as _Path
from typing import Any

try:
    from rmc_engine_v1.measurement_kernel import clamp, stable_hash, stable_id
except Exception:
    def clamp(v: Any, low: float = 0.0, high: float = 1.0) -> float:  # type: ignore
        try: return max(float(low), min(float(high), float(v)))
        except: return float(low)
    def stable_hash(obj: Any) -> str:  # type: ignore
        return _hl.sha256(_json.dumps(obj, sort_keys=True, default=str).encode()).hexdigest()
    def stable_id(prefix: str, obj: Any, n: int = 18) -> str:  # type: ignore
        return f"{prefix}_{_hl.sha256(str(obj).encode()).hexdigest()[:n]}"

ENGINE_VERSION = "rmc_spc_cold_storage_v1_patch266"
ENGINE_MODE    = "spc_cold_storage_preview"

# ── SPC tiers ─────────────────────────────────────────────────────────────────
TIER_WARM  = "WARM"   # Purgatory — suspended, resurrection eligible
TIER_COLD  = "COLD"   # Deep Archive — forensic only
TIER_DEEP  = "DEEP"   # Hell — permanently sealed

ALL_TIERS           = (TIER_WARM, TIER_COLD, TIER_DEEP)
RESURRECTION_ELIGIBLE_TIERS  = frozenset({TIER_WARM})
NON_RESURRECTION_TIERS       = frozenset({TIER_COLD, TIER_DEEP})

# ── Constants ─────────────────────────────────────────────────────────────────
DEFAULT_RESURRECTION_LIMIT = 5
APPROVAL_TOKEN_SPC_WRITE   = "APPROVE_SPC_WRITE"
DEFAULT_SPC_ROOT           = _Path("/home/nic/forge/memory/spc_v1")

# ── Allowed and forbidden operations per tier ─────────────────────────────────
TIER_OPERATIONS: dict[str, dict[str, bool]] = {
    TIER_WARM: {
        "resurrection_eligible":        True,
        "christping_check_allowed":     True,
        "operator_read_allowed":        True,
        "active_runtime_reentry":       False,
        "projection_allowed":           False,
        "manifest_compile_allowed":     False,
        "echo_validation_allowed":      False,
        "memory_write_allowed":         False,
        "stable_memory_allowed":        False,
        "deletion_allowed":             False,
        "downgrade_to_cold_allowed":    True,
        "upgrade_to_active_allowed":    False,  # only via resurrection protocol
    },
    TIER_COLD: {
        "resurrection_eligible":        False,
        "christping_check_allowed":     False,
        "operator_read_allowed":        True,
        "active_runtime_reentry":       False,
        "projection_allowed":           False,
        "manifest_compile_allowed":     False,
        "echo_validation_allowed":      False,
        "memory_write_allowed":         False,
        "stable_memory_allowed":        False,
        "deletion_allowed":             False,
        "downgrade_to_cold_allowed":    False,
        "upgrade_to_active_allowed":    False,
    },
    TIER_DEEP: {
        "resurrection_eligible":        False,
        "christping_check_allowed":     False,
        "operator_read_allowed":        True,
        "active_runtime_reentry":       False,
        "projection_allowed":           False,
        "manifest_compile_allowed":     False,
        "echo_validation_allowed":      False,
        "memory_write_allowed":         False,
        "stable_memory_allowed":        False,
        "deletion_allowed":             False,
        "downgrade_to_cold_allowed":    False,
        "upgrade_to_active_allowed":    False,
    },
}

# ── Helpers ───────────────────────────────────────────────────────────────────
def _utc() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()

def _d(v: Any) -> dict:
    return dict(v) if isinstance(v, dict) else {}

def _f(v: Any, default: float = 0.0) -> float:
    try: return float(v)
    except: return default

def _determine_tier(source_route_result: dict, routing_decision: dict | None) -> tuple[str, list[str]]:
    """Determine initial SPC tier from routing context.

    DEEP  ← BREACH or resurrection_limit exceeded (from prior record)
    COLD  ← explicit cold_storage signal without resurrection eligibility
    WARM  ← default for new collapse entries
    """
    reasons: list[str] = []
    rd = _d(routing_decision)
    breach  = bool(rd.get("breach_condition") or source_route_result.get("breach"))
    locked  = bool(rd.get("resurrection_limit_exceeded") or source_route_result.get("resurrection_limit_exceeded"))
    cold_forced = bool(rd.get("force_cold_tier") or source_route_result.get("force_cold_tier"))

    if breach:
        reasons.append("breach_condition_permanent_seal"); return TIER_DEEP, reasons
    if locked:
        reasons.append("resurrection_limit_exceeded_permanent_seal"); return TIER_DEEP, reasons
    if cold_forced:
        reasons.append("cold_tier_forced"); return TIER_COLD, reasons
    reasons.append("new_collapse_entry_warm_purgatory"); return TIER_WARM, reasons


def _idempotence_key(candidate_id: str, phase_at_collapse: str, drift_signature: str) -> str:
    return stable_hash({"candidate_id": candidate_id,
                        "phase_at_collapse": phase_at_collapse,
                        "drift_signature": drift_signature})


# ── Public: boundary ──────────────────────────────────────────────────────────
def boundary() -> dict:
    return {
        "engine_version":   ENGINE_VERSION,
        "engine_mode":      ENGINE_MODE,
        "patch":            "266",
        "module":           "forge/rmc_engine_v1/spc_cold_storage.py",
        "description":      "Symbolic Phase Capacitor — three-tier forensic cold storage for collapsed loops.",
        "tiers":            list(ALL_TIERS),
        "tier_doctrine": {
            "WARM":  "Purgatory — suspended, resurrection eligible via ChristPing 7-gate protocol",
            "COLD":  "Deep Archive — forensic preservation, not accessible to normal runtime",
            "DEEP":  "Hell state — permanently sealed; no resurrection; no operator override",
        },
        "collapse_doctrine": {
            "idempotence_law":   "ϊ(⊙) = ⊙ — once at collapse boundary, further collapse is no-op",
            "preservation_law":  "Collapse is forensic preservation, not deletion",
            "deletion_law":      "Deletion is never permitted for any SPC tier",
        },
        "resurrection_limit":   DEFAULT_RESURRECTION_LIMIT,
        "approval_token":       APPROVAL_TOKEN_SPC_WRITE,
        "read_only":            True,
        "writes_files":         False,    # preview only; commit_spc_record writes with token
        "writes_rmc_memory":    False,
        "writes_identity_vault": False,
        "queries_chroma":       False,
        "calls_llm":            False,
        "executes_shell":       False,
        "projection_allowed":   False,
    }


# ── Public: preview ───────────────────────────────────────────────────────────
def preview_spc_record(
    scored_candidate: dict,
    *,
    routing_decision: dict | None = None,
    known_spc_keys: set[str] | None = None,
) -> dict:
    """Plan what a real SPC write would create.  Does NOT write anything.

    Parameters
    ----------
    scored_candidate:
        Output from score_candidate() or any candidate dict.
    routing_decision:
        Output from containment_router.route_candidate(). Optional.
    known_spc_keys:
        Set of idempotence keys already in SPC (for duplicate detection).
    """
    sc  = _d(scored_candidate)
    rd  = _d(routing_decision)
    if known_spc_keys is None:
        known_spc_keys = set()

    candidate_id    = str(sc.get("candidate_id") or "unknown")
    epsilon_s       = _f(sc.get("epsilon_s"), 0.0)
    phase_path      = list(sc.get("phase_path_hypothesis") or sc.get("phase_path") or [])
    phase_at_collapse = str((sc.get("phase_state") or {}).get("phase_primary") or
                            (phase_path[-1] if phase_path else "Φ_unknown"))
    drift_report    = _d(sc.get("drift_report") or sc.get("drift_classes") or {})
    drift_signature = stable_hash({"drift": drift_report, "epsilon_s": round(epsilon_s, 4)})
    math_terms      = _d(sc.get("math_terms"))
    cold_pressure   = _f(_d(sc.get("cold_storage_gate")).get("cold_storage_pressure"), 0.0)
    ghost_pressure  = _f(_d(sc.get("cold_storage_gate")).get("ghost_loop_pressure"), 0.0)

    # Residue = ε_s * 0.3 (from χ(t) doctrine: residue is accumulated symbolic entropy)
    residue = round(epsilon_s * 0.3, 4)

    # Extract invariant core (what survives collapse)
    invariant_core = {
        "candidate_id":    candidate_id,
        "epsilon_s":       round(epsilon_s, 4),
        "phase_at_collapse": phase_at_collapse,
        "cold_pressure":   round(cold_pressure, 4),
        "ghost_pressure":  round(ghost_pressure, 4),
        "circuit_breaker": bool(math_terms.get("circuit_breaker")),
        "residue":         residue,
    }

    tier, tier_reasons = _determine_tier(sc, rd)
    idem_key = _idempotence_key(candidate_id, phase_at_collapse, drift_signature)

    # Idempotence check
    is_duplicate = idem_key in known_spc_keys
    if is_duplicate:
        return {
            "status":         "IDEMPOTENT_NO_OP",
            "idempotence_key": idem_key,
            "reason":         "same collapse signature already in SPC — ϊ(⊙) = ⊙ — no further effect",
            "candidate_id":   candidate_id,
            "read_only":      True,
            "writes_files":   False,
        }

    ops = TIER_OPERATIONS[tier]
    reentry_conditions = (
        ["christping_7_gate_all_pass", "resonance_comparator_match",
         "resurrection_limit_not_exceeded", "system_capacity_gate_pass"]
        if tier == TIER_WARM else []
    )

    spc_record_id = stable_id("spc", {"idem_key": idem_key, "tier": tier}, 22)
    lineage_ref   = stable_hash({"candidate_id": candidate_id, "phase_path": phase_path})

    collapse_code = stable_hash({"epsilon_s": round(epsilon_s, 4),
                                  "drift_sig": drift_signature[:16],
                                  "phase": phase_at_collapse})

    return {
        "status":                "PREVIEW_OK",
        # Required spec fields
        "spc_record_id":         spc_record_id,
        "source_trace_id":       str(sc.get("routing_input_hash") or rd.get("routing_input_hash") or "none"),
        "source_candidate_id":   candidate_id,
        "phase_at_collapse":     phase_at_collapse,
        "phase_path":            phase_path,
        "collapse_code":         collapse_code,
        "collapse_reason":       " | ".join(tier_reasons),
        "drift_signature":       drift_signature,
        "invariant_core":        invariant_core,
        "residue":               residue,
        "lineage_ref":           lineage_ref,
        "tier":                  tier,
        "tier_reasons":          tier_reasons,
        "resurrection_eligible": ops["resurrection_eligible"],
        "resurrection_limit":    DEFAULT_RESURRECTION_LIMIT,
        "resurrection_attempts": 0,
        "reentry_conditions":    reentry_conditions,
        "allowed_operations":    {k: v for k, v in ops.items() if v},
        "forbidden_operations":  {k: v for k, v in ops.items() if not v},
        "idempotence_key":       idem_key,
        "tier_operations":       ops,
        "read_only":             True,
        "writes_files":          False,
        "approval_token_for_commit": APPROVAL_TOKEN_SPC_WRITE,
        "preview_at_utc":        _utc(),
        "engine_version":        ENGINE_VERSION,
        "boundary":              boundary(),
    }


def commit_spc_record(
    preview: dict,
    *,
    approval_token: str,
    spc_root: str | _Path | None = None,
) -> dict:
    """Write a SPC record to disk.  Requires explicit approval token.

    Writes ONLY inside spc_root (default /home/nic/forge/memory/spc_v1).
    Never writes to active memory, Chroma, or Identity Vault.
    """
    if approval_token != APPROVAL_TOKEN_SPC_WRITE:
        return {
            "status": "REFUSED",
            "reason": "approval_token_required",
            "approval_token_required": APPROVAL_TOKEN_SPC_WRITE,
        }
    if preview.get("status") == "IDEMPOTENT_NO_OP":
        return {"status": "IDEMPOTENT_NO_OP", "reason": preview.get("reason")}
    if preview.get("status") != "PREVIEW_OK":
        return {"status": "REFUSED", "reason": f"preview_status={preview.get('status')!r}_not_preview_ok"}

    root  = _Path(spc_root or DEFAULT_SPC_ROOT).expanduser().resolve()
    tier  = str(preview.get("tier", TIER_WARM))
    spc_id = str(preview["spc_record_id"])
    tier_dir = root / tier.lower()

    try:
        tier_dir.mkdir(parents=True, exist_ok=True)
        target = tier_dir / f"{spc_id}.json"
        # Atomic write via temp file
        import tempfile
        with tempfile.NamedTemporaryFile(
            "w", dir=tier_dir, suffix=".tmp", delete=False, encoding="utf-8"
        ) as tf:
            _json.dump({**preview, "committed_at_utc": _utc()}, tf, indent=2, default=str)
            tmp_path = tf.name
        _os.replace(tmp_path, target)
    except Exception as exc:
        return {"status": "WRITE_ERROR", "error": str(exc)}

    return {
        "status":          "COMMITTED",
        "spc_record_id":   spc_id,
        "tier":            tier,
        "path":            str(target),
        "approved_by":     APPROVAL_TOKEN_SPC_WRITE,
        "committed_at":    _utc(),
        "writes_files":    True,
        "writes_rmc_memory": False,
    }
