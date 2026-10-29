"""Deep Pipeline Integration Preflight — forge/rmc_engine_v1/deep_pipeline_preflight.py

Patch 270 — RMC Deep Pipeline Integration Preflight

Read-only integration readiness map. Shows how the deep architecture modules
connect into the RMC pipeline. Does NOT replace the live pipeline. Does NOT
activate any deep module. Inspection and dry-run contract checking only.

Planned integration route:
    Input / trace
    → Memory Recall (M_t)
    → Phase Parser (Φ_t)
    → Drift Engine (structural) OR ProtoForge2 Drift Adapter (if LIVE)
    → Candidate Generator (C_t)
    → Evolutionary Drift Explorer (E_t)
    → Coherence Scorer (S_t)
    → Containment Router  ← deep architecture gate
    ├── active_stack → χ(t) Correction Gate (if required)
    │                → Manifest Compiler (μ_t)
    │                → Output Renderer (R_t)
    │                → Echo Validator (V_t)
    │                → Memory Writer (W_t, dry-run)
    │                → Promotion Path (gated)
    ├── correction_queue → Correction/Naming only; re-score before manifest
    ├── spc_cold_storage → SPC module (Patch 266)
    ├── dream_state     → Dream State Quarantine (Patch 266)
    ├── drift_archive   → Drift Archive (Patch 266)
    └── ghost_loop      → Ghost Loop Containment (Patch 266)
                        → Resurrection Engine (Patch 269, if present)

Hard boundaries (immutable):
    1. containment_router must sit before manifest_compiler
    2. sealed routes cannot reach manifest_compiler
    3. χ(t) gate cannot directly project
    4. resurrection_preview cannot directly activate runtime
    5. ProtoForge2 adapter cannot replace structural drift until LIVE + proven
    6. memory_write cannot occur before echo_validation
    7. stable_memory_promotion remains gated

Design source: AI.Web Forge/RMC Build Objective — Patch 270 spec
"""
from __future__ import annotations

import datetime as _dt
import importlib as _imp
import json      as _json
from typing import Any

try:
    from rmc_engine_v1.measurement_kernel import stable_hash
except Exception:
    import hashlib as _hl
    def stable_hash(obj: Any) -> str:  # type: ignore
        return _hl.sha256(_json.dumps(obj, sort_keys=True, default=str).encode()).hexdigest()

ENGINE_VERSION = "rmc_deep_pipeline_preflight_v1_patch270R"
ENGINE_MODE    = "deep_pipeline_integration_readiness_map_read_only"

# ── Pipeline stage registry ───────────────────────────────────────────────────
# Each entry: (stage_id, description, module_path, required_for_activation)
PIPELINE_STAGES = [
    ("memory_recall",           "M_t — Memory Recall",
     "rmc_engine_v1.memory_recaller",             True),
    ("phase_parser",            "Φ_t — Phase Parser",
     "rmc_engine_v1.phase_parser",                True),
    ("drift_engine",            "D_t — Structural Drift Analyzer",
     "rmc_engine_v1.drift_engine",                True),
    ("protoforge2_connector",   "PF2 — ProtoForge2 Drift Adapter",
     "rmc_engine_v1.protoforge2_drift_connector", False),   # optional upgrade
    ("candidate_generator",     "C_t — Candidate Generator",
     "rmc_engine_v1.candidate_generator",         True),
    ("evolutionary_drift",      "E_t — Evolutionary Drift Explorer",
     "rmc_engine_v1.evolutionary_drift_explorer", True),
    ("coherence_scorer",        "S_t — Coherence Scorer",
     "rmc_engine_v1.coherence_math",              True),
    ("containment_router",      "Containment Router (Patch 265R)",
     "rmc_engine_v1.containment_router",          True),    # deep architecture gate
    ("chi_correction_gate",     "χ(t) — Correction Gate (Patch 267R)",
     "rmc_engine_v1.chi_correction_gate",         True),
    ("spc_cold_storage",        "SPC Cold Storage (Patch 266R)",
     "rmc_engine_v1.spc_cold_storage",            True),
    ("drift_archive",           "Drift Archive (Patch 266R)",
     "rmc_engine_v1.drift_archive",               True),
    ("dream_state_quarantine",  "Dream State Quarantine (Patch 266R)",
     "rmc_engine_v1.dream_state_quarantine",      True),
    ("ghost_loop_containment",  "Ghost Loop Containment (Patch 266R)",
     "rmc_engine_v1.ghost_loop_containment",      True),
    ("resurrection_engine",     "Resurrection Engine (Patch 269)",
     "rmc_engine_v1.resurrection_engine",         False),   # Patch 269 — optional if installed
    ("manifest_compiler",       "μ_t — Manifest Compiler",
     "rmc_engine_v1.manifest_compiler",           True),
    ("output_renderer",         "R_t — Output Renderer",
     "rmc_engine_v1.output_renderer",             True),
    ("echo_validator",          "V_t — Echo Validator",
     "rmc_engine_v1.echo_validator",              True),
    ("memory_writer",           "W_t — Memory Writer (dry-run)",
     "rmc_engine_v1.memory_writer",               True),
    ("promotion_path",          "Promotion Path (gated)",
     "rmc_engine_v1.promotion_path",              True),
]

# ── Hard boundary declarations ────────────────────────────────────────────────
HARD_BOUNDARIES = [
    {
        "id":    "containment_before_manifest",
        "law":   "containment_router MUST sit before manifest_compiler in pipeline order",
        "check": "containment_router stage < manifest_compiler stage",
        "violation": "manifest compile from sealed route",
        "enforced_by": "containment_router.assert_not_sealed()",
    },
    {
        "id":    "sealed_routes_no_manifest",
        "law":   "SPC/dream/archive/ghost routes cannot reach manifest_compiler",
        "check": "route not in SEALED_ROUTES when entering manifest_compiler",
        "violation": "projection from containment state",
        "enforced_by": "containment_router.SEALED_ROUTES",
    },
    {
        "id":    "chi_t_no_direct_projection",
        "law":   "χ(t) correction gate output cannot directly project",
        "check": "chi_correction_gate.projection_allowed is always False",
        "violation": "chi_t projection bypass",
        "enforced_by": "chi_correction_gate.boundary().projection_allowed == False",
    },
    {
        "id":    "resurrection_no_runtime_activation",
        "law":   "resurrection_preview cannot directly activate runtime",
        "check": "resurrection_engine.re_enters_active_runtime is always False",
        "violation": "unsanctioned loop re-entry",
        "enforced_by": "resurrection_engine.boundary().re_enters_active_runtime == False",
    },
    {
        "id":    "pf2_no_replace_structural_drift",
        "law":   "ProtoForge2 adapter cannot replace structural drift until LIVE + proven",
        "check": "protoforge2_drift_connector.adapter_mode == LIVE before drift_engine bypass",
        "violation": "unproven drift replacement",
        "enforced_by": "protoforge2_drift_connector adapter_mode check",
    },
    {
        "id":    "memory_write_after_echo",
        "law":   "memory_write cannot occur before echo_validation",
        "check": "echo_validator stage precedes memory_writer in all active_stack paths",
        "violation": "unvalidated memory write",
        "enforced_by": "gated_memory_writer approval token requires echo receipt",
    },
    {
        "id":    "stable_memory_gated",
        "law":   "stable_memory_promotion remains gated by promotion_path token",
        "check": "promotion_path requires APPROVE_RMC_PROMOTION token",
        "violation": "ungated stable memory entry",
        "enforced_by": "promotion_path.boundary().approval_token == APPROVE_RMC_PROMOTION",
    },
]

# ── Forbidden shortcuts ───────────────────────────────────────────────────────
FORBIDDEN_SHORTCUTS = [
    "skip_containment_router_and_go_directly_to_manifest",
    "call_manifest_compiler_with_spc_routed_candidate",
    "project_from_chi_t_gate_output",
    "instantiate_drift_monitor_in_http_preview",
    "write_stable_memory_without_promotion_token",
    "write_memory_without_echo_validation",
    "resurrect_loop_without_operator_approval",
    "route_ghost_loop_to_spc_instead_of_ghost_containment",
    "bypass_drift_engine_without_live_pf2_proof",
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _utc() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()

def _try_import(module_path: str) -> tuple[bool, str | None]:
    """Try to import a module. Returns (available, version_or_error)."""
    try:
        mod = _imp.import_module(module_path)
        ver = getattr(mod, "ENGINE_VERSION", None) or getattr(mod, "VERSION", None)
        return True, str(ver) if ver else "imported_no_version"
    except ImportError as e:
        return False, f"not_installed: {str(e)[:80]}"
    except Exception as e:
        return False, f"import_error: {str(e)[:80]}"


def _nested_get(obj: Any, dotted_path: str) -> Any:
    """Return a nested dict value using a dot-separated path.

    This keeps preflight checks aligned with the actual boundary contracts.
    Some modules expose law flags under nested structures such as
    routing_law.sealed_routes_cannot_project rather than as flat top-level
    fields. Missing paths return None so the caller can report a precise
    failed boundary verification instead of silently treating absence as OK.
    """
    cur = obj
    for part in dotted_path.split("."):
        if isinstance(cur, dict) and part in cur:
            cur = cur[part]
        else:
            return None
    return cur


def _check_boundary(module_path: str, flag: str, expected: Any) -> tuple[bool, str]:
    """Check a boundary flag on a module's boundary() function.

    Supports both flat fields (projection_allowed) and nested law fields
    (routing_law.sealed_routes_cannot_project). This fixes Patch 270's
    false failure where containment_router correctly exposed the law under
    routing_law but the preflight checker looked only for a flat
    projection_allowed field.
    """
    try:
        mod = _imp.import_module(module_path)
        fn  = getattr(mod, "boundary", None)
        if fn is None:
            return False, "no_boundary_function"
        b   = fn()
        actual = _nested_get(b, flag)
        ok   = (actual == expected)
        return ok, f"{flag}={actual!r}_expected={expected!r}"
    except Exception as e:
        return False, f"boundary_check_error: {str(e)[:60]}"


# ── Public: boundary ──────────────────────────────────────────────────────────

def boundary() -> dict:
    return {
        "engine_version":    ENGINE_VERSION,
        "engine_mode":       ENGINE_MODE,
        "patch":             "270R",
        "module":            "forge/rmc_engine_v1/deep_pipeline_preflight.py",
        "description":       (
            "Integration readiness map. Inspects module availability and pipeline "
            "contract compliance. Does NOT activate any module or replace the live pipeline."
        ),
        "hard_boundaries_count": len(HARD_BOUNDARIES),
        "forbidden_shortcuts_count": len(FORBIDDEN_SHORTCUTS),
        "pipeline_stage_count": len(PIPELINE_STAGES),
        "read_only":         True,
        "writes_files":      False,
        "writes_rmc_memory": False,
        "writes_identity_vault": False,
        "activates_pipeline": False,
        "queries_chroma":    False,
        "calls_llm":         False,
        "executes_shell":    False,
    }


# ── Public: preflight ─────────────────────────────────────────────────────────

def run_preflight(
    *,
    _override_available: set[str] | None = None,  # for unit tests
) -> dict:
    """
    Run the deep pipeline integration preflight.

    Inspects all module availability, verifies hard boundaries, and returns
    an integration readiness report.

    _override_available: inject a set of module paths treated as available
                         (unit tests only — allows testing without real installs).
    """
    installed: dict[str, dict]  = {}
    missing:   list[str]        = []

    stage_reports = []
    for (stage_id, description, module_path, required) in PIPELINE_STAGES:
        if _override_available is not None:
            available = module_path in _override_available
            version   = "test_override" if available else f"not_installed_test_mode"
        else:
            available, version = _try_import(module_path)

        entry = {
            "stage_id":     stage_id,
            "description":  description,
            "module":       module_path,
            "available":    available,
            "version":      version,
            "required":     required,
        }
        if available:
            installed[stage_id] = entry
        else:
            if required:
                missing.append(stage_id)
            entry["status"] = "missing_optional" if not required else "missing_required"
        stage_reports.append(entry)

    # Required deep modules for activation_ready
    REQUIRED_DEEP = {
        "containment_router", "chi_correction_gate",
        "spc_cold_storage", "drift_archive",
        "dream_state_quarantine", "ghost_loop_containment",
    }
    REQUIRED_CORE = {
        "drift_engine", "coherence_scorer", "manifest_compiler",
        "output_renderer", "echo_validator", "memory_writer", "promotion_path",
    }
    ALL_REQUIRED = REQUIRED_DEEP | REQUIRED_CORE

    missing_required = [m for m in missing
                        if any(s[0] == m for s in PIPELINE_STAGES if s[3])]

    activation_ready = len(missing_required) == 0
    blocking_reasons: list[str] = []
    if not activation_ready:
        blocking_reasons = [
            f"required_module_missing: {m}"
            for m in missing_required
        ]

    # Check hard boundary compliance on installed modules
    boundary_checks = []
    for hb in HARD_BOUNDARIES:
        boundary_checks.append({
            "id":          hb["id"],
            "law":         hb["law"],
            "check":       hb["check"],
            "enforced_by": hb["enforced_by"],
            "status":      "declared_not_live_checked",
        })

    # Verify key boundary flags on actually-installed deep modules.
    # Use the real module contracts. Containment Router declares projection
    # safety under routing_law, not as a flat projection_allowed flag.
    boundary_verifications: list[dict] = []
    for (mod_path, flag, expected) in [
        ("rmc_engine_v1.containment_router",     "routing_law.sealed_routes_cannot_project",          True),
        ("rmc_engine_v1.containment_router",     "routing_law.only_active_stack_may_reach_manifest",  True),
        ("rmc_engine_v1.chi_correction_gate",    "projection_allowed",                               False),
        ("rmc_engine_v1.spc_cold_storage",       "projection_allowed",                               False),
        ("rmc_engine_v1.ghost_loop_containment", "active_runtime_reentry",                           False),
    ]:
        if _override_available is not None:
            avail = mod_path in _override_available
        else:
            avail, _ = _try_import(mod_path)
        if avail:
            ok, detail = (True, "test_override") if _override_available else _check_boundary(mod_path, flag, expected)
            boundary_verifications.append({
                "module": mod_path, "flag": flag, "expected": expected,
                "passed": ok, "detail": detail,
            })

    boundary_failures = [v for v in boundary_verifications if not v.get("passed")]
    if boundary_failures:
        activation_ready = False
        blocking_reasons.extend(
            f"boundary_verification_failed: {v['module']}::{v['flag']}::{v['detail']}"
            for v in boundary_failures
        )

    # Integration plan (narrative)
    integration_plan = [
        {"step": 1, "action": "confirm_all_required_modules_installed"},
        {"step": 2, "action": "verify_containment_router_sits_before_manifest"},
        {"step": 3, "action": "connect_containment_router_output_to_spc_dream_archive_ghost"},
        {"step": 4, "action": "wire_chi_correction_gate_into_correction_naming_engine"},
        {"step": 5, "action": "connect_resurrection_engine_to_spc_warm_tier_records"},
        {"step": 6, "action": "verify_pf2_adapter_mode_is_LIVE_before_drift_engine_bypass"},
        {"step": 7, "action": "end_to_end_dry_run_with_synthetic_candidate"},
        {"step": 8, "action": "operator_approval_for_first_real_memory_promotion"},
    ]

    return {
        "status":              "PREFLIGHT_COMPLETE",
        "preflight_at_utc":    _utc(),
        "installed_modules":   installed,
        "missing_modules":     missing_required,
        "all_missing":         missing,         # includes optional
        "pipeline_stages":     stage_reports,
        "hard_boundaries":     boundary_checks,
        "boundary_verifications": boundary_verifications,
        "boundary_verification_failures": boundary_failures,
        "boundary_verifications_passed": len(boundary_failures) == 0,
        "activation_ready":    activation_ready,
        "blocking_reasons":    blocking_reasons,
        "integration_plan":    integration_plan,
        "forbidden_shortcuts": FORBIDDEN_SHORTCUTS,
        "deep_modules_required": sorted(REQUIRED_DEEP),
        "core_modules_required": sorted(REQUIRED_CORE),
        # Hard side-effect flags
        "read_only":            True,
        "writes_files":         False,
        "writes_rmc_memory":    False,
        "writes_identity_vault": False,
        "activates_pipeline":   False,
        "queries_chroma":       False,
        "calls_llm":            False,
        "executes_shell":       False,
        "engine_version":       ENGINE_VERSION,
        "boundary":             boundary(),
    }
