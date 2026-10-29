"""NL-MATH-001 / GP-013 — first complete natural-language symbolic-math to Echo slice.

Public entrypoint:
    answer_symbolic_math_language_request(question)

Lawful route:
    natural language -> bounded compiler -> typed MATH-001R1 manifest
    -> isolated verified computation evidence -> MEA open/sealed problem manifest
    -> RMC meaning -> Manifest Contract v2 -> controlled language renderer
    -> actual installed Echo -> DeliveryAuthorizationReceiptV2.

This route is intentionally separate from legacy question-domain matching. It
does not register itself into the older four-domain router and therefore does
not silently change legacy language behavior. It adds no routes or UI.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from rmc_engine_v1.mea.manifest_schema import (
    canonical_hash as mea_manifest_hash,
    to_dict as mea_manifest_to_dict,
)

from .contracts import canonical_hash
from .manifest_contract_v2 import finalize_echo_delivery, manifest_contract_v2_boundary
from .symbolic_math_ast import symbolic_math_ast_boundary
from .symbolic_math_kernel import symbolic_math_kernel_boundary
from .symbolic_math_language_compiler import (
    BUILD_ID,
    DOMAIN_ID,
    SymbolicMathLanguageBoundaryError,
    compile_symbolic_math_request,
    language_compiler_boundary,
)
from .symbolic_math_mea_evidence_bridge import (
    SymbolicMathEvidenceBridgeError,
    build_symbolic_math_problem_manifest,
    compute_symbolic_math_evidence,
    evaluate_symbolic_math_evidence_gate,
    installed_language_authority_source,
    language_bridge_contract,
    mea_symbolic_math_evidence_bridge_boundary,
    seal_symbolic_math_problem_manifest,
)
from .symbolic_math_rmc_delivery import (
    build_symbolic_math_manifest_contract_v2,
    compile_symbolic_math_meaning,
    realize_symbolic_math_with_manifest_contract_v2,
    render_symbolic_math_with_manifest_contract_v2,
    symbolic_math_renderer_boundary,
    validate_symbolic_math_echo_v2,
)

VERTICAL_SLICE_SCHEMA_VERSION = "aiweb_natural_language_symbolic_math_echo_vertical_slice_v1_gp013"
NON_DELIVERY_SCHEMA_VERSION = "aiweb_natural_language_symbolic_math_non_delivery_v1_gp013"


@dataclass(frozen=True)
class NaturalLanguageMathNonDeliveryReceipt:
    question_hash: str
    stage: str
    reasons: Tuple[str, ...]
    open_mea_manifest_hash: Optional[str] = None
    tool_evidence_hash: Optional[str] = None
    manifest_contract_v2_hash: Optional[str] = None
    echo_receipt_hash: Optional[str] = None
    schema_version: str = NON_DELIVERY_SCHEMA_VERSION
    status: str = "CONTAINED_NON_DELIVERY"
    delivery_authorized: bool = False
    writes_memory: bool = False
    writes_identity_vault: bool = False
    writes_contribution_economy: bool = False
    mints_ct: bool = False
    writes_ledgers: bool = False
    ingests_corpus: bool = False

    def __post_init__(self) -> None:
        if not self.question_hash or not self.reasons:
            raise ValueError("non-delivery requires question hash and explicit reasons")
        if self.delivery_authorized or any((
            self.writes_memory, self.writes_identity_vault, self.writes_contribution_economy,
            self.mints_ct, self.writes_ledgers, self.ingests_corpus,
        )):
            raise ValueError("non-delivery receipt cannot claim delivery or side effects")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "status": self.status,
            "question_hash": self.question_hash,
            "stage": self.stage,
            "reasons": list(self.reasons),
            "open_mea_manifest_hash": self.open_mea_manifest_hash,
            "tool_evidence_hash": self.tool_evidence_hash,
            "manifest_contract_v2_hash": self.manifest_contract_v2_hash,
            "echo_receipt_hash": self.echo_receipt_hash,
            "delivery_authorized": self.delivery_authorized,
            "writes_memory": self.writes_memory,
            "writes_identity_vault": self.writes_identity_vault,
            "writes_contribution_economy": self.writes_contribution_economy,
            "mints_ct": self.mints_ct,
            "writes_ledgers": self.writes_ledgers,
            "ingests_corpus": self.ingests_corpus,
        }

    def receipt_hash(self) -> str:
        return canonical_hash(self.to_dict())


@dataclass
class NaturalLanguageMathPipelineResult:
    status: str
    question: str
    answer_text: Optional[str] = None
    domain: str = DOMAIN_ID
    trace: Dict[str, Any] = field(default_factory=dict)
    reasons: List[str] = field(default_factory=list)
    build_id: str = BUILD_ID
    schema_version: str = VERTICAL_SLICE_SCHEMA_VERSION

    def to_dict(self) -> Dict[str, Any]:
        return {
            "build_id": self.build_id,
            "schema_version": self.schema_version,
            "status": self.status,
            "question": self.question,
            "answer_text": self.answer_text,
            "domain": self.domain,
            "trace": self.trace,
            "reasons": list(self.reasons),
        }

    def result_hash(self) -> str:
        payload = self.to_dict()
        trace = dict(payload["trace"])
        for key in ("open_manifest", "sealed_manifest"):
            value = trace.get(key)
            if isinstance(value, dict):
                trace[key] = {k: v for k, v in value.items() if k not in ("created_at", "updated_at")}
        payload["trace"] = trace
        return canonical_hash(payload)


def _boundary_trace() -> Dict[str, Any]:
    return {
        "vertical_slice_boundary": natural_language_symbolic_math_vertical_slice_boundary(),
        "language_compiler_boundary": language_compiler_boundary(),
        "math_ast_boundary": symbolic_math_ast_boundary(),
        "math_kernel_boundary": symbolic_math_kernel_boundary(),
        "mea_evidence_bridge_boundary": mea_symbolic_math_evidence_bridge_boundary(),
        "rmc_math_renderer_boundary": symbolic_math_renderer_boundary(),
        "manifest_contract_v2_boundary": manifest_contract_v2_boundary(),
    }


def _contained_result(question: str, stage: str, reasons: List[str], trace: Optional[Dict[str, Any]] = None, **bindings: str) -> NaturalLanguageMathPipelineResult:
    receipt = NaturalLanguageMathNonDeliveryReceipt(
        question_hash=canonical_hash({"raw_question": str(question)}),
        stage=stage,
        reasons=tuple(reasons),
        open_mea_manifest_hash=bindings.get("open_mea_manifest_hash"),
        tool_evidence_hash=bindings.get("tool_evidence_hash"),
        manifest_contract_v2_hash=bindings.get("manifest_contract_v2_hash"),
        echo_receipt_hash=bindings.get("echo_receipt_hash"),
    )
    full_trace = dict(trace or _boundary_trace())
    full_trace.update({
        "non_delivery_receipt": receipt.to_dict(),
        "non_delivery_receipt_hash": receipt.receipt_hash(),
    })
    return NaturalLanguageMathPipelineResult(
        status="REFUSED_UNLEARNED" if stage == "LANGUAGE_COMPILER_REFUSED" else ("ECHO_REJECTED" if stage == "ECHO_REJECTED" else "GATE_BLOCKED"),
        question=question,
        trace=full_trace,
        reasons=reasons,
    )


def answer_symbolic_math_language_request(question: str) -> NaturalLanguageMathPipelineResult:
    """Execute the first lawful supported natural-language symbolic math slice."""
    base_trace = _boundary_trace()
    try:
        compiled = compile_symbolic_math_request(question)
    except SymbolicMathLanguageBoundaryError as exc:
        return _contained_result(
            question,
            "LANGUAGE_COMPILER_REFUSED",
            [f"unsupported_or_ambiguous_math_language: {exc}"],
            base_trace,
        )

    source = installed_language_authority_source()
    bridge = language_bridge_contract()
    try:
        open_manifest = build_symbolic_math_problem_manifest(compiled, source)
        invocation, evidence, solution, kernel_result = compute_symbolic_math_evidence(compiled, open_manifest)
        gate = evaluate_symbolic_math_evidence_gate(open_manifest, solution, evidence, source)
    except (SymbolicMathEvidenceBridgeError, ValueError) as exc:
        return _contained_result(
            question,
            "TOOL_EVIDENCE_CONTAINED",
            [f"verified_tool_evidence_not_available: {exc}"],
            {
                **base_trace,
                "compiled_request": compiled.to_dict(),
                "compiled_request_hash": compiled.request_hash(),
            },
        )

    trace: Dict[str, Any] = {
        **base_trace,
        "installed_language_authority_source": source.to_dict(),
        "installed_language_authority_source_hash": source.source_hash(),
        "language_bridge_contract": bridge.to_dict(),
        "language_bridge_contract_hash": bridge.contract_hash(),
        "compiled_request": compiled.to_dict(),
        "compiled_request_hash": compiled.request_hash(),
        "compiler_receipt": compiled.compiler_receipt.to_dict(),
        "compiler_receipt_hash": compiled.compiler_receipt.receipt_hash(),
        "symbolic_math_operation_manifest": compiled.operation_manifest.to_dict(),
        "symbolic_math_operation_manifest_hash": compiled.operation_manifest.manifest_hash(),
        "open_manifest": mea_manifest_to_dict(open_manifest),
        "open_manifest_hash": mea_manifest_hash(open_manifest),
        "bridge_invocation_receipt": invocation.to_dict(),
        "bridge_invocation_receipt_hash": invocation.receipt_hash(),
        "kernel_result": kernel_result,
        "verified_tool_evidence": evidence.to_dict(),
        "verified_tool_evidence_hash": evidence.evidence_hash(),
        "solution": solution.to_dict(),
        "mea_evidence_gate": gate.to_dict(),
        "mea_evidence_gate_hash": gate.gate_hash(),
    }

    if not gate.passed:
        return _contained_result(
            question,
            "MEA_SEAL_GATE_BLOCKED",
            list(gate.reasons),
            trace,
            open_mea_manifest_hash=mea_manifest_hash(open_manifest),
            tool_evidence_hash=evidence.evidence_hash(),
        )

    sealed = seal_symbolic_math_problem_manifest(open_manifest, solution, evidence, gate)
    procedure = source.procedure_for_domain(DOMAIN_ID)
    assert procedure is not None
    meaning = compile_symbolic_math_meaning(sealed, compiled, solution, evidence, procedure.source_ref)
    contract = build_symbolic_math_manifest_contract_v2(
        source=source,
        compiled=compiled,
        solution=solution,
        evidence=evidence,
        invocation=invocation,
        gate=gate,
        open_mea_manifest_hash=mea_manifest_hash(open_manifest),
        sealed_mea_manifest=sealed,
        sealed_mea_manifest_hash=mea_manifest_hash(sealed),
        meaning=meaning,
    )
    expression_realization = realize_symbolic_math_with_manifest_contract_v2(meaning, contract)
    rendered = expression_realization.selected_text
    echo = validate_symbolic_math_echo_v2(meaning, rendered, contract)

    trace.update({
        "sealed_manifest": mea_manifest_to_dict(sealed),
        "sealed_manifest_hash": mea_manifest_hash(sealed),
        "meaning_manifest": meaning.to_dict(),
        "meaning_hash": meaning.meaning_hash(),
        "manifest_contract_v2": contract.to_dict(),
        "manifest_contract_v2_hash": contract.contract_hash(),
        "expression_realization_receipt": expression_realization.to_dict(),
        "expression_realization_receipt_hash": expression_realization.receipt_hash(),
        "rendered_text": rendered,
        "echo": echo.to_dict(),
        "echo_hash": echo.echo_hash(),
    })
    if not echo.approved_output:
        return _contained_result(
            question,
            "ECHO_REJECTED",
            list(echo.failure_reasons),
            trace,
            open_mea_manifest_hash=mea_manifest_hash(open_manifest),
            tool_evidence_hash=evidence.evidence_hash(),
            manifest_contract_v2_hash=contract.contract_hash(),
            echo_receipt_hash=echo.echo_hash(),
        )

    delivery = finalize_echo_delivery(contract, meaning, echo)
    trace.update({
        "delivery_authorization_v2": delivery.to_dict(),
        "delivery_authorization_v2_hash": delivery.receipt_hash(),
    })
    return NaturalLanguageMathPipelineResult(
        status="ANSWERED",
        question=question,
        answer_text=echo.approved_text,
        trace=trace,
    )


def attest_natural_language_symbolic_math_vertical_slice() -> Dict[str, Any]:
    """Run non-fixture supported language questions through actual Echo delivery."""
    questions = (
        "Differentiate x^3 + 4*x with respect to x.",
        "Integrate 3*x^2 + 4 with respect to x.",
        "Expand (x + 1)^3.",
        "Factor x^2 - 9.",
        "Simplify (x^2 - 1)/(x - 1).",
        "Trigonometric simplify sin(x)^2 + cos(x)^2.",
        "Trigonometric expand sin(x + y).",
        "Find the limit of (x^2 - 1)/(x - 1) as x approaches 1.",
    )
    rows: List[Dict[str, Any]] = []
    for question in questions:
        result = answer_symbolic_math_language_request(question)
        if result.status != "ANSWERED":
            raise ValueError(f"live symbolic language attestation failed for {question!r}: {result.reasons}")
        delivery = result.trace["delivery_authorization_v2"]
        kernel = result.trace["kernel_result"]
        if (
            delivery["delivery_status"] != "ECHO_APPROVED_DELIVERY_AUTHORIZED"
            or kernel["delivery_authorized"] is not False
            or kernel["actual_echo_invoked"] is not False
        ):
            raise ValueError("attestation detected improper delivery authority placement")
        rows.append({
            "question_hash": canonical_hash({"raw_question": question}),
            "operation_family": result.trace["compiled_request"]["operation_family"],
            "answer_text": result.trace["solution"]["answer_text"],
            "verification_strength": result.trace["solution"]["verification_strength"],
            "manifest_contract_v2_hash": result.trace["manifest_contract_v2_hash"],
            "echo_hash": result.trace["echo_hash"],
            "expression_realization_receipt_hash": result.trace["expression_realization_receipt_hash"],
            "generated_candidate_count": len(result.trace["expression_realization_receipt"]["candidates"]),
            "selected_candidate_id": result.trace["expression_realization_receipt"]["selected_candidate_id"],
            "delivery_authorization_v2_hash": result.trace["delivery_authorization_v2_hash"],
            "result_hash": result.result_hash(),
        })
    refused = answer_symbolic_math_language_request("Explain quantum gravity and then factor x^2 - 9.")
    if refused.status != "REFUSED_UNLEARNED" or "delivery_authorization_v2" in refused.trace:
        raise ValueError("unsupported mixed language did not remain contained")
    return {
        "build_id": BUILD_ID,
        "schema_version": VERTICAL_SLICE_SCHEMA_VERSION,
        "status": "NLMATH001_GP013_ATTESTED_ACTUAL_ECHO_DELIVERY",
        "supported_attestation_count": len(rows),
        "rows": rows,
        "unsupported_mixed_language_contained": True,
        "corpus_used": False,
        "llm_used": False,
        "writes_memory": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "mints_ct": False,
        "writes_ledgers": False,
    }


def natural_language_symbolic_math_vertical_slice_boundary() -> Dict[str, Any]:
    return {
        "build_id": BUILD_ID,
        "schema_version": VERTICAL_SLICE_SCHEMA_VERSION,
        "purpose": "first complete natural-language symbolic-expression to actual Echo-authorized human-text slice",
        "extends_existing_actual_delivery_spine": True,
        "repurposes_historical_renderer_preview_lane": False,
        "supported_language_operation_family_count": len(language_compiler_boundary()["supported_operation_families"]),
        "supported_language_operation_families": language_compiler_boundary()["supported_operation_families"],
        "underlying_math_kernel_operation_family_count": symbolic_math_ast_boundary()["supported_operation_family_count"],
        "natural_language_to_typed_manifest_active_for_this_bounded_slice": True,
        "tool_evidence_bound_into_real_mea_manifest": True,
        "rmc_meaning_compiled_after_mea_seal": True,
        "deterministic_semantic_lexicon_renderer_active": True,
        "operator_guided_generative_language_realizer_active": True,
        "fixed_single_sentence_formatter_superseded": True,
        "expression_candidates_traced_before_echo": True,
        "actual_echo_and_delivery_authorization_v2_required": True,
        "raw_user_text_sent_to_sympy": False,
        "corpus_ingestion_added": False,
        "calls_llm": False,
        "adds_route_or_ui": False,
        "registers_legacy_domain_router_change": False,
        "writes_memory": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "mints_ct": False,
        "writes_ledgers": False,
    }


__all__ = [
    "VERTICAL_SLICE_SCHEMA_VERSION", "NaturalLanguageMathNonDeliveryReceipt",
    "NaturalLanguageMathPipelineResult", "answer_symbolic_math_language_request",
    "attest_natural_language_symbolic_math_vertical_slice",
    "natural_language_symbolic_math_vertical_slice_boundary",
]
