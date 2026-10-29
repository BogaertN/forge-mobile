"""ProtoForge2 Drift Connector v2 — forge/rmc_engine_v1/protoforge2_drift_connector.py

Patch 268S3 — ProtoForge2 Drift Adapter Signature Fix

Replaces the 268R single-root scan with multi-path candidate discovery,
SHA256-confirmed classification, ranked safe-callable selection, and
normalized RMC drift schema output.

AUDIT FINDINGS (Patch 268S):

  Full drift engine — two identical copies:
    /home/nic/aiweb/runtime_wrappers/protoforge_sandbox_substrate_v0/
        laws/protoforge_memory_drift_reference.py
    /home/nic/protoforge/src/protoforge/memory/drift.py
    SHA256: 5488f672c979f79c2adff23057063ffed4a1c9a11a8812f6db513a16f18c87c4
    Classification: full_doctrine_reference / live_protoforge_package_copy
    Features: DriftMonitor, symbolic_entropy, chi_t_override, check_and_firewall,
              DriftCircuitBreaker, DriftTaxonomy, WeightedMinHash, FFT fallback (~550 lines)
    NOT called by default: DriftMonitor.__init__() creates storage/logs/drift.log
    and sets up a RotatingFileHandler on instantiation.

  Safe RMC arbitrator — preferred first callable (rank 1):
    /home/nic/aiweb/runtime_wrappers/protoforge_sandbox_substrate_v0/
        laws/aiweb_rmc_drift_detector_reference.py
    SHA256: 648a35b3ae23da8d975d7ffabe263a33a7544baf2aabfc7476937407e6977b6d
    Classification: rmc_safe_arbitrator
    Exposes DriftArbitrator.evaluate() — stdlib-only, deterministic, read-only (~336 lines)

  Sandbox bridge — second safe fallback (rank 2):
    /home/nic/aiweb/runtime_wrappers/protoforge_sandbox_substrate_v0/
        protoforge_sandbox/drift_bridge.py
    SHA256: e376b274325bb3a3591e6e76e94882a0304c1211ec0e068fde18b844dc88c0fe
    Classification: sandbox_drift_bridge
    Exposes DriftBridge.evaluate() — safe/read-only (~134 lines)

  Legacy backend — REJECTED:
    /home/nic/protoforge/backend/drift.py
    SHA256: d128249b40d0dd84f0c02cfacde75acaa25493368b31d876f587e37ab065545a
    Classification: legacy_runtime_rejected
    Reason: writes_to_logs_and_uses_random_entropy

BOUNDARY (corrected from 268R — replaces no_arbitrary_exec: true):
  no_shell:                          True
  no_subprocess:                     True
  no_browser_selected_import_path:   True
  controlled_local_import_only:      True
  default_http_preview_read_only:    True
  full_drift_monitor_not_called_by_default: True
  exec_module_note: exec_module() is used internally by Python's importlib
                    to execute a module spec. This is disclosed here.

Design source: AI.Web Forge/RMC Build Objective — Patch 268S spec
"""
from __future__ import annotations

import datetime as _dt
import hashlib  as _hl
import importlib.util as _iutil
import inspect  as _inspect
import json     as _json
import os       as _os
import sys      as _sys
from pathlib import Path as _Path
from typing import Any

try:
    from rmc_engine_v1.measurement_kernel import clamp, stable_hash
except Exception:
    def clamp(v: Any, low: float = 0.0, high: float = 1.0) -> float:  # type: ignore
        try: return max(float(low), min(float(high), float(v)))
        except: return float(low)
    def stable_hash(obj: Any) -> str:  # type: ignore
        return _hl.sha256(_json.dumps(obj, sort_keys=True, default=str).encode()).hexdigest()

# ── Identity ──────────────────────────────────────────────────────────────────
ENGINE_VERSION = "rmc_protoforge2_drift_connector_v2_patch268S3"
ENGINE_MODE    = "protoforge2_drift_candidate_adapter"

# ── Audit-confirmed SHA256 hashes ─────────────────────────────────────────────
FULL_ENGINE_SHA256     = "5488f672c979f79c2adff23057063ffed4a1c9a11a8812f6db513a16f18c87c4"
RMC_ARBITRATOR_SHA256  = "648a35b3ae23da8d975d7ffabe263a33a7544baf2aabfc7476937407e6977b6d"
SANDBOX_BRIDGE_SHA256  = "e376b274325bb3a3591e6e76e94882a0304c1211ec0e068fde18b844dc88c0fe"
LEGACY_REJECTED_SHA256 = "d128249b40d0dd84f0c02cfacde75acaa25493368b31d876f587e37ab065545a"

# ── Roots ─────────────────────────────────────────────────────────────────────
DEFAULT_PF2_ROOT   = _Path("/home/nic/aiweb/runtime_wrappers/protoforge_sandbox_substrate_v0")
_SUBSTRATE_SCAN_NAMES = ("memory-drift.py", "memory_drift.py", "drift.py", "memory/drift.py")

# ── Candidate registry ────────────────────────────────────────────────────────
# rank=1 → preferred safe callable; rank=2 → second fallback; rank=None → not safe by default
_DEFAULT_CANDIDATES: list[dict] = [
    {
        "path":            _Path("/home/nic/aiweb/runtime_wrappers/protoforge_sandbox_substrate_v0/laws/aiweb_rmc_drift_detector_reference.py"),
        "classification":  "rmc_safe_arbitrator",
        "safe_by_default": True,
        "has_log_side_effects": False,
        "callable_class":  "DriftArbitrator",
        "callable_method": "evaluate",
        "rank":            1,
        "expected_sha256": RMC_ARBITRATOR_SHA256,
        "description":     "RMC-compatible safe arbitrator. DriftArbitrator.evaluate() is stdlib-only, deterministic, read-only. ~336 lines.",
    },
    {
        "path":            _Path("/home/nic/aiweb/runtime_wrappers/protoforge_sandbox_substrate_v0/protoforge_sandbox/drift_bridge.py"),
        "classification":  "sandbox_drift_bridge",
        "safe_by_default": True,
        "has_log_side_effects": False,
        "callable_class":  "DriftBridge",
        "callable_method": "evaluate",
        "rank":            2,
        "expected_sha256": SANDBOX_BRIDGE_SHA256,
        "description":     "Sandbox bridge. DriftBridge.evaluate() is safe/read-only. ~134 lines.",
    },
    {
        "path":            _Path("/home/nic/aiweb/runtime_wrappers/protoforge_sandbox_substrate_v0/laws/protoforge_memory_drift_reference.py"),
        "classification":  "full_doctrine_reference",
        "safe_by_default": False,
        "has_log_side_effects": True,
        "callable_class":  "DriftMonitor",
        "callable_method": "check_and_firewall",
        "rank":            None,
        "expected_sha256": FULL_ENGINE_SHA256,
        "description":     "Full ProtoForge2 doctrine reference (~550 lines). DriftMonitor not called by default — __init__ creates storage/logs/drift.log and sets up RotatingFileHandler.",
        "rejection_for_default": "instantiation_creates_log_files_and_rotating_handler",
    },
    {
        "path":            _Path("/home/nic/protoforge/src/protoforge/memory/drift.py"),
        "classification":  "live_protoforge_package_copy",
        "safe_by_default": False,
        "has_log_side_effects": True,
        "callable_class":  "DriftMonitor",
        "callable_method": "check_and_firewall",
        "rank":            None,
        "expected_sha256": FULL_ENGINE_SHA256,
        "description":     "Live ProtoForge package copy. Hash-confirmed identical to doctrine reference. DriftMonitor not called by default.",
        "rejection_for_default": "instantiation_creates_log_files_and_rotating_handler",
    },
    {
        "path":            _Path("/home/nic/protoforge/backend/drift.py"),
        "classification":  "legacy_runtime_rejected",
        "safe_by_default": False,
        "has_log_side_effects": True,
        "callable_class":  None,
        "callable_method": None,
        "rank":            None,
        "expected_sha256": LEGACY_REJECTED_SHA256,
        "description":     "Legacy ProtoForge backend drift. REJECTED: writes logs, uses random entropy.",
        "rejection_reason": "writes_to_logs_and_uses_random_entropy",
    },
]

# ── Probe payload ─────────────────────────────────────────────────────────────
_PROBE_PAYLOAD: dict = {
    "text":       "rmc_safe_probe_patch268s",
    "phase_path": ["Φ1", "Φ3"],
    "epsilon_s":  0.15,
    "dry_run":    True,
    "cmd":        "probe",
    "payload":    {"type": "rmc_probe", "source": "forge_connector_268S"},
}


# ── Private helpers ───────────────────────────────────────────────────────────

def _utc() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()

def _f(v: Any, d: float = 0.0) -> float:
    try: return float(v)
    except: return d

def _file_sha256(path: _Path) -> str:
    try:
        h = _hl.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()
    except Exception:
        return "sha256_unavailable"

def _is_suspicious_path(path: _Path) -> bool:
    """Refuse paths outside expected directories."""
    try:
        resolved = path.resolve()
        allowed = [_Path("/home"), _Path("/tmp"), DEFAULT_PF2_ROOT]
        return not any(str(resolved).startswith(str(r)) for r in allowed)
    except Exception:
        return True

def _is_safe_function_name(name: str) -> bool:
    nl = name.lower()
    unsafe = ("write", "delete", "remove", "shell", "exec", "run", "spawn",
               "kill", "commit", "deploy", "upload", "send", "post", "push")
    return not any(p in nl for p in unsafe)

def _source_has_log_side_effects(path: _Path) -> bool:
    """Quick source scan without importing — checks first 4 KB for logging setup."""
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            head = f.read(4096)
        return ("RotatingFileHandler" in head or
                "drift_log.parent.mkdir" in head or
                "setup_logging" in head or
                "logging.getLogger" in head and "RotatingFile" in head)
    except Exception:
        return False

def _classify_by_hash(sha256: str) -> str | None:
    """Return canonical classification from known SHA256."""
    if sha256 == FULL_ENGINE_SHA256:     return "full_engine_confirmed"
    if sha256 == RMC_ARBITRATOR_SHA256:  return "rmc_safe_arbitrator_confirmed"
    if sha256 == SANDBOX_BRIDGE_SHA256:  return "sandbox_bridge_confirmed"
    if sha256 == LEGACY_REJECTED_SHA256: return "legacy_rejected_confirmed"
    return None

def _safe_import(path: _Path, module_name: str) -> tuple[Any, str | None]:
    """
    Import a module via importlib. Handles hyphen filenames.
    exec_module() is used by Python's importlib — this is disclosed.
    Returns (module, error_string).  Never raises.
    """
    try:
        spec = _iutil.spec_from_file_location(module_name, path)
        if spec is None or spec.loader is None:
            return None, "spec_from_file_location returned None"
        mod = _iutil.module_from_spec(spec)

        # Professional-production import fix (Patch 268S2):
        # dataclasses and some decorators resolve cls.__module__ through
        # sys.modules during module execution.  importlib.module_from_spec()
        # does not always insert the module automatically before exec_module(),
        # which can raise: "'NoneType' object has no attribute '__dict__'".
        # We register the module for the duration of execution, matching normal
        # import semantics, while preserving any previous entry.
        previous = _sys.modules.get(module_name)
        _sys.modules[module_name] = mod
        try:
            spec.loader.exec_module(mod)   # type: ignore[attr-defined]
        except Exception:
            if previous is None:
                _sys.modules.pop(module_name, None)
            else:
                _sys.modules[module_name] = previous
            raise
        return mod, None
    except Exception as exc:
        return None, str(exc)[:300]


# ── Candidate scanning ────────────────────────────────────────────────────────

def _scan_one(cand: dict) -> dict:
    """Inspect a single candidate definition. Read-only — does NOT import."""
    path = cand.get("path")
    if not isinstance(path, _Path):
        path = _Path(str(path))

    base: dict = {
        "path":                  str(path),
        "classification":        cand.get("classification", "unknown"),
        "safe_by_default":       bool(cand.get("safe_by_default", False)),
        "has_log_side_effects":  bool(cand.get("has_log_side_effects", True)),
        "callable_class":        cand.get("callable_class"),
        "callable_method":       cand.get("callable_method"),
        "rank":                  cand.get("rank"),
        "expected_sha256":       cand.get("expected_sha256"),
        "rejection_reason":      cand.get("rejection_reason") or cand.get("rejection_for_default"),
        "description":           cand.get("description", ""),
        "exists":                False,
        "actual_sha256":         None,
        "hash_matches_expected": None,
        "hash_classification":   None,
        "log_side_effects_scanned": False,
    }

    if not path.exists():
        return base

    base["exists"] = True
    sha = _file_sha256(path)
    base["actual_sha256"] = sha

    expected = cand.get("expected_sha256")
    if expected:
        base["hash_matches_expected"] = (sha == expected)

    base["hash_classification"] = _classify_by_hash(sha)

    # Quick source scan for log side effects (no import)
    base["log_side_effects_scanned"] = _source_has_log_side_effects(path)

    # If the actual hash is the legacy-rejected hash, override classification
    if sha == LEGACY_REJECTED_SHA256:
        base["classification"] = "legacy_runtime_rejected"
        base["rejection_reason"] = "writes_to_logs_and_uses_random_entropy"
        base["safe_by_default"] = False
        base["rank"] = None

    # If hash confirms a full engine, ensure safe_by_default is False
    if sha == FULL_ENGINE_SHA256:
        base["safe_by_default"] = False
        base["has_log_side_effects"] = True

    return base


def _run_full_scan(
    candidates: list[dict],
    pf2_root: _Path | None = None,
) -> dict:
    """
    Scan all candidates and do a substrate-root fallback scan.
    Returns structured result dict.  Read-only throughout.
    """
    root = _Path(pf2_root or DEFAULT_PF2_ROOT).expanduser().resolve()

    scanned: list[dict] = [_scan_one(c) for c in candidates]

    # Substrate-root scan (legacy 268R discovery, kept for backward compat)
    substrate_hits: list[dict] = []
    if root.exists() and root.is_dir():
        for name in _SUBSTRATE_SCAN_NAMES:
            p = root / name
            if p.exists():
                sha = _file_sha256(p)
                substrate_hits.append({
                    "path":           str(p),
                    "sha256":         sha,
                    "classification": _classify_by_hash(sha) or "substrate_root_legacy_scan",
                    "safe_by_default": sha not in (FULL_ENGINE_SHA256, LEGACY_REJECTED_SHA256),
                })

    # Partition results
    safe_candidates = sorted(
        [c for c in scanned if c["exists"]
         and c["safe_by_default"]
         and c.get("rank") is not None],
        key=lambda x: x["rank"],
    )
    full_engine     = [c for c in scanned if c["exists"]
                       and c.get("actual_sha256") == FULL_ENGINE_SHA256]
    rejected        = [c for c in scanned if c["exists"]
                       and c.get("actual_sha256") == LEGACY_REJECTED_SHA256]
    not_found       = [c for c in scanned if not c["exists"]]

    # Identical-hash pairs (confirms law-ref == live-package-copy)
    hash_to_paths: dict[str, list[str]] = {}
    for c in scanned:
        sha = c.get("actual_sha256")
        if c["exists"] and sha and sha != "sha256_unavailable":
            hash_to_paths.setdefault(sha, []).append(c["path"])
    identical_pairs = {h: ps for h, ps in hash_to_paths.items() if len(ps) > 1}

    return {
        "all_scanned":         scanned,
        "safe_candidates":     safe_candidates,
        "full_engine":         full_engine,
        "rejected":            rejected,
        "not_found":           not_found,
        "substrate_hits":      substrate_hits,
        "identical_pairs":     identical_pairs,
    }


# ── Output normalization ──────────────────────────────────────────────────────

def _normalize(raw: Any, source_info) -> dict:  # source_info: dict or str (268R compat)
    """
    Map DriftArbitrator.evaluate() or DriftBridge.evaluate() output
    to the canonical RMC drift schema.  Handles dict/float/tuple/None.
    """
    if isinstance(source_info, dict):
        src_adapter = source_info.get("classification", "unknown")
        src_sha     = source_info.get("actual_sha256", "unknown")
    else:
        src_adapter = str(source_info)
        src_sha     = "unknown"

    schema: dict = {
        "epsilon_s":              0.0,
        "entropy":                0.0,
        "verdict":                "unknown",
        "drift_detected":         False,
        "events":                 [],
        "phase_deviation":        0.0,
        "transition_validity":    True,
        "correction_recommended": False,
        "chi_t_required":         False,
        "circuit_breaker_open":   False,
        "projection_ready":       True,
        "recommended_action":     "ALLOW",
        "source_adapter":         src_adapter,
        "source_candidate_sha256": src_sha,
        "normalized":             True,
        "status":                 "NORMALIZED",
        # 268R compat aliases
        "drift_type":             None,  # filled below from verdict
        "circuit_breaker":        None,  # filled below from circuit_breaker_open
    }

    if hasattr(raw, "to_dict") and callable(getattr(raw, "to_dict")):
        try:
            raw = raw.to_dict()
        except Exception:
            pass
    elif hasattr(raw, "__dict__") and not isinstance(raw, (dict, str, bytes)):
        try:
            raw = dict(raw.__dict__)
        except Exception:
            pass

    if isinstance(raw, dict):
        eps = clamp(_f(
            raw.get("epsilon_s") or raw.get("eps") or raw.get("drift_score") or
            raw.get("score") or raw.get("drift") or 0.0
        ))
        entropy = clamp(_f(raw.get("entropy") or raw.get("H_norm") or eps))
        verdict = str(raw.get("verdict") or raw.get("drift_type") or raw.get("classification") or
                      ("benign" if eps < 0.35 else "elevated" if eps < 0.72 else "critical"))
        drift_det = bool(raw.get("drift_detected") or eps >= 0.35)
        events    = list(raw.get("events") or raw.get("warnings") or [])
        phase_dev = clamp(_f(raw.get("phase_deviation") or raw.get("delta_phi") or 0.0))
        corr_rec  = bool(raw.get("correction_recommended") or raw.get("chi_required") or eps >= 0.35)
        chi_req   = bool(raw.get("chi_t_required") or raw.get("chi_required") or eps >= 0.35)
        cb_open   = bool(raw.get("circuit_breaker_open") or raw.get("circuit_breaker") or eps >= 0.72)
        action    = str(raw.get("recommended_action") or raw.get("action") or
                        ("BLOCK" if eps >= 0.72 else "WARN" if eps >= 0.35 else "ALLOW"))
        schema.update({
            "epsilon_s":              round(eps, 4),
            "entropy":                round(entropy, 4),
            "verdict":                verdict,
            "drift_detected":         drift_det,
            "events":                 events,
            "phase_deviation":        round(phase_dev, 4),
            "transition_validity":    not cb_open,
            "correction_recommended": corr_rec,
            "chi_t_required":         chi_req,
            "circuit_breaker_open":   cb_open,
            "projection_ready":       not (cb_open or chi_req),
            "recommended_action":     action,
        })

    elif isinstance(raw, (int, float)):
        eps = clamp(_f(raw))
        schema.update({
            "status": "NORMALIZED_SCALAR",
            "epsilon_s":              round(eps, 4),
            "entropy":                round(eps, 4),
            "verdict":                "benign" if eps < 0.35 else "elevated" if eps < 0.72 else "critical",
            "drift_detected":         eps >= 0.35,
            "correction_recommended": eps >= 0.35,
            "chi_t_required":         eps >= 0.35,
            "circuit_breaker_open":   eps >= 0.72,
            "projection_ready":       eps < 0.35,
            "recommended_action":     "BLOCK" if eps >= 0.72 else "WARN" if eps >= 0.35 else "ALLOW",
        })

    elif isinstance(raw, tuple) and len(raw) >= 2:
        try:
            action = str(raw[0])
            eps    = clamp(_f(raw[1]))
            schema.update({
                "epsilon_s":          round(eps, 4),
                "verdict":            action.lower().replace("_", " "),
                "drift_detected":     eps >= 0.35,
                "recommended_action": action,
            })
        except Exception:
            pass

    schema["drift_type"] = schema.get("verdict", "unknown")
    schema["circuit_breaker"] = schema.get("circuit_breaker_open", False)
    # None or unrecognized type → NORMALIZATION_FAILED
    if raw is None or not isinstance(raw, (dict, int, float, tuple)):
        schema["status"] = "NORMALIZATION_FAILED"
    return schema



def _probe_text_payload() -> str:
    """Return stable text for safe drift probe call."""
    return str(_PROBE_PAYLOAD.get("text") or "rmc_safe_probe_patch268s")


def _probe_phase_history() -> list[int]:
    """Return stable phase history for safe drift probe call."""
    path = _PROBE_PAYLOAD.get("phase_path") or []
    out: list[int] = []
    for item in path:
        if isinstance(item, int):
            out.append(item)
        else:
            txt = str(item)
            digits = "".join(ch for ch in txt if ch.isdigit())
            if digits:
                try:
                    v = int(digits)
                    if 1 <= v <= 9:
                        out.append(v)
                except Exception:
                    pass
    return out or [1, 3]


def _probe_current_phase() -> int:
    hist = _probe_phase_history()
    return hist[-1] if hist else 3


def _expected_shape_hint() -> dict:
    return {
        "text": "str",
        "phase_path": "list",
        "epsilon_s": "float",
        "dry_run": "bool",
        "cmd": "str",
        "payload": "dict",
    }


def _call_safe_method(method: Any) -> tuple[Any, str | None, str | None]:
    """
    Call a safe drift callable using its real signature.

    Patch 268S2 proved imports were fixed, but the live RMC arbitrator has:
        DriftArbitrator.evaluate(text, current_phase, phase_history=None,
                                 expected_shape=None, memory_baseline=None)
    while bridge candidates commonly have:
        DriftBridge.evaluate(text, phase_history)
    and early fake tests used:
        evaluate(payload)

    Patch 268S3 uses inspect.signature() first and supplies only known-safe
    probe values by parameter name.  No shell, no writes, no browser-controlled
    arguments. Explicit fallback attempts are retained for older simple callables.

    Returns (raw_result, called_signature, error_string).
    """
    text = _probe_text_payload()
    phase_history = _probe_phase_history()
    current_phase = _probe_current_phase()
    memory_baseline = "rmc_safe_probe_baseline_patch268s3"
    expected_shape = _expected_shape_hint()

    # Preferred: map the audited callable's real parameter names.
    try:
        sig = _inspect.signature(method)
        kwargs: dict[str, Any] = {}
        args: list[Any] = []
        unknown_required: list[str] = []
        for name, param in sig.parameters.items():
            lname = name.lower()
            if lname in ("self",):
                continue
            value_known = True
            if lname in ("text", "input_text", "content", "message", "prompt"):
                value = text
            elif lname in ("current_phase", "phase", "phase_current"):
                value = current_phase
            elif lname in ("phase_history", "history", "phases", "phase_path"):
                value = phase_history
            elif lname in ("expected_shape", "shape", "schema"):
                value = expected_shape
            elif lname in ("memory_baseline", "baseline", "memory", "reference"):
                value = memory_baseline
            elif lname in ("payload", "data", "packet", "obj", "p"):
                value = _PROBE_PAYLOAD
            elif param.default is not _inspect._empty:
                value_known = False
                value = None
            else:
                value_known = False
                value = None

            if value_known:
                if param.kind in (_inspect.Parameter.POSITIONAL_ONLY,):
                    args.append(value)
                elif param.kind in (_inspect.Parameter.POSITIONAL_OR_KEYWORD,
                                    _inspect.Parameter.KEYWORD_ONLY):
                    kwargs[name] = value
            elif param.default is _inspect._empty and param.kind not in (
                _inspect.Parameter.VAR_POSITIONAL, _inspect.Parameter.VAR_KEYWORD
            ):
                unknown_required.append(name)
        if not unknown_required:
            return method(*args, **kwargs), "evaluate(signature_mapped_probe)", None
    except Exception as exc:
        # Signature mapping is preferred but non-fatal; explicit safe fallbacks below.
        last_error: str | None = str(exc)[:220]
    else:
        last_error = None

    # Explicit fallback patterns. Order matters: bridge's (text, phase_history)
    # must be tried before (text, current_phase), because both are two-arg forms.
    explicit_attempts = [
        (lambda: method(text, current_phase, phase_history, expected_shape, memory_baseline),
         "evaluate(text,current_phase,phase_history,expected_shape,memory_baseline)"),
        (lambda: method(text, current_phase, phase_history),
         "evaluate(text,current_phase,phase_history)"),
        (lambda: method(text, phase_history),
         "evaluate(text,phase_history)"),
        (lambda: method(text, current_phase),
         "evaluate(text,current_phase)"),
        (lambda: method(_PROBE_PAYLOAD),
         "evaluate(payload)"),
    ]
    for fn, label in explicit_attempts:
        try:
            return fn(), label, None
        except (TypeError, AssertionError) as exc:
            last_error = str(exc)[:220]
            continue
        except Exception as exc:
            return None, None, str(exc)[:220]
    return None, None, last_error or "no_compatible_safe_signature"


# ── Preview call logic ────────────────────────────────────────────────────────

def _invoke_candidate(path: _Path, candidate_info: dict) -> dict:
    """
    Import a safe candidate module and call its designated evaluate method.
    DriftMonitor is never instantiated here.
    """
    module_name = f"_pf2s_{path.stem.replace('-','_').replace('.','_')}_268S"
    mod, err = _safe_import(path, module_name)
    if mod is None:
        return {
            "status":              "IMPORT_FAILED",
            "error":               err,
            "adapter_mode":        "FALLBACK",
            "live_drift_available": False,
            "fallback_mode":       "structural_contract_drift_analysis",
        }

    target_cls_name  = candidate_info.get("callable_class")
    target_mth_name  = candidate_info.get("callable_method") or "evaluate"
    raw_result       = None
    called_fn: str | None = None

    # Primary: instantiate target class and call method
    if target_cls_name and target_cls_name != "DriftMonitor":
        cls = getattr(mod, target_cls_name, None)
        if cls is not None and not isinstance(cls, type(None)):
            try:
                instance  = cls()
                method    = getattr(instance, target_mth_name, None)
                if method and callable(method):
                    raw_result, call_label, call_err = _call_safe_method(method)
                    if call_err:
                        return {
                            "status":              "CALL_FAILED",
                            "error":               call_err,
                            "called_class":        target_cls_name,
                            "adapter_mode":        "FALLBACK",
                            "live_drift_available": False,
                            "fallback_mode":       "structural_contract_drift_analysis",
                        }
                    called_fn  = f"{target_cls_name}.{target_mth_name}::{call_label}"
            except Exception as exc:
                return {
                    "status":              "CALL_FAILED",
                    "error":               str(exc)[:200],
                    "called_class":        target_cls_name,
                    "adapter_mode":        "FALLBACK",
                    "live_drift_available": False,
                    "fallback_mode":       "structural_contract_drift_analysis",
                }

    # Fallback: top-level safe functions
    if raw_result is None:
        funcs = {n: fn for n, fn in _inspect.getmembers(mod, _inspect.isfunction)
                 if not n.startswith("_") and _is_safe_function_name(n)}
        for name in ("evaluate", "analyze_drift", "compute_epsilon", "score", "analyze",
                     "check", "detect", "classify"):
            fn = funcs.get(name)
            if fn is None:
                continue
            try:
                raw_result, call_label, call_err = _call_safe_method(fn)
                if call_err:
                    continue
                called_fn  = f"{name}::{call_label}"
                break
            except Exception:
                continue

    if raw_result is None:
        return {
            "status":              "CALL_FAILED",
            "reason":              "no_safe_callable_responded",
            "adapter_mode":        "FALLBACK",
            "live_drift_available": False,
            "fallback_mode":       "structural_contract_drift_analysis",
        }

    return {
        "status":               "PREVIEW_OK",
        "adapter_mode":         "LIVE",
        "live_drift_available": True,
        "called_function":      called_fn,
        "probe_payload":        _PROBE_PAYLOAD,
        "raw_output_type":      type(raw_result).__name__,
        "normalized_result":    _normalize(raw_result, candidate_info),
        "module_sha256":        _file_sha256(path),
        "preview_at_utc":       _utc(),
        "full_drift_monitor_not_called_by_default": True,
        "read_only":            True,
        "writes_files":         False,
        "engine_version":       ENGINE_VERSION,
    }


# ── Public API ────────────────────────────────────────────────────────────────

def boundary() -> dict:
    return {
        "engine_version":  ENGINE_VERSION,
        "engine_mode":     ENGINE_MODE,
        "patch":           "268S",
        "module":          "forge/rmc_engine_v1/protoforge2_drift_connector.py",
        "description":     (
            "Multi-path ProtoForge2 drift candidate adapter with SHA256 classification, "
            "ranked safe-callable selection, and RMC drift schema normalization."
        ),
        "candidate_count": len(_DEFAULT_CANDIDATES),
        "known_hashes": {
            "full_engine":        FULL_ENGINE_SHA256,
            "rmc_safe_arbitrator": RMC_ARBITRATOR_SHA256,
            "sandbox_bridge":     SANDBOX_BRIDGE_SHA256,
            "legacy_rejected":    LEGACY_REJECTED_SHA256,
        },
        "selection_order": [
            {"rank": 1, "class": "DriftArbitrator", "method": "evaluate", "classification": "rmc_safe_arbitrator"},
            {"rank": 2, "class": "DriftBridge",     "method": "evaluate", "classification": "sandbox_drift_bridge"},
        ],
        "not_called_by_default": [
            "full_doctrine_reference",
            "live_protoforge_package_copy",
        ],
        "always_rejected": ["legacy_runtime_rejected"],
        "adapter_modes":   ["LIVE", "SKIPPED", "FALLBACK"],
        "import_method":    "importlib.util.spec_from_file_location (handles hyphen filenames)",
        "safety_rules": {
            "no_modify_pf2":        True,
            "no_write_pf2":         True,
            "no_shell":             True,
            "no_subprocess":        True,
            "no_chroma_write":      True,
            "no_identity_vault":    True,
            "no_llm":               True,
            "no_browser_selected_import_path": True,
            "controlled_local_import_only":    True,
            "safe_function_only":   True,
            "path_traversal_check": True,
        },
        # Corrected boundary language
        "no_shell":                                   True,
        "no_subprocess":                              True,
        "no_browser_selected_import_path":            True,
        "controlled_local_import_only":               True,
        "default_http_preview_read_only":             True,
        "full_drift_monitor_not_called_by_default":   True,
        "exec_module_note": (
            "exec_module() is used internally by Python's importlib to execute a "
            "module spec. This is disclosed. No shell, no subprocess, no file writes "
            "from HTTP preview routes."
        ),
        "read_only":         True,
        "writes_files":      False,
        "writes_rmc_memory": False,
        "writes_identity_vault": False,
        "queries_chroma":    False,
        "calls_llm":         False,
        "executes_shell":    False,
    }



def _substrate_function_names(hits: list) -> list:
    """Quick AST scan of substrate hit files to extract function names. No import."""
    import ast as _ast
    for hit in hits:
        p = _Path(hit.get("path", ""))
        if not p.exists():
            continue
        try:
            with open(p, "r", encoding="utf-8", errors="replace") as f:
                src_txt = f.read(8192)
            tree = _ast.parse(src_txt)
            return [n.name for n in _ast.walk(tree)
                    if isinstance(n, _ast.FunctionDef) and not n.name.startswith("_")][:20]
        except Exception:
            continue
    return []


def probe_protoforge2_status(
    pf2_root: str | _Path | None = None,
    *,
    _test_candidates: list[dict] | None = None,
) -> dict:
    """
    Scan ProtoForge2 drift candidate paths and return comprehensive status.

    Professional-production correction in Patch 268S1:
    when ``pf2_root`` is explicitly provided for a scoped probe and no
    ``_test_candidates`` are injected, the scan is intentionally limited to
    that root's legacy substrate filenames. It must not silently fall back to
    Nic's real absolute candidate registry. This makes missing-root/missing-
    module tests deterministic on machines where the real candidates exist.

    Parameters
    ----------
    pf2_root:
        Optional scoped substrate root. If omitted, the live approved candidate
        registry is used. If provided, only that root is scanned unless
        ``_test_candidates`` is explicitly supplied.
    _test_candidates:
        Inject a custom candidate list (unit tests only).
    """
    root_path = _Path(pf2_root or DEFAULT_PF2_ROOT)

    if _is_suspicious_path(root_path):
        return {
            "status":  "REFUSED_UNSAFE_PATH",
            "reason":  f"path failed safety check: {pf2_root!r}",
            "read_only": True,
        }

    if _test_candidates is not None:
        candidates = _test_candidates
    elif pf2_root is not None:
        # Scoped root probe: do not use global absolute live candidates.
        # _run_full_scan will still inspect _SUBSTRATE_SCAN_NAMES under root.
        candidates = []
    else:
        candidates = _DEFAULT_CANDIDATES

    scan = _run_full_scan(candidates, _Path(pf2_root) if pf2_root else None)

    sel      = scan["safe_candidates"][0] if scan["safe_candidates"] else None
    engines  = scan["full_engine"]
    rejected = scan["rejected"]
    identical = scan["identical_pairs"]

    candidate_count = len([c for c in scan["all_scanned"]
                           if c["exists"] and c.get("actual_sha256") != LEGACY_REJECTED_SHA256])

    full_hash_confirmed = bool(engines and
                               all(c.get("actual_sha256") == FULL_ENGINE_SHA256 for c in engines))
    full_copies_identical = FULL_ENGINE_SHA256 in identical

    if not any(c["exists"] for c in scan["all_scanned"]) and not scan["substrate_hits"]:
        status = "SKIPPED"
    elif sel:
        status = "FOUND"
    else:
        status = "DETECTED_NO_SAFE_CALLABLE"

    return {
        "status":                    status,
        "probe_at_utc":              _utc(),
        # Required rich output (spec)
        "candidate_count":           candidate_count,
        "selected_candidate_path":   sel["path"] if sel else None,
        "selected_candidate_type":   sel["classification"] if sel else None,
        "selected_candidate_sha256": sel.get("actual_sha256") if sel else None,
        "selected_callable": (
            f"{sel['callable_class']}.{sel['callable_method']}"
            if sel and sel.get("callable_class") else None
        ),
        "rejected_candidates": [
            {"path": c["path"], "sha256": c.get("actual_sha256"), "reason": c.get("rejection_reason")}
            for c in rejected
        ],
        "detected_full_engine_path":   engines[0]["path"] if engines else None,
        "detected_full_engine_sha256": engines[0].get("actual_sha256") if engines else None,
        "full_engine_hash_confirmed":  full_hash_confirmed,
        "full_engine_copies_identical": full_copies_identical,
        "full_engine_callable_by_default": False,
        "live_drift_available":        bool(sel),
        "adapter_mode":                "LIVE" if sel else "SKIPPED",
        "fallback_mode":               "structural_contract_drift_analysis",
        # 268R backward-compat fields  
        "protoforge2_root_exists":  _Path(pf2_root or DEFAULT_PF2_ROOT).expanduser().resolve().exists(),
        "drift_module_found":       bool(sel) or bool(scan.get("substrate_hits")),
        "importable":               None,
        "drift_module_path":        sel.get("path") if sel else (scan["substrate_hits"][0]["path"] if scan["substrate_hits"] else None),
        "module_sha256":            sel.get("actual_sha256") if sel else (scan["substrate_hits"][0]["sha256"] if scan["substrate_hits"] else None),
        "available_functions":      _substrate_function_names(scan["substrate_hits"]),
        # Detail
        "all_candidates":       scan["all_scanned"],
        "safe_callables_found": [
            {"path": c["path"], "classification": c["classification"],
             "callable": f"{c['callable_class']}.{c['callable_method']}",
             "rank": c["rank"], "sha256": c.get("actual_sha256")}
            for c in scan["safe_candidates"]
        ],
        "identical_hash_pairs": identical,
        "substrate_hits":       scan["substrate_hits"],
        "root_contents": [str(p.name) for p in _Path(pf2_root or DEFAULT_PF2_ROOT).expanduser().resolve().iterdir() if p.is_file()] if _Path(pf2_root or DEFAULT_PF2_ROOT).expanduser().resolve().exists() else [],
        "read_only":            True,
        "engine_version":       ENGINE_VERSION,
        "boundary":             boundary(),
    }


def probe_protoforge2_import(
    pf2_root: str | _Path | None = None,
    *,
    _test_candidates: list[dict] | None = None,
) -> dict:
    """Attempt import of the selected safe callable module. Read-only."""
    status = probe_protoforge2_status(pf2_root, _test_candidates=_test_candidates)
    if not status.get("live_drift_available") or not status.get("selected_candidate_path"):
        # 268R compat: fall back to substrate scan hits if registry has no candidate
        for hit in status.get("substrate_hits", []):
            hp = _Path(hit.get("path", ""))
            if not hp.exists():
                continue
            sha = hit.get("sha256", "")
            if sha == LEGACY_REJECTED_SHA256:
                continue
            mname = f"_pf2s_sub_{hp.stem.replace('-','_').replace('.','_')}"
            mod, err = _safe_import(hp, mname)
            if mod is None:
                continue
            funcs = {n: fn for n, fn in _inspect.getmembers(mod, _inspect.isfunction)
                     if not n.startswith("_") and _is_safe_function_name(n)}
            classes = {n: c for n, c in _inspect.getmembers(mod, _inspect.isclass)
                       if not n.startswith("_")}
            return {**status,
                    "importable": True, "import_status": "SUCCESS", "adapter_mode": "LIVE",
                    "selected_candidate_path": str(hp), "live_drift_available": True,
                    "available_functions": list(funcs.keys())[:20],
                    "available_classes": list(classes.keys())[:10]}
        return {**status, "importable": False, "import_status": "NO_SAFE_CANDIDATE_FOUND"}

    path  = _Path(status["selected_candidate_path"])
    mname = f"_pf2s_import_{path.stem.replace('-','_').replace('.','_')}"
    mod, err = _safe_import(path, mname)
    if mod is None:
        return {**status, "importable": False, "import_status": f"IMPORT_ERROR: {err}",
                "adapter_mode": "FALLBACK"}

    funcs   = {n: f for n, f in _inspect.getmembers(mod, _inspect.isfunction)
               if not n.startswith("_") and _is_safe_function_name(n)}
    classes = {n: c for n, c in _inspect.getmembers(mod, _inspect.isclass)
               if not n.startswith("_")}
    return {
        **status,
        "importable":              True,
        "import_status":           "SUCCESS",
        "adapter_mode":            "LIVE",
        "available_functions":     list(funcs.keys())[:20],
        "available_classes":       list(classes.keys())[:10],
    }


def preview_drift_call(
    pf2_root: str | _Path | None = None,
    *,
    test_module_path: str | _Path | None = None,
    _test_candidates: list[dict] | None = None,
) -> dict:
    """
    Attempt a safe probe call against the selected ProtoForge2 callable.

    Call order:
      1. DriftArbitrator.evaluate() from rmc_safe_arbitrator (rank 1)
      2. DriftBridge.evaluate() from sandbox_drift_bridge (rank 2)
      3. SKIPPED if neither available

    DriftMonitor is NEVER instantiated here.

    Parameters
    ----------
    test_module_path:
        Override with a specific test module path (unit tests; from 268R).
    _test_candidates:
        Inject custom candidate list (unit tests).
    """
    # 268R-compatible test path override
    if test_module_path is not None:
        tp = _Path(test_module_path).expanduser().resolve()
        if not tp.exists():
            return {"status": "SKIPPED", "reason": f"test_module_path not found: {tp}",
                    "live_drift_available": False, "adapter_mode": "SKIPPED"}
        return _invoke_candidate(tp, {
            "classification": "test_override",
            "callable_class": None,
            "callable_method": "evaluate",
            "actual_sha256": _file_sha256(tp),
        })

    # Normal path: use candidate registry
    status = probe_protoforge2_status(pf2_root, _test_candidates=_test_candidates)
    if not status.get("live_drift_available") or not status.get("selected_candidate_path"):
        return {
            "status":               "SKIPPED",
            "reason":               "no_safe_callable_found",
            "live_drift_available": False,
            "adapter_mode":         "SKIPPED",
            "fallback_mode":        "structural_contract_drift_analysis",
            "candidate_count":      status.get("candidate_count", 0),
            "full_engine_detected": bool(status.get("detected_full_engine_path")),
            "full_engine_callable_by_default": False,
            "read_only":            True,
            "engine_version":       ENGINE_VERSION,
        }

    # Find the selected candidate's info from the registry
    sel_path = status["selected_candidate_path"]
    sel_info: dict = {
        "classification":  status.get("selected_candidate_type", "unknown"),
        "actual_sha256":   status.get("selected_candidate_sha256"),
        "callable_class":  None,
        "callable_method": "evaluate",
    }
    for cand in ((_test_candidates or _DEFAULT_CANDIDATES)):
        if str(cand.get("path", "")) == sel_path:
            sel_info["callable_class"]  = cand.get("callable_class")
            sel_info["callable_method"] = cand.get("callable_method", "evaluate")
            break

    return _invoke_candidate(_Path(sel_path), sel_info)

# ── Backward-compat alias for Patch 268R test suite ──────────────────────────
_normalize_pf2_output = _normalize

# 268R backward-compat exports
SAFE_FUNCTION_PATTERNS   = ('analyze','compute','score','detect','classify','check',
                            'evaluate','measure','drift','entropy','epsilon','semantic',
                            'syntactic','recursive','chi','boundary','status',)
UNSAFE_FUNCTION_PATTERNS = ('write','delete','remove','shell','exec','run','spawn',
                             'kill','commit','deploy','upload','send','post','push',)
_is_suspicious_path = _is_suspicious_path  # already defined above
