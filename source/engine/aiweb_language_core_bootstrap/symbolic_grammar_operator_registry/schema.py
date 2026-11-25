"""Immutable contracts for Slice 36C symbolic grammar-operator registry.

This module defines registry metadata only. It does not inspect source text,
propose or bind an operator, assign a phase, create meaning, infer permission,
select a route, write memory, or perform an action.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from enum import Enum
from typing import Final

from ..schema import stable_record_id
from ..source_field_projection import SOURCE_FIELD_SCHEMA_ID

REGISTRY_SPEC_ID: Final[str] = "aiweb-symbolic-grammar-operator-registry"
REGISTRY_SPEC_VERSION: Final[str] = (
    "aiweb-symbolic-grammar-operator-registry-v1"
)
REGISTRY_SCHEMA_VERSION: Final[str] = (
    "aiweb-language-core-symbolic-grammar-operator-registry-v1"
)
GRAMMAR_OPERATOR_SCHEMA_ID: Final[str] = (
    "aiweb-symbolic-grammar-operator-definition-v1"
)
GRAMMAR_OPERATOR_REGISTRY_SCHEMA_ID: Final[str] = (
    "aiweb-symbolic-grammar-operator-registry-v1"
)
GRAMMAR_OPERATOR_PROPOSAL_SCHEMA_ID: Final[str] = (
    "aiweb-symbolic-grammar-operator-proposal-candidate-v1"
)
GRAMMAR_OPERATOR_PROPOSAL_RULE_SCHEMA_ID: Final[str] = (
    "aiweb-symbolic-grammar-operator-proposal-rule-contract-v1"
)
GRAMMAR_OPERATOR_PROPOSAL_DECISION_SCHEMA_ID: Final[str] = (
    "aiweb-symbolic-grammar-operator-proposal-decision-v1"
)

FBSC_VOLUME_II_AUTHORITY_REF: Final[str] = (
    "Frequency-Based Symbolic Calculus Volume II section 5.3"
)
RSOC_CONTRACT_AUTHORITY_REF: Final[str] = (
    "Slice 36B0 RSOC/FBSC language operator runtime contract"
)
SOURCE_FIELD_AUTHORITY_REF: Final[str] = (
    "Slice 36B deterministic source-field projection"
)
RMC_LANGUAGE_LAW_AUTHORITY_REF: Final[str] = (
    "Document 3 of 10 RMC Language Law v1"
)
CANONICAL_ROADMAP_AUTHORITY_REF: Final[str] = (
    "AI.Web Forge Canonical Production Roadmap Slice 36C"
)

EXPECTED_GRAMMAR_OPERATOR_COUNT: Final[int] = 25
EXPECTED_FBSC_CANONICAL_OPERATOR_COUNT: Final[int] = 8
EXPECTED_REQUIRED_FAMILY_COUNT: Final[int] = 20


class GrammarOperatorFamily(str, Enum):
    INITIATION = "initiation"
    VOLITION = "volition"
    STRUCTURAL_BINDING = "structural_binding"
    DECAY = "decay"
    CORRECTION = "correction"
    NAMING = "naming"
    PROJECTION = "projection"
    COMPLETION = "completion"
    CONTINUATION = "continuation"
    RELATION = "relation"
    BOUNDARY = "boundary"
    RECURSION = "recursion"
    NEGATION = "negation"
    PROHIBITION = "prohibition"
    CONDITION = "condition"
    MODALITY = "modality"
    QUOTATION_CONTAINMENT = "quotation_containment"
    EXCEPTION = "exception"
    UNCERTAINTY = "uncertainty"
    REFERENCE = "reference"
    ATTACHMENT = "attachment"
    CONJUNCTION = "conjunction"
    SEPARATION = "separation"
    SUSPENSION = "suspension"
    CONTAINMENT = "containment"


REQUIRED_LANGUAGE_CORE_FAMILIES: Final[tuple[GrammarOperatorFamily, ...]] = (
    GrammarOperatorFamily.INITIATION,
    GrammarOperatorFamily.CONTINUATION,
    GrammarOperatorFamily.RELATION,
    GrammarOperatorFamily.BOUNDARY,
    GrammarOperatorFamily.RECURSION,
    GrammarOperatorFamily.NEGATION,
    GrammarOperatorFamily.PROHIBITION,
    GrammarOperatorFamily.CONDITION,
    GrammarOperatorFamily.MODALITY,
    GrammarOperatorFamily.QUOTATION_CONTAINMENT,
    GrammarOperatorFamily.EXCEPTION,
    GrammarOperatorFamily.UNCERTAINTY,
    GrammarOperatorFamily.REFERENCE,
    GrammarOperatorFamily.ATTACHMENT,
    GrammarOperatorFamily.CONJUNCTION,
    GrammarOperatorFamily.SEPARATION,
    GrammarOperatorFamily.CORRECTION,
    GrammarOperatorFamily.COMPLETION,
    GrammarOperatorFamily.SUSPENSION,
    GrammarOperatorFamily.CONTAINMENT,
)


class GrammarOperatorOrigin(str, Enum):
    FBSC_VOLUME_II_CANONICAL = "fbsc_volume_ii_canonical"
    AIWEB_LANGUAGE_CORE_BOUNDED_EXTENSION = (
        "aiweb_language_core_bounded_extension"
    )


class GrammarOperatorRuntimeStatus(str, Enum):
    REGISTERED_INERT = "registered_inert"


class GrammarOperatorEffect(str, Enum):
    PROPOSE = "propose"
    CONSTRAIN = "constrain"
    TRANSFORM = "transform"
    SEAL = "seal"
    SUSPEND = "suspend"
    CONTAIN = "contain"
    REJECT = "reject"


class GrammarOperatorCompatibilityStatus(str, Enum):
    UNDEFINED_NO_TABLE_INSTALLED = "undefined_no_table_installed"


class GrammarOperatorCommutationStatus(str, Enum):
    UNDEFINED_NO_RELATION_AUTHORIZED = (
        "undefined_no_relation_authorized"
    )


class GrammarOperatorPhaseAffinityStatus(str, Enum):
    EXPLICIT_ADVISORY_ONLY = "explicit_advisory_only"
    UNDEFINED = "undefined"


class GrammarOperatorEntropyEffectStatus(str, Enum):
    NO_FORMAL_EFFECT_INSTALLED = "no_formal_effect_installed"


class GrammarOperatorDriftEffectStatus(str, Enum):
    DOCUMENTED_ADVISORY_ONLY = "documented_advisory_only"
    NO_FORMAL_EFFECT_INSTALLED = "no_formal_effect_installed"


class GrammarOperatorUncertaintyBehavior(str, Enum):
    PRESERVE_UNRESOLVED_AND_COMPETING_CANDIDATES = (
        "preserve_unresolved_and_competing_candidates"
    )


class GrammarOperatorMalformedBehavior(str, Enum):
    HOLD_NO_PROPOSAL = "hold_no_proposal"


class GrammarOperatorUnsupportedBehavior(str, Enum):
    HOLD_NO_PROPOSAL = "hold_no_proposal"


class ProposalRuleRuntimeStatus(str, Enum):
    SCHEMA_ONLY_NO_RULES_INSTALLED = (
        "schema_only_no_rules_installed"
    )


class ProposalDecisionStatus(str, Enum):
    REFUSED_NO_RULE_INSTALLED = "refused_no_rule_installed"
    REFUSED_UNKNOWN_OPERATOR = "refused_unknown_operator"
    REFUSED_INVALID_SOURCE_FIELD = "refused_invalid_source_field"
    REFUSED_INVALID_SOURCE_SPAN = "refused_invalid_source_span"
    REFUSED_INVALID_REGISTRY = "refused_invalid_registry"


@dataclass(frozen=True, slots=True)
class GrammarOperatorDefinition:
    definition_id: str
    operator_key: str
    operator_version: str
    canonical_name: str
    family: GrammarOperatorFamily
    origin: GrammarOperatorOrigin
    glyph: str | None
    domain_schema_id: str
    range_schema_id: str
    permitted_source_field_prerequisites: tuple[str, ...]
    prohibited_prerequisites: tuple[str, ...]
    required_companion_operator_keys: tuple[str, ...]
    compatible_operator_keys: tuple[str, ...]
    incompatible_operator_keys: tuple[str, ...]
    compatibility_status: GrammarOperatorCompatibilityStatus
    commutation_status: GrammarOperatorCommutationStatus
    commutation_restriction_codes: tuple[str, ...]
    source_span_requirements: tuple[str, ...]
    ancestry_requirements: tuple[str, ...]
    uncertainty_behavior: GrammarOperatorUncertaintyBehavior
    malformed_input_behavior: GrammarOperatorMalformedBehavior
    unsupported_input_behavior: GrammarOperatorUnsupportedBehavior
    phase_affinity_status: GrammarOperatorPhaseAffinityStatus
    phase_affinity: tuple[str, ...]
    entropy_effect_status: GrammarOperatorEntropyEffectStatus
    entropy_effect_code: str
    drift_effect_status: GrammarOperatorDriftEffectStatus
    drift_effect_code: str
    allowed_effects: tuple[GrammarOperatorEffect, ...]
    proposal_rule_ids: tuple[str, ...]
    rsoc_operator_keys: tuple[str, ...]
    runtime_status: GrammarOperatorRuntimeStatus
    automatic_activation_authorized: bool
    source_binding_authorized: bool
    operator_application_authorized: bool
    phase_assignment_authorized: bool
    meaning_authorized: bool
    permission_authorized: bool
    memory_authorized: bool
    route_authorized: bool
    tool_authorized: bool
    action_authorized: bool
    delivery_authorized: bool
    source_authority_refs: tuple[str, ...]
    registry_spec_id: str = REGISTRY_SPEC_ID
    registry_spec_version: str = REGISTRY_SPEC_VERSION
    schema_version: str = REGISTRY_SCHEMA_VERSION
    operator_schema_id: str = GRAMMAR_OPERATOR_SCHEMA_ID

    def canonical_body(self) -> dict[str, object]:
        body = asdict(self)
        body.pop("definition_id")
        return body

    def expected_id(self) -> str:
        return stable_record_id(
            "symbolic_grammar_operator_definition",
            self.canonical_body(),
        )

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class GrammarOperatorProposalRuleContract:
    rule_id: str
    rule_version: str
    operator_key: str
    exact_source_span_required: bool
    observable_condition_codes: tuple[str, ...]
    prohibited_evidence_sources: tuple[str, ...]
    supporting_condition_schema_id: str
    missing_condition_schema_id: str
    conflicting_condition_schema_id: str
    runtime_status: ProposalRuleRuntimeStatus
    implementation_available: bool
    automatic_activation_authorized: bool
    statistical_scoring_authorized: bool
    similarity_authorized: bool
    registry_spec_id: str = REGISTRY_SPEC_ID
    registry_spec_version: str = REGISTRY_SPEC_VERSION
    schema_version: str = REGISTRY_SCHEMA_VERSION
    rule_schema_id: str = GRAMMAR_OPERATOR_PROPOSAL_RULE_SCHEMA_ID

    def canonical_body(self) -> dict[str, object]:
        body = asdict(self)
        body.pop("rule_id")
        return body

    def expected_id(self) -> str:
        return stable_record_id(
            "grammar_operator_proposal_rule_contract",
            self.canonical_body(),
        )

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class SymbolicGrammarOperatorRegistry:
    registry_id: str
    registry_version: str
    operators: tuple[GrammarOperatorDefinition, ...]
    proposal_rules: tuple[GrammarOperatorProposalRuleContract, ...]
    exact_operator_count: int
    exact_fbsc_canonical_operator_count: int
    exact_required_family_count: int
    exact_proposal_rule_count: int
    closed_world: bool
    default_runtime_enabled: bool
    automatic_activation_available: bool
    proposal_creation_available: bool
    source_binding_available: bool
    operator_application_available: bool
    phase_assignment_available: bool
    rsoc_mapping_available: bool
    meaning_authority_available: bool
    permission_authority_available: bool
    route_authority_available: bool
    action_authority_available: bool
    hidden_fallback_allowed: bool
    registry_spec_id: str = REGISTRY_SPEC_ID
    registry_spec_version: str = REGISTRY_SPEC_VERSION
    schema_version: str = REGISTRY_SCHEMA_VERSION
    registry_schema_id: str = GRAMMAR_OPERATOR_REGISTRY_SCHEMA_ID

    def canonical_body(self) -> dict[str, object]:
        body = asdict(self)
        body.pop("registry_id")
        return body

    def expected_id(self) -> str:
        return stable_record_id(
            "symbolic_grammar_operator_registry",
            self.canonical_body(),
        )

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class GrammarOperatorProposalDecision:
    decision_id: str
    status: ProposalDecisionStatus
    reason_code: str
    registry_id: str
    registry_version: str
    requested_operator_key: str
    source_event_id: str
    projection_id: str
    requested_source_span_ids: tuple[str, ...]
    operator_found: bool
    rule_found: bool
    proposal_created: bool
    candidate_operator_key: str | None
    supporting_condition_codes: tuple[str, ...]
    missing_condition_codes: tuple[str, ...]
    conflicting_condition_codes: tuple[str, ...]
    source_binding_performed: bool
    operator_application_performed: bool
    phase_assignment_performed: bool
    meaning_created: bool
    permission_inferred: bool
    route_created: bool
    tool_routing_performed: bool
    action_performed: bool
    memory_read_performed: bool
    memory_write_performed: bool
    delivery_performed: bool
    registry_spec_id: str = REGISTRY_SPEC_ID
    registry_spec_version: str = REGISTRY_SPEC_VERSION
    schema_version: str = REGISTRY_SCHEMA_VERSION
    decision_schema_id: str = (
        GRAMMAR_OPERATOR_PROPOSAL_DECISION_SCHEMA_ID
    )

    def canonical_body(self) -> dict[str, object]:
        body = asdict(self)
        body.pop("decision_id")
        return body

    def expected_id(self) -> str:
        return stable_record_id(
            "grammar_operator_proposal_decision",
            self.canonical_body(),
        )

    def to_dict(self) -> dict[str, object]:
        return asdict(self)
