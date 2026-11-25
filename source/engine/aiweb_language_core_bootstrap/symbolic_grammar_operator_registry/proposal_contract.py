"""Inert proposal gate for Slice 36C.

No proposal rules are installed in Slice 36C. Every request is therefore
validated and refused with a typed decision. The function never inspects source
text, creates a candidate, binds an operator, assigns a phase, or creates
meaning, permission, routes, tools, memory effects, or actions.
"""

from __future__ import annotations

from ..schema import stable_record_id
from ..source_field_projection import (
    SourceFieldProjectionRecord,
    validate_source_field_projection,
)
from .registry import (
    build_default_symbolic_grammar_operator_registry,
    grammar_operator_for_key,
)
from .schema import (
    GRAMMAR_OPERATOR_PROPOSAL_DECISION_SCHEMA_ID,
    REGISTRY_SCHEMA_VERSION,
    REGISTRY_SPEC_ID,
    REGISTRY_SPEC_VERSION,
    GrammarOperatorProposalDecision,
    ProposalDecisionStatus,
    SymbolicGrammarOperatorRegistry,
)
from .validation import validate_symbolic_grammar_operator_registry


def _decision(
    *,
    status: ProposalDecisionStatus,
    reason_code: str,
    registry: SymbolicGrammarOperatorRegistry,
    requested_operator_key: str,
    source_event_id: str,
    projection_id: str,
    requested_source_span_ids: tuple[str, ...],
    operator_found: bool,
    rule_found: bool,
    missing_condition_codes: tuple[str, ...],
    conflicting_condition_codes: tuple[str, ...] = (),
) -> GrammarOperatorProposalDecision:
    body = {
        "status": status,
        "reason_code": reason_code,
        "registry_id": registry.registry_id,
        "registry_version": registry.registry_version,
        "requested_operator_key": requested_operator_key,
        "source_event_id": source_event_id,
        "projection_id": projection_id,
        "requested_source_span_ids": requested_source_span_ids,
        "operator_found": operator_found,
        "rule_found": rule_found,
        "proposal_created": False,
        "candidate_operator_key": None,
        "supporting_condition_codes": (),
        "missing_condition_codes": missing_condition_codes,
        "conflicting_condition_codes": conflicting_condition_codes,
        "source_binding_performed": False,
        "operator_application_performed": False,
        "phase_assignment_performed": False,
        "meaning_created": False,
        "permission_inferred": False,
        "route_created": False,
        "tool_routing_performed": False,
        "action_performed": False,
        "memory_read_performed": False,
        "memory_write_performed": False,
        "delivery_performed": False,
        "registry_spec_id": REGISTRY_SPEC_ID,
        "registry_spec_version": REGISTRY_SPEC_VERSION,
        "schema_version": REGISTRY_SCHEMA_VERSION,
        "decision_schema_id": (
            GRAMMAR_OPERATOR_PROPOSAL_DECISION_SCHEMA_ID
        ),
    }
    return GrammarOperatorProposalDecision(
        decision_id=stable_record_id(
            "grammar_operator_proposal_decision",
            body,
        ),
        **body,
    )


def evaluate_grammar_operator_proposal(
    projection: object,
    *,
    operator_key: object,
    source_span_ids: object,
    registry: SymbolicGrammarOperatorRegistry | None = None,
) -> GrammarOperatorProposalDecision:
    """Return a typed refusal because Slice 36C installs no proposal rules."""

    selected = (
        registry
        if type(registry) is SymbolicGrammarOperatorRegistry
        else build_default_symbolic_grammar_operator_registry()
    )
    registry_report = validate_symbolic_grammar_operator_registry(selected)

    requested_key = operator_key if type(operator_key) is str else ""
    requested_spans = (
        source_span_ids
        if type(source_span_ids) is tuple
        and all(type(value) is str for value in source_span_ids)
        else ()
    )

    source_event_id = (
        projection.source_event_id
        if type(projection) is SourceFieldProjectionRecord
        else ""
    )
    projection_id = (
        projection.projection_id
        if type(projection) is SourceFieldProjectionRecord
        else ""
    )

    if not registry_report.ok:
        return _decision(
            status=ProposalDecisionStatus.REFUSED_INVALID_REGISTRY,
            reason_code="grammar_operator_registry_invalid",
            registry=selected,
            requested_operator_key=requested_key,
            source_event_id=source_event_id,
            projection_id=projection_id,
            requested_source_span_ids=requested_spans,
            operator_found=False,
            rule_found=False,
            missing_condition_codes=("valid_registry_required",),
        )

    if type(projection) is not SourceFieldProjectionRecord:
        return _decision(
            status=ProposalDecisionStatus.REFUSED_INVALID_SOURCE_FIELD,
            reason_code="source_field_projection_record_required",
            registry=selected,
            requested_operator_key=requested_key,
            source_event_id="",
            projection_id="",
            requested_source_span_ids=requested_spans,
            operator_found=False,
            rule_found=False,
            missing_condition_codes=("validated_slice36b_projection_required",),
        )

    projection_report = validate_source_field_projection(projection)
    if not projection_report.ok or not projection.structural_progression_allowed:
        return _decision(
            status=ProposalDecisionStatus.REFUSED_INVALID_SOURCE_FIELD,
            reason_code="supported_progressable_source_field_required",
            registry=selected,
            requested_operator_key=requested_key,
            source_event_id=projection.source_event_id,
            projection_id=projection.projection_id,
            requested_source_span_ids=requested_spans,
            operator_found=False,
            rule_found=False,
            missing_condition_codes=(
                "valid_supported_source_field_required",
                "structural_progression_permission_required",
            ),
        )

    definition = grammar_operator_for_key(requested_key, selected)
    if definition is None:
        return _decision(
            status=ProposalDecisionStatus.REFUSED_UNKNOWN_OPERATOR,
            reason_code="operator_key_not_registered",
            registry=selected,
            requested_operator_key=requested_key,
            source_event_id=projection.source_event_id,
            projection_id=projection.projection_id,
            requested_source_span_ids=requested_spans,
            operator_found=False,
            rule_found=False,
            missing_condition_codes=("registered_operator_required",),
        )

    if not requested_spans:
        return _decision(
            status=ProposalDecisionStatus.REFUSED_INVALID_SOURCE_SPAN,
            reason_code="one_or_more_exact_source_span_ids_required",
            registry=selected,
            requested_operator_key=requested_key,
            source_event_id=projection.source_event_id,
            projection_id=projection.projection_id,
            requested_source_span_ids=(),
            operator_found=True,
            rule_found=False,
            missing_condition_codes=("exact_source_span_required",),
        )

    valid_span_ids = {projection.root_source_span_id}
    valid_span_ids.update(
        atom.source_span_id for atom in projection.code_points
    )
    valid_span_ids.update(
        observation.source_span_id for observation in projection.observations
    )
    invalid_spans = tuple(
        span_id
        for span_id in requested_spans
        if span_id not in valid_span_ids
    )
    if invalid_spans:
        return _decision(
            status=ProposalDecisionStatus.REFUSED_INVALID_SOURCE_SPAN,
            reason_code="source_span_not_owned_by_projection",
            registry=selected,
            requested_operator_key=requested_key,
            source_event_id=projection.source_event_id,
            projection_id=projection.projection_id,
            requested_source_span_ids=requested_spans,
            operator_found=True,
            rule_found=False,
            missing_condition_codes=("exact_projection_span_membership",),
            conflicting_condition_codes=tuple(
                f"foreign_or_unknown_span:{span_id}"
                for span_id in invalid_spans
            ),
        )

    return _decision(
        status=ProposalDecisionStatus.REFUSED_NO_RULE_INSTALLED,
        reason_code="slice36c_registers_definitions_but_installs_no_proposal_rules",
        registry=selected,
        requested_operator_key=requested_key,
        source_event_id=projection.source_event_id,
        projection_id=projection.projection_id,
        requested_source_span_ids=requested_spans,
        operator_found=True,
        rule_found=False,
        missing_condition_codes=(
            "exact_versioned_operator_proposal_rule_not_installed",
        ),
    )
