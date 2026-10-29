"""
forge/rmc_engine_v1/renderer/grammar_templates.py

RMC-NON-LLM-RENDERER-AND-SEMANTIC-LEXICON-BUILD-009
Finite grammar templates for unapproved deterministic render previews.

This module performs rule-based sentence planning only.  It receives the
validated semantic plan produced from the Build 008 admission packet and
selects fixed sentences from governed atoms.  It cannot add a new claim,
evidence source, confidence upgrade, or approval state.
"""
from __future__ import annotations

from typing import Any, Dict, Mapping, Sequence

from rmc_engine_v1.mea.fixed_point_math_contract import canonical_hash
from rmc_engine_v1.renderer.semantic_lexicon import (
    BUILD_ID,
    CONTROLLED_ATOMS,
    SEMANTIC_PLAN_SCHEMA_VERSION,
    SUPPORTED_DELIVERY_MODES,
)

SCHEMA_VERSION = "rmc_grammar_templates_v1_build009"
SENTENCE_PLAN_SCHEMA_VERSION = "rmc_sentence_plan_v1_build009"

# Each delivery mode is a delivery choice only; all modes remain within the
# same admitted qualified-hypothesis meaning.
_MODE_CLAUSES = {
    "explanation": (
        ("classification", "subject_reference", "hypothesis_classification"),
        ("limitation", "not_verified"),
        ("action", "test_required"),
        ("proof_debt", "proof_debt_preserved"),
        ("approval", "echo_pending"),
    ),
    "decision": (
        ("scope", "admission_limited"),
        ("classification", "subject_reference", "hypothesis_classification"),
        ("limitation", "not_verified"),
        ("action", "test_required"),
        ("approval", "echo_pending"),
    ),
    "warning": (
        ("limitation", "not_verified"),
        ("discovery", "not_discovery"),
        ("classification", "subject_reference", "hypothesis_classification"),
        ("action", "test_required"),
        ("approval", "echo_pending"),
    ),
    "verification_result": (
        ("verification", "seal_replay_verified"),
        ("truth_boundary", "truth_not_proven"),
        ("classification", "subject_reference", "hypothesis_classification"),
        ("action", "test_required"),
        ("proof_debt", "proof_debt_preserved"),
        ("approval", "echo_pending"),
    ),
    "next_step": (
        ("classification", "subject_reference", "hypothesis_classification"),
        ("action", "test_required"),
        ("limitation", "not_verified"),
        ("approval", "echo_pending"),
    ),
    "refusal": (
        ("refusal", "cannot_upgrade"),
        ("classification", "subject_reference", "hypothesis_classification"),
        ("action", "test_required"),
        ("approval", "echo_pending"),
    ),
    "uncertain_result": (
        ("uncertainty", "uncertainty_preserved"),
        ("classification", "subject_reference", "hypothesis_classification"),
        ("action", "test_required"),
        ("proof_debt", "proof_debt_preserved"),
        ("limitation", "not_verified"),
        ("approval", "echo_pending"),
    ),
}


def grammar_templates_boundary() -> Dict[str, Any]:
    return {
        "build_id": BUILD_ID,
        "schema_version": SCHEMA_VERSION,
        "rule_based_sentence_planning": True,
        "supported_delivery_modes": list(SUPPORTED_DELIVERY_MODES),
        "introduces_new_claims": False,
        "introduces_new_evidence": False,
        "changes_epistemic_status": False,
        "approves_output": False,
        "calls_llm": False,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
    }


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def build_sentence_plan(semantic_plan: Mapping[str, Any]) -> Dict[str, Any]:
    """Return a deterministic ordered sentence plan from governed atoms."""
    if not isinstance(semantic_plan, Mapping):
        return {"status": "REJECTED", "accepted": False, "reason_code": "semantic_plan_mapping_required"}
    if semantic_plan.get("schema_version") != SEMANTIC_PLAN_SCHEMA_VERSION:
        return {"status": "REJECTED", "accepted": False, "reason_code": "semantic_plan_schema_invalid"}
    if semantic_plan.get("build_id") != BUILD_ID:
        return {"status": "REJECTED", "accepted": False, "reason_code": "semantic_plan_build_invalid"}
    body = {key: value for key, value in semantic_plan.items() if key != "semantic_plan_hash"}
    if canonical_hash(body) != semantic_plan.get("semantic_plan_hash"):
        return {"status": "REJECTED", "accepted": False, "reason_code": "semantic_plan_hash_invalid"}

    mode = semantic_plan.get("delivery_mode")
    if mode not in _MODE_CLAUSES:
        return {"status": "REJECTED", "accepted": False, "reason_code": "unsupported_delivery_mode"}

    atoms = _mapping(semantic_plan.get("controlled_atoms"))
    if atoms != CONTROLLED_ATOMS:
        return {"status": "REJECTED", "accepted": False, "reason_code": "controlled_atom_set_modified"}

    clauses: list[Dict[str, Any]] = []
    for position, clause_spec in enumerate(_MODE_CLAUSES[str(mode)], start=1):
        role, *atom_ids = clause_spec
        missing = [atom_id for atom_id in atom_ids if atom_id not in atoms]
        if missing:
            return {
                "status": "REJECTED",
                "accepted": False,
                "reason_code": "required_controlled_atom_missing",
                "errors": missing,
            }
        clauses.append({
            "position": position,
            "role": role,
            "atom_ids": list(atom_ids),
            "sentence": " ".join(atoms[atom_id] for atom_id in atom_ids) + ".",
        })

    plan_body = {
        "schema_version": SENTENCE_PLAN_SCHEMA_VERSION,
        "build_id": BUILD_ID,
        "delivery_mode": mode,
        "semantic_plan_hash": semantic_plan["semantic_plan_hash"],
        "semantic_class": semantic_plan["semantic_class"],
        "epistemic_contract": dict(_mapping(semantic_plan.get("epistemic_contract"))),
        "clauses": clauses,
        "echo_validation_required": True,
        "approved_output": False,
    }
    return {
        "status": "OK",
        "accepted": True,
        "sentence_plan": {**plan_body, "sentence_plan_hash": canonical_hash(plan_body)},
    }


__all__ = [
    "SCHEMA_VERSION",
    "SENTENCE_PLAN_SCHEMA_VERSION",
    "grammar_templates_boundary",
    "build_sentence_plan",
]
