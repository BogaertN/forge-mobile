"""ChristPing 7-Gate Resurrection Engine Preview
forge/rmc_engine_v1/resurrection_engine.py

Patch 269 — read-only evaluation of SPC WARM records for resurrection eligibility.

This module answers one question: can a collapsed loop return as ψ′?
It does NOT write, resurrect, mutate SPC records, or re-enter active runtime.
Preview only.

ψ′ is not restoration. It is a transformed identity constituted by collapse
history. The loop that returns is not the loop that left — it is the loop
plus everything collapse revealed about it.

SEVEN GATES — all must pass for resurrection_candidate recommendation:

    Gate 1  SPC_TIER_WARM            Record is WARM tier (not COLD or DEEP)
    Gate 2  RESURRECTION_LIMIT       Attempts below limit (default 5)
    Gate 3  PHI9_ELIGIBILITY         Record is eligible at Φ9 phase window
    Gate 4  INVARIANT_CORE_PRESENT   Invariant core I_t is present and non-empty
    Gate 5  DRIFT_SIGNATURE_VALID    Drift signature present; no BREACH condition
    Gate 6  RESONANCE_COMPARATOR     Harmonic comparator: MATCH / MISMATCH / DEFER
    Gate 7  SYSTEM_CAPACITY          Runtime has sufficient phase resolution capacity

OUTCOMES:

    All 7 pass + Gate 6 MATCH  → resurrection_candidate
    Gate 7 fails               → ghost_loop_containment_required
    Resurrection limit exceeded→ deep_archive_seal
    BREACH condition present   → deep_archive_seal
    COLD / DEEP tier           → deep_archive_seal (no resurrection path)
    Gate 6 MISMATCH            → defer_until_next_phi9_window (not destruction)
    Any normal gate 1–5 fails  → defer_until_next_phi9_window

Settle window: 3.33 seconds (Harmonic Runtime Codex ChristPing window).
Resurrection limit default: 5 attempts.

Design sources:
  - AI.Web Forge/RMC Build Objective — Patch 269 spec
  - Symbolic Cold Storage Theory (AI.Web internal doc)
  - Harmonic Runtime Codex — ChristPing 3.33s settle window
  - PCI: Section 4.4-4.5 Collapse-Resurrection Pipeline
"""
from __future__ import annotations

import datetime as _dt
import hashlib  as _hl
import json     as _json
import math     as _math
from typing import Any

try:
    from rmc_engine_v1.measurement_kernel import clamp, stable_hash, stable_id
except Exception:
    def clamp(v: Any, low: float = 0.0, high: float = 1.0) -> float:  # type: ignore
        try: return max(float(low), min(float(high), float(v)))
        except: return float(low)
    def stable_hash(obj: Any) -> str:  # type: ignore
        return _hl.sha256(
            _json.dumps(obj, sort_keys=True, default=str).encode()
        ).hexdigest()
    def stable_id(prefix: str, obj: Any, n: int = 18) -> str:  # type: ignore
        return f"{prefix}_{_hl.sha256(str(obj).encode()).hexdigest()[:n]}"

# ── Identity ──────────────────────────────────────────────────────────────────
ENGINE_VERSION = "rmc_resurrection_engine_v1_patch269"
ENGINE_MODE    = "christping_7gate_resurrection_preview_read_only"

# ── Constants ─────────────────────────────────────────────────────────────────
RESURRECTION_LIMIT_DEFAULT = 5
SETTLE_WINDOW_SECONDS      = 3.33   # Harmonic Runtime Codex ChristPing window
PHI9_PHASE                 = 9      # Φ9 is the resurrection eligibility window

# SPC tiers
TIER_WARM = "WARM"
TIER_COLD = "COLD"
TIER_DEEP = "DEEP"
RESURRECTABLE_TIERS = frozenset({TIER_WARM})

# Gate IDs
GATE_1_SPC_TIER_WARM         = "gate_1_spc_tier_warm"
GATE_2_RESURRECTION_LIMIT    = "gate_2_resurrection_limit"
GATE_3_PHI9_ELIGIBILITY      = "gate_3_phi9_eligibility"
GATE_4_INVARIANT_CORE        = "gate_4_invariant_core_present"
GATE_5_DRIFT_SIGNATURE       = "gate_5_drift_signature_valid"
GATE_6_RESONANCE_COMPARATOR  = "gate_6_resonance_comparator"
GATE_7_SYSTEM_CAPACITY       = "gate_7_system_capacity"

ALL_GATES = (
    GATE_1_SPC_TIER_WARM,
    GATE_2_RESURRECTION_LIMIT,
    GATE_3_PHI9_ELIGIBILITY,
    GATE_4_INVARIANT_CORE,
    GATE_5_DRIFT_SIGNATURE,
    GATE_6_RESONANCE_COMPARATOR,
    GATE_7_SYSTEM_CAPACITY,
)

# Resurrection decision labels
DECISION_RESURRECTION_CANDIDATE      = "resurrection_candidate"
DECISION_DEFER_NEXT_PHI9             = "defer_until_next_phi9_window"
DECISION_DEEP_ARCHIVE_SEAL           = "deep_archive_seal"
DECISION_GHOST_LOOP_REQUIRED         = "ghost_loop_containment_required"
DECISION_NO_RESURRECTION_PATH        = "no_resurrection_path_tier_not_warm"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _utc() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()

def _d(v: Any) -> dict:
    return dict(v) if isinstance(v, dict) else {}

def _f(v: Any, default: float = 0.0) -> float:
    try: return float(v)
    except: return default

def _b(v: Any) -> bool:
    return bool(v)


# ── Gate evaluators ───────────────────────────────────────────────────────────

def _gate_1_spc_tier(record: dict) -> tuple[bool, str]:
    """Gate 1: Record must be WARM tier."""
    tier = str(record.get("tier") or record.get("spc_tier") or "").upper()
    if tier == TIER_WARM:
        return True, "spc_tier_warm_confirmed"
    if tier in (TIER_COLD, TIER_DEEP):
        return False, f"tier={tier}_no_resurrection_path"
    if not tier:
        return False, "tier_field_missing"
    return False, f"tier={tier}_unrecognized"


def _gate_2_resurrection_limit(record: dict) -> tuple[bool, str]:
    """Gate 2: Resurrection attempts must be below limit."""
    limit    = int(_f(record.get("resurrection_limit"), RESURRECTION_LIMIT_DEFAULT))
    attempts = int(_f(record.get("resurrection_attempts"), 0))
    if attempts >= limit:
        return False, f"resurrection_limit_exceeded_{attempts}_of_{limit}"
    return True, f"attempts_{attempts}_below_limit_{limit}"


def _gate_3_phi9_eligibility(record: dict) -> tuple[bool, str]:
    """Gate 3: Phase window must be Φ9 eligible.

    In preview mode we check whether the phase_at_collapse or phase_path
    contains a Φ9 marker, or whether the record explicitly sets phi9_eligible.
    Real runtime would check the current phase clock.
    """
    if _b(record.get("phi9_eligible")) or _b(record.get("resurrection_eligible")):
        return True, "phi9_eligibility_flag_set"
    phase_at = str(record.get("phase_at_collapse") or "")
    phase_path = list(record.get("phase_path") or [])
    # If phase_path contains Φ9, or phase_at_collapse is Φ9, eligible
    all_phases = phase_path + ([phase_at] if phase_at else [])
    has_phi9 = any(str(p).replace("Φ", "").strip() == "9" for p in all_phases)
    if has_phi9:
        return True, "phi9_phase_found_in_record"
    # Conservative preview: if no phase info, defer — not block
    if not all_phases:
        return False, "phi9_eligibility_undetermined_no_phase_data_defer"
    # Phase arc < 9 but record is WARM → eligible for future Φ9 window
    max_phase = max(
        (int(str(p).replace("Φ","").strip()) for p in all_phases
         if str(p).replace("Φ","").strip().isdigit()),
        default=0
    )
    if max_phase > 0:
        return True, f"phi9_window_eligible_max_phase_reached_{max_phase}"
    return False, "phi9_eligibility_cannot_confirm"


def _gate_4_invariant_core(record: dict) -> tuple[bool, str]:
    """Gate 4: Invariant core I_t must be present and non-empty."""
    core = record.get("invariant_core")
    if core is None:
        return False, "invariant_core_absent"
    if isinstance(core, dict) and not core:
        return False, "invariant_core_empty_dict"
    if isinstance(core, str) and not core.strip():
        return False, "invariant_core_empty_string"
    return True, "invariant_core_present"


def _gate_5_drift_signature(record: dict) -> tuple[bool, str]:
    """Gate 5: Drift signature must be present and no BREACH condition."""
    sig = record.get("drift_signature") or record.get("collapse_code")
    if not sig:
        return False, "drift_signature_absent"
    breach = _b(record.get("breach")) or _b(record.get("breach_condition"))
    if breach:
        return False, "breach_condition_detected_permanent_seal"
    return True, f"drift_signature_present_no_breach"


def _gate_6_resonance_comparator(
    record: dict,
    *,
    resonance_seed: float | None = None,
) -> tuple[bool, str, str]:
    """Gate 6: Resonance comparator — MATCH / MISMATCH / DEFER.

    Returns (passed, detail, comparator_verdict).

    In preview mode this is a deterministic hash comparison between:
      - the collapse signature of the record
      - the current resonance seed (from psi1_trace if available)

    MATCH  → passed=True,  resonance confirmed
    DEFER  → passed=False, non-destructive (try again next Φ9)
    MISMATCH → passed=False, significant divergence (try again next Φ9, not destruction)

    Note: MISMATCH routes to DEFER, not destruction. The record is
    never deleted for a resonance mismatch.
    """
    sig        = str(record.get("drift_signature") or record.get("collapse_code") or "")
    lineage    = str(record.get("lineage_ref") or "")
    icore      = record.get("invariant_core") or {}
    icore_hash = stable_hash(icore) if isinstance(icore, dict) else stable_hash({"v": str(icore)})

    if not sig:
        return False, "resonance_comparator_deferred_no_signature", "DEFER"

    if resonance_seed is not None:
        seed_str = str(resonance_seed)
    else:
        # Estimate from record content deterministically
        seed_str = stable_hash({
            "spc_record_id": record.get("spc_record_id"),
            "candidate_id":  record.get("source_candidate_id"),
        })[:16]

    # Preview mode comparator:
    # Real production comparator requires live RPMC harmonic math.
    # Preview uses a deterministic structural integrity check instead.
    #
    # MATCH conditions (tentative):
    #   - Record has valid signature + lineage + invariant core
    #   - No explicit mismatch flag
    #   - resonance_seed provided → compare fingerprint overlap
    #
    # MISMATCH / DEFER: explicit flag or signature anomaly

    # Check for explicit mismatch flag from a previous attempt
    if _b(record.get("resonance_mismatch_flag")):
        return False, "resonance_mismatch_flag_set_defer_not_destroy", "MISMATCH"

    if resonance_seed is not None:
        # External seed provided: do fingerprint comparison
        record_fp = _hl.sha256((sig + lineage + icore_hash).encode()).hexdigest()[:16]
        seed_fp   = _hl.sha256((str(resonance_seed) + sig[:8]).encode()).hexdigest()[:16]
        shared    = sum(1 for a, b in zip(record_fp, seed_fp) if a == b)
        score     = shared / max(len(record_fp), 1)
        if score >= 0.25:
            return True, f"resonance_match_score={score:.2f}", "MATCH"
        elif score >= 0.10:
            return False, f"resonance_mismatch_score={score:.2f}_defer_not_destroy", "MISMATCH"
        else:
            return False, f"resonance_insufficient_score={score:.2f}_defer", "DEFER"

    # No external seed: structural integrity check (preview baseline)
    # A complete, unbreached, unflagged WARM record is tentatively MATCH.
    if sig and lineage and icore_hash and not _b(record.get("resonance_mismatch_flag")):
        return True, "resonance_preview_structural_match_tentative", "MATCH"
    if sig and not lineage:
        return False, "resonance_incomplete_lineage_defer", "DEFER"
    return False, "resonance_insufficient_data_defer", "DEFER"


def _gate_7_system_capacity(
    record: dict,
    *,
    capacity_hint: float | None = None,
) -> tuple[bool, str]:
    """Gate 7: System capacity gate — can the runtime resolve this loop?

    Ghost loop doctrine: if this gate fails, the loop is NOT wrong.
    The system simply lacks sufficient phase resolution capacity.
    Failed Gate 7 → ghost_loop_containment_required, NOT SPC.

    capacity_hint: override capacity estimate (0–1). Default: 0.75 (preview baseline).
    """
    # Check explicit ghost_loop flag from previous routing
    ghost_flagged = (
        _b(record.get("ghost_loop_pressure_exceeded"))
        or _f(record.get("ghost_loop_pressure"), 0.0) > 0.30
        or _b(record.get("gate_failed")) and str(record.get("gate_failed")) == "7"
    )
    if ghost_flagged:
        return False, "gate_7_ghost_loop_pressure_exceeds_system_capacity"

    # Phase depth check: very deep phase arcs may exceed capacity
    phase_path = list(record.get("phase_path") or [])
    phase_depth = len(phase_path)
    if phase_depth > 12:
        return False, f"gate_7_phase_depth_{phase_depth}_exceeds_current_resolution_capacity"

    # Residue check: very high accumulated residue may exhaust capacity
    residue = _f(record.get("residue"), 0.0)
    if residue > 0.85:
        return False, f"gate_7_residue={residue:.3f}_exceeds_capacity_threshold_0.85"

    cap = _f(capacity_hint, 0.75)
    epsilon_s = _f(record.get("epsilon_s") or _d(record.get("invariant_core")).get("epsilon_s"), 0.0)
    # System capacity sufficient if cap > collapsed epsilon × correction factor
    required_capacity = clamp(epsilon_s * 1.2, 0.0, 1.0)
    if cap < required_capacity:
        return False, f"gate_7_capacity={cap:.2f}_insufficient_for_epsilon={epsilon_s:.3f}"

    return True, f"gate_7_system_capacity_sufficient_cap={cap:.2f}"


# ── Resonance summary ─────────────────────────────────────────────────────────

def _phi9_window_hint(record: dict) -> str:
    """Return a hint about when the next Φ9 window might be eligible."""
    attempts = int(_f(record.get("resurrection_attempts"), 0))
    limit    = int(_f(record.get("resurrection_limit"), RESURRECTION_LIMIT_DEFAULT))
    remaining = max(0, limit - attempts - 1)
    if remaining == 0:
        return "no_further_phi9_windows_limit_reached"
    return (
        f"defer_to_next_phi9_window_"
        f"{remaining}_attempts_remaining_of_{limit}_limit_"
        f"settle_window={SETTLE_WINDOW_SECONDS}s"
    )


# ── Public: boundary ──────────────────────────────────────────────────────────

def boundary() -> dict:
    return {
        "engine_version":   ENGINE_VERSION,
        "engine_mode":      ENGINE_MODE,
        "patch":            "269",
        "module":           "forge/rmc_engine_v1/resurrection_engine.py",
        "description":      (
            "ChristPing 7-gate resurrection eligibility evaluator. "
            "Read-only preview. Does NOT write, resurrect, or re-enter active runtime."
        ),
        "gates":            list(ALL_GATES),
        "resurrection_limit_default": RESURRECTION_LIMIT_DEFAULT,
        "settle_window_seconds":      SETTLE_WINDOW_SECONDS,
        "phi9_phase":                 PHI9_PHASE,
        "resurrectable_tiers":        list(RESURRECTABLE_TIERS),
        "decision_labels": {
            "all_gates_pass_resonance_match": DECISION_RESURRECTION_CANDIDATE,
            "gate_7_fails":                  DECISION_GHOST_LOOP_REQUIRED,
            "limit_exceeded_or_breach":      DECISION_DEEP_ARCHIVE_SEAL,
            "cold_deep_tier":                DECISION_NO_RESURRECTION_PATH,
            "normal_gate_fail":              DECISION_DEFER_NEXT_PHI9,
            "resonance_mismatch":            DECISION_DEFER_NEXT_PHI9,
        },
        "law": {
            "psi_prime_is_not_restoration": True,
            "psi_prime_is_transformed":     True,
            "resonance_mismatch_not_deletion": True,
            "gate_7_fail_is_ghost_not_wrong": True,
            "cold_deep_have_no_resurrection": True,
        },
        # Hard side-effect flags
        "read_only":               True,
        "writes_files":            False,
        "writes_rmc_memory":       False,
        "writes_identity_vault":   False,
        "mutates_spc_records":     False,
        "re_enters_active_runtime": False,
        "projection_allowed":      False,
        "manifest_compile_allowed": False,
        "echo_validation_allowed": False,
        "memory_write_allowed":    False,
        "stable_memory_entry":     False,
        "queries_chroma":          False,
        "calls_llm":               False,
        "executes_shell":          False,
    }


# ── Public: evaluate ──────────────────────────────────────────────────────────

def evaluate_resurrection(
    spc_record: dict,
    *,
    resonance_seed: float | None = None,
    capacity_hint: float | None = None,
    context: dict | None = None,
) -> dict:
    """Evaluate a SPC record against the 7 ChristPing gates.

    Parameters
    ----------
    spc_record:
        Output from spc_cold_storage.preview_spc_record() or any dict
        with SPC-compatible fields.
    resonance_seed:
        External resonance seed for Gate 6 comparator. If None, estimated
        deterministically from record content.
    capacity_hint:
        System capacity override (0–1). Default: 0.75 (preview baseline).
    context:
        Optional context dict (unused in preview; reserved for future).

    Returns a full resurrection evaluation object.
    Does NOT write, mutate, or activate anything.
    """
    rec = _d(spc_record)

    # Pre-check: tier determines resurrection eligibility before any gates
    tier = str(rec.get("tier") or rec.get("spc_tier") or "").upper()
    if tier in (TIER_COLD, TIER_DEEP):
        return _build_result(
            spc_record=rec,
            gates={g: {"passed": False, "detail": f"tier_{tier}_no_resurrection"} for g in ALL_GATES},
            failed_gates=list(ALL_GATES),
            decision=DECISION_NO_RESURRECTION_PATH,
            resurrection_allowed=False,
            recommended_route="deep_archive_seal",
            comparator_verdict="N/A",
            comparator_detail=f"tier={tier}_no_resurrection_path",
        )

    # Evaluate all seven gates in order
    gates: dict[str, dict] = {}
    failed_gates: list[str] = []
    ghost_loop_gate_7 = False
    deep_seal_required = False

    # Gate 1
    g1_pass, g1_detail = _gate_1_spc_tier(rec)
    gates[GATE_1_SPC_TIER_WARM] = {"passed": g1_pass, "detail": g1_detail}
    if not g1_pass:
        failed_gates.append(GATE_1_SPC_TIER_WARM)

    # Gate 2
    g2_pass, g2_detail = _gate_2_resurrection_limit(rec)
    gates[GATE_2_RESURRECTION_LIMIT] = {"passed": g2_pass, "detail": g2_detail}
    if not g2_pass:
        failed_gates.append(GATE_2_RESURRECTION_LIMIT)
        if "exceeded" in g2_detail:
            deep_seal_required = True

    # Gate 3
    g3_pass, g3_detail = _gate_3_phi9_eligibility(rec)
    gates[GATE_3_PHI9_ELIGIBILITY] = {"passed": g3_pass, "detail": g3_detail}
    if not g3_pass:
        failed_gates.append(GATE_3_PHI9_ELIGIBILITY)

    # Gate 4
    g4_pass, g4_detail = _gate_4_invariant_core(rec)
    gates[GATE_4_INVARIANT_CORE] = {"passed": g4_pass, "detail": g4_detail}
    if not g4_pass:
        failed_gates.append(GATE_4_INVARIANT_CORE)

    # Gate 5
    g5_pass, g5_detail = _gate_5_drift_signature(rec)
    gates[GATE_5_DRIFT_SIGNATURE] = {"passed": g5_pass, "detail": g5_detail}
    if not g5_pass:
        failed_gates.append(GATE_5_DRIFT_SIGNATURE)
        if "breach" in g5_detail:
            deep_seal_required = True

    # Gate 6: Resonance comparator
    g6_pass, g6_detail, g6_verdict = _gate_6_resonance_comparator(
        rec, resonance_seed=resonance_seed
    )
    gates[GATE_6_RESONANCE_COMPARATOR] = {
        "passed": g6_pass, "detail": g6_detail, "verdict": g6_verdict
    }
    if not g6_pass:
        failed_gates.append(GATE_6_RESONANCE_COMPARATOR)

    # Gate 7: System capacity (always evaluate; determines ghost vs defer)
    g7_pass, g7_detail = _gate_7_system_capacity(rec, capacity_hint=capacity_hint)
    gates[GATE_7_SYSTEM_CAPACITY] = {"passed": g7_pass, "detail": g7_detail}
    if not g7_pass:
        failed_gates.append(GATE_7_SYSTEM_CAPACITY)
        ghost_loop_gate_7 = True

    # ── Decision logic ──────────────────────────────────────────────────────
    all_passed = len(failed_gates) == 0

    if deep_seal_required:
        decision = DECISION_DEEP_ARCHIVE_SEAL
        recommended_route = "deep_archive_seal"
        resurrection_allowed = False
    elif ghost_loop_gate_7 and not deep_seal_required:
        # Gate 7 failure: ghost loop — system capacity, not content error
        decision = DECISION_GHOST_LOOP_REQUIRED
        recommended_route = "ghost_loop_containment_required"
        resurrection_allowed = False
    elif all_passed and g6_verdict == "MATCH":
        decision = DECISION_RESURRECTION_CANDIDATE
        recommended_route = "active_stack_candidate_as_psi_prime"
        resurrection_allowed = True
    elif all_passed and g6_verdict in ("MISMATCH", "DEFER"):
        # All structural gates pass but resonance not confirmed — defer
        decision = DECISION_DEFER_NEXT_PHI9
        recommended_route = "spc_warm_retain_defer_phi9"
        resurrection_allowed = False
    elif failed_gates:
        decision = DECISION_DEFER_NEXT_PHI9
        recommended_route = "spc_warm_retain_defer_phi9"
        resurrection_allowed = False
    else:
        decision = DECISION_DEFER_NEXT_PHI9
        recommended_route = "spc_warm_retain_defer_phi9"
        resurrection_allowed = False

    return _build_result(
        spc_record=rec,
        gates=gates,
        failed_gates=failed_gates,
        decision=decision,
        resurrection_allowed=resurrection_allowed,
        recommended_route=recommended_route,
        comparator_verdict=g6_verdict,
        comparator_detail=g6_detail,
    )


def _build_result(
    spc_record: dict,
    gates: dict,
    failed_gates: list,
    decision: str,
    resurrection_allowed: bool,
    recommended_route: str,
    comparator_verdict: str,
    comparator_detail: str,
) -> dict:
    rec = spc_record
    attempts = int(_f(rec.get("resurrection_attempts"), 0))
    limit    = int(_f(rec.get("resurrection_limit"), RESURRECTION_LIMIT_DEFAULT))

    psi_prime: dict | None = None
    if resurrection_allowed:
        psi_prime = {
            "source_spc_record_id":  rec.get("spc_record_id"),
            "source_candidate_id":   rec.get("source_candidate_id"),
            "phase_at_collapse":     rec.get("phase_at_collapse"),
            "invariant_core":        rec.get("invariant_core"),
            "collapse_history_ref":  rec.get("lineage_ref"),
            "resurrection_attempt":  attempts + 1,
            "psi_prime_note": (
                "ψ′ is a transformed identity constituted by collapse history. "
                "Not restoration. Not repair. The loop returns changed by what collapse revealed."
            ),
            "requires_operator_approval_to_activate": True,
            "read_only_candidate": True,
        }

    return {
        "status":               "EVALUATED",
        "evaluated_at_utc":     _utc(),
        "resurrection_decision": decision,
        "resurrection_allowed":  resurrection_allowed,
        "recommended_route":     recommended_route,
        "psi_prime_candidate":   psi_prime,
        "gates":                 gates,
        "failed_gates":          failed_gates,
        "gates_passed_count":    len(ALL_GATES) - len(failed_gates),
        "gates_total":           len(ALL_GATES),
        "resonance_comparator": {
            "verdict": comparator_verdict,
            "detail":  comparator_detail,
            "note":    "MISMATCH routes to DEFER, not deletion. Record preserved.",
        },
        "resurrection_attempts": attempts,
        "resurrection_limit":    limit,
        "next_phi9_window_hint": _phi9_window_hint(rec),
        "settle_window_seconds": SETTLE_WINDOW_SECONDS,
        "spc_record_id":         rec.get("spc_record_id"),
        "source_candidate_id":   rec.get("source_candidate_id"),
        "tier":                  rec.get("tier", "UNKNOWN"),
        # Hard constraints — always False in preview
        "read_only":              True,
        "writes_files":           False,
        "writes_rmc_memory":      False,
        "projection_allowed":     False,
        "manifest_compile_allowed": False,
        "re_enters_active_runtime": False,
        "stable_memory_entry":    False,
        "mutates_spc_records":    False,
        "engine_version":         ENGINE_VERSION,
    }
