"""NL-MATH-001 / GP-013 — RMC meaning, deterministic math renderer and actual Echo delivery binding.

MEA seals the resolved problem state first. This module then compiles a separate
RMC meaning object, renders only from that manifest using a controlled semantic
lexicon, calls the existing production Echo validator, and only then permits
the existing DeliveryAuthorizationReceiptV2 path to authorize human text.

This is not the historical renderer preview lane and does not ingest a corpus.
"""
from __future__ import annotations

from typing import Any, Dict

from rmc_engine_v1.mea.manifest_schema import ProblemManifest, ClaimStatus

from .contracts import MeaningManifest, SemanticSource, canonical_hash
from .echo_approval import EchoResult, validate_and_approve_v2
from .manifest_contract_v2 import (
    FORMAL_DERIVATION,
    ManifestContractV2,
    SourceAncestryReferenceV2,
    VerificationReceiptV2,
    SYMBOLIC_MATH_TOOL_EVIDENCE_VERIFICATION,
    required_authority_basis_v2,
    require_render_authority,
)
from .symbolic_math_ast import MATH001_CAPABILITY_ID, symbolic_math_ast_boundary
from .symbolic_math_kernel import SUCCESS_STATUS, symbolic_math_service_contract
from .symbolic_math_language_compiler import BUILD_ID, DOMAIN_ID, CompiledSymbolicMathRequest
from .symbolic_math_mea_evidence_bridge import (
    SymbolicMathBridgeInvocationReceipt,
    SymbolicMathEvidenceGateResult,
    SymbolicMathResolvedSolution,
    SymbolicMathVerifiedToolEvidence,
)
from .symbolic_math_operator_language_realizer import (
    OperatorGuidedExpressionReceipt,
    realize_operator_guided_symbolic_math_expression,
    operator_guided_language_realizer_boundary,
)

RENDERER_SCHEMA_VERSION = "aiweb_symbolic_math_rmc_renderer_echo_binding_v2_gp014"

_OPERATION_LEXICON = {
    "simplification": ("simplified form", "simplifying"),
    "expansion": ("expanded form", "expanding"),
    "factoring": ("factored form", "factoring"),
    "trigonometric_simplification": ("trigonometric simplified form", "trigonometric simplification of"),
    "trigonometric_expansion": ("trigonometric expanded form", "trigonometric expansion of"),
    "differentiation": ("derivative", "differentiating"),
    "integration": ("indefinite integral", "integrating"),
    "limits": ("limit", "taking the limit of"),
}

_VERIFICATION_LANGUAGE = {
    "EXACT_SYMBOLIC_EQUIVALENCE": (
        "Verification: exact symbolic equivalence was confirmed by the governed SymPy computation."
    ),
    "EXACT_SUBSTITUTION_VERIFICATION": (
        "Verification: exact substitution verification was confirmed by the governed SymPy computation."
    ),
    "DETERMINISTIC_ENGINE_REPLAY": (
        "Verification: the governed SymPy computation was replayed deterministically with the same symbolic result; "
        "this is deterministic computation evidence, not an independent theorem proof."
    ),
    "STRUCTURAL_SYMBOLIC_RECEIPT": (
        "Verification: a governed structural symbolic receipt was produced for this result."
    ),
}


def compile_symbolic_math_meaning(
    sealed_manifest: ProblemManifest,
    compiled: CompiledSymbolicMathRequest,
    solution: SymbolicMathResolvedSolution,
    evidence: SymbolicMathVerifiedToolEvidence,
    source_ref: str,
) -> MeaningManifest:
    """Compile RMC meaning only after a resolved MEA state exists."""
    if sealed_manifest.claim_status != ClaimStatus.RESOLVED_MANIFEST.value:
        raise ValueError("symbolic RMC meaning requires a sealed resolved MEA manifest")
    if solution.answer_text != evidence.computed_display_text:
        raise ValueError("RMC meaning cannot alter the verified computed artifact")
    if solution.verification_strength != evidence.verification_strength:
        raise ValueError("RMC meaning cannot alter verification strength")
    noun, _ = _OPERATION_LEXICON[compiled.operation_family]
    given = [f"expression is {compiled.expression_display}"]
    if compiled.variable:
        given.append(f"variable is {compiled.variable}")
    return MeaningManifest(
        problem_id=sealed_manifest.problem_id,
        claim_status=sealed_manifest.claim_status,
        answer_text=solution.answer_text,
        answer_unit="",
        object_noun="",
        operation_word=compiled.operation_family,
        given_facts=given,
        reasoning_steps=list(solution.steps),
        verification_text=_VERIFICATION_LANGUAGE[solution.verification_strength],
        source_ref=source_ref,
    )



def _meaning_fact(meaning: MeaningManifest, prefix: str) -> str:
    for fact in meaning.given_facts:
        if fact.startswith(prefix):
            return fact[len(prefix):].strip()
    raise ValueError(f"symbolic RMC meaning is missing required fact {prefix!r}")


def build_symbolic_math_manifest_contract_v2(
    *,
    source: SemanticSource,
    compiled: CompiledSymbolicMathRequest,
    solution: SymbolicMathResolvedSolution,
    evidence: SymbolicMathVerifiedToolEvidence,
    invocation: SymbolicMathBridgeInvocationReceipt,
    gate: SymbolicMathEvidenceGateResult,
    open_mea_manifest_hash: str,
    sealed_mea_manifest: ProblemManifest,
    sealed_mea_manifest_hash: str,
    meaning: MeaningManifest,
) -> ManifestContractV2:
    """Bind verified tool evidence into the existing actual-render authority contract."""
    procedure = source.procedure_for_domain(DOMAIN_ID)
    if procedure is None:
        raise ValueError("symbolic renderer requires installed language source ancestry")
    if not gate.passed or not solution.verified:
        raise ValueError("unsealed symbolic evidence cannot enter Manifest Contract v2")
    if sealed_mea_manifest.claim_status != ClaimStatus.RESOLVED_MANIFEST.value:
        raise ValueError("symbolic renderer requires resolved MEA state")
    source_ancestry = SourceAncestryReferenceV2(
        source_id=source.source_id,
        source_hash=source.source_hash(),
        raw_text_hash=source.raw_text_hash,
        procedure_id=procedure.procedure_id,
        source_ref=procedure.source_ref,
        domain_id=DOMAIN_ID,
    )
    verification = VerificationReceiptV2(
        solution_hash=canonical_hash(solution.to_dict()),
        gate_hash=gate.gate_hash(),
        verification_method=SYMBOLIC_MATH_TOOL_EVIDENCE_VERIFICATION,
        verification_text=solution.verification_text,
        solution_verified=solution.verified,
        gate_passed=gate.passed,
        verification_strength=solution.verification_strength,
        limitations=(
            "Verified within the installed typed symbolic-mathematics operation and declared verification strength.",
            "This is not an empirical-world claim or a corpus-derived assertion.",
            "The computation kernel did not authorize output; delivery requires actual Echo validation.",
        ),
    )
    kernel_service = symbolic_math_service_contract()
    return ManifestContractV2(
        problem_id=sealed_mea_manifest.problem_id,
        claim_type=FORMAL_DERIVATION,
        claim_status=sealed_mea_manifest.claim_status,
        authority_basis=required_authority_basis_v2(),
        source_ancestry=(source_ancestry,),
        selected_capability_id=MATH001_CAPABILITY_ID,
        capability_contract_hash=canonical_hash(symbolic_math_ast_boundary()),
        selected_service_id=str(kernel_service["service_id"]),
        service_contract_hash=canonical_hash(kernel_service),
        invocation_request_hash=invocation.receipt_hash(),
        execution_receipt_hash=evidence.evidence_hash(),
        verification_receipt=verification,
        open_mea_manifest_hash=open_mea_manifest_hash,
        sealed_mea_manifest_hash=sealed_mea_manifest_hash,
        meaning_manifest_hash=meaning.meaning_hash(),
        parsed_question_hash=compiled.request_hash(),
        symbolic_math_operation_manifest_hash=evidence.operation_manifest_hash,
        symbolic_math_execution_receipt_hash=evidence.kernel_execution_receipt_hash,
        symbolic_math_pending_governance_receipt_hash=evidence.kernel_pending_governance_receipt_hash,
        symbolic_math_verification_strength=evidence.verification_strength,
        symbolic_math_computation_status=SUCCESS_STATUS,
    )


def realize_symbolic_math_with_manifest_contract_v2(
    meaning: MeaningManifest,
    contract: ManifestContractV2,
) -> OperatorGuidedExpressionReceipt:
    """Produce a traceable pre-Echo expression candidate receipt from sealed meaning only."""
    require_render_authority(contract, meaning)
    if contract.symbolic_math_computation_status != SUCCESS_STATUS:
        raise ValueError("symbolic rendering requires verified pending-governance computation")
    return realize_operator_guided_symbolic_math_expression(meaning, contract)


def render_symbolic_math_with_manifest_contract_v2(
    meaning: MeaningManifest,
    contract: ManifestContractV2,
) -> str:
    """Backward-compatible text surface, now selected by the operator-guided realizer."""
    return realize_symbolic_math_with_manifest_contract_v2(meaning, contract).selected_text


def validate_symbolic_math_echo_v2(
    meaning: MeaningManifest,
    rendered_text: str,
    contract: ManifestContractV2,
) -> EchoResult:
    """Call the installed production Echo gate, then tighten math-specific fidelity checks."""
    base = validate_and_approve_v2(meaning, rendered_text, contract)
    checks = dict(base.checks)
    reasons = list(base.failure_reasons)
    text = rendered_text or ""
    low = text.lower()
    if meaning.operation_word not in _OPERATION_LEXICON:
        return EchoResult(False, "ECHO_REJECTED_RENDERING", {"known_operation_family": False}, ["unknown_symbolic_operation_family"], "")
    expression_display = _meaning_fact(meaning, "expression is ")
    noun, _ = _OPERATION_LEXICON[meaning.operation_word]
    additions = {
        "symbolic_operation_language_preserved": noun.lower() in low,
        "symbolic_expression_preserved": expression_display in text,
        "symbolic_verification_strength_preserved": meaning.verification_text in text,
        "computed_pending_authority_bound_before_echo": contract.symbolic_math_computation_status == SUCCESS_STATUS,
        "actual_echo_not_replaced_by_math_kernel": contract.selected_capability_id == MATH001_CAPABILITY_ID,
        "no_symbolic_empirical_upgrade": "empirically proven" not in low and "law of nature" not in low,
    }
    checks.update(additions)
    for name, passed in additions.items():
        if not passed:
            reasons.append(name)
    approved = base.approved_output and not reasons
    return EchoResult(
        approved_output=approved,
        echo_status=base.echo_status if approved else "ECHO_REJECTED_RENDERING",
        checks=checks,
        failure_reasons=reasons,
        approved_text=text if approved else "",
    )


def symbolic_math_renderer_boundary() -> Dict[str, Any]:
    return {
        "build_id": BUILD_ID,
        "schema_version": RENDERER_SCHEMA_VERSION,
        "layer": "RMC meaning and operator-guided mathematical language renderer bound to production Echo",
        "semantic_lexicon_operation_families": sorted(_OPERATION_LEXICON),
        "renders_only_from_sealed_mea_and_bound_meaning": True,
        "operator_guided_language_realizer": operator_guided_language_realizer_boundary(),
        "fixed_single_sentence_formatter_superseded": True,
        "multiple_lawful_expression_candidates_generated": True,
        "uses_existing_manifest_contract_v2": True,
        "invokes_actual_existing_echo_validator": True,
        "uses_historical_renderer_preview_lane": False,
        "delivery_authority_created_here": False,
        "corpus_ingestion_added": False,
        "calls_llm": False,
        "writes_memory": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "mints_ct": False,
        "writes_ledgers": False,
    }


__all__ = [
    "RENDERER_SCHEMA_VERSION", "compile_symbolic_math_meaning",
    "build_symbolic_math_manifest_contract_v2",
    "render_symbolic_math_with_manifest_contract_v2",
    "validate_symbolic_math_echo_v2", "symbolic_math_renderer_boundary",
]
