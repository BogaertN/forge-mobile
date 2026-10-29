"""MEA-specific renderer corridor adapters.

Build 008 installs the MEA-to-RMC render-admission gate.
Build 009 adds a deterministic non-LLM *preview* renderer downstream of that
gate.  Preview text remains unapproved until later Echo Validator hardening.
No route, UI action, memory write, LLM, Chroma, or approval behavior is
activated by this package.

Backward-compatibility rule:
`BUILD_ID` and `SCHEMA_VERSION` retain their Build 008 gate meanings because
they were already exported by this package.  Build 009 exports its identity
under `NON_LLM_RENDERER_BUILD_ID`.
"""
from .mea_render_gate import (
    ADAPTER_PACKET_SCHEMA_VERSION,
    BUILD_ID,
    PERMITTED_FUTURE_OUTPUT_MODE,
    SCHEMA_VERSION,
    SOURCE_KIND,
    build_historical_hypothesis_admission_request,
    evaluate_mea_render_admission_request,
    mea_render_gate_boundary,
    mea_render_gate_status,
)

MEA_RENDER_GATE_BUILD_ID = BUILD_ID
MEA_RENDER_GATE_SCHEMA_VERSION = SCHEMA_VERSION

from .semantic_lexicon import (
    BUILD_ID as NON_LLM_RENDERER_BUILD_ID,
    SEMANTIC_PLAN_SCHEMA_VERSION,
    SUPPORTED_DELIVERY_MODES,
    build_semantic_plan,
    semantic_lexicon_boundary,
    validate_render_admission_packet,
)
from .grammar_templates import (
    SENTENCE_PLAN_SCHEMA_VERSION,
    build_sentence_plan,
    grammar_templates_boundary,
)
from .surface_realizer import (
    RENDER_PREVIEW_SCHEMA_VERSION,
    PREVIEW_STATUS,
    realize_sentence_plan,
    surface_realizer_boundary,
)
from .renderer import (
    RENDER_REPORT_SCHEMA_VERSION,
    non_llm_renderer_boundary,
    non_llm_renderer_status,
    render_admitted_preview,
    render_historical_hypothesis_preview,
)

__all__ = [
    # Original Build 008 package-level exports remain stable.
    "ADAPTER_PACKET_SCHEMA_VERSION",
    "BUILD_ID",
    "PERMITTED_FUTURE_OUTPUT_MODE",
    "SCHEMA_VERSION",
    "SOURCE_KIND",
    "build_historical_hypothesis_admission_request",
    "evaluate_mea_render_admission_request",
    "mea_render_gate_boundary",
    "mea_render_gate_status",
    # Explicit aliases and Build 009 exports.
    "MEA_RENDER_GATE_BUILD_ID",
    "MEA_RENDER_GATE_SCHEMA_VERSION",
    "NON_LLM_RENDERER_BUILD_ID",
    "SEMANTIC_PLAN_SCHEMA_VERSION",
    "SUPPORTED_DELIVERY_MODES",
    "build_semantic_plan",
    "semantic_lexicon_boundary",
    "validate_render_admission_packet",
    "SENTENCE_PLAN_SCHEMA_VERSION",
    "build_sentence_plan",
    "grammar_templates_boundary",
    "RENDER_PREVIEW_SCHEMA_VERSION",
    "PREVIEW_STATUS",
    "realize_sentence_plan",
    "surface_realizer_boundary",
    "RENDER_REPORT_SCHEMA_VERSION",
    "non_llm_renderer_boundary",
    "non_llm_renderer_status",
    "render_admitted_preview",
    "render_historical_hypothesis_preview",
]

from .echo_validator import (
    BUILD_ID as ECHO_VALIDATOR_BUILD_ID,
    SCHEMA_VERSION as ECHO_VALIDATOR_SCHEMA_VERSION,
    ECHO_REPORT_SCHEMA_VERSION,
    VALID_STATUS as ECHO_VALIDATOR_VALID_STATUS,
    REJECTED_STATUS as ECHO_VALIDATOR_REJECTED_STATUS,
    echo_validator_boundary,
    validate_render_preview_echo,
    validate_historical_hypothesis_preview_echo,
    echo_validator_status,
)

__all__.extend([
    "ECHO_VALIDATOR_BUILD_ID",
    "ECHO_VALIDATOR_SCHEMA_VERSION",
    "ECHO_REPORT_SCHEMA_VERSION",
    "ECHO_VALIDATOR_VALID_STATUS",
    "ECHO_VALIDATOR_REJECTED_STATUS",
    "echo_validator_boundary",
    "validate_render_preview_echo",
    "validate_historical_hypothesis_preview_echo",
    "echo_validator_status",
])
