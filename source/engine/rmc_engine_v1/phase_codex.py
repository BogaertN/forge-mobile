"""FBSC Phase Glyph Codex v2.5 — read-only structured runtime binding.

Patch 262J1R-Preflight-B3 binds Nic's FBSC Phase Glyph Codex v2.5
("Rosetta Stone") into Forge/RMC as machine-readable reference data.

This module is intentionally read-only and side-effect-free. It loads JSON
reference files and exposes phase profiles for other RMC modules such as the
resonance lexicon, drift engine, dashboard, and future glyph/runtime layers.

No writes, no DB reads, no Chroma, no LLM calls, no shell execution.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ENGINE_VERSION = "rmc_phase_codex_binding_v1_patch262J1R_preflight_B3"
ENGINE_MODE = "read_only_phase_codex_binding"
REFERENCE_DIR = Path(__file__).resolve().parent / "reference"
CODEX_FILE = REFERENCE_DIR / "phase_codex_v2_5.json"
REQUIRED_PHASES = [f"Φ{i}" for i in range(1, 10)]


def _read_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def load_phase_codex() -> dict:
    data = _read_json(CODEX_FILE, {})
    if not isinstance(data, dict):
        return {}
    return data


def get_phase_profiles() -> dict[str, dict]:
    data = load_phase_codex()
    phases = data.get("phases", {}) if isinstance(data, dict) else {}
    return phases if isinstance(phases, dict) else {}


def get_phase_profile(phase_id: str) -> dict:
    return dict(get_phase_profiles().get(str(phase_id), {}))


def get_phase_color_map() -> dict:
    data = _read_json(REFERENCE_DIR / "phase_color_map_v2_5.json", {})
    return data if isinstance(data, dict) else {}


def get_phase_runtime_hooks() -> dict:
    data = _read_json(REFERENCE_DIR / "phase_runtime_hooks_v2_5.json", {})
    return data if isinstance(data, dict) else {}


def get_phase_motion_map() -> dict:
    data = _read_json(REFERENCE_DIR / "phase_motion_map_v2_5.json", {})
    return data if isinstance(data, dict) else {}


def get_phase_cold_storage_forms() -> dict:
    data = _read_json(REFERENCE_DIR / "phase_cold_storage_forms_v2_5.json", {})
    return data if isinstance(data, dict) else {}


def validate_phase_codex() -> dict:
    codex = load_phase_codex()
    phases = get_phase_profiles()
    missing = [p for p in REQUIRED_PHASES if p not in phases]
    required_fields = [
        "phase_id", "index", "phase_name", "code_identifier", "glyph",
        "unicode_fallback", "symbolic_function", "color_name", "hex",
        "motion_behavior", "drift_behavior", "cold_storage_form",
        "function_hook", "state_signature", "neuromorphic_hook", "gate_role",
    ]
    field_failures: list[str] = []
    for p in REQUIRED_PHASES:
        prof = phases.get(p, {})
        for field in required_fields:
            if field not in prof or prof.get(field) in (None, ""):
                field_failures.append(f"{p}:{field}")
    return {
        "status": "OK" if not missing and not field_failures else "INVALID",
        "codex_id": codex.get("codex_id"),
        "version": codex.get("version"),
        "phase_count": len(phases),
        "missing_phases": missing,
        "field_failures": field_failures,
        "required_fields": required_fields,
    }


def phase_codex_boundary() -> dict:
    validation = validate_phase_codex()
    return {
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "engine_module_location": "forge/rmc_engine_v1/phase_codex.py",
        "reference_location": "forge/rmc_engine_v1/reference/phase_codex_v2_5.json",
        "codex_authority": "FBSC Phase Glyph Codex v2.5 / Rosetta Stone",
        "codex_validation_status": validation.get("status"),
        "phase_count": validation.get("phase_count"),
        "side_effect_free": True,
        "calls_llm": False,
        "queries_chroma": False,
        "reads_db_files": False,
        "writes_files": False,
        "writes_rmc_memory": False,
        "writes_identity_vault": False,
        "approved_output": False,
    }


def phase_codex_preview() -> dict:
    codex = load_phase_codex()
    return {
        "status": "OK",
        "mode": ENGINE_MODE,
        "read_only": True,
        "codex_id": codex.get("codex_id"),
        "version": codex.get("version"),
        "authority": codex.get("authority"),
        "phase_order": codex.get("phase_order", REQUIRED_PHASES),
        "phases": get_phase_profiles(),
        "color_map": get_phase_color_map(),
        "runtime_hooks": get_phase_runtime_hooks(),
        "motion_map": get_phase_motion_map(),
        "cold_storage_forms": get_phase_cold_storage_forms(),
        "validation": validate_phase_codex(),
        "engine_boundary": phase_codex_boundary(),
        "approved_output": False,
    }
