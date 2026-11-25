"""Closed, inert Slice 36C symbolic grammar-operator registry.

The registry records operator responsibilities and authority boundaries only.
It contains no lexeme table, pattern matcher, proposal rule, source binding,
phase assignment, operator implementation, semantic selection, or action route.
"""

from __future__ import annotations

from typing import Final

from ..schema import stable_record_id
from ..source_field_projection import SOURCE_FIELD_SCHEMA_ID
from .schema import (
    CANONICAL_ROADMAP_AUTHORITY_REF,
    EXPECTED_FBSC_CANONICAL_OPERATOR_COUNT,
    EXPECTED_GRAMMAR_OPERATOR_COUNT,
    EXPECTED_REQUIRED_FAMILY_COUNT,
    FBSC_VOLUME_II_AUTHORITY_REF,
    GRAMMAR_OPERATOR_PROPOSAL_SCHEMA_ID,
    GRAMMAR_OPERATOR_REGISTRY_SCHEMA_ID,
    GRAMMAR_OPERATOR_SCHEMA_ID,
    REGISTRY_SCHEMA_VERSION,
    REGISTRY_SPEC_ID,
    REGISTRY_SPEC_VERSION,
    RMC_LANGUAGE_LAW_AUTHORITY_REF,
    RSOC_CONTRACT_AUTHORITY_REF,
    SOURCE_FIELD_AUTHORITY_REF,
    GrammarOperatorCompatibilityStatus,
    GrammarOperatorCommutationStatus,
    GrammarOperatorDefinition,
    GrammarOperatorDriftEffectStatus,
    GrammarOperatorEffect,
    GrammarOperatorEntropyEffectStatus,
    GrammarOperatorFamily,
    GrammarOperatorMalformedBehavior,
    GrammarOperatorOrigin,
    GrammarOperatorPhaseAffinityStatus,
    GrammarOperatorRuntimeStatus,
    GrammarOperatorUncertaintyBehavior,
    GrammarOperatorUnsupportedBehavior,
    SymbolicGrammarOperatorRegistry,
)


_COMMON_PERMITTED_PREREQUISITES: Final[tuple[str, ...]] = (
    "validated_slice36b_source_field_projection",
    "source_field_status_supported",
    "structural_progression_allowed",
    "exact_source_span_membership",
    "source_ordering_and_adjacency_preserved",
    "source_ancestry_complete",
    "exact_versioned_proposal_rule_required",
)

_COMMON_PROHIBITED_PREREQUISITES: Final[tuple[str, ...]] = (
    "unsupported_or_malformed_source_field",
    "source_text_normalized_replaced_or_repaired",
    "synthetic_or_out_of_range_source_span",
    "missing_source_event_or_projection_ancestry",
    "lexical_similarity_or_phrase_familiarity",
    "statistical_probability_or_confidence_scoring",
    "embedding_vector_or_neural_model_output",
    "legacy_parser_or_legacy_resonance_lexicon_output",
    "memory_web_file_search_or_context_convenience",
)

_COMMON_SOURCE_SPAN_REQUIREMENTS: Final[tuple[str, ...]] = (
    "one_or_more_exact_existing_source_span_ids",
    "code_point_and_utf8_byte_offsets_preserved",
    "no_synthetic_span_generation",
    "span_must_belong_to_supplied_projection",
)

_COMMON_ANCESTRY_REQUIREMENTS: Final[tuple[str, ...]] = (
    "slice36a_source_event_identity",
    "slice36a_root_source_span_identity",
    "slice36b0_root_field_contract_identity",
    "slice36b_projection_identity",
)

_COMMON_AUTHORITY_REFS: Final[tuple[str, ...]] = (
    FBSC_VOLUME_II_AUTHORITY_REF,
    RSOC_CONTRACT_AUTHORITY_REF,
    SOURCE_FIELD_AUTHORITY_REF,
    RMC_LANGUAGE_LAW_AUTHORITY_REF,
    CANONICAL_ROADMAP_AUTHORITY_REF,
)


# operator_key, name, family, origin, glyph, phase affinity, allowed effects,
# drift status, drift code
_OPERATOR_ROWS: Final[tuple[tuple[object, ...], ...]] = (
    (
        "fbsc_initiator",
        "Initiator",
        GrammarOperatorFamily.INITIATION,
        GrammarOperatorOrigin.FBSC_VOLUME_II_CANONICAL,
        "⊕",
        ("Φ1",),
        (GrammarOperatorEffect.PROPOSE,),
        GrammarOperatorDriftEffectStatus.NO_FORMAL_EFFECT_INSTALLED,
        "no_formal_drift_effect_installed",
    ),
    (
        "fbsc_desire_vector",
        "Desire Vector",
        GrammarOperatorFamily.VOLITION,
        GrammarOperatorOrigin.FBSC_VOLUME_II_CANONICAL,
        "⇋",
        ("Φ3",),
        (GrammarOperatorEffect.PROPOSE, GrammarOperatorEffect.TRANSFORM),
        GrammarOperatorDriftEffectStatus.NO_FORMAL_EFFECT_INSTALLED,
        "no_formal_drift_effect_installed",
    ),
    (
        "fbsc_structural_binding",
        "Structural Binding",
        GrammarOperatorFamily.STRUCTURAL_BINDING,
        GrammarOperatorOrigin.FBSC_VOLUME_II_CANONICAL,
        "⚯",
        ("Φ4",),
        (GrammarOperatorEffect.CONSTRAIN,),
        GrammarOperatorDriftEffectStatus.NO_FORMAL_EFFECT_INSTALLED,
        "no_formal_drift_effect_installed",
    ),
    (
        "fbsc_decay_mark",
        "Decay Mark",
        GrammarOperatorFamily.DECAY,
        GrammarOperatorOrigin.FBSC_VOLUME_II_CANONICAL,
        "↧",
        ("Φ5",),
        (GrammarOperatorEffect.CONSTRAIN, GrammarOperatorEffect.REJECT),
        GrammarOperatorDriftEffectStatus.DOCUMENTED_ADVISORY_ONLY,
        "fbsc_decay_mark_drift_warning_only_no_runtime_effect",
    ),
    (
        "fbsc_grace_override",
        "Grace Override",
        GrammarOperatorFamily.CORRECTION,
        GrammarOperatorOrigin.FBSC_VOLUME_II_CANONICAL,
        "†",
        ("Φ6",),
        (GrammarOperatorEffect.TRANSFORM, GrammarOperatorEffect.CONTAIN),
        GrammarOperatorDriftEffectStatus.DOCUMENTED_ADVISORY_ONLY,
        "fbsc_grace_override_repair_advisory_only_not_rsoc_christ_function",
    ),
    (
        "fbsc_name_declaration",
        "Name Declaration",
        GrammarOperatorFamily.NAMING,
        GrammarOperatorOrigin.FBSC_VOLUME_II_CANONICAL,
        "✎",
        ("Φ7",),
        (GrammarOperatorEffect.PROPOSE, GrammarOperatorEffect.CONSTRAIN),
        GrammarOperatorDriftEffectStatus.NO_FORMAL_EFFECT_INSTALLED,
        "no_formal_drift_effect_installed",
    ),
    (
        "fbsc_projection",
        "Projection",
        GrammarOperatorFamily.PROJECTION,
        GrammarOperatorOrigin.FBSC_VOLUME_II_CANONICAL,
        "↠",
        ("Φ8",),
        (GrammarOperatorEffect.PROPOSE, GrammarOperatorEffect.TRANSFORM),
        GrammarOperatorDriftEffectStatus.DOCUMENTED_ADVISORY_ONLY,
        "fbsc_projection_drift_risk_advisory_only_no_runtime_effect",
    ),
    (
        "fbsc_loop_seal",
        "Loop Seal",
        GrammarOperatorFamily.COMPLETION,
        GrammarOperatorOrigin.FBSC_VOLUME_II_CANONICAL,
        "⟲",
        ("Φ9",),
        (GrammarOperatorEffect.SEAL,),
        GrammarOperatorDriftEffectStatus.NO_FORMAL_EFFECT_INSTALLED,
        "no_formal_drift_effect_installed",
    ),
    (
        "grammar_continuation",
        "Continuation",
        GrammarOperatorFamily.CONTINUATION,
        GrammarOperatorOrigin.AIWEB_LANGUAGE_CORE_BOUNDED_EXTENSION,
        None,
        (),
        (GrammarOperatorEffect.CONSTRAIN,),
        GrammarOperatorDriftEffectStatus.NO_FORMAL_EFFECT_INSTALLED,
        "no_formal_drift_effect_installed",
    ),
    (
        "grammar_relation",
        "Relation",
        GrammarOperatorFamily.RELATION,
        GrammarOperatorOrigin.AIWEB_LANGUAGE_CORE_BOUNDED_EXTENSION,
        None,
        (),
        (GrammarOperatorEffect.CONSTRAIN,),
        GrammarOperatorDriftEffectStatus.NO_FORMAL_EFFECT_INSTALLED,
        "no_formal_drift_effect_installed",
    ),
    (
        "grammar_boundary",
        "Boundary",
        GrammarOperatorFamily.BOUNDARY,
        GrammarOperatorOrigin.AIWEB_LANGUAGE_CORE_BOUNDED_EXTENSION,
        None,
        (),
        (GrammarOperatorEffect.CONSTRAIN,),
        GrammarOperatorDriftEffectStatus.NO_FORMAL_EFFECT_INSTALLED,
        "no_formal_drift_effect_installed",
    ),
    (
        "grammar_recursion",
        "Recursion",
        GrammarOperatorFamily.RECURSION,
        GrammarOperatorOrigin.AIWEB_LANGUAGE_CORE_BOUNDED_EXTENSION,
        None,
        (),
        (GrammarOperatorEffect.TRANSFORM,),
        GrammarOperatorDriftEffectStatus.NO_FORMAL_EFFECT_INSTALLED,
        "no_formal_drift_effect_installed",
    ),
    (
        "grammar_negation",
        "Negation",
        GrammarOperatorFamily.NEGATION,
        GrammarOperatorOrigin.AIWEB_LANGUAGE_CORE_BOUNDED_EXTENSION,
        None,
        (),
        (GrammarOperatorEffect.CONSTRAIN,),
        GrammarOperatorDriftEffectStatus.NO_FORMAL_EFFECT_INSTALLED,
        "no_formal_drift_effect_installed",
    ),
    (
        "grammar_prohibition",
        "Prohibition",
        GrammarOperatorFamily.PROHIBITION,
        GrammarOperatorOrigin.AIWEB_LANGUAGE_CORE_BOUNDED_EXTENSION,
        None,
        (),
        (GrammarOperatorEffect.CONSTRAIN, GrammarOperatorEffect.REJECT),
        GrammarOperatorDriftEffectStatus.NO_FORMAL_EFFECT_INSTALLED,
        "no_formal_drift_effect_installed",
    ),
    (
        "grammar_condition",
        "Condition",
        GrammarOperatorFamily.CONDITION,
        GrammarOperatorOrigin.AIWEB_LANGUAGE_CORE_BOUNDED_EXTENSION,
        None,
        (),
        (GrammarOperatorEffect.CONSTRAIN, GrammarOperatorEffect.SUSPEND),
        GrammarOperatorDriftEffectStatus.NO_FORMAL_EFFECT_INSTALLED,
        "no_formal_drift_effect_installed",
    ),
    (
        "grammar_modality",
        "Modality",
        GrammarOperatorFamily.MODALITY,
        GrammarOperatorOrigin.AIWEB_LANGUAGE_CORE_BOUNDED_EXTENSION,
        None,
        (),
        (GrammarOperatorEffect.CONSTRAIN,),
        GrammarOperatorDriftEffectStatus.NO_FORMAL_EFFECT_INSTALLED,
        "no_formal_drift_effect_installed",
    ),
    (
        "grammar_quotation_containment",
        "Quotation Containment",
        GrammarOperatorFamily.QUOTATION_CONTAINMENT,
        GrammarOperatorOrigin.AIWEB_LANGUAGE_CORE_BOUNDED_EXTENSION,
        None,
        (),
        (GrammarOperatorEffect.CONTAIN,),
        GrammarOperatorDriftEffectStatus.NO_FORMAL_EFFECT_INSTALLED,
        "no_formal_drift_effect_installed",
    ),
    (
        "grammar_exception",
        "Exception",
        GrammarOperatorFamily.EXCEPTION,
        GrammarOperatorOrigin.AIWEB_LANGUAGE_CORE_BOUNDED_EXTENSION,
        None,
        (),
        (GrammarOperatorEffect.CONSTRAIN,),
        GrammarOperatorDriftEffectStatus.NO_FORMAL_EFFECT_INSTALLED,
        "no_formal_drift_effect_installed",
    ),
    (
        "grammar_uncertainty",
        "Uncertainty",
        GrammarOperatorFamily.UNCERTAINTY,
        GrammarOperatorOrigin.AIWEB_LANGUAGE_CORE_BOUNDED_EXTENSION,
        None,
        (),
        (GrammarOperatorEffect.SUSPEND,),
        GrammarOperatorDriftEffectStatus.NO_FORMAL_EFFECT_INSTALLED,
        "no_formal_drift_effect_installed",
    ),
    (
        "grammar_reference",
        "Reference",
        GrammarOperatorFamily.REFERENCE,
        GrammarOperatorOrigin.AIWEB_LANGUAGE_CORE_BOUNDED_EXTENSION,
        None,
        (),
        (GrammarOperatorEffect.PROPOSE,),
        GrammarOperatorDriftEffectStatus.NO_FORMAL_EFFECT_INSTALLED,
        "no_formal_drift_effect_installed",
    ),
    (
        "grammar_attachment",
        "Attachment",
        GrammarOperatorFamily.ATTACHMENT,
        GrammarOperatorOrigin.AIWEB_LANGUAGE_CORE_BOUNDED_EXTENSION,
        None,
        (),
        (GrammarOperatorEffect.CONSTRAIN,),
        GrammarOperatorDriftEffectStatus.NO_FORMAL_EFFECT_INSTALLED,
        "no_formal_drift_effect_installed",
    ),
    (
        "grammar_conjunction",
        "Conjunction",
        GrammarOperatorFamily.CONJUNCTION,
        GrammarOperatorOrigin.AIWEB_LANGUAGE_CORE_BOUNDED_EXTENSION,
        None,
        (),
        (GrammarOperatorEffect.CONSTRAIN,),
        GrammarOperatorDriftEffectStatus.NO_FORMAL_EFFECT_INSTALLED,
        "no_formal_drift_effect_installed",
    ),
    (
        "grammar_separation",
        "Separation",
        GrammarOperatorFamily.SEPARATION,
        GrammarOperatorOrigin.AIWEB_LANGUAGE_CORE_BOUNDED_EXTENSION,
        None,
        (),
        (GrammarOperatorEffect.CONSTRAIN,),
        GrammarOperatorDriftEffectStatus.NO_FORMAL_EFFECT_INSTALLED,
        "no_formal_drift_effect_installed",
    ),
    (
        "grammar_suspension",
        "Suspension",
        GrammarOperatorFamily.SUSPENSION,
        GrammarOperatorOrigin.AIWEB_LANGUAGE_CORE_BOUNDED_EXTENSION,
        None,
        (),
        (GrammarOperatorEffect.SUSPEND,),
        GrammarOperatorDriftEffectStatus.NO_FORMAL_EFFECT_INSTALLED,
        "no_formal_drift_effect_installed",
    ),
    (
        "grammar_containment",
        "Containment",
        GrammarOperatorFamily.CONTAINMENT,
        GrammarOperatorOrigin.AIWEB_LANGUAGE_CORE_BOUNDED_EXTENSION,
        None,
        (),
        (GrammarOperatorEffect.CONTAIN,),
        GrammarOperatorDriftEffectStatus.NO_FORMAL_EFFECT_INSTALLED,
        "no_formal_drift_effect_installed",
    ),
)


def _build_definition(row: tuple[object, ...]) -> GrammarOperatorDefinition:
    (
        operator_key,
        canonical_name,
        family,
        origin,
        glyph,
        phase_affinity,
        allowed_effects,
        drift_status,
        drift_code,
    ) = row
    phase_status = (
        GrammarOperatorPhaseAffinityStatus.EXPLICIT_ADVISORY_ONLY
        if phase_affinity
        else GrammarOperatorPhaseAffinityStatus.UNDEFINED
    )
    body = {
        "operator_key": operator_key,
        "operator_version": "1.0.0",
        "canonical_name": canonical_name,
        "family": family,
        "origin": origin,
        "glyph": glyph,
        "domain_schema_id": SOURCE_FIELD_SCHEMA_ID,
        "range_schema_id": GRAMMAR_OPERATOR_PROPOSAL_SCHEMA_ID,
        "permitted_source_field_prerequisites": (
            _COMMON_PERMITTED_PREREQUISITES
        ),
        "prohibited_prerequisites": _COMMON_PROHIBITED_PREREQUISITES,
        "required_companion_operator_keys": (),
        "compatible_operator_keys": (),
        "incompatible_operator_keys": (),
        "compatibility_status": (
            GrammarOperatorCompatibilityStatus.UNDEFINED_NO_TABLE_INSTALLED
        ),
        "commutation_status": (
            GrammarOperatorCommutationStatus.UNDEFINED_NO_RELATION_AUTHORIZED
        ),
        "commutation_restriction_codes": (
            "no_commutation_relation_installed_in_slice36c",
        ),
        "source_span_requirements": _COMMON_SOURCE_SPAN_REQUIREMENTS,
        "ancestry_requirements": _COMMON_ANCESTRY_REQUIREMENTS,
        "uncertainty_behavior": (
            GrammarOperatorUncertaintyBehavior.
            PRESERVE_UNRESOLVED_AND_COMPETING_CANDIDATES
        ),
        "malformed_input_behavior": (
            GrammarOperatorMalformedBehavior.HOLD_NO_PROPOSAL
        ),
        "unsupported_input_behavior": (
            GrammarOperatorUnsupportedBehavior.HOLD_NO_PROPOSAL
        ),
        "phase_affinity_status": phase_status,
        "phase_affinity": phase_affinity,
        "entropy_effect_status": (
            GrammarOperatorEntropyEffectStatus.NO_FORMAL_EFFECT_INSTALLED
        ),
        "entropy_effect_code": (
            "no_numeric_entropy_effect_or_threshold_installed"
        ),
        "drift_effect_status": drift_status,
        "drift_effect_code": drift_code,
        "allowed_effects": allowed_effects,
        "proposal_rule_ids": (),
        "rsoc_operator_keys": (),
        "runtime_status": GrammarOperatorRuntimeStatus.REGISTERED_INERT,
        "automatic_activation_authorized": False,
        "source_binding_authorized": False,
        "operator_application_authorized": False,
        "phase_assignment_authorized": False,
        "meaning_authorized": False,
        "permission_authorized": False,
        "memory_authorized": False,
        "route_authorized": False,
        "tool_authorized": False,
        "action_authorized": False,
        "delivery_authorized": False,
        "source_authority_refs": _COMMON_AUTHORITY_REFS,
        "registry_spec_id": REGISTRY_SPEC_ID,
        "registry_spec_version": REGISTRY_SPEC_VERSION,
        "schema_version": REGISTRY_SCHEMA_VERSION,
        "operator_schema_id": GRAMMAR_OPERATOR_SCHEMA_ID,
    }
    return GrammarOperatorDefinition(
        definition_id=stable_record_id(
            "symbolic_grammar_operator_definition",
            body,
        ),
        **body,
    )


def build_default_symbolic_grammar_operator_registry(
) -> SymbolicGrammarOperatorRegistry:
    operators = tuple(_build_definition(row) for row in _OPERATOR_ROWS)
    body = {
        "registry_version": "1.0.0",
        "operators": operators,
        "proposal_rules": (),
        "exact_operator_count": EXPECTED_GRAMMAR_OPERATOR_COUNT,
        "exact_fbsc_canonical_operator_count": (
            EXPECTED_FBSC_CANONICAL_OPERATOR_COUNT
        ),
        "exact_required_family_count": EXPECTED_REQUIRED_FAMILY_COUNT,
        "exact_proposal_rule_count": 0,
        "closed_world": True,
        "default_runtime_enabled": False,
        "automatic_activation_available": False,
        "proposal_creation_available": False,
        "source_binding_available": False,
        "operator_application_available": False,
        "phase_assignment_available": False,
        "rsoc_mapping_available": False,
        "meaning_authority_available": False,
        "permission_authority_available": False,
        "route_authority_available": False,
        "action_authority_available": False,
        "hidden_fallback_allowed": False,
        "registry_spec_id": REGISTRY_SPEC_ID,
        "registry_spec_version": REGISTRY_SPEC_VERSION,
        "schema_version": REGISTRY_SCHEMA_VERSION,
        "registry_schema_id": GRAMMAR_OPERATOR_REGISTRY_SCHEMA_ID,
    }
    return SymbolicGrammarOperatorRegistry(
        registry_id=stable_record_id(
            "symbolic_grammar_operator_registry",
            body,
        ),
        **body,
    )


def grammar_operator_for_key(
    operator_key: object,
    registry: SymbolicGrammarOperatorRegistry | None = None,
) -> GrammarOperatorDefinition | None:
    if type(operator_key) is not str:
        return None
    selected = registry or build_default_symbolic_grammar_operator_registry()
    return next(
        (
            definition
            for definition in selected.operators
            if definition.operator_key == operator_key
        ),
        None,
    )


def grammar_operator_for_glyph(
    glyph: object,
    registry: SymbolicGrammarOperatorRegistry | None = None,
) -> GrammarOperatorDefinition | None:
    if type(glyph) is not str:
        return None
    selected = registry or build_default_symbolic_grammar_operator_registry()
    return next(
        (
            definition
            for definition in selected.operators
            if definition.glyph == glyph
        ),
        None,
    )


def grammar_operators_for_family(
    family: object,
    registry: SymbolicGrammarOperatorRegistry | None = None,
) -> tuple[GrammarOperatorDefinition, ...]:
    if type(family) is not GrammarOperatorFamily:
        return ()
    selected = registry or build_default_symbolic_grammar_operator_registry()
    return tuple(
        definition
        for definition in selected.operators
        if definition.family is family
    )
