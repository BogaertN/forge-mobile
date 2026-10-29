"""RMC Containment Router — forge/rmc_engine_v1/containment_router.py

Patch 265 — RMC Containment Architecture Core

THE SINGLE MOST IMPORTANT ARCHITECTURAL BOUNDARY IN THE RMC.

The Containment Router is the safety organ that sits after coherence scoring
and before manifest compilation, output rendering, echo validation, and memory
write.  It receives a candidate/coherence/drift packet and decides the one
canonical route that candidate must travel.

Six routes (exactly one fires):

    active_stack_candidate           May reach: correction→naming→manifest→render→echo→write
    correction_queue                 May reach: correction→naming only; must re-score before manifest
    spc_cold_storage_required        SEALED — no projection, no manifest, no echo, no write
    dream_state_quarantine_candidate SEALED — future arbitration only
    drift_archive_only               SEALED — diagnostic read only, cannot support truth claims
    ghost_loop_containment_required  SEALED — system-capacity failure; cannot re-enter active runtime

ROUTING LAW (immutable):
  - Only active_stack_candidate may feed manifest compilation.
  - correction_queue may feed correction/naming only.
  - All sealed routes are blocked from projection, manifest, echo, stable memory,
    and memory write.
  - circuit_breaker → spc_cold_storage_required (always; takes priority).
  - ghost_loop_pressure > theta_ghost_pressure_max (and not circuit_breaker)
    → ghost_loop_containment_required.
  - must_archive → spc_cold_storage_required.
  - dream_state_eligible (and not must_archive and not ghost) → dream_state_quarantine_candidate.
  - correction_required (and not above) → correction_queue.
  - active_stack route (and all above passed) → active_stack_candidate.
  - Fallback / parse error → drift_archive_only.

Phase violations (always route to containment or correction — never projection):
  - Φ5→Φ8 skip                      → spc_cold_storage_required
  - Φ7 without Φ6                    → correction_queue (unless circuit_breaker)
  - Φ8 without Φ6/Φ7                 → spc_cold_storage_required
  - memory write before echo valid.  → spc_cold_storage_required
  - projection from drift/cold/dream  → spc_cold_storage_required
  - overextended candidates           → not projectable (routed to correction or containment)

This patch is READ-ONLY/PREFLIGHT.
It does not write SPC, archive, dream, ghost, memory, Chroma, or Identity Vault.
The storage modules (Patch 266) consume router output as their input.

Design sources:
  - AI.Web Forge/RMC Build Map T1-A
  - RMC Appendix C: cold storage = silence, not deletion
  - FBSC Symbolic Phase Capacitor tiers
  - ProtoForge2 memory-drift.py containment doctrine
  - AI.Web Forge/RMC Build objective doc (Patch 265 spec)
"""

from __future__ import annotations

import datetime as _dt
import hashlib   as _hl
import json      as _json
from typing import Any

try:
    from rmc_engine_v1.measurement_kernel import clamp, stable_hash, stable_id
except Exception:  # standalone / test import
    def clamp(v: Any, low: float = 0.0, high: float = 1.0) -> float:  # type: ignore[misc]
        try:
            return max(float(low), min(float(high), float(v)))
        except Exception:
            return float(low)

    def stable_hash(obj: Any) -> str:  # type: ignore[misc]
        return _hl.sha256(
            _json.dumps(obj, sort_keys=True, default=str).encode("utf-8", errors="replace")
        ).hexdigest()

    def stable_id(prefix: str, obj: Any, n: int = 18) -> str:  # type: ignore[misc]
        return f"{prefix}_{_hl.sha256(str(obj).encode()).hexdigest()[:n]}"


# ── Identity ──────────────────────────────────────────────────────────────────
ENGINE_VERSION = "rmc_containment_router_v1_patch265"
ENGINE_MODE    = "containment_routing_hard_boundary_read_only"

# ── Route labels (canonical, immutable) ──────────────────────────────────────
ROUTE_ACTIVE_STACK           = "active_stack_candidate"
ROUTE_CORRECTION_QUEUE       = "correction_queue"
ROUTE_SPC_COLD_STORAGE       = "spc_cold_storage_required"
ROUTE_DREAM_STATE_QUARANTINE = "dream_state_quarantine_candidate"
ROUTE_DRIFT_ARCHIVE          = "drift_archive_only"
ROUTE_GHOST_LOOP             = "ghost_loop_containment_required"

ALL_ROUTES: tuple[str, ...] = (
    ROUTE_ACTIVE_STACK,
    ROUTE_CORRECTION_QUEUE,
    ROUTE_SPC_COLD_STORAGE,
    ROUTE_DREAM_STATE_QUARANTINE,
    ROUTE_DRIFT_ARCHIVE,
    ROUTE_GHOST_LOOP,
)

# Routes from which NO downstream stage is reachable
SEALED_ROUTES: frozenset[str] = frozenset({
    ROUTE_SPC_COLD_STORAGE,
    ROUTE_DREAM_STATE_QUARANTINE,
    ROUTE_DRIFT_ARCHIVE,
    ROUTE_GHOST_LOOP,
})

# ── Threshold constants (explicitly labelled) ─────────────────────────────────
# These match coherence_math.gate_thresholds() exactly.
# "rmc_preflight_conservative" = safe for preflight dry-run mode.
# When ProtoForge2 drift connector is live, the doctrine threshold for
# Babel Cutoff (ε_s ≥ 0.78) becomes the production value.
THRESHOLDS: dict[str, Any] = {
    # Intervention threshold — χ(t) correction required
    "chi_t_intervention":        0.35,   # rmc_preflight_conservative
    # Hard circuit-breaker threshold (coherence_math enforces this)
    "circuit_breaker":           0.72,   # rmc_preflight_conservative
    # Babel Cutoff — production collapse trigger (named separately from preflight)
    "babel_cutoff_doctrine":     0.78,   # ProtoForge/RPMC doctrine
    # Ghost loop pressure ceiling (above this → ghost loop, not just correction)
    "ghost_loop_pressure_max":   0.30,   # matches coherence_math theta_ghost_pressure_max
    # Dream state eligibility minimum
    "dream_state_min":           0.44,   # matches coherence_math theta_dream_state_min
    # Labels
    "preflight_label":           "rmc_preflight_conservative",
    "doctrine_label":            "ProtoForge2_RPMC_doctrine",
}

# ── Per-route permission table ────────────────────────────────────────────────
# Defines exactly what each route may and may not feed downstream.
ROUTE_PERMISSIONS: dict[str, dict[str, bool]] = {
    ROUTE_ACTIVE_STACK: {
        "correction_naming_allowed":   True,
        "manifest_compile_allowed":    True,   # if correction/naming gates pass
        "echo_validation_allowed":     True,   # if manifest gate passes
        "memory_write_allowed":        True,   # if echo validation passes; gated token required
        "stable_memory_allowed":       True,   # if promotion path approves
        "projection_allowed":          False,  # never directly from here; manifest+echo gates required
        "re_scoring_allowed":          True,
        "requires_operator_review":    False,
        "containment_required":        False,
    },
    ROUTE_CORRECTION_QUEUE: {
        "correction_naming_allowed":   True,
        "manifest_compile_allowed":    False,  # must re-score after correction
        "echo_validation_allowed":     False,
        "memory_write_allowed":        False,
        "stable_memory_allowed":       False,
        "projection_allowed":          False,
        "re_scoring_allowed":          True,
        "requires_operator_review":    False,
        "containment_required":        False,
    },
    ROUTE_SPC_COLD_STORAGE: {
        "correction_naming_allowed":   False,
        "manifest_compile_allowed":    False,
        "echo_validation_allowed":     False,
        "memory_write_allowed":        False,
        "stable_memory_allowed":       False,
        "projection_allowed":          False,
        "re_scoring_allowed":          False,
        "requires_operator_review":    True,
        "containment_required":        True,
    },
    ROUTE_DREAM_STATE_QUARANTINE: {
        "correction_naming_allowed":   False,
        "manifest_compile_allowed":    False,
        "echo_validation_allowed":     False,
        "memory_write_allowed":        False,
        "stable_memory_allowed":       False,
        "projection_allowed":          False,
        "re_scoring_allowed":          False,
        "requires_operator_review":    True,
        "containment_required":        True,
    },
    ROUTE_DRIFT_ARCHIVE: {
        "correction_naming_allowed":   False,
        "manifest_compile_allowed":    False,
        "echo_validation_allowed":     False,
        "memory_write_allowed":        False,
        "stable_memory_allowed":       False,
        "projection_allowed":          False,
        "re_scoring_allowed":          False,
        "requires_operator_review":    False,
        "containment_required":        True,
    },
    ROUTE_GHOST_LOOP: {
        "correction_naming_allowed":   False,
        "manifest_compile_allowed":    False,
        "echo_validation_allowed":     False,
        "memory_write_allowed":        False,
        "stable_memory_allowed":       False,
        "projection_allowed":          False,
        "re_scoring_allowed":          False,
        "requires_operator_review":    True,
        "containment_required":        True,
    },
}


# ── Internal helpers ──────────────────────────────────────────────────────────

def _utc() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()

def _d(v: Any) -> dict:
    return dict(v) if isinstance(v, dict) else {}

def _f(v: Any, default: float = 0.0) -> float:
    try:
        return float(v)
    except Exception:
        return default

def _b(v: Any) -> bool:
    return bool(v)


def _extract_phase_flags(packet: dict) -> dict[str, bool]:
    """Extract phase-path violation flags from any level of nesting."""
    # Try multiple locations the packet might put phase info
    phase_state  = _d(packet.get("phase_state"))
    drift_report = _d(packet.get("drift_report"))
    math_terms   = _d(packet.get("math_terms"))
    score_comps  = _d(packet.get("score_components"))
    csg          = _d(packet.get("cold_storage_gate"))

    # Warnings array — may be nested in phase_state or top-level
    warnings: list = []
    for src in (packet, phase_state, drift_report):
        w = src.get("transition_warnings") or src.get("warnings") or []
        if isinstance(w, list):
            warnings.extend(w)
    warning_types = {str(w.get("type", "")) for w in warnings if isinstance(w, dict)}

    # Phase path — pull from any source
    phase_path: list = (
        phase_state.get("phase_path_hypothesis")
        or packet.get("phase_path_hypothesis")
        or packet.get("phase_path")
        or []
    )

    def _num(p: Any) -> int | None:
        try:
            return int(str(p).replace("Φ", "").replace("phi", "").strip())
        except Exception:
            return None

    nums = sorted({n for n in [_num(p) for p in phase_path] if n is not None})

    has_phi5 = 5 in nums
    has_phi6 = 6 in nums
    has_phi7 = 7 in nums
    has_phi8_plus = any(n >= 8 for n in nums)

    phi5_to_phi8_skip = (
        _b(packet.get("has_projection_skip"))
        or _b(math_terms.get("phase_skip_risk"))
        or _b(csg.get("phase_skip_detected"))
        or "phase_skip_projection_risk" in warning_types
        or (has_phi5 and has_phi8_plus and not has_phi6 and not has_phi7)
    )
    phi7_without_phi6 = has_phi7 and not has_phi6
    phi8_without_gates = has_phi8_plus and (not has_phi6 or not has_phi7)
    overextended = _b(packet.get("overextended")) or _b(packet.get("candidate_overextended"))

    return {
        "has_phi5": has_phi5,
        "has_phi6": has_phi6,
        "has_phi7": has_phi7,
        "has_phi8_plus": has_phi8_plus,
        "phi5_to_phi8_skip": phi5_to_phi8_skip,
        "phi7_without_phi6": phi7_without_phi6,
        "phi8_without_gates": phi8_without_gates,
        "overextended": overextended,
    }


def _decide_route(packet: dict) -> tuple[str, list[str]]:
    """Determine canonical route and ordered list of reason codes.

    Decision tree (strictly ordered — first match wins):

    0. Parse / missing gate              → drift_archive_only
    1. Phase skip Φ5→Φ8                  → spc_cold_storage_required
    2. Φ8 without Φ6/Φ7                  → spc_cold_storage_required
    3. circuit_breaker                   → spc_cold_storage_required
    4. ghost_loop_pressure > max         → ghost_loop_containment_required
    5. must_archive / epsilon collapse   → spc_cold_storage_required
    6. dream_state_eligible              → dream_state_quarantine_candidate
    7. Φ7 without Φ6 (correction gap)    → correction_queue
    8. correction_required               → correction_queue
    9. active_stack route signal         → active_stack_candidate
    10. Fallback                          → drift_archive_only
    """
    reasons: list[str] = []

    # Extract fields robustly
    csg          = _d(packet.get("cold_storage_gate"))
    math_terms   = _d(packet.get("math_terms"))
    corr_gate    = _d(packet.get("correction_gate"))

    circuit_breaker = (
        _b(math_terms.get("circuit_breaker"))
        or _b(_d(packet.get("circuit_breaker")).get("triggered"))
        or packet.get("coherence_score") == 0.0 and _b(packet.get("math_terms"))
    )
    # Normalise: coherence_score == 0.0 with math_terms present strongly implies CB
    if not circuit_breaker and _f(packet.get("coherence_score"), 1.0) == 0.0:
        score_comps = _d(packet.get("score_components"))
        if _b(score_comps.get("circuit_breaker_zeroed_score")):
            circuit_breaker = True

    ghost_loop_pressure = _f(
        math_terms.get("ghost_loop_pressure")
        or csg.get("ghost_loop_pressure")
        or packet.get("ghost_loop_pressure"),
        0.0,
    )
    must_archive = (
        _b(csg.get("must_archive"))
        or _f(packet.get("epsilon_s"), 0.0) >= THRESHOLDS["babel_cutoff_doctrine"]
        or "spc" in str(csg.get("route", "")).lower()
    )
    dream_eligible = (
        _b(math_terms.get("dream_state_eligible"))
        or _b(csg.get("dream_state_eligible"))
    )
    correction_required = (
        _b(corr_gate.get("required"))
        or _b(math_terms.get("chi_required"))
    )
    active_stack_signal = "active_stack" in str(csg.get("route", "")).lower()

    phase = _extract_phase_flags(packet)

    # 0. No routing data at all
    if not csg and not math_terms and not packet.get("candidate_id"):
        reasons.append("missing_routing_data")
        return ROUTE_DRIFT_ARCHIVE, reasons

    # 1. Φ5→Φ8 skip — hardest gate violation
    if phase["phi5_to_phi8_skip"]:
        reasons.append("phase_5_to_8_skip_projection_risk")
        return ROUTE_SPC_COLD_STORAGE, reasons

    # 2. Φ8 without Φ6/Φ7 (projection without gates) — always containment
    if phase["phi8_without_gates"]:
        reasons.append("phi8_present_without_correction_and_naming_gates")
        return ROUTE_SPC_COLD_STORAGE, reasons

    # 3. Circuit breaker
    if circuit_breaker:
        reasons.append("circuit_breaker_triggered")
        return ROUTE_SPC_COLD_STORAGE, reasons

    # 4. Ghost loop pressure ceiling — system capacity, not content failure
    if ghost_loop_pressure > THRESHOLDS["ghost_loop_pressure_max"]:
        reasons.append(f"ghost_loop_pressure={ghost_loop_pressure:.3f}_exceeds_max_{THRESHOLDS['ghost_loop_pressure_max']}")
        return ROUTE_GHOST_LOOP, reasons

    # 5. Explicit must-archive signal
    if must_archive:
        reasons.append("must_archive_epsilon_or_spc_gate_signal")
        return ROUTE_SPC_COLD_STORAGE, reasons

    # 6. Dream state — speculative quarantine
    if dream_eligible and not must_archive:
        reasons.append("dream_state_eligible_speculative_quarantine")
        return ROUTE_DREAM_STATE_QUARANTINE, reasons

    # 7. Φ7 without Φ6 — naming without correction; route to correction queue
    if phase["phi7_without_phi6"]:
        reasons.append("phi7_naming_present_without_phi6_correction_gate")
        return ROUTE_CORRECTION_QUEUE, reasons

    # 8. General correction required
    if correction_required:
        if phase["overextended"]:
            reasons.append("overextended_candidate_requires_correction")
        else:
            reasons.append("correction_gate_required_before_manifest")
        return ROUTE_CORRECTION_QUEUE, reasons

    # 9. Overextended but not circuit-broken — still needs correction
    if phase["overextended"]:
        reasons.append("overextended_candidate_correction_required")
        return ROUTE_CORRECTION_QUEUE, reasons

    # 10. Active stack signal — all gates clear
    if active_stack_signal:
        reasons.append("cold_storage_gate_route_active_stack_all_gates_passed")
        return ROUTE_ACTIVE_STACK, reasons

    # 11. Fallback — something unclear; preserve diagnostically
    reasons.append("route_unresolved_fallback_drift_archive")
    return ROUTE_DRIFT_ARCHIVE, reasons


# ── Public: boundary ──────────────────────────────────────────────────────────

def boundary() -> dict:
    """Return the module boundary contract (immutable law declaration)."""
    return {
        "engine_version":  ENGINE_VERSION,
        "engine_mode":     ENGINE_MODE,
        "patch":           "265",
        "module":          "forge/rmc_engine_v1/containment_router.py",
        "description":     (
            "Hard containment switchboard. Sits after coherence scoring and "
            "before manifest compilation. Routes every candidate to exactly "
            "one of six containment routes. Sealed routes cannot project, "
            "compile manifests, echo validate, or write memory."
        ),
        "routes":          list(ALL_ROUTES),
        "sealed_routes":   sorted(SEALED_ROUTES),
        "routing_law": {
            "only_active_stack_may_reach_manifest":           True,
            "circuit_breaker_always_spc":                     True,
            "ghost_loop_always_ghost_containment":            True,
            "phi5_phi8_skip_always_spc":                      True,
            "phi8_without_gates_always_spc":                  True,
            "phi7_without_phi6_correction_queue_or_spc":      True,
            "sealed_routes_cannot_project":                   True,
            "sealed_routes_cannot_compile_manifest":          True,
            "sealed_routes_cannot_echo_validate":             True,
            "sealed_routes_cannot_write_memory":              True,
            "sealed_routes_cannot_reach_stable_memory":       True,
            "overextended_candidates_not_projectable":        True,
            "memory_write_before_echo_validation_forbidden":  True,
            "drift_archive_cannot_support_truth_claims":      True,
            "ghost_loop_cannot_reenter_active_runtime":       True,
        },
        "thresholds":      THRESHOLDS,
        "design_sources": [
            "AI.Web Forge/RMC Build Objective — Patch 265 spec",
            "RMC Appendix C: cold storage = silence, not deletion",
            "FBSC Symbolic Phase Capacitor tiers",
            "ProtoForge2 memory-drift.py containment doctrine",
        ],
        # Hard side-effect flags
        "read_only":            True,
        "writes_files":         False,
        "writes_rmc_memory":    False,
        "writes_identity_vault": False,
        "queries_chroma":       False,
        "calls_llm":            False,
        "executes_shell":       False,
    }


# ── Public: route ─────────────────────────────────────────────────────────────

def route_candidate(packet: Any) -> dict:
    """Apply containment routing to a candidate/coherence/drift packet.

    Accepts output from score_candidate(), draft candidates, or any dict-like
    packet.  Robust to missing fields.

    Returns a full routing decision object.  Does NOT write to SPC, drift
    archive, dream quarantine, or ghost loop containment — those are Patch 266.
    """
    if not isinstance(packet, dict):
        packet = {}

    route, reason_codes = _decide_route(packet)
    perms = ROUTE_PERMISSIONS.get(route, ROUTE_PERMISSIONS[ROUTE_DRIFT_ARCHIVE])
    phase = _extract_phase_flags(packet)

    eps        = _f(packet.get("epsilon_s"), 0.0)
    coherence  = _f(packet.get("coherence_score"), 0.0)
    csg        = _d(packet.get("cold_storage_gate"))
    math_terms = _d(packet.get("math_terms"))
    cb         = _b(math_terms.get("circuit_breaker"))
    ghost_p    = _f(math_terms.get("ghost_loop_pressure") or csg.get("ghost_loop_pressure"), 0.0)
    cold_p     = _f(csg.get("cold_storage_pressure"), 0.0)
    candidate_id = packet.get("candidate_id") or packet.get("id") or "unknown"

    is_sealed = route in SEALED_ROUTES

    # Blocked downstream targets
    blocked_targets: list[str] = []
    allowed_targets: list[str] = []
    for stage, perm_key in (
        ("correction_naming",  "correction_naming_allowed"),
        ("manifest_compiler",  "manifest_compile_allowed"),
        ("output_renderer",    "echo_validation_allowed"),   # gated by manifest
        ("echo_validator",     "echo_validation_allowed"),
        ("memory_writer",      "memory_write_allowed"),
        ("stable_memory",      "stable_memory_allowed"),
    ):
        if perms.get(perm_key):
            allowed_targets.append(stage)
        else:
            blocked_targets.append(stage)

    # Always blocked: projection
    blocked_targets.append("projection")  # projection is never a pipeline stage

    required_next_stage: str
    if route == ROUTE_ACTIVE_STACK:
        required_next_stage = "correction_naming"
    elif route == ROUTE_CORRECTION_QUEUE:
        required_next_stage = "correction_naming"
    elif route == ROUTE_SPC_COLD_STORAGE:
        required_next_stage = "spc_cold_storage_module_patch266"
    elif route == ROUTE_DREAM_STATE_QUARANTINE:
        required_next_stage = "dream_state_quarantine_module_patch266"
    elif route == ROUTE_DRIFT_ARCHIVE:
        required_next_stage = "drift_archive_module_patch266"
    elif route == ROUTE_GHOST_LOOP:
        required_next_stage = "ghost_loop_containment_module_patch266"
    else:
        required_next_stage = "drift_archive_module_patch266"

    routing_input_hash = stable_hash({
        "candidate_id": candidate_id,
        "epsilon_s":    round(eps, 4),
        "circuit_breaker": cb,
        "ghost_loop_pressure": round(ghost_p, 4),
    })

    return {
        "status":                    "ROUTED",
        "route":                     route,
        "route_allowed_targets":     allowed_targets,
        "blocked_targets":           blocked_targets,
        "reason_codes":              reason_codes,
        "required_next_stage":       required_next_stage,
        # Explicit permission flags (required by spec)
        "projection_allowed":        False,   # never from containment router
        "manifest_compile_allowed":  perms["manifest_compile_allowed"],
        "echo_validation_allowed":   perms["echo_validation_allowed"],
        "memory_write_allowed":      perms["memory_write_allowed"],
        "stable_memory_allowed":     perms["stable_memory_allowed"],
        "requires_operator_review":  perms["requires_operator_review"],
        "containment_required":      perms["containment_required"],
        "read_only":                 True,
        # Routing context
        "is_sealed":                 is_sealed,
        "candidate_id":              candidate_id,
        "epsilon_s":                 round(eps, 4),
        "coherence_score":           round(coherence, 4),
        "circuit_breaker":           cb,
        "ghost_loop_pressure":       round(ghost_p, 4),
        "cold_storage_pressure":     round(cold_p, 4),
        "phase_flags":               phase,
        # Law declaration inline
        "containment_law": {
            "sealed_routes_cannot_project":        is_sealed,
            "only_active_stack_reaches_manifest":  route == ROUTE_ACTIVE_STACK,
            "cold_storage_is_silence_not_deletion": True,
            "ghost_loop_preserved_for_future_runtime": route == ROUTE_GHOST_LOOP,
        },
        "routing_input_hash": routing_input_hash,
        "routed_at_utc":      _utc(),
        "boundary":           boundary(),
        "engine_version":     ENGINE_VERSION,
        "writes_files":       False,
    }


# ── Public: permission check ──────────────────────────────────────────────────

def check_permission(route: str, stage: str) -> tuple[bool, str]:
    """Return (allowed, reason) for a route→stage pair.

    stage must be one of: correction_naming, manifest_compile,
    echo_validation, memory_write, stable_memory.
    """
    perms = ROUTE_PERMISSIONS.get(route)
    if perms is None:
        return False, f"unknown_route={route!r}"
    key = f"{stage}_allowed"
    if key not in perms:
        return False, f"unknown_stage={stage!r}"
    allowed = bool(perms[key])
    reason  = "permitted" if allowed else f"route={route!r}_blocks_stage={stage!r}"
    return allowed, reason


def assert_not_sealed(route: str, attempted_stage: str) -> None:
    """Raise ContainmentViolation if a sealed route attempts a forbidden stage.

    Call this from any downstream stage before accepting a candidate that was
    routed through the containment router.
    """
    if route in SEALED_ROUTES:
        raise ContainmentViolation(
            f"CONTAINMENT VIOLATION: route={route!r} is sealed. "
            f"Stage {attempted_stage!r} is not permitted for this route. "
            f"Sealed routes: {sorted(SEALED_ROUTES)}. "
            f"Law: cold storage = silence and forensic preservation, not deletion."
        )


class ContainmentViolation(Exception):
    """Raised when a sealed route attempts a downstream stage."""
