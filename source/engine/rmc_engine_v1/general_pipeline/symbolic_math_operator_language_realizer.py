"""LANG-EXPR-001 / GP-014 — measured operator-guided realization for sealed math meaning.

This production module extends the live NL-MATH-001 / GP-013 path after a
mathematical result has already been computed, bound into MEA evidence, sealed,
and compiled as a Manifest Contract v2 meaning object.  It performs no
mathematics, creates no truth claim, activates no MEA operator, writes no state,
and authorizes no delivery.

The realizer implements the first bounded Chomsky-inspired externalization
slice for verified mathematical output: finite lexical means are merged into
multiple hierarchical clause trees, each candidate is measured against locked
manifest meaning, existing FBSC operator semantics are recorded as read-only
expression controls, and only a non-severed candidate may be sent downstream to
Forge's already-installed actual Echo gate.

The operator/scoring boundary is measurable rather than decorative:
  ⧙ locks exact meaning atoms and measures atom retention.
  ⟁ forms a hierarchical clause tree and measures structural integrity.
  ΔΦ measures the verified-to-named-to-projected phase sequence.
  ⧧ severs any candidate with semantic or governance distortion.
  ⧀ records contained discharge of rejected candidates without delivery.

All measurement functions used here are inherited from the installed RMC
measurement kernel and are side-effect free.
"""
from __future__ import annotations

from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple
import json

from rmc_engine_v1.measurement_kernel import (
    content_terms,
    drift_severity_score,
    normalized_shannon_entropy,
    phase_path_metrics,
    semantic_distance,
    structure_delta,
    structure_signature,
    symbolic_epsilon,
    tokens,
)
from rmc_engine_v1.mea.fbsc_operator_crosswalk import binding_for_glyph, phase_binding

from .contracts import MeaningManifest, canonical_hash
from .manifest_contract_v2 import ManifestContractV2, require_render_authority
from .symbolic_math_kernel import SUCCESS_STATUS

BUILD_ID = "LANG-EXPR-001-GP-014-RMC-OPERATOR-GUIDED-GENERATIVE-LANGUAGE-REALIZER"
SCHEMA_VERSION = "aiweb_rmc_operator_guided_math_expression_realizer_v1_gp014"
LEXICON_FILENAME = "symbolic_math_expression_lexicon_v1_gp014.json"
LEXICON_AUTHORITY_CLASS = "BOUNDED_VERSIONED_EXPRESSION_LEXICON_NOT_CORPUS"
REQUIRED_OPERATOR_PATH = ("⧙", "⟁", "ΔΦ", "⧧", "⧀")
PHASE_EXTERNALIZATION_SEQUENCE = ("Φ6", "Φ7", "Φ8")
SEVER_SEMANTIC_DISTANCE_LIMIT = 0.76
SEVER_DRIFT_LIMIT = 0.44
SEVER_EPSILON_LIMIT = 0.28


class SymbolicMathExpressionRealizerError(ValueError):
    """Raised when a sealed meaning object cannot lawfully be externalized."""


@dataclass(frozen=True)
class ExpressionCandidate:
    candidate_id: str
    surface_template_id: str
    text: str
    result_clause: str
    clause_tree: Tuple[Dict[str, str], ...]
    hard_gate_checks: Dict[str, bool]
    operator_measurements: Dict[str, Any]
    measurement_readings: Dict[str, Any]
    rejected_reasons: Tuple[str, ...]
    clarity_score: float
    continuity_score: float
    lexical_smoothness_score: float
    repetition_penalty: float
    final_score: float
    candidate_hash: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class OperatorGuidedExpressionReceipt:
    schema_version: str
    build_id: str
    meaning_manifest_hash: str
    manifest_contract_v2_hash: str
    lexicon_hash: str
    authority_class: str
    operation_family: str
    locked_atom_hash: str
    locked_atoms: Dict[str, str]
    operator_path: Tuple[Dict[str, Any], ...]
    phase_externalization_path: Tuple[Dict[str, Any], ...]
    phase_transition_metrics: Dict[str, Any]
    scoring_formula: str
    candidates: Tuple[ExpressionCandidate, ...]
    accepted_candidate_count: int
    rejected_candidate_count: int
    selected_candidate_id: str
    selected_candidate_hash: str
    selected_text: str
    selected_score: float
    actual_echo_invoked: bool = False
    delivery_authorized: bool = False
    render_preview_only_until_echo: bool = True
    corpus_used: bool = False
    llm_used: bool = False
    writes_memory: bool = False
    writes_identity_vault: bool = False
    writes_contribution_economy: bool = False
    mints_ct: bool = False
    writes_ledgers: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "build_id": self.build_id,
            "meaning_manifest_hash": self.meaning_manifest_hash,
            "manifest_contract_v2_hash": self.manifest_contract_v2_hash,
            "lexicon_hash": self.lexicon_hash,
            "authority_class": self.authority_class,
            "operation_family": self.operation_family,
            "locked_atom_hash": self.locked_atom_hash,
            "locked_atoms": dict(sorted(self.locked_atoms.items())),
            "operator_path": list(self.operator_path),
            "phase_externalization_path": list(self.phase_externalization_path),
            "phase_transition_metrics": self.phase_transition_metrics,
            "scoring_formula": self.scoring_formula,
            "candidates": [item.to_dict() for item in self.candidates],
            "accepted_candidate_count": self.accepted_candidate_count,
            "rejected_candidate_count": self.rejected_candidate_count,
            "selected_candidate_id": self.selected_candidate_id,
            "selected_candidate_hash": self.selected_candidate_hash,
            "selected_text": self.selected_text,
            "selected_score": self.selected_score,
            "actual_echo_invoked": self.actual_echo_invoked,
            "delivery_authorized": self.delivery_authorized,
            "render_preview_only_until_echo": self.render_preview_only_until_echo,
            "corpus_used": self.corpus_used,
            "llm_used": self.llm_used,
            "writes_memory": self.writes_memory,
            "writes_identity_vault": self.writes_identity_vault,
            "writes_contribution_economy": self.writes_contribution_economy,
            "mints_ct": self.mints_ct,
            "writes_ledgers": self.writes_ledgers,
        }

    def receipt_hash(self) -> str:
        return canonical_hash(self.to_dict())


def _lexicon_path() -> Path:
    return Path(__file__).resolve().parents[1] / "reference" / LEXICON_FILENAME


def _load_lexicon() -> Dict[str, Any]:
    path = _lexicon_path()
    if not path.is_file():
        raise SymbolicMathExpressionRealizerError(f"versioned expression lexicon missing: {LEXICON_FILENAME}")
    value = json.loads(path.read_text(encoding="utf-8"))
    if value.get("schema_version") != "aiweb_symbolic_math_expression_lexicon_v1_gp014":
        raise SymbolicMathExpressionRealizerError("expression lexicon schema is not authorized")
    if value.get("authority_class") != LEXICON_AUTHORITY_CLASS:
        raise SymbolicMathExpressionRealizerError("expression lexicon cannot claim corpus authority")
    if any("score" in template for family in value.get("operation_families", {}).values() for template in family.get("templates", [])):
        raise SymbolicMathExpressionRealizerError("expression lexicon may define language means, not pre-awarded scores")
    return value


def _fact(meaning: MeaningManifest, prefix: str, required: bool = True) -> str:
    for row in meaning.given_facts:
        if row.startswith(prefix):
            return row[len(prefix):].strip()
    if required:
        raise SymbolicMathExpressionRealizerError(f"meaning manifest missing locked fact {prefix!r}")
    return ""


def _sentence(text: str) -> str:
    cleaned = str(text).strip()
    if not cleaned:
        return ""
    return cleaned if cleaned.endswith((".", "!", "?")) else cleaned + "."


def _locked_atoms(meaning: MeaningManifest, scope_sentence: str, noun_anchor: str) -> Dict[str, str]:
    expression = _fact(meaning, "expression is ")
    variable = _fact(meaning, "variable is ", required=False)
    atoms = {
        "operation_family": meaning.operation_word,
        "noun_anchor": noun_anchor,
        "expression": expression,
        "answer": meaning.answer_text,
        "verification": meaning.verification_text,
        "scope_boundary": scope_sentence,
    }
    if variable:
        atoms["variable"] = variable
    if any(not str(value).strip() for value in atoms.values()):
        raise SymbolicMathExpressionRealizerError("required meaning atom is empty")
    return atoms


def _render_operator_path() -> Tuple[Dict[str, Any], ...]:
    roles = {
        "⧙": "lock_required_meaning_atoms_and_measure_retention",
        "⟁": "merge_locked_atoms_into_hierarchical_clause_tree_and_measure_structure",
        "ΔΦ": "measure_verified_to_named_to_projected_transition_legality",
        "⧧": "sever_candidate_when_fidelity_or_drift_gate_fails",
        "⧀": "discharge_rejected_candidate_without_delivery",
    }
    rows: List[Dict[str, Any]] = []
    for glyph in REQUIRED_OPERATOR_PATH:
        binding = binding_for_glyph(glyph)
        rows.append({
            "glyph": binding.glyph,
            "symbolic_name": binding.symbolic_name,
            "source_runtime_binding_status": binding.activation_status,
            "render_role": roles[glyph],
            "usage_class": "read_only_expression_planning_reference_not_mea_operator_activation",
            "authorizes_delivery": False,
        })
    return tuple(rows)


def _phase_path() -> Tuple[Dict[str, Any], ...]:
    correction = phase_binding("Φ6")
    naming = phase_binding("Φ7")
    projection = phase_binding("Φ8")
    return (
        {**correction, "expression_role": "inherited_verified_evidence_gate_before_externalization"},
        {**naming, "expression_role": "meaning_locked_before_language_projection"},
        {**projection, "expression_role": "candidate_surface_externalized_pending_actual_echo"},
    )


def _lexical_scaffold(result_clause: str, atoms: Dict[str, str]) -> str:
    scaffold = result_clause
    for key in ("expression", "answer", "variable"):
        value = atoms.get(key, "")
        if value:
            scaffold = scaffold.replace(value, " ")
    return " ".join(scaffold.split())


def _surface_measurements(
    *,
    clause_rows: List[Dict[str, str]],
    text: str,
    result_clause: str,
    atoms: Dict[str, str],
    hard_gates: Dict[str, bool],
) -> Tuple[Dict[str, Any], Dict[str, Any], Tuple[str, ...], float, float, float, float, float]:
    expected_roles = ["verified_result", "bounded_method_trace", "verification_strength", "scope_boundary"]
    observed_roles = [row["role"] for row in clause_rows]
    role_order_pass = observed_roles == expected_roles
    retained = [name for name, ok in hard_gates.items() if ok and name.endswith("_locked")]
    locked_required = ["answer_locked", "expression_locked", "operation_anchor_locked", "verification_locked", "scope_boundary_locked"]
    lock_integrity = round(sum(1 for name in locked_required if hard_gates.get(name)) / len(locked_required), 6)
    scaffold = _lexical_scaffold(result_clause, atoms)
    scaffold_tokens = tokens(scaffold)
    scaffold_counts = Counter(scaffold_tokens)
    repeated_count = sum(max(0, count - 1) for count in scaffold_counts.values())
    repetition_penalty = round(min(1.0, repeated_count / max(1, len(scaffold_tokens))), 6)
    lexical_diversity = round((len(set(scaffold_tokens)) / max(1, len(scaffold_tokens))), 6)
    lexical_entropy = normalized_shannon_entropy(scaffold)
    expected_tree = [{"role": role, "text": ""} for role in expected_roles]
    tree_signature = structure_signature(clause_rows)
    structural_delta = structure_delta(clause_rows, expected_tree)
    structure_integrity = round(max(0.0, 1.0 - structural_delta), 6)
    semantic_reference = " ".join(str(atoms[key]) for key in ("operation_family", "noun_anchor", "expression", "answer", "verification", "scope_boundary") if key in atoms)
    meaning_distance = semantic_distance(semantic_reference, text)
    meaning_fidelity = round(max(0.0, 1.0 - meaning_distance), 6)
    phase_metrics = phase_path_metrics(list(PHASE_EXTERNALIZATION_SEQUENCE))
    transition_continuity = round(
        (0.55 if role_order_pass else 0.0)
        + (0.45 * float(phase_metrics.get("phase_validity_score", 0.0))), 6
    )
    transition_continuity = min(1.0, transition_continuity)
    d_score = drift_severity_score(
        entropy_score=repetition_penalty,
        structure_delta_score=structural_delta,
        semantic_distance_score=meaning_distance,
        phase_deviation=float(phase_metrics.get("max_delta_phi", 0.0)),
        taxonomy_score=0.0,
    )
    epsilon_s = symbolic_epsilon(0.0, d_score, float(phase_metrics.get("max_delta_phi", 0.0)), 3)
    rejected: List[str] = [name for name, value in hard_gates.items() if not value]
    if not role_order_pass:
        rejected.append("clause_hierarchy_transition_invalid")
    if not phase_metrics.get("phase_path_legal", False):
        rejected.append("phase_externalization_path_illegal")
    if meaning_distance > SEVER_SEMANTIC_DISTANCE_LIMIT:
        rejected.append("semantic_distance_exceeds_sever_limit")
    if d_score > SEVER_DRIFT_LIMIT:
        rejected.append("expression_drift_exceeds_sever_limit")
    if epsilon_s > SEVER_EPSILON_LIMIT:
        rejected.append("expression_epsilon_exceeds_projection_limit")
    lexical_smoothness = round(0.60 * lexical_diversity + 0.40 * lexical_entropy, 6)
    clarity = round(0.55 * lock_integrity + 0.45 * meaning_fidelity, 6)
    final_score = round(max(0.0, min(1.0,
        0.34 * meaning_fidelity
        + 0.20 * structure_integrity
        + 0.18 * transition_continuity
        + 0.14 * lexical_smoothness
        + 0.14 * lock_integrity
        - 0.18 * d_score
        - 0.10 * repetition_penalty
    )), 6)
    readings = {
        "uses_installed_measurement_kernel": True,
        "semantic_distance": meaning_distance,
        "meaning_fidelity": meaning_fidelity,
        "locked_atom_retention": lock_integrity,
        "lexical_scaffold": scaffold,
        "lexical_token_count": len(scaffold_tokens),
        "lexical_diversity": lexical_diversity,
        "normalized_shannon_entropy": lexical_entropy,
        "repetition_penalty": repetition_penalty,
        "clause_tree_signature": tree_signature,
        "clause_tree_structure_delta": structural_delta,
        "structure_integrity": structure_integrity,
        "phase_transition_metrics": phase_metrics,
        "transition_continuity": transition_continuity,
        "drift_severity_D_score": d_score,
        "symbolic_epsilon_s": epsilon_s,
        "sever_thresholds": {
            "semantic_distance_max": SEVER_SEMANTIC_DISTANCE_LIMIT,
            "drift_score_max": SEVER_DRIFT_LIMIT,
            "epsilon_s_max": SEVER_EPSILON_LIMIT,
        },
    }
    operator_measurements = {
        "⧙": {"operation": "lock", "locked_atom_hash": canonical_hash(atoms), "lock_integrity": lock_integrity, "retained_required_checks": retained},
        "⟁": {"operation": "merge", "clause_tree_signature": tree_signature, "structure_delta": structural_delta, "structure_integrity": structure_integrity},
        "ΔΦ": {"operation": "transition", "phase_metrics": phase_metrics, "role_order_pass": role_order_pass, "transition_continuity": transition_continuity},
        "⧧": {"operation": "sever", "semantic_distance": meaning_distance, "drift_severity_D_score": d_score, "symbolic_epsilon_s": epsilon_s, "severed": bool(rejected)},
        "⧀": {"operation": "discharge", "discharged_without_delivery": bool(rejected), "delivery_authorized": False},
    }
    return operator_measurements, readings, tuple(dict.fromkeys(rejected)), clarity, transition_continuity, lexical_smoothness, repetition_penalty, final_score


def _candidate_from_template(
    *,
    template: Dict[str, Any],
    meaning: MeaningManifest,
    atoms: Dict[str, str],
    scope_sentence: str,
    forbidden_fragments: Iterable[str],
) -> ExpressionCandidate:
    variable = atoms.get("variable", "")
    variable_clause = f" with respect to {variable}" if variable else ""
    result_clause = str(template["text"]).format(
        expression=atoms["expression"],
        answer=atoms["answer"],
        variable=variable,
        variable_clause=variable_clause,
    )
    reasoning = " ".join(_sentence(step) for step in meaning.reasoning_steps if str(step).strip())
    if not reasoning:
        raise SymbolicMathExpressionRealizerError("sealed meaning manifest has no bounded method trace")
    clause_rows = [
        {"role": "verified_result", "text": _sentence(result_clause)},
        {"role": "bounded_method_trace", "text": reasoning},
        {"role": "verification_strength", "text": _sentence(atoms["verification"])},
        {"role": "scope_boundary", "text": _sentence(scope_sentence)},
    ]
    text = " ".join(row["text"] for row in clause_rows)
    low = text.lower()
    gates = {
        "answer_locked": atoms["answer"] in text,
        "expression_locked": atoms["expression"] in text,
        "operation_anchor_locked": atoms["noun_anchor"].lower() in low,
        "verification_locked": atoms["verification"] in text,
        "scope_boundary_locked": scope_sentence in text,
        "variable_locked_when_required": (not variable) or variable in text,
        "no_empirical_upgrade": not any(fragment.lower() in low for fragment in forbidden_fragments),
        "no_delivery_claim": "delivery authorized" not in low and "echo approved" not in low,
    }
    measurements, readings, rejected, clarity, continuity, smoothness, penalty, score = _surface_measurements(
        clause_rows=clause_rows, text=text, result_clause=result_clause, atoms=atoms, hard_gates=gates
    )
    body = {
        "surface_template_id": str(template["id"]),
        "text": text,
        "clause_tree": clause_rows,
        "hard_gate_checks": gates,
        "operator_measurements": measurements,
        "measurement_readings": readings,
        "rejected_reasons": list(rejected),
        "clarity_score": clarity,
        "continuity_score": continuity,
        "lexical_smoothness_score": smoothness,
        "repetition_penalty": penalty,
        "final_score": score,
    }
    chash = canonical_hash(body)
    return ExpressionCandidate(
        candidate_id="expr_candidate_" + chash[:16],
        surface_template_id=str(template["id"]),
        text=text,
        result_clause=_sentence(result_clause),
        clause_tree=tuple(clause_rows),
        hard_gate_checks=gates,
        operator_measurements=measurements,
        measurement_readings=readings,
        rejected_reasons=rejected,
        clarity_score=clarity,
        continuity_score=continuity,
        lexical_smoothness_score=smoothness,
        repetition_penalty=penalty,
        final_score=score,
        candidate_hash=chash,
    )


def realize_operator_guided_symbolic_math_expression(
    meaning: MeaningManifest,
    contract: ManifestContractV2,
) -> OperatorGuidedExpressionReceipt:
    """Generate measured lawful text candidates without calling Echo or authorizing output."""
    require_render_authority(contract, meaning)
    if contract.symbolic_math_computation_status != SUCCESS_STATUS:
        raise SymbolicMathExpressionRealizerError("expression realization requires verified pending-governance computation")
    lexicon = _load_lexicon()
    family_map = lexicon.get("operation_families", {})
    family = meaning.operation_word
    if family not in family_map:
        raise SymbolicMathExpressionRealizerError("expression lexicon does not authorize this operation family")
    family_spec = family_map[family]
    scope_sentence = str(lexicon["scope_sentence"])
    atoms = _locked_atoms(meaning, scope_sentence, str(family_spec["noun_anchor"]))
    candidates = tuple(
        _candidate_from_template(
            template=template,
            meaning=meaning,
            atoms=atoms,
            scope_sentence=scope_sentence,
            forbidden_fragments=tuple(lexicon["forbidden_claim_fragments"]),
        )
        for template in family_spec["templates"]
    )
    acceptable = [candidate for candidate in candidates if not candidate.rejected_reasons]
    if not acceptable:
        raise SymbolicMathExpressionRealizerError("all generated language candidates were severed by fidelity and drift gates")
    selected = sorted(acceptable, key=lambda row: (-row.final_score, row.surface_template_id, row.candidate_hash))[0]
    phase_metrics = phase_path_metrics(list(PHASE_EXTERNALIZATION_SEQUENCE))
    return OperatorGuidedExpressionReceipt(
        schema_version=SCHEMA_VERSION,
        build_id=BUILD_ID,
        meaning_manifest_hash=meaning.meaning_hash(),
        manifest_contract_v2_hash=contract.contract_hash(),
        lexicon_hash=canonical_hash(lexicon),
        authority_class=LEXICON_AUTHORITY_CLASS,
        operation_family=family,
        locked_atom_hash=canonical_hash(atoms),
        locked_atoms=atoms,
        operator_path=_render_operator_path(),
        phase_externalization_path=_phase_path(),
        phase_transition_metrics=phase_metrics,
        scoring_formula="0.34*meaning_fidelity + 0.20*structure_integrity + 0.18*transition_continuity + 0.14*lexical_smoothness + 0.14*locked_atom_retention - 0.18*D_score - 0.10*repetition_penalty",
        candidates=candidates,
        accepted_candidate_count=len(acceptable),
        rejected_candidate_count=len(candidates) - len(acceptable),
        selected_candidate_id=selected.candidate_id,
        selected_candidate_hash=selected.candidate_hash,
        selected_text=selected.text,
        selected_score=selected.final_score,
    )


def operator_guided_language_realizer_boundary() -> Dict[str, Any]:
    lexicon = _load_lexicon()
    return {
        "build_id": BUILD_ID,
        "schema_version": SCHEMA_VERSION,
        "layer": "RMC operator-guided generative language realization downstream of sealed verified mathematics meaning",
        "expression_lexicon_schema": lexicon["schema_version"],
        "expression_lexicon_authority_class": lexicon["authority_class"],
        "expression_lexicon_hash": canonical_hash(lexicon),
        "supported_operation_families": sorted(lexicon["operation_families"]),
        "supported_operation_family_count": len(lexicon["operation_families"]),
        "finite_means_generate_multiple_surface_candidates": True,
        "hierarchical_clause_tree_generated": True,
        "uses_fbsc_operator_crosswalk_read_only": True,
        "uses_installed_measurement_kernel": True,
        "candidate_scores_are_computed_not_lexicon_awarded": True,
        "measured_candidate_features": [
            "locked_atom_retention", "clause_tree_structure_delta", "meaning_semantic_distance",
            "lexical_diversity", "normalized_shannon_entropy", "repetition_penalty",
            "phase_transition_metrics", "drift_severity_D_score", "symbolic_epsilon_s",
        ],
        "operator_path": list(REQUIRED_OPERATOR_PATH),
        "phase_externalization_sequence": list(PHASE_EXTERNALIZATION_SEQUENCE),
        "activates_preview_mea_operator_engine": False,
        "uses_historical_renderer_preview_lane": False,
        "meaning_locked_before_phrase_selection": True,
        "actual_echo_invoked_here": False,
        "delivery_authority_created_here": False,
        "actual_echo_required_after_selection": True,
        "corpus_ingestion_added": False,
        "calls_llm": False,
        "writes_memory": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "mints_ct": False,
        "writes_ledgers": False,
    }


__all__ = [
    "BUILD_ID", "SCHEMA_VERSION", "LEXICON_FILENAME", "LEXICON_AUTHORITY_CLASS",
    "SymbolicMathExpressionRealizerError", "ExpressionCandidate",
    "OperatorGuidedExpressionReceipt", "realize_operator_guided_symbolic_math_expression",
    "operator_guided_language_realizer_boundary",
]
