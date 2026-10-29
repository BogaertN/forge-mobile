"""General Learning-to-Answer Pipeline (Build GP-001).

The first real, non-fixture vertical slice of the architecture:

    learn from instructional text  ->  build an MEA problem manifest
    ->  execute exact domain math  ->  governed gate  ->  seal
    ->  compile RMC meaning        ->  generatively render language
    ->  Echo-approve the faithful answer  ->  return it

Build GP-001 ships two learned domains (whole-number arithmetic and the
fraction-change-capacity family) and refuses any question it has not learned,
rather than guessing. Capability grows by adding domains in `domains.py`; the
engine never changes.

Boundaries: in-memory only. No route, no UI, no LLM, no memory write, no
Chroma, no Identity Vault, no CT/ledger activity. It does not modify any
Build 005-010 file.
"""

from .contracts import (
    GENERAL_PIPELINE_BUILD_ID,
    GENERAL_PIPELINE_SCHEMA_VERSION,
    SemanticSource,
    ParsedQuestion,
    ExactSolution,
    MeaningManifest,
)
from .pipeline import (
    PipelineResult,
    learn,
    answer_question,
    learn_and_answer,
)
from .domains import all_domains, match_domain
from .capability_registry import (
    CapabilityContract,
    registry_snapshot,
    registry_hash,
    boundary_contract,
)
from .capability_services import (
    CapabilityServiceContract,
    CapabilityInvocationRequest,
    CapabilityExecutionReceipt,
    service_registry_snapshot,
    service_registry_hash,
    service_boundary_contract,
)

from .dependency_registry import (
    DependencyLicenseRecord,
    all_dependency_records,
    active_runtime_dependency_ids,
    dependency_registry_snapshot,
    dependency_registry_hash,
    dependency_boundary_contract,
    active_testing_dependency_ids,
    validate_testing_dependency_binding,
)
from .typed_ast import (
    LinearEquationAST,
    TypedASTParseReceipt,
    inspect_linear_equation_parse,
    parse_linear_equation_ast,
    typed_ast_boundary_contract,
)
from .safe_solver_adapters import (
    SafeSolverAdapterContract,
    SafeSolverAdapterReceipt,
    safe_solver_adapter_for_domain,
    safe_solver_adapter_boundary_contract,
)

from .quantity_ast import (
    CapacityQuantityAST,
    QuantityASTBoundaryError,
    build_capacity_quantity_ast,
    require_capacity_quantity_ast,
    quantity_ast_boundary_contract,
)
from .quantity_adapters import (
    SafeQuantityAdapterContract,
    SafeQuantityAdapterReceipt,
    safe_quantity_adapter_for_domain,
    safe_quantity_adapter_boundary_contract,
)

from .manifest_contract_v2 import (
    ManifestContractV2,
    SourceAncestryReferenceV2,
    VerificationReceiptV2,
    DeliveryAuthorizationReceiptV2,
    manifest_contract_v2_boundary,
)

from .outcome_contract_v2 import (
    NonDeliveryOutcomeReceiptV2,
    outcome_contract_v2_boundary,
)

__all__ = [
    "GENERAL_PIPELINE_BUILD_ID",
    "GENERAL_PIPELINE_SCHEMA_VERSION",
    "SemanticSource",
    "ParsedQuestion",
    "ExactSolution",
    "MeaningManifest",
    "PipelineResult",
    "learn",
    "answer_question",
    "learn_and_answer",
    "all_domains",
    "match_domain",
    "CapabilityContract",
    "registry_snapshot",
    "registry_hash",
    "boundary_contract",
    "CapabilityServiceContract",
    "CapabilityInvocationRequest",
    "CapabilityExecutionReceipt",
    "service_registry_snapshot",
    "service_registry_hash",
    "service_boundary_contract",
    "DependencyLicenseRecord",
    "all_dependency_records",
    "active_runtime_dependency_ids",
    "dependency_registry_snapshot",
    "dependency_registry_hash",
    "dependency_boundary_contract",
    "active_testing_dependency_ids",
    "validate_testing_dependency_binding",
    "LinearEquationAST",
    "TypedASTParseReceipt",
    "inspect_linear_equation_parse",
    "parse_linear_equation_ast",
    "typed_ast_boundary_contract",
    "SafeSolverAdapterContract",
    "SafeSolverAdapterReceipt",
    "safe_solver_adapter_for_domain",
    "safe_solver_adapter_boundary_contract",
    "CapacityQuantityAST",
    "QuantityASTBoundaryError",
    "build_capacity_quantity_ast",
    "require_capacity_quantity_ast",
    "quantity_ast_boundary_contract",
    "SafeQuantityAdapterContract",
    "SafeQuantityAdapterReceipt",
    "safe_quantity_adapter_for_domain",
    "safe_quantity_adapter_boundary_contract",
    "ManifestContractV2",
    "SourceAncestryReferenceV2",
    "VerificationReceiptV2",
    "DeliveryAuthorizationReceiptV2",
    "manifest_contract_v2_boundary",
    "NonDeliveryOutcomeReceiptV2",
    "outcome_contract_v2_boundary",
    "installed_distribution_versions",
    "verify_installed_distributions",
]

from .gp010b_audited_tool_activation import (
    installed_distribution_versions,
    verify_installed_distributions,
)

from .runtime_truth_attestation_gp010c import (
    ActiveToolDeliveryAttestationReceipt,
    RuntimeTruthAttestationError,
    attest_delivered_equation,
    runtime_truth_boundary,
)
__all__.extend([
    "ActiveToolDeliveryAttestationReceipt",
    "RuntimeTruthAttestationError",
    "attest_delivered_equation",
    "runtime_truth_boundary",
])

from .gp011b_pint_quantity_integration import (
    installed_pint_distribution_versions,
    verify_pint_installation_and_reuse_boundary,
)
__all__.extend([
    "installed_pint_distribution_versions",
    "verify_pint_installation_and_reuse_boundary",
])

from .quantity_runtime_attestation_gp011b import (
    ActiveQuantityDeliveryAttestationReceipt,
    QuantityRuntimeAttestationError,
    attest_delivered_capacity,
    quantity_runtime_truth_boundary,
)
__all__.extend([
    "ActiveQuantityDeliveryAttestationReceipt",
    "QuantityRuntimeAttestationError",
    "attest_delivered_capacity",
    "quantity_runtime_truth_boundary",
])


from .symbolic_math_ast import (
    MATH001_BUILD_ID,
    MATH001_SCHEMA_VERSION,
    MATH001_CAPABILITY_ID,
    SUPPORTED_OPERATION_FAMILIES,
    SymbolicMathBoundaryError,
    SymbolicMathResourcePolicy,
    SymbolicMathOperationManifest,
    symbolic_math_ast_boundary,
)
from .symbolic_math_kernel import (
    SymbolicMathServiceError,
    SymbolicMathExecutionReceipt,
    SymbolicMathPendingGovernanceReceipt,
    SymbolicMathNonDeliveryReceipt,
    symbolic_math_service_contract,
    execute_symbolic_math_operation,
    execute_symbolic_math_attestation_batch,
    symbolic_math_kernel_boundary,
)
from .symbolic_math_runtime_attestation_math001r1 import (
    SymbolicMathKernelAttestationReceipt,
    attest_symbolic_math_kernel,
)
from .gp012r1_symbolic_math_computation_capability import (
    installed_symbolic_math_distribution_versions,
    verify_symbolic_math_installation_boundary,
)
__all__.extend([
    "MATH001_BUILD_ID", "MATH001_SCHEMA_VERSION", "MATH001_CAPABILITY_ID",
    "SUPPORTED_OPERATION_FAMILIES", "SymbolicMathBoundaryError",
    "SymbolicMathResourcePolicy", "SymbolicMathOperationManifest",
    "symbolic_math_ast_boundary", "SymbolicMathServiceError",
    "SymbolicMathExecutionReceipt", "SymbolicMathPendingGovernanceReceipt",
    "SymbolicMathNonDeliveryReceipt", "symbolic_math_service_contract",
    "execute_symbolic_math_operation", "execute_symbolic_math_attestation_batch",
    "symbolic_math_kernel_boundary", "SymbolicMathKernelAttestationReceipt",
    "attest_symbolic_math_kernel", "installed_symbolic_math_distribution_versions",
    "verify_symbolic_math_installation_boundary",
])


from .symbolic_math_language_compiler import (
    BUILD_ID as NLMATH001_GP013_BUILD_ID,
    DOMAIN_ID as NLMATH001_GP013_DOMAIN_ID,
    LANGUAGE_CAPABILITY_ID,
    SUPPORTED_LANGUAGE_FAMILIES,
    SymbolicMathLanguageBoundaryError,
    LanguageCompilerReceipt,
    CompiledSymbolicMathRequest,
    compile_symbolic_math_request,
    language_compiler_boundary,
)
from .symbolic_math_mea_evidence_bridge import (
    SymbolicMathEvidenceBridgeError,
    SymbolicMathLanguageBridgeContract,
    SymbolicMathBridgeInvocationReceipt,
    SymbolicMathVerifiedToolEvidence,
    SymbolicMathResolvedSolution,
    SymbolicMathEvidenceGateResult,
    installed_language_authority_source,
    language_bridge_contract,
    build_symbolic_math_problem_manifest,
    compute_symbolic_math_evidence,
    evaluate_symbolic_math_evidence_gate,
    seal_symbolic_math_problem_manifest,
    mea_symbolic_math_evidence_bridge_boundary,
)
from .symbolic_math_rmc_delivery import (
    compile_symbolic_math_meaning,
    build_symbolic_math_manifest_contract_v2,
    render_symbolic_math_with_manifest_contract_v2,
    validate_symbolic_math_echo_v2,
    symbolic_math_renderer_boundary,
)
from .symbolic_math_language_vertical_slice import (
    NaturalLanguageMathNonDeliveryReceipt,
    NaturalLanguageMathPipelineResult,
    answer_symbolic_math_language_request,
    attest_natural_language_symbolic_math_vertical_slice,
    natural_language_symbolic_math_vertical_slice_boundary,
)
from .gp013_natural_language_symbolic_math_vertical_slice import (
    activate as activate_natural_language_symbolic_math_vertical_slice,
)
__all__.extend([
    "NLMATH001_GP013_BUILD_ID", "NLMATH001_GP013_DOMAIN_ID",
    "LANGUAGE_CAPABILITY_ID", "SUPPORTED_LANGUAGE_FAMILIES",
    "SymbolicMathLanguageBoundaryError", "LanguageCompilerReceipt",
    "CompiledSymbolicMathRequest", "compile_symbolic_math_request",
    "language_compiler_boundary", "SymbolicMathEvidenceBridgeError",
    "SymbolicMathLanguageBridgeContract", "SymbolicMathBridgeInvocationReceipt",
    "SymbolicMathVerifiedToolEvidence", "SymbolicMathResolvedSolution",
    "SymbolicMathEvidenceGateResult", "installed_language_authority_source",
    "language_bridge_contract", "build_symbolic_math_problem_manifest",
    "compute_symbolic_math_evidence", "evaluate_symbolic_math_evidence_gate",
    "seal_symbolic_math_problem_manifest", "mea_symbolic_math_evidence_bridge_boundary",
    "compile_symbolic_math_meaning", "build_symbolic_math_manifest_contract_v2",
    "render_symbolic_math_with_manifest_contract_v2", "validate_symbolic_math_echo_v2",
    "symbolic_math_renderer_boundary", "NaturalLanguageMathNonDeliveryReceipt",
    "NaturalLanguageMathPipelineResult", "answer_symbolic_math_language_request",
    "attest_natural_language_symbolic_math_vertical_slice",
    "natural_language_symbolic_math_vertical_slice_boundary",
    "activate_natural_language_symbolic_math_vertical_slice",
])


from .symbolic_math_operator_language_realizer import (
    BUILD_ID as LANG_EXPR001_GP014_BUILD_ID,
    SymbolicMathExpressionRealizerError,
    ExpressionCandidate,
    OperatorGuidedExpressionReceipt,
    realize_operator_guided_symbolic_math_expression,
    operator_guided_language_realizer_boundary,
)
from .gp014_operator_guided_language_realizer import (
    activate as activate_operator_guided_language_realizer,
    attest as attest_operator_guided_language_realizer,
)
__all__.extend([
    "LANG_EXPR001_GP014_BUILD_ID", "SymbolicMathExpressionRealizerError",
    "ExpressionCandidate", "OperatorGuidedExpressionReceipt",
    "realize_operator_guided_symbolic_math_expression",
    "operator_guided_language_realizer_boundary",
    "activate_operator_guided_language_realizer",
    "attest_operator_guided_language_realizer",
])
