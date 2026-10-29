"""NL-MATH-001 / GP-013 — verified symbolic-tool evidence bridge into MEA.

This module binds a fully compiled natural-language math request to the already
installed MATH-001R1 computation-only socket.  It does not speak to the user.
It builds a genuine MEA ProblemManifest, invokes the governed tool, checks the
pending-governance receipt, and seals the MEA problem state only when the
verified evidence resolves its declared unknown.

The bridge is intentionally in-memory only: no corpus, no LLM, no persistence,
no Identity Vault, no Contribution Economy, and no delivery authority.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Mapping, Tuple
import re

from rmc_engine_v1.mea.manifest_schema import (
    ProblemManifest,
    MemoryRef,
    ClaimStatus,
    OutputPermission,
    canonical_hash as mea_manifest_hash,
)

from .contracts import CompiledProcedure, SemanticSource, canonical_hash
from .symbolic_math_ast import MATH001_CAPABILITY_ID
from .symbolic_math_kernel import (
    SUCCESS_STATUS,
    REQUIRED_DELIVERY_AUTHORITY,
    execute_symbolic_math_operation,
    symbolic_math_service_contract,
)
from .symbolic_math_language_compiler import (
    BUILD_ID,
    DOMAIN_ID,
    LANGUAGE_CAPABILITY_ID,
    CompiledSymbolicMathRequest,
    language_compiler_boundary,
)

BRIDGE_SCHEMA_VERSION = "aiweb_verified_symbolic_tool_evidence_bridge_v1_gp013"
BRIDGE_SERVICE_ID = "svc.forge.nl_symbolic_math_to_mea_evidence.v1"
_ALLOWED_VERIFICATION_STRENGTHS = {
    "EXACT_SYMBOLIC_EQUIVALENCE",
    "EXACT_SUBSTITUTION_VERIFICATION",
    "DETERMINISTIC_ENGINE_REPLAY",
    "STRUCTURAL_SYMBOLIC_RECEIPT",
}
_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


class SymbolicMathEvidenceBridgeError(ValueError):
    """Raised if a tool receipt cannot lawfully enter the MEA seal boundary."""


def _require_digest(name: str, value: str) -> None:
    if not isinstance(value, str) or _SHA256_RE.fullmatch(value) is None:
        raise SymbolicMathEvidenceBridgeError(f"{name} must be a SHA-256 binding")


def installed_language_authority_source() -> SemanticSource:
    """Return installed, in-memory parser/lexicon authority for this bounded slice.

    This is executable-policy ancestry, not a corpus record and not a user
    memory. It says what request grammar the installed code is allowed to
    compile; it does not install the SymPy capability or promote new evidence.
    """
    policy = language_compiler_boundary()
    source_ref = "installed_policy:nlmath001_gp013_bounded_math_language_compiler"
    procedure = CompiledProcedure(
        procedure_id=canonical_hash({
            "source_ref": source_ref,
            "domain": DOMAIN_ID,
            "delegated_capability": MATH001_CAPABILITY_ID,
            "grammar": policy["supported_operation_families"],
        }),
        domain=DOMAIN_ID,
        relation_text=(
            "fully consumed bounded natural-language symbolic request compiles to an "
            "allowlisted SymbolicMathOperationManifest; verified computation remains "
            "pending downstream Manifest Contract v2 and actual Echo delivery"
        ),
        source_ref=source_ref,
    )
    return SemanticSource(
        source_id="source.installed.nlmath001_gp013.language_authority.v1",
        raw_text_hash=canonical_hash(policy),
        concepts=[],
        procedures=[procedure],
    )


@dataclass(frozen=True)
class SymbolicMathLanguageBridgeContract:
    language_capability_id: str = LANGUAGE_CAPABILITY_ID
    delegated_computation_capability_id: str = MATH001_CAPABILITY_ID
    service_id: str = BRIDGE_SERVICE_ID
    invocation_policy: str = "FULL_INPUT_COMPILE_THEN_TYPED_MATH_MANIFEST_ONLY"
    evidence_policy: str = "VERIFIED_MATH_RECEIPT_REQUIRED_BEFORE_MEA_SEAL"
    schema_version: str = BRIDGE_SCHEMA_VERSION
    execution_scope: str = "IN_MEMORY_ONLY"
    renders_output: bool = False
    echo_approves_output: bool = False
    writes_memory: bool = False
    writes_identity_vault: bool = False
    writes_contribution_economy: bool = False
    mints_ct: bool = False
    writes_ledgers: bool = False
    ingests_corpus: bool = False
    calls_llm: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "language_capability_id": self.language_capability_id,
            "delegated_computation_capability_id": self.delegated_computation_capability_id,
            "service_id": self.service_id,
            "invocation_policy": self.invocation_policy,
            "evidence_policy": self.evidence_policy,
            "execution_scope": self.execution_scope,
            "renders_output": self.renders_output,
            "echo_approves_output": self.echo_approves_output,
            "writes_memory": self.writes_memory,
            "writes_identity_vault": self.writes_identity_vault,
            "writes_contribution_economy": self.writes_contribution_economy,
            "mints_ct": self.mints_ct,
            "writes_ledgers": self.writes_ledgers,
            "ingests_corpus": self.ingests_corpus,
            "calls_llm": self.calls_llm,
        }

    def contract_hash(self) -> str:
        return canonical_hash(self.to_dict())


def language_bridge_contract() -> SymbolicMathLanguageBridgeContract:
    return SymbolicMathLanguageBridgeContract()


@dataclass(frozen=True)
class SymbolicMathBridgeInvocationReceipt:
    question_hash: str
    compiled_request_hash: str
    compiler_receipt_hash: str
    operation_manifest_hash: str
    bridge_contract_hash: str
    kernel_service_contract_hash: str
    schema_version: str = "aiweb_symbolic_math_language_bridge_invocation_receipt_v1_gp013"
    tool_execution_authorized: bool = True
    user_facing_delivery_authorized: bool = False
    raw_user_text_sent_to_sympy: bool = False
    writes_memory: bool = False
    writes_identity_vault: bool = False
    writes_contribution_economy: bool = False
    mints_ct: bool = False
    writes_ledgers: bool = False
    ingests_corpus: bool = False

    def __post_init__(self) -> None:
        for name in (
            "question_hash", "compiled_request_hash", "compiler_receipt_hash",
            "operation_manifest_hash", "bridge_contract_hash",
            "kernel_service_contract_hash",
        ):
            _require_digest(name, getattr(self, name))
        if not self.tool_execution_authorized or self.user_facing_delivery_authorized:
            raise SymbolicMathEvidenceBridgeError("bridge may authorize typed computation only, never delivery")
        if self.raw_user_text_sent_to_sympy or any((
            self.writes_memory, self.writes_identity_vault, self.writes_contribution_economy,
            self.mints_ct, self.writes_ledgers, self.ingests_corpus,
        )):
            raise SymbolicMathEvidenceBridgeError("bridge invocation boundary may not be weakened")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "question_hash": self.question_hash,
            "compiled_request_hash": self.compiled_request_hash,
            "compiler_receipt_hash": self.compiler_receipt_hash,
            "operation_manifest_hash": self.operation_manifest_hash,
            "bridge_contract_hash": self.bridge_contract_hash,
            "kernel_service_contract_hash": self.kernel_service_contract_hash,
            "tool_execution_authorized": self.tool_execution_authorized,
            "user_facing_delivery_authorized": self.user_facing_delivery_authorized,
            "raw_user_text_sent_to_sympy": self.raw_user_text_sent_to_sympy,
            "writes_memory": self.writes_memory,
            "writes_identity_vault": self.writes_identity_vault,
            "writes_contribution_economy": self.writes_contribution_economy,
            "mints_ct": self.mints_ct,
            "writes_ledgers": self.writes_ledgers,
            "ingests_corpus": self.ingests_corpus,
        }

    def receipt_hash(self) -> str:
        return canonical_hash(self.to_dict())


@dataclass(frozen=True)
class SymbolicMathVerifiedToolEvidence:
    open_mea_manifest_hash: str
    invocation_receipt_hash: str
    operation_manifest_hash: str
    kernel_execution_receipt_hash: str
    kernel_pending_governance_receipt_hash: str
    computed_artifact_hash: str
    operation_family: str
    verification_strength: str
    computed_display_text: str
    schema_version: str = "aiweb_symbolic_math_verified_tool_evidence_v1_gp013"
    status: str = "VERIFIED_TOOL_EVIDENCE_BOUND_PENDING_MEA_SEAL"
    kernel_status: str = SUCCESS_STATUS
    required_delivery_authority: str = REQUIRED_DELIVERY_AUTHORITY
    kernel_delivery_authorized: bool = False
    kernel_render_allowed: bool = False
    kernel_actual_echo_invoked: bool = False
    writes_memory: bool = False
    writes_identity_vault: bool = False
    writes_contribution_economy: bool = False
    mints_ct: bool = False
    writes_ledgers: bool = False
    ingests_corpus: bool = False

    def __post_init__(self) -> None:
        for name in (
            "open_mea_manifest_hash", "invocation_receipt_hash",
            "operation_manifest_hash", "kernel_execution_receipt_hash",
            "kernel_pending_governance_receipt_hash", "computed_artifact_hash",
        ):
            _require_digest(name, getattr(self, name))
        if self.verification_strength not in _ALLOWED_VERIFICATION_STRENGTHS:
            raise SymbolicMathEvidenceBridgeError("unrecognized symbolic verification strength")
        if not self.computed_display_text.strip() or len(self.computed_display_text) > 24000:
            raise SymbolicMathEvidenceBridgeError("computed text is empty or over boundary")
        if self.kernel_status != SUCCESS_STATUS or self.required_delivery_authority != REQUIRED_DELIVERY_AUTHORITY:
            raise SymbolicMathEvidenceBridgeError("kernel evidence does not retain downstream authority boundary")
        if any((
            self.kernel_delivery_authorized, self.kernel_render_allowed, self.kernel_actual_echo_invoked,
            self.writes_memory, self.writes_identity_vault, self.writes_contribution_economy,
            self.mints_ct, self.writes_ledgers, self.ingests_corpus,
        )):
            raise SymbolicMathEvidenceBridgeError("unsealed evidence cannot claim delivery or side effects")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "status": self.status,
            "open_mea_manifest_hash": self.open_mea_manifest_hash,
            "invocation_receipt_hash": self.invocation_receipt_hash,
            "operation_manifest_hash": self.operation_manifest_hash,
            "kernel_execution_receipt_hash": self.kernel_execution_receipt_hash,
            "kernel_pending_governance_receipt_hash": self.kernel_pending_governance_receipt_hash,
            "computed_artifact_hash": self.computed_artifact_hash,
            "operation_family": self.operation_family,
            "verification_strength": self.verification_strength,
            "computed_display_text": self.computed_display_text,
            "kernel_status": self.kernel_status,
            "required_delivery_authority": self.required_delivery_authority,
            "kernel_delivery_authorized": self.kernel_delivery_authorized,
            "kernel_render_allowed": self.kernel_render_allowed,
            "kernel_actual_echo_invoked": self.kernel_actual_echo_invoked,
            "writes_memory": self.writes_memory,
            "writes_identity_vault": self.writes_identity_vault,
            "writes_contribution_economy": self.writes_contribution_economy,
            "mints_ct": self.mints_ct,
            "writes_ledgers": self.writes_ledgers,
            "ingests_corpus": self.ingests_corpus,
        }

    def evidence_hash(self) -> str:
        return canonical_hash(self.to_dict())


@dataclass(frozen=True)
class SymbolicMathResolvedSolution:
    domain: str
    answer_text: str
    operation_family: str
    verification_strength: str
    verification_text: str
    steps: Tuple[str, ...]
    verified: bool = True
    information_gain: int = 1_000_000
    answer_unit: str = ""
    claim_scope: str = "formal_symbolic_derivation"

    def __post_init__(self) -> None:
        if self.domain != DOMAIN_ID or self.operation_family not in language_compiler_boundary()["supported_operation_families"]:
            raise SymbolicMathEvidenceBridgeError("resolved solution is outside this language slice")
        if self.verification_strength not in _ALLOWED_VERIFICATION_STRENGTHS:
            raise SymbolicMathEvidenceBridgeError("resolved solution verification strength is invalid")
        if not self.answer_text.strip() or not self.verification_text.strip() or not self.verified:
            raise SymbolicMathEvidenceBridgeError("only verified non-empty symbolic solutions may enter seal")
        if not 0 < self.information_gain <= 1_000_000:
            raise SymbolicMathEvidenceBridgeError("information gain is outside MEA fixed-point range")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "domain": self.domain,
            "answer_value": self.answer_text,
            "answer_text": self.answer_text,
            "answer_unit": self.answer_unit,
            "operation_family": self.operation_family,
            "verification_strength": self.verification_strength,
            "verification_text": self.verification_text,
            "steps": list(self.steps),
            "verified": self.verified,
            "information_gain": self.information_gain,
            "claim_scope": self.claim_scope,
        }


@dataclass(frozen=True)
class SymbolicMathEvidenceGateResult:
    passed: bool
    evidence_hash: str
    reasons: Tuple[str, ...] = ()
    vector_micro: Mapping[str, int] = field(default_factory=dict)
    schema_version: str = "aiweb_symbolic_math_mea_evidence_gate_v1_gp013"

    def __post_init__(self) -> None:
        _require_digest("evidence_hash", self.evidence_hash)
        if self.passed and self.reasons:
            raise SymbolicMathEvidenceBridgeError("passed MEA gate cannot retain refusal reasons")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "passed": self.passed,
            "evidence_hash": self.evidence_hash,
            "reasons": list(self.reasons),
            "vector_micro": dict(sorted(self.vector_micro.items())),
        }

    def gate_hash(self) -> str:
        return canonical_hash(self.to_dict())


def build_symbolic_math_problem_manifest(
    compiled: CompiledSymbolicMathRequest,
    source: SemanticSource,
) -> ProblemManifest:
    procedure = source.procedure_for_domain(DOMAIN_ID)
    if procedure is None or not source.supports_domain(DOMAIN_ID):
        raise SymbolicMathEvidenceBridgeError("installed language policy source does not authorize this slice")
    if compiled.operation_manifest.capability_id != MATH001_CAPABILITY_ID:
        raise SymbolicMathEvidenceBridgeError("compiled request is not bound to installed math capability")

    problem_id = "nlmath_" + compiled.request_hash()[:24]
    return ProblemManifest(
        problem_id=problem_id,
        goal=(
            f"Resolve the symbolic operation {compiled.operation_family!r} from a fully "
            "compiled natural-language request and preserve verification strength."
        ),
        known_facts=[
            f"raw_question_hash = {compiled.compiler_receipt.raw_question_hash}",
            f"compiler_receipt_hash = {compiled.compiler_receipt.receipt_hash()}",
            f"operation_manifest_hash = {compiled.operation_manifest.manifest_hash()}",
            f"operation_family = {compiled.operation_family}",
            f"expression = {compiled.expression_display}",
            f"installed_language_authority = {source.source_id}",
            f"delegated_computation_capability = {MATH001_CAPABILITY_ID}",
        ],
        unknowns=["verified_symbolic_result"],
        constraints=[
            "natural-language request must be fully consumed by the installed bounded compiler",
            "SymPy receives only the typed allowlisted AST through MATH-001R1",
            "no user-facing language may be delivered until Manifest Contract v2 and actual Echo authorize it",
        ],
        assumptions=[],
        contradictions=[],
        success_conditions=[
            "typed symbolic computation completes with a verified evidence receipt",
            "verified evidence resolves the declared symbolic result",
            "RMC output remains gated by Manifest Contract v2 and actual Echo",
        ],
        failure_conditions=[
            "compiler refuses unrecognized or partially consumed language",
            "symbolic computation is contained or unverified",
            "delivery is attempted before actual Echo authorization",
        ],
        proof_debt=1.0,
        memory_ancestry=[MemoryRef(
            memory_key=procedure.procedure_id,
            source=procedure.source_ref,
            relevance=1.0,
            evidence_tier="installed_bounded_language_policy",
        )],
        goal_ancestry=[f"domain:{DOMAIN_ID}", f"source:{source.source_id}", "tool:cap.math.symbolic_math.v1"],
        claim_status=ClaimStatus.UNCLASSIFIED.value,
        output_permissions=OutputPermission.SEALED.value,
        allowed_tools=[MATH001_CAPABILITY_ID],
    )


def compute_symbolic_math_evidence(
    compiled: CompiledSymbolicMathRequest,
    open_manifest: ProblemManifest,
) -> Tuple[SymbolicMathBridgeInvocationReceipt, SymbolicMathVerifiedToolEvidence, SymbolicMathResolvedSolution, Dict[str, Any]]:
    bridge = language_bridge_contract()
    service = symbolic_math_service_contract()
    invocation = SymbolicMathBridgeInvocationReceipt(
        question_hash=compiled.compiler_receipt.raw_question_hash,
        compiled_request_hash=compiled.request_hash(),
        compiler_receipt_hash=compiled.compiler_receipt.receipt_hash(),
        operation_manifest_hash=compiled.operation_manifest.manifest_hash(),
        bridge_contract_hash=bridge.contract_hash(),
        kernel_service_contract_hash=canonical_hash(service),
    )
    result = execute_symbolic_math_operation(compiled.operation_manifest)
    if result.get("status") != SUCCESS_STATUS:
        reason = result.get("non_delivery_receipt", {}).get("reason_code", "SYMBOLIC_COMPUTATION_CONTAINED")
        raise SymbolicMathEvidenceBridgeError(f"symbolic computation refused or contained: {reason}")
    pending = result.get("pending_governance_receipt", {})
    if (
        result.get("delivery_authorized") is not False
        or result.get("render_allowed") is not False
        or result.get("actual_echo_invoked") is not False
        or pending.get("delivery_authorized") is not False
        or pending.get("render_allowed") is not False
        or pending.get("actual_echo_invoked") is not False
    ):
        raise SymbolicMathEvidenceBridgeError("MATH-001R1 attempted authority beyond computation")
    artifact = result.get("computed_artifact", {})
    display_text = str(artifact.get("display_text", "")).strip()
    verification = result.get("execution_receipt", {}).get("verification", {})
    strength = str(verification.get("strength", ""))
    evidence = SymbolicMathVerifiedToolEvidence(
        open_mea_manifest_hash=mea_manifest_hash(open_manifest),
        invocation_receipt_hash=invocation.receipt_hash(),
        operation_manifest_hash=result["operation_manifest_hash"],
        kernel_execution_receipt_hash=result["execution_receipt_hash"],
        kernel_pending_governance_receipt_hash=result["pending_governance_receipt_hash"],
        computed_artifact_hash=result["computed_artifact_hash"],
        operation_family=compiled.operation_family,
        verification_strength=strength,
        computed_display_text=display_text,
    )
    verification_text = (
        "Verification: exact symbolic equivalence was confirmed by the governed SymPy computation."
        if strength == "EXACT_SYMBOLIC_EQUIVALENCE"
        else (
            "Verification: exact substitution verification was confirmed by the governed SymPy computation."
            if strength == "EXACT_SUBSTITUTION_VERIFICATION"
            else (
                "Verification: the governed SymPy computation was replayed deterministically with the same symbolic result; "
                "this is deterministic computation evidence, not an independent theorem proof."
                if strength == "DETERMINISTIC_ENGINE_REPLAY"
                else "Verification: a governed structural symbolic receipt was produced for this result."
            )
        )
    )
    solution = SymbolicMathResolvedSolution(
        domain=DOMAIN_ID,
        answer_text=display_text,
        operation_family=compiled.operation_family,
        verification_strength=strength,
        verification_text=verification_text,
        steps=(
            f"The request was fully compiled as the {compiled.operation_family} operation family.",
            "The typed mathematical manifest was executed by the isolated governed SymPy worker.",
        ),
    )
    return invocation, evidence, solution, result


def evaluate_symbolic_math_evidence_gate(
    manifest: ProblemManifest,
    solution: SymbolicMathResolvedSolution,
    evidence: SymbolicMathVerifiedToolEvidence,
    source: SemanticSource,
) -> SymbolicMathEvidenceGateResult:
    reasons: List[str] = []
    if MATH001_CAPABILITY_ID not in manifest.allowed_tools:
        reasons.append("manifest_does_not_authorize_installed_symbolic_math_tool")
    if not source.supports_domain(solution.domain):
        reasons.append("installed_language_authority_does_not_support_domain")
    if not solution.verified:
        reasons.append("symbolic_computation_is_not_verified")
    if solution.answer_text != evidence.computed_display_text:
        reasons.append("solution_text_does_not_match_verified_tool_evidence")
    if solution.verification_strength != evidence.verification_strength:
        reasons.append("solution_verification_strength_does_not_match_tool_evidence")
    if evidence.kernel_status != SUCCESS_STATUS:
        reasons.append("kernel_evidence_did_not_complete_pending_governance")
    if any((evidence.kernel_delivery_authorized, evidence.kernel_render_allowed, evidence.kernel_actual_echo_invoked)):
        reasons.append("computation_kernel_improperly_claimed_delivery_authority")
    vector = {
        "information_gain": solution.information_gain,
        "verification": 1_000_000 if solution.verified else 0,
        "source_authorized": 1_000_000 if source.supports_domain(solution.domain) else 0,
        "tool_evidence_bound": 1_000_000 if solution.answer_text == evidence.computed_display_text else 0,
        "pending_governance_preserved": 1_000_000 if not evidence.kernel_delivery_authorized else 0,
        "novelty": 0,
        "operator_cost": 250_000,
    }
    return SymbolicMathEvidenceGateResult(
        passed=not reasons,
        evidence_hash=evidence.evidence_hash(),
        reasons=tuple(reasons),
        vector_micro=vector,
    )


def seal_symbolic_math_problem_manifest(
    manifest: ProblemManifest,
    solution: SymbolicMathResolvedSolution,
    evidence: SymbolicMathVerifiedToolEvidence,
    gate: SymbolicMathEvidenceGateResult,
) -> ProblemManifest:
    if not gate.passed:
        raise SymbolicMathEvidenceBridgeError("MEA symbolic tool evidence has not passed the seal gate")
    facts = list(manifest.known_facts) + [
        f"verified_tool_evidence_hash = {evidence.evidence_hash()}",
        f"kernel_execution_receipt_hash = {evidence.kernel_execution_receipt_hash}",
        f"kernel_pending_governance_receipt_hash = {evidence.kernel_pending_governance_receipt_hash}",
        f"answer = {solution.answer_text}",
        f"verification_strength = {solution.verification_strength}",
        f"verification = {solution.verification_text}",
    ]
    return ProblemManifest(
        problem_id=manifest.problem_id,
        goal=manifest.goal,
        known_facts=facts,
        unknowns=[],
        constraints=manifest.constraints,
        assumptions=manifest.assumptions,
        contradictions=manifest.contradictions,
        success_conditions=manifest.success_conditions,
        failure_conditions=manifest.failure_conditions,
        phase_state=manifest.phase_state,
        phase_path=manifest.phase_path,
        drift_state=manifest.drift_state,
        proof_debt=0.0,
        memory_ancestry=manifest.memory_ancestry,
        operator_history=manifest.operator_history,
        goal_ancestry=manifest.goal_ancestry,
        claim_status=ClaimStatus.RESOLVED_MANIFEST.value,
        output_permissions=OutputPermission.RENDER_ALLOWED.value,
        allowed_tools=manifest.allowed_tools,
    )


def mea_symbolic_math_evidence_bridge_boundary() -> Dict[str, Any]:
    return {
        "build_id": BUILD_ID,
        "schema_version": BRIDGE_SCHEMA_VERSION,
        "layer": "verified symbolic-tool evidence to real MEA ProblemManifest seal boundary",
        "source_authority": "installed_bounded_language_policy_in_memory_only",
        "delegated_computation_capability": MATH001_CAPABILITY_ID,
        "kernel_success_required": SUCCESS_STATUS,
        "verified_tool_evidence_required_before_seal": True,
        "mea_problem_manifest_remains_separate_from_rmc_meaning_manifest": True,
        "kernel_can_deliver_output": False,
        "renders_output": False,
        "actual_echo_invoked_here": False,
        "requires_downstream_delivery_authority": REQUIRED_DELIVERY_AUTHORITY,
        "corpus_ingestion_added": False,
        "calls_llm": False,
        "writes_memory": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "mints_ct": False,
        "writes_ledgers": False,
    }


__all__ = [
    "BRIDGE_SCHEMA_VERSION", "BRIDGE_SERVICE_ID", "SymbolicMathEvidenceBridgeError",
    "SymbolicMathLanguageBridgeContract", "SymbolicMathBridgeInvocationReceipt",
    "SymbolicMathVerifiedToolEvidence", "SymbolicMathResolvedSolution",
    "SymbolicMathEvidenceGateResult", "installed_language_authority_source",
    "language_bridge_contract", "build_symbolic_math_problem_manifest",
    "compute_symbolic_math_evidence", "evaluate_symbolic_math_evidence_gate",
    "seal_symbolic_math_problem_manifest", "mea_symbolic_math_evidence_bridge_boundary",
]
