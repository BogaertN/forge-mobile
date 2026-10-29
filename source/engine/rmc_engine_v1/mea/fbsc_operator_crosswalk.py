"""
forge/rmc_engine_v1/mea/fbsc_operator_crosswalk.py

MEA-DISCOVERY-KERNEL-MATH-CONFORMANCE-BUILD-006
FBSC Manifest Algebra to Forge Discovery Kernel runtime crosswalk.

This module records the lawful mapping between the existing FBSC symbolic
operator family and executable MEA runtime responsibilities. It does not claim
that every symbolic operator is a live public action; it states which runtime
module or future gate carries each meaning and verifies the currently required
bindings for the 144 Hz conformance corridor.

Source law:
    d_i = O_gen(M_t)              unverified draft
    c_i = O_verify ∘ O_gen(M_t)   verified candidate

No writes, no routes, no rendering, no LLM, no databases, no Chroma.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, Tuple

from rmc_engine_v1.phase_codex import get_phase_profile, validate_phase_codex

from .fixed_point_math_contract import BUILD_ID, canonical_hash

SCHEMA_VERSION = "fbsc_manifest_operator_crosswalk_v1_build006"
COMPOSITION_LAW = "c_i = O_verify ∘ O_gen(M_t); d_i = O_gen(M_t) cannot be scored or sealed"


@dataclass(frozen=True)
class OperatorBinding:
    glyph: str
    symbolic_name: str
    symbolic_function: str
    mea_runtime_bindings: Tuple[str, ...]
    activation_status: str
    hard_boundary: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


_BINDINGS = (
    OperatorBinding(
        glyph="⧒",
        symbolic_name="Recursive Amplification",
        symbolic_function="Expand a coherent signal into a bounded candidate path.",
        mea_runtime_bindings=("expand", "hypothesize", "simulate"),
        activation_status="partially_implemented_hypothesize_live_in_operator_registry",
        hard_boundary="amplification_produces_draft_only_until_verified",
    ),
    OperatorBinding(
        glyph="⧀",
        symbolic_name="Symbolic Discharge / Collapse",
        symbolic_function="Discharge an incoherent or exhausted path.",
        mea_runtime_bindings=("rejected", "cold_stored", "spc_cold_storage_required"),
        activation_status="implemented_through_gate_and_containment_laws",
        hard_boundary="collapse_cannot_render_as_active_claim",
    ),
    OperatorBinding(
        glyph="⧧",
        symbolic_name="Resonance Severance",
        symbolic_function="Separate invalid linkage or split a compound uncertainty.",
        mea_runtime_bindings=("split", "check_contradiction", "reject"),
        activation_status="contract_bound_split_activation_future",
        hard_boundary="severance_cannot_delete_trace",
    ),
    OperatorBinding(
        glyph="⧜",
        symbolic_name="Recursive Integration / Memory",
        symbolic_function="Integrate a sealed bounded state into trace-bearing memory.",
        mea_runtime_bindings=("controlled_manifest_memory_writer", "manifest_memory_jsonl"),
        activation_status="implemented_build005_controlled_jsonl_write",
        hard_boundary="memory_requires_sealed_hash_receipt_preview_hash_and_approval",
    ),
    OperatorBinding(
        glyph="⧙",
        symbolic_name="Recursive Lock / Fusion",
        symbolic_function="Lock a verified candidate into a sealed manifest transition.",
        mea_runtime_bindings=("seal_engine", "seal_transaction_commit"),
        activation_status="implemented_patch297_controlled_seal_transition",
        hard_boundary="lock_requires_hard_gates_and_replay",
    ),
    OperatorBinding(
        glyph="⟁",
        symbolic_name="Resonance Merge",
        symbolic_function="Merge or bridge compatible manifest paths.",
        mea_runtime_bindings=("merge", "bridge"),
        activation_status="contract_bound_activation_future",
        hard_boundary="merge_requires_shared_goal_and_verification",
    ),
    OperatorBinding(
        glyph="ΔΦ",
        symbolic_name="Phase Differential",
        symbolic_function="Measure and gate phase movement across manifest evolution.",
        mea_runtime_bindings=("check_phase", "phase_state", "phase_path", "gate_engine"),
        activation_status="implemented_phase_gate_contract",
        hard_boundary="illegal_phase_transition_cannot_seal",
    ),
)


def operator_bindings() -> Tuple[OperatorBinding, ...]:
    return _BINDINGS


def binding_for_glyph(glyph: str) -> OperatorBinding:
    for binding in _BINDINGS:
        if binding.glyph == glyph:
            return binding
    raise KeyError(f"Unknown FBSC operator glyph: {glyph!r}")


def _normalize_phase(phase_id: str) -> str:
    text = str(phase_id).strip()
    if text.startswith("Phi"):
        return "Φ" + text[3:]
    return text


def phase_binding(phase_id: str) -> Dict[str, Any]:
    normalized = _normalize_phase(phase_id)
    profile = get_phase_profile(normalized)
    if not profile:
        raise ValueError(f"Phase is not present in FBSC Phase Glyph Codex binding: {phase_id!r}")
    return {
        "requested_phase_id": phase_id,
        "normalized_phase_id": normalized,
        "phase_name": profile.get("phase_name"),
        "glyph": profile.get("glyph"),
        "code_identifier": profile.get("code_identifier"),
        "function_hook": profile.get("function_hook"),
        "state_signature": profile.get("state_signature"),
        "gate_role": profile.get("gate_role"),
    }


def crosswalk_report() -> Dict[str, Any]:
    codex = validate_phase_codex()
    bindings = [item.to_dict() for item in _BINDINGS]
    body = {
        "build_id": BUILD_ID,
        "schema_version": SCHEMA_VERSION,
        "composition_law": COMPOSITION_LAW,
        "fbsc_phase_codex_valid": bool(codex.get("status") == "OK" and not codex.get("missing_phases") and not codex.get("field_failures")),
        "phase5_binding": phase_binding("Phi5"),
        "phase9_binding": phase_binding("Φ9"),
        "operator_bindings": bindings,
        "required_current_corridor_bindings": {
            "hypothesis_candidate": binding_for_glyph("⧒").activation_status,
            "sealed_transition": binding_for_glyph("⧙").activation_status,
            "manifest_memory_record": binding_for_glyph("⧜").activation_status,
            "phase_gate": binding_for_glyph("ΔΦ").activation_status,
        },
        "future_activation_not_overclaimed": ("split", "merge", "bridge", "simulate"),
        "writes_files": False,
        "writes_memory": False,
        "renders_output": False,
    }
    return {**body, "crosswalk_hash": canonical_hash(body)}


def crosswalk_boundary() -> Dict[str, Any]:
    return {
        "build_id": BUILD_ID,
        "schema_version": SCHEMA_VERSION,
        "composition_law": COMPOSITION_LAW,
        "binds_fbsc_glyph_semantics_to_mea_runtime_contracts": True,
        "activates_unimplemented_public_operations": False,
        "writes_files": False,
        "writes_memory": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "writes_chroma": False,
        "calls_llm": False,
        "renders_output": False,
    }


__all__ = [
    "OperatorBinding", "COMPOSITION_LAW", "operator_bindings",
    "binding_for_glyph", "phase_binding", "crosswalk_report",
    "crosswalk_boundary",
]
