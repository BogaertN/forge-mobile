"""RMC Glyph Renderer / G_t engine.

Patch 262J1R-Preflight-C14 converts FBSC Phase Glyph Codex v2.5
reference data into deterministic glyph packets.  This is the canonical glyph
renderer for RMC: SVG/JSON packets first, optional image-generation expansion
later.  The image layer is explicitly non-authoritative; glyph authority comes
from the manifest trace, phase codex, phase path, operator path, and glyph seed.

No writes, no DB reads, no Chroma, no LLM calls, no shell execution.
"""
from __future__ import annotations

import datetime as _dt
import re
from typing import Any

from rmc_engine_v1.measurement_kernel import stable_hash, stable_id
from rmc_engine_v1.phase_codex import (
    get_phase_cold_storage_forms,
    get_phase_color_map,
    get_phase_motion_map,
    get_phase_profile,
    get_phase_profiles,
    get_phase_runtime_hooks,
    load_phase_codex,
    validate_phase_codex,
)

ENGINE_VERSION = "rmc_glyph_renderer_v1_patch262J1R_preflight_C14"
ENGINE_MODE = "deterministic_fbsc_glyph_packet_renderer"
GLYPH_PACKET_KIND = "rmc_phase_glyph_render_packet_v1"
CANONICAL_RENDERER = "deterministic_svg_from_fbsc_phase_codex_v2_5"
SUPPORTED_GLYPH_RENDER_MODES = {
    "single_phase_glyph",
    "phase_path_glyph",
    "drift_state_glyph",
    "cold_storage_glyph",
    "composite_glyph",
}
REQUIRED_GLYPH_PACKET_FIELDS = [
    "glyph_packet_id",
    "glyph_packet_kind",
    "source_manifest_id",
    "source_trace_id",
    "phase_id",
    "phase_path",
    "glyph_unicode",
    "glyph_svg",
    "color_hex",
    "motion_signature",
    "drift_visual_state",
    "cold_storage_visual_state",
    "composite_seed",
    "glyph_seed",
    "codex_version",
    "render_mode",
    "echo_validation_ready",
]

_PHASE_RE = re.compile(r"Φ\s*([1-9])|phi\s*([1-9])|phase[_\s-]*([1-9])|\b([1-9])\b", re.IGNORECASE)
_HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


def _utc_now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()


def _as_dict(value: Any) -> dict[str, Any]:
    return dict(value or {}) if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if value in (None, "", {}):
        return []
    return [value]


def _text(value: Any, limit: int = 2000) -> str:
    text = str(value or "").strip()
    text = re.sub(r"\s+", " ", text)
    return text[:limit]


def normalize_phase_id(value: Any) -> str | None:
    """Return canonical Φ1..Φ9 or None."""
    if value is None:
        return None
    raw = str(value).strip()
    if raw in {f"Φ{i}" for i in range(1, 10)}:
        return raw
    if raw.startswith("Φ") and raw not in {f"Φ{i}" for i in range(1, 10)}:
        return None
    if raw.lower().startswith("phi") and raw.lower() not in {f"phi{i}" for i in range(1, 10)} and raw.lower() not in {f"phi {i}" for i in range(1, 10)}:
        return None
    match = _PHASE_RE.search(raw)
    if not match:
        return None
    for group in match.groups():
        if group:
            return f"Φ{int(group)}"
    return None


def normalize_phase_path(value: Any, fallback_phase: Any = None) -> list[str]:
    phases: list[str] = []
    for item in _as_list(value):
        phase = normalize_phase_id(item)
        if phase and phase not in phases:
            phases.append(phase)
    if not phases:
        phase = normalize_phase_id(fallback_phase)
        if phase:
            phases.append(phase)
    return phases


def glyph_renderer_boundary() -> dict[str, Any]:
    validation = validate_phase_codex()
    return {
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "engine_module_location": "forge/rmc_engine_v1/glyph_renderer.py",
        "implements_rmc_stage": "Real Glyph Renderer / G_t",
        "input_contract": "manifest_packet_or_phase_path_plus_FBSC_codex_v2_5_reference",
        "output_contract": "deterministic_glyph_packet_with_svg_seed_and_phase_trace",
        "codex_authority": "FBSC Phase Glyph Codex v2.5 / Rosetta Stone",
        "codex_validation_status": validation.get("status"),
        "phase_count": validation.get("phase_count"),
        "canonical_renderer": CANONICAL_RENDERER,
        "image_generation_is_authority": False,
        "image_generation_allowed_later_as_expansion_renderer": True,
        "glyph_seed_source": "SHA256(manifest_id + trace_id + phase_path + operator_path + drift_status + projection_status + codex_version)",
        "deterministic_by_default": True,
        "uses_llm": False,
        "uses_image_model": False,
        "queries_chroma": False,
        "reads_db_files": False,
        "executes_shell": False,
        "writes_files": False,
        "writes_rmc_memory": False,
        "writes_identity_vault": False,
        "mutates_canonical_reference": False,
        "approved_output": False,
        "projection_allowed": False,
        "memory_write_allowed": False,
    }


def glyph_renderer_schema_contract() -> dict[str, Any]:
    return {
        "glyph_symbol": "G_t",
        "formula": "G_t = γ(μ_t, phase_path, codex_v2_5, seed_trace)",
        "seed_formula": "glyph_seed = SHA256(source_manifest_id, source_trace_id, phase_path, operator_path, drift_status, projection_status, codex_version)",
        "supported_render_modes": sorted(SUPPORTED_GLYPH_RENDER_MODES),
        "required_packet_fields": REQUIRED_GLYPH_PACKET_FIELDS,
        "canonical_output": "SVG + JSON glyph packet, not generated bitmap art",
        "image_generation_policy": {
            "canonical_glyphs_are_deterministic": True,
            "generated_images_are_optional_visual_expansions": True,
            "generated_images_must_reference_source_glyph_seed": True,
            "generated_images_cannot_create_authoritative_phase_meaning": True,
        },
        "read_only": True,
    }


def _phase_body_svg(phase_id: str) -> str:
    # Body only, not a standalone <svg>.  All geometry uses currentColor so the
    # packet can drive color through one canonical codex value.
    templates = {
        "Φ1": '<circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="6" class="pulse"/><circle cx="50" cy="50" r="10" fill="currentColor" class="core"/>',
        "Φ2": '<line x1="35" y1="18" x2="35" y2="82" stroke="currentColor" stroke-width="7" class="left"/><line x1="65" y1="18" x2="65" y2="82" stroke="currentColor" stroke-width="7" class="right"/>',
        "Φ3": '<path d="M50,50 m-30,0 a30,30 0 1,1 60,0 a15,15 0 1,0 -30,0" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" class="spiral"/>',
        "Φ4": '<polygon points="50,10 90,50 50,90 10,50" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="miter" class="diamond"/>',
        "Φ5": '<circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="6" stroke-dasharray="205" stroke-dashoffset="58" class="halo"/><line x1="22" y1="78" x2="78" y2="22" stroke="currentColor" stroke-width="5" stroke-linecap="round" class="fracture"/>',
        "Φ6": '<ellipse cx="50" cy="50" rx="29" ry="43" fill="none" stroke="currentColor" stroke-width="6" class="mirror"/><line x1="50" y1="16" x2="50" y2="84" stroke="currentColor" stroke-width="2" opacity="0.35" class="shimmer"/>',
        "Φ7": '<polygon points="50,18 82,82 18,82" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round" class="triangle"/><circle cx="50" cy="60" r="4" fill="currentColor" opacity="0.75" class="identity-point"/>',
        "Φ8": '<g class="burst" stroke="currentColor" stroke-width="5" stroke-linecap="round"><line x1="50" y1="8" x2="50" y2="31"/><line x1="50" y1="69" x2="50" y2="92"/><line x1="8" y1="50" x2="31" y2="50"/><line x1="69" y1="50" x2="92" y2="50"/><line x1="20" y1="20" x2="36" y2="36"/><line x1="64" y1="64" x2="80" y2="80"/><line x1="20" y1="80" x2="36" y2="64"/><line x1="64" y1="36" x2="80" y2="20"/></g><circle cx="50" cy="50" r="6" fill="currentColor" class="charge-core"/>',
        "Φ9": '<path d="M20,50 C20,20 45,20 50,50 C55,80 80,80 80,50 C80,20 55,20 50,50 C45,80 20,80 20,50" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" class="loop"/>',
    }
    return templates.get(phase_id, "")


def _css_for_state(visual_state: str) -> str:
    if visual_state == "cold_storage":
        return ".glyph-root{opacity:.42;filter:grayscale(1);}.glyph-body{color:var(--phase-color);}.glyph-cold-shell{fill:none;stroke:#777777;stroke-width:2;opacity:.55;}"
    if visual_state == "drift":
        return ".glyph-root{filter:drop-shadow(0 0 4px var(--phase-color));}.glyph-body{color:var(--phase-color);}.glyph-drift-ring{fill:none;stroke:#777777;stroke-width:3;stroke-dasharray:5 5;opacity:.75;}"
    return ".glyph-root{filter:drop-shadow(0 0 3px var(--phase-color));}.glyph-body{color:var(--phase-color);}"


def _phase_visual_state(render_mode: str, drift_status: dict[str, Any], projection_status: dict[str, Any]) -> str:
    mode = str(render_mode or "").lower()
    status_text = f"{drift_status} {projection_status}".lower()
    if "cold" in mode or "archive" in status_text or "cold_storage" in status_text:
        return "cold_storage"
    if "drift" in mode or "drift" in status_text or "circuit_breaker" in status_text or "blocked" in status_text:
        return "drift"
    return "active"


def _codex_version() -> str:
    codex = load_phase_codex()
    return str(codex.get("version") or codex.get("codex_id") or "fbsc_phase_codex_v2_5")


def _phase_entry(phase_id: str, glyph_seed: str, visual_state: str) -> dict[str, Any]:
    profile = get_phase_profile(phase_id)
    motion = get_phase_motion_map().get(phase_id, {})
    runtime = get_phase_runtime_hooks().get(phase_id, {})
    color = str(profile.get("hex") or motion.get("color") or get_phase_color_map().get(phase_id) or "#777777")
    if not _HEX_RE.match(color):
        color = "#777777"
    cold = str(profile.get("cold_storage_form") or get_phase_cold_storage_forms().get(phase_id) or "")
    return {
        "phase_id": phase_id,
        "phase_index": profile.get("index"),
        "phase_name": profile.get("phase_name"),
        "code_identifier": profile.get("code_identifier") or runtime.get("code_identifier"),
        "glyph_unicode": profile.get("glyph") or motion.get("glyph"),
        "unicode_fallback": profile.get("unicode_fallback"),
        "color_hex": color,
        "color_name": profile.get("color_name"),
        "geometry": profile.get("geometry"),
        "motion_signature": profile.get("motion_behavior") or motion.get("motion_behavior"),
        "drift_visual_state": profile.get("drift_behavior") or motion.get("drift_behavior"),
        "cold_storage_visual_state": cold,
        "function_hook": profile.get("function_hook") or runtime.get("function_hook"),
        "state_signature": profile.get("state_signature") or runtime.get("state_signature"),
        "neuromorphic_hook": profile.get("neuromorphic_hook") or runtime.get("neuromorphic_hook"),
        "gate_role": profile.get("gate_role") or runtime.get("gate_role"),
        "visual_state": visual_state,
        "phase_glyph_seed": stable_hash({"phase_id": phase_id, "glyph_seed": glyph_seed, "codex_version": _codex_version()})[:32],
    }


def _svg_for_phases(phases: list[str], glyph_seed: str, visual_state: str) -> str:
    safe_phases = [p for p in phases if p in get_phase_profiles()]
    if not safe_phases:
        safe_phases = ["Φ1"]
    width = 100 * len(safe_phases)
    style = _css_for_state(visual_state)
    chunks: list[str] = []
    for idx, phase_id in enumerate(safe_phases):
        entry = _phase_entry(phase_id, glyph_seed, visual_state)
        x = idx * 100
        overlays = ""
        if visual_state == "drift":
            overlays = '<circle cx="50" cy="50" r="47" class="glyph-drift-ring"/>'
        elif visual_state == "cold_storage":
            overlays = '<rect x="5" y="5" width="90" height="90" rx="8" class="glyph-cold-shell"/>'
        chunks.append(
            f'<g class="glyph-phase glyph-{phase_id}" transform="translate({x},0)" style="--phase-color:{entry["color_hex"]};color:{entry["color_hex"]}" data-phase="{phase_id}" data-code="{entry.get("code_identifier") or ""}">'
            f'{overlays}<g class="glyph-body">{_phase_body_svg(phase_id)}</g></g>'
        )
    phase_attr = " ".join(safe_phases)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} 100" width="{width}" height="100" '
        f'class="fbsc-glyph-packet glyph-root state-{visual_state}" data-renderer="C14" data-glyph-seed="{glyph_seed}" data-phase-path="{phase_attr}">'
        f'<style>{style}</style>' + "".join(chunks) + "</svg>"
    )


def _extract_manifest_packet(source: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(source, dict):
        return {}
    if isinstance(source.get("manifest_packet"), dict):
        return dict(source.get("manifest_packet") or {})
    if source.get("manifest_symbol") == "μ_t" and isinstance(source.get("μ_t"), dict):
        return dict(source)
    if isinstance(source.get("μ_t"), dict):
        return dict(source)
    return {}


def _source_mu(packet: dict[str, Any]) -> dict[str, Any]:
    return _as_dict(packet.get("μ_t"))


def _seed_payload(packet: dict[str, Any], mu: dict[str, Any], phase_path: list[str], render_mode: str) -> dict[str, Any]:
    return {
        "source_manifest_id": packet.get("manifest_id"),
        "source_trace_id": packet.get("trace_id") or packet.get("source_trace_id") or mu.get("trace_id"),
        "phase_path": phase_path,
        "operator_path": _as_list(mu.get("operator_path")),
        "drift_status": _as_dict(mu.get("drift_status")),
        "projection_status": _as_dict(mu.get("projection_status")),
        "claim_hash": stable_hash(_text(mu.get("claim"))),
        "codex_version": _codex_version(),
        "render_mode": render_mode,
    }


def render_phase_glyph(phase_id: Any, *, state: str = "active", source_manifest_id: str | None = None, source_trace_id: str | None = None) -> dict[str, Any]:
    phase = normalize_phase_id(phase_id)
    if phase not in get_phase_profiles():
        return {
            "status": "BLOCKED",
            "failure_code": "invalid_phase_id",
            "phase_id_requested": phase_id,
            "valid_phases": sorted(get_phase_profiles().keys()),
            "boundary": glyph_renderer_boundary(),
            "writes_files": False,
            "memory_write_allowed": False,
        }
    visual_state = state if state in {"active", "drift", "cold_storage"} else "active"
    seed_payload = {
        "source_manifest_id": source_manifest_id,
        "source_trace_id": source_trace_id,
        "phase_path": [phase],
        "codex_version": _codex_version(),
        "visual_state": visual_state,
    }
    glyph_seed = stable_hash(seed_payload)
    entry = _phase_entry(phase, glyph_seed, visual_state)
    svg = _svg_for_phases([phase], glyph_seed[:32], visual_state)
    packet = _base_packet(
        packet={},
        mu={},
        phase_path=[phase],
        render_mode="single_phase_glyph",
        visual_state=visual_state,
        glyph_seed=glyph_seed,
        composite_seed=glyph_seed,
        svg=svg,
        glyph_entries=[entry],
        source_manifest_id=source_manifest_id,
        source_trace_id=source_trace_id,
    )
    return {"status": "OK", "G_t_present": True, "glyph_packet": packet, "G_t": packet, "boundary": glyph_renderer_boundary(), "writes_files": False, "memory_write_allowed": False}


def _base_packet(
    *,
    packet: dict[str, Any],
    mu: dict[str, Any],
    phase_path: list[str],
    render_mode: str,
    visual_state: str,
    glyph_seed: str,
    composite_seed: str,
    svg: str,
    glyph_entries: list[dict[str, Any]],
    source_manifest_id: str | None = None,
    source_trace_id: str | None = None,
) -> dict[str, Any]:
    primary = phase_path[-1] if phase_path else None
    primary_entry = glyph_entries[-1] if glyph_entries else {}
    source_manifest = source_manifest_id if source_manifest_id is not None else packet.get("manifest_id")
    source_trace = source_trace_id if source_trace_id is not None else packet.get("trace_id") or packet.get("source_trace_id") or mu.get("trace_id")
    return {
        "glyph_packet_id": stable_id("gt", {"glyph_seed": glyph_seed, "source_manifest_id": source_manifest, "render_mode": render_mode}),
        "glyph_symbol": "G_t",
        "glyph_packet_kind": GLYPH_PACKET_KIND,
        "glyph_packet_version": "C14_deterministic_svg_from_codex_v2_5",
        "glyph_created_at_utc": _utc_now(),
        "source_manifest_id": source_manifest,
        "source_trace_id": source_trace,
        "phase_id": primary,
        "phase_path": phase_path,
        "phase_count": len(phase_path),
        "glyph_unicode": primary_entry.get("glyph_unicode"),
        "glyph_svg": svg,
        "glyph_svg_sha256": stable_hash(svg),
        "glyph_sequence": glyph_entries,
        "color_hex": primary_entry.get("color_hex"),
        "motion_signature": primary_entry.get("motion_signature"),
        "drift_visual_state": primary_entry.get("drift_visual_state"),
        "cold_storage_visual_state": primary_entry.get("cold_storage_visual_state"),
        "composite_seed": composite_seed[:64],
        "glyph_seed": glyph_seed[:64],
        "codex_version": _codex_version(),
        "codex_id": load_phase_codex().get("codex_id"),
        "render_mode": render_mode,
        "visual_state": visual_state,
        "canonical_renderer": CANONICAL_RENDERER,
        "deterministic_svg": True,
        "image_generation_bridge": {
            "image_generation_is_authority": False,
            "may_expand_later": True,
            "required_source_glyph_seed": glyph_seed[:64],
            "required_prompt_hash_field": "prompt_hash_required_if_image_renderer_is_used_later",
            "note": "Generated images may visualize this glyph packet later, but cannot define canonical glyph meaning.",
        },
        "echo_validation_ready": True,
        "approved_output": False,
        "projection_allowed": False,
        "memory_write_allowed": False,
        "writes_files": False,
    }


def render_glyph_packet(source: dict[str, Any], render_mode: str = "phase_path_glyph", phase_path: Any = None) -> dict[str, Any]:
    """Render deterministic G_t glyph packet from μ_t/manifest or explicit phase path."""
    mode = str(render_mode or "phase_path_glyph").strip().lower().replace("-", "_")
    if mode not in SUPPORTED_GLYPH_RENDER_MODES:
        mode = "phase_path_glyph"
    packet = _extract_manifest_packet(source if isinstance(source, dict) else {})
    mu = _source_mu(packet)
    explicit_path = normalize_phase_path(phase_path)
    path = explicit_path or normalize_phase_path(mu.get("phase_path"), fallback_phase=mu.get("phase_id"))
    if not path:
        # Allow a direct source with phase/phase_path even without manifest.
        path = normalize_phase_path(_as_dict(source).get("phase_path"), fallback_phase=_as_dict(source).get("phase"))
    invalid = [p for p in path if p not in get_phase_profiles()]
    if not path or invalid:
        return {
            "status": "BLOCKED",
            "engine_version": ENGINE_VERSION,
            "engine_mode": ENGINE_MODE,
            "stage": "Glyph Renderer",
            "failure_code": "missing_or_invalid_phase_path",
            "invalid_phases": invalid,
            "G_t_present": False,
            "glyph_packet": None,
            "boundary": glyph_renderer_boundary(),
            "writes_files": False,
            "memory_write_allowed": False,
        }
    drift_status = _as_dict(mu.get("drift_status"))
    projection_status = _as_dict(mu.get("projection_status"))
    visual_state = _phase_visual_state(mode, drift_status, projection_status)
    seed_payload = _seed_payload(packet, mu, path, mode)
    glyph_seed = stable_hash(seed_payload)
    composite_seed = stable_hash({"seed_payload": seed_payload, "phase_entries": path, "renderer": ENGINE_VERSION})
    entries = [_phase_entry(p, glyph_seed, visual_state) for p in path]
    svg = _svg_for_phases(path, glyph_seed[:32], visual_state)
    glyph_packet = _base_packet(
        packet=packet,
        mu=mu,
        phase_path=path,
        render_mode=mode,
        visual_state=visual_state,
        glyph_seed=glyph_seed,
        composite_seed=composite_seed,
        svg=svg,
        glyph_entries=entries,
    )
    return {
        "status": "OK",
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "stage": "Glyph Renderer",
        "rendering_allowed": True,
        "G_t_present": True,
        "glyph_packet": glyph_packet,
        "G_t": glyph_packet,
        "schema_contract": glyph_renderer_schema_contract(),
        "boundary": glyph_renderer_boundary(),
        "approved_output": False,
        "projection_allowed": False,
        "memory_write_allowed": False,
        "writes_files": False,
        "identity_vault_write": False,
        "rmc_live_memory_write": False,
        "queries_chroma": False,
        "calls_llm": False,
    }


def glyph_renderer_status() -> dict[str, Any]:
    validation = validate_phase_codex()
    return {
        "status": "OK" if validation.get("status") == "OK" else "INVALID",
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "stage": "Glyph Renderer Status",
        "read_only": True,
        "codex_version": _codex_version(),
        "phase_count": validation.get("phase_count"),
        "supported_render_modes": sorted(SUPPORTED_GLYPH_RENDER_MODES),
        "required_packet_fields": REQUIRED_GLYPH_PACKET_FIELDS,
        "canonical_renderer": CANONICAL_RENDERER,
        "image_generation_is_authority": False,
        "phase_preview": {
            phase: {
                "glyph": get_phase_profile(phase).get("glyph"),
                "hex": get_phase_profile(phase).get("hex"),
                "code_identifier": get_phase_profile(phase).get("code_identifier"),
            }
            for phase in sorted(get_phase_profiles().keys())
        },
        "schema_contract": glyph_renderer_schema_contract(),
        "boundary": glyph_renderer_boundary(),
        "writes_files": False,
        "memory_write_allowed": False,
    }
