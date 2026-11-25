"""Deterministic validation for Slice 36C registry contracts."""

from __future__ import annotations

from ..schema import ValidationReport, issue
from ..source_field_projection import (
    SOURCE_FIELD_SCHEMA_ID,
    validate_source_field_projection,
)
from .schema import (
    EXPECTED_FBSC_CANONICAL_OPERATOR_COUNT,
    EXPECTED_GRAMMAR_OPERATOR_COUNT,
    EXPECTED_REQUIRED_FAMILY_COUNT,
    GRAMMAR_OPERATOR_PROPOSAL_DECISION_SCHEMA_ID,
    GRAMMAR_OPERATOR_PROPOSAL_RULE_SCHEMA_ID,
    GRAMMAR_OPERATOR_PROPOSAL_SCHEMA_ID,
    GRAMMAR_OPERATOR_REGISTRY_SCHEMA_ID,
    GRAMMAR_OPERATOR_SCHEMA_ID,
    REGISTRY_SCHEMA_VERSION,
    REGISTRY_SPEC_ID,
    REGISTRY_SPEC_VERSION,
    REQUIRED_LANGUAGE_CORE_FAMILIES,
    GrammarOperatorCompatibilityStatus,
    GrammarOperatorCommutationStatus,
    GrammarOperatorDefinition,
    GrammarOperatorEntropyEffectStatus,
    GrammarOperatorMalformedBehavior,
    GrammarOperatorOrigin,
    GrammarOperatorPhaseAffinityStatus,
    GrammarOperatorProposalDecision,
    GrammarOperatorProposalRuleContract,
    GrammarOperatorRuntimeStatus,
    GrammarOperatorUncertaintyBehavior,
    GrammarOperatorUnsupportedBehavior,
    ProposalDecisionStatus,
    ProposalRuleRuntimeStatus,
    SymbolicGrammarOperatorRegistry,
)

_CANONICAL_FBSC_CONTRACTS = {
    "fbsc_initiator": ("⊕", ("Φ1",)),
    "fbsc_desire_vector": ("⇋", ("Φ3",)),
    "fbsc_structural_binding": ("⚯", ("Φ4",)),
    "fbsc_decay_mark": ("↧", ("Φ5",)),
    "fbsc_grace_override": ("†", ("Φ6",)),
    "fbsc_name_declaration": ("✎", ("Φ7",)),
    "fbsc_projection": ("↠", ("Φ8",)),
    "fbsc_loop_seal": ("⟲", ("Φ9",)),
}

_REQUIRED_PERMITTED_CODES = {
    "validated_slice36b_source_field_projection",
    "source_field_status_supported",
    "structural_progression_allowed",
    "exact_source_span_membership",
    "source_ordering_and_adjacency_preserved",
    "source_ancestry_complete",
    "exact_versioned_proposal_rule_required",
}

_REQUIRED_PROHIBITED_CODES = {
    "unsupported_or_malformed_source_field",
    "source_text_normalized_replaced_or_repaired",
    "synthetic_or_out_of_range_source_span",
    "missing_source_event_or_projection_ancestry",
    "lexical_similarity_or_phrase_familiarity",
    "statistical_probability_or_confidence_scoring",
    "embedding_vector_or_neural_model_output",
    "legacy_parser_or_legacy_resonance_lexicon_output",
    "memory_web_file_search_or_context_convenience",
}


def _report(issues: list[object]) -> ValidationReport:
    return ValidationReport(
        schema_version=REGISTRY_SCHEMA_VERSION,
        ok=not issues,
        issues=tuple(issues),
    )


def _base_issues(record: object) -> list[object]:
    issues: list[object] = []
    if getattr(record, "schema_version", None) != REGISTRY_SCHEMA_VERSION:
        issues.append(issue("schema_version", "unsupported_schema_version"))
    if getattr(record, "registry_spec_id", None) != REGISTRY_SPEC_ID:
        issues.append(issue("registry_spec_id", "registry_spec_id_mismatch"))
    if (
        getattr(record, "registry_spec_version", None)
        != REGISTRY_SPEC_VERSION
    ):
        issues.append(
            issue(
                "registry_spec_version",
                "registry_spec_version_mismatch",
            )
        )
    return issues


def validate_grammar_operator_definition(
    definition: object,
) -> ValidationReport:
    if type(definition) is not GrammarOperatorDefinition:
        return _report([issue("definition", "invalid_record_type")])

    issues = _base_issues(definition)

    if definition.operator_schema_id != GRAMMAR_OPERATOR_SCHEMA_ID:
        issues.append(
            issue("operator_schema_id", "operator_schema_id_mismatch")
        )
    if definition.definition_id != definition.expected_id():
        issues.append(
            issue("definition_id", "stable_identifier_mismatch")
        )
    if not definition.operator_key or not definition.canonical_name:
        issues.append(issue("operator_identity", "required"))
    if definition.operator_version != "1.0.0":
        issues.append(issue("operator_version", "unsupported_version"))
    if definition.domain_schema_id != SOURCE_FIELD_SCHEMA_ID:
        issues.append(issue("domain_schema_id", "source_field_domain_required"))
    if (
        definition.range_schema_id
        != GRAMMAR_OPERATOR_PROPOSAL_SCHEMA_ID
    ):
        issues.append(
            issue("range_schema_id", "proposal_candidate_range_required")
        )
    if (
        definition.runtime_status
        is not GrammarOperatorRuntimeStatus.REGISTERED_INERT
    ):
        issues.append(issue("runtime_status", "must_remain_registered_inert"))
    if not _REQUIRED_PERMITTED_CODES.issubset(
        definition.permitted_source_field_prerequisites
    ):
        issues.append(
            issue(
                "permitted_source_field_prerequisites",
                "required_prerequisite_missing",
            )
        )
    if not _REQUIRED_PROHIBITED_CODES.issubset(
        definition.prohibited_prerequisites
    ):
        issues.append(
            issue(
                "prohibited_prerequisites",
                "required_prohibition_missing",
            )
        )
    if not definition.source_span_requirements:
        issues.append(issue("source_span_requirements", "required"))
    if not definition.ancestry_requirements:
        issues.append(issue("ancestry_requirements", "required"))
    if (
        definition.uncertainty_behavior
        is not GrammarOperatorUncertaintyBehavior.
        PRESERVE_UNRESOLVED_AND_COMPETING_CANDIDATES
    ):
        issues.append(
            issue("uncertainty_behavior", "must_preserve_uncertainty")
        )
    if (
        definition.malformed_input_behavior
        is not GrammarOperatorMalformedBehavior.HOLD_NO_PROPOSAL
    ):
        issues.append(
            issue("malformed_input_behavior", "must_hold_no_proposal")
        )
    if (
        definition.unsupported_input_behavior
        is not GrammarOperatorUnsupportedBehavior.HOLD_NO_PROPOSAL
    ):
        issues.append(
            issue("unsupported_input_behavior", "must_hold_no_proposal")
        )
    if (
        definition.compatibility_status
        is not GrammarOperatorCompatibilityStatus.
        UNDEFINED_NO_TABLE_INSTALLED
    ):
        issues.append(
            issue("compatibility_status", "compatibility_table_not_authorized")
        )
    if definition.compatible_operator_keys:
        issues.append(
            issue("compatible_operator_keys", "must_remain_empty")
        )
    if definition.incompatible_operator_keys:
        issues.append(
            issue("incompatible_operator_keys", "must_remain_empty")
        )
    if (
        definition.commutation_status
        is not GrammarOperatorCommutationStatus.
        UNDEFINED_NO_RELATION_AUTHORIZED
    ):
        issues.append(
            issue("commutation_status", "commutation_not_authorized")
        )
    if not definition.commutation_restriction_codes:
        issues.append(
            issue("commutation_restriction_codes", "restriction_required")
        )
    if (
        definition.entropy_effect_status
        is not GrammarOperatorEntropyEffectStatus.
        NO_FORMAL_EFFECT_INSTALLED
    ):
        issues.append(
            issue("entropy_effect_status", "numeric_entropy_effect_prohibited")
        )
    if not definition.allowed_effects:
        issues.append(issue("allowed_effects", "responsibility_required"))
    if definition.proposal_rule_ids:
        issues.append(issue("proposal_rule_ids", "must_remain_empty"))
    if definition.rsoc_operator_keys:
        issues.append(
            issue(
                "rsoc_operator_keys",
                "direct_rsoc_mapping_not_authorized",
            )
        )

    for name in (
        "automatic_activation_authorized",
        "source_binding_authorized",
        "operator_application_authorized",
        "phase_assignment_authorized",
        "meaning_authorized",
        "permission_authorized",
        "memory_authorized",
        "route_authorized",
        "tool_authorized",
        "action_authorized",
        "delivery_authorized",
    ):
        if getattr(definition, name) is not False:
            issues.append(issue(name, "must_remain_false"))

    canonical = _CANONICAL_FBSC_CONTRACTS.get(definition.operator_key)
    if definition.origin is GrammarOperatorOrigin.FBSC_VOLUME_II_CANONICAL:
        if canonical is None:
            issues.append(
                issue("operator_key", "unknown_fbsc_canonical_operator")
            )
        else:
            expected_glyph, expected_phases = canonical
            if definition.glyph != expected_glyph:
                issues.append(issue("glyph", "fbsc_glyph_mismatch"))
            if definition.phase_affinity != expected_phases:
                issues.append(
                    issue("phase_affinity", "fbsc_phase_affinity_mismatch")
                )
            if (
                definition.phase_affinity_status
                is not GrammarOperatorPhaseAffinityStatus.
                EXPLICIT_ADVISORY_ONLY
            ):
                issues.append(
                    issue(
                        "phase_affinity_status",
                        "fbsc_affinity_must_remain_advisory",
                    )
                )
    else:
        if definition.glyph is not None:
            issues.append(
                issue("glyph", "extension_glyph_not_authorized")
            )
        if definition.phase_affinity:
            issues.append(
                issue("phase_affinity", "extension_phase_not_authorized")
            )
        if (
            definition.phase_affinity_status
            is not GrammarOperatorPhaseAffinityStatus.UNDEFINED
        ):
            issues.append(
                issue(
                    "phase_affinity_status",
                    "extension_phase_must_remain_undefined",
                )
            )

    return _report(issues)


def validate_grammar_operator_proposal_rule_contract(
    rule: object,
) -> ValidationReport:
    if type(rule) is not GrammarOperatorProposalRuleContract:
        return _report([issue("rule", "invalid_record_type")])
    issues = _base_issues(rule)
    if rule.rule_schema_id != GRAMMAR_OPERATOR_PROPOSAL_RULE_SCHEMA_ID:
        issues.append(issue("rule_schema_id", "rule_schema_id_mismatch"))
    if rule.rule_id != rule.expected_id():
        issues.append(issue("rule_id", "stable_identifier_mismatch"))
    if (
        rule.runtime_status
        is not ProposalRuleRuntimeStatus.SCHEMA_ONLY_NO_RULES_INSTALLED
    ):
        issues.append(issue("runtime_status", "rule_runtime_not_authorized"))
    for name in (
        "implementation_available",
        "automatic_activation_authorized",
        "statistical_scoring_authorized",
        "similarity_authorized",
    ):
        if getattr(rule, name) is not False:
            issues.append(issue(name, "must_remain_false"))
    return _report(issues)


def validate_symbolic_grammar_operator_registry(
    registry: object,
) -> ValidationReport:
    if type(registry) is not SymbolicGrammarOperatorRegistry:
        return _report([issue("registry", "invalid_record_type")])

    issues = _base_issues(registry)

    if registry.registry_schema_id != GRAMMAR_OPERATOR_REGISTRY_SCHEMA_ID:
        issues.append(
            issue("registry_schema_id", "registry_schema_id_mismatch")
        )
    if registry.registry_id != registry.expected_id():
        issues.append(issue("registry_id", "stable_identifier_mismatch"))
    if registry.registry_version != "1.0.0":
        issues.append(issue("registry_version", "unsupported_version"))
    if registry.exact_operator_count != EXPECTED_GRAMMAR_OPERATOR_COUNT:
        issues.append(
            issue("exact_operator_count", "operator_count_contract_mismatch")
        )
    if len(registry.operators) != EXPECTED_GRAMMAR_OPERATOR_COUNT:
        issues.append(issue("operators", "operator_count_mismatch"))
    if (
        registry.exact_fbsc_canonical_operator_count
        != EXPECTED_FBSC_CANONICAL_OPERATOR_COUNT
    ):
        issues.append(
            issue(
                "exact_fbsc_canonical_operator_count",
                "fbsc_count_contract_mismatch",
            )
        )
    actual_fbsc_count = sum(
        definition.origin
        is GrammarOperatorOrigin.FBSC_VOLUME_II_CANONICAL
        for definition in registry.operators
    )
    if actual_fbsc_count != EXPECTED_FBSC_CANONICAL_OPERATOR_COUNT:
        issues.append(issue("operators", "fbsc_operator_count_mismatch"))
    if (
        registry.exact_required_family_count
        != EXPECTED_REQUIRED_FAMILY_COUNT
    ):
        issues.append(
            issue(
                "exact_required_family_count",
                "required_family_count_contract_mismatch",
            )
        )
    present_families = {
        definition.family for definition in registry.operators
    }
    if not set(REQUIRED_LANGUAGE_CORE_FAMILIES).issubset(
        present_families
    ):
        issues.append(issue("operators", "required_family_missing"))
    if registry.exact_proposal_rule_count != 0:
        issues.append(
            issue("exact_proposal_rule_count", "must_remain_zero")
        )
    if registry.proposal_rules:
        issues.append(issue("proposal_rules", "must_remain_empty"))

    keys = tuple(definition.operator_key for definition in registry.operators)
    ids = tuple(definition.definition_id for definition in registry.operators)
    glyphs = tuple(
        definition.glyph
        for definition in registry.operators
        if definition.glyph is not None
    )
    if len(set(keys)) != len(keys):
        issues.append(issue("operators", "duplicate_operator_key"))
    if len(set(ids)) != len(ids):
        issues.append(issue("operators", "duplicate_definition_id"))
    if len(set(glyphs)) != len(glyphs):
        issues.append(issue("operators", "duplicate_glyph"))

    for definition in registry.operators:
        issues.extend(
            validate_grammar_operator_definition(definition).issues
        )
    for rule in registry.proposal_rules:
        issues.extend(
            validate_grammar_operator_proposal_rule_contract(rule).issues
        )

    if registry.closed_world is not True:
        issues.append(issue("closed_world", "must_remain_true"))
    for name in (
        "default_runtime_enabled",
        "automatic_activation_available",
        "proposal_creation_available",
        "source_binding_available",
        "operator_application_available",
        "phase_assignment_available",
        "rsoc_mapping_available",
        "meaning_authority_available",
        "permission_authority_available",
        "route_authority_available",
        "action_authority_available",
        "hidden_fallback_allowed",
    ):
        if getattr(registry, name) is not False:
            issues.append(issue(name, "must_remain_false"))

    return _report(issues)


def validate_grammar_operator_proposal_decision(
    decision: object,
) -> ValidationReport:
    if type(decision) is not GrammarOperatorProposalDecision:
        return _report([issue("decision", "invalid_record_type")])

    issues = _base_issues(decision)

    if (
        decision.decision_schema_id
        != GRAMMAR_OPERATOR_PROPOSAL_DECISION_SCHEMA_ID
    ):
        issues.append(
            issue("decision_schema_id", "decision_schema_id_mismatch")
        )
    if decision.decision_id != decision.expected_id():
        issues.append(issue("decision_id", "stable_identifier_mismatch"))
    if decision.proposal_created is not False:
        issues.append(issue("proposal_created", "must_remain_false"))
    if decision.candidate_operator_key is not None:
        issues.append(
            issue("candidate_operator_key", "must_remain_none")
        )
    if decision.supporting_condition_codes:
        issues.append(
            issue("supporting_condition_codes", "must_remain_empty")
        )
    if decision.rule_found is not False:
        issues.append(issue("rule_found", "must_remain_false"))
    if not decision.missing_condition_codes:
        issues.append(issue("missing_condition_codes", "required"))
    if decision.status not in tuple(ProposalDecisionStatus):
        issues.append(issue("status", "unsupported_status"))

    for name in (
        "source_binding_performed",
        "operator_application_performed",
        "phase_assignment_performed",
        "meaning_created",
        "permission_inferred",
        "route_created",
        "tool_routing_performed",
        "action_performed",
        "memory_read_performed",
        "memory_write_performed",
        "delivery_performed",
    ):
        if getattr(decision, name) is not False:
            issues.append(issue(name, "must_remain_false"))

    return _report(issues)
